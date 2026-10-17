// Mouhon salaisuus -- bobblehead-päät (17.10.: "henkilöhahmojen päät tarkempia, niistä
// pitää tunnistaa henkilö... bobble head -tyylillä mutta pikseligrafiikkaa").
//
// Jokainen kasvo on kuvaus muodoista 100 x 120 -koordinaatistossa (pää, tukka, parta,
// silmät, lasit, suu). Se piirretään 4x ylinäytteistettynä ja pikselöidään hahmon omaan
// palettiin: jokainen kohdepikseli saa lohkonsa painotetuimman värin, jolloin silmät, suu
// ja kulmat (paino > 1) säilyvät pienessäkin päässä. Lopuksi tumma ääriviiva. Samasta
// kuvauksesta syntyy pelihahmon pää (WORLD) ja puhelujen muotokuva (PORTRAIT).
// Vertailukuvat olivat vain mallina; mitään valokuvaa ei ole tässä tiedostossa.
"use strict";

const FACE_W = 100, FACE_H = 120, SS = 4;
const HEAD = { world: [20, 25], portrait: [60, 75] };

// Muodot: e = ellipsi [cx, cy, rx, ry], p = monikulmio, l = viiva [pisteet], s = ellipsin kaari
// (lasit). d = ditheröity toinen väri (sparse: 25 % eikä 50 %). on: "talk" | "still" | "blink" | "open" rajaa muodon variaatioon.
const SKIN = { skin: "#f0bc94", skinL: "#fcd8b4", skinD: "#d08c68", skinDD: "#a86448", blush: "#e89c84", lip: "#b05a48", teeth: "#fcf8ec", mouth: "#4c1410" };

