import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import 'club_manage_screen.dart';
import 'event_detail_screen.dart';
import '../navigation/club_admin_navigation.dart';
import '../services/club_repo.dart';
import '../services/user_record_service.dart';
import '../theme/app_theme.dart';
import '../widgets/app_card.dart';
import '../widgets/club_logo_avatar.dart';
import '../widgets/event_card.dart';
import '../widgets/primary_button.dart';
import '../widgets/tag_chip.dart';

String _friendlyFirestoreError(Object? error) {
  if (error is FirebaseException) {
    switch (error.code) {
      case 'permission-denied':
        return 'Bu içeriği görüntüleme yetkiniz yok.';
      case 'unavailable':
        return 'Sunucuya ulaşılamıyor. İnternet bağlantınızı kontrol edin.';
      case 'not-found':
        return 'İstenen kayıt bulunamadı.';
      default:
        return error.message ?? error.code;
    }
  }
  return error?.toString() ?? 'Bilinmeyen hata';
}

void _logFirestoreError(Object error, [StackTrace? stackTrace]) {
  debugPrint('FIRESTORE ERROR: $error');
  if (stackTrace != null) {
    debugPrint('$stackTrace');
  }
}

class _FirestoreErrorBanner extends StatelessWidget {
  const _FirestoreErrorBanner({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.fromLTRB(16, 8, 16, 0),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.errorContainer.withValues(alpha: 0.55),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: Theme.of(context).colorScheme.error.withValues(alpha: 0.25),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            Icons.info_outline,
            size: 16,
            color: Theme.of(context).colorScheme.error,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              message,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Theme.of(context).colorScheme.onErrorContainer,
                height: 1.35,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class ClubDetailScreen extends StatelessWidget {
  const ClubDetailScreen({super.key, required this.clubId});

  final String clubId;

  @override
  Widget build(BuildContext context) {
    final uid = FirebaseAuth.instance.currentUser?.uid;

    return StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
      stream: ClubRepo.streamClub(clubId),
      builder: (context, snapshot) {
        if (snapshot.hasError) {
          _logFirestoreError(snapshot.error!);
          return Scaffold(
            appBar: AppBar(title: Text(clubId)),
            body: ListView(
              padding: const EdgeInsets.only(top: 8),
              children: [
                _FirestoreErrorBanner(
                  message: _friendlyFirestoreError(snapshot.error),
                ),
              ],
            ),
          );
        }

        if (!snapshot.hasData) {
          return Scaffold(
            appBar: AppBar(title: Text(clubId)),
            body: const Center(child: CircularProgressIndicator()),
          );
        }

        final data = snapshot.data?.data() ?? <String, dynamic>{};
        final title = _clubName(data, clubId);
        final bio = _clubBio(data);
        final handle = _clubHandle(data, clubId, title);
        final logoKey = _asString(data['logoKey'] ?? data['logo_key']);
        final logoUrl = _asString(data['logoUrl'] ?? data['logo']);
        final coverUrl = _asString(data['coverUrl'] ?? data['cover']);
        final tags = _pickTags(data);
        final socialLinks = _pickSocialLinks(data);

        Widget buildBody({required bool showManageActionBar}) {
          return DefaultTabController(
            length: 3,
            child: Scaffold(
              backgroundColor: AppTheme.background,
              appBar: AppBar(
                title: Text(title),
                backgroundColor: AppTheme.background,
              ),
              body: NestedScrollView(
                headerSliverBuilder: (context, innerBoxIsScrolled) => [
                  SliverToBoxAdapter(
                    child: _ClubHeroHeader(
                      clubId: clubId,
                      title: title,
                      handle: handle,
                      bio: bio,
                      logoKey: logoKey.isEmpty ? null : logoKey,
                      logoUrl: logoUrl,
                      coverUrl: coverUrl,
                    ),
                  ),
                  if (showManageActionBar)
                    SliverToBoxAdapter(
                      child: _ClubManageActionBar(clubId: clubId),
                    ),
                  SliverPersistentHeader(
                    pinned: true,
                    delegate: _StickyTabBarDelegate(
                      TabBar(
                        labelColor: AppTheme.brand,
                        unselectedLabelColor: AppTheme.textSecondary,
                        indicatorColor: AppTheme.brand,
                        dividerColor: AppTheme.border,
                        tabs: const [
                          Tab(text: 'Hakkında'),
                          Tab(text: 'Etkinlikler'),
                          Tab(text: 'Paylaşımlar'),
                        ],
                      ),
                    ),
                  ),
                ],
                body: TabBarView(
                  children: [
                    _ClubAboutTab(
                      clubId: clubId,
                      bio: bio,
                      tags: tags,
                      socialLinks: socialLinks,
                    ),
                    _ClubEventsTab(clubId: clubId),
                    _ClubPostsTab(
                      clubId: clubId,
                      clubName: title,
                      logoKey: logoKey.isEmpty ? null : logoKey,
                      logoUrl: logoUrl,
                    ),
                  ],
                ),
              ),
            ),
          );
        }

        if (uid == null || uid.isEmpty) {
          return buildBody(showManageActionBar: false);
        }

        return StreamBuilder<Map<String, dynamic>?>(
          stream: streamUserRecord(uid),
          builder: (context, userSnapshot) {
            final userData = userSnapshot.hasError
                ? <String, dynamic>{}
                : (userSnapshot.data ?? <String, dynamic>{});
            final role = normalizeUserRole(userData);
            final myClubId = getUserClubId(userData);
            final showManageActionBar = userSnapshot.connectionState ==
                    ConnectionState.waiting &&
                !userSnapshot.hasData &&
                !userSnapshot.hasError
                ? false
                : canManageClub(
                    role: role,
                    myClubId: myClubId,
                    currentClubId: clubId,
                  );

            return buildBody(showManageActionBar: showManageActionBar);
          },
        );
      },
    );
  }
}

class _StickyTabBarDelegate extends SliverPersistentHeaderDelegate {
  _StickyTabBarDelegate(this.tabBar);

  final TabBar tabBar;

  @override
  double get minExtent => tabBar.preferredSize.height;

  @override
  double get maxExtent => tabBar.preferredSize.height;

  @override
  Widget build(
    BuildContext context,
    double shrinkOffset,
    bool overlapsContent,
  ) {
    return Material(
      color: AppTheme.background,
      elevation: overlapsContent ? 1 : 0,
      child: tabBar,
    );
  }

  @override
  bool shouldRebuild(covariant _StickyTabBarDelegate oldDelegate) {
    return oldDelegate.tabBar != tabBar;
  }
}

class _ClubHeroHeader extends StatelessWidget {
  const _ClubHeroHeader({
    required this.clubId,
    required this.title,
    required this.handle,
    required this.bio,
    this.logoKey,
    required this.logoUrl,
    required this.coverUrl,
  });

  final String clubId;
  final String title;
  final String handle;
  final String bio;
  final String? logoKey;
  final String logoUrl;
  final String coverUrl;

  static const double _coverHeight = 180;
  static const double _logoSize = 72;
  static const double _avatarOverlap = 36;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Stack(
          clipBehavior: Clip.none,
          children: [
            _CoverBanner(height: _coverHeight, coverUrl: coverUrl),
            Positioned(
              top: 12,
              right: 12,
              child: Material(
                elevation: 2,
                borderRadius: BorderRadius.circular(999),
                color: AppTheme.surface.withValues(alpha: 0.92),
                child: Padding(
                  padding: const EdgeInsets.all(2),
                  child: _ClubHeaderActionButton(clubId: clubId),
                ),
              ),
            ),
            Positioned(
              left: 16,
              bottom: -_avatarOverlap,
              child: ClubLogoAvatar(
                name: title,
                logoKey: logoKey,
                logoUrl: logoUrl.isEmpty ? null : logoUrl,
                size: _logoSize,
                profileStyle: true,
              ),
            ),
          ],
        ),
        SizedBox(height: _avatarOverlap + 10),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w800,
                  height: 1.15,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                handle,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: AppTheme.textSecondary,
                  fontWeight: FontWeight.w500,
                ),
              ),
              const SizedBox(height: 10),
              _ClubStatsPills(clubId: clubId),
              if (bio.isNotEmpty) ...[
                const SizedBox(height: 10),
                Text(
                  bio,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: AppTheme.textSecondary,
                    height: 1.45,
                  ),
                ),
              ],
            ],
          ),
        ),
        const Divider(height: 1, thickness: 1, color: AppTheme.border),
      ],
    );
  }
}

