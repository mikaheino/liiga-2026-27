// Mouhon salaisuus -- Suuri basaari, Istanbul: grafiikka, hahmot, ruutu ja kohtaukset.
"use strict";
// =============================================================== BASAARI
// Katu kapenee kohti moskeijaa; kojut molemmin puolin, Mehmetin tiski oikealla.
const VPB = [160, 56];
// Basaari kolmena osana kuten Kisapuisto (23.10.): taivas ja aurinko, kaksi ajelehtivaa
// auringonlaskun pilvinauhaa ja läpinäkyvä etuala (moskeija, talot, kojut).
const BAZ_CLOUDS = [[14, "#5c1c54", "#7c2c5c", "#c84c6c", 30, 3], [34, "#b04450", "#c85c4c", "#f8a050", 22, 6]];
function bazCloudBand(w, [by, dark, mid, lit, gap], k) {
  seed = 71 + k * 13;
  for (let x = (rnd() * 30) | 0; x < w; ) { const cw = 20 + ((rnd() * 50) | 0), y = by + ((rnd() * 6) | 0) - 3;
    for (const xx of x + cw > w ? [x, x - w] : [x]) { r(xx, y, cw, 2, dark); r(xx + 3, y - 1, cw - 8, 1, mid); r(xx + 6, y - 2, cw * .4, 1, lit); dither(xx + 2, y + 2, cw - 4, 1, dark, mid, .4); }
    x += cw + gap + ((rnd() * gap) | 0); }
}
function basaariBg() { basaariSky(); BAZ_CLOUDS.forEach((b, k) => bazCloudBand(W, b, k)); basaariFg(); }
function basaariSky(full = true) {    // full = false: porttiruudun taivas (aurinko ja kuu vain basaarissa)
  // taivas: kuusi sävyporrasta magentasta oranssiin horisonttiin, saumat Bayer-ditheröintinä
  const SKY = ["#3c1448", "#6c1c58", "#a02c58", "#d04c48", "#ec7438", "#f8a048"], SB = [0, 12, 24, 36, 47, 58, 70];
  for (let i = 0; i < SKY.length; i++) { r(0, SB[i], W, SB[i + 1] - SB[i], SKY[i]); if (i) for (let j = 0; j < 4; j++) dither(0, SB[i] - 2 + j, W, 1, SKY[i - 1], SKY[i], (j + 1) / 5); }
  if (full) disc(118, 50, 8, "#fce890", "#fcd070");
  // hämärän syvyys: indigo ylhäällä, magenta keskellä, lämmin oranssi horisontissa (Bayer-saumat)
  for (const [y0, y1, c, f] of [[0, 9, "#2a1f4d", 1], [9, 15, "#2a1f4d", .55], [15, 24, "#8a3a6e", .5], [24, 31, "#8a3a6e", .25], [32, 40, "#e8845a", .3]])
    for (let y = y0; y < y1; y++) for (let x = 0; x < W; x++) if (bay(x, y) < f * (y1 - y) / (y1 - y0) + (f === 1 ? 0 : .08)) px(x, y, c);
  for (const [x, y] of [[198, 3], [214, 9], [246, 4], [262, 12], [276, 6], [290, 13], [224, 13], [180, 8]]) px(x, y, "#ffe9a8");
  if (full) { disc(232, 6, 3, "#ffe9a8", "#c9a0d0"); disc(234, 5, 2, "#2a1f4d"); }
}
function basaariFg() {
  // moskeija: tumma violetti siluetti, auringon puolella (vasen) reunavalo
  const M = "#3a1834", ML = "#6a2c50";
  disc(160, 34, 12, ML); disc(161, 34, 11, M); r(146, 34, 28, 4, M); r(146, 34, 1, 4, ML); disc(143, 42, 6, ML); disc(144, 42, 5, M); disc(177, 42, 6, M);
  r(136, 40, 48, 30, M); r(136, 40, 1, 30, ML); r(159, 17, 2, 6, M); r(159, 17, 1, 6, ML); px(160, 15, "#fcb04c"); px(159, 16, "#fcb04c");
  for (const [x, top] of [[130, 18], [188, 18], [122, 28], [196, 28]]) { r(x, top, 2, 52, M); r(x, top, 1, 52, ML); tri(x, top - 6, 2, 6, M); r(x - 1, top + 10, 4, 1, ML); }
  for (let x = 140; x < 182; x += 6) { px(x, 50, "#fcb04c"); px(x, 51, "#c86c3c"); }
  // seinät perspektiivissä: rapattu pinta klustereina (laikut, tahrat, lohkeamat)
  const inL = (x, y) => x < 136 && y > 38 * x / 136 && y < 112 - 42 * x / 136, inR = (x, y) => x > 184 && inL(320 - x, y);
  fillPoly([[0, 0], [136, 38], [136, 70], [0, 112]], "#b0744a"); fillPoly([[320, 0], [184, 38], [184, 70], [320, 112]], "#a46c40");
  seed = 9;
  for (let k = 0; k < 160; k++) { const s = k % 2, xx = rnd() * 130, y = rnd() * 112; if (!inL(xx, y - 2) || !inL(xx + 3, y + 3)) continue;
    const x = s ? 320 - xx - 3 : xx, c = rnd() < .55 ? (s ? "#94603a" : "#9c6438") : (s ? "#b87c50" : "#c4885a"), w = 2 + (rnd() * 2 | 0), h = 2 + (rnd() * 2 | 0);
    r(x, y, w, h - 1, c); r(x + 1, y + h - 1, w - 1, 1, c); }
  for (const [xx, y, s] of [[8, 30, 0], [92, 52, 0], [40, 64, 1], [104, 44, 1], [70, 78, 0]]) { const x = s ? 320 - xx - 9 : xx;
    r(x - 1, y - 1, 10, 1, s ? "#c8905c" : "#d49c6c"); r(x - 1, y, 1, 6, s ? "#c8905c" : "#d49c6c"); r(x, y, 9, 6, "#8c4c30");
    for (let j = 0; j < 6; j += 2) { r(x, y + j + 1, 9, 1, "#6c3424"); for (let i = (j % 4 ? 1 : 3); i < 9; i += 4) px(x + i, y + j, "#6c3424"); } r(x + 6, y + 5, 3, 1, s ? "#a46c40" : "#b0744a"); }
  for (const xx of [20, 46, 78, 100, 120]) for (const s of [0, 1]) { const top = 38 * xx / 136 + 20 - 6 * xx / 136, x = s ? 320 - xx - 2 : xx;
    for (let j = 0; j < 12; j++) for (let i = 0; i < 2; i++) if (bay(x + i, top + j) < .55 - j * .04) px(x + i, top + j, s ? "#84542e" : "#8c5832"); }
  // lyhtyjen valo seinällä: yksi lämmin lähde per lyhty, ditheröity kartio
  for (const [lx, ly, s] of [[60, 40, 1], [110, 50, .7], [210, 50, .7], [262, 40, 1]]) { const rad = 18 * s + 4;
    for (let y = ly - rad; y < ly + rad * 1.4; y++) for (let x = lx - rad; x < lx + rad; x++) { const d = Math.hypot(x - lx, (y - ly - 3) * .75) / rad; if (d >= 1 || !(inL(x, y) || inR(x, y))) continue;
      if (bay(x, y) < (1 - d) * .9) px(x, y, d < .45 && bay(x + 1, y) < .5 ? "#ecb87c" : (x < 160 ? "#d49a64" : "#c88e5a")); } }
  // markiisiraidat seinien yläreunassa
  for (let i = 0; i < 14; i++) { const a = i / 14, b = (i + 1) / 14, c = i % 2 ? "#b81c1c" : "#ece4c4";
    fillPoly([[a * 136, 38 * a + 8], [b * 136, 38 * b + 8], [b * 136, 38 * b + 20 - 6 * b], [a * 136, 38 * a + 20 - 6 * a]], c);
    fillPoly([[320 - a * 136, 38 * a + 8], [320 - b * 136, 38 * b + 8], [320 - b * 136, 38 * b + 20 - 6 * b], [320 - a * 136, 38 * a + 20 - 6 * a]], c); }
  // ovet ja kojuaukot: suippokaari, laattareunus, puuovet syineen tai luukut
  const DOOR = (A, B, C, D, lit, i) => { const P = (u, v) => [lerp(lerp(A[0], B[0], u), lerp(D[0], C[0], u), v), lerp(lerp(A[1], B[1], u), lerp(D[1], C[1], u), v)];
    const q = (u0, v0, u1, v1, c) => fillPoly([P(u0, v0), P(u1, v0), P(u1, v1), P(u0, v1)], c), trim = lit ? "#dcb47c" : "#bc905c", wood = lit ? "#7c4420" : "#6c3818";
    q(-.12, -.1, 1.12, 1, trim); q(-.12, -.1, 1.12, -.03, "#2c5c9c"); for (let u = -.06; u < 1.1; u += .18) { const [x, y] = P(u, -.07); px(x, y, "#e8e0c4"); }
    if (i % 2) { q(0, 0, 1, 1, "#24101c"); for (let v = .05; v < .48; v += .07) { q(0, v, 1, v + .04, wood); q(0, v + .04, 1, v + .05, "#3c1c10"); } q(0, .48, 1, .52, "#4a2410"); }
    else { q(0, 0, 1, 1, wood); for (const u of [.33, .66]) lineC(...P(u, .12), ...P(u, 1), "#4a2410"); lineC(...P(.08, .14), ...P(.08, 1), "#9c5c2c"); const [hx, hy] = P(.82, .6); px(hx, hy, "#e8c81c"); }
    fillPoly([P(-.01, -.01), P(.5, -.01), P(-.01, .16)], trim); fillPoly([P(1.01, -.01), P(.5, -.01), P(1.01, .16)], trim); lineC(...P(-.12, 1), ...P(1.12, 1), "#4a2414"); };
  [.12, .38, .6, .78].forEach((k, i) => { const x = k * 136, top = 38 * k + 26 * (1 - k), bot = 112 - 42 * k, w = 26 * (1 - k * .8);
    DOOR([x, top], [x + w, top + w * .28], [x + w, bot - w * .3], [x, bot], 1, i); DOOR([320 - x, top], [320 - x - w, top + w * .28], [320 - x - w, bot - w * .3], [320 - x, bot], 0, i + 1); });
  // katu: mukulakivet perspektiivissä, rivit kapenevat kohti katoamispistettä; lämmin valo, kylmä varjo
  const LIG = [[60, 104, 46], [110, 100, 34], [210, 100, 34], [262, 104, 46], [257, 106, 44]], FL = ["#3c2838", "#5c4050", "#86603e", "#a87a4c", "#c89a64"], MOR = "#34202c";
  const hsh = (a, b) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); };
  for (let y = 70, row = 0; y < H; row++) { const h = Math.max(1, Math.round(1 + (y - 70) / 66 * 6));
    for (let j = 0; j < h && y + j < H; j++) { const yy = y + j, k = (yy - 70) / 66, x0 = lerp(136, -60, k), x1 = lerp(184, 380, k), hw = (x1 - x0) / 2, du = .1, sw = du * hw;
      for (let x = Math.max(0, Math.floor(x0)); x < Math.min(W, x1); x++) { const u = (x - 160) / hw + (row % 2 ? du / 2 : 0), sid = Math.floor(u / du), fu = u / du - sid;
        if ((j === h - 1 && h > 1) || (fu * sw < 1 && sw > 3)) { px(x, yy, MOR); continue; }
        let L = 1.9 + (hsh(sid, row) - .5) * .9;
        for (const [lx, ly, lr] of LIG) { const d = Math.hypot(x - lx, (yy - ly) * 2.2); if (d < lr) L += 2.2 * (1 - d / lr); }
        if (u < -.6) L -= (-.6 - u) * 5;
        if (hsh(sid, row + 50) < .07) { L -= .9; if (h > 2 && Math.round(fu * sw) === j + 1) { px(x, yy, MOR); continue; } }
        if (j === 0 && h > 2) L += .5;
        L += (bay(x, yy) - .5) * .3 + (hsh(sid, row + 9) < .5 ? .25 : -.25); px(x, yy, FL[Math.max(0, Math.min(4, Math.round(L)))]);
        if (hsh(x, yy) < .012 && h > 2) px(x, yy, MOR);
        if (k < .4 && bay(x, yy) < (.4 - k) / .4 * .85) px(x, yy, k < .15 ? "#8c5850" : "#7c4c48"); } }
    y += h; }
  // reunakivet seinien juurella: tumman ruskea sävyramppi
  fillPoly([[0, 112], [136, 70], [0, 116]], "#4a2c24"); lineC(0, 112, 136, 70, "#7c4c34"); fillPoly([[320, 112], [184, 70], [320, 116]], "#3c2420"); lineC(319, 112, 184, 70, "#5c3828");
  // matto vasemmalla seinällä (kartta kudottuna)
  fillPoly([[16, 46], [50, 54], [50, 98], [16, 100]], "#6c1428"); fillPoly([[19, 50], [47, 57], [47, 95], [19, 97]], "#b42c38"); fillPoly([[22, 54], [44, 60], [44, 92], [22, 94]], "#d8983c");
  disc(33, 75, 4, "#2c3c8c"); disc(33, 75, 2, "#e8c84c"); for (let k = 0; k < 7; k++) px(25 + k * 2, 86 - (k % 3), "#c81c1c"); r(39, 83, 1, 3, "#1c1c1c"); r(38, 84, 3, 1, "#1c1c1c");
  for (let x = 16; x < 50; x += 2) r(x, 99 + (x - 16) / 34, 1, 2, "#c8a878");
  // Mehmetin koju oikealla: takaseinä, hylly, katos poimuineen ja varjo (tiski itse on propsi)
  r(216, 66, 2, 26, "#5c3418"); r(296, 60, 2, 34, "#5c3418"); fillPoly([[218, 66], [296, 60], [296, 92], [218, 92]], "#4a2414");
  for (let x = 218; x < 296; x++) { const yb = 66 - (x - 214) * 6 / 86; for (let j = 1; j < 7; j++) if (bay(x, yb + j) < .8 - j * .12) px(x, yb + j, "#2a1410"); }
  fillPoly([[214, 58], [300, 50], [300, 60], [214, 66]], "#2c7c4c"); for (let i = 0; i < 6; i++) { const a = 214 + i * 14.3; fillPoly([[a, 58 - i * 1.3], [a + 7, 58 - i * 1.3 - .7], [a + 7, 66 - i * 1], [a, 66 - i * 1]], "#e8e0c4");
    lineC(a + 7, 58 - i * 1.3, a + 7, 65 - i, "#c8bc9c"); lineC(a + 14, 57 - i * 1.3, a + 14, 64 - i, "#1c5c34"); }
  lineC(214, 58, 300, 50, "#5cac6c");
  for (let i = 0; i < 12; i++) { const x = 214 + i * 7.15, yb = 66 - (x - 214) * 6 / 86, c = i % 2 ? "#2c7c4c" : "#e8e0c4"; r(x + 1, yb, 5, 1, c); r(x + 2, yb + 1, 3, 1, c); px(x + 3, yb + 2, i % 2 ? "#1c5c34" : "#c8bc9c"); }
  r(220, 88, 74, 2, "#6c3c1c"); r(220, 88, 74, 1, "#9c6430"); r(220, 90, 74, 1, "#2a1410");
  for (const x of [232, 240]) { r(x, 82, 6, 6, "#a87c18"); r(x, 82, 2, 6, "#fcc860"); r(x + 4, 83, 2, 5, "#6c4c10"); r(x + 6, 81, 2, 2, "#a87c18"); px(x + 7, 80, "#6c4c10");
    r(x + 1, 80, 4, 2, "#c8941c"); px(x + 1, 80, "#fcd890"); px(x + 2, 79, "#6c4c10"); }
  for (const x of [252, 256, 260, 264]) { r(x, 84, 2, 4, "#8c2c10"); r(x, 84, 1, 4, "#fc9c5c"); r(x, 83, 2, 1, "#f4e8d8"); }
  r(274, 81, 10, 7, "#2c6c9c"); r(276, 79, 6, 2, "#2c6c9c"); r(274, 82, 1, 5, "#fca86c"); r(275, 81, 2, 6, "#5c9cc8"); r(281, 81, 3, 7, "#1c4468"); r(283, 82, 3, 1, "#2c6c9c");
  px(276, 83, "#e8f4fc"); for (let x = 277; x < 281; x += 2) px(x, 85, "#e8c81c");
  for (const [x, y] of [[250, 74], [260, 76]]) { lineC(x, 66 - (x - 214) * 6 / 86, x, y - 3, "#3c2c1c"); disc(x, y, 2, "#c87c3c", "#7c3c1c"); px(x - 2, y, "#fcb06c"); px(x - 1, y - 1, "#fcb06c"); px(x + 1, y + 1, "#5c2c14"); }
  // kadun pää: kuja moskeijan alla
  r(146, 54, 28, 16, "#2c1428"); disc(160, 54, 14, "#2c1428"); r(146, 68, 28, 2, "#4a2440");
  // auringonlasku kadun päästä: kylmä violetti varjo seinien juurella, lämmin reunavalo, vinjetti
  for (let y = 0; y < 116; y++) for (let x = 0; x < W; x++) { const mx = x < 160 ? x : 319 - x, wall = x < 160 ? inL(x, y) : inR(x, y);
    if (!wall) continue;
    if ((mx < 60) && y >= 20 && y > (112 - 42 * mx / 136) - 34 && bay(x, y) < Math.min(1, (y - (112 - 42 * mx / 136) + 34) / 8)) px(x, y, "#3a2a4a");
    if (y < 12 && bay(x, y) < (12 - y) / 12 * .9 && (mx < 60 || y < 8)) px(x, y, "#2a1f40"); }
  for (let y = 38; y < 70; y++) { px(135, y, "#ffb060"); px(184, y, "#ffb060"); }
  lineC(0, 112, 136, 70, "#ffb060"); lineC(319, 112, 184, 70, "#ffb060");
  basaariDetail();
}
// Yksityiskohtakerros (17.10.: "paranna grafiikat Istanbuliin" Kisapuiston tasolle):
// pilvet ja kaukaiset minareetit, kangaskattokaistale, keramiikkalautaset, kuparipannut,
// riippuvat matot, kankaat, mausteiden ja teelasien pöytä, kaukaiset kojut, kissa.
function basaariDetail() {
  seed = 51;
  for (let i = 0; i < 16; i++) { const w = 6 + (rnd() * 5 | 0), x = 30 + (rnd() * 250 | 0), y = 5 + (rnd() * 26 | 0), lo = y > 16; if (y + 4 > 38 * Math.min(x - 2, 318 - x - w) / 136) continue;
    r(x + 2, y, w - 4, 1, lo ? "#e88c5c" : "#a03c68"); r(x, y + 1, w, 1, lo ? "#c85c50" : "#7c2458"); r(x + 1, y + 2, w - 2, 1, lo ? "#fcb878" : "#d05c78"); }
  // kaukaiset kojut kadun päässä
  for (const [x, c] of [[138, "#2c7c4c"], [148, "#b81c1c"], [166, "#2c4c9c"], [176, "#c8941c"]]) { fillPoly([[x, 64], [x + 8, 64], [x + 9, 67], [x - 1, 67]], c); r(x, 67, 8, 4, "#3c1c18"); }
  // keramiikkalautaset oikealla seinällä markiisin yläpuolella
  for (let i = 0; i < 7; i++) { const x = 220 + i * 11, y = 34 + (i % 2) * 6 - i * .6;
    disc(x, y, 4, "#f4f0e4", "#2c4c9c"); disc(x, y, 2, i % 3 ? "#2c6cb4" : "#c83c2c"); px(x, y, "#f4f0e4"); px(x - 2, y - 2, "#ffffff"); }
  // kuparipannut ja lyhtyrypäs vasemmalla seinällä kaarien yläpuolella
  for (let i = 0; i < 5; i++) { const x = 62 + i * 13, y = 36 + i * 3.4; r(x, y - 6, 1, 6, "#3c2c1c"); disc(x, y + 2, 3, "#c87c3c", "#8c4c1c"); px(x - 1, y + 1, "#fcc890"); r(x + 3, y + 1, 2, 1, "#8c4c1c"); }
  // riippuvat kankaat oikealla sivuseinällä (kojun ja kuvan reunan välissä)
  for (const [x, c1, c2] of [[302, "#c83c4c", "#e8c84c"], [310, "#2c6c9c", "#e8e0c4"]]) { for (let y = 46; y < 92; y++) { const w = 6 + Math.sin(y / 5) * .8; r(x, y, w, 1, (y >> 2) % 3 ? c1 : c2); } r(x - 1, 45, 8, 1, "#5c3418"); }
  // pöytä: teelasit ja baklava edustalla vasemmalla
  fillPoly([[112, 112], [140, 112], [142, 116], [110, 116]], "#9c6c38"); dither(112, 113, 28, 2, "#9c6c38", "#7c5028", .35); r(110, 116, 32, 2, "#5c341c"); for (let x = 111; x < 142; x += 2) px(x, 116 + (x >> 1) % 2, "#7c4c24");
  r(112, 118, 2, 10, "#4c2c14"); r(112, 118, 1, 10, "#7c4c24"); r(138, 118, 2, 10, "#4c2c14"); r(114, 128, 28, 1, "#3c2430");
  for (const x of [116, 122, 128]) { r(x - 1, 111, 5, 1, "#e8c81c"); px(x + 3, 111, "#a8841c"); r(x, 106, 3, 5, "#b83c14"); r(x + 1, 107, 1, 3, "#fc8c3c"); r(x, 106, 1, 5, "#fce8c8"); r(x + 2, 106, 1, 5, "#6c1c08"); r(x, 105, 3, 1, "#f4ece0"); }
  r(132, 108, 8, 4, "#d8a04c"); for (let k = 0; k < 4; k++) px(133 + k * 2, 109, "#7c9c3c");
  // ilmaperspektiivi: kaukaiset seinänosat viilenevät kohti katoamispistettä
  const inL = (x, y) => x < 136 && y > 38 * x / 136 && y < 112 - 42 * x / 136;
  for (let y = 26; y < 80; y++) for (let x = 84; x < 136; x++) { const d = (x - 84) / 52 * .3; if (!inL(x, y) || y < 38 * x / 136 + 21 || bay(x, y) >= d) continue;
    px(x, y, "#8c5c64"); if (x > 108) px(320 - x, y, "#7c5460"); }
  // lyhtyjen hehku: kolmiportainen ditheröity sädekehä (lämmin päävalo)
  for (const [lx, ly, s] of [[60, 40, 1], [110, 50, .7], [210, 50, .7], [262, 40, 1]]) for (const [rr, dn, c] of [[13, .14, "#c87848"], [9, .3, "#f0a050"], [5.5, .55, "#fcd070"]]) {
    const R = rr * s; for (let y = ly + 3 - R; y < ly + 3 + R; y++) for (let x = lx - R; x < lx + R; x++) if (Math.hypot(x - lx, y - ly - 3) < R && bay(x, y) < dn) px(x, y, c); }
  // riippuvat kangasmatot vasemmalla seinällä: siksak-kuvio
  for (const [x, y, h, c1, c2] of [[52, 50, 12, "#2c8a8a", "#b53a3a"], [57, 56, 14, "#b53a3a", "#2c8a8a"], [31, 52, 10, "#2c8a8a", "#b53a3a"]]) { r(x - 1, y - 1, 6, 1, "#3c2c1c");
    for (let j = 0; j < h; j++) for (let i = 0; i < 4; i++) px(x + i, y + j, (i + (j >> 1) % 2 * 2 + (j % 2)) % 4 < 2 ? c1 : c2); }
  // lyhdyt narujen varassa: kolme kokoa, hehkuhalo
  const LAN = [[70, 36, 1], [110, 28, 2], [150, 24, 0], [205, 33, 2]];
  for (let i = 0; i < LAN.length; i++) { const [x, y] = LAN[i]; if (i) lineC(LAN[i - 1][0], LAN[i - 1][1] - 6, x, y - 6, "#3c2c1c"); }
  for (const [x, y, s] of LAN) { const R = 4 + s;
    for (let yy = y - R; yy <= y + 4 + R; yy++) for (let xx = x - R; xx <= x + 2 + R; xx++) if (Math.hypot(xx - x - 1, yy - y - 1.5) < R && bay(xx, yy) < .4) px(xx, yy, "#c8602a");
    r(x + 1, y - 6, 1, 6, "#3c2c1c"); r(x, y, 3, 4, "#ffb347"); px(x + 1, y + 1, "#fff0a0"); px(x + 1, y + 2, "#fff0a0"); px(x + 1, y - 1, "#6c3c1c"); }
  // kivilaattojen kohokohdat: säteet katoamispisteeseen (160,64)
  for (const x0 of [10, 50, 90, 125, 195, 230, 270, 310]) for (let y = 95; y <= 130; y++) if ((y + (x0 >> 2)) % 3 === 0) px(Math.round(160 + (x0 - 160) * (y - 64) / 66), y, "#d9a066");
  // kissa kadulla (piirretään animoituna basaariDraw:ssa, tässä vain varjo)
  g.fillStyle = "rgba(0,0,0,.3)"; g.beginPath(); g.ellipse(186, 127, 6, 1.5, 0, 0, 7); g.fill();
}
const CROWD2 = Array.from({ length: 5 }, (_, i) => ({ x: 140 + i * 9, v: (i % 2 ? -1 : 1) * (3 + i), fez: i % 2 === 0, c: ["#3c1c24", "#2c1c34", "#4c2c1c"][i % 3] }));
function basaariDraw(t) {
  g.drawImage(paintBg("baz_sky", basaariSky), 0, 0);
  BAZ_CLOUDS.forEach((b, k) => drift(`baz_cloud${k}`, b[5], (w) => bazCloudBand(w, b, k), t));
  g.drawImage(paintBg("baz_fg", basaariFg), 0, 0);
  // kaukainen väkijoukko kadun päässä (pienet)
  for (const p of CROWD2) { p.x += p.v * 0.016; if (p.x < 138) p.v = Math.abs(p.v); if (p.x > 182) p.v = -Math.abs(p.v);
    npc(CROWD2.indexOf(p), p.x, 72, t + p.x * 40, { moving: true, dir: Math.sign(p.v), sc: .42, hsc: .45 }); }
  for (let i = 0; i < 3; i++) { const x = ((t / (38 + i * 9) + i * 130) % 380) - 30, y = 10 + i * 7 + Math.sin(t / 320 + i) * 3, up = Math.floor(t / 160 + i) % 2;
    px(x, y + up, "#2c1428"); px(x + 1, y, "#2c1428"); px(x + 2, y + 1, "#2c1428"); px(x + 3, y, "#2c1428"); px(x + 4, y + up, "#2c1428"); }
  // viirinauha Turkin lipuin kadun yli
  for (let x = 20; x < 300; x++) px(x, 24 + Math.round(Math.sin((x - 20) / 280 * Math.PI) * 8), "#3c1c1c");
  for (let x = 30; x < 300; x += 30) turkFlag(x, 25 + Math.round(Math.sin((x - 20) / 280 * Math.PI) * 8));
  // lyhdyt
  for (const [x, y, s] of [[60, 40, 1], [110, 50, .7], [210, 50, .7], [262, 40, 1]]) { const f = .5 + .5 * Math.sin(t / 110 + x); r(x, y - 4, 1, 4, "#3c2c1c");
    r(x - 2 * s, y, 5 * s, 6 * s, "#a8741c"); r(x - s, y + s, 3 * s, 4 * s, f > .5 ? "#fce070" : "#fcc040"); glow(x, y + 3, 12 * s, "255,160,60", .16 + .05 * f); }
  // höyry teelaseista, kissa jonka häntä heiluu, kyyhkyt
  for (let i = 0; i < 3; i++) { const k = ((t / 900 + i / 3) % 1); px(118 + i * 6 + Math.sin(t / 300 + i) * 1.5, 105 - k * 10, `rgba(240,230,220,${.5 * (1 - k)})`); }
  { const tw = Math.sin(t / 420) * 3; r(182, 120, 8, 6, "#4c3c34"); disc(188, 119, 3, "#4c3c34"); px(186, 116, "#4c3c34"); px(190, 116, "#4c3c34"); px(187, 119, "#c8e85c"); px(189, 119, "#c8e85c");
    lineC(182, 124, 177, 120 + tw, "#4c3c34"); }
  for (const [x0, ph] of [[200, 0], [208, 1.7]]) { const hop = Math.max(0, Math.sin(t / 260 + ph)) * 1.5; r(x0, 128 - hop, 4, 3, "#8c8c9c"); px(x0 + 4, 128 - hop, "#6c6c7c"); px(x0 + 5, 129 - hop, "#d8a43c"); }
  // döner kojun edustalla
  { const ph = Math.floor(t / 140) % 3; r(226, 68, 1, 24, "#8c8c8c"); r(230, 66, 6, 26, "#2c2c2c"); r(231, 68, 4, 22, "#e8401c"); glow(233, 80, 11, "255,90,30", .2);
    for (let j = 0; j < 20; j++) { const w = 5.5 - Math.abs(j - 8) / 4; r(226 - w / 2 + .5, 70 + j, w, 1, (j + ph) % 3 === 0 ? "#6c3414" : (j + ph) % 3 === 1 ? "#a8642c" : "#c8843c"); } }
}
function basaariCounter() {
  // varjokaista katoksen alla ja tavaraa takaseinällä (kankaat, messinkipannut)
  for (let x = 218; x < 296; x++) { if (x > 223 && x < 239) continue; const yb = 66 - (x - 214) * 6 / 86; for (let j = 1; j < 5; j++) if (bay(x, yb + j) < .9 - j * .15) px(x, yb + j, "#160a0c"); }
  for (const [x, c1, c2, len] of [[218, "#8c2c5c", "#e8c84c", 14], [286, "#c86c1c", "#2c5c8c", 16], [291, "#2c7c5c", "#e8e0c4", 12]]) { const yb = Math.round(66 - (x - 214) * 6 / 86) + 2;
    for (let y = yb; y < yb + len; y++) { r(x, y, 4, 1, (y - yb) % 5 === 2 ? c2 : c1); px(x + 3, y, "#2a1018"); } r(x, yb + len, 4, 1, c2); px(x + 1, yb + len + 1, c2); }
  for (const [x, y] of [[268, 72], [276, 70]]) { r(x, 66 - (x - 214) * 6 / 86 + 1, 1, y - 66 + (x - 214) * 6 / 86 - 2, "#3c2c1c"); r(x - 2, y - 1, 5, 1, "#a87c18"); disc(x, y + 2, 3, "#c8941c", "#6c4c10"); px(x - 1, y + 1, "#fcd890"); px(x + 2, y + 3, "#6c4c10"); }
  fillPoly([[218, 92], [296, 92], [300, 98], [214, 98]], "#8c5c2c"); lineC(218, 92, 296, 92, "#6c4020"); r(214, 97, 86, 1, "#c08a4c");
  r(214, 98, 86, 14, "#24448c"); r(214, 98, 86, 2, "#3c64b4"); r(214, 98, 86, 1, "#6c8ccc");
  for (const x of [236, 263, 285]) { r(x, 100, 3, 12, "#1a3070"); r(x - 1, 100, 1, 12, "#3458a8"); }
  [219, 228, 243, 251, 258, 271, 279, 293].forEach((x, i) => { const y = 105 + (i % 3 === 1 ? 1 : 0);
    if (i % 2 === 0) { px(x, y - 2, "#fcec8c"); r(x - 1, y - 1, 3, 1, "#e8c81c"); r(x - 2, y, 5, 1, "#e8c81c"); r(x - 1, y + 1, 3, 1, "#e8c81c"); px(x, y + 2, "#a8841c"); }
    else { px(x, y - 1, "#fcec8c"); r(x - 1, y, 3, 1, "#e8c81c"); px(x, y + 1, "#a8841c"); } });
  r(214, 111, 86, 1, "#18285c"); r(214, 112, 86, 1, "#e8c81c");
  for (let x = 214; x < 300; x += 2) r(x, 113, 1, (x * 7) % 5 > 2 ? 2 : 1, "#c8a41c");
  for (let x = 217; x < 300; x += 9) { r(x, 113, 1, 3, "#e8c81c"); px(x, 116, "#a8841c"); }
  for (const x of [244, 249, 254]) { r(x, 89, 3, 3, "#a83c1c"); r(x, 89, 1, 3, "#fc9c5c"); r(x + 2, 89, 1, 3, "#6c200c"); r(x, 88, 3, 1, "#f4e8d8"); r(x - 1, 92, 5, 1, "#e8c81c"); } shadow(257, 114, 42);
  r(214, 117, 86, 1, "#4a2418"); for (let y = 118; y < 121; y++) for (let x = 214; x < 300; x++) if (bay(x, y) < .9 - (y - 118) * .3) px(x, y, "#2a1f4d");
  // messinkitee: kannu ja kupit tiskillä
  r(289, 87, 6, 4, "#c8941c"); r(288, 88, 1, 2, "#c8941c"); px(296, 87, "#c8941c"); px(297, 86, "#a87c18"); r(290, 86, 4, 1, "#a87c18"); px(292, 85, "#ffe08a"); px(290, 88, "#ffe08a"); r(289, 91, 6, 1, "#6c4c10");
  for (const x of [221, 226]) { r(x, 90, 3, 2, "#c8941c"); px(x, 90, "#ffe08a"); px(x + 1, 92, "#6c4c10"); }
  // lampun lämmin hehku tiskin ja kauppiaan päällä
  for (let y = 42; y < 83; y++) for (let x = 232; x < 273; x++) { const d = Math.hypot(x - 252, y - 62) / 20; if (d < 1 && bay(x, y) < (1 - d) * .38) px(x, y, "#ffcf70"); } }
