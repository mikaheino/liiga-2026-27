"use client";
// Agentti kohteen kortilla (5.11.2026, korvaa kelluvan "Kysy agentilta" -paneelin):
// ottelukortissa (kaikki ottelut) ja joukkuesivulla. Kohde = (type, key), ks. lib/kortti.ts.
//
// Käyttäjä: "agenttiominaisuus tuntuu päälleliimatulta". Agentti ei asu omassa
// ikkunassaan vaan sen kohteen kortilla, jota katsotaan: kysymys sidotaan otteluun,
// vastaus jää kortille riviksi (lib/kortti.ts) ja on siellä seuraavana aamuna.
// Kun yön ennusteajo muuttaa lukuja, rivi saa lapun VANHA PERUSTA. Rivin
// napautus avaa jäljen samalla korttieleellä kuin muut kortit (SwipeBack).
//
// Valmiit kysymykset (chips) lasketaan datasta kohteen omassa koodissa
// (lib/matchDetail.ts, joukkuesivu) ja näkyvät vain, kun niille on syy --
// agenttia ei pyydetä puhumaan, jos sillä ei ole sanottavaa.
import { useCallback, useEffect, useRef, useState } from "react";
import SwipeBack from "@/components/SwipeBack";
import { modelLabel } from "@/lib/agentTools";
import { openChat } from "@/lib/chatBus";
import { md } from "@/lib/markdown";

type Row = {
  id: string; question: string; answer: string | null; tools: string[]; sql: string[];
  forecastTs: string; askedAt: string; answeredAt: string | null; ms: number | null;
  status: "pending" | "done" | "error"; source: string; subjectType: string; subjectKey: string;
  progress?: { status?: string; partial?: string } | null;
};
export type Subject = { type: "game" | "team" | "player" | "season"; key: string };

// Vastaajan merkit ("qwen", "claude") eivät ole työkaluja (lib/agentTools.ts modelLabel).
const realTools = (t: string[]) => t.filter((x) => x !== "claude" && x !== "qwen");
const TOOL: Record<string, string> = {
  liiga_ennuste: "Ennusteen semanttinen malli", liiga_kausi: "Kauden tilastojen semanttinen malli",
  liiga_skenaario: "Simulaattori (10 000 kautta)", liiga_kokoonpanot: "Illan kokoonpanot liiga.fi:stä",
  liiga_tieto: "Tietopankki (Cortex Search)", system_execute_sql: "SQL-kysely",
};
const when = (iso: string) => new Intl.DateTimeFormat("fi-FI", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Helsinki" }).format(new Date(iso));
const norm = (q: string) => q.trim().replace(/\s+/g, " ").replace(/[?!.]+$/, "").toLowerCase();

function Trace({ r, forecastTs, onClose }: { r: Row; forecastTs: string; onClose: () => void }) {
  useEffect(() => {
    // Capture-vaiheessa ja pysäytettynä: Escape sulkee vain jäljen, ei koko ottelukorttia.
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopImmediatePropagation(); onClose(); } };
    window.addEventListener("keydown", esc, { capture: true });
    return () => window.removeEventListener("keydown", esc, { capture: true });
  }, [onClose]);
  const stale = r.forecastTs !== forecastTs;
  return (
    <div className="mc-wrap ag-trace" role="dialog" aria-modal="true" aria-label="Agentin jälki">
      <SwipeBack onBack={onClose} className="mc">
        <button className="crumb mc-back" onClick={onClose}>◀ Takaisin</button>
        <div className="mc-when">Agentin jälki</div>
        <div className="mc-box"><div className="label">Kysymys</div><b>{r.question}</b></div>
        <div className="mc-box ag-kv">
          <div><span>Agentti</span><b>{r.source === "local" ? `${modelLabel(r.source, r.tools)} (kehitys)` : "Snowflake Intelligence · LIIGA_ENNUSTAJA"}</b></div>
          <div><span>Kysytty</span><b>{when(r.askedAt)}</b></div>
          {r.ms != null && <div><span>Kesto</span><b>{Math.round(r.ms / 1000)} s</b></div>}
          <div><span>Perusta</span><b>ennuste {r.forecastTs || "–"}</b></div>
          {stale && <div><span>Nyt</span><b>ennuste {forecastTs} <i className="ag-stale">Vanha perusta</i></b></div>}
          <div><span>Rivi</span><b className="ag-mono">LIIGA.MODEL.KORTTI_VASTAUS · ({r.subjectType}, {r.subjectKey}) · {r.id.slice(0, 8)}</b></div>
        </div>
        <div className="mc-box">
          <div className="label">Työkalut</div>
          {realTools(r.tools).length ? realTools(r.tools).map((t) => <div key={t} className="ag-tool"><b>{TOOL[t] ?? t}</b><span className="ag-mono">{t}</span></div>)
            : <p>{r.source === "local" ? `${modelLabel(r.source, r.tools)} vastaa ilman työkaluja annetusta tilannekuvasta.` : "Agentti vastasi kortin tiedoista ilman työkalukutsuja."}</p>}
        </div>
        {r.sql.length > 0 && (
          <div className="mc-box">
            <div className="label">SQL</div>
            {r.sql.map((s, i) => <pre key={i} className="ag-sql">{s}</pre>)}
          </div>
        )}
        <div className="mc-hint">Pyyhkäise oikealle palataksesi</div>
      </SwipeBack>
    </div>
  );
}

