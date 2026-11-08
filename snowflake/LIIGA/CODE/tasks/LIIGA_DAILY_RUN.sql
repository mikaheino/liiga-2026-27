-- Lausejärjestys on tarkka: COMMENT ennen AFTER:ia, WHEN viimeisenä.
-- Argumentiton SYSTEM$GET_PREDECESSOR_RETURN_VALUE() koska edeltäjiä on yksi;
-- nimellinen muoto ei resolvoitunut.
CREATE OR REPLACE TASK LIIGA.CODE.LIIGA_DAILY_RUN
  WAREHOUSE = LIIGA_WH
  COMMENT = 'Koko putki. Ajetaan vain kun ottelu on pelattu mutta hakematta.'
  AFTER LIIGA.CODE.LIIGA_CHECK
  WHEN SYSTEM$GET_PREDECESSOR_RETURN_VALUE()::INTEGER > 0
AS
  -- 8.11.2026: notebookista Code Bundleen (koodi versioituna paketista, deploy-bundle.yml).
  EXECUTE CODE BUNDLE LIIGA.CODE.LIIGA_DAILY_BUNDLE ENTRYPOINT = 'daily.py';

-- Vaihto olemassa olevaan tehtävään (ACCOUNTADMIN, 8.11.2026): juuritehtävä tauolle, runko vaihtoon, takaisin.
-- ALTER TASK LIIGA.CODE.LIIGA_CHECK SUSPEND;
-- ALTER TASK LIIGA.CODE.LIIGA_DAILY_RUN MODIFY AS EXECUTE CODE BUNDLE LIIGA.CODE.LIIGA_DAILY_BUNDLE ENTRYPOINT = 'daily.py';
-- ALTER TASK LIIGA.CODE.LIIGA_CHECK RESUME;
