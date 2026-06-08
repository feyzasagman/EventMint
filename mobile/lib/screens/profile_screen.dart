import 'dart:ui';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import '../shared/badges.dart';
import '../theme/app_theme.dart';
import '../services/badge_service.dart';
import '../services/club_repo.dart';
import '../services/user_record_service.dart';
import '../widgets/app_card.dart';
import '../widgets/app_logo.dart';
import '../widgets/primary_button.dart';
import '../widgets/secondary_button.dart';
import '../widgets/tag_chip.dart';
import 'club_detail_screen.dart';

import 'create_club_screen.dart';
import 'club_manage_screen.dart';
import 'admin_events_screen.dart';
import 'admin_users_screen.dart';
import 'admin_managers_screen.dart';

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

    final body = _ProfileDataView(uid: uid);
    return showScaffold ? Scaffold(body: body) : body;
  }
}

class _ProfileDataView extends StatefulWidget {
  const _ProfileDataView({required this.uid});

  final String uid;

  @override
  State<_ProfileDataView> createState() => _ProfileDataViewState();
}

class _ProfileDataViewState extends State<_ProfileDataView> {
  late final Future<Map<String, dynamic>?> _profileFuture;

  @override
  void initState() {
    super.initState();
    _profileFuture = _loadProfile(widget.uid);
  }

  Future<Map<String, dynamic>?> _loadProfile(String uid) async {
    await syncCheckinBadges(uid);
    return getUserRecord(uid);
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Map<String, dynamic>?>(
      future: _profileFuture,
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
        final clubId = getUserClubId(data);
        final points = _asNumber(
          data['Toplam puanlar'] ?? data['pointsTotal'] ?? 0,
        );
        final badges = _parseBadges(pickBadgeList(data));

        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            const Center(child: AppLogo()),
            const SizedBox(height: 8),
            Center(
              child: Text(
                'EventMint',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            const SizedBox(height: 20),
            _InfoTile(label: 'E-posta', value: email.isEmpty ? '-' : email),
            _InfoTile(label: 'Rol', value: roleLabelTr(role)),
            if (isStaffRole(role) && clubId.isNotEmpty)
              _InfoTile(label: 'Kulüp', value: clubId),
            _PointsProgressBar(points: points),
            const SizedBox(height: 16),
            _BadgeShowcase(badges: badges),
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
              stream: ClubRepo.col(ClubRepo.clubMembers)
                  .where('uid', isEqualTo: widget.uid)
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
                    .map((doc) => _asString(doc.data()['clubId']))
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
              stream: ClubRepo.col(ClubRepo.checkins)
                  .where('uid', isEqualTo: FirebaseAuth.instance.currentUser!.uid)
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
              future: _loadRsvpDocs(widget.uid),
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
                      eventId: _pickRsvpEventId(data, d.id, widget.uid),
                      createdAt: data["createdAt"],
                    );
                  }).toList(),
                );
              },
            ),
            const SizedBox(height: 24),
            if (isStaffRole(role)) ...[
              Text(
                'Yönetim',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontSize: 17,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 8),
              PrimaryButton(
                label: 'Kulübüm / Üyelik Yönetimi',
                icon: Icons.groups_outlined,
                onPressed: () => _openClubManage(context, role: role, clubId: clubId),
              ),
              const SizedBox(height: 12),
              SecondaryButton(
                label: 'Etkinlik Yönetimi',
                icon: Icons.event_note_outlined,
                onPressed: () {
                  Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (_) => AdminEventsScreen(role: role, clubId: clubId),
                    ),
                  );
                },
              ),
              if (isAdminRole(role)) ...[
                const SizedBox(height: 12),
                SecondaryButton(
                  label: 'Kullanıcılar',
                  icon: Icons.people_outline,
                  onPressed: () {
                    Navigator.of(context).push(
                      MaterialPageRoute<void>(
                        builder: (_) => const AdminUsersScreen(),
                      ),
                    );
                  },
                ),
                const SizedBox(height: 12),
                SecondaryButton(
                  label: 'Yöneticiler',
                  icon: Icons.admin_panel_settings_outlined,
                  onPressed: () {
                    Navigator.of(context).push(
                      MaterialPageRoute<void>(
                        builder: (_) => const AdminManagersScreen(),
                      ),
                    );
                  },
                ),
              ],
              const SizedBox(height: 24),
            ],
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
  }
}

bool _canCreateClub(String role) {
  return isStaffRole(role);
}

