"use strict";
// Mouhon salaisuus -- Kaivokatu 10 ja loppuanimaatio (17.10.: "paranna grafiikat Kaivokadulle"
// ja "Kaivokadun osio on tarinan kerronnan kannalta haparoiva").
//
// Kerronta etenee yhtenä ketjuna: ulkokuva (rautatieasemaa vastapäätä) -> neljäs kerros, hallitus
// aloittaa haastattelun -> Jussi esittelee tekemänsä: jäsenet saapuvat ryhmä kerrallaan -> "Mitä me
// saamme?" -> Jussi soittaa Joukolle -> "Anna ihmisten pelata" -> Jussi kääntää pyramidin
// turnauskaavioksi -> kebab, palkinto, tuomari -> hallitus: brändin myynti -> Mehmet -> palkkaus.

// ---------------------------------------------------------------- ulkokuva: kävely Kaivokatua
// Marraskuun ilta (23.10.: tarina syksyllä 2026). Jussi kävelee Kaivokatua kolmen ruudun matkan,
// ja tausta liikkuu Castlevanian tapaan viitenä kerroksena (engine.js parallax): taivas ja kuu,
// kaukana Tuomiokirkko, keskellä kivitalojen siluetit, kadun talot ja lopussa rautatieasema ja
// Kaivokatu 10, edessä pylväiden ja paljaiden puiden siluetit. Viimeinen ruutu on vanha ulkokuva.
const KK_W = 960, KK_END = 872;                    // maailman leveys; Jussi pysähtyy Kaivokatu 10:n ovelle
const KK_LAYERS = [
  { name: "kk_sky", f: 0, paint: (w) => {
      vgrad(0, 0, w, 100, ["#0c1030", "#141a40", "#1c2450", "#2c2c5c", "#3c3466", "#4c3c6c"]);
      seed = 17; for (let i = 0; i < 60; i++) px(rnd() * w, rnd() * 70, rnd() < .3 ? "#fcfcf0" : "#8c8cb4");
      glow(252, 26, 40, "220,220,255", .25); disc(252, 26, 15, "#ece8d4"); disc(256, 22, 4, "#d4d0bc"); disc(246, 30, 3, "#d4d0bc"); disc(258, 33, 2, "#d4d0bc"); },
    anim: (t) => { for (let i = 0; i < 4; i++) { const x = ((t / (260 + i * 70) + i * 110) % 420) - 60, y = 18 + i * 9;     // pilviä kuun editse
      g.fillStyle = `rgba(60,56,96,${.55 - i * .08})`; g.beginPath(); g.ellipse(x, y, 26, 4, 0, 0, 7); g.ellipse(x + 14, y - 2, 14, 4, 0, 0, 7); g.fill(); }
      for (const [sx, sy] of [[40, 12], [150, 30], [290, 20]]) if (Math.sin(t / 300 + sx) > -.2) { r(sx, sy, 1, 1, "#f0e8c0"); if (Math.sin(t / 300 + sx) > .6) { px(sx - 1, sy, "#f0e8c0"); px(sx + 1, sy, "#f0e8c0"); px(sx, sy - 1, "#f0e8c0"); px(sx, sy + 1, "#f0e8c0"); } }
      const cx = ((t / 1000 * 2) % 300) + 150; for (let k = 0; k < 3; k++) { r(cx + k * 22, 24 + k * 3, 30 - k * 4, 2, "#3a3a68"); r(cx + 4 + k * 22, 22 + k * 3, 18, 2, "#3a3a68"); } } },
  { name: "kk_far", f: .15, paint: (w) => {
      const C = "#1e2246"; r(0, 84, w, 30, C);
      for (let x = 0; x < w; x += 23) r(x, 78 + (x * 7 % 9), 20, 10, C);
      // Tuomiokirkko: valkoinen pylväikkö yössä, vihreä pääkupoli ja neljä pientä kupolia
      const T = 200; r(T - 30, 60, 60, 26, "#2c3058"); for (let x = T - 26; x < T + 28; x += 6) r(x, 66, 2, 18, "#3c4070");
      fillPoly([[T - 32, 60], [T + 32, 60], [T, 52]], "#2c3058"); r(T - 10, 40, 20, 14, "#2c3058");
      disc(T, 38, 11, "#24405c"); r(T - 11, 38, 22, 3, "#2c3058"); r(T - 1, 22, 2, 6, "#24405c"); for (const dx of [-26, 26]) { r(T + dx - 4, 50, 8, 10, "#2c3058"); disc(T + dx, 49, 4, "#24405c"); }
      r(232, 30, 30, 30, "#2a2f4a"); r(232, 30, 30, 2, "#3a4060"); r(234, 60, 26, 24, "#2a2f4a");
      for (let y = 35; y < 58; y += 6) for (let xx = 236; xx < 260; xx += 7) r(xx, y, 3, 3, ((xx + y) >> 2) % 3 ? "#3a4060" : "#2a2f4a");
      lineC(320, 84, 340, 40, "#2a2e52"); lineC(340, 40, 380, 40, "#2a2e52"); lineC(372, 40, 372, 84, "#2a2e52"); } },   // nosturi
  { name: "kk_mid", f: .45, paint: (w) => {
      seed = 29; let x = 0;
      for (let b = 190; b < 300; b += 22) { const hh = 56 + ((b * 5) % 23); r(b, 112 - hh, 21, hh, "#1e1e3c"); r(b + 3, 112 - hh - 3, 2, 3, "#1e1e3c"); }
      while (x < w) { const bw = 40 + ((rnd() * 40) | 0), h = 36 + ((rnd() * 34) | 0), c = rnd() < .5 ? "#2a2a48" : "#302c4c";
        r(x, 112 - h, bw - 2, h, c); r(x, 112 - h, bw - 2, 2, "#8a80a0");
        const hw = ((bw - 8) / 2) | 0; r(x + 3, 112 - h + 2, hw, h - 2, "#3a3a5c"); r(x + 3 + hw, 112 - h + 2, bw - 8 - hw, h - 2, "#4a4a70"); r(x + bw - 8, 112 - h + 2, 4, h - 2, "#5c5a80");
        for (let y = 112 - h + 6; y < 108; y += 4) for (let xx = x + 1; xx < x + bw - 3; xx += 5) if (rnd() < .6) r(xx + ((y >> 2) & 1) * 2, y, 3, 1, "#2a2a48");
        if (rnd() < .6) { r(x + 4, 112 - h - 5, 4, 5, "#161630"); r(x + 3, 112 - h - 6, 6, 1, "#161630"); } else { r(x + bw - 8, 112 - h - 9, 1, 9, "#161630"); r(x + bw - 11, 112 - h - 7, 7, 1, "#161630"); r(x + bw - 10, 112 - h - 4, 5, 1, "#161630"); }
        for (let y = 116 - h; y < 104; y += 7) for (let xx = x + 3; xx < x + bw - 6; xx += 6) if (rnd() < .22) { const q = rnd(); r(xx, y, 3, 3, q < .35 ? "#c8a45c" : q < .65 ? "#8c7c5c" : q < .85 ? "#b08848" : "#2a2a48"); if (q > .65 && q < .85) r(xx + 1, y, 1, 3, "#2a2a48"); }
        x += bw; }
      r(300, 20, 10, 60, "#262444"); fillPoly([[298, 20], [312, 20], [305, 4]], "#262444"); r(330, 26, 10, 54, "#262444"); fillPoly([[328, 26], [342, 26], [335, 10]], "#262444"); } },  // kaksoistornit
  { name: "kk_street", f: 1, paint: (w) => {
      seed = 41; let x = 0; const SHOPS = ["KAHVILA", "KIOSKI", "KIRJAT", "LIIKE", "PUBI", "OPTIKKO"];
      let n = 0;
      while (x < 600) { const bw = 56 + ((rnd() * 34) | 0), h = 38 + ((rnd() * 22) | 0), c = ["#8c7c6c", "#7c6c68", "#9c8c7c", "#6c6474"][(rnd() * 4) | 0];
        r(x, 112 - h, bw - 2, h, c); r(x, 112 - h, bw - 2, 3, "#5c5450"); r(x, 112 - h + 3, bw - 2, 1, "#b4a494");
        for (let y = 118 - h; y < 92; y += 9) for (let xx = x + 5; xx < x + bw - 10; xx += 11) { const q = rnd(); r(xx, y, 6, 6, q < .3 ? "#f0d08c" : q < .5 ? "#b08848" : "#2c3040"); if (q >= .3 && q < .5) r(xx + 2, y, 2, 6, "#2a2a48"); else if (q > .9) { r(xx, y, 3, 6, "#2a2a48"); r(xx + 3, y, 3, 6, "#2a2a48"); } }
        r(x + 4, 96, bw - 10, 14, "#f0c87c"); r(x + 4, 96, bw - 10, 2, "#fce8b0"); text3(SHOPS[n++ % SHOPS.length], x + 8, 91, "#fcf0d8");
        x += bw + (n % 2 ? 22 + ((rnd() * 18) | 0) : 0); }                         // sivukatu: kaukaiset kerrokset näkyvät välistä
      g.save(); g.translate(640, 0); kk10Block(); g.restore();
      vgrad(0, 112, w, 6, ["#a4a09c", "#8c8884"]); for (let x = 0; x < w; x += 10) r(x, 112, 1, 6, "#7c7874"); r(0, 112, w, 1, "#c4c0bc");
      vgrad(0, 118, w, 18, ["#5c5c64", "#44444c"]); for (const y of [124, 131]) { r(0, y, w, 1, "#a4a4ac"); r(0, y + 1, w, 1, "#24242c"); }
      for (let k = 0; k < w; k += 8) for (let j = 0; j < 3; j++) if (bay(k + j * 3, 120 + j * 5) < .45) px(k + j * 3 + (k % 3), 120 + j * 5 + (k % 4), "#5a5a78");
      for (const [a, b] of [[20, 160], [270, 330]]) for (let y = 128; y < 135; y++) for (let x = a; x < b; x++) { const e = Math.min(x - a, b - x) / 14; if (bay(x, y) < Math.min(.55, e * .55) * (y % 2 ? .6 : 1)) px(x, y, "#4a5a90"); }
      for (let x = 50; x < w; x += 110) kkHalo(x + 1, 73, 30);
      lineC(0, 30, w, 26, "#2c2c34"); lineC(0, 35, w, 31, "#2c2c34");
      for (let x = 50; x < w; x += 110) { r(x, 70, 2, 42, "#2c2c34"); r(x - 3, 68, 8, 3, "#3c3c44"); r(x - 2, 71, 6, 2, "#fff0b0"); glow(x + 1, 73, 22, "255,214,140", .35); } },
    anim: (t) => { tram(KK_W - ((t / 1000 * 90) % (KK_W + 240)));
      for (const [x0, v, k] of [[120, 9, 1], [380, -7, 4], [560, 6, 5], [760, -8, 2]]) { const x = ((x0 + t / 1000 * v) % KK_W + KK_W) % KK_W; npc(k, x, 116, t + x0 * 50, { moving: true, dir: Math.sign(v), sc: .85 }); } } },
];
// Etuala nopeimpana: pylväitä ja paljaita syyspuita, joista putoaa lehtiä.
const KK_FRONT = [{ name: "kk_front", f: 1.5, paint: (w) => {
    const S = "#08080e";
    for (const [x0, x1] of [[56, 82], [26, 40], [286, 312], [256, 270], [516, 542], [486, 500]]) for (let y = 128; y < 135; y++) for (let x = x0; x < x1; x++) { const e = Math.min(x - x0, x1 - x) / 6; if (bay(x, y) < Math.min(.7, e * .7) * (y % 2 ? .6 : 1)) px(x, y, "#3a4a7a"); }
    for (let x = 140; x < w; x += 230) {
      if ((x / 230 | 0) % 2) { r(x, 40, 5, 96, S); r(x - 4, 40, 13, 4, S); lineC(x + 2, 42, x + 60, 34, S); }        // raitiotien ajolankapylväs
      else kkTree(x);
    }
    for (let x = 60; x < w; x += 230) { r(x, 128, 18, 2, "#14182c"); r(x, 124, 18, 1, "#14182c"); r(x + 1, 130, 2, 5, "#14182c"); r(x + 15, 130, 2, 5, "#14182c"); r(x, 121, 1, 4, "#14182c"); }
    for (let x = 105; x < w; x += 230) { r(x, 126, 3, 10, "#0e1428"); r(x, 126, 1, 10, "#4a5a90"); r(x, 125, 3, 1, "#4a5a90"); }
    for (let x = 215; x < w; x += 230) { r(x, 126, 7, 10, "#14182c"); r(x - 1, 125, 9, 2, "#0e1428"); r(x + 6, 127, 1, 9, "#4a5a90"); }
    for (let x = 30; x < w; x += 230) { disc(x, 133, 3, "#0e1428"); r(x - 2, 129, 2, 2, "#0e1428"); } },
  anim: (t, w) => { for (let i = 0; i < 14; i++) { const x0 = (i * 97) % w, y = ((t / (18 + i % 5) + i * 37) % 150) - 10, x = x0 + Math.sin(t / 400 + i) * 6; r(x, y, 2, 1, i % 2 ? "#c8641c" : "#e8a43c"); } } }];
