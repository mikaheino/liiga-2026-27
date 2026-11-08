// Aliagentit skenaariohaussa (7.11.2026, käyttäjä: "agentti voisi käynnistää subagenttia. kaikki
// totuus kuitenkin datassa"). Pääagentti (lib/scenarioDescribe.ts) rakentaa skenaarion; täällä kaksi
// apulaista, joista kumpikaan ei tuota lukuja itse:
//   faktantarkistus  koodi (ei kielimalli): vastauksen jokainen prosentti löytyy moottorin tuloksesta.
//                    Jos ei, kirjoittaja-aliagentti saa moottorin luvut ja kirjoittaa tekstin uudelleen.
//   tutkija          aliagentti ehdottaa kolme lähiskenaariota PELKKINÄ RAKENTEINA (ei lukuja);
//                    moottori laskee ne rinnakkain ja sovellus muodostaa luvut riville.
import { proposals } from "@/lib/followups";
import { loadTeams } from "@/lib/data";
import { askOnce } from "@/lib/agent";
import { runEngine } from "@/lib/scenarioEngine";

type Row = Record<string, number | string>;
type Res = { teams?: Row[]; requirements?: { p?: number }[]; locked_games?: { p_model?: number }[]; plausibility?: number | null;
  shifts?: { share_before?: number; share_after?: number }[] };
// Moottorin omat rajat: vaatimuslaskelman varmuustasot ("50 %:n varmuudella") eivät ole ennustelukuja.
const LEVELS = [50, 80, 90, 95];

const PCT = /(\d{1,3}(?:,\d)?)\s*%/g;
const KEYS = [["p_top10", "jatkoon"], ["p_top6", "kärkikuusikko"], ["p_relegation", "putoamisuhka"], ["p_title", "runkosarjan voitto"]] as const;
const pc = (x: number) => (100 * x).toFixed(1).replace(".", ",");

export function engineValues(res: Res | null): number[] {
  if (!res) return [];
  const v = (res.teams ?? []).flatMap((r) => Object.entries(r).filter(([k, x]) => k.startsWith("p_") && typeof x === "number").map(([, x]) => 100 * Number(x)));
  v.push(...(res.requirements ?? []).map((q) => 100 * Number(q.p ?? 0)), ...(res.locked_games ?? []).map((g) => 100 * Number(g.p_model ?? 0)));
  if (res.plausibility != null) v.push(100 * res.plausibility);
  v.push(...(res.shifts ?? []).flatMap((x) => [100 * Number(x.share_before ?? 0), 100 * Number(x.share_after ?? 0)]), ...LEVELS);
  return v;
}

/** Prosentit, joita moottorin tuloksessa ei ole (±0,15 %-yks.). Tyhjä = kaikki luvut datasta. */
export function factCheck(answer: string, res: Res | null): string[] {
  const vals = engineValues(res);
  if (!vals.length) return [];
  return [...answer.matchAll(PCT)].map((m) => m[1]).filter((s) => {
    const x = Number(s.replace(",", "."));
    return x > 0.2 && x < 99.8 && !vals.some((v) => Math.abs(v - x) <= 0.15);
  });
}

// Moottorin luvut tiiviinä taulukkona kirjoittaja-aliagentille (vain liikkuneet joukkueet).
function engineTable(res: Res): string {
  const rows = (res.teams ?? []).filter((r) => KEYS.some(([k]) => Math.abs(Number(r[`${k}_scenario`]) - Number(r[`${k}_now`])) >= 0.005));
  return rows.map((r) => `${r.team}: ${KEYS.map(([k, l]) => `${l} ${pc(Number(r[`${k}_now`]))} -> ${pc(Number(r[`${k}_scenario`]))} %`).join(", ")}`).join("\n");
}

/** Poistaa lauseet, joissa on moottorista puuttuva luku (8.11.2026: korvaa kielimallin uudelleenkirjoituksen). */
export function dropSentences(answer: string, bad: string[]): string {
  return answer.split(/(?<=[.!?])\s+/).filter((x) => !bad.some((b) => x.includes(b))).join(" ").trim();
}

