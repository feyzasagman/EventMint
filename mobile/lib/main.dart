import 'dart:ui';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'firebase_options.dart';
import 'services/user_record_service.dart';
import 'screens/banned_screen.dart';
import 'screens/home_shell.dart';
import 'screens/login_screen.dart';
import 'screens/splash_screen.dart';
import 'theme/app_theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  FlutterError.onError = (FlutterErrorDetails details) {
    FlutterError.presentError(details);
    debugPrint('FLUTTER_ERROR: ${details.exception}');
    debugPrint('${details.stack}');
  };
  PlatformDispatcher.instance.onError = (error, stack) {
    debugPrint('UNCAUGHT: $error');
    debugPrint('$stack');
    return true;
  };
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'EventMint',
      theme: AppTheme.dark(),
      home: const AuthGate(),
    );
  }
}

class AuthGate extends StatefulWidget {
  const AuthGate({super.key});

  @override
  State<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<AuthGate> {
  String? _checkedUid;
  Future<bool>? _bannedFuture;
  bool _showBannedScreen = false;

  Future<bool> _resolveBannedStatus(User user) async {
    final record = await getUserRecord(user.uid);
    final banned = record != null && isBanned(record);
    if (banned) {
      await FirebaseAuth.instance.signOut();
    }
    return banned;
  }

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<User?>(
      stream: FirebaseAuth.instance.authStateChanges(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const SplashScreen();
        }

        final user = snapshot.data;
        if (user == null) {
          if (_showBannedScreen) {
            return BannedScreen(
              onSignedOut: () => setState(() => _showBannedScreen = false),
            );
          }
          return const LoginScreen();
        }

        if (_checkedUid != user.uid) {
          _checkedUid = user.uid;
          _bannedFuture = _resolveBannedStatus(user);
        }

        return FutureBuilder<bool>(
          future: _bannedFuture,
          builder: (context, bannedSnapshot) {
            if (bannedSnapshot.connectionState == ConnectionState.waiting) {
              return const SplashScreen();
            }

            final isBanned = bannedSnapshot.data == true;
            if (isBanned) {
              if (!_showBannedScreen) {
                WidgetsBinding.instance.addPostFrameCallback((_) {
                  if (!mounted) return;
                  setState(() => _showBannedScreen = true);
                });
              }
              return BannedScreen(
                onSignedOut: () => setState(() => _showBannedScreen = false),
              );
            }

            if (_showBannedScreen) {
              WidgetsBinding.instance.addPostFrameCallback((_) {
                if (!mounted) return;
                setState(() => _showBannedScreen = false);
              });
            }

            return const HomeShell();
          },
        );
      },
    );
  }
}
