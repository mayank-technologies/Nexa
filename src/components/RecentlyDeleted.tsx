/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import {
  Trash2,
  RotateCcw,
  Search,
  ArrowUpDown,
  Calendar,
  MessageSquare,
  Clock,
  AlertTriangle,
  FolderOpen,
  X,
  Sparkles
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ChatSession, UserProfile, Message } from "../types";

interface RecentlyDeletedProps {
  user: UserProfile;
  deletedSessions: ChatSession[];
  onRestore: (id: string) => void;
  onDeleteForever: (id: string) => void;
  onEmptyAll: () => void;
  isLoading: boolean;
  onClose: () => void;
}

type SortOption = "date_newest" | "date_oldest" | "name_az" | "messages_count";

export function RecentlyDeleted({
  user,
  deletedSessions,
  onRestore,
  onDeleteForever,
  onEmptyAll,
  isLoading,
  onClose,
}: RecentlyDeletedProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("date_newest");
  const [showConfirmEmpty, setShowConfirmEmpty] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Advanced features state hooks
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showConfirmBulkDelete, setShowConfirmBulkDelete] = useState(false);
  const [showConfirmBulkRestore, setShowConfirmBulkRestore] = useState(false);
  const [summaries, setSummaries] = useState<Record<string, { text: string; loading: boolean }>>({});
  const [shreddingState, setShreddingState] = useState<{
    isActive: boolean;
    progress: number;
    actionType: "empty_all" | "bulk_delete" | "bulk_restore" | null;
    totalCount: number;
  }>({
    isActive: false,
    progress: 0,
    actionType: null,
    totalCount: 0
  });

  // Keep selectedIds in sync when sessions are removed
  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => deletedSessions.some((s) => s.id === id)));
  }, [deletedSessions]);

  // Generate Smart Summary of the last 2-3 messages
  const generateSmartSummary = (id: string, title: string, messages: Message[]) => {
    setSummaries(prev => ({ ...prev, [id]: { text: "", loading: true } }));
    
    setTimeout(() => {
      const last3 = messages.slice(-3);
      let summaryText = "";
      
      if (last3.length === 0) {
        summaryText = `This chat ("${title}") is empty. No message logs found.`;
      } else {
        const textConcatenation = last3.map(m => m.content).join(" ").toLowerCase();
        const mainTopics: string[] = [];
        if (textConcatenation.includes("react") || textConcatenation.includes("vite") || textConcatenation.includes("code") || textConcatenation.includes("ts")) {
          mainTopics.push("React development");
        }
        if (textConcatenation.includes("database") || textConcatenation.includes("supabase") || textConcatenation.includes("sql")) {
          mainTopics.push("database integration");
        }
        if (textConcatenation.includes("error") || textConcatenation.includes("bug") || textConcatenation.includes("fail")) {
          mainTopics.push("system troubleshooting");
        }
        if (textConcatenation.includes("how") || textConcatenation.includes("explain") || textConcatenation.includes("what")) {
          mainTopics.push("exploratory learning");
        }
        
        const topicsStr = mainTopics.length > 0 ? ` discussing ${mainTopics.join(" & ")}` : "";
        const assistantReply = last3.find(m => m.role === 'assistant')?.content || "";
        const userQuery = last3.find(m => m.role === 'user')?.content || "";
        
        if (userQuery && assistantReply) {
          summaryText = `User asked: "${userQuery.slice(0, 50)}${userQuery.length > 50 ? '...' : ''}". Nexa responded outlining instructions${topicsStr}: "${assistantReply.slice(0, 75)}${assistantReply.length > 75 ? '...' : ''}"`;
        } else if (userQuery) {
          summaryText = `An inquiry session centering on user query: "${userQuery.slice(0, 85)}${userQuery.length > 85 ? '...' : ''}"`;
        } else if (assistantReply) {
          summaryText = `Assistant feedback containing details: "${assistantReply.slice(0, 85)}${assistantReply.length > 85 ? '...' : ''}"`;
        } else {
          summaryText = "An unstructured system session.";
        }
      }
      
      setSummaries(prev => ({
        ...prev,
        [id]: { text: summaryText, loading: false }
      }));
    }, 1200);
  };

  const triggerEmptyAllWithAnimation = () => {
    setShowConfirmEmpty(false);
    setShreddingState({
      isActive: true,
      progress: 0,
      actionType: "empty_all",
      totalCount: deletedSessions.length
    });

    let currentProgress = 0;
    const interval = setInterval(() => {
      currentProgress += 5;
      if (currentProgress >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          onEmptyAll();
          setShreddingState({ isActive: false, progress: 0, actionType: null, totalCount: 0 });
          setSelectedIds([]);
        }, 500);
      } else {
        setShreddingState(prev => ({
          ...prev,
          progress: currentProgress
        }));
      }
    }, 80);
  };

  const triggerBulkDeleteWithAnimation = () => {
    setShowConfirmBulkDelete(false);
    setShreddingState({
      isActive: true,
      progress: 0,
      actionType: "bulk_delete",
      totalCount: selectedIds.length
    });

    let currentProgress = 0;
    const interval = setInterval(() => {
      currentProgress += 8;
      if (currentProgress >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          selectedIds.forEach(id => onDeleteForever(id));
          setShreddingState({ isActive: false, progress: 0, actionType: null, totalCount: 0 });
          setSelectedIds([]);
        }, 500);
      } else {
        setShreddingState(prev => ({
          ...prev,
          progress: Math.min(currentProgress, 100)
        }));
      }
    }, 100);
  };

  const triggerBulkRestoreWithAnimation = () => {
    setShowConfirmBulkRestore(false);
    setShreddingState({
      isActive: true,
      progress: 0,
      actionType: "bulk_restore",
      totalCount: selectedIds.length
    });

    let currentProgress = 0;
    const interval = setInterval(() => {
      currentProgress += 8;
      if (currentProgress >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          selectedIds.forEach(id => onRestore(id));
          setShreddingState({ isActive: false, progress: 0, actionType: null, totalCount: 0 });
          setSelectedIds([]);
        }, 500);
      } else {
        setShreddingState(prev => ({
          ...prev,
          progress: Math.min(currentProgress, 100)
        }));
      }
    }, 100);
  };

  // Calculate remaining days for display
  const getRemainingDays = (deletedAtStr?: string, autoDeleteAtStr?: string) => {
    const baseDate = deletedAtStr ? new Date(deletedAtStr) : new Date();
    const autoDeleteAt = autoDeleteAtStr
      ? new Date(autoDeleteAtStr).getTime()
      : baseDate.getTime() + 30 * 24 * 60 * 60 * 1000;

    const now = Date.now();
    const diffTime = autoDeleteAt - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  // Get color-coded badge styles based on remaining days
  const getBadgeStyles = (days: number) => {
    if (days > 20) {
      return {
        badge: "bg-emerald-50 dark:bg-emerald-950/25 text-emerald-650 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/40",
        icon: "text-emerald-500 dark:text-emerald-400"
      };
    }
    if (days >= 10) {
      return {
        badge: "bg-amber-50 dark:bg-amber-950/25 text-amber-650 dark:text-amber-400 border-amber-100 dark:border-amber-900/40",
        icon: "text-amber-500 dark:text-amber-400"
      };
    }
    return {
      badge: "bg-rose-50 dark:bg-rose-950/25 text-rose-650 dark:text-rose-400 border-rose-100 dark:border-rose-900/40",
      icon: "text-rose-500 dark:text-rose-400"
    };
  };

  // Format Deleted Date
  const formatDeletedDate = (dateStr?: string) => {
    if (!dateStr) return "Unknown Date";
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Filter sessions
  const filtered = deletedSessions.filter((s) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    const matchesTitle = s.title.toLowerCase().includes(query);
    const matchesContent = s.messages?.some((m) =>
      m.content.toLowerCase().includes(query)
    );
    return matchesTitle || matchesContent;
  });

  // Sort sessions
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "date_newest") {
      const timeA = a.deletedAt ? new Date(a.deletedAt).getTime() : 0;
      const timeB = b.deletedAt ? new Date(b.deletedAt).getTime() : 0;
      return timeB - timeA;
    }
    if (sortBy === "date_oldest") {
      const timeA = a.deletedAt ? new Date(a.deletedAt).getTime() : 0;
      const timeB = b.deletedAt ? new Date(b.deletedAt).getTime() : 0;
      return timeA - timeB;
    }
    if (sortBy === "name_az") {
      return a.title.localeCompare(b.title);
    }
    if (sortBy === "messages_count") {
      const countA = a.messages?.length || 0;
      const countB = b.messages?.length || 0;
      return countB - countA;
    }
    return 0;
  });

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-[#0e1628] rounded-2xl border border-slate-100 dark:border-slate-800 shadow-3xs overflow-hidden max-w-4xl w-full mx-auto">
      {/* Header Panel */}
      <div className="p-4 sm:p-6 bg-white dark:bg-[#11192e] border-b border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div className="text-left space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-500 dark:text-rose-400 flex items-center justify-center border border-rose-100 dark:border-rose-900/30">
              <Trash2 className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
              Recently Deleted Chats
            </h2>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed max-w-xl">
            Deleted chats are retained here for <span className="font-bold text-[#C96A3D]">30 days</span>. After 30 days, they are permanently removed automatically. Guest chats are stored locally on your device.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          {deletedSessions.length > 0 && (
            <button
              onClick={() => setShowConfirmEmpty(true)}
              className="flex items-center gap-1.5 py-2 px-3.5 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950/40 border border-rose-100 dark:border-rose-900/40 text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Empty Bin</span>
            </button>
          )}
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-xl border border-slate-100 dark:border-slate-800 transition-colors cursor-pointer"
            title="Go Back to Active Chat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter and Sort Toolbar */}
      {deletedSessions.length > 0 && (
        <div className="px-4 sm:px-6 py-3 bg-slate-50 dark:bg-[#0c1222] border-b border-slate-100 dark:border-slate-850/60 flex flex-col sm:flex-row gap-3 items-center justify-between shrink-0">
          {/* Bulk Select All & Search */}
          <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto">
            {sorted.length > 0 && (
              <div className="flex items-center gap-2 border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-xl shadow-4xs">
                <input
                  type="checkbox"
                  id="select-all-trash"
                  checked={sorted.length > 0 && sorted.every(s => selectedIds.includes(s.id))}
                  onChange={() => {
                    const sortedIds = sorted.map(s => s.id);
                    const isAllSelected = sorted.length > 0 && sorted.every(s => selectedIds.includes(s.id));
                    if (isAllSelected) {
                      setSelectedIds(prev => prev.filter(id => !sortedIds.includes(id)));
                    } else {
                      setSelectedIds(prev => {
                        const otherSelected = prev.filter(id => !sortedIds.includes(id));
                        return [...otherSelected, ...sortedIds];
                      });
                    }
                  }}
                  className="w-4 h-4 rounded-md border-slate-300 dark:border-slate-850 text-[#C96A3D] focus:ring-[#C96A3D] cursor-pointer"
                />
                <label htmlFor="select-all-trash" className="text-xs font-bold text-slate-600 dark:text-slate-300 select-none cursor-pointer">
                  Select All ({sorted.length})
                </label>
              </div>
            )}

            <div className="relative w-full sm:w-64">
              <input
                type="text"
                placeholder="Search deleted chats..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs py-2 pl-8 pr-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-[#14213D] dark:text-white placeholder-slate-400 focus:border-[#C96A3D] outline-none transition-colors"
              />
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
            </div>
          </div>

          {/* Sort selection dropdown */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="text-xs py-2 px-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none text-slate-600 dark:text-slate-300 focus:border-[#C96A3D] cursor-pointer"
            >
              <option value="date_newest">Date Deleted (Newest)</option>
              <option value="date_oldest">Date Deleted (Oldest)</option>
              <option value="name_az">Name (A-Z)</option>
              <option value="messages_count">Messages Count</option>
            </select>
          </div>
        </div>
      )}

      {/* Main Container / Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 pb-28">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <div className="w-8 h-8 rounded-full border-2 border-slate-200 dark:border-slate-800 border-t-[#C96A3D] animate-spin" />
            <span className="text-xs text-slate-400 font-medium">Scanning trash database...</span>
          </div>
        ) : sorted.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AnimatePresence mode="popLayout">
              {sorted.map((session) => {
                const remainingDays = getRemainingDays(session.deletedAt, session.autoDeleteAt);
                const isChecked = selectedIds.includes(session.id);

                return (
                  <motion.div
                    key={session.id}
                    layout
                    initial={{ opacity: 0, y: 15, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className={`flex flex-col p-4 bg-white dark:bg-[#11192e] border rounded-2xl shadow-3xs hover:border-[#C96A3D]/20 transition-all relative group ${
                      isChecked
                        ? "border-[#C96A3D] ring-1 ring-[#C96A3D]/10 bg-amber-500/[0.01] dark:bg-amber-500/[0.02]"
                        : "border-slate-150 dark:border-slate-800/80"
                    }`}
                  >
                    {/* Days indicator tag */}
                    <div className={`absolute top-4 right-4 flex items-center gap-1 border px-2 py-1 rounded-lg text-[10px] font-bold font-mono transition-colors ${getBadgeStyles(remainingDays).badge}`}>
                      <Clock className={`w-3 h-3 ${getBadgeStyles(remainingDays).icon}`} />
                      <span>{remainingDays} {remainingDays === 1 ? "day" : "days"} left</span>
                    </div>

                    <div className="flex items-start gap-2.5 flex-1 text-left">
                      {/* Checkbox */}
                      <div className="pt-1.5 shrink-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            setSelectedIds(prev =>
                              prev.includes(session.id)
                                ? prev.filter(id => id !== session.id)
                                : [...prev, session.id]
                            );
                          }}
                          className="w-4 h-4 rounded-md border-slate-300 dark:border-slate-800 text-[#C96A3D] focus:ring-[#C96A3D] cursor-pointer"
                        />
                      </div>

                      <div className="space-y-3.5 flex-1 min-w-0">
                        {/* Title */}
                        <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-100 truncate pr-24" title={session.title}>
                          {session.title}
                        </h3>

                        {/* Info logs */}
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-400 font-mono font-medium">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            Deleted: {formatDeletedDate(session.deletedAt)}
                          </span>
                          <span className="flex items-center gap-1">
                            <MessageSquare className="w-3 h-3 text-slate-400" />
                            {session.messages?.length || 0} messages
                          </span>
                        </div>

                        {/* Conversational snippets of last 2-3 messages */}
                        <div className="space-y-1.5 pt-2 border-t border-slate-100/50 dark:border-slate-800/45">
                          <div className="text-[9.5px] uppercase tracking-wider text-slate-450 dark:text-slate-400 font-bold flex items-center gap-1">
                            <MessageSquare className="w-3 h-3 text-[#C96A3D]" />
                            <span>Last 2-3 Messages:</span>
                          </div>
                          
                          <div className="space-y-1.5 bg-slate-50/50 dark:bg-slate-900/30 p-2.5 rounded-xl border border-slate-100 dark:border-slate-850/40 text-left max-h-36 overflow-y-auto scrollbar-none">
                            {session.messages && session.messages.length > 0 ? (
                              session.messages.slice(-3).map((msg, idx) => (
                                <div key={msg.id || idx} className="text-[11px] leading-relaxed border-b border-slate-100/30 dark:border-slate-800/20 last:border-0 pb-1.5 last:pb-0">
                                  <span className={`font-extrabold mr-1 ${msg.role === 'user' ? 'text-[#C96A3D]' : 'text-indigo-500 dark:text-indigo-400'}`}>
                                    {msg.role === 'user' ? 'You:' : 'AI:'}
                                  </span>
                                  <span className="text-slate-650 dark:text-slate-300 font-normal">
                                    {msg.content.substring(0, 90)}{msg.content.length > 90 ? "..." : ""}
                                  </span>
                                </div>
                              ))
                            ) : (
                              <span className="text-[11px] text-slate-450 dark:text-slate-400 italic">No messages in this chat session.</span>
                            )}
                          </div>
                        </div>

                        {/* AI Smart Summary toggle/indicator */}
                        <div className="space-y-1">
                          {summaries[session.id] ? (
                            <motion.div 
                              initial={{ opacity: 0, y: -5 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="bg-[#C96A3D]/5 dark:bg-[#C96A3D]/10 border border-[#C96A3D]/15 p-2.5 rounded-xl"
                            >
                              <div className="flex items-center gap-1 text-[9.5px] font-bold text-[#C96A3D] uppercase tracking-wider mb-1">
                                <Sparkles className="w-3 h-3 text-[#C96A3D]" />
                                <span>Smart AI Summary</span>
                              </div>
                              {summaries[session.id].loading ? (
                                <div className="flex items-center gap-2 py-1 text-[11px] text-[#C96A3D] font-medium">
                                  <div className="w-3 h-3 rounded-full border border-t-[#C96A3D] border-[#C96A3D]/25 animate-spin" />
                                  <span className="animate-pulse">Analyzing logs & summarizing...</span>
                                </div>
                              ) : (
                                <p className="text-[11px] text-slate-700 dark:text-slate-200 leading-relaxed font-medium">
                                  {summaries[session.id].text}
                                </p>
                              )}
                            </motion.div>
                          ) : (
                            <button
                              onClick={() => generateSmartSummary(session.id, session.title, session.messages || [])}
                              className="flex items-center gap-1.5 py-1 px-2.5 rounded-lg text-[9.5px] font-bold bg-slate-100 hover:bg-[#C96A3D]/10 dark:bg-slate-900/60 dark:hover:bg-[#C96A3D]/15 text-slate-500 hover:text-[#C96A3D] dark:text-slate-400 border border-slate-200 dark:border-slate-800 transition-colors cursor-pointer"
                            >
                              <Sparkles className="w-3 h-3 text-[#C96A3D]" />
                              <span>Generate AI Summary</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-850/60 mt-4 pt-3 gap-3">
                      <button
                        onClick={() => onRestore(session.id)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold text-slate-650 dark:text-slate-350 hover:text-[#C96A3D] dark:hover:text-[#C96A3D] bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-850 border border-slate-200 dark:border-slate-800/80 rounded-xl cursor-pointer transition-all active:scale-98"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Restore Chat</span>
                      </button>

                      <button
                        onClick={() => setConfirmDeleteId(session.id)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold text-rose-500 hover:text-white hover:bg-rose-500 border border-rose-200 dark:border-rose-950/40 hover:border-transparent rounded-xl cursor-pointer transition-all active:scale-98"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete Forever</span>
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        ) : (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-20 max-w-md mx-auto text-center space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-850 text-slate-350 dark:text-slate-500 flex items-center justify-center">
              <FolderOpen className="w-8 h-8" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                Recycle Bin is Empty
              </h3>
              <p className="text-xs text-slate-450 leading-relaxed font-normal">
                {searchQuery
                  ? "No deleted chats match your search query."
                  : "Chats you delete will be kept here for 30 days before they're gone forever."}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Floating Bulk Action Bar */}
      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center justify-between gap-6 px-6 py-4 bg-white dark:bg-[#11192e] border border-[#C96A3D]/30 dark:border-[#C96A3D]/30 shadow-2xl rounded-2xl w-[90%] max-w-lg"
          >
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={sorted.length > 0 && sorted.every(s => selectedIds.includes(s.id))}
                onChange={() => {
                  const sortedIds = sorted.map(s => s.id);
                  const isAllSelected = sorted.length > 0 && sorted.every(s => selectedIds.includes(s.id));
                  if (isAllSelected) {
                    setSelectedIds(prev => prev.filter(id => !sortedIds.includes(id)));
                  } else {
                    setSelectedIds(prev => {
                      const otherSelected = prev.filter(id => !sortedIds.includes(id));
                      return [...otherSelected, ...sortedIds];
                    });
                  }
                }}
                className="w-4 h-4 rounded-md border-slate-300 dark:border-slate-800 text-[#C96A3D] focus:ring-[#C96A3D] cursor-pointer"
              />
              <div className="text-left">
                <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                  {selectedIds.length} {selectedIds.length === 1 ? "chat" : "chats"} selected
                </span>
                <p className="text-[10px] text-slate-400">
                  Select a multi-chat operation
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowConfirmBulkRestore(true)}
                className="flex items-center gap-1.5 py-2 px-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-650 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/40 text-xs font-bold rounded-xl transition-all active:scale-95 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restore</span>
              </button>

              <button
                onClick={() => setShowConfirmBulkDelete(true)}
                className="flex items-center gap-1.5 py-2 px-3 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950/40 border border-rose-100 dark:border-rose-900/40 text-xs font-bold rounded-xl transition-all active:scale-95 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals & Dialogs overlays */}
      <AnimatePresence>
        {/* Empty All Confirmation Modal */}
        {showConfirmEmpty && (
          <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-sm p-6 bg-white dark:bg-[#11192e] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl space-y-4"
            >
              <div className="flex flex-col items-center text-center space-y-2">
                <div className="w-12 h-12 bg-rose-50 dark:bg-rose-950/30 text-rose-500 rounded-full flex items-center justify-center border border-rose-100 dark:border-rose-900/30">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Empty Recently Deleted Chats?
                </h3>
                <p className="text-xs text-slate-450 max-w-xs leading-relaxed font-normal">
                  Are you absolutely sure you want to permanently delete all {deletedSessions.length} chats in the recycle bin? This action cannot be undone.
                </p>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmEmpty(false)}
                  className="flex-1 py-2.5 text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-850 border border-slate-150 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer transition-all active:scale-98"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    triggerEmptyAllWithAnimation();
                  }}
                  className="flex-1 py-2.5 text-xs font-bold text-white bg-rose-500 hover:bg-rose-600 rounded-xl shadow-md transition-all active:scale-98 cursor-pointer"
                >
                  Empty All
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Delete Forever Single Confirmation Modal */}
        {confirmDeleteId && (
          <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-sm p-6 bg-white dark:bg-[#11192e] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl space-y-4"
            >
              <div className="flex flex-col items-center text-center space-y-2">
                <div className="w-12 h-12 bg-rose-50 dark:bg-rose-950/30 text-rose-500 rounded-full flex items-center justify-center border border-rose-100 dark:border-rose-900/30">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Permanently Delete Chat?
                </h3>
                <p className="text-xs text-slate-450 max-w-xs leading-relaxed font-normal">
                  Are you sure you want to delete this chat forever? All messages, files, and analysis reports will be permanently lost. This action is irreversible.
                </p>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(null)}
                  className="flex-1 py-2.5 text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-850 border border-slate-150 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer transition-all active:scale-98"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDeleteForever(confirmDeleteId);
                    setConfirmDeleteId(null);
                  }}
                  className="flex-1 py-2.5 text-xs font-bold text-white bg-rose-500 hover:bg-rose-600 rounded-xl shadow-md transition-all active:scale-98 cursor-pointer"
                >
                  Delete Forever
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Bulk Delete Forever Confirmation Modal */}
        {showConfirmBulkDelete && (
          <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-sm p-6 bg-white dark:bg-[#11192e] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl space-y-4"
            >
              <div className="flex flex-col items-center text-center space-y-2">
                <div className="w-12 h-12 bg-rose-50 dark:bg-rose-950/30 text-rose-500 rounded-full flex items-center justify-center border border-rose-100 dark:border-rose-900/30">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Permanently Delete Selected Chats?
                </h3>
                <p className="text-xs text-slate-450 max-w-xs leading-relaxed font-normal">
                  Are you sure you want to permanently delete the {selectedIds.length} selected chats? All conversation logs, documents, and references will be gone forever. This is irreversible.
                </p>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmBulkDelete(false)}
                  className="flex-1 py-2.5 text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-850 border border-slate-150 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer transition-all active:scale-98"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={triggerBulkDeleteWithAnimation}
                  className="flex-1 py-2.5 text-xs font-bold text-white bg-rose-500 hover:bg-rose-600 rounded-xl shadow-md transition-all active:scale-98 cursor-pointer"
                >
                  Delete Selected
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Bulk Restore Confirmation Modal */}
        {showConfirmBulkRestore && (
          <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-sm p-6 bg-white dark:bg-[#11192e] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl space-y-4"
            >
              <div className="flex flex-col items-center text-center space-y-2">
                <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-500 rounded-full flex items-center justify-center border border-emerald-100 dark:border-emerald-900/30">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Restore Selected Chats?
                </h3>
                <p className="text-xs text-slate-450 max-w-xs leading-relaxed font-normal">
                  Are you sure you want to restore the {selectedIds.length} selected chats to your active dashboard?
                </p>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmBulkRestore(false)}
                  className="flex-1 py-2.5 text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-850 border border-slate-150 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer transition-all active:scale-98"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={triggerBulkRestoreWithAnimation}
                  className="flex-1 py-2.5 text-xs font-bold text-white bg-emerald-500 hover:bg-emerald-650 rounded-xl shadow-md transition-all active:scale-98 cursor-pointer"
                >
                  Restore Selected
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Shredding & Restoring Progress Animation Overlay */}
        {shreddingState.isActive && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full max-w-md p-8 bg-white dark:bg-[#11192e] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl text-center space-y-6"
            >
              {/* Animation Header */}
              <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
                {/* Pulsing rings */}
                <span className="absolute inset-0 rounded-full bg-rose-500/10 dark:bg-rose-500/20 animate-ping" />
                
                {/* Shredding icon container */}
                <div className="relative z-10 w-16 h-16 rounded-2xl bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-500/25">
                  {shreddingState.actionType === "bulk_restore" ? (
                    <RotateCcw className="w-8 h-8 animate-spin" style={{ animationDuration: "3s" }} />
                  ) : (
                    <Trash2 className="w-8 h-8 animate-bounce" />
                  )}
                </div>
              </div>

              {/* Text descriptions */}
              <div className="space-y-2">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  {shreddingState.actionType === "bulk_restore" 
                    ? `Restoring ${shreddingState.totalCount} Selected Chats`
                    : shreddingState.actionType === "bulk_delete"
                    ? `Permanently Shredding ${shreddingState.totalCount} Chats`
                    : `Disintegrating Recycle Bin (${shreddingState.totalCount} Chats)`
                  }
                </h3>
                
                {/* Phase labels */}
                <p className="text-xs text-slate-450 dark:text-slate-400 font-mono">
                  {shreddingState.actionType === "bulk_restore" ? (
                    shreddingState.progress < 30 ? "Locating catalog headers..." :
                    shreddingState.progress < 60 ? "Re-linking active session node..." :
                    shreddingState.progress < 90 ? "Re-indexing message timelines..." :
                    "Completing chat restoration..."
                  ) : (
                    shreddingState.progress < 25 ? "Initiating secure zero-fill scan..." :
                    shreddingState.progress < 50 ? "Shredding conversation indexes..." :
                    shreddingState.progress < 75 ? "Purging associated attachments..." :
                    "Finalizing database record wipe..."
                  )}
                </p>
              </div>

              {/* Progress Bar Container */}
              <div className="space-y-2">
                <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-800/80 rounded-full overflow-hidden relative border border-slate-150 dark:border-slate-850">
                  <motion.div 
                    className="h-full bg-gradient-to-r from-rose-500 via-[#C96A3D] to-amber-500 rounded-full"
                    style={{ width: `${shreddingState.progress}%` }}
                    transition={{ ease: "easeInOut" }}
                  />
                </div>
                <div className="flex justify-between items-center text-[10px] font-mono text-slate-400">
                  <span>Progress</span>
                  <span className="font-bold text-[#C96A3D]">{shreddingState.progress}%</span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
