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
import { ChatSession, UserProfile } from "../types";

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
          {/* Search bar */}
          <div className="relative w-full sm:max-w-xs">
            <input
              type="text"
              placeholder="Search deleted chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs py-2 pl-8 pr-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-[#14213D] dark:text-white placeholder-slate-400 focus:border-[#C96A3D] outline-none transition-colors"
            />
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
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
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
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
                const hasMessages = session.messages && session.messages.length > 0;
                // Get the last message preview
                const lastMsg = hasMessages ? session.messages[session.messages.length - 1] : null;
                const previewText = lastMsg
                  ? lastMsg.content.substring(0, 120) + (lastMsg.content.length > 120 ? "..." : "")
                  : "No messages in this chat session.";

                return (
                  <motion.div
                    key={session.id}
                    layout
                    initial={{ opacity: 0, y: 15, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="flex flex-col p-4 bg-white dark:bg-[#11192e] border border-slate-150 dark:border-slate-800/80 rounded-2xl shadow-3xs hover:border-[#C96A3D]/25 dark:hover:border-[#C96A3D]/25 transition-all relative group"
                  >
                    {/* Days indicator tag */}
                    <div className="absolute top-4 right-4 flex items-center gap-1 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-850 px-2 py-1 rounded-lg text-[10px] font-bold text-slate-500 dark:text-slate-400 font-mono">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>{remainingDays} {remainingDays === 1 ? "day" : "days"} left</span>
                    </div>

                    <div className="text-left space-y-3 flex-1">
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

                      {/* Content Preview */}
                      <p className="text-[11.5px] text-slate-450 dark:text-slate-400 leading-relaxed font-normal bg-slate-50/50 dark:bg-slate-900/30 p-2.5 rounded-xl border border-slate-100 dark:border-slate-850/40 line-clamp-2 min-h-[50px]">
                        {previewText}
                      </p>
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
                    onEmptyAll();
                    setShowConfirmEmpty(false);
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
      </AnimatePresence>
    </div>
  );
}
