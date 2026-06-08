enum BadgeId {
  firstAttend('FIRST_ATTEND'),
  streak3('STREAK_3'),
  streak10('STREAK_10'),
  clubMember('CLUB_MEMBER'),
  organizer('ORGANIZER'),
  helper('HELPER'),
  explorer('EXPLORER'),
  earlyBird('EARLY_BIRD');

  const BadgeId(this.value);
  final String value;

  static BadgeId? tryParse(String raw) {
    final normalized = raw.trim();
    for (final item in BadgeId.values) {
      if (item.value == normalized) return item;
    }
    return null;
  }
}

class BadgeDefinition {
  const BadgeDefinition({
    required this.id,
    required this.title,
    required this.subtitle,
    required this.assetPath,
  });

  final BadgeId id;
  final String title;
  final String subtitle;
  final String assetPath;
}

const badgeCatalog = <BadgeId, BadgeDefinition>{
  BadgeId.firstAttend: BadgeDefinition(
    id: BadgeId.firstAttend,
    title: 'İlk Katılım',
    subtitle: 'İlk etkinlik check-in',
    assetPath: 'assets/badges/first_attend.png',
  ),
  BadgeId.streak3: BadgeDefinition(
    id: BadgeId.streak3,
    title: "3'lü Seri",
    subtitle: '3 etkinliğe katıldın',
    assetPath: 'assets/badges/streak_3.png',
  ),
  BadgeId.streak10: BadgeDefinition(
    id: BadgeId.streak10,
    title: "10'lu Seri",
    subtitle: '10 etkinliğe katıldın',
    assetPath: 'assets/badges/streak_10.png',
  ),
  BadgeId.clubMember: BadgeDefinition(
    id: BadgeId.clubMember,
    title: 'Kulüp Üyesi',
    subtitle: 'Kulüp üyeliği tamamlandı',
    assetPath: 'assets/badges/club_member.png',
  ),
  BadgeId.organizer: BadgeDefinition(
    id: BadgeId.organizer,
    title: 'Organizatör',
    subtitle: 'Etkinlik düzenledin',
    assetPath: 'assets/badges/organizer.png',
  ),
  BadgeId.helper: BadgeDefinition(
    id: BadgeId.helper,
    title: 'Gönüllü',
    subtitle: 'Topluluğa destek oldun',
    assetPath: 'assets/badges/helper.png',
  ),
  BadgeId.explorer: BadgeDefinition(
    id: BadgeId.explorer,
    title: 'Keşifçi',
    subtitle: 'Yeni etkinlikler keşfettin',
    assetPath: 'assets/badges/explorer.png',
  ),
  BadgeId.earlyBird: BadgeDefinition(
    id: BadgeId.earlyBird,
    title: 'Erken Katılım',
    subtitle: 'İlk RSVP kaydın',
    assetPath: 'assets/badges/early_bird.png',
  ),
};

const badgeOrder = <BadgeId>[
  BadgeId.firstAttend,
  BadgeId.streak3,
  BadgeId.streak10,
  BadgeId.earlyBird,
  BadgeId.clubMember,
  BadgeId.organizer,
  BadgeId.helper,
  BadgeId.explorer,
];

/// Eski Firestore rozet ID'leri → yeni katalog (geriye dönük uyumluluk).
const badgeLegacyAliases = <String, BadgeId>{
  'FIVE_ATTENDS': BadgeId.streak3,
  'TEN_ATTENDS': BadgeId.streak10,
  'FIRST_RSVP': BadgeId.earlyBird,
};

BadgeDefinition? badgeDefinitionFor(String id) {
  final parsed = BadgeId.tryParse(id) ?? badgeLegacyAliases[id];
  if (parsed == null) return null;
  return badgeCatalog[parsed];
}

String badgeTitleFor(String id) => badgeDefinitionFor(id)?.title ?? id;

BadgeId? resolveBadgeId(String id) {
  return BadgeId.tryParse(id) ?? badgeLegacyAliases[id];
}

Map<BadgeId, Map<String, dynamic>> buildEarnedBadgeMap(
  List<Map<String, dynamic>> badges,
) {
  final map = <BadgeId, Map<String, dynamic>>{};
  for (final badge in badges) {
    final rawId = badge['id']?.toString() ?? '';
    final canonical = resolveBadgeId(rawId);
    if (canonical == null || map.containsKey(canonical)) continue;
    map[canonical] = {
      'id': canonical.value,
      'earnedAt': badge['earnedAt'],
    };
  }
  return map;
}

({List<Map<String, dynamic>> earned, List<BadgeDefinition> locked}) splitBadgeSections(
  List<Map<String, dynamic>> badges,
) {
  final earnedMap = buildEarnedBadgeMap(badges);
  final earned = <Map<String, dynamic>>[];
  final locked = <BadgeDefinition>[];

  for (final badgeId in badgeOrder) {
    final definition = badgeCatalog[badgeId]!;
    if (earnedMap.containsKey(badgeId)) {
      earned.add(earnedMap[badgeId]!);
    } else {
      locked.add(definition);
    }
  }

  return (earned: earned, locked: locked);
}

const pointsGoal = 100;

double pointsProgressPercent(num points) {
  final safe = points < 0 ? 0 : points.toDouble();
  return (safe / pointsGoal * 100).clamp(0, 100);
}

Object? pickBadgeList(Map<String, dynamic> data) {
  return data['badges'] ??
      data['Rozetler'] ??
      data['rozetler'] ??
      data['Badges'] ??
      [];
}
