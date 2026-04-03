import type {
  StateRepository,
  VersionedState,
} from "../../shared/utils/StateRepository";
import type { Logger } from "../../shared/log/Logger";
import type { Clock } from "../../shared/utils/Clock";

export class InMemoryStateRepository<
  RawState,
  DerivedState,
> implements StateRepository<RawState, DerivedState> {
  private rawState: VersionedState<RawState> | null = null;
  private derivedState: VersionedState<DerivedState> | null = null;
  private currentVersion: number = 0;
  private logger: Logger;
  private clock: Clock;

  private persistRaw?: (state: VersionedState<RawState>) => Promise<void>;
  private persistDerived?: (
    state: VersionedState<DerivedState>,
  ) => Promise<void>;
  private loadRawFromStorage?: () => Promise<VersionedState<RawState> | null>;
  private loadDerivedFromStorage?: () => Promise<VersionedState<DerivedState> | null>;

  constructor(
    logger: Logger,
    clock: Clock,
    options?: {
      persistRaw?: (state: VersionedState<RawState>) => Promise<void>;
      persistDerived?: (state: VersionedState<DerivedState>) => Promise<void>;
      loadRawFromStorage?: () => Promise<VersionedState<RawState> | null>;
      loadDerivedFromStorage?: () => Promise<VersionedState<DerivedState> | null>;
    },
  ) {
    this.logger = logger;
    this.clock = clock;
    this.persistRaw = options?.persistRaw;
    this.persistDerived = options?.persistDerived;
    this.loadRawFromStorage = options?.loadRawFromStorage;
    this.loadDerivedFromStorage = options?.loadDerivedFromStorage;
  }

  async loadRawState(): Promise<VersionedState<RawState> | null> {
    if (this.rawState) {
      return this.rawState;
    }

    if (this.loadRawFromStorage) {
      try {
        const loaded = await this.loadRawFromStorage();
        if (loaded) {
          this.rawState = loaded;
          this.currentVersion = Math.max(this.currentVersion, loaded.version);
          this.logger.info(
            `Loaded raw state from storage, version ${loaded.version}`,
          );
        }
        return loaded;
      } catch (error) {
        this.logger.error("Failed to load raw state from storage:", error);
        return null;
      }
    }

    return null;
  }

  async loadDerivedState(): Promise<VersionedState<DerivedState> | null> {
    if (this.derivedState) {
      return this.derivedState;
    }

    if (this.loadDerivedFromStorage) {
      try {
        const loaded = await this.loadDerivedFromStorage();
        if (loaded) {
          this.derivedState = loaded;
          this.currentVersion = Math.max(this.currentVersion, loaded.version);
          this.logger.info(
            `Loaded derived state from storage, version ${loaded.version}`,
          );
        }
        return loaded;
      } catch (error) {
        this.logger.error("Failed to load derived state from storage:", error);
        return null;
      }
    }

    return null;
  }

  async saveRawState(state: VersionedState<RawState>): Promise<void> {
    this.rawState = state;
    this.currentVersion = Math.max(this.currentVersion, state.version);

    if (this.persistRaw) {
      try {
        await this.persistRaw(state);
        this.logger.debug(`Persisted raw state, version ${state.version}`);
      } catch (error) {
        this.logger.error("Failed to persist raw state:", error);
      }
    }
  }

  async saveDerivedState(state: VersionedState<DerivedState>): Promise<void> {
    this.derivedState = state;
    this.currentVersion = Math.max(this.currentVersion, state.version);

    if (this.persistDerived) {
      try {
        await this.persistDerived(state);
        this.logger.debug(`Persisted derived state, version ${state.version}`);
      } catch (error) {
        this.logger.error("Failed to persist derived state:", error);
      }
    }
  }

  getCurrentVersion(): number {
    return this.currentVersion;
  }

  nextVersion(): number {
    return ++this.currentVersion;
  }

  getRawState(): VersionedState<RawState> | null {
    return this.rawState;
  }

  getDerivedState(): VersionedState<DerivedState> | null {
    return this.derivedState;
  }

  clear(): void {
    this.rawState = null;
    this.derivedState = null;
    this.logger.info("Cleared in-memory state");
  }
}
