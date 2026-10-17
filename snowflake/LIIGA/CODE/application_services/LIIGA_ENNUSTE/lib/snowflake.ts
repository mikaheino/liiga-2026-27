// Snowflake-kyselyt samalla koodilla paikallisesti ja App Runtimessa.
//
//   App Runtime: palvelun sessiotoken /snowflake/session/token (OAuth), tili ja
//                isäntä ympäristömuuttujista, jotka Snowflake asettaa.
//   Paikallisesti: ~/.snowflake/connections.toml, yhteys LIIGA_SNOW_CONNECTION
//                (oletus liiga_ci = palvelukäyttäjä avainparilla). Ei selainta.
//
// Molemmat lukevat samat taulut (LIIGA.MODEL), joten paikallinen kehitys näyttää
// täsmälleen saman datan kuin tuotanto -- ero Streamlitin DuckDB-polkuun.
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parse } from "smol-toml";
import snowflake from "snowflake-sdk";

const TOKEN = "/snowflake/session/token";

// Datalähde (17.10., "lokaaliapplikaatio tulisi toimia ilman Snowflake-yhteyttä"):
//   App Runtime (sessiotoken olemassa)  -> Snowflake LIIGA.MODEL
//   paikallisesti                        -> data/liiga.duckdb Python-sillan kautta
//   LIIGA_DATA=snowflake|duckdb pakottaa jommankumman.
export const DATA_MODE: "snowflake" | "duckdb" =
  process.env.LIIGA_DATA === "snowflake" || process.env.LIIGA_DATA === "duckdb" ? process.env.LIIGA_DATA : fs.existsSync(TOKEN) ? "snowflake" : "duckdb";
const REPO = process.env.LIIGA_REPO ?? path.resolve(/* turbopackIgnore: true */ process.cwd(), "../../../../..");

// DuckDB: scripts/local/duckdb_query.py, yksi prosessi per kysely (~0,1 s; tulokset
// välimuistissa lib/data.ts:ssä). Snowflaken nimiavaruus LIIGA.MODEL riisutaan pois.
function duck<T>(sql: string, binds: snowflake.Binds): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const p = spawn(path.join(REPO, ".venv/bin/python"), [path.join(REPO, "scripts/local/duckdb_query.py")], { cwd: REPO });
    let out = "", err = "";
    p.stdout.on("data", (b) => { out += b; }); p.stderr.on("data", (b) => { err += b; });
    p.on("error", reject);
    p.on("close", () => { try { const j = JSON.parse(out); return j.error ? reject(new Error(j.error)) : resolve(j as T[]); } catch { reject(new Error(err.trim().split("\n").pop() || "DuckDB-kysely epäonnistui")); } });
    p.stdin.end(JSON.stringify({ sql: sql.replace(/LIIGA\.MODEL\./g, ""), binds }));
  });
}
const WAREHOUSE = process.env.LIIGA_WAREHOUSE ?? "LIIGA_WH";

type Row = Record<string, unknown>;
let pool: snowflake.Pool<snowflake.Connection> | null = null;

function options(): snowflake.ConnectionOptions {
  if (fs.existsSync(TOKEN)) {
    return {
      account: process.env.SNOWFLAKE_ACCOUNT!,
      accessUrl: process.env.SNOWFLAKE_HOST ? `https://${process.env.SNOWFLAKE_HOST}` : undefined,
      authenticator: "OAUTH",
      token: fs.readFileSync(TOKEN, "utf8"),
      warehouse: WAREHOUSE,
      database: "LIIGA",
      schema: "MODEL",
    };
  }
  const name = process.env.LIIGA_SNOW_CONNECTION ?? "liiga_ci";
  const file = path.join(os.homedir(), ".snowflake", "connections.toml");
  const conn = (parse(fs.readFileSync(file, "utf8")) as Record<string, Record<string, string>>)[name];
  if (!conn) throw new Error(`Yhteyttä ${name} ei löydy tiedostosta ${file}`);
  const keyPath = (conn.private_key_file ?? conn.private_key_path ?? "").replace(/^~/, os.homedir());
  return {
    account: conn.account,
    username: conn.user,
    role: conn.role,
    authenticator: "SNOWFLAKE_JWT",
    privateKey: fs.readFileSync(keyPath, "utf8"),
    warehouse: conn.warehouse ?? WAREHOUSE,
    database: "LIIGA",
    schema: "MODEL",
  };
}

// Yhteyspooli: yön yli seisonut yhteys katkeaa (Snowflaken istunto vanhenee), ja
// pooli antoi sen silti uudelleen käyttöön -> "Unable to perform operation using
// terminated connection" (17.10.). Siksi: testOnBorrow tarkistaa yhteyden ennen
// lainaa, käyttämättömät poistetaan 10 min jälkeen, ja katkenneen yhteyden virheestä
// pooli puretaan ja kysely yritetään kerran uudelleen tuoreella yhteydellä.
function getPool() {
  pool ??= snowflake.createPool(options(), { max: 8, min: 0, testOnBorrow: true, evictionRunIntervalMillis: 60_000, idleTimeoutMillis: 600_000 });
  return pool;
}
const DEAD = /terminated connection|not connected|session.*(expired|no longer exists)|network error/i;
async function run<T>(sql: string, binds: snowflake.Binds): Promise<T[]> {
  return getPool().use(
    (conn) =>
      new Promise<T[]>((resolve, reject) =>
        conn.execute({ sqlText: sql, binds, complete: (err, _stmt, rows) => (err ? reject(err) : resolve((rows ?? []) as T[])) }),
      ),
  );
}

export async function query<T extends Row = Row>(sql: string, binds: snowflake.Binds = []): Promise<T[]> {
  const t0 = Date.now();
  let out: T[];
  if (DATA_MODE === "duckdb") return duck<T>(sql, binds);
  snowflake.configure({ logLevel: "ERROR" });
  try {
    out = await run<T>(sql, binds);
  } catch (e) {
    if (!DEAD.test(String((e as Error).message))) throw e;
    const old = pool; pool = null;
    old?.drain().then(() => old.clear()).catch(() => {});
    out = await run<T>(sql, binds);
  }
  // Hitaat kyselyt lokiin: sivu odottaa hitainta (16.10.: "mitään ei tapahdu").
  const ms = Date.now() - t0;
  if (ms > 300) console.log(`[sql] ${ms} ms  ${sql.replace(/\s+/g, " ").trim().slice(0, 90)}`);
  return out;
}
