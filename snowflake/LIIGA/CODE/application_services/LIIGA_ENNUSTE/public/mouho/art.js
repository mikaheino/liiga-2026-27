// Mouhon salaisuus -- grafiikka. Kaikki piirretään koodilla (ei kuvatiedostoja).
// Käyttää engine.js:n piirtokirjastoa: r, px, vgrad, dither, disc, tri, glow, shadow, paintBg.
"use strict";

// Jussi: iso pää (karikatyyri hockeydb-kuvan mukaan): lyhyet vaaleat sivulle
// harjatut hiukset, siniset silmät, leveä hymy hampaineen, vahva leuka.
// Vartalo pieni, pää 14 x 15 px. Fedora ja ruoska näkyvät kun ne on hankittu.
function jussi(x, y, dir, frame, st, sc = 1, back = false) {
  g.save(); g.translate(x | 0, y | 0); g.scale(dir < 0 ? -sc : sc, sc);
  const p = (dx, dy, w, h, c) => r(dx, dy, w, h, c);          // origo: jalkojen keskikohta
  const step = frame % 4, l1 = step === 1 ? 2 : step === 3 ? -1 : 0, l2 = -l1;
  const SK = "#f0b890", SKD = "#d89870", HR = "#e8c870", HRL = "#f8e4a0", HRD = "#b8944c";
  // jalat ja saappaat
  p(-4 + l1, -10, 3, 9, "#4c3c24"); p(1 + l2, -10, 3, 9, "#3c2c1c");
  p(-5 + l1, -2, 4, 2, "#201408"); p(1 + l2, -2, 4, 2, "#201408");
  // vartalo: khakipaita, keltainen kaulus (SaiPa), vyö
  p(-5, -21, 10, 11, "#c8a460"); p(-5, -12, 10, 2, "#5c3c1c"); p(-1, -20, 1, 7, "#a88440");
  p(-3, -22, 6, 2, "#fcd41c"); p(-1, -21, 2, 2, "#fcd41c");
  p(-7, -20, 2, 8, "#c8a460"); p(5, -20, 2, 8, "#b8944c"); p(-7, -13, 2, 2, SK); p(5, -13, 2, 2, SKD);
  if (st.whip) { p(3, -15, 3, 3, "#6c4420"); p(4, -14, 1, 1, "#3c2410"); }
  // kaula
  p(-2, -23, 4, 2, SKD);
  // pää: leveä, vahva leuka
  p(-6, -36, 12, 13, SK); p(-7, -33, 1, 6, SK); p(6, -33, 1, 6, SK);           // posket
  p(-5, -24, 10, 1, SKD); p(-4, -23, 8, 1, SKD);                                 // leuka
  p(-8, -31, 1, 3, SKD); p(7, -31, 1, 3, SKD);                                   // korvat
  if (back) {                                  // poispäin kävellessä: niska ja takaraivo
    p(-6, -36, 12, 10, "#e8c870"); p(-7, -34, 1, 6, "#e8c870"); p(6, -34, 1, 6, "#e8c870"); p(-5, -26, 10, 2, "#d0a860"); p(-2, -24, 4, 1, SKD);
    p(-4, -35, 3, 1, "#f8e4a0"); p(1, -33, 3, 1, "#b8944c"); p(-8, -31, 1, 3, SKD); p(7, -31, 1, 3, SKD);
    if (st.hat) { p(-9, -36, 18, 2, "#6c4c2c"); p(-6, -41, 12, 5, "#7c5c34"); p(-6, -37, 12, 1, "#3c2414"); }
    g.restore(); return;
  }
  // silmät: valkoinen + sininen, kulmat
  p(-4, -31, 3, 2, "#fcfcfc"); p(1, -31, 3, 2, "#fcfcfc"); p(-3, -31, 2, 2, "#3c7cc8"); p(2, -31, 2, 2, "#3c7cc8");
  p(-4, -33, 3, 1, HRD); p(1, -33, 3, 1, HRD);
  p(0, -29, 1, 2, SKD);                                                           // nenä
  // leveä hymy hampaineen -- puhuessa suu aukeaa ja sulkeutuu
  if (st.talk ?? (speaking === "jussi" && Math.floor(performance.now() / 110) % 2)) { p(-3, -28, 6, 3, "#5c1c14"); p(-2, -28, 4, 1, "#fcfcfc"); p(-2, -26, 4, 1, "#c84c4c"); }
  else { p(-4, -26, 8, 1, "#8c3c2c"); p(-3, -27, 6, 1, "#fcfcfc"); p(-4, -27, 1, 1, "#8c3c2c"); p(3, -27, 1, 1, "#8c3c2c"); }
  p(-5, -28, 1, 1, SKD); p(4, -28, 1, 1, SKD);                                    // hymykuopat
  // hiukset: lyhyet, vaaleat, sivulle harjatut
  if (st.hat) {
    p(-7, -35, 2, 4, HR); p(5, -35, 2, 3, HR);                                    // näkyy hatun alta
    p(-9, -36, 18, 2, "#6c4c2c"); p(-6, -41, 12, 5, "#7c5c34"); p(-6, -37, 12, 1, "#3c2414"); p(-1, -41, 2, 1, "#5c3c1c");
  } else {
    p(-7, -38, 14, 3, HR); p(-6, -39, 11, 1, HR); p(-7, -35, 2, 4, HR); p(5, -35, 2, 3, HR);
    p(-5, -39, 4, 1, HRL); p(-2, -38, 6, 1, HRL); p(2, -37, 4, 1, HRD); p(-7, -36, 3, 1, HRD);
  }
  g.restore();
}
// ================================================================ RUUTUJEN TAITEET
// ---- kotilaituri --------------------------------------------------------------
const KOTI_STARS = starfield(80, 66, 3);
function kotiBg() {
  vgrad(0, 0, W, 76, ["#04041a", "#07072a", "#0c0c3c", "#141452", "#1c1c66", "#26267a", "#30308c"]);
  for (const [x, y, b] of KOTI_STARS) px(x, y, b > .85 ? "#fcfcfc" : b > .5 ? "#a0a0e0" : "#5858a8");
  for (let j = -18; j <= 18; j++) for (let i = -18; i <= 18; i++) { const d = Math.hypot(i, j); if (d > 10 && d < 18 && bay(252 + i, 20 + j) < (18 - d) / 16) px(252 + i, 20 + j, "#3c3ca0"); }
  disc(252, 20, 10, "#f6f2c0", "#dcd8a0"); disc(248, 17, 2, "#e4e0a8"); disc(256, 24, 2, "#e4e0a8"); disc(257, 15, 1, "#e4e0a8"); r(244, 18, 2, 1, "#fcfce0");
  // kaukainen ranta: kuusia
  seed = 11; r(0, 70, W, 6, "#050920");
  for (let x = -4; x < W; x += 4 + ((rnd() * 5) | 0)) { const h = 6 + ((rnd() * 11) | 0); tri(x, 76 - h, 7, h, "#050920"); }
  px(118, 71, "#fcd45c"); px(119, 71, "#e8b43c"); px(201, 72, "#fcd45c");
  // vesi
  vgrad(0, 76, W, 32, ["#0a1440", "#0c1848", "#09123a", "#070e2e", "#050a24"]);
  dither(0, 76, W, 3, "#0a1440", "#040818", 0.6);
  // venevaja
  r(6, 74, 66, 6, "#1c1410"); dither(6, 74, 66, 6, "#1c1410", "#2a2018", .4);
  r(10, 40, 56, 36, "#3c2618"); for (let x = 12; x < 66; x += 4) r(x, 40, 1, 36, "#2c1a10");
  tri(4, 24, 68, 17, "#5a2418"); for (let j = 27; j < 41; j += 3) r(4 + (41 - j) * 2, j, 68 - (41 - j) * 4, 1, "#3c160e");
  r(26, 52, 12, 24, "#120a06"); r(25, 51, 14, 1, "#5c3c22"); r(25, 51, 1, 25, "#5c3c22"); r(38, 51, 1, 25, "#5c3c22"); px(35, 64, "#c8a45c");
  r(45, 47, 12, 10, "#2c1a10"); r(46, 48, 10, 8, "#ffd76a"); r(51, 48, 1, 8, "#2c1a10"); r(46, 52, 10, 1, "#2c1a10"); r(46, 48, 4, 3, "#fff0b0");
  // laituri
  for (let x = 4; x < W; x += 38) r(x, 98, 4, 12, "#24160a");
  for (let row = 0; row < 7; row++) { const y = 108 + row * 4; r(0, y, W, 4, row % 2 ? "#4c3018" : "#56381e"); r(0, y, W, 1, row % 2 ? "#5e4024" : "#6a4828"); r(0, y + 3, W, 1, "#2c1a0c");
    seed = 31 + row; for (let x = (rnd() * 40) | 0; x < W; x += 40 + ((rnd() * 30) | 0)) { r(x, y, 1, 4, "#2c1a0c"); px(x + 2, y + 1, "#8c6c44"); } }
  r(0, 106, W, 2, "#2c1a0c");
  // juliste tolpassa
  r(79, 76, 3, 32, "#3a2410"); r(68, 48, 26, 30, "#2c1c0e"); r(70, 50, 22, 26, "#ece0bc"); dither(70, 70, 22, 6, "#ece0bc", "#d8c8a0", .3);
  r(72, 52, 18, 5, "#c81c1c"); r(73, 53, 16, 1, "#fc5c3c"); for (let k = 0; k < 4; k++) r(72, 59 + k * 2, 8 + (k * 5) % 9, 1, "#6c6c6c");
  r(72, 68, 18, 5, "#2c7c2c"); r(74, 69, 14, 1, "#5cbc5c"); px(70, 50, "#9c9c9c"); px(91, 50, "#9c9c9c");
  // postilaatikon tolppa, naulakko, lyhtypylväs
  r(112, 88, 3, 20, "#4c4c4c"); r(113, 88, 1, 20, "#6c6c6c");
  r(150, 64, 2, 44, "#4a2e16"); r(151, 64, 1, 44, "#6a4626"); r(145, 106, 12, 2, "#3a2410"); r(145, 64, 12, 2, "#4a2e16");
  r(226, 56, 2, 52, "#1c1c26"); r(222, 52, 10, 5, "#2c2c38"); r(223, 51, 8, 1, "#3c3c4c"); r(224, 57, 6, 2, "#fce88c");
  // säästöpossu
  r(187, 99, 10, 8, "#fc9cb4"); r(186, 100, 12, 6, "#fc9cb4"); r(188, 99, 6, 2, "#fcbccc"); r(197, 101, 3, 3, "#fc7c9c"); px(198, 102, "#c84c6c");
  r(188, 106, 2, 2, "#d87c94"); r(194, 106, 2, 2, "#d87c94"); r(189, 99, 4, 1, "#3c1c24"); px(195, 100, "#000"); r(185, 101, 1, 2, "#fc9cb4");
  // taksi
  r(254, 90, 58, 16, "#e8c81c"); r(254, 100, 58, 6, "#c8a414"); r(254, 90, 58, 1, "#fce870"); r(264, 81, 36, 10, "#e8c81c"); r(265, 80, 34, 1, "#fce870");
  r(267, 83, 13, 7, "#4c7cd0"); r(283, 83, 14, 7, "#4c7cd0"); r(268, 84, 3, 1, "#a8c8fc"); r(284, 84, 3, 1, "#a8c8fc");
  r(275, 76, 14, 4, "#202020"); for (const xx of [277, 280, 283, 286]) px(xx, 77, "#fcd41c");
  r(282, 91, 1, 12, "#a88c10"); r(254, 96, 58, 1, "#202020"); for (let x = 256; x < 312; x += 4) px(x, 96, "#e8e8e8");
  disc(267, 106, 5, "#141414", "#2c2c2c"); disc(300, 106, 5, "#141414", "#2c2c2c"); disc(267, 106, 2, "#8c8c8c"); disc(300, 106, 2, "#8c8c8c");
  r(310, 93, 2, 4, "#fcfcbc"); r(254, 94, 2, 3, "#c81c1c");
}
const KOTI_TW = KOTI_STARS.filter((s) => s[2] > .7).slice(0, 14);
function kotiDraw(t) {
  g.drawImage(paintBg("koti", kotiBg), 0, 0);
  KOTI_TW.forEach(([x, y], i) => { if (Math.sin(t / 260 + i * 1.7) > .82) { px(x - 1, y, "#8c8cdc"); px(x + 1, y, "#8c8cdc"); px(x, y - 1, "#8c8cdc"); px(x, y + 1, "#8c8cdc"); px(x, y, "#fff"); } });
  for (let y = 78; y < 106; y += 2) { const k = (y - 78) / 28, w = (7 - k * 3) + Math.sin(t / 220 + y) * 2.2; r(252 - w / 2 + Math.sin(t / 340 + y * .8) * 2, y, w, 1, k < .4 ? "#e8e4a8" : k < .7 ? "#b0ae84" : "#6c6c64"); }
  for (let i = 0; i < 22; i++) { const x = (i * 47 + t / (24 + (i % 4) * 8)) % (W + 20) - 10, y = 79 + ((i * 7) % 26); r(x, y, 3 + (i % 5), 1, i % 3 ? "#1c3478" : "#2c4c9c"); }
  const by = 95 + Math.sin(t / 650) * 1.2, bx = 132 + Math.sin(t / 1300) * 2;
  r(bx - 14, by, 28, 4, "#6a3c1c"); r(bx - 12, by + 4, 24, 2, "#4a2810"); r(bx - 14, by, 28, 1, "#9c6c3c"); r(bx - 4, by - 1, 8, 1, "#3c2410"); r(bx + 6, by - 3, 1, 9, "#8c5c2c");
  r(bx - 14, by + 6, 28, 1, "#0c1c4c");
  glow(51, 52, 24, "255,200,90", .22 + .04 * Math.sin(t / 500)); glow(227, 58, 30, "255,230,150", .28 + .03 * Math.sin(t / 130));
  glow(227, 112, 26, "255,220,140", .10);
  const open = st.flags.boxOpen;
  r(105, 79, 18, 10, "#2c4cc8"); r(105, 79, 18, 1, "#5c7cfc"); r(105, 88, 18, 1, "#1c2c8c");
  if (open) { r(105, 74, 18, 3, "#3c5cdc"); r(107, 81, 14, 6, "#08081c"); if (!st.flags.letterTaken) { r(109, 82, 9, 4, "#f4f4f4"); r(110, 83, 4, 1, "#c81c1c"); } }
  else { r(105, 79, 18, 3, "#3c5cdc"); r(112, 84, 4, 1, "#08081c"); }
  r(122, 80, 2, 7, "#c81c1c"); r(124, 80, 3, 3, "#c81c1c");
  if (!st.hat) { r(142, 62, 16, 2, "#5c3c1c"); r(145, 56, 10, 6, "#7c5c34"); r(145, 60, 10, 1, "#2c1808"); r(146, 56, 3, 1, "#9c7c4c"); }
}

