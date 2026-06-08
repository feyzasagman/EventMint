import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

import 'admin_events_screen.dart';
import 'admin_managers_screen.dart';
import 'admin_users_screen.dart';
import 'club_manage_screen.dart';
import 'clubs_list_screen.dart';
import 'create_club_screen.dart';
import 'discover_screen.dart';
import 'events_list_screen.dart';
import 'login_screen.dart';
import 'profile_screen.dart';
import '../theme/app_theme.dart';
import '../widgets/app_logo.dart';
import '../services/club_repo.dart';
import '../services/user_record_service.dart';

class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int currentIndex = 0;

  static const List<Widget> _screens = [
    EventsListScreen(showScaffold: false),
    DiscoverScreen(showScaffold: false),
    ClubsListScreen(showScaffold: false),
    ProfileScreen(showScaffold: false),
  ];

  Stream<int> _createRsvpCountStream(String uid) {
    ClubRepo.logCollection(ClubRepo.rsvps, op: 'count:$uid');
    return ClubRepo.col(ClubRepo.rsvps)
        .where('uid', isEqualTo: uid)
        .snapshots()
        .map((snapshot) => snapshot.docs.length);
  }

  Stream<bool> _createHasBadgeStream(String uid) {
    ClubRepo.logCollection(ClubRepo.users, op: 'badges:$uid');
    return ClubRepo.userDoc(uid).snapshots().map((snapshot) {
      final badges = snapshot.data()?['badges'] ?? snapshot.data()?['Rozetler'];
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
          onPressed: _showSearchDialog,
          child: const Icon(Icons.search),
        );
      case 3:
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
          title: const Text('Kulüpler'),
          actions: [
            IconButton(
              tooltip: 'Kulüp ara',
              onPressed: () {},
              icon: const Icon(Icons.search),
            ),
          ],
        );
      case 3:
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
              onPressed: () => setState(() => currentIndex = 3),
              icon: const Icon(Icons.person),
            ),
          ],
        );
    }
  }

  Future<String?> _pickClub(BuildContext context) async {
    final snapshot = await ClubRepo.col(ClubRepo.clubs).get();
    if (!context.mounted) return null;
    if (snapshot.docs.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Önce bir kulüp oluşturun.')),
      );
      return null;
    }

    return showDialog<String>(
      context: context,
      builder: (context) => SimpleDialog(
        title: const Text('Kulüp seç'),
        children: snapshot.docs.map((doc) {
          final data = doc.data();
          final name = (data['name'] ?? data['ad'] ?? doc.id).toString();
          return SimpleDialogOption(
            onPressed: () => Navigator.pop(context, doc.id),
            child: Text(name),
          );
        }).toList(),
      ),
    );
  }

  Future<void> _openClubManage(BuildContext context, {
    required String role,
    required String clubId,
    int initialTabIndex = 0,
  }) async {
    var targetClubId = clubId;
    if (targetClubId.isEmpty && isAdminRole(role)) {
      targetClubId = await _pickClub(context) ?? '';
    }
    if (targetClubId.isEmpty) {
      if (context.mounted && !isAdminRole(role)) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Kulüp ataması gerekli.')),
        );
      }
      return;
    }
    if (!context.mounted) return;
    _openAdminScreen(
      ClubManageScreen(clubId: targetClubId, initialTabIndex: initialTabIndex),
    );
  }

  void _openAdminScreen(Widget screen) {
    Navigator.of(context).pop();
    Navigator.of(context).push(
      MaterialPageRoute<void>(builder: (_) => screen),
    );
  }

  Widget _buildDrawer({required String role, required String clubId}) {
    const destinations = [
      (icon: Icons.event_outlined, selectedIcon: Icons.event, label: 'Etkinlikler', index: 0),
      (icon: Icons.explore_outlined, selectedIcon: Icons.explore, label: 'Keşfet', index: 1),
      (icon: Icons.groups_outlined, selectedIcon: Icons.groups, label: 'Kulüpler', index: 2),
      (icon: Icons.person_outline, selectedIcon: Icons.person, label: 'Profil', index: 3),
    ];

    final admin = isAdminRole(role);
    final staff = isStaffRole(role);

    return Drawer(
      backgroundColor: AppTheme.surface,
      child: SafeArea(
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 28, 24, 20),
              child: Column(
                children: [
                  const AppLogo(),
                  const SizedBox(height: 12),
                  Text(
                    admin ? 'EventMint Admin' : 'EventMint',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  if (admin)
                    Text(
                      'Yönetim Paneli',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppTheme.textSecondary,
                      ),
                    ),
                ],
              ),
            ),
            const Divider(height: 1),
            ...destinations.map((item) {
              final selected = currentIndex == item.index;
              return ListTile(
                leading: Icon(selected ? item.selectedIcon : item.icon),
                title: Text(item.label),
                selected: selected,
                onTap: () {
                  Navigator.of(context).pop();
                  setState(() => currentIndex = item.index);
                },
              );
            }),
            if (staff) ...[
              const Divider(height: 1),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                child: Text(
                  'Yönetim',
                  style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    color: AppTheme.textSecondary,
                  ),
                ),
              ),
              ListTile(
                leading: const Icon(Icons.event_note_outlined),
                title: const Text('Etkinlik Yönetimi'),
                onTap: () => _openAdminScreen(
                  AdminEventsScreen(role: role, clubId: clubId),
                ),
              ),
              ListTile(
                leading: const Icon(Icons.groups_outlined),
                title: const Text('Kulübüm'),
                onTap: () => _openClubManage(context, role: role, clubId: clubId),
              ),
              ListTile(
                leading: const Icon(Icons.add_business_outlined),
                title: const Text('Kulüp Oluştur'),
                onTap: () => _openAdminScreen(const CreateClubScreen()),
              ),
            ],
            if (admin) ...[
              const Divider(height: 1),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                child: Text(
                  'Admin',
                  style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    color: AppTheme.textSecondary,
                  ),
                ),
              ),
              ListTile(
                leading: const Icon(Icons.people_outline),
                title: const Text('Kullanıcılar'),
                onTap: () => _openAdminScreen(const AdminUsersScreen()),
              ),
              ListTile(
                leading: const Icon(Icons.admin_panel_settings_outlined),
                title: const Text('Yöneticiler'),
                onTap: () => _openAdminScreen(const AdminManagersScreen()),
              ),
            ],
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<User?>(
      stream: FirebaseAuth.instance.authStateChanges(),
      builder: (context, authSnapshot) {
        if (authSnapshot.connectionState == ConnectionState.waiting) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }

        final user = authSnapshot.data;
        if (user == null) {
          return const LoginScreen();
        }

        return StreamBuilder<Map<String, dynamic>?>(
          stream: streamUserRecord(user.uid),
          builder: (context, userRecordSnapshot) {
            final userRecord = userRecordSnapshot.data ?? {};
            final role = normalizeUserRole(userRecord);
            final clubId = getUserClubId(userRecord);

            return StreamBuilder<int>(
              stream: _createRsvpCountStream(user.uid),
              builder: (context, rsvpSnapshot) {
                return StreamBuilder<bool>(
                  stream: _createHasBadgeStream(user.uid),
                  builder: (context, badgeSnapshot) {
                    final rsvpCount = rsvpSnapshot.data ?? 0;
                    final hasBadge = badgeSnapshot.data ?? false;

                    return Scaffold(
                      appBar: _buildAppBar(),
                      drawer: _buildDrawer(role: role, clubId: clubId),
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
                          const NavigationDestination(
                            icon: Icon(Icons.groups_outlined),
                            selectedIcon: Icon(Icons.groups),
                            label: 'Kulüpler',
                          ),
                          NavigationDestination(
                            icon: _profileBadgedIcon(
                              Icons.person_outline,
                              hasBadge,
                            ),
                            selectedIcon: _profileBadgedIcon(
                              Icons.person,
                              hasBadge,
                            ),
                            label: 'Profil',
                          ),
                        ],
                      ),
                    );
                  },
                );
              },
            );
          },
        );
      },
    );
  }
}
