"use client";

import { useParams, useRouter } from "next/navigation";
import { ClubDetailView } from "../../../../components/ClubDetailView";
import { Button } from "../../../../components/ui/button";

export default function StudentClubDetailPage() {
  const router = useRouter();
  const params = useParams<{ clubId: string }>();
  const clubId = params.clubId;

  if (!clubId) {
    return <p className="text-sm text-red-600">Kulüp bulunamadı.</p>;
  }

  return (
    <div className="space-y-4">
      <Button type="button" variant="secondary" onClick={() => router.push("/app/clubs")}>
        ← Kulüplere dön
      </Button>
      <ClubDetailView clubId={clubId} />
    </div>
  );
}
