// Mouhon salaisuus -- Juonen yhteiset osat: Myrrän puhelut, tehtävälista, ohjaus ja vihjeet.
"use strict";
async function walkActor(A, x, y = A.y, speed = 1.1) {
  A.moving = true; A.dir = x >= A.x ? 1 : -1;
  while (Math.hypot(x - A.x, y - A.y) > speed) { const d = Math.hypot(x - A.x, y - A.y); A.x += (x - A.x) / d * speed; A.y += (y - A.y) / d * speed; await sleep(30); }
  A.x = x; A.y = y; A.moving = false;
}

// ---------------------------------------------------------------- Myrrän puhelut (call.js)
// Kolme puhelua; joka kerta järkevä neuvo, jonka Jussi ymmärtää täsmälleen väärin.
// Mouho on ilmainen: kukaan ei maksa mitään (käyttäjä 17.10.).
const MYRRA_CALLS = [
  // 1. Kisapuistossa: miten erottua hakijoista. Neuvo on hyvä; Jussi ottaa siitä vain sanat.
  [["myrra", "Myrrä. Pakkailen tässä kamojani valmentajakopista. Kuka siellä?"],
   ["jussi", "Jussi tässä! Kuule, minäkin pakkasin tänään. Liiga antoi minulle potkut."],
   ["myrra", "No niin. Kaksi vapaata miestä samana syksynä. Elämä jatkuu, Jussi."],
   ["jussi", "Mouho hakee toiminnanjohtajaa. Haen paikkaa. Miten olisin paras kandidaatti?"],
   ["myrra", "Älä vain hae. Näytä. Tee jotain Mouhon hyväksi jo ennen kuin kukaan pyytää. Ole proaktiivinen."],
   ["myrra", "Ja pidä se yksinkertaisena. Hyvä peli, hyvä ruoka, kaikki mukaan."],
   { bulb: true },
   ["jussi", "Proaktiivinen! Ilmoituksessa on kolme tehtävää: jäsenet, tarjoilu, turnaus. Hoidan ne kaikki ennen haastattelua!"],
   ["jussi", "Ja kaikki mukaan... jokainen uusi jäsen tuo kaksi uutta. Ja he kaksi uutta. Jäsenhankinta hoituu itsestään!"],
   ["myrra", "...Tarkoitin vähän pienemmin, Jussi."]],
  // 2. Istanbulissa, sopimus pöydällä.
  [["myrra", "Jussi! Kuulin että olet Istanbulissa. Mitä siellä teet?"],
   ["jussi", "Proaktiivisuutta! Turkkilaiset sijoittajat haluavat Mouhon kumppaniksi. Sopimus on jo pöydällä."],
   ["myrra", "Jussi. Kaksi asiaa. Älä allekirjoita mitään, mitä et ole lukenut. Äläkä maksa mitään etukäteen."],
   { bulb: true },
   ["jussi", "Luen sen! Tässä lukee: kebabtarjoilu Mouhoon, maksetaan jälkikäteen. Tarjoilu, toinen tehtävä! Eikä mitään etukäteen!"],
   ["myrra", "Luitko koko sopimuksen?"],
   ["jussi", "Luin kaiken, mikä ei ollut liimautunut kiinni. Kiitos, Jouko!"]],
  // 3. Kappadokian luolassa: turnaus tarvitsee muutakin kuin pelaajia.
  [["myrra", "Jussi? Kuulostaa siltä kuin olisit luolassa."],
   ["jussi", "Olen luolassa! Haen kultaista idolia sijoittajille. Ja täällä on erotuomarin haamu."],
   ["myrra", "...Totta kai on. Muista nyt kuitenkin: yksin ei pärjää kukaan. Tärkeintä on joukkue."],
   { bulb: true },
   ["jussi", "Joukkue! Turnaus tarvitsee tuomarin! Ja tuomari tarvitsee joukkueen. Me tarvitsemme toisiamme!"],
   ["myrra", "Elämä jatkuu, Jussi. Jossain muodossa."]],
  // 4. Mouho-illassa: ainoa neuvo, jonka Jussi ymmärtää oikein.
  [["myrra", "Myrrä. Jussi? Taustalla kuulostaa täydeltä tuvalta. Mitä sinä nyt teet?"],
   ["jussi", "Jouko, kaikki tulivat! Sijoittajat, basaari, haamu... ja kaikki odottavat minulta jotain!"],
   ["myrra", "Anna ihmisten vain pelata."],
   { bulb: true },
   ["jussi", "...Anna ihmisten pelata. Jouko, ymmärsin tämän ihan oikein!"],
   ["myrra", "...Ensimmäistä kertaa."]],
];
async function myrraIncoming(n) {
  if (st.flags[`myrra${n}`]) return; st.flags[`myrra${n}`] = true;
  await phoneCall(MYRRA_CALLS[n], { incoming: true });
}
async function callMyrra() {
  const n = st.flags.myrraCalls ?? 0;
  if (n === 0 && !st.flags.adRead) return say("Mitä minä Joukolle sanoisin? Ensin pitää olla jotain kysyttävää. Ilmoitustaululla oli jotain uutta.");
  if (n >= 1) return say("Soitan Joukolle myöhemmin. Hän pakkaa vielä. Ja minulla on jo suunnitelma.");
  st.flags.myrraCalls = n + 1;
  await phoneCall(MYRRA_CALLS[n]);
  if (n === 0) { st.flags.pyramid = true; take("ilmoitus"); give("kaavio"); iq("pyramidi", 5);
    await say("Piirrän ilmoituksen taakse jäsenhankintasuunnitelman. Huipulle minä. Alle kaksi. Niiden alle neljä. Ja niin edelleen.");
    await say("Ja kulmaan tehtävälista: jäsenet, tarjoilu, turnaus. Kun kaikki kolme ovat valmiina, kävelen haastatteluun valmiina toiminnanjohtajana.");
    // Palaute 24.10.: tavoite näkyväksi, jotta setelin käytölle on syy (kutsu setelin reunaan).
    await say("Pyramidi tarvitsee kaksi ensimmäistä jäsentä. Herra Saarni ja maskotti! He menivät SaiPan toimistoon. Jätän heille kutsun postiluukkuun. Tarvitsen vain paperia.");
    await jalonenArrives(); }
}

