import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';

String pickString(Map data, List<String> keys, {String fallback = ''}) {
  for (final key in keys) {
    final value = data[key];
    if (value is String && value.trim().isNotEmpty) {
      return value.trim();
    }
  }
  return fallback;
}

List<String> pickStringList(Map data, List<String> keys) {
  for (final key in keys) {
    final value = data[key];
    if (value is List) {
      return value
          .map((item) => item.toString())
          .where((s) => s.isNotEmpty)
          .toList();
    }
    if (value is String && value.trim().isNotEmpty) {
      return value
          .split(',')
          .map((item) => item.trim())
          .where((item) => item.isNotEmpty)
          .toList();
    }
  }
  return [];
}

class EventsListScreen extends StatefulWidget {
  const EventsListScreen({super.key});

  @override
  State<EventsListScreen> createState() => _EventsListScreenState();
}

class _EventsListScreenState extends State<EventsListScreen> {
  @override
  Widget build(BuildContext context) {
    if (kIsWeb) {
      return Scaffold(
        appBar: AppBar(title: const Text('Etkinlikler')),
        body: const Center(
          child: Padding(
            padding: EdgeInsets.all(16),
            child: Text(
              'Web demo modu (Android\'de calistir)',
              textAlign: TextAlign.center,
            ),
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Etkinlikler')),
      body: StreamBuilder<QuerySnapshot>(
        stream: FirebaseFirestore.instance.collection('events').snapshots(),
        builder: (context, snapshot) {
          if (snapshot.hasError) {
            return Center(child: Text('Veri alinamadi: ${snapshot.error}'));
          }

          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }

          final docs = snapshot.data?.docs ?? [];
          if (docs.isEmpty) {
            return const Center(child: Text('events koleksiyonunda veri yok.'));
          }

          return ListView.separated(
            itemCount: docs.length,
            separatorBuilder: (context, index) => const SizedBox(height: 8),
            padding: const EdgeInsets.all(12),
            itemBuilder: (context, index) {
              final raw = docs[index].data();
              final data = raw is Map ? raw : <String, dynamic>{};

              final title = pickString(data, const [
                'title',
                'Baslik',
                'başlık',
                'baslik',
              ], fallback: '(Baslik yok)');
              final location = pickString(data, const [
                'location',
                'Konum',
              ], fallback: '-');
              final category = pickString(data, const [
                'category',
                'Kategori',
              ], fallback: '-');
              final clubId = pickString(data, const [
                'clubId',
                'Kulup',
                'kulup',
              ], fallback: '-');
              final tags = pickStringList(data, const ['tags', 'Etiketler']);

              return Card(
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 8),
                      Text('location: $location'),
                      Text('category: $category'),
                      Text('clubId: $clubId'),
                      if (tags.isNotEmpty) Text('tags: ${tags.join(', ')}'),
                    ],
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }
}
