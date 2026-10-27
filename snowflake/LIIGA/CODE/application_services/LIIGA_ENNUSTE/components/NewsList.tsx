"use client";
// Uutiset ja OK-nappi (27.10.). Kaikki näkevät uutiset (otsikko + linkki lähteeseen)
// ja kirjatut poissaolot. Lomakkeet vain kirjautuneelle: kirjautumislinkki näkyy
// vain uutisessa, jossa on annettavaa (käyttäjä 27.10.: ei vie tilaa UI:lta).
// Kirjautuminen ja OK kulkevat välipalvelimen kautta (workers/hyvaksynta): GitHub
// tunnistaa, palvelin hyväksyy vain sallitun tunnuksen ja käynnistää absence.yml-
// ajon omalla avaimellaan. Selaimessa on vain 30 päivän istunto.
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import type { Absence, Candidate, HistoryEvent, NewsEffect, NewsItem, Player } from "@/lib/data";
import { fi, logo } from "@/lib/table";
import { APPROVE_URL } from "@/lib/target";

const KEY = "liiga-istunto";
// Uutissovellus (käyttäjä 27.10.): luokat liputuksen mukaan. "Olennaiset" = kaikki
// paitsi liputtamattomat ja pelkät kokoonpanojutut.
const CATS: [string, string, RegExp][] = [
  ["olennaiset", "Olennaiset", /loukkaantuminen|paluu|pelikielto|valmentaja|siirto/],
  ["loukk", "Loukkaantumiset", /loukkaantuminen|paluu/],
  ["kielto", "Pelikiellot", /pelikielto/],
  ["siirto", "Siirrot ja hankinnat", /siirto/],
  ["valm", "Valmentajat", /valmentaja/],
  ["kaikki", "Kaikki", /.*/],
];
const FLAG_FI: Record<string, string> = { loukkaantuminen: "loukkaantuminen", paluu: "paluu", pelikielto: "pelikielto",
  valmentaja: "valmentaja", siirto: "siirto", kokoonpano: "kokoonpano" };
// Kesto otteluina, viikkoina tai kuukausina tai loppukausi (käyttäjä 27.10.):
// uutinen kertoo pituuden milloin missäkin yksikössä. absence.yml/approve.py
// muuttaa sen paluupäiväksi; juuri ne ottelut lasketaan haastajassa uudelleen.
type Unit = "ott" | "vko" | "kk" | "kausi";
const UNITS: [Unit, string][] = [["ott", "ottelua"], ["vko", "viikkoa"], ["kk", "kuukautta"], ["kausi", "loppukausi"]];
const MAX: Record<Exclude<Unit, "kausi">, number> = { ott: 60, vko: 30, kk: 7 };
const NUMERALS: Record<string, number> = { yhden: 1, kahden: 2, kolmen: 3, neljän: 4, viiden: 5, kuuden: 6,
  seitsemän: 7, kahdeksan: 8, yhdeksän: 9, kymmenen: 10, yksi: 1, kaksi: 2, kolme: 3, neljä: 4, viisi: 5, kuusi: 6 };
const MONTHS = ["tammikuun", "helmikuun", "maaliskuun", "huhtikuun", "toukokuun", "kesäkuun",
  "heinäkuun", "elokuun", "syyskuun", "lokakuun", "marraskuun", "joulukuun"];
// Väli "2-4 viikkoa" -> suurempi (sama sääntö kuin challenger_season.py).
const NUM = `(?:\\d+\\s*[-–]\\s*)?(\\d+|${Object.keys(NUMERALS).join("|")})`;

