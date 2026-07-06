/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState, ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import { safeStorage } from "../utils/storage";
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  X,
  HelpCircle,
  Search,
  BookOpen,
  CheckCircle,
  Feather,
  Brain,
  Cpu,
  Laptop,
  Check,
  Zap,
} from "lucide-react";

interface OnboardingTutorialProps {
  activeMode: string;
  showUploadOptions: boolean;
  setShowUploadOptions: (open: boolean) => void;
  onSelectMode: (mode: any) => void;
  onSetEngineOverride: (engine: string | undefined) => void;
  onStartNewChat: () => void;
  onComplete: () => void;
}

interface TourStep {
  title: string;
  subtitle: string;
  description: string;
  targetId?: string; // DOM ID to target and highlight
  align?: "center" | "bottom-right" | "bottom-left" | "top";
  icon: ReactNode;
}

export function OnboardingTutorial({
  activeMode,
  showUploadOptions,
  setShowUploadOptions,
  onSelectMode,
  onSetEngineOverride,
  onStartNewChat,
  onComplete,
}: OnboardingTutorialProps) {
  const [currentStep, setCurrentStep] = useState(0);

  // Define steps
  const steps: TourStep[] = [
    {
      title: "Welcome to Nexa Intelligence",
      subtitle: "The next-generation autonomous AI suite",
      description: "Welcome! Nexa is powered by unified reasoning models and adaptive engine pipelines. Let's take a quick 1-minute visual walkthrough to supercharge your experience.",
      align: "center",
      icon: <Sparkles className="w-8 h-8 text-[#C96A3D] animate-pulse" />,
    },
    {
      title: "Start Prompting Instantly",
      subtitle: "Direct prompt input area",
      description: "Type physical commands or complex creative queries here. Simply hit Enter to start a session. Our Smart Router automatically analyzes your task’s semantics to route it to the best expert system.",
      targetId: "nexa-chat-input",
      align: "bottom-right",
      icon: <HelpCircle className="w-6 h-6 text-indigo-500" />,
    },
    {
      title: "Meet the Plus Action Hub",
      subtitle: "Expandable Quick-Actions menu",
      description: "Click the '+' button to expand Nexa's multi-modal dock. It contains file uploads, real-time snapshot capture, specialized AI modes, and core logic engine overrides.",
      targetId: "nexa-plus-button",
      align: "bottom-right",
      icon: <Zap className="w-6 h-6 text-yellow-500 animate-bounce" />,
    },
    {
      title: "Specialized Intelligence Modes",
      subtitle: "Dedicated analytical workflows",
      description: "Toggle custom modes to tackle specific tasks: Deep Research gathers live internet citations, Study Arena builds flashcards/guides, Fact Checker scores statement logic, and Writing Assistant drafts professional copies.",
      targetId: "nexa-tour-modes",
      align: "bottom-right",
      icon: <Brain className="w-6 h-6 text-pink-500" />,
    },
    {
      title: "You're Fully Certified!",
      subtitle: "Unlock your cognitive booster",
      description: "That's it! Your Nexa Intelligence companion is primed and ready. We've populated a clean sandbox with safe initial states so you can begin.",
      align: "center",
      icon: <Sparkles className="w-10 h-10 text-[#C96A3D] animate-spin-slow" />,
    },
  ];

  const currentStepData = steps[currentStep];

  // Side-effect: automatically handle opening / highlighting popups
  useEffect(() => {
    if (!currentStepData) return;

    // Automatically expand Plus Action Hub for mode step
    if (currentStepData.targetId === "nexa-tour-modes") {
      setShowUploadOptions(true);
    } else if (currentStepData.targetId === "nexa-plus-button") {
      setShowUploadOptions(false);
    } else {
      setShowUploadOptions(false);
    }
  }, [currentStep, currentStepData, setShowUploadOptions]);

  // Clean-up dynamic ring outlines on active target elements
  useEffect(() => {
    // Clear existing rings first
    const highlightedElements = document.querySelectorAll(".nexa-tour-highlight");
    highlightedElements.forEach((el) => {
      el.classList.remove(
        "nexa-tour-highlight",
        "ring-4",
        "ring-[#C96A3D]/90",
        "ring-offset-4",
        "dark:ring-offset-[#0c1222]",
        "animate-pulse",
        "relative",
        "z-[60]"
      );
    });

    if (!currentStepData || !currentStepData.targetId) return;

    // Wait a brief tick for elements to be fully rendered (e.g. popover animation)
    const timer = setTimeout(() => {
      const targetEl = document.getElementById(currentStepData.targetId!);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
        targetEl.classList.add(
          "nexa-tour-highlight",
          "ring-4",
          "ring-[#C96A3D]/90",
          "ring-offset-4",
          "dark:ring-offset-[#0c1222]",
          "animate-pulse",
          "relative",
          "z-[60]"
        );
      }
    }, currentStep === 3 ? 150 : 0);

    return () => clearTimeout(timer);
  }, [currentStep, currentStepData]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    // Remove all outlines
    const highlightedElements = document.querySelectorAll(".nexa-tour-highlight");
    highlightedElements.forEach((el) => {
      el.classList.remove(
        "nexa-tour-highlight",
        "ring-4",
        "ring-[#C96A3D]/90",
        "ring-offset-4",
        "dark:ring-offset-[#0c1222]",
        "animate-pulse",
        "relative",
        "z-[60]"
      );
    });
    safeStorage.setItem("nexa-tour-completed", "true");
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none" id="nexa-onboarding-overlay">
      {/* Semi-transparent, very subtle backdrop tint with NO blur filter */}
      <div 
        className="absolute inset-0 bg-slate-900/[0.08] dark:bg-[#000000]/15 transition-all duration-350 pointer-events-auto"
        onClick={handleComplete}
      />

      {/* Main interactive cards container */}
      <div className="absolute inset-x-0 bottom-0 md:inset-0 flex items-center justify-center p-4 md:p-6 z-[101]">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.25 }}
            className={`pointer-events-auto w-full max-w-md bg-white dark:bg-[#0c1222] border border-slate-100 dark:border-slate-800 rounded-3xl shadow-2xl p-6 md:p-8 relative overflow-hidden ${
              currentStepData.align === "center" ? "" : "md:absolute md:bottom-28 md:right-10"
            }`}
          >
            {/* Ambient accent background flare */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#C96A3D]/10 to-transparent rounded-full filter blur-xl pointer-events-none" />

            {/* Skip / Close Button */}
            <button
              onClick={handleComplete}
              className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Skip Tutorial"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Step header icon and title */}
            <div className="flex items-start gap-4 mb-4">
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800/80 shrink-0">
                {currentStepData.icon}
              </div>
              <div className="text-left flex-1 min-w-0">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#C96A3D]">
                  Step {currentStep + 1} of {steps.length}
                </span>
                <h3 className="text-lg font-extrabold text-slate-900 dark:text-white leading-tight font-sans mt-0.5">
                  {currentStepData.title}
                </h3>
                <p className="text-xs text-slate-450 dark:text-slate-400 font-semibold mt-0.5 leading-tight italic truncate">
                  {currentStepData.subtitle}
                </p>
              </div>
            </div>

            {/* Main content */}
            <div className="text-left mb-6">
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
                {currentStepData.description}
              </p>
            </div>

            {/* Actions / Footer controls */}
            <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800/60 pt-4">
              {/* Skip tour text key */}
              <button
                onClick={handleComplete}
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors py-1.5"
              >
                Skip Guide
              </button>

              <div className="flex items-center gap-2">
                {currentStep > 0 && (
                  <button
                    onClick={handleBack}
                    className="flex items-center gap-1.5 px-3 py-2 bg-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white rounded-xl text-xs font-bold transition-all"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Back
                  </button>
                )}

                <button
                  onClick={handleNext}
                  className="flex items-center gap-1.5 bg-[#14213D] hover:bg-[#C96A3D] dark:bg-slate-100 dark:text-[#14213D] dark:hover:bg-[#C96A3D] dark:hover:text-white text-white rounded-xl px-4 py-2 text-xs font-serif font-black transition-all shadow-md active:scale-95"
                >
                  {currentStep === steps.length - 1 ? (
                    <>
                      Let's Begin
                      <Check className="w-3.5 h-3.5" />
                    </>
                  ) : (
                    <>
                      Next
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Footer progress pills indicator bar */}
            <div className="flex gap-1 bg-slate-50 dark:bg-slate-900/40 p-1 rounded-full items-center justify-center mt-5">
              {steps.map((_, idx) => (
                <div
                  key={idx}
                  className={`h-1 rounded-full transition-all duration-300 ${
                    idx === currentStep
                      ? "w-4 bg-[#C96A3D]"
                      : idx < currentStep
                      ? "w-2 bg-slate-300 dark:bg-slate-750"
                      : "w-1 bg-slate-200 dark:bg-slate-850"
                  }`}
                />
              ))}
            </div>
            
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
