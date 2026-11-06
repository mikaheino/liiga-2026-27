// Kohteeseen sidotut kysymykset (lib/kortti.ts): ottelu, joukkue, pelaaja ja koko liiga.
//   GET  ?type=game&key=2027:2701477  -> { forecastTs, rows }  (aina tuore: no-store)
//   POST { type, key, question } -> { id }  -- agentti ajetaan vastauksen jälkeen
//        (after), joten kortin voi sulkea kesken: rivi tallentuu silti ja odottaa
//        kohteella seuraavalla avauksella.
// Sama kysymys samasta kohteesta samalla ennusteella palauttaa valmiin rivin eikä
// kutsu agenttia uudelleen (avain: kohde + forecast_ts + kysymys).
// Pagesissa (STATIC) koko app/api poistetaan käännöksestä (pages_build.sh).
import { after, NextResponse } from "next/server";
import { AGENT_SOURCE, askOnce } from "@/lib/agent";
import {
  type SubjectType, clearProgress, completeRow, forecastStamp, insertPending, listRows, normalize, progressOf, resolve, setProgress,
} from "@/lib/kortti";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const NO_STORE = { "cache-control": "no-store" };
const MAX_PENDING = 2;                     // samanaikaisia kutsuja per kohde: tokenit maksavat
const TYPES = new Set(["game", "team", "player", "season"]);
const valid = (type: unknown, key: unknown): [SubjectType, string] | null =>
  typeof type === "string" && TYPES.has(type) && typeof key === "string" && /^\d{4}:.{1,60}$/.test(key) ? [type as SubjectType, key] : null;

export async function GET(req: Request) {
  const u = new URL(req.url);
  const s = valid(u.searchParams.get("type"), u.searchParams.get("key"));
  if (!s) return NextResponse.json({ error: "virheellinen kohde" }, { status: 400, headers: NO_STORE });
  const [forecastTs, rows] = await Promise.all([forecastStamp(), listRows(...s)]);
  return NextResponse.json({ forecastTs, rows: rows.map((r) => (r.status === "pending" ? { ...r, progress: progressOf(r.id) ?? null } : r)) }, { headers: NO_STORE });
}

export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { type?: unknown; key?: unknown; question?: unknown };
  const s = valid(b.type, b.key);
  const question = typeof b.question === "string" ? b.question.trim().replace(/\s+/g, " ") : "";
  if (!s || question.length < 3 || question.length > 300) {
    return NextResponse.json({ error: "virheellinen kysymys" }, { status: 400, headers: NO_STORE });
  }
  const forecastTs = await forecastStamp();
  const subject = await resolve(s[0], s[1], forecastTs);
  if (!subject) return NextResponse.json({ error: "kohdetta ei löydy" }, { status: 404, headers: NO_STORE });

  const rows = await listRows(...s);
  const same = rows.find((r) => r.forecastTs === forecastTs && normalize(r.question) === normalize(question) && r.status !== "error");
  if (same) return NextResponse.json({ id: same.id, cached: true }, { headers: NO_STORE });
  if (rows.filter((r) => r.status === "pending").length >= MAX_PENDING) {
    return NextResponse.json({ error: "Agentti vastaa jo tämän kohteen kysymyksiin, odota hetki." }, { status: 429, headers: NO_STORE });
  }

  const row = await insertPending(subject, question, forecastTs, AGENT_SOURCE);
  setProgress(row.id, { status: "Yhdistetään…" });
  after(async () => {
    const t0 = Date.now();
    try {
      const a = await askOnce(question, subject.context, (p) => setProgress(row.id, p));
      await completeRow(row.id, { status: "done", answer: a.text, suggestions: a.suggestions, tools: a.tools, sql: a.sql, ms: a.ms });
    } catch (e) {
      const msg = String((e as Error).message).split("\n")[0].slice(0, 300);
      console.log(`[kortti] ${row.id} epäonnistui: ${msg}`);
      await completeRow(row.id, { status: "error", answer: `Agentti ei vastannut: ${msg}`, ms: Date.now() - t0 }).catch(() => {});
    } finally {
      clearProgress(row.id);
    }
  });
  return NextResponse.json({ id: row.id }, { headers: NO_STORE });
}
