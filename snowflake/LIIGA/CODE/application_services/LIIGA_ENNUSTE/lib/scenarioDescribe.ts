// "Kuvaile skenaario omin sanoin" -> moottorin kanoniset rivit (6.11.2026, docs/claude/skenaario.md
// J1/V5). Yhteinen kertakutsulle (app/api/skenaario/kuvaile) ja live-striimille
// (app/api/skenaario/rakenna, 7.11.2026: "AI rakentaa livenä skenaarion, mutta hyödyntää SQL
// dataa ja koneoppimismalleja").
// Agentti (Snowflakessa Cortex LIIGA_ENNUSTAJA, paikallisesti Claude MCP:llä) hoitaa kielen ja
// hakee tarvittaessa dataa (liiga_kausi / liiga_ennuste = Cortex Analyst -> SQL; paikallisesti
// DuckDB-tilannekuva). Se kutsuu liiga_skenaario-työkalua (sama moottori ja malli kuin
// ennusteessa); sovellus lukee kutsun syötteen ja ratkaisee sen moottorilla kanonisiksi
// riveiksi (sirut). Luvut tulevat aina moottorista, eivät agentilta.
import { askOnce, type Answer } from "@/lib/agent";
import { loadFixtures, loadPlayers, loadTeams } from "@/lib/data";
import { runEngine } from "@/lib/scenarioEngine";
import { DATA_MODE, query } from "@/lib/snowflake";
import { activeAbsences, headlines, injuryHints, type NewsAbsence, type NewsHint } from "@/lib/newsContext";
import { missingPlayers, queueRoster } from "@/lib/rosterQueue";
import { qwenScenario } from "@/lib/qwen";
import { continuity, mergeRows, goalieAll, goalieItems, normalize, playersIn, playersRule, SEASON_END, withNews } from "@/lib/scenarioRules";
import { parseScenario } from "@/lib/scenarioParse";
import { MAX_ITEMS } from "@/lib/scenarioItems";

// chart = agentin valitsema kuvaaja (7.11.2026: "agentti valitsee itse"); null = ei kuvaajaa.
export type Chart = { type: "pisteet" | "jakauma" | "ottelut"; team?: string } | null;
// news = skenaariossa mukana olevat uutisista hyväksytyt poissaolot (rivien labelit).
// roster = pelaajat, joita mallin rosterissa ei ole ja jotka kirjattiin rosterijonoon (lib/rosterQueue.ts).
export type Described = { answer: string; items: Record<string, unknown>[]; tools: string[]; sql: string[]; error?: string; status?: number; chart?: Chart;
  news?: string[]; roster?: string[];
  /** Jatkon omat rivit (13.11.2026): johtopäätös puhuu juuri lisätystä, ei koko skenaarion yleisimmästä joukkueesta. */
  focus?: Record<string, unknown>[] };

// Agentin viimeinen rivi "KUVAAJA: <tyyppi> [joukkue]" luetaan ja poistetaan näkyvästä tekstistä.
const CHART_LINE = /\n?\s*KUVAAJA:\s*(pisteet|jakauma|ottelut|ei)\b\s*([^\n]*)\s*$/i;
// Paikallisen Clauden yleisohje lisää loppuun sovelluslinkin; hakusivulla se on turha.
const APP_LINK = /\n?\s*Lisää sovelluksessa:[^\n]*/gi;
export function splitChart(raw: string): { text: string; chart: Chart } {
  // Markdown-taulukot pois (ohje kieltää, mutta agentti tekee joskus): sovellus näyttää luvut itse.
  const text = raw.replace(APP_LINK, "").split("\n").filter((l) => !/^\s*\|.*\|\s*$/.test(l)).join("\n").replace(/\n{3,}/g, "\n\n");
  const m = CHART_LINE.exec(text);
  if (!m) return { text: text.replace(/\n?\s*KUVAAJA:[^\n]*$/i, "").trimEnd(), chart: undefined as unknown as Chart };
  const type = m[1].toLowerCase();
  return { text: text.slice(0, m.index).trimEnd(), chart: type === "ei" ? null : { type: type as "pisteet", ...(m[2].trim() ? { team: m[2].trim() } : {}) } };
}

