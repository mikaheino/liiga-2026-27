// Skenaarion rivit ryhmiteltyinä (8.11.2026, käyttäjä: "simulaattorissa on vaikea ymmärtää mitkä on
// lukittu"). Kanoniset rivit -> lyhyet rivit lajeittain: lukitut ottelut joukkueittain ja tuloksittain
// (määrä ja aikaväli), poissaolot, joukkueen muutokset, tavoitteet ja mallin säätö.
type Row = Record<string, unknown>;
export type Line = { kind: "lukko" | "poissa" | "muutos" | "tavoite" | "malli"; text: string };

export function summarize(items: Row[]): Line[] {
  const out: Line[] = [];
  const groups = new Map<string, { n: number; first: string; last: string }>();
  for (const it of items.filter((x) => x.game_id != null)) {
    const lab = String(it.label ?? "");
    const [head, what = ""] = lab.split(": ");
    const date = head.split(" ")[0];
    // "menee jatkoajalle" / "ratkeaa varsinaisella" ilman joukkuetta: ottelu mukaan avaimeen.
    const key = /^(menee|ratkeaa)/.test(what) ? `${head.split(" ").slice(1).join(" ")} ${what}` : what;
    const g = groups.get(key) ?? { n: 0, first: date, last: date };
    g.n += 1; g.last = date;
    groups.set(key, g);
  }
  for (const [what, g] of groups) {
    out.push({ kind: "lukko", text: g.n === 1 ? `${what} (${g.first})` : `${what} × ${g.n} (${g.first}–${g.last})` });
  }
  for (const it of items) {
    const lab = String(it.label ?? "");
    if (it.injury != null) out.push({ kind: "poissa", text: lab });
    else if (it.xg_share != null) out.push({ kind: "muutos", text: lab });
    else if (it.goal != null) out.push({ kind: "tavoite", text: lab });
    else if (it.model != null) out.push({ kind: "malli", text: lab });
  }
  return out;
}

export const KIND_LABEL: Record<Line["kind"], string> = { lukko: "Lukittu", poissa: "Poissa", muutos: "Muutos", tavoite: "Tavoite", malli: "Malli" };