function basaariSpices() {
  for (const [x, c, hi, sh, dk] of [[70, "#c83c1c", "#fc7c4c", "#8c2410", "#4c1408"], [84, "#e0a81c", "#fce47c", "#a8741c", "#5c3c0c"], [98, "#5c8c2c", "#9cc85c", "#3c6018", "#1c3410"]]) {
    r(x - 1, 95, 14, 7, "#7c4c24"); r(x - 1, 95, 14, 1, "#b07c44"); r(x - 1, 98, 14, 1, "#4a2810"); r(x - 1, 101, 14, 1, "#3c200c"); r(x - 1, 95, 1, 7, "#4a2810"); r(x + 12, 95, 1, 7, "#3c200c"); px(x + 3, 96, "#5c3418"); px(x + 8, 99, "#5c3418");
    r(x, 89, 12, 6, "#c8b080"); for (let j = 0; j < 6; j++) for (let i = j % 3; i < 12; i += 3) px(x + i, 89 + j, "#b09868"); r(x + 9, 90, 3, 5, "#a08858");
    r(x - 2, 87, 16, 2, "#3a2010"); r(x - 1, 87, 14, 1, "#8a5a30"); r(x - 1, 88, 14, 1, "#6a4020");
    const RP = { "#c83c1c": ["#7a1f1a", "#b8341f", "#e0592a", "#ffa050"], "#e0a81c": ["#a87a10", "#d9a520", "#ffd34a", "#ffd34a"], "#5c8c2c": ["#3a5a1a", "#6a8a2a", "#a0c050", "#a0c050"] }[c];
    for (let j = 0; j < 9; j++) { const w = 2 + (j * 1.45 | 0), x0 = x + 6 - (w >> 1), y = 79 + j;
      px(x0 - 1, y, "#3a2010"); px(x0 + w, y, "#3a2010");
      for (let i = 0; i < w; i++) { const t = i / Math.max(1, w - 1); px(x0 + i, y, i === w - 1 && w > 3 ? "#3a2040" : RP[t < .25 ? 3 : t < .5 ? 2 : t < .8 ? 1 : 0]); }
      if (j > 1 && j % 3 === 1) px(x0 + 1, y, RP[3]); }
    r(x + 5, 78, 2, 1, "#3a2010"); r(x + 13, 97, 2, 5, "#3c2430"); }
  r(69, 102, 44, 1, "#3c2430"); }