// ---- basaari ------------------------------------------------------------------
function basaariBack() {
  vgrad(0, 0, W, 66, ["#24123c", "#4a1848", "#7c2448", "#b43c40", "#e0603a", "#f48c3c", "#fcb85c"]);
  disc(70, 44, 11, "#fce890", "#fcd070"); for (let j = -20; j <= 20; j++) for (let i = -20; i <= 20; i++) { const d = Math.hypot(i, j); if (d > 11 && d < 20 && bay(70 + i, 44 + j) < (20 - d) / 22) px(70 + i, 44 + j, "#fcc460"); }
  const M = "#3a1834";
  seed = 5; for (let x = 0; x < W; x += 8 + ((rnd() * 10) | 0)) r(x, 48 - ((rnd() * 8) | 0), 10 + ((rnd() * 8) | 0), 20, "#5a2444");
  disc(170, 30, 17, M); r(150, 30, 42, 4, M); disc(146, 40, 8, M); disc(194, 40, 8, M); disc(132, 46, 5, M); disc(208, 46, 5, M);
  r(124, 40, 94, 26, M); r(169, 9, 2, 6, M); px(170, 8, M);
  for (const [x, top] of [[116, 10], [224, 10], [102, 22], [238, 22]]) { r(x, top, 3, 60, M); tri(x, top - 7, 3, 7, M); r(x - 1, top + 12, 5, 1, M); r(x - 1, top + 24, 5, 1, M); }
  for (let x = 128; x < 216; x += 7) px(x, 50, "#fcb04c");
  // takaseinä kaarineen
  noise(0, 52, W, 26, "#b0744a", ["#9c6438", "#c4885a", "#a46c40"], .3);
  for (let i = 0; i < 6; i++) { const x = i * 54 + 8; disc(x + 19, 62, 13, "#4a2414"); r(x + 6, 62, 27, 16, "#4a2414"); r(x + 8, 64, 23, 14, "#3a1c10"); }
  for (const [x, c1, c2] of [[2, "#7c1c3c", "#e8b43c"], [58, "#1c4c7c", "#e8d4a4"], [272, "#2c6c3c", "#e8b43c"]]) { r(x + 4, 56, 14, 20, c1); r(x + 6, 58, 10, 16, c2); r(x + 9, 62, 4, 8, c1); }
  for (let x = 0; x < W; x += 20) { r(x, 54, 10, 10, "#b81c1c"); r(x + 10, 54, 10, 10, "#ece4c4"); r(x, 54, 20, 1, "#e8c8a8"); }
  for (let x = 0; x < W; x += 5) tri(x, 64, 5, 2, (x / 5) % 4 < 2 ? "#b81c1c" : "#ece4c4");
  // alaseinä ja kojujen takainen varjokäytävä (muuten edellinen ruutu näkyi läpi)
  noise(0, 71, W, 37, "#6a3c22", ["#5a3018", "#7a4a2c"], .3); for (let x = 0; x < W; x += 18) r(x, 71, 1, 37, "#4a2814");
  g.fillStyle = "rgba(20,0,0,.28)"; g.fillRect(0, 66, W, 8);
}
function basaariFront() {
  // mukulakivet
  r(0, 106, W, 30, "#6c4422");
  for (let row = 0; row < 7; row++) for (let x = -(row % 2) * 5; x < W; x += 10) { const y = 107 + row * 4.3, c = ["#8c5c30", "#9c6a3a", "#845428", "#a07040"][(x * 7 + row * 3) & 3]; r(x + 1, y, 8, 3, c); r(x + 1, y, 8, 1, "#b48450"); }
  // matto kehyksessä (kartta kudottuna)
  r(27, 66, 3, 42, "#5c3418"); r(64, 66, 3, 42, "#5c3418"); r(25, 65, 44, 3, "#6c3c1c");
  r(30, 70, 34, 38, "#6c1428"); r(32, 72, 30, 34, "#b42c38"); r(35, 75, 24, 28, "#d8983c");
  for (let j = 0; j < 28; j++) for (let i = 0; i < 24; i++) if ((i + j) % 6 === 0) px(35 + i, 75 + j, "#c87c2c");
  disc(47, 89, 5, "#2c3c8c"); disc(47, 89, 3, "#e8c84c"); px(47, 89, "#b42c38");
  for (let k = 0; k < 9; k++) px(38 + k * 2, 100 - (k % 3), "#c81c1c"); r(55, 97, 1, 3, "#1c1c1c"); r(54, 98, 3, 1, "#1c1c1c");
  for (let x = 30; x < 64; x += 2) r(x, 108, 1, 2, "#e8d8a8");
  // mausteröykkiöt
  for (const [x, c, hi] of [[108, "#c83c1c", "#fc6c3c"], [128, "#e8b41c", "#fce06c"], [148, "#5c8c2c", "#8cbc4c"], [168, "#8c4c1c", "#b4743c"]]) {
    r(x, 96, 16, 12, "#c8b080"); r(x - 1, 94, 18, 3, "#dcc490"); r(x, 106, 16, 2, "#a89060"); tri(x + 1, 87, 14, 8, c); dither(x + 3, 90, 9, 3, c, hi, .35); px(x + 8, 87, hi); }
  // kauppiaan koju
  r(192, 54, 78, 6, "#2c7c4c"); for (let x = 192; x < 270; x += 12) r(x, 54, 6, 6, "#e8e0c4"); r(192, 60, 78, 1, "#1c4c2c");
  r(196, 60, 2, 22, "#5c3418"); r(264, 60, 2, 22, "#5c3418");
  r(196, 80, 70, 28, "#6a3c1c"); for (let y = 82; y < 92; y += 3) r(196, y, 70, 1, "#5a3014"); r(196, 80, 70, 1, "#8c5c2c");
  r(196, 92, 70, 16, "#24448c"); r(196, 92, 70, 1, "#e8c81c"); for (let x = 200; x < 266; x += 8) { px(x, 98, "#e8c81c"); px(x - 1, 99, "#e8c81c"); px(x + 1, 99, "#e8c81c"); px(x, 100, "#e8c81c"); }
  for (const x of [199, 206]) { r(x, 74, 6, 5, "#d8a81c"); r(x + 5, 73, 3, 2, "#d8a81c"); r(x + 1, 72, 3, 2, "#e8c84c"); px(x + 1, 75, "#fcf09c"); }
  r(244, 72, 10, 7, "#3c8cbc"); r(246, 70, 6, 2, "#3c8cbc"); r(253, 73, 3, 1, "#3c8cbc"); px(246, 74, "#e8f4fc"); r(246, 76, 6, 1, "#e8e8e8");
  r(0, 66, 10, 42, "#2c140a"); r(310, 66, 10, 42, "#2c140a"); r(10, 66, 1, 42, "#5c3418"); r(309, 66, 1, 42, "#5c3418");
}
const CROWD = Array.from({ length: 6 }, (_, i) => ({ x: i * 60, v: (i % 2 ? -1 : 1) * (6 + i * 1.7), fez: i % 3 === 0, c: ["#3c1c24", "#2c1c34", "#4c2c1c"][i % 3] }));
function figure(x, y, c, fez, t, v) { const st2 = Math.floor(t / 180) % 2; r(x - 2, y - 12, 5, 8, c); disc(x, y - 14, 2, c); if (fez) r(x - 1, y - 17, 3, 2, "#7c1c1c"); r(x - 2 + (st2 ? 1 : 0), y - 4, 2, 4, c); r(x + 1 - (st2 ? 1 : 0), y - 4, 2, 4, c); }
function merchant(x, y, t, talking = false) {
  const blink = Math.sin(t / 400) > .93, arm = Math.sin(t / 700) * 2;
  shadow(x, y, 9);
  r(x - 7, y - 22, 14, 22, "#8c1c1c"); r(x - 7, y - 22, 3, 22, "#a83030"); r(x + 4, y - 22, 3, 22, "#6c1414"); r(x - 7, y - 13, 14, 3, "#e8c81c"); px(x, y - 12, "#fcf09c");
  r(x - 7, y - 2, 14, 2, "#5c1010");
  r(x - 9, y - 20 + arm, 2, 8, "#8c1c1c"); r(x - 9, y - 12 + arm, 2, 2, "#d89060"); r(x + 7, y - 20, 2, 8, "#6c1414"); r(x + 7, y - 12, 2, 2, "#c88050");
  r(x - 4, y - 32, 9, 10, "#d89060"); r(x + 3, y - 31, 2, 8, "#c07850");
  r(x - 4, y - 25 + (talking && Math.floor(t / 120) % 2 ? 1 : 0), 9, 5, "#ececec");
  if (talking && Math.floor(t / 120) % 2) r(x - 1, y - 26, 3, 1, "#3c1c14"); r(x - 3, y - 21, 7, 2, "#d8d8d8"); r(x - 3, y - 27, 7, 1, "#3c2414");
  if (!blink) { px(x - 2, y - 29, "#000"); px(x + 2, y - 29, "#000"); } r(x - 3, y - 31, 3, 1, "#3c2414"); r(x + 1, y - 31, 3, 1, "#3c2414"); px(x, y - 27, "#a86040");
  r(x - 3, y - 37, 7, 5, "#c81c1c"); r(x - 3, y - 37, 7, 1, "#e83c3c"); r(x - 4, y - 33, 9, 1, "#9c1414");
  const tas = Math.round(Math.sin(t / 300) * 1.5); r(x + 3, y - 37, 1, 1, "#1c1c1c"); r(x + 4 + (tas > 0 ? 1 : 0), y - 36, 1, 3, "#1c1c1c");
}
function basaariDraw(t) {
  g.drawImage(paintBg("basaariBack", basaariBack), 0, 0);
  for (let i = 0; i < 3; i++) { const x = ((t / (38 + i * 9) + i * 130) % 380) - 30, y = 14 + i * 9 + Math.sin(t / 320 + i) * 3, up = Math.floor(t / 160 + i) % 2;
    px(x, y + up, "#2c1428"); px(x + 1, y, "#2c1428"); px(x + 2, y + 1, "#2c1428"); px(x + 3, y, "#2c1428"); px(x + 4, y + up, "#2c1428"); }
  for (const p of CROWD) { p.x = ((p.x + p.v * 0.016) + 340) % 340 - 10; figure(p.x, 82, p.c, p.fez, t + p.x * 20, p.v); }
  g.drawImage(paintBg("basaariFront", basaariFront), 0, 0);
  if (!st.flags.bag) { r(92, 74, 1, 4, "#3c3c3c"); r(88, 78, 10, 12, "#c8b48c"); r(88, 78, 10, 1, "#e0d0a8"); r(90, 79, 6, 2, "#a8946c"); r(96, 80, 2, 10, "#a8946c"); }
  if (!st.whip) { r(222, 72, 16, 2, "#6c4420"); r(236, 63, 2, 11, "#6c4420"); r(233, 62, 6, 2, "#6c4420"); r(222, 72, 2, 2, "#3c2410"); px(239, 62, "#3c2410"); }
  for (const x of [44, 118, 160, 290]) { const f = .5 + .5 * Math.sin(t / 110 + x); r(x, 66, 1, 3, "#3c2c1c"); r(x - 2, 69, 5, 7, "#a8741c"); r(x - 1, 70, 3, 5, f > .5 ? "#fce070" : "#fcc040"); r(x - 2, 76, 5, 1, "#7c541c"); glow(x, 72, 13, "255,160,60", .16 + .05 * f); }
}

