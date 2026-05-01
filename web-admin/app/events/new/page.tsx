"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { getUserRole } from "../../../lib/role";
import { auth, db } from "../../../lib/firebase";

const CATEGORY_KEYWORDS = {
  Spor: ["turnuva", "maç", "antrenman", "basketbol", "voleybol"],
  Sanat: ["tiyatro", "prova", "konser", "sergi", "müzik"],
  STEM: ["robot", "yazılım", "kod", "hackathon", "arduino"],
  Sosyal: ["bağış", "gönüllü", "yardım", "sosyal sorumluluk"],
} as const;

function inferCategoryAndTags(title: string, description: string) {
  const text = `${title} ${description}`.toLocaleLowerCase("tr-TR");
  const tags = new Set<string>();
  let inferredCategory = "";
  let maxMatches = 0;

  for (const [categoryName, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let categoryMatches = 0;
    for (const keyword of keywords) {
      if (text.includes(keyword.toLocaleLowerCase("tr-TR"))) {
        tags.add(keyword);
        categoryMatches += 1;
      }
    }

    if (categoryMatches > maxMatches) {
      maxMatches = categoryMatches;
      inferredCategory = categoryName;
    }
  }

  return { inferredCategory, inferredTags: Array.from(tags) };
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : JSON.stringify(error);
}

export default function NewEventPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [clubId, setClubId] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("published");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      try {
        const role = await getUserRole(user.uid);
        setHasAccess(role === "manager");
      } catch (e: unknown) {
        setError(getErrorMessage(e));
      } finally {
        setCheckingAccess(false);
      }
    });

    return unsubscribe;
  }, [router]);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!hasAccess) {
      setError("Yetkin yok.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const { inferredCategory, inferredTags } = inferCategoryAndTags(title, description);
      const resolvedCategory = category.trim() || inferredCategory;
      await addDoc(collection(db, "events"), {
        title,
        clubId,
        category: resolvedCategory,
        location,
        description,
        status,
        tags: inferredTags,
        createdAt: serverTimestamp(),
      });

      setSuccess(true);
      router.push("/events");
    } catch (err: unknown) {
      console.error("Create event error:", err);
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (checkingAccess) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
        <p>Yetki kontrol ediliyor...</p>
      </main>
    );
  }

  if (!hasAccess) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
        <h1 className="mb-4 text-3xl font-semibold">Yeni Etkinlik</h1>
        <p>Yetkin yok.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
      <h1 className="mb-6 text-3xl font-semibold">Yeni Etkinlik</h1>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="title">
            Title
          </label>
          <input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full rounded-md border px-3 py-2"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="clubId">
            Club ID
          </label>
          <input
            id="clubId"
            value={clubId}
            onChange={(e) => setClubId(e.target.value)}
            placeholder="robotik veya tiyatro"
            required
            className="w-full rounded-md border px-3 py-2"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="category">
            Category
          </label>
          <input
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-md border px-3 py-2"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="location">
            Location
          </label>
          <input
            id="location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            required
            className="w-full rounded-md border px-3 py-2"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="description">
            Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full rounded-md border px-3 py-2"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="status">
            Status
          </label>
          <select
            id="status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full rounded-md border px-3 py-2"
          >
            <option value="draft">draft</option>
            <option value="published">published</option>
            <option value="ended">ended</option>
          </select>
        </div>

        {error && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700">
            {error}
          </p>
        )}

        {success && (
          <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-green-700">
            Kaydedildi.
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-black px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Kaydediliyor..." : "Kaydet"}
        </button>
      </form>
    </main>
  );
}