const RULE = (today: string, teams: string[]) => `TEHTÄVÄ: Käyttäjä kuvaa Liigan kauden 2026-27 skenaarion omin sanoin. Rakenna siitä liiga_skenaario-työkalun skenaario ja kutsu työkalua täsmälleen kerran.
- Tänään on ${today}. Joukkueiden tarkat nimet: ${teams.join(", ")}.
- Nojaa dataan: jos kuvaus riippuu otteluohjelmasta, vastustajista, sarjatilanteesta tai pelaajista, hae ne ensin datatyökaluilla (esim. jäljellä olevat ottelut tai joukkueen nykyinen sija), älä arvaa.
- Ottelut: {"team", "result": win|loss|reg_win|ot_win|ot_loss|reg_loss|ot|point|regulation} (ot = menee jatkoajalle, kumpi tahansa voittaa; point = joukkue saa vähintään pisteen eli voittaa tai häviää jatkoajalla; regulation = ratkeaa varsinaisella peliajalla) ja joko "games": N (seuraavat N) tai jakso "from"/"until" (YYYY-MM-DD, until mukaan lukien), valinnainen "opponent".
- Yksittäinen ottelu: {"team", "result", "from": "<pvm>", "until": "<sama pvm>"}. Näin saa myös epäsäännölliset kuviot, esim. "joka toinen ottelu" = lukitse joka toinen alla listatuista OTTELUOHJELMA-riveistä (koko loppukausi listattu; enintään 64 riviä). Ellei käyttäjä rajaa jaksoa, kuvio koskee koko loppukautta.
- Mallin säätö (kokeiluversio, virallinen ennuste ei muutu): {"model": {"poisson_weight": 0..1 (pelaajamallin osuus, nyt 0,4; loput Elo), "home_ice": 0,9..1,3 (nyt 1,08), "league_avg": 2..4 (maalitaso, nyt 2,9), "ot_scale": 0,5..1,6 (jatkoaikojen yleisyys, 1 = nykyinen), "ot_lean": 0,4..0,7 (suosikin jatkoaikavoitto, nyt 0,52), "strength": {"<joukkue>": {"off": 0,6..1,4, "def": 0,6..1,4}} (hyökkäys- ja puolustuskerroin, def < 1 = parempi puolustus)}}. Käytä, kun käyttäjä haluaa muuttaa itse mallia ("painota Eloa", "entä jos kotietua ei olisi", "maaleja tehdään enemmän").
- Poissaolo: {"injury": "<pelaajan nimi>", "games": N | "until": "YYYY-MM-DD"}. Tavoite: {"team", "goal": avoid_relegation|top6|top10|win}.
- Joukkueen muutos (valmentajanvaihto, iso hankinta, muotonotkahdus, kaikki mikä muuttaa joukkueen tasoa eikä yksittäistä tulosta): {"team", "xg_share": d, "from"?: "YYYY-MM-DD", "until"?, "games"?}, d = joukkueen maaliodottamien osuuden muutos (−0,15…+0,15; +0,05 = osuus nousee 5 prosenttiyksikköä). Valitse d datasta (esim. alla oleva VALMENTAJANVAIHDOT-näyttö) ja kerro oletus yhdellä lauseella.
- Yleiset ilmaukset tulkitaan näin (ei tarkennusta): "joulun yli" = from 2026-12-20 until 2027-01-06; "loppukausi" / "kaikki loput" = kaikki jäljellä olevat ottelut (from tänään); "ensi viikolla" = seuraavat 7 päivää.
- Sovelluksen pitää toimia kenelle tahansa: ÄLÄ kysy tarkennusta, kun järkevä oletus on olemassa; puuttuvat kestot sovellus täydentää itse (lib/scenarioRules.ts). Pelkkä kysymys ilman muutosta ("pääseekö Kärpät jatkoon?") -> kutsu työkalua tavoitteella (goal). Kysy vain, jos kuvauksesta ei saa mitään järkevää skenaariota.
- ÄLÄ kirjoita johtopäätöstä äläkä aloita luvuilla: sovellus kirjoittaa ensimmäisen lauseen moottorin luvuista. Kirjoita 1–2 lausetta: miten tulkitsit kuvauksen, mihin dataan nojasit, ketkä muut hyötyvät tai kärsivät eniten ja mitä malli teki muille otteluille, jos lukitsit vain osan kaudesta.
- Sävy (käyttäjä 7.11.: "hellävarainen skenaarioemulaattori"): lempeä ja selkokielinen, kuin selittäisit ystävälle, joka ei ole analyytikko. Vältä ammattisanoja tai selitä ne heti (esim. "xG-osuus eli kuinka suuren osan maalipaikoista joukkue saa"). Ei liioittelua, ei pelottelua; epävarmuus sanotaan rauhallisesti ("malli arvioi", "todennäköisesti"). Älä laske lukuja itse. Kirjoita pelkkää tekstiä: ei taulukoita, ei listoja, ei otsikoita (sovellus näyttää luvut itse). Älä kirjoita JATKO-riviä.`;

