// Mouhon salaisuus -- grafiikka. Kaikki piirretään koodilla (ei kuvatiedostoja).
// Käyttää engine.js:n piirtokirjastoa: r, px, vgrad, dither, disc, tri, glow, shadow, paintBg.
"use strict";

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
function merchant(x, y, t, talking = false) {
  const blink = Math.sin(t / 400) > .93, arm = Math.sin(t / 700) * 2;
  shadow(x, y, 9);
  r(x - 7, y - 22, 14, 22, "#8c1c1c"); r(x - 7, y - 22, 3, 22, "#a83030"); r(x + 4, y - 22, 3, 22, "#6c1414"); r(x - 7, y - 13, 14, 3, "#e8c81c"); px(x, y - 12, "#fcf09c");
  r(x - 7, y - 2, 14, 2, "#5c1010");
  r(x - 9, y - 20 + arm, 2, 8, "#8c1c1c"); r(x - 9, y - 12 + arm, 2, 2, "#d89060"); r(x + 7, y - 20, 2, 8, "#6c1414"); r(x + 7, y - 12, 2, 2, "#c88050");
  r(x - 4, y - 32, 9, 10, "#d89060"); r(x + 3, y - 31, 2, 8, "#c07850");
  r(x - 4, y - 25 + (talking && Math.floor(t / 120) % 2 ? 1 : 0), 9, 5, "#ececec");
  if (talking && Math.floor(t / 120) % 2) r(x - 1, y - 26, 3, 1, "#3c1c14"); r(x - 3, y - 21, 7, 2, "#d8d8d8"); r(x - 3, y - 27, 7, 1, "#3c2414");
  if (!blink) { px(x - 2, y - 29, "#000"); px(x + 2, y - 29, "#000"); } r(x - 3, y - 31, 3, 1, "#3c2414"); r(x + 1, y - 31, 3, 1, "#3c2414"); px(x, y - 27, "#a86040");
  r(x - 3, y - 37, 7, 5, "#c81c1c"); r(x - 3, y - 37, 7, 1, "#e83c3c"); r(x - 4, y - 33, 9, 1, "#9c1414");
  const tas = Math.round(Math.sin(t / 300) * 1.5); r(x + 3, y - 37, 1, 1, "#1c1c1c"); r(x + 4 + (tas > 0 ? 1 : 0), y - 36, 1, 3, "#1c1c1c");
}
function flame(x, y, t) { const f = (Math.sin(t / 70 + x) + Math.sin(t / 113 + x * 2)) / 2; r(x, y, 3, 10, "#4c2c14"); r(x - 1, y - 1, 5, 2, "#3c3c3c");
  const h = 6 + f * 2; r(x - 1, y - h, 5, h, "#c83c0c"); r(x, y - h - 2, 3, h, "#fc8c1c"); r(x + 1, y - h - 3 + (f > 0 ? 1 : 0), 1, h - 1, "#fcfc7c");
  if (Math.sin(t / 37 + x) > .9) px(x + 1 + Math.sin(t / 50) * 2, y - h - 6, "#fcc040"); }

