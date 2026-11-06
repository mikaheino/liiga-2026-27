"use client";
// Skenaariopaneeli joukkuesivulla (6.11.2026). "Mitä vaaditaan" ja "entä jos putki"
// samasta moottorista kuin agentin liiga_skenaario (app/api/skenaario). Luvut ovat
// deterministisiä simulaatiosta -- agentti ei laske niitä, mutta "Kysy agentilta
// tästä" vie tuloksen keskusteluun agentin syötteeksi (lib/chatBus.ts), jolloin
// jatkokysymykset ("entä jos Pelicans häviää") jatkuvat samoista luvuista.
// Pagesissa (agentiton) luvut luetaan käännöksessä esilasketusta tiedostosta
// (scripts/deploy/scenario_static.py): sama moottori ja sama muoto, ei agenttinappia.
import { useCallback, useEffect, useState } from "react";
import { openChat } from "@/lib/chatBus";
import { BASE, STATIC } from "@/lib/target";
import { fi } from "@/lib/table";

type Rival = { team: string; expected: number; when_goal: number; p_goal_if_below: number };
type Req = { goal: string; limit: number; p: number; banked: number; played?: number; remaining: number; expected_final: number;
  need: Record<string, number | null>; line_mean: number; line_p05: number; line_p95: number; rival_rows: Rival[] };
type Res = { team: string; goal: string; forecastDate?: string; base?: Req; error?: string;
  streak: { games: number; req?: Req; locked?: { date: string; game: string }[]; movers?: { team: string; d: number }[] } | null };

export const GOAL_LABEL: Record<string, string> = {
  avoid_relegation: "Säilyy sarjassa", top10: "Pudotuspeleihin", top6: "Kuuden joukkoon", win: "Runkosarjan voitto",
};
const pct = (p: number) => (p > 0 && p < 0.001 ? "<0,1 %" : `${fi(100 * p, p < 0.1 ? 1 : 0)} %`);
const sg = (x: number) => `${x > 0 ? "+" : ""}${fi(x)}`;

// Tiivistelmä agentille: samat luvut tekstinä, jotta keskustelu jatkaa niistä.
function summary(team: string, r: Res): string {
  const b = r.base!;
  const pace = b.remaining ? (b.line_mean - b.banked) / b.remaining : 0;
  const lines = [
    `Simulaatio (${r.forecastDate}, 10 000 kautta): ${team}, tavoite ${GOAL_LABEL[r.goal].toLowerCase()} (sija ${b.limit}. tai parempi) -- todennäköisyys ${pct(b.p)}.`,
    `Pisteet nyt ${fi(b.banked, 0)}, otteluita jäljellä ${b.remaining}. Sijan ${b.limit} raja päättyy keskimäärin ${fi(b.line_mean)} pisteeseen (5-95 %: ${fi(b.line_p05, 0)}-${fi(b.line_p95, 0)}), eli rajaan tarvitaan ${fi(pace, 2)} p/ottelu; malli odottaa ${fi(b.remaining ? (b.expected_final - b.banked) / b.remaining : 0, 2)}.`,
    b.rival_rows.length ? `Kausissa joissa tavoite toteutui, kilpakumppanit jäivät odotuksestaan: ${b.rival_rows.map((x) => `${x.team} ${sg(x.when_goal - x.expected)} p`).join(", ")}.` : "",
    r.streak?.req ? `Jos ${team} voittaa seuraavat ${r.streak.games} ottelua: todennäköisyys ${pct(b.p)} -> ${pct(r.streak.req.p)}. Tappiot osuvat: ${(r.streak.movers ?? []).map((m) => `${m.team} ${sg(m.d)} p`).join(", ")}.` : "",
  ];
  return lines.filter(Boolean).join("\n\n");
}

