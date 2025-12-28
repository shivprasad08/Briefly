"use client";

import { useEffect, useRef, useState } from "react";
import "locomotive-scroll/dist/locomotive-scroll.css";

export default function LocomotiveScrollProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!scrollRef.current || !isClient) return;

    let locomotiveScroll: any;

    const initScroll = async () => {
      const LocomotiveScroll = (await import("locomotive-scroll")).default;
      
      console.log('🚂 Initializing Locomotive Scroll...');
      
      locomotiveScroll = new LocomotiveScroll({
        el: scrollRef.current!,
        smooth: true,
        multiplier: 1,
        class: "is-reveal",
        reloadOnContextChange: true,
        resetNativeScroll: true,
        lerp: 0.05,
        smartphone: {
          smooth: true,
          lerp: 0.05,
        },
        tablet: {
          smooth: true,
          lerp: 0.05,
        },
      });

      console.log('✅ Locomotive Scroll initialized successfully');

      // Update scroll after initialization and on window resize
      setTimeout(() => {
        if (locomotiveScroll) {
          locomotiveScroll.update();
          console.log('🔄 Locomotive Scroll updated');
        }
      }, 500);
      
      // Additional update after fonts/images load
      window.addEventListener('load', () => {
        if (locomotiveScroll) {
          locomotiveScroll.update();
          console.log('🖼️ Locomotive Scroll updated after page load');
        }
      });
      
      const handleResize = () => {
        try {
          if (locomotiveScroll && typeof locomotiveScroll.update === 'function') {
            locomotiveScroll.update();
          }
        } catch (err) {
          console.error('LocomotiveScroll update error:', err);
        }
      };

      window.addEventListener('resize', handleResize);

      // Cleanup resize listener
      return () => {
        window.removeEventListener('resize', handleResize);
      };
    };

    initScroll();

    return () => {
      if (locomotiveScroll) locomotiveScroll.destroy();
    };
  }, [isClient]);

  return (
    <div data-scroll-container ref={scrollRef}>
      {children}
    </div>
  );
}
