// Mouhon salaisuus -- Hahmojen kasvo- ja asudata (renderöinti: engine/faces.js).
"use strict";
// Muodot: e = ellipsi [cx, cy, rx, ry], p = monikulmio, l = viiva [pisteet], s = ellipsin kaari
// (lasit). d = ditheröity toinen väri (sparse: 25 % eikä 50 %). on: "talk" | "still" | "blink" | "open" rajaa muodon variaatioon.
const SKIN = { skin: "#f0bc94", skinL: "#fcd8b4", skinD: "#d08c68", skinDD: "#a86448", blush: "#e89c84", lip: "#b05a48", teeth: "#fcf8ec", mouth: "#4c1410" };

const FACES = {
  // Jussi Markkanen: vaalea, taakse harjattu tukka, ohimoilta väistyvä hiusraja ja korkea otsa,
  // pyöreät täyteläiset kasvot, pienet siniset silmät, suora nenä, hillitty hymy hampaineen.
  // Jussi Markkanen, mitoitettu keltapaitaisesta pelaajakuvasta (17.10.: "lähes 1:1"):
  // kuvan päälle piirretystä ruudukosta luetut kohdat tässä koordinaatistossa -- jakaus
  // vasemmalla ja tukka harjattuna oikealle, vaaleat ohuet kulmat, hymyssä siristyvät
  // harmaansiniset silmät (y 48), leveä pyöreäkärkinen nenä (y 68), hymy hampain (x 36-65),
  // korvat näkyvissä, leveä leuka. Kuva oli vain mittapohja; sitä ei ole tässä tiedostossa.
  jussi: {
    outline: "#3c2414",
    pal: { skin: "#eab494", skinL: "#f8d0b4", skinD: "#c88c70", skinDD: "#9c5c48", blush: "#e8a090", lip: "#c0645c", lipL: "#d88080", teeth: "#f8f4ec", mouth: "#5c1c18",
      hair: "#d8b464", hairL: "#f4dc98", hairD: "#9c7838", brow: "#c09858", white: "#f4f4f0", iris: "#6c90b0", pupil: "#1c2830" },
    weight: { iris: 4, pupil: 6, white: 3, brow: 3, lip: 3, lipL: 2.4, teeth: 3.2, mouth: 4, skinDD: 2.6, hairD: 1.3 },
    shapes: [
      { e: [11, 57, 5.5, 14], c: "skin" }, { e: [12, 58, 2.5, 8], c: "skinD" }, { e: [88, 58, 4.5, 13], c: "skinD" }, { e: [88, 59, 2, 7], c: "skinDD" },
      { e: [50, 50, 36, 44], c: "skin" },
      { p: [[14, 56], [86, 56], [85, 72], [80, 93], [66, 103], [50, 107], [34, 103], [20, 93], [15, 72]], c: "skin" },
      { p: [[70, 28], [86, 48], [85, 72], [80, 93], [66, 103], [72, 86], [76, 58]], c: "skin", d: "skinD", sparse: true },
      { p: [[78, 44], [86, 56], [85, 72], [80, 93], [72, 99], [80, 80], [82, 60]], c: "skinD" },
      { e: [28, 30, 9, 5], c: "skin", d: "skinL" }, { e: [27, 62, 7, 5], c: "skin", d: "blush", sparse: true }, { e: [73, 62, 6, 5], c: "skinD", d: "blush", sparse: true },
      { e: [50, 100, 9, 3], c: "skin", d: "skinL", sparse: true }, { l: [[34, 104], [50, 108], [66, 104]], c: "skinD", w: 1.4 },
      { l: [[30, 30], [50, 28], [68, 30]], c: "skinD", w: 1.2 }, { l: [[34, 34], [50, 33], [64, 34]], c: "skinD", w: 1 },     // otsan rypyt
      // tukka: jakaus vasemmalla, harjattu oikealle, ohimot paljaina
      { p: [[10, 46], [9, 30], [13, 16], [24, 4], [38, -3], [50, -6], [64, -4], [78, 4], [87, 16], [90, 30], [87, 46], [83, 32], [78, 24], [68, 15], [50, 11], [32, 16], [22, 27], [16, 40], [14, 48]], c: "hair" },
      { p: [[10, 30], [16, 30], [16, 46], [11, 46]], c: "hair", d: "hairD", sparse: true },
      { l: [[30, 6], [46, -2], [64, 0]], c: "hairL", w: 2.6 }, { l: [[22, 16], [40, 8], [58, 6], [74, 10]], c: "hairL", w: 2 }, { l: [[36, 0], [38, 12]], c: "hairD", w: 1.6 },
      { l: [[40, 13], [56, 9], [72, 14], [82, 24]], c: "hairD", w: 1.8 }, { l: [[14, 34], [18, 22]], c: "hairD", w: 1.8 }, { l: [[84, 30], [86, 42]], c: "hairD", w: 1.8 },
      { l: [[22, 44], [30, 41], [43, 43]], c: "brow", w: 2.6 }, { l: [[60, 43], [72, 41], [82, 45]], c: "brow", w: 2.6 },
      // silmät: hymyssä siristyvät
      { e: [36, 48, 6.4, 2.8], c: "white", on: "open" }, { e: [67, 48, 6.4, 2.8], c: "white", on: "open" },
      { e: [36, 48, 2.8, 2.8], c: "iris", on: "open" }, { e: [67, 48, 2.8, 2.8], c: "iris", on: "open" },
      { e: [36, 48, 1.3, 1.3], c: "pupil", on: "open" }, { e: [67, 48, 1.3, 1.3], c: "pupil", on: "open" },
      { l: [[29, 46.2], [43, 46.2]], c: "skinDD", w: 1.8, on: "open" }, { l: [[60, 46.2], [74, 46.2]], c: "skinDD", w: 1.8, on: "open" },
      { l: [[29, 48], [43, 48]], c: "skinDD", w: 2.4, on: "blink" }, { l: [[60, 48], [74, 48]], c: "skinDD", w: 2.4, on: "blink" },
      { l: [[30, 51.5], [42, 51.5]], c: "skinD", w: 1.2 }, { l: [[61, 51.5], [73, 51.5]], c: "skinD", w: 1.2 },
      { l: [[25, 47], [22, 51]], c: "skinD", w: 1 }, { l: [[78, 47], [81, 51]], c: "skinD", w: 1 },
      // nenä: leveä pyöreä kärki
      { l: [[49, 50], [48, 63]], c: "skinL", w: 2 }, { p: [[54, 52], [59, 66], [54, 68]], c: "skinD" },
      { e: [51, 65, 6.5, 4.2], c: "skin" }, { e: [49, 64, 2, 1.6], c: "skinL" }, { p: [[56, 62], [58, 67], [54, 69]], c: "skinD" },
      { e: [45, 69, 2.4, 1.4], c: "skinDD" }, { e: [56, 69, 2.4, 1.4], c: "skinDD" },
      { l: [[42, 70], [35, 77]], c: "skinD", w: 1.4 }, { l: [[60, 70], [66, 77]], c: "skinD", w: 1.4 },
      // hymy hampain; puhuessa suu aukeaa
      { p: [[36, 78], [44, 76], [50, 77], [56, 76], [65, 78], [56, 79], [44, 79]], c: "lip" },
      { p: [[39, 78.5], [62, 78.5], [60, 81], [50, 81.6], [41, 81]], c: "teeth", on: "still" }, { p: [[39, 81], [62, 81], [58, 84], [50, 85], [43, 84]], c: "lipL", on: "still" },
      { e: [50, 81.5, 11.5, 4.6], c: "mouth", on: "talk" }, { p: [[39, 78.5], [62, 78.5], [60, 81], [41, 81]], c: "teeth", on: "talk" }, { p: [[40, 85], [61, 85], [57, 88], [50, 89], [44, 88]], c: "lipL", on: "talk" },
    ],
    // takaa (kävelee poispäin): niska, korvat ja tukka
    back: [
      { e: [11, 57, 5.5, 14], c: "skinD" }, { e: [88, 58, 4.5, 13], c: "skinD" },
      { e: [50, 52, 37, 46], c: "skin" }, { p: [[26, 86], [74, 86], [68, 106], [32, 106]], c: "skinD" },
      { e: [50, 42, 40, 44], c: "hair" }, { p: [[12, 50], [88, 50], [82, 84], [18, 84]], c: "hair" },
      { l: [[24, 18], [50, 6], [76, 14]], c: "hairL", w: 3 }, { l: [[20, 48], [50, 40], [82, 48]], c: "hairD", w: 2 }, { l: [[28, 74], [72, 74]], c: "hairD", w: 2 },
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
  // Kari Jalonen, karikatyyri (23.10.): lyhyt valkovaalea tukka pystyyn ja sivulle, korkea otsa,
  // reunattomat lasit, pienet siniset silmät, pitkä suora nenä, punakat posket ja leuka, ohut
  // vakava suu ja syvät nenä-suupoimut. Lyhyen sanan mestari: ilme ei turhia liiku. Pelissä
  // valokuvapää (pixfaces.js) ohittaa tämän; asetukset new_players/kari_jalonen/pixel_face_config.json.
  jalonen: {
    outline: "#2c1810",
    pal: { ...SKIN, skin: "#e8ac8c", skinL: "#f8ccb0", skinD: "#c4846c", skinDD: "#9c5c4c", blush: "#e08878", hair: "#ece2c0", hairL: "#fcf8ec", hairD: "#bcae88",
      brow: "#c8b48c", glass: "#c4d0dc", white: "#f4f4f0", iris: "#3c78c8", pupil: "#1c2430" },
    weight: { iris: 5, pupil: 5, white: 3, brow: 3, lip: 3, mouth: 4, teeth: 3, glass: 2.5, skinDD: 2.4 },
    shapes: [
      { e: [11, 62, 6, 10], c: "skin" }, { e: [89, 62, 6, 10], c: "skinD" },
      { e: [50, 54, 37, 44], c: "skin" },
      { p: [[13, 58], [87, 58], [89, 86], [82, 104], [64, 114], [36, 114], [18, 104], [11, 86]], c: "skin" },
      { p: [[68, 30], [88, 58], [89, 86], [82, 104], [66, 112], [76, 88], [76, 60]], c: "skin", d: "skinD", sparse: true },
      { p: [[78, 44], [88, 60], [89, 86], [82, 104], [74, 110], [84, 86], [84, 62]], c: "skinD" },
      { e: [28, 78, 9, 6], c: "skin", d: "blush", sparse: true }, { e: [72, 78, 9, 6], c: "skin", d: "blush", sparse: true },
      // lyhyt tukka harjattuna ylös ja oikealle, väistyvät ohimot
      { p: [[17, 40], [14, 24], [22, 10], [36, 2], [54, 0], [72, 4], [84, 14], [88, 30], [86, 42], [82, 30], [74, 20], [60, 18], [46, 20], [34, 22], [24, 28], [21, 40]], c: "hair" },
      { l: [[28, 14], [48, 4], [70, 8]], c: "hairL", w: 3 }, { l: [[62, 4], [78, 10], [86, 22]], c: "hairD", w: 2 }, { l: [[34, 20], [56, 12], [76, 16]], c: "hairL", w: 2 },
      { p: [[13, 32], [20, 32], [20, 52], [14, 50]], c: "hair", d: "hairD", sparse: true }, { p: [[87, 32], [80, 32], [80, 52], [86, 50]], c: "hairD", d: "hair", sparse: true },
      { l: [[34, 31], [66, 31]], c: "skinD", w: 1.4 }, { l: [[37, 37], [63, 37]], c: "skinD", w: 1.2 },          // otsan rypyt
      { l: [[26, 48], [42, 46]], c: "brow", w: 2.6 }, { l: [[58, 46], [74, 48]], c: "brow", w: 2.6 },
      { e: [34, 56, 6, 2.6], c: "white", on: "open" }, { e: [66, 56, 6, 2.6], c: "white", on: "open" },
      { e: [35, 56, 2.8, 2.4], c: "iris", on: "open" }, { e: [65, 56, 2.8, 2.4], c: "iris", on: "open" },
      { e: [35, 56, 1.2, 1.4], c: "pupil", on: "open" }, { e: [65, 56, 1.2, 1.4], c: "pupil", on: "open" },
      { l: [[27, 53], [41, 53]], c: "skinD", w: 2.2, on: "open" }, { l: [[59, 53], [73, 53]], c: "skinD", w: 2.2, on: "open" },   // raskaat luomet
      { l: [[27, 56], [41, 56]], c: "skinDD", w: 2.6, on: "blink" }, { l: [[59, 56], [73, 56]], c: "skinDD", w: 2.6, on: "blink" },
      // reunattomat lasit: vain ohut kirkas kaari ja sanka
      { s: [34, 56, 12, 8], c: "glass", w: 1.6 }, { s: [66, 56, 12, 8], c: "glass", w: 1.6 }, { l: [[46, 55], [54, 55]], c: "glass", w: 1.4 },
      { l: [[22, 54], [12, 57]], c: "glass", w: 1.4 }, { l: [[78, 54], [88, 57]], c: "glass", w: 1.4 },
      { p: [[52, 56], [57, 80], [51, 83]], c: "skinD" }, { l: [[49, 58], [48, 77]], c: "skinL", w: 2 }, { e: [46, 82, 2.4, 1.5], c: "skinDD" }, { e: [55, 82, 2.4, 1.5], c: "skinDD" },
      { l: [[38, 83], [33, 97]], c: "skinD", w: 2 }, { l: [[62, 83], [67, 97]], c: "skinD", w: 2 },              // nenä-suupoimut
      { l: [[24, 96], [30, 108]], c: "skinD", w: 1.4 }, { l: [[76, 96], [70, 108]], c: "skinD", w: 1.4 }, { l: [[44, 107], [56, 107]], c: "skinD", w: 1.4 },
      // ohut vakava suu, suupielet hieman alas
      { l: [[38, 95], [50, 93], [62, 95]], c: "lip", w: 2.6, on: "still" }, { l: [[38, 95], [36, 98]], c: "skinD", w: 1.6, on: "still" }, { l: [[62, 95], [64, 98]], c: "skinD", w: 1.6, on: "still" },
      { p: [[38, 93], [62, 93], [58, 101], [50, 103], [42, 101]], c: "mouth", on: "talk" }, { p: [[40, 93], [60, 93], [58, 96], [42, 96]], c: "teeth", on: "talk" },
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

// --- vartalot -------------------------------------------------------------------
// Pieni vartalo isolle päälle (origo jalkojen keskellä, kaula y = -22). Asut vertailukuvista:
// Saarni navyliivi + vaaleansininen kauluspaita ja salkku, Myrrä musta pikkutakki + valkoinen
// kaulus, maskotti musta pelipaita narrinkauluksella, punaiset shortsit, valkoiset hanskat.
const OUTFITS = {
  saarni: { legs: "#2c2c38", shoe: "#14141a", shirt: "#a8c8e8", shirtD: "#7ca0c8", coat: "#1c2444", coatL: "#2c3864", hand: "#dca482", bag: "#5c3c24" },
  myrra: { legs: "#24242c", shoe: "#14141a", shirt: "#f4f4f4", shirtD: "#1c1c24", coat: "#1c1c22", coatL: "#34343c", hand: "#e8b08c" },
  jokinen: { legs: "#1c2240", shoe: "#14141a", shirt: "#f4f4f4", shirtD: "#c8c8c8", coat: "#1c2448", coatL: "#2c3868", hand: "#e8b090" },
  valtonen: { legs: "#4c6c9c", shoe: "#ececec", shirt: "#f4f4f4", shirtD: "#c8c8c8", coat: "#1c2448", coatL: "#2c3868", hand: "#e0a888" },
  jalonen: { legs: "#24283c", shoe: "#14141a", shirt: "#1c3c7c", shirtD: "#142c5c", coat: "#1c3c7c", coatL: "#3c5ca0", hand: "#e8ac8c" },
  maskotti: { legs: "#18181c", shoe: "#d8242c", shirt: "#1c1c22", shirtD: "#1c1c22", coat: "#1c1c22", coatL: "#34343c", hand: "#f4f4f4", shorts: "#c81c24", collar: true, headScale: 1.15 },
};

// --- nimettömät hahmot (backlog 5.2, 17.10.) ------------------------------------
// Basaarin väki ja muut sivuhahmot samalla bobblehead-mitalla kuin Jussi ja Raimo: pieni
// vartalo, iso pää tuplatarkkuudella (40 x 50, kuten valokuvapäät). Valokuvaa ei ole, joten
// pää piirretään käsin: ihonsävy, hiukset tai päähine, kulmat, silmät, nenä, viikset, suu.
const NPCS = [
  { skin: "#d8a070", hair: "#2c1c14", hat: "fez", stache: true, shirt: "#f0ece0", vest: "#9c1c1c", legs: "#2c2c34" },
  { skin: "#c88c5c", hair: "#1c1410", beard: true, shirt: "#3c6cac", vest: null, legs: "#3c3c44" },
  { skin: "#e0b088", hair: "#3c2414", hat: "scarf", scarf: "#3c8c5c", shirt: "#7c3c8c", vest: null, legs: "#7c3c8c", dress: true },
  { skin: "#d09868", hair: "#9c9c9c", hat: "bald", stache: true, shirt: "#e8e4d8", vest: "#6c4c2c", legs: "#2c2418" },
  { skin: "#e8b890", hair: "#5c3c1c", hat: "cap", shirt: "#e8c81c", vest: null, legs: "#2c3c5c" },
  { skin: "#b87c50", hair: "#141010", hat: "curly", shirt: "#f4f4f4", stripe: "#2c4c9c", vest: null, legs: "#3c2c24" },
  // 6 Mehmet: fetsi, valkoinen parta, mustat viikset, punainen kaapu ja kultainen vyö
  { skin: "#d89060", hair: "#ececec", brow: "#3c2414", stacheC: "#2c1c10", hat: "fez", stache: true, beard: true, shirt: "#8c1c1c", legs: "#8c1c1c", robe: true, sash: "#e8c81c" },
  // 7 salkkumies: liimattu tukka, aurinkolasit, liituraitapuku, punainen solmio, salkku
  { skin: "#e8b48c", hair: "#1c140c", hat: "slick", shades: true, shirt: "#f0f0f0", vest: "#2a2c3c", pin: true, tie: "#c81c1c", legs: "#1c1e2a", bag: true },
  // 8-9 Jokisen apuvalmentajat lenkkiasuissa (geneeriset, ei muotokuvia)
  { skin: "#e8b48c", hair: "#5c4c3c", hat: "cap", shirt: "#c81c24", stripe: "#f4f4f4", legs: "#1c1c24" },
  { skin: "#ecc09c", hair: "#c8a464", shirt: "#f4f4f4", stripe: "#c81c24", legs: "#1c1c24" },
  // 10 erotuomarin haamu: harmaa tukka ja viikset, raidallinen paita (palaute 24.10.: uuteen tyyliin)
  { skin: "#e4d4c4", hair: "#a8a8b0", brow: "#7c7c84", stacheC: "#c8c8cc", stache: true, shirt: "#f4f4f4", vstripe: "#1c1c1c", legs: "#1c1c1c" },
];
NPCS.forEach((N, i) => { FACES[`npc2_${i}`] = npcFace(N); });
