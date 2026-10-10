"""Тонкая обёртка над Claude API: структурированный вывод через принудительный tool_use."""
from __future__ import annotations

from typing import TypeVar

import anthropic
from pydantic import BaseModel

from .config import env

T = TypeVar("T", bound=BaseModel)

ANTI_FABRICATION = (
    "Используй ТОЛЬКО факты из переданного профиля. Нельзя выдумывать опыт, "
    "навыки, цифры, компании и даты. Если требования вакансии не подтверждены "
    "профилем — не добавляй их, а отметь как пробел."
)


def ask(system: str, user: str, out: type[T], max_tokens: int = 4096) -> T:
    client = anthropic.Anthropic()
    resp = client.messages.create(
        model=env("JOBAGENT_MODEL", "claude-sonnet-5-5"),
        max_tokens=max_tokens,
        system=f"{system}\n\n{ANTI_FABRICATION}",
        tools=[{
            "name": "result",
            "description": "Верни результат строго в этой схеме",
            "input_schema": out.model_json_schema(),
        }],
        tool_choice={"type": "tool", "name": "result"},
        messages=[{"role": "user", "content": user}],
    )
    block = next(b for b in resp.content if b.type == "tool_use")
    return out.model_validate(block.input)
