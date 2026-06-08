import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';

import '../services/club_repo.dart';
import '../services/user_record_service.dart';
import '../widgets/primary_button.dart';

class AdminManagersScreen extends StatefulWidget {
  const AdminManagersScreen({super.key});

  @override
  State<AdminManagersScreen> createState() => _AdminManagersScreenState();
}

class _AdminManagersScreenState extends State<AdminManagersScreen> {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Yöneticiler')),
      body: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
        stream: ClubRepo.col(ClubRepo.users).snapshots(),
        builder: (context, snapshot) {
          if (snapshot.hasError) {
            return Center(child: Text('Hata: ${snapshot.error}'));
          }
          if (!snapshot.hasData) {
            return const Center(child: CircularProgressIndicator());
          }

          final docs = snapshot.data!.docs.toList()
            ..retainWhere((doc) {
              final role = normalizeUserRole(doc.data());
              return role == 'admin' || role == 'club_manager';
            })
            ..sort((a, b) {
              final aEmail = (a.data()['email'] ?? '').toString();
              final bEmail = (b.data()['email'] ?? '').toString();
              return aEmail.compareTo(bEmail);
            });

          if (docs.isEmpty) {
            return const Center(child: Text('Henüz yönetici yok.'));
          }

          return ListView.separated(
            padding: const EdgeInsets.all(12),
            itemCount: docs.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (context, index) {
              final doc = docs[index];
              final data = doc.data();
              return _ManagerCard(
                uid: doc.id,
                email: (data['email'] ?? doc.id).toString(),
                role: normalizeUserRole(data),
                clubId: getUserClubId(data),
              );
            },
          );
        },
      ),
    );
  }
}

class _ManagerCard extends StatefulWidget {
  const _ManagerCard({
    required this.uid,
    required this.email,
    required this.role,
    required this.clubId,
  });

  final String uid;
  final String email;
  final String role;
  final String clubId;

  @override
  State<_ManagerCard> createState() => _ManagerCardState();
}

class _ManagerCardState extends State<_ManagerCard> {
  late TextEditingController _clubIdController;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _clubIdController = TextEditingController(text: widget.clubId);
  }

  @override
  void dispose() {
    _clubIdController.dispose();
    super.dispose();
  }

  Future<void> _assignClub() async {
    setState(() => _saving = true);
    try {
      await ClubRepo.userDoc(widget.uid).update({
        'role': 'club_manager',
        'clubId': _clubIdController.text.trim(),
      });
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Kulüp ataması güncellendi')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Güncellenemedi: $e')),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(widget.email, style: Theme.of(context).textTheme.titleSmall),
            const SizedBox(height: 4),
            Text('Rol: ${widget.role}'),
            const SizedBox(height: 8),
            TextField(
              controller: _clubIdController,
              decoration: const InputDecoration(
                labelText: 'Kulüp ID',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 8),
            PrimaryButton(
              label: _saving ? 'Kaydediliyor...' : 'Kulüp ata',
              compact: true,
              onPressed: _saving ? null : _assignClub,
            ),
          ],
        ),
      ),
    );
  }
}