// ---- luolatemppeli ------------------------------------------------------------
function temppeliBg() {
  noise(0, 0, W, 108, "#2a1a10", ["#3a2616", "#1c1008", "#33210f", "#24160c"], .4);
  for (let y = 18; y < 104; y += 9) { seed = y; let yy = y; for (let x = 0; x < W; x++) { if (rnd() < .2) yy += rnd() < .5 ? -1 : 1; yy = Math.max(y - 2, Math.min(y + 2, yy)); px(x, yy, "#1a0e06"); if (rnd() < .3) px(x, yy - 1, "#46301c"); } }
  r(0, 0, W, 8, "#120904"); seed = 3; for (let x = 0; x < W; x += 6 + ((rnd() * 9) | 0)) { const h = 3 + ((rnd() * 10) | 0), w = 4 + ((rnd() * 4) | 0); for (let j = 0; j < h; j++) { const ww = Math.max(1, Math.round(w * (1 - j / h))); r(x + (w - ww) / 2, 8 + j, ww, 1, "#120904"); } px(x + w / 2, 8 + h, "#5c4c3c"); }
  r(244, 0, 20, 8, "#7c6c4c"); r(248, 0, 12, 8, "#a8946c");
  // kaiverrettu oviaukko idolin takana
  r(240, 40, 36, 68, "#100804"); r(232, 40, 8, 68, "#5a4632"); r(276, 40, 8, 68, "#5a4632"); r(232, 40, 2, 68, "#6c5640"); r(276, 40, 2, 68, "#6c5640");
  r(229, 37, 14, 4, "#6c5640"); r(273, 37, 14, 4, "#6c5640"); r(228, 30, 60, 7, "#6c5640"); r(228, 30, 60, 1, "#86704e");
  for (let x = 234; x < 284; x += 8) { r(x, 32, 4, 3, "#3c2c1c"); px(x + 1, 33, "#86704e"); }
  disc(258, 34, 2, "#3c2c1c"); px(258, 34, "#e8c81c");
  // reliefi vasemmalla
  r(110, 42, 40, 32, "#3c2a18"); r(110, 42, 40, 1, "#56402a"); r(110, 73, 40, 1, "#1c1008");
  for (let i = 0; i < 34; i++) px(113 + i, 56 + Math.round(Math.sin(i / 3) * 3), "#56402a");
  disc(130, 48, 3, "#2a1c10"); px(130, 48, "#86704e"); r(116, 64, 6, 6, "#2a1c10"); r(138, 64, 6, 6, "#2a1c10");
  // seitit
  for (let k = 0; k < 7; k++) { for (let j = 0; j < 16; j++) px(16 + j * Math.cos(k / 4.5), 8 + j * Math.sin(k / 4.5) * 1.2, "#5c5c5c"); }
  for (const rr of [5, 10, 14]) for (let a = 0; a < 1.5; a += .12) px(16 + rr * Math.cos(a), 8 + rr * Math.sin(a) * 1.2, "#4c4c4c");
  // lattia ja kuilu
  noise(0, 108, 160, 28, "#4c3420", ["#3e2a18", "#5a3e26"], .25); noise(196, 108, 124, 28, "#4c3420", ["#3e2a18", "#5a3e26"], .25);
  for (let x = 0; x < W; x += 16) if (x < 160 || x >= 196) r(x, 108, 1, 28, "#2e1e10"); r(0, 118, 160, 1, "#2e1e10"); r(196, 118, 124, 1, "#2e1e10"); r(0, 128, 160, 1, "#2e1e10"); r(196, 128, 124, 1, "#2e1e10");
  r(0, 108, 160, 1, "#6c4c30"); r(196, 108, 124, 1, "#6c4c30");
  vgrad(160, 108, 36, 28, ["#1c1008", "#0a0503", "#000000", "#000000"]);
  for (let y = 108; y < 136; y += 2) { px(160 + (y % 3), y, "#3c2818"); px(195 - (y % 3), y, "#3c2818"); }
  r(149, 103, 6, 5, "#d8d0b8"); r(150, 108, 4, 1, "#d8d0b8"); px(150, 105, "#1c1008"); px(153, 105, "#1c1008"); r(156, 106, 6, 1, "#c8c0a8");
  // hiekkakasa
  for (let j = 0; j < 15; j++) { const w = Math.round(36 * Math.pow((j + 1) / 15, .55)), y = 93 + j; for (let i = 0; i < w; i++) { const x = 85 - w / 2 + i; px(x, y, bay(x, y) < j / 15 ? "#b08c48" : bay(x, y) < .7 ? "#d8b46c" : "#c8a45c"); } }
  px(84, 93, "#f0d090"); px(80, 96, "#f0d090"); px(90, 98, "#f0d090");
  // jalusta, koukku, ovi, soihtujen pidikkeet
  r(250, 87, 16, 21, "#7c6c5c"); r(262, 87, 4, 21, "#5c4c3c"); r(247, 84, 22, 4, "#9c8c7c"); r(247, 84, 22, 1, "#b4a494"); r(252, 94, 8, 1, "#5c4c3c"); r(252, 100, 8, 1, "#5c4c3c");
  r(176, 8, 2, 18, "#5c5c5c"); r(172, 25, 10, 2, "#7c7c7c"); r(180, 21, 2, 5, "#7c7c7c"); px(172, 25, "#9c9c9c");
  r(0, 58, 16, 50, "#0a0503"); r(16, 58, 2, 50, "#4a3622"); r(0, 56, 18, 2, "#4a3622");
  r(28, 58, 6, 2, "#3c3c3c"); r(284, 58, 6, 2, "#3c3c3c");
}
const DUST = Array.from({ length: 16 }, (_, i) => ({ x: 246 + (i * 7) % 20, y: (i * 13) % 84, s: 3 + (i % 4) }));
let darkC = null;
function flame(x, y, t) { const f = (Math.sin(t / 70 + x) + Math.sin(t / 113 + x * 2)) / 2; r(x, y, 3, 10, "#4c2c14"); r(x - 1, y - 1, 5, 2, "#3c3c3c");
  const h = 6 + f * 2; r(x - 1, y - h, 5, h, "#c83c0c"); r(x, y - h - 2, 3, h, "#fc8c1c"); r(x + 1, y - h - 3 + (f > 0 ? 1 : 0), 1, h - 1, "#fcfc7c");
  if (Math.sin(t / 37 + x) > .9) px(x + 1 + Math.sin(t / 50) * 2, y - h - 6, "#fcc040"); }
