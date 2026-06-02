import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import '../services/user_record_service.dart';
import '../widgets/app_card.dart';
import '../widgets/primary_button.dart';
import '../widgets/secondary_button.dart';
import '../widgets/tag_chip.dart';
import 'club_detail_screen.dart';

import 'create_club_screen.dart';

final Map<String, String> _eventTitleCache = <String, String>{};

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

    final body = FutureBuilder<Map<String, dynamic>?>(
      future: getUserRecord(uid),
      builder: (context, snapshot) {
        if (snapshot.hasError) {
          _logFirestoreError(snapshot.error!);
          return Center(
            child: Text(
              'Profil alınamadı: ${_firestoreErrorText(snapshot.error)}',
            ),
          );
        }

        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }

        final data = snapshot.data;
        if (data == null) {
          return const Center(child: Text('Profil verisi bulunamadı'));
        }

        final email = _asString(
          data['e-posta'] ?? data['email'] ?? data['Email'] ?? '',
        );
        final role = getRole(data);
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
            Text(
              'Rozetler',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontSize: 17,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 8),
            if (badges.isEmpty)
              const Text('Henüz rozet yok.')
            else
              ...badges.map((badge) => _BadgeCard(badge: badge)),
            const SizedBox(height: 24),
            Text(
              'Üye olduğum kulüpler',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontSize: 17,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 8),
            StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
              stream: FirebaseFirestore.instance
                  .collection('KulüpÜyeleri')
                  .where('UID', isEqualTo: uid)
                  .snapshots(),
              builder: (context, membershipSnapshot) {
                if (membershipSnapshot.hasError) {
                  _logFirestoreError(membershipSnapshot.error!);
                  return Text(
                    'Hata: ${_firestoreErrorText(membershipSnapshot.error)}',
                  );
                }
                if (!membershipSnapshot.hasData) {
                  return const Text('Yükleniyor...');
                }

                final membershipDocs = membershipSnapshot.data!.docs;
                final clubIds = membershipDocs
                    .map((doc) => _asString(doc.data()['kulupId']))
                    .where((id) => id.isNotEmpty)
                    .toSet()
                    .toList();

                if (clubIds.isEmpty) {
                  return const Text('Henüz bir kulübe üye değilsin');
                }

                return FutureBuilder<List<_MemberClubInfo>>(
                  future: _loadMemberClubs(clubIds),
                  builder: (context, clubsSnapshot) {
                    if (clubsSnapshot.hasError) {
                      _logFirestoreError(clubsSnapshot.error!);
                      return Text(
                        'Hata: ${_firestoreErrorText(clubsSnapshot.error)}',
                      );
                    }
                    if (!clubsSnapshot.hasData) {
                      return const Text('Yükleniyor...');
                    }

                    final clubs = clubsSnapshot.data!;
                    if (clubs.isEmpty) {
                      return const Text('Henüz bir kulübe üye değilsin');
                    }

                    return Column(
                      children: clubs
                          .map(
                            (club) => _MemberClubCard(
                              club: club,
                              onTap: () {
                                Navigator.of(context).push(
                                  MaterialPageRoute<void>(
                                    builder: (_) =>
                                        ClubDetailScreen(clubId: club.clubId),
                                  ),
                                );
                              },
                            ),
                          )
                          .toList(),
                    );
                  },
                );
              },
            ),
            const SizedBox(height: 24),
            Text(
              "Katılım Geçmişi",
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontSize: 17,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 8),
            StreamBuilder<QuerySnapshot>(
              stream: FirebaseFirestore.instance
                  .collection("Check-in")
                  .where(
                    "UID",
                    isEqualTo: FirebaseAuth.instance.currentUser!.uid,
                  )
                  .snapshots(),
              builder: (context, snapshot) {
                if (snapshot.hasError) {
                  _logFirestoreError(snapshot.error!);
                  return Text("Hata: ${_firestoreErrorText(snapshot.error)}");
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
            Text(
              "Katılacağım Etkinliklerim",
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontSize: 17,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 8),
            FutureBuilder<List<QueryDocumentSnapshot<Map<String, dynamic>>>>(
              future: _loadRsvpDocs(uid),
              builder: (context, snapshot) {
                if (snapshot.hasError) {
                  _logFirestoreError(snapshot.error!);
                  return Text("Hata: ${_firestoreErrorText(snapshot.error)}");
                }
                if (!snapshot.hasData) {
                  return const Text("Yükleniyor...");
                }

                final docs = snapshot.data!;
                if (docs.isEmpty) {
                  return const Text("Henüz katılım kaydı yok.");
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
            if (_canCreateClub(role)) ...[
              PrimaryButton(
                label: 'Kulüp Oluştur',
                icon: Icons.add_business,
                onPressed: () {
                  Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (_) => const CreateClubScreen(),
                    ),
                  );
                },
              ),
              const SizedBox(height: 12),
            ],
            SecondaryButton(
              label: 'Çıkış Yap',
              icon: Icons.logout,
              onPressed: () async {
                await FirebaseAuth.instance.signOut();
                if (context.mounted) {
                  Navigator.of(context).popUntil((route) => route.isFirst);
                }
              },
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

bool _canCreateClub(String role) {
  final normalizedRole = role.toLowerCase().trim();
  return normalizedRole == 'kulüp_yöneticisi';
}

String _asString(Object? value) {
  if (value == null) return '';
  return value.toString().trim();
}

class _MemberClubInfo {
  const _MemberClubInfo({
    required this.clubId,
    required this.name,
    required this.description,
    required this.tags,
  });

  final String clubId;
  final String name;
  final String description;
  final List<String> tags;
}

Future<List<_MemberClubInfo>> _loadMemberClubs(List<String> clubIds) async {
  final clubs = <_MemberClubInfo>[];
  for (final clubId in clubIds) {
    try {
      final snapshot = await FirebaseFirestore.instance
          .collection('Kulüpler')
          .doc(clubId)
          .get();
      final data = snapshot.data() ?? <String, dynamic>{};
      clubs.add(
        _MemberClubInfo(
          clubId: clubId,
          name: _asString(data['ad'] ?? data['Reklam'] ?? clubId),
          description: _asString(data['aciklama']),
          tags: _pickClubTags(data),
        ),
      );
    } on FirebaseException catch (e, st) {
      _logFirestoreError(e, st);
    } catch (e, st) {
      _logFirestoreError(e, st);
    }
  }
  return clubs;
}

List<String> _pickClubTags(Map<String, dynamic> data) {
  final value = data['Etiketler'] ?? data['etiketler'] ?? data['tags'];
  if (value is List) {
    return value
        .map((item) => item.toString().trim())
        .where((item) => item.isNotEmpty)
        .toList();
  }
  if (value is String) {
    return value
        .split(',')
        .map((item) => item.trim())
        .where((item) => item.isNotEmpty)
        .toList();
  }
  return <String>[];
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
      badges.add({'id': id, 'earnedAt': item['earnedAt'] ?? item['earned_at']});
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
  return FirebaseFirestore.instance
      .collection('Etkinlikler')
      .doc(eventId)
      .get();
}

Future<List<QueryDocumentSnapshot<Map<String, dynamic>>>> _loadRsvpDocs(
  String uid,
) async {
  try {
    final rsvpCollection = FirebaseFirestore.instance.collection("RSVP'ler");
    final uidSnapshot = await rsvpCollection.where("UID", isEqualTo: uid).get();
    if (uidSnapshot.docs.isNotEmpty) {
      return uidSnapshot.docs;
    }

    final lowercaseUidSnapshot = await rsvpCollection
        .where("uid", isEqualTo: uid)
        .get();
    return lowercaseUidSnapshot.docs;
  } on FirebaseException catch (e, st) {
    _logFirestoreError(e, st);
    return <QueryDocumentSnapshot<Map<String, dynamic>>>[];
  } catch (e, st) {
    _logFirestoreError(e, st);
    return <QueryDocumentSnapshot<Map<String, dynamic>>>[];
  }
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
    return AppCard(
      margin: const EdgeInsets.only(bottom: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              fontSize: 12,
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              fontSize: 16,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

class _MemberClubCard extends StatelessWidget {
  const _MemberClubCard({required this.club, required this.onTap});

  final _MemberClubInfo club;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      margin: const EdgeInsets.only(bottom: 8),
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            club.name.isEmpty ? club.clubId : club.name,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              fontSize: 16,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            club.description.isEmpty ? 'Açıklama yok.' : club.description,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              fontSize: 12,
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
          if (club.tags.isNotEmpty) ...[
            const SizedBox(height: 8),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: club.tags.map((tag) => TagChip(label: tag)).toList(),
            ),
          ],
        ],
      ),
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
                      ? _resolveEventTitle(
                          snapshot.data,
                          eventId,
                          fallbackTitle,
                        )
                      : fallbackTitle);

        return AppCard(
          margin: const EdgeInsets.only(bottom: 8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                eventTitle,
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                timeText,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  fontSize: 12,
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
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
                      ? _resolveEventTitle(
                          snapshot.data,
                          eventId,
                          fallbackTitle,
                        )
                      : fallbackTitle);

        return AppCard(
          margin: const EdgeInsets.only(bottom: 8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                eventTitle,
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                ),
              ),
              if (timeText.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(
                  'Katılım tarihi: $timeText',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    fontSize: 12,
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
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

    return AppCard(
      margin: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          const Icon(Icons.emoji_events),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  id,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Kazanıldı: $earnedAt',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    fontSize: 12,
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
