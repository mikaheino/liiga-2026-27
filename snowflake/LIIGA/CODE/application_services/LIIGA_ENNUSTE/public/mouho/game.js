// Mouhon salaisuus -- sisältö: esineet, ruudut ja tarina Mouho-moottorille.
"use strict";
// Raimo Helminen -cameon hahmo (määritelty ennen ruutuja, koska satama viittaa siihen).
const RAIMO = { id: "helminen", x: -20, y: 127, h: 46, color: "#b4fc5c", moving: false, dir: 1, hidden: () => !st.flags.raimo,
  draw(t, talking) { helminen(this.x, this.y, t, talking, this.moving, this.dir); } };
Object.assign(ITEMS, {
  kebab: { name: "kebab", look: () => say("Aito Istanbulin döner kebab. Säästän sen Mouhoon. Pizza on yliarvostettu.") },
  kortti: { name: "käyntikortti", look: () => say("\"Signor Investimenti, Milano. Lisärahoitusta joustavasti.\"\nSama mies. Eri aurinkolasit.") },
  kirje: { name: "kirje", look: async () => { await say("\"Arvoisa herra Markkanen! Muistatte minut Milanosta.\nTällä kertaa kaikki on totta: Kappadokian luolatemppelissä lepää kultainen idoli.\"\n-- Signor Investimenti"); await say("Milano. Ensin tulkin kanssa, sitten ilman.\nTällä kertaa en siirrä kenellekään mitään etukäteen."); if (!has("lippu")) { await say("Kirjeen välissä on lentolippu Istanbuliin. Ilmainen! Se on aina hyvä merkki. Eikö olekin?"); give("lippu"); } } },
  lippu: { name: "lentolippu", look: () => say("Yksisuuntainen lippu Istanbuliin. Paluu järjestyy jotenkin. Aina järjestyy.") },
  rahat: { name: "3,50 € ja nappi", look: () => say("Kolme euroa viisikymmentä ja yksi nappi. Nappi on kaunis.") },
  pussi: { name: "kangaspussi", look: () => say("Tyhjä kangaspussi. Siinä on juuri idolin kokoinen ruumiinavaus.") },
  sakki: { name: "hiekkasäkki", look: () => say("Hiekkasäkki. Painaa suunnilleen yhtä paljon kuin kultainen idoli. Toivottavasti.") },
  ruoska: { name: "ruoska", look: () => say("Ruoska. En tiedä miten tätä käytetään, mutta näytän tosi hyvältä.") },
  idoli: { name: "kultainen idoli", look: () => say("Kultainen idoli. Se katsoo minua. Minä katson sitä. Me ymmärrämme toisiamme.") },
});