class _ClubHeaderActionButton extends StatelessWidget {
  const _ClubHeaderActionButton({required this.clubId});

  final String clubId;

  @override
  Widget build(BuildContext context) {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid == null || uid.isEmpty) {
      return const _HeaderPillButton(label: 'Üye Ol', enabled: false);
    }

    return StreamBuilder<Map<String, dynamic>?>(
      stream: streamUserRecord(uid),
      builder: (context, roleSnapshot) {
        final roleLoading = roleSnapshot.connectionState ==
                ConnectionState.waiting &&
            !roleSnapshot.hasData &&
            !roleSnapshot.hasError;
        if (roleLoading) {
          return const _HeaderPillButton(label: '...', enabled: false);
        }

        if (roleSnapshot.hasError) {
          _logFirestoreError(roleSnapshot.error!);
        }

        final userData = roleSnapshot.hasError
            ? <String, dynamic>{}
            : (roleSnapshot.data ?? <String, dynamic>{});
        final role = normalizeUserRole(userData);
        final myClubId = getUserClubId(userData);

        final manageClub = canManageClub(
          role: role,
          myClubId: myClubId,
          currentClubId: clubId,
        );

        debugPrint('ROLE=$role USER_CLUB=$myClubId CLUB=$clubId');
        debugPrint('APP_DOC=${clubId}_$uid MEMBER_DOC=${clubId}_$uid');
        debugPrint('CAN_MANAGE_CLUB=$manageClub');

        if (manageClub) {
          return _HeaderPillButton(
            label: 'Yönet',
            enabled: true,
            onPressed: () {
              Navigator.of(context).push<void>(
                MaterialPageRoute<void>(
                  builder: (_) => ClubManageScreen(clubId: clubId),
                ),
              );
            },
          );
        }

        return _MembershipHeaderButton(clubId: clubId, uid: uid);
      },
    );
  }
}

