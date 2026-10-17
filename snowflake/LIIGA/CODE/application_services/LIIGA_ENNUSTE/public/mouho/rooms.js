// Mouhon salaisuus -- kolme ruutua perspektiivissä (16.10.: "graafiikkamoottorista
// puuttuu syvyys"). Fate of Atlantiksen tapaan lattia ulottuu syvälle kuvaan:
// horisontti on ylhäällä, kohteet ovat eri etäisyyksillä ja hahmot skaalautuvat
// (game.js: scale). Staattinen osa piirretään kerran välimuistiin (paintBg),
// tilasta riippuvat esineet ovat syvyysjärjestettyjä propseja game.js:ssä.
"use strict";

// Täytetty monikulmio (perspektiivitasot: seinät, lattiat, tiskit).
function fillPoly(pts, c) { g.fillStyle = c; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill(); }
function lineC(x0, y0, x1, y1, c, w = 1) { g.strokeStyle = c; g.lineWidth = w; g.beginPath(); g.moveTo(x0 + .5, y0 + .5); g.lineTo(x1 + .5, y1 + .5); g.stroke(); }
const lerp = (a, b, k) => a + (b - a) * k;

// =============================================================== KISAPUISTO
// Lappeenrannan Kisapuisto lokakuun iltana (17.10., mouho_concept-kuvien tunnelma):
// auringonlasku pikselipilvin, keltainen ja harmaa halli, "TERVETULOA KISAPUISTOON"
// -katos, lämpimät ikkunat, märkä parkkipaikka heijastuksineen, männyt ja keltaiset
// koivut, Kaukaan piippu taustalla. Kaikki piirretään koodilla; kuvat olivat vain mallina.

// 3x5-pikselifontti kylttejä varten (selainfontti ei ehkä ole ladattu kun tausta välimuistitetaan).
const FONT3 = {
  A: "010101111101101", B: "110101110101110", C: "011100100100011", D: "110101101101110", E: "111100110100111", F: "111100110100100",
  G: "011100101101011", H: "101101111101101", I: "111010010010111", J: "001001001101010", K: "101101110101101", L: "100100100100111",
  M: "101111111101101", N: "110101101101101", O: "010101101101010", P: "110101110100100", R: "110101110101101", S: "011100010001110",
  T: "111010010010010", U: "101101101101111", V: "101101101101010", Y: "101101010010010", "Ä": "101010101111101", "Ö": "101010101101010",
  "0": "111101101101111", "1": "010110010010111", "2": "110001010100111", "3": "111001111001111", "4": "101101111001001",
  "5": "111100111001111", "6": "011100111101111", "7": "111001010010010", "8": "111101111101111", "9": "111101111001111", " ": "000000000000000", "-": "000000111000000", ".": "000000000000010",
};
function text3(s, x, y, c, sc = 1) {
  for (const ch of s) { const gl = FONT3[ch] ?? FONT3[" "];
    for (let k = 0; k < 15; k++) if (gl[k] === "1") r(x + (k % 3) * sc, y + Math.floor(k / 3) * sc, sc, sc, c);
    x += 4 * sc; }
}
const text3w = (s, sc = 1) => s.length * 4 * sc - sc;

// Parkkipaikan perspektiivi: pakopiste hallin oven kohdalla, horisontti hallin juurella.
const VPK = [160, 52], BASE = 79;
const lotX = (y) => { const k = (y - 98) / 18; return [lerp(70, 56, k), lerp(236, 246, k)]; };
// Pilvijuovat: art_style_3:n tapaan vaakaviivoja, alapinta valaistu auringonlaskusta.
const CLOUDS = (() => { seed = 41; const out = [];
  for (const [cx, cy, n, w] of [[60, 14, 26, 70], [190, 9, 34, 110], [270, 24, 22, 60], [120, 30, 18, 80], [30, 34, 14, 50], [230, 38, 16, 70]])
    for (let i = 0; i < n; i++) out.push([cx + (rnd() - .5) * w, cy + (rnd() - .5) * 7, 3 + rnd() * 14]);
  return out; })();