// Otsikon arvaus: "kuuden ottelun pelikielto" -> 6 ott, "kahden viikon" -> 2 vko,
// "kuukauden" -> 1 kk, "lokakuun sivussa" -> viikot kuun loppuun, "pitkään" -> kausi.
function guess(title: string): [number, Unit] {
  const t = title.toLowerCase();
  const n = (w: string) => NUMERALS[w] ?? Number(w);
  let m = t.match(new RegExp(`${NUM} ottelu`)); if (m) return [n(m[1]), "ott"];
  m = t.match(new RegExp(`${NUM} viik`)); if (m) return [n(m[1]), "vko"];
  m = t.match(new RegExp(`${NUM} kuukau`)); if (m) return [n(m[1]), "kk"];
  if (/viikon|viikoksi/.test(t)) return [1, "vko"];
  if (/kuukauden|kuukaudeksi/.test(t)) return [1, "kk"];
  const mi = MONTHS.findIndex((mo) => t.includes(`${mo} sivu`) || t.includes(`${mo} ajan`));
  if (mi >= 0) {
    const now = new Date(), end = new Date(now.getFullYear() + (mi < now.getMonth() ? 1 : 0), mi + 1, 1);
    return [Math.max(1, Math.ceil((end.getTime() - now.getTime()) / (7 * 864e5))), "vko"];
  }
  if (/pitkään|loppukau|kauden ajan|koko kauden/.test(t)) return [1, "kausi"];
  return [1, "ott"];
}
const label = (d: string) => (d === "kausi" ? "loppukauden" : d.replace(/^(\d+)(ott|vko|kk)$/, (_, n, u) =>
  `${n} ${u === "ott" ? (n === "1" ? "ottelu" : "ottelua") : u === "vko" ? (n === "1" ? "viikko" : "viikkoa") : (n === "1" ? "kuukausi" : "kuukautta")}`));

const day = (iso: string) => (iso ? new Date(iso).toLocaleDateString("fi-FI", { timeZone: "Europe/Helsinki", day: "numeric", month: "numeric" }) : "");
const fiDate = (d: string) => `${Number(d.slice(8, 10))}.${Number(d.slice(5, 7))}.`;

// Lähetetyt mutta vielä julkaisemattomat kirjaukset (käyttäjä 27.10.: "en tiedä
// menikö muutos sisään"): näkyvät uutisessa päivityksen yli, kunnes sivun data
// sisältää ne tai tunti on kulunut. Pages-sivu on selaimen välimuistissa 10 min.
const PENDING = "liiga-odottaa";
type Pending = { url: string; player: string; at: number };
function readPending(): Pending[] {
  try { return (JSON.parse(localStorage.getItem(PENDING) ?? "[]") as Pending[]).filter((p) => Date.now() - p.at < 3600e3); } catch { return []; }
}
function addPending(p: Pending) {
  try { localStorage.setItem(PENDING, JSON.stringify([...readPending(), p])); } catch { /* yksityinen ikkuna */ }
}
const clock = (ms: number) => new Date(ms).toLocaleTimeString("fi-FI", { timeZone: "Europe/Helsinki", hour: "2-digit", minute: "2-digit" });

const store = (v: string | null) => { try { if (v) localStorage.setItem(KEY, v); else localStorage.removeItem(KEY); } catch { /* yksityinen ikkuna */ } };

// Istunto: kirjautumisen jälkeen palvelin palauttaa sivulle #istunto=...; talteen
// ja osoiteriviltä pois. #kirjautuminen=ei-oikeutta, jos tunnus ei ole sallittu.
function readSession(): { session: string; note: string } {
  let note = "";
  try {
    const h = new URLSearchParams(location.hash.slice(1));
    if (h.get("istunto")) store(h.get("istunto"));
    if (h.get("kirjautuminen")) note = h.get("kirjautuminen") === "ei-oikeutta" ? "Tällä GitHub-tunnuksella ei ole muokkausoikeutta." : "Kirjautuminen epäonnistui.";
    if (h.get("istunto") || h.get("kirjautuminen")) history.replaceState(null, "", location.pathname + location.search);
    return { session: localStorage.getItem(KEY) ?? "", note };
  } catch { return { session: "", note }; }
}
// Paluuosoite vasta selaimessa (useEffect): staattisessa käännöksessä ei ole locationia.
const loginHref = (ret: string) => `${APPROVE_URL}/login${ret ? `?return=${encodeURIComponent(ret)}` : ""}`;