// Mehmetin nahkapussit kojun katosta (sokkotesti 2: Jussi puhui pusseista, joita ei näkynyt).
function basaariBags() { lineC(274, 64, 296, 64, "#5c3c1c");
  for (const [x, h] of [[278, 14], [285, 18], [292, 12]]) { lineC(x, 64, x, 64 + h - 8, "#3c2c1c");
    disc(x, 64 + h - 4, 4, "#8c5428", "#6c3c1c"); r(x - 2, 64 + h - 9, 4, 2, "#7c4824"); px(x - 1, 64 + h - 5, "#b07440"); r(x - 3, 64 + h - 7, 6, 1, "#e8c81c"); } }
// Tinkimistä kuunteleva väki etualalla (sokkotesti 2: "koko basaari kokoontuu", mutta ketään ei näkynyt).
function basaariCrowd(t) {
  // Reunoille, ettei väki peitä Jussia ja Mehmetiä keskellä; selät katsojaan päin.
  [14, 42, 70, 250, 278, 306].forEach((x, i) => npc(i, x, 156 + (i % 2) * 3, t, { sc: 1.2, back: true })); }
function basaariAmphora() { shadow(38, 131, 8); disc(38, 122, 8, "#b85c2c", "#8c3c1c"); r(35, 110, 7, 5, "#a84c24"); r(34, 109, 9, 2, "#c86c3c");
  r(32, 117, 2, 5, "#8c3c1c"); r(42, 117, 2, 5, "#8c3c1c"); px(34, 119, "#e88c5c"); px(35, 118, "#e88c5c"); r(31, 123, 14, 1, "#e8c81c"); }
