import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';

class ClubRepo {
  ClubRepo._();

  static const String clubs = 'clubs';
  static const String clubPosts = 'club_posts';
  static const String clubApplications = 'club_applications';
  static const String clubMembers = 'club_members';
  static const String events = 'events';
  static const String sessions = 'sessions';
  static const String rsvps = 'rsvps';
  static const String checkins = 'checkins';
  static const String users = 'users';

  static FirebaseFirestore get db => FirebaseFirestore.instance;

  static void logCollection(String name, {String? op}) {
    if (kDebugMode) {
      final suffix = op == null ? '' : ' op=$op';
      debugPrint('[Firestore] collection=$name$suffix');
    }
  }

  static CollectionReference<Map<String, dynamic>> col(String name) {
    logCollection(name);
    return db.collection(name);
  }

  static DocumentReference<Map<String, dynamic>> clubDoc(String clubId) {
    logCollection(clubs, op: 'doc:$clubId');
    return db.collection(clubs).doc(clubId.trim());
  }

  static DocumentReference<Map<String, dynamic>> clubMemberDoc(
    String clubId,
    String uid,
  ) {
    logCollection(clubMembers, op: 'doc:${clubId}_$uid');
    return db.collection(clubMembers).doc('${clubId}_$uid');
  }

  static DocumentReference<Map<String, dynamic>> clubApplicationDoc(
    String clubId,
    String uid,
  ) {
    logCollection(clubApplications, op: 'doc:${clubId}_$uid');
    return db.collection(clubApplications).doc('${clubId}_$uid');
  }

  static DocumentReference<Map<String, dynamic>> rsvpDoc(
    String eventId,
    String uid,
  ) {
    logCollection(rsvps, op: 'doc:${eventId}_$uid');
    return db.collection(rsvps).doc('${eventId}_$uid');
  }

  static DocumentReference<Map<String, dynamic>> checkinDoc(
    String eventId,
    String uid,
  ) {
    logCollection(checkins, op: 'doc:${eventId}_$uid');
    return db.collection(checkins).doc('${eventId}_$uid');
  }

  static DocumentReference<Map<String, dynamic>> userDoc(String uid) {
    logCollection(users, op: 'doc:$uid');
    return db.collection(users).doc(uid);
  }

  static Future<DocumentSnapshot<Map<String, dynamic>>> getClub(
    String clubId,
  ) {
    return clubDoc(clubId).get();
  }

  static Stream<QuerySnapshot<Map<String, dynamic>>> listClubs() {
    logCollection(clubs, op: 'list');
    return db.collection(clubs).snapshots();
  }

  static Stream<DocumentSnapshot<Map<String, dynamic>>> streamClub(
    String clubId,
  ) {
    logCollection(clubs, op: 'stream:$clubId');
    return clubDoc(clubId).snapshots();
  }
}
