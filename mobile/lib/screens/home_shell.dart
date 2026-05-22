import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

import 'discover_screen.dart';
import 'events_list_screen.dart';
import 'profile_screen.dart';

class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int currentIndex = 0;
  late final Stream<int> _rsvpCount = _createRsvpCountStream();
  late final Stream<bool> _hasBadge = _createHasBadgeStream();

  static const List<Widget> _screens = [
    EventsListScreen(showScaffold: false),
    DiscoverScreen(showScaffold: false),
    ProfileScreen(showScaffold: false),
  ];

  String? get _uid => FirebaseAuth.instance.currentUser?.uid;

  Stream<int> _createRsvpCountStream() async* {
    final uid = _uid;
    if (uid == null) {
      yield 0;
      return;
    }

    for (final collectionName in const ["RSVP'ler", 'rsvps']) {
      for (final uidField in const ['UID', 'uid']) {
        final initialSnapshot = await FirebaseFirestore.instance
            .collection(collectionName)
            .where(uidField, isEqualTo: uid)
            .get();
        if (initialSnapshot.docs.isNotEmpty) {
          yield* FirebaseFirestore.instance
              .collection(collectionName)
              .where(uidField, isEqualTo: uid)
              .snapshots()
              .map((snapshot) => snapshot.docs.length);
          return;
        }
      }
    }

    yield* FirebaseFirestore.instance
        .collection("RSVP'ler")
        .where('UID', isEqualTo: uid)
        .snapshots()
        .map((snapshot) => snapshot.docs.length);
  }

  Stream<bool> _createHasBadgeStream() {
    final uid = _uid;
    if (uid == null) return Stream<bool>.value(false);
    return FirebaseFirestore.instance
        .collection('Kullanıcılar')
        .doc(uid)
        .snapshots()
        .map((snapshot) {
      final badges = snapshot.data()?['Rozetler'];
      return badges is List && badges.isNotEmpty;
    });
  }

  Widget _rsvpBadgedIcon(IconData icon, int count) {
    if (count <= 0) return Icon(icon);
    return Badge(label: Text(count.toString()), child: Icon(icon));
  }

  Widget _profileBadgedIcon(IconData icon, bool hasBadge) {
    if (!hasBadge) return Icon(icon);
    return Badge(child: Icon(icon));
  }

  void _showSearchDialog() {
    showDialog<void>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('Arama'),
          content: const Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('Arama yakında'),
              SizedBox(height: 12),
              TextField(
                decoration: InputDecoration(
                  hintText: 'Etkinlik ara...',
                  prefixIcon: Icon(Icons.search),
                  border: OutlineInputBorder(),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Tamam'),
            ),
          ],
        );
      },
    );
  }

  void _showFilterSheet() {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) {
        return Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Filtreler',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: const [
                  ChoiceChip(label: Text('STEM'), selected: false),
                  ChoiceChip(label: Text('Sanat'), selected: false),
                  ChoiceChip(label: Text('Spor'), selected: false),
                  ChoiceChip(label: Text('Sosyal'), selected: false),
                ],
              ),
              const SizedBox(height: 16),
              Align(
                alignment: Alignment.centerRight,
                child: FilledButton(
                  onPressed: () => Navigator.of(context).pop(),
                  child: const Text('Uygula'),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  void _showSettingsSheet() {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) {
        return Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Icon(Icons.account_circle),
                title: Text('Hesap'),
              ),
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: () async {
                    Navigator.of(context).pop();
                    await FirebaseAuth.instance.signOut();
                  },
                  icon: const Icon(Icons.logout),
                  label: const Text('Çıkış Yap'),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildFab() {
    switch (currentIndex) {
      case 1:
        return FloatingActionButton(
          onPressed: _showFilterSheet,
          child: const Icon(Icons.tune),
        );
      case 2:
        return FloatingActionButton(
          onPressed: _showSettingsSheet,
          child: const Icon(Icons.settings),
        );
      default:
        return FloatingActionButton(
          onPressed: _showSearchDialog,
          child: const Icon(Icons.search),
        );
    }
  }

  PreferredSizeWidget _buildAppBar() {
    switch (currentIndex) {
      case 1:
        return AppBar(
          title: const Text('Keşfet'),
          actions: [
            IconButton(
              tooltip: 'Filtrele',
              onPressed: () {},
              icon: const Icon(Icons.tune),
            ),
          ],
        );
      case 2:
        return AppBar(
          title: const Text('Profil'),
          actions: [
            IconButton(
              tooltip: 'Ayarlar',
              onPressed: () {},
              icon: const Icon(Icons.settings),
            ),
          ],
        );
      default:
        return AppBar(
          title: const Text('Etkinlikler'),
          actions: [
            IconButton(
              tooltip: 'Ara',
              onPressed: () {},
              icon: const Icon(Icons.search),
            ),
            IconButton(
              tooltip: 'Profil',
              onPressed: () => setState(() => currentIndex = 2),
              icon: const Icon(Icons.person),
            ),
          ],
        );
    }
  }

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<int>(
      stream: _rsvpCount,
      builder: (context, rsvpSnapshot) {
        return StreamBuilder<bool>(
          stream: _hasBadge,
          builder: (context, badgeSnapshot) {
            final rsvpCount = rsvpSnapshot.data ?? 0;
            final hasBadge = badgeSnapshot.data ?? false;

            return Scaffold(
              appBar: _buildAppBar(),
              body: IndexedStack(index: currentIndex, children: _screens),
              floatingActionButton: _buildFab(),
              bottomNavigationBar: NavigationBar(
                selectedIndex: currentIndex,
                onDestinationSelected: (index) {
                  setState(() => currentIndex = index);
                },
                destinations: [
                  NavigationDestination(
                    icon: _rsvpBadgedIcon(Icons.event_outlined, rsvpCount),
                    selectedIcon: _rsvpBadgedIcon(Icons.event, rsvpCount),
                    label: 'Etkinlikler',
                  ),
                  const NavigationDestination(
                    icon: Icon(Icons.explore_outlined),
                    selectedIcon: Icon(Icons.explore),
                    label: 'Keşfet',
                  ),
                  NavigationDestination(
                    icon: _profileBadgedIcon(
                      Icons.person_outline,
                      hasBadge,
                    ),
                    selectedIcon: _profileBadgedIcon(Icons.person, hasBadge),
                    label: 'Profil',
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }
}