function temppeliDraw(t) {
  g.drawImage(paintBg("temppeli", temppeliBg), 0, 0);
  if (st.flags.whipHung) r(176, 27, 1, 44, "#6c4420");
  if (st.flags.crossed) { r(152, 130, 54, 5, "#3c2a18"); r(152, 130, 54, 1, "#5a3e26"); for (let x = 156; x < 204; x += 7) px(x, 132, "#24160c"); }
  if (!st.flags.idol) { const sp = Math.sin(t / 260); r(254, 74, 8, 10, "#e8c81c"); r(255, 72, 6, 3, "#e8c81c"); r(254, 74, 2, 10, "#fcf06c"); r(260, 74, 2, 10, "#b8941c");
    px(256, 77, "#3c2c0c"); px(259, 77, "#3c2c0c"); r(256, 80, 4, 1, "#b8941c"); if (sp > .6) { px(257, 70, "#fff"); px(256, 71, "#fcfc9c"); px(258, 71, "#fcfc9c"); } }
  else if (st.flags.swapped) { r(253, 77, 10, 7, "#c8b48c"); r(253, 77, 10, 1, "#e0d0a8"); r(256, 76, 4, 1, "#a8946c"); }
  if (st.flags.boulder != null) { const bx = st.flags.boulder, rot = bx / 6; disc(bx, 91, 17, "#6c5c4c", "#3c3024"); disc(bx - 5, 85, 5, "#84725e");
    r(bx + Math.cos(rot) * 8, 91 + Math.sin(rot) * 8, 4, 3, "#3c3024"); r(bx - Math.cos(rot) * 9, 91 - Math.sin(rot) * 6, 3, 3, "#3c3024"); shadow(bx, 108, 16); }
}
function temppeliPost(t) {
  darkC ??= Object.assign(document.createElement("canvas"), { width: W, height: H });
  const L = darkC.getContext("2d"); L.globalCompositeOperation = "source-over"; L.clearRect(0, 0, W, H); L.fillStyle = "rgba(6,3,0,.66)"; L.fillRect(0, 0, W, H);
  L.globalCompositeOperation = "destination-out";
  const hole = (x, y, rad, a) => { const gr = L.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(1, "rgba(0,0,0,0)"); L.fillStyle = gr; L.fillRect(x - rad, y - rad, rad * 2, rad * 2); };
  const f = Math.sin(t / 90) * 4 + Math.sin(t / 53) * 2;
  hole(31, 46, 74 + f, .95); hole(287, 46, 74 - f, .95); hole(st.x, st.y - 18, 34, .55); hole(256, 70, 40, .8);
  L.beginPath(); L.moveTo(246, 0); L.lineTo(262, 0); L.lineTo(274, 90); L.lineTo(238, 90); L.closePath(); L.fillStyle = "rgba(0,0,0,.6)"; L.fill();
  g.drawImage(darkC, 0, 0);
  g.fillStyle = "rgba(255,236,170,.07)"; g.beginPath(); g.moveTo(246, 0); g.lineTo(262, 0); g.lineTo(274, 90); g.lineTo(238, 90); g.closePath(); g.fill();
  for (const d of DUST) { d.y = (d.y + d.s * 0.012) % 86; px(d.x + Math.sin(t / 700 + d.y) * 3 + d.y * .1, d.y, "#f8e4b0"); }
  flame(30, 50, t); flame(286, 50, t); glow(31, 44, 36, "255,130,40", .28); glow(287, 44, 36, "255,130,40", .28);
}

