// Mouhon salaisuus -- käynnistys, aloituskohdat (?alku) ja esikatselut (?nayta).
"use strict";
for (const ev of ["click", "contextmenu", "keydown"]) document.addEventListener(ev, () => { lastProgress = performance.now(); }, true);

// ---------------------------------------------------------------- käynnistys
startEngine({
  titleScreen: drawTitle, startRoom: "koti", startX: LAND[0], hint,
  intro: async () => {
    give("puhelin");
    await prologue(); give("nimikyltti");
    await say("Lappeenranta, lokakuu. Kisapuisto, SaiPan kotihalli.", "muu");
    await say("Potku lennätti minut sinne, mistä kaikki alkoi. Täällä minut sentään vielä tunnetaan.");
    await saarniScene(); },
});

// ---------------------------------------------------------------- aloituskohdat (?alku=)
// Suoraan kohtaukseen sillä tilalla, joka pelaajalla olisi sinne asti päästyään (17.10.: "voitko
// avata minulle pelin Istanbulista?"; 23.10.: "mahdollisuus hypätä näihin kohtauksiin").
const KISA_DONE = { introDone: true, leafPile: true, billOut: true, billStuck: true, billCaught: true, billReturned: true, adRead: true, noteHint: true,
  myrraCalls: 1, pyramid: true, recruits: 2, mgp: true, metSales: true, pianoT: 1, unlocked: true, letterTaken: true, boxOpen: false };
const IST_DONE = { merhaba: true, mehmetWho: true, signed: true, myrra1: true, quest: true, questHeard: true, map: true, askedMap: true, bag: true, bazaar: true };
// Oletuksena ilman lentolippua: se käytetään lennolla.
const afterKisa = (inv = ["puhelin", "nimikyltti", "lappu", "kaavio", "kortti", "kirje"]) => { Object.assign(st.flags, KISA_DONE); st.inv = inv; };
defineStart("istanbul", () => { afterKisa(); go("portti", 110, true, 87); script(async () => { await walkTo(60, 122); await say("Istanbul! Basaarit, moskeijat ja simitin tuoksu. Täällä jokainen on potentiaalinen jäsen."); }); });
defineStart("kappadokia", () => { afterKisa(["puhelin", "nimikyltti", "lappu", "kaavio", "kortti", "kirje", "velkakirja"]);
  Object.assign(st.flags, IST_DONE, { recruits: 2, bazaar: false }); go("basaari", 160, true, 74); script(() => toTemple()); });
// jalonen: Kisapuisto heti Myrrän ensimmäisen puhelun jälkeen
defineStart("jalonen", () => { afterKisa(["puhelin", "nimikyltti", "lappu", "kaavio"]); Object.assign(st.flags, { mgp: false, metSales: false, pianoT: 0, unlocked: false, letterTaken: false });
  go("koti", 100, true, 110); script(() => jalonenArrives()); });
// valtonen: lentoaseman lähtöaula juuri taksista tultua (lippu taskussa)
defineStart("valtonen", () => { afterKisa(["puhelin", "nimikyltti", "lappu", "kaavio", "kortti", "kirje", "lippu"]); Object.assign(st.flags, { searched: true, airportSeen: true }); go("lentoasema", 30, true, 122); script(() => valtonenArrives()); });
// jokinen: basaari kebab taskussa
defineStart("jokinen", () => { afterKisa(); give("kebab"); go("basaari", 96, true); });
// haastattelu: suoraan loppuun kaikkien valmentajien kanssa
defineStart("haastattelu", () => { afterKisa(); Object.assign(st.flags, IST_DONE, { lyhyesti: true, pohja: true, energia: true, jalonenIn: true, valtonenIn: true, jokinenIn: true,
  recruits: 48, refRecruited: true, trophy: true, bazaar: true }); go("basaari", 96, true); script(() => ending()); });

// ---------------------------------------------------------------- esikatselut (?nayta=)
// Yksi näkymä paikallaan, jotta grafiikan voi tarkistaa kuvakaappauksella (myös päätteettömällä
// Chromella) pelaamatta sinne asti. &y=<jalkojen y> huoneissa, &x=<kohta> Kaivokadun kävelyssä.
definePreview("otsikko", () => { title = true; });
definePreview("kisa", (Q) => { Object.assign(st.flags, { leafPile: true, jalonenHere: true }); go("koti", 178, true, +Q.get("y") || 127); });      // Jalonen hallin ikkunalla
definePreview("parkki", (Q) => { Object.assign(st.flags, { pianoT: Date.now() - 9000 }); go("parkki", 150, true, +Q.get("y") || 124); });   // salkkumies ja Ilves-piano
definePreview("portti", (Q) => { go("portti", +Q.get("x") || 150, true, +Q.get("y") || 124); });   // basaarin portti (backlog 8)
definePreview("basaari", (Q) => { Object.assign(st.flags, { crowd: true }); go("basaari", 96, true, +Q.get("y") || 128); });
definePreview("lentoasema", (Q) => { Object.assign(st.flags, { valtonenHere: true }); go("lentoasema", 60, true, +Q.get("y") || 122); });
definePreview("kallio", (Q) => { go("kallio", +Q.get("x") || 200, true, +Q.get("y") || 122); });   // temppelin edusta (backlog 8)
definePreview("temppeli", () => { Object.assign(st.flags, { refHere: true, refMet: true }); go("temppeli", 130, true, 120); });
definePreview("kuukkeli", () => { kuukkeliSearch(); });
definePreview("liiga", () => { overlay = (t) => { liigaDraw(t); tram(40); }; });
definePreview("toimisto", () => { overlay = (t) => { liigaDraw(t); tram(40); r(124, 90, 34, 22, "#0c0c10"); doorBurst((t + 300) % 1000 * .7, 141, 110); }; });   // prologin oven pamahdus
definePreview("suomi", () => { overlay = (t) => { g.drawImage(paintBg("seMap", seFinlandMapBg), 0, 0); mapClouds(t); }; });
definePreview("kartta", () => { overlay = (t) => { g.drawImage(paintBg("europe", europeMapBg), 0, 0); mapClouds(t); plane(...EUP.ist, .3); }; });
definePreview("kaivokatu", (Q) => { const x0 = +Q.get("x"); overlay = (t) => kaivokatuWalk(t, x0 || 20 + (t / 1000 * 62) % (KK_END - 20), false); });
definePreview("loppu", () => { overlay = (t) => { mouhoInDraw(t); rinkTV(t); boardTable(t);          // valmentajat loppukohtauksen paikoillaan
  person("jalonen", 160, 110, t, { sc: .85 }); person("valtonen", 200, 120, t, { sc: .85 }); shadow(176, 128, 7); jussi(176, 128, -1, 0, {});
  person("jokinen", 222, 126, t, { sc: .85 }); npc(8, 240, 128, t, { sc: .85 }); npc(9, 258, 127, t, { sc: .85 }); }; });
