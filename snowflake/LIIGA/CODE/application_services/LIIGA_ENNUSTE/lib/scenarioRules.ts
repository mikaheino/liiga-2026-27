// Skenaariohaun säännöt koodina (7.11.2026, käyttäjä: "Muuta teksti ohjeet koodiksi"). Aiemmin nämä
// olivat agentin ohjetekstissä (lib/scenarioDescribe.ts RULE), jolloin ne toteutuivat vain jos
// kielimalli muisti ne. Nyt ne ovat deterministisiä, testattavia ja samat joka kerta:
//   normalize()   oletukset: poissaolo ilman kestoa = 10 ottelua, tulos ilman määrää = 5 seuraavaa
//   withNews()    uutisista hyväksytyt poissaolot aina mukaan, ellei käyttäjä sano "ilman X / ilman uutisia"
//   verdict()     ensimmäinen lause = johtopäätös moottorin luvuista (pääjoukkue, sille auki oleva raja)
//   pickChart()   kuvaaja skenaarion rakenteesta
//   abNotice()    mallia säädettäessä suora lause: malliversiota ei voi A/B-testata etukäteen
// Agentille jää kieli: mitä käyttäjä tarkoittaa, päivämäärät, jatko vai uusi ja selittävät lauseet.
import type { NewsAbsence } from "@/lib/newsContext";

type Row = Record<string, unknown>;
type Res = { teams?: Row[] };

export const DEFAULT_INJURY_GAMES = 10;
export const DEFAULT_RESULT_GAMES = 5;

/** Puuttuvat kestot oletuksiksi (ennen ohjeessa: "kesto puuttuu -> 10 ottelua", "ilman määrää -> 5"). */
export function normalize(list: Row[]): Row[] {
  return list.map((it) => {
    if ((it.injury != null || it.player_id != null) && it.games == null && it.until == null && it.days == null && it.from == null) {
      return { ...it, games: DEFAULT_INJURY_GAMES };
    }
    if (it.team && it.result && it.game_id == null && it.games == null && it.from == null && it.until == null) {
      return { ...it, games: DEFAULT_RESULT_GAMES };
    }
    return it;
  });
}

/** Hyväksytyt uutispoissaolot mukaan, ellei käyttäjä jätä niitä pois ("ilman Wernblomia", "ilman uutisia"). */
export function withNews(list: Row[], abs: NewsAbsence[], userText: string): Row[] {
  const low = userText.toLowerCase();
  if (/ilman uutisi/.test(low)) return list;
  const have = new Set(list.filter((x) => x.injury != null).map((x) => String(x.injury).toLowerCase()));
  const add = abs.filter((a) => {
    const last = a.player.split(" ").slice(-1)[0].toLowerCase();
    const excluded = new RegExp(`ilman\\s+(\\S+\\s+)?${last.slice(0, Math.max(4, last.length - 2))}`).test(low);
    return !excluded && ![...have].some((h) => h.includes(last));
  }).map((a) => ({ injury: a.player, until: a.until }));
  return [...list, ...add];
}

const KEYS = [["p_top10", "jatkoon"], ["p_top6", "kärkikuusikkoon"], ["p_relegation", "putoamisuhka"], ["p_title", "runkosarjan voitto"]] as const;
const pc = (x: unknown) => (100 * Number(x)).toFixed(1).replace(".", ",");

/** Pääjoukkue: skenaarion omista joukkueista se, jonka luvut liikkuvat eniten (muuten koko liigasta). */
export function mainTeam(res: Res, among: string[]): Row | null {
  const d = (r: Row) => KEYS.reduce((s, [k]) => s + Math.abs(Number(r[`${k}_scenario`]) - Number(r[`${k}_now`])), 0);
  const rows = (res.teams ?? []).filter((r) => !among.length || among.includes(String(r.team)));
  return [...(rows.length ? rows : res.teams ?? [])].sort((a, b) => d(b) - d(a))[0] ?? null;
}

/** Skenaarion pääjoukkueet: eniten mainittu kanonisissa riveissä (joukkuekenttä, ottelulabelit,
 *  "(joukkue)", mallin vahvuudet). 7.11.: "Lukko häviää kolme" valitsi muuten KalPan, jonka luvut
 *  liikkuivat eniten; kysymys koskee silti Lukkoa. Tasatilanteessa kaikki eniten mainitut. */
export function teamsIn(items: Row[], teams: string[]): string[] {
  const text = items.map((x) => `${x.team ?? ""} ${x.label ?? ""} ${Object.keys((x.model as Row)?.strength ?? {}).join(" ")}`).join(" ");
  const n = new Map(teams.map((t) => [t, text.split(t).length - 1] as const).filter(([, c]) => c > 0));
  const top = Math.max(0, ...n.values());
  return [...n].filter(([, c]) => c === top).map(([t]) => t);
}

