import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

import 'event_detail_screen.dart';
import 'profile_screen.dart';
import '../widgets/empty_state.dart';
import '../widgets/event_card.dart';
import '../widgets/primary_button.dart';
import '../widgets/secondary_button.dart';
import '../widgets/tag_chip.dart';

const String _primaryEventsCollectionName = 'Etkinlikler';
const String _fallbackEventsCollectionName = 'events';

String _firestoreErrorText(Object? error) {
  if (error is FirebaseException) {
    return error.message ?? error.code;
  }
  return error?.toString() ?? 'Bilinmeyen hata';
}

void _logFirestoreError(Object error, [StackTrace? stackTrace]) {
  debugPrint('FIRESTORE ERROR: $error');
  if (stackTrace != null) {
    debugPrint('$stackTrace');
  }
}

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

Future<_RsvpLookupResult> _findRsvp(String eventId, String uid) async {
  final rsvpCollection = FirebaseFirestore.instance.collection("RSVP'ler");
  final docRef = rsvpCollection.doc('${eventId}_$uid');
  final docSnapshot = await docRef.get();
  if (docSnapshot.exists) {
    return _RsvpLookupResult(ref: docRef, exists: true);
  }

  final uidSnapshot = await rsvpCollection
      .where('eventId', isEqualTo: eventId)
      .where('UID', isEqualTo: uid)
      .limit(1)
      .get();
  if (uidSnapshot.docs.isNotEmpty) {
    return _RsvpLookupResult(
      ref: uidSnapshot.docs.first.reference,
      exists: true,
    );
  }

  final lowercaseUidSnapshot = await rsvpCollection
      .where('eventId', isEqualTo: eventId)
      .where('uid', isEqualTo: uid)
      .limit(1)
      .get();
  if (lowercaseUidSnapshot.docs.isNotEmpty) {
    return _RsvpLookupResult(
      ref: lowercaseUidSnapshot.docs.first.reference,
      exists: true,
    );
  }

  return _RsvpLookupResult(ref: docRef, exists: false);
}

class _RsvpLookupResult {
  const _RsvpLookupResult({required this.ref, required this.exists});

  final DocumentReference<Map<String, dynamic>> ref;
  final bool exists;
}

class EventsListScreen extends StatefulWidget {
  const EventsListScreen({super.key, this.showScaffold = true});

  final bool showScaffold;

  @override
  State<EventsListScreen> createState() => _EventsListScreenState();
}

class _EventsListScreenState extends State<EventsListScreen> {
  late final Future<String> _eventsCollectionFuture = _pickEventsCollection();
  final TextEditingController _searchController = TextEditingController();
  bool _isSearching = false;
  String _searchQuery = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<String> _pickEventsCollection() async {
    try {
      final primarySnapshot = await FirebaseFirestore.instance
          .collection(_primaryEventsCollectionName)
          .get();
      if (primarySnapshot.docs.isNotEmpty) {
        return _primaryEventsCollectionName;
      }
      return _fallbackEventsCollectionName;
    } on FirebaseException catch (e, st) {
      _logFirestoreError(e, st);
      return _fallbackEventsCollectionName;
    } catch (e, st) {
      _logFirestoreError(e, st);
      return _fallbackEventsCollectionName;
    }
  }

  Stream<QuerySnapshot<Map<String, dynamic>>> _eventsStream(
    String collectionName,
  ) {
    return FirebaseFirestore.instance.collection(collectionName).snapshots();
  }

  List<QueryDocumentSnapshot<Map<String, dynamic>>> _filterDocs(
    List<QueryDocumentSnapshot<Map<String, dynamic>>> docs,
  ) {
    final query = _searchQuery.trim().toLowerCase();
    if (query.isEmpty) return docs;

    return docs.where((doc) {
      final data = doc.data();
      final title = pickString(data, const [
        'title',
        'Baslik',
        'Başlık',
        'başlık',
        'baslik',
      ]);
      final clubId = pickString(data, const ['clubId', 'Kulup', 'kulup']);
      final category = pickString(data, const [
        'category',
        'Kategori',
        'kategori',
      ]);
      final location = pickString(data, const ['location', 'Konum', 'konum']);
      final tags = pickStringList(data, const [
        'tags',
        'Etiketler',
        'etiketler',
      ]);
      final searchable = [
        title,
        clubId,
        category,
        location,
        ...tags,
      ].join(' ').toLowerCase();

      return searchable.contains(query);
    }).toList();
  }

