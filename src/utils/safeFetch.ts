export async function safeFetchJson<T = any>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; data: T | null; error?: string }> {
  try {
    const res = await fetch(input, init);
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
