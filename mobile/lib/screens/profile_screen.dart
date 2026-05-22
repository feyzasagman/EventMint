import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

final Map<String, String> _eventTitleCache = <String, String>{};

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key, this.showScaffold = true});

  final bool showScaffold;

  @override
  Widget build(BuildContext context) {
    final user = FirebaseAuth.instance.currentUser;
    final uid = user?.uid;

    if (uid == null) {
      const body = Center(child: Text('Kullanıcı oturumu bulunamadı.'));
      return showScaffold ? const Scaffold(body: body) : body;
    }

    final userRef = FirebaseFirestore.instance
        .collection('Kullanıcılar')
        .doc(uid);

    final body = StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
        stream: userRef.snapshots(),
        builder: (context, snapshot) {
          if (snapshot.hasError) {
            return Center(child: Text('Profil alınamadı: ${snapshot.error}'));
          }

          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }

          final userDoc = snapshot.data;
          if (userDoc == null || !userDoc.exists) {
            return const Center(child: Text('Profil verisi bulunamadı'));
          }

          final data = userDoc.data() ?? <String, dynamic>{};
          final email = _asString(data['e-posta'] ?? data['email'] ?? '');
          final role = _asString(data['Rol'] ?? data['role'] ?? '');
          final points = _asNumber(
            data['Toplam puanlar'] ?? data['pointsTotal'] ?? 0,
          );
          final badges = _parseBadges(_pickBadgeList(data));

          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              _InfoTile(label: 'E-posta', value: email.isEmpty ? '-' : email),
              _InfoTile(label: 'Rol', value: role.isEmpty ? '-' : role),
              _InfoTile(label: 'Toplam puanlar', value: points.toString()),
              const SizedBox(height: 16),
              Text('Rozetler', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 8),
              if (badges.isEmpty)
                const Text('Henüz rozet yok.')
              else
                ...badges.map((badge) => _BadgeCard(badge: badge)),
              const SizedBox(height: 24),
              const Text(
                "Katılım Geçmişi",
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              StreamBuilder<QuerySnapshot>(
                stream: FirebaseFirestore.instance
                    .collection("Check-in")
                    .where("UID", isEqualTo: FirebaseAuth.instance.currentUser!.uid)
                    .snapshots(),
                builder: (context, snapshot) {
                  if (snapshot.hasError) {
                    return Text("Hata: ${snapshot.error}");
                  }
                  if (!snapshot.hasData) {
                    return const Text("Yükleniyor...");
                  }
                  final docs = snapshot.data!.docs;
                  if (docs.isEmpty) {
                    return const Text("Henüz check-in yok.");
                  }
                  return Column(
                    children: docs.map((d) {
                      final data = d.data() as Map<String, dynamic>;
                      final eventId = (data["eventId"] ?? "").toString();
                      return _CheckinCard(
                        eventId: eventId,
                        checkinAt: data["checkinAt"],
                      );
                    }).toList(),
                  );
                },
              ),
              const SizedBox(height: 24),
              const Text(
                "RSVP’lerim",
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              FutureBuilder<List<QueryDocumentSnapshot<Map<String, dynamic>>>>(
                future: _loadRsvpDocs(uid),
                builder: (context, snapshot) {
                  if (snapshot.hasError) {
                    return Text("Hata: ${snapshot.error}");
                  }
                  if (!snapshot.hasData) {
                    return const Text("Yükleniyor...");
                  }

                  final docs = snapshot.data!;
                  if (docs.isEmpty) {
                    return const Text("Henüz RSVP yok.");
                  }

                  return Column(
                    children: docs.map((d) {
                      final data = d.data();
                      return _RsvpCard(
                        eventId: _pickRsvpEventId(data, d.id, uid),
                        createdAt: data["createdAt"],
                      );
                    }).toList(),
                  );
                },
              ),
              const SizedBox(height: 24),
              FilledButton.icon(
                onPressed: () async {
                  await FirebaseAuth.instance.signOut();
                  if (context.mounted) {
                    Navigator.of(context).popUntil((route) => route.isFirst);
                  }
                },
                icon: const Icon(Icons.logout),
                label: const Text('Çıkış Yap'),
              ),
            ],
          );
        },
    );
    if (!showScaffold) return body;
    return Scaffold(
      appBar: AppBar(title: const Text('Profil')),
      body: body,
    );
  }
}

String _asString(Object? value) {
  if (value == null) return '';
  return value.toString().trim();
}

num _asNumber(Object? value) {
  if (value is num) return value;
  if (value is String) {
    return num.tryParse(value) ?? 0;
  }
  return 0;
}

List<Map<String, dynamic>> _parseBadges(Object? value) {
  if (value is! List) return <Map<String, dynamic>>[];

  final badges = <Map<String, dynamic>>[];
  final seenIds = <String>{};
  for (final item in value) {
    if (item is Map) {
      final id = item['id']?.toString() ?? '-';
      if (!seenIds.add(id)) {
        continue;
      }
      badges.add({
        'id': id,
        'earnedAt': item['earnedAt'] ?? item['earned_at'],
      });
    }
  }
  return badges;
}

Object? _pickBadgeList(Map<String, dynamic> data) {
  return data['Rozetler'] ??
      data['rozetler'] ??
      data['badges'] ??
      data['Badges'] ??
      [];
}

String _formatEarnedAt(Object? value) {
  if (value is Timestamp) {
    final date = value.toDate();
    final day = date.day.toString().padLeft(2, '0');
    final month = date.month.toString().padLeft(2, '0');
    final hour = date.hour.toString().padLeft(2, '0');
    final minute = date.minute.toString().padLeft(2, '0');
    return '$day.$month.${date.year} $hour:$minute';
  }
  return '-';
}

