// Uutiset skenaarioon (7.11.2026, käyttäjä: "Miten pagesissa olevassa uutisominaisuus otetaan
// skenaarioon mukaan luontevasti" -> "aloita"). Kaksi kerrosta, molemmat vain rakenteisia
// kenttiä (pelaaja, joukkue, tyyppi, päivä) -- agentti ei näe uutistekstiä eikä otsikoita
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