function kisaBg() {
  // taivas: yö ylhäällä, auringonlasku puiden takana oikealla
  vgrad(0, 0, W, 60, ["#10122c", "#181a3c", "#232250", "#33285e", "#4a3066", "#6a3a68", "#924a62", "#bc6258", "#dc8650", "#eca85a"]);
  seed = 5; for (let i = 0; i < 40; i++) { const x = (rnd() * W) | 0, y = (rnd() * 18) | 0; px(x, y, rnd() > .7 ? "#e8e8fc" : "#8c8cc8"); }
  for (const [x, y, w] of CLOUDS) {
    const lit = y > 20 ? "#f0a070" : "#c8607c", body = y > 20 ? "#5a3456" : "#3a2c58";
    r(x, y, w, 1, body); r(x + 1, y + 1, w - 2, 1, lit); if (w > 10) r(x + w * .3, y - 1, w * .4, 1, body);
  }
  // aurinko juuri laskenut: hehku puiden takana
  for (let j = -18; j <= 0; j++) for (let i = -40; i <= 40; i++) { const d = Math.hypot(i / 2.2, j); if (d < 18 && bay(250 + i, 58 + j) < (18 - d) / 22) px(250 + i, 58 + j, "#f8c870"); }
  // Kaukaan tehdas ja piippu vasemmalla kaukana (kisapuisto_4), höyry ja punainen lentoestevalo
  r(4, 44, 34, 16, "#2c2440"); r(10, 40, 12, 4, "#2c2440"); r(26, 14, 4, 46, "#342a48"); r(25, 13, 6, 2, "#40345a");
  for (let k = 0; k < 6; k++) disc(30 + k * 5, 10 - k * 1.5, 3 + k, k < 3 ? "#8c7c9c" : "#6c5c84");
  for (const [x, y] of [[8, 47], [14, 47], [20, 50], [32, 47]]) r(x, y, 2, 1, "#f0c070");
  // metsä: männyt (tumma) ja koivut (keltainen ruska), vaihteleva latvarivi
  seed = 23;
  for (let x = -6; x < W + 6; x += 3 + ((rnd() * 5) | 0)) { const h = 10 + ((rnd() * 16) | 0), y = 62 - h;
    r(x + 2, y + 4, 1, h, "#1a1626"); for (let j = 0; j < h - 2; j += 2) r(x + 2 - Math.min(3, j / 4), y + j, 1 + Math.min(6, j / 2), 2, j % 4 ? "#1c2230" : "#222a38"); }
  for (const [x, y, s] of [[44, 46, 7], [92, 44, 6], [276, 44, 8], [300, 48, 6], [140, 48, 5]]) {
    for (let k = 0; k < 40; k++) { const a = rnd() * 6.3, d = rnd() * s; px(x + Math.cos(a) * d * 1.2, y + Math.sin(a) * d, rnd() > .5 ? "#c8902c" : rnd() > .5 ? "#e8b848" : "#8c5c24"); }
    r(x, y + s - 2, 1, 14, "#d8d0c8"); px(x, y + s + 3, "#2c2c2c"); }
  r(0, 62, W, BASE - 62, "#161a26"); dither(0, 62, W, 4, "#1c2230", "#161a26", .5);
  // --- halli: keltainen lohko vasemmalla, harmaa pääsali harjakattoineen, valkoinen matala osa edessä
  // pääsali (aaltopelti, hämärän violetti)
  fillPoly([[104, 40], [178, 24], [264, 40], [264, BASE], [104, BASE]], "#7c7a92");
  fillPoly([[178, 24], [264, 40], [264, 44], [178, 28]], "#5c5a74"); lineC(104, 40, 178, 24, "#a4a2bc"); lineC(178, 24, 264, 40, "#46445c");
  for (let x = 106; x < 264; x += 3) { const top = x < 178 ? 40 - (x - 104) * 16 / 74 : 24 + (x - 178) * 16 / 86; r(x, top + 2, 1, BASE - top - 2, x > 178 ? "#686680" : "#706e88"); }
  r(176, 18, 1, 8, "#3c3a4c"); px(176, 17, "#fc4c3c");                                       // antenni
  r(160, 50, 18, 12, "#34324a"); r(162, 52, 14, 8, "#ffd890"); r(162, 52, 14, 1, "#fff0c0");  // ylempi ikkuna (toimisto)
  // keltainen lohko: ylhäällä valossa, alhaalla varjossa
  r(50, 28, 58, BASE - 28, "#d8a42c"); vgrad(50, 28, 58, 14, ["#e8b83c", "#d8a42c"]); dither(50, 62, 58, BASE - 62, "#d8a42c", "#b4842c", .45);
  for (let x = 52; x < 108; x += 3) r(x, 30, 1, BASE - 30, "#c8962a"); r(50, 28, 58, 1, "#f8d060"); r(107, 28, 1, BASE - 28, "#9c7424");
  r(48, 26, 62, 2, "#3c3448"); r(70, 20, 10, 6, "#4c4458"); r(72, 18, 6, 2, "#5c546c");      // katto ja ilmanvaihto
  // mainostaulu keltaisessa seinässä: maalivahti ja teksti
  r(56, 40, 46, 22, "#f4dc5c"); r(56, 40, 46, 1, "#fcf09c"); r(56, 61, 46, 1, "#b8942c");
  text3("TERVETULOA", 58, 43, "#3c2c10"); text3("PELIIN", 58, 50, "#3c2c10");
  r(88, 44, 8, 14, "#8c3c2c"); disc(92, 43, 3, "#e8c09c"); r(87, 56, 10, 3, "#6c2c1c"); r(89, 47, 6, 1, "#fcd41c");
  // valkoinen matala osa, ovet ja ikkunat
  r(108, 62, 156, BASE - 62, "#c4c0d4"); r(108, 62, 156, 1, "#e0dcec"); dither(108, 72, 156, BASE - 72, "#c4c0d4", "#aca8c0", .4);
  for (const x of [214, 228, 242]) { r(x, 66, 9, 6, "#4c4864"); r(x + 1, 67, 7, 4, "#ffd890"); }
  r(222, 64, 6, 15, "#d8a42c"); r(223, 66, 4, 13, "#9c7c2c"); px(226, 72, "#fcf09c");          // keltainen huoltovovi
  // sisäänkäynnin katos ja kyltti "TERVETULOA KISAPUISTOON" (kisapuisto_1)
  r(106, 54, 108, 9, "#22202c"); r(106, 54, 108, 1, "#46445a"); r(106, 62, 108, 1, "#14121a");
  fillPoly([[106, 54], [112, 54], [109, 62], [106, 62]], "#e8b83c"); fillPoly([[208, 54], [214, 54], [214, 62], [211, 62]], "#e8b83c");
  const sign = "TERVETULOA KISAPUISTOON"; text3(sign, 160 - text3w(sign) / 2, 56, "#f4f0e0");
  for (const x of [116, 150, 170, 200]) r(x, 63, 2, BASE - 63, "#9c9cac");
  // lasiovet ja aulan lämmin valo katoksen alla
  r(124, 64, 70, BASE - 64, "#3a3448"); for (let x = 126; x < 192; x += 11) { r(x, 65, 9, BASE - 66, "#f0c87c"); r(x, 65, 9, 2, "#fce8b0"); r(x + 4, 65, 1, BASE - 66, "#8c6c3c"); }
  for (const x of [132, 154, 176]) { r(x, 70, 3, 6, "#3c2c24"); disc(x + 1, 68, 1, "#3c2c24"); }        // ihmisiä aulassa
  // pyöräteline ja sininen jätelava vasemmalla (kisapuisto_4)
  r(30, 70, 18, 9, "#2c5cbc"); r(30, 70, 18, 1, "#5c8cec"); r(30, 78, 18, 1, "#1c3c8c"); text3("EP", 34, 72, "#bcd4fc");
  for (const x of [92, 98]) { disc(x, 77, 2, "#4a4658", "#2c2c34"); disc(x + 4, 77, 2, "#4a4658", "#2c2c34"); lineC(x, 77, x + 2, 74, "#3c3c4c"); lineC(x + 2, 74, x + 4, 77, "#3c3c4c"); }
  // --- parkkipaikka: märkä asfaltti heijastaa taivasta kaukana, tummuu lähellä
  vgrad(0, BASE, W, H - BASE, ["#3a3450", "#2e2a42", "#262436", "#201e2e", "#1a1926", "#161520", "#13121c"]);
  seed = 61; for (let j = BASE; j < H; j++) for (let i = 0; i < W; i++) if (rnd() < .05) px(i, j, rnd() > .5 ? "#2c2a3c" : "#121019");
  r(0, BASE, W, 1, "#4c4860"); r(0, BASE + 1, W, 1, "#2a2638");                                       // reunakivi
  // ruutuviivat kohti pakopistettä: kaukainen rivi hallin edessä ja lähirivi alhaalla
  for (let i = -6; i <= 6; i++) { const xb = 160 + i * 34; lineC(lerp(VPK[0], xb, (82 - VPK[1]) / (96 - VPK[1])), 82, xb, 96, "rgba(220,220,230,.28)"); }
  r(10, 96, 300, 1, "rgba(220,220,230,.22)");
  for (let i = -5; i <= 5; i++) { const xb = 160 + i * 64; lineC(lerp(VPK[0], xb, (122 - VPK[1]) / (H - VPK[1])), 122, xb, H, "rgba(220,220,230,.18)"); }
  // pysäköidyt autot hallin edessä (kaukana)
  for (const [x, c] of [[36, "#5c6c7c"], [70, "#8c3c3c"], [232, "#3c4c5c"], [268, "#b8b4ac"]]) {
    r(x, 84, 22, 6, c); r(x + 4, 80, 13, 5, c); r(x + 5, 81, 5, 3, "#9cb4d8"); r(x + 11, 81, 5, 3, "#7c94b8"); r(x, 84, 22, 1, "rgba(255,255,255,.25)");
    disc(x + 4, 90, 2, "#101014"); disc(x + 18, 90, 2, "#101014"); r(x, 91, 22, 2, "rgba(0,0,0,.35)"); }
  // nurmikaistale ja lehtiä vasemmalla edessä
  vgrad(0, 126, 64, 10, ["#2c3c24", "#22301c"]); seed = 77; for (let k = 0; k < 60; k++) px(rnd() * 70, 124 + rnd() * 12, ["#c8782c", "#e8a83c", "#8c4c1c", "#3c4c2c"][(rnd() * 4) | 0]);
  r(0, 125, 66, 1, "#5c5c68"); fillPoly([[66, 125], [74, 136], [72, 136], [64, 126]], "#4c4c58");
  // koivu vasemmalla edessä: valkoinen runko mustin juovin, keltainen latvus kehyksenä
  r(4, 16, 4, 112, "#e8e4dc"); r(7, 16, 1, 112, "#b8b4ac"); for (let y = 22; y < 126; y += 7 + (y % 5)) r(4 + (y % 3), y, 2, 1, "#2c2c2c");
  lineC(6, 40, 22, 26, "#d8d4cc", 2); lineC(6, 60, -4, 48, "#d8d4cc", 2);
  seed = 91; for (let k = 0; k < 420; k++) { const a = rnd() * 6.3, d = Math.sqrt(rnd()) * 20, x = 12 + Math.cos(a) * d * 1.4, y = 16 + Math.sin(a) * d;
    px(x, y, bay(x | 0, y | 0) < .3 ? "#8c5c1c" : rnd() > .4 ? "#e8b440" : "#f8d868"); }
}
const LEAVES = Array.from({ length: 9 }, (_, i) => ({ x: (i * 53) % W, s: .3 + (i % 3) * .15, ph: i * 1.7 }));
function kisaDraw(t) {
  g.drawImage(paintBg("kisapuisto", kisaBg), 0, 0);
  // lyhtypylväät: kaukainen oikealla, valokeila ja heijastus märässä asfaltissa
  for (const [x, y0, h] of [[24, 84, 34], [286, 88, 40]]) {
    r(x, y0 - h, 1, h, "#2c2a38"); r(x - 3, y0 - h - 1, 7, 2, "#3c3a4c"); r(x - 2, y0 - h + 1, 5, 1, "#fff0b0");
    glow(x, y0 - h + 2, 26, "255,214,140", .3 + .03 * Math.sin(t / 140 + x));
    g.fillStyle = "rgba(255,214,140,.07)"; g.beginPath(); g.moveTo(x - 2, y0 - h + 2); g.lineTo(x - 14, y0 + 2); g.lineTo(x + 15, y0 + 2); g.lineTo(x + 3, y0 - h + 2); g.fill();
    for (let y = y0 + 3; y < Math.min(H, y0 + 30); y += 2) { const w = 2 + Math.sin(t / 200 + y) * 1.5; r(x - w / 2 + Math.sin(t / 300 + y * .7), y, w, 1, `rgba(255,214,140,${.32 - (y - y0) / 110})`); }
  }
  // aulan valo kaatuu asfaltille ja heijastuu ovien alle
  glow(158, 82, 46, "255,200,120", .16);
  for (let y = 82; y < 112; y += 2) { const k = (y - 82) / 30, w = 60 - k * 30; r(158 - w / 2 + Math.sin(t / 260 + y) * 2, y, w, 1, `rgba(255,210,140,${.12 * (1 - k)})`); }
  // kyltin yksi kirjain lepattaa kuin vanhassa loisteputkessa
  if (Math.sin(t / 97) + Math.sin(t / 41) > 1.6) r(152, 56, 3, 5, "#22202c");
  // tehtaan lentoestevalo ja höyry liikkuu
  if ((t / 900 | 0) % 2) { px(28, 12, "#fc3c2c"); glow(28, 12, 4, "255,60,40", .5); }
  // putoavat koivunlehdet
  for (const L of LEAVES) { const y = ((t / 40) * L.s + L.ph * 30) % 150 - 10, x = L.x + Math.sin(t / 600 + L.ph) * 8; px(x, y, L.ph % 2 > 1 ? "#e8b440" : "#c8782c"); }
  glow(250, 58, 50, "255,170,90", .08);
}
// syvyysjärjestetyt esineet (game.js props)
function kisaPoster() { // Kisapuiston ilmoitustaulu, Mouho-juliste päällimmäisenä
  shadow(35, 128, 18); r(20, 92, 2, 36, "#2c2a38"); r(48, 92, 2, 36, "#2c2a38");
  r(14, 82, 42, 32, "#3c3a4c"); r(15, 83, 40, 30, "#8c7c5c"); dither(15, 83, 40, 30, "#8c7c5c", "#7c6c4c", .3);
  r(17, 85, 10, 12, "#e8e4d8"); r(18, 87, 8, 1, "#8c8c8c"); r(18, 89, 6, 1, "#8c8c8c");            // vanha ottelulappu
  r(44, 86, 9, 8, "#fce870"); r(45, 88, 6, 1, "#8c7c2c");                                        // keltainen post-it
  r(24, 89, 26, 22, "#1c1c2c"); r(25, 90, 24, 20, "#ece0bc"); r(26, 91, 22, 5, "#c81c1c"); text3("MOUHO", 27, 91, "#fce8c8");
  for (let k = 0; k < 3; k++) r(27, 98 + k * 2, 12 + (k * 5) % 8, 1, "#6c6c6c"); r(26, 105, 22, 4, "#2c7c2c"); text3("2026", 29, 105, "#d8f4c8");
  r(35, 89, 2, 1, "#c8c8c8"); }
