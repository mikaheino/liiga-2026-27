// Mouhon salaisuus -- sisältö: esineet, ruudut ja tarina Mouho-moottorille.
"use strict";
// Kisapuiston hahmot (määritelty ennen ruutuja, koska Kisapuisto viittaa niihin).
// Raimo Helminen on SaiPan valmentaja: tulee hallin ovesta. Saarni ja Jokerit-maskotti
// kävelevät taustalla autolta SaiPan toimistoon (vaihe 4, 17.10.).
const RAIMO = { id: "helminen", x: 158, y: 84, h: 46, color: "#fcd41c", moving: false, dir: 1, hidden: () => !st.flags.raimo,
  draw(t, talking) { helminen(this.x, this.y, t, talking, this.moving, this.dir); } };
const SAARNI = { id: "saarni", x: 40, y: 94, h: 46, color: "#a8c8e8", moving: false, dir: 1, hidden: () => !st.flags.saarniHere,
  draw(t, talking) { person("saarni", this.x, this.y, t, { moving: this.moving, dir: this.dir, talking }); } };
const MASKOTTI = { id: "maskotti", x: 22, y: 95, h: 50, color: "#d8242c", moving: false, dir: 1, hidden: () => !st.flags.saarniHere,
  draw(t, talking) { person("maskotti", this.x, this.y, t, { moving: this.moving, dir: this.dir, talking }); } };
async function walkActor(A, x, y = A.y, speed = 1.1) {
  A.moving = true; A.dir = x >= A.x ? 1 : -1;
  while (Math.hypot(x - A.x, y - A.y) > speed) { const d = Math.hypot(x - A.x, y - A.y); A.x += (x - A.x) / d * speed; A.y += (y - A.y) / d * speed; await sleep(30); }
  A.x = x; A.y = y; A.moving = false;
}
Object.assign(ITEMS, {
  kebab: { name: "kebab", look: () => say("Aito Istanbulin döner kebab. Näyte Mouhon tarjoilusta. Pizza on yliarvostettu.") },
  kortti: { name: "käyntikortti", look: () => say("\"MOUHO GLOBAL PARTNERS. Istanbul - Milano - Lappeenranta.\nKansainvälistä jäsenhankintaa.\"\nKuulostaa viralliselta. Siinä on kultareunus.") },
  kirje: { name: "kirje", look: async () => {
    await say("\"Arvoisa herra Markkanen! Sijoittajamme ovat valmiita neuvottelemaan MOUHO-brändistä kanssanne.\nTervetuloa Istanbuliin: Suuri basaari, Mehmetin koju. -- Mouho Global Partners\"");
    await say("Neuvottelemaan Mouhosta! Kansainvälinen kumppanuus, ennen kuin olen edes saanut paikkaa. Proaktiivisempaa ei voi olla.");
    if (!has("lippu")) { await say("Kirjeen välissä on lentolippu Istanbuliin. Ilmainen! Se on aina hyvä merkki. Eikö olekin?"); give("lippu"); } },
    Avaa: () => ITEMS.kirje.look() },          // sokkotesti 2: "Avaa kirje" on luontevin verbi
  seteli: { name: "50 euron seteli", look: () => say("Herra Saarnin viisikymppinen. Se ei ole minun. Palautan sen SaiPan toimiston postiluukusta: oven vieressä on postilaatikko.") },
  ilmoitus: { name: "Mouhon ilmoitus", look: () => say(st.flags.pyramid ? "Ilmoituksen takana on pyramidikaavioni. Huipulla: minä." : "\"Mouho hakee toiminnanjohtajaa.\" Luin sen jo kolme kertaa. Joka kerta se kuulostaa paremmalta.") },
  kaavio: { name: "pyramidikaavio", look: () => say(tasksText()) },
  lippu: { name: "lentolippu", look: () => say("Yksisuuntainen lippu Istanbuliin. Paluu järjestyy jotenkin. Aina järjestyy.") },
  nimikyltti: { name: "nimikyltti", look: () => say("Messinkinen nimikyltti: \"Jussi Markkanen, urheilujohtaja\". Kiiltävä. Ja nyt vähän menneen talven lumia.") },
  pussi: { name: "isoisän nahkapussi", look: () => say("Mehmetin isoisän nahkapussi. Juuri sopiva hiekalle. Isoisä yritti kuulemma samaa vaihtoa. Kuulemma.") },
  sakki: { name: "hiekkasäkki", look: () => say("Hiekkasäkki. Painaa suunnilleen yhtä paljon kuin kultainen idoli. Toivottavasti.") },
  puhelin: { name: "kännykkä", look: async () => { if (st.flags.adRead && !st.flags.pyramid) { await say("Jouko Myrrä, pikavalinta ykkönen. Soitetaan."); return callMyrra(); }
      return say("Kännykkä. Pikavalinnassa ykkösenä Jouko Myrrä. Hän tietää aina mitä tehdä."); },
    nudge: () => st.flags.adRead && !st.flags.pyramid,         // sykkii tavaroissa, kunnes Joukolle on soitettu
    Käytä: () => callMyrra(), Puhu: () => callMyrra() },
  lappu: { name: "Saarnin lappu", look: () => say(st.flags.adRead ? "\"Kiitos, rehellistä. Mouho kuulostaa hauskalta. Ollaan mukana. -M.S.\"" : "\"Kiitos, rehellistä. Kuulin että etsit töitä. Ilmoitustaululla on paikka, joka sopii sinulle. -M.S.\"") },
  velkakirja: { name: "sopimus", look: () => say("Mouho Global Partnersin sopimus. Luin sen: \"Kebabtarjoilu Mouhoon, maksetaan jälkikäteen.\"\nEnsimmäinen sivu on liimautunut kiinni kanteen. Tuskin mitään tärkeää.") },
  idoli: { name: "kultainen idoli", look: () => say("Kultainen idoli. Pyramidin huippu. Se katsoo minua. Minä katson sitä. Me ymmärrämme toisiamme.") },
});