// ---- alkuruutu, matka ja loppu --------------------------------------------------
// Alkuruutu: kesäpäivä satamatorin kioskilla (fiilis satamasanni.com-kuvista, ei logoja).
function tree(cx, cy, rad, seedv) {
  seed = seedv; const cols = ["#2c6c1c", "#3c8424", "#4c9c2c", "#6cb43c"];
  for (let k = 0; k < 26; k++) { const a = rnd() * 6.3, d = rnd() * rad, x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * .8; disc(x, y, 5 + rnd() * 6, cols[(rnd() * 2) | 0]); }
  for (let k = 0; k < 18; k++) { const a = rnd() * 6.3, d = rnd() * rad * .8, x = cx + Math.cos(a) * d - 3, y = cy + Math.sin(a) * d * .7 - 4; disc(x, y, 2 + rnd() * 3, cols[2 + ((rnd() * 2) | 0)]); }
}
function titleBg() {
  vgrad(0, 0, W, 70, ["#5c84c8", "#6c94d4", "#7ca4dc", "#90b4e4", "#a8c4ec"]);
  r(20, 40, 280, 16, "#6c7c8c"); for (let x = 20; x < 300; x += 6) r(x, 40, 3, 16, "#7c8c9c"); r(20, 38, 280, 2, "#5c6c7c");
  r(60, 56, 200, 20, "#c8c8c0"); for (let x = 64; x < 256; x += 14) r(x, 60, 9, 8, "#8c9cac");
  tree(46, 50, 30, 4); tree(160, 40, 30, 8); tree(276, 46, 32, 12);
  r(0, 72, W, 18, "#e8e4d8"); r(0, 72, W, 2, "#b8b4a8"); for (let x = 0; x < W; x += 22) r(x, 72, 1, 18, "#a8a49c");
  for (let x = 0; x < W; x += 12) r(x, 78, 8, 8, "#a8c4d0");
  // kioski
  r(112, 54, 96, 12, "#ece0c4"); r(112, 54, 96, 1, "#fcf4dc"); r(112, 65, 96, 1, "#8c7c5c"); r(159, 54, 2, 12, "#8c7c5c");
  g.fillStyle = "#2c1c10"; g.font = "9px VT323, monospace"; g.textAlign = "center"; g.fillText("VETYJÄ", 136, 63); g.fillText("ATOMEJA", 184, 63); g.textAlign = "left";
  for (let x = 112; x < 208; x += 6) { r(x, 66, 3, 10, "#fcd41c"); r(x + 3, 66, 3, 10, "#fcfcf0"); }
  for (let x = 112; x < 208; x += 3) tri(x, 76, 3, 2, (x / 3) % 2 ? "#fcfcf0" : "#fcd41c"); r(112, 66, 96, 1, "#e8b40c");
  r(114, 78, 92, 12, "#3c2c24"); r(118, 79, 20, 9, "#1c140c"); r(182, 79, 20, 9, "#1c140c"); r(142, 80, 10, 10, "#ece4cc"); r(166, 80, 10, 10, "#ece4cc");
  for (let k = 0; k < 3; k++) { r(143, 82 + k * 2, 8, 1, "#8c7c6c"); r(167, 82 + k * 2, 8, 1, "#8c7c6c"); } r(143, 87, 3, 2, "#c81c1c");
  r(114, 90, 92, 10, "#5c3c24"); for (let x = 114; x < 206; x += 4) r(x, 90, 1, 10, "#4c2c18");
  // tori: laatat ja vaaleat raidat
  vgrad(0, 100, W, 36, ["#a89488", "#b4a094", "#bca89c", "#c4b0a4"]);
  for (let y = 102; y < 136; y += 3 + ((y - 100) / 6 | 0)) r(0, y, W, 1, "#988478");
  for (let j = 0; j < 36; j++) { const y = 100 + j, w = 4 + j * .5; r(160 - w / 2 + j * 1.3, y, w, 1, "#ddd0c4"); }
  r(0, 104, W, 2, "#d4c8bc"); r(0, 120, W, 2, "#d4c8bc");
  // lyhtypylväät kukkaampeleineen
  for (const x of [44, 266]) { r(x, 50, 2, 52, "#4c5c5c"); r(x - 4, 48, 10, 3, "#6c7c7c"); r(x - 6, 76, 14, 2, "#3c3c3c");
    for (const dx of [-6, 6]) { disc(x + dx + 1, 80, 4, "#e84c8c"); px(x + dx, 78, "#fcfcfc"); px(x + dx + 2, 81, "#fc9cc4"); r(x + dx, 84, 2, 2, "#3c6c2c"); } }
  // pöydät ja tuolit
  for (const x of [20, 70, 236, 290]) { r(x, 96, 14, 2, "#2c2c2c"); r(x + 6, 98, 2, 6, "#2c2c2c"); r(x - 4, 94, 3, 10, "#1c1c1c"); r(x + 15, 94, 3, 10, "#1c1c1c"); }
}
const PARASOLS = [[92, 70], [228, 70]];
const QUEUE = [[126, "#2c3c6c", "#e8c8a8"], [138, "#c8c8c8", "#5c3c2c"], [176, "#fce81c", "#e8c0a0"], [190, "#4c2c4c", "#3c2c1c"], [202, "#c84c4c", "#d8b088"]];
function drawTitle(t) {
  g.drawImage(paintBg("title", titleBg), 0, 0);
  for (let i = 0; i < 4; i++) { const x = ((t / (90 + i * 20) + i * 95) % 380) - 40, y = 8 + i * 6; disc(x, y, 5, "#fcfcfc"); disc(x + 7, y - 2, 6, "#fcfcfc"); disc(x + 14, y, 5, "#fcfcfc"); r(x - 3, y + 2, 21, 3, "#fcfcfc"); r(x - 3, y + 4, 21, 1, "#dce4f0"); }
  for (const [x, y] of PARASOLS) { r(x, y, 1, 32, "#8c8c8c"); tri(x - 14, y - 6, 29, 7, "#f4f4ec"); r(x - 14, y, 29, 1, "#c8c8c0"); }
  QUEUE.forEach(([x, shirt, hair], i) => { const sw = Math.round(Math.sin(t / 500 + i) * .6); r(x - 2 + sw, 86, 5, 9, shirt); disc(x + sw, 83, 2, "#e8b890"); r(x - 2 + sw, 81, 5, 1, hair); r(x - 2, 95, 2, 6, "#2c2c3c"); r(x + 1, 95, 2, 6, "#2c2c3c"); });
  const gx = ((t / 30) % 380) - 30; px(gx, 30 + Math.sin(t / 200) * 2, "#fcfcfc"); px(gx + 1, 29, "#fcfcfc"); px(gx + 2, 30, "#fcfcfc"); px(gx + 3, 29, "#fcfcfc"); px(gx + 4, 30 + Math.sin(t / 200) * 2, "#fcfcfc");
  shadow(160, 128, 7); jussi(160, 128, 1, Math.floor(t / 900) % 2 ? 0 : 0, { hat: true });
  g.textAlign = "center"; g.font = "30px VT323, monospace";
  g.fillStyle = "#1c0c00"; g.fillText("MOUHON SALAISUUS", 162, 30);
  const gr = g.createLinearGradient(0, 10, 0, 30); gr.addColorStop(0, "#fff4b0"); gr.addColorStop(.5, "#fcc81c"); gr.addColorStop(1, "#c8641c");
  g.fillStyle = gr; g.fillText("MOUHON SALAISUUS", 160, 28); g.lineWidth = 1; g.strokeStyle = "#5c2c00"; g.strokeText("MOUHON SALAISUUS", 160, 28);
  g.font = "11px VT323, monospace"; g.fillStyle = "#1c1c3c"; g.fillText("Jussi Markkanen ja kadonneen osallistumismaksun metsästys", 161, 39); g.fillStyle = "#fcfcfc"; g.fillText("Jussi Markkanen ja kadonneen osallistumismaksun metsästys", 160, 38);
  if (Math.floor(t / 600) % 2) { g.fillStyle = "#1c1c1c"; g.fillText("Klikkaa aloittaaksesi", 161, 133); g.fillStyle = "#fcfc54"; g.fillText("Klikkaa aloittaaksesi", 160, 132); }
  g.textAlign = "left";
}
function mapBg() {
  noise(0, 0, W, H, "#e4d0a0", ["#d8c490", "#ecdcb0", "#d0b884"], .35);
  const land = (pts, c) => { g.fillStyle = c; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill(); };
  land([[100, 4], [150, 2], [160, 30], [150, 52], [128, 58], [112, 48], [104, 26]], "#a8c08c");
  land([[40, 60], [120, 56], [170, 64], [200, 70], [150, 84], [110, 92], [60, 86]], "#b4c894");
  land([[180, 86], [300, 80], [316, 104], [280, 120], [200, 116], [176, 100]], "#bccc8c");
  g.fillStyle = "#8cb0c8"; g.fillRect(150, 82, 40, 8); g.fillRect(110, 96, 90, 40);
  g.fillStyle = "#4c3c24"; g.font = "10px VT323, monospace"; g.fillText("SUOMI", 118, 26); g.fillText("Helsinki", 112, 46); r(126, 39, 2, 2, "#4c3c24"); g.fillText("TURKKI", 232, 100); g.fillText("Mustameri", 196, 78);
  r(286, 10, 1, 18, "#5c4c34"); r(278, 18, 17, 1, "#5c4c34"); g.fillText("P", 284, 8);
  g.strokeStyle = "#8c6c44"; g.strokeRect(2.5, 2.5, W - 5, H - 5);
}
async function travel(from = [132, 34], to = [226, 104]) {
  const start = performance.now(), dur = 3600;
  overlay = (t) => {
    const k = Math.min((t - start) / dur, 1);
    g.drawImage(paintBg("map", mapBg), 0, 0);
    const [ax, ay] = from, [bx, by] = to, n = Math.floor(k * 48);
    const at = (q) => [ax + (bx - ax) * q, ay + (by - ay) * q - Math.sin(q * Math.PI) * 22];
    for (let i = 0; i < n; i += 2) { const [x, y] = at(i / 48); r(x, y, 2, 2, "#b81c1c"); }
    const [x, y] = at(n / 48); r(x - 4, y, 9, 2, "#2c2c2c"); r(x - 1, y - 3, 3, 8, "#2c2c2c"); r(x - 4, y - 1, 2, 4, "#2c2c2c"); px(x + 4, y, "#fcfcfc");
    if (k >= 1) { r(bx - 3, by - 1, 7, 1, "#b81c1c"); r(bx, by - 4, 1, 7, "#b81c1c"); }
  };
  await sleep(dur + 500); overlay = null;
}
// Loppu: Mouho 2026, Kaivokatu 10, 4. krs (recordlydata.com/events/mouho-2026):
// 2v2 NHL PS5:llä, 3 min erät, parit arvotaan, pizza n. 18.30 -- ja osallistuminen on ILMAINEN.
function mouhoBg() {
  vgrad(0, 0, W, 108, ["#1c1c2c", "#24243a", "#2c2c44"]);
  for (const x of [8, 250]) { r(x, 14, 62, 46, "#0c1430"); for (let k = 0; k < 14; k++) r(x + 4 + (k * 13) % 54, 22 + (k * 7) % 34, 3, 2 + (k % 3), k % 4 ? "#fcd45c" : "#8cacfc");
    r(x, 36, 62, 1, "#3c3c4c"); r(x + 30, 14, 2, 46, "#3c3c4c"); r(x - 2, 12, 66, 2, "#4c4c5c"); r(x - 2, 60, 66, 3, "#4c4c5c"); }
  r(0, 8, W, 3, "#3c3c54");
  r(92, 6, 136, 12, "#c81c1c"); r(92, 6, 136, 1, "#fc5c5c"); r(92, 17, 136, 1, "#7c0c0c");
  g.textAlign = "center"; g.font = "11px VT323, monospace"; g.fillStyle = "#fcfc54"; g.fillText("MOUHO 2026 · 2v2 NHL", 160, 15); g.textAlign = "left";
  r(96, 24, 128, 70, "#0c0c0c"); r(98, 26, 124, 64, "#1c1c1c"); r(156, 94, 8, 6, "#2c2c2c"); r(140, 100, 40, 2, "#2c2c2c");
  r(186, 100, 18, 3, "#ececec"); r(187, 99, 16, 1, "#fcfcfc"); px(200, 100, "#3c7cfc");
  r(0, 102, W, 34, "#3c3448"); for (let y = 104; y < 136; y += 6) r(0, y, W, 1, "#342c40");
  r(60, 106, 200, 14, "#2c4c7c"); r(60, 104, 200, 4, "#3c5c8c"); r(56, 104, 8, 18, "#24406c"); r(256, 104, 8, 18, "#24406c");
  for (const [x, y] of [[18, 118], [30, 114], [276, 116]]) { r(x, y, 20, 4, "#e8d8b8"); r(x, y, 20, 1, "#fcf0d8"); r(x + 6, y + 1, 8, 1, "#c81c1c"); }
  r(286, 96, 10, 10, "#e8c81c"); r(284, 94, 14, 3, "#fcd84c"); r(289, 106, 4, 4, "#c8a41c"); r(286, 110, 10, 2, "#8c6c1c"); px(288, 98, "#fcf4ac");
}
function rinkTV(t) {
  r(100, 28, 120, 60, "#d8ecfc"); r(100, 28, 120, 1, "#fcfcfc"); r(159, 28, 2, 60, "#c81c1c"); r(130, 28, 1, 60, "#3c5cdc"); r(189, 28, 1, 60, "#3c5cdc");
  g.strokeStyle = "#c81c1c"; g.beginPath(); g.arc(160, 58, 10, 0, 7); g.stroke();
  r(101, 50, 4, 16, "#c81c1c"); r(215, 50, 4, 16, "#c81c1c");
  const k = t / 900, puck = [160 + Math.sin(k) * 48, 58 + Math.sin(k * 1.7) * 18];
  const pl = (x, y, c) => { r(x - 2, y - 6, 5, 6, c); disc(x, y - 7, 1, "#f0c0a0"); r(x + 2, y - 2, 4, 1, "#5c3c1c"); };
  pl(puck[0] - 6 + Math.sin(k * 3) * 2, puck[1] + 2, "#c81c1c"); pl(puck[0] + 8, puck[1] - 6, "#2c4cc8");
  pl(160 + Math.cos(k * .8) * 30, 40 + Math.sin(k) * 6, "#2c4cc8"); pl(140 + Math.sin(k * 1.3) * 22, 76, "#c81c1c");
  r(puck[0], puck[1], 2, 1, "#000");
  r(100, 82, 120, 6, "#000a"); g.font = "7px VT323, monospace"; g.fillStyle = "#fcfcfc"; g.fillText(`HOME 2  -  AWAY ${Math.floor(t / 7000) % 4}   3:00`, 104, 87);
  g.fillStyle = "rgba(255,255,255,.04)"; for (let y = 28; y < 88; y += 2) g.fillRect(100, y, 120, 1);
}
function host(x, y, t, shirt) { const b = Math.round(Math.sin(t / 450 + x) * .6); shadow(x, y, 6); r(x - 3, y - 8, 3, 8, "#2c2c3c"); r(x + 1, y - 8, 3, 8, "#2c2c3c");
  r(x - 4, y - 19 + b, 9, 11, shirt); disc(x, y - 23 + b, 4, "#e8b890"); r(x - 4, y - 27 + b, 9, 3, "#5c3c24"); px(x - 1, y - 23 + b, "#000"); px(x + 2, y - 23 + b, "#000"); r(x - 6, y - 16 + b, 2, 7, "#e8b890"); }
