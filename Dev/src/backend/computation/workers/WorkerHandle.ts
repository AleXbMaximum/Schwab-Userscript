import { logService } from "../../../shared/log/core/LogService";

const log = logService.namespace("worker");

type WorkerResponse = {
  id: number;
  result?: unknown;
  error?: string;
};

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

export class WorkerHandle {
  private worker: Worker;
  private pending = new Map<number, PendingRequest>();
  private nextId = 1;

  constructor(code: string) {
    const blob = new Blob([code], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    this.worker = new Worker(url);
    URL.revokeObjectURL(url);
    this.worker.onmessage = (e: MessageEvent<WorkerResponse>) =>
      this.onMessage(e);
    this.worker.onerror = (e: ErrorEvent) => this.onError(e);
    log.info("worker.created");
  }

  run(task: string, payload: Record<string, unknown>): Promise<unknown> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ id, task, ...payload });
    });
  }

  get pendingCount(): number {
    return this.pending.size;
  }

  terminate(): void {
    log.info("worker.terminated", { pendingRequests: this.pending.size });
    this.worker.terminate();
    for (const [, req] of this.pending) {
      req.reject(new Error("Worker terminated"));
    }
    this.pending.clear();
  }

  private onMessage(e: MessageEvent<WorkerResponse>): void {
    const { id, result, error } = e.data;
    const req = this.pending.get(id);
    if (!req) return;
    this.pending.delete(id);

    if (error) {
      req.reject(new Error(error));
    } else {
      req.resolve(result);
    }
  }

  private onError(e: ErrorEvent): void {
    const errorMsg = e.message || "Worker error";
    log.error("worker.error", {
      error: errorMsg,
      pendingRequests: this.pending.size,
    });
    for (const [, req] of this.pending) {
      req.reject(new Error(errorMsg));
    }
    this.pending.clear();
  }
}