// ---------------------------------------------------------------- ruudut
Object.assign(ROOMS, {
  // Kisapuisto (vaihe 4, 17.10.): Jussi laskeutui Liigasta suoraan lehtikasaan. Taustalla Saarni
  // ja maskotti kävelevät SaiPan toimistoon ja pudottavat 50 euroa; ilmoitustaululla Mouho
  // hakee toiminnanjohtajaa. Mouho on ilmainen -- kukaan ei maksa mitään.
  // Tunniste "koti" ja pianon liput pysyvät satama-ajoilta.
  koti: {
    title: "Kisapuisto, Lappeenranta", scale: [80, 136, 0.46, 1.06], start: 128,
    walk: [[[0, 123], [240, 123], [240, 136], [0, 136]], [[60, 86], [236, 86], [240, 124], [56, 124]]],
    actors: [{ id: "salkkumies", x: 184, y: 92, h: 48, color: "#7cfcfc", draw: (t, talking) => salesman(184, 92, t, talking) },
             RAIMO, SAARNI, MASKOTTI],
    draw: (t) => { kisaDraw(t); satamaPiano(t); ghostLynx(t); thumbsUp(t); moneyTrail(t); },
    post: (t) => guideKisa(t),
    onStop: (x, y) => quizStep(keyAt(x, y)),
    props: [{ y: 127, draw: () => st.flags.leafPile && leafPile(LAND[0], LAND[1]) }, { y: 128, draw: kisaPoster }, { y: 80, draw: kisaPostbox }, { y: 96, draw: kisaRack }, { y: 130, draw: kisaBox }, { y: 134, draw: kisaTaxi },
            { get y() { return st.flags.billStuck ? 129 : BILL.y; }, draw: drawBill }],      // nastan alla taulun edessä
    spots: [
      { id: "salkkumies", name: "salkkumies", actor: true, x: 177, y: 62, w: 16, h: 30, at: 172, aty: 96,
        Katso: () => say(st.flags.pyramid ? "Liituraitapuku, aurinkolasit iltahämärässä ja salkku. Hän katselee pyramidikaaviotani kuin se olisi tuttu." : "Liituraitapuku, aurinkolasit iltahämärässä ja salkku. Ei herra Saarni; tämä mies on seissyt täällä koko ajan, kuin odottaen jotakuta."),
        Puhu: () => salesmanTalk(),
        Anna: (it) => it === "seteli" ? salesmanBill() : it === "kaavio" ? (st.flags.mgp ? salesmanTalk() : showChartToSalesman()) : say("Salkkumies: \"Otan vastaan vain tilisiirtoja, kiitos.\"", "salkkumies") },
      { id: "seteli", name: "50 euron seteli", get x() { return BILL.x - 6; }, get y() { return BILL.y - 10; }, w: 12, h: 12, get at() { return BILL.x; }, get aty() { return Math.min(122, BILL.y + 2); },
        hidden: () => !st.flags.billOut || st.flags.billCaught,
        Katso: () => say("Viisikymppinen lepattaa tuulessa. Herra Saarnin salkusta. Se ei ole minun."),
        Poimi: () => chaseBill(), Käytä: () => chaseBill() },
      { id: "pollari", name: "pahvilaatikko", x: 91, y: 109, w: 26, h: 22, at: 122, aty: 128,
        Katso: () => say("Tavarani Liigan toimistolta. Kahvikuppi ja otteluohjelma, jossa on enemmän post-it-lappuja kuin otteluita."),
        Avaa: () => say("Kahvikuppi. Siinä lukee \"Maailman paras urheilujohtaja\". Ostin sen itse."),
        Käytä: () => standOnBox(), Työnnä: () => say("Laatikko on hyvä paikallaan. Siitä saisi vaikka korokkeen."),
        Poimi: () => say("Jätän sen tähän hetkeksi. Kantaa ehtii myöhemminkin. Koko loppuelämän, oikeastaan."),
        Vedä: () => say("Vedän laatikkoa lähemmäs. Se on ainoa asia, joka seuraa minua tänään vapaaehtoisesti.") },
      { id: "juliste", name: "ilmoitustaulu", x: 16, y: 84, w: 38, h: 30, at: 72, aty: 131,
        Katso: () => readAd(), Poimi: () => readAd() },
      { id: "piano", name: "asfaltin numerot", floor: true, hidden: () => !st.flags.pianoT, x: 80, y: 98, w: 160, h: 18, at: 160, aty: 108,
        Katso: () => say("Parkkipaikan asfalttiin heijastettu jättipiano, numerot 1-9 ja 0. Kuin siinä Tom Hanksin elokuvassa.\nPitää vain seistä oikeilla numeroilla oikeassa järjestyksessä."),
        Työnnä: () => say("Painan jalalla. Pianoja soitetaan tässä kaupungissa jaloin.") },
      { id: "laatikko", name: "postilaatikko", x: 227, y: 68, w: 13, h: 14, at: 233, aty: 88,
        // Ei lukossa (17.10.: "miksi postilaatikko on lukossa, jos sinne palautetaan rahat?").
        // Sijoittajien kirje ilmestyy vasta pätevyystestin (Ilves 1985) jälkeen.
        Avaa: async () => { if (st.flags.boxOpen) return say("Se on jo auki."); st.flags.boxOpen = true;
          await say(st.flags.letterTaken ? "Tyhjä." : st.flags.unlocked ? "Laatikossa on uusi kirje! Kultareunainen kuori." : "Laskuja. Ja Liigan kiitoskirje, toinen kappale. Ei mitään uutta."); },
        Sulje: async () => { st.flags.boxOpen = false; await say("Suljettu. Postilaatikot ovat tyytyväisimpiä suljettuina."); },
        Poimi: async () => { if (!st.flags.boxOpen) return say("Laatikko on kiinni."); if (!st.flags.unlocked) return say("Pelkkiä laskuja. Ne saavat jäädä sinne."); if (st.flags.letterTaken) return say("Ei siellä ole enää mitään."); st.flags.letterTaken = true; give("kirje"); await say("Kirje! Joku muistaa minut."); },
        "Käytä:seteli": () => returnBill(), "Anna:seteli": () => returnBill(),
        Katso: () => say("SaiPan toimiston postilaatikko, keltaisen oven vieressä. Postini tulee yhä tänne, vaikka lähdin keväällä 2023.") },
      { id: "ovi", name: "SaiPan toimiston ovi", x: 219, y: 62, w: 8, h: 18, at: 224, aty: 88,
        // Sokkotesti 2: setelin tarjoaminen ovelle on luontevaa, joten se käy palautukseksi.
        "Käytä:seteli": () => returnBill(), "Anna:seteli": () => returnBill(),
        Katso: () => say(st.flags.billReturned ? "Toimiston ovi. Ikkunasta näkyi hetki sitten peukku." : "SaiPan toimiston keltainen ovi. Herra Saarni ja maskotti menivät tästä sisään. Vieressä on toimiston postilaatikko."),
        Avaa: () => say("Lukossa. Pelaajakaupoissa ei häiritä."), Puhu: () => say("Koputan. Sisältä kuuluu: \"Ja tekstitv:stä löytyi vielä yksi!\"\nEn keskeytä.") },
      { id: "taksi", name: "taksi lentokentälle", x: 242, y: 88, w: 78, h: 46, at: 234, aty: 130,
        Katso: () => say("Taksi Lappeenrannan lentokentälle. Kuljettaja lukee Liigan otteluohjelmaa. Hän näyttää huolestuneelta."),
        Käytä: () => leave(), Avaa: () => leave(), Puhu: () => say(has("lippu") ? "Kuljettaja: \"Lentokentälle? Taas Milanoon? Ai, Istanbuliin. Hyppää kyytiin.\"" : "Kuljettaja: \"Lentokentälle? Minne sitten? Kun tiedät, tule takaisin. Mittari ei käy vielä.\"", "muu") },
    ],
  },
  // Basaari: katu kapenee kohti moskeijaa; Mehmet tiskinsä takana oikealla.
  basaari: {
    title: "Suuri basaari, Istanbul", scale: [72, 136, 0.4, 1.06], start: 128,
    walk: [[[142, 72], [178, 72], [206, 96], [206, 121], [300, 136], [20, 136]]],
    actors: [{ id: "kauppias", x: 258, y: 96, h: 46, color: "#fc54fc", draw: (t, talking) => merchant(258, 96, t, talking) }],
    draw: (t) => { basaariDraw(t); satamaPiano(t); ghostCup(t); },
    post: (t) => guideBasaari(t),
    onStop: (x, y) => quizStep(keyAt(x, y)),
    props: [{ y: 114, draw: basaariCounter }, { y: 101, draw: basaariSpices }, { y: 131, draw: basaariAmphora }, { y: 92, draw: basaariBags }, { y: 140, draw: (t) => (st.flags.crowd || st.flags.bazaar) && basaariCrowd(t) }],
    spots: [
      { id: "piano2", name: "heijastetut numerot", floor: true, hidden: () => !st.flags.quizT_basaari, x: 70, y: 100, w: 136, h: 16, at: 150, aty: 108,
        Katso: () => say("Numerot heijastuvat kadun mukulakiviin. Mehmetillä on yllättävän hyvä tekniikka.") },
      { id: "amfora", name: "amfora", x: 28, y: 108, w: 22, h: 24, at: 56, aty: 130,
        Katso: () => say("Amfora. Kyljessä lukee \"ÄLÄ AVAA\". Kerrankin kunnioitan ohjetta."), Avaa: () => say("Siinä lukee \"älä avaa\". Opin jotain Milanosta.") },
      { id: "mausteet", name: "mausteet", x: 68, y: 84, w: 44, h: 18, at: 104, aty: 104,
        Katso: () => say("Paprikaa, kurkumaa ja minttua. Basaarin tuoksu on puoliksi näitä, puoliksi kebabia."), Poimi: () => say("Mehmet: \"Mausteet punnitaan, ystäväni. Ei sormia.\"", "kauppias") },
      { id: "doner", name: "döner-varras", x: 222, y: 64, w: 16, h: 28, at: 206, aty: 108,
        Katso: () => say("Döner kebab pyörii hitaasti. Kuin Liigan otteluohjelma: aina sama liha, mutta joka kerta eri kohdassa."),
        Poimi: () => say("Mehmet: \"Kebab maksaa, ystäväni. Mutta tuoksu on ilmainen.\"", "kauppias"),
        Käytä: () => say("Pyöritän sitä toiseen suuntaan. Mehmet katsoo minua kuin olisin siirtänyt ottelun.") },
      { id: "matto", name: "matto", x: 16, y: 46, w: 34, h: 54, at: 56, aty: 112,
        Katso: async () => { st.flags.map = true; iq("kartta", 4); await say("Mattoon on kudottu kartta! Kappadokia... luolatemppeli... ja punainen rasti.\nPainan sen mieleeni. Kadun päästä pääsee itään."); },
        Poimi: () => say("Kauppias: \"Matto maksaa enemmän kuin sinä.\"", "kauppias"), Työnnä: () => say("Matto ei lennä. Tarkistin.") },
      { id: "kauppias", name: "kauppias", actor: true, x: 247, y: 64, w: 22, h: 32, at: 205, aty: 116,
        Katso: () => say("Mehmet, Mouho Global Partnersin johtaja. Basaarin kovin tinkijä. Kuulemma hän on myynyt hiekkaa autiomaahan ja logon Lappeenrantaan."),
        Puhu: () => talk(), Anna: (it) => it === "idoli" ? deliverIdol() : it === "kaavio" ? talk() : it === "nimikyltti" ? say("Kauppias: \"Kiiltävä! Mutta ensin tingitään, ystäväni.\"", "kauppias") : say("Kauppias: \"Ei kiitos.\"", "kauppias") },
      { id: "pussit", name: "nahkapussit", x: 274, y: 64, w: 22, h: 22, at: 262, aty: 118,
        Katso: () => say(st.flags.needWeight ? "Nahkapusseja Mehmetin kojussa. Juuri sopivia hiekalle." : "Nahkapusseja roikkuu kojun katosta. Kauniita, mutta mihin minä pussia tarvitsisin?"),
        Poimi: () => say("Mehmet: \"Pussit punnitaan, ystäväni. Ja niistä tingitään.\"", "kauppias") },
      { id: "itaan", name: "itäinen kuja", x: 140, y: 40, w: 40, h: 31, at: 160, aty: 73, exit: true,
        Katso: () => say(st.flags.map ? "Kuja itään, Kappadokiaan, kartan mukaan." : "Kuja moskeijan alla. En tiedä mihin se vie."), Käytä: () => toTemple(), Kävele: () => toTemple() },
    ],
  },
  // Temppeli (17.10.): yksi pulma. Idoli on paineansalla; tilalle tarvitaan yhtä painava
  // hiekkasäkki. Hiekka on luolassa, pussi tingitään basaarista. Kuilun yli kulkee kivipolku.
  temppeli: {
    title: "Unohdettu luolatemppeli, Kappadokia", scale: [62, 136, 0.34, 1.06], start: 128,
    // Tuomari vartioi kivipolkua (17.10.: "luolassa voi käydä juttelematta tuomarin kanssa"):
    // takaosaan pääsee vasta, kun hänet on värvätty turnauksen tuomariksi.
    walk: () => st.flags.refRecruited ? [[[24, 100], [296, 100], [318, 136], [2, 136]], [[94, 64], [226, 64], [256, 80], [64, 80]], [[197, 78], [208, 78], [209, 102], [196, 102]]]
                                      : [[[24, 100], [296, 100], [318, 136], [2, 136]]],
    enter: () => { st.flags.crossed = true; },
    draw: temppeliDraw,
    post: (t) => { temppeliPost(t); guideTemppeli(t); },
    actors: [{ id: "tuomari", get x() { return st.flags.refRecruited ? 100 : 203; }, y: 106, h: 44, color: "#a8d8fc", hidden: () => !st.flags.refHere, draw: (t, talking) => ghostRef(st.flags.refRecruited ? 100 : 203, 106, t, talking) }],
    props: [{ y: 76, draw: temppeliPedestal }, { y: 129, draw: temppeliSand }, { y: 131, draw: temppeliPillar }, { get y() { return st.flags.boulder == null ? -1 : boulderY(); }, draw: temppeliBoulder }],
    spots: [
      { id: "tuomari", name: "erotuomarin haamu", actor: true, hidden: () => !st.flags.refHere, get x() { return st.flags.refRecruited ? 92 : 195; }, y: 64, w: 16, h: 42, get at() { return st.flags.refRecruited ? 112 : 184; }, aty: 110,
        Katso: () => say(st.flags.refRecruited ? "Turnauksemme tuomari. Hän harjoittelee vihellystä reliefille." : "Muinaisen erotuomarin haamu. Hän seisoo kivipolun päässä kuin maalivahti, joka ei päästä mitään läpi."), Puhu: () => refereeTalk() },
      { id: "pylvas", name: "kaatunut pylväs", x: 234, y: 118, w: 36, h: 14, at: 228, aty: 133,
        Katso: () => say("Kaatunut pylväs. Siinä on enemmän ryhtiä kuin minulla maanantaisin."), Työnnä: () => say("Se ei liiku. Eikä sen kuulukaan. Se on jo kaatunut kerran.") },
      { id: "hiekka", name: "hiekka", x: 36, y: 114, w: 36, h: 16, at: 76, aty: 127,
        Katso: () => say("Hienoa hiekkaa. Täydellistä säkkeihin. Ei kysytä, miksi luolassa on hiekkaa."),
        Poimi: () => say(st.flags.needWeight ? "Kourallinen ei riitä idolin painoksi. Tarvitsen pussin. Mehmetillä on pusseja." : "Kourallinen hiekkaa. Mihin minä tätä tarvitsisin?"),
        "Käytä:pussi": async () => { take("pussi"); give("sakki"); st.flags.sandUsed = true; iq("hiekkasakki", 5); await say("Täytän pussin. Hiekkasäkki valmis! Painaa varmaan saman verran kuin idoli."); } },
      { id: "reliefi", name: "kivireliefi", x: 76, y: 20, w: 50, h: 30, at: 130, aty: 104,
        Katso: () => (iq("reliefi", 5), say("Muinainen otteluohjelma, hakattu kiveen tuhansiksi vuosiksi.\nJoku on silti siirtänyt kolmea ottelua lyhyellä varoitusajalla.")),
        Työnnä: () => say("Se ei liiku. Kiveen hakattu ohjelma ei siirry. Tai ei ainakaan pitäisi.") },
      { id: "kuilu", name: "kuilu", x: 26, y: 81, w: 268, h: 17, at: 160, aty: 102,
        Katso: () => say("Syvä kuilu kammion poikki. Oikealla kulkee kapea kivipolku idolin luo. Muinaiset ajattelivat kaikkea."),
        Kävele: () => say("En hyppää. Kivipolku oikealla riittää.") },
      { id: "idoli", name: "kultainen idoli", x: 152, y: 49, w: 16, h: 16, at: 160, aty: 79, hidden: () => st.flags.idol && !st.flags.swapped,
        Katso: () => say(st.flags.swapped ? "Hiekkasäkki jalustalla. Se ei huijaa ketään pitkään." : "Kultainen idoli korkealla jalustalla. Isoisän pyramidin huippu."),
        Poimi: () => st.flags.idol ? say("Se on jo minulla.") : !st.flags.refRecruited ? blocked() : discoverTrap(),
        "Käytä:sakki": () => (!st.flags.refRecruited ? blocked() : grabIdol()) },
      { id: "ovi", name: "käytävä basaariin", x: 2, y: 76, w: 18, h: 52, at: 22, aty: 118, exit: true,
        Katso: () => say("Käytävä takaisin basaariin."), Käytä: () => backToBazaar(), Kävele: () => backToBazaar() },
    ],
  },
});