// Olli Jokinen ja apurit (23.10.): lenkkeilevät basaarin läpi edestakaisin, puku päällä.
// Energian mestari; pysähtyy vasta kebabille. Apuvalmentajat jatkavat toistensa lauseita.
function jogPos(k) {
  if (st.flags.jokStop) return { x: [130, 114, 98][k], dir: 1, moving: false };
  const p = (performance.now() / 24) % 560, out = p < 280, x = out ? 20 + p : 300 - (p - 280);
  return { x: x - k * 15 * (out ? 1 : -1), dir: out ? 1 : -1, moving: true };
}
const jogActor = (id, k, draw) => ({ id, get x() { return jogPos(k).x; }, y: 128, h: 46, color: ["#f4c890", "#fc9c9c", "#fcfcfc"][k],
  hidden: () => st.scene !== "basaari", draw(t, talking) { const q = jogPos(k); draw(q, t, talking); } });
const JOKINEN = jogActor("jokinen", 0, (q, t, talking) => person("jokinen", q.x, 128, t, { moving: q.moving, dir: q.dir, talking }));
const HYVARINEN = jogActor("hyvarinen", 1, (q, t, talking) => npc(8, q.x, 128, t, { moving: q.moving, dir: q.dir, talking }));
const CARLSSON = jogActor("carlsson", 2, (q, t, talking) => npc(9, q.x, 128, t, { moving: q.moving, dir: q.dir, talking }));
// Basaari: katu kapenee kohti moskeijaa; Mehmet tiskinsä takana oikealla.
defineRoom("basaari", {
  title: "Suuri basaari, Istanbul", scale: [72, 136, 0.4, 1.06], start: 128,
  walk: [[[142, 72], [178, 72], [206, 96], [206, 121], [300, 136], [0, 136], [0, 124], [43, 124]]],      // vasen alakulma: porttiruutuun (24.10.)
  actors: [{ id: "kauppias", x: 258, y: 96, h: 46, color: "#fc54fc", draw: (t, talking) => merchant(258, 96, t, talking) }, JOKINEN, HYVARINEN, CARLSSON],
  draw: (t) => { basaariDraw(t); satamaPiano(t); ghostCup(t); },
  post: (t) => guideBasaari(t),
  onStop: (x, y) => quizStep(keyAt(x, y)),
  props: [{ y: 114, draw: basaariCounter }, { y: 101, draw: basaariSpices }, { y: 131, draw: basaariAmphora }, { y: 92, draw: basaariBags }, { y: 140, draw: (t) => (st.flags.crowd || st.flags.bazaar) && basaariCrowd(t) }],
  spots: [
    { id: "piano2", name: "heijastetut numerot", floor: true, hidden: () => !st.flags.quizT_basaari, x: 70, y: 100, w: 136, h: 16, at: 150, aty: 108,
      Katso: () => say("Numerot heijastuvat kadun mukulakiviin. Mehmetillä on yllättävän hyvä tekniikka.") },
    { id: "amfora", name: "amfora", x: 28, y: 108, w: 22, h: 24, at: 56, aty: 130,
      Katso: () => say("Amfora. Kyljessä lukee \"ÄLÄ AVAA\". Kerrankin kunnioitan ohjetta."), Avaa: () => say("Siinä lukee \"älä avaa\". Opin jotain tänään.") },
    { id: "mausteet", name: "mausteet", x: 68, y: 84, w: 44, h: 18, at: 104, aty: 104,
      Katso: () => say("Paprikaa, kurkumaa ja minttua. Basaarin tuoksu on puoliksi näitä, puoliksi kebabia."), Poimi: () => say("Mausteet punnitaan, ystäväni. Ei sormia.", "kauppias") },
    { id: "doner", name: "döner-varras", x: 222, y: 64, w: 16, h: 28, at: 206, aty: 108,
      Katso: () => say("Döner kebab pyörii hitaasti. Kuin Liigan otteluohjelma: aina sama liha, mutta joka kerta eri kohdassa."),
      Poimi: () => say("Kebab maksaa, ystäväni. Mutta tuoksu on ilmainen.", "kauppias"),
      Käytä: () => say("Pyöritän sitä toiseen suuntaan. Mehmet katsoo minua kuin olisin siirtänyt ottelun.") },
    { id: "matto", name: "matto", x: 16, y: 46, w: 34, h: 54, at: 56, aty: 112,
      Katso: async () => { st.flags.map = true; iq("kartta", 4); await say("Mattoon on kudottu kartta! Kappadokia... luolatemppeli... ja punainen rasti.\nMuistan sen. Kadun päästä pääsee itään."); },
      Poimi: () => say("Matto maksaa enemmän kuin sinä.", "kauppias"), Työnnä: () => say("Matto ei lennä. Tarkistin.") },
    { id: "kauppias", name: "kauppias", actor: true, x: 247, y: 64, w: 22, h: 32, at: 160, aty: 122,
      Katso: () => say("Mehmet, Mouho Global Partnersin johtaja. Basaarin kovin tinkijä. Kuulemma hän on myynyt hiekkaa autiomaahan ja logon Lappeenrantaan."),
      Puhu: () => talk(), Anna: (it) => it === "idoli" ? deliverIdol() : it === "kaavio" ? talk() : it === "nimikyltti" ? say("Kiiltävä! Mutta ensin tingitään, ystäväni.", "kauppias") : say("Ei kiitos.", "kauppias") },
    { id: "pussit", name: "nahkapussit", x: 274, y: 64, w: 22, h: 22, at: 262, aty: 118,
      Katso: () => say(st.flags.needWeight ? "Nahkapusseja Mehmetin kojussa. Juuri sopivia hiekalle." : "Nahkapusseja roikkuu kojun katosta. Kauniita, mutta mihin minä pussia tarvitsisin?"),
      Poimi: () => say("Pussit punnitaan, ystäväni. Ja niistä tingitään.", "kauppias") },
    { id: "jokinen", name: "Olli Jokinen", actor: true, get x() { return Math.min(jogPos(0).x, jogPos(2).x) - 8; }, y: 96, w: 46, h: 32, get at() { return st.flags.jokStop ? 150 : 160; }, aty: 124,
      Katso: () => say(st.flags.jokStop ? "Olli Jokinen ja kaksi apuvalmentajaa. Puvut päällä, kebabit kädessä, energiaa yli kolmen miehen tarpeen." : "Olli Jokinen lenkkeilee basaarin läpi puku päällä. Perässä kaksi apuvalmentajaa. Kierros kierrokselta."),
      Puhu: () => jokinenTalk(), "Käytä:kebab": () => jokinenKebab(), Anna: (it) => it === "kebab" ? jokinenKebab() : say("Ei nyt! Lenkki kesken!", "jokinen") },
    { id: "itaan", name: "itäinen kuja", x: 140, y: 40, w: 40, h: 31, at: 160, aty: 73, exit: true,
      Katso: () => say(st.flags.map ? "Kuja itään, Kappadokiaan, kartan mukaan." : "Kuja moskeijan alla. En tiedä mihin se vie."), Käytä: () => toTemple(), Kävele: () => toTemple() },
  ],
});

