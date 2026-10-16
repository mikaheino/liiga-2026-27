# Miten Liiga Ennustaja -malli toimii

Tämä tiedosto on agentin tietopankkia (Cortex Search, työkalu `liiga_tieto`).
Luvut tulevat mallin asetuksista (`config.yaml`) ja niiden mittauksista.

## Kokonaisuus lyhyesti

Malli ennustaa Liigan runkosarjan 2026-27 (17 joukkuetta, 544 ottelua, 64 ottelua
per joukkue). Se rakentaa jokaiselle ottelulle voittotodennäköisyydet kahdesta
osasta -- pelaajapohjaisesta Poisson-mallista (paino 40 %) ja joukkuetason
Elo-mallista (paino 60 %) -- ja simuloi jäljellä olevat ottelut 10 000 kertaa.
Kauden aikana jo pelattujen otteluiden pisteet ovat mukana sellaisinaan
("pankitetut pisteet"), ja vain loput simuloidaan. Ennuste päivittyy joka aamu.

Malli ennustaa vain runkosarjaa. Pudotuspelejä ei simuloida, joten "mestaruus"
tarkoittaa mallin luvuissa runkosarjan voittoa.

## 1. Jokaiselle pelaajalle maalitahti

Pelaajan viiden viimeisen kauden maalit ja ottelut yhdistetään. Tuoreet kaudet
painavat enemmän: jokainen vanhempi kausi saa 0,80-kertaisen painon edelliseen
nähden. Pieni otos vedetään kohti pelipaikan keskiarvoa (regressio, vahvuus 20
ottelua), jotta muutaman ottelun pelaaja ei saa äärimmäistä arvoa.

## 2. Ikä

Maalitahti on huipussaan 26-vuotiaana ja laskee 1,5 % jokaista vuotta kohden
huipusta poispäin. 33 ikävuoden jälkeen pudotus jyrkkenee 4 % lisää vuodessa,
alarajana puolet. Tämä perustuu Liigan omaan dataan: pelaajien maalitahti
seuraavalla kaudella oli 35-37-vuotiailla mediaanina 0,67-kertainen ja 38+
-vuotiailla 0,40-kertainen edelliseen kauteen verrattuna.

## 3. Sarjojen tasoerot

Muissa sarjoissa tehdyt maalit muunnetaan Liiga-tasolle kertoimella, esimerkiksi:
NHL 1,85; KHL 1,40; SHL 1,20; AHL 1,15; Liiga, Tšekki ja Sveitsi 1,00; NCAA ja
DEL 0,80; Allsvenskan 0,75; CHL ja Itävalta 0,55; Slovakia 0,50; Mestis 0,35;
Liigan U20 0,20. Sveitsin kerroin nostettiin 0,83:sta 1,00:aan ja DEL:n
0,75:stä 0,80:aan heinäkuussa 2026 kolmen riippumattoman lähteen perusteella.

## 4. Joukkueen hyökkäys

Joukkueen hyökkäysvoima on sen 18 parhaan kenttäpelaajan ennustettujen
maalitahtien summa, skaalattuna niin että liigan keskiarvo on 2,9 maalia per
ottelu. Joukkueen oma tehtyjen maalien historia painaa 15 %, pelaajat 85 %.

## 5. Maalivahdit ja puolustus

Puolustus perustuu ensisijaisesti maalivahteihin (paino 70 %), loput joukkueen
omasta päästettyjen maalien historiasta. Jokaiselle maalivahdille ennustetaan
torjuntaprosentti hänen historiastaan (muiden sarjojen torjunnat korjataan
sarjan tason mukaan) ja vedetään kohti 90,5 %:a 25 ottelun painolla. Joukkueen
maalivahtipeli on rosterin maalivahtien painotettu keskiarvo, painona viime
kausien ottelumäärät -- eli todennäköinen ykkösvahti painaa eniten. Liigan
keskimääräinen torjunta on 90,8 %.

## 6. Ottelumalli (Poisson-osa)

Kummankin joukkueen odotettu maalimäärä = liigan keskiarvo 2,9 x oma hyökkäys x
vastustajan puolustus, kotijoukkueella lisäksi kotietu 1,08. Maalimäärät
oletetaan Poisson-jakautuneiksi, ja niistä lasketaan kotivoiton, tasapelin
(60 minuutin jälkeen) ja vierasvoiton todennäköisyydet. Nämä ovat
"maaliodottamat", jotka agentti näyttää 1X2-vastauksissa.

## 7. Jatkoaika

Pelkkä Poisson-laskenta ennustaa jatkoajalle noin 16 % otteluista, mutta Liigassa
osuus on ollut noin 23 %. Tasapelien todennäköisyyttä kasvatetaan, kunnes
osuus vastaa historiaa. Jatkoaika tai voittolaukaukset ovat lähes kolikonheitto:
suosikki voittaa 52 % (mitattu 533 ottelusta). Jatkoaikavoitto on 2 pistettä,
tappio 1.

## 8. Elo-osa

Jokainen joukkue aloittaa 1500 pisteestä. Voitto siirtää pisteitä häviäjältä
voittajalle sitä enemmän, mitä yllättävämpi tulos ja mitä suurempi maaliero
(maalieroskaalattu Elo, k = 16). Joka kesä luokitukset palautetaan puoliväliin
kohti 1500:aa. Kauden aikana Elo oppii pelatuista otteluista, joten se reagoi
joukkueen todelliseen tasoon -- mutta se ei tiedä, ketkä pelaavat.

## 9. Yhdistelmä 40/60

Jokaisen ottelun todennäköisyys = 0,4 x Poisson-osa + 0,6 x Elo-osa. Painot
valittiin neljän historiallisen kauden testissä (log-loss ja pisteiden
keskivirhe), ja kolmas Elo-variantti ei parantanut tulosta.

## 10. Yleisöarvio

40 Jatkoaika.comin keskustelijaa ennusti lopputaulukon ennen kautta. Heidän
keskimääräinen sijansa muunnetaan pisteiksi ja yhdistetään mallin pisteisiin
20 %:n painolla ennen kautta. Paino hiipuu sitä mukaa kuin kausi etenee (20 % x
pelaamatta olevien otteluiden osuus). Yleisö vaikuttaa vain ennustettuihin
pisteisiin ja sijaan, ei voittotodennäköisyyksiin.

## 11. Simulaatio

Jäljellä olevat ottelut pelataan 10 000 kertaa ottelukohtaisilla
todennäköisyyksillä (siemen 42). Tuloksena saadaan ennustetut pisteet
(keskiarvo ja 5-95 %:n väli), sijajakauma, runkosarjan voiton todennäköisyys ja
vyöhyketodennäköisyydet: 1.-6. suoraan puolivälieriin, 7.-10. säälipudotuspeleihin,
15.-17. putoaa (uutta kaudella 2026-27).

## Mitä mallia ei viritetä kesken kauden

Mallin asetuksia ei muuteta kauden aikana. Kaikki parannukset mitataan kauden
päätyttyä log-lossilla ja pisteiden keskivirheellä. Kauden aikana muuttuvat vain
data: tulokset, Elo, kokoonpanot ja pelaajasiirrot.
