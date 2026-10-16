-- GitHub Actionsin palvelukäyttäjä (TYPE = SERVICE, vain avainpari). Julkinen
-- avain: ALTER USER LIIGA_CI SET RSA_PUBLIC_KEY = ...; yksityinen avain on vain
-- GitHubin salaisuutena SNOWFLAKE_PRIVATE_KEY ja ~/.snowflake/keys/ (älä tulosta).
--
-- Aja ACCOUNTADMINina: snow sql -c CONTAINER_SERVICES --role ACCOUNTADMIN -f snowflake/_account/users/LIIGA_CI.sql
-- Idempotentti. Koko tilin järjestys: snowflake/_account/README.md.

USE ROLE ACCOUNTADMIN;

-- GitHub Actionsin palvelukäyttäjä. Ei salasanaa: TYPE = SERVICE ei voi
-- kirjautua salasanalla eikä selaimella.
CREATE USER IF NOT EXISTS LIIGA_CI
  TYPE = SERVICE
  DEFAULT_ROLE = LIIGA_DEPLOYER
  DEFAULT_WAREHOUSE = LIIGA_WH
  COMMENT = 'GitHub Actions: mikaheino/liiga-2026-27 julkaisu. Avainparitunnistus.';

GRANT ROLE LIIGA_DEPLOYER TO USER LIIGA_CI;
