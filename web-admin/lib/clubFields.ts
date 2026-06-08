export function pickString(data: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

export function pickClubName(data: Record<string, unknown>, fallbackId: string) {
  const name = pickString(data, ["name", "title", "ad", "Reklam", "Ad"]);
  return name || fallbackId;
}

export function pickClubBio(data: Record<string, unknown>) {
  return pickString(data, ["bio", "aciklama", "description"]);
}

export function pickClubLogoKey(data: Record<string, unknown>) {
  return pickString(data, ["logoKey", "logo_key"]);
}

export function pickClubCoverUrl(data: Record<string, unknown>) {
  return pickString(data, ["coverUrl", "cover", "coverImage"]);
}

export function pickClubHandle(
  data: Record<string, unknown>,
  clubId: string,
  name: string
) {
  const raw = pickString(data, ["handle", "slug"]);
  if (raw) return raw.startsWith("@") ? raw : `@${raw}`;

  const base = name || clubId;
  const slug = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return `@${slug || clubId}`;
}

export function pickClubTags(data: Record<string, unknown>): string[] {
  for (const key of ["tags", "etiketler", "Etiketler"]) {
    const value = data[key];
    if (Array.isArray(value)) {
      return value
        .map((tag) => String(tag).trim())
        .filter((tag) => tag.length > 0);
    }
    if (typeof value === "string" && value.trim()) {
      return value
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
    }
  }
  return [];
}

export function pickPostText(data: Record<string, unknown>) {
  return pickString(data, ["text", "metin", "icerik", "topic"]);
}

export function pickPostHashtags(data: Record<string, unknown>): string[] {
  return pickClubTags(data);
}

export function formatFirestoreDate(value: unknown) {
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate: () => Date }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate();
  }
  if (
    value &&
    typeof value === "object" &&
    "seconds" in value &&
    typeof (value as { seconds: number }).seconds === "number"
  ) {
    return new Date((value as { seconds: number }).seconds * 1000);
  }
  return null;
}