String _formatCheckinAt(Object? value) {
  if (value is Timestamp) {
    return value.toDate().toString();
  }
  return value?.toString() ?? "";
}

String _pickEventTitle(Map<String, dynamic>? data, String eventId) {
  if (data == null) return eventId;

  final title = _asString(data['title']);
  if (title.isNotEmpty) return title;

  final turkishTitle = _asString(
    data['Baslik'] ?? data['başlık'] ?? data['baslik'],
  );
  if (turkishTitle.isNotEmpty) return turkishTitle;

  final capitalizedTurkishTitle = _asString(data['Başlık']);
  if (capitalizedTurkishTitle.isNotEmpty) {
    return capitalizedTurkishTitle;
  }

  return eventId;
}

String _resolveEventTitle(
  DocumentSnapshot<Map<String, dynamic>>? snapshot,
  String cacheKey,
  String fallbackTitle,
) {
  final cachedTitle = _eventTitleCache[cacheKey];
  if (cachedTitle != null) return cachedTitle;

  final title = _pickEventTitle(snapshot?.data(), fallbackTitle);
  _eventTitleCache[cacheKey] = title;
  return title;
}

String? _cachedEventTitle(String eventId) {
  if (eventId.isEmpty) return null;
  return _eventTitleCache[eventId];
}

Future<DocumentSnapshot<Map<String, dynamic>>>? _eventFuture(String eventId) {
  if (eventId.isEmpty || _eventTitleCache.containsKey(eventId)) return null;
  return FirebaseFirestore.instance.collection('Etkinlikler').doc(eventId).get();
}

Future<List<QueryDocumentSnapshot<Map<String, dynamic>>>> _loadRsvpDocs(
  String uid,
) async {
  final rsvpCollection =
      FirebaseFirestore.instance.collection("RSVP'ler");
  final uidSnapshot = await rsvpCollection.where("UID", isEqualTo: uid).get();
  if (uidSnapshot.docs.isNotEmpty) {
    return uidSnapshot.docs;
  }

  final lowercaseUidSnapshot =
      await rsvpCollection.where("uid", isEqualTo: uid).get();
  return lowercaseUidSnapshot.docs;
}

String _pickRsvpEventId(Map<String, dynamic> data, String docId, String uid) {
  final eventId = _asString(
    data['eventId'] ??
        data['EtkinlikId'] ??
        data['EtkinlikID'] ??
        data['etkinlikId'] ??
        data['etkinlikID'],
  );
  if (eventId.isNotEmpty) return eventId;

  for (final separator in <String>['_', '|', ':']) {
    final parts = docId
        .split(separator)
        .map((part) => part.trim())
        .where((part) => part.isNotEmpty && part != uid);
    if (parts.isNotEmpty) return parts.first;
  }

  return docId;
}

class _InfoTile extends StatelessWidget {
  const _InfoTile({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      title: Text(label),
      subtitle: Text(value),
    );
  }
}

class _CheckinCard extends StatelessWidget {
  const _CheckinCard({required this.eventId, required this.checkinAt});

  final String eventId;
  final Object? checkinAt;

  @override
  Widget build(BuildContext context) {
    final fallbackTitle = eventId.isEmpty ? '-' : eventId;
    final timeText = _formatCheckinAt(checkinAt);

    return FutureBuilder<DocumentSnapshot<Map<String, dynamic>>>(
      future: _eventFuture(eventId),
      initialData: null,
      builder: (context, snapshot) {
        final eventTitle = eventId.isEmpty
            ? fallbackTitle
            : _cachedEventTitle(eventId) ??
                (snapshot.connectionState == ConnectionState.done
                    ? _resolveEventTitle(snapshot.data, eventId, fallbackTitle)
                    : fallbackTitle);

        return Container(
          width: double.infinity,
          margin: const EdgeInsets.only(bottom: 8),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            border: Border.all(color: const Color(0x22000000)),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                eventTitle,
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 4),
              Text(
                timeText,
                style: const TextStyle(color: Color(0x99000000)),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _RsvpCard extends StatelessWidget {
  const _RsvpCard({required this.eventId, required this.createdAt});

  final String eventId;
  final Object? createdAt;

  @override
  Widget build(BuildContext context) {
    final fallbackTitle = eventId.isEmpty ? '-' : eventId;
    final timeText = _formatCheckinAt(createdAt);

    return FutureBuilder<DocumentSnapshot<Map<String, dynamic>>>(
      future: _eventFuture(eventId),
      initialData: null,
      builder: (context, snapshot) {
        final eventTitle = eventId.isEmpty
            ? fallbackTitle
            : _cachedEventTitle(eventId) ??
                (snapshot.connectionState == ConnectionState.done
                    ? _resolveEventTitle(snapshot.data, eventId, fallbackTitle)
                    : fallbackTitle);

        return Container(
          width: double.infinity,
          margin: const EdgeInsets.only(bottom: 8),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            border: Border.all(color: const Color(0x22000000)),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                eventTitle,
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
              if (timeText.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(
                  'RSVP tarihi: $timeText',
                  style: const TextStyle(color: Color(0x99000000)),
                ),
              ],
            ],
          ),
        );
      },
    );
  }
}

class _BadgeCard extends StatelessWidget {
  const _BadgeCard({required this.badge});

  final Map<String, dynamic> badge;

  @override
  Widget build(BuildContext context) {
    final id = badge['id']?.toString() ?? '-';
    final earnedAt = _formatEarnedAt(badge['earnedAt']);

    return Card(
      child: ListTile(
        leading: const Icon(Icons.emoji_events),
        title: Text(id),
        subtitle: Text('Kazanıldı: $earnedAt'),
      ),
    );
  }
}
