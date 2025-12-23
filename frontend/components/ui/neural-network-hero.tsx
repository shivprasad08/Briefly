"use client";

import React, { useEffect, useRef } from "react";

// Use motion.div directly for proper MotionValue typing

interface AnimatedGradientBackgroundProps {
  /** Initial size of the radial gradient, defining the starting width. */
  startingGap?: number;
  /** Enables or disables the breathing animation effect. */
  Breathing?: boolean;
  /** Array of colors to use in the radial gradient. */
  gradientColors?: string[];
  /** Array of percentage stops corresponding to each color in `gradientColors`. */
  gradientStops?: number[];
  /** Speed of the breathing animation. Lower values result in slower animation. */
  animationSpeed?: number;
  /** Maximum range for the breathing animation in percentage points. */
  breathingRange?: number;
  /** Additional inline styles for the gradient container. */
  containerStyle?: React.CSSProperties;
  /** Additional class names for the gradient container. */
  containerClassName?: string;
  /** Additional top offset for the gradient container. */
  topOffset?: number;
}

const AnimatedGradientBackground: React.FC<AnimatedGradientBackgroundProps> = ({
  startingGap = 125,
  Breathing = false,
  gradientColors = ["#0A0A0A", "#2979FF", "#FF80AB", "#FF6D00", "#FFD600", "#00E676", "#3D5AFE"],
  gradientStops = [35, 50, 60, 70, 80, 90, 100],
  animationSpeed = 0.02,
  breathingRange = 5,
  containerStyle = {},
  topOffset = 0,
  containerClassName = "",
}) => {
  if (gradientColors.length !== gradientStops.length) {
    throw new Error(
      `GradientColors and GradientStops must have the same length. Received gradientColors length: ${gradientColors.length}, gradientStops length: ${gradientStops.length}`
    );
  }

  const containerRef = useRef<HTMLDivElement | null>(null);
  // No parallax; static gradient background

  useEffect(() => {
    let animationFrame: number;
    let width = startingGap;
    let directionWidth = 1;

    const animateGradient = () => {
      if (width >= startingGap + breathingRange) directionWidth = -1;
      if (width <= startingGap - breathingRange) directionWidth = 1;

      if (!Breathing) directionWidth = 0;
      width += directionWidth * animationSpeed;

      const gradientStopsString = gradientStops
        .map((stop, index) => `${gradientColors[index]} ${stop}%`)
        .join(", ");

      const gradient = `radial-gradient(${width}% ${width + topOffset}% at 50% 20%, ${gradientStopsString})`;

      if (containerRef.current) {
        containerRef.current.style.background = gradient;
      }

      animationFrame = requestAnimationFrame(animateGradient);
    };

    animationFrame = requestAnimationFrame(animateGradient);

    return () => cancelAnimationFrame(animationFrame);
  }, [startingGap, Breathing, gradientColors, gradientStops, animationSpeed, breathingRange, topOffset]);

  return (
    <div
      className={`absolute inset-0 overflow-hidden ${containerClassName}`}
      aria-hidden={true}
    >
      <div ref={containerRef} style={containerStyle} className="absolute inset-0" />
    </div>
  );
};

interface HeroProps {
  title: string;
  description: string;
  badgeText?: string;
  badgeLabel?: string;
  ctaButtons?: Array<{ text: string; href: string; primary?: boolean }>;
  microDetails?: Array<string>;
}

export default function Hero({
  title,
  description,
  badgeText = "Generative Surfaces",
  badgeLabel = "New",
  ctaButtons = [
    { text: "Get started", href: "#get-started", primary: true },
    { text: "View showcase", href: "#showcase" },
  ],
  microDetails = ["Low‑weight font", "Tight tracking", "Subtle motion"],
}: HeroProps) {
  // No parallax; static content container
  return (
    <section 
      className="relative h-screen w-full overflow-hidden bg-black text-white"
    >
      <AnimatedGradientBackground Breathing startingGap={110} breathingRange={6} topOffset={4} />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60" aria-hidden />

      <div 
        className="relative z-10 mx-auto flex h-full max-w-6xl flex-col justify-center gap-6 px-6 py-16 sm:gap-8 sm:px-10 lg:px-14"
      >
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 backdrop-blur-sm">
          <span className="text-[10px] font-light uppercase tracking-[0.08em] text-white/70">{badgeLabel}</span>
          <span className="h-1 w-1 rounded-full bg-white/40" />
          <span className="text-xs font-light tracking-tight text-white/80">{badgeText}</span>
        </div>

        <h1 
          className="max-w-3xl text-left text-5xl font-extralight leading-[1.05] tracking-tight sm:text-6xl md:text-7xl"
        >
          {title.includes('Briefly') ? (
            (() => {
              const parts = title.split('Briefly');
              return (
                <>
                  {parts[0]}
                  <span className="font-semibold">Briefly</span>
                  {parts.slice(1).join('Briefly')}
                </>
              );
            })()
          ) : (
            title
          )}
        </h1>

        <p 
          className="max-w-2xl text-left text-base font-light leading-relaxed tracking-tight text-white/80 sm:text-lg"
        >
          {description}
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          {ctaButtons.map((button, index) => (
            <a
              key={index}
              href={button.href}
              className={`rounded-2xl border border-white/10 px-5 py-3 text-sm font-light tracking-tight transition-colors focus:outline-none focus:ring-2 focus:ring-white/30 duration-300 ${
                button.primary
                  ? "bg-white/10 text-white backdrop-blur-sm hover:bg-white/20"
                  : "text-white/80 hover:bg-white/5"
              }`}
            >
              {button.text}
            </a>
          ))}
        </div>

        <ul className="mt-6 flex flex-wrap gap-5 text-xs font-extralight tracking-tight text-white/60">
          {microDetails.map((detail, index) => (
            <li key={index} className="flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-white/40" /> {detail}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

