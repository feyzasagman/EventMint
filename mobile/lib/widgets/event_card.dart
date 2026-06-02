import 'package:flutter/material.dart';

import 'app_card.dart';
import 'tag_chip.dart';

class EventCard extends StatelessWidget {
  const EventCard({
    super.key,
    required this.title,
    required this.clubId,
    required this.category,
    required this.location,
    required this.tags,
    required this.onTap,
    this.trailingActions,
  });

  final String title;
  final String clubId;
  final String category;
  final String location;
  final List<String> tags;
  final VoidCallback onTap;
  final Widget? trailingActions;

  @override
  Widget build(BuildContext context) {
    final visibleTags = tags.take(2).toList();
    final hiddenTagCount = tags.length - visibleTags.length;

    return AppCard(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  title.isEmpty ? '(Başlık yok)' : title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontSize: 17,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              _CategoryChip(category: category),
            ],
          ),
          const SizedBox(height: 10),
          _InfoLine(icon: Icons.groups, text: clubId.isEmpty ? '-' : clubId),
          const SizedBox(height: 6),
          _InfoLine(icon: Icons.place, text: location.isEmpty ? '-' : location),
          const SizedBox(height: 12),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              ...visibleTags.map((tag) => TagChip(label: tag)),
              if (hiddenTagCount > 0) TagChip(label: '+$hiddenTagCount'),
            ],
          ),
          if (trailingActions != null) ...[
            const SizedBox(height: 12),
            Align(alignment: Alignment.centerRight, child: trailingActions!),
          ],
        ],
      ),
    );
  }
}

class _InfoLine extends StatelessWidget {
  const _InfoLine({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 16, color: Theme.of(context).colorScheme.primary),
        const SizedBox(width: 6),
        Expanded(
          child: Text(
            text,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              fontSize: 12,
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
        ),
      ],
    );
  }
}

class _CategoryChip extends StatelessWidget {
  const _CategoryChip({required this.category});

  final String category;

  @override
  Widget build(BuildContext context) {
    final label = category.isEmpty ? '-' : category;

    return TagChip(label: label);
  }
}
