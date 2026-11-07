// Jatkokysymykset koodilla (7.11.2026, käyttäjä: "lisää meille google experienceen jatkokysymyksiä",
// "niitä tulee tulla aina jatkokeskustelussa"). Skenaarion kanonisista riveistä 3 luontevaa
// jatkoa (lievempi/vahvempi, käänteinen, yhdistelmä) valmiine moottorin riveineen: aina saatavilla,
// ei kielimallia eikä tokeneita. lib/subagents.ts explore() laskee luvut ja käyttää agenttia vain,
// jos täältä ei tule mitään (mallin säätö).
import { teamsIn } from "@/lib/scenarioRules";

type Row = Record<string, unknown>;
export type Proposal = { q: string; scenario: Row[] };
const SEASON_END = "2027-04-30";
const GOAL_Q: Record<string, string> = { top10: "pääsee jatkoon", top6: "nousee kärkikuusikkoon", win: "voittaa runkosarjan", avoid_relegation: "välttää putoamisen" };

export function proposals(items: Row[], teams: string[]): Proposal[] {
  const core = items.map(({ label: _l, ...x }) => x);
  const team = teamsIn(items, teams)[0];
  const locks = items.filter((x) => x.game_id != null);
  const inj = items.find((x) => x.injury != null);
  const sh = items.find((x) => x.xg_share != null);
  const goal = items.find((x) => x.goal != null);
  const out: Proposal[] = [];
  if (locks.length && team) {
    const n = locks.length;
    const wins = locks.filter((x) => String(x.label ?? "").includes(`${team} voittaa`)).length;
    const res = wins * 2 >= n ? "win" : "loss";
    const flip = res === "win" ? "loss" : "win";
    out.push({ q: `Entä jos ${team} ${flip === "win" ? "voittaakin" : "häviääkin"} ${n} seuraavaa?`, scenario: [{ team, result: flip, games: n }] });
    out.push({ q: `Entä jos ${team} saa vain pisteen ${n} seuraavasta?`, scenario: [{ team, result: "point", games: n }] });
    out.push({ q: `Entä jos putki jatkuu ${2 * n} otteluun?`, scenario: [{ team, result: res, games: 2 * n }] });
  }
  if (inj) {
    const name = String(inj.label ?? inj.injury).replace(/ \(.*$/, "");
    const last = name.split(" ").slice(-1)[0];
    const g = Number(inj.games ?? 10);
    if (g > 2) out.push({ q: `Entä jos ${last} palaa jo ${Math.ceil(g / 2)} ottelun jälkeen?`, scenario: [{ injury: inj.injury, games: Math.ceil(g / 2) }] });
    out.push({ q: `Entä jos ${last} on poissa koko loppukauden?`, scenario: [{ injury: inj.injury, until: SEASON_END }] });
    if (team) out.push({ q: `Entä jos ${team} voittaa silti viisi seuraavaa?`, scenario: [...core, { team, result: "win", games: 5 }] });
  }
  if (sh) {
    const d = Number(sh.xg_share), t = String(sh.team);
    out.push({ q: `Entä jos muutos on vain puolet tästä?`, scenario: [{ ...core.find((x) => x.xg_share != null), xg_share: Math.round(500 * d) / 1000 }] });
    out.push({ q: `Entä jos vaikutus kestää vain 10 ottelua?`, scenario: [{ team: t, xg_share: d, games: 10 }] });
    out.push({ q: `Entä jos ${t} myös voittaa viisi seuraavaa?`, scenario: [...core, { team: t, result: "win", games: 5 }] });
  }
  if (goal && !out.length) {
    const t = String(goal.team), g = String(goal.goal);
    out.push({ q: `Entä jos ${t} voittaa viisi seuraavaa?`, scenario: [{ team: t, result: "win", games: 5 }, { team: t, goal: g }] });
    out.push({ q: `Entä jos ${t} häviää viisi seuraavaa?`, scenario: [{ team: t, result: "loss", games: 5 }, { team: t, goal: g }] });
    out.push({ q: `Mitä jos ${t} vahvistuu selvästi, ${GOAL_Q[g] ?? "pärjääkö"} se?`, scenario: [{ team: t, xg_share: 0.02 }, { team: t, goal: g }] });
  }
  return out.slice(0, 3);
}
