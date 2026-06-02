import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";

export type UserRecord = {
  role?: string;
  banned?: boolean;
  clubId?: string;
};

export async function getUserRecord(uid: string): Promise<UserRecord> {
  const snapshot = await getDoc(doc(db, "users", uid));
  if (!snapshot.exists()) {
    return {};
  }

  const data = snapshot.data() as Record<string, unknown>;
  return {
    role: typeof data.role === "string" ? data.role : undefined,
    banned: data.banned === true,
    clubId: typeof data.clubId === "string" ? data.clubId : undefined,
  };
}

export async function isUserBanned(uid: string): Promise<boolean> {
  const record = await getUserRecord(uid);
  return record.banned === true;
}
