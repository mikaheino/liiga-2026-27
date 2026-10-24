"use strict";
// Mouhon salaisuus -- prologi "Kiitos yhteistyöstä" (vaihe 3, 17.10.): Jussi potkitaan
// koomisesti Liigan toimistosta Helsingistä ja hän lentää kartan yli Lappeenrantaan.
//   1. Liigan toimisto (punatiili, tummat syvennysikkunat, oranssit pylväät, raitiovaunu):
//      ovi aukeaa, saapas, Jussi ja pahvilaatikko lentävät.
//   2. Kaakkois-Suomen kartta: kaari Helsingistä itään, Kouvola harmaan pilven alla.
//   3. Kisapuisto: lehtikasaan, laatikko perään, nimikyltti päähän -- BONK.
// Klikkaus ohittaa animaation; repliikit ohittuvat kuten aina.

// ---------------------------------------------------------------- Liigan toimisto
// liiga_toimisto-kuvien punatiilitalo syysaamuna: matala aurinko vasemmalta, tummat
// syvennysikkunat taivaan heijastuksin, oranssit pylväät, lasinen katutaso kahvilineen.
// Taivas, ajelehtivat harsopilvet ja läpinäkyvä etuala (23.10.); liigaOfficeBg on koottu kiinteä versio.
function liigaStreaks(w) { seed = 31; for (let i = 0; i < 28; i++) { const x = (rnd() * W) | 0, y = 4 + ((rnd() * 34) | 0), cw = 6 + ((rnd() * 28) | 0);
  for (const xx of [x, x + W]) { r(xx, y, cw, 1, "#eef2f8"); r(xx + 2, y + 1, cw - 4, 1, y > 20 ? "#f8e0c8" : "#d4dcec"); } } }
function liigaOfficeBg() { liigaSky(); liigaStreaks(W); liigaFg(); }
function liigaSky() {
  vgrad(0, 0, W, 64, ["#6c90c8", "#84a4d4", "#a4bcdc", "#c8d0e0", "#e8d8cc", "#f4d4b0"]);
  for (let j = -16; j <= 16; j++) for (let i = -16; i <= 16; i++) { const d = Math.hypot(i, j); if (d < 16 && bay(14 + i, 50 + j) < (16 - d) / 18) px(14 + i, 50 + j, "#fff4d8"); }
}
function liigaDraw(t) { g.drawImage(paintBg("liiga_sky", liigaSky), 0, 0); drift("liiga_clouds", 4, liigaStreaks, t); g.drawImage(paintBg("liiga_fg", liigaFg), 0, 0); }
function liigaFg() {
  seed = 33;
  // kaukana: kaupungin siluetti ja Helsingin piippu
  for (let x = 0; x < W; x += 9 + ((rnd() * 9) | 0)) { const h = 8 + ((rnd() * 14) | 0); r(x, 64 - h, 8, h, "#9ca8bc"); for (let y = 66 - h; y < 62; y += 3) r(x + 2, y, 4, 1, "#b8c0d0"); }
  r(232, 30, 4, 34, "#a4acbc"); r(231, 28, 6, 3, "#8c94a4");
  // naapuri vasemmalla: valkoinen 60-luvun nauhaikkunatalo
  r(0, 26, 40, 86, "#e4e2dc"); r(38, 26, 2, 86, "#c4c2bc"); for (let y = 32; y < 104; y += 8) { r(2, y, 34, 4, "#5c6c84"); r(2, y, 34, 1, "#8ca0bc"); }
  // punatiilitalo: tiilet riveittäin, oikea pääty varjossa
  const BX = 44, BW = 266, TOP = 6, FLOOR = 88;
  r(BX, TOP, BW, FLOOR - TOP, "#a4503a");
  for (let y = TOP; y < FLOOR; y++) for (let x = BX; x < BX + BW; x++) { const brick = ((y >> 1) & 1 ? x + 2 : x) % 5 === 0 || (y & 1) === 0 && bay(x, y) < .18;
    if (brick) px(x, y, x > 254 ? "#6c3024" : "#8c4232"); else if (bay(x, y) < .12) px(x, y, x > 254 ? "#843c2c" : "#b45c42"); }
  r(254, TOP, 56, FLOOR - TOP, "rgba(40,20,30,.28)"); r(BX, TOP, BW, 2, "#c46c50"); r(BX, TOP + 2, BW, 1, "#6c3024");
  seed = 9; for (let row = 0; row < 6; row++) for (let col = 0; col < 18; col++) {
    const x = BX + 6 + col * 14.6, y = TOP + 6 + row * 13, shade = x > 250;
    r(x - 1, y - 1, 10, 12, shade ? "#3c1c18" : "#4c2420"); r(x, y, 8, 10, shade ? "#2c3444" : "#3c4c64");
    const lit = rnd() < .14; if (lit) { r(x, y, 8, 10, "#f4d48c"); r(x, y, 8, 2, "#fcecc0"); r(x + 2, y + 4, 3, 5, "#c89c5c"); }
    else { r(x + 1, y + 1, 6, 4, shade ? "#4c6080" : "#8cacd4"); r(x + 1, y + 1, 2, 2, "#d4e4f4"); }
    r(x - 1, y + 10, 10, 1, "#c4785c"); }
  // katutaso: lasi, oranssit pylväät, kahvila sisällä, sisäänkäynti
  r(BX, FLOOR, BW, 24, "#1c2028"); vgrad(BX + 2, FLOOR + 2, BW - 4, 20, ["#3c4c5c", "#2c3440", "#4c5464"]);
  for (let x = BX + 4; x < BX + BW - 4; x += 3) if (bay(x, 0) < .5) r(x, FLOOR + 2, 1, 20, "rgba(160,190,220,.25)");
  for (const [x, c] of [[70, "#c8a07c"], [82, "#3c2c24"], [96, "#7c4c3c"], [196, "#2c3c4c"], [228, "#e8c0a0"], [240, "#4c3c2c"]]) { r(x, FLOOR + 10, 5, 12, c); disc(x + 2, FLOOR + 8, 2, "#e8b894"); }
  for (const x of [74, 92, 232]) { r(x, FLOOR + 16, 10, 1, "#c8a46c"); r(x + 4, FLOOR + 17, 1, 5, "#c8a46c"); }
  for (const x of [56, 110, 164, 218, 272]) { r(x, FLOOR, 8, 24, "#d8742c"); r(x, FLOOR, 2, 24, "#f8a058"); r(x + 6, FLOOR, 2, 24, "#984c1c"); r(x, FLOOR, 8, 1, "#ffc080"); }
  r(124, FLOOR + 4, 34, 20, "#14161c"); r(126, FLOOR + 6, 14, 18, "#4c5c70"); r(142, FLOOR + 6, 14, 18, "#4c5c70"); r(127, FLOOR + 7, 3, 16, "#8ca4bc"); r(143, FLOOR + 7, 3, 16, "#8ca4bc");
  r(122, FLOOR - 4, 38, 7, "#14161c"); text3("LIIGA", 131, FLOOR - 3, "#f4f4f4"); r(120, FLOOR + 22, 42, 2, "#5c5c64");
  // jalkakäytävä, istutukset, pyörät, katu, raiteet, suojatie, ajolangat
  vgrad(0, 112, W, 7, ["#b4b0ac", "#9c9894"]); for (let x = 0; x < W; x += 10) r(x, 112, 1, 7, "#8c8884"); r(0, 112, W, 1, "#d4d0cc");
  for (const x of [90, 196]) { r(x, 106, 14, 7, "#5c5450"); r(x, 106, 14, 1, "#7c746c"); for (let k = 0; k < 14; k++) px(x + k, 104 + (k % 3), k % 2 ? "#c8782c" : "#e8a83c"); }
  for (const x of [270, 286]) { g.strokeStyle = "#1c1c24"; g.lineWidth = 1; g.beginPath(); g.arc(x, 114, 4, 0, 7); g.arc(x + 9, 114, 4, 0, 7); g.stroke(); lineC(x, 114, x + 5, 108, "#2c6cb4"); lineC(x + 5, 108, x + 9, 114, "#2c6cb4"); lineC(x + 5, 108, x + 4, 114, "#2c6cb4"); px(x, 114, "#8c8c9c"); px(x + 9, 114, "#8c8c9c"); r(x + 3, 106, 4, 1, "#14141c"); r(x + 8, 108, 3, 1, "#14141c"); }
  vgrad(0, 119, W, 17, ["#5c5c64", "#4c4c54", "#44444c"]); dither(0, 119, W, 17, "#4c4c54", "#545460", .2);
  for (const y of [125, 132]) { r(0, y, W, 1, "#a4a4ac"); r(0, y + 1, W, 1, "#24242c"); }
  for (let x = 172; x < 212; x += 6) r(x, 119, 4, 17, "#c8c8cc");
  for (const x of [24, 300]) { r(x, 16, 2, 96, "#3c3c44"); r(x - 2, 16, 6, 2, "#2c2c34"); }
  lineC(0, 18, W, 15, "#2c2c34"); lineC(0, 23, W, 21, "#2c2c34");
  // syysvaahterat
  for (const [x, y] of [[8, 70], [314, 64]]) { r(x - 1, y + 10, 3, 32, "#4c3424"); seed = x; for (let k = 0; k < 220; k++) { const a = rnd() * 6.3, d = Math.sqrt(rnd()) * 16; px(x + Math.cos(a) * d * 1.2, y + Math.sin(a) * d, ["#e8a83c", "#c8642c", "#f0c850", "#9c4c1c"][(rnd() * 4) | 0]); } }
}
function tram(x) {     // Helsingin vihreä-keltainen raitiovaunu
  r(x, 98, 96, 22, "#2c8c4c"); r(x, 98, 96, 3, "#3cac5c"); r(x, 112, 96, 6, "#e8c81c"); r(x, 118, 96, 2, "#2c2c2c");
  for (let k = 0; k < 7; k++) r(x + 4 + k * 13, 102, 10, 8, "#9cc4dc"); r(x + 88, 100, 6, 18, "#1c5c34");
  lineC(x + 40, 98, x + 48, 88, "#2c2c34"); lineC(x + 48, 88, x + 56, 98, "#2c2c34"); r(x + 44, 86, 10, 1, "#2c2c34");
  for (const k of [12, 40, 66, 84]) disc(x + k, 121, 2, "#1c1c1c");
}
// Ovi pamahtaa auki (palaute 24.10.: ei potkaisevaa saapasta): pölypilvi, vauhtiviivat ja PAM!
function doorBurst(ms, x, y) {
  const k = Math.min(1, ms / 900);
  if (k < 1) { g.save(); g.globalAlpha = 1 - k;
    for (let i = 0; i < 7; i++) { const a = -Math.PI * (.08 + i / 7.6), d = 6 + k * 24; disc(Math.round(x + Math.cos(a) * d * 1.5), Math.round(y + Math.sin(a) * d * .6), Math.round(3 + k * 5), i % 2 ? "#d8d0c0" : "#a8a090"); }
    g.restore(); }
  if (ms < 500) for (let i = 0; i < 4; i++) r(x + 18, y - 18 + i * 5, 10 + i * 3, 1, "#fcfcfc");
  if (ms < 800) { g.font = "bold 16px VT323, monospace"; g.lineWidth = 3; g.strokeStyle = "#1c0c0c"; g.strokeText("PAM!", x - 14, y - 28); g.fillStyle = "#fcd41c"; g.fillText("PAM!", x - 14, y - 28); }
}
function tumbleJussi(x, y, a, sc = 1) {
  g.save(); g.translate(x, y - 20 * sc); g.rotate(a); g.translate(-x, -(y - 20 * sc));
  jussi(x, y, 1, Math.floor(performance.now() / 90) % 4, { hat: false, whip: false }, sc); g.restore();
}
function tumbleBox(x, y, a, s = 1) {
  g.save(); g.translate(x, y); g.rotate(a); g.scale(s, s); r(-8, -6, 16, 12, "#b8925c"); r(-8, -6, 16, 1, "#dcb680"); r(-1, -6, 1, 12, "#8c6c3c"); r(-6, -10, 4, 4, "#f4f4ec"); r(1, -9, 6, 3, "#c8a030"); g.restore();
}

