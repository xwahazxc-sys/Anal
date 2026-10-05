import 'package:flutter/material.dart';

import 'api/client.dart';
import 'screens/diary_screen.dart';
import 'screens/progress_screen.dart';
import 'screens/scan_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(FoodApp(api: await ApiClient.create()));
}

class FoodApp extends StatelessWidget {
  const FoodApp({super.key, required this.api});
  final ApiClient api;

  @override
  Widget build(BuildContext context) => MaterialApp(
        title: 'FoodApp',
        theme: ThemeData(colorSchemeSeed: const Color(0xFF2E9E4F), useMaterial3: true),
        home: HomeShell(api: api),
      );
}

class HomeShell extends StatefulWidget {
  const HomeShell({super.key, required this.api});
  final ApiClient api;

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _tab = 0;

  @override
  Widget build(BuildContext context) {
    // Новый ключ при смене вкладки, чтобы дневник и прогресс перезагружались.
    final pages = [
      ScanScreen(api: widget.api),
      DiaryScreen(key: UniqueKey(), api: widget.api),
      ProgressScreen(key: UniqueKey(), api: widget.api),
    ];
    return Scaffold(
      body: SafeArea(child: pages[_tab]),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tab,
        onDestinationSelected: (i) => setState(() => _tab = i),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.qr_code_scanner), label: 'Скан'),
          NavigationDestination(icon: Icon(Icons.restaurant_menu), label: 'Дневник'),
          NavigationDestination(icon: Icon(Icons.emoji_events), label: 'Прогресс'),
        ],
      ),
    );
  }
}
