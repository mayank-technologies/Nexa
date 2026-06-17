/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { X, Mail, Phone, Lock, Eye, Chrome, ArrowRight, ShieldCheck } from "lucide-react";
import { Logo } from "./Logo";
import { UserProfile } from "../types";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: UserProfile, cloudChats?: any[]) => void;
}

export function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [method, setMethod] = useState<"email" | "otp" | "google">("email");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorFlag, setErrorFlag] = useState("");

  if (!isOpen) return null;

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setErrorFlag("Please input a valid email address.");
      return;
    }
    if (!password) {
      setErrorFlag("Please enter your password.");
      return;
    }
    setLoading(true);
    setErrorFlag("");

    // Grab current guest chats to upload in case of first-time user registration
    let currentChats: any[] = [];
    try {
      const cached = localStorage.getItem("nexa_sessions");
      if (cached) {
        currentChats = JSON.parse(cached);
      }
    } catch (_) {}

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          fullName: fullName || undefined,
          currentChats
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setErrorFlag(data.error || "Authentication failed. Please verify your credentials.");
        setLoading(false);
        return;
      }

      setLoading(false);
      onSuccess(data.user, data.chats);
      onClose();
    } catch (err: any) {
      console.error("Auth submit fetch error:", err);
      setErrorFlag("Connection to Nexa Auth Server could not be established. Please retry.");
      setLoading(false);
    }
  };

  const handleSendOTP = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber) {
      setErrorFlag("Please enter a phone number.");
      return;
    }
    setLoading(true);
    setErrorFlag("");

    setTimeout(() => {
      setLoading(false);
      setOtpSent(true);
    }, 1000);
  };

  const handleVerifyOTP = (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.length < 4) {
      setErrorFlag("Please insert the 4-digit code sent.");
      return;
    }
    setLoading(true);

    setTimeout(() => {
      setLoading(false);
      onSuccess({
        email: `${phoneNumber}@nexa.ai`,
        fullName: `User ${phoneNumber.slice(-4)}`,
        isGuest: false,
        avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${phoneNumber}`,
        preferences: {
          primaryLanguage: "English",
          rememberPersonalization: true,
          personalizationContext: "",
        },
      });
      onClose();
    }, 1200);
  };

  const handleGoogleLogin = () => {
    setLoading(true);
    setErrorFlag("");
    setTimeout(() => {
      setLoading(false);
      onSuccess({
        email: "bittomaurya0@gmail.com",
        fullName: "Bitto Maurya",
        isGuest: false,
        avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Bitto",
        preferences: {
          primaryLanguage: "English",
          rememberPersonalization: true,
          personalizationContext: "",
        },
      });
      onClose();
    }, 1500);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs"
      id="nexa-auth-modal"
    >
      <div className="relative w-full max-w-md bg-white dark:bg-[#11192e] border border-slate-100 dark:border-slate-800 rounded-3xl p-8 shadow-xl overflow-hidden transition-all duration-300">
        
        {/* Decorative Background Accents */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#C96A3D]/5 rounded-full blur-2xl" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl" />

        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <Logo size={40} showText={true} textClass="text-2xl font-bold" animate={false} />
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Methods Toggle */}
        <div className="flex border-b border-slate-100 dark:border-slate-800 mb-6">
          <button
            onClick={() => {
              setMethod("email");
              setErrorFlag("");
            }}
            className={`flex-1 pb-3 text-sm font-semibold transition-colors relative ${
              method === "email"
                ? "text-[#C96A3D]"
                : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            }`}
          >
            Email Login
            {method === "email" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#C96A3D]" />}
          </button>
          <button
            onClick={() => {
              setMethod("otp");
              setErrorFlag("");
            }}
            className={`flex-1 pb-3 text-sm font-semibold transition-colors relative ${
              method === "otp"
                ? "text-[#C96A3D]"
                : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            }`}
          >
            OTP Login
            {method === "otp" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#C96A3D]" />}
          </button>
        </div>

        {errorFlag && (
          <div className="mb-4 text-xs font-medium text-rose-500 bg-rose-500/10 p-3 rounded-xl border border-rose-500/20">
            {errorFlag}
          </div>
        )}

        {/* Email Login Form */}
        {method === "email" && (
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#14213D] dark:text-slate-300 uppercase tracking-widest mb-1.5">
                Full Name (Optional)
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="e.g. Bitto Maurya"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full text-sm py-2.5 pl-10 pr-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:border-[#C96A3D] dark:focus:border-[#C96A3D] outline-none text-[#14213D] dark:text-white transition-colors"
                />
                <Chrome className="absolute left-3.5 top-3.5 text-slate-400 w-4 h-4" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#14213D] dark:text-slate-300 uppercase tracking-widest mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full text-sm py-2.5 pl-10 pr-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:border-[#C96A3D] dark:focus:border-[#C96A3D] outline-none text-[#14213D] dark:text-white transition-colors"
                />
                <Mail className="absolute left-3.5 top-3.5 text-slate-400 w-4 h-4" />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-bold text-[#14213D] dark:text-slate-300 uppercase tracking-widest">
                  Password
                </label>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full text-sm py-2.5 pl-10 pr-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:border-[#C96A3D] dark:focus:border-[#C96A3D] outline-none text-[#14213D] dark:text-white transition-colors"
                />
                <Lock className="absolute left-3.5 top-3.5 text-slate-400 w-4 h-4" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 focus:outline-none"
                >
                  <Eye className="w-4 h-4" />
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-6 flex justify-center items-center gap-2 bg-[#14213D] hover:bg-[#C96A3D] dark:bg-slate-100 dark:hover:bg-[#C96A3D] dark:hover:text-white dark:text-[#14213D] text-white font-semibold py-2.5 rounded-xl transition-all hover:shadow-lg disabled:opacity-50"
            >
              {loading ? "Establishing Nexa Link..." : "Authenticate"}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* OTP Login Form */}
        {method === "otp" && (
          <div className="space-y-4">
            {!otpSent ? (
              <form onSubmit={handleSendOTP} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#14213D] dark:text-slate-300 uppercase tracking-widest mb-1.5">
                    Phone Number
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      required
                      placeholder="+91 98765 43210"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="w-full text-sm py-2.5 pl-10 pr-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:border-[#C96A3D] dark:focus:border-[#C96A3D] outline-none text-[#14213D] dark:text-white transition-colors"
                    />
                    <Phone className="absolute left-3.5 top-3.5 text-slate-400 w-4 h-4" />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center items-center gap-2 bg-[#14213D] dark:bg-slate-100 hover:bg-[#C96A3D] dark:hover:bg-[#C96A3D] dark:hover:text-white dark:text-[#14213D] text-white font-semibold py-2.5 rounded-xl transition-all disabled:opacity-50"
                >
                  {loading ? "Sending OTP Code..." : "Send Verification Code"}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOTP} className="space-y-4">
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  OTP code sent to {phoneNumber}. (Enter any 4 digits to proceed)
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#14213D] dark:text-slate-300 uppercase tracking-widest mb-1.5">
                    Enter OTP Code
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={4}
                    placeholder="1234"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    className="w-full text-center text-lg tracking-widest py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:border-[#C96A3D] dark:focus:border-[#C96A3D] outline-none text-[#14213D] dark:text-white transition-colors font-mono"
                  />
                </div>

                <div className="flex justify-between items-center text-xs">
                  <button
                    type="button"
                    onClick={() => setOtpSent(false)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    Change Phone Number
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOtpCode("");
                      setErrorFlag("");
                    }}
                    className="text-[#C96A3D] font-semibold"
                  >
                    Resend Code
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center items-center gap-2 bg-[#14213D] dark:bg-slate-100 hover:bg-[#C96A3D] dark:hover:bg-[#C96A3D] dark:hover:text-white dark:text-[#14213D] text-white font-semibold py-2.5 rounded-xl transition-all disabled:opacity-50"
                >
                  {loading ? "Verifying Code..." : "Complete Login"}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}
          </div>
        )}

        {/* Divider */}
        <div className="relative my-6 text-center select-none">
          <div className="absolute inset-x-0 top-2.5 border-b border-slate-100 dark:border-slate-800" />
          <span className="relative px-3 text-[10px] font-bold text-slate-400 bg-white dark:bg-[#11192e] uppercase tracking-widest">
            or continue with
          </span>
        </div>

        {/* Google Authentication */}
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full flex justify-center items-center gap-3 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800/80 text-[#14213D] dark:text-slate-200 border border-slate-200 dark:border-slate-800 font-semibold py-2.5 rounded-xl transition-colors hover:shadow-xs disabled:opacity-50"
        >
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22s.81-.63.81-.63z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              fill="#EA4335"
            />
          </svg>
          Google Login
        </button>

        <p className="mt-6 text-center text-xs text-slate-400 font-normal leading-relaxed">
          Nexa upholds the highest privacy & security protocols.
          <br /> By clicking authenticate, you accept our premium terms.
        </p>
      </div>
    </div>
  );
}