definePreview("hallitus", () => { overlay = (t) => { mouhoInDraw(t); boardTable(t); shadow(176, 128, 7); jussi(176, 128, -1, 0, {});
  for (let i = 0; i < 6; i++) npc(i, 14 + i * 13, 110, t, { sc: .85 });
  person("maskotti", 22, 124, t, { sc: .85 }); person("saarni", 46, 124, t, { sc: .85 }); merchant(72, 124, t); salesman(96, 124, t); ghostRef(154, 122, t); }; });
definePreview("puhelu", () => { overlay = (t) => { r(0, 0, W, H, "#140f1c"); panelDraw(PANEL.L, 0, "jussi", t, kisaPanel, false); panelDraw(PANEL.R, 0, "myrra", t, coachPanel, false); }; });
definePreview("esineet", () => { overlay = () => { r(0, 0, W, H, "#1c1c4c"); Object.keys(ITEMS).forEach((k, i) => { const x = 10 + (i % 6) * 51, y = 4 + Math.floor(i / 6) * 44;   // kuvakkeet 48 x 32 ääriviivoineen
  g.drawImage(icon(k), x, y); text3(k.toUpperCase().slice(0, 10), x, y + 35, "#a8a8d8"); }); }; });
// hahmot: vertailuksi valokuvapäät (Jussi, Raimo, Saarni, valmentajat) ja sivuhahmot edestä ja takaa
definePreview("hahmot", () => { overlay = (t) => { r(0, 0, W, H, "#4c5c6c"); r(0, 62, W, 2, "#3c4c5c"); r(0, 130, W, 6, "#3c3c44");
  jussi(40, 58, 1, 0, {}); helminen(90, 58, t); person("saarni", 140, 58, t); merchant(210, 58, t); salesman(250, 58, t); person("jalonen", 278, 58, t); person("valtonen", 304, 58, t);
  for (let i = 0; i < 6; i++) npc(i, 24 + i * 27, 126, t);
  for (let i = 0; i < 6; i++) npc(i, 186 + i * 22, 126, t, { back: true }); }; });
definePreview("sp", () => { overlay = (t) => { r(0, 0, W, H, "#c4cce0"); r(0, 64, W, 2, "#aab4cc"); r(0, 132, W, 4, "#aab4cc");
  for (let i = 0; i < 9; i++) spDraw(spGen(i + 1), 20 + i * 35, 62, t, { talking: i === 2 });
  const fixed = [{ hat: "fetsi" }, { hat: "huivi" }, { hat: "lippis" }, { hat: "pipo" }, { glasses: "pyöreät", female: true }, { hair: "kalju", age: "vanha", glasses: "suorakulmaiset" }, { stache: true, hair: "sotkuinen" }, { beard: true }, { build: 2 }];
  fixed.forEach((o, i) => spDraw(spGen(40 + i, o), 20 + i * 35, 130, t)); }; });
// valmentajat: Jalonen, Valtonen, Jokinen ja apurit seisomassa ja kävelemässä omien ruutujensa sävyissä
definePreview("valmentajat", () => { overlay = (t) => {
  vgrad(0, 0, 107, H, ["#2c2850", "#4a3066", "#6a3a68"]); vgrad(107, 0, 106, H, ["#c8c4bc", "#b4b0a8"]); vgrad(213, 0, 107, H, ["#6c1c58", "#d04c48", "#f8a048"]);
  r(0, 112, 107, 24, "#3c3c4c"); r(107, 112, 106, 24, "#9c9ca4"); r(213, 112, 107, 24, "#8c6c4c");
  text3("KISAPUISTO", 4, 4, "#fcfcfc"); text3("LENTOASEMA", 111, 4, "#2c2c34"); text3("BASAARI", 217, 4, "#fcfcfc");
  person("jalonen", 34, 86, t); person("jalonen", 74, 132, t, { moving: true });
  person("valtonen", 140, 86, t); person("valtonen", 180, 132, t, { moving: true, dir: -1 });
  person("jokinen", 236, 86, t); npc(8, 262, 86, t); npc(9, 288, 86, t);
  person("jokinen", 236, 132, t, { moving: true }); npc(8, 262, 132, t, { moving: true }); npc(9, 288, 132, t, { moving: true }); }; });
