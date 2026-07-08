/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import {
  MessageSquare,
  Plus,
  Trash2,
  Edit3,
  Pin,
  Search,
  Check,
  X,
  Sparkles,
  HelpCircle,
  AlertCircle,
  GraduationCap,
  Globe,
  PenTool,
  BookmarkCheck,
  LogOut,
  Sliders,
  Settings,
  CheckCircle,
  PencilLine,
  LogIn,
  MoreVertical,
  Share2,
} from "lucide-react";
import { motion, AnimatePresence, Reorder } from "motion/react";
import { ChatSession, UserProfile } from "../types";

interface SidebarProps {
  sessions: ChatSession[];
  activeSessionId: string;
  user: UserProfile;
  activeMode: "general" | "research" | "study" | "factcheck" | "writing" | "quiz";
  onSelectSession: (id: string) => void;
  onNewSession: (mode?: ChatSession["mode"]) => void;
  onDeleteSession: (id: string) => void;
  onRenameSession: (id: string, newTitle: string) => void;
  onPinSession: (id: string) => void;
  onReorderSessions?: (sessions: ChatSession[]) => void;
  onChangeMode: (mode: ChatSession["mode"]) => void;
  onOpenAuth: () => void;
  onOpenSettings?: () => void;
  onLogout?: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
  onOpenPremium?: () => void;
  onOpenFeedback?: () => void;
}

