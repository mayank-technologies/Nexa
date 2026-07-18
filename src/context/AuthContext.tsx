/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect } from "react";
import { UserProfile } from "../types";
import { safeStorage } from "../utils/storage";
import { trackAction } from "../utils/gamification";
import { supabase, syncUserProfileToSupabase } from "../utils/supabaseClient";

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
    console.log("[Nexa AuthProvider] [LOG] Initializing Supabase Auth observer.");
    setIsAuthLoading(true);

    const initializeAuth = async () => {
      try {
        // 1. Check current active Supabase session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session && session.user) {
          const sUser = session.user;
          console.log("[Nexa AuthProvider] [LOG] Active Supabase session detected:", sUser.email);
          
          // Fetch user profile from public.users table in Supabase
          const { data: profile, error } = await supabase
            .from("users")
            .select("*")
            .eq("id", sUser.id)
            .single();

          if (profile && !error) {
            console.log("[Nexa AuthProvider] [LOG] Profile loaded from Supabase:", profile);
            setUser({
              uid: sUser.id,
              email: profile.email || sUser.email || "",
              fullName: profile.full_name || sUser.user_metadata?.full_name || sUser.email?.split("@")[0] || "User",
              isGuest: false,
              avatarUrl: profile.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${profile.full_name || sUser.email}`,
              preferences: profile.preferences || { primaryLanguage: "English", rememberPersonalization: true, personalizationContext: "" },
              gamification: profile.gamification || { points: 0, unlockedBadges: [], stats: { chatsCompleted: 0, enginesUsed: [], deepResearchCompleted: 0, studyCompleted: 0, quizzesTaken: 0, perfectQuizzes: 0, factChecksCompleted: 0 } }
            });
          } else {
            // Profile doesn't exist yet, seed it!
            console.log("[Nexa AuthProvider] [LOG] No profile in Supabase table. Seeding new profile row.");
            const resolvedFullName = sUser.user_metadata?.full_name || sUser.email?.split("@")[0] || "User";
            const initialProfile = {
              uid: sUser.id,
              email: sUser.email || "",
              fullName: resolvedFullName,
              isGuest: false,
              avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${resolvedFullName}`,
              preferences: { primaryLanguage: "English", rememberPersonalization: true, personalizationContext: "" },
              gamification: { points: 0, unlockedBadges: [], stats: { chatsCompleted: 0, enginesUsed: [], deepResearchCompleted: 0, studyCompleted: 0, quizzesTaken: 0, perfectQuizzes: 0, factChecksCompleted: 0 } }
            };
            
            setUser(initialProfile);
            await syncUserProfileToSupabase(initialProfile);
          }
        } else {
          // Check localStorage cached user
          const cachedUserStr = safeStorage.getItem("nexa_user");
          if (cachedUserStr) {
            try {
              const cachedUser = JSON.parse(cachedUserStr);
              if (cachedUser) {
                console.log("[Nexa AuthProvider] [LOG] Restored user from offline cache:", cachedUser.email);
                setUser(cachedUser);
                setIsAuthLoading(false);
                return;
              }
            } catch (_) {}
          }

          // Fallback to Guest
          console.log("[Nexa AuthProvider] [LOG] No session detected. Setting Guest User.");
          setUser({
            email: "guest@nexa.ai",
            fullName: "Guest User",
            isGuest: true,
            avatarUrl: "https://api.dicebear.com/7.x/initials/svg?seed=Guest",
            preferences: { primaryLanguage: "English", rememberPersonalization: true, personalizationContext: "" },
          });
        }
      } catch (err: any) {
        console.error("[Nexa AuthProvider] [ERROR] Initialization error:", err);
        setAuthError(err.message || "An error occurred during authentication.");
      } finally {
        setIsAuthLoading(false);
      }
    };

    initializeAuth();

    // Listen to Supabase auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("[Nexa AuthProvider] [LOG] Supabase onAuthStateChange fired:", event);
      if (event === "SIGNED_IN" && session?.user) {
        const sUser = session.user;
        const { data: profile } = await supabase.from("users").select("*").eq("id", sUser.id).single();
        if (profile) {
          setUser({
            uid: sUser.id,
            email: profile.email || sUser.email || "",
            fullName: profile.full_name || sUser.user_metadata?.full_name || sUser.email?.split("@")[0] || "User",
            isGuest: false,
            avatarUrl: profile.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${profile.full_name || sUser.email}`,
            preferences: profile.preferences || { primaryLanguage: "English", rememberPersonalization: true, personalizationContext: "" },
            gamification: profile.gamification || { points: 0, unlockedBadges: [], stats: { chatsCompleted: 0, enginesUsed: [], deepResearchCompleted: 0, studyCompleted: 0, quizzesTaken: 0, perfectQuizzes: 0, factChecksCompleted: 0 } }
          });
        }
      } else if (event === "SIGNED_OUT") {
        setUser({
          email: "guest@nexa.ai",
          fullName: "Guest User",
          isGuest: true,
          avatarUrl: "https://api.dicebear.com/7.x/initials/svg?seed=Guest",
          preferences: { primaryLanguage: "English", rememberPersonalization: true, personalizationContext: "" },
        });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Synchronize App States to Cache LocalStorage & Supabase
  useEffect(() => {
    if (!user) return;
    
    console.log("[Nexa AuthProvider] [LOG] User state synchronized:", user.email, "IsGuest:", user.isGuest);
    safeStorage.setItem("nexa_user", JSON.stringify(user));
    
    if (!user.isGuest && user.uid) {
      const updateProfileInSupabase = async () => {
        try {
          const profileData = {
            ...user,
            updatedAt: new Date().toISOString()
          };
          // Simultaneously synchronize to Supabase
          await syncUserProfileToSupabase(profileData);
        } catch (err) {
          console.error("[Nexa AuthProvider] [ERROR] Failed to update user profile in Supabase:", err);
        }
      };
      updateProfileInSupabase();
    }
  }, [user]);

  const logout = async () => {
    console.log("[Nexa AuthProvider] [LOG] Logging out. Clearing user session.");
    setIsAuthLoading(true);
    setAuthError(null);
    try {
      await supabase.auth.signOut();
      console.log("[Nexa AuthProvider] [LOG] Sign-out completed.");
    } catch (err: any) {
      console.error("[Nexa AuthProvider] [ERROR] Sign-out failed:", err);
      setAuthError(err.message || "Logout failed.");
    } finally {
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
        setTimeout(() => {
          onBadgeUnlocked(newlyUnlocked[0]);
        }, 0);
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
