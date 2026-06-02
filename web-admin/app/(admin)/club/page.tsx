"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import { auth, db } from "../../../lib/firebase";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";

type AdminRole = "admin" | "club_manager" | "student";
type ClubOption = { id: string; label: string };

function normalizeRole(value: unknown): AdminRole {
  if (value === "admin" || value === "club_manager" || value === "student") return value;
  if (value === "manager") return "club_manager";
  return "student";
}

function pickString(data: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return "";
}

function parseTags(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((tag) => String(tag).trim()).filter(Boolean);
  if (typeof value === "string") return value.split(",").map((tag) => tag.trim()).filter(Boolean);
  return [];
}

const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export default function ClubPage() {
  const router = useRouter();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [role, setRole] = useState<AdminRole | null>(null);
  const [ownClubId, setOwnClubId] = useState("");
  const [selectedClubId, setSelectedClubId] = useState("");
  const [clubs, setClubs] = useState<ClubOption[]>([]);
  const [clubName, setClubName] = useState("");
  const [description, setDescription] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [loadingClub, setLoadingClub] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user && !isDemoMode) {
        router.replace("/auth?mode=admin");
        return;
      }

      try {
        const userSnapshot = user ? await getDoc(doc(db, "users", user.uid)) : null;
        const userData = userSnapshot?.exists() ? (userSnapshot.data() as Record<string, unknown>) : {};
        const resolvedRole = isDemoMode && !user ? "admin" : normalizeRole(userData.role);
        const clubId = typeof userData.clubId === "string" ? userData.clubId : "";

        if (resolvedRole === "student") {
          router.replace("/auth");
          return;
        }

        setRole(resolvedRole);
        setOwnClubId(clubId);
        if (resolvedRole === "club_manager" && clubId) {
          setLoadingClub(true);
        }
        setSelectedClubId(resolvedRole === "club_manager" ? clubId : "");
      } finally {
        setCheckingAccess(false);
      }
    });

    return unsubscribe;
  }, [router]);

  useEffect(() => {
    const unsubKulup = onSnapshot(collection(db, "Kulüpler"), (snapshot) => {
      const options = snapshot.docs.map((clubDoc) => {
        const data = clubDoc.data() as Record<string, unknown>;
        const label = pickString(data, ["ad", "Reklam", "name", "title"]) || clubDoc.id;
        return { id: clubDoc.id, label };
      });
      setClubs(options);
    });

    return unsubKulup;
  }, []);

  useEffect(() => {
    if (!selectedClubId) return;

    const unsubscribe = onSnapshot(
      doc(db, "Kulüpler", selectedClubId),
      (snapshot) => {
        const data = snapshot.exists() ? (snapshot.data() as Record<string, unknown>) : {};
        setClubName(pickString(data, ["ad", "Reklam"]));
        setDescription(pickString(data, ["aciklama"]));
        setTagsText(parseTags(data.etiketler).join(", "));
        setLoadingClub(false);
      },
      () => {
        setLoadingClub(false);
      }
    );

    return unsubscribe;
  }, [selectedClubId]);

  const canSave = useMemo(() => {
    if (role === "admin") return Boolean(selectedClubId.trim());
    if (role === "club_manager") return Boolean(ownClubId.trim());
    return false;
  }, [role, ownClubId, selectedClubId]);

  const activeClubId = role === "club_manager" ? ownClubId : selectedClubId;

  const handleSave = async () => {
    if (!activeClubId) return;
    setSaving(true);
    setNotice(null);
    try {
      await setDoc(
        doc(db, "Kulüpler", activeClubId),
        {
          ad: clubName.trim(),
          Reklam: clubName.trim(),
          aciklama: description.trim(),
          etiketler: tagsText.split(",").map((tag) => tag.trim()).filter(Boolean),
        },
        { merge: true }
      );
      setNotice("Kulüp bilgileri güncellendi.");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Kulüp kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  if (checkingAccess) {
    return <p>Yetki kontrol ediliyor...</p>;
  }

  if (role !== "admin" && role !== "club_manager") {
    return <p>Yetkin yok.</p>;
  }

  if (role === "club_manager" && !ownClubId) {
    return <p>Kulüp yöneticisi hesabında clubId tanımlı değil.</p>;
  }

  return (
    <section className="mx-auto w-full max-w-3xl">
      <div className="mb-6">
        <p className="text-sm font-medium uppercase tracking-wide text-indigo-600 dark:text-indigo-400">Kulüp Yönetimi</p>
        <h1 className="mt-1 text-4xl font-semibold tracking-tight">Kulübüm</h1>
      </div>

      {role === "admin" && (
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium" htmlFor="clubId">Kulüp</label>
          <select
            id="clubId"
            value={selectedClubId}
            onChange={(event) => {
              setLoadingClub(true);
              setNotice(null);
              setSelectedClubId(event.target.value);
            }}
            className="ui-input"
          >
            <option value="">Kulüp seç</option>
            {clubs.map((club) => (
              <option key={club.id} value={club.id}>{club.label}</option>
            ))}
          </select>
        </div>
      )}

      {loadingClub && <p>Kulüp yükleniyor...</p>}

      {canSave && (
        <Card className="space-y-4 p-5">
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="ad">Kulüp adı</label>
            <input
              id="ad"
              value={clubName}
              onChange={(event) => setClubName(event.target.value)}
              className="ui-input"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="aciklama">Açıklama</label>
            <textarea
              id="aciklama"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
              className="ui-input min-h-28 py-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="etiketler">Etiketler</label>
            <input
              id="etiketler"
              value={tagsText}
              onChange={(event) => setTagsText(event.target.value)}
              placeholder="robotik, yazılım"
              className="ui-input"
            />
          </div>
          {notice && <p className="text-sm">{notice}</p>}
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Kaydediliyor..." : "Kaydet"}
          </Button>
        </Card>
      )}
    </section>
  );
}
