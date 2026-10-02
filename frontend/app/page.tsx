"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Hero from "@/components/ui/neural-network-hero";
import { Footer7 } from "@/components/ui/footer";
import { CanvasRevealEffect } from "@/components/ui/canvas-reveal-effect";
import AuthForm from "@/components/auth-form";
import { motion } from "framer-motion";

const MotionDiv = motion.div as any;

export default function HomePage() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null); // null = loading

  useEffect(() => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("access_token");
      setIsLoggedIn(Boolean(token));
    }
  }, []);

  const handleGoToDashboard = () => router.push("/dashboard");

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("user_id");
    localStorage.removeItem("user_email");
    setIsLoggedIn(false);
  };

  return (
    <div className="min-h-screen bg-black text-white relative">
      {/* ── Hero Section ─────────────────────────────────────────── */}
      <section className="relative" data-scroll-section>
        <Hero
          title="Briefly — Meeting insights, summaries, and answers without the busywork."
          description="Upload meeting notes and PDFs. Get instant insights, comprehensive summaries, and intelligent answers powered by AI."
          badgeText="Contextual AI"
          ctaButtons={
            isLoggedIn
              ? [
                  { text: "Go to Dashboard →", href: "#auth", primary: true },
                ]
              : [
                  { text: "Get started", href: "#auth", primary: true },
                  { text: "Sign in", href: "#auth" },
                ]
          }
          microDetails={[]}
        />
      </section>

      {/* ── Auth / CTA Section ───────────────────────────────────── */}
      <section
        id="auth"
        className="border-t border-neutral-800 relative overflow-hidden"
        style={{ minHeight: "100vh" }}
        data-scroll-section
      >
        {/* Full-screen twinkling dot-matrix canvas — same as original sign-in page */}
        <div className="absolute inset-0" style={{ zIndex: 0 }}>
          <CanvasRevealEffect
            animationSpeed={3}
            containerClassName="bg-black"
            colors={[
              [255, 255, 255],
              [255, 255, 255],
            ]}
            dotSize={6}
            reverse={false}
          />
          {/* radial vignette so the center is readable */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(0,0,0,0.85)_0%,_transparent_70%)]" />
          <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-black to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black to-transparent" />
        </div>

        <div
          className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-16 sm:pt-20 md:pt-28 pb-20"
          style={{ zIndex: 10 }}
        >
          {/* Skeleton while auth state loads */}
          {isLoggedIn === null && (
            <div className="flex justify-center">
              <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
            </div>
          )}

          {/* ── Logged-in state ── */}
          {isLoggedIn === true && (
            <MotionDiv
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="flex flex-col items-center gap-8 text-center max-w-xl mx-auto"
            >
              {/* Welcome back card */}
              <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-md">
                <div className="w-14 h-14 mx-auto mb-5 rounded-full bg-gradient-to-br from-blue-500/30 to-purple-500/30 border border-white/10 flex items-center justify-center">
                  <svg
                    className="w-7 h-7 text-white/80"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                    />
                  </svg>
                </div>

                <h2 className="text-2xl font-semibold text-white mb-2">
                  Welcome back!
                </h2>
                <p className="text-white/50 text-sm mb-8">
                  You&apos;re already signed in. Jump back into your notebooks.
                </p>

                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button
                    onClick={handleGoToDashboard}
                    className="flex-1 sm:flex-none px-8 py-3 rounded-xl bg-white text-black font-semibold text-sm hover:bg-white/90 active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(255,255,255,0.12)]"
                  >
                    Go to Dashboard →
                  </button>
                  <button
                    onClick={handleLogout}
                    className="flex-1 sm:flex-none px-8 py-3 rounded-xl border border-white/10 text-white/50 text-sm hover:text-white hover:border-white/20 transition-all"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            </MotionDiv>
          )}

          {/* ── Logged-out state ── */}
          {isLoggedIn === false && (
            <MotionDiv
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="max-w-sm mx-auto"
            >
              <div className="text-center mb-8">
                <h2 className="text-3xl font-semibold text-white mb-2">
                  Get started free
                </h2>
                <p className="text-white/40 text-sm">
                  Create an account or sign in to access your notebooks.
                </p>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md">
                <AuthForm />
              </div>
            </MotionDiv>
          )}
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <section
        data-scroll-section
        className="bg-black border-t border-neutral-800 relative z-20"
      >
        <Footer7 />
      </section>
    </div>
  );
}