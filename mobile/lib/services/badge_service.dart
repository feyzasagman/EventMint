import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';

import '../shared/badges.dart';
import 'club_repo.dart';

class BadgeAwardResult {
  const BadgeAwardResult({
    required this.pointsUpdated,
    required this.newBadgeLabels,
  });

  final bool pointsUpdated;
  final List<String> newBadgeLabels;
}

Set<String> existingBadgeIds(Map<String, dynamic>? userData) {
  final ids = <String>{};
  final raw = pickBadgeList(userData ?? {});
  if (raw is! List) return ids;

  for (final badge in raw) {
    if (badge is Map) {
      final id = badge['id']?.toString().trim();
      if (id != null && id.isNotEmpty) ids.add(id);
    }
  }
  return ids;
}

Future<List<String>> _awardBadges(
  String uid,
  Iterable<String> badgeIds,
) async {
  final userRef = ClubRepo.userDoc(uid);
  final userDoc = await userRef.get();
  final userData = userDoc.data();
  final owned = existingBadgeIds(userData);
  final earnedAt = Timestamp.now();
  final toAdd = <Map<String, dynamic>>[];
  final labels = <String>[];

  for (final badgeId in badgeIds) {
    if (owned.contains(badgeId)) continue;
    toAdd.add({'id': badgeId, 'earnedAt': earnedAt});
    labels.add(badgeTitleFor(badgeId));
  }

  if (toAdd.isEmpty) return labels;

  await userRef.set(
    {
      'Rozetler': FieldValue.arrayUnion(toAdd),
      'lastBadgeWrite': FieldValue.serverTimestamp(),
    },
    SetOptions(merge: true),
  );
  return labels;
}

Future<int> _countUserCheckins(String uid) async {
  final snapshot = await ClubRepo.col(ClubRepo.checkins)
      .where('uid', isEqualTo: uid)
      .get();
  return snapshot.docs.length;
}

List<String> _checkinBadgeIdsForCount(int count, Set<String> owned) {
  final ids = <String>[];
  if (count >= 1 && !owned.contains(BadgeId.firstAttend.value)) {
    ids.add(BadgeId.firstAttend.value);
  }
  if (count >= 3 &&
      !owned.contains(BadgeId.streak3.value) &&
      !owned.contains('FIVE_ATTENDS')) {
    ids.add(BadgeId.streak3.value);
  }
  if (count >= 10 &&
      !owned.contains(BadgeId.streak10.value) &&
      !owned.contains('TEN_ATTENDS')) {
    ids.add(BadgeId.streak10.value);
  }
  return ids;
}

Future<List<String>> syncCheckinBadges(String uid) async {
  try {
    final userDoc = await ClubRepo.userDoc(uid).get();
    final userData = userDoc.data();
    final owned = existingBadgeIds(userData);
    final checkinCount = await _countUserCheckins(uid);
    final badgeIds = _checkinBadgeIdsForCount(checkinCount, owned);
    return _awardBadges(uid, badgeIds);
  } catch (error, stackTrace) {
    debugPrint('BADGE SYNC ERROR: $error');
    debugPrint('$stackTrace');
    return [];
  }
}

Future<BadgeAwardResult> awardCheckinBadges(String uid) async {
  final userRef = ClubRepo.userDoc(uid);

  try {
    final userDoc = await userRef.get();
    final userData = userDoc.data();
    final owned = existingBadgeIds(userData);
    final checkinCount = await _countUserCheckins(uid);
    final badgeIds = _checkinBadgeIdsForCount(checkinCount, owned);

    await userRef.set(
      {
        'pointsTotal': FieldValue.increment(10),
        'lastBadgeWrite': FieldValue.serverTimestamp(),
      },
      SetOptions(merge: true),
    );

    final labels = await _awardBadges(uid, badgeIds);
    return BadgeAwardResult(pointsUpdated: true, newBadgeLabels: labels);
  } on FirebaseException catch (error, stackTrace) {
    debugPrint('BADGE CHECKIN ERROR: $error');
    debugPrint('$stackTrace');
    return const BadgeAwardResult(pointsUpdated: false, newBadgeLabels: []);
  } catch (error, stackTrace) {
    debugPrint('BADGE CHECKIN ERROR: $error');
    debugPrint('$stackTrace');
    return const BadgeAwardResult(pointsUpdated: false, newBadgeLabels: []);
  }
}

Future<List<String>> awardFirstRsvpBadge(String uid) async {
  try {
    return _awardBadges(uid, [BadgeId.earlyBird.value]);
  } catch (error, stackTrace) {
    debugPrint('BADGE RSVP ERROR: $error');
    debugPrint('$stackTrace');
    return [];
  }
}

Future<List<String>> awardClubMemberBadge(String uid) async {
  try {
    return _awardBadges(uid, [BadgeId.clubMember.value]);
  } catch (error, stackTrace) {
    debugPrint('BADGE CLUB MEMBER ERROR: $error');
    debugPrint('$stackTrace');
    return [];
  }
}
