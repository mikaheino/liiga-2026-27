// Mouhon salaisuus -- Suuren basaarin portti, Istanbul: saapuminen ja sisäänkäynti basaariin.
"use strict";
// Backlog 8 (24.10.): Jussi saapuu ensin aukiolle basaarin portin eteen ja kävelee sisään.
// Vierivä rivi portti | basaari: oikea reuna jatkaa basaarin vasenta reunaa (markiisi y 10-19,
// rapattu seinä y 20-79, tumma arkadi y 80-111, kynnys y 112, mukulakivet), ks. basaariFg.
const GATE = { x0: 240, x1: 296 };
function porttiFg() {
  // Beyazıtin moskeija aukion takana: kupoli, puolikupolit ja kaksi minareettia
  const M = "#3a1834", ML = "#6a2c50";
  r(40, 48, 120, 32, M); r(40, 48, 1, 32, ML);
  disc(100, 40, 20, ML); disc(101, 40, 19, M); r(80, 40, 42, 8, M); r(80, 40, 1, 8, ML);
  for (const x of [62, 138]) { disc(x, 50, 10, ML); disc(x + 1, 50, 9, M); }
  r(99, 14, 2, 8, M); r(99, 14, 1, 8, ML); px(100, 12, "#fcb04c"); px(99, 13, "#fcb04c");
  for (const [x, top] of [[28, 10], [172, 10]]) { r(x, top, 3, 70, M); r(x, top, 1, 70, ML); tri(x - 1, top - 9, 5, 9, M); r(x - 2, top + 16, 7, 2, ML); r(x - 2, top + 34, 7, 2, ML); }
  for (let x = 46; x < 156; x += 7) { px(x, 62, "#fcb04c"); px(x, 63, "#c86c3c"); }
  // matalat talot aukion laidalla
  for (const [x, w, h, c] of [[0, 30, 20, "#8c5440"], [184, 26, 24, "#9c6448"], [208, 28, 18, "#86503c"]]) { r(x, 80 - h, w, h, c); r(x, 80 - h, w, 1, "#c4885a");
    for (let wx = x + 4; wx < x + w - 4; wx += 8) { r(wx, 86 - h, 4, 5, "#3a2a4a"); r(wx + 1, 87 - h, 2, 3, "#fcc858"); } }
  // aukio: samat mukulakivet kuin basaarissa (rivit levenevät lähelle), valolammikot lyhdyn ja portin edessä
  const FL = ["#3c2838", "#5c4050", "#86603e", "#a87a4c", "#c89a64"], MOR = "#34202c", hsh = (a, b) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); };
  for (let y = 80, row = 0; y < H; row++) { const h = Math.max(1, Math.round(1 + (y - 80) / 56 * 5)), sw = 3 + (y - 80) / 56 * 9;
    for (let j = 0; j < h && y + j < H; j++) { const yy = y + j;
      for (let x = 0; x < W; x++) { const u = x / sw + (row % 2 ? .5 : 0), sid = Math.floor(u), fu = u - sid;
        if ((j === h - 1 && h > 1) || (fu * sw < 1 && sw > 3)) { px(x, yy, MOR); continue; }
        let L = 1.3 + (hsh(sid, row) - .5) * .9;
        for (const [lx, ly, lr] of [[196, 106, 46], [268, 120, 54], [70, 116, 30]]) { const d = Math.hypot(x - lx, (yy - ly) * 2.2); if (d < lr) L += 1.9 * (1 - d / lr); }
        if (j === 0 && h > 2) L += .5;
        L += (bay(x, yy) - .5) * .3 + (hsh(sid, row + 9) < .5 ? .2 : -.2); px(x, yy, FL[Math.max(0, Math.min(4, Math.round(L)))]); } }
    y += h; }
  for (let x = 0; x < W; x++) if (bay(x, 80) < .5) px(x, 80, "#2c1c28");                             // talojen juuri
  // basaarin ulkoseinä: sama rappaus, markiisi ja arkadi kuin sisällä
  r(232, 0, 88, 10, "#130e1d"); r(232, 10, 88, 2, "#6a6758");
  for (let x = 232; x < W; x += 12) r(x, 12, 6, 8, "#ece4c4"); for (let x = 238; x < W; x += 12) r(x, 12, 6, 8, "#c8302c");
  porttiAshlar(232, 20, W, 112); r(232, 20, 1, 92, "#e8a868"); r(233, 21, 1, 90, "#c98a58");      // kiviladonta, aurinkoreuna vasemmalla
  // oikean reunan sivuovi: kivikehys, syvä aukko ja kynnys
  { const dx = 304, dw = 12; r(dx - 2, 84, dw + 4, 28, "#c98a58"); disc(dx + dw / 2, 86, dw / 2 + 2, "#c98a58"); r(dx - 2, 84, 1, 28, "#e8a868");
    r(dx, 86, dw, 26, "#2a1830"); disc(dx + dw / 2, 86, dw / 2, "#2a1830"); r(dx + 2, 88, dw - 2, 24, "#1a1222"); disc(dx + dw / 2 + 1, 87, dw / 2 - 2, "#1a1222");
    r(dx + 4, 96, 3, 4, "#a8741c"); r(dx + 5, 97, 1, 2, "#fce070"); r(dx - 3, 110, dw + 6, 2, "#b07848"); }
  // markiisin alla varjo, roikkuvat kangaslaput ja niiden varjot
  r(232, 20, 88, 2, "#3a2040"); for (let x = 232; x < W; x++) if (bay(x, 22) < .5) px(x, 22, "#3a2040");
  for (let x = 232, k = 0; x < W; x += 4, k++) { r(x, 20, 4, 2, k % 2 ? "#c8302c" : "#ece4c4"); r(x + 1, 22, 2, 1, "#3a2040"); }
  r(232, 112, 88, 2, "#b17646"); r(232, 114, 88, 1, "#4a2c24");
  // portti: kaareva aukko listarenkaineen, syvennys ja laskettu säleikköluukku
  const { x0, x1 } = GATE, cx = (x0 + x1) / 2, R = (x1 - x0) / 2;
  r(x0 - 2, 46, x1 - x0 + 4, 66, "#c98a58"); disc(cx, 46, R + 2, "#c98a58");
  r(x0, 46, x1 - x0, 66, "#2a1830"); disc(cx, 46, R, "#2a1830");
  for (let y = 46 - R + 2; y < 112; y++) { const hw = y >= 46 ? R - 2 : Math.floor(Math.sqrt(Math.max(0, (R - 2) ** 2 - (46 - y) ** 2))); if (hw < 1) continue;
    const m = (y - 18) % 3; r(cx - hw, y, hw * 2, 1, m === 0 ? "#3a3868" : m === 1 ? "#2a2848" : "#1c1a34"); }
  r(cx, 46 - R + 2, 1, 112 - 46 + R - 2, "#141226"); r(cx + 1, 46 - R + 2, 1, 112 - 46 + R - 2, "#3a3868");
  for (const [bx, by] of [[cx - 3, 92], [cx + 3, 92]]) { r(bx - 1, by, 3, 3, "#6a5020"); px(bx, by, "#e8c868"); }      // salvat
  for (const [lx, ly] of [[cx - 12, 64], [cx + 10, 58], [cx, 76]]) { r(lx - 2, ly, 5, 6, "#a8741c"); r(lx - 1, ly + 1, 3, 4, "#fce070"); }      // lyhdyt sisällä
  for (let a = 0; a <= 28; a++) { const t = Math.PI * a / 28; px(Math.round(cx - Math.cos(t) * (R + 2)), Math.round(46 - Math.sin(t) * (R + 2)), a < 12 ? "#e8a868" : "#a8704a"); }
  r(x0 - 2, 46, 1, 66, "#e8a868");
  r(cx - 26, 26, 52, 9, "#1c5c3c"); r(cx - 26, 26, 52, 1, "#3c8c5c"); text3("KAPALICARSI", cx - 22, 28, "#fcd85c");
  // kivinen kynnysaskel ja sen pitkä viileä varjo vasemmalle mukulakiville
  r(x0 - 4, 110, x1 - x0 + 8, 2, "#b07848"); r(x0 - 4, 112, x1 - x0 + 8, 2, "#7a5038"); r(x0 - 4, 110, x1 - x0 + 8, 1, "#e8a868");
  for (let y = 112; y < 118; y++) { const xl = x0 - 4 - (y - 111) * 7; for (let x = xl; x < x0 - 4; x++) if (x - xl > 5 && y < 117 || bay(x, y) < .5) px(x, y, "#3a2848"); }
  // viirinauha markiisilta lyhtypylvääseen, nauhalla roikkuva messinkilyhty
  for (let x = 198; x <= 233; x++) px(x, Math.round(porttiStr(x)), "#2c1c28");
  for (let x = 200, k = 0; x < 230; x += 6, k++) { const y = Math.round(porttiStr(x + 2)) + 1, c = k % 3 === 2 ? "#ece4c4" : "#c84038";
    r(x, y, 5, 1, c); r(x + 1, y + 1, 3, 2, c); px(x + 2, y + 3, c); if (c !== "#ece4c4") px(x + 2, y + 1, "#ece4c4"); }
  { const ly = Math.round(porttiStr(212)); r(212, ly, 1, 4, "#2c1c28"); r(210, ly + 4, 5, 1, "#6a5020"); r(210, ly + 5, 5, 5, "#a8741c"); r(211, ly + 6, 3, 3, "#fce070"); r(211, ly + 10, 3, 1, "#6a5020"); }
  turkFlag(cx - 4, 2);
}
// viirinauhan riippuva käyrä markiisin reunasta (233,22) lyhtypylvään päähän (197,54)
function porttiStr(x) { const s = (233 - x) / 36; return 22 + 32 * s + 5 * Math.sin(Math.PI * s); }
// kiviladonta: 6x3 lohkot kolmessa sävyssä, saumat violetinruskeat, rivit lomittain, muutama lohjennut lohko
function porttiAshlar(x0, y0, x1, y1) {
  const T = ["#8a5a3c", "#a8704a", "#c98a58"], hs = (a, b) => { const v = Math.sin(a * 91.3 + b * 47.9) * 24634.6345; return v - Math.floor(v); };
  r(x0, y0, x1 - x0, y1 - y0, "#4a2c38");
  for (let y = y0, row = 0; y < y1; y += 4, row++) for (let x = x0 - (row % 2 ? 3 : 0), col = 0; x < x1; x += 7, col++) {
    const bx = Math.max(x, x0), bw = Math.min(x + 6, x1) - bx, bh = Math.min(3, y1 - y - 1); if (bw < 1 || bh < 1) continue;
    const h = hs(col, row), chip = (row * 7 + col * 3) % 29 === 5;
    r(bx, y + 1, bw, bh, chip ? "#6a4030" : T[h < .3 ? 0 : h < .75 ? 1 : 2]);
    if (chip) px(bx + bw - 1, y + 1, "#4a2c38"); else if (h >= .3 && bw > 2) px(bx, y + 1, T[2]);
  }
}
function porttiDraw(t) {
  g.drawImage(paintBg("portti_sky", () => basaariSky(false)), 0, 0);
  BAZ_CLOUDS.forEach((b, k) => drift(`baz_cloud${k}`, b[5], (w) => bazCloudBand(w, b, k), t));
  g.drawImage(paintBg("portti_fg", porttiFg), 0, 0);
  // portista valuva lämmin valokeila mukulakiville, hitaasti lepattava
  { const fl = .85 + .1 * Math.sin(t / 700) + .05 * Math.sin(t / 230);
    for (let y = 114; y < 137; y++) { const s = (y - 112) / 24, xl = Math.round(244 - s * 54), xr = Math.round(292 - s * 26), d = .3 * fl * (1 - s * .6);
      for (let x = xl; x < xr; x++) { const e = Math.min(1, (x - xl) / 8, (xr - x) / 8); if (bay(x, y) < d * e) px(x, y, "#ffb860"); } } }
  glow(212, 53, 14, "255,190,100", .28 + .05 * Math.sin(t / 170));
  { const cx = (GATE.x0 + GATE.x1) / 2;
    [[cx - 12, 64], [cx + 10, 58], [cx, 76]].forEach(([lx, ly], k) => { if (Math.floor(t / 80) % 53 === k * 17) r(lx - 1, ly + 1, 3, 4, "#a8741c"); }); }
  // simit-kärry ja höyry, lyhtypylväs, kyyhkyt ja kissa
  { const x = 60, y = 112; shadow(x + 10, y + 2, 14); r(x, y - 12, 22, 10, "#c8302c"); r(x, y - 12, 22, 1, "#e85c4c"); r(x - 1, y - 14, 24, 2, "#8c1c1c");
    for (let i = 0; i < 4; i++) { disc(x + 3 + i * 5, y - 17, 2, "#c8843c"); px(x + 3 + i * 5, y - 17, "#5c3414"); }
    r(x + 2, y - 2, 1, 4, "#2c2c2c"); r(x + 19, y - 2, 1, 4, "#2c2c2c"); disc(x + 5, y + 1, 2, "#1c1c22"); disc(x + 17, y + 1, 2, "#1c1c22");
    for (let i = 0; i < 2; i++) { const k = ((t / 1100 + i / 2) % 1); px(x + 8 + i * 6 + Math.sin(t / 300 + i) * 1.5, y - 20 - k * 10, `rgba(240,230,220,${.5 * (1 - k)})`); } }
  { const x = 196, h = 50, y0 = 106; r(x, y0 - h, 1, h, "#2c2a38"); r(x - 3, y0 - h - 1, 7, 2, "#3c3a4c"); r(x - 2, y0 - h + 1, 5, 2, "#fce070"); glow(x, y0 - h + 3, 20, "255,180,90", .3 + .04 * Math.sin(t / 130)); }
  for (const [x0, ph] of [[120, 0], [128, 1.2], [150, 2.6]]) { const hop = Math.max(0, Math.sin(t / 260 + ph)) * 1.5; r(x0, 118 - hop, 4, 3, "#8c8c9c"); px(x0 + 4, 118 - hop, "#6c6c7c"); }
  { const tw = Math.sin(t / 420) * 3; r(214, 104, 8, 6, "#4c3c34"); disc(220, 103, 3, "#4c3c34"); px(219, 103, "#c8e85c"); px(221, 103, "#c8e85c"); lineC(214, 108, 209, 104 + tw, "#4c3c34"); }
  for (let i = 0; i < 3; i++) { const x = ((t / (40 + i * 9) + i * 110) % 380) - 30, y = 14 + i * 6 + Math.sin(t / 320 + i) * 3, up = Math.floor(t / 160 + i) % 2;
    px(x, y + up, "#2c1428"); px(x + 1, y, "#2c1428"); px(x + 2, y + 1, "#2c1428"); px(x + 3, y, "#2c1428"); px(x + 4, y + up, "#2c1428"); }
}
// Portti ja basaari ovat yksi vierivä rivi: basaari näkyy portin läpi jo aukiolta.
defineStrip(["portti", "basaari"]);
const toBazaar = () => crossTo("basaari", 60, 128);