export default function Scenario({ team, defaultGoal }: { team: string; defaultGoal: string }) {
  const [goal, setGoal] = useState(defaultGoal);
  const [streak, setStreak] = useState(0);
  const [res, setRes] = useState<Res | null>(null);
  const [busy, setBusy] = useState(false);
  const [gone, setGone] = useState(false);              // 501: ympäristössä ei vielä paneelia
  const [err, setErr] = useState("");

  const run = useCallback(async (g: string, s: number) => {
    setBusy(true); setErr("");
    try {
      if (STATIC) {
        const r = await fetch(`${BASE}/skenaario/${encodeURIComponent(team)}.json`);
        if (!r.ok) { setGone(true); return; }
        const j = (await r.json()) as { panels: Record<string, Res> };
        const p = j.panels[`${g}:${s}`];
        if (p) setRes(p); else setGone(true);
        return;
      }
      const r = await fetch("/api/skenaario", { method: "POST", headers: { "content-type": "application/json" }, cache: "no-store",
        body: JSON.stringify({ team, goal: g, streak: s }) });
      if (r.status === 501) { setGone(true); return; }
      const j = await r.json();
      if (!r.ok || j.error) setErr(j.error ?? `Virhe ${r.status}`); else setRes(j);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }, [team]);
  useEffect(() => { run(goal, streak); }, [run, goal, streak]);

  if (gone) return null;
  const b = res?.base;
  const pace = b && b.remaining ? (b.line_mean - b.banked) / b.remaining : null;
  const exp = b && b.remaining ? (b.expected_final - b.banked) / b.remaining : null;
  const need = b ? (["0.5", "0.8", "0.95"] as const).map((k) => [k, b.need[k]] as const) : [];
  return (
    <div className={`mc-box sc ${busy ? "busy" : ""}`}>
      <div className="label">Mitä vaaditaan</div>
      <div className="sc-goals" role="group" aria-label="Tavoite">
        {Object.entries(GOAL_LABEL).map(([k, l]) => (
          <button key={k} type="button" className={`sc-chip ${goal === k ? "on" : ""}`} aria-pressed={goal === k} onClick={() => setGoal(k)}>{l}</button>
        ))}
      </div>
      {err && <div className="ag-err">{err}</div>}
      {b && (<>
        <div className="sc-p">
          <b>{pct(b.p)}</b>
          {res?.streak?.req && <><span className="sc-arrow">→</span><b className="sc-new">{pct(res.streak.req.p)}</b></>}
          <span>{res?.streak?.req ? `jos ${team} voittaa ${res.streak.games} seuraavaa` : "todennäköisyys nyt"}</span>
        </div>
        <p className="sc-line">
          Sijan {b.limit}. raja päättyy keskimäärin <b>{fi(b.line_mean, 0)} p</b> ({fi(b.line_p05, 0)}–{fi(b.line_p95, 0)}).
          {" "}{team}: {fi(b.banked, 0)} p, {b.remaining} ottelua jäljellä{pace != null && exp != null && <> → rajaan <b className={pace > exp + 0.15 ? "down" : "up"}>{fi(pace, 2)} p/ottelu</b>, malli odottaa {fi(exp, 2)}</>}.
        </p>
        <div className="sc-need">
          {need.map(([k, v]) => <span key={k}>{Math.round(Number(k) * 100)} % varmuus <b>{v == null ? "ei yhdessäkään simulaatiossa" : `${fi(v, 0)} p`}</b></span>)}
        </div>
        {b.rival_rows.length > 0 && (
          <div className="sc-rivals">
            <div className="label sub">Kun tavoite toteutui, kilpakumppanit jäivät</div>
            {b.rival_rows.map((x) => (
              <div key={x.team} className="sc-rival">
                <span>{x.team}</span>
                <span className="dim">{fi(x.expected, 0)} → {fi(x.when_goal, 0)} p</span>
                <b className={x.when_goal < x.expected ? "down" : "up"}>{sg(x.when_goal - x.expected)}</b>
                <span className="dim" title={`${team}: todennäköisyys, jos ${x.team} jää odotuksensa mediaanin alle`}>jos heikkenee: {pct(x.p_goal_if_below)}</span>
              </div>
            ))}
          </div>
        )}
        <div className="sc-streak">
          <span className="dim">Entä jos {team} voittaa seuraavat</span>
          {[3, 5, 10].map((n) => (
            <button key={n} type="button" className={`sc-chip ${streak === n ? "on" : ""}`} aria-pressed={streak === n} onClick={() => setStreak(streak === n ? 0 : n)}>{n}</button>
          ))}
        </div>
        {res?.streak?.movers?.length ? (
          <p className="sc-line">Tappiot osuvat muihin: {res.streak.movers.map((m, i) => <span key={m.team}>{i ? ", " : ""}{m.team} <b className="down">{sg(m.d)} p</b></span>)}.</p>
        ) : null}
        {res?.forecastDate && <p className="sc-basis dim">ennuste {Number(res.forecastDate.slice(8, 10))}.{Number(res.forecastDate.slice(5, 7))}.</p>}
        {!STATIC && <button type="button" className="ag-tr" onClick={() => openChat({ seed: [
          { role: "user", text: `Mitä vaatisi, että ${team} ${goal === "avoid_relegation" ? "säilyy sarjassa" : goal === "top10" ? "pääsee pudotuspeleihin" : goal === "top6" ? "nousee kuuden joukkoon" : "voittaa runkosarjan"}?` },
          { role: "assistant", text: summary(team, res!) }] })}>▸ Kysy agentilta tästä</button>}
      </>)}
    </div>
  );
}
