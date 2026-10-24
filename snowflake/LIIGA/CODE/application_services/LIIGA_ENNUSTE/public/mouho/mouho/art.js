"use strict";
// Mouhon salaisuus -- grafiikka. Kaikki piirretään koodilla (ei kuvatiedostoja).
// Käyttää engine.js:n piirtokirjastoa: r, px, vgrad, dither, disc, tri, glow, shadow, paintBg.

// Jussi: iso pää (karikatyyri hockeydb-kuvan mukaan): lyhyet vaaleat sivulle
// harjatut hiukset, siniset silmät, leveä hymy hampaineen, vahva leuka.
// Vartalo pieni, pää 14 x 15 px. Fedora ja ruoska näkyvät kun ne on hankittu.
function jussi(x, y, dir, frame, st, sc = 1, back = false) {
  g.save(); g.translate(x | 0, y | 0); g.scale(dir < 0 ? -sc : sc, sc);
  const p = (dx, dy, w, h, c) => r(dx, dy, w, h, c);          // origo: jalkojen keskikohta
  const step = frame % 4, l1 = step === 1 ? 2 : step === 3 ? -1 : 0, l2 = -l1;
  const SK = "#f0b890", SKD = "#d89870";
  // jalat ja saappaat
  p(-4 + l1, -10, 3, 9, "#4c3c24"); p(1 + l2, -10, 3, 9, "#3c2c1c");
  p(-5 + l1, -2, 4, 2, "#201408"); p(1 + l2, -2, 4, 2, "#201408");
  // vartalo: khakipaita, keltainen kaulus (SaiPa), vyö
  p(-5, -21, 10, 11, "#c8a460"); p(-5, -12, 10, 2, "#5c3c1c"); p(-1, -20, 1, 7, "#a88440");
  p(-3, -22, 6, 2, "#fcd41c"); p(-1, -21, 2, 2, "#fcd41c");
  p(-7, -20, 2, 8, "#c8a460"); p(5, -20, 2, 8, "#b8944c"); p(-7, -13, 2, 2, SK); p(5, -13, 2, 2, SKD);
  if (st.whip) { p(3, -15, 3, 3, "#6c4420"); p(4, -14, 1, 1, "#3c2410"); }
  // kaula ja bobblehead-pää (faces.js): tunnistettava Jussi, keinuu kävellessä
  p(-2, -23, 4, 2, SKD);
  head("jussi", 0, -21, performance.now(), { talking: st.talk ?? speaking === "jussi", moving: frame !== 0, back });
  if (st.hat) { p(-13, -40, 26, 2, "#6c4c2c"); p(-12, -40, 24, 1, "#8c6c44"); p(-8, -48, 16, 8, "#7c5c34"); p(-8, -42, 16, 2, "#3c2414"); p(-2, -48, 4, 1, "#5c3c1c"); p(-8, -48, 2, 6, "#94744c"); }
  g.restore();
}
// ================================================================ RUUTUJEN TAITEET
// ---- ruutujen apuhahmot (ruudut itse: rooms.js) ---------------------------------
function turkFlag(x, y) { r(x, y, 9, 6, "#e30a17"); disc(x + 3, y + 3, 2, "#fcfcfc"); disc(x + 4, y + 3, 1, "#e30a17"); px(x + 6, y + 3, "#fcfcfc"); px(x + 6, y + 2, "#fcfcfc"); px(x + 7, y + 3, "#fcfcfc"); }
function figure(x, y, c, fez, t, v) { const st2 = Math.floor(t / 180) % 2; r(x - 2, y - 12, 5, 8, c); disc(x, y - 14, 2, c); if (fez) r(x - 1, y - 17, 3, 2, "#7c1c1c"); r(x - 2 + (st2 ? 1 : 0), y - 4, 2, 4, c); r(x + 1 - (st2 ? 1 : 0), y - 4, 2, 4, c); }
// Mehmet ja salkkumies samalla bobblehead-mitalla kuin muut (backlog 5.2): faces.js npc().
function merchant(x, y, t, talking = false) { npc(6, x, y, t, { talking, dir: -1 }); }
function flame(x, y, t) { const f = (Math.sin(t / 70 + x) + Math.sin(t / 113 + x * 2)) / 2; r(x, y, 3, 10, "#4c2c14"); r(x - 1, y - 1, 5, 2, "#3c3c3c");
  const h = 6 + f * 2; r(x - 1, y - h, 5, h, "#c83c0c"); r(x, y - h - 2, 3, h, "#fc8c1c"); r(x + 1, y - h - 3 + (f > 0 ? 1 : 0), 1, h - 1, "#fcfc7c");
  if (Math.sin(t / 37 + x) > .9) px(x + 1 + Math.sin(t / 50) * 2, y - h - 6, "#fcc040"); }