// Valmentajanvaihtojen näyttö (7.11.2026, käyttäjä kysyi "Kärpät vaihtavat valmentajaa"): tämän
// kauden vaihdot ja joukkueen pisteet/ottelu sekä xG-osuus ennen ja jälkeen, haun hetkellä
// datasta. Agentti valitsee tästä joukkueen muutoksen (xg_share) ja kertoo oletuksen.
const COACH_WORDS = /valmentaj|valmentaa|coach|päävalm|potku/i;
async function coachingEvidence(): Promise<string> {
  const M = "LIIGA.MODEL";
  const rows = await query(`
    WITH tg AS (
      SELECT SUBSTR(start_ts, 1, 10) AS d, home_team AS team, home_points AS pts, home_xg AS xf, away_xg AS xa
      FROM ${M}.STG_GAMES WHERE ended AND season = (SELECT MAX(season) FROM ${M}.STG_GAMES)
      UNION ALL
      SELECT SUBSTR(start_ts, 1, 10), away_team, away_points, away_xg, home_xg
      FROM ${M}.STG_GAMES WHERE ended AND season = (SELECT MAX(season) FROM ${M}.STG_GAMES))
    SELECT c.team, CAST(c.change_date AS VARCHAR) AS change_date, c.coach_out, c.coach_in,
           SUM(CASE WHEN tg.d < CAST(c.change_date AS VARCHAR) THEN 1 ELSE 0 END) AS n_before,
           SUM(CASE WHEN tg.d >= CAST(c.change_date AS VARCHAR) THEN 1 ELSE 0 END) AS n_after,
           AVG(CASE WHEN tg.d < CAST(c.change_date AS VARCHAR) THEN tg.pts END) AS ppg_before,
           AVG(CASE WHEN tg.d >= CAST(c.change_date AS VARCHAR) THEN tg.pts END) AS ppg_after,
           SUM(CASE WHEN tg.d < CAST(c.change_date AS VARCHAR) THEN tg.xf END) / NULLIF(SUM(CASE WHEN tg.d < CAST(c.change_date AS VARCHAR) THEN tg.xf + tg.xa END), 0) AS xg_before,
           SUM(CASE WHEN tg.d >= CAST(c.change_date AS VARCHAR) THEN tg.xf END) / NULLIF(SUM(CASE WHEN tg.d >= CAST(c.change_date AS VARCHAR) THEN tg.xf + tg.xa END), 0) AS xg_after
    FROM ${DATA_MODE === "duckdb" ? "coaching_changes" : `${M}.V_COACHING_CHANGES`} c JOIN tg ON tg.team = c.team
    WHERE c.season = (SELECT MAX(season) FROM ${M}.STG_GAMES)
    GROUP BY c.team, c.change_date, c.coach_out, c.coach_in ORDER BY change_date`).catch(() => []);
  if (!rows.length) return "";
  const f = (x: unknown, d = 2) => (x == null ? "?" : Number(x).toFixed(d).replace(".", ","));
  const deltas = rows.filter((r) => r.XG_BEFORE != null && r.XG_AFTER != null).map((r) => Number(r.XG_AFTER) - Number(r.XG_BEFORE));
  const avg = deltas.length ? deltas.reduce((a, b) => a + b, 0) / deltas.length : null;
  return [`VALMENTAJANVAIHDOT TÄLLÄ KAUDELLA (data; p/ott ja xG-osuus ennen -> jälkeen):`,
    ...rows.map((r) => `- ${r.TEAM} ${r.CHANGE_DATE}: ${r.COACH_OUT} -> ${r.COACH_IN}; p/ott ${f(r.PPG_BEFORE)} -> ${f(r.PPG_AFTER)}, xG-osuus ${f(100 * Number(r.XG_BEFORE), 1)} % -> ${f(100 * Number(r.XG_AFTER), 1)} % (${r.N_BEFORE} / ${r.N_AFTER} ottelua)`),
    avg != null ? `Keskimääräinen xG-osuuden muutos ${deltas.length} vaihdossa: ${avg >= 0 ? "+" : ""}${f(100 * avg, 1)} %-yks. Otokset ovat pieniä ja heikon alun jälkeen paluu keskitasolle on tavallista, joten käytä tätä ylärajana ja kerro se.` : "",
  ].filter(Boolean).join("\n");
}

