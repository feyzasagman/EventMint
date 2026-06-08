import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';

import '../navigation/club_admin_navigation.dart';
import '../services/club_repo.dart';
import '../services/user_record_service.dart';
import '../widgets/primary_button.dart';
import '../widgets/secondary_button.dart';

class AdminEventsScreen extends StatelessWidget {
  const AdminEventsScreen({
    super.key,
    required this.role,
    required this.clubId,
  });

  final String role;
  final String clubId;

  bool get _isAdmin => isAdminRole(role);

  Future<void> _deleteEvent(BuildContext context, String eventId) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Etkinlik silinsin mi?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('İptal')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Sil')),
        ],
      ),
    );
    if (confirmed != true) return;

    try {
      await ClubRepo.col(ClubRepo.events).doc(eventId).delete();
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Etkinlik silindi')),
        );
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Silinemedi: $e')),
        );
      }
    }
  }

  Future<void> _setStatus(BuildContext context, String eventId, String status) async {
    try {
      await ClubRepo.col(ClubRepo.events).doc(eventId).update({'status': status});
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(status == 'published' ? 'Yayınlandı' : 'Taslak yapıldı')),
        );
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Güncellenemedi: $e')),
        );
      }
    }
  }

  Future<String?> _pickClub(BuildContext context) async {
    final snapshot = await ClubRepo.col(ClubRepo.clubs).get();
    final clubs = snapshot.docs;
    if (!context.mounted) return null;
    if (clubs.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Önce bir kulüp oluşturun.')),
      );
      return null;
    }

    return showDialog<String>(
      context: context,
      builder: (context) => SimpleDialog(
        title: const Text('Kulüp seç'),
        children: clubs.map((doc) {
          final data = doc.data();
          final name = (data['name'] ?? doc.id).toString();
          return SimpleDialogOption(
            onPressed: () => Navigator.pop(context, doc.id),
            child: Text(name),
          );
        }).toList(),
      ),
    );
  }

  Future<void> _openCreate(BuildContext context) async {
    var targetClubId = clubId;
    if (targetClubId.isEmpty) {
      targetClubId = await _pickClub(context) ?? '';
    }
    if (targetClubId.isEmpty) {
      if (context.mounted && !_isAdmin) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Kulüp ataması gerekli.')),
        );
      }
      return;
    }
    if (!context.mounted) return;
    navigateClubAdminRoute(
      context,
      route: ClubAdminRoutes.eventCreate,
      clubId: targetClubId,
    );
  }

  bool _canManageEvent(Map<String, dynamic> data) {
    if (_isAdmin) return true;
    final eventClubId = (data['clubId'] ?? '').toString();
    return clubId.isNotEmpty && eventClubId == clubId;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Etkinlik Yönetimi')),
      floatingActionButton: isStaffRole(role)
          ? FloatingActionButton(
              onPressed: () => _openCreate(context),
              child: const Icon(Icons.add),
            )
          : null,
      body: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
        stream: ClubRepo.col(ClubRepo.events).snapshots(),
        builder: (context, snapshot) {
          if (snapshot.hasError) {
            return Center(child: Text('Hata: ${snapshot.error}'));
          }
          if (!snapshot.hasData) {
            return const Center(child: CircularProgressIndicator());
          }

          final docs = snapshot.data!.docs.where((doc) => _canManageEvent(doc.data())).toList()
            ..sort((a, b) {
              final aTime = a.data()['createdAt'];
              final bTime = b.data()['createdAt'];
              if (aTime is Timestamp && bTime is Timestamp) {
                return bTime.compareTo(aTime);
              }
              return 0;
            });

          if (docs.isEmpty) {
            return const Center(child: Text('Yönetilecek etkinlik yok.'));
          }

          return ListView.separated(
            padding: const EdgeInsets.all(12),
            itemCount: docs.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (context, index) {
              final doc = docs[index];
              final data = doc.data();
              final title = (data['title'] ?? 'Etkinlik').toString();
              final status = (data['status'] ?? 'draft').toString();
              final eventClubId = (data['clubId'] ?? '-').toString();
              final isPublished = status == 'published';

              return Card(
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(title, style: Theme.of(context).textTheme.titleSmall),
                      const SizedBox(height: 4),
                      Text('Kulüp: $eventClubId • Durum: $status'),
                      const SizedBox(height: 12),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          if (!isPublished)
                            PrimaryButton(
                              label: 'Yayınla',
                              compact: true,
                              onPressed: () => _setStatus(context, doc.id, 'published'),
                            ),
                          if (isPublished)
                            SecondaryButton(
                              label: 'Taslağa al',
                              compact: true,
                              onPressed: () => _setStatus(context, doc.id, 'draft'),
                            ),
                          SecondaryButton(
                            label: 'Sil',
                            compact: true,
                            onPressed: () => _deleteEvent(context, doc.id),
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
      ),
    );
  }
}
