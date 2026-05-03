export interface VersionedState<T> {
  data: T;
  version: number;
  asOfTs: number;
  source?: "holdings" | "quotes" | "streamer" | "overnight";
}

export interface StateRepository<RawState, DerivedState> {
  loadRawState(): Promise<VersionedState<RawState> | null>;
  loadDerivedState(): Promise<VersionedState<DerivedState> | null>;
  saveRawState(state: VersionedState<RawState>): Promise<void>;
  saveDerivedState(state: VersionedState<DerivedState>): Promise<void>;
  getRawState(): VersionedState<RawState> | null;
  getDerivedState(): VersionedState<DerivedState> | null;
  getCurrentVersion(): number;
  nextVersion(): number;
}
