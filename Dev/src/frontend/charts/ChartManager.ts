import {
  Chart,
  ChartConfiguration,
  ChartType,
  DefaultDataPoint,
  CategoryScale,
  LinearScale,
  BarController,
  BubbleController,
  DoughnutController,
  LineController,
  ArcElement,
  BarElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { logService } from "shared/log/core/LogService";

Chart.register(
  CategoryScale,
  LinearScale,
  BarController,
  BubbleController,
  DoughnutController,
  LineController,
  ArcElement,
  BarElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
  Filler,
);

const log = logService.namespace("chart");

class ChartManager {
  private charts = new WeakMap<HTMLCanvasElement, Chart>();
  private activeCanvases = new Set<HTMLCanvasElement>();
  private lastUpdate = new Map<HTMLCanvasElement, number>();
  private readonly updateThrottleMs: number;

  constructor(updateThrottleMs: number = 200) {
    this.updateThrottleMs = updateThrottleMs;
    this.setupResizeListener();
  }

  private setupResizeListener(): void {
    let resizeTimer: ReturnType<typeof setTimeout>;
    const handler = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => this.resizeAll(), 150);
    };
    window.addEventListener("resize", handler);
    window.addEventListener("orientationchange", handler);

    // Re-render every active chart when the theme switches so palette /
    // tooltip / grid / text colors pick up the new variants. Chart.js options
    // are snapshotted at creation, so a `chart.update()` is enough — themed
    // helpers (yAxis / themedChartOptions / niceLinearScale) re-resolve on
    // each draw.
    window.addEventListener("themeChanged", () => {
      for (const canvas of this.activeCanvases) {
        const chart = this.charts.get(canvas);
        if (!chart) continue;
        try {
          chart.update("none");
        } catch {
          /* non-critical */
        }
      }
    });
  }

  createOrUpdate<
    TType extends ChartType = ChartType,
    TData = DefaultDataPoint<TType>,
    TLabel = unknown,
  >(
    canvas: HTMLCanvasElement,
    config: ChartConfiguration<TType, TData, TLabel>,
    animate: boolean = true,
  ): Chart<TType, TData, TLabel> {
    const existing = this.charts.get(canvas) as
      | Chart<TType, TData, TLabel>
      | undefined;

    if (existing) {
      return this.updateChart(existing, config, animate);
    }

    return this.createChart(canvas, config);
  }

  private updateChart<
    TType extends ChartType = ChartType,
    TData = DefaultDataPoint<TType>,
    TLabel = unknown,
  >(
    chart: Chart<TType, TData, TLabel>,
    config: ChartConfiguration<TType, TData, TLabel>,
    animate: boolean,
  ): Chart<TType, TData, TLabel> {
    const now = performance.now();
    const lastUpdate = this.lastUpdate.get(chart.canvas) ?? 0;
    const shouldAnimate = animate && now - lastUpdate > this.updateThrottleMs;

    try {
      chart.data = config.data;

      if (config.options) {
        chart.options = config.options as any;
      }

      chart.update(shouldAnimate ? undefined : "none");

      this.lastUpdate.set(chart.canvas, now);

      log.debug("chart.update.done", {
        chartId: (chart as any).id,
        animated: shouldAnimate,
        timeSinceLastUpdate: now - lastUpdate,
      });
    } catch (err) {
      log.error("chart.update.fail", {
        error: (err as Error)?.message,
        chartId: (chart as any).id,
      });
    }

    return chart;
  }

  private createChart<
    TType extends ChartType = ChartType,
    TData = DefaultDataPoint<TType>,
    TLabel = unknown,
  >(
    canvas: HTMLCanvasElement,
    config: ChartConfiguration<TType, TData, TLabel>,
  ): Chart<TType, TData, TLabel> {
    try {
      const chart = new Chart(canvas, config);
      this.charts.set(canvas, chart as any);
      this.activeCanvases.add(canvas);
      this.lastUpdate.set(canvas, performance.now());

      if (!canvas.isConnected) {
        this.scheduleDeferredResize(canvas);
      }

      log.debug("chart.created", {
        chartId: (chart as any).id,
        type: config.type,
      });

      return chart;
    } catch (err) {
      log.error("chart.create.fail", {
        error: (err as Error)?.message,
        type: config.type,
      });
      throw err;
    }
  }

  /**
   * Poll via rAF until the canvas is connected to the DOM and its parent has
   * non-zero dimensions, then call chart.resize() to fix the layout.
   */
  private scheduleDeferredResize(canvas: HTMLCanvasElement): void {
    let frame = 0;
    const check = () => {
      const chart = this.charts.get(canvas);
      if (!chart) return;

      if (canvas.isConnected) {
        try {
          chart.resize();
        } catch {
          /* noop */
        }
        return;
      }

      if (++frame < 30) {
        // retry up to ~500 ms at 60 fps
        requestAnimationFrame(check);
      }
    };
    requestAnimationFrame(check);
  }

  destroy(canvas: HTMLCanvasElement): void {
    const chart = this.charts.get(canvas);
    if (chart) {
      try {
        chart.destroy();
        this.charts.delete(canvas);
        this.activeCanvases.delete(canvas);
        this.lastUpdate.delete(canvas);

        log.debug("chart.destroyed", {
          chartId: (chart as any).id,
        });
      } catch (err) {
        log.error("chart.destroy.fail", {
          error: (err as Error)?.message,
          chartId: (chart as any).id,
        });
      }
    }
  }

  resizeAll(): void {
    for (const canvas of this.activeCanvases) {
      const chart = this.charts.get(canvas);
      if (!chart) {
        this.activeCanvases.delete(canvas);
        continue;
      }
      try {
        chart.resize();
      } catch {}
    }
  }

  get(canvas: HTMLCanvasElement): Chart | undefined {
    return this.charts.get(canvas);
  }

  has(canvas: HTMLCanvasElement): boolean {
    return this.charts.get(canvas) !== undefined;
  }
}

export const chartManager = new ChartManager();
