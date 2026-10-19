# Серия 1: The Group Chat

**Title:** What If Your Building's Group Chat Sees Someone You Can't? 🚪
**Запасной title:** Your Neighbors Can See Him. You Can't.
**Длина:** ~75 с, ~175 слов. Темп медленный, с паузами.

## Сюжет коротко
В 2:14 ночи групповой чат дома пишет герою (APT 4B, живёт один), что у его двери стоит мужчина. Герой открывает камеру в коридоре: там пусто. Мужчина «прижался ухом к двери», а на камере всё ещё пусто. Управляющий пишет, что камера в коридоре сломана со вторника. Тогда сосед присылает скриншот того, что видят все остальные. Это не коридор, а **гостиная героя изнутри**: на диване сидит он сам, а за спинкой дивана стоит мужчина. «У двери» означало «у двери изнутри». Последний удар: в чате 12 квартир, но 13 участников, и тринадцатый, под именем «4B», печатает: *Don't turn around.*

## Сценарий (English voice-over)
Текст в `[квадратных скобках]` — то, что на экране. Голос его не читает.

| Время | Голос (narration) | На экране |
| --- | --- | --- |
| 0:00 | What if, at 2:14 a.m., your building's group chat lit up… about you? | `🔴 NIGHT 1 · 2:14 AM · APT 4B`. Тёмная спальня, телефон загорается на тумбочке |
| 0:05 | "4B — there's a man standing at your door." | Уведомление: **Mrs. Park (2A):** 4B — there's a man standing at your door. |
| 0:09 | You're 4B. You live alone. | Силуэт садится на кровати. Субтитр: you live **ALONE** |
| 0:12 | "I see him too. Don't open it. Don't even look through the peephole." | **Dev (3C):** I see him on the hallway cam. Don't open. Don't look through the peephole. |
| 0:18 | So you open the hallway camera instead. | Ссылка «🎥 Hallway Cam — LIVE» → картинка с камеры |
| 0:21 | The hallway is empty. | Пустой коридор, дверь 4B, гудит лампа. Субтитр: **EMPTY** |
| 0:24 | "He just put his ear against your door." | **Mrs. Park (2A):** he just put his ear against your door 😨 |
| 0:28 | You look again. Still empty. | Та же камера, ничего не изменилось. Тиканье |
| 0:31 | "4B, why are you sitting so still?" | **Dev (3C):** 4B why are you sitting so still |
| 0:35 | You haven't moved. You haven't said a word. | Силуэт в гостиной на диване, освещён только телефоном |
| 0:39 | Then the building manager writes. | **Building Manager:** Everyone stop. |
| 0:42 | "The hallway camera has been broken since Tuesday. What are you all watching?" | **Building Manager:** The hallway camera has been broken since Tuesday. What are you all watching? |
| 0:48 | The chat goes silent. | Полсекунды полной тишины, затем «…» печатает Dev |
| 0:51 | Dev sends a screenshot. | Скриншот появляется в чате. Зум |
| 0:53 | It's not the hallway. It's your living room. | На скриншоте вид изнутри квартиры: входная дверь, диван, на диване ты. Субтитр: **YOUR** living room |
| 0:58 | You're on the couch. And behind the couch, facing your door… is him. | За спинкой дивана тёмная фигура, жёлтый свет из-под входной двери |
| 1:04 | You check the member list. Twelve apartments. Thirteen members. | Список: 1A … 4C (12 квартир), внизу **13 members**. Субтитр: **13** |
| 1:09 | The thirteenth is called "4B". | Последняя строка: **4B** — *typing…* |
| 1:12 | "Don't turn around." | Сообщение от 4B: **Don't turn around.** Экран гаснет |
| 1:15 | Would you turn around? Night two is coming. | Дверь, свет из-под неё гаснет. **NIGHT 2 →** |

## Голос одним блоком (для ElevenLabs)
```
What if, at 2:14 a.m., your building's group chat lit up... about you?
"4B — there's a man standing at your door."
You're 4B. You live alone.
"I see him too. Don't open it. Don't even look through the peephole."
So you open the hallway camera instead.
The hallway is empty.
"He just put his ear against your door."
You look again. Still empty.
"4B, why are you sitting so still?"
You haven't moved. You haven't said a word.
Then the building manager writes.
"The hallway camera has been broken since Tuesday. What are you all watching?"
The chat goes silent.
Dev sends a screenshot.
It's not the hallway. It's your living room.
You're on the couch. And behind the couch, facing your door... is him.
You check the member list. Twelve apartments. Thirteen members.
The thirteenth is called "4B".
"Don't turn around."
Would you turn around? Night two is coming.
```
Советы для ElevenLabs: между репликами ставьте паузу (пустая строка или `<break time="0.6s"/>`). Перед «It's not the hallway» сделайте паузу 1 с.

## Описание (YouTube)
```
What if, at 2:14 a.m., your building's group chat could see a man at your door… and you couldn't?

Would you turn around? Tell me in the comments 👇
Subscribe so you don't miss Night 2.

#whatif #horrorstory #scarystories #creepy #animation #shorts
```
**Закреплённый комментарий:** `Be honest — would you turn around? 👀`

## Картинки для fal.ai (если делать кадры нейросетью)
Общий стиль, добавлять в каждый промпт:
```
minimal flat 2D vector illustration, dark navy night palette (#0E1428), faceless hooded silhouette character, soft film grain, single warm yellow light accent (#FFC94A), clean shapes, vertical 9:16, no text
```
1. `dark bedroom at night, smartphone glowing on a nightstand, faceless hooded figure sitting up in bed`
2. `empty apartment hallway seen from a ceiling security camera, door with number 4B, flickering ceiling light, CCTV look`
3. `small dark living room seen from a high corner, front door with warm light under it, faceless hooded figure on a couch lit only by a phone, a tall dark shadowy man standing behind the couch facing the door`
4. `close-up of an apartment front door from inside, warm yellow light leaking under the door, then darkness`

Чатовые экраны лучше сверстать самим (HTML или Canva), так текст получится чётким. Имена и номера в чате вымышленные.