class _MembershipHeaderButton extends StatelessWidget {
  const _MembershipHeaderButton({
    required this.clubId,
    required this.uid,
  });

  final String clubId;
  final String uid;

  DocumentReference<Map<String, dynamic>> get _memberRef =>
      ClubRepo.clubMemberDoc(clubId, uid);

  DocumentReference<Map<String, dynamic>> get _applicationRef =>
      ClubRepo.clubApplicationDoc(clubId, uid);

  Future<void> _openApplySheet(BuildContext context) async {
    final submitted = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      showDragHandle: true,
      backgroundColor: AppTheme.surface,
      builder: (_) => ClubApplySheet(
        clubId: clubId,
        applicationRef: _applicationRef,
      ),
    );

    if (submitted == true && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Başvuru gönderildi')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
      stream: _memberRef.snapshots(),
      builder: (context, memberSnapshot) {
        if (memberSnapshot.hasError) {
          _logFirestoreError(memberSnapshot.error!);
        }

        if (!memberSnapshot.hasError && (memberSnapshot.data?.exists ?? false)) {
          return const _HeaderPillButton(label: 'Üyesin', enabled: false);
        }

        return StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
          stream: _applicationRef.snapshots(),
          builder: (context, applicationSnapshot) {
            if (applicationSnapshot.hasError) {
              _logFirestoreError(applicationSnapshot.error!);
            }

            if (memberSnapshot.hasError || applicationSnapshot.hasError) {
              return _HeaderPillButton(
                label: 'Üye Ol',
                enabled: true,
                onPressed: () => _openApplySheet(context),
              );
            }

            final status = _asString(
              applicationSnapshot.data?.data()?['status'],
            ).toLowerCase();
            if (applicationSnapshot.data?.exists == true &&
                status == 'pending') {
              return const _HeaderPillButton(
                label: 'Başvuru beklemede',
                enabled: false,
              );
            }

            return _HeaderPillButton(
              label: 'Üye Ol',
              enabled: true,
              onPressed: () => _openApplySheet(context),
            );
          },
        );
      },
    );
  }
}

class _HeaderPillButton extends StatelessWidget {
  const _HeaderPillButton({
    required this.label,
    required this.enabled,
    this.onPressed,
  });

  final String label;
  final bool enabled;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final style = FilledButton.styleFrom(
      visualDensity: VisualDensity.compact,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
      minimumSize: const Size(0, 34),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(999),
      ),
    );

    if (enabled && onPressed != null) {
      return FilledButton(
        onPressed: onPressed,
        style: style,
        child: Text(label),
      );
    }

    return OutlinedButton(
      onPressed: null,
      style: OutlinedButton.styleFrom(
        visualDensity: VisualDensity.compact,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        minimumSize: const Size(0, 34),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(999),
        ),
      ),
      child: Text(label),
    );
  }
}

class _ClubManageActionBar extends StatelessWidget {
  const _ClubManageActionBar({required this.clubId});

