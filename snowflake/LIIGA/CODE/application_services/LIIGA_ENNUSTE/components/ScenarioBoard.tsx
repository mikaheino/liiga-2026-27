"use client";
// Oma skenaario (6.11.2026, docs/claude/skenaario.md V4-V5). Kaksi tapaa koota:
// ottelukortin "Lukitse" (lib/lockBus.ts) ja "Kuvaile omin sanoin" -kenttä, jonka agentti
// muuntaa moottorin skenaarioksi (app/api/skenaario/kuvaile). Moottori laskee koko
// skenaarion (app/api/skenaario, json-tila); luvut ankkuroitu julkaistuun ennusteeseen,
// uskottavuus = lukittujen tulosten mallitodennäköisyyksien tulo. Sirun poisto laskee
// uudelleen ilman agenttia.
import { Fragment, useEffect, useState } from "react";
import { openChat } from "@/lib/chatBus";
import { engineItem, getLocks, itemKey, mergeItems, onLocks, setLocks, type Item } from "@/lib/lockBus";
import { fi } from "@/lib/table";

type Row = { team: string } & Record<string, number | string>;
type Req = { team: string; goal: string; p: number };
type Res = { teams: Row[]; plausibility: number | null; scenario_canonical: Item[]; requirements: Req[]; forecast_date: string; error?: string };
const COLS = [["p_relegation", "Putoaa"], ["p_top10", "Top 10"], ["p_top6", "Top 6"], ["p_title", "Voitto"]] as const;
const pct = (p: number) => (p > 0 && p < 0.005 ? "<1" : fi(100 * p, 0));
const diff = (r: Row, k: string) => Math.abs(Number(r[`${k}_scenario`]) - Number(r[`${k}_now`]));
const moved = (r: Row) => Math.max(...COLS.map(([k]) => diff(r, k)));

function summary(res: Res, rows: Row[]): string {
  return [`Oma skenaario (ennuste ${res.forecast_date}, 10 000 simuloitua kautta): ${res.scenario_canonical.map((c) => c.label).join("; ")}.`,
    res.plausibility != null ? `Mallin mukaan kaikki lukitut tulokset toteutuvat ${fi(100 * res.plausibility, 1)} %:n todennäköisyydellä.` : "",
    ...res.requirements.map((r) => `${r.team}: ${r.goal} ${fi(100 * r.p, 1)} %.`),
    rows.length ? `Muutokset: ${rows.map((r) => `${r.team} ${COLS.filter(([k]) => diff(r, k) >= 0.01)
      .map(([k, l]) => `${l.toLowerCase()} ${pct(Number(r[`${k}_now`]))} -> ${pct(Number(r[`${k}_scenario`]))} %`).join(", ")}`).join("; ")}.` : "",
  ].filter(Boolean).join("\n");
}

function Describe() {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ answer?: string; error?: string } | null>(null);
  const send = async () => {
    if (text.trim().length < 3 || busy) return;
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/skenaario/kuvaile", { method: "POST", headers: { "content-type": "application/json" }, cache: "no-store", body: JSON.stringify({ text }) });
      const j = (await r.json()) as { answer?: string; items?: Item[]; error?: string };
      if (j.items?.length) { mergeItems(j.items); setText(""); }
      setMsg({ answer: j.items?.length ? undefined : j.answer, error: j.error });
    } catch (e) { setMsg({ error: (e as Error).message }); } finally { setBusy(false); }
  };
  return (
    <div className="scb-desc">
      <form onSubmit={(e) => { e.preventDefault(); send(); }} className="ag-in">
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={300} disabled={busy}
          placeholder="Kuvaile skenaario, esim. HPK häviää joulun yli kaikki" aria-label="Kuvaile skenaario omin sanoin" />
        <button type="submit" disabled={busy || text.trim().length < 3}>{busy ? "…" : "Laske"}</button>
      </form>
      {busy && <p className="dim sc-basis">Agentti muuntaa kuvauksen skenaarioksi, moottori laskee…</p>}
      {msg?.answer && <p className="sc-line">{msg.answer}</p>}
      {msg?.error && <div className="ag-err">{msg.error}</div>}
    </div>
  );
}

export default function ScenarioBoard() {
  const [items, setItems] = useState<Item[]>([]);
  const [res, setRes] = useState<Res | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { setItems(getLocks()); return onLocks(setItems); }, []);
  useEffect(() => {
    if (!items.length) { setRes(null); return; }
    let live = true;
    setBusy(true); setErr("");
    fetch("/api/skenaario", { method: "POST", headers: { "content-type": "application/json" }, cache: "no-store",
      body: JSON.stringify({ scenario: items.map(engineItem) }) })
      .then(async (r) => { const j = (await r.json()) as Res; if (!live) return; if (!r.ok || j.error) setErr(j.error ?? `Virhe ${r.status}`); else setRes(j); })
      .catch((e) => live && setErr((e as Error).message)).finally(() => live && setBusy(false));
    return () => { live = false; };
  }, [items]);
  const rows = (res?.teams ?? []).filter((r) => moved(r) >= 0.01).sort((a, b) => moved(b) - moved(a)).slice(0, 8);
  // Sirut moottorin kanonisista riveistä (moottorin label); poisto = loput rivit uudelleen.
  const chips = res?.scenario_canonical ?? items;
  return (
    <section className={`mc-box scb ${busy ? "busy" : ""}`} aria-label="Oma skenaario">
      <div className="label">Oma skenaario</div>
      <Describe />
      {items.length > 0 && (
        <div className="sc-goals">
          {chips.map((c) => (
            <button key={itemKey(c)} type="button" className="sc-chip on" title="Poista"
              onClick={() => setLocks(chips.filter((x) => itemKey(x) !== itemKey(c)))}>{c.label} ✕</button>
          ))}
        </div>
      )}
      {!items.length && <p className="dim sc-basis">Tai lukitse tuloksia ottelukorteista (Panos → Lukitse).</p>}
      {err && <div className="ag-err">{err}</div>}
      {items.length > 0 && res && (<>
        {res.plausibility != null && (
          <p className="sc-line">Mallin mukaan kaikki lukitut tulokset toteutuvat <b>{fi(100 * res.plausibility, res.plausibility < 0.1 ? 1 : 0)} %</b>:n todennäköisyydellä.</p>
        )}
        {res.requirements.map((r) => <p key={r.team + r.goal} className="sc-line">{r.team}: {r.goal} <b>{fi(100 * r.p, r.p < 0.1 ? 1 : 0)} %</b></p>)}
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
        <p className="sc-basis dim">ennuste {Number(res.forecast_date.slice(8, 10))}.{Number(res.forecast_date.slice(5, 7))}. · enintään 10 riviä</p>
        <div className="scb-actions">
          <button type="button" className="ag-tr" onClick={() => openChat({ seed: [
            { role: "user", text: "Mitä tämä skenaario tarkoittaa?" }, { role: "assistant", text: summary(res, rows) }] })}>▸ Kysy agentilta tästä</button>
          <button type="button" className="ag-tr" onClick={() => setLocks([])}>Tyhjennä</button>
        </div>
      </>)}
    </section>
  );
}
