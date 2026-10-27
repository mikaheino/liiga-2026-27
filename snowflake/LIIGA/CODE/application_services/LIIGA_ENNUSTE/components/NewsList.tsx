"use client";
// Uutiset ja OK-nappi (27.10.). Kaikki näkevät uutiset (otsikko + linkki lähteeseen)
// ja kirjatut poissaolot. OK-napit näkyvät vain, kun tähän selaimeen on tallennettu
// hyväksyjän token (fine-grained, vain tämä repo, Actions: write): painallus
// käynnistää absence.yml-ajon, joka kirjaa poissaolon, laskee haastajan ja
// julkaisee sivun (~3 min). Token ei lähde muualle kuin api.github.comiin.
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import type { Absence, Candidate, NewsEffect, NewsItem, Player } from "@/lib/data";
import { fi, logo } from "@/lib/table";
import { GH_REPO } from "@/lib/target";

const KEY = "liiga-gh-token";
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
  seitsemän: 7, kahdeksan: 8, yhdeksän: 9, kymmenen: 10 };
const MONTHS = ["tammikuun", "helmikuun", "maaliskuun", "huhtikuun", "toukokuun", "kesäkuun",
  "heinäkuun", "elokuun", "syyskuun", "lokakuun", "marraskuun", "joulukuun"];
const NUM = "(\\d+|yhden|kahden|kolmen|neljän|viiden|kuuden|seitsemän|kahdeksan|yhdeksän|kymmenen)";

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

function readToken() { try { return localStorage.getItem(KEY) ?? ""; } catch { return ""; } }

async function dispatch(token: string, inputs: Record<string, string>): Promise<string> {
  try {
    const r = await fetch(`https://api.github.com/repos/${GH_REPO}/actions/workflows/absence.yml/dispatches`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
      body: JSON.stringify({ ref: "main", inputs }),
    });
    return r.status === 204 ? "ok" : `virhe ${r.status}`;
  } catch { return "verkkovirhe"; }
}