function kisaPostbox() { // SaiPan toimiston postilaatikko: posti tulee yhä tänne
  const open = st.flags.boxOpen; r(98, 92, 2, 12, "#3c3c48"); shadow(99, 104, 5);
  r(93, 84, 12, 8, "#e8b83c"); r(93, 84, 12, 1, "#fcd870"); r(93, 91, 12, 1, "#a07c24"); r(104, 85, 1, 4, "#c81c1c"); r(105, 85, 2, 2, "#c81c1c");
  if (open) { r(93, 81, 12, 2, "#f0c450"); r(94, 85, 10, 5, "#14121a"); if (!st.flags.letterTaken) { r(96, 86, 6, 2, "#f4f4f4"); px(98, 86, "#c81c1c"); } }
  else { r(96, 88, 6, 1, "#3c2c10"); text3("SP", 95, 85, "#6c4c14"); } }
function kisaRack() { // pysäköintiautomaatti
  shadow(206, 96, 5); r(203, 80, 7, 16, "#5c6070"); r(203, 80, 7, 1, "#8c90a0"); r(204, 82, 5, 3, "#9cd0fc"); r(205, 87, 3, 1, "#1c1c24"); r(202, 95, 9, 1, "#2c2c34");
  r(201, 76, 2, 3, "#2c64c8"); text3("P", 199, 70, "#2c64c8");
}
function kisaPig() { g.save(); g.translate(0, 7);
  r(140, 113, 22, 2, "#6c6c78"); r(140, 115, 22, 1, "#3c3c48");                                  // betoninen pysäköintiste
  shadow(152, 114, 6); r(147, 108, 9, 6, "#fc9cb4"); r(146, 109, 11, 4, "#fc9cb4"); r(148, 108, 5, 1, "#fcbccc"); r(156, 110, 2, 2, "#fc7c9c");
  px(148, 114, "#d87c94"); px(154, 114, "#d87c94"); r(149, 108, 3, 1, "#3c1c24"); px(154, 109, "#000"); g.restore(); }
function kisaBox() { // Jussin pahvilaatikko Liigan toimistolta (piirretty x 229-255, siirretty pianon alle)
  g.save(); g.translate(-138, 9); shadow(242, 121, 9); r(233, 110, 18, 11, "#b8925c"); r(233, 110, 18, 1, "#d8b27c"); r(242, 110, 1, 11, "#8c6c3c");
  fillPoly([[233, 110], [229, 106], [238, 106], [241, 110]], "#c8a26c"); fillPoly([[251, 110], [255, 106], [247, 106], [244, 110]], "#a8824c");
  r(236, 103, 4, 5, "#f4f4ec"); r(236, 103, 4, 1, "#c81c1c");                                     // kahvikuppi
  r(244, 102, 7, 4, "#c8a030"); r(245, 103, 5, 1, "#3c2c10");                                    // nimikyltti
  r(235, 113, 12, 3, "#f4f0e4"); text3("LIIGA", 235, 113, "#2c2c3c"); g.restore(); }
