import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';

import '../services/club_repo.dart';
import '../widgets/club_logo_avatar.dart';
import 'club_detail_screen.dart';

String _firestoreErrorText(Object? error) {
  if (error is FirebaseException) {
    return error.message ?? error.code;
  }
  return error?.toString() ?? 'Bilinmeyen hata';
}

void _logFirestoreError(Object error, [StackTrace? stackTrace]) {
  debugPrint('FIRESTORE ERROR: $error');
  if (stackTrace != null) {
    debugPrint('$stackTrace');
  }
}

class ClubsListScreen extends StatelessWidget {
  const ClubsListScreen({super.key, this.showScaffold = true});

  final bool showScaffold;

  @override
  Widget build(BuildContext context) {
    final body = StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      stream: ClubRepo.listClubs(),
      builder: (context, snapshot) {
        if (snapshot.hasError) {
          _logFirestoreError(snapshot.error!);
          return Center(
            child: Text(
              'Kulüpler alınamadı: ${_firestoreErrorText(snapshot.error)}',
            ),
          );
        }

        if (!snapshot.hasData) {
          return const Center(child: CircularProgressIndicator());
        }

        final docs = snapshot.data!.docs.toList()
          ..sort((a, b) {
            final aName = _clubTitle(a.data(), a.id).toLowerCase();
            final bName = _clubTitle(b.data(), b.id).toLowerCase();
            return aName.compareTo(bName);
          });

        if (docs.isEmpty) {
          return const Center(child: Text('Henüz kulüp yok.'));
        }

        return ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: docs.length,
          separatorBuilder: (context, index) => const SizedBox(height: 12),
          itemBuilder: (context, index) {
            final doc = docs[index];
            final data = doc.data();
            final title = _clubTitle(data, doc.id);
            final description = _asString(data['bio'] ?? data['aciklama']);
            final tags = _pickTags(data);
            final logoKey = _asString(data['logoKey'] ?? data['logo_key']);

            return Card(
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(18),
                side: BorderSide(
                  color: Theme.of(context).colorScheme.outlineVariant,
                ),
              ),
              child: InkWell(
                borderRadius: BorderRadius.circular(18),
                onTap: () {
                  Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (_) => ClubDetailScreen(clubId: doc.id),
                    ),
                  );
                },
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          ClubLogoAvatar(
                            name: title,
                            logoKey: logoKey.isEmpty ? null : logoKey,
                            size: 56,
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    title,
                                    style: Theme.of(context)
                                        .textTheme
                                        .titleMedium
                                        ?.copyWith(fontWeight: FontWeight.bold),
                                  ),
                                ),
                                const Icon(Icons.chevron_right),
                              ],
                            ),
                          ),
                        ],
                      ),
                      if (description.isNotEmpty) ...[
                        const SizedBox(height: 8),
                        Text(
                          description,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.bodyMedium,
                        ),
                      ],
                      if (tags.isNotEmpty) ...[
                        const SizedBox(height: 12),
                        Wrap(
                          spacing: 6,
                          runSpacing: 6,
                          children: tags
                              .take(4)
                              .map(
                                (tag) => Chip(
                                  label: Text(tag),
                                  visualDensity: VisualDensity.compact,
                                  materialTapTargetSize:
                                      MaterialTapTargetSize.shrinkWrap,
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
    );

    if (!showScaffold) return body;
    return Scaffold(
      appBar: AppBar(title: const Text('Kulüpler')),
      body: body,
    );
  }
}

String _clubTitle(Map<String, dynamic> data, String fallback) {
  final title = _asString(data['name'] ?? data['title']);
  return title.isEmpty ? fallback : title;
}

String _asString(Object? value) => value?.toString().trim() ?? '';

List<String> _pickTags(Map<String, dynamic> data) {
  final value = data['tags'] ?? data['etiketler'];
  if (value is List) {
    return value
        .map((tag) => tag.toString().trim())
        .where((tag) => tag.isNotEmpty)
        .toList();
  }
  if (value is String) {
    return value
        .split(',')
        .map((tag) => tag.trim())
        .where((tag) => tag.isNotEmpty)
        .toList();
  }
  return <String>[];
}
