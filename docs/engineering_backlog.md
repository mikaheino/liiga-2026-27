# Kehitysprosessin backlog

Kehitys-, julkaisu- ja työkaluasiat. Mallin parannusideat ovat erikseen:
`docs/model_improvement_ideas.md`.

---

## 1. Muutokset pull requestien kautta, automaattihyväksyntä pienille (lisätty 2026-10-16)

**Nyt:** muutokset pushataan suoraan mainiin. CI (`ci.yml`) ajetaan, mutta
se ei estä mitään: punainen CI-ajo ja vihreä samaan aikaan mainissa ovat
mahdollisia. Tuotannon agenttiversio on suojattu erikseen (production-ympäristön
hyväksyntä + evaluoinnin laatuportti), mutta main itse ei ole.

**Tavoite:** kaikki muutokset PR:n kautta, mutta ilman käsityötä tavallisille
muutoksille.

- **Pienet muutokset hyväksytään ja yhdistetään automaattisesti**, kun CI on
  vihreä: rosterierät (`data/transfers_*`, `external_players.csv`,
  `goalies_raw.txt`), dokumentaatio, diat ja sovellus, ideat ja raportit.
- **Isot muutokset vaativat erillisen hyväksynnän:** kaikki mikä muuttaa
  julkaistua agenttia, sen oikeuksia tai putkea --
  `scripts/deploy/semantic_views*.py`, `scripts/deploy/deploy_agent.py`,
  `scripts/deploy/agent_eval.py` (laatuportin rajat), `snowflake/*.sql`
  (roolit, näkymät), `snowflake/LIIGA/CODE/stages/AGENT_SKILLS/**`, `.github/**` -- sekä mallin
  ydin `src/liiga/**` (AGENTS.md §10: ei viritystä kesken kauden).

**Päätös 16.10.:** ei vaadittua katselmointia PR:ssä. GitHub ei salli PR:n
tekijän hyväksyä omaa PR:äänsä, joten yhden hengen repossa se lukitsisi isot
muutokset. Isojen muutosten hyväksyntä on jo putkessa: production-ympäristön
hyväksyntä pysäyttää jokaisen agenttijulkaisun (itsehyväksyntä sallittu, ellei
"Prevent self-review" ole päällä).

**Toteutusluonnos:**

1. Ruleset mainiin: vaadi PR ja vihreä `CI / test` -- **ei** vaadittuja
   katselmointeja. Salli "auto-merge" repon asetuksista.
2. Claude Code (ja käsin tehty muutos) avaa PR:n haarasta ja kytkee
   auto-mergen päälle; GitHub yhdistää, kun CI on vihreä.
3. Iso muutos (polut yllä) käy lisäksi production-ympäristön hyväksynnän
   kautta, kun se julkaistaan -- sama kuin nyt.

Hyöty nykyiseen: punainen CI ei pääse mainiin, ja jokaisella muutoksella on
oma sivu testeineen. Ei välttämätön: tuotanto on jo suojattu. Vaatii `gh`:n
asennuksen koneelle.

**Milloin:** kun CI/CD:n ensimmäinen täysi ajo on mennyt läpi tuotantoon asti.

---

## 2. Tarvitaanko lisää semanttisia malleja? (lisätty 2026-10-16)

**Nyt:** kaksi mallia, `LIIGA_ENNUSTAJA_SV` (tulevaisuus) ja `LIIGA_KAUSI_SV`
(mennyt ja nyt), sekä proseduurityökalut `liiga_skenaario` ja
`liiga_kokoonpanot`. Jako tehtiin 10.10. tokenien takia: Cortex Analyst lukee
koko mallin joka kutsulla (input −68 %).

**Kysymys:** kasvaako jompikumpi malli niin, että jako kolmeen kannattaa?
Ehdokkaita:

- **Pelaajamalli** (pistepörssi, maalivahdit, kokoonpanot, pelaajaennusteet,
  yllättäjät): nyt jaettu kahden mallin kesken; pelaajakysymykset voisivat
  osua yhteen pienempään malliin.
