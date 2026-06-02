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

Future<bool> isUserBanned(String uid) async {
  try {
    final data = await getUserRecord(uid);
    return data?['banned'] == true;
  } catch (_) {
    return false;
  }
}
