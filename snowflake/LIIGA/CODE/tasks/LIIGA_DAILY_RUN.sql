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
