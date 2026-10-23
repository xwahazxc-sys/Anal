# ROBLOX FANTOM — аудит и контент-план Shorts (23.10.2026)

Канал: https://www.youtube.com/channel/UCCRHT_3uzPzdkf39OTWoMYw · создан 8.06.2026 · 3,79k подписчиков ·
6 видео, все вышли ~3 мес. назад, после этого тишина.

| # | Видео (33–36 мин) | Просмотры |
|---|---|---|
| 1 | ROBLOX Animal Hospital … TikTok Compilation #1 | 103k |
| 2 | … #2 | 56k |
| 3 | … #3 | 29k |
| 4 | … #4 | 152k |
| 5 | … #5 | 3,2k |
| 6 | … #6 | 2,9k |

## 1. Главная проблема (чинить первой, на этой неделе)

**Канал построен на чужом контенте и на сексуализированных обложках с детскими персонажами.**

- Ролики — нарезки чужих TikTok: в кадре чужие водяные знаки («Alight Motion», ники авторов), чужие стримеры с веб-камерой.
  Для YouTube это «повторно используемый контент» (reused content): такой канал **не примут в партнёрку**, а каждый
  автор может прислать страйк. Резкое падение #5 и #6 до ~3k — типичная картина, когда YouTube перестаёт продвигать
  такие ролики.
- Обложки: фан-арт персонажей детской игры в позах с «засветами» на груди, «медсёстры». Аудитория Roblox — дети.
  Это зона политики YouTube о безопасности детей (сексуализация персонажей, ориентированных на детей): за неё каналы
  **удаляют целиком**, без трёх страйков.

**Что сделать на этой неделе:**
1. Заменить все 6 обложек на нейтральные (персонаж + название, без сексуализации) или скрыть ролики (доступ по ссылке).
2. Больше не выпускать нарезки чужих TikTok.
3. Запустить оригинальные Shorts по плану ниже: их делаем сами, через ИИ на твоём ПК.

## 2. Что уже работает (не сломать)

- **Ниша живая.** За последний месяц — 618 Shorts про Animal Hospital в выборке поиска, лучшие набирают 180–580 тыс.
- **У канала есть аудитория:** 3,79k подписчиков, которые пришли именно за Animal Hospital. Новые Shorts по той же игре
  попадут к ним первыми.
- **Ролик #4 (152k)** показывает, что тема Animal Hospital находит зрителя. Нужна та же тема, но оригинальный контент.

## 3. Что сейчас набирает просмотры (Shorts про Animal Hospital за месяц)

| Формат | Роликов | Медиана просмотров | Лучший | Вывод |
|---|---|---|---|---|
| Кроссоверы («Countryballs × Animal Hospital», «Celebrities in Animal Hospital») | 8 | **4 900** | 147k | Мало конкурентов, высокая медиана — **главная ставка** |
| Комикс-дабы, реакции | 21 | 1 600 | 195k | Обычно чужие комиксы → нельзя |
| Sprunki OC: персонаж phase 1→3 | 111 | 920 | 183k | Доказанный формат, но тесно; делать с лучшим качеством |
| Фан-анимации, истории | 89 | 540 | 579k | Лотерея, но потолок высокий |
| Геймплей, гайды, «самые безумные моменты» | 93 | 540 | 353k | Нужен свой геймплей |
| Песни про персонажей, ремиксы | 126 | 94 | 500k | Много мусора, но хиты огромные; ИИ-музыка дешёвая |
| Мукбанг / «chonky» | 13 | 6 800 | 58k | **Не делаем**: фетиш-контент с детскими персонажами, риск удаления |

Данные: поиск YouTube «за месяц, короткие», 6 запросов, 1 305 роликов; файлы — scratchpad сессии, `search_all.json`.

## 4. Пять рубрик канала

Все рубрики — свои: сюжет, картинка, музыка и голос сделаны ИИ под нашим контролем. Персонажи — фан-арт по игре
(так делают все каналы ниши); никакой сексуализации, крови и «беременных» тем.

