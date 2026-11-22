// Uutiset sovellukseen (22.11.2026, G3): LIIGA.MEDIA.MEDIA_EVENTS = Ilta-Sanomien, Iltalehden ja MTV:n
// Liiga-otsikot (source_kind 'media') sekä seurojen, Ylen ja Sportin uutiset (source_kind 'news'), joukkueet,
// tapahtumatyyppi ja linkki. Mediat-sivu, joukkuesivu ja ottelut lukevat tätä. Uutiset ovat tiedoksi:
// ne eivät vaikuta ennusteen lukuihin. Agentti käyttää omaa hakuaan LIIGA.MEDIA.LIIGA_MEDIA_SEARCH.
import { DATA_MODE, query } from "@/lib/snowflake";

export type MediaLink = {
  published: string | null; source: string; kind: "media" | "news"; team: string | null; teams: string[];
  eventType: string | null; title: string; url: string;
};

const TTL_MS = 10 * 60_000;      // poiminta kerran aamulla (control plane), joten 10 min muisti riittää
let cache: { at: number; rows: Promise<MediaLink[]> } | null = null;

export function loadMedia(): Promise<MediaLink[]> {
  if (DATA_MODE !== "snowflake") return Promise.resolve([]);   // paikallinen DuckDB: ei mediadataa
  if (!cache || Date.now() - cache.at > TTL_MS) {
    const rows = query<{ PUBLISHED: string | null; SOURCE: string; KIND: string | null; TEAMS: string | null; EVENT_TYPE: string | null; TITLE: string; URL: string }>(
      `SELECT TO_VARCHAR(COALESCE(published, extracted_at), 'YYYY-MM-DD"T"HH24:MI:SSTZH:TZM') AS published,
              source, source_kind AS kind, teams, event_type, title, url
         FROM LIIGA.MEDIA.MEDIA_EVENTS
        WHERE COALESCE(published, extracted_at) > DATEADD(day, -21, CURRENT_TIMESTAMP())
        ORDER BY COALESCE(published, extracted_at) DESC
        LIMIT 400`,
    ).then((r) => r.map((x) => {
      const teams = (x.TEAMS ?? "").split(",").map((t) => t.trim()).filter(Boolean);
      return { published: x.PUBLISHED, source: x.SOURCE, kind: x.KIND === "news" ? "news" as const : "media" as const,
        team: teams.join(", ") || null, teams, eventType: x.EVENT_TYPE, title: x.TITLE, url: x.URL };
    })).catch((e) => { cache = null; throw e; });
    cache = { at: Date.now(), rows };
  }
  return cache.rows;
}

// Joukkueiden tuoreimmat uutiset (joukkue-, ottelu- ja kierrosnäkymät). Ottelutulokset jätetään pois:
// ne näkyvät jo sivulla itsellään, uutislista on siirtoja, poissaoloja ja valmentajia varten.
// 23.11.2026: myös off-ice ja other pois (seurojen markkinointi: Black Week, VIP-paketit, tarjoukset).
const NOT_ON_TEAM_PAGES = new Set(["game result", "off-ice", "other"]);
export async function newsFor(teams: string[], max = 5, days = 14): Promise<MediaLink[]> {
  const want = new Set(teams);
  const since = Date.now() - days * 864e5;
  const rows = await loadMedia().catch(() => []);
  return rows.filter((r) => !NOT_ON_TEAM_PAGES.has(r.eventType ?? "") && r.teams.some((t) => want.has(t))
    && (!r.published || Date.parse(r.published) >= since)).slice(0, max);
}
