class LogClock {
  private hasPerformance: boolean;
  private t0: number;
  private lastLog: number;

  constructor() {
    this.hasPerformance =
      typeof performance !== "undefined" && !!performance.now;
    this.t0 = this.now();
    this.lastLog = this.t0;
  }

  now() {
    return this.hasPerformance ? performance.now() : Date.now();
  }

  stamp() {
    const current = this.now();
    const delta = current - this.lastLog;
    const total = current - this.t0;
    this.lastLog = current;
    return { current, delta, total };
  }

  formatTime() {
    const d = new Date();
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(d);
    const get = (type: string) =>
      parts.find((p) => p.type === type)?.value ?? "00";
    const ms = String(d.getMilliseconds()).padStart(3, "0");
    return `${get("hour")}:${get("minute")}:${get("second")}.${ms}`;
  }

  reset() {
    this.t0 = this.now();
    this.lastLog = this.t0;
  }
}

export const logClock = new LogClock();