// ---------------------------------------------------------------- juoni
async function leave() {
  await script(async () => {
    if (st.flags.billOut && !st.flags.billReturned) return say(st.flags.billCaught ? "Ensin herra Saarnin viisikymppinen takaisin omistajalleen. Toimiston postiluukku on tuossa." : "En voi lähteä, kun tuolla lentää jonkun viisikymppinen. Se ei ole minun.");
    if (!st.flags.pyramid) return say("Lähteä minne? Minulla ei ole vielä edes suunnitelmaa. Ilmoitustaululla oli jotain.");
    if (!has("lippu")) return say(st.flags.letterTaken ? "Kirjettä pitäisi katsoa tarkemmin. Siinä tuntui olevan jotain muutakin." : st.flags.unlocked ? "Lippu? Sijoittajien kirje odottaa postilaatikossa." : "Lentokentälle? Ilman lippua en pääse edes turvatarkastukseen.");
    await say("Istanbul, täältä tullaan! Mouho Global Partners odottaa.");
    take("lippu"); await travel("lpr", "ist"); go("basaari", 96, true);
    await say("Istanbul! Basaarit, moskeijat ja kebabin tuoksu. Täällä jokainen on potentiaalinen jäsen.");
  });
}
async function toTemple() {
  await script(async () => {
    if (!st.flags.quest) return say("Miksi menisin itään? Sijoittajilla on ensin asiaa. Puhutaan Mehmetin kanssa.");
    if (!st.flags.map) return say("Pyramidin huippu on jossain idässä. Mutta missä? Jossain täällä on varmasti kartta.");
    await walkTo(160, 72); await travel("ist", "kap"); go("temppeli", 160, true, 128);
    if (!st.flags.refMet) {
      await say("Kappadokia. Kalliotorneja, luolia... ja tuolla! Korkea jalusta ja sen huipulla kultainen idoli.");
      await say("Isoisän pyramidin huippu. Ja tuleva kiertopalkinto.");
      await refereeAppears(); await myrraIncoming(2);
      await say("Turnaus tarvitsee tuomarin. Ja tuo tuomari näyttää tarvitsevan joukkueen. Jutellaan hänen kanssaan."); }

  });
}
function backToBazaar() { return script(async () => { await travel("kap", "ist"); go("basaari", 160, true, 74); }); }
function blocked() { return say("Tuomari seisoo kivipolulla. Hän ei päästä ketään ohi. Pitäisi jutella hänen kanssaan."); }
// Paineansa: ensimmäinen yritys paljastaa pulman, ja ratkaisun osat ovat jo nähtävillä.
async function discoverTrap() {
  await walkTo(160, 79);
  await say("Hetkinen. Jalusta liikahtaa, kun nojaan siihen. Paineansa! Jos idolin nostaa, jalusta nousee... ja jotain ikävää tapahtuu.");
  if (!st.flags.needWeight) { st.flags.needWeight = true; iq("ansa", 5); }
  await say(has("pussi") ? "Tarvitsen jotain yhtä painavaa vaihtoon. Pussi ja hiekka!" : "Tarvitsen jotain yhtä painavaa vaihtoon. Hiekkaa täällä on. Mutta millä sitä kantaa? Mehmetin kojussa roikkui nahkapusseja.");
}
async function grabIdol() {
  await script(async () => {
    take("sakki"); iq("idoli", 10); await say("Rauhallisesti... vaihdetaan sulavasti...");
    st.flags.idol = true; st.flags.swapped = true; give("idoli"); await sleep(600);
    await say("...", "muu"); await say("Jalusta painuu. Tietysti se painuu.");
    // Kivenjärkäle vyöryy oviaukosta katsojaa kohti (0 = oviaukko, 1 = ruudun reuna).
    st.flags.boulder = 0; await say("JUOKSE!");
    walkTo(22, 118);
    while (st.x > 28) { await sleep(30); st.flags.boulder = Math.min(1, st.flags.boulder + 0.0075); }
    st.flags.boulder = null;
    await travel("kap", "ist"); go("basaari", 160, true, 74); await say("Hengissä. Ja minulla on pyramidin huippu. Sijoittajat odottavat.");
  });
}

