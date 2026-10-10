from __future__ import annotations

import argparse
import re
from pathlib import Path

import httpx

from . import ats, tailor as tl
from .config import OUT, env, load_dotenv, load_profile
from .models import TailoredResume
from .render import to_docx, to_markdown
from .sources import hh, manual
from .store import Store


def _slug(s: str) -> str:
    return re.sub(r"[^\w]+", "_", s)[:40]


def _print_ats(rep: ats.AtsReport) -> None:
    print(f"ATS score: {rep.score}/100")
    if rep.keyword_coverage is not None:
        print(f"Покрытие ключевых слов: {rep.keyword_coverage:.0%}; не хватает: {', '.join(rep.missing_keywords)}")
    for i in rep.issues:
        print(f" - {i}")


def _build(profile, vac) -> tuple[TailoredResume, ats.AtsReport, Path]:
    t = tl.tailor(profile, vac)
    rep = ats.check(t, profile, f"{vac.title}\n{vac.description}")
    base = OUT / f"{vac.source}_{_slug(vac.company or vac.id)}_{_slug(vac.title)}"
    base.parent.mkdir(exist_ok=True)
    to_docx(profile, t, base.with_suffix(".docx"))
    base.with_suffix(".md").write_text(to_markdown(profile, t))
    base.with_suffix(".letter.txt").write_text(t.cover_letter)
    return t, rep, base


def cmd_check(a) -> None:
    p = load_profile()
    _print_ats(ats.check(p, p))


def cmd_export(a) -> None:
    p = load_profile(Path(a.profile))
    t = TailoredResume(headline=p.headline, summary=p.summary, skills=p.skills, experience=p.experience, cover_letter="")
    base = OUT / Path(a.profile).stem
    OUT.mkdir(exist_ok=True)
    to_docx(p, t, Path(f"{base}.docx"))
    Path(f"{base}.md").write_text(to_markdown(p, t))
    _print_ats(ats.check(p, p))
    print(f"Файлы: {base}.docx / .md")


def cmd_tailor(a) -> None:
    p = load_profile()
    vac = manual.from_file(Path(a.file))
    m = tl.score(p, vac)
    print(f"Match {m.score}/100\n + {'; '.join(m.reasons)}\n - пробелы: {'; '.join(m.gaps)}")
    t, rep, base = _build(p, vac)
    _print_ats(rep)
    print(f"Файлы: {base}.docx / .md / .letter.txt")


def cmd_hh_auth(a) -> None:
    cid, redirect = env("HH_CLIENT_ID"), env("HH_REDIRECT_URI")
    if not a.code:
        print(f"Откройте и разрешите доступ:\nhttps://hh.ru/oauth/authorize?response_type=code&client_id={cid}&redirect_uri={redirect}\n"
              "Затем: jobagent hh-auth --code <code из адресной строки>")
        return
    r = httpx.post("https://api.hh.ru/token", data={
        "grant_type": "authorization_code", "client_id": cid, "client_secret": env("HH_CLIENT_SECRET"),
        "code": a.code, "redirect_uri": redirect})
    r.raise_for_status()
    print("Положите в .env:\nHH_ACCESS_TOKEN=" + r.json()["access_token"])


def cmd_hh_run(a) -> None:
    p, store = load_profile(), Store()
    limit = int(env("JOBAGENT_DAILY_LIMIT", "15"))
    black = {c.lower() for c in p.preferences.blacklist_companies}
    sent = 0
    for v in hh.search(p.preferences):
        if store.seen("hh", v.id) or v.company.lower() in black:
            continue
        v = hh.details(v)
        m = tl.score(p, v)
        if m.score < a.threshold:
            store.record("hh", v.id, v.title, v.company, m.score, "skipped")
            continue
        print(f"\n[{m.score}] {v.title} @ {v.company}  {v.url}\n  + {'; '.join(m.reasons[:3])}\n  - {'; '.join(m.gaps[:3])}")
        t, rep, base = _build(p, v)
        print(f"  ATS {rep.score}/100 → {base}.docx")
        if not a.send:
            store.record("hh", v.id, v.title, v.company, m.score, "drafted")
            continue
        if store.sent_today() >= limit:
            print("Дневной лимит достигнут."); break
        if input("  Отправить отклик? [y/N] ").strip().lower() == "y":
            hh.apply(v, a.resume_id or env("HH_RESUME_ID"), t.cover_letter)
            store.record("hh", v.id, v.title, v.company, m.score, "sent"); sent += 1
            print("  ✔ отправлено")
        else:
            store.record("hh", v.id, v.title, v.company, m.score, "rejected")
    print(f"\nГотово. Отправлено: {sent}")


def main() -> None:
    load_dotenv()
    ap = argparse.ArgumentParser(prog="jobagent")
    sub = ap.add_subparsers(required=True)
    sub.add_parser("check", help="ATS-проверка мастер-профиля").set_defaults(fn=cmd_check)
    s = sub.add_parser("export", help="Выгрузить профиль как есть в DOCX/MD (напр. английская версия)")
    s.add_argument("profile"); s.set_defaults(fn=cmd_export)
    s = sub.add_parser("tailor", help="Резюме+письмо под вакансию из файла (LinkedIn/Indeed/любая)")
    s.add_argument("file"); s.set_defaults(fn=cmd_tailor)
    s = sub.add_parser("hh-auth", help="OAuth для hh.ru"); s.add_argument("--code"); s.set_defaults(fn=cmd_hh_auth)
    s = sub.add_parser("hh-run", help="Поиск → оценка → резюме → (подтверждённый) отклик на hh.ru")
    s.add_argument("--threshold", type=int, default=70)
    s.add_argument("--resume-id", default="")
    s.add_argument("--send", action="store_true", help="без флага — только черновики (dry-run)")
    s.set_defaults(fn=cmd_hh_run)
    a = ap.parse_args()
    a.fn(a)


if __name__ == "__main__":
    main()
