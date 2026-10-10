# Optimization Log - Liiga Ennustaja

## Agent details
- Fully qualified agent name: `SNOWFLAKE_INTELLIGENCE.AGENTS.LIIGA_ENNUSTAJA`
- Clone FQN (development/staging): `SNOWFLAKE_INTELLIGENCE.AGENTS.LIIGA_ENNUSTAJA_DEV`
- Owner / stakeholders: Mika Heino (Recordly)
- Purpose / domain: Finnish ice hockey league (Liiga) 2026-27 season standings and match predictions
- Current status: tuotannossa v20261010 (kaksi semanttista mallia)

## Evaluation dataset
- Location: Verified queries in `LIIGA.MODEL.LIIGA_ENNUSTAJA_SV`
- Coverage: Standings, championship probabilities, top scorers, team strengths, head-to-head match predictions, daily games

## Agent versions
- `v20260904-0320`: Baseline configuration snapshot, setup dev clone, fixing match predictions for "tämän päivän pelit"

## Optimization details
### Entry: 2026-09-04 03:20
- Version: `v20260904-0320`
- Goal: Enable agent to accurately answer "miten tämän päivän pelit päättyvät" (and upcoming game predictions) using Cortex Analyst (`liiga_analyst`) without falling back to Web Search.
- Changes planned:
  1. Add `GAME_DATE` and `START_TS` dimensions to `SCHEDULE` in semantic view `LIIGA_ENNUSTAJA_SV`.
  2. Add relationship `GAME_PREDICTIONS(GAME_ID) -> SCHEDULE(GAME_ID)` in `LIIGA_ENNUSTAJA_SV`.
  3. Add verified query (VQR) and AI instruction for "miten tämän päivän pelit päättyvät" (querying latest snapshot and matching game date).
  4. Explicitly instruct agent to use `liiga_analyst` for game predictions and avoid Web Search.
- Eval: Test Cortex Analyst text-to-SQL for "Miten tämän päivän pelit päättyvät?"
- Result: In progress

### Entry: 2026-10-10
- Version: `v20261010` (DEV-agentti `LIIGA_ENNUSTAJA_DEV`; tuotanto ennallaan)
- Goal: oikeammat vastaukset kauden aikana ja vähemmän tokeneita.
- Changes:
  1. Yksi 13 taulun malli → kaksi: `LIIGA_ENNUSTAJA_SV_DEV` (ennuste) ja
     `LIIGA_KAUSI_SV_DEV` (toteuma + mallin osuvuus), generoidaan
     `scripts/semantic_views.py`:stä.
  2. Raskas logiikka valmiiksi näkymiin (`snowflake/kausi_views.sql`):
     sarjatilanne nyt, ottelukohtainen osuma, yllättäjät, pistepörssi ilman
     RL0:aa, maalivahdit vs. odotus, viimeisin pelattu kokoonpano, uusin
     otteluennuste, vyöhyketodennäköisyydet.
  3. 22 vahvistettua kyselyä (oli 10). Osuma VQR:ään = semanttista mallia ei ladata.
  4. Agentti: kaksi työkalua, "yksi työkalu, yksi kutsu", lyhyt vastausmuoto,
     budjetti 64 000 → 20 000 tokenia ja 120 → 60 s.
- Eval: 9 kysymystä, `SNOWFLAKE.CORTEX.DATA_AGENT_RUN`, sama hetki molemmille.

| | prod (vanha) | dev (uusi) | muutos |
|---|---:|---:|---:|
| input-tokenit yhteensä | 1 829 632 | 578 315 | −68 % |
| output-tokenit | 25 057 | 4 814 | −81 % |
| aika yhteensä | 544 s | 182 s | −67 % |
| työkalukutsuja | 36 | 13 | |

  Oikeellisuus: vanha vastasi pistepörssiin **viime kauden** luvuilla
  (Ojantakanen "37 maalia"), mallin osuvuuteen "0 %" ja sarjatilanteeseen
  viidellä kutsulla. Uusi vastasi kaikkiin oikein (Svejkovsky 8 maalia,
  51/94 = 54,3 % vs. kotijoukkue 57,4 %).
- Result: viety tuotantoon 2026-10-10 käyttäjän hyväksynnällä. Tuotantoagentin
  spec: `versions/v20261010/prod_agent_spec.json`. Vanha yksi malli on git-
  historiassa (`data/semantic_view_backup.yaml`, poistettu commitissa jossa
  tämä merkintä lisättiin) jos se pitää palauttaa.

