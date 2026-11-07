// Uutiset skenaarioon (7.11.2026, käyttäjä: "Miten pagesissa olevassa uutisominaisuus otetaan
// skenaarioon mukaan luontevasti" -> "aloita"). Kaksi kerrosta, molemmat vain rakenteisia
// kenttiä (pelaaja, joukkue, tyyppi, päivä) -- agentti ei näe uutistekstiä eikä otsikoita
// (tietoturvapäätös 6.11., docs/claude/skenaario.md):
//   lähtötilanne  hyväksytyt poissaolot (uutissivun OK, news_absences): voimassa oleva
//                 viimeisin "out"-kirjaus, sama sääntö kuin scripts/news/absences.py active()
//   vihjeet       hyväksymättömät loukkaantumis- ja pelikieltouutiset (news_candidates +
//                 news_items.flags), joista ei ole kirjausta: mainitaan, ei lasketa
// Data: paikallisesti data/news.duckdb (duckdb_query.py liittää sen). Snowflakessa uutistauluja
// ei vielä ole (vaihe J3), jolloin kysely kaatuu ja kumpikin lista on tyhjä.
import { query } from "@/lib/snowflake";

export type NewsAbsence = { player: string; team: string; until: string };
export type NewsHint = { player: string; team: string; kind: "loukkaantuminen" | "pelikielto" };

export async function activeAbsences(today: string): Promise<NewsAbsence[]> {
  const rows = await query("SELECT approved_at, url, player, team, kind, start, until FROM news_absences ORDER BY approved_at").catch(() => []);
  // Tapahtumaloki: dismiss peruu saman uutisen kirjaukset, pelaajan viimeisin out/back on voimassa.
  const ev = rows.map((r) => ({ at: String(r.APPROVED_AT), url: String(r.URL ?? ""), player: String(r.PLAYER ?? ""), team: String(r.TEAM ?? ""),
    kind: String(r.KIND ?? ""), start: String(r.START ?? ""), until: String(r.UNTIL ?? "") }));
  const latest = new Map<string, (typeof ev)[number]>();
  ev.forEach((r, i) => {
    const cancelled = r.url && ev.slice(i + 1).some((x) => x.kind === "dismiss" && x.url === r.url);
    if ((r.kind === "out" || r.kind === "back") && !cancelled && r.player) latest.set(r.player, r);
  });
  return [...latest.values()].filter((r) => r.kind === "out" && r.start <= today && today < r.until)
    .map((r) => ({ player: r.player, team: r.team, until: r.until }));
}

export async function injuryHints(teams: string[], today: string): Promise<NewsHint[]> {
  if (!teams.length) return [];
  const since = new Date(Date.parse(today) - 21 * 86_400_000).toISOString().slice(0, 10);
  const rows = await query(`
    SELECT DISTINCT c.player, c.team, i.flags
    FROM news_candidates c JOIN news_items i ON i.url = c.url
    WHERE SUBSTR(CAST(i.published AS VARCHAR), 1, 10) >= '${since}'
      AND (i.flags LIKE '%loukkaantuminen%' OR i.flags LIKE '%pelikielto%')
      AND c.player NOT IN (SELECT player FROM news_absences WHERE player IS NOT NULL)`).catch(() => []);
  return rows.filter((r) => teams.includes(String(r.TEAM))).slice(0, 4).map((r) => ({
    player: String(r.PLAYER), team: String(r.TEAM),
    kind: String(r.FLAGS).includes("pelikielto") ? "pelikielto" : "loukkaantuminen" }));
}