function mapBg() {
  noise(0, 0, W, H, "#e4d0a0", ["#d8c490", "#ecdcb0", "#d0b884"], .35);
  const land = (pts, c) => { g.fillStyle = c; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill(); };
  land([[100, 4], [150, 2], [160, 30], [150, 52], [128, 58], [112, 48], [104, 26]], "#a8c08c");
  land([[40, 60], [120, 56], [170, 64], [200, 70], [150, 84], [110, 92], [60, 86]], "#b4c894");
  land([[180, 86], [300, 80], [316, 104], [280, 120], [200, 116], [176, 100]], "#bccc8c");
  g.fillStyle = "#8cb0c8"; g.fillRect(150, 82, 40, 8); g.fillRect(110, 96, 90, 40);
  g.fillStyle = "#4c3c24"; g.font = "10px VT323, monospace"; g.fillText("SUOMI", 118, 26); g.fillText("Helsinki", 112, 46); r(126, 39, 2, 2, "#4c3c24"); g.fillText("TURKKI", 232, 100); g.fillText("Mustameri", 196, 78); g.fillText("Istanbul", 206, 92);
  r(198, 88, 1, 8, "#4c3c24"); turkFlag(199, 88);
  for (const [bx, by, c] of [[262, 108, "#c83c3c"], [272, 104, "#e8b41c"], [282, 110, "#3c7cc8"]]) { disc(bx, by, 3, c); r(bx - 1, by + 4, 3, 2, "#6c4c24"); px(bx - 2, by + 3, "#4c3c24"); px(bx + 2, by + 3, "#4c3c24"); }
  g.fillText("Kappadokia", 254, 122);
  r(286, 10, 1, 18, "#5c4c34"); r(278, 18, 17, 1, "#5c4c34"); g.fillText("P", 284, 8);
  g.strokeStyle = "#8c6c44"; g.strokeRect(2.5, 2.5, W - 5, H - 5);
}
// Lentomatka: prologue.js (travel, Euroopan kartta).
// Loppu: Mouho 2026, Kaivokatu 10, 4. krs (recordlydata.com/events/mouho-2026):
// 2v2 NHL PS5:llä, 3 min erät, parit arvotaan, pizza n. 18.30 -- ja osallistuminen on ILMAINEN.
function mouhoBg() {
  vgrad(0, 0, W, 108, ["#1c1c2c", "#24243a", "#2c2c44"]);
  for (const x of [8, 250]) { r(x, 14, 62, 46, "#0c1430"); for (let k = 0; k < 14; k++) r(x + 4 + (k * 13) % 54, 22 + (k * 7) % 34, 3, 2 + (k % 3), k % 4 ? "#fcd45c" : "#8cacfc");
    r(x, 36, 62, 1, "#3c3c4c"); r(x + 30, 14, 2, 46, "#3c3c4c"); r(x - 2, 12, 66, 2, "#4c4c5c"); r(x - 2, 60, 66, 3, "#4c4c5c"); }
  r(0, 8, W, 3, "#3c3c54");
  r(92, 6, 136, 12, "#c81c1c"); r(92, 6, 136, 1, "#fc8c7c"); r(92, 7, 136, 1, "#fc5c5c"); r(92, 16, 136, 1, "#9c1010"); r(92, 17, 136, 1, "#5c0808"); r(92, 6, 1, 12, "#fc5c5c"); r(227, 6, 1, 12, "#5c0808");
  for (let x = 93; x < 227; x += 2) { px(x, 15 + (x % 4 ? 0 : 1), "#a81414"); px(x + 1, 9, "#d82c2c"); }
  g.textAlign = "center"; g.font = "11px VT323, monospace"; g.fillStyle = "#fcfc54"; g.fillText("MOUHO 2026 · 2v2 NHL", 160, 15); g.textAlign = "left";
  r(96, 24, 128, 70, "#0c0c0c"); r(98, 26, 124, 64, "#1c1c1c"); r(156, 94, 8, 6, "#2c2c2c"); r(140, 100, 40, 2, "#2c2c2c");
  r(186, 100, 18, 3, "#ececec"); r(187, 99, 16, 1, "#fcfcfc"); px(200, 100, "#3c7cfc");
  r(0, 102, W, 34, "#3c3448"); for (let y = 104; y < 136; y += 6) r(0, y, W, 1, "#342c40");
  r(60, 106, 200, 14, "#2c4c7c"); r(60, 104, 200, 4, "#3c5c8c"); r(56, 104, 8, 18, "#24406c"); r(256, 104, 8, 18, "#24406c");
  for (const [x, y] of [[18, 118], [30, 114], [276, 116]]) { r(x, y, 20, 4, "#e8d8b8"); r(x, y, 20, 1, "#fcf0d8"); r(x + 6, y + 1, 8, 1, "#c81c1c"); }
  r(286, 96, 10, 10, "#e8c81c"); r(284, 94, 14, 3, "#fcd84c"); r(289, 106, 4, 4, "#c8a41c"); r(286, 110, 10, 2, "#8c6c1c"); px(288, 98, "#fcf4ac");
}
function rinkTV(t) {
  vgrad(100, 28, 120, 60, ["#c4dcf0", "#d4e8fa", "#e0f0fc", "#d0e4f6"]);
  for (let y = 36; y < 80; y += 3) for (let x = 100 + (y % 2) * 2; x < 220; x += 4) px(x, y, "#e8f4fe");
  r(100, 28, 120, 1, "#fcfcfc"); r(159, 28, 2, 60, "#c81c1c"); r(159, 28, 1, 60, "#fc5c5c"); r(130, 28, 1, 60, "#3c5cdc"); r(189, 28, 1, 60, "#3c5cdc");
  g.strokeStyle = "#c81c1c"; g.beginPath(); g.arc(160, 58, 10, 0, 7); g.stroke();
  r(101, 50, 4, 16, "#c81c1c"); r(215, 50, 4, 16, "#c81c1c"); r(101, 50, 1, 16, "#fc6c6c"); r(104, 50, 1, 16, "#7c0c0c"); r(215, 50, 1, 16, "#fc6c6c"); r(218, 50, 1, 16, "#7c0c0c");
  r(100, 28, 120, 6, "#2c2c4c"); for (let x = 101; x < 220; x += 3) { r(x, 30 + (x % 2), 2, 2, ["#c85c3c", "#5c7cc8", "#e8c85c", "#8c5ca8"][(x * 7) % 4]); px(x, 29, "#e8b890"); }
  r(100, 34, 120, 1, "#1c1c34");
  r(100, 80, 120, 3, "#e8ecf4"); r(100, 80, 120, 1, "#fcfcfc"); r(100, 82, 120, 1, "#8c94ac");
  const k = t / 900, puck = [160 + Math.sin(k) * 48, 58 + Math.sin(k * 1.7) * 18];
  const pl = (x, y, c, d) => { x = Math.round(x); y = Math.round(y);
    r(x - 2, y - 1, 5, 1, "#0c0c1c"); r(x - 2, y - 4, 5, 3, d); r(x - 2, y - 7, 5, 3, c); r(x - 2, y - 7, 1, 3, d); r(x - 1, y - 5, 3, 1, "#fcfcfc");
    r(x - 2, y - 10, 5, 3, "#f0c0a0"); r(x - 2, y - 11, 5, 2, d); px(x - 2, y - 9, d); px(x + 2, y - 9, d);
    r(x + 2, y - 2, 5, 1, "#8c5c2c"); px(x + 7, y - 1, "#1c1c1c"); px(x - 3, y - 6, "#f0c0a0"); px(x + 3, y - 6, "#f0c0a0"); };
  pl(puck[0] - 6 + Math.sin(k * 3) * 2, puck[1] + 2, "#d82c2c", "#841010"); pl(puck[0] + 8, puck[1] - 6, "#3c5cd8", "#1c2c84");
  pl(160 + Math.cos(k * .8) * 30, 40 + Math.sin(k) * 6, "#3c5cd8", "#1c2c84"); pl(140 + Math.sin(k * 1.3) * 22, 76, "#d82c2c", "#841010");
  r(puck[0], puck[1], 2, 1, "#000");
  r(100, 82, 120, 6, "#0c0c18"); r(100, 82, 120, 1, "#4c4c64"); r(100, 87, 120, 1, "#000"); r(100, 82, 1, 6, "#3c3c54");
  for (let x = 101; x < 219; x += 2) px(x, 85 + (x % 4 ? 0 : 1), "#1c1c30");
  g.font = "7px VT323, monospace"; g.fillStyle = "#fcfcfc"; g.fillText(`HOME 2  -  AWAY ${Math.floor(t / 7000) % 4}   3:00`, 104, 87);
  g.fillStyle = "rgba(255,255,255,.04)"; for (let y = 28; y < 88; y += 2) g.fillRect(100, y, 120, 1);
}
function host(x, y, t, shirt) { const b = Math.round(Math.sin(t / 450 + x) * .6); shadow(x, y, 6); r(x - 3, y - 8, 3, 8, "#2c2c3c"); r(x + 1, y - 8, 3, 8, "#2c2c3c");
  r(x - 4, y - 19 + b, 9, 11, shirt); disc(x, y - 23 + b, 4, "#e8b890"); r(x - 4, y - 27 + b, 9, 3, "#5c3c24"); px(x - 1, y - 23 + b, "#000"); px(x + 2, y - 23 + b, "#000"); r(x - 6, y - 16 + b, 2, 7, "#e8b890"); }
