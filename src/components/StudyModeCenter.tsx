/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BookOpen, HelpCircle, GraduationCap, ToggleLeft, ToggleRight, FileSpreadsheet, Layers, Sparkles } from "lucide-react";

interface StudyModeCenterProps {
  explainLikeIm10: boolean;
  onToggleELI10: (active: boolean) => void;
  onQuickAction: (actionText: string) => void;
}

export function StudyModeCenter({
  explainLikeIm10,
  onToggleELI10,
  onQuickAction,
}: StudyModeCenterProps) {
  const quickActionsStudy = [
    {
      title: "Synthesize Lecture Notes",
      desc: "Distill disorganized lecture copy into structural study notes.",
      text: "Synthesize detailed study notes from the following text, highlighting main theorems, keywords, and practical applications.",
    },
    {
      title: "Explain Complex Theorem",
      desc: "Outline formulas, derivations, and use-cases behind theorems.",
      text: "Deconstruct Euler's Identity (e^iπ + 1 = 0). Explain what each letter represents and where it's used.",
    },
    {
      title: "Develop Exam study plan",
      desc: "Creates a timeline, topics sequence, and revision flashcards strategy.",
      text: "Draft a comprehensive 2-week revision plan for a College chemistry student studying atomic stoichiometry structures.",
    },
  ];

  return (
    <div
      className="border border-[#14213D]/10 dark:border-slate-800 rounded-3xl bg-slate-50/20 dark:bg-[#12192c]/35 p-6 space-y-6 text-left my-4 relative"
      id="nexa-study-mode-center"
    >
      {/* 1. Header with ELI10 Toggle */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#C96A3D]/10 text-[#C96A3D] rounded-2xl shrink-0">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-base font-extrabold text-[#14213D] dark:text-white leading-tight font-sans">
              Nexa Academic Hub
            </h4>
            <span className="text-[10px] text-slate-450 font-normal leading-none block mt-0.5">
              Assisting homework solving, note generation, and exam prep.
            </span>
          </div>
        </div>

        {/* ELI10 Toggle Button */}
        <button
          onClick={() => onToggleELI10(!explainLikeIm10)}
          className={`flex items-center gap-2.5 px-4 py-2 rounded-2xl border transition-all duration-300 ${
            explainLikeIm10
              ? "bg-[#C96A3D]/10 border-[#C96A3D]/30 text-[#C96A3D] shadow-xs"
              : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500"
          }`}
          id="nexa-eli10-toggle-button"
        >
          <div className="flex items-center gap-1.5 text-xs font-bold font-sans">
            <Sparkles className="w-4 h-4 shrink-0 animate-pulse" />
            <span>Explain Like I'm 10</span>
          </div>
          {explainLikeIm10 ? (
            <ToggleRight className="w-6 h-6 text-[#C96A3D]" />
          ) : (
            <ToggleLeft className="w-6 h-6 text-slate-400" />
          )}
        </button>
      </div>

      {ELI10ExplainerText(explainLikeIm10)}

      {/* 2. Structured Quick Actions */}
      <div className="space-y-3">
        <h5 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
          <BookOpen className="w-4 h-4 text-slate-400" />
          Curated Academic Accelerators
        </h5>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {quickActionsStudy.map((action, idx) => (
            <button
              key={idx}
              onClick={() => onQuickAction(action.text)}
              className="flex flex-col items-start p-5 bg-white dark:bg-[#151f38] hover:bg-slate-50 dark:hover:bg-[#1b2a4e] border border-slate-100 dark:border-slate-800/60 rounded-2xl text-left shadow-2xs group transition-all"
            >
              <div className="p-2 ml bg-slate-50 dark:bg-slate-900 rounded-lg text-slate-400 mb-3 group-hover:text-[#C96A3D]">
                <Layers className="w-4 h-4" />
              </div>
              <h6 className="font-bold text-xs text-[#14213D] dark:text-slate-100 mb-1 group-hover:text-[#C96A3D] transition-colors leading-snug">
                {action.title}
              </h6>
              <p className="text-[10px] text-slate-400 font-normal leading-relaxed">
                {action.desc}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ELI10ExplainerText(explainLikeIm10: boolean) {
  if (explainLikeIm10) {
    return (
      <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-xs text-amber-705 dark:text-amber-400 flex items-start gap-3">
        <HelpCircle className="w-4 h-4 shrink-0 mt-0.5" />
        <p className="leading-relaxed font-normal">
          <strong>ELI10 Active:</strong> Nexa will now transform all complex terms, math limits, and academic algorithms into highly simplified playground references, everyday food metaphors, and fun stories matching a 10 year old kid's intuition.
        </p>
      </div>
    );
  }
  return null;
}
