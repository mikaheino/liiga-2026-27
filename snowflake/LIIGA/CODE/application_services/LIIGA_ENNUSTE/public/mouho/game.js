// Mouhon salaisuus -- sisältö: esineet, ruudut ja tarina Mouho-moottorille.
"use strict";
Object.assign(ITEMS, {
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
  koti: {
    title: "Satama, Lappeenranta", scale: [111, 134], walk: [[[18, 111], [302, 111], [316, 135], [4, 135]]],
    actors: [{ id: "salkkumies", x: 238, y: 117, h: 48, color: "#7cfcfc", draw: (t, talking) => salesman(238, 117, t, talking) }],
    draw: kotiDraw,
    props: [{ y: 127, draw: () => { shadow(207, 127, 6); r(203, 116, 8, 11, "#24242c"); r(202, 114, 10, 3, "#3c3c48"); r(204, 117, 2, 9, "#3c3c48");
      g.fillStyle = "#c8b48c"; g.beginPath(); g.ellipse(214, 125, 7, 2.5, 0, 0, 7); g.fill(); g.fillStyle = "#a8946c"; g.beginPath(); g.ellipse(214, 125, 4, 1.4, 0, 0, 7); g.fill(); r(209, 118, 3, 1, "#c8b48c"); } }],
    spots: [
      { id: "salkkumies", name: "salkkumies", actor: true, x: 229, y: 76, w: 18, h: 42, at: 222, aty: 121,
        Katso: () => say("Liituraitapuku, aurinkolasit keskellä yötä ja salkku. Joko kohta taitava liikemies tai sitten hyvin pimeässä kävelevä."),
        Puhu: () => salesmanTalk(), Anna: (it) => it === "rahat" ? say("En anna. Tällä kertaa en maksa ennakkoon kenellekään.") : say("Salkkumies: \"Otan vastaan vain tilisiirtoja, kiitos.\"", "salkkumies") },
      { id: "pollari", name: "pollari", x: 200, y: 112, w: 22, h: 16, at: 196, aty: 128,
        Katso: () => say("Pollari ja köysikieppi. Köysi ei ole sidottu mihinkään. Vähän kuin sijoitussuunnitelmani."), Vedä: () => say("Köysi ei johda mihinkään. Tarkistin.") },
      { id: "juliste", name: "juliste", x: 70, y: 50, w: 22, h: 26, at: 82,
        Katso: () => (iq("juliste", 2), say("MOUHO 2026. 2v2 NHL-turnaus, PS5. 22.5., Kaivokatu 10, Helsinki.\nMouho-osallistumismaksu on kirjoitettu niin pienellä, ettei sitä saa selvää.\nVarmaan 500 euroa. Tällaiset maksavat aina 500 euroa.")), Poimi: () => say("Jos otan julisteen, kukaan muu ei tiedä turnauksesta. Houkuttelevaa, mutta ei.") },
      { id: "laatikko", name: "postilaatikko", x: 106, y: 78, w: 16, h: 30, at: 114,
        Avaa: async () => { if (st.flags.boxOpen) return say("Se on jo auki."); st.flags.boxOpen = true; await say(st.flags.letterTaken ? "Tyhjä." : "Laatikossa on kirje!"); },
        Sulje: async () => { st.flags.boxOpen = false; await say("Suljettu. Postilaatikot ovat tyytyväisimpiä suljettuina."); },
        Poimi: async () => { if (!st.flags.boxOpen) return say("Laatikko on kiinni."); if (st.flags.letterTaken) return say("Ei siellä ole enää mitään."); st.flags.letterTaken = true; give("kirje"); await say("Kirje! Joku muistaa minut."); },
        Katso: () => say("Postilaatikko. Yleensä täynnä laskuja, mutta tänään se näyttää toiveikkaalta.") },
      { id: "hattu", name: "hattu", x: 142, y: 56, w: 16, h: 12, at: 150, hidden: () => st.hat,
        Katso: () => say("Vanha fedora. Isoisän. Tai jonkun, joka näytti isoisältä."), Poimi: async () => { st.hat = true; await say("Sopii kuin valettu. Nyt näytän seikkailijalta."); } },
      { id: "possu", name: "säästöpossu", x: 184, y: 96, w: 16, h: 12, at: 176, aty: 114,
        Katso: () => say("Säästöpossu. Sen ilme kertoo kaiken."),
        Avaa: async () => { if (st.flags.pig) return say("Possu on tyhjä. Kuten minäkin, sisältä."); st.flags.pig = true; give("rahat"); await say("3,50 € ja nappi. Ei riitä edes Mouho-osallistumismaksun postimerkkiin."); },
        Poimi: () => spot("koti", "possu").Avaa(), Käytä: () => spot("koti", "possu").Avaa() },
      { id: "taksi", name: "taksi lentokentälle", x: 256, y: 80, w: 56, h: 32, at: 250,
        Katso: () => say("Taksi lentokentälle. Kuljettaja lukee Liigan otteluohjelmaa. Hän näyttää huolestuneelta."),
        Käytä: () => leave(), Avaa: () => leave(), Puhu: () => say("Kuljettaja: \"Lentokentälle? Taas Milanoon? Ai, Istanbuliin. No, lippu ensin.\"", "muu") },
    ],
  },
  basaari: {
    title: "Suuri basaari, Istanbul", scale: [109, 134], walk: [[[16, 109], [304, 109], [318, 135], [2, 135]]],
    actors: [{ id: "kauppias", x: 226, y: 108, h: 46, color: "#fc54fc", draw: (t, talking) => merchant(226, 108, t, talking) }],
    draw: basaariDraw,
    props: [{ y: 129, draw: () => { shadow(62, 129, 7); disc(62, 121, 7, "#b85c2c", "#8c3c1c"); r(59, 110, 7, 5, "#a84c24"); r(58, 109, 9, 2, "#c86c3c"); r(57, 116, 2, 4, "#8c3c1c"); r(66, 116, 2, 4, "#8c3c1c");
      px(59, 118, "#e88c5c"); px(60, 117, "#e88c5c"); r(58, 122, 9, 1, "#e8c81c"); } }],
    spots: [
      { id: "amfora", name: "amfora", x: 54, y: 108, w: 16, h: 22, at: 76, aty: 129,
        Katso: () => say("Amfora. Kyljessä lukee \"ÄLÄ AVAA\". Kerrankin kunnioitan ohjetta."), Avaa: () => say("Siinä lukee \"älä avaa\". Opin jotain Milanosta.") },
      { id: "matto", name: "matto", x: 30, y: 70, w: 34, h: 38, at: 48,
        Katso: async () => { st.flags.map = true; iq("kartta", 8); await say("Mattoon on kudottu kartta! Kappadokia... luolatemppeli... ja punainen rasti.\nPainan sen mieleeni. Itäinen kuja vie sinne."); },
        Poimi: () => say("Kauppias: \"Matto maksaa enemmän kuin sinä.\"", "kauppias"), Työnnä: () => say("Matto ei lennä. Tarkistin.") },
      { id: "pussi", name: "kangaspussi", x: 86, y: 72, w: 14, h: 20, at: 94, hidden: () => st.flags.bag,
        Katso: () => say("Tyhjä kangaspussi naulassa. Siinä lukee \"ILMAINEN\". Tässä basaarissa se on epäilyttävää."),
        Poimi: async () => { st.flags.bag = true; give("pussi"); await say("Otan sen. Se oli ilmainen. Luulisin."); } },
      { id: "ruoska", name: "ruoska", x: 220, y: 60, w: 22, h: 16, at: 206, hidden: () => st.whip,
        Katso: () => say("Ruoska. Jokainen arkeologi tarvitsee ruoskan. Ja hatun."), Poimi: () => say("Kauppias katsoo minua kuin haukka. Haukka, jolla on fetsi."), },
      { id: "kauppias", name: "kauppias", actor: true, x: 216, y: 70, w: 22, h: 40, at: 204,
        Katso: () => say("Basaarin kovin tinkijä, Mehmet. Kuulemma hän on myynyt hiekkaa autiomaahan ja logon Lappeenrantaan."),
        Puhu: () => talk(), Anna: (it) => it === "idoli" ? sellIdol() : it === "rahat" ? say("Kauppias: \"3,50 ja nappi? Tingi ensin, sitten puhutaan.\"", "kauppias") : say("Kauppias: \"Ei kiitos.\"", "kauppias") },
      { id: "itaan", name: "itäinen kuja", x: 304, y: 70, w: 16, h: 40, at: 300, exit: true,
        Katso: () => say(st.flags.map ? "Kuja Kappadokiaan, kartan mukaan." : "Pimeä kuja. En tiedä mihin se vie."), Käytä: () => toTemple(), Kävele: () => toTemple() },
    ],
  },
  temppeli: {
    title: "Unohdettu luolatemppeli, Kappadokia", scale: [111, 134],
    // Kuilun takaosa on oma kävelyalueensa: siihen ei ole reittiä ennen ruoskaa.
    // Ylityksen jälkeen kuilun pohjalle ilmestyy kapea reunus, joka yhdistää ne.
    walk: () => st.flags.crossed ? [[[14, 111], [158, 111], [158, 135], [2, 135]], [[198, 111], [306, 111], [318, 135], [198, 135]], [[150, 130], [206, 130], [206, 135], [150, 135]]]
                                 : [[[14, 111], [156, 111], [156, 135], [2, 135]]],
    draw: temppeliDraw,
    post: temppeliPost,
    props: [{ y: 130, draw: () => { shadow(122, 130, 15); r(108, 121, 28, 9, "#6c5a46"); r(108, 121, 28, 2, "#86704e"); r(108, 128, 28, 2, "#4c3c2c"); r(134, 121, 3, 9, "#5a4a38");
      r(116, 122, 1, 6, "#3c2c1c"); r(124, 123, 1, 5, "#3c2c1c"); disc(108, 125, 4, "#5a4a38"); } }],
    spots: [
      { id: "pylvas", name: "kaatunut pylväs", x: 104, y: 118, w: 34, h: 13, at: 122, aty: 133,
        Katso: () => say("Kaatunut pylväs. Siinä on enemmän ryhtiä kuin minulla maanantaisin."), Työnnä: () => say("Se ei liiku. Eikä sen kuulukaan. Se on jo kaatunut kerran.") },
      { id: "hiekka", name: "hiekka", x: 68, y: 92, w: 34, h: 16, at: 88,
        Katso: () => say("Hienoa hiekkaa. Täydellistä säkkeihin. Ei kysytä, miksi luolassa on hiekkaa."),
        Poimi: () => say("Kourallinen ei riitä. Tarvitsisin jonkin astian."),
        "Käytä:pussi": async () => { take("pussi"); give("sakki"); iq("hiekkasakki", 10); await say("Täytän pussin. Hiekkasäkki valmis! Painaa varmaan saman verran kuin idoli."); } },
      { id: "reliefi", name: "kivireliefi", x: 110, y: 42, w: 40, h: 32, at: 128,
        Katso: () => (iq("reliefi", 5), say("Muinainen otteluohjelma, hakattu kiveen tuhansiksi vuosiksi.\nJoku on silti siirtänyt kolmea ottelua lyhyellä varoitusajalla.")),
        Työnnä: () => say("Se ei liiku. Kiveen hakattu ohjelma ei siirry. Tai ei ainakaan pitäisi.") },
      { id: "kuilu", name: "kuilu", x: 160, y: 106, w: 36, h: 30, at: 150, aty: 122,
        Katso: () => say("Pohjaton kuilu. Tai ainakin syvä. En aio mitata."),
        Kävele: () => say("En hyppää tuon yli. Olen seikkailija, en urheilija.") },
      { id: "koukku", name: "koukku", x: 168, y: 12, w: 18, h: 20, at: 148,
        Katso: () => say("Rautakoukku katossa kuilun yllä. Joku on ajatellut minua."),
        "Käytä:ruoska": async () => { st.flags.whipHung = true; take("ruoska"); await say("Hop!"); place(156, st.y); for (let i = 0; i < 24; i++) { st.x += 2.2; await sleep(30); } st.flags.crossed = true; st.flags.whipHung = false; give("ruoska"); iq("ruoska", 15); await say("Juuri kuten harjoittelin. En harjoitellut."); await say("...Ja tuolla on kapea reunus. Olisin voinut kävellä."); } },
      { id: "idoli", name: "kultainen idoli", x: 248, y: 70, w: 20, h: 18, at: 240, hidden: () => st.flags.idol && !st.flags.swapped,
        Katso: () => say(st.flags.swapped ? "Hiekkasäkki jalustalla. Se ei huijaa ketään pitkään." : "Kultainen idoli. Mouho-osallistumismaksu muodossa, joka hymyilee."),
        Poimi: () => st.flags.idol ? say("Se on jo minulla.") : say("Liian helppoa. Jalustassa on varmasti ansa. Tarvitsen jotain samanpainoista vaihtoon."),
        "Käytä:sakki": () => grabIdol() },
      { id: "ovi", name: "käytävä basaariin", x: 0, y: 60, w: 14, h: 48, at: 18, exit: true,
        Katso: () => say("Käytävä takaisin basaariin."), Käytä: () => go("basaari", 290), Kävele: () => go("basaari", 290) },
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
    await say("Basaari! Täällä myydään kaikkea. Ehkä jopa Mouho-osallistumismaksuja.");
  });
}
async function toTemple() {
  await script(async () => {
    if (!st.flags.map) return say("En tiedä mihin tämä kuja vie. Jossain täällä on varmasti kartta.");
    if (!st.whip) return say("Luolatemppeliin ilman ruoskaa? Elokuvissa kaikilla on ruoska.");
    await walkTo(300); go("temppeli", 30, true);
    await say("Hämähäkinseittejä, soihtuja ja kuilu. Juuri kuten kirjeessä luvattiin.");
  });
}
async function grabIdol() {
  await script(async () => {
    take("sakki"); iq("idoli", 20); await say("Rauhallisesti... vaihdetaan sulavasti...");
    st.flags.idol = true; st.flags.swapped = true; give("idoli"); await sleep(600);
    await say("...", "muu"); await say("Jalusta painuu. Tietysti se painuu.");
    st.flags.boulder = 340; await say("JUOKSE!");
    walkTo(18, 126); const tick = setInterval(() => { st.flags.boulder -= 3.2; }, 30);
    while (st.x > 24) await sleep(40); clearInterval(tick); st.flags.boulder = null;
    go("basaari", 290, true); await say("Hengissä. Ja rikas. No, pian rikas.");
  });
}

// Kaupanteko haukkumalla, kuten miekkailu Melee Islandilla: oikea vastaus kolmesti.
const BARGAIN = [
  { a: "Tuollaisella hatulla et pääse edes Mikkelin torille!", ok: "Ja tuollaisilla hinnoilla et myisi edes Mikkelin torilla.", no: ["Ai.", "Hattu on isoisän!"] },
  { a: "Äitini tinkii paremmin kuin sinä!", ok: "Ilmeisesti, koska hän ei ole koskaan ostanut sinulta mitään.", no: ["Terveisiä äidillesi.", "Minulla on kumikana väkipyörällä."] },
  { a: "Sinä maksaisit ennakkoon kenelle tahansa, joka puhuu italiaa!", ok: "Siksi tingin nyt turkiksi, enkä maksa mitään ennakkoon.", no: ["Grazie.", "Tarvitsen tulkin."] },
  { a: "Tämä ruoska kuului itse sulttaanille!", ok: "Sitten sulttaani ostaa sen takaisin kalliimmalla.", no: ["Wau.", "Katso takanasi, kolmipäinen kameli!"] },
];
async function talk() {
  await script(async () => {
    while (true) {
      const opts = []; if (!st.whip) opts.push("Paljonko ruoska maksaa?", "Tingitään ruoskasta!"); if (!st.flags.logo) opts.push("Teettekö logoja?"); if (!st.flags.seura) opts.push("Ostaisitteko jääkiekkoseuran?"); if (has("idoli")) opts.push("Kiinnostaisiko kultainen idoli?"); opts.push("Ei mitään, näkemiin.");
      const pick = opts[await choose(opts)]; await say(pick);
      if (pick.startsWith("Paljonko")) await say("Sinulle, ystäväni, vain 500 liiraa. Ja hattusi.", "kauppias");
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
  take("rahat"); st.whip = true; give("ruoska"); iq("tinkiminen", 20); await say("Ruoska! Nyt minusta puuttuu vain idoli ja kunnollinen tunnari."); return true;
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

// ---------------------------------------------------------------- salkkumies (satama)
// Kysyy otteluohjelmasta ja tarjoaa lisärahoitusta. Ei kuulu ratkaisuun: tämä on
// hahmo, jolle Jussi saa näyttää oppineensa jotain.
async function salesmanTalk() {
  await script(async () => {
    if (!st.flags.metSales) { st.flags.metSales = true;
      await say("Psst! Markkanen! Onko otteluohjelma jo valmis? Meidän porukka varasi lauantaille saunan.", "salkkumies"); }
    while (true) {
      const opts = [];
      if (!st.flags.salesSchedule) opts.push("Otteluohjelma? En ole enää urheilujohtaja.");
      if (!st.flags.salesMoney) opts.push("Sanoit jotain lisärahoituksesta?");
      opts.push("Lainaisitko 500 euroa Mouho-osallistumismaksuun?");
      if (has("kirje") && !st.flags.salesSignor) opts.push("Tunnetko Signor Investimentin?");
      opts.push("Näkemiin.");
      const pick = opts[await choose(opts)]; await say(pick);
      if (pick.startsWith("Otteluohjelma")) { st.flags.salesSchedule = true;
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

// ---------------------------------------------------------------- tavarakuvakkeet (24 x 16)
ITEMS.kirje.icon = () => { r(3, 3, 18, 11, "#ececec"); r(3, 3, 18, 1, "#fcfcfc"); for (let k = 0; k < 9; k++) { px(3 + k, 4 + k / 2, "#a8a8a8"); px(20 - k, 4 + k / 2, "#a8a8a8"); } disc(12, 9, 2, "#c81c1c"); };
ITEMS.lippu.icon = () => { r(2, 4, 20, 9, "#3c7cdc"); r(2, 4, 20, 1, "#7cacfc"); r(15, 4, 1, 9, "#fcfcfc"); r(4, 7, 9, 1, "#fcfcfc"); r(4, 9, 6, 1, "#c8dcfc"); r(17, 6, 3, 2, "#fcd41c"); };
ITEMS.rahat.icon = () => { disc(8, 9, 4, "#e8c81c", "#a8841c"); disc(14, 7, 4, "#d8b81c", "#a8841c"); px(13, 6, "#fcf09c"); disc(19, 11, 2, "#8c5c3c", "#5c3c24"); px(18, 11, "#2c1c10"); px(20, 11, "#2c1c10"); };
ITEMS.pussi.icon = () => { r(7, 5, 10, 9, "#c8b48c"); r(6, 4, 12, 2, "#e0d0a8"); r(10, 2, 4, 3, "#a8946c"); r(15, 6, 2, 8, "#a8946c"); };
ITEMS.sakki.icon = () => { disc(12, 10, 5, "#c8b48c", "#a8946c"); r(10, 2, 4, 4, "#a8946c"); px(9, 9, "#e0d0a8"); r(6, 13, 12, 1, "#8c7850"); };
ITEMS.ruoska.icon = () => { r(3, 10, 5, 3, "#3c2410"); for (let k = 0; k < 14; k++) px(8 + k, 10 - Math.sin(k / 2.2) * 5, "#8c5c2c"); px(21, 6, "#6c4420"); };
ITEMS.kortti.icon = () => { r(3, 4, 18, 9, "#f4f0e4"); r(3, 4, 18, 1, "#fff"); r(5, 6, 6, 1, "#2c2c3c"); r(5, 8, 10, 1, "#8c8c8c"); r(5, 10, 8, 1, "#8c8c8c"); r(16, 6, 3, 3, "#c8a030"); };
ITEMS.idoli.icon = () => { r(9, 4, 6, 10, "#e8c81c"); r(10, 2, 4, 3, "#e8c81c"); r(9, 4, 2, 10, "#fcf06c"); r(13, 4, 2, 10, "#b8941c"); px(10, 7, "#3c2c0c"); px(13, 7, "#3c2c0c"); r(8, 14, 8, 1, "#8c6c1c"); px(15, 2, "#fff"); };

// ---------------------------------------------------------------- käynnistys
startEngine({
  titleScreen: drawTitle, startRoom: "koti", startX: 60,
  intro: async () => { await say("Syvällä Etelä-Karjalassa, Saimaan rannalla..."); await say("Entisellä urheilujohtajalla on yhtäkkiä paljon vapaa-aikaa."); await say("Mouho 2026 lähestyy, ja minulta puuttuu Mouho-osallistumismaksu.\nJonkun täytyy tietää, mistä 500 euroa löytyy."); },
});
