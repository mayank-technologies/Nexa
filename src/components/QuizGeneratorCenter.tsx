/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { HelpCircle, Check, X, Award, RotateCcw, Brain, ArrowRight } from "lucide-react";
import { MCQQuiz } from "../types";

interface QuizGeneratorCenterProps {
  quiz: MCQQuiz;
  onRestart: () => void;
  onCompleteQuiz?: (score: number, totalQuestions: number) => void;
}

export function QuizGeneratorCenter({ quiz, onRestart, onCompleteQuiz }: QuizGeneratorCenterProps) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);

  const currentQuestion = quiz.questions[currentIdx];

  const handleOptionClick = (idx: number) => {
    if (submitted) return;
    setSelectedIdx(idx);
  };

  const handleSubmit = () => {
    if (selectedIdx === null || submitted) return;
    setSubmitted(true);

    if (selectedIdx === currentQuestion.correctOptionIndex) {
      setScore((s) => s + 1);
    }
  };

  const handleNext = () => {
    if (currentIdx + 1 < quiz.questions.length) {
      setCurrentIdx((idx) => idx + 1);
      setSelectedIdx(null);
      setSubmitted(false);
    } else {
      setQuizFinished(true);
      onCompleteQuiz?.(score, quiz.questions.length);
    }
  };

  const handleReset = () => {
    setCurrentIdx(0);
    setSelectedIdx(null);
    setSubmitted(false);
    setScore(0);
    setQuizFinished(false);
    onRestart();
  };

  if (quizFinished) {
    const passed = score >= quiz.questions.length / 2;
    return (
      <div className="border border-slate-100 dark:border-slate-800 rounded-3xl p-8 bg-slate-50/20 dark:bg-[#12192c]/40 text-center space-y-6 max-w-xl mx-auto my-6" id="nexa-quiz-results-card">
        <div className="mx-auto p-4 bg-[#C96A3D]/10 rounded-full w-16 h-16 flex items-center justify-center text-[#C96A3D]">
          <Award className="w-8 h-8" />
        </div>
        <div className="space-y-1">
          <span className="text-[10px] bg-[#C96A3D]/10 text-[#C96A3D] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-widest">
            {quiz.difficulty} Level Complete
          </span>
          <h4 className="text-xl font-extrabold text-[#14213D] dark:text-white mt-2 leading-tight">
            Quiz Complete on {quiz.topic}
          </h4>
          <p className="text-xs text-slate-400 font-normal">
            You evaluated your knowledge using Nexa Learning Engine algorithms.
          </p>
        </div>

        <div className="p-6 bg-white dark:bg-[#151f38] border border-slate-150 dark:border-slate-800 rounded-2xl max-w-xs mx-auto shadow-2xs">
          <div className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">
            SCORE VALUE
          </div>
          <div className="text-4xl font-extrabold text-[#14213D] dark:text-white font-mono">
            {score} <span className="text-xl text-slate-450 font-normal">/ {quiz.questions.length}</span>
          </div>
          <div className={`text-xs mt-2 font-bold ${passed ? "text-emerald-500" : "text-amber-500"}`}>
            {passed ? "Excellent! Concept Mastered" : "Keep learning to strengthen scope."}
          </div>
        </div>

        <div className="flex gap-3 justify-center">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 border border-slate-205 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold px-4 py-2.5 text-xs rounded-xl transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restart Quiz
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="border border-[#14213D]/10 dark:border-slate-800 rounded-3xl bg-slate-50/20 dark:bg-[#12192c]/40 p-6 md:p-8 space-y-6 text-left my-4 max-w-2xl mx-auto"
      id="nexa-quiz-active-card"
    >
      {/* Quiz Header Info */}
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-4">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-[#C96A3D]" />
          <div>
            <h4 className="text-sm font-extrabold text-[#14213D] dark:text-white leading-tight">
              Topic: {quiz.topic}
            </h4>
            <span className="text-[10px] text-slate-400 font-normal">
              Evaluating parameters on <span className="capitalize">{quiz.difficulty}</span> standard.
            </span>
          </div>
        </div>
        <span className="text-xs font-bold text-indigo-500 bg-indigo-500/10 px-3 py-1 rounded-full font-mono">
          Q: {currentIdx + 1} of {quiz.questions.length}
        </span>
      </div>

      {/* Question Sentence */}
      <div className="space-y-4">
        <h5 className="text-sm md:text-base font-bold text-[#14213D] dark:text-slate-100 leading-snug">
          {currentQuestion.question}
        </h5>

        {/* Options Grid */}
        <div className="grid grid-cols-1 gap-3">
          {currentQuestion.options.map((option, idx) => {
            const isSelected = selectedIdx === idx;
            const isCorrect = idx === currentQuestion.correctOptionIndex;
            
            let btnClass = "border-slate-100 dark:border-slate-800 bg-white dark:bg-[#151f38] text-slate-700 dark:text-slate-200";
            if (isSelected && !submitted) {
              btnClass = "border-[#C96A3D] bg-[#C96A3D]/5 text-[#C96A3D]";
            } else if (submitted) {
              if (isCorrect) {
                btnClass = "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
              } else if (isSelected) {
                btnClass = "border-rose-500 bg-rose-500/10 text-rose-500";
              } else {
                btnClass = "border-slate-100 dark:border-slate-850 bg-white/50 dark:bg-[#151f38]/50 opacity-60";
              }
            }

            return (
              <button
                key={idx}
                disabled={submitted}
                onClick={() => handleOptionClick(idx)}
                className={`flex items-center justify-between p-4 rounded-xl border text-left text-xs font-semibold transition-all ${
                  !submitted ? "hover:border-[#C96A3D]/45 cursor-pointer" : ""
                } ${btnClass}`}
              >
                <span>{option}</span>
                <div className="shrink-0 ml-3">
                  {submitted && isCorrect && <Check className="w-4 h-4 text-emerald-500" />}
                  {submitted && isSelected && !isCorrect && <X className="w-4 h-4 text-rose-500" />}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Grade Action button */}
      <div className="flex justify-between items-center pt-2">
        <button
          onClick={handleReset}
          className="text-xs font-semibold text-slate-405 hover:text-slate-600 flex items-center gap-1 button"
        >
          <RotateCcw className="w-3" /> Abort
        </button>

        {!submitted ? (
          <button
            onClick={handleSubmit}
            disabled={selectedIdx === null}
            className="bg-[#14213D] dark:bg-slate-100 hover:bg-[#C96A3D] dark:hover:bg-[#C96A3D] dark:hover:text-white dark:text-[#14213D] text-white font-bold py-2 px-5 text-xs rounded-xl transition-all disabled:opacity-40"
          >
            Check Answer
          </button>
        ) : (
          <button
            onClick={handleNext}
            className="flex items-center gap-1.5 bg-[#C96A3D] hover:bg-[#14213D] dark:hover:bg-[#C96A3D] text-white font-bold py-2 px-5 text-xs rounded-xl transition-all"
          >
            {currentIdx + 1 === quiz.questions.length ? "Submit Quiz" : "Next Question"}
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Explanation drawer when answered */}
      {submitted && (
        <div className="p-4 bg-slate-50/60 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/80 rounded-2xl space-y-1 animate-fadeIn text-xs leading-relaxed font-normal">
          <h6 className="font-bold text-slate-400 uppercase tracking-widest text-[10px] flex items-center gap-1">
            <HelpCircle className="w-3.5 h-3.5" /> Core Explanation
          </h6>
          <p className="text-slate-650 dark:text-slate-300 font-normal">
            {currentQuestion.explanation}
          </p>
        </div>
      )}
    </div>
  );
}