// Kaupanteko haukkumalla, kuten miekkailu Melee Islandilla: oikea vastaus kolmesti.
const BARGAIN = [
  { a: "Tuollaisella takilla et pääse edes Mikkelin torille!", ok: "Ja tuollaisilla hinnoilla et myisi edes Mikkelin torilla.", no: ["Ai.", "Takki on Liigan!"] },
  { a: "Äitini tinkii paremmin kuin sinä!", ok: "Ilmeisesti, koska hän ei ole koskaan ostanut sinulta mitään.", no: ["Terveisiä äidillesi.", "Minulla on kumikana väkipyörällä."] },
  { a: "Sinä maksaisit ennakkoon kenelle tahansa, joka puhuu italiaa!", ok: "Siksi tingin nyt turkiksi, enkä maksa mitään ennakkoon.", no: ["Grazie.", "Tarvitsen tulkin."] },
  { a: "Sinä et erottaisi döneriä iskenderistä!", ok: "Mutta erotan hyvän kaupan huonosta. Tällä kertaa.", no: ["Molemmat ovat kebabia.", "Saako valkosipulikastikkeella?"] },
  { a: "Tämä pussi kuului itse sulttaanille!", ok: "Sitten sulttaani ostaa sen takaisin kalliimmalla.", no: ["Wau.", "Katso takanasi, kolmipäinen kameli!"] },
];
async function talk() {
  await script(async () => {
    if (!st.flags.merhaba) { st.flags.merhaba = true;
      await say("Hoş geldiniz! Merhaba, ystäväni! Tervetuloa Mehmetin kojuun, Istanbulin rehellisimpään.", "kauppias");
      await say("Teşekkür... ederim? Opettelin sen lentokoneessa."); }
    // Keskustelu etenee yhtä polkua (17.10.): kuka olet -> suunnitelma ja sopimus -> lahja
    // (idoli) -> kartta -> luola (paineansa) -> pussi. Pussi tingitään Mehmetiltä, ja hinta
    // on Jussin vanha nimikyltti.
    while (true) {
      const f = st.flags, opts = [];
      if (has("idoli")) opts.push("Löysin pyramidin huipun!");
      if (!f.mehmetWho) opts.push("Mouho Global Partners? Kirjeessä luki teidän osoitteenne.");
      if (f.mehmetWho && !f.signed) opts.push("Esittelen jäsenhankintasuunnitelmani.");
      if (f.quest && !f.map && !f.askedMap) opts.push("Missä se Kappadokian luola on?");
      if (f.needWeight && !has("pussi") && !has("sakki") && !f.swapped) opts.push("Tarvitsen pussin. Idolin tilalle pitää laittaa hiekkaa.");
      if (!f.kebabQ) opts.push("Missä saa Istanbulin parhaan kebabin?");
      opts.push("Ei mitään, näkemiin.");
      const pick = opts[await choose(opts)]; await say(pick);
      if (pick.startsWith("Löysin")) return deliverIdol(true);
      if (pick.startsWith("Mouho Global")) { f.mehmetWho = true;
        await say("Ah, herra Markkanen, brändin mies! Mehmet, Mouho Global Partnersin johtaja. Serkkuni Lappeenrannassa kertoi teistä.", "kauppias");
        if (has("kirje") || has("kortti")) { take("kirje"); take("kortti"); await say("Mehmet ottaa kirjeen ja käyntikortin talteen. \"Paperit kuuluvat arkistoon, ystäväni.\"", "muu"); }
        await say("Se liituraitainen mies on serkkunne? Maailma on pieni. Ja pyramidin muotoinen.");
        await say("Näytä suunnitelma, ystäväni. Sijoittajat haluavat nähdä, mitä ostavat.", "kauppias"); continue; }
      if (pick.startsWith("Esittelen")) { await pitchPyramid(); continue; }
      if (pick.startsWith("Missä se")) { f.askedMap = true;
        await say("Isoisäni kutoi tien mattoon, ettei kukaan unohtaisi. Tuossa, seinällä vasemmalla. Katso tarkkaan.", "kauppias"); continue; }
      if (pick.startsWith("Tarvitsen pussin")) {
        await say("Paineansa! Isoisäni yritti samaa vaihtoa. Hänen nahkapussinsa on yhä tallessa. Mutta se ei ole ilmainen, ystäväni.", "kauppias");
        await say("Basaarissa hinnasta tingitään. Pärjää minulle tinkimisessä, niin sovitaan hinnasta.", "kauppias");
        if (await bargain()) return; continue; }
      if (pick.startsWith("Missä saa")) { f.kebabQ = true;
        await say("Täältä! Mehmetin kebab on Istanbulin paras. Serkun kioskin kebab on toiseksi paras. Mutta älä kerro hänelle.", "kauppias");
        await say("Hyvä kebab. Hyvä ruoka, kuten Jouko sanoi. Tämä voi vielä olla tärkeää."); continue; }
      await say("Palaa pian, ystäväni! Hinnat nousevat joka minuutti.", "kauppias"); return;
    }
  });
}
// Pyramidin esittely: Myrrä soittaa kesken ("älä maksa mitään etukäteen") ja Jussi
// allekirjoittaa velkakirjan -- jälkikäteen maksettava kebabtarjoilu Mouhoon.
async function pitchPyramid() {
  await say("Tässä, herra Mehmet. Jäsenhankinta: jokainen jäsen tuo kaksi uutta. Ja Mouho on kaikille ilmainen!");
  await say("Muhteşem! Ilmainen tuote, joka leviää itsestään. Ostamme sen. Koko brändin. Allekirjoita tähän.", "kauppias");
  await say("Kumppanuussopimus! Juuri sitä...");
  await myrraIncoming(1);
  await say("Luin sen, herra Mehmet. Kebabtarjoilu Mouhoon, maksetaan jälkikäteen. Allekirjoitan.");
  st.flags.signed = true; give("velkakirja"); iq("jalkikateen", 5);
  await say("Sopimuksen ensimmäinen sivu, jota Jussi ei lukenut: \"Mouho-brändin oikeudet siirtyvät Mouho Global Partnersille.\"", "muu");
  await say("Tarjoilu hoidettu! Tehtävälistassa on enää turnaus.");
  await questLines();
}
async function questLines() {
  st.flags.questHeard = true; st.flags.quest = true;
  await say("Vielä yksi asia, ystäväni. Basaarissa kauppa sinetöidään lahjalla. Ja minä tiedän, minkä lahjan haluan.", "kauppias");
  await say("Isoisäni puhui kultaisesta idolista Kappadokian luolassa. Pyramidin huippu, hän sanoi. Tuo se, niin kauppa on valmis.", "kauppias");
  await say("Pyramidin huippu! Ja kultainen. Siitä tulisi turnaukselle hieno kiertopalkinto.");
  await say(st.flags.map ? "Matossa oli kartta itään. Kappadokia." : "Mutta mistä löytää Kappadokian luolan? Kysytään Mehmetiltä.");
}
// Idoli basaariin: sijoittajat tyytyväisiä, ja peli siirtyy loppuanimaatioon.
async function deliverIdol(inScript) {
  const run = async () => {
    await say("Herra Mehmet! Pyramidin huippu. Suoraan Kappadokiasta, kivenjärkäleen edestä.");
    take("idoli"); await say("Isoisäni idoli! Kauppa on sinetöity. Mouho on nyt Mouho Global!", "kauppias");
    await say("Ja koska olemme nyt kumppaneita, annan sen takaisin. Mouho Globalin ensimmäisen turnauksen kiertopalkinnoksi!", "kauppias"); give("idoli");
    await say("Ja koko basaari tulee mukaan Mouhoon. Kebabit mukana. Helsinkiin!", "kauppias");
    st.flags.trophy = true;
    await say("Jäsenet, tarjoilu ja palkinto turnaukseen. Kaikki kolme tehtävää! Haastatteluun! Mitä voisi mennä vikaan?");
    iq("huippu", 5); await sleep(400); await ending();
  };
  return inScript ? run() : script(run);
}

async function bargain() {
  st.flags.crowd = true; await say("Tinkiminen alkaa! Koko basaari kokoontuu kuuntelemaan.", "muu");
  for (const b of BARGAIN) {
    await say(b.a, "kauppias");
    const opts = [...b.no, b.ok]; for (let k = opts.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [opts[k], opts[j]] = [opts[j], opts[k]]; }   // Fisher-Yates: sort-satunnaistus suosi kolmatta paikkaa
    const i = await choose(opts); await say(opts[i]);
    if (opts[i] === b.ok) { const n = BARGAIN.indexOf(b) + 1; beep(523 + n * 60, 140, "triangle", .05); if (n < BARGAIN.length) await say(`Osuma! Basaari kohahtaa. (${n}/${BARGAIN.length})`, "muu"); }
    if (opts[i] !== b.ok) { await say(opts[i].includes("kameli") ? "Mehmet ei käänny. Hän on nähnyt kolmipäisen kamelin. Kahdesti." : "Ha! Basaari nauraa. Palaa kun osaat tinkiä.", opts[i].includes("kameli") ? "muu" : "kauppias"); st.flags.crowd = false; return false; }
  }
  await say("...Sinä tinkaat kuin oma veljeni. Hyvä on. Mitä tarjoat pussista?", "kauppias");
  await say("Minulla on... nimikyltti. \"Jussi Markkanen, urheilujohtaja.\" Messinkiä.");
  await say("Kiiltävä kyltti, jossa lukee johtaja! Basaarissa sellainen on arvokas. Kauppa!", "kauppias");
  await say("Hyvästi, urheilujohtaja. Tervetuloa, toiminnanjohtaja. Melkein.");
  take("nimikyltti"); give("pussi"); iq("tinkiminen", 10);
  await say("Ja kaupan päälle kebab, ystäväni. Kukaan ei lähde Mehmetin kojulta nälkäisenä.", "kauppias"); give("kebab");
  // Tinkimisen voitto on jäsenhankintaa: basaari haluaa mukaan siihen, mitä tämä mies tekee.
  await say("Basaari huutaa! Kukaan ei ole ennen pärjännyt Mehmetille tinkimisessä. Ja kaikki haluavat liittyä siihen, mitä tämä mies tekee.", "muu");
  st.flags.recruits = (st.flags.recruits ?? 0) + 40; st.flags.bazaar = true; iq("basaari", 5);
  await say("Neljäkymmentä uutta jäsentä! Ja isoisän nahkapussi. Takaisin luolaan hakemaan hiekkaa!");
  return true;
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
  [["myrra", "Jussi. Kuulin että Mouhossa on täysi tupa. Mitä sinä nyt teet?"],
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
    if (st.flags.billReturned && !st.flags.recruits) { await say("Ja hetkinen... ne kaksi peukkua toimiston ikkunassa! Kirjoitan heille kutsun postiluukkuun.");
      st.flags.thumbT = Date.now(); beep(523, 120, "triangle", .05); setTimeout(() => beep(784, 200, "triangle", .05), 140);
      await sleep(500); await say("Ikkunasta nousee taas kaksi peukkua.", "muu"); await recruitSaarni(); }
    else if (st.flags.recruits) await say("Herra Saarni ja maskotti ovat jo mukana. Merkitsen heidät huipun alle."); }
}