export async function rewrite(question: string, answer: string, res: Res, bad: string[]): Promise<string> {
  const ctx = `TEHTÄVÄ: Kirjoita alla oleva yhteenveto uudelleen niin, että KAIKKI prosentit ovat täsmälleen moottorin taulukosta. Luvut ${bad.join(", ")} % eivät olleet taulukossa. Älä kutsu työkaluja. Säilytä sävy (lempeä, selkokielinen) ja rakenne: ensimmäinen lause on johtopäätös. Pelkkää tekstiä, ei taulukoita, ei KUVAAJA-riviä.
MOOTTORIN TAULUKKO (nyt -> skenaario):
${engineTable(res)}
ALKUPERÄINEN YHTEENVETO:
${answer}`;
  const a = await askOnce(question, ctx);
  return a.text.replace(/\n?\s*KUVAAJA:[^\n]*$/i, "").trim();
}

export type Related = { q: string; line: string; scenario?: Record<string, unknown>[] };

/** Tutkija: kolme lähiskenaariota rakenteina -> moottori laskee rinnakkain -> rivi luvuista. */
export async function explore(question: string, items: Record<string, unknown>[]): Promise<Related[]> {
  const ctx = `TEHTÄVÄ: Olet tutkija-aliagentti. Käyttäjän skenaario on alla. Ehdota TÄSMÄLLEEN kolme lähiskenaariota, jotka vastaavat luonteviin jatkokysymyksiin: esim. lievempi tai vahvempi versio, sama toiselle kilpailijalle tai mitä jos putki katkeaa. ÄLÄ kutsu työkaluja äläkä kirjoita yhtään lukua tai prosenttia: moottori laskee luvut.
Vastaa VAIN JSON-taulukkona: [{"q": "lyhyt kysymys suomeksi", "scenario": [ ...liiga_skenaario-rivejä samassa muodossa kuin alla... ]}, ...]
Sallitut rivit: {"team","result":win|loss|reg_win|ot_win|ot_loss|reg_loss|ot|point|regulation,"games":N tai "from"/"until"}, {"game_id","result"}, {"injury":"nimi","games":N}, {"team","xg_share":-0.15..0.15}, {"team","goal":top6|top10|avoid_relegation|win}.
KÄYTTÄJÄN SKENAARIO (moottorin muodossa): ${JSON.stringify(items.map(({ label: _l, ...x }) => x))}`;
  // Ensin koodin jatkokysymykset (lib/followups.ts, aina, ei tokeneita); agentti vain jos niitä ei ole.
  let props: { q?: unknown; scenario?: unknown }[] = proposals(items, await loadTeams());
  if (!props.length) {
    const a = await askOnce(question, ctx);
    const json = a.text.slice(a.text.indexOf("["), a.text.lastIndexOf("]") + 1);
    try { props = JSON.parse(json); } catch { return []; }
  }
  // Totuus datassa: rivi kertoo moottorin kanonisista riveistä, mitä oikeasti laskettiin (aliagentin
  // kysymys ja skenaario voivat erota: 7.11. "vain 2 ottelua" laski viisi). Käyttäjän oman skenaarion
  // kopiot (sama ilman tavoiterivejä) karsitaan.
  const own = keyOf(items);
  const out = await Promise.all(props.slice(0, 3).map(async (p) => {
    if (typeof p.q !== "string" || !Array.isArray(p.scenario) || !p.scenario.length) return null;
    const r = await runEngine<Res & { error?: string; scenario_canonical?: Record<string, unknown>[] }>("json", p.scenario).catch(() => null);
    if (!r || r.error) return null;
    const canon = r.scenario_canonical ?? [];
    if (!keyOf(canon) || keyOf(canon) === own) return null;
    // Skenaarion omat joukkueet kanonisista riveistä (joukkuekenttä tai labelin joukkueet).
    const teamsIn = [...new Set(canon.flatMap((x) => [String(x.team ?? ""), ...String(x.label ?? "").match(/\(([^)]+)\)/g)?.map((m) => m.slice(1, -1)) ?? [],
      ...(String(x.label ?? "").split(": ")[1]?.match(/^(\S+) /)?.slice(1) ?? [])]).filter(Boolean))];
    const line = headline(r, teamsIn);
    return line ? ({ q: p.q.slice(0, 140), line: `${describeCanon(canon)} · ${line}`, scenario: canon.map(({ label: _l, ...x }) => x) } as Related) : null;
  }));
  const seen = new Set<string>();
  return out.filter((x): x is Related => !!x && !seen.has(x.line) && !!seen.add(x.line));
}

