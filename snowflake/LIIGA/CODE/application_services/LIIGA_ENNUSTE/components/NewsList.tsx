"use client";
// Uutiset ja OK-nappi (27.10.). Kaikki näkevät uutiset (otsikko + linkki lähteeseen)
// ja kirjatut poissaolot. OK-napit näkyvät vain, kun tähän selaimeen on tallennettu
// hyväksyjän token (fine-grained, vain tämä repo, Actions: write): painallus
// käynnistää absence.yml-ajon, joka kirjaa poissaolon, laskee haastajan ja
// julkaisee sivun (~3 min). Token ei lähde muualle kuin api.github.comiin.
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import type { Absence, Candidate, NewsItem } from "@/lib/data";
import { logo } from "@/lib/table";
import { GH_REPO } from "@/lib/target";

const KEY = "liiga-gh-token";
const FLAG_FI: Record<string, string> = { loukkaantuminen: "loukkaantuminen", paluu: "paluu", pelikielto: "pelikielto",
  valmentaja: "valmentaja", siirto: "siirto", kokoonpano: "kokoonpano" };
// Kesto otteluina (käyttäjä 27.10.): juuri ne ottelut lasketaan uudelleen.
const DURATIONS = ["1", "2", "3", "4", "5", "6", "8", "10", "kausi"] as const;
const NUMERALS: Record<string, string> = { yhden: "1", kahden: "2", kolmen: "3", neljän: "4", viiden: "5", kuuden: "6",
  seitsemän: "7", kahdeksan: "8", yhdeksän: "9", kymmenen: "10" };
// Otsikon "kuuden ottelun pelikielto" -> 6; "pitkään sivussa" / "loppukauden" -> kausi.
function guessGames(title: string): string {
  const m = title.toLowerCase().match(/(\d+|yhden|kahden|kolmen|neljän|viiden|kuuden|seitsemän|kahdeksan|yhdeksän|kymmenen) ottelun/);
  if (m) return NUMERALS[m[1]] ?? m[1];
  return /pitkään|kauden|loppukau/i.test(title) ? "kausi" : "1";
}

const day = (iso: string) => (iso ? new Date(iso).toLocaleDateString("fi-FI", { timeZone: "Europe/Helsinki", day: "numeric", month: "numeric" }) : "");
const fiDate = (d: string) => `${Number(d.slice(8, 10))}.${Number(d.slice(5, 7))}.`;

function readToken() { try { return localStorage.getItem(KEY) ?? ""; } catch { return ""; } }

function Approve({ item, c, token }: { item: NewsItem; c: Candidate; token: string }) {
  // Paluu otsikon perusteella: lippu voi tulla ingressistä ("palaavat kokoonpanoon"
  // sai myös loukkaantumislipun), mutta otsikko kertoo, mistä uutisessa on kyse.
  const back = /palaa|paluu|kokoonpanoon|tervehty/i.test(item.title) && !/sivuun|sivussa|loukkaant/i.test(item.title);
  const [dur, setDur] = useState<string>(guessGames(item.title));
  const [state, setState] = useState<"" | "busy" | "ok" | string>("");
  const send = async (kind: "out" | "back") => {
    setState("busy");
    try {
      const r = await fetch(`https://api.github.com/repos/${GH_REPO}/actions/workflows/absence.yml/dispatches`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
        body: JSON.stringify({ ref: "main", inputs: { url: item.url, player: c.player, team: c.team, kind, duration: kind === "out" ? dur : "1" } }),
      });
      setState(r.status === 204 ? "ok" : `virhe ${r.status}`);
    } catch { setState("verkkovirhe"); }
  };
  if (state === "ok") return <div className="nw-sent">✓ Lähetetty: {c.player}. Sivu päivittyy noin 3 minuutissa.</div>;
  return (
    <div className="nw-approve">
      <span className="nw-player">{c.player} <small>{c.team}</small></span>
      {back ? (
        <button className="btn sm" disabled={state === "busy"} onClick={() => send("back")}>Palaa ✓</button>
      ) : (<>
        <div className="seg nw-dur" role="radiogroup" aria-label="Poissa otteluita">
          {DURATIONS.map((k) => <button key={k} role="radio" aria-checked={dur === k} className={dur === k ? "on" : ""} onClick={() => setDur(k)}>{k === "kausi" ? "kausi" : k}</button>)}
        </div>
        <span className="dim nw-unit">{dur === "kausi" ? "loppukausi" : `ottelu${dur === "1" ? "" : "a"}`}</span>
        <button className="btn sm" disabled={state === "busy"} onClick={() => send("out")}>OK</button>
      </>)}
      {state && state !== "busy" && <span className="nw-err">{state}</span>}
    </div>
  );
}

function List({ items, candidates, absences, teams }: { items: NewsItem[]; candidates: Candidate[]; absences: Absence[]; teams: string[] }) {
  const sp = useSearchParams();
  const pick = new Set((sp.get("joukkue") ?? "").split(",").filter((t) => teams.includes(t)));
  const [token, setToken] = useState("");
  const [draft, setDraft] = useState("");
  const [onlyFlagged, setOnlyFlagged] = useState(true);
  useEffect(() => { setToken(readToken()); }, []);
  const save = (v: string) => { try { if (v) localStorage.setItem(KEY, v); else localStorage.removeItem(KEY); } catch { /* yksityinen ikkuna */ } setToken(v); setDraft(""); };

  const shown = items.filter((it) => (!pick.size || it.team.split(",").some((t) => pick.has(t)))
    && (!onlyFlagged || /loukkaantuminen|paluu|pelikielto|valmentaja|siirto/.test(it.flags)));
  return (
    <>
      <div className="nw-tools">
        <label className="sw"><input type="checkbox" checked={onlyFlagged} onChange={(e) => setOnlyFlagged(e.target.checked)} /><span />Vain olennaiset</label>
        <span className="dim">{shown.length} juttua{pick.size ? ` · ${[...pick].join(", ")}` : ""}</span>
      </div>
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
                  ? `poissa ${a.games === "kausi" ? "loppukauden" : `${a.games} ottelua`}, palaa ${fiDate(a.until)}` : `palasi ${fiDate(a.start)}`}</div>
              ))}
              {token && cands.filter((c) => !done.some((a) => a.player === c.player)).map((c) => <Approve key={c.player} item={it} c={c} token={token} />)}
            </article>
          );
        })}
      </div>
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

export default function NewsList(props: { items: NewsItem[]; candidates: Candidate[]; absences: Absence[]; teams: string[] }) {
  return <Suspense><List {...props} /></Suspense>;
}
