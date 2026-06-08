import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

const eventAiBaseUrl = String.fromEnvironment(
  'EVENT_AI_BASE_URL',
  defaultValue: 'http://10.0.2.2:3000',
);

typedef EventAiAction = String; // fill | suggest_tags | improve_description

class EventAiResult {
  const EventAiResult({
    required this.title,
    required this.category,
    required this.location,
    required this.description,
    required this.tags,
    this.model,
  });

  final String title;
  final String category;
  final String location;
  final String description;
  final List<String> tags;
  final String? model;

  factory EventAiResult.fromJson(Map<String, dynamic> json) {
    final tagsRaw = json['tags'];
    final tags = tagsRaw is List
        ? tagsRaw.map((e) => e.toString().trim()).where((e) => e.isNotEmpty).toList()
        : <String>[];

    return EventAiResult(
      title: (json['title'] ?? '').toString(),
      category: (json['category'] ?? '').toString(),
      location: (json['location'] ?? '').toString(),
      description: (json['description'] ?? '').toString(),
      tags: tags,
      model: json['model']?.toString(),
    );
  }
}

class EventAiException implements Exception {
  EventAiException(this.message, {this.statusCode});

  final String message;
  final int? statusCode;

  @override
  String toString() => message;
}

Future<EventAiResult> callEventAi({
  required EventAiAction action,
  required String title,
  required String category,
  required String location,
  required String description,
  List<String> tags = const [],
}) async {
  final uri = Uri.parse('$eventAiBaseUrl/api/ai/event');
  final payload = jsonEncode({
    'action': action,
    'title': title,
    'category': category,
    'location': location,
    'description': description,
    'tags': tags,
  });

  if (kDebugMode) {
    debugPrint('[EventAI] POST $uri action=$action');
  }

  try {
    final response = await http
        .post(
          uri,
          headers: const {'Content-Type': 'application/json'},
          body: payload,
        )
        .timeout(const Duration(seconds: 15));

    Map<String, dynamic> body;
    try {
      body = jsonDecode(response.body) as Map<String, dynamic>;
    } catch (_) {
      throw EventAiException(
        'Gemini çağrısı başarısız: (${response.statusCode}) geçersiz yanıt',
        statusCode: response.statusCode,
      );
    }

    if (response.statusCode == 429 ||
        (body['error']?.toString().contains('kota') ?? false)) {
      throw EventAiException(
        'AI yoğun/kota. 30 sn sonra tekrar deneyin.',
        statusCode: 429,
      );
    }

    if (response.statusCode < 200 ||
        response.statusCode >= 300 ||
        body['ok'] != true) {
      final message = body['error']?.toString() ??
          'Gemini çağrısı başarısız: (${response.statusCode})';
      throw EventAiException(message, statusCode: response.statusCode);
    }

    final data = body['data'];
    if (data is! Map<String, dynamic>) {
      throw EventAiException('Sunucudan eksik AI verisi alındı.');
    }

    final result = EventAiResult.fromJson(data);
    return EventAiResult(
      title: result.title,
      category: result.category,
      location: result.location,
      description: result.description,
      tags: result.tags,
      model: body['model']?.toString(),
    );
  } on TimeoutException {
    throw EventAiException('AI yoğun/kota. 30 sn sonra tekrar deneyin.');
  } on EventAiException {
    rethrow;
  } catch (e) {
    throw EventAiException('Gemini çağrısı başarısız: $e');
  }
}
