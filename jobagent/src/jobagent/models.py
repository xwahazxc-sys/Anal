from __future__ import annotations

from pydantic import BaseModel, Field


class Experience(BaseModel):
    company: str
    title: str
    start: str
    end: str = "present"
    bullets: list[str] = Field(default_factory=list)


class Education(BaseModel):
    school: str
    degree: str = ""
    year: int | None = None


class Preferences(BaseModel):
    roles: list[str] = Field(default_factory=list)
    min_salary_rub: int | None = None
    remote_only: bool = False
    areas: list[str] = Field(default_factory=list)
    blacklist_companies: list[str] = Field(default_factory=list)


class Profile(BaseModel):
    name: str
    headline: str = ""
    contacts: dict = Field(default_factory=dict)
    summary: str = ""
    skills: list[str] = Field(default_factory=list)
    experience: list[Experience] = Field(default_factory=list)
    education: list[Education] = Field(default_factory=list)
    languages: list[str] = Field(default_factory=list)
    achievements: list[str] = Field(default_factory=list)
    preferences: Preferences = Field(default_factory=Preferences)


class Vacancy(BaseModel):
    source: str
    id: str
    title: str
    company: str = ""
    url: str = ""
    description: str = ""
    salary: str = ""
    area: str = ""


class Match(BaseModel):
    score: int  # 0..100
    reasons: list[str]
    gaps: list[str]
    keywords: list[str]  # ключевые слова вакансии, реально подтверждённые профилем


class TailoredResume(BaseModel):
    headline: str
    summary: str
    skills: list[str]
    experience: list[Experience]
    cover_letter: str
