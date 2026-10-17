// Mouhon salaisuus -- puheluanimaatio (vaihe 2, 17.10.: "Myrrä puhelimessa, mutta erillisellä
// hienolla animaatiolla"). Sarjakuvamainen jaettu ruutu: vasemmalla Jussi Kisapuistossa,
// oikealla Myrrä valmentajakopissa pakkaamassa tavaroitaan (IS 7.10.: "kamojani tästä juuri
// pakkailen valmentajakopista") -- kaksi juuri vapautunutta miestä, laatikot kummallakin.
// Soittoääni, paneelit liukuvat sisään, muotokuvat puhuvat ja räpsyttävät, Jussin
// väärinymmärrys syttyy hehkulamppuna, "KLIK" ja paneelit liukuvat ulos.
"use strict";

const PANEL = { L: { x: 6, y: 40, w: 150, h: 94 }, R: { x: 164, y: 40, w: 150, h: 94 } };
const ease = (k) => 1 - Math.pow(1 - Math.max(0, Math.min(1, k)), 3);

// Paneelit piirretään tuplatarkkuudella (300 x 188 laitepikseliä = 150 x 94 maailmassa;
// 17.10.: "kasvot pienemmiksi ja taustaan tarkkuutta, nyt kasvot peittävät kaiken").
const PW = 300, PH = 188;
function hiCanvas(fn) { const c = document.createElement("canvas"); c.width = PW; c.height = PH; const prev = g; g = c.getContext("2d"); seed = 11; fn(); g = prev; return c; }

