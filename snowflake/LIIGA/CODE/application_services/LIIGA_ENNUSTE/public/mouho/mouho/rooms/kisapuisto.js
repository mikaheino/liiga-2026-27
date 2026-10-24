// Mouhon salaisuus -- Kisapuisto, Lappeenranta: grafiikka, hahmot, ruutu ja kohtaukset.
"use strict";
// Parkkipaikan perspektiivi: pakopiste hallin oven kohdalla, horisontti hallin juurella.
const VPK = [160, 52], BASE = 79;
const lotX = (y) => { const k = (y - 98) / 18; return [lerp(70, 56, k), lerp(236, 246, k)]; };
// Pilvijuovat: art_style_3:n tapaan vaakaviivoja, alapinta valaistu auringonlaskusta.
const CLOUDS = (() => { seed = 41; const out = [];
  for (const [cx, cy, n, w] of [[60, 14, 26, 70], [190, 9, 34, 110], [270, 24, 22, 60], [120, 30, 18, 80], [30, 34, 14, 50], [230, 38, 16, 70]])
    for (let i = 0; i < n; i++) out.push([cx + (rnd() - .5) * w, cy + (rnd() - .5) * 7, 3 + rnd() * 14]);
  return out; })();
// Kisapuisto kolmena osana (23.10.: liikkuva taivas): taivas, kolme ajelehtivaa pilvikerrosta
// (kaukaisin hitain) ja läpinäkyvä etuala, joka peittää pilvet rakennusten ja puiden kohdalta.
// kisaBg on koottu kiinteä versio (pilvet alkupaikoillaan) muille käyttäjille.
const KISA_CLOUDS = [[11, "#1e1c40", "#2c2854", "#5a3a6c", 26, 2], [25, "#3a2c58", "#5c3c66", "#c8607c", 18, 4], [40, "#5a3456", "#7c4460", "#f0a070", 14, 7]];
function kisaCloudBand(w, [by, dark, mid, lit, gap], k) {
  seed = 43 + k * 11;
  for (let x = -10 + ((rnd() * 20) | 0); x < w; ) { const cw = 12 + ((rnd() * 44) | 0), y = by + ((rnd() * 4) | 0) - 2;
    for (const xx of x + cw > w ? [x, x - w] : [x]) {           // kierrätys: reunan yli menevä pilvi myös alkuun
      r(xx, y + 1, cw, 2, dark); r(xx + 2, y, cw - 4, 1, mid); r(xx + 3, y - 1, cw * .5, 1, lit);
      if (cw > 22) { r(xx + cw * .3, y - 2, cw * .35, 1, mid); r(xx + cw * .3 + 1, y - 3, cw * .25, 1, lit); }
      dither(xx + 1, y + 3, cw - 2, 1, dark, by < 20 ? "#181a3c" : "#33285e", .5); }
    x += cw + gap + ((rnd() * gap) | 0); }
}
function kisaBg() { kisaSky(); KISA_CLOUDS.forEach((b, k) => kisaCloudBand(W, b, k)); kisaFg(); }
function kisaSky(moon = true) {      // moon = false: parkkipaikan taivas (sama taivas, kuu ja aurinko vain kerran)
  // taivas: yö ylhäällä, auringonlasku puiden takana oikealla
  vgrad(0, 0, W, 60, ["#10122c", "#181a3c", "#232250", "#33285e", "#4a3066", "#6a3a68", "#924a62", "#bc6258", "#dc8650", "#eca85a"]);
  seed = 5; for (let i = 0; i < 40; i++) { const x = (rnd() * W) | 0, y = (rnd() * 18) | 0; px(x, y, rnd() > .7 ? "#e8e8fc" : "#8c8cc8"); }
  // kuu ja sen dithattu kehä
  if (moon) for (let j = -9; j <= 9; j++) for (let i = -9; i <= 9; i++) { const d = Math.hypot(i, j); if (d > 5 && d < 9 && bay(212 + i, 15 + j) < (9 - d) / 8) px(212 + i, 15 + j, "#3a3870"); }
  if (moon) { disc(212, 15, 5, "#f4ecd0"); disc(213, 16, 3, "#e4dcc0"); px(210, 17, "#c8c0ac"); px(214, 13, "#d8d0bc"); r(209, 12, 2, 1, "#fffbe8"); }
  // kirkas horisonttinauha puiden takana
  dither(0, 52, W, 3, "#dc8650", "#eca85a", .5); dither(150, 54, 170, 6, "#eca85a", "#f8c870", .4);
  // aurinko juuri laskenut: hehku puiden takana
  if (moon) for (let j = -18; j <= 0; j++) for (let i = -40; i <= 40; i++) { const d = Math.hypot(i / 2.2, j); if (d < 18 && bay(250 + i, 58 + j) < (18 - d) / 22) px(250 + i, 58 + j, "#f8c870"); }
}
function kisaFg() {
  // Kaukaan tehdas ja piippu vasemmalla kaukana (kisapuisto_4), höyry ja punainen lentoestevalo
  r(4, 44, 34, 16, "#2c2440"); r(10, 40, 12, 4, "#2c2440"); r(26, 14, 4, 46, "#342a48"); r(25, 13, 6, 2, "#40345a");
  for (let k = 0; k < 6; k++) disc(30 + k * 5, 10 - k * 1.5, 3 + k, k < 3 ? "#8c7c9c" : "#6c5c84");
  for (const [x, y] of [[8, 47], [14, 47], [20, 50], [32, 47]]) r(x, y, 2, 1, "#f0c070");
  // metsä: männyt (tumma) ja koivut (keltainen ruska), vaihteleva latvarivi
  seed = 23;
  for (let x = -6; x < W + 6; x += 3 + ((rnd() * 5) | 0)) { const h = 10 + ((rnd() * 16) | 0), y = 62 - h;
    r(x + 2, y + 4, 1, h, "#1a1626"); for (let j = 0; j < h - 2; j += 2) { const tx = x + 2 - Math.min(3, j / 4), tw = 1 + Math.min(6, j / 2);
      r(tx, y + j, tw, 2, j % 4 ? "#1c2230" : "#222a38"); r(tx, y + j + 1, Math.max(1, tw / 2), 1, "#161a2a"); if (x > 150 && tw > 2) px(tx + tw - 1, y + j, "#6a4060"); } }
  // ruskakoivut taustalla: kolmisävyiset klusterit, lämmin reuna auringon puolella (oikea yläkulma)
  for (const [x, y, s] of [[44, 46, 7], [92, 44, 6], [276, 44, 8], [300, 48, 6], [140, 48, 5]]) {
    r(x, y + s - 2, 1, 14, "#d8d0c8"); r(x + 1, y + s - 2, 1, 14, "#8c849c"); px(x, y + s + 3, "#2c2c2c");
    for (const [ox, oy, k] of [[-s * .6, 0, .7], [s * .5, -s * .2, .8], [0, -s * .5, .75], [-s * .2, s * .3, .6]]) { const cx = x + ox, cy = y + oy, rr = Math.max(2, (s * k) | 0);
      disc(cx | 0, cy | 0, rr, "#6c3c40"); disc((cx + .7) | 0, (cy - .7) | 0, rr - 1, "#b8802c"); disc((cx + 1) | 0, (cy - 1.5) | 0, Math.max(1, rr - 2), "#e0a840"); px(cx + rr - 1, cy - rr + 1, "#f8d868"); } }
  // kuuset oikealla: tumma runkokartio, kylmä varjopuoli, lämmin reunavalo
  for (const [x, h] of [[296, 26], [312, 32], [228, 20]]) for (let j = 0; j < h; j += 3) { const w = 2 + ((j * 7 / h) | 0), y = 62 - h + j;
    r(x - w, y, w * 2 + 1, 3, "#1e2434"); r(x - w, y + 2, w * 2 + 1, 1, "#141826"); r(x - w, y, w, 2, "#161c2c"); r(x + 1, y, w - 1, 1, "#3a3450"); px(x + w, y + 1, "#8c5468"); }
  r(0, 62, W, BASE - 62, "#161a26"); dither(0, 62, W, 4, "#1c2230", "#161a26", .5);
  // horisontin usva puiden juurella: harva dither, tihenee alas
  for (let y = 54; y < 66; y++) for (let x = 0; x < W; x++) { const f = 1 - Math.abs(y - 61) / 6; if (bay(x, y) < f * .32 + .06 * Math.sin(x / 23)) px(x, y, y < 61 ? "#5a4870" : "#3c3656"); }
  // --- halli: keltainen lohko vasemmalla, harmaa pääsali harjakattoineen, valkoinen matala osa edessä
  // pääsali (aaltopelti, hämärän violetti)
  // sävyramppi: lämmin pinkki-oranssi taivaalle päin yläreunassa -> kylmä violetti varjo alhaalla
  const HALL = ["#c8949a", "#a4849e", "#86769a", "#6c668c", "#56547a"], HRIB = ["#b08088", "#8c7090", "#70648a", "#5a547c", "#46446a"];
  for (let x = 104; x < 264; x++) { const top = Math.ceil(x < 178 ? 40 - (x - 104) * 16 / 74 : 24 + (x - 178) * 16 / 86), rib = (x - 106) % 3 === 0, P = rib ? HRIB : HALL;
    for (let y = top; y < BASE; y++) { const f = Math.min(4, Math.max(0, (y - top) / 5 + (x > 178 ? .6 : 0))), k = f | 0, fr = f - k; px(x, y, P[Math.min(4, k + (bay(x, y) < fr ? 1 : 0))]); } }
  fillPoly([[178, 24], [264, 40], [264, 43], [178, 27]], "#5c5a74");
  lineC(104, 39, 178, 23, "#f4c8a0"); lineC(178, 23, 264, 39, "#d89890"); lineC(104, 40, 178, 24, "#e0a48c"); lineC(178, 24, 264, 40, "#46445c");   // reunavalo + kattoreuna
  // paneelisaumat niitteineen ja valumajäljet katon alta
  for (const x of [122, 142, 162, 196, 218, 240, 258]) { const top = Math.ceil(x < 178 ? 40 - (x - 104) * 16 / 74 : 24 + (x - 178) * 16 / 86) + 2;
    r(x, top, 1, 62 - top, "#4a4870"); r(x + 1, top, 1, 62 - top, "#8c84a4");
    for (let y = top + 3; y < 61; y += 6) px(x - 1, y, "#c0a4b0"); }
  for (const [x, n] of [[132, 9], [150, 6], [204, 11], [230, 7], [252, 8]]) { const top = Math.ceil(x < 178 ? 40 - (x - 104) * 16 / 74 : 24 + (x - 178) * 16 / 86) + 2;
    for (let y = top; y < top + n; y++) if (bay(x, y) < 1 - (y - top) / n) px(x, y, "#5a4c6c"); px(x, top, "#46405e"); }
  // räystäskouru ja syöksytorvi oikealla
  lineC(178, 26, 264, 42, "#2c2a40"); r(262, 42, 2, BASE - 42, "#3a3852"); r(262, 42, 1, BASE - 42, "#6c6888"); r(260, BASE - 2, 4, 2, "#3a3852");
  // ruoste- ja likaklusterit kylkiä rikkomaan
  for (const [x, y, n] of [[124, 48, 7], [206, 42, 5], [246, 50, 9]]) { r(x, y, 2, n, "#8c5a4c"); r(x + 1, y + 2, 2, n - 2, "#6c4448"); px(x, y, "#b4745c"); px(x + 3, y + n - 3, "#6c4448"); r(x - 1, y + n, 4, 1, "#4c3c50"); }
  // toimistoikkunan lämmin valo seinälle (dithattu)
  for (let j = -8; j < 14; j++) for (let i = -14; i < 16; i++) { const d = Math.hypot(i / 15, j / 11); if (d < 1 && bay(169 + i, 56 + j) < (1 - d) * .55) px(169 + i, 56 + j, "#c8a090"); }
  r(176, 18, 1, 8, "#3c3a4c"); px(176, 17, "#fc4c3c");                                       // antenni
  r(160, 50, 18, 12, "#34324a"); r(162, 52, 14, 8, "#ffd890"); r(162, 52, 14, 1, "#fff0c0");  // ylempi ikkuna (toimisto)
  // keltainen lohko: ylhäällä valossa, alhaalla varjossa
  r(50, 28, 58, BASE - 28, "#d8a42c"); vgrad(50, 28, 58, 14, ["#e8b83c", "#d8a42c"]); dither(50, 62, 58, BASE - 62, "#d8a42c", "#b4842c", .45);
  for (let x = 52; x < 108; x += 3) r(x, 30, 1, BASE - 30, "#c8962a"); r(50, 28, 58, 1, "#f8d060"); r(107, 28, 1, BASE - 28, "#9c7424");
  r(48, 26, 62, 2, "#3c3448"); r(70, 20, 10, 6, "#4c4458"); r(72, 18, 6, 2, "#5c546c");      // katto ja ilmanvaihto
  // mainostaulu keltaisessa seinässä: maalivahti ja teksti
  r(56, 40, 46, 22, "#f4dc5c"); r(56, 40, 46, 1, "#fcf09c"); r(56, 61, 46, 1, "#b8942c");
  // kyltin sisältö (SaiPan logo ja teksti) piirretään tuplatarkkana kisaDraw:ssa: saipaSign()
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
  vgrad(0, BASE, W, H - BASE, ["#3a3456", "#32304e", "#2c2e48", "#262e42", "#202a3a", "#1c2632", "#18202c"]);
  seed = 61; for (let k = 0; k < 260; k++) { const x = (rnd() * W) | 0, y = BASE + 2 + ((rnd() * (H - BASE)) | 0); r(x, y, 2 + ((rnd() * 2) | 0), 1, rnd() > .5 ? "#34344c" : "#141622"); }   // kiviaines klustereina
  // aulan lämmin valo asfaltilla ovien edessä (dithattu, porrastettu)
  for (let j = 0; j < 22; j++) for (let i = -44; i <= 44; i++) { const d = Math.hypot(i / 44, j / 22); if (d < 1 && bay(158 + i, 80 + j) < (1 - d) * .7) px(158 + i, 80 + j, d < .45 ? "#7a5e50" : "#4e4250"); }
  // sisäänkäynnin valokeila: levenevä, dithattu trapetsi ovista kohti katsojaa
  for (let y = BASE + 1; y < BASE + 34; y++) { const t = (y - BASE) / 34, x0 = 124 - t * 30, x1 = 194 + t * 30;
    for (let x = x0 | 0; x <= x1; x++) { const u = Math.min(x - x0, x1 - x) / 10; if (bay(x, y) < Math.min(1, u) * (1 - t) * .5) px(x, y, t < .35 ? "#6a5458" : "#4a4054"); } }
  // lyhtyjen pehmeä halo taustassa (dithattu, porrastettu)
  for (const [lx, ly] of [[24, 52], [286, 50]]) for (let j = -14; j <= 14; j++) for (let i = -14; i <= 14; i++) { const d = Math.hypot(i, j) / 14;
    if (d < 1 && bay(lx + i, ly + j) < (1 - d) * .5) px(lx + i, ly + j, d < .4 ? "#c89c74" : "#7c5c6c"); }
  // lätäköt: taivaan heijastus + pystysuorat valojuovat ikkunoista ja vasemmasta lyhdystä
  for (const [cx, cy, rx, ry] of [[30, 104, 20, 3], [160, 109, 36, 7], [104, 121, 18, 3], [212, 118, 22, 3], [58, 130, 14, 2]]) for (let j = -ry; j <= ry; j++) for (let i = -rx; i <= rx; i++) {
    const x = cx + i, y = cy + j, e = (i * i) / (rx * rx) + (j * j) / (ry * ry); if (e > 1 || (e > .7 && bay(x, y) < .5)) continue;
    const fall = (j + ry) / (2 * ry), rip = ((y * 3) % 5 < 2 ? 1 : 0) - (y % 4 === 0 ? 1 : 0), xs = x + rip;   // aaltoileva pystyheijastus
    const wc = (xs - 126) % 11, win = xs >= 126 && xs < 192 && wc >= 1 && wc <= 7, edge = wc === 1 || wc === 7, lamp = Math.abs(xs - 24) < 3;
    px(x, y, j === -ry ? "#56607c" : e > .55 ? "#303852" : "#38425e");
    if (j === ry || (e > .8 && j > 0)) { px(x, y, "#1a1c2c"); continue; }                     // tumma lätäkön reuna lähipuolella
    if ((win || lamp) && bay(x, y) < (edge ? .45 : 1) - fall * .55) px(x, y, lamp ? (fall < .5 ? "#f0e0a8" : "#a89470") : fall < .3 ? "#ecc884" : fall < .65 ? "#c8a06c" : "#8c6c54"); }
  // öljytahrat ja kulunut halkeama
  for (const [x, y] of [[84, 113], [198, 128], [138, 96]]) { r(x, y, 6, 2, "#151424"); r(x + 1, y - 1, 3, 1, "#151424"); r(x + 2, y + 2, 3, 1, "#151424"); px(x + 2, y, "#4c3c6c"); px(x + 3, y, "#2c5c5c"); }
  for (const [x0, y0, x1, y1] of [[58, 98, 64, 101], [64, 101, 68, 105], [68, 105, 70, 109], [70, 109, 78, 113]]) { lineC(x0, y0, x1, y1, "#100e18"); lineC(x0 + 1, y0, x1 + 1, y1, "#3e3e58"); }
  r(0, BASE, W, 1, "#4c4860"); r(0, BASE + 1, W, 1, "#2a2638");                                       // reunakivi
  // ruutuviivat kohti pakopistettä: kaukainen rivi hallin edessä ja lähirivi alhaalla
  for (let i = -6; i <= 6; i++) { const xb = 160 + i * 34; lineC(lerp(VPK[0], xb, (82 - VPK[1]) / (96 - VPK[1])), 82, xb, 96, "rgba(220,220,230,.28)"); }
  r(10, 96, 300, 1, "rgba(220,220,230,.22)");
  for (let i = -5; i <= 5; i++) { const xb = 160 + i * 64; lineC(lerp(VPK[0], xb, (122 - VPK[1]) / (H - VPK[1])), 122, xb, H, "rgba(220,220,230,.18)"); }
  // pysäköidyt autot hallin edessä (kaukana)
  for (const [x, c, d] of [[36, "#5c6c7c", 1], [70, "#9c2c2c", -1], [232, "#3c4c5c", 1], [268, "#c8c4bc", -1]]) parkedCar(x, 80, c, d);
  // nurmikaistale ja lehtiä vasemmalla edessä
  vgrad(0, 126, 64, 10, ["#2c3c24", "#22301c"]); seed = 77; for (let k = 0; k < 60; k++) px(rnd() * 70, 124 + rnd() * 12, ["#c8782c", "#e8a83c", "#8c4c1c", "#3c4c2c"][(rnd() * 4) | 0]);
  r(0, 125, 66, 1, "#5c5c68"); fillPoly([[66, 125], [74, 136], [72, 136], [64, 126]], "#4c4c58");
  // tummat etualan pensaat syvyydeksi (kylmä siluetti, ohut lämmin reunavalo)
  for (const [bx, by, bw] of [[-4, 129, 40], [24, 131, 30], [288, 128, 36], [306, 125, 20]]) { seed = bx + 200;
    for (let x = bx; x < bx + bw; x++) { const h = 3 + Math.round(Math.sin((x - bx) / bw * Math.PI) * (bw / 6)) + ((rnd() * 2) | 0), top = by + (bw / 6) - h + 3;
      r(x, top, 1, H - top, "#0e1018"); if (x % 3 === 0) px(x, top, "#2a2438"); if (x % 5 === 1) px(x, top - 1, "#0e1018"); } }
  // koivu vasemmalla edessä: valkoinen runko mustin juovin, keltainen latvus kehyksenä
  r(4, 16, 4, 112, "#e8e4dc"); r(7, 16, 1, 112, "#b8b4ac"); for (let y = 22; y < 126; y += 7 + (y % 5)) r(4 + (y % 3), y, 2, 1, "#2c2c2c");
  lineC(6, 40, 22, 26, "#d8d4cc", 2); lineC(6, 60, -4, 48, "#d8d4cc", 2);
  // latvus klustereina: kylmä varjopuoli vasemmalla alhaalla, lämmin reunavalo oikealla ylhäällä
  seed = 91; for (let k = 0; k < 26; k++) { const a = rnd() * 6.3, d = Math.sqrt(rnd()) * 17, cx = (12 + Math.cos(a) * d * 1.4) | 0, cy = (16 + Math.sin(a) * d) | 0, rr = 2 + ((rnd() * 3) | 0);
    disc(cx, cy, rr, "#6c3c34"); disc(cx + 1, cy - 1, rr - 1, "#c8902c"); if (rr > 2) disc(cx + 1, cy - 2, rr - 2, "#e8b440"); px(cx + rr - 1, cy - rr + 1, "#f8d868"); px(cx + rr, cy - 1, "#f8d868"); }
}
// Pysäköity sedan sivulta (17.10.: autot paremmiksi). d = 1 keula oikealle, -1 vasemmalle.
// Kori kahdella sävyllä, ikkunoissa taivaan heijastus, ovisaumat, valot, vanteet ja märän
// asfaltin heijastus auton alla.
function parkedCar(x, y, c, d) {
  const sh = (hex, k) => { const n = parseInt(hex.slice(1), 16), f = (v) => Math.max(0, Math.min(255, Math.round(v * k))); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; };
  const X = (dx, w = 1) => (d > 0 ? x + dx : x + 24 - dx - w);       // peilaus keulan suunnan mukaan
  for (let k = 0; k < 4; k++) r(x + 1, y + 12 + k, 22, 1, `rgba(${parseInt(c.slice(1, 3), 16)},${parseInt(c.slice(3, 5), 16)},${parseInt(c.slice(5, 7), 16)},${.16 - k * .04})`);   // heijastus
  r(x + 1, y + 10, 22, 2, "rgba(0,0,0,.45)");                                                // varjo
  r(x, y + 5, 24, 5, c); r(x, y + 5, 24, 1, sh(c, 1.35)); r(x, y + 9, 24, 1, sh(c, .6));     // kori
  r(X(19, 5), y + 4, 5, 1, c); r(X(0, 4), y + 4, 4, 1, c);                                   // konepelti ja takakontti
  fillPoly(d > 0 ? [[x + 5, y + 4], [x + 8, y], [x + 16, y], [x + 19, y + 4]] : [[x + 5, y + 4], [x + 8, y], [x + 16, y], [x + 19, y + 4]], sh(c, .9));   // ohjaamo
  r(x + 9, y + 1, 3, 3, "#9cb4d8"); r(x + 13, y + 1, 3, 3, "#7c94b8"); px(x + 9, y + 1, "#d8e8fc"); r(x + 12, y + 1, 1, 3, sh(c, .7));   // ikkunat
  px(X(7), y + 2, "#8ca4c8"); px(X(16), y + 2, "#6c84a8");
  r(x + 12, y + 5, 1, 4, sh(c, .7)); px(x + 9, y + 6, sh(c, 1.4)); px(x + 15, y + 6, sh(c, 1.4));   // ovisauma ja kahvat
  r(X(23), y + 6, 1, 2, "#fcf4c8"); r(X(0), y + 6, 1, 2, "#c81c1c");                       // ajovalo ja takavalo
  r(X(9, 4), y + 8, 4, 1, "#e8e8e8");                                                        // rekisterikilpi
  for (const wx of [x + 5, x + 19]) { disc(wx, y + 10, 2, "#0c0c10"); px(wx, y + 10, "#9c9ca8"); r(wx - 3, y + 7, 6, 1, sh(c, .5)); }   // renkaat ja vanteet
}
// SaiPan kyltti "Tervetuloa peliin" keltaiseen seinään: tuplatarkka, logo vasemmalla.
let _saipaSign = null;
function saipaSign() {
  if (_saipaSign) return _saipaSign;
  const cnv = document.createElement("canvas"); cnv.width = 92; cnv.height = 44; const prev = g; g = cnv.getContext("2d");
  r(0, 0, 92, 44, "#f4dc5c"); r(0, 0, 92, 2, "#fcf09c"); r(0, 42, 92, 2, "#b8942c");
  // logo: musta neljän sakaran tähti vinottain, keltainen kiekko mustin reunoin, SaiPa-teksti
  const cx = 22, cy = 22; g.fillStyle = "#141414";
  for (const [ax, ay] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { g.beginPath(); g.moveTo(cx + ax * 20, cy + ay * 20); g.lineTo(cx + ax * 9 - ay * 5, cy + ay * 9 + ax * 5); g.lineTo(cx + ax * 9 + ay * 5, cy + ay * 9 - ax * 5); g.closePath(); g.fill(); }
  g.beginPath(); g.arc(cx, cy, 16, 0, 7); g.fill(); g.fillStyle = "#f8dc18"; g.beginPath(); g.arc(cx, cy, 14, 0, 7); g.fill();
  g.fillStyle = "#141414"; g.font = "italic bold 10px Arial, Helvetica, sans-serif"; g.textAlign = "center"; g.fillText("SaiPa", cx, cy + 3);
  g.font = "bold 6px Arial, sans-serif"; g.fillText("1948", cx, cy + 11); g.textAlign = "left";
  text3("TERVETULOA", 47, 14, "#3c2c10"); text3("PELIIN", 47, 24, "#3c2c10");
  g = prev; return (_saipaSign = cnv);
}
const LEAVES = Array.from({ length: 9 }, (_, i) => ({ x: (i * 53) % W, s: .3 + (i % 3) * .15, ph: i * 1.7 }));
function kisaDraw(t) {
  g.drawImage(paintBg("kisa_sky", kisaSky), 0, 0);
  KISA_CLOUDS.forEach((b, k) => drift(`kisa_cloud${k}`, b[5], (w) => kisaCloudBand(w, b, k), t));     // kaukaisin hitain
  g.drawImage(paintBg("kisa_fg", kisaFg), 0, 0);
  g.imageSmoothingEnabled = false; g.drawImage(saipaSign(), 56, 40, 46, 22);
  // lyhtypylväät: kaukainen oikealla, valokeila ja heijastus märässä asfaltissa
  for (const [x, y0, h] of [[24, 84, 34], [286, 88, 40]]) {
    r(x, y0 - h, 1, h, "#2c2a38"); r(x - 3, y0 - h - 1, 7, 2, "#3c3a4c"); r(x - 2, y0 - h + 1, 5, 1, "#fff0b0");
    glow(x, y0 - h + 2, 26, "255,214,140", .3 + .03 * Math.sin(t / 140 + x));
    for (let j = -5; j <= 5; j++) for (let i = -18; i <= 18; i++) { const d = Math.hypot(i / 18, j / 5); if (d < 1 && bay(x + i, y0 + 2 + j) < (1 - d) * 1.1) px(x + i, y0 + 2 + j, d < .35 ? "#c8a464" : d < .7 ? "#7c6450" : "#4a4048"); }   // porrastettu valolammikko
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
  // matala aita nurmikaistaleen reunalla, pudonneet lehdet klustereina
  r(0, 121, 64, 1, "#a8987c"); r(0, 122, 64, 1, "#6c5c50"); for (let x = 2; x < 64; x += 9) { r(x, 120, 2, 6, "#8c7c68"); px(x, 120, "#c8b898"); px(x + 1, 125, "#4c3c40"); }
  for (const [x, y] of [[8, 129], [22, 132], [36, 128], [50, 133], [14, 134], [42, 131]]) { r(x, y, 2, 1, "#c8782c"); px(x + 1, y - 1, "#e8a83c"); px(x + 2, y + 1, "#8c4c1c"); px(x - 1, y + 1, "#e8a83c"); }
  // valolammikko laatikon alla ja kovat heittovarjot: kaikki vasemmalle, poispäin oikeasta lyhdystä
  const [bx, by] = BOX_AT;
  for (let j = -3; j <= 3; j++) for (let i = -20; i <= 20; i++) { const d = Math.hypot(i / 20, j / 3); if (d < 1 && bay(bx + i, by + j) < (1 - d) * .8) px(bx + i, by + j, d < .5 ? "#8c6c4c" : "#5c4c48"); }
  g.fillStyle = "rgba(24,16,44,.6)";
  fillPoly([[bx - 9, by], [bx + 13, by], [bx + 4, by + 3], [bx - 20, by + 3]], g.fillStyle);
  { const s = depth(st.y); fillPoly([[st.x - 3 * s, st.y], [st.x + 3 * s, st.y], [st.x - 9 * s, st.y + 3 * s], [st.x - 15 * s, st.y + 3 * s]], "rgba(24,16,44,.6)"); }
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
// SaiPan toimiston postilaatikko seinällä keltaisen oven vieressä (sokkotesti 2, 17.10.:
// pelaaja yritti palauttaa setelin ovelle -- laatikon kuuluu olla siinä, mistä sitä etsitään).
function kisaPostbox() {
  const open = st.flags.boxOpen;
  r(229, 71, 9, 8, "#2c2c34"); r(229, 71, 8, 7, "#e8b83c"); r(229, 71, 8, 1, "#fcd870"); r(229, 77, 8, 1, "#a07c24");
  if (open) { r(229, 69, 8, 2, "#f0c450"); r(230, 72, 6, 4, "#14121a"); if (!st.flags.letterTaken) { r(231, 73, 4, 2, "#f4f4f4"); px(233, 73, "#c81c1c"); } }
  else { r(230, 73, 6, 1, "#3c2c10"); px(237, 72, "#c81c1c"); px(237, 73, "#c81c1c"); } }
function kisaRack() { // pysäköintiautomaatti
  shadow(206, 96, 5); r(203, 80, 7, 16, "#5c6070"); r(203, 80, 7, 1, "#8c90a0"); r(204, 82, 5, 3, "#9cd0fc"); r(205, 87, 3, 1, "#1c1c24"); r(202, 95, 9, 1, "#2c2c34");
  r(201, 76, 2, 3, "#2c64c8"); text3("P", 199, 70, "#2c64c8");
}
function kisaPig() { g.save(); g.translate(0, 7);
  r(140, 113, 22, 2, "#6c6c78"); r(140, 115, 22, 1, "#3c3c48");                                  // betoninen pysäköintiste
  shadow(152, 114, 6); r(147, 108, 9, 6, "#fc9cb4"); r(146, 109, 11, 4, "#fc9cb4"); r(148, 108, 5, 1, "#fcbccc"); r(156, 110, 2, 2, "#fc7c9c");
  px(148, 114, "#d87c94"); px(154, 114, "#d87c94"); r(149, 108, 3, 1, "#3c1c24"); px(154, 109, "#000"); g.restore(); }
function kisaBox() { // Jussin pahvilaatikko Liigan toimistolta (piirretty x 229-255, siirretty pianon alle)
  g.save(); g.translate(BOX_AT[0] - 242, BOX_AT[1] - 121); shadow(242, 121, 9); r(233, 110, 18, 11, "#b8925c"); r(233, 110, 18, 1, "#d8b27c"); r(242, 110, 1, 11, "#8c6c3c");
  fillPoly([[233, 110], [229, 106], [238, 106], [241, 110]], "#c8a26c"); fillPoly([[251, 110], [255, 106], [247, 106], [244, 110]], "#a8824c");
  r(236, 103, 4, 5, "#f4f4ec"); r(236, 103, 4, 1, "#c81c1c");                                     // kahvikuppi
  // nimikyltti ei ole laatikossa: se putosi Jussin päähän ja on tavaroissa
  // LIIGA-tarra luettavana (17.10.: "LIIG"): I-kirjaimet yhden pikselin levyisinä, jotta sana mahtuu.
  r(233, 111, 19, 9, "#2c2c3c"); r(234, 112, 17, 7, "#f4f0e4"); liigaWord(235, 113, "#1c1c2c"); g.restore(); }
function liigaWord(x, y, c) {
  r(x, y, 1, 5, c); r(x, y + 4, 3, 1, c);                                                   // L
  r(x + 4, y, 1, 5, c); r(x + 6, y, 1, 5, c);                                               // I I
  r(x + 8, y, 3, 1, c); r(x + 8, y, 1, 5, c); r(x + 8, y + 4, 3, 1, c); r(x + 10, y + 2, 1, 3, c); px(x + 9, y + 2, c);   // G
  r(x + 12, y + 1, 1, 4, c); r(x + 14, y + 1, 1, 4, c); px(x + 13, y, c); r(x + 12, y + 2, 3, 1, c); }   // A
function kisaTaxi() { shadow(282, 134, 40);
  fillPoly([[244, 129], [252, 136], [230, 136], [236, 129]], "rgba(24,16,44,.6)");                       // heittovarjo vasemmalle
  for (const [x, w, a] of [[239, 3, .28], [234, 5, .14], [227, 7, .06]]) r(x, 113 - (242 - x) / 4, w, 2 + (242 - x) / 2, `rgba(255,60,40,${a})`);   // porrastettu takavalokeila
  // kori: 4-portainen ramppi (oranssinruskea varjo -> lämmin keltainen -> vaalea kerma)
  r(242, 108, 78, 22, "#e0b42c"); r(242, 109, 78, 4, "#f0cc48"); r(242, 108, 78, 1, "#fcf0b8"); r(242, 120, 78, 7, "#b8821c"); r(242, 127, 78, 3, "#6c3c18");
  r(242, 108, 1, 19, "#a86c1c"); r(306, 108, 14, 1, "#fcf0b8"); r(318, 109, 2, 18, "#a86c1c");          // takakulma, konepellin reuna, keula
  r(256, 96, 50, 13, "#e0b42c"); r(256, 96, 50, 3, "#f0cc48"); r(257, 95, 48, 1, "#fcf0b8"); r(256, 96, 1, 13, "#a86c1c"); r(305, 96, 1, 13, "#c8901c");
  r(259, 97, 21, 11, "#6c3c18"); r(282, 97, 22, 11, "#6c3c18");                                           // ikkunakehykset
  r(260, 98, 19, 9, "#4c6ca0"); r(283, 98, 20, 9, "#4c6ca0"); r(260, 103, 19, 4, "#3c5488"); r(283, 103, 20, 4, "#3c5488");
  r(261, 99, 4, 1, "#c8d8fc"); r(284, 99, 4, 1, "#c8d8fc"); px(261, 100, "#9cb4e0"); r(264, 101, 6, 4, "#2c2c3c");
  r(272, 90, 18, 5, "#202020"); r(273, 91, 16, 3, "#fcd41c"); text3("TAKSI", 271, 90, "#202020");
  r(281, 109, 1, 18, "#7c4a14"); r(282, 109, 1, 18, "#f4d45c"); r(256, 109, 1, 18, "#7c4a14");            // ovisaumat
  for (const x of [266, 288]) { r(x, 112, 4, 1, "#fcf0b8"); r(x, 113, 4, 1, "#7c4a14"); }                // kahvat
  r(242, 115, 78, 1, "#202020"); for (let x = 244; x < 320; x += 4) px(x, 115, "#e8e8e8");
  for (const wx of [258, 306]) { r(wx - 9, 121, 18, 2, "#3c2410"); disc(wx, 130, 7, "#141418", "#24222c"); r(wx - 3, 123, 6, 1, "#4c4a5c"); px(wx + 4, 124, "#4c4a5c");
    disc(wx, 130, 4, "#5c5c6c"); disc(wx, 130, 3, "#9c9cac"); disc(wx, 130, 1, "#5c5c6c"); r(wx - 2, 128, 2, 1, "#f4f4fc"); px(wx + 2, 132, "#6c6c7c"); }   // renkaat, vanteet, hattu
  r(242, 111, 3, 4, "#fc3c1c"); px(242, 111, "#fca08c"); r(316, 112, 4, 3, "#fff4c8"); glow(318, 113, 18, "255,240,180", .3);
  for (let x = 266; x < 298; x++) if (bay(x, 133) < .4) px(x, 133, "#8c6c24"); }
// Mouhon salaisuus -- sisältö: esineet, ruudut ja tarina Mouho-moottorille.
// Kisapuiston hahmot (määritelty ennen ruutuja, koska Kisapuisto viittaa niihin).
// Raimo Helminen on SaiPan valmentaja: tulee hallin ovesta. Saarni ja Jokerit-maskotti
// kävelevät taustalla autolta SaiPan toimistoon (vaihe 4, 17.10.).
const RAIMO = { id: "helminen", x: 158, y: 84, h: 46, color: "#fcd41c", moving: false, dir: 1, hidden: () => !st.flags.raimo,
  draw(t, talking) { helminen(this.x, this.y, t, talking, this.moving, this.dir); } };
const SAARNI = { id: "saarni", x: 40, y: 94, h: 46, color: "#a8c8e8", moving: false, dir: 1, hidden: () => !st.flags.saarniHere,
  draw(t, talking) { person("saarni", this.x, this.y, t, { moving: this.moving, dir: this.dir, talking }); } };
const MASKOTTI = { id: "maskotti", x: 22, y: 95, h: 50, color: "#d8242c", moving: false, dir: 1, hidden: () => !st.flags.saarniHere,
  draw(t, talking) { person("maskotti", this.x, this.y, t, { moving: this.moving, dir: this.dir, talking }); } };
// Kari Jalonen (23.10.): tulee Myrrän ensimmäisen puhelun jälkeen katsomaan SaiPan treenejä
// hallin ikkunasta. Lyhyen sanan mestari; kädessä työeläkekortti, jonka hän aikoo leimauttaa.
const JALONEN = { id: "jalonen", x: 134, y: 88, h: 46, color: "#9cc0ec", moving: false, dir: 1, hidden: () => !st.flags.jalonenHere,
  draw(t, talking) { person("jalonen", this.x, this.y, t, { moving: this.moving, dir: this.dir, talking });
    if (!this.moving) r(this.x + 6, this.y - 15, 3, 4, st.flags.stamped ? "#f4d0d0" : "#e8eef4"); } };

// ---------------------------------------------------------------- ruudut
// Kisapuisto (vaihe 4, 17.10.): Jussi laskeutui Liigasta suoraan lehtikasaan. Taustalla Saarni
// ja maskotti kävelevät SaiPan toimistoon ja pudottavat 50 euroa; ilmoitustaululla Mouho
// hakee toiminnanjohtajaa. Mouho on ilmainen -- kukaan ei maksa mitään.
// Tunniste "koti" ja pianon liput pysyvät satama-ajoilta.
defineRoom("koti", {
  title: "Kisapuisto, Lappeenranta", scale: [80, 136, 0.46, 1.06], start: 128,
  walk: [[[0, 123], [240, 123], [240, 136], [0, 136]], [[60, 86], [236, 86], [240, 124], [56, 124]]],
  actors: [RAIMO, SAARNI, MASKOTTI, JALONEN],          // salkkumies odottaa parkkipaikan perällä (rooms/parkki.js, 24.10.)
  draw: (t) => { kisaDraw(t); thumbsUp(t); moneyTrail(t); },
  post: (t) => guideKisa(t),
  edges: { vasen: () => toParkki() },                   // vasemmalle kävelemällä parkkipaikan perälle
  props: [{ y: 127, draw: () => st.flags.leafPile && leafPile(LAND[0], LAND[1]) }, { y: 128, draw: kisaPoster }, { y: 80, draw: kisaPostbox }, { y: 96, draw: kisaRack }, { y: 130, draw: kisaBox }, { y: 134, draw: kisaTaxi },
          { get y() { return st.flags.billStuck ? 129 : BILL.y; }, draw: drawBill }],      // nastan alla taulun edessä
  spots: [
    { id: "jalonen", name: "Kari Jalonen", actor: true, get x() { return JALONEN.x - 7; }, get y() { return JALONEN.y - 30; }, w: 14, h: 30, at: 120, aty: 98,
      hidden: () => !st.flags.jalonenHere || JALONEN.moving,
      Katso: () => say(st.flags.stamped ? "Kari Jalonen. Leimattu työeläkekortti kädessä. Hän näyttää melkein hymyilevän. Melkein." : "Kari Jalonen katsoo treenejä hallin ikkunasta. Kädessä on jokin kortti. Hän ei ole liikahtanut aikoihin. Ei tarvitse."),
      Puhu: () => jalonenTalk(),
      "Käytä:leimasin": () => jalonenStamp(), Anna: (it) => it === "leimasin" ? jalonenStamp() : say(it === "kaavio" ? "Kaavio." : "Ei kiitos.", "jalonen") },
    { id: "seteli", name: "50 euron seteli", get x() { return BILL.x - 9; }, get y() { return BILL.y - 13; }, w: 18, h: 16, get at() { return BILL.x; }, get aty() { return Math.min(122, BILL.y + 2); },
      hidden: () => !st.flags.billOut || st.flags.billCaught,
      Katso: () => say("Viisikymppinen lepattaa tuulessa. Se putosi herra Saarnin salkusta."),
      Poimi: () => chaseBill(), Käytä: () => chaseBill() },
    { id: "pollari", name: "pahvilaatikko", x: BOX_AT[0] - 13, y: BOX_AT[1] - 21, w: 26, h: 22, at: BOX_AT[0] - 20, aty: 128,
      Katso: () => say("Tavarani Liigan toimistolta. Kahvikuppi ja otteluohjelma, jossa on enemmän post-it-lappuja kuin otteluita."),
      // Sokkotesti 4: Ilveksen vuosi ei löytynyt pelistä. Vihje laatikosta, päättely itse (2025 - 40).
      Avaa: async () => { await say("Kahvikuppi: \"Maailman paras urheilujohtaja\". Ostin sen itse.\nJa viime kevään otteluohjelma. Post-it: \"Ilves-ilta 2025: 40 vuotta viimeisestä mestaruudesta!\""); await boxStamp(); },
      Poimi: async () => { if (await boxStamp()) return; await say("Otteluohjelma laatikon pohjalla. Post-it: \"Ilves-ilta 2025: 40 vuotta viimeisestä mestaruudesta!\" Muuten jätän laatikon tähän."); },
      Käytä: () => standOnBox(), Työnnä: () => say("Laatikko on hyvä paikallaan. Siitä saisi vaikka korokkeen."),
      Vedä: () => say("Vedän laatikkoa lähemmäs. Se on ainoa asia, joka seuraa minua tänään vapaaehtoisesti.") },
    { id: "juliste", name: "ilmoitustaulu", x: 16, y: 84, w: 38, h: 30, at: 72, aty: 131,
      Katso: () => readAd(), Poimi: () => (st.flags.billStuck && !st.flags.billCaught ? chaseBill() : readAd()) },   // sokkotesti 3: seteli taulussa
    { id: "perä", name: "parkkipaikan perä", x: 0, y: 96, w: 14, h: 40, at: 4, aty: 128, exit: true,
      Katso: () => say(st.flags.pyramid && !st.flags.mgp ? "Parkkipaikan perällä palaa yksinäinen lyhty. Joku seisoo sen alla salkun kanssa." : "Parkkipaikka jatkuu koivujen ohi perälle asti."),
      Kävele: () => toParkki(), Käytä: () => toParkki() },
    { id: "laatikko", name: "postilaatikko", x: 227, y: 68, w: 13, h: 14, at: 233, aty: 88,
      // Ei lukossa (17.10.: "miksi postilaatikko on lukossa, jos sinne palautetaan rahat?").
      Avaa: async () => { if (st.flags.boxOpen) return say("Se on jo auki."); st.flags.boxOpen = true; await say("Laskuja. Ja Liigan kiitoskirje, toinen kappale. Ei mitään uutta."); },
      Sulje: async () => { st.flags.boxOpen = false; await say("Suljettu. Postilaatikot ovat tyytyväisimpiä suljettuina."); },
      Poimi: () => say(st.flags.boxOpen ? "Pelkkiä laskuja. Ne saavat jäädä sinne." : "Laatikko on kiinni."),
      "Käytä:seteli": () => returnBill(), "Anna:seteli": () => returnBill(), "Käytä:kaavio": () => postChart(),
      Katso: () => say("SaiPan toimiston postilaatikko, keltaisen oven vieressä. Postini tulee yhä tänne, vaikka lähdin keväällä 2023.") },
    { id: "ovi", name: "SaiPan toimiston ovi", x: 219, y: 62, w: 8, h: 18, at: 224, aty: 88,
      // Sokkotesti 2: setelin tarjoaminen ovelle on luontevaa, joten se käy palautukseksi.
      "Käytä:seteli": () => returnBill(), "Anna:seteli": () => returnBill(), "Käytä:kaavio": () => postChart(),
      Katso: () => say(st.flags.billReturned ? "Toimiston ovi. Ikkunasta näkyi hetki sitten peukku." : "SaiPan toimiston keltainen ovi. Herra Saarni ja maskotti menivät tästä sisään. Vieressä on toimiston postilaatikko."),
      Avaa: () => say("Lukossa. Pelaajakaupoissa ei häiritä."), Puhu: () => say("Koputan. Sisältä kuuluu: \"Ja tekstitv:stä löytyi vielä yksi!\"\nEn keskeytä.") },
    { id: "taksi", name: "taksi lentokentälle", x: 242, y: 88, w: 78, h: 46, at: 234, aty: 130,
      Katso: () => say("Taksi Lappeenrannan lentokentälle. Kuljettaja lukee Liigan otteluohjelmaa. Hän näyttää huolestuneelta."),
      Käytä: () => leave(), Avaa: () => leave(), "Käytä:lippu": () => leave(), "Anna:lippu": () => leave(),
      Puhu: () => has("lippu") ? leave() : say(has("lippu") ? "Kuljettaja: \"Lentokentälle? Istanbuliin? Hyppää kyytiin.\"" : "Kuljettaja: \"Lentokentälle? Minne sitten? Kun tiedät, tule takaisin. Mittari ei käy vielä.\"", "muu") },
    { id: "halli", name: "Kisapuiston halli", x: 124, y: 62, w: 58, h: 18, at: 150, aty: 92,
      Katso: () => say("Kisapuisto, SaiPan kotihalli. Ovista kuuluu kiekon kopse. Treenit ovat käynnissä."), Avaa: () => say("Treenit ovat kesken. En ole enää kenenkään urheilujohtaja.") },
    { id: "keltainen", name: "keltainen rakennus", x: 40, y: 28, w: 42, h: 50, at: 110, aty: 92,
      Katso: () => say("\"Tervetuloa peliin.\" Joskus tuo kyltti tarkoitti minua.") },
  ],
});

// ---------------------------------------------------------------- juoni
async function leave() {
  await script(async () => {
    if (!st.flags.pyramid) return say("Lähteä minne? Minulla ei ole vielä edes suunnitelmaa. Ilmoitustaululla oli jotain.");
    if (!st.flags.billReturned) return say(has("seteli") ? "Ensin kutsu herra Saarnille ja maskotille. Pyramidi tarvitsee kaksi ensimmäistä jäsentä, ja toimiston postiluukku on tuossa." : "Ensin kaksi ensimmäistä jäsentä: herra Saarni ja maskotti. Kutsuun tarvitsisin paperia. Tuolla lensi jokin paperi.");
    if (!has("lippu")) return say("Lentokentälle? Ilman lippua en pääse edes turvatarkastukseen. Ehkä sijoittajat järjestävät jotain.");
    await say(st.flags.searched ? "Lentoasemalle, kiitos." : "Lentoasemalle! Hetkinen... onko Lappeenrannassa edes lentokenttää? Kuukkelöin.");
    if (!st.flags.searched) { st.flags.searched = true; await kuukkeliSearch(); }
    go("lentoasema", 30, true, 122);
    if (!st.flags.airportSeen) { st.flags.airportSeen = true; await say("Kuulutus: Istanbulin lento lähtee portilta 1. Ainoalta portilta.", "muu"); }
    await valtonenArrives();
  });
}

// ---------------------------------------------------------------- Kisapuisto: seteli, ilmoitus, taustakohtaus
// Seteli lepattaa tuulessa ja karkaa, kun Jussi tulee lähelle. Laatikon päältä tuulenpuuska
// tuo sen käteen. Jussi palauttaa sen SaiPan postiluukusta (käyttäjä 17.10.: "palauttaa").
const BILL_SPOTS = [[204, 104], [174, 118], [226, 116], [120, 106], [196, 94], [82, 116]];
const BILL = { x: 204, y: 104, tx: 204, ty: 104, i: 0, fly: null };
function drawBill(t) {
  if (!st.flags.billOut || st.flags.billCaught) return;
  BILL.x += (BILL.tx - BILL.x) * .06; BILL.y += (BILL.ty - BILL.y) * .06;
  const pinned = st.flags.billStuck && Math.hypot(BILL.x - BOARD_SPOT[0], BILL.y - BOARD_SPOT[1]) < 2;
  const f = Math.sin(t / 90) * (pinned ? .3 : 1), y = BILL.y - 6 - (pinned ? 0 : Math.abs(Math.sin(t / 300)) * 4);
  if (!pinned) shadow(BILL.x, BILL.y, 3);
  g.save(); g.translate(BILL.x, y); g.rotate(f * .5); g.scale(1, pinned ? 1 : .5 + .5 * Math.abs(Math.cos(t / 140)));
  r(-4, -2, 8, 4, "#c8a87c"); r(-4, -2, 8, 1, "#e8d0a8"); r(-1, -1, 2, 2, "#8c6c4c"); g.restore();
  if (pinned) { px(BILL.x - 3, y - 2, "#c81c1c"); px(BILL.x - 3, y - 3, "#fc5c5c"); }               // nasta
}
// 17.10.: ensimmäinen Poimi -- tuulenpuuska vie setelin ilmoitustauluun nastan alle; toinen
// Poimi -- seteli käteen, ja samalla Jussi huomaa Mouhon ilmoituksen (käyttäjän idea: seteli
// ohjaa ilmoitustaululle). Laatikon päältä saa yhä heti.
const BOARD_SPOT = [44, 104];
function gust() { st.flags.billStuck = true; [BILL.tx, BILL.ty] = BOARD_SPOT; beep(220, 300, "triangle", .03); }
async function chaseBill() {
  if (st.flags.billStuck) {            // toinen yritys: seteli ilmoitustaululta käteen
    await walkTo(72, 131); st.dir = -1; await sleep(200);             // taulun oikealla ja edessä, ei sen takana
    st.flags.billCaught = true; give("seteli"); iq("seteli", 5);
    await say("Sain sen! Viisikymppinen. Pidän sen tallessa.");
    if (!st.flags.adRead) await say("Ja hetkinen... taululla on uusi ilmoitus Mouho-logon alla. Työpaikkailmoitus? Luen sen.");
    return;
  }
  gust(); await say("Melkein! Tuulenpuuska vei sen viime hetkellä... suoraan ilmoitustauluun, nastan alle. Siellä se nyt lepattaa.");
}
async function standOnBox() {
  if (!st.flags.billOut || st.flags.billCaught) return say("Seison laatikolla hetken. Näköala on sama, mutta ylempää.");
  await walkTo(BOX_AT[0], 128); st.hop = performance.now(); await sleep(260);
  await say("Ylös laatikon päälle. Toiminnanjohtaja seisoo aina vähän muita korkeammalla.");
  BILL.tx = st.x + 4; BILL.ty = st.y - 20; beep(300, 400, "triangle", .03); await sleep(900);
  st.flags.billCaught = true; give("seteli"); iq("seteli", 5);
  await say("Tuulenpuuska toi sen suoraan käteen! Tuuli on puolellani. Tänään ensimmäistä kertaa.");
}
// Palaute 24.10.: pelaajalla ei ollut syytä palauttaa seteliä. Nyt Jussi tarvitsee pyramidiinsa
// kaksi ensimmäistä jäsentä ja kirjoittaa kutsun ainoaan paperiin, joka hänellä on: setelin
// reunaan. Saarni saa rahansa takaisin, ja Jussi tajuaa palauttaneensa ne vasta jälkikäteen.
async function returnBill() {
  if (!st.flags.pyramid) return say(st.flags.adRead ? "Postiluukkuun? Mitä minä herra Saarnille kirjoittaisin? Ensin tarvitsen suunnitelman." : "Postiluukkuun? Minulla ei ole herra Saarnille vielä mitään asiaa.");
  take("seteli"); st.flags.billReturned = true; iq("rehellisyys", 10);
  await say("Kutsu herra Saarnille ja maskotille. Paperia... kaavio on ilmoituksen takana, eikä taskuissa ole muuta. Paitsi tämä viisikymppinen.");
  await say("Kirjoitan setelin reunaan: \"Herra Saarni ja maskotti: liittykää Mouhoon! Jäseniä haetaan. -- J.M.\"\nJa postiluukusta sisään.");
  st.flags.thumbT = Date.now(); beep(523, 120, "triangle", .05); setTimeout(() => beep(784, 200, "triangle", .05), 140);
  await sleep(500); await say("Toimiston ikkunasta nousee kaksi peukkua: maskotin iso valkoinen ja herra Saarnin.", "muu");
  await sleep(300); beep(400, 80, "square", .04); await say("Postiluukusta tipahtaa lappu takaisin.", "muu"); give("lappu");
  await say("\"Kiitos kutsusta. Ja viisikymppisestä, juuri sitä etsinkin. Rehellistä. Ollaan mukana. -M.S.\"");
  await say("...Viisikymppisestä? Ai. Se oli tietysti hänen. Rehellisyys kannattaa, näköjään vahingossakin.");
  await recruitSaarni();
}
async function postChart() { await say("Kaavio on ainoa suunnitelmani. Kutsuun tarvitsen jotain muuta paperia."); }
async function recruitSaarni() {
  st.flags.recruits = (st.flags.recruits ?? 0) + 2; iq("ensimmaiset", 5);       // kutsutaan kerran (returnBill tai callMyrra); Jalonen voi olla jo mukana
  await say("Kaksi peukkua! Herra Saarni ja maskotti liittyivät Mouhoon. Jäsenhankinnan kaksi ensimmäistä jäsentä!");
  await say(st.flags.pyramid ? "Merkitsen heidät kaavioon. Jokainen tuo kaksi uutta. Tämä toimii jo." : "Merkitsen heidät muistiin. Kun minulla on suunnitelma, he ovat ensimmäisinä siinä.");
}
async function salesmanBill() {
  await say("Ah, seteli! Annahan se tänne, välitän sen eteenpäin. Ammattilaisena.", "salkkumies");
  await say("Ei kiitos. Sille on parempaa käyttöä.");
}
function moneyTrail(t) {          // salkusta lepattavat setelit Saarnin kävellessä
  if (!st.flags.saarniHere || !SAARNI.moving) return;
  for (let i = 0; i < 3; i++) { const k = ((t / 700 + i / 3) % 1), x = SAARNI.x - 6 - k * 22, y = SAARNI.y - 14 + k * 12 + Math.sin(t / 80 + i) * 2;
    g.save(); g.translate(x, y); g.rotate(Math.sin(t / 90 + i) * .6); r(-3, -1, 6, 3, "#c8a87c"); r(-3, -1, 6, 1, "#e8d0a8"); g.restore(); }
}
function thumbsUp() {             // maskotin peukku toimiston ikkunassa setelin palautuksen jälkeen
  const s = st.flags.thumbT ? (Date.now() - st.flags.thumbT) / 1000 : 9; if (s > 3) return;
  const up = Math.min(1, s * 3), y = 74 - up * 8;
  r(213, 66, 8, 6, "#ffd890"); r(215, y, 4, 6, "#f4f4f4"); r(216, y - 3, 2, 3, "#f4f4f4"); r(214, y + 5, 6, 2, "#1c1c22");
  const y2 = 75 - Math.min(1, Math.max(0, s - .3) * 3) * 6; r(229, y2, 3, 4, "#dca482"); r(230, y2 - 2, 1, 2, "#dca482"); r(228, y2 + 4, 5, 2, "#1c2444");   // Saarnin peukku
}
async function readAd() {
  if (st.flags.adRead) return say("\"MOUHO hakee toiminnanjohtajaa. Tehtävät: turnauksen järjestäminen, jäsenten hankinta, tarjoilu. Haastattelut Mouho-illassa, Kaivokatu 10, 20.11.\"");
  st.flags.adRead = true; iq("ilmoitus", 3); give("ilmoitus");
  await say("Ilmoitustaululla on uusi lappu Mouho-logon alla:");
  await say("\"MOUHO hakee TOIMINNANJOHTAJAA. Tehtävät: turnauksen järjestäminen, jäsenten hankinta, tarjoilu. Haastattelut Mouho-illassa, Kaivokatu 10, 20.11. Osallistuminen Mouhoon kaikille ilmaista.\"", "muu");
  await say("Toiminnanjohtaja! Turnauksia, jäseniä ja tarjoilua. Olen tehnyt näitä kaikkia. Tai ainakin katsonut vierestä.");
  await say("Mutta hakijoita on varmasti satoja. Miten minä erotun joukosta? Tarvitsen neuvoa joltakulta viisaalta.");
  await say("Soitan Jouko Myrrälle, vanhalle valmentajalleni. Hänen numeronsa on kännykässä pikavalinnassa ykkösenä.");
}
// Taustakohtaus intron aikana: Saarni ja maskotti autolta toimistoon, seteleitä lentää.
// Vuorotellen (17.10.: "menee päällekkäin puheruutujen kanssa"): Jussi puhuu ensin, he
// kävelevät hiljaa ja pysähtyvät vasemmalle Jussin kuplan alta pois, Saarni puhuu, sitten ovelle.
async function saarniScene() {
  await say("Mitä minä nyt teen? Tarvitsen uuden työn. Liigan pitää nähdä, että Markkanen nousee.");
  await say("Koiranulkoiluttaja? Koira ulkoiluttaisi minua.");
  Object.assign(SAARNI, { x: 84, y: 91 }); Object.assign(MASKOTTI, { x: 72, y: 92 }); st.flags.saarniHere = true; beep(90, 80, "square", .05);   // punaisen auton vierestä (sokkotesti 2)
  await say("Autosta nousevat Jokereiden puheenjohtaja Mikko Saarni ja Jokerit-maskotti.", "muu");
  await sleep(300);
  await Promise.all([walkActor(SAARNI, 124, 90, 1), walkActor(MASKOTTI, 106, 91, 1)]);
  st.flags.billOut = true; [BILL.x, BILL.y] = [SAARNI.x - 6, SAARNI.y - 16]; [BILL.tx, BILL.ty] = BILL_SPOTS[0];
  SAARNI.dir = -1;
  await say("Aho on taas tehnyt sen. Liigan heittopussista kärkijoukkue, ja pelaajat löytyvät kuin tyhjästä.", "saarni");
  await say("Hyvää kannattaa ostaa sieltä, missä sitä tehdään. Jokerit haki aikanaan Otakar Janeckýn SaiPasta. Katso mitä siitä seurasi.", "saarni");
  await say("Maskotti iskee silmää. Se iskee silmää aina.", "muu");
  await Promise.all([walkActor(SAARNI, 224, 86, 1.3), walkActor(MASKOTTI, 210, 87, 1.3)]);
  beep(140, 120, "square", .04); st.flags.saarniHere = false;
  await sleep(300);
  await say("Pitkävetovalmentaja? Ei, se vaatisi, että voittaisin.");
  await say("Hetkinen. Herra Saarnin salkusta putosi jotain. Tuolla lentää viisikymppinen!");
  st.flags.introDone = true;
}
function guideKisa(t) {
  const f = st.flags; if (!f.introDone) return;
  if (f.billOut && !f.billCaught) sparkle(BILL.x + 5, BILL.y - 10, t, 1, 2000);
  if (!f.adRead) { sparkle(30, 92, t, 2, f.noteHint ? 1400 : 3200); if (f.noteHint) sparkle(44, 100, t, 5, 1400); }
  if (f.pyramid && !f.billReturned) sparkle(233, 72, t, 4, 2400);
  if (f.pyramid && !f.mgp && f.billReturned) bark(26, 96, "Psst! Markkanen! Täällä perällä!", t, 3, 7000);
  if (f.unlocked && !f.letterTaken) sparkle(233, 72, t, 4, 1600);
  if (has("lippu")) { bark(280, 86, "TÖÖT!", t, 8, 11000, 1400); const k = (t + 8 * 1301) % 11000; if (!busy && k < 30) beep(330, 140, "square", .02); }
}
// Lattiapianon palaute (sokkotesti 2: numerolle astuminen ei näyttänyt mitään): tähän asti
// tallotut numerot taulussa parkkipaikan reunassa.
function codePanel(e) {
  r(138, 118, 44, 11, "#0c0c14"); r(139, 119, 42, 9, "#1c2440");
  for (let k = 0; k < 4; k++) { const d = e[k]; if (d) text3(d, 144 + k * 9, 121, "#fcd41c"); else r(144 + k * 9, 125, 3, 1, "#7c8cac"); } }

// ---------------------------------------------------------------- Raimo Helminen (SaiPan valmentaja)
// Onnistuneen Ilves-visan jälkeen: tulee hallin ovesta, onnittelee, kuittaa Saarnista ja palaa.
async function raimoCameo() {
  Object.assign(RAIMO, { x: 334, y: 118 }); st.flags.raimo = true; beep(140, 100, "square", .04);     // hölkkää hallilta parkkipaikan perälle
  await say("Parkkipaikan poikki hölkkää SaiPan päävalmentaja Raimo Helminen. Hän kuuli numerot hallille asti.", "muu");
  await walkActor(RAIMO, Math.min(296, st.x + 26), Math.min(130, Math.max(100, st.y)), 1.3); st.dir = 1;
  await say("Oikein! Ilves, 1985. Minä olin siellä, Markkanen.", "helminen");
  await say("Raimo Helminen?! SaiPan valmentaja!");
  await say("Ja jos näet Saarnin, sano ettei meillä ole enää ketään myytävänä.", "helminen");
  await say("Treenit alkaa.", "helminen");
  await walkActor(RAIMO, 334, 118, 1.6); st.flags.raimo = false;
  await say("...Ja hän oli poissa. Kukaan ei usko tätä Mouhossa.");
}

// ---------------------------------------------------------------- Kari Jalonen, lyhyen sanan mestari
// 23.10. (käyttäjä: "Monkey Islandin tapaa"): huumori tulee Jussin pitkistä lauseista, ei
// valmentajasta. Jalonen vastaa "Lyhyemmin", kunnes kysymys mahtuu kolmeen sanaan. Leimautus
// on hänen oma vitsinsä eläkkeestä; Jussi tuo sille virallisen Liigan leiman. Valinnainen
// jäsen; "Lyhyesti virsi kaunis" (f.lyhyesti) on myöhemmin taululiitukaksintaistelun vastaus.
async function jalonenArrives() {
  if (st.flags.jalonenHere || st.flags.jalonenIn) return;
  Object.assign(JALONEN, { x: 62, y: 88 }); st.flags.jalonenHere = true;
  await say("Parkkipaikan poikki kävelee Kari Jalonen, Leijonien entinen päävalmentaja.", "muu");
  await walkActor(JALONEN, 134, 88, 1);
  await say("Hän pysähtyy hallin ikkunan eteen katsomaan SaiPan treenejä. Kädessä on jokin kortti.", "muu");
  await say("Kari Jalonen. Täällä. Tavallisena arki-iltana. Lappeenranta on täynnä yllätyksiä.");
}
const JAL_Q = ["Saisinko kysyä, ihan ammatillisessa mielessä, koska olen itsekin ollut urheilun parissa vuosia, mikä on teidän kokemuksenne mukaan se kaikkein tärkein yksittäinen asia valmentamisessa?",
  "Mikä valmentamisessa on se kaikkein tärkein asia?", "Tärkeintä?"];
async function jalonenTalk() {
  await script(async () => {
    const f = st.flags;
    if (!f.metJalonen) { f.metJalonen = true;
      await say("Herra Jalonen! Jussi Markkanen. Entinen urheilujohtaja, Liigan toimistolta, nykyään tavallaan vapaa toimija, ihan niin kuin tekin, jos saan sanoa. Mitä te täällä teette?");
      await say("Katson treenejä.", "jalonen");
      await say("Mutta ettekö te juuri jääneet eläkkeelle?");
      await say("Jäin. Tapa ei jäänyt.", "jalonen"); }
    while (true) {
      const opts = [];
      if (!f.lyhyesti) opts.push(JAL_Q[f.jalQ ?? 0]);
      if (!f.cardSeen) opts.push("Mikä kortti teillä on kädessä?");
      if (f.cardSeen && !f.jalonenIn) opts.push(f.lyhyesti ? "Mouho. Ilmainen. Mukaan?" : "Mouho hakee jäseniä, ja koska te olette nyt vapaana ja minä rakennan jäsenpyramidia, jossa jokainen tuo kaksi uutta, ajattelin, että ehkä te...");
      opts.push("Näkemiin.");
      const pick = opts[await choose(opts)]; await say(pick);
      if (pick === JAL_Q[0] || pick === JAL_Q[1]) { f.jalQ = (f.jalQ ?? 0) + 1;
        await say("Lyhyemmin.", "jalonen");
        await say(f.jalQ === 1 ? "Lyhyemmin. Totta kai. Karsin johdannon." : "Vielä lyhyemmin? Tuossa oli enää seitsemän sanaa."); }
      else if (pick === JAL_Q[2]) { f.lyhyesti = true; iq("lyhyesti", 5);
        await say("Lyhyesti virsi kaunis.", "jalonen");
        await say("Kolme sanaa. Siinä oli hänen koko valmennusfilosofiansa. Minulta meni samaan kolme kuukautta ja neljäkymmentä kalvoa."); }
      else if (pick.startsWith("Mikä kortti")) { f.cardSeen = true;
        await say("Työeläkekortti. Aion leimauttaa sen.", "jalonen");
        await say("Leimauttaa. Tietysti. Virallinen asia tarvitsee virallisen leiman.");
        await say("Liigan toimistolla leimattiin kaikki. Jopa minun lähtöpaperini."); }
      else if (pick.startsWith("Mouho hakee")) {
        await say("Lyhyemmin.", "jalonen");
        await say("Lyhyemmin. Kokonainen jäsenpyramidi. Miten sen sanoisi lyhyemmin?"); }
      else if (pick.startsWith("Mouho. Ilmainen")) {
        if (f.stamped) return joinJalonen();
        await say("Leima ensin.", "jalonen");
        await say("Leima ensin. Asiat järjestyksessä. Ammattilainen."); }
      else { await say("Hyvät jatkot.", "jalonen"); return; }
    }
  });
}
// Leimasin on Jussin omassa pahvilaatikossa, mutta Jussi muistaa sen vasta kortin nähtyään.
async function boxStamp() {
  if (!st.flags.cardSeen || st.flags.stamped || has("leimasin")) return false;
  give("leimasin");
  await say("Ja laatikon pohjalla, otteluohjelman alla: Liigan leimasin! HYVÄKSYTTY.\nEn muista pakanneeni sitä. Se halusi tulla mukaan.");
  return true;
}
async function jalonenStamp() {
  await script(async () => {
    const f = st.flags;
    if (!f.cardSeen) return say("En leimaa ketään kysymättä. Liigassa leimasimme vain papereita.");
    if (f.stamped) return say("Kortti on jo leimattu. Kahdesti hyväksytty olisi liikaa.");
    await say("Saanko? Virallinen Liigan leima.");
    await say("Kari Jalonen ojentaa työeläkekortin. Jussi painaa leimasimen siihen napakasti.", "muu");
    f.stamped = true; take("leimasin"); beep(120, 90, "square", .06);
    await say("HYVÄKSYTTY.", "muu");
    await say("Hyväksytty.", "jalonen");
    await say("Hyvät jatkot.", "jalonen");
    if (f.lyhyesti) { await say("Mouho. Ilmainen. Mukaan?"); return joinJalonen(); }
    await say("Tämä olisi oikea hetki kysyä häntä Mouhoon. Kunhan keksin, miten sen sanoisi lyhyesti.");
  });
}
async function joinJalonen() {
  const f = st.flags; f.jalonenIn = true; f.recruits = (f.recruits ?? 0) + 1; iq("jalonen", 5);
  await say("Mukana.", "jalonen");
  await say("Kari Jalonen, Mouhon jäsen. Merkitsen hänet kaavioon. Isolla.");
  await say("Katson treenit loppuun.", "jalonen");
  await walkActor(JALONEN, 158, 84, 1); f.jalonenHere = false;
  await say("Hallin ovi heilahtaa kerran. Lyhyesti.", "muu");
}

// ---------------------------------------------------------------- salkkumies (Kisapuisto)
// Ennen pyramidia: kysyy otteluohjelmasta. Pyramidin jälkeen: "Mouho Global Partners" --
// turkkilaisten sijoittajien edustaja, jonka pätevyystesti on Ilveksen 1985 lattiapiano.
function showChartToSalesman() { return script(async () => { await say("Katsokaa: jäsenhankintasuunnitelmani Mouholle!"); await mgpReveal(); }); }
async function mgpReveal() {
  st.flags.mgp = true;
  await say("Edustan turkkilaisia sijoittajia. Ostamme lupaavia brändejä. Tuo kaavio... kasvusuunnitelma? Minkä brändin?", "salkkumies");
  await say("Mouhon! Olen sen tuleva toiminnanjohtaja. Melkein.");
  await say("Ilmainen tuote, joka leviää itsestään... Mouho Global Partners. Kuulostaa kansainväliseltä.", "salkkumies");
  await say("Kansainvälinen jäsenhankinta! Jouko sanoi: ole proaktiivinen. Tämä on niin proaktiivista kuin olla voi.");
  if (!has("kortti")) { await say("Käyntikorttini. Kirjoitan uuden nimen tähän... noin. Kultareunus, huomaatte.", "salkkumies"); give("kortti"); }
}
async function salesmanTalk() {
  // Keskustelu ensin yleisesti (17.10.): toimintavaihtoehdot avautuvat vasta, kun on kysytty
  // kuka hän on -- ja hän paljastuu sijoittajien edustajaksi vasta, kun Jussilla on pyramidi.
  await script(async () => {
    if (!st.flags.metSales) { st.flags.metSales = true;
      await say("Psst! Markkanen! Onko otteluohjelma jo valmis? Meidän porukka varasi lauantaille saunan.", "salkkumies"); }
    while (true) {
      const f = st.flags, opts = [];
      // Sokkotesti: uusi sisältö sai olla harmaan, jo kysytyn vaihtoehdon takana. Pyramidin jälkeen
      // vaihtoehto on uusi ja eri sanoin, ja kaavion antaminen avaa saman keskustelun.
      if (!f.mgp && !f.pyramid && !f.salesWho) opts.push("Kuka te oikeastaan olette?");
      if (!f.mgp && f.pyramid) opts.push("Katsokaa: jäsenhankintasuunnitelmani Mouholle!");
      if (!f.salesSchedule) opts.push("Otteluohjelma? En ole enää urheilujohtaja.");
      if (f.mgp && !f.unlocked) opts.push("Mitä sijoittajat haluavat?");
      if (f.mgp && f.adRead && !f.salesFree) opts.push("Mouho on muuten ilmainen. Kenellekään ei makseta mitään.");
      opts.push("Näkemiin.");
      const pick = opts[await choose(opts)]; await say(pick);
      if (pick.startsWith("Kuka te")) { f.salesWho = true;
        await say("En ole herra Saarni, jos sitä mietitte. Hän meni toimistoon. Minä olen liikemies.", "salkkumies");
        await say("Odotan oikeaa ihmistä, jolla on oikea suunnitelma. Teillä ei vielä ole. Kun on, näyttäkää se minulle.", "salkkumies"); continue; }
      if (pick.startsWith("Katsokaa")) { f.mgp = true;
        await mgpReveal(); }
      else if (pick.startsWith("Mitä sijoittajat")) {
        await say("Sijoittajat neuvottelevat vain pätevän henkilön kanssa. Entinen urheilujohtaja, sanotte?", "salkkumies");
        await say("Milloin Ilves voitti viimeksi Suomen mestaruuden? Astu se vuosi asfalttiin, numero kerrallaan. Oikeasta vastauksesta sijoittajat kutsuvat teidät neuvottelemaan.", "salkkumies");
        f.pianoT = Date.now(); [262, 330, 392, 523, 659].forEach((fq, n) => setTimeout(() => beep(fq, 150, "triangle", .06), n * 110));
        await sleep(1100); await say("...Asfalttiin ilmestyi numeroita. Tämä kaupunki ei lakkaa yllättämästä.");
        await say("Kuin siinä Tom Hanksin elokuvassa. Tarvitsee vain seistä oikeilla numeroilla oikeassa järjestyksessä.");
        await say("Ilveksen viimeinen mestaruus... Liigan toimiston papereissa laatikossani oli jotain Ilveksestä."); return; }
      else if (pick.startsWith("Otteluohjelma")) { f.salesSchedule = true;
        await say("Ai. No siirtyykö se lauantain peli? Kysyn vain varmuuden vuoksi. Ja sunnuntain. Ja ensi kuun.", "salkkumies");
        await say("Kaikki ottelut pelataan suunnitellusti. Luulisin. Älä lainaa minua."); }
      else if (pick.startsWith("Mouho on muuten")) { f.salesFree = true; iq("ilmainen", 3);
        await say("Ilmainen... ja silti jäseniä tulee? Brändi, jota ei tarvitse myydä kenellekään. Sijoittajat rakastavat tätä.", "salkkumies");
        await say("Niin minäkin ajattelin. Tai siis, en ajatellut, mutta nyt kun sanoit."); }
      else { await say("Soittele! Ja jos kuulet otteluohjelmasta, kerro minullekin.", "salkkumies"); return; }
    }
  });
}
