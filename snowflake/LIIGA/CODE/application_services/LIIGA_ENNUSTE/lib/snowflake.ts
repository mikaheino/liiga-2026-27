// Snowflake-kyselyt samalla koodilla paikallisesti ja App Runtimessa.
//
//   App Runtime: palvelun sessiotoken /snowflake/session/token (OAuth), tili ja
//                isäntä ympäristömuuttujista, jotka Snowflake asettaa.
//   Paikallisesti: ~/.snowflake/connections.toml, yhteys LIIGA_SNOW_CONNECTION
//                (oletus liiga_ci = palvelukäyttäjä avainparilla). Ei selainta.
//
// Molemmat lukevat samat taulut (LIIGA.MODEL), joten paikallinen kehitys näyttää
// täsmälleen saman datan kuin tuotanto -- ero Streamlitin DuckDB-polkuun.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parse } from "smol-toml";
import snowflake from "snowflake-sdk";

const TOKEN = "/snowflake/session/token";
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

export async function query<T extends Row = Row>(sql: string, binds: snowflake.Binds = []): Promise<T[]> {
  snowflake.configure({ logLevel: "ERROR" });
  pool ??= snowflake.createPool(options(), { max: 8, min: 1 });
  const t0 = Date.now();
  const out = await pool.use(
    (conn) =>
      new Promise<T[]>((resolve, reject) =>
        conn.execute({
          sqlText: sql,
          binds,
          complete: (err, _stmt, rows) => (err ? reject(err) : resolve((rows ?? []) as T[])),
        }),
      ),
  );
  // Hitaat kyselyt lokiin: sivu odottaa hitainta (16.10.: "mitään ei tapahdu").
  const ms = Date.now() - t0;
  if (ms > 300) console.log(`[sql] ${ms} ms  ${sql.replace(/\s+/g, " ").trim().slice(0, 90)}`);
  return out;
}
