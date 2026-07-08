/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Sun, Moon, Sliders, Settings, LogIn, LogOut, HelpCircle, GraduationCap, Search, CheckSquare, PencilLine, CheckCircle, Menu } from "lucide-react";
import { Logo } from "./Logo";
import { UserProfile, AppSettings } from "../types";

interface NavbarProps {
  user: UserProfile;
  settings: AppSettings;
  activeMode: "general" | "research" | "study" | "factcheck" | "writing" | "quiz";
  onToggleTheme: () => void;
  onOpenSettings: () => void;
  onOpenAuth: () => void;
  onLogout: () => void;
  showAdmin: boolean;
  onToggleAdmin: () => void;
  onOpenPremium: () => void;
  onOpenFeedback?: () => void;
  onLogoClick?: () => void;
  onLogoDoubleClick?: () => void;
  onToggleSidebar?: () => void;
}

export function Navbar({
  user,
  settings,
  activeMode,
  onToggleTheme,
  onOpenSettings,
  onOpenAuth,
  onLogout,
  showAdmin,
  onToggleAdmin,
  onOpenPremium,
  onOpenFeedback,
  onLogoClick,
  onLogoDoubleClick,
  onToggleSidebar,
}: NavbarProps) {
  const modeLabels = {
    general: { label: "General Chat", icon: <HelpCircle className="w-4 h-4 text-[#C96A3D]" /> },
    research: { label: "Deep Research", icon: <Search className="w-4 h-4 text-rose-500 animate-pulse" /> },
    study: { label: "Study Mode", icon: <GraduationCap className="w-4 h-4 text-emerald-500" /> },
    factcheck: { label: "Fact Checker", icon: <CheckCircle className="w-4 h-4 text-indigo-500" /> },
    writing: { label: "Writing Assistant", icon: <PencilLine className="w-4 h-4 text-[#C96A3D]" /> },
    quiz: { label: "MCQ Quiz Arena", icon: <GraduationCap className="w-4 h-4 text-[#C96A3D] animate-bounce" /> },
  };

  const currentMode = modeLabels[activeMode] || modeLabels.general;

  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between px-6 py-4 bg-white/80 dark:bg-[#0c1222]/80 backdrop-blur-md border-b border-slate-100 dark:border-slate-800/80 max-w-full overflow-hidden"
      id="nexa-navbar"
    >
      {/* Brand Logo next to active mode */}
      <div className="flex items-center gap-3">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="md:hidden p-2 rounded-xl border border-slate-150 dark:border-slate-800 text-slate-500 hover:text-[#C96A3D] dark:hover:text-[#C96A3D] bg-white dark:bg-slate-900 shadow-3xs cursor-pointer active:scale-95 transition-all"
            title="Toggle Sidebar Navigation"
          >
            <Menu className="w-4 h-4" />
          </button>
        )}
        <button
          id="nexa-navbar-logo"
          onClick={onLogoClick}
          onDoubleClick={onLogoDoubleClick}
          className="flex items-center text-left bg-transparent border-none p-0 cursor-pointer focus:outline-none transition-all hover:opacity-90 active:scale-98"
          title="Return to Nexa Homepage (Double click for Admin)"
        >
          <Logo size={40} showText={true} textClass="text-lg font-black" animate={false} />
        </button>
        
        {/* Active Mode Capsule indicator */}
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-850 rounded-full font-bold text-[10px] text-slate-500 uppercase tracking-wider select-none">
          {currentMode.icon}
          <span>{currentMode.label}</span>
        </div>
      </div>

      {/* Action Bars Row */}
      <div className="flex items-center gap-2 md:gap-3 shrink-0">
        
        {/* Upgrade to Premium Trigger Pill */}
        <button
          onClick={onOpenPremium}
          className="relative overflow-hidden flex items-center gap-1.5 bg-gradient-to-r from-[#C96A3D] via-[#e25714] to-[#f47c36] hover:brightness-110 text-white font-extrabold py-2 px-3 sm:px-4 rounded-full text-[10.5px] sm:text-xs shadow-md hover:shadow-lg transition-all cursor-pointer hover:scale-105 active:scale-98 select-none shrink-0 animate-premium-glow"
          title="Upgrade to Nexa Premium Waitlist"
          id="navbar-premium-upgrade-btn"
        >
          {/* Inner sliding shine animation */}
          <div className="animate-premium-shine" />
          
          <span className="relative z-10 flex items-center gap-1">
            <span className="text-amber-300">✨</span>
            <span className="tracking-tight">Upgrade to Premium</span>
          </span>
        </button>

      </div>
    </header>
  );
}
