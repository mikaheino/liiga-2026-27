"use client";
// Pelaajat (5.11.2026, käyttäjä: "entä jos haluan kysyä yleisiä kysymyksiä pelaajista?
// Snowflake tietää nämä tiedot"). Pistepörssi ja maalivahdit; pelaajan napautus avaa
// pelaajakortin samalla eleellä kuin ottelu- ja joukkuekortit, ja kortissa on agentti
// sidottuna pelaajaan ('player', '<kausi>:<player_id>'). Luvut tulevat taulukosta ilman
// agenttia -- agentti vastaa siihen, mitä taulukko ei kerro (miksi, entä jos).
import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import CardAgent from "@/components/CardAgent";
import Grid from "@/components/Grid";
import SwipeBack from "@/components/SwipeBack";
import type { Goalie, PastSeason, Skater } from "@/lib/data";
import { fi, logo } from "@/lib/table";
import { STATIC } from "@/lib/target";

type Who = { kind: "skater"; p: Skater } | { kind: "goalie"; p: Goalie };
export type History = { seasons: Record<number, PastSeason[]>; used: Record<number, number> };
const label = (season: number) => `${season - 1}–${String(season).slice(2)}`;

// Aiemmat kaudet + kuluva (6.11.): se mistä esikauden odotus syntyy, datana ilman
// agenttia. Tahtipalkki yhteisellä asteikolla, jotta läpimurto erottuu silmällä.
function Seasons({ p, past, used, season }: { p: Skater; past: PastSeason[]; used?: number; season: number }) {
  const rows = [...past.map((s) => ({ key: `${s.season}${s.team}`, label: label(s.season), team: s.team, g: s.goals, a: s.assists,
    rate: s.teamGames ? (s.goals + s.assists) / s.teamGames : null, now: false })),
    { key: "now", label: label(season), team: p.team, g: p.goals, a: p.assists, rate: p.gp ? p.points / p.gp : null, now: true }];
  const max = Math.max(...rows.map((r) => r.rate ?? 0), p.prePpg ?? 0, 0.01);
  return (
    <div className="mc-box pc-seasons">
      <div className="label">Kaudet</div>
      {rows.map((r) => (
        <div key={r.key} className={`pc-season ${r.now ? "now" : ""}`}>
          <span className="pc-s-l">{r.label}</span>
          <span className="pc-s-t">{r.team}</span>
          <span className="pc-s-p">{r.g}+{r.a}=<b>{r.g + r.a}</b></span>
          <span className="pc-s-bar"><i style={{ width: `${(100 * (r.rate ?? 0)) / max}%` }} />
            {p.prePpg != null && <em style={{ left: `${(100 * p.prePpg) / max}%` }} title="Esikauden odotus" />}</span>
          <span className="pc-s-r">{fi(r.rate, 2)}</span>
        </div>
      ))}
      <p className="pc-note">
        {past.length ? "Tahti = pisteet / ottelu; aiemmilla kausilla joukkueen otteluista (pelaajan omia otteluita ei ole tallessa). " : "Ei aiempia Liiga-kausia. "}
        {p.prePpg != null && <>Pystyviiva = esikauden odotus {fi(p.prePpg, 2)}{used ? `, joka painottaa ${used} viimeistä kautta: tuorein ×1, jokainen vanhempi ×0,8` : ""}.</>}
      </p>
    </div>
  );
}
const sg = (x: number | null, d = 1) => (x == null ? "–" : `${x > 0 ? "+" : ""}${fi(x, d)}`);
const cls = (x: number | null, t = 0.5) => (x == null || Math.abs(x) < t ? "dim" : x > 0 ? "up" : "down");

