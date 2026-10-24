// Mouhon salaisuus -- Kalliotemppelin edusta, Kappadokia: saapuminen ja temppelin suu.
"use strict";
// Backlog 8 (24.10.): temppeliin tullaan oikealta. Vierivä rivi temppeli | kallio: vasen reuna
// on kallion varjoa ja jatkaa temppelin lähes mustaa oikeaa seinää (lattia y 92:sta alas).
const KAL_CHIM = [[96, 9, 40, "#a8603c"], [122, 6, 26, "#b46c44"], [150, 5, 18, "#b87048"], [214, 7, 28, "#a05a3c"], [246, 11, 46, "#b06844"], [292, 8, 34, "#a8603c"]];
// [x, y, koko, väri, keinunta]: koko 0 = punainen pääpallo, muut kaukaisia pikkupalloja
const KAL_BALLOONS = [[150, 24, 0, "", 2.2], [112, 34, 2, "#c0708a", 1.4], [134, 46, 1, "#a0507a", 1.2], [286, 28, 2, "#c0708a", 1.6], [206, 63, 1, "#a0507a", .8]];
const KAL_SUN = [230, 72];
// pikseliviiva ilman reunanpehmennystä
function kalLine(x0, y0, x1, y1, c) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let k = 0; k <= n; k++) px(Math.round(x0 + (x1 - x0) * k / n), Math.round(y0 + (y1 - y0) * k / n), c);
}
// kerrospilvi: pörröinen violetti yläreuna, vaaleanpunainen runko, suora kultainen alareuna
function kalCloud(x, yb, w, s) {
  const n = Math.max(2, Math.round(w / 8));
  g.save(); g.beginPath(); g.rect(x - 12, 0, w + 24, yb); g.clip();
  for (let k = 0; k < n; k++) { const rad = 4 + (k * 5 + s) % 4, cx = Math.round(x + w * (k + .5) / n); disc(cx, yb - rad + 1, rad, "#5a3a7a"); }
  for (let k = 0; k < n; k++) { const rad = 3 + (k * 5 + s) % 4, cx = Math.round(x + w * (k + .5) / n); disc(cx + 1, yb - rad + 3, rad, "#d07aa0"); }
  g.restore();
  r(x + 2, yb - 3, w - 4, 3, "#d07aa0"); r(x + 3, yb - 2, w - 6, 2, "#ffc27a");
  for (let i = x + 3; i < x + w - 3; i++) if (bay(i, yb - 3) < .5) px(i, yb - 3, "#ffc27a");
}
function kallioSky() {
  vgrad(0, 0, W, 96, ["#141c4c", "#1c2458", "#2c3470", "#4c3c84", "#7c4c8c", "#b45c84", "#e07c74", "#f8a46c", "#fcc87c"]);
  for (const [x, y] of [[152, 4], [171, 12], [196, 3], [224, 9], [258, 5], [281, 15], [302, 7], [40, 10]]) px(x, y, "#fff0c0");
  seed = 17; for (let i = 0; i < 10; i++) px(rnd() * W, rnd() * 18, "#6c6cb0");
  // horisontin auer: kirkastuva kellanpunainen dither
  for (let y = 56; y < 76; y++) { const t = Math.floor((y - 56) / 5) / 4 + .12; for (let x = 0; x < W; x++) if (bay(x, y) < t * .9) px(x, y, t > .6 && bay(x + 2, y) < t - .5 ? "#ffd27a" : "#ffb070"); }
  // laskeva aurinko: porrastettu kajo
  const [sx, sy] = KAL_SUN;
  for (let j = -18; j <= 18; j++) for (let i = -18; i <= 18; i++) { const d = Math.hypot(i, j); if (d < 18 && d > 10 && bay(sx + i, sy + j) < (18 - d) / 16) px(sx + i, sy + j, "#ff9a4a"); }
  disc(sx, sy, 10, "#ff9a4a"); disc(sx, sy, 8, "#ffd27a"); disc(sx, sy, 5, "#fff0c4");
  // kerrospilvet kolmessa vyössä
  for (const [x, yb, w, s] of [[14, 24, 56, 1], [168, 20, 44, 3], [84, 42, 50, 2], [228, 40, 70, 0], [0, 58, 36, 3], [150, 60, 46, 1], [276, 57, 44, 2]]) kalCloud(x, yb, w, s);
}
// pääpallo 14x18: pystysuorat kaistat, aurinkopuolella valoreuna, kori ja köydet
function kalHero(x, y) {
  x = Math.round(x); y = Math.round(y);
  const gore = ["#8a1a34", "#d8283a", "#ffe6b0", "#d8283a", "#ffe6b0", "#d8283a", "#ff8a5a"];
  for (let j = 0; j < 15; j++) {
    const hw = j < 9 ? Math.round(7 * Math.sqrt(1 - ((j - 8.5) / 9) ** 2)) : Math.round(7 - (j - 8) * .85);
    for (let i = -hw; i < hw; i++) {
      let c = gore[Math.min(6, Math.floor((i + 7) / 2))];
      if (i === -hw) c = "#8a1a34"; else if (i === hw - 1) c = "#ffb46a";
      px(x + i, y + j, c);
    }
  }
  r(x - 2, y + 15, 4, 1, "#8a1a34");
  px(x - 2, y + 16, "#4a2a20"); px(x + 1, y + 16, "#4a2a20"); px(x - 2, y + 17, "#4a2a20"); px(x + 1, y + 17, "#4a2a20");
  r(x - 2, y + 18, 4, 3, "#6a3a2a"); r(x - 2, y + 18, 4, 1, "#8a5a3a"); px(x + 1, y + 19, "#8a5a3a");
}
function kalSmall(x, y, s, c) {
  x = Math.round(x); y = Math.round(y);
  if (s > 1) { disc(x, y, 2, c); px(x + 1, y - 1, "#ffb46a"); px(x + 2, y, "#ffb46a"); px(x, y + 3, "#5a3040"); }
  else { r(x - 1, y - 1, 3, 3, c); px(x + 1, y - 1, "#ffb46a"); px(x, y + 2, "#5a3040"); }
}
// valo ja varjo: pitkät violetit heittovarjot vasemmalle, valoreunat, oven kajo kynnyksellä
function kalShadow(x, y, len, h) {
  for (let j = 0; j < h; j++) for (let i = 0; i < len - j * 2; i++) {
    const k = i / len, t = k < .33 ? .75 : k < .66 ? .5 : .25;
    if (bay(x - i, y + j) < t) px(x - i, y + j, k < .66 ? "#4a2e5a" : "#6a3f6e");
  }
}
function kallioLight() {
  for (let y = 66; y < 76; y++) for (let x = 80; x < W; x++) if (bay(x, y) < (y < 71 ? .25 : .125)) px(x, y, "#ffb070");    // auer sulauttaa kalliot
  for (const [x, w, h] of KAL_CHIM) kalShadow(x - w, 98, Math.round(h * 1.4), 4);
  for (let y = 100; y < H; y++) { const xl = Math.round(lerp(190, 150, (y - 100) / 36)), wd = 4 + (y - 100) / 3;        // polun varjokaista
    for (let i = 1; i < wd; i++) { const k = i / wd; if (bay(xl - i, y) < (k < .33 ? .75 : k < .66 ? .5 : .25)) px(xl - i, y, k < .66 ? "#4a2e5a" : "#6a3f6e"); } }
  kalShadow(105, 115, 24, 3); kalShadow(237, 110, 20, 2); kalShadow(250, 109, 26, 2);
  for (const [x, w, h] of KAL_CHIM) {                                                                    // valoreunat aurinkoon päin
    kalLine(x + w - 1, 97, x + w * .6 - 1, 98 - h * .6, "#ffb46a"); kalLine(x + w * .6 - 1, 98 - h * .6, x + w * .35 - 1, 98 - h, "#ffb46a");
    kalLine(x + w * .6 - 1, 98 - h, x + 1, 99 - h - w * .9, "#ffb46a"); }
  for (let y = 108; y < 112; y++) px(244, y, "#ffb46a");
  for (let y = 106; y < 120; y++) for (let x = 14; x < 72; x++) {                                       // oven valo kynnyksellä
    const d = Math.hypot((x - 31) / 40, (y - 110) / 9); if (d < 1 && bay(x, y) < (1 - d) * .7) px(x, y, d < .4 ? "#ff9a3a" : "#c8642c"); }
}
function kallioFg() {
  fillPoly([[60, 90], [60, 76], [90, 72], [130, 75], [170, 70], [210, 74], [250, 69], [290, 73], [320, 70], [320, 96], [60, 96]], "#8c5470");   // kaukainen harju
  for (const [x, w, h, c] of KAL_CHIM) {                                                                  // keijupiiput kivihattuineen
    fillPoly([[x - w, 98], [x - w * .6, 98 - h * .6], [x - w * .35, 98 - h], [x + w * .35, 98 - h], [x + w * .6, 98 - h * .6], [x + w, 98]], c);
    fillPoly([[x - w * .1, 98], [x + w * .2, 98 - h * .7], [x + w * .35, 98 - h], [x + w * .6, 98 - h * .6], [x + w, 98]], "rgba(60,20,20,.25)");
    fillPoly([[x - w * .6, 99 - h], [x, 98 - h - w * .9], [x + w * .6, 99 - h]], "#5c3428");
    for (const [dx, dy] of [[-2, -h * .5], [2, -h * .3]]) r(x + dx, 98 + dy, 2, 3, "#3c1c1c"); }                  // luolaikkunat
  // laakson pohja ja polku
  vgrad(0, 96, W, 40, ["#b4704c", "#a4643c", "#8c5434", "#74442c", "#5c3424"]);
  seed = 21; for (let i = 0; i < 120; i++) px(rnd() * W, 98 + rnd() * 38, rnd() < .5 ? "#c8845c" : "#4c2c1c");
  kalDunes();
  // polku kapenee horisonttiin asti: Jussi kävelee sitä syvyyssuunnassa (palaute 25.10.: "enemmän kolmiulotteista liikkumista")
  fillPoly([[150, 136], [195, 96], [207, 96], [238, 136]], "#c88c5c"); for (let y = 98; y < H; y += Math.max(2, Math.round((y - 90) / 6))) { const k = (y - 96) / 40; r(lerp(195, 150, k) + 2 + k * 4, y, lerp(12, 88, k) - 4 - k * 8, 1, "#b4784c"); }
  r(196, 96, 10, 1, "#e8b07c");
  // kallioseinä vasemmalla: temppelin suu varjossa (x 0 lähes musta, valo lisääntyy oikealle)
  fillPoly([[0, 0], [70, 0], [62, 30], [74, 60], [66, 98], [76, 136], [0, 136]], "#5c3424");
  for (let y = 0; y < H; y++) for (let x = 0; x < 78; x++) { const k = x / 74; if (bay(x, y) > k * 1.1) px(x, y, y > 92 ? "#110b08" : "#16100f"); }
  for (let y = 0; y < 98; y += 6) lineC(48 + (y % 12 ? 4 : 0), y, 66 + (y % 12 ? 0 : 4), y + 3, "#7c4c34");          // tuffin kerrokset
  // hakattu ovi: pylväät ja kaari, sisältä soihdun kajo
  r(14, 52, 34, 58, "#0a0706"); disc(31, 52, 17, "#0a0706");
  for (const x of [10, 46]) { r(x, 46, 6, 64, "#4c2c1c"); r(x, 46, 1, 64, "#7c4c34"); r(x - 1, 44, 8, 3, "#5c3424");
    for (const y of [60, 76, 92]) { r(x, y, 6, 1, "#8a5a48"); r(x, y + 1, 6, 1, "#24140e"); } }            // kiviharkkojen saumat
  // soihdun liekki oven sisällä: porrastettu kajo, reunat ditheröity
  for (let j = -10; j <= 10; j++) { const rx = 4 + 5 * (j + 10) / 20; for (let i = -10; i <= 10; i++) {
    const d = Math.hypot(i / rx, j / 10), x = 31 + i, y = 88 + j;
    if (d < .4) px(x, y, "#ffcf6a"); else if (d < .7) px(x, y, "#ff9a3a"); else if (d < 1) px(x, y, "#b04a2a");
    else if (d < 1.35 && bay(x, y) < (1.35 - d) * 1.6) px(x, y, "#b04a2a"); } }
  r(12, 110, 38, 3, "#3c2418"); r(8, 113, 46, 3, "#2c1a12");                                              // kynnys ja porras
  // pensaat ja kivet laaksossa
  for (const [x, y] of [[110, 112], [266, 118]]) { disc(x, y, 5, "#4c5c2c"); disc(x - 1, y - 1, 3, "#6c7c3c"); px(x + 4, y - 2, "#ffb46a"); px(x + 3, y - 3, "#ffb46a"); }
  for (const [x, y, w] of [[238, 108, 7]]) { r(x, y, w, 4, "#6c4c3c"); r(x, y, w, 1, "#a4785c"); }
  // tumma etuala: rosoiset kalliot ja kuivat heinätupsut kehystävät näkymän
  const rim = pts => { for (let k = 1; k < pts.length; k++) kalLine(pts[k - 1][0], pts[k - 1][1], pts[k][0], pts[k][1], "#d07a4a"); };
  const R = [[268, 136], [272, 124], [278, 118], [283, 121], [288, 112], [294, 117], [300, 114], [306, 120], [312, 116], [320, 119]];
  fillPoly([...R, [320, 136]], "#2a1830");
  fillPoly([[288, 113], [294, 118], [300, 115], [306, 121], [303, 136], [290, 136]], "#3e2438");
  fillPoly([[312, 117], [320, 120], [320, 136], [314, 136]], "#3e2438"); rim(R.slice(1));
  const L = [[60, 136], [63, 128], [68, 124], [74, 126], [78, 131], [80, 136]];
  fillPoly(L, "#2a1830"); fillPoly([[68, 125], [74, 127], [78, 132], [80, 136], [70, 136]], "#3e2438"); rim(L.slice(1, 5));
  const tuft = (bx, by, n) => { for (let k = -n; k <= n; k++) { const tx = bx + k * 2 + (k > 0 ? 1 : 0), ty = by - 6 + Math.abs(k) * 1.5;
    kalLine(bx, by, tx, ty, "#3e2438"); px(Math.round(tx), Math.round(ty), "#d07a4a"); } };
  tuft(275, 125, 2); tuft(299, 116, 2); tuft(316, 118, 1); tuft(284, 134, 2);
  // piikkipensas temppelin edustalla
  for (const [ex, ey] of [[90, 124], [94, 120], [100, 119], [106, 121], [109, 126], [96, 128], [104, 129]]) {
    kalLine(100, 136, ex, ey, "#2a1830"); kalLine(100, 135, (ex + 100) / 2 + 1, (ey + 136) / 2, "#3e2438");
    px(ex, ey, "#d07a4a"); px(Math.round((ex + 100) / 2) - 1, Math.round((ey + 136) / 2) - 1, "#3e2438"); }
}
// hiekkadyynit valoreunoineen (piirretään laakson pohjan päälle)
function kalDunes() {
  for (const [x0, px0, py, x1] of [[244, 280, 103, 318], [94, 126, 104, 152]]) {
    fillPoly([[x0, 111], [px0, py], [x1, 110]], "#b87a50"); fillPoly([[x0, 111], [px0, py], [px0 - 4, 111]], "#9c6440");
    kalLine(px0, py, x1, 110, "#ffb46a"); kalLine(px0 + 1, py + 1, x1 - 4, 110, "#d89060"); }
}
function kallioDraw(t) {
  g.drawImage(paintBg("kallio_sky", kallioSky), 0, 0);
  for (const [x, y, s, c, sp] of KAL_BALLOONS) { const bx = x + Math.sin(t / 2600 + x) * (s ? 3 : 6), by = y + Math.sin(t / 1700 + y) * sp;
    if (s) kalSmall(bx, by, s, c); else kalHero(bx, by); }
  g.drawImage(paintBg("kallio_fg", kallioFg), 0, 0);
  g.drawImage(paintBg("kallio_light", kallioLight), 0, 0);
  glow(KAL_SUN[0], KAL_SUN[1], 46, "255,170,90", .22);                                                   // matala aurinko
  { const f = .5 + .5 * Math.sin(t / 120); glow(31, 88, 16, "255,150,60", .16 + .08 * f); }             // soihdun kajo ovella
}
// Temppeli ja sen edusta ovat yksi vierivä rivi: temppelin suu näkyy jo laaksosta.
defineStrip(["temppeli", "kallio"]);
const toTempleDoor = () => crossTo("temppeli", 270, 122);

