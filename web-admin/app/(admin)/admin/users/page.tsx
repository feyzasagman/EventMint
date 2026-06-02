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
import { getUserRecord } from "../../../../lib/guard";
import { useAuth } from "../../../providers/AuthProvider";
import { InlineNotice } from "../../../components/InlineNotice";
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { Chip } from "../../../components/ui/chip";

type UserRole = "student" | "club_manager" | "admin";

type UserRow = {
  uid: string;
  email?: string;
  role: UserRole;
  clubId?: string;
  banned: boolean;
};

type ClubOption = {
  id: string;
  label: string;
};

type Draft = { role: UserRole; clubId: string; banned: boolean };
type NoticeState = { tone: "success" | "error" | "info"; message: string } | null;

const roles: UserRole[] = ["student", "club_manager", "admin"];

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
      banned: data.banned === true,
    };
  });
}

function mapClubs(snapshot: QuerySnapshot<DocumentData>): ClubOption[] {
  return snapshot.docs.map((clubDoc) => {
    const data = clubDoc.data() as Record<string, unknown>;
    return {
      id: clubDoc.id,
      label: pickString(data, ["ad", "Reklam", "name", "title", "Ad"]) ?? clubDoc.id,
    };
  });
}

export default function AdminUsersPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [resolvedUid, setResolvedUid] = useState<string | null>(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [clubs, setClubs] = useState<ClubOption[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [savingUid, setSavingUid] = useState<string | null>(null);
  const [notice, setNotice] = useState<NoticeState>(null);
  const [search, setSearch] = useState("");

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
        setDrafts((current) => {
          const next = { ...current };
          for (const user of items) {
            next[user.uid] ??= {
              role: user.role,
              clubId: user.clubId ?? "",
              banned: user.banned,
            };
          }
          return next;
        });
      },
      (error) => setNotice({ tone: "error", message: `Kullanıcılar okunamadı: ${error.message}` })
    );

    const unsubscribeClubs = onSnapshot(
      collection(db, "Kulüpler"),
      (snapshot) => setClubs(mapClubs(snapshot)),
      (error) => setNotice({ tone: "error", message: `Kulüpler okunamadı: ${error.message}` })
    );

    return () => {
      unsubscribeUsers();
      unsubscribeClubs();
    };
  }, [hasAccess]);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return users;
    return users.filter((user) => (user.email ?? "").toLowerCase().includes(term));
  }, [users, search]);

  const updateDraft = (uid: string, patch: Partial<Draft>) => {
    setDrafts((current) => {
      const base = current[uid] ?? { role: "student" as UserRole, clubId: "", banned: false };
      return {
        ...current,
        [uid]: { ...base, ...patch },
      };
    });
  };

  const saveUser = async (user: UserRow) => {
    const draft = drafts[user.uid] ?? {
      role: user.role,
      clubId: user.clubId ?? "",
      banned: user.banned,
    };
    setSavingUid(user.uid);
    setNotice(null);

    try {
      await updateDoc(doc(db, "users", user.uid), {
        role: draft.role,
        clubId: draft.role === "club_manager" ? draft.clubId : "",
        banned: draft.banned,
      });
      setNotice({ tone: "success", message: "Kullanıcı bilgileri güncellendi." });
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Kullanıcı güncellenemedi.",
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
        <h1 className="mt-2 text-2xl font-semibold">Kullanıcı yönetimi sadece admin rolüne açık.</h1>
      </section>
    );
  }

  return (
    <>
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight">Kullanıcılar</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Rolleri yönet, kulüp yöneticisi yetkisi ver ve hesapları banla.
          </p>
        </div>
        <Chip variant="brand" className="text-sm">
          {users.length} kullanıcı
        </Chip>
      </div>

      <Card className="mb-6 p-4">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Email ara"
          className="ui-input"
        />
      </Card>

      {notice && <InlineNotice tone={notice.tone} message={notice.message} />}

      <Card className="overflow-hidden">
        <div className="hidden grid-cols-[1.4fr_1fr_1fr_0.8fr_auto] gap-3 border-b border-zinc-100 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:border-zinc-900 md:grid">
          <span>Email</span>
          <span>Role</span>
          <span>Club ID</span>
          <span>Banned</span>
          <span>İşlem</span>
        </div>

        <ul className="divide-y divide-zinc-100 dark:divide-zinc-900">
          {filteredUsers.map((user) => {
            const draft = drafts[user.uid] ?? {
              role: user.role,
              clubId: user.clubId ?? "",
              banned: user.banned,
            };
            const needsClub = draft.role === "club_manager";

            return (
              <li
                key={user.uid}
                className="grid gap-3 px-5 py-4 md:grid-cols-[1.4fr_1fr_1fr_0.8fr_auto] md:items-center"
              >
                <div>
                  <p className="font-medium">{user.email ?? "Email yok"}</p>
                  <p className="truncate font-mono text-xs text-zinc-500">{user.uid}</p>
                </div>

                <select
                  value={draft.role}
                  onChange={(event) =>
                    updateDraft(user.uid, {
                      role: event.target.value as UserRole,
                      clubId: event.target.value === "club_manager" ? draft.clubId : "",
                    })
                  }
                  className="h-11 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 text-sm outline-none focus:border-indigo-400 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  {roles.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>

                {needsClub ? (
                  <select
                    value={draft.clubId}
                    onChange={(event) => updateDraft(user.uid, { clubId: event.target.value })}
                    className="h-11 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 text-sm outline-none focus:border-indigo-400 dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <option value="">Kulüp seç</option>
                    {clubs.map((club) => (
                      <option key={club.id} value={club.id}>
                        {club.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="flex h-11 w-full items-center rounded-2xl bg-zinc-50 px-3 text-sm text-zinc-500 dark:bg-zinc-900">
                    -
                  </span>
                )}

                <Button
                  type="button"
                  onClick={() => updateDraft(user.uid, { banned: !draft.banned })}
                  variant="secondary"
                  className={`min-h-11 rounded-2xl px-3 text-sm ${
                    draft.banned
                      ? "bg-red-600 text-white hover:bg-red-500"
                      : ""
                  }`}
                >
                  {draft.banned ? "Banlı" : "Aktif"}
                </Button>

                <Button
                  type="button"
                  onClick={() => saveUser(user)}
                  disabled={savingUid === user.uid || (needsClub && !draft.clubId)}
                  className="min-h-11 min-w-24"
                >
                  {savingUid === user.uid && (
                    <span
                      className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
                      aria-hidden
                    />
                  )}
                  {savingUid === user.uid ? "Kaydediliyor..." : "Kaydet"}
                </Button>
              </li>
            );
          })}
        </ul>

        {filteredUsers.length === 0 && (
          <p className="px-5 py-10 text-center text-sm text-zinc-500">
            {users.length === 0 ? "Henüz kullanıcı bulunamadı." : "Eşleşen kullanıcı yok."}
          </p>
        )}
      </Card>
    </>
  );
}
