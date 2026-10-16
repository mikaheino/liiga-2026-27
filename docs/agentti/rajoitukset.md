# Rajoitukset ja mitä malli ei tiedä

Tämä tiedosto on agentin tietopankkia (`liiga_tieto`). Kun käyttäjä kysyy
asiaa, jota malli ei osaa, vastaa suoraan mitä puuttuu ja miksi.

## Pudotuspelit

Malli ennustaa vain runkosarjan. Pudotuspelejä, säälipudotuspelejä eikä
mestaruutta simuloida. "Runkosarjan voitto" on lähin luku, jonka malli antaa.

## Torjuntaprosentti kuluvalta kaudelta

liiga.fi ei julkaise laukauksia maalivahtikohtaisesti, joten kuluvan kauden
torjuntaprosenttia ei voi laskea. Kuluvalta kaudelta tiedetään maalivahdin
aloitukset ja päästetyt maalit; vertailu tehdään odotettuihin maaleihin
(vastustajan xG). Mallin ennustama torjuntaprosentti perustuu aiempiin kausiin.

## Pelaajakohtainen xG

liiga.fi antaa maaliodottaman (xG) vain joukkueelle per ottelu, ei laukaukselle
eikä pelaajalle. Pelaajien maalintekoa ei siksi voi verrata heidän
maalipaikkoihinsa.

## Kokoonpanot ja loukkaantumiset

Mallin Elo-osa (60 % painosta) ei tiedä, ketkä pelaavat. Kokoonpanot
vaikuttavat vain pelaajapohjaiseen osaan, joten loukkaantumisten ja
kokoonpanojen vaikutus on arviona varovainen. Pelipäivän kokoonpanot julkaistaan
liiga.fi:ssä vasta vähän ennen ottelua; sitä ennen ennuste olettaa joukkueen
täyden rosterin.

## Uudet pelaajat

Pelaaja, jolla ei ole tilastoja Liigasta eikä muista sarjoista, saa
korvaustason arvon. Pelaaja, joka ei ole tehnyt Liigassa yhtään pistettä, ei
näy pistetilastoista lainkaan, vaikka hän olisi pelannut.

## Rangaistuslaukaukset

liiga.fi kirjaa myös epäonnistuneet rangaistuslaukaukset maalitapahtumiksi
(koodi RL0). Agentin pistepörssi ja tilastonäkymät eivät laske niitä maaleiksi,
mutta mallin historiallinen pelaajadata laskee: noin 1,4 % kaikista maaleista
2022-26. Asia on tiedossa eikä sitä korjata kesken kauden, koska korjaus muuttaisi
julkaistua ennustetta.

## Mallin viritys

Mallin asetuksia ei muuteta kesken kauden, vaikka jokin vaikuttaisi
poikkeavalta (esim. kotietu). Muutokset testataan kauden jälkeen.

## Vedonlyönti

Malli ei ole osoittanut etua vedonlyöntimarkkinaan nähden. Agentti antaa
todennäköisyydet ja reilut kertoimet, mutta ei pelisuosituksia eikä panoksia.

## Muut sarjat

Vain Liigan 17 joukkuetta. Mestiksen, NHL:n tai muiden sarjojen otteluita ja
joukkueita ei ennusteta; Mestis-joukkueen nousua Liigaan ei voi simuloida.