// Kisapuiston sisäänkäynti illalla, huipputarkka (17.10.: puhelun ajaksi grafiikkataso nousee
// valtavasti -- koominen vertailu pelin matalaan tasoon).
function kisaPanel() {
  vgrad(0, 0, PW, 70, ["#141634", "#1e1e46", "#2e2658", "#4c3068", "#7a3c66", "#a8505e", "#d07052", "#eca058"]);
  for (let i = 0; i < 60; i++) { const x = (rnd() * PW) | 0, y = (rnd() * 22) | 0; px(x, y, rnd() > .8 ? "#ffffff" : "#8c8cc8"); }
  for (let i = 0; i < 46; i++) { const x = (rnd() * PW) | 0, y = 6 + ((rnd() * 46) | 0), w = 4 + ((rnd() * 30) | 0), lo = y > 30;
    r(x, y, w, 1, lo ? "#6a3a5c" : "#3a2c5c"); r(x + 1, y + 1, w - 2, 1, lo ? "#f4a874" : "#d0687c"); if (lo && w > 14) r(x + 4, y + 2, w - 8, 1, "#fcd08c"); }
  // metsän reuna: männyt ja ruskakoivut, oksat pikseleinä
  for (let x = -6; x < PW + 6; x += 4 + ((rnd() * 7) | 0)) { const h = 18 + ((rnd() * 26) | 0), y0 = 74 - h;
    r(x + 4, y0, 2, h, "#18141e"); for (let j = 0; j < h; j += 2) { const w2 = 2 + Math.min(12, j / 1.6); r(x + 5 - w2 / 2, y0 + j, w2, 2, j % 4 ? "#1a2030" : "#222a3a"); } }
  for (const [x, y] of [[24, 42], [96, 50], [262, 38], [190, 48]]) { for (let k = 0; k < 160; k++) { const a = rnd() * 6.3, d = Math.sqrt(rnd()) * 14; const X = x + Math.cos(a) * d * 1.4, Y = y + Math.sin(a) * d;
    px(X, Y, bay(X | 0, Y | 0) < .25 ? "#7c4c1c" : rnd() > .45 ? "#f0bc48" : "#c88c2c"); } r(x, y + 10, 2, 30, "#e8e4dc"); px(x, y + 16, "#2c2c2c"); px(x + 1, y + 24, "#2c2c2c"); }
  // halli: aaltopelti varjostuksella, keltainen SaiPa-lohko kylttineen
  vgrad(0, 34, PW, 76, ["#8c8aa4", "#7c7a94", "#6c6a84"]); for (let x = 0; x < PW; x += 4) { r(x, 34, 1, 76, "#62607a"); r(x + 1, 34, 1, 76, "#8e8ca6"); }
  r(0, 34, PW, 2, "#b4b2cc"); for (let x = 70; x < PW; x += 46) { r(x, 50, 18, 12, "#3a3850"); r(x + 1, 51, 16, 10, "#ffd890"); r(x + 1, 51, 16, 2, "#fff0c0"); r(x + 9, 51, 1, 10, "#c8a060"); }
  r(0, 6, 64, 104, "#dca82e"); for (let x = 1; x < 64; x += 4) { r(x, 6, 1, 104, "#c8962a"); r(x + 1, 6, 1, 104, "#ecbc44"); } r(0, 6, 64, 2, "#fcdc70"); r(62, 6, 2, 104, "#9c7424"); dither(0, 86, 64, 24, "#dca82e", "#b4842c", .45);
  r(8, 24, 48, 40, "#1c1c1c"); r(10, 26, 44, 36, "#f8d838"); text3("SAIPA", 13, 30, "#1c1c1c", 2); text3("1948", 17, 44, "#1c1c1c", 2); r(12, 58, 40, 2, "#1c1c1c");
  // katos: kyltti, valonauha, putket
  r(0, 100, PW, 24, "#1e1c28"); r(0, 100, PW, 2, "#4a4860"); r(0, 122, PW, 2, "#100e16"); r(0, 102, PW, 1, "#2c2a3a");
  fillPoly([[0, 103], [16, 103], [10, 121], [0, 121]], "#ecbc3c"); fillPoly([[284, 103], [300, 103], [300, 121], [290, 121]], "#ecbc3c");
  const sign = "TERVETULOA KISAPUISTOON"; text3(sign, 151 - text3w(sign, 2) / 2, 109, "#3a3428", 2); text3(sign, 150 - text3w(sign, 2) / 2, 108, "#fcf8ec", 2);
  for (let x = 20; x < 290; x += 26) { r(x, 123, 10, 2, "#fff4d0"); }
  // aula: lasiseinä, lipunmyynti, julisteet, ihmiset, kattovalot
  r(0, 124, PW, 48, "#2c2838");
  for (let x = 4; x < PW - 4; x += 38) { vgrad(x, 127, 34, 42, ["#fff0c4", "#f4cc84", "#e0ac64", "#c8904c"]); r(x + 16, 127, 2, 42, "#7c5c34"); r(x, 145, 34, 1, "#b88c50"); r(x, 127, 34, 1, "#fff8e0"); }
  r(118, 130, 30, 12, "#2c2838"); r(120, 132, 26, 8, "#fce8b0"); text3("LIPUT", 122, 133, "#5c3c14");
  for (const [x, c1, c2] of [[46, "#c81c1c", "#fcd41c"], [196, "#1c1c1c", "#fcd41c"]]) { r(x, 128, 16, 22, "#f4f4ec"); r(x + 1, 129, 14, 8, c1); r(x + 1, 138, 14, 3, c2); text3("LA", x + 2, 143, "#2c2c2c"); }
  for (const [x, c] of [[30, "#3c2c24"], [92, "#4c2c3c"], [158, "#2c3c4c"], [176, "#3c2c24"], [242, "#2c2c2c"]]) { r(x, 148, 7, 20, c); disc(x + 3, 144, 3, "#e8b894"); r(x + 1, 140, 5, 2, c); r(x - 1, 152, 2, 10, c); }
  for (const x of [26, 264]) { r(x, 124, 5, 48, "#a4a4b4"); r(x, 124, 1, 48, "#d0d0dc"); }
  // märkä asfaltti: aulan ja taivaan heijastukset, reunakivi, lätäkkö
  vgrad(0, 170, PW, 18, ["#3a3450", "#24223a", "#18172a"]); r(0, 170, PW, 1, "#6c6884"); r(0, 171, PW, 1, "#4a4660");
  for (let x = 4; x < PW; x += 38) for (let y = 173; y < PH; y++) if (bay(x + y, y) < .55 - (y - 173) * .03) r(x + 6 + ((y * 5) % 7), y, 18 - (y - 173), 1, "rgba(244,204,132,.4)");
  g.fillStyle = "rgba(160,150,200,.18)"; g.beginPath(); g.ellipse(70, 182, 40, 4, 0, 0, 7); g.fill();
  // pyörä telineessä vasemmalla
  for (const x of [70, 90]) { g.strokeStyle = "#1c1c24"; g.lineWidth = 2; g.beginPath(); g.arc(x, 176, 7, 0, 7); g.stroke(); } lineC(70, 176, 80, 166, "#c81c1c", 2); lineC(80, 166, 90, 176, "#c81c1c", 2); lineC(80, 166, 84, 160, "#1c1c24", 2);
  // Jussin pahvilaatikko etualalla
  r(10, 156, 44, 30, "#b8925c"); r(10, 156, 44, 2, "#dcb680"); r(31, 156, 2, 30, "#8c6c3c"); dither(10, 176, 44, 10, "#b8925c", "#9c7848", .4);
  r(16, 147, 9, 10, "#f4f4ec"); r(16, 147, 9, 2, "#c81c1c"); r(34, 146, 16, 10, "#c8a030"); r(36, 148, 12, 2, "#3c2c10"); text3("LIIGA", 18, 168, "#2c2c3c");
}
// Myrrän toimisto KooKoon hallissa (17.10.: "selkeästi KooKoon hallin näköinen, ja koomisesti
// ikkuna Kouvolaan, joka on harmaa"). Ikkunan maisema on maalattu VAIN "Kouvolan väripaletin"
// kuudella harmaalla (#3A3938 #4E4D4E #626264 #262422 #9899A1 #79797D) -- myös aurinko.
const KOUVOLA = ["#9899A1", "#79797D", "#626264", "#4E4D4E", "#3A3938", "#262422"];
function kookooShield(cx, cy, s) {
  const P = (pts, c) => fillPoly(pts.map(([x, y]) => [cx + x * s, cy + y * s]), c);
  const shield = [[-20, -22], [-6, -24], [0, -27], [6, -24], [20, -22], [20, 4], [12, 16], [0, 24], [-12, 16], [-20, 4]];
  P(shield.map(([x, y]) => [x * 1.12, y * 1.12]), "#0c0c0c"); P(shield.map(([x, y]) => [x * 1.04, y * 1.04]), "#ec7a2c"); P(shield, "#141414");
  P([[-24, 0], [24, -14], [24, -6], [-24, 8]], "#ec7a2c"); P([[-24, 2], [24, -12], [24, -8], [-24, 6]], "#ffffff");
  g.save(); g.translate(cx, cy - 2 * s); g.rotate(-.28); g.font = `bold italic ${Math.round(11 * s)}px Arial, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
  g.lineWidth = 3 * s; g.strokeStyle = "#ec7a2c"; g.strokeText("KooKoo", 0, 0); g.fillStyle = "#ffffff"; g.fillText("KooKoo", 0, 0); g.restore(); g.textAlign = "left"; g.textBaseline = "alphabetic";
}
function coachPanel() {
  // seinä: hiilenharmaa, KooKoon oranssi-musta raita, kattovalaisimet
  vgrad(0, 0, PW, 132, ["#24242a", "#2c2c34", "#26262c"]); dither(0, 0, PW, 132, "#2a2a32", "#26262c", .15);
  r(0, 104, PW, 10, "#ec7a2c"); r(0, 114, PW, 4, "#0c0c0c"); r(0, 102, PW, 2, "#0c0c0c"); r(0, 104, PW, 1, "#ffa060");
  for (const x of [40, 200]) { r(x, 0, 60, 4, "#d8dce4"); r(x + 2, 4, 56, 1, "#9ca0a8"); }
  // ikkuna Kouvolaan
  const wx = 178, wy = 12, ww = 112, wh = 84;
  r(wx - 5, wy - 5, ww + 10, wh + 10, "#0c0c0c"); r(wx - 3, wy - 3, ww + 6, wh + 6, "#ec7a2c");
  vgrad(wx, wy, ww, wh, [KOUVOLA[0], KOUVOLA[0], KOUVOLA[1]]);
  disc(wx + 92, wy + 16, 8, KOUVOLA[1], KOUVOLA[2]);                                   // harmaa aurinko
  for (let i = 0; i < 6; i++) r(wx + 6 + i * 18, wy + 10 + (i % 3) * 4, 12 + (i % 4) * 4, 1, KOUVOLA[1]);
  for (const [x, w, h, c] of [[2, 20, 58, 2], [24, 26, 66, 3], [52, 16, 44, 2], [70, 22, 72, 3], [94, 16, 52, 2]]) {
    const top = wy + wh - h; r(wx + x, top, w, h, KOUVOLA[c]); r(wx + x, top, w, 2, KOUVOLA[c - 1]); r(wx + x + w - 3, top, 3, h, KOUVOLA[c + 1]);
    for (let yy = top + 5; yy < wy + wh - 12; yy += 5) for (let xx = wx + x + 3; xx < wx + x + w - 4; xx += 4) r(xx, yy, 2, 2, KOUVOLA[5]);
    r(wx + x + 4, top - 4, 3, 4, KOUVOLA[c + 1]); }
  r(wx, wy + wh - 12, ww, 12, KOUVOLA[1]); dither(wx, wy + wh - 12, ww, 12, KOUVOLA[1], KOUVOLA[0], .35);   // harmaa lumi
  for (const x of [16, 46, 86, 104]) { lineC(wx + x, wy + wh - 10, wx + x, wy + wh - 30, KOUVOLA[5]); lineC(wx + x, wy + wh - 22, wx + x - 5, wy + wh - 30, KOUVOLA[5]); lineC(wx + x, wy + wh - 24, wx + x + 4, wy + wh - 31, KOUVOLA[5]); }
  for (const [x, y] of [[40, 22], [48, 18], [96, 26]]) { px(wx + x, wy + y, KOUVOLA[5]); px(wx + x - 1, wy + y - 1, KOUVOLA[5]); px(wx + x + 1, wy + y - 1, KOUVOLA[5]); }
  r(wx + ww / 2 - 1, wy, 2, wh, "#0c0c0c"); r(wx, wy + 34, ww, 2, "#0c0c0c");
  r(wx + 6, wy + 4, 34, 9, "#fce870"); text3("KOUVOLA", wx + 8, wy + 6, "#3c3c3c");          // post-it ikkunassa
  r(wx - 6, wy + wh + 4, ww + 12, 5, "#3c3c44"); r(wx + 96, wy + wh - 4, 10, 8, "#7c5c3c"); for (let k = 0; k < 6; k++) lineC(wx + 101, wy + wh - 4, wx + 96 + k * 2, wy + wh - 12 - (k % 3) * 2, KOUVOLA[2]);   // harmaa kuollut kukka
  // KooKoo-logo seinällä, hopeamitali ja kehystetty kuva
  kookooShield(38, 40, 1.1);
  r(16, 72, 1, 12, "#ec7a2c"); r(10, 70, 13, 2, "#ec7a2c"); disc(16, 88, 6, "#dcdce4", "#9c9ca8"); px(14, 86, "#ffffff"); text3("2", 15, 86, "#7c7c84");
  r(28, 70, 30, 22, "#7c5c3c"); r(30, 72, 26, 18, "#8ca0b4"); for (let k = 0; k < 6; k++) disc(33 + k * 4, 84, 1, k % 2 ? "#ec7a2c" : "#e8c0a0"); text3("HOPEA", 32, 74, "#f4f4f4");
  // naulakko: oranssi kaulaliina ja takki
  r(4, 120, 2, 10, "#9c9ca8"); fillPoly([[0, 122], [8, 122], [12, 160], [-2, 160]], "#ec7a2c"); for (let y = 126; y < 160; y += 6) r(0, y, 11, 2, "#0c0c0c");
  // lattia, pöytä, läppäri jossa sarjataulukko
  vgrad(0, 132, PW, 56, ["#3c3c44", "#2c2c34", "#24242a"]); for (let x = 0; x < PW; x += 30) r(x, 132, 1, 56, "#34343c");
  r(150, 138, 150, 6, "#5c4632"); r(150, 144, 150, 4, "#3c2c20"); r(156, 148, 6, 40, "#3c2c20"); r(290, 148, 6, 40, "#3c2c20");
  r(176, 116, 50, 22, "#1c1c22"); r(178, 118, 46, 18, "#d8e0ec"); for (let k = 0; k < 4; k++) { r(180, 120 + k * 4, 30, 1, "#5c6c84"); r(214, 120 + k * 4, 8, 1, k === 3 ? "#c81c1c" : "#5c6c84"); } r(172, 136, 58, 3, "#3c3c44");
  r(238, 128, 10, 11, "#f4f0e4"); r(238, 128, 10, 3, "#ec7a2c"); r(248, 130, 3, 6, "#f4f0e4");
  for (let k = 0; k < 4; k++) r(256 + k * 2, 134 - k, 24, 4, k % 2 ? "#f4f4ec" : "#e4e4dc");
  // pahvilaatikko lattialla oikealla edessä
  r(210, 152, 84, 36, "#b8925c"); r(210, 152, 84, 3, "#dcb680"); r(251, 152, 2, 36, "#8c6c3c"); dither(210, 176, 84, 12, "#b8925c", "#9c7848", .4);
  fillPoly([[210, 152], [200, 140], [236, 140], [244, 152]], "#c8a26c"); fillPoly([[294, 152], [300, 140], [268, 140], [260, 152]], "#a8824c");
  r(218, 136, 30, 18, "#1c1c24"); r(220, 138, 26, 14, "#f0f0ec"); r(232, 140, 1, 10, "#e0a0a0"); r(256, 138, 26, 6, "#ec7a2c"); r(256, 140, 26, 1, "#0c0c0c"); disc(286, 136, 3, "#c8c8d0");
  text3("KAMAT", 226, 166, "#5c3c1c");
}
let panelCache = {};
// Käsi ja kännykkä: hiha olkapäästä kyynärpään kautta korvalle, käsi pitelee puhelinta.
function phoneArm(sx, sy, ex, ey, hx, hy, sleeve, sleeveD, cuff, t, ringing) {
  const limb = (x0, y0, x1, y1, w, c) => { const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy), nx = -dy / L * w / 2, ny = dx / L * w / 2;
    fillPoly([[x0 + nx, y0 + ny], [x1 + nx, y1 + ny], [x1 - nx, y1 - ny], [x0 - nx, y0 - ny]], c); };
  limb(sx, sy, ex, ey, 22, sleeveD); limb(sx, sy, ex, ey, 18, sleeve); disc(ex, ey, 10, sleeve);
  limb(ex, ey, hx, hy + 8, 18, sleeveD); limb(ex, ey, hx, hy + 8, 15, sleeve);
  if (cuff) limb(hx + (ex - hx) * .12, hy + 8 + (ey - hy - 8) * .12, hx, hy + 8, 15, cuff);
  const sh = ringing ? Math.round(Math.sin(t / 25) * 2) : 0;
  r(hx - 5 + sh, hy - 16, 11, 26, "#141418"); r(hx - 3 + sh, hy - 14, 7, 20, ringing && (t / 120 | 0) % 2 ? "#9cf0fc" : "#2c4c6c"); px(hx + sh, hy - 15, "#5c5c6c");
  g.fillStyle = "#f0bc9c"; g.beginPath(); g.ellipse(hx + sh, hy + 4, 8, 10, 0, 0, 7); g.fill();
  for (let k = 0; k < 3; k++) r(hx - 7 + sh, hy - 6 + k * 5, 14, 1, "#c88c70");
  g.fillStyle = "#d89c7c"; g.beginPath(); g.ellipse(hx + 2 + sh, hy + 8, 4, 5, 0, 0, 7); g.fill();
}
function panelDraw(P, off, who, t, bgFn, ringing) {
  const x = P.x + off, { y, w, h } = P;
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.translate(x, y); g.scale(.5, .5); g.imageSmoothingEnabled = false;
  g.drawImage(panelCache[who] ??= hiCanvas(bgFn), 0, 0);
  if (who === "myrra") {                            // tihkusade Kouvolan ikkunassa (harmaata, tietysti)
    g.save(); g.beginPath(); g.rect(178, 12, 112, 84); g.clip();
    for (let i = 0; i < 32; i++) { const rx = 178 + ((i * 37 + t / 9) % 112), ry = 12 + ((i * 53 + t / 4) % 84); r(rx, ry, 1, 4, "rgba(98,98,100,.7)"); }
    g.restore();
  } else glow(150, 150, 80, "255,200,120", .12);
  const talk = speaking === who && Math.floor(t / 110) % 2 === 1, blink = (t + (who === "myrra" ? 1700 : 0)) % 3700 < 130, bob = speaking === who ? Math.round(Math.sin(t / 140)) : 0;
  const B = PIXFACES[who].bust, bimg = faceCache[`bust|${who}`] ??= renderPix(B, {}), face = faceImg(who, "portrait", { talk, blink });
  const bx = who === "myrra" ? 52 : 168, by = PH - bimg.height + 2;
  if (who === "jussi") {                           // kuva on kapea: pelipaita jatkuu hartioihin
    fillPoly([[bx + 10, by + 76], [bx - 30, by + 92], [bx - 40, PH], [bx + 20, PH]], "#f8d838"); fillPoly([[bx + 66, by + 76], [bx + 110, by + 92], [bx + 120, PH], [bx + 56, PH]], "#e8c428");
    fillPoly([[bx - 30, by + 92], [bx - 18, by + 88], [bx - 26, PH], [bx - 40, PH]], "#d8b420");
  }
  g.drawImage(bimg, bx, by + bob); g.drawImage(face, bx + B.head_at[0], by + B.head_at[1] + bob);
  if (who === "myrra") phoneArm(bx + 22, by + 120, bx + 2, by + 150, bx + B.head_at[0] + 8, by + B.head_at[1] + 54 + bob, "#1c1c22", "#0c0c10", "#f4f4f4", t, ringing);
  else phoneArm(bx + 96, by + 98, bx + 108, PH - 4, bx + B.head_at[0] + 62, by + B.head_at[1] + 54 + bob, "#f8d838", "#c8a418", null, t, ringing);
  g.restore();
  g.strokeStyle = "#0c0a10"; g.lineWidth = 3; g.strokeRect(x - 1, y - 1, w + 2, h + 2); g.strokeStyle = "#fcf0c8"; g.lineWidth = 1; g.strokeRect(x + .5, y + .5, w - 1, h - 1);
}
// Jussin hehkulamppu: väärinymmärrys syttyy.
function bulb(x, y, t, since) {
  const on = since < 6000, k = Math.max(.05, Math.min(1, since / 250)); if (!on) return;
  glow(x, y, 26 * k, "255,240,140", .5);
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + t / 900, r0 = 10, r1 = 15 + Math.sin(t / 90 + i) * 2; lineC(x + Math.cos(a) * r0, y + Math.sin(a) * r0, x + Math.cos(a) * r1, y + Math.sin(a) * r1, "#fcf09c"); }
  disc(x, y, 6, "#fcf4a0", "#e8c83c"); r(x - 3, y + 5, 6, 4, "#9c9ca8"); r(x - 3, y + 6, 6, 1, "#6c6c78"); r(x - 3, y + 8, 6, 1, "#6c6c78"); px(x - 2, y - 3, "#ffffff");
}
// Puhelu: lines = [[puhuja, teksti] | { bulb: true }]. Puhujat "jussi" ja "myrra".
async function phoneCall(lines, { incoming = false } = {}) {
  const t0 = performance.now(); let state = "ring", stT = t0, bulbT = null;
  const slide = (side) => { const t = performance.now(); if (state === "ring") return side * -170 * (1 - ease((t - stT - 700) / 450)); if (state === "out") return side * -170 * ease((t - stT) / 420); return 0; };
  overlay = (t) => {
    const now = performance.now();               // ajastus aina tällä kellolla (rAF:n t voi erota)
    room().draw(t); g.fillStyle = `rgba(8,6,16,${Math.min(.8, (now - t0) / 600)})`; g.fillRect(0, 0, W, H);
    const ringing = state === "ring" && now - stT < 1300;
    panelDraw(PANEL.L, slide(-1), "jussi", t, kisaPanel, ringing && !incoming);
    panelDraw(PANEL.R, slide(1), "myrra", t, coachPanel, ringing);
    if (ringing) {                                   // soittoääni: sarjakuvan RIIING keskellä
      const s = 1 + Math.sin(t / 60) * .06; g.save(); g.translate(160, 22); g.scale(s, s); g.rotate(Math.sin(t / 80) * .05);
      g.font = "bold 16px VT323, monospace"; g.textAlign = "center"; g.lineWidth = 3; g.strokeStyle = "#0c0a10"; g.strokeText(incoming ? "RIIIING!" : "TUUT... TUUT...", 0, 0);
      g.fillStyle = "#fcd41c"; g.fillText(incoming ? "RIIIING!" : "TUUT... TUUT...", 0, 0); g.restore(); g.textAlign = "left";
    }
    if (bulbT) bulb(PANEL.L.x + 76 + slide(-1), PANEL.L.y + 26, t, performance.now() - bulbT);   // rAF:n t ja performance.now() voivat erota
    if (state === "out" && now - stT < 300) { g.font = "bold 14px VT323, monospace"; g.textAlign = "center"; g.fillStyle = "#fcfcfc"; g.fillText("KLIK.", 160, 24); g.textAlign = "left"; }
  };
  // soittoääni: kaksi sointia (lähtevä: pitkät tuuttaukset)
  for (let k = 0; k < 2; k++) { if (incoming) { [880, 1040, 880, 1040].forEach((f, n) => setTimeout(() => beep(f, 70, "square", .04), k * 600 + n * 75)); } else setTimeout(() => beep(425, 420, "sine", .05), k * 650); }
  await sleep(1300); state = "talk"; stT = performance.now();
  callSpk = { jussi: { x: PANEL.L.x + 104, y: PANEL.L.y + 2, c: "#f8d838" }, myrra: { x: PANEL.R.x + 62, y: PANEL.R.y + 2, c: "#ec7a2c" } };
  try {
    for (const l of lines) {
      if (l.bulb) { bulbT = performance.now(); [523, 659, 784, 1047].forEach((f, n) => setTimeout(() => beep(f, 160, "triangle", .06), n * 90)); await sleep(500); continue; }
      await say(l[1], l[0]); if (bulbT && l[0] === "jussi") bulbT = null;   // lamppu sammuu ahaa-repliikin jälkeen
    }
  } finally {
    callSpk = null; beep(220, 90, "square", .05); state = "out"; stT = performance.now(); await sleep(520); overlay = null;
  }
}