| Рубрика | Длина | Суть | Хук (оценка `hookscore.py`) |
|---|---|---|---|
| **A. Anomaly Check** | 20–30 с | Механика самой игры: 5 пациентов, один — аномалия, у зрителя 3 секунды. Ответ — в комментариях, потом раскрытие | «You have 3 seconds. One of these 5 patients is an anomaly, and if you let it in, you lose the whole shift.» — 54 |
| **B. Кроссоверы** | 30–45 с | «Animal Hospital × Countryballs / Among Us / Digital Circus / Verity», «персонажи как малыши / супергерои / в Minecraft» | «You think the Intern is safe. Watch phase 3 and tell me you'd still let him in.» — 48 |
| **C. Sprunki-фазы** | 25–35 с | Персонаж игры как Sprunki: phase 1 (милый) → 2 → 3 (жуткий), под свою бит-петлю | «You've let this patient in 100 times. You never noticed his left hand. Look again.» — 52 |
| **D. Песня персонажа** | 45–60 с | Своя песня с вокалом про персонажа (ИИ-музыка), текст — субтитрами, кадры персонажа | «Dr. Harlow has a daughter. You can find her in 1 room, on 1 shift, and nobody checks it.» — 56, лучший |
| **E. Лор за 40 секунд** | 35–45 с | Одна тайна игры голосом рассказчика: секретная комната, история Барни, дочь доктора Харлоу | «If you let Barney in on shift 13, you lose. Here's the one thing he does differently.» — 52 |

`hookscore.py` настроен на обучающие ролики и занижает развлекательные хуки; лучшие варианты набрали 52–56 («рабочий»).
Хуки с выдуманной статистикой («97% игроков…») отброшены. Все игровые факты (смены, комнаты, дочь Харлоу) сверяем
в самой игре перед выпуском.

## 5. Музыка: жанры по рубрикам (ACE-Step на твоём ПК, свои треки — без Content ID)

| Рубрика | Жанр (подсказка для ACE-Step) | Почему |
|---|---|---|
| A. Anomaly Check | tense horror suspense, ticking clock, music box, sub-bass hits, 100 bpm | Тиканье держит 3 секунды ожидания |
| B. Кроссоверы | meme phonk / hardtekk, 150–160 bpm, cowbell, heavy 808 | В нише уже заходят «ANIMAL HOSPITAL HARDTEKK» и phonk-эдиты |
| C. Sprunki-фазы | beatbox-петля в стиле Incredibox, 120 bpm → та же петля «detuned, distorted, horror» на phase 3 | Это узнаваемый звук формата Sprunki |
| D. Песни | Harlow — dark musical theatre villain song; Intern — nervous pop-punk; Secret Agent — spy jazz; Barista — lo-fi café pop; Barney — sad piano ballad | Песни персонажей — топ ниши (DR. HARLOW song 235k, Theme Song 243k) |
| E. Лор | dark ambient, slow music box, low drone | Не мешает голосу |

Чужие песни (Soda Pop, Golden и т. п.) не используем: Content ID заберёт доход или заблокирует ролик.

## 6. Расписание: 1 Short в день, 15:00–17:00 по Нью-Йорку (дети после школы); сб–вс — 11:00

| День | Рубрика |
|---|---|
| Пн | A. Anomaly Check |
| Вт | B. Кроссовер |
| Ср | C. Sprunki-фазы |
| Чт | A. Anomaly Check |
| Пт | D. Песня персонажа |
| Сб | B. Кроссовер / «персонажи как…» |
| Вс | E. Лор за 40 секунд |

### Первые 30 дней

