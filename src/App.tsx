/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Search,
  BookOpen,
  CheckCircle,
  Feather,
  Brain,
  Trash2,
  Bookmark,
  Share2,
  FileText,
  Clock,
  Briefcase,
  HelpCircle,
  Database,
  Cpu,
  RefreshCw,
  Send,
  Plus,
  Compass,
  Image,
  Camera,
  Mic,
  MicOff,
  Lock,
  X,
  ShieldCheck,
  Trophy,
  Award,
  MoreVertical,
  ThumbsUp
} from "lucide-react";
import { trackAction } from "./utils/gamification";
import {
  ChatSession,
  UserProfile,
  AppSettings,
  AdminMetrics,
  Message,
  NexaEngineId,
} from "./types";
import { SplashScreen } from "./components/SplashScreen";
import { Logo } from "./components/Logo";
import { Navbar } from "./components/Navbar";
import { motion, AnimatePresence } from "motion/react";
import { Sidebar } from "./components/Sidebar";
import { SuggestedPrompts } from "./components/SuggestedPrompts";
import { OnboardingTutorial } from "./components/OnboardingTutorial";
import { AuthModal } from "./components/AuthModal";
import { SettingsModal } from "./components/SettingsModal";
import { DocPreview } from "./components/DocPreview";
import { MessageList } from "./components/MessageList";
import { AdminDashboard } from "./components/AdminDashboard";
import { StudyModeCenter } from "./components/StudyModeCenter";
import { WritingAssistantCenter } from "./components/WritingAssistantCenter";
import { CameraModal } from "./components/CameraModal";
import { PermissionsModal } from "./components/PermissionsModal";

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (!showSplash) {
      const tourCompleted = localStorage.getItem("nexa-tour-completed");
      if (tourCompleted !== "true") {
        setShowOnboarding(true);
      }
    }
  }, [showSplash]);
  const [activeMode, setActiveMode] = useState<ChatSession["mode"]>("general");
  const [showAdmin, setShowAdmin] = useState(false);
  const [showAdminUnlock, setShowAdminUnlock] = useState(false);
  const [adminUnlockKey, setAdminUnlockKey] = useState("");
  const [isShaking, setIsShaking] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [showUploadOptions, setShowUploadOptions] = useState(false);
  const [showInputMoreActions, setShowInputMoreActions] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showFeedbackToast, setShowFeedbackToast] = useState(false);
  const uploadOptionsRef = useRef<HTMLDivElement>(null);
  const [unlockedBadgesToast, setUnlockedBadgesToast] = useState<{ id: string; title: string; description: string; pointsAwarded: number } | null>(null);

  // Secure hardware & assets permissions state
  const [permissions, setPermissions] = useState(() => {
    try {
      const saved = localStorage.getItem("nexa-device-permissions");
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error("Failed to parse device permissions", e);
    }
    return {
      camera: false,
      photos: false,
      document: false,
      microphone: false,
    };
  });
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [pendingUploadFile, setPendingUploadFile] = useState<File | null>(null);
  const [pendingCameraTrigger, setPendingCameraTrigger] = useState(false);
  const [pendingMicrophoneTrigger, setPendingMicrophoneTrigger] = useState(false);

  // Speech-to-Text Dictation State & Refs
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const recognitionRef = useRef<any>(null);
  const startingPromptRef = useRef("");

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
    }
  }, []);

  const toggleListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      return;
    }

    if (!permissions.microphone) {
      setPendingMicrophoneTrigger(true);
      setShowPermissionsModal(true);
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
    } else {
      startingPromptRef.current = inputPrompt;
      
      try {
        const rec = new SpeechRecognition();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = "en-US";

        rec.onstart = () => {
          setIsListening(true);
        };

        rec.onresult = (event: any) => {
          let finalTextOfSession = "";
          for (let i = 0; i < event.results.length; ++i) {
            finalTextOfSession += event.results[i][0].transcript;
          }
          
          const space = startingPromptRef.current ? " " : "";
          setInputPrompt(startingPromptRef.current + space + finalTextOfSession.trim());
        };

        rec.onerror = (e: any) => {
          console.error("Web Speech API Error:", e.rawError || e.error || e);
          setIsListening(false);
        };

        rec.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = rec;
        rec.start();
      } catch (err) {
        console.error("Could not start speech recognition:", err);
        setIsListening(false);
      }
    }
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (uploadOptionsRef.current && !uploadOptionsRef.current.contains(event.target as Node)) {
        setShowUploadOptions(false);
        setShowInputMoreActions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Auto-dismiss feedback toast after 5 seconds
  useEffect(() => {
    if (showFeedbackToast) {
      const timer = setTimeout(() => {
        setShowFeedbackToast(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showFeedbackToast]);

  // Core App states load persistent or set default
  const [user, setUser] = useState<UserProfile>(() => {
    const cached = localStorage.getItem("nexa_user");
    return cached
      ? JSON.parse(cached)
      : {
          email: "guest@nexa.ai",
          fullName: "Guest User",
          isGuest: true,
          avatarUrl: "https://api.dicebear.com/7.x/initials/svg?seed=Guest",
          preferences: {
            primaryLanguage: "English",
            rememberPersonalization: true,
            personalizationContext: "",
          },
        };
  });

  const [settings, setSettings] = useState<AppSettings>(() => {
    const cached = localStorage.getItem("nexa_settings");
    if (cached) {
      const parsed = JSON.parse(cached);
      return { isAdminVerified: false, ...parsed };
    }
    return {
      theme: "light",
      language: "English",
      personalizationActive: true,
      personalizationNotes: "",
      privacySaveHistory: true,
      isAdminVerified: false,
    };
  });

  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const cachedUser = localStorage.getItem("nexa_user");
    const parsedUser = cachedUser ? JSON.parse(cachedUser) : null;
    const isGuestUser = !parsedUser || parsedUser.isGuest === true || parsedUser.email === "guest@nexa.ai";

    const newSessionId = `session-${Date.now()}`;
    const newRootSession: ChatSession = {
      id: newSessionId,
      title: "Start an Intelligent Chat",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
      isPinned: false,
      mode: "general",
    };

    if (isGuestUser) {
      // Guests don't persist sessions when returning/reloading
      return [newRootSession];
    } else {
      // Logged-in users: retrieve past history but prepend a fresh new session if they have any messages
      const cached = localStorage.getItem("nexa_sessions");
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as ChatSession[];
          if (parsed && parsed.length > 0) {
            const hasMessages = parsed.some((s) => s.messages && s.messages.length > 0);
            if (hasMessages) {
              return [newRootSession, ...parsed];
            }
            return parsed;
          }
        } catch (e) {
          console.error("Failed to parse cached sessions", e);
        }
      }
      return [newRootSession];
    }
  });

  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    const cachedUser = localStorage.getItem("nexa_user");
    const parsedUser = cachedUser ? JSON.parse(cachedUser) : null;
    const isGuestUser = !parsedUser || parsedUser.isGuest === true || parsedUser.email === "guest@nexa.ai";

    if (isGuestUser) {
      // Guests always use the single fresh session we initialized
      return sessions.length > 0 ? sessions[0].id : "";
    } else {
      // Logged-in users start on the first session (either the newly prepended fresh one or the sole empty one)
      return sessions.length > 0 ? sessions[0].id : "";
    }
  });

  // Controls Chat thread inputs
  const [inputPrompt, setInputPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [attachment, setAttachment] = useState<any>(null);
  const [explainLikeIm10, setExplainLikeIm10] = useState(false);
  const [writingStyle, setWritingStyle] = useState<"formal" | "casual" | "academic" | "professional">("casual");
  const [quizTopic, setQuizTopic] = useState("");
  const [quizDifficulty, setQuizDifficulty] = useState<"easy" | "medium" | "hard">("medium");

  // Admin Dashboard Monitoring States (Live Metrics)
  const [adminMetrics, setAdminMetrics] = useState<AdminMetrics>(() => {
    const cached = localStorage.getItem("nexa_admin_metrics");
    return cached
      ? JSON.parse(cached)
      : {
          activeUsersCount: 147,
          totalChatsCount: sessions.length,
          totalQueriesToday: 4209,
          averageResponseTimeMs: 1150,
          engineRoutingStats: {
            core: 1845,
            reasoning: 932,
            vision: 410,
            language: 680,
            learning: 342,
          },
          serverLoadPct: 34,
          memoryUsageMb: 114,
          feedbackSubmissions: [
            {
              id: "feed-1",
              userEmail: "prof.chemistry@edu.in",
              rating: 5,
              comment: "The Nexa Learning Engine simplified nuclear stoichiometry perfectly using ELI10 analogies! Outstanding design.",
              timestamp: "2026-06-08T07:11:30Z",
            },
            {
              id: "feed-2",
              userEmail: "saas.founder@startup.io",
              rating: 5,
              comment: "Fact checker metrics confidence & reliability dials are incredibly professional.",
              timestamp: "2026-06-08T08:22:15Z",
            },
          ],
          recentErrors: [
            {
              id: "err-201a",
              message: "Gemini rate quota threshold limit close warning",
              engine: "Nexa Core Engine",
              timestamp: "2026-06-08T06:14:02Z",
              severity: "low" as const,
            },
          ],
        };
  });



  // References to auto-scroll messages
  const messageEndRef = useRef<HTMLDivElement | null>(null);

  // Apply Theme CSS triggers on mounted or update
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [settings.theme]);

  // Synchronize App States to Cache LocalStorage
  useEffect(() => {
    localStorage.setItem("nexa_user", JSON.stringify(user));
  }, [user]);

  useEffect(() => {
    localStorage.setItem("nexa_settings", JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem("nexa_sessions", JSON.stringify(sessions));
    localStorage.setItem("nexa_active_session_id", activeSessionId);
  }, [sessions, activeSessionId]);

  useEffect(() => {
    localStorage.setItem("nexa_admin_metrics", JSON.stringify(adminMetrics));
  }, [adminMetrics]);

  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0];
  const lastMessage = activeSession?.messages[activeSession?.messages?.length - 1];
  const lastMessageContent = lastMessage?.content;
  const lastMessageRole = lastMessage?.role;
  const messageCount = activeSession?.messages?.length || 0;

  // Track if user is currently near the bottom using a ref updated by IntersectionObserver
  const isNearBottomRef = useRef<boolean>(true);

  // Set up an intersection observer on the message end tag to track user view state
  useEffect(() => {
    const el = messageEndRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        isNearBottomRef.current = entry.isIntersecting;
      },
      {
        root: null, // Viewport
        threshold: 0.1, // Trigger as soon as bottom spacer begins to enter/exit viewport
      }
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, [activeSessionId]);

  // Scroll to bottom of message feeds on rendering new messages or loading state changes
  useEffect(() => {
    if (!messageEndRef.current) return;

    const isNewUserMessage = lastMessageRole === "user";
    
    // Always scroll on a new user query or if the user is already following the feed near the bottom
    if (isNewUserMessage || isNearBottomRef.current) {
      // Use requestAnimationFrame to ensure the layout is fully rendered before scroll calculation executes
      const rafId = requestAnimationFrame(() => {
        messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
      });
      return () => cancelAnimationFrame(rafId);
    }
  }, [activeSessionId, messageCount, lastMessageContent, isLoading]);

  // Sync mode whenever active mode changes
  useEffect(() => {
    if (activeSession && activeSession.mode !== activeMode) {
      setSessions((prev) =>
        prev.map((s) => (s.id === activeSession.id ? { ...s, mode: activeMode } : s))
      );
    }
  }, [activeMode]);

  // Triggered when opening a session to match sidebar toggle mode
  useEffect(() => {
    if (activeSession) {
      setActiveMode(activeSession.mode);
    }
  }, [activeSessionId]);

  // Setup handler functions
  const handleToggleTheme = () => {
    setSettings((prev) => ({
      ...prev,
      theme: prev.theme === "light" ? "dark" : "light",
    }));
  };

  const handleUpdateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  const handleVerifyUnlockAdmin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (adminUnlockKey === "Mayank_Admin_2026@792010") {
      setSettings((prev) => ({ ...prev, isAdminVerified: true }));
      setShowAdminUnlock(false);
      setShowAdmin(true);
      setAdminUnlockKey("");
    } else {
      setIsShaking(true);
      setTimeout(() => {
        alert("Incorrect admin passcode! Please try again.");
      }, 400);
    }
  };

  const handleUpdateUser = (newUser: Partial<UserProfile>) => {
    setUser((prev) => ({ ...prev, ...newUser }));
  };

  const triggerActionTracking = (
    actionType: "send_message" | "complete_research" | "complete_study" | "complete_quiz" | "complete_fact_check",
    payload?: { engineId?: string; correctAnswers?: number; totalQuestions?: number }
  ) => {
    setUser((prevUser) => {
      const { newState, newlyUnlocked } = trackAction(prevUser.gamification, {
        type: actionType,
        payload,
      });

      if (newlyUnlocked.length > 0) {
        const badge = newlyUnlocked[0];
        setUnlockedBadgesToast({
          id: badge.id,
          title: badge.title,
          description: badge.description,
          pointsAwarded: badge.pointsAwarded,
        });
      }

      return {
        ...prevUser,
        gamification: newState,
      };
    });
  };

  const handleCompleteQuiz = (score: number, totalQuestions: number) => {
    triggerActionTracking("complete_quiz", { correctAnswers: score, totalQuestions: totalQuestions });
  };

  const handleLogout = () => {
    setUser({
      email: "guest@nexa.ai",
      fullName: "Guest User",
      isGuest: true,
      avatarUrl: "https://api.dicebear.com/7.x/initials/svg?seed=Guest",
      preferences: {
        primaryLanguage: "English",
        rememberPersonalization: true,
        personalizationContext: "",
      },
    });
  };

  // Chat Session management controls
  const handleNewSession = (mode: ChatSession["mode"] = "general") => {
    const newId = `session-${Date.now()}`;
    const newChat: ChatSession = {
      id: newId,
      title:
        mode === "general"
          ? "Core Assistant Chat"
          : mode === "research"
          ? "Deep Research Session"
          : mode === "study"
          ? "Study Guide Workspace"
          : mode === "factcheck"
          ? "Claim Verification"
          : "Drafting Workspace",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
      isPinned: false,
      mode: mode,
    };

    setSessions((prev) => [newChat, ...prev]);
    setActiveSessionId(newId);
    setActiveMode(mode);
    setAttachment(null);
  };

  const handleDeleteSession = (id: string) => {
    if (sessions.length === 1) {
      alert("Nexa requires at least one active conversation thread.");
      return;
    }
    const remaining = sessions.filter((s) => s.id !== id);
    setSessions(remaining);
    if (activeSessionId === id) {
      setActiveSessionId(remaining[0].id);
    }
  };

  const handleRenameSession = (id: string, newTitle: string) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, title: newTitle, updatedAt: new Date().toISOString() } : s))
    );
  };

  const handlePinSession = (id: string) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, isPinned: !s.isPinned } : s))
    );
  };

  const handleClearChats = () => {
    const rootId = `session-${Date.now()}`;
    const rootSession: ChatSession = {
      id: rootId,
      title: "New Chat Session",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
      isPinned: false,
      mode: "general",
    };
    setSessions([rootSession]);
    setActiveSessionId(rootId);
    setActiveMode("general");
    setShowSettings(false);
  };

  // Auth merge transition successes
  const handleAuthSuccess = (authenticatedUser: UserProfile) => {
    // Guest chats Bookmarks and Histories are completely PRESERVED under new login state
    setUser({
      ...authenticatedUser,
      isGuest: false,
    });
    alert("Authentication complete! Stored guest chat logs and bookmark settings successfully linked.");
  };

  // Diagnostic panel actions
  const handleRefreshMetrics = () => {
    setAdminMetrics((prev) => ({
      ...prev,
      totalChatsCount: sessions.length,
      averageResponseTimeMs: Math.max(1050, Math.floor(prev.averageResponseTimeMs + (Math.random() * 80 - 40))),
      serverLoadPct: Math.min(95, Math.max(10, Math.floor(Math.random() * 20 + 25))),
      memoryUsageMb: Math.min(256, Math.max(80, Math.floor(Math.random() * 30 + 105))),
      totalQueriesToday: prev.totalQueriesToday + 1,
    }));
  };

  const handleSimulateError = () => {
    const list = [
      { id: `err-${Math.floor(Math.random()*1000)}`, msg: "OpenAI rate check threshold warning", eng: "Nexa Core Engine" },
      { id: `err-${Math.floor(Math.random()*1000)}`, msg: "Citation Grounding metadata mismatch", eng: "Deep Research Engine" },
      { id: `err-${Math.floor(Math.random()*1000)}`, msg: "Failed OCR screenshot canvas load", eng: "Vision Engine" },
    ];
    const picked = list[Math.floor(Math.random()*list.length)];
    setAdminMetrics((prev) => ({
      ...prev,
      recentErrors: [
        {
          id: picked.id,
          message: picked.msg,
          engine: picked.eng,
          timestamp: new Date().toISOString(),
          severity: "medium" as const,
        },
        ...prev.recentErrors,
      ],
    }));
  };

  const handleSimulateFeedback = (rating: number, comment: string) => {
    setAdminMetrics((prev) => ({
      ...prev,
      feedbackSubmissions: [
        {
          id: `feed-${Date.now()}`,
          userEmail: user.email,
          rating,
          comment,
          timestamp: new Date().toISOString(),
        },
        ...prev.feedbackSubmissions,
      ],
    }));
  };

  const handleRegenerateMessage = async (msgId: string) => {
    const idx = activeSession.messages.findIndex((m) => m.id === msgId);
    if (idx === -1) return;

    // Get preceding messages up to index idx
    const feedMessages = activeSession.messages.slice(0, idx).slice(-12);
    if (feedMessages.length === 0) return;

    setIsLoading(true);

    // Set the specific message to a regenerating/loading state locally
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id === activeSessionId) {
          const updatedMsgs = [...s.messages];
          updatedMsgs[idx] = {
            ...updatedMsgs[idx],
            content: "⏳ *Regenerating response...*",
            sources: undefined,
            factCheck: undefined,
            researchReport: undefined,
            quiz: undefined,
          };
          return {
            ...s,
            messages: updatedMsgs,
            updatedAt: new Date().toISOString(),
          };
        }
        return s;
      })
    );

    try {
      const payload = {
        messages: feedMessages,
        mode: activeMode,
        explainLikeIm10: explainLikeIm10,
        writingStyle: writingStyle,
        quizTopic: activeMode === "quiz" ? quizTopic : "",
        quizDifficulty: quizDifficulty,
        personalizationContext: settings.personalizationNotes,
      };

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      setSessions((prev) =>
        prev.map((s) => {
          if (s.id === activeSessionId) {
            const updatedMsgs = [...s.messages];
            updatedMsgs[idx] = {
              ...updatedMsgs[idx],
              content: data.content || "",
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              engineId: data.engineId || "core",
              sources: data.sources || undefined,
              factCheck: data.factCheck || undefined,
              researchReport: data.researchReport || undefined,
              quiz: data.quiz || undefined,
            };
            return {
              ...s,
              messages: updatedMsgs,
              updatedAt: new Date().toISOString(),
            };
          }
          return s;
        })
      );

      // Track routing updates inside Admin Metric streams
      const routeId = data.engineId || "core";
      setAdminMetrics((prev) => ({
        ...prev,
        totalQueriesToday: prev.totalQueriesToday + 1,
        engineRoutingStats: {
          ...prev.engineRoutingStats,
          [routeId]: prev.engineRoutingStats[routeId as NexaEngineId] + 1,
        },
      }));

    } catch (err: any) {
      console.error(err);
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id === activeSessionId) {
            const updatedMsgs = [...s.messages];
            updatedMsgs[idx] = {
              ...updatedMsgs[idx],
              content: `### 🔴 Connection Error\n\nNexa's secure core experienced an operational connectivity interruption.\n\n*Details:* ${err.message || "Unknown error state"}`,
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              engineId: "core",
            };
            return {
              ...s,
              messages: updatedMsgs,
              updatedAt: new Date().toISOString(),
            };
          }
          return s;
        })
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Message Quick Actions (Bookmark, share, translate, export)
  const handleMessageAction = (action: string, msgId: string) => {
    if (action === "share") {
      navigator.clipboard.writeText(`${window.location.origin}/share/thread/${activeSessionId}#${msgId}`);
      alert("Shareable thread link copied to clipboard successfully!");
    } else if (action === "bookmark") {
      alert("Successfully bookmarks listed message components inside active user preferences storage!");
    } else if (action === "export") {
      // PDF Export system trigger client-side formatted doc downloader
      const msg = activeSession.messages.find((m) => m.id === msgId);
      if (!msg) return;

      const title = `Nexa_Intelligence_Report_${msgId.substring(0, 5)}`;
      const fileContent = `====================================================\nNEXA PROPIRITARY RESEARCH REPORT\n====================================================\nTimestamp: ${msg.timestamp}\nOrigin Thread ID: ${activeSessionId}\nEngine Host: gemini-3.5-flash\n\n${msg.content}\n\n====================================================\nEnd of Nexa Report Document\nGenerated in Secures Sandboxes\n====================================================`;
      
      const blob = new Blob([fileContent], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${title}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } else if (action.startsWith("translate")) {
      // Split parameters: messageId::Language
      const [id, lang] = action.split("::");
      const targetMsg = activeSession.messages.find((m) => m.id === id);
      if (!targetMsg) return;

      setInputPrompt(`Translate the above Nexa output into fluent ${lang}. Keep markdown styling and structural boldings intact.`);
      // Form submit will take this content
    } else if (action === "regenerate") {
      handleRegenerateMessage(msgId);
    }
  };

  const handleEditPromptMessage = async (msgId: string, newContent: string) => {
    if (!newContent.trim()) return;

    const idx = activeSession.messages.findIndex((m) => m.id === msgId);
    if (idx === -1) return;

    setIsLoading(true);

    let updatedMsgs = [...activeSession.messages];
    
    // Update the edited message in place
    updatedMsgs[idx] = {
      ...updatedMsgs[idx],
      content: newContent,
    };

    // Prepare or create the matched assistant message right after the edited user prompt
    const assistantIdx = idx + 1;
    const assistantId = updatedMsgs[assistantIdx]?.role === "assistant" 
      ? updatedMsgs[assistantIdx].id 
      : "assistant-" + Math.random().toString(36).substring(2, 9);

    const placeholderAssistantMsg = {
      id: assistantId,
      role: "assistant" as const,
      content: "⏳ *Regenerating response...*",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      engineId: activeSession.selectedEngineId || "core",
    };

    // Truncate any obsolete messages after the assistant response to maintain chronological integrity
    updatedMsgs = [...updatedMsgs.slice(0, idx + 1), placeholderAssistantMsg];

    setSessions((prev) =>
      prev.map((s) => {
        if (s.id === activeSessionId) {
          return {
            ...s,
            messages: updatedMsgs,
            updatedAt: new Date().toISOString(),
          };
        }
        return s;
      })
    );

    const feedMessages = updatedMsgs.slice(0, idx + 1).slice(-12);

    try {
      const payload = {
        messages: feedMessages,
        mode: activeMode,
        explainLikeIm10: explainLikeIm10,
        writingStyle: writingStyle,
        quizTopic: activeMode === "quiz" ? quizTopic : "",
        quizDifficulty: quizDifficulty,
        personalizationContext: settings.personalizationNotes,
      };

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      setSessions((prev) =>
        prev.map((s) => {
          if (s.id === activeSessionId) {
            const currentMsgs = [...s.messages];
            const aIdx = currentMsgs.findIndex((m) => m.id === assistantId);
            if (aIdx !== -1) {
              currentMsgs[aIdx] = {
                ...currentMsgs[aIdx],
                content: data.content || "",
                timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                engineId: data.engineId || "core",
                sources: data.sources || undefined,
                factCheck: data.factCheck || undefined,
                researchReport: data.researchReport || undefined,
                quiz: data.quiz || undefined,
              };
            }
            return {
              ...s,
              messages: currentMsgs,
              updatedAt: new Date().toISOString(),
            };
          }
          return s;
        })
      );

      const routeId = data.engineId || "core";
      setAdminMetrics((prev) => ({
        ...prev,
        totalQueriesToday: prev.totalQueriesToday + 1,
        engineRoutingStats: {
          ...prev.engineRoutingStats,
          [routeId]: prev.engineRoutingStats[routeId as NexaEngineId] + 1,
        },
      }));

    } catch (err: any) {
      console.error(err);
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id === activeSessionId) {
            const currentMsgs = [...s.messages];
            const aIdx = currentMsgs.findIndex((m) => m.id === assistantId);
            if (aIdx !== -1) {
              currentMsgs[aIdx] = {
                ...currentMsgs[aIdx],
                content: `### 🔴 Connection Error\n\nNexa's secure core experienced an operational connectivity interruption.\n\n*Details:* ${err.message || "Unknown error state"}`,
                timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                engineId: "core",
              };
            }
            return {
              ...s,
              messages: currentMsgs,
              updatedAt: new Date().toISOString(),
            };
          }
          return s;
        })
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleMessageReaction = (msgId: string, reaction: string | null) => {
    if (reaction === "👍") {
      setShowFeedbackToast(true);
    } else {
      setShowFeedbackToast(false);
    }
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id === activeSessionId) {
          const updatedMsgs = s.messages.map((m) => {
            if (m.id === msgId) {
              return { ...m, reaction: reaction || undefined };
            }
            return m;
          });
          return { ...s, messages: updatedMsgs };
        }
        return s;
      })
    );
  };

  const processUploadedFile = (file: File) => {
    const fileType = file.name.split(".").pop()?.toLowerCase() || "";
    const isImage = ["jpg", "jpeg", "png", "webp", "gif"].includes(fileType);

    if (isImage && !permissions.photos) {
      setPendingUploadFile(file);
      setShowPermissionsModal(true);
      return;
    }
    if (!isImage && !permissions.document) {
      setPendingUploadFile(file);
      setShowPermissionsModal(true);
      return;
    }

    let systemType = "txt";

    if (["jpg", "jpeg", "png", "webp", "gif"].includes(fileType)) {
      systemType = "image";
    } else if (["pdf"].includes(fileType)) {
      systemType = "pdf";
    } else if (["docx", "doc"].includes(fileType)) {
      systemType = "docx";
    } else if (["ppt", "pptx"].includes(fileType)) {
      systemType = "ppt";
    }

    const formatBytes = (bytes: number): string => {
      if (bytes === 0) return "0 Bytes";
      const k = 1024;
      const sizes = ["Bytes", "KB", "MB"];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    };

    const reader = new FileReader();

    if (systemType === "image") {
      reader.onload = (re) => {
        setAttachment({
          name: file.name,
          type: systemType,
          size: formatBytes(file.size),
          dataUrl: re.target?.result as string,
        });
      };
      reader.readAsDataURL(file);
    } else {
      reader.onload = (re) => {
        const textStr = (re.target?.result as string) || "";
        setAttachment({
          name: file.name,
          type: systemType,
          size: formatBytes(file.size),
          textPreview: textStr.substring(0, 15000),
        });
      };
      reader.readAsText(file);
    }
  };

  const handleGrantComplete = (grantedStates: typeof permissions) => {
    setPermissions(grantedStates);
    try {
      localStorage.setItem("nexa-device-permissions", JSON.stringify(grantedStates));
    } catch (e) {
      console.error(e);
    }
    setShowPermissionsModal(false);

    // Dynamic resolution metrics
    if (pendingUploadFile) {
      const fileType = pendingUploadFile.name.split(".").pop()?.toLowerCase() || "";
      const isImage = ["jpg", "jpeg", "png", "webp", "gif"].includes(fileType);
      
      const allowed = isImage ? grantedStates.photos : grantedStates.document;
      if (allowed) {
        const fileToUpload = pendingUploadFile;
        setPendingUploadFile(null);
        setTimeout(() => {
          processUploadedFile(fileToUpload);
        }, 100);
      } else {
        setPendingUploadFile(null);
      }
    }

    if (pendingCameraTrigger) {
      setPendingCameraTrigger(false);
      if (grantedStates.camera) {
        setTimeout(() => {
          setShowCamera(true);
        }, 100);
      }
    }

    if (pendingMicrophoneTrigger) {
      setPendingMicrophoneTrigger(false);
      if (grantedStates.microphone) {
        setTimeout(() => {
          // Re-trigger toggle listening now that permissions are enabled
          toggleListening();
        }, 100);
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processUploadedFile(e.target.files[0]);
    }
  };

  // Submit Main Chat Trigger
  const handleChatSubmit = async (customPrompt?: string, customAttachment?: any) => {
    const promptToSend = customPrompt || inputPrompt;
    if (!promptToSend.trim() && !customAttachment) return;

    const currentAttachment = customAttachment || attachment;
    setIsLoading(true);
    setInputPrompt("");

    const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    // Append User Message Log Card
    const newUserMsg: Message = {
      id: `usr-${Date.now()}`,
      role: "user",
      content: promptToSend,
      timestamp,
      attachment: currentAttachment ? { ...currentAttachment } : undefined,
    };

    setSessions((prev) =>
      prev.map((s) => {
        if (s.id === activeSessionId) {
          // If first message title, auto-rename title from user prompt
          const title = s.messages.length === 0 ? promptToSend.substring(0, 36) + "..." : s.title;
          return {
            ...s,
            title,
            messages: [...s.messages, newUserMsg],
            updatedAt: new Date().toISOString(),
          };
        }
        return s;
      })
    );

    setAttachment(null);

    try {
      // Build previous messages stream context list (limited to last 12 messages)
      const feedMessages = [...activeSession.messages, newUserMsg].slice(-12);

      // Call Express Fullstack proxy
      const payload = {
        messages: feedMessages,
        mode: activeMode,
        explainLikeIm10: explainLikeIm10,
        writingStyle: writingStyle,
        quizTopic: activeMode === "quiz" ? quizTopic : "",
        quizDifficulty: quizDifficulty,
        personalizationContext: settings.personalizationNotes,
      };

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      const newAssistantMsg: Message = {
        id: `ast-${Date.now()}`,
        role: "assistant",
        content: data.content || "",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        engineId: data.engineId || "core",
        sources: data.sources || undefined,
        factCheck: data.factCheck || undefined,
        researchReport: data.researchReport || undefined,
        quiz: data.quiz || undefined,
      };

      // Update Chat with Assistant's parsed answers
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id === activeSessionId) {
            return {
              ...s,
              messages: [...s.messages, newAssistantMsg],
              updatedAt: new Date().toISOString(),
            };
          }
          return s;
        })
      );

      // Track routing updates inside Admin Metric streams
      const routeId = data.engineId || "core";
      setAdminMetrics((prev) => ({
        ...prev,
        totalQueriesToday: prev.totalQueriesToday + 1,
        engineRoutingStats: {
          ...prev.engineRoutingStats,
          [routeId]: prev.engineRoutingStats[routeId as NexaEngineId] + 1,
        },
      }));

      // Track gamification progress
      const resolvedEngineId = data.engineId || "core";
      triggerActionTracking("send_message", { engineId: resolvedEngineId });

      if (activeMode === "research" || data.researchReport) {
        triggerActionTracking("complete_research");
      } else if (activeMode === "study" || resolvedEngineId === "learning") {
        triggerActionTracking("complete_study");
      } else if (activeMode === "factcheck" || data.factCheck) {
        triggerActionTracking("complete_fact_check");
      }

    } catch (err: any) {
      console.error(err);
      const errorMsg: Message = {
        id: `ast-${Date.now()}`,
        role: "assistant",
        content: `### 🔴 Connection Error\n\nNexa's secure core experienced an operational connectivity interruption.\n\n*Details:* ${err.message || "Unknown error state"}`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        engineId: "core",
      };

      setSessions((prev) =>
        prev.map((s) => {
          if (s.id === activeSessionId) {
            return {
              ...s,
              messages: [...s.messages, errorMsg],
              updatedAt: new Date().toISOString(),
            };
          }
          return s;
        })
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Render Splash Screen on Arrival
  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-[#0c1222] transition-colors duration-300 overflow-hidden text-slate-700 dark:text-slate-200">
      
      {/* 1. Header Navbar */}
      <Navbar
        user={user}
        settings={settings}
        activeMode={activeMode}
        onToggleTheme={handleToggleTheme}
        onOpenSettings={() => setShowSettings(true)}
        onOpenAuth={() => setShowAuth(true)}
        onLogout={handleLogout}
        showAdmin={showAdmin}
        onToggleAdmin={() => setShowAdmin(!showAdmin)}
        onLogoClick={() => {
          const emptySession = sessions.find(
            (s) => s.messages.length === 0 && s.mode === "general"
          );
          if (emptySession) {
            setActiveSessionId(emptySession.id);
            setActiveMode("general");
          } else {
            handleNewSession("general");
          }
          setIsMobileSidebarOpen(false);
        }}
        onLogoDoubleClick={() => {
          if (settings.isAdminVerified) {
            setShowAdmin(!showAdmin);
          } else {
            setShowAdminUnlock(true);
            setAdminUnlockKey("");
          }
        }}
        onToggleSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
      />

      <div className="flex flex-1 overflow-hidden relative">
        
        {/* 2. Side Panel Desktop (Stable always visible on larger viewports) */}
        <div className="hidden md:flex md:w-80 h-full flex-col border-r border-slate-100 dark:border-slate-800 shrink-0 select-none overflow-hidden bg-white dark:bg-[#0c1222]">
          <Sidebar
            sessions={sessions}
            activeSessionId={activeSessionId}
            activeMode={activeMode}
            user={user}
            onSelectSession={setActiveSessionId}
            onNewSession={handleNewSession}
            onDeleteSession={handleDeleteSession}
            onRenameSession={handleRenameSession}
            onPinSession={handlePinSession}
            onChangeMode={(mode) => {
              setActiveMode(mode);
              handleNewSession(mode);
            }}
            onOpenAuth={() => setShowAuth(true)}
            onOpenSettings={() => setShowSettings(true)}
            onLogout={handleLogout}
            isMobileOpen={false}
          />
        </div>

        {/* 2. Side Panel Mobile (Slide-in drawer with AnimatePresence support) */}
        <AnimatePresence>
          {isMobileSidebarOpen && (
            <>
              {/* Overlay background panel with backdrop opacity fades */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
                className="fixed inset-0 bg-slate-900/60 dark:bg-black/85 backdrop-blur-xs z-40 md:hidden"
                onClick={() => setIsMobileSidebarOpen(false)}
              />

              {/* Physical drawer sliding on X axes */}
              <motion.div
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "spring", damping: 26, stiffness: 220, mass: 0.9 }}
                className="fixed inset-y-0 left-0 z-50 w-72 h-full flex flex-col bg-white dark:bg-[#0c1222] border-r border-slate-100 dark:border-slate-800 shadow-2xl md:hidden"
              >
                <Sidebar
                  sessions={sessions}
                  activeSessionId={activeSessionId}
                  activeMode={activeMode}
                  user={user}
                  onSelectSession={setActiveSessionId}
                  onNewSession={handleNewSession}
                  onDeleteSession={handleDeleteSession}
                  onRenameSession={handleRenameSession}
                  onPinSession={handlePinSession}
                  onChangeMode={(mode) => {
                    setActiveMode(mode);
                    handleNewSession(mode);
                  }}
                  onOpenAuth={() => setShowAuth(true)}
                  onOpenSettings={() => setShowSettings(true)}
                  onLogout={handleLogout}
                  isMobileOpen={true}
                  onCloseMobile={() => setIsMobileSidebarOpen(false)}
                />
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* 3. Main Stage Content */}
        <main className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-[#0e1628] overflow-y-auto relative p-6">
          
          {/* Diagnostic Monitor Panel (Sliding overlay or toggle inline grid) */}
          {showAdmin && settings.isAdminVerified ? (
            <div className="w-full max-w-4xl mx-auto mb-6">
              <AdminDashboard
                metrics={adminMetrics}
                onRefresh={handleRefreshMetrics}
                onSimulateError={handleSimulateError}
                onSimulateFeedback={handleSimulateFeedback}
                onSignOutAdmin={() => {
                  setSettings((prev) => ({ ...prev, isAdminVerified: false }));
                  setShowAdmin(false);
                }}
              />
            </div>
          ) : null}

          {/* Chat thread feed section */}
          <div className="flex-1 flex flex-col max-w-4xl w-full mx-auto">
            {activeSession.messages.length === 0 ? (
              // Empty Thread Page (Curated Hero + Bentley Highlights + FAQs)
              <div className="space-y-12 py-10 text-center animate-fadeIn" id="nexa-hero-landing-page">
                {/* Greeting */}
                <div className="space-y-4 flex flex-col items-center justify-center">
                  <h1 
                    className="text-slate-900 dark:text-white tracking-tight leading-tight"
                    style={{ fontFamily: 'Times New Roman', fontStyle: 'italic', fontSize: '50px' }}
                  >
                    Meet Nexa Intelligence
                  </h1>
                  <button
                    onClick={() => setShowOnboarding(true)}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-full border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/40 hover:border-[#C96A3D] dark:hover:border-[#C96A3D] text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:text-[#C96A3D] dark:hover:text-[#C96A3D] cursor-pointer transition-all active:scale-95 shadow-sm"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#C96A3D]" />
                    Take Interactive Walkthrough
                  </button>
                </div>

                {/* Quick actions Suggestions Prompts */}
                <SuggestedPrompts
                  onSelectPrompt={(prompt, mode) => {
                    setActiveMode(mode);
                    handleChatSubmit(prompt);
                  }}
                />

                {/* Specific Mode settings center displays */}
                {activeMode === "study" && (
                  <StudyModeCenter
                    explainLikeIm10={explainLikeIm10}
                    onToggleELI10={setExplainLikeIm10}
                    onQuickAction={(txt) => handleChatSubmit(txt)}
                  />
                )}

                {activeMode === "writing" && (
                  <WritingAssistantCenter
                    onDraft={(prompt, style) => {
                      setWritingStyle(style);
                      handleChatSubmit(prompt);
                    }}
                    loading={isLoading}
                  />
                )}



              </div>
            ) : (
              // Message Logs list feeds
              <div className="flex-1 pb-16">
                <MessageList
                  messages={activeSession.messages}
                  activeEngine={activeSession.selectedEngineId || "core"}
                  onAction={handleMessageAction}
                  onEditPrompt={handleEditPromptMessage}
                  onReact={handleMessageReaction}
                  isLoading={isLoading}
                  onCompleteQuiz={handleCompleteQuiz}
                />
              </div>
            )}

            {/* Scroll bottom node spacer */}
            <div ref={messageEndRef} />
          </div>

          {/* Dynamic Active input Dock Control Bars anchored */}
          <div className="sticky bottom-0 inset-x-0 bg-slate-50/90 dark:bg-[#0e1628]/95 backdrop-blur-md pt-3 pb-6 max-w-4xl w-full mx-auto select-none shrink-0" id="nexa-dock">
            
            {/* Thumbs Up Feedback Toast Slide-in from Right */}
            <AnimatePresence>
              {showFeedbackToast && (
                <div className="absolute bottom-full right-4 sm:right-0 mb-3 z-50 flex justify-end pointer-events-auto">
                  <motion.div
                    initial={{ opacity: 0, x: 120, scale: 0.9 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 120, scale: 0.9 }}
                    transition={{ type: "spring", stiffness: 280, damping: 22 }}
                    className="flex items-center gap-3 p-3.5 rounded-2xl bg-white dark:bg-[#11192e] text-slate-800 dark:text-white border border-[#C96A3D]/45 dark:border-[#C96A3D]/45 shadow-xl backdrop-blur-md max-w-[340px] w-full"
                    id="feedback-toast-popup"
                  >
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-500 shrink-0">
                      <ThumbsUp className="w-4 h-4" />
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <div className="text-[9px] font-black uppercase tracking-widest text-[#C96A3D] leading-none mb-1">Feedback Logged</div>
                      <p className="text-[11.5px] font-bold text-slate-700 dark:text-slate-300 leading-snug">
                        Thank you! Your feedback helps Nexa learn & provide better answers.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowFeedbackToast(false)}
                      className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors shrink-0"
                      title="Dismiss"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {/* Slide up uploaded file pairing triggers */}
            {attachment && (
              <div className="mb-3">
                <DocPreview
                  attachment={attachment}
                  onUpload={(file) => setAttachment(file)}
                  onClear={() => setAttachment(null)}
                  dragActive={dragActive}
                  setDragActive={setDragActive}
                />
              </div>
            )}

            {/* Text input controller box */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleChatSubmit();
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => {
                setDragActive(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  processUploadedFile(e.dataTransfer.files[0]);
                }
              }}
              className={`flex items-center gap-3 p-2 bg-white dark:bg-[#11192e] border rounded-2xl shadow-sm transition-all ${
                dragActive 
                  ? "border-2 border-dashed border-[#C96A3D] bg-[#C96A3D]/5" 
                  : "border-slate-200 dark:border-slate-800 focus-within:border-[#C96A3D] dark:focus-within:border-[#C96A3D]"
              }`}
            >
              <div className="relative shrink-0" ref={uploadOptionsRef}>
                <button
                  id="nexa-plus-button"
                  type="button"
                  onClick={() => setShowUploadOptions(!showUploadOptions)}
                  className="p-2 text-slate-400 hover:text-[#C96A3D] dark:hover:text-[#C96A3D] hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl transition-colors cursor-pointer flex items-center justify-center"
                  title="Attach File (+)"
                >
                  <Plus className={`w-5 h-5 transition-transform duration-200 ${showUploadOptions ? "rotate-45 text-[#C96A3D]" : ""}`} />
                </button>

                {showUploadOptions && (
                  <div className="absolute bottom-full left-0 mb-3 w-[21rem] max-w-sm bg-white dark:bg-[#11192e] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-4 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150 space-y-4">
                    {/* Category A: Capture & Upload */}
                    <div id="nexa-tour-files">
                      <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-550 mb-2">
                        Files & Capture
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {/* Document Upload Option */}
                        <label className="flex flex-col items-center justify-center p-2 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 hover:bg-[#C96A3D]/5 dark:hover:bg-[#C96A3D]/5 hover:border-[#C96A3D]/25 dark:hover:border-[#C96A3D]/25 cursor-pointer transition-all active:scale-95 text-center min-h-[64px]">
                          <input
                            type="file"
                            className="hidden"
                            accept=".pdf,.docx,.doc,.ppt,.pptx,.txt"
                            onChange={(e) => {
                              handleFileInputChange(e);
                              setShowUploadOptions(false);
                            }}
                          />
                          <FileText className="w-5 h-5 text-sky-500 mb-1" />
                          <span className="text-[9px] font-bold text-slate-600 dark:text-slate-300 leading-tight">Document</span>
                        </label>

                        {/* Image Upload Option */}
                        <label className="flex flex-col items-center justify-center p-2 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 hover:bg-[#C96A3D]/5 dark:hover:bg-[#C96A3D]/5 hover:border-[#C96A3D]/25 dark:hover:border-[#C96A3D]/25 cursor-pointer transition-all active:scale-95 text-center min-h-[64px]">
                          <input
                            type="file"
                            className="hidden"
                            accept=".png,.jpg,.jpeg,.webp,.gif"
                            onChange={(e) => {
                              handleFileInputChange(e);
                              setShowUploadOptions(false);
                            }}
                          />
                          <Image className="w-5 h-5 text-[#C96A3D] mb-1" />
                          <span className="text-[9px] font-bold text-slate-600 dark:text-slate-300 leading-tight">Image</span>
                        </label>

                        {/* Take Photo Option (Camera Snapshot) */}
                        <button
                          type="button"
                          onClick={() => {
                            setShowUploadOptions(false);
                            if (!permissions.camera) {
                              setPendingCameraTrigger(true);
                              setShowPermissionsModal(true);
                            } else {
                              setShowCamera(true);
                            }
                          }}
                          className="flex flex-col items-center justify-center p-2 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 hover:bg-[#C96A3D]/5 dark:hover:bg-[#C96A3D]/5 hover:border-[#C96A3D]/25 dark:hover:border-[#C96A3D]/25 cursor-pointer transition-all active:scale-95 text-center min-h-[64px]"
                        >
                          <Camera className="w-5 h-5 text-emerald-500 mb-1" />
                          <span className="text-[9px] font-bold text-slate-600 dark:text-slate-300 leading-tight">Take Photo</span>
                        </button>

                        {/* More Actions Toggle Option */}
                        <button
                          type="button"
                          onClick={() => {
                            setShowInputMoreActions(!showInputMoreActions);
                          }}
                          className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all active:scale-95 text-center min-h-[64px] cursor-pointer ${
                            showInputMoreActions
                              ? "border-[#C96A3D] bg-[#C96A3D]/10 text-[#C96A3D]"
                              : "border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 hover:bg-[#C96A3D]/5 hover:border-[#C96A3D]/25 text-slate-650 dark:text-slate-300"
                          }`}
                          title="More Actions"
                        >
                          <MoreVertical className={`w-5 h-5 mb-1 transition-transform ${showInputMoreActions ? "rotate-90 text-[#C96A3D]" : "text-slate-400"}`} />
                          <span className="text-[9px] font-bold leading-tight">more action</span>
                        </button>
                      </div>
                    </div>

                    <AnimatePresence>
                      {showInputMoreActions && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="space-y-4 pt-3 border-t border-slate-100 dark:border-slate-800/60 overflow-hidden"
                        >
                          {/* Category B: Change Nexa Intelligence Mode */}
                          <div id="nexa-tour-modes">
                            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-550 mb-2 flex justify-between items-center">
                              <span>Nexa Intelligence Modes</span>
                              <span className="text-[9px] uppercase text-[#C96A3D] font-mono font-bold bg-[#C96A3D]/10 px-1.5 py-0.5 rounded">
                                {activeMode}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              {[
                                { id: "general", name: "General Chat", icon: <HelpCircle className="w-3.5 h-3.5 text-indigo-500" /> },
                                { id: "research", name: "Deep Research", icon: <Search className="w-3.5 h-3.5 text-blue-500" /> },
                                { id: "study", name: "Study Arena", icon: <BookOpen className="w-3.5 h-3.5 text-amber-500" /> },
                                { id: "factcheck", name: "Fact Checker", icon: <CheckCircle className="w-3.5 h-3.5 text-[#C96A3D]" /> },
                                { id: "writing", name: "Writer Desk", icon: <Feather className="w-3.5 h-3.5 text-emerald-500" /> },
                                { id: "quiz", name: "Quiz Engine", icon: <Brain className="w-3.5 h-3.5 text-pink-500" /> },
                              ].map((m) => {
                                const isActive = activeMode === m.id;
                                return (
                                  <button
                                    key={m.id}
                                    type="button"
                                    onClick={() => {
                                      setActiveMode(m.id as any);
                                      setShowUploadOptions(false);
                                      setShowInputMoreActions(false);
                                    }}
                                    className={`flex items-center gap-2 p-2 rounded-xl text-left cursor-pointer transition-all active:scale-95 border ${
                                      isActive
                                        ? "border-[#C96A3D] bg-[#C96A3D]/5 text-[#C96A3D] font-bold"
                                        : "border-slate-100 dark:border-slate-800/40 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                                    }`}
                                  >
                                    <div className="shrink-0">{m.icon}</div>
                                    <span className="text-[10.5px] font-bold truncate leading-none">{m.name}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Category C: Active Model Engine Override */}
                          <div id="nexa-tour-engines">
                            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-550 mb-2 flex justify-between items-center">
                              <span>Direct Engine Override</span>
                              <span className="text-[9px] uppercase text-emerald-600 dark:text-emerald-400 font-mono font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded">
                                {activeSession?.selectedEngineId ? activeSession.selectedEngineId : "Smart Router"}
                              </span>
                            </div>
                            <div className="space-y-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setSessions((prev) =>
                                    prev.map((s) => (s.id === activeSessionId ? { ...s, selectedEngineId: undefined } : s))
                                  );
                                  setShowUploadOptions(false);
                                  setShowInputMoreActions(false);
                                }}
                                className={`w-full flex items-center justify-center gap-2 p-1.5 rounded-xl text-center cursor-pointer transition-all active:scale-95 border ${
                                  !activeSession?.selectedEngineId
                                    ? "border-emerald-550 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 font-bold"
                                    : "border-slate-100 dark:border-slate-800/40 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                                }`}
                              >
                                <Sparkles className="w-3.5 h-3.5 text-emerald-500 animate-spin-slow" />
                                <span className="text-[10.5px] font-bold">Smart Auto-Routing Matrix</span>
                              </button>

                              <div className="grid grid-cols-2 gap-2">
                                {[
                                  { id: "core", name: "Core Engine", icon: <Cpu className="w-3.5 h-3.5 text-blue-500" /> },
                                  { id: "reasoning", name: "Reasoning Engine", icon: <Database className="w-3.5 h-3.5 text-indigo-500" /> },
                                  { id: "vision", name: "Vision Engine", icon: <Image className="w-3.5 h-3.5 text-emerald-500" /> },
                                  { id: "language", name: "Language Tech", icon: <Feather className="w-3.5 h-3.5 text-sky-500" /> },
                                ].map((eng) => {
                                  const isActive = activeSession?.selectedEngineId === eng.id;
                                  return (
                                    <button
                                      key={eng.id}
                                      type="button"
                                      onClick={() => {
                                        setSessions((prev) =>
                                          prev.map((s) => (s.id === activeSessionId ? { ...s, selectedEngineId: eng.id as any } : s))
                                        );
                                        setShowUploadOptions(false);
                                        setShowInputMoreActions(false);
                                      }}
                                      className={`flex items-center gap-2 p-2 rounded-xl text-left cursor-pointer transition-all active:scale-95 border ${
                                        isActive
                                          ? "border-[#C96A3D] bg-[#C96A3D]/5 text-[#C96A3D] font-bold"
                                          : "border-slate-100 dark:border-slate-800/40 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                                      }`}
                                    >
                                      <div className="shrink-0">{eng.icon}</div>
                                      <span className="text-[10.5px] font-bold truncate leading-none">{eng.name}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>

              {speechSupported && (
                <button
                  type="button"
                  onClick={toggleListening}
                  className={`p-2 rounded-xl transition-all cursor-pointer flex items-center justify-center shrink-0 ${
                    isListening
                      ? "bg-rose-500/15 text-rose-500 hover:bg-rose-500/25 animate-pulse border border-rose-500/20"
                      : "text-slate-400 hover:text-[#C96A3D] dark:hover:text-[#C96A3D] hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  }`}
                  title={isListening ? "Stop dictation" : "Voice dictation (speech-to-text)"}
                >
                  <Mic className="w-5 h-5" />
                </button>
              )}

              <textarea
                id="nexa-chat-input"
                value={inputPrompt}
                onChange={(e) => setInputPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleChatSubmit();
                  }
                }}
                placeholder={
                  activeMode === "general"
                    ? "Ask Nexa anything..."
                    : activeMode === "research"
                    ? "Specify search topic for Deep Research reports..."
                    : activeMode === "factcheck"
                    ? "Verify claims with Confidence Indexes..."
                    : "Enter writing details..."
                }
                rows={1}
                className="flex-1 text-xs py-2 px-3 bg-transparent outline-none max-h-36 resize-none text-[#14213D] dark:text-white placeholder:text-slate-400 font-normal m-0"
              />

              <button
                type="submit"
                disabled={isLoading || (!inputPrompt.trim() && !attachment)}
                className="p-2.5 bg-[#14213D] hover:bg-[#C96A3D] dark:bg-slate-100 dark:hover:bg-[#C96A3D] dark:hover:text-white dark:text-[#14213D] text-white rounded-xl transition-all hover:scale-105 shrink-0 disabled:opacity-40 disabled:hover:scale-100 cursor-pointer"
                title="Send Message"
              >
                {isLoading ? (
                  <RefreshCw className="w-4 h-4 shrink-0 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 shrink-0" />
                )}
              </button>
            </form>


          </div>

        </main>
      </div>

      {/* Auth Modal Modal */}
      <AuthModal
        isOpen={showAuth}
        onClose={() => setShowAuth(false)}
        onSuccess={handleAuthSuccess}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        settings={settings}
        user={user}
        onUpdateSettings={handleUpdateSettings}
        onUpdateUser={handleUpdateUser}
        onClearChats={handleClearChats}
        permissions={permissions}
        onUpdatePermissions={(newPerms) => {
          setPermissions(newPerms);
          try {
            localStorage.setItem("nexa-device-permissions", JSON.stringify(newPerms));
          } catch (e) {
            console.error(e);
          }
        }}
      />

      {/* Camera Capture Modal */}
      <CameraModal
        isOpen={showCamera}
        onClose={() => setShowCamera(false)}
        onCapture={(file) => setAttachment(file)}
      />

      {/* Permissions Popout Modal */}
      <PermissionsModal
        isOpen={showPermissionsModal}
        onClose={() => {
          setShowPermissionsModal(false);
          setPendingUploadFile(null);
          setPendingCameraTrigger(false);
          setPendingMicrophoneTrigger(false);
        }}
        onGrantComplete={handleGrantComplete}
        initialStates={permissions}
      />

      {/* Admin Unlock Key Modal */}
      {showAdminUnlock && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-md">
          <motion.div
            animate={isShaking ? { x: [-10, 10, -8, 8, -5, 5, -2, 2, 0] } : { x: 0 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            onAnimationComplete={() => setIsShaking(false)}
            className="relative w-full max-w-sm p-6 bg-white dark:bg-[#11192e] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200"
          >
            <button
               onClick={() => setShowAdminUnlock(false)}
               className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-50 dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex flex-col items-center text-center space-y-2 mt-2">
              <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center border border-indigo-100 dark:border-indigo-900/30">
                <Lock className="w-5 h-5 animate-pulse" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Admin Console Authentication
              </h3>
              <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                Unlock the Nexa Operations Monitor. Please input your secure admin passcode below.
              </p>
            </div>

            <form onSubmit={handleVerifyUnlockAdmin} className="space-y-4 pt-1">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">
                  Secure Admin Passkey
                </label>
                <input
                  type="password"
                  placeholder="Enter Passkey"
                  value={adminUnlockKey}
                  onChange={(e) => setAdminUnlockKey(e.target.value)}
                  className="w-full text-xs py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:border-indigo-500 outline-none text-[#14213D] dark:text-white font-mono placeholder:text-slate-350 dark:placeholder:text-slate-600 transition-all focus:ring-2 focus:ring-indigo-500/10"
                  autoFocus
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdminUnlock(false)}
                  className="flex-1 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all active:scale-98 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all shadow-md active:scale-98 cursor-pointer"
                >
                  Verify Key
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {showOnboarding && (
        <OnboardingTutorial
          activeMode={activeMode}
          showUploadOptions={showUploadOptions}
          setShowUploadOptions={setShowUploadOptions}
          onSelectMode={(mode) => setActiveMode(mode)}
          onSetEngineOverride={(engine) => {
            setSessions((prev) =>
              prev.map((s) => (s.id === activeSessionId ? { ...s, selectedEngineId: engine as any } : s))
            );
          }}
          onStartNewChat={() => {
            const emptySession = sessions.find(
              (s) => s.messages.length === 0 && s.mode === "general"
            );
            if (emptySession) {
              setActiveSessionId(emptySession.id);
              setActiveMode("general");
            } else {
              handleNewSession("general");
            }
          }}
          onComplete={() => setShowOnboarding(false)}
        />
      )}

      {/* Gamification Achievements Unlock Celebration Toast */}
      <AnimatePresence>
        {unlockedBadgesToast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-55 max-w-sm w-full bg-slate-900 border border-[#C96A3D] rounded-2xl p-4 shadow-xl text-white flex items-start gap-3 select-none"
            id="nexa-gamification-achievement-toast"
          >
            <div className="p-3 bg-[#C96A3D]/20 rounded-xl flex items-center justify-center shrink-0 border border-[#C96A3D]/30 shadow-[0_0_12px_rgba(201,106,61,0.3)] animate-bounce">
              <Trophy className="w-6 h-6 text-amber-400" />
            </div>
            
            <div className="space-y-1 w-full text-left">
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-black uppercase text-[#C96A3D] tracking-widest">
                  Achievement Unlocked!
                </span>
                <button
                  onClick={() => setUnlockedBadgesToast(null)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              
              <h5 className="font-extrabold text-sm">{unlockedBadgesToast.title}</h5>
              <p className="text-xs text-slate-300 leading-normal font-normal">
                {unlockedBadgesToast.description}
              </p>
              
              <div className="flex justify-between items-center text-[10px] bg-slate-800/80 px-2 py-1 rounded-md mt-2 font-bold">
                <span className="text-slate-450">BONUS AWARDED</span>
                <span className="text-emerald-400">+{unlockedBadgesToast.pointsAwarded} XP</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
