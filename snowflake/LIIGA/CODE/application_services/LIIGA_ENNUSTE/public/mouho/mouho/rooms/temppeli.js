// Mouhon salaisuus -- Luolatemppeli, Kappadokia: grafiikka, ruutu ja kohtaukset.
"use strict";
// =============================================================== TEMPPELI
// Kammio: kuilu leikkaa lattian poikittain; idoli takana oviaukon edessä.
const CHASM = { y0: 82, y1: 96 };
const floorX = (y) => { const k = (y - 62) / (H - 62); return [lerp(60, -10, k), lerp(260, 330, k)]; };
function temppeliBg() {
  noise(0, 0, W, H, "#221816", ["#2c201c", "#1a1214", "#261c18"], .35);
  const SH = "#2c2438", TL = ["#3a2c24", "#5a4632", "#6e5638", "#86683f"];
  // sivuseinät: kylmä kallio, soihtujen lämmin valo ditheröityinä renkaina
  fillPoly([[0, 0], [60, 8], [60, 62], [0, 104]], "#241a1c"); fillPoly([[320, 0], [260, 8], [260, 62], [320, 104]], "#201820");
  seed = 4; for (let k = 0; k < 90; k++) { const x = rnd() * W, y = 10 + rnd() * 90; if (x > 58 && x < 262) continue; const w = 3 + ((rnd() * 4) | 0); r(x, y, w, 2, "#2e2422"); r(x, y, w, 1, "#3a2c24"); r(x, y + 2, w, 1, SH); }
  for (const [tx, ty] of [[37, 46], [283, 46]]) for (let y = ty - 34; y < ty + 50; y++) for (let x = tx - 34; x < tx + 34; x++) {
    if (x > 59 && x < 261 && y < 63) continue; if (y > 62 && (x > floorX(y)[0] && x < floorX(y)[1])) continue; if (x < 0 || x >= W || y < 8) continue;
    const d = Math.hypot(x - tx, (y - ty) * .8), b = bay(x, y);
    if (d < 11) px(x, y, b < .6 ? "#6e5638" : "#5a4632"); else if (d < 21) { if (b < .55) px(x, y, "#4a3a2c"); } else if (d < 30 && b < .12) px(x, y, "#3a2c24"); }
  // takaseinä: muuratut lohkot, valo kuilusta keskellä
  r(60, 8, 200, 54, SH);
  seed = 11; for (let y = 9, row = 0; y < 62; row++) { const h = 6 + (row % 3 === 1 ? 1 : 0); let x = 60 - ((rnd() * 10) | 0);
    while (x < 260) { const w = 10 + ((rnd() * 13) | 0), x0 = Math.max(60, x), x1 = Math.min(260, x + w - 1), cx = (x0 + x1) / 2, dc = Math.abs(cx - 160);
      const lv = dc < 30 ? 3 : dc < 70 ? 2 : 1, alt = rnd() < .25 ? 1 : 0, hh = Math.min(h - 1, 62 - y);
      for (let j = 0; j < hh; j++) for (let i = x0; i < x1; i++) { const edge = (i < 80 || i > 240) && bay(i, y + j) < .5; px(i, y + j, TL[Math.max(0, Math.min(3, lv + alt - (edge ? 1 : 0)))]); }
      r(x0, y, x1 - x0, 1, TL[Math.min(3, lv + 1)]);                                           // ylävalo
      if (cx < 160) r(x1 - 1, y, 1, hh, TL[Math.min(3, lv + 1)]); else r(x0, y, 1, hh, TL[Math.min(3, lv + 1)]);   // reunavalo kohti kuilua
      r(x0, y + hh - 1, x1 - x0, 1, "#3a2c24");
      if (rnd() < .18) { r(x0 + 1, y + hh - 3, 2, 2, "#3a2c24"); px(x0 + 1, y + hh - 3, SH); }   // lohkeama
      x += w; }
    y += h; }
  for (const [cx, cy, n, dir] of [[96, 12, 8, 1], [214, 30, 10, -1], [246, 16, 6, 1], [128, 40, 7, -1]]) for (let i = 0; i < n; i++) px(cx + Math.floor(i / 2) * dir, cy + i, SH);
  // katto ja tippukivet klustereina
  r(0, 0, W, 9, "#140e14"); r(0, 9, W, 1, SH);
  for (const [x, len, w] of [[14, 6, 3], [22, 3, 2], [47, 9, 4], [53, 4, 2], [88, 5, 3], [118, 11, 4], [124, 5, 2], [196, 7, 3], [201, 3, 2], [229, 12, 4], [236, 5, 2], [268, 6, 3], [296, 9, 3], [302, 4, 2]])
    for (let j = 0; j < len; j++) { const ww = Math.max(1, Math.round(w * (1 - j / len))); r(x + (w - ww) / 2, 9 + j, ww, 1, j > len - 3 ? "#2c2438" : "#140e14"); if (ww > 1) px(x + (w - ww) / 2, 9 + j, "#3a2c24"); }
  r(152, 0, 16, 9, "#a8884c"); r(155, 0, 10, 9, "#d8b868");
  // kaiverrettu oviaukko takaseinässä
  r(144, 26, 32, 36, "#0e0a14"); disc(160, 26, 16, "#0e0a14"); r(140, 26, 4, 36, "#6e5638"); r(140, 26, 1, 36, "#86683f"); r(176, 26, 4, 36, "#5a4632"); r(179, 26, 1, 36, SH);
  for (let a = 0; a < Math.PI; a += .06) { px(160 + Math.cos(a) * 18, 26 - Math.sin(a) * 18, "#6e5638"); px(160 + Math.cos(a) * 19, 26 - Math.sin(a) * 19, "#86683f"); px(160 + Math.cos(a) * 17, 26 - Math.sin(a) * 17, SH); }
  // reliefi: muinainen otteluohjelma
  r(76, 20, 50, 30, "#3a2c24"); r(76, 20, 50, 1, SH); r(76, 49, 50, 1, "#86683f"); r(125, 20, 1, 30, "#6e5638");
  for (let row = 0; row < 4; row++) for (let c = 0; c < 6; c++) { r(80 + c * 7, 24 + row * 6, 4, 3, (row + c) % 3 ? SH : "#6e5638"); r(80 + c * 7, 26 + row * 6, 4, 1, (row + c) % 3 ? "#4a3a2c" : "#86683f"); }
  r(108, 30, 14, 1, "#86683f"); r(108, 36, 10, 1, "#86683f"); r(108, 31, 14, 1, SH); r(108, 37, 10, 1, SH);
  // seitit
  for (let k = 0; k < 7; k++) for (let j = 0; j < 14; j++) px(2 + j * Math.cos(k / 4.5), 10 + j * Math.sin(k / 4.5) * 1.2, "#4e4650");
  // valokeila kuilusta: kolmiportainen lämmin ramppi, levenee lattiaa kohti
  for (let y = 9; y < 63; y++) { const hw = 8 + (y - 9) * .2; for (let x = Math.floor(160 - hw); x <= Math.ceil(160 + hw); x++) { const v = 1 - Math.abs(x - 159.5) / hw, b = bay(x, y);
    if (v > .72) px(x, y, b < (v - .72) * 4 ? "#d8b868" : "#a8884c"); else if (v > .4) { if (b < .75) px(x, y, b < (v - .4) * 2.5 ? "#a8884c" : "#6e5a3a"); } else if (v > 0 && b < v * 1.2) px(x, y, "#6e5a3a"); } }
  // lattia: laatat, valo kuilusta ja soihduista, reunat kylmiä
  const rows = [62, 66, 71, 77, CHASM.y0, CHASM.y1 + 2, 104, 113, 124, H], FT = ["#2a2030", "#3a2c24", "#4a3a2c", "#5a4632", "#6e5638"];
  for (let y = 62; y < H; y++) { if (y >= CHASM.y0 - 1 && y <= CHASM.y1 + 1) continue; const [a, b] = floorX(y), ri = rows.findIndex((v, i) => y >= v && y < rows[i + 1]);
    for (let x = Math.max(0, Math.floor(a)); x < Math.min(W, Math.ceil(b)); x++) { const ci = Math.floor((x - a) / (b - a) * 10), hsh = ((ri * 7 + ci * 13) % 5) / 5 - .4;
      const L = Math.max(1.1 - Math.hypot((x - 160) / 70, (y - 70) / 26), 1 - Math.hypot((x - 37) / 60, (y - 70) / 30), 1 - Math.hypot((x - 283) / 60, (y - 70) / 30), .05) * 3.6 + hsh, k = Math.floor(L), f = L - k;
      px(x, y, FT[Math.max(0, Math.min(4, k + (bay(x, y) < f ? 1 : 0)))]); } }
  for (const yy of rows.slice(1, -1)) { if (yy === CHASM.y0 || yy === CHASM.y1 + 2) continue; const [a, b] = floorX(yy); r(a, yy, b - a, 1, "#241c24"); const [a2, b2] = floorX(yy + 1); r(a2, yy + 1, b2 - a2, 1, "#4a3a2c"); }
  for (let i = 1; i < 10; i++) { const xf = lerp(60, 260, i / 10), xn = lerp(-10, 330, i / 10); for (let y = 62; y < H; y++) { if (y >= CHASM.y0 - 1 && y <= CHASM.y1 + 1) continue; px(Math.round(lerp(xf, xn, (y - 62) / (H - 62))), y, "#241c24"); } }
  r(60, 62, 200, 1, "#86683f");
  // kirkas valolammikko jalustan alla
  for (let y = 63; y < CHASM.y0 - 1; y++) for (let x = 128; x < 193; x++) { const d = Math.hypot((x - 160) / 30, (y - 70) / 8), b = bay(x, y);
    if (d < .45) px(x, y, b < .5 ? "#d8b868" : "#a8884c"); else if (d < .75) { if (b < .7) px(x, y, "#a8884c"); } else if (d < 1 && b < .3) px(x, y, "#86683f"); }
  // halkeamat 1:2 ja soraklusterit
  for (const [cx, cy, n, dir] of [[98, 64, 10, -1], [214, 66, 12, 1], [70, 106, 12, -1], [244, 104, 14, 1], [184, 114, 10, -1], [128, 118, 12, 1]]) for (let i = 0; i < n; i++) { px(cx + Math.floor(i / 2) * dir, cy + i, "#1c1620"); if (i === 5) { px(cx + 3 * dir + dir, cy + i + 1, "#1c1620"); px(cx + 3 * dir + 2 * dir, cy + i + 1, "#1c1620"); } }
  for (const [sx, sy] of [[86, 74], [226, 73], [104, 120], [292, 126], [200, 128], [150, 108]]) { r(sx, sy, 3, 1, "#6e5638"); px(sx + 1, sy - 1, "#86683f"); px(sx + 3, sy, "#2c2438"); px(sx + 5, sy + 1, "#5a4632"); px(sx - 2, sy + 1, "#a8884c"); r(sx - 1, sy + 1, 4, 1, "#2c2438"); }
  // kuilu poikittain: valaistu yläreuna, kylmä sinimusta sisus
  for (let y = CHASM.y0; y < CHASM.y1; y++) { const [a, b] = floorX(y), k = (y - CHASM.y0) / (CHASM.y1 - CHASM.y0);
    for (let x = Math.max(0, Math.floor(a)); x < Math.min(W, Math.ceil(b)); x++) px(x, y, k < .2 ? (bay(x, y) < k * 4 ? SH : "#3a2c24") : k < .5 ? (bay(x, y) < (k - .2) * 3 ? "#0c0a14" : "#1a1626") : "#06060c"); }
  { const [a, b] = floorX(CHASM.y0 - 1); r(a, CHASM.y0 - 1, b - a, 1, "#a8884c"); r(128, CHASM.y0 - 1, 64, 1, "#d8b868"); }
  { const [a, b] = floorX(CHASM.y1); r(a, CHASM.y1, b - a, 1, "#6e5638"); r(a, CHASM.y1 + 1, b - a, 1, SH); }
  r(122, 98, 6, 4, "#c8bca0"); r(122, 98, 6, 1, "#e0d4b8"); px(123, 99, "#2c2438"); px(126, 99, "#2c2438"); r(129, 100, 5, 1, "#a89c84");
  // ketju ja koukku kuilun yllä (piiska ripustetaan tähän, x 160)
  for (let y = 9; y < 22; y++) px(160, y, y % 3 === 0 ? "#3a3440" : y % 3 === 1 ? "#a89c84" : "#6e6458");
  r(160, 22, 1, 4, "#a89c84"); px(159, 26, "#6e6458"); px(158, 25, "#6e6458"); px(158, 24, "#c8bca0"); px(161, 23, "#3a3440"); px(161, 24, "#3a3440");
  // ovi vasemmalla
  fillPoly([[2, 76], [18, 82], [18, 124], [2, 128]], "#0a0810"); r(18, 82, 1, 42, "#5a4632"); r(19, 82, 1, 42, SH);
}
const DUST2 = Array.from({ length: 16 }, (_, i) => ({ x: 152 + (i * 7) % 16, y: (i * 13) % 70, s: 3 + (i % 4) }));
let darkC2 = null;
function temppeliDraw(t) {
  g.drawImage(paintBg("temppeli2", temppeliBg), 0, 0);
  // luolassa ei ole taivasta: kaksi kerrosta pölyä ja usvaa ajelehtii eri nopeuksilla (23.10.)
  drift("temple_dust", 3, (w) => { seed = 88; for (let i = 0; i < 70; i++) px(rnd() * w, 10 + rnd() * 90, rnd() < .5 ? "#8c7458" : "#6c5a44"); }, t);
  g.save(); g.globalAlpha = .18; drift("temple_mist", 7, (w) => { for (let x = 0; x < w; x += 40) { g.fillStyle = "#c8b49c"; g.beginPath(); g.ellipse(x + 20, 98 + Math.sin(x) * 3, 34, 4, 0, 0, 7); g.fill(); } }, t); g.restore();
  if (st.flags.whipHung) r(160, 25, 1, 46, "#6c4420");
  if (st.flags.crossed) { fillPoly([[196, CHASM.y0], [209, CHASM.y0], [210, CHASM.y1], [195, CHASM.y1]], "#4a3420"); r(196, CHASM.y0, 13, 1, "#6c4c30"); }
}
function temppeliSand() { const n = st.flags.sandUsed ? 7 : 12, top = 129 - n;          // pussin täytön jälkeen kasa madaltuu
  for (let j = 0; j < n; j++) { const w = Math.round(32 * Math.pow((j + 1 + 12 - n) / 12, .55)), y = top + j; for (let i = 0; i < w; i++) { const x = 54 - w / 2 + i; px(x, y, bay(x, y) < j / 12 ? "#b08c48" : bay(x, y) < .7 ? "#d8b46c" : "#c8a45c"); } } px(53, top, "#f0d090"); }