// Rautatieasema ja Kaivokatu 10 (vanhan ulkokuvan rakennukset), piirretään kadun kerrokseen kohtaan x 640.
function kkHalo(cx, cy, rad) {
  for (let j = -rad; j <= rad; j++) for (let i = -rad; i <= rad; i++) { const d = Math.sqrt(i * i + j * j); if (d > rad) continue; const lv = Math.pow(1 - d / rad, 1.3) * .8; if (bay(cx + i, cy + j) < lv) px(cx + i, cy + j, d < rad * .45 ? "#e8b860" : "#5a4060"); }
}
function kkTree(x) {
  const N = "#0e1428", M = "#4a5a90";
  dither(x - 12, 134, 34, 3, "#08080e", "#44444c", .5);
  for (let y = 80; y < 136; y++) { const w = 3 + ((y - 80) / 14 | 0); r(x, y, w, 1, N); r(x + w - 1, y, 1, 1, M); }
  for (const [dx, dy, ex, ey] of [[0, 84, -14, 70], [3, 88, 16, 72], [1, 96, -10, 90], [5, 100, 14, 94]]) { lineC(x + dx, dy, x + ex, ey, N, 2); lineC(x + ex, ey, x + ex + (ex < 0 ? -5 : 5), ey - 6, N); lineC(x + ex, ey, x + ex + (ex < 0 ? -6 : 6), ey + 1, N); }
  lineC(x + 2, 82, x + 1, 62, N, 2); lineC(x + 1, 70, x - 6, 64, N); lineC(x + 1, 74, x + 8, 66, N);
}
function kk10Block() {
  for (const [x, h, c] of [[94, 40, "#5c5468"], [108, 46, "#4c4458"], [122, 38, "#544c60"]]) { r(x, 112 - h, 16, h, c); for (let y = 116 - h; y < 108; y += 6) for (let xx = x + 2; xx < x + 14; xx += 5) r(xx, y, 3, 3, (xx + y) % 3 ? "#2c3040" : "#e8c47c"); }
  const G = "#7c7468", GD = "#5c5650", GL = "#9c9488";
  r(0, 60, 96, 52, G); for (let y = 62; y < 112; y += 4) r(0, y, 96, 1, GD); for (let x = 6; x < 92; x += 14) { r(x, 70, 8, 22, "#2c3040"); r(x + 1, 71, 6, 8, "#f0c87c"); }
  r(30, 6, 26, 106, G); r(30, 6, 2, 106, GL); r(54, 6, 2, 106, GD); for (let y = 10; y < 110; y += 5) r(30, y, 26, 1, GD);
  fillPoly([[28, 6], [58, 6], [54, 0], [32, 0]], "#4c8c7c"); r(42, -6, 2, 6, "#4c8c7c");
  disc(43, 22, 7, "#f4ecd0", "#3c3830"); lineC(43, 22, 43, 17, "#1c1c1c"); lineC(43, 22, 47, 23, "#1c1c1c"); glow(43, 22, 12, "255,230,170", .25);
  for (const x of [26, 58]) { r(x, 86, 4, 26, GD); disc(x + 2, 84, 3, "#5c5650"); r(x - 1, 92, 6, 3, "#f8e8a0"); glow(x + 2, 93, 8, "255,230,150", .4); }   // lyhdynkantajat
  const BX = 140; r(BX, 14, 180, 98, "#d4d2cc"); r(BX, 14, 180, 2, "#e8e6e0"); r(BX, 14, 3, 98, "#b4b2ac");
  for (let f = 0; f < 6; f++) { const y = 20 + f * 13, lit = f === 2;           // 4. kerros (alhaalta laskien) = f 2
    r(BX + 4, y, 172, 7, lit ? "#3c2c5c" : "#3c4c64"); r(BX + 4, y, 172, 1, lit ? "#9c7cdc" : "#8ca4bc");
    for (let x = BX + 6; x < BX + 174; x += 9) { if (lit) { r(x, y + 2, 7, 4, (x / 9) % 3 ? "#b48cfc" : "#7cfc9c"); } else if ((x * 7 + f * 13) % 11 < 4) r(x, y + 2, 7, 4, "#f0d08c"); r(x + 7, y, 2, 7, "#b4b2ac"); } }
  glow(BX + 90, 49, 70, "180,140,255", .22);
  r(BX + 52, 4, 78, 9, "#14101c"); text3("MOUHO 2026 . 4. KRS", BX + 55, 6, "#fcfc54"); glow(BX + 91, 8, 30, "252,252,84", .25);
  r(BX, 92, 180, 20, "#2c2c34");
  for (let k = 0, x = BX + 4; x < BX + 176; x += 30, k++) { r(x, 99, 24, 11, "#f0c87c"); r(x, 99, 24, 2, "#fce8b0"); r(x + 11, 99, 2, 11, "#6a4a30"); r(x, 104, 24, 1, "#6a4a30");
    r(x - 1, 90, 26, 8, "#5a3a48"); r(x - 1, 97, 26, 1, "#c87850"); text3(["KAHVILA", "KIOSKI", "KIRJAT", "TIIKE", "KAHVILA", "KIOSKI"][k], x + 1, 91, "#f4d8b8");
    if (k === 3) { r(x + 6, 99, 12, 11, "#14101c"); r(x + 7, 100, 10, 10, "#1c1830"); }
    dither(x + 2, 110, 20, 3, "#f0c87c", "#2c2c34", .35); }
  r(BX + 92, 96, 14, 16, "#14161c"); r(BX + 93, 97, 12, 15, "#4c5c70"); text3("10", BX + 95, 90, "#f4f4f4");
  r(120, 26, 2, 86, "#3c3c44");
}
// Kävelykohtaus: taustakerrokset, Jussi maailman koordinaateissa, etuala päälle.
function kaivokatuWalk(t, jx, idol) {
  const cam = camFollow(jx, KK_W);
  parallax(KK_LAYERS, cam, t, KK_W);
  g.save(); g.translate(-cam, 0);
  r(0, 116, KK_W, 20, "#6b6b78");
  for (let y = 116, k = 0; y < 136; y += 5, k++) { r(0, y, KK_W, 1, "#8a8a98"); for (let x = (k % 2) * 6; x < KK_W; x += 12) r(x, y, 1, 5, "#8a8a98"); }
  for (let x = 50; x < KK_W; x += 110) for (let y = 117; y < 136; y++) for (let xx = x - 24; xx <= x + 24; xx++) { const d = Math.abs(xx - x) / 24 + Math.abs(y - 126) / 18; if (d < 1 && bay(xx, y) < (1 - d) * 1.1) px(xx, y, d < .45 ? "#e8c060" : "#c8a850"); }
  shadow(jx, 117, 6); jussi(jx, 117, 1, Math.floor(t / 120) % 4, {}, .9);
  if (idol) { r(jx + 6, 99, 4, 6, "#e8c81c"); r(jx + 7, 97, 2, 2, "#e8c81c"); glow(jx + 8, 101, 8, "255,220,100", .3); }
  r(300, 112, 6, 6, "#14142a"); r(299, 110, 3, 4, "#14142a"); r(299, 108, 1, 2, "#14142a"); r(301, 108, 1, 2, "#14142a"); r(305, 116, 3, 2, "#14142a"); r(Math.round(307 + Math.sin(t / 500)), 112, 1, 4, "#14142a");
  g.restore();
  parallax(KK_FRONT, cam, t, KK_W);
  return cam;
}

