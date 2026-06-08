import type { Timestamp } from "firebase/firestore";

export type BadgeId =
  | "FIRST_ATTEND"
  | "STREAK_3"
  | "STREAK_10"
  | "CLUB_MEMBER"
  | "ORGANIZER"
  | "HELPER"
  | "EXPLORER"
  | "EARLY_BIRD";

export type BadgeDefinition = {
  id: BadgeId;
  title: string;
  subtitle: string;
  imagePath: string;
  glow: string;
};

export type EarnedBadge = {
  id: string;
  earnedAt?: Timestamp | Date;
};

export const BADGE_CATALOG: Record<BadgeId, BadgeDefinition> = {
  FIRST_ATTEND: {
    id: "FIRST_ATTEND",
    title: "İlk Katılım",
    subtitle: "İlk etkinlik check-in",
    imagePath: "/badges/first_attend.png",
    glow: "rgba(109, 94, 247, 0.35)",
  },
  STREAK_3: {
    id: "STREAK_3",
    title: "3'lü Seri",
    subtitle: "3 etkinliğe katıldın",
    imagePath: "/badges/streak_3.png",
    glow: "rgba(34, 211, 238, 0.35)",
  },
  STREAK_10: {
    id: "STREAK_10",
    title: "10'lu Seri",
    subtitle: "10 etkinliğe katıldın",
    imagePath: "/badges/streak_10.png",
    glow: "rgba(245, 158, 11, 0.35)",
  },
  CLUB_MEMBER: {
    id: "CLUB_MEMBER",
    title: "Kulüp Üyesi",
    subtitle: "Kulüp üyeliği tamamlandı",
    imagePath: "/badges/club_member.png",
    glow: "rgba(167, 139, 250, 0.35)",
  },
  ORGANIZER: {
    id: "ORGANIZER",
    title: "Organizatör",
    subtitle: "Etkinlik düzenledin",
    imagePath: "/badges/organizer.png",
    glow: "rgba(109, 94, 247, 0.35)",
  },
  HELPER: {
    id: "HELPER",
    title: "Gönüllü",
    subtitle: "Topluluğa destek oldun",
    imagePath: "/badges/helper.png",
    glow: "rgba(52, 211, 153, 0.35)",
  },
  EXPLORER: {
    id: "EXPLORER",
    title: "Keşifçi",
    subtitle: "Yeni etkinlikler keşfettin",
    imagePath: "/badges/explorer.png",
    glow: "rgba(96, 165, 250, 0.35)",
  },
  EARLY_BIRD: {
    id: "EARLY_BIRD",
    title: "Erken Katılım",
    subtitle: "İlk RSVP kaydın",
    imagePath: "/badges/early_bird.png",
    glow: "rgba(244, 114, 182, 0.35)",
  },
};

export const BADGE_ORDER: BadgeId[] = [
  "FIRST_ATTEND",
  "STREAK_3",
  "STREAK_10",
  "EARLY_BIRD",
  "CLUB_MEMBER",
  "ORGANIZER",
  "HELPER",
  "EXPLORER",
];

const BADGE_LEGACY_ALIASES: Record<string, BadgeId> = {
  FIVE_ATTENDS: "STREAK_3",
  TEN_ATTENDS: "STREAK_10",
  FIRST_RSVP: "EARLY_BIRD",
};

export function pickBadgeArray(data: Record<string, unknown>): unknown {
  return data.badges ?? data.Rozetler ?? data.rozetler ?? data.Badges ?? [];
}

export function getBadgeDefinition(id: string): BadgeDefinition | null {
  const resolved = (id in BADGE_CATALOG ? id : BADGE_LEGACY_ALIASES[id]) as BadgeId | undefined;
  if (!resolved || !(resolved in BADGE_CATALOG)) return null;
  return BADGE_CATALOG[resolved];
}

export function formatBadgeDate(value?: Timestamp | Date): string {
  if (!value) return "-";
  const date = value instanceof Date ? value : value.toDate();
  return date.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function resolveBadgeId(id: string): BadgeId | null {
  if (id in BADGE_CATALOG) return id as BadgeId;
  return BADGE_LEGACY_ALIASES[id] ?? null;
}

export function buildEarnedBadgeMap(badges: EarnedBadge[]): Map<BadgeId, EarnedBadge> {
  const map = new Map<BadgeId, EarnedBadge>();
  for (const badge of badges) {
    const canonical = resolveBadgeId(badge.id);
    if (!canonical || map.has(canonical)) continue;
    map.set(canonical, { ...badge, id: canonical });
  }
  return map;
}

export function splitBadgeSections(badges: EarnedBadge[]) {
  const earnedMap = buildEarnedBadgeMap(badges);
  const earned = BADGE_ORDER.filter((id) => earnedMap.has(id)).map((id) => ({
    definition: BADGE_CATALOG[id],
    earned: earnedMap.get(id)!,
  }));
  const locked = BADGE_ORDER.filter((id) => !earnedMap.has(id)).map((id) => BADGE_CATALOG[id]);
  return { earned, locked };
}

export const POINTS_GOAL = 100;

export function pointsProgress(points: number) {
  const safe = Math.max(0, points);
  return {
    current: safe,
    goal: POINTS_GOAL,
    percent: Math.min(100, (safe / POINTS_GOAL) * 100),
  };
}