// Kaupanteko haukkumalla, kuten miekkailu Melee Islandilla (17.10. uudistettu: oikea vastaus
// oli aina ainoa nokkela). Vaihtoehdot ovat kaikki nokkelia vastauksia samasta joukosta;
// vain yksi kääntää juuri tämän piikin takaisin. Häviössä Mehmet kertoo, mikä olisi osunut.
const BARGAIN = [
  { a: "Tuollaisella takilla et pääse edes Mikkelin torille!", ok: "Ja tuollaisilla hinnoilla et myisi edes Mikkelin torilla." },
  { a: "Äitini tinkii paremmin kuin sinä!", ok: "Ilmeisesti, koska hän ei ole koskaan ostanut sinulta mitään." },
  { a: "Sinä maksaisit ennakkoon kenelle tahansa, jolla on liituraitapuku!", ok: "Siksi tingin nyt, enkä maksa mitään ennakkoon." },
  { a: "Sinä et erottaisi döneriä iskenderistä!", ok: "Mutta erotan hyvän kaupan huonosta." },
  { a: "Tämä pussi kuului itse sulttaanille!", ok: "Sitten sulttaani ostaa sen takaisin kalliimmalla." },
];
// Hämäysvastauksia, jotka eivät osu mihinkään piikkiin, mutta kuulostavat siltä.
const BARGAIN_DECOYS = ["Minulla on kumikana väkipyörällä, jos sitä tarvitset.", "Ainakin minun kebabini on maksettu, toisin kuin sinun.", "Sanoo mies, jonka viikset on vuokrattu naapurikojusta."];   // yhtä pitkiä kuin oikeat: pituus ei saa paljastaa
async function talk() {
  await script(async () => {
    if (!st.flags.merhaba) { st.flags.merhaba = true;
      await say("Hoş geldiniz! Merhaba, ystäväni! Tervetuloa Mehmetin kojuun, Istanbulin rehellisimpään.", "kauppias");
      await say("Teşekkür... ederim? Opettelin sen lentokoneessa."); }
    // Keskustelu etenee yhtä polkua (17.10.): kuka olet -> suunnitelma ja sopimus -> lahja
    // (idoli) -> kartta -> luola (paineansa) -> pussi. Pussi tingitään Mehmetiltä, ja hinta
    // on Jussin vanha nimikyltti.
    while (true) {
      const f = st.flags, opts = [];
      if (has("idoli")) opts.push("Löysin pyramidin huipun!");
      if (!f.mehmetWho) opts.push("Mouho Global Partners? Kirjeessä luki teidän osoitteenne.");
      if (f.mehmetWho && !f.signed) opts.push("Esittelen jäsenhankintasuunnitelmani.");
      if (f.quest && !f.map && !f.askedMap) opts.push("Missä se Kappadokian luola on?");
      if (f.needWeight && !has("pussi") && !has("sakki") && !f.swapped) opts.push("Tarvitsen pussin. Idolin tilalle pitää laittaa hiekkaa.");
      if (!f.kebabQ) opts.push("Missä saa Istanbulin parhaan kebabin?");
      opts.push("Ei mitään, näkemiin.");
      const pick = opts[await choose(opts)]; await say(pick);
      if (pick.startsWith("Löysin")) return deliverIdol(true);
      if (pick.startsWith("Mouho Global")) { f.mehmetWho = true;
        await say("Ah, herra Markkanen, brändin mies! Mehmet, Mouho Global Partnersin johtaja. Serkkuni Lappeenrannassa kertoi teistä.", "kauppias");
        if (has("kirje") || has("kortti")) { take("kirje"); take("kortti"); await say("Mehmet ottaa kirjeen ja käyntikortin talteen. \"Paperit kuuluvat arkistoon, ystäväni.\"", "muu"); }
        await say("Se liituraitainen mies on serkkunne? Maailma on pieni. Ja pyramidin muotoinen.");
        await say("Näytä suunnitelma, ystäväni. Sijoittajat haluavat nähdä, mitä ostavat.", "kauppias"); continue; }
      if (pick.startsWith("Esittelen")) { await pitchPyramid(); continue; }
      if (pick.startsWith("Missä se")) { f.askedMap = true;
        await say("Isoisäni kutoi tien mattoon, ettei kukaan unohtaisi. Tuossa, seinällä vasemmalla. Katso tarkkaan.", "kauppias"); continue; }
      if (pick.startsWith("Tarvitsen pussin")) {
        await say("Paineansa! Isoisäni yritti samaa vaihtoa. Hänen nahkapussinsa on yhä tallessa. Mutta se ei ole ilmainen, ystäväni.", "kauppias");
        await say("Basaarissa hinnasta tingitään. Pärjää minulle tinkimisessä, niin sovitaan hinnasta.", "kauppias");
        if (await bargain()) return; continue; }
      if (pick.startsWith("Missä saa")) { f.kebabQ = true;
        await say("Täältä! Mehmetin kebab on Istanbulin paras. Serkun kioskin kebab on toiseksi paras. Mutta älä kerro hänelle.", "kauppias");
        await say("Hyvä kebab. Hyvä ruoka, kuten Jouko sanoi. Tämä voi vielä olla tärkeää."); continue; }
      await say("Palaa pian, ystäväni! Hinnat nousevat joka minuutti.", "kauppias"); return;
    }
  });
}
// Pyramidin esittely: Myrrä soittaa kesken ("älä maksa mitään etukäteen") ja Jussi
// allekirjoittaa velkakirjan -- jälkikäteen maksettava kebabtarjoilu Mouhoon.
async function pitchPyramid() {
  await say("Tässä, herra Mehmet. Jäsenhankinta: jokainen jäsen tuo kaksi uutta. Ja Mouho on kaikille ilmainen!");
  await say("Muhteşem! Ilmainen tuote, joka leviää itsestään. Ostamme sen. Koko brändin. Allekirjoita tähän.", "kauppias");
  await say("Kumppanuussopimus! Juuri sitä...");
  await myrraIncoming(1);
  await say("Luin sen, herra Mehmet. Kebabtarjoilu Mouhoon, maksetaan jälkikäteen. Allekirjoitan.");
  st.flags.signed = true; give("velkakirja"); iq("jalkikateen", 5);
  await say("Sopimuksen ensimmäinen sivu, jota Jussi ei lukenut: \"Mouho-brändin oikeudet siirtyvät Mouho Global Partnersille.\"", "muu");
  await say("Tarjoilu hoidettu! Tehtävälistassa on enää turnaus.");
  await questLines();
}
async function questLines() {
  st.flags.questHeard = true; st.flags.quest = true;
  await say("Vielä yksi asia, ystäväni. Basaarissa kauppa sinetöidään lahjalla. Ja minä tiedän, minkä lahjan haluan.", "kauppias");
  await say("Isoisäni puhui kultaisesta idolista Kappadokian luolassa. Pyramidin huippu, hän sanoi. Tuo se, niin kauppa on valmis.", "kauppias");
  await say("Pyramidin huippu! Ja kultainen. Siitä tulisi turnaukselle hieno kiertopalkinto.");
  await say(st.flags.map ? "Matossa oli kartta itään. Kappadokia." : "Mutta mistä löytää Kappadokian luolan? Kysytään Mehmetiltä.");
}
// Idoli basaariin: sijoittajat tyytyväisiä, ja peli siirtyy loppuanimaatioon.
async function deliverIdol(inScript) {
  const run = async () => {
    await say("Herra Mehmet! Pyramidin huippu. Suoraan Kappadokiasta, kivenjärkäleen edestä.");
    take("idoli"); await say("Isoisäni idoli! Kauppa on sinetöity. Mouho on nyt Mouho Global!", "kauppias");
    await say("Ja koska olemme nyt kumppaneita, annan sen takaisin. Mouho Globalin ensimmäisen turnauksen kiertopalkinnoksi!", "kauppias"); give("idoli");
    await say("Ja koko basaari tulee mukaan Mouhoon. Kebabit mukana. Helsinkiin!", "kauppias");
    st.flags.trophy = true;
    await say("Jäsenet, tarjoilu ja palkinto turnaukseen. Kaikki kolme tehtävää! Haastatteluun! Mitä voisi mennä vikaan?");
    iq("huippu", 5); await sleep(400); await ending();
  };
  return inScript ? run() : script(run);
}

