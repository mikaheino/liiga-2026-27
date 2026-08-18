"""Load and access config.yaml.

Usage:
    from liiga.config import load_config
    cfg = load_config()
    cfg["team_strength"]["team_weight"]   # -> 0.15

Paths in the config are resolved relative to the project root (the directory
containing config.yaml), so notebooks and scripts work regardless of the
current working directory.
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml


def project_root() -> Path:
    """Walk upwards from this file until we find config.yaml."""
    here = Path(__file__).resolve()
    for parent in [here, *here.parents]:
        if (parent / "config.yaml").exists():
            return parent
    raise FileNotFoundError("Could not locate config.yaml above " + str(here))


@lru_cache(maxsize=1)
def load_config() -> dict[str, Any]:
    root = project_root()
    with open(root / "config.yaml", encoding="utf-8") as fh:
        cfg = yaml.safe_load(fh)
    cfg["_root"] = str(root)
    return cfg


def resolve_path(relative: str) -> Path:
    """Turn a config-relative path string into an absolute Path."""
    return project_root() / relative