// ---------------------------------------------------------------- ruudut
Object.assign(ROOMS, {
  // Satama: laituri syvälle järvelle, ranta lähimpänä (rooms.js). Kävelyalue = ranta + laituri.
  koti: {
    title: "Satama, Lappeenranta", scale: [72, 136, 0.38, 1.06], start: 128,
    walk: [[[0, 123], [238, 123], [238, 136], [0, 136]], [[72, 124], [248, 124], [178, 72], [142, 72]]],
    actors: [{ id: "salkkumies", x: 184, y: 92, h: 48, color: "#7cfcfc", draw: (t, talking) => salesman(184, 92, t, talking) },
             RAIMO],
    draw: (t) => { satamaDraw(t); satamaPiano(t); ghostLynx(t); },
    onStop: (x, y) => quizStep(keyAt(x, y)),
    props: [{ y: 128, draw: satamaPoster }, { y: 104, draw: satamaPostbox }, { y: 96, draw: satamaRack }, { y: 121, draw: satamaPig }, { y: 120, draw: satamaBollard }, { y: 134, draw: satamaTaxi }],
    spots: [
      { id: "salkkumies", name: "salkkumies", actor: true, x: 177, y: 62, w: 16, h: 30, at: 172, aty: 96,
        Katso: () => say("Liituraitapuku, aurinkolasit keskellä yötä ja salkku. Joko kohta taitava liikemies tai sitten hyvin pimeässä kävelevä."),
        Puhu: () => salesmanTalk(), Anna: (it) => it === "rahat" ? say("En anna. Tällä kertaa en maksa ennakkoon kenellekään.") : say("Salkkumies: \"Otan vastaan vain tilisiirtoja, kiitos.\"", "salkkumies") },
      { id: "pollari", name: "pollari", x: 232, y: 106, w: 20, h: 16, at: 226, aty: 125,
        Katso: () => say("Pollari ja köysikieppi. Köysi ei ole sidottu mihinkään. Vähän kuin sijoitussuunnitelmani."), Vedä: () => say("Köysi ei johda mihinkään. Tarkistin.") },
      { id: "juliste", name: "juliste", x: 16, y: 84, w: 38, h: 30, at: 58, aty: 129,
        Katso: () => (iq("juliste", 2), say("MOUHO 2026. 2v2 NHL-turnaus, PS5. 22.5., Kaivokatu 10, Helsinki.\nMouho-osallistumismaksu on kirjoitettu niin pienellä, ettei sitä saa selvää.\nVarmaan 500 euroa. Tällaiset maksavat aina 500 euroa.")), Poimi: () => say("Jos otan julisteen, kukaan muu ei tiedä turnauksesta. Houkuttelevaa, mutta ei.") },
      { id: "piano", name: "lattiapiano", floor: true, hidden: () => !st.flags.pianoT, x: 80, y: 98, w: 160, h: 18, at: 160, aty: 108,
        Katso: () => say("Laiturin kanteen heijastettu jättipiano, numerot 1-9 ja 0. Kuin siinä Tom Hanksin elokuvassa.\nPitää vain seistä oikeilla numeroilla oikeassa järjestyksessä."),
        Työnnä: () => say("Painan jalalla. Pianoja soitetaan tässä kaupungissa jaloin.") },
      { id: "laatikko", name: "postilaatikko", x: 91, y: 80, w: 16, h: 24, at: 104, aty: 108,
        Avaa: async () => { if (!st.flags.unlocked) return say("Lukossa, ja avain on hukassa. Tuo liituraitamies katselee laatikkoa vähän liian tietäväisesti."); if (st.flags.boxOpen) return say("Se on jo auki."); st.flags.boxOpen = true; await say(st.flags.letterTaken ? "Tyhjä." : "Laatikossa on kirje!"); },
        Sulje: async () => { st.flags.boxOpen = false; await say("Suljettu. Postilaatikot ovat tyytyväisimpiä suljettuina."); },
        Poimi: async () => { if (!st.flags.boxOpen) return say("Laatikko on kiinni."); if (st.flags.letterTaken) return say("Ei siellä ole enää mitään."); st.flags.letterTaken = true; give("kirje"); await say("Kirje! Joku muistaa minut."); },
        Katso: () => say("Postilaatikko laiturilla. Yleensä täynnä laskuja, mutta tänään se näyttää toiveikkaalta.") },
      { id: "hattu", name: "hattu", x: 199, y: 61, w: 15, h: 10, at: 200, aty: 99, hidden: () => st.hat,
        Katso: () => say("Vanha fedora naulakossa. Isoisän. Tai jonkun, joka näytti isoisältä."), Poimi: async () => { st.hat = true; await say("Sopii kuin valettu. Nyt näytän seikkailijalta."); } },
      { id: "possu", name: "säästöpossu", x: 144, y: 112, w: 15, h: 10, at: 150, aty: 124,
        Katso: () => say("Säästöpossu laiturilla. Sen ilme kertoo kaiken."),
        Avaa: async () => { if (st.flags.pig) return say("Possu on tyhjä. Kuten minäkin, sisältä."); st.flags.pig = true; give("rahat"); await say("3,50 € ja nappi. Ei riitä edes Mouho-osallistumismaksun postimerkkiin."); },
        Poimi: () => spot("koti", "possu").Avaa(), Käytä: () => spot("koti", "possu").Avaa() },
      { id: "taksi", name: "taksi lentokentälle", x: 242, y: 88, w: 78, h: 46, at: 234, aty: 130,
        Katso: () => say("Taksi lentokentälle. Kuljettaja lukee Liigan otteluohjelmaa. Hän näyttää huolestuneelta."),
        Käytä: () => leave(), Avaa: () => leave(), Puhu: () => say("Kuljettaja: \"Lentokentälle? Taas Milanoon? Ai, Istanbuliin. No, lippu ensin.\"", "muu") },
    ],
  },
  // Basaari: katu kapenee kohti moskeijaa; Mehmet tiskinsä takana oikealla.
  basaari: {
    title: "Suuri basaari, Istanbul", scale: [72, 136, 0.4, 1.06], start: 128,
    walk: [[[142, 72], [178, 72], [206, 96], [206, 121], [300, 136], [20, 136]]],
    actors: [{ id: "kauppias", x: 258, y: 96, h: 46, color: "#fc54fc", draw: (t, talking) => merchant(258, 96, t, talking) }],
    draw: (t) => { basaariDraw(t); satamaPiano(t); ghostCup(t); },
    onStop: (x, y) => quizStep(keyAt(x, y)),
    props: [{ y: 114, draw: basaariCounter }, { y: 101, draw: basaariSpices }, { y: 131, draw: basaariAmphora }],
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
        Katso: async () => { st.flags.map = true; iq("kartta", 8); await say("Mattoon on kudottu kartta! Kappadokia... luolatemppeli... ja punainen rasti.\nPainan sen mieleeni. Kadun päästä pääsee itään."); },
        Poimi: () => say("Kauppias: \"Matto maksaa enemmän kuin sinä.\"", "kauppias"), Työnnä: () => say("Matto ei lennä. Tarkistin.") },
      { id: "pussi", name: "kangaspussi", x: 78, y: 58, w: 12, h: 18, at: 98, aty: 98, hidden: () => st.flags.bag,
        Katso: () => say("Tyhjä kangaspussi naulassa. Siinä lukee \"ILMAINEN\". Tässä basaarissa se on epäilyttävää."),
        Poimi: async () => { st.flags.bag = true; give("pussi"); await say("Otan sen. Se oli ilmainen. Luulisin."); } },
      { id: "ruoska", name: "ruoska", x: 216, y: 68, w: 18, h: 18, at: 206, aty: 104, hidden: () => st.whip,
        Katso: () => say("Ruoska kojun tolpassa. Jokainen arkeologi tarvitsee ruoskan. Ja hatun."), Poimi: () => say("Kauppias katsoo minua kuin haukka. Haukka, jolla on fetsi."), },
      { id: "kauppias", name: "kauppias", actor: true, x: 247, y: 64, w: 22, h: 32, at: 205, aty: 116,
        Katso: () => say("Basaarin kovin tinkijä, Mehmet. Kuulemma hän on myynyt hiekkaa autiomaahan ja logon Lappeenrantaan."),
        Puhu: () => talk(), Anna: (it) => it === "idoli" ? sellIdol() : it === "rahat" ? say("Kauppias: \"3,50 ja nappi? Tingi ensin, sitten puhutaan.\"", "kauppias") : say("Kauppias: \"Ei kiitos.\"", "kauppias") },
      { id: "itaan", name: "itäinen kuja", x: 140, y: 40, w: 40, h: 31, at: 160, aty: 73, exit: true,
        Katso: () => say(st.flags.map ? "Kuja itään, Kappadokiaan, kartan mukaan." : "Kuja moskeijan alla. En tiedä mihin se vie."), Käytä: () => toTemple(), Kävele: () => toTemple() },
    ],
  },
  // Temppeli: kuilu poikittain lattian halki, idoli sen takana. Takaosaan pääsee
  // vasta ruoskalla; ylityksen jälkeen kuilun oikealle laidalle jää kapea reunus.
  temppeli: {
    title: "Unohdettu luolatemppeli, Kappadokia", scale: [62, 136, 0.34, 1.06], start: 128,
    walk: () => st.flags.crossed ? [[[24, 100], [296, 100], [318, 136], [2, 136]], [[94, 64], [226, 64], [256, 80], [64, 80]], [[197, 78], [208, 78], [209, 102], [196, 102]]]
                                 : [[[24, 100], [296, 100], [318, 136], [2, 136]]],
    draw: temppeliDraw,
    post: (t) => { temppeliPost(t); satamaPiano(t); ghostTrophy(t); },
    onStop: (x, y) => quizStep(keyAt(x, y)),
    actors: [{ id: "tuomari", x: 100, y: 106, h: 44, color: "#a8d8fc", hidden: () => !st.flags.refHere, draw: (t, talking) => ghostRef(100, 106, t, talking) }],
    props: [{ y: 76, draw: temppeliPedestal }, { y: 129, draw: temppeliSand }, { y: 131, draw: temppeliPillar }, { get y() { return st.flags.boulder == null ? -1 : boulderY(); }, draw: temppeliBoulder }],
    spots: [
      { id: "tuomari", name: "erotuomarin haamu", actor: true, hidden: () => !st.flags.refHere, x: 92, y: 64, w: 16, h: 42, at: 112, aty: 110,
        Katso: () => say("Muinaisen erotuomarin haamu. Raitapaita, pilli ja ilme, joka on nähnyt kaiken."), Puhu: () => refereeChallenge() },
      { id: "piano3", name: "heijastetut numerot", floor: true, hidden: () => !st.flags.quizT_temppeli, x: 30, y: 103, w: 260, h: 14, at: 160, aty: 110,
        Katso: () => say("Numerot hehkuvat kivilattiassa. Joku täällä pitää visoista.") },
      { id: "pylvas", name: "kaatunut pylväs", x: 234, y: 118, w: 36, h: 14, at: 228, aty: 133,
        Katso: () => say("Kaatunut pylväs. Siinä on enemmän ryhtiä kuin minulla maanantaisin."), Työnnä: () => say("Se ei liiku. Eikä sen kuulukaan. Se on jo kaatunut kerran.") },
      { id: "hiekka", name: "hiekka", x: 36, y: 114, w: 36, h: 16, at: 76, aty: 127,
        Katso: () => say("Hienoa hiekkaa. Täydellistä säkkeihin. Ei kysytä, miksi luolassa on hiekkaa."),
        Poimi: () => say("Kourallinen ei riitä. Tarvitsisin jonkin astian."),
        "Käytä:pussi": async () => { take("pussi"); give("sakki"); iq("hiekkasakki", 5); await say("Täytän pussin. Hiekkasäkki valmis! Painaa varmaan saman verran kuin idoli."); } },
      { id: "reliefi", name: "kivireliefi", x: 76, y: 20, w: 50, h: 30, at: 100, aty: 102,
        Katso: () => (iq("reliefi", 5), say("Muinainen otteluohjelma, hakattu kiveen tuhansiksi vuosiksi.\nJoku on silti siirtänyt kolmea ottelua lyhyellä varoitusajalla.")),
        Työnnä: () => say("Se ei liiku. Kiveen hakattu ohjelma ei siirry. Tai ei ainakaan pitäisi.") },
      { id: "kuilu", name: "kuilu", x: 26, y: 81, w: 268, h: 17, at: 160, aty: 102,
        Katso: () => say("Pohjaton kuilu koko kammion poikki. Tai ainakin syvä. En aio mitata."),
        Kävele: () => say("En hyppää tuon yli. Olen seikkailija, en urheilija.") },
      { id: "koukku", name: "koukku", x: 153, y: 6, w: 14, h: 22, at: 160, aty: 102,
        Katso: () => say("Rautakoukku katossa kuilun yllä. Joku on ajatellut minua."),
        "Käytä:ruoska": async () => { st.flags.whipHung = true; take("ruoska"); await say("Hop!");
          for (let i = 0; i < 28; i++) { st.y -= 1; await sleep(28); }
          st.flags.crossed = true; st.flags.whipHung = false; give("ruoska"); iq("ruoska", 10);
          await say("Juuri kuten harjoittelin. En harjoitellut."); await say("...Ja tuolla oikealla on kapea reunus. Olisin voinut kävellä."); } },
      { id: "idoli", name: "kultainen idoli", x: 152, y: 49, w: 16, h: 16, at: 160, aty: 70, hidden: () => st.flags.idol && !st.flags.swapped,
        Katso: () => say(st.flags.swapped ? "Hiekkasäkki jalustalla. Se ei huijaa ketään pitkään." : "Kultainen idoli kuilun takana. Mouho-osallistumismaksu muodossa, joka hymyilee."),
        Poimi: () => !st.flags.crossed ? say("En ylety. Kuilu on välissä.") : st.flags.idol ? say("Se on jo minulla.") : say("Liian helppoa. Jalustassa on varmasti ansa. Tarvitsen jotain samanpainoista vaihtoon."),
        "Käytä:sakki": () => (st.flags.crossed ? grabIdol() : say("En ylety. Kuilu on välissä.")) },
      { id: "ovi", name: "käytävä basaariin", x: 2, y: 76, w: 18, h: 52, at: 22, aty: 118, exit: true,
        Katso: () => say("Käytävä takaisin basaariin."), Käytä: () => go("basaari", 160, false, 74), Kävele: () => go("basaari", 160, false, 74) },
    ],
  },
});

