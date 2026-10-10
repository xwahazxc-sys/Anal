"""Площадки без официального API для откликов (LinkedIn, Indeed и др.): только ручной ввод.

Вставьте текст вакансии в файл — агент оценит её и подготовит резюме + письмо,
а нажать «Apply» вы будете сами. Автоматизация этих сайтов нарушает их правила
и ведёт к блокировке аккаунта, поэтому здесь её намеренно нет.
"""
from __future__ import annotations

from pathlib import Path

from ..models import Vacancy


def from_file(path: Path, source: str = "manual") -> Vacancy:
    lines = path.read_text().strip().splitlines()
    return Vacancy(source=source, id=path.stem, title=lines[0].strip("# ").strip(), description="\n".join(lines[1:]))
