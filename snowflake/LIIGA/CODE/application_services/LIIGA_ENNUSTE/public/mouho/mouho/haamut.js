// Mouhon salaisuus -- Hologrammit ja haamut (erotuomari, ilves, pokaali).
"use strict";
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
function ghostRef(x, y, t, talking = false) {   // sivuhahmotyyli 2 (npc 10), läpikuultava ja leijuva
  const fl = Math.round(Math.sin(t / 400) * 1.5);
  glow(x, y - 22 + fl, 30, "170,220,255", .22);
  const c = (ghostRef.c ??= document.createElement("canvas")); c.width = 48; c.height = 64;                   // hahmo ensin apukankaalle,
  const prev = g; g = c.getContext("2d"); g.imageSmoothingEnabled = false; npc(10, 24, 62, t, { talking });      // sitten sinertäväksi
  g.globalCompositeOperation = "source-atop"; g.fillStyle = "rgba(140,200,255,.38)"; g.fillRect(0, 0, 48, 64); g = prev;
  g.save(); g.globalAlpha = .66 + .14 * Math.sin(t / 300); g.drawImage(c, Math.round(x) - 24, Math.round(y) - 64 + fl); g.restore();
  r(x - 1, y - 20 + fl, 2, 2, "#d8e0ec"); px(x - 2, y - 21 + fl, "#a8b8cc");                                // pilli
  for (let i = -7; i <= 7; i++) if (bay(x + i, y + Math.round(t / 160)) < .45) px(x + i, y - 1 + fl, "rgba(170,220,255,.55)");   // jalat haihtuvat usvaksi
}
