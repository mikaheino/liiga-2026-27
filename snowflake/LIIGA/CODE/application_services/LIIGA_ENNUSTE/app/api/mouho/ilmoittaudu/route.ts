// POST { nimi, email, pari?, psn?, iq? } -> { ok } -- Mouho 2027 -ilmoittautuminen pelin lopusta
// (17.10.: "kun pelin suorittaa, pelaajalle avautuu formi, jolla voi ilmoittautua Mouho 2027:ään").
//
// Paikallisesti rivi lisätään tiedostoon data/mouho_2027_ilmoittautumiset.csv (gitignore:
// henkilötietoja ei viedä julkiseen repoon). Snowflakessa tallennuspaikka on vielä päättämättä,
// joten reitti vastaa selkeästi 503 eikä hukkaa ilmoittautumista hiljaa.
import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { DATA_MODE } from "@/lib/snowflake";

export const dynamic = "force-dynamic";
const REPO = process.env.LIIGA_REPO ?? path.resolve(/* turbopackIgnore: true */ process.cwd(), "../../../../..");
const FILE = path.join(REPO, "data", "mouho_2027_ilmoittautumiset.csv");
const clean = (v: unknown, max = 120) => String(v ?? "").replace(/[\r\n"]/g, " ").trim().slice(0, max);

export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const nimi = clean(b.nimi), email = clean(b.email), pari = clean(b.pari), psn = clean(b.psn, 40), iq = clean(b.iq, 10);
  if (nimi.length < 2 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: "Nimi ja toimiva sähköposti tarvitaan." }, { status: 400 });
  if (DATA_MODE !== "duckdb") return NextResponse.json({ error: "Ilmoittautumisten tallennus ei ole vielä käytössä tässä ympäristössä." }, { status: 503 });
  const head = !fs.existsSync(FILE) ? "aika,nimi,email,pari,psn,mouho_iq\n" : "";
  fs.appendFileSync(FILE, head + [new Date().toISOString(), nimi, email, pari, psn, iq].map((v) => `"${v}"`).join(",") + "\n", "utf8");
  return NextResponse.json({ ok: true });
}
