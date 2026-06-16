/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { FileText, Lightbulb, Link, ArrowDown, ChevronRight, Bookmark } from "lucide-react";
import { DeepResearchReport as ReportType } from "../types";

interface DeepResearchReportProps {
  report: ReportType;
  onExport: () => void;
}

export function DeepResearchReport({ report, onExport }: DeepResearchReportProps) {
  return (
    <div
      className="border border-[#14213D]/10 dark:border-slate-800/80 rounded-2xl bg-slate-50/40 dark:bg-[#12192c]/50 p-6 md:p-8 space-y-6 text-left my-4 hover:shadow-xs transition-shadow duration-300 relative overflow-hidden"
      id="nexa-deep-research-report"
    >
      {/* Decorative vertical ribbon */}
      <div className="absolute top-0 bottom-0 left-0 w-1.5 bg-[#C96A3D]" />

      {/* Report Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#C96A3D]/10 text-[#C96A3D] rounded-2xl shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[9px] font-bold uppercase tracking-widest text-[#C96A3D] bg-[#C96A3D]/10 px-2.5 py-0.5 rounded-full inline-block">
              Deep Investigation
            </span>
            <h4 className="text-lg font-bold text-[#14213D] dark:text-white mt-1 leading-tight font-sans">
              Nexa Proprietary Research findings
            </h4>
          </div>
        </div>
        <button
          onClick={onExport}
          className="flex items-center gap-1.5 bg-[#14213D] hover:bg-[#C96A3D] dark:bg-slate-100 dark:hover:bg-[#C96A3D] dark:hover:text-white dark:text-[#14213D] text-white font-bold py-2 px-4 rounded-xl text-xs transition-all tracking-wide self-start sm:self-center"
        >
          <Bookmark className="w-3.5 h-3.5" />
          Export Research Report (PDF)
        </button>
      </div>

      {/* 1. Executive Summary */}
      <div className="space-y-2">
        <h5 className="text-xs font-bold uppercase tracking-widest text-slate-400">
          Executive Summary
        </h5>
        <p className="text-sm text-[#14213D]/90 dark:text-slate-200 leading-relaxed font-normal p-4 bg-white dark:bg-[#151f38] border border-slate-100 dark:border-slate-800/60 rounded-2xl">
          {report.executiveSummary}
        </p>
      </div>

      {/* 2. Key Insights bullet grid */}
      {report.keyInsights && report.keyInsights.length > 0 && (
        <div className="space-y-3">
          <h5 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
            <Lightbulb className="w-4 h-4 text-[#C96A3D]" />
            Core Analytics Insights
          </h5>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {report.keyInsights.map((insight, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 p-4 bg-white dark:bg-[#151f38] border border-slate-100 dark:border-slate-800/60 rounded-2xl"
              >
                <div className="p-1 text-slate-100 bg-[#C96A3D] rounded-lg shrink-0 mt-0.5">
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-350 font-normal leading-relaxed">
                  {insight}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Detailed Findings */}
      <div className="space-y-2">
        <h5 className="text-xs font-bold uppercase tracking-widest text-slate-400">
          Detailed Findings & Synopses
        </h5>
        <div className="prose prose-sm prose-slate dark:prose-invert max-w-none text-sm text-[#14213D]/80 dark:text-slate-300 leading-relaxed space-y-4 font-normal">
          {/* Support paragraphs easily */}
          {report.detailedFindings.split("\n\n").map((para, idx) => {
            if (!para.trim()) return null;
            // Check if it's a subheader
            if (para.startsWith("###")) {
              return (
                <h6
                  key={idx}
                  className="text-sm font-bold text-[#14213D] dark:text-white mt-4 first:mt-0"
                >
                  {para.replace("###", "").trim()}
                </h6>
              );
            }
            return (
              <p key={idx} className="font-normal text-slate-650 dark:text-slate-300">
                {para}
              </p>
            );
          })}
        </div>
      </div>

      {/* 4. Referenced bibliography */}
      {report.references && report.references.length > 0 && (
        <div className="border-t border-slate-150 dark:border-slate-800 pt-5 space-y-3">
          <h5 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
            <Link className="w-4 h-4 text-slate-450" />
            Cited Bibliography References
          </h5>
          <div className="flex flex-wrap gap-2.5">
            {report.references.map((src, idx) => (
              <a
                key={idx}
                href={src.uri}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs text-indigo-500 hover:text-white bg-indigo-500/10 hover:bg-indigo-500 hover:border-indigo-500 border border-indigo-500/15 rounded-xl transition-all duration-200"
              >
                <span className="w-5 h-5 rounded-full bg-indigo-500/10 text-[9px] font-bold flex items-center justify-center text-indigo-650 dark:text-indigo-300 group-hover:bg-white/20">
                  {idx + 1}
                </span>
                <span className="truncate max-w-[200px] font-medium leading-none">{src.title}</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
