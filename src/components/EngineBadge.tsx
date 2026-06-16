/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Cpu, Brain, Eye, Languages, GraduationCap } from "lucide-react";
import { NexaEngineId } from "../types";

interface EngineBadgeProps {
  engineId: NexaEngineId;
  size?: "sm" | "md";
}

export function EngineBadge({ engineId, size = "md" }: EngineBadgeProps) {
  const engineDetails = {
    core: {
      name: "Nexa Core Engine",
      icon: <Cpu className={size === "sm" ? "w-3 h-3" : "w-4 h-4"} />,
      className: "bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400",
      desc: "General conversation, everyday logic systems, and text generation",
    },
    reasoning: {
      name: "Nexa Reasoning Engine",
      icon: <Brain className={size === "sm" ? "w-3 h-3" : "w-4 h-4"} />,
      className: "bg-indigo-500/10 border-indigo-500/20 text-indigo-500 dark:text-indigo-400",
      desc: "Mathematics, structured recursive algorithm reasoning, and analytical problems",
    },
    vision: {
      name: "Nexa Vision Engine",
      icon: <Eye className={size === "sm" ? "w-3 h-3" : "w-4 h-4"} />,
      className: "bg-violet-500/10 border-violet-500/20 text-violet-500 dark:text-violet-400",
      desc: "Multimodal image understanding, OCR extraction, diagram processing, and homework visual analysis",
    },
    language: {
      name: "Nexa Language Engine",
      icon: <Languages className={size === "sm" ? "w-3 h-3" : "w-4 h-4"} />,
      className: "bg-emerald-500/10 border-emerald-500/20 text-emerald-500 dark:text-emerald-400",
      desc: "Multilingual dialect parsing, precise grammatical correction, and fluid translation",
    },
    learning: {
      name: "Nexa Learning Engine",
      icon: <GraduationCap className={size === "sm" ? "w-3 h-3" : "w-4 h-4"} />,
      className: "bg-[#C96A3D]/10 border-[#C96A3D]/25 text-[#C96A3D]",
      desc: "Academic notes generation, MCQ quiz scoring, study plans, and simplifying complex data",
    },
  };

  const details = engineDetails[engineId] || engineDetails.core;

  return (
    <div
      title={details.desc}
      className={`inline-flex items-center gap-1.5 font-bold tracking-tight rounded-full border shadow-2xs cursor-help select-none ${
        size === "sm" ? "px-2 py-0.5 text-[9px]" : "px-3 py-1 text-xs"
      } ${details.className}`}
      id={`nexa-engine-badge-${engineId}`}
    >
      {details.icon}
      <span>{details.name}</span>
    </div>
  );
}