// ---------------------------------------------------------------- kartta
// Monkey Island 2 -henkinen pergamenttikartta: saaristo, metsät puu puulta, Saimaan labyrintti,
// kaupungit omina pikkukuvinaan, kompassiruusu, kartussi ja lautta Suomenlahdella.
// Kaakkois-Suomi oikeista koordinaateista (backlog 5.1): lon 23.5-30.5, lat 61.35 ylhäällä,
// leveysasteet kerrottu 1/cos(60.5°):lla, jotta mittasuhteet ovat oikeat.
const SEP = (lon, lat) => [(lon - 23.5) * 45.7, (61.35 - lat) * 92.8];
const MAPP = { hki: SEP(24.94, 60.17), kvl: SEP(26.70, 60.87), lpr: SEP(28.19, 61.06) };
function seFinlandMapBg() {
  seed = 3; noise(0, 0, W, H, "#e8d4a4", ["#dcc896", "#f0e0b8", "#d4bc88", "#e4cc9c"], .45);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const e = Math.min(i, j, W - 1 - i, H - 1 - j); if (e < 10 && bay(i, j) < (10 - e) / 12) px(i, j, "#b89c6c"); }
  seed = 5; for (const [cx, cy, rx, ry, c] of [[40, 50, 26, 16, "#d9b873"], [90, 30, 22, 12, "#b9a468"], [260, 40, 28, 18, "#d9b873"], [240, 80, 18, 10, "#b9a468"], [105, 75, 16, 10, "#d9b873"], [60, 90, 14, 8, "#b9a468"]])
    for (let j = cy - ry; j <= cy + ry; j++) for (let i = cx - rx; i <= cx + rx; i++) { const d = ((i - cx) / rx) ** 2 + ((j - cy) / ry) ** 2; if (d < 1 && ((i + j) & 1 ? d < .85 : d < .4 + rnd() * .2)) px(i, j, c); }
  for (const [x, y, rr] of [[40, 30, 12], [250, 110, 9]]) { g.strokeStyle = "rgba(140,100,50,.35)"; g.lineWidth = 2; g.beginPath(); g.arc(x, y, rr, .3, 5.6); g.stroke(); }   // kahvirenkaat
  // Suomenlahti: rannikko Porkkalasta Pietariin (lon, lat), saaristo rannan edustalla
  const coast = [[23.3, 59.98], [24, 60.05], [24.5, 60.1], [24.95, 60.15], [25.3, 60.22], [25.66, 60.3], [26, 60.35], [26.22, 60.42], [26.6, 60.42], [26.94, 60.46], [27.2, 60.55], [27.6, 60.5], [27.85, 60.55], [28.3, 60.55], [28.75, 60.7], [28.7, 60.55], [28.6, 60.36], [29, 60.2], [29.5, 60.18], [30, 60], [30.6, 59.95]].map(([lo, la]) => SEP(lo, la));
  fillPoly([...coast, [320, 136], [0, 136]], "#94b4c8"); for (let i = 0; i < coast.length - 1; i++) lineC(...coast[i], ...coast[i + 1], "#5c7c94");
  for (let i = 0; i < coast.length - 1; i++) { const [x0, y0] = coast[i], [x1, y1] = coast[i + 1]; lineC(x0, y0 + 2, x1, y1 + 2, "#b4ccdc"); }
  const wet = (x, y) => x >= 0 && y >= 0 && x < W && y < H && g.getImageData(x, y, 1, 1).data[2] > 180;
  seed = 23; for (let y = 87; y < 130; y += 3) for (let x = 20 + ((y * 7) % 9); x < 298; x += 8 + ((rnd() * 9) | 0)) if (wet(x, y) && wet(x + 1, y) && wet(x, y - 2)) r(x, y, 2, 1, "#cfe3ee");
  for (let y = 120; y < 136; y++) for (let x = 20; x < 300; x++) if ((x + y) % 2 === 0 ? y > 122 : y > 128) if (wet(x, y)) px(x, y, "#5d7ba3");
  for (let i = 0; i < coast.length - 1; i++) { const [x0, y0] = coast[i], [x1, y1] = coast[i + 1]; if (x0 > 58 && x1 < 245) { lineC(x0, y0 - 1, x1, y1 - 1, "#8a6a45"); lineC(x0, y0, x1, y1, "#e8f1f2"); } }
  for (const [x, y, w, h] of [[152, 104, 4, 2], [160, 107, 5, 3], [172, 101, 3, 2], [186, 108, 4, 2]]) { r(x + 1, y + h, w, 1, "#3d5a3a"); r(x, y, w, h, "#6f8a4a"); }
  seed = 17; for (let i = 0; i < 46; i++) { const x = (rnd() * W) | 0, y = 124 + ((rnd() * 10) | 0); r(x, y, 4, 1, "#b4ccdc"); px(x + 1, y - 1, "#b4ccdc"); }
  for (let i = 0; i < 30; i++) { const k = (rnd() * (coast.length - 1)) | 0, [x, y] = coast[k]; disc(x + (rnd() * 12 - 6) | 0, y + 3 + ((rnd() * 6) | 0), 1 + (i % 2), "#c8b484", "#8c7c54"); }
  // lautta
  r(110, 124, 16, 4, "#f4f4ec"); r(110, 127, 16, 1, "#2c4c7c"); r(114, 121, 8, 3, "#f4f4ec"); r(118, 118, 2, 3, "#c81c1c"); r(110, 128, 16, 1, "#3d4f78");
  for (const [yy, o] of [[125, 0], [127, 2], [129, 1]]) for (let k = 0; k < 4; k++) r(106 - o - k * 6, yy, 3 - (k > 2 ? 1 : 0), 1, "#ffffff");
  // järvet: Saimaa labyrinttina, pienempiä lammia
  // Saimaan eteläosa Lappeenrannan pohjoispuolella, Kymijoki, Vuoksi ja pikkujärvet
  { const saimaa = [[27.75, 61.35], [27.9, 61.15], [28.12, 61.09], [28.35, 61.12], [28.6, 61.18], [28.85, 61.2], [29.05, 61.3], [29.1, 61.4]].map(([lo, la]) => SEP(lo, la));
    fillPoly([...saimaa, [saimaa.at(-1)[0], 0], [saimaa[0][0], 0]], "#94b4c8"); for (let i = 0; i < saimaa.length - 1; i++) lineC(...saimaa[i], ...saimaa[i + 1], "#5c7c94");
    seed = 9; for (let i = 0; i < 14; i++) { const [x, y] = SEP(27.8 + rnd() * 1.2, 61.22 + rnd() * .12); disc(x, y, 1 + (i % 2), "#c8b484", "#8c7c54"); } }
  g.strokeStyle = "#7c9cb4"; g.lineWidth = 1;
  for (const R of [[[26.85, 61.35], [26.75, 61], [26.7, 60.87], [26.75, 60.65], [26.9, 60.47]], [[29.1, 61.4], [29.4, 61.2], [29.6, 61.05]]]) { g.beginPath(); R.forEach(([lo, la], k) => { const [x, y] = SEP(lo, la); k ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); }
  for (const [lo, la, rx, ry] of [[25.5, 61.2, 7, 3], [27.2, 61.25, 6, 3], [24.4, 60.6, 5, 2], [25.9, 60.8, 4, 2], [27.8, 60.95, 5, 2]]) { const [x, y] = SEP(lo, la);
    g.fillStyle = "#94b4c8"; g.beginPath(); g.ellipse(x, y, rx, ry, (x % 7) / 10, 0, 7); g.fill(); g.strokeStyle = "#5c7c94"; g.lineWidth = 1; g.stroke(); }
  // metsät: pikkukuuset sävyineen, vältä vettä ja kaupunkeja
  seed = 41; const clumps = [[22, 24], [50, 66], [92, 18], [118, 60], [225, 22], [262, 52], [286, 20], [232, 86], [30, 92]];
  for (let i = 0; i < 300; i++) { const [cx, cy] = clumps[i % clumps.length], x = (cx + (rnd() + rnd() - 1) * 26) | 0, y = (cy + (rnd() + rnd() - 1) * 18) | 0;
    if (x < 8 || x > 310 || y < 8 || y > 104) continue;
    const near = Object.values(MAPP).some(([mx, my]) => Math.hypot(mx - x, my - y) < 20) || wet(x + 2, y + 6) || wet(x + 2, y) || wet(x, y + 5) || wet(x + 4, y + 5);
    if (near) continue; tri(x, y, 5, 6, (x + y) % 3 ? "#6c8c4c" : "#5c7c40"); px(x + 2, y + 1, "#6f9a4a"); px(x + 1, y + 3, "#6f9a4a"); px(x + 3, y + 3, "#2c4a3c"); px(x + 3, y + 4, "#2c4a3c"); px(x + 4, y + 5, "#2c4a3c"); r(x + 2, y + 6, 1, 2, "#5c4c34"); }
  // tiet
  const road = (oy, c) => { const o = (lo, la) => SEP(lo, la).map((v, k) => v + k * oy); g.strokeStyle = c; g.lineWidth = 1; g.setLineDash([2, 1]); g.beginPath(); g.moveTo(MAPP.hki[0], MAPP.hki[1] + oy); g.bezierCurveTo(...o(25.6, 60.4), ...o(26.2, 60.75), MAPP.kvl[0], MAPP.kvl[1] + oy); g.bezierCurveTo(...o(27.2, 60.95), ...o(27.7, 61.0), MAPP.lpr[0], MAPP.lpr[1] + oy); g.stroke(); g.setLineDash([]); };
  road(1, "#b8955a"); road(0, "#8a4b3a");
  for (const [x, y] of Object.values(MAPP)) { r(Math.round(x) - 2, Math.round(y) - 2, 5, 5, "#3a2a30"); r(Math.round(x) - 1, Math.round(y) - 1, 3, 3, "#f3e6c0"); }
  const lab = (t, x, y, f) => { g.font = f; x = Math.round(x); y = Math.round(y); g.fillStyle = "#3a2a30"; for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1], [-1, 1]]) g.fillText(t, x + dx, y + dy); g.fillStyle = "#f3e6c0"; g.fillText(t, x, y); };
  { const [x, y] = SEP(28.5, 61.2); lab("Saimaa", x, y, "9px VT323, monospace"); }
  // kaupungit pikkukuvina
  { const [x, y] = MAPP.hki; r(x - 10, y - 6, 20, 8, "#f4f0e4"); r(x - 10, y - 6, 20, 1, "#ffffff"); r(x - 4, y - 12, 8, 6, "#f4f0e4"); disc(x, y - 14, 4, "#5c9c7c", "#3c6c54"); r(x - 1, y - 20, 2, 3, "#f0c84c");
    for (const dx of [-8, 6]) { r(x + dx, y - 10, 2, 4, "#f4f0e4"); disc(x + dx + 1, y - 11, 1, "#5c9c7c"); } for (let k = 0; k < 4; k++) r(x - 8 + k * 5, y - 3, 2, 3, "#8c9cac"); }
  { const [x, y] = MAPP.kvl; for (const [dx, h] of [[-12, 14], [-6, 20], [0, 16], [6, 22], [12, 12]]) { r(x + dx - 2, y - h, 5, h, "#626264"); r(x + dx - 2, y - h, 5, 1, "#79797D"); for (let yy = y - h + 2; yy < y - 1; yy += 3) r(x + dx - 1, yy, 3, 1, "#3A3938"); } }
  { const [x, y] = MAPP.lpr; r(x - 10, y - 8, 14, 9, "#e8b83c"); r(x - 10, y - 8, 14, 1, "#fcd870"); r(x + 4, y - 6, 10, 7, "#9c9cac"); r(x - 4, y - 5, 3, 3, "#1c1c1c");
    r(x + 6, y - 14, 1, 6, "#5c4c34"); fillPoly([[x + 7, y - 14], [x + 13, y - 12], [x + 7, y - 10]], "#fcd41c"); }
  for (const [k, label, dx, dy] of [["hki", "Helsinki", -16, 12], ["kvl", "Kouvola", -14, 10], ["lpr", "Lappeenranta", -24, 12]]) { const [x, y] = MAPP[k];
    lab(label, x + dx, y + dy, "10px VT323, monospace"); }
  lab("Suomenlahti", 140, 130, "9px VT323, monospace");
  // kartussi ja kompassiruusu
  r(8, 6, 92, 16, "#f4e4c0"); g.strokeStyle = "#6c4c2c"; g.lineWidth = 1; g.strokeRect(8.5, 6.5, 91, 15); g.strokeRect(10.5, 8.5, 87, 11);
  g.fillStyle = "#4c2c14"; g.font = "11px VT323, monospace"; g.fillText("KAAKKOIS-SUOMI", 16, 18);
  { const x = 290, y = 106; disc(x, y, 12, "#3a2a30"); disc(x, y, 11, "#f3e6c0"); disc(x, y, 8, "#e8d4a4", "#3a2a30");
    fillPoly([[x, y - 9], [x + 3, y], [x, y + 9], [x - 3, y]], "#6c4c2c"); fillPoly([[x - 9, y], [x, y - 3], [x + 9, y], [x, y + 3]], "#8c6c44"); fillPoly([[x, y - 9], [x + 3, y], [x - 3, y]], "#b81c1c");
    r(x, y - 12, 1, 4, "#3a2a30"); r(x, y + 9, 1, 4, "#3a2a30"); r(x - 12, y, 4, 1, "#3a2a30"); r(x + 9, y, 4, 1, "#3a2a30");
    lab("P", x - 2, y - 15, "9px VT323, monospace"); }
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const e = Math.min(i, j, W - 1 - i, H - 1 - j); if (e < 6 && (e < 2 || (i + j) & 1)) px(i, j, "#b8955a"); }
  g.strokeStyle = "#6c4c2c"; g.lineWidth = 1; g.strokeRect(2.5, 2.5, W - 5, H - 5); g.strokeStyle = "#a07c4c"; g.strokeRect(4.5, 4.5, W - 9, H - 9);
  for (const [x, y] of [[4, 4], [W - 9, 4], [4, H - 9], [W - 9, H - 9]]) { r(x, y, 5, 5, "#6c4c2c"); px(x + 2, y + 2, "#e8d4a4"); }
}
function kouvolaCloud(t) {  // Kouvolan oma harmaa sadepilvi (Kouvolan väripaletti), vain Kouvolan yllä
  const dx = Math.round(Math.sin(t / 2500) * 3), puffs = [[163, 64, 5], [172, 60, 7], [185, 62, 8], [197, 65, 6], [207, 66, 4]];
  for (const [cx, cy, rr] of puffs) for (let j = 0; j <= rr; j++) for (let i = -rr; i <= rr; i++) if (i * i + j * j <= rr * rr && (i + j + cx) & 1) px(cx + dx + i + 3, cy + j + 4, "#b8955a");
  for (const [cx, cy, rr] of puffs) for (let j = -rr; j <= rr; j++) for (let i = -rr; i <= rr; i++) { if (i * i + j * j > rr * rr) continue;
    const s = i + j; px(cx + dx + i, cy + j, s < -rr * .6 ? "#ffffff" : s > rr * .7 || (j > rr * .6 && (i + j) & 1) ? "#a9bdcc" : "#dfe9ee"); }
}
const flightAt = (q) => { const [ax, ay] = MAPP.hki, [bx, by] = MAPP.lpr; return [ax + (bx - ax) * q, ay - 10 + (by - ay) * q - Math.sin(q * Math.PI) * 50]; };

