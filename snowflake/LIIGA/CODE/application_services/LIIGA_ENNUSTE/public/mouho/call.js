// Mouhon salaisuus -- puheluanimaatio (vaihe 2, 17.10.: "Myrrä puhelimessa, mutta erillisellä
// hienolla animaatiolla"). Sarjakuvamainen jaettu ruutu: vasemmalla Jussi Kisapuistossa,
// oikealla Myrrä valmentajakopissa pakkaamassa tavaroitaan (IS 7.10.: "kamojani tästä juuri
// pakkailen valmentajakopista") -- kaksi juuri vapautunutta miestä, laatikot kummallakin.
// Soittoääni, paneelit liukuvat sisään, muotokuvat puhuvat ja räpsyttävät, Jussin
// väärinymmärrys syttyy hehkulamppuna, "KLIK" ja paneelit liukuvat ulos.
"use strict";

const PANEL = { L: { x: 6, y: 40, w: 150, h: 94 }, R: { x: 164, y: 40, w: 150, h: 94 } };
const ease = (k) => 1 - Math.pow(1 - Math.max(0, Math.min(1, k)), 3);

// Myrrän valmentajakoppi (150 x 94, välimuistiin): taulu kuvioineen, kaapit, hylly jolla
// hopeamitali, lämmin pöytälamppu, puoliksi pakattu pahvilaatikko edessä.
function coachRoom() {
  const c = document.createElement("canvas"); c.width = 150; c.height = 94; const prev = g; g = c.getContext("2d");
  vgrad(0, 0, 150, 70, ["#2a2c3c", "#30324a", "#2a2c3c"]); r(0, 70, 150, 24, "#3c2c24"); dither(0, 70, 150, 3, "#3c2c24", "#2c201a", .5);
  for (let x = 0; x < 150; x += 12) r(x, 70, 1, 24, "#33241e");
  // taktiikkataulu: rinkka, X:t ja O:t, nuolet
  r(8, 8, 62, 38, "#9c9ca4"); r(10, 10, 58, 34, "#f0f0ec"); r(10, 26, 58, 1, "#e0a0a0"); g.strokeStyle = "#e0a0a0"; g.lineWidth = 1; g.beginPath(); g.arc(39.5, 26.5, 6, 0, 7); g.stroke();
  for (const [x, y] of [[20, 16], [30, 36], [52, 18]]) { px(x, y, "#c81c1c"); px(x + 1, y + 1, "#c81c1c"); px(x + 1, y, "#c81c1c"); px(x, y + 1, "#c81c1c"); }
  for (const [x, y] of [[24, 30], [44, 14], [58, 34]]) { r(x, y, 3, 1, "#1c3c9c"); r(x, y + 2, 3, 1, "#1c3c9c"); px(x - 1, y + 1, "#1c3c9c"); px(x + 3, y + 1, "#1c3c9c"); }
  lineC(22, 18, 40, 24, "#1c3c9c"); lineC(40, 24, 46, 16, "#1c3c9c"); lineC(32, 34, 54, 22, "#c81c1c");
  // kaapit oikealla
  for (let k = 0; k < 3; k++) { const x = 96 + k * 18; r(x, 6, 16, 64, "#5c6274"); r(x, 6, 16, 1, "#7c8294"); r(x + 1, 8, 14, 6, "#4c5264"); for (let j = 0; j < 4; j++) r(x + 4, 9 + j, 8, 1, "#3c4252"); r(x + 13, 36, 1, 6, "#9ca2b4"); }
  // hylly: hopeamitali ja kahvikuppi
  r(74, 22, 20, 2, "#6c4c2c"); r(80, 12, 1, 6, "#c8c8d0"); disc(80, 19, 3, "#d8d8e0", "#9c9ca8"); px(79, 18, "#fcfcfc"); r(86, 17, 5, 5, "#e8e4dc"); r(91, 18, 1, 3, "#e8e4dc");
  // pöytälamppu ja hehku
  r(76, 54, 12, 2, "#3c3c44"); r(81, 42, 1, 12, "#3c3c44"); fillPoly([[76, 38], [86, 38], [90, 44], [72, 44]], "#c87c2c");
  // pahvilaatikko edessä: pilli, kahvikuppi, taktiikkalevy, oranssi pyyhe
  r(4, 64, 44, 30, "#b8925c"); r(4, 64, 44, 2, "#d8b27c"); r(25, 64, 1, 30, "#8c6c3c");
  fillPoly([[4, 64], [-2, 56], [20, 56], [24, 64]], "#c8a26c"); fillPoly([[48, 64], [54, 56], [32, 56], [28, 64]], "#a8824c");
  r(10, 56, 16, 9, "#1c1c24"); r(11, 57, 14, 7, "#f0f0ec"); r(30, 56, 6, 8, "#e8e4dc"); r(30, 56, 6, 1, "#c81c1c"); r(38, 58, 8, 3, "#e8782c");
  g = prev; return c;
}
let coachCache = null;