/** Johtopäätös luvuista (ennen ohjeessa: "vastaa piilokysymykseen ENSIMMÄISENÄ lauseena"). Raja, joka
 *  joukkueelle on auki: putoamisuhka jos se on vähintään 15 %, muuten jatkoon / kärkikuusikko / voitto. */
export function verdict(res: Res, items: Row[], teams: string[]): string {
  const r = mainTeam(res, teamsIn(items, teams));
  if (!r) return "";
  const now = (k: string) => Number(r[`${k}_now`]), scn = (k: string) => Number(r[`${k}_scenario`]);
  const parts: string[] = [];
  const rel = Math.max(now("p_relegation"), scn("p_relegation")) >= 0.15;
  const title = Math.max(now("p_title"), scn("p_title")) >= 0.15;
  const pick = rel ? ["p_relegation", "p_top10"] : title ? ["p_title", "p_top6"] : now("p_top10") > 0.9 ? ["p_top6", "p_title"] : ["p_top10", "p_top6"];
  for (const k of pick) {
    const l = KEYS.find(([x]) => x === k)![1];
    parts.push(`${l} ${pc(scn(k))} % (nyt ${pc(now(k))} %)`);
  }
  const up = rel ? scn("p_relegation") < now("p_relegation") : scn(pick[0]) > now(pick[0]);
  const same = Math.abs(scn(pick[0]) - now(pick[0])) < 0.005;
  const tone = same ? "pysyy skenaariossa lähes ennallaan" : up ? "vahvistuu skenaariossa" : "heikkenee skenaariossa";
  return `${r.team} ${tone}: ${parts.join(", ")}.`;
}

export type Chart = { type: "pisteet" | "jakauma" | "ottelut"; team?: string } | null;
/** Kuvaaja rakenteesta (ennen ohjeessa KUVAAJA-rivi): tavoite tai mallin säätö -> sijajakauma, muutama
 *  lukittu ottelu -> ottelut, muuten (jaksot, poissaolot, joukkueen muutos) -> pistekäyrä. */
export function pickChart(items: Row[], res: Res, teams: string[]): Chart {
  if (!items.length) return null;
  const locks = items.filter((x) => x.game_id != null).length;
  const team = String(mainTeam(res, teamsIn(items, teams))?.team ?? "") || undefined;
  const other = items.some((x) => x.injury != null || x.xg_share != null);
  if (items.some((x) => x.goal != null || x.model != null) && !locks && !other) return { type: "jakauma", team };
  if (locks > 0 && locks <= 4 && !other) return { type: "ottelut", team };
  return { type: "pisteet", team };
}

/** Mallin säätö -> suora lause (käyttäjä: "sano suoraan että A/B-testaus ei onnistu"). */
export function abNotice(items: Row[]): string {
  return items.some((x) => x.model != null)
    ? "Tätä malliversiota ei voi A/B-testata etukäteen: se on kokeilu, ja sen osuvuus selviäisi vasta pelatuista otteluista."
    : "";
}

/** Maalivahti pelaa kaikki (7.11.2026, "Olkinuora pelaa kaikki loput pelit" -> agentti ei tiennyt
 *  joukkuetta ja kysyi tarkennusta; ruutuun jäi edellisen haun kuvaaja). Nimetty vahti tunnistetaan
 *  datasta (loadPlayers: kauden vahdit), ja "pelaa kaikki" = joukkueen muut vahdit poissa loppukauden. */
export type GoalieRef = { name: string; team: string };
const ALL_GAMES = /(pelaa|torjuu|aloittaa|maalissa)\b.*\b(kaikki|loput|jokaisen|joka)|\b(kaikki|loput)\b.*\b(pelit|ottelut|matsit)\b.*\b(maalissa|tolppien)/;
export function goalieAll(userText: string, goalies: GoalieRef[]): { goalie: GoalieRef; others: string[] } | null {
  const low = userText.toLowerCase();
  if (!ALL_GAMES.test(low)) return null;
  const g = goalies.find((x) => {
    const last = x.name.split(" ").slice(-1)[0].toLowerCase();
    return last.length > 2 && new RegExp(`\\b${last.slice(0, Math.max(4, last.length - 2))}`).test(low);
  });
  if (!g) return null;
  const others = [...new Set(goalies.filter((x) => x.team === g.team && x.name !== g.name).map((x) => x.name))];
  return others.length ? { goalie: g, others } : null;
}
export const SEASON_END = "2027-04-30";
export function goalieItems(m: { others: string[] }): Row[] {
  return m.others.map((n) => ({ injury: n, until: SEASON_END }));
}
