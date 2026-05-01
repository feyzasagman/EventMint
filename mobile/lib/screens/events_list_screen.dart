import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';

import 'event_detail_screen.dart';
import 'profile_screen.dart';

String pickString(Map data, List<String> keys) {
  for (final key in keys) {
    final value = data[key];
    if (value is String && value.trim().isNotEmpty) {
      return value.trim();
    }
  }
  return '';
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
  bool _orderByFailed = false;

  Stream<QuerySnapshot<Map<String, dynamic>>> get _eventsStream {
    if (_orderByFailed) {
      return FirebaseFirestore.instance.collection('events').snapshots();
    }
    return FirebaseFirestore.instance
        .collection('events')
        .orderBy('createdAt', descending: true)
        .snapshots();
  }

  @override
  Widget build(BuildContext context) {
    if (kIsWeb) {
      return Scaffold(
        appBar: AppBar(title: const Text('Etkinlikler')),
        body: const Center(
          child: Padding(
            padding: EdgeInsets.all(16),
            child: Text('Web demo modu', textAlign: TextAlign.center),
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Etkinlikler'),
        actions: [
          IconButton(
            tooltip: 'Profil',
            onPressed: () {
              Navigator.of(
                context,
              ).push(MaterialPageRoute(builder: (_) => const ProfileScreen()));
            },
            icon: const Icon(Icons.account_circle),
          ),
        ],
      ),
      body: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
        key: ValueKey<bool>(_orderByFailed),
        stream: _eventsStream,
        builder: (context, snapshot) {
          if (snapshot.hasError && !_orderByFailed) {
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (mounted) {
                setState(() => _orderByFailed = true);
              }
            });
            return const Center(child: CircularProgressIndicator());
          }

          if (snapshot.hasError) {
            return Center(child: Text('Veri alınamadı: ${snapshot.error}'));
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
              final data = docs[index].data();

              final titleRaw = pickString(data, const [
                'title',
                'Baslik',
                'başlık',
                'baslik',
              ]);
              final title = titleRaw.isEmpty ? '(Başlık yok)' : titleRaw;
              final clubIdRaw = pickString(data, const [
                'clubId',
                'Kulup',
                'kulup',
              ]);
              final clubId = clubIdRaw.isEmpty ? '-' : clubIdRaw;
              final categoryRaw = pickString(data, const [
                'category',
                'Kategori',
                'kategori',
              ]);
              final category = categoryRaw.isEmpty ? '-' : categoryRaw;
              final locationRaw = pickString(data, const [
                'location',
                'Konum',
                'konum',
              ]);
              final location = locationRaw.isEmpty ? '-' : locationRaw;
              final tags = pickStringList(data, const [
                'tags',
                'Etiketler',
                'etiketler',
              ]);

              return Card(
                child: InkWell(
                  borderRadius: BorderRadius.circular(12),
                  onTap: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => EventDetailScreen(
                          eventId: docs[index].id,
                          data: data,
                        ),
                      ),
                    );
                  },
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
                        _InfoRow(label: 'Kulüp', value: clubId),
                        _InfoRow(label: 'Kategori', value: category),
                        _InfoRow(label: 'Konum', value: location),
                        if (tags.isNotEmpty) ...[
                          const SizedBox(height: 8),
                          Text(
                            'Etiketler',
                            style: Theme.of(context).textTheme.labelLarge,
                          ),
                          const SizedBox(height: 4),
                          Wrap(
                            spacing: 6,
                            runSpacing: 4,
                            children: tags
                                .map(
                                  (t) => Chip(
                                    label: Text(t),
                                    visualDensity: VisualDensity.compact,
                                    materialTapTargetSize:
                                        MaterialTapTargetSize.shrinkWrap,
                                    padding: EdgeInsets.zero,
                                    labelPadding: const EdgeInsets.symmetric(
                                      horizontal: 8,
                                    ),
                                  ),
                                )
                                .toList(),
                          ),
                        ],
                      ],
                    ),
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

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 72,
            child: Text(
              '$label:',
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w600),
            ),
          ),
          Expanded(child: Text(value)),
        ],
      ),
    );
  }
}
