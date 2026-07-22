import React, { useState } from "react";
import { X, KeyRound, ArrowRight, RefreshCw, AlertCircle, Sparkles } from "lucide-react";

interface JoinModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
  userName: string;
  onJoinSuccess: (chatId: string) => void;
  initialToken?: string;
}

export const JoinModal: React.FC<JoinModalProps> = ({
  isOpen,
  onClose,
  userEmail,
  userName,
  onJoinSuccess,
  initialToken,
}) => {
  const [shareInput, setShareInput] = useState(initialToken || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (initialToken) {
      setShareInput(initialToken);
    }
  }, [initialToken]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shareInput.trim()) return;

    setError(null);
    setLoading(true);

    try {
      const trimmedInput = shareInput.trim();
      let token = trimmedInput;
      let isCode = false;

      // Parse token/code from full URL format or hash format
      if (token.includes("#share=")) {
        token = token.split("#share=")[1] || token;
      } else if (token.includes("share=")) {
        token = token.split("share=")[1] || token;
      } else if (token.includes("#code=")) {
        token = token.split("#code=")[1] || token;
        isCode = true;
      } else if (token.includes("code=")) {
        token = token.split("code=")[1] || token;
        isCode = true;
      } else {
        if (!token.startsWith("sh_") && (token.includes("-") || token.length <= 18)) {
          isCode = true;
        }
      }

      // Strip query parameters if present
      if (token.includes("&")) {
        token = token.split("&")[0];
      }

      const payload: any = {
        email: userEmail,
        fullName: userName,
        input: trimmedInput,
        shareToken: token,
        accessCode: token,
      };

      const res = await fetch("/api/share/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      let data: any;
      try {
        data = await res.json();
      } catch (parseErr) {
        throw new Error(`Server returned non-JSON response (HTTP status ${res.status})`);
      }

      if (res.ok && data.success) {
        onJoinSuccess(data.chatId);
        onClose();
        setShareInput("");
      } else {
        setError(data.error || `Failed to join conversation (HTTP status ${res.status})`);
      }
    } catch (err: any) {
      console.error("Error joining shared conversation:", err);
      setError(err.message ? `Error: ${err.message}` : "A network error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-md bg-white dark:bg-[#11192e] border border-slate-100 dark:border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-7 overflow-hidden text-slate-800 dark:text-slate-100">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#C96A3D]/10 flex items-center justify-center text-[#C96A3D]">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">🔑 Join Shared Chat</h3>
              <p className="text-[10.5px] text-slate-400 font-bold mt-0.5">Access a shared Nexa Intelligence chat room</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Info Banner */}
        <div className="mb-4 p-3 rounded-2xl bg-[#C96A3D]/5 text-[#C96A3D] dark:text-[#C96A3D]/90 border border-[#C96A3D]/10 text-[10.5px] font-bold leading-relaxed flex gap-2 items-center">
          <Sparkles className="w-4 h-4 shrink-0" />
          <span>Enter Chat Access Code (e.g. NXA-4K7P-9Q) or paste a share link.</span>
        </div>

        {/* Join Form */}
        <form onSubmit={handleJoin} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-550">
              Enter Chat Access Code
            </label>
            <input
              type="text"
              required
              disabled={loading}
              value={shareInput}
              onChange={(e) => setShareInput(e.target.value)}
              placeholder="e.g. NXA-4K7P-9Q or CHAT-8M2X"
              className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 dark:text-white outline-none focus:border-[#C96A3D] dark:focus:border-[#C96A3D] font-mono tracking-wide placeholder:font-sans"
            />
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/15 text-[10.5px] font-bold flex gap-2 items-center leading-snug">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-slate-550 dark:text-slate-300 text-xs font-black uppercase tracking-wider rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !shareInput.trim()}
              className="px-5 py-2.5 bg-[#C96A3D] hover:bg-[#b05d33] disabled:opacity-55 text-white text-xs font-black uppercase tracking-wider rounded-xl cursor-pointer flex items-center gap-1.5 shadow-md shadow-[#C96A3D]/10"
            >
              {loading ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <>
                  <span>Join</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