async function bargain() {
  st.flags.crowd = true; await say("Tinkiminen alkaa! Koko basaari kokoontuu kuuntelemaan.", "muu");
  for (const b of BARGAIN) {
    await say(b.a, "kauppias");
    const others = [...BARGAIN.filter((o) => o !== b).map((o) => o.ok), ...BARGAIN_DECOYS];
    for (let k = others.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [others[k], others[j]] = [others[j], others[k]]; }
    const opts = [b.ok, ...others.slice(0, 2)]; for (let k = opts.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [opts[k], opts[j]] = [opts[j], opts[k]]; }   // Fisher-Yates: sort-satunnaistus suosi kolmatta paikkaa
    const i = await choose(opts); await say(opts[i]);
    if (opts[i] === b.ok) { const n = BARGAIN.indexOf(b) + 1; beep(523 + n * 60, 140, "triangle", .05); await say(`Osuma! Basaari kohahtaa. (${n}/${BARGAIN.length})`, "muu"); }
    if (opts[i] !== b.ok) { await say("Ha! Basaari nauraa. Se ei osunut mihinkään.", "kauppias");
      await say(`Mehmet virnistää: "Olisit voinut sanoa: '${b.ok}' Palaa, kun osaat tinkiä, ystäväni."`, "muu"); st.flags.crowd = false; return false; }
  }
  await say("...Sinä tingit kuin oma veljeni. Hyvä on. Mitä tarjoat pussista?", "kauppias");
  await say("Minulla on... nimikyltti. \"Jussi Markkanen, urheilujohtaja.\" Messinkiä.");
  await say("Kiiltävä kyltti, jossa lukee johtaja! Basaarissa sellainen on arvokas. Kauppa!", "kauppias");
  await say("Hyvästi, urheilujohtaja. Tervetuloa, toiminnanjohtaja. Melkein.");
  take("nimikyltti"); give("pussi"); iq("tinkiminen", 10);
  await say("Ja kaupan päälle kebab, ystäväni. Kukaan ei lähde Mehmetin kojulta nälkäisenä.", "kauppias"); give("kebab");
  // Tinkimisen voitto on jäsenhankintaa: basaari haluaa mukaan siihen, mitä tämä mies tekee.
  await say("Basaari huutaa! Kukaan ei ole ennen pärjännyt Mehmetille tinkimisessä. Ja kaikki haluavat liittyä siihen, mitä tämä mies tekee.", "muu");
  st.flags.recruits = (st.flags.recruits ?? 0) + 40; st.flags.bazaar = true; iq("basaari", 5);
  await say("Neljäkymmentä uutta jäsentä! Ja isoisän nahkapussi. Takaisin luolaan hakemaan hiekkaa!");
  return true;
}


