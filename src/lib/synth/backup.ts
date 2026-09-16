export const BACKUP_KEYS = [
  "lyra32-user-patches",
  "lyra32-user-sequences",
  "lyra32-favorites",
  "lyra32-scenes",
  "lyra32-midi-map",
  "lyra32-show-keys",
  "lyra32-midi-port",
  "lyra32-clock-follow",
] as const;

export type LyraBackup = {
  v: 1;
  app: "lyra-32";
  saved: string;
  data: Record<string, string | null>;
};

export function collectBackup(): LyraBackup {
  const data: Record<string, string | null> = {};
  for (const k of BACKUP_KEYS) {
    try {
      data[k] = localStorage.getItem(k);
    } catch {
      data[k] = null;
    }
  }
  return { v: 1, app: "lyra-32", saved: new Date().toISOString(), data };
}

export function applyBackup(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return false;
  const b = raw as Partial<LyraBackup>;
  if (b.app !== "lyra-32" || !b.data || typeof b.data !== "object") return false;
  const allow = new Set<string>(BACKUP_KEYS);
  try {
    for (const [k, v] of Object.entries(b.data)) {
      if (!allow.has(k)) continue;
      if (v == null || v === "") localStorage.removeItem(k);
      else if (typeof v === "string") localStorage.setItem(k, v);
    }
    return true;
  } catch {
    return false;
  }
}
