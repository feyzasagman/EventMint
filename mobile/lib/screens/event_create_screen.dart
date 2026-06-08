import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';

import '../services/event_ai_service.dart';
import '../services/club_repo.dart';
import '../theme/app_theme.dart';
import '../widgets/primary_button.dart';
import '../widgets/tag_chip.dart';

class EventCreateScreen extends StatefulWidget {
  const EventCreateScreen({super.key, required this.clubId});

  final String clubId;

  @override
  State<EventCreateScreen> createState() => _EventCreateScreenState();
}

class _EventCreateScreenState extends State<EventCreateScreen> {
  final _titleController = TextEditingController();
  final _categoryController = TextEditingController();
  final _locationController = TextEditingController();
  final _descriptionController = TextEditingController();

  final List<String> _tags = [];
  String? _aiLoading;
  String? _aiError;

  @override
  void dispose() {
    _titleController.dispose();
    _categoryController.dispose();
    _locationController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _runAi(String action, String label) async {
    setState(() {
      _aiLoading = action;
      _aiError = null;
    });

    try {
      final result = await callEventAi(
        action: action,
        title: _titleController.text.trim(),
        category: _categoryController.text.trim(),
        location: _locationController.text.trim(),
        description: _descriptionController.text.trim(),
        tags: _tags,
      );

      if (!mounted) return;

      if (action == 'fill') {
        if (_titleController.text.trim().isEmpty && result.title.isNotEmpty) {
          _titleController.text = result.title;
        }
        if (_categoryController.text.trim().isEmpty && result.category.isNotEmpty) {
          _categoryController.text = result.category;
        }
        if (_locationController.text.trim().isEmpty && result.location.isNotEmpty) {
          _locationController.text = result.location;
        }
        if (_descriptionController.text.trim().isEmpty && result.description.isNotEmpty) {
          _descriptionController.text = result.description;
        }
      } else if (action == 'suggest_tags') {
        if (_categoryController.text.trim().isEmpty && result.category.isNotEmpty) {
          _categoryController.text = result.category;
        }
      } else if (action == 'improve_description' && result.description.isNotEmpty) {
        _descriptionController.text = result.description;
      }

      if (result.tags.isNotEmpty) {
        for (final tag in result.tags) {
          if (!_tags.contains(tag)) _tags.add(tag);
        }
      }

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('$label tamamlandı')),
      );
    } on EventAiException catch (e) {
      if (!mounted) return;
      setState(() => _aiError = e.message);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.message)),
      );
    } finally {
      if (mounted) setState(() => _aiLoading = null);
    }
  }

  bool _saving = false;

  Future<void> _saveEvent(String status) async {
    final title = _titleController.text.trim();
    if (title.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Başlık gerekli')),
      );
      return;
    }

    setState(() => _saving = true);
    try {
      await ClubRepo.col(ClubRepo.events).add({
        'title': title,
        'clubId': widget.clubId,
        'category': _categoryController.text.trim(),
        'location': _locationController.text.trim(),
        'description': _descriptionController.text.trim(),
        'tags': _tags,
        'status': status,
        'createdAt': FieldValue.serverTimestamp(),
      });
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(status == 'published' ? 'Etkinlik yayınlandı' : 'Taslak kaydedildi')),
      );
      Navigator.of(context).pop();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Kaydedilemedi: $e')),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final aiBusy = _aiLoading != null;
    final hasInput = _titleController.text.trim().isNotEmpty ||
        _descriptionController.text.trim().isNotEmpty;

    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        title: const Text('Etkinlik Ekle'),
        backgroundColor: AppTheme.background,
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              PrimaryButton(
                label: aiBusy && _aiLoading == 'fill' ? 'Dolduruluyor...' : 'AI ile doldur',
                icon: Icons.auto_awesome,
                onPressed: aiBusy || !hasInput ? null : () => _runAi('fill', 'AI ile doldur'),
              ),
              PrimaryButton(
                label: aiBusy && _aiLoading == 'suggest_tags'
                    ? 'Öneriliyor...'
                    : 'Etiket+Kategori öner',
                icon: Icons.label_outline,
                onPressed: aiBusy || !hasInput
                    ? null
                    : () => _runAi('suggest_tags', 'Etiket+Kategori öner'),
              ),
              PrimaryButton(
                label: aiBusy && _aiLoading == 'improve_description'
                    ? 'İyileştiriliyor...'
                    : 'Açıklamayı iyileştir',
                icon: Icons.edit_note,
                onPressed: aiBusy || _descriptionController.text.trim().isEmpty
                    ? null
                    : () => _runAi('improve_description', 'Açıklamayı iyileştir'),
              ),
            ],
          ),
          if (_aiError != null) ...[
            const SizedBox(height: 12),
            Text(
              _aiError!,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          ],
          const SizedBox(height: 16),
          TextField(
            controller: _titleController,
            decoration: const InputDecoration(labelText: 'Başlık'),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _categoryController,
            decoration: const InputDecoration(labelText: 'Kategori'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _locationController,
            decoration: const InputDecoration(labelText: 'Konum'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _descriptionController,
            decoration: const InputDecoration(labelText: 'Açıklama'),
            minLines: 3,
            maxLines: 6,
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _tags.map((tag) => TagChip(label: tag)).toList(),
          ),
          const SizedBox(height: 24),
          Row(
            children: [
              Expanded(
                child: PrimaryButton(
                  label: _saving ? 'Kaydediliyor...' : 'Taslak kaydet',
                  onPressed: _saving ? null : () => _saveEvent('draft'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: PrimaryButton(
                  label: _saving ? 'Kaydediliyor...' : 'Yayınla',
                  onPressed: _saving ? null : () => _saveEvent('published'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            'Kulüp: ${widget.clubId}',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: AppTheme.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}
