import 'package:flutter/material.dart';

import '../shared/club_logos.dart';
import '../theme/app_theme.dart';

class ClubLogoAvatar extends StatefulWidget {
  const ClubLogoAvatar({
    super.key,
    required this.name,
    this.logoKey,
    this.logoUrl,
    this.size = 72,
    this.profileStyle = false,
  });

  final String name;
  final String? logoKey;
  final String? logoUrl;
  final double size;
  final bool profileStyle;

  @override
  State<ClubLogoAvatar> createState() => _ClubLogoAvatarState();
}

class _ClubLogoAvatarState extends State<ClubLogoAvatar> {
  var _networkFailed = false;
  var _assetFailed = false;

  @override
  void didUpdateWidget(covariant ClubLogoAvatar oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.logoKey != widget.logoKey ||
        oldWidget.logoUrl != widget.logoUrl) {
      _networkFailed = false;
      _assetFailed = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    final initial = widget.name.isNotEmpty
        ? widget.name.characters.first.toUpperCase()
        : '?';
    final fontSize = widget.size * 0.38;
    final assetPath = clubLogoAssetPath(widget.logoKey);
    final networkUrl = widget.logoUrl?.trim() ?? '';

    final decoration = widget.profileStyle
        ? BoxDecoration(
            shape: BoxShape.circle,
            color: const Color(0xFF111827),
            border: Border.all(color: const Color(0xFF7C3AED), width: 2),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF7C3AED).withValues(alpha: 0.35),
                blurRadius: 16,
              ),
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.45),
                blurRadius: 10,
                offset: const Offset(0, 4),
              ),
            ],
          )
        : BoxDecoration(
            shape: BoxShape.circle,
            color: AppTheme.surface2,
            boxShadow: [
              BoxShadow(
                color: AppTheme.brand.withValues(alpha: 0.28),
                blurRadius: 14,
                spreadRadius: 0,
              ),
            ],
          );

    if (assetPath != null && !_assetFailed) {
      return Container(
        width: widget.size,
        height: widget.size,
        decoration: decoration,
        clipBehavior: Clip.antiAlias,
        child: Padding(
          padding: EdgeInsets.all(widget.size * 0.08),
          child: Image.asset(
            assetPath,
            fit: BoxFit.contain,
            errorBuilder: (_, _, _) {
              WidgetsBinding.instance.addPostFrameCallback((_) {
                if (mounted) setState(() => _assetFailed = true);
              });
              return _LetterFallback(initial: initial, fontSize: fontSize);
            },
          ),
        ),
      );
    }

    if (networkUrl.isNotEmpty && !_networkFailed) {
      return Container(
        width: widget.size,
        height: widget.size,
        decoration: decoration,
        clipBehavior: Clip.antiAlias,
        child: Padding(
          padding: EdgeInsets.all(widget.size * 0.08),
          child: Image.network(
            networkUrl,
            fit: BoxFit.contain,
            errorBuilder: (_, _, _) {
              WidgetsBinding.instance.addPostFrameCallback((_) {
                if (mounted) setState(() => _networkFailed = true);
              });
              return _LetterFallback(initial: initial, fontSize: fontSize);
            },
          ),
        ),
      );
    }

    return Container(
      width: widget.size,
      height: widget.size,
      decoration: decoration,
      alignment: Alignment.center,
      child: _LetterFallback(initial: initial, fontSize: fontSize),
    );
  }
}

class _LetterFallback extends StatelessWidget {
  const _LetterFallback({
    required this.initial,
    required this.fontSize,
  });

  final String initial;
  final double fontSize;

  @override
  Widget build(BuildContext context) {
    return Text(
      initial,
      style: TextStyle(
        color: AppTheme.brand,
        fontWeight: FontWeight.w700,
        fontSize: fontSize,
      ),
    );
  }
}
