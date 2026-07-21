/**
 * Safe localStorage wrapper that handles SecurityError or blocked storage gracefully
 */
export const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn(`[SafeStorage] Failed to read key "${key}" from localStorage:`, e);
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn(`[SafeStorage] Failed to write key "${key}" to localStorage:`, e);
    }
  },
  removeItem: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn(`[SafeStorage] Failed to remove key "${key}" from localStorage:`, e);
    }
  }
};

/**
 * Robust copy-to-clipboard function that works seamlessly inside sandboxed iframe previews
 * by falling back to a temporary select-and-copy textarea if navigator.clipboard fails or is blocked.
 */
export function copyToClipboard(text: string): Promise<boolean> {
  return new Promise((resolve) => {
    // 1. Try modern navigator.clipboard API
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      navigator.clipboard.writeText(text)
        .then(() => resolve(true))
        .catch((err) => {
          console.warn("[Nexa] Navigator clipboard failed, trying fallback:", err);
          resolve(fallbackCopy(text));
        });
    } else {
      resolve(fallbackCopy(text));
    }
  });
}

function fallbackCopy(text: string): boolean {
  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    
    // Position out-of-screen and styling reset
    textArea.style.position = "fixed";
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.width = "2em";
    textArea.style.height = "2em";
    textArea.style.padding = "0";
    textArea.style.border = "none";
    textArea.style.outline = "none";
    textArea.style.boxShadow = "none";
    textArea.style.background = "transparent";
    
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    const successful = document.execCommand("copy");
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error("[Nexa] Fallback copy failed:", err);
    return false;
  }
}

