# Пакет для канала полнометражных фильмов

Основа: 1 555 уникальных фильмов длиннее 60 минут из выдачи YouTube (EN/ES/PT/JA, 12 жанров),
собраны `collect_full.py`. Измерено: названия, длительность, просмотры. Не измерено: превью
(картинки не скачивались), поэтому раздел о превью — это рекомендации, а не данные.

## 1. Какие жанры брать (по opportunity.csv)

| # | Жанр + язык | Медиана фильма в топе | Подписчики конкурентов | RPM (оценка) | $ за фильм в топе |
|---|---|---|---|---|---|
| 1 | Драма EN | 1,19M | 25k | $3,83 | $4 563 |
| 2 | Семейное кино EN | 919k | 98k | $4,40 | $4 041 |
| 3 | Комедия EN | 786k | 82k | $3,83 | $3 006 |
| 4 | Романтика EN | 632k | 31k | $3,83 | $2 416 |
| 5 | Христианское кино EN | 666k | 127k | $4,21 | $2 801 |
| 6 | Христианское кино ES | 1,30M | 31k | $1,47 | $1 913 |
| 7 | Комедия ES | 1,34M | 34k | $1,34 | $1 787 |
| 8 | Боевик ES | 1,30M | 14k | $1,20 | $1 563 |

## 2. Что отличает названия с 1M+ просмотров от названий с <100k

| Приём | 1M+ (492 фильма) | <100k (326 фильмов) | Разница |
|---|---|---|---|
| Многоточие «…» (недосказанность) | 7% | 2% | ×3,5 |
| «True story / hechos reales» | 8% | 3% | ×2,7 |
| Предупреждение, «!» или «?» | 20% | 8% | ×2,5 |
| Слово капсом (4+ буквы) | 45% | 21% | ×2,1 |
| Разделитель « \| » | 64% | 44% | ×1,5 |
| Эмодзи | 23% | 32% | хуже |
| Год в скобках | 4% | 7% | хуже |
| Длина названия (медиана) | 77 символов | 59 символов | длиннее лучше |

Длительность фильма и медиана просмотров:

| Длительность | Фильмов | Медиана просмотров |
|---|---|---|
| 60–80 мин | 163 | 284k |
| **80–95 мин** | 724 | **606k** |
| **95–110 мин** | 378 | **588k** |
| 110–140 мин | 168 | 281k |
| 140+ мин (мини-сериалы, склеенные в фильм) | 116 | 425k |

## 3. Формула названия

```
[КТО] + [что с ним случилось]… [поворот] | Full Movie | [Жанр]
```

Реальные примеры из данных:

| Просмотры | Название |
|---|---|
| 23,4M | LOST IN LOVE \| Stranded Together in Turkey \| Full Romance Movie |
| 22,1M | Beauty And The Billionaire (2022) \| Full Movie |
| 13,8M | THIS IS A MOVIE YOU'LL WANT TO WATCH OVER AND OVER AGAIN! \| Romantic Movies |
| 12,8M | The Return Of The Last King — His Brother Stole The Crown \| Full Movie |
| 10,9M | GET READY TO CRY WITH THIS STORY BASED ON TRUE EVENTS! Rise – Full Movie |
| 10,1M | Aurora, a plus-size bride abandoned by a Mafia don, transforms and conquers his ruthless family |
| 8,8M | A Man Becomes a Gangster to Save his Son \| Action Crime \| Full Movie |
| 8,8M | Ella no esperaba enamorarse en Navidad… \| Película Completa |
| 7,6M | SU MADRE LOS ABANDONÓ… A UNO LO ADOPTÓ UNA FAMILIA RICA, EL OTRO… |
| 15,6M | Filme Gospel "Onde está meu lar?" História verídica que leva as pessoas às lágrimas |

Правила:
1. Первые ~45 символов — это крючок. В поиске видно примерно 60–70 символов, на телефоне меньше.
2. Одно слово капсом, а не всё название.
3. «…» на месте поворота сюжета.
4. В конце метка «| Full Movie | Жанр». По ней находят тех, кто ищет «full movie».
5. «True story» и «hechos reales» пиши **только если это правда**. Ложная метка — это обманные метаданные, YouTube за такое наказывает.
6. Без года и без эмодзи.

## 4. Превью (рекомендации, не замер)

1. **Одно лицо крупным планом с сильной эмоцией**: слёзы, шок, ярость. Лицо занимает 40–60% кадра.
2. **Контраст в кадре**: богатый и бедная, свадебное платье и грязь, ребёнок и тёмный силуэт за дверью.
3. **2–4 слова текста**, и они **не повторяют** название, а дополняют его: «HE NEVER KNEW», «10 YEARS LATER».
4. Цветокор как у постера: тёплое против холодного, тёмный фон.
5. Маленькая плашка «FULL MOVIE» в углу (так делают топ-каналы).
6. Проверь, как превью смотрится в размере 160 пикселей по ширине (так оно выглядит на телефоне). Если не читается, упрости.

## 5. Шаблон описания

```
She cleaned his mansion for 10 years. He never knew she was his daughter.
Watch the full movie — a story about family, pride and second chances.

▶ SUBSCRIBE for a new full movie every week: [ссылка]

STORY
Maria, a quiet housekeeper, has worked for billionaire Richard Hale for a decade.
When a medical test reveals a secret buried for 25 years, both must decide what
family really means — before Richard's sons take everything.

CHAPTERS
00:00 The Housekeeper
08:40 The Test
24:15 The Sons
41:30 The Letter
58:10 The Truth
1:16:00 Choice

CAST: [имена] · DIRECTOR: [имя] · WRITER: [имя]
© [год] [твоя студия]. All rights reserved. Original film, uploaded by the rights holder.

Also available with Spanish and Portuguese audio (Settings ⚙ → Audio track).

#fullmovie #dramamovie #familydrama
```

Правила: первые 2 строки повторяют крючок (их видно до «ещё»). Таймкоды глав должны начинаться
с 00:00, глав минимум три, каждая не короче 10 секунд. Хэштегов три. Строка о правах
нужна обязательно, она помогает при спорах по Content ID.

## 6. Топ-20 фильмов, которые стоит снять

См. ответ в чате (тот же список) — названия, синопсис, локации, бюджет и превью.
