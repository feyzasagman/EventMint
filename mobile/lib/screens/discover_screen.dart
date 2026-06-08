import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

import 'event_detail_screen.dart';
import '../services/badge_service.dart';
import '../services/club_repo.dart';
import '../widgets/app_card.dart';
import '../widgets/club_logo_avatar.dart';
import '../widgets/empty_state.dart';
import '../widgets/event_card.dart';
import '../widgets/primary_button.dart';
import '../widgets/secondary_button.dart';
import '../widgets/tag_chip.dart';

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

enum _FeedItemType { post, event }

class _DiscoverFeedItem {
  const _DiscoverFeedItem({
    required this.type,
    required this.createdAt,
    required this.payload,
  });

  final _FeedItemType type;
  final DateTime createdAt;
  final Map<String, dynamic> payload;
}

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

DateTime _pickDateTime(Map data, List<String> keys) {
  for (final key in keys) {
    final value = data[key];
    if (value is Timestamp) return value.toDate();
    if (value is DateTime) return value;
  }
  return DateTime.fromMillisecondsSinceEpoch(0);
}

String _formatDate(DateTime value) {
  final day = value.day.toString().padLeft(2, '0');
  final month = value.month.toString().padLeft(2, '0');
  final hour = value.hour.toString().padLeft(2, '0');
  final minute = value.minute.toString().padLeft(2, '0');
  return '$day.$month.${value.year} $hour:$minute';
}