// Skenaarion tunniste ilman tavoiterivejä (tavoite ei muuta lukuja).
function keyOf(rows: Record<string, unknown>[]): string {
  return rows.filter((r) => !("goal" in r)).map(({ label: _l, ...x }) => JSON.stringify(x)).sort().join("|");
}

// Kanoniset rivit lyhyesti: lukitut ottelut tuloksittain ("Pelicans voittaa × 3"), muut labelina.
function describeCanon(rows: Record<string, unknown>[]): string {
  const counts = new Map<string, number>();
  const other: string[] = [];
  // Jos kaikki lukitut ottelut koskevat samaa joukkuetta, kerrotaan sen näkökulmasta ("X häviää × 3").
  const games = rows.filter((r) => "game_id" in r).map((r) => String(r.label ?? ""));
  const sides = games.map((l) => (l.split(": ")[0].split(" ").slice(1).join(" ")).split("–"));
  const common = sides.length ? sides[0].filter((t) => sides.every((x) => x.includes(t))) : [];
  const me = common.length === 1 ? common[0] : null;
  for (const r of rows) {
    if ("goal" in r) continue;
    const lab = String(r.label ?? "");
    if ("game_id" in r) {
      let what = lab.split(": ").slice(1).join(": ");
      const winner = /^(.+) voittaa$/.exec(what)?.[1];
      if (me && winner) what = winner === me ? `${me} voittaa` : `${me} häviää`;
      counts.set(what, (counts.get(what) ?? 0) + 1);
    } else other.push(lab);
  }
  return [...[...counts].map(([w, n]) => (n > 1 ? `${w} × ${n}` : w)), ...other].join(", ");
}

// Pääjoukkue = suurin muutos jatkopaikassa tai pisteissä, ensisijaisesti skenaarion omista joukkueista
// (7.11.: Lukko-skenaarion rivi näytti KalPan 5,2 -> 5,2 %, koska pienet muutokset ovat kohinaa).
function mainTeam(res: Res, among: string[] = []): string | null {
  const d = (r: Row) => Math.abs(Number(r.p_top10_scenario) - Number(r.p_top10_now)) + Math.abs(Number(r.points_scenario) - Number(r.points_now)) / 100;
  const rows = (res.teams ?? []).filter((r) => !among.length || among.includes(String(r.team)));
  return [...(rows.length ? rows : res.teams ?? [])].sort((a, b) => d(b) - d(a))[0]?.team as string ?? null;
}

// Rivi luvuista (moottori, ei kielimalli): eniten liikkuneen joukkueen eniten liikkunut mittari.
function headline(r: Res, among: string[] = []): string {
  const team = (r.teams ?? []).find((x) => x.team === mainTeam(r, among));
  if (!team) return "";
  const [k, l] = [...KEYS].sort(([a], [b]) => Math.abs(Number(team[`${b}_scenario`]) - Number(team[`${b}_now`])) - Math.abs(Number(team[`${a}_scenario`]) - Number(team[`${a}_now`])))[0];
  return `${team.team}: ${l} ${pc(Number(team[`${k}_now`]))} → ${pc(Number(team[`${k}_scenario`]))} %`;
}