- **Ottelu-/kierrosmalli** (tulevat ottelut, 1X2, maaliodottamat,
  esikatselu, keskinäiset): yleisin kysymystyyppi, ja ennustemalli on kasvanut
  (FORECAST_CHANGE, 1X2).
- **Historiamalli** (kaudet 2022-26): harvoin kysytty, mutta lisää kokoa
  kausimalliin.

**Mitä mitataan ennen päätöstä** (päätös mittauksesta, ei arviosta):

1. Mallien koko riveinä ja tokeneina (`metadata.usage.tokens_consumed`
   kysymyksillä, jotka EIVÄT osu VQR:ään -- VQR-osuma ei lataa mallia).
2. Työkalun valinnan osuvuus (`tool_correct_rate`): kolmas työkalu tekee
   valinnasta vaikeamman. Nyt 1,00 -- jos se laskee, jako maksaa.
3. Kysymykset, jotka tarvitsevat kahta mallia (ennuste vs. toteuma): niitä
   on jo nyt, ja jokainen lisäjako lisää kaksoiskutsuja.

**Milloin:** kun jompikumpi malli ylittää ~800 riviä YAMLia tai
oikeellisuus laskee pelaaja- tai otteluaiheissa evaluoinnissa.

---

## 3. Agentin vastausten linjausvalvonta tuotannossa (lisätty 2026-10-16)

**Idea:** jokaisesta tuotantovastauksesta kolme kyllä/ei-kysymystä halvalla
mallilla, tulos tauluun ja päiväraporttiin:
- kehottaako vastaus pelaamaan tai ehdottaako panoksia (vedonlyöntilinjaus)
- onko vastaus suomeksi
- onko vastauksessa välivaiheita tai suunnitelmaa (vuoti 16.10. englanniksi)

Nyt nämä mitataan vain evaluoinnissa (33 kysymystä, CI). Tuotannossa ei mitään.

**Toteutus:** `AI_COMPLETE` (GA 21.11.2025) pienellä Cortex-mallilla ja
JSON-skeemalla. Kun **Snowflake Decision** (`model => 'snowflake-decision'`,
private preview 7.10.2026, ei tuotantokäyttöön) tulee GA:ksi, vaihdetaan mallin
nimi ja verrataan samoilla vastauksilla. Jev (TypeSafe AI) ei ole avoin malli
(suljettu, vain API), joten avointa vaihtoehtoa ei ole.

**Miksi ei tehty heti:** käyttäjän ehto oli "jos vähentää tokeneita" -- ei vähennä.
Mitattu 16.10.: vastaus mediaani ~950 merkkiä (~300 tokenia), max ~3 200;
tarkistus ~600-1 400 tokenia = **+1-3 %** agenttikutsun 42 000-130 000 päälle.
Valvonta havaitsee jälkikäteen eikä estä, joten agentin ohjeista ei voi poistaa
mitään sen ansiosta.

**Milloin:** kun tuotannossa on oikeita käyttäjiä (CoWork) tai demo tarvitsee
"linjaus pitää 100 %:ssa vastauksista" -luvun. Decision GA:na pienentäisi hintaa
mutta ei muuta suuntaa: lisäkulu, ei säästö.

---

## 4. Koodin laatu: ruff, tyypit, monimutkaisuus, yksikkötestit (lisätty 2026-10-16)

**Nykytila, mitattu 16.10.** (Pythonia ~15 700 riviä: `src/`, `scripts/`,
`snowflake/`, `streamlit_app/`):

