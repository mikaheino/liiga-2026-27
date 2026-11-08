// Avoin kielimalli sovelluksen omassa kontissa (7.11.2026, käyttäjä: "jos me käynnistetään kontti
// applikaatiota varten niin miksei QWEN samalla"). Qwen 2.5 3B (Q4, ~2 Gt) node-llama-cpp:llä samassa
// Node-prosessissa: ei Cortex-kutsua, ei tokenimaksua. Tehtävä on kapea: kysymys -> skenaariorivit
// JSONina kieliopin pakottamana. Selitys ja johtopäätös tulevat koodista (lib/scenarioRules.ts).
// Mitattu 7.11. (Mac, CPU 4 säiettä): lyhyt ohje + esimerkit 6/8 oikein, ~7 s; pitkä Sonnet-ohje 0/5.
// Malli: models/qwen2.5-3b-instruct-q4_k_m.gguf (app.yml lataa käännöksessä) tai LIIGA_QWEN_MODEL.
// Puuttuva malli tai virhe -> null, ja kutsuja käyttää agenttia kuten ennen.
import fs from "node:fs";
import path from "node:path";

type Row = Record<string, unknown>;
const DIR = path.join(process.cwd(), "models");
const MODEL = process.env.LIIGA_QWEN_MODEL
  ?? (fs.existsSync(DIR) ? fs.readdirSync(DIR).filter((f) => /3b.*\.gguf$/i.test(f)).map((f) => path.join(DIR, f))[0] : undefined) ?? "";

const SYS = (teams: string[]) => `Muunna Liiga-kysymys skenaarioriveiksi. Palauta vain JSON {"scenario":[...]}.
Rivityypit:
- tulos: {"team","result":"win|loss|ot|point|regulation","games":N}  (N seuraavaa ottelua; kaikki = 99)
  valinnaiset: "opponent":"<joukkue>" (vain ottelut sitä vastaan), "venue":"home|away" (koti- tai vieraspelit)
- ratkaisevat ottelut: {"stakes_team":"<joukkue>"}  (mitkä pelit ratkaisevat / ovat tärkeimpiä joukkueelle)
- poissaolo: {"injury":"<koko nimi>","games":N}  (kuukausi ≈ 12 ottelua, loppukausi = 99)
- joukkueen tason muutos: {"team","xg_share":d}  (d −0,05…+0,05; pelaajan selvä parannus +0,02, valmentajanvaihto +0,015)
- tavoite: {"team","goal":"top10|top6|win|avoid_relegation"}  (jatkoon = top10, kärkikuusikko = top6, mestaruus/runkosarjan voitto = win, putoaminen = avoid_relegation)
Pelaajan joukkue annetaan PELAAJAT-rivillä. Joukkueet: ${teams.join(", ")}.
Esimerkit:
K: Tappara voittaa viisi seuraavaa -> {"scenario":[{"team":"Tappara","result":"win","games":5}]}
K: Entä jos HIFK:n kaikki pelit menee jatkoajalle seuraavat 4 -> {"scenario":[{"team":"HIFK","result":"ot","games":4}]}
K: Tappara ja Ilves häviävät seuraavat kaksi -> {"scenario":[{"team":"Tappara","result":"loss","games":2},{"team":"Ilves","result":"loss","games":2}]}
K: Ilves saa pisteen kolmesta seuraavasta -> {"scenario":[{"team":"Ilves","result":"point","games":3}]}
K: Mitä jos Pesonen loukkaantuu kahdeksi viikoksi? PELAAJAT: Aleksi Pesonen (Tappara) -> {"scenario":[{"injury":"Aleksi Pesonen","games":6}]}
K: Jos Korhonen ei pelaa enää tällä kaudella PELAAJAT: Jani Korhonen (JYP) -> {"scenario":[{"injury":"Jani Korhonen","games":99}]}
K: Laine alkaa tehdä kaksi maalia per peli PELAAJAT: Eetu Laine (Sport) -> {"scenario":[{"team":"Sport","xg_share":0.02}]}
K: SaiPa erottaa valmentajan -> {"scenario":[{"team":"SaiPa","xg_share":0.015}]}
K: Pääseekö Ässät kärkikuusikkoon? -> {"scenario":[{"team":"Ässät","goal":"top6"}]}
K: Välttääkö KooKoo putoamisen? -> {"scenario":[{"team":"KooKoo","goal":"avoid_relegation"}]}
K: Lukko voittaa kaikki kotipelinsä -> {"scenario":[{"team":"Lukko","result":"win","games":99,"venue":"home"}]}
K: Entä jos Tappara voittaa kaikki pelit Ilvestä vastaan? -> {"scenario":[{"team":"Tappara","result":"win","games":99,"opponent":"Ilves"}]}
K: HIFK häviää kolme seuraavaa vieraspeliä -> {"scenario":[{"team":"HIFK","result":"loss","games":3,"venue":"away"}]}
K: Mitkä pelit ratkaisevat Pelicansin jatkopaikan? -> {"scenario":[{"stakes_team":"Pelicans"}]}
K: Mitkä ovat Kärppien tärkeimmät ottelut? -> {"scenario":[{"stakes_team":"Kärpät"}]}`;

