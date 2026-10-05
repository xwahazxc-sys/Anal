from app.services.nutrition import calc_targets


def test_targets_reasonable():
    t = calc_targets("m", 1990, 180, 80, "moderate", "maintain")
    assert 2400 < t.kcal < 3100
    assert abs(t.protein * 4 + t.fat * 9 + t.carbs * 4 - t.kcal) < 15


def test_min_kcal_floor():
    t = calc_targets("f", 1950, 150, 45, "sedentary", "lose")
    assert t.kcal >= 1200