// ---------------------------------------------------------------- ilmoituksen kolme tehtävää
// Juonen selkäranka (17.10.): Jussi päättää hoitaa toiminnanjohtajan kolme tehtävää jo ennen
// haastattelua (Myrrä: "Älä vain hae. Näytä."). Jokainen ruutu edistää yhtä niistä.
function tasksText() {
  const f = st.flags, ok = (b) => (b ? "[X]" : "[ ]"), prize = has("idoli") || f.trophy;
  return `Kaavion kulmassa tehtävälistani:\n${ok(f.recruits >= 2)} Jäsenten hankinta${f.recruits ? ` (${f.recruits} jäsentä)` : ""}\n${ok(f.signed)} Tarjoilu\n${ok(prize)} Turnaus${prize ? " (kiertopalkinto!)" : " (palkinto puuttuu)"}`;
}

// ---------------------------------------------------------------- huomaamaton ohjaus
// 17.10.: "pelaajaa ohjataan oikeisiin tehtäviin pelaajan sitä kuitenkaan tietämättä".
// Pelimaailman sisäisiä vihjeitä: tähtikipinä juuri nyt tarpeellisen esineen päällä ja
// hahmojen lyhyet huudahdukset kuplan sijaan pienenä tekstinä. Ei koskaan välikohtauksessa.
// Kipinä näkyy vain, jos pelaaja on ollut hetken jumissa (17.10.: tähti hiekan päällä oli
// liian ilmeinen): 20 s ilman klikkausta tai uutta esinettä. Sitä ennen pelaaja löytää itse.
let lastProgress = performance.now();
function sparkle(x, y, t, ph = 0, period = 2600) {
  if (performance.now() - lastProgress < 20000) return;
  const k = ((t + ph * 977) % period) / 600; if (k > 1 || busy) return;
  const a = Math.sin(k * Math.PI), L = 1 + Math.round(a * 3), c = `rgba(255,248,200,${.4 + a * .6})`;
  r(x - L, y, L * 2 + 1, 1, c); r(x, y - L, 1, L * 2 + 1, c); if (a > .6) { px(x - 1, y - 1, c); px(x + 1, y + 1, c); px(x + 1, y - 1, c); px(x - 1, y + 1, c); }
}
function bark(x, y, text, t, ph = 0, period = 9000, dur = 2600) {
  if (busy || overlay || speaking) return; const k = (t + ph * 1301) % period; if (k > dur) return;
  const a = Math.min(1, k / 200, (dur - k) / 300);
  g.save(); g.globalAlpha = a; g.font = "9px VT323, monospace"; g.textAlign = "center"; g.lineWidth = 3;
  const hw = g.measureText(text).width / 2 + 3; x = Math.max(hw, Math.min(W - hw, x));        // aina ruudun sisällä
  const yy = y - (k / dur) * 3; g.fillStyle = "rgba(12,12,20,.72)"; g.fillRect(x - hw, yy - 8, hw * 2, 11);   // tausta: kyltit eivät kuulu läpi (sokkotesti 2)
  g.strokeStyle = "#0c0c14"; g.strokeText(text, x, y - (k / dur) * 3); g.fillStyle = "#fcf4c8"; g.fillText(text, x, y - (k / dur) * 3); g.restore(); g.textAlign = "left";
}

