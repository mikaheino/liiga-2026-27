// Mouhon salaisuus -- Aloitusruutu: Indiana Jones -logo, Kappadokia, Mouhon kilpi, Jussi fedorassa.
"use strict";
// ---- alkuruutu, matka ja loppu --------------------------------------------------
// Alkuruutu (23.10., start_screen/: LucasArtsin Indiana Jones -pelien kansikuvat): auringonlaskun
// Kappadokia ilmapalloineen, kaareva oranssi-keltainen logo "JUSSI MARKKANEN", alle "ja MOUHON
// SALAISUUS", Mouhon kilpi hehkuu jalustalla kuin idoli ja Jussi fedorassa oikeassa reunassa.
const CHIMNEYS = [[16, 10, 36, "#a8603c"], [44, 7, 24, "#b46c44"], [72, 6, 16, "#b87048"], [166, 5, 15, "#b87048"], [190, 8, 30, "#a05a3c"], [216, 11, 42, "#b06844"]];
const BALLOONS = [[30, 82, 4, "#d8302c", "#fcd41c"], [176, 50, 5, "#f0a830", "#1c1c1c"], [152, 80, 3, "#3c6cc8", "#fcfcfc"]];
// Taivas, kaksi ajelehtivaa pilvikerrosta (ylempi hitaampi) ja läpinäkyvä etuala (23.10.).
const TITLE_CLOUDS = [
  { c: "#f8c8b0", v: 3, list: [[190, 7, 130], [60, 5, 110]] },
  { c: "#8c5c98", v: 3, list: [[190, 4, 130], [60, 2, 110]] },
  { c: "#f8c8b0", v: 6, list: [[186, 44, 60], [0, 54, 36], [110, 63, 74], [250, 49, 28]] },
  { c: "#d89098", v: 6, list: [[186, 42, 60], [0, 52, 36], [110, 61, 74], [250, 47, 28]] },
  { c: "#c88490", v: 6, list: [[186, 40, 60], [0, 50, 36], [110, 59, 74], [250, 45, 28]] },
  { c: "#e89080", v: 9, list: [[20, 62, 22], [140, 64, 46], [232, 61, 30]] }];
