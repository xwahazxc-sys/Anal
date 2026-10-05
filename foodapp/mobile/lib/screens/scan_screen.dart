import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../api/client.dart';
import 'product_screen.dart';

class ScanScreen extends StatefulWidget {
  const ScanScreen({super.key, required this.api});
  final ApiClient api;

  @override
  State<ScanScreen> createState() => _ScanScreenState();
}

class _ScanScreenState extends State<ScanScreen> {
  bool _busy = false;

  Future<void> _onDetect(BarcodeCapture cap) async {
    final code = cap.barcodes.firstOrNull?.rawValue;
    if (code == null || _busy) return;
    setState(() => _busy = true);
    try {
      final res = await widget.api.scan(code);
      if (!mounted) return;
      await Navigator.push(context, MaterialPageRoute(builder: (_) => ProductScreen(api: widget.api, scan: res)));
    } on ApiException catch (e) {
      if (!mounted) return;
      final msg = e.status == 404 ? 'Продукта нет в базе. Скоро можно будет добавить его по фото.' : 'Ошибка: ${e.status}';
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Stack(children: [
        MobileScanner(onDetect: _onDetect),
        if (_busy) const Center(child: CircularProgressIndicator()),
      ]);
}
