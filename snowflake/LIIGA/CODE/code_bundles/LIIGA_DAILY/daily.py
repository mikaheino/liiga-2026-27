"""LIIGA_DAILY Code Bundlena (8.11.2026): samat vaiheet kuin notebookissa daily_update.ipynb.

Koodi (src/liiga), data ja config.yaml ovat paketissa (deploy_bundle.py), joten repoa ei haeta.
Kohdeskeemat LIIGA.CODE.PIPELINE_SETTINGSista kuten notebookissa (kuiva-ajo vaihtamalla taulua).
"""
from __future__ import annotations

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "src"))
os.chdir(HERE)                       # config.yaml ja data/ suhteessa tähän


def session():
    try:
        from snowflake.snowpark.context import get_active_session
        return get_active_session()
    except Exception:                # noqa: BLE001 -- kontissa sessio luodaan näin
        from snowflake.snowpark import Session
        return Session.builder.getOrCreate()


def configure(s) -> None:
    import yaml
    rows = s.sql("SELECT tournament, raw_schema, model_schema FROM LIIGA.CODE.PIPELINE_SETTINGS").collect()
    tour, raw, model = ((rows[0]["TOURNAMENT"], rows[0]["RAW_SCHEMA"], rows[0]["MODEL_SCHEMA"])
                        if rows else ("runkosarja", "RAW", "MODEL"))
    with open("config.yaml", encoding="utf-8") as fh:
        cfg = yaml.safe_load(fh)
    cfg["database"]["target"] = "snowflake"
    cfg["ingestion"]["tournament"] = tour
    cfg["snowflake_sync"]["raw_schema"] = raw
    cfg["snowflake_sync"]["model_schema"] = model
    with open("config.yaml", "w", encoding="utf-8") as fh:
        yaml.safe_dump(cfg, fh)
    s.sql("USE SCHEMA LIIGA." + model).collect()
    path = list(dict.fromkeys("LIIGA." + x for x in (model, raw, "MODEL", "RAW")))
    s.sql("ALTER SESSION SET SEARCH_PATH = '" + ", ".join(path) + "'").collect()
    print(tour, "->", "LIIGA." + raw, "/", "LIIGA." + model)


def main() -> None:
    s = session()
    configure(s)
    from liiga.config import load_config
    from liiga.pipeline import forecast, persist, refresh_results
    from liiga.team_strength import build_team_strength

    got = refresh_results()
    print(f"season {got['season']}: {got['games_played']}/{got['games_total']} played; news {got.get('news')}")
    if got["detail_failed"]:
        print("FAILED:", got["detail_failed"])
    build_team_strength()
    res = forecast(cfg=load_config())
    persist(res)
    top = res["standings"].sort_values("proj_rank").head(5)
    for _, r in top.iterrows():
        print(f"  {int(r['proj_rank']):2}. {r['team']:9} {r['mean_points']:.0f}")


if __name__ == "__main__":
    main()
