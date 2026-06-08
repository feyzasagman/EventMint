"use client";

import { useEffect, useState } from "react";
import { subscribeClubMembers, type ClubMemberRow } from "../../lib/clubMembers";
import { Card } from "./ui/card";

type ClubMembersPanelProps = {
  clubId: string;
};

function formatDate(value: Date | null) {
  if (!value) return "";
  return value.toLocaleString("tr-TR");
}

export function ClubMembersPanel({ clubId }: ClubMembersPanelProps) {
  const [members, setMembers] = useState<ClubMemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clubId.trim()) {
      setMembers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeClubMembers(
      clubId,
      (nextMembers) => {
        setMembers(nextMembers);
        setLoading(false);
      },
      (subscriptionError) => {
        setError(subscriptionError.message);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [clubId]);

  return (
    <Card className="mt-6 space-y-4 p-5">
      <div>
        <h2 className="text-lg font-semibold">Kulüp Üyeleri</h2>
        <p className="mt-1 text-sm text-text2">Onaylanmış üyelerin listesi.</p>
      </div>

      {loading && <p className="text-sm text-text2">Üyeler yükleniyor...</p>}
      {error && (
        <p className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      {!loading && !error && members.length === 0 && (
        <p className="text-sm text-text2">Henüz onaylı üye yok.</p>
      )}

      <ul className="space-y-2">
        {members.map((member) => (
          <li
            key={member.id}
            className="rounded-2xl border border-border bg-surface2/60 px-4 py-3"
          >
            <p className="font-semibold">
              {member.displayName || member.uid || "Üye"}
            </p>
            <p className="mt-1 text-xs text-text2">
              Rol: {member.role}
              {member.joinedAt ? ` · Katılım: ${formatDate(member.joinedAt)}` : ""}
            </p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
