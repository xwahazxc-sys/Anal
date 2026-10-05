import 'dart:convert';
import 'dart:math';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

/// Тонкий клиент к FastAPI. Типизированные модели добавим позже (json_serializable / openapi-generator).
class ApiClient {
  ApiClient._(this.baseUrl, this._deviceId);

  // 10.0.2.2 = localhost хоста из Android-эмулятора
  static const _defaultUrl = String.fromEnvironment('API_URL', defaultValue: 'http://10.0.2.2:8000');

  final String baseUrl;
  final String _deviceId;

  static Future<ApiClient> create() async {
    final prefs = await SharedPreferences.getInstance();
    var id = prefs.getString('device_id');
    if (id == null) {
      final r = Random.secure();
      id = List.generate(24, (_) => r.nextInt(16).toRadixString(16)).join();
      await prefs.setString('device_id', id);
    }
    return ApiClient._(_defaultUrl, id);
  }

  Map<String, String> get _headers => {'X-Device-Id': _deviceId, 'Content-Type': 'application/json'};

  Future<Map<String, dynamic>> _json(http.Response r) async {
    if (r.statusCode >= 400) throw ApiException(r.statusCode, utf8.decode(r.bodyBytes));
    return jsonDecode(utf8.decode(r.bodyBytes)) as Map<String, dynamic>;
  }

  /// Скан: карточка продукта + события геймификации.
  Future<Map<String, dynamic>> scan(String barcode, {String? replaced}) async => _json(await http.post(
        Uri.parse('$baseUrl/api/v1/scans'),
        headers: _headers,
        body: jsonEncode({'barcode': barcode, 'replaced_barcode': replaced}),
      ));

  Future<List<dynamic>> alternatives(String barcode) async {
    final r = await http.get(Uri.parse('$baseUrl/api/v1/products/$barcode/alternatives'), headers: _headers);
    if (r.statusCode >= 400) throw ApiException(r.statusCode, r.body);
    return jsonDecode(utf8.decode(r.bodyBytes)) as List<dynamic>;
  }

  Future<Map<String, dynamic>> diary() async =>
      _json(await http.get(Uri.parse('$baseUrl/api/v1/diary'), headers: _headers));

  Future<Map<String, dynamic>> addToDiary(String barcode, double grams, String meal) async => _json(await http.post(
        Uri.parse('$baseUrl/api/v1/diary'),
        headers: _headers,
        body: jsonEncode({'barcode': barcode, 'grams': grams, 'meal': meal}),
      ));

  Future<Map<String, dynamic>> gamification() async =>
      _json(await http.get(Uri.parse('$baseUrl/api/v1/me/gamification'), headers: _headers));
}

class ApiException implements Exception {
  ApiException(this.status, this.body);
  final int status;
  final String body;
  @override
  String toString() => 'ApiException($status): $body';
}