// Kohde nimellä, ei indeksillä: uusi kohde ruudun alkuun siirsi indeksit kerran.
const spot = (room, id) => ROOMS[room].spots.find((p) => p.id === id);


// ---------------------------------------------------------------- vihjeet
// "Vihje"-nappi ja minuutin toimettomuus: seuraava askel tilan mukaan, ensin vihjaten,
// toisella kerralla suoraan. Kukaan ei jää jumiin (käyttäjä 16.10.).
const HINTS = () => {
  const f = st.flags, here = st.scene;
  if (here === "koti" || here === "parkki") {           // Kisapuisto ja sen parkkipaikan perä (24.10.)
    const lot = here === "parkki";
    if (f.billOut && !f.billCaught && !lot) return f.billStuck ? ["Seteli jäi kiinni ilmoitustauluun.", "Poimi seteli ilmoitustaululta."] : ["Tuolla lentää viisikymppinen.", "Poimi seteli parkkipaikalta."];
    if (!f.adRead) return lot ? ["Hallin edessä ilmoitustaululla oli uusi ilmoitus.", "Kävele takaisin hallin eteen ja katso ilmoitustaulua."] : ["Setelin vieressä ilmoitustaululla oli uusi ilmoitus.", "Katso ilmoitustaulua vasemmalla."];
    if (!f.pyramid) return ["Tarvitsen neuvoa. Joukon numero on kännykässä.", "Valitse Käytä ja klikkaa kännykkää tavaroissa: soita Myrrälle."];
    if (!f.billReturned) return ["Pyramidi tarvitsee kaksi ensimmäistä jäsentä: Saarni ja maskotti. Kutsuun tarvitaan paperia, ja ainoa paperi on se viisikymppinen.",
      lot ? "Kävele hallin eteen ja käytä seteliä SaiPan toimiston postilaatikkoon." : "Valitse Käytä, klikkaa seteliä tavaroissa ja sitten toimiston postilaatikkoa oven vieressä."];
    if (!f.unlocked && !f.pianoT) return [f.mgp ? "Mouho Global Partners on kiinnostunut. Mitä sijoittajat oikein haluavat?" : "Parkkipaikan perällä lyhdyn alla odottaa liituraitamies.",
      !lot ? "Kävele parkkipaikan perälle vasemmasta reunasta." : f.mgp ? "Puhu salkkumiehelle ja kysy, mitä sijoittajat haluavat." : "Näytä pyramidikaavio salkkumiehelle (Anna kaavio, tai Puhu)."];
    if (!f.unlocked) return lot ? ["Liigan toimiston otteluohjelmassa oli post-it Ilveksestä. Se on pahvilaatikossani.", "Ilves-ilta 2025 juhli 40 vuotta mestaruudesta: kävele numeroille 1, 9, 8 ja 5."]
      : ["Pahvilaatikon otteluohjelmassa oli post-it Ilveksestä.", "Avaa pahvilaatikko, ja kävele sitten parkkipaikan perälle numeroille 1, 9, 8 ja 5."];
    return ["Kaikki on valmista. Lentokenttä kutsuu.", lot ? "Kävele hallin eteen ja käytä taksia." : "Käytä taksia oikealla."];
  }
  if (here === "lentoasema") return ["Istanbulin lento lähtee portilta 1.", "Käytä lentolippua portilla 1 oikealla."];
  if (here === "basaari") {
    if (has("idoli")) return ["Sijoittajat odottavat lahjaa.", "Anna kultainen idoli Mehmetille."];
    if (!f.mehmetWho) return ["Kirjeen osoite vei tähän kojuun. Kysytään kauppiaalta Mouho Global Partnersista.", "Puhu Mehmetille ja kysy Mouho Global Partnersista."];
    if (!f.signed) return ["Mehmet haluaa nähdä suunnitelmani.", "Puhu Mehmetille ja esittele jäsenhankintasuunnitelma."];
    if (!f.map) return ["Mehmetin isoisä kutoi tien luolaan mattoon.", "Katso mattoa vasemmalla seinällä."];
    if (f.needWeight && !has("pussi") && !has("sakki") && !f.swapped) return ["Idolin tilalle tarvitaan hiekkaa, ja hiekalle pussi. Mehmetin pusseista pitää tinkiä.", "Puhu Mehmetille pussista. Tinkiessä vain yksi vastaus kääntää juuri sen piikin takaisin; jos häviät, Mehmet kertoo mikä olisi osunut."];
    return ["Kartan mukaan luola on idässä.", "Kävele kadun päähän moskeijan alle."];
  }
  if (here === "temppeli") {
    if (f.idol) return ["Ulos ja äkkiä.", "Kävele temppelin suulle oikealle."];
    if (!f.refWho) return ["Tuomari vartioi kivipolkua. Kukaan ei näytä koskaan kysyneen, kuka hän on.", "Puhu tuomarille ja kysy, kuka hän on."];
    if (!f.refRecruited) return ["Jouko sanoi: tärkeintä on joukkue. Ja turnaus tarvitsee tuomarin.", "Puhu tuomarille ja pyydä häntä liittymään Mouhoon."];
    if (!f.needWeight) return ["Idoli on korkealla jalustalla. Mennään katsomaan.", "Poimi idoli jalustalta."];
    if (has("sakki")) return ["Hiekkasäkki on yhtä painava kuin idoli. Vaihto sulavasti.", "Käytä hiekkasäkkiä idoliin."];
    if (has("pussi")) return ["Pussiin pitää saada hiekkaa.", "Käytä nahkapussia hiekkaan (vasemmalla edessä)."];
    return ["Hiekkaa täällä on, mutta millä sitä kantaa? Mehmetillä oli pusseja.", "Kävele ulos oikealle, polkua basaariin, ja tingi Mehmetiltä pussi."];
  }
  if (here === "portti") return ["Mehmetin koju on Suuressa basaarissa.", "Kävele portista sisään oikealla."];
  if (here === "kallio") {                                       // temppelin edusta (backlog 8)
    if (f.needWeight && !has("pussi") && !has("sakki") && !f.swapped) return ["Hiekalle tarvitaan pussi. Mehmetillä on pusseja.", "Kävele polkua basaariin oikealla."];
    if (f.idol) return ["Idoli on minulla. Sijoittajat odottavat basaarissa.", "Kävele polkua basaariin oikealla."];
    return ["Maton rasti osui kallioon hakattuun oveen.", "Kävele temppelin ovesta sisään vasemmalla."];
  }
  return null;
};
let hintLevel = {}, lastHint = "";
function hint() {
  if (busy || overlay || !room()) return;
  const h = HINTS(); if (!h) return;
  const key = h[1], lvl = lastHint === key ? Math.min(1, (hintLevel[key] ?? 0) + 1) : 0;
  hintLevel[key] = lvl; lastHint = key;
  script(() => say(h[lvl]));
}
