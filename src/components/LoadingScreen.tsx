// src/components/LoadingScreen.tsx
import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';

interface LoadingScreenProps {
  onComplete: () => void;
  indexedDbAvailable?: boolean;
  hasCachedData?: boolean;
  isFirstVisit?: boolean;
  dbStatus?: 'checking' | 'available' | 'unavailable' | 'migrating';
}

export const LoadingScreen = ({ 
  onComplete, 
  indexedDbAvailable = false,
  hasCachedData = false,
  isFirstVisit = true,
  dbStatus = 'checking'
}: LoadingScreenProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const dbStatusRef = useRef<HTMLDivElement>(null);
  const [displayedDbStatus, setDisplayedDbStatus] = useState(dbStatus);

  // Update displayed status with a delay to make transitions smoother
  useEffect(() => {
    if (displayedDbStatus !== dbStatus) {
      const timer = setTimeout(() => {
        setDisplayedDbStatus(dbStatus);
      }, 300); // Small delay before changing status
      return () => clearTimeout(timer);
    }
  }, [dbStatus, displayedDbStatus]);

  useEffect(() => {
    // Run animation once on mount to avoid flicker when props update
    const tl = gsap.timeline();

    // Initial setup
    gsap.set(containerRef.current, { opacity: 1 });
    gsap.set(textRef.current, { y: 20, opacity: 0 });
    gsap.set(progressBarRef.current, { scaleX: 0, transformOrigin: 'left' });
    gsap.set(statusRef.current, { opacity: 0 });
    gsap.set(dbStatusRef.current, { opacity: 0 });

    // Capture values at mount
    const startIndexedDbAvailable = indexedDbAvailable;
    const startHasCachedData = hasCachedData;
    const startIsFirstVisit = isFirstVisit;

    // Determine progress bar duration based on loading factors
    let progressDuration = 1.2; // Default
    if (startHasCachedData) progressDuration = 0.6;
    else if (startIsFirstVisit) progressDuration = startIndexedDbAvailable ? 1.5 : 2.0;
    else progressDuration = startIndexedDbAvailable ? 0.9 : 1.2;

    // Animate in
    tl.to(textRef.current, {
      y: 0,
      opacity: 1,
      duration: 0.6,
      ease: 'power2.out'
    })
    .to(statusRef.current, {
      opacity: 1,
      duration: 0.4,
      ease: 'power2.out'
    }, '-=0.3')
    .to(dbStatusRef.current, {
      opacity: 1,
      duration: 0.4,
      ease: 'power2.out'
    }, '-=0.2')
    .to(progressBarRef.current, {
      scaleX: 1,
      duration: progressDuration,
      ease: 'power2.inOut'
    }, '-=0.2')
    .to(statusRef.current, {
      opacity: 0,
      duration: 0.3,
      ease: 'power2.in'
    }, '+=0.2')
    .to(dbStatusRef.current, {
      opacity: 0,
      duration: 0.3,
      ease: 'power2.in'
    }, '-=0.2')
    .to(textRef.current, {
      y: -20,
      opacity: 0,
      duration: 0.5,
      ease: 'power2.in'
    }, '-=0.2')
    .to(containerRef.current, {
      opacity: 0,
      duration: 0.8,
      ease: 'power2.inOut',
      onComplete
    });

    return () => {
      tl.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Determine status message based on loading factors
  const getStatusMessage = () => {
    if (hasCachedData) return "Loading from cache...";
    if (isFirstVisit) {
      return indexedDbAvailable 
        ? "First time setup (using local storage)" 
        : "First time setup (initializing database)";
    }
    return indexedDbAvailable 
      ? "Using local storage for faster loading" 
      : "Loading data...";
  };

  // Get database status message
  const getDbStatusMessage = () => {
    switch (displayedDbStatus) {
      case 'checking':
        return "Checking database...";
      case 'migrating':
        return "Updating database schema...";
      case 'available':
        return "Database ready";
      case 'unavailable':
        return "Database unavailable";
      default:
        return "";
    }
  };

  // Get database status color
  const getDbStatusColor = () => {
    switch (displayedDbStatus) {
      case 'checking':
        return "text-[#8b7467]";
      case 'migrating':
        return "text-[#d4a574]";
      case 'available':
        return "text-[#2c7f68]";
      case 'unavailable':
        return "text-[#b15b62]";
      default:
        return "text-[#8b7467]";
    }
  };

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#fffcf7]"
    >
      <div className="text-center">
        <div ref={textRef} className="mb-8">
          <h1 className="text-4xl font-bold text-[#5f4b3c] mb-2">Train Tracker</h1>
          <p className="text-[#8b7467]">Loading real-time data...</p>
        </div>
        
        <div ref={statusRef} className="mb-4 text-sm text-[#8b7467]">
          {getStatusMessage()}
        </div>
        
        <div ref={dbStatusRef} className={`mb-6 text-xs ${getDbStatusColor()}`}>
          {getDbStatusMessage()}
        </div>
        
        <div className="relative h-1 w-64 overflow-hidden rounded-full bg-[#e8dcc6]">
          <div 
            ref={progressBarRef}
            className="absolute h-full w-full bg-gradient-to-r from-[#d4a574] to-[#b08968]"
          />
        </div>
        
        <div className="mt-8 flex justify-center space-x-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-2 w-2 rounded-full bg-[#d4a574] animate-pulse"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};