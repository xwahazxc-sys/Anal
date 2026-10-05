PROFILE = dict(sex="m", birth_year=1995, height_cm=180, weight_kg=80, activity="moderate", goal="maintain",
               allergens=["milk"], consent_health_data=True)


def test_health(client):
    assert client.get("/health").json() == {"status": "ok"}


def test_product_card_and_allergen_warning(client):
    client.put("/api/v1/me/profile", json=PROFILE)
    r = client.get("/api/v1/products/4600000000042")
    assert r.status_code == 200
    assert r.json()["allergen_warnings"] == ["milk"]


def test_missing_product_404(client):
    assert client.get("/api/v1/products/4609999999999").status_code == 404


def test_profile_requires_consent(client):
    assert client.put("/api/v1/me/profile", json={**PROFILE, "consent_health_data": False}).status_code == 422


def test_alternatives_only_better_same_category(client):
    # газировка: единственный в категории drink, альтернатив нет; каша vs гречка
    alts = client.get("/api/v1/products/4600000000011/alternatives").json()
    assert all(a["score"] > 0 for a in alts)


def test_scan_awards_xp_and_achievements(client):
    r = client.post("/api/v1/scans", json={"barcode": "4600000000028"}).json()
    assert r["events"]["xp_gained"] == 5
    assert "first_scan" in r["events"]["unlocked"]
    assert "red_flag" in r["events"]["unlocked"] or r["card"]["score"]["score"] >= 25
    state = client.get("/api/v1/me/gamification").json()
    assert state["streak"] == 1 and state["xp"] >= 5


def test_better_choice(client):
    r = client.post("/api/v1/scans", json={"barcode": "4600000000011", "replaced_barcode": "4600000000028"}).json()
    assert "better_choice" in r["events"]["unlocked"]


def test_diary_totals_and_daily_goal_once(client):
    client.put("/api/v1/me/profile", json=PROFILE)
    target = client.get("/api/v1/me").json()["targets"]["kcal"]
    grams = target / 3.52 * 0.95 * 1  # овсянка 352 ккал/100 г, ~95% нормы
    r1 = client.post("/api/v1/diary", json={"barcode": "4600000000011", "grams": grams, "meal": "lunch"})
    assert r1.status_code == 201
    assert r1.json()["events"]["xp_gained"] == 10 + 30  # запись + норма
    r2 = client.post("/api/v1/diary", json={"barcode": "4600000000011", "grams": 1, "meal": "snack"})
    assert r2.json()["events"]["xp_gained"] == 10  # норма не начисляется повторно
    day = client.get("/api/v1/diary").json()
    assert len(day["entries"]) == 2 and day["totals"]["kcal"] > 0


def test_no_goal_xp_for_undereating(client):
    client.put("/api/v1/me/profile", json=PROFILE)
    r = client.post("/api/v1/diary", json={"name": "Чай", "kcal_100": 1, "grams": 200, "meal": "snack"})
    assert r.json()["events"]["xp_gained"] == 10


def test_crowd_product(client):
    body = dict(barcode="4601234567890", name="Тест", kcal=100, protein=1, fat=1, carbs=20)
    assert client.post("/api/v1/products", json=body).status_code == 201
    assert client.post("/api/v1/products", json=body).status_code == 409
    assert client.get("/api/v1/products/4601234567890").json()["product"]["verified"] is False
