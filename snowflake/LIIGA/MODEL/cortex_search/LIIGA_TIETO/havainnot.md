# Mitatut havainnot

Tämä tiedosto on agentin tietopankkia (`liiga_tieto`). Jokainen väite on
mitattu tämän projektin datasta; lähde ja otos on mainittu. Kauden aikana
muuttuvat luvut (osumaprosentti, sarjatilanne) haetaan aina tuoreena muilla
työkaluilla, ei tästä tiedostosta.

## Mallin tarkkuus historiassa (backtest)

Testattu vuotamattomasti kausilla 2023-2026 (malli ei nähnyt testikauden dataa):
lopullisten pisteiden keskivirhe noin 12,7 pistettä, sijan keskivirhe noin 3,4
sijaa, ja top 6 -joukkueista osui 3-5. Otteluennusteiden log-loss 0,672
verrattuna perustason 0,686:een, eli malli on parempi kuin pelkkä kotiedun ja
tasapelien keskiarvo kolmella kaudella neljästä. Vaikein kausi oli 2024-25
(laajennus 15 -> 16 joukkueeseen ja suuri vaihtuvuus).

Kuluvan kauden osumaprosentti haetaan aina tuoreena (työkalu `liiga_kausi`).
Sitä verrataan "aina kotijoukkue" -perustasoon, ei 50 %:iin.

## Kotietu

Kotijoukkue voitti kauden ensimmäisissä otteluissa noin 59 % (104 ottelua),
kun malli odotti noin 53-54 %. Ero testattiin lokakuussa 2026: se ei ole
tilastollisesti merkitsevä (z = 0,78), eli se mahtuu satunnaisvaihteluun, eikä
mallin kotietua muutettu. Historiallinen kotietu on mallissa kerroin 1,08
odotettuihin maaleihin.

## Maalipaikat (xG) ja "onni"

Kausilla 2022-26 (77 joukkuekautta), 10 ensimmäisen ottelun jälkeen, ennustaa
loppukauden pisteitä per ottelu:
- oikea sarjataulukko: korrelaatio 0,26
- varjosarjataulukko (odotetut pisteet maalipaikoista): 0,32
- viimeistelyonnen (maalit miinus xG) pysyvyys: 0,08 -- käytännössä sattumaa
- pelin hallinnan (xG-ero) pysyvyys: 0,53

Eli maalipaikoista laskettu taulukko kertoo loppukaudesta hieman paremmin kuin
oikea taulukko, ja viimeistelyn onni tasoittuu. Kumpikaan ei ennusta 10 ottelun
kohdalla kovin hyvin. Kuluvan kauden xG:n lisääminen ennusteeseen testattiin,
eikä se parantanut mallia.

liiga.fi:n xG ei sisällä tyhjään maaliin laukaistuja paikkoja: jokainen tyhjä
maali nostaa (maalit - xG) -erotusta keskimäärin 1,61 (4 730 joukkueottelua).

## Peli ratkeaa usein 40 minuutissa

Kahden erän jälkeen johtanut joukkue voitti kausilla 2022-26 86,3 % otteluista
(1 779 ottelua). Kauden 2026-27 alussa osuus oli korkeampi, mutta ero ei ollut
tilastollisesti merkitsevä (z = 1,3).

## Maalivahdit

Alkukauden maalivahtipelin etu tai haitta (torjunnat odotusta vastaan) tasoittuu
suurelta osin: korrelaatio alkukauden ja loppukauden välillä 0,17. Siksi
heikosti alkanutta maalivahtia ei kannata tuomita 10 ottelun perusteella.

## Ennusteen muutos esikaudesta

Ennusteen liike jaetaan kolmeen osaan: tulokset vs. odotus, kokoonpanomuutokset ja
mallin uusi arvio jäljellä olevista otteluista. Esimerkki lokakuulta 2026:
KooKoon ennuste putosi noin 30 pistettä, josta noin 19 tuli jo pelatuista
otteluista, noin 11 mallin uudesta arviosta ja alle 1 kokoonpanoista. Ajantasaiset
luvut haetaan työkalulla `liiga_ennuste`.

## Pelaajamuutosten vaikutus on varovainen

Kokoonpanot ja loukkaantumiset vaikuttavat vain mallin pelaajapohjaiseen osaan
(40 %). Elo-osa (60 %) ei tiedä, ketkä pelaavat. Esimerkki: Maxime Fortierin
poissaolo koko kaudeksi laski Jokerien odotettuja maaleja 0,36 per ottelu ja nosti
putoamisriskiä noin 41 %:sta 56 %:iin.