// Valmiit kysymykset vain datan syystä. "Nimi: kysymys", koska nimiä ei taivuteta.
function chips(w: Who, skaters: Skater[], goalies: Goalie[]): string[] {
  if (w.kind === "skater") {
    const p = w.p, rank = skaters.filter((x) => x.team === p.team).findIndex((x) => x.id === p.id);
    return [
      p.vsPre != null && Math.abs(p.vsPre) >= 5 ? `${p.name}: miksi pisteitä on tullut ${p.vsPre > 0 ? "yli" : "alle"} esikauden odotuksen?` : null,
      rank >= 0 && rank < 2 && p.gp >= 5 ? `${p.name}: mitä joukkueen ennusteelle tapahtuisi kuukauden poissaolosta?` : null,
    ].filter((c): c is string => !!c);
  }
  const g = w.p, teamStarts = goalies.filter((x) => x.team === g.team).reduce((s, x) => s + x.starts, 0);
  return [
    g.savedAvg != null && Math.abs(g.savedAvg) >= 5 ? `${g.name}: kestääkö torjuntaero ${sg(g.savedAvg)} maalia keskivertoon nähden?` : null,
    g.starts >= 6 && teamStarts > 0 && g.starts / teamStarts >= 0.6 ? `${g.name}: mitä joukkueen ennusteelle tapahtuisi kuukauden poissaolosta?` : null,
  ].filter((c): c is string => !!c);
}

function Card({ w, season, skaters, goalies, history, onClose }: { w: Who; season: number; skaters: Skater[]; goalies: Goalie[]; history: History; onClose: () => void }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", esc); };
  }, [onClose]);
  const p = w.p;
  return (
    <div className="mc-wrap" role="dialog" aria-modal="true" aria-label={p.name}>
      <SwipeBack onBack={onClose} className="mc">
        <button className="crumb mc-back" onClick={onClose}>◀ Takaisin</button>
        <div className="mc-when">{w.kind === "skater" ? w.p.position : "Maalivahti"} · kausi {season - 1}–{String(season).slice(2)}</div>
        <div className="pc-head">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo(p.team)} alt="" width={48} height={48} />
          <div><b>{p.name}</b><Link href={`/joukkue/${encodeURIComponent(p.team)}`} className="pc-team">{p.team} ▸</Link></div>
        </div>
        {w.kind === "skater" ? (
          <div className="pc-stats">
            <div><span>{w.p.gp}</span>ottelua</div>
            <div><span>{w.p.points}</span>{w.p.goals}+{w.p.assists} p</div>
            <div><span>{fi(w.p.gp ? w.p.points / w.p.gp : null, 2)}</span>p / ottelu</div>
            <div className={cls(w.p.vsPre)}><span>{sg(w.p.vsPre)}</span>vs. odotus</div>
          </div>
        ) : (
          <div className="pc-stats">
            <div><span>{w.p.gp}</span>ottelua ({w.p.starts} al.)</div>
            <div><span>{fi(w.p.gaa, 2)}</span>päästetyt / ott</div>
            <div className={cls(w.p.savedAvg)}><span>{sg(w.p.savedAvg)}</span>vs. keskiverto</div>
            <div className={cls(w.p.savedPre)}><span>{sg(w.p.savedPre)}</span>vs. oma ennuste</div>
          </div>
        )}
        <p className="pc-note">
          {w.kind === "skater"
            ? (w.p.prePpg != null ? `Esikauden odotus ${fi(w.p.prePpg, 2)} p/ottelu eli ${fi(w.p.prePpg * w.p.gp)} pistettä näissä otteluissa. Ylivoimamaaleja ${w.p.ppGoals}.` : `Esikauden odotusta ei ole. Ylivoimamaaleja ${w.p.ppGoals}.`)
            : `Torjuntaero = päästetyt maalit verrattuna keskivertomaalivahtiin samoista maalipaikoista (xG), vain otteluista joissa hän pelasi yksin (${w.p.solo ?? 0}).`}
        </p>
        {w.kind === "skater" && <Seasons p={w.p} past={history.seasons[p.id] ?? []} used={history.used[p.id]} season={season} />}
        {!STATIC && <CardAgent subject={{ type: "player", key: `${season}:${p.id}` }} chips={chips(w, skaters, goalies)} placeholder={`Kysy pelaajasta ${p.name}…`} />}
        <div className="mc-hint">Pyyhkäise oikealle palataksesi</div>
      </SwipeBack>
    </div>
  );
}