function kisaTaxi() { shadow(282, 134, 40);
  r(242, 108, 78, 22, "#e8c81c"); r(242, 122, 78, 8, "#c8a414"); r(242, 108, 78, 1, "#fce870"); r(256, 96, 50, 13, "#e8c81c"); r(257, 95, 48, 1, "#fce870");
  r(260, 98, 19, 9, "#4c6ca0"); r(283, 98, 20, 9, "#4c6ca0"); r(261, 99, 4, 1, "#c8d8fc"); r(284, 99, 4, 1, "#c8d8fc"); r(264, 101, 6, 4, "#2c2c3c");
  r(272, 90, 18, 5, "#202020"); r(273, 91, 16, 3, "#fcd41c"); text3("TAKSI", 271, 90, "#202020");
  r(281, 109, 1, 16, "#a88c10"); r(242, 115, 78, 1, "#202020"); for (let x = 244; x < 320; x += 4) px(x, 115, "#e8e8e8");
  disc(258, 130, 7, "#141414", "#2c2c2c"); disc(306, 130, 7, "#141414", "#2c2c2c"); disc(258, 130, 3, "#8c8c8c"); disc(306, 130, 3, "#8c8c8c");
  r(242, 111, 3, 4, "#fc3c1c"); glow(243, 113, 10, "255,60,40", .35); r(316, 112, 4, 3, "#fff4c8"); glow(318, 113, 18, "255,240,180", .3);
  g.fillStyle = "rgba(232,200,28,.18)"; g.fillRect(244, 131, 74, 5); }

