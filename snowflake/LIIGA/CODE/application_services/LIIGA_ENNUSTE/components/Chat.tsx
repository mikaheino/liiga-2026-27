"use client";
// "Kysy agentilta": keskustelu LIIGA_ENNUSTAJA-agentin kanssa jokaisella sivulla.
// Historia kulkee mukana, joten jatkokysymykset toimivat. Historia säilyy sivulta
// toiselle (sessionStorage), koska keskustelu on usein juuri sitä, mikä vie
// toiselle sivulle.
//
// Sivutietoisuus (5.11.2026, käyttäjä: "agentilla olisi ymmärrys siitä millä
// sivulla sitä käytetään"): jokaisen kysymyksen mukana lähtee polku ja
// URL-valinnat, ja palvelin rakentaa niistä sivun tilannekuvan
// (lib/pageContext.ts). Myös aloituskysymykset ja otsikon rivi kertovat, mitä
// sivua agentti juuri nyt katsoo -- sama konteksti näkyy siis käyttäjälle.
//
// Telakointi (5.11.2026, käyttäjä: "agentti ei tulisi niin suoraan applikaation
// päälle"): auki ollessaan paneeli ei kellu sisällön päällä vaan on sen vieressä.
// Työpöydällä body saa luokan `chat-open` ja kaventuu paneelin verran, puhelimessa
// paneeli on alalaatikko, jonka yläpuolella sivu näkyy ja vierii (globals.css).
//
// Avaaminen (6.11.2026): ei kelluvaa nappia. Kohteeseen sidottu agentti (CardAgent)
// on pääreitti; vapaa keskustelu avataan navigaation "Kysy"-kohdasta (AskButton) tai
// kortin vastausriviltä "Jatka keskustelua", jolloin kortin kysymys ja vastaus tulevat
// keskustelun jatkoksi (lib/chatBus.ts). #agentti URL:ssa avaa myös.
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { chatState, onOpenChat } from "@/lib/chatBus";
import { modelLabel } from "@/lib/agentTools";
import { md } from "@/lib/markdown";

type Turn = { role: "user" | "assistant"; text: string; ms?: number; error?: boolean; suggestions?: string[]; tools?: string[] };
const KEY = "liiga-chat";
const load = (): Turn[] => { try { return JSON.parse(sessionStorage.getItem(KEY) ?? "[]"); } catch { return []; } };
const save = (t: Turn[]) => { try { sessionStorage.setItem(KEY, JSON.stringify(t.slice(-30))); } catch { /* yksityinen ikkuna */ } };

const teamOf = (path: string) => (path.startsWith("/joukkue/") ? decodeURIComponent(path.split("/")[2] ?? "") : "");

// Sivun nimi otsikkoriville: käyttäjä näkee, mitä agentti tietää katsovansa.
// Palvelin tekee saman päättelyn uudelleen (lib/pageContext.ts) eikä luota tähän.
function pageName(path: string): string {
  const team = teamOf(path);
  if (team) return team;
  if (path === "/") return "Etusivu";
  if (path.startsWith("/sarjataulukko")) return "Sarjataulukko";
  if (path.startsWith("/voittaja")) return "Runkosarjan voittaja";
  if (path.startsWith("/ottelut")) return "Ottelut";
  if (path.startsWith("/liike")) return "Ennusteen liike";
  if (path.startsWith("/sijainti")) return "Sijainnit";
  if (path.startsWith("/pelaajat")) return "Pelaajat";
  if (path.startsWith("/uutiset")) return "Uutiset";
  return "Sovellus";
}

