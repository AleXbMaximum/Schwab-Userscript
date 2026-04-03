export type RenderFrameController = {
  schedule: () => void;
  destroy: () => void;
};

function canRender(target: HTMLElement): boolean {
  if (!target.isConnected) return false;
  const rect = target.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

export function createRenderFrame(
  target: HTMLElement,
  render: () => void,
): RenderFrameController {
  let rafId: number | null = null;
  let destroyed = false;
  let observer: ResizeObserver | null = null;

  const run = () => {
    if (destroyed || !canRender(target)) return;
    render();
  };

  const schedule = () => {
    if (destroyed) return;
    if (rafId != null) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      rafId = null;
      run();
    });
  };

  const onWindowResize = () => {
    schedule();
  };

  window.addEventListener("resize", onWindowResize);

  if (typeof ResizeObserver !== "undefined") {
    observer = new ResizeObserver(() => {
      schedule();
    });
    observer.observe(target);
  }

  return {
    schedule,
    destroy: () => {
      destroyed = true;
      if (rafId != null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      if (observer) {
        observer.disconnect();
        observer = null;
      }
      window.removeEventListener("resize", onWindowResize);
    },
  };
}
