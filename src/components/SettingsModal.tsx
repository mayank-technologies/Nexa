/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from "react";
import { X, Moon, Sun, Globe, EyeOff, Key, Trash2, Save, Sparkles, User, CheckCircle, Camera, Image, FileText, Mic, Shield, Trophy, Volume2, Database, Loader2, Wifi, WifiOff, Sliders, HelpCircle, LogOut } from "lucide-react";
import { AppSettings, UserProfile } from "../types";
import { playUiSound } from "../utils/sounds";
import { Logo } from "./Logo";
import { AchievementsProfile } from "./AchievementsProfile";
import { db } from "../firebase";
import { collection, addDoc, getDoc } from "firebase/firestore";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  user: UserProfile;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  onUpdateUser: (newUser: Partial<UserProfile>) => void;
  onClearChats: () => void;
  permissions: {
    camera: boolean;
    photos: boolean;
    document: boolean;
    microphone: boolean;
  };
  onUpdatePermissions: (newPermissions: SettingsModalProps["permissions"]) => void;
  onLogout?: () => void;
  onOpenFeedback?: () => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  settings,
  user,
  onUpdateSettings,
  onUpdateUser,
  onClearChats,
  permissions,
  onUpdatePermissions,
  onLogout,
  onOpenFeedback,
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<"preferences" | "achievements">("preferences");
  const [profileName, setProfileName] = useState(user.fullName);
  const [avatarUrlState, setAvatarUrlState] = useState<string | undefined>(user.avatarUrl);
  const [personalization, setPersonalization] = useState(settings.personalizationNotes);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [testStatus, setTestStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [testError, setTestError] = useState<string | null>(null);
  const [testDetails, setTestDetails] = useState<string | null>(null);

  const runConnectionTest = async () => {
    setTestStatus("loading");
    setTestError(null);
    setTestDetails(null);
    try {
      playUiSound("success");
    } catch (_) {}
    
    try {
      // 1. Create a document in a collection named "connection_test"
      const testCollectionRef = collection(db, "connection_test");
      const docRef = await addDoc(testCollectionRef, {
        timestamp: new Date().toISOString(),
        testedBy: user.email || "anonymous_test_user",
        message: "Nexa Firebase connection verification"
      });
      
      // 2. Read the same document
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        setTestStatus("success");
        setTestDetails(`Document Path: connection_test/${docSnap.id}\nTimestamp: ${data.timestamp}`);
        try {
          playUiSound("success");
        } catch (_) {}
      } else {
        throw new Error("Document was created but could not be read back (not found).");
      }
    } catch (err: any) {
      console.error("Firebase Connection Test failed:", err);
      setTestStatus("error");
      setTestError(err?.message || String(err));
      try {
        playUiSound("error");
      } catch (_) {}
    }
  };

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("Image size should be less than 2MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarUrlState(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    onUpdateUser({ 
      fullName: profileName, 
      avatarUrl: avatarUrlState 
    });
    onUpdateSettings({
      personalizationNotes: personalization,
    });
    setSaveSuccess(true);
    playUiSound("success");
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const languagesList = [
    "English",
    "Hindi (हिन्दी)",
    "Hinglish",
    "Urdu (اردو)",
    "Punjabi (ਪੰਜਾਬੀ)",
    "Gujarati (ગુજરાતી)",
    "Marathi (मराठी)",
    "Bengali (বাংলা)",
    "Tamil (தமிழ்)",
    "Telugu (తెలుగు)",
    "Malayalam (മലയാളം)",
    "Kannada (ಕನ್ನಡ)",
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs"
      id="nexa-settings-modal"
    >
      <div className="relative w-full max-w-2xl bg-white dark:bg-[#11192e] border border-slate-100 dark:border-slate-800 rounded-3xl p-8 shadow-xl max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-6 border-b border-slate-100 dark:border-slate-850 pb-4">
          <div className="flex items-center gap-2.5">
            <Logo size={24} showText={false} animate={false} />
            <h3 className="text-xl font-bold text-[#14213D] dark:text-white font-sans">
              Settings & Preferences
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Controls */}
        <div className="flex border-b border-slate-100 dark:border-slate-800/80 mb-6 gap-1 select-none">
          <button
            onClick={() => setActiveTab("preferences")}
            className={`pb-2.5 text-xs sm:text-sm font-bold border-b-2 px-3 transition-colors ${
              activeTab === "preferences"
                ? "border-[#C96A3D] text-[#C96A3D]"
                : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            }`}
          >
            Preferences & Profile
          </button>
          <button
            onClick={() => setActiveTab("achievements")}
            className={`pb-2.5 text-xs sm:text-sm font-bold border-b-2 px-3 transition-colors flex items-center gap-1.5 bg-transparent ${
              activeTab === "achievements"
                ? "border-[#C96A3D] text-[#C96A3D]"
                : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            }`}
          >
            <Trophy className="w-3.5 h-3.5 text-amber-500" />
            Achievements & Badges
            {user.gamification?.points ? (
              <span className="ml-1 text-[9px] font-black bg-[#C96A3D]/10 text-[#C96A3D] px-1.5 py-0.5 rounded-full">
                {user.gamification.points} XP
              </span>
            ) : null}
          </button>
        </div>

        {activeTab === "preferences" ? (
          <>
            {/* Content body Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              
              {/* Left Column: General & AI Settings */}
              <div className="space-y-6">
                
                {/* General Section */}
                <div className="space-y-4 p-5 bg-slate-50/50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800 rounded-2xl">
                  <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                    <Sliders className="w-4 h-4" />
                    General Settings
                  </h4>
                  
                  {/* Theme Selector */}
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-[#14213D] dark:text-slate-300">
                      Appearance System
                    </label>
                    <div className="flex bg-slate-100/50 dark:bg-slate-850 p-1 rounded-xl border border-slate-200/50 dark:border-slate-800 gap-1 select-none">
                      <button
                        type="button"
                        onClick={() => onUpdateSettings({ theme: "light" })}
                        className={`flex-1 flex justify-center items-center gap-2 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                          settings.theme === "light"
                            ? "bg-white text-[#14213D] shadow-3xs"
                            : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                        }`}
                      >
                        <Sun className="w-3.5 h-3.5" />
                        Light
                      </button>
                      <button
                        type="button"
                        onClick={() => onUpdateSettings({ theme: "dark" })}
                        className={`flex-1 flex justify-center items-center gap-2 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                          settings.theme === "dark"
                            ? "bg-slate-800 text-white shadow-3xs"
                            : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                        }`}
                      >
                        <Moon className="w-3.5 h-3.5" />
                        Dark
                      </button>
                    </div>
                  </div>

                  {/* Language Selector */}
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-[#14213D] dark:text-slate-300 flex items-center gap-1">
                      <Globe className="w-3.5 h-3.5 text-slate-400" />
                      Default Chat Language
                    </label>
                    <select
                      value={settings.language}
                      onChange={(e) => onUpdateSettings({ language: e.target.value })}
                      className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:border-[#C96A3D] outline-none text-[#14213D] dark:text-white transition-colors cursor-pointer font-semibold"
                    >
                      {languagesList.map((lang) => (
                        <option key={lang} value={lang}>
                          {lang}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Sound Effects Toggle */}
                  <div className="flex items-center justify-between p-2.5 bg-white/50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-850 rounded-xl">
                    <div className="flex items-center gap-2">
                      <Volume2 className="w-3.5 h-3.5 text-[#C96A3D] shrink-0" />
                      <h5 className="text-xs font-semibold text-[#14213D] dark:text-slate-200">
                        🔊 Sound Effects
                      </h5>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.soundEffectsActive !== false}
                      onChange={(e) => onUpdateSettings({ soundEffectsActive: e.target.checked })}
                      className="w-4 h-4 accent-[#C96A3D] cursor-pointer rounded"
                    />
                  </div>

                  {/* Thread History & Turbo Toggles */}
                  <div className="space-y-2 pt-1.5 border-t border-slate-150 dark:border-slate-800/60">
                    <div className="flex items-center justify-between p-2.5 bg-white/50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-850 rounded-xl">
                      <div className="flex items-center gap-2">
                        <EyeOff className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="text-xs font-semibold text-[#14213D] dark:text-slate-200">Record Thread History</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.privacySaveHistory}
                        onChange={(e) => onUpdateSettings({ privacySaveHistory: e.target.checked })}
                        className="w-4 h-4 accent-[#C96A3D] cursor-pointer"
                      />
                    </div>

                    <div className="flex items-center justify-between p-2.5 bg-white/50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-850 rounded-xl">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-3.5 h-3.5 text-[#C96A3D] shrink-0" />
                        <span className="text-xs font-semibold text-[#14213D] dark:text-slate-200">Nexa Turbo Mode</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.turboMode !== false}
                        onChange={(e) => onUpdateSettings({ turboMode: e.target.checked })}
                        className="w-4 h-4 accent-[#C96A3D] cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Device Privileges Sub-list */}
                  <div className="space-y-2 pt-2 border-t border-slate-150 dark:border-slate-800/60">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Device Permissions</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => onUpdatePermissions({ ...permissions, camera: !permissions.camera })}
                        className={`p-1.5 px-2.5 border rounded-lg flex items-center justify-between text-left transition-all cursor-pointer ${
                          permissions.camera ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 font-bold" : "border-slate-100 dark:border-slate-850 bg-white dark:bg-slate-900 text-slate-400"
                        }`}
                      >
                        <span className="text-[10px] truncate">Camera</span>
                        <span className="text-[8px] font-bold uppercase">{permissions.camera ? "On" : "Off"}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onUpdatePermissions({ ...permissions, photos: !permissions.photos })}
                        className={`p-1.5 px-2.5 border rounded-lg flex items-center justify-between text-left transition-all cursor-pointer ${
                          permissions.photos ? "border-sky-500/20 bg-sky-500/5 text-sky-600 dark:text-sky-400 font-bold" : "border-slate-100 dark:border-slate-850 bg-white dark:bg-slate-900 text-slate-400"
                        }`}
                      >
                        <span className="text-[10px] truncate">Photos</span>
                        <span className="text-[8px] font-bold uppercase">{permissions.photos ? "On" : "Off"}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onUpdatePermissions({ ...permissions, document: !permissions.document })}
                        className={`p-1.5 px-2.5 border rounded-lg flex items-center justify-between text-left transition-all cursor-pointer ${
                          permissions.document ? "border-amber-500/20 bg-amber-500/5 text-amber-600 dark:text-amber-400 font-bold" : "border-slate-100 dark:border-slate-850 bg-white dark:bg-slate-900 text-slate-400"
                        }`}
                      >
                        <span className="text-[10px] truncate">Docs</span>
                        <span className="text-[8px] font-bold uppercase">{permissions.document ? "On" : "Off"}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onUpdatePermissions({ ...permissions, microphone: !permissions.microphone })}
                        className={`p-1.5 px-2.5 border rounded-lg flex items-center justify-between text-left transition-all cursor-pointer ${
                          permissions.microphone ? "border-[#C96A3D]/20 bg-[#C96A3D]/5 text-[#C96A3D] font-bold" : "border-slate-100 dark:border-slate-850 bg-white dark:bg-slate-900 text-slate-400"
                        }`}
                      >
                        <span className="text-[10px] truncate">Mic</span>
                        <span className="text-[8px] font-bold uppercase">{permissions.microphone ? "On" : "Off"}</span>
                      </button>
                    </div>
                  </div>

                </div>

                {/* AI Section */}
                <div className="space-y-4 p-5 bg-slate-50/50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800 rounded-2xl">
                  <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#C96A3D]">
                    <Sparkles className="w-4 h-4 animate-pulse" />
                    AI Intelligence & Voice
                  </h4>

                  {/* Default AI Mode */}
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-[#14213D] dark:text-slate-300">
                      Default AI Agent Mode
                    </label>
                    <select
                      value={settings.defaultAiMode || "general"}
                      onChange={(e) => onUpdateSettings({ defaultAiMode: e.target.value as any })}
                      className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:border-[#C96A3D] outline-none text-[#14213D] dark:text-white transition-colors cursor-pointer font-semibold"
                    >
                      <option value="general">General AI Assistant</option>
                      <option value="research">Deep Research Specialist</option>
                      <option value="study">Study Guide & Tutor</option>
                      <option value="factcheck">Nexa Fact Checker</option>
                      <option value="writing">Creative Writing Expert</option>
                      <option value="quiz">Interactive MCQ Quiz Arena</option>
                    </select>
                  </div>

                  {/* Voice Settings Selection */}
                  <div className="space-y-4 p-4 border border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/30 rounded-2xl">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800/40">
                      <Mic className="w-4 h-4 text-[#C96A3D]" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#14213D] dark:text-slate-200">
                        Voice Experience Settings
                      </h4>
                    </div>

                    {/* Voice Selection */}
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400">
                        Voice Selection
                      </label>
                      <select
                        value={settings.voiceSetting || "optimal-google"}
                        onChange={(e) => onUpdateSettings({ voiceSetting: e.target.value })}
                        className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:border-[#C96A3D] outline-none text-[#14213D] dark:text-white transition-colors cursor-pointer font-semibold"
                      >
                        <option value="optimal-google">Optimal (Google US English)</option>
                        <option value="alloy">Alloy (Warm & Balanced)</option>
                        <option value="echo">Echo (Professional Male)</option>
                        <option value="fable">Fable (Narrative & Expressive)</option>
                        <option value="onyx">Onyx (Deep Baritone)</option>
                        <option value="nova">Nova (Bright & Clear Female)</option>
                        <option value="shimmer">Shimmer (Professional Female)</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {/* Voice Language */}
                      <div className="space-y-1.5">
                        <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <Globe className="w-3 h-3 text-slate-400" />
                          Language
                        </label>
                        <select
                          value={settings.voiceLanguage || "en-US"}
                          onChange={(e) => onUpdateSettings({ voiceLanguage: e.target.value })}
                          className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:border-[#C96A3D] outline-none text-[#14213D] dark:text-white transition-colors cursor-pointer font-semibold"
                        >
                          <option value="en-US">English (United States)</option>
                          <option value="en-GB">English (Great Britain)</option>
                          <option value="es-ES">Spanish (Spain)</option>
                          <option value="fr-FR">French (France)</option>
                          <option value="de-DE">German (Germany)</option>
                          <option value="it-IT">Italian (Italy)</option>
                          <option value="ja-JP">Japanese (Japan)</option>
                          <option value="zh-CN">Chinese (Simplified)</option>
                        </select>
                      </div>

                      {/* Voice Speed */}
                      <div className="space-y-1.5">
                        <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <Sliders className="w-3 h-3 text-slate-400" />
                          Voice Speed
                        </label>
                        <select
                          value={settings.voiceSpeed || 1.0}
                          onChange={(e) => onUpdateSettings({ voiceSpeed: parseFloat(e.target.value) })}
                          className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:border-[#C96A3D] outline-none text-[#14213D] dark:text-white transition-colors cursor-pointer font-semibold"
                        >
                          <option value="0.75">0.75x (Slower)</option>
                          <option value="0.9">0.9x (Relaxed)</option>
                          <option value="1.0">1.0x (Normal)</option>
                          <option value="1.15">1.15x (Brisk)</option>
                          <option value="1.3">1.3x (Fast)</option>
                          <option value="1.5">1.5x (Super Fast)</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-2.5 pt-1">
                      {/* Auto Send Toggle */}
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="block text-xs font-bold text-[#14213D] dark:text-slate-200">
                            Auto Send Speech
                          </label>
                          <span className="text-[10px] text-slate-400">
                            Submit chat immediately after silence
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => onUpdateSettings({ voiceAutoSend: settings.voiceAutoSend === false })}
                          className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer focus:outline-none ${
                            settings.voiceAutoSend !== false ? "bg-[#C96A3D]" : "bg-slate-200 dark:bg-slate-700"
                          }`}
                        >
                          <div
                            className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-200 ease-in-out ${
                              settings.voiceAutoSend !== false ? "translate-x-4" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>

                      {/* Auto Play Replies Toggle */}
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="block text-xs font-bold text-[#14213D] dark:text-slate-200">
                            Auto Play Voice Replies
                          </label>
                          <span className="text-[10px] text-slate-400">
                            AI replies will be read aloud automatically
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => onUpdateSettings({ voiceAutoPlay: settings.voiceAutoPlay === false })}
                          className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer focus:outline-none ${
                            settings.voiceAutoPlay !== false ? "bg-[#C96A3D]" : "bg-slate-200 dark:bg-slate-700"
                          }`}
                        >
                          <div
                            className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-200 ease-in-out ${
                              settings.voiceAutoPlay !== false ? "translate-x-4" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Personalization Context Memory */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold text-[#14213D] dark:text-slate-300">
                        Personalization Memory Context
                      </label>
                      <span className="text-[9px] font-black uppercase text-indigo-500 bg-indigo-500/10 px-2 py-0.5 rounded-full select-none">
                        Active
                      </span>
                    </div>
                    <textarea
                      value={personalization}
                      onChange={(e) => setPersonalization(e.target.value)}
                      placeholder="Tell Nexa who you are (e.g. 'I am a 10yo student learning coding.') or specify your preference styles."
                      rows={3}
                      className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:border-[#C96A3D] outline-none text-[#14213D] dark:text-white transition-colors placeholder:text-slate-400 leading-snug"
                    />
                  </div>
                </div>

              </div>

              {/* Right Column: Support & Account Settings */}
              <div className="space-y-6">
                
                {/* Support Section */}
                <div className="space-y-4 p-5 bg-slate-50/50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800 rounded-2xl">
                  <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                    <HelpCircle className="w-4 h-4" />
                    Support
                  </h4>

                  {/* 💬 Send Feedback Action */}
                  {onOpenFeedback && (
                    <div className="space-y-2">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-normal leading-relaxed">
                        Have suggestions or noticed a bug? Submit a report directly to the development team.
                      </p>
                      <button
                        type="button"
                        onClick={onOpenFeedback}
                        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-3xs cursor-pointer transition-all active:scale-98 hover:scale-[1.01]"
                      >
                        <span className="text-sm">💬</span>
                        <span>Send Feedback</span>
                      </button>
                    </div>
                  )}

                  {/* Firebase diagnostics nested inside Support */}
                  <div className="pt-3.5 border-t border-slate-150 dark:border-slate-800/60 space-y-3">
                    <h5 className="text-[11px] font-bold text-slate-550 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Database className="w-3.5 h-3.5 text-indigo-500" />
                      Cloud Connection Diagnostics
                    </h5>
                    <p className="text-[10px] text-slate-400 font-normal leading-snug">
                      Verify Firestore document write/read permissions and cloud reliability live.
                    </p>

                    <button
                      type="button"
                      onClick={runConnectionTest}
                      disabled={testStatus === "loading"}
                      className="w-full flex justify-center items-center gap-2 py-2 text-[11px] font-bold bg-white dark:bg-slate-900 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 hover:text-indigo-600 dark:hover:text-indigo-400 text-slate-600 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-800 transition-all cursor-pointer shadow-3xs"
                    >
                      {testStatus === "loading" ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                          Testing Connection...
                        </>
                      ) : (
                        <>
                          <Wifi className="w-3.5 h-3.5" />
                          Test Cloud Connection
                        </>
                      )}
                    </button>

                    {testStatus === "success" && (
                      <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-900/40 rounded-xl space-y-1 animate-fade-in">
                        <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                          Connected Successfully
                        </div>
                        {testDetails && (
                          <pre className="text-[8.5px] font-mono text-slate-500 dark:text-slate-400 bg-white/40 dark:bg-slate-900/40 p-2 rounded-lg overflow-x-auto border border-slate-100/50 dark:border-slate-850">
                            {testDetails}
                          </pre>
                        )}
                      </div>
                    )}

                    {testStatus === "error" && (
                      <div className="p-2.5 bg-rose-50 dark:bg-rose-950/20 border border-rose-200/50 dark:border-rose-900/40 rounded-xl space-y-1 animate-fade-in">
                        <div className="flex items-center gap-1 text-[10px] font-bold text-rose-600 dark:text-rose-400">
                          <X className="w-3.5 h-3.5 shrink-0" />
                          Connection Failed
                        </div>
                        {testError && (
                          <div className="text-[8.5px] font-mono text-rose-600 dark:text-rose-400 bg-white/40 dark:bg-slate-900/40 p-2 rounded-lg max-h-24 overflow-y-auto border border-rose-100/40">
                            {testError}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Account Section */}
                <div className="space-y-4 p-5 bg-slate-50/50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800 rounded-2xl">
                  <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
                    <User className="w-4 h-4" />
                    Account
                  </h4>

                  {/* Profile Avatar Selection Row */}
                  <div className="flex items-center gap-4 py-1" id="avatar-selector-section">
                    {avatarUrlState ? (
                      <img
                        src={avatarUrlState}
                        alt={profileName}
                        className="w-12 h-12 rounded-xl object-cover border border-slate-200 dark:border-slate-800 shadow-3xs"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-base shadow-sm">
                        {profileName ? profileName[0].toUpperCase() : "U"}
                      </div>
                    )}
                    
                    <div className="space-y-1 flex-1">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Profile Image</span>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="text-[9.5px] bg-white dark:bg-slate-800 hover:bg-[#C96A3D] dark:hover:bg-[#C96A3D] hover:text-white text-slate-700 dark:text-slate-300 font-bold py-1 px-2.5 rounded-lg border border-slate-200/60 dark:border-slate-800 transition-colors cursor-pointer"
                        >
                          Upload File
                        </button>
                        {avatarUrlState && (
                          <button
                            type="button"
                            onClick={() => setAvatarUrlState(undefined)}
                            className="text-[9.5px] bg-rose-50 dark:bg-rose-950/20 text-rose-500 hover:bg-rose-550 hover:text-white font-bold py-1 px-2.5 rounded-lg border border-rose-100 dark:border-rose-900/20 transition-all cursor-pointer"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </div>
                  </div>

                  {/* Name Input */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-[#14213D] dark:text-slate-300">Display Name</label>
                    <input
                      type="text"
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:border-[#C96A3D] outline-none text-[#14213D] dark:text-white transition-all font-semibold"
                    />
                  </div>

                  {/* Email details */}
                  <div className="p-2.5 bg-white/50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-850 rounded-xl flex flex-col gap-0.5 leading-snug">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Email Address</span>
                    <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 truncate">{user.email || "Active User"}</span>
                    {user.isGuest && (
                      <span className="text-[9px] text-amber-500 font-extrabold uppercase mt-1">Guest Mode Session</span>
                    )}
                  </div>

                  {/* 🚪 Logout Button */}
                  {onLogout && !user.isGuest && (
                    <button
                      type="button"
                      onClick={() => {
                        onLogout();
                        onClose();
                      }}
                      className="w-full flex items-center justify-center gap-1.5 py-2 px-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 hover:bg-rose-500 hover:text-white font-bold text-xs rounded-xl shadow-3xs cursor-pointer transition-all active:scale-98 hover:scale-[1.01]"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Logout Account</span>
                    </button>
                  )}

                  {/* Danger Zone Purge Action */}
                  <div className="pt-3.5 border-t border-slate-150 dark:border-slate-800/60 space-y-1.5">
                    <h5 className="text-[10px] font-bold text-rose-500 uppercase tracking-widest flex items-center gap-1">
                      Danger Zone
                    </h5>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm("Are you sure you want to delete all conversations permanently? This cannot be undone.")) {
                          onClearChats();
                        }
                      }}
                      className="w-full flex justify-center items-center gap-1.5 py-2 text-[10px] font-semibold text-rose-500 hover:text-white border border-rose-100 dark:border-rose-900/20 bg-rose-500/5 hover:bg-rose-500 dark:hover:bg-rose-600 rounded-lg transition-all cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Purge Local History
                    </button>
                  </div>

                </div>

              </div>

            </div>

            {/* Footer/Save Action */}
            <div className="flex justify-between items-center border-t border-slate-100 dark:border-slate-800 mt-8 pt-4">
              <div className="text-xs text-slate-400 flex items-center gap-1">
                <Key className="w-4 h-4" />
                Key: Standard Client-Side Storage
              </div>
              <div className="flex items-center gap-3">
                {saveSuccess && (
                  <span className="text-xs font-semibold text-emerald-500 animation-pulse">
                    Configuration Stored!
                  </span>
                )}
                <button
                  onClick={handleSave}
                  className="flex items-center gap-1.5 bg-[#14213D] hover:bg-[#C96A3D] dark:bg-slate-100 dark:text-[#14213D] dark:hover:bg-[#C96A3D] dark:hover:text-white text-white font-semibold py-2 px-5 text-sm rounded-xl transition-all hover:shadow-xs"
                >
                  <Save className="w-4 h-4" />
                  Save Settings
                </button>
              </div>
            </div>
          </>
        ) : (
          <AchievementsProfile user={user} />
        )}

      </div>
    </div>
  );
}
