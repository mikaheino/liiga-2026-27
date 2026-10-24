// Mouhon salaisuus -- Moottori: piirtoapurit (pikselit, liukuvärit, ditheröinti, taustat, parallaksi, teksti).
"use strict";
// ---------------------------------------------------------------- piirtäminen
// VGA-henki: 320 x 136, liukuvärit Bayer-ditheröintinä eikä sileinä. Staattiset
// taustat piirretään kerran välimuistiin (bgCache), joka ruudussa vain liike.
const r = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x | 0, y | 0, w | 0, h | 0); };
const px = (x, y, c) => r(x, y, 1, 1, c);
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const bay = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];
function dither(x, y, w, h, a, b, t = 0.5) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(x + i, y + j, bay(x + i, y + j) < t ? b : a); }
// Pystysuora liukuväri väripaletin läpi, ditheröity siirtymä jokaisen värin välissä.
function vgrad(x, y, w, h, cols) {
  for (let j = 0; j < h; j++) {
    const f = (j / Math.max(h - 1, 1)) * (cols.length - 1), k = Math.min(Math.floor(f), cols.length - 2), t = f - k;
    for (let i = 0; i < w; i++) px(x + i, y + j, bay(x + i, y + j) < t ? cols[k + 1] : cols[k]);
  }
}
let seed = 1; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
function noise(x, y, w, h, base, cols, p) { r(x, y, w, h, base); for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (rnd() < p) px(x + i, y + j, cols[(rnd() * cols.length) | 0]); }
function disc(cx, cy, rad, c, edge) { for (let j = -rad; j <= rad; j++) for (let i = -rad; i <= rad; i++) { const d = i * i + j * j; if (d <= rad * rad) px(cx + i, cy + j, edge && d > (rad - 1) * (rad - 1) ? edge : c); } }
function tri(x, y, w, h, c) { for (let j = 0; j < h; j++) { const ww = Math.round(w * (j + 1) / h); r(x + (w - ww) / 2, y + j, ww, 1, c); } }
function shadow(x, y, w) { g.fillStyle = "rgba(0,0,0,.35)"; g.beginPath(); g.ellipse(x, y, w, 2, 0, 0, 7); g.fill(); }
function glow(x, y, rad, rgb, a) { const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(1, `rgba(${rgb},0)`); g.globalCompositeOperation = "lighter"; g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); g.globalCompositeOperation = "source-over"; }
const bgCache = {};
// Parallaksi Castlevanian tapaan (23.10.): kerrokset liikkuvat kameran mukana eri nopeuksilla.
// f = 0 taivas pysyy paikallaan, f = 1 kulkee maailman mukana, f > 1 etualan siluetit ohittavat
// nopeammin. Kerroksen kiinteä osa (paint(w)) piirretään kerran omalle kankaalleen, jonka leveys
// on se osuus, joka kerroksesta koko matkalla näkyy; anim(t, w) piirtää liikkuvat osat samaan siirtoon.
const layerCache = {};
function paintLayer(name, w, fn) { if (layerCache[name]) return layerCache[name]; const c = document.createElement("canvas"); c.width = w; c.height = H; const prev = g; g = c.getContext("2d"); seed = 7; fn(w); g = prev; return (layerCache[name] = c); }
function parallax(layers, cam, t, worldW = W) {
  for (const L of layers) {
    const w = W + Math.ceil((worldW - W) * L.f); g.save(); g.translate(-Math.round(cam * L.f), 0);
    if (L.paint) g.drawImage(paintLayer(L.name, w, L.paint), 0, 0);
    L.anim?.(t, w); g.restore();
  }
}
// Ajelehtiva kerros: kuvio maalataan kerran kahden ruudun levyiseksi ja kierrätetään vaakaan
// nopeudella speed (px/s). Pilvikerrokset eri nopeuksilla antavat syvyyden paikallaankin.
function drift(name, speed, paint, t) { const c = paintLayer(name, W * 2, paint), ox = -Math.round((t / 1000 * speed) % (W * 2)); g.drawImage(c, ox, 0); g.drawImage(c, ox + W * 2, 0); }
// Pallopilvien nauha ajelehtivaan kerrokseen: [x, y, leveys] annetulla värillä, toistettuna
// ruudun välein, jotta kahden ruudun kierto on saumaton.
function puffBand(clouds, c, hi) { for (const [x0, y, w] of clouds) for (const x of [x0, x0 + W]) { const n = Math.max(2, Math.round(w / 9));
  for (let k = 0; k < n; k++) { const rad = Math.round(4 + 4 * Math.abs(Math.sin(k * 1.7 + x0))), cy = y + 8 - rad * .6 + (k % 2) * 2;
    disc(Math.round(x + w * (k + .5) / n), Math.round(cy), rad, c); if (hi) px(Math.round(x + w * (k + .5) / n - rad * .4), Math.round(cy - rad * .7), hi); } } }
// Kamera seuraa kulkijaa: lead = kulkijan paikka ruudulla (0..1), reunoilla kamera pysähtyy.
const camFollow = (x, worldW, lead = .4) => Math.max(0, Math.min(worldW - W, Math.round(x - W * lead)));
function paintBg(name, fn) { if (bgCache[name]) return bgCache[name]; const c = document.createElement("canvas"); c.width = W; c.height = H; const prev = g; g = c.getContext("2d"); seed = 7; fn(); g = prev; return (bgCache[name] = c); }
function starfield(n, maxY, s0) { seed = s0; const out = []; for (let i = 0; i < n; i++) out.push([(rnd() * W) | 0, (rnd() * maxY) | 0, rnd()]); return out; }
// Mouhon salaisuus -- kolme ruutua perspektiivissä (16.10.: "graafiikkamoottorista
// puuttuu syvyys"). Fate of Atlantiksen tapaan lattia ulottuu syvälle kuvaan:
// horisontti on ylhäällä, kohteet ovat eri etäisyyksillä ja hahmot skaalautuvat
// (game.js: scale). Staattinen osa piirretään kerran välimuistiin (paintBg),
// tilasta riippuvat esineet ovat syvyysjärjestettyjä propseja game.js:ssä.

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
const ease = (k) => 1 - Math.pow(1 - Math.max(0, Math.min(1, k)), 3);
