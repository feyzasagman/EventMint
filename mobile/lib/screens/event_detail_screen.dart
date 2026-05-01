import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';

import 'qr_scan_screen.dart';

String pickString(Map data, List<String> keys) {
  for (final key in keys) {
    final value = data[key];
    if (value is String && value.trim().isNotEmpty) {
      return value.trim();
    }
  }
  return '';
}

List<String> pickStringList(Map data, List<String> keys) {
  for (final key in keys) {
    final value = data[key];
    if (value is List) {
      return value
          .map((item) => item.toString())
          .where((s) => s.isNotEmpty)
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
  return [];
}

class EventDetailScreen extends StatefulWidget {
  const EventDetailScreen({super.key, required this.eventId, this.data});

  final String eventId;
  final Map<String, dynamic>? data;

  @override
  State<EventDetailScreen> createState() => _EventDetailScreenState();
}

class _EventDetailScreenState extends State<EventDetailScreen> {
  Map<String, dynamic>? _eventData;
  bool? _isRsvped;
  bool _isCheckedIn = false;
  bool _isSaving = false;
  String? _error;

  String get _uid => FirebaseAuth.instance.currentUser!.uid;

  DocumentReference<Map<String, dynamic>> get _rsvpRef => FirebaseFirestore
      .instance
      .collection('rsvps')
      .doc('${widget.eventId}_$_uid');

  DocumentReference<Map<String, dynamic>> get _checkinRef => FirebaseFirestore
      .instance
      .collection('Check-in')
      .doc('${widget.eventId}_$_uid');

  DocumentReference<Map<String, dynamic>> get _userRef =>
      FirebaseFirestore.instance.collection('Kullanıcılar').doc(_uid);

  @override
  void initState() {
    super.initState();
    _eventData = widget.data;
    if (!kIsWeb) {
      _loadDetail();
    }
  }

  Future<void> _loadDetail() async {
    try {
      Map<String, dynamic>? eventData = _eventData;
      if (eventData == null) {
        final eventDoc = await FirebaseFirestore.instance
            .collection('events')
            .doc(widget.eventId)
            .get();
        eventData = eventDoc.data();
      }

      final results = await Future.wait([_rsvpRef.get(), _checkinRef.get()]);
      if (!mounted) return;

      setState(() {
        _eventData = eventData;
        _isRsvped = results[0].exists;
        _isCheckedIn = results[1].exists;
        _error = eventData == null ? 'Etkinlik bulunamadı.' : null;
      });
    } catch (error) {
      if (!mounted) return;

      setState(() {
        _error = 'Detay alınamadı: $error';
        _isRsvped = false;
      });
    }
  }

  Future<void> _saveRsvp() async {
    if (_isRsvped == true) {
      _showSnackBar('Zaten kayıtlısın');
      return;
    }

    setState(() => _isSaving = true);
    try {
      await _rsvpRef.set({
        'eventId': widget.eventId,
        'uid': _uid,
        'createdAt': FieldValue.serverTimestamp(),
      }, SetOptions(merge: true));

      if (!mounted) return;

      setState(() {
        _isRsvped = true;
        _isSaving = false;
      });
      _showSnackBar('RSVP kaydedildi');
    } catch (error) {
      if (!mounted) return;

      setState(() => _isSaving = false);
      _showSnackBar('RSVP kaydedilemedi: $error');
    }
  }

  Future<void> _openQrScanner() async {
    final result = await Navigator.of(context).push<CheckinRewardResult>(
      MaterialPageRoute(builder: (_) => const QRScanScreen()),
    );

    if (!mounted) return;

    if (result != null) {
      setState(() => _isCheckedIn = true);
      final badgeMessage = result.newBadgeLabels.isEmpty
          ? null
          : 'Yeni rozet: ${result.newBadgeLabels.join(', ')}';
      final message = result.pointsUpdated
          ? badgeMessage ?? 'Check-in başarılı ✅ +10 puan kazandın'
          : 'Puan güncellenemedi';
      _showSnackBar(message);
    }
  }

  void _showSnackBar(String message) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    if (kIsWeb) {
      return Scaffold(
        appBar: AppBar(title: const Text('Etkinlik Detayı')),
        body: const Center(
          child: Padding(
            padding: EdgeInsets.all(16),
            child: Text('Web demo modu'),
          ),
        ),
      );
    }

    final data = _eventData;

    return Scaffold(
      appBar: AppBar(title: const Text('Etkinlik Detayı')),
      body: _error != null
          ? Center(child: Text(_error!))
          : data == null || _isRsvped == null
          ? const Center(child: CircularProgressIndicator())
          : _DetailContent(
              data: data,
              userRef: _userRef,
              isRsvped: _isRsvped!,
              isCheckedIn: _isCheckedIn,
              isSaving: _isSaving,
              onRsvp: _saveRsvp,
              onQrScan: _openQrScanner,
            ),
    );
  }
}

class _DetailContent extends StatelessWidget {
  const _DetailContent({
    required this.data,
    required this.userRef,
    required this.isRsvped,
    required this.isCheckedIn,
    required this.isSaving,
    required this.onRsvp,
    required this.onQrScan,
  });

  final Map<String, dynamic> data;
  final DocumentReference<Map<String, dynamic>> userRef;
  final bool isRsvped;
  final bool isCheckedIn;
  final bool isSaving;
  final VoidCallback onRsvp;
  final VoidCallback onQrScan;

  @override
  Widget build(BuildContext context) {
    final titleRaw = pickString(data, const [
      'title',
      'Baslik',
      'başlık',
      'baslik',
    ]);
    final title = titleRaw.isEmpty ? '(Başlık yok)' : titleRaw;
    final clubIdRaw = pickString(data, const ['clubId', 'Kulup', 'kulup']);
    final clubId = clubIdRaw.isEmpty ? '-' : clubIdRaw;
    final categoryRaw = pickString(data, const [
      'category',
      'Kategori',
      'kategori',
    ]);
    final category = categoryRaw.isEmpty ? '-' : categoryRaw;
    final locationRaw = pickString(data, const ['location', 'Konum', 'konum']);
    final location = locationRaw.isEmpty ? '-' : locationRaw;
    final descriptionRaw = pickString(data, const [
      'description',
      'Açıklama',
      'aciklama',
      'açıklama',
    ]);
    final description = descriptionRaw.isEmpty ? '-' : descriptionRaw;
    final tags = pickStringList(data, const ['tags', 'Etiketler', 'etiketler']);

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(title, style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 16),
        _InfoRow(label: 'Kulüp', value: clubId),
        _InfoRow(label: 'Kategori', value: category),
        _InfoRow(label: 'Konum', value: location),
        StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
          stream: userRef.snapshots(),
          builder: (context, snapshot) {
            final points = snapshot.data?.data()?['pointsTotal'];
            final pointsTotal = points is num ? points.toInt() : 0;

            return Text('Puanın: $pointsTotal');
          },
        ),
        const SizedBox(height: 16),
        Text('Açıklama', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 6),
        Text(description),
        if (tags.isNotEmpty) ...[
          const SizedBox(height: 16),
          Text('Etiketler', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 6),
          Wrap(
            spacing: 6,
            runSpacing: 4,
            children: tags
                .map(
                  (tag) => Chip(
                    label: Text(tag),
                    visualDensity: VisualDensity.compact,
                    materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                )
                .toList(),
          ),
        ],
        const SizedBox(height: 24),
        FilledButton(
          onPressed: isRsvped || isSaving ? null : onRsvp,
          child: Text(
            isRsvped
                ? 'Katılıyorsun ✅'
                : isSaving
                ? 'Kaydediliyor...'
                : 'Katılacağım (RSVP)',
          ),
        ),
        const SizedBox(height: 12),
        OutlinedButton.icon(
          onPressed: onQrScan,
          icon: const Icon(Icons.qr_code_scanner),
          label: const Text('QR ile Katılım'),
        ),
        if (isCheckedIn) ...[
          const SizedBox(height: 8),
          const Text(
            'Check-in yapıldı ✅',
            style: TextStyle(color: Colors.green, fontWeight: FontWeight.w600),
          ),
        ],
      ],
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 84,
            child: Text(
              '$label:',
              style: Theme.of(
                context,
              ).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
            ),
          ),
          Expanded(child: Text(value)),
        ],
      ),
    );
  }
}
