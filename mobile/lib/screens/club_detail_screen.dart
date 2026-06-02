import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart' show kDebugMode;
import 'package:flutter/material.dart';

import 'club_manage_screen.dart';
import '../widgets/app_card.dart';
import '../widgets/primary_button.dart';
import '../widgets/secondary_button.dart';
import '../widgets/tag_chip.dart';

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

class ClubDetailScreen extends StatelessWidget {
  const ClubDetailScreen({super.key, required this.clubId});

  final String clubId;

  @override
  Widget build(BuildContext context) {
    final rootContext = context;

    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: Text(clubId),
          bottom: const TabBar(
            tabs: [
              Tab(text: 'Bilgi'),
              Tab(text: 'Paylaşımlar'),
            ],
          ),
        ),
        body: TabBarView(
          children: [
            _ClubInfoTab(clubId: clubId, rootContext: rootContext),
            _ClubPostsTab(clubId: clubId),
          ],
        ),
      ),
    );
  }
}

class _ClubInfoTab extends StatelessWidget {
  const _ClubInfoTab({required this.clubId, required this.rootContext});

  final String clubId;
  final BuildContext rootContext;

  @override
  Widget build(BuildContext context) {
    final clubRef = FirebaseFirestore.instance
        .collection('Kulüpler')
        .doc(clubId);

    return StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
      stream: clubRef.snapshots(),
      builder: (context, snapshot) {
        if (snapshot.hasError) {
          _logFirestoreError(snapshot.error!);
          return Center(
            child: Text(
              'Kulüp alınamadı: ${_firestoreErrorText(snapshot.error)}',
            ),
          );
        }
        if (!snapshot.hasData) {
          return const Center(child: CircularProgressIndicator());
        }

        final data = snapshot.data?.data() ?? <String, dynamic>{};
        final title = _asString(data['Reklam'] ?? data['ad'] ?? clubId);
        final description = _asString(data['aciklama']);
        final tags = _pickTags(data);
        final uid = FirebaseAuth.instance.currentUser?.uid ?? '';
        final sahipUID = _asString(data['sahipUID']);
        final yoneticiUIDler = _pickStringList(data['yoneticiUIDler']);
        final isManager =
            uid.isNotEmpty && (sahipUID == uid || yoneticiUIDler.contains(uid));

        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _ClubMetricsRow(clubId: clubId, isManager: isManager),
                  const SizedBox(height: 12),
                  Text(
                    title.isEmpty ? clubId : title,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontSize: 18,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    description.isEmpty ? 'Açıklama yok.' : description,
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                  if (tags.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: tags.map((tag) => TagChip(label: tag)).toList(),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 12),
            if (isManager)
              Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  PrimaryButton(
                    label: 'Kulübü Yönet',
                    icon: Icons.settings,
                    onPressed: () {
                      Navigator.of(context).push(
                        MaterialPageRoute<void>(
                          builder: (_) => ClubManageScreen(clubId: clubId),
                        ),
                      );
                    },
                  ),
                  const SizedBox(height: 8),
                  SecondaryButton(
                    label: 'Başvuruları Yönet',
                    icon: Icons.group_add,
                    onPressed: () {
                      Navigator.of(context).push(
                        MaterialPageRoute<void>(
                          builder: (_) => ClubManageScreen(
                            clubId: clubId,
                            initialTabIndex: 1,
                          ),
                        ),
                      );
                    },
                  ),
                ],
              )
            else
              _MembershipAction(clubId: clubId, rootContext: rootContext),
            if (kDebugMode) ...[
              const SizedBox(height: 16),
              Text('uid: $uid'),
              Text('sahipUID: $sahipUID'),
              Text('yoneticiUIDler: ${yoneticiUIDler.length}'),
              Text('isManager: $isManager'),
            ],
          ],
        );
      },
    );
  }
}

class _ClubMetricsRow extends StatelessWidget {
  const _ClubMetricsRow({required this.clubId, required this.isManager});

  final String clubId;
  final bool isManager;

