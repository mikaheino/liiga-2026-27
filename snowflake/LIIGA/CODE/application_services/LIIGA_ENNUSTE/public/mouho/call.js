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

// Kisapuiston sisäänkäynti illalla lähempää: katos ja kyltti, lämmin aula, märkä asfaltti.
function kisaPanel() {
  vgrad(0, 0, PW, 64, ["#181a3c", "#2a2654", "#4a3066", "#7c4064", "#b45c5c", "#e0904e"]);
  for (let i = 0; i < 26; i++) { const x = (rnd() * PW) | 0, y = 4 + ((rnd() * 40) | 0), w = 6 + ((rnd() * 26) | 0); r(x, y, w, 1, y > 26 ? "#5c3456" : "#3a2c58"); r(x + 2, y + 1, w - 4, 1, y > 26 ? "#f0a070" : "#c8607c"); }
  for (let x = -4; x < PW; x += 5 + ((rnd() * 6) | 0)) { const h = 14 + ((rnd() * 20) | 0); r(x + 3, 70 - h, 2, h, "#1a1626"); for (let j = 0; j < h; j += 3) r(x + 3 - Math.min(5, j / 3), 70 - h + j, 2 + Math.min(10, j / 1.5), 3, "#1c2230"); }
  for (const [x, y] of [[30, 40], [250, 36], [140, 46]]) for (let k = 0; k < 90; k++) { const a = rnd() * 6.3, d = rnd() * 12; px(x + Math.cos(a) * d * 1.3, y + Math.sin(a) * d, rnd() > .5 ? "#e8b848" : "#c8902c"); }
  // harmaa aaltopeltiseinä ja keltainen lohko vasemmalla
  r(0, 34, PW, 76, "#7c7a92"); for (let x = 0; x < PW; x += 4) r(x, 34, 1, 76, "#6c6a84"); r(0, 34, PW, 2, "#a4a2bc");
  r(0, 8, 62, 102, "#d8a42c"); for (let x = 2; x < 62; x += 4) r(x, 8, 1, 102, "#c8962a"); r(0, 8, 62, 2, "#f8d060"); r(61, 8, 2, 102, "#9c7424"); dither(0, 80, 62, 30, "#d8a42c", "#b4842c", .4);
  r(10, 30, 44, 34, "#f4dc5c"); text3("SAIPA", 14, 34, "#3c2c10", 2); text3("1948", 18, 48, "#3c2c10", 2);
  // katos ja kyltti
  r(0, 102, PW, 22, "#22202c"); r(0, 102, PW, 2, "#46445a"); r(0, 122, PW, 2, "#14121a");
  fillPoly([[0, 104], [14, 104], [8, 122], [0, 122]], "#e8b83c"); fillPoly([[286, 104], [300, 104], [300, 122], [292, 122]], "#e8b83c");
  const sign = "TERVETULOA KISAPUISTOON"; text3(sign, 150 - text3w(sign, 2) / 2, 108, "#f4f0e0", 2);
  // aula: lasiovet, kattovalot, ihmisiä
  r(0, 124, PW, 46, "#3a3448"); for (let x = 6; x < PW - 4; x += 36) { r(x, 128, 32, 40, "#f0c87c"); vgrad(x, 128, 32, 40, ["#fce8b0", "#f0c87c", "#d8a860"]); r(x + 15, 128, 2, 40, "#8c6c3c"); r(x, 146, 32, 1, "#c8a060"); }
  for (const x of [40, 120, 170, 236]) { r(x, 146, 6, 20, "#3c2c24"); disc(x + 3, 142, 3, "#3c2c24"); }
  for (const x of [26, 262]) r(x, 124, 4, 48, "#9c9cac");
  // märkä asfaltti, aulan heijastukset, reunakivi
  vgrad(0, 170, PW, 18, ["#2e2a42", "#1a1926"]); r(0, 170, PW, 1, "#5c5870");
  for (let x = 6; x < PW; x += 36) for (let y = 172; y < PH; y += 2) if (bay(x, y) < .6) r(x + 4 + ((y * 7) % 5), y, 20 - (y - 172), 1, "rgba(240,200,124,.35)");
  // Jussin pahvilaatikko maassa vasemmalla
  r(14, 160, 40, 26, "#b8925c"); r(14, 160, 40, 2, "#d8b27c"); r(34, 160, 1, 26, "#8c6c3c"); r(20, 152, 8, 9, "#f4f4ec"); r(20, 152, 8, 2, "#c81c1c"); r(36, 150, 14, 8, "#c8a030"); text3("LIIGA", 22, 172, "#2c2c3c");
}
// Myrrän valmentajakoppi lähempää: kello, taktiikkataulu, kaapit pelipaitoineen, mailat,
// hylly jolla hopeamitali ja joukkuekuva, pöytälamppu, puoliksi pakattu laatikko.
function coachPanel() {
  vgrad(0, 0, PW, 120, ["#262838", "#2e3046", "#2a2c3e"]); r(0, 120, PW, 68, "#4c3424"); for (let x = 0; x < PW; x += 16) r(x, 120, 1, 68, "#3c281c"); r(0, 118, PW, 3, "#6c4c34");
  // kaapit vasemmalla, roikkuva pelipaita
  for (let k = 0; k < 3; k++) { const x = 4 + k * 34; r(x, 10, 32, 108, "#5c6274"); r(x, 10, 32, 2, "#7c8294"); r(x + 2, 14, 28, 10, "#4c5264"); for (let j = 0; j < 4; j++) r(x + 6, 16 + j * 2, 20, 1, "#3c4252"); r(x + 27, 60, 2, 12, "#9ca2b4"); }
  fillPoly([[44, 40], [62, 34], [80, 40], [86, 54], [76, 56], [76, 92], [48, 92], [48, 56], [38, 54]], "#e8782c"); r(48, 70, 28, 3, "#1c1c24"); text3("5", 58, 46, "#1c1c24", 2);
  // kello
  disc(130, 22, 11, "#f4f0e4", "#3c3c44"); lineC(130, 22, 130, 15, "#1c1c24"); lineC(130, 22, 135, 24, "#1c1c24"); px(130, 22, "#c81c1c");
  // taktiikkataulu
  r(150, 10, 140, 78, "#9c9ca4"); r(153, 13, 134, 72, "#f4f4f0"); g.strokeStyle = "#e0a0a0"; g.lineWidth = 1; g.strokeRect(160.5, 18.5, 120, 62); r(220, 18, 1, 62, "#e0a0a0"); g.beginPath(); g.arc(220.5, 49.5, 10, 0, 7); g.stroke();
  for (const [x, y] of [[176, 30], [196, 66], [252, 36], [268, 62]]) { lineC(x - 3, y - 3, x + 3, y + 3, "#c81c1c", 2); lineC(x + 3, y - 3, x - 3, y + 3, "#c81c1c", 2); }
  for (const [x, y] of [[186, 48], [238, 28], [260, 50]]) { g.strokeStyle = "#1c3c9c"; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 4, 0, 7); g.stroke(); }
  lineC(178, 34, 232, 44, "#1c3c9c", 1.5); lineC(232, 44, 248, 30, "#1c3c9c", 1.5); lineC(198, 62, 256, 40, "#c81c1c", 1.5); r(240, 86, 30, 3, "#5c5c64");
  // hylly: hopeamitali, joukkuekuva
  r(150, 98, 90, 4, "#6c4c2c"); r(156, 74, 1, 14, "#c8c8d0"); disc(156, 92, 6, "#d8d8e0", "#9c9ca8"); px(154, 90, "#ffffff"); r(170, 82, 26, 16, "#3c2c1c"); r(172, 84, 22, 12, "#8ca0b4"); for (let k = 0; k < 5; k++) disc(175 + k * 4, 92, 1, "#e8c0a0");
  r(206, 88, 10, 10, "#e8e4dc"); r(216, 90, 2, 5, "#e8e4dc");
  // pöytälamppu
  r(256, 112, 24, 3, "#3c3c44"); r(266, 90, 2, 22, "#3c3c44"); fillPoly([[256, 84], [276, 84], [282, 94], [250, 94]], "#c87c2c");
  // mailat nojaamassa
  for (const x of [118, 128]) { lineC(x, 60, x + 6, 150, "#c8a46c", 3); r(x + 4, 148, 12, 4, "#1c1c24"); }
  // pahvilaatikko edessä oikealla: pilli, kahvikuppi, taktiikkalevy, oranssi pyyhe
  r(196, 140, 90, 48, "#b8925c"); r(196, 140, 90, 3, "#d8b27c"); r(240, 140, 2, 48, "#8c6c3c");
  fillPoly([[196, 140], [186, 126], [222, 126], [230, 140]], "#c8a26c"); fillPoly([[286, 140], [296, 126], [258, 126], [250, 140]], "#a8824c");
  r(204, 124, 30, 18, "#1c1c24"); r(206, 126, 26, 14, "#f0f0ec"); r(240, 122, 10, 16, "#e8e4dc"); r(240, 122, 10, 2, "#c81c1c"); r(256, 128, 22, 6, "#e8782c"); disc(274, 124, 3, "#c8c8d0");
}
let panelCache = {};
// Rintakuva (laitepikseleissä): hartiat ja asu muotokuvan alle.
function bust(who, cx, top) {
  if (who === "myrra") {
    fillPoly([[cx - 46, PH], [cx - 38, top + 14], [cx - 12, top], [cx + 12, top], [cx + 38, top + 14], [cx + 46, PH]], "#1c1c22");
    fillPoly([[cx - 14, top], [cx + 14, top], [cx + 8, PH], [cx - 8, PH]], "#141418");
    fillPoly([[cx - 16, top], [cx - 4, top], [cx - 8, top + 14]], "#f4f4f4"); fillPoly([[cx + 16, top], [cx + 4, top], [cx + 8, top + 14]], "#f4f4f4");
    lineC(cx - 20, top + 8, cx - 10, PH, "#34343c", 2); lineC(cx + 20, top + 8, cx + 10, PH, "#34343c", 2); return; }
  fillPoly([[cx - 46, PH], [cx - 38, top + 14], [cx - 12, top], [cx + 12, top], [cx + 38, top + 14], [cx + 46, PH]], "#c8a460");
  fillPoly([[cx + 16, top + 6], [cx + 38, top + 14], [cx + 46, PH], [cx + 24, PH]], "#b8944c");
  r(cx - 14, top - 2, 28, 6, "#fcd41c"); r(cx - 1, top + 4, 2, PH - top, "#a88440"); for (let y = top + 14; y < PH; y += 12) r(cx + 3, y, 2, 2, "#5c3c1c");
}
// Käsi ja kännykkä korvalla (side: -1 vasen, 1 oikea), laitepikseleissä.
function phoneHand(cx, cy, side, t, ringing) {
  const sh = ringing ? Math.round(Math.sin(t / 25) * 2) : 0, x = cx + side * 30 + sh;
  r(x - 5, cy - 16, 11, 24, "#1c1c24"); r(x - 3, cy - 14, 7, 18, ringing && (t / 120 | 0) % 2 ? "#9cf0fc" : "#3c5c7c");
  disc(x, cy + 10, 7, "#f0bc9c", "#c88c70"); r(x - 4 - side * 4, cy + 12, 9, 14, "#f0bc9c");
}
function panelDraw(P, off, who, t, bgFn, ringing) {
  const x = P.x + off, { y, w, h } = P;
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.translate(x, y); g.scale(.5, .5);
  g.drawImage(panelCache[who] ??= hiCanvas(bgFn), 0, 0);
  if (who === "myrra") glow(266, 98, 40, "255,190,110", .25); else glow(150, 150, 70, "255,200,120", .12);
  const cx = who === "myrra" ? 84 : 220, talk = speaking === who && Math.floor(t / 110) % 2 === 1, blink = (t + (who === "myrra" ? 1700 : 0)) % 3700 < 130;
  const img = faceImg(who, "portrait", { talk, blink }), bob = speaking === who ? Math.round(Math.sin(t / 140)) : 0, top = PH - 70;
  bust(who, cx, top + 4);
  g.imageSmoothingEnabled = false; g.drawImage(img, Math.round(cx - img.width / 2), top - img.height + 14 + bob);
  phoneHand(cx, top - 32 + bob, who === "myrra" ? -1 : 1, t, ringing);
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
    if (bulbT) bulb(PANEL.L.x + 128 + slide(-1), PANEL.L.y + 14, t, performance.now() - bulbT);   // rAF:n t ja performance.now() voivat erota
    if (state === "out" && now - stT < 300) { g.font = "bold 14px VT323, monospace"; g.textAlign = "center"; g.fillStyle = "#fcfcfc"; g.fillText("KLIK.", 160, 24); g.textAlign = "left"; }
  };
  // soittoääni: kaksi sointia (lähtevä: pitkät tuuttaukset)
  for (let k = 0; k < 2; k++) { if (incoming) { [880, 1040, 880, 1040].forEach((f, n) => setTimeout(() => beep(f, 70, "square", .04), k * 600 + n * 75)); } else setTimeout(() => beep(425, 420, "sine", .05), k * 650); }
  await sleep(1300); state = "talk"; stT = performance.now();
  callSpk = { jussi: { x: PANEL.L.x + 110, y: PANEL.L.y + 2, c: "#c8a460" }, myrra: { x: PANEL.R.x + 42, y: PANEL.R.y + 2, c: "#9c9690" } };
  try {
    for (const l of lines) {
      if (l.bulb) { bulbT = performance.now(); [523, 659, 784, 1047].forEach((f, n) => setTimeout(() => beep(f, 160, "triangle", .06), n * 90)); await sleep(500); continue; }
      await say(l[1], l[0]); if (bulbT && l[0] === "jussi") bulbT = null;   // lamppu sammuu ahaa-repliikin jälkeen
    }
  } finally {
    callSpk = null; beep(220, 90, "square", .05); state = "out"; stT = performance.now(); await sleep(520); overlay = null;
  }
}
