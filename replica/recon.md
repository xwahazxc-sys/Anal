# Recon map: Yuka (iOS, Android)

Scope: приложение целиком (по ответу пользователя); оценка размера ниже
For: бизнес пользователя
Date: 2026-10-05

> СТАТУС: ЧЕРНОВИК ПО ПУБЛИЧНЫМ ПОИСКОВЫМ ВЫДЕРЖКАМ.
> Сеть среды блокирует apps.apple.com, yuka.io, help.yuka.io, поэтому страницы я не открывал.
> Экраны и состояния не подтверждены скриншотами. Всё, чего я не видел, помечено «не подтверждено».
> Пользователь подтвердил: клонируем Yuka (страница в выдаче: id1092799236).

## Sources

| # | source | URL | notes |
| --- | --- | --- | --- |
| 1 | App Store listing | https://apps.apple.com/us/app/yuka-food-cosmetic-scanner/id1092799236 | только в выдаче поиска, не открыт |
| 2 | Страница приложения | https://yuka.io/en/app/ | не открыта |
| 3 | Help: Premium | https://help.yuka.io/l/en/article/dop80j54bb | выдержка |
| 4 | Help: офлайн-режим | https://help.yuka.io/l/en/article/70y4npk83u-how-activate-the-offline-mode-ios | выдержка |
| 5 | Help: как создана база | https://help.yuka.io/l/en/article/5a4z64amnk | выдержка |
| 6 | Help: проверка данных | https://help.yuka.io/l/en/article/p0ka7o7xcm-verification-information | выдержка |
| 7 | Help: финансирование | https://help.yuka.io/l/en/article/zrgtb8f2ka | выдержка |
| 8 | Обзоры (NewsNation, CBS, Refinelife) | https://www.newsnationnow.com/business/tech/yuka-app-groceries-cosmetics-rating/ | вкладки History/Favorites, фонарик |

## Core loop

Навёл камеру на штрихкод, за секунду получил оценку 0-100 с цветом и причинами, и, если оценка плохая, увидел лучшие альтернативы.

## Screens

| ID | screen | route / how to reach | purpose | key components | states seen |
| --- | --- | --- | --- | --- | --- |
| S01 | Сканер | главная вкладка, кнопка Scan | навести на штрихкод | камера, фонарик, рамка | не подтверждено |
| S02 | Карточка продукта | после скана, из истории, из поиска | оценка и разбор | фото, балл, цвет, блоки «питательность», «добавки», «органик» | найден / не найден |
| S03 | Альтернативы | со S02 для плохих продуктов | лучшие аналоги | список карточек с баллом | не подтверждено |
| S04 | История | вкладка History | прошлые сканы | список с фото | пусто / заполнено (пусто не подтверждено) |
| S05 | Избранное | вкладка Favorites | сохранённое | список | не подтверждено |
| S06 | Добавление продукта | со S02 «не найден» | собрать фото упаковки, состава, таблицы | камера, шаги | не подтверждено |
| S07 | Поиск (Premium) | не подтверждено | найти продукт без скана | строка поиска, результаты | не подтверждено |
| S08 | Предпочтения (Premium) | не подтверждено | диета и аллергены | переключатели | не подтверждено |
| S09 | Подписка | не подтверждено | покупка Premium | цена, список преимуществ | не подтверждено |
| S10 | Профиль и настройки | не подтверждено | аккаунт, офлайн-режим | не подтверждено | не подтверждено |

## Flows

```
F01 Проверить продукт в магазине
    S01 -> S02 (-> S03 если оценка плохая)
    happy path clicks: 1-2 (открыть сканер, навести)
    edge: плохой свет (фонарик), нет сети (офлайн, Premium), нет такого продукта в базе
F02 Добавить неизвестный продукт
    S02 «не найден» -> S06 -> подтверждение
    edge: нечитаемое фото, много нераспознанного текста (ручная расшифровка)
F03 Вернуться к прошлому продукту
    S04 или S05 -> S02
F04 Купить Premium
    любой Premium-экран -> S09
```

## Components

| component | variants | states | used on |
| --- | --- | --- | --- |
| Цветовая метка/балл | зелёный, жёлтый, оранжевый, красный | не подтверждено | S02, S03, S04, S05 |
| Карточка продукта в списке | с фото, с баллом | не подтверждено | S03, S04, S05 |
| Вкладки навигации | Scan, History, Favorites (и др., не подтверждено) | активная/неактивная | все |
| Кнопка фонарика | вкл/выкл | не подтверждено | S01 |
| Блок ингредиента с уровнем риска | 4 уровня риска | не подтверждено | S02 |

## Inferred data model

```
Product      id, barcode, type (food | cosmetic), name, brand, photos, ingredients[],
             nutrition (per 100 g), organic (bool), score (0-100), color
             evidence: S02, help «How was the database created?»
             confidence: high
Ingredient   id, name, risk_level (none | low | moderate | high), type (additive | cosmetic)
             evidence: статьи о цветовой шкале
             confidence: medium
ScanEvent    id, user_id, product_id, scanned_at
             evidence: вкладка History
             confidence: high
Favorite     user_id, product_id
             evidence: вкладка Favorites
             confidence: high
Submission   id, user_id, barcode, photos[], status (pending | auto_ok | manual_review | published)
             evidence: help «verification information»
             confidence: medium
User         id, premium (bool), preferences (vegetarian, vegan, palm_oil, gluten, lactose)
             evidence: help «Premium»
             confidence: medium
```

Relationships: Product 1-n ScanEvent, User 1-n ScanEvent, User n-n Product (Favorite), Product n-n Ingredient, User 1-n Submission.

## Feature matrix

See `features.csv`. Must: 11, should: 7, could: 3, skip: 2.

## Out of scope (cannot or should not be cloned)

- База Yuka (миллионы продуктов), данные от брендов и вклад пользователей: принадлежит Yuka. Нужен свой источник (например, открытые базы) и свои пользователи.
- Научные оценки риска добавок и ингредиентов, сделанные Yuka: свои справочники надо собирать самим.
- Название, логотип, тексты, иллюстрации, шкала с их оформлением.
- Доверие и репутация независимого сервиса.

## Size

Screens 10 (не подтверждено), flows 4, entities 6. Hard parts: сканер штрихкода в реальном времени, данные о продуктах и справочник ингредиентов, офлайн-режим с синхронизацией, проверка пользовательских фото (распознавание текста), подписка. Size: L (квартал). Основной цикл без базы Yuka укладывается в M, но «клон без данных» не имеет ценности.
