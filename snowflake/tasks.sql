-- Snowflaken oma ajastus. Korvaa launchdin osuuden Snowflake-ajossa;
-- launchd hoitaa edelleen paikallisen ajon ja sivuston.
--
-- ⚠️ ÄLÄ AJA TÄTÄ `snow sql -f`:llä. CLI katkoo lauseet puolipisteestä, mikä
-- rikkoo juuritaskin Snowflake Scripting -lohkon, eikä taskin runko hyväksy
-- $$-rajoja. Aja Python-konnektorilla, joka lähettää lauseen yhtenä:
--
--   import snowflake.connector as sc
--   con = sc.connect(connection_name="CONTAINER_SERVICES", role="ACCOUNTADMIN",
--                    warehouse="LIIGA_WH", database="LIIGA", schema="CODE")
--   con.cursor().execute(open("snowflake/tasks.sql").read().split(";--SPLIT")[0])
--
-- Ketju: LIIGA_CHECK (halpa laskuri) -> LIIGA_DAILY_RUN (koko putki).
-- Lapsi ajetaan vain jos jotain on haettavaa, jolloin varasto ei käynnisty
-- eikä 10 000 kauden simulaatiota ajeta turhaan.

CREATE OR REPLACE TASK LIIGA.CODE.LIIGA_CHECK
  SCHEDULE = 'USING CRON 0 6 * * * Europe/Helsinki'
  USER_TASK_TIMEOUT_MS = 60000
  COMMENT = 'Montako ottelua pelattu mutta hakematta; luku menee lapsitaskille.'
AS
DECLARE
  due INTEGER;
BEGIN
  -- Ehto ei ole "oliko eilen kierros" vaan "onko jokin ottelu alkanut yli
  -- 8 h sitten ja yhä hakematta". Sama asia normaalina päivänä, mutta
  -- itsekorjaava: väliin jäänyt tai epäonnistunut ajo napataan kiinni
  -- seuraavana aamuna sen sijaan että ottelu jäisi pysyvästi puuttumaan.
  SELECT COUNT(*) INTO :due
    FROM LIIGA.RAW.RAW_GAMES
   WHERE SEASON = (SELECT MAX(SEASON) FROM LIIGA.RAW.RAW_GAMES)
     AND NOT ENDED
     AND START_TIME <= TO_VARCHAR(
           CONVERT_TIMEZONE('UTC', DATEADD(hour, -8, CURRENT_TIMESTAMP())),
           'YYYY-MM-DD"T"HH24:MI:SS"Z"');
  -- SYSTEM$SET_RETURN_VALUE vaatii vakion eikä hyväksy :due-muuttujaa, eikä
  -- sitä saa kutsua proseduurin sisältä ("function with side effects").
  -- Dynaaminen lause upottaa luvun literaalina ja kiertää molemmat.
  EXECUTE IMMEDIATE 'CALL SYSTEM$SET_RETURN_VALUE(''' || :due::STRING || ''')';
  RETURN :due;
END;

--SPLIT

-- Lausejärjestys on tarkka: COMMENT ennen AFTER:ia, WHEN viimeisenä.
-- Argumentiton SYSTEM$GET_PREDECESSOR_RETURN_VALUE() koska edeltäjiä on yksi;
-- nimellinen muoto ei resolvoitunut.
CREATE OR REPLACE TASK LIIGA.CODE.LIIGA_DAILY_RUN
  WAREHOUSE = LIIGA_WH
  COMMENT = 'Koko putki. Ajetaan vain kun ottelu on pelattu mutta hakematta.'
  AFTER LIIGA.CODE.LIIGA_CHECK
  WHEN SYSTEM$GET_PREDECESSOR_RETURN_VALUE()::INTEGER > 0
AS
  EXECUTE NOTEBOOK LIIGA.CODE.LIIGA_DAILY();

-- Käynnistys: lapsi ensin, juuri viimeisenä.
ALTER TASK LIIGA.CODE.LIIGA_DAILY_RUN RESUME;
ALTER TASK LIIGA.CODE.LIIGA_CHECK RESUME;

-- Testiajo ilman odottamista aamuun:
--   EXECUTE TASK LIIGA.CODE.LIIGA_CHECK;
-- ja tulos:
--   SELECT NAME, STATE, RETURN_VALUE, ERROR_MESSAGE
--   FROM TABLE(LIIGA.INFORMATION_SCHEMA.TASK_HISTORY(
--          SCHEDULED_TIME_RANGE_START => DATEADD(minute,-10,CURRENT_TIMESTAMP())))
--   WHERE NAME IN ('LIIGA_CHECK','LIIGA_DAILY_RUN') ORDER BY SCHEDULED_TIME DESC;