// Kuvauksessa mainittujen joukkueiden seuraavat ottelut (7.11.2026): ilman niitä agentti ei
// voinut rakentaa kuviota kuten "joka toinen peli" (tilannekuvassa vain liigan 16 seuraavaa).
const DAY = (ts: string) => new Date(ts).toLocaleDateString("sv-SE", { timeZone: "Europe/Helsinki" });
// Lempinimet ja kotikaupungit (7.11.: "Pelsut" ei osunut Pelicansiin, jolloin agentti näki vain
// liigan 16 seuraavaa ottelua). Osuma sanan alusta, joten taivutusmuodot (Pelsuille, Lahdessa) käyvät.
const ALIAS: Record<string, string[]> = {
  HIFK: ["ifk", "stadi", "helsinki"], HPK: ["hämeenlinna", "hämeenlinn"], Ilves: ["ilve", "tampereen ilves"], JYP: ["jyväskylä", "jyväskyl"],
  Jokerit: ["jokke", "jokere"], Jukurit: ["jukure", "mikkeli"], "K-Espoo": ["espoo", "kiekko-espoo", "k-espoo"], KalPa: ["kuopio"],
  KooKoo: ["kouvola", "kookoo"], "Kärpät": ["kärpi", "oulu"], Lukko: ["raum", "lukko"], Pelicans: ["pelsu", "pelikaan", "lahti", "lahde", "lahte"],
  SaiPa: ["lappeenran", "saipa"], Sport: ["vaasa", "vaasan"], TPS: ["turku", "turu"], Tappara: ["tapsa", "tappara"], "Ässät": ["pori", "ässi", "ässä"],
};
function namedTeams(text: string, teams: string[]): string[] {
  const low = text.toLowerCase();
  const hit = (w: string) => new RegExp(`(^|[^a-zåäö])${w.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&")}`).test(low);
  return teams.filter((t) => hit(t.toLowerCase()) || (ALIAS[t] ?? []).some(hit));
}
async function schedule(text: string, teams: string[]): Promise<string> {
  const named = namedTeams(text, teams);
  if (!named.length) return "";
  const coming = (await loadFixtures()).filter((f) => !f.ended);
  return named.map((t) => `OTTELUOHJELMA ${t} (koko loppukausi):\n` + coming.filter((f) => f.home === t || f.away === t)
    .map((f, i) => `${i + 1}. ${DAY(f.start_ts)} ${f.home}–${f.away} (${f.home === t ? "koti" : "vieras"})`).join("\n")).join("\n\n");
}

// Skenaario skenaarion päälle (7.11.2026, käyttäjä: "skenaario skenaarion päälle tarvitaan"):
// pohja = selaimen nykyinen skenaario moottorin kanonisina riveinä (palvelin on tarkistanut ne).
// Agentti ottaa ne mukaan sellaisinaan, jolloin sen tekstin luvut koskevat koko yhdistelmää.
// Ei nappeja (käyttäjä 7.11.: "Ei mitään nappeja, vaan tietoisuus"): agentti päättää itse, jatkaako
// se nykyistä skenaariota vai aloittaako uuden, ja sanoo valintansa yhteenvedon alussa.
const BASE_RULE = (base: Record<string, unknown>[], labels: string[]) => `NYKYINEN SKENAARIO (käyttäjällä auki juuri nyt):
${labels.map((l) => `- ${l}`).join("\n")}
Samat rivit moottorin muodossa: ${JSON.stringify(base)}
Käyttäjä JATKAA aina tätä skenaariota (13.11.2026: uusi skenaario aloitetaan vain käyttöliittymän Uusi skenaario -napilla, ei koskaan kuvauksella):
- Ota nämä rivit liiga_skenaario-kutsuun SELLAISINAAN ja lisää uudet. Muuta tai poista nykyinen rivi vain, jos käyttäjä pyytää sitä tai uusi rivi koskee samaa ottelua tai pelaajaa (uusi korvaa vanhan).
- Kerro TOISESSA lauseessa (ensimmäinen on aina johtopäätös), mitä lisäsit nykyiseen skenaarioon. Luvut koskevat aina sitä skenaariota, jonka työkalu laski.`;

// Uutiset (lib/newsContext.ts): hyväksytyt poissaolot ovat lähtötilanne kysytyille joukkueille,
// hyväksymättömät uutiset vain mainitaan. Otsikot tulevat erikseen (headlines(), 7.11.).
const NEWS_RULE = (abs: NewsAbsence[], hints: NewsHint[]) => [
  abs.length ? `UUTISISTA HYVÄKSYTYT POISSAOLOT (tosiasioita, lähtötilanne):\n${abs.map((a) => `- ${a.player} (${a.team}) poissa ${a.until} asti`).join("\n")}
Sovellus lisää nämä skenaarioon itse (ellei käyttäjä sano "ilman X" / "ilman uutisia"); sinun ei tarvitse. Jos ne vaikuttavat kysyttyyn joukkueeseen, voit mainita lyhyesti, että ne on huomioitu.` : "",
  hints.length ? `UUTISVIHJEET (EI hyväksytty, älä lisää skenaarioon ilman pyyntöä):\n${hints.map((h) => `- ${h.player} (${h.team}): ${h.kind}uutinen`).join("\n")}
Mainitse kysytyn joukkueen vihjeet yhdellä lauseella lopussa: "Uutisten mukaan X saattaa olla sivussa; sitä ei ole huomioitu – kirjoita 'X poissa', niin lasken sen mukaan."` : "",
].filter(Boolean).join("\n\n");

