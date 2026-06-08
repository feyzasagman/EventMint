import '../services/user_record_service.dart';

Future<bool> isUserBanned(String uid) async {
  try {
    final data = await getUserRecord(uid);
    return data != null && isBanned(data);
  } catch (_) {
    return false;
  }
}
