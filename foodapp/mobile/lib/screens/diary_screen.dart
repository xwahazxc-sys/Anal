import 'package:flutter/material.dart';

import '../api/client.dart';

class DiaryScreen extends StatelessWidget {
  const DiaryScreen({super.key, required this.api});
  final ApiClient api;

  @override
  Widget build(BuildContext context) => FutureBuilder<Map<String, dynamic>>(
        future: api.diary(),
        builder: (context, snap) {
          if (!snap.hasData) return const Center(child: CircularProgressIndicator());
          final d = snap.data!;
          final t = d['totals'] as Map<String, dynamic>;
          final target = d['targets'] as Map<String, dynamic>;
          final entries = (d['entries'] as List).cast<Map<String, dynamic>>();
          final goal = (target['kcal'] as num?) ?? 0;
          return ListView(padding: const EdgeInsets.all(16), children: [
            Text('${(t['kcal'] as num).round()} / ${goal.round()} ккал', style: Theme.of(context).textTheme.headlineSmall),
            if (goal > 0) LinearProgressIndicator(value: ((t['kcal'] as num) / goal).clamp(0, 1).toDouble()),
            Text('Б ${t['protein']} · Ж ${t['fat']} · У ${t['carbs']}'),
            const Divider(),
            for (final e in entries)
              ListTile(title: Text(e['name'] as String), subtitle: Text('${e['grams']} г'), trailing: Text('${e['kcal']} ккал')),
          ]);
        },
      );
}