// Poissaolon kirjaus: pelaaja (ehdotus tai valinta rosterista), kesto ja OK.
// Paluu-uutisessa "Palaa" päättää pelaajan poissaolon.
function AbsenceForm({ url, title, preset, teams, roster, token, allowBack }: {
  url: string; title: string; preset?: Candidate; teams: string[]; roster: Player[]; token: string; allowBack: boolean;
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
    setState(await dispatch(token, { url, player, team, kind, duration: kind === "out" ? duration : "1ott" }));
  };
  if (state === "ok") return <div className="nw-sent">✓ Lähetetty: {player}. Sivu päivittyy noin 3 minuutissa.</div>;
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

function List({ items, candidates, absences, teams, roster, effects }: { items: NewsItem[]; candidates: Candidate[]; absences: Absence[]; teams: string[]; roster: Player[]; effects: NewsEffect[] }) {
  const sp = useSearchParams();
  const pick = new Set((sp.get("joukkue") ?? "").split(",").filter((t) => teams.includes(t)));
  const [token, setToken] = useState("");
  const [draft, setDraft] = useState("");
  const [cat, setCat] = useState("olennaiset");
  const [open, setOpen] = useState<string | null>(null);      // uutinen, jolle valitaan pelaaja itse
  useEffect(() => { setToken(readToken()); }, []);
  const save = (v: string) => { try { if (v) localStorage.setItem(KEY, v); else localStorage.removeItem(KEY); } catch { /* yksityinen ikkuna */ } setToken(v); setDraft(""); };

  const rx = (CATS.find((c) => c[0] === cat) ?? CATS[0])[2];
  const shown = items.filter((it) => (!pick.size || it.team.split(",").some((t) => pick.has(t))) && (cat === "kaikki" || rx.test(it.flags)));
  return (
    <>
      <nav className="nw-cats" aria-label="Uutisluokka">
        {CATS.map(([k, l]) => <button key={k} className={`chip ${cat === k ? "on" : ""}`} aria-pressed={cat === k} onClick={() => setCat(k)}>{l}</button>)}
      </nav>
      <div className="nw-tools"><span className="dim">{shown.length} juttua{pick.size ? ` · ${[...pick].join(", ")}` : ""}</span></div>
      <div className="nw-list">
        {shown.map((it) => {
          const cands = candidates.filter((c) => c.url === it.url);
          const done = absences.filter((a) => a.url === it.url);
          return (
            <article key={it.url} className="nw-item">
              <div className="nw-meta">
                <span>{day(it.published || it.fetched)}</span>
                {it.team.split(",").filter(Boolean).map((t) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={t} src={logo(t)} alt={t} width={16} height={16} />
                ))}
                <span>{it.source}</span>
                {it.flags.split(";").filter((f) => FLAG_FI[f] && f !== "kokoonpano").map((f) => <i key={f} className={`nw-flag f-${f}`}>{FLAG_FI[f]}</i>)}
              </div>
              <a className="nw-title" href={it.url} target="_blank" rel="noopener noreferrer">{it.title}</a>
              {done.map((a) => (
                <div key={a.player + a.start} className="nw-done">✓ {a.player}: {a.kind === "out"
                  ? `poissa ${label(a.games)}, palaa ${fiDate(a.until)}` : `palasi ${fiDate(a.start)}`}</div>
              ))}
              {effects.filter((e) => e.url === it.url).map((e) => <Effect key={e.player} e={e} />)}
              {/siirto/.test(it.flags) && !/loukkaantuminen|paluu|pelikielto/.test(it.flags) && (
                <div className="nw-roster">{cands.length
                  ? `Rosterissa: ${cands.map((c) => `${c.player} (${c.team})`).join(", ")}`
                  : "Ei rosterissa: uusi nimi? Tee pelaajalisäys."}</div>
              )}
              {token && /loukkaantuminen|paluu|pelikielto/.test(it.flags) && cands.filter((c) => !done.some((a) => a.player === c.player)).map((c) => (
                <AbsenceForm key={c.player} url={it.url} title={it.title} preset={c} teams={teams} roster={roster} token={token}
                  allowBack={/palaa|paluu|kokoonpanoon|tervehty/i.test(it.title) && !/sivuun|sivussa|loukkaant/i.test(it.title)} />
              ))}
              {token && (open === it.url
                ? <AbsenceForm url={it.url} title={it.title} teams={it.team.split(",").filter(Boolean)} roster={roster} token={token} allowBack />
                : <button className="nw-other" onClick={() => setOpen(it.url)}>+ {cands.length ? "muu pelaaja" : "kirjaa poissaolo"}</button>)}
            </article>
          );
        })}
      </div>
      {token && (
        <details className="nw-settings">
          <summary>Poissaolo ilman uutista</summary>
          <p>Tieto muualta (esim. lehden juttu, jota keräin ei lue): valitse pelaaja ja kesto.</p>
          <AbsenceForm url="" title="" teams={teams} roster={roster} token={token} allowBack />
        </details>
      )}
      <details className="nw-settings">
        <summary>Hyväksyjän asetukset {token ? "· avain tallennettu" : ""}</summary>
        <p>OK-napit näkyvät vain selaimessa, johon on tallennettu GitHub-avain: fine-grained token, vain repo {GH_REPO}, oikeus <b>Actions: Read and write</b>. Avain tallentuu vain tähän selaimeen.</p>
        <div className="nw-token">
          <input type="password" placeholder="github_pat_…" value={draft} onChange={(e) => setDraft(e.target.value)} autoComplete="off" />
          <button className="btn sm" onClick={() => save(draft.trim())} disabled={!draft.trim()}>Tallenna</button>
          {token && <button className="btn sm" onClick={() => save("")}>Poista</button>}
        </div>
      </details>
    </>
  );
}

export default function NewsList(props: { items: NewsItem[]; candidates: Candidate[]; absences: Absence[]; teams: string[]; roster: Player[]; effects: NewsEffect[] }) {
  return <Suspense><List {...props} /></Suspense>;
}
