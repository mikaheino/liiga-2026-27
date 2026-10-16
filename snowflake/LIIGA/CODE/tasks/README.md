# LIIGA.CODE-taskit

```sql
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
--   con.cursor().execute(open("snowflake/LIIGA/CODE/tasks/LIIGA_CHECK.sql").read())
--   (sitten LIIGA_DAILY_RUN.sql samalla tavalla)
--
-- Ketju: LIIGA_CHECK (halpa laskuri) -> LIIGA_DAILY_RUN (koko putki).
-- Lapsi ajetaan vain jos jotain on haettavaa, jolloin varasto ei käynnisty
-- eikä 10 000 kauden simulaatiota ajeta turhaan.
```

Järjestys: `LIIGA_CHECK.sql` (Python-konnektorilla), `LIIGA_DAILY_RUN.sql`, sitten käynnistys:

```sql
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
```
