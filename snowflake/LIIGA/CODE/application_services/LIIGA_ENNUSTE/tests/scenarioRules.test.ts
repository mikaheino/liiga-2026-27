import assert from "node:assert/strict";
import { test } from "node:test";
import { continuity, mergeRows, teamsIn } from "../lib/scenarioRules.ts";
import { MAX_ITEMS, validItem } from "../lib/scenarioItems.ts";

test("continuity: ei pohjaa -> ei lausetta", () => {
  assert.equal(continuity(0, false, 5), "");
  assert.equal(continuity(0, true, 5), "");
});

test("continuity: korvattu", () => {
  assert.equal(continuity(5, false, 3), "Uusi skenaario (edellinen korvattiin).");
});

test("continuity: jatkettu, rivit kanonisista luvuista", () => {
  assert.equal(continuity(5, true, 8), "Jatkettu edellistä: lisätty 3 riviä, yhteensä 8.");
  assert.equal(continuity(5, true, 6), "Jatkettu edellistä: lisätty 1 rivi, yhteensä 6.");
  assert.equal(continuity(5, true, 4), "Jatkettu edellistä: päivitetty aiempia rivejä, yhteensä 4.");
});

test("MAX_ITEMS mahtuu kaikki pelaamattomat ottelut (376 tänään) ja kelpaa riveille", () => {
  assert.ok(MAX_ITEMS >= 376);
  assert.ok(validItem({ game_id: 2701444, result: "home_win" }, new Set()));
  assert.ok(!validItem({ game_id: 1, result: "x" }, new Set()));
});

// 13.11.2026: "Ilves häviää kolme seuraavaa" -> pääjoukkue oli SaiPa (vastustaja kahdesti).
test("teamsIn: kysytty joukkue voittaa vastustajan, joka toistuu", () => {
  const items = [
    { game_id: 1, label: "13.11. SaiPa–Ilves: SaiPa voittaa" },
    { game_id: 2, label: "15.11. Ilves–SaiPa: SaiPa voittaa" },
    { game_id: 3, label: "18.11. K-Espoo–Ilves: K-Espoo voittaa" },
  ];
  assert.deepEqual(teamsIn(items, ["Ilves", "K-Espoo", "SaiPa"]), ["Ilves"]);
});

// 13.11.2026: kirjoitettu jatko lisätään aina nykyiseen; sama ottelu tai pelaaja korvaa vanhan rivin.
test("mergeRows: uusi rivi samasta ottelusta korvaa, muut säilyvät", () => {
  const base = [{ game_id: 1, result: "home_reg" }, { game_id: 2, result: "away_reg" }, { injury: "A B", games: 5 }];
  const added = [{ game_id: 2, result: "home_ot" }, { injury: "C D", games: 10 }];
  assert.deepEqual(mergeRows(base, added), [{ game_id: 1, result: "home_reg" }, { injury: "A B", games: 5 }, { game_id: 2, result: "home_ot" }, { injury: "C D", games: 10 }]);
});
test("continuity: pelkkä päivitys ei väitä lisänneensä rivejä", () => {
  assert.equal(continuity(4, true, 4), "Jatkettu edellistä: päivitetty aiempia rivejä, yhteensä 4.");
});