  void _openSearch() {
    setState(() => _isSearching = true);
  }

  void _clearSearch() {
    _searchController.clear();
    setState(() {
      _searchQuery = '';
      _isSearching = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final body = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: FutureBuilder<String>(
            future: _eventsCollectionFuture,
            builder: (context, collectionSnapshot) {
              if (collectionSnapshot.hasError) {
                _logFirestoreError(collectionSnapshot.error!);
                return Center(
                  child: Text(
                    "Hata: ${_firestoreErrorText(collectionSnapshot.error)}",
                  ),
                );
              }

              if (!collectionSnapshot.hasData) {
                return const Center(child: Text("Yükleniyor..."));
              }

              final collectionName = collectionSnapshot.data!;
              return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
                stream: _eventsStream(collectionName),
                builder: (context, snapshot) {
                  if (snapshot.hasError) {
                    _logFirestoreError(snapshot.error!);
                    return Center(
                      child: Text(
                        "Hata: ${_firestoreErrorText(snapshot.error)}",
                      ),
                    );
                  }

                  if (!snapshot.hasData) {
                    return const Center(child: Text("Yükleniyor..."));
                  }

                  final docs = snapshot.data!.docs;
                  final filteredDocs = _filterDocs(docs);
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (docs.isEmpty)
                        const Expanded(
                          child: EmptyState(
                            icon: Icons.event_busy,
                            title: 'Etkinlik bulunamadı',
                            subtitle:
                                'Yeni etkinlikler eklendiğinde burada görünecek.',
                          ),
                        )
                      else if (filteredDocs.isEmpty)
                        const Expanded(
                          child: EmptyState(
                            icon: Icons.search_off,
                            title: 'Sonuç bulunamadı',
                            subtitle: 'Aramanı değiştir',
                          ),
                        )
                      else
                        Expanded(
                          child: ListView.separated(
                            itemCount: filteredDocs.length,
                            separatorBuilder: (context, index) =>
                                const SizedBox(height: 8),
                            padding: const EdgeInsets.all(12),
                            itemBuilder: (context, index) {
                              final data = filteredDocs[index].data();
                              final eventId = filteredDocs[index].id;

                              final titleRaw = pickString(data, const [
                                'title',
                                'Baslik',
                                'Başlık',
                                'başlık',
                                'baslik',
                              ]);
                              final title = titleRaw.isEmpty
                                  ? '(Başlık yok)'
                                  : titleRaw;
                              final clubIdRaw = pickString(data, const [
                                'clubId',
                                'Kulup',
                                'kulup',
                              ]);
                              final clubId = clubIdRaw.isEmpty
                                  ? '-'
                                  : clubIdRaw;
                              final categoryRaw = pickString(data, const [
                                'category',
                                'Kategori',
                                'kategori',
                              ]);
                              final category = categoryRaw.isEmpty
                                  ? '-'
                                  : categoryRaw;
                              final locationRaw = pickString(data, const [
                                'location',
                                'Konum',
                                'konum',
                              ]);
                              final location = locationRaw.isEmpty
                                  ? '-'
                                  : locationRaw;
                              final tags = pickStringList(data, const [
                                'tags',
                                'Etiketler',
                                'etiketler',
                              ]);

                              return EventCard(
                                title: title,
                                clubId: clubId,
                                category: category,
                                location: location,
                                tags: tags,
                                onTap: () {
                                  Navigator.of(context).push(
                                    MaterialPageRoute(
                                      builder: (_) => EventDetailScreen(
                                        eventId: eventId,
                                        data: data,
                                      ),
                                    ),
                                  );
                                },
                                trailingActions: _RsvpStatusActions(
                                  eventId: eventId,
                                ),
                              );
                            },
                          ),
                        ),
                    ],
                  );
                },
              );
            },
          ),
        ),
      ],
    );
    if (!widget.showScaffold) return body;
    return Scaffold(
      appBar: AppBar(
        title: _isSearching
            ? TextField(
                controller: _searchController,
                autofocus: true,
                decoration: const InputDecoration(
                  hintText: 'Etkinlik ara...',
                  border: InputBorder.none,
                ),
                textInputAction: TextInputAction.search,
                onChanged: (value) => setState(() => _searchQuery = value),
              )
            : const Text('Etkinlikler'),
        actions: [
          if (_isSearching)
            IconButton(
              tooltip: 'Aramayı kapat',
              onPressed: _clearSearch,
              icon: const Icon(Icons.close),
            )
          else
            IconButton(
              tooltip: 'Ara',
              onPressed: _openSearch,
              icon: const Icon(Icons.search),
            ),
          IconButton(
            tooltip: 'Profil',
            onPressed: () {
              Navigator.of(
                context,
              ).push(MaterialPageRoute(builder: (_) => const ProfileScreen()));
            },
            icon: const Icon(Icons.account_circle),
          ),
        ],
      ),
      body: body,
    );
  }
}

