"""Yhteinen Snowflake-yhteys julkaisuskripteille (semantic_views, deploy_agent, agent_eval).

Paikallisesti: yhteys liiga_ci (~/.snowflake/connections.toml, sama palvelukäyttäjä
LIIGA_CI avainparilla kuin CI:ssä -- ei selainkirjautumista) ja rooli LIIGA_DEPLOYER -- SAMA rooli
kuin CI:ssä, koska ACCOUNTADMINin CREATE OR REPLACE siirtäisi näkymien ja
DEV-mallien omistajuuden takaisin ja seuraava CI-ajo kaatuisi. GitHub Actionsissa
työnkulku asettaa

    LIIGA_SNOW_CONNECTION=ci        # avainparitunnistus palvelukäyttäjälle LIIGA_CI
    LIIGA_SNOW_ROLE=LIIGA_DEPLOYER  # rajattu julkaisurooli (snowflake/_account/roles/LIIGA_DEPLOYER.sql)

jolloin samat skriptit ajetaan ilman henkilökohtaista tunnusta.
"""
from __future__ import annotations

import os

CONNECTION = os.environ.get("LIIGA_SNOW_CONNECTION", "liiga_ci")
ROLE = os.environ.get("LIIGA_SNOW_ROLE", "LIIGA_DEPLOYER")
WAREHOUSE = os.environ.get("LIIGA_SNOW_WAREHOUSE", "LIIGA_WH")


def conn(*, warehouse: bool = True, database: str | None = None,
         schema: str | None = None) -> list[str]:
    """`snow`-komennon yhteysliput."""
    out = ["-c", CONNECTION, "--role", ROLE]
    if warehouse:
        out += ["--warehouse", WAREHOUSE]
    if database:
        out += ["--database", database]
    if schema:
        out += ["--schema", schema]
    return out
