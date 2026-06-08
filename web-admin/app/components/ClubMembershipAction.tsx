"use client";

import { FormEvent, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { auth, db } from "../../lib/firebase";
import { COL } from "../../lib/collections";
import { getUserRecord } from "../../lib/guard";
import { normalizeAppRole } from "../../lib/role";
import { Button } from "./ui/button";
import { Card } from "./ui/card";

type ClubApplyDialogProps = {
  clubId: string;
  uid: string;
  open: boolean;
  onClose: () => void;
  onSubmitted: () => void;
};

export function ClubApplyDialog({ clubId, uid, open, onClose, onSubmitted }: ClubApplyDialogProps) {
  const [fullName, setFullName] = useState("");
  const [department, setDepartment] = useState("");
  const [studentNo, setStudentNo] = useState("");
  const [motivation, setMotivation] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!fullName.trim() || !department.trim() || !studentNo.trim() || !motivation.trim()) {
      setError("Tüm alanları doldur.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await setDoc(doc(db, COL.clubApplications, `${clubId}_${uid}`), {
        uid,
        clubId,
        status: "pending",
        createdAt: serverTimestamp(),
        adSoyad: fullName.trim(),
        bolum: department.trim(),
        ogrNo: studentNo.trim(),
        motivasyon: motivation.trim(),
      });
      onSubmitted();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Başvuru gönderilemedi.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <Card className="max-h-[90vh] w-full max-w-lg overflow-y-auto p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold">Üyelik Başvurusu</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-2 py-1 text-sm text-text2 hover:bg-surface2"
            aria-label="Kapat"
          >
            ✕
          </button>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Ad Soyad</span>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="ui-input"
              required
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Bölüm</span>
            <input
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="ui-input"
              required
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Öğrenci No</span>
            <input
              value={studentNo}
              onChange={(e) => setStudentNo(e.target.value)}
              className="ui-input"
              required
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Motivasyon</span>
            <textarea
              value={motivation}
              onChange={(e) => setMotivation(e.target.value)}
              className="ui-input min-h-24"
              required
            />
          </label>

          {error && (
            <p className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
              İptal
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Gönderiliyor..." : "Gönder"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

type ClubMembershipActionProps = {
  clubId: string;
};

export function ClubMembershipAction({ clubId }: ClubMembershipActionProps) {
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(null);
  const [role, setRole] = useState<ReturnType<typeof normalizeAppRole>>("student");
  const [userClubId, setUserClubId] = useState("");
  const [isMember, setIsMember] = useState(false);
  const [applicationStatus, setApplicationStatus] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUid(user?.uid ?? null);
      if (!user) {
        setRole("student");
        setUserClubId("");
        return;
      }
      const record = await getUserRecord(user.uid);
      setRole(normalizeAppRole(record.role));
      setUserClubId(record.clubId ?? "");
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!uid) {
      setIsMember(false);
      setApplicationStatus(null);
      return;
    }

    const stopMember = onSnapshot(
      doc(db, COL.clubMembers, `${clubId}_${uid}`),
      (snapshot) => setIsMember(snapshot.exists()),
      () => setIsMember(false)
    );

    const stopApplication = onSnapshot(
      doc(db, COL.clubApplications, `${clubId}_${uid}`),
      (snapshot) => {
        if (!snapshot.exists()) {
          setApplicationStatus(null);
          return;
        }
        const status = snapshot.data()?.status;
        setApplicationStatus(typeof status === "string" ? status.toLowerCase() : null);
      },
      () => setApplicationStatus(null)
    );

    return () => {
      stopMember();
      stopApplication();
    };
  }, [clubId, uid]);

  const canManage =
    role === "admin" || (role === "club_manager" && userClubId === clubId);

  let label = "Üye Ol";
  let disabled = true;
  let onClick: (() => void) | undefined;

  if (!uid) {
    label = "Üye Ol";
    disabled = true;
  } else if (canManage) {
    label = "Yönet";
    disabled = false;
    onClick = () => router.push("/club");
  } else if (isMember) {
    label = "Üyesin";
    disabled = true;
  } else if (applicationStatus === "pending") {
    label = "Başvuru beklemede";
    disabled = true;
  } else {
    label = "Üye Ol";
    disabled = false;
    onClick = () => setDialogOpen(true);
  }

  return (
    <>
      <Button type="button" variant="brand" disabled={disabled} onClick={onClick} className="rounded-full px-4">
        {label}
      </Button>
      {notice && (
        <p className="absolute right-0 top-12 min-w-48 rounded-xl bg-surface px-3 py-2 text-xs text-text shadow-lg">
          {notice}
        </p>
      )}
      {uid && (
        <ClubApplyDialog
          clubId={clubId}
          uid={uid}
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          onSubmitted={() => setNotice("Başvuru gönderildi.")}
        />
      )}
    </>
  );
}
