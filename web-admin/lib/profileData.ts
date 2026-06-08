import { doc, getDoc, Timestamp } from "firebase/firestore";
import { COL } from "./collections";
import { db } from "./firebase";

export function pickString(data: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

export function formatProfileDate(value?: Timestamp) {
  return value?.toDate().toLocaleString("tr-TR") ?? "-";
}

export async function resolveEventTitle(eventId?: string) {
  if (!eventId) return "Etkinlik bilinmiyor";

  const legacy = await getDoc(doc(db, COL.eventsLegacy, eventId));
  if (legacy.exists()) {
    const data = legacy.data() as Record<string, unknown>;
    return pickString(data, ["title", "Baslik", "Başlık", "baslik", "başlık"]) || eventId;
  }

  const primary = await getDoc(doc(db, COL.events, eventId));
  if (primary.exists()) {
    const data = primary.data() as Record<string, unknown>;
    return pickString(data, ["title", "Baslik", "Başlık", "baslik", "başlık"]) || eventId;
  }

  return eventId;
}
