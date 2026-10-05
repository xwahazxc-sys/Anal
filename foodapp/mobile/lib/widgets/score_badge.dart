import 'package:flutter/material.dart';

Color gradeColor(String grade) => switch (grade) {
      'excellent' => const Color(0xFF2E9E4F),
      'good' => const Color(0xFF8BC34A),
      'mediocre' => const Color(0xFFF59E0B),
      _ => const Color(0xFFE5484D),
    };

const gradeLabel = {'excellent': 'Отлично', 'good': 'Хорошо', 'mediocre': 'Посредственно', 'bad': 'Плохо'};

class ScoreBadge extends StatelessWidget {
  const ScoreBadge({super.key, required this.score, required this.grade});
  final int score;
  final String grade;

  @override
  Widget build(BuildContext context) {
    final c = gradeColor(grade);
    return Column(mainAxisSize: MainAxisSize.min, children: [
      Container(
        width: 84,
        height: 84,
        alignment: Alignment.center,
        decoration: BoxDecoration(shape: BoxShape.circle, color: c),
        child: Text('$score', style: const TextStyle(color: Colors.white, fontSize: 32, fontWeight: FontWeight.bold)),
      ),
      const SizedBox(height: 4),
      Text(gradeLabel[grade] ?? '', style: TextStyle(color: c, fontWeight: FontWeight.w600)),
    ]);
  }
}
