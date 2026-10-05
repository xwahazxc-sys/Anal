import 'package:flutter/material.dart';

import '../api/client.dart';

class ProgressScreen extends StatelessWidget {
  const ProgressScreen({super.key, required this.api});
  final ApiClient api;

  @override
  Widget build(BuildContext context) => FutureBuilder<Map<String, dynamic>>(
        future: api.gamification(),
        builder: (context, snap) {
          if (!snap.hasData) return const Center(child: CircularProgressIndicator());
          final g = snap.data!;
          final ach = (g['achievements'] as List).cast<Map<String, dynamic>>();
          return ListView(padding: const EdgeInsets.all(16), children: [
            Text('Уровень ${g['level']}', style: Theme.of(context).textTheme.headlineMedium),
            Text('${g['xp']} XP · до следующего ${g['xp_to_next_level']}'),
            Text('🔥 Серия: ${g['streak']} дн. (рекорд ${g['best_streak']})'),
            Text('🪙 Монеты: ${g['coins']}'),
            const Divider(),
            for (final a in ach)
              ListTile(
                leading: Icon(a['unlocked'] as bool ? Icons.emoji_events : Icons.lock_outline,
                    color: a['unlocked'] as bool ? Colors.amber : Colors.grey),
                title: Text(a['title'] as String),
                subtitle: Text(a['description'] as String),
              ),
          ]);
        },
      );
}
