import type{ RebalanceAnchorMode, RebalanceProfile, RebalanceTargets } from "../../../../shared/types/core";
import { TARGET_MODE_SET } from "./rebalanceTypes";

export function downloadProfiles(profiles: RebalanceProfile[]): void {
  if (profiles.length === 0) return;
  const data = JSON.stringify(
    { version: 1, exportedAt: Date.now(), profiles },
    null,
    2,
  );
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const d = new Date();
  const pad2 = (v: number): string => String(v).padStart(2, "0");
  a.download = `rebalance-profiles-${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function parseImportedProfiles(jsonText: string): RebalanceProfile[] {
  const parsed = JSON.parse(jsonText);
  const incoming: unknown[] = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.profiles)
      ? parsed.profiles
      : [];
  if (incoming.length === 0) return [];

  const validated: RebalanceProfile[] = [];
  for (const entry of incoming) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const candidate = entry as Record<string, unknown>;
    const rawTargets = candidate.rebalanceTargets;
    if (
      !rawTargets ||
      typeof rawTargets !== "object" ||
      Array.isArray(rawTargets)
    )
      continue;
    const targets: RebalanceTargets = {};
    for (const [key, val] of Object.entries(
      rawTargets as Record<string, unknown>,
    )) {
      if (!val || typeof val !== "object" || Array.isArray(val)) continue;
      const e = val as Record<string, unknown>;
      const anchor = e.anchor as RebalanceAnchorMode;
      const value = Number(e.value);
      if (!TARGET_MODE_SET.has(anchor) || !Number.isFinite(value)) continue;
      targets[key] = { anchor, value: Math.round(value * 100) / 100 };
    }
    if (Object.keys(targets).length === 0) continue;
    const createdAtRaw = Number(candidate.createdAt);
    const createdAt =
      Number.isFinite(createdAtRaw) && createdAtRaw > 0
        ? Math.round(createdAtRaw)
        : Date.now();
    const id =
      typeof candidate.id === "string" && candidate.id.trim().length > 0
        ? candidate.id.trim().slice(0, 80)
        : `rp_${createdAt}_${Math.random().toString(36).slice(2, 8)}`;
    const name =
      typeof candidate.name === "string" && candidate.name.trim().length > 0
        ? candidate.name.trim().slice(0, 160)
        : new Date(createdAt).toISOString().slice(0, 16).replace("T", " ");
    validated.push({ id, name, createdAt, rebalanceTargets: targets });
  }
  return validated;
}
