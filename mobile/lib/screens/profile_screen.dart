import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final user = FirebaseAuth.instance.currentUser;
    final uid = user?.uid;

    if (uid == null) {
      return const Scaffold(
        body: Center(child: Text('Kullanıcı oturumu bulunamadı.')),
      );
    }

    final userRef = FirebaseFirestore.instance
        .collection('Kullanıcılar')
        .doc(uid);

    return Scaffold(
      appBar: AppBar(title: const Text('Profil')),
      body: StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
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
      ),
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
  for (final item in value) {
    if (item is Map) {
      badges.add({
        'id': item['id']?.toString() ?? '-',
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

  final turkishTitle = _asString(data['Başlık'] ?? data['Baslik']);
  if (turkishTitle.isNotEmpty) return turkishTitle;

  return eventId;
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
      future: eventId.isEmpty
          ? null
          : FirebaseFirestore.instance.collection('Etkinlikler').doc(eventId).get(),
      builder: (context, snapshot) {
        final eventData = snapshot.data?.data();
        final eventTitle = _pickEventTitle(eventData, fallbackTitle);

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
