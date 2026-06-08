"use client";

import { useParams } from "next/navigation";
import { ClubDetailView } from "../../components/ClubDetailView";

export default function ClubDetailPage() {
  const params = useParams<{ clubId: string }>();
  const clubId = params.clubId;

  if (!clubId) {
    return <p className="text-sm text-danger">Kulüp bulunamadı.</p>;
  }

  return <ClubDetailView clubId={clubId} />;
}
