import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";

export async function getUserRole(uid: string): Promise<"student" | "manager" | "club_manager" | "admin" | null> {
  const userRef = doc(db, "users", uid);
  const snapshot = await getDoc(userRef);

  if (!snapshot.exists()) {
    return null;
  }

  const role = snapshot.data()?.role;
  if (role === "student" || role === "manager" || role === "club_manager" || role === "admin") {
    return role;
  }

  return null;
}
