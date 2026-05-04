import type { BetaHorizon } from "../../../../backend/computation/beta/types";
import type {
  RebalanceAnchorMode,
  RebalanceProfile,
  RebalanceTargets,
} from "../../../../shared/types/core";
import {
  type Payload,
  MAX_REBALANCE_PROFILES,
  buildAutoProfileName,
  cloneTargets,
} from "./rebalanceTypes";
import {
  downloadProfiles,
  parseImportedProfiles,
} from "./rebalanceProfileIO";

export type ProfileActionsState = {
  profileSelect: HTMLSelectElement;
  saveProfileBtn: HTMLButtonElement;
  loadProfileBtn: HTMLButtonElement;
  deleteProfileBtn: HTMLButtonElement;
  exportSelectedBtn: HTMLButtonElement;
  exportAllBtn: HTMLButtonElement;
  importFileBtn: HTMLButtonElement;

  inputsByKey: Map<string, Map<RebalanceAnchorMode, HTMLInputElement>>;
  anchorByKey: Map<string, RebalanceAnchorMode>;
  dirtyKeys: Set<string>;

  getLatestPayload: () => Payload;
  setLatestPayload: (p: Payload) => void;
  getBetaHorizon: () => BetaHorizon;
  getSelectedProfileId: () => string;
  setSelectedProfileId: (s: string) => void;
  getLastProfilesHash: () => string;
  setLastProfilesHash: (s: string) => void;
  setSelfTriggeredUpdate: (b: boolean) => void;
  setLastTargetsHash: (s: string) => void;
  setRenderedKeyList: (s: string) => void;

  parseAnchorInputValue: (
    mode: RebalanceAnchorMode,
    rawValue: string,
  ) => number | null;
  renderAll: (p: Payload) => void;
};

export type ProfileActionsApi = {
  syncProfileControls: (p: Payload) => void;
};