const FACES = {
  // Jussi Markkanen: vaalea, taakse harjattu tukka, ohimoilta väistyvä hiusraja ja korkea otsa,
  // pyöreät täyteläiset kasvot, pienet siniset silmät, suora nenä, hillitty hymy hampaineen.
  // Jussi Markkanen, karikatyyri (17.10.: "enemmän karikatyyrin puolelle, Jussi liian vakava"):
  // hyväntahtoinen innokas hölmö. Iso leuka ja virne hampaineen, isot pyöreät siniset silmät,
  // korkealle nousseet kulmat, ulkonevat korvat, korkea vaalea kiehkura, väistyvät ohimot.
  jussi: {
    outline: "#3c2414",
    pal: { ...SKIN, hair: "#dcbc68", hairL: "#f8e4a4", hairD: "#a8823c", white: "#fcfcfc", iris: "#3c80d0", pupil: "#14243c", brow: "#b08a44", tongue: "#d0606c" },
    weight: { iris: 4, pupil: 6, white: 3, brow: 3, lip: 3, mouth: 4, teeth: 3.5, skinDD: 2.4, hairD: 1.3, tongue: 2 },
    shapes: [
      { e: [5, 62, 9, 13], c: "skin" }, { e: [95, 62, 9, 13], c: "skinD" }, { e: [6, 63, 4, 7], c: "skinD" }, { e: [94, 63, 4, 7], c: "skinDD" },
      { e: [50, 52, 37, 42], c: "skin" },
      { p: [[8, 60], [92, 60], [93, 86], [82, 104], [62, 115], [38, 115], [18, 104], [7, 86]], c: "skin" },
      { p: [[70, 30], [90, 56], [93, 86], [82, 104], [64, 114], [76, 90], [80, 62]], c: "skin", d: "skinD", sparse: true },
      { p: [[80, 46], [92, 62], [93, 86], [82, 104], [72, 110], [84, 86], [86, 64]], c: "skinD" },
      { e: [22, 80, 9, 6], c: "skin", d: "blush" }, { e: [78, 80, 9, 6], c: "skinD", d: "blush" },
      { e: [40, 26, 14, 5], c: "skin", d: "skinL" }, { e: [50, 108, 9, 4], c: "skin", d: "skinL", sparse: true },
      // tukka: korkea kiehkura eteen ja oikealle, väistyvät ohimot
      { p: [[13, 46], [12, 30], [20, 14], [34, 2], [52, -6], [72, -4], [88, 8], [92, 28], [90, 44], [85, 34], [76, 26], [62, 21], [48, 20], [36, 22], [26, 28], [18, 36], [17, 48]], c: "hair" },
      { p: [[36, 12], [52, -12], [80, -14], [96, -2], [84, 6], [66, 2], [52, 8]], c: "hair" },
      { l: [[40, 10], [56, -6], [82, -8]], c: "hairL", w: 3.2 }, { l: [[26, 20], [44, 6]], c: "hairL", w: 2.4 },
      { l: [[56, 18], [80, 14], [90, 28]], c: "hairD", w: 2 }, { l: [[18, 30], [24, 16]], c: "hairD", w: 2 }, { l: [[60, 4], [88, 2]], c: "hairD", w: 1.8 },
      { l: [[22, 40], [33, 33], [44, 37]], c: "brow", w: 3.5 }, { l: [[56, 37], [67, 33], [78, 40]], c: "brow", w: 3.5 },
      { e: [34, 52, 9, 7], c: "white", on: "open" }, { e: [66, 52, 9, 7], c: "white", on: "open" },
      { e: [36, 53, 5, 5], c: "iris", on: "open" }, { e: [64, 53, 5, 5], c: "iris", on: "open" },
      { e: [36.5, 53.5, 2.4, 2.4], c: "pupil", on: "open" }, { e: [63.5, 53.5, 2.4, 2.4], c: "pupil", on: "open" },
      { e: [34.5, 51, 1.4, 1.4], c: "white", on: "open" }, { e: [62, 51, 1.4, 1.4], c: "white", on: "open" },
      { l: [[25, 53], [43, 53]], c: "skinDD", w: 2.6, on: "blink" }, { l: [[57, 53], [75, 53]], c: "skinDD", w: 2.6, on: "blink" },
      { e: [52, 71, 7, 6], c: "skin" }, { p: [[56, 66], [59, 72], [55, 77], [52, 76]], c: "skinD" }, { e: [50, 69, 2, 2], c: "skinL" },
      { e: [47, 76, 2.4, 1.4], c: "skinDD" }, { e: [56, 76, 2.4, 1.4], c: "skinDD" },
      // valtava virne hampaineen (aina), puhuessa suu aukeaa lisää
      { p: [[24, 83], [37, 87], [50, 88], [63, 87], [76, 83], [72, 94], [62, 101], [50, 104], [38, 101], [28, 94]], c: "mouth", on: "still" },
      { p: [[27, 84], [73, 84], [70, 90], [50, 92], [30, 90]], c: "teeth", on: "still" }, { e: [50, 99, 9, 3], c: "tongue", on: "still" },
      { p: [[24, 82], [37, 86], [50, 87], [63, 86], [76, 82], [72, 98], [62, 107], [50, 110], [38, 107], [28, 98]], c: "mouth", on: "talk" },
      { p: [[27, 83], [73, 83], [70, 89], [50, 91], [30, 89]], c: "teeth", on: "talk" }, { e: [50, 104, 10, 4], c: "tongue", on: "talk" },
      { l: [[19, 78], [23, 90]], c: "skinD", w: 2 }, { l: [[81, 78], [77, 90]], c: "skinD", w: 2 },
      { l: [[50, 109], [50, 113]], c: "skinD", w: 1.6 },
    ],
    // takaa (kävelee poispäin): niska, korvat ja tukka
    back: [
      { e: [5, 62, 9, 13], c: "skinD" }, { e: [95, 62, 9, 13], c: "skinD" },
      { e: [50, 56, 40, 46], c: "skin" }, { p: [[24, 90], [76, 90], [70, 112], [30, 112]], c: "skinD" },
      { e: [50, 46, 42, 46], c: "hair" }, { p: [[12, 56], [88, 56], [82, 90], [18, 90]], c: "hair" }, { p: [[36, 8], [56, -12], [82, -12], [92, 0]], c: "hair" },
      { l: [[26, 26], [50, 12], [76, 20]], c: "hairL", w: 3 }, { l: [[20, 54], [50, 44], [82, 54]], c: "hairD", w: 2 }, { l: [[28, 80], [72, 80]], c: "hairD", w: 2 },
    ],
  },
  // Jouko Myrrä, karikatyyri: korkea kalju kupoli joka kiiltää, lyhyt suolapippuriparta ja viikset, pyöreät tummat
  // silmälasit, isot korvat, syvällä olevat silmät, leveä hymy hampaineen.
  myrra: {
    outline: "#2c1c14",
    pal: { ...SKIN, skin: "#e8b08c", skinL: "#fcd8bc", skinD: "#c48464", shine: "#fff0e0", beard: "#9c9690", beardL: "#d0ccc4", beardD: "#5c5650", frame: "#3c2418", white: "#fcfcfc", iris: "#4c6c9c", brow: "#6c625c" },
    weight: { iris: 5, white: 3, frame: 4, brow: 3, mouth: 4, teeth: 4, beardD: 1.6, skinDD: 2 },
    shapes: [
      { e: [7, 62, 10, 15], c: "skin" }, { e: [93, 62, 10, 15], c: "skinD" }, { e: [8, 63, 4.5, 8], c: "skinD" }, { e: [92, 63, 4.5, 8], c: "skinDD" },
      { e: [50, 48, 39, 52], c: "skin" },
      { p: [[14, 60], [86, 60], [82, 86], [66, 102], [50, 106], [34, 102], [18, 86]], c: "skin" },
      { p: [[62, 18], [87, 50], [84, 84], [66, 100], [62, 96], [74, 74], [72, 40]], c: "skin", d: "skinD", sparse: true },
      { p: [[72, 30], [88, 54], [84, 84], [70, 98], [66, 94], [78, 72], [80, 48]], c: "skinD" },
      { e: [40, 14, 16, 9], c: "skin", d: "skinL" }, { e: [35, 10, 8, 4], c: "shine" }, { e: [48, 8, 2, 1.5], c: "shine" },
      { l: [[24, 50], [44, 48]], c: "skinD", w: 3 }, { l: [[56, 48], [76, 50]], c: "skinD", w: 3 },          // syvät silmäkuopat
      { p: [[16, 62], [24, 62], [28, 78], [38, 88], [50, 90], [62, 88], [72, 78], [76, 62], [84, 62], [82, 84], [68, 102], [50, 108], [32, 102], [18, 84]], c: "beard", d: "beardL" },
      { p: [[22, 80], [30, 92], [40, 100], [32, 102], [20, 88]], c: "beard" }, { p: [[78, 80], [70, 92], [60, 100], [68, 102], [80, 88]], c: "beardD", d: "beard" },
      { p: [[34, 80], [50, 76], [66, 80], [64, 85], [50, 83], [36, 85]], c: "beardD" },
      { l: [[24, 45], [34, 43], [42, 45]], c: "brow", w: 3.5 }, { l: [[58, 45], [66, 43], [76, 45]], c: "brow", w: 3.5 },
      { e: [34, 55, 6, 3.2], c: "white", on: "open" }, { e: [66, 55, 6, 3.2], c: "white", on: "open" },
      { e: [35, 55, 3, 3], c: "iris", on: "open" }, { e: [65, 55, 3, 3], c: "iris", on: "open" },
      { l: [[28, 55], [40, 55]], c: "skinDD", w: 2.4, on: "blink" }, { l: [[60, 55], [72, 55]], c: "skinDD", w: 2.4, on: "blink" },
      { s: [32, 55, 13, 11], c: "frame", w: 3 }, { s: [68, 55, 13, 11], c: "frame", w: 3 }, { l: [[44, 54], [56, 54]], c: "frame", w: 2.2 },
      { l: [[22, 53], [12, 56]], c: "frame", w: 2 }, { l: [[78, 53], [88, 56]], c: "frame", w: 2 },
      { p: [[52, 59], [57, 74], [51, 77]], c: "skinD" }, { l: [[49, 61], [48, 71]], c: "skinL", w: 2.2 }, { e: [46, 76, 2.6, 1.6], c: "skinDD" }, { e: [55, 76, 2.6, 1.6], c: "skinDD" },
      { p: [[32, 83], [68, 83], [62, 94], [50, 97], [38, 94]], c: "mouth", on: "still" }, { p: [[33, 83], [67, 83], [65, 88], [35, 88]], c: "teeth", on: "still" },
      { p: [[31, 82], [69, 82], [63, 99], [50, 103], [37, 99]], c: "mouth", on: "talk" }, { p: [[32, 82], [68, 82], [66, 88], [34, 88]], c: "teeth", on: "talk" },
    ],
  },
  // Mikko Saarni, karikatyyri: korkea kiiltävä pompadour, harmaat ohimot raitoina, valtava
  // kulmikas leuka ja sänki, V-kulmat, viekas sivusilmäys, vino virne -- pelaajakauppojen mies.
  saarni: {
    outline: "#1c1410",
    pal: { ...SKIN, skin: "#dca482", skinL: "#f0c4a4", skinD: "#b47c5c", stubble: "#9c7c64", hair: "#2c2420", hairL: "#6c625c", hairG: "#b4aca8", white: "#f4f4f0", iris: "#5c4c3c", pupil: "#1c140c", brow: "#2c2420" },
    weight: { iris: 4, pupil: 5, white: 3, brow: 3, lip: 3, mouth: 4, teeth: 3, skinDD: 2.4 },
    shapes: [
      { e: [11, 64, 6, 10], c: "skin" }, { e: [89, 64, 6, 10], c: "skinD" },
      { e: [50, 56, 36, 42], c: "skin" },
      { p: [[11, 58], [89, 58], [91, 88], [84, 106], [62, 114], [38, 114], [16, 106], [9, 88]], c: "skin" },
      { p: [[14, 84], [20, 104], [38, 112], [62, 112], [80, 104], [86, 84], [76, 96], [60, 104], [40, 104], [24, 96]], c: "skin", d: "stubble" },
      { p: [[68, 34], [88, 58], [91, 88], [84, 106], [66, 112], [76, 88], [76, 60]], c: "skin", d: "skinD", sparse: true },
      { p: [[78, 46], [89, 60], [91, 88], [84, 106], [74, 110], [84, 86], [84, 62]], c: "skinD" },
      // korkea kiiltävä pompadour, harmaat ohimot raitoina
      { p: [[16, 44], [14, 24], [22, 6], [38, -10], [60, -14], [78, -8], [88, 8], [88, 28], [84, 44], [80, 32], [70, 28], [56, 28], [42, 28], [30, 30], [22, 36], [20, 46]], c: "hair" },
      { l: [[28, 14], [46, -4], [70, -6]], c: "hairL", w: 3 }, { l: [[34, 24], [56, 10], [80, 10]], c: "hairL", w: 2 }, { l: [[42, -4], [62, -10]], c: "hairL", w: 2 },
      { p: [[14, 30], [22, 30], [22, 54], [15, 52]], c: "hairG", d: "hair", sparse: true }, { p: [[86, 30], [78, 30], [78, 54], [85, 52]], c: "hairG", d: "hair", sparse: true },
      { l: [[22, 47], [42, 53]], c: "brow", w: 5 }, { l: [[58, 53], [78, 47]], c: "brow", w: 5 },
      { e: [33, 58, 7, 2.6], c: "white", on: "open" }, { e: [67, 58, 7, 2.6], c: "white", on: "open" },
      { e: [37, 58, 3, 2.6], c: "iris", on: "open" }, { e: [71, 58, 3, 2.6], c: "iris", on: "open" },
      { e: [38, 58, 1.4, 1.6], c: "pupil", on: "open" }, { e: [72, 58, 1.4, 1.6], c: "pupil", on: "open" },
      { l: [[26, 55], [40, 56]], c: "skinDD", w: 2.6, on: "open" }, { l: [[60, 56], [74, 55]], c: "skinDD", w: 2.6, on: "open" },
      { l: [[26, 58], [40, 58]], c: "skinDD", w: 2.8, on: "blink" }, { l: [[60, 58], [74, 58]], c: "skinDD", w: 2.8, on: "blink" },
      { p: [[52, 58], [57, 78], [51, 81]], c: "skinD" }, { l: [[49, 60], [48, 75]], c: "skinL", w: 2 }, { e: [46, 80, 2.4, 1.5], c: "skinDD" }, { e: [55, 80, 2.4, 1.5], c: "skinDD" },
      { l: [[36, 80], [32, 92]], c: "skinD", w: 1.8 }, { l: [[64, 80], [68, 92]], c: "skinD", w: 1.8 },
      // vino virne: oikea suupieli ylhäällä
      { l: [[36, 94], [52, 94], [66, 88]], c: "lip", w: 3, on: "still" }, { l: [[66, 88], [68, 85]], c: "skinD", w: 1.6, on: "still" },
      { p: [[38, 91], [66, 86], [62, 97], [50, 99], [40, 96]], c: "mouth", on: "talk" }, { p: [[40, 91], [64, 87], [62, 90], [42, 93]], c: "teeth", on: "talk" },
    ],
  },
  // Jokerit-maskotti: puna-keltainen narrinhattu tupsuineen, valkoiset sydämenmuotoiset
  // kasvot, iso musta silmä ja iskusilmä, koukkunenä, leveä musta virne. Ei seuran logoa.
  maskotti: {
    outline: "#1c0c0c", fit: [.06, .05, .88, .9],
    pal: { face: "#fcfcf4", faceD: "#d8d4cc", red: "#d8242c", redD: "#9c1418", yel: "#f8cc24", yelD: "#c8961c", ball: "#f8d040", ink: "#141414" },
    weight: { ink: 5, ball: 2 },
    shapes: [
      // hattu: neljä löysää lieriötä vuorovärein, tupsut kärjissä
      { p: [[24, 44], [6, 34], [-6, 62], [6, 70], [18, 58]], c: "red" }, { p: [[22, 42], [10, 40], [0, 60], [8, 52]], c: "redD" },
      { p: [[24, 40], [16, 4], [44, 12], [50, 32]], c: "yel" }, { p: [[24, 40], [20, 14], [34, 16], [40, 34]], c: "yelD" },
      { p: [[50, 32], [56, 10], [82, 2], [98, 16], [78, 40]], c: "red" }, { p: [[60, 30], [70, 10], [86, 8], [74, 32]], c: "redD" },
      { p: [[78, 40], [100, 32], [106, 62], [92, 68], [84, 52]], c: "yel" }, { p: [[84, 44], [98, 40], [100, 58], [90, 52]], c: "yelD" },
      { e: [-2, 68, 6, 6], c: "ball" }, { e: [16, 4, 6, 6], c: "ball" }, { e: [99, 15, 6, 6], c: "ball" }, { e: [102, 68, 6, 6], c: "ball" },
      // sydänkasvot
      { e: [50, 64, 33, 32], c: "face" }, { p: [[30, 86], [70, 86], [50, 108]], c: "face" },
      { p: [[70, 46], [83, 64], [76, 88], [54, 106], [64, 86], [72, 66]], c: "face", d: "faceD", sparse: true },
      { e: [36, 60, 6, 9], c: "ink" }, { l: [[27, 47], [36, 42], [45, 47]], c: "ink", w: 3 },
      { l: [[56, 62], [71, 58]], c: "ink", w: 5, on: "open" }, { l: [[56, 60], [71, 60]], c: "ink", w: 5, on: "blink" }, { l: [[56, 50], [73, 48]], c: "ink", w: 4 },
      { l: [[50, 47], [50, 69], [43, 75], [49, 80], [57, 78]], c: "ink", w: 3.5 },
      { p: [[24, 82], [38, 86], [50, 87], [62, 85], [78, 78], [72, 93], [60, 101], [46, 102], [33, 96]], c: "ink", on: "still" },
      { p: [[27, 80], [38, 84], [50, 85], [62, 83], [75, 77], [72, 95], [60, 104], [45, 105], [33, 98]], c: "ink", on: "talk" },
    ],
  },
};

