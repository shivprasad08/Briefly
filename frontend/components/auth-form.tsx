"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import Link from "next/link";

const MotionDiv = motion.div as any;

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type AuthMode = "login" | "signup" | "forgot" | "reset";

interface AuthError {
  field?: string;
  message: string;
}

export default function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AuthError | null>(null);
  const [success, setSuccess] = useState(false);
  const [resetToken, setResetToken] = useState("");

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setError(null);
    setPassword("");
    setConfirmPassword("");
  };

  const requestReset = () => {
    setMode("forgot");
    setError(null);
    setPassword("");
    setConfirmPassword("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === "signup" || mode === "reset") {
      if (password.length < 8) {
        setError({ field: "password", message: "Password must be at least 8 characters." });
        return;
      }
      if (password !== confirmPassword) {
        setError({ field: "confirmPassword", message: "Passwords do not match." });
        return;
      }
    }

    setLoading(true);
    try {
      const endpoint = mode === "login"
        ? "/auth/login"
        : mode === "signup"
          ? "/auth/signup"
          : mode === "forgot"
            ? "/auth/password-reset/request"
            : "/auth/password-reset/confirm";
      const body = mode === "forgot"
        ? { email }
        : mode === "reset"
          ? { token: resetToken, new_password: password }
          : { email, password };
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        const detail = data?.detail ?? "Something went wrong. Please try again.";
        setError({ message: typeof detail === "string" ? detail : JSON.stringify(detail) });
        return;
      }

      if (mode === "forgot") {
        if (data.reset_token) {
          setResetToken(data.reset_token);
          setMode("reset");
          setPassword("");
          setConfirmPassword("");
          setError({ message: "Reset token created for local development. Set your new password below." });
        } else {
          setError({ message: data.message });
        }
        return;
      }

      if (mode === "reset") {
        setMode("login");
        setPassword("");
        setConfirmPassword("");
        setResetToken("");
        setError({ message: "Password reset successfully. You can sign in now." });
        return;
      }

      // Store tokens
      if (data.access_token) {
        localStorage.setItem("access_token", data.access_token);
        localStorage.setItem("isLoggedIn", "true");
        if (data.refresh_token) localStorage.setItem("refresh_token", data.refresh_token);
        if (data.user_id) localStorage.setItem("user_id", data.user_id);
        if (data.email) localStorage.setItem("user_email", data.email);
      }

      setSuccess(true);
      setTimeout(() => router.push("/dashboard"), 800);
    } catch {
      setError({ message: "Network error. Is the backend running?" });
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <MotionDiv
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-6 py-12 text-center"
      >
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-white to-white/60 flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.2)]">
          <svg className="w-8 h-8 text-black" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-white/80 text-lg font-light">Redirecting to your dashboard…</p>
      </MotionDiv>
    );
  }

  return (
    <div className="w-full max-w-sm mx-auto">
      {/* Mode Toggle */}
      <div className="flex rounded-full border border-white/10 bg-white/5 p-1 mb-8 backdrop-blur-sm">
        {(["login", "signup"] as AuthMode[]).map((m) => (
          <button
            key={m}
            onClick={() => switchMode(m)}
            className={`flex-1 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
              mode === m
                ? "bg-white text-black shadow"
                : "text-white/50 hover:text-white/80"
            }`}
          >
            {m === "login" ? "Sign In" : "Sign Up"}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <MotionDiv
          key={mode}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.25 }}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-xs text-white/50 mb-1.5 ml-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 focus:outline-none focus:border-white/30 focus:bg-white/8 transition-all"
              />
            </div>

            {/* Password */}
            {mode !== "forgot" && (
            <div>
              <label className="block text-xs text-white/50 mb-1.5 ml-1">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === "signup" || mode === "reset" ? "Min. 8 characters" : "••••••••"}
                className={`w-full bg-white/5 border rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 focus:outline-none transition-all ${
                  error?.field === "password"
                    ? "border-red-500/60 focus:border-red-500"
                    : "border-white/10 focus:border-white/30 focus:bg-white/8"
                }`}
              />
              {error?.field === "password" && (
                <p className="text-red-400 text-xs mt-1.5 ml-1">{error.message}</p>
              )}
            </div>
            )}

            {/* Confirm Password (signup only) */}
            <AnimatePresence>
              {(mode === "signup" || mode === "reset") && (
                <MotionDiv
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <label className="block text-xs text-white/50 mb-1.5 ml-1">Confirm Password</label>
                  <input
                    type="password"
                    required={mode === "signup" || mode === "reset"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat your password"
                    className={`w-full bg-white/5 border rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 focus:outline-none transition-all ${
                      error?.field === "confirmPassword"
                        ? "border-red-500/60 focus:border-red-500"
                        : "border-white/10 focus:border-white/30 focus:bg-white/8"
                    }`}
                  />
                  {error?.field === "confirmPassword" && (
                    <p className="text-red-400 text-xs mt-1.5 ml-1">{error.message}</p>
                  )}
                </MotionDiv>
              )}
            </AnimatePresence>

            {/* Generic error */}
            {error && !error.field && (
              <MotionDiv
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3"
              >
                <svg className="w-4 h-4 text-red-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <p className="text-red-300 text-sm">{error.message}</p>
              </MotionDiv>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-white text-black font-semibold text-sm hover:bg-white/90 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed mt-2 shadow-[0_0_20px_rgba(255,255,255,0.15)]"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  {mode === "login" ? "Signing in…" : mode === "signup" ? "Creating account…" : mode === "forgot" ? "Sending reset link…" : "Resetting password…"}
                </span>
              ) : mode === "login" ? (
                "Sign In"
              ) : mode === "signup" ? (
                "Create Account"
              ) : mode === "forgot" ? (
                "Send Reset Request"
              ) : (
                "Set New Password"
              )}
            </button>
          </form>

          {mode === "login" && (
            <button type="button" onClick={requestReset} className="w-full mt-4 text-xs text-white/50 hover:text-white underline">
              Forgot password?
            </button>
          )}
          {mode === "forgot" && (
            <p className="text-xs text-white/40 mt-4 text-center">Enter your registered email. In production, the reset token will be delivered by email.</p>
          )}
          {mode === "reset" && (
            <div className="mt-4 space-y-2">
              <label className="block text-xs text-white/50 ml-1">Reset token</label>
              <input value={resetToken} onChange={(e) => setResetToken(e.target.value)} required className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-xs" />
            </div>
          )}

          <p className="text-center text-xs text-white/25 mt-6">
            By continuing, you agree to our{" "}
            <Link href="#" className="underline text-white/40 hover:text-white/60 transition-colors">Terms</Link>
            {" "}and{" "}
            <Link href="#" className="underline text-white/40 hover:text-white/60 transition-colors">Privacy Policy</Link>.
          </p>
        </MotionDiv>
      </AnimatePresence>
    </div>
  );
}
