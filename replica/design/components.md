# Components

Источник: список компонентов из `replica/recon.md`. Скриншотов оригинала нет, поэтому размеры и состояния — предложение, а не измерение. Иконки: Lucide (MIT). Шрифт: Inter. Подписи пишутся заново.

Цвет никогда не передаёт смысл один: у каждой оценки есть число и слово (например, «Отлично», «Хорошо», «Посредственно», «Плохо»).

ScoreBadge (цветовая метка и балл)
  variants  good (>=75), ok (50-74), poor (25-49), bad (<25), unknown
  sizes     sm 24px (в списке), lg 64px (на карточке)
  states    default, loading (скелетон), unknown (серый, «нет оценки»)
  tokens    bg score-*, text on-score, radius pill, font lg/600
  a11y      текст «Оценка 82 из 100, отлично», не только цвет
  used on   S02, S03, S04, S05
  note      пороги 75/50/25 — предположение, подтвердить по описанию оценки

ProductCard (карточка в списке)
  variants  default, compact
  sizes     высота 72px
  states    default, pressed, loading, error
  tokens    bg surface, border border, radius md, shadow card
  a11y      вся карточка — одна кнопка, имя продукта + оценка в метке
  used on   S03, S04, S05

TabBar (нижняя навигация)
  variants  3 вкладки: Scan, History, Favorites (набор не подтверждён)
  sizes     высота 56px + безопасная зона
  states    active (accent), inactive (text-muted), pressed
  tokens    bg bg, border border, font xs/500
  a11y      роль tablist, активная вкладка объявляется, цель касания не меньше 44px
  used on   все

ScannerFrame (камера и рамка)
  variants  default, scanning, found, error
  states    нет разрешения (экран-объяснение с кнопкой «Открыть настройки»), нет света (подсказка про фонарик), штрихкод не распознан (подсказка и ручной ввод)
  tokens    рамка accent, overlay rgba(0,0,0,.5), radius lg
  a11y      подсказки голосом, вибрация при успешном скане, ручной ввод штрихкода как альтернатива
  used on   S01

TorchButton (фонарик)
  variants  off, on
  sizes     48px
  states    default, on, disabled (нет вспышки)
  tokens    bg surface / accent, icon Lucide zap
  a11y      aria-pressed, метка «Фонарик»
  used on   S01

IngredientRow (ингредиент и уровень риска)
  variants  none, low, moderate, high
  states    collapsed, expanded (пояснение своими словами)
  tokens    точка score-*, text base, text-muted для пояснения
  a11y      раскрывающийся блок, уровень риска текстом
  used on   S02

Button
  variants  primary, secondary, ghost, danger
  sizes     sm 32px, md 40px, lg 48px
  states    default, pressed, focus-visible (кольцо 2px accent), disabled, loading
  tokens    bg accent, text on-accent, radius md, font sm/600
  a11y      настоящая кнопка, видимый фокус, при загрузке подпись сохраняется
  used on   S02, S06, S07, S09

SearchInput (Premium)
  variants  default
  states    default, focus, filled, loading, empty results, error
  tokens    border border-input, radius md, font base
  a11y      метка, кнопка очистки, результаты объявляются
  used on   S07

Toggle (предпочтения)
  variants  default
  states    off, on, disabled
  tokens    track border-input / accent
  a11y      роль switch, подпись обязательна
  used on   S08

Paywall (подписка)
  variants  по умолчанию, с пробным периодом (если будет)
  states    default, purchasing, restoring, error
  a11y      цена и период текстом, кнопка «Восстановить покупки» обязательна (требование магазинов)
  used on   S09

EmptyState
  variants  history, favorites, search, no-network
  a11y      заголовок, пояснение, одно действие
  used on   S04, S05, S07

Toast
  variants  info, success, error
  states    appear, dismiss (4 секунды)
  a11y      role status, не единственный носитель ошибки
  used on   все