// ---- alkuruutu, matka ja loppu --------------------------------------------------
// Alkuruutu: kesäpäivä satamatorin kioskilla (fiilis satamasanni.com-kuvista, ei logoja).
function tree(cx, cy, rad, seedv) {
  seed = seedv; const cols = ["#2c6c1c", "#3c8424", "#4c9c2c", "#6cb43c"];
  for (let k = 0; k < 26; k++) { const a = rnd() * 6.3, d = rnd() * rad, x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * .8; disc(x, y, 5 + rnd() * 6, cols[(rnd() * 2) | 0]); }
  for (let k = 0; k < 18; k++) { const a = rnd() * 6.3, d = rnd() * rad * .8, x = cx + Math.cos(a) * d - 3, y = cy + Math.sin(a) * d * .7 - 4; disc(x, y, 2 + rnd() * 3, cols[2 + ((rnd() * 2) | 0)]); }
}
function titleBg() {
  vgrad(0, 0, W, 70, ["#5c84c8", "#6c94d4", "#7ca4dc", "#90b4e4", "#a8c4ec"]);
  r(20, 40, 280, 16, "#6c7c8c"); for (let x = 20; x < 300; x += 6) r(x, 40, 3, 16, "#7c8c9c"); r(20, 38, 280, 2, "#5c6c7c");
  r(60, 56, 200, 20, "#c8c8c0"); for (let x = 64; x < 256; x += 14) r(x, 60, 9, 8, "#8c9cac");
  tree(46, 50, 30, 4); tree(160, 40, 30, 8); tree(276, 46, 32, 12);
  r(0, 72, W, 18, "#e8e4d8"); r(0, 72, W, 2, "#b8b4a8"); for (let x = 0; x < W; x += 22) r(x, 72, 1, 18, "#a8a49c");
  for (let x = 0; x < W; x += 12) r(x, 78, 8, 8, "#a8c4d0");
  // kioski
  r(112, 54, 96, 12, "#ece0c4"); r(112, 54, 96, 1, "#fcf4dc"); r(112, 65, 96, 1, "#8c7c5c"); r(159, 54, 2, 12, "#8c7c5c");
  g.fillStyle = "#2c1c10"; g.font = "9px VT323, monospace"; g.textAlign = "center"; g.fillText("VETYJÄ", 136, 63); g.fillText("ATOMEJA", 184, 63); g.textAlign = "left";
  for (let x = 112; x < 208; x += 6) { r(x, 66, 3, 10, "#fcd41c"); r(x + 3, 66, 3, 10, "#fcfcf0"); }
  for (let x = 112; x < 208; x += 3) tri(x, 76, 3, 2, (x / 3) % 2 ? "#fcfcf0" : "#fcd41c"); r(112, 66, 96, 1, "#e8b40c");
  r(114, 78, 92, 12, "#3c2c24"); r(118, 79, 20, 9, "#1c140c"); r(182, 79, 20, 9, "#1c140c"); r(142, 80, 10, 10, "#ece4cc"); r(166, 80, 10, 10, "#ece4cc");
  for (let k = 0; k < 3; k++) { r(143, 82 + k * 2, 8, 1, "#8c7c6c"); r(167, 82 + k * 2, 8, 1, "#8c7c6c"); } r(143, 87, 3, 2, "#c81c1c");
  r(114, 90, 92, 10, "#5c3c24"); for (let x = 114; x < 206; x += 4) r(x, 90, 1, 10, "#4c2c18");
  // tori: laatat ja vaaleat raidat
  vgrad(0, 100, W, 36, ["#a89488", "#b4a094", "#bca89c", "#c4b0a4"]);
  for (let y = 102; y < 136; y += 3 + ((y - 100) / 6 | 0)) r(0, y, W, 1, "#988478");
  for (let j = 0; j < 36; j++) { const y = 100 + j, w = 4 + j * .5; r(160 - w / 2 + j * 1.3, y, w, 1, "#ddd0c4"); }
  r(0, 104, W, 2, "#d4c8bc"); r(0, 120, W, 2, "#d4c8bc");
  // lyhtypylväät kukkaampeleineen
  for (const x of [44, 266]) { r(x, 50, 2, 52, "#4c5c5c"); r(x - 4, 48, 10, 3, "#6c7c7c"); r(x - 6, 76, 14, 2, "#3c3c3c");
    for (const dx of [-6, 6]) { disc(x + dx + 1, 80, 4, "#e84c8c"); px(x + dx, 78, "#fcfcfc"); px(x + dx + 2, 81, "#fc9cc4"); r(x + dx, 84, 2, 2, "#3c6c2c"); } }
  // pöydät ja tuolit
  for (const x of [20, 70, 236, 290]) { r(x, 96, 14, 2, "#2c2c2c"); r(x + 6, 98, 2, 6, "#2c2c2c"); r(x - 4, 94, 3, 10, "#1c1c1c"); r(x + 15, 94, 3, 10, "#1c1c1c"); }
}
const PARASOLS = [[92, 70], [228, 70]];
const QUEUE = [[126, "#2c3c6c", "#e8c8a8"], [138, "#c8c8c8", "#5c3c2c"], [176, "#fce81c", "#e8c0a0"], [190, "#4c2c4c", "#3c2c1c"], [202, "#c84c4c", "#d8b088"]];
function drawTitle(t) {
  g.drawImage(paintBg("title", titleBg), 0, 0);
  for (let i = 0; i < 4; i++) { const x = ((t / (90 + i * 20) + i * 95) % 380) - 40, y = 8 + i * 6; disc(x, y, 5, "#fcfcfc"); disc(x + 7, y - 2, 6, "#fcfcfc"); disc(x + 14, y, 5, "#fcfcfc"); r(x - 3, y + 2, 21, 3, "#fcfcfc"); r(x - 3, y + 4, 21, 1, "#dce4f0"); }
  for (const [x, y] of PARASOLS) { r(x, y, 1, 32, "#8c8c8c"); tri(x - 14, y - 6, 29, 7, "#f4f4ec"); r(x - 14, y, 29, 1, "#c8c8c0"); }
  QUEUE.forEach(([x, shirt, hair], i) => { const sw = Math.round(Math.sin(t / 500 + i) * .6); r(x - 2 + sw, 86, 5, 9, shirt); disc(x + sw, 83, 2, "#e8b890"); r(x - 2 + sw, 81, 5, 1, hair); r(x - 2, 95, 2, 6, "#2c2c3c"); r(x + 1, 95, 2, 6, "#2c2c3c"); });
  const gx = ((t / 30) % 380) - 30; px(gx, 30 + Math.sin(t / 200) * 2, "#fcfcfc"); px(gx + 1, 29, "#fcfcfc"); px(gx + 2, 30, "#fcfcfc"); px(gx + 3, 29, "#fcfcfc"); px(gx + 4, 30 + Math.sin(t / 200) * 2, "#fcfcfc");
  shadow(160, 128, 7); jussi(160, 128, 1, Math.floor(t / 900) % 2 ? 0 : 0, { hat: true });
  g.textAlign = "center"; g.font = "30px VT323, monospace";
  g.fillStyle = "#1c0c00"; g.fillText("MOUHON SALAISUUS", 162, 30);
  const gr = g.createLinearGradient(0, 10, 0, 30); gr.addColorStop(0, "#fff4b0"); gr.addColorStop(.5, "#fcc81c"); gr.addColorStop(1, "#c8641c");
  g.fillStyle = gr; g.fillText("MOUHON SALAISUUS", 160, 28); g.lineWidth = 1; g.strokeStyle = "#5c2c00"; g.strokeText("MOUHON SALAISUUS", 160, 28);
  g.font = "10px VT323, monospace"; g.fillStyle = "#1c1c3c"; g.fillText("Jussi Markkanen, Mouhon toiminnanjohtaja (melkein)", 161, 39); g.fillStyle = "#fcfcfc"; g.fillText("Jussi Markkanen, Mouhon toiminnanjohtaja (melkein)", 160, 38);
  if (Math.floor(t / 600) % 2) { g.fillStyle = "#1c1c1c"; g.fillText("Klikkaa aloittaaksesi", 161, 133); g.fillStyle = "#fcfc54"; g.fillText("Klikkaa aloittaaksesi", 160, 132); }
  g.textAlign = "left";
}
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
async function travel(from = [132, 34], to = [226, 104]) {
  const start = performance.now(), dur = 3600;
  overlay = (t) => {
    const k = Math.min((t - start) / dur, 1);
    g.drawImage(paintBg("map", mapBg), 0, 0);
    const [ax, ay] = from, [bx, by] = to, n = Math.floor(k * 48);
    const at = (q) => [ax + (bx - ax) * q, ay + (by - ay) * q - Math.sin(q * Math.PI) * 22];
    for (let i = 0; i < n; i += 2) { const [x, y] = at(i / 48); r(x, y, 2, 2, "#b81c1c"); }
    const [x, y] = at(n / 48); r(x - 4, y, 9, 2, "#2c2c2c"); r(x - 1, y - 3, 3, 8, "#2c2c2c"); r(x - 4, y - 1, 2, 4, "#2c2c2c"); px(x + 4, y, "#fcfcfc");
    if (k >= 1) { r(bx - 3, by - 1, 7, 1, "#b81c1c"); r(bx, by - 4, 1, 7, "#b81c1c"); }
  };
  await sleep(dur + 500); overlay = null;
}
// Loppu: Mouho 2026, Kaivokatu 10, 4. krs (recordlydata.com/events/mouho-2026):
// 2v2 NHL PS5:llä, 3 min erät, parit arvotaan, pizza n. 18.30 -- ja osallistuminen on ILMAINEN.
function mouhoBg() {
  vgrad(0, 0, W, 108, ["#1c1c2c", "#24243a", "#2c2c44"]);
  for (const x of [8, 250]) { r(x, 14, 62, 46, "#0c1430"); for (let k = 0; k < 14; k++) r(x + 4 + (k * 13) % 54, 22 + (k * 7) % 34, 3, 2 + (k % 3), k % 4 ? "#fcd45c" : "#8cacfc");
    r(x, 36, 62, 1, "#3c3c4c"); r(x + 30, 14, 2, 46, "#3c3c4c"); r(x - 2, 12, 66, 2, "#4c4c5c"); r(x - 2, 60, 66, 3, "#4c4c5c"); }
  r(0, 8, W, 3, "#3c3c54");
  r(92, 6, 136, 12, "#c81c1c"); r(92, 6, 136, 1, "#fc5c5c"); r(92, 17, 136, 1, "#7c0c0c");
  g.textAlign = "center"; g.font = "11px VT323, monospace"; g.fillStyle = "#fcfc54"; g.fillText("MOUHO 2026 · 2v2 NHL", 160, 15); g.textAlign = "left";
  r(96, 24, 128, 70, "#0c0c0c"); r(98, 26, 124, 64, "#1c1c1c"); r(156, 94, 8, 6, "#2c2c2c"); r(140, 100, 40, 2, "#2c2c2c");
  r(186, 100, 18, 3, "#ececec"); r(187, 99, 16, 1, "#fcfcfc"); px(200, 100, "#3c7cfc");
  r(0, 102, W, 34, "#3c3448"); for (let y = 104; y < 136; y += 6) r(0, y, W, 1, "#342c40");
  r(60, 106, 200, 14, "#2c4c7c"); r(60, 104, 200, 4, "#3c5c8c"); r(56, 104, 8, 18, "#24406c"); r(256, 104, 8, 18, "#24406c");
  for (const [x, y] of [[18, 118], [30, 114], [276, 116]]) { r(x, y, 20, 4, "#e8d8b8"); r(x, y, 20, 1, "#fcf0d8"); r(x + 6, y + 1, 8, 1, "#c81c1c"); }
  r(286, 96, 10, 10, "#e8c81c"); r(284, 94, 14, 3, "#fcd84c"); r(289, 106, 4, 4, "#c8a41c"); r(286, 110, 10, 2, "#8c6c1c"); px(288, 98, "#fcf4ac");
}
function rinkTV(t) {
  r(100, 28, 120, 60, "#d8ecfc"); r(100, 28, 120, 1, "#fcfcfc"); r(159, 28, 2, 60, "#c81c1c"); r(130, 28, 1, 60, "#3c5cdc"); r(189, 28, 1, 60, "#3c5cdc");
  g.strokeStyle = "#c81c1c"; g.beginPath(); g.arc(160, 58, 10, 0, 7); g.stroke();
  r(101, 50, 4, 16, "#c81c1c"); r(215, 50, 4, 16, "#c81c1c");
  const k = t / 900, puck = [160 + Math.sin(k) * 48, 58 + Math.sin(k * 1.7) * 18];
  const pl = (x, y, c) => { r(x - 2, y - 6, 5, 6, c); disc(x, y - 7, 1, "#f0c0a0"); r(x + 2, y - 2, 4, 1, "#5c3c1c"); };
  pl(puck[0] - 6 + Math.sin(k * 3) * 2, puck[1] + 2, "#c81c1c"); pl(puck[0] + 8, puck[1] - 6, "#2c4cc8");
  pl(160 + Math.cos(k * .8) * 30, 40 + Math.sin(k) * 6, "#2c4cc8"); pl(140 + Math.sin(k * 1.3) * 22, 76, "#c81c1c");
  r(puck[0], puck[1], 2, 1, "#000");
  r(100, 82, 120, 6, "#000a"); g.font = "7px VT323, monospace"; g.fillStyle = "#fcfcfc"; g.fillText(`HOME 2  -  AWAY ${Math.floor(t / 7000) % 4}   3:00`, 104, 87);
  g.fillStyle = "rgba(255,255,255,.04)"; for (let y = 28; y < 88; y += 2) g.fillRect(100, y, 120, 1);
}
function host(x, y, t, shirt) { const b = Math.round(Math.sin(t / 450 + x) * .6); shadow(x, y, 6); r(x - 3, y - 8, 3, 8, "#2c2c3c"); r(x + 1, y - 8, 3, 8, "#2c2c3c");
  r(x - 4, y - 19 + b, 9, 11, shirt); disc(x, y - 23 + b, 4, "#e8b890"); r(x - 4, y - 27 + b, 9, 3, "#5c3c24"); px(x - 1, y - 23 + b, "#000"); px(x + 2, y - 23 + b, "#000"); r(x - 6, y - 16 + b, 2, 7, "#e8b890"); }