// Aloituskysymykset sivun mukaan: ne ovat sitä, mitä juuri tältä näkymältä on
// luontevaa kysyä. Ei genetiiviä -- joukkueiden nimet taipuvat epäsäännöllisesti.
function starters(path: string): string[] {
  const team = teamOf(path);
  if (team) return [`Miksi joukkueen ${team} ennuste on muuttunut?`, `Mitä ${team} vaatii päästäkseen kuuden joukkoon?`, `Miten joukkueella ${team} on mennyt viimeisissä otteluissa?`];
  if (path.startsWith("/sarjataulukko")) return ["Mikä tässä taulukossa yllättää mallia eniten?", "Ketkä ovat pudonneet eniten esikauden odotuksesta?", "Kuka nousee vielä kuuden joukkoon?"];
  if (path.startsWith("/voittaja")) return ["Miksi suosikki on juuri tämä joukkue?", "Mitä haastaja vaatisi noustakseen kärkeen?", "Kuinka iso ero kahden kärjen välillä oikeasti on?"];
  if (path.startsWith("/ottelut")) return ["Kierroksen esikatselu: tämän illan ottelut", "Missä malli meni tässä kuussa pahiten pieleen?", "Mikä on illan tasaisin ottelu?"];
  if (path.startsWith("/liike")) return ["Miksi ennuste on muuttunut eniten tällä joukkueella?", "Mikä osuus muutoksesta on kokoonpanoja?", "Onko muutos tuloksia vai mallin uutta arviota?"];
  if (path.startsWith("/sijainti")) return ["Mitä putoamisviivan yläpuolella pysyminen vaatii?", "Kuinka varma kuuden kärki on?", "Mikä sija on epävarmin?"];
  if (path.startsWith("/uutiset")) return ["Mitä tämän päivän poissaolot tekevät illan otteluille?", "Kenen poissaolo painaa eniten?", "Miten haastaja eroaa perusmallista?"];
  if (path.startsWith("/pelaajat")) return ["Kenen pelaajan poissaolo painaisi ennusteessa eniten?", "Ketkä maalivahdit ovat ylittäneet odotukset kestävästi?", "Mikä joukkue nojaa eniten yhteen pelaajaan?"];
  return ["Kierroksen esikatselu: tämän illan ottelut", "Kuka voittaa runkosarjan?", "Miksi KooKoon ennuste on romahtanut?", "Kuinka hyvin malli on osunut?"];
}

