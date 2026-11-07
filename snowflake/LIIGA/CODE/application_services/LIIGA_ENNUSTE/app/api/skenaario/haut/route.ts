// Tallennetut skenaariohaut (7.11.2026, lib/skenaarioHaut.ts).
//   GET            -> { forecastTs, haut: [uusimmat 20, ilman SQL-jälkeä] }
//   GET ?id=<uuid> -> { forecastTs, haku } koko rivi (avaa haun uudelleen)
import { NextResponse } from "next/server";
import { forecastStamp } from "@/lib/kortti";
import { listHaut } from "@/lib/skenaarioHaut";

export const dynamic = "force-dynamic";
const NO_STORE = { "cache-control": "no-store" };
const UUID = /^[0-9a-f-]{36}$/;

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (id && !UUID.test(id)) return NextResponse.json({ error: "virheellinen id" }, { status: 400, headers: NO_STORE });
  try {
    const [forecastTs, rows] = await Promise.all([forecastStamp(), listHaut(20, id || undefined)]);
    if (id) return rows[0] ? NextResponse.json({ forecastTs, haku: rows[0] }, { headers: NO_STORE }) : NextResponse.json({ error: "ei löydy" }, { status: 404, headers: NO_STORE });
    return NextResponse.json({ forecastTs, haut: rows.map(({ sql, ...h }) => ({ ...h, sql: [], sqlCount: sql.length })) }, { headers: NO_STORE });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502, headers: NO_STORE });
  }
}