| # | Рубрика | Название | Музыка |
|---|---|---|---|
| 1 | A | Let Him In or Not? 🚪 Animal Hospital Anomaly Check #1 | ticking suspense |
| 2 | B | Countryballs in Animal Hospital 🌍🏥 Roblox | phonk |
| 3 | C | Dr. Harlow as a Sprunki 😱 Phase 1 to 3 \| Animal Hospital | beatbox → horror |
| 4 | A | Find the Anomaly in 3 Seconds 🏥 Animal Hospital Roblox | ticking suspense |
| 5 | D | Dr. Harlow's Song 🎵 "Check In, Never Out" \| Animal Hospital | villain musical |
| 6 | B | Animal Hospital Characters as Babies 👶 Roblox | phonk |
| 7 | E | Dr. Harlow's Daughter: the Room Nobody Checks \| Animal Hospital | dark ambient |
| 8 | A | Anomaly Check #2: Only One Is Real 👀 | ticking suspense |
| 9 | B | Among Us × Animal Hospital: Who Is the Anomaly? 🔪 | phonk |
| 10 | C | The Intern Phase 1 → Phase 3 \| Animal Hospital Sprunki | beatbox → horror |
| 11 | A | Anomaly Check #3: Look at His Hands 🖐️ | ticking suspense |
| 12 | D | The Intern's Song 🎵 "Shift Twenty" | pop-punk |
| 13 | B | Animal Hospital Characters as Superheroes 🦸 | hardtekk |
| 14 | E | Barney's Sad Story in 40 Seconds \| Animal Hospital Roblox | sad piano |
| 15 | A | Anomaly Check #4: Sanity at 17% ⚠️ | ticking suspense |
| 16 | B | Digital Circus × Animal Hospital 🎪 | phonk |
| 17 | C | Secret Agent as a Sprunki 🕶️ Phase 1 to 3 | beatbox → horror |
| 18 | A | Anomaly Check #5: The Nurse Is Wrong 😨 | ticking suspense |
| 19 | D | Secret Agent's Song 🎵 Spy Jazz \| Animal Hospital | spy jazz |
| 20 | B | Animal Hospital Characters in Minecraft ⛏️ | hardtekk |
| 21 | E | The Secret Room Only Opens on One Shift \| Animal Hospital | dark ambient |
| 22 | A | Anomaly Check #6: Twins? 👯 | ticking suspense |
| 23 | B | Verity × Animal Hospital 😈 | phonk |
| 24 | C | Barney as a Sprunki 🧸 Phase 1 to 3 | beatbox → horror |
| 25 | A | Anomaly Check #7: Hardest One Yet 🔥 | ticking suspense |
| 26 | D | Barista's Song ☕ \| Animal Hospital | lo-fi café pop |
| 27 | B | Which Animal Hospital Character Are You? (Birthday Month) 🎂 | phonk |
| 28 | E | Why the Firefighter Never Leaves \| Animal Hospital Lore | dark ambient |
| 29 | A | Anomaly Check #8: Comment Your Answer 👇 | ticking suspense |
| 30 | C | Tiny Anomaly as a Sprunki 🐟 Phase 1 to 3 | beatbox → horror |

После 30 дней: удваиваем рубрику, у которой лучший показатель «досмотры / пролистывания» в YouTube Studio, и убираем
худшую.

## 7. Как это делается через ИИ (твой ПК + Claude)

| Шаг | Кто / чем | Время ПК на 1 Short |
|---|---|---|
| Сюжет, хук, текст песни, раскадровка 6–10 кадров | Claude | — |
| Референсы персонажей | Ты один раз делаешь скриншоты каждого персонажа в игре → `references/` | — |
| Кадры персонажей в одном стиле | Qwen-Image-Edit (по скриншоту-референсу) или Z-Image (фоны) — ComfyUI | 8–15 мин |
| Анимация 3–4 ключевых кадров (вертикально 544×960) | Wan 2.2 5B — ComfyUI | 20–25 мин |
| Музыка / песня с вокалом | ACE-Step 1.5 — ComfyUI | 1–2 мин |
| Голос (лор, персонажи) | ElevenLabs по API (платно; ключ ставишь через `setx ELEVENLABS_API_KEY`) | секунды |
| Монтаж 9:16: быстрые склейки, субтитры по словам, звуки | Claude (`youtube/channels/_tools`) | — |
| Публикация | Ты (позже можно подключить YouTube API) | — |

Итого ~35–45 минут ПК на Short → 1–2 в день без проблем.

**Что нужно доустановить:** Qwen-Image-Edit для персонажей (около 20 ГБ, дам команду) и ключ ElevenLabs (по желанию).

## 8. Чего пока НЕ делать

- Длинные нарезки и любые чужие клипы — пока не будет 30 оригинальных Shorts.
- Мукбанг, «chonky», «girls», беременность, фан-сервис — даже если в нише это набирает.
- Чужие песни в фоне.
- Подавать заявку в партнёрку раньше, чем на канале будет месяц оригинального контента: заявку смотрят вручную, и
  компиляции её завалят.

**Про деньги:** аудитория детская, доход Shorts в такой нише — центы за тысячу просмотров. Ставка — рост подписчиков и
просмотров. Партнёрка: 1 000 подписчиков (уже есть) и 10 млн просмотров Shorts за 90 дней.