export default function Chat({ source = "snowflake" }: { source?: string }) {
  const path = usePathname();
  const hidden = path.startsWith("/mouho");        // peli käyttää koko ruudun
  const [open, setOpen] = useState(false);
  const [wide, setWide] = useState(false);          // puhelimen laatikko: 55 % vai lähes koko ruutu
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [live, setLive] = useState("");       // striimattava vastaus ennen valmista
  const [status, setStatus] = useState("");   // mitä agentti tekee juuri nyt
  const end = useRef<HTMLDivElement>(null);
  // Avustajan ehdottama kysymys odottaa, kunnes kupla on auki (send käyttää ajantasaista tilaa).
  const [ask, setAsk] = useState<string | null>(null);

  useEffect(() => { setTurns(load()); }, []);
  // Suora linkki keskusteluun: /sarjataulukko#agentti avaa paneelin valmiiksi.
  useEffect(() => { if (window.location.hash === "#agentti") setOpen(true); }, [path]);
  // Avaajat: navigaation Kysy (toggle) ja kortin "Jatka keskustelua" (seed).
  useEffect(() => onOpenChat((o) => {
    if (o.ask) { setOpen(true); setAsk(o.ask); }
    else if (o.seed?.length) { setTurns((t) => [...t, ...o.seed!]); setOpen(true); }
    else setOpen((v) => (o.toggle ? !v : true));
  }), []);
  useEffect(() => { chatState(open && !hidden); }, [open, hidden]);
  useEffect(() => {
    if (!open) return;
    // Escape sulkee paneelin, ellei kortti ole auki (kortti sulkee ensin itsensä).
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape" && !document.querySelector(".mc-wrap")) setOpen(false); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open]);
  useEffect(() => { save(turns); end.current?.scrollIntoView({ block: "end" }); }, [turns, open]);
  useEffect(() => { if (live) end.current?.scrollIntoView({ block: "end" }); }, [live]);
  useEffect(() => { if (busy == null) return; const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t); }, [busy]);

  // Kupla hahmon yläpuolella (7.11.2026, "ei yläruutu vaan hoverointi"): sivu ei enää kavennu
  // paneelin verran, joten body saa vain merkintäluokan (ei asettelusääntöjä).
  useEffect(() => {
    const on = open && !hidden;
    document.body.classList.toggle("chat-float", on);
    return () => { document.body.classList.remove("chat-float"); };
  }, [open, hidden, wide]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (open && ask && busy == null) { const q = ask; setAsk(null); send(q); } }, [open, ask, busy]);

  // Vastaus striimataan (NDJSON): tila ja teksti päivittyvät sitä mukaa kuin agentti etenee.
  async function send(text: string) {
    const q = text.trim(); if (!q || busy != null) return;
    const history = [...turns.filter((t) => !t.error), { role: "user" as const, text: q }];
    // Sivu luetaan lähetyshetkellä: myös pelkkä kyselymerkkijonon muutos
    // (?nakyma=, ?kk=) näkyy agentille ilman erillistä seurantaa.
    const page = { path: window.location.pathname, query: window.location.search.replace(/^\?/, "") };
    setTurns([...turns, { role: "user", text: q }]); setDraft(""); setBusy(Date.now()); setNow(Date.now());
    setLive(""); setStatus("Yhdistetään…");
    let done: Turn | null = null;
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ history: history.map(({ role, text }) => ({ role, text })), page }) });
      if (!res.ok || !res.body) { const j = await res.json().catch(() => ({})); throw new Error(j.error ?? `HTTP ${res.status}`); }
      const reader = res.body.getReader(), dec = new TextDecoder();
      let buf = "", acc = "";
      for (;;) {
        const { value, done: end } = await reader.read();
        if (end) break;
        buf += dec.decode(value, { stream: true });
        for (let i; (i = buf.indexOf("\n")) >= 0;) {
          const line = buf.slice(0, i); buf = buf.slice(i + 1);
          if (!line.trim()) continue;
          const e = JSON.parse(line);
          if (e.t === "status") setStatus(e.text);
          else if (e.t === "delta") { acc += e.text; setLive(acc.split(/\n?\s*JATKO:/)[0]); }
          else if (e.t === "done") done = { role: "assistant", text: e.text, ms: e.ms, suggestions: e.suggestions, tools: e.tools };
          else if (e.t === "error") done = { role: "assistant", text: `Agentti ei vastannut: ${e.text}`, error: true };
        }
      }
      if (!done) done = acc ? { role: "assistant", text: acc, ms: Date.now() - (busy ?? Date.now()) } : { role: "assistant", text: "Agentti ei vastannut.", error: true };
    } catch (e) {
      done = { role: "assistant", text: `Yhteys katkesi: ${(e as Error).message}`, error: true };
    } finally {
      setTurns((t) => [...t, done!]); setBusy(null); setLive(""); setStatus("");
    }
  }

  if (hidden) return null;
  const where = pageName(path);
  return (
    <>
      {open && (
        <aside id="chat" className="chat" aria-label="Keskustelu agentin kanssa">
          <header className="chat-h">
            <button className="chat-grip" onClick={() => setWide(!wide)} aria-label={wide ? "Pienennä keskustelu" : "Suurenna keskustelu"} />
            <div className="chat-who">
              <div className="label">Liiga Ennustaja</div>
              <div className="chat-sub">
                <span className="chat-here" title="Agentti tietää, mitä sivua katsot">◎ {where}</span>
                <span className="chat-dot">·</span>{modelLabel(source, [...turns].reverse().find((t) => t.role === "assistant" && t.tools)?.tools)}
              </div>
            </div>
            <div className="chat-acts">
              {turns.length > 0 && <button className="chat-clear" onClick={() => setTurns([])}>Tyhjennä</button>}
              <button className="chat-x" onClick={() => setOpen(false)} aria-label="Sulje keskustelu">✕</button>
            </div>
          </header>
          <div className="chat-log">
            {turns.length === 0 && (
              <div className="chat-start">
                <p>Kysy mitä tahansa Liigan kaudesta 2026–27. Agentti näkee, mitä sivulla <b>{where}</b> on nyt auki, joten voit viitata siihen suoraan.</p>
                {starters(path).map((s) => <button key={s} className="chat-q" onClick={() => send(s)}>▸ {s}</button>)}
              </div>
            )}
            {turns.map((t, i) => (
              <div key={i} className={`msg ${t.role} ${t.error ? "err" : ""}`}>
                {t.role === "user" ? <p>{t.text}</p> : <div dangerouslySetInnerHTML={{ __html: md(t.text) }} />}
                {t.ms != null && <span className="msg-ms">{(t.ms / 1000).toFixed(0)} s</span>}
              </div>
            ))}
            {busy == null && turns.at(-1)?.suggestions?.length ? (
              <div className="chat-follow">
                {turns.at(-1)!.suggestions!.map((s) => <button key={s} className="chat-q" onClick={() => send(s)}>▸ {s}</button>)}
              </div>
            ) : null}
            {busy != null && live && (
              <div className="msg assistant streaming"><div dangerouslySetInnerHTML={{ __html: md(live) }} /></div>
            )}
            {busy != null && (
              <div className="msg assistant thinking">
                <div className="loading-rink small"><b className="puck" /></div>
                <span>{status || "Agentti miettii…"} {Math.max(0, Math.round((now - busy) / 1000))} s</span>
              </div>
            )}
            <div ref={end} />
          </div>
          <form className="chat-in" onSubmit={(e) => { e.preventDefault(); send(draft); }}>
            <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={`Kysy sivusta ${where}…`} disabled={busy != null} aria-label="Kysymys" />
            <button type="submit" className="btn" disabled={busy != null || !draft.trim()}>Lähetä</button>
          </form>
        </aside>
      )}
    </>
  );
}
