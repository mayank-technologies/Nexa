/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Logo } from "./Logo";

interface SplashScreenProps {
  onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [stage, setStage] = useState<"hold" | "exit">("hold");

  useEffect(() => {
    // Hold for exactly 1.0 second, then trigger zoom out and fade exit
    const exitTimer = setTimeout(() => {
      setStage("exit");
    }, 1000);

    // Dynamic end after exit animation duration completes (total 1.8 seconds)
    const completeTimer = setTimeout(() => {
      onComplete();
    }, 1800);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-white dark:bg-[#0c1222] select-none"
      id="nexa-splash-screen"
    >
      <motion.div
        initial={{ scale: 1.4, opacity: 0 }}
        animate={
          stage === "hold"
            ? { scale: 1.1, opacity: 1 }
            : { scale: 0.95, opacity: 0 }
        }
        transition={{
          duration: stage === "hold" ? 1.0 : 0.8,
          ease: "easeOut",
        }}
      >
        {/* Centered logo showing the high-fidelity 8-pointed star, drawing itself in */}
        <Logo
          size={140}
          showText={false}
          animate={true}
        />
      </motion.div>
    </div>
  );
}
