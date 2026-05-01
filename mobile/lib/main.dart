import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'firebase_options.dart';
import 'screens/events_list_screen.dart';
import 'screens/login_screen.dart';

Future<void> main() async {
  String? firebaseInitError;
  WidgetsFlutterBinding.ensureInitialized();
  if (!kIsWeb) {
    try {
      await Firebase.initializeApp(
        options: DefaultFirebaseOptions.currentPlatform,
      );
    } catch (error) {
      firebaseInitError = error.toString();
      // ignore: avoid_print
      print('Firebase init error: $error');
    }
  }
  runApp(MyApp(firebaseInitError: firebaseInitError));
}

class MyApp extends StatelessWidget {
  const MyApp({super.key, this.firebaseInitError});

  final String? firebaseInitError;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'EventMint',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.deepPurple),
      ),
      home: kIsWeb
          ? DebugHomeScreen(firebaseInitError: firebaseInitError)
          : AuthGate(firebaseInitError: firebaseInitError),
    );
  }
}

class AuthGate extends StatelessWidget {
  const AuthGate({super.key, this.firebaseInitError});

  final String? firebaseInitError;

  @override
  Widget build(BuildContext context) {
    if (firebaseInitError != null) {
      return DebugHomeScreen(firebaseInitError: firebaseInitError);
    }

    return StreamBuilder<User?>(
      stream: FirebaseAuth.instance.authStateChanges(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }

        if (snapshot.data == null) {
          return const LoginScreen();
        }

        return const EventsListScreen();
      },
    );
  }
}

class DebugHomeScreen extends StatelessWidget {
  const DebugHomeScreen({super.key, this.firebaseInitError});

  final String? firebaseInitError;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('EventMint')),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                'EventMint OK',
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              const Text('Uygulama acildi'),
              const SizedBox(height: 12),
              if (!kIsWeb && firebaseInitError != null)
                Text(
                  'Firebase init error: $firebaseInitError',
                  style: const TextStyle(color: Colors.red),
                  textAlign: TextAlign.center,
                ),
              const SizedBox(height: 12),
              ElevatedButton(
                onPressed: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const EventsListScreen()),
                  );
                },
                child: const Text('Events ekranına git'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
