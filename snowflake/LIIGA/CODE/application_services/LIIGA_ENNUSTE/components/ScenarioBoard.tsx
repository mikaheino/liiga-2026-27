"use client";
// Oma skenaario (6.11.2026, docs/claude/skenaario.md V4-V5). Hakukoneen ilme 7.11.2026
// (käyttäjä: "Googlemaiseksi liittymäksi"): keskitetty hakukenttä, kaksi nappia (Laske /
// Kokeile esimerkkiä), lukitut tulokset suodatinsiruina ja vaikutukset hakutuloksina.
// Logiikka ennallaan. Kaksi tapaa koota:
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

// Esimerkit "Kokeile esimerkkiä" -napille (vastine Googlen "Kokeilen onneani" -napille).
const EXAMPLES = ["HPK häviää joulun yli kaikki", "Tappara voittaa seuraavat viisi ottelua", "KooKoo voittaa kaikki kotiottelunsa"];
const LABEL: Record<string, string> = Object.fromEntries(COLS);
const href = (team: string) => `/joukkue/${encodeURIComponent(team)}`;

function Search() {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [ex, setEx] = useState(0);
  const [msg, setMsg] = useState<{ answer?: string; error?: string } | null>(null);
  const send = async (q: string) => {
    if (q.trim().length < 3 || busy) return;
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/skenaario/kuvaile", { method: "POST", headers: { "content-type": "application/json" }, cache: "no-store", body: JSON.stringify({ text: q }) });
      const j = (await r.json()) as { answer?: string; items?: Item[]; error?: string };
      if (j.items?.length) { mergeItems(j.items); setText(""); }
      setMsg({ answer: j.items?.length ? undefined : j.answer, error: j.error });
    } catch (e) { setMsg({ error: (e as Error).message }); } finally { setBusy(false); }
  };
  const tryExample = () => { const q = EXAMPLES[ex % EXAMPLES.length]; setEx(ex + 1); setText(q); send(q); };
  return (
    <>
      <form onSubmit={(e) => { e.preventDefault(); send(text); }} className={`gs-box ${busy ? "busy" : ""}`} role="search">
        <svg viewBox="0 0 24 24" aria-hidden className="gs-ico"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 5 5" /></svg>
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={300} disabled={busy} enterKeyHint="search"
          placeholder="Kuvaile skenaario omin sanoin" aria-label="Kuvaile skenaario omin sanoin" />
        {text && !busy && <button type="button" className="gs-x" aria-label="Tyhjennä kenttä" onClick={() => setText("")}>✕</button>}
      </form>
      <div className="gs-btns">
        <button type="button" onClick={() => send(text)} disabled={busy || text.trim().length < 3}>Laske skenaario</button>
        <button type="button" onClick={tryExample} disabled={busy}>Kokeile esimerkkiä</button>
      </div>
      {busy && <p className="gs-status">Agentti muuntaa kuvauksen skenaarioksi, moottori laskee…</p>}
      {msg?.answer && <p className="gs-status">{msg.answer}</p>}
      {msg?.error && <div className="ag-err gs-status">{msg.error}</div>}
    </>
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
    <section className={`gs ${busy ? "busy" : ""} ${items.length ? "has-res" : ""}`} aria-label="Oma skenaario">
      <h2 className="gs-logo">Entä jos<span>?</span></h2>
      <Search />
      {items.length > 0 && (
        <div className="gs-chips" aria-label="Lukitut tulokset">
          {chips.map((c) => (
            <button key={itemKey(c)} type="button" className="gs-chip" title="Poista"
              onClick={() => setLocks(chips.filter((x) => itemKey(x) !== itemKey(c)))}>{c.label}<span aria-hidden>✕</span></button>
          ))}
        </div>
      )}
      {!items.length && <p className="gs-hint">Tai lukitse tuloksia ottelukorteista (Panos → Lukitse).</p>}
      {err && <div className="ag-err gs-status">{err}</div>}
      {items.length > 0 && res && (
        <div className="gs-results">
          <p className="gs-stats">
            {res.plausibility != null && <>Kaikki lukitut tulokset toteutuvat mallin mukaan <b>{fi(100 * res.plausibility, res.plausibility < 0.1 ? 1 : 0)} %</b>:n todennäköisyydellä · </>}
            ennuste {Number(res.forecast_date.slice(8, 10))}.{Number(res.forecast_date.slice(5, 7))}. · 10 000 simuloitua kautta
          </p>
          {res.requirements.map((r) => <p key={r.team + r.goal} className="gs-req">{r.team}: {r.goal} <b>{fi(100 * r.p, r.p < 0.1 ? 1 : 0)} %</b></p>)}
          {rows.length ? rows.map((r) => {
            // Otsikkona joukkueen suurin muutos, katkelmana muut liikkuneet luvut.
            const ks = COLS.map(([k]) => k).filter((k) => diff(r, k) >= 0.01).sort((a, b) => diff(r, b) - diff(r, a));
            const part = (k: string) => {
              const a = Number(r[`${k}_now`]), b = Number(r[`${k}_scenario`]);
              const good = k === "p_relegation" ? b < a : b > a;
              return <span key={k}>{LABEL[k]} {pct(a)} → <b className={good ? "up" : "down"}>{pct(b)} %</b></span>;
            };
            return (
              <article key={r.team} className="gs-r">
                <div className="gs-crumb">liiga-ennuste › joukkue › {r.team}</div>
                <a className="gs-t" href={href(r.team)}>{r.team}: {part(ks[0])}</a>
                {ks.length > 1 && <p className="gs-snip">{ks.slice(1).map((k, i) => <Fragment key={k}>{i ? " · " : ""}{part(k)}</Fragment>)}</p>}
              </article>
            );
          }) : <p className="gs-status">Luvut eivät liiku yli prosenttiyksikköä.</p>}
          <div className="gs-actions">
            <button type="button" className="ag-tr" onClick={() => openChat({ seed: [
              { role: "user", text: "Mitä tämä skenaario tarkoittaa?" }, { role: "assistant", text: summary(res, rows) }] })}>▸ Kysy agentilta tästä</button>
            <button type="button" className="ag-tr" onClick={() => setLocks([])}>Tyhjennä</button>
          </div>
        </div>
      )}
    </section>
  );
}
