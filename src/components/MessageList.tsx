/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Copy,
  Check,
  Share2,
  Bookmark,
  RefreshCw,
  Edit2,
  Globe2,
  Download,
  AlertCircle,
  Clock,
  Sparkles,
  Link,
  Bot,
  User,
  Smile,
  MoreVertical,
  ThumbsUp,
  ThumbsDown,
  Volume2,
  VolumeX,
  Trash2,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { Message, GroundingSource, NexaEngineId } from "../types";
import { EngineBadge } from "./EngineBadge";
import { FactCheckWidget } from "./FactCheckWidget";
import { DeepResearchReport } from "./DeepResearchReport";
import { QuizGeneratorCenter } from "./QuizGeneratorCenter";

interface MessageListProps {
  messages: Message[];
  activeEngine: string;
  onAction: (
    action: "copy" | "share" | "bookmark" | "regenerate" | "translate" | "export" | "delete",
    msgId: string
  ) => void;
  onEditPrompt: (msgId: string, newContent: string) => void;
  onReact?: (msgId: string, reaction: string | null) => void;
  isLoading?: boolean;
  onCompleteQuiz?: (score: number, total: number) => void;
  userName?: string;
  isFocusMode?: boolean;
  onToggleFocusMode?: () => void;
}

export function MessageList({
  messages,
  activeEngine,
  onAction,
  onEditPrompt,
  onReact,
  isLoading,
  onCompleteQuiz,
  userName,
  isFocusMode,
  onToggleFocusMode,
}: MessageListProps) {
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editPromptValue, setEditPromptValue] = useState("");
  const [showTranslatorId, setShowTranslatorId] = useState<string | null>(null);
  const [showReactionPickerId, setShowReactionPickerId] = useState<string | null>(null);
  const [showThumbsDownReasonsId, setShowThumbsDownReasonsId] = useState<string | null>(null);
  const [showMoreActionsId, setShowMoreActionsId] = useState<string | null>(null);
  const [feedbackToastId, setFeedbackToastId] = useState<string | null>(null);
  const [activeSpeechId, setActiveSpeechId] = useState<string | null>(null);

  // Auto-clear feedback toast after 3 seconds
  useEffect(() => {
    if (feedbackToastId) {
      const timer = setTimeout(() => {
        setFeedbackToastId(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [feedbackToastId]);

  // Cancel active speech on list change or unmounting
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [messages]);

  const handleToggleSpeech = (msgId: string, content: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      console.warn("Speech synthesis (TTS) is not supported or accessible on this browser.");
      return;
    }

    if (activeSpeechId === msgId) {
      window.speechSynthesis.cancel();
      setActiveSpeechId(null);
      return;
    }

    // Cancel currently speaking/queued utterances
    window.speechSynthesis.cancel();

    // Clean text of markdown characters, blocks etc for flawless natural reading
    const cleanSpeechText = content
      .replace(/\*\*|__/g, "") // Bold
      .replace(/\*|_/g, "") // Italic
      .replace(/`{3}[\s\S]*?`{3}/g, "[Code snippet omitted]") // Multi-line code
      .replace(/`[^`]+`/g, "") // Single-line code
      .replace(/#+\s+/g, "") // Headers
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1") // Links
      .replace(/>\s+/g, "") // Blockquotes
      .replace(/[-*+]\s+/g, "") // List points
      .replace(/\s+/g, " ") // Extra whitespace
      .trim();

    if (!cleanSpeechText) return;

    const utterance = new SpeechSynthesisUtterance(cleanSpeechText);
    const voices = window.speechSynthesis.getVoices();
    const optimalVoice = voices.find(
      (v) =>
        (v.lang.startsWith("en-") && v.name.toLowerCase().includes("natural")) ||
        (v.lang.startsWith("en-") && v.name.toLowerCase().includes("google")) ||
        v.lang.startsWith("en-")
    ) || voices[0];

    if (optimalVoice) {
      utterance.voice = optimalVoice;
    }

    utterance.onend = () => {
      setActiveSpeechId(null);
    };

    utterance.onerror = () => {
      setActiveSpeechId(null);
    };

    setActiveSpeechId(msgId);
    window.speechSynthesis.speak(utterance);
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopyingId(id);
    onAction("copy", id);
    setTimeout(() => setCopyingId(null), 1500);
  };

  const handleStartEdit = (msg: Message) => {
    setEditingMsgId(msg.id);
    setEditPromptValue(msg.content);
  };

  const handleSaveEdit = (id: string) => {
    if (editPromptValue.trim()) {
      onEditPrompt(id, editPromptValue);
    }
    setEditingMsgId(null);
  };

  const translationShortlist = [
    "English",
    "Hindi (हिन्दी)",
    "Hinglish",
    "Urdu (اردو)",
    "Tamil (தமிழ்)",
    "Telugu (తెలుగు)",
    "Gujarati (ગુજરાતી)",
  ];

  return (
    <div className="flex flex-col gap-6 w-full max-w-4xl mx-auto py-4 select-text" id="nexa-message-list">
      <AnimatePresence initial={false}>
        {messages.map((msg) => {
          const isModel = msg.role === "assistant";
          const isEditing = editingMsgId === msg.id;

          return (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{
                type: "spring",
                stiffness: 260,
                damping: 24,
                mass: 0.8
              }}
              className={
                isModel
                  ? "flex flex-col gap-2 py-5 border-b border-slate-100/50 dark:border-slate-800/30 transition-all duration-300 relative w-full last:border-b-0 self-start text-left"
                  : "flex flex-col gap-2 py-3 transition-all duration-300 relative w-full max-w-[92%] md:max-w-[82%] self-end text-left my-1"
              }
              id={`m-card-${msg.id}`}
            >
            {/* Header: Role Title + Engine badges */}
            <div className="flex justify-between items-center select-none mb-1">
              <div className="flex items-center gap-2.5">
                {isModel ? (
                  <div className="w-8 h-8 flex items-center justify-center shrink-0">
                    <img
                      src="https://i.ibb.co/LdwTKxL5/Nexa-App.png"
                      alt="Nexa-App"
                      className="w-7 h-7 object-contain select-none"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ) : (
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border border-[#14213D] shadow-2xs bg-[#14213D] text-white"
                  >
                    <User className="w-4 h-4" />
                  </div>
                )}
                <div>
                  <h5 className="text-xs font-black text-[#14213D] dark:text-white capitalize leading-tight">
                    {isModel ? "Nexa Intelligence" : (userName || "User Account")}
                  </h5>
                  <div className="flex items-center gap-1 mt-0.5 text-[9px] text-slate-400 font-semibold font-mono">
                    <Clock className="w-3 h-3 shrink-0" />
                    <span>{msg.timestamp}</span>
                  </div>
                </div>
              </div>

              {/* Engine Badge Routing + Dedicated Copy Button + User Edit Actions */}
              <div className="flex items-center gap-2" />
            </div>

            {/* Prompt editing container with enhanced controls */}
            {!isModel && isEditing ? (
              <div className="space-y-2 mt-2 leading-none w-full" id={`nexa-edit-container-${msg.id}`}>
                <div className="flex justify-between items-center text-[10px] text-slate-400 select-none">
                  <span className="font-semibold text-slate-500 dark:text-slate-400">Editing Message Prompt</span>
                  <span className="font-mono text-[9px] opacity-80">Press Enter to submit, Shift+Enter for new line</span>
                </div>
                <textarea
                  value={editPromptValue}
                  onChange={(e) => setEditPromptValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSaveEdit(msg.id);
                    }
                  }}
                  rows={3}
                  className="w-full text-xs p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:border-[#C96A3D] focus:ring-2 focus:ring-[#C96A3D]/10 outline-none text-[#14213D] dark:text-white transition-all shadow-inner"
                  placeholder="Enter your new prompt here to re-trigger the query..."
                  autoFocus
                />
                <div className="flex gap-2 justify-end items-center pt-1 select-none">
                  <button
                    onClick={() => setEditingMsgId(null)}
                    className="px-3 py-1.5 text-[10px] font-bold rounded-lg border border-slate-150 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-550 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleSaveEdit(msg.id)}
                    className="px-4 py-1.5 text-[10px] font-extrabold bg-[#C96A3D] hover:bg-[#b0582e] text-white rounded-lg transition-colors flex items-center gap-1 cursor-pointer shadow-3xs"
                  >
                    <span>Resubmit Prompt</span>
                  </button>
                </div>
              </div>
            ) : isModel ? (
              // Message Text Body Content (Model: standard flow)
              <div className="space-y-4 text-xs font-normal text-slate-650 dark:text-slate-200 mt-2 text-left leading-relaxed">
                {/* 1. Attachment preview card */}
                {msg.attachment && (
                  <div className="inline-flex items-center gap-2.5 p-3.5 bg-slate-100/50 dark:bg-slate-900 border border-slate-150/10 rounded-2xl max-w-xs mb-2">
                    <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shrink-0">
                      <Link className="w-4 h-4 text-[#C96A3D]" />
                    </div>
                    <div className="text-left select-none min-w-0">
                      <h6 className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate max-w-[150px]">
                        {msg.attachment.name}
                      </h6>
                      <span className="text-[9px] font-mono font-bold text-slate-400 bg-slate-50 dark:bg-slate-800 px-1 py-0.5 rounded-sm capitalize">
                        {msg.attachment.type} ({msg.attachment.size})
                      </span>
                    </div>
                  </div>
                )}

                {/* 2. Structured Quiz custom view */}
                {msg.quiz && (
                  <QuizGeneratorCenter quiz={msg.quiz} onRestart={() => {}} onCompleteQuiz={onCompleteQuiz} />
                )}

                {/* 3. Structured Fact Check custom view */}
                {msg.factCheck && <FactCheckWidget details={msg.factCheck} />}

                {/* 4. Structured Deep Research custom view */}
                {msg.researchReport && (
                  <DeepResearchReport
                    report={msg.researchReport}
                    onExport={() => onAction("export", msg.id)}
                  />
                )}

                {/* 5. Custom parsed text body (supports bolding headers bullet checks etc.) */}
                {!msg.quiz && !msg.factCheck && !msg.researchReport && (
                  <div className="space-y-3 prose prose-sm max-w-none dark:prose-invert" id="nexa-rich-text-container">
                    {parseCustomMarkdown(msg.content)}
                  </div>
                )}
              </div>
            ) : (
              // USER MESSAGE BOX (for user messages - inside a distinct premium box bubble)
              <div className="bg-slate-100 dark:bg-[#1a243a] text-slate-700 dark:text-slate-100 px-5 py-4 rounded-2xl rounded-tr-none border border-slate-200/55 dark:border-slate-800/80 shadow-xs mt-2 relative w-full self-end leading-relaxed" id={`user-msg-box-${msg.id}`}>
                <div className="space-y-4 text-xs font-normal">
                  {/* Attachment if present in box */}
                  {msg.attachment && (
                    <div className="inline-flex items-center gap-2.5 p-2.5 bg-white/70 dark:bg-slate-900 border border-slate-200/10 rounded-xl max-w-xs mb-2">
                      <div className="p-1.5 bg-[#C96A3D]/10 dark:bg-[#C96A3D]/25 rounded-lg shrink-0">
                        <Link className="w-3.5 h-3.5 text-[#C96A3D]" />
                      </div>
                      <div className="text-left select-none min-w-0">
                        <h6 className="text-[11px] font-bold text-slate-700 dark:text-slate-200 truncate max-w-[140px]">
                          {msg.attachment.name}
                        </h6>
                        <span className="text-[8px] font-mono font-bold text-slate-400 bg-slate-50 dark:bg-slate-800 px-1 rounded-sm capitalize">
                          {msg.attachment.type}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="space-y-3 prose prose-sm max-w-none dark:prose-invert" id="nexa-rich-text-container">
                    {parseCustomMarkdown(msg.content)}
                  </div>
                </div>
              </div>
            )}

            {/* Citations/Grounding Sources bibliography if present */}
            {isModel && msg.sources && msg.sources.length > 0 && (
              <div className="border-t border-slate-150/10 dark:border-slate-805/30 pt-4 mt-4 text-left space-y-2 select-none">
                <h6 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 cursor-pointer">
                  <Globe2 className="w-3.5 h-3.5" /> Checked Citations Sources ({msg.sources.length})
                </h6>
                <div className="flex flex-wrap gap-2">
                  {msg.sources.map((src, idx) => (
                    <a
                      key={idx}
                      href={src.uri}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] text-indigo-500 hover:text-white bg-indigo-500/10 hover:bg-indigo-500 border border-indigo-500/15 rounded-xl transition-all font-medium"
                    >
                      <span className="font-bold shrink-0">{idx + 1}.</span>
                      <span className="truncate max-w-[160px]">{src.title}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Actions Row */}
            {isModel ? (
              <div className="flex flex-wrap items-center justify-between border-t border-slate-150/10 dark:border-slate-805/35 pt-3 mt-4 text-slate-400 select-none text-[11px]">
                {/* NEXA MESSAGE ACTIONS (only Copy, React & More Action) */}
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => handleCopy(msg.id, msg.content)}
                    className="flex items-center hover:text-[#C96A3D] cursor-pointer"
                    title="Copy to Clipboard"
                  >
                    {copyingId === msg.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>

                  <button
                    onClick={() => handleToggleSpeech(msg.id, msg.content)}
                    className={`flex items-center hover:text-[#C96A3D] cursor-pointer transition-all ${
                      activeSpeechId === msg.id ? "text-[#C96A3D]" : ""
                    }`}
                    title={activeSpeechId === msg.id ? "Stop voice playback" : "Read response aloud"}
                  >
                    {activeSpeechId === msg.id ? (
                      <VolumeX className="w-3.5 h-3.5 text-[#C96A3D] animate-pulse" />
                    ) : (
                      <Volume2 className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {/* Thumbs Up Button */}
                  <button
                    onClick={() => {
                      const isActivating = msg.reaction !== "👍";
                      if (onReact) {
                        onReact(msg.id, isActivating ? "👍" : null);
                      }
                      setShowThumbsDownReasonsId(null);
                    }}
                    className={`flex items-center justify-center p-1.5 hover:text-emerald-500 cursor-pointer transition-all duration-200 ${
                      msg.reaction === "👍"
                        ? "text-emerald-500 scale-110"
                        : "text-slate-400 hover:scale-105"
                    }`}
                    title="Correct / Helpful response"
                    id={`thumbs-up-btn-${msg.id}`}
                  >
                    <ThumbsUp className="w-4 h-4" />
                  </button>

                  {/* Thumbs Down Button */}
                  <div className="relative flex items-center">
                    <button
                      onClick={() => {
                        setShowThumbsDownReasonsId(showThumbsDownReasonsId === msg.id ? null : msg.id);
                      }}
                      className={`flex items-center justify-center p-1.5 hover:text-rose-500 cursor-pointer transition-all duration-200 ${
                        msg.reaction && msg.reaction.startsWith("👎")
                          ? "text-rose-500 scale-110"
                          : "text-slate-400 hover:scale-105"
                      }`}
                      title="Incorrect / Unhelpful response"
                      id={`thumbs-down-btn-${msg.id}`}
                    >
                      <ThumbsDown className="w-4 h-4" />
                    </button>

                    {/* Thumbs Down Reasons Dialog */}
                    <AnimatePresence>
                      {showThumbsDownReasonsId === msg.id && (
                        <>
                          <div
                            className="fixed inset-0 z-40 bg-transparent cursor-default"
                            onClick={() => setShowThumbsDownReasonsId(null)}
                          />
                          <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 10 }}
                            transition={{ duration: 0.15, ease: "easeOut" }}
                            className="absolute bottom-7 left-0 z-50 min-w-[210px] flex flex-col gap-1 p-2 bg-white dark:bg-[#121c33] border border-slate-200 dark:border-slate-850 rounded-2xl shadow-xl text-left"
                            id={`thumbs-down-reasons-${msg.id}`}
                          >
                            <div className="px-2 py-1 text-[9px] uppercase font-black text-slate-400 dark:text-slate-505 tracking-wider mb-1">
                              Why thumbs down?
                            </div>
                            {[
                              "Inaccurate Information",
                              "Irrelevant Response",
                              "Poor Formatting or Hard to Read",
                            ].map((reason) => (
                              <button
                                key={reason}
                                type="button"
                                onClick={() => {
                                  if (onReact) {
                                    onReact(msg.id, `👎: ${reason}`);
                                  }
                                  setShowThumbsDownReasonsId(null);
                                }}
                                className="px-2.5 py-1.5 w-full hover:bg-rose-500/5 dark:hover:bg-rose-500/10 hover:text-[#C96A3D] text-slate-600 dark:text-slate-300 rounded-xl cursor-pointer text-left text-[11px] font-semibold transition-colors"
                              >
                                {reason}
                              </button>
                            ))}
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>

                  {msg.reaction && msg.reaction !== "👍" && (
                    <motion.button
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      onClick={() => {
                        if (onReact) onReact(msg.id, null);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#C96A3D]/10 hover:bg-[#C96A3D]/20 text-[#C96A3D] border border-[#C96A3D]/25 hover:border-[#C96A3D]/40 transition-all cursor-pointer font-bold text-[10px]"
                      title="Click to remove your feedback"
                    >
                      <span className="text-[11px]">{msg.reaction.startsWith("👎") ? "👎" : "👍"}</span>
                      <span>{msg.reaction.startsWith("👎") ? msg.reaction.replace("👎:", "Feedback:").trim() : "Correct"}</span>
                      <span className="text-[8px] opacity-60 ml-0.5">✕</span>
                    </motion.button>
                  )}

                  {/* More Action 3-dots dropdown */}
                  <div className="relative flex items-center">
                    <button
                      onClick={() => setShowMoreActionsId(showMoreActionsId === msg.id ? null : msg.id)}
                      className={`flex items-center gap-1.5 cursor-pointer hover:text-[#C96A3D] transition-colors ${
                        showMoreActionsId === msg.id ? "text-[#C96A3D]" : ""
                      }`}
                      title="More action"
                      id={`more-actions-btn-${msg.id}`}
                    >
                      <MoreVertical className="w-4 h-4 text-slate-400 group-hover:text-[#C96A3D]" />
                      <span className="font-medium">more action</span>
                    </button>

                    <AnimatePresence>
                      {showMoreActionsId === msg.id && (
                        <>
                          <div
                            className="fixed inset-0 z-40 bg-transparent cursor-default"
                            onClick={() => setShowMoreActionsId(null)}
                          />
                          <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 10 }}
                            transition={{ duration: 0.15, ease: "easeOut" }}
                            className="absolute bottom-7 left-0 z-50 min-w-[130px] flex flex-col gap-1 p-1.5 bg-white dark:bg-[#121c33] border border-slate-200 dark:border-slate-850 rounded-2xl shadow-xl text-left"
                            id={`more-actions-menu-${msg.id}`}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                onAction("share", msg.id);
                                setShowMoreActionsId(null);
                              }}
                              className="flex items-center gap-2 px-2.5 py-1.5 w-full hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-300 hover:text-[#C96A3D] dark:hover:text-[#C96A3D] cursor-pointer text-left font-medium transition-colors"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                              <span>Share</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setShowTranslatorId(showTranslatorId === msg.id ? null : msg.id);
                                setShowMoreActionsId(null);
                              }}
                              className="flex items-center gap-2 px-2.5 py-1.5 w-full hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl cursor-pointer text-left font-medium text-slate-600 dark:text-slate-300 hover:text-[#C96A3D] transition-colors"
                            >
                              <Globe2 className="w-3.5 h-3.5" />
                              <span>Translate</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                onAction("regenerate", msg.id);
                                setShowMoreActionsId(null);
                              }}
                              className="flex items-center gap-2 px-2.5 py-1.5 w-full hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-300 hover:text-[#C96A3D] dark:hover:text-[#C96A3D] cursor-pointer text-left font-medium transition-colors"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              <span>Regenerate</span>
                            </button>

                            {onToggleFocusMode && (
                              <button
                                type="button"
                                onClick={() => {
                                  onToggleFocusMode();
                                  setShowMoreActionsId(null);
                                }}
                                className="flex items-center gap-2 px-2.5 py-1.5 w-full hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-300 hover:text-[#C96A3D] dark:hover:text-[#C96A3D] cursor-pointer text-left font-medium transition-colors"
                              >
                                {isFocusMode ? (
                                  <>
                                    <Minimize2 className="w-3.5 h-3.5 text-[#C96A3D]" />
                                    <span>Exit Focus</span>
                                  </>
                                ) : (
                                  <>
                                    <Maximize2 className="w-3.5 h-3.5 text-slate-500" />
                                    <span>Focus Mode</span>
                                  </>
                                )}
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                if (confirm("Kyu aap is message ko remove karna chahte hain?")) {
                                  onAction("delete", msg.id);
                                }
                                setShowMoreActionsId(null);
                              }}
                              className="flex items-center gap-2 px-2.5 py-1.5 w-full hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl text-rose-600 dark:text-rose-450 hover:text-rose-700 dark:hover:text-rose-400 cursor-pointer text-left font-medium transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                              <span>Remove</span>
                            </button>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            ) : (
              // USER MESSAGE ACTIONS (completely outside of user message box/bubble)
              !isEditing && (
                <div className="flex items-center justify-end gap-3.5 mt-1.5 text-slate-400 select-none text-[10px]">
                  <button
                    onClick={() => handleCopy(msg.id, msg.content)}
                    className="flex items-center gap-1 hover:text-[#C96A3D] cursor-pointer transition-colors px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/40 font-bold"
                    title="Copy to Clipboard"
                  >
                    {copyingId === msg.id ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-500" />
                        <span className="text-emerald-500">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => onAction("share", msg.id)}
                    className="flex items-center gap-1 hover:text-[#C96A3D] cursor-pointer transition-colors px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/40 font-bold"
                    title="Share message"
                  >
                    <Share2 className="w-3 h-3" />
                    <span>Share</span>
                  </button>

                  <button
                    onClick={() => handleStartEdit(msg)}
                    className="flex items-center gap-1 hover:text-[#C96A3D] cursor-pointer transition-colors px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/40 font-bold"
                    title="Edit Prompt"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>Edit</span>
                  </button>

                  <button
                    onClick={() => {
                      if (confirm("Kya aap is prompt ko remove karna chahte hain?")) {
                        onAction("delete", msg.id);
                      }
                    }}
                    className="flex items-center gap-1 hover:text-rose-500 text-slate-400 cursor-pointer transition-colors px-2 py-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/20 font-bold"
                    title="Remove Message"
                  >
                    <Trash2 className="w-3 h-3 text-rose-500/80" />
                    <span>Remove</span>
                  </button>
                </div>
              )
            )}

            {/* Translation Selection drawer */}
            {isModel && showTranslatorId === msg.id && (
              <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl select-none animate-fadeIn text-left space-y-2">
                <h6 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                  Translate Response to regional channel
                </h6>
                <div className="flex flex-wrap gap-2">
                  {translationShortlist.map((lang) => (
                    <button
                      key={lang}
                      onClick={() => {
                        onAction("translate", `${msg.id}::${lang}`);
                        setShowTranslatorId(null);
                      }}
                      className="px-2.5 py-1 text-[10px] font-semibold hover:text-white bg-white dark:bg-[#151f38] hover:bg-[#C96A3D] border border-slate-150 dark:border-slate-800 rounded-xl transition-colors shrink-0"
                    >
                      {lang}
                    </button>
                  ))}
                </div>
              </div>
            )}

          </motion.div>
        );
      })}

      {isLoading && (
        <motion.div
          key="nexa-thinking-loader"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="flex flex-col gap-2 p-5 md:p-6 rounded-3xl border border-slate-100 dark:border-slate-800/60 bg-slate-50/45 dark:bg-[#11192e]/40 relative w-full max-w-[88%] md:max-w-[78%] self-start"
          id="nexa-thinking-bubble"
        >
          {/* Header */}
          <div className="flex justify-between items-center select-none mb-1">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 flex items-center justify-center shrink-0">
                <img
                  src="https://i.ibb.co/LdwTKxL5/Nexa-App.png"
                  alt="Nexa-App"
                  className="w-7 h-7 object-contain select-none animate-pulse"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div>
                <h5 className="text-xs font-black text-[#14213D] dark:text-white capitalize leading-tight">
                  Nexa Intelligence
                </h5>
                <div className="flex items-center gap-1 mt-0.5 text-[9px] text-slate-400 font-semibold font-mono">
                  <Clock className="w-3 h-3 shrink-0 animate-spin [animation-duration:3s]" />
                  <span>Formulating response...</span>
                </div>
              </div>
            </div>
            {activeEngine && <EngineBadge engineId={activeEngine as NexaEngineId} size="sm" />}
          </div>

          {/* Body with bouncing dots */}
          <div className="space-y-4 text-xs font-normal mt-2 text-left leading-relaxed">
            <div className="flex items-center gap-1.5 px-1 py-1">
              <motion.div
                className="w-2 h-2 rounded-full bg-[#C96A3D]"
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut", delay: 0 }}
              />
              <motion.div
                className="w-2 h-2 rounded-full bg-[#C96A3D]/70"
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut", delay: 0.15 }}
              />
              <motion.div
                className="w-2 h-2 rounded-full bg-[#C96A3D]/40"
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
              />
              <span className="text-xs text-slate-400 dark:text-slate-505 font-medium ml-2 select-none">
                Nexa is thinking...
              </span>
            </div>
          </div>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}

// Highly polished parsing tokenizer helper translating markdown tags directly into premium layout HTML
function parseCustomMarkdown(content: string) {
  if (!content) return null;

  const lines = content.split("\n");

  let inCodeBlock = false;
  let codeSnippet: string[] = [];
  let codeLang = "";

  return lines.map((line, idx) => {
    const trimmedLine = line.trim();

    // 1. Code Block boundary check
    if (trimmedLine.startsWith("```")) {
      if (inCodeBlock) {
        // Close block
        inCodeBlock = false;
        const completeCode = codeSnippet.join("\n");
        codeSnippet = [];
        return (
          <div key={idx} className="my-4 bg-slate-900 dark:bg-black text-slate-100 rounded-2xl p-5 border border-slate-800 shadow-lg font-mono text-[11px] overflow-x-auto text-left relative">
            <div className="flex justify-between items-center text-[9px] font-extrabold text-slate-500 uppercase tracking-widest border-b border-slate-805/50 pb-2 mb-3 select-none leading-none">
              <span>{codeLang || "code segment"}</span>
              <button
                onClick={() => navigator.clipboard.writeText(completeCode)}
                className="hover:text-white font-semibold transition-colors"
              >
                Copy Code
              </button>
            </div>
            <pre className="p-0 m-0 leading-relaxed font-mono select-text">{completeCode}</pre>
          </div>
        );
      } else {
        // Start block
        inCodeBlock = true;
        codeLang = trimmedLine.replace("```", "").trim();
        return null;
      }
    }

    if (inCodeBlock) {
      codeSnippet.push(line);
      return null;
    }

    // 2. Headings
    if (trimmedLine.startsWith("###")) {
      return (
        <h4 key={idx} className="text-sm font-extrabold text-[#14213D] dark:text-white mt-4 mb-2 first:mt-0 font-sans tracking-tight">
          {trimmedLine.replace("###", "").trim()}
        </h4>
      );
    }
    if (trimmedLine.startsWith("##")) {
      return (
        <h3 key={idx} className="text-base font-black text-[#14213D] dark:text-white mt-5 mb-2 first:mt-0 font-sans tracking-tight border-b border-slate-100 dark:border-slate-800 pb-1">
          {trimmedLine.replace("##", "").trim()}
        </h3>
      );
    }
    if (trimmedLine.startsWith("#")) {
      return (
        <h2 key={idx} className="text-lg font-black text-[#14213D] dark:text-white mt-6 mb-3 first:mt-0 font-sans tracking-tight">
          {trimmedLine.replace("#", "").trim()}
        </h2>
      );
    }

    // 3. Bullet list items
    if (trimmedLine.startsWith("*") || trimmedLine.startsWith("-")) {
      const bulletContent = trimmedLine.substring(1).trim();
      return (
        <div key={idx} className="flex items-start gap-2.5 my-1.5 pl-2 leading-relaxed">
          <div className="w-1.5 h-1.5 rounded-full bg-[#C96A3D] mt-2 shrink-0 select-none" />
          <p className="text-xs text-slate-700 dark:text-slate-200 mt-0 flex-1 font-normal select-text">
            {parseInlineStyles(bulletContent)}
          </p>
        </div>
      );
    }

    // 4. Numbered list items
    const numRegex = /^(\d+)\.\s+(.*)$/;
    if (numRegex.test(trimmedLine)) {
      const match = trimmedLine.match(numRegex);
      if (match) {
        const num = match[1];
        const text = match[2];
        return (
          <div key={idx} className="flex items-start gap-2.5 my-1.5 pl-2 leading-relaxed">
            <span className="font-black text-[#C96A3D] font-mono shrink-0 select-none">{num}.</span>
            <p className="text-xs text-slate-700 dark:text-slate-200 mt-0 flex-1 font-normal select-text">
              {parseInlineStyles(text)}
            </p>
          </div>
        );
      }
    }

    // 5. Empty spacer lines
    if (!trimmedLine) {
      return <div key={idx} className="h-2 select-none" />;
    }

    // 6. Regular paragraphs
    return (
      <p key={idx} className="text-xs text-slate-705 dark:text-slate-200 leading-relaxed font-normal select-text">
        {parseInlineStyles(line)}
      </p>
    );
  });
}