function titleBg() { titleSky(); TITLE_CLOUDS.forEach((L) => puffBand(L.list, L.c, "#d8a4b4")); titleFg(); }
function titleSky() {
  vgrad(0, 0, W, 96, ["#1c2458", "#2c3470", "#4c3c84", "#7c4c8c", "#b45c84", "#e07c74", "#f8a46c", "#fcc87c"]);
  // hehkurenkaat auringon ympärillä ulkoa sisään, reunat ditheröity
  const rings = [[40, "#a8609c"], [31, "#e07888"], [23, "#f8a868"], [15, "#fcd88c"]];
  for (let y = 42; y < 96; y++) for (let x = 108; x < 193; x++) {
    const d = Math.hypot(x - 150, y - 84) + (bay(x, y) - .5) * 3;
    let c = null; for (const [rad, col] of rings) if (d < rad) c = col;
    if (c) px(x, y, c); }
  disc(150, 80, 12, "#fce4a0"); disc(150, 80, 9, "#fcf0c4");                                    // aurinko laskee
  for (const [x, y] of [[6, 3], [19, 9], [33, 2], [47, 14], [12, 17], [58, 6], [71, 11], [27, 19], [84, 3]]) px(x, y, "#e8d0f0");
  px(19, 8, "#a890c0"); px(19, 10, "#a890c0"); px(18, 9, "#a890c0"); px(20, 9, "#a890c0");     // kirkkain tähti tuikkii
}
// Dyynin harjanne: aurinkoon päin valaistu reuna, alla viileä violetti varjo, reunat ditheröity.
function titleDune(y0, amp, per, ph, x0 = 0, x1 = W) {
  for (let x = x0; x < x1; x++) {
    const y = Math.round(y0 + Math.sin(x / per + ph) * amp), lit = Math.cos(x / per + ph) * (150 - x) > 0, rim = lit ? "#e8a878" : "#c8784c";
    if (bay(x, y - 1) < .5) px(x, y - 1, rim);
    px(x, y, rim); px(x, y + 1, lit ? "#c8784c" : "#a4643c");
    px(x, y + 2, "#6a4468"); px(x, y + 3, bay(x, y + 3) < .5 ? "#4a3458" : "#6a4468");
    if (bay(x, y + 4) < .5) px(x, y + 4, "#4a3458"); }
}
function titleRocks(x, y, w) {
  fillPoly([[x, y + 4], [x + 1, y + 1], [x + w * .4, y], [x + w * .8, y + 1], [x + w, y + 4]], "#3c2430");
  r(x + 2, y + 1, Math.max(1, Math.round(w * .4)), 1, "#7c4c44"); px(x + w - 2, y + 3, "#2a1824");
}
function titleTuft(x, y) {
  for (const [dx, h] of [[-2, 2], [-1, 3], [0, 4], [1, 3], [2, 2]]) r(x + dx, y - h, 1, h, h > 3 ? "#a89450" : "#6c6434");
}
function titleFg() {
  fillPoly([[0, 86], [0, 72], [24, 67], [40, 71], [70, 69], [96, 73], [130, 71], [168, 75], [200, 69], [236, 71], [270, 67], [300, 71], [320, 69], [320, 96]], "#8c5470");
  // Istanbulin moskeija utuisena horisontissa (palaute 25.10.: "aloitusruutuun lisää grafiikkaa")
  { const M = "#5c3458"; disc(58, 72, 6, M); r(51, 72, 15, 6, M); disc(50, 74, 3, M); disc(66, 74, 3, M); r(58, 64, 1, 3, M); px(58, 63, "#fcd88c");
    for (const mx of [45, 71]) { r(mx, 62, 2, 16, M); px(mx, 61, M); px(mx + 1, 60, M); r(mx - 1, 66, 4, 1, "#4a2848"); } }
  // keijupiiput, Kappadokian kivipylväät tummine kivihattuineen
  for (const [x, w, h, c] of CHIMNEYS) {
    fillPoly([[x - w, 96], [x - w * .6, 96 - h * .6], [x - w * .35, 96 - h], [x + w * .35, 96 - h], [x + w * .6, 96 - h * .6], [x + w, 96]], c);
    fillPoly([[x - w * .1, 96], [x + w * .2, 96 - h * .7], [x + w * .35, 96 - h], [x + w * .6, 96 - h * .6], [x + w, 96]], "rgba(60,20,20,.25)");
    fillPoly([[x - w * .6, 97 - h], [x, 96 - h - w * .9], [x + w * .6, 97 - h]], "#5c3428"); }
  vgrad(0, 94, W, 42, ["#b4704c", "#a4643c", "#8c5434", "#74442c", "#5c3424"]);
  for (let i = 0; i < 90; i++) px(rnd() * W, 96 + rnd() * 40, rnd() < .5 ? "#c8845c" : "#4c2c1c");
  titleDune(100, 2, 23, .4); titleDune(114, 2.5, 31, 2.1); titleDune(126, 2, 19, 4, 0, 100);
  // kalliot ja kuivat tupsut kehystävät kulmat
  titleRocks(2, 124, 12); titleRocks(16, 129, 8); titleRocks(38, 127, 10); titleTuft(30, 128); titleTuft(52, 133); titleTuft(8, 122);
  titleRocks(250, 125, 11); titleRocks(266, 130, 7); titleTuft(262, 127); titleTuft(244, 132);
  // karavaani dyynin harjalla auringonlaskua vasten
  for (const [cx, rider] of [[162, 1], [176, 0], [190, 0]]) titleCamel(cx, 99, rider);
  r(201, 95, 1, 4, "#3c2440"); r(200, 93, 3, 2, "#3c2440"); r(201, 99, 1, 1, "#3c2440");          // kulkija sauvoineen
  r(204, 91, 1, 8, "#3c2440");
  // kallio ja hakattu temppelinovi vasemmassa reunassa, soihtu oven pielessä
  fillPoly([[0, 64], [8, 62], [17, 68], [25, 80], [30, 98], [34, 120], [36, 136], [0, 136]], "#4a2c3c");
  fillPoly([[8, 62], [17, 68], [25, 80], [30, 98], [27, 98], [21, 81], [14, 70]], "#a0604c");
  for (let k = 0; k < 14; k++) { const y = 70 + k * 4, x = 2 + (k * 7) % 18; if (x < 26) r(x, y, 4, 1, "#3a2030"); }
  r(6, 98, 14, 26, "#140a12"); disc(13, 98, 7, "#140a12"); r(5, 98, 1, 26, "#86504c"); r(20, 98, 1, 26, "#2a1824");
  for (let a = 0; a < Math.PI; a += .1) px(13 + Math.cos(a) * 8, 98 - Math.sin(a) * 8, "#86504c");
  r(24, 104, 2, 8, "#3c2414"); r(24, 104, 1, 8, "#86683f");
  // jalustan juurella: kiekko, nojaava maila ja kiepillä oleva piiska
  r(84, 130, 7, 2, "#141414"); r(85, 129, 5, 1, "#3c3c3c");
  for (let y = 105; y < 130; y++) { const x = Math.round(142 - (130 - y) * .3); r(x, y, 2, 1, y < 109 ? "#2c2c2c" : "#d8c49c"); px(x + 1, y, y < 109 ? "#1c1c1c" : "#a88c5c"); }
  r(142, 129, 8, 3, "#2c2c2c"); r(142, 129, 8, 1, "#e8d8b8"); r(148, 130, 2, 2, "#1c1c1c");
  for (const [rx, ry] of [[8, 2.5], [6, 2], [4, 1.2]]) for (let a = 0; a < 6.3; a += .08) px(Math.round(164 + Math.cos(a) * rx), Math.round(131 + Math.sin(a) * ry), a < 3.1 ? "#8c5c30" : "#5c3418");
  lineC(172, 131, 180, 127, "#6c4424"); r(180, 125, 2, 3, "#3c2414"); px(180, 125, "#a4703c");
  // etualan iso pallo ja sen ditheröity varjo maassa
  for (let j = -1; j <= 1; j++) for (let i = -8; i <= 8; i++) if (i * i / 64 + j * j < 1.1 && bay(24 + i, 104 + j) < .5) px(24 + i, 104 + j, "#4a3458");
  balloon(22, 55, 8, "#c83c4c", "#fcd41c");
  // kivijalusta kilvelle: valaistu yläreuna, violetti sivuvarjo
  r(96, 110, 38, 4, "#8c7c6c"); r(96, 110, 38, 1, "#f0d8b0"); r(96, 111, 38, 1, "#c8b494"); r(101, 114, 28, 14, "#7c6c5c"); r(101, 114, 3, 14, "#9c8c7c");
  r(124, 114, 5, 14, "#7a5878"); dither(122, 114, 2, 14, "#7c6c5c", "#7a5878"); r(94, 128, 42, 4, "#6c5c4c"); r(94, 128, 42, 1, "#b4a08c"); r(130, 128, 6, 4, "#7a5878");
}
// Kameli siluettina (karavaani aloitusruudussa), valinnainen ratsastaja turbaanissa.
function titleCamel(x, y, rider) {
  const C = "#3c2440";
  r(x, y - 6, 9, 3, C); r(x + 2, y - 8, 4, 2, C); px(x + 3, y - 9, C); r(x + 8, y - 9, 2, 4, C); r(x + 9, y - 10, 3, 2, C); px(x - 1, y - 5, C);
  for (const lx of [x, x + 2, x + 6, x + 8]) r(lx, y - 3, 1, 3, C);
  if (rider) { r(x + 3, y - 12, 2, 4, C); r(x + 2, y - 13, 4, 1, C); px(x + 3, y - 14, C); }
}
// Lintuparvi ja soihdun liekki: aloitusruudun liikkuvat pikkuasiat.
function titleLife(t) {
  for (let k = 0; k < 5; k++) { const x = ((t / 90 + k * 9) % 380) - 30 + (k % 2) * 3, y = 46 + k * 2 + Math.sin(t / 900 + k) * 2, up = Math.floor(t / 180 + k) % 2;
    px(x, y, "#3c2440"); px(x - 1, y - up, "#3c2440"); px(x + 1, y - up, "#3c2440"); px(x - 2, y - 1 + up, "#3c2440"); px(x + 2, y - 1 + up, "#3c2440"); }
  const fl = Math.sin(t / 70) + Math.sin(t / 113); glow(25, 102, 14 + fl * 2, "255,170,80", .28);
  for (let j = 0; j < 6; j++) r(24.5 - (3 - j / 2) / 2 + (j > 3 ? Math.round(fl / 2) : 0), 103 - j, Math.max(1, 3 - j / 2), 1, j < 2 ? "#fff0a0" : j < 4 ? "#ff9a30" : "#b03a20");
}
// Väri sekoitetaan kohti toista (#rrggbb), pallojen valoihin ja varjoihin.
function mixHex(a, b, t) {
  const p = (h, i) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  return "#" + [0, 1, 2].map((i) => Math.round(p(a, i) + (p(b, i) - p(a, i)) * t).toString(16).padStart(2, "0")).join("");
}
function balloon(x, y, rad, c1, c2) {
  x = Math.round(x); y = Math.round(y);
  const lt = mixHex(c1, "#fcf0d8", .4), dk = mixHex(c1, "#3c2c68", .55), sd = mixHex(c2, "#3c2c68", .45);
  for (let j = -rad; j <= rad; j++) for (let i = -rad; i <= rad; i++) {
    const d = i * i + j * j; if (d > rad * rad) continue;
    const sh = (i * .7 - j * .5) / rad + (bay(x + i, y + j) - .5) * .35;
    let c = sh < -.35 ? lt : sh > .3 ? dk : c1;
    if (Math.abs(i) === Math.round(rad / 2)) c = sh > .3 ? sd : c2;                             // kangassauma
    if (d > (rad - 1) * (rad - 1) && i > 0 && j >= 0) c = "#f8a050";                            // auringon puoleinen reunavalo
    px(x + i, y + j, c); }
  r(x - 2, y + rad, 5, 1, dk); r(x - 1, y + rad + 1, 3, 1, dk);
  const by = y + rad + (rad > 5 ? 4 : 3);
  for (let k = y + rad + 2; k < by; k++) { px(x - 1, k, "#3c2414"); px(x, k, "#3c2414"); }
  px(x - 1, by, "#a4703c"); px(x, by, "#6c4424"); r(x - 1, by + 1, 2, 1, "#4c2c14");
}
// Mouhon oikea logo (start_screen/mouho_logo.png -> tools/logo_px.py -> PIXFACES.mouho_logo) hehkuu
// jalustalla kuin idoli. Kuva on 2x-tarkka kuten valokuvapäät, joten se piirretään puoleen kokoon.
function mouhoShield(cx, top, t) {
  const L = PIXFACES.mouho_logo.logo, img = faceCache["logo|mouho"] ??= renderPix(L, { over: true }), s = L.w / PXS, h = L.h / PXS;
  const pulse = .5 + .5 * Math.sin(t / 420);
  const cy = Math.round(top + h * .5), R = Math.round(s * .8 + pulse * 2), x0 = Math.round(cx - s / 2);
  glow(cx, cy, s * (1 + pulse * .25), "252,220,120", .35);
  // terävät säteet kilven takana, pikseli kerrallaan
  for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3 + t / 3000;
    for (let d = R - 2; d < R * 1.6; d++) { const x = Math.round(cx + Math.cos(a) * d), y = Math.round(cy + Math.sin(a) * d);
      if (y < 110 && (d < R * 1.3 || bay(x, y) < .5)) px(x, y, d < R * 1.3 ? "#f8b45c" : "#e8844c"); } }
  // portaittainen kolmikaistainen halo, reunat ditheröity, jalustan yläpuolella
  for (let y = cy - R; y < Math.min(cy + R, 110); y++) for (let x = Math.round(cx) - R; x <= Math.round(cx) + R; x++) {
    const d = Math.hypot(x - cx, y - cy) + (bay(x, y) - .5) * 2.5;
    if (d < R * .55) px(x, y, "#fcdc8c"); else if (d < R * .78) px(x, y, "#f8b45c"); else if (d < R) px(x, y, "#e8844c"); }
  g.save(); g.imageSmoothingEnabled = false; g.drawImage(img, x0, top, s, h); g.restore();
  // reunavalo vasemmalle ylös: kilven pikselit joiden yläpuolella tai vasemmalla on tyhjää
  const rim = faceCache["logo|mouho|rim"] ??= (() => { const c = img.getContext("2d"), dd = c.getImageData(0, 0, img.width, img.height).data, out = [];
    const on = (i, j) => { if (i < 0 || j < 0 || i >= s || j >= h) return false; const u = Math.floor(i / s * img.width), v = Math.floor(j / h * img.height); return dd[(v * img.width + u) * 4 + 3] > 128; };
    for (let j = 0; j < h; j++) for (let i = 0; i < s; i++) if (on(i, j) && (!on(i - 1, j) || !on(i, j - 1)) && i + j < (s + h) * .55) out.push([i, j]);
    return out; })();
  for (const [i, j] of rim) px(x0 + i, top + j, "#fcf0a0");
  // kimallukset vuorotellen
  for (let k = 0; k < 4; k++) { if (Math.floor(t / 350 + k * 1.7) % 3) continue;
    const sx = x0 + Math.round(s * [.3, .7, .5, .22][k]), sy = top + Math.round(h * [.25, .4, .7, .55][k]);
    r(sx, sy, 2, 2, "#fcf0a0"); px(sx - 1, sy, "#fcdc8c"); px(sx + 2, sy + 1, "#fcdc8c"); px(sx + 1, sy - 1, "#fcdc8c"); px(sx, sy + 2, "#fcdc8c"); }
}
// Logo piirretään kerran omalle kankaalleen, kun Bangers-fontti on latautunut: musta varjopursotus,
// paksu musta ääriviiva ja kovin raidoin porrastettu liukuväri (punaoranssi ylhäällä, keltainen
// alhaalla). Lopuksi läpinäkyvyys kynnystetään, jotta reunat ovat pikseliterävät.
let titleLogo = null;
const TITLE_FILL = [[0, "#d8301c"], [.28, "#ec541c"], [.5, "#f8841c"], [.7, "#fcb41c"], [.86, "#fcdc3c"], [1, "#fcf07c"]];
function logoLayers(x, glyphs, fill) {
  for (const L of [0, 1, 2]) for (const q of glyphs) {
    x.save(); x.translate(q.x, q.base); x.transform(1, 0, -.16, 1, 0, 0); x.font = `${q.f}px Bangers`;
    if (L === 0) { x.fillStyle = "#1c0c04"; for (let d = 4; d > 0; d--) x.fillText(q.ch, -d * .6, d * .9); }
    else if (L === 1) { x.lineJoin = "round"; x.lineWidth = q.line; x.strokeStyle = "#140804"; x.strokeText(q.ch, 0, 0); }
    else { const gr = x.createLinearGradient(0, -q.h, 0, 0); for (let k = 0; k < fill.length; k++) { gr.addColorStop(fill[k][0], fill[k][1]); if (k + 1 < fill.length) gr.addColorStop(fill[k + 1][0] - .001, fill[k][1]); }
      x.fillStyle = q.solid ?? gr; x.fillText(q.ch, 0, 0); }
    x.restore();
  }
}
function buildTitleLogo() {
  if (titleLogo) return titleLogo;
  if (!document.fonts?.check("20px Bangers")) { document.fonts?.load("20px Bangers"); return null; }   // fontti latautuu vasta pyydettäessä
  const c = document.createElement("canvas"); c.width = W * 2; c.height = 160; const x = c.getContext("2d"); x.scale(2, 2);
  x.font = "100px Bangers"; const cap = x.measureText("M").actualBoundingBoxAscent / 100;
  const glyphs = [], word = "JUSSI MARKKANEN", n = word.length; let cx = 0;
  for (let i = 0; i < n; i++) {
    if (word[i] === " ") { cx += 5; continue; }
    const u = i / (n - 1), h = 31 - 15 * Math.pow(u, .7), f = h / cap;   // iso ensimmäinen kirjain, kaari nousee oikealle
    x.font = `${f}px Bangers`; glyphs.push({ ch: word[i], x: cx, base: 44 - 17 * Math.pow(u, .9), h, f, line: 3 }); cx += x.measureText(word[i]).width * 1.02;
  }
  const sx = Math.min(1, 262 / cx); for (const q of glyphs) q.x = 14 + q.x * sx;
  // "ja" ja "MOUHON SALAISUUS": keltainen, musta reunus, harvennettu kuin LAST CRUSADE
  const sub = [{ ch: "ja", x: 34, base: 58, h: 8, f: 8 / cap, line: 2.4, solid: "#fce84c" }]; let sxp = 50;
  for (const ch of "MOUHON SALAISUUS") { if (ch === " ") { sxp += 6; continue; } x.font = `${11 / cap}px Bangers`; sub.push({ ch, x: sxp, base: 68, h: 11, f: 11 / cap, line: 2.6, solid: "#fce84c" }); sxp += x.measureText(ch).width + 2.6; }
  logoLayers(x, glyphs, TITLE_FILL); logoLayers(x, sub, TITLE_FILL);
  const im = x.getImageData(0, 0, c.width, c.height), d = im.data; for (let k = 3; k < d.length; k += 4) d[k] = d[k] > 110 ? 255 : 0; x.putImageData(im, 0, 0);
  return (titleLogo = c);
}
// Jussi rintakuvana oikeassa reunassa (NES-kansikuvan tapaan), päässä seikkailijan fedora.
function titleJussi(t) {
  const B = PIXFACES.jussi.bust, bimg = faceCache["bust|jussi"] ??= renderPix(B, {}), face = faceImg("jussi", "portrait", { blink: t % 4200 < 130, over: true });
  const bx = W - bimg.width - 4, by = H - bimg.height + 2, hx = bx + B.head_at[0] + 32, hy = by + B.head_at[1];
  g.drawImage(bimg, bx, by); g.drawImage(face, bx + B.head_at[0], hy);
  fillPoly([[hx - 23, hy + 20], [hx - 20, hy - 1], [hx - 8, hy - 5], [hx, hy - 1], [hx + 8, hy - 5], [hx + 20, hy - 1], [hx + 23, hy + 20]], "#8c5c30");
  fillPoly([[hx - 20, hy], [hx - 8, hy - 4], [hx - 6, hy + 18], [hx - 21, hy + 18]], "#a4703c"); r(hx - 23, hy + 12, 46, 5, "#3c2414");
  g.fillStyle = "#6c4424"; g.beginPath(); g.ellipse(hx, hy + 21, 38, 5, 0, 0, 7); g.fill(); g.fillStyle = "#4c2c14"; g.fillRect(hx - 38, hy + 21, 76, 1);
  g.fillStyle = "rgba(20,8,0,.35)"; g.fillRect(hx - 28, hy + 24, 56, 4);                         // lierin varjo otsalla
}
function drawTitle(t) {
  g.drawImage(paintBg("title_sky", titleSky), 0, 0);
  TITLE_CLOUDS.forEach((L, k) => drift(`title_cloud${k}`, L.v, () => puffBand(L.list, L.c, "#d8a4b4"), t));
  g.drawImage(paintBg("title_fg", titleFg), 0, 0);
  for (const [x, y, rad, c1, c2] of BALLOONS) balloon(x + Math.sin(t / 9000 + x) * 6, y + Math.sin(t / 1300 + x) * 1.5, rad, c1, c2);
  titleLife(t);
  mouhoShield(115, 75, t);
  titleJussi(t);
  const logo = buildTitleLogo();
  if (logo) g.drawImage(logo, 0, 0, W, 80);
  else { g.textAlign = "center"; g.font = "30px VT323, monospace"; g.fillStyle = "#fcc81c"; g.fillText("JUSSI MARKKANEN", 130, 30); g.font = "14px VT323, monospace"; g.fillText("ja Mouhon salaisuus", 130, 50); }
  g.textAlign = "center"; g.font = "10px VT323, monospace";
  if (Math.floor(t / 600) % 2) { g.fillStyle = "#1c1c1c"; g.fillText("Klikkaa aloittaaksesi", 116, 134); g.fillStyle = "#fcfc54"; g.fillText("Klikkaa aloittaaksesi", 115, 133); }
  g.textAlign = "left";
}
