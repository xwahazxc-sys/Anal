import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'api/client.dart';
import 'screens/diary_screen.dart';
import 'screens/onboarding_screen.dart';
import 'screens/progress_screen.dart';
import 'screens/scan_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final prefs = await SharedPreferences.getInstance();
  runApp(FoodApp(api: await ApiClient.create(), onboarded: prefs.getBool('onboarded') ?? false));
}

class FoodApp extends StatefulWidget {
  const FoodApp({super.key, required this.api, required this.onboarded});
  final ApiClient api;
  final bool onboarded;

  @override
  State<FoodApp> createState() => _FoodAppState();
}

class _FoodAppState extends State<FoodApp> {
  late bool _onboarded = widget.onboarded;

  Future<void> _finishOnboarding() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('onboarded', true);
    if (mounted) setState(() => _onboarded = true);
  }

  @override
  Widget build(BuildContext context) => MaterialApp(
        title: 'FoodApp',
        theme: ThemeData(colorSchemeSeed: const Color(0xFF2E9E4F), useMaterial3: true),
        home: _onboarded
            ? HomeShell(api: widget.api)
            : OnboardingScreen(api: widget.api, onDone: _finishOnboarding),
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
