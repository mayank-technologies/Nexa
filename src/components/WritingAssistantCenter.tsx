/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { FileText, Feather, RefreshCw, PenTool, CheckCircle, ChevronDown } from "lucide-react";

interface WritingAssistantCenterProps {
  onDraft: (prompt: string, style: "formal" | "casual" | "academic" | "professional") => void;
  loading: boolean;
}

export function WritingAssistantCenter({ onDraft, loading }: WritingAssistantCenterProps) {
  const [style, setStyle] = useState<"formal" | "casual" | "academic" | "professional">("casual");
  const [topic, setTopic] = useState("");
  const [format, setFormat] = useState("essay");

  const writingStyles = [
    { id: "formal", name: "Formal / Corporate", desc: "Meticulous, polite, and industry-standard formatting." },
    { id: "casual", name: "Casual / Empathetic", desc: "Friendly, engaging, conversational, and accessible." },
    { id: "academic", name: "Academic / Analytical", desc: "Highly objective, citation-oriented, passive-neutral." },
    { id: "professional", name: "Professional / Bullet", desc: "Actionable, outcome-centric, concise, and structured." },
  ] as const;

  const formats = [
    { id: "essay", name: "Comprehensive Essay", placeholder: "e.g. The impact of modern renewable grids on remote regions..." },
    { id: "letter", name: "Formal Letter / Application", placeholder: "e.g. Leave request indicating sudden relocation parameters..." },
    { id: "report", name: "Analysis Report", placeholder: "e.g. Summary of remote working trends across global software startups..." },
    { id: "rewrite", name: "Polishing & Rewriting Draft", placeholder: "e.g. Paste your draft content here to perfect grammar and formatting..." },
  ];

  const currentPlaceholder = formats.find((f) => f.id === format)?.placeholder || "Describe what you'd like to write...";

  const handleDraftSubmit = () => {
    if (!topic.trim()) return;

    let finalPrompt = "";
    if (format === "essay") {
      finalPrompt = `Compose a comprehensive academic essay regarding "${topic}". Include structural sections, introduction, main arguments, and a future-looking conclusion.`;
    } else if (format === "letter") {
      finalPrompt = `Draft a highly professional letter or business application about: "${topic}". Format it cleanly with standard industry salutations and address tags.`;
    } else if (format === "report") {
      finalPrompt = `Compile a structured summary analytical report on the following scope: "${topic}". Focus on key outcome metrics, structured takeaways, and recommendations.`;
    } else if (format === "rewrite") {
      finalPrompt = `Rewrite, correct grammar, and dramatically perfect the style and flow of this text: "${topic}". Keep all core meaningful insights intact but upgrade word selections.`;
    }

    onDraft(finalPrompt, style);
  };

  return (
    <div
      className="border border-[#14213D]/10 dark:border-slate-800 rounded-3xl bg-slate-50/20 dark:bg-[#12192c]/40 p-6 md:p-8 space-y-6 text-left my-4 max-w-2xl mx-auto"
      id="nexa-writing-assistant-center"
    >
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800/85 pb-5">
        <div className="p-3 bg-amber-500/10 text-[#C96A3D] rounded-2xl shrink-0">
          <Feather className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-base font-extrabold text-[#14213D] dark:text-white leading-tight font-sans">
            Nexa Writing Assistant
          </h4>
          <span className="text-[10px] text-slate-400 font-normal block mt-0.5">
            Optimize essays, corporate letters, analytical summaries, and grammatical drafts quickly.
          </span>
        </div>
      </div>

      {/* 2. Format Select */}
      <div className="space-y-2">
        <label className="block text-xs font-bold text-[#14213D] dark:text-slate-350 uppercase tracking-widest">
          Composition Format / Task
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {formats.map((f) => (
            <button
              key={f.id}
              onClick={() => {
                setFormat(f.id);
                setTopic("");
              }}
              className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all text-center ${
                format === f.id
                  ? "border-[#C96A3D] bg-[#C96A3D]/5 text-[#C96A3D] shadow-xs"
                  : "border-slate-100 dark:border-slate-850 bg-white dark:bg-[#151f38] text-slate-500 dark:text-slate-350 hover:border-slate-200"
              }`}
            >
              {f.name.split("/")[0]}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Input Text */}
      <div className="space-y-2">
        <label className="block text-xs font-bold text-[#14213D] dark:text-slate-350 uppercase tracking-widest">
          Brief Topic Outline / Draft Text
        </label>
        <textarea
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder={currentPlaceholder}
          rows={5}
          className="w-full text-xs py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:border-[#C96A3D] outline-none text-[#14213D] dark:text-white transition-colors"
        />
      </div>

      {/* 4. Style Select Grid */}
      <div className="space-y-2.5">
        <label className="block text-xs font-bold text-[#14213D] dark:text-slate-350 uppercase tracking-widest">
          Assertive Prose Style Preference
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {writingStyles.map((item) => (
            <button
              key={item.id}
              onClick={() => setStyle(item.id)}
              className={`flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all ${
                style === item.id
                  ? "border-[#C96A3D] bg-[#C96A3D]/5 text-[#C96A3D]"
                  : "border-slate-100 dark:border-slate-850 bg-white dark:bg-[#151f38] text-[#14213D] dark:text-slate-250 hover:border-slate-205"
              }`}
            >
              <div
                className={`p-1.5 rounded-lg shrink-0 ${
                  style === item.id ? "bg-[#C96A3D]/10 text-[#C96A3D]" : "bg-slate-50 dark:bg-slate-900 text-slate-400"
                }`}
              >
                <PenTool className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h5 className={`text-xs font-bold ${style === item.id ? "text-[#C96A3D]" : ""}`}>
                  {item.name}
                </h5>
                <p className="text-[10px] text-slate-450 mt-0.5 leading-relaxed font-normal">
                  {item.desc}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Submit / Outline Trigger */}
      <div className="pt-2 text-right">
        <button
          onClick={handleDraftSubmit}
          disabled={loading || !topic.trim()}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 bg-[#14213D] hover:bg-[#C96A3D] dark:bg-slate-100 dark:hover:bg-[#C96A3D] dark:hover:text-white dark:text-[#14213D] text-white font-bold py-2.5 px-6 text-xs rounded-xl transition-all disabled:opacity-40"
        >
          {loading ? "Generating Draft..." : "Compose Custom Draft"}
          <Feather className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