class _RsvpStatusActions extends StatefulWidget {
  const _RsvpStatusActions({required this.eventId});

  final String eventId;

  @override
  State<_RsvpStatusActions> createState() => _RsvpStatusActionsState();
}

class _RsvpStatusActionsState extends State<_RsvpStatusActions> {
  late Future<_RsvpLookupResult> _rsvpFuture;
  bool _isSaving = false;

  String get _uid => FirebaseAuth.instance.currentUser!.uid;

  @override
  void initState() {
    super.initState();
    _refreshRsvp();
  }

  @override
  void didUpdateWidget(covariant _RsvpStatusActions oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.eventId != widget.eventId) {
      _refreshRsvp();
    }
  }

  void _refreshRsvp() {
    _rsvpFuture = _findRsvp(widget.eventId, _uid);
  }

  Future<void> _saveRsvp() async {
    setState(() => _isSaving = true);
    try {
      final result = await _rsvpFuture;
      await result.ref.set({
        'eventId': widget.eventId,
        'UID': _uid,
        'uid': _uid,
        'createdAt': FieldValue.serverTimestamp(),
      }, SetOptions(merge: true));

      if (!mounted) return;
      setState(() {
        _isSaving = false;
        _refreshRsvp();
      });
    } on FirebaseException catch (error, st) {
      _logFirestoreError(error, st);
      if (!mounted) return;
      setState(() => _isSaving = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Katılım kaydedilemedi: ${error.message ?? error.code}',
          ),
        ),
      );
    } catch (error, st) {
      _logFirestoreError(error, st);
      if (!mounted) return;
      setState(() => _isSaving = false);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Katılım kaydedilemedi: $error')));
    }
  }

  Future<void> _deleteRsvp() async {
    setState(() => _isSaving = true);
    try {
      final result = await _rsvpFuture;
      await result.ref.delete();

      if (!mounted) return;
      setState(() {
        _isSaving = false;
        _refreshRsvp();
      });
    } on FirebaseException catch (error, st) {
      _logFirestoreError(error, st);
      if (!mounted) return;
      setState(() => _isSaving = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Katılım iptal edilemedi: ${error.message ?? error.code}',
          ),
        ),
      );
    } catch (error, st) {
      _logFirestoreError(error, st);
      if (!mounted) return;
      setState(() => _isSaving = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Katılım iptal edilemedi: $error')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<_RsvpLookupResult>(
      future: _rsvpFuture,
      builder: (context, snapshot) {
        if (snapshot.hasError) {
          _logFirestoreError(snapshot.error!);
          return Text("Hata: ${_firestoreErrorText(snapshot.error)}");
        }

        if (!snapshot.hasData) {
          return const SizedBox(
            height: 36,
            child: Align(
              alignment: Alignment.centerLeft,
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
          );
        }

        final isRsvped = snapshot.data!.exists;

        if (isRsvped) {
          return Row(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              const TagChip(label: 'Katılacağım'),
              const SizedBox(width: 6),
              SecondaryButton(
                label: 'İptal',
                compact: true,
                onPressed: _isSaving ? null : _deleteRsvp,
              ),
            ],
          );
        }

        return PrimaryButton(
          label: 'Katılacağım',
          compact: true,
          onPressed: _isSaving ? null : _saveRsvp,
        );
      },
    );
  }
}
