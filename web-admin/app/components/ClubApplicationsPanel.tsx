"use client";

import { useEffect, useState } from "react";
import { auth } from "../../lib/firebase";
import {
  approveClubApplication,
  rejectClubApplication,
  subscribeClubApplications,
  type ClubApplication,
} from "../../lib/clubApplications";
import { Button } from "./ui/button";
import { Card } from "./ui/card";

type ClubApplicationsPanelProps = {
  clubId: string;
};

function formatDate(value: Date | null) {
  if (!value) return "";
  const day = value.getDate().toString().padStart(2, "0");
  const month = (value.getMonth() + 1).toString().padStart(2, "0");
  const year = value.getFullYear();
  const hour = value.getHours().toString().padStart(2, "0");
  const minute = value.getMinutes().toString().padStart(2, "0");
  return `${day}.${month}.${year} ${hour}:${minute}`;
}

export function ClubApplicationsPanel({ clubId }: ClubApplicationsPanelProps) {
  const [applications, setApplications] = useState<ClubApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!clubId.trim()) {
      setApplications([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeClubApplications(
      clubId,
      (nextApplications) => {
        setApplications(nextApplications);
        setLoading(false);
      },
      (subscriptionError) => {
        setError(subscriptionError.message);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [clubId]);

  const handleApprove = async (application: ClubApplication) => {
    const reviewerUid = auth.currentUser?.uid;
    if (!reviewerUid) {
      setError("Onaylamak için giriş yapmalısınız.");
      return;
    }
    if (!application.uid) {
      setError("Başvuruda kullanıcı kimliği bulunamadı.");
      return;
    }

    setBusyId(application.id);
    setError(null);
    try {
      await approveClubApplication({
        applicationId: application.id,
        clubId: application.clubId,
        applicantUid: application.uid,
        reviewerUid,
        displayName: application.fullName || undefined,
      });
      setNotice("Başvuru onaylandı.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Başvuru onaylanamadı.");
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (application: ClubApplication) => {
    const reviewerUid = auth.currentUser?.uid;
    if (!reviewerUid) {
      setError("Reddetmek için giriş yapmalısınız.");
      return;
    }

    setBusyId(application.id);
    setError(null);
    try {
      await rejectClubApplication({
        applicationId: application.id,
        reviewerUid,
      });
      setNotice("Başvuru reddedildi.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Başvuru reddedilemedi.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card className="mt-6 space-y-4 p-5">
      <div>
        <h2 className="text-lg font-semibold">Üyelik Başvuruları</h2>
        <p className="mt-1 text-sm text-text2">
          Bekleyen başvuruları onaylayın veya reddedin.
        </p>
      </div>

      {loading && <p className="text-sm text-text2">Başvurular yükleniyor...</p>}
      {error && (
        <p className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      {notice && !error && <p className="text-sm text-brand">{notice}</p>}

      {!loading && !error && applications.length === 0 && (
        <p className="text-sm text-text2">Bekleyen başvuru yok.</p>
      )}

      <div className="space-y-3">
        {applications.map((application) => (
          <div
            key={application.id}
            className="rounded-2xl border border-border bg-surface2/60 p-4"
          >
            <p className="font-semibold">
              {application.fullName || "İsimsiz başvuru"}
            </p>
            {application.department && (
              <p className="mt-1 text-sm text-text2">Bölüm: {application.department}</p>
            )}
            {application.studentNo && (
              <p className="text-sm text-text2">Öğrenci No: {application.studentNo}</p>
            )}
            {application.motivation && (
              <p className="mt-2 text-sm">{application.motivation}</p>
            )}
            {application.createdAt && (
              <p className="mt-2 text-xs text-text2">
                Başvuru: {formatDate(application.createdAt)}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={busyId === application.id}
                onClick={() => handleApprove(application)}
              >
                {busyId === application.id ? "İşleniyor..." : "Onayla"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={busyId === application.id}
                onClick={() => handleReject(application)}
              >
                Reddet
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