async function ending() {
  st.scene = "loppu"; $game.classList.add("cut");
  await travel([226, 104], [127, 40]);
  overlay = (t) => { g.drawImage(paintBg("mouho", mouhoBg), 0, 0); rinkTV(t); host(236, 128, t, "#2c7c4c"); host(84, 128, t, "#7c2c6c"); shadow(168, 128, 7); jussi(168, 128, 1, 0, { hat: true, whip: true }); };
  $sent.textContent = "";
  await say("Kaivokatu 10, 4. kerros. Mouho 2026.", "muu");
  await say("Täältä tullaan! 500 euroa Mouho-osallistumismaksua, käteisenä, kultaisen idolin kautta hankittuna!");
  await say("Järjestäjä: \"Osallistuminen on ilmaista.\"", "muu");
  await say("...Ilmaista?");
  await say("Järjestäjä: \"Ilmoittautuminen on kuitenkin sitova. Parit arvotaan paikan päällä, erät ovat kolme minuuttia, pizza tulee puoli seitsemältä.\"", "muu");
  await say("Sitten tällä kertaa raha menee oikeaan osoitteeseen. Pizzaan.");
  if (has("kebab")) { await say("Ja toin kebabin Istanbulista. Pizza on yliarvostettu. Mouhoness vaatii proteiinia."); await say("Järjestäjä: \"Kebab Mouhossa. Tämä on uutta. Teşekkürler!\"", "muu"); }
  await say("Mouhoness: ei apuja, ei armoa. Vain taito, refleksit ja trash talk.\nHyvässä hengessä tietysti.", "muu");
  await say(`Mouho-IQ: ${iqTotal()} / ${IQ_MAX}. ${iqTotal() >= IQ_MAX ? "Täydet pisteet. Mouhoness saavutettu." : "Löytyikö kaikki? Kokeile uudestaan."}`, "muu");
  $say.innerHTML = '<div class="line" style="left:50%;bottom:76%;color:#fcfc54">MOUHO 2026 · 22.5. klo 17<br>Kaivokatu 10, 4. krs, Helsinki</div>';
  $game.classList.remove("cut");
  $dlg.replaceChildren(Object.assign(document.createElement("button"), { textContent: "Pelaa uudestaan", onclick: () => location.reload() }));
  $game.classList.add("talking");
}