async function dispatch(session: string, inputs: Record<string, string>): Promise<string> {
  try {
    const r = await fetch(`${APPROVE_URL}/absence`, {
      method: "POST", headers: { Authorization: `Bearer ${session}`, "Content-Type": "application/json" }, body: JSON.stringify(inputs),
    });
    if (r.status === 401) { store(null); return "istunto vanhentui: kirjaudu uudelleen"; }
    return r.status === 204 ? "ok" : `virhe ${r.status}`;
  } catch { return "verkkovirhe"; }
}

// Poissaolon kirjaus: pelaaja (ehdotus tai valinta rosterista), kesto ja OK.
// Paluu-uutisessa "Palaa" päättää pelaajan poissaolon.
function AbsenceForm({ url, title, preset, teams, roster, session, allowBack }: {
  url: string; title: string; preset?: Candidate; teams: string[]; roster: Player[]; session: string; allowBack: boolean;
}) {
  const [g0, u0] = guess(title);
  const [n, setN] = useState(g0);
  const [unit, setUnit] = useState<Unit>(u0);
  const [team, setTeam] = useState(preset?.team ?? teams[0] ?? "");
  const [player, setPlayer] = useState(preset?.player ?? "");
  const [state, setState] = useState("");
  const pool = roster.filter((p) => p.team === team);
  const max = unit === "kausi" ? 1 : MAX[unit];
  const duration = unit === "kausi" ? "kausi" : `${Math.min(Math.max(n, 1), max)}${unit}`;
  const send = async (kind: "out" | "back") => {
    setState("busy");
    const r = await dispatch(session, { url, player, team, kind, duration: kind === "out" ? duration : "1ott" });
    if (r === "ok") addPending({ url, player, at: Date.now() });
    setState(r);
  };
  if (state === "ok") return <div className="nw-sent">⏳ Kirjattu klo {clock(Date.now())}: {player}. Sivu päivittyy noin 3–4 minuutissa; päivitä sivu sen jälkeen.</div>;
  return (
    <div className="nw-approve">
      {preset ? <span className="nw-player">{preset.player} <small>{preset.team}</small></span> : (
        <span className="nw-pick">
          <select value={team} onChange={(e) => { setTeam(e.target.value); setPlayer(""); }} aria-label="Joukkue">
            {[...new Set(roster.map((p) => p.team))].map((t) => <option key={t}>{t}</option>)}
          </select>
          <select value={player} onChange={(e) => setPlayer(e.target.value)} aria-label="Pelaaja">
            <option value="">valitse pelaaja</option>
            {pool.map((p) => <option key={p.player} value={p.player}>{p.player} ({p.position})</option>)}
          </select>
        </span>
      )}
      {allowBack && <button className="btn sm" disabled={!player || state === "busy"} onClick={() => send("back")}>Palaa ✓</button>}
      <span className="nw-len">
        {unit !== "kausi" && (
          <span className="nw-step">
            <button onClick={() => setN(Math.max(1, n - 1))} aria-label="Vähemmän">−</button>
            <b>{Math.min(n, max)}</b>
            <button onClick={() => setN(Math.min(max, n + 1))} aria-label="Enemmän">+</button>
          </span>
        )}
        <span className="seg nw-unit-seg" role="radiogroup" aria-label="Yksikkö">
          {UNITS.map(([k, l]) => <button key={k} role="radio" aria-checked={unit === k} className={unit === k ? "on" : ""} onClick={() => setUnit(k)}>{l}</button>)}
        </span>
      </span>
      <button className="btn sm" disabled={!player || state === "busy"} onClick={() => send("out")}>Poissa – OK</button>
      {state && state !== "busy" && <span className="nw-err">{state}</span>}
    </div>
  );
}

function Effect({ e }: { e: NewsEffect }) {
  return (
    <div className="nw-effect">
      Vaikutus ennusteeseen: {e.team} voittaa {e.games} ottelu{e.games === 1 ? "ssa" : "ssa keskimäärin"} {fi(100 * e.winBefore, 1)} → {fi(100 * e.winAfter, 1)} %,
      {" "}odotetut pisteet {e.xp > 0 ? "+" : "−"}{fi(Math.abs(e.xp), 2)}
      <small>{e.approved ? " · haastajassa" : " · arvio otsikon kestosta, ei vielä haastajassa"}</small>
    </div>
  );
}

