import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type FirestoreError,
  type Timestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { COL } from "./collections";
import { db } from "./firebase";

export type ClubApplication = {
  id: string;
  uid: string;
  clubId: string;
  status: string;
  fullName: string;
  department: string;
  studentNo: string;
  motivation: string;
  createdAt: Date | null;
};

function pickString(data: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function toDate(value: unknown): Date | null {
  if (value && typeof value === "object" && "toDate" in value) {
    return (value as Timestamp).toDate();
  }
  return null;
}

function mapApplicationDoc(id: string, data: Record<string, unknown>): ClubApplication {
  return {
    id,
    uid: pickString(data, ["uid"]),
    clubId: pickString(data, ["clubId"]),
    status: pickString(data, ["status"]).toLowerCase(),
    fullName: pickString(data, ["adSoyad", "fullName"]),
    department: pickString(data, ["bolum", "department"]),
    studentNo: pickString(data, ["ogrNo", "studentNo"]),
    motivation: pickString(data, ["motivasyon", "motivation"]),
    createdAt: toDate(data.createdAt ?? data.olusturulduAt),
  };
}

export function subscribeClubApplications(
  clubId: string,
  onData: (applications: ClubApplication[]) => void,
  onError?: (error: FirestoreError) => void
): Unsubscribe {
  const trimmedClubId = clubId.trim();
  const q = query(
    collection(db, COL.clubApplications),
    where("clubId", "==", trimmedClubId)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const applications = snapshot.docs
        .map((applicationDoc) =>
          mapApplicationDoc(
            applicationDoc.id,
            applicationDoc.data() as Record<string, unknown>
          )
        )
        .filter((application) => application.status === "pending")
        .sort((a, b) => {
          const aTime = a.createdAt?.getTime() ?? 0;
          const bTime = b.createdAt?.getTime() ?? 0;
          return bTime - aTime;
        });
      onData(applications);
    },
    onError
  );
}

export async function approveClubApplication(params: {
  applicationId: string;
  clubId: string;
  applicantUid: string;
  reviewerUid: string;
  displayName?: string;
}) {
  const batch = writeBatch(db);
  batch.update(doc(db, COL.clubApplications, params.applicationId), {
    status: "approved",
    reviewedAt: serverTimestamp(),
    reviewedByUid: params.reviewerUid,
  });
  batch.set(doc(db, COL.clubMembers, `${params.clubId}_${params.applicantUid}`), {
    clubId: params.clubId,
    uid: params.applicantUid,
    joinedAt: serverTimestamp(),
    role: "member",
    ...(params.displayName ? { displayName: params.displayName } : {}),
  });
  await batch.commit();
}

export async function rejectClubApplication(params: {
  applicationId: string;
  reviewerUid: string;
}) {
  await updateDoc(doc(db, COL.clubApplications, params.applicationId), {
    status: "rejected",
    reviewedAt: serverTimestamp(),
    reviewedByUid: params.reviewerUid,
  });
}