export default function Players({ skaters, goalies, season, history }: { skaters: Skater[]; goalies: Goalie[]; season: number; history: History }) {
  const [open, setOpen] = useState<Who | null>(null);
  const [allSk, setAllSk] = useState(false);
  const [allGk, setAllGk] = useState(false);
  // Suora linkki: #pelaaja=<player_id> avaa kortin (demo, agentin linkit).
  useEffect(() => {
    const m = /^#pelaaja=(\d+)$/.exec(window.location.hash);
    if (!m) return;
    const id = Number(m[1]), sk = skaters.find((p) => p.id === id), gk = goalies.find((g) => g.id === id);
    if (sk) setOpen({ kind: "skater", p: sk }); else if (gk) setOpen({ kind: "goalie", p: gk });
  }, [skaters, goalies]);

  const sk = allSk ? skaters : skaters.slice(0, 30);
  const ranked = goalies.filter((g) => (g.solo ?? 0) >= 3);
  const gk = allGk ? goalies : ranked;
  const tap = (w: Who) => <button className="mc-row-tap" onClick={() => setOpen(w)} aria-label={`${w.p.name}: pelaajakortti`} />;
  const name = (p: { name: string; team: string }) => (
    <span className="pl-name">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={logo(p.team)} alt="" width={16} height={16} />{p.name}</span>
  );
  return (
    <>
      <div className="label">Pistepörssi</div>
      <Grid label="Pistepörssi" cols={[{ h: "#", w: "34px", num: true }, { h: "Pelaaja", w: "minmax(160px, 1.6fr)", wsm: "minmax(0, 1fr)" },
        { h: "Joukkue", w: "minmax(80px, .8fr)", sm: true }, { h: "O", w: "40px", num: true }, { h: "M", w: "40px", num: true, sm: true },
        { h: "S", w: "40px", num: true, sm: true }, { h: "P", w: "44px", num: true }, { h: "vs. odotus", w: "84px", wsm: "56px", num: true }]}
        rows={sk.map((p, i) => ({
          key: String(p.id), cls: "tap",
          cells: [<span key="r" className="dim">{tap({ kind: "skater", p })}{i + 1}</span>, <span key="n">{name(p)}</span>, <span key="t" className="dim">{p.team}</span>,
            p.gp, p.goals, p.assists, <b key="p">{p.points}</b>, <span key="v" className={cls(p.vsPre)}>{sg(p.vsPre)}</span>],
        }))} />
      {skaters.length > 30 && <button className="ag-more pl-more" onClick={() => setAllSk(!allSk)}>{allSk ? "Näytä 30 parasta" : `Näytä kaikki ${skaters.length}`}</button>}

      <div className="label sub">Maalivahdit</div>
      <Grid label="Maalivahdit" cols={[{ h: "Maalivahti", w: "minmax(160px, 1.6fr)", wsm: "minmax(0, 1fr)" }, { h: "O", w: "40px", num: true },
        { h: "Päästetyt / O", w: "96px", wsm: "52px", num: true }, { h: "vs. keskiverto", w: "104px", wsm: "60px", num: true },
        { h: "vs. oma ennuste", w: "112px", num: true, sm: true }]}
        rows={gk.map((g) => ({
          key: String(g.id), cls: "tap",
          cells: [<span key="n">{tap({ kind: "goalie", p: g })}{name(g)}</span>, g.gp, <span key="a">{fi(g.gaa, 2)}</span>,
            <span key="s" className={cls(g.savedAvg)}>{sg(g.savedAvg)}</span>, <span key="o" className={cls(g.savedPre)}>{sg(g.savedPre)}</span>],
        }))} />
      {goalies.length > ranked.length && <button className="ag-more pl-more" onClick={() => setAllGk(!allGk)}>{allGk ? "Vain vähintään 3 yksin pelattua" : `Näytä kaikki ${goalies.length}`}</button>}

      {open && createPortal(<Card w={open} season={season} skaters={skaters} goalies={goalies} history={history} onClose={() => setOpen(null)} />, document.body)}
    </>
  );
}
