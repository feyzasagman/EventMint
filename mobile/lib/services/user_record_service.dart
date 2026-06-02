import 'package:cloud_firestore/cloud_firestore.dart';

Future<Map<String, dynamic>?> getUserRecord(String uid) async {
  for (final collectionName in const ['users', 'Kullanıcılar']) {
    final snapshot = await FirebaseFirestore.instance
        .collection(collectionName)
        .doc(uid)
        .get();
    if (snapshot.exists) {
      return snapshot.data();
    }
  }
  return null;
}

String getRole(Map<dynamic, dynamic> data) {
  final raw = (data['role'] ?? data['Rol'] ?? 'öğrenci')
      .toString()
      .trim()
      .toLowerCase();
  if (raw == 'admin') return 'admin';
  if (raw == 'club_manager' || raw == 'kulüp_yöneticisi') {
    return 'kulüp_yöneticisi';
  }
  return 'öğrenci';
}

bool isBanned(Map<dynamic, dynamic> data) {
  return data['banned'] == true || data['Banned'] == true;
}
