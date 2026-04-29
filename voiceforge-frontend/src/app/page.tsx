"use client";
import Navbar from '../components/Navbar';
import Link from 'next/link';
import { ArrowRight, Play, Code2, Zap } from 'lucide-react';
import { motion } from 'framer-motion';

// Premium grain noise for texture
const NoiseOverlay = () => (
  <div className="absolute inset-0 w-full h-full opacity-[0.02] mix-blend-overlay pointer-events-none z-0">
    <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className="w-full h-full filter-noise">
      <filter id="noiseFilter">
        <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" stitchTiles="stitch"/>
      </filter>
      <rect width="100%" height="100%" filter="url(#noiseFilter)"/>
    </svg>
  </div>
);

// Diagonal Dotted Water Ripple Effect
const DottedWaveBackground = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 flex items-center justify-center">
    {/* Soft ambient glows behind the waves */}
    <div className="absolute top-[-10%] left-[-5%] w-[60vw] h-[60vw] bg-gradient-to-br from-orange-400/30 to-transparent rounded-full blur-[140px] animate-fluid opacity-80" />
    <div className="absolute bottom-[-10%] right-[-10%] w-[70vw] h-[70vw] bg-gradient-to-tl from-amber-400/20 to-transparent rounded-full blur-[150px] animate-fluid-alt opacity-70" />

    {/* Rotated container for diagonal waves */}
    <div className="absolute w-[300vw] h-[300vh] rotate-[-25deg] top-[20%] left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-70">
      {[...Array(14)].map((_, i) => {
        // Spread waves vertically across the rotated container
        const yOffset = i * 80 - 500; 
        const isReverse = i % 2 !== 0;
        const animationClass = isReverse ? 'animate-wave-slide-reverse' : 'animate-wave-slide';
        // Randomize speed slightly for organic feel
        const speed = 15 + (i % 4) * 3; 
        
        return (
          <div 
            key={i} 
            className="absolute left-1/2 -translate-x-1/2 w-[4000px] h-[500px]"
            style={{ top: `${yOffset}px` }}
          >
            <svg 
              className={`absolute top-0 left-0 w-full h-full ${animationClass}`}
              style={{ animationDuration: `${speed}s` }}
              width="4000" height="500" 
              viewBox="0 0 4000 500" 
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id={`grad-wave-${i}`} x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="transparent" />
                  <stop offset="20%" stopColor="rgba(249, 115, 22, 0.1)" />
                  <stop offset="50%" stopColor="rgba(249, 115, 22, 0.5)" />
                  <stop offset="80%" stopColor="rgba(249, 115, 22, 0.1)" />
                  <stop offset="100%" stopColor="transparent" />
                </linearGradient>
              </defs>
              <path
                // A perfectly repeating cubic bezier wave every 1000 pixels
                d="M 0,250 C 250,150 750,350 1000,250 C 1250,150 1750,350 2000,250 C 2250,150 2750,350 3000,250 C 3250,150 3750,350 4000,250"
                fill="none"
                stroke={`url(#grad-wave-${i})`}
                strokeWidth={3 + (i % 2) * 1.5}
                strokeDasharray="6 12"
                strokeLinecap="round"
              />
            </svg>
          </div>
        );
      })}
    </div>
  </div>
);

import React, { useState, useRef } from 'react';