  final String clubId;

  static const _actions = <({String label, String route})>[
    (label: 'Etkinlik Ekle', route: ClubAdminRoutes.eventCreate),
    (label: 'Paylaşım Oluştur', route: ClubAdminRoutes.postCreate),
    (label: 'Başvurular', route: ClubAdminRoutes.applications),
    (label: 'Üyeler', route: ClubAdminRoutes.members),
  ];

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppTheme.background,
      padding: const EdgeInsets.fromLTRB(0, 10, 0, 12),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: Row(
          children: [
            for (var i = 0; i < _actions.length; i++) ...[
              if (i > 0) const SizedBox(width: 8),
              _AdminActionPill(
                label: _actions[i].label,
                onTap: () => navigateClubAdminRoute(
                  context,
                  route: _actions[i].route,
                  clubId: clubId,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _AdminActionPill extends StatelessWidget {
  const _AdminActionPill({
    required this.label,
    required this.onTap,
  });

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppTheme.surface2,
      borderRadius: BorderRadius.circular(999),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(999),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: AppTheme.border),
          ),
          child: Text(
            label,
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
              fontWeight: FontWeight.w600,
              color: AppTheme.textPrimary,
            ),
          ),
        ),
      ),
    );
  }
}

class _CoverBanner extends StatelessWidget {
  const _CoverBanner({required this.height, required this.coverUrl});

  final double height;
  final String coverUrl;

  static const _bottomRadius = BorderRadius.only(
    bottomLeft: Radius.circular(16),
    bottomRight: Radius.circular(16),
  );

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: _bottomRadius,
      child: SizedBox(
        height: height,
        width: double.infinity,
        child: coverUrl.isNotEmpty
            ? Stack(
                fit: StackFit.expand,
                children: [
                  Image.network(
                    coverUrl,
                    fit: BoxFit.cover,
                    errorBuilder: (_, _, _) =>
                        _CoverPlaceholder(height: height, embedded: true),
                  ),
                  const _CoverScrim(),
                  const _CoverGlowLayer(),
                ],
              )
            : _CoverPlaceholder(height: height, embedded: true),
      ),
    );
  }
}

class _CoverScrim extends StatelessWidget {
  const _CoverScrim();

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            Colors.black.withValues(alpha: 0.08),
            Colors.black.withValues(alpha: 0.28),
          ],
        ),
      ),
    );
  }
}

class _CoverGlowLayer extends StatelessWidget {
  const _CoverGlowLayer();

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        Positioned(
          top: -48,
          left: -32,
          child: Container(
            width: 180,
            height: 180,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: RadialGradient(
                colors: [
                  const Color(0xFF7C3AED).withValues(alpha: 0.22),
                  Colors.transparent,
                ],
              ),
            ),
          ),
        ),
        Positioned(
          right: 12,
          bottom: 8,
          child: Icon(
            Icons.groups_rounded,
            size: 72,
            color: Colors.white.withValues(alpha: 0.08),
          ),
        ),
      ],
    );
  }
}

class _CoverPlaceholder extends StatelessWidget {
  const _CoverPlaceholder({
    required this.height,
    this.embedded = false,
  });

  final double height;
  final bool embedded;

  static const _gradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      Color(0xFF111827),
      Color(0xFF2D1B69),
      Color(0xFF6D28D9),
    ],
  );

  @override
  Widget build(BuildContext context) {
    final content = Stack(
      fit: StackFit.expand,
      children: [
        const DecoratedBox(decoration: BoxDecoration(gradient: _gradient)),
        const _CoverGlowLayer(),
      ],
    );

    if (embedded) return content;

    return ClipRRect(
      borderRadius: _CoverBanner._bottomRadius,
      child: SizedBox(height: height, width: double.infinity, child: content),
    );
  }
}

class _ClubStatsPills extends StatelessWidget {
  const _ClubStatsPills({required this.clubId});

  final String clubId;

  @override
  Widget build(BuildContext context) {
    final membersStream = ClubRepo.col(ClubRepo.clubMembers)
        .where('clubId', isEqualTo: clubId)
        .snapshots();
    final eventsStream = ClubRepo.col(ClubRepo.events)
        .where('clubId', isEqualTo: clubId)
        .snapshots();

    return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      stream: membersStream,
      builder: (context, membersSnapshot) {
        return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
          stream: eventsStream,
          builder: (context, eventsSnapshot) {
            final memberCount = membersSnapshot.data?.docs.length ?? 0;
            final eventCount = (eventsSnapshot.data?.docs ?? [])
                .where(
                  (doc) => _asString(doc.data()['status']) == 'published',
                )
                .length;

            return Text(
              'Üye: $memberCount • Etkinlik: $eventCount',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: AppTheme.textSecondary,
                fontWeight: FontWeight.w600,
              ),
            );
          },
        );
      },
    );
  }
}

