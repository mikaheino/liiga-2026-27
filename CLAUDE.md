# Liiga 2026-27 — Claude Code notes

**Mouho-peli on omassa repossaan (23.10.2026): `/Users/mika.heino/prod/mouho_2026`.** Pelityö tehdään
siellä; tämän repon `public/mouho` on julkaisukopio (`tools/sync-liiga.sh` siellä). Älä muokkaa peliä täällä.

## Repo & git (since 2026-08-18)

Version-controlled at **https://github.com/mikaheino/liiga-2026-27** (public),
pushed over SSH using a dedicated key **`~/.ssh/id_ed25519_liiga`** (configured
in `~/.ssh/config`, not one of the other keys on this machine). Never print or
paste the private key contents. Commit after roster-update batches — see
AGENTS.md §13 for why (a prompt-injection incident this repo recovered from
manually before git existed here).

## Repon rakenne peilaa Snowflakea (16.10.2026)

`snowflake/` = tili -> tietokanta -> skeema -> objektityyppi -> objekti
(`_account/`, `LIIGA/CODE|MODEL|EVALS/`, `SNOWFLAKE_INTELLIGENCE/AGENTS/`).
`scripts/` = `deploy/` (julkaisu), `local/` (paikallinen putki, launchd),
`tools/` (Snowflake-työkalujen paikalliset vastineet). Kartta, jossa jokaisen
paikallisen tiedoston Snowflake-vastine: **`docs/RAKENNE.md`**. `data/` ja
`src/` ennallaan kauden loppuun (mallin polut). Uusi Snowflake-objekti = uusi
tiedosto oikeaan kansioon objektin nimellä; roolille annetut oikeudet sen
roolin tiedostoon.

## Koodin laatu: yksi portti, kolme paikkaa (16.10.2026)

`python scripts/dev/quality.py` = ruff (asetukset `pyproject.toml`) + monimutkaisuus
(radon, raja 15) + testit ja kattavuus. **Ratchet:** nykyiset 16 rajan ylittävää
funktiota ja 21,4 %:n kattavuus ovat lähtötasossa (`scripts/dev/quality_baseline.json`):
ne saavat jäädä mutta eivät heiketä; uusi funktio ei saa ylittää rajaa.
Parannus lukitaan: `--update-baseline`. Sama portti ajetaan:
- **CI** (`ci.yml`, tulos GitHubin yhteenvetoon)
- **git pre-push** (`.githooks/pre-push`; `git config core.hooksPath .githooks` kerran per klooni)
- **Claude Code** (`.claude/settings.json`): ruff jokaiselle muokatulle .py-tiedostolle,
  löydökset palautuvat heti (exit 2) -- korjaa ne samalla kierroksella.

⚠️ **Snowflakessa ajettava Python on vanhempi kuin 3.11** (17.10.): ruffin UP017 vaihtoi
`datetime.timezone.utc` -> `datetime.UTC`, ja LIIGA_DAILY-notebook kaatui (AttributeError), joten
Snowflake jäi päivän jälkeen. UP017 on pois `src/**`:sta ja `snowflake/**`:sta, ja
`tests/test_snowflake_python.py` kaatuu 3.11+-ominaisuuksiin. Korjauksen jälkeen: push ->
`ALTER GIT REPOSITORY LIIGA.CODE.LIIGA_REPO FETCH` -> `EXECUTE NOTEBOOK LIIGA.CODE.LIIGA_DAILY()`
(ylläpitäjänä; notebook lukee src/:n reposta ajon aikana, itse ipynb on luontihetken kopio).

Käyttöönotossa ruff korjasi 68 löydöstä (importit, `datetime.UTC`) ja loput käsin;
B023-tapaukset olivat vääriä hälytyksiä (sulkeuma kutsutaan samalla kierroksella),
sidottu oletusargumentiksi. Mallin ennuste tarkistettu muuttumattomaksi (ero 0,0).
E501 (879 pitkää riviä) ja `ruff format` odottavat: backlog kohta 4.

## ⚠️ NEVER update the claude.ai artifact

The infographic is LOCAL-ONLY (`site/index.html`). Do NOT publish or redeploy
it to a claude.ai artifact — not with the Artifact tool, not on request to
"update the infographic" (that means the local site). The old artifact at
https://claude.ai/code/artifact/c1cda021-9ae9-4199-a8f0-c92483b50d0f is a
frozen snapshot; leave it alone.

## ⚠️ Streamlit: do NOT deploy to Snowflake

The app is being developed locally and the Snowflake copy is deliberately
left behind. **Do not run `snow streamlit deploy`** without an explicit
request in the current conversation — "update the app" means the local one.

## Aihetiedostot – lue vain se, jota työ koskee (23.10.2026)

CLAUDE.md pidetään lyhyenä, koska se ladataan jokaiseen istuntoon ja jokaiselle agentille
(ennen 92 kt ≈ 23 000 tokenia). Yksityiskohdat ovat aiheittain `docs/claude/`-kansiossa:

| aihe | tiedosto | lue kun |
|---|---|---|
| datan haku, liiga.fi:n ansat, `game_id`, RL0/VT0, kesken kauden ajettava skripti | `docs/claude/data.md` | ingest, tulokset, ad hoc -SQL, ennusteajot |
| rosterit, uusi pelaaja, hockeydb, debytantit | `docs/claude/roster.md` | pelaajalisäykset, kokoonpanot |
| Snowflake: taulut, taskit, palvelukäyttäjät | `docs/claude/snowflake.md` | synkka, taskit, oikeudet |
| agentti, semanttiset mallit, työkalut, julkaisuputki | `docs/claude/agent.md` | agentti, CI/CD, evaluoinnit |
| Next.js-sovellus | `docs/claude/app.md` | sovellus, App Runtime |
| Streamlit, diat, LinkedIn-postaukset, vyöhykkeet | `docs/claude/streamlit-slides.md` | diat, postaukset |
| paikallinen sivusto ja retro-teema | `docs/claude/site.md` | site/index.html |

## Aina voimassa (tiivistelmä aihetiedostoista)

- **Tila yhdellä komennolla: `scripts/dev/status.sh`** (git, viimeisin ajo, synkka, data, sovellus) – aja tämä ennen lokien tai taulujen selaamista.

- **Kauden aikana aja `python scripts/local/daily_update.py`**, ei `refresh_standings.py`:tä (data.md).
- **`game_id` ei ole yksilöllinen kausien yli**: liitä `(season, game_id)` (data.md).
- Yksityisiä avaimia (`~/.ssh/id_ed25519_liiga`, `~/.snowflake/keys/`) ei koskaan tulosteta.
- Snowflake-kyselyt yhteydellä `liiga_ci`; `CONTAINER_SERVICES` (selain) vain ylläpitoon (snowflake.md).
- Sovellus ja agentti julkaistaan vain CI/CD-putken kautta, ei omalta koneelta; push käynnistää putken.
- Mallia ei viritetä kesken kauden (AGENTS.md §10).
- Mouho-peli on omassa repossaan `/Users/mika.heino/prod/mouho_2026`.
- **Kolme erillistä ajopaikkaa** (27.10.): Mac, GitHub Pages (`pages.yml`, oma historia `pages-data`-haarassa) ja Snowflake (app.md).
