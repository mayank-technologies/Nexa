/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { supabase, syncWaitlistToSupabase } from "../utils/supabaseClient";
import {
  X,
  Zap,
  Search,
  BookOpen,
  FileText,
  Image as ImageIcon,
  Palette,
  Brain,
  Globe,
  Star,
  MessageSquare,
  Smile,
  Phone,
  Camera,
  Heart,
  Users,
  Target,
  Moon,
  PartyPopper,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  CheckCircle,
  Clock,
  UserCheck
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { UserProfile } from "../types";
import { safeStorage } from "../utils/storage";
import { playUiSound } from "../utils/sounds";

interface PremiumModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  source: "header" | "sidebar" | "unknown";
}

export function PremiumModal({ isOpen, onClose, user, source }: PremiumModalProps) {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [waitlistStatus, setWaitlistStatus] = useState<"idle" | "joined" | "already_registered" | "error" | "left_success">("idle");
  const [showConfirmLeave, setShowConfirmLeave] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const modalRef = useRef<HTMLDivElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);

  // Load waitlist status from localStorage and check with the server
  useEffect(() => {
    if (user && !user.isGuest && user.email) {
      setEmail(user.email);
    }
    
    const checkWaitlistStatus = async () => {
      // Optimistic check first
      const savedStatus = safeStorage.getItem("nexa_premium_waitlist_joined");
      if (savedStatus === "true") {
        setWaitlistStatus("joined");
      }
      
      console.log("[PremiumModal] checkWaitlistStatus - user.uid:", user?.uid);
      console.log("[PremiumModal] checkWaitlistStatus - user.email:", user?.email);
      console.log("[PremiumModal] checkWaitlistStatus - auth state:", user && !user.isGuest ? "authenticated" : "not authenticated");

      if (user && !user.isGuest && user.email) {
        try {
          const { data, error } = await supabase
            .from("waitlist")
            .select("*")
            .eq("email", user.email.toLowerCase().trim())
            .maybeSingle();
          
          if (data && !error) {
            setWaitlistStatus("joined");
            safeStorage.setItem("nexa_premium_waitlist_joined", "true");
          } else if (error) {
            if (error.code === "42P01") {
              console.log("[PremiumModal] 'waitlist' table is missing in Supabase. Falling back to local state check.");
              if (savedStatus === "true") {
                setWaitlistStatus("joined");
              } else {
                setWaitlistStatus("idle");
              }
            } else {
              console.error("Error checking waitlist status from Supabase:", error.message);
            }
          } else if (savedStatus === "true") {
            setWaitlistStatus("idle");
            safeStorage.removeItem("nexa_premium_waitlist_joined");
          }
        } catch (e) {
          console.error("Error checking waitlist status:", e);
        }
      }
    };

    if (isOpen) {
      checkWaitlistStatus();
    }
  }, [user, isOpen]);

  // Handle ESC key for accessibility
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      // Focus input when modal opens after animations settle
      setTimeout(() => {
        emailInputRef.current?.focus();
      }, 150);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleLeaveWaitlist = async () => {
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      let success = false;
      let errorMsg = "";

      console.log("[PremiumModal] handleLeaveWaitlist - user.uid:", user?.uid);
      console.log("[PremiumModal] handleLeaveWaitlist - user.email:", user?.email);
      console.log("[PremiumModal] handleLeaveWaitlist - auth state:", user && !user.isGuest ? "authenticated" : "not authenticated");

      if (!user || user.isGuest) {
        setErrorMessage("Please sign in to join the Nexa Premium Waitlist.");
        setWaitlistStatus("error");
        setShowConfirmLeave(false);
        setIsSubmitting(false);
        return;
      }

      // Direct Supabase delete using client SDK
      try {
        const { error: deleteError } = await supabase
          .from("waitlist")
          .delete()
          .eq("email", email.toLowerCase().trim());

        if (deleteError) {
          if (deleteError.code === "42P01") {
            console.warn("[PremiumModal] 'waitlist' table is missing during delete. Treating local delete as success.");
            success = true;
          } else {
            throw deleteError;
          }
        } else {
          success = true;
        }

        // Optionally notify the server
        try {
          await fetch("/api/premium/waitlist/leave", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email: email.trim(),
            }),
          });
        } catch (apiErr) {
          console.warn("[Waitlist] API leave failed, continuing:", apiErr);
        }
      } catch (fsErr: any) {
        errorMsg = fsErr.message || String(fsErr);
      }

      if (success) {
        setWaitlistStatus("left_success");
        safeStorage.removeItem("nexa_premium_waitlist_joined");
        setShowConfirmLeave(false);

        // Automatically switch back to idle form after 3.5 seconds
        setTimeout(() => {
          setWaitlistStatus("idle");
        }, 3500);
      } else {
        setErrorMessage(errorMsg || "Failed to leave waitlist. Please try again.");
        setWaitlistStatus("error");
        setShowConfirmLeave(false);
      }
    } catch (err: any) {
      console.error("Leave waitlist error:", err);
      setErrorMessage(err.message || "Network error. Please check your connection and try again.");
      setWaitlistStatus("error");
      setShowConfirmLeave(false);
    } finally {
      setIsSubmitting(false);
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.trim() || !email.includes("@")) {
      setErrorMessage("Please enter a valid email address.");
      setWaitlistStatus("error");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      console.log("[PremiumModal] handleSubmit - user.uid:", user?.uid);
      console.log("[PremiumModal] handleSubmit - user.email:", user?.email);
      console.log("[PremiumModal] handleSubmit - auth state:", user && !user.isGuest ? "authenticated" : "not authenticated");

      if (!user || user.isGuest) {
        setErrorMessage("Please sign in to join the Nexa Premium Waitlist.");
        setWaitlistStatus("error");
        playUiSound("error");
        setIsSubmitting(false);
        return;
      }

      let success = false;
      let statusResult = "";
      let errorMsg = "";

      const normalizedEmail = email.toLowerCase().trim();

      // Direct Supabase check
      try {
        const { data: existing, error: checkError } = await supabase
          .from("waitlist")
          .select("*")
          .eq("email", normalizedEmail)
          .maybeSingle();

        if (checkError) {
          if (checkError.code === "42P01") {
            console.log("[PremiumModal] 'waitlist' table is missing in Supabase. Triggering high-reliability local join fallback.");
            
            success = true;
            statusResult = "joined";

            // Fire off background API so that the email server sends the confirmation SMTP email!
            try {
              await fetch("/api/premium/waitlist", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  email: normalizedEmail,
                  userId: user?.uid,
                  source: source,
                }),
              });
            } catch (apiErr) {
              console.warn("[Waitlist] Optional confirmation email API call failed:", apiErr);
            }
          } else {
            throw checkError;
          }
        } else if (existing) {
          success = false;
          errorMsg = "You're already on the Nexa Premium Waitlist.";
        } else {
          // Store email, uid, userId, timestamp, source, fullName, plan
          const newEntry = {
            email: normalizedEmail,
            uid: user?.uid,
            userId: user?.uid,
            timestamp: new Date().toISOString(),
            source: source,
            fullName: user?.fullName || "Nexa User",
            plan: "Premium",
          };
          
          // Simultaneously synchronize to Supabase
          const syncResult = await syncWaitlistToSupabase(newEntry);
          if (!syncResult.success) {
            const dbErr = syncResult.error;
            console.error("[PremiumModal] Detailed Supabase waitlist sync error:", {
              code: dbErr?.code,
              message: dbErr?.message,
              details: dbErr?.details,
              hint: dbErr?.hint
            });
            throw new Error(dbErr?.message ? `Supabase Sync Error: ${dbErr.message}` : "Failed to synchronize waitlist entry to database.");
          }

          success = true;
          statusResult = "joined";

          // Send confirmation email asynchronously via server, catch error gracefully
          try {
            await fetch("/api/premium/waitlist", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                email: normalizedEmail,
                userId: user?.uid,
                source: source,
              }),
            });
          } catch (apiErr) {
            console.warn("[Waitlist] Optional confirmation email API call failed:", apiErr);
          }
        }
      } catch (fsErr: any) {
        errorMsg = fsErr.message || String(fsErr);
      }

      if (success) {
        if (statusResult === "already_registered") {
          setWaitlistStatus("already_registered");
          playUiSound("success");
        } else {
          setWaitlistStatus("joined");
          safeStorage.setItem("nexa_premium_waitlist_joined", "true");
          playUiSound("waitlist_joined");
        }
      } else {
        setErrorMessage(errorMsg || "Failed to join waitlist. Please try again.");
        setWaitlistStatus("error");
        playUiSound("error");
      }
    } catch (err: any) {
      console.error("Waitlist error:", err);
      setErrorMessage(err.message || "Network error. Please check your connection and try again.");
      setWaitlistStatus("error");
      playUiSound("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const premiumFeatures = [
    {
      icon: <Zap className="w-5 h-5 text-amber-500" />,
      title: "Faster AI Responses",
      desc: "Get significantly faster response speeds across all query engines."
    },
    {
      icon: <Search className="w-5 h-5 text-rose-500" />,
      title: "Unlimited Deep Research",
      desc: "Research without limits using our ultra-advanced recursive AI reasoning model."
    },
    {
      icon: <BookOpen className="w-5 h-5 text-emerald-500" />,
      title: "Advanced Study Mode",
      desc: "Smarter learning modules, personalized revision paths and rich practice exam prep."
    },
    {
      icon: <FileText className="w-5 h-5 text-indigo-500" />,
      title: "Higher Document Limits",
      desc: "Upload larger documents, PDFs, spreadsheet directories for instant comprehensive AI analysis."
    },
    {
      icon: <ImageIcon className="w-5 h-5 text-pink-500" />,
      title: "Enhanced Image Understanding",
      desc: "Analyze high-resolution screenshots, intricate flowcharts, diagrams, and hand-written formulas."
    },
    {
      icon: <Palette className="w-5 h-5 text-purple-500" />,
      title: "AI Image Generator",
      desc: "Generate spectacular production-ready AI images directly from intuitive prompts.",
      isExclusive: true,
      badge: "✨ Premium Exclusive",
      subfeats: [
        "Photorealistic", "Anime Art", "Cartoon Style", "Cinematic Artwork",
        "Fantasy Art", "Concept Art", "Character Design", "Logos", "Wallpapers",
        "Posters", "Product Mockups", "Social Media", "Landscapes", "Portraits", "HD Quality", "Multiple Ratios"
      ]
    },
    {
      icon: <Brain className="w-5 h-5 text-[#C96A3D]" />,
      title: "Long-Term Memory",
      desc: "Nexa remembers your context, unique voice, and preferences across separate conversations."
    },
    {
      icon: <Globe className="w-5 h-5 text-cyan-500" />,
      title: "Priority Access",
      desc: "Instantly lock down access to newly developed high-performance models before public release."
    },
    {
      icon: <Star className="w-5 h-5 text-yellow-500" />,
      title: "Early Access",
      desc: "Test experimental AI features, custom companion interactions, and beta productivity tools."
    }
  ];

  const companionFeatures = [
    { icon: <MessageSquare className="w-4 h-4 text-[#C96A3D]" />, title: "Natural Hinglish Conversations", desc: "Talk naturally in Hindi, English, or Hinglish seamlessly." },
    { icon: <Smile className="w-4 h-4 text-pink-500" />, title: "Human-like Personality", desc: "Expressive, engaging, and genuinely engaging conversational styles." },
    { icon: <Phone className="w-4 h-4 text-emerald-500" />, title: "AI Voice Calls", desc: "Talk naturally with AI using ultra-realistic voice interactions and tone." },
    { icon: <Brain className="w-4 h-4 text-indigo-500" />, title: "Long-Term Personal Memory", desc: "Intuitively remembers your favorites, key preferences, and traits over time." },
    { icon: <Camera className="w-4 h-4 text-purple-500" />, title: "Photo Understanding", desc: "Share high-fidelity photos and receive insightful responses and visual breakdown." },
    { icon: <Smile className="w-4 h-4 text-amber-500" />, title: "Photo Reactions", desc: "AI companion reacts naturally, empathetically, or humorously to your shared moments." },
    { icon: <UserCheck className="w-4 h-4 text-cyan-500" />, title: "AI Characters", desc: "Conversations with unique digital companions: Riya, Arjun, Maya, and Kabir.", subtext: "Riya, Arjun, Maya, Kabir" },
    { icon: <Users className="w-4 h-4 text-blue-500" />, title: "AI Group Chat", desc: "Form group chats with multiple distinctive AI characters running in parallel." },
    { icon: <Heart className="w-4 h-4 text-rose-500" />, title: "Personalized Conversations", desc: "Interactions grow increasingly custom, warm, and structured the more you converse." },
    { icon: <Palette className="w-4 h-4 text-teal-500" />, title: "Multiple Personalities", desc: "Swap and choose separate, highly specific persona configurations anytime." },
    { icon: <Target className="w-4 h-4 text-red-500" />, title: "Learns Your Preferences", desc: "Harnesses past interactions to tailor answers precisely to your project scope." },
    { icon: <Moon className="w-4 h-4 text-violet-500" />, title: "Daily Check-ins", desc: "Warm and friendly daily conversation loops keeping you focused and inspired." },
    { icon: <PartyPopper className="w-4 h-4 text-orange-500" />, title: "Fun Conversations", desc: "Casual chats, word games, riddles, and lighthearted storytelling triggers." }
  ];

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-md p-4 overflow-y-auto"
        id="nexa-premium-backdrop"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          ref={modalRef}
          className="relative w-full max-w-4xl max-h-[90vh] bg-white/95 dark:bg-[#0c1222]/95 border border-slate-200/80 dark:border-slate-800/80 rounded-3xl shadow-2xl overflow-y-auto p-6 sm:p-8 md:p-10"
          style={{ scrollbarWidth: "thin" }}
          id="nexa-premium-modal-card"
          role="dialog"
          aria-modal="true"
          aria-labelledby="premium-title"
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 sm:top-6 sm:right-6 p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/85 transition-all cursor-pointer focus:outline-2 focus:outline-[#C96A3D] z-10"
            aria-label="Close premium modal"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Premium Ambient Background Accents */}
          <div className="absolute top-0 left-1/4 w-72 h-72 bg-[#C96A3D]/10 rounded-full blur-3xl pointer-events-none select-none" />
          <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl pointer-events-none select-none" />

          {/* 1. HEADER SECTION */}
          <div className="text-center max-w-2xl mx-auto mb-10 mt-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#C96A3D]/10 dark:bg-[#C96A3D]/15 border border-[#C96A3D]/20 dark:border-[#C96A3D]/30 rounded-full mb-4 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-[#C96A3D]" />
              <span className="text-[10px] font-bold text-[#C96A3D] uppercase tracking-widest">Coming Soon</span>
            </div>

            <h1 id="premium-title" className="text-4xl sm:text-5xl font-black tracking-tight text-slate-900 dark:text-white flex items-center justify-center gap-3">
              <span className="bg-gradient-to-r from-[#C96A3D] via-amber-500 to-orange-500 bg-clip-text text-transparent">
                🚀 Nexa Premium
              </span>
            </h1>

            <p className="text-lg sm:text-xl font-bold text-slate-700 dark:text-slate-200 mt-3">
              Unlock the Next Generation of AI.
            </p>

            <p className="text-sm text-slate-500 dark:text-slate-400 mt-4 leading-relaxed font-normal">
              Nexa Premium is currently under development. Join the waitlist today and be among the first users to experience premium AI tools, exclusive companion experiences, advanced productivity features and future innovations.
            </p>
          </div>

          {/* 2. PREMIUM BENEFITS GRID */}
          <div className="mb-14">
            <h2 className="text-xs font-bold uppercase tracking-widest text-[#C96A3D] mb-6 flex items-center gap-2 select-none">
              <Sparkles className="w-4 h-4" />
              Premium Access Benefits
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {premiumFeatures.map((feat, idx) => (
                <div
                  key={idx}
                  className={`relative group p-5 rounded-2xl border transition-all duration-300 flex flex-col justify-between ${
                    feat.isExclusive
                      ? "border-[#C96A3D]/30 bg-[#C96A3D]/[0.02] dark:bg-[#C96A3D]/[0.04] shadow-2xs hover:border-[#C96A3D]/50 hover:bg-[#C96A3D]/[0.04] dark:hover:bg-[#C96A3D]/[0.06] lg:col-span-1"
                      : "border-slate-150 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/20 hover:border-slate-300 dark:hover:border-slate-700/80 hover:bg-white dark:hover:bg-slate-900/45 hover:shadow-xs"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-3xs group-hover:scale-110 transition-transform duration-300">
                        {feat.icon}
                      </div>
                      {feat.badge && (
                        <span className="text-[9px] font-bold px-2 py-0.5 bg-gradient-to-r from-amber-500 to-[#C96A3D] text-white rounded-full uppercase tracking-wider">
                          {feat.badge}
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 group-hover:text-[#C96A3D] transition-colors">
                      {feat.title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                      {feat.desc}
                    </p>
                  </div>

                  {feat.subfeats && (
                    <div className="mt-4 pt-3 border-t border-dashed border-slate-200/60 dark:border-slate-800/60">
                      <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Supported Categories:</p>
                      <div className="flex flex-wrap gap-1">
                        {feat.subfeats.map((sub, sidx) => (
                          <span
                            key={sidx}
                            className="text-[9px] font-semibold px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 text-slate-600 dark:text-slate-400 font-mono"
                          >
                            • {sub}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 3. HIGHLIGHTED COMPANION SECTION */}
          <div className="mb-14 relative rounded-3xl border border-[#C96A3D]/25 dark:border-[#C96A3D]/30 bg-gradient-to-br from-white to-[#C96A3D]/[0.01] dark:from-[#0c1222] dark:to-[#C96A3D]/[0.03] overflow-hidden p-6 sm:p-8 md:p-10 shadow-lg">
            {/* Design accents */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-amber-500/10 to-pink-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-10 -left-10 w-44 h-44 bg-[#C96A3D]/10 rounded-full blur-2xl pointer-events-none" />

            <div className="relative z-10">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8 border-b border-slate-100 dark:border-slate-800/80 pb-6">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#C96A3D]/10 dark:bg-[#C96A3D]/20 border border-[#C96A3D]/20 rounded-full mb-3 select-none">
                    <Sparkles className="w-3.5 h-3.5 text-[#C96A3D]" />
                    <span className="text-[9px] font-extrabold text-[#C96A3D] uppercase tracking-widest">Premium Exclusive</span>
                  </div>

                  <h3 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                    ✨ Nexa Companion
                  </h3>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-350 mt-1">
                    Your Personal AI Companion
                  </p>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400 md:max-w-md leading-relaxed font-normal">
                  Nexa Companion transforms Nexa into a more natural, intelligent and human-like AI experience designed for conversations, creativity, companionship and productivity.
                </p>
              </div>

              {/* Grid of Companion features */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {companionFeatures.map((feat, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/30 hover:bg-slate-50 dark:hover:bg-slate-900/60 hover:border-slate-200 dark:hover:border-slate-750 transition-all duration-300"
                  >
                    <div className="p-2 rounded-lg bg-[#C96A3D]/10 text-[#C96A3D] shrink-0">
                      {feat.icon}
                    </div>
                    <div className="text-left">
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {feat.title}
                      </h4>
                      <p className="text-[10px] text-slate-400 dark:text-slate-400 mt-0.5 leading-snug">
                        {feat.desc}
                      </p>
                      {feat.subtext && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {feat.subtext.split(", ").map((charName) => (
                            <span
                              key={charName}
                              className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-[#C96A3D] border border-[#C96A3D]/20 uppercase tracking-wider"
                            >
                              {charName}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 4. REASSURING PREMIUM BANNER */}
          <div className="mb-10 text-center border-y border-slate-100 dark:border-slate-800/85 py-6">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <span className="text-lg">🚀</span>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-350">
                <strong>Nexa Premium is currently under development.</strong> Join the waitlist today and receive early access when Premium launches.
              </p>
            </div>
          </div>

          {/* 5. WAITLIST SUBSCRIPTION FORM & SUCCESS ENGINE */}
          <div className="max-w-md mx-auto text-center bg-slate-50 dark:bg-slate-900/40 border border-slate-150 dark:border-slate-800 p-6 sm:p-8 rounded-3xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-amber-500/5 rounded-full blur-xl pointer-events-none" />

            <AnimatePresence mode="wait">
              {waitlistStatus === "joined" || waitlistStatus === "already_registered" ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  key="success"
                  className="space-y-4"
                >
                  <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center mx-auto mb-2 animate-bounce">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white whitespace-pre-line">
                    🎉 You're officially on the Nexa Premium Waitlist!
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-sm mx-auto whitespace-pre-line">
                    {waitlistStatus === "already_registered"
                      ? "You're already registered on the waitlist."
                      : "A confirmation email has been sent to your email address."}
                  </p>
                  
                  <div className="pt-2 flex flex-col gap-2.5">
                    <button
                      onClick={onClose}
                      className="w-full py-2.5 px-4 rounded-xl bg-[#C96A3D] hover:bg-[#b0582d] text-white font-bold text-xs uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm active:scale-98"
                    >
                      <span>✨</span> Stay on Waitlist
                    </button>

                    <button
                      onClick={() => setShowConfirmLeave(true)}
                      className="w-full py-2.5 px-4 rounded-xl border border-rose-200 dark:border-rose-900/35 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-600 dark:text-rose-450 font-bold text-xs uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-98"
                    >
                      <span>🗑</span> Leave Waitlist
                    </button>
                  </div>
                </motion.div>
              ) : waitlistStatus === "left_success" ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  key="left_success"
                  className="space-y-4 py-4"
                >
                  <div className="w-12 h-12 rounded-full bg-[#C96A3D]/10 text-[#C96A3D] border border-[#C96A3D]/25 flex items-center justify-center mx-auto mb-2">
                    <span className="text-xl">🗑</span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white whitespace-pre-line">
                    You've successfully left the Nexa Premium Waitlist.
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-sm mx-auto whitespace-pre-line">
                    You can join again anytime.
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  key="form"
                  className="space-y-4 text-left"
                >
                  <div className="text-center mb-4">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      Be the First to Know
                    </h3>
                    <p className="text-[11px] text-slate-450 mt-1 font-normal">
                      Enter your address to claim priority early-bird waitlist status.
                    </p>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-3.5">
                    <div>
                      <label htmlFor="waitlist_email" className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
                        Your Email Address *
                      </label>
                      <input
                        id="waitlist_email"
                        type="email"
                        ref={emailInputRef}
                        required
                        placeholder="Enter your email address"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (waitlistStatus === "error") setWaitlistStatus("idle");
                        }}
                        className="w-full text-sm py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:border-[#C96A3D] dark:focus:border-[#C96A3D] outline-none text-slate-900 dark:text-white transition-colors placeholder-slate-400 focus:ring-2 focus:ring-[#C96A3D]/10"
                      />
                    </div>

                    {waitlistStatus === "error" && (
                      <p className="text-[11px] text-rose-500 font-semibold" role="alert">
                        ⚠️ {errorMessage}
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full flex justify-center items-center gap-2 bg-[#C96A3D] hover:bg-[#b0582d] text-white font-bold py-2.5 rounded-xl transition-all text-xs uppercase tracking-wider disabled:opacity-50 cursor-pointer shadow-sm active:scale-98"
                    >
                      {isSubmitting ? "Securing Spot..." : "Join Waitlist"}
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Confirmation Dialog Overlay */}
            <AnimatePresence>
              {showConfirmLeave && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 rounded-3xl"
                >
                  <motion.div
                    initial={{ scale: 0.95, y: 10 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.95, y: 10 }}
                    className="w-full max-w-sm bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-xl text-center"
                  >
                    <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20 flex items-center justify-center mx-auto mb-4">
                      <X className="w-6 h-6 animate-pulse" />
                    </div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
                      Leave Nexa Premium Waitlist?
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
                      Are you sure you want to leave the Nexa Premium Waitlist?
                      <br />
                      <br />
                      You won't receive launch updates or early access notifications unless you join again.
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setShowConfirmLeave(false)}
                        className="flex-1 py-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-650 dark:text-slate-350 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleLeaveWaitlist}
                        disabled={isSubmitting}
                        className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer flex justify-center items-center gap-1.5 shadow-sm disabled:opacity-50"
                      >
                        {isSubmitting ? "Leaving..." : "Leave Waitlist"}
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