// ---------------------------------------------------------------- juoni
async function leave() {
  await script(async () => {
    if (!has("lippu")) return say("Ilman lippua en pääse edes turvatarkastukseen. Postia pitäisi ehkä katsoa.");
    if (!st.hat) return say("Lähteä Indiana Jones -seikkailulle ilman hattua? En ole barbaari.");
    await say("Istanbul, täältä tullaan!");
    await travel(); go("basaari", 40, true);
    await say("Istanbul! Basaarit, moskeijat ja kebabin tuoksu. Täällä myydään kaikkea. Ehkä jopa Mouho-osallistumismaksuja.");
  });
}
async function toTemple() {
  await script(async () => {
    if (!st.flags.map) return say("En tiedä mihin tämä kuja vie. Jossain täällä on varmasti kartta.");
    if (!st.whip) return say("Luolatemppeliin ilman ruoskaa? Elokuvissa kaikilla on ruoska.");
    await walkTo(160, 72); go("temppeli", 160, true, 128); if (!st.flags.refMet) await refereeAppears();
    await say("Hämähäkinseittejä, soihtuja ja kuilu. Juuri kuten kirjeessä luvattiin.");
  });
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
    go("basaari", 160, true, 74); await say("Hengissä. Ja rikas. No, pian rikas.");
  });
}