// =============================================================== BASAARI
// Katu kapenee kohti moskeijaa; kojut molemmin puolin, Mehmetin tiski oikealla.
const VPB = [160, 56];
function basaariBg() {
  vgrad(0, 0, W, 70, ["#24123c", "#4a1848", "#7c2448", "#b43c40", "#e0603a", "#f48c3c", "#fcb85c"]);
  disc(118, 50, 8, "#fce890", "#fcd070");
  const M = "#3a1834"; disc(160, 34, 12, M); r(146, 34, 28, 4, M); disc(143, 42, 6, M); disc(177, 42, 6, M); r(136, 40, 48, 30, M); r(159, 17, 2, 6, M);
  for (const [x, top] of [[130, 18], [188, 18], [122, 28], [196, 28]]) { r(x, top, 2, 52, M); tri(x, top - 6, 2, 6, M); r(x - 1, top + 10, 4, 1, M); }
  for (let x = 140; x < 182; x += 6) px(x, 50, "#fcb04c");
  // seinät perspektiivissä: vasen ja oikea kojurivi
  fillPoly([[0, 0], [136, 38], [136, 70], [0, 112]], "#b0744a"); fillPoly([[320, 0], [184, 38], [184, 70], [320, 112]], "#a46c40");
  seed = 9; for (let k = 0; k < 900; k++) { const y = rnd() * 112, x = rnd() * 136, top = 38 * x / 136, bot = 112 - 42 * x / 136; if (y > top && y < bot) px(x, y, rnd() < .5 ? "#9c6438" : "#c4885a"); }
  for (let k = 0; k < 900; k++) { const y = rnd() * 112, x = 184 + rnd() * 136, xx = 320 - x, top = 38 * xx / 136, bot = 112 - 42 * xx / 136; if (y > top && y < bot) px(x, y, rnd() < .5 ? "#94603a" : "#b87c50"); }
  // kaaret seinissä (perspektiivissä kapenevat)
  for (const k of [.12, .38, .6, .78]) { const x = k * 136, top = 38 * k + 26 * (1 - k), bot = 112 - 42 * k, w = 26 * (1 - k * .8);
    fillPoly([[x, top], [x + w, top + w * .28], [x + w, bot - w * .3], [x, bot]], "#4a2414"); fillPoly([[320 - x, top], [320 - x - w, top + w * .28], [320 - x - w, bot - w * .3], [320 - x, bot]], "#3a1c10"); }
  // markiisiraidat seinien yläreunassa
  for (let i = 0; i < 14; i++) { const a = i / 14, b = (i + 1) / 14, c = i % 2 ? "#b81c1c" : "#ece4c4";
    fillPoly([[a * 136, 38 * a + 8], [b * 136, 38 * b + 8], [b * 136, 38 * b + 20 - 6 * b], [a * 136, 38 * a + 20 - 6 * a]], c);
    fillPoly([[320 - a * 136, 38 * a + 8], [320 - b * 136, 38 * b + 8], [320 - b * 136, 38 * b + 20 - 6 * b], [320 - a * 136, 38 * a + 20 - 6 * a]], c); }
  // katu: mukulakivet perspektiivissä
  for (let y = 70; y < H; y++) { const k = (y - 70) / (H - 70), x0 = lerp(136, -60, k), x1 = lerp(184, 380, k); r(x0, y, x1 - x0, 1, "#6c4422");
    const step = 3 + k * 9, off = (Math.floor((y - 70) / (1 + k * 4)) % 2) * step / 2;
    if (((y - 70) % Math.max(1, Math.round(1 + k * 4))) !== 0) for (let x = x0 + off; x < x1; x += step) r(x + 1, y, step - 1.5, 1, ["#8c5c30", "#9c6a3a", "#845428"][Math.floor(x / step) % 3 & 3] ?? "#8c5c30"); }
  // matto vasemmalla seinällä (kartta kudottuna)
  fillPoly([[16, 46], [50, 54], [50, 98], [16, 100]], "#6c1428"); fillPoly([[19, 50], [47, 57], [47, 95], [19, 97]], "#b42c38"); fillPoly([[22, 54], [44, 60], [44, 92], [22, 94]], "#d8983c");
  disc(33, 75, 4, "#2c3c8c"); disc(33, 75, 2, "#e8c84c"); for (let k = 0; k < 7; k++) px(25 + k * 2, 86 - (k % 3), "#c81c1c"); r(39, 83, 1, 3, "#1c1c1c"); r(38, 84, 3, 1, "#1c1c1c");
  for (let x = 16; x < 50; x += 2) r(x, 99 + (x - 16) / 34, 1, 2, "#e8d8a8");
  // Mehmetin koju oikealla: katos ja takaseinä (tiski itse on propsi)
  fillPoly([[214, 58], [300, 50], [300, 60], [214, 66]], "#2c7c4c"); for (let i = 0; i < 6; i++) { const a = 214 + i * 14.3; fillPoly([[a, 58 - i * 1.3], [a + 7, 58 - i * 1.3 - .7], [a + 7, 66 - i * 1], [a, 66 - i * 1]], "#e8e0c4"); }
  r(216, 66, 2, 26, "#5c3418"); r(296, 60, 2, 34, "#5c3418"); fillPoly([[218, 66], [296, 60], [296, 92], [218, 92]], "#4a2414");
  for (const x of [232, 240]) { r(x, 82, 6, 5, "#d8a81c"); r(x + 5, 81, 3, 2, "#d8a81c"); r(x + 1, 80, 3, 2, "#e8c84c"); px(x + 1, 83, "#fcf09c"); }
  r(274, 81, 10, 7, "#3c8cbc"); r(276, 79, 6, 2, "#3c8cbc"); r(283, 82, 3, 1, "#3c8cbc"); px(276, 83, "#e8f4fc");
  // kadun pää: kuja moskeijan alla
  r(146, 54, 28, 16, "#2c1428"); disc(160, 54, 14, "#2c1428"); r(146, 68, 28, 2, "#4a2440");
  g.fillStyle = "rgba(20,0,0,.22)"; g.fillRect(0, 108, W, 28);
  basaariDetail();
}
// Yksityiskohtakerros (17.10.: "paranna grafiikat Istanbuliin" Kisapuiston tasolle):
// pilvet ja kaukaiset minareetit, kangaskattokaistale, keramiikkalautaset, kuparipannut,
// riippuvat matot, kankaat, mausteiden ja teelasien pöytä, kaukaiset kojut, kissa.
function basaariDetail() {
  seed = 51;
  for (let i = 0; i < 22; i++) { const x = (rnd() * W) | 0, y = 4 + ((rnd() * 28) | 0), w = 8 + ((rnd() * 30) | 0), lo = y > 18;
    r(x, y, w, 1, lo ? "#8c3448" : "#3c1c48"); r(x + 2, y + 1, w - 4, 1, lo ? "#fca468" : "#d0587c"); }
  for (const [x, h] of [[96, 34], [224, 30], [74, 22], [246, 20]]) { const M2 = "#5c2448"; r(x, 70 - h, 2, h, M2); tri(x - 1, 70 - h - 5, 4, 5, M2); r(x - 1, 70 - h + 6, 4, 1, M2); }
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
  fillPoly([[112, 112], [140, 112], [142, 116], [110, 116]], "#7c4c24"); r(110, 116, 32, 2, "#5c341c"); r(112, 118, 2, 10, "#4c2c14"); r(138, 118, 2, 10, "#4c2c14");
  for (const x of [116, 122, 128]) { r(x, 107, 3, 5, "#c84c1c"); r(x, 107, 3, 1, "#fce0b0"); r(x - 1, 106, 5, 1, "#e8c81c"); }
  r(132, 108, 8, 4, "#d8a04c"); for (let k = 0; k < 4; k++) px(133 + k * 2, 109, "#7c9c3c");
  // kissa kadulla (piirretään animoituna basaariDraw:ssa, tässä vain varjo)
  g.fillStyle = "rgba(0,0,0,.3)"; g.beginPath(); g.ellipse(186, 127, 6, 1.5, 0, 0, 7); g.fill();
}
const CROWD2 = Array.from({ length: 5 }, (_, i) => ({ x: 140 + i * 9, v: (i % 2 ? -1 : 1) * (3 + i), fez: i % 2 === 0, c: ["#3c1c24", "#2c1c34", "#4c2c1c"][i % 3] }));
function basaariDraw(t) {
  g.drawImage(paintBg("basaari", basaariBg), 0, 0);
  // kaukainen väkijoukko kadun päässä (pienet)
  for (const p of CROWD2) { p.x += p.v * 0.016; if (p.x < 138) p.v = Math.abs(p.v); if (p.x > 182) p.v = -Math.abs(p.v);
    g.save(); g.translate(p.x, 72); g.scale(.45, .45); g.translate(-p.x, -72); figure(p.x, 72, p.c, p.fez, t + p.x * 40, p.v); g.restore(); }
  for (let i = 0; i < 3; i++) { const x = ((t / (38 + i * 9) + i * 130) % 380) - 30, y = 10 + i * 7 + Math.sin(t / 320 + i) * 3, up = Math.floor(t / 160 + i) % 2;
    px(x, y + up, "#2c1428"); px(x + 1, y, "#2c1428"); px(x + 2, y + 1, "#2c1428"); px(x + 3, y, "#2c1428"); px(x + 4, y + up, "#2c1428"); }
  // viirinauha Turkin lipuin kadun yli
  for (let x = 20; x < 300; x++) px(x, 24 + Math.round(Math.sin((x - 20) / 280 * Math.PI) * 8), "#3c1c1c");
  for (let x = 30; x < 300; x += 30) turkFlag(x, 25 + Math.round(Math.sin((x - 20) / 280 * Math.PI) * 8));
  // lyhdyt
  for (const [x, y, s] of [[60, 40, 1], [110, 50, .7], [210, 50, .7], [262, 40, 1]]) { const f = .5 + .5 * Math.sin(t / 110 + x); r(x, y - 4, 1, 4, "#3c2c1c");
    r(x - 2 * s, y, 5 * s, 6 * s, "#a8741c"); r(x - s, y + s, 3 * s, 4 * s, f > .5 ? "#fce070" : "#fcc040"); glow(x, y + 3, 12 * s, "255,160,60", .16 + .05 * f); }
  if (!st.flags.bag) { r(84, 60, 1, 4, "#3c3c3c"); r(80, 64, 9, 11, "#c8b48c"); r(80, 64, 9, 1, "#e0d0a8"); r(82, 65, 5, 2, "#a8946c"); r(87, 66, 2, 9, "#a8946c"); }
  if (!st.whip) { r(222, 72, 2, 12, "#6c4420"); r(219, 71, 6, 2, "#6c4420"); for (let k = 0; k < 8; k++) px(224 + k, 82 + Math.sin(k) * 2, "#6c4420"); }
  // höyry teelaseista, kissa jonka häntä heiluu, kyyhkyt
  for (let i = 0; i < 3; i++) { const k = ((t / 900 + i / 3) % 1); px(118 + i * 6 + Math.sin(t / 300 + i) * 1.5, 105 - k * 10, `rgba(240,230,220,${.5 * (1 - k)})`); }
  { const tw = Math.sin(t / 420) * 3; r(182, 120, 8, 6, "#4c3c34"); disc(188, 119, 3, "#4c3c34"); px(186, 116, "#4c3c34"); px(190, 116, "#4c3c34"); px(187, 119, "#c8e85c"); px(189, 119, "#c8e85c");
    lineC(182, 124, 177, 120 + tw, "#4c3c34"); }
  for (const [x0, ph] of [[200, 0], [208, 1.7]]) { const hop = Math.max(0, Math.sin(t / 260 + ph)) * 1.5; r(x0, 128 - hop, 4, 3, "#8c8c9c"); px(x0 + 4, 128 - hop, "#6c6c7c"); px(x0 + 5, 129 - hop, "#d8a43c"); }
  // döner kojun edustalla
  { const ph = Math.floor(t / 140) % 3; r(226, 68, 1, 24, "#8c8c8c"); r(230, 66, 6, 26, "#2c2c2c"); r(231, 68, 4, 22, "#e8401c"); glow(233, 80, 11, "255,90,30", .2);
    for (let j = 0; j < 20; j++) { const w = 5.5 - Math.abs(j - 8) / 4; r(226 - w / 2 + .5, 70 + j, w, 1, (j + ph) % 3 === 0 ? "#6c3414" : (j + ph) % 3 === 1 ? "#a8642c" : "#c8843c"); } }
}
function basaariCounter() { fillPoly([[218, 92], [296, 92], [300, 98], [214, 98]], "#8c5c2c"); r(214, 98, 86, 16, "#24448c"); r(214, 98, 86, 1, "#e8c81c");
  for (let x = 218; x < 298; x += 8) { px(x, 104, "#e8c81c"); px(x - 1, 105, "#e8c81c"); px(x + 1, 105, "#e8c81c"); px(x, 106, "#e8c81c"); }
  for (const x of [244, 249, 254]) { r(x, 89, 3, 4, "#c84c1c"); r(x, 89, 3, 1, "#fce0b0"); } shadow(257, 114, 42); }
function basaariSpices() { for (const [x, c, hi] of [[70, "#c83c1c", "#fc6c3c"], [84, "#e8b41c", "#fce06c"], [98, "#5c8c2c", "#8cbc4c"]]) {
  r(x, 92, 12, 9, "#c8b080"); r(x - 1, 90, 14, 3, "#dcc490"); tri(x + 1, 85, 10, 6, c); px(x + 5, 85, hi); px(x + 3, 88, hi); } shadow(90, 101, 18); }
