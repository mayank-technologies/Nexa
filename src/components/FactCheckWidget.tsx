/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CheckCircle2, AlertTriangle, HelpCircle, XOctagon, Link2, TrendingUp, Sparkles, AlertCircle } from "lucide-react";
import { FactCheckDetails } from "../types";

interface FactCheckWidgetProps {
  details: FactCheckDetails;
}

export function FactCheckWidget({ details }: FactCheckWidgetProps) {
  const verdicts = {
    verified: {
      label: "CLAIM VERIFIED",
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
      borderColor: "border-emerald-500/20",
      icon: <CheckCircle2 className="w-8 h-8 text-emerald-500" />,
      desc: "Information is fully substantiated by authoritative records and news streams.",
    },
    misleading: {
      label: "MISLEADING INFO",
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
      borderColor: "border-amber-500/20",
      icon: <AlertTriangle className="w-8 h-8 text-amber-500" />,
      desc: "Contains factual fragments but presented out of context, leading to inaccurate assumptions.",
    },
    unverified: {
      label: "UNVERIFIED CLAIM",
      color: "text-slate-500",
      bgColor: "bg-slate-500/10",
      borderColor: "border-slate-500/20",
      icon: <HelpCircle className="w-8 h-8 text-slate-500" />,
      desc: "Sufficient primary records do not exist to prove or disprove this claims validity in 2026.",
    },
    debunked: {
      label: "DEBUNKED FALSEHOOD",
      color: "text-rose-500",
      bgColor: "bg-rose-500/10",
      borderColor: "border-rose-500/20",
      icon: <XOctagon className="w-8 h-8 text-rose-500" />,
      desc: "Direct fabrication contradicted by reliable science, official releases, or investigative audits.",
    },
  };

  const currentVerdict = verdicts[details.verdict] || verdicts.unverified;

  // Gauge dimensions
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  
  const confidenceOffset = circumference - (details.confidenceScore / 100) * circumference;
  const reliabilityOffset = circumference - (details.reliabilityScore / 100) * circumference;

  return (
    <div
      className="border border-[#14213D]/10 dark:border-slate-800 rounded-3xl bg-slate-50/30 dark:bg-[#12192c]/40 p-6 md:p-8 space-y-6 text-left my-4 relative overflow-hidden"
      id="nexa-fact-check-widget"
    >
      {/* Visual Accent Banner */}
      <div className={`absolute top-0 inset-x-0 h-1 ${currentVerdict.bgColor}`} />

      {/* Primary Row: Verdict */}
      <div className={`p-5 rounded-2xl border ${currentVerdict.bgColor} ${currentVerdict.borderColor} flex flex-col sm:flex-row items-start sm:items-center gap-4 transition-all hover:scale-[1.005]`}>
        <div className="shrink-0">{currentVerdict.icon}</div>
        <div className="space-y-0.5">
          <span className={`text-xs font-bold tracking-widest uppercase ${currentVerdict.color}`}>
            {currentVerdict.label}
          </span>
          <h4 className="text-base font-extrabold text-[#14213D] dark:text-white leading-tight">
            Nexa Core Verdict: <span className="capitalize">{details.verdict}</span>
          </h4>
          <p className="text-xs text-slate-550 dark:text-slate-400 font-normal leading-relaxed">
            {currentVerdict.desc}
          </p>
        </div>
      </div>

      {/* Confidence & Source Score Rings */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pb-2">
        
        {/* Ring A: Confidence */}
        <div className="flex items-center gap-4 bg-white dark:bg-[#151f38] p-5 rounded-2xl border border-slate-100 dark:border-slate-800/60 shadow-2xs">
          <div className="relative w-16 h-16 shrink-0">
            <svg className="w-full h-full -rotate-90">
              <circle cx="32" cy="32" r={radius} className="stroke-slate-100 dark:stroke-slate-800 fill-none" strokeWidth="6" />
              <circle
                cx="32"
                cy="32"
                r={radius}
                className="stroke-[#C96A3D] fill-none transition-all duration-1000 ease-out"
                strokeWidth="6"
                strokeDasharray={circumference}
                strokeDashoffset={confidenceOffset}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-extrabold text-[#14213D] dark:text-white font-mono">
                {details.confidenceScore}%
              </span>
            </div>
          </div>
          <div>
            <h5 className="text-sm font-bold text-[#14213D] dark:text-slate-200">Confidence Index</h5>
            <p className="text-[10px] text-slate-450 mt-0.5 leading-relaxed font-normal">
              Reflects mathematical semantic certainty based on evidence overlap.
            </p>
          </div>
        </div>

        {/* Ring B: Reliability */}
        <div className="flex items-center gap-4 bg-white dark:bg-[#151f38] p-5 rounded-2xl border border-slate-100 dark:border-slate-800/60 shadow-2xs">
          <div className="relative w-16 h-16 shrink-0">
            <svg className="w-full h-full -rotate-90">
              <circle cx="32" cy="32" r={radius} className="stroke-slate-100 dark:stroke-slate-800 fill-none" strokeWidth="6" />
              <circle
                cx="32"
                cy="32"
                r={radius}
                className="stroke-indigo-500 fill-none transition-all duration-1000 ease-out"
                strokeWidth="6"
                strokeDasharray={circumference}
                strokeDashoffset={reliabilityOffset}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-extrabold text-[#14213D] dark:text-white font-mono">
                {details.reliabilityScore}%
              </span>
            </div>
          </div>
          <div>
            <h5 className="text-sm font-bold text-[#14213D] dark:text-slate-200">Source Reliability</h5>
            <p className="text-[10px] text-slate-450 mt-0.5 leading-relaxed font-normal">
              Standard cross-reference score matching index of cited global bibliographies.
            </p>
          </div>
        </div>

      </div>

      {/* Context Check Explanation */}
      <div className="space-y-2 p-5 bg-slate-50/50 dark:bg-slate-900/10 border border-slate-100 dark:border-slate-800/60 rounded-2xl">
        <h5 className="text-xs font-bold uppercase tracking-widest text-slate-450 flex items-center gap-1">
          <Sparkles className="w-4 h-4 text-[#C96A3D]" />
          Investigative Justification
        </h5>
        <p className="text-xs text-slate-650 dark:text-slate-300 leading-relaxed font-normal">
          {details.explanation}
        </p>
      </div>

      {/* Sources list */}
      {details.sourcesChecked && details.sourcesChecked.length > 0 && (
        <div className="space-y-3 pt-2">
          <h5 className="text-xs font-bold uppercase tracking-widest text-slate-455 flex items-center gap-1.5">
            <Link2 className="w-4 h-4 text-slate-400" />
            Validated Credentials Streams
          </h5>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {details.sourcesChecked.map((src, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 p-3 bg-white dark:bg-[#151f38] border border-slate-100 dark:border-slate-850 rounded-xl leading-none text-xs"
              >
                <div className="w-5 h-5 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-500 font-bold flex items-center justify-center text-[10px] shrink-0 font-mono">
                  {idx + 1}
                </div>
                <span className="truncate text-slate-600 dark:text-slate-300 font-medium">{src}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
