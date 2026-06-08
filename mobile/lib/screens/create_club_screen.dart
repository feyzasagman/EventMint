import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

import '../services/club_repo.dart';

class CreateClubScreen extends StatefulWidget {
  const CreateClubScreen({super.key});

  @override
  State<CreateClubScreen> createState() => _CreateClubScreenState();
}

class _CreateClubScreenState extends State<CreateClubScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _handleController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _tagsController = TextEditingController();

  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _nameController.dispose();
    _handleController.dispose();
    _descriptionController.dispose();
    _tagsController.dispose();
    super.dispose();
  }

  Future<void> _createClub() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      setState(() => _error = 'Oturum bulunamadı.');
      return;
    }

    if (!_formKey.currentState!.validate()) return;

    final handle = _handleController.text.trim().toLowerCase();
    final tags = _tagsController.text
        .split(',')
        .map((tag) => tag.trim())
        .where((tag) => tag.isNotEmpty)
        .toList();

    setState(() {
      _saving = true;
      _error = null;
    });

    try {
      final clubRef = ClubRepo.clubDoc(handle);
      final existingClub = await clubRef.get();
      if (existingClub.exists) {
        setState(() => _error = 'Bu handle kullanımda.');
        return;
      }

      await clubRef.set({
        'name': _nameController.text.trim(),
        'handle': handle,
        'bio': _descriptionController.text.trim(),
        'tags': tags,
        'status': 'pending',
        'managerUids': [user.uid],
        'createdAt': FieldValue.serverTimestamp(),
      });

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Kulüp oluşturuldu, onay bekliyor.')),
      );
      Navigator.of(context).pop();
    } catch (e) {
      setState(() => _error = 'Kulüp oluşturulamadı: $e');
    } finally {
      if (mounted) {
        setState(() => _saving = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Kulüp Oluştur')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text(
              'Yeni kulüp başvurusu',
              style: Theme.of(
                context,
              ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text(
              'Kulüp beklemede durumu ile kaydedilir. Onaylandıktan sonra listelerde görünür.',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 24),
            Form(
              key: _formKey,
              child: Column(
                children: [
                  TextFormField(
                    controller: _nameController,
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
                    controller: _handleController,
                    decoration: const InputDecoration(
                      labelText: 'Handle',
                      hintText: 'robotik',
                      border: OutlineInputBorder(),
                    ),
                    onChanged: (value) {
                      final normalized = value.toLowerCase().replaceAll(
                        ' ',
                        '',
                      );
                      if (normalized != value) {
                        _handleController.value = TextEditingValue(
                          text: normalized,
                          selection: TextSelection.collapsed(
                            offset: normalized.length,
                          ),
                        );
                      }
                    },
                    validator: (value) {
                      final handle = value?.trim() ?? '';
                      if (handle.isEmpty) return 'Handle zorunlu.';
                      if (handle != handle.toLowerCase() ||
                          handle.contains(' ')) {
                        return 'Handle küçük harf olmalı ve boşluk içermemeli.';
                      }
                      if (!RegExp(r'^[a-z0-9_-]+$').hasMatch(handle)) {
                        return 'Handle sadece küçük harf, rakam, _ veya - içerebilir.';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _descriptionController,
                    minLines: 3,
                    maxLines: 5,
                    decoration: const InputDecoration(
                      labelText: 'Açıklama',
                      border: OutlineInputBorder(),
                    ),
                    validator: (value) {
                      if (value == null || value.trim().isEmpty) {
                        return 'Açıklama zorunlu.';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _tagsController,
                    decoration: const InputDecoration(
                      labelText: 'Etiketler',
                      hintText: 'robotik, yazılım, arduino',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 12),
                    Align(
                      alignment: Alignment.centerLeft,
                      child: Text(
                        _error!,
                        style: TextStyle(
                          color: Theme.of(context).colorScheme.error,
                        ),
                      ),
                    ),
                  ],
                  const SizedBox(height: 20),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      onPressed: _saving ? null : _createClub,
                      icon: _saving
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.add_business),
                      label: Text(
                        _saving ? 'Oluşturuluyor...' : 'Kulübü Oluştur',
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
