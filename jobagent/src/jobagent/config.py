from __future__ import annotations

import os
from pathlib import Path

import yaml

from .models import Profile

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data"
OUT = ROOT / "out"


def load_dotenv(path: Path = ROOT / ".env") -> None:
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip())


def env(name: str, default: str = "") -> str:
    return os.environ.get(name, default)


def load_profile(path: Path | None = None) -> Profile:
    path = path or DATA / "profile.yaml"
    if not path.exists():
        raise SystemExit(f"Нет {path}. Скопируйте data/profile.example.yaml и заполните.")
    return Profile.model_validate(yaml.safe_load(path.read_text()))
