/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GamificationState } from "../types";

export interface Badge {
  id: string;
  title: string;
  description: string;
  icon: string; // lucide icon name
  rarity: "bronze" | "silver" | "gold" | "legendary";
  pointsAwarded: number;
}

export const BADGES: Badge[] = [
  {
    id: "first-chat",
    title: "Nexa Pioneer",
    description: "Initiated your first chat session with Nexa.",
    icon: "Sparkles",
    rarity: "bronze",
    pointsAwarded: 25,
  },
  {
    id: "completed-10",
    title: "Talkative Sage",
    description: "Sent 10 or more prompt requests to the system.",
    icon: "MessageSquare",
    rarity: "silver",
    pointsAwarded: 100,
  },
  {
    id: "deep-researcher",
    title: "Deep Diver",
    description: "Successfully finalized a Deep Research comprehensive synthesis.",
    icon: "Search",
    rarity: "silver",
    pointsAwarded: 150,
  },
  {
    id: "study-master",
    title: "Intellectual Scholar",
    description: "Studied educational units or generated study notes in Study Mode.",
    icon: "GraduationCap",
    rarity: "silver",
    pointsAwarded: 100,
  },
  {
    id: "all-engines",
    title: "Omni Mind",
    description: "Utilized all 5 advanced AI Engines (Core, Reasoning, Vision, Language, Learning).",
    icon: "Brain",
    rarity: "gold",
    pointsAwarded: 250,
  },
  {
    id: "quiz-graduate",
    title: "Quiz Gladiator",
    description: "Evaluated and completed a quiz in the MCQ Arena.",
    icon: "Award",
    rarity: "bronze",
    pointsAwarded: 100,
  },
  {
    id: "perfect-quiz",
    title: "Perfect Score",
    description: "Achieved a perfect score in a multiple-choice academic quiz.",
    icon: "Trophy",
    rarity: "legendary",
    pointsAwarded: 300,
  },
  {
    id: "fact-checker",
    title: "Truth Seeker",
    description: "Verified a statement or live claim in the Fact Checker engine.",
    icon: "CheckCircle",
    rarity: "bronze",
    pointsAwarded: 50,
  }
];



export const INITIAL_GAMIFICATION_STATE: GamificationState = {
  points: 0,
  unlockedBadges: [],
  stats: {
    chatsCompleted: 0,
    enginesUsed: [],
    deepResearchCompleted: 0,
    studyCompleted: 0,
    quizzesTaken: 0,
    perfectQuizzes: 0,
    factChecksCompleted: 0,
  }
};

export function getLevelAndProgress(points: number) {
  const levels = [0, 100, 300, 600, 1000, 1500, 2100, 3000, 4000, 5000];
  let currentLevel = 1;
  while (currentLevel < levels.length && points >= levels[currentLevel]) {
    currentLevel++;
  }
  
  const currentLevelMin = levels[currentLevel - 1];
  const nextLevelMin = levels[currentLevel] || levels[levels.length - 1] + 2000;
  
  const xpInCurrentLevel = points - currentLevelMin;
  const xpNeededForNext = nextLevelMin - currentLevelMin;
  const progressPct = Math.min(100, Math.max(0, Math.floor((xpInCurrentLevel / xpNeededForNext) * 100)));
  
  return {
    level: currentLevel,
    xpInCurrentLevel,
    xpNeededForNext,
    progressPct,
    pointsToNext: Math.max(0, nextLevelMin - points)
  };
}

/**
 * Calculates gamification changes when an action occurs.
 * Returns the modified gamification state and any newly unlocked badges triggered in this action.
 */
export function trackAction(
  currentState: GamificationState | undefined,
  action: {
    type: "send_message" | "complete_research" | "complete_study" | "complete_quiz" | "complete_fact_check";
    payload?: {
      engineId?: string;
      correctAnswers?: number;
      totalQuestions?: number;
    };
  }
): { newState: GamificationState; newlyUnlocked: Badge[] } {
  // Graceful fallback to initial values to preserve backward compatibility
  const state: GamificationState = currentState
    ? {
        ...INITIAL_GAMIFICATION_STATE,
        ...currentState,
        stats: {
          ...INITIAL_GAMIFICATION_STATE.stats,
          ...currentState.stats,
          enginesUsed: Array.isArray(currentState.stats?.enginesUsed) ? currentState.stats.enginesUsed : []
        },
        unlockedBadges: Array.isArray(currentState.unlockedBadges) ? currentState.unlockedBadges : []
      }
    : JSON.parse(JSON.stringify(INITIAL_GAMIFICATION_STATE));

  const newlyUnlocked: Badge[] = [];
  let pointsGained = 0;

  // Process core actions
  switch (action.type) {
    case "send_message":
      state.stats.chatsCompleted += 1;
      pointsGained += 10;
      
      // Track engine if supplied
      if (action.payload?.engineId) {
        const engine = action.payload.engineId;
        if (!state.stats.enginesUsed.includes(engine)) {
          state.stats.enginesUsed.push(engine);
          // +15 points for exploring a new engine
          pointsGained += 15;
        }
      }
      break;

    case "complete_research":
      state.stats.deepResearchCompleted += 1;
      pointsGained += 50;
      break;

    case "complete_study":
      state.stats.studyCompleted += 1;
      pointsGained += 40;
      break;

    case "complete_fact_check":
      state.stats.factChecksCompleted += 1;
      pointsGained += 30;
      break;

    case "complete_quiz":
      state.stats.quizzesTaken += 1;
      pointsGained += 50;
      
      const correct = action.payload?.correctAnswers || 0;
      const total = action.payload?.totalQuestions || 5;
      
      // Extra 10 XP per correct answer
      pointsGained += (correct * 10);
      
      if (correct === total && total > 0) {
        state.stats.perfectQuizzes += 1;
      }
      break;

    default:
      break;
  }

  state.points += pointsGained;

  // Evaluate badges conditions
  BADGES.forEach((badge) => {
    // Skip if already unlocked
    if (state.unlockedBadges.includes(badge.id)) return;

    let qualifies = false;

    if (badge.id === "first-chat" && state.stats.chatsCompleted >= 1) {
      qualifies = true;
    }
    if (badge.id === "completed-10" && state.stats.chatsCompleted >= 10) {
      qualifies = true;
    }
    if (badge.id === "deep-researcher" && state.stats.deepResearchCompleted >= 1) {
      qualifies = true;
    }
    if (badge.id === "study-master" && state.stats.studyCompleted >= 1) {
      qualifies = true;
    }
    if (badge.id === "all-engines" && state.stats.enginesUsed.length >= 5) {
      qualifies = true;
    }
    if (badge.id === "quiz-graduate" && state.stats.quizzesTaken >= 1) {
      qualifies = true;
    }
    if (badge.id === "perfect-quiz" && state.stats.perfectQuizzes >= 1) {
      qualifies = true;
    }
    if (badge.id === "fact-checker" && state.stats.factChecksCompleted >= 1) {
      qualifies = true;
    }

    if (qualifies) {
      state.unlockedBadges.push(badge.id);
      state.points += badge.pointsAwarded;
      newlyUnlocked.push(badge);
    }
  });

  return {
    newState: state,
    newlyUnlocked,
  };
}
