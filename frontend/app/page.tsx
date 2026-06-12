"use client";

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SignInPage } from '@/components/sign-in-flow-1';
import Hero from '@/components/ui/neural-network-hero';
import { Footer7 } from '@/components/ui/footer';
import { CanvasRevealEffect } from '@/components/ui/canvas-reveal-effect';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // If user is authenticated on mount, redirect to dashboard
    if (typeof window !== 'undefined') {
      const isLoggedIn = localStorage.getItem('isLoggedIn');
      if (isLoggedIn === 'true') {
        router.push('/dashboard');
      }
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-black text-white relative">
      <section className="relative" data-scroll-section>
        <Hero
          title="Briefly — Meeting insights, summaries, and answers without the busywork."
          description="Upload meeting notes and PDFs. Get instant insights, comprehensive summaries, and intelligent answers powered by AI."
          badgeText="Contextual AI"
          ctaButtons={[{ text: 'Create a session', href: '#sessions', primary: true }, { text: 'View sessions', href: '#sessions' }]}
          microDetails={[]}
        />
      </section>

      <section id="sessions" className="bg-transparent border-t border-neutral-800 pb-12 relative overflow-hidden" data-scroll-section>
        {/* Force effect to cover viewport */}
        <div style={{position: 'absolute', top: 0, left: 0, width: '100vw', height: '100%', zIndex: 0, pointerEvents: 'none'}}>
          <CanvasRevealEffect
            animationSpeed={3}
            containerClassName="bg-black"
            colors={[[255, 255, 255], [255, 255, 255]]}
            dotSize={6}
            reverse={false}
          />
        </div>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12 md:pt-16 pb-0 relative" style={{zIndex: 10}}>
          <SignInPage />
        </div>
      </section>

      <section data-scroll-section className="bg-black border-t border-neutral-800 relative z-20">
        <Footer7 />
      </section>
    </div>
  );
}