type State = { prompt: (q: string, teams: string[]) => Promise<string> };
const g = globalThis as unknown as { __qwen?: Promise<State | null> };

async function load(): Promise<State | null> {
  if (process.env.LIIGA_LLM === "off" || !MODEL || !fs.existsSync(MODEL)) return null;
  const { getLlama, LlamaChatSession } = await import("node-llama-cpp");
  const llama = await getLlama();
  const model = await llama.loadModel({ modelPath: MODEL });
  const ctx = await model.createContext({ contextSize: 2048 });
  const seq = ctx.getSequence();
  let queue: Promise<unknown> = Promise.resolve();       // yksi kysymys kerrallaan (yksi sekvenssi)
  const grammars = new Map<string, Awaited<ReturnType<typeof llama.createGrammarForJsonSchema>>>();
  const grammar = async (teams: string[]) => {
    const k = teams.join(",");
    if (!grammars.has(k)) {
      const T = { type: "string", enum: teams } as const;
      grammars.set(k, await llama.createGrammarForJsonSchema({ type: "object", required: ["scenario"], properties: { scenario: { type: "array", items: { oneOf: [
        { type: "object", required: ["team", "result", "games"], properties: { team: T, result: { enum: ["win", "loss", "ot", "point", "regulation"] }, games: { type: "integer" }, opponent: T, venue: { enum: ["home", "away"] } } },
        { type: "object", required: ["stakes_team"], properties: { stakes_team: T } },
        { type: "object", required: ["injury", "games"], properties: { injury: { type: "string" }, games: { type: "integer" } } },
        { type: "object", required: ["team", "xg_share"], properties: { team: T, xg_share: { type: "number" } } },
        { type: "object", required: ["team", "goal"], properties: { team: T, goal: { enum: ["top10", "top6", "win", "avoid_relegation"] } } },
      ] } } } } as never));
    }
    return grammars.get(k)!;
  };
  return {
    prompt: (q, teams) => {
      const run = queue.then(async () => {
        seq.clearHistory();
        const s = new LlamaChatSession({ contextSequence: seq, systemPrompt: SYS(teams), autoDisposeSequence: false });
        try { return await s.prompt(q, { grammar: await grammar(teams), maxTokens: 160, temperature: 0 }); } finally { s.dispose({ disposeSequence: false }); }
      });
      queue = run.catch(() => {});
      return run;
    },
  };
}

const state = () => (g.__qwen ??= load().catch((e) => { console.log(`[qwen] ei käytössä: ${(e as Error).message}`); return null; }));

export async function qwenReady(): Promise<boolean> { return !!(await state()); }

/** Mallin lataus muistiin taustalla käynnistyksessä (instrumentation.ts). */
export async function warm(): Promise<void> {
  const t = Date.now();
  if (await state()) console.log(`[qwen] malli muistissa ${Date.now() - t} ms`);
}

/** Kysymys (+ PELAAJAT-rivi koodista) -> skenaariorivit, tai null jos mallia ei ole / tulos ei kelpaa. */
export async function qwenScenario(question: string, players: string, teams: string[]): Promise<Row[] | null> {
  try {
    const st = await state();
    if (!st) return null;
    const t = Date.now();
    const out = await st.prompt(players ? `${question} PELAAJAT: ${players}` : question, teams);
    const items = (JSON.parse(out) as { scenario?: Row[] }).scenario ?? [];
    console.log(`[qwen] ${Date.now() - t} ms: ${JSON.stringify(items)}`);
    return items.length ? items.map((x) => (x.injury != null && x.games === 99 ? { injury: x.injury, until: "2027-04-30" } : x)) : null;
  } catch (e) {
    console.log(`[qwen] virhe: ${(e as Error).message}`);
    return null;
  }
}