defineRoom("portti", {
  title: "Suuren basaarin portti, Istanbul", scale: [80, 136, 0.25, 1.12], start: 124,     // aukio jatkuu moskeijalle asti (syvyys, 25.10.)
  walk: [[[0, 90], [30, 86], [200, 86], [228, 96], [240, 116], [320, 116], [320, 136], [0, 136]]],
  draw: porttiDraw,
  edges: { oikea: () => toBazaar() },
  spots: [
    { id: "portti", name: "basaarin portti", x: GATE.x0, y: 20, w: GATE.x1 - GATE.x0, h: 92, at: 268, aty: 120, exit: true,
      Katso: () => say("Kapalıçarşı, Suuri basaari. Neljätuhatta kauppaa katon alla. Jossain siellä on Mehmetin koju."),
      Kävele: () => toBazaar(), Käytä: () => toBazaar(), Avaa: () => toBazaar() },
    { id: "simit", name: "simit-kärry", x: 58, y: 92, w: 26, h: 22, at: 92, aty: 118,
      Katso: () => say("Simit-kärry. Seesamirinkeleitä pinossa. Myyjä on lähtenyt rukoukseen ja jättänyt kärryn luottamuksen varaan."),
      Poimi: () => say("Ei. Myyjä luottaa kaupunkiin. Minä en ole se, joka sen rikkoo.") },
    { id: "moskeija", name: "moskeija", x: 36, y: 14, w: 130, h: 66, at: 100, aty: 100,
      Katso: () => say("Moskeija aukion takana. Kupoli hehkuu iltaruskossa. Jopa Liigan toimisto näyttäisi tällaisessa valossa juhlalliselta.") },
    { id: "kissa", name: "kissa", x: 208, y: 98, w: 16, h: 12, at: 200, aty: 112,
      Katso: () => say("Istanbulin kissa. Täällä kissat omistavat kadut ja ihmiset vain käyvät."), Puhu: () => say("Kissa katsoo minua kuin olisin väärässä ruudussa.") },
  ],
});
