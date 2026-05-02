/**
 * SettingsStore — typed, observable settings container with a hydration guard.
 *
 * Purpose: Centralize the merge/normalize/persist/emit pipeline that today
 * lives inline inside `ctx.onUpdateSettings`. Use this class when wiring
 * new pages or refactoring an existing surface to reduce per-page boilerplate.
 *
 * Hydration guard: Once `hydrate()` has been called (e.g. from per-token KV),
 * subsequent `load()` calls become no-ops. Prevents a late boot-time read
 * from clobbering the authoritative per-account state.
 *
 * The store is INDEPENDENT of any specific persistence mechanism — wire your
 * own KV writer + normaliser via `setKvWriter()` and `setRenderUpdater()`.
 */

import type { Settings } from "shared/types/core";
import {
  defaultSettings,
  normalizeSettings,
} from "shared/settings/settingsNormalization";
import { Subscribable } from "shared/utils/Subscribable";
import { logService } from "shared/log/core/LogService";

const log = logService.namespace("storage");

export type KvWriter = (
  key: string,
  value: unknown,
  opts?: { immediate?: boolean },
) => void;

export type SettingsRenderUpdater = (
  ctx: { settings: Settings },
  opts: { rerender: boolean },
) => void;

export type SettingsLoader = () => Promise<Partial<Settings> | null>;

export class SettingsStore {
  private state: Settings = { ...defaultSettings };
  private subscribers = new Subscribable<Settings>();
  private hydrated = false;

  private kvWriter: KvWriter | null = null;
  private renderUpdater: SettingsRenderUpdater | null = null;

  /** Wire the KV persistence layer. Called when `patch()` mutates state. */
  setKvWriter(fn: KvWriter): void {
    this.kvWriter = fn;
  }

  /** Wire the RenderEngine context updater. Called by `patch()`. */
  setRenderUpdater(fn: SettingsRenderUpdater): void {
    this.renderUpdater = fn;
  }

  /**
   * Read settings via the provided loader and apply if not already hydrated.
   * If `hydrate()` has been called, this is a no-op (per-token data wins).
   */
  async load(loader: SettingsLoader): Promise<Settings> {
    try {
      if (this.hydrated) {
        log.debug("settings.load.skipped — already hydrated");
        return this.state;
      }
      const raw = await loader();
      const merged = normalizeSettings({ ...defaultSettings, ...(raw ?? {}) });
      this.state = merged;
      this.subscribers.emit(merged);
      log.debug("settings.loaded");
      return merged;
    } catch (e) {
      log.warn("settings.loadFailed", {
        error: (e as Error)?.message ?? String(e),
      });
      return this.state;
    }
  }

  /**
   * Hydrate from an already-loaded settings object (e.g. after per-token KV
   * load completes during boot). Marks the store as authoritative —
   * subsequent `load()` calls become no-ops.
   */
  hydrate(raw: Partial<Settings>): Settings {
    const merged = normalizeSettings({ ...defaultSettings, ...(raw as any) });
    this.state = merged;
    this.hydrated = true;
    this.subscribers.emit(merged);
    return merged;
  }

  /** True once `hydrate()` has been called at least once. */
  isHydrated(): boolean {
    return this.hydrated;
  }

  /**
   * Merge a partial patch, normalize, persist (if KV writer wired), emit,
   * and notify the render updater.
   */
  patch(partial: Partial<Settings>, opts?: { rerender?: boolean }): void {
    const next = normalizeSettings({
      ...(this.state as any),
      ...(partial as any),
    });
    this.state = next;

    if (this.kvWriter) {
      this.kvWriter("settings", next, { immediate: true });
    }

    this.subscribers.emit(next);

    if (this.renderUpdater) {
      this.renderUpdater(
        { settings: next },
        { rerender: opts?.rerender ?? true },
      );
    }
  }

  /** Read current full settings state. */
  get(): Settings {
    return this.state;
  }

  /** Read a single settings key. */
  getKey<K extends keyof Settings>(key: K): Settings[K] {
    return this.state[key];
  }

  /** Subscribe to any settings change. The latest state is replayed. */
  subscribe(cb: (settings: Settings) => void): () => void {
    return this.subscribers.subscribe(cb);
  }

  dispose(): void {
    this.subscribers.clear();
  }
}