function basaariAmphora() { shadow(38, 131, 8); disc(38, 122, 8, "#b85c2c", "#8c3c1c"); r(35, 110, 7, 5, "#a84c24"); r(34, 109, 9, 2, "#c86c3c");
  r(32, 117, 2, 5, "#8c3c1c"); r(42, 117, 2, 5, "#8c3c1c"); px(34, 119, "#e88c5c"); px(35, 118, "#e88c5c"); r(31, 123, 14, 1, "#e8c81c"); }

// =============================================================== TEMPPELI
// Kammio: kuilu leikkaa lattian poikittain; idoli takana oviaukon edessä.
const CHASM = { y0: 82, y1: 96 };
const floorX = (y) => { const k = (y - 62) / (H - 62); return [lerp(60, -10, k), lerp(260, 330, k)]; };
function temppeliBg() {
  noise(0, 0, W, H, "#2a1a10", ["#3a2616", "#1c1008", "#33210f"], .4);
  // takaseinä ja sivuseinät
  fillPoly([[60, 8], [260, 8], [260, 62], [60, 62]], "#32200f"); fillPoly([[0, 0], [60, 8], [60, 62], [0, 104]], "#24160c"); fillPoly([[320, 0], [260, 8], [260, 62], [320, 104]], "#20140a");
  seed = 4; for (let k = 0; k < 1400; k++) { const x = rnd() * W, y = rnd() * 104; if (y < 62 || (x > 60 && x < 260)) continue; px(x, y, rnd() < .5 ? "#2e1e10" : "#160c06"); }
  for (let y = 16; y < 62; y += 8) { seed = y; let yy = y; for (let x = 60; x < 260; x++) { if (rnd() < .2) yy += rnd() < .5 ? -1 : 1; yy = Math.max(y - 2, Math.min(y + 2, yy)); px(x, yy, "#1a0e06"); } }
  r(0, 0, W, 8, "#120904"); seed = 3; for (let x = 0; x < W; x += 6 + ((rnd() * 9) | 0)) { const h = 3 + ((rnd() * 8) | 0), w = 3 + ((rnd() * 3) | 0); for (let j = 0; j < h; j++) { const ww = Math.max(1, Math.round(w * (1 - j / h))); r(x + (w - ww) / 2, 8 + j, ww, 1, "#120904"); } }
  r(152, 0, 16, 8, "#7c6c4c"); r(155, 0, 10, 8, "#a8946c");
  // kaiverrettu oviaukko takaseinässä
  r(144, 26, 32, 36, "#0c0603"); disc(160, 26, 16, "#0c0603"); r(140, 26, 4, 36, "#5a4632"); r(176, 26, 4, 36, "#5a4632");
  for (let a = 0; a < Math.PI; a += .08) { px(160 + Math.cos(a) * 18, 26 - Math.sin(a) * 18, "#6c5640"); px(160 + Math.cos(a) * 19, 26 - Math.sin(a) * 19, "#86704e"); }
  for (let x = 146; x < 176; x += 7) { r(x, 10, 3, 2, "#3c2c1c"); px(x + 1, 10, "#86704e"); }
  // reliefi: muinainen otteluohjelma
  r(76, 20, 50, 30, "#3c2a18"); r(76, 20, 50, 1, "#56402a"); r(76, 49, 50, 1, "#1c1008");
  for (let row = 0; row < 4; row++) for (let c = 0; c < 6; c++) r(80 + c * 7, 24 + row * 6, 4, 3, (row + c) % 3 ? "#2a1c10" : "#56402a");
  r(108, 30, 14, 1, "#86704e"); r(108, 36, 10, 1, "#86704e");
  // seitit
  for (let k = 0; k < 7; k++) for (let j = 0; j < 14; j++) px(2 + j * Math.cos(k / 4.5), 8 + j * Math.sin(k / 4.5) * 1.2, "#5c5c5c");
  // lattia perspektiivissä: kivilaatat, rivit tihenevät kauemmas
  for (let y = 62; y < H; y++) { const [a, b] = floorX(y), k = (y - 62) / (H - 62); r(a, y, b - a, 1, y < CHASM.y0 ? "#3c2a18" : "#4c3420"); }
  for (const yy of [66, 71, 77, 104, 113, 124]) { const [a, b] = floorX(yy); r(a, yy, b - a, 1, "#2e1e10"); }
  for (let i = 1; i < 10; i++) { const xf = lerp(60, 260, i / 10), xn = lerp(-10, 330, i / 10); lineC(xf, 62, xn, H, "rgba(30,18,8,.6)"); }
  r(60, 62, 200, 1, "#5a3e26");
  // kuilu poikittain
  for (let y = CHASM.y0; y < CHASM.y1; y++) { const [a, b] = floorX(y), k = (y - CHASM.y0) / (CHASM.y1 - CHASM.y0); r(a, y, b - a, 1, k < .25 ? "#1c1008" : k < .6 ? "#0a0503" : "#000"); }
  { const [a, b] = floorX(CHASM.y0); r(a, CHASM.y0 - 1, b - a, 1, "#6c4c30"); } { const [a, b] = floorX(CHASM.y1); r(a, CHASM.y1, b - a, 1, "#6c4c30"); r(a, CHASM.y1 + 1, b - a, 1, "#2a1a0e"); }
  r(122, 98, 6, 4, "#d8d0b8"); px(123, 99, "#1c1008"); px(126, 99, "#1c1008"); r(129, 100, 5, 1, "#c8c0a8");
  // koukku katossa kuilun yllä, soihtujen pidikkeet, ovi vasemmalla
  r(160, 8, 1, 16, "#5c5c5c"); r(156, 23, 8, 2, "#7c7c7c"); r(163, 20, 1, 4, "#7c7c7c");
  r(34, 44, 6, 2, "#3c3c3c"); r(280, 44, 6, 2, "#3c3c3c");
  fillPoly([[2, 76], [18, 82], [18, 124], [2, 128]], "#0a0503"); lineC(18, 82, 18, 124, "#4a3622");
}
const DUST2 = Array.from({ length: 16 }, (_, i) => ({ x: 152 + (i * 7) % 16, y: (i * 13) % 70, s: 3 + (i % 4) }));
let darkC2 = null;
function temppeliDraw(t) {
  g.drawImage(paintBg("temppeli2", temppeliBg), 0, 0);
  if (st.flags.whipHung) r(160, 25, 1, 46, "#6c4420");
  if (st.flags.crossed) { fillPoly([[196, CHASM.y0], [209, CHASM.y0], [210, CHASM.y1], [195, CHASM.y1]], "#4a3420"); r(196, CHASM.y0, 13, 1, "#6c4c30"); }
}
function temppeliSand() { for (let j = 0; j < 12; j++) { const w = Math.round(32 * Math.pow((j + 1) / 12, .55)), y = 117 + j; for (let i = 0; i < w; i++) { const x = 54 - w / 2 + i; px(x, y, bay(x, y) < j / 12 ? "#b08c48" : bay(x, y) < .7 ? "#d8b46c" : "#c8a45c"); } } px(53, 117, "#f0d090"); }
function temppeliPillar() { shadow(252, 131, 16); r(236, 121, 32, 10, "#6c5a46"); r(236, 121, 32, 2, "#86704e"); r(236, 129, 32, 2, "#4c3c2c"); r(266, 121, 3, 10, "#5a4a38");
  r(245, 122, 1, 7, "#3c2c1c"); r(254, 123, 1, 6, "#3c2c1c"); disc(236, 126, 5, "#5a4a38"); }
