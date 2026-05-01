import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _isLoading = false;
  String? _errorText;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _signIn() async {
    await _runAuthAction(() async {
      final credential = await FirebaseAuth.instance.signInWithEmailAndPassword(
        email: _emailController.text.trim(),
        password: _passwordController.text,
      );
      await _ensureUserDocument(credential.user);
    });
  }

  Future<void> _register() async {
    await _runAuthAction(() async {
      final email = _emailController.text.trim();
      final password = _passwordController.text;
      UserCredential credential;

      try {
        credential = await FirebaseAuth.instance.createUserWithEmailAndPassword(
          email: email,
          password: password,
        );
      } on FirebaseAuthException catch (e) {
        if (e.code != 'email-already-in-use') {
          rethrow;
        }

        // ignore: avoid_print
        print('AUTH ERROR: ${e.code} ${e.message}');
        const message = 'Bu email kayıtlı, giriş yapılıyor...';
        if (mounted) {
          setState(() => _errorText = message);
        }
        _showSnackBar(message);

        credential = await FirebaseAuth.instance.signInWithEmailAndPassword(
          email: email,
          password: password,
        );
      }

      await _ensureUserDocument(credential.user);
    });
  }

  Future<void> _runAuthAction(Future<void> Function() action) async {
    setState(() {
      _isLoading = true;
      _errorText = null;
    });

    try {
      await action();
    } on FirebaseAuthException catch (e) {
      final message = _authErrorMessage(e);
      // ignore: avoid_print
      print('AUTH ERROR: ${e.code} ${e.message}');
      if (mounted) {
        setState(() => _errorText = message);
      }
      _showSnackBar(message);
    } catch (error) {
      final message = 'Auth işlemi başarısız oldu: $error';
      if (mounted) {
        setState(() => _errorText = message);
      }
      _showSnackBar(message);
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  String _authErrorMessage(FirebaseAuthException error) {
    final message = switch (error.code) {
      'weak-password' => 'Şifre çok zayıf. En az 6 karakter deneyin.',
      'invalid-email' => 'Geçerli bir email adresi girin.',
      'operation-not-allowed' =>
        'Email/password girişi Firebase Console üzerinde kapalı.',
      'wrong-password' => 'Email veya şifre hatalı.',
      'user-not-found' => 'Bu email ile kayıtlı kullanıcı bulunamadı.',
      'invalid-credential' => 'Email veya şifre hatalı.',
      _ => error.message ?? 'Auth işlemi başarısız oldu.',
    };

    return '${error.code}: $message';
  }

  Future<void> _ensureUserDocument(User? user) async {
    if (user == null) return;

    final ref = FirebaseFirestore.instance
        .collection('Kullanıcılar')
        .doc(user.uid);
    final snapshot = await ref.get();
    if (snapshot.exists) return;

    await ref.set({
      'email': user.email ?? _emailController.text.trim(),
      'role': 'student',
      'createdAt': FieldValue.serverTimestamp(),
    });
  }

  void _showSnackBar(String message) {
    if (!mounted) return;

    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Giriş')),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  'EventMint',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
                const SizedBox(height: 24),
                TextField(
                  controller: _emailController,
                  keyboardType: TextInputType.emailAddress,
                  autofillHints: const [AutofillHints.email],
                  decoration: const InputDecoration(
                    labelText: 'Email',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _passwordController,
                  obscureText: true,
                  autofillHints: const [AutofillHints.password],
                  decoration: const InputDecoration(
                    labelText: 'Password',
                    border: OutlineInputBorder(),
                  ),
                ),
                if (_errorText != null) ...[
                  const SizedBox(height: 12),
                  Text(
                    _errorText!,
                    style: const TextStyle(color: Colors.red),
                    textAlign: TextAlign.center,
                  ),
                ],
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: _isLoading ? null : _signIn,
                  child: Text(_isLoading ? 'Bekleyin...' : 'Giriş Yap'),
                ),
                const SizedBox(height: 8),
                OutlinedButton(
                  onPressed: _isLoading ? null : _register,
                  child: const Text('Kayıt Ol'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