| | tila |
|---|---|
| lint | ei ruffia eikä muuta lintteriä, ei asetuksia `pyproject.toml`:ssa. Ruff säännöillä E,F,W,I,B,UP: **995 löydöstä**, joista 879 rivin pituutta (E501), 29 importtijärjestystä, **27 käyttämätöntä importtia**, 26 `zip()` ilman `strict=`, 6 silmukkamuuttujan sulkeumaa (B023, mahdollisia oikeita bugeja), 2 käyttämätöntä muuttujaa |
| tyypit | tyyppivihjeitä käytetään, mutta mypyä/pyrightia ei ajeta |
| monimutkaisuus | radon: **40 funktiota luokkaa C tai huonompi**; pahimmat `render` (E 36, aamutiedote/raportti), `apply_injuries` (E 34), `deploy_agent.candidate` (D 29), `simulate_scenario.compute` (D 28), `standings.reconstruct_games` (D 27), `results._parse_goalies` (D 27) |
| yksikkötestit | **12 testiä** (`tests/test_pipeline.py`, `tests/test_simulate_scenario.py`). Kattavuus testien koskemista moduuleista 22 %: `simulate.py` 96 %, simulaattori 68 %, `model.py` 36 %, `pipeline.py` 20 %, `players.py` ja `results.py` **0 %** |
| muu laatu | agentin evaluointi (33-35 kysymystä, laatuportti) on jo olemassa; se testaa agenttia, ei koodia |

**Tavoite, järjestyksessä (halvin ensin):**

1. **Ruff CI:hin** (`ruff check` + `ruff format --check`), säännöt E,F,W,I,B,UP,
   rivinpituus 110. Ensin `--fix` turvallisille (importit), sitten B023/B905
   käsin -- ne voivat olla oikeita bugeja. E501 ei estä CI:tä ennen kuin rivit
   on siivottu.
2. **Yksikkötestit niille, jotka ovat jo kerran menneet rikki** (CLAUDE.md
   luettelee ne): `game_id`-liitokset `(season, game_id)`, RL0/VT0 ei maaleja,
   tyhjän maalin nettous, debytantin ulkomaantilastot, rangaistuksen joukkue,
   `reconstruct_games`-suojaukset, `forty_minutes`-summatarkistus, lineups-täsmäytys
   sukunimellä. `players.py` ja `results.py` ensin (0 %).
   **Näkymien SQL-logiikalle fakesnow** (testattu 16.10., fakesnow 0.11.22):
   ajaa näkymät Snowflake-murteella DuckDB:n päällä ilman Snowflakea. Pienellä
   pohjadatalla (fixture) voi testata esim. "RL0 ei ole maali" ja
   `(season, game_id)`-liitokset. Tulos 16.10.: 3/11 näkymää suoraan, 8/11
   yhdellä apumakrolla (`to_timestamp_tz`); `V_TEAM_SEASON_NOW` kaatuu
   `FACTORIAL(BIGINT)`-tyyppieroon ja vie riippuvat mukanaan. Toimivissa luvut
   samat kuin Snowflakessa. Varoitukset: `TO_CHAR`-muotoilu ohitetaan HILJAA
   (muotoiltu teksti eroaa ilman virhettä), vaatii `snowflake-connector-python<5`,
   eikä kata semanttisia malleja, agenttia, Cortexia eikä proseduureja.
3. **Monimutkaisuusraja** (radon / ruff C901, esim. 15) uudelle koodille;
   E-luokan funktiot pilkotaan kun niihin koskee muutenkin.
4. **Tyyppitarkistus** (mypy, `--ignore-missing-imports`) ensin `scripts/deploy/`
   ja proseduureille, sitten `src/liiga/`.

**Rajoite:** `src/liiga/` on mallin ydin -- **ei kesken kauden** muuttuvia
refaktorointeja (AGENTS.md §10). Ruff-korjaukset, joissa käytös ei muutu
(importit, muotoilu), ja uudet testit ovat sallittuja; logiikan pilkkominen
odottaa kauden loppua. Testit kirjoitetaan nykyistä käytöstä vasten.

**Milloin:** kohdat 1-2 heti kun halutaan (ei vaikuta ennusteeseen), 3-4
kauden jälkeen.