// Loppuanimaatio: kaivokatu.js.

// Salkkumies (Kisapuisto): liituraitapuku, aurinkolasit yölläkin, kultaketju, salkku.
// Pikseleinä samalla mittakaavalla kuin Jussi ja Mehmet.
function salesman(x, y, t, talking = false) { npc(7, x, y, t, { talking }); }

// Raimo Helminen -cameo: Ilveksen keltavihreä pelipaita, maila kädessä, luistelee
// sisään onnittelemaan 1985-visasta ja saman tien ulos. Pikseleinä Jussin mittakaavassa.
function helminen(x, y, t, talking = false, moving = false, dir = 1) {
  // SaiPan valmentaja: musta takki keltaisin raidoin, mustat housut (ei enää luistimia)
  g.save(); g.translate(x, y); g.scale(dir, 1); g.translate(-x, -y);
  const st2 = moving ? Math.floor(t / 110) % 4 : 0, l1 = st2 === 1 ? 2 : st2 === 3 ? -1 : 0;
  shadow(x, y, 7);
  r(x - 4 + l1, y - 11, 3, 10, "#1c1c22"); r(x + 1 - l1, y - 11, 3, 10, "#24242a"); r(x - 5 + l1, y - 2, 4, 2, "#0c0c10"); r(x + 1 - l1, y - 2, 4, 2, "#0c0c10");
  r(x - 6, y - 25, 12, 14, "#1c1c22"); r(x - 6, y - 25, 12, 2, "#fcd41c"); r(x - 1, y - 23, 1, 12, "#fcd41c"); r(x + 2, y - 21, 3, 2, "#fcd41c");
  r(x - 8, y - 24, 2, 10, "#1c1c22"); r(x + 6, y - 24, 2, 10, "#24242a"); r(x - 8, y - 18, 2, 1, "#fcd41c"); r(x + 6, y - 18, 2, 1, "#fcd41c"); r(x - 8, y - 14, 2, 2, "#e8b894"); r(x + 6, y - 14, 2, 2, "#d8a07c");
  r(x - 2, y - 27, 4, 2, "#d89c74");
  g.restore();
  head("raimo", x, y - 25, t, { talking, moving, dir, seedv: 3 });                       // pikselöity pää (pixfaces.js)
}
