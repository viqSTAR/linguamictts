"use client";
import React, { useState, useRef } from 'react';
import Navbar from '../../components/Navbar';
import { motion } from 'framer-motion';
import { Play, Pause, Volume2 } from 'lucide-react';

const voices = [
  { id: 'tara', name: 'Tara', tone: 'calm', tags: ['Calm', 'Airy'], desc: 'A light, gentle, and airy voice perfect for meditation and relaxation.', text: 'Hey!, I am tara, What about you?' },
  { id: 'leo', name: 'Leo', tone: 'adventurous', tags: ['Adventurous', 'Bold'], desc: 'Ideal for action and excitement.', text: 'Hey! I\'m Leo. Are you ready for an adventure?' },
  { id: 'leah', name: 'Leah', tone: 'romantic', tags: ['Romantic', 'Vibey'], desc: 'A soft, intimate, and vibey voice.', text: 'Hey! I am Leah. Let\'s catch a vibe together.' },
  { id: 'jessi', name: 'Jessi', tone: 'excited', tags: ['Excited', 'Bubbly'], desc: 'A high-energy, enthusiastic voice perfect for celebrations.', text: 'Hey! I am Jessi. I can\'t wait to get started!' },
  { id: 'dan', name: 'Dan', tone: 'angry', tags: ['Angry', 'Disappointed'], desc: 'An intense, impatient, and frustrated voice.', text: 'Look, I\'m Dan. Honestly, I expected better from you.' },
  { id: 'mia', name: 'Mia', tone: 'storytelling', tags: ['Storytelling', 'Captivating'], desc: 'A warm, inviting, and highly engaging narrative voice.', text: 'Hello, I am Mia. Gather around, because I have a story to tell you.' }
];

export default function Samples() {
  const [playing, setPlaying] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlay = async (voice: typeof voices[0]) => {
    if (playing === voice.id) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setPlaying(null);
      return;
    }

    if (loading) return; // Prevent multiple clicks

    setLoading(voice.id);
    if (audioRef.current) {
      audioRef.current.pause();
    }

    try {
      const audio = new Audio(`/voices/${voice.id}.wav`);
      audioRef.current = audio;

      audio.onplay = () => {
        setLoading(null);
        setPlaying(voice.id);
      };

      audio.onended = () => {
        setPlaying(null);
      };

      await audio.play();
    } catch (error) {
      console.error(error);
      setLoading(null);
      setPlaying(null);
      alert("Failed to play sample audio.");
    }
  };

  return (
    <div className="min-h-screen bg-[#FCFCFD] font-sans relative overflow-x-hidden">
      <Navbar />

      <div className="absolute inset-0 w-full h-full pointer-events-none z-0">
        <div className="absolute top-[-10%] right-[-10%] w-[100vw] h-[80vh] bg-gradient-to-bl from-amber-400/20 via-orange-200/10 to-transparent blur-[140px]" />
      </div>

      <main className="pt-40 pb-32 px-6 max-w-7xl mx-auto relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="text-center mb-20"
        >
          <h1 className="text-5xl md:text-6xl font-medium tracking-tight text-[#0A0A0A] mb-6">Explore our voices.</h1>
          <p className="text-xl text-neutral-500 max-w-2xl mx-auto font-light">Listen to a selection of our ultra-realistic, cinematic voice models. Ready to be used in your next big project.</p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {voices.map((voice, i) => (
            <motion.div 
              key={voice.id}
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: i * 0.1 }}
              className="bg-white/60 backdrop-blur-2xl border border-black/5 rounded-[2rem] p-8 shadow-[0_12px_40px_-16px_rgba(0,0,0,0.05)] hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.08)] transition-all group"
            >
              <div className="flex justify-between items-start mb-6">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-100 to-amber-50 flex items-center justify-center text-xl font-bold text-orange-600 shadow-inner border border-black/5">
                  {voice.name[0]}
                </div>
                <button 
                  onClick={() => togglePlay(voice)}
                  disabled={loading === voice.id}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-sm ${playing === voice.id ? 'bg-orange-500 text-white shadow-[0_0_20px_rgba(249,115,22,0.4)]' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 hover:text-black hover:scale-105'}`}
                >
                  {loading === voice.id ? (
                    <div className="w-5 h-5 border-2 border-neutral-300 border-t-neutral-600 rounded-full animate-spin" />
                  ) : playing === voice.id ? (
                    <Pause className="w-5 h-5" fill="currentColor" />
                  ) : (
                    <Play className="w-5 h-5 ml-1" fill="currentColor" />
                  )}
                </button>
              </div>

              <h3 className="text-2xl font-semibold text-neutral-900 mb-2">{voice.name}</h3>
              <p className="text-neutral-500 text-sm mb-6 leading-relaxed h-10">{voice.desc}</p>

              <div className="flex flex-wrap gap-2">
                {voice.tags.map(tag => (
                  <span key={tag} className="px-3 py-1 bg-white border border-black/5 rounded-full text-xs font-medium text-neutral-600 shadow-sm">
                    {tag}
                  </span>
                ))}
              </div>

              {/* Fake Audio Waveform */}
              <div className="mt-8 h-12 w-full bg-neutral-50 rounded-xl border border-black/5 flex items-center px-4 overflow-hidden relative">
                 <div className={`absolute top-0 left-0 h-full bg-orange-50 transition-all duration-[4000ms] ease-linear ${playing === voice.id ? 'w-full' : 'w-0'}`} />
                 <Volume2 className="w-4 h-4 text-neutral-400 relative z-10 mr-3 shrink-0" />
                 <div className="flex-1 flex items-center gap-1 h-4 relative z-10">
                   {[...Array(20)].map((_, j) => (
                     <div 
                       key={j} 
                       className={`w-1.5 rounded-full transition-all duration-300 ${playing === voice.id ? 'bg-orange-400 animate-audio-wave' : 'bg-neutral-200'}`}
                       style={{ 
                         height: `${20 + Math.random() * 80}%`,
                         animationDelay: playing === voice.id ? `${j * 0.1}s` : '0s'
                       }}
                     />
                   ))}
                 </div>
              </div>

            </motion.div>
          ))}
        </div>

      </main>
    </div>
  );
}
