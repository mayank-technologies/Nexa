import React, { useState, useEffect, useRef } from "react";
import {
  MoreVertical,
  Pin,
  Share2,
  Archive,
  Trash2,
  Edit2,
  Copy,
  Info,
  Star,
  Check,
  Download,
  X,
  FileText,
  FileSpreadsheet,
  Users,
  ChevronRight,
  Sparkles,
  ExternalLink
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ChatSession } from "../types";
import { playUiSound } from "../utils/sounds";

interface ConversationHeaderMenuProps {
  activeSession: ChatSession;
  isSharedSession: boolean;
  sharedRole: "owner" | "editor" | "viewer" | null;
  sharedParticipants: Array<{ email: string; name: string; role: string; isTyping?: boolean }>;
  onPinToggle: (id: string) => void;
  onOpenShare: (id: string) => void;
  onArchiveToggle: (id: string) => void;
  onDeleteToggle: (id: string) => void;
  onFavoriteToggle: (id: string) => void;
  onRenameSession: (id: string, newTitle: string) => void;
  onDuplicateSession: (id: string) => void;
}

export const ConversationHeaderMenu: React.FC<ConversationHeaderMenuProps> = ({
  activeSession,
  isSharedSession,
  sharedRole,
  sharedParticipants,
  onPinToggle,
  onOpenShare,
  onArchiveToggle,
  onDeleteToggle,
  onFavoriteToggle,
  onRenameSession,
  onDuplicateSession,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showRename, setShowRename] = useState(false);
  const [newName, setNewName] = useState("");
  const [isCopiedShareLink, setIsCopiedShareLink] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Check viewport size
  useEffect(() => {
    const checkViewport = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkViewport();
    window.addEventListener("resize", checkViewport);
    return () => window.removeEventListener("resize", checkViewport);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        isOpen &&
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isOpen]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleToggle = () => {
    setIsOpen(!isOpen);
    playUiSound("success");
  };

  const handlePinAction = () => {
    onPinToggle(activeSession.id);
    setIsOpen(false);
  };

  const handleFavoriteAction = () => {
    onFavoriteToggle(activeSession.id);
    setIsOpen(false);
  };

  const handleArchiveAction = () => {
    onArchiveToggle(activeSession.id);
    setIsOpen(false);
  };

  const handleDeleteAction = () => {
    onDeleteToggle(activeSession.id);
    setIsOpen(false);
  };

  const handleShareAction = () => {
    onOpenShare(activeSession.id);
    setIsOpen(false);
  };

  const handleDuplicateAction = () => {
    onDuplicateSession(activeSession.id);
    setIsOpen(false);
  };

  const handleRenameInit = () => {
    setNewName(activeSession.title);
    setShowRename(true);
    setIsOpen(false);
  };

  const handleRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newName.trim() && newName.trim() !== activeSession.title) {
      onRenameSession(activeSession.id, newName.trim());
      playUiSound("success");
    }
    setShowRename(false);
  };

  const handleCopyShareLink = () => {
    const shareLink = `${window.location.origin}/#share=${activeSession.id}`;
    navigator.clipboard.writeText(shareLink);
    setIsCopiedShareLink(true);
    playUiSound("success");
    setTimeout(() => setIsCopiedShareLink(false), 2000);
  };

  // --- Export Implementations ---
  const handleExportTxt = () => {
    const content = activeSession.messages
      .map(
        (m) =>
          `[${m.role.toUpperCase()}] ${m.senderName || (m.role === "user" ? "User" : "Nexa Assistant")} (${new Date(
            m.timestamp
          ).toLocaleString()})\n${m.content}`
      )
      .join("\n\n----------------------------------------\n\n");

    const header = `NEXA INTELLIGENCE CONVERSATION EXPORT\n`;
    const meta = `Title: ${activeSession.title}\nMode: ${activeSession.mode.toUpperCase()} Workspace\nID: ${activeSession.id}\nExported At: ${new Date().toLocaleString()}\n========================================\n\n`;
    
    const blob = new Blob([header + meta + content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeSession.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_export.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setIsOpen(false);
    playUiSound("success");
  };

  const handleExportMd = () => {
    const messagesMd = activeSession.messages
      .map((m) => {
        const sender = m.senderName || (m.role === "user" ? "User" : "Nexa Assistant");
        const roleHeader = m.role === "user" ? `### **${sender}**` : `### 🌟 **${sender}**`;
        const time = new Date(m.timestamp).toLocaleString();
        return `${roleHeader} *(${time})*\n\n${m.content}\n\n---`;
      })
      .join("\n\n");

    const meta = `# ${activeSession.title}\n\n* **Workspace Mode:** \`${activeSession.mode.toUpperCase()}\`\n* **Conversation ID:** \`${activeSession.id}\`\n* **Exported At:** ${new Date().toLocaleString()}\n\n---\n\n`;
    
    const blob = new Blob([meta + messagesMd + `\n\n*Generated via Nexa Intelligence*`], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeSession.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_export.md`;
    a.click();
    URL.revokeObjectURL(url);
    setIsOpen(false);
    playUiSound("success");
  };

  const handleExportPdf = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const messagesHtml = activeSession.messages
      .map((m) => {
        const sender = m.senderName || (m.role === "user" ? "User" : "Nexa Assistant");
        const roleClass = m.role === "user" ? "user-msg" : "assistant-msg";
        const time = new Date(m.timestamp).toLocaleString();
        
        let formattedContent = m.content
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/\n/g, "<br/>");

        return `
          <div class="message ${roleClass}">
            <div class="message-header">
              <strong>${sender}</strong>
              <span class="timestamp">${time}</span>
            </div>
            <div class="message-content">${formattedContent}</div>
          </div>
        `;
      })
      .join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>Nexa Export - ${activeSession.title}</title>
          <style>
            body {
              font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              color: #1e293b;
              line-height: 1.6;
              padding: 40px;
              max-width: 800px;
              margin: 0 auto;
              background-color: #ffffff;
            }
            .header-banner {
              border-bottom: 3px solid #C96A3D;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            h1 {
              font-size: 26px;
              font-weight: 800;
              margin: 0;
              color: #14213D;
            }
            .meta-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 10px;
              font-size: 11px;
              color: #64748b;
              margin-top: 15px;
            }
            .message {
              margin-bottom: 25px;
              padding-bottom: 20px;
              border-bottom: 1px solid #f1f5f9;
              page-break-inside: avoid;
            }
            .message-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 8px;
              font-size: 12px;
            }
            .user-msg strong {
              color: #C96A3D;
            }
            .assistant-msg strong {
              color: #14213D;
            }
            .timestamp {
              color: #94a3b8;
              font-size: 10px;
            }
            .message-content {
              font-size: 13.5px;
              white-space: pre-wrap;
              color: #334155;
            }
            .footer {
              margin-top: 50px;
              text-align: center;
              font-size: 11px;
              color: #94a3b8;
              border-top: 1px solid #e2e8f0;
              padding-top: 15px;
            }
            @media print {
              body { padding: 0; }
              .header-banner { border-bottom-color: #C96A3D; }
            }
          </style>
        </head>
        <body>
          <div class="header-banner">
            <h1>${activeSession.title}</h1>
            <div class="meta-grid">
              <div><strong>Workspace:</strong> ${activeSession.mode.toUpperCase()} Workspace</div>
              <div><strong>Exported:</strong> ${new Date().toLocaleString()}</div>
              <div><strong>ID:</strong> ${activeSession.id}</div>
              <div><strong>Messages:</strong> ${activeSession.messages.length} log points</div>
            </div>
          </div>
          <div class="thread">
            ${messagesHtml}
          </div>
          <div class="footer">
            Generated and compiled dynamically via Nexa Intelligence Workspace
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 150);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
    setIsOpen(false);
    playUiSound("success");
  };

  // Check if session is pinned / favorite / archived
  const isPinned = activeSession.isPinned;
  const isFavorite = (activeSession as any).isFavorite || false;
  const isArchived = (activeSession as any).isArchived || false;

  const menuItems = [
    {
      label: isPinned ? "Unpin Chat" : "Pin Chat",
      icon: Pin,
      action: handlePinAction,
      active: isPinned,
      activeColor: "text-[#C96A3D]",
    },
    {
      label: isFavorite ? "Remove from Favorites" : "Add to Favorites",
      icon: Star,
      action: handleFavoriteAction,
      active: isFavorite,
      activeColor: "text-amber-500 fill-amber-500",
    },
    {
      label: "Rename Chat",
      icon: Edit2,
      action: handleRenameInit,
    },
    {
      label: "Duplicate Chat",
      icon: Copy,
      action: handleDuplicateAction,
    },
    {
      label: "Share Chat",
      icon: Share2,
      action: handleShareAction,
    },
    {
      label: "Archive Chat",
      icon: Archive,
      action: handleArchiveAction,
      active: isArchived,
      activeColor: "text-amber-500",
    },
    {
      label: "Delete Chat",
      icon: Trash2,
      action: handleDeleteAction,
      danger: true,
    },
    {
      label: "Chat Details",
      icon: Info,
      action: () => {
        setShowDetails(true);
        setIsOpen(false);
      },
    },
  ];

  return (
    <div className="relative shrink-0">
      <button
        ref={triggerRef}
        id="nexa-more-options-trigger"
        onClick={handleToggle}
        className="p-2 text-slate-400 hover:text-[#C96A3D] dark:hover:text-[#C96A3D] hover:bg-slate-50 dark:hover:bg-slate-800/40 rounded-xl transition-colors cursor-pointer flex items-center justify-center border border-transparent hover:border-slate-100 dark:hover:border-slate-800"
        title="More Conversation Options"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {/* DESKTOP DROPDOWN MENU */}
      <AnimatePresence>
        {isOpen && !isMobile && (
          <motion.div
            ref={dropdownRef}
            initial={{ opacity: 0, scale: 0.95, y: -5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -5 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-64 bg-white dark:bg-[#11192e] border border-slate-100 dark:border-slate-800/80 rounded-2xl shadow-xl z-50 py-2 text-left text-slate-700 dark:text-slate-200"
          >
            {/* Quick Actions Group */}
            <div className="px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400 select-none">
              Manage Chat
            </div>
            
            {menuItems.slice(0, 7).map((item, index) => {
              const Icon = item.icon;
              return (
                <button
                  key={index}
                  onClick={item.action}
                  className={`w-full flex items-center justify-between px-3.5 py-2 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-900/60 transition-colors text-left cursor-pointer ${
                    item.danger
                      ? "text-rose-500 hover:text-rose-600 hover:bg-rose-50/30 dark:hover:bg-rose-500/10"
                      : item.active
                      ? item.activeColor
                      : "text-slate-650 dark:text-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${item.active ? "" : "text-slate-400"}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.active && <Check className="w-3.5 h-3.5 shrink-0" />}
                </button>
              );
            })}

            <div className="border-t border-slate-150 dark:border-slate-800 my-1.5" />

            {/* Export Options */}
            <div className="px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400 select-none">
              Export Thread
            </div>
            <button
              onClick={handleExportTxt}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-slate-650 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900/60 transition-colors cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>Plain Text (.txt)</span>
            </button>
            <button
              onClick={handleExportMd}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-slate-650 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900/60 transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>Markdown (.md)</span>
            </button>
            <button
              onClick={handleExportPdf}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-slate-650 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900/60 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>PDF / Print</span>
            </button>

            <div className="border-t border-slate-150 dark:border-slate-800 my-1.5" />

            {/* Details */}
            <button
              onClick={menuItems[7].action}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-slate-650 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900/60 transition-colors cursor-pointer"
            >
              <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>Chat Analytics & Details</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MOBILE BOTTOM SHEET FOR SMALL SCREEN VIEWPORTS */}
      <AnimatePresence>
        {isOpen && isMobile && (
          <>
            {/* Backdrop */}
            <div
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50"
            />
            {/* Bottom Sheet */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="fixed bottom-0 left-0 right-0 bg-white dark:bg-[#11192e] border-t border-slate-100 dark:border-slate-850 rounded-t-3xl shadow-2xl z-[100] max-h-[85vh] overflow-y-auto pb-8 text-left text-slate-700 dark:text-slate-200 p-5"
            >
              {/* Drag Handle Indicator */}
              <div className="w-12 h-1 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto mb-4" />

              <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-850 pb-3">
                <div>
                  <h4 className="text-xs font-black text-slate-900 dark:text-white truncate max-w-[200px]">
                    {activeSession.title}
                  </h4>
                  <p className="text-[10px] text-slate-400 font-bold">Manage conversation options</p>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Mobile Actions Grid */}
              <div className="grid grid-cols-2 gap-2.5 mb-5">
                {menuItems.slice(0, 6).map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={index}
                      onClick={item.action}
                      className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition-all ${
                        item.active
                          ? "border-[#C96A3D]/20 bg-[#C96A3D]/5 text-[#C96A3D]"
                          : "border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20 text-slate-600 dark:text-slate-350"
                      }`}
                    >
                      <Icon className="w-4 h-4 mb-1 shrink-0" />
                      <span className="text-[10.5px] font-bold truncate w-full">{item.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Danger & Info rows */}
              <div className="space-y-1.5 mb-5 border-t border-slate-100 dark:border-slate-850 pt-3">
                <button
                  onClick={menuItems[6].action}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/10 font-bold text-xs"
                >
                  <span className="flex items-center gap-2">
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Conversation</span>
                  </span>
                  <ChevronRight className="w-4 h-4" />
                </button>

                <button
                  onClick={menuItems[7].action}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/20 text-slate-700 dark:text-slate-200 border border-slate-100 dark:border-slate-800 font-bold text-xs"
                >
                  <span className="flex items-center gap-2">
                    <Info className="w-4 h-4" />
                    <span>Chat Analytics & Info</span>
                  </span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Export Header */}
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2.5 pl-1">
                Export Options
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={handleExportTxt}
                  className="flex flex-col items-center justify-center p-2.5 border border-slate-100 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/20 text-xs"
                >
                  <FileText className="w-4 h-4 text-slate-400 mb-1" />
                  <span className="text-[10px] font-bold">Text</span>
                </button>
                <button
                  onClick={handleExportMd}
                  className="flex flex-col items-center justify-center p-2.5 border border-slate-100 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/20 text-xs"
                >
                  <FileSpreadsheet className="w-4 h-4 text-slate-400 mb-1" />
                  <span className="text-[10px] font-bold">Markdown</span>
                </button>
                <button
                  onClick={handleExportPdf}
                  className="flex flex-col items-center justify-center p-2.5 border border-slate-100 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/20 text-xs"
                >
                  <Download className="w-4 h-4 text-slate-400 mb-1" />
                  <span className="text-[10px] font-bold">PDF / Print</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* RENAME MODAL DIALOG */}
      <AnimatePresence>
        {showRename && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-white dark:bg-[#11192e] border border-slate-100 dark:border-slate-800 rounded-2xl shadow-2xl p-5 text-slate-800 dark:text-slate-100"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-black text-slate-950 dark:text-white">Rename Conversation</h3>
                <button
                  onClick={() => setShowRename(false)}
                  className="p-1 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleRenameSubmit} className="space-y-4">
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Conversation title..."
                  className="w-full bg-slate-50 dark:bg-slate-900/40 border border-slate-150 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-850 dark:text-white outline-none focus:border-[#C96A3D]"
                  autoFocus
                />

                <div className="flex justify-end gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setShowRename(false)}
                    className="px-3.5 py-2 border border-slate-100 dark:border-slate-800 text-slate-550 dark:text-slate-300 font-bold rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#C96A3D] text-white font-black rounded-lg hover:bg-[#b05d33] transition-colors"
                  >
                    Save Rename
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CHAT ANALYTICS & DETAILS MODAL */}
      <AnimatePresence>
        {showDetails && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-white dark:bg-[#11192e] border border-slate-100 dark:border-slate-800 rounded-3xl shadow-2xl p-6 text-slate-800 dark:text-slate-100 text-left"
            >
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                    <Info className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-950 dark:text-white">Conversation Metadata</h3>
                    <p className="text-[10px] text-slate-400 font-bold">Comprehensive analytics breakdown</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowDetails(false)}
                  className="p-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-400 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Metadata content */}
              <div className="space-y-4">
                <div className="p-3.5 rounded-2xl bg-slate-50/50 dark:bg-slate-900/20 border border-slate-100 dark:border-slate-850">
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Current Title</span>
                  <span className="text-xs font-extrabold text-slate-800 dark:text-white block mt-0.5 truncate">
                    {activeSession.title}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-2xl bg-slate-50/50 dark:bg-slate-900/20 border border-slate-100 dark:border-slate-850">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Workspace Mode</span>
                    <span className="text-xs font-black text-slate-800 dark:text-white block mt-0.5 capitalize">
                      {activeSession.mode}
                    </span>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-50/50 dark:bg-slate-900/20 border border-slate-100 dark:border-slate-850">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Messages Logged</span>
                    <span className="text-xs font-black text-slate-800 dark:text-white block mt-0.5 font-mono">
                      {activeSession.messages.length} logs
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-2xl bg-slate-50/50 dark:bg-slate-900/20 border border-slate-100 dark:border-slate-850">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Created At</span>
                    <span className="text-[10.5px] font-bold text-slate-600 dark:text-slate-350 block mt-0.5">
                      {new Date(activeSession.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-50/50 dark:bg-slate-900/20 border border-slate-100 dark:border-slate-850">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Last Synced</span>
                    <span className="text-[10.5px] font-bold text-slate-600 dark:text-slate-350 block mt-0.5">
                      {new Date(activeSession.updatedAt).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50/50 dark:bg-slate-900/20 border border-slate-100 dark:border-slate-850 space-y-2">
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Sharing & Security</span>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${isSharedSession ? "bg-emerald-500 animate-pulse" : "bg-slate-350"}`} />
                      <span className="text-xs font-black">
                        {isSharedSession ? "Active Sharing Node" : "Secure Private Log"}
                      </span>
                    </div>
                    {isSharedSession && (
                      <button
                        onClick={handleCopyShareLink}
                        className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-lg text-[10px] font-black uppercase transition-colors cursor-pointer flex items-center gap-1"
                      >
                        {isCopiedShareLink ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-500" />
                            <span>Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy Link</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {isSharedSession && sharedParticipants.length > 0 && (
                  <div className="p-3.5 rounded-2xl bg-slate-50/50 dark:bg-slate-900/20 border border-slate-100 dark:border-slate-850 space-y-2">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Active Participants</span>
                    <div className="space-y-1.5 max-h-[100px] overflow-y-auto pr-1">
                      {sharedParticipants.map((p) => (
                        <div key={p.email} className="flex items-center justify-between text-xs py-0.5">
                          <div className="flex items-center gap-2">
                            <span className="relative">
                              <span className="w-5 h-5 rounded bg-[#C96A3D]/15 text-[#C96A3D] text-[10px] font-black flex items-center justify-center uppercase">
                                {p.name ? p.name[0] : "?"}
                              </span>
                              <span className="absolute bottom-0 right-0 w-1.5 h-1.5 bg-emerald-500 rounded-full ring-1 ring-white dark:ring-slate-900" title="Online" />
                            </span>
                            <div className="flex flex-col">
                              <span className="font-extrabold text-slate-800 dark:text-white truncate max-w-[150px]" title={p.name}>
                                {p.name}
                              </span>
                              {p.isTyping && (
                                <span className="text-[8px] text-[#C96A3D] font-extrabold animate-pulse leading-none mt-0.5">
                                  typing...
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="text-[9px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded capitalize">
                            {p.role}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="p-3.5 rounded-2xl bg-slate-50/50 dark:bg-slate-900/20 border border-slate-100 dark:border-slate-850">
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Unique Identifier</span>
                  <code className="text-[10px] font-mono block select-all bg-white dark:bg-slate-900 px-2 py-1 rounded border border-slate-100 dark:border-slate-800 mt-1 truncate text-slate-500 dark:text-slate-400">
                    {activeSession.id}
                  </code>
                </div>
              </div>

              <div className="mt-5 text-right">
                <button
                  onClick={() => setShowDetails(false)}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-850 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                >
                  Close details
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
