import 'package:flutter/material.dart';

import '../theme/app_theme.dart';
import '../widgets/app_logo.dart';

class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key, this.showLoader = true});

  final bool showLoader;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.background,
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const AppLogo(),
            if (showLoader) ...[
              const SizedBox(height: 24),
              const CircularProgressIndicator(),
            ],
          ],
        ),
      ),
    );
  }
}