function temppeliPedestal() { r(154, 64, 12, 12, "#7c6c5c"); r(163, 64, 3, 12, "#5c4c3c"); r(152, 62, 16, 3, "#9c8c7c"); r(152, 62, 16, 1, "#b4a494");
  if (!st.flags.idol) { const sp = Math.sin(performance.now() / 260); r(157, 54, 6, 8, "#e8c81c"); r(158, 52, 4, 2, "#e8c81c"); r(157, 54, 1, 8, "#fcf06c"); r(162, 54, 1, 8, "#b8941c");
    px(158, 56, "#3c2c0c"); px(161, 56, "#3c2c0c"); if (sp > .6) { px(160, 50, "#fff"); px(159, 51, "#fcfc9c"); px(161, 51, "#fcfc9c"); } }
  else if (st.flags.swapped) { r(156, 57, 8, 5, "#c8b48c"); r(156, 57, 8, 1, "#e0d0a8"); } }
// Kivenjärkäle vyöryy oviaukosta katsojaa kohti: y ja koko kasvavat.
const boulderY = () => 52 + st.flags.boulder * 92;
function temppeliBoulder() { if (st.flags.boulder == null) return; const k = st.flags.boulder, y = boulderY(), rad = 7 + k * 34, rot = k * 9;
  shadow(160, Math.min(y + rad * .2, 135), rad * .9); disc(160, y - rad * .8, Math.round(rad), "#6c5c4c", "#3c3024"); disc(160 - rad * .3, y - rad * 1.1, Math.round(rad * .3), "#84725e");
  r(160 + Math.cos(rot) * rad * .5, y - rad * .8 + Math.sin(rot) * rad * .5, rad * .25, rad * .18, "#3c3024"); r(160 - Math.cos(rot) * rad * .55, y - rad * .8 - Math.sin(rot) * rad * .4, rad * .2, rad * .2, "#3c3024"); }
function temppeliPost(t) {
  darkC2 ??= Object.assign(document.createElement("canvas"), { width: W, height: H });
  const L = darkC2.getContext("2d"); L.globalCompositeOperation = "source-over"; L.clearRect(0, 0, W, H); L.fillStyle = "rgba(6,3,0,.66)"; L.fillRect(0, 0, W, H);
  L.globalCompositeOperation = "destination-out";
  const hole = (x, y, rad, a) => { const gr = L.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(1, "rgba(0,0,0,0)"); L.fillStyle = gr; L.fillRect(x - rad, y - rad, rad * 2, rad * 2); };
  const f = Math.sin(t / 90) * 4 + Math.sin(t / 53) * 2;
  hole(37, 40, 70 + f, .95); hole(283, 40, 70 - f, .95); hole(st.x, st.y - 22, 44, 1);   // Jussi kokonaan valossa (17.10.: "Jussi on luolassa haalea") hole(160, 58, 30, .8);
  L.beginPath(); L.moveTo(152, 0); L.lineTo(168, 0); L.lineTo(176, 66); L.lineTo(144, 66); L.closePath(); L.fillStyle = "rgba(0,0,0,.6)"; L.fill();
  g.drawImage(darkC2, 0, 0);
  g.fillStyle = "rgba(255,236,170,.07)"; g.beginPath(); g.moveTo(152, 0); g.lineTo(168, 0); g.lineTo(176, 66); g.lineTo(144, 66); g.closePath(); g.fill();
  for (const d of DUST2) { d.y = (d.y + d.s * 0.012) % 64; px(d.x + Math.sin(t / 700 + d.y) * 3 + d.y * .08, d.y, "#f8e4b0"); }
  flame(36, 48, t); flame(282, 48, t); glow(37, 42, 34, "255,130,40", .28); glow(283, 42, 34, "255,130,40", .28);
}

// =============================================================== LATTIAPIANO (Kisapuisto)
// Tom Hanksin "Big" -elokuvan jättipiano heijastettuna maahan 3D-perspektiivissä
// (16.10.): kymmenen valokosketinta keskisyvyydellä, saumat seuraavat pakopistettä ja
// numerot litistyvät lattian kulmaan. Kisapuistossa parkkipaikan asfaltille. Koodi 1-9-8-5.
// Sama heijastettu numeropiano jokaisessa ruudussa: ruudun oma lattiakaista ja sen reunat.
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
const streetX = (y) => { const k = (y - 72) / 64; return [lerp(142, 20, k) + 4, Math.min(204, lerp(178, 300, k))]; };
const templeX = (y) => { const k = (y - 100) / 36; return [lerp(24, 2, k) + 8, lerp(296, 318, k) - 8]; };
const QUIZ_AREA = { koti: { y0: 98, y1: 116, edges: lotX }, basaari: { y0: 100, y1: 116, edges: streetX }, temppeli: { y0: 103, y1: 117, edges: templeX } };
const quizFlag = (scene = st.scene) => (scene === "koti" ? "pianoT" : `quizT_${scene}`);
function keyAt(x, y) {
  const A = QUIZ_AREA[st.scene]; if (!A || y < A.y0 || y > A.y1) return null;
  const [a, b] = A.edges(y), i = Math.floor((x - a) / (b - a) * 10);
  return i >= 0 && i < 10 ? KEYS[i] : null;
}
function keyQuad(i) { const A = QUIZ_AREA[st.scene], [a0, b0] = A.edges(A.y0), [a1, b1] = A.edges(A.y1);
  return [[lerp(a0, b0, i / 10), A.y0], [lerp(a0, b0, (i + 1) / 10), A.y0], [lerp(a1, b1, (i + 1) / 10), A.y1], [lerp(a1, b1, i / 10), A.y1]]; }
let lastKey = { k: null, t: 0 };
// Numerot ilmestyvät valona vasta salkkumiehen haasteessa (st.flags.pianoT = hetki),
// kosketin kerrallaan vasemmalta oikealle.
function satamaPiano(t) {
  const A = QUIZ_AREA[st.scene]; if (!A || !st.flags[quizFlag()]) return;
  const since = Date.now() - st.flags[quizFlag()], flick = .9 + .1 * Math.sin(t / 70);
  g.globalCompositeOperation = "lighter";
  for (let i = 0; i < 10; i++) {
    if (since < i * 90) continue;
    const q = keyQuad(i), lit = lastKey.k === KEYS[i] && t - lastKey.t < 450, fresh = since < i * 90 + 260, a = (lit ? .55 : fresh ? .45 : .16) * flick;
    g.fillStyle = `rgba(255,236,140,${a})`; g.beginPath(); q.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill();
    g.strokeStyle = `rgba(255,244,190,${lit ? .9 : .5})`; g.lineWidth = .6; g.stroke();
    // numero lattian kulmaan: leveys kuin koskettimen keskikohta, korkeus litistetty
    const cx = (q[0][0] + q[1][0] + q[2][0] + q[3][0]) / 4, cy = (A.y0 + A.y1) / 2 + 1, kw = (q[1][0] - q[0][0] + q[2][0] - q[3][0]) / 2;
    g.save(); g.translate(cx, cy); g.scale(1, .55); g.font = `${Math.round(kw * 1.05)}px VT323, monospace`; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillStyle = `rgba(255,${lit ? 120 : 250},${lit ? 90 : 210},${lit ? 1 : .75})`; g.fillText(KEYS[i], 0, 0); g.restore();
    if (lit) glow(cx, cy, 16, "255,230,120", .3);
  }
  g.globalCompositeOperation = "source-over"; g.textAlign = "left"; g.textBaseline = "alphabetic";
}

