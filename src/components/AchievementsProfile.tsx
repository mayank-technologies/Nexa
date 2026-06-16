/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { 
  Sparkles, 
  MessageSquare, 
  Search, 
  GraduationCap, 
  Brain, 
  Award, 
  Trophy, 
  CheckCircle, 
  Lock, 
  Flame, 
  Zap, 
  Cpu, 
  TrendingUp, 
  HelpCircle,
  Dna
} from "lucide-react";
import { UserProfile, GamificationState } from "../types";
import { BADGES, getLevelAndProgress, INITIAL_GAMIFICATION_STATE } from "../utils/gamification";

interface AchievementsProfileProps {
  user: UserProfile;
}

export function AchievementsProfile({ user }: AchievementsProfileProps) {
  const [selectedBadgeId, setSelectedBadgeId] = useState<string | null>(null);

  // Fallback to default state safely if gamification is not initialized
  const gamification: GamificationState = user.gamification || INITIAL_GAMIFICATION_STATE;
  
  const points = gamification.points || 0;
  const unlockedBadges = gamification.unlockedBadges || [];
  const stats = gamification.stats || INITIAL_GAMIFICATION_STATE.stats;
  const enginesUsed = stats.enginesUsed || [];

  const { level, xpInCurrentLevel, xpNeededForNext, progressPct, pointsToNext } = getLevelAndProgress(points);

  // Map icon strings to Lucide components
  const getBadgeIcon = (iconName: string, rarity: string, isUnlocked: boolean) => {
    const iconProps = {
      className: `w-6 h-6 transition-transform ${
        isUnlocked 
          ? rarity === "legendary" 
            ? "text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)] scale-110"
            : rarity === "gold" 
            ? "text-yellow-500" 
            : rarity === "silver" 
            ? "text-slate-350" 
            : "text-[#C96A3D]" 
          : "text-slate-400 group-hover:scale-105"
      }`
    };

    switch (iconName) {
      case "Sparkles":
        return <Sparkles {...iconProps} />;
      case "MessageSquare":
        return <MessageSquare {...iconProps} />;
      case "Search":
        return <Search {...iconProps} />;
      case "GraduationCap":
        return <GraduationCap {...iconProps} />;
      case "Brain":
        return <Brain {...iconProps} />;
      case "Award":
        return <Award {...iconProps} />;
      case "Trophy":
        return <Trophy {...iconProps} />;
      case "CheckCircle":
        return <CheckCircle {...iconProps} />;
      default:
        return <Trophy {...iconProps} />;
    }
  };

  // Map rarity levels to styled colors
  const getRarityConfig = (rarity: string) => {
    switch (rarity) {
      case "legendary":
        return {
          bg: "bg-amber-500/10 dark:bg-amber-500/15",
          border: "border-amber-400",
          text: "text-amber-500 dark:text-amber-400",
          pill: "bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30",
          label: "Legendary"
        };
      case "gold":
        return {
          bg: "bg-yellow-500/10 dark:bg-yellow-500/15",
          border: "border-yellow-400",
          text: "text-yellow-600 dark:text-yellow-400",
          pill: "bg-yellow-500/20 text-yellow-600 dark:text-yellow-450 border border-yellow-500/30",
          label: "Gold"
        };
      case "silver":
        return {
          bg: "bg-slate-100 dark:bg-slate-800/60",
          border: "border-slate-300 dark:border-slate-700",
          text: "text-slate-600 dark:text-slate-300",
          pill: "bg-slate-200/50 dark:bg-slate-800 text-slate-600 dark:text-slate-350",
          label: "Silver"
        };
      case "bronze":
      default:
        return {
          bg: "bg-[#C96A3D]/10",
          border: "border-[#C96A3D]/30",
          text: "text-[#C96A3D]",
          pill: "bg-[#C96A3D]/15 text-[#C96A3D]",
          label: "Bronze"
        };
    }
  };

  return (
    <div className="space-y-6" id="nexa-achievements-tab-panel">
      {/* Level Summary Header card */}
      <div className="p-6 bg-gradient-to-br from-[#121b30] to-[#0c1222] text-white border border-slate-800 rounded-3xl relative overflow-hidden select-none shadow-md">
        {/* Aesthetic background mesh glow */}
        <div className="absolute right-0 top-0 w-44 h-44 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute left-10 bottom-0 w-32 h-32 bg-[#C96A3D]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#C96A3D] to-orange-500 flex flex-col items-center justify-center font-black shadow-lg shadow-orange-500/25">
              <span className="text-[10px] tracking-wider uppercase text-orange-100/80 -mb-1">Level</span>
              <span className="text-2xl font-black font-sans leading-none">{level}</span>
            </div>
            <div>
              <div className="text-xl font-bold font-sans tracking-tight">
                {user.fullName || "Nexa Explorer"}
              </div>
              <div className="text-xs text-slate-450 flex items-center gap-1.5 mt-0.5">
                <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="font-mono text-slate-300 font-bold">{points} XP</span> Accumulated
              </div>
            </div>
          </div>
          
          <div className="text-right sm:text-right shrink-0">
            <span className="text-[10px] font-bold tracking-widest bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full uppercase">
              Rank: Nexa Professional
            </span>
          </div>
        </div>

        {/* XP Level Progress Bar */}
        <div className="mt-6 space-y-2 relative z-10">
          <div className="flex justify-between text-xs font-semibold select-none">
            <span className="text-slate-400">Level {level} Milestone</span>
            <span className="text-indigo-300 font-mono">{xpInCurrentLevel} / {xpNeededForNext} XP</span>
          </div>
          <div className="h-2.5 w-full bg-slate-800 border border-slate-700/60 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-[#C96A3D] via-amber-400 to-emerald-400 rounded-full transition-all duration-700"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-[10px] text-slate-450 pt-0.5">
            <span className="font-normal font-sans">Unlocked {unlockedBadges.length} of {BADGES.length} Badges</span>
            <span className="font-medium inline-flex items-center gap-1 text-slate-300">
              <TrendingUp className="w-3 h-3 text-emerald-400" />
              {pointsToNext > 0 ? `${pointsToNext} XP to reach Level ${level + 1}` : "Maximum Level Reached!"}
            </span>
          </div>
        </div>
      </div>

      {/* Stats Bento Box Row Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Chats Stat */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl flex flex-col justify-between text-left">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Messages Sent</span>
            <MessageSquare className="w-4 h-4 text-slate-450" />
          </div>
          <div className="font-sans font-black text-2xl text-[#14213D] dark:text-white mt-2 leading-none">
            {stats.chatsCompleted}
          </div>
        </div>

        {/* Deep Research Stat */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl flex flex-col justify-between text-left">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Deep Research</span>
            <Search className="w-4 h-4 text-rose-500" />
          </div>
          <div className="font-sans font-black text-2xl text-[#14213D] dark:text-white mt-2 leading-none">
            {stats.deepResearchCompleted}
          </div>
        </div>

        {/* Quizzes Taken Stat */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl flex flex-col justify-between text-left">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Quizzes Complete</span>
            <GraduationCap className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="font-sans font-black text-2xl text-[#14213D] dark:text-white mt-2 leading-none">
            {stats.quizzesTaken}
          </div>
        </div>

        {/* Engines Explored Stat */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl flex flex-col justify-between text-left">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">AI Engines Used</span>
            <Cpu className="w-4 h-4 text-[#C96A3D]" />
          </div>
          <div className="font-sans font-black text-2xl text-[#14213D] dark:text-white mt-2 leading-none">
            {enginesUsed.length} <span className="text-xs text-slate-400 font-normal">/ 5</span>
          </div>
        </div>
      </div>

      {/* Badges Locker Header */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-[#C96A3D]" />
            Your Badges Locker
          </h4>
          <span className="text-[10px] font-bold text-indigo-500 bg-indigo-500/10 border border-indigo-500/15 px-3 py-0.5 rounded-full">
            {unlockedBadges.length} unlocked
          </span>
        </div>

        {/* Badges Locker Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" id="badges-locker-grid">
          {BADGES.map((badge) => {
            const isUnlocked = unlockedBadges.includes(badge.id);
            const rConfig = getRarityConfig(badge.rarity);
            const isSelected = selectedBadgeId === badge.id;

            return (
              <div
                key={badge.id}
                onClick={() => setSelectedBadgeId(isSelected ? null : badge.id)}
                className={`group p-4 border rounded-2xl text-left cursor-pointer transition-all select-none relative overflow-hidden ${
                  isUnlocked 
                    ? `border-slate-100 dark:border-slate-800 bg-white dark:bg-[#152033] hover:shadow-xs ${isSelected ? "ring-2 ring-[#C96A3D]/40" : ""}` 
                    : `border-slate-100 dark:border-slate-850 bg-slate-50/40 dark:bg-[#0c1222]/30 opacity-75`
                }`}
              >
                <div className="flex items-start gap-3 relative.z-10">
                  {/* Badge Icon Slot */}
                  <div className={`p-2.5 rounded-xl flex items-center justify-center shrink-0 ${
                    isUnlocked ? rConfig.bg : "bg-slate-200/50 dark:bg-slate-800/80"
                  }`}>
                    {isUnlocked ? getBadgeIcon(badge.icon, badge.rarity, isUnlocked) : <Lock className="w-5 h-5 text-slate-400" />}
                  </div>

                  <div className="space-y-1 truncate w-full">
                    <div className="flex items-center justify-between gap-1">
                      <span className={`text-xs font-bold leading-none truncate ${
                        isUnlocked ? "text-[#14213D] dark:text-white" : "text-slate-400"
                      }`}>
                        {badge.title}
                      </span>
                      <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${
                        isUnlocked ? rConfig.pill : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                      }`}>
                        {badge.rarity}
                      </span>
                    </div>
                    
                    <p className={`text-[10px] leading-relaxed truncate ${
                      isUnlocked ? "text-slate-400 dark:text-slate-350" : "text-slate-500 font-mono"
                    }`}>
                      {isUnlocked ? badge.description : "Locked. Unlock requirements apply."}
                    </p>

                    {/* XP Bonus Indicator */}
                    <div className="flex justify-between items-center text-[9px] pt-1 leading-none font-bold">
                      <span className={isUnlocked ? "text-slate-450" : "text-slate-500"}>
                        {isUnlocked ? "Unlocked & Claimed" : "Reward"}
                      </span>
                      <span className={isUnlocked ? "text-emerald-500" : "text-[#C96A3D]"}>
                        +{badge.pointsAwarded} XP
                      </span>
                    </div>
                  </div>
                </div>

                {/* Expanded interactive overlay info details */}
                {isSelected && (
                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 select-none animate-fadeIn">
                    <p className="text-xs text-slate-450 dark:text-slate-350 leading-relaxed font-normal">
                      <strong>Requirement:</strong> {getBadgeRequirementText(badge.id)}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Utility descriptor helper
function getBadgeRequirementText(badgeId: string): string {
  switch (badgeId) {
    case "first-chat":
      return "Initiate your dynamic journey by completing your first conversational prompt thread with Nexa.";
    case "completed-10":
      return "Express persistent interests by keeping active threads and generating 10 or more message prompts.";
    case "deep-researcher":
      return "Activate 'Deep Research' mode in the upper navbar toggle and finalize an exhaustive web report.";
    case "study-master":
      return "Configure your sidebar mode to 'Study Mode' and utilize interactive summary nodes or study cards.";
    case "all-engines":
      return "Explore advanced architectures by triggers that delegate to Core, Reasoning, Vision, Language, and Learning Engines.";
    case "quiz-graduate":
      return "Hone skills in the MCQ Quiz Arena by completing an interactive 5-question test.";
    case "perfect-quiz":
      return "Excel in the MCQ Quiz Arena by scoring 5/5 (100% correct answers) on any generated quiz topic.";
    case "fact-checker":
      return "Evaluate a social claim or search update in the Fact Checker workspace module.";
    default:
      return "Interact with other educational and semantic modules inside Nexa Intelligence.";
  }
}
