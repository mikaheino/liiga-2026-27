import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultMeasure, fromBaseline, fromEngine, moved, pctText, pointsText, ppText, rankMove } from "../lib/scenarioTable.ts";

// Moottorin rivit omistajan skenaariosta 13.11.2026 ("KooKoo häviää kaikki kotiottelunsa", 22 ottelua),
// POST /api/skenaario -vastauksesta lyhennettyinä.
const row = (team: string, rn: number, rs: number, pn: number, ps: number, t10: [number, number], t6: [number, number], rel: [number, number], ti: [number, number]) => ({
  team, rank_now: rn, rank_scenario: rs, points_now: pn, points_scenario: ps,
  p_top10_now: t10[0], p_top10_scenario: t10[1], p_top6_now: t6[0], p_top6_scenario: t6[1],
  p_relegation_now: rel[0], p_relegation_scenario: rel[1], p_title_now: ti[0], p_title_scenario: ti[1],
});
const ENGINE = [
  row("KooKoo", 16, 17, 72.0, 48.6, [0.006, 0], [0, 0], [0.909, 1], [0, 0]),
  row("Sport", 17, 16, 70.6, 73.3, [0.01, 0.014], [0, 0], [0.852, 0.815], [0, 0]),
  row("Jukurit", 9, 11, 93.1, 93.1, [0.757, 0.696], [0.335, 0.27], [0.023, 0.033], [0.004, 0.002]),
  row("Lukko", 1, 1, 121.0, 122.6, [1, 1], [0.995, 0.996], [0, 0], [0.606, 0.628]),
];

test("fromEngine: järjestys skenaarion sijan mukaan", () => {
  assert.deepEqual(fromEngine(ENGINE).map((r) => [r.team, r.rank]), [["Lukko", 1], ["Jukurit", 11], ["Sport", 16], ["KooKoo", 17]]);
});

test("rankMove: ▲/▼/– ja pohjassa ei merkkiä", () => {
  const [lukko, jukurit, sport, kookoo] = fromEngine(ENGINE);
  assert.equal(rankMove(kookoo).text, "▼1");
  assert.equal(rankMove(sport).text, "▲1");
  assert.equal(rankMove(jukurit).text, "▼2");
  assert.equal(rankMove(jukurit).say, "laskee 2 sijaa");
  assert.equal(rankMove(lukko).text, "–");
  assert.equal(rankMove(fromBaseline([{ team: "X", rank: 3, points: 90, top10: 0.5, top6: 0.2, rel: 0, title: 0 }])[0]).text, "");
});

test("pointsText: 49 · −23 (U+2212), muutos pyöristetyistä", () => {
  const [, jukurit, sport, kookoo] = fromEngine(ENGINE);
  assert.deepEqual(pointsText(kookoo), { value: "49", delta: "−23" });
  assert.deepEqual(pointsText(sport), { value: "73", delta: "+2" });
  assert.deepEqual(pointsText(jukurit), { value: "93", delta: "±0" });
});

test("pctText ja ppText: ääripäät ja prosenttiyksiköt", () => {
  assert.equal(pctText(1), "100");
  assert.equal(pctText(0.999), ">99");
  assert.equal(pctText(0.003), "<1");
  assert.equal(pctText(0), "0");
  assert.equal(pctText(0.909), "91");
  assert.equal(ppText(0.909, 1), "+9");
  assert.equal(ppText(0.757, 0.696), "−6");
  assert.equal(ppText(0.995, 0.996), "");
  assert.equal(ppText(undefined, 0.5), "");
});

test("moved: sijan vaihto tai selvä liike; pieni liike ei", () => {
  const [lukko, jukurit, , kookoo] = fromEngine(ENGINE);
  assert.ok(moved(kookoo));
  assert.ok(moved(jukurit));
  assert.ok(!moved(lukko)); // +1,6 p ja +2,2 prosenttiyksikköä mestaruuteen: alle rajojen
});

test("defaultMeasure: skenaarion joukkueella eniten liikkuva, muuten Jatkoon", () => {
  const rows = fromEngine(ENGINE);
  assert.equal(defaultMeasure(rows, ["KooKoo"]), "rel");
  assert.equal(defaultMeasure(rows, ["Jukurit"]), "top6");
  assert.equal(defaultMeasure(fromBaseline([{ team: "X", rank: 1, points: 90, top10: 1, top6: 1, rel: 0, title: 0.5 }]), []), "top10");
});