// ---------------------------------------------------------------- sisätila, 4. kerros
// Ikkunoiden yötaivas ja ajelehtivat pilvet ikkunoiden takana (23.10.); mouhoInBg jättää taivaan läpinäkyväksi.
function mouhoInSky() { for (const wx of [26, 236]) vgrad(wx, 14, 60, 46, ["#2c3468", "#4c4c80", "#9c6c84"]); }
function mouhoInDraw(t) { g.drawImage(paintBg("mouhoIn_sky", mouhoInSky), 0, 0); drift("mouhoIn_clouds", 4, () => puffBand([[30, 18, 30], [100, 26, 24], [250, 20, 28], [190, 30, 20]], "#3c3c6c", "#6c5c8c"), t); g.drawImage(paintBg("mouhoIn", mouhoInBg), 0, 0); }
function mouhoInFull() { mouhoInSky(); mouhoInBg(); }     // kiinteä versio puhelupaneeliin
function mouhoInBg() {
  vgrad(0, 0, W, 104, ["#181a2c", "#20223a", "#262844"]);
  for (let x = 0; x < W; x += 16) r(x, 0, 1, 104, "#1c1e32");
  // ikkunat: rautatieaseman kellotorni yössä
  for (const wx of [26, 236]) { r(wx - 2, 12, 64, 50, "#3c3e54"); g.clearRect(wx, 14, 60, 38);       // taivas: mouhoInSky + pilvet
    if (wx === 26) { r(wx + 22, 20, 10, 40, "#5c5650"); disc(wx + 27, 30, 3, "#f4ecd0"); fillPoly([[wx + 21, 20], [wx + 33, 20], [wx + 31, 16], [wx + 23, 16]], "#4c8c7c"); }
    for (let k = 0; k < 8; k++) r(wx + 2 + k * 7, 52 + (k % 3) * 2, 5, 8, "#2c2c3c"); for (let k = 0; k < 10; k++) px(wx + 4 + k * 6, 54 + (k % 3) * 2, "#f0d08c");
    r(wx + 29, 14, 2, 46, "#3c3e54"); r(wx, 36, 60, 2, "#3c3e54"); r(wx - 4, 62, 68, 3, "#4c4e64"); }
  // banderolli
  r(92, 4, 136, 14, "#c81c1c"); r(92, 4, 136, 1, "#fc5c5c"); r(92, 17, 136, 1, "#7c0c0c"); text3("MOUHO 2026 . 2V2 NHL", 160 - text3w("MOUHO 2026 . 2V2 NHL") / 2, 8, "#fcfc54");
  // TV ja teline
  r(96, 24, 128, 70, "#0c0c0c"); r(98, 26, 124, 64, "#1c1c1c"); r(156, 94, 8, 6, "#2c2c2c"); r(140, 100, 40, 2, "#2c2c2c");
  r(186, 100, 18, 3, "#ececec"); r(187, 99, 16, 1, "#fcfcfc"); px(200, 100, "#3c7cfc");                         // PS5
  // ovi vasemmalla
  r(2, 44, 20, 60, "#3c2c1c"); r(4, 46, 16, 58, "#6c4c2c"); r(16, 74, 2, 4, "#e8c81c"); r(0, 42, 24, 3, "#4c4e64");
  // lattia, matto, sohva
  r(0, 102, W, 34, "#3c3448"); for (let y = 104; y < 136; y += 6) r(0, y, W, 1, "#342c40");
  fillPoly([[70, 108], [250, 108], [270, 134], [50, 134]], "#4c2c3c"); fillPoly([[78, 110], [242, 110], [258, 132], [62, 132]], "#5c3448");
  r(60, 106, 200, 14, "#2c4c7c"); r(60, 104, 200, 4, "#3c5c8c"); r(56, 104, 8, 18, "#24406c"); r(256, 104, 8, 18, "#24406c");
  for (let x = 74; x < 250; x += 44) r(x, 108, 40, 2, "#3c5c8c");
  // ohjaimet sohvalla
  for (const x of [96, 150, 204]) { r(x, 105, 8, 3, "#ececec"); px(x + 1, 106, "#3c7cfc"); px(x + 6, 106, "#c81c1c"); }
}
// Mouhon hallitus: isäntien Mikon, Ilkan ja Mikan omat pikselimuotokuvat (käyttäjän asset
// tuomarit.png, pikselöity pixel_face.py:llä), pöydän takana oikealla.
function boardTable(t) {
  // Sama rajaus kaikille (pää 1/2,2 kuvan leveydestä), sama koko, ja peilattuna niin, että
  // katse kääntyy Jussiin (17.10.: "eri kokoisia ja väärin päin"). Backlog 5.3: jäsenet
  // istuvat -- selkänojat takana, vartalo rintakuvan jatkeena pöydän reunaan, kädet pöydällä.
  const B = [["hallitus_mikko", 244], ["hallitus_ilkka", 274], ["hallitus_mika", 304]];
  for (const [, x] of B) { r(x - 13, 82, 26, 32, "#1c1418"); r(x - 12, 83, 24, 30, "#2c2026"); r(x - 12, 83, 24, 2, "#4c3c44"); r(x - 10, 86, 2, 24, "#3c2c34"); }
  B.forEach(([k, x], i) => {
    const img = faceCache[`bust|${k}`] ??= renderPix(PIXFACES[k].bust, {}), w = 32, h = img.height * 32 / img.width;
    const shirt = (faceCache[`shirt|${k}`] ??= (() => { const c = img.getContext("2d");      // paidan väri olkapäästä: alin peittävä pikseli
      for (let yy = img.height - 1; yy > img.height / 2; yy--) { const d = c.getImageData(Math.round(img.width * .3), yy, 1, 1).data; if (d[3] > 200) return `rgb(${d[0]},${d[1]},${d[2]})`; }
      return "#3c3c4c"; })());
    const bob = Math.round(Math.sin(t / 600 + i * 2) * .5), top = 108 - h + bob;
    fillPoly([[x - 13, 106], [x + 13, 106], [x + 15, 118], [x - 15, 118]], shirt);            // vartalo pöydän reunaan
    r(x - 15, 106, 3, 10, "rgba(0,0,0,.25)"); r(x + 12, 106, 3, 10, "rgba(0,0,0,.25)");
    g.save(); g.imageSmoothingEnabled = false; g.translate(x, 0); g.scale(-1, 1); g.drawImage(img, -w / 2, top, w, h); g.restore(); });
  r(226, 114, 94, 12, "#5c4632"); r(226, 114, 94, 2, "#7c6448"); r(230, 126, 3, 8, "#3c2c20"); r(314, 126, 3, 8, "#3c2c20");
  for (const [, x] of B) { r(x - 11, 113, 6, 3, "#e0a888"); r(x + 5, 113, 6, 3, "#e0a888"); r(x - 2, 113, 7, 2, "#f4f0e4"); }   // kädet ja paperit pöydällä
  r(255, 117, 38, 7, "#f4f0e4"); text3("HALLITUS", 257, 118, "#2c2c3c");
}

