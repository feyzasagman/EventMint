import {
  collection,
  onSnapshot,
  query,
  where,
  type FirestoreError,
  type Timestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { COL } from "./collections";
import { db } from "./firebase";
import { pickString } from "./profileData";

export type ClubMemberRow = {
  id: string;
  uid: string;
  clubId: string;
  displayName: string;
  role: string;
  joinedAt: Date | null;
};

function toDate(value: unknown): Date | null {
  if (value && typeof value === "object" && "toDate" in value) {
    return (value as Timestamp).toDate();
  }
  return null;
}

function mapMemberDoc(id: string, data: Record<string, unknown>): ClubMemberRow {
  return {
    id,
    uid: pickString(data, ["uid", "UID"]),
    clubId: pickString(data, ["clubId", "kulupId"]),
    displayName: pickString(data, ["displayName", "adSoyad", "name"]),
    role: pickString(data, ["role"]) || "member",
    joinedAt: toDate(data.joinedAt ?? data.katilimTarihi),
  };
}

export function subscribeClubMembers(
  clubId: string,
  onData: (members: ClubMemberRow[]) => void,
  onError?: (error: FirestoreError) => void
): Unsubscribe {
  const trimmedClubId = clubId.trim();
  const q = query(collection(db, COL.clubMembers), where("clubId", "==", trimmedClubId));

  return onSnapshot(
    q,
    (snapshot) => {
      const members = snapshot.docs
        .map((memberDoc) =>
          mapMemberDoc(memberDoc.id, memberDoc.data() as Record<string, unknown>)
        )
        .sort((a, b) => {
          const aTime = a.joinedAt?.getTime() ?? 0;
          const bTime = b.joinedAt?.getTime() ?? 0;
          return bTime - aTime;
        });
      onData(members);
    },
    onError
  );
}
