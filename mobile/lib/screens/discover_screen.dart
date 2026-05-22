import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart' show debugPrint, kIsWeb;
import 'package:flutter/material.dart';

import 'event_detail_screen.dart';
import '../widgets/empty_state.dart';
import '../widgets/event_card.dart';

const String _primaryDiscoverCollectionName = 'events';
const String _fallbackDiscoverCollectionName = 'Etkinlikler';
const List<String> _categories = ['Tümü', 'STEM', 'Sanat', 'Spor', 'Sosyal'];
const List<String> _popularTags = [
  'arduino',
  'robotik',
  'tiyatro',
  'konser',
  'turnuva',
  'bağış',
  'yazılım',
  'sergi',
];

String _pickString(Map data, List<String> keys) {
  for (final key in keys) {
    final value = data[key];
    if (value is String && value.trim().isNotEmpty) {
      return value.trim();
    }
  }
  return '';
}

List<String> _pickStringList(Map data, List<String> keys) {
  for (final key in keys) {
    final value = data[key];
    if (value is List) {
      return value
          .map((item) => item.toString().trim())
          .where((item) => item.isNotEmpty)
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

bool _containsIgnoreCase(String value, String query) {
  return value.toLowerCase().contains(query.toLowerCase());
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

class DiscoverScreen extends StatefulWidget {
  const DiscoverScreen({super.key, this.showScaffold = true});

  final bool showScaffold;

  @override
  State<DiscoverScreen> createState() => _DiscoverScreenState();
}

class _DiscoverScreenState extends State<DiscoverScreen> {
  final TextEditingController _searchController = TextEditingController();
  late final Future<String> _collectionFuture = _pickEventsCollection();
  Timer? _searchDebounce;
  String _selectedCategory = 'Tümü';
  String? _selectedTag;
  String _searchText = '';

  @override
  void dispose() {
    _searchDebounce?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  bool get _hasActiveFilters {
    return _searchController.text.trim().isNotEmpty ||
        _selectedCategory != 'Tümü' ||
        _selectedTag != null;
  }

  void _onSearchChanged(String value) {
    _searchDebounce?.cancel();
    _searchDebounce = Timer(const Duration(milliseconds: 250), () {
      if (!mounted) return;
      setState(() => _searchText = value);
    });
  }

  void _clearFilters() {
    _searchDebounce?.cancel();
    _searchController.clear();
    setState(() {
      _searchText = '';
      _selectedCategory = 'Tümü';
      _selectedTag = null;
    });
  }

  Future<String> _pickEventsCollection() async {
    final primarySnapshot = await FirebaseFirestore.instance
        .collection(_primaryDiscoverCollectionName)
        .get();
    if (primarySnapshot.docs.isNotEmpty) {
      return _primaryDiscoverCollectionName;
    }
    return _fallbackDiscoverCollectionName;
  }

  Stream<QuerySnapshot<Map<String, dynamic>>> _eventsStream(
    String collectionName,
  ) {
    return FirebaseFirestore.instance.collection(collectionName).snapshots();
  }

  List<QueryDocumentSnapshot<Map<String, dynamic>>> _filterDocs(
    List<QueryDocumentSnapshot<Map<String, dynamic>>> docs,
  ) {
    final query = _searchText.trim().toLowerCase();
    return docs.where((doc) {
      final data = doc.data();
      final title = _pickString(data, const [
        'title',
        'Baslik',
        'Başlık',
        'başlık',
        'baslik',
      ]);
      final clubId = _pickString(data, const ['clubId', 'Kulup', 'kulup']);
      final category = _pickString(data, const [
        'category',
        'Kategori',
        'kategori',
      ]);
      final location = _pickString(data, const ['location', 'Konum', 'konum']);
      final tags = _pickStringList(data, const [
        'tags',
        'Etiketler',
        'etiketler',
      ]);

      final matchesSearch =
          query.isEmpty ||
          _containsIgnoreCase(title, query) ||
          _containsIgnoreCase(clubId, query) ||
          _containsIgnoreCase(category, query) ||
          _containsIgnoreCase(location, query) ||
          tags.any((tag) => _containsIgnoreCase(tag, query));
      final matchesCategory =
          _selectedCategory == 'Tümü' ||
          category.toLowerCase() == _selectedCategory.toLowerCase();
      final matchesTag =
          _selectedTag == null ||
          tags.any((tag) => tag.toLowerCase() == _selectedTag!.toLowerCase());

      return matchesSearch && matchesCategory && matchesTag;
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    if (kIsWeb) {
      return Scaffold(
        appBar: AppBar(title: const Text('Keşfet')),
        body: const Center(child: Text('Web demo modu')),
      );
    }

    final body = Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: TextField(
              controller: _searchController,
              onChanged: _onSearchChanged,
              decoration: InputDecoration(
                hintText: 'Etkinlik, kulüp, kategori veya etiket ara',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: _hasActiveFilters
                    ? IconButton(
                        tooltip: 'Filtreyi temizle',
                        onPressed: _clearFilters,
                        icon: const Icon(Icons.close),
                      )
                    : null,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(18),
                ),
              ),
            ),
          ),
          SizedBox(
            height: 48,
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              scrollDirection: Axis.horizontal,
              itemBuilder: (context, index) {
                final category = _categories[index];
                return ChoiceChip(
                  label: Text(category),
                  selected: _selectedCategory == category,
                  showCheckmark: false,
                  labelStyle: TextStyle(
                    fontWeight: _selectedCategory == category
                        ? FontWeight.w700
                        : FontWeight.w500,
                  ),
                  selectedColor: Theme.of(context).colorScheme.primaryContainer,
                  backgroundColor: Theme.of(
                    context,
                  ).colorScheme.surfaceContainer,
                  side: BorderSide(
                    color: _selectedCategory == category
                        ? Theme.of(context).colorScheme.primary
                        : Theme.of(context).colorScheme.outlineVariant,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(999),
                  ),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 8,
                  ),
                  onSelected: (_) {
                    setState(() => _selectedCategory = category);
                  },
                );
              },
              separatorBuilder: (context, index) => const SizedBox(width: 8),
              itemCount: _categories.length,
            ),
          ),
          SizedBox(
            height: 44,
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              scrollDirection: Axis.horizontal,
              itemBuilder: (context, index) {
                final tag = _popularTags[index];
                final selected = _selectedTag == tag;
                return FilterChip(
                  label: Text(tag),
                  selected: selected,
                  showCheckmark: false,
                  labelStyle: TextStyle(
                    fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                  ),
                  selectedColor: Theme.of(context).colorScheme.primaryContainer,
                  backgroundColor: Theme.of(
                    context,
                  ).colorScheme.surfaceContainer,
                  side: BorderSide(
                    color: selected
                        ? Theme.of(context).colorScheme.primary
                        : Theme.of(context).colorScheme.outlineVariant,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(999),
                  ),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 8,
                  ),
                  onSelected: (_) {
                    setState(() => _selectedTag = selected ? null : tag);
                  },
                );
              },
              separatorBuilder: (context, index) => const SizedBox(width: 8),
              itemCount: _popularTags.length,
            ),
          ),
          if (_hasActiveFilters)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
              child: Align(
                alignment: Alignment.centerRight,
                child: TextButton.icon(
                  onPressed: _clearFilters,
                  icon: const Icon(Icons.filter_alt_off),
                  label: const Text('Filtreyi temizle'),
                ),
              ),
            ),
          const SizedBox(height: 8),
          Expanded(
            child: FutureBuilder<String>(
              future: _collectionFuture,
              builder: (context, collectionSnapshot) {
                if (collectionSnapshot.hasError) {
                  debugPrint('DISCOVER ERROR: ${collectionSnapshot.error}');
                  return Center(
                    child: Text('Hata: ${collectionSnapshot.error}'),
                  );
                }

                if (!collectionSnapshot.hasData) {
                  return const Center(child: Text('Yükleniyor...'));
                }

                final collectionName = collectionSnapshot.data!;
                return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
                  stream: _eventsStream(collectionName),
                  builder: (context, snapshot) {
                    if (snapshot.hasError) {
                      debugPrint('DISCOVER ERROR: ${snapshot.error}');
                      return Center(child: Text('Hata: ${snapshot.error}'));
                    }

                    if (!snapshot.hasData) {
                      return const Center(child: Text('Yükleniyor...'));
                    }

                    final filteredDocs = _filterDocs(snapshot.data!.docs);
                    if (filteredDocs.isEmpty) {
                      final hasFilters =
                          _searchText.trim().isNotEmpty ||
                          _selectedCategory != 'Tümü' ||
                          _selectedTag != null;
                      return EmptyState(
                        icon: Icons.explore_off,
                        title: hasFilters
                            ? 'Sonuç bulunamadı'
                            : 'Etkinlik bulunamadı',
                        subtitle: hasFilters
                            ? 'Aramanı veya filtrelerini değiştir'
                            : 'Keşfedilecek etkinlikler burada görünecek.',
                        action: hasFilters
                            ? FilledButton.icon(
                                onPressed: _clearFilters,
                                icon: const Icon(Icons.filter_alt_off),
                                label: const Text('Filtreyi temizle'),
                              )
                            : null,
                      );
                    }

                    return ListView.separated(
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                      itemBuilder: (context, index) {
                        final doc = filteredDocs[index];
                        final data = doc.data();
                        final eventId = doc.id;
                        final title = _pickString(data, const [
                          'title',
                          'Baslik',
                          'Başlık',
                          'başlık',
                          'baslik',
                        ]);
                        final clubId = _pickString(data, const [
                          'clubId',
                          'Kulup',
                          'kulup',
                        ]);
                        final category = _pickString(data, const [
                          'category',
                          'Kategori',
                          'kategori',
                        ]);
                        final location = _pickString(data, const [
                          'location',
                          'Konum',
                          'konum',
                        ]);
                        final tags = _pickStringList(data, const [
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
                          trailingActions: _DiscoverRsvpButton(
                            eventId: eventId,
                          ),
                        );
                      },
                      separatorBuilder: (context, index) =>
                          const SizedBox(height: 12),
                      itemCount: filteredDocs.length,
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
      appBar: AppBar(title: const Text('Keşfet')),
      body: body,
    );
  }
}

class _DiscoverRsvpButton extends StatefulWidget {
  const _DiscoverRsvpButton({required this.eventId});

  final String eventId;

  @override
  State<_DiscoverRsvpButton> createState() => _DiscoverRsvpButtonState();
}

class _DiscoverRsvpButtonState extends State<_DiscoverRsvpButton> {
  late Future<_RsvpLookupResult> _rsvpFuture;
  bool _isSaving = false;

  String get _uid => FirebaseAuth.instance.currentUser!.uid;

  @override
  void initState() {
    super.initState();
    _refreshRsvp();
  }

  @override
  void didUpdateWidget(covariant _DiscoverRsvpButton oldWidget) {
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
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('RSVP kaydedildi')));
    } catch (error) {
      if (!mounted) return;
      setState(() => _isSaving = false);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('RSVP kaydedilemedi: $error')));
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
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('RSVP iptal edildi')));
    } catch (error) {
      if (!mounted) return;
      setState(() => _isSaving = false);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('RSVP iptal edilemedi: $error')));
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<_RsvpLookupResult>(
      future: _rsvpFuture,
      builder: (context, snapshot) {
        if (!snapshot.hasData) {
          return const SizedBox(
            height: 36,
            width: 36,
            child: Padding(
              padding: EdgeInsets.all(8),
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
          );
        }

        final isRsvped = snapshot.data!.exists;
        if (isRsvped) {
          return Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Chip(
                label: const Text('RSVP ✅'),
                backgroundColor: Colors.green.shade50,
                labelStyle: TextStyle(color: Colors.green.shade800),
                labelPadding: const EdgeInsets.symmetric(horizontal: 6),
                padding: EdgeInsets.zero,
                visualDensity: VisualDensity.compact,
                materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
              const SizedBox(width: 4),
              TextButton(
                style: TextButton.styleFrom(
                  minimumSize: const Size(0, 30),
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  visualDensity: VisualDensity.compact,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                onPressed: _isSaving ? null : _deleteRsvp,
                child: const Text('İptal'),
              ),
            ],
          );
        }

        return FilledButton(
          style: FilledButton.styleFrom(
            minimumSize: const Size(0, 32),
            padding: const EdgeInsets.symmetric(horizontal: 12),
            visualDensity: VisualDensity.compact,
            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
          ),
          onPressed: _isSaving ? null : _saveRsvp,
          child: const Text('Katılacağım'),
        );
      },
    );
  }
}
