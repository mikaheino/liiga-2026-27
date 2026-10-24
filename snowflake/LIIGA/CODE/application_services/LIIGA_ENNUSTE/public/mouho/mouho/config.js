"use strict";
// Mouhon salaisuus -- pelin asetukset moottorille (engine.js GAME): pelattava hahmo, tekstit ja
// oivalluspisteet. Ladataan sisällön ensimmäisenä, koska ruudut ja kohtaukset nojaavat näihin.
GAME.player = (x, y, dir, frame, st, sc, back) => jussi(x, y, dir, frame, st, sc, back);
GAME.playerId = "jussi";
GAME.saveKey = "mouho-2026-save-v3";   // v3 (17.10.): uusi juoni, vanhat tallennukset eivät sovi
GAME.endFormId = "mouho2027";          // Mouho 2027 -ilmoittautuminen pelin lopussa
GAME.iqLabel = "Mouho-IQ";
GAME.iconSize = [48, 32];         // tavarakuvakkeet tuplatarkkoina (palaute 24.10.: "kökköjä")
GAME.iconOutline = "#1a1426";     // sarjakuvamainen ääriviiva kaikkiin kuvakkeisiin
GAME.iqMax = 136;   // kaikkien iq()-pisteiden summa (huoneet, kohtaukset, INTERVIEW, ulkona), tarkistettu 23.10.
const IQ_MAX = GAME.iqMax;
GAME.text.generic = { Poimi: "En voi ottaa sitä.", Avaa: "Se ei aukea.", Sulje: "Se ei sulkeudu.", Työnnä: "Se ei liiku.", Vedä: "Se ei liiku.", Puhu: "Se ei vastaa. Hyvä niin.", Käytä: "En keksi, miten.", Anna: "Ei kiitos.", Katso: "Ei mitään erikoista." };
GAME.text.cannot = "Ei, se ei toimi noin.";
GAME.text.unknown = "Hmm.";
// Kävely kuvan ulkopuolelle sivulle (moottorin page-osa): kommentit puolen mukaan
GAME.text.outside = { vasen: ["Tämä ei ole enää {ruutu}. Tämä on reunaa.", "Vasemmalla ei ole mitään. Ei edes mainoksia."],
  oikea: ["Oikealla on pelkkää mustaa. Kuin otteluohjelman tyhjät viikot.", "Täältä ei pääse Istanbuliin. Tarkistin."],
  alla: ["Verbien alla. Tänne putoavat sanat, joita kukaan ei käytä.", "Seison tavaralistan alla. Jos jotain putoaa, se osuu minuun."],
  ylla: ["Täällä ylhäällä on vain selaimen kulma. Ja se on tyhjä.", "Vielä vähän ylemmäs, niin olen välilehdissä."],
  kaikki: ["Nyt ollaan väärässä paikassa.", "Tänne ei piirretty mitään. Kävelen silti.", "Pimeää. Täällä ei ole edes kävelyalueita.", "Jos joku kysyy, olin koko ajan pelissä."] };
GAME.text.back = "Takaisin pikseleihin. Täällä on sentään tehtävälista.";
