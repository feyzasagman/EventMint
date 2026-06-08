"use client";

import { useEffect, useMemo, useState } from "react";
import { signOut } from "firebase/auth";
import {
  collection,
  doc,
  DocumentData,
  onSnapshot,
  query,
  QuerySnapshot,
  updateDoc,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import { auth, db } from "../../../../lib/firebase";
import { type ClubListItem, subscribeClubs } from "../../../../lib/clubRepo";
import { getUserRecord } from "../../../../lib/guard";
import { useAuth } from "../../../providers/AuthProvider";
import { InlineNotice } from "../../../components/InlineNotice";
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { Chip } from "../../../components/ui/chip";

type NoticeState = { tone: "success" | "error" | "info"; message: string } | null;

type UserRole = "student" | "club_manager" | "admin";

type UserRow = {
  uid: string;
  email?: string;
  role: UserRole;
  clubId?: string;
};

type ClubOption = ClubListItem;

function normalizeRole(value: unknown): UserRole {
  if (value === "admin" || value === "club_manager" || value === "student") {
    return value;
  }
  if (value === "manager") {
    return "club_manager";
  }
  return "student";
}

function pickString(data: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return undefined;
}

function mapUsers(snapshot: QuerySnapshot<DocumentData>): UserRow[] {
  return snapshot.docs.map((userDoc) => {
    const data = userDoc.data() as Record<string, unknown>;
    return {
      uid: userDoc.id,
      email: pickString(data, ["email", "mail"]),
      role: normalizeRole(data.role),
      clubId: pickString(data, ["clubId", "Kulup", "Kulüp", "kulup", "kulüp"]),
    };
  });
}

export default function AdminManagersPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [resolvedUid, setResolvedUid] = useState<string | null>(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [clubs, setClubs] = useState<ClubOption[]>([]);
  const [clubDrafts, setClubDrafts] = useState<Record<string, string>>({});
  const [savingUid, setSavingUid] = useState<string | null>(null);
  const [notice, setNotice] = useState<NoticeState>(null);

  useEffect(() => {
    if (!user) return;

    let isCancelled = false;
    getUserRecord(user.uid)
      .then(async (record) => {
        if (isCancelled) return;
        if (record.banned === true) {
          await signOut(auth);
          if (!isCancelled) {
            setResolvedUid(user.uid);
            setHasAccess(false);
            router.replace("/auth?banned=1");
          }
          return;
        }
        setResolvedUid(user.uid);
        setHasAccess(record.role === "admin");
      })
      .catch(() => {
        if (!isCancelled) {
          setResolvedUid(user.uid);
          setHasAccess(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [router, user]);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth");
    }
  }, [loading, router, user]);

  useEffect(() => {
    if (!hasAccess) return;

    const unsubscribeUsers = onSnapshot(
      query(collection(db, "users")),
      (snapshot) => {
        const items = mapUsers(snapshot).sort((a, b) =>
          (a.email ?? "").localeCompare(b.email ?? "")
        );
        setUsers(items);
        setClubDrafts((current) => {
          const next = { ...current };
          for (const user of items) {
            next[user.uid] ??= user.clubId ?? "";
          }
          return next;
        });
      },
      (error) => setNotice({ tone: "error", message: `Kullanıcılar okunamadı: ${error.message}` })
    );

    const unsubscribeClubs = subscribeClubs(
      setClubs,
      (error) => setNotice({ tone: "error", message: `Kulüpler okunamadı: ${error.message}` })
    );

    return () => {
      unsubscribeUsers();
      unsubscribeClubs();
    };
  }, [hasAccess]);

  const managers = useMemo(
    () => users.filter((user) => user.role === "club_manager" || user.role === "admin"),
    [users]
  );

  const assignClub = async (user: UserRow) => {
    const clubId = clubDrafts[user.uid] ?? "";
    setSavingUid(user.uid);
    setNotice(null);
    try {
      await updateDoc(doc(db, "users", user.uid), {
        role: "club_manager",
        clubId,
      });
      setNotice({ tone: "success", message: `${user.email ?? user.uid} kulübü güncellendi.` });
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Kulüp atanamadı.",
      });
    } finally {
      setSavingUid(null);
    }
  };

  const makeClubManager = async (user: UserRow) => {
    setSavingUid(user.uid);
    setNotice(null);
    try {
      await updateDoc(doc(db, "users", user.uid), {
        role: "club_manager",
        clubId: clubDrafts[user.uid] ?? user.clubId ?? "",
      });
      setNotice({ tone: "success", message: `${user.email ?? user.uid} club manager yapıldı.` });
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Rol güncellenemedi.",
      });
    } finally {
      setSavingUid(null);
    }
  };

  const makeStudent = async (user: UserRow) => {
    setSavingUid(user.uid);
    setNotice(null);
    try {
      await updateDoc(doc(db, "users", user.uid), {
        role: "student",
        clubId: "",
      });
      setNotice({ tone: "success", message: `${user.email ?? user.uid} student yapıldı.` });
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Rol güncellenemedi.",
      });
    } finally {
      setSavingUid(null);
    }
  };

  const needsLogin = !loading && !user;
  const checkingAccess = loading || (!!user && resolvedUid !== user.uid);

  if (checkingAccess) {
    return <p>Loading...</p>;
  }

  if (needsLogin) {
    return <p>Login required</p>;
  }

  if (!hasAccess) {
    return (
      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
        <p className="text-sm font-semibold uppercase tracking-wide">Admin only</p>
        <h1 className="mt-2 text-2xl font-semibold">Yönetici yönetimi sadece admin rolüne açık.</h1>
      </section>
    );
  }

  return (
    <>
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight">Yöneticiler</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Kulüp yöneticilerine kulüp ata, rol değiştir.
          </p>
        </div>
        <Chip variant="brand" className="text-sm">
          {managers.length} yönetici
        </Chip>
      </div>

      {notice && <InlineNotice tone={notice.tone} message={notice.message} />}

      <ul className="grid gap-4 md:grid-cols-2">
        {managers.map((user) => {
          const draftClub = clubDrafts[user.uid] ?? "";
          const isAdmin = user.role === "admin";

          return (
            <Card key={user.uid} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{user.email ?? "Email yok"}</p>
                  <p className="truncate font-mono text-xs text-zinc-500">{user.uid}</p>
                </div>
                <Chip
                  className={`text-xs ${
                    isAdmin
                      ? "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-200"
                      : "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200"
                  }`}
                >
                  {user.role}
                </Chip>
              </div>

              {!isAdmin && (
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <select
                    value={draftClub}
                    onChange={(event) =>
                      setClubDrafts((current) => ({ ...current, [user.uid]: event.target.value }))
                    }
                    className="min-h-11 flex-1 rounded-2xl border border-zinc-200 bg-zinc-50 px-3 text-sm outline-none focus:border-indigo-400 dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <option value="">Kulüp seç</option>
                    {clubs.map((club) => (
                      <option key={club.id} value={club.id}>
                        {club.label}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    onClick={() => assignClub(user)}
                    disabled={savingUid === user.uid || !draftClub}
                  >
                    {savingUid === user.uid ? "..." : "Kulüp ata"}
                  </Button>
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={() => makeClubManager(user)}
                  disabled={savingUid === user.uid || user.role === "club_manager"}
                  variant="secondary"
                  className="border-brand/35 text-brand hover:bg-brand/10"
                >
                  Club manager yap
                </Button>
                <Button
                  type="button"
                  onClick={() => makeStudent(user)}
                  disabled={savingUid === user.uid}
                  variant="secondary"
                >
                  Student yap
                </Button>
              </div>
            </Card>
          );
        })}
      </ul>

      {managers.length === 0 && (
        <p className="rounded-3xl border border-zinc-200 bg-white px-5 py-10 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950">
          Henüz yönetici (club_manager/admin) yok. Kullanıcılar sayfasından rol atayabilirsin.
        </p>
      )}
    </>
  );
}