// Haamuilves (16.10.): oikean 1985-vastauksen jälkeen maahan heijastuu hetkeksi
// aavemainen ilveksen pää. Oma piirros (tupsukorvat, poskiparta, vinot silmät), ei seuran
// logo. Kesto ~3,2 s: häivähtää esiin, hehkuu, sammuu.
function ghostLynx(t) {
  if (!st.flags.ghostT) return;
  const since = Date.now() - st.flags.ghostT, D = 3200;
  if (since > D) return;
  const env = Math.sin(Math.PI * since / D), a = env * (.8 + .2 * Math.sin(t / 60)), rise = Math.min(1, since / 700);
  const cx = 160, cy = 92 - rise * 14, S = 1.15;
  glow(cx, cy, 52, "200,230,110", a * .25);
  g.save(); g.globalAlpha = a * .85; g.translate(cx, cy); g.scale(S, S);
  const P = (pts, c) => { g.fillStyle = c; g.beginPath(); pts.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill(); };
  // korvat tupsuineen
  P([[-17, -8], [-20, -36], [-6, -18]], "#e8d860"); P([[17, -8], [20, -36], [6, -18]], "#e8d860");
  P([[-15, -12], [-18, -30], [-9, -18]], "#8c7c2c"); P([[15, -12], [18, -30], [9, -18]], "#8c7c2c");
  P([[-20, -36], [-21, -44], [-18, -36]], "#1c1c10"); P([[20, -36], [21, -44], [18, -36]], "#1c1c10");
  // poskiparta ja pää
  P([[-18, 0], [-31, 8], [-22, 10], [-29, 17], [-16, 15], [-20, 22], [-6, 18]], "#d8e8a0"); P([[18, 0], [31, 8], [22, 10], [29, 17], [16, 15], [20, 22], [6, 18]], "#d8e8a0");
  P([[-18, -12], [-8, -20], [8, -20], [18, -12], [21, 2], [12, 15], [0, 19], [-12, 15], [-21, 2]], "#f0dc6c");
  // otsaraidat
  for (const x of [-6, 0, 6]) P([[x - 1, -19], [x + 1, -19], [x + .5, -11], [x - .5, -11]], "#6c5c1c");
  // silmät: keltaiset mantelit, pystypupilli, valoläikkä
  P([[-14, -4], [-9, -7], [-4, -4], [-9, -1]], "#fcf4a0"); P([[14, -4], [9, -7], [4, -4], [9, -1]], "#fcf4a0");
  P([[-9.6, -6.5], [-8.4, -6.5], [-8.4, -1.5], [-9.6, -1.5]], "#141408"); P([[8.4, -6.5], [9.6, -6.5], [9.6, -1.5], [8.4, -1.5]], "#141408");
  // valkoinen kuono, nenä, suu
  P([[-7, 4], [0, 1], [7, 4], [6, 12], [0, 15], [-6, 12]], "#fcfce8"); P([[-3, 4], [3, 4], [0, 7.5]], "#3c1c14");
  g.strokeStyle = "#3c1c14"; g.lineWidth = .7; g.beginPath(); g.moveTo(0, 7.5); g.lineTo(0, 10); g.moveTo(-4, 12); g.quadraticCurveTo(0, 9.5, 4, 12); g.stroke();
  g.restore();
  // hologrammin juovat
  g.fillStyle = `rgba(0,0,0,${a * .25})`; for (let y = cy - 52; y < cy + 28; y += 2) g.fillRect(cx - 40, y, 80, 1);
}

// Hologrammi-apu: sama kesto ja kirjekuori kaikille haamuille (flag = alkuhetki).
function holo(t, flag, cx, cy, draw, D = 3200) {
  const t0 = st.flags[flag]; if (!t0) return; const since = Date.now() - t0; if (since > D) return;
  const a = Math.sin(Math.PI * since / D) * (.8 + .2 * Math.sin(t / 60)), rise = Math.min(1, since / 700), y = cy - rise * 14;
  glow(cx, y, 50, "170,220,255", a * .25); g.save(); g.globalAlpha = a * .85; g.translate(cx, y); draw(); g.restore();
  g.fillStyle = `rgba(0,0,0,${a * .25})`; for (let yy = y - 52; yy < y + 28; yy += 2) g.fillRect(cx - 40, yy, 80, 1);
}
const PP = (pts, c) => { g.fillStyle = c; g.beginPath(); pts.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill(); };
// Stanley Cup -henkinen pokaali (porrastettu jalusta, malja päällä): basaarin 2006-visa.
function ghostCup(t) { holo(t, "cupT", 140, 96, () => {
  const S = "#dce8f4", D = "#8ca4bc", H = "#ffffff";
  for (const [w, y, h] of [[34, 12, 6], [30, 6, 6], [26, 0, 6], [22, -6, 6], [18, -12, 6]]) { PP([[-w / 2, y], [w / 2, y], [w / 2, y + h], [-w / 2, y + h]], S); PP([[w / 2 - 4, y], [w / 2, y], [w / 2, y + h], [w / 2 - 4, y + h]], D); }
  PP([[-4, -12], [4, -12], [3, -24], [-3, -24]], S); PP([[-14, -34], [14, -34], [10, -24], [-10, -24]], S); PP([[-14, -34], [14, -34], [14, -36], [-14, -36]], H); PP([[6, -34], [14, -34], [10, -24], [7, -24]], D);
  for (const y of [9, 3, -3, -9]) PP([[-8, y], [8, y], [8, y + 1], [-8, y + 1]], D); }); }
// Mestaruusmalja (iso kulho jalalla): temppelin 64-visa.
function ghostTrophy(t) { holo(t, "trophyT", 160, 86, () => {
  const S = "#f4ecd0", D = "#a89c74", H = "#ffffff";
  PP([[-14, 14], [14, 14], [10, 8], [-10, 8]], S); PP([[-3, 8], [3, 8], [2, -6], [-2, -6]], S);
  PP([[-24, -28], [24, -28], [18, -12], [8, -6], [-8, -6], [-18, -12]], S); PP([[10, -28], [24, -28], [18, -12], [8, -6]], D); PP([[-24, -30], [24, -30], [24, -28], [-24, -28]], H);
  PP([[-28, -26], [-24, -26], [-24, -16], [-28, -18]], D); PP([[28, -26], [24, -26], [24, -16], [28, -18]], D); }); }
// Muinaisen erotuomarin haamu temppelissä: raitapaita, pilli, läpikuultava.
function ghostRef(x, y, t, talking = false) {
  g.save(); g.globalAlpha = .55 + .15 * Math.sin(t / 300); const fl = Math.sin(t / 400) * 1.5;
  glow(x, y - 20 + fl, 26, "170,220,255", .2);
  r(x - 4, y - 12 + fl, 3, 8, "#1c1c1c"); r(x + 1, y - 12 + fl, 3, 8, "#1c1c1c");
  for (let k = 0; k < 7; k++) r(x - 6 + k * 2, y - 26 + fl, 2, 14, k % 2 ? "#1c1c1c" : "#f4f4f4");
  r(x - 8, y - 24 + fl, 2, 9, "#f4f4f4"); r(x + 6, y - 24 + fl, 2, 9, "#1c1c1c");
  r(x - 4, y - 36 + fl, 8, 10, "#e8d8c8"); r(x - 4, y - 38 + fl, 8, 3, "#9c9c9c"); px(x - 2, y - 33 + fl, "#1c1c1c"); px(x + 2, y - 33 + fl, "#1c1c1c");
  if (talking && Math.floor(t / 110) % 2) r(x - 1, y - 30 + fl, 3, 2, "#5c1c14"); else r(x - 2, y - 30 + fl, 4, 1, "#7c5c4c");
  r(x + 3, y - 31 + fl, 3, 2, "#c8c8c8"); px(x + 6, y - 31 + fl, "#c8c8c8");
  g.restore();
}
