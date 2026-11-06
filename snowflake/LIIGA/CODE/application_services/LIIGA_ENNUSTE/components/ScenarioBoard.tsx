"use client";
// Kasattu skenaario (6.11.2026, docs/claude/skenaario.md V4): ottelukortista lukitut
// tulokset (lib/lockBus.ts) lasketaan moottorilla yhdeksi skenaarioksi. Näkyy vain
// kun lukituksia on, kierroskortin alla. Luvut ankkuroitu julkaistuun ennusteeseen;
// uskottavuus = lukittujen tulosten mallitodennäköisyyksien tulo. Siru pois -> uusi
// laskenta ilman agenttia. "Kysy agentilta tästä" vie samat luvut keskusteluun.
import { Fragment, useEffect, useState } from "react";
import { openChat } from "@/lib/chatBus";
import { getLocks, onLocks, setLocks, type Lock } from "@/lib/lockBus";
import { fi } from "@/lib/table";

type Row = { team: string; rank_now: number; rank_scenario: number; points_now: number; points_scenario: number } & Record<string, number | string>;
type Res = { teams: Row[]; plausibility: number | null; scenario_canonical: { label: string }[]; forecast_date: string; error?: string };
const COLS = [["p_relegation", "Putoaa"], ["p_top10", "Top 10"], ["p_top6", "Top 6"], ["p_title", "Voitto"]] as const;
const pct = (p: number) => (p > 0 && p < 0.005 ? "<1" : fi(100 * p, 0));

function moved(r: Row) {
  return Math.max(...COLS.map(([k]) => Math.abs(Number(r[`${k}_scenario`]) - Number(r[`${k}_now`]))));
}

function summary(res: Res, rows: Row[]): string {
  return [`Lukitut tulokset (ennuste ${res.forecast_date}, 10 000 simuloitua kautta): ${res.scenario_canonical.map((c) => c.label).join("; ")}.`,
    res.plausibility != null ? `Mallin mukaan kaikki lukitut tulokset toteutuvat ${fi(100 * res.plausibility, 1)} %:n todennäköisyydellä.` : "",
    `Muutokset: ${rows.map((r) => `${r.team} ${COLS.filter(([k]) => Math.abs(Number(r[`${k}_scenario`]) - Number(r[`${k}_now`])) >= 0.01)
      .map(([k, l]) => `${l.toLowerCase()} ${pct(Number(r[`${k}_now`]))} -> ${pct(Number(r[`${k}_scenario`]))} %`).join(", ")}`).join("; ")}.`,
  ].filter(Boolean).join("\n");
}

export default function ScenarioBoard() {
  const [locks, setL] = useState<Lock[]>([]);
  const [res, setRes] = useState<Res | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { setL(getLocks()); return onLocks(setL); }, []);
  useEffect(() => {
    if (!locks.length) { setRes(null); return; }
    let live = true;
    setBusy(true); setErr("");
    fetch("/api/skenaario", { method: "POST", headers: { "content-type": "application/json" }, cache: "no-store",
      body: JSON.stringify({ scenario: locks.map(({ game_id, result }) => ({ game_id, result })) }) })
      .then(async (r) => { const j = (await r.json()) as Res; if (!live) return; if (!r.ok || j.error) setErr(j.error ?? `Virhe ${r.status}`); else setRes(j); })
      .catch((e) => live && setErr((e as Error).message)).finally(() => live && setBusy(false));
    return () => { live = false; };
  }, [locks]);
  if (!locks.length) return null;
  const rows = (res?.teams ?? []).filter((r) => moved(r) >= 0.01).sort((a, b) => moved(b) - moved(a)).slice(0, 8);
  return (
    <section className={`mc-box scb ${busy ? "busy" : ""}`} aria-label="Lukittu skenaario">
      <div className="label">Oma skenaario</div>
      <div className="sc-goals">
        {locks.map((l, i) => (
          <button key={l.game_id} type="button" className="sc-chip on" title="Poista lukitus"
            onClick={() => setLocks(locks.filter((x) => x.game_id !== l.game_id))}>
            {res?.scenario_canonical[i]?.label ?? l.label} ✕
          </button>
        ))}
      </div>
      {err && <div className="ag-err">{err}</div>}
      {res && (<>
        {res.plausibility != null && (
          <p className="sc-line">Mallin mukaan kaikki lukitut tulokset toteutuvat <b>{fi(100 * res.plausibility, res.plausibility < 0.1 ? 1 : 0)} %</b>:n todennäköisyydellä.</p>
        )}
        {rows.length ? (
          <div className="scb-table">
            <span className="h">Joukkue</span>{COLS.map(([, l]) => <span key={l} className="h">{l} %</span>)}
            {rows.map((r) => (<Fragment key={r.team}>
              <span>{r.team}</span>
              {COLS.map(([k]) => {
                const a = Number(r[`${k}_now`]), b = Number(r[`${k}_scenario`]);
                const good = k === "p_relegation" ? b < a : b > a;
                return <span key={k} className={Math.abs(b - a) >= 0.01 ? (good ? "up" : "down") : "dim"}>{pct(a)}→{pct(b)}</span>;
              })}
            </Fragment>))}
          </div>
        ) : <p className="dim">Luvut eivät liiku yli prosenttiyksikköä.</p>}
        <p className="sc-basis dim">ennuste {Number(res.forecast_date.slice(8, 10))}.{Number(res.forecast_date.slice(5, 7))}. · lukitse lisää ottelukortista (enintään 10)</p>
        <div className="scb-actions">
          <button type="button" className="ag-tr" onClick={() => openChat({ seed: [
            { role: "user", text: "Mitä tämä lukitsemani skenaario tarkoittaa?" }, { role: "assistant", text: summary(res, rows) }] })}>▸ Kysy agentilta tästä</button>
          <button type="button" className="ag-tr" onClick={() => setLocks([])}>Tyhjennä</button>
        </div>
      </>)}
    </section>
  );
}