/** "Mitkä pelit ratkaisevat X:n ...": joukkueen 5 ottelua, joiden tulos liikuttaa sen avointa tavoitetta eniten. */
async function stakesAnswer(team: string, by = "qwen"): Promise<Described> {
  type Stake = { date: string; home: string; away: string; top: { goal: string; p_now: number; p_home_win: number; p_away_win: number } };
  const r = await runEngine<{ stakes?: Stake[]; error?: string }>("json", [{ stakes: { team, top: 5 } }]).catch((e) => ({ error: (e as Error).message } as { error: string; stakes?: Stake[] }));
  if (r.error || !r.stakes?.length) return { answer: "", items: [], tools: ["panokset"], sql: [], error: r.error ?? "ei otteluita", status: 422 };
  const GOAL: Record<string, string> = { top10: "jatkopaikan", top6: "kärkikuusikon", win: "runkosarjan voiton", avoid_relegation: "sarjapaikan" };
  const pc = (x: number) => `${(100 * x).toFixed(0)} %`;
  const g = GOAL[r.stakes[0].top.goal] ?? "tavoitteen";
  const rows = r.stakes.map((s) => {
    const home = s.home === team, win = home ? s.top.p_home_win : s.top.p_away_win, loss = home ? s.top.p_away_win : s.top.p_home_win;
    return `${s.date} ${s.home}–${s.away}: voitolla ${pc(win)}, tappiolla ${pc(loss)}`;
  });
  return { answer: `${team}: ${g} todennäköisyys on nyt ${pc(r.stakes[0].top.p_now)}. Eniten sitä liikuttavat nämä ottelut:\n${rows.join("\n")}`,
    items: [], tools: [by, "panokset"], sql: [] };
}

