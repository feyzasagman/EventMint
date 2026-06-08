export const CLUB_LOGO_FILES: Record<string, string> = {
  robotik: "robotik.png",
  tiyatro: "tiyatro.png",
  yazilim: "yazilim_kulubu.png",
  girisimcilik: "girisimcilik.png",
  fotografcilik: "fotografcilik.png",
};

export function clubLogoPath(logoKey?: string | null): string | null {
  const key = logoKey?.trim();
  if (!key) return null;
  const fileName = CLUB_LOGO_FILES[key];
  if (!fileName) return null;
  return `/clubs/${fileName}`;
}