### Entry: 2026-10-10 (iltapäivä) — kieli, budjetti, kierroksen esikatselu
- **Kieli:** kuvaukset ja ohjeet englanniksi, synonyymit, VQR-kysymykset ja vastaukset
  suomeksi. 18 ajoa per versio: input −2,8 %, output −6 %, sama osuvuus (18/18).
  Toistojen ero alle 0,5 %. Tuotantoon.
- **Budjetti:** aikaraja 60 → 300 s (Snowflaken suositus). Budjetti on katto eikä
  säästä tokeneita. Tokenraja 20 000 ei katkaissut yhtään 36 ajosta, vaikka ajot
  raportoivat jopa 118 000 input-tokenia, joten se ei laske samoja tokeneita.
- **Kierroksen esikatselu:** `V_ROUND_PREVIEW_TEXT` palauttaa valmiit suomenkieliset
  rivit (ennuste, sija/pisteet/vire, todennäköiset maalivahdit, keskinäiset).
  Kolme VQR-muotoilua. Mitattu tuotannossa: 41 000 tokenia, 1 työkaluvaihe, luvut oikein.

| reitti | input-tokenit | vaiheet | luvut oikein |
|---|---:|---:|---|
| skill + numeerinen näkymä (20 saraketta) | 139 000 | 3–4 | ei: sijat ristiin 3/4 ajossa |
| VQR + valmiit tekstirivit | 40 000 | 1 | kyllä 4/4 |
| HTML-sivu (skill + koodinsuoritus + render.py) | 276 000 | 7 | kyllä |

  Opetus: malli poimii väärän luvun 20 nimettömän sarakkeen rivistä. Valmis teksti
  poistaa virheen ja on halvempi. Skill lisää orkestrointikierroksia; jokainen
  kierros lähettää koko kontekstin uudelleen.
- **HTML:** vain DEV-agentissa (`deploy_agent.py --dev --html`), ei tuotannossa.

### Entry: 2026-10-10 (ilta) — metriikat, synonyymit, kommentit, HTML-skill
- Metriikat 2 → 20, taulusynonyymit 0 → 15/15, sarakesynonyymit 53 → 68,
  sarakekommentit näkymiin 0 → 111 (samasta lähteestä, `apply_comments()`).
  Mallin koko +7 % / +19 %; tavallisten kysymysten tokenit ennallaan (vaihtelun sisällä).
- **Metriikka estää väärän yhdistämisen:** liigan ylivoima-% SUM/SUM = 18,8 %,
  joukkueprosenttien keskiarvo = 18,5 % (vanha agentti vastasi 18,5).
- **Oma metriikkavirhe, kiinni testissä:** `AVG(SPECTATORS)` ja maalit/ottelu ilman
  `ENDED`-rajausta. Maalit/ottelu olisi ollut 0,88 oikean 5,12:n sijaan (pelaamattomat
  ottelut ovat 0–0). Yleisö 4 567 vs. oikea 4 616. Rajattu `IFF(ENDED, …, NULL)`.
- **Työkalukuvaus ratkaisee, kutsutaanko työkalua lainkaan.** Ylivoima- ja
  yleisökysymyksiin agentti vastasi "ei dataa" kutsumatta työkalua (4/4), koska
  kuvauksessa ei mainittu niitä. Lisätty kuvaukseen + "never say data is unavailable
  without calling a tool first": 6/6 oikein.
- **HTML-skill (`--html`):** 276 000 → 187 000 tokenia, kun skill kertoo polun
  (`/mnt/skills/stage/liiga_code_agent_skills/<skill>/`), kirjoittaa `/workspace`iin ja
  käyttää `present_file`ia. Väärä laukeaminen: 1/12 ja 1/22 ajossa muihin kysymyksiin,
  hinta silloin ~110 000 tokenia. Tuotannossa ei toistaiseksi.
- **Johtoryhmävisualisointi tuotannossa (käyttäjän päätös):** skill laukeaa avainsanalla
  "johtoryhmävisualisointi" (4/4), ei pelkällä "HTML-sivu"-pyynnöllä (0/2). Väärä
  laukeaminen tavallisiin kysymyksiin jää ~6 %:iin (1/12, 1/22, 1/14), hinta ~111 000
  vs. 37 000 tokenia. Varma esto olisi erillinen agentti; valittiin sama agentti.

## Agent versions (Snowflake)
| versio | alias | git | sisältö |
|---|---|---|---|
| `VERSION$1` | – | (ennen versiointia) | aamupäivän tila; skill luki ylikirjoitettavaa kansiota |
| `VERSION$2` | production, oletus | 010d045 | kaksi semanttista mallia, 20 metriikkaa, kierroksen esikatselu, johtoryhmävisualisointi raporttina |