// ---------------------------------------------------------------- loppu
async function ending() {
  st.scene = "loppu"; $game.classList.add("cut"); $sent.textContent = "";
  await travel("ist", "hki"); music("loppu");
  const f = st.flags;
  st.inv = ["puhelin"]; renderInv();     // idoli, kebab ja sopimus ovat nyt pöydällä ja hallituksella (sokkotesti 2)
  // 1. ulkokuva
  let jx = 20; const T0 = performance.now(), speed = TEST ? 600 : 62;
  overlay = (t) => { jx = Math.min(KK_END, 20 + (performance.now() - T0) / 1000 * speed); kaivokatuWalk(t, jx, true); };
  callSpk = { get jussi() { return { x: Math.max(30, jx - camFollow(jx, KK_W)), y: 72, c: "#c8a460" }; } };   // kupla kävelevän Jussin päälle
  await say("Helsinki, marraskuu. Kaivokatu, rautatieaseman kulmilla.", "muu");
  await say("Mouho-ilta ja toiminnanjohtajan haastattelut. Jäsenet, tarjoilu, turnaus: kaikki hoidettu.");
  await say("Ja kutsuin kaikki jäseneni paikalle. Hallitus näkee omin silmin, mitä proaktiivisuus saa aikaan.");
  await say("Kaivokatu 10. Neljännessä kerroksessa valot palavat.", "muu");
  while (jx < KK_END) await sleep(100);
  // 2. sisätila
  const crowd = [];
  // Nimetyt hahmot omille paikoilleen eturiviin, basaarin väki taakse (sokkotesti 2: hahmot
  // pinoutuivat päällekkäin).
  const SLOT = { maskotti: [22, 124], saarni: [46, 124], mehmet: [72, 124], salkkumies: [96, 124], tuomari: [154, 122],
    jalonen: [160, 110], valtonen: [200, 120], jokinen: [222, 126], hyvarinen: [240, 128], carlsson: [258, 127] };
  let back = 0;
  const arrive = (list) => list.forEach((c) => { const [tx, ty] = SLOT[c.who] ?? [14 + (back++) * 13, 110]; crowd.push(Object.assign(c, { x: 8, y: ty, tx, ty })); });
  // Puhekuplat loppukohtauksen hahmoille: ilman huonetta say() näyttäisi ne kertojan laatikossa.
  const head = (who, dy) => { const c = crowd.find((k) => k.who === who); return c ? { x: c.x, y: c.ty - dy, c: "#fcfcf4" } : null; };
  const endSpk = { jussi: { x: 176, y: 78, c: "#c8a460" }, get kauppias() { return head("mehmet", 40); }, get saarni() { return head("saarni", 40); }, get tuomari() { return head("tuomari", 42); },
    get jalonen() { return head("jalonen", 40); }, get valtonen() { return head("valtonen", 40); }, get jokinen() { return head("jokinen", 40); }, get hyvarinen() { return head("hyvarinen", 38); }, get carlsson() { return head("carlsson", 38); } };
  let flipT = null, kebabOn = false, trophyOn = false, whistleT = null;
  overlay = (t) => {
    mouhoInDraw(t); rinkTV(t); boardTable(t);
    if (kebabOn) { r(184, 92, 36, 10, "#8c5c2c"); r(184, 92, 36, 2, "#c81c1c"); r(192, 76, 4, 16, "#c8a46c"); disc(194, 80, 5, "#9c5c2c", "#6c3c1c"); text3("KEBAB", 188, 95, "#fcf0d8"); }
    if (trophyOn) { r(205, 88, 12, 4, "#5c3c24"); r(207, 75, 8, 13, "#e8c81c"); r(208, 73, 6, 3, "#e8c81c"); r(207, 75, 2, 13, "#fcf06c"); px(209, 79, "#3c2c0c"); px(212, 79, "#3c2c0c"); glow(211, 81, 14, "255,220,100", .35); }
    const ordered = [...crowd].sort((a, b) => a.ty - b.ty);
    for (const c of ordered) { c.x += (c.tx - c.x) * .04; const mv = Math.abs(c.tx - c.x) > 1;
      if (["saarni", "maskotti", "jalonen", "valtonen", "jokinen"].includes(c.who)) person(c.who, c.x, c.ty, t, { moving: mv, sc: .85, talking: speaking === c.who });
      else if (c.who === "mehmet") merchant(c.x, c.ty, t, speaking === "kauppias");
      else if (c.who === "salkkumies") salesman(c.x, c.ty, t);
      else if (c.who === "tuomari") ghostRef(c.x, c.ty, t, speaking === "tuomari");
      else npc(c.v ?? 0, c.x, c.ty, t, { moving: mv, sc: .85 }); }
    shadow(176, 128, 7); jussi(176, 128, -1, 0, {});
    // jäsenhankintakaavio telineessä; Jussi kääntää sen turnauskaavioksi (17.10.: "kaavio rumalta")
    const k2 = flipT ? Math.min(1, (performance.now() - flipT) / 1400) : 0, sy = Math.cos(k2 * Math.PI);
    lineC(112, 128, 120, 92, "#5c4c3c", 2); lineC(140, 128, 132, 92, "#5c4c3c", 2); lineC(126, 128, 126, 96, "#4c3c2c", 2);   // maalarin teline
    g.save(); g.translate(126, 82); g.scale(1, Math.abs(sy) < .02 ? .02 : sy);
    r(-27, -17, 54, 34, "#3c3c44"); r(-26, -16, 52, 32, "#f8f6ee"); r(-26, -16, 52, 1, "#ffffff");
    if (k2 < .5) {                                 // pyramidi: Jussi huipulla, rivit tihenevät
      r(-3, -13, 6, 4, "#c81c1c"); for (let j = 1; j < 5; j++) { const n = 2 ** j > 16 ? 16 : 2 ** j, w = Math.min(46, n * 3); for (let i = 0; i < n; i++) r(-w / 2 + i * (w / n) + .5, -11 + j * 5, Math.max(1, w / n - 1), 3, j === 1 ? "#2c4c9c" : j === 2 ? "#4c6cbc" : "#7c9cdc"); }
      for (let j = 0; j < 4; j++) { lineC(0, -9 + j * 5, -4 - j * 5, -6 + j * 5, "#9c9cac"); lineC(0, -9 + j * 5, 4 + j * 5, -6 + j * 5, "#9c9cac"); }
    } else {                                       // turnauskaavio: 8 -> 4 -> 2 -> finaali, pokaali keskellä
      g.scale(1, -1);                              // käännetty takaisin oikein päin
      const C = ["#c81c1c", "#2c4c9c", "#e8c81c", "#2c8c4c", "#7c2c8c", "#e8742c", "#3c3c3c", "#2cacac"];
      for (const side of [-1, 1]) {
        for (let i = 0; i < 4; i++) { const y = -12 + i * 7, x0 = side * 24; r(Math.min(x0, x0 - side * 6), y, 6, 2, C[i + (side > 0 ? 4 : 0)]); lineC(x0 - side * 6, y + 1, x0 - side * 9, y + 1, "#1c1c24"); }
        for (let i = 0; i < 2; i++) { const yA = -11 + i * 14, yB = yA + 7, x = side * 15; lineC(x, yA, x, yB, "#1c1c24"); lineC(x, yA + 3.5, side * 10, yA + 3.5, "#1c1c24"); }
        lineC(side * 10, -7.5, side * 10, 6.5, "#1c1c24"); lineC(side * 10, -.5, side * 5, -.5, "#1c1c24");
      }
      r(-3, -4, 6, 6, "#e8c81c"); r(-2, -7, 4, 3, "#e8c81c"); r(-4, 2, 8, 2, "#8c6c1c"); px(-1, -2, "#3c2c0c"); px(1, -2, "#3c2c0c");
      g.font = "6px VT323, monospace"; g.fillStyle = "#1c1c24"; g.textAlign = "center"; g.fillText("MOUHO 2026", 0, 14); g.textAlign = "left";
    }
    g.restore();
    if (whistleT && performance.now() - whistleT < 900) { g.font = "bold 10px VT323, monospace"; g.fillStyle = "#fcfcfc"; g.fillText("PRIIIT!", 60, 70); }
  };
  callSpk = endSpk;
  await say("Neljäs kerros. Mouhon hallitus istuu pöydän takana.", "muu");
  await say("Hallitus: \"Toiminnanjohtajan haastattelu. Hakija Markkanen, olkaa hyvä.\"", "muu");
  await say("Ennen kuin aloitetaan: haluan esitellä, mitä olen jo tehnyt Mouhon hyväksi.");
  // 3. jäsenet saapuvat ryhmä kerrallaan, kukin oman syynsä kanssa
  beep(140, 120, "square", .05); arrive([{ who: "maskotti" }, { who: "saarni" }]); await sleep(1600);
  await say("Kutsu viisikymppisen reunassa. Sellaista ei unohda. Täällä ollaan, ja maskotti otti pelaajakorttinsa mukaan.", "saarni");
  beep(140, 120, "square", .05); arrive([{ who: "mehmet" }, { who: "salkkumies" }]);
  if (f.bazaar) arrive(Array.from({ length: 6 }, (_, i) => ({ who: "basaari", v: i })));
  await sleep(1800);
  await say("Mouho Global Partners saapuu! Ja koko basaari. Kebabit lämpiminä, ystäväni!", "muu");
  if (f.refRecruited) { beep(2200, 160, "square", .04); arrive([{ who: "tuomari" }]); await sleep(1500); await say("Haamutuomari leijuu sisään.", "muu"); await say("Pilli on mukana.", "tuomari"); }
  // vapaat valmentajat (23.10.), kukin omalla tavallaan
  if (f.jalonenIn) { beep(140, 120, "square", .05); arrive([{ who: "jalonen" }]); await sleep(1400); await say("Mukana.", "jalonen"); }
  if (f.valtonenIn) { beep(140, 120, "square", .05); arrive([{ who: "valtonen" }]); await sleep(1400); await say("Pojat. ...Ja hallitus.", "valtonen"); }
  if (f.jokinenIn) { beep(140, 120, "square", .05); arrive([{ who: "jokinen" }, { who: "hyvarinen", v: 8 }, { who: "carlsson", v: 9 }]); await sleep(1800);
    await say("Me ollaan...", "jokinen"); await say("...täällä...", "hyvarinen"); await say("...kaikki!", "carlsson"); }
  await say(`Huoneessa on nyt ${f.recruits ?? 0} jäsentä. Ja kaikki katsovat Jussia.`, "muu");
  // 4. pyramidin lupaus lunastetaan
  await say("\"No, toiminnanjohtaja? Jokainen meistä toi kaksi uutta. Mitä me saamme?\"", "muu");
  await say("Te saatte... tuota... saatte...");
  await say("Hetkinen. Soitan Jouko Myrrälle.");
  f.myrra3 = true; await phoneCall(MYRRA_CALLS[3]); callSpk = endSpk;
  await say("Anna ihmisten pelata... Ja jos pyramidin kääntää ylösalaisin...");
  flipT = performance.now(); beep(330, 200, "triangle", .06); setTimeout(() => beep(523, 300, "triangle", .06), 260); await sleep(1600);
  await say("Ylösalaisin käännetty pyramidi on TURNAUSKAAVIO.", "muu");
  await say("Te saatte PELATA! 2v2, NHL, PS5. Jokainen jäsen on pelaaja. Kaikki mukaan!");
  if (f.jalonenIn || f.valtonenIn || f.jokinenIn) { await say("Ja ensimmäistä kertaa pitkään aikaan valmentajat eivät valmenna. He pelaavat.", "muu");
    if (f.jalonenIn) await say("Hyvä peli.", "jalonen"); if (f.jokinenIn) await say("Vielä yksi erä!", "jokinen"); }
  if (f.refRecruited) { whistleT = performance.now(); beep(2200, 300, "square", .05); await say("Ensimmäinen erä alkaa!", "tuomari"); }
  kebabOn = true; beep(523, 150, "triangle", .05);
  await say("Tarjoilu: Mouho Global Partnersin kebabit.");
  trophyOn = true; beep(784, 200, "triangle", .05);
  await say("Ja voittaja saa kiertopalkinnoksi kultaisen idolin. Suoraan Kappadokiasta.");
  await say("Ottelut alkavat. Kukaan ei enää kysy, mitä saa. Kaikki pelaavat.", "muu");
  // 5. haastattelu: hallituksen kysymykset ja valmentajien opit (taululiitukaksintaistelu)
  await boardInterview(f);
  // 6. brändi
  await say("Hallitus: \"Markkanen. Jäsenten hankinta, tarjoilu, turnaus. Kaikki ennen haastattelua.\"", "muu");
  await say("Ja kansainvälinen kumppanuus: tässä sopimus Mouho Global Partnersin kanssa. Allekirjoitettu Istanbulissa.");
  await say("Hallitus: \"Mutta tässä sopimuksessa lukee, että myit Mouho-brändin turkkilaisille.\"", "muu");
  await say("...Ensimmäinen sivu oli liimautunut kiinni.");
  await say("Hallitus: \"Brändiä ei voi myydä, jos se ei ole sinun. Et ole vielä edes toiminnanjohtaja.\"", "muu");
  await say("Myit brändin, jota et omistanut? ...Ystäväni, sinä olet oikea basaarin mies!", "kauppias");
  await say("Pidä brändisi. Meille riittää tämä ilta ja hyvä tarina. Ja kebabien jälkikäteen maksu? Mouho on ilmainen. Sinähän sen minulle kerroit.", "kauppias");
  await say("Hallitus: \"Ennätysmäärä jäseniä, tarjoilu, kiertopalkinto ja kansainvälinen kumppani, joka ei peri mitään. Olet palkattu, toiminnanjohtaja.\"", "muu");
  await say("Juuri kuten suunnittelin. Tai melkein.");
  [880, 1040, 880, 1040].forEach((fq, n) => setTimeout(() => beep(fq, 70, "square", .04), n * 75)); await sleep(600);
  await say("Puhelin soi. Liigan toimisto.", "muu");
  await say(`Liiga: "Markkanen? Mouho-illan uutinen kiertää jo: turkkilaiset sijoittajat, ${f.recruits ?? 0} jäsentä ja haamutuomari. Miten sait turkkilaiset kiinnostumaan jääkiekosta?"`, "muu");
  await say("Pidin sen yksinkertaisena.");
  await say(`Mouho-IQ: ${iqTotal()} / ${IQ_MAX}. ${iqTotal() >= IQ_MAX ? "Täydet pisteet. Mouhoness saavutettu." : "Löytyikö kaikki? Kokeile uudestaan."}`, "muu");
  callSpk = null;
  $say.innerHTML = '<div class="line" style="left:50%;bottom:76%;color:#fcfc54">MOUHO 2027 · ilmoittaudu alta<br>Kaivokatu 10, 4. krs, Helsinki</div>';
  $game.classList.remove("cut");
  $dlg.replaceChildren(Object.assign(document.createElement("button"), { textContent: "Pelaa uudestaan", onclick: () => location.reload() }));
  $game.classList.add("talking");
  await sleep(1200); mouho2027Form();
}

