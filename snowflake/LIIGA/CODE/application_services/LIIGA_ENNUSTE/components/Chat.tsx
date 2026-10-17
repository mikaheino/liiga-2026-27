"use client";
// "Kysy agentilta": keskustelu LIIGA_ENNUSTAJA-agentin kanssa jokaisella sivulla.
// Historia kulkee mukana, joten jatkokysymykset toimivat; joukkuesivulla
// aloituskysymykset koskevat sitä joukkuetta. Historia säilyy sivulta toiselle
// (sessionStorage), koska keskustelu on usein juuri sitä, mikä vie toiselle sivulle.
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { md } from "@/lib/markdown";

type Turn = { role: "user" | "assistant"; text: string; ms?: number; error?: boolean; suggestions?: string[] };
const KEY = "liiga-chat";
const load = (): Turn[] => { try { return JSON.parse(sessionStorage.getItem(KEY) ?? "[]"); } catch { return []; } };
const save = (t: Turn[]) => { try { sessionStorage.setItem(KEY, JSON.stringify(t.slice(-30))); } catch { /* yksityinen ikkuna */ } };

function starters(path: string): string[] {
  const team = path.startsWith("/joukkue/") ? decodeURIComponent(path.split("/")[2] ?? "") : "";
  // Ei genetiiviä: joukkueiden nimet taipuvat epäsäännöllisesti (CLAUDE.md).
  if (team) return [`Miksi joukkueen ${team} ennuste on muuttunut?`, `Mitä ${team} vaatii päästäkseen kuuden joukkoon?`, `Miten joukkueella ${team} on mennyt viimeisissä otteluissa?`];
  return ["Kierroksen esikatselu: tämän illan ottelut", "Kuka voittaa runkosarjan?", "Miksi KooKoon ennuste on romahtanut?", "Kuinka hyvin malli on osunut?"];
}

export default function Chat({ source = "snowflake" }: { source?: string }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [live, setLive] = useState("");       // striimattava vastaus ennen valmista
  const [status, setStatus] = useState("");   // mitä agentti tekee juuri nyt
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => { setTurns(load()); }, []);
  useEffect(() => { save(turns); end.current?.scrollIntoView({ block: "end" }); }, [turns, open]);
  useEffect(() => { if (live) end.current?.scrollIntoView({ block: "end" }); }, [live]);
  useEffect(() => { if (busy == null) return; const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t); }, [busy]);

  // Vastaus striimataan (NDJSON): tila ja teksti päivittyvät sitä mukaa kuin agentti etenee.
  async function send(text: string) {
    const q = text.trim(); if (!q || busy != null) return;
    const history = [...turns.filter((t) => !t.error), { role: "user" as const, text: q }];
    setTurns([...turns, { role: "user", text: q }]); setDraft(""); setBusy(Date.now()); setNow(Date.now());
    setLive(""); setStatus("Yhdistetään…");
    let done: Turn | null = null;
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ history: history.map(({ role, text }) => ({ role, text })) }) });
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
          else if (e.t === "done") done = { role: "assistant", text: e.text, ms: e.ms, suggestions: e.suggestions };
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

  if (path.startsWith("/mouho")) return null;       // peli käyttää koko ruudun, nappi peittäisi sen
  return (
    <>
      <button className={`chat-fab ${open ? "on" : ""}`} onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="chat">
        {open ? "✕ Sulje" : "▶ Kysy agentilta"}
      </button>
      {open && (
        <aside id="chat" className="chat" aria-label="Keskustelu agentin kanssa">
          <header className="chat-h">
            <div><div className="label">Liiga Ennustaja</div><div className="chat-sub">{source === "local" ? "Paikallinen Claude · data koneelta" : "Snowflake Intelligence -agentti"}</div></div>
            {turns.length > 0 && <button className="chat-clear" onClick={() => setTurns([])}>Tyhjennä</button>}
          </header>
          <div className="chat-log">
            {turns.length === 0 && (
              <div className="chat-start">
                <p>Kysy mitä tahansa Liigan kaudesta 2026–27: ennuste, tulokset, mitä jos -skenaariot, kokoonpanot.</p>
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
            <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Kirjoita kysymys…" disabled={busy != null} aria-label="Kysymys" />
            <button type="submit" className="btn" disabled={busy != null || !draft.trim()}>Lähetä</button>
          </form>
        </aside>
      )}
    </>
  );
}
