import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
} from "firebase/firestore";
import { awardCheckinBadges } from "./badgeAward";
import { COL } from "./collections";
import { db } from "./firebase";

export type CheckinResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function submitQrCheckin(rawCode: string, uid: string): Promise<CheckinResult> {
  const parts = rawCode.trim().split("|");
  if (parts.length !== 2 || parts.some((part) => !part.trim())) {
    return { ok: false, message: "Kod formatı hatalı. sessionId|nonce şeklinde olmalı." };
  }

  const sessionId = parts[0].trim();
  const nonce = parts[1].trim();
  const sessionDoc = await getDoc(doc(db, COL.sessions, sessionId));

  if (!sessionDoc.exists()) {
    return { ok: false, message: "Geçersiz QR." };
  }

  const sessionData = sessionDoc.data();
  if (sessionData.active !== true) {
    return { ok: false, message: "Oturum kapalı." };
  }

  const expiresAt = sessionData.expiresAt;
  if (!(expiresAt instanceof Timestamp)) {
    return { ok: false, message: "Geçersiz QR." };
  }

  if (expiresAt.toDate().getTime() <= Date.now()) {
    return { ok: false, message: "Süre doldu." };
  }

  if (sessionData.nonce !== nonce) {
    return { ok: false, message: "Geçersiz QR." };
  }

  const eventId = sessionData.eventId;
  if (typeof eventId !== "string" || !eventId.trim()) {
    return { ok: false, message: "Geçersiz QR." };
  }

  const checkinRef = doc(db, COL.checkins, `${eventId}_${uid}`);
  const existingCheckin = await getDoc(checkinRef);
  if (existingCheckin.exists()) {
    return { ok: false, message: "Zaten check-in yaptın." };
  }

  await setDoc(checkinRef, {
    eventId,
    sessionId,
    uid,
    checkinAt: serverTimestamp(),
  });

  const reward = await awardCheckinBadges(uid);
  const badgeMessage =
    reward.newBadgeLabels.length > 0
      ? ` Yeni rozet: ${reward.newBadgeLabels.join(", ")}`
      : "";

  if (reward.pointsUpdated) {
    return {
      ok: true,
      message: `Check-in başarılı ✅ +10 puan kazandın${badgeMessage}`,
    };
  }

  const syncedLabels = reward.newBadgeLabels;
  if (syncedLabels.length > 0) {
    return { ok: true, message: `Check-in kaydedildi.${badgeMessage}` };
  }

  return { ok: true, message: "Check-in kaydedildi. Puan güncellenemedi." };
}
