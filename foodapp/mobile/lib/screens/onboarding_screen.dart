import 'package:flutter/material.dart';

import '../api/client.dart';

/// Пять шагов: приветствие, цель, параметры, аллергены, норма + согласие (152-ФЗ).
class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key, required this.api, required this.onDone});
  final ApiClient api;
  final VoidCallback onDone;

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  static const _steps = 5;
  static const _activity = {
    'sedentary': 'Сидячая работа, почти нет тренировок',
    'light': '1–3 тренировки в неделю',
    'moderate': '3–5 тренировок в неделю',
    'high': 'Ежедневные нагрузки',
  };
  static const _goals = {
    'lose': ('Снизить вес', 'Небольшой дефицит калорий, больше белка'),
    'maintain': ('Держать вес', 'Калории по расходу энергии'),
    'gain': ('Набрать массу', 'Небольшой профицит, больше белка'),
  };
  static const _allergens = {
    'milk': 'Молоко', 'gluten': 'Глютен', 'eggs': 'Яйца', 'nuts': 'Орехи', 'soy': 'Соя', 'fish': 'Рыба',
  };
  static const _minKcal = {'f': 1200, 'm': 1500};

  int _step = 0;
  String _goal = 'maintain';
  String _sex = 'm';
  String _activityKey = 'moderate';
  final _birth = TextEditingController(text: '1995');
  final _height = TextEditingController(text: '175');
  final _weight = TextEditingController(text: '70');
  final _picked = <String>{};
  bool _consent = false;
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _birth.dispose();
    _height.dispose();
    _weight.dispose();
    super.dispose();
  }

  /// Тот же расчёт, что на сервере (Миффлин-Сан Жеор), чтобы показать норму до отправки.
  ({int kcal, int protein, int fat, int carbs, bool floored}) _targets() {
    const act = {'sedentary': 1.2, 'light': 1.375, 'moderate': 1.55, 'high': 1.725};
    const adj = {'lose': 0.85, 'maintain': 1.0, 'gain': 1.10};
    const ppk = {'lose': 1.8, 'maintain': 1.4, 'gain': 1.8};
    final w = double.parse(_weight.text), h = double.parse(_height.text);
    final age = (DateTime.now().year - int.parse(_birth.text)).clamp(14, 120);
    final bmr = 10 * w + 6.25 * h - 5 * age + (_sex == 'm' ? 5 : -161);
    final raw = bmr * act[_activityKey]! * adj[_goal]!;
    final kcal = raw < _minKcal[_sex]! ? _minKcal[_sex]!.toDouble() : raw;
    final protein = ppk[_goal]! * w;
    final fat = 0.28 * kcal / 9;
    final carbs = ((kcal - protein * 4 - fat * 9) / 4).clamp(0, double.infinity);
    return (kcal: kcal.round(), protein: protein.round(), fat: fat.round(), carbs: carbs.round(), floored: raw < _minKcal[_sex]!);
  }

  String? _validateBody() {
    final b = int.tryParse(_birth.text), h = double.tryParse(_height.text), w = double.tryParse(_weight.text);
    if (b == null || b < 1940 || b > 2012) return 'Год рождения от 1940 до 2012.';
    if (h == null || h < 120 || h > 230) return 'Рост от 120 до 230 см.';
    if (w == null || w < 35 || w > 250) return 'Вес от 35 до 250 кг.';
    return null;
  }

  void _next() {
    if (_step == 2) {
      final e = _validateBody();
      if (e != null) {
        setState(() => _error = e);
        return;
      }
    }
    setState(() {
      _error = null;
      _step++;
    });
  }

  Future<void> _finish() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await widget.api.saveProfile({
        'sex': _sex,
        'birth_year': int.parse(_birth.text),
        'height_cm': double.parse(_height.text),
        'weight_kg': double.parse(_weight.text),
        'activity': _activityKey,
        'goal': _goal,
        'allergens': _picked.toList(),
        'consent_health_data': _consent,
      });
      widget.onDone();
    } on ApiException catch (e) {
      setState(() => _error = 'Не удалось сохранить (${e.status}). Попробуйте ещё раз.');
    } catch (_) {
      setState(() => _error = 'Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(children: [
              for (var i = 0; i < _steps; i++)
                Expanded(
                  child: Container(
                    height: 4,
                    margin: EdgeInsets.only(right: i == _steps - 1 ? 0 : 6),
                    decoration: BoxDecoration(
                      color: i <= _step ? theme.colorScheme.primary : theme.colorScheme.surfaceContainerHighest,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
            ]),
            const SizedBox(height: 20),
            Expanded(child: SingleChildScrollView(child: _body(theme))),
            if (_error != null) Padding(padding: const EdgeInsets.only(bottom: 8), child: Text(_error!, style: TextStyle(color: theme.colorScheme.error))),
            _buttons(),
          ]),
        ),
      ),
    );
  }

  Widget _body(ThemeData theme) {
    switch (_step) {
      case 0:
        return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('ЧестноЕшь', style: theme.textTheme.titleMedium),
          const SizedBox(height: 12),
          Text('Узнайте, что на самом деле в вашей еде', style: theme.textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.bold)),
          const SizedBox(height: 20),
          const _Point('1', 'Наведите камеру на штрихкод', 'Оценка от 0 до 100 и объяснение по каждой добавке.'),
          const _Point('2', 'Ведите дневник КБЖУ', 'Норма считается под ваш вес, активность и цель.'),
          const _Point('3', 'Получайте награды за привычку', 'Серии, уровни и достижения за осознанный выбор.'),
          const SizedBox(height: 12),
          Text('Мы не берём деньги у производителей. Оценка зависит только от состава, а методика открыта.', style: theme.textTheme.bodyMedium?.copyWith(color: theme.hintColor)),
        ]);
      case 1:
        return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Какая у вас цель?', style: theme.textTheme.headlineSmall),
          const SizedBox(height: 4),
          Text('От цели зависит суточная норма калорий и белка.', style: TextStyle(color: theme.hintColor)),
          const SizedBox(height: 16),
          for (final e in _goals.entries)
            Card(
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
                side: BorderSide(color: _goal == e.key ? theme.colorScheme.primary : theme.dividerColor, width: 2),
              ),
              child: ListTile(
                title: Text(e.value.$1, style: const TextStyle(fontWeight: FontWeight.w600)),
                subtitle: Text(e.value.$2),
                onTap: () => setState(() => _goal = e.key),
              ),
            ),
        ]);
      case 2:
        return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Немного о вас', style: theme.textTheme.headlineSmall),
          const SizedBox(height: 4),
          Text('Нужно только для расчёта нормы. Данные о здоровье мы храним с вашего согласия.', style: TextStyle(color: theme.hintColor)),
          const SizedBox(height: 16),
          SegmentedButton<String>(
            segments: const [ButtonSegment(value: 'm', label: Text('Мужской')), ButtonSegment(value: 'f', label: Text('Женский'))],
            selected: {_sex},
            onSelectionChanged: (s) => setState(() => _sex = s.first),
          ),
          const SizedBox(height: 12),
          _num(_birth, 'Год рождения'),
          const SizedBox(height: 12),
          _num(_height, 'Рост, см'),
          const SizedBox(height: 12),
          _num(_weight, 'Вес, кг'),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            value: _activityKey,
            isExpanded: true,
            decoration: const InputDecoration(labelText: 'Активность', border: OutlineInputBorder()),
            items: [for (final e in _activity.entries) DropdownMenuItem(value: e.key, child: Text(e.value, overflow: TextOverflow.ellipsis))],
            onChanged: (v) => setState(() => _activityKey = v ?? _activityKey),
          ),
        ]);
      case 3:
        return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Есть аллергии или непереносимость?', style: theme.textTheme.headlineSmall),
          const SizedBox(height: 4),
          Text('Если такой ингредиент попадётся в составе, покажем предупреждение на карточке.', style: TextStyle(color: theme.hintColor)),
          const SizedBox(height: 16),
          Wrap(spacing: 8, runSpacing: 8, children: [
            for (final e in _allergens.entries)
              FilterChip(
                label: Text(e.value),
                selected: _picked.contains(e.key),
                onSelected: (v) => setState(() => v ? _picked.add(e.key) : _picked.remove(e.key)),
              ),
          ]),
        ]);
      default:
        final t = _targets();
        return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Ваша норма на день', style: theme.textTheme.headlineSmall),
          const SizedBox(height: 16),
          Row(children: [
            _Kpi('${t.kcal}', 'ккал'),
            _Kpi('${t.protein}', 'белки, г'),
            _Kpi('${t.fat}', 'жиры, г'),
            _Kpi('${t.carbs}', 'углеводы, г'),
          ]),
          const SizedBox(height: 12),
          if (t.floored)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Text('Расчёт вышел ниже безопасного минимума, поэтому норма поднята до ${_minKcal[_sex]} ккал. Ниже приложение цель не ставит.'),
            ),
          Text('Формула Миффлина — Сан Жеора. Это ориентир, а не медицинская рекомендация.', style: TextStyle(color: theme.hintColor, fontSize: 13)),
          const SizedBox(height: 16),
          CheckboxListTile(
            contentPadding: EdgeInsets.zero,
            controlAffinity: ListTileControlAffinity.leading,
            value: _consent,
            onChanged: (v) => setState(() => _consent = v ?? false),
            title: const Text(
              'Согласен на обработку данных о моём здоровье (рост, вес, цель), чтобы приложение считало норму. '
              'Данные хранятся на серверах в России, согласие можно отозвать в настройках.',
              style: TextStyle(fontSize: 14),
            ),
          ),
        ]);
    }
  }

  Widget _num(TextEditingController c, String label) => TextField(
        controller: c,
        keyboardType: TextInputType.number,
        decoration: InputDecoration(labelText: label, border: const OutlineInputBorder()),
      );

  Widget _buttons() {
    final last = _step == _steps - 1;
    return Row(children: [
      if (_step > 0) ...[
        OutlinedButton(onPressed: _saving ? null : () => setState(() => _step--), child: const Text('Назад')),
        const SizedBox(width: 12),
      ],
      Expanded(
        child: FilledButton(
          onPressed: _saving || (last && !_consent) ? null : (last ? _finish : _next),
          child: _saving
              ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
              : Text(last ? 'Готово, к сканеру' : (_step == 0 ? 'Начать' : 'Дальше')),
        ),
      ),
    ]);
  }
}

class _Point extends StatelessWidget {
  const _Point(this.n, this.title, this.text);
  final String n, title, text;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 14),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          CircleAvatar(radius: 14, child: Text(n, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold))),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
            Text(text, style: TextStyle(color: Theme.of(context).hintColor)),
          ])),
        ]),
      );
}

class _Kpi extends StatelessWidget {
  const _Kpi(this.value, this.label);
  final String value, label;

  @override
  Widget build(BuildContext context) => Expanded(
        child: Container(
          margin: const EdgeInsets.symmetric(horizontal: 3),
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(color: Theme.of(context).colorScheme.surfaceContainerHighest, borderRadius: BorderRadius.circular(10)),
          child: Column(children: [
            Text(value, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            Text(label, style: const TextStyle(fontSize: 11), textAlign: TextAlign.center),
          ]),
        ),
      );
}
