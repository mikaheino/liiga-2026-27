"use client";
// Tarkka näkymä (13.11.2026, käyttäjä: "näkymä, jossa skenaarioita voi rakentaa muutenkin kuin
// sanallisesti, ja/tai sanallista skenaariota voi jatkaa tarkemmassa näkymässä", esim. "joukkueen
// loppukauden pelit, tai osa niistä"). Ottelu kerrallaan -rakentaja, joka muokkaa SAMAA skenaariota
// kuin hakukenttä: rivit tulevat ScenarioBoardilta (lib/lockBus.ts) ja muutokset menevät takaisin
// onChange-kutsulla, joten teksti ja tarkka muokkaus sekoittuvat kumpaan järjestykseen tahansa.
// Vain ottelulukitukset muokataan; poissaolot, muutokset ja tavoitteet kulkevat sellaisinaan.
// Ottelut ja panokset: /api/skenaario/ottelut (moottori, ei kielimallia). Ei Pagesissa (STATIC).
// Taulukko otteluiden rinnalla (13.11.2026, omistaja: "interaktiivinen näkymä, jossa näen vaikutuksen
// sarjataulukkoon samaan aikaan"): ScenarioBoardin luoma lopputaulukko (table) näkyy leveällä näytöllä
// oikealla ja pysyy ruudussa; puhelimessa välilehdet Ottelut / Taulukko, ja alareunan yhteenveto kertoo
// valitun joukkueen sijan ja pisteet nyt -> skenaariossa sekä vie taulukkoon yhdellä napautuksella.
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { MAX_LOCKS, lockLabel, type GameLock, type Item } from "@/lib/lockBus";
import { fi, logo } from "@/lib/table";
import type { TRow } from "@/lib/scenarioTable";
import { STATIC } from "@/lib/target";

type Game = { id: number; date: string; iso: string; home: string; away: string; pHome: number | null; win: number | null; loss: number | null };
type TeamGames = { goal: string | null; games: Game[] };
type Code = GameLock["result"];
// Sarjataulukon sarakkeet joukkueen näkökulmasta: V 3 p, JV 2 p, JH 1 p, H 0 p.
const OUTS = ["V", "JV", "JH", "H"] as const;
type Out = (typeof OUTS)[number];
const PTS: Record<Out, number> = { V: 3, JV: 2, JH: 1, H: 0 };
const LONG: Record<Out, string> = { V: "voitto varsinaisella ajalla", JV: "jatkoaika- tai voittolaukausvoitto", JH: "jatkoaika- tai voittolaukaustappio", H: "tappio varsinaisella ajalla" };
const FINE = ["home_reg", "home_ot", "away_ot", "away_reg"] as const;
type Fine = (typeof FINE)[number];
// Moottorin tulokset kanonisina lopputuloksina (simulate_scenario.py GAME_RESULTS).
const ALLOWED: Record<Code, Fine[]> = {
  home_reg: ["home_reg"], home_ot: ["home_ot"], away_ot: ["away_ot"], away_reg: ["away_reg"],
  home_win: ["home_reg", "home_ot"], away_win: ["away_ot", "away_reg"], overtime: ["home_ot", "away_ot"],
  regulation: ["home_reg", "away_reg"], home_point: ["home_reg", "home_ot", "away_ot"], away_point: ["home_ot", "away_ot", "away_reg"],
};
const OUT_OF: Record<"home" | "away", Record<Fine, Out>> = {
  home: { home_reg: "V", home_ot: "JV", away_ot: "JH", away_reg: "H" },
  away: { away_reg: "V", away_ot: "JV", home_ot: "JH", home_reg: "H" },
};
const codeOf = (o: Out, home: boolean): Fine => (Object.entries(OUT_OF[home ? "home" : "away"]) as [Fine, Out][]).find(([, x]) => x === o)![0];
const outsOf = (r: Code, home: boolean): Out[] => OUTS.filter((o) => ALLOWED[r].some((c) => OUT_OF[home ? "home" : "away"][c] === o));
// Karkea lukitus (tekstistä tai ottelukortista) luettavana joukkueen näkökulmasta; ei koskaan pudoteta.
const COARSE: Record<string, string> = { "V,JV": "voitto", "JH,H": "tappio", "JV,JH": "jatkoaika", "V,H": "ratkeaa varsinaisella ajalla",
  "V,JV,JH": "vähintään piste", "JV,JH,H": "ei voittoa varsinaisella ajalla" };