// Kaupanteko haukkumalla, kuten miekkailu Melee Islandilla: oikea vastaus kolmesti.
const BARGAIN = [
  { a: "Tuollaisella hatulla et pääse edes Mikkelin torille!", ok: "Ja tuollaisilla hinnoilla et myisi edes Mikkelin torilla.", no: ["Ai.", "Hattu on isoisän!"] },
  { a: "Äitini tinkii paremmin kuin sinä!", ok: "Ilmeisesti, koska hän ei ole koskaan ostanut sinulta mitään.", no: ["Terveisiä äidillesi.", "Minulla on kumikana väkipyörällä."] },
  { a: "Sinä maksaisit ennakkoon kenelle tahansa, joka puhuu italiaa!", ok: "Siksi tingin nyt turkiksi, enkä maksa mitään ennakkoon.", no: ["Grazie.", "Tarvitsen tulkin."] },
  { a: "Sinä et erottaisi döneriä iskenderistä!", ok: "Mutta erotan hyvän kaupan huonosta. Tällä kertaa.", no: ["Molemmat ovat kebabia.", "Saako valkosipulikastikkeella?"] },
  { a: "Tämä ruoska kuului itse sulttaanille!", ok: "Sitten sulttaani ostaa sen takaisin kalliimmalla.", no: ["Wau.", "Katso takanasi, kolmipäinen kameli!"] },
];
async function talk() {
  await script(async () => {
    if (!st.flags.merhaba) { st.flags.merhaba = true; await say("Hoş geldiniz! Merhaba, ystäväni! Tervetuloa Mehmetin kojuun, Istanbulin rehellisimpään.", "kauppias"); await say("Teşekkür... ederim? Opettelin sen lentokoneessa."); }
    while (true) {
      const opts = []; if (!st.whip) opts.push("Paljonko ruoska maksaa?", "Tingitään ruoskasta!"); if (!st.flags.logo) opts.push("Teettekö logoja?"); if (!st.flags.seura) opts.push("Ostaisitteko jääkiekkoseuran?"); if (!st.flags.kebabQ) opts.push("Missä saa Istanbulin parhaan kebabin?"); if (!st.flags.cupDone) opts.push("Olen entinen NHL-maalivahti."); if (has("idoli")) opts.push("Kiinnostaisiko kultainen idoli?"); opts.push("Ei mitään, näkemiin.");
      const pick = opts[await choose(opts)]; await say(pick);
      if (pick.startsWith("Olen entinen NHL")) {
        await say("Sinä?! Maalivahti? Todista se, ystäväni. Minä vuonna pelasit Stanley Cupin finaalissa?", "kauppias");
        await say("Tassuttele se kadulle. Basaarissa kaikki maksetaan jaloin.", "kauppias");
        st.flags.quizT_basaari = Date.now(); [262, 330, 392, 523, 659].forEach((f, n) => setTimeout(() => beep(f, 150, "triangle", .06), n * 110));
        await sleep(1100); await say("Numerot heijastuivat kadun kiviin. Mehmet on valmistautunut tähän."); return; }
      else if (pick.startsWith("Missä saa")) { st.flags.kebabQ = true; await say("Serkkuni kioskista Galatan sillan alta. Hänellä on myös logofirma. Ja tulkkipalvelu.", "kauppias");
        await say("Kuulostaa monialaiselta konsernilta."); await say("Çok güzel! Sinä ymmärrät liiketoimintaa.", "kauppias"); }
      else if (pick.startsWith("Paljonko")) await say("Sinulle, ystäväni, vain 500 liiraa. Ja hattusi.", "kauppias");
      else if (pick.startsWith("Teettekö")) { st.flags.logo = true; await say("Teen! Idän Ihme ja kebab samassa kuvassa. Vain 50 tonnia.", "kauppias"); await say("Kiitos, olen nähnyt sen jo."); }
      else if (pick.startsWith("Ostaisitteko")) { st.flags.seura = true; await say("Etsitkö turkkilaisia sijoittajia, ystäväni?\nMinä olen turkkilainen sijoittaja. Vastaus on ei.", "kauppias"); await say("Kannatti kysyä. Viimeksi kysyin Milanossa."); }
      else if (pick.startsWith("Tingitään")) { if (await bargain()) return; }
      else if (pick.startsWith("Kiinnostaisiko")) return sellIdol(true);
      else { await say("Palaa pian, ystäväni! Hinnat nousevat joka minuutti.", "kauppias"); return; }
    }
  });
}
async function bargain() {
  await say("Tingitään? Kukaan ei tingi Mehmetin kanssa!", "kauppias");
  for (const b of BARGAIN) {
    await say(b.a, "kauppias");
    const opts = [...b.no, b.ok].sort(() => Math.random() - 0.5);
    const i = await choose(opts); await say(opts[i]);
    if (opts[i] !== b.ok) { await say(opts[i].includes("kameli") ? "Mehmet ei käänny. Hän on nähnyt kolmipäisen kamelin. Kahdesti." : "Ha! Palaa kun opit tinkimään.", opts[i].includes("kameli") ? "muu" : "kauppias"); return false; }
  }
  await say("...Sinä tingit kuin oma veljeni. Hyvä on! Ruoska sinulle 3,50 eurolla ja napilla.", "kauppias");
  if (!has("rahat")) { await say("Mutta rahaa sinulla ei ole. Tule takaisin kun possu on rikki.", "kauppias"); return false; }
  take("rahat"); st.whip = true; give("ruoska"); iq("tinkiminen", 10); await say("Ruoska! Nyt minusta puuttuu vain idoli ja kunnollinen tunnari.");
  await say("Ja kaupan päälle kebab, ystäväni. Kukaan ei lähde Mehmetin kojulta nälkäisenä.", "kauppias"); give("kebab"); return true;
}
async function sellIdol(inScript) {
  const run = async () => {
    await say("Kultainen idoli! Kappadokiasta! Annan siitä... 500 euroa.", "kauppias");
    await say("Täsmälleen Mouho-osallistumismaksu. Kauppa! Mouhoon!");
    take("idoli"); await sleep(400); await ending();
  };
  return inScript ? run() : script(run);
}


