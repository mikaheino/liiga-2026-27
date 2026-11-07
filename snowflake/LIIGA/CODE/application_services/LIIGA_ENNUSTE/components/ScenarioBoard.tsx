"use client";
// Oma skenaario (6.11.2026, docs/claude/skenaario.md V4-V5). Hakukoneen ilme 7.11.2026
// (käyttäjä: "Googlemaiseksi liittymäksi" ja "AI rakentaa livenä skenaarion, mutta hyödyntää
// SQL dataa ja koneoppimismalleja. Tiputa valmiit skenaariot pois"): keskitetty hakukenttä ja
// yksi nappi; tekoälyn vaiheet näkyvät livenä (app/api/skenaario/rakenna), valmiit rivit
// korvaavat edellisen skenaarion siruina (uusi haku = uusi skenaario) ja vaikutukset näytetään hakutuloksina. Rivejä voi lukita myös
// ottelukortin "Lukitse"-napista (lib/lockBus.ts). Moottori laskee koko skenaarion
// (app/api/skenaario, json-tila); luvut ankkuroitu julkaistuun ennusteeseen, uskottavuus =
// lukittujen tulosten mallitodennäköisyyksien tulo. Sirun poisto laskee uudelleen ilman agenttia.
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { openChat } from "@/lib/chatBus";
import { engineItem, itemKey, onLocks, setLocks, type Item } from "@/lib/lockBus";
import { fi } from "@/lib/table";
import ScenarioChart, { type ChartPick, type Charts, type LockedGame, fallbackPick } from "@/components/ScenarioChart";

type Row = { team: string } & Record<string, number | string>;
type Req = { team: string; goal: string; p: number };
// charts/locked_games: moottorin kuvaajadata (7.11.2026); chart: agentin valinta tallennetussa haussa.
type Res = { teams: Row[]; plausibility: number | null; scenario_canonical: Item[]; requirements: Req[]; forecast_date: string; error?: string;
  charts?: Charts | null; locked_games?: LockedGame[]; chart?: ChartPick };
// "Jatkoon" = pudotuspeleihin (sijat 1–10); käyttäjän kieli (7.11.2026), ennen "Top 10".
const COLS = [["p_relegation", "Putoaa"], ["p_top10", "Jatkoon"], ["p_top6", "Top 6"], ["p_title", "Voitto"]] as const;
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

const LABEL: Record<string, string> = Object.fromEntries(COLS);
const href = (team: string) => `/joukkue/${encodeURIComponent(team)}`;

// Live-rakennus (7.11.2026): /api/skenaario/rakenna striimaa agentin vaiheet (datahaku SQL:llä,
// simulointi mallilla), yhteenvedon ja ajetut SQL-lauseet; valmiit rivit lukitaan siruiksi.
// items = montako riviä valmistui; 0 + teksti = agentti kysyi tarkennusta (vastauskenttä näkyviin).
// saved = avattu tallennetuista hauista (stale = haun jälkeen ennuste on päivittynyt).
// base = pohjaskenaario, jonka päälle haku rakennettiin (tarkennus käyttää samaa pohjaa).
type Live = { q: string; steps: string[]; text: string; sql: string[]; tools: string[]; done: boolean; error?: string; items?: number; prompt?: string;
  base?: { item: unknown; label: string }[];
  saved?: { at: string; stale: boolean }; chart?: ChartPick; news?: string[] };
type Msg = { t: "step" | "text" | "error"; text: string } | { t: "sql"; sql: string[] }
  | { t: "done"; id?: string; answer: string; items: Item[]; result?: Res | null; chart?: ChartPick; news?: string[]; tools: string[]; error?: string };
// Tallennettu haku (lib/skenaarioHaut.ts, /api/skenaario/haut).
type Haku = { id: string; question: string; followup: string | null; answer: string; items: Item[]; result: Res | null; tools: string[];
  sqlCount: number; forecastTs: string; askedAt: string; status: "done" | "clarify" | "error" };