function temppeliPillar() { shadow(252, 131, 16); r(236, 121, 32, 10, "#6c5a46"); r(236, 121, 32, 2, "#86704e"); r(236, 129, 32, 2, "#4c3c2c"); r(266, 121, 3, 10, "#5a4a38");
  r(245, 122, 1, 7, "#3c2c1c"); r(254, 123, 1, 6, "#3c2c1c"); disc(236, 126, 5, "#5a4a38");
  r(237, 123, 1, 6, "#9a8258"); r(238, 123, 1, 6, "#86704e"); r(260, 123, 5, 6, "#5a4a38"); r(262, 123, 3, 6, "#4c3c2c"); r(236, 120, 32, 1, "#2c2024"); r(236, 131, 32, 1, "#1c1418"); r(268, 121, 1, 10, "#2c2024"); }
function temppeliPedestal() { const T = "#b8a078", F = "#8a6e50", S = "#4a3a40";
  r(154, 65, 12, 9, F); r(154, 65, 1, 9, "#a08460"); r(163, 65, 3, 9, S); r(154, 65, 12, 1, S);
  r(154, 68, 12, 1, S); r(154, 69, 9, 1, T); r(163, 69, 3, 1, "#6a5048");
  r(152, 74, 16, 2, F); r(152, 74, 12, 1, T); r(164, 74, 4, 2, S); r(152, 75, 16, 1, "#5a4632");
  r(152, 62, 16, 3, F); r(152, 62, 16, 1, "#d8c094"); r(152, 63, 13, 1, T); r(165, 63, 3, 2, S); px(152, 64, "#6a5048");
  if (!st.flags.idol) { const sp = Math.sin(performance.now() / 260);
    r(157, 54, 6, 8, "#d8a828"); r(158, 52, 4, 2, "#d8a828"); r(161, 52, 1, 2, "#8a6018"); r(161, 54, 1, 8, "#8a6018"); r(162, 54, 1, 8, "#4a3010");
    r(157, 54, 1, 8, "#f8d860"); r(158, 52, 1, 2, "#f8d860"); r(158, 52, 3, 1, "#fff0a0"); px(157, 54, "#fff0a0"); r(158, 59, 3, 1, "#8a6018");
    px(158, 56, "#4a3010"); px(160, 56, "#4a3010"); if (sp > .6) { px(160, 50, "#fff"); px(159, 51, "#fcfc9c"); px(161, 51, "#fcfc9c"); } }
  else if (st.flags.swapped) { r(156, 57, 8, 5, "#c8b48c"); r(156, 57, 8, 1, "#e0d0a8"); } }
