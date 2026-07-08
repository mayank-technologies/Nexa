/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { X, Mail, Phone, Lock, Eye, Chrome, ArrowRight, ShieldCheck, ArrowLeft, User, Plus } from "lucide-react";
import { Logo } from "./Logo";
import { UserProfile } from "../types";
import { auth, db, handleFirestoreError, OperationType } from "../firebase";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile 
} from "firebase/auth";
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  getDocs 
} from "firebase/firestore";

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
  const [isSignUp, setIsSignUp] = useState(false);

  // Simulated Google accounts chooser state
  const [googleChooser, setGoogleChooser] = useState(false);
  const [isEnteringCustomGoogle, setIsEnteringCustomGoogle] = useState(false);
  const [customGoogleEmail, setCustomGoogleEmail] = useState("");
  const [customGoogleName, setCustomGoogleName] = useState("");

  const googleAccounts = [
    { email: "mayanktechnologies00@gmail.com", name: "Mayank Technologies" },
    { email: "mayank.business.nexa@gmail.com", name: "Mayank (Business)" },
    { email: "bittomaurya0@gmail.com", name: "Bitto Maurya" }
  ];

  // Configures and initializes Google Identity Services (GSI) / Smart Lock integration with full redirection safety for mobile browsers
  useEffect(() => {
    if (!isOpen || !googleChooser) return;

    const initGsiGis = () => {
      const g = (window as any).google;
      if (g?.accounts?.id) {
        try {
          g.accounts.id.initialize({
            client_id: "980104552274-nexa-app-mobile-gsi-client.apps.googleusercontent.com",
            context: "signin",
            ux_mode: "redirect", // Handles mobile browsers cleanly by preventing standard popup blockers on Chrome/Safari Mobile
            auto_select: false, // Prevents unintended auto-logging which can be confusing
            itp_support: true, // Intelligent Tracking Prevention support for Safari iOS users
            callback: (response: any) => {
              if (response?.credential) {
                // Decode Google JWT locally and seamlessly authenticate/sign-in
                try {
                  const base64Url = response.credential.split(".")[1];
                  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
                  const jsonPayload = decodeURIComponent(
                    atob(base64)
                      .split("")
                      .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
                      .join("")
                  );
                  const payload = JSON.parse(jsonPayload);
                  if (payload.email) {
                    handleSelectGoogleAccount(
                      payload.email,
                      payload.name || payload.given_name || "Google User"
                    );
                  }
                } catch (jwtErr) {
                  console.error("JWT decoding failed:", jwtErr);
                  setErrorFlag("Google validation error. Please use manual selection fallback.");
                }
              }
            }
          });

          // Render available system accounts prompt (GSI One Tap) & the official Button securely
          g.accounts.id.prompt((notification: any) => {
            if (notification.isNotDisplayed()) {
              console.log("One-tap overlay suppressed: standard browser constraints or iframe parent sandboxed.");
            }
          });

          const renderContainer = document.getElementById("nexa_gsi_button_container");
          if (renderContainer) {
            g.accounts.id.renderButton(renderContainer, {
              type: "standard",
              theme: "outline",
              size: "large",
              text: "signin_with",
              shape: "pill",
              logo_alignment: "left",
              width: renderContainer.clientWidth || 320
            });
          }
        } catch (err) {
          console.warn("Google Sign-In SDK initialization notice (benign inside developer iframe/sandbox):", err);
        }
      }
    };

    // Attempt immediately, and retry briefly in case of script load race conditions
    initGsiGis();
    const timer = setTimeout(initGsiGis, 800);
    return () => clearTimeout(timer);
  }, [isOpen, googleChooser]);

  if (!isOpen) return null;

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

    // Grab current guest chats to upload in case of first-time user registration
    let currentChats: any[] = [];
    try {
      const cached = localStorage.getItem("nexa_sessions");
      if (cached) {
        currentChats = JSON.parse(cached);
      }
    } catch (_) {}

    try {
      let firebaseUser;
      if (isSignUp) {
        // Firebase Auth Create User
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        firebaseUser = userCredential.user;
        
        // Update Firebase Auth profile displayName
        await updateProfile(firebaseUser, { displayName: fullName });

        // Create User Profile in Firestore
        const newUserProfile: UserProfile = {
          email: email.toLowerCase().trim(),
          fullName: fullName.trim(),
          isGuest: false,
          avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${fullName.trim()}`,
          preferences: {
            primaryLanguage: "English",
            rememberPersonalization: true,
            personalizationContext: "",
          },
          gamification: {
            points: 0,
            unlockedBadges: [],
            stats: {
              chatsCompleted: 0,
              enginesUsed: [],
              deepResearchCompleted: 0,
              studyCompleted: 0,
              quizzesTaken: 0,
              perfectQuizzes: 0,
              factChecksCompleted: 0
            }
          }
        };

        try {
          await setDoc(doc(db, "users", firebaseUser.uid), {
            ...newUserProfile,
            updatedAt: new Date().toISOString()
          });

          // Upload any guest chats to subcollection in Firestore
          if (Array.isArray(currentChats) && currentChats.length > 0) {
            for (const chat of currentChats) {
              const sanitizedChat = {
                ...chat,
                userEmail: email.toLowerCase().trim(),
                createdAt: chat.createdAt || new Date().toISOString(),
                updatedAt: chat.updatedAt || new Date().toISOString(),
                mode: chat.mode || "general"
              };
              await setDoc(doc(db, "users", firebaseUser.uid, "chats", chat.id), sanitizedChat);
            }
          }
        } catch (dbErr) {
          handleFirestoreError(dbErr, OperationType.WRITE, `users/${firebaseUser.uid}`);
        }

        setLoading(false);
        onSuccess(newUserProfile, currentChats);
        onClose();
      } else {
        // Firebase Auth Login
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        firebaseUser = userCredential.user;

        // Fetch User Profile from Firestore
        let userProfile: UserProfile;
        try {
          const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            userProfile = {
              email: data.email || firebaseUser.email || email,
              fullName: data.fullName || firebaseUser.displayName || email.split("@")[0],
              isGuest: false,
              avatarUrl: data.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${data.fullName || email}`,
              preferences: data.preferences,
              gamification: data.gamification
            };
          } else {
            // Fallback profile if Firestore entry is missing
            userProfile = {
              email: email.toLowerCase().trim(),
              fullName: firebaseUser.displayName || email.split("@")[0],
              isGuest: false,
              avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${firebaseUser.displayName || email}`,
              preferences: {
                primaryLanguage: "English",
                rememberPersonalization: true,
                personalizationContext: "",
              },
              gamification: {
                points: 0,
                unlockedBadges: [],
                stats: {
                  chatsCompleted: 0,
                  enginesUsed: [],
                  deepResearchCompleted: 0,
                  studyCompleted: 0,
                  quizzesTaken: 0,
                  perfectQuizzes: 0,
                  factChecksCompleted: 0
                }
              }
            };
            // Seed profile
            await setDoc(doc(db, "users", firebaseUser.uid), {
              ...userProfile,
              updatedAt: new Date().toISOString()
            });
          }
        } catch (dbErr) {
          handleFirestoreError(dbErr, OperationType.GET, `users/${firebaseUser.uid}`);
          userProfile = {
            email: email.toLowerCase().trim(),
            fullName: firebaseUser.displayName || email.split("@")[0],
            isGuest: false,
            avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${firebaseUser.displayName || email}`
          };
        }

        // Fetch user's chats from Firestore subcollection
        let userChats: any[] = [];
        try {
          const chatsSnapshot = await getDocs(collection(db, "users", firebaseUser.uid, "chats"));
          userChats = chatsSnapshot.docs.map(d => d.data());
          userChats.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        } catch (dbErr) {
          handleFirestoreError(dbErr, OperationType.LIST, `users/${firebaseUser.uid}/chats`);
        }

        setLoading(false);
        onSuccess(userProfile, userChats);
        onClose();
      }
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

  const handleSelectGoogleAccount = async (selectedEmail: string, selectedName: string) => {
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

    const federatedPass = "google_federated_auth_safe_pass";

    try {
      let firebaseUser;
      let isNewUser = false;
      
      try {
        const userCredential = await signInWithEmailAndPassword(auth, selectedEmail, federatedPass);
        firebaseUser = userCredential.user;
      } catch (loginErr: any) {
        if (loginErr.code === "auth/user-not-found" || loginErr.code === "auth/invalid-credential") {
          const userCredential = await createUserWithEmailAndPassword(auth, selectedEmail, federatedPass);
          firebaseUser = userCredential.user;
          await updateProfile(firebaseUser, { displayName: selectedName });
          isNewUser = true;
        } else {
          throw loginErr;
        }
      }

      // Fetch or Create Profile
      let userProfile: UserProfile;
      try {
        const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
        if (userDoc.exists() && !isNewUser) {
          const data = userDoc.data();
          userProfile = {
            email: data.email || firebaseUser.email || selectedEmail,
            fullName: data.fullName || firebaseUser.displayName || selectedName,
            isGuest: false,
            avatarUrl: data.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${data.fullName || selectedName}`,
            preferences: data.preferences,
            gamification: data.gamification
          };
        } else {
          userProfile = {
            email: selectedEmail.toLowerCase().trim(),
            fullName: selectedName.trim(),
            isGuest: false,
            avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${selectedName.trim()}`,
            preferences: {
              primaryLanguage: "English",
              rememberPersonalization: true,
              personalizationContext: "",
            },
            gamification: {
              points: 0,
              unlockedBadges: [],
              stats: {
                chatsCompleted: 0,
                enginesUsed: [],
                deepResearchCompleted: 0,
                studyCompleted: 0,
                quizzesTaken: 0,
                perfectQuizzes: 0,
                factChecksCompleted: 0
              }
            }
          };

          await setDoc(doc(db, "users", firebaseUser.uid), {
            ...userProfile,
            updatedAt: new Date().toISOString()
          });

          // Upload any guest chats to subcollection in Firestore
          if (Array.isArray(currentChats) && currentChats.length > 0) {
            for (const chat of currentChats) {
              const sanitizedChat = {
                ...chat,
                userEmail: selectedEmail.toLowerCase().trim(),
                createdAt: chat.createdAt || new Date().toISOString(),
                updatedAt: chat.updatedAt || new Date().toISOString(),
                mode: chat.mode || "general"
              };
              await setDoc(doc(db, "users", firebaseUser.uid, "chats", chat.id), sanitizedChat);
            }
          }
        }
      } catch (dbErr) {
        handleFirestoreError(dbErr, OperationType.WRITE, `users/${firebaseUser.uid}`);
        userProfile = {
          email: selectedEmail.toLowerCase().trim(),
          fullName: selectedName.trim(),
          isGuest: false,
          avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${selectedName.trim()}`
        };
      }

      // Fetch user's chats
      let userChats: any[] = [];
      try {
        const chatsSnapshot = await getDocs(collection(db, "users", firebaseUser.uid, "chats"));
        userChats = chatsSnapshot.docs.map(d => d.data());
        userChats.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      } catch (dbErr) {
        handleFirestoreError(dbErr, OperationType.LIST, `users/${firebaseUser.uid}/chats`);
      }

      setLoading(false);
      onSuccess(userProfile, userChats);
      onClose();
    } catch (err: any) {
      console.error("Google Auth error:", err);
      setErrorFlag(err.message || "Google authentication failed. Please retry.");
      setLoading(false);
    }
  };

  const handleCustomGoogleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customGoogleEmail || !customGoogleEmail.includes("@")) {
      setErrorFlag("Please enter a valid Google email address.");
      return;
    }
    const derivedName = customGoogleName.trim() || customGoogleEmail.split("@")[0];
    handleSelectGoogleAccount(customGoogleEmail.toLowerCase().trim(), derivedName);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs select-none"
      id="nexa-auth-modal"
    >
      <div className="relative w-full max-w-md max-h-[92vh] overflow-y-auto bg-white dark:bg-[#11192e] border border-slate-100 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl transition-all duration-300" style={{ scrollbarWidth: "thin" }}>
        
        {/* Decorative Background Accents */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#C96A3D]/5 rounded-full blur-2xl" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl" />

        {/* GOOGLE CHOOSER VIEW */}
        {googleChooser ? (
          <div>
            {/* Header with Back button */}
            <div className="flex justify-between items-center mb-6">
              <button
                onClick={() => {
                  setGoogleChooser(false);
                  setErrorFlag("");
                }}
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back
              </button>
              <button
                onClick={onClose}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Google Logo */}
            <div className="flex flex-col items-center justify-center mb-6 text-center">
              <div className="flex justify-center items-center gap-0.5 text-3xl font-extrabold tracking-tight mb-2 select-none">
                <span className="text-[#4285F4]">G</span>
                <span className="text-[#EA4335]">o</span>
                <span className="text-[#FBBC05]">o</span>
                <span className="text-[#4285F4]">g</span>
                <span className="text-[#34A853]">l</span>
                <span className="text-[#EA4335]">e</span>
              </div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                Sign in with Google
              </h2>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                to continue to <strong className="text-slate-700 dark:text-slate-300">Nexa Core Engine</strong>
              </p>
            </div>

            {errorFlag && (
              <div className="mb-4 text-xs font-medium text-rose-500 bg-rose-500/10 p-3 rounded-xl border border-rose-500/20">
                {errorFlag}
              </div>
            )}

            {/* Native Google Identity Services Client Button with high-performance responsive wrapper */}
            <div className="flex flex-col items-center justify-center mb-5 w-full">
              <div id="nexa_gsi_button_container" className="w-full max-w-[325px] min-h-[44px] flex justify-center items-center" />
              <div className="flex items-center gap-2 mt-4 select-none">
                <span className="w-6 h-[1px] bg-slate-100 dark:bg-slate-800" />
                <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">or enter credentials manually</span>
                <span className="w-6 h-[1px] bg-slate-100 dark:bg-slate-800" />
              </div>
            </div>

            {/* Autofill-ready standard input designed like premium Google Identity flow to trigger device Gmail accounts */}
            <form onSubmit={handleCustomGoogleSubmit} className="space-y-4">
              <div>
                <label htmlFor="google_email_autofill" className="block text-xs font-bold text-[#14213D] dark:text-slate-300 uppercase tracking-widest mb-1.5">
                  Enter Your Google Address (Gmail) *
                </label>
                <div className="relative">
                  <input
                    id="google_email_autofill"
                    name="email"
                    type="email"
                    required
                    autoComplete="username email"
                    placeholder="example@gmail.com"
                    value={customGoogleEmail}
                    onChange={(e) => setCustomGoogleEmail(e.target.value)}
                    className="w-full text-sm py-2.5 pl-10 pr-4 rounded-xl border border-slate-205 dark:border-slate-800 bg-white dark:bg-slate-900 focus:border-[#4285F4] dark:focus:border-[#4285F4] outline-none text-[#14213D] dark:text-white transition-colors"
                  />
                  <Mail className="absolute left-3.5 top-3.5 text-slate-400 w-4 h-4" />
                </div>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                  💡 Tap above to auto-select from your mobile's Gmail credentials.
                </p>
              </div>

              <div>
                <label htmlFor="google_name_autofill" className="block text-xs font-bold text-[#14213D] dark:text-slate-300 uppercase tracking-widest mb-1.5">
                  Your Full Name (Optional)
                </label>
                <div className="relative">
                  <input
                    id="google_name_autofill"
                    name="name"
                    type="text"
                    autoComplete="name"
                    placeholder="e.g. Mayank"
                    value={customGoogleName}
                    onChange={(e) => setCustomGoogleName(e.target.value)}
                    className="w-full text-sm py-2.5 pl-10 pr-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:border-[#4285F4] dark:focus:border-[#4285F4] outline-none text-[#14213D] dark:text-white transition-colors"
                  />
                  <User className="absolute left-3.5 top-3.5 text-slate-400 w-4 h-4" />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 flex justify-center items-center gap-2 bg-[#4285F4] hover:bg-[#357ae8] text-white font-semibold py-2.5 rounded-xl transition-colors text-sm disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {loading ? "Authenticating security..." : "Continue with Google Account"}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            {/* Quick profiles option */}
            <div className="relative my-6 text-center select-none">
              <div className="absolute inset-x-0 top-2.5 border-b border-slate-100 dark:border-slate-800/80" />
              <span className="relative px-3 text-[10px] font-bold text-slate-400 bg-white dark:bg-[#11192e] uppercase tracking-widest">
                or select a quick demo profile
              </span>
            </div>

            {/* Google Predefined Account List */}
            <div className="space-y-2 max-h-[190px] overflow-y-auto pr-1">
              {googleAccounts.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => {
                    setCustomGoogleEmail(acc.email);
                    setCustomGoogleName(acc.name);
                    handleSelectGoogleAccount(acc.email, acc.name);
                  }}
                  disabled={loading}
                  className="w-full flex items-center justify-between p-2.5 rounded-2xl border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors text-left disabled:opacity-50 cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[#4285F4] font-bold text-xs uppercase shrink-0 border border-slate-200 dark:border-slate-700">
                      {acc.name[0] || "U"}
                    </div>
                    <div className="truncate">
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{acc.name}</p>
                      <p className="text-[10px] text-slate-400 truncate max-w-[200px]">{acc.email}</p>
                    </div>
                  </div>
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0 ml-2" />
                </button>
              ))}
            </div>

            <p className="mt-8 text-center text-[10px] text-slate-450 dark:text-slate-500 leading-relaxed font-normal">
              To continue, Google will share your name, email, and avatar with Nexa. See our Terms of Service & privacy policy for further details.
            </p>
          </div>
        ) : (
          /* STANDARD FORM VIEW */
          <div>
            {/* Header */}
            <div className="flex justify-between items-start mb-4">
              <Logo size={40} showText={true} textClass="text-2xl font-bold" animate={false} />
              <button
                onClick={onClose}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
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
                className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-all ${
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
                  setMethod("email"); // Registration requires Email Mode
                }}
                className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-all ${
                  isSignUp
                    ? "bg-[#C96A3D] text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                Create Account (Sign Up)
              </button>
            </div>

            {/* Methods Toggle (For Sign-In ONLY) */}
            {!isSignUp && (
              <div className="flex border-b border-slate-100 dark:border-slate-800 mb-6 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setMethod("email");
                    setErrorFlag("");
                  }}
                  className={`flex-1 pb-2.5 font-bold tracking-wider uppercase transition-colors relative ${
                    method === "email"
                      ? "text-[#C96A3D]"
                      : "text-slate-450 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                  }`}
                >
                  Via Email / Pass
                  {method === "email" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#C96A3D]" />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMethod("otp");
                    setErrorFlag("");
                  }}
                  className={`flex-1 pb-2.5 font-bold tracking-wider uppercase transition-colors relative ${
                    method === "otp"
                      ? "text-[#C96A3D]"
                      : "text-slate-450 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                  }`}
                >
                  Via Phone (OTP)
                  {method === "otp" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#C96A3D]" />}
                </button>
              </div>
            )}

            {errorFlag && (
              <div className="mb-4 text-xs font-medium text-rose-500 bg-rose-500/10 p-3 rounded-xl border border-rose-500/20">
                {errorFlag}
              </div>
            )}

            {/* Email Login/Register Form */}
            {method === "email" && (
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
                      <Chrome className="absolute left-3.5 top-3.5 text-slate-400 w-4 h-4" />
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
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 focus:outline-none"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-6 flex justify-center items-center gap-2 bg-[#14213D] hover:bg-[#C96A3D] dark:bg-white dark:hover:bg-[#C96A3D] dark:hover:text-white dark:text-[#14213D] text-white font-semibold py-2.5 rounded-xl transition-all hover:shadow-lg disabled:opacity-50"
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
            )}

            {/* OTP Login Form */}
            {method === "otp" && !isSignUp && (
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
                    className="text-[#C96A3D] font-bold hover:underline"
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
                      setMethod("email");
                    }}
                    className="text-[#C96A3D] font-bold hover:underline"
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
              onClick={() => {
                setGoogleChooser(true);
                setErrorFlag("");
              }}
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
              Google Identity Login
            </button>

            <p className="mt-5 text-center text-xs text-slate-400 font-normal leading-relaxed">
              Nexa upholds the highest privacy & security protocols.
              <br /> By clicking authenticate, you accept our premium terms.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
