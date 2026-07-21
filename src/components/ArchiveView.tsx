import React, { useState } from "react";
import {
  Archive,
  RotateCcw,
  Search,
  MessageSquare,
  Clock,
  Trash2,
  X,
  Sparkles,
  ArrowRight
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ChatSession, UserProfile } from "../types";

interface ArchiveViewProps {
  user: UserProfile;
  archivedSessions: ChatSession[];
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  onSelectSession: (id: string) => void;
}

export function ArchiveView({
  user,
  archivedSessions,
  onRestore,
  onDelete,
  onClose,
  onSelectSession,
}: ArchiveViewProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = archivedSessions.filter((s) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    return (
      s.title.toLowerCase().includes(query) ||
      s.mode.toLowerCase().includes(query)
    );
  });

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-50/40 dark:bg-slate-950/20 p-4 md:p-6 overflow-hidden">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-slate-200/60 dark:border-slate-800/60 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500">
            <Archive className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span>Archived Conversations</span>
              <span className="text-[10px] bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-full font-mono font-bold">
                {archivedSessions.length} total
              </span>
            </h2>
            <p className="text-[11px] text-slate-400 font-bold mt-0.5">
              Access conversations you've archived to keep your active workspace uncluttered.
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="self-start sm:self-center px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-550 dark:text-slate-300 text-xs font-black uppercase tracking-wider rounded-xl cursor-pointer transition-all active:scale-95 flex items-center gap-1.5"
        >
          <X className="w-4 h-4" />
          <span>Back to Chat</span>
        </button>
      </div>

      {/* Toolbar */}
      <div className="my-4 flex items-center gap-3 shrink-0">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Search archived conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs py-2.5 pl-9 pr-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11192e] focus:border-[#C96A3D] dark:focus:border-[#C96A3D] outline-none text-[#14213D] dark:text-white transition-all font-medium h-10"
          />
          <Search className="absolute left-3 top-3.5 text-slate-400 w-4 h-4" />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-3 text-xs font-bold text-slate-400 hover:text-slate-650"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Main Grid View */}
      <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin">
        <AnimatePresence mode="popLayout">
          {filtered.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed border-slate-150 dark:border-slate-850 rounded-3xl p-8"
            >
              <div className="w-16 h-16 rounded-2xl bg-slate-50 dark:bg-slate-900/40 flex items-center justify-center mb-4">
                <Archive className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                {searchQuery ? "No matching conversations found" : "No archived conversations"}
              </h3>
              <p className="text-xs text-slate-400 font-bold mt-1 max-w-xs leading-relaxed">
                {searchQuery
                  ? "Try adjusting your keywords or clearing the search filter."
                  : "Conversations you archive will appear here. You can restore them anytime."}
              </p>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filtered.map((session) => (
                <motion.div
                  key={session.id}
                  layoutId={`archive-${session.id}`}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-[#11192e] shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between gap-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                        <h4 className="text-xs font-black text-slate-800 dark:text-white truncate" title={session.title}>
                          {session.title}
                        </h4>
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 capitalize shrink-0">
                        {session.mode}
                      </span>
                    </div>

                    <p className="text-[10px] text-slate-400 font-bold mt-1.5 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 shrink-0 text-slate-350" />
                      <span>Updated: {new Date(session.updatedAt).toLocaleDateString()}</span>
                      <span className="text-slate-300 dark:text-slate-750">•</span>
                      <MessageSquare className="w-3.5 h-3.5 shrink-0 text-slate-350" />
                      <span>{session.messages.length} messages</span>
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-850 gap-2">
                    <button
                      onClick={() => onSelectSession(session.id)}
                      className="text-[10.5px] font-black text-slate-500 hover:text-slate-850 dark:text-slate-400 dark:hover:text-slate-100 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <span>Open Read-Only</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onRestore(session.id)}
                        className="p-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl cursor-pointer transition-colors flex items-center gap-1 text-[10px] font-bold"
                        title="Restore Chat"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Restore</span>
                      </button>
                      <button
                        onClick={() => onDelete(session.id)}
                        className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl cursor-pointer transition-colors flex items-center gap-1 text-[10px] font-bold"
                        title="Delete Chat"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
