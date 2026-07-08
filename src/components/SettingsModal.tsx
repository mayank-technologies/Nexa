/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from "react";
import { X, Moon, Sun, Globe, EyeOff, Key, Trash2, Save, Sparkles, User, CheckCircle, Camera, Image, FileText, Mic, Shield, Trophy, Volume2, Database, Loader2, Wifi, WifiOff } from "lucide-react";
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Left panel: Profile & Theme */}
          <div className="space-y-6">
            
            {/* Theme Toggle Section */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[#14213D] dark:text-slate-300 uppercase tracking-widest">
                Appearance System
              </label>
              <div className="flex bg-slate-50 dark:bg-slate-850 p-1.5 rounded-2xl border border-slate-100 dark:border-slate-800 gap-1 select-none">
                <button
                  onClick={() => onUpdateSettings({ theme: "light" })}
                  className={`flex-1 flex justify-center items-center gap-2 py-2 text-sm font-semibold rounded-xl transition-all ${
                    settings.theme === "light"
                      ? "bg-white text-[#14213D] shadow-xs"
                      : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  }`}
                >
                  <Sun className="w-4 h-4" />
                  Light Mode
                </button>
                <button
                  onClick={() => onUpdateSettings({ theme: "dark" })}
                  className={`flex-1 flex justify-center items-center gap-2 py-2 text-sm font-semibold rounded-xl transition-all ${
                    settings.theme === "dark"
                      ? "bg-slate-800 text-white shadow-xs"
                      : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  }`}
                >
                  <Moon className="w-4 h-4" />
                  Dark Mode
                </button>
              </div>
            </div>

            {/* Language Selection */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[#14213D] dark:text-slate-300 uppercase tracking-widest flex items-center gap-1">
                <Globe className="w-4 h-4 text-slate-400" />
                Default Chat Language
              </label>
              <select
                value={settings.language}
                onChange={(e) => onUpdateSettings({ language: e.target.value })}
                className="w-full text-sm py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:border-[#C96A3D] outline-none text-[#14213D] dark:text-white transition-colors"
              >
                {languagesList.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang}
                  </option>
                ))}
              </select>
            </div>

            {/* Profile Settings */}
            <div className="space-y-4 p-5 bg-slate-50/50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800/85 rounded-2xl">
              <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
                <User className="w-4 h-4" />
                User Profile Information
              </h4>

              {/* Profile Avatar Selection Row */}
              <div className="flex items-center gap-4 py-1" id="avatar-selector-section">
                {avatarUrlState ? (
                  <img
                    src={avatarUrlState}
                    alt={profileName}
                    className="w-14 h-14 rounded-2xl object-cover border border-slate-250 dark:border-slate-800 shadow-sm"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                    {profileName ? profileName[0].toUpperCase() : "U"}
                  </div>
                )}
                
                <div className="space-y-1.5 flex-1">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">Profile Image</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-[10px] bg-slate-100 dark:bg-slate-800 hover:bg-[#C96A3D] dark:hover:bg-[#C96A3D] hover:text-white text-slate-700 dark:text-slate-300 font-bold py-1.5 px-3 rounded-lg transition-colors cursor-pointer"
                    >
                      Upload Picture
                    </button>
                    {avatarUrlState && (
                      <button
                        type="button"
                        onClick={() => {
                          setAvatarUrlState(undefined);
                        }}
                        className="text-[10px] bg-rose-50 dark:bg-rose-950/20 text-rose-500 hover:bg-rose-550 hover:text-white font-bold py-1.5 px-2.5 rounded-lg transition-all cursor-pointer"
                      >
                        Reset Picture
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

              <div className="space-y-2">
                <label className="block text-xs text-slate-500 font-medium">Display Name</label>
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="w-full text-sm py-2 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:border-[#C96A3D] outline-none text-[#14213D] dark:text-white"
                />
              </div>
              <div className="text-xs text-slate-400">
                Email: <span className="font-mono text-slate-500 dark:text-slate-300">{user.email}</span>
                {user.isGuest && <span className="ml-2 text-amber-500 font-bold">(Guest Mode)</span>}
              </div>
            </div>

            {/* Firebase Connection Test Block */}
            <div className="space-y-4 p-5 bg-indigo-50/20 dark:bg-slate-900/40 border border-indigo-100 dark:border-slate-800 rounded-2xl">
              <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#14213D] dark:text-slate-300">
                <Database className="w-4 h-4 text-indigo-500" />
                Firebase Connection Diagnostics
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-normal">
                Verify Firestore document writes, reads, and connection reliability through live operations.
              </p>

              <button
                type="button"
                onClick={runConnectionTest}
                disabled={testStatus === "loading"}
                className="w-full flex justify-center items-center gap-2 py-2.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl transition-all cursor-pointer shadow-3xs"
              >
                {testStatus === "loading" ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Testing Connection...
                  </>
                ) : (
                  <>
                    <Wifi className="w-3.5 h-3.5" />
                    Run Firebase Connection Test
                  </>
                )}
              </button>

              {testStatus === "success" && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 rounded-xl space-y-1.5 animate-fade-in">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle className="w-4 h-4 shrink-0" />
                    ✅ Firebase Connected Successfully
                  </div>
                  {testDetails && (
                    <pre className="text-[10px] font-mono text-slate-600 dark:text-slate-400 bg-white/50 dark:bg-slate-900/50 p-2 rounded-lg overflow-x-auto border border-slate-100 dark:border-slate-800 leading-normal">
                      {testDetails}
                    </pre>
                  )}
                </div>
              )}

              {testStatus === "error" && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 rounded-xl space-y-1.5 animate-fade-in">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-rose-600 dark:text-rose-400">
                    <X className="w-4 h-4 shrink-0" />
                    ❌ Firebase Connection Failed
                  </div>
                  {testError && (
                    <div className="text-[10px] font-mono text-rose-700 dark:text-rose-400 bg-white/50 dark:bg-slate-900/50 p-2 rounded-lg overflow-x-auto border border-rose-100 dark:border-rose-950/40 leading-relaxed max-h-32">
                      {testError}
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>

          {/* Right panel: Personalization Context & Privacy */}
          <div className="space-y-6">
            
            {/* Personalization Memory Context */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[#14213D] dark:text-slate-300 uppercase tracking-widest flex items-center justify-between">
                <span>Personalization Context</span>
                <span className="text-[10px] text-indigo-500 font-bold bg-indigo-500/10 px-2 py-0.5 rounded-full">
                  Memory Active
                </span>
              </label>
              <textarea
                value={personalization}
                onChange={(e) => setPersonalization(e.target.value)}
                placeholder="Teach Nexa who you are! e.g., 'I am a 10-year old student learning geometry.' or 'Explain coding using advanced type systems.'"
                rows={4}
                className="w-full text-sm py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:border-[#C96A3D] outline-none text-[#14213D] dark:text-white transition-colors placeholder:text-slate-400 text-left font-normal"
              />
              <p className="text-[10px] text-slate-400 leading-relaxed font-normal">
                This context is transparently combined with our Smart routing prompts as proprietary metadata memory, establishing a tailored response engine.
              </p>
            </div>

            {/* Privacy Save History */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-[#14213D] dark:text-slate-300 uppercase tracking-widest">
                Privacy Controls
              </label>
              <div className="flex items-center justify-between p-3 bg-slate-50/50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800 rounded-xl">
                <div className="flex items-center gap-2.5">
                  <EyeOff className="w-4 h-4 text-slate-400 shrink-0" />
                  <div>
                    <h5 className="text-xs font-semibold text-[#14213D] dark:text-slate-200">
                      Record Thread History
                    </h5>
                    <p className="text-[10px] text-slate-400 font-normal">
                      Store local logs to cache recent chat context.
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.privacySaveHistory}
                  onChange={(e) => onUpdateSettings({ privacySaveHistory: e.target.checked })}
                  className="w-4 h-4 accent-[#C96A3D] cursor-pointer"
                />
              </div>

              {/* Nexa Turbo Mode */}
              <div className="flex items-center justify-between p-3 bg-slate-50/50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800 rounded-xl">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-4 h-4 text-[#C96A3D] shrink-0 animate-pulse" />
                  <div>
                    <h5 className="text-xs font-semibold text-[#14213D] dark:text-slate-200">
                      Nexa Turbo Mode
                    </h5>
                    <p className="text-[10px] text-slate-400 font-normal">
                      Enable ultra-low latency & 10x faster replies.
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.turboMode !== false}
                  onChange={(e) => onUpdateSettings({ turboMode: e.target.checked })}
                  className="w-4 h-4 accent-[#C96A3D] cursor-pointer"
                />
              </div>

              {/* Sound Effects Active toggle */}
              <div className="flex items-center justify-between p-3 bg-slate-50/50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800 rounded-xl">
                <div className="flex items-center gap-2.5">
                  <Volume2 className="w-4 h-4 text-[#C96A3D] shrink-0" />
                  <div>
                    <h5 className="text-xs font-semibold text-[#14213D] dark:text-slate-200">
                      🔊 Sound Effects
                    </h5>
                    <p className="text-[10px] text-slate-400 font-normal">
                      Subtle audio responses for modern, premium feedback.
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.soundEffectsActive !== false}
                  onChange={(e) => onUpdateSettings({ soundEffectsActive: e.target.checked })}
                  className="w-4 h-4 accent-[#C96A3D] cursor-pointer"
                />
              </div>
            </div>

            {/* Device & Storage Privileges */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-[#14213D] dark:text-slate-300 uppercase tracking-widest flex items-center gap-1">
                <Shield className="w-4 h-4 text-[#C96A3D]" />
                Device & File Privileges
              </label>
              
              <div className="grid grid-cols-2 gap-2 text-left">
                {/* Camera Toggle */}
                <button
                  type="button"
                  onClick={() => onUpdatePermissions({ ...permissions, camera: !permissions.camera })}
                  className={`p-2.5 px-3 border rounded-xl flex items-center justify-between gap-1.5 transition-all select-none cursor-pointer text-left ${
                    permissions.camera 
                      ? "border-emerald-250 bg-emerald-500/5 dark:bg-emerald-500/5 text-slate-800 dark:text-slate-200" 
                      : "border-slate-100 dark:border-slate-800/60 bg-slate-50/40 dark:bg-slate-900/10 text-slate-500 hover:border-slate-250"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Camera className={`w-3.5 h-3.5 shrink-0 ${permissions.camera ? "text-emerald-500" : "text-slate-400"}`} />
                    <span className="text-[10.5px] font-bold">Camera</span>
                  </div>
                  <span className={`text-[8px] font-bold uppercase shrink-0 px-1 rounded ${
                    permissions.camera ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                  }`}>
                    {permissions.camera ? "Allowed" : "Blocked"}
                  </span>
                </button>

                {/* Photos Toggle */}
                <button
                  type="button"
                  onClick={() => onUpdatePermissions({ ...permissions, photos: !permissions.photos })}
                  className={`p-2.5 px-3 border rounded-xl flex items-center justify-between gap-1.5 transition-all select-none cursor-pointer text-left ${
                    permissions.photos 
                      ? "border-sky-250 bg-sky-500/5 dark:bg-sky-500/5 text-slate-800 dark:text-slate-200" 
                      : "border-slate-100 dark:border-slate-800/60 bg-slate-50/40 dark:bg-slate-900/10 text-slate-500 hover:border-slate-250"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Image className={`w-3.5 h-3.5 shrink-0 ${permissions.photos ? "text-sky-500" : "text-slate-400"}`} />
                    <span className="text-[10.5px] font-bold">Photos</span>
                  </div>
                  <span className={`text-[8px] font-bold uppercase shrink-0 px-1 rounded ${
                    permissions.photos ? "bg-sky-500/15 text-sky-600 dark:text-sky-400" : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                  }`}>
                    {permissions.photos ? "Allowed" : "Blocked"}
                  </span>
                </button>

                {/* Document Toggle */}
                <button
                  type="button"
                  onClick={() => onUpdatePermissions({ ...permissions, document: !permissions.document })}
                  className={`p-2.5 px-3 border rounded-xl flex items-center justify-between gap-1.5 transition-all select-none cursor-pointer text-left ${
                    permissions.document 
                      ? "border-amber-250 bg-amber-500/5 dark:bg-amber-500/5 text-slate-800 dark:text-slate-200" 
                      : "border-slate-100 dark:border-slate-800/60 bg-slate-50/40 dark:bg-slate-900/10 text-slate-500 hover:border-slate-250"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <FileText className={`w-3.5 h-3.5 shrink-0 ${permissions.document ? "text-amber-500" : "text-slate-400"}`} />
                    <span className="text-[10.5px] font-bold">Documents</span>
                  </div>
                  <span className={`text-[8px] font-bold uppercase shrink-0 px-1 rounded ${
                    permissions.document ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                  }`}>
                    {permissions.document ? "Allowed" : "Blocked"}
                  </span>
                </button>

                {/* Microphone Toggle */}
                <button
                  type="button"
                  onClick={() => onUpdatePermissions({ ...permissions, microphone: !permissions.microphone })}
                  className={`p-2.5 px-3 border rounded-xl flex items-center justify-between gap-1.5 transition-all select-none cursor-pointer text-left ${
                    permissions.microphone 
                      ? "border-[#C96A3D]/45 bg-[#C96A3D]/5 dark:bg-[#C96A3D]/5 text-slate-800 dark:text-slate-200" 
                      : "border-slate-100 dark:border-slate-800/60 bg-slate-50/40 dark:bg-slate-900/10 text-slate-500 hover:border-slate-250"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Mic className={`w-3.5 h-3.5 shrink-0 ${permissions.microphone ? "text-[#C96A3D]" : "text-slate-400"}`} />
                    <span className="text-[10.5px] font-bold">Microphone</span>
                  </div>
                  <span className={`text-[8px] font-bold uppercase shrink-0 px-1 rounded ${
                    permissions.microphone ? "bg-[#C96A3D]/15 text-[#C96A3D]" : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                  }`}>
                    {permissions.microphone ? "Allowed" : "Blocked"}
                  </span>
                </button>
              </div>
            </div>


            {/* Data Purge action */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-rose-500 uppercase tracking-widest">
                Danger Zone
              </label>
              <button
                onClick={() => {
                  if (confirm("Are you sure you want to delete all conversations permanently? This cannot be undone.")) {
                    onClearChats();
                  }
                }}
                className="w-full flex justify-center items-center gap-2 py-2.5 text-xs font-semibold text-rose-500 hover:text-white border border-rose-200 dark:border-rose-900/50 hover:bg-rose-500 hover:border-rose-500 dark:hover:bg-rose-600 rounded-xl transition-all"
              >
                <Trash2 className="w-4 h-4" />
                Purge All Local Conversations
              </button>
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
