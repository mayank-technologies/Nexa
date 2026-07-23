/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { Analytics } from "@vercel/analytics/react";
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
  ThumbsUp,
  AlertTriangle,
  Square,
  Check,
  Copy
} from "lucide-react";
import {
  ChatSession,
  UserProfile,
  AppSettings,
  AdminMetrics,
  Message,
  NexaEngineId,
} from "./types";
import { useAuth } from "./context/AuthContext";
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
import { PremiumModal } from "./components/PremiumModal";
import { FeedbackModal } from "./components/FeedbackModal";
import { RecentlyDeleted } from "./components/RecentlyDeleted";
import { ShareModal } from "./components/ShareModal";
import { JoinModal } from "./components/JoinModal";
import { ArchiveView } from "./components/ArchiveView";
import { ConversationHeaderMenu } from "./components/ConversationHeaderMenu";
import { supabase, syncChatToSupabase, syncMessageToSupabase, fetchChatsFromSupabase, fetchDeletedChatsFromSupabase, fetchMessagesFromSupabase, deleteChatFromSupabase, deleteMessageFromSupabase } from "./utils/supabaseClient";
import { safeStorage, copyToClipboard } from "./utils/storage";
import { soundManager, playUiSound } from "./utils/sounds";

function GoogleAuthBridgeView() {
  const [status, setStatus] = useState<"connecting" | "success" | "error">("connecting");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const handleAuth = async () => {
      try {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: window.location.origin
          }
        });
        if (error) throw error;
        console.log("[Nexa Google Bridge View] Successfully initiated Supabase Google OAuth");
        setStatus("success");
        setTimeout(() => {
          window.close();
        }, 1500);
      } catch (err: any) {
        console.error("[Nexa Google Bridge View] Auth failed:", err);
        setStatus("error");
        setErrorMessage(err.message || "Unknown authentication error.");
      }
    };
    handleAuth();
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0f1d] text-white flex flex-col items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md bg-[#11192e] rounded-3xl p-8 border border-slate-800 shadow-2xl text-center space-y-6">
        <div className="flex justify-center">
          <Logo size={48} showText={true} textClass="text-3xl font-bold" animate={true} />
        </div>

        {status === "connecting" && (
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="w-12 h-12 border-4 border-[#C96A3D] border-t-transparent rounded-full animate-spin" />
            </div>
            <h2 className="text-xl font-bold text-slate-100">Connecting Google Account</h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              Establishing a secure connection with Google Auth services. Please sign in using the emerging prompt.
            </p>
          </div>
        )}

        {status === "success" && (
          <div className="space-y-4">
            <div className="mx-auto flex items-center justify-center w-16 h-16 bg-emerald-500/10 rounded-full border border-emerald-500/20">
              <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-emerald-400">Authentication Successful!</h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              Your Google Account is now securely linked. This bridge window will close automatically in a moment.
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-4">
            <div className="mx-auto flex items-center justify-center w-16 h-16 bg-rose-500/10 rounded-full border border-rose-500/20">
              <svg className="w-8 h-8 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-rose-400">Authentication Failed</h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              We couldn't connect your Google Account.
            </p>
            <div className="text-xs bg-rose-500/5 border border-rose-500/10 p-3 rounded-xl text-rose-300 font-mono text-left max-h-24 overflow-y-auto">
              {errorMessage}
            </div>
            <div className="pt-2 flex flex-col gap-2">
              <button
                onClick={async () => {
                  try {
                    setStatus("connecting");
                    setErrorMessage("");
                    const { error } = await supabase.auth.signInWithOAuth({
                      provider: "google",
                      options: {
                        redirectTo: window.location.origin
                      }
                    });
                    if (error) throw error;
                    setStatus("success");
                    setTimeout(() => window.close(), 1500);
                  } catch (err: any) {
                    setStatus("error");
                    setErrorMessage(err.message || "Retry authentication failed.");
                  }
                }}
                className="w-full bg-[#C96A3D] hover:bg-[#b0582e] text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
              >
                Try Again
              </button>
              <button
                onClick={() => window.close()}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-2.5 rounded-xl transition-colors text-sm"
              >
                Close Window
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  // Check if this is the Google Auth Bridge popup window
  const isGoogleAuthBridge = window.location.search.includes("google_auth_trigger=true");

  if (isGoogleAuthBridge) {
    return <GoogleAuthBridgeView />;
  }

  const { user, isAuthLoading, logout, updateUser, triggerActionTracking: contextTriggerActionTracking } = useAuth();
  const [showSplash, setShowSplash] = useState(true);
  const [splashTimerDone, setSplashTimerDone] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (splashTimerDone && !isAuthLoading) {
      console.log("[Nexa Client] [LOG] Splash timer completed and auth loading finished. Exiting splash screen...");
      setShowSplash(false);
    }
  }, [splashTimerDone, isAuthLoading]);

  useEffect(() => {
    if (!showSplash) {
      const tourCompleted = safeStorage.getItem("nexa-tour-completed");
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
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [showPremium, setShowPremium] = useState(false);
  const [premiumSource, setPremiumSource] = useState<"header" | "sidebar" | "unknown">("unknown");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return safeStorage.getItem("nexa-sidebar-collapsed") === "true";
    } catch {
      return false;
    }
  });

  const handleToggleSidebarCollapse = () => {
    setIsSidebarCollapsed((prev) => {
      const newVal = !prev;
      try {
        safeStorage.setItem("nexa-sidebar-collapsed", newVal ? "true" : "false");
      } catch (e) {
        console.error("Failed to persist sidebar collapse state", e);
      }
      return newVal;
    });
  };
  const [dragActive, setDragActive] = useState(false);
  const [showUploadOptions, setShowUploadOptions] = useState(false);
  const [showInputMoreActions, setShowInputMoreActions] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showFeedbackToast, setShowFeedbackToast] = useState(false);
  const [customToast, setCustomToast] = useState<{ message: string; title: string; type: "success" | "warning" | "info" } | null>(null);

  useEffect(() => {
    if (customToast) {
      const timer = setTimeout(() => {
        setCustomToast(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [customToast]);

  const uploadOptionsRef = useRef<HTMLDivElement>(null);
  const [unlockedBadgesToast, setUnlockedBadgesToast] = useState<{ id: string; title: string; description: string; pointsAwarded: number } | null>(null);

  // Secure hardware & assets permissions state
  const [permissions, setPermissions] = useState(() => {
    try {
      const saved = safeStorage.getItem("nexa-device-permissions");
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

  // Modern AI Voice Mode States & Refs
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [voiceModeActive, setVoiceModeActive] = useState(false);
  const [voiceState, setVoiceState] = useState<"idle" | "listening" | "processing" | "speaking">("idle");
  const recognitionRef = useRef<any>(null);
  const startingPromptRef = useRef("");
  const lastWriteUidRef = useRef<string>("");
  const accumulatedTranscriptRef = useRef("");
  const voiceModeActiveRef = useRef(false);
  const voiceStateRef = useRef<"idle" | "listening" | "processing" | "speaking">("idle");

  useEffect(() => {
    voiceModeActiveRef.current = voiceModeActive;
  }, [voiceModeActive]);

  useEffect(() => {
    voiceStateRef.current = voiceState;
  }, [voiceState]);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
    }
  }, []);

  const startListeningSession = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    try {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = true;
      rec.lang = settingsRef.current.voiceLanguage || "en-US";

      rec.onstart = () => {
        setVoiceState("listening");
        setIsListening(true);
      };

      rec.onresult = (event: any) => {
        let interimTranscript = "";
        let finalTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcriptSegment = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcriptSegment;
          } else {
            interimTranscript += transcriptSegment;
          }
        }

        const currentText = (finalTranscript || interimTranscript).trim();
        if (currentText) {
          accumulatedTranscriptRef.current = currentText;
          setInputPrompt(currentText);
        }
      };

      rec.onerror = (e: any) => {
        const errorType = e.rawError || e.error || e;
        if (errorType !== "no-speech") {
          console.warn("Nexa Voice Mode Speech API Error:", errorType);
        }
      };

      rec.onend = () => {
        if (voiceModeActiveRef.current) {
          const textToSubmit = accumulatedTranscriptRef.current.trim();
          if (textToSubmit) {
            if (settingsRef.current.voiceAutoSend !== false) {
              accumulatedTranscriptRef.current = "";
              setVoiceState("processing");
              setIsListening(false);
              handleChatSubmit(textToSubmit);
            } else {
              setVoiceState("idle");
              setVoiceModeActive(false);
              setIsListening(false);
            }
          } else {
            if (voiceStateRef.current === "listening" && voiceModeActiveRef.current) {
              setTimeout(() => {
                if (voiceStateRef.current === "listening" && voiceModeActiveRef.current) {
                  try {
                    rec.start();
                  } catch (e) {}
                }
              }, 200);
            }
          }
        } else {
          setVoiceState("idle");
          setIsListening(false);
        }
      };

      recognitionRef.current = rec;
      rec.start();
    } catch (err) {
      console.error("Failed to start voice session:", err);
      setVoiceState("idle");
      setVoiceModeActive(false);
      setIsListening(false);
    }
  };

  const speakUtterance = (text: string, onEndCallback?: () => void) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      if (onEndCallback) onEndCallback();
      return;
    }

    window.speechSynthesis.cancel();

    const cleanSpeechText = text
      .replace(/\*\*|__/g, "")
      .replace(/\*|_/g, "")
      .replace(/`{3}[\s\S]*?`{3}/g, "[Code snippet omitted]")
      .replace(/`[^`]+`/g, "")
      .replace(/#+\s+/g, "")
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
      .replace(/>\s+/g, "")
      .replace(/[-*+]\s+/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!cleanSpeechText) {
      if (onEndCallback) onEndCallback();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(cleanSpeechText);
    utterance.rate = settingsRef.current.voiceSpeed || 1.0;
    utterance.lang = settingsRef.current.voiceLanguage || "en-US";

    const voices = window.speechSynthesis.getVoices();
    let optimalVoice = null;
    const vSet = settingsRef.current.voiceSetting || "optimal-google";

    if (vSet === "alloy") {
      optimalVoice = voices.find(v => v.name.toLowerCase().includes("alloy") || v.name.toLowerCase().includes("natural") || v.name.toLowerCase().includes("english"));
    } else if (vSet === "echo") {
      optimalVoice = voices.find(v => v.name.toLowerCase().includes("male") || v.name.toLowerCase().includes("david") || v.name.toLowerCase().includes("google"));
    } else if (vSet === "fable") {
      optimalVoice = voices.find(v => v.name.toLowerCase().includes("fable") || v.name.toLowerCase().includes("microsoft") || v.name.toLowerCase().includes("zira"));
    } else if (vSet === "onyx") {
      optimalVoice = voices.find(v => v.name.toLowerCase().includes("onyx") || v.name.toLowerCase().includes("baritone") || v.name.toLowerCase().includes("male"));
    } else if (vSet === "nova") {
      optimalVoice = voices.find(v => v.name.toLowerCase().includes("nova") || v.name.toLowerCase().includes("female") || v.name.toLowerCase().includes("hazel"));
    } else if (vSet === "shimmer") {
      optimalVoice = voices.find(v => v.name.toLowerCase().includes("shimmer") || v.name.toLowerCase().includes("female") || v.name.toLowerCase().includes("google"));
    }

    if (!optimalVoice) {
      const preferredLang = (settingsRef.current.voiceLanguage || "en-US").toLowerCase().substring(0, 2);
      optimalVoice = voices.find(
        (v) =>
          (v.lang.toLowerCase().startsWith(preferredLang) && v.name.toLowerCase().includes("natural")) ||
          (v.lang.toLowerCase().startsWith(preferredLang) && v.name.toLowerCase().includes("google")) ||
          v.lang.toLowerCase().startsWith(preferredLang)
      ) || voices[0];
    }

    if (optimalVoice) {
      utterance.voice = optimalVoice;
    }

    utterance.onend = () => {
      if (onEndCallback) onEndCallback();
    };

    utterance.onerror = (err) => {
      console.warn("TTS speak Error:", err);
      if (onEndCallback) onEndCallback();
    };

    window.speechSynthesis.speak(utterance);
  };

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

    if (voiceModeActiveRef.current || voiceStateRef.current !== "idle") {
      setVoiceModeActive(false);
      setVoiceState("idle");
      setIsListening(false);
      accumulatedTranscriptRef.current = "";
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    } else {
      setVoiceModeActive(true);
      setVoiceState("listening");
      setIsListening(true);
      accumulatedTranscriptRef.current = "";
      startListeningSession();
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

  const [deletedSessions, setDeletedSessions] = useState<ChatSession[]>([]);
  const [currentView, setCurrentView] = useState<"chat" | "recently_deleted" | "archive">("chat");
  const [isDeletedLoading, setIsDeletedLoading] = useState(false);
  const [undoToast, setUndoToast] = useState<{
    message: string;
    action: () => void;
    actionLabel?: string;
  } | null>(null);

  // Auto-dismiss feedback toast after 5 seconds
  useEffect(() => {
    if (showFeedbackToast) {
      const timer = setTimeout(() => {
        setShowFeedbackToast(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showFeedbackToast]);

  // Auto-dismiss undo toast after 8 seconds
  useEffect(() => {
    if (undoToast) {
      const timer = setTimeout(() => {
        setUndoToast(null);
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [undoToast]);

  // Run Recycle Bin expired chats automatic cleanup on app load or sign-in
  useEffect(() => {
    if (user) {
      cleanupExpiredChats();
    }
  }, [user]);

  // Core App states load persistent or set default
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const cached = safeStorage.getItem("nexa_settings");
      if (cached) {
        const parsed = JSON.parse(cached);
        return { 
          isAdminVerified: false, 
          soundEffectsActive: true, 
          voiceAutoSend: true, 
          voiceAutoPlay: true, 
          voiceSpeed: 1.0, 
          voiceLanguage: "en-US", 
          renderingSpeed: "turbo",
          ...parsed 
        };
      }
    } catch (e) {
      console.error("Failed to parse cached nexa_settings", e);
    }
    return {
      theme: "light",
      language: "English",
      personalizationActive: true,
      personalizationNotes: "",
      privacySaveHistory: true,
      turboMode: true,
      isAdminVerified: false,
      soundEffectsActive: true,
      defaultAiMode: "general",
      voiceSetting: "optimal-google",
      voiceAutoSend: true,
      voiceAutoPlay: true,
      voiceSpeed: 1.0,
      voiceLanguage: "en-US",
      renderingSpeed: "turbo",
    };
  });

  const settingsRef = useRef(settings);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    // Sync settings toggle with native sound manager
    soundManager.enabled = settings.soundEffectsActive !== false;
  }, [settings.soundEffectsActive]);

  useEffect(() => {
    // Warm up the sound manager after app loads to avoid any latency or delays
    const warmUp = () => {
      soundManager.init();
      // Remove events after warming up
      window.removeEventListener("click", warmUp);
      window.removeEventListener("keydown", warmUp);
      window.removeEventListener("touchstart", warmUp);
    };
    window.addEventListener("click", warmUp);
    window.addEventListener("keydown", warmUp);
    window.addEventListener("touchstart", warmUp);
    return () => {
      window.removeEventListener("click", warmUp);
      window.removeEventListener("keydown", warmUp);
      window.removeEventListener("touchstart", warmUp);
    };
  }, []);

  // Auto-detect share links in URL (hash, search params, path)
  useEffect(() => {
    const handleUrlShareDetection = async () => {
      const hash = window.location.hash || "";
      const search = window.location.search || "";
      const pathname = window.location.pathname || "";

      let extractedTokenOrCode = "";

      // 1. Hash formats: #share=xxx, #code=xxx, #join=xxx, #sh_xxx, #NXA-xxx
      if (hash.startsWith("#share=")) {
        extractedTokenOrCode = hash.split("#share=")[1] || "";
      } else if (hash.startsWith("#code=")) {
        extractedTokenOrCode = hash.split("#code=")[1] || "";
      } else if (hash.startsWith("#join=")) {
        extractedTokenOrCode = hash.split("#join=")[1] || "";
      } else if (hash.startsWith("#sh_") || hash.startsWith("#NXA-")) {
        extractedTokenOrCode = hash.replace("#", "");
      }

      // 2. Query search formats: ?share=xxx, ?code=xxx, ?join=xxx
      if (!extractedTokenOrCode && search) {
        const params = new URLSearchParams(search);
        extractedTokenOrCode = params.get("share") || params.get("code") || params.get("join") || "";
      }

      // 3. Path formats: /share/thread/:id, /share/:id, /code/:id
      if (!extractedTokenOrCode && pathname) {
        if (pathname.startsWith("/share/thread/")) {
          extractedTokenOrCode = pathname.replace("/share/thread/", "");
        } else if (pathname.startsWith("/share/")) {
          extractedTokenOrCode = pathname.replace("/share/", "");
        } else if (pathname.startsWith("/code/")) {
          extractedTokenOrCode = pathname.replace("/code/", "");
        }
      }

      if (extractedTokenOrCode) {
        const clean = extractedTokenOrCode.trim();
        console.log("[Nexa Share Client] Share/code detected from URL:", clean);
        setJoinTokenInput(clean);

        // Attempt automatic join via API
        try {
          const emailToUse = user?.email || "guest@nexa.ai";
          const res = await fetch("/api/share/join", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: emailToUse,
              fullName: user?.fullName || "Guest Collaborator",
              input: clean,
              shareToken: clean,
              accessCode: clean
            })
          });
          const data = await res.json();
          if (data.success && data.chatId) {
            console.log("[Nexa Share Client] Auto-joined conversation successfully:", data.chatId);
            setActiveSessionId(data.chatId);
            setCurrentView("chat");
            playUiSound("success");
          } else {
            setShowJoinModal(true);
          }
        } catch (e) {
          console.error("[Nexa Share Client] Auto-join exception:", e);
          setShowJoinModal(true);
        }
      }
    };

    handleUrlShareDetection();
    window.addEventListener("hashchange", handleUrlShareDetection);
    return () => window.removeEventListener("hashchange", handleUrlShareDetection);
  }, [user?.email]);

  const [sessions, setSessions] = useState<ChatSession[]>([]);

  // --- REAL-TIME COLLABORATIVE SHARED CONVERSATIONS STATES ---
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareModalSessionId, setShareModalSessionId] = useState<string | null>(null);
  const [shareConfig, setShareConfig] = useState<any>(null);
  const [isShareLoading, setIsShareLoading] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinTokenInput, setJoinTokenInput] = useState("");
  const [isJoiningLoading, setIsJoiningLoading] = useState(false);

  // Real-time states
  const [isSharedSession, setIsSharedSession] = useState(false);
  const [sharedRole, setSharedRole] = useState<'owner' | 'editor' | 'viewer' | null>(null);
  const [sharedParticipants, setSharedParticipants] = useState<any[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const [userIsTyping, setUserIsTyping] = useState(false);
  const typingTimeoutRef = useRef<any>(null);

  const [activeSessionId, setActiveSessionId] = useState<string>("");

  // Controls Chat thread inputs
  const [inputPrompt, setInputPrompt] = useState("");
  const [isLoading, setIsLoadingState] = useState(false);
  const [isGenerating, setIsGeneratingState] = useState(false);

  const isLoadingRef = useRef(false);
  const isGeneratingRef = useRef(false);

  const setIsLoading = (val: boolean) => {
    isLoadingRef.current = val;
    setIsLoadingState(val);
  };

  const setIsGenerating = (val: boolean) => {
    isGeneratingRef.current = val;
    setIsGeneratingState(val);
  };
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamIntervalRef = useRef<any>(null);
  const [attachment, setAttachment] = useState<any>(null);
  const [explainLikeIm10, setExplainLikeIm10] = useState(false);
  const [writingStyle, setWritingStyle] = useState<"formal" | "casual" | "academic" | "professional">("casual");
  const [quizTopic, setQuizTopic] = useState("");
  const [quizDifficulty, setQuizDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isCopiedAll, setIsCopiedAll] = useState(false);

  // Admin Dashboard Monitoring States (Live Metrics)
  const [adminMetrics, setAdminMetrics] = useState<AdminMetrics>(() => {
    try {
      const cached = safeStorage.getItem("nexa_admin_metrics");
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {
      console.error("Failed to parse cached nexa_admin_metrics", e);
    }
    return {
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



  const handleUserTyping = () => {
    if (!isSharedSession || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    if (!userIsTyping) {
      setUserIsTyping(true);
      wsRef.current.send(JSON.stringify({
        type: "typing",
        chatId: activeSessionId,
        isTyping: true
      }));
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: "typing",
          chatId: activeSessionId,
          isTyping: false
        }));
      }
      setUserIsTyping(false);
    }, 2000);
  };

  // References to auto-scroll messages
  const messageEndRef = useRef<HTMLDivElement | null>(null);

  // Supabase real-time listener subscription references
  const chatsUnsubscribeRef = useRef<(() => void) | null>(null);
  const messagesUnsubscribeRef = useRef<(() => void) | null>(null);

  const activeSessionIdRef = useRef(activeSessionId);
  const sessionsRef = useRef(sessions);

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  useEffect(() => {
    console.log("[Nexa Debug] [selectedConversationId Change] activeSessionId (selectedConversationId) changed from:", activeSessionIdRef.current || "empty", "to:", activeSessionId || "empty");
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  useEffect(() => {
    console.log("[Nexa Debug] [Navigation Event] View changed to:", currentView);
  }, [currentView]);

  useEffect(() => {
    console.log("[Nexa Debug] [Navigation Event] Active mode changed to:", activeMode);
  }, [activeMode]);

  const syncChatSummaryToSupabase = async (chat: ChatSession) => {
    if (user && (!user.isGuest || isSharedSession) && user.uid) {
      try {
        // Synchronize directly to Supabase
        await syncChatToSupabase(chat, user.email.toLowerCase().trim());
        console.log("[Nexa Client] Synced chat summary to Supabase:", chat.id);
      } catch (e) {
        console.error("Failed to sync chat summary to Supabase:", e);
      }
    }
  };

  const syncMessageSummaryToSupabase = async (chatId: string, message: Message) => {
    if (user && (!user.isGuest || isSharedSession) && user.uid) {
      try {
        // Synchronize directly to Supabase (using imported syncMessageToSupabase function)
        await syncMessageToSupabase(chatId, message);
        console.log("[Nexa Client] Synced message to Supabase via imported client helper:", message.id);
      } catch (e) {
        console.error("Failed to sync message to Supabase:", e);
      }
    }
  };

  const generateAndSetAutomatedTitle = async (chatId: string, prompt: string, response: string) => {
    try {
      console.log("[Nexa Client] Fetching automated title generation...");
      const res = await fetch("/api/generate-title", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, response }),
      });
      const data = await res.json();
      if (data && data.title) {
        const generatedTitle = data.title;
        console.log(`[Nexa Client] Setting automated title: "${generatedTitle}"`);
        setSessions((prev) =>
          prev.map((s) => {
            if (s.id === chatId) {
              const updatedChat = {
                ...s,
                title: generatedTitle,
                updatedAt: new Date().toISOString(),
              };
              syncChatSummaryToSupabase(updatedChat);
              return updatedChat;
            }
            return s;
          })
        );
      }
    } catch (e) {
      console.error("[Nexa Client] Failed to generate automated title:", e);
    }
  };

  // Apply Theme CSS triggers on mounted or update
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [settings.theme]);

  // Helper to remove guest states on login
  const clearGuestCache = () => {
    console.log("[Nexa Client] [LOG] Removing guest local storage and session storage state keys to prevent session bleed.");
    safeStorage.removeItem("nexa_sessions");
    safeStorage.removeItem("nexa_active_session_id");
    safeStorage.removeItem("nexa_sessions_guest");
    safeStorage.removeItem("nexa_active_session_id_guest");
    safeStorage.removeItem("nexa_sessions_guest@nexa.ai");
    safeStorage.removeItem("nexa_active_session_id_guest@nexa.ai");
    try {
      localStorage.removeItem("nexa_sessions");
      localStorage.removeItem("nexa_active_session_id");
      localStorage.removeItem("nexa_sessions_guest");
      localStorage.removeItem("nexa_active_session_id_guest");
      localStorage.removeItem("nexa_sessions_guest@nexa.ai");
      localStorage.removeItem("nexa_active_session_id_guest@nexa.ai");
      sessionStorage.removeItem("nexa_sessions");
      sessionStorage.removeItem("nexa_active_session_id");
      sessionStorage.removeItem("nexa_user");
    } catch (e) {}
  };

  // Real-time Chat Subscription based on Auth User status
  useEffect(() => {
    // Clean up previous listeners if any
    if (chatsUnsubscribeRef.current) {
      chatsUnsubscribeRef.current();
      chatsUnsubscribeRef.current = null;
    }

    if (!user) return;

    if (!user.isGuest && user.uid) {
      console.log("[Nexa Client] [LOG] User is authenticated. Subscribing to Supabase chats for email:", user.email);
      
      // Close auth modal because the user is successfully authenticated!
      setShowAuth(false);
      
      // Remove Guest cached data to avoid state leakage
      clearGuestCache();

      // Hydrate from localStorage for instant display
      const currentUid = user.uid;
      const cached = safeStorage.getItem(`nexa_sessions_${currentUid}`) || safeStorage.getItem("nexa_sessions");
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as ChatSession[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            setSessions(parsed);
            const cachedActive = safeStorage.getItem(`nexa_active_session_id_${currentUid}`);
            if (cachedActive && parsed.some((s) => s.id === cachedActive)) {
              setActiveSessionId(cachedActive);
            } else if (parsed.length > 0) {
              setActiveSessionId(parsed[0].id);
            }
          }
        } catch (e) {
          console.error("[Nexa Client] Local hydration error:", e);
        }
      }

      const loadChats = async () => {
        if (isLoadingRef.current || isGeneratingRef.current) {
          console.log("[Nexa Client] Skip loadChats during active stream (start).");
          return;
        }
        try {
          const summaries = await fetchChatsFromSupabase(user.email || "");
          
          if (isLoadingRef.current || isGeneratingRef.current) {
            console.log("[Nexa Client] Skip loadChats during active stream (post-fetch).");
            return;
          }

          if (summaries.length === 0) {
            if (sessionsRef.current.length > 0) {
              console.log("[Nexa Client] summaries is empty, but local sessions exist. Skipping seeding default chat.");
              return;
            }
            const localCheck = safeStorage.getItem(`nexa_sessions_${currentUid}`);
            if (localCheck) {
              try {
                const parsedLocal = JSON.parse(localCheck);
                if (Array.isArray(parsedLocal) && parsedLocal.length > 0) {
                  console.log("[Nexa Client] summaries is empty, but localStorage sessions exist. Skipping seeding default chat.");
                  return;
                }
              } catch (e) {}
            }
            console.log("[Nexa Client] [LOG] Supabase chats is empty and no local sessions exist. Seeding default starter chat.");
            const defaultId = `session-${Date.now()}`;
            const defaultChat: ChatSession = {
              id: defaultId,
              title: "Start an Intelligent Chat",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              isPinned: false,
              pinOrder: null,
              mode: "general",
              selectedEngineId: null,
              userEmail: user.email || "",
              messages: [],
            };
            await syncChatToSupabase(defaultChat, user.email || "");
            setSessions([defaultChat]);
            setActiveSessionId(defaultId);
            return;
          }

          // Sort chat summaries by pinned and updatedAt
          summaries.sort((a, b) => {
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;
            if (a.isPinned && b.isPinned) {
              return (a.pinOrder ?? 0) - (b.pinOrder ?? 0);
            }
            return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
          });

          let mergedSessionsResult: ChatSession[] = [];
          setSessions((prevSessions) => {
            if (isLoadingRef.current || isGeneratingRef.current) {
              return prevSessions;
            }
            const merged = summaries.map((summary) => {
              const existing = prevSessions.find((s) => s.id === summary.id);
              return {
                ...summary,
                messages: existing && existing.messages && existing.messages.length > 0 ? existing.messages : summary.messages,
              };
            });

            const localOnly = prevSessions.filter(
              (s) => !summaries.some((sum) => sum.id === s.id)
            );

            mergedSessionsResult = [...localOnly, ...merged];
            return mergedSessionsResult;
          });

          // Ensure activeSessionId remains preserved on existing sessions
          setActiveSessionId((currentId) => {
            if (isLoadingRef.current || isGeneratingRef.current) {
              return currentId;
            }
            if (currentId && (mergedSessionsResult.some((s) => s.id === currentId) || summaries.some((s) => s.id === currentId))) {
              return currentId;
            }
            const cachedActiveId = safeStorage.getItem(`nexa_active_session_id_${user.uid}`);
            if (cachedActiveId && (mergedSessionsResult.some((s) => s.id === cachedActiveId) || summaries.some((s) => s.id === cachedActiveId))) {
              return cachedActiveId;
            }
            if (mergedSessionsResult.length > 0) {
              return mergedSessionsResult[0].id;
            }
            return summaries.length > 0 ? summaries[0].id : "";
          });
        } catch (error) {
          console.error("[Nexa Client] [LOG] Supabase chats load error:", error);
        }

        // Fetch deleted chats on load or user update
        try {
          setIsDeletedLoading(true);
          const deleted = await fetchDeletedChatsAndMessages(user.email || "");
          setDeletedSessions(deleted);
        } catch (e) {
          console.error("[Nexa Client] Failed to load deleted chats on user change:", e);
        } finally {
          setIsDeletedLoading(false);
        }
      };

      loadChats();
      const pollInterval = setInterval(loadChats, 3500);
      chatsUnsubscribeRef.current = () => clearInterval(pollInterval);
    } else {
      // User is Guest Mode
      console.log("[Nexa Client] [LOG] Entering Guest Mode. Subscribing to cached guest sessions.");
      
      // Load guest sessions
      let loadedSessions: ChatSession[] = [];
      let cached = safeStorage.getItem("nexa_sessions_guest@nexa.ai") || safeStorage.getItem("nexa_sessions");
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as ChatSession[];
          if (parsed && parsed.length > 0) {
            loadedSessions = parsed;
          }
        } catch (e) {
          console.error("[Nexa Client] [LOG] Failed to parse guest sessions:", e);
        }
      }

      // If no guest sessions, seed a default one
      if (loadedSessions.length === 0) {
        const newId = `session-${Date.now()}`;
        loadedSessions = [{
          id: newId,
          title: "Core Assistant Chat",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messages: [],
          isPinned: false,
          mode: "general",
        }];
      }

      setSessions(loadedSessions);

      // Load guest deleted sessions from local storage
      let loadedDeleted: ChatSession[] = [];
      const cachedDeleted = safeStorage.getItem("nexa_deleted_sessions_guest");
      if (cachedDeleted) {
        try {
          loadedDeleted = JSON.parse(cachedDeleted);
        } catch (e) {
          console.error("[Nexa Client] Failed to parse guest deleted sessions:", e);
        }
      }
      setDeletedSessions(loadedDeleted);

      // Restore activeSessionId for Guest
      const cachedActiveId = safeStorage.getItem("nexa_active_session_id_guest@nexa.ai") || safeStorage.getItem("nexa_active_session_id");
      if (cachedActiveId && loadedSessions.some((s) => s.id === cachedActiveId)) {
        setActiveSessionId(cachedActiveId);
      } else {
        setActiveSessionId(loadedSessions[0].id);
      }
    }

    return () => {
      if (chatsUnsubscribeRef.current) {
        chatsUnsubscribeRef.current();
        chatsUnsubscribeRef.current = null;
      }
    };
  }, [user?.uid, user?.email, user?.isGuest]);

  // Subscribe to the messages of the active session in real-time
  useEffect(() => {
    if (messagesUnsubscribeRef.current) {
      messagesUnsubscribeRef.current();
      messagesUnsubscribeRef.current = null;
    }

    if (user && !user.isGuest && user.uid && activeSessionId) {
      console.log("[Nexa Client] Subscribing to Supabase messages for chat:", activeSessionId);
      
      const loadMessages = async () => {
        if (isLoadingRef.current || isGeneratingRef.current) {
          console.log("[Nexa Client] Skip loadMessages during active stream (start).");
          return;
        }
        try {
          const fetchedMessages = await fetchMessagesFromSupabase(activeSessionId);

          if (isLoadingRef.current || isGeneratingRef.current) {
            console.log("[Nexa Client] Skip loadMessages during active stream (post-fetch).");
            return;
          }

          // Chronological sorting of messages
          fetchedMessages.sort((a, b) => {
            const getNum = (id: string) => {
              const match = id.match(/\d+/);
              return match ? parseInt(match[0], 10) : 0;
            };
            return getNum(a.id) - getNum(b.id);
          });

          setSessions((prevSessions) => {
            if (isLoadingRef.current || isGeneratingRef.current) {
              console.log("[Nexa Client] Skip setSessions inside loadMessages during active stream.");
              return prevSessions;
            }
            return prevSessions.map((s) => {
              if (s.id === activeSessionId) {
                if (fetchedMessages.length === 0 && s.messages.length > 0) {
                  return s; // Keep existing local messages
                }

                // Combine local and remote messages by unique ID
                const msgMap = new Map<string, Message>();
                s.messages.forEach((m) => msgMap.set(m.id, m));
                fetchedMessages.forEach((m) => msgMap.set(m.id, m));
                const combined = Array.from(msgMap.values());

                combined.sort((a, b) => {
                  const getNum = (id: string) => {
                    const match = id.match(/\d+/);
                    return match ? parseInt(match[0], 10) : 0;
                  };
                  return getNum(a.id) - getNum(b.id);
                });

                if (JSON.stringify(s.messages) !== JSON.stringify(combined)) {
                  console.log(
                    `[Nexa Client] [loadMessages] Merged messages for ${s.id}. ` +
                    `Local count: ${s.messages.length}, Combined count: ${combined.length}`
                  );
                  return {
                    ...s,
                    messages: combined,
                  };
                }
              }
              return s;
            });
          });
        } catch (error) {
          console.error("Messages fetch error:", error);
        }
      };

      loadMessages();
      const pollInterval = setInterval(loadMessages, 3500);
      messagesUnsubscribeRef.current = () => clearInterval(pollInterval);
    }

    return () => {
      if (messagesUnsubscribeRef.current) {
        messagesUnsubscribeRef.current();
        messagesUnsubscribeRef.current = null;
      }
    };
  }, [activeSessionId, user?.uid, user?.email, user?.isGuest]);

  // --- WebSocket & Real-Time Sharing Coordination Effect ---
  useEffect(() => {
    if (!activeSessionId || !user) {
      setIsSharedSession(false);
      setSharedRole(null);
      setSharedParticipants([]);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      return;
    }

    let isSubscribed = true;
    let ws: WebSocket | null = null;

    const checkSharingAndConnect = async () => {
      try {
        const res = await fetch(`/api/share/info/${activeSessionId}?email=${encodeURIComponent(user.email || "")}`);
        const data = await res.json();
        
        if (!isSubscribed) return;

        if (data.success && data.isShared && data.config?.isSharingActive) {
          setIsSharedSession(true);
          const config = data.config;
          const userEmail = (user.email || "").toLowerCase().trim();
          const targetChatId = data.actualChatId || activeSessionId;
          
          let role: 'owner' | 'editor' | 'viewer' = 'viewer';
          if (config.ownerEmail === userEmail) {
            role = 'owner';
          } else {
            const p = config.participants?.find((part: any) => part.email === userEmail);
            if (p) {
              role = p.role;
            } else if (config.defaultPermission === "chat") {
              role = 'editor';
            }
          }
          setSharedRole(role);
          setSharedParticipants(config.participants || []);

          // Fetch latest shared session messages to ensure synchronization
          const hashToken = window.location.hash.includes("#share=") ? window.location.hash.split("#share=")[1] : "";
          const tokenParam = joinTokenInput || hashToken || config.shareToken || "";
          
          const sessionRes = await fetch(`/api/share/session/${targetChatId}?email=${encodeURIComponent(user.email || "")}&token=${encodeURIComponent(tokenParam)}`);
          const sessionData = await sessionRes.json();
          if (sessionData.success && sessionData.session && isSubscribed) {
            setSessions((prev) => {
              const exists = prev.some((s) => s.id === targetChatId);
              const formattedSession = {
                id: sessionData.session.id,
                title: sessionData.session.title || "Collaborative Chat",
                createdAt: sessionData.session.createdAt || new Date().toISOString(),
                updatedAt: sessionData.session.updatedAt || new Date().toISOString(),
                isPinned: false,
                mode: sessionData.session.mode || "general",
                selectedEngineId: sessionData.session.selectedEngineId || null,
                userEmail: sessionData.session.userEmail || "",
                messages: sessionData.session.messages || [],
                isShared: true,
              };

              if (exists) {
                return prev.map((s) => {
                  if (s.id === targetChatId) {
                    return {
                      ...s,
                      title: formattedSession.title,
                      messages: formattedSession.messages,
                      mode: formattedSession.mode,
                    };
                  }
                  return s;
                });
              } else {
                return [formattedSession, ...prev];
              }
            });
          } else if (!sessionData.success) {
            console.warn("[Nexa Client] Could not fetch shared session:", sessionData.error);
          }

          // Connect to WebSocket
          if (wsRef.current) {
            wsRef.current.close();
          }

          const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
          const wsUrl = `${protocol}//${window.location.host}`;
          ws = new WebSocket(wsUrl);
          wsRef.current = ws;

          ws.onopen = () => {
            console.log("[Nexa WS client] Connected successfully to share room:", activeSessionId);
            ws?.send(
              JSON.stringify({
                type: "join-room",
                chatId: activeSessionId,
                user: {
                  email: user.email,
                  fullName: user.fullName,
                },
              })
            );
          };

          ws.onmessage = (event) => {
            try {
              const payload = JSON.parse(event.data);
              console.log("[Nexa WS client] Message received:", payload);
              
              if (payload.type === "presence-update") {
                if (isSubscribed) {
                  setSharedParticipants(payload.participants || []);
                }
              } else if (payload.type === "message-sync") {
                if (isSubscribed) {
                  const message = payload.message;
                  setSessions((prev) =>
                    prev.map((s) => {
                      if (s.id === activeSessionId) {
                        const exists = s.messages.some((m) => m.id === message.id);
                        let updatedMsgs;
                        if (exists) {
                          updatedMsgs = s.messages.map((m) => m.id === message.id ? message : m);
                        } else {
                          updatedMsgs = [...s.messages, message];
                        }
                        return {
                          ...s,
                          messages: updatedMsgs,
                          updatedAt: new Date().toISOString(),
                        };
                      }
                      return s;
                    })
                  );
                }
              } else if (payload.type === "notification") {
                console.info("[Nexa Collaboration Info]", payload.message);
              } else if (payload.type === "revoked") {
                alert(payload.message || "This sharing session was revoked by the owner.");
                setIsSharedSession(false);
                setSharedRole(null);
                ws?.close();
              }
            } catch (err) {
              console.error("[Nexa WS client] Error parsing event data:", err);
            }
          };

          ws.onclose = () => {
            console.log("[Nexa WS client] Socket closed for room:", activeSessionId);
          };

          ws.onerror = (err) => {
            console.error("[Nexa WS client] Socket error occurred:", err);
          };

        } else {
          setIsSharedSession(false);
          setSharedRole(null);
          setSharedParticipants([]);
          if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
          }
        }
      } catch (err) {
        console.error("Error updating sharing metadata:", err);
      }
    };

    checkSharingAndConnect();

    return () => {
      isSubscribed = false;
      if (ws) {
        ws.close();
      }
      if (wsRef.current === ws) {
        wsRef.current = null;
      }
    };
  }, [activeSessionId, user]);

  useEffect(() => {
    console.log("[Nexa Restorations Debug] [settings update] Settings state updated:", settings);
    safeStorage.setItem("nexa_settings", JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    if (isAuthLoading) return;
    if (sessions.length === 0) return; // Don't persist empty state over valid cache
    const currentUid = user?.isGuest ? "guest@nexa.ai" : (user?.uid || "guest@nexa.ai");
    
    if (currentUid) {
      lastWriteUidRef.current = currentUid;
      safeStorage.setItem(`nexa_sessions_${currentUid}`, JSON.stringify(sessions));
      if (activeSessionId) {
        safeStorage.setItem(`nexa_active_session_id_${currentUid}`, activeSessionId);
      }
    }
  }, [sessions, activeSessionId, user, isAuthLoading]);

  useEffect(() => {
    console.log("[Nexa Restorations Debug] [admin metrics update] Admin metrics updated.");
    safeStorage.setItem("nexa_admin_metrics", JSON.stringify(adminMetrics));
  }, [adminMetrics]);

  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0] || ({ id: "", title: "", messages: [], mode: "general", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), isPinned: false } as ChatSession);

  // Auto-repair activeSessionId if out of sync with sessions list
  useEffect(() => {
    if (sessions.length > 0 && (!activeSessionId || !sessions.some((s) => s.id === activeSessionId))) {
      console.log("[Nexa Fix] Repairing activeSessionId to match existing session:", sessions[0].id);
      setActiveSessionId(sessions[0].id);
    }
  }, [sessions, activeSessionId]);

  const lastMessage = activeSession && Array.isArray(activeSession.messages) && activeSession.messages.length > 0
    ? activeSession.messages[activeSession.messages.length - 1]
    : undefined;
  const lastMessageContent = lastMessage?.content;
  const lastMessageRole = lastMessage?.role;
  const messageCount = activeSession && Array.isArray(activeSession.messages) ? activeSession.messages.length : 0;

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

  // Triggered when opening a session to match sidebar toggle mode
  useEffect(() => {
    if (activeSession && activeSession.mode) {
      setActiveMode(activeSession.mode);
    }
  }, [activeSessionId, activeSession?.mode]);

  // Play Premium Modal Open sound
  useEffect(() => {
    if (showPremium) {
      playUiSound("premium_modal_open");
    }
  }, [showPremium]);

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
    updateUser(newUser);
  };

  const triggerActionTracking = (
    actionType: "send_message" | "complete_research" | "complete_study" | "complete_quiz" | "complete_fact_check",
    payload?: { engineId?: string; correctAnswers?: number; totalQuestions?: number }
  ) => {
    contextTriggerActionTracking(actionType, payload, (badge) => {
      setUnlockedBadgesToast({
        id: badge.id,
        title: badge.title,
        description: badge.description,
        pointsAwarded: badge.pointsAwarded,
      });
      playUiSound("notification_received");
    });
  };

  const handleCompleteQuiz = (score: number, totalQuestions: number) => {
    triggerActionTracking("complete_quiz", { correctAnswers: score, totalQuestions: totalQuestions });
  };

  const handleLogout = () => {
    console.log("[Nexa Client] [LOG] handleLogout invoked. Guest Mode trigger reason: user logged out");
    playUiSound("logout");
    logout();
  };

  // Chat Session management controls
  const handleNewSession = (mode: ChatSession["mode"] = "general") => {
    console.log("[Nexa Debug] [createConversation] handleNewSession called with mode:", mode);
    
    // Check if current active session is already empty
    const currentActive = sessions.find((s) => s.id === activeSessionId);
    if (currentActive && currentActive.messages.length === 0) {
      console.log("[Nexa Debug] Currently active session is already empty, reusing it:", currentActive.id);
      setSessions((prev) =>
        prev.map((s) => (s.id === currentActive.id ? { ...s, mode } : s))
      );
      setActiveMode(mode);
      setAttachment(null);
      setCurrentView("chat");
      return;
    }

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
          : mode === "writing"
          ? "Drafting Workspace"
          : "MCQ Quiz Arena",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
      isPinned: false,
      mode: mode,
      userEmail: user && !user.isGuest ? user.email || "" : undefined,
    };

    setSessions((prev) => [newChat, ...prev]);
    setActiveSessionId(newId);
    setActiveMode(mode);
    setAttachment(null);
    setCurrentView("chat");

    if (user && !user.isGuest && user.email) {
      syncChatToSupabase(newChat, user.email);
    }
  };

  const fetchDeletedChatsAndMessages = async (email: string) => {
    try {
      const deletedChats = await fetchDeletedChatsFromSupabase(email);
      const chatsWithMessages = await Promise.all(
        deletedChats.map(async (chat) => {
          try {
            const msgs = await fetchMessagesFromSupabase(chat.id);
            return { ...chat, messages: msgs };
          } catch (e) {
            console.error("Failed to fetch messages for deleted chat:", chat.id, e);
            return chat;
          }
        })
      );
      return chatsWithMessages;
    } catch (err) {
      console.error("Failed to fetch deleted chats and messages:", err);
      return [];
    }
  };

  const handleDeleteSession = async (id: string) => {
    playUiSound("error");
    const sessionToDelete = sessions.find((s) => s.id === id);
    if (!sessionToDelete) return;

    const deletedAt = new Date().toISOString();
    const autoDeleteAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const updatedSession: ChatSession = {
      ...sessionToDelete,
      isDeleted: true,
      deletedAt,
      autoDeleteAt,
      updatedAt: deletedAt,
    };

    const remaining = sessions.filter((s) => s.id !== id);

    if (user && !user.isGuest && user.uid) {
      try {
        await syncChatToSupabase(updatedSession, user.email || "");
        console.log("[Nexa Client] Soft deleted session in Supabase:", id);
      } catch (e) {
        console.error("Failed to soft delete session in Supabase:", e);
      }
    } else {
      // Guest local storage soft delete
      const updatedDeletedSessions = [updatedSession, ...deletedSessions];
      setDeletedSessions(updatedDeletedSessions);
      safeStorage.setItem("nexa_deleted_sessions_guest", JSON.stringify(updatedDeletedSessions));
      
      const updatedActiveSessions = remaining.length === 0 ? [] : remaining;
      safeStorage.setItem("nexa_sessions_guest@nexa.ai", JSON.stringify(updatedActiveSessions));
    }

    if (remaining.length === 0) {
      const freshId = `session-${Date.now()}`;
      const freshSession: ChatSession = {
        id: freshId,
        title: "Start an Intelligent Chat",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: [],
        isPinned: false,
        mode: "general",
      };
      setSessions([freshSession]);
      setActiveSessionId(freshId);
      setActiveMode("general");
      if (user && !user.isGuest && user.uid) {
        await syncChatToSupabase(freshSession, user.email || "");
      }
    } else {
      setSessions(remaining);
      if (activeSessionId === id) {
        const nextSession = remaining[0];
        setActiveSessionId(nextSession.id);
        setActiveMode(nextSession.mode || "general");
      }
    }

    setUndoToast({
      message: `Chat "${sessionToDelete.title}" moved to Recently Deleted.`,
      action: () => {
        handleRestoreSession(id);
      },
      actionLabel: "Undo",
    });

    if (user && !user.isGuest && user.uid) {
      try {
        const deleted = await fetchDeletedChatsAndMessages(user.email || "");
        setDeletedSessions(deleted);
      } catch (err) {
        console.error("Error reloading deleted chats:", err);
      }
    }
  };

  const handleRestoreSession = async (id: string) => {
    playUiSound("success");
    
    const chatToRestore = deletedSessions.find((s) => s.id === id);
    if (!chatToRestore) return;

    const restoredSession: ChatSession = {
      ...chatToRestore,
      isDeleted: false,
      deletedAt: undefined,
      autoDeleteAt: undefined,
      updatedAt: new Date().toISOString(),
    };

    const remainingDeleted = deletedSessions.filter((s) => s.id !== id);
    setDeletedSessions(remainingDeleted);

    if (user && !user.isGuest && user.uid) {
      try {
        await syncChatToSupabase(restoredSession, user.email || "");
        console.log("[Nexa Client] Restored chat session in Supabase:", id);
        
        const activeSummaries = await fetchChatsFromSupabase(user.email || "");
        setSessions(() => {
          return activeSummaries.map((summary) => {
            if (summary.id === id && chatToRestore) {
              return {
                ...summary,
                messages: chatToRestore.messages || [],
              };
            }
            return summary;
          });
        });
        
        setActiveSessionId(id);
        setCurrentView("chat");
        setActiveMode(restoredSession.mode || "general");
      } catch (e) {
        console.error("Failed to restore chat session in Supabase:", e);
      }
    } else {
      safeStorage.setItem("nexa_deleted_sessions_guest", JSON.stringify(remainingDeleted));

      const currentActive = sessions.filter(s => s.messages.length > 0 || s.id !== activeSessionId);
      const updatedActive = [restoredSession, ...currentActive];
      
      setSessions(updatedActive);
      safeStorage.setItem("nexa_sessions_guest@nexa.ai", JSON.stringify(updatedActive));
      
      setActiveSessionId(id);
      setCurrentView("chat");
      setActiveMode(restoredSession.mode || "general");
    }

    setUndoToast({
      message: `Chat "${restoredSession.title}" restored successfully.`,
      action: () => {
        handleDeleteSession(id);
      },
      actionLabel: "Undo",
    });
  };

  const handleDeleteSessionForever = async (id: string) => {
    playUiSound("success");

    const chatToDelete = deletedSessions.find((s) => s.id === id);
    const title = chatToDelete ? chatToDelete.title : "Chat";

    const remainingDeleted = deletedSessions.filter((s) => s.id !== id);
    setDeletedSessions(remainingDeleted);

    if (user && !user.isGuest && user.uid) {
      try {
        await deleteChatFromSupabase(id);
        console.log("[Nexa Client] Permanently deleted chat from Supabase:", id);
      } catch (e) {
        console.error("Failed to permanently delete chat from Supabase:", e);
      }
    } else {
      safeStorage.setItem("nexa_deleted_sessions_guest", JSON.stringify(remainingDeleted));
    }

    setUndoToast({
      message: `Chat "${title}" deleted permanently.`,
      action: () => {},
      actionLabel: "",
    });
  };

  const handleEmptyAllRecentlyDeleted = async () => {
    playUiSound("success");

    const count = deletedSessions.length;
    setDeletedSessions([]);

    if (user && !user.isGuest && user.uid) {
      try {
        await Promise.all(
          deletedSessions.map((chat) => deleteChatFromSupabase(chat.id))
        );
        console.log("[Nexa Client] Emptied all deleted chats from Supabase.");
      } catch (e) {
        console.error("Failed to empty all deleted chats from Supabase:", e);
      }
    } else {
      safeStorage.setItem("nexa_deleted_sessions_guest", JSON.stringify([]));
    }

    setUndoToast({
      message: `Recycle Bin emptied. ${count} chats deleted permanently.`,
      action: () => {},
      actionLabel: "",
    });
  };

  const cleanupExpiredChats = async () => {
    const now = Date.now();
    console.log("[Nexa Client] Running auto-cleanup scan for expired deleted chats...");

    if (user && !user.isGuest && user.uid) {
      try {
        const deleted = await fetchDeletedChatsFromSupabase(user.email || "");
        const expired = deleted.filter((chat) => {
          if (!chat.autoDeleteAt) return false;
          return new Date(chat.autoDeleteAt).getTime() <= now;
        });

        if (expired.length > 0) {
          console.log(`[Nexa Client] Found ${expired.length} expired chats to auto-purge:`, expired.map(e => e.id));
          await Promise.all(expired.map((chat) => deleteChatFromSupabase(chat.id)));
          
          const refreshedDeleted = await fetchDeletedChatsAndMessages(user.email || "");
          setDeletedSessions(refreshedDeleted);
        }
      } catch (e) {
        console.error("[Nexa Client] Failed to auto-cleanup expired chats from Supabase:", e);
      }
    } else {
      let cachedDeleted: ChatSession[] = [];
      const cached = safeStorage.getItem("nexa_deleted_sessions_guest");
      if (cached) {
        try {
          cachedDeleted = JSON.parse(cached);
        } catch (e) {
          console.error("Failed to parse cached deleted sessions for guest auto-cleanup", e);
        }
      }

      const activeDeleted = cachedDeleted.filter((chat) => {
        const baseDate = chat.deletedAt ? new Date(chat.deletedAt) : new Date();
        const autoDeleteAt = chat.autoDeleteAt 
          ? new Date(chat.autoDeleteAt).getTime() 
          : baseDate.getTime() + 30 * 24 * 60 * 60 * 1000;
        return autoDeleteAt > now;
      });

      const purgedCount = cachedDeleted.length - activeDeleted.length;
      if (purgedCount > 0) {
        console.log(`[Nexa Client] Auto-purged ${purgedCount} expired guest chats.`);
        setDeletedSessions(activeDeleted);
        safeStorage.setItem("nexa_deleted_sessions_guest", JSON.stringify(activeDeleted));
      }
    }
  };

  const handleRenameSession = (id: string, newTitle: string) => {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id === id) {
          const updated = { ...s, title: newTitle, updatedAt: new Date().toISOString() };
          syncChatSummaryToSupabase(updated);
          return updated;
        }
        return s;
      })
    );
  };

  const handleToggleArchive = (id: string) => {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id === id) {
          const isArchived = !(s as any).isArchived;
          const updatedChat = {
            ...s,
            isArchived,
            updatedAt: new Date().toISOString(),
          };
          syncChatSummaryToSupabase(updatedChat);
          
          setCustomToast({
            title: isArchived ? "Chat Archived" : "Chat Restored",
            message: isArchived 
              ? `"${s.title}" has been moved to your archive.` 
              : `"${s.title}" has been restored to your recent chats.`,
            type: "success",
          });
          
          return updatedChat;
        }
        return s;
      })
    );
    
    // If the archived chat is currently active, switch to the first remaining active chat
    setTimeout(() => {
      setSessions((currentSessions) => {
        const active = currentSessions.find((s) => s.id === activeSessionId);
        if (active && (active as any).isArchived) {
          const remainingActive = currentSessions.filter((s) => !(s as any).isArchived);
          if (remainingActive.length > 0) {
            setActiveSessionId(remainingActive[0].id);
            setActiveMode(remainingActive[0].mode || "general");
          } else {
            // Create fresh session if no active sessions remain
            handleNewSession("general");
          }
        }
        return currentSessions;
      });
    }, 50);
  };

  const handleToggleFavorite = (id: string) => {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id === id) {
          const isFavorite = !(s as any).isFavorite;
          const updatedChat = {
            ...s,
            isFavorite,
            updatedAt: new Date().toISOString(),
          };
          syncChatSummaryToSupabase(updatedChat);
          
          setCustomToast({
            title: isFavorite ? "Added to Favorites" : "Removed from Favorites",
            message: isFavorite 
              ? `"${s.title}" is now starred.` 
              : `"${s.title}" has been removed from favorites.`,
            type: "success",
          });
          
          return updatedChat;
        }
        return s;
      })
    );
  };

  const handleDuplicateSession = (id: string) => {
    const original = sessions.find((s) => s.id === id);
    if (!original) return;
    
    const duplicateId = `session-${Date.now()}`;
    const duplicate: ChatSession = {
      ...original,
      id: duplicateId,
      title: `${original.title} (Copy)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isPinned: false,
      isDeleted: false,
    };
    (duplicate as any).isArchived = false;
    (duplicate as any).isFavorite = false;
    
    setSessions((prev) => [duplicate, ...prev]);
    setActiveSessionId(duplicateId);
    setActiveMode(duplicate.mode || "general");
    setCurrentView("chat");
    
    syncChatSummaryToSupabase(duplicate);
    
    // Duplicate messages in db too
    original.messages.forEach((msg) => {
      if (user && !user.isGuest && user.uid) {
        syncMessageToSupabase(duplicateId, msg);
      }
    });

    setCustomToast({
      title: "Conversation Duplicated",
      message: `"${original.title}" duplicated successfully.`,
      type: "success",
    });
    playUiSound("success");
  };

  const handlePinSession = (id: string) => {
    const sessionToPin = sessions.find((s) => s.id === id);
    if (!sessionToPin) return;

    if (!sessionToPin.isPinned) {
      const pinnedCount = sessions.filter((s) => s.isPinned).length;
      if (pinnedCount >= 10) {
        setCustomToast({
          title: "Pin Limit Reached",
          message: "You can pin up to 10 chats. Unpin an existing chat to pin another.",
          type: "warning",
        });
        return;
      }
    }

    setSessions((prev) => {
      const updated = prev.map((s) => {
        if (s.id === id) {
          const newPinned = !s.isPinned;
          const updatedChat = {
            ...s,
            isPinned: newPinned,
            pinOrder: newPinned ? Date.now() : undefined,
            updatedAt: new Date().toISOString(),
          };
          syncChatSummaryToSupabase(updatedChat);
          return updatedChat;
        }
        return s;
      });
      return updated;
    });
  };

  const handleReorderSessions = (updatedSessions: ChatSession[]) => {
    setSessions(updatedSessions);
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
  const handleAuthSuccess = (authenticatedUser: UserProfile, cloudChats?: ChatSession[]) => {
    console.log("[Nexa Client] [LOG] handleAuthSuccess triggered for user:", authenticatedUser.email);
    playUiSound("login_success");
    clearGuestCache();
    setShowAuth(false);
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

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

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
      const otherSessionsPayload = sessions
        .filter((s) => s.id !== activeSessionId && s.messages && s.messages.length > 0)
        .map((s) => ({
          id: s.id,
          title: s.title,
          mode: s.mode,
          messages: s.messages.slice(-3).map((m) => ({ role: m.role, content: m.content })),
        }));

      const payload = {
        messages: feedMessages,
        mode: activeMode,
        explainLikeIm10: explainLikeIm10,
        writingStyle: writingStyle,
        quizTopic: activeMode === "quiz" ? quizTopic : "",
        quizDifficulty: quizDifficulty,
        personalizationContext: settings.personalizationNotes,
        turboMode: settings.turboMode !== false,
        otherSessions: otherSessionsPayload,
      };

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const data = await response.json();

      setIsLoading(false);
      setIsGenerating(true);

      const updatedMsg: Message = {
        ...activeSession.messages[idx],
        content: "",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        engineId: data.engineId || "core",
        sources: data.sources || undefined,
        factCheck: data.factCheck || undefined,
        researchReport: data.researchReport || undefined,
        quiz: data.quiz || undefined,
      };

      setSessions((prev) =>
        prev.map((s) => {
          if (s.id === activeSessionId) {
            const updatedMsgs = [...s.messages];
            updatedMsgs[idx] = updatedMsg;
            return {
              ...s,
              messages: updatedMsgs,
              updatedAt: new Date().toISOString(),
            };
          }
          return s;
        })
      );

      // Start tokenized streaming
      const fullContent = data.content || "";
      const speedSetting = settingsRef.current.renderingSpeed || "turbo";

      if (speedSetting === "instant") {
        updateMessageContent(msgId, fullContent);
        setIsGenerating(false);
        const finalMsg = { ...updatedMsg, content: fullContent };
        triggerVoiceIfNeeded(finalMsg);
        syncMessageSummaryToSupabase(activeSessionId, finalMsg);
        syncChatSummaryToSupabase({
          ...activeSession,
          updatedAt: new Date().toISOString()
        });
      } else {
        const tokens = fullContent.split(/(\s+)/);
        let currentTokenIdx = 0;
        let currentText = "";

        if (streamIntervalRef.current) {
          clearInterval(streamIntervalRef.current);
        }

        let intervalMs = 20;
        let divisor = 80;
        let minTokens = 1;

        if (speedSetting === "slow") {
          intervalMs = 30;
          divisor = 100;
          minTokens = 1;
        } else if (speedSetting === "normal") {
          intervalMs = 20;
          divisor = 60;
          minTokens = 1;
        } else if (speedSetting === "fast") {
          intervalMs = 12;
          divisor = 30;
          minTokens = 2;
        } else if (speedSetting === "turbo") {
          intervalMs = 8;
          divisor = 12;
          minTokens = 4;
        }

        streamIntervalRef.current = setInterval(() => {
          if (currentTokenIdx >= tokens.length) {
            clearInterval(streamIntervalRef.current);
            streamIntervalRef.current = null;
            setIsGenerating(false);

            const finalMsg = { ...updatedMsg, content: fullContent };
            triggerVoiceIfNeeded(finalMsg);

            // Sync complete message to Supabase
            syncMessageSummaryToSupabase(activeSessionId, finalMsg);
            syncChatSummaryToSupabase({
              ...activeSession,
              updatedAt: new Date().toISOString()
            });
          } else {
            const tokensToAppend = Math.max(minTokens, Math.ceil((tokens.length - currentTokenIdx) / divisor));
            for (let i = 0; i < tokensToAppend && currentTokenIdx < tokens.length; i++) {
              currentText += tokens[currentTokenIdx];
              currentTokenIdx++;
            }
            updateMessageContent(msgId, currentText);
          }
        }, intervalMs);
      }

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
      if (err.name === "AbortError" || err.message?.includes("aborted")) {
        console.log("Regeneration aborted cleanly");
        return;
      }
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
            // Sync error message and chat summary to Supabase
            syncMessageSummaryToSupabase(activeSessionId, updatedMsgs[idx]);
            syncChatSummaryToSupabase({
              ...s,
              updatedAt: new Date().toISOString()
            });
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

  // Copy full conversation thread to clipboard
  const handleCopyAll = () => {
    if (!activeSession || !activeSession.messages || activeSession.messages.length === 0) return;

    const formattedThread = activeSession.messages
      .map((msg) => {
        const sender = msg.role === "user" ? (user?.fullName || "User Account") : "Nexa Intelligence";
        return `[${sender}] (${msg.timestamp}):\n${msg.content}`;
      })
      .join("\n\n----------------------------------------\n\n");

    const fullContent = `Conversation Title: ${activeSession.title}\nMode: ${activeSession.mode}\n========================================\n\n${formattedThread}\n\n========================================\nGenerated via Nexa Intelligence`;

    try {
      copyToClipboard(fullContent);
      setIsCopiedAll(true);
      playUiSound("success");
      setTimeout(() => setIsCopiedAll(false), 2000);
    } catch (e) {
      console.error("Failed to copy conversation thread:", e);
    }
  };

  // Message Quick Actions (Bookmark, share, translate, export)
  const handleMessageAction = (action: string, msgId: string) => {
    if (action === "share") {
      copyToClipboard(`${window.location.origin}/share/thread/${activeSessionId}#${msgId}`);
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
      playUiSound("download_completed");
    } else if (action.startsWith("translate")) {
      // Split parameters: messageId::Language
      const [id, lang] = action.split("::");
      const targetMsg = activeSession.messages.find((m) => m.id === id);
      if (!targetMsg) return;

      setInputPrompt(`Translate the above Nexa output into fluent ${lang}. Keep markdown styling and structural boldings intact.`);
      // Form submit will take this content
    } else if (action === "regenerate") {
      handleRegenerateMessage(msgId);
    } else if (action === "delete") {
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id === activeSessionId) {
            return {
              ...s,
              messages: s.messages.filter((m) => m.id !== msgId),
              updatedAt: new Date().toISOString(),
            };
          }
          return s;
        })
      );
      if (user && !user.isGuest && user.uid) {
        deleteMessageFromSupabase(msgId);
        syncChatSummaryToSupabase({
          ...activeSession,
          updatedAt: new Date().toISOString()
        });
      }
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
    const obsoleteMsgs = updatedMsgs.slice(idx + 1);
    updatedMsgs = [...updatedMsgs.slice(0, idx + 1), placeholderAssistantMsg];

    // Sync edited user message and placeholder assistant message immediately to Supabase
    syncMessageSummaryToSupabase(activeSessionId, updatedMsgs[idx]);
    syncMessageSummaryToSupabase(activeSessionId, placeholderAssistantMsg);

    if (user && !user.isGuest && user.uid) {
      // Delete obsolete trailing messages from Supabase
      for (const ob of obsoleteMsgs) {
        if (ob.id !== assistantId) {
          try {
            await deleteMessageFromSupabase(ob.id);
          } catch (e) {
            console.error("Failed to delete obsolete message from Supabase:", e);
          }
        }
      }
    }

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

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const otherSessionsPayload = sessions
        .filter((s) => s.id !== activeSessionId && s.messages && s.messages.length > 0)
        .map((s) => ({
          id: s.id,
          title: s.title,
          mode: s.mode,
          messages: s.messages.slice(-3).map((m) => ({ role: m.role, content: m.content })),
        }));

      const payload = {
        messages: feedMessages,
        mode: activeMode,
        explainLikeIm10: explainLikeIm10,
        writingStyle: writingStyle,
        quizTopic: activeMode === "quiz" ? quizTopic : "",
        quizDifficulty: quizDifficulty,
        personalizationContext: settings.personalizationNotes,
        turboMode: settings.turboMode !== false,
        otherSessions: otherSessionsPayload,
      };

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const data = await response.json();

      setIsLoading(false);
      setIsGenerating(true);

      const updatedMsg: Message = {
        id: assistantId,
        role: "assistant",
        content: "",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        engineId: data.engineId || "core",
        sources: data.sources || undefined,
        factCheck: data.factCheck || undefined,
        researchReport: data.researchReport || undefined,
        quiz: data.quiz || undefined,
      };

      setSessions((prev) =>
        prev.map((s) => {
          if (s.id === activeSessionId) {
            const currentMsgs = [...s.messages];
            const aIdx = currentMsgs.findIndex((m) => m.id === assistantId);
            if (aIdx !== -1) {
              currentMsgs[aIdx] = updatedMsg;
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

      // Start tokenized streaming
      const fullContent = data.content || "";
      const speedSetting = settingsRef.current.renderingSpeed || "turbo";

      if (speedSetting === "instant") {
        updateMessageContent(assistantId, fullContent);
        setIsGenerating(false);
        const finalMsg = { ...updatedMsg, content: fullContent };
        triggerVoiceIfNeeded(finalMsg);
        syncMessageSummaryToSupabase(activeSessionId, finalMsg);
        syncChatSummaryToSupabase({
          ...activeSession,
          updatedAt: new Date().toISOString()
        });
      } else {
        const tokens = fullContent.split(/(\s+)/);
        let currentTokenIdx = 0;
        let currentText = "";

        if (streamIntervalRef.current) {
          clearInterval(streamIntervalRef.current);
        }

        let intervalMs = 20;
        let divisor = 80;
        let minTokens = 1;

        if (speedSetting === "slow") {
          intervalMs = 30;
          divisor = 100;
          minTokens = 1;
        } else if (speedSetting === "normal") {
          intervalMs = 20;
          divisor = 60;
          minTokens = 1;
        } else if (speedSetting === "fast") {
          intervalMs = 12;
          divisor = 30;
          minTokens = 2;
        } else if (speedSetting === "turbo") {
          intervalMs = 8;
          divisor = 12;
          minTokens = 4;
        }

        streamIntervalRef.current = setInterval(() => {
          if (currentTokenIdx >= tokens.length) {
            clearInterval(streamIntervalRef.current);
            streamIntervalRef.current = null;
            setIsGenerating(false);

            const finalMsg = { ...updatedMsg, content: fullContent };
            triggerVoiceIfNeeded(finalMsg);

            // Sync the completed assistant message to Supabase
            syncMessageSummaryToSupabase(activeSessionId, finalMsg);
            syncChatSummaryToSupabase({
              ...activeSession,
              updatedAt: new Date().toISOString()
            });
          } else {
            const tokensToAppend = Math.max(minTokens, Math.ceil((tokens.length - currentTokenIdx) / divisor));
            for (let i = 0; i < tokensToAppend && currentTokenIdx < tokens.length; i++) {
              currentText += tokens[currentTokenIdx];
              currentTokenIdx++;
            }
            updateMessageContent(assistantId, currentText);
          }
        }, intervalMs);
      }

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
      if (err.name === "AbortError" || err.message?.includes("aborted")) {
        console.log("Edit prompt fetch aborted cleanly");
        return;
      }
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
              // Sync error message to Supabase
              syncMessageSummaryToSupabase(activeSessionId, currentMsgs[aIdx]);
              syncChatSummaryToSupabase({
                ...s,
                updatedAt: new Date().toISOString()
              });
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
              const updated = { ...m, reaction: reaction || undefined };
              syncMessageSummaryToSupabase(activeSessionId, updated);
              return updated;
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
        playUiSound("image_uploaded");
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
        playUiSound("file_uploaded");
      };
      reader.readAsText(file);
    }
  };

  const handleGrantComplete = (grantedStates: typeof permissions) => {
    setPermissions(grantedStates);
    safeStorage.setItem("nexa-device-permissions", JSON.stringify(grantedStates));
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

  const updateMessageContent = (targetChatIdOrMsgId: string, msgIdOrContent: string, contentOptional?: string) => {
    const targetChatId = contentOptional !== undefined ? targetChatIdOrMsgId : (activeSessionIdRef.current || activeSessionId);
    const msgId = contentOptional !== undefined ? msgIdOrContent : targetChatIdOrMsgId;
    const content = contentOptional !== undefined ? contentOptional : msgIdOrContent;

    setSessions((prev) =>
      prev.map((s) => {
        if (s.id === targetChatId) {
          return {
            ...s,
            messages: s.messages.map((m) => (m.id === msgId ? { ...m, content } : m)),
          };
        }
        return s;
      })
    );
  };

  const triggerVoiceIfNeeded = (msg: Message) => {
    if (voiceModeActiveRef.current) {
      setVoiceState("speaking");
      speakUtterance(msg.content, () => {
        if (voiceModeActiveRef.current) {
          setVoiceState("listening");
          startListeningSession();
        } else {
          setVoiceState("idle");
        }
      });
    } else if (settingsRef.current.voiceAutoPlay !== false) {
      speakUtterance(msg.content);
    }
  };

  const handleStopGenerating = () => {
    // 1. Abort fetch request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // 2. Clear streaming interval
    if (streamIntervalRef.current) {
      clearInterval(streamIntervalRef.current);
      streamIntervalRef.current = null;
    }

    // 3. Stop speech/voice playback if active
    if (voiceModeActiveRef.current || voiceStateRef.current !== "idle") {
      setVoiceModeActive(false);
      setVoiceState("idle");
      setIsListening(false);
      accumulatedTranscriptRef.current = "";
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    }

    // 4. Set states to idle
    setIsLoading(false);
    setIsGenerating(false);

    // 5. Clean up blinking cursor and save partial state to Supabase
    setSessions((prev) => {
      const currentSess = prev.find((s) => s.id === activeSessionId);
      if (currentSess && currentSess.messages && currentSess.messages.length > 0) {
        const lastMsg = currentSess.messages[currentSess.messages.length - 1];
        if (lastMsg && lastMsg.role === "assistant") {
          syncMessageSummaryToSupabase(activeSessionId, lastMsg);
          syncChatSummaryToSupabase({
            ...currentSess,
            updatedAt: new Date().toISOString()
          });
        }
      }
      return prev;
    });
  };

  // Submit Main Chat Trigger
  const handleChatSubmit = async (customPrompt?: string, customAttachment?: any) => {
    const promptToSend = customPrompt || inputPrompt;
    if (!promptToSend.trim() && !customAttachment) return;

    // Determine target session ID safely
    let targetChatId = activeSessionId;
    let currentSession = sessions.find((s) => s.id === targetChatId);

    if (!currentSession && sessions.length > 0) {
      currentSession = sessions[0];
      targetChatId = currentSession.id;
      setActiveSessionId(targetChatId);
    }

    if (!currentSession) {
      const newId = `session-${Date.now()}`;
      currentSession = {
        id: newId,
        title: promptToSend.substring(0, 36) + "...",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: [],
        isPinned: false,
        mode: activeMode || "general",
        userEmail: user && !user.isGuest ? user.email || "" : undefined,
      };
      targetChatId = newId;
      setSessions([currentSession]);
      setActiveSessionId(newId);
      syncChatSummaryToSupabase(currentSession);
    } else if (activeSessionId !== targetChatId) {
      setActiveSessionId(targetChatId);
    }

    console.log("[Nexa Debug] [Send Message] Target Chat ID:", targetChatId);

    if (voiceModeActiveRef.current) {
      setVoiceState("processing");
    }

    const currentAttachment = customAttachment || attachment;
    setIsLoading(true);
    setInputPrompt("");
    playUiSound("message_sent");

    const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    // Append User Message Log Card
    const newUserMsg: Message = {
      id: `usr-${Date.now()}`,
      role: "user",
      content: promptToSend,
      timestamp,
      attachment: currentAttachment ? { ...currentAttachment } : undefined,
    };

    const isFirstAssistantResponse = currentSession.messages.length === 0;
    const titleRename = isFirstAssistantResponse ? promptToSend.substring(0, 36) + "..." : currentSession.title;
    
    // Save user message immediately to Supabase subcollection & update parent metadata
    syncMessageSummaryToSupabase(targetChatId, newUserMsg);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "message-sync",
        chatId: targetChatId,
        message: newUserMsg
      }));
    }
    
    const updatedParentChat: ChatSession = {
      ...currentSession,
      title: titleRename,
      updatedAt: new Date().toISOString()
    };
    syncChatSummaryToSupabase(updatedParentChat);

    setSessions((prev) =>
      prev.map((s) => {
        if (s.id === targetChatId) {
          return {
            ...s,
            title: titleRename,
            messages: [...s.messages, newUserMsg],
            updatedAt: new Date().toISOString(),
          };
        }
        return s;
      })
    );

    setAttachment(null);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      // Build previous messages stream context list (limited to last 12 messages)
      const feedMessages = [...currentSession.messages, newUserMsg].slice(-12);

      const otherSessionsPayload = sessions
        .filter((s) => s.id !== targetChatId && s.messages && s.messages.length > 0)
        .map((s) => ({
          id: s.id,
          title: s.title,
          mode: s.mode,
          messages: s.messages.slice(-3).map((m) => ({ role: m.role, content: m.content })),
        }));

      // Call Express Fullstack proxy
      const payload = {
        messages: feedMessages,
        mode: activeMode,
        explainLikeIm10: explainLikeIm10,
        writingStyle: writingStyle,
        quizTopic: activeMode === "quiz" ? quizTopic : "",
        quizDifficulty: quizDifficulty,
        personalizationContext: settings.personalizationNotes,
        turboMode: settings.turboMode !== false,
        otherSessions: otherSessionsPayload,
      };

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const data = await response.json();

      if (data.content?.includes("![") || data.engineId === "vision") {
        playUiSound("image_generated");
      } else {
        playUiSound("ai_response_start");
      }

      setIsLoading(false);
      setIsGenerating(true);

      const assistantMsgId = `ast-${Date.now()}`;
      const newAssistantMsg: Message = {
        id: assistantMsgId,
        role: "assistant",
        content: "",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        engineId: data.engineId || "core",
        sources: data.sources || undefined,
        factCheck: data.factCheck || undefined,
        researchReport: data.researchReport || undefined,
        quiz: data.quiz || undefined,
      };

      // Append assistant message placeholder immediately
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id === targetChatId) {
            return {
              ...s,
              messages: [...s.messages, newAssistantMsg],
              updatedAt: new Date().toISOString(),
            };
          }
          return s;
        })
      );

      // Start tokenized streaming
      const fullContent = data.content || "";
      const speedSetting = settingsRef.current.renderingSpeed || "turbo";

      if (speedSetting === "instant") {
        updateMessageContent(targetChatId, assistantMsgId, fullContent);
        setIsGenerating(false);
        const finalMsg = { ...newAssistantMsg, content: fullContent };
        triggerVoiceIfNeeded(finalMsg);
        syncMessageSummaryToSupabase(targetChatId, finalMsg);
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: "message-sync",
            chatId: targetChatId,
            message: finalMsg
          }));
        }
        const finalParentChat: ChatSession = {
          ...updatedParentChat,
          updatedAt: new Date().toISOString()
        };
        syncChatSummaryToSupabase(finalParentChat);
        if (isFirstAssistantResponse) {
          generateAndSetAutomatedTitle(targetChatId, promptToSend, fullContent);
        }
      } else {
        const tokens = fullContent.split(/(\s+)/);
        let currentTokenIdx = 0;
        let currentText = "";

        if (streamIntervalRef.current) {
          clearInterval(streamIntervalRef.current);
        }

        console.log("[Nexa Debug] [Streaming Start] Initiating streaming for Conversation ID:", targetChatId);

        let intervalMs = 20;
        let divisor = 80;
        let minTokens = 1;

        if (speedSetting === "slow") {
          intervalMs = 30;
          divisor = 100;
          minTokens = 1;
        } else if (speedSetting === "normal") {
          intervalMs = 20;
          divisor = 60;
          minTokens = 1;
        } else if (speedSetting === "fast") {
          intervalMs = 12;
          divisor = 30;
          minTokens = 2;
        } else if (speedSetting === "turbo") {
          intervalMs = 8;
          divisor = 12;
          minTokens = 4;
        }

        streamIntervalRef.current = setInterval(() => {
          if (currentTokenIdx >= tokens.length) {
            clearInterval(streamIntervalRef.current);
            streamIntervalRef.current = null;
            setIsGenerating(false);

            console.log("[Nexa Debug] [Stream Finished] Conversation ID after stream finishes:", targetChatId, "Full content length:", fullContent.length);

            const finalMsg = { ...newAssistantMsg, content: fullContent };
            triggerVoiceIfNeeded(finalMsg);

            // Sync complete message to Supabase
            syncMessageSummaryToSupabase(targetChatId, finalMsg);
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({
                type: "message-sync",
                chatId: targetChatId,
                message: finalMsg
              }));
            }
            const finalParentChat: ChatSession = {
              ...updatedParentChat,
              updatedAt: new Date().toISOString()
            };
            syncChatSummaryToSupabase(finalParentChat);

            if (isFirstAssistantResponse) {
              generateAndSetAutomatedTitle(targetChatId, promptToSend, fullContent);
            }
          } else {
            const tokensToAppend = Math.max(minTokens, Math.ceil((tokens.length - currentTokenIdx) / divisor));
            for (let i = 0; i < tokensToAppend && currentTokenIdx < tokens.length; i++) {
              currentText += tokens[currentTokenIdx];
              currentTokenIdx++;
            }
            updateMessageContent(targetChatId, assistantMsgId, currentText);
          }
        }, intervalMs);
      }

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
      if (err.name === "AbortError" || err.message?.includes("aborted")) {
        console.log("Fetch aborted cleanly");
        return;
      }
      console.error(err);
      playUiSound("error");
      const errorMsg: Message = {
        id: `ast-${Date.now()}`,
        role: "assistant",
        content: `### 🔴 Connection Error\n\nNexa's secure core experienced an operational connectivity interruption.\n\n*Details:* ${err.message || "Unknown error state"}`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        engineId: "core",
      };

      // Sync error response to Supabase & update parent
      syncMessageSummaryToSupabase(activeSessionId, errorMsg);
      const finalParentChatError: ChatSession = {
        ...updatedParentChat,
        updatedAt: new Date().toISOString()
      };
      syncChatSummaryToSupabase(finalParentChatError);

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

      if (voiceModeActiveRef.current) {
        setVoiceState("speaking");
        speakUtterance("Sorry, I encountered a connection error. Please try speaking again.", () => {
          if (voiceModeActiveRef.current) {
            setVoiceState("listening");
            startListeningSession();
          } else {
            setVoiceState("idle");
          }
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Render Splash Screen on Arrival
  if (showSplash) {
    return <SplashScreen onComplete={() => setSplashTimerDone(true)} />;
  }

  return (
    <div className="flex flex-col h-screen h-[100dvh] bg-slate-50 dark:bg-[#0c1222] transition-colors duration-300 overflow-hidden text-slate-700 dark:text-slate-200">
      
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
        onOpenPremium={() => {
          setShowPremium(true);
          setPremiumSource("header");
        }}
        onOpenFeedback={() => setIsFeedbackOpen(true)}
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
        <div className={`hidden md:flex ${isSidebarCollapsed ? "md:w-16" : "md:w-80"} h-full flex-col border-r border-slate-100 dark:border-slate-800 shrink-0 select-none overflow-hidden bg-white dark:bg-[#0c1222] transition-all duration-300 ease-in-out ${isFocusMode ? "md:!hidden" : ""}`}>
          <Sidebar
            sessions={sessions}
            activeSessionId={activeSessionId}
            activeMode={activeMode}
            user={user}
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={handleToggleSidebarCollapse}
            onSelectSession={(id) => {
              setActiveSessionId(id);
              setCurrentView("chat");
            }}
            onNewSession={handleNewSession}
            onDeleteSession={handleDeleteSession}
            onRenameSession={handleRenameSession}
            onPinSession={handlePinSession}
            onReorderSessions={handleReorderSessions}
            onChangeMode={(mode) => {
              setActiveMode(mode);
              handleNewSession(mode);
            }}
            onOpenAuth={() => setShowAuth(true)}
            onOpenSettings={() => setShowSettings(true)}
            onLogout={handleLogout}
            isMobileOpen={false}
            onOpenPremium={() => {
              setShowPremium(true);
              setPremiumSource("sidebar");
            }}
            onOpenFeedback={() => setIsFeedbackOpen(true)}
            onSelectRecentlyDeleted={() => setCurrentView("recently_deleted")}
            isRecentlyDeletedActive={currentView === "recently_deleted"}
            onSelectArchive={() => setCurrentView("archive")}
            isArchiveActive={currentView === "archive"}
            onOpenShare={(id) => {
              setActiveSessionId(id);
              setShowShareModal(true);
            }}
            onOpenJoinCollaboration={() => {
              setShowJoinModal(true);
            }}
            onReRunQuery={(query) => {
              setCurrentView("chat");
              handleChatSubmit(query);
            }}
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
                  onSelectSession={(id) => {
                    setActiveSessionId(id);
                    setCurrentView("chat");
                    setIsMobileSidebarOpen(false);
                  }}
                  onNewSession={handleNewSession}
                  onDeleteSession={handleDeleteSession}
                  onRenameSession={handleRenameSession}
                  onPinSession={handlePinSession}
                  onReorderSessions={handleReorderSessions}
                  onChangeMode={(mode) => {
                    setActiveMode(mode);
                    handleNewSession(mode);
                  }}
                  onOpenAuth={() => setShowAuth(true)}
                  onOpenSettings={() => setShowSettings(true)}
                  onLogout={handleLogout}
                  isMobileOpen={true}
                  onCloseMobile={() => setIsMobileSidebarOpen(false)}
                  onOpenPremium={() => {
                    setShowPremium(true);
                    setPremiumSource("sidebar");
                  }}
                  onOpenFeedback={() => setIsFeedbackOpen(true)}
                  onSelectRecentlyDeleted={() => {
                    setCurrentView("recently_deleted");
                    setIsMobileSidebarOpen(false);
                  }}
                  isRecentlyDeletedActive={currentView === "recently_deleted"}
                  onSelectArchive={() => {
                    setCurrentView("archive");
                    setIsMobileSidebarOpen(false);
                  }}
                  isArchiveActive={currentView === "archive"}
                  onOpenShare={(id) => {
                    setActiveSessionId(id);
                    setShowShareModal(true);
                  }}
                  onOpenJoinCollaboration={() => {
                    setShowJoinModal(true);
                  }}
                  onReRunQuery={(query) => {
                    setCurrentView("chat");
                    setIsMobileSidebarOpen(false);
                    handleChatSubmit(query);
                  }}
                />
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* 3. Main Stage Content */}
        <main className="flex-1 min-h-0 flex flex-col h-full bg-slate-50 dark:bg-[#0e1628] overflow-hidden relative p-3 sm:p-6 pb-0 sm:pb-0">
          
          {/* Diagnostic Monitor Panel (Sliding overlay or toggle inline grid) */}
          {showAdmin && settings.isAdminVerified ? (
            <div className="w-full max-w-4xl mx-auto mb-4 shrink-0">
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

          {currentView === "recently_deleted" ? (
            <RecentlyDeleted
              user={user || { fullName: "Guest User", email: "guest@nexa.ai" } as UserProfile}
              deletedSessions={deletedSessions}
              isLoading={isDeletedLoading}
              onRestore={handleRestoreSession}
              onDeleteForever={handleDeleteSessionForever}
              onEmptyAll={handleEmptyAllRecentlyDeleted}
              onClose={() => setCurrentView("chat")}
            />
          ) : currentView === "archive" ? (
            <ArchiveView
              user={user || { fullName: "Guest User", email: "guest@nexa.ai" } as UserProfile}
              archivedSessions={sessions.filter((s) => (s as any).isArchived)}
              onRestore={(id) => handleToggleArchive(id)}
              onDelete={(id) => handleDeleteSession(id)}
              onClose={() => setCurrentView("chat")}
              onSelectSession={(id) => {
                setActiveSessionId(id);
                setCurrentView("chat");
              }}
            />
          ) : (
            <>
              {/* Chat thread feed section */}
              <div className="flex-1 min-h-0 flex flex-col max-w-4xl w-full mx-auto overflow-hidden">
            {activeSession.messages.length === 0 ? (
              // Empty Thread Page (Curated Hero + Bentley Highlights + FAQs)
              <div className="flex-1 overflow-y-auto py-10 pb-28 md:pb-10 text-center animate-fadeIn scrollbar-thin flex flex-col" id="nexa-hero-landing-page">
                <div className="w-full my-auto space-y-12">
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

              </div>
            ) : (
              // Message Logs list feeds
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
                {/* Chat Thread Header */}
                <div className="flex items-center justify-between py-2.5 px-4 mb-3 rounded-2xl border border-slate-200/60 dark:border-slate-800/80 bg-white/60 dark:bg-slate-900/40 backdrop-blur-md shrink-0 relative z-30">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-2 h-2 rounded-full bg-[#C96A3D] shrink-0 animate-pulse" />
                    <div className="min-w-0">
                      <h4 className="text-xs font-black text-slate-800 dark:text-white truncate max-w-[200px] sm:max-w-xs md:max-w-md">
                        {activeSession.title}
                      </h4>
                      <p className="text-[10px] text-slate-400 font-bold capitalize mt-0.5">
                        {activeSession.mode} Workspace
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={handleCopyAll}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-850 bg-white/40 dark:bg-slate-900/30 hover:border-[#C96A3D] dark:hover:border-[#C96A3D] hover:bg-slate-50 dark:hover:bg-slate-900/80 text-[10px] font-black text-slate-600 dark:text-slate-300 hover:text-[#C96A3D] dark:hover:text-[#C96A3D] cursor-pointer transition-all active:scale-95 shadow-2xs"
                      title="Copy all conversation content"
                    >
                      {isCopiedAll ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          <span>Copied Thread!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 shrink-0" />
                          <span>Copy All</span>
                        </>
                      )}
                    </button>

                    <ConversationHeaderMenu
                      activeSession={activeSession}
                      isSharedSession={isSharedSession}
                      sharedRole={sharedRole}
                      sharedParticipants={sharedParticipants}
                      onPinToggle={handlePinSession}
                      onOpenShare={(id) => {
                        setActiveSessionId(id);
                        setShowShareModal(true);
                      }}
                      onArchiveToggle={handleToggleArchive}
                      onDeleteToggle={handleDeleteSession}
                      onFavoriteToggle={handleToggleFavorite}
                      onRenameSession={handleRenameSession}
                      onDuplicateSession={handleDuplicateSession}
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto pb-28 md:pb-4 pr-1 scrollbar-thin">
                  <MessageList
                    messages={activeSession.messages}
                    activeEngine={activeSession.selectedEngineId || "core"}
                    onAction={handleMessageAction}
                    onEditPrompt={handleEditPromptMessage}
                    onReact={handleMessageReaction}
                    isLoading={isLoading}
                    isGenerating={isGenerating}
                    onCompleteQuiz={handleCompleteQuiz}
                    userName={user.fullName}
                    isFocusMode={isFocusMode}
                    onToggleFocusMode={() => setIsFocusMode(!isFocusMode)}
                  />
                  {/* Scroll bottom node spacer */}
                  <div ref={messageEndRef} />
                </div>
              </div>
            )}
          </div>

          {/* Dynamic Active input Dock Control Bars anchored */}
          <div 
            className={`fixed bottom-0 left-0 right-0 md:relative md:bottom-auto md:left-auto md:right-auto z-40 bg-slate-50/90 dark:bg-[#0e1628]/95 backdrop-blur-md pt-3 px-4 md:px-0 max-w-4xl w-full mx-auto select-none shrink-0 ${isFocusMode ? "hidden" : ""}`} 
            id="nexa-dock"
            style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
          >
            
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

            {/* Typing indicators */}
            {isSharedSession && sharedParticipants.filter(p => p.email !== user.email && p.isTyping).length > 0 && (
              <div className="text-[10px] font-bold text-[#C96A3D] dark:text-[#C96A3D]/95 px-2 pb-1.5 flex items-center gap-1.5 animate-pulse">
                <span className="flex gap-1 items-center">
                  <span className="w-1 h-1 rounded-full bg-[#C96A3D] animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1 h-1 rounded-full bg-[#C96A3D] animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1 h-1 rounded-full bg-[#C96A3D] animate-bounce" style={{ animationDelay: "300ms" }} />
                </span>
                <span>
                  {sharedParticipants
                    .filter(p => p.email !== user.email && p.isTyping)
                    .map(p => p.name || p.email.split("@")[0])
                    .join(", ")}{" "}
                  {sharedParticipants.filter(p => p.email !== user.email && p.isTyping).length === 1 ? "is typing..." : "are typing..."}
                </span>
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
                  disabled={isSharedSession && sharedRole === 'viewer'}
                  onClick={() => setShowUploadOptions(!showUploadOptions)}
                  className="p-2 text-slate-400 hover:text-[#C96A3D] dark:hover:text-[#C96A3D] hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl transition-colors cursor-pointer flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
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
                  id="nexa-voice-button"
                  type="button"
                  onClick={toggleListening}
                  className={`relative p-2.5 rounded-xl transition-all flex items-center justify-center shrink-0 w-11 h-11 outline-none cursor-pointer group active:scale-95 ${
                    voiceState === "listening"
                      ? "bg-rose-500/10 border border-rose-500/20 shadow-[0_0_12px_rgba(239,68,68,0.2)]"
                      : voiceState === "processing"
                      ? "bg-amber-500/10 border border-amber-500/20"
                      : voiceState === "speaking"
                      ? "bg-emerald-500/10 border border-emerald-500/20 shadow-[0_0_12px_rgba(16,185,129,0.2)]"
                      : "text-slate-400 hover:text-[#C96A3D] dark:hover:text-[#C96A3D] hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  }`}
                  title={
                    voiceState === "idle"
                      ? "Start Voice Mode Conversation"
                      : voiceState === "listening"
                      ? "Stop Voice Mode"
                      : voiceState === "processing"
                      ? "Nexa is thinking..."
                      : "Stop AI voice playback"
                  }
                >
                  {/* Glowing background ring for Listening State */}
                  {voiceState === "listening" && (
                    <>
                      <motion.div
                        className="absolute inset-0 rounded-xl bg-rose-500/20 border border-rose-500/40"
                        animate={{ scale: [1, 1.2, 1], opacity: [0.6, 0.2, 0.6] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                      />
                      <motion.div
                        className="absolute -inset-1 rounded-xl bg-rose-500/10 blur-sm"
                        animate={{ opacity: [0.2, 0.6, 0.2] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                      />
                    </>
                  )}

                  {/* Rotating Spinner for Processing State */}
                  {voiceState === "processing" && (
                    <div className="absolute inset-1.5 rounded-xl border-2 border-dashed border-[#C96A3D]/30 border-t-[#C96A3D] animate-spin" />
                  )}

                  {/* Sound Wave Ripples for Speaking State */}
                  {voiceState === "speaking" && (
                    <>
                      <motion.div
                        className="absolute inset-0 rounded-xl bg-emerald-500/20 border border-emerald-500/40"
                        animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.2, 0.5] }}
                        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                      />
                      <div className="absolute -top-1 flex items-center gap-0.5 justify-center h-2">
                        <span className="w-0.5 bg-emerald-500 h-1.5 animate-bounce rounded-full" style={{ animationDelay: "0ms", animationDuration: "0.6s" }}></span>
                        <span className="w-0.5 bg-emerald-500 h-2.5 animate-bounce rounded-full" style={{ animationDelay: "150ms", animationDuration: "0.5s" }}></span>
                        <span className="w-0.5 bg-emerald-500 h-1 animate-bounce rounded-full" style={{ animationDelay: "300ms", animationDuration: "0.7s" }}></span>
                      </div>
                    </>
                  )}

                  {/* Pulsing bottom waveform when Listening */}
                  {voiceState === "listening" && (
                    <div className="absolute -bottom-1 flex items-end gap-0.5 justify-center h-3">
                      <motion.span
                        className="w-0.5 bg-rose-500 rounded-full"
                        animate={{ height: [4, 12, 4] }}
                        transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", repeatType: "reverse" }}
                      />
                      <motion.span
                        className="w-0.5 bg-rose-500 rounded-full"
                        animate={{ height: [2, 16, 2] }}
                        transition={{ duration: 0.45, repeat: Infinity, ease: "easeInOut", repeatType: "reverse", delay: 0.15 }}
                      />
                      <motion.span
                        className="w-0.5 bg-rose-500 rounded-full"
                        animate={{ height: [5, 10, 5] }}
                        transition={{ duration: 0.7, repeat: Infinity, ease: "easeInOut", repeatType: "reverse", delay: 0.3 }}
                      />
                      <motion.span
                        className="w-0.5 bg-rose-500 rounded-full"
                        animate={{ height: [3, 14, 3] }}
                        transition={{ duration: 0.5, repeat: Infinity, ease: "easeInOut", repeatType: "reverse", delay: 0.45 }}
                      />
                    </div>
                  )}

                  {/* Core Microphone Icon */}
                  <Mic
                    className={`w-5 h-5 transition-all z-10 ${
                      voiceState === "listening"
                        ? "text-rose-600 scale-110"
                        : voiceState === "processing"
                        ? "text-[#C96A3D]"
                        : voiceState === "speaking"
                        ? "text-emerald-500 scale-105"
                        : "text-slate-400 group-hover:text-[#C96A3D]"
                    }`}
                  />
                </button>
              )}

              <textarea
                id="nexa-chat-input"
                value={inputPrompt}
                onChange={(e) => {
                  setInputPrompt(e.target.value);
                  handleUserTyping();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleChatSubmit();
                  }
                }}
                disabled={isSharedSession && sharedRole === 'viewer'}
                placeholder={
                  isSharedSession && sharedRole === 'viewer'
                    ? "You have View Only access to this shared conversation."
                    : activeMode === "general"
                    ? "Ask Nexa anything..."
                    : activeMode === "research"
                    ? "Specify search topic for Deep Research reports..."
                    : activeMode === "factcheck"
                    ? "Verify claims with Confidence Indexes..."
                    : "Enter writing details..."
                }
                rows={1}
                className="flex-1 text-xs py-2 px-3 bg-transparent outline-none max-h-36 resize-none text-[#14213D] dark:text-white placeholder:text-slate-400 font-normal m-0 disabled:opacity-60 disabled:cursor-not-allowed"
              />

              <AnimatePresence mode="wait">
                {isLoading || isGenerating ? (
                  <motion.button
                    key="stop-btn"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.15 }}
                    type="button"
                    onClick={handleStopGenerating}
                    className="p-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-all shadow-[0_0_15px_rgba(239,68,68,0.5)] border border-red-500/40 flex items-center justify-center shrink-0 cursor-pointer"
                    title="Stop Generating"
                  >
                    <Square className="w-4 h-4 shrink-0 fill-current text-white" />
                  </motion.button>
                ) : (
                  <motion.button
                    key="send-btn"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.15 }}
                    type="submit"
                    disabled={(!inputPrompt.trim() && !attachment) || (isSharedSession && sharedRole === 'viewer')}
                    className="p-2.5 bg-[#14213D] hover:bg-[#C96A3D] dark:bg-slate-100 dark:hover:bg-[#C96A3D] dark:hover:text-white dark:text-[#14213D] text-white rounded-xl transition-all hover:scale-105 shrink-0 disabled:opacity-40 disabled:hover:scale-100 cursor-pointer flex items-center justify-center"
                    title="Send Message"
                  >
                    <Send className="w-4 h-4 shrink-0" />
                  </motion.button>
                )}
              </AnimatePresence>
            </form>


          </div>
          </>
          )}

          {/* Premium Undo Toast Notification */}
          <AnimatePresence>
            {undoToast && (
              <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] w-full max-w-sm px-4">
                <motion.div
                  initial={{ opacity: 0, y: 50, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 20, scale: 0.95 }}
                  className="flex items-center justify-between gap-3 p-4 bg-slate-900/95 dark:bg-slate-950/95 text-white rounded-2xl shadow-2xl border border-slate-800 backdrop-blur-md"
                >
                  <span className="text-xs font-medium text-slate-200">{undoToast.message}</span>
                  {undoToast.actionLabel && (
                    <button
                      onClick={() => {
                        undoToast.action();
                        setUndoToast(null);
                      }}
                      className="px-3 py-1.5 bg-[#C96A3D] hover:bg-[#b05d33] text-white text-[11px] font-black uppercase tracking-wider rounded-xl transition-colors cursor-pointer shrink-0"
                    >
                      {undoToast.actionLabel}
                    </button>
                  )}
                </motion.div>
              </div>
            )}
          </AnimatePresence>

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
          safeStorage.setItem("nexa-device-permissions", JSON.stringify(newPerms));
        }}
        onLogout={handleLogout}
        onOpenFeedback={() => {
          setShowSettings(false);
          setIsFeedbackOpen(true);
        }}
        onOpenAuth={() => setShowAuth(true)}
      />

      {/* Premium Waitlist Modal */}
      <PremiumModal
        isOpen={showPremium}
        onClose={() => setShowPremium(false)}
        user={user}
        source={premiumSource}
        onOpenAuth={() => setShowAuth(true)}
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

        {customToast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-55 max-w-sm w-full bg-slate-900 border border-[#C96A3D]/80 rounded-2xl p-4 shadow-xl text-white flex items-start gap-3 select-none"
            id="nexa-custom-toast"
          >
            <div className="p-3 bg-[#C96A3D]/20 rounded-xl flex items-center justify-center shrink-0 border border-[#C96A3D]/30 shadow-[0_0_12px_rgba(201,106,61,0.3)]">
              <AlertTriangle className="w-6 h-6 text-amber-500 animate-pulse" />
            </div>
            
            <div className="space-y-1 w-full text-left">
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-black uppercase text-[#C96A3D] tracking-widest">
                  {customToast.title}
                </span>
                <button
                  onClick={() => setCustomToast(null)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              
              <h5 className="font-extrabold text-xs">{customToast.message}</h5>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modern Glassmorphic Feedback Modal */}
      <FeedbackModal
        isOpen={isFeedbackOpen}
        onClose={() => setIsFeedbackOpen(false)}
        user={user}
      />

      {/* Real-time Collaborative Shared Conversations Modals */}
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        chatId={activeSessionId}
        userEmail={user?.email || "guest@nexa.ai"}
        userName={user?.fullName || "Guest Collaborator"}
      />

      <JoinModal
        isOpen={showJoinModal}
        onClose={() => setShowJoinModal(false)}
        userEmail={user?.email || "guest@nexa.ai"}
        userName={user?.fullName || "Guest Collaborator"}
        initialToken={joinTokenInput}
        onJoinSuccess={async (chatId) => {
          // Trigger the App to switch to the joined conversation
          setActiveSessionId(chatId);
          setCurrentView("chat");
          playUiSound("success");
        }}
      />

      {/* Vercel Analytics tracking tag */}
      <Analytics />

    </div>
  );
}
