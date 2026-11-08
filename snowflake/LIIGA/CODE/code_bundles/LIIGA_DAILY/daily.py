"""LIIGA_DAILY Code Bundlena (8.11.2026): samat vaiheet kuin notebookissa daily_update.ipynb.

Koodi (src/liiga), data ja config.yaml ovat paketissa (deploy_bundle.py), joten repoa ei haeta.
Kohdeskeemat LIIGA.CODE.PIPELINE_SETTINGSista kuten notebookissa (kuiva-ajo vaihtamalla taulua).
"""
from __future__ import annotations

import os
import shutil
import sys


def _here() -> str:
    """Paketin juuri. Bundle ajaa entrypointin solun tapaan ilman __file__-nimeä (8.11.2026), joten
    juuri haetaan config.yaml:n perusteella työhakemistosta ja sen alta."""
    if "__file__" in globals():
        return os.path.dirname(os.path.abspath(__file__))
    for base in (os.getcwd(), *(os.path.join(os.getcwd(), d) for d in sorted(os.listdir(os.getcwd())))):
        if os.path.isfile(os.path.join(base, "config.yaml")) and os.path.isdir(os.path.join(base, "src", "liiga")):
            return base
    raise FileNotFoundError(f"paketin juurta ei löytynyt: {os.getcwd()} {os.listdir(os.getcwd())[:20]}")


# Paketti on vain luku -tilassa (8.11.2026: "Read-only file system"): kopio /tmp:hen, kuten notebook.
WORK = "/tmp/liiga"
shutil.rmtree(WORK, ignore_errors=True)
shutil.copytree(_here(), WORK)
sys.path.insert(0, os.path.join(WORK, "src"))
os.chdir(WORK)                       # config.yaml ja data/ suhteessa tähän


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