// Salkkumies (Kisapuisto): liituraitapuku, aurinkolasit yölläkin, kultaketju, salkku.
// Pikseleinä samalla mittakaavalla kuin Jussi ja Mehmet.
function salesman(x, y, t, talking = false) {
  const sw = Math.sin(t / 700) > 0 ? 0 : 1, arm = talking ? Math.round(Math.sin(t / 140) * 2) : 0, mo = talking && Math.floor(t / 110) % 2;
  shadow(x, y, 7);
  r(x - 4, y - 12, 3, 11, "#1c1e2a"); r(x + 1, y - 12, 3, 11, "#24263a"); r(x - 5, y - 2, 4, 2, "#0c0c0c"); r(x + 1, y - 2, 5, 2, "#0c0c0c"); px(x + 4, y - 2, "#8c8c9c");
  r(x - 6, y - 26 + sw, 12, 15, "#2a2c3c"); for (let xx = x - 5; xx < x + 6; xx += 2) r(xx, y - 25 + sw, 1, 13, "#3a3c52");
  r(x - 2, y - 26 + sw, 4, 6, "#f0f0f0"); r(x - 1, y - 25 + sw, 2, 7, "#c81c1c"); r(x - 2, y - 26 + sw, 1, 1, "#e8c430"); r(x + 1, y - 26 + sw, 1, 1, "#e8c430"); px(x, y - 23 + sw, "#e8c430");
  r(x + 6, y - 24 + sw, 2, 10, "#2a2c3c"); r(x + 6, y - 14 + sw, 2, 2, "#e8b48c");
  r(x - 8, y - 24 + sw - arm, 2, 9, "#2a2c3c"); r(x - 8, y - 15 + sw - arm, 2, 2, "#e8b48c");
  r(x + 7, y - 12, 7, 6, "#6c4420"); r(x + 7, y - 12, 7, 1, "#8c5c2c"); r(x + 9, y - 13, 3, 1, "#c8a030");
  r(x - 2, y - 28 + sw, 4, 2, "#d89c74");
  r(x - 5, y - 37 + sw, 10, 10, "#e8b48c"); r(x + 3, y - 36 + sw, 2, 8, "#d09c74");
  r(x - 5, y - 39 + sw, 10, 3, "#1c140c"); r(x - 6, y - 38 + sw, 2, 4, "#1c140c"); px(x - 2, y - 39 + sw, "#5c4c3c");
  r(x - 5, y - 34 + sw, 10, 2, "#0c0c14"); px(x - 4, y - 34 + sw, "#7ca0fc"); px(x + 1, y - 34 + sw, "#7ca0fc"); r(x - 1, y - 34 + sw, 2, 1, "#0c0c14");
  if (mo) r(x - 2, y - 30 + sw, 4, 2, "#4a1410"); else { r(x - 3, y - 30 + sw, 6, 1, "#fcfcfc"); px(x + 1, y - 30 + sw, "#e8c430"); r(x - 3, y - 29 + sw, 6, 1, "#a86048"); }
}

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
