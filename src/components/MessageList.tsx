/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
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
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
  BookOpen,
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
  isGenerating?: boolean;
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
  isGenerating,
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
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});

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
    console.log("[Nexa Debug] [MessageList Mount] MessageList component has mounted. Active messages count:", messages?.length, "activeEngine:", activeEngine);
    return () => {
      console.log("[Nexa Debug] [MessageList Unmount] MessageList component has unmounted.");
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
        {messages.map((msg, idx) => {
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
                    {isGenerating && idx === messages.length - 1 && (
                      <span className="inline-block w-1.5 h-3.5 bg-slate-900 dark:bg-white ml-0.5 animate-cursor-blink align-middle rounded-xs" />
                    )}
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
            {isModel && (
              (() => {
                const isSearchExpected = activeEngine === "research" || activeEngine === "factcheck" || (msg.content && (msg.content.toLowerCase().includes("search") || msg.content.toLowerCase().includes("grounding")));
                const hasSources = msg.sources && msg.sources.length > 0;
                
                if (!hasSources && !isSearchExpected) return null;
                
                const isExpanded = expandedSources[msg.id] !== false; // default to expanded
                
                return (
                  <div className="border-t border-slate-150/10 dark:border-slate-805/30 pt-4 mt-4 text-left select-none space-y-3">
                    <div 
                      className="flex items-center justify-between cursor-pointer group"
                      onClick={() => setExpandedSources(prev => ({ ...prev, [msg.id]: !isExpanded }))}
                    >
                      <h6 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                        <Globe2 className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 group-hover:animate-pulse" /> 
                        {hasSources ? `Sources used to answer (${msg.sources.length})` : 'Sources Check'}
                      </h6>
                      <button className="flex items-center gap-1 text-[10px] font-semibold text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/15 px-2 py-0.5 rounded-md transition-all">
                        {isExpanded ? (
                          <>
                            Hide details <ChevronUp className="w-3 h-3" />
                          </>
                        ) : (
                          <>
                            Show details <ChevronDown className="w-3 h-3" />
                          </>
                        )}
                      </button>
                    </div>

                    {!hasSources && isSearchExpected ? (
                      <div className="border border-amber-500/15 bg-amber-500/5 rounded-xl p-3 text-slate-600 dark:text-slate-300 text-xs flex items-start gap-2.5">
                        <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-slate-700 dark:text-slate-200">No reliable public source was found for this information.</p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                            We searched official documentation, government, and educational databases but couldn't verify a definitive public reference.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* 1. COMPACT COLLAPSED VIEW (Row of cards) */}
                        {!isExpanded ? (
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                            {msg.sources!.map((src, idx) => {
                              const domain = getDomain(src.uri);
                              const { website } = getWebsiteNameAndPublisher(src.uri, src.title);
                              return (
                                <a
                                  key={idx}
                                  href={src.uri}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/40 dark:hover:bg-slate-800 border border-slate-150/10 dark:border-slate-805/30 transition-all text-left min-w-0"
                                >
                                  <div className="w-5 h-5 rounded-md bg-white dark:bg-slate-900 flex items-center justify-center border border-slate-100 dark:border-slate-800 shrink-0 text-[10px] font-bold text-indigo-500 dark:text-indigo-400">
                                    {idx + 1}
                                  </div>
                                  <img 
                                    src={`https://www.google.com/s2/favicons?sz=64&domain=${domain}`} 
                                    alt="" 
                                    className="w-3.5 h-3.5 rounded-sm shrink-0"
                                    onError={(e) => {
                                      (e.target as HTMLElement).style.display = 'none';
                                    }}
                                  />
                                  <div className="min-w-0">
                                    <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 truncate leading-none">
                                      {website}
                                    </p>
                                    <p className="text-[9px] text-slate-400 truncate mt-0.5 leading-none">
                                      {domain}
                                    </p>
                                  </div>
                                  <ExternalLink className="w-2.5 h-2.5 text-slate-400 shrink-0 ml-auto" />
                                </a>
                              );
                            })}
                          </div>
                        ) : (
                          /* 2. EXPANDED DETAILED VIEW (Rich list cards) */
                          <div className="space-y-2">
                            {msg.sources!.map((src, idx) => {
                              const domain = getDomain(src.uri);
                              const { website, publisher } = getWebsiteNameAndPublisher(src.uri, src.title);
                              const pubDate = extractDate(src.uri, src.title);
                              return (
                                <div 
                                  key={idx}
                                  className="p-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100/80 dark:bg-slate-800/20 dark:hover:bg-slate-800/50 border border-slate-150/10 dark:border-slate-805/20 transition-all space-y-2"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      <div className="w-5 h-5 rounded-md bg-indigo-500/10 text-indigo-500 dark:bg-indigo-500/20 dark:text-indigo-400 flex items-center justify-center text-[10px] font-bold shrink-0">
                                        {idx + 1}
                                      </div>
                                      <img 
                                        src={`https://www.google.com/s2/favicons?sz=64&domain=${domain}`} 
                                        alt="" 
                                        className="w-4 h-4 rounded-sm shrink-0"
                                        onError={(e) => {
                                          (e.target as HTMLElement).style.display = 'none';
                                        }}
                                      />
                                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{website}</span>
                                      <span className="text-[10px] text-slate-400 font-mono">({domain})</span>
                                    </div>
                                    <a
                                      href={src.uri}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-[10px] font-semibold text-slate-500 hover:text-indigo-500 dark:text-slate-400 dark:hover:text-indigo-400 border border-slate-150/10 dark:border-slate-805/10 transition-all shadow-sm shrink-0"
                                    >
                                      Visit site <ExternalLink className="w-2.5 h-2.5" />
                                    </a>
                                  </div>

                                  <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-100 leading-snug">
                                    {src.title}
                                  </h4>

                                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-400">
                                    {publisher && (
                                      <span>
                                        <span className="font-medium text-slate-500 dark:text-slate-400">Publisher:</span> {publisher}
                                      </span>
                                    )}
                                    {pubDate && (
                                      <span className="flex items-center gap-1">
                                        <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                                        <span className="font-medium text-slate-500 dark:text-slate-400">Published:</span> {pubDate}
                                      </span>
                                    )}
                                  </div>

                                  <div className="pt-1.5 border-t border-dashed border-slate-150/5 dark:border-slate-805/5 truncate">
                                    <a 
                                      href={src.uri}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-[10px] text-indigo-500 hover:underline font-mono"
                                    >
                                      {src.uri}
                                    </a>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })()
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

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        table: ({ children }) => <SortableTable>{children}</SortableTable>,
        h1: ({ children }) => (
          <h2 className="text-lg font-black text-[#14213D] dark:text-white mt-6 mb-3 first:mt-0 font-sans tracking-tight">
            {children}
          </h2>
        ),
        h2: ({ children }) => (
          <h3 className="text-base font-black text-[#14213D] dark:text-white mt-5 mb-2 first:mt-0 font-sans tracking-tight border-b border-slate-150/45 dark:border-slate-800 pb-1">
            {children}
          </h3>
        ),
        h3: ({ children }) => (
          <h4 className="text-sm font-extrabold text-[#14213D] dark:text-white mt-4 mb-2 first:mt-0 font-sans tracking-tight">
            {children}
          </h4>
        ),
        h4: ({ children }) => (
          <h5 className="text-xs font-bold text-[#14213D] dark:text-white mt-3 mb-1 first:mt-0 font-sans tracking-tight">
            {children}
          </h5>
        ),
        ul: ({ children }) => (
          <ul className="list-disc pl-5 my-2.5 space-y-1.5 text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal pl-5 my-2.5 space-y-1.5 text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
            {children}
          </ol>
        ),
        li: ({ children, ...props }) => (
          <li {...props} className="marker:text-[#C96A3D]">
            {children}
          </li>
        ),
        input: ({ ...props }) => {
          if (props.type === "checkbox") {
            return (
              <input
                {...props}
                className="rounded border-slate-300 dark:border-slate-700 text-[#C96A3D] focus:ring-[#C96A3D] mr-1.5 h-3.5 w-3.5 accent-[#C96A3D]"
              />
            );
          }
          return <input {...props} />;
        },
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-[#C96A3D] pl-4 py-1.5 my-3 bg-slate-50 dark:bg-slate-900/40 text-slate-650 dark:text-slate-350 rounded-r-lg italic">
            {children}
          </blockquote>
        ),
        strong: ({ children }) => (
          <strong className="font-extrabold text-[#14213D] dark:text-white">
            {children}
          </strong>
        ),
        em: ({ children }) => (
          <em className="italic text-slate-800 dark:text-slate-100">
            {children}
          </em>
        ),
        p: ({ children }) => (
          <p className="text-xs text-slate-705 dark:text-slate-200 leading-relaxed font-normal my-1.5 break-words">
            {children}
          </p>
        ),
        code({ className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || "");
          const codeVal = String(children).replace(/\n$/, "");
          const isInline = !className;

          if (!isInline && (match || codeVal.includes("\n"))) {
            return (
              <CodeBlockContainer code={codeVal} lang={match ? match[1] : ""} />
            );
          }

          return (
            <code
              className="bg-slate-100 dark:bg-slate-850 text-[#C96A3D] dark:text-[#C96A3D] font-mono text-[10px] px-1.5 py-0.5 rounded-md font-semibold select-text"
              {...props}
            >
              {children}
            </code>
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

// Separate component for copyable code blocks that manages copy state locally
function CodeBlockContainer({ code, lang }: { code: string; lang: string; key?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="my-4 bg-slate-900 dark:bg-[#0c0f16] text-slate-100 rounded-2xl border border-slate-800 shadow-md font-mono text-[11px] overflow-hidden">
      {/* Code Header Bar with language identifier and copy button */}
      <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 bg-slate-950/70 px-4 py-2.5 select-none leading-none border-b border-slate-850">
        <span className="uppercase tracking-wider text-slate-500 font-mono">{lang || "code"}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 hover:text-white transition-all cursor-pointer font-bold text-[10px]"
          type="button"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span className="text-emerald-500">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 shrink-0" />
              <span>Copy Code</span>
            </>
          )}
        </button>
      </div>
      {/* Code Body with Horizontal Scrollbar & No Wrapping */}
      <pre className="p-4.5 m-0 overflow-x-auto whitespace-pre leading-relaxed select-text font-mono text-[11px] scrollbar-thin scrollbar-thumb-slate-800">
        {code}
      </pre>
    </div>
  );
}

// Helper to recursively extract text from React nodes for sorting comparisons
function getNodeText(node: any): string {
  if (!node) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(getNodeText).join("");
  if (node.props && node.props.children) return getNodeText(node.props.children);
  return "";
}

// A feature-rich sorting table component that intercepts Markdown elements
function SortableTable({ children }: { children: React.ReactNode }) {
  const [sortConfig, setSortConfig] = useState<{ key: number; direction: "asc" | "desc" } | null>(null);

  const childrenElements = React.Children.toArray(children).filter(React.isValidElement);

  const thead: any = childrenElements.find(
    (c: any) => typeof c.type === "string" && c.type.toLowerCase() === "thead"
  );
  const tbody: any = childrenElements.find(
    (c: any) => typeof c.type === "string" && c.type.toLowerCase() === "tbody"
  );

  if (!thead || !tbody) {
    return (
      <div className="markdown-table-wrapper scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
        <table className="markdown-table">{children}</table>
      </div>
    );
  }

  const theadRows = React.Children.toArray(thead.props.children).filter(React.isValidElement);
  const mainHeaderRow: any = theadRows[0];
  if (!mainHeaderRow) {
    return (
      <div className="markdown-table-wrapper scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
        <table className="markdown-table">{children}</table>
      </div>
    );
  }

  const headerCells = React.Children.toArray(mainHeaderRow.props.children).filter(React.isValidElement);
  const bodyRows = React.Children.toArray(tbody.props.children).filter(React.isValidElement);

  // Sort rows based on active sort column and direction
  const sortedRows = [...bodyRows];
  if (sortConfig !== null) {
    sortedRows.sort((a: any, b: any) => {
      const aCells = React.Children.toArray(a.props.children).filter(React.isValidElement);
      const bCells = React.Children.toArray(b.props.children).filter(React.isValidElement);

      const aCell = aCells[sortConfig.key];
      const bCell = bCells[sortConfig.key];

      const aText = getNodeText(aCell).toLowerCase().trim();
      const bText = getNodeText(bCell).toLowerCase().trim();

      // Check for numeric sorting
      const aNum = parseFloat(aText.replace(/[^\d.-]/g, ""));
      const bNum = parseFloat(bText.replace(/[^\d.-]/g, ""));

      if (!isNaN(aNum) && !isNaN(bNum)) {
        return sortConfig.direction === "asc" ? aNum - bNum : bNum - aNum;
      }

      return sortConfig.direction === "asc"
        ? aText.localeCompare(bText, undefined, { numeric: true, sensitivity: "base" })
        : bText.localeCompare(aText, undefined, { numeric: true, sensitivity: "base" });
    });
  }

  const handleSort = (index: number) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig && sortConfig.key === index && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key: index, direction });
  };

  // Clone standard table header cells to make them clickable and render sort icons
  const renderedHeaderRow = React.cloneElement(mainHeaderRow, {},
    headerCells.map((th: any, idx: number) => {
      const isSorted = sortConfig?.key === idx;
      const sortDir = sortConfig?.direction;
      return React.cloneElement(th, {
        key: idx,
        onClick: () => handleSort(idx),
        className: `${th.props.className || ""} cursor-pointer select-none group hover:bg-slate-100/70 dark:hover:bg-slate-900/60 transition-colors`,
        children: (
          <div className="flex items-center justify-between gap-1.5 py-1">
            <span className="flex-1">{th.props.children}</span>
            <span className="shrink-0 text-slate-400 dark:text-slate-500 group-hover:text-[#C96A3D] dark:group-hover:text-[#C96A3D] transition-colors">
              {isSorted ? (
                sortDir === "asc" ? (
                  <ArrowUp className="w-3.5 h-3.5 text-[#C96A3D] inline" />
                ) : (
                  <ArrowDown className="w-3.5 h-3.5 text-[#C96A3D] inline" />
                )
              ) : (
                <ArrowUpDown className="w-3.5 h-3.5 opacity-30 group-hover:opacity-100 transition-opacity inline" />
              )}
            </span>
          </div>
        )
      });
    })
  );

  return (
    <div className="markdown-table-wrapper scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
      <table className="markdown-table">
        <thead>
          {theadRows.map((row: any, idx: number) =>
            idx === 0 ? renderedHeaderRow : row
          )}
        </thead>
        <tbody>
          {sortedRows}
        </tbody>
      </table>
    </div>
  );
}

// ----------------------------------------------------
// HELPER FUNCTIONS FOR UNIVERSAL LINK & SOURCES PARSING
// ----------------------------------------------------
function getDomain(urlStr: string): string {
  try {
    const url = new URL(urlStr);
    return url.hostname.replace("www.", "");
  } catch (e) {
    return "";
  }
}

function getWebsiteNameAndPublisher(urlStr: string, title?: string): { website: string; publisher: string } {
  try {
    const url = new URL(urlStr);
    const domain = url.hostname.replace("www.", "").toLowerCase();
    
    // Mapping well-known domains to Website and Publisher
    if (domain.includes("wikipedia.org")) return { website: "Wikipedia", publisher: "Wikimedia Foundation" };
    if (domain.includes("github.com")) return { website: "GitHub", publisher: "GitHub, Inc." };
    if (domain.includes("learn.microsoft.com")) return { website: "Microsoft Learn", publisher: "Microsoft" };
    if (domain.includes("developer.mozilla.org") || domain.includes("mdn")) return { website: "MDN Web Docs", publisher: "Mozilla" };
    if (domain.includes("python.org")) return { website: "Python Docs", publisher: "Python Software Foundation" };
    if (domain.includes("react.dev") || domain.includes("reactjs.org")) return { website: "React Docs", publisher: "Meta Open Source" };
    
    if (domain.includes("openai.com")) return { website: "OpenAI", publisher: "OpenAI" };
    if (domain.includes("google.com")) return { website: "Google AI", publisher: "Google" };
    
    if (domain.includes("who.int")) return { website: "WHO", publisher: "World Health Organization" };
    if (domain.includes("nih.gov")) return { website: "NIH", publisher: "National Institutes of Health" };
    if (domain.includes("nhs.uk")) return { website: "NHS", publisher: "National Health Service" };
    if (domain.includes("cdc.gov")) return { website: "CDC", publisher: "Centers for Disease Control and Prevention" };
    
    // Fallbacks
    const parts = domain.split(".");
    let defaultName = parts[0];
    if (defaultName.length <= 4 && parts[1]) {
      defaultName = parts[1];
    }
    const capitalized = defaultName.charAt(0).toUpperCase() + defaultName.slice(1);
    return { website: capitalized, publisher: capitalized };
  } catch (e) {
    return { website: "Web Source", publisher: "Web Publisher" };
  }
}

function extractDate(urlStr: string, title?: string): string | undefined {
  try {
    const url = new URL(urlStr);
    const path = url.pathname;
    
    // Match /2025/07/15/ or /2025-07-15 or similar
    const dateMatch = path.match(/\/(\d{4})[/-](\d{2})[/-](\d{2})/);
    if (dateMatch) {
      return `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
    }
    const yearMonthMatch = path.match(/\/(\d{4})[/-](\d{2})/);
    if (yearMonthMatch) {
      return `${yearMonthMatch[1]}-${yearMonthMatch[2]}`;
    }
    const yearMatch = path.match(/\/(\d{4})\//);
    if (yearMatch) {
      const year = parseInt(yearMatch[1], 10);
      if (year >= 1990 && year <= 2027) {
        return `${year}`;
      }
    }
  } catch (e) {}

  if (title) {
    const titleMatch = title.match(/\b(19\d{2}|20[0-2]\d)\b/);
    if (titleMatch) {
      return titleMatch[1];
    }
  }

  return undefined;
}