// Kohde nimellä, ei indeksillä: uusi kohde ruudun alkuun siirsi indeksit kerran.
const spot = (room, id) => ROOMS[room].spots.find((p) => p.id === id);

// ---------------------------------------------------------------- Raimo Helminen -cameo
// Onnistuneen Ilves-visan jälkeen: luistelee sisään vasemmalta, onnittelee ja lähtee heti.
async function skate(to, speed = 2.2) { RAIMO.moving = true; RAIMO.dir = to > RAIMO.x ? 1 : -1; while (Math.abs(RAIMO.x - to) > speed) { RAIMO.x += Math.sign(to - RAIMO.x) * speed; await sleep(30); } RAIMO.x = to; RAIMO.moving = false; }
async function raimoCameo() {
  RAIMO.x = -20; st.flags.raimo = true; st.dir = -1; await skate(Math.max(30, st.x - 34));
  await say("Oikein! Ilves, 1985. Hienosti tassuteltu, Markkanen!", "helminen");
  await say("Raimo Helminen?!");
  await say("Pitää mennä. Treenit alkaa.", "helminen");
  await skate(-30, 3.2); st.flags.raimo = false;
  await say("...Ja hän oli poissa. Kukaan ei usko tätä Mouhossa.");
}

// ---------------------------------------------------------------- lattiapiano (satama)
// Ilves voitti viimeksi Suomen mestaruuden 1985. Koodi kirjautuu pysähtymisistä.
const NOTE = { 1: 262, 2: 294, 3: 330, 4: 349, 5: 392, 6: 440, 7: 494, 8: 523, 9: 587, 0: 659 };
// Lattiavisat: sama mekaniikka kolmessa ruudussa, koodi ja palkinto ruutukohtaisia.
const QUIZZES = {
  koti: { code: "1985", done: () => st.flags.unlocked, taunt: "salkkumies",
    lines: ["Hah! Väärin. Se maksaa 3,50.", "Ei se mennyt noin. Olitko oikeasti urheilujohtaja?", "Väärä vuosi. Ilveksen kannattajat itkevät."],
    solve() { st.flags.unlocked = true; iq("piano", 10); script(async () => { await sleep(700); await say("Hmph. 1985. Olet oikea lätkämies. Tässä avain.", "salkkumies"); await say("Klik! Postilaatikon lukko aukesi."); await say("Ilves, 1985. Viimeinen mestaruus. Jotkut asiat eivät unohdu. Toiset eivät toistu.");
      st.flags.ghostT = Date.now(); [196, 247, 294, 392].forEach((f, n) => setTimeout(() => beep(f, 600, "sine", .05), n * 220)); await sleep(3300); await raimoCameo(); }); } },
  basaari: { code: "2006", done: () => st.flags.cupDone, taunt: "kauppias",
    lines: ["Ei, ei, ystäväni. Maalivahti muistaisi.", "Väärä vuosi! Tuollaisella muistilla et pääse edes Galatan sillalle.", "Hmm. Ehkä sinä olit vain katsomossa."],
    solve() { st.flags.cupDone = true; iq("stanley", 10); script(async () => {
      await sleep(700); await say("Çok güzel! 2006! Stanley Cupin finaali! Sinä todella olit maalivahti!", "kauppias");
      st.flags.cupT = Date.now(); [262, 330, 392, 523].forEach((f, n) => setTimeout(() => beep(f, 500, "sine", .05), n * 200)); await sleep(1600);
      await say("MARK-KA-NEN! MARK-KA-NEN!", "muu"); await sleep(1500);
      await say("Kesä 2006. Jotkut asiat eivät unohdu. Edes Istanbulissa.");
      if (!has("kebab")) { await say("Tästä hyvästä kebab on ilmainen, ystäväni. Maalivahdit tarvitsevat proteiinia.", "kauppias"); give("kebab"); } }); } },
  temppeli: { code: "64", done: () => st.flags.refDone, taunt: "tuomari",
    lines: ["Väärin. Kaksi minuuttia jäähyä.", "Ei. Tarkista sääntökirja.", "Väärin. Pilli soi, peli seis."],
    solve() { st.flags.refDone = true; iq("tuomari", 10); script(async () => {
      await sleep(700); await say("Oikein. 64 ottelua. Saat kulkea.", "tuomari");
      st.flags.trophyT = Date.now(); [196, 262, 330, 392].forEach((f, n) => setTimeout(() => beep(f, 600, "sine", .05), n * 220)); await sleep(3300);
      [2200, 2200].forEach((f, n) => setTimeout(() => beep(f, 160, "square", .05), n * 220)); await sleep(500);
      st.flags.refHere = false; st.flags.crossed = true;
      await say("Tuomari vihelsi ja katosi. Ja kuilun yli on nyt kivipolku.");
      await say("Muinaiset tiesivät, mitä tekivät. Ainakin otteluohjelmasta."); }); } },
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
// Temppelin erotuomari: ilmestyy ensikäynnillä ja haastaa (vaihtoehto ruoskalle).
async function refereeAppears() {
  st.flags.refMet = true; st.flags.refHere = true; beep(2200, 200, "square", .05); await sleep(300);
  await say("Pilli soi kammiossa. Reliefin eteen materialisoituu läpikuultava erotuomari.", "muu");
  await refereeChallengeLines();
}
async function refereeChallengeLines() {
  await say("Seis! Kukaan ei ylitä kuilua ennen kuin vastaa kysymykseen.", "tuomari");
  await say("Montako runkosarjaottelua Liigassa pelataan joukkuetta kohden kaudella 2026-27?", "tuomari");
  await say("Tassuttele vastaus lattiaan. Tai yritä jotain muuta. Kuilu ei välitä.", "tuomari");
  st.flags.quizT_temppeli ??= Date.now(); [262, 330, 392, 523, 659].forEach((f, n) => setTimeout(() => beep(f, 150, "triangle", .06), n * 110));
}
function refereeChallenge() { return script(async () => { if (st.flags.refDone) return say("Peli on jo vihelletty.", "tuomari"); await refereeChallengeLines(); }); }

// ---------------------------------------------------------------- salkkumies (satama)
// Kysyy otteluohjelmasta ja tarjoaa lisärahoitusta. Ei kuulu ratkaisuun: tämä on
// hahmo, jolle Jussi saa näyttää oppineensa jotain.
async function salesmanTalk() {
  await script(async () => {
    if (!st.flags.metSales) { st.flags.metSales = true;
      await say("Psst! Markkanen! Onko otteluohjelma jo valmis? Meidän porukka varasi lauantaille saunan.", "salkkumies"); }
    while (true) {
      const opts = [];
      if (!st.flags.unlocked) opts.push("Tiedätkö, missä postilaatikkoni avain on?");
      if (!st.flags.salesSchedule) opts.push("Otteluohjelma? En ole enää urheilujohtaja.");
      if (!st.flags.salesMoney) opts.push("Sanoit jotain lisärahoituksesta?");
      opts.push("Lainaisitko 500 euroa Mouho-osallistumismaksuun?");
      if (has("kirje") && !st.flags.salesSignor) opts.push("Tunnetko Signor Investimentin?");
      opts.push("Näkemiin.");
      const pick = opts[await choose(opts)]; await say(pick);
      if (pick.startsWith("Tiedätkö, missä")) {
        await say("Ehkä tiedän. Mutta avain ei irtoa ilmaiseksi.", "salkkumies");
        await say("Entinen urheilujohtaja muka. Tiedätkö edes, milloin Ilves voitti viimeksi Suomen mestaruuden?", "salkkumies");
        await say("Tassuttele se vuosi lattiaan. Jos osaat, avain on sinun.", "salkkumies");
        st.flags.pianoT = Date.now(); [262, 330, 392, 523, 659].forEach((f, n) => setTimeout(() => beep(f, 150, "triangle", .06), n * 110));
        await sleep(1100); await say("...Lattiaan ilmestyi numeroita. Tämä kaupunki ei lakkaa yllättämästä.");
        await say("Kuin siinä Tom Hanksin elokuvassa. Tarvitsee vain seistä oikeilla numeroilla oikeassa järjestyksessä."); return; }
      else if (pick.startsWith("Otteluohjelma")) { st.flags.salesSchedule = true;
        await say("Ai. No siirtyykö se lauantain peli? Kysyn vain varmuuden vuoksi. Ja sunnuntain. Ja ensi kuun.", "salkkumies");
        await say("Kaikki ottelut pelataan suunnitellusti. Luulisin. Älä lainaa minua."); }
      else if (pick.startsWith("Sanoit")) { st.flags.salesMoney = true;
        await say("Ainutlaatuinen mahdollisuus! Lähetä vain 100 000 euroa tälle tilille, niin kuukauden päästä saat tuplat. Sijoittajat odottavat jo Milanossa.", "salkkumies");
        const o = ["Kuulostaa tutulta. Liian tutulta.", "Onko teillä tulkki?", "Ei kiitos. Tällä kertaa en maksa ennakkoon."];
        const k = await choose(o); await say(o[k]);
        if (k === 0) await say("Tuttu on turvallinen! Sitä paitsi tällä kertaa logossa on kebab.", "salkkumies");
        else if (k === 1) { iq("tulkki", 5); await say("Tulkki maksaa erikseen. Ensimmäisellä kerralla mukana, toisella ei.", "salkkumies"); }
        else { iq("ennakko", 10); await say("Harmi. Olit ennen niin... avoin uusille mahdollisuuksille.", "salkkumies"); } }
      else if (pick.startsWith("Lainaisitko")) {
        await say("Totta kai! Rahoitusta myönnetään pientä ennakkomaksua vastaan. 3,50 € riittää alkuun.", "salkkumies");
        iq("laina", 5); await say(has("rahat") ? "Minulla on täsmälleen 3,50 € ja nappi. Ja minä pidän ne." : "Minulla ei ole edes 3,50 euroa. Se on tällä kertaa onni.");
        if (!has("kortti")) { await say("Ota ainakin käyntikortti. Siltä varalta, että muutat mielesi.", "salkkumies"); give("kortti"); } }
      else if (pick.startsWith("Tunnetko")) { st.flags.salesSignor = true;
        await say("Kuka kysyy? Siis... en ole koskaan kuullutkaan. Hieno mies. Luotettava. Mutta en tunne.", "salkkumies"); }
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
    if (!f.unlocked && !f.pianoT) return ["Postilaatikko on lukossa. Tuo liituraitamies laiturilla näyttää tietävän jotain.", "Puhu salkkumiehelle ja kysy postilaatikon avaimesta."];
    if (!f.unlocked) return ["Ilves on Tampereelta. Viimeisin mestaruus tuli 80-luvulla. Numerot ovat laiturissa.", "Kävele laiturin numeroille 1, 9, 8 ja 5, tässä järjestyksessä."];
    if (!f.letterTaken) return ["Lukko on auki. Posti odottaa.", "Avaa postilaatikko ja poimi kirje."];
    if (!has("lippu")) return ["Kirjeessä voi olla muutakin kuin sanoja.", "Katso kirjettä: oikea painike kirjeen kuvaan tavaroissa."];
    if (!f.pig) return ["Matkat maksavat. Laiturilla on joku, joka säästää puolestani.", "Avaa säästöpossu laiturilla."];
    if (!st.hat) return ["Seikkailija ilman hattua on pelkkä turisti.", "Poimi fedora naulakosta laiturilta."];
    return ["Kaikki on valmista. Lentokenttä kutsuu.", "Käytä taksia oikealla."];
  }
  if (here === "basaari") {
    if (has("idoli")) return ["Mehmet ostaa kaiken. Ehkä kultaakin.", "Anna kultainen idoli Mehmetille."];
    if (!f.map) return ["Seinällä on matto, jossa on outoja kuvioita.", "Katso mattoa vasemmalla seinällä."];
    if (!f.bag) return ["Jotain ilmaista roikkuu naulassa. Ilmainen on aina epäilyttävää, mutta hyödyllistä.", "Poimi kangaspussi vasemmalta seinältä."];
    if (!st.whip) return ["Jokainen arkeologi tarvitsee ruoskan. Mehmet myy sellaisen, jos osaan tinkiä.", "Puhu Mehmetille ja valitse \"Tingitään ruoskasta!\". Vastaa piikkiin samalla mitalla."];
    return ["Kartan mukaan temppeli on idässä.", "Kävele kadun päähän moskeijan alle."];
  }
  if (here === "temppeli") {
    if (st.flags.idol) return ["Ulos ja äkkiä.", "Mene ovesta vasemmalle."];
    if (!has("sakki") && !f.swapped) return ["Idoli on ansoitettu. Tarvitsen jotain samanpainoista.", "Käytä kangaspussia hiekkaan."];
    if (!f.crossed) return ["Kuilun yli pääsee kahdella tavalla: ylhäältä tai tietämällä.", "Käytä ruoskaa katon koukkuun, tai vastaa tuomarille: 64 (kävele numeroille 6 ja 4)."];
    return ["Idoli kuilun takana. Vaihto sulavasti.", "Käytä hiekkasäkkiä idoliin."];
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
ITEMS.kirje.icon = () => { r(3, 3, 18, 11, "#ececec"); r(3, 3, 18, 1, "#fcfcfc"); for (let k = 0; k < 9; k++) { px(3 + k, 4 + k / 2, "#a8a8a8"); px(20 - k, 4 + k / 2, "#a8a8a8"); } disc(12, 9, 2, "#c81c1c"); };
ITEMS.lippu.icon = () => { r(2, 4, 20, 9, "#3c7cdc"); r(2, 4, 20, 1, "#7cacfc"); r(15, 4, 1, 9, "#fcfcfc"); r(4, 7, 9, 1, "#fcfcfc"); r(4, 9, 6, 1, "#c8dcfc"); r(17, 6, 3, 2, "#fcd41c"); };
ITEMS.rahat.icon = () => { disc(8, 9, 4, "#e8c81c", "#a8841c"); disc(14, 7, 4, "#d8b81c", "#a8841c"); px(13, 6, "#fcf09c"); disc(19, 11, 2, "#8c5c3c", "#5c3c24"); px(18, 11, "#2c1c10"); px(20, 11, "#2c1c10"); };
ITEMS.pussi.icon = () => { r(7, 5, 10, 9, "#c8b48c"); r(6, 4, 12, 2, "#e0d0a8"); r(10, 2, 4, 3, "#a8946c"); r(15, 6, 2, 8, "#a8946c"); };
ITEMS.sakki.icon = () => { disc(12, 10, 5, "#c8b48c", "#a8946c"); r(10, 2, 4, 4, "#a8946c"); px(9, 9, "#e0d0a8"); r(6, 13, 12, 1, "#8c7850"); };
ITEMS.ruoska.icon = () => { r(3, 10, 5, 3, "#3c2410"); for (let k = 0; k < 14; k++) px(8 + k, 10 - Math.sin(k / 2.2) * 5, "#8c5c2c"); px(21, 6, "#6c4420"); };
ITEMS.kortti.icon = () => { r(3, 4, 18, 9, "#f4f0e4"); r(3, 4, 18, 1, "#fff"); r(5, 6, 6, 1, "#2c2c3c"); r(5, 8, 10, 1, "#8c8c8c"); r(5, 10, 8, 1, "#8c8c8c"); r(16, 6, 3, 3, "#c8a030"); };
ITEMS.kebab.icon = () => { r(4, 5, 16, 8, "#e8c88c"); r(4, 5, 16, 1, "#f8e0a8"); r(6, 6, 12, 4, "#8c4c24"); r(7, 6, 3, 1, "#5c9c3c"); r(13, 7, 3, 1, "#c83c2c"); r(10, 8, 4, 1, "#f4f4ec"); r(4, 12, 16, 1, "#c8a46c"); };
ITEMS.idoli.icon = () => { r(9, 4, 6, 10, "#e8c81c"); r(10, 2, 4, 3, "#e8c81c"); r(9, 4, 2, 10, "#fcf06c"); r(13, 4, 2, 10, "#b8941c"); px(10, 7, "#3c2c0c"); px(13, 7, "#3c2c0c"); r(8, 14, 8, 1, "#8c6c1c"); px(15, 2, "#fff"); };

// ---------------------------------------------------------------- käynnistys
startEngine({
  titleScreen: drawTitle, startRoom: "koti", startX: 60, hint,
  intro: async () => { await say("Syvällä Etelä-Karjalassa, Saimaan rannalla..."); await say("Entisellä urheilujohtajalla on yhtäkkiä paljon vapaa-aikaa."); await say("Mouho 2026 lähestyy, ja minulta puuttuu Mouho-osallistumismaksu.\nJonkun täytyy tietää, mistä 500 euroa löytyy."); await say("Ja postilaatikkoni on lukossa, eikä avainta löydy. Tuo liituraitamies tietää jotain."); },
});