const EDITABLE = /loukkaantuminen|paluu|pelikielto/;
const NEEDS_DAYS = 21;
const isBack = (t: string) => /palaa|paluu|kokoonpanoon|tervehty/i.test(t) && !/sivuun|sivussa|loukkaant/i.test(t);

// Yksi uutinen: otsikon napautus avaa ingressin samaan näkymään (käyttäjä 27.10.:
// "en pysty samaan aikaan kirjaamaan ja lukemaan uutista"); koko juttu erikseen.
function Item({ it, open, onToggle, children }: { it: NewsItem; open: boolean; onToggle: () => void; children?: React.ReactNode }) {
  return (
    <article className={`nw-item ${open ? "open" : ""}`}>
      <div className="nw-meta">
        <span>{day(it.published || it.fetched)}</span>
        {it.team.split(",").filter(Boolean).map((t) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={t} src={logo(t)} alt={t} width={16} height={16} />
        ))}
        <span>{it.source}</span>
        {it.flags.split(";").filter((f) => FLAG_FI[f] && f !== "kokoonpano").map((f) => <i key={f} className={`nw-flag f-${f}`}>{FLAG_FI[f]}</i>)}
      </div>
      <button className="nw-title" onClick={onToggle} aria-expanded={open}>{it.title}</button>
      {open && (
        <div className="nw-body">
          {it.summary ? <p>{it.summary}</p> : <p className="dim">Lähde ei anna ingressiä.</p>}
          <a href={it.url} target="_blank" rel="noopener noreferrer">Avaa juttu ↗</a>
        </div>
      )}
      {children}
    </article>
  );
}

function History({ events, items, session, onUndo }: { events: HistoryEvent[]; items: NewsItem[]; session: string; onUndo: (url: string) => void }) {
  const title = new Map(items.map((i) => [i.url, i.title]));
  const [undone, setUndone] = useState<Set<string>>(new Set());
  if (!events.length) return <p className="dim">Ei vielä kirjauksia.</p>;
  const what = (e: HistoryEvent) => e.kind === "out" ? `poissa ${label(e.games)} · ${fiDate(e.start)}–${fiDate(e.until)}`
    : e.kind === "dismiss" ? "uutinen ohitettu" : `palasi ${fiDate(e.start)}`;
  return (
    <div className="nw-list">
      {events.map((e) => (
        <div key={e.approvedAt + e.player} className="hs-row">
          <div className="nw-meta">
            <span>{day(e.approvedAt)}</span>
            {e.team && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo(e.team)} alt={e.team} width={16} height={16} />
            )}
            <i className={`nw-flag hs-${e.status.replace(/\s/g, "-")}`}>{e.status}</i>
            {e.source === "auto" && <i className="nw-flag">automaattinen</i>}
          </div>
          <div className="hs-main"><b>{e.player || "—"}</b> {what(e)}</div>
          {e.nGames != null && e.winBefore != null && (
            <div className="nw-effect">Vaikutus jäljellä oleviin {e.nGames} otteluun: voitto {fi(100 * e.winBefore, 1)} → {fi(100 * e.winAfter!, 1)} %, odotetut pisteet {e.xp! < 0 ? "−" : "+"}{fi(Math.abs(e.xp!), 2)}</div>
          )}
          {e.url && e.url !== "kokoonpano" && title.get(e.url) && <a className="hs-src" href={e.url} target="_blank" rel="noopener noreferrer">{title.get(e.url)} ↗</a>}
          {e.url === "kokoonpano" && <div className="hs-src">Pelaaja oli ottelun kokoonpanossa, joten haastaja lopetti poissaolon itse.</div>}
          {session && e.source === "auto" && e.status === "voimassa" && (undone.has(e.url)
            ? <div className="nw-sent">⏳ Peruttu, sivu päivittyy noin 3–4 minuutissa</div>
            : <button className="nw-other nw-skip" onClick={() => { onUndo(e.url); setUndone((s) => new Set(s).add(e.url)); }}>Peru – tulkinta väärin</button>)}
        </div>
      ))}
    </div>
  );
}

