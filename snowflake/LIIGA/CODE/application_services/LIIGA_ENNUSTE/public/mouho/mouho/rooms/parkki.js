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
  r(0, 62, W, BASE - 62, "#161a26"); dither(0, 62, W, 4, "#1c2230", "#161a26", .5);
  for (let y = 54; y < 66; y++) for (let x = 0; x < W; x++) { const f = 1 - Math.abs(y - 61) / 6; if (bay(x, y) < f * .32 + .06 * Math.sin((x - W) / 23)) px(x, y, y < 61 ? "#5a4870" : "#3c3656"); }
  // matala verkkoaita parkkipaikan takareunassa, päättyy ennen Kisapuiston puolta
  r(0, 70, 250, 1, "#5c5a70"); for (let x = 2; x < 250; x += 12) { r(x, 66, 1, 12, "#4c4a60"); px(x, 66, "#8c88a4"); }
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
  for (const [x, c, d] of [[20, "#7c6c4c", 1], [96, "#3c5c4c", -1], [214, "#22222c", 1]]) parkedCar(x, 80, c, d);
  // nurmikaistale, matala aita ja pensas jatkuvat Kisapuiston vasemmasta alakulmasta
  vgrad(262, 126, 58, 10, ["#2c3c24", "#22301c"]); r(262, 125, 58, 1, "#5c5c68"); fillPoly([[262, 125], [254, 136], [256, 136], [264, 126]], "#4c4c58");
  r(268, 121, 52, 1, "#a8987c"); r(268, 122, 52, 1, "#6c5c50"); for (let x = 270; x < 320; x += 9) { r(x, 120, 2, 6, "#8c7c68"); px(x, 120, "#c8b898"); }
  for (const [bx, by, bw] of [[-4, 127, 36], [290, 129, 34]]) { seed = bx + 300;
    for (let x = bx; x < bx + bw; x++) { const h = 3 + Math.round(Math.sin((x - bx) / bw * Math.PI) * (bw / 6)) + ((rnd() * 2) | 0), top = by + (bw / 6) - h + 3;
      r(x, top, 1, H - top, "#0e1018"); if (x % 3 === 0) px(x, top, "#2a2438"); } }
  seed = 79; for (let k = 0; k < 70; k++) px(rnd() * W, 98 + rnd() * 38, ["#c8782c", "#e8a83c", "#8c4c1c"][(rnd() * 3) | 0]);
}
function parkkiDraw(t) {
  g.drawImage(paintBg("parkki_sky", () => kisaSky(false)), 0, 0);
  KISA_CLOUDS.forEach((b, k) => drift(`kisa_cloud${k}`, b[5], (w) => kisaCloudBand(w, b, k), t));
  g.drawImage(paintBg("parkki_fg", parkkiFg), 0, 0);
  // yksinäinen lyhty: valokeila asfaltille, salkkumies seisoo sen alla
  const [lx, ly] = PARK_LAMP, h = 46;
  for (let j = -7; j <= 7; j++) for (let i = -30; i <= 30; i++) { const d = Math.hypot(i / 30, j / 7); if (d < 1 && bay(lx + i, ly + j) < (1 - d) * 1.1) px(lx + i, ly + j, d < .35 ? "#a8906c" : d < .7 ? "#6c5850" : "#40384a"); }
  for (let y = ly - h + 4; y < ly; y++) { const k = (y - (ly - h)) / h, w = 4 + k * 50; if ((y & 1) === 0) r(lx - w / 2, y, w, 1, `rgba(255,220,150,${.09 * (1 - k * .5)})`); }
  r(lx, ly - h, 1, h, "#2c2a38"); r(lx + 1, ly - h, 1, h, "#4c4a5c"); r(lx - 4, ly - h - 1, 9, 2, "#3c3a4c"); r(lx - 3, ly - h + 1, 7, 1, "#fff0b0");
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
