// Muut mediat (21.11.2026): Ilta-Sanomien, Iltalehden ja MTV:n Liiga-otsikot ja linkit (LIIGA.MEDIA).
// Mediat-sivun lukija. Tekoälykäyttö sallittu 22.11.2026 (lupa, vain otsikot ja linkit); agentti käyttää
// omaa hakuaan LIIGA.MEDIA.LIIGA_MEDIA_SEARCH, ei tätä moduulia.
import { DATA_MODE, query } from "@/lib/snowflake";

export type MediaLink = { published: string | null; source: string; team: string | null; title: string; url: string };

const TTL_MS = 10 * 60_000;      // keräys kerran yössä (control plane), joten 10 min muisti riittää
let cache: { at: number; rows: Promise<MediaLink[]> } | null = null;

export function loadMedia(): Promise<MediaLink[]> {
  if (DATA_MODE !== "snowflake") return Promise.resolve([]);   // paikallinen DuckDB: ei mediadataa
  if (!cache || Date.now() - cache.at > TTL_MS) {
    const rows = query<{ PUBLISHED: string | null; SOURCE: string; TEAM: string | null; TITLE: string; URL: string }>(
      `SELECT TO_VARCHAR(COALESCE(published, fetched_at), 'YYYY-MM-DD"T"HH24:MI:SSTZH:TZM') AS published,
              source, team, title, url
         FROM LIIGA.MEDIA.MEDIA_LINKS
        WHERE COALESCE(published, fetched_at) > DATEADD(day, -14, CURRENT_TIMESTAMP())
        ORDER BY COALESCE(published, fetched_at) DESC
        LIMIT 200`,
    ).then((r) => r.map((x) => ({ published: x.PUBLISHED, source: x.SOURCE, team: x.TEAM, title: x.TITLE, url: x.URL })))
      .catch((e) => { cache = null; throw e; });
    cache = { at: Date.now(), rows };
  }
  return cache.rows;
}