  @override
  Widget build(BuildContext context) {
    final membersStream = FirebaseFirestore.instance
        .collection('KulüpÜyeleri')
        .where('kulupId', isEqualTo: clubId)
        .snapshots();
    final eventsStream = FirebaseFirestore.instance
        .collection('events')
        .where('clubId', isEqualTo: clubId)
        .snapshots();
    final applicationsStream = FirebaseFirestore.instance
        .collection('KulüpBaşvuruları')
        .where('kulupId', isEqualTo: clubId)
        .snapshots();

    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
          stream: membersStream,
          builder: (context, snapshot) {
            final count = snapshot.data?.docs.length ?? 0;
            return _MetricPill(label: 'Üye: $count');
          },
        ),
        StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
          stream: eventsStream,
          builder: (context, snapshot) {
            final docs = snapshot.data?.docs ?? const [];
            final count = docs.where((doc) {
              final status = _asString(doc.data()['status']);
              return status == 'published';
            }).length;
            return _MetricPill(label: 'Etkinlik: $count');
          },
        ),
        if (isManager)
          StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
            stream: applicationsStream,
            builder: (context, snapshot) {
              final docs = snapshot.data?.docs ?? const [];
              final pendingCount = docs.where((doc) {
                final status = _asString(doc.data()['durum']);
                return status == 'beklemede';
              }).length;
              return _MetricPill(label: 'Bekleyen: $pendingCount');
            },
          ),
      ],
    );
  }
}