// Rintakuva: hartiat ja asu muotokuvan alle (asut kuten vartaloissa).
function bust(who, cx, by) {
  if (who === "myrra") { fillPoly([[cx - 34, by], [cx - 24, by - 16], [cx + 24, by - 16], [cx + 34, by]], "#1c1c22"); fillPoly([[cx - 8, by - 16], [cx + 8, by - 16], [cx + 4, by], [cx - 4, by]], "#141418");
    fillPoly([[cx - 9, by - 16], [cx - 2, by - 16], [cx - 4, by - 10]], "#f4f4f4"); fillPoly([[cx + 9, by - 16], [cx + 2, by - 16], [cx + 4, by - 10]], "#f4f4f4"); return; }
  fillPoly([[cx - 34, by], [cx - 24, by - 16], [cx + 24, by - 16], [cx + 34, by]], "#c8a460"); r(cx - 8, by - 17, 16, 3, "#fcd41c"); r(cx - 1, by - 14, 2, 14, "#a88440");
}
// Käsi ja kännykkä korvalla (side: -1 vasen, 1 oikea).
function phoneHand(cx, cy, side, t, ringing) {
  const sh = ringing ? Math.round(Math.sin(t / 25)) : 0, x = cx + side * 29 + sh;
  r(x - 3, cy - 10, 7, 15, "#1c1c24"); r(x - 2, cy - 9, 5, 11, ringing && (t / 120 | 0) % 2 ? "#9cf0fc" : "#3c5c7c");
  disc(x, cy + 8, 5, "#f0bc9c", "#c88c70"); r(x - 2 - side * 2, cy + 10, 5, 8, "#f0bc9c");
}
function panelDraw(P, off, who, t, bg, ringing) {
  const x = P.x + off, { y, w, h } = P;
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  bg(x, y);
  const cx = x + w / 2, talk = speaking === who && Math.floor(t / 110) % 2 === 1, blink = (t + (who === "myrra" ? 1700 : 0)) % 3700 < 130;
  bust(who, cx, y + h);
  const img = faceImg(who, "portrait", { talk, blink }), bob = speaking === who ? Math.round(Math.sin(t / 140)) : 0;
  g.imageSmoothingEnabled = false; g.drawImage(img, Math.round(cx - img.width / 2), y + h - 16 - img.height + 6 + bob);
  phoneHand(cx, y + h - 54, who === "myrra" ? -1 : 1, t, ringing);
  g.restore();
  // sarjakuvaruudun kehys
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
  const kisaBgPanel = (x, y) => { g.drawImage(paintBg("kisapuisto", kisaBg), 82, 18, 150, 94, x, y, 150, 94); };
  const coachBg = (x, y) => { coachCache ??= coachRoom(); g.drawImage(coachCache, x, y); glow(x + 81, y + 46, 30, "255,190,110", .22); };
  overlay = (t) => {
    const now = performance.now();               // ajastus aina tällä kellolla (rAF:n t voi erota)
    room().draw(t); g.fillStyle = `rgba(8,6,16,${Math.min(.8, (now - t0) / 600)})`; g.fillRect(0, 0, W, H);
    const ringing = state === "ring" && now - stT < 1300;
    panelDraw(PANEL.L, slide(-1), "jussi", t, kisaBgPanel, ringing && !incoming);
    panelDraw(PANEL.R, slide(1), "myrra", t, coachBg, ringing);
    if (ringing) {                                   // soittoääni: sarjakuvan RIIING keskellä
      const s = 1 + Math.sin(t / 60) * .06; g.save(); g.translate(160, 22); g.scale(s, s); g.rotate(Math.sin(t / 80) * .05);
      g.font = "bold 16px VT323, monospace"; g.textAlign = "center"; g.lineWidth = 3; g.strokeStyle = "#0c0a10"; g.strokeText(incoming ? "RIIIING!" : "TUUT... TUUT...", 0, 0);
      g.fillStyle = "#fcd41c"; g.fillText(incoming ? "RIIIING!" : "TUUT... TUUT...", 0, 0); g.restore(); g.textAlign = "left";
    }
    if (bulbT) bulb(PANEL.L.x + PANEL.L.w - 22 + slide(-1), PANEL.L.y + 18, t, performance.now() - bulbT);   // rAF:n t ja performance.now() voivat erota
    if (state === "out" && now - stT < 300) { g.font = "bold 14px VT323, monospace"; g.textAlign = "center"; g.fillStyle = "#fcfcfc"; g.fillText("KLIK.", 160, 24); g.textAlign = "left"; }
  };
  // soittoääni: kaksi sointia (lähtevä: pitkät tuuttaukset)
  for (let k = 0; k < 2; k++) { if (incoming) { [880, 1040, 880, 1040].forEach((f, n) => setTimeout(() => beep(f, 70, "square", .04), k * 600 + n * 75)); } else setTimeout(() => beep(425, 420, "sine", .05), k * 650); }
  await sleep(1300); state = "talk"; stT = performance.now();
  callSpk = { jussi: { x: PANEL.L.x + PANEL.L.w / 2, y: PANEL.L.y + 2, c: "#c8a460" }, myrra: { x: PANEL.R.x + PANEL.R.w / 2, y: PANEL.R.y + 2, c: "#9c9690" } };
  try {
    for (const l of lines) {
      if (l.bulb) { bulbT = performance.now(); [523, 659, 784, 1047].forEach((f, n) => setTimeout(() => beep(f, 160, "triangle", .06), n * 90)); await sleep(500); continue; }
      await say(l[1], l[0]); if (bulbT && l[0] === "jussi") bulbT = null;   // lamppu sammuu ahaa-repliikin jälkeen
    }
  } finally {
    callSpk = null; beep(220, 90, "square", .05); state = "out"; stT = performance.now(); await sleep(520); overlay = null;
  }
}
