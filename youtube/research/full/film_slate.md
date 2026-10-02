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

Бюджет: 💲 до $5k (1–2 локации, 3–5 актёров) · 💲💲 $5–15k · 💲💲💲 $15–30k.
Все фильмы на 85–100 минут: в данных это лучшая длительность.

| # | Название (EN) | Жанр | О чём фильм | Локации | Бюджет | Превью: картинка + текст | Почему (данные) |
|---|---|---|---|---|---|---|---|
| 1 | She Cleaned His Mansion for 10 Years… He Never Knew She Was His DAUGHTER \| Full Movie \| Drama | Драма EN | Горничная у миллиардера узнаёт, что она его дочь. Сыновья хотят её выжить | особняк (аренда на 5 дней) | 💲💲 | Плачущая горничная на переднем плане, за ней холодный мужчина в костюме · «HE NEVER KNEW» | Драма EN №1; миллиардер 22M/14,8M |
| 2 | Stranded With My Ex in Portugal… We Had 7 Days to Fall in Love Again \| Full Romance Movie | Романтика EN | Бывшие застряли вместе в отпуске из-за отменённого рейса | маленький городок у моря | 💲💲 | Пара спиной к спине на фоне моря · «7 DAYS» | LOST IN LOVE (Турция) 23,4M, Бали 14,8M |
| 3 | Left at the Altar, She Came Back 5 Years Later… as His BOSS \| Full Movie \| Romantic Drama | Романтика/драма EN | Брошенная невеста возвращается директором компании, где он работает | офис, квартира, церковь | 💲💲 | Невеста в слезах ↔ та же женщина в деловом костюме · «5 YEARS LATER» | «Брошенная невеста» 10,1M |
| 4 | The CEO Pretended to Be a Driver to Find Someone Who Loved Him for Him \| Full Movie | Романтика EN | Миллиардер под прикрытием влюбляется в официантку | машина, кафе, особняк | 💲 | Мужчина в форме водителя, за ним отражение в костюме · «SHE DIDN'T KNOW» | миллиардер + Золушка |
| 5 | Twins Separated at Birth: One Raised Rich, One Raised Poor… Until They Met \| Full Movie | Драма EN/ES | Близнецы, разлучённые при рождении, встречаются в 25 лет | 2 дома + улица | 💲💲 | Разделённый кадр: одно лицо в роскоши и в бедности · «SAME FACE» | ES-аналог 7,6M |
| 6 | A Father Becomes a Thief to Pay for His Daughter's Surgery \| Crime Drama \| Full Movie | Криминальная драма EN | Честный отец идёт на одно ограбление | квартира, больница, склад | 💲💲 | Отец в маске, в руке детский рисунок · «ONE JOB» | «Gangster to save his son» 8,8M |
| 7 | The Prayer She Wrote at 7 Was Answered 20 Years Later \| Christian Movie \| Full Movie | Христианское кино EN/ES | Записка в Библии меняет жизнь двух незнакомцев | дом, церковь | 💲 | Пожелтевшая записка в руке и заплаканное лицо · «20 YEARS» | Христианское EN хит $9,8k; ES 1,3M |
| 8 | He Lost Everything… Then a Stranger Knocked on His Door \| Faith Movie | Христианское кино EN/ES | Банкрот на грани отчаяния и таинственный гость | 1 дом | 💲 | Мужчина у двери, тёплый свет из проёма · «WHO IS HE?» | Христианское ES: 23 фильма из 40 набрали 1M+ |
| 9 | Nobody Visited Grandpa for 3 Years… What He Left Them Changed Everything \| Family Movie | Семейное кино EN | Завещание дедушки заставляет детей провести неделю вместе | загородный дом | 💲 | Дедушка один за накрытым столом · «WHY NOW?» | Семейное EN, RPM $4,40 |
| 10 | A Christmas Wish for Dad… She Didn't Expect to Fall in Love \| Christmas Movie | Семейная романтика EN/ES | Вдовец с дочкой и новая соседка на Рождество | дом, городок | 💲💲 | Девочка у окна со снегом и гирляндами · «ONE WISH» | ES «Navidad…» 8,8M; сезонный, возвращается каждый год |
| 11 | The Babysitter Saw Something She SHOULDN'T Have \| Thriller \| Full Movie | Триллер EN | Няня в доме богатой семьи находит скрытую камеру | 1 дом | 💲 | Испуганная девушка, в отражении экрана силуэт · «DON'T LOOK» | Триллер EN 693k; одна локация |
| 12 | We Rented a Cabin From a Stranger… On Day 3, We Found the Basement \| Horror Full Movie | Хоррор EN/ES | Четверо друзей, домик и чужие правила | домик в лесу | 💲 | Открытый люк в подвал, фонарик · «DAY 3» | Хоррор ES 877k при 31k у конкурентов |
| 13 | They Laughed at Her at the Reunion… 10 Years Later She Bought the School \| Full Movie | Драма мести EN | Изгойка класса возвращается на встречу выпускников | школа, ресторан | 💲💲 | Смеющиеся люди ↔ она в центре, спокойная · «LAST LAUGH» | Месть + «… later» |
| 14 | The Contract Wife of the Mafia Heir \| Full Movie (All Episodes) | Склейка микродрамы EN | Сначала снимается как 40 вертикальных серий по 2 минуты, потом склеивается в фильм | особняк, офис | 💲 | Пара: он холодный в костюме, она в свадебном · «CONTRACT» | DramaMuse 10,1M; двойной доход: Shorts + фильм |
| 15 | My Mother-in-Law Moved In… For a WHOLE Year \| Full Comedy Movie | Комедия EN/ES/PT | Свекровь въезжает к молодожёнам | 1 квартира | 💲 | Свекровь с чемоданами, у пары шок на лицах · «365 DAYS» | Комедия ES 1,34M, PT 1,27M (конкуренты 5k подписчиков) |
| 16 | I Inherited a Farm… and a CRAZY Family I Never Knew \| Comedy Movie | Комедия ES/PT | Горожанин получает ферму в наследство | ферма | 💲 | Человек в костюме в грязи среди кур · «MY FAMILY?!» | Комедия PT: 25 фильмов из 40 набрали 1M+ |
| 17 | The Last Guest at the Wedding Knew Who Killed the Bride's Father \| Mystery Thriller | Детектив EN/ES | Убийство на свадьбе, все подозреваемые за одним столом | зал / усадьба | 💲💲 | Свадебный торт, нож, лица в тени · «ONE OF THEM» | Детектив ES 716k |
| 18 | A Single Mom Took the Night Shift… What She Found in Room 304 Changed Her Life \| Full Movie | Драма EN | Медсестра и одинокий пациент-миллионер | больница (декорация) | 💲💲 | Медсестра в коридоре у приоткрытой двери · «ROOM 304» | драма + миллиардер + «…» |
| 19 | The Last King's Daughter — Her Uncle Stole the Crown \| Kingdom Drama \| Full Movie | Историческая драма EN | Изгнанная принцесса возвращает трон | замок/усадьба, лес | 💲💲💲 | Девушка с мечом, за спиной горящий замок · «RETURN» | «Last King… stole the crown» 12,8M |
| 20 | A Homeless Man Returned the Wallet… The Owner Was a Millionaire Who Needed Him More \| Full Movie | Драма EN/ES/PT | Бездомный и одинокий богач меняют жизни друг друга | улица, офис, дом | 💲 | Бездомный протягивает кошелёк, рука в дорогих часах · «HONEST» | мораль + деньги; работает на трёх языках |

### Названия на ES / PT для пятёрки лучших

| # | ES | PT |
|---|---|---|
| 1 | Limpió su mansión 10 años… Nunca supo que era su HIJA \| Película Completa | Ela limpou a mansão dele por 10 anos… Ele nunca soube que era sua FILHA \| Filme Completo |
| 7 | La oración que escribió a los 7 años fue respondida 20 años después \| Película Cristiana Completa | A oração que ela escreveu aos 7 anos foi respondida 20 anos depois \| Filme Gospel Completo |
| 8 | Lo perdió todo… hasta que un extraño tocó a su puerta \| Película Cristiana Completa | Ele perdeu tudo… até que um estranho bateu à sua porta \| Filme Gospel Completo |
| 15 | Mi suegra se mudó con nosotros… ¡Por un AÑO entero! \| Película de Comedia Completa | Minha sogra se mudou pra nossa casa… por um ANO inteiro! \| Filme de Comédia Completo |
| 20 | Un indigente devolvió la cartera… el dueño era un millonario que lo necesitaba más \| Película Completa | Um morador de rua devolveu a carteira… o dono era um milionário que precisava mais dele \| Filme Completo |
