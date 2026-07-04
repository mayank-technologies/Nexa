/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
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
} from "lucide-react";
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
  onChangeMode: (mode: ChatSession["mode"]) => void;
  onOpenAuth: () => void;
  onOpenSettings?: () => void;
  onLogout?: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
  onOpenPremium?: () => void;
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
  onChangeMode,
  onOpenAuth,
  onOpenSettings,
  onLogout,
  isMobileOpen,
  onCloseMobile,
  onOpenPremium,
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

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

  // Filter & Order Chats (Pinned on top, then descending dates)
  const filteredSessions = sessions
    .filter((s) => {
      const query = searchQuery.trim().toLowerCase();
      if (!query) return true;
      const matchesTitle = s.title.toLowerCase().includes(query);
      const matchesContent = s.messages.some((m) =>
        m.content.toLowerCase().includes(query)
      );
      return matchesTitle || matchesContent;
    })
    .sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

  const modesMap = [
    { id: "general", name: "Core General Chat", desc: "Everyday brainstorming & assistance.", icon: <HelpCircle className="w-4 h-4" /> },
    { id: "research", name: "Deep Research Mode", desc: "Multi-source research detailed reports.", icon: <Search className="w-4 h-4" /> },
    { id: "study", name: "Study Mode Arena", desc: "Homework assistant & note generator.", icon: <GraduationCap className="w-4 h-4" /> },
    { id: "factcheck", name: "Fact Check Mode", desc: "Verify claims & information metrics.", icon: <BookmarkCheck className="w-4 h-4" /> },
    { id: "writing", name: "Writing Assistant", desc: "Draft essays, application forms, articles.", icon: <PenTool className="w-4 h-4" /> },
  ] as const;

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
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        
        {/* B: Recent Thread logs */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-450">
              Recent Conversations
            </h4>
            <span className="text-[9px] font-bold text-slate-400 font-mono bg-slate-50 dark:bg-slate-900 px-1.5 py-0.5 rounded-sm shrink-0">
              {filteredSessions.length} sessions
            </span>
          </div>

          <div className="space-y-1 max-h-[220px] overflow-y-auto pr-1">
            {filteredSessions.length === 0 ? (
              <p className="text-[11px] text-slate-400 italic text-left p-2">
                No matching logs found.
              </p>
            ) : (
              filteredSessions.map((session) => {
                const isActive = session.id === activeSessionId;
                const isEditing = editingId === session.id;

                return (
                  <div
                    key={session.id}
                    className={`group/session w-full flex items-center justify-between p-2 rounded-xl border text-xs font-semibold select-none transition-all ${
                      isActive
                        ? "border-[#14213D]/10 bg-slate-50 dark:bg-slate-900"
                        : "border-transparent text-slate-500 hover:bg-slate-50/50 dark:hover:bg-slate-900/30"
                    }`}
                  >
                    {isEditing ? (
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleSaveRename(session.id)}
                          className="w-full text-xs p-1.5 rounded bg-white dark:bg-slate-800 border focus:border-[#C96A3D] text-[#14213D] dark:text-white outline-none"
                        />
                        <button
                          onClick={() => handleSaveRename(session.id)}
                          className="p-1 rounded hover:bg-emerald-50 text-emerald-500 shrink-0"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="p-1 rounded hover:bg-rose-50 text-rose-500 shrink-0"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          onSelectSession(session.id);
                          onCloseMobile?.();
                        }}
                        className="flex-1 text-left truncate flex items-center gap-2 cursor-pointer outline-none select-none py-1.5"
                      >
                        <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${session.isPinned ? "text-[#C96A3D]" : "text-slate-400"}`} />
                        <span className={`truncate text-xs ${isActive ? "text-[#14213D] dark:text-white font-extrabold" : "text-slate-550 dark:text-slate-400 font-normal"}`}>
                          {session.title}
                        </span>
                      </button>
                    )}

                    {/* Inline Quick management action keys visible on hover */}
                    {!isEditing && (
                      <div className="hidden group-hover/session:flex items-center gap-1 pr-1 shrink-0">
                        {/* Pin widget */}
                        <button
                          onClick={() => onPinSession(session.id)}
                          className={`p-1 rounded-md transition-colors ${
                            session.isPinned
                              ? "text-[#C96A3D] hover:bg-[#C96A3D]/10"
                              : "text-slate-350 hover:text-slate-600 dark:hover:text-slate-300"
                          }`}
                          title="Pin Conversation Log"
                        >
                          <Pin className="w-3 h-3" />
                        </button>

                        {/* Edit inline widget */}
                        <button
                          onClick={() => handleStartRename(session)}
                          className="p-1 rounded-md text-slate-350 hover:text-slate-600 dark:hover:text-slate-300"
                          title="Rename Log"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>

                        {/* Delete widget */}
                        <button
                          onClick={() => onDeleteSession(session.id)}
                          className="p-1 rounded-md text-slate-350 hover:text-rose-500"
                          title="Delete Permanently"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* Upgrade to Premium Sidebar Banner */}
      <div className="px-4 pb-3 pt-1 shrink-0" id="sidebar-premium-upgrade-container">
        <button
          onClick={() => {
            onOpenPremium?.();
            onCloseMobile?.();
          }}
          className="relative overflow-hidden w-full flex items-center justify-between p-3.5 bg-gradient-to-r from-[#C96A3D] via-[#e25714] to-[#f47c36] text-white rounded-2xl shadow-md cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg active:scale-98 select-none animate-premium-glow"
          title="Upgrade to Nexa Premium"
        >
          {/* Inner sliding shine animation */}
          <div className="animate-premium-shine" />
          
          <div className="relative z-10 flex items-center gap-2.5 text-left">
            <div className="p-1.5 bg-white/15 rounded-xl border border-white/20 select-none shrink-0">
              <span className="text-sm">✨</span>
            </div>
            <div>
              <p className="text-[11.5px] font-black tracking-tight leading-none text-white">
                Nexa Premium
              </p>
              <p className="text-[9.5px] font-semibold text-amber-200 mt-0.5 leading-none">
                Unlock next-gen AI tools
              </p>
            </div>
          </div>
          
          <div className="relative z-10 shrink-0 select-none text-[10px] font-extrabold bg-white/15 border border-white/20 rounded-lg px-2 py-1 uppercase tracking-wider">
            Join
          </div>
        </button>
      </div>

      {/* Guest Mode Conversion Panel Warning footer */}
      {user.isGuest ? (
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20 text-xs shrink-0">
          <div className="flex gap-2.5 items-start p-3 bg-indigo-500/5 rounded-2xl border border-indigo-500/10">
            <AlertCircle className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5 animate-pulse" />
            <div className="text-left space-y-1 session-guest-box">
              <h5 className="font-bold text-slate-700 dark:text-slate-200">Sync Guest Threads</h5>
              <p className="text-[10px] text-slate-400 leading-relaxed font-normal">
                Authorize email or google to safely lock your bookmarks, preferences and histories.
              </p>
              <button
                onClick={() => {
                  onOpenAuth();
                  onCloseMobile?.();
                }}
                className="text-[#C96A3D] hover:text-[#14213D] font-extrabold text-[10px] tracking-wide inline-block pt-1 cursor-pointer underline"
              >
                Authenticate Now &rarr;
              </button>
            </div>
          </div>
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
              <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate font-mono">
                {user.email || "Active User"}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-1 shrink-0">
            {/* Settings button next to profile */}
            {onOpenSettings && (
              <button
                onClick={() => {
                  onOpenSettings();
                  onCloseMobile?.();
                }}
                className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-[#C96A3D] bg-white dark:bg-slate-900 hover:shadow-3xs transition-all cursor-pointer active:scale-95"
                title="Profile & Preferences Settings"
                id="sidebar-preferences-btn"
              >
                <Settings className="w-4 h-4 shrink-0" />
              </button>
            )}

            {/* Logout button */}
            {onLogout && (
              <button
                onClick={() => {
                  onLogout();
                  onCloseMobile?.();
                }}
                className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-rose-500 bg-white dark:bg-slate-900 hover:shadow-3xs transition-all cursor-pointer active:scale-95"
                title="Logout"
                id="sidebar-logout-btn"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
