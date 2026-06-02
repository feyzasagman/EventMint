import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart' show debugPrint, kIsWeb;
import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

class QRScanScreen extends StatefulWidget {
  const QRScanScreen({super.key});

  @override
  State<QRScanScreen> createState() => _QRScanScreenState();
}

class _QRScanScreenState extends State<QRScanScreen> {
  final MobileScannerController _controller = MobileScannerController();
  final TextEditingController _manualCodeController = TextEditingController();
  bool _isProcessing = false;
  String? _message;
  bool _isSuccess = false;

  @override
  void dispose() {
    _controller.dispose();
    _manualCodeController.dispose();
    super.dispose();
  }

  void _showScanError(String message) {
    if (!mounted) return;
    setState(() {
      _message = message;
      _isSuccess = false;
      _isProcessing = false;
    });
  }

  Future<void> _handleCode(String rawValue) async {
    if (_isProcessing) return;

    setState(() {
      _isProcessing = true;
      _message = 'QR doğrulanıyor...';
      _isSuccess = false;
    });
    await _controller.stop();

    try {
      final parts = rawValue.split('|');
      if (parts.length != 2 || parts.any((part) => part.trim().isEmpty)) {
        _showScanError('Kod formatı hatalı');
        return;
      }

      final sessionId = parts[0].trim();
      final nonce = parts[1].trim();
      final sessionDoc = await FirebaseFirestore.instance
          .collection('sessions')
          .doc(sessionId)
          .get();

      if (!sessionDoc.exists) {
        _showScanError('Geçersiz QR');
        return;
      }

      final sessionData = sessionDoc.data();
      if (sessionData == null) {
        _showScanError('Geçersiz QR');
        return;
      }

      if (sessionData['active'] != true) {
        _showScanError('Oturum kapalı');
        return;
      }

      final expiresAt = sessionData['expiresAt'];
      if (expiresAt is! Timestamp) {
        _showScanError('Geçersiz QR');
        return;
      }

      if (!expiresAt.toDate().isAfter(DateTime.now())) {
        _showScanError('Süre doldu');
        return;
      }

      if (sessionData['nonce'] != nonce) {
        _showScanError('Geçersiz QR');
        return;
      }

      final eventId = sessionData['eventId'];
      if (eventId is! String || eventId.trim().isEmpty) {
        _showScanError('Geçersiz QR');
        return;
      }

      final user = FirebaseAuth.instance.currentUser;
      if (user == null) {
        _showScanError('Oturum bulunamadı');
        return;
      }
      final uid = user.uid;
      final checkinRef = FirebaseFirestore.instance
          .collection('Check-in')
          .doc('${eventId}_$uid');
      final existingCheckin = await checkinRef.get();
      if (existingCheckin.exists) {
        _showScanError('Zaten check-in yaptın');
        return;
      }

      await checkinRef.set({
        'eventId': eventId,
        'sessionId': sessionId,
        'checkinAt': FieldValue.serverTimestamp(),
        'UID': uid,
        'uid': uid,
      });
      debugPrint('CHECKIN: saved ok, now adding points...');
      final pointsUpdated = await _addCheckinPoints(uid);
      final newBadgeLabels = <String>['İlk Katılım'];
      final reward = CheckinRewardResult(
        pointsUpdated: pointsUpdated,
        newBadgeLabels: newBadgeLabels,
      );

      if (!mounted) return;

      final badgeMessage = newBadgeLabels.isEmpty
          ? null
          : 'Yeni rozet: ${newBadgeLabels.join(', ')}';
      final successMessage = pointsUpdated
          ? badgeMessage ?? 'Check-in başarılı ✅ +10 puan kazandın'
          : 'Puan güncellenemedi';

      setState(() {
        _message = successMessage;
        _isSuccess = true;
      });
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(successMessage)));

