// Mouhon salaisuus -- Kisapuiston parkkipaikan perä: salkkumies ja Ilves-visa.
"use strict";
// Pelaajan palaute 24.10.: Kisapuisto oli liian täynnä. Salkkumies odottaa nyt parkkipaikan
// perällä yksinäisen lyhdyn alla, ja Ilveksen lattiapiano heijastuu tänne eikä hallin eteen.
// Kisapuistosta tullaan vasemmasta reunasta, takaisin oikeasta.
const parkX = (y) => { const k = (y - 100) / 16; return [lerp(46, 30, k), lerp(262, 278, k)]; };
const PARK_LAMP = [176, 98];
function parkkiFg() {
  // Oikea reuna jatkaa Kisapuiston vasenta reunaa (vierivä rivi): sama horisontti (62), sama tumma
  // kaista, reunakivi BASE:ssa, sama asfaltti, ja alhaalla nurmikaistale, aita ja pensas.
  seed = 31;
  for (let x = -6; x < W + 6; x += 3 + ((rnd() * 5) | 0)) { const h = 10 + ((rnd() * 16) | 0), y = 62 - h;
    r(x + 2, y + 4, 1, h, "#1a1626"); for (let j = 0; j < h - 2; j += 2) { const tx = x + 2 - Math.min(3, j / 4), tw = 1 + Math.min(6, j / 2);
      r(tx, y + j, tw, 2, j % 4 ? "#1c2230" : "#222a38"); r(tx, y + j + 1, Math.max(1, tw / 2), 1, "#161a2a"); } }
  for (const [x, y, s] of [[30, 46, 7], [86, 44, 8], [132, 48, 5], [228, 46, 6]]) {
    r(x, y + s - 2, 1, 14, "#d8d0c8"); r(x + 1, y + s - 2, 1, 14, "#8c849c");
    for (const [ox, oy, k] of [[-s * .6, 0, .7], [s * .5, -s * .2, .8], [0, -s * .5, .75], [-s * .2, s * .3, .6]]) { const cx = x + ox, cy = y + oy, rr = Math.max(2, (s * k) | 0);
      disc(cx | 0, cy | 0, rr, "#6c3c40"); disc((cx + .7) | 0, (cy - .7) | 0, rr - 1, "#b8802c"); disc((cx + 1) | 0, (cy - 1.5) | 0, Math.max(1, rr - 2), "#e0a840"); px(cx + rr - 1, cy - rr + 1, "#f8d868"); } }
  // tehdashalli jatkuu Kisapuiston puolelle (siellä x 4-38, y 44-60)
  r(286, 44, 34, 16, "#2c2440"); r(300, 40, 12, 4, "#2c2440"); for (const x of [290, 298, 310, 316]) r(x, 47, 2, 1, "#f0c070");
  for (const [x, y] of [[289, 52], [303, 51], [312, 55]]) { r(x, y, 3, 2, "#f0c060"); r(x, y + 2, 3, 1, "#8a6040"); px(x, y, "#fff0b0"); }
  r(0, 62, W, BASE - 62, "#161a26"); dither(0, 62, W, 4, "#1c2230", "#161a26", .5);
  for (let y = 54; y < 66; y++) for (let x = 0; x < W; x++) { const f = 1 - Math.abs(y - 61) / 6; if (bay(x, y) < f * .32 + .06 * Math.sin((x - W) / 23)) px(x, y, y < 61 ? "#5a4870" : "#3c3656"); }
  // matala verkkoaita parkkipaikan takareunassa, päättyy ennen Kisapuiston puolta
  for (let y = 62; y < 67; y++) for (let x = 0; x < W; x++) if (bay(x, y) < .55 - Math.abs(y - 64) * .15) px(x, y, y === 64 ? "#8a6a98" : "#7a5a8a");
  r(0, 70, 250, 1, "#5c5a70"); r(0, 69, 250, 1, "#a06888"); for (let x = 2; x < 250; x += 12) { r(x, 66, 1, 12, "#4c4a60"); r(x + 1, 67, 1, 11, "#14142a"); px(x, 66, "#a06888"); }
  for (let x = 0; x < 250; x += 2) for (let y = 71; y < 78; y += 2) if (bay(x, y) < .35) px(x, y, "#3a3850");
  // asfaltti samalla rampilla kuin hallin edessä
  vgrad(0, BASE, W, H - BASE, ["#3a3456", "#32304e", "#2c2e48", "#262e42", "#202a3a", "#1c2632", "#18202c"]);
  seed = 67; for (let k = 0; k < 280; k++) { const x = (rnd() * W) | 0, y = BASE + 2 + ((rnd() * (H - BASE)) | 0); r(x, y, 2 + ((rnd() * 2) | 0), 1, rnd() > .5 ? "#34344c" : "#141622"); }
  r(0, BASE, W, 1, "#4c4860"); r(0, BASE + 1, W, 1, "#2a2638");                                 // reunakivi
  for (let i = -7; i <= 7; i++) { const xb = 150 + i * 30; lineC(lerp(150, xb, .2), 82, xb, 96, "rgba(220,220,230,.24)"); }
  r(0, 96, 270, 1, "rgba(220,220,230,.2)");
  for (let i = -5; i <= 3; i++) { const xb = 150 + i * 60; lineC(lerp(150, xb, .55), 120, xb, H, "rgba(220,220,230,.16)"); }
  for (const [cx, cy, rx, ry] of [[70, 110, 22, 3], [212, 124, 24, 4], [130, 130, 16, 2]]) for (let j = -ry; j <= ry; j++) for (let i = -rx; i <= rx; i++) {
    const x = cx + i, y = cy + j, e = (i * i) / (rx * rx) + (j * j) / (ry * ry); if (e > 1 || (e > .7 && bay(x, y) < .5)) continue;
    px(x, y, j === -ry ? "#56607c" : e > .55 ? "#303852" : "#38425e"); if (j === ry) px(x, y, "#1a1c2c"); }
  for (const [x, y, w] of [[42, 119, 18], [64, 124, 22], [204, 121, 20], [232, 127, 24]]) for (let i = 0; i < w; i++) {
    const e = Math.abs(i - w / 2) / (w / 2); if (bay(x + i, y) < 1 - e * .8) px(x + i, y, e < .35 ? "#e08a60" : "#6a5a8a"); if (i % 2 && e < .6) px(x + i, y + 1, "#6a5a8a"); }
  for (const [x, c, d] of [[20, "#7c6c4c", 1], [96, "#3c5c4c", -1], [214, "#22222c", 1]]) { r(x + 2, 92, 22, 2, "#14142a"); parkedCar(x, 80, c, d);
    r(x + 8, 80, 8, 1, "#ffd890"); px(x + 7, 81, "#f0a050"); r(x, 85, 5, 1, "#f0a050"); r(x + 19, 84, 5, 1, "#ffd890"); r(x, 85, 1, 4, "#f0a050");
    r(d > 0 ? x + 24 : x - 2, 86, 2, 1, "#ffe8a0"); r(d > 0 ? x - 2 : x + 24, 86, 2, 1, "#e04830"); }
  // nurmikaistale, matala aita ja pensas jatkuvat Kisapuiston vasemmasta alakulmasta
  vgrad(262, 126, 58, 10, ["#2c3c24", "#22301c"]); r(262, 125, 58, 1, "#5c5c68"); fillPoly([[262, 125], [254, 136], [256, 136], [264, 126]], "#4c4c58");
  r(268, 121, 52, 1, "#a8987c"); r(268, 122, 52, 1, "#6c5c50"); for (let x = 270; x < 320; x += 9) { r(x, 120, 2, 6, "#8c7c68"); px(x, 120, "#c8b898"); }
  for (const [bx, by, bw] of [[-4, 127, 36], [290, 129, 34]]) { seed = bx + 300;
    for (let x = bx; x < bx + bw; x++) { const h = 3 + Math.round(Math.sin((x - bx) / bw * Math.PI) * (bw / 6)) + ((rnd() * 2) | 0), top = by + (bw / 6) - h + 3;
      r(x, top, 1, H - top, "#0e1018"); if (x % 3 === 0) px(x, top, "#2a2438"); } }
  parkkiFrame();
}
// etualan kehys: pensaat ja heinätupsut alakulmissa, kuusenoksat yläreunassa, pudonneet lehdet rykelminä
function parkkiFrame() {
  for (const [x0, x1, y0, rimL] of [[0, 40, 118, false], [280, 320, 122, true]]) { seed = x0 + 11;
    for (let x = x0; x < x1; x++) { const u = (x - x0) / (x1 - x0), arc = rimL ? u : 1 - u, top = Math.round(y0 + (1 - Math.sin(arc * Math.PI / 2)) * 10 + rnd() * 3);
      r(x, top, 1, H - top, "#14142a"); if (x % 2) r(x, top + 3, 1, 4, "#1e2038"); if (x % 4 === 1) r(x, top + 1, 1, 2, "#2a3048");
      px(x, top, (rimL ? x % 3 !== 0 : x % 3 === 0) ? "#a06850" : "#2a3048"); }
    for (let k = 0; k < 5; k++) { const bx = x0 + 3 + ((rnd() * (x1 - x0 - 6)) | 0), hh = 4 + ((rnd() * 5) | 0), by = H - 3 - ((rnd() * 4) | 0);
      for (let j = 0; j < hh; j++) { px(bx - (j >> 2), by - j, "#14142a"); px(bx + 2 + (j >> 2), by - j, "#1e2038"); } px(bx - (hh >> 2), by - hh, "#a06850"); } }
  for (const [bx, dir] of [[0, 1], [319, -1]]) for (const [oy, len] of [[1, 30], [7, 22], [12, 12]]) {
    for (let i = 0; i < len; i++) { const x = bx + dir * i, y = oy + ((i * i) / 120 | 0);
      px(x, y, "#14142a"); if (i % 3 === 0) { const n = Math.max(1, ((len - i) / 4) | 0); for (let j = 1; j <= n; j++) { px(x - dir * j, y + j, "#14142a"); px(x + dir * j, y + j, "#1e2038"); } } }
    px(bx + dir * (len - 1), oy + (((len - 1) ** 2) / 120 | 0), "#2a3048"); }
  for (const [x, y] of [[52, 126], [58, 129], [104, 133], [150, 127], [196, 131], [244, 128], [118, 120], [270, 132]]) {
    r(x, y, 2, 1, "#d89030"); px(x + 2, y + 1, "#a85a28"); px(x - 1, y + 1, "#a85a28"); px(x + 1, y + 1, "#d89030"); px(x + 4, y - 1, "#a85a28"); }
}
function parkkiDraw(t) {
  g.drawImage(paintBg("parkki_sky", () => kisaSky(false)), 0, 0);
  KISA_CLOUDS.forEach((b, k) => drift(`kisa_cloud${k}`, b[5], (w) => kisaCloudBand(w, b, k), t));
  g.drawImage(paintBg("parkki_fg", parkkiFg), 0, 0);
  // yksinäinen lyhty: valokeila asfaltille, salkkumies seisoo sen alla
  const [lx, ly] = PARK_LAMP, h = 46;
  for (let y = ly - h + 2; y < ly + 2; y++) { const k = (y - (ly - h)) / h, w = 4 + k * 36;
    for (let x = Math.round(lx - w / 2); x <= lx + w / 2; x++) { const e = Math.abs(x - lx) / (w / 2), b = bay(x, y);
      if (b < (1 - e) * .5 - k * .1) px(x, y, e < .3 ? "#fff0b0" : e < .65 ? "#f0c070" : "#a07848"); else if (e < 1 && b < .12 * (1 - k * .4)) px(x, y, "#a07848"); } }
  for (let j = -6; j <= 4; j++) for (let i = -26; i <= 26; i++) { const d = Math.hypot(i / 26, j / 6); if (d < 1 && bay(lx + i, ly + j) < (1 - d) * 1.3) px(lx + i, ly + j, d < .3 ? "#ffd890" : d < .6 ? "#c8905c" : d < .85 ? "#7a5850" : "#2a2a48"); }
  for (let y = ly + 2, k = 0; y < ly + 32; k++) { const w = 3 + k * 1.5, hh = 1 + (k & 1);   // märän asfaltin heijastus
    r(Math.round(lx - w / 2), y, Math.round(w), hh, k < 2 ? "#ffd890" : k < 5 ? "#f0a050" : "#b06848"); y += hh + 2 + (k % 2); }
  r(lx - 1, ly - h, 1, h, "#c8b080"); r(lx, ly - h, 1, h, "#4c4a5c"); r(lx + 1, ly - h, 1, h, "#1a1a30"); r(lx - 2, ly - 2, 5, 2, "#2c2a38");
  r(lx - 4, ly - h - 1, 9, 2, "#3c3a4c"); r(lx - 4, ly - h - 1, 9, 1, "#c8b080"); r(lx - 3, ly - h + 1, 7, 1, "#fff0b0"); r(lx - 2, ly - h + 2, 5, 1, "#ffd890");
  glow(lx, ly - h + 2, 22, "255,214,140", .32 + .04 * Math.sin(t / 130));
  // putoavat koivunlehdet
  for (const L of LEAVES) { const y = ((t / 40) * L.s + L.ph * 30) % 150 - 10, x = (L.x + 40) % W + Math.sin(t / 600 + L.ph) * 8; px(x, y, L.ph % 2 > 1 ? "#e8b440" : "#c8782c"); }
  { const s = depth(st.y); fillPoly([[st.x - 3 * s, st.y], [st.x + 3 * s, st.y], [st.x - 9 * s, st.y + 3 * s], [st.x - 15 * s, st.y + 3 * s]], "rgba(24,16,44,.6)"); }
}
function guideParkki(t) {
  const f = st.flags;
  if (f.pyramid && !f.mgp) bark(PARK_LAMP[0] + 8, 54, "Psst! Markkanen! Onko suunnitelma jo valmis?", t, 3, 7000);
  if (f.pianoT && !f.unlocked) codePanel(entered.parkki ?? []);
}
// Parkkipaikka ja Kisapuisto ovat yksi vierivä rivi: kamera seuraa Jussia, ja parkkipaikka
// tulee näkyviin jo hänen kävellessään kohti vasenta reunaa.
defineStrip(["parkki", "koti"]);
const toParkki = () => crossTo("parkki", 250, 124), toKisa = () => crossTo("koti", 70, 128);

