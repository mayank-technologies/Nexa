/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { motion } from "motion/react";

interface LogoProps {
  size?: number;
  showText?: boolean;
  textClass?: string;
  animate?: boolean;
}

export function Logo({
  size = 36,
  showText = true,
  textClass = "text-xl font-bold tracking-tight",
  animate = true,
}: LogoProps) {
  const [imgError, setImgError] = useState(false);
  const logoColor = "currentColor";

  // Animation variants for SVG paths
  const drawVariants = {
    initial: { pathLength: 0, opacity: 0 },
    enter: (custom: number) => ({
      pathLength: 1,
      opacity: 1,
      transition: { duration: 0.9, delay: custom * 0.15, ease: "easeInOut" },
    }),
  };

  const textVariants = {
    initial: { opacity: 0, x: -8 },
    enter: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.6, delay: 0.2, ease: "easeOut" },
    },
  };

  // Render original high-fidelity 8-pointed woven star vector as a sharp SVG fallback
  const svgLogo = (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full select-none"
      style={{ minWidth: "100%", minHeight: "100%", objectFit: "contain" }}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Woven Part 1: Outer Star Point (Diamond Square rotated 45deg) */}
      <motion.path
        d="M 50 8 L 92 50 L 50 92 L 8 50 Z"
        stroke={logoColor}
        strokeWidth={7.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        variants={animate ? (drawVariants as any) : undefined}
        custom={0}
        initial={animate ? "initial" : undefined}
        animate={animate ? "enter" : undefined}
      />

      {/* Woven Part 2: Outer Star Point (Standard Square) */}
      <motion.path
        d="M 20 20 L 80 20 L 80 80 L 20 80 Z"
        stroke={logoColor}
        strokeWidth={7.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        variants={animate ? (drawVariants as any) : undefined}
        custom={1.5}
        initial={animate ? "initial" : undefined}
        animate={animate ? "enter" : undefined}
      />

      {/* Woven Part 3: Inner Interlocking 'N' Core Leg Left */}
      <motion.path
        d="M 35 27 L 35 73"
        stroke={logoColor}
        strokeWidth={8}
        strokeLinecap="round"
        strokeLinejoin="round"
        variants={animate ? (drawVariants as any) : undefined}
        custom={3}
        initial={animate ? "initial" : undefined}
        animate={animate ? "enter" : undefined}
      />

      {/* Woven Part 4: Inner Interlocking 'N' Core Diagonal */}
      <motion.path
        d="M 35 34 L 65 66"
        stroke={logoColor}
        strokeWidth={8}
        strokeLinecap="round"
        strokeLinejoin="round"
        variants={animate ? (drawVariants as any) : undefined}
        custom={3.5}
        initial={animate ? "initial" : undefined}
        animate={animate ? "enter" : undefined}
      />

      {/* Woven Part 5: Inner Interlocking 'N' Core Leg Right */}
      <motion.path
        d="M 65 27 L 65 73"
        stroke={logoColor}
        strokeWidth={8}
        strokeLinecap="round"
        strokeLinejoin="round"
        variants={animate ? (drawVariants as any) : undefined}
        custom={4}
        initial={animate ? "initial" : undefined}
        animate={animate ? "enter" : undefined}
      />
    </svg>
  );

  const logoNode = (
    <div
      className="relative flex items-center justify-center shrink-0 bg-transparent text-[#0f1e36] dark:text-white"
      style={{ width: size, height: size, aspectRatio: "1/1" }}
      id="nexa-logo-container"
    >
      {!imgError ? (
        <img
          src="https://i.ibb.co/WvZGyTNv/Nexa-App.png"
          alt="Nexa Logo"
          className="block bg-transparent select-none rounded-[22%]"
          // @ts-ignore
          preserveAspectRatio="true"
          style={{
            objectFit: "contain",
            width: "100%",
            height: "100%",
            maxWidth: "100%",
            maxHeight: "100%",
            aspectRatio: "1/1",
          }}
          onError={() => setImgError(true)}
          referrerPolicy="no-referrer"
        />
      ) : (
        <div style={{ width: "100%", height: "100%" }}>{svgLogo}</div>
      )}
    </div>
  );

  if (!showText) {
    return logoNode;
  }

  return (
    <div className="flex items-center gap-3 select-none" id="nexa-logo-and-brand">
      {logoNode}
      <motion.div
        className={`${textClass} flex items-baseline tracking-normal font-sans`}
        variants={animate ? (textVariants as any) : undefined}
        initial={animate ? "initial" : undefined}
        animate={animate ? "enter" : undefined}
      >
        <span className="text-[#14213D] dark:text-white font-extrabold">Nexa</span>
        <span className="text-[#C96A3D] font-black ml-[1px]">.</span>
      </motion.div>
    </div>
  );
}