class ClubApplySheet extends StatefulWidget {
  const ClubApplySheet({
    super.key,
    required this.clubId,
    required this.applicationRef,
  });

  final String clubId;
  final DocumentReference<Map<String, dynamic>> applicationRef;

  @override
  State<ClubApplySheet> createState() => _ClubApplySheetState();
}

class _ClubApplySheetState extends State<ClubApplySheet> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _departmentController = TextEditingController();
  final _studentNoController = TextEditingController();
  final _motivationController = TextEditingController();

  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _nameController.dispose();
    _departmentController.dispose();
    _studentNoController.dispose();
    _motivationController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid == null) {
      setState(() => _error = 'Oturum bulunamadı.');
      return;
    }

    setState(() {
      _saving = true;
      _error = null;
    });

    final data = <String, dynamic>{
      'uid': uid,
      'clubId': widget.clubId,
      'status': 'pending',
      'createdAt': FieldValue.serverTimestamp(),
      'adSoyad': _nameController.text.trim(),
      'bolum': _departmentController.text.trim(),
      'ogrNo': _studentNoController.text.trim(),
      'motivasyon': _motivationController.text.trim(),
    };

    debugPrint('APPLY_REF_PATH: ${widget.applicationRef.path}');
    debugPrint('APPLY_DATA: $data');

    try {
      await widget.applicationRef.set(data);

      if (!mounted) return;
      Navigator.of(context).pop(true);
    } catch (e, st) {
      if (e is FirebaseException) {
        debugPrint('ERROR_CODE: ${e.code}');
        debugPrint('ERROR_MESSAGE: ${e.message}');
      } else {
        debugPrint('UNKNOWN_ERROR: $e');
      }

      _logFirestoreError(e, st);
      if (!mounted) return;
      final message = e is FirebaseException
          ? (e.message ?? e.code)
          : e.toString();
      setState(() => _error = 'Başvuru gönderilemedi: $message');
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(message)),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 16,
        right: 16,
        bottom: MediaQuery.of(context).viewInsets.bottom + 16,
      ),
      child: Form(
        key: _formKey,
        child: ListView(
          shrinkWrap: true,
          children: [
            Text(
              'Üyelik Başvurusu',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _nameController,
              decoration: const InputDecoration(labelText: 'Ad Soyad'),
              validator: (value) {
                if (value == null || value.trim().isEmpty) {
                  return 'Ad Soyad zorunlu.';
                }
                return null;
              },
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _departmentController,
              decoration: const InputDecoration(labelText: 'Bölüm'),
              validator: (value) {
                if (value == null || value.trim().isEmpty) {
                  return 'Bölüm zorunlu.';
                }
                return null;
              },
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _studentNoController,
              decoration: const InputDecoration(labelText: 'Öğrenci No'),
              validator: (value) {
                if (value == null || value.trim().isEmpty) {
                  return 'Öğrenci No zorunlu.';
                }
                return null;
              },
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _motivationController,
              minLines: 2,
              maxLines: 4,
              decoration: const InputDecoration(labelText: 'Motivasyon'),
              validator: (value) {
                if (value == null || value.trim().isEmpty) {
                  return 'Motivasyon zorunlu.';
                }
                return null;
              },
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              _FirestoreErrorBanner(message: _error!),
            ],
            const SizedBox(height: 16),
            PrimaryButton(
              label: _saving ? 'Gönderiliyor...' : 'Gönder',
              icon: Icons.send,
              onPressed: _saving ? null : _submit,
            ),
          ],
        ),
      ),
    );
  }
}

class _ClubAboutTab extends StatelessWidget {
  const _ClubAboutTab({
    required this.clubId,
    required this.bio,
    required this.tags,
    required this.socialLinks,
  });

