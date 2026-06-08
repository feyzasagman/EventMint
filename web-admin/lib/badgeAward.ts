import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { COL } from "./collections";
import { db } from "./firebase";

const BADGE_TITLES: Record<string, string> = {
  FIRST_ATTEND: "İlk Katılım",
  STREAK_3: "3'lü Seri",
  STREAK_10: "10'lu Seri",
};

function pickBadgeList(data: Record<string, unknown> | undefined): unknown {
  if (!data) return [];
  return data.badges ?? data.Rozetler ?? data.rozetler ?? data.Badges ?? [];
}

function existingBadgeIds(userData: Record<string, unknown> | undefined): Set<string> {
  const ids = new Set<string>();
  const raw = pickBadgeList(userData);
  if (!Array.isArray(raw)) return ids;

  for (const badge of raw) {
    if (!badge || typeof badge !== "object") continue;
    const id = String((badge as { id?: unknown }).id ?? "").trim();
    if (id) ids.add(id);
  }
  return ids;
}

function checkinBadgeIdsForCount(count: number, owned: Set<string>): string[] {
  const ids: string[] = [];
  if (count >= 1 && !owned.has("FIRST_ATTEND")) ids.push("FIRST_ATTEND");
  if (count >= 3 && !owned.has("STREAK_3") && !owned.has("FIVE_ATTENDS")) ids.push("STREAK_3");
  if (count >= 10 && !owned.has("STREAK_10") && !owned.has("TEN_ATTENDS")) ids.push("STREAK_10");
  return ids;
}

async function countUserCheckins(uid: string): Promise<number> {
  const snapshot = await getDocs(query(collection(db, COL.checkins), where("uid", "==", uid)));
  return snapshot.size;
}

async function awardBadges(uid: string, badgeIds: string[]): Promise<string[]> {
  if (badgeIds.length === 0) return [];

  const userRef = doc(db, COL.users, uid);
  const userDoc = await getDoc(userRef);
  const owned = existingBadgeIds(userDoc.data());
  const earnedAt = Timestamp.now();
  const toAdd: Array<{ id: string; earnedAt: Timestamp }> = [];
  const labels: string[] = [];

  for (const badgeId of badgeIds) {
    if (owned.has(badgeId)) continue;
    toAdd.push({ id: badgeId, earnedAt });
    labels.push(BADGE_TITLES[badgeId] ?? badgeId);
  }

  if (toAdd.length === 0) return [];

  await setDoc(
    userRef,
    {
      Rozetler: arrayUnion(...toAdd),
      lastBadgeWrite: serverTimestamp(),
    },
    { merge: true }
  );

  return labels;
}

export async function syncCheckinBadges(uid: string): Promise<string[]> {
  try {
    const userDoc = await getDoc(doc(db, COL.users, uid));
    const owned = existingBadgeIds(userDoc.data());
    const checkinCount = await countUserCheckins(uid);
    const badgeIds = checkinBadgeIdsForCount(checkinCount, owned);
    return awardBadges(uid, badgeIds);
  } catch {
    return [];
  }
}

export async function awardCheckinBadges(uid: string): Promise<{
  pointsUpdated: boolean;
  newBadgeLabels: string[];
}> {
  try {
    const userRef = doc(db, COL.users, uid);
    const userDoc = await getDoc(userRef);
    const owned = existingBadgeIds(userDoc.data());
    const checkinCount = await countUserCheckins(uid);
    const badgeIds = checkinBadgeIdsForCount(checkinCount, owned);

    await setDoc(
      userRef,
      {
        pointsTotal: increment(10),
        lastBadgeWrite: serverTimestamp(),
      },
      { merge: true }
    );

    const labels = await awardBadges(uid, badgeIds);
    return { pointsUpdated: true, newBadgeLabels: labels };
  } catch {
    return { pointsUpdated: false, newBadgeLabels: [] };
  }
}
