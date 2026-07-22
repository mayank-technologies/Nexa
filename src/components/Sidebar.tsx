/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
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
  PanelLeftClose,
  PanelLeftOpen,
  ChevronDown,
  ChevronRight,
  Users,
  Link,
  Archive,
  History,
  RotateCcw,
  Clock,
} from "lucide-react";
import { motion, AnimatePresence, Reorder } from "motion/react";
import { ChatSession, UserProfile, SearchHistoryItem } from "../types";
import { Logo } from "./Logo";
import { copyToClipboard, safeStorage } from "../utils/storage";

function formatRelativeTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 30) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  } catch (e) {
    return "";
  }
}

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
  onSelectRecentlyDeleted?: () => void;
  isRecentlyDeletedActive?: boolean;
  onSelectArchive?: () => void;
  isArchiveActive?: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onOpenShare?: (sessionId: string) => void;
  onOpenJoinCollaboration?: () => void;
  onReRunQuery?: (query: string) => void;
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
  onSelectRecentlyDeleted,
  isRecentlyDeletedActive = false,
  onSelectArchive,
  isArchiveActive = false,
  isCollapsed = false,
  onToggleCollapse,
  onOpenShare,
  onOpenJoinCollaboration,
  onReRunQuery,
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const [activeMenu, setActiveMenu] = useState<{
    sessionId: string;
    session: ChatSession;
    isPinnedItem: boolean;
    top: number;
    right: number;
  } | null>(null);

  // Close 3-dot dropdown menu on outside click, scroll, resize, or Escape key
  useEffect(() => {
    if (!activeMenu) return;

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const menuEl = document.getElementById("nexa-chat-item-menu");
      if (menuEl && menuEl.contains(e.target as Node)) {
        return;
      }
      setActiveMenu(null);
    };

    const handleScrollOrResize = () => {
      setActiveMenu(null);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveMenu(null);
      }
    };

    window.addEventListener("mousedown", handlePointerDown, true);
    window.addEventListener("touchstart", handlePointerDown, true);
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown, true);
      window.removeEventListener("touchstart", handlePointerDown, true);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeMenu]);
  const [isRecentChatsExpanded, setIsRecentChatsExpanded] = useState(true);
  const [isRecentlyDeletedExpanded, setIsRecentlyDeletedExpanded] = useState(true);
  const [isArchiveExpanded, setIsArchiveExpanded] = useState(true);
  const [isSearchHistoryExpanded, setIsSearchHistoryExpanded] = useState(true);

  // Search History local storage state
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>(() => {
    const saved = safeStorage.getItem("nexa_search_history");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        console.warn("[Nexa Sidebar] Failed to parse search history:", e);
      }
    }
    return [];
  });

  const saveSearchHistory = (items: SearchHistoryItem[]) => {
    setSearchHistory(items);
    safeStorage.setItem("nexa_search_history", JSON.stringify(items));
  };

  const addSearchQuery = (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;

    const existingIndex = searchHistory.findIndex(
      (item) => item.query.toLowerCase() === trimmed.toLowerCase()
    );

    let updated: SearchHistoryItem[];
    if (existingIndex >= 0) {
      const existingItem = searchHistory[existingIndex];
      const newItem: SearchHistoryItem = {
        ...existingItem,
        query: trimmed,
        timestamp: new Date().toISOString(),
        count: (existingItem.count || 1) + 1,
      };
      updated = [newItem, ...searchHistory.filter((_, idx) => idx !== existingIndex)];
    } else {
      const newItem: SearchHistoryItem = {
        id: "sh_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
        query: trimmed,
        timestamp: new Date().toISOString(),
        count: 1,
      };
      updated = [newItem, ...searchHistory];
    }

    if (updated.length > 50) {
      updated = updated.slice(0, 50);
    }

    saveSearchHistory(updated);
  };

  const deleteSearchQuery = (id: string) => {
    const updated = searchHistory.filter((item) => item.id !== id);
    saveSearchHistory(updated);
  };

  const clearSearchHistory = () => {
    saveSearchHistory([]);
  };

  const handleApplySearchFilter = (query: string) => {
    setSearchQuery(query);
    setIsSearchOpen(true);
    addSearchQuery(query);
  };

  const handleReRunQueryInChat = (query: string) => {
    addSearchQuery(query);
    if (onReRunQuery) {
      onReRunQuery(query);
      onCloseMobile?.();
    } else {
      setSearchQuery(query);
      setIsSearchOpen(true);
    }
  };

  const touchStartTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Lazy loading state for infinite scrolling
  const [visibleCount, setVisibleCount] = useState(25);

  useEffect(() => {
    setVisibleCount(25);
  }, [searchQuery]);

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
      if (onOpenShare) {
        onOpenShare(session.id);
      } else {
        const shareUrl = `${window.location.origin}/share/thread/${session.id}`;
        copyToClipboard(shareUrl);
        alert("Shareable chat link copied to clipboard successfully!");
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Mobile Long-Press Handling
  const handleTouchStart = (e: React.TouchEvent, sessionId: string) => {
    if (touchStartTimerRef.current) clearTimeout(touchStartTimerRef.current);
    const targetEl = e.currentTarget as HTMLElement;
    touchStartTimerRef.current = setTimeout(() => {
      const session = filteredSessions.find((s) => s.id === sessionId);
      if (session) {
        const rect = targetEl.getBoundingClientRect();
        const menuHeight = 170;
        let top = rect.bottom + 4;
        if (top + menuHeight > window.innerHeight) {
          top = Math.max(8, rect.top - menuHeight);
        }
        const right = Math.max(12, window.innerWidth - rect.right);
        setActiveMenu({
          sessionId: session.id,
          session,
          isPinnedItem: !!session.isPinned,
          top,
          right,
        });
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }
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
    .filter((s) => s.isPinned && !(s as any).isArchived)
    .sort((a, b) => (a.pinOrder ?? 0) - (b.pinOrder ?? 0));

  const unpinnedChats = filteredSessions
    .filter((s) => !s.isPinned && !(s as any).isArchived)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  // Date-based grouping helpers
  const getGroupTitle = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    
    const dDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const diffTime = nowDate.getTime() - dDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return "Today";
    } else if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays <= 7) {
      return "Previous 7 Days";
    } else {
      return "Older Conversations";
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target.scrollHeight - target.scrollTop - target.clientHeight < 120) {
      if (visibleCount < unpinnedChats.length) {
        setVisibleCount((prev) => Math.min(prev + 25, unpinnedChats.length));
      }
    }
  };

  const displayedUnpinnedChats = unpinnedChats.slice(0, visibleCount);

  // Group displayed chats
  const groupedUnpinned: { [key: string]: ChatSession[] } = {
    "Today": [],
    "Yesterday": [],
    "Previous 7 Days": [],
    "Older Conversations": [],
  };

  displayedUnpinnedChats.forEach((chat) => {
    const groupName = getGroupTitle(chat.updatedAt);
    if (groupedUnpinned[groupName]) {
      groupedUnpinned[groupName].push(chat);
    } else {
      groupedUnpinned["Older Conversations"].push(chat);
    }
  });

  const activeGroups = [
    { title: "Today", chats: groupedUnpinned["Today"] },
    { title: "Yesterday", chats: groupedUnpinned["Yesterday"] },
    { title: "Previous 7 Days", chats: groupedUnpinned["Previous 7 Days"] },
    { title: "Older Conversations", chats: groupedUnpinned["Older Conversations"] },
  ].filter((group) => group.chats.length > 0);

  // Render a single chat row
  const renderChatItem = (session: ChatSession, isPinnedItem: boolean) => {
    const isActive = session.id === activeSessionId;
    const isEditing = editingId === session.id;

    if (isCollapsed) {
      return (
        <div
          className={`group/session w-full flex items-center justify-center p-2.5 rounded-xl border text-xs font-semibold select-none transition-all duration-200 relative ${
            isActive
              ? "border-[#C96A3D]/25 bg-[#C96A3D]/10 text-[#C96A3D]"
              : "border-transparent text-slate-500 hover:bg-slate-50/50 dark:hover:bg-slate-900/30 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
          onTouchStart={(e) => handleTouchStart(e, session.id)}
          onTouchEnd={handleTouchEnd}
          onTouchMove={handleTouchMove}
        >
          <button
            onClick={() => {
              onSelectSession(session.id);
              onCloseMobile?.();
            }}
            className="flex items-center justify-center cursor-pointer outline-none select-none"
            title={session.title}
          >
            <MessageSquare className={`w-4 h-4 shrink-0 ${isPinnedItem ? "text-[#C96A3D]" : "text-slate-400"}`} />
          </button>

          {/* Premium Tooltip */}
          <div className="absolute left-[54px] top-1/2 -translate-y-1/2 ml-1 px-3 py-2 bg-slate-900 dark:bg-slate-950 text-white text-[11px] font-medium rounded-xl shadow-2xl border border-slate-800 pointer-events-none opacity-0 scale-90 translate-x-2 origin-left group-hover/session:opacity-100 group-hover/session:scale-100 group-hover/session:translate-x-0 transition-all duration-200 z-50 whitespace-nowrap">
            <div className="flex flex-col gap-0.5 text-left">
              <span className="font-extrabold text-slate-100">{session.title}</span>
              <span className="text-[9px] text-slate-400 font-normal">
                {new Date(session.updatedAt).toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            {/* Tiny arrow */}
            <div className="absolute right-full top-1/2 -translate-y-1/2 border-y-4 border-y-transparent border-r-4 border-r-slate-900 dark:border-r-slate-950 mr-[-1px]" />
          </div>
        </div>
      );
    }

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
              if (activeMenu?.sessionId === session.id) return;
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
          <div className={`flex items-center gap-1 pr-1 shrink-0 ${activeMenu?.sessionId === session.id ? "flex" : "hidden group-hover/session:flex"}`}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                if (activeMenu?.sessionId === session.id) {
                  setActiveMenu(null);
                } else {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const menuHeight = 170;
                  let top = rect.bottom + 4;
                  if (top + menuHeight > window.innerHeight) {
                    top = Math.max(8, rect.top - menuHeight);
                  }
                  const right = Math.max(12, window.innerWidth - rect.right);
                  setActiveMenu({
                    sessionId: session.id,
                    session,
                    isPinnedItem,
                    top,
                    right,
                  });
                }
              }}
              className={`p-1 rounded-md transition-all cursor-pointer ${
                activeMenu?.sessionId === session.id
                  ? "text-[#C96A3D] bg-slate-100 dark:bg-slate-800/80"
                  : "text-slate-400 hover:text-[#C96A3D] hover:bg-slate-100 dark:hover:bg-slate-800/80"
              }`}
              title="More Actions"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <aside
      className={`flex flex-col w-full h-full bg-white dark:bg-[#0c1222] select-none overflow-hidden transition-all duration-300`}
      id="nexa-control-sidebar"
    >
      {/* Sidebar Header: Logo, Start New Chat & Search (Fixed at the top) */}
      <div className={`p-4 border-b border-slate-100 dark:border-slate-800/80 shrink-0 flex flex-col ${isCollapsed ? "items-center gap-4 pb-3" : "gap-3"}`}>
        <div className={`flex w-full items-center ${isCollapsed ? "flex-col gap-4 justify-center" : "justify-between"}`}>
          {!isCollapsed ? (
            <>
              {/* Logo */}
              <div className="flex items-center gap-2">
                <Logo size={28} showText={true} textClass="text-base font-black text-[#14213D] dark:text-white" animate={false} />
              </div>
              
              {/* Redesigned Header Toolbar */}
              <div className="flex items-center gap-1">
                {/* 1. Toggle Collapse */}
                {onToggleCollapse && (
                  <button
                    onClick={onToggleCollapse}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-[#C96A3D] dark:hover:text-[#C96A3D] hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors cursor-pointer"
                    title="Collapse Sidebar"
                  >
                    <PanelLeftClose className="w-4.5 h-4.5" />
                  </button>
                )}
                
                {/* 2. Search Icon (toggles search box) */}
                <button
                  onClick={() => setIsSearchOpen(!isSearchOpen)}
                  className={`p-1.5 rounded-xl transition-all cursor-pointer ${
                    isSearchOpen 
                      ? "text-[#C96A3D] bg-[#C96A3D]/10" 
                      : "text-slate-400 hover:text-[#C96A3D] dark:hover:text-[#C96A3D] hover:bg-slate-50 dark:hover:bg-slate-900"
                  }`}
                  title="Search Conversations"
                >
                  <Search className="w-4.5 h-4.5" />
                </button>

                {/* 3. New Chat Button */}
                <button
                  onClick={() => {
                    onNewSession(activeMode);
                    onCloseMobile?.();
                  }}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-[#C96A3D] hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors cursor-pointer"
                  title={`New ${activeMode === "general" ? "Chat" : activeMode === "research" ? "Research" : "Workspace"}`}
                >
                  <Plus className="w-4.5 h-4.5" />
                </button>
                
                {isMobileOpen && (
                  <button
                    onClick={onCloseMobile}
                    className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors cursor-pointer ml-1"
                    title="Close Menu"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-4">
              {/* Logo Icon Only */}
              <Logo size={28} showText={false} animate={false} />
              
              {/* Toolbar in Collapsed Mode */}
              <div className="flex flex-col items-center gap-3">
                {/* 1. Toggle Expand */}
                {onToggleCollapse && (
                  <button
                    onClick={onToggleCollapse}
                    className="p-2 rounded-xl text-slate-400 hover:text-[#C96A3D] dark:hover:text-[#C96A3D] hover:bg-slate-50 dark:hover:bg-slate-900 transition-all cursor-pointer active:scale-95"
                    title="Expand Sidebar"
                  >
                    <PanelLeftOpen className="w-5 h-5" />
                  </button>
                )}
                
                {/* 2. Search Icon (opens & expands sidebar) */}
                <button
                  onClick={() => {
                    onToggleCollapse?.();
                    setIsSearchOpen(true);
                  }}
                  className="p-2 rounded-xl text-slate-400 hover:text-[#C96A3D] dark:hover:text-[#C96A3D] hover:bg-slate-50 dark:hover:bg-slate-900 transition-all cursor-pointer active:scale-95"
                  title="Search Chats"
                >
                  <Search className="w-5 h-5" />
                </button>

                {/* 3. New Chat Button */}
                <button
                  onClick={() => {
                    onNewSession(activeMode);
                  }}
                  className="p-2 rounded-xl text-slate-400 hover:text-[#C96A3D] dark:hover:text-[#C96A3D] hover:bg-slate-50 dark:hover:bg-slate-900 transition-all cursor-pointer active:scale-95"
                  title="New Chat"
                >
                  <Plus className="w-5 h-5" />
                </button>

                {/* 4. Join Collaboration (Icon in collapsed view) */}
                {onOpenJoinCollaboration && (
                  <button
                    onClick={onOpenJoinCollaboration}
                    className="p-2 rounded-xl text-slate-400 hover:text-[#C96A3D] dark:hover:text-[#C96A3D] hover:bg-slate-50 dark:hover:bg-slate-900 transition-all cursor-pointer active:scale-95"
                    title="Join Collaboration"
                  >
                    <Users className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Search box with smooth transition */}
        {!isCollapsed && (
          <AnimatePresence>
            {isSearchOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0, marginTop: 0 }}
                animate={{ height: "auto", opacity: 1, marginTop: 4 }}
                exit={{ height: 0, opacity: 0, marginTop: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="overflow-hidden w-full"
              >
                <div className="relative flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      autoFocus
                      placeholder="Search conversations..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && searchQuery.trim()) {
                          addSearchQuery(searchQuery);
                        }
                      }}
                      onBlur={() => {
                        if (searchQuery.trim().length >= 2) {
                          addSearchQuery(searchQuery);
                        }
                      }}
                      className="w-full text-xs py-2 pl-8 pr-12 rounded-xl border border-[#C96A3D]/30 dark:border-[#C96A3D]/30 bg-slate-50/50 dark:bg-slate-900/40 focus:border-[#C96A3D] focus:ring-1 focus:ring-[#C96A3D] outline-none text-[#14213D] dark:text-white transition-all font-medium h-9"
                    />
                    <Search className="absolute left-2.5 top-3 text-[#C96A3D] w-3.5 h-3.5" />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery("")}
                        className="absolute right-3.5 top-2.5 text-slate-400 hover:text-slate-650 dark:hover:text-slate-200 font-bold text-[10px] tracking-wide cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}

        {!isCollapsed && onOpenJoinCollaboration && (
          <button
            onClick={onOpenJoinCollaboration}
            className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 bg-[#C96A3D]/10 hover:bg-[#C96A3D]/20 text-[#C96A3D] rounded-xl border border-[#C96A3D]/20 text-xs font-black transition-all active:scale-98 cursor-pointer shadow-3xs"
          >
            <span>🔑</span>
            <span>Join Shared Chat</span>
          </button>
        )}
      </div>

      {/* Primary Scrollable Workspace Section (One continuous scroll container) */}
      <div 
        className={`flex-1 min-h-0 overflow-y-auto w-full ${isCollapsed ? "px-2 py-4 space-y-4" : "p-4 space-y-5"} flex flex-col`}
        onScroll={handleScroll}
        style={{ scrollBehavior: "smooth", WebkitOverflowScrolling: "touch" }}
      >
        {!isCollapsed ? (
          <>
            {/* 1. Collapsible Recent Chats */}
            <div className="space-y-2 w-full">
              <button
                onClick={() => setIsRecentChatsExpanded(!isRecentChatsExpanded)}
                className="w-full flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 hover:text-slate-650 dark:hover:text-slate-300 transition-colors py-1 cursor-pointer select-none outline-none"
              >
                <div className="flex items-center gap-1.5">
                  {isRecentChatsExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span>Recent Chats</span>
                </div>
                <span className="text-[9px] font-extrabold text-slate-400 dark:text-slate-500 font-mono bg-slate-50 dark:bg-slate-900/60 px-1.5 py-0.5 rounded-full shrink-0">
                  {pinnedChats.length + unpinnedChats.length}
                </span>
              </button>

              <AnimatePresence initial={false}>
                {isRecentChatsExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                    className="overflow-hidden space-y-4 w-full"
                  >
                    {/* A: Pinned Chats section */}
                    {pinnedChats.length > 0 && (
                      <div className="space-y-1.5 w-full pl-1">
                        <div className="flex justify-between items-center px-1">
                          <h5 className="text-[9px] font-black uppercase tracking-widest text-[#C96A3D] flex items-center gap-1">
                            <Pin className="w-3 h-3 text-[#C96A3D] fill-[#C96A3D]/15 rotate-45 shrink-0" />
                            <span>Pinned</span>
                          </h5>
                        </div>

                        <Reorder.Group
                          axis="y"
                          values={pinnedChats}
                          onReorder={handleReorderPinned}
                          className="space-y-1 w-full"
                        >
                          {pinnedChats.map((session) => (
                            <Reorder.Item
                              key={session.id}
                              value={session}
                              dragListener={!searchQuery.trim()}
                              className="outline-none w-full"
                              style={{ position: "relative" }}
                            >
                              {renderChatItem(session, true)}
                            </Reorder.Item>
                          ))}
                        </Reorder.Group>
                      </div>
                    )}

                    {/* B: Grouped Conversations */}
                    {activeGroups.length > 0 ? (
                      activeGroups.map((group) => (
                        <div key={group.title} className="space-y-1.5 w-full pl-1">
                          <div className="flex justify-between items-center px-1">
                            <h5 className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                              {group.title}
                            </h5>
                          </div>

                          <div className="space-y-1.5 w-full">
                            {group.chats.map((session) => (
                              <div key={session.id} className="w-full">
                                {renderChatItem(session, false)}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    ) : (
                      unpinnedChats.length === 0 && (
                        <p className="text-[11px] text-slate-400 italic text-left p-2">
                          No conversations found.
                        </p>
                      )
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* 2. Dedicated Search History Section */}
            <div className="space-y-2 w-full pt-2 border-t border-slate-100 dark:border-slate-800/40">
              <div className="flex items-center justify-between py-1">
                <button
                  onClick={() => setIsSearchHistoryExpanded(!isSearchHistoryExpanded)}
                  className="flex-1 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 hover:text-slate-650 dark:hover:text-slate-300 transition-colors cursor-pointer select-none outline-none pr-2"
                >
                  <div className="flex items-center gap-1.5">
                    {isSearchHistoryExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <History className="w-3.5 h-3.5 shrink-0 text-[#C96A3D]/80" />
                    <span>Search History</span>
                  </div>
                  <span className="text-[9px] font-extrabold text-slate-400 dark:text-slate-500 font-mono bg-slate-50 dark:bg-slate-900/60 px-1.5 py-0.5 rounded-full shrink-0">
                    {searchHistory.length}
                  </span>
                </button>

                {searchHistory.length > 0 && isSearchHistoryExpanded && (
                  <button
                    onClick={clearSearchHistory}
                    className="text-[9px] font-extrabold text-slate-400 hover:text-rose-500 transition-colors px-1.5 py-0.5 rounded hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                    title="Clear search history"
                  >
                    Clear All
                  </button>
                )}
              </div>

              <AnimatePresence initial={false}>
                {isSearchHistoryExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                    className="overflow-hidden space-y-1.5 w-full pl-1"
                  >
                    {searchHistory.length > 0 ? (
                      <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
                        {searchHistory.map((item) => (
                          <div
                            key={item.id}
                            className="group/item flex items-center justify-between p-2 rounded-xl border border-transparent hover:border-slate-200 dark:hover:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/30 hover:bg-slate-100/70 dark:hover:bg-slate-800/50 transition-all duration-150 text-xs"
                          >
                            <button
                              onClick={() => handleApplySearchFilter(item.query)}
                              className="flex-1 min-w-0 flex items-center gap-2 text-left cursor-pointer outline-none pr-1"
                              title={`Filter conversations for: "${item.query}"`}
                            >
                              <History className="w-3.5 h-3.5 shrink-0 text-slate-400 group-hover/item:text-[#C96A3D] transition-colors" />
                              <div className="flex flex-col min-w-0">
                                <span className="truncate font-semibold text-slate-700 dark:text-slate-200 group-hover/item:text-[#C96A3D] transition-colors text-[11.5px]">
                                  {item.query}
                                </span>
                                <span className="text-[9px] text-slate-400 font-normal">
                                  {formatRelativeTime(item.timestamp)}
                                </span>
                              </div>
                            </button>

                            <div className="flex items-center gap-1 shrink-0 opacity-70 group-hover/item:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleReRunQueryInChat(item.query);
                                }}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-[#C96A3D] hover:bg-[#C96A3D]/10 dark:hover:bg-[#C96A3D]/20 transition-all cursor-pointer"
                                title="Re-run query with AI assistant"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteSearchQuery(item.id);
                                }}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all cursor-pointer"
                                title="Delete search item"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-3 text-center rounded-xl bg-slate-50/50 dark:bg-slate-900/20 border border-dashed border-slate-200 dark:border-slate-800/60">
                        <History className="w-4 h-4 text-slate-300 dark:text-slate-600 mx-auto mb-1" />
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                          No search history
                        </p>
                        <p className="text-[9.5px] text-slate-400/80 dark:text-slate-500/80 mt-0.5">
                          Past searches will be saved here for quick access.
                        </p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* 3. Collapsible Recently Deleted (Placed just under Search History) */}
            <div className="space-y-2 w-full pt-2 border-t border-slate-100 dark:border-slate-800/40">
              <button
                onClick={() => setIsRecentlyDeletedExpanded(!isRecentlyDeletedExpanded)}
                className="w-full flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 hover:text-slate-650 dark:hover:text-slate-300 transition-colors py-1 cursor-pointer select-none outline-none"
              >
                <div className="flex items-center gap-1.5">
                  {isRecentlyDeletedExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span>Recently Deleted</span>
                </div>
              </button>

              <AnimatePresence initial={false}>
                {isRecentlyDeletedExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                    className="overflow-hidden w-full"
                  >
                    <button
                      onClick={() => {
                        onSelectRecentlyDeleted?.();
                        onCloseMobile?.();
                      }}
                      className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl border text-xs font-semibold select-none transition-all duration-200 cursor-pointer ${
                        isRecentlyDeletedActive
                          ? "border-[#C96A3D]/20 bg-[#C96A3D]/5 text-[#C96A3D]"
                          : "border-transparent text-slate-500 hover:bg-slate-50/50 dark:hover:bg-slate-900/30 hover:text-slate-700 dark:hover:text-slate-300"
                      }`}
                    >
                      <Trash2 className={`w-3.5 h-3.5 shrink-0 ${isRecentlyDeletedActive ? "text-[#C96A3D]" : "text-slate-400"}`} />
                      <span>View Deleted Logs</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* 4. Collapsible Archived Chats (Placed under Recently Deleted) */}
            <div className="space-y-2 w-full pt-2 border-t border-slate-100 dark:border-slate-800/40">
              <button
                onClick={() => setIsArchiveExpanded(!isArchiveExpanded)}
                className="w-full flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 hover:text-slate-650 dark:hover:text-slate-300 transition-colors py-1 cursor-pointer select-none outline-none"
              >
                <div className="flex items-center gap-1.5">
                  {isArchiveExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span>Archive</span>
                </div>
                <span className="text-[9px] font-extrabold text-slate-400 dark:text-slate-500 font-mono bg-slate-50 dark:bg-slate-900/60 px-1.5 py-0.5 rounded-full shrink-0">
                  {sessions.filter(s => (s as any).isArchived).length}
                </span>
              </button>

              <AnimatePresence initial={false}>
                {isArchiveExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                    className="overflow-hidden w-full"
                  >
                    <button
                      onClick={() => {
                        onSelectArchive?.();
                        onCloseMobile?.();
                      }}
                      className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl border text-xs font-semibold select-none transition-all duration-200 cursor-pointer ${
                        isArchiveActive
                          ? "border-[#C96A3D]/20 bg-[#C96A3D]/5 text-[#C96A3D]"
                          : "border-transparent text-slate-500 hover:bg-slate-50/50 dark:hover:bg-slate-900/30 hover:text-slate-700 dark:hover:text-slate-300"
                      }`}
                    >
                      <Archive className={`w-3.5 h-3.5 shrink-0 ${isArchiveActive ? "text-[#C96A3D]" : "text-slate-400"}`} />
                      <span>View Archived Chats</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </>
        ) : (
          /* Collapsed Icons Only mode: direct list of icons stacked vertically */
          <div className="flex flex-col items-center gap-3 w-full">
            {/* Pinned items */}
            {pinnedChats.map((session) => (
              <div key={session.id} className="w-full flex justify-center">
                {renderChatItem(session, true)}
              </div>
            ))}

            {/* Separator if both pinned and unpinned exist */}
            {pinnedChats.length > 0 && unpinnedChats.length > 0 && (
              <div className="w-8 border-t border-slate-100 dark:border-slate-800/60 my-1" />
            )}

            {/* Unpinned items */}
            {unpinnedChats.slice(0, visibleCount).map((session) => (
              <div key={session.id} className="w-full flex justify-center">
                {renderChatItem(session, false)}
              </div>
            ))}

            {/* Search History icon separator */}
            <div className="w-8 border-t border-slate-100 dark:border-slate-800/60 my-2" />

            {/* Search History button */}
            <button
              onClick={() => {
                onToggleCollapse?.();
                setIsSearchHistoryExpanded(true);
              }}
              className="flex items-center justify-center select-none transition-all duration-200 cursor-pointer w-11 h-11 rounded-xl relative group/history border border-transparent text-slate-400 hover:bg-slate-50/50 dark:hover:bg-slate-900/30 hover:text-[#C96A3D]"
              title="Search History"
            >
              <History className="w-4 h-4 shrink-0 text-slate-400 group-hover/history:text-[#C96A3D]" />
              <div className="absolute left-[54px] top-1/2 -translate-y-1/2 ml-1 px-3 py-2 bg-slate-900 dark:bg-slate-950 text-white text-[11px] font-medium rounded-xl shadow-2xl border border-slate-800 pointer-events-none opacity-0 scale-90 translate-x-2 origin-left group-hover/history:opacity-100 group-hover/history:scale-100 group-hover/history:translate-x-0 transition-all duration-200 z-50 whitespace-nowrap text-left">
                <span className="font-extrabold text-slate-100">Search History ({searchHistory.length})</span>
                <div className="absolute right-full top-1/2 -translate-y-1/2 border-y-4 border-y-transparent border-r-4 border-r-slate-900 dark:border-r-slate-950 mr-[-1px]" />
              </div>
            </button>

            {/* Recently Deleted icon separator */}
            <div className="w-8 border-t border-slate-100 dark:border-slate-800/60 my-2" />

            {/* Recently Deleted button */}
            <button
              onClick={() => {
                onSelectRecentlyDeleted?.();
                onCloseMobile?.();
              }}
              className={`flex items-center justify-center select-none transition-all duration-200 cursor-pointer w-11 h-11 rounded-xl relative group/deleted border ${
                isRecentlyDeletedActive 
                  ? "border-[#C96A3D]/25 bg-[#C96A3D]/10 text-[#C96A3D]" 
                  : "border-transparent text-slate-400 hover:bg-slate-50/50 dark:hover:bg-slate-900/30 hover:text-slate-700"
              }`}
              title="Recently Deleted"
            >
              <Trash2 className={`w-4 h-4 shrink-0 ${isRecentlyDeletedActive ? "text-[#C96A3D]" : "text-slate-400"}`} />
              <div className="absolute left-[54px] top-1/2 -translate-y-1/2 ml-1 px-3 py-2 bg-slate-900 dark:bg-slate-950 text-white text-[11px] font-medium rounded-xl shadow-2xl border border-slate-800 pointer-events-none opacity-0 scale-90 translate-x-2 origin-left group-hover/deleted:opacity-100 group-hover/deleted:scale-100 group-hover/deleted:translate-x-0 transition-all duration-200 z-50 whitespace-nowrap text-left">
                <span className="font-extrabold text-slate-100">Recently Deleted</span>
                <div className="absolute right-full top-1/2 -translate-y-1/2 border-y-4 border-y-transparent border-r-4 border-r-slate-900 dark:border-r-slate-950 mr-[-1px]" />
              </div>
            </button>

            {/* Archived Chats icon separator */}
            <div className="w-8 border-t border-slate-100 dark:border-slate-800/60 my-2" />

            {/* Archived Chats button */}
            <button
              onClick={() => {
                onSelectArchive?.();
                onCloseMobile?.();
              }}
              className={`flex items-center justify-center select-none transition-all duration-200 cursor-pointer w-11 h-11 rounded-xl relative group/archive border ${
                isArchiveActive 
                  ? "border-[#C96A3D]/25 bg-[#C96A3D]/10 text-[#C96A3D]" 
                  : "border-transparent text-slate-400 hover:bg-slate-50/50 dark:hover:bg-slate-900/30 hover:text-slate-700"
              }`}
              title="Archived Chats"
            >
              <Archive className={`w-4 h-4 shrink-0 ${isArchiveActive ? "text-[#C96A3D]" : "text-slate-400"}`} />
              <div className="absolute left-[54px] top-1/2 -translate-y-1/2 ml-1 px-3 py-2 bg-slate-900 dark:bg-slate-950 text-white text-[11px] font-medium rounded-xl shadow-2xl border border-slate-800 pointer-events-none opacity-0 scale-90 translate-x-2 origin-left group-hover/archive:opacity-100 group-hover/archive:scale-100 group-hover/archive:translate-x-0 transition-all duration-200 z-50 whitespace-nowrap text-left">
                <span className="font-extrabold text-slate-100">Archived Chats</span>
                <div className="absolute right-full top-1/2 -translate-y-1/2 border-y-4 border-y-transparent border-r-4 border-r-slate-900 dark:border-r-slate-950 mr-[-1px]" />
              </div>
            </button>
          </div>
        )}
      </div>

      {/* Guest Mode Sign-In / Account footer */}
      {user.isGuest ? (
        <div className={`p-4 border-t border-slate-150 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 flex ${isCollapsed ? "flex-col items-center gap-4" : "items-center justify-between gap-3"} text-xs shrink-0`}>
          {isCollapsed ? (
            <div className="relative group/user flex flex-col gap-3 items-center">
              <button
                onClick={() => {
                  onOpenAuth();
                  onCloseMobile?.();
                }}
                className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center font-bold text-sm shrink-0 select-none shadow-sm cursor-pointer hover:bg-[#C96A3D]/10 hover:text-[#C96A3D] transition-colors"
                title="Sign In"
              >
                G
              </button>
              
              <button
                onClick={() => {
                  onOpenSettings?.();
                  onCloseMobile?.();
                }}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-[#C96A3D] hover:border-[#C96A3D]/30 hover:bg-white dark:hover:bg-slate-900 transition-all cursor-pointer shadow-3xs"
                title="Open Settings"
              >
                <Settings className="w-4 h-4" />
              </button>

              <div className="absolute left-[54px] top-4 -translate-y-1/2 ml-1 px-3 py-2 bg-slate-900 dark:bg-slate-950 text-white text-[11px] font-medium rounded-xl shadow-2xl border border-slate-800 pointer-events-none opacity-0 scale-90 translate-x-2 origin-left group-hover/user:opacity-100 group-hover/user:scale-100 group-hover/user:translate-x-0 transition-all duration-200 z-50 whitespace-nowrap text-left">
                <div className="flex flex-col">
                  <span className="font-extrabold text-slate-100">Guest User</span>
                  <span className="text-[9px] text-slate-400">Sign in to sync logs</span>
                </div>
                <div className="absolute right-full top-[24px] -translate-y-1/2 border-y-4 border-y-transparent border-r-4 border-r-slate-900 dark:border-r-slate-950 mr-[-1px]" />
              </div>
            </div>
          ) : (
            <>
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
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => {
                    onOpenSettings?.();
                    onCloseMobile?.();
                  }}
                  className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-[#C96A3D] dark:hover:text-[#C96A3D] hover:bg-white dark:hover:bg-slate-900 transition-all cursor-pointer shadow-3xs"
                  title="Open Settings"
                  id="sidebar-footer-settings-btn-guest"
                >
                  <Settings className="w-4 h-4" />
                </button>
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
            </>
          )}
        </div>
      ) : (
        /* Logged-In User Profile bottom footer */
        <div className={`p-4 border-t border-slate-150 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 flex ${isCollapsed ? "flex-col items-center gap-3" : "items-center justify-between gap-3"} text-xs shrink-0`} id="nexa-sidebar-footer">
          {isCollapsed ? (
            <div className="relative group/user flex flex-col gap-3.5 items-center">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.fullName}
                  className="w-10 h-10 rounded-xl object-cover shrink-0 select-none border border-slate-200 dark:border-slate-800 shadow-3xs cursor-pointer"
                  onClick={() => {
                    onOpenSettings?.();
                    onCloseMobile?.();
                  }}
                />
              ) : (
                <div 
                  className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-sm shrink-0 select-none shadow-sm cursor-pointer"
                  onClick={() => {
                    onOpenSettings?.();
                    onCloseMobile?.();
                  }}
                >
                  {user.fullName ? user.fullName[0].toUpperCase() : "N"}
                </div>
              )}

              <button
                onClick={() => {
                  onOpenSettings?.();
                  onCloseMobile?.();
                }}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-[#C96A3D] dark:hover:text-[#C96A3D] hover:bg-white dark:hover:bg-slate-900 transition-all cursor-pointer shadow-3xs"
                title="Open Settings"
                id="sidebar-footer-settings-btn"
              >
                <Settings className="w-4 h-4" />
              </button>

              {onLogout && (
                <button
                  onClick={() => {
                    onLogout();
                    onCloseMobile?.();
                  }}
                  className="p-2 rounded-xl border border-transparent hover:border-slate-200 dark:hover:border-slate-800 text-slate-400 hover:text-rose-500 hover:bg-white dark:hover:bg-slate-900 transition-all cursor-pointer"
                  title="Sign Out"
                  id="sidebar-footer-logout-btn"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}

              <div className="absolute left-[54px] top-5 -translate-y-1/2 ml-1 px-3 py-2 bg-slate-900 dark:bg-slate-950 text-white text-[11px] font-medium rounded-xl shadow-2xl border border-slate-800 pointer-events-none opacity-0 scale-90 translate-x-2 origin-left group-hover/user:opacity-100 group-hover/user:scale-100 group-hover/user:translate-x-0 transition-all duration-200 z-50 whitespace-nowrap text-left">
                <div className="flex flex-col gap-0.5">
                  <span className="font-extrabold text-slate-100">{user.fullName}</span>
                  <span className="text-[10px] text-slate-400 font-normal">{user.email}</span>
                  <span className="text-[9px] font-black text-[#C96A3D] bg-[#C96A3D]/20 px-1.5 py-0.5 rounded-md inline-block font-mono mt-1 text-center">
                    {user.gamification?.points || 0} XP
                  </span>
                </div>
                <div className="absolute right-full top-5 -translate-y-1/2 border-y-4 border-y-transparent border-r-4 border-r-slate-900 dark:border-r-slate-950 mr-[-1px]" />
              </div>
            </div>
          ) : (
            <>
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
                  <p className="text-[10px] text-slate-450 dark:text-slate-450 truncate font-normal" title={user.email}>
                    {user.email}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[9px] font-black text-[#C96A3D] bg-[#C96A3D]/10 px-1.5 py-0.5 rounded-full inline-block font-mono">
                      {user.gamification?.points || 0} XP
                    </span>
                  </div>
                </div>
              </div>

              {/* Settings and logout buttons next to Gmail email */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => {
                    onOpenSettings?.();
                    onCloseMobile?.();
                  }}
                  className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-[#C96A3D] dark:hover:text-[#C96A3D] hover:bg-white dark:hover:bg-slate-900 transition-all cursor-pointer shadow-3xs"
                  title="Open Settings"
                  id="sidebar-footer-settings-btn"
                >
                  <Settings className="w-4 h-4" />
                </button>
                {onLogout && (
                  <button
                    onClick={() => {
                      onLogout();
                      onCloseMobile?.();
                    }}
                    className="p-2 rounded-xl border border-transparent hover:border-slate-200 dark:hover:border-slate-800 text-slate-400 hover:text-rose-500 hover:bg-white dark:hover:bg-slate-900 transition-all cursor-pointer"
                    title="Sign Out"
                    id="sidebar-footer-logout-btn"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {activeMenu &&
        createPortal(
          <AnimatePresence>
            <motion.div
              id="nexa-chat-item-menu"
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              style={{
                position: "fixed",
                top: `${activeMenu.top}px`,
                right: `${activeMenu.right}px`,
                zIndex: 99999,
              }}
              className="bg-white dark:bg-[#11192e] border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-2xl p-1.5 min-w-[160px] text-left space-y-0.5 pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPinSession(activeMenu.session.id);
                  setActiveMenu(null);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-[11.5px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-[#C96A3D] dark:hover:text-[#C96A3D] transition-colors cursor-pointer"
              >
                <Pin className={`w-3.5 h-3.5 ${activeMenu.isPinnedItem ? "rotate-45 fill-[#C96A3D] text-[#C96A3D]" : ""}`} />
                <span>{activeMenu.isPinnedItem ? "Unpin Chat" : "Pin Chat"}</span>
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleStartRename(activeMenu.session);
                  setActiveMenu(null);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-[11.5px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-[#C96A3D] dark:hover:text-[#C96A3D] transition-colors cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Rename Chat</span>
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleShareSession(activeMenu.session);
                  setActiveMenu(null);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-[11.5px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-[#C96A3D] dark:hover:text-[#C96A3D] transition-colors cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share Chat</span>
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteSession(activeMenu.session.id);
                  setActiveMenu(null);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-[11.5px] font-semibold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Chat</span>
              </button>
            </motion.div>
          </AnimatePresence>,
          document.body
        )}
    </aside>
  );
}
