import {
  collection,
  doc,
  FirestoreError,
  getDoc,
  getDocs,
  onSnapshot,
  QueryDocumentSnapshot,
  QuerySnapshot,
  setDoc,
  Unsubscribe,
} from "firebase/firestore";
import { COL } from "./collections";
import { db } from "./firebase";

export type ClubListItem = {
  id: string;
  label: string;
};

export type ClubRecord = {
  id: string;
  data: Record<string, unknown>;
  sourceCollection: string;
};

let resolvedClubsCollection: string | null = null;

function pickString(data: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

export function clubLabelFromData(data: Record<string, unknown>, fallbackId: string) {
  return pickString(data, ["ad", "Reklam", "name", "title", "Ad"]) || fallbackId;
}

export function mapClubDocs(docs: QueryDocumentSnapshot[]): ClubListItem[] {
  return docs.map((clubDoc) => {
    const data = clubDoc.data() as Record<string, unknown>;
    return {
      id: clubDoc.id,
      label: clubLabelFromData(data, clubDoc.id),
    };
  });
}

export function mapClubSnapshot(snapshot: QuerySnapshot): ClubListItem[] {
  return mapClubDocs(snapshot.docs);
}

async function resolveClubsCollection(): Promise<string> {
  if (resolvedClubsCollection) return resolvedClubsCollection;

  const primary = await getDocs(collection(db, COL.clubs));
  resolvedClubsCollection = primary.empty ? COL.clubsLegacy : COL.clubs;
  return resolvedClubsCollection;
}

export async function listClubs(): Promise<ClubListItem[]> {
  const collectionName = await resolveClubsCollection();
  const snapshot = await getDocs(collection(db, collectionName));
  return mapClubSnapshot(snapshot);
}

export async function getClub(clubId: string): Promise<ClubRecord | null> {
  const trimmedId = clubId.trim();
  if (!trimmedId) return null;

  const primary = await getDoc(doc(db, COL.clubs, trimmedId));
  if (primary.exists()) {
    return {
      id: trimmedId,
      data: primary.data() as Record<string, unknown>,
      sourceCollection: COL.clubs,
    };
  }

  const legacy = await getDoc(doc(db, COL.clubsLegacy, trimmedId));
  if (legacy.exists()) {
    return {
      id: trimmedId,
      data: legacy.data() as Record<string, unknown>,
      sourceCollection: COL.clubsLegacy,
    };
  }

  return null;
}

export function subscribeClubs(
  onData: (clubs: ClubListItem[]) => void,
  onError?: (error: FirestoreError) => void
): Unsubscribe {
  let unsubscribe: Unsubscribe | null = null;
  let cancelled = false;

  void (async () => {
    try {
      const collectionName = await resolveClubsCollection();
      if (cancelled) return;
      unsubscribe = onSnapshot(
        collection(db, collectionName),
        (snapshot) => onData(mapClubSnapshot(snapshot)),
        onError
      );
    } catch (error) {
      onError?.(error as FirestoreError);
    }
  })();

  return () => {
    cancelled = true;
    unsubscribe?.();
  };
}

export function subscribeClub(
  clubId: string,
  onData: (data: Record<string, unknown> | null) => void,
  onError?: (error: FirestoreError) => void
): Unsubscribe {
  let unsubscribe: Unsubscribe | null = null;
  let cancelled = false;

  void (async () => {
    try {
      const club = await getClub(clubId);
      const collectionName = club?.sourceCollection ?? (await resolveClubsCollection());
      if (cancelled) return;
      unsubscribe = onSnapshot(
        doc(db, collectionName, clubId),
        (snapshot) => {
          onData(snapshot.exists() ? (snapshot.data() as Record<string, unknown>) : null);
        },
        onError
      );
    } catch (error) {
      onError?.(error as FirestoreError);
    }
  })();

  return () => {
    cancelled = true;
    unsubscribe?.();
  };
}

export async function saveClub(clubId: string, data: Record<string, unknown>) {
  const trimmedId = clubId.trim();
  if (!trimmedId) {
    throw new Error("clubId gerekli.");
  }

  const existing = await getClub(trimmedId);
  const collectionName = existing?.sourceCollection ?? COL.clubs;
  await setDoc(doc(db, collectionName, trimmedId), data, { merge: true });
}