// Kivenjärkäle vyöryy oviaukosta katsojaa kohti: y ja koko kasvavat.
const boulderY = () => 52 + st.flags.boulder * 92;
function temppeliBoulder() { if (st.flags.boulder == null) return; const k = st.flags.boulder, y = boulderY(), rad = 7 + k * 34, rot = k * 9;
  shadow(160, Math.min(y + rad * .2, 135), rad * .9); disc(160, y - rad * .8, Math.round(rad), "#6c5c4c", "#3c3024"); disc(160 - rad * .3, y - rad * 1.1, Math.round(rad * .3), "#84725e");
  r(160 + Math.cos(rot) * rad * .5, y - rad * .8 + Math.sin(rot) * rad * .5, rad * .25, rad * .18, "#3c3024"); r(160 - Math.cos(rot) * rad * .55, y - rad * .8 - Math.sin(rot) * rad * .4, rad * .2, rad * .2, "#3c3024"); }
function temppeliPost(t) {
  darkC2 ??= Object.assign(document.createElement("canvas"), { width: W, height: H });
  const L = darkC2.getContext("2d"); L.globalCompositeOperation = "source-over"; L.clearRect(0, 0, W, H); L.fillStyle = "rgba(6,3,0,.62)"; L.fillRect(0, 0, W, H);
  L.globalCompositeOperation = "destination-out";
  const hole = (x, y, rad, a) => { const gr = L.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(1, "rgba(0,0,0,0)"); L.fillStyle = gr; L.fillRect(x - rad, y - rad, rad * 2, rad * 2); };
  const f = Math.sin(t / 90) * 4 + Math.sin(t / 53) * 2;
  hole(37, 46, 70 + f, .95); hole(283, 46, 70 - f, .95); hole(st.x, st.y - 22, 44, 1); hole(160, 70, 36, .85);   // Jussi kokonaan valossa (17.10.); valolammikko
  L.beginPath(); L.moveTo(150, 0); L.lineTo(170, 0); L.lineTo(182, 66); L.lineTo(138, 66); L.closePath(); L.fillStyle = "rgba(0,0,0,.8)"; L.fill();
  g.drawImage(darkC2, 0, 0);
  const DA = [[157, 16], [165, 34], [155, 50]];                                          // pöly kolmena harvana parvena
  DUST2.forEach((d, i) => { d.y = (d.y + d.s * 0.012) % 64; const [ax, ay] = DA[i % 3]; px(ax + ((i * 5) % 7) - 3 + Math.sin(t / 700 + i) * 1.5, ay + ((d.y * .2 + i * 3) % 9) - 4, i % 2 ? "#f8e4b0" : "#d8b868"); });
  for (const [tx, ty] of [[36, 48], [282, 48]]) {                                        // soihdut: täyttövalo
    g.globalCompositeOperation = "lighter";
    for (let y = ty - 34; y < ty + 34; y++) for (let x = tx - 34; x < tx + 37; x++) { const d = Math.hypot(x - tx - 1, y - ty + 6), b = bay(x, y);
      if (d < 11) { if (b < .75) px(x, y, "rgba(255,160,60,.16)"); } else if (d < 21) { if (b < .4) px(x, y, "rgba(255,130,40,.10)"); } else if (d < 30 + f * .5 && b < .12) px(x, y, "rgba(220,90,30,.07)"); }
    g.globalCompositeOperation = "source-over";
    r(tx - 2, ty + 3, 7, 2, "#2c2438"); px(tx - 2, ty + 3, "#86683f"); r(tx + 1, ty + 5, 1, 3, "#2c2438");
    r(tx, ty, 3, 10, "#4a3428"); r(tx, ty, 1, 10, "#86683f"); r(tx + 2, ty, 1, 10, "#2c2438");
    r(tx - 1, ty - 1, 5, 2, "#3a2c24"); px(tx - 1, ty - 1, "#a8884c");
    const fl = (Math.sin(t / 70 + tx) + Math.sin(t / 113 + tx * 2)) / 2, h = 10 + Math.round(fl * 2), lean = Math.round(fl);
    for (let j = 0; j < h; j++) { const w = Math.max(1, 6 - Math.floor(j / 2)), cx = tx + 1.5 + (j > h / 2 ? lean : 0), y = ty - 2 - j;
      r(cx - w / 2, y, w, 1, j > h * .65 ? "#b03a20" : "#ff9a30"); if (j < h * .5 && w > 2) r(cx - w / 2 + 1, y, w - 2, 1, j < 3 ? "#fff0a0" : bay(tx, y) < .5 ? "#fff0a0" : "#ffc860"); if (w > 2 && j > 1) { px(cx - w / 2, y, "#b03a20"); } }
    for (let c = 0; c < 3; c++) { const ph = (t / 700 + c * .37 + tx) % 1, ey = ty - h - 2 - ph * 12, ex = tx + 1 + (c - 1) * 2 + Math.sin(t / 300 + c) * 1.5;
      if (ph < .8) { px(ex, ey, "#ff9a30"); px(ex + 1, ey - 1, ph < .4 ? "#fff0a0" : "#b03a20"); } }
  }
}
// Temppeli (17.10.): yksi pulma. Idoli on paineansalla; tilalle tarvitaan yhtä painava
// hiekkasäkki. Hiekka on luolassa, pussi tingitään basaarista. Kuilun yli kulkee kivipolku.
defineRoom("temppeli", {
  title: "Unohdettu luolatemppeli, Kappadokia", scale: [62, 136, 0.34, 1.06], start: 128,
  // Tuomari vartioi kivipolkua (17.10.: "luolassa voi käydä juttelematta tuomarin kanssa"):
  // takaosaan pääsee vasta, kun hänet on värvätty turnauksen tuomariksi.
  walk: () => st.flags.refRecruited ? [[[24, 100], [296, 100], [320, 112], [320, 136], [2, 136]], [[94, 64], [226, 64], [256, 80], [64, 80]], [[197, 78], [208, 78], [209, 102], [196, 102]]]
                                    : [[[24, 100], [296, 100], [320, 112], [320, 136], [2, 136]]],      // oikealla temppelin suu (24.10.)
  enter: () => { st.flags.crossed = true; },
  arrive: () => firstTempleVisit(),
  edges: { oikea: () => toCliff() },
  draw: temppeliDraw,
  post: (t) => { temppeliPost(t); guideTemppeli(t); },
  actors: [{ id: "tuomari", get x() { return st.flags.refRecruited ? 100 : 203; }, y: 106, h: 44, color: "#a8d8fc", hidden: () => !st.flags.refHere, draw: (t, talking) => ghostRef(st.flags.refRecruited ? 100 : 203, 106, t, talking) }],
  props: [{ y: 76, draw: temppeliPedestal }, { y: 129, draw: temppeliSand }, { y: 131, draw: temppeliPillar }, { get y() { return st.flags.boulder == null ? -1 : boulderY(); }, draw: temppeliBoulder }],
  spots: [
    { id: "tuomari", name: "erotuomarin haamu", actor: true, hidden: () => !st.flags.refHere, get x() { return st.flags.refRecruited ? 92 : 195; }, y: 64, w: 16, h: 42, get at() { return st.flags.refRecruited ? 112 : 184; }, aty: 110,
      Katso: () => say(st.flags.refRecruited ? "Turnauksemme tuomari. Hän harjoittelee vihellystä reliefille." : "Muinaisen erotuomarin haamu. Hän seisoo kivipolun päässä kuin maalivahti, joka ei päästä mitään läpi."), Puhu: () => refereeTalk() },
    { id: "pylvas", name: "kaatunut pylväs", x: 234, y: 118, w: 36, h: 14, at: 228, aty: 133,
      Katso: () => say("Kaatunut pylväs. Siinä on enemmän ryhtiä kuin minulla maanantaisin."), Työnnä: () => say("Se ei liiku. Eikä sen kuulukaan. Se on jo kaatunut kerran.") },
    { id: "hiekka", name: "hiekka", x: 36, y: 114, w: 36, h: 16, at: 76, aty: 127,
      Katso: () => say("Hienoa hiekkaa. Täydellistä säkkeihin. Ei kysytä, miksi luolassa on hiekkaa."),
      Poimi: () => (has("pussi") ? spot("temppeli", "hiekka")["Käytä:pussi"]() : say(st.flags.needWeight ? "Kourallinen ei riitä idolin painoksi. Tarvitsen pussin. Mehmetillä on pusseja." : "Kourallinen hiekkaa. Mihin minä tätä tarvitsisin?")),
      "Käytä:pussi": async () => { take("pussi"); give("sakki"); st.flags.sandUsed = true; iq("hiekkasakki", 5); await say("Täytän pussin. Hiekkasäkki valmis! Painaa varmaan saman verran kuin idoli."); } },
    { id: "reliefi", name: "kivireliefi", x: 76, y: 20, w: 50, h: 30, at: 130, aty: 104,
      Katso: () => (iq("reliefi", 5), say("Muinainen otteluohjelma, hakattu kiveen tuhansiksi vuosiksi.\nJoku on silti siirtänyt kolmea ottelua lyhyellä varoitusajalla.")),
      Työnnä: () => say("Se ei liiku. Kiveen hakattu ohjelma ei siirry. Tai ei ainakaan pitäisi.") },
    { id: "kuilu", name: "kuilu", x: 26, y: 81, w: 268, h: 17, at: 160, aty: 102,
      Katso: () => say("Syvä kuilu kammion poikki. Oikealla kulkee kapea kivipolku idolin luo. Muinaiset ajattelivat kaikkea."),
      Kävele: () => say("En hyppää. Kivipolku oikealla riittää.") },
    { id: "idoli", name: "kultainen idoli", x: 152, y: 49, w: 16, h: 16, at: 160, aty: 79, hidden: () => st.flags.idol && !st.flags.swapped,
      Katso: () => say(st.flags.swapped ? "Hiekkasäkki jalustalla. Se ei huijaa ketään pitkään." : "Kultainen idoli korkealla jalustalla. Isoisän pyramidin huippu."),
      Poimi: () => st.flags.idol ? say("Se on jo minulla.") : !st.flags.refRecruited ? blocked() : discoverTrap(),
      "Käytä:sakki": () => (!st.flags.refRecruited ? blocked() : grabIdol()) },
    { id: "suu", name: "temppelin suu", x: 300, y: 70, w: 20, h: 60, at: 312, aty: 122, exit: true,
      Katso: () => say("Temppelin suu. Ulkona laakso, kuumailmapallot ja polku takaisin Istanbuliin."), Käytä: () => toCliff(), Kävele: () => toCliff() },
  ],
});
async function toTemple() {
  await script(async () => {
    if (!st.flags.quest) return say("Miksi menisin itään? Sijoittajilla on ensin asiaa. Puhutaan Mehmetin kanssa.");
    if (!st.flags.map) return say("Pyramidin huippu on jossain idässä. Mutta missä? Jossain täällä on varmasti kartta.");
    await walkTo(160, 72); await travel("ist", "kap"); go("kallio", 250, true, 122);
    if (!st.flags.refMet) await say("Kappadokia. Kalliotorneja, kuumailmapalloja... ja tuolla kallioon hakattu ovi. Maton rasti osui tähän.");

  });
}
// Temppelin edusta on oma ruutu oikealla (backlog 8): ensimmäinen sisääntulo esittelee idolin ja tuomarin.
const toCliff = () => crossTo("kallio", 70, 122);
async function firstTempleVisit() {
  if (st.flags.refMet) return;
  await say("Sisällä! Ja tuolla, korkealla jalustalla: kultainen idoli.");
  await say("Isoisän pyramidin huippu. Ja tuleva kiertopalkinto.");
  await refereeAppears(); await myrraIncoming(2);
  await say("Turnaus tarvitsee tuomarin. Ja tuo tuomari näyttää tarvitsevan joukkueen. Jutellaan hänen kanssaan.");
}
function backToBazaar() { return script(async () => { await travel("kap", "ist"); go("basaari", 160, true, 74); }); }
function blocked() { return say("Tuomari seisoo kivipolulla. Hän ei päästä ketään ohi. Pitäisi jutella hänen kanssaan."); }
// Paineansa: ensimmäinen yritys paljastaa pulman, ja ratkaisun osat ovat jo nähtävillä.
async function discoverTrap() {
  await walkTo(160, 79);
  await say("Hetkinen. Jalusta liikahtaa, kun nojaan siihen. Paineansa! Jos idolin nostaa, jalusta nousee... ja jotain ikävää tapahtuu.");
  if (!st.flags.needWeight) { st.flags.needWeight = true; iq("ansa", 5); }
  await say(has("pussi") ? "Tarvitsen jotain yhtä painavaa vaihtoon. Pussi ja hiekka!" : "Tarvitsen jotain yhtä painavaa vaihtoon. Hiekkaa täällä on. Mutta millä sitä kantaa? Mehmetin kojussa roikkui nahkapusseja.");
}
async function grabIdol() {
  await script(async () => {
    take("sakki"); iq("idoli", 10); await say("Rauhallisesti... vaihdetaan sulavasti...");
    st.flags.idol = true; st.flags.swapped = true; give("idoli"); await sleep(600);
    await say("...", "muu"); await say("Jalusta painuu. Tietysti se painuu.");
    // Kivenjärkäle vyöryy oviaukosta katsojaa kohti (0 = oviaukko, 1 = ruudun reuna).
    st.flags.boulder = 0; await say("JUOKSE!");
    walkTo(22, 118);
    while (st.x > 28) { await sleep(30); st.flags.boulder = Math.min(1, st.flags.boulder + 0.0075); }
    st.flags.boulder = null;
    await travel("kap", "ist"); go("basaari", 160, true, 74); await say("Hengissä. Ja minulla on pyramidin huippu. Sijoittajat odottavat.");
  });
}
function guideTemppeli(t) {
  const f = st.flags;
  if (f.refHere && f.myrra2 && !f.refRecruited) bark(203, 58, f.refWho ? "Joukkue, sanoit...?" : "Hmph. Kukaan ei kysy, kuka minä olen.", t, 1, 8000);
  if (f.refHere && !f.refRecruited) sparkle(203, 70, t, 6, 2000);
  if (f.refRecruited && !f.needWeight && !f.idol) sparkle(160, 54, t, 2, 2400);
  if (has("pussi")) sparkle(54, 120, t, 3, 1800);
  if (has("sakki")) sparkle(160, 54, t, 4, 1600);
  if (has("idoli")) sparkle(11, 96, t, 5, 1400);
}
// Temppelin erotuomari: ilmestyy ensikäynnillä; Jussi värvää hänet turnauksen tuomariksi.
async function refereeAppears() {
  st.flags.refMet = true; st.flags.refHere = true; beep(2200, 200, "square", .05); await sleep(300);
  await say("Pilli soi kammiossa. Reliefin eteen materialisoituu läpikuultava erotuomari.", "muu");
  await say("Seis! Kukaan ei kulje tätä kivipolkua. Olen vartioinut sitä kaksituhatta vuotta.", "tuomari");
  await say("Kaksituhatta vuotta? Miksi?");
  await say("Koska kukaan ei ole tullut pelaamaan. Vartiointi on ainoa peli, joka minulle jäi.", "tuomari");
}
// Jussi värvää tuomarin (Myrrä: "tärkeintä on joukkue").
function refereeTalk() {
  return script(async () => {
    while (true) { const f = st.flags, opts = [];      // sokkotesti 4: keskustelu jatkuu kysymyksen jälkeen
    if (!f.refWho) opts.push("Kuka sinä olet? Ja miksi luolassa?");
    if (f.refWho && f.myrra2 && !f.refRecruited) opts.push("Liity Mouhoon! Joukkue tarvitsee tuomarin.");
    opts.push("Ei mitään.");
    const pick = opts[await choose(opts)]; await say(pick);
    if (pick.startsWith("Kuka")) { f.refWho = true;
      await say("Olin muinaisten pelien erotuomari. Kaksituhatta vuotta sitten vihelsin viimeisen pelin, ja kaikki lähtivät kotiin.", "tuomari");
      await say("Minä jäin. Kukaan ei kutsunut minua enää mihinkään joukkueeseen.", "tuomari"); }
    else if (pick.startsWith("Liity")) return recruitReferee();
    else return; }
  });
}
async function recruitReferee() {
  if (st.flags.refRecruited) return;
  await say("Kaksituhatta vuotta olen vihellellyt tässä luolassa yksin. Ja nyt joku tarjoaa joukkuetta.", "tuomari");
  await say("Kyllä. Tulen viheltämään turnauksenne. Näen kaiken, paitsi paitsiot.", "tuomari");
  st.flags.refRecruited = true; st.flags.recruits = (st.flags.recruits ?? 0) + 1; iq("tuomarivarvays", 5);
  beep(2200, 160, "square", .05);
  await say("Tuomari viheltää ja liukuu sivuun. Kivipolku idolin luo on vapaa.", "muu");
  await say("Turnauksella on tuomari! Ja jäsenhankinta ulottuu nyt tuonpuoleiseen.");
}