  final String clubId;
  final String bio;
  final List<String> tags;
  final _ClubSocialLinks socialLinks;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Hakkında',
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 10),
              Text(
                bio.isEmpty ? 'Bio eklenmemiş.' : bio,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: AppTheme.textSecondary,
                  height: 1.5,
                ),
              ),
            ],
          ),
        ),
        if (tags.isNotEmpty) ...[
          const SizedBox(height: 12),
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Etiketler',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: tags.map((tag) => TagChip(label: tag)).toList(),
                ),
              ],
            ),
          ),
        ],
        if (socialLinks.hasAny) ...[
          const SizedBox(height: 12),
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Bağlantılar',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 12),
                _SocialLinksRow(links: socialLinks),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

class _ClubSocialLinks {
  const _ClubSocialLinks({
    this.instagram = '',
    this.linkedin = '',
    this.website = '',
  });

  final String instagram;
  final String linkedin;
  final String website;

  bool get hasAny =>
      instagram.isNotEmpty || linkedin.isNotEmpty || website.isNotEmpty;
}

class _SocialLinksRow extends StatelessWidget {
  const _SocialLinksRow({required this.links});

  final _ClubSocialLinks links;

  Future<void> _openLink(BuildContext context, String raw) async {
    final normalized = raw.startsWith('http') ? raw : 'https://$raw';
    final uri = Uri.tryParse(normalized);
    if (uri == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Geçersiz bağlantı')),
      );
      return;
    }

    final launched = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!launched && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Bağlantı açılamadı')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 10,
      runSpacing: 10,
      children: [
        if (links.instagram.isNotEmpty)
          _SocialIconButton(
            icon: Icons.camera_alt_outlined,
            label: 'Instagram',
            onTap: () => _openLink(context, links.instagram),
          ),
        if (links.linkedin.isNotEmpty)
          _SocialIconButton(
            icon: Icons.work_outline,
            label: 'LinkedIn',
            onTap: () => _openLink(context, links.linkedin),
          ),
        if (links.website.isNotEmpty)
          _SocialIconButton(
            icon: Icons.language,
            label: 'Web',
            onTap: () => _openLink(context, links.website),
          ),
      ],
    );
  }
}

class _SocialIconButton extends StatelessWidget {
  const _SocialIconButton({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: AppTheme.surface2,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppTheme.border),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 18, color: AppTheme.brand),
            const SizedBox(width: 8),
            Text(
              label,
              style: Theme.of(context).textTheme.labelLarge?.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ClubEventsTab extends StatelessWidget {
  const _ClubEventsTab({required this.clubId});

  final String clubId;

  @override
  Widget build(BuildContext context) {
    ClubRepo.logCollection(ClubRepo.events, op: 'listByClub:$clubId');
    final stream = ClubRepo.col(ClubRepo.events)
        .where('clubId', isEqualTo: clubId)
        .where('status', isEqualTo: 'published')
        .snapshots();

    return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      stream: stream,
      builder: (context, snapshot) {
        if (snapshot.hasError) {
          _logFirestoreError(snapshot.error!);
          return ListView(
            padding: const EdgeInsets.only(top: 8),
            children: [
              _FirestoreErrorBanner(
                message: _friendlyFirestoreError(snapshot.error),
              ),
            ],
          );
        }

        if (!snapshot.hasData) {
          return const Center(child: CircularProgressIndicator());
        }

        final docs = snapshot.data!.docs.toList()
          ..sort((a, b) {
            final aMs = _pickEventSortMs(a.data());
            final bMs = _pickEventSortMs(b.data());
            return bMs.compareTo(aMs);
          });

        if (docs.isEmpty) {
          return const Center(child: Text('Yayınlanmış etkinlik yok.'));
        }

        return ListView.separated(
          padding: const EdgeInsets.all(12),
          itemCount: docs.length,
          separatorBuilder: (_, _) => const SizedBox(height: 8),
          itemBuilder: (context, index) {
            return _buildEventListCard(context, docs[index]);
          },
        );
      },
    );
  }
}

int _pickEventSortMs(Map<String, dynamic> data) {
  final value = data['createdAt'] ?? data['olusturulduAt'];
  if (value is Timestamp) return value.millisecondsSinceEpoch;
  if (value is DateTime) return value.millisecondsSinceEpoch;
  return 0;
}

String _pickEventString(Map<String, dynamic> data, List<String> keys) {
  for (final key in keys) {
    final value = data[key];
    if (value is String && value.trim().isNotEmpty) {
      return value.trim();
    }
  }
  return '';
}

List<String> _pickEventTags(Map<String, dynamic> data) {
  for (final key in const ['tags', 'Etiketler', 'etiketler']) {
    final value = data[key];
    if (value is List) {
      return value
          .map((item) => item.toString().trim())
          .where((item) => item.isNotEmpty)
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
  return const [];
}

Widget _buildEventListCard(
  BuildContext context,
  QueryDocumentSnapshot<Map<String, dynamic>> doc,
) {
  final data = doc.data();
  final titleRaw = _pickEventString(data, const [
    'title',
    'Baslik',
    'Başlık',
    'başlık',
    'baslik',
  ]);
  final title = titleRaw.isEmpty ? '(Başlık yok)' : titleRaw;
  final clubIdRaw = _pickEventString(data, const [
    'clubId',
    'kulupId',
    'Kulup',
    'kulup',
  ]);
  final clubId = clubIdRaw.isEmpty ? '-' : clubIdRaw;
  final categoryRaw = _pickEventString(data, const [
    'category',
    'Kategori',
    'kategori',
  ]);
  final category = categoryRaw.isEmpty ? '-' : categoryRaw;
  final locationRaw = _pickEventString(data, const [
    'location',
    'Konum',
    'konum',
  ]);
  final location = locationRaw.isEmpty ? '-' : locationRaw;
  final tags = _pickEventTags(data);

  return EventCard(
    title: title,
    clubId: clubId,
    category: category,
    location: location,
    tags: tags,
    onTap: () {
      Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => EventDetailScreen(
            eventId: doc.id,
            data: data,
          ),
        ),
      );
    },
  );
}

class _ClubPostsTab extends StatefulWidget {
  const _ClubPostsTab({
    required this.clubId,
    required this.clubName,
    this.logoKey,
    required this.logoUrl,
  });