Future<_RsvpLookupResult> _findRsvp(String eventId, String uid) async {
  final docRef = ClubRepo.rsvpDoc(eventId, uid);
  final docSnapshot = await docRef.get();
  return _RsvpLookupResult(ref: docRef, exists: docSnapshot.exists);
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

  Stream<QuerySnapshot<Map<String, dynamic>>> _eventsStream() {
    ClubRepo.logCollection(ClubRepo.events, op: 'listPublished');
    return ClubRepo.col(ClubRepo.events)
        .where('status', isEqualTo: 'published')
        .snapshots();
  }

  Stream<QuerySnapshot<Map<String, dynamic>>> _postsStream() {
    ClubRepo.logCollection(ClubRepo.clubPosts, op: 'list');
    return ClubRepo.col(ClubRepo.clubPosts).snapshots();
  }

  List<_DiscoverFeedItem> _mergeAndFilterFeed({
    required List<QueryDocumentSnapshot<Map<String, dynamic>>> eventDocs,
    required List<QueryDocumentSnapshot<Map<String, dynamic>>> postDocs,
  }) {
    final query = _searchText.trim().toLowerCase();

    final items = <_DiscoverFeedItem>[
      ...eventDocs.map((doc) {
        final data = doc.data();
        return _DiscoverFeedItem(
          type: _FeedItemType.event,
          createdAt: _pickDateTime(data, const ['startAt', 'createdAt']),
          payload: <String, dynamic>{'id': doc.id, ...data},
        );
      }),
      ...postDocs.map((doc) {
        final data = doc.data();
        return _DiscoverFeedItem(
          type: _FeedItemType.post,
          createdAt: _pickDateTime(data, const ['olusturulduAt', 'createdAt']),
          payload: <String, dynamic>{'id': doc.id, ...data},
        );
      }),
    ];

    final filtered = items.where((item) {
      if (item.type == _FeedItemType.event) {
        final data = item.payload;
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
      }

      final data = item.payload;
      final clubId = _pickString(data, const ['kulupId', 'kulupID', 'clubId']);
      final clubName = _pickString(data, const [
        'clubName',
        'Reklam',
        'ad',
        'name',
      ]);
      final text = _pickString(data, const [
        'metin',
        'text',
        'icerik',
        'içerik',
      ]);
      final tags = _pickStringList(data, const [
        'hashtags',
        'tags',
        'Etiketler',
        'etiketler',
      ]);

      final matchesSearch =
          query.isEmpty ||
          _containsIgnoreCase(clubId, query) ||
          _containsIgnoreCase(clubName, query) ||
          _containsIgnoreCase(text, query) ||
          tags.any((tag) => _containsIgnoreCase(tag, query));
      final matchesCategory = _selectedCategory == 'Tümü';
      final matchesTag =
          _selectedTag == null ||
          tags.any((tag) => tag.toLowerCase() == _selectedTag!.toLowerCase()) ||
          _containsIgnoreCase(text, _selectedTag!);

      return matchesSearch && matchesCategory && matchesTag;
    }).toList();

    filtered.sort((a, b) => b.createdAt.compareTo(a.createdAt));
    return filtered;
  }

  @override
  Widget build(BuildContext context) {
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
                backgroundColor: Theme.of(context).colorScheme.surfaceContainer,
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
                backgroundColor: Theme.of(context).colorScheme.surfaceContainer,
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
          child: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
            stream: _eventsStream(),
            builder: (context, eventsSnapshot) {
              if (eventsSnapshot.hasError) {
                debugPrint('DISCOVER ERROR: ${eventsSnapshot.error}');
                return Center(child: Text('Hata: ${eventsSnapshot.error}'));
              }
              if (!eventsSnapshot.hasData) {
                return const Center(child: Text('Yükleniyor...'));
              }

              return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
                stream: _postsStream(),
                builder: (context, postsSnapshot) {
                      if (postsSnapshot.hasError) {
                        debugPrint('DISCOVER ERROR: ${postsSnapshot.error}');
                        return Center(
                          child: Text('Hata: ${postsSnapshot.error}'),
                        );
                      }
                      if (!postsSnapshot.hasData) {
                        return const Center(child: Text('Yükleniyor...'));
                      }

                      final feedItems = _mergeAndFilterFeed(
                        eventDocs: eventsSnapshot.data!.docs,
                        postDocs: postsSnapshot.data!.docs,
                      );

                      if (feedItems.isEmpty) {
                        final hasFilters =
                            _searchText.trim().isNotEmpty ||
                            _selectedCategory != 'Tümü' ||
                            _selectedTag != null;
                        return EmptyState(
                          icon: Icons.explore_off,
                          title: hasFilters
                              ? 'Sonuç bulunamadı'
                              : 'Keşif akışı boş',
                          subtitle: hasFilters
                              ? 'Aramanı veya filtrelerini değiştir'
                              : 'Duyuru ve etkinlik akışı burada görünecek.',
                          action: hasFilters
                              ? FilledButton.icon(
                                  onPressed: _clearFilters,
                                  icon: const Icon(Icons.filter_alt_off),
                                  label: const Text('Filtreyi temizle'),
                                )
                              : null,
                        );
                      }

                      return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
                        stream: ClubRepo.listClubs(),
                        builder: (context, clubsSnapshot) {
                          final clubLogoKeys = <String, String>{};
                          if (clubsSnapshot.hasData) {
                            for (final clubDoc in clubsSnapshot.data!.docs) {
                              final logoKey = _pickString(clubDoc.data(), const [
                                'logoKey',
                                'logo_key',
                              ]);
                              if (logoKey.isNotEmpty) {
                                clubLogoKeys[clubDoc.id] = logoKey;
                              }
                            }
                          }

                          return ListView.separated(
                            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                            itemBuilder: (context, index) {
                              final item = feedItems[index];
                              if (item.type == _FeedItemType.post) {
                                final data = item.payload;
                                final clubId = _pickString(data, const [
                                  'kulupId',
                                  'kulupID',
                                  'clubId',
                                ]);
                                final clubName = _pickString(data, const [
                                  'clubName',
                                  'Reklam',
                                  'ad',
                                  'name',
                                ]);
                                final text = _pickString(data, const [
                                  'metin',
                                  'text',
                                  'icerik',
                                  'içerik',
                                ]);
                                final hashtags = _pickStringList(data, const [
                                  'hashtags',
                                  'tags',
                                  'Etiketler',
                                  'etiketler',
                                ]);
                                return _PostCard(
                                  clubName: clubName.isNotEmpty
                                      ? clubName
                                      : (clubId.isNotEmpty ? clubId : 'Kulüp'),
                                  logoKey: clubLogoKeys[clubId],
                                  text: text,
                                  hashtags: hashtags,
                                  createdAt: item.createdAt,
                                );
                              }

                              final data = item.payload;
                              final eventId = (data['id'] ?? '').toString();
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
                            itemCount: feedItems.length,
                          );
                        },
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

class _PostCard extends StatelessWidget {
  const _PostCard({
    required this.clubName,
    this.logoKey,
    required this.text,
    required this.hashtags,
    required this.createdAt,
  });

  final String clubName;
  final String? logoKey;
  final String text;
  final List<String> hashtags;
  final DateTime createdAt;

  @override
  Widget build(BuildContext context) {
    final muted = Theme.of(context).colorScheme.onSurfaceVariant;
    final displayText = text.isEmpty ? '(Duyuru metni yok)' : text;
    final showDate =
        createdAt.millisecondsSinceEpoch > 0;

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ClubLogoAvatar(
                name: clubName,
                logoKey: logoKey,
                size: 40,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      clubName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        height: 1.2,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Kulüp Paylaşımı',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        fontSize: 11,
                        color: muted,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            displayText,
            maxLines: 4,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              height: 1.45,
            ),
          ),
          if (hashtags.isNotEmpty) ...[
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: hashtags
                  .map((tag) => TagChip(label: tag, compact: true))
                  .toList(),
            ),
          ],
          if (showDate) ...[
            const SizedBox(height: 12),
            Align(
              alignment: Alignment.centerRight,
              child: Text(
                _formatDate(createdAt),
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  fontSize: 11,
                  color: muted,
                ),
              ),
            ),
          ],
        ],
      ),
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
        'uid': _uid,
        'createdAt': FieldValue.serverTimestamp(),
      });

      final newBadges = await awardFirstRsvpBadge(_uid);

      if (!mounted) return;
      setState(() {
        _isSaving = false;
        _refreshRsvp();
      });
      final message = newBadges.isEmpty
          ? 'Katılım kaydedildi'
          : 'Katılım kaydedildi • Yeni rozet: ${newBadges.join(', ')}';
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(message)));
    } catch (error) {
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
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Katılım iptal edildi')));
    } catch (error) {
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