export function setupProfileActions(
  state: ProfileActionsState,
): ProfileActionsApi {
  const {
    profileSelect,
    saveProfileBtn,
    loadProfileBtn,
    deleteProfileBtn,
    exportSelectedBtn,
    exportAllBtn,
    importFileBtn,
    inputsByKey,
    anchorByKey,
    dirtyKeys,
    parseAnchorInputValue,
  } = state;

  function listProfiles(p: Payload): RebalanceProfile[] {
    return [...(p.rebalanceProfiles ?? [])].sort(
      (a, b) => b.createdAt - a.createdAt,
    );
  }

  function collectCurrentTargets(): RebalanceTargets {
    const result: RebalanceTargets = {};
    anchorByKey.forEach((anchor, key) => {
      const inputs = inputsByKey.get(key);
      if (!inputs) return;
      const input = inputs.get(anchor);
      if (!input) return;
      const v = parseAnchorInputValue(anchor, input.value);
      if (v != null) result[key] = { anchor, value: v };
    });
    return result;
  }

  function setButtonEnabled(btn: HTMLButtonElement, enabled: boolean): void {
    btn.disabled = !enabled;
    btn.style.opacity = enabled ? "1" : "0.5";
    btn.style.cursor = enabled ? "pointer" : "not-allowed";
  }

  function syncProfileControls(p: Payload): void {
    const profiles = listProfiles(p);
    const profileHash = profiles
      .map((x) => `${x.id}|${x.name}|${x.createdAt}`)
      .join("||");

    if (profileHash !== state.getLastProfilesHash()) {
      profileSelect.innerHTML = "";
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent =
        profiles.length > 0 ? "Portfolio ..." : "No portfolio saved";
      profileSelect.appendChild(placeholder);
      profiles.forEach((profile) => {
        const option = document.createElement("option");
        option.value = profile.id;
        option.textContent = profile.name;
        profileSelect.appendChild(option);
      });
      state.setLastProfilesHash(profileHash);
    }

    let selectedProfileId = state.getSelectedProfileId();
    if (
      selectedProfileId &&
      !profiles.some((profile) => profile.id === selectedProfileId)
    ) {
      selectedProfileId = "";
    }
    if (!selectedProfileId && profiles.length > 0) {
      selectedProfileId = profiles[0].id;
    }
    state.setSelectedProfileId(selectedProfileId);
    profileSelect.value = selectedProfileId || "";

    const hasSelection = selectedProfileId.length > 0;
    setButtonEnabled(loadProfileBtn, hasSelection);
    setButtonEnabled(deleteProfileBtn, hasSelection);
    setButtonEnabled(exportAllBtn, profiles.length > 0);
    setButtonEnabled(exportSelectedBtn, hasSelection);
  }

  function getSelectedProfile(): RebalanceProfile | null {
    const selectedId = state.getSelectedProfileId() || profileSelect.value;
    if (!selectedId) return null;
    const profiles = state.getLatestPayload().rebalanceProfiles ?? [];
    return profiles.find((profile) => profile.id === selectedId) ?? null;
  }

  function applyTargets(nextTargets: RebalanceTargets): void {
    dirtyKeys.clear();
    const cloned = cloneTargets(nextTargets);
    state.setSelfTriggeredUpdate(true);
    state.setLastTargetsHash(JSON.stringify(cloned));
    const latestPayload = state.getLatestPayload();
    const optimisticPayload: Payload = {
      ...latestPayload,
      rebalanceTargets: cloned,
    };
    state.setLatestPayload(optimisticPayload);
    optimisticPayload.onUpdateRebalanceTargets?.(cloned);
    state.renderAll(optimisticPayload);
  }

  profileSelect.addEventListener("change", () => {
    state.setSelectedProfileId(profileSelect.value || "");
    syncProfileControls(state.getLatestPayload());
  });

  saveProfileBtn.addEventListener("click", () => {
    const ts = Date.now();
    const nextTargets = collectCurrentTargets();
    applyTargets(nextTargets);

    const latestPayload = state.getLatestPayload();
    const profile: RebalanceProfile = {
      id: `rp_${ts}_${Math.random().toString(36).slice(2, 8)}`,
      name: buildAutoProfileName(
        nextTargets,
        latestPayload,
        ts,
        state.getBetaHorizon(),
      ),
      createdAt: ts,
      rebalanceTargets: cloneTargets(nextTargets),
    };
    const currentProfiles = listProfiles(latestPayload);
    const nextProfiles = [profile, ...currentProfiles].slice(
      0,
      MAX_REBALANCE_PROFILES,
    );
    state.setSelectedProfileId(profile.id);
    latestPayload.onUpdateRebalanceProfiles?.(nextProfiles);
    state.renderAll({ ...latestPayload, rebalanceProfiles: nextProfiles });
  });

  loadProfileBtn.addEventListener("click", () => {
    const selected = getSelectedProfile();
    if (!selected) return;
    state.setSelectedProfileId(selected.id);
    state.setRenderedKeyList("");
    applyTargets(selected.rebalanceTargets);
  });

  deleteProfileBtn.addEventListener("click", () => {
    const selected = getSelectedProfile();
    if (!selected) return;
    const latestPayload = state.getLatestPayload();
    const nextProfiles = listProfiles(latestPayload).filter(
      (profile) => profile.id !== selected.id,
    );
    state.setSelectedProfileId(nextProfiles[0]?.id ?? "");
    latestPayload.onUpdateRebalanceProfiles?.(nextProfiles);
    state.renderAll({ ...latestPayload, rebalanceProfiles: nextProfiles });
  });

  exportAllBtn.addEventListener("click", () => {
    downloadProfiles(listProfiles(state.getLatestPayload()));
  });

  exportSelectedBtn.addEventListener("click", () => {
    const selected = getSelectedProfile();
    if (!selected) return;
    downloadProfiles([selected]);
  });

  importFileBtn.addEventListener("click", () => {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".json";
    fileInput.style.display = "none";
    fileInput.addEventListener("change", () => {
      const file = fileInput.files?.[0];
      if (!file || file.size > 2 * 1024 * 1024) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const validated = parseImportedProfiles(reader.result as string);
          if (validated.length === 0) return;
          const latestPayload = state.getLatestPayload();
          const existing = listProfiles(latestPayload);
          const existingTimestamps = new Set(existing.map((p) => p.createdAt));
          const merged = [
            ...existing,
            ...validated.filter((p) => !existingTimestamps.has(p.createdAt)),
          ]
            .sort((a, b) => b.createdAt - a.createdAt)
            .slice(0, MAX_REBALANCE_PROFILES);
          latestPayload.onUpdateRebalanceProfiles?.(merged);
          state.renderAll({ ...latestPayload, rebalanceProfiles: merged });
        } catch {
          /* ignore malformed JSON */
        }
      };
      reader.readAsText(file);
    });
    document.body.appendChild(fileInput);
    fileInput.click();
    document.body.removeChild(fileInput);
  });

  return { syncProfileControls };
}