async function ending() {
  st.scene = "loppu"; $game.classList.add("cut");
  await travel([226, 104], [127, 40]);
  overlay = (t) => { g.drawImage(paintBg("mouho", mouhoBg), 0, 0); rinkTV(t); host(236, 128, t, "#2c7c4c"); host(84, 128, t, "#7c2c6c"); shadow(168, 128, 7); jussi(168, 128, 1, 0, { hat: true, whip: true }); };
  $sent.textContent = "";
  await say("Kaivokatu 10, 4. kerros. Mouho 2026.", "muu");
  await say("Täältä tullaan! 500 euroa osallistumismaksua, käteisenä, kultaisen idolin kautta hankittuna!");
  await say("Järjestäjä: \"Osallistuminen on ilmaista.\"", "muu");
  await say("...Ilmaista?");
  await say("Järjestäjä: \"Ilmoittautuminen on kuitenkin sitova. Parit arvotaan paikan päällä, erät ovat kolme minuuttia, pizza tulee puoli seitsemältä.\"", "muu");
  await say("Sitten tällä kertaa raha menee oikeaan osoitteeseen. Pizzaan.");
  await say("Mouhoness: ei apuja, ei armoa. Vain taito, refleksit ja trash talk.\nHyvässä hengessä tietysti.", "muu");
  await say(`Mouho-IQ: ${iqTotal()} / ${IQ_MAX}. ${iqTotal() >= IQ_MAX ? "Täydet pisteet. Mouhoness saavutettu." : "Löytyikö kaikki? Kokeile uudestaan."}`, "muu");
  $say.innerHTML = '<div class="line" style="left:50%;bottom:76%;color:#fcfc54">MOUHO 2026 · 22.5. klo 17<br>Kaivokatu 10, 4. krs, Helsinki</div>';
  $game.classList.remove("cut");
  $dlg.replaceChildren(Object.assign(document.createElement("button"), { textContent: "Pelaa uudestaan", onclick: () => location.reload() }));
  $game.classList.add("talking");
}

