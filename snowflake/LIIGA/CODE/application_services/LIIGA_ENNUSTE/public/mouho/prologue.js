// Mouhon salaisuus -- prologi "Kiitos yhteistyöstä" (vaihe 3, 17.10.): Jussi potkitaan
// koomisesti Liigan toimistosta Helsingistä ja hän lentää kartan yli Lappeenrantaan.
//   1. Liigan toimisto (punatiili, tummat syvennysikkunat, oranssit pylväät, raitiovaunu):
//      ovi aukeaa, saapas, Jussi ja pahvilaatikko lentävät.
//   2. Kaakkois-Suomen kartta: kaari Helsingistä itään, Kouvola harmaan pilven alla.
//   3. Kisapuisto: lehtikasaan, laatikko perään, nimikyltti päähän -- BONK.
// Klikkaus ohittaa animaation; repliikit ohittuvat kuten aina.
"use strict";

// ---------------------------------------------------------------- Liigan toimisto
// liiga_toimisto-kuvien punatiilitalo syysaamuna: matala aurinko vasemmalta, tummat
// syvennysikkunat taivaan heijastuksin, oranssit pylväät, lasinen katutaso kahvilineen.
function liigaOfficeBg() {
  vgrad(0, 0, W, 64, ["#6c90c8", "#84a4d4", "#a4bcdc", "#c8d0e0", "#e8d8cc", "#f4d4b0"]);
  seed = 31; for (let i = 0; i < 28; i++) { const x = (rnd() * W) | 0, y = 4 + ((rnd() * 34) | 0), w = 6 + ((rnd() * 28) | 0); r(x, y, w, 1, "#eef2f8"); r(x + 2, y + 1, w - 4, 1, y > 20 ? "#f8e0c8" : "#d4dcec"); }
  for (let j = -16; j <= 16; j++) for (let i = -16; i <= 16; i++) { const d = Math.hypot(i, j); if (d < 16 && bay(14 + i, 50 + j) < (16 - d) / 18) px(14 + i, 50 + j, "#fff4d8"); }
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
  for (const x of [270, 286]) { g.strokeStyle = "#1c1c24"; g.lineWidth = 1; g.beginPath(); g.arc(x, 114, 4, 0, 7); g.arc(x + 9, 114, 4, 0, 7); g.stroke(); lineC(x, 114, x + 5, 108, "#2c6cb4"); lineC(x + 5, 108, x + 9, 114, "#2c6cb4"); }
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
function boot(x, y) {  // potkaiseva saapas (anonyymi -- ovesta näkyy vain saapas)
  r(x - 30, y - 8, 30, 8, "#2c2c3c"); r(x - 4, y - 12, 12, 12, "#3c2414"); r(x + 6, y - 6, 10, 6, "#3c2414"); r(x - 4, y - 1, 20, 2, "#1c1008"); px(x + 13, y - 5, "#7c5c3c");
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
const MAPP = { hki: [58, 104], kvl: [168, 70], lpr: [266, 56] };
function seFinlandMapBg() {
  seed = 3; noise(0, 0, W, H, "#e8d4a4", ["#dcc896", "#f0e0b8", "#d4bc88", "#e4cc9c"], .45);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const e = Math.min(i, j, W - 1 - i, H - 1 - j); if (e < 10 && bay(i, j) < (10 - e) / 12) px(i, j, "#b89c6c"); }
  for (const [x, y, rr] of [[40, 30, 12], [250, 110, 9]]) { g.strokeStyle = "rgba(140,100,50,.35)"; g.lineWidth = 2; g.beginPath(); g.arc(x, y, rr, .3, 5.6); g.stroke(); }   // kahvirenkaat
  // Suomenlahti, rannikko ja saaristo
  const coast = [[0, 112], [24, 108], [40, 112], [58, 108], [74, 114], [100, 110], [128, 116], [150, 108], [176, 112], [204, 104], [228, 100], [256, 96], [284, 92], [320, 88]];
  fillPoly([...coast, [320, 136], [0, 136]], "#94b4c8"); for (let i = 0; i < coast.length - 1; i++) lineC(...coast[i], ...coast[i + 1], "#5c7c94");
  for (let i = 0; i < coast.length - 1; i++) { const [x0, y0] = coast[i], [x1, y1] = coast[i + 1]; lineC(x0, y0 + 2, x1, y1 + 2, "#b4ccdc"); }
  seed = 17; for (let i = 0; i < 46; i++) { const x = (rnd() * W) | 0, y = 118 + ((rnd() * 14) | 0); r(x, y, 4, 1, "#b4ccdc"); px(x + 1, y - 1, "#b4ccdc"); }
  for (let i = 0; i < 26; i++) { const x = 10 + ((rnd() * 290) | 0), y = 112 + ((rnd() * 8) | 0); disc(x, y, 1 + (i % 2), "#c8b484", "#8c7c54"); }
  // lautta
  r(110, 124, 16, 4, "#f4f4ec"); r(110, 127, 16, 1, "#2c4c7c"); r(114, 121, 8, 3, "#f4f4ec"); r(118, 118, 2, 3, "#c81c1c"); for (let k = 0; k < 6; k++) px(106 - k * 2, 128 + (k % 2), "#e4ecf4");
  // järvet: Saimaa labyrinttina, pienempiä lammia
  for (const [x, y, rx, ry] of [[240, 26, 16, 6], [262, 20, 12, 5], [284, 30, 18, 7], [296, 44, 10, 6], [252, 40, 8, 4], [276, 46, 9, 4], [300, 18, 10, 5], [120, 40, 8, 3], [96, 56, 6, 3], [200, 36, 7, 3]]) {
    g.fillStyle = "#94b4c8"; g.beginPath(); g.ellipse(x, y, rx, ry, (x % 7) / 10, 0, 7); g.fill(); g.strokeStyle = "#5c7c94"; g.lineWidth = 1; g.stroke(); }
  g.fillStyle = "#6c5c3c"; g.font = "9px VT323, monospace"; g.fillText("Saimaa", 256, 12);
  // metsät: pikkukuuset sävyineen, vältä vettä ja kaupunkeja
  seed = 41; for (let i = 0; i < 260; i++) { const x = 6 + ((rnd() * 306) | 0), y = 8 + ((rnd() * 96) | 0);
    const near = Object.values(MAPP).some(([cx, cy]) => Math.hypot(cx - x, cy - y) < 20), wet = (x > 228 && y < 52 && rnd() < .7) || y > 100;
    if (near || wet) continue; tri(x, y, 5, 6, (x + y) % 3 ? "#6c8c4c" : "#5c7c40"); px(x + 2, y + 1, "#8cac64"); r(x + 2, y + 6, 1, 2, "#5c4c34"); }
  // tiet
  g.strokeStyle = "#9c7c4c"; g.lineWidth = 1.5; g.setLineDash([3, 2]); g.beginPath(); g.moveTo(...MAPP.hki); g.bezierCurveTo(100, 96, 130, 78, ...MAPP.kvl); g.bezierCurveTo(200, 66, 232, 62, ...MAPP.lpr); g.stroke(); g.setLineDash([]);
  // kaupungit pikkukuvina
  { const [x, y] = MAPP.hki; r(x - 10, y - 6, 20, 8, "#f4f0e4"); r(x - 10, y - 6, 20, 1, "#ffffff"); r(x - 4, y - 12, 8, 6, "#f4f0e4"); disc(x, y - 14, 4, "#5c9c7c", "#3c6c54"); r(x - 1, y - 20, 2, 3, "#f0c84c");
    for (const dx of [-8, 6]) { r(x + dx, y - 10, 2, 4, "#f4f0e4"); disc(x + dx + 1, y - 11, 1, "#5c9c7c"); } for (let k = 0; k < 4; k++) r(x - 8 + k * 5, y - 3, 2, 3, "#8c9cac"); }
  { const [x, y] = MAPP.kvl; for (const [dx, h] of [[-12, 14], [-6, 20], [0, 16], [6, 22], [12, 12]]) { r(x + dx - 2, y - h, 5, h, "#626264"); r(x + dx - 2, y - h, 5, 1, "#79797D"); for (let yy = y - h + 2; yy < y - 1; yy += 3) r(x + dx - 1, yy, 3, 1, "#3A3938"); } }
  { const [x, y] = MAPP.lpr; r(x - 10, y - 8, 14, 9, "#e8b83c"); r(x - 10, y - 8, 14, 1, "#fcd870"); r(x + 4, y - 6, 10, 7, "#9c9cac"); r(x - 4, y - 5, 3, 3, "#1c1c1c");
    r(x + 6, y - 14, 1, 6, "#5c4c34"); fillPoly([[x + 7, y - 14], [x + 13, y - 12], [x + 7, y - 10]], "#fcd41c"); }
  for (const [k, label, dx, dy] of [["hki", "Helsinki", -16, 12], ["kvl", "Kouvola", -14, 10], ["lpr", "Lappeenranta", -28, 12]]) { const [x, y] = MAPP[k];
    g.font = "10px VT323, monospace"; g.fillStyle = "#f4e4c0"; g.fillText(label, x + dx + 1, y + dy + 1); g.fillStyle = k === "kvl" ? "#626264" : "#4c3c24"; g.fillText(label, x + dx, y + dy); }
  g.fillStyle = "#6c5c3c"; g.font = "9px VT323, monospace"; g.fillText("Suomenlahti", 140, 130);
  // kartussi ja kompassiruusu
  r(8, 6, 92, 16, "#f4e4c0"); g.strokeStyle = "#6c4c2c"; g.lineWidth = 1; g.strokeRect(8.5, 6.5, 91, 15); g.strokeRect(10.5, 8.5, 87, 11);
  g.fillStyle = "#4c2c14"; g.font = "11px VT323, monospace"; g.fillText("KAAKKOIS-SUOMI", 16, 18);
  { const x = 296, y = 108; g.strokeStyle = "#6c4c2c"; g.beginPath(); g.arc(x, y, 11, 0, 7); g.stroke();
    fillPoly([[x, y - 14], [x + 3, y], [x, y + 14], [x - 3, y]], "#6c4c2c"); fillPoly([[x - 14, y], [x, y - 3], [x + 14, y], [x, y + 3]], "#8c6c44"); fillPoly([[x, y - 14], [x + 3, y], [x - 3, y]], "#b81c1c");
    g.fillStyle = "#4c2c14"; g.font = "9px VT323, monospace"; g.fillText("P", x - 2, y - 16); }
  g.strokeStyle = "#6c4c2c"; g.lineWidth = 1; g.strokeRect(2.5, 2.5, W - 5, H - 5); g.strokeStyle = "#a07c4c"; g.strokeRect(4.5, 4.5, W - 9, H - 9);
  for (const [x, y] of [[4, 4], [W - 9, 4], [4, H - 9], [W - 9, H - 9]]) { r(x, y, 5, 5, "#6c4c2c"); px(x + 2, y + 2, "#e8d4a4"); }
}
function kouvolaCloud(t) {  // Kouvolan oma harmaa sadepilvi (Kouvolan väripaletti), vain Kouvolan yllä
  const [x, y] = MAPP.kvl; g.fillStyle = "rgba(98,98,100,.3)"; g.beginPath(); g.ellipse(x, y - 6, 26, 16, 0, 0, 7); g.fill();
  for (let i = 0; i < 12; i++) { const yy = y - 26 + ((t / 28 + i * 7) % 26); r(x - 16 + i * 3, yy, 1, 3, "#4E4D4E"); }
  for (const [dx, dy, rr] of [[-12, -32, 7], [0, -36, 9], [12, -32, 7], [6, -28, 6], [-6, -28, 6]]) disc(x + dx, y + dy, rr, "#79797D", "#626264");
  for (const [dx, dy] of [[-4, -38], [6, -34]]) px(x + dx, y + dy, "#9899A1");
}
const flightAt = (q) => { const [ax, ay] = MAPP.hki, [bx, by] = MAPP.lpr; return [ax + (bx - ax) * q, ay - 10 + (by - ay) * q - Math.sin(q * Math.PI) * 50]; };

// ---------------------------------------------------------------- Kisapuisto: lehtikasa
const LAND = [178, 127];
function leafPile(x, y, burst = 0) {
  seed = 5; for (let k = 0; k < 90; k++) { const a = rnd() * Math.PI, d = rnd() * 16; const X = x + Math.cos(a) * d * 1.3, Y = y - Math.sin(a) * d * .5;
    px(X, Y, ["#e8a83c", "#c8782c", "#f0c850", "#8c4c1c"][k % 4]); }
  if (burst > 0) for (let k = 0; k < 24; k++) { const a = -Math.PI * (k / 24), v = 30 + (k % 5) * 10, T = burst; px(x + Math.cos(a) * v * T, y + Math.sin(a) * v * T + 60 * T * T, ["#e8a83c", "#c8782c", "#f0c850"][k % 3]); }
}

// ---------------------------------------------------------------- prologi
async function prologue() {
  let skipAll = false;
  const onSkip = (e) => { if (!skip) { skipAll = true; e.stopPropagation(); } };
  cv.addEventListener("click", onSkip, true);
  const wait = (ms) => new Promise((res) => { const t0 = performance.now(), iv = setInterval(() => { if (skipAll || performance.now() - t0 >= ms) { clearInterval(iv); res(); } }, 30); });
  const line = async (text, who, at) => { if (skipAll) return; if (at) callSpk = { [who]: at }; await say(text, who); callSpk = null; };
  $game.classList.add("cut"); $sent.textContent = "";
  try {
    // 1. Liigan toimisto
    let T0 = performance.now(), fly = null, door = false, bootX = null;
    overlay = () => {
      const now = performance.now(), k = (now - T0) / 1000;
      g.drawImage(paintBg("liiga", liigaOfficeBg), 0, 0);
      tram(-120 + ((k * 70) % 560));
      if (door) { r(124, 90, 34, 22, "#0c0c10"); if (bootX != null) boot(bootX, 108); }
      if (fly) { const f = (now - fly) / 1000, x = 140 + f * 150, y = 108 - f * 140 + f * f * 40;
        tumbleJussi(x, y, f * 9); tumbleBox(x - 30 + f * 10, y + 14, -f * 7); r(x - 50, y + 22 - f * 6, 12, 4, "#c8a030"); }
    };
    await line("Helsinki. Liigan toimisto. Aamu.", "muu");
    door = true; beep(70, 160, "square", .08); await wait(250);
    for (let i = 0; i < 6 && !skipAll; i++) { bootX = 128 + i * 6; await wait(25); }
    beep(110, 90, "sawtooth", .08); fly = performance.now();
    line("Kiitos yhteistyöstä!", "muu");
    await wait(900);
    await line("Kiitos teillekin! Oli ilo olla...!", "jussi", { x: 250, y: 20, c: "#c8a460" });
    // 2. kartta
    T0 = performance.now(); let flyQ = 0;
    overlay = () => {
      const now = performance.now(); flyQ = Math.min(1, (now - T0) / 4200);
      g.drawImage(paintBg("seMap", seFinlandMapBg), 0, 0); kouvolaCloud(now);
      for (let i = 0; i < flyQ * 60; i += 2) { const [x, y] = flightAt(i / 60); r(x, y, 2, 2, "#b81c1c"); }
      const [x, y] = flightAt(flyQ); tumbleJussi(x, y + 10, now / 120, .45); tumbleBox(...flightAt(Math.max(0, flyQ - .06)), now / 150, .5);
    };
    await wait(1700);
    { const [x, y] = flightAt(.45); await line("Hyvä peli eilen!", "jussi", { x, y: y - 6, c: "#c8a460" }); }
    await wait(Math.max(0, 4300 - (performance.now() - T0)));
    // 3. Kisapuisto: putoaminen lehtikasaan, laatikko perään, nimikyltti päähän. Kaikki ajan
    // funktioina (ei ruututapahtumina), jotta hidas kone tai harva piirto ei ohita vaiheita.
    T0 = performance.now();
    const fall = (start, from, to, gpx) => (k) => (k < start ? null : Math.min(to, from + (k - start) ** 2 * gpx));
    const tJ = Math.sqrt((LAND[1] + 30) / 260), tB = tJ + .5 + Math.sqrt((LAND[1] + 22) / 300), tP = tB + .4 + Math.sqrt((LAND[1] - 36) / 320);
    const jF = fall(0, -30, LAND[1], 260), bF = fall(tJ + .5, -20, LAND[1] + 2, 300), pF = fall(tB + .4, -10, LAND[1] - 46, 320);
    setTimeout(() => beep(80, 200, "triangle", .1), tJ * 1000); setTimeout(() => beep(60, 160, "square", .08), tB * 1000);
    setTimeout(() => { beep(1300, 60, "square", .08); setTimeout(() => beep(900, 120, "triangle", .06), 60); }, tP * 1000);
    overlay = (t) => {
      const k = (performance.now() - T0) / 1000;
      room().draw(t);
      leafPile(LAND[0], LAND[1], k > tJ && k < tJ + .7 ? (k - tJ) / .7 : 0);
      if (k >= tJ) jussi(LAND[0], LAND[1] + 2, 1, 0, { hat: false, whip: false }, depth(LAND[1])); else tumbleJussi(LAND[0], jF(k), k * 10, depth(LAND[1]));
      const by = bF(k); if (by != null) tumbleBox(LAND[0] - 26, by - 6, k >= tB ? 0 : (k - tJ) * 8, 1.2);
      const py = pF(k);
      if (py != null && k < tP + .9) { r(LAND[0] - 8, py, 16, 6, "#c8a030"); r(LAND[0] - 7, py + 1, 14, 1, "#fce870"); r(LAND[0] - 6, py + 3, 12, 1, "#3c2c10"); }
      if (k >= tP) { const s2 = k - tP; for (let i = 0; i < 4; i++) { const a = s2 * 6 + i * Math.PI / 2, sx = LAND[0] + Math.cos(a) * 10, sy = LAND[1] - 52 + Math.sin(a) * 3; r(sx, sy, 2, 2, "#fcf09c"); }
        if (s2 < .8) { g.font = "bold 14px VT323, monospace"; g.lineWidth = 3; g.strokeStyle = "#1c0c0c"; g.strokeText("BONK!", LAND[0] + 12, LAND[1] - 44); g.fillStyle = "#fcd41c"; g.fillText("BONK!", LAND[0] + 12, LAND[1] - 44); } }
    };
    await wait((tP + .9) * 1000);
    if (!skipAll) await line("\"Urheilujohtaja.\" Kiitos, nimikyltti. Muistan kyllä.", "jussi", { x: LAND[0], y: LAND[1] - 50, c: "#c8a460" });
  } finally {
    cv.removeEventListener("click", onSkip, true); overlay = null; callSpk = null; $game.classList.remove("cut");
    st.flags.leafPile = true; place(LAND[0], LAND[1]);
  }
}
