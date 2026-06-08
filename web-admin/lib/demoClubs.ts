import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Firestore,
} from "firebase/firestore";
import { COL } from "./collections";

export type DemoClubSeed = {
  id: string;
  name: string;
  handle: string;
  description: string;
  tags: string[];
  status: "approved";
  logoKey: string;
};

export const DEMO_CLUBS: DemoClubSeed[] = [
  {
    id: "yazilim",
    name: "Yazılım Kulübü",
    handle: "yazilim",
    description:
      "Kodlama, web, mobil uygulama ve yapay zeka projeleri geliştiren öğrenci topluluğu.",
    tags: ["yazılım", "python", "web", "mobil", "ai"],
    status: "approved",
    logoKey: "yazilim",
  },
  {
    id: "girisimcilik",
    name: "Girişimcilik Kulübü",
    handle: "girisimcilik",
    description:
      "Fikir geliştirme, startup kültürü, ekip çalışması ve proje sunumları üzerine etkinlikler düzenler.",
    tags: ["girişimcilik", "startup", "inovasyon", "sunum"],
    status: "approved",
    logoKey: "girisimcilik",
  },
  {
    id: "fotografcilik",
    name: "Fotoğrafçılık Kulübü",
    handle: "fotografcilik",
    description:
      "Fotoğraf çekimi, görsel anlatım, kampüs gezileri ve yaratıcı medya çalışmaları yapar.",
    tags: ["fotoğraf", "sanat", "medya", "yaratıcılık"],
    status: "approved",
    logoKey: "fotografcilik",
  },
];

export type SeedDemoClubsResult = {
  created: string[];
  skipped: string[];
  errors: { id: string; message: string }[];
};

function clubPayload(club: DemoClubSeed, managerUid?: string) {
  return {
    name: club.name,
    handle: club.handle,
    bio: club.description,
    description: club.description,
    tags: club.tags,
    logoKey: club.logoKey,
    status: managerUid ? "pending" : club.status,
    managerUids: managerUid ? [managerUid] : [],
    createdAt: serverTimestamp(),
  };
}

export async function seedDemoClubs(
  db: Firestore,
  options?: { adminUid?: string; skipExisting?: boolean }
): Promise<SeedDemoClubsResult> {
  const skipExisting = options?.skipExisting ?? true;
  const adminUid = options?.adminUid;
  const result: SeedDemoClubsResult = { created: [], skipped: [], errors: [] };

  for (const club of DEMO_CLUBS) {
    const ref = doc(db, COL.clubs, club.id);

    try {
      const snapshot = await getDoc(ref);
      if (snapshot.exists() && skipExisting) {
        result.skipped.push(club.id);
        continue;
      }

      if (snapshot.exists() && !skipExisting) {
        await setDoc(
          ref,
          {
            name: club.name,
            handle: club.handle,
            bio: club.description,
            description: club.description,
            tags: club.tags,
            logoKey: club.logoKey,
            status: club.status,
          },
          { merge: true }
        );
        result.created.push(club.id);
        continue;
      }

      await setDoc(ref, clubPayload(club, adminUid));

      if (adminUid) {
        await updateDoc(ref, { status: club.status });
      }

      result.created.push(club.id);
    } catch (error) {
      result.errors.push({
        id: club.id,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
}
