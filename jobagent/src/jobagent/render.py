"""Рендер в ATS-безопасные форматы: простой Markdown и одноколоночный DOCX."""
from __future__ import annotations

import re
from pathlib import Path

from docx import Document
from docx.enum.style import WD_STYLE_TYPE
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_TAB_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

from .models import Profile, TailoredResume


def to_markdown(p: Profile, r: TailoredResume) -> str:
    c = p.contacts
    contact = " | ".join(x for x in [c.get("email"), c.get("phone"), c.get("location"), *c.get("links", [])] if x)
    out = [f"# {p.name}", r.headline, contact, "", "## Summary", r.summary, "", "## Skills", ", ".join(r.skills), "", "## Experience"]
    for e in r.experience:
        out += [f"### {e.title} — {e.company} ({e.start} – {e.end})", *[f"- {b}" for b in e.bullets], ""]
    out.append("## Education")
    out += [f"- {e.school}, {e.degree} {e.year or ''}".strip() for e in p.education]
    if p.achievements:
        out += ["", "## Achievements & Certificates", *[f"- {a}" for a in p.achievements]]
    if p.languages:
        out += ["", "## Languages", ", ".join(p.languages)]
    return "\n".join(out) + "\n"


FONT = "Times New Roman"
_RU = {"Summary": "О себе", "Skills": "Ключевые навыки", "Experience": "Опыт работы", "Education": "Образование",
       "Achievements & Certificates": "Достижения и сертификаты", "Languages": "Языки"}


def _t(p: Profile, title: str) -> str:
    return _RU[title] if re.search("[А-Яа-я]", p.name) else title


def _font(run, size=11, bold=False, italic=False):
    run.font.name = FONT
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.italic = italic
    run.font.color.rgb = RGBColor(0, 0, 0)
    rpr = run._element.get_or_add_rPr()
    rfonts = rpr.find(qn("w:rFonts"))
    if rfonts is None:
        rfonts = OxmlElement("w:rFonts")
        rpr.append(rfonts)
    for a in ("w:ascii", "w:hAnsi", "w:eastAsia", "w:cs"):
        rfonts.set(qn(a), FONT)


def _para(d, text="", size=11, bold=False, italic=False, align=None, after=2, style=None):
    para = d.add_paragraph(style=style)
    pf = para.paragraph_format
    pf.space_before, pf.space_after, pf.line_spacing = Pt(0), Pt(after), 1.0
    if align is not None:
        para.alignment = align
    if text:
        _font(para.add_run(text), size, bold, italic)
    return para


def _section(d, title):
    para = _para(d, title.upper(), 12, bold=True, after=3)
    para.paragraph_format.space_before = Pt(8)
    ppr = para._p.get_or_add_pPr()
    border = OxmlElement("w:pBdr")
    bottom = OxmlElement("w:bottom")
    for k, v in (("val", "single"), ("sz", "6"), ("space", "1"), ("color", "000000")):
        bottom.set(qn(f"w:{k}"), v)
    border.append(bottom)
    ppr.append(border)


def _bullet(d, text):
    para = _para(d, text, 11, style="List Bullet", after=1)
    para.paragraph_format.left_indent = Cm(0.9)
    para.paragraph_format.first_line_indent = Cm(-0.5)
    para.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY


def to_docx(p: Profile, r: TailoredResume, path: Path) -> None:
    d = Document()
    sec = d.sections[0]
    sec.left_margin = sec.right_margin = Cm(2)
    sec.top_margin = sec.bottom_margin = Cm(1.8)
    for st in d.styles:
        if st.type == WD_STYLE_TYPE.PARAGRAPH and hasattr(st, "font"):
            st.font.name = FONT
            st.font.color.rgb = RGBColor(0, 0, 0)

    c = p.contacts
    _para(d, p.name, 18, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, after=2)
    _para(d, r.headline, 12, italic=True, align=WD_ALIGN_PARAGRAPH.CENTER, after=2)
    _para(d, " | ".join(x for x in [c.get("email"), c.get("phone"), c.get("location"), *c.get("links", [])] if x),
          10.5, align=WD_ALIGN_PARAGRAPH.CENTER, after=2)

    _section(d, _t(p, "Summary"))
    para = _para(d, r.summary.strip(), 11)
    para.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    _section(d, _t(p, "Skills"))
    _para(d, ", ".join(r.skills), 11).alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    _section(d, _t(p, "Experience"))
    width = sec.page_width - sec.left_margin - sec.right_margin
    for e in r.experience:
        para = _para(d, after=1)
        para.paragraph_format.space_before = Pt(4)
        para.paragraph_format.tab_stops.add_tab_stop(width, WD_TAB_ALIGNMENT.RIGHT)
        _font(para.add_run(e.title), 11, bold=True)
        _font(para.add_run(f", {e.company}"), 11)
        _font(para.add_run(f"\t{e.start} – {e.end}"), 11, italic=True)
        for b in e.bullets:
            _bullet(d, b)
    _section(d, _t(p, "Education"))
    for e in p.education:
        _para(d, f"{e.school}, {e.degree}".strip(", "), 11)
    if p.achievements:
        _section(d, _t(p, "Achievements & Certificates"))
        for a in p.achievements:
            _bullet(d, a)
    if p.languages:
        _section(d, _t(p, "Languages"))
        _para(d, ", ".join(p.languages), 11)
    path.parent.mkdir(parents=True, exist_ok=True)
    d.save(path)