// Haastattelu Monkey Islandin miekkailun tapaan (23.10.): hallitus kysyy bisnesjargonilla, ja
// oikea vastaus on valmentajan oppi. Väärä vastaus kysytään uudestaan; jos oppi jäi saamatta,
// Jussi improvisoi ("Tuota..."), ja hallitus hyväksyy sen nihkeästi ilman pisteitä.
const INTERVIEW = [
  { q: "Hallitus: \"Visio, Markkanen. Kuinka pitkä on strategiadokumenttinne?\"", flag: "lyhyesti", ok: "Lyhyesti virsi kaunis.", iq: "v_lyhyesti",
    meh: "Tuota... se on vielä luonnos.", no: ["Neljäkymmentä kalvoa ja liite.", "Pyramidin muotoinen."], yes: "Hallitus: \"...Kolme sanaa. Hyväksytään.\"" },
  { q: "Hallitus: \"Mouhon huipulla on hallitus. Mihin te tarvitsette jäseniä?\"", flag: "pohja", ok: "Ilman pohjaa huippu on pelkkä piste.", iq: "v_pohja",
    meh: "Tuota... jäseniä on mukava olla.", no: ["Jotta minä pääsen huipulle.", "Kebabin takia."], yes: "Hallitus nyökkää. Yksi hallituksen jäsen kirjoittaa sen muistiin." },
  { q: "Hallitus: \"Mouho on ilmainen. Miten saatte jäsenet sitoutumaan, kun kukaan ei saa mitään?\"", flag: "energia", ok: "Energia tarttuu.", iq: "v_energia",
    meh: "Tuota... tarjoilulla?", no: ["Jokainen tuo kaksi uutta.", "Lupaamalla heille jotain."], yes: "Huoneen takaa kuuluu: \"Totta!\" Jokinen hyppää ilmaan." },
];
async function boardInterview(f) {
  await say("Hallitus: \"Sitten varsinainen haastattelu. Kolme kysymystä.\"", "muu");
  for (const Q of INTERVIEW) {
    await say(Q.q, "muu");
    while (true) {
      const right = f[Q.flag] ? Q.ok : Q.meh, opts = [Q.no[0], right, Q.no[1]];
      const pick = opts[await choose(opts)]; await say(pick);
      if (pick === Q.ok) { beep(523, 140, "triangle", .05); iq(Q.iq, 3); await say(Q.yes, "muu"); break; }
      if (pick === Q.meh) { await say("Hallitus: \"...Hmm. Seuraava kysymys.\"", "muu"); break; }
      await say("Hallitus katsoo toisiaan. Joku köhäisee.", "muu"); await say("Hallitus: \"Yritetäänkö uudestaan?\"", "muu");
    }
  }
}

