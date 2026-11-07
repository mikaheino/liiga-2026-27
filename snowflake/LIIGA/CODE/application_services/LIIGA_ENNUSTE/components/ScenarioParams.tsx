"use client";
// Skenaarion säätö ilman kirjoittamista (7.11.2026, käyttäjä: "keskustelun jatkaminen luontevasti ei
// onnistu" -> "parametrisointi olis parempi", "esim entä jos maalivahti vaihtuu", "hae uutisista
// ideat", "per peli"). Valmiin skenaarion kanonisista riveistä tehdään säätimet; muutos menee suoraan
// moottorille (/api/skenaario), ei kielimallille, joten luvut ja kuvaaja päivittyvät nopeasti ja
// ovat datasta:
//   - ottelukohtaisesti: tulos (voittaa / häviää / jatkoaika / vähintään piste), maalivahti (varavahti
//     ykkösvahdin tilalla juuri siinä ottelussa) ja uutisten pelaajat ("poissa tästä ottelusta")
//   - lukittujen otteluiden määrä (ensimmäiset n)
//   - poissaolon kesto ja joukkueen muutoksen (xG-osuus) suuruus liukusäätimellä
// Ykkös- ja varavahti sekä uutispelaajat: /api/skenaario/parametrit.
import { useEffect, useMemo, useRef, useState } from "react";
import type { Item } from "@/lib/lockBus";

type Res = "win" | "loss" | "ot" | "point";
type Game = { id: number; date: string; iso: string; home: string; away: string; res: Res };
type Opts = { goalies: Record<string, { starter: string; backup: string | null }>; news: Record<string, { player: string; kind: string }[]> };
const RES: [Res, string][] = [["win", "voittaa"], ["loss", "häviää"], ["ot", "jatkoaika"], ["point", "väh. piste"]];