defineRoom("kallio", {
  title: "Kalliotemppelin edusta, Kappadokia", scale: [94, 136, 0.18, 1.29], start: 122,     // jyrkkä syvyys: polun päässä Jussi on pieni
  walk: [[[0, 104], [160, 100], [320, 102], [320, 136], [0, 136]], [[195, 96], [207, 96], [214, 104], [188, 104]]],
  draw: kallioDraw,
  edges: { vasen: () => toTempleDoor(), oikea: () => backToBazaar() },
  spots: [
    { id: "ovi", name: "temppelin ovi", x: 8, y: 36, w: 46, h: 78, at: 40, aty: 120, exit: true,
      Katso: () => say(st.flags.refMet ? "Temppelin suu. Sisällä tuomari ja idoli." : "Kallioon hakattu ovi. Sisältä kajastaa soihdun valo. Joku on käynyt täällä ennen minua. Tai jokin."),
      Kävele: () => toTempleDoor(), Käytä: () => toTempleDoor(), Avaa: () => toTempleDoor() },
    { id: "polku", name: "polku basaariin", x: 184, y: 86, w: 34, h: 18, at: 201, aty: 97, exit: true,
      Katso: () => say("Polku laaksoon. Siitä bussilla ja minibussilla takaisin Istanbuliin. Tai Mehmetin serkun kyydillä."),
      Kävele: () => backToBazaar(), Käytä: () => backToBazaar() },
    { id: "pallot", name: "kuumailmapallot", x: 120, y: 8, w: 180, h: 46,
      Katso: () => say("Kuumailmapalloja iltaruskossa. Jos Mouho olisi pallo, se olisi tuo punainen. Ilmainen ja korkealla.") },
    { id: "piiput", name: "keijupiiput", x: 84, y: 50, w: 230, h: 48,
      Katso: () => say("Keijupiippuja. Kivitorneja, joissa ihmiset ovat asuneet tuhansia vuosia. Vuokra on kuulemma ollut kohtuullinen.") },
  ],
});
