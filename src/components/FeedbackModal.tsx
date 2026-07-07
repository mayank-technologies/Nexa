/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  MessageSquare,
  Upload,
  Image as ImageIcon,
  Loader2,
  CheckCircle2,
  Trash2,
  AlertTriangle,
  Mail,
  ChevronDown,
  Monitor,
  Smartphone,
  Sparkles
} from "lucide-react";
import { UserProfile } from "../types";
import { playUiSound } from "../utils/sounds";

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
}

export function FeedbackModal({ isOpen, onClose, user }: FeedbackModalProps) {
  const [feedbackType, setFeedbackType] = useState<string>("general");
  const [message, setMessage] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [screenshotName, setScreenshotName] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Auto-fill user email when logged in or when user prop changes
  useEffect(() => {
    if (user && !user.isGuest && user.email) {
      setEmail(user.email);
    } else {
      setEmail("");
    }
  }, [user, isOpen]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Handle click outside dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsTypeDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const feedbackTypes = [
    { id: "bug", label: "Bug Report 🐞" },
    { id: "feature", label: "Feature Request ✨" },
    { id: "improvement", label: "Improvement 💡" },
    { id: "general", label: "General Feedback 💬" },
    { id: "other", label: "Other 📝" }
  ];

  const activeTypeLabel = feedbackTypes.find((t) => t.id === feedbackType)?.label || "General Feedback 💬";

  // Client system/device info detection
  const getBrowser = () => {
    const ua = navigator.userAgent;
    if (ua.includes("Firefox")) return "Firefox";
    if (ua.includes("Chrome") && !ua.includes("Chromium") && !ua.includes("Edg")) return "Google Chrome";
    if (ua.includes("Safari") && !ua.includes("Chrome")) return "Safari";
    if (ua.includes("Edg")) return "Microsoft Edge";
    return "Unknown Browser";
  };

  const getOS = () => {
    const ua = navigator.userAgent;
    if (ua.includes("Windows")) return "Windows";
    if (ua.includes("Macintosh") || ua.includes("Mac OS")) return "macOS";
    if (ua.includes("Linux")) return "Linux";
    if (ua.includes("Android")) return "Android";
    if (ua.includes("iPhone") || ua.includes("iPad")) return "iOS";
    return "Unknown OS";
  };

  const getDeviceType = () => {
    const ua = navigator.userAgent;
    if (/Mobi|Android|iPhone/i.test(ua)) return "Mobile";
    if (/Tablet|iPad/i.test(ua)) return "Tablet";
    return "Desktop";
  };

  // Image upload handler
  const handleScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (< 5MB)
    const MAX_SIZE_BYTES = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE_BYTES) {
      setErrorMsg("Screenshot exceeds the 5 MB limit.");
      return;
    }

    // Validate type
    const validTypes = ["image/png", "image/jpg", "image/jpeg", "image/webp"];
    if (!validTypes.includes(file.type)) {
      setErrorMsg("Please upload PNG, JPG, JPEG or WEBP formats only.");
      return;
    }

    setErrorMsg(null);
    setScreenshotName(file.name);

    const reader = new FileReader();
    reader.onloadend = () => {
      setScreenshot(reader.result as string);
      playUiSound("image_uploaded");
    };
    reader.readAsDataURL(file);
  };

  const removeScreenshot = () => {
    setScreenshot(null);
    setScreenshotName("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      setErrorMsg("Please write a message before sending feedback.");
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    const payload = {
      email: email.trim() || "Anonymous",
      feedbackType,
      message: message.trim(),
      screenshot,
      browser: getBrowser(),
      deviceType: getDeviceType(),
      operatingSystem: getOS(),
      userEmail: user?.isGuest ? null : user?.email,
      userName: user?.isGuest ? null : user?.fullName
    };

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setIsSuccess(true);
        playUiSound("feedback_submitted");
        // Clear fields
        setMessage("");
        setScreenshot(null);
        setScreenshotName("");
        // Auto-close after 2.5 seconds
        setTimeout(() => {
          setIsSuccess(false);
          onClose();
        }, 2500);
      } else {
        setErrorMsg(data.error || "Something went wrong. Please try again.");
        playUiSound("error");
      }
    } catch (err: any) {
      console.error("[Nexa Feedback] Submission Error:", err);
      setErrorMsg("Failed to connect to the server. Please check your connection.");
      playUiSound("error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop Blur overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={isLoading || isSuccess ? undefined : onClose}
            className="absolute inset-0 bg-slate-950/40 dark:bg-black/60 backdrop-blur-md"
            id="feedback-modal-backdrop"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: "spring", duration: 0.4 }}
            className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/20 dark:border-slate-800/80 bg-white/80 dark:bg-[#0f172a]/90 shadow-2xl backdrop-blur-xl text-left"
            id="feedback-modal-card"
          >
            {/* Top decorative gradient line */}
            <div className="h-1.5 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-[#C96A3D]" />

            {/* Close Button */}
            {!isLoading && !isSuccess && (
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            )}

            {/* Success State Screen */}
            <AnimatePresence mode="wait">
              {isSuccess ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="p-8 text-center flex flex-col items-center justify-center min-h-[400px] space-y-4"
                  id="feedback-success-state"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1, rotate: 360 }}
                    transition={{ type: "spring", stiffness: 100, damping: 10 }}
                    className="p-4 rounded-full bg-emerald-500/10 text-emerald-500 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-500/25"
                  >
                    <CheckCircle2 className="w-12 h-12" />
                  </motion.div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold text-[#14213D] dark:text-white">
                      🎉 Thank you for your feedback!
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed mx-auto">
                      Your feedback has been received and will help us improve Nexa.
                      <br />
                      We truly appreciate your support.
                    </p>
                  </div>
                  <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider animate-pulse pt-4">
                    Closing modal shortly...
                  </div>
                </motion.div>
              ) : (
                /* Interactive Form Screen */
                <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
                  {/* Header */}
                  <div>
                    <div className="flex items-center gap-2 text-indigo-500 font-bold text-xs uppercase tracking-widest mb-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>User Voice Portal</span>
                    </div>
                    <h3 className="text-xl font-extrabold text-[#14213D] dark:text-white flex items-center gap-2">
                      💬 Send Feedback
                    </h3>
                    <p className="text-xs text-slate-450 dark:text-slate-400 mt-1 leading-relaxed">
                      Help us improve Nexa by sharing your thoughts.
                    </p>
                  </div>

                  {/* Form fields wrapper */}
                  <div className="space-y-4">
                    {/* Feedback Type Dropdown */}
                    <div className="space-y-1.5" ref={dropdownRef}>
                      <label className="block text-[11px] font-bold text-slate-450 dark:text-slate-400 uppercase tracking-wider">
                        Feedback Type <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setIsTypeDropdownOpen(!isTypeDropdownOpen)}
                          disabled={isLoading}
                          className="w-full flex items-center justify-between text-left text-xs px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 focus:border-indigo-500 dark:focus:border-indigo-500 outline-none text-[#14213D] dark:text-white transition-all font-medium disabled:opacity-50 cursor-pointer"
                        >
                          <span>{activeTypeLabel}</span>
                          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isTypeDropdownOpen ? "rotate-180" : ""}`} />
                        </button>

                        <AnimatePresence>
                          {isTypeDropdownOpen && (
                            <motion.div
                              initial={{ opacity: 0, y: -4 }}
                              animate={{ opacity: 1, y: 4 }}
                              exit={{ opacity: 0, y: -4 }}
                              className="absolute top-full left-0 right-0 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/80"
                            >
                              {feedbackTypes.map((t) => (
                                <button
                                  key={t.id}
                                  type="button"
                                  onClick={() => {
                                    setFeedbackType(t.id);
                                    setIsTypeDropdownOpen(false);
                                  }}
                                  className="w-full text-left text-xs px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-[#14213D] dark:hover:text-white font-medium transition-colors cursor-pointer"
                                >
                                  {t.label}
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    {/* Feedback Message */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-baseline">
                        <label className="block text-[11px] font-bold text-slate-450 dark:text-slate-400 uppercase tracking-wider">
                          Message <span className="text-rose-500">*</span>
                        </label>
                        <span className="text-[10px] font-mono text-slate-400">
                          {message.length} / 2000
                        </span>
                      </div>
                      <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value.slice(0, 2000))}
                        placeholder="Tell us what happened, what you'd like to see, or how we can improve Nexa..."
                        disabled={isLoading}
                        rows={4}
                        required
                        className="w-full text-xs p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 focus:border-indigo-500 dark:focus:border-indigo-500 outline-none text-[#14213D] dark:text-white transition-all font-normal placeholder-slate-400 leading-relaxed disabled:opacity-50 resize-y min-h-[90px]"
                      />
                    </div>

                    {/* Email Input (Optional) */}
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-bold text-slate-450 dark:text-slate-400 uppercase tracking-wider">
                        Email Address <span className="text-slate-400 font-normal">(Optional)</span>
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="Enter your email if you'd like a reply"
                          disabled={isLoading}
                          className="w-full text-xs pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 focus:border-indigo-500 dark:focus:border-indigo-500 outline-none text-[#14213D] dark:text-white transition-all font-medium placeholder-slate-400 disabled:opacity-50"
                        />
                      </div>
                    </div>

                    {/* Screenshot Upload Block */}
                    <div className="space-y-2">
                      <label className="block text-[11px] font-bold text-slate-450 dark:text-slate-400 uppercase tracking-wider">
                        Screenshot <span className="text-slate-400 font-normal">(Optional, max 5MB)</span>
                      </label>

                      {/* File select / Drop zone trigger */}
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleScreenshotChange}
                        accept="image/png, image/jpg, image/jpeg, image/webp"
                        disabled={isLoading}
                        className="hidden"
                      />

                      {!screenshot ? (
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isLoading}
                          className="w-full flex flex-col items-center justify-center p-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/30 hover:bg-slate-100/50 dark:hover:bg-slate-800/40 hover:border-indigo-400 dark:hover:border-indigo-500/50 transition-all text-center group disabled:opacity-50 cursor-pointer"
                        >
                          <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg shadow-2xs border border-slate-100 dark:border-slate-800/80 group-hover:scale-105 transition-transform text-slate-400 group-hover:text-indigo-500 dark:group-hover:text-indigo-400">
                            <Upload className="w-4 h-4" />
                          </div>
                          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-2">
                            Upload a screenshot
                          </span>
                          <span className="text-[10px] text-slate-400 mt-0.5 font-medium">
                            Drag & drop or click to browse (PNG, JPG, JPEG, WEBP)
                          </span>
                        </button>
                      ) : (
                        /* Preview screenshot */
                        <div className="relative border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-900/40 p-2.5 flex items-center justify-between gap-3 animate-fadeIn">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 shrink-0 bg-white flex items-center justify-center">
                              <img src={screenshot} alt="Preview" className="w-full h-full object-cover" />
                            </div>
                            <div className="text-left">
                              <p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate max-w-[200px]">
                                {screenshotName}
                              </p>
                              <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider flex items-center gap-1 mt-0.5">
                                <ImageIcon className="w-3 h-3" /> Ready
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={removeScreenshot}
                            className="p-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/25 text-rose-500 dark:text-rose-450 border border-rose-100 dark:border-rose-500/20 rounded-lg transition-all"
                            title="Remove screenshot"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Feedback Errors Display */}
                  {errorMsg && (
                    <div className="p-3 bg-rose-500/10 text-rose-500 dark:text-rose-400 border border-rose-500/20 rounded-xl text-xs flex items-start gap-2.5 font-medium leading-relaxed animate-shake">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  {/* Submissions & System Info footer */}
                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
                    {/* Device context pill tags */}
                    <div className="flex items-center gap-2 select-none text-[10px] font-bold text-slate-400 tracking-wide uppercase">
                      <span className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                        <Monitor className="w-3 h-3" /> {getOS()}
                      </span>
                      <span className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                        {getDeviceType() === "Mobile" ? <Smartphone className="w-3 h-3" /> : <Monitor className="w-3 h-3" />} {getDeviceType()}
                      </span>
                    </div>

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={isLoading || !message.trim()}
                      className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#14213D] dark:bg-indigo-600 hover:bg-[#C96A3D] dark:hover:bg-indigo-500 text-white font-bold px-6 py-3 rounded-xl text-xs transition-colors shadow-md disabled:opacity-55 disabled:hover:bg-[#14213D] dark:disabled:hover:bg-indigo-600 cursor-pointer"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Sending...</span>
                        </>
                      ) : (
                        <>
                          <span>🚀 Send Feedback</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