  final String clubId;
  final String clubName;
  final String? logoKey;
  final String logoUrl;

  @override
  State<_ClubPostsTab> createState() => _ClubPostsTabState();
}

class _ClubPostsTabState extends State<_ClubPostsTab> {
  var _useOrderedQuery = true;

  Stream<QuerySnapshot<Map<String, dynamic>>> _postsStream() {
    var query = ClubRepo.col(ClubRepo.clubPosts)
        .where('clubId', isEqualTo: widget.clubId);

    if (_useOrderedQuery) {
      query = query.orderBy('createdAt', descending: true);
    }

    return query.snapshots();
  }

  List<QueryDocumentSnapshot<Map<String, dynamic>>> _sortPosts(
    List<QueryDocumentSnapshot<Map<String, dynamic>>> docs,
  ) {
    if (_useOrderedQuery) return docs;

    final sorted = docs.toList()
      ..sort((a, b) {
        final aDate = _pickPostDate(a.data());
        final bDate = _pickPostDate(b.data());
        return bDate.compareTo(aDate);
      });
    return sorted;
  }

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      stream: _postsStream(),
      builder: (context, snapshot) {
        if (snapshot.hasError) {
          _logFirestoreError(snapshot.error!);
          final error = snapshot.error;
          if (_useOrderedQuery &&
              error is FirebaseException &&
              error.code == 'failed-precondition') {
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (mounted) setState(() => _useOrderedQuery = false);
            });
            return const Center(child: CircularProgressIndicator());
          }

          return ListView(
            padding: const EdgeInsets.only(top: 8),
            children: [
              _FirestoreErrorBanner(
                message: _friendlyFirestoreError(error),
              ),
            ],
          );
        }

        if (!snapshot.hasData) {
          return const Center(child: CircularProgressIndicator());
        }

        final docs = _sortPosts(snapshot.data!.docs);

        if (docs.isEmpty) {
          return const Center(child: Text('Henüz paylaşım yok.'));
        }

        return ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: docs.length,
          separatorBuilder: (_, _) => const SizedBox(height: 12),
          itemBuilder: (context, index) {
            final data = docs[index].data();
            final text = _pickPostText(data);
            final hashtags = _pickPostHashtags(data);
            final createdAt = _pickPostDate(data);

            return _ClubPostFeedCard(
              clubName: widget.clubName,
              logoKey: widget.logoKey,
              logoUrl: widget.logoUrl,
              text: text,
              hashtags: hashtags,
              createdAt: createdAt,
            );
          },
        );
      },
    );
  }
}

class _ClubPostFeedCard extends StatelessWidget {
  const _ClubPostFeedCard({
    required this.clubName,
    this.logoKey,
    required this.logoUrl,
    required this.text,
    required this.hashtags,
    required this.createdAt,
  });

  final String clubName;
  final String? logoKey;
  final String logoUrl;
  final String text;
  final List<String> hashtags;
  final DateTime createdAt;