// ---------------------------------------------------------------- Olli Jokinen, energian mestari
// 23.10.: Monkey Island -sävy. Energia on aitoa taitoa; hauskaa on vain se, ettei sitä saa
// pysähtymään. Kebab (tinkimisen kaupanpäällinen) pysäyttää. "Energia tarttuu" (f.energia) on
// haastattelun vastaus. Yksi tuo kaksi: Jussin pyramidi toteutuu ensimmäisen kerran sellaisenaan.
async function jokinenKebab() {
  await script(async () => {
    const f = st.flags;
    if (f.jokStop) return say("Kebabit on jo syöty. Energia on palautunut. Uhkaavasti.");
    await say("Jussi asettuu lenkkipolulle kebab ojossa.", "muu");
    take("kebab"); f.jokStop = true; beep(330, 120, "triangle", .05);
    await say("Kebab! Energia tulee jostain!", "jokinen");
    await say("Me jaetaan...", "hyvarinen"); await say("...kolmeen osaan.", "carlsson");
    await say("Mehmetin kebab. Istanbulin paras. Hänen serkkunsa kioskin kebab on toiseksi paras, mutta älä kerro hänelle.");
  });
}
async function jokinenTalk() {
  await script(async () => {
    const f = st.flags;
    if (!f.jokStop) { await say(f.metJokinen ? "Herra Jokinen!" : "Olli Jokinen?! Herra Jokinen, hetki vain!"); f.metJokinen = true;
      await say("Ei nyt! Lenkki kesken!", "jokinen"); await say("Kierroksia...", "hyvarinen"); await say("...vielä kaksitoista.", "carlsson");
      return say("He eivät pysähdy puhumaan. Heidät pitäisi saada pysähtymään jollain."); }
    if (f.jokinenIn) return say("Nähdään Mouhossa!", "jokinen");
    if (!f.jokTalked) { f.jokTalked = true;
      await say("Olli Jokinen! Mitä te Istanbulissa teette?");
      await say("Treenileiri!", "jokinen"); await say("Kolme miestä...", "hyvarinen"); await say("...yksi lenkkipolku.", "carlsson"); }
    while (true) {
      const opts = [];
      if (!f.energia) opts.push("Mistä teillä riittää noin paljon energiaa?");
      if (!f.lauseet) opts.push("Miten te jatkatte noin toistenne lauseita?");
      if (f.energia || f.lauseet) opts.push(f.lyhyesti ? "Mouho. Ilmainen. Mukaan?" : "Mouho hakee jäseniä, ja se on ilmainen. Tulisitteko mukaan?");
      opts.push("Näkemiin.");
      const pick = opts[await choose(opts)]; await say(pick);
      if (pick.startsWith("Mistä")) { f.energia = true; iq("energia", 5);
        await say("Energia tarttuu! Kun yksi lähtee liikkeelle...", "jokinen"); await say("...toinen lähtee perään...", "hyvarinen"); await say("...ja kolmas tuo kebabit.", "carlsson");
        await say(f.lyhyesti ? "Energia tarttuu. Kaksi sanaa. Jalonen olisi ylpeä." : "Energia tarttuu. Kirjoitan sen kaavion kulmaan."); }
      else if (pick.startsWith("Miten te")) { f.lauseet = true;
        await say("Kun on tarpeeksi kauan...", "hyvarinen"); await say("...samassa vaihdossa...", "carlsson"); await say("...lauseita ei tarvitse puhua loppuun.", "jokinen");
        await say("Minä en ole koskaan saanut puhua lausetta loppuun. Minua vain keskeytetään."); }
      else if (pick.startsWith("Mouho")) {
        await say("Mukana!", "jokinen"); await say("Mukana...", "hyvarinen"); await say("...kaikki kolme!", "carlsson");
        f.jokinenIn = true; f.recruits = (f.recruits ?? 0) + 3; iq("jokinen", 5);
        await say("Yksi toi kaksi! Pyramidi toimi ensimmäisen kerran juuri niin kuin sen piirsin!");
        await say("Lenkki jatkuu!", "jokinen"); f.jokStop = false; return; }
      else { await say("Lenkki odottaa!", "jokinen"); return; }
    }
  });
}
function guideBasaari(t) {
  const f = st.flags;
  if (!f.merhaba) bark(258, 46, "Merhaba, ystäväni! Täällä!", t, 1, 6000);
  else if (has("idoli")) bark(258, 46, "Aarre?! Tuo se tänne!", t, 2, 6000);
  else if (f.mehmetWho && !f.signed) bark(258, 46, "Se kaavio, ystäväni! Näytä!", t, 3, 8000);
  else if (f.needWeight && !has("pussi") && !has("sakki") && !f.swapped) bark(258, 46, "Pussi? Pusseista tingitään, ystäväni!", t, 4, 9000);
  if (f.quest && !f.map) sparkle(33, 70, t, 5, 1800);
  if (f.needWeight && !has("pussi") && !has("sakki") && !f.swapped) sparkle(285, 70, t, 6, 2200);
  if (f.quest && f.map && (!f.needWeight || has("pussi") || has("sakki")) && !has("idoli")) sparkle(160, 52, t, 8, 1600);
}
