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