      await Future<void>.delayed(const Duration(milliseconds: 900));
      if (mounted) {
        Navigator.of(context).pop(reward);
      }
    } on FirebaseException catch (e, st) {
      debugPrint("FIRESTORE ERROR: $e");
      debugPrint("$st");
      if (!mounted) return;

      setState(() {
        _message = 'Check-in başarısız: ${e.message ?? e.code}';
        _isSuccess = false;
        _isProcessing = false;
      });
    } catch (e, st) {
      debugPrint("CHECKIN ERROR: $e");
      debugPrint("$st");
      if (!mounted) return;

      setState(() {
        _message = 'Check-in başarısız: $e';
        _isSuccess = false;
        _isProcessing = false;
      });
    }
  }

  void _retryScan() {
    setState(() {
      _isProcessing = false;
      _message = null;
      _isSuccess = false;
    });
    _controller.start();
  }

  void _verifyManualCode() {
    final rawValue = _manualCodeController.text.trim();
    _handleCode(rawValue);
  }

  Future<bool> _addCheckinPoints(String uid) async {
    final firestore = FirebaseFirestore.instance;
    final userRef = firestore.collection('Kullanıcılar').doc(uid);

    try {
      final badgeEarnedAt = Timestamp.now();
      final userDoc = await userRef.get();
      final userData = userDoc.data() ?? <String, dynamic>{};
      final existingBadges = userData['Rozetler'];
      final existingBadgeIds = <String>{};
      if (existingBadges is List) {
        for (final badge in existingBadges) {
          if (badge is Map) {
            final id = badge['id']?.toString().trim();
            if (id != null && id.isNotEmpty) {
              existingBadgeIds.add(id);
            }
          }
        }
      }
      final shouldAddFirstAttend = !existingBadgeIds.contains('FIRST_ATTEND');
      final updateData = <String, dynamic>{
        'pointsTotal': FieldValue.increment(10),
        'lastBadgeWrite': FieldValue.serverTimestamp(),
        'debugWrite': FieldValue.serverTimestamp(),
      };
      if (shouldAddFirstAttend) {
        updateData['Rozetler'] = FieldValue.arrayUnion([
          {'id': 'FIRST_ATTEND', 'earnedAt': badgeEarnedAt},
        ]);
      }
      debugPrint('BADGE: about to write FIRST_ATTEND via userRef.set');
      debugPrint('USERREF PATH => ${userRef.path}');
      debugPrint('UID => $uid');
      await userRef.set(updateData, SetOptions(merge: true));
      debugPrint('BADGE: wrote Rozetler + lastBadgeWrite');
      debugPrint('BADGE: userRef.set completed');
      return true;
    } on FirebaseException catch (error, st) {
      debugPrint('FIRESTORE ERROR: $error');
      debugPrint('$st');
      debugPrint('Puan güncellenemedi: ${error.message ?? error.code}');
      return false;
    } catch (error, st) {
      debugPrint('BADGE ERROR: $error');
      debugPrint('$st');
      debugPrint('Puan güncellenemedi: $error');
      return false;
    }
  }

  @override
  Widget build(BuildContext context) {
    if (kIsWeb) {
      return Scaffold(
        appBar: AppBar(title: const Text('QR Tarama')),
        body: const Center(
          child: Padding(
            padding: EdgeInsets.all(16),
            child: Text('QR tarama Android’de çalışır'),
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('QR Tarama')),
      body: Column(
        children: [
          Expanded(
            child: Stack(
              fit: StackFit.expand,
              children: [
                MobileScanner(
                  controller: _controller,
                  onDetect: (capture) {
                    for (final barcode in capture.barcodes) {
                      final value = barcode.rawValue;
                      if (value != null && value.isNotEmpty) {
                        _handleCode(value);
                        break;
                      }
                    }
                  },
                ),
                Center(
                  child: Container(
                    width: 240,
                    height: 240,
                    decoration: BoxDecoration(
                      border: Border.all(color: Colors.white, width: 3),
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  _message ?? 'QR kodu kameraya göster.',
                  style: TextStyle(
                    color: _isSuccess
                        ? Colors.green
                        : _message == null
                        ? null
                        : Colors.red,
                    fontWeight: FontWeight.w600,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: _manualCodeController,
                  enabled: !_isSuccess,
                  decoration: const InputDecoration(
                    hintText: 'sessionId|nonce',
                    labelText: 'Kodu Elle Gir',
                    helperText: 'Web’den kopyala → buraya yapıştır',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 8),
                FilledButton(
                  onPressed: _isProcessing || _isSuccess
                      ? null
                      : _verifyManualCode,
                  child: const Text('Doğrula'),
                ),
                if (_message != null && !_isSuccess) ...[
                  const SizedBox(height: 12),
                  OutlinedButton(
                    onPressed: _retryScan,
                    child: const Text('Tekrar tara'),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class CheckinRewardResult {
  const CheckinRewardResult({
    required this.pointsUpdated,
    required this.newBadgeLabels,
  });

  final bool pointsUpdated;
  final List<String> newBadgeLabels;
}