// ---------------------------------------------------------------- Kisapuisto: lehtikasa
const LAND = [178, 127];
// Laatikko jää siihen, mihin se putoaa (17.10.: "tavarat ovat eri paikassa ja ilmestyvät tyhjästä").
const BOX_AT = [LAND[0] - 34, LAND[1] + 3];
function leafPile(x, y, burst = 0) {
  seed = 5; for (let k = 0; k < 90; k++) { const a = rnd() * Math.PI, d = rnd() * 16; const X = x + Math.cos(a) * d * 1.3, Y = y - Math.sin(a) * d * .5;
    px(X, Y, ["#e8a83c", "#c8782c", "#f0c850", "#8c4c1c"][k % 4]); }
  if (burst > 0) for (let k = 0; k < 24; k++) { const a = -Math.PI * (k / 24), v = 30 + (k % 5) * 10, T = burst; px(x + Math.cos(a) * v * T, y + Math.sin(a) * v * T + 60 * T * T, ["#e8a83c", "#c8782c", "#f0c850"][k % 3]); }
}

// ---------------------------------------------------------------- prologi
async function prologue() {
  let skipAll = false;
  let fallen = false;    // putoamista Kisapuistoon ei voi ohittaa (palaute 24.10.: "Markkanen ei tippunut taivaalta")
  const onSkip = (e) => { if (!skip && !fallen) { skipAll = true; e.stopPropagation(); } else if (fallen && !skip) e.stopPropagation(); };
  cv.addEventListener("click", onSkip, true);
  const wait = (ms) => new Promise((res) => { const t0 = performance.now(), iv = setInterval(() => { if (skipAll || performance.now() - t0 >= ms) { clearInterval(iv); res(); } }, 30); });
  const line = async (text, who, at) => { if (skipAll) return; if (at) callSpk = { [who]: at }; await say(text, who); callSpk = null; };
  $game.classList.add("cut"); $sent.textContent = ""; music("seikkailu");
  try {
    // 1. Liigan toimisto
    let T0 = performance.now(), fly = null, door = null;
    overlay = () => {
      const now = performance.now(), k = (now - T0) / 1000;
      liigaDraw(now);
      tram(-120 + ((k * 70) % 560));
      if (door) { r(124, 90, 34, 22, "#0c0c10"); doorBurst(now - door, 141, 110); }
      if (fly) { const f = (now - fly) / 1000, x = 140 + f * 150, y = 108 - f * 140 + f * f * 40;
        tumbleJussi(x, y, f * 9); tumbleBox(x - 30 + f * 10, y + 14, -f * 7); r(x - 50, y + 22 - f * 6, 12, 4, "#c8a030"); }
    };
    await line("Helsinki. Liigan toimisto. Aamu.", "muu");
    door = performance.now(); beep(70, 160, "square", .08); await wait(250);
    beep(110, 90, "sawtooth", .08); fly = performance.now();
    line("Kiitos yhteistyöstä!", "muu");
    await wait(900);
    await line("Kiitos teillekin! Oli ilo olla...!", "jussi", { x: 250, y: 20, c: "#c8a460" });
    // 2. kartta
    T0 = performance.now(); let flyQ = 0;
    overlay = () => {
      const now = performance.now(); flyQ = Math.min(1, (now - T0) / 4200);
      g.drawImage(paintBg("seMap", seFinlandMapBg), 0, 0); mapClouds(now); kouvolaCloud(now);
      for (let i = 0; i < flyQ * 60; i += 2) { const [x, y] = flightAt(i / 60); r(x, y, 2, 2, "#b81c1c"); }
      const [x, y] = flightAt(flyQ); tumbleJussi(x, y + 10, now / 120, .45); tumbleBox(...flightAt(Math.max(0, flyQ - .06)), now / 150, .5);
    };
    await wait(1700);
    { const [x, y] = flightAt(.45); await line("Hyvä peli eilen!", "jussi", { x, y: y - 6, c: "#c8a460" }); }
    await wait(Math.max(0, 4300 - (performance.now() - T0)));
    // 3. Kisapuisto: putoaminen lehtikasaan, laatikko perään, nimikyltti päähän. Kaikki ajan
    // funktioina (ei ruututapahtumina), jotta hidas kone tai harva piirto ei ohita vaiheita.
    T0 = performance.now(); skipAll = false; fallen = true;
    const fall = (start, from, to, gpx) => (k) => (k < start ? null : Math.min(to, from + (k - start) ** 2 * gpx));
    const tJ = Math.sqrt((LAND[1] + 30) / 260), tB = tJ + .5 + Math.sqrt((LAND[1] + 22) / 300), tP = tB + .4 + Math.sqrt((LAND[1] - 36) / 320);
    const jF = fall(0, -30, LAND[1], 260), bF = fall(tJ + .5, -20, BOX_AT[1] - 1, 300), pF = fall(tB + .4, -10, LAND[1] - 46, 320);
    setTimeout(() => beep(80, 200, "triangle", .1), tJ * 1000); setTimeout(() => beep(60, 160, "square", .08), tB * 1000);
    setTimeout(() => { beep(1300, 60, "square", .08); setTimeout(() => beep(900, 120, "triangle", .06), 60); }, tP * 1000);
    overlay = (t) => {
      const k = (performance.now() - T0) / 1000;
      room().draw(t);
      // Ruudun esineet (taksi, ilmoitustaulu, postilaatikko) jo laskeutuessa, ettei näkymä
      // vaihdu kesken alkurepliikin (sokkotesti 2). Lehtikasa ja laatikko putoavat itse.
      for (const p of room().props.slice(1).filter((p) => p.draw !== kisaBox).sort((a, b) => a.y - b.y)) p.draw(t);
      leafPile(LAND[0], LAND[1], k > tJ && k < tJ + .7 ? (k - tJ) / .7 : 0);
      if (k >= tJ) jussi(LAND[0], LAND[1] + 2, 1, 0, { hat: false, whip: false }, depth(LAND[1])); else tumbleJussi(LAND[0], jF(k), k * 10, depth(LAND[1]));
      const by = bF(k); if (by != null) { if (k >= tB) kisaBox(); else tumbleBox(BOX_AT[0], by - 6, (k - tJ) * 8, 1.2); }   // laskeuduttuaan sama laatikko kuin pelissä
      const py = pF(k);
      if (py != null && k < tP + .9) { r(LAND[0] - 8, py, 16, 6, "#c8a030"); r(LAND[0] - 7, py + 1, 14, 1, "#fce870"); r(LAND[0] - 6, py + 3, 12, 1, "#3c2c10"); }
      if (k >= tP) { const s2 = k - tP; for (let i = 0; i < 4; i++) { const a = s2 * 6 + i * Math.PI / 2, sx = LAND[0] + Math.cos(a) * 10, sy = LAND[1] - 52 + Math.sin(a) * 3; r(sx, sy, 2, 2, "#fcf09c"); }
        if (s2 < .8) { g.font = "bold 14px VT323, monospace"; g.lineWidth = 3; g.strokeStyle = "#1c0c0c"; g.strokeText("BONK!", LAND[0] + 12, LAND[1] - 44); g.fillStyle = "#fcd41c"; g.fillText("BONK!", LAND[0] + 12, LAND[1] - 44); } }
    };
    await wait((tP + .9) * 1000);
    if (!skipAll) await line("\"Urheilujohtaja.\" Kiitos, nimikyltti. Muistan kyllä.", "jussi", { x: LAND[0], y: LAND[1] - 50, c: "#c8a460" });
  } finally {
    cv.removeEventListener("click", onSkip, true); overlay = null; callSpk = null; $game.classList.remove("cut");
    st.flags.leafPile = true; place(LAND[0], LAND[1]); music(GAME.roomMusic.koti);
  }
}

