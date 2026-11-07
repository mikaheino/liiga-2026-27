// Uutiset skenaarioon (7.11.2026, käyttäjä: "Miten pagesissa olevassa uutisominaisuus otetaan
// skenaarioon mukaan luontevasti" -> "aloita"). Kaksi kerrosta, molemmat vain rakenteisia
// kenttiä (pelaaja, joukkue, tyyppi, päivä) -- (7.11.: otsikot nyt erikseen headlines()-funktiolla, ks. alla)
// (tietoturvapäätös 6.11., docs/claude/skenaario.md):
//   lähtötilanne  hyväksytyt poissaolot (uutissivun OK, news_absences): voimassa oleva
//                 viimeisin "out"-kirjaus, sama sääntö kuin scripts/news/absences.py active()
//   vihjeet       hyväksymättömät loukkaantumis- ja pelikieltouutiset (news_candidates +
//                 news_items.flags), joista ei ole kirjausta: mainitaan, ei lasketa
// Data (7.11.2026, "KAIKKI PITÄÄ TOIMIA SNOWFLAKE"): rakenteiset taulut NEWS_SIGNALS ja
// NEWS_ABSENCE_LOG (scripts/news/news_signals.py), paikallisesti uutiskannassa, Snowflakessa
// LIIGA.MODELissa (liiga.snowflake_sync). Ei otsikoita eikä tekstiä kummassakaan.
import { DATA_MODE, query } from "@/lib/snowflake";

/** Uutistaulun nimi: paikallisesti uutiskannan taulu (hakupolku), Snowflakessa LIIGA.MODEL. */
export const NT = (name: string) => (DATA_MODE === "duckdb" ? name.toLowerCase() : `LIIGA.MODEL.${name.toUpperCase()}`);

export type NewsAbsence = { player: string; team: string; until: string };
export type NewsHint = { player: string; team: string; kind: "loukkaantuminen" | "pelikielto" };

export async function activeAbsences(today: string): Promise<NewsAbsence[]> {
  const rows = await query(`SELECT approved_at, url_hash, player, team, kind, start, until FROM ${NT("news_absence_log")} ORDER BY approved_at`).catch(() => []);
  // Tapahtumaloki: dismiss peruu saman uutisen kirjaukset, pelaajan viimeisin out/back on voimassa.
  const ev = rows.map((r) => ({ at: String(r.APPROVED_AT), url: String(r.URL_HASH ?? ""), player: String(r.PLAYER ?? ""), team: String(r.TEAM ?? ""),
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
    SELECT player, team, kind FROM ${NT("news_signals")}
    WHERE published >= '${since}' AND kind IN ('injury', 'suspension')
      AND player NOT IN (SELECT player FROM ${NT("news_absence_log")} WHERE player IS NOT NULL)`).catch(() => []);
  return rows.filter((r) => teams.includes(String(r.TEAM))).slice(0, 4).map((r) => ({
    player: String(r.PLAYER), team: String(r.TEAM), kind: String(r.KIND) === "suspension" ? "pelikielto" : "loukkaantuminen" }));
}

// Uutisotsikot agentille (7.11.2026, käyttäjän päätös: uutiset "saa nähdä ja päivittyä samalla kun
// haetaan uudet data liiga pistää"; aiempi linja "ei otsikoita agentille" päättyi). Snowflakessa
// LIIGA.MODEL.V_NEWS_ITEMS (LIIGA_DAILY hakee), paikallisesti news.duckdb:n news_items.
export type NewsHeadline = { date: string; team: string; flags: string; title: string; summary: string };
export async function headlines(teams: string[], today: string, days = 14, max = 8): Promise<NewsHeadline[]> {
  if (!teams.length) return [];
  const since = new Date(Date.parse(today) - days * 864e5).toISOString().slice(0, 10);
  const like = teams.map((t) => `team LIKE '%${t.replace(/'/g, "''")}%'`).join(" OR ");
  const sql = DATA_MODE === "duckdb"
    ? `SELECT SUBSTR(COALESCE(NULLIF(published, ''), fetched_at), 1, 10) AS d, team, COALESCE(flags, '') AS flags, title, COALESCE(summary, '') AS summary
       FROM news_items WHERE SUBSTR(COALESCE(NULLIF(published, ''), fetched_at), 1, 10) >= '${since}' AND (${like}) ORDER BY d DESC LIMIT ${max}`
    : `SELECT TO_VARCHAR(published_at::DATE) AS d, team, COALESCE(flags, '') AS flags, title, COALESCE(summary, '') AS summary
       FROM ${NT("v_news_items")} WHERE published_at >= '${since}' AND (${like}) ORDER BY published_at DESC LIMIT ${max}`;
  const rows = await query(sql).catch(() => []);
  return rows.map((r) => ({ date: String(r.D), team: String(r.TEAM), flags: String(r.FLAGS), title: String(r.TITLE), summary: String(r.SUMMARY).slice(0, 220) }));
}