// --- piirto ja pikselöinti -------------------------------------------------------
function hex(c) { const n = parseInt(c.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
function shown(s, v) { if (!s.on) return true; if (s.on === "talk") return v.talk; if (s.on === "still") return !v.talk; if (s.on === "blink") return v.blink; if (s.on === "open") return !v.blink; return true; }
function renderFace(name, [w, h], v) {
  const F = FACES[name], hw = w * SS, hh = h * SS;
  const hi = document.createElement("canvas"); hi.width = hw; hi.height = hh;
  const x = hi.getContext("2d"); x.scale(hw / FACE_W, hh / FACE_H);
  // reunus: koordinaatisto 100 x 120, mutta muodot saavat ylittää sen hieman (hatut)
  const [fx, fy, fw, fh] = F.fit ?? [.06, .13, .88, .84]; x.translate(FACE_W * fx, FACE_H * fy); x.scale(fw, fh);
  x.lineCap = "round"; x.lineJoin = "round";
  for (const s of (v.back && F.back) || F.shapes) {
    if (!shown(s, v)) continue; const col = F.pal[s.c];
    x.fillStyle = col; x.strokeStyle = col; x.lineWidth = s.w ?? 2; x.beginPath();
    if (s.d) {        // ditheröity täyttö: shakkiruutu c/d kohderesoluution pikseleissä
      const pc = document.createElement("canvas"); pc.width = pc.height = 2 * SS; const pg = pc.getContext("2d");
      pg.fillStyle = col; pg.fillRect(0, 0, 2 * SS, 2 * SS); pg.fillStyle = F.pal[s.d]; pg.fillRect(0, 0, SS, SS); if (!s.sparse) pg.fillRect(SS, SS, SS, SS);
      const pat = x.createPattern(pc, "repeat"); pat.setTransform(x.getTransform().inverse()); x.fillStyle = pat;
    }
    if (s.e) { x.ellipse(s.e[0], s.e[1], s.e[2], s.e[3], 0, 0, 7); x.fill(); }
    else if (s.p) { s.p.forEach(([a, b], k) => (k ? x.lineTo(a, b) : x.moveTo(a, b))); x.closePath(); x.fill(); }
    else if (s.l) { s.l.forEach(([a, b], k) => (k ? x.lineTo(a, b) : x.moveTo(a, b))); x.stroke(); }
    else if (s.s) { x.ellipse(s.s[0], s.s[1], s.s[2], s.s[3], 0, 0, 7); x.stroke(); }
  }
  // pikselöinti: lohkon painotetuin palettiväri, peitto < 50 % = läpinäkyvä
  const src = x.getImageData(0, 0, hw, hh).data, keys = Object.keys(F.pal), cols = keys.map((k) => hex(F.pal[k]));
  const out = document.createElement("canvas"); out.width = w + 2; out.height = h + 2;
  const o = out.getContext("2d"), img = o.createImageData(w + 2, h + 2), d = img.data, solid = new Uint8Array((w + 2) * (h + 2));
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const votes = new Float32Array(keys.length); let cover = 0;
    for (let b = 0; b < SS; b++) for (let a = 0; a < SS; a++) {
      const p = ((j * SS + b) * hw + i * SS + a) * 4; if (src[p + 3] < 128) continue; cover++;
      let best = 0, bd = 1e9; for (let k = 0; k < cols.length; k++) { const [r0, g0, b0] = cols[k], dd = (src[p] - r0) ** 2 + (src[p + 1] - g0) ** 2 + (src[p + 2] - b0) ** 2; if (dd < bd) { bd = dd; best = k; } }
      votes[best] += F.weight?.[keys[best]] ?? 1;
    }
    if (cover * 2 < SS * SS) continue;
    let k = 0; for (let n = 1; n < votes.length; n++) if (votes[n] > votes[k]) k = n;
    const q = ((j + 1) * (w + 2) + i + 1); solid[q] = 1; const [r0, g0, b0] = cols[k]; d.set([r0, g0, b0, 255], q * 4);
  }
  // ääriviiva: läpinäkyvä pikseli kiinteän vieressä
  const [orr, og, ob] = hex(F.outline);
  for (let j = 0; j < h + 2; j++) for (let i = 0; i < w + 2; i++) {
    const q = j * (w + 2) + i; if (solid[q]) continue;
    if ((i > 0 && solid[q - 1]) || (i < w + 1 && solid[q + 1]) || (j > 0 && solid[q - w - 2]) || (j < h + 1 && solid[q + w + 2])) d.set([orr, og, ob, 255], q * 4);
  }
  o.putImageData(img, 0, 0); return out;
}
const faceCache = {};
function faceImg(name, size = "world", v = {}) {
  const k = `${name}|${size}|${v.talk ? 1 : 0}${v.blink ? 1 : 0}${v.back ? 1 : 0}`;
  return (faceCache[k] ??= renderFace(name, HEAD[size], v));
}
// Pää kaulan kohtaan (x, y = leuan alareuna). Bobblehead: pää keinuu kävellessä ja
// puhuessa, silmät räpsyvät omaan tahtiinsa. dir < 0 peilaa.
function head(name, x, y, t, { talking = false, moving = false, dir = 1, size = "world", seedv = 0, back = false } = {}) {
  const blink = (t + seedv * 977) % 3900 < 130;
  const talk = talking && Math.floor(t / 110) % 2 === 1;
  const img = faceImg(name, size, back ? { back: true } : { talk, blink });
  const bob = moving ? Math.round(Math.sin(t / 95) * 1) : talking ? Math.round(Math.sin(t / 140) * .6) : 0;
  const sway = moving ? Math.round(Math.sin(t / 190)) : 0;
  g.save(); g.imageSmoothingEnabled = false; g.translate(Math.round(x) + sway, Math.round(y) + bob); if (dir < 0) g.scale(-1, 1);
  g.drawImage(img, -Math.round(img.width / 2), -img.height + 2); g.restore();
}

// --- vartalot -------------------------------------------------------------------
// Pieni vartalo isolle päälle (origo jalkojen keskellä, kaula y = -22). Asut vertailukuvista:
// Saarni navyliivi + vaaleansininen kauluspaita ja salkku, Myrrä musta pikkutakki + valkoinen
// kaulus, maskotti musta pelipaita narrinkauluksella, punaiset shortsit, valkoiset hanskat.
const OUTFITS = {
  saarni: { legs: "#2c2c38", shoe: "#14141a", shirt: "#a8c8e8", shirtD: "#7ca0c8", coat: "#1c2444", coatL: "#2c3864", hand: "#dca482", bag: "#5c3c24" },
  myrra: { legs: "#24242c", shoe: "#14141a", shirt: "#f4f4f4", shirtD: "#1c1c24", coat: "#1c1c22", coatL: "#34343c", hand: "#e8b08c" },
  maskotti: { legs: "#18181c", shoe: "#d8242c", shirt: "#1c1c22", shirtD: "#1c1c22", coat: "#1c1c22", coatL: "#34343c", hand: "#f4f4f4", shorts: "#c81c24", collar: true, headScale: 1.15 },
};
function person(name, x, y, t, { moving = false, dir = 1, talking = false, sc = 1 } = {}) {
  const O = OUTFITS[name], f = moving ? Math.floor(t / 120) % 4 : 0, l1 = f === 1 ? 2 : f === 3 ? -1 : 0, l2 = -l1;
  g.save(); g.translate(Math.round(x), Math.round(y)); g.scale(dir < 0 ? -sc : sc, sc);
  shadow(0, 0, 7);
  r(-4 + l1, -10, 3, 9, O.legs); r(1 + l2, -10, 3, 9, O.legs); r(-5 + l1, -2, 4, 2, O.shoe); r(1 + l2, -2, 4, 2, O.shoe);
  if (O.shorts) { r(-5, -12, 10, 4, O.shorts); r(-5, -12, 10, 1, "#e84c4c"); }
  r(-6, -22, 12, 11, O.shirt); r(-6, -22, 4, 11, O.coat); r(2, -22, 4, 11, O.coat); r(-6, -22, 1, 11, O.coatL);   // takki tai liivi auki edestä
  if (name === "myrra") { r(-2, -22, 4, 3, "#f4f4f4"); r(-1, -19, 2, 8, "#1c1c24"); }
  if (O.collar) { for (const [dx, c] of [[-6, "#d8242c"], [-3, "#f8cc24"], [0, "#d8242c"], [3, "#f8cc24"]]) { r(dx, -22, 3, 2, c); px(dx + 1, -20, c); } }
  const arm = name === "saarni" ? O.shirt : O.coat, sw = moving ? (f % 2 ? 1 : -1) : 0;
  r(-8, -21 + sw, 2, 9, arm); r(6, -21 - sw, 2, 9, arm); r(-8, -12 + sw, 2, 2, O.hand); r(6, -12 - sw, 2, 2, O.hand);
  if (O.bag) { r(5, -11 - sw, 7, 6, O.bag); r(5, -11 - sw, 7, 1, "#7c5c34"); r(7, -12 - sw, 3, 1, "#3c2414"); }
  g.restore();
  // Bobblehead: pää pienenee etäisyyden mukana hitaammin kuin vartalo, jotta kaukanakin tunnistaa.
  const hs = (O.headScale ?? 1) * Math.pow(sc, .6);
  g.save(); g.translate(Math.round(x), Math.round(y - 21 * sc)); g.scale(hs, hs);
  head(name, 0, 0, t, { talking, moving, dir, seedv: name.length }); g.restore();
}
