/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Search, BrainCircuit, Sparkles, Binary, CheckSquare, GraduationCap } from "lucide-react";

interface SuggestedPromptsProps {
  onSelectPrompt: (prompt: string, mode: "general" | "research" | "study" | "factcheck" | "writing") => void;
}

export function SuggestedPrompts({ onSelectPrompt }: SuggestedPromptsProps) {
  const prompts = [
    {
      icon: <Binary className="w-5 h-5 text-indigo-500" />,
      title: "Solve complex calculus",
      desc: "Routes to high-reasoning engine with step-by-step math breakdowns.",
      prompt: "Solve the derivative of f(x) = ln(x^2 + 3x) / e^2x and outline steps.",
      mode: "general" as const,
    },
    {
      icon: <GraduationCap className="w-5 h-5 text-[#C96A3D]" />,
      title: "Explain black holes simple",
      desc: "Launches Study Mode with Explain Like I'm 10 analogies.",
      prompt: "How does a black hole warp spacetime and prevent light from escaping?",
      mode: "study" as const,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full" id="nexa-suggested-prompts">
      {prompts.map((item, index) => (
        <button
          key={index}
          onClick={() => onSelectPrompt(item.prompt, item.mode)}
          className="flex flex-col items-start text-left p-5 bg-white dark:bg-[#11192e] hover:bg-[#edf2f7] dark:hover:bg-[#16223f] border border-slate-100 dark:border-slate-800 rounded-2xl shadow-xs transition-all hover:scale-[1.01] duration-200 group"
        >
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl mb-4 group-hover:bg-white dark:group-hover:bg-[#1b2a4e] transition-colors">
            {item.icon}
          </div>
          <h4 className="font-semibold text-sm text-[#14213D] dark:text-slate-100 mb-1 group-hover:text-[#C96A3D] transition-colors">
            {item.title}
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-normal">
            {item.desc}
          </p>
        </button>
      ))}
    </div>
  );
}
