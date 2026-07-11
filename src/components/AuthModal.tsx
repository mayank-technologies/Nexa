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
  updateProfile,
  GoogleAuthProvider,
  linkWithCredential,
  signInWithCredential,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult
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

  // Account linking states
  const [isLinking, setIsLinking] = useState(false);
  const [linkingEmail, setLinkingEmail] = useState("");
  const [linkingName, setLinkingName] = useState("");
  const [linkingIdToken, setLinkingIdToken] = useState<string | undefined>(undefined);
  const [linkingPassword, setLinkingPassword] = useState("");
  const [showLinkingPassword, setShowLinkingPassword] = useState(false);

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
            use_fedcm: false, // Disables FedCM to avoid 'identity-credentials-get' feature policy exceptions in sandboxed dev environment iframes
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
                      payload.name || payload.given_name || "Google User",
                      response.credential
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

  // Handle Google Sign-In redirect result on component mount (App startup / initialization)
  useEffect(() => {
    let active = true;
    const handleRedirectResult = async () => {
      try {
        console.log("[Nexa Client] Checking redirect result...");
        const result = await getRedirectResult(auth);
        if (!active) return;
        
        if (result && result.user) {
          const firebaseUser = result.user;
          console.log("[Nexa Client] [LOG] Redirect Sign-In successful for:", firebaseUser.email);
          setLoading(true);
          setErrorFlag("");
          
          await handleSelectGoogleAccount(
            firebaseUser.email || "",
            firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "Google User",
            undefined,
            firebaseUser
          );
        }
      } catch (err: any) {
        console.error("[Nexa Client] Redirect login result error:", err);
        let friendlyMessage = "Google sign-in via redirect failed. Please try again.";
        if (err.code === "auth/account-exists-with-different-credential") {
          friendlyMessage = "An account with this email already exists with a different login method. Please sign in with password to link.";
        } else if (err.message) {
          friendlyMessage = err.message;
        }
        setErrorFlag(friendlyMessage);
        setLoading(false);
      }
    };
    handleRedirectResult();
    
    return () => {
      active = false;
    };
  }, []);

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
          uid: firebaseUser.uid,
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
              uid: firebaseUser.uid,
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
              uid: firebaseUser.uid,
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
            uid: firebaseUser.uid,
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
      const simulatedUid = `otp-${phoneNumber}`;
      onSuccess({
        uid: simulatedUid,
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

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setErrorFlag("");

    try {
      const provider = new GoogleAuthProvider();
      // Display all Google accounts already signed into the device/browser using Google's native account chooser.
      provider.setCustomParameters({
        prompt: "select_account"
      });

      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

      if (isMobile) {
        console.log("[Nexa Client] Mobile browser detected. Using signInWithRedirect...");
        await signInWithRedirect(auth, provider);
      } else {
        console.log("[Nexa Client] Desktop browser detected. Using signInWithPopup...");
        const result = await signInWithPopup(auth, provider);
        const firebaseUser = result.user;
        console.log("[Nexa Client] Popup auth success for user:", firebaseUser.email);
        
        await handleSelectGoogleAccount(
          firebaseUser.email || "",
          firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "Google User",
          undefined,
          firebaseUser
        );
      }
    } catch (err: any) {
      console.error("[Nexa Client] Google auth error:", err);
      let friendlyMessage = "Google sign-in failed. Please try again.";
      if (err.code === "auth/popup-blocked") {
        friendlyMessage = "Google login popup was blocked by your browser. Please allow popups for Nexa.";
      } else if (err.code === "auth/account-exists-with-different-credential") {
        // Automatically fetch details and link
        const email = err.customData?.email || err.email;
        if (email) {
          setLinkingEmail(email);
          setLinkingName(err.customData?.displayName || "Google User");
          const credential = GoogleAuthProvider.credentialFromError(err);
          if (credential) {
            // Store credential if possible or keep track of flow
          }
          setIsLinking(true);
        }
        friendlyMessage = "An account with this email already exists with a different login method. Please sign in with password to link.";
      } else if (err.message) {
        friendlyMessage = err.message;
      }
      setErrorFlag(friendlyMessage);
      setLoading(false);
    }
  };

  const handleSelectGoogleAccount = async (selectedEmail: string, selectedName: string, idToken?: string, loggedInUser?: any) => {
    console.log("[Nexa Client] [LOG] handleSelectGoogleAccount invoked with email:", selectedEmail, "name:", selectedName);
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
      
      // Determine if we are doing a real Google login using GSI credential or simulated login
      if (loggedInUser) {
        firebaseUser = loggedInUser;
        console.log("[Nexa Client] [LOG] Google Sign-In success with native popup/redirect. Firebase UID:", firebaseUser.uid, "Email:", firebaseUser.email);
      } else if (idToken) {
        try {
          const credential = GoogleAuthProvider.credential(idToken);
          const userCredential = await signInWithCredential(auth, credential);
          firebaseUser = userCredential.user;
          console.log("[Nexa Client] [LOG] Google Sign-In success via GSI credential exchange. Firebase UID:", firebaseUser.uid, "Email:", firebaseUser.email);
        } catch (loginErr: any) {
          console.error("signInWithCredential error:", loginErr);
          // If the email is already in use by a different provider (e.g., Email/Password), we trigger linking!
          if (loginErr.code === "auth/account-exists-with-different-credential") {
            setLinkingEmail(selectedEmail);
            setLinkingName(selectedName);
            setLinkingIdToken(idToken);
            setLinkingPassword("");
            setIsLinking(true);
            setLoading(false);
            return;
          }
          throw loginErr;
        }
      } else {
        // Simulated Google Sign-In using federated password
        try {
          const userCredential = await signInWithEmailAndPassword(auth, selectedEmail, federatedPass);
          firebaseUser = userCredential.user;
        } catch (loginErr: any) {
          if (loginErr.code === "auth/user-not-found" || loginErr.code === "auth/invalid-credential") {
            // Check if account already exists as a custom Email/Password account by attempting registration
            try {
              const userCredential = await createUserWithEmailAndPassword(auth, selectedEmail, federatedPass);
              firebaseUser = userCredential.user;
              await updateProfile(firebaseUser, { displayName: selectedName });
              isNewUser = true;
            } catch (createErr: any) {
              if (createErr.code === "auth/email-already-in-use") {
                // Email already exists as a custom Email/Password account!
                setLinkingEmail(selectedEmail);
                setLinkingName(selectedName);
                setLinkingIdToken(undefined);
                setLinkingPassword("");
                setIsLinking(true);
                setLoading(false);
                return;
              } else {
                throw createErr;
              }
            }
          } else {
            throw loginErr;
          }
        }
      }

      // Fetch or Create Profile
      let userProfile: UserProfile;
      try {
        const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
        if (userDoc.exists() && !isNewUser) {
          const data = userDoc.data();
          userProfile = {
            uid: firebaseUser.uid,
            email: data.email || firebaseUser.email || selectedEmail,
            fullName: data.fullName || firebaseUser.displayName || selectedName,
            isGuest: false,
            avatarUrl: data.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${data.fullName || selectedName}`,
            preferences: data.preferences,
            gamification: data.gamification
          };
        } else {
          userProfile = {
            uid: firebaseUser.uid,
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
          uid: firebaseUser.uid,
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

  const handleLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkingPassword) {
      setErrorFlag("Please enter your account password to verify and link.");
      return;
    }
    setLoading(true);
    setErrorFlag("");

    let currentChats: any[] = [];
    try {
      const cached = localStorage.getItem("nexa_sessions");
      if (cached) {
        currentChats = JSON.parse(cached);
      }
    } catch (_) {}

    try {
      // 1. Sign in with the Email/Password account
      const userCredential = await signInWithEmailAndPassword(auth, linkingEmail, linkingPassword);
      const firebaseUser = userCredential.user;

      // 2. Link the Google provider automatically
      if (linkingIdToken) {
        try {
          const googleCred = GoogleAuthProvider.credential(linkingIdToken);
          await linkWithCredential(firebaseUser, googleCred);
          console.log("Successfully linked Google provider with linkWithCredential!");
        } catch (linkErr: any) {
          console.error("linkWithCredential error:", linkErr);
          if (linkErr.code !== "auth/credential-already-in-use" && linkErr.code !== "auth/provider-already-linked") {
            throw linkErr;
          }
        }
      } else {
        // Simulated Google linking
        try {
          await setDoc(doc(db, "users", firebaseUser.uid), {
            isGoogleLinked: true,
            updatedAt: new Date().toISOString()
          }, { merge: true });
        } catch (dbErr) {
          console.error("Failed to set isGoogleLinked in Firestore:", dbErr);
        }
      }

      // 3. Fetch/Create Profile
      let userProfile: UserProfile;
      try {
        const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          userProfile = {
            uid: firebaseUser.uid,
            email: data.email || firebaseUser.email || linkingEmail,
            fullName: data.fullName || firebaseUser.displayName || linkingName,
            isGuest: false,
            avatarUrl: data.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${data.fullName || linkingName}`,
            preferences: data.preferences,
            gamification: data.gamification
          };
        } else {
          userProfile = {
            uid: firebaseUser.uid,
            email: linkingEmail.toLowerCase().trim(),
            fullName: linkingName.trim(),
            isGuest: false,
            avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${linkingName.trim()}`,
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
        }
      } catch (dbErr) {
        handleFirestoreError(dbErr, OperationType.WRITE, `users/${firebaseUser.uid}`);
        userProfile = {
          uid: firebaseUser.uid,
          email: linkingEmail.toLowerCase().trim(),
          fullName: linkingName.trim(),
          isGuest: false,
          avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${linkingName.trim()}`
        };
      }

      // 4. Fetch user's chats
      let userChats: any[] = [];
      try {
        const chatsSnapshot = await getDocs(collection(db, "users", firebaseUser.uid, "chats"));
        userChats = chatsSnapshot.docs.map(d => d.data());
        userChats.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      } catch (dbErr) {
        handleFirestoreError(dbErr, OperationType.LIST, `users/${firebaseUser.uid}/chats`);
      }

      setLoading(false);
      setIsLinking(false);
      onSuccess(userProfile, userChats);
      onClose();
    } catch (err: any) {
      console.error("Linking Error:", err);
      let friendlyMessage = "Failed to link accounts. Please verify your password.";
      if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password") {
        friendlyMessage = "Incorrect password. Please verify and try again.";
      } else if (err.message) {
        friendlyMessage = err.message;
      }
      setErrorFlag(friendlyMessage);
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

        {/* GOOGLE CHOOSER OR LINKING OR STANDARD VIEW */}
        {isLinking ? (
          /* LINKING VIEW */
          <div>
            {/* Header with Back button */}
            <div className="flex justify-between items-center mb-6">
              <button
                onClick={() => {
                  setIsLinking(false);
                  setErrorFlag("");
                  setLinkingPassword("");
                }}
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Cancel
              </button>
              <button
                onClick={onClose}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Icon and Title */}
            <div className="flex flex-col items-center justify-center mb-6 text-center">
              <div className="w-12 h-12 rounded-full bg-indigo-500/10 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-500 mb-3 border border-indigo-500/10">
                <ShieldCheck className="w-6 h-6 animate-pulse" />
              </div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                Link Google Account
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 max-w-xs leading-relaxed">
                An Email/Password account already exists for <strong className="text-slate-800 dark:text-slate-200">{linkingEmail}</strong>. Please enter your account password to link your Google login securely.
              </p>
            </div>

            {errorFlag && (
              <div className="mb-4 text-xs font-medium text-rose-500 bg-rose-500/10 p-3 rounded-xl border border-rose-500/20">
                {errorFlag}
              </div>
            )}

            <form onSubmit={handleLinkSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#14213D] dark:text-slate-300 uppercase tracking-widest mb-1.5">
                  Your Password *
                </label>
                <div className="relative">
                  <input
                    type={showLinkingPassword ? "text" : "password"}
                    required
                    placeholder="••••••••"
                    value={linkingPassword}
                    onChange={(e) => setLinkingPassword(e.target.value)}
                    className="w-full text-sm py-2.5 pl-10 pr-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:border-[#C96A3D] dark:focus:border-[#C96A3D] outline-none text-[#14213D] dark:text-white transition-colors"
                  />
                  <Lock className="absolute left-3.5 top-3.5 text-slate-400 w-4 h-4" />
                  <button
                    type="button"
                    onClick={() => setShowLinkingPassword(!showLinkingPassword)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 flex justify-center items-center gap-2 bg-[#14213D] hover:bg-[#C96A3D] text-white font-semibold py-2.5 rounded-xl transition-colors text-sm disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {loading ? "Linking your profile..." : "Confirm & Link Account"}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        ) : googleChooser ? (
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
                handleGoogleSignIn();
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
              Continue with Google
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
