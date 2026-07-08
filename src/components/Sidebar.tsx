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
  CheckCircle,
  PencilLine,
  LogIn,
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
