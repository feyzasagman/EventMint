import 'club_repo.dart';

Future<Map<String, dynamic>?> getUserRecord(String uid) async {
  ClubRepo.logCollection(ClubRepo.users, op: 'get:$uid');
  final snapshot = await ClubRepo.userDoc(uid).get();
  if (snapshot.exists) {
    return snapshot.data();
  }
  return null;
}

Stream<Map<String, dynamic>?> streamUserRecord(String uid) {
  ClubRepo.logCollection(ClubRepo.users, op: 'stream:$uid');
  return ClubRepo.userDoc(uid).snapshots().map((snapshot) => snapshot.data());
}

String normalizeUserRole(Map<dynamic, dynamic> data) {
  final raw = (data['role'] ?? 'student').toString().trim().toLowerCase();
  if (raw == 'admin') return 'admin';
  if (raw == 'club_manager' ||
      raw == 'kulüp_yöneticisi' ||
      raw == 'club manager') {
    return 'club_manager';
  }
  return 'student';
}

String getUserClubId(Map<dynamic, dynamic> data) {
  return (data['clubId'] ?? '').toString().trim();
}

bool canManageClub({
  required String role,
  required String myClubId,
  required String currentClubId,
}) {
  if (role == 'admin') return true;
  if (role == 'club_manager' &&
      myClubId.isNotEmpty &&
      myClubId == currentClubId) {
    return true;
  }
  return false;
}

bool canShowClubAdminActionBar({
  required String role,
  required String myClubId,
  required String currentClubId,
}) =>
    canManageClub(
      role: role,
      myClubId: myClubId,
      currentClubId: currentClubId,
    );

bool canShowClubManageHeader({
  required String role,
  required String myClubId,
  required String currentClubId,
}) =>
    canManageClub(
      role: role,
      myClubId: myClubId,
      currentClubId: currentClubId,
    );

String getRole(Map<dynamic, dynamic> data) => normalizeUserRole(data);

bool isAdminRole(String role) => role == 'admin';

bool isStaffRole(String role) => role == 'admin' || role == 'club_manager';

String roleLabelTr(String role) {
  switch (role) {
    case 'admin':
      return 'Admin';
    case 'club_manager':
      return 'Kulüp Yöneticisi';
    default:
      return 'Öğrenci';
  }
}

bool isBanned(Map<dynamic, dynamic> data) {
  return data['banned'] == true;
}
