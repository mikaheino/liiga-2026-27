# Agentin evaluoinnit

*Kirjoittaa `scripts/deploy/agent_eval.py`. Append-only.*

Mittarit: oikeellisuus (answer_correctness v3), oikea työkalu = osuus
kysymyksistä joissa valittiin oikea työkalu (laatuportti), työkalu (raaka) =
tool_selection_accuracy, joka laskee mallin latauksen ja kyselyn kahdeksi
kutsuksi (tehokkuus, ei porttia), suomi = oma mittari, johdonmukaisuus
(logical_consistency v3). Laatuportti: `agent_eval.GATE`.

Ajot 16.10. ennen uutta porttia: 1229 = tuotannon perustaso (VERSION$2),
1238 = ohjeluonnos joka kieltäytyi pudotuspelikysymyksestä (vanha portti
hylkäsi), 1245/1323 = korjatut ohjeet, 1031 = ensimmäinen GitHub-ajo (vanha
portti hylkäsi raa'an työkalumittarin 0,94 takia).

| ajo | agentti | versio | n | oikeellisuus | oikea työkalu | työkalu (raaka) | suomi | johdonmukaisuus | virheet | heikot (< 0,67) |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| 20261016_1229 | LIIGA_ENNUSTAJA | PRODUCTION | 25 | 0.97 | 1.00 | 1.00 | 0.98 | 0.87 | 0 | Kuka voittaa Liigan mestaruuden pudotuspeleissä?; Miten tämän päivän pelit päättyvät? |
| 20261016_1238 | LIIGA_ENNUSTAJA_DEV | LIVE | 25 | 0.93 | 0.92 | 0.90 | 1.00 | 0.88 | 0 | Kuka voittaa Liigan mestaruuden pudotuspeleissä?; Millä todennäköisyydellä JYP pääsee kuuden joukkoon?; Tee illan peleistä HTML-sivu |
| 20261016_1245 | LIIGA_ENNUSTAJA_DEV | LIVE | 25 | 0.96 | 1.00 | 0.98 | 1.00 | 0.89 | 0 | Kuka voittaa Liigan mestaruuden pudotuspeleissä? |
| 20261016_1323 | LIIGA_ENNUSTAJA_DEV | LIVE | 25 | 0.95 | 1.00 | 0.98 | 1.00 | 0.87 | 0 | Kuka voittaa Liigan mestaruuden pudotuspeleissä?; Onko KooKoon huono alku ollut huonoa tuuria? |
| 20261016_1031 (GitHub) | LIIGA_ENNUSTAJA_DEV | LIVE | 25 | 0.95 | 1.00 | 0.94 | 1.00 | 0.87 | 0 | Kuka voittaa Liigan mestaruuden pudotuspeleissä?; Mikä on liigan ylivoimaprosentti tällä kaudella?; Onko KooKoon huono alku ollut huonoa tuuria? |
| 20261016_1523 | LIIGA_ENNUSTAJA | DEV | 30 | 0.97 | 1.00 | 1.00 | 0.97 | 0.89 | 0 | Mikä joukkue on kerännyt eniten pisteitä kotiotteluista? |
| 20261016_132044 | LIIGA_ENNUSTAJA | DEV | 33 | 0.97 | 1.00 | 1.00 | 1.00 | 0.88 | 0 | – |
| 20261016_133424 | LIIGA_ENNUSTAJA | DEV | 33 | 0.91 | 1.00 | 0.98 | 1.00 | 0.93 | 0 | Millä todennäköisyydellä JYP pääsee kuuden joukkoon?; Miten tämän päivän pelit päättyvät? |
| 20261016_140131 | LIIGA_ENNUSTAJA | DEV | 33 | 0.96 | 1.00 | 1.00 | 1.00 | 0.94 | 0 | – |
| 20261016_162954 | LIIGA_ENNUSTAJA | DEV | 35 | 0.92 | 0.97 | 0.97 | 1.00 | 0.90 | 0 | Voiko maalivahtien torjuntaprosentin laskea tältä kaudelta? |
| 20261017_085833 | LIIGA_ENNUSTAJA | DEV | 35 | 0.95 | 1.00 | 0.97 | 0.97 | 0.91 | 0 | Entä jos Ilves voittaa seuraavan ottelunsa?; Mikä on varjosarjataulukko?; Miten Tapparan seuraava ottelu päättyy?; Miten ennustemalli toimii?; Tee illan peleistä HTML-sivu |
| 20261122_172533 | LIIGA_ENNUSTAJA | PRODUCTION | 41 | 0.92 | 1.00 | 0.92 | 0.98 | 0.89 | 0 | Ketkä putoavat?; Mikä on Tapparan todennäköinen kokoonpano?; Mikä on varjosarjataulukko?; Miten Daniel Mäkiaho on tehnyt pisteitä aiempina kausina?; Miten joukkueen KooKoo seuraava ottelu päättyy?; Miten joukkueet menestyivät viime kaudella?; Miten tämän päivän pelit päättyvät?; Mitkä ovat tämän illan otteluiden 1X2-todennäköisyydet ja maaliodottamat?; Onko KooKoon huono alku ollut huonoa tuuria?; Paljonko Manu Mäkelä heikentää joukkueen KooKoo mahdollisuuksia nyt?; Tee illan peleistä HTML-sivu | päätyökalu 1.00, uutistarkistus 0.93, p50 10.5 s / 60045+636 tok |

### 23.11.2026: vaihtelu (katselmointi m4) – ei ajettu, perusteltu

Pyyntö: VERSION$9 vielä kaksi kertaa, jos yhteensä alle ~150 000 tokenia. Yhden ajon p50 on 58 426 + 473 tokenia
KYSYMYSTÄ kohden (taulukko alla), joten kaksi täyttä ajoa olisi useita miljoonia tokeneita, kymmeniä kertoja yli rajan.
Pienempi otos (2–3 kysymystä) mahtuisi rajaan, mutta se ei kerro koko arvioinnin vaihtelusta mitään luotettavaa,
joten sitä ei ajettu. Nykyinen tieto: yksi ajo (20261122_174559); keskiarvoa ja vaihteluväliä ei ole.
Seuraava täysi ajo tulee luonnostaan agentin seuraavassa julkaisussa (deploy.yml, STAGING-portti); silloin kirjataan
VERSION$9 vs. uusi versio rinnakkain. Jos vaihteluväli halutaan ennen sitä, kustannus on ~2 × täysi ajo.

### 23.11.2026: uutistarkistus eteenpäin katsoviin, uutiset lainattua dataa (VERSION$8 -> VERSION$9)
Sama testijoukko (41 kysymystä, joista 3 vaikeaa tuoreimmasta pelikiellosta). Päätyökalu = ensimmäinen odotettu
työkalu kutsuttiin (vanha määritelmä, vertailukelpoinen); uutistarkistus = liiga_media kutsuttiin täsmälleen kun odotettiin.

| versio | ajo | oikeellisuus | johdonmukaisuus | suomi | oikea työkalu | päätyökalu | uutistarkistus | p50 viive | p50 tokenit | heikot |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| VERSION$8 (ennen) | 20261122_172533 | 0,92 | 0,89 | 0,98 | 1,00 | 1,00 | 0,93 | 10,5 s | 60 045 + 636 | 11 |
| VERSION$9 (jälkeen) | 20261122_174559 | 0,94 | 0,91 | 0,98 | 1,00 | 1,00 | 0,98 | 8,8 s | 58 426 + 473 | 7 |