export default function CardAgent({ subject, chips: offered, placeholder, title = "Agentti" }: { subject: Subject; chips: string[]; placeholder: string; title?: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [forecastTs, setForecastTs] = useState("");
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState("");
  const [trace, setTrace] = useState<Row | null>(null);
  const [all, setAll] = useState(false);
  const [now, setNow] = useState(0);
  const alive = useRef(true);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/kortti?${new URLSearchParams({ type: subject.type, key: subject.key })}`, { cache: "no-store" });
      const j = await r.json();
      if (!alive.current || !r.ok) return;
      setRows(j.rows ?? []); setForecastTs(j.forecastTs ?? "");
    } catch { /* verkko: seuraava kysely yrittää uudelleen */ }
  }, [subject.type, subject.key]);

  useEffect(() => { alive.current = true; load(); return () => { alive.current = false; }; }, [load]);
  // Kesken olevat rivit päivittyvät, kunnes agentti on valmis. Kortin voi sulkea:
  // palvelin vie kutsun loppuun ja rivi on tässä seuraavalla avauksella.
  const pending = rows.some((r) => r.status === "pending");
  useEffect(() => {
    if (!pending) return;
    const t = setTimeout(load, 1500), c = setInterval(() => setNow(Date.now()), 500);
    return () => { clearTimeout(t); clearInterval(c); };
  }, [pending, rows, load]);

  async function ask(q: string) {
    const question = q.trim(); if (question.length < 3) return;
    setNote(""); setDraft("");
    try {
      const r = await fetch("/api/kortti", { method: "POST", headers: { "content-type": "application/json" }, cache: "no-store",
        body: JSON.stringify({ type: subject.type, key: subject.key, question }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) setNote(j.error ?? `Virhe ${r.status}`);
      setNow(Date.now());
      await load();
    } catch (e) { setNote(`Yhteys katkesi: ${(e as Error).message}`); }
  }

  // Valmiit kysymykset piiloon, jos sama on jo kysytty tällä ennusteella.
  const asked = new Set(rows.filter((r) => r.status !== "error" && r.forecastTs === forecastTs).map((r) => norm(r.question)));
  const chips = offered.filter((c) => !asked.has(norm(c)));

  const shown = [...rows].reverse();                       // uusin ylimpänä
  const visible = all ? shown : shown.slice(0, 3);
  const busy = rows.filter((r) => r.status === "pending").length >= 2;

  return (
    <div className="mc-box ag">
      <div className="label">{title}</div>
      {visible.map((r) => {
        const stale = forecastTs && r.forecastTs && r.forecastTs !== forecastTs;
        return (
          <div key={r.id} className={`ag-row ${r.status}`}>
            <div className="ag-meta">
              {stale && <i className="ag-stale" title={`Kysytty ennusteella ${r.forecastTs}, nyt ${forecastTs}`}>Vanha perusta</i>}
              <span>{when(r.askedAt)}</span>
              {r.ms != null && r.status === "done" && <span>· {Math.round(r.ms / 1000)} s</span>}
            </div>
            <div className="ag-q">{r.question}</div>
            {r.status === "pending" && (<>
              {r.progress?.partial && <div className="ag-a streaming" dangerouslySetInnerHTML={{ __html: md(r.progress.partial) }} />}
              <div className="ag-wait"><div className="loading-rink small"><b className="puck" /></div>
                <span>{r.progress?.status ?? "Agentti miettii…"} {Math.max(0, Math.round(((now || Date.parse(r.askedAt)) - Date.parse(r.askedAt)) / 1000))} s</span></div>
              <div className="ag-hint">Voit sulkea kortin – vastaus jää tähän.</div>
            </>)}
            {r.status === "done" && r.answer && (<>
              <div className="ag-a" dangerouslySetInnerHTML={{ __html: md(r.answer) }} />
              <div className="ag-acts">
                <button className="ag-tr" onClick={() => setTrace(r)}>▸ Jälki{realTools(r.tools).length ? ` · ${realTools(r.tools).length} työkalu${realTools(r.tools).length > 1 ? "a" : ""}` : ""}</button>
                {/* Kortista vapaaseen keskusteluun: kysymys ja vastaus keskustelun jatkoksi (6.11.). */}
                <button className="ag-tr" onClick={() => openChat({ seed: [{ role: "user", text: r.question }, { role: "assistant", text: r.answer! }] })}>▸ Jatka keskustelua</button>
              </div>
            </>)}
            {r.status === "error" && <div className="ag-err">{r.answer ?? "Agentti ei vastannut."}</div>}
          </div>
        );
      })}
      {shown.length > 3 && <button className="ag-more" onClick={() => setAll(!all)}>{all ? "Näytä vähemmän" : `Näytä kaikki ${shown.length}`}</button>}
      {chips.map((c) => <button key={c} className="chat-q" disabled={busy} onClick={() => ask(c)}>▸ {c}</button>)}
      <form className="ag-in" onSubmit={(e) => { e.preventDefault(); ask(draft); }}>
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder} maxLength={300} aria-label={placeholder.replace(/…$/, "")} disabled={busy} />
        <button type="submit" className="btn" disabled={busy || draft.trim().length < 3}>Kysy</button>
      </form>
      {note && <div className="ag-err">{note}</div>}
      {trace && <Trace r={trace} forecastTs={forecastTs} onClose={() => setTrace(null)} />}
    </div>
  );
}
