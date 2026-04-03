import type { HoldingsTableColumnId } from "../../../../shared/holdingsTableColumns";
import {
  NUMERIC_FLASH_COLUMNS,
  INVERT_FOR_SHORT_COLUMNS,
} from "../table/columnMetadata";
import type { CellChange } from "../utils/CellDiffer";

const FLASH_COOLDOWN_MS = 150;
const MAX_FLASHES_PER_BATCH = 120;
const CSS_CLASS_FLASH_GREEN = "table-flash-green";
const CSS_CLASS_FLASH_RED = "table-flash-red";
const PRIORITY_FLASH_COLUMNS = new Set<HoldingsTableColumnId>([
  "price",
  "priceChngPct",
  "priceChngDol",
  "dayChngPct",
  "dayChngDol",
  "gainLossDol",
  "gainLossPct",
  "marketValue",
]);

/** Remove flash classes after animation completes so DOM reinsertions can't replay stale animations. */
function handleFlashEnd(this: HTMLTableCellElement): void {
  this.classList.remove(CSS_CLASS_FLASH_GREEN, CSS_CLASS_FLASH_RED);
}

interface PendingFlash {
  cell: WeakRef<HTMLTableCellElement>;
  direction: "up" | "down";
  isInverted: boolean;
}

export class FlashAnimator {
  private lastFlashTime = new Map<string, number>();
  private pendingFlashes = new Map<string, PendingFlash>();
  private rafId: number | null = null;
  private cleanupCounter = 0;
  private readonly cleanupInterval = 100; // Run cleanup every N flashes

  requestFlash(
    cellKey: string,
    cell: HTMLTableCellElement,
    direction: "up" | "down",
    columnId: HoldingsTableColumnId,
    isShort = false,
  ): boolean {
    if (!NUMERIC_FLASH_COLUMNS.has(columnId)) {
      return false;
    }

    const now = performance.now();
    const lastFlash = this.lastFlashTime.get(cellKey) ?? 0;
    if (now - lastFlash < FLASH_COOLDOWN_MS) {
      return false;
    }

    this.lastFlashTime.set(cellKey, now);

    const isInverted = isShort && INVERT_FOR_SHORT_COLUMNS.has(columnId);

    this.pendingFlashes.set(cellKey, {
      cell: new WeakRef(cell),
      direction,
      isInverted,
    });

    if (this.rafId === null) {
      this.rafId = requestAnimationFrame(() => this.processPendingFlashes());
    }

    return true;
  }

  private processPendingFlashes(): void {
    this.rafId = null;

    // Batch DOM writes to avoid interleaved read/write reflow thrashing.
    // Phase 1: remove old flash classes (write batch)
    // Phase 2: single reflow trigger
    // Phase 3: add new flash classes (write batch)
    const resolved: Array<{ cell: HTMLTableCellElement; flashClass: string }> =
      [];

    for (const [cellKey, pending] of this.pendingFlashes) {
      const cell = pending.cell.deref();
      if (!cell) {
        this.pendingFlashes.delete(cellKey);
        continue;
      }

      const isGood = pending.isInverted
        ? pending.direction === "down"
        : pending.direction === "up";

      const flashClass = isGood ? CSS_CLASS_FLASH_GREEN : CSS_CLASS_FLASH_RED;

      cell.classList.remove(CSS_CLASS_FLASH_GREEN, CSS_CLASS_FLASH_RED);
      cell.removeEventListener("animationend", handleFlashEnd);
      resolved.push({ cell, flashClass });
    }

    // Single reflow read for the entire batch (instead of N reads)
    if (resolved.length > 0) {
      void resolved[0].cell.offsetWidth;
    }

    for (const { cell, flashClass } of resolved) {
      cell.classList.add(flashClass);
      cell.addEventListener("animationend", handleFlashEnd, { once: true });
    }

    this.pendingFlashes.clear();

    this.cleanupCounter++;
    if (this.cleanupCounter >= this.cleanupInterval) {
      this.cleanupCounter = 0;
      this.cleanupStaleCooldowns();
    }
  }

  private cleanupStaleCooldowns(): void {
    const now = performance.now();
    const staleThreshold = 10000; // 10 seconds

    for (const [cellKey, lastFlash] of this.lastFlashTime) {
      if (now - lastFlash > staleThreshold) {
        this.lastFlashTime.delete(cellKey);
      }
    }
  }

  processCellChanges(
    changes: CellChange[],
    cellLookup: (
      rowKey: string,
      columnId: HoldingsTableColumnId,
    ) => HTMLTableCellElement | null,
    isShortLookup: (rowKey: string) => boolean = () => false,
  ): void {
    const heavyBatch = changes.length > MAX_FLASHES_PER_BATCH;
    let flashedCount = 0;

    for (const change of changes) {
      if (change.changeType !== "value-only" || change.direction === "none") {
        continue;
      }
      if (heavyBatch && !PRIORITY_FLASH_COLUMNS.has(change.columnId)) {
        continue;
      }
      if (flashedCount >= MAX_FLASHES_PER_BATCH) {
        break;
      }

      const cell = cellLookup(change.rowKey, change.columnId);
      if (!cell) continue;

      const isShort = isShortLookup(change.rowKey);
      const flashed = this.requestFlash(
        change.cellKey,
        cell,
        change.direction,
        change.columnId,
        isShort,
      );
      if (flashed) {
        flashedCount++;
      }
    }
  }

  reset(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.pendingFlashes.clear();
    this.lastFlashTime.clear();
    this.cleanupCounter = 0;
  }

  clearCellCooldown(cellKey: string): void {
    this.lastFlashTime.delete(cellKey);
    this.pendingFlashes.delete(cellKey);
  }
}
