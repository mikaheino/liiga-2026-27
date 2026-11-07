// Uusi pelaaja -> rosterijono (7.11.2026, käyttäjä: "jos uusi pelaaja niin polku jolla pelaaja rosteriin
// standardin mukaisesti"). Sovellus EI lisää pelaajaa malliin: se tunnistaa haussa pelaajan, jota mallin
// rosterissa ei ole, ja kirjaa hänet jonoon. Lisäys tehdään dokumentoidulla standardipolulla
// (docs/claude/roster.md "Adding new players — required steps", vaiheet 1–9): siirtotiedosto, ulkoiset
// tilastot, player_rates, päivitysajo, kattavuus ja vaikutusloki. Jonon näyttää
// scripts/local/roster_queue.py. Kun lisäys on tehty, ennuste päivittyy ja tallennettu haku ajetaan
// avattaessa uudelleen (ScenarioBoard open()), jolloin pelaaja lasketaan omilla tilastoillaan.
// Jono: paikallisesti data/roster_requests.csv (commitoidaan rosterierän mukana). Snowflakessa
// sovellus ei kirjoita repoon; siellä tunnistus toimii ja vastaus kertoo asian, kirjaus jää tekemättä.
import fs from "node:fs";
import path from "node:path";
import { DATA_MODE, query } from "@/lib/snowflake";

export type Missing = { name: string; team: string | null };
const M = "LIIGA.MODEL";
const REPO = path.resolve(process.cwd(), "../../../../..");
const QUEUE = path.join(REPO, "data", "roster_requests.csv");
const HEADER = "requested_at,player,team,source,status\n";
// "Etunimi Sukunimi" (myös väliviiva ja skandit); ei lauseen alun sanoja kuten "Mitä Jos".
const NAME = /\b([A-ZÅÄÖ][a-zåäöé]+(?:-[A-ZÅÄÖ][a-zåäöé]+)?)\s+([A-ZÅÄÖ][a-zåäöé]+(?:-[A-ZÅÄÖ][a-zåäöé]+)?)\b/g;
const NOT_FIRST = new Set(["Mitä", "Entä", "Jos", "Kun", "Uusi", "Montako", "Paljonko", "Kestääkö", "Pääseekö", "Voittaako", "Nouseeko"]);

/** Pelaajat, joita haussa mainitaan mutta joita mallin rosterissa ei ole. */
export async function missingPlayers(text: string, teams: string[]): Promise<Missing[]> {
  const cands = [...text.matchAll(NAME)].filter((m) => !NOT_FIRST.has(m[1]) && !teams.includes(m[1]) && !teams.includes(m[2]));
  if (!cands.length) return [];
  const roster = await query(`SELECT team, first_name, last_name FROM ${M}.ROSTER_2026_27`).catch(() => []);
  if (!roster.length) return [];
  const last = new Set(roster.map((r) => String(r.LAST_NAME).toLowerCase()));
  const out: Missing[] = [];
  for (const m of cands) {
    if (last.has(m[2].toLowerCase())) continue;
    const name = `${m[1]} ${m[2]}`;
    // Joukkue uutisesta (otsikko mainitsee nimen) tai haun joukkueesta.
    const hit = await query(`SELECT team FROM news_items WHERE title LIKE '%${name.replace(/'/g, "''")}%' ORDER BY published DESC LIMIT 1`).catch(() => []);
    const raw = String(hit[0]?.TEAM ?? "");
    const team = teams.find((t) => raw.split(",").some((x) => x.trim() === t || x.trim().endsWith(` ${t}`)))
      ?? teams.find((t) => text.includes(t)) ?? null;
    out.push({ name, team });
  }
  return out;
}

/** Kirjaa jonoon (vain paikallisesti), ellei pelaaja ole siellä jo odottamassa. Palauttaa kirjatut. */
export function queueRoster(rows: Missing[], source: string): Missing[] {
  if (DATA_MODE !== "duckdb" || !rows.length) return [];
  const prev = fs.existsSync(QUEUE) ? fs.readFileSync(QUEUE, "utf8") : HEADER;
  const pending = new Set(prev.split("\n").slice(1).filter((l) => l.endsWith(",pending")).map((l) => l.split(",")[1]));
  const add = rows.filter((r) => !pending.has(r.name));
  if (!add.length) return rows;
  const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const now = new Date().toISOString();
  fs.writeFileSync(QUEUE, prev + add.map((r) => [now, r.name, r.team ?? "", source.slice(0, 120), "pending"].map(esc).join(",")).join("\n") + "\n");
  return rows;
}
