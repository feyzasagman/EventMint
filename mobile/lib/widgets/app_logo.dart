import 'package:flutter/material.dart';

class AppLogo extends StatelessWidget {
  const AppLogo({super.key, this.size = 72});

  static const assetPath = 'assets/images/logo.png';

  final double size;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: Image.asset(
        assetPath,
        fit: BoxFit.contain,
      ),
    );
  }
}
