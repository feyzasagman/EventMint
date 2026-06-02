import { Timestamp, doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";

type UnknownRecord = Record<string, unknown>;

export type MergedBadge = {
  id: string;
  earnedAt?: Timestamp;
};

export type MergedUserRecord = {
  email: string;
  role: "admin" | "kulüp_yöneticisi" | "öğrenci";
  clubId: string;
  banned: boolean;
  points: number;
  badges: MergedBadge[];
};

function asRecord(value: unknown): UnknownRecord {
  return typeof value === "object" && value != null ? (value as UnknownRecord) : {};
}

function pickString(data: UnknownRecord, keys: string[]) {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function pickNumber(data: UnknownRecord, keys: string[]) {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "number") return value;
    if (typeof value === "string") {
      const parsed = Number(value);
      if (!Number.isNaN(parsed)) return parsed;
    }
  }
  return 0;
}

function normalizeRole(value: string) {
  const role = value.toLowerCase().trim();
  if (role === "admin") return "admin";
  if (
    role === "club_manager" ||
    role === "manager" ||
    role === "kulüp_yöneticisi" ||
    role === "kulup_yoneticisi"
  ) {
    return "kulüp_yöneticisi";
  }
  return "öğrenci";
}

function parseBadges(value: unknown): MergedBadge[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const badges: MergedBadge[] = [];

  for (const rawBadge of value) {
    const badge = asRecord(rawBadge);
    const id = String(badge.id ?? badge.badgeId ?? badge.title ?? "ROZET");
    if (seen.has(id)) continue;
    seen.add(id);
    badges.push({
      id,
      earnedAt: badge.earnedAt as Timestamp | undefined,
    });
  }
  return badges;
}

export async function getMergedUserRecord(uid: string): Promise<MergedUserRecord> {
  const [usersSnapshot, legacySnapshot] = await Promise.all([
    getDoc(doc(db, "users", uid)),
    getDoc(doc(db, "Kullanıcılar", uid)),
  ]);

  const usersData = usersSnapshot.exists() ? asRecord(usersSnapshot.data()) : {};
  const legacyData = legacySnapshot.exists() ? asRecord(legacySnapshot.data()) : {};
  const merged = { ...usersData, ...legacyData };

  return {
    email: pickString(merged, ["email", "e-posta", "Email"]),
    role: normalizeRole(pickString(merged, ["role", "Rol", "rol"])),
    clubId: pickString(merged, ["clubId", "Kulup", "kulup", "Kulüp"]),
    banned: merged.banned === true || merged.Banned === true,
    points: pickNumber(merged, ["Toplam puanlar", "points", "pointsTotal", "Puan"]),
    badges: parseBadges(merged.Rozetler ?? merged.rozetler ?? merged.badges),
  };
}