// Inline parser handling strong bold structures **text** and inline variable backticks `var`
function parseInlineStyles(text: string) {
  if (!text) return "";

  // Tokenize by inline markers
  // Supports dynamic splits easily
  const strongRegex = /\*\*(.*?)\*\*/g;
  const backtickRegex = /`(.*?)`/g;

  let parts: Array<{ type: "text" | "bold" | "code"; value: string }> = [];
  
  // Minimal recursive inline chunking
  let currentStr = text;
  
  // We can do a simpler rendering by converting HTML/React elements directly
  // However, simple split mapping is completely robust and type safe for code and strong bold blocks
  const segments = text.split(/(\*\*.*?\*\*|`.*?`)/g);

  return segments.map((seg, idx) => {
    if (seg.startsWith("**") && seg.endsWith("**")) {
      return (
        <strong key={idx} className="font-extrabold text-[#14213D] dark:text-white">
          {seg.replace(/\*\*/g, "")}
        </strong>
      );
    }
    if (seg.startsWith("`") && seg.endsWith("`")) {
      return (
        <code
          key={idx}
          className="bg-slate-100 dark:bg-slate-800 text-[#C96A3D] dark:text-[#C96A3D] font-mono text-[10px] px-1.5 py-0.5 rounded-md font-semibold select-text"
        >
          {seg.replace(/`/g, "")}
        </code>
      );
    }
    return seg;
  });
}
