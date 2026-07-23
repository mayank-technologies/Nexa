import React, { useState, useEffect } from "react";
import { X, Copy, Check, Shield, UserMinus, ShieldAlert, Link, RefreshCw, Send, Lock, Eye, MessageSquare, KeyRound, Clock } from "lucide-react";

interface Participant {
  email: string;
  name: string;
  role: "editor" | "viewer" | "owner";
  joinedAt?: string;
}

interface ShareConfig {
  chatId: string;
  ownerEmail: string;
  shareToken: string;
  isSharingActive: boolean;
  defaultPermission: "chat" | "view";
  participants: Participant[];
  expiresAt: string | null;
  // Access code fields
  accessCode?: string | null;
  accessCodeExpiresAt?: string | null;
  accessCodePermission?: "chat" | "view";
  accessCodeIsActive?: boolean;
  accessCodeDurationType?: "1h" | "24h" | "7d" | "never";
}

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  chatId: string;
  userEmail: string;
  userName: string;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  chatId,
  userEmail,
}) => {
  const [config, setConfig] = useState<ShareConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"link" | "code">("link");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("editor");
  const [copied, setCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Expiry & permission state for access code creation/update
  const [codeExpiryValue, setCodeExpiryValue] = useState<string>("never");
  const [codePermissionValue, setCodePermissionValue] = useState<"chat" | "view">("chat");

  const fetchShareConfig = async () => {
    if (!chatId) {
      setLoading(false);
      setConfig(null);
      return;
    }
    try {
      setLoading(true);
      const effectiveEmail = userEmail || "guest@nexa.ai";
      const res = await fetch(`/api/share/info/${chatId}?email=${encodeURIComponent(effectiveEmail)}`);
      const data = await res.json();
      if (data.success && data.config) {
        setConfig(data.config);
        if (data.config.accessCodeDurationType) {
          setCodeExpiryValue(data.config.accessCodeDurationType);
        }
        if (data.config.accessCodePermission) {
          setCodePermissionValue(data.config.accessCodePermission);
        }
      } else {
        setConfig(null);
      }
    } catch (err) {
      console.error("Error fetching share config:", err);
      setConfig(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchShareConfig();
    }
  }, [isOpen, chatId, userEmail]);

  const handleEnableSharing = async () => {
    if (!chatId) return;
    try {
      setActionLoading("enable");
      const effectiveEmail = userEmail || "guest@nexa.ai";
      const effectiveName = userEmail ? userEmail.split("@")[0] : "Guest Collaborator";
      const res = await fetch("/api/share/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId,
          ownerEmail: effectiveEmail,
          ownerName: effectiveName,
          defaultPermission: "chat",
        }),
      });
      const data = await res.json();
      if (data.success && data.config) {
        setConfig(data.config);
      } else if (data.config_alias) {
        setConfig(data.config_alias);
      }
    } catch (err) {
      console.error("Error enabling sharing:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleSharing = async (active: boolean) => {
    if (!chatId) return;
    try {
      setActionLoading("toggle");
      const effectiveEmail = userEmail || "guest@nexa.ai";
      const res = await fetch(`/api/share/toggle/${chatId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerEmail: effectiveEmail,
          isSharingActive: active,
        }),
      });
      const data = await res.json();
      if (data.success && data.config) {
        setConfig(data.config);
      }
    } catch (err) {
      console.error("Error toggling sharing:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRegenerateLink = async () => {
    if (!chatId) return;
    try {
      setActionLoading("regenerate");
      const effectiveEmail = userEmail || "guest@nexa.ai";
      const res = await fetch(`/api/share/regenerate/${chatId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerEmail: effectiveEmail }),
      });
      const data = await res.json();
      if (data.success && data.config) {
        setConfig(data.config);
      } else if (data.success && data.shareToken) {
        setConfig((prev) => prev ? { ...prev, shareToken: data.shareToken } : null);
      }
    } catch (err) {
      console.error("Error regenerating share link:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateParticipantRole = async (targetEmail: string, role: "editor" | "viewer") => {
    if (!chatId) return;
    try {
      setActionLoading(`role-${targetEmail}`);
      const effectiveEmail = userEmail || "guest@nexa.ai";
      const res = await fetch(`/api/share/participant/role/${chatId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerEmail: effectiveEmail,
          targetEmail,
          role,
        }),
      });
      const data = await res.json();
      if (data.success && data.config) {
        setConfig(data.config);
      }
    } catch (err) {
      console.error("Error updating role:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemoveParticipant = async (targetEmail: string) => {
    if (!chatId) return;
    try {
      setActionLoading(`remove-${targetEmail}`);
      const effectiveEmail = userEmail || "guest@nexa.ai";
      const res = await fetch(`/api/share/participant/remove/${chatId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerEmail: effectiveEmail,
          targetEmail,
        }),
      });
      const data = await res.json();
      if (data.success && data.config) {
        setConfig(data.config);
      }
    } catch (err) {
      console.error("Error removing participant:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !chatId) return;
    try {
      setActionLoading("invite");
      const effectiveEmail = userEmail || "guest@nexa.ai";
      const res = await fetch(`/api/share/participant/add/${chatId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerEmail: effectiveEmail,
          targetEmail: inviteEmail.trim().toLowerCase(),
          role: inviteRole,
        }),
      });
      const data = await res.json();
      if (data.success && data.config) {
        setConfig(data.config);
        setInviteEmail("");
      } else {
        alert(data.error || "Failed to invite participant");
      }
    } catch (err) {
      console.error("Error inviting participant:", err);
    } finally {
      setActionLoading(null);
    }
  };

  // --- ACCESS CODE WORKFLOWS ---
  const handleGenerateAccessCode = async (expiryVal: string, permVal: "chat" | "view") => {
    if (!chatId) return;
    try {
      setActionLoading("generateCode");
      const effectiveEmail = userEmail || "guest@nexa.ai";
      const res = await fetch("/api/share/access-code/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId,
          ownerEmail: effectiveEmail,
          expiresAfterValue: expiryVal,
          defaultPermission: permVal
        })
      });
      const data = await res.json();
      if (data.success && data.config) {
        setConfig(data.config);
      }
    } catch (err) {
      console.error("Error generating access code:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDisableAccessCode = async () => {
    if (!chatId) return;
    try {
      setActionLoading("disableCode");
      const effectiveEmail = userEmail || "guest@nexa.ai";
      const res = await fetch("/api/share/access-code/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId,
          ownerEmail: effectiveEmail
        })
      });
      const data = await res.json();
      if (data.success && data.config) {
        setConfig(data.config);
      }
    } catch (err) {
      console.error("Error disabling access code:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const shareLink = config ? `${window.location.origin}/#share=${config.shareToken}` : "";

  const copyToClipboard = () => {
    if (!shareLink) return;
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyCodeToClipboard = () => {
    if (!config || !config.accessCode) return;
    navigator.clipboard.writeText(config.accessCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg bg-white dark:bg-[#11192e] border border-slate-100 dark:border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-7 overflow-hidden text-slate-800 dark:text-slate-100 max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#C96A3D]/10 flex items-center justify-center text-[#C96A3D]">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">Collaborative Sharing</h3>
              <p className="text-[10.5px] text-slate-400 font-bold mt-0.5">Invite others to chat and collaborate in real-time</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 flex-1">
            <RefreshCw className="w-8 h-8 text-[#C96A3D] animate-spin" />
            <p className="text-xs text-slate-400 font-bold">Retrieving sharing configurations...</p>
          </div>
        ) : !config ? (
          /* Empty Sharing State - Create sharing */
          <div className="flex flex-col items-center justify-center py-8 text-center gap-5 flex-1">
            <div className="w-16 h-16 rounded-2xl bg-slate-50 dark:bg-slate-900/50 flex items-center justify-center border border-slate-100 dark:border-slate-850">
              <Lock className="w-8 h-8 text-slate-400" />
            </div>
            <div className="max-w-xs">
              <h4 className="text-xs font-black text-slate-900 dark:text-white">Sharing is Disabled</h4>
              <p className="text-[11px] font-bold text-slate-400 mt-1 leading-relaxed">
                This conversation is currently private. Enable collaborative sharing to generate a secure sharing profile.
              </p>
            </div>
            <button
              onClick={handleEnableSharing}
              disabled={actionLoading !== null}
              className="w-full sm:w-auto px-5 py-2.5 bg-[#C96A3D] hover:bg-[#b05d33] disabled:opacity-55 text-white text-xs font-black uppercase tracking-wider rounded-xl cursor-pointer transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              {actionLoading === "enable" ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>Enable Collaborative Sharing</>
              )}
            </button>
          </div>
        ) : (
          /* Active Sharing configuration dashboard */
          <div className="flex flex-col flex-1 overflow-hidden">
            
            {/* Dual Tabs */}
            <div className="flex border-b border-slate-100 dark:border-slate-800 mb-5 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab("link")}
                className={`flex-1 pb-2.5 text-[11px] font-black uppercase tracking-wider text-center transition-all cursor-pointer ${
                  activeTab === "link"
                    ? "border-b-2 border-[#C96A3D] text-[#C96A3D]"
                    : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                }`}
              >
                🔗 Share via Link
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("code")}
                className={`flex-1 pb-2.5 text-[11px] font-black uppercase tracking-wider text-center transition-all cursor-pointer ${
                  activeTab === "code"
                    ? "border-b-2 border-[#C96A3D] text-[#C96A3D]"
                    : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                }`}
              >
                🔑 Share via Access Code
              </button>
            </div>

            <div className="space-y-5 overflow-y-auto pr-1 flex-1 scrollbar-thin">
              
              {/* TAB 1: SHARE VIA LINK */}
              {activeTab === "link" && (
                <>
                  {/* Active Switch Control */}
                  <div className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/20">
                    <div className="flex gap-2.5 items-start">
                      <Shield className="w-4 h-4 text-[#C96A3D] shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <span className="text-xs font-black block text-slate-800 dark:text-slate-200">Collaborator Access Link</span>
                        <span className="text-[10px] text-slate-400 font-bold leading-normal">
                          {config.isSharingActive ? "Active - Anyone with the link can request to join" : "Disabled - Link deactivated"}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleToggleSharing(!config.isSharingActive)}
                      disabled={actionLoading !== null}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out ${
                        config.isSharingActive ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-750"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out mt-0.5 ${
                          config.isSharingActive ? "translate-x-4.5" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  </div>

                  {config.isSharingActive && (
                    <>
                      {/* Link Output Block */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-550">
                          Secure Collaboration Link
                        </label>
                        <div className="flex gap-2">
                          <div className="flex-1 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/60 rounded-xl px-3.5 py-2.5 text-[11px] font-mono font-bold text-slate-500 dark:text-slate-300 truncate select-all">
                            {shareLink}
                          </div>
                          <button
                            onClick={copyToClipboard}
                            className="p-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 hover:border-[#C96A3D] text-slate-500 hover:text-[#C96A3D] rounded-xl cursor-pointer transition-colors shrink-0 flex items-center justify-center"
                            title="Copy Link"
                          >
                            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={handleRegenerateLink}
                            disabled={actionLoading === "regenerate"}
                            className="p-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 hover:border-[#C96A3D] text-slate-400 hover:text-[#C96A3D] rounded-xl cursor-pointer transition-colors shrink-0 flex items-center justify-center disabled:opacity-50"
                            title="Regenerate Link (Revokes previous link)"
                          >
                            <RefreshCw className={`w-4 h-4 ${actionLoading === "regenerate" ? "animate-spin" : ""}`} />
                          </button>
                        </div>
                      </div>

                      {/* Email Invitation Form */}
                      <form onSubmit={handleInvite} className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-550">
                          Invite Participant
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="email"
                            required
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                            placeholder="collaborator@email.com"
                            className="flex-1 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-800 dark:text-white outline-none focus:border-[#C96A3D]"
                          />
                          <select
                            value={inviteRole}
                            onChange={(e) => setInviteRole(e.target.value as any)}
                            className="bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-xl px-2.5 text-[11px] font-bold text-slate-600 dark:text-slate-300 outline-none"
                          >
                            <option value="editor">Can Chat</option>
                            <option value="viewer">View Only</option>
                          </select>
                          <button
                            type="submit"
                            disabled={actionLoading === "invite"}
                            className="px-4 bg-[#C96A3D] hover:bg-[#b05d33] disabled:opacity-50 text-white rounded-xl cursor-pointer transition-colors flex items-center justify-center shrink-0"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </form>
                    </>
                  )}

                  {!config.isSharingActive && (
                    <div className="p-3.5 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[10.5px] font-bold leading-relaxed flex gap-2.5 items-start">
                      <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>
                        The sharing link is currently disabled. Active collaborators will be disconnected and won't be able to view or chat until you reactivate it.
                      </span>
                    </div>
                  )}
                </>
              )}

              {/* TAB 2: SHARE VIA ACCESS CODE */}
              {activeTab === "code" && (
                <>
                  {/* Access Code Config/Display */}
                  {(!config.accessCode || !config.accessCodeIsActive) ? (
                    /* Generate code card */
                    <div className="p-5 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col items-center justify-center text-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-[#C96A3D]/10 flex items-center justify-center text-[#C96A3D]">
                        <KeyRound className="w-6 h-6" />
                      </div>
                      <div className="max-w-xs space-y-1">
                        <h4 className="text-xs font-black text-slate-900 dark:text-white">Generate Chat Access Code</h4>
                        <p className="text-[10.5px] font-bold text-slate-400 leading-normal">
                          Create a unique 8-character meeting-style code. Hand it out to your team to let them join instantly!
                        </p>
                      </div>

                      {/* Code Options */}
                      <div className="w-full grid grid-cols-2 gap-3 text-left pt-2">
                        <div className="space-y-1">
                          <span className="text-[9px] font-black uppercase text-slate-400">Expire Code After</span>
                          <select
                            value={codeExpiryValue}
                            onChange={(e) => setCodeExpiryValue(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none"
                          >
                            <option value="never">Never Expire</option>
                            <option value="1h">1 Hour</option>
                            <option value="24h">24 Hours</option>
                            <option value="7d">7 Days</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <span className="text-[9px] font-black uppercase text-slate-400">Role for Joiners</span>
                          <select
                            value={codePermissionValue}
                            onChange={(e) => setCodePermissionValue(e.target.value as any)}
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none"
                          >
                            <option value="chat">Can Chat</option>
                            <option value="view">View Only</option>
                          </select>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleGenerateAccessCode(codeExpiryValue, codePermissionValue)}
                        disabled={actionLoading !== null}
                        className="w-full mt-2 py-2.5 bg-[#C96A3D] hover:bg-[#b05d33] disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
                      >
                        {actionLoading === "generateCode" ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <>Generate Unique Access Code</>
                        )}
                      </button>
                    </div>
                  ) : (
                    /* Active code detail */
                    <div className="space-y-4">
                      {/* Active Status Header */}
                      <div className="flex items-center justify-between p-3 rounded-xl border border-emerald-500/10 bg-emerald-500/5 text-emerald-500 text-[10.5px] font-bold">
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span>Code is Live & Recruiting</span>
                        </div>
                        <button
                          type="button"
                          onClick={handleDisableAccessCode}
                          disabled={actionLoading !== null}
                          className="text-[10px] text-rose-500 font-extrabold uppercase tracking-wide hover:underline cursor-pointer"
                        >
                          Disable Code
                        </button>
                      </div>

                      {/* Big Code Board */}
                      <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-150 dark:border-slate-800 rounded-2xl p-5 flex flex-col items-center justify-center gap-3 relative overflow-hidden">
                        <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">CHAT ACCESS CODE</div>
                        
                        <div className="text-3xl font-black font-mono tracking-widest text-[#C96A3D] py-1 select-all select-none">
                          {config.accessCode}
                        </div>

                        {/* Code Metadata */}
                        <div className="flex items-center gap-3.5 text-[10px] font-bold text-slate-400 mt-1">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            <span>
                              {config.accessCodeExpiresAt 
                                ? `Expires: ${new Date(config.accessCodeExpiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` 
                                : "Never Expires"
                              }
                            </span>
                          </div>
                          <span>•</span>
                          <div className="capitalize font-extrabold text-[#C96A3D]/90">
                            {config.accessCodePermission === "chat" ? "Can Chat" : "View Only"}
                          </div>
                        </div>

                        {/* Code Action Buttons */}
                        <div className="grid grid-cols-2 gap-3.5 w-full pt-4 border-t border-slate-100 dark:border-slate-800/80 mt-1">
                          <button
                            type="button"
                            onClick={copyCodeToClipboard}
                            className="flex items-center justify-center gap-2 py-2 px-3 bg-white dark:bg-[#11192e] border border-slate-150 dark:border-slate-800 hover:border-[#C96A3D] text-slate-700 dark:text-slate-300 text-xs font-black uppercase rounded-xl transition-colors cursor-pointer"
                          >
                            {codeCopied ? (
                              <>
                                <Check className="w-4 h-4 text-emerald-500" />
                                <span className="text-emerald-500">Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-4 h-4" />
                                <span>Copy Code</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleGenerateAccessCode(codeExpiryValue, codePermissionValue)}
                            disabled={actionLoading !== null}
                            className="flex items-center justify-center gap-2 py-2 px-3 bg-[#C96A3D]/10 hover:bg-[#C96A3D]/20 text-[#C96A3D] text-xs font-black uppercase rounded-xl transition-all cursor-pointer border border-[#C96A3D]/20"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${actionLoading === "generateCode" ? "animate-spin" : ""}`} />
                            <span>Regenerate</span>
                          </button>
                        </div>
                      </div>

                      {/* Code Live Customizers */}
                      <div className="grid grid-cols-2 gap-3 text-left p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/10">
                        <div className="space-y-1">
                          <span className="text-[9px] font-black uppercase text-slate-400">Update Expiry</span>
                          <select
                            value={codeExpiryValue}
                            onChange={(e) => {
                              setCodeExpiryValue(e.target.value);
                              handleGenerateAccessCode(e.target.value, codePermissionValue);
                            }}
                            className="w-full bg-white dark:bg-[#11192e] border border-slate-150 dark:border-slate-800 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none"
                          >
                            <option value="never">Never Expire</option>
                            <option value="1h">1 Hour</option>
                            <option value="24h">24 Hours</option>
                            <option value="7d">7 Days</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <span className="text-[9px] font-black uppercase text-slate-400">Update Role</span>
                          <select
                            value={codePermissionValue}
                            onChange={(e) => {
                              const v = e.target.value as "chat" | "view";
                              setCodePermissionValue(v);
                              handleGenerateAccessCode(codeExpiryValue, v);
                            }}
                            className="w-full bg-white dark:bg-[#11192e] border border-slate-150 dark:border-slate-800 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none"
                          >
                            <option value="chat">Can Chat</option>
                            <option value="view">View Only</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Collaborators List (Shown in both tabs if config is active) */}
              <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-550">
                    Collaborators ({config.participants.length})
                  </label>
                </div>
                
                <div className="space-y-2 max-h-[170px] overflow-y-auto pr-1">
                  {/* Owner Row */}
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/50 dark:bg-slate-900/10 border border-slate-50 dark:border-slate-850">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        referrerPolicy="no-referrer"
                        src={`https://api.dicebear.com/7.x/initials/svg?seed=Owner`}
                        alt="Owner"
                        className="w-7 h-7 rounded-lg shrink-0 object-cover"
                      />
                      <div className="min-w-0">
                        <span className="text-[11.5px] font-black text-slate-800 dark:text-slate-200 block truncate">
                          Owner (You)
                        </span>
                        <span className="text-[9.5px] font-bold text-slate-400 block truncate">
                          {config.ownerEmail}
                        </span>
                      </div>
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-wider text-[#C96A3D] px-2 py-0.5 rounded-md bg-[#C96A3D]/10 border border-[#C96A3D]/15">
                      Owner
                    </span>
                  </div>

                  {/* Participants rows */}
                  {config.participants.length === 0 ? (
                    <div className="text-center py-5 text-slate-400 text-[10.5px] font-bold border border-dashed border-slate-150 dark:border-slate-800 rounded-xl">
                      No collaborators have joined this conversation yet
                    </div>
                  ) : (
                    config.participants.map((p) => (
                      <div 
                        key={p.email} 
                        className="flex items-center justify-between p-2.5 rounded-xl border border-slate-150 dark:border-slate-800 bg-white dark:bg-slate-900/40"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img
                            referrerPolicy="no-referrer"
                            src={`https://api.dicebear.com/7.x/initials/svg?seed=${p.name}`}
                            alt={p.name}
                            className="w-7 h-7 rounded-lg shrink-0 object-cover"
                          />
                          <div className="min-w-0">
                            <span className="text-[11.5px] font-black text-slate-800 dark:text-slate-200 block truncate">
                              {p.name}
                            </span>
                            <span className="text-[9.5px] font-bold text-slate-400 block truncate">
                              {p.email}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Role selector dropdown */}
                          <select
                            value={p.role}
                            onChange={(e) => handleUpdateParticipantRole(p.email, e.target.value as any)}
                            disabled={actionLoading !== null}
                            className="bg-slate-50 dark:bg-slate-800 border border-slate-150 dark:border-slate-700 rounded-lg px-2 py-1 text-[10px] font-bold text-slate-600 dark:text-slate-300 outline-none"
                          >
                            <option value="editor">Can Chat</option>
                            <option value="viewer">View Only</option>
                          </select>

                          {/* Remove button */}
                          <button
                            onClick={() => handleRemoveParticipant(p.email)}
                            disabled={actionLoading !== null}
                            className="p-1.5 hover:bg-rose-500/10 hover:text-rose-500 text-slate-400 rounded-lg transition-colors cursor-pointer"
                            title="Remove Collaborator"
                          >
                            <UserMinus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
};
