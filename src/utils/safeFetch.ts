import { safeStorage } from "./storage";

export async function safeFetchJson<T = any>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; data: T | null; error?: string }> {
  try {
    const urlStr = typeof input === "string" ? input : input.toString();
    const headers = new Headers(init?.headers || {});

    if (urlStr.includes("/api/share")) {
      const isPremium =
        safeStorage.getItem("nexa_is_premium") === "true" ||
        safeStorage.getItem("nexa_user_plan") === "premium" ||
        safeStorage.getItem("nexa_premium_waitlist_joined") === "true";
      if (isPremium) {
        headers.set("x-nexa-premium", "true");
        headers.set("x-is-premium", "true");
      }
    }

    const modifiedInit = {
      ...init,
      headers,
    };

    const res = await fetch(input, modifiedInit);
    const contentType = res.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const data = await res.json();
      return { ok: res.ok, status: res.status, data };
    } else {
      const text = await res.text();
      const cleanSnippet = text.replace(/<[^>]*>?/gm, "").replace(/\s+/g, " ").trim().substring(0, 100);
      const cleanError = res.ok
        ? "Received non-JSON response from server."
        : `Server error (${res.status}): ${cleanSnippet || res.statusText}`;
      return {
        ok: false,
        status: res.status,
        data: null,
        error: cleanError,
      };
    }
  } catch (err: any) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: err.message || "Network request failed.",
    };
  }
}