function List({ items, candidates, absences, teams, roster, effects, events, builtAt }: {
  items: NewsItem[]; candidates: Candidate[]; absences: Absence[]; teams: string[]; roster: Player[];
  effects: NewsEffect[]; events: HistoryEvent[]; builtAt: string;
}) {
  const sp = useSearchParams();
  const pick = new Set((sp.get("joukkue") ?? "").split(",").filter((t) => teams.includes(t)));
  const [session, setSession] = useState("");
  const [note, setNote] = useState("");
  const [ret, setRet] = useState("");
  const [pending, setPending] = useState<Pending[]>([]);
  const [tab, setTab] = useState<"input" | "news" | "history">("news");
  const [cat, setCat] = useState("olennaiset");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [other, setOther] = useState<string | null>(null);      // uutinen, jolle valitaan pelaaja itse
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  useEffect(() => {
    const r = readSession(); setSession(r.session); setNote(r.note); setRet(location.href.split("#")[0]);
    const left = readPending().filter((p) => !absences.some((a) => a.url === p.url && (a.player === p.player || a.kind === "dismiss")));
    try { localStorage.setItem(PENDING, JSON.stringify(left)); } catch { /* yksityinen ikkuna */ }
    setPending(left);
    if (r.session) setTab("input");
  }, [absences]);
  const logout = () => { store(null); setSession(""); };
  const toggle = (u: string) => setOpen((s) => { const n = new Set(s); if (n.has(u)) n.delete(u); else n.add(u); return n; });

  // Kirjattavat (käyttäjä 27.10.: "relevantteja uutisia liikaa, kirjatut samassa"):
  // loukkaantumis- ja pelikieltouutiset, joita ei ole kirjattu eikä ohitettu, enintään
  // kolme viikkoa vanhat; paluu-uutinen vain, jos se koskee voimassa olevaa kirjausta.
  const handled = new Set([...absences.map((a) => a.url), ...pending.map((p) => p.url), ...dismissed]);
  const since = new Date(Date.now() - NEEDS_DAYS * 864e5).toISOString();
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Helsinki" });
  const state = new Map<string, Absence>();
  for (const a of absences) if (a.kind === "out" || a.kind === "back") state.set(a.player, a);
  const out = new Set([...state.values()].filter((a) => a.kind === "out" && a.until > today).map((a) => a.player));
  const relevant = (it: NewsItem) => /loukkaantuminen|pelikielto/.test(it.flags)
    || (/paluu/.test(it.flags) && candidates.some((c) => c.url === it.url && out.has(c.player)));
  const needs = items.filter((it) => relevant(it) && !handled.has(it.url) && (it.published || it.fetched) >= since);
  const rx = (CATS.find((c) => c[0] === cat) ?? CATS[0])[2];
  const byTeam = (it: NewsItem) => !pick.size || it.team.split(",").some((t) => pick.has(t));
  const shown = (tab === "input" ? needs : items.filter((it) => cat === "kaikki" || rx.test(it.flags))).filter(byTeam);
  const dismiss = async (u: string) => {
    const r = await dispatch(session, { url: u, player: "", team: "", kind: "dismiss", duration: "1ott" });
    if (r === "ok") { addPending({ url: u, player: "", at: Date.now() }); setDismissed((s) => new Set(s).add(u)); } else setNote(r);
  };

  return (
    <>
      <nav className="tabs nw-tabs" aria-label="Uutisnäkymä">
        <a className={tab === "input" ? "on" : ""} onClick={() => setTab("input")}>Kirjattavat{needs.length ? ` (${needs.length})` : ""}</a>
        <a className={tab === "news" ? "on" : ""} onClick={() => setTab("news")}>Uutiset</a>
        <a className={tab === "history" ? "on" : ""} onClick={() => setTab("history")}>Historia</a>
      </nav>
      {note && <div className="nw-err">{note}</div>}
      {tab === "history" ? <History events={events} items={items} session={session} onUndo={dismiss} /> : (<>
        {tab === "news" && (
          <nav className="nw-cats" aria-label="Uutisluokka">
            {CATS.map(([k, l]) => <button key={k} className={`chip ${cat === k ? "on" : ""}`} aria-pressed={cat === k} onClick={() => setCat(k)}>{l}</button>)}
          </nav>
        )}
        <div className="nw-tools">
          <span className="dim">{shown.length} juttua{pick.size ? ` · ${[...pick].join(", ")}` : ""}</span>
          <span className="dim">sivu päivitetty {builtAt}</span>
        </div>
        {tab === "input" && !session && APPROVE_URL && <a className="btn sm nw-login" href={loginHref(ret)}>Kirjaudu antaaksesi poissaolot</a>}
        {tab === "input" && shown.length === 0 && <p className="dim">Ei kirjattavaa: kaikki loukkaantumis-, paluu- ja pelikieltouutiset on käsitelty.</p>}
        <div className="nw-list">
          {shown.map((it) => {
            const cands = candidates.filter((c) => c.url === it.url);
            const done = absences.filter((a) => a.url === it.url && a.kind !== "dismiss");
            const text = `${it.title} ${it.summary}`;
            const form = tab === "input" && session;
            return (
              <Item key={it.url} it={it} open={tab === "input" || open.has(it.url)} onToggle={() => toggle(it.url)}>
                {done.map((a) => (
                  <div key={a.player + a.start} className="nw-done">✓ {a.player}: {a.kind === "out"
                    ? `poissa ${label(a.games)}, palaa ${fiDate(a.until)}` : `palasi ${fiDate(a.start)}`}{a.source === "auto" ? " · kirjattu automaattisesti" : ""}</div>
                ))}
                {pending.filter((p) => p.url === it.url).map((p) => (
                  <div key={p.player + p.at} className="nw-sent">⏳ {p.player || "ohitus"}: kirjattu klo {clock(p.at)}, odottaa julkaisua</div>
                ))}
                {effects.filter((e) => e.url === it.url).map((e) => <Effect key={e.player} e={e} />)}
                {/siirto/.test(it.flags) && !EDITABLE.test(it.flags) && (
                  <div className="nw-roster">{cands.length
                    ? `Rosterissa: ${cands.map((c) => `${c.player} (${c.team})`).join(", ")}`
                    : "Ei rosterissa: uusi nimi? Tee pelaajalisäys."}</div>
                )}
                {form && cands.map((c) => (
                  <AbsenceForm key={c.player} url={it.url} title={text} preset={c} teams={teams} roster={roster} session={session} allowBack={isBack(it.title)} />
                ))}
                {form && (other === it.url
                  ? <AbsenceForm url={it.url} title={text} teams={it.team.split(",").filter(Boolean)} roster={roster} session={session} allowBack />
                  : <span className="nw-actions">
                      <button className="nw-other" onClick={() => setOther(it.url)}>+ {cands.length ? "muu pelaaja" : "valitse pelaaja"}</button>
                      <button className="nw-other nw-skip" onClick={() => dismiss(it.url)}>Ohita – ei vaikuta</button>
                    </span>)}
              </Item>
            );
          })}
        </div>
        {tab === "input" && session && (<>
          <details className="nw-settings">
            <summary>Poissaolo ilman uutista</summary>
            <p>Tieto muualta (esim. lehden juttu, jota keräin ei lue): valitse pelaaja ja kesto.</p>
            <AbsenceForm url="" title="" teams={teams} roster={roster} session={session} allowBack />
          </details>
          <button className="nw-other nw-logout" onClick={logout}>Kirjaudu ulos</button>
        </>)}
      </>)}
    </>
  );
}

export default function NewsList(props: {
  items: NewsItem[]; candidates: Candidate[]; absences: Absence[]; teams: string[]; roster: Player[];
  effects: NewsEffect[]; events: HistoryEvent[]; builtAt: string;
}) {
  return <Suspense><List {...props} /></Suspense>;
}
