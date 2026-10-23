# Warum es geschah — паспорт канала

**Ниша:** катастрофы и аварии — цепочка решений, которая к ним привела, и что изменилось после. Длинные документальные
фильмы на немецком (Германия, Австрия, Швейцария).
**Почему она:** 16% новичков (≤ 6 мес.) получают медиану 5 000+; рынок без доминирования (топ-3 — 44% просмотров, это
ТВ-каналы с другим форматом). Пример: Letzte Stunden — канал 88 дней, 3 100 подп., медиана 28k, «Oppau 1921» → 506k;
«Costa Concordia» у канала с 842 подп. → 55k. Медиана длины топа — 44 мин. RPM Германии ≈ $4–10.
Данные: `youtube/research/niches-deep-2026-10-23.md`.

## Своя идея (чем отличаемся)

Letzte Stunden рассказывает «последние часы». Мы делаем **расследование причин в формате отчёта**:

1. **«Kette der Fehler»** — фирменная графика: цепочка из 5–7 звеньев (решение, деталь, сбой), которая заполняется по ходу
   фильма. Зритель видит, какое звено могло всё остановить.
2. **Таймлайн-часы** в углу кадра в ключевые минуты.
3. **«Was sich danach änderte»** — финальная глава о законах и правилах, которые появились после (это то, чего нет у
   конкурентов, и это смыслово отличает канал от «трагедий ради кликов»).

Смесь тем: 50% немецкоязычный регион (Eschede, Lengede, Hamburger Sturmflut, Ramstein, Kaprun), 50% мировые катастрофы,
о которых по-немецки мало хороших фильмов (Halifax 1917, Tenerife 1977, Costa Concordia).
Правило: только события старше ~25 лет или полностью расследованные, с официальными отчётами; уважение к жертвам.

## Название и тексты

- **Название:** Warum es geschah · **хэндл:** @WarumEsGeschah (свободен на 23.10.2026)
- **Слоган:** *Katastrophen haben eine Ursache. Meistens mehrere.*
- **Описание (About):**
```
Kein Unglück passiert aus dem Nichts. Hinter jeder Katastrophe steht eine Kette von Entscheidungen, Fehlern und Zufällen –
und fast immer gab es einen Moment, in dem alles noch hätte gestoppt werden können.

Warum es geschah rekonstruiert Unglücke aus Deutschland, Österreich, der Schweiz und der Welt: Glied für Glied, auf Basis
von Untersuchungsberichten, Gerichtsakten und Zeitungsarchiven. Und am Ende: was sich danach geändert hat.

Neue Dokumentation jeden Donnerstag und Sonntag.
Visualisierungen sind KI-generierte Rekonstruktionen; Quellen in jeder Beschreibung.
```
(Перевод: «Ни одна беда не случается из ничего. За каждой катастрофой — цепочка решений, ошибок и случайностей, и почти
всегда был момент, когда всё ещё можно было остановить… реконструируем звено за звеном на основе отчётов расследований,
судебных дел и архивов газет. И в конце — что изменилось после. Новый фильм по четвергам и воскресеньям».)
- **Ключевые слова:** Katastrophe Doku, Unglück Dokumentation, ganze Dokumentation, was geschah wirklich, Zugunglück,
  Grubenunglück, Schiffsunglück, Flugzeugabsturz, Ursachen, deutsche Geschichte

## Оформление

| Элемент | Решение |
|---|---|
| Палитра | графит `#1E2327`, предупреждающий жёлтый `#FFC400`, белый, красная линия `#D7263D` |
| Шрифты | Oswald 700 (заголовки), Courier Prime (время, даты — «протокол») |
| Аватар | жёлто-чёрная предупреждающая полоса, разорванное звено цепи |
| Баннер | полоса-предупреждение, «WARUM ES GESCHAH», слоган, «Neue Doku jeden Donnerstag & Sonntag» |
| Обложка | ИИ-реконструкция места (без тел и крови); жёлтым 2–3 слова («EIN RADREIFEN»); плашка-год Courier |
| Голос | мужской, спокойный, серьёзный (немецкий); Chatterbox `de`, exaggeration 0.4 |
| Музыка | ACE-Step: «dark ambient, low drone, sparse piano, tension» — очень тихо |

## Формат выпуска (40–50 мин, медиана топа — 44)

| Время | Блок |
|---|---|
| 0:00–0:40 | **Холодный старт:** момент катастрофы в одной фразе + вопрос «warum» + «и это можно было остановить» |
| 0:40–5:00 | Мир до: место, люди, техника — нормальный день |
| 5:00–35:00 | **Звенья цепи** 1…6 (по ~5 мин): каждое — решение/деталь, кто знал, почему не остановили; цепь на экране заполняется |
| каждые 5 мин | Мини-крючок: «doch das entscheidende Glied kam erst noch» |
| 35:00–42:00 | Катастрофа и спасение (без смакования) |
| 42:00–46:00 | **Was sich danach änderte** + память о жертвах + анонс |

## Shorts внутри канала

3 в неделю: одно «звено цепи» за 45–55 с («Ein Teil, kaum größer als ein Teller…»).

## Производство на ПК (выпуск 45 мин)

Сценарий ~6 300 слов · голос Chatterbox `de` (~50–60 мин ПК) · 150–170 кадров Z-Image (~2 ч) · схемы цепи и
таймлайна — HTML-рендер репо · 10–14 клипов Wan (~1–1,5 ч) · итого ~4–5 ч ПК.

## Контент-план: первые 4 недели (чт + вс, 18:00 MEZ)

| # | Выпуск |
|---|---|
| 1 | **Eschede 1998: Ein Radreifen und 101 Tote – warum es geschah \| Ganze Dokumentation** (пилот) |
| 2 | Lengede 1963: Das Wunder nach 14 Tagen unter Tage |
| 3 | Hamburger Sturmflut 1962: Die Nacht, in der die Deiche brachen |
| 4 | Halifax 1917: Die größte Explosion vor der Atombombe |
| 5 | Ramstein 1988: Die Flugschau, die nie hätte stattfinden dürfen |
| 6 | Teneriffa 1977: Zwei Jumbos, ein Nebel, ein Missverständnis |
| 7 | Kaprun 2000: Das Feuer im Gletscherbahn-Tunnel |
| 8 | Wilhelm Gustloff 1945: Die größte Schiffskatastrophe der Geschichte |

## Пилот

- **Обложка:** ИИ-реконструкция моста у Эшеде (без людей), жёлтым «EIN RADREIFEN», плашка «1998».
- **Хук:** «Am 3. Juni 1998 brach unter einem ICE ein Stück Stahl, kaum größer als ein Teller. Sechs Minuten später waren
  101 Menschen tot. Und das Teil hätte nie in diesem Zug sein dürfen.» (Факты и формулировку «hätte nie» сверить по
  отчёту расследования перед записью; `hookscore.py` для немецкого не показателен.)
- **Опорные факты (сверить):** 3 июня 1998, ICE 884 «Wilhelm Conrad Röntgen», усталостная трещина колёсного бандажа
  (Radreifen) колёс с резиновыми вставками, удар о мост; 101 погибший; после — отказ от этой конструкции колёс.

## Риски и правила

- Уважение к жертвам: без смакования, без изображений тел, имена — только из открытых источников.
- Каждое утверждение о вине — со ссылкой на официальный отчёт или решение суда (немецкое право строже к клевете).
- Реконструкции — отметка «veränderte oder synthetische Inhalte».