// ---------------------------------------------------------------- Mouho 2027 -ilmoittautuminen
// Pelin palkinto (käyttäjä 17.10.): läpipeluun jälkeen avautuu lomake, jolla ilmoittaudutaan
// oikeaan Mouho 2027 -turnaukseen. Lähetys sovelluksen reitille /api/mouho/ilmoittaudu.
function mouho2027Form() {
  const box = document.createElement("form"); box.id = "mouho2027";
  box.innerHTML = `
    <h2>Mouho 2027</h2>
    <p>Toiminnanjohtaja Markkanen kutsuu sinut: 2v2 NHL, PS5. Ilmainen, kuten aina.</p>
    <label>Nimi <input name="nimi" required minlength="2" maxlength="80" autocomplete="off" data-1p-ignore data-lpignore="true"></label>
    <label>Sähköposti <input name="email" type="email" required maxlength="120" autocomplete="off" data-1p-ignore data-lpignore="true"></label>
    <label>Pelikaveri (2v2, valinnainen) <input name="pari" maxlength="80" autocomplete="off" data-1p-ignore data-lpignore="true"></label>
    <label>PSN-nimi (valinnainen) <input name="psn" maxlength="40" autocomplete="off" data-1p-ignore data-lpignore="true"></label>
    <small>Päivä ja paikka ilmoitetaan sähköpostilla. Tietoja käytetään vain Mouho 2027 -ilmoittautumiseen.</small>
    <div class="row"><button type="submit">Ilmoittaudu</button><button type="button" data-close>Ei nyt</button></div>
    <p class="msg" role="status"></p>`;
  const msg = box.querySelector(".msg");
  box.querySelector("[data-close]").onclick = () => box.remove();
  box.onsubmit = async (e) => {
    e.preventDefault(); const d = Object.fromEntries(new FormData(box)); d.iq = `${iqTotal()}/${IQ_MAX}`;
    msg.textContent = "Lähetetään..."; box.querySelector("[type=submit]").disabled = true;
    try {
      const res = await fetch("/api/mouho/ilmoittaudu", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(d) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      box.innerHTML = `<h2>Nähdään Mouhossa!</h2><p>${d.nimi.replace(/[<>&]/g, "")}, ilmoittautumisesi Mouho 2027:ään on vastaanotettu.</p><div class="row"><button type="button">Sulje</button></div>`;
      box.querySelector("button").onclick = () => box.remove(); beep(523, 150, "triangle", .05); setTimeout(() => beep(784, 250, "triangle", .05), 160);
    } catch (err) { msg.textContent = `Ilmoittautuminen ei onnistunut: ${err.message}`; box.querySelector("[type=submit]").disabled = false; }
  };
  document.getElementById("stage").append(box);   // ei automaattista fokusta: salasanaohjelma avautui kentän päälle
}