defineRoom("parkki", {
  title: "Kisapuiston parkkipaikka", scale: [80, 136, 0.46, 1.06], start: 122,
  walk: [[[0, 98], [320, 98], [320, 136], [0, 136]]],
  actors: [{ id: "salkkumies", x: 184, y: 98, h: 48, color: "#7cfcfc", draw: (t, talking) => salesman(184, 98, t, talking) }, RAIMO],
  draw: (t) => { parkkiDraw(t); satamaPiano(t); ghostLynx(t); },
  post: (t) => guideParkki(t),
  edges: { oikea: () => toKisa() },
  onStop: (x, y) => quizStep(keyAt(x, y)),
  spots: [
    { id: "salkkumies", name: "salkkumies", actor: true, x: 177, y: 68, w: 16, h: 30, at: 160, aty: 99,
      Katso: () => say(st.flags.pyramid ? "Liituraitapuku, aurinkolasit iltahämärässä ja salkku. Hän seisoo lyhdyn alla kuin elokuvassa, ja katselee pyramidikaaviotani kuin se olisi tuttu." : "Liituraitapuku, aurinkolasit iltahämärässä ja salkku. Hän seisoo parkkipaikan perällä yksinäisen lyhdyn alla, kuin odottaen jotakuta."),
      Puhu: () => salesmanTalk(),
      Anna: (it) => it === "seteli" ? salesmanBill() : it === "kaavio" ? (st.flags.mgp ? salesmanTalk() : showChartToSalesman()) : say("Otan vastaan vain tilisiirtoja, kiitos.", "salkkumies") },
    { id: "piano", name: "asfaltin numerot", floor: true, hidden: () => !st.flags.pianoT, x: 30, y: 100, w: 248, h: 16, at: 150, aty: 108,
      Katso: () => say("Parkkipaikan asfalttiin heijastettu jättipiano, numerot 1-9 ja 0. Kuin siinä Tom Hanksin elokuvassa.\nPitää vain seistä oikeilla numeroilla oikeassa järjestyksessä."),
      Työnnä: () => say("Painan jalalla. Pianoja soitetaan tässä kaupungissa jaloin.") },
    { id: "lyhty", name: "lyhtypylväs", x: 172, y: 50, w: 9, h: 48, at: 196, aty: 99,
      Katso: () => say("Ainoa toimiva lyhty koko parkkipaikan perällä. Salkkumies valitsi paikkansa huolella.") },
    { id: "sedan", name: "musta sedan", x: 214, y: 80, w: 24, h: 14, at: 226, aty: 99,
      Katso: () => say("Pölyinen sedan, Helsingin kilvet. Takapenkillä on pino kultareunaisia käyntikortteja."),
      Avaa: () => say("Lukossa. Liikemiehet lukitsevat autonsa. Minä olen ilmeisesti vielä harjoittelija.") },
    { id: "hallille", name: "takaisin hallin eteen", x: 304, y: 74, w: 16, h: 62, at: 316, aty: 122, exit: true,
      Katso: () => say("Tuolla on Kisapuiston halli, SaiPan toimisto ja taksitolppa."), Kävele: () => toKisa(), Käytä: () => toKisa() },
  ],
});
