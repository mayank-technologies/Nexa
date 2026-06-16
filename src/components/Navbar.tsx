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
        
        {/* Toggle Admin Dashboard */}
        {settings.isAdminVerified && (
          <button
            onClick={onToggleAdmin}
            className={`p-2.5 rounded-xl border text-slate-500 hover:text-indigo-400 bg-white dark:bg-slate-900 shadow-3xs cursor-pointer transition-all ${
              showAdmin
                ? "border-indigo-500/40 text-indigo-500 bg-indigo-500/5 dark:bg-indigo-950/20"
                : "border-slate-150 dark:border-slate-800"
            }`}
            title="Nexa Admin Operations Monitor"
          >
            <Sliders className="w-4 h-4 shrink-0" />
          </button>
        )}

        {/* Settings Modal - only in header if Guest, otherwise in sidebar bottom */}
        {user.isGuest && (
          <button
            onClick={onOpenSettings}
            className="p-2.5 rounded-xl border border-slate-150 dark:border-slate-800 text-slate-500 hover:text-[#C96A3D] bg-white dark:bg-slate-900 shadow-3xs hover:shadow-2xs transition-all cursor-pointer"
            title="Chat Configuration"
          >
            <Settings className="w-4 h-4 shrink-0" />
          </button>
        )}

        {/* Profile Card / Login Trigger */}
        {user.isGuest && (
          <button
            onClick={onOpenAuth}
            className="flex items-center gap-1.5 bg-[#14213D] hover:bg-[#C96A3D] dark:bg-slate-100 dark:text-[#14213D] dark:hover:bg-[#C96A3D] dark:hover:text-white text-white font-bold py-2 px-3.5 rounded-xl text-xs shadow-md transition-all cursor-pointer hover:shadow-lg"
          >
            <LogIn className="w-3.5 h-3.5 shrink-0" />
            <span>Login</span>
          </button>
        )}

      </div>
    </header>
  );
}
