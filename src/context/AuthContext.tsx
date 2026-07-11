/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect } from "react";
import { onAuthStateChanged, signOut, User as FirebaseUser } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { UserProfile } from "../types";
import { safeStorage } from "../utils/storage";
import { trackAction } from "../utils/gamification";

interface AuthContextType {
  user: UserProfile | null;
  isAuthLoading: boolean;
  authError: string | null;
  logout: () => Promise<void>;
  updateUser: (newUser: Partial<UserProfile>) => void;
  triggerActionTracking: (
    actionType: "send_message" | "complete_research" | "complete_study" | "complete_quiz" | "complete_fact_check",
    payload?: { engineId?: string; correctAnswers?: number; totalQuestions?: number },
    onBadgeUnlocked?: (badge: any) => void
  ) => void;
  setAuthError: React.Dispatch<React.SetStateAction<string | null>>;
  setIsAuthLoading: React.Dispatch<React.SetStateAction<boolean>>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    console.log("[Nexa AuthProvider] [LOG] Initializing Firebase Auth observer.");
    
    const unsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUser) => {
        console.log(
          "[Nexa AuthProvider] [LOG] onAuthStateChanged fired. FirebaseUser:",
          firebaseUser ? { uid: firebaseUser.uid, email: firebaseUser.email, displayName: firebaseUser.displayName } : "null"
        );

        setIsAuthLoading(true);
        setAuthError(null);

        if (firebaseUser) {
          console.log("[Nexa AuthProvider] [LOG] User is authenticated. Fetching user profile for UID:", firebaseUser.uid);
          try {
            const userDocRef = doc(db, "users", firebaseUser.uid);
            const userDoc = await getDoc(userDocRef);

            let userProfile: UserProfile;

            if (userDoc.exists()) {
              const data = userDoc.data();
              console.log("[Nexa AuthProvider] [LOG] User profile found in Firestore:", data);
              userProfile = {
                uid: firebaseUser.uid,
                email: data.email || firebaseUser.email || "",
                fullName: data.fullName || firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "User",
                isGuest: false,
                avatarUrl: data.avatarUrl || firebaseUser.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${data.fullName || firebaseUser.displayName || "User"}`,
                preferences: data.preferences || {
                  primaryLanguage: "English",
                  rememberPersonalization: true,
                  personalizationContext: "",
                },
                gamification: data.gamification || {
                  points: 0,
                  unlockedBadges: [],
                  stats: {
                    chatsCompleted: 0,
                    enginesUsed: [],
                    deepResearchCompleted: 0,
                    studyCompleted: 0,
                    quizzesTaken: 0,
                    perfectQuizzes: 0,
                    factChecksCompleted: 0,
                  },
                },
              };

              // Sync Firestore values back if they've changed or are missing essential attributes
              if (!data.avatarUrl && firebaseUser.photoURL) {
                await setDoc(userDocRef, { avatarUrl: firebaseUser.photoURL }, { merge: true });
              }
            } else {
              console.log("[Nexa AuthProvider] [LOG] No profile found in Firestore for UID:", firebaseUser.uid, ". Seeding new profile.");
              userProfile = {
                uid: firebaseUser.uid,
                email: firebaseUser.email || "",
                fullName: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "User",
                isGuest: false,
                avatarUrl: firebaseUser.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${firebaseUser.displayName || "User"}`,
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
                    factChecksCompleted: 0,
                  },
                },
              };

              await setDoc(userDocRef, {
                ...userProfile,
                updatedAt: new Date().toISOString(),
              });
              console.log("[Nexa AuthProvider] [LOG] Seeded Firestore user profile successfully.");
            }

            // Guarantee Guest User is NEVER set or fallback active if authenticated
            setUser(userProfile);
            console.log("[Nexa AuthProvider] [LOG] Authentication successfully resolved for:", userProfile.email);
          } catch (err: any) {
            console.error("[Nexa AuthProvider] [ERROR] Failed to load user profile from Firestore:", err);
            // Display exact Firebase error instead of falling back to Guest User
            setAuthError(err.message || "An error occurred while loading your profile from Firestore.");
            setUser(null);
          } finally {
            setIsAuthLoading(false);
          }
        } else {
          console.log("[Nexa AuthProvider] [LOG] No authenticated user detected (Firebase user is null).");
          // Truly guest state
          const guestProfile: UserProfile = {
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
          setUser(guestProfile);
          setIsAuthLoading(false);
        }
      },
      (error) => {
        console.error("[Nexa AuthProvider] [ERROR] onAuthStateChanged error:", error);
        setAuthError(error.message || "An authentication subscription error occurred.");
        setIsAuthLoading(false);
        setUser(null);
      }
    );

    return () => {
      console.log("[Nexa AuthProvider] [LOG] Cleaning up persistent Firebase Auth observer.");
      unsubscribe();
    };
  }, []);

  // Synchronize App States to Cache LocalStorage & Firestore
  useEffect(() => {
    if (!user) return;
    
    console.log("[Nexa AuthProvider] [LOG] User state synchronized:", user.email, "IsGuest:", user.isGuest);
    safeStorage.setItem("nexa_user", JSON.stringify(user));
    
    if (!user.isGuest && auth.currentUser) {
      const updateProfileInFirestore = async () => {
        try {
          const userDocRef = doc(db, "users", auth.currentUser!.uid);
          await setDoc(userDocRef, {
            email: user.email,
            fullName: user.fullName,
            isGuest: false,
            avatarUrl: user.avatarUrl,
            preferences: user.preferences || { primaryLanguage: "English", rememberPersonalization: true, personalizationContext: "" },
            gamification: user.gamification || { points: 0, unlockedBadges: [], stats: { chatsCompleted: 0, enginesUsed: [], deepResearchCompleted: 0, studyCompleted: 0, quizzesTaken: 0, perfectQuizzes: 0, factChecksCompleted: 0 } },
            updatedAt: new Date().toISOString()
          }, { merge: true });
        } catch (err) {
          console.error("[Nexa AuthProvider] [ERROR] Failed to update user profile in Firestore:", err);
        }
      };
      updateProfileInFirestore();
    }
  }, [user]);

  const logout = async () => {
    console.log("[Nexa AuthProvider] [LOG] Logging out. Clearing user session.");
    setIsAuthLoading(true);
    setAuthError(null);
    try {
      await signOut(auth);
      console.log("[Nexa AuthProvider] [LOG] Sign-out completed.");
    } catch (err: any) {
      console.error("[Nexa AuthProvider] [ERROR] Sign-out failed:", err);
      setAuthError(err.message || "Logout failed.");
      setIsAuthLoading(false);
    }
  };

  const updateUser = (newUser: Partial<UserProfile>) => {
    setUser((prev) => {
      if (!prev) return null;
      return { ...prev, ...newUser };
    });
  };

  const triggerActionTracking = (
    actionType: "send_message" | "complete_research" | "complete_study" | "complete_quiz" | "complete_fact_check",
    payload?: { engineId?: string; correctAnswers?: number; totalQuestions?: number },
    onBadgeUnlocked?: (badge: any) => void
  ) => {
    setUser((prevUser) => {
      if (!prevUser) return null;
      const { newState, newlyUnlocked } = trackAction(prevUser.gamification, {
        type: actionType,
        payload,
      });

      if (newlyUnlocked.length > 0 && onBadgeUnlocked) {
        onBadgeUnlocked(newlyUnlocked[0]);
      }

      return {
        ...prevUser,
        gamification: newState,
      };
    });
  };

  const value: AuthContextType = {
    user,
    isAuthLoading,
    authError,
    logout,
    updateUser,
    triggerActionTracking,
    setAuthError,
    setIsAuthLoading
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