// ---------------------------------------------------------------- lento Lappeenrannasta Istanbuliin ja takaisin
// Samaa pergamenttityyliä kuin Kaakkois-Suomen kartta (17.10.: "kartta-animaatio on vielä vanha").
// Kartta oikeista koordinaateista (backlog 5.1, 17.10.: "Euroopan kartta ei noudata oikeaa
// karttaa"). Tasavälinen projektio, pituusasteet kerrottu cos(50°):lla, ettei pohjoinen veny:
// lat 66 -> 35 täyttää korkeuden, Eurooppa keskellä. Rantaviivat yksinkertaistettu (lon, lat).
const MAP_P = (lon, lat) => [160 + (lon - 24) * 2.82, (66 - lat) * 4.39];
const EUP = { lpr: MAP_P(28.19, 61.06), hki: MAP_P(24.94, 60.17), ist: MAP_P(28.98, 41.01), kap: MAP_P(34.83, 38.65) };
const EURASIA = [[13.5, 67.5], [12.4, 66], [11, 64.8], [9.6, 63.8], [8, 63.2], [6, 62.5], [5, 61.6], [4.9, 60.5], [5.3, 59.3], [5.7, 58.7], [6.6, 58.1], [8, 58.1], [9.4, 58.8], [10.4, 59.4], [10.7, 59.9], [11, 59], [11.2, 58.4], [11.8, 57.7], [12.4, 56.9], [12.9, 56.4], [12.6, 55.7], [13, 55.4], [14.2, 55.4], [14.4, 56], [15.9, 56.1], [16.5, 56.8], [16.6, 57.8], [17, 58.5], [18.3, 59.3], [18.9, 60.1], [17.3, 60.7], [17.2, 61.7], [17.6, 62.4], [18.6, 63.2], [20.3, 63.8], [21.4, 64.6], [22.3, 65.5], [24.2, 65.8], [25.4, 65], [24.6, 64.3], [23.1, 63.6], [21.5, 63], [21.2, 62], [21.6, 61.3], [21.4, 60.7], [22.3, 60.3], [22.9, 59.9], [24.6, 60.1], [26, 60.4], [27.5, 60.5], [28.7, 60.6], [29.8, 60.2], [30.2, 59.9], [28.9, 59.8], [28, 59.5], [26.5, 59.5], [24.8, 59.5], [23.5, 59.2], [23.5, 58.7], [23.9, 58.4], [24.4, 58.3], [24.3, 57.9], [24.4, 57.2], [23.6, 56.9], [23, 57.2], [22.6, 57.7], [21.7, 57.5], [21.1, 56.9], [21, 56.1], [21.2, 55.5], [20.6, 54.9], [19.6, 54.4], [18.6, 54.4], [18.4, 54.8], [16.8, 54.6], [14.6, 54], [13.7, 54.2], [12.3, 54.2], [11.1, 54], [10.8, 54.5], [10, 54.8], [10.3, 55.6], [10.6, 56.5], [10.3, 57], [10.6, 57.7], [9.8, 57.6], [8.6, 57.1], [8.1, 56.5], [8.1, 55.6], [8.6, 55], [8.9, 54.2], [8.6, 53.7], [7.2, 53.6], [6.2, 53.4], [4.8, 52.9], [4.4, 52], [3.6, 51.4], [2.5, 51.1], [1.6, 50.9], [1.6, 50.2], [0.2, 49.7], [-1.3, 49.6], [-1.6, 48.7], [-3, 48.8], [-4.7, 48.4], [-4.3, 47.8], [-2.5, 47.3], [-1.2, 46.2], [-1.2, 44.6], [-1.6, 43.4], [-3.8, 43.4], [-6.5, 43.6], [-8.3, 43.4], [-9.2, 43], [-8.8, 42], [-8.9, 40.9], [-9.5, 38.8], [-8.8, 37.9], [-8.9, 37], [-7.4, 37.2], [-6.3, 36.8], [-5.6, 36], [-4.4, 36.7], [-2.1, 36.7], [-0.5, 38.3], [0.2, 38.8], [-0.3, 39.5], [0.9, 41], [3.2, 41.9], [3.1, 43.1], [4.6, 43.4], [6.6, 43.1], [7.5, 43.8], [8.8, 44.4], [10.2, 43.9], [10.5, 42.9], [12, 42], [13, 41.2], [14.3, 40.8], [15.6, 40], [15.7, 38.9], [16.1, 38], [16.6, 38.4], [17.2, 39], [16.6, 40], [17.3, 40.5], [18.5, 40.1], [18, 40.7], [16, 41.5], [14, 42.6], [12.4, 44.2], [12.3, 45.3], [13.7, 45.7], [13.9, 44.9], [15.2, 44.3], [16.4, 43.5], [18.5, 42.5], [19.4, 41.8], [19.4, 40.5], [20.2, 39.6], [20.7, 38.8], [21.3, 37.7], [21.7, 36.8], [22.4, 36.4], [23, 37.4], [23.2, 38], [24, 38.2], [23, 39], [22.8, 40.4], [23.7, 40.2], [24.4, 40.9], [26, 40.8], [26.2, 40], [26.1, 39.4], [26.9, 39], [26.7, 38.4], [27.2, 37.9], [27.3, 37], [28.2, 36.7], [29.6, 36.2], [30.6, 36.8], [32, 36.5], [33.5, 36.2], [34.6, 36.8], [36, 36.6], [35.9, 35.9], [35.8, 35.2], [35.4, 33.8], [34.6, 31.5], [34.2, 29.5], [90, 29], [90, 68], [13.5, 68]];
const ISLANDS = [
  [[-5.7, 50], [-3.5, 50.3], [-1, 50.7], [1.4, 51.2], [1.7, 52.6], [0.3, 53.4], [-0.2, 54.1], [-1.5, 55], [-2, 55.9], [-3, 56], [-1.8, 57.5], [-3, 58.6], [-5, 58.6], [-6.2, 57.5], [-5.6, 56.3], [-5, 55], [-3.6, 54.6], [-3, 53.4], [-4.6, 53.3], [-4.1, 52.3], [-5.2, 51.7], [-3.3, 51.4], [-4.5, 51]],   // Iso-Britannia
  [[-6, 52.2], [-6.2, 53.3], [-6, 54.6], [-7.3, 55.3], [-8.5, 54.6], [-10, 54.2], [-9.5, 53.4], [-10.3, 52], [-9.6, 51.5], [-8, 51.8]],   // Irlanti
  [[-22.7, 63.9], [-18, 63.4], [-14.5, 64.4], [-13.5, 65.3], [-15, 66.2], [-18, 66.2], [-22.4, 66.4], [-24, 65.5], [-22, 64.6]],         // Islanti
  [[-12, 29], [-12, 34], [-6, 35.8], [-5.3, 35.9], [-2, 35.1], [0, 35.9], [3, 36.8], [6.5, 37.1], [9.8, 37.3], [11.1, 37], [10.4, 36.1], [11.1, 35.2], [10.1, 34.2], [20, 32.5], [32, 31.3], [34.2, 29.5]],   // Pohjois-Afrikka
  [[8.6, 41.4], [9.3, 41.4], [9.5, 42.8], [8.6, 42.6]], [[8.4, 39], [9.6, 39.1], [9.8, 40.9], [8.3, 41]],                                  // Korsika, Sardinia
  [[12.4, 37.9], [15.6, 38.3], [15.1, 36.7], [12.7, 37.6]], [[23.5, 35.3], [26.3, 35.2], [24.9, 35]], [[32.3, 34.9], [34.6, 35.7], [33.5, 35.1], [32.9, 34.6]],   // Sisilia, Kreeta, Kypros
  [[11.1, 55.3], [12.6, 55.6], [12.3, 56.1], [11, 55.8]], [[18.2, 56.9], [18.9, 57.8], [18.6, 57.1]],                                       // Seelanti, Gotlanti
];
const INLAND_SEAS = [
  [[27.5, 42.4], [28, 43.4], [28.6, 44.3], [29.7, 45.2], [30.6, 46.5], [31.8, 46.6], [33.5, 46], [33, 45.3], [33.6, 44.4], [35.4, 45], [36.6, 45.3], [38.2, 47.1], [39.3, 47.1], [37.6, 45.9], [37.8, 44.7], [39.9, 43.4], [41.6, 41.6], [40, 41], [37.5, 41], [35.1, 42], [33.3, 42], [31.3, 41.2], [29.1, 41.2], [28, 41.6]],   // Mustameri
  [[49, 46.7], [51.3, 47], [53, 46.6], [53, 45.2], [51.3, 44.5], [51, 43.2], [52.7, 42.3], [52.9, 41], [54, 40], [53.9, 38], [52.5, 36.8], [50.4, 37.2], [49, 38.3], [49.4, 40.2], [50.4, 40.4], [49.1, 41.5], [47.5, 43], [47.5, 44.5], [46.7, 44.8], [47.4, 46]],   // Kaspianmeri
  [[26.7, 40.4], [27.5, 40.9], [28.9, 41], [29.4, 40.8], [29, 40.4], [27.8, 40.3], [26.9, 40.2]],                                       // Marmaranmeri
  [[32, 67], [34.5, 66.6], [32.6, 65.5], [34.6, 64.5], [36.5, 64], [37.9, 64.3], [36.7, 65], [40, 64.6], [40.9, 65.5], [42, 67]],       // Vienanmeri
  [[30.6, 60.8], [31, 61.6], [32.5, 61.3], [32.9, 60.6], [31.5, 59.9], [30.6, 60.3]], [[34.6, 61.2], [35.4, 62.8], [36.2, 62.4], [35.9, 61]],   // Laatokka, Ääninen
  [[12.4, 58.9], [13.2, 59.3], [14.1, 59.1], [13.5, 58.5], [12.6, 58.5]],                                                              // Vänern
];
function europeMapBg() {
  const SEA = "#5f94b3", COAST = "#2a4a63", path = (pts) => { g.beginPath(); pts.forEach(([lo, la], k) => { const [x, y] = MAP_P(lo, la); k ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); };
  r(0, 0, W, H, SEA); seed = 3; for (let i = 0; i < 260; i++) px((rnd() * W) | 0, (rnd() * H) | 0, "#6ca2c0");          // aallot
  for (let gx = 32; gx < W; gx += 32) for (let y = 0; y < H; y += 2) px(gx, y, "#548aa8");                              // pituus-/leveyspiirit
  for (let gy = 32; gy < H; gy += 32) for (let x = 0; x < W; x += 2) px(x, gy, "#548aa8");
  // maa: kolmisävyinen aluevarjostus rajattuna rantaviivoihin
  const spot = (x, y, w, h, c, t) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (bay(x + i, y + j) < t) px(x + i, y + j, c); };
  const patch = (x, y, w, h, c1, c2) => { spot(x, y, w, h, c1, .3); spot(x + 4, y + 4, w - 8, h - 8, c1, .8); spot(x + 10, y + 8, w - 20, h - 16, c2, .35); };
  for (const P of [EURASIA, ...ISLANDS]) { g.save(); path(P); g.clip(); r(0, 0, W, H, "#e8d4a4");
    patch(236, 0, 90, H, "#d4b878", "#c4a468"); patch(146, 82, 90, 52, "#e2cf98", "#d4bc88"); patch(96, 11, 168, 68, "#a8a566", "#8f9556");
    seed = 7; for (let i = 0; i < 46; i++) { const cx = 104 + ((rnd() * 150) | 0), cy = 19 + ((rnd() * 52) | 0); r(cx, cy, 3, 2, "#8f9556"); px(cx + 3, cy + 1, "#8f9556"); px(cx - 1, cy + 1, "#8f9556"); }
    for (let i = 0; i < 14; i++) { const cx = 246 + ((rnd() * 70) | 0), cy = 10 + ((rnd() * 118) | 0); r(cx, cy, 3, 2, "#c4a468"); px(cx + 3, cy, "#c4a468"); }
    g.restore(); }
  for (const P of INLAND_SEAS) { path(P); g.fillStyle = SEA; g.fill(); }
  // matala vesi: 2 px laikku rannikon edustalla (Atlantti, Välimeri, Mustameri)
  { const d = g.getImageData(0, 0, W, H).data, L = (x, y) => x >= 0 && y >= 0 && x < W && y < H && d[(y * W + x) * 4] > 120;
    const inR = (x, y) => (x < 110 && y >= 20 && y <= 130) || (x >= 120 && x < 190 && y >= 95 && y <= 130) || (x >= 170 && x < 215 && y >= 85 && y <= 115);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if (!inR(x, y) || L(x, y)) continue;
      if ((L(x - 1, y) || L(x + 1, y) || L(x, y - 1) || L(x, y + 1) || L(x - 2, y) || L(x + 2, y) || L(x, y - 2) || L(x, y + 2) || L(x - 1, y - 1) || L(x + 1, y + 1) || L(x - 1, y + 1) || L(x + 1, y - 1)) && bay(x, y) < .55) px(x, y, "#7fb0c8"); } }
  g.strokeStyle = COAST; g.lineWidth = 1; for (const P of [EURASIA, ...ISLANDS, ...INLAND_SEAS]) { path(P); g.stroke(); }
  // Bosporin salmi Marmaranmereltä Mustallemerelle
  { const [x0, y0] = MAP_P(29.05, 41.0), [x1, y1] = MAP_P(29.1, 41.25); lineC(x0, y0, x1, y1, SEA); }
  // joet: Tonava ja Volga
  g.strokeStyle = "#7c9cb4"; g.lineWidth = 1;
  for (const R of [[[9, 48], [12, 48.5], [16.4, 48.2], [19, 47.6], [19, 45.6], [22.5, 44.6], [25, 43.7], [28, 44.5], [29.6, 45.2]], [[37, 57], [42, 56.3], [46, 56.3], [48, 55.8], [49, 53.2], [46, 51.5], [44.5, 48.7], [47.5, 46.6]]]) {
    g.beginPath(); R.forEach(([lo, la], k) => { const [x, y] = MAP_P(lo, la); k ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); }
  // vuoristot: valo vasemmalla, varjo oikealla, 1 px varjo oikealle alas
  const peak = (x, y, h) => { for (let j = 0; j < h; j++) { r(x - j, y + j, j, 1, j > h - 3 && j > 1 ? "#a89070" : "#e8dcc0"); px(x, y + j, "#a89070"); r(x + 1, y + j, j, 1, "#6a5a58"); px(x + j + 1, y + j, "#3a2a28"); } r(x - h + 1, y + h, 2 * h, 1, "#4a3a38"); };
  const range = (x, y, hs) => hs.forEach(([dx, dy, h]) => peak(x + dx, y + dy, h));
  range(125, 82, [[5, 6, 4], [12, 3, 6], [19, 7, 4], [24, 5, 5]]); range(175, 70, [[5, 9, 4], [12, 5, 6], [19, 9, 4], [24, 6, 5]]);
  range(235, 98, [[5, 6, 4], [12, 3, 6], [19, 6, 4]]); range(190, 118, [[5, 6, 4], [12, 3, 5], [19, 6, 4]]);
  for (const [lo, la, h] of [[12, 64, 4], [14, 66, 4], [9, 61.5, 3], [0, 42.7, 4], [-2, 43, 3]]) { const [x, y] = MAP_P(lo, la); peak(x, y, h); }
  // metsät maalle: vain pisteisiin, jotka ovat maata (väri luetaan kankaalta)
  const img = g.getImageData(0, 0, W, H).data, land = (x, y) => img[(y * W + x) * 4] > 120 && img[(y * W + x) * 4 + 2] < 180;
  seed = 23; for (let i = 0; i < 500; i++) { const x = 6 + ((rnd() * 308) | 0), y = 6 + ((rnd() * 124) | 0);
    if (!land(x, y) || !land(x + 4, y + 6) || !land(x, y + 6) || y > 100) continue;
    tri(x, y, 4, 5, (x + y) % 3 ? "#6c8c4c" : "#5c7c40"); }
  // reunus
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const e = Math.min(i, j, W - 1 - i, H - 1 - j); if (e < 6 && bay(i, j) < (6 - e) / 8) px(i, j, "#b89c6c"); }
  // kartan koristeet: laiva ja merikäärme
  { const k = "#5a3a28", c = "#f0e4c0";
    for (const [mx, top] of [[41, 97], [45, 95], [49, 97]]) { r(mx, top, 1, 102 - top, k); r(mx + 1, top + 1, 3, 4, c); px(mx + 3, top + 4, "#d4c498"); }
    r(40, 102, 12, 1, k); r(42, 103, 8, 1, k); px(39, 101, k); px(52, 101, k);
    const t = "#3f7f8f", h = "#7fb8bf";
    for (let n = 0; n < 3; n++) { const x = 70 + n * 8, y = 121; r(x + 2, y, 4, 1, t); r(x + 1, y + 1, 6, 1, t); r(x, y + 2, 2, 2, t); r(x + 6, y + 2, 2, 2, t); r(x + 2, y, 3, 1, h); px(x + 1, y + 1, h); }
    r(94, 117, 3, 2, t); px(96, 117, "#f4e8c0"); px(94, 119, t); }
  // kaupungit
  const city = (k, label, dx, dy, c = "#b81c1c") => { const [x, y] = EUP[k]; disc(x, y, 3, c, "#4c3c24"); g.font = "10px VT323, monospace"; g.fillStyle = "#f4e4c0"; g.fillText(label, x + dx + 1, y + dy + 1); g.fillStyle = "#4c3c24"; g.fillText(label, x + dx, y + dy); };
  city("lpr", "Lappeenranta", 6, 0); city("hki", "Helsinki", -42, 10); city("ist", "Istanbul", -42, 0); city("kap", "Kappadokia", 6, 4, "#c8941c");
  { const [x, y] = EUP.ist; disc(x + 6, y - 8, 3, "#5c3c4c"); r(x + 3, y - 8, 7, 3, "#5c3c4c"); r(x + 2, y - 13, 1, 6, "#5c3c4c"); r(x + 11, y - 13, 1, 6, "#5c3c4c"); }
  g.font = "9px VT323, monospace";
  const lbl = (t, x, y, c) => { g.fillStyle = "#3a2a20"; g.fillText(t, x + 1, y + 1); g.fillStyle = c; g.fillText(t, x, y); };
  for (const [t, lo, la] of [["Itämeri", 18.2, 56.2], ["Mustameri", 31.5, 43.6], ["Välimeri", 15, 36.2], ["Atlantti", -20, 50]]) { const [x, y] = MAP_P(lo, la); lbl(t, x, y, "#cfe4ee"); }
  for (const [t, lo, la] of [["SUOMI", 25.5, 63.5], ["TURKKI", 33, 39.6]]) { const [x, y] = MAP_P(lo, la); lbl(t, x, y, "#f4e8c0"); }
  r(8, 6, 74, 16, "#f4e4c0"); g.strokeStyle = "#6c4c2c"; g.strokeRect(8.5, 6.5, 73, 15); g.strokeRect(10.5, 8.5, 69, 11); g.strokeStyle = "#fff6dc"; g.strokeRect(11.5, 9.5, 67, 9); g.fillStyle = "#4c2c14"; g.font = "11px VT323, monospace"; g.fillText("EUROOPPA", 20, 18);
  { const x = 300, y = 116; g.strokeStyle = "#6c4c2c"; g.beginPath(); g.arc(x, y, 9, 0, 7); g.stroke();
    fillPoly([[x, y - 12], [x + 3, y], [x, y + 12], [x - 3, y]], "#6c4c2c"); fillPoly([[x - 12, y], [x, y - 3], [x + 12, y], [x, y + 3]], "#8c6c44"); fillPoly([[x, y - 12], [x + 3, y], [x - 3, y]], "#b81c1c"); }
  g.lineWidth = 1; g.strokeStyle = "#4a3020"; g.strokeRect(.5, .5, W - 1, H - 1); g.strokeRect(2.5, 2.5, W - 5, H - 5); g.strokeStyle = "#c8a050"; g.strokeRect(4.5, 4.5, W - 9, H - 9);
  for (const [x, y] of [[3, 3], [W - 4, 3], [3, H - 4], [W - 4, H - 4]]) { r(x - 2, y - 2, 5, 5, "#4a3020"); r(x - 1, y - 1, 3, 3, "#c8a050"); px(x, y, "#f4e0a0"); }
}
function plane(x, y, ang) {
  g.save(); g.translate(x, y); g.rotate(ang);
  r(-7, -1, 14, 3, "#f4f4f4"); r(-7, 1, 14, 1, "#9c9cac"); r(5, -1, 3, 2, "#9cc4ec"); fillPoly([[-2, -1], [2, -1], [-1, -7], [-4, -7]], "#d8d8e0"); fillPoly([[-2, 2], [2, 2], [-1, 8], [-4, 8]], "#c8c8d0");
  fillPoly([[-7, -1], [-5, -1], [-7, -5]], "#c81c1c"); g.restore();
}
const flown = new Set();
async function travel(from = "lpr", to = "ist") {
  // Toistuva väli (basaari <-> luola) lennetään lyhyemmin (sokkotesti 2: 12 s joka kerta puuduttaa).
  const leg = [from, to].sort().join("-"), again = flown.has(leg); flown.add(leg);
  const A = EUP[from], B = EUP[to], start = performance.now(), dur = TEST ? 700 : again ? 1800 : 4200;
  const at = (q) => [A[0] + (B[0] - A[0]) * q + Math.sin(q * Math.PI) * 26, A[1] + (B[1] - A[1]) * q - Math.sin(q * Math.PI) * 6];
  overlay = () => {
    const k = Math.min(1, (performance.now() - start) / dur), q = .5 - .5 * Math.cos(k * Math.PI);
    g.drawImage(paintBg("europe", europeMapBg), 0, 0); mapClouds(performance.now());
    for (let i = 0; i < q * 60; i += 2) { const [x, y] = at(i / 60); r(x, y, 2, 2, "#b81c1c"); }
    const [x, y] = at(q), [x2, y2] = at(Math.min(1, q + .01));
    if (k < 1) { g.fillStyle = "rgba(0,0,0,.18)"; g.beginPath(); g.ellipse(x + 6, y + 8, 6, 2, 0, 0, 7); g.fill(); plane(x, y, Math.atan2(y2 - y, x2 - x)); }
    else { r(B[0] - 4, B[1] - 1, 9, 2, "#b81c1c"); r(B[0] - 1, B[1] - 4, 2, 9, "#b81c1c"); }
  };
  [392, 523].forEach((f, n) => setTimeout(() => beep(f, 200, "triangle", .04), n * 160));
  await sleep(dur + (again ? 200 : 500)); overlay = null;
}