const isoOf = (d: string) => {
  const [dd, mm] = d.split(".").map(Number);
  return `${mm >= 7 ? 2026 : 2027}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
};
const nextDay = (iso: string) => new Date(Date.parse(`${iso}T12:00:00Z`) + 864e5).toISOString().slice(0, 10);

// Kanoniset ottelurivit -> pelit ja "oma joukkue" (useimmissa riveissä esiintyvä).
function parseGames(orig: Item[]): { team: string | null; games: Game[] } {
  const raw = orig.filter((i) => "game_id" in i).map((i) => {
    const lab = String(i.label ?? "");
    const [head, what = ""] = lab.split(": ");
    const [date, match = ""] = head.split(" ");
    const [home, away] = match.split("–");
    return { id: Number((i as { game_id: number }).game_id), date, iso: isoOf(date), home, away, what };
  });
  const count = new Map<string, number>();
  raw.forEach((g) => [g.home, g.away].forEach((t) => count.set(t, (count.get(t) ?? 0) + 1)));
  const team = [...count].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const games = raw.filter((g) => team && (g.home === team || g.away === team)).map((g) => {
    const res: Res = g.what.includes("jatkoajalle") ? "ot" : g.what.includes("vähintään pisteen") ? "point"
      : g.what.startsWith(`${team} voittaa`) ? "win" : "loss";
    return { id: g.id, date: g.date, iso: g.iso, home: g.home, away: g.away, res };
  });
  return { team, games };
}

function code(r: Res, home: boolean): string {
  return r === "ot" ? "overtime" : r === "point" ? (home ? "home_point" : "away_point")
    : (r === "win") === home ? "home_win" : "away_win";
}

export default function ScenarioParams({ orig, onApply }: { orig: Item[]; onApply: (items: Item[]) => void }) {
  const { team, games } = useMemo(() => parseGames(orig), [orig]);
  const injuries = orig.filter((i) => "injury" in i && !("from" in i)) as (Item & { injury: string | number; games: number })[];
  const shifts = orig.filter((i) => "xg_share" in i) as (Item & { team: string; xg_share: number })[];
  // Muut rivit sellaisinaan: tavoitteet ja jo ottelukohtaiset poissaolot.
  const rest = orig.filter((i) => "goal" in i || ("injury" in i && "from" in i));
  const [res, setRes] = useState<Record<number, Res>>({});
  const [n, setN] = useState(games.length);
  const [gk, setGk] = useState<Set<number>>(new Set());
  const [out, setOut] = useState<Set<string>>(new Set());
  const [inj, setInj] = useState<Record<string, number>>({});
  const [sh, setSh] = useState<Record<string, number>>({});
  const [all, setAll] = useState(false);
  const [opts, setOpts] = useState<Opts | null>(null);
  const teams = [...new Set([team, ...shifts.map((s) => s.team)].filter(Boolean))] as string[];
  useEffect(() => {
    if (!teams.length) return;
    fetch(`/api/skenaario/parametrit?teams=${encodeURIComponent(teams.join(","))}`, { cache: "no-store" }).then((r) => r.json()).then(setOpts).catch(() => {});
  }, [teams.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  // Säädöt -> rivit moottorille (viive, ettei liukusäädin laske joka askeleella).
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const t = setTimeout(() => {
      const items: Item[] = [];
      const keep = games.slice(0, n);
      for (const g of keep) items.push({ game_id: g.id, result: code(res[g.id] ?? g.res, g.home === team), label: "" } as unknown as Item);
      const starter = team ? opts?.goalies[team]?.starter : undefined;
      for (const g of keep) {
        if (starter && gk.has(g.id)) items.push({ injury: starter, from: g.iso, until: nextDay(g.iso), label: "" } as unknown as Item);
        for (const p of opts?.news[team ?? ""] ?? []) if (out.has(`${g.id}|${p.player}`)) items.push({ injury: p.player, from: g.iso, until: nextDay(g.iso), label: "" } as unknown as Item);
      }
      for (const i of injuries) items.push({ ...i, games: inj[String(i.injury)] ?? i.games });
      for (const s of shifts) items.push({ ...s, xg_share: Math.round((sh[s.team] ?? s.xg_share) * 1000) / 1000 });
      items.push(...rest);
      onApply(items);
    }, 350);
    return () => clearTimeout(t);
  }, [res, n, gk, out, inj, sh]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!games.length && !injuries.length && !shifts.length) return null;
  const toggle = <T,>(s: Set<T>, v: T) => { const x = new Set(s); if (x.has(v)) x.delete(v); else x.add(v); return x; };
  const shown = all || games.length <= 6 ? games.slice(0, n) : games.slice(0, Math.min(n, 5));
  const goalie = team ? opts?.goalies[team] : undefined;
  return (
    <div className="sp">
      <div className="sp-h">Säädä skenaariota</div>
      {games.length > 1 && (
        <label className="sp-row">
          <span>Lukittuja otteluita</span>
          <input type="range" min={1} max={games.length} value={n} onChange={(e) => setN(Number(e.target.value))} />
          <b>{n} / {games.length}</b>
        </label>
      )}
      {shown.map((g) => {
        const r = res[g.id] ?? g.res;
        return (
          <div key={g.id} className="sp-game">
            <div className="sp-g">{g.date} {g.home}–{g.away}</div>
            <div className="sp-seg" role="radiogroup" aria-label={`${team} tulos ${g.date}`}>
              {RES.map(([k, l]) => (
                <button key={k} type="button" role="radio" aria-checked={r === k} className={r === k ? "on" : ""}
                  onClick={() => setRes({ ...res, [g.id]: k })}>{l}</button>
              ))}
            </div>
            <div className="sp-chips">
              {goalie?.backup && (
                <button type="button" className={`sp-chip ${gk.has(g.id) ? "on" : ""}`} onClick={() => setGk(toggle(gk, g.id))}>
                  {gk.has(g.id) ? `Maalissa ${goalie.backup}` : `Maalissa ${goalie.starter}`}</button>
              )}
              {(opts?.news[team ?? ""] ?? []).map((p) => {
                const k = `${g.id}|${p.player}`;
                return <button key={k} type="button" className={`sp-chip ${out.has(k) ? "on" : ""}`} title="Uutisista"
                  onClick={() => setOut(toggle(out, k))}>{out.has(k) ? `${p.player} poissa` : `${p.player} pelaa`}</button>;
              })}
            </div>
          </div>
        );
      })}
      {games.length > 6 && n > 5 && <button type="button" className="sp-more" onClick={() => setAll(!all)}>{all ? "Näytä vähemmän" : `Näytä kaikki ${n} ottelua`}</button>}
      {injuries.map((i) => {
        const v = inj[String(i.injury)] ?? i.games;
        return (
          <label key={String(i.injury)} className="sp-row">
            <span>{String(i.label ?? i.injury).replace(/ poissa .*$/, "")} poissa</span>
            <input type="range" min={1} max={45} value={v} onChange={(e) => setInj({ ...inj, [String(i.injury)]: Number(e.target.value) })} />
            <b>{v} ott.</b>
          </label>
        );
      })}
      {shifts.map((s) => {
        const v = sh[s.team] ?? s.xg_share;
        return (
          <label key={s.team} className="sp-row">
            <span>{s.team}: taso (osuus maalipaikoista)</span>
            <input type="range" min={-0.15} max={0.15} step={0.005} value={v} onChange={(e) => setSh({ ...sh, [s.team]: Number(e.target.value) })} />
            <b>{v >= 0 ? "+" : "−"}{Math.abs(100 * v).toFixed(1).replace(".", ",")} %-yks.</b>
          </label>
        );
      })}
    </div>
  );
}