// Salkkumies (satama): liituraitapuku, aurinkolasit yölläkin, kultaketju, salkku.
// Pikseleinä samalla mittakaavalla kuin Jussi ja Mehmet.
function salesman(x, y, t, talking = false) {
  const sw = Math.sin(t / 700) > 0 ? 0 : 1, arm = talking ? Math.round(Math.sin(t / 140) * 2) : 0, mo = talking && Math.floor(t / 110) % 2;
  shadow(x, y, 7);
  r(x - 4, y - 12, 3, 11, "#1c1e2a"); r(x + 1, y - 12, 3, 11, "#24263a"); r(x - 5, y - 2, 4, 2, "#0c0c0c"); r(x + 1, y - 2, 5, 2, "#0c0c0c"); px(x + 4, y - 2, "#8c8c9c");
  r(x - 6, y - 26 + sw, 12, 15, "#2a2c3c"); for (let xx = x - 5; xx < x + 6; xx += 2) r(xx, y - 25 + sw, 1, 13, "#3a3c52");
  r(x - 2, y - 26 + sw, 4, 6, "#f0f0f0"); r(x - 1, y - 25 + sw, 2, 7, "#c81c1c"); r(x - 2, y - 26 + sw, 1, 1, "#e8c430"); r(x + 1, y - 26 + sw, 1, 1, "#e8c430"); px(x, y - 23 + sw, "#e8c430");
  r(x + 6, y - 24 + sw, 2, 10, "#2a2c3c"); r(x + 6, y - 14 + sw, 2, 2, "#e8b48c");
  r(x - 8, y - 24 + sw - arm, 2, 9, "#2a2c3c"); r(x - 8, y - 15 + sw - arm, 2, 2, "#e8b48c");
  r(x + 7, y - 12, 7, 6, "#6c4420"); r(x + 7, y - 12, 7, 1, "#8c5c2c"); r(x + 9, y - 13, 3, 1, "#c8a030");
  r(x - 2, y - 28 + sw, 4, 2, "#d89c74");
  r(x - 5, y - 37 + sw, 10, 10, "#e8b48c"); r(x + 3, y - 36 + sw, 2, 8, "#d09c74");
  r(x - 5, y - 39 + sw, 10, 3, "#1c140c"); r(x - 6, y - 38 + sw, 2, 4, "#1c140c"); px(x - 2, y - 39 + sw, "#5c4c3c");
  r(x - 5, y - 34 + sw, 10, 2, "#0c0c14"); px(x - 4, y - 34 + sw, "#7ca0fc"); px(x + 1, y - 34 + sw, "#7ca0fc"); r(x - 1, y - 34 + sw, 2, 1, "#0c0c14");
  if (mo) r(x - 2, y - 30 + sw, 4, 2, "#4a1410"); else { r(x - 3, y - 30 + sw, 6, 1, "#fcfcfc"); px(x + 1, y - 30 + sw, "#e8c430"); r(x - 3, y - 29 + sw, 6, 1, "#a86048"); }
}
