# Tilitason objektit

Ajetaan ACCOUNTADMINina (`snow sql -c CONTAINER_SERVICES --role ACCOUNTADMIN -f <tiedosto>`).
Kaikki tiedostot ovat idempotentteja. Yksi tiedosto per objekti; **roolille annetut
oikeudet ovat sen roolin tiedostossa**.

Järjestys tyhjältä tililtä:

1. `roles/LIIGA_AGENT_OWNER.sql`, `roles/LIIGA_AGENT_USER.sql`, `roles/LIIGA_LOADER.sql`
2. `../LIIGA/CODE/network_rules/LIIGA_FI_RULE.sql`, `integrations/LIIGA_FI_ACCESS.sql`, `integrations/LIIGA_EMAIL.sql`
3. `../LIIGA/EVALS/_schema.sql`, `roles/LIIGA_DEPLOYER.sql` (viittaa integraatioihin ja EVALS-skeemaan)
4. `users/LIIGA_CI.sql`, `users/LIIGA_SYNC.sql` (julkinen avain: `ALTER USER ... SET RSA_PUBLIC_KEY`)
5. `cowork/SNOWFLAKE_INTELLIGENCE_OBJECT_DEFAULT.sql` (kun agentti on olemassa)

Jaettu 16.10.2026 tiedostoista agent_roles.sql, ci_user.sql, loader_user.sql ja
agent_tools.sql; kaikki 95 lausetta tarkistettu koneellisesti mukaan.