export default function Home() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(4);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || !isFinite(seconds) || seconds < 0) return "0:04";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };
  
  const handlePlayDemo = async () => {
    if (isPlaying) {
      if (audioRef.current) {
        audioRef.current.pause();
        setIsPlaying(false);
        if (isFinite(audioRef.current.duration)) {
          setTimeLeft(audioRef.current.duration);
        }
      }
      return;
    }

    setIsLoading(true);
    
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio('/voices/heroleo.wav');
      }
      const audio = audioRef.current;
      
      audio.onloadedmetadata = () => {
        if (isFinite(audio.duration)) {
          setTimeLeft(audio.duration);
        }
      };

      audio.ontimeupdate = () => {
        if (isFinite(audio.duration)) {
          setTimeLeft(Math.max(0, audio.duration - audio.currentTime));
        }
      };

      audio.onplay = () => {
        setIsLoading(false);
        setIsPlaying(true);
      };

      audio.onended = () => {
        setIsPlaying(false);
        if (isFinite(audio.duration)) {
          setTimeLeft(audio.duration);
        }
      };
      
      await audio.play();

    } catch (error) {
      console.error("Demo play failed:", error);
      setIsLoading(false);
      setIsPlaying(false);
      alert("Failed to play demo audio. Please check your connection.");
    }
  };

  return (
    <div className="min-h-[200vh] bg-[#FCFCFD] font-sans relative overflow-x-hidden">
      <NoiseOverlay />
      <div className="absolute inset-0 w-full h-full pointer-events-none z-0">
        <DottedWaveBackground />
        
        {/* Dynamic Diagonal Light Beams from Top */}
        <div className="absolute top-[-20%] left-[-10%] w-[120vw] h-[80vh] bg-gradient-to-br from-orange-400/30 via-orange-300/10 to-transparent rotate-[-15deg] blur-[140px] pointer-events-none z-0 animate-[pulse_8s_ease-in-out_infinite]" />
        <div className="absolute top-[-10%] right-[-10%] w-[100vw] h-[80vh] bg-gradient-to-bl from-amber-400/20 via-orange-200/10 to-transparent rotate-[10deg] blur-[140px] pointer-events-none z-0 animate-[pulse_12s_ease-in-out_infinite_2s]" />
      </div>
      
      <Navbar />

      {/* Minimal Hero Section */}
      <main className="pt-52 pb-32 px-6 max-w-7xl mx-auto flex flex-col items-center text-center relative z-10">
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-white/30 border border-white/60 shadow-[0_12px_24px_-8px_rgba(0,0,0,0.08),_inset_0_1px_1px_rgba(255,255,255,0.9),_inset_0_-1px_1px_rgba(255,255,255,0.4)] mb-12 backdrop-blur-2xl saturate-150 relative overflow-hidden group"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 to-amber-500/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)] animate-pulse" />
          </div>
          <span className="text-sm font-semibold text-neutral-800 tracking-wide uppercase">VoiceForge Studio 2.0</span>
        </motion.div>

        <motion.h1 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }}
          className="text-6xl md:text-[6rem] font-medium tracking-tight text-[#0A0A0A] mb-8 max-w-5xl leading-[1.05]"
        >
          Pioneering the <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 via-amber-500 to-orange-400 italic pr-4">future</span><br />
          of digital voice.
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.2 }}
          className="text-xl md:text-2xl text-neutral-500 max-w-3xl mb-14 leading-relaxed font-light"
        >
          Generate breathtaking, cinematic voiceovers in seconds. Designed for content creators, marketers, and visionaries.
        </motion.p>

        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.3 }}
          className="flex flex-col sm:flex-row gap-4 items-center justify-center w-full"
        >
          <Link href="/register" className="h-14 px-8 rounded-full bg-black text-white font-medium text-lg flex items-center justify-center gap-2 hover:bg-neutral-800 transition-all hover:scale-105 duration-300 shadow-[0_10px_40px_-10px_rgba(249,115,22,0.3)]">
            Start Creating Free <Play className="w-5 h-5 opacity-70 ml-1" fill="currentColor" />
          </Link>
          <Link href="/samples" className="h-14 px-8 rounded-full bg-white/60 backdrop-blur-lg text-black border border-black/10 font-medium text-lg flex items-center justify-center gap-2 hover:bg-white transition-all hover:scale-105 duration-300 shadow-sm">
            Listen to Samples
          </Link>
        </motion.div>

        {/* Elegant 12k Credits Badge */}
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 0.6 }}
          className="mt-8 flex items-center justify-center gap-2 text-sm font-medium"
        >
          <div className="w-5 h-5 rounded-full bg-orange-100 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-orange-500"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"></path></svg>
          </div>
          <span className="text-neutral-500">Includes <span className="text-neutral-900 font-semibold">12,000 free credits</span> every month.</span>
        </motion.div>

        {/* Premium Layered Creator Demo Section */}
        <motion.div 
          initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.4 }}
          className="mt-24 w-full max-w-3xl mx-auto relative perspective-1000"
        >
          <div className="absolute inset-0 bg-gradient-to-b from-orange-500/10 to-transparent rounded-[40px] blur-3xl opacity-50 transition-opacity duration-700" />
          
          {/* Main Background Editor Panel */}
          <div className="relative w-full rounded-[2.5rem] bg-white/60 border border-white/80 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1),_inset_0_1px_1px_rgba(255,255,255,1)] backdrop-blur-3xl p-8 md:p-12 pb-24 ring-1 ring-black/5 z-10 transition-transform duration-700 hover:scale-[1.01]">
            <div className="flex gap-4 md:gap-6">
              <div className="w-10 h-10 rounded-full bg-orange-100/80 flex items-center justify-center shrink-0 mt-1 shadow-sm border border-orange-200">
                <span className="text-orange-700 text-base font-semibold">L</span>
              </div>
              <p className="text-neutral-700 font-medium text-xl md:text-3xl leading-[1.6] tracking-tight">
                <span className="text-orange-600 font-semibold mr-3">Narrator:</span>
                Strap in, because this next jump is going to be absolutely legendary! Here we go!
              </p>
            </div>
          </div>

          {/* Floating Voice Profile Panel (Top Right) - High Contrast Shadow */}
          <div className="absolute -top-8 -right-4 md:-right-12 z-20 rounded-2xl bg-white/95 border border-white shadow-[0_30px_60px_-10px_rgba(0,0,0,0.25),_inset_0_1px_1px_rgba(255,255,255,1)] backdrop-blur-2xl p-3 flex items-center gap-4 pr-6 animate-float" style={{ animationDelay: '0.5s' }}>
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-50 to-white shadow-inner border border-black/5 flex items-center justify-center text-orange-600">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line></svg>
            </div>
            <div>
              <h3 className="font-semibold text-sm md:text-base text-neutral-900 tracking-tight">Leo</h3>
              <p className="text-xs text-neutral-500 font-medium mt-0.5">Adventurous & Bold</p>
            </div>
          </div>

          {/* Floating Audio Player (Bottom Center/Left) - High Contrast Shadow */}
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 md:translate-x-0 md:-left-8 w-[95%] md:w-[600px] z-30 rounded-full bg-white/95 border border-white shadow-[0_40px_80px_-15px_rgba(0,0,0,0.3),_inset_0_1px_1px_rgba(255,255,255,1)] backdrop-blur-3xl p-2.5 pr-6 flex items-center gap-4 animate-float">
            {/* Play Button */}
            <button 
              onClick={handlePlayDemo}
              disabled={isLoading}
              className={`w-12 h-12 md:w-14 md:h-14 shrink-0 rounded-full bg-gradient-to-tr from-orange-500 to-amber-400 text-white shadow-[0_0_20px_rgba(249,115,22,0.4)] flex items-center justify-center transition-transform group ${isLoading ? 'opacity-80' : 'hover:scale-105'}`}
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : isPlaying ? (
                <div className="w-4 h-4 md:w-5 md:h-5 bg-white rounded-sm group-hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.8)] transition-all" />
              ) : (
                <Play className="w-5 h-5 md:w-6 md:h-6 ml-1 text-white group-hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.8)] transition-all" fill="currentColor" />
              )}
            </button>
            
            {/* Smooth Animated Visualizer */}
            <div className="flex-1 flex items-end gap-1 h-8 opacity-90">
              {[...Array(36)].map((_, i) => (
                <div 
                  key={i} 
                  className={`flex-1 bg-gradient-to-t from-orange-400 to-amber-300 rounded-full h-full transition-all duration-300 ${isPlaying ? 'animate-audio-wave' : 'scale-y-[0.15]'}`}
                  style={{ 
                    animationDuration: `${1.2 + Math.random() * 1.5}s`,
                    animationDelay: `${Math.random() * -3}s`,
                    transformOrigin: 'bottom'
                  }} 
                />
              ))}
            </div>
            
            <span className="text-xs md:text-sm font-bold text-neutral-400 tracking-wider w-8 text-right shrink-0">{formatTime(timeLeft)}</span>
          </div>

        </motion.div>

        {/* Feature Grid Below Hero */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
          className="mt-40 max-w-6xl mx-auto w-full relative z-10"
        >
          <div className="grid md:grid-cols-3 gap-6 text-left">
            {/* Feature Card 1 */}
            <div className="relative p-8 rounded-[2rem] bg-white/40 border border-white/60 shadow-[0_12px_40px_-16px_rgba(0,0,0,0.05),_inset_0_1px_1px_rgba(255,255,255,1)] backdrop-blur-2xl hover:bg-white/60 transition-all duration-500 group overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-400 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="w-12 h-12 rounded-2xl bg-white shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-black/5 flex items-center justify-center text-orange-500 mb-6 group-hover:scale-110 transition-transform duration-500 group-hover:shadow-[0_8px_24px_rgba(249,115,22,0.15)]">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
              </div>
              <h3 className="text-xl font-semibold mb-3 text-neutral-900 tracking-tight">Cinematic Quality</h3>
              <p className="text-neutral-500 leading-relaxed font-light text-base">Elevate your YouTube videos, TikToks, and podcasts with studio-grade voices that captivate your audience instantly.</p>
            </div>

            {/* Feature Card 2 */}
            <div className="relative p-8 rounded-[2rem] bg-white/40 border border-white/60 shadow-[0_12px_40px_-16px_rgba(0,0,0,0.05),_inset_0_1px_1px_rgba(255,255,255,1)] backdrop-blur-2xl hover:bg-white/60 transition-all duration-500 group overflow-hidden mt-6 md:mt-0">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="w-12 h-12 rounded-2xl bg-white shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-black/5 flex items-center justify-center text-amber-500 mb-6 group-hover:scale-110 transition-transform duration-500 group-hover:shadow-[0_8px_24px_rgba(251,191,36,0.15)]">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4"></path><path d="M12 18v4"></path><path d="M4.93 4.93l2.83 2.83"></path><path d="M16.24 16.24l2.83 2.83"></path><path d="M2 12h4"></path><path d="M18 12h4"></path><path d="M4.93 19.07l2.83-2.83"></path><path d="M16.24 7.76l2.83-2.83"></path></svg>
              </div>
              <h3 className="text-xl font-semibold mb-3 text-neutral-900 tracking-tight">Instant Generation</h3>
              <p className="text-neutral-500 leading-relaxed font-light text-base">Never wait for rendering. Type your script and instantly hear it spoken back to you with perfect pacing and clarity.</p>
            </div>

            {/* Feature Card 3 */}
            <div className="relative p-8 rounded-[2rem] bg-white/40 border border-white/60 shadow-[0_12px_40px_-16px_rgba(0,0,0,0.05),_inset_0_1px_1px_rgba(255,255,255,1)] backdrop-blur-2xl hover:bg-white/60 transition-all duration-500 group overflow-hidden mt-6 md:mt-0">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="w-12 h-12 rounded-2xl bg-white shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-black/5 flex items-center justify-center text-orange-600 mb-6 group-hover:scale-110 transition-transform duration-500 group-hover:shadow-[0_8px_24px_rgba(234,88,12,0.15)]">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
              </div>
              <h3 className="text-xl font-semibold mb-3 text-neutral-900 tracking-tight">Emotion Control</h3>
              <p className="text-neutral-500 leading-relaxed font-light text-base">Direct your AI actor. Add pauses, whispers, and dramatic shifts in tone to perfectly match the mood of your content.</p>
            </div>
          </div>
        </motion.div>
      </main>

      {/* Detailed Capabilities Section */}
      <section className="py-32 bg-white w-full relative z-20 border-t border-black/5" id="use-cases">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div 
            initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }} transition={{ duration: 0.8 }}
            className="text-center mb-24"
          >
            <h2 className="text-4xl md:text-5xl font-semibold text-neutral-900 tracking-tight mb-6">The complete toolkit for audio creators.</h2>
            <p className="text-lg md:text-xl text-neutral-500 max-w-3xl mx-auto font-light leading-relaxed">
              We've engineered the world's most advanced AI audio models into an intuitive platform, giving you unprecedented, professional control over how your content sounds.
            </p>
          </motion.div>

          {/* Row 1: Text-to-Speech */}
          <motion.div 
            initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }} transition={{ duration: 0.8 }}
            className="flex flex-col md:flex-row items-center gap-16 mb-40"
          >
            <div className="flex-1 text-left">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-50 border border-orange-100 text-orange-700 text-sm font-semibold mb-6 shadow-sm">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line></svg>
                Text-to-Speech Engine
              </div>
              <h3 className="text-3xl md:text-4xl font-semibold text-neutral-900 mb-6 tracking-tight leading-[1.2]">Ultra-realistic voices that breathe life into text.</h3>
              <p className="text-lg text-neutral-500 leading-relaxed font-light mb-8">
                Go beyond robotic generation. Our proprietary neural engine understands deep context, punctuation, and subtle emotion, delivering studio-grade voiceovers that are virtually indistinguishable from human narration.
              </p>
              <ul className="space-y-5">
                <li className="flex items-start gap-4">
                  <div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center shrink-0 mt-0.5">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-orange-600"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  </div>
                  <span className="text-neutral-700 font-medium text-lg">Over 1,200 unique voice profiles across 40 languages.</span>
                </li>
                <li className="flex items-start gap-4">
                  <div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center shrink-0 mt-0.5">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-orange-600"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  </div>
                  <span className="text-neutral-700 font-medium text-lg">Sub-second generation for real-time creative workflows.</span>
                </li>
              </ul>
            </div>
            
            {/* UI Mockup 1: TTS UI */}
            <div className="flex-1 w-full relative">
              <div className="absolute inset-0 bg-gradient-to-tr from-orange-400/20 to-amber-300/20 rounded-[2.5rem] blur-3xl transform rotate-3" />
              <div className="relative w-full aspect-square md:aspect-auto md:h-[400px] bg-neutral-50 rounded-[2.5rem] border border-black/5 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] overflow-hidden flex flex-col p-8 group">
                <div className="w-full h-32 bg-white rounded-2xl shadow-sm border border-black/5 p-5 mb-6">
                  <div className="h-4 w-3/4 bg-neutral-100 rounded-full mb-3" />
                  <div className="h-4 w-full bg-neutral-100 rounded-full mb-3" />
                  <div className="h-4 w-5/6 bg-neutral-100 rounded-full mb-6" />
                  <div className="flex justify-between items-center">
                    <div className="flex -space-x-2">
                      <div className="w-8 h-8 rounded-full border-2 border-white bg-orange-100" />
                      <div className="w-8 h-8 rounded-full border-2 border-white bg-amber-100" />
                    </div>
                    <div className="h-8 w-24 bg-black rounded-full" />
                  </div>
                </div>
                {/* Visualizer */}
                <div className="flex-1 bg-white rounded-2xl shadow-sm border border-black/5 p-6 flex flex-col justify-end relative overflow-hidden">
                   <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-400 to-transparent group-hover:opacity-100 opacity-50 transition-opacity" />
                   <div className="flex items-end gap-1 h-20 opacity-80 w-full">
                    {[...Array(24)].map((_, i) => (
                      <div key={i} className="flex-1 bg-orange-400 rounded-t-sm transition-all duration-700 group-hover:animate-audio-wave" style={{ height: `${20 + (Math.sin(i) * 30) + 40}%`, animationDelay: `${i * 0.05}s` }} />
                    ))}
                   </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Row 2: Real-time Conversational Voice (Coming Soon) */}
          <motion.div 
            initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }} transition={{ duration: 0.8 }}
            className="flex flex-col md:flex-row-reverse items-center gap-16 mb-40"
          >
            <div className="flex-1 text-left">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-50 border border-orange-100 text-orange-700 text-sm font-semibold mb-6 shadow-sm">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line></svg>
                Real-Time Voice API
                <span className="ml-2 px-2.5 py-0.5 bg-black text-white text-[10px] rounded-full uppercase tracking-wider">Coming Soon</span>
              </div>
              <h3 className="text-3xl md:text-4xl font-semibold text-neutral-900 mb-6 tracking-tight leading-[1.2]">Bidirectional, conversational AI in milliseconds.</h3>
              <p className="text-lg text-neutral-500 leading-relaxed font-light mb-8">
                Build the next generation of voice agents. Our upcoming bidirectional WebSocket API allows you to stream audio to and from our models with latency so low, it feels exactly like a natural human conversation.
              </p>
              <ul className="space-y-5">
                <li className="flex items-start gap-4">
                  <div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center shrink-0 mt-0.5">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-orange-600"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  </div>
                  <span className="text-neutral-700 font-medium text-lg">Full-duplex audio streaming with intelligent interruption handling.</span>
                </li>
                <li className="flex items-start gap-4">
                  <div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center shrink-0 mt-0.5">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-orange-600"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  </div>
                  <span className="text-neutral-700 font-medium text-lg">Sub-300ms round-trip latency for seamless interaction.</span>
                </li>
              </ul>
            </div>
            
            {/* UI Mockup 2: Bidirectional AI Orb (White Background) */}
            <div className="flex-1 w-full relative">
              <div className="absolute inset-0 bg-gradient-to-tr from-orange-400/20 to-amber-300/20 rounded-[2.5rem] blur-3xl transform -rotate-3" />
              <div className="relative w-full aspect-square md:aspect-auto md:h-[400px] bg-neutral-50 rounded-[2.5rem] border border-black/5 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] overflow-hidden flex items-center justify-center group">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(249,115,22,0.05)_0%,transparent_70%)]" />
                
                {/* AI Voice Orb */}
                <div className="relative flex items-center justify-center">
                  {/* Outer Pulsing Rings */}
                  <div className="absolute w-56 h-56 rounded-full border border-orange-400/20 group-hover:scale-110 transition-transform duration-[2s] ease-in-out opacity-0 group-hover:opacity-100" />
                  <div className="absolute w-44 h-44 rounded-full border border-orange-400/40 group-hover:scale-105 transition-transform duration-1000 ease-in-out delay-100 opacity-0 group-hover:opacity-100" />
                  
                  {/* The Core Orb */}
                  <div className="w-32 h-32 rounded-full bg-gradient-to-tr from-orange-500 to-amber-400 shadow-[0_0_40px_rgba(249,115,22,0.3)] flex items-center justify-center relative overflow-hidden group-hover:shadow-[0_0_60px_rgba(249,115,22,0.5)] transition-all duration-700 z-10">
                    <div className="absolute inset-0 bg-white/10 mix-blend-overlay" />
                    {/* Simulated Voice Waveform inside orb */}
                    <div className="flex items-center justify-center gap-1.5 opacity-90 h-10">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="w-1.5 bg-white/90 rounded-full group-hover:animate-audio-wave h-full transition-all duration-300" style={{ transform: 'scaleY(0.4)', animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </div>
                  </div>

                  {/* Latency Tag (Light Theme) */}
                  <div className="absolute -bottom-24 px-4 py-2 rounded-full bg-white shadow-md border border-black/5 flex items-center gap-2 opacity-0 group-hover:opacity-100 group-hover:-translate-y-4 transition-all duration-700 delay-200">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-neutral-700 text-xs font-semibold tracking-wide">Live • 240ms latency</span>
                  </div>
                </div>

              </div>
            </div>
          </motion.div>

          {/* Row 3: Speech to Text */}
          <motion.div 
            initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }} transition={{ duration: 0.8 }}
            className="flex flex-col md:flex-row items-center gap-16"
          >
            <div className="flex-1 text-left">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-50 border border-orange-100 text-orange-700 text-sm font-semibold mb-6 shadow-sm">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M16 13H8"></path><path d="M16 17H8"></path><path d="M10 9H8"></path></svg>
                Speech-to-Text
              </div>
              <h3 className="text-3xl md:text-4xl font-semibold text-neutral-900 mb-6 tracking-tight leading-[1.2]">Flawless transcription and automated subtitling.</h3>
              <p className="text-lg text-neutral-500 leading-relaxed font-light mb-8">
                Convert any audio or video file into perfectly formatted text in seconds. Our engine automatically identifies speakers, filters out background noise, and accurately transcribes heavy accents.
              </p>
              <ul className="space-y-5">
                <li className="flex items-start gap-4">
                  <div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center shrink-0 mt-0.5">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-orange-600"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  </div>
                  <span className="text-neutral-700 font-medium text-lg">Export to SRT, VTT, and standard document formats.</span>
                </li>
                <li className="flex items-start gap-4">
                  <div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center shrink-0 mt-0.5">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-orange-600"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  </div>
                  <span className="text-neutral-700 font-medium text-lg">Multi-speaker diarization with 98% accuracy.</span>
                </li>
              </ul>
            </div>
            
            {/* UI Mockup 3: Speech to Text */}
            <div className="flex-1 w-full relative">
              <div className="absolute inset-0 bg-gradient-to-tr from-stone-300/30 to-orange-200/20 rounded-[2.5rem] blur-3xl transform rotate-3" />
              <div className="relative w-full aspect-square md:aspect-auto md:h-[400px] bg-white rounded-[2.5rem] border border-black/5 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] overflow-hidden flex flex-col p-8 group">
                
                {/* Audio Upload Bar */}
                <div className="w-full h-16 bg-neutral-50 rounded-2xl border border-black/5 flex items-center px-4 mb-6">
                  <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center mr-4">
                     <Play className="w-4 h-4 text-orange-500 ml-0.5" fill="currentColor" />
                  </div>
                  <div className="flex-1 h-2 bg-neutral-200 rounded-full overflow-hidden">
                    <div className="h-full w-1/3 bg-orange-400 rounded-full relative group-hover:w-full transition-all duration-1000 ease-in-out" />
                  </div>
                  <span className="ml-4 text-xs font-semibold text-neutral-400">01:24</span>
                </div>

                {/* Transcript Area */}
                <div className="flex-1 bg-neutral-50 rounded-2xl border border-black/5 p-6 space-y-4">
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-stone-200 shrink-0 flex items-center justify-center text-xs font-bold text-stone-500">S1</div>
                    <div className="flex-1 space-y-2 pt-1">
                      <div className="h-3 w-full bg-neutral-200 rounded-full" />
                      <div className="h-3 w-5/6 bg-neutral-200 rounded-full" />
                    </div>
                  </div>
                  <div className="flex gap-4 opacity-50 group-hover:opacity-100 transition-opacity duration-700 delay-300">
                    <div className="w-8 h-8 rounded-full bg-orange-100 shrink-0 flex items-center justify-center text-xs font-bold text-orange-600">S2</div>
                    <div className="flex-1 space-y-2 pt-1">
                      <div className="h-3 w-3/4 bg-orange-200 rounded-full" />
                      <div className="h-3 w-1/2 bg-orange-200 rounded-full" />
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Global Footer */}
      <footer className="w-full bg-[#0A0A0A] py-16 md:py-24 border-t border-black/10 relative overflow-hidden text-neutral-400">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(249,115,22,0.05)_0%,transparent_50%)] pointer-events-none" />
        
        <div className="max-w-7xl mx-auto px-6 relative z-10 grid grid-cols-2 md:grid-cols-4 gap-12 md:gap-8">
          
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-6">
              <span className="w-8 h-8 rounded-xl bg-gradient-to-tr from-orange-500 to-amber-400 text-white flex items-center justify-center font-bold text-lg shadow-lg">
                V
              </span>
              <span className="text-xl font-semibold text-white tracking-tight">VoiceForge</span>
            </div>
            <p className="text-sm leading-relaxed mb-6 font-light">
              Pioneering the future of digital voice with ultra-realistic, cinematic AI generation.
            </p>
            <div className="text-xs">
              &copy; {new Date().getFullYear()} VoiceForge Inc. All rights reserved.
            </div>
          </div>

          <div>
            <h4 className="text-white font-medium mb-6 uppercase tracking-wider text-xs">Product</h4>
            <ul className="space-y-4 text-sm font-light">
              <li><Link href="/studio" className="hover:text-white transition-colors">Studio</Link></li>
              <li><Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link></li>
              <li><Link href="/samples" className="hover:text-white transition-colors">Voice Samples</Link></li>
              <li><Link href="/docs" className="hover:text-white transition-colors">API Documentation</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-medium mb-6 uppercase tracking-wider text-xs">Company</h4>
            <ul className="space-y-4 text-sm font-light">
              <li><Link href="/contact" className="hover:text-white transition-colors">Contact Us</Link></li>
              <li><a href="#" className="hover:text-white transition-colors">About</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-medium mb-6 uppercase tracking-wider text-xs">Legal</h4>
            <ul className="space-y-4 text-sm font-light">
              <li><Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
              <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><a href="#" className="hover:text-white transition-colors">Security</a></li>
            </ul>
          </div>

        </div>
      </footer>
    </div>
  );
}
