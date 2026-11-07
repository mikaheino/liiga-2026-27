-- Etusivun "Entä jos?" -haut ja niiden vastaukset (7.11.2026, käyttäjä: "Haluan että
-- skenaariot tallentuvat ja niiden vastaukset"). Sovellus (app/api/skenaario/rakenna,
-- lib/skenaarioHaut.ts) kirjoittaa jokaisen haun: kysymys, tekoälyn yhteenveto, moottorin
-- kanoniset rivit (items), moottorin luvut tiivistettynä (result), perusta forecast_ts ja
-- jälki (tools, sql_text, ms). Hakukentän alla näkyy lista aiemmista hauista.
--
-- Sama malli kuin KORTTI_VASTAUS: luodaan deploy-app.yml:ssä julkaisuroolilla
-- LIIGA_DEPLOYER, joka omistaa myös sovelluspalvelun. Idempotentti -- ei koskaan
-- CREATE OR REPLACE (rivit ovat käyttäjän hakuja eikä niitä voi luoda uudelleen).
CREATE TABLE IF NOT EXISTS LIIGA.MODEL.SKENAARIO_HAKU (
  id           STRING        NOT NULL COMMENT 'Rivin UUID',
  season       NUMBER        NOT NULL COMMENT 'Kausi',
  question     STRING        NOT NULL COMMENT 'Haku sellaisenaan (tarkennuksessa alkuperäinen haku)',
  followup     STRING                 COMMENT 'Käyttäjän vastaus agentin tarkennukseen, jos sellainen oli',
  answer       STRING                 COMMENT 'Tekoälyn yhteenveto, tarkentava kysymys tai virheilmoitus',
  items        VARIANT                COMMENT 'Moottorin kanoniset skenaariorivit (label mukana)',
  result       VARIANT                COMMENT 'Moottorin luvut: plausibility, requirements, liikkuneet joukkueet nyt -> skenaario',
  tools        ARRAY                  COMMENT 'Agentin käyttämät työkalut (jälki)',
  sql_text     ARRAY                  COMMENT 'Agentin ajama SQL (jälki)',
  forecast_ts  STRING                 COMMENT 'Ennusteen aikaleima haun hetkellä; eroaa nykyisestä = VANHA PERUSTA',
  asked_at     TIMESTAMP_TZ  NOT NULL DEFAULT CURRENT_TIMESTAMP(),
  ms           NUMBER                 COMMENT 'Kesto millisekunteina',
  status       STRING        NOT NULL COMMENT 'done | clarify (agentti kysyi tarkennusta) | error',
  source       STRING                 COMMENT 'snowflake = LIIGA_ENNUSTAJA, local = kehityskoneen Claude'
)
COMMENT = 'Liiga Ennuste: etusivun skenaariohaut ja vastaukset (ScenarioBoard.tsx).';

-- Hyperversiointi (7.11.2026, käyttäjä: "tämä moottori tallentaa mutta on hyperversioitu, kaikki on
-- mahdollista"): version = sha256(kanoniset rivit ilman labeleita + ennusteen aikaleima)[:12], joten
-- sama skenaario samalla ennusteella = sama versio; parent_id = haku, jonka jatkona tämä tehtiin
-- (versiopuu). Lisätään idempotentisti olemassa olevaan tauluun.
ALTER TABLE LIIGA.MODEL.SKENAARIO_HAKU ADD COLUMN IF NOT EXISTS version STRING COMMENT 'sha256(kanoniset rivit + forecast_ts)[:12]';
ALTER TABLE LIIGA.MODEL.SKENAARIO_HAKU ADD COLUMN IF NOT EXISTS parent_id STRING COMMENT 'Haku, jonka jatkona tämä tehtiin';