// ---------------------------------------------------------------- Kisapuisto: seteli, ilmoitus, taustakohtaus
// Seteli lepattaa tuulessa ja karkaa, kun Jussi tulee lähelle. Laatikon päältä tuulenpuuska
// tuo sen käteen. Jussi palauttaa sen SaiPan postiluukusta (käyttäjä 17.10.: "palauttaa").
const BILL_SPOTS = [[204, 104], [174, 118], [226, 116], [120, 106], [196, 94], [82, 116]];
const BILL = { x: 204, y: 104, tx: 204, ty: 104, i: 0, fly: null };
function drawBill(t) {
  if (!st.flags.billOut || st.flags.billCaught) return;
  BILL.x += (BILL.tx - BILL.x) * .06; BILL.y += (BILL.ty - BILL.y) * .06;
  const pinned = st.flags.billStuck && Math.hypot(BILL.x - BOARD_SPOT[0], BILL.y - BOARD_SPOT[1]) < 2;
  const f = Math.sin(t / 90) * (pinned ? .3 : 1), y = BILL.y - 6 - (pinned ? 0 : Math.abs(Math.sin(t / 300)) * 4);
  if (!pinned) shadow(BILL.x, BILL.y, 3);
  g.save(); g.translate(BILL.x, y); g.rotate(f * .5); g.scale(1, pinned ? 1 : .5 + .5 * Math.abs(Math.cos(t / 140)));
  r(-4, -2, 8, 4, "#c8a87c"); r(-4, -2, 8, 1, "#e8d0a8"); r(-1, -1, 2, 2, "#8c6c4c"); g.restore();
  if (pinned) { px(BILL.x - 3, y - 2, "#c81c1c"); px(BILL.x - 3, y - 3, "#fc5c5c"); }               // nasta
}
// 17.10.: ensimmäinen Poimi -- tuulenpuuska vie setelin ilmoitustauluun nastan alle; toinen
// Poimi -- seteli käteen, ja samalla Jussi huomaa Mouhon ilmoituksen (käyttäjän idea: seteli
// ohjaa ilmoitustaululle). Laatikon päältä saa yhä heti.
const BOARD_SPOT = [44, 104];
function gust() { st.flags.billStuck = true; [BILL.tx, BILL.ty] = BOARD_SPOT; beep(220, 300, "triangle", .03); }
async function chaseBill() {
  if (st.flags.billStuck) {            // toinen yritys: seteli ilmoitustaululta käteen
    await walkTo(72, 131); st.dir = -1; await sleep(200);             // taulun oikealla ja edessä, ei sen takana
    st.flags.billCaught = true; give("seteli"); iq("seteli", 5);
    await say("Sain sen! Herra Saarnin viisikymppinen on nyt tavaroissani.");
    await say("Se ei ole minun. Herra Saarni meni SaiPan toimistoon. Palautan sen toimiston postilaatikkoon. Se on keltaisen oven vieressä.");
    if (!st.flags.adRead) await say("Ja hetkinen... taululla on uusi ilmoitus Mouho-logon alla. Työpaikkailmoitus? Luen sen.");
    return;
  }
  gust(); await say("Melkein! Tuulenpuuska vei sen viime hetkellä... suoraan ilmoitustauluun, nastan alle. Siellä se nyt lepattaa.");
}
async function standOnBox() {
  if (!st.flags.billOut || st.flags.billCaught) return say("Seison laatikolla hetken. Näköala on sama, mutta ylempää.");
  await walkTo(104, 128); st.hop = performance.now(); await sleep(260);
  await say("Ylös laatikon päälle. Toiminnanjohtaja seisoo aina vähän muita korkeammalla.");
  BILL.tx = st.x + 4; BILL.ty = st.y - 20; beep(300, 400, "triangle", .03); await sleep(900);
  st.flags.billCaught = true; give("seteli"); iq("seteli", 5);
  await say("Tuulenpuuska toi sen suoraan käteen! Tuuli on puolellani. Tänään ensimmäistä kertaa.");
}
// Palautus sitoo setelin juoneen: lapussa mainos Mouhosta, ikkunasta kaksi peukkua -- Jussin
// mielestä pyramidin kaksi ensimmäistä jäsentä (Saarni ja maskotti). He tulevat loppuun.
// Jussi tietää Mouhosta vasta ilmoitustaulun jälkeen (käyttäjä 17.10.: logiikkavirhe), joten
// P.S. ja liittymistulkinta vain kun ilmoitus on luettu; muuten peukut ovat pelkkä kiitos.
async function returnBill() {
  take("seteli"); st.flags.billReturned = true; iq("rehellisyys", 10);
  const ps = st.flags.adRead ? "\nP.S. Mouho hakee jäseniä!" : "";
  await say(`Kirjoitan lapun: "Herra Saarnille. Putosi parkkipaikalle. -- J.M.${ps}"\nJa postiluukusta sisään.`);
  st.flags.thumbT = Date.now(); beep(523, 120, "triangle", .05); setTimeout(() => beep(784, 200, "triangle", .05), 140);
  await sleep(500); await say("Toimiston ikkunasta nousee kaksi peukkua. Iso valkoinen ja pieni liituraitainen.", "muu");
  await sleep(300); beep(400, 80, "square", .04); await say("Postiluukusta tipahtaa lappu takaisin.", "muu"); give("lappu");
  if (st.flags.adRead) { await say("\"Kiitos, rehellistä. Mouho kuulostaa hauskalta. Ollaan mukana. -M.S.\""); await recruitSaarni(); }
  else { st.flags.noteHint = true;
    await say("\"Kiitos, rehellistä. Kuulin että etsit töitä. Ilmoitustaululla on paikka, joka sopii sinulle. -M.S.\"");
    await say("Herra Saarni itse! Työpaikka ilmoitustaululla. Rehellisyys kannattaa. Joskus."); }
}
async function recruitSaarni() {
  st.flags.recruits = Math.max(st.flags.recruits ?? 0, 2); iq("ensimmaiset", 5);
  await say("Kaksi peukkua! Herra Saarni ja maskotti liittyivät Mouhoon. Jäsenhankinnan kaksi ensimmäistä jäsentä!");
  await say(st.flags.pyramid ? "Merkitsen heidät kaavioon. Jokainen tuo kaksi uutta. Tämä toimii jo." : "Merkitsen heidät muistiin. Kun minulla on suunnitelma, he ovat ensimmäisinä siinä.");
}
async function salesmanBill() {
  await say("Ah, seteli! Annahan se tänne, välitän sen eteenpäin. Ammattilaisena.", "salkkumies");
  await say("Ei kiitos. Se menee suoraan postiluukusta. Olen oppinut jotain.");
}
function moneyTrail(t) {          // salkusta lepattavat setelit Saarnin kävellessä
  if (!st.flags.saarniHere || !SAARNI.moving) return;
  for (let i = 0; i < 3; i++) { const k = ((t / 700 + i / 3) % 1), x = SAARNI.x - 6 - k * 22, y = SAARNI.y - 14 + k * 12 + Math.sin(t / 80 + i) * 2;
    g.save(); g.translate(x, y); g.rotate(Math.sin(t / 90 + i) * .6); r(-3, -1, 6, 3, "#c8a87c"); r(-3, -1, 6, 1, "#e8d0a8"); g.restore(); }
}
function thumbsUp() {             // maskotin peukku toimiston ikkunassa setelin palautuksen jälkeen
  const s = st.flags.thumbT ? (Date.now() - st.flags.thumbT) / 1000 : 9; if (s > 3) return;
  const up = Math.min(1, s * 3), y = 74 - up * 8;
  r(213, 66, 8, 6, "#ffd890"); r(215, y, 4, 6, "#f4f4f4"); r(216, y - 3, 2, 3, "#f4f4f4"); r(214, y + 5, 6, 2, "#1c1c22");
  const y2 = 75 - Math.min(1, Math.max(0, s - .3) * 3) * 6; r(229, y2, 3, 4, "#dca482"); r(230, y2 - 2, 1, 2, "#dca482"); r(228, y2 + 4, 5, 2, "#1c2444");   // Saarnin peukku
}
async function readAd() {
  if (st.flags.adRead) return say("\"MOUHO hakee toiminnanjohtajaa. Tehtävät: turnauksen järjestäminen, jäsenten hankinta, tarjoilu. Haastattelut Mouho-illassa, Kaivokatu 10, 22.5.\"");
  st.flags.adRead = true; iq("ilmoitus", 3); give("ilmoitus");
  await say("Ilmoitustaululla on uusi lappu Mouho-logon alla:");
  await say("\"MOUHO hakee TOIMINNANJOHTAJAA. Tehtävät: turnauksen järjestäminen, jäsenten hankinta, tarjoilu. Haastattelut Mouho-illassa, Kaivokatu 10, 22.5. Osallistuminen Mouhoon kaikille ilmaista.\"", "muu");
  await say("Toiminnanjohtaja! Turnauksia, jäseniä ja tarjoilua. Olen tehnyt näitä kaikkia. Tai ainakin katsonut vierestä.");
  await say("Mutta hakijoita on varmasti satoja. Miten minä erotun joukosta? Tarvitsen neuvoa joltakulta viisaalta.");
  await say("Soitan Joukolle. Hänen numeronsa on kännykässä pikavalinnassa ykkösenä.");
}
// Taustakohtaus intron aikana: Saarni ja maskotti autolta toimistoon, seteleitä lentää.
// Vuorotellen (17.10.: "menee päällekkäin puheruutujen kanssa"): Jussi puhuu ensin, he
// kävelevät hiljaa ja pysähtyvät vasemmalle Jussin kuplan alta pois, Saarni puhuu, sitten ovelle.
async function saarniScene() {
  await say("Mitä minä nyt teen? Tarvitsen uuden työn. Tänään. Liigan pitää nähdä, että Markkanen nousee.");
  await say("Koiranulkoiluttaja? Koira ulkoiluttaisi minua.");
  Object.assign(SAARNI, { x: 84, y: 91 }); Object.assign(MASKOTTI, { x: 72, y: 92 });   // punaisen auton vierestä (sokkotesti 2) st.flags.saarniHere = true; beep(90, 80, "square", .05);
  await say("Autosta nousevat Jokereiden puheenjohtaja Mikko Saarni ja Jokerit-maskotti.", "muu");
  await sleep(300);
  await Promise.all([walkActor(SAARNI, 124, 90, 1), walkActor(MASKOTTI, 106, 91, 1)]);
  st.flags.billOut = true; [BILL.x, BILL.y] = [SAARNI.x - 6, SAARNI.y - 16]; [BILL.tx, BILL.ty] = BILL_SPOTS[0];
  SAARNI.dir = -1;
  await say("Aho on taas tehnyt sen. Liigan heittopussista kärkijoukkue, ja pelaajat löytyvät kuin tyhjästä.", "saarni");
  await say("Hyvää kannattaa ostaa sieltä, missä sitä tehdään. Jokerit haki aikanaan Otakar Janeckýn SaiPasta. Katso mitä siitä seurasi.", "saarni");
  await say("Maskotti iskee silmää. Se iskee silmää aina.", "muu");
  await Promise.all([walkActor(SAARNI, 224, 86, 1.3), walkActor(MASKOTTI, 210, 87, 1.3)]);
  beep(140, 120, "square", .04); st.flags.saarniHere = false;
  await sleep(300);
  await say("Pitkävetovalmentaja? Ei, se vaatisi, että voittaisin.");
  await say("Hetkinen. Herra Saarnin salkusta putosi jotain. Tuolla lentää viisikymppinen!");
  st.flags.introDone = true;
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
for (const ev of ["click", "contextmenu", "keydown"]) document.addEventListener(ev, () => { lastProgress = performance.now(); }, true);
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
function guideKisa(t) {
  const f = st.flags; if (!f.introDone) return;
  if (f.billOut && !f.billCaught) sparkle(BILL.x + 5, BILL.y - 10, t, 1, 2000);
  if (!f.adRead) { sparkle(30, 92, t, 2, f.noteHint ? 1400 : 3200); if (f.noteHint) sparkle(44, 100, t, 5, 1400); }
  if (f.pyramid && !f.mgp) bark(184, 54, "Psst! Markkanen! Onko suunnitelma jo valmis?", t, 3, 7000);
  if (f.unlocked && !f.letterTaken) sparkle(233, 72, t, 4, 1600);
  if (f.pianoT && !f.unlocked) codePanel(entered.koti ?? []);
  if (has("lippu")) { bark(280, 86, "TÖÖT!", t, 8, 11000, 1400); const k = (t + 8 * 1301) % 11000; if (!busy && k < 30) beep(330, 140, "square", .02); }
}
// Lattiapianon palaute (sokkotesti 2: numerolle astuminen ei näyttänyt mitään): tähän asti
// tallotut numerot taulussa parkkipaikan reunassa.
function codePanel(e) {
  r(138, 118, 44, 11, "#0c0c14"); r(139, 119, 42, 9, "#1c2440");
  for (let k = 0; k < 4; k++) { const d = e[k]; if (d) text3(d, 144 + k * 9, 121, "#fcd41c"); else r(144 + k * 9, 125, 3, 1, "#7c8cac"); } }
function guideBasaari(t) {
  const f = st.flags;
  if (!f.merhaba) bark(258, 46, "Merhaba, ystäväni! Täällä!", t, 1, 6000);
  else if (has("idoli")) bark(258, 46, "Aarre?! Tuo se tänne!", t, 2, 6000);
  else if (f.mehmetWho && !f.signed) bark(258, 46, "Se kaavio, ystäväni! Näytä!", t, 3, 8000);
  else if (f.needWeight && !has("pussi") && !has("sakki") && !f.swapped) bark(258, 46, "Pussi? Pusseista tingitään, ystäväni!", t, 4, 9000);
  if (f.quest && !f.map) sparkle(33, 70, t, 5, 1800);
  if (f.needWeight && !has("pussi") && !has("sakki") && !f.swapped) sparkle(285, 70, t, 6, 2200);
  if (f.quest && f.map && (!f.needWeight || has("pussi") || has("sakki")) && !has("idoli")) sparkle(160, 52, t, 8, 1600);
}
function guideTemppeli(t) {
  const f = st.flags;
  if (f.refHere && f.myrra2 && !f.refRecruited) bark(203, 58, f.refWho ? "Joukkue, sanoit...?" : "Hmph. Kukaan ei kysy, kuka minä olen.", t, 1, 8000);
  if (f.refHere && !f.refRecruited) sparkle(203, 70, t, 6, 2000);
  if (f.refRecruited && !f.needWeight && !f.idol) sparkle(160, 54, t, 2, 2400);
  if (has("pussi")) sparkle(54, 120, t, 3, 1800);
  if (has("sakki")) sparkle(160, 54, t, 4, 1600);
  if (has("idoli")) sparkle(11, 96, t, 5, 1400);
}

// Kohde nimellä, ei indeksillä: uusi kohde ruudun alkuun siirsi indeksit kerran.
const spot = (room, id) => ROOMS[room].spots.find((p) => p.id === id);

// ---------------------------------------------------------------- Raimo Helminen (SaiPan valmentaja)
// Onnistuneen Ilves-visan jälkeen: tulee hallin ovesta, onnittelee, kuittaa Saarnista ja palaa.
async function raimoCameo() {
  Object.assign(RAIMO, { x: 158, y: 84 }); st.flags.raimo = true; beep(140, 100, "square", .04);
  await say("Hallin ovesta astuu ulos SaiPan päävalmentaja Raimo Helminen. Hän kuuli numerot sisälle asti.", "muu");
  await walkActor(RAIMO, Math.max(110, Math.min(200, st.x - 26)), Math.min(118, Math.max(92, st.y - 4)), 1.3); st.dir = -1;
  await say("Oikein! Ilves, 1985. Minä olin siellä, Markkanen.", "helminen");
  await say("Raimo Helminen?! SaiPan valmentaja!");
  await say("Ja jos näet Saarnin, sano ettei meillä ole enää ketään myytävänä.", "helminen");
  await say("Treenit alkaa.", "helminen");
  await walkActor(RAIMO, 158, 84, 1.6); st.flags.raimo = false;
  await say("...Ja hän oli poissa. Kukaan ei usko tätä Mouhossa.");
}

// ---------------------------------------------------------------- lattiapiano (Kisapuisto)
// Ilves voitti viimeksi Suomen mestaruuden 1985. Koodi kirjautuu pysähtymisistä.
const NOTE = { 1: 262, 2: 294, 3: 330, 4: 349, 5: 392, 6: 440, 7: 494, 8: 523, 9: 587, 0: 659 };
// Lattiavisat: sama mekaniikka kolmessa ruudussa, koodi ja palkinto ruutukohtaisia.
const QUIZZES = {
  koti: { code: "1985", done: () => st.flags.unlocked, taunt: "salkkumies",
    lines: ["Hah! Väärin. Sijoittajat merkitsevät tämän muistiin.", "Ei se mennyt noin. Olitko oikeasti urheilujohtaja?", "Väärä vuosi. Ilveksen kannattajat itkevät."],
    solve() { st.flags.unlocked = true; iq("piano", 10); script(async () => { await sleep(700); await say("1985. Pätevyys todistettu. Sijoittajat jättivät teille kirjeen postilaatikkoonne.", "salkkumies"); await say("Kirje? Minulle? Joku on tänään pitänyt minua pätevänä."); await say("Ilves, 1985. Viimeinen mestaruus. Jotkut asiat eivät unohdu. Toiset eivät toistu.");
      st.flags.ghostT = Date.now(); [196, 247, 294, 392].forEach((f, n) => setTimeout(() => beep(f, 600, "sine", .05), n * 220)); await sleep(3300); await raimoCameo(); }); } },
  basaari: { code: "2006", done: () => st.flags.cupDone, taunt: "kauppias",
    lines: ["Ei, ei, ystäväni. Maalivahti muistaisi.", "Väärä vuosi! Tuollaisella muistilla et pääse edes Galatan sillalle.", "Hmm. Ehkä sinä olit vain katsomossa."],
    solve() { st.flags.cupDone = true; iq("stanley", 10); script(async () => {
      await sleep(700); await say("Çok güzel! 2006! Stanley Cupin finaali! Sinä todella olit maalivahti!", "kauppias");
      st.flags.cupT = Date.now(); [262, 330, 392, 523].forEach((f, n) => setTimeout(() => beep(f, 500, "sine", .05), n * 200)); await sleep(1600);
      await say("MARK-KA-NEN! MARK-KA-NEN!", "muu"); await sleep(1500);
      await say("Kesä 2006. Jotkut asiat eivät unohdu. Edes Istanbulissa.");

      if (!has("kebab")) { await say("Tästä hyvästä kebab on ilmainen, ystäväni. Maalivahdit tarvitsevat proteiinia.", "kauppias"); give("kebab"); } }); } },
};
const entered = {};
function quizStep(k) {
  const Q = QUIZZES[st.scene];
  if (!k || !Q || !st.flags[quizFlag()]) return;
  lastKey = { k, t: performance.now() }; beep(NOTE[k], 260);
  if (Q.done()) return;
  const e = (entered[st.scene] ??= []); e.push(k);
  if (e.join("") === Q.code) { entered[st.scene] = []; [523, 659, 784, 1047].forEach((f, n) => setTimeout(() => beep(f, 180, "triangle", .08), 200 + n * 140)); Q.solve(); }
  else if (!e.every((c, n) => c === Q.code[n])) {               // väärä: summeri, ja alusta (ensimmäinen numero aloittaa uuden)
    setTimeout(() => beep(110, 300, "sawtooth", .05), 280); entered[st.scene] = k === Q.code[0] ? [k] : [];
    if (!busy) script(() => say(Q.lines[Math.floor(Math.random() * Q.lines.length)], Q.taunt));
  }
}
// Temppelin erotuomari: ilmestyy ensikäynnillä; Jussi värvää hänet turnauksen tuomariksi.
async function refereeAppears() {
  st.flags.refMet = true; st.flags.refHere = true; beep(2200, 200, "square", .05); await sleep(300);
  await say("Pilli soi kammiossa. Reliefin eteen materialisoituu läpikuultava erotuomari.", "muu");
  await say("Seis! Kukaan ei kulje tätä kivipolkua. Olen vartioinut sitä kaksituhatta vuotta.", "tuomari");
  await say("Kaksituhatta vuotta? Miksi?");
  await say("Koska kukaan ei ole tullut pelaamaan. Vartiointi on ainoa peli, joka minulle jäi.", "tuomari");
}
// Jussi värvää tuomarin (Myrrä: "tärkeintä on joukkue").
function refereeTalk() {
  return script(async () => {
    const f = st.flags, opts = [];
    if (!f.refWho) opts.push("Kuka sinä olet? Ja miksi luolassa?");
    if (f.refWho && f.myrra2 && !f.refRecruited) opts.push("Liity Mouhoon! Joukkue tarvitsee tuomarin.");
    opts.push("Ei mitään.");
    const pick = opts[await choose(opts)]; await say(pick);
    if (pick.startsWith("Kuka")) { f.refWho = true;
      await say("Olin muinaisten pelien erotuomari. Kaksituhatta vuotta sitten vihelsin viimeisen pelin, ja kaikki lähtivät kotiin.", "tuomari");
      await say("Minä jäin. Kukaan ei kutsunut minua enää mihinkään joukkueeseen.", "tuomari"); }
    else if (pick.startsWith("Liity")) await recruitReferee();
  });
}
async function recruitReferee() {
  if (st.flags.refRecruited) return;
  await say("Kaksituhatta vuotta olen vihellellyt tässä luolassa yksin. Ja nyt joku tarjoaa joukkuetta.", "tuomari");
  await say("Kyllä. Tulen viheltämään turnauksenne. Näen kaiken, paitsi paitsiot.", "tuomari");
  st.flags.refRecruited = true; st.flags.recruits = (st.flags.recruits ?? 0) + 1; iq("tuomarivarvays", 5);
  beep(2200, 160, "square", .05);
  await say("Tuomari viheltää ja liukuu sivuun. Kivipolku idolin luo on vapaa.", "muu");
  await say("Turnauksella on tuomari! Ja jäsenhankinta ulottuu nyt tuonpuoleiseen.");
}

// ---------------------------------------------------------------- salkkumies (Kisapuisto)
// Ennen pyramidia: kysyy otteluohjelmasta. Pyramidin jälkeen: "Mouho Global Partners" --
// turkkilaisten sijoittajien edustaja, jonka pätevyystesti on Ilveksen 1985 lattiapiano.
function showChartToSalesman() { return script(async () => { await say("Katsokaa: jäsenhankintasuunnitelmani Mouholle!"); await mgpReveal(); }); }
async function mgpReveal() {
  st.flags.mgp = true;
  await say("Edustan turkkilaisia sijoittajia. Ostamme lupaavia brändejä. Tuo kaavio... kasvusuunnitelma? Minkä brändin?", "salkkumies");
  await say("Mouhon! Olen sen tuleva toiminnanjohtaja. Melkein.");
  await say("Ilmainen tuote, joka leviää itsestään... Mouho Global Partners. Kuulostaa kansainväliseltä.", "salkkumies");
  await say("Kansainvälinen jäsenhankinta! Jouko sanoi: ole proaktiivinen. Tämä on niin proaktiivista kuin olla voi.");
  if (!has("kortti")) { await say("Käyntikorttini. Kultareunus, huomaatte.", "salkkumies"); give("kortti"); }
}
async function salesmanTalk() {
  // Keskustelu ensin yleisesti (17.10.): toimintavaihtoehdot avautuvat vasta, kun on kysytty
  // kuka hän on -- ja hän paljastuu sijoittajien edustajaksi vasta, kun Jussilla on pyramidi.
  await script(async () => {
    if (!st.flags.metSales) { st.flags.metSales = true;
      await say("Psst! Markkanen! Onko otteluohjelma jo valmis? Meidän porukka varasi lauantaille saunan.", "salkkumies"); }
    while (true) {
      const f = st.flags, opts = [];
      // Sokkotesti: uusi sisältö sai olla harmaan, jo kysytyn vaihtoehdon takana. Pyramidin jälkeen
      // vaihtoehto on uusi ja eri sanoin, ja kaavion antaminen avaa saman keskustelun.
      if (!f.mgp && !f.pyramid && !f.salesWho) opts.push("Kuka te oikeastaan olette?");
      if (!f.mgp && f.pyramid) opts.push("Katsokaa: jäsenhankintasuunnitelmani Mouholle!");
      if (!f.salesSchedule) opts.push("Otteluohjelma? En ole enää urheilujohtaja.");
      if (f.mgp && !f.unlocked) opts.push("Mitä sijoittajat haluavat?");
      if (f.mgp && f.adRead && !f.salesFree) opts.push("Mouho on muuten ilmainen. Kenellekään ei makseta mitään.");
      if (f.billCaught && !f.billReturned) opts.push("Löysin viisikymppisen. Se ei ole minun.");
      opts.push("Näkemiin.");
      const pick = opts[await choose(opts)]; await say(pick);
      if (pick.startsWith("Kuka te")) { f.salesWho = true;
        await say("En ole herra Saarni, jos sitä mietitte. Hän meni toimistoon. Minä olen liikemies.", "salkkumies");
        await say("Odotan oikeaa ihmistä, jolla on oikea suunnitelma. Teillä ei vielä ole. Kun on, näyttäkää se minulle.", "salkkumies"); continue; }
      if (pick.startsWith("Katsokaa")) { f.mgp = true;
        await mgpReveal(); }
      else if (pick.startsWith("Mitä sijoittajat")) {
        await say("Sijoittajat neuvottelevat vain pätevän henkilön kanssa. Entinen urheilujohtaja, sanotte?", "salkkumies");
        await say("Milloin Ilves voitti viimeksi Suomen mestaruuden? Tassuttele se vuosi asfalttiin. Oikeasta vastauksesta sijoittajat kutsuvat teidät neuvottelemaan.", "salkkumies");
        f.pianoT = Date.now(); [262, 330, 392, 523, 659].forEach((fq, n) => setTimeout(() => beep(fq, 150, "triangle", .06), n * 110));
        await sleep(1100); await say("...Asfalttiin ilmestyi numeroita. Tämä kaupunki ei lakkaa yllättämästä.");
        await say("Kuin siinä Tom Hanksin elokuvassa. Tarvitsee vain seistä oikeilla numeroilla oikeassa järjestyksessä."); return; }
      else if (pick.startsWith("Otteluohjelma")) { f.salesSchedule = true;
        await say("Ai. No siirtyykö se lauantain peli? Kysyn vain varmuuden vuoksi. Ja sunnuntain. Ja ensi kuun.", "salkkumies");
        await say("Kaikki ottelut pelataan suunnitellusti. Luulisin. Älä lainaa minua."); }
      else if (pick.startsWith("Mouho on muuten")) { f.salesFree = true; iq("ilmainen", 3);
        await say("Ilmainen... ja silti jäseniä tulee? Brändi, jota ei tarvitse myydä kenellekään. Sijoittajat rakastavat tätä.", "salkkumies");
        await say("Niin minäkin ajattelin. Tai siis, en ajatellut, mutta nyt kun sanoit."); }
      else if (pick.startsWith("Löysin")) await salesmanBill();
      else { await say("Soittele! Ja jos kuulet otteluohjelmasta, kerro minullekin.", "salkkumies"); return; }
    }
  });
}


// ---------------------------------------------------------------- vihjeet
// "Vihje"-nappi ja minuutin toimettomuus: seuraava askel tilan mukaan, ensin vihjaten,
// toisella kerralla suoraan. Kukaan ei jää jumiin (käyttäjä 16.10.).
const HINTS = () => {
  const f = st.flags, here = st.scene;
  if (here === "koti") {
    if (f.billOut && !f.billCaught) return f.billStuck ? ["Seteli jäi kiinni ilmoitustauluun.", "Poimi seteli ilmoitustaululta."] : ["Tuolla lentää jonkun viisikymppinen.", "Poimi seteli parkkipaikalta."];
    if (f.billCaught && !f.billReturned) return ["Seteli kuuluu Saarnille. Hän meni SaiPan toimistoon, ja oven vieressä on postilaatikko.", "Valitse Käytä, klikkaa seteliä tavaroissa ja sitten toimiston postilaatikkoa oven vieressä."];
    if (!f.adRead) return [f.noteHint ? "Saarnin lappu sanoi, että ilmoitustaululla on minulle sopiva paikka." : "Setelin vieressä ilmoitustaululla oli uusi ilmoitus.", "Katso ilmoitustaulua vasemmalla."];
    if (!f.pyramid) return ["Tarvitsen neuvoa. Joukon numero on kännykässä.", "Valitse Käytä ja klikkaa kännykkää tavaroissa: soita Myrrälle."];
    if (!f.unlocked && !f.pianoT) return [f.mgp ? "Mouho Global Partners on kiinnostunut. Mitä sijoittajat oikein haluavat?" : "Liituraitamies pyysi näyttämään suunnitelman, kun minulla on sellainen.", f.mgp ? "Puhu salkkumiehelle ja kysy, mitä sijoittajat haluavat." : "Näytä pyramidikaavio salkkumiehelle (Anna kaavio, tai Puhu)."];
    if (!f.unlocked) return ["Ilves on Tampereelta. Viimeisin mestaruus tuli 80-luvulla. Numerot ovat asfaltissa.", "Kävele asfaltin numeroille 1, 9, 8 ja 5, tässä järjestyksessä."];
    if (!f.letterTaken) return ["Sijoittajat jättivät kirjeen postilaatikkoon.", "Avaa postilaatikko ja poimi kirje."];
    if (!has("lippu")) return ["Kirjeessä voi olla muutakin kuin sanoja.", "Katso kirjettä: oikea painike kirjeen kuvaan tavaroissa."];
    return ["Kaikki on valmista. Lentokenttä kutsuu.", "Käytä taksia oikealla."];
  }
  if (here === "basaari") {
    if (has("idoli")) return ["Sijoittajat odottavat lahjaa.", "Anna kultainen idoli Mehmetille."];
    if (!f.mehmetWho) return ["Kirjeen osoite vei tähän kojuun. Kysytään kauppiaalta Mouho Global Partnersista.", "Puhu Mehmetille ja kysy Mouho Global Partnersista."];
    if (!f.signed) return ["Mehmet haluaa nähdä suunnitelmani.", "Puhu Mehmetille ja esittele jäsenhankintasuunnitelma."];
    if (!f.map) return ["Mehmetin isoisä kutoi tien luolaan mattoon.", "Katso mattoa vasemmalla seinällä."];
    if (f.needWeight && !has("pussi") && !has("sakki") && !f.swapped) return ["Idolin tilalle tarvitaan hiekkaa, ja hiekalle pussi. Mehmetin pusseista pitää tinkiä.", "Puhu Mehmetille pussista ja pärjää tinkimisessä: vastaa piikkiin samalla mitalla."];
    return ["Kartan mukaan luola on idässä.", "Kävele kadun päähän moskeijan alle."];
  }
  if (here === "temppeli") {
    if (f.idol) return ["Ulos ja äkkiä.", "Mene ovesta vasemmalle."];
    if (!f.refWho) return ["Tuomari vartioi kivipolkua. Kukaan ei näytä koskaan kysyneen, kuka hän on.", "Puhu tuomarille ja kysy, kuka hän on."];
    if (!f.refRecruited) return ["Jouko sanoi: tärkeintä on joukkue. Ja turnaus tarvitsee tuomarin.", "Puhu tuomarille ja pyydä häntä liittymään Mouhoon."];
    if (!f.needWeight) return ["Idoli on korkealla jalustalla. Mennään katsomaan.", "Poimi idoli jalustalta."];
    if (has("sakki")) return ["Hiekkasäkki on yhtä painava kuin idoli. Vaihto sulavasti.", "Käytä hiekkasäkkiä idoliin."];
    if (has("pussi")) return ["Pussiin pitää saada hiekkaa.", "Käytä nahkapussia hiekkaan (vasemmalla edessä)."];
    return ["Hiekkaa täällä on, mutta millä sitä kantaa? Mehmetillä oli pusseja.", "Mene basaariin ja tingi Mehmetiltä pussi."];
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

// ---------------------------------------------------------------- tavarakuvakkeet (24 x 16)
ITEMS.kirje.icon = () => { r(2, 2, 20, 13, "#d8b030"); r(3, 3, 18, 11, "#f4ecd8"); r(3, 3, 18, 1, "#fcfcfc"); for (let k = 0; k < 9; k++) { px(3 + k, 4 + k / 2, "#a8a8a8"); px(20 - k, 4 + k / 2, "#a8a8a8"); } disc(12, 9, 2, "#c81c1c"); };
ITEMS.lippu.icon = () => { r(2, 4, 20, 9, "#3c7cdc"); r(2, 4, 20, 1, "#7cacfc"); r(15, 4, 1, 9, "#fcfcfc"); r(4, 7, 9, 1, "#fcfcfc"); r(4, 9, 6, 1, "#c8dcfc"); r(17, 6, 3, 2, "#fcd41c"); };
ITEMS.nimikyltti.icon = () => { r(3, 5, 18, 7, "#c8a030"); r(3, 5, 18, 1, "#f8e070"); r(3, 11, 18, 1, "#8c6c1c"); r(5, 7, 14, 1, "#3c2c10"); r(5, 9, 9, 1, "#5c4c20"); };
ITEMS.pussi.icon = () => { disc(12, 10, 5, "#8c5428", "#6c3c1c"); r(9, 4, 6, 3, "#7c4824"); r(8, 6, 8, 1, "#e8c81c"); px(16, 6, "#e8c81c"); px(17, 7, "#e8c81c"); px(10, 9, "#b07440"); px(11, 8, "#b07440"); };
ITEMS.sakki.icon = () => { disc(12, 10, 5, "#c8b48c", "#a8946c"); r(10, 2, 4, 4, "#a8946c"); px(9, 9, "#e0d0a8"); r(6, 13, 12, 1, "#8c7850"); };
ITEMS.kortti.icon = () => { r(3, 4, 18, 9, "#f4f0e4"); r(3, 4, 18, 1, "#fff"); r(5, 6, 6, 1, "#2c2c3c"); r(5, 8, 10, 1, "#8c8c8c"); r(5, 10, 8, 1, "#8c8c8c"); r(16, 6, 3, 3, "#c8a030"); };
ITEMS.kebab.icon = () => { r(4, 5, 16, 8, "#e8c88c"); r(4, 5, 16, 1, "#f8e0a8"); r(6, 6, 12, 4, "#8c4c24"); r(7, 6, 3, 1, "#5c9c3c"); r(13, 7, 3, 1, "#c83c2c"); r(10, 8, 4, 1, "#f4f4ec"); r(4, 12, 16, 1, "#c8a46c"); };
ITEMS.seteli.icon = () => { r(3, 4, 18, 9, "#c8a87c"); r(3, 4, 18, 1, "#e8d0a8"); r(5, 6, 14, 5, "#b4946c"); disc(12, 8, 2, "#8c6c4c"); r(4, 5, 3, 2, "#e8d0a8"); r(17, 10, 3, 2, "#e8d0a8"); };
ITEMS.ilmoitus.icon = () => { r(5, 1, 14, 15, "#f4f0e4"); r(5, 1, 14, 4, "#c81c1c"); r(7, 2, 10, 1, "#fce8c8"); for (let k = 0; k < 4; k++) r(7, 7 + k * 2, 8 + (k % 2) * 2, 1, "#6c6c6c"); px(18, 1, "#c8c8c8"); };
ITEMS.kaavio.icon = () => { r(5, 1, 14, 15, "#f4f0e4"); for (let j = 0; j < 4; j++) for (let i = 0; i <= j; i++) r(11 - j * 2 + i * 4, 3 + j * 3, 2, 2, j === 0 ? "#c81c1c" : "#2c4c9c"); for (let j = 0; j < 3; j++) { lineC(12, 4 + j * 3, 10 - j * 2, 6 + j * 3, "#8c8c8c"); lineC(12, 4 + j * 3, 14 + j * 2, 6 + j * 3, "#8c8c8c"); } };
ITEMS.velkakirja.icon = () => { r(5, 1, 14, 15, "#f0e8d0"); r(5, 1, 14, 1, "#fcf8ec"); for (let k = 0; k < 4; k++) r(7, 4 + k * 2, 10, 1, "#6c6c6c"); lineC(7, 13, 16, 12, "#2c3c8c"); disc(16, 13, 2, "#c81c1c"); };
ITEMS.lappu.icon = () => { r(6, 3, 12, 11, "#fcf4c0"); r(6, 3, 12, 1, "#fffce0"); for (let k = 0; k < 3; k++) r(8, 6 + k * 2, 8 - k * 2, 1, "#4c4c6c"); r(13, 11, 4, 1, "#2c3c8c"); };
ITEMS.puhelin.icon = () => { r(9, 1, 7, 14, "#1c1c24"); r(10, 2, 5, 10, "#5c9cdc"); r(10, 2, 5, 2, "#9cd4fc"); r(11, 13, 3, 1, "#5c5c6c"); px(11, 6, "#fcfcfc"); };
ITEMS.idoli.icon = () => { r(9, 4, 6, 10, "#e8c81c"); r(10, 2, 4, 3, "#e8c81c"); r(9, 4, 2, 10, "#fcf06c"); r(13, 4, 2, 10, "#b8941c"); px(10, 7, "#3c2c0c"); px(13, 7, "#3c2c0c"); r(8, 14, 8, 1, "#8c6c1c"); px(15, 2, "#fff"); };

// ---------------------------------------------------------------- käynnistys
startEngine({
  titleScreen: drawTitle, startRoom: "koti", startX: 60, hint,
  intro: async () => {
    give("puhelin");
    await prologue(); give("nimikyltti");
    await say("Lappeenranta, lokakuu. Kisapuisto, SaiPan kotihalli.", "muu");
    await say("Potku lennätti minut sinne, mistä kaikki alkoi. Täällä minut sentään vielä tunnetaan.");
    await saarniScene(); },
});

// ---------------------------------------------------------------- testauksen aloituskohdat
// ?alku=istanbul (tai kappadokia) aloittaa suoraan ruudusta sillä tilalla, joka pelaajalla
// olisi sinne asti päästyään (17.10.: "voitko avata minulle pelin Istanbulista?").
(() => {
  const alku = new URLSearchParams(location.search).get("alku"); if (!alku) return;
  const kisa = { introDone: true, leafPile: true, billOut: true, billStuck: true, billCaught: true, billReturned: true, adRead: true, noteHint: true,
    myrraCalls: 1, pyramid: true, recruits: 2, mgp: true, metSales: true, pianoT: 1, unlocked: true, letterTaken: true, boxOpen: false,  };
  const ist = { merhaba: true, mehmetWho: true, signed: true, myrra1: true, quest: true, questHeard: true, map: true, askedMap: true, bag: true, bazaar: true };
  Object.assign(st.flags, kisa); st.inv = ["puhelin", "nimikyltti", "lappu", "kaavio", "kortti", "kirje", "lippu"];
  if (alku === "kappadokia") { Object.assign(st.flags, ist); st.flags.recruits = 2; st.flags.bazaar = false; st.inv = ["puhelin", "nimikyltti", "lappu", "kaavio", "kortti", "kirje", "lippu", "velkakirja"]; }
  addEventListener("load", () => setTimeout(() => {
    title = false; renderVerbs(); renderInv(); renderIq(); setSentence();
    if (alku === "kappadokia") { go("basaari", 160, true, 74); script(() => toTemple()); }
    else { go("basaari", 96, true); script(() => say("Istanbul! Basaarit, moskeijat ja kebabin tuoksu. Täällä jokainen on potentiaalinen jäsen.")); }
  }, 200));
})();