Future<void> _openClubManage(
  BuildContext context, {
  required String role,
  required String clubId,
}) async {
  var targetClubId = clubId;
  if (targetClubId.isEmpty && isAdminRole(role)) {
    final snapshot = await ClubRepo.col(ClubRepo.clubs).get();
    if (!context.mounted) return;
    if (snapshot.docs.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Önce bir kulüp oluşturun.')),
      );
      return;
    }

    targetClubId = await showDialog<String>(
          context: context,
          builder: (context) => SimpleDialog(
            title: const Text('Kulüp seç'),
            children: snapshot.docs.map((doc) {
              final data = doc.data();
              final name = _asString(data['name'] ?? data['ad'] ?? doc.id);
              return SimpleDialogOption(
                onPressed: () => Navigator.pop(context, doc.id),
                child: Text(name),
              );
            }).toList(),
          ),
        ) ??
        '';
  }

  if (targetClubId.isEmpty) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Kulüp ataması gerekli.')),
      );
    }
    return;
  }

  if (!context.mounted) return;
  Navigator.of(context).push(
    MaterialPageRoute<void>(
      builder: (_) => ClubManageScreen(
        clubId: targetClubId,
        initialTabIndex: 1,
      ),
    ),
  );
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
      final snapshot = await ClubRepo.getClub(clubId);
      final data = snapshot.data() ?? <String, dynamic>{};
      clubs.add(
        _MemberClubInfo(
          clubId: clubId,
          name: _asString(data['name'] ?? data['ad'] ?? clubId),
          description: _asString(data['bio'] ?? data['aciklama']),
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
  return ClubRepo.col(ClubRepo.events).doc(eventId).get();
}

Future<List<QueryDocumentSnapshot<Map<String, dynamic>>>> _loadRsvpDocs(
  String uid,
) async {
  try {
    final rsvpCollection = ClubRepo.col(ClubRepo.rsvps);
    final uidSnapshot = await rsvpCollection.where('uid', isEqualTo: uid).get();
    if (uidSnapshot.docs.isNotEmpty) {
      return uidSnapshot.docs;
    }

    return <QueryDocumentSnapshot<Map<String, dynamic>>>[];
  } on FirebaseException catch (e, st) {
    _logFirestoreError(e, st);
    return <QueryDocumentSnapshot<Map<String, dynamic>>>[];
  } catch (e, st) {
    _logFirestoreError(e, st);
    return <QueryDocumentSnapshot<Map<String, dynamic>>>[];
  }
}

String _pickRsvpEventId(Map<String, dynamic> data, String docId, String uid) {
  final eventId = _asString(data['eventId']);
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

class _PointsProgressBar extends StatelessWidget {
  const _PointsProgressBar({required this.points});

  final num points;

  @override
  Widget build(BuildContext context) {
    final safe = points < 0 ? 0 : points.toDouble();
    final percent = pointsProgressPercent(points);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'Puan ilerlemesi',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: AppTheme.textSecondary,
              ),
            ),
            Text(
              '${safe.toInt()} / $pointsGoal',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        ClipRRect(
          borderRadius: BorderRadius.circular(999),
          child: Container(
            height: 10,
            decoration: BoxDecoration(
              color: AppTheme.surface2,
              border: Border.all(color: AppTheme.border),
              borderRadius: BorderRadius.circular(999),
            ),
            child: FractionallySizedBox(
              alignment: Alignment.centerLeft,
              widthFactor: percent / 100,
              child: Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [AppTheme.brand, AppTheme.brand.withValues(alpha: 0.7)],
                  ),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _BadgeShowcase extends StatelessWidget {
  const _BadgeShowcase({required this.badges});

  final List<Map<String, dynamic>> badges;

  @override
  Widget build(BuildContext context) {
    final sections = splitBadgeSections(badges);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Kazanılan Rozetler',
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
            fontSize: 17,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 8),
        if (sections.earned.isEmpty)
          Text(
            'Henüz rozet kazanılmadı.',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: AppTheme.textSecondary,
            ),
          )
        else
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: sections.earned.length,
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              crossAxisSpacing: 12,
              mainAxisSpacing: 12,
              mainAxisExtent: 210,
            ),
            itemBuilder: (context, index) =>
                _BadgeCard(badge: sections.earned[index]),
          ),
        const SizedBox(height: 20),
        Text(
          'Kilitli Rozetler',
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
            fontSize: 17,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 8),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: sections.locked.length,
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
            mainAxisExtent: 210,
          ),
          itemBuilder: (context, index) => _BadgeCard(
            definition: sections.locked[index],
            locked: true,
          ),
        ),
      ],
    );
  }
}

class _BadgeCard extends StatelessWidget {
  const _BadgeCard({
    this.badge,
    this.definition,
    this.locked = false,
  }) : assert(badge != null || definition != null);

  final Map<String, dynamic>? badge;
  final BadgeDefinition? definition;
  final bool locked;

  @override
  Widget build(BuildContext context) {
    final id = badge?['id']?.toString() ?? definition?.id.value ?? '-';
    final earnedAt = _formatEarnedAt(badge?['earnedAt']);
    final def = definition ?? badgeDefinitionFor(id);
    final title = def?.title ?? id;
    final subtitle = def?.subtitle ?? 'Kazanılmış rozet';
    final assetPath = def?.assetPath;

    return AppCard(
      padding: const EdgeInsets.all(14),
      child: Opacity(
        opacity: locked ? 0.72 : 1,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            if (assetPath != null)
              Stack(
                alignment: Alignment.center,
                children: [
                  if (locked)
                    ImageFiltered(
                      imageFilter: ImageFilter.blur(sigmaX: 2.5, sigmaY: 2.5),
                      child: Opacity(
                        opacity: 0.4,
                        child: Image.asset(
                          assetPath,
                          width: 80,
                          height: 80,
                          fit: BoxFit.contain,
                        ),
                      ),
                    )
                  else
                    Image.asset(
                      assetPath,
                      width: 80,
                      height: 80,
                      fit: BoxFit.contain,
                      errorBuilder: (context, error, stackTrace) => Icon(
                        Icons.emoji_events_outlined,
                        size: 44,
                        color: AppTheme.brand,
                      ),
                    ),
                  if (locked)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: AppTheme.background.withValues(alpha: 0.75),
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(color: AppTheme.border),
                      ),
                      child: Text(
                        'Kilitli',
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: AppTheme.textSecondary,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                ],
              )
            else
              Icon(Icons.emoji_events_outlined, size: 48, color: AppTheme.brand),
            const SizedBox(height: 8),
            Text(
              title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: locked ? AppTheme.textSecondary : null,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              subtitle,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                fontSize: 11,
                height: 1.25,
                color: AppTheme.textSecondary,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              locked ? 'Henüz kazanılmadı' : 'Kazanıldı: $earnedAt',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                fontSize: 10,
                color: AppTheme.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
