import { readPageInitContext } from "../backend/core/network/schwab/infra/initContext";

export const waitForDomReady = async (): Promise<void> => {
  if (document.readyState !== "loading") return;
  await new Promise<void>((resolve) =>
    document.addEventListener("DOMContentLoaded", () => resolve(), {
      once: true,
    }),
  );
};

export const waitForInitContext = async (
  timeoutMs = 2000,
): Promise<ReturnType<typeof readPageInitContext>> => {
  // Fast path: context already available (most common)
  try {
    const initCtx = readPageInitContext();
    if (initCtx.asn) return initCtx;
  } catch {}

  // MutationObserver-based wait: resolves instantly when the template element
  // appears or gets content
  return new Promise<ReturnType<typeof readPageInitContext>>((resolve) => {
    let resolved = false;
    const tryResolve = () => {
      if (resolved) return;
      try {
        const initCtx = readPageInitContext();
        if (initCtx.asn) {
          resolved = true;
          observer.disconnect();
          clearTimeout(timer);
          resolve(initCtx);
          return;
        }
        const upsEl = document.getElementById("ups-user-context");
        if (upsEl && (upsEl.textContent || "").trim().length > 0) {
          resolved = true;
          observer.disconnect();
          clearTimeout(timer);
          resolve(initCtx);
          return;
        }
      } catch {}
    };

    const observer = new MutationObserver(() => tryResolve());
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    const timer = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      observer.disconnect();
      try {
        resolve(readPageInitContext());
      } catch {
        resolve({
          asn: null,
          customerId: null,
          cip: null,
          upsUserContext: null,
          userContext: null,
        } as any);
      }
    }, timeoutMs);

    // Check once more in case content arrived between fast-path and observer setup
    tryResolve();
  });
};

export const maskTail = (
  v: string | null | undefined,
  keep = 4,
): string | null => {
  if (!v) return null;
  const s = String(v);
  if (s.length <= keep) return "*".repeat(s.length);
  return "*".repeat(s.length - keep) + s.slice(-keep);
};