// ---- Kuukkeli-haku taksissa (23.10.) ----------------------------------------------------
// Nopea siirtymä Kisapuistosta lentoasemalle: Jussi kirjoittaa kännykkään tahallaan väärin
// "lappeen ranta lentokenttä, onko?". Hakukone on keksitty (Kuukkeli), ei oikean palvelun näköinen.
async function kuukkeliSearch() {
  const Q = "lappeen ranta lentokenttä, onko?", t0 = performance.now(), per = TEST ? 15 : 85;
  let shown = 0, results = false, talkT = 0;
  overlay = (t) => {
    const n = Math.min(Q.length, Math.floor((performance.now() - t0) / per));
    if (n > shown) { shown = n; beep(1200 + (n % 3) * 90, 18, "square", .02); }
    r(0, 0, W, H, "#1c1820"); for (let y = 0; y < H; y += 4) r(0, y, W, 1, "#241e2a");     // taksin hämärä takapenkki
    const dx = talkT ? -Math.round(66 * Math.min(1, (performance.now() - talkT) / 350)) : 0;   // puhelin väistyy kuplien tieltä
    g.save(); g.translate(dx, 0); draw(t); g.restore();
  };
  const draw = (t) => {
    r(84, 2, 152, 134, "#141418"); r(88, 8, 144, 124, "#f8f8f4"); r(150, 4, 20, 2, "#3c3c44");   // kännykkä
    g.textAlign = "left"; g.font = "16px VT323, monospace"; g.fillStyle = "#3c5c8c"; g.fillText("Kuukkeli", 130, 26); disc(126, 21, 3, "#3c5c8c"); disc(126, 21, 2, "#f8f8f4"); r(128, 23, 2, 2, "#3c5c8c");
    r(94, 32, 132, 12, "#c8c8cc"); r(95, 33, 130, 10, "#ffffff");
    g.font = "9px VT323, monospace"; g.fillStyle = "#1c1c1c"; g.fillText(Q.slice(0, shown) + (Math.floor(t / 300) % 2 && !results ? "|" : ""), 97, 41);
    if (!results) return;
    g.font = "7px VT323, monospace"; g.fillStyle = "#8c2c2c"; g.fillText("Tarkoititko: lappeenranta lentokenttä", 94, 53);
    const rows = [["Lappeenrannan lentoasema", "Kyllä on. Ihan oikeasti."],
      ["Onko Lappeenrannassa lentokenttä?", "4 812 vastausta. Viimeisin: \"On, kävin.\""],
      ["Lentoasema - tietosanakirja", "...on lentoasema Lappeenrannassa."]];
    rows.forEach(([h, d], k) => { g.fillStyle = "#2c4c9c"; g.fillText(h, 94, 66 + k * 22); g.fillStyle = "#4c4c4c"; g.fillText(d, 94, 74 + k * 22); });
  };
  await sleep(per * Q.length + 400); beep(660, 60, "triangle", .04); results = true;
  await sleep(TEST ? 100 : 1600); talkT = performance.now(); await sleep(400);
  callSpk = { jussi: { x: 250, y: 56, c: "#c8a460" }, kuski: { x: 250, y: 112, c: "#9cc8ec" } };
  await say("Kyllä on. Ihan oikeasti. Hyvä tietää ennen kuin mittari käy.");
  await say("On se. Minä vien sinne joka päivä yhden. Tänään sinut.", "kuski");
  callSpk = null; overlay = null;
}

// Pilvien varjot ja hattarat kartan yllä (matkakartat).
function mapClouds(t) { g.save(); g.globalAlpha = .28; drift("map_clouds", 5, () => puffBand([[20, 20, 50], [150, 60, 60], [250, 30, 40], [90, 100, 50]], "#ffffff"), t); g.restore(); }