const when = (ts: string) => new Intl.DateTimeFormat("fi-FI", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Helsinki" }).format(new Date(ts));
const keyOf = (l: Item[]) => l.map(itemKey).join("|");

async function build(body: { text: string; prompt: string; followup?: string; base?: { item: unknown; label: string }[] }, on: (m: Msg) => void) {
  const r = await fetch("/api/skenaario/rakenna", { method: "POST", headers: { "content-type": "application/json" }, cache: "no-store", body: JSON.stringify(body) });
  if (!r.ok || !r.body) { const j = await r.json().catch(() => ({})) as { error?: string }; throw new Error(j.error ?? `Virhe ${r.status}`); }
  const rd = r.body.getReader(), dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await rd.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    for (let i; (i = buf.indexOf("\n")) >= 0;) {
      const line = buf.slice(0, i); buf = buf.slice(i + 1);
      try { on(JSON.parse(line) as Msg); } catch { /* osittainen rivi */ }
    }
  }
}

export default function ScenarioBoard() {
  const [items, setItems] = useState<Item[]>([]);
  const [res, setRes] = useState<Res | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [live, setLive] = useState<Live | null>(null);
  const building = !!live && !live.done;
  // Etusivu avautuu aina tyhjänä kuin hakukone (7.11.2026, käyttäjä: "Vieläkin näkyy historiaa"):
  // edellinen skenaario ei palaa sessiosta; vanhat haut avataan Aiemmat skenaariot -listasta.
  useEffect(() => { setLocks([]); setItems([]); return onLocks(setItems); }, []);
  const [reply, setReply] = useState("");
  const [allChips, setAllChips] = useState(false);
  // Moottorin luvut tulevat valmiina haun mukana (tallentuvat sen kanssa): effect ei laske uudelleen.
  const preset = useRef<{ key: string; res: Res } | null>(null);
  const [haut, setHaut] = useState<Haku[]>([]);
  const [stamp, setStamp] = useState("");
  const loadHaut = useCallback(() => {
    fetch("/api/skenaario/haut", { cache: "no-store" }).then((r) => r.json())
      .then((j: { haut?: Haku[]; forecastTs?: string }) => { setHaut(j.haut ?? []); setStamp(j.forecastTs ?? ""); }).catch(() => {});
  }, []);
  useEffect(loadHaut, [loadHaut]);
  // Tallennetun haun avaus: teksti haun hetkeltä; luvut tallennetuista, jos ennuste on sama,
  // muuten moottori laskee ne nykyisellä ennusteella (VANHA PERUSTA -merkintä).
  const open = (h: Haku) => {
    const stale = !!h.forecastTs && !!stamp && h.forecastTs !== stamp;
    setAllChips(false); setReply("");
    setLive({ q: h.question, steps: [], text: h.answer, sql: [], tools: h.tools, done: true, items: h.items.length,
      error: h.status === "error" ? h.answer : undefined, saved: { at: h.askedAt, stale }, chart: h.result?.chart, news: (h.result as { news?: string[] } | null)?.news ?? [] });
    preset.current = !stale && h.result && h.items.length ? { key: keyOf(h.items), res: h.result } : null;
    setLocks(h.items);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const run = async (follow?: string) => {
    // Tarkennus (7.11.2026): agentti kysyi jotain, ja vastaus lähtee yhdessä alkuperäisen
    // kuvauksen ja kysymyksen kanssa -- kertakutsu ei muista edellistä kierrosta.
    const q = follow && live ? live.q : text.trim();
    if (q.length < 3 || building || (follow != null && follow.trim().length < 1)) return;
    const prompt = follow && live ? `${live.prompt ?? live.q}\n\nAgentti kysyi: ${live.text}\nKäyttäjä vastasi: ${follow.trim()}` : q;
    preset.current = null;
    setReply("");
    // Uusi haku = uusi skenaario (7.11.2026, käyttäjä: "kun kysyn jotain niin se on konkreettista"):
    // vanhat sirut pois heti, jotta tekoälyn teksti ja alla olevat luvut koskevat samaa skenaariota.
    // Nykyinen skenaario kulkee aina agentille tiedoksi (7.11.2026: "skenaario skenaarion päälle" ja
    // "ei mitään nappeja, vaan tietoisuus"): agentti päättää, jatkaako se sitä vai aloittaako uuden,
    // ja sen palauttama skenaario korvaa sirut. Tarkennuskierros käyttää samaa pohjaa.
    const base = follow && live ? live.base : items.length ? items.map((i) => ({ item: engineItem(i), label: i.label })) : undefined;
    setAllChips(false);
    setLive({ q, prompt, base, steps: [], text: "", sql: [], tools: [], done: false });
    const up = (f: (l: Live) => Live) => setLive((l) => (l ? f(l) : l));
    try {
      await build({ text: q, prompt, ...(follow ? { followup: follow.trim() } : {}), ...(base ? { base } : {}) }, (m) => {
        if (m.t === "step") up((l) => ({ ...l, steps: [...l.steps, m.text] }));
        else if (m.t === "text") up((l) => ({ ...l, text: m.text }));
        else if (m.t === "sql") up((l) => ({ ...l, sql: m.sql }));
        else if (m.t === "error") up((l) => ({ ...l, done: true, error: m.text }));
        else if (m.t === "done") {
          up((l) => ({ ...l, done: true, text: m.answer || l.text, tools: m.tools ?? [], error: m.error, items: m.items?.length ?? 0, chart: m.chart, news: m.news ?? [] }));
          if (m.items?.length) {
            if (m.result) preset.current = { key: keyOf(m.items), res: m.result };
            setLocks(m.items); setText("");
          }
          loadHaut();
        }
      });
      up((l) => ({ ...l, done: true }));
    } catch (e) { up((l) => ({ ...l, done: true, error: (e as Error).message })); }
  };
  useEffect(() => {
    if (!items.length) { setRes(null); return; }
    if (preset.current?.key === keyOf(items)) { setRes(preset.current.res); setErr(""); return; }
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
    <section className={`gs ${busy ? "busy" : ""} ${items.length || live ? "has-res" : ""}`} aria-label="Oma skenaario">
      <h2 className="gs-logo">Entä jos<span>?</span></h2>
      <form onSubmit={(e) => { e.preventDefault(); run(); }} className={`gs-box ${building ? "busy" : ""}`} role="search">
        {/* Ei erillisiä nappeja: Enter tai suurennuslasi lähettää. */}
        <button type="submit" className="gs-go" aria-label="Rakenna skenaario" disabled={building || text.trim().length < 3}>
          <svg viewBox="0 0 24 24" aria-hidden className="gs-ico"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 5 5" /></svg>
        </button>
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={300} disabled={building} enterKeyHint="search"
          placeholder={items.length ? "Jatka skenaariota tai kysy uutta" : "Kuvaile skenaario omin sanoin"} aria-label="Kuvaile skenaario omin sanoin" />
        {text && !building && <button type="button" className="gs-x" aria-label="Tyhjennä kenttä" onClick={() => setText("")}>✕</button>}
      </form>
      {live && (
        <div className={`gs-ai ${live.done ? "done" : ""}`} aria-live="polite">
          <div className="gs-ai-h">{live.saved ? <>Tallennettu haku {when(live.saved.at)}</> : "Tekoäly rakentaa skenaariota"} <span>“{live.q}”</span></div>
          {live.saved?.stale && <p className="gs-stale">Vanha perusta: ennuste on päivittynyt haun jälkeen. Teksti on haun hetkeltä, luvut lasketaan nykyisellä ennusteella.</p>}
          {/* Vastaus heti hakukentän alle (7.11.2026, käyttäjä: "vastaus alle, ei skrollausta"):
              valmiina vaiheet ja lähteet tiivistyvät yhdeksi avattavaksi riviksi. */}
          {!live.done || busy ? (
            <ol className="gs-steps">
              {live.steps.map((st, i) => {
                const now = !live.done && i === live.steps.length - 1;
                return <li key={i} className={now ? "run" : "ok"}><i aria-hidden>{now ? "" : "✓"}</i>{st}</li>;
              })}
              {live.done && busy && (
                <li className="run"><i aria-hidden />Lasketaan vaikutukset nykyisellä ennusteella: 10 000 simuloitua kautta</li>
              )}
            </ol>
          ) : live.steps.length > 0 && (
            <details className="gs-trace">
              <summary>✓ {live.steps.length} vaihetta{live.tools.length ? ` · ${live.tools.join(" · ")}` : ""}{live.sql.length ? ` · ${live.sql.length} SQL-kyselyä` : ""}</summary>
              <ol className="gs-steps">{live.steps.map((st, i) => <li key={i} className="ok"><i aria-hidden>✓</i>{st}</li>)}</ol>
              {live.sql.map((q, i) => <pre key={i}>{q}</pre>)}
            </details>
          )}
          {live.text && <p className="gs-ai-t">{live.text}</p>}
          {/* Uutisista hyväksytyt poissaolot, jotka ovat skenaariossa lähtötilanteena (7.11.2026). */}
          {live.news && live.news.length > 0 && <p className="gs-news">Mukana uutisista: {live.news.join(" · ")}</p>}
          {live.error && <div className="ag-err">{live.error}</div>}
          {live.done && !live.error && live.items === 0 && live.text && (
            <form className="gs-reply" onSubmit={(e) => { e.preventDefault(); run(reply); }}>
              <input value={reply} onChange={(e) => setReply(e.target.value)} maxLength={300} enterKeyHint="send" autoFocus
                placeholder="Vastaa tarkennukseen, esim. seuraavat 20 ottelua" aria-label="Vastaa agentin tarkennukseen" />
              <button type="submit" disabled={!reply.trim()}>Vastaa</button>
            </form>
          )}
        </div>
      )}
      {!items.length && !live && <p className="gs-hint">Tekoäly hakee tarvittavan datan, rakentaa skenaarion ja laskee sen ennustemallilla. Voit myös lukita tuloksia ottelukorteista.</p>}
      {err && <div className="ag-err gs-status">{err}</div>}
      {items.length > 0 && res && (
        <div className="gs-results">
          {/* Agentin valitsema kuvaaja; jos agentti ei valinnut (vanha haku), sama sääntö kuin sen ohjeessa.
              Ilman kuvaajadataa (vanha perusta lasketaan uudelleen) moottori palauttaa sen nyt. */}
          <ScenarioChart pick={live?.chart === undefined ? fallbackPick(res.locked_games?.length ?? 0, res.requirements.length > 0) : live.chart}
            charts={res.charts} locked={res.locked_games ?? []} plausibility={res.plausibility} />
          <p className="gs-stats">
            {res.plausibility != null && <>Kaikki lukitut tulokset toteutuvat mallin mukaan <b>{res.plausibility < 0.001 ? "alle 0,1" : fi(100 * res.plausibility, res.plausibility < 0.1 ? 1 : 0)} %</b>:n todennäköisyydellä · </>}
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
      {items.length > 0 && (
        <div className="gs-chips" aria-label="Lukitut tulokset">
          {(allChips || chips.length <= 4 ? chips : []).map((c) => (
            <button key={itemKey(c)} type="button" className="gs-chip" title="Poista"
              onClick={() => setLocks(chips.filter((x) => itemKey(x) !== itemKey(c)))}>{c.label}<span aria-hidden>✕</span></button>
          ))}
          {/* Koko kauden skenaariossa voi olla kymmeniä otteluita: tiivistetään (7.11.2026). */}
          {chips.length > 4 && (
            <button type="button" className="gs-chip more" onClick={() => setAllChips(!allChips)}>
              {allChips ? "Piilota lukitut tulokset" : `${chips.length} lukittua tulosta · näytä`}</button>
          )}
        </div>
      )}
      {haut.length > 0 && !building && (
        <details className="gs-hist">
          <summary>Aiemmat skenaariot ({haut.length})</summary>
          <ul>
            {haut.map((h) => (
              <li key={h.id}>
                <button type="button" onClick={() => open(h)}>
                  <b>{h.question}</b>
                  <span>{when(h.askedAt)} · {h.status === "done" ? `${h.items.length} ${h.items.length === 1 ? "rivi" : "riviä"}` : h.status === "clarify" ? "tarkennus kysytty" : "virhe"}
                    {h.forecastTs && stamp && h.forecastTs !== stamp ? " · vanha perusta" : ""}</span>
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