export function Sidebar({
  sessions,
  activeSessionId,
  user,
  activeMode,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  onRenameSession,
  onPinSession,
  onReorderSessions,
  onChangeMode,
  onOpenAuth,
  onOpenSettings,
  onLogout,
  isMobileOpen,
  onCloseMobile,
  onOpenPremium,
  onOpenFeedback,
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const touchStartTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleStartRename = (session: ChatSession) => {
    setEditingId(session.id);
    setEditTitle(session.title);
  };

  const handleSaveRename = (id: string) => {
    if (editTitle.trim()) {
      onRenameSession(id, editTitle);
    }
    setEditingId(null);
  };

  const handleShareSession = (session: ChatSession) => {
    try {
      const shareUrl = `${window.location.origin}/share/thread/${session.id}`;
      navigator.clipboard.writeText(shareUrl);
      alert("Shareable chat link copied to clipboard successfully!");
    } catch (e) {
      console.error(e);
    }
  };

  // Mobile Long-Press Handling
  const handleTouchStart = (e: React.TouchEvent, sessionId: string) => {
    if (touchStartTimerRef.current) clearTimeout(touchStartTimerRef.current);
    touchStartTimerRef.current = setTimeout(() => {
      setActiveMenuId(sessionId);
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, 600);
  };

  const handleTouchEnd = () => {
    if (touchStartTimerRef.current) {
      clearTimeout(touchStartTimerRef.current);
      touchStartTimerRef.current = null;
    }
  };

  const handleTouchMove = () => {
    if (touchStartTimerRef.current) {
      clearTimeout(touchStartTimerRef.current);
      touchStartTimerRef.current = null;
    }
  };

  // Drag & drop sorting for pinned chats
  const handleReorderPinned = (newPinnedOrder: ChatSession[]) => {
    const updatedPinned = newPinnedOrder.map((chat, idx) => ({
      ...chat,
      pinOrder: idx,
    }));
    const unpinnedIds = new Set(sessions.filter(s => !s.isPinned).map(s => s.id));
    const originalUnpinned = sessions.filter(s => unpinnedIds.has(s.id));
    onReorderSessions?.([...updatedPinned, ...originalUnpinned]);
  };

  // Filter & Group chats
  const filteredSessions = sessions.filter((s) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    const matchesTitle = s.title.toLowerCase().includes(query);
    const matchesContent = s.messages.some((m) =>
      m.content.toLowerCase().includes(query)
    );
    return matchesTitle || matchesContent;
  });

  const pinnedChats = filteredSessions
    .filter((s) => s.isPinned)
    .sort((a, b) => (a.pinOrder ?? 0) - (b.pinOrder ?? 0));

  const unpinnedChats = filteredSessions
    .filter((s) => !s.isPinned)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  // Render a single chat row
  const renderChatItem = (session: ChatSession, isPinnedItem: boolean) => {
    const isActive = session.id === activeSessionId;
    const isEditing = editingId === session.id;

    return (
      <div
        className={`group/session w-full flex items-center justify-between p-2 rounded-xl border text-xs font-semibold select-none transition-all duration-200 relative ${
          isActive
            ? "border-[#C96A3D]/20 bg-[#C96A3D]/5 text-[#C96A3D]"
            : "border-transparent text-slate-500 hover:bg-slate-50/50 dark:hover:bg-slate-900/30 hover:text-slate-700 dark:hover:text-slate-300"
        }`}
        onTouchStart={(e) => handleTouchStart(e, session.id)}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
      >
        {isEditing ? (
          <div className="flex items-center gap-1.5 flex-1 min-w-0 z-10" onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              value={editTitle}
              autoFocus
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSaveRename(session.id)}
              className="w-full text-xs p-1.5 rounded bg-white dark:bg-slate-800 border focus:border-[#C96A3D] text-[#14213D] dark:text-white outline-none"
            />
            <button
              onClick={() => handleSaveRename(session.id)}
              className="p-1 rounded hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-emerald-500 shrink-0 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setEditingId(null)}
              className="p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-500 shrink-0 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => {
              if (activeMenuId === session.id) return;
              onSelectSession(session.id);
              onCloseMobile?.();
            }}
            className="flex-1 text-left truncate flex items-center gap-2 cursor-pointer outline-none select-none py-1.5 pr-2"
          >
            <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isPinnedItem ? "text-[#C96A3D]" : "text-slate-400"}`} />
            <span className={`truncate text-xs ${isActive ? "text-[#C96A3D] font-extrabold" : "text-slate-650 dark:text-slate-350 font-normal group-hover/session:text-slate-800 dark:group-hover/session:text-white"}`}>
              {session.title}
            </span>
          </button>
        )}

        {!isEditing && (
          <div className={`flex items-center gap-1 pr-1 shrink-0 ${activeMenuId === session.id ? "flex" : "hidden group-hover/session:flex"}`}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setActiveMenuId(activeMenuId === session.id ? null : session.id);
              }}
              className="p-1 rounded-md text-slate-400 hover:text-[#C96A3D] hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all cursor-pointer"
              title="More Actions"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>

            {activeMenuId === session.id && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -5 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="absolute right-2 top-8 z-55 bg-white dark:bg-[#11192e] border border-slate-100 dark:border-slate-800/80 rounded-2xl shadow-xl p-1.5 min-w-[150px] text-left space-y-0.5 pointer-events-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onPinSession(session.id);
                    setActiveMenuId(null);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11.5px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-[#C96A3D] dark:hover:text-[#C96A3D] transition-colors cursor-pointer"
                >
                  <Pin className={`w-3.5 h-3.5 ${isPinnedItem ? "rotate-45 fill-[#C96A3D] text-[#C96A3D]" : ""}`} />
                  <span>{isPinnedItem ? "Unpin Chat" : "Pin Chat"}</span>
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStartRename(session);
                    setActiveMenuId(null);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11.5px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-[#C96A3D] dark:hover:text-[#C96A3D] transition-colors cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Rename Chat</span>
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleShareSession(session);
                    setActiveMenuId(null);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11.5px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-[#C96A3D] dark:hover:text-[#C96A3D] transition-colors cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Share Chat</span>
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteSession(session.id);
                    setActiveMenuId(null);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11.5px] font-semibold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Chat</span>
                </button>
              </motion.div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside
      className="flex flex-col w-full h-full bg-white dark:bg-[#0c1222] select-none overflow-hidden"
      id="nexa-control-sidebar"
    >
      {/* Sidebar Header: Create Thread */}
      <div className="p-4 border-b border-slate-100 dark:border-slate-800/80 space-y-3">
        {isMobileOpen && (
          <div className="flex items-center justify-between pb-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#C96A3D]">Nexa Navigation</span>
            <button
              onClick={onCloseMobile}
              className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors cursor-pointer"
              title="Close Menu"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        <button
          onClick={() => {
            onNewSession(activeMode);
            onCloseMobile?.();
          }}
          className="w-full flex items-center justify-center gap-2 bg-[#14213D] hover:bg-[#C96A3D] dark:bg-slate-100 dark:hover:bg-[#C96A3D] dark:hover:text-white dark:text-[#14213D] text-white font-bold py-3 px-4 rounded-2xl text-xs transition-all shadow-md hover:shadow-lg cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Start New {activeMode === "general" ? "Chat" : activeMode === "research" ? "Research" : "Workspace"}
        </button>

        {/* Quick Search Button / Input */}
        {!isSearchOpen ? (
          <button
            onClick={() => setIsSearchOpen(true)}
            className="w-full flex items-center justify-between text-xs py-2.5 px-3.5 rounded-xl border border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40 text-slate-400 hover:text-[#C96A3D] hover:border-slate-300 dark:hover:border-slate-700/80 dark:hover:text-[#C96A3D] hover:bg-white dark:hover:bg-slate-900/60 transition-all cursor-pointer shadow-3xs"
            title="Search Recent Conversations"
          >
            <div className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <span>Search recent chats...</span>
            </div>
          </button>
        ) : (
          <div className="relative flex items-center gap-2 animate-fade-in-down">
            <div className="relative flex-1">
              <input
                type="text"
                autoFocus
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs py-2.5 pl-9 pr-12 rounded-xl border border-[#C96A3D] dark:border-[#C96A3D] bg-white dark:bg-slate-900 outline-none text-[#14213D] dark:text-white transition-all focus:ring-2 focus:ring-[#C96A3D]/20 font-medium"
              />
              <Search className="absolute left-3 top-3 text-[#C96A3D] w-3.5 h-3.5" />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold text-[10px] tracking-wide"
                >
                  Clear
                </button>
              )}
            </div>
            <button
              onClick={() => {
                setIsSearchOpen(false);
                setSearchQuery("");
              }}
              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-rose-500 hover:border-rose-200 dark:hover:border-rose-950/40 bg-slate-55 dark:bg-slate-900 transition-colors cursor-pointer"
              title="Close Search"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Primary Scrollable Workspace Section */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        
        {/* A: Pinned Chats section */}
        {pinnedChats.length > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-[#C96A3D] flex items-center gap-1.5">
                <Pin className="w-3.5 h-3.5 text-[#C96A3D] fill-[#C96A3D]/15 rotate-45 shrink-0" />
                <span>Pinned Chats</span>
              </h4>
              <span className="text-[9px] font-extrabold text-[#C96A3D] font-mono bg-[#C96A3D]/10 px-1.5 py-0.5 rounded-full shrink-0">
                {pinnedChats.length}
              </span>
            </div>

            <Reorder.Group
              axis="y"
              values={pinnedChats}
              onReorder={handleReorderPinned}
              className="space-y-1.5"
            >
              <AnimatePresence initial={false}>
                {pinnedChats.map((session) => (
                  <Reorder.Item
                    key={session.id}
                    value={session}
                    dragListener={!searchQuery.trim()}
                    className="outline-none"
                    style={{ position: "relative" }}
                  >
                    {renderChatItem(session, true)}
                  </Reorder.Item>
                ))}
              </AnimatePresence>
            </Reorder.Group>
          </div>
        )}

        {/* B: Recent Thread logs */}
        <div className="space-y-2 pt-1">
          <div className="flex justify-between items-center">
            <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500">
              Recent Conversations
            </h4>
            <span className="text-[9px] font-extrabold text-slate-400 dark:text-slate-500 font-mono bg-slate-50 dark:bg-slate-900/60 px-1.5 py-0.5 rounded-full shrink-0">
              {unpinnedChats.length}
            </span>
          </div>

          <div className="space-y-1.5 max-h-[340px] overflow-y-auto pr-1">
            {unpinnedChats.length === 0 ? (
              <p className="text-[11px] text-slate-400 italic text-left p-2">
                No matching logs found.
              </p>
            ) : (
              <AnimatePresence initial={false}>
                {unpinnedChats.map((session) => (
                  <motion.div
                    key={session.id}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    {renderChatItem(session, false)}
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </div>

        {/* D: Settings Section */}
        <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800/60">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
            Preferences & Settings
          </h4>
          <button
            onClick={() => {
              onOpenSettings?.();
              onCloseMobile?.();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-transparent hover:border-slate-100 dark:hover:border-slate-800/60 hover:bg-slate-50/50 dark:hover:bg-slate-900/30 text-slate-500 hover:text-[#C96A3D] text-xs font-semibold select-none transition-all cursor-pointer"
          >
            <Settings className="w-4 h-4 shrink-0 text-slate-400 group-hover:text-[#C96A3D]" />
            <span>Settings</span>
          </button>
        </div>

      </div>



      {/* Guest Mode Sign-In / Account footer */}
      {user.isGuest ? (
        <div className="p-4 border-t border-slate-150 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 flex items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-9 h-9 rounded-2xl bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center font-bold text-sm shrink-0 select-none shadow-sm">
              G
            </div>
            <div className="text-left min-w-0 flex-1 leading-snug">
              <h5 className="font-extrabold text-slate-800 dark:text-slate-100 truncate text-[11.5px]">
                Guest User
              </h5>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate font-mono">
                Sign in to sync logs
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              onOpenAuth();
              onCloseMobile?.();
            }}
            className="flex items-center gap-1.5 py-2 px-3 bg-[#14213D] dark:bg-white hover:bg-[#C96A3D] dark:hover:bg-[#C96A3D] text-white dark:text-[#14213D] dark:hover:text-white text-[11px] font-bold rounded-xl shadow-3xs cursor-pointer transition-all active:scale-95"
          >
            <LogIn className="w-3.5 h-3.5 shrink-0" />
            <span>Sign In</span>
          </button>
        </div>
      ) : (
        /* Logged-In User Profile bottom footer */
        <div className="p-4 border-t border-slate-150 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 flex items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.fullName}
                className="w-9 h-9 rounded-2xl object-cover shrink-0 select-none border border-slate-200 dark:border-slate-800 shadow-3xs"
              />
            ) : (
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-sm shrink-0 select-none shadow-sm">
                {user.fullName ? user.fullName[0].toUpperCase() : "N"}
              </div>
            )}
            <div className="text-left min-w-0 flex-1 leading-snug">
              <h5 className="font-extrabold text-slate-800 dark:text-slate-100 truncate text-[11.5px]">
                {user.fullName}
              </h5>
              <p className="text-[10px] text-[#C96A3D] dark:text-[#C96A3D] font-black truncate font-mono text-[9px] bg-[#C96A3D]/10 px-1.5 py-0.5 rounded-full inline-block mt-0.5 w-max">
                {user.gamification?.points || 0} XP
              </p>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
