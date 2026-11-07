import { activeAbsences } from "@/lib/newsContext";
import { query } from "@/lib/snowflake";

// --- Hakuehdotukset uutisista (7.11.2026, käyttäjä: "olisi mukavaa jos uutiset näkyisivät
// googlemaiseen tyyliin ehdotuksia") --------------------------------------------------------
// Valmis kysymys muodostetaan pohjasta rakenteisista kentistä (pelaaja, joukkue, tyyppi), ei
// kielimallilla. Lähde ja päivä näytetään käyttäjälle; otsikkoa ei näytetä eikä anneta agentille.
// Mukana vain luotettavat yhdistelmät: pelaaja tunnistettu + loukkaantuminen / pelikielto / paluu /
// siirto, sekä voimassa olevat hyväksytyt poissaolot. Valmentajaliput ovat liian kohinaisia
// (avustajat, ensi kauden nimitykset), joten niistä ei tehdä ehdotuksia.
export type Suggestion = { q: string; meta: string; kind: "absence" | "injury" | "suspension" | "return" | "signing" };

const fiDay = (iso: string) => `${Number(iso.slice(8, 10))}.${Number(iso.slice(5, 7))}.`;
const surname = (p: string) => p.trim().split(/\s+/).slice(-1)[0];

// Joukkueelle auki oleva kysymys nykyennusteesta (7.11.2026: "pääseekö Lukko jatkoon" oli turha,
// kun jatkopaikka on 99,9 %): kärki -> runkosarjan voitto, keskikasti -> kärkikuusikko tai jatkoon,
// alapää -> putoamiselta välttyminen. dist = sijajakauma 1..17 (PositionRow.p).
export type Dist = Record<string, number[]>;
export function openQuestion(team: string, dist: Dist): string {
  const p = dist[team];
  if (!p) return `pääseekö ${team} jatkoon?`;
  const sum = (a: number, b: number) => p.slice(a - 1, b).reduce((x, y) => x + y, 0);
  if (sum(15, 17) >= 0.15) return `välttyykö ${team} putoamiselta?`;
  if (sum(1, 6) >= 0.85) return `voittaako ${team} runkosarjan?`;
  if (sum(1, 10) >= 0.9) return `nouseeko ${team} kärkikuusikkoon?`;
  return `pääseekö ${team} jatkoon?`;
}

export async function suggestions(teams: string[], today: string, dist: Dist = {}): Promise<Suggestion[]> {
  const canon = (raw: string) => teams.find((t) => raw.split(",").some((x) => x.trim() === t || x.trim().endsWith(` ${t}`))) ?? null;
  const since = new Date(Date.parse(today) - 21 * 86_400_000).toISOString().slice(0, 10);
  // Pelaajat, joista on jo kirjaus (voimassa tai päättynyt, esim. Harpurin yhden ottelun pelikielto):
  // uutinen on käsitelty, joten siitä ei enää ehdoteta.
  const [abs, rows, done] = await Promise.all([
    activeAbsences(today),
    query(`SELECT SUBSTR(CAST(i.published AS VARCHAR), 1, 10) AS d, i.source, i.team, i.flags, c.player, c.team AS cteam
           FROM news_items i JOIN news_candidates c ON c.url = i.url
           WHERE SUBSTR(CAST(i.published AS VARCHAR), 1, 10) >= '${since}' AND i.flags IS NOT NULL
           ORDER BY i.published DESC`).catch(() => []),
    query("SELECT DISTINCT player FROM news_absences WHERE player IS NOT NULL").catch(() => []),
  ]);
  const handled = new Set(done.map((r) => String(r.PLAYER)));
  const out: Suggestion[] = [];
  const seen = new Set<string>();
  // Saman joukkueen poissaolot yhdeksi ehdotukseksi.
  const byTeam = new Map<string, typeof abs>();
  for (const a of abs) { seen.add(a.player); byTeam.set(a.team, [...(byTeam.get(a.team) ?? []), a]); }
  for (const [team, list] of byTeam) {
    const names = list.map((a) => surname(a.player));
    const who = names.length === 1 ? `pelaajaa ${list[0].player}` : `pelaajia ${names.slice(0, -1).join(", ")} ja ${names[names.length - 1]}`;
    out.push({ kind: "absence", q: `${team} ilman ${who} – ${openQuestion(team, dist)}`,
      meta: `Hyväksytty poissaolo · ${list.map((a) => `${surname(a.player)} ${fiDay(a.until)} asti`).join(", ")}` });
  }
  for (const r of rows) {
    const player = String(r.PLAYER ?? ""), team = canon(String(r.CTEAM ?? r.TEAM ?? "")), flags = String(r.FLAGS);
    if (!player || !team || seen.has(player) || handled.has(player)) continue;
    const meta = `${String(r.SOURCE ?? "uutinen")} · ${fiDay(String(r.D))}`;
    const s = surname(player);
    const pick: Suggestion | null =
      flags.includes("pelikielto") ? { kind: "suspension", q: `${player} pelikiellossa – ${openQuestion(team, dist)}`, meta }
      : flags.includes("loukkaantuminen") ? { kind: "injury", q: `${player} sivussa loppukauden – ${openQuestion(team, dist)}`, meta }
      : flags.includes("paluu") ? { kind: "return", q: `${s} palaa kokoonpanoon – ${openQuestion(team, dist)}`, meta }
      : flags.includes("siirto") ? { kind: "signing", q: `Uusi pelaaja ${player} – ${openQuestion(team, dist)}`, meta }
      : null;
    if (!pick) continue;
    seen.add(player);
    out.push(pick);
    if (out.length >= 8) break;
  }
  return out;
}
