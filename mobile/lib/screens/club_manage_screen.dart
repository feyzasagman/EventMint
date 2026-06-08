import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

import '../services/badge_service.dart';
import '../services/club_repo.dart';
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

class ClubManageScreen extends StatefulWidget {
  const ClubManageScreen({
    super.key,
    required this.clubId,
    this.initialTabIndex = 0,
    this.scrollToPostSection = false,
  });

  final String clubId;
  final int initialTabIndex;
  final bool scrollToPostSection;

  @override
  State<ClubManageScreen> createState() => _ClubManageScreenState();
}

class _ClubManageScreenState extends State<ClubManageScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _tagsController = TextEditingController();
  final _announcementController = TextEditingController();
  final _postSectionKey = GlobalKey();

  bool _loading = true;
  bool _saving = false;
  bool _sharing = false;
  String _clubName = '';
  String? _error;

  DocumentReference<Map<String, dynamic>> get _clubRef =>
      ClubRepo.clubDoc(widget.clubId);
  @override
  void initState() {
    super.initState();
    _loadClub();
  }

  void _scrollToPostSectionIfNeeded() {
    if (!widget.scrollToPostSection || _loading) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final targetContext = _postSectionKey.currentContext;
      if (targetContext != null) {
        Scrollable.ensureVisible(
          targetContext,
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  void dispose() {
    _nameController.dispose();
    _descriptionController.dispose();
    _tagsController.dispose();
    _announcementController.dispose();
    super.dispose();
  }

  Future<void> _loadClub() async {
    try {
      final snapshot = await _clubRef.get();
      final data = snapshot.data() ?? <String, dynamic>{};
      _nameController.text = _asString(data['name'] ?? data['ad']);
      _clubName = _nameController.text.isEmpty
          ? widget.clubId
          : _nameController.text;
      _descriptionController.text = _asString(data['bio'] ?? data['aciklama']);
      _tagsController.text = _pickTags(data).join(', ');
    } on FirebaseException catch (e, st) {
      _logFirestoreError(e, st);
      _error = 'Kulüp bilgisi alınamadı: ${e.message ?? e.code}';
    } catch (e, st) {
      _logFirestoreError(e, st);
      _error = 'Kulüp bilgisi alınamadı: $e';
    } finally {
      if (mounted) {
        setState(() => _loading = false);
        _scrollToPostSectionIfNeeded();
      }
    }
  }

  Future<void> _saveClub() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _saving = true;
      _error = null;
    });

    try {
      final name = _nameController.text.trim();
      await _clubRef.set({
        'name': name,
        'bio': _descriptionController.text.trim(),
        'tags': _tagsController.text
            .split(',')
            .map((tag) => tag.trim())
            .where((tag) => tag.isNotEmpty)
            .toList(),
      }, SetOptions(merge: true));

      if (!mounted) return;
      setState(() => _clubName = name);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Kulüp güncellendi')));
    } on FirebaseException catch (e, st) {
      _logFirestoreError(e, st);
      setState(() => _error = 'Kaydedilemedi: ${e.message ?? e.code}');
    } catch (e, st) {
      _logFirestoreError(e, st);
      setState(() => _error = 'Kaydedilemedi: $e');
    } finally {
      if (mounted) {
        setState(() => _saving = false);
      }
    }
  }

  Future<void> _shareAnnouncement() async {
    final user = FirebaseAuth.instance.currentUser;
    final text = _announcementController.text.trim();
    if (user == null || text.isEmpty) return;

    setState(() => _sharing = true);

    try {
      ClubRepo.logCollection(ClubRepo.clubPosts, op: 'create');
      final ref = ClubRepo.col(ClubRepo.clubPosts).doc();
      await ref.set({
        'clubId': widget.clubId,
        'uid': user.uid,
        'text': text,
        'createdAt': FieldValue.serverTimestamp(),
      });

      _announcementController.clear();
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Paylaşıldı')));
    } on FirebaseException catch (e, st) {
      _logFirestoreError(e, st);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Paylaşılamadı: ${e.message ?? e.code}')),
      );
    } catch (e, st) {
      _logFirestoreError(e, st);
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Paylaşılamadı: $e')));
    } finally {
      if (mounted) {
        setState(() => _sharing = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 3,
      initialIndex: widget.initialTabIndex.clamp(0, 2),
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Kulüp Yönetimi'),
          bottom: const TabBar(
            tabs: [
              Tab(text: 'Kulüp & Paylaşım'),
              Tab(text: 'Başvurular'),
              Tab(text: 'Üyeler'),
            ],
          ),
        ),
        body: _loading
            ? const Center(child: CircularProgressIndicator())
            : TabBarView(
                children: [
                  _ShareTab(
                    clubId: widget.clubId,
                    clubName: _clubName,
                    formKey: _formKey,
                    nameController: _nameController,
                    descriptionController: _descriptionController,
                    tagsController: _tagsController,
                    announcementController: _announcementController,
                    postSectionKey: _postSectionKey,
                    error: _error,
                    saving: _saving,
                    sharing: _sharing,
                    onSaveClub: _saveClub,
                    onShareAnnouncement: _shareAnnouncement,
                  ),
                  _MembershipApplicationsTab(clubId: widget.clubId),
                  _ClubMembersTab(clubId: widget.clubId),
                ],
              ),
      ),
    );
  }
}