class _MetricPill extends StatelessWidget {
  const _MetricPill({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: scheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: scheme.outlineVariant),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
          fontSize: 12,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class _MembershipAction extends StatefulWidget {
  const _MembershipAction({required this.clubId, required this.rootContext});

  final String clubId;
  final BuildContext rootContext;

  @override
  State<_MembershipAction> createState() => _MembershipActionState();
}

class _MembershipActionState extends State<_MembershipAction> {
  bool _isSheetOpen = false;

  Future<void> _openApplySheet() async {
    if (_isSheetOpen) return;

    setState(() => _isSheetOpen = true);
    final submitted =
        await showModalBottomSheet<bool>(
          context: widget.rootContext,
          isScrollControlled: true,
          useSafeArea: true,
          showDragHandle: true,
          builder: (sheetCtx) => ClubApplySheet(clubId: widget.clubId),
        ).whenComplete(() {
          if (mounted) {
            setState(() => _isSheetOpen = false);
          }
        });

    if (submitted == true && widget.rootContext.mounted) {
      ScaffoldMessenger.of(
        widget.rootContext,
      ).showSnackBar(const SnackBar(content: Text('Başvurun alındı')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid == null) return const SizedBox.shrink();

    final membershipRef = FirebaseFirestore.instance
        .collection('KulüpÜyeleri')
        .doc('${widget.clubId}_$uid');
    final applicationRef = FirebaseFirestore.instance
        .collection('KulüpBaşvuruları')
        .doc('${widget.clubId}_$uid');

    return StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
      stream: membershipRef.snapshots(),
      builder: (context, membershipSnapshot) {
        final isMember = membershipSnapshot.data?.exists ?? false;

        return StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
          stream: applicationRef.snapshots(),
          builder: (context, applicationSnapshot) {
            final applicationData = applicationSnapshot.data?.data();
            final applicationStatus = _asString(applicationData?['durum']);
            final isPending = applicationStatus == 'beklemede';

            if (isMember) {
              return const PrimaryButton(label: 'Üyesin ✅', onPressed: null);
            }

            if (isPending) {
              return const PrimaryButton(
                label: 'Başvuru Beklemede',
                onPressed: null,
              );
            }

            return PrimaryButton(
              label: 'Üye Ol',
              icon: Icons.person_add,
              onPressed: _openApplySheet,
            );
          },
        );
      },
    );
  }
}

class ClubApplySheet extends StatefulWidget {
  const ClubApplySheet({super.key, required this.clubId});

  final String clubId;

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

    final currentUid = FirebaseAuth.instance.currentUser?.uid;
    if (currentUid == null) {
      setState(() => _error = 'Oturum bulunamadı.');
      return;
    }

    setState(() {
      _saving = true;
      _error = null;
    });

    try {
      await FirebaseFirestore.instance
          .collection('KulüpBaşvuruları')
          .doc('${widget.clubId}_$currentUid')
          .set({
            'kulupId': widget.clubId,
            'UID': currentUid,
            'adSoyad': _nameController.text.trim(),
            'bolum': _departmentController.text.trim(),
            'ogrNo': _studentNoController.text.trim(),
            'motivation': _motivationController.text.trim(),
            'durum': 'beklemede',
            'olusturulduAt': FieldValue.serverTimestamp(),
          }, SetOptions(merge: true));

      if (!mounted) return;
      Navigator.of(context).pop(true);
    } on FirebaseException catch (e, st) {
      _logFirestoreError(e, st);
      if (!mounted) return;
      setState(() => _error = 'Başvuru gönderilemedi: ${e.message ?? e.code}');
    } catch (e, st) {
      _logFirestoreError(e, st);
      if (!mounted) return;
      setState(() => _error = 'Başvuru gönderilemedi: $e');
    } finally {
      if (mounted) {
        setState(() => _saving = false);
      }
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
              style: Theme.of(
                context,
              ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _nameController,
              decoration: const InputDecoration(
                labelText: 'Ad Soyad',
                border: OutlineInputBorder(),
              ),
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
              decoration: const InputDecoration(
                labelText: 'Bölüm',
                border: OutlineInputBorder(),
              ),
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
              decoration: const InputDecoration(
                labelText: 'Öğrenci No',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _motivationController,
              minLines: 2,
              maxLines: 4,
              decoration: const InputDecoration(
                labelText: 'Motivasyon',
                border: OutlineInputBorder(),
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(
                _error!,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
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

class _ClubPostsTab extends StatelessWidget {
  const _ClubPostsTab({required this.clubId});

  final String clubId;

  @override
  Widget build(BuildContext context) {
    final stream = FirebaseFirestore.instance
        .collection('KulüpPaylasimlari')
        .where('kulupId', isEqualTo: clubId)
        .snapshots();

    return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      stream: stream,
      builder: (context, snapshot) {
        if (snapshot.hasError) {
          _logFirestoreError(snapshot.error!);
          return Center(
            child: Text(
              'Paylaşımlar alınamadı: ${_firestoreErrorText(snapshot.error)}',
            ),
          );
        }
        if (!snapshot.hasData) {
          return const Center(child: CircularProgressIndicator());
        }

        final docs = snapshot.data!.docs.toList()
          ..sort((a, b) {
            final aDate = a.data()['olusturulduAt'];
            final bDate = b.data()['olusturulduAt'];
            final aMs = aDate is Timestamp
                ? aDate.toDate().millisecondsSinceEpoch
                : 0;
            final bMs = bDate is Timestamp
                ? bDate.toDate().millisecondsSinceEpoch
                : 0;
            return bMs.compareTo(aMs);
          });

        if (docs.isEmpty) {
          return const Center(child: Text('Henüz paylaşım yok.'));
        }

        return ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: docs.length,
          separatorBuilder: (context, index) => const SizedBox(height: 12),
          itemBuilder: (context, index) {
            final data = docs[index].data();
            final text = _asString(data['metin']);
            final createdAt = data['olusturulduAt'];

            return AppCard(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Padding(
                    padding: EdgeInsets.only(top: 2),
                    child: Icon(Icons.campaign),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          text.isEmpty ? '-' : text,
                          style: Theme.of(context).textTheme.titleMedium
                              ?.copyWith(
                                fontSize: 16,
                                fontWeight: FontWeight.w600,
                              ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          '$clubId\n${_formatTimestamp(createdAt)}',
                          style: Theme.of(context).textTheme.bodySmall
                              ?.copyWith(
                                fontSize: 12,
                                color: Theme.of(
                                  context,
                                ).colorScheme.onSurfaceVariant,
                              ),
                        ),
                      ],
                    ),
                  ),
                ],
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
  final value = data['etiketler'] ?? data['Etiketler'] ?? data['tags'];
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

List<String> _pickStringList(Object? value) {
  if (value is List) {
    return value
        .map((item) => item.toString().trim())
        .where((item) => item.isNotEmpty)
        .toList();
  }
  return <String>[];
}

String _formatTimestamp(Object? value) {
  if (value is Timestamp) {
    final date = value.toDate();
    final day = date.day.toString().padLeft(2, '0');
    final month = date.month.toString().padLeft(2, '0');
    final hour = date.hour.toString().padLeft(2, '0');
    final minute = date.minute.toString().padLeft(2, '0');
    return '$day.$month.${date.year} $hour:$minute';
  }
  return '';
}
