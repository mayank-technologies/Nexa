/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  ShieldCheck, 
  Camera, 
  Image, 
  FileText, 
  Mic, 
  X, 
  HelpCircle, 
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  Sparkles
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface PermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGrantComplete: (grantedStates: {
    camera: boolean;
    photos: boolean;
    document: boolean;
    microphone: boolean;
  }) => void;
  initialStates?: {
    camera: boolean;
    photos: boolean;
    document: boolean;
    microphone: boolean;
  };
}

export function PermissionsModal({ 
  isOpen, 
  onClose, 
  onGrantComplete,
  initialStates = { camera: false, photos: false, document: false, microphone: false }
}: PermissionsModalProps) {
  const [states, setStates] = useState(initialStates);

  // Sync initial states when modal opens
  useEffect(() => {
    if (isOpen) {
      setStates(initialStates);
    }
  }, [isOpen, initialStates]);

  if (!isOpen) return null;

  const togglePermission = (key: keyof typeof states) => {
    setStates((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleAllowSelected = () => {
    onGrantComplete(states);
  };

  const handleAllowAll = () => {
    const allTrue = { camera: true, photos: true, document: true, microphone: true };
    setStates(allTrue);
    onGrantComplete(allTrue);
  };

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/85 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ type: "spring", duration: 0.4 }}
        className="relative w-full max-w-md p-6 bg-white dark:bg-[#11192e] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl space-y-5"
        id="nexa-permissions-popup"
      >
        {/* Close Button Pin */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-50 dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header Visual with Shield & Sparkle Badge */}
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 bg-[#C96A3D]/10 rounded-2xl shrink-0">
            <ShieldCheck className="w-6 h-6 text-[#C96A3D]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-50">
                Security Permissions Checklist
              </h3>
              <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-400/10 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                <Sparkles className="w-2.5 h-2.5" /> Required
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              Nexa platform requires simulated container hardware routing access to parse your attached documents, process photos, and transcribing voice streams.
            </p>
          </div>
        </div>

        {/* Permissions Switches Stack */}
        <div className="space-y-2.5" id="nexa-perm-list">
          {/* CAMERA */}
          <div 
            onClick={() => togglePermission("camera")}
            className={`flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer select-none ${
              states.camera 
                ? "border-[#C96A3D]/45 bg-[#C96A3D]/5 dark:bg-[#C96A3D]/3" 
                : "border-slate-100 dark:border-slate-800/40 bg-slate-50/50 dark:bg-slate-900/10 hover:border-slate-200"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl shrink-0 transition-colors ${
                states.camera ? "bg-emerald-500/10 text-emerald-500" : "bg-slate-100 dark:bg-slate-800 text-slate-400"
              }`}>
                <Camera className="w-4 h-4" />
              </div>
              <div>
                <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  Camera Access Mode
                </span>
                <span className="block text-[10px] text-slate-400 dark:text-slate-550 leading-tight">
                  For capture photo snapshots directly in thread.
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[8.5px] font-black uppercase px-1.5 py-0.5 rounded ${
                states.camera ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-slate-100 dark:bg-slate-800 text-slate-400"
              }`}>
                {states.camera ? "Allowed" : "Blocked"}
              </span>
              <div>
                {states.camera ? (
                  <ToggleRight className="w-5 h-5 text-emerald-500 shrink-0" />
                ) : (
                  <ToggleLeft className="w-5 h-5 text-slate-400 shrink-0" />
                )}
              </div>
            </div>
          </div>

          {/* PHOTOS */}
          <div 
            onClick={() => togglePermission("photos")}
            className={`flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer select-none ${
              states.photos 
                ? "border-[#C96A3D]/45 bg-[#C96A3D]/5 dark:bg-[#C96A3D]/3" 
                : "border-slate-100 dark:border-slate-800/40 bg-slate-50/50 dark:bg-slate-900/10 hover:border-slate-200"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl shrink-0 transition-colors ${
                states.photos ? "bg-sky-500/10 text-sky-500" : "bg-slate-100 dark:bg-slate-800 text-slate-400"
              }`}>
                <Image className="w-4 h-4" />
              </div>
              <div>
                <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  Photos & Gallery Uploads
                </span>
                <span className="block text-[10px] text-slate-400 dark:text-slate-550 leading-tight">
                  Grants permission for local picture select (PNG, JPG, WEBP).
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[8.5px] font-black uppercase px-1.5 py-0.5 rounded ${
                states.photos ? "bg-sky-500/15 text-sky-600 dark:text-sky-400" : "bg-slate-100 dark:bg-slate-800 text-slate-400"
              }`}>
                {states.photos ? "Allowed" : "Blocked"}
              </span>
              <div>
                {states.photos ? (
                  <ToggleRight className="w-5 h-5 text-emerald-500 shrink-0" />
                ) : (
                  <ToggleLeft className="w-5 h-5 text-slate-400 shrink-0" />
                )}
              </div>
            </div>
          </div>

          {/* DOCUMENT */}
          <div 
            onClick={() => togglePermission("document")}
            className={`flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer select-none ${
              states.document 
                ? "border-[#C96A3D]/45 bg-[#C96A3D]/5 dark:bg-[#C96A3D]/3" 
                : "border-slate-100 dark:border-slate-800/40 bg-slate-50/50 dark:bg-slate-900/10 hover:border-slate-200"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl shrink-0 transition-colors ${
                states.document ? "bg-amber-500/10 text-amber-500" : "bg-slate-100 dark:bg-slate-800 text-slate-400"
              }`}>
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  Document Read Privileges
                </span>
                <span className="block text-[10px] text-slate-400 dark:text-slate-550 leading-tight">
                  To analyze, read & parse PDF/DOCX/TXT file spreadsheets.
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[8.5px] font-black uppercase px-1.5 py-0.5 rounded ${
                states.document ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" : "bg-slate-100 dark:bg-slate-800 text-slate-400"
              }`}>
                {states.document ? "Allowed" : "Blocked"}
              </span>
              <div>
                {states.document ? (
                  <ToggleRight className="w-5 h-5 text-emerald-500 shrink-0" />
                ) : (
                  <ToggleLeft className="w-5 h-5 text-slate-400 shrink-0" />
                )}
              </div>
            </div>
          </div>

          {/* MICROPHONE */}
          <div 
            onClick={() => togglePermission("microphone")}
            className={`flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer select-none ${
              states.microphone 
                ? "border-[#C96A3D]/45 bg-[#C96A3D]/5 dark:bg-[#C96A3D]/3" 
                : "border-slate-100 dark:border-slate-800/40 bg-slate-50/50 dark:bg-slate-900/10 hover:border-slate-200"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl shrink-0 transition-colors ${
                states.microphone ? "bg-rose-500/10 text-rose-500" : "bg-slate-100 dark:bg-slate-800 text-slate-400"
              }`}>
                <Mic className="w-4 h-4" />
              </div>
              <div>
                <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  Microphone Stream Recording
                </span>
                <span className="block text-[10px] text-slate-400 dark:text-slate-550 leading-tight">
                  Enables voice querying and automated transcription metrics.
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[8.5px] font-black uppercase px-1.5 py-0.5 rounded ${
                states.microphone ? "bg-rose-500/15 text-rose-600 dark:text-rose-400" : "bg-slate-100 dark:bg-slate-800 text-slate-400"
              }`}>
                {states.microphone ? "Allowed" : "Blocked"}
              </span>
              <div>
                {states.microphone ? (
                  <ToggleRight className="w-5 h-5 text-emerald-500 shrink-0" />
                ) : (
                  <ToggleLeft className="w-5 h-5 text-slate-400 shrink-0" />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Informative Warning Note */}
        <div className="flex gap-2 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 border border-amber-200/25">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <p className="text-[10px] leading-relaxed">
            Please make sure relevant permissions are allowed so Nexa can process file streams. Submissions remain entirely inside your sandboxed web browser window (fully off-grid).
          </p>
        </div>

        {/* Control Actions Panel */}
        <div className="flex items-center justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
          >
            Cancel Access
          </button>
          
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAllowSelected}
              className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 font-extrabold text-xs px-3 py-2.5 rounded-xl transition-all active:scale-95 cursor-pointer"
            >
              Allow Selected
            </button>
            <button
              type="button"
              onClick={handleAllowAll}
              className="bg-[#C96A3D] hover:bg-[#b0582f] text-white font-black text-xs px-4 py-2.5 rounded-xl transition-all active:scale-95 shadow-md shadow-[#C96A3D]/10 cursor-pointer"
            >
              Allow All Access
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