export async function describe(text: string, progress?: Parameters<typeof askOnce>[2],
  pohja: { items: Record<string, unknown>[]; labels: string[] } | null = null, forced: Record<string, unknown>[] | null = null,
  engine: "qwen" | "cortex" = "qwen"): Promise<Described> {
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Helsinki" });
  const teams = await loadTeams();
  const sched = await schedule(`${text} ${pohja?.labels.join(" ") ?? ""}`, teams);
  const coach = COACH_WORDS.test(text) ? await coachingEvidence() : "";
  const scope = namedTeams(`${text} ${pohja?.labels.join(" ") ?? ""}`, teams);
  const [absAll, hints, heads] = await Promise.all([activeAbsences(today), injuryHints(scope, today), headlines(scope, today)]);
  const abs = absAll.filter((a) => scope.includes(a.team));
  const news = NEWS_RULE(abs, hints) + (heads.length ? `\n\nUUTISOTSIKOT (14 pv, kysymyksen joukkueet; taustaksi, ei faktaa skenaarioon ellei käyttäjä pyydä):\n${heads.map((h) => `- ${h.date} ${h.team}${h.flags ? ` [${h.flags}]` : ""}: ${h.title}${h.summary ? ` – ${h.summary}` : ""}`).join("\n")}` : "");
  // Uusi pelaaja, jota mallissa ei vielä ole: agentti arvioi joukkuetasolla ja kertoo jonosta.
  const missing = await missingPlayers(text, teams).catch(() => []);
  const rosterRule = missing.length ? `PELAAJA EI VIELÄ MALLIN ROSTERISSA: ${missing.map((m) => `${m.name}${m.team ? ` (${m.team})` : ""}`).join(", ")}.
Älä yritä poissaoloa hänelle. Mallinna hänen vaikutuksensa joukkueen muutoksena (xg_share): tavallinen hankinta +0,005…+0,015, tähtipelaaja enintään +0,03, ja kerro oletus. Kerro lempeästi yhdellä lauseella, että pelaaja ei ole vielä mallissa ja että hänet on kirjattu rosterijonoon: kun hänet lisätään standardipolulla, haku lasketaan hänen omilla tilastoillaan.` : "";
  const pl = await loadPlayers().catch(() => ({ skaters: [], goalies: [] }));
  const gAll = goalieAll(text, pl.goalies);
  const ps = playersIn(`${text} ${pohja?.labels.join(" ") ?? ""}`, [...pl.skaters, ...pl.goalies]);
  const playerRule = playersRule(ps);
  const goalieRule = gAll ? `MAALIVAHTI: ${gAll.goalie.name} on joukkueen ${gAll.goalie.team} maalivahti. Joukkueen muut vahdit: ${gAll.others.join(", ")}. "Pelaa kaikki loput" = muut vahdit poissa loppukauden: ${JSON.stringify(goalieItems(gAll))}. Käytä tätä, älä kysy joukkuetta.` : "";
  const ctx = RULE(today, teams) + (pohja?.items.length ? `\n\n${BASE_RULE(pohja.items, pohja.labels)}` : "") + (sched ? `\n\n${sched}` : "") + (coach ? `\n\n${coach}` : "") + (news ? `\n\n${news}` : "") + (rosterRule ? `\n\n${rosterRule}` : "") + (goalieRule ? `\n\n${goalieRule}` : "") + (playerRule ? `\n\n${playerRule}` : "");
  // "Moottori ei hyydy koskaan" (käyttäjä 7.11.2026): agentin kaatuminen yritetään uudelleen,
  // moottorin hylkäämä skenaario palautetaan agentille korjattavaksi kerran, ja jos kumpikaan ei
  // auta, vastataan kysyttyjen joukkueiden nykyennusteella (moottori laskee, syy kerrotaan).
  const ask = async (extra = ""): Promise<Answer> => {
    try { return await askOnce(text, ctx + extra, progress); } catch (e) {
      progress?.({ status: "Yhteys katkesi, yritetään uudelleen" });
      console.log(`[skenaario] agentti, uusi yritys: ${(e as Error).message}`);
      return askOnce(text, ctx + extra, progress);
    }
  };
  // Skenaariossa jo olevien rivien labelit: uutispoissaoloa ei lisätä toista kertaa (withNews).
  let known: string[] = pohja?.labels ?? [];
  const attempt = async (a: Answer): Promise<Described> => {
    const sc = splitChart(a.text);
    const base = { answer: sc.text, tools: a.tools, sql: a.sql, chart: sc.chart };
    const call = [...a.inputs].reverse().find((i) => i.name === "liiga_skenaario");
    const raw = typeof call?.input?.scenario === "string" ? call.input.scenario : null;
    // Maalivahtisääntö koodina: jos agentti ei rakentanut skenaariota, rivit tulevat datasta.
    const fromCode = !raw && gAll ? JSON.stringify(goalieItems(gAll)) : null;
    if (!raw && !fromCode) return { ...base, items: [] };
    if (fromCode) base.answer = `${gAll!.goalie.name} pelaa kaikki loput ottelut (${gAll!.goalie.team}), eli ${gAll!.others.join(" ja ")} ei pelaa loppukaudella.`;
    let parsed: unknown;
    try { parsed = JSON.parse(raw ?? fromCode!); } catch { return { ...base, items: [], error: "agentin skenaario ei ollut JSONia", status: 422 }; }
    // Vain lukitukset, poissaolot, tavoitteet ja joukkueen muutokset siruiksi; panospyyntöjä ei.
    // Säännöt koodina (lib/scenarioRules.ts): oletuskestot ja uutisten hyväksytyt poissaolot.
    const list = withNews(normalize((Array.isArray(parsed) ? parsed : [parsed])
      .filter((x) => x && typeof x === "object" && !("stakes" in (x as object))) as Record<string, unknown>[]), abs, text, known);
    progress?.({ status: "Moottori ratkaisee skenaarion otteluiksi" });
    const res = await runEngine<{ scenario_canonical?: Record<string, unknown>[] }>("json", list).catch((e) => ({ error: (e as Error).message } as { error: string; scenario_canonical?: undefined }));
    if (res.error) return { ...base, items: [], error: res.error, status: 422 };
    const items = res.scenario_canonical ?? [];
    // Sama raja kuin omassa skenaariossa (lib/scenarioItems.ts MAX_ITEMS): ei katkaista hiljaa.
    if (items.length > MAX_ITEMS) {
      return { ...base, items: [], status: 422,
        error: `Skenaariossa on ${items.length} riviä (esim. lukittua ottelua); enintään ${MAX_ITEMS}. Rajaa jaksoa tai otteluiden määrää.` };
    }
    const newsUsed = items.filter((i) => "injury" in i && abs.some((x) => String(i.label ?? "").includes(x.player))).map((i) => String(i.label));
    return { ...base, items, news: newsUsed };
  };
  // Varavastaus: nykyennuste kysytyille joukkueille tavoiterivillä (goal ei muuta ennustetta).
  const fallback = async (why: string): Promise<Described> => {
    const goals = scope.slice(0, 3).map((t) => ({ team: t, goal: "top10" }));
    if (!goals.length) return { answer: "", items: [], tools: [], sql: [], error: why, status: 422 };
    progress?.({ status: "Lasketaan nykyennuste" });
    const res = await runEngine<{ scenario_canonical?: Record<string, unknown>[]; teams?: Record<string, number | string>[] }>("json", goals)
      .catch((e) => ({ error: (e as Error).message } as { error: string }));
    if ("error" in res && res.error) return { answer: "", items: [], tools: [], sql: [], error: `${why} (${res.error})`, status: 422 };
    const r = res as { scenario_canonical?: Record<string, unknown>[]; teams?: Record<string, number | string>[] };
    const pc = (x: unknown) => `${(100 * Number(x)).toFixed(1).replace(".", ",")} %`;
    const lines = scope.slice(0, 3).map((t) => r.teams?.find((x) => x.team === t)).filter(Boolean)
      .map((x) => `${x!.team}: jatkoon ${pc(x!.p_top10_now)}, kärkikuusikkoon ${pc(x!.p_top6_now)}, putoamisuhka ${pc(x!.p_relegation_now)}.`);
    return { answer: `En pystynyt mallintamaan kuvausta sellaisenaan (${why}), joten tässä nykyennuste. ${lines.join(" ")} Voit tarkentaa kuvausta, niin lasken skenaarion.`,
      items: r.scenario_canonical ?? [], tools: ["liiga_skenaario"], sql: [], chart: { type: "jakauma", team: scope[0] } };
  };

  const queued = (await queueRoster(missing, text)).map((m) => `${m.name}${m.team ? ` (${m.team})` : ""}`);
  const withRoster = (d: Described): Described => (queued.length ? { ...d, roster: queued } : d);
  // Oma kielimalli ensin (7.11.2026, Qwen 3B sovelluskontissa, lib/qwen.ts): uusi kysymys -> koodin
  // säännöt (maalivahti pelaa kaikki) tai Qwen -> moottori. Selitys koodista. Jatkokysymys (pohja) ja
  // kaikki, mitä Qwen ei osaa, menevät agentille kuten ennen.
  // Jatkokysymys (7.11.: "jatkokysymyksiä aina jatkokeskustelussa"): valmis lähiskenaario (forced) ajetaan
  // sellaisenaan; oma jatkokysymys menee Qwenille, jos se nimeää joukkueen tai pelaajan eikä viittaa
  // edelliseen ("hän", "tämä"); "lisäksi/myös/vielä" lisää rivit edellisen skenaarion päälle.
  const own = /JATKOKYSYMYS: ([\s\S]*)$/.exec(text)?.[1]?.trim() ?? text;
  const contin = !!pohja?.items.length;
  const refers = /\b(hän|häne|tämä|tästä|tätä|sama|edelli|sen |niiden)/i.test(own);
  const selfContained = namedTeams(own, teams).length > 0 || playersIn(own, [...pl.skaters, ...pl.goalies]).length > 0;
  if (forced?.length || !contin || (selfContained && !refers)) {
    progress?.({ status: "Tulkitaan kysymys" });
    // Säännöt -> Qwen -> agentti (13.11.2026, lib/scenarioParse.ts): kiinteät kaavat ("X voittaa kolme
    // seuraavaa", "Pääseekö X jatkoon?", "Y loukkaantuu viikoksi") jäsennetään koodilla heti; muu Qwenille.
    // Cortex-valinta ohittaa molemmat (moottorien vertailu). 99 = loppukausi -> paluupäivä kuten Qwenilla.
    const parsed = forced?.length || gAll || engine === "cortex" ? null : parseScenario(own, teams, [...pl.skaters, ...pl.goalies]);
    if (parsed) console.log(`[säännöt] ${JSON.stringify(parsed)}`);
    let qi = forced?.length ? forced : gAll ? goalieItems(gAll)
      : parsed ? parsed.map((x) => (x.injury != null && x.games === 99 ? { injury: x.injury, until: SEASON_END } : x))
      : engine === "cortex" ? null : await qwenScenario(own, ps.map((p) => `${p.name} (${p.team})`).join(", "), teams);
    // Qwen keksii joskus muita joukkueita (7.11.: "lisäksi Lukko häviää" -> myös Ässät ja Pelicans): vain
    // kysymyksessä nimetyt joukkueet ja pelaajat (sekä pelaajien joukkueet) kelpaavat. Sääntöjen rivit
    // ohittavat suodattimen: ne syntyvät vain kysymyksen sanoista (ja namedTeams ei tunne esim. "Kärppien").
    if (qi && !forced?.length && !gAll && !parsed) {
      const psOwn = playersIn(own, [...pl.skaters, ...pl.goalies]);
      const ok = new Set([...namedTeams(own, teams), ...psOwn.map((p) => p.team)]);
      const names = psOwn.map((p) => p.name.toLowerCase());
      qi = qi.filter((x) => (x.injury != null ? names.some((n) => n.includes(String(x.injury).toLowerCase().split(" ").slice(-1)[0])) : ok.has(String(x.team ?? x.stakes_team))));
      // Qwen täyttää valinnaisia kenttiä esimerkeistä (8.11.: "kaikki kotipelinsä" -> vastustaja Ilves):
      // vastustaja vain, jos se on nimetty, kenttä vain, jos kysymyksessä on koti-/vieras-sana.
      const named = new Set(namedTeams(own, teams));
      const venueOk = /\b(koti|vieras|vierai)/i.test(own);
      qi = qi.map((x) => {
        const y = { ...x };
        if (y.opponent != null && (!named.has(String(y.opponent)) || y.opponent === y.team)) delete y.opponent;
        if (y.venue != null && !venueOk) delete y.venue;
        return y;
      });
      if (!qi.length) qi = null;
    }
    // Ratkaisevat ottelut (8.11.2026, markkinaidea "Potential Impact"): moottorin panokset ja vastaus koodista.
    const st = qi?.find((x) => x.stakes_team != null);
    if (st) return withRoster(await stakesAnswer(String(st.stakes_team), parsed ? "säännöt" : "qwen"));
    // Kirjoitettu jatko lisätään AINA nykyisen skenaarion päälle (13.11.2026, omistaja: "uusi skenaario tulee
    // Uusi-napilla. Skenaariota voi jatkaa teknisesti ja sanallisesti päälle"); ennen vain sanalla "lisäksi",
    // ja muuten käsin rakennettu skenaario korvautui. Uudet rivit ratkaistaan ensin yksin otteluiksi, jotta
    // sama ottelu tai pelaaja korvaa vanhan rivin (mergeRows) eikä moottori hylkää ristiriitaa.
    const appended = !!qi && !forced?.length && contin;
    let added: Record<string, unknown>[] | null = null;      // jatkon omat rivit: johtopäätös puhuu niistä
    if (appended) {
      const alone = await attempt({ text: "", suggestions: [], tools: [], sql: [], ms: 0, source: "local",
        inputs: [{ name: "liiga_skenaario", input: { scenario: JSON.stringify(qi) } }] });
      if (alone.error || !alone.items.length) { console.log(`[skenaario] jatko hylätty: ${alone.error ?? "ei rivejä"}`); qi = null; }
      else {
        qi = mergeRows(pohja!.items, alone.items.map(({ label: _l, ...x }) => x));
        known = [...known, ...alone.items.map((i) => String(i.label ?? ""))];
        added = alone.items.filter((i) => !alone.news?.includes(String(i.label ?? "")));
      }
    }
    if (qi) {
      const d = await attempt({ text: "", suggestions: [], tools: [forced?.length ? "lähiskenaario" : gAll || parsed ? "säännöt" : "qwen"], sql: [], ms: 0, source: "local",
        inputs: [{ name: "liiga_skenaario", input: { scenario: JSON.stringify(qi) } }] });
      if (d.error) console.log(`[skenaario] oma tulkinta hylätty: ${d.error}`);
      if (!d.error && d.items.length) {
        const labels = d.items.map((i) => String(i.label ?? "")).filter((l) => l && !d.news?.includes(l));
        const fromNews = d.news?.length ? ` Uutisista mukana hyväksytyt poissaolot: ${d.news.join("; ")}.` : "";
        return withRoster({ ...d, ...(added ? { focus: added } : {}), answer: [continuity(pohja?.items.length ?? 0, appended, d.items.length),
          `Tulkitsin kysymyksen näin: ${labels.join("; ")}.${fromNews}`].filter(Boolean).join(" ") });
      }
    }
  }
  let first: Described;
  try { first = withRoster(await attempt(await ask())); } catch (e) { return fallback(`agentti ei vastannut: ${(e as Error).message.split("\n")[0].slice(0, 120)}`); }
  if (!first.error) return first;
  // Korjauskierros: moottorin virhe takaisin agentille.
  progress?.({ status: "Korjataan skenaariota" });
  let second: Described;
  try {
    second = await attempt(await ask(`\n\nEDELLINEN YRITYS EPÄONNISTUI. Moottori sanoi: "${first.error}". Korjaa skenaario (tarkista nimet, kesto, raja ±0,15 ja enintään ${MAX_ITEMS} riviä; tarvittaessa yksinkertaista) ja kutsu liiga_skenaario-työkalua uudelleen.`));
  } catch { return fallback(first.error ?? "tuntematon virhe"); }
  return second.error ? fallback(second.error) : withRoster(second);
}
