import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

class TagChip extends StatelessWidget {
  const TagChip({
    super.key,
    required this.label,
    this.backgroundColor,
    this.foregroundColor,
    this.compact = true,
  });

  final String label;
  final Color? backgroundColor;
  final Color? foregroundColor;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: compact ? 28 : 32,
      padding: EdgeInsets.symmetric(horizontal: compact ? 10 : 12),
      decoration: BoxDecoration(
        color: backgroundColor ?? AppTheme.surface2,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: AppTheme.border),
      ),
      alignment: Alignment.center,
      child: Text(
        label,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
          color: foregroundColor ?? AppTheme.textSecondary,
          fontWeight: FontWeight.w600,
          height: 1.0,
        ),
      ),
    );
  }
}