const PHRASE: Record<string, string> = { top6: "kärkikuusikkoon", top10: "pudotuspeleihin", win: "runkosarjan voittoon", avoid_relegation: "putoaa" };
const pc = (p: number) => (p > 0 && p < 0.005 ? "<1" : fi(100 * p, 0));
const day = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("fi-FI", { weekday: "short", timeZone: "Europe/Helsinki" });
// Ottelun joukkueet labelista ("18.11. KalPa–Lukko: …"), kun joukkueen otteluita ei ole vielä haettu.
const fromLabel = (l: string) => { const m = /^(\S+) (.+?)–(.+?): /.exec(l); return m ? { date: m[1], home: m[2], away: m[3] } : null; };
type Fill = "next5" | "home" | "away" | "all";
const FILLS: [Fill, string][] = [["next5", "Seuraavat 5"], ["home", "Kaikki kotiottelut"], ["away", "Kaikki vierasottelut"], ["all", "Kaikki jäljellä olevat"]];

export default function ScenarioBuilder({ items, teams, rows, base, busy, table, onTeam, onChange, onClose }: {
  items: Item[]; teams: string[]; rows: TRow[]; base: boolean; busy: boolean; table: ReactNode;
  onTeam?: (team: string | null) => void; onChange: (next: Item[]) => void; onClose: () => void;
}) {
  const locks = items.filter((i): i is GameLock => "game_id" in i);
  const other = items.filter((i) => !("game_id" in i));
  const [cache, setCache] = useState<Record<string, TeamGames | "loading" | "error">>({});
  // Aloitusjoukkue: se, jonka otteluita skenaariossa on eniten (tekstistä jatkettaessa yleensä kysytty joukkue).
  const [team, setTeam] = useState<string | null>(() => {
    const n = new Map<string, number>();
    for (const l of locks) { const g = fromLabel(l.label ?? ""); if (g) [g.home, g.away].forEach((t) => n.set(t, (n.get(t) ?? 0) + 1)); }
    return [...n].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  });
  const [fill, setFill] = useState<Fill>("next5");
  const [note, setNote] = useState("");
  // Puhelimen välilehti (alle 1100 px; leveällä molemmat näkyvät rinnakkain). Säilyy niin kauan kuin näkymä on auki.
  const [tab, setTab] = useState<"games" | "table">("games");
  const box = useRef<HTMLDivElement>(null);
  const show = (t: "games" | "table") => {
    setTab(t);
    const calm = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    requestAnimationFrame(() => box.current?.scrollIntoView({ block: "start", behavior: calm ? "auto" : "smooth" }));
  };
  // Valittu joukkue korostetaan taulukossa (ScenarioBoard: focus).
  useEffect(() => { onTeam?.(team); }, [team, onTeam]);
  useEffect(() => () => onTeam?.(null), [onTeam]);
  useEffect(() => {
    if (STATIC || !team || cache[team]) return;
    setCache((c) => ({ ...c, [team]: "loading" }));
    fetch(`/api/skenaario/ottelut?team=${encodeURIComponent(team)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: { goal?: string | null; games?: Game[] }) => setCache((c) => ({ ...c, [team]: {
        goal: j.goal ?? null, games: [...(j.games ?? [])].sort((a, b) => a.iso.localeCompare(b.iso)) } })))
      .catch(() => setCache((c) => ({ ...c, [team]: "error" })));
  }, [team, cache]);

  // Ottelun joukkueet: haetuista otteluista, muuten lukituksen labelista.
  const idx = useMemo(() => {
    const m = new Map<number, { home: string; away: string }>();
    for (const v of Object.values(cache)) if (typeof v === "object") for (const g of v.games) m.set(g.id, g);
    return m;
  }, [cache]);
  const sides = (l: GameLock) => idx.get(l.game_id) ?? fromLabel(l.label ?? "");
  const lockedOf = (t: string) => locks.filter((l) => { const s = sides(l); return !!s && (s.home === t || s.away === t); });
  const full = items.length >= MAX_LOCKS;

  // Kirjoitus: olemassa oleva rivi vaihtuu paikallaan, uusi lisätään loppuun; muut rivit ennallaan.
  const write = (set: Map<number, GameLock | null>) => {
    const next: Item[] = [];
    for (const i of items) {
      if ("game_id" in i && set.has(i.game_id)) { const v = set.get(i.game_id); if (v) next.push(v); set.delete(i.game_id); }
      else next.push(i);
    }
    for (const v of set.values()) if (v) next.push(v);
    onChange(next);
  };
  const lockOf = (g: Game, o: Out): GameLock => {
    const r = codeOf(o, g.home === team);
    return { game_id: g.id, result: r, label: lockLabel(g.date, g.home, g.away, r) };
  };
  const tap = (g: Game, o: Out) => {
    const cur = locks.find((l) => l.game_id === g.id);
    const same = cur && cur.result === codeOf(o, g.home === team);
    if (!cur && full) return;
    setNote("");
    write(new Map([[g.id, same ? null : lockOf(g, o)]]));
  };

  const data = team ? cache[team] : undefined;
  const games = typeof data === "object" ? data.games : [];
  const quick = (o: Out) => {
    const pick = fill === "next5" ? games.slice(0, 5) : fill === "home" ? games.filter((g) => g.home === team)
      : fill === "away" ? games.filter((g) => g.away === team) : games;
    let room = MAX_LOCKS - items.length, skipped = 0, replaced = 0;
    const set = new Map<number, GameLock | null>();
    for (const g of pick) {
      const cur = locks.find((l) => l.game_id === g.id);
      if (cur) { if (cur.result !== codeOf(o, g.home === team)) replaced++; }
      else if (room > 0) room--;
      else { skipped++; continue; }
      set.set(g.id, lockOf(g, o));
    }
    write(set);
    // Raja ei pudota aiempia rivejä: ylimenevät jätetään lukitsematta ja siitä kerrotaan.
    setNote([skipped ? `${pick.length - skipped}/${pick.length} ottelua mahtui: skenaarion raja on ${MAX_LOCKS} riviä.` : "",
      replaced ? `Korvattiin ${replaced} aiempaa lukitusta.` : ""].filter(Boolean).join(" "));
  };
  const clearTeam = () => {
    if (!team) return;
    const ids = new Set([...games.map((g) => g.id), ...lockedOf(team).map((l) => l.game_id)]);
    setNote("");
    onChange(items.filter((i) => !("game_id" in i && ids.has(i.game_id))));
  };

  // Valitun joukkueen pisteet lukituista otteluista; karkea lukitus antaa vaihteluvälin.
  const mine = team ? lockedOf(team) : [];
  let lo = 0, hi = 0;
  for (const l of mine) {
    const s = sides(l)!;
    const p = outsOf(l.result, s.home === team).map((o) => PTS[o]);
    lo += Math.min(...p); hi += Math.max(...p);
  }
  // Yhteenvedon ydin: valitun joukkueen sija ja pisteet nyt -> skenaariossa (sama rivi kuin taulukossa).
  const tr = team ? rows.find((r) => r.team === team) : undefined;
  const rankLine = !tr ? null : base || tr.rankNow == null || tr.pointsNow == null
    ? <>{tr.rank}. · {Math.round(tr.points)} p <span className="dim">(nykyennuste)</span></>
    : <>{tr.rankNow}. → <b>{tr.rank}.</b> · {Math.round(tr.pointsNow)} → <b>{Math.round(tr.points)}</b> p</>;

  if (STATIC) return null;
  return (
    <div className="sb" ref={box} role="region" aria-label="Tarkka näkymä: skenaario ottelu kerrallaan">
      <div className="sb-head">
        <div>
          <div className="sb-h">Tarkka näkymä</div>
          <p className="sb-sub">Muokkaat nykyistä skenaariota: samat rivit kuin hakukentän alla. Valitse joukkue ja lukitse ottelut
            sen näkökulmasta. Uusi haku hakukentässä jatkaa näistä riveistä.</p>
        </div>
        <button type="button" className="sb-x" onClick={onClose} aria-label="Sulje tarkka näkymä">✕</button>
      </div>
      <div className="sb-tabs" role="tablist" aria-label="Näkymä">
        <button type="button" role="tab" id="sb-tab-g" aria-controls="sb-pane-g" aria-selected={tab === "games"} className={tab === "games" ? "on" : ""}
          onClick={() => setTab("games")}>Ottelut{locks.length ? ` · ${locks.length}` : ""}</button>
        <button type="button" role="tab" id="sb-tab-t" aria-controls="sb-pane-t" aria-selected={tab === "table"} className={tab === "table" ? "on" : ""}
          onClick={() => setTab("table")}>Taulukko</button>
      </div>
      <div className={`sb-body t-${tab}`}>
      <div className="sb-main" id="sb-pane-g" role="tabpanel" aria-labelledby="sb-tab-g">
      {other.length > 0 && (
        <p className="sb-other">Skenaariossa myös {other.length} muuta riviä (pysyvät ennallaan): {other.slice(0, 3).map((i) => i.label).join(" · ")}{other.length > 3 ? ` · +${other.length - 3}` : ""}</p>
      )}
      <div className="sb-teams" role="group" aria-label="Joukkue">
        {teams.map((t) => {
          const n = lockedOf(t).length;
          return (
            <button key={t} type="button" className={`sb-team ${t === team ? "on" : ""}`} aria-pressed={t === team}
              aria-label={`${t}${n ? `, ${n} lukittua ottelua` : ""}`} title={t} onClick={() => { setTeam(t); setNote(""); }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logo(t)} alt="" width={28} height={28} />
              {n > 0 && <span className="sb-n" aria-hidden>{n}</span>}
            </button>
          );
        })}
      </div>
      {!team && <p className="sb-hint">Valitse joukkue logosta. Valinnat säilyvät, kun vaihdat joukkuetta.</p>}
      {team && (<>
        <div className="sb-th">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo(team)} alt="" width={22} height={22} /> <b>{team}</b>
          <span>{games.length ? `${games.length} pelaamatonta ottelua` : ""}</span>
        </div>
        {data === "loading" && <p className="sb-hint">Haetaan otteluita ja panoksia…</p>}
        {data === "error" && <p className="sb-hint">Otteluita ei saatu haettua. <button type="button" className="sb-link"
          onClick={() => setCache((c) => { const x = { ...c }; delete x[team]; return x; })}>Yritä uudelleen</button></p>}
        {games.length > 0 && (
          <div className="sb-fill">
            <label className="sb-fill-l">Täytä
              <select value={fill} onChange={(e) => setFill(e.target.value as Fill)}>
                {FILLS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </label>
            <div className="sb-fill-b" role="group" aria-label="Täytä valitut ottelut tuloksella">
              {OUTS.map((o) => <button key={o} type="button" title={`Täytä: ${LONG[o]}`} aria-label={`Täytä: ${LONG[o]}`} onClick={() => quick(o)}>{o}</button>)}
            </div>
            <button type="button" className="sb-link" onClick={clearTeam} disabled={!lockedOf(team).length}>Tyhjennä joukkueen ottelut</button>
          </div>
        )}
        {typeof data === "object" && data.goal && games.some((g) => g.win != null) && (
          <p className="sb-legend">Panos: {data.goal === "avoid_relegation" ? "putoamisen" : "tavoitteen"} todennäköisyys voitolla ↔ tappiolla.</p>
        )}
        <ol className="sb-games">
          {games.map((g) => {
            const home = g.home === team, opp = home ? g.away : g.home;
            const cur = locks.find((l) => l.game_id === g.id);
            const set = cur ? outsOf(cur.result, home) : [];
            const exact = set.length === 1 ? set[0] : null;
            const coarse = cur && !exact ? COARSE[set.join(",")] ?? cur.result : null;
            const pw = g.pHome == null ? null : home ? g.pHome : 1 - g.pHome;
            const goal = typeof data === "object" ? data.goal : null;
            const flip = goal === "avoid_relegation";
            const dis = !cur && full;
            return (
              <li key={g.id} className={`sb-g ${cur ? "locked" : ""}`}>
                <div className="sb-gi">
                  <span className="sb-d">{day(g.iso)} {g.date}</span>
                  <span className="sb-o">
                    <span className={`sb-ha ${home ? "h" : "a"}`}>{home ? "Koti" : "Vieras"}</span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logo(opp)} alt="" width={18} height={18} /> {home ? "vs" : "@"} {opp}
                  </span>
                  {pw != null && <span className="sb-p">voitto {pc(pw)} %</span>}
                  {goal && g.win != null && g.loss != null && (
                    <span className="sb-st" title="voitolla ↔ tappiolla">{PHRASE[goal] ?? goal} {pc(flip ? 1 - g.win : g.win)} % ↔ {pc(flip ? 1 - g.loss : g.loss)} %</span>
                  )}
                  {coarse && <span className="sb-coarse">Lukittu: {coarse} · tarkenna tai poista</span>}
                </div>
                <div className="sb-seg" role="group" aria-label={`${g.date} ${team} ${home ? "vs" : "@"} ${opp}: tulos`}>
                  {OUTS.map((o) => (
                    <button key={o} type="button" aria-pressed={exact === o} disabled={dis}
                      className={exact === o ? "on" : set.includes(o) ? "maybe" : ""}
                      title={dis ? `Skenaarion raja ${MAX_LOCKS} riviä täynnä` : `${LONG[o]} (${PTS[o]} p)${exact === o ? ", napauta poistaaksesi" : ""}`}
                      aria-label={`${o}: ${LONG[o]}${set.includes(o) && !exact ? " (sallittu nykyisessä lukituksessa)" : ""}`}
                      onClick={() => tap(g, o)}>
                      {exact === o && <span aria-hidden>✓</span>}{o}</button>
                  ))}
                  {coarse && <button type="button" className="sb-clr" aria-label="Poista lukitus" title="Poista lukitus"
                    onClick={() => { setNote(""); write(new Map([[g.id, null]])); }}>✕</button>}
                </div>
              </li>
            );
          })}
        </ol>
      </>)}
      </div>
      <div className="sb-side" id="sb-pane-t" role="tabpanel" aria-labelledby="sb-tab-t">{table}</div>
      </div>
      <div className="sb-sum" aria-live="polite">
        {team && tr && <span className="sb-sum-k">{team} sija {rankLine}{busy ? <span className="dim"> · lasketaan…</span> : ""}</span>}
        <div className="sb-sum-t">
          <span><b>{locks.length}</b> ottelua lukittu{team ? <> · {team} <b>{lo === hi ? lo : `${lo}–${hi}`} p</b> lukituista</> : ""}
            {!(team && tr) && busy ? " · lasketaan…" : ""}</span>
          {full && <span className="sb-warn">Raja täynnä ({MAX_LOCKS} riviä): uusia otteluita ei voi lukita. Lukittuja voi muuttaa tai poistaa.</span>}
          {note && <span className="sb-warn">{note}</span>}
        </div>
        <div className="sb-sum-b">
          <button type="button" className="btn sm sb-sw" onClick={() => show(tab === "table" ? "games" : "table")}>
            {tab === "table" ? "Ottelut" : "Taulukko"}</button>
          <button type="button" className="btn sm" onClick={onClose}>Valmis</button>
        </div>
      </div>
    </div>
  );
}
