# FoodApp: каркас

Сканер состава продуктов (оценка 0-100) + дневник КБЖУ + геймификация. Для РФ.

```
foodapp/
├── backend/            FastAPI + SQLAlchemy 2 (SQLite локально, PostgreSQL в проде)
│   ├── app/
│   │   ├── main.py, config.py, db.py, models.py, schemas.py, deps.py
│   │   ├── routers/    products, profile, diary, gamification
│   │   ├── services/   scoring (оценка), nutrition (КБЖУ), gamification (XP/серии/ачивки), products
│   │   └── data/       additives.json (ЧЕРНОВИК, нужна экспертная проверка), demo_products.json
│   └── tests/          pytest (оценка, КБЖУ, API)
├── mobile/             Flutter-клиент (сканер, карточка, дневник, прогресс)
└── docker-compose.yml  API + PostgreSQL
```

## Запуск бэкенда
```bash
cd foodapp/backend
pip install -r requirements.txt
python -m app.seed                 # демо-продукты
uvicorn app.main:app --reload      # http://localhost:8000/docs
pytest
```
Заголовок `X-Device-Id` (≥8 символов) заменяет авторизацию на этапе MVP.

## Запуск клиента
```bash
cd foodapp/mobile
flutter create . --platforms=android,ios   # один раз: сгенерировать нативные папки
flutter pub get
flutter run --dart-define=API_URL=http://10.0.2.2:8000
```
Android: в `android/app/src/main/AndroidManifest.xml` нужны `<uses-permission android:name="android.permission.CAMERA"/>` и `INTERNET`.

## Методика оценки
`backend/app/services/scoring.py`: 55% нутриенты + 30% добавки + 15% переработка (NOVA);
добавка высокого риска ограничивает итог 49 баллами. Напитки оцениваются по более строгой шкале.

## Ограничения текущей версии
- Список добавок и уровни риска: черновик, до релиза нужна проверка специалистом и ссылки на источники.
- Flutter-код написан без запуска (в среде сборки нет Flutter SDK): возможны мелкие правки.
- Нет: онбординга, ручного добавления продукта по фото, квестов, друзей и лиг, миграций (Alembic), реальной авторизации.
- До публичного релиза: 152-ФЗ (хранение данных в РФ, согласие на данные о здоровье, политика), модерация краудсорса.
