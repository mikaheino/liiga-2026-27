// Mouhon salaisuus -- Aloitusruutu: Indiana Jones -logo, Kappadokia, Mouhon kilpi, Jussi fedorassa.
"use strict";
// ---- alkuruutu, matka ja loppu --------------------------------------------------
// Alkuruutu (23.10., start_screen/: LucasArtsin Indiana Jones -pelien kansikuvat): auringonlaskun
// Kappadokia ilmapalloineen, kaareva oranssi-keltainen logo "JUSSI MARKKANEN", alle "ja MOUHON
// SALAISUUS", Mouhon kilpi hehkuu jalustalla kuin idoli ja Jussi fedorassa oikeassa reunassa.
const CHIMNEYS = [[16, 10, 36, "#a8603c"], [44, 7, 24, "#b46c44"], [72, 6, 16, "#b87048"], [166, 5, 15, "#b87048"], [190, 8, 30, "#a05a3c"], [216, 11, 42, "#b06844"]];
const BALLOONS = [[30, 82, 4, "#d8302c", "#fcd41c"], [176, 50, 5, "#f0a830", "#1c1c1c"], [152, 80, 3, "#3c6cc8", "#fcfcfc"]];
// Taivas, kaksi ajelehtivaa pilvikerrosta (ylempi hitaampi) ja läpinäkyvä etuala (23.10.).
const TITLE_CLOUDS = [{ c: "#8c5c98", v: 3, list: [[190, 4, 130], [60, 2, 110]] }, { c: "#c88490", v: 6, list: [[186, 40, 60], [0, 50, 36], [110, 60, 70]] }];
function titleBg() { titleSky(); TITLE_CLOUDS.forEach((L) => puffBand(L.list, L.c, "#d8a4b4")); titleFg(); }
function titleSky() {
  vgrad(0, 0, W, 96, ["#1c2458", "#2c3470", "#4c3c84", "#7c4c8c", "#b45c84", "#e07c74", "#f8a46c", "#fcc87c"]);
  disc(150, 84, 22, "#fce4a0"); disc(150, 84, 17, "#fcf0c4");                                   // aurinko laskee
}
function titleFg() {
  fillPoly([[0, 86], [0, 72], [24, 67], [40, 71], [70, 69], [96, 73], [130, 71], [168, 75], [200, 69], [236, 71], [270, 67], [300, 71], [320, 69], [320, 96]], "#8c5470");
  // keijupiiput, Kappadokian kivipylväät tummine kivihattuineen
  for (const [x, w, h, c] of CHIMNEYS) {
    fillPoly([[x - w, 96], [x - w * .6, 96 - h * .6], [x - w * .35, 96 - h], [x + w * .35, 96 - h], [x + w * .6, 96 - h * .6], [x + w, 96]], c);
    fillPoly([[x - w * .1, 96], [x + w * .2, 96 - h * .7], [x + w * .35, 96 - h], [x + w * .6, 96 - h * .6], [x + w, 96]], "rgba(60,20,20,.25)");
    fillPoly([[x - w * .6, 97 - h], [x, 96 - h - w * .9], [x + w * .6, 97 - h]], "#5c3428"); }
  vgrad(0, 94, W, 42, ["#b4704c", "#a4643c", "#8c5434", "#74442c", "#5c3424"]);
  for (let i = 0; i < 90; i++) px(rnd() * W, 96 + rnd() * 40, rnd() < .5 ? "#c8845c" : "#4c2c1c");
  // kivijalusta kilvelle
  r(96, 110, 38, 4, "#8c7c6c"); r(96, 110, 38, 1, "#b4a494"); r(101, 114, 28, 14, "#7c6c5c"); r(101, 114, 3, 14, "#9c8c7c"); r(126, 114, 3, 14, "#5c4c3c"); r(94, 128, 42, 4, "#6c5c4c");
}
function balloon(x, y, rad, c1, c2) {
  x = Math.round(x); y = Math.round(y);
  disc(x, y, rad, c1); for (const dx of [-Math.round(rad / 2), Math.round(rad / 2)]) { const h = Math.floor(Math.sqrt(rad * rad - dx * dx)); r(x + dx, y - h, 1, h * 2 + 1, c2); }
  r(x - 2, y + rad, 5, 1, c1); r(x - 1, y + rad + 1, 3, 1, c1);
  px(x - 1, y + rad + 2, "#3c2414"); px(x + 1, y + rad + 2, "#3c2414"); r(x - 1, y + rad + 3, 3, 2, "#6c4424");
}
// Mouhon oikea logo (start_screen/mouho_logo.png -> tools/logo_px.py -> PIXFACES.mouho_logo) hehkuu
// jalustalla kuin idoli. Kuva on 2x-tarkka kuten valokuvapäät, joten se piirretään puoleen kokoon.
function mouhoShield(cx, top, t) {
  const L = PIXFACES.mouho_logo.logo, img = faceCache["logo|mouho"] ??= renderPix(L, { over: true }), s = L.w / PXS, h = L.h / PXS;
  const pulse = .5 + .5 * Math.sin(t / 420);
  glow(cx, top + h * .5, s * (1 + pulse * .25), "252,220,120", .55);
  for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 + t / 3000; g.strokeStyle = `rgba(252,228,150,${.12 + .14 * pulse})`; g.lineWidth = 2;
    g.beginPath(); g.moveTo(cx + Math.cos(a) * s * .6, top + h * .5 + Math.sin(a) * s * .6); g.lineTo(cx + Math.cos(a) * s * 1.2, top + h * .5 + Math.sin(a) * s * 1.2); g.stroke(); }
  g.save(); g.imageSmoothingEnabled = false; g.drawImage(img, Math.round(cx - s / 2), top, s, h); g.restore();
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
  mouhoShield(115, 75, t);
  titleJussi(t);
  const logo = buildTitleLogo();
  if (logo) g.drawImage(logo, 0, 0, W, 80);
  else { g.textAlign = "center"; g.font = "30px VT323, monospace"; g.fillStyle = "#fcc81c"; g.fillText("JUSSI MARKKANEN", 130, 30); g.font = "14px VT323, monospace"; g.fillText("ja Mouhon salaisuus", 130, 50); }
  g.textAlign = "center"; g.font = "10px VT323, monospace";
  if (Math.floor(t / 600) % 2) { g.fillStyle = "#1c1c1c"; g.fillText("Klikkaa aloittaaksesi", 116, 134); g.fillStyle = "#fcfc54"; g.fillText("Klikkaa aloittaaksesi", 115, 133); }
  g.textAlign = "left";
}
