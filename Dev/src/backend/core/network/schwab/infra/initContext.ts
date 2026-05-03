import { safeJsonParse } from "../infra/httpUtils";

type UnknownRecord = Record<string, unknown>;

function getTemplateJson(id: string): unknown | null {
  const el = document.getElementById(id);
  if (!el) return null;
  const raw = (el.textContent || "").trim();
  if (!raw) return null;
  return safeJsonParse(raw);
}

function getCookie(name: string): string | undefined {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(";").shift();
  return undefined;
}

function isCustomerId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{32}$/i.test(value.trim());
}

function normalizeCustomerId(value: unknown): string | null {
  if (!isCustomerId(value)) return null;
  return value.trim().toUpperCase();
}

function normalizeAsn(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const digits = String(value).replace(/[^0-9]/g, "");
  if (!digits) return null;
  return digits;
}

export type PageInitContext = {
  upsUserContext?: UnknownRecord | null;
  userContext?: UnknownRecord | null;
  customerId: string | null;
  asn: string | null;
  cip: string | null;
};

export function resolveCustomerIdFromPage(): string | null {
  const upsUserContext = getTemplateJson("ups-user-context") as any;
  const fromTemplate = normalizeCustomerId(upsUserContext?.tr?.it); // page: ups-user-context.tr.it -> customerId
  if (fromTemplate) return fromTemplate;

  const cookieId = getCookie("s_hid_persist");
  if (typeof cookieId === "string" && cookieId.length >= 32) {
    const fromCookie = normalizeCustomerId(cookieId.substring(0, 32));
    if (fromCookie) return fromCookie;
  }

  const globalCandidates: unknown[] = [
    (globalThis as any)?.waUserId,
    (globalThis as any)?.visitorId,
  ];
  for (const v of globalCandidates) {
    if (typeof v === "string" && v.length >= 32) {
      const fromGlobal = normalizeCustomerId(v.substring(0, 32));
      if (fromGlobal) return fromGlobal;
    }
  }

  return null;
}

function resolveAsnFromPage(): string | null {
  const upsUserContext = getTemplateJson("ups-user-context") as any;
  const asnFromUps = normalizeAsn(upsUserContext?.asn); // page: ups-user-context.asn -> asn
  if (asnFromUps) return asnFromUps;

  const userContext = getTemplateJson("user-context") as any;
  const asnFromUserContext = normalizeAsn(userContext?.SelectedAccount); // page: user-context.SelectedAccount -> asn
  if (asnFromUserContext) return asnFromUserContext;

  const activeAccountId = (globalThis as any)?.activeAccountId;
  const asnFromActive = normalizeAsn(activeAccountId);
  if (asnFromActive) return asnFromActive;

  return null;
}

export function readPageInitContext(): PageInitContext {
  const upsUserContext =
    (getTemplateJson("ups-user-context") as UnknownRecord | null) ?? null;
  const userContext =
    (getTemplateJson("user-context") as UnknownRecord | null) ?? null;

  const customerId = resolveCustomerIdFromPage();
  const asn = resolveAsnFromPage();

  const cipRaw = (upsUserContext as any)?.cip; // page: ups-user-context.cip -> cip
  const cip =
    typeof cipRaw === "string" && cipRaw.trim() ? cipRaw.trim() : null;

  return {
    upsUserContext,
    userContext,
    customerId,
    asn,
    cip,
  };
}
