import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';

import '../services/club_repo.dart';
import '../services/user_record_service.dart';
import '../widgets/primary_button.dart';

class AdminUsersScreen extends StatefulWidget {
  const AdminUsersScreen({super.key});

  @override
  State<AdminUsersScreen> createState() => _AdminUsersScreenState();
}

class _AdminUsersScreenState extends State<AdminUsersScreen> {
  final _searchController = TextEditingController();
  String _searchQuery = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _saveUser({
    required String uid,
    required String role,
    required String clubId,
    required bool banned,
  }) async {
    await ClubRepo.userDoc(uid).update({
      'role': role,
      'clubId': role == 'club_manager' ? clubId : '',
      'banned': banned,
    });
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Kullanıcı güncellendi')),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Kullanıcılar')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: TextField(
              controller: _searchController,
              decoration: const InputDecoration(
                hintText: 'Email ara',
                prefixIcon: Icon(Icons.search),
                border: OutlineInputBorder(),
              ),
              onChanged: (value) => setState(() => _searchQuery = value.trim().toLowerCase()),
            ),
          ),
          Expanded(
            child: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
              stream: ClubRepo.col(ClubRepo.users).snapshots(),
              builder: (context, snapshot) {
                if (snapshot.hasError) {
                  return Center(child: Text('Hata: ${snapshot.error}'));
                }
                if (!snapshot.hasData) {
                  return const Center(child: CircularProgressIndicator());
                }

                final docs = snapshot.data!.docs.where((doc) {
                  if (_searchQuery.isEmpty) return true;
                  final email = (doc.data()['email'] ?? '').toString().toLowerCase();
                  return email.contains(_searchQuery);
                }).toList()
                  ..sort((a, b) {
                    final aEmail = (a.data()['email'] ?? '').toString();
                    final bEmail = (b.data()['email'] ?? '').toString();
                    return aEmail.compareTo(bEmail);
                  });

                if (docs.isEmpty) {
                  return const Center(child: Text('Kullanıcı bulunamadı.'));
                }

                return ListView.separated(
                  padding: const EdgeInsets.fromLTRB(12, 0, 12, 24),
                  itemCount: docs.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (context, index) {
                    final doc = docs[index];
                    final data = doc.data();
                    return _UserAdminCard(
                      uid: doc.id,
                      email: (data['email'] ?? doc.id).toString(),
                      role: normalizeUserRole(data),
                      clubId: getUserClubId(data),
                      banned: data['banned'] == true,
                      onSave: _saveUser,
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _UserAdminCard extends StatefulWidget {
  const _UserAdminCard({
    required this.uid,
    required this.email,
    required this.role,
    required this.clubId,
    required this.banned,
    required this.onSave,
  });

  final String uid;
  final String email;
  final String role;
  final String clubId;
  final bool banned;
  final Future<void> Function({
    required String uid,
    required String role,
    required String clubId,
    required bool banned,
  }) onSave;

  @override
  State<_UserAdminCard> createState() => _UserAdminCardState();
}

class _UserAdminCardState extends State<_UserAdminCard> {
  late String _role;
  late TextEditingController _clubIdController;
  late bool _banned;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _role = widget.role;
    _clubIdController = TextEditingController(text: widget.clubId);
    _banned = widget.banned;
  }

  @override
  void dispose() {
    _clubIdController.dispose();
    super.dispose();
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
            const SizedBox(height: 8),
            DropdownButtonFormField<String>(
              value: _role,
              decoration: const InputDecoration(labelText: 'Rol', border: OutlineInputBorder()),
              items: const [
                DropdownMenuItem(value: 'student', child: Text('Öğrenci')),
                DropdownMenuItem(value: 'club_manager', child: Text('Kulüp Yöneticisi')),
                DropdownMenuItem(value: 'admin', child: Text('Admin')),
              ],
              onChanged: (value) {
                if (value == null) return;
                setState(() => _role = value);
              },
            ),
            if (_role == 'club_manager') ...[
              const SizedBox(height: 8),
              TextField(
                controller: _clubIdController,
                decoration: const InputDecoration(
                  labelText: 'Kulüp ID',
                  border: OutlineInputBorder(),
                ),
              ),
            ],
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Askıya al'),
              value: _banned,
              onChanged: (value) => setState(() => _banned = value),
            ),
            Align(
              alignment: Alignment.centerRight,
              child: PrimaryButton(
                label: _saving ? 'Kaydediliyor...' : 'Kaydet',
                compact: true,
                onPressed: _saving
                    ? null
                    : () async {
                        setState(() => _saving = true);
                        try {
                          await widget.onSave(
                            uid: widget.uid,
                            role: _role,
                            clubId: _clubIdController.text.trim(),
                            banned: _banned,
                          );
                        } catch (e) {
                          if (!mounted) return;
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text('Kaydedilemedi: $e')),
                          );
                        } finally {
                          if (mounted) setState(() => _saving = false);
                        }
                      },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
