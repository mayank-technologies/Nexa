/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { X, Mail, Lock, Eye, ArrowRight, User } from "lucide-react";
import { Logo } from "./Logo";
import { UserProfile } from "../types";
import { auth } from "../firebase";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect
} from "firebase/auth";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: UserProfile, cloudChats?: any[]) => void;
}

export function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorFlag, setErrorFlag] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [isInIframe] = useState(() => {
    try {
      return window.self !== window.top;
    } catch (e) {
      return true;
    }
  });

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setErrorFlag("Please input a valid email address.");
      return;
    }
    if (isSignUp && !fullName.trim()) {
      setErrorFlag("Please enter your Full Name to create your Nexa account.");
      return;
    }
    if (!password) {
      setErrorFlag("Please enter your password.");
      return;
    }
    setLoading(true);
    setErrorFlag("");

    try {
      if (isSignUp) {
        // Save full name in sessionStorage for onAuthStateChanged to read
        sessionStorage.setItem("nexa_signup_fullname", fullName.trim());
        const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await updateProfile(userCredential.user, { displayName: fullName.trim() });
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
      setLoading(false);
      onClose();
    } catch (err: any) {
      console.error("Auth submit error:", err);
      let friendlyMessage = "Authentication failed. Please verify your credentials.";
      if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password" || err.code === "auth/user-not-found") {
        friendlyMessage = "Incorrect email or password. Please verify your credentials.";
      } else if (err.code === "auth/email-already-in-use") {
        friendlyMessage = "An account with this email address already exists. Try signing in.";
      } else if (err.code === "auth/weak-password") {
        friendlyMessage = "Your password is too weak. Please choose a password with at least 6 characters.";
      } else if (err.code === "auth/invalid-email") {
        friendlyMessage = "Please enter a valid email address.";
      } else if (err.message) {
        friendlyMessage = err.message;
      }
      setErrorFlag(friendlyMessage);
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setErrorFlag("");

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: "select_account"
      });

      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

      if (isMobile) {
        console.log("[Nexa Client] Mobile browser detected. Attempting signInWithRedirect...");
        await signInWithRedirect(auth, provider);
      } else {
        console.log("[Nexa Client] Desktop browser detected. Attempting signInWithPopup...");
        const result = await signInWithPopup(auth, provider);
        const firebaseUser = result.user;
        console.log("[Nexa Client] Popup auth success for user:", firebaseUser.email);
        setLoading(false);
        onClose();
      }
    } catch (err: any) {
      console.error("[Nexa Client] Google auth error:", err);
      let friendlyMessage = "Google sign-in failed. Please try again.";
      if (err.code === "auth/popup-blocked") {
        friendlyMessage = "Google login popup was blocked by your browser. Please allow popups.";
      } else if (err.code === "auth/unauthorized-domain") {
        friendlyMessage = "This domain is not authorized for Google Sign-In in your Firebase Console. Please add this URL to 'Authorized Domains' in Firebase (Authentication > Settings > Authorized Domains) or use a direct Email/Password login.";
      } else if (err.code === "auth/popup-closed-by-user") {
        friendlyMessage = "Google Sign-In popup was closed before completion. Please try again.";
      } else if (err.code === "auth/account-exists-with-different-credential") {
        friendlyMessage = "An account with this email already exists with a different login method. Please sign in with password.";
      } else if (err.message) {
        friendlyMessage = err.message;
      }
      setErrorFlag(friendlyMessage);
      setLoading(false);
    }
  };

  return isOpen ? (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs select-none"
      id="nexa-auth-modal"
    >
      <div className="relative w-full max-w-md max-h-[92vh] overflow-y-auto bg-white dark:bg-[#11192e] border border-slate-100 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl transition-all duration-300" style={{ scrollbarWidth: "thin" }}>
        
        {/* Decorative Background Accents */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#C96A3D]/5 rounded-full blur-2xl" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl" />

        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <Logo size={40} showText={true} textClass="text-2xl font-bold" animate={false} />
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Top Sign In vs Create Account Toggle Tabs */}
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl mb-6 select-none shadow-inner border border-slate-200/40 dark:border-slate-800">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(false);
              setErrorFlag("");
            }}
            className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-all cursor-pointer ${
              !isSignUp
                ? "bg-[#14213D] text-white dark:bg-slate-700/90 dark:text-white shadow-sm"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setIsSignUp(true);
              setErrorFlag("");
            }}
            className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-all cursor-pointer ${
              isSignUp
                ? "bg-[#C96A3D] text-white shadow-sm"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            Create Account (Sign Up)
          </button>
        </div>

        {errorFlag && (
          <div className="mb-4 text-xs font-medium text-rose-500 bg-rose-500/10 p-3 rounded-xl border border-rose-500/20">
            {errorFlag}
          </div>
        )}

        {/* Email Login/Register Form */}
        <form onSubmit={handleEmailSubmit} className="space-y-4">
          {isSignUp && (
            <div>
              <label className="block text-xs font-bold text-[#14213D] dark:text-slate-300 uppercase tracking-widest mb-1.5">
                Full Name *
              </label>
              <div className="relative">
                <input
                  type="text"
                  required={isSignUp}
                  autoComplete="name"
                  placeholder="Enter your name e.g. Mayank"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full text-sm py-2.5 pl-10 pr-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:border-[#C96A3D] dark:focus:border-[#C96A3D] outline-none text-[#14213D] dark:text-white transition-colors"
                />
                <User className="absolute left-3.5 top-3.5 text-slate-400 w-4 h-4" />
              </div>
            </div>
          )}

          <div>
            <label className="block text-[#14213D] dark:text-slate-300 text-xs font-bold uppercase tracking-widest mb-1.5">
              Email Address *
            </label>
            <div className="relative">
              <input
                type="email"
                required
                autoComplete="username email"
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
                Password *
              </label>
            </div>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                autoComplete={isSignUp ? "new-password" : "current-password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full text-sm py-2.5 pl-10 pr-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:border-[#C96A3D] dark:focus:border-[#C96A3D] outline-none text-[#14213D] dark:text-white transition-colors"
              />
              <Lock className="absolute left-3.5 top-3.5 text-slate-400 w-4 h-4" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
              >
                <Eye className="w-4 h-4" />
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-6 flex justify-center items-center gap-2 bg-[#14213D] hover:bg-[#C96A3D] dark:bg-white dark:hover:bg-[#C96A3D] dark:hover:text-white dark:text-[#14213D] text-white font-semibold py-2.5 rounded-xl transition-all hover:shadow-lg disabled:opacity-50 cursor-pointer"
          >
            {loading
              ? isSignUp
                ? "Creating Nexa Account..."
                : "Establishing Nexa Link..."
              : isSignUp
              ? "Create Nexa Account"
              : "Sign In"}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Quick Switch Helper */}
        <div className="text-center mt-4">
          {isSignUp ? (
            <p className="text-xs text-slate-500">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(false);
                  setErrorFlag("");
                }}
                className="text-[#C96A3D] font-bold hover:underline cursor-pointer"
              >
                Login here
              </button>
            </p>
          ) : (
            <p className="text-xs text-slate-500">
              New to Nexa?{" "}
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(true);
                  setErrorFlag("");
                }}
                className="text-[#C96A3D] font-bold hover:underline cursor-pointer"
              >
                Create an account
              </button>
            </p>
          )}
        </div>

        {/* Divider */}
        <div className="relative my-5 text-center select-none">
          <div className="absolute inset-x-0 top-2.5 border-b border-slate-100 dark:border-slate-800" />
          <span className="relative px-3 text-[10px] font-bold text-slate-400 bg-white dark:bg-[#11192e] uppercase tracking-widest">
            or continue with
          </span>
        </div>

        {/* Google Authentication */}
        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full flex justify-center items-center gap-3 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800/80 text-[#14213D] dark:text-slate-200 border border-slate-200 dark:border-slate-800 font-semibold py-2.5 rounded-xl transition-colors hover:shadow-xs disabled:opacity-50 cursor-pointer"
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
          Continue with Google
        </button>

        {isInIframe && (
          <div className="mt-4 p-3.5 rounded-2xl bg-amber-500/10 dark:bg-amber-500/5 border border-amber-500/20 text-left select-text">
            <p className="text-xs text-amber-700 dark:text-amber-400 font-bold mb-1">
              ⚠️ Live Preview Mode Notice:
            </p>
            <p className="text-[11px] text-slate-600 dark:text-slate-300 font-normal leading-relaxed">
              Google Auth results may be blocked inside the AI Studio sandbox iframe. If Google login doesn't complete, click <strong>"Open in New Tab"</strong> at the top right of the screen first, or use the <strong>Email and Password</strong> method above.
            </p>
          </div>
        )}

        <p className="mt-5 text-center text-xs text-slate-400 font-normal leading-relaxed">
          Nexa upholds the highest privacy & security protocols.
          <br /> By clicking authenticate, you accept our premium terms.
        </p>
      </div>
    </div>
  ) : null;
}