class _ShareTab extends StatelessWidget {
  const _ShareTab({
    required this.clubId,
    required this.clubName,
    required this.formKey,
    required this.nameController,
    required this.descriptionController,
    required this.tagsController,
    required this.announcementController,
    required this.postSectionKey,
    required this.error,
    required this.saving,
    required this.sharing,
    required this.onSaveClub,
    required this.onShareAnnouncement,
  });

  final String clubId;
  final String clubName;
  final GlobalKey<FormState> formKey;
  final TextEditingController nameController;
  final TextEditingController descriptionController;
  final TextEditingController tagsController;
  final TextEditingController announcementController;
  final Key postSectionKey;
  final String? error;
  final bool saving;
  final bool sharing;
  final VoidCallback onSaveClub;
  final VoidCallback onShareAnnouncement;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(
          'Kulüp Yönetimi',
          style: Theme.of(
            context,
          ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 4),
        Text(clubName.isEmpty ? clubId : clubName),
        const SizedBox(height: 16),
        Form(
          key: formKey,
          child: Column(
            children: [
              TextFormField(
                controller: nameController,
                decoration: const InputDecoration(
                  labelText: 'Kulüp adı',
                  border: OutlineInputBorder(),
                ),
                validator: (value) {
                  if (value == null || value.trim().isEmpty) {
                    return 'Kulüp adı zorunlu.';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: descriptionController,
                minLines: 3,
                maxLines: 5,
                decoration: const InputDecoration(
                  labelText: 'Açıklama',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: tagsController,
                decoration: const InputDecoration(
                  labelText: 'Etiketler',
                  hintText: 'robotik, yazılım',
                  border: OutlineInputBorder(),
                ),
              ),
              if (error != null) ...[
                const SizedBox(height: 12),
                Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    error!,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.error,
                    ),
                  ),
                ),
              ],
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: saving ? null : onSaveClub,
                  icon: const Icon(Icons.save),
                  label: Text(saving ? 'Kaydediliyor...' : 'Kaydet'),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 28),
        KeyedSubtree(
          key: postSectionKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Duyuru Paylaş',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 8),
              TextField(
                controller: announcementController,
                minLines: 3,
                maxLines: 6,
                decoration: const InputDecoration(
                  hintText: 'Duyuru metni',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: sharing ? null : onShareAnnouncement,
                  icon: const Icon(Icons.campaign),
                  label: Text(sharing ? 'Paylaşılıyor...' : 'Paylaş'),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _MembershipApplicationsTab extends StatelessWidget {
  const _MembershipApplicationsTab({required this.clubId});

  final String clubId;

  Future<void> _approveApplication(
    BuildContext context,
    QueryDocumentSnapshot<Map<String, dynamic>> doc,
  ) async {
    final currentUid = FirebaseAuth.instance.currentUser?.uid;
    if (currentUid == null) return;

    final data = doc.data();
    final applicantUid = _asString(data['uid']);
    if (applicantUid.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Başvuruda uid bulunamadı.')),
      );
      return;
    }

    final batch = FirebaseFirestore.instance.batch();
    batch.update(doc.reference, {
      'status': 'approved',
      'reviewedAt': FieldValue.serverTimestamp(),
      'reviewedByUid': currentUid,
    });
    batch.set(
      ClubRepo.clubMemberDoc(clubId, applicantUid),
      {
        'clubId': clubId,
        'uid': applicantUid,
        'joinedAt': FieldValue.serverTimestamp(),
        'role': 'member',
        if (_asString(data['adSoyad'] ?? data['fullName']).isNotEmpty)
          'displayName': _asString(data['adSoyad'] ?? data['fullName']),
      },
    );

    try {
      await batch.commit();
      final newBadges = await awardClubMemberBadge(applicantUid);
      if (!context.mounted) return;
      final message = newBadges.isEmpty
          ? 'Başvuru onaylandı.'
          : 'Başvuru onaylandı • Yeni rozet: ${newBadges.join(', ')}';
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(message)));
    } on FirebaseException catch (e, st) {
      _logFirestoreError(e, st);
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Onaylanamadı: ${e.message ?? e.code}')),
      );
    } catch (e, st) {
      _logFirestoreError(e, st);
      if (!context.mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Onaylanamadı: $e')));
    }
  }

  Future<void> _rejectApplication(
    BuildContext context,
    QueryDocumentSnapshot<Map<String, dynamic>> doc,
  ) async {
    final currentUid = FirebaseAuth.instance.currentUser?.uid;
    if (currentUid == null) return;

    try {
      await doc.reference.update({
        'status': 'rejected',
        'reviewedAt': FieldValue.serverTimestamp(),
        'reviewedByUid': currentUid,
      });

      if (!context.mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Başvuru reddedildi.')));
    } on FirebaseException catch (e, st) {
      _logFirestoreError(e, st);
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Reddedilemedi: ${e.message ?? e.code}')),
      );
    } catch (e, st) {
      _logFirestoreError(e, st);
      if (!context.mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Reddedilemedi: $e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    ClubRepo.logCollection(ClubRepo.clubApplications, op: 'listPending:$clubId');
    final stream = ClubRepo.col(ClubRepo.clubApplications)
        .where('clubId', isEqualTo: clubId)
        .snapshots();

    return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      stream: stream,
      builder: (context, snapshot) {
        if (snapshot.hasError) {
          _logFirestoreError(snapshot.error!);
          return Center(
            child: Text(
              'Başvurular alınamadı: ${_firestoreErrorText(snapshot.error)}',
            ),
          );
        }

        if (!snapshot.hasData) {
          return const Center(child: CircularProgressIndicator());
        }

        final docs = snapshot.data!.docs
            .where((doc) {
              final status = _asString(doc.data()['status']).toLowerCase();
              return status == 'pending';
            })
            .toList()
          ..sort((a, b) {
            final aDate = a.data()['olusturulduAt'] ?? a.data()['createdAt'];
            final bDate = b.data()['olusturulduAt'] ?? b.data()['createdAt'];
            final aMs = aDate is Timestamp ? aDate.millisecondsSinceEpoch : 0;
            final bMs = bDate is Timestamp ? bDate.millisecondsSinceEpoch : 0;
            return bMs.compareTo(aMs);
          });

        if (docs.isEmpty) {
          return const Center(child: Text('Bekleyen başvuru yok.'));
        }

        return ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: docs.length,
          separatorBuilder: (context, index) => const SizedBox(height: 12),
          itemBuilder: (context, index) {
            final doc = docs[index];
            final data = doc.data();
            final fullName = _asString(data['fullName'] ?? data['adSoyad']);
            final department = _asString(data['department'] ?? data['bolum']);
            final studentNo = _asString(data['studentNo'] ?? data['ogrNo']);
            final motivation = _asString(data['motivation'] ?? data['motivasyon']);
            final createdAt = data['createdAt'];

            return Card(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      fullName.isEmpty ? 'İsimsiz başvuru' : fullName,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    if (department.isNotEmpty) Text('Bölüm: $department'),
                    if (studentNo.isNotEmpty) Text('Öğrenci No: $studentNo'),
                    if (motivation.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Text(motivation),
                    ],
                    if (createdAt is Timestamp) ...[
                      const SizedBox(height: 8),
                      Text(
                        'Başvuru: ${_formatTimestamp(createdAt)}',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: FilledButton(
                            onPressed: () => _approveApplication(context, doc),
                            child: const Text('Onayla'),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: OutlinedButton(
                            onPressed: () => _rejectApplication(context, doc),
                            child: const Text('Reddet'),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }
}

class _ClubMembersTab extends StatelessWidget {
  const _ClubMembersTab({required this.clubId});

  final String clubId;

  @override
  Widget build(BuildContext context) {
    ClubRepo.logCollection(ClubRepo.clubMembers, op: 'listMembers:$clubId');
    final stream = ClubRepo.col(ClubRepo.clubMembers)
        .where('clubId', isEqualTo: clubId)
        .snapshots();

    return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      stream: stream,
      builder: (context, snapshot) {
        if (snapshot.hasError) {
          _logFirestoreError(snapshot.error!);
          return Center(
            child: Text(
              'Üyeler alınamadı: ${_firestoreErrorText(snapshot.error)}',
            ),
          );
        }

        if (!snapshot.hasData) {
          return const Center(child: CircularProgressIndicator());
        }

        final docs = snapshot.data!.docs.toList()
          ..sort((a, b) {
            final aDate = a.data()['joinedAt'];
            final bDate = b.data()['joinedAt'];
            final aMs = aDate is Timestamp ? aDate.millisecondsSinceEpoch : 0;
            final bMs = bDate is Timestamp ? bDate.millisecondsSinceEpoch : 0;
            return bMs.compareTo(aMs);
          });

        if (docs.isEmpty) {
          return const Center(child: Text('Henüz onaylı üye yok.'));
        }

        return ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: docs.length,
          separatorBuilder: (_, __) => const SizedBox(height: 12),
          itemBuilder: (context, index) {
            final data = docs[index].data();
            final displayName = _asString(
              data['displayName'] ?? data['adSoyad'] ?? data['name'],
            );
            final uid = _asString(data['uid']);
            final role = _asString(data['role']).isEmpty
                ? 'member'
                : _asString(data['role']);
            final joinedAt = data['joinedAt'];

            return Card(
              child: ListTile(
                title: Text(displayName.isEmpty ? (uid.isEmpty ? 'Üye' : uid) : displayName),
                subtitle: Text(
                  'Rol: $role${joinedAt is Timestamp ? ' · ${_formatTimestamp(joinedAt)}' : ''}',
                ),
              ),
            );
          },
        );
      },
    );
  }
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

String _formatTimestamp(Timestamp value) {
  final date = value.toDate();
  final day = date.day.toString().padLeft(2, '0');
  final month = date.month.toString().padLeft(2, '0');
  final hour = date.hour.toString().padLeft(2, '0');
  final minute = date.minute.toString().padLeft(2, '0');
  return '$day.$month.${date.year} $hour:$minute';
}
