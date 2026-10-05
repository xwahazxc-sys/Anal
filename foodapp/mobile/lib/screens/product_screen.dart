import 'package:flutter/material.dart';

import '../api/client.dart';
import '../widgets/score_badge.dart';

class ProductScreen extends StatelessWidget {
  const ProductScreen({super.key, required this.api, required this.scan});
  final ApiClient api;
  final Map<String, dynamic> scan; // ответ POST /scans: {card, events}

  @override
  Widget build(BuildContext context) {
    final card = scan['card'] as Map<String, dynamic>;
    final p = card['product'] as Map<String, dynamic>;
    final s = card['score'] as Map<String, dynamic>;
    final events = scan['events'] as Map<String, dynamic>;
    final factors = (s['factors'] as List).cast<Map<String, dynamic>>();
    final warnings = (card['allergen_warnings'] as List).cast<String>();

    return Scaffold(
      appBar: AppBar(title: Text(p['name'] as String)),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        Row(children: [
          ScoreBadge(score: s['score'] as int, grade: s['grade'] as String),
          const SizedBox(width: 16),
          Expanded(
            child: Text('${p['kcal']} ккал · Б ${p['protein']} · Ж ${p['fat']} · У ${p['carbs']} (на 100 г)'),
          ),
        ]),
        if (warnings.isNotEmpty)
          Card(color: Colors.red.shade50, child: ListTile(leading: const Icon(Icons.warning), title: Text('Ваши аллергены: ${warnings.join(', ')}'))),
        if ((events['xp_gained'] as int) > 0) Chip(label: Text('+${events['xp_gained']} XP')),
        for (final code in (events['unlocked'] as List)) Chip(label: Text('Достижение: $code')),
        const SizedBox(height: 8),
        Text('Почему такая оценка', style: Theme.of(context).textTheme.titleMedium),
        for (final f in factors)
          ListTile(
            dense: true,
            leading: Icon(
              f['impact'] == 1 ? Icons.add_circle : (f['impact'] == -1 ? Icons.remove_circle : Icons.circle_outlined),
              color: f['impact'] == 1 ? Colors.green : (f['impact'] == -1 ? Colors.red : Colors.grey),
            ),
            title: Text(f['label'] as String),
            subtitle: Text(f['value'] as String),
          ),
        const SizedBox(height: 8),
        FilledButton.icon(
          icon: const Icon(Icons.add),
          label: const Text('В дневник (100 г)'),
          onPressed: () async {
            await api.addToDiary(p['barcode'] as String, 100, 'snack');
            if (context.mounted) Navigator.pop(context);
          },
        ),
      ]),
    );
  }
}
