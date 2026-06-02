import 'package:flutter/material.dart';

class SecondaryButton extends StatelessWidget {
  const SecondaryButton({
    super.key,
    required this.label,
    this.onPressed,
    this.icon,
    this.compact = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final baseStyle = Theme.of(context).outlinedButtonTheme.style;
    final style = (baseStyle ?? const ButtonStyle()).copyWith(
      minimumSize: WidgetStatePropertyAll(Size(0, compact ? 32 : 40)),
      padding: WidgetStatePropertyAll(
        EdgeInsets.symmetric(horizontal: compact ? 12 : 16),
      ),
      visualDensity: compact ? VisualDensity.compact : VisualDensity.standard,
      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
      textStyle: WidgetStatePropertyAll(
        TextStyle(fontSize: compact ? 12 : 14, fontWeight: FontWeight.w600),
      ),
    );
    if (icon == null) {
      return OutlinedButton(
        style: style,
        onPressed: onPressed,
        child: Text(label),
      );
    }
    return OutlinedButton.icon(
      style: style,
      onPressed: onPressed,
      icon: Icon(icon, size: compact ? 16 : 18),
      label: Text(label),
    );
  }
}
