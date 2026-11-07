// Etusivun skenaariohaut ja niiden vastaukset (7.11.2026, käyttäjä: "Haluan että skenaariot
// tallentuvat ja niiden vastaukset"). Sama malli kuin lib/kortti.ts:
//   Snowflakessa LIIGA.MODEL.SKENAARIO_HAKU (snowflake/LIIGA/MODEL/tables/SKENAARIO_HAKU.sql,
//   luodaan deploy-app.yml:ssä), paikallisesti ~/.cache/liiga-ennuste/skenaariot.json --
//   gitissä oleva data/liiga.duckdb ei muutu.
// Rivi kirjoitetaan kerran, kun haku on valmis (app/api/skenaario/rakenna): kysymys,
// tekoälyn yhteenveto, moottorin kanoniset rivit ja moottorin luvut tiivistettynä.
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DATA_MODE, query } from "@/lib/snowflake";

export type Haku = {
  id: string; season: number; question: string; followup: string | null; answer: string;
  items: Record<string, unknown>[]; result: Summary | null; tools: string[]; sql: string[];
  forecastTs: string; askedAt: string; ms: number; status: "done" | "clarify" | "error"; source: string;
};
// Moottorin vastaus tiivistettynä: samat luvut, jotka hakutuloksissa näkyvät.
// charts + chart + locked_games: kuvaajadata ja agentin valinta (7.11.2026), jotta tallennettu haku
// avautuu samalla kuvaajalla.
export type Summary = { plausibility: number | null; forecast_date: string; requirements: unknown[]; teams: Record<string, number | string>[];
  charts?: unknown; chart?: unknown; locked_games?: unknown[]; news?: string[] };

const TABLE = "LIIGA.MODEL.SKENAARIO_HAKU";
const LOCAL = path.join(os.homedir(), ".cache", "liiga-ennuste", "skenaariot.json");
const KEYS = ["p_relegation", "p_top10", "p_top6", "p_title"];

/** Moottorin json-vastauksesta talteen vain liikkuneet joukkueet (vähintään 1 %-yks.). */
export function summarize(res: Record<string, unknown>, chart?: unknown): Summary {
  const teams = ((res.teams ?? []) as Record<string, number | string>[]).filter((r) =>
    KEYS.some((k) => Math.abs(Number(r[`${k}_scenario`]) - Number(r[`${k}_now`])) >= 0.01));
  return {
    plausibility: res.plausibility == null ? null : Number(res.plausibility), forecast_date: String(res.forecast_date ?? ""),
    requirements: (res.requirements ?? []) as unknown[], charts: res.charts ?? null, chart: chart ?? null,
    locked_games: (res.locked_games ?? []) as unknown[],
    teams: teams.map((r) => Object.fromEntries([["team", r.team], ...KEYS.flatMap((k) => [[`${k}_now`, r[`${k}_now`]], [`${k}_scenario`, r[`${k}_scenario`]]])])),
  };
}

function readLocal(): Haku[] { try { return JSON.parse(fs.readFileSync(LOCAL, "utf8")) as Haku[]; } catch { return []; } }

export async function saveHaku(h: Omit<Haku, "id" | "askedAt">): Promise<string> {
  const id = crypto.randomUUID();
  if (DATA_MODE === "duckdb") {
    fs.mkdirSync(path.dirname(LOCAL), { recursive: true });
    fs.writeFileSync(LOCAL, JSON.stringify([...readLocal(), { ...h, id, askedAt: new Date().toISOString() }], null, 1));
    return id;
  }
  // VARIANT/ARRAY: PARSE_JSON ei käy VALUES-lausekkeessa, joten INSERT ... SELECT.
  await query(`INSERT INTO ${TABLE} (id, season, question, followup, answer, items, result, tools, sql_text, forecast_ts, ms, status, source)
    SELECT ?, ?, ?, ?, ?, PARSE_JSON(?), PARSE_JSON(?), PARSE_JSON(?), PARSE_JSON(?), ?, ?, ?, ?`,
  [id, h.season, h.question, h.followup, h.answer, JSON.stringify(h.items), JSON.stringify(h.result), JSON.stringify(h.tools),
    JSON.stringify(h.sql), h.forecastTs, h.ms, h.status, h.source]);
  return id;
}

const json = <T>(v: unknown, d: T): T => { if (v == null) return d; if (typeof v !== "string") return v as T; try { return JSON.parse(v) as T; } catch { return d; } };

/** Uusimmat ensin. id annettuna vain se rivi. */
export async function listHaut(limit = 20, id?: string): Promise<Haku[]> {
  if (DATA_MODE === "duckdb") {
    const all = readLocal().reverse();
    return id ? all.filter((h) => h.id === id) : all.slice(0, limit);
  }
  const rows = await query(`
    SELECT id, season, question, followup, answer, items, result, tools, sql_text, forecast_ts,
           TO_VARCHAR(asked_at, 'YYYY-MM-DD"T"HH24:MI:SSTZH:TZM') AS asked_at, ms, status, source
    FROM ${TABLE} ${id ? "WHERE id = ?" : ""} ORDER BY asked_at DESC LIMIT ${id ? 1 : Math.min(Math.max(1, limit), 100)}`, id ? [id] : []);
  return rows.map((r) => ({
    id: String(r.ID), season: Number(r.SEASON), question: String(r.QUESTION), followup: r.FOLLOWUP == null ? null : String(r.FOLLOWUP),
    answer: String(r.ANSWER ?? ""), items: json(r.ITEMS, []), result: json(r.RESULT, null), tools: json(r.TOOLS, []), sql: json(r.SQL_TEXT, []),
    forecastTs: String(r.FORECAST_TS ?? ""), askedAt: String(r.ASKED_AT), ms: Number(r.MS ?? 0), status: String(r.STATUS) as Haku["status"], source: String(r.SOURCE ?? ""),
  }));
}