  @override
  Widget build(BuildContext context) {
    final displayText = text.isEmpty ? '(Paylaşım metni yok)' : text;
    final showDate = createdAt.millisecondsSinceEpoch > 0;

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ClubLogoAvatar(
                name: clubName,
                logoKey: logoKey,
                logoUrl: logoUrl.isEmpty ? null : logoUrl,
                size: 40,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      clubName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        height: 1.2,
                      ),
                    ),
                    if (showDate) ...[
                      const SizedBox(height: 2),
                      Text(
                        _formatDate(createdAt),
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          fontSize: 11,
                          color: AppTheme.textSecondary,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            displayText,
            maxLines: 5,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              height: 1.45,
            ),
          ),
          if (hashtags.isNotEmpty) ...[
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: hashtags
                  .map((tag) => TagChip(label: tag, compact: true))
                  .toList(),
            ),
          ],
          const SizedBox(height: 12),
          const Divider(height: 1, thickness: 1, color: AppTheme.border),
          Row(
            children: [
              Expanded(
                child: TextButton.icon(
                  onPressed: null,
                  icon: Icon(
                    Icons.thumb_up_outlined,
                    size: 18,
                    color: AppTheme.textSecondary.withValues(alpha: 0.7),
                  ),
                  label: Text(
                    'Beğen',
                    style: Theme.of(context).textTheme.labelLarge?.copyWith(
                      color: AppTheme.textSecondary.withValues(alpha: 0.7),
                    ),
                  ),
                ),
              ),
              Expanded(
                child: TextButton.icon(
                  onPressed: null,
                  icon: Icon(
                    Icons.chat_bubble_outline,
                    size: 18,
                    color: AppTheme.textSecondary.withValues(alpha: 0.7),
                  ),
                  label: Text(
                    'Yorumla',
                    style: Theme.of(context).textTheme.labelLarge?.copyWith(
                      color: AppTheme.textSecondary.withValues(alpha: 0.7),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

String _pickPostText(Map<String, dynamic> data) {
  return _asString(
    data['text'] ?? data['metin'] ?? data['icerik'] ?? data['topic'],
  );
}

List<String> _pickPostHashtags(Map<String, dynamic> data) {
  for (final key in const ['hashtags', 'tags', 'Etiketler', 'etiketler']) {
    final value = data[key];
    if (value is List) {
      return value
          .map((item) => item.toString().trim())
          .where((item) => item.isNotEmpty)
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
  return const [];
}

String _clubName(Map<String, dynamic> data, String fallback) {
  final title = _asString(data['name'] ?? data['title']);
  return title.isEmpty ? fallback : title;
}

String _clubBio(Map<String, dynamic> data) {
  return _asString(data['bio']);
}

String _clubHandle(Map<String, dynamic> data, String clubId, String name) {
  final raw = _asString(data['handle'] ?? data['slug']);
  if (raw.isNotEmpty) {
    return raw.startsWith('@') ? raw : '@$raw';
  }

  final base = name.isNotEmpty ? name : clubId;
  final slug = base
      .toLowerCase()
      .replaceAll(RegExp(r'[^a-z0-9]+'), '-')
      .replaceAll(RegExp(r'-+'), '-')
      .replaceAll(RegExp(r'^-|-$'), '');
  return '@${slug.isEmpty ? clubId : slug}';
}

_ClubSocialLinks _pickSocialLinks(Map<String, dynamic> data) {
  return _ClubSocialLinks(
    instagram: _asString(data['instagram'] ?? data['instagramUrl']),
    linkedin: _asString(data['linkedin'] ?? data['linkedinUrl']),
    website: _asString(data['website'] ?? data['web'] ?? data['websiteUrl']),
  );
}

DateTime _pickPostDate(Map<String, dynamic> data) {
  final value = data['createdAt'] ?? data['olusturulduAt'];
  if (value is Timestamp) return value.toDate();
  if (value is DateTime) return value;
  return DateTime.fromMillisecondsSinceEpoch(0);
}

String _asString(Object? value) => value?.toString().trim() ?? '';

List<String> _pickTags(Map<String, dynamic> data) {
  final value = data['tags'];
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

String _formatDate(DateTime value) {
  final day = value.day.toString().padLeft(2, '0');
  final month = value.month.toString().padLeft(2, '0');
  final hour = value.hour.toString().padLeft(2, '0');
  final minute = value.minute.toString().padLeft(2, '0');
  return '$day.$month.${value.year} $hour:$minute';
}
