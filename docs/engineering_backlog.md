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
  `scripts/semantic_views*.py`, `scripts/deploy_agent.py`,
  `scripts/agent_eval.py` (laatuportin rajat), `snowflake/*.sql`
  (roolit, näkymät), `snowflake/skills/**`, `.github/**` -- sekä mallin
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
