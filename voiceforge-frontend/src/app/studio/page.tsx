"use client";
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { 
  Mic2, CreditCard, Settings, LogOut, 
  Download, ChevronDown, Sparkles, Loader2, Wand2, SlidersHorizontal, Activity 
} from 'lucide-react';
import api from '@/lib/api';

const tabs = [
  { id: 'playground', label: 'Studio Playground', icon: Mic2 },
  { id: 'billing',    label: 'Usage & Billing',   icon: CreditCard },
  { id: 'settings',  label: 'Settings',           icon: Settings },
];

export default function Studio() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('playground');
  const [text, setText] = useState('');
  
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    // Instant redirect — no waiting for API if token is absent
    const token = localStorage.getItem('token');
    if (!token) {
      router.replace('/login');
      return;
    }
    // Validate token with server (handles expired/invalid tokens)
    api.get('/auth/me')
      .then(res => {
        setUser(res.data.user);
        setAuthLoading(false);
      })
      .catch(() => {
        localStorage.removeItem('token');
        router.replace('/login');
      });
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/');
  };

  if (authLoading) {
    return <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
    </div>;
  }
  
  return (
    <div className="min-h-screen bg-[#FAFAFA] text-neutral-900 flex font-sans selection:bg-orange-500/30">
      
      {/* SIDEBAR */}
      <div className="w-64 border-r border-black/5 bg-white flex-col hidden md:flex">
        <div className="p-6">
          <Link href="/" className="inline-flex items-center gap-2 group w-fit">
            <span className="w-8 h-8 rounded-xl bg-gradient-to-tr from-orange-500 to-amber-400 text-white shadow-lg flex items-center justify-center font-bold text-lg">
              V
            </span>
            <span className="text-xl font-semibold tracking-tight">VoiceForge</span>
          </Link>
        </div>

        <div className="flex-1 px-4 py-2 space-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-all ${
                  isActive 
                    ? 'bg-orange-500/10 text-orange-600' 
                    : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-orange-500' : 'text-neutral-400'}`} />
                {tab.label}
              </button>
            )
          })}
        </div>

        <div className="p-4 border-t border-black/5">
          <div onClick={handleLogout} className="flex items-center gap-3 p-3 rounded-xl hover:bg-neutral-50 transition-colors cursor-pointer group">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-neutral-200 to-neutral-300 flex items-center justify-center text-neutral-600 font-bold uppercase">
              {user?.name?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-semibold truncate">{user?.name}</p>
              <p className="text-xs text-neutral-500 truncate">{user?.email}</p>
            </div>
            <LogOut className="w-4 h-4 text-neutral-400 group-hover:text-red-500 transition-colors" />
          </div>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col h-screen overflow-y-auto">
        
        {/* Header */}
        <header className="h-16 border-b border-black/5 bg-white/50 backdrop-blur-xl sticky top-0 z-20 flex items-center px-8 justify-between">
          <h2 className="text-lg font-semibold capitalize text-neutral-800">{tabs.find(t => t.id === activeTab)?.label}</h2>
          
          <div className="flex items-center gap-4 text-sm font-medium">
             <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-50 border border-orange-100 text-orange-700 shadow-sm">
               <Sparkles className="w-4 h-4 text-orange-500" />
               {user?.creditsBalance?.toLocaleString()} Credits
             </div>
          </div>
        </header>

        {/* Content Views */}
        <main className="p-8 max-w-5xl mx-auto w-full pb-20">
          <AnimatePresence mode="wait">
            {activeTab === 'playground' && <PlaygroundView key="playground" text={text} setText={setText} user={user} setUser={setUser} />}
            {activeTab === 'billing'    && <BillingView   key="billing"    user={user} />}
            {activeTab === 'settings'  && <SettingsView  key="settings"   user={user} setUser={setUser} />}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

// Sub-components
function PlaygroundView({ text, setText, user, setUser }: { text: string, setText: (val: string) => void, user: any, setUser: any }) {
  const [generating, setGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef<number>(0);

  const [voice, setVoice] = useState('tara');
  const [tone, setTone] = useState('');
  const [speed, setSpeed] = useState(1.0);
  const [showTuning, setShowTuning] = useState(false);
  const [temperature, setTemperature] = useState(0.35);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  const TONE_SPEEDS: Record<string, number> = {
    calm: 0.94, romantic: 0.92, storytelling: 0.95, horror: 0.93, 
    angry: 1.12, adventurous: 1.05, excited: 1.09, sad: 0.93
  };

  const EMOTIONS = ['giggle', 'laugh', 'chuckle', 'sigh', 'cough', 'sniffle', 'groan', 'yawn', 'gasp'];
  const VOICES = ['tara', 'leo', 'leah', 'jessi', 'dan', 'mia', 'zac', 'zoe'];
  const TONES = ['none', 'calm', 'romantic', 'storytelling', 'horror', 'angry', 'adventurous', 'excited', 'sad'];

  const handleToneChange = (newTone: string) => {
    setTone(newTone === 'none' ? '' : newTone);
    if (newTone !== 'none' && TONE_SPEEDS[newTone]) {
      const presetSpeed = TONE_SPEEDS[newTone];
      const clampedSpeed = Math.min(1.10, Math.max(0.90, presetSpeed));
      setSpeed(clampedSpeed);
    } else {
      setSpeed(1.0);
    }
  };

  const insertTag = (tag: string) => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const val = textareaRef.current.value;
    const newText = val.substring(0, start) + `<${tag}> ` + val.substring(end);
    setText(newText);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + tag.length + 3;
        textareaRef.current.focus();
      }
    }, 0);
  };

  const applyPreset = (presetName: string) => {
    if (presetName === 'Vibey') {
      handleToneChange('excited');
    } else if (presetName === 'Relaxed') {
      handleToneChange('calm');
    } else if (presetName === 'Action') {
      handleToneChange('adventurous');
    }
  };

  const handleGenerate = async () => {
    if (!text.trim()) return;
    setGenerating(true);
    setIsPlaying(true);
    setAudioUrl(null);
    
    // Initialize Audio Context for streaming playback
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const context = audioContextRef.current;
    if (context.state === 'suspended') {
      await context.resume();
    }
    nextPlayTimeRef.current = context.currentTime + 0.1;

    try {
      const resolvedVoice = voice === 'jessi' ? 'jess' : voice;
      const payload: any = { text, voice: resolvedVoice };
      if (tone) payload.tone = tone;
      if (!tone && speed !== 1.0) payload.speed = speed;
      if (temperature !== 0.35) payload.temperature = temperature;

      const token = localStorage.getItem('token') || '';
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      
      const response = await fetch(`${API_URL}/v1/studio/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
         throw new Error('Server error: ' + response.status);
      }

      const remainingCredits = response.headers.get('x-credits-remaining');
      if (remainingCredits) {
         setUser((prev: any) => ({ ...prev, creditsBalance: parseInt(remainingCredits, 10) }));
      } else {
         setUser((prev: any) => ({ ...prev, creditsBalance: Math.max(0, prev.creditsBalance - text.length) }));
      }

      if (!response.body) throw new Error("ReadableStream not supported");
      
      const reader = response.body.getReader();
      const SAMPLE_RATE = 24000;
      const chunksData: Uint8Array[] = [];
      let leftoverBuffer = new Uint8Array(0);
      let headerStripped = false;
      let headerBytesToStrip = 44;
      const MIN_CHUNK_SIZE = 24000; // Buffer 0.5 seconds of audio to prevent reverb/glitches

      while (true) {
        const { done, value } = await reader.read();

        if (value && value.length > 0) {
          let processValue = value;
          
          if (!headerStripped) {
              if (processValue.length >= headerBytesToStrip) {
                  processValue = processValue.slice(headerBytesToStrip);
                  headerStripped = true;
              } else {
                  headerBytesToStrip -= processValue.length;
                  processValue = new Uint8Array(0);
              }
          }

          if (processValue.length > 0) {
              chunksData.push(processValue);
          }

          const combined = new Uint8Array(leftoverBuffer.length + processValue.length);
          combined.set(leftoverBuffer, 0);
          combined.set(processValue, leftoverBuffer.length);

          // Only schedule playback if we have a decent chunk size, to prevent micro-stutters/reverb
          if (!done && combined.length < MIN_CHUNK_SIZE) {
              leftoverBuffer = combined;
              continue;
          }

          const completeSamples = Math.floor(combined.length / 2);
          const usableBytes = completeSamples * 2;
          
          leftoverBuffer = combined.slice(usableBytes);

          if (completeSamples > 0) {
              const int16Array = new Int16Array(combined.buffer, combined.byteOffset, completeSamples);
              const float32Array = new Float32Array(int16Array.length);
              for (let i = 0; i < int16Array.length; i++) {
                float32Array[i] = int16Array[i] / 32768.0;
              }

              const audioBuffer = context.createBuffer(1, float32Array.length, SAMPLE_RATE);
              audioBuffer.copyToChannel(float32Array, 0);

              const source = context.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(context.destination);

              const startTime = Math.max(context.currentTime, nextPlayTimeRef.current);
              source.start(startTime);
              nextPlayTimeRef.current = startTime + audioBuffer.duration;
              
              setGenerating(false);
          }
        }
        
        if (done) break;
      }
      
      // Stream finished -> Stitch chunks into a downloadable WAV
      const totalLength = chunksData.reduce((acc, val) => acc + val.length, 0);
      const allPcm = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunksData) {
        allPcm.set(chunk, offset);
        offset += chunk.length;
      }
      
      const buffer = new ArrayBuffer(44 + allPcm.length);
      const view = new DataView(buffer);
      const writeString = (pos: number, str: string) => {
        for (let i = 0; i < str.length; i++) view.setUint8(pos + i, str.charCodeAt(i));
      };
      
      writeString(0, 'RIFF');
      view.setUint32(4, 36 + allPcm.length, true);
      writeString(8, 'WAVE');
      writeString(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true); // PCM format
      view.setUint16(22, 1, true); // 1 channel
      view.setUint32(24, SAMPLE_RATE, true);
      view.setUint32(28, SAMPLE_RATE * 2, true); // Byte rate
      view.setUint16(32, 2, true); // Block align
      view.setUint16(34, 16, true); // Bits per sample
      writeString(36, 'data');
      view.setUint32(40, allPcm.length, true);
      
      new Uint8Array(buffer, 44).set(allPcm);
      
      const blobUrl = URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
      setAudioUrl(blobUrl);

    } catch (err) {
      console.error('Generation failed', err);
      alert('Failed to generate audio. Check credits or backend status.');
      setGenerating(false);
    } finally {
      const context = audioContextRef.current;
      if (context) {
        const remainingTime = Math.max(0, nextPlayTimeRef.current - context.currentTime);
        setTimeout(() => setIsPlaying(false), remainingTime * 1000);
      } else {
        setIsPlaying(false);
      }
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
      <div className="mb-8">
        <h1 className="text-3xl font-semibold mb-2 bg-gradient-to-br from-neutral-900 to-neutral-500 bg-clip-text text-transparent">Voice Studio</h1>
        <p className="text-neutral-500">Design the perfect voiceover with emotion and precise tuning.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN: Editor & Output */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          
          {/* Quick Emotion Tags */}
          <div className="bg-white/60 backdrop-blur-xl border border-black/5 rounded-2xl p-5 shadow-[0_2px_20px_rgba(0,0,0,0.02)]">
            <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3 flex items-center gap-2"><Sparkles className="w-3 h-3 text-orange-500"/> Insert Emotion Tag</h3>
            <div className="flex flex-wrap gap-2">
              {EMOTIONS.map(tag => (
                <button key={tag} onClick={() => insertTag(tag)} className="px-3 py-1.5 bg-neutral-100/80 hover:bg-orange-100 hover:text-orange-700 text-neutral-600 text-sm font-medium rounded-lg transition-all active:scale-95 border border-black/5 shadow-sm">
                  +{tag}
                </button>
              ))}
            </div>
          </div>

          {/* Editor */}
          <div className="bg-white/80 backdrop-blur-2xl border border-black/5 rounded-3xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] overflow-hidden focus-within:ring-4 focus-within:ring-orange-500/10 focus-within:border-orange-500/50 transition-all flex flex-col">
            <div className="bg-gradient-to-b from-neutral-50/50 to-transparent border-b border-black/5 px-6 py-4 flex items-center justify-between">
               <div className="flex items-center gap-3">
                 <div className="relative flex h-3 w-3">
                   <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                   <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                 </div>
                 <span className="text-sm font-semibold text-neutral-700 capitalize">{voice} <span className="text-neutral-400 font-normal">({tone || 'Neutral'})</span></span>
               </div>
               <span className="text-xs font-medium bg-neutral-100 text-neutral-500 px-2.5 py-1 rounded-md">{text.length} / 5000</span>
            </div>
            <textarea 
              ref={textareaRef}
              className="w-full min-h-[300px] p-6 resize-none bg-transparent focus:outline-none text-lg text-neutral-800 placeholder:text-neutral-300 leading-relaxed"
              placeholder="Type your script here... Try clicking the emotion tags above to add <gasp> or <laugh>."
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <div className="p-4 border-t border-black/5 bg-neutral-50/50">
              <button 
                onClick={handleGenerate}
                disabled={generating || isPlaying || text.length === 0}
                className="w-full bg-gradient-to-br from-orange-500 to-amber-500 text-white px-8 py-4 rounded-2xl font-semibold shadow-[0_8px_20px_rgba(249,115,22,0.25)] hover:shadow-[0_12px_25px_rgba(249,115,22,0.35)] transition-all flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generating ? <Loader2 className="w-5 h-5 animate-spin" /> : isPlaying ? <><Activity className="w-5 h-5 animate-pulse" /> Playing Live Stream...</> : <><Wand2 className="w-5 h-5" /> Generate Voiceover</>}
              </button>
            </div>
          </div>

          {/* Output Section */}
          <div ref={outputRef} className="bg-white/60 backdrop-blur-2xl border border-black/5 rounded-3xl p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
            <div className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-orange-50 border border-orange-100 text-orange-700 shadow-sm w-fit mb-5 text-xs font-bold uppercase tracking-widest">
               <Activity className="w-4 h-4 text-orange-500" />
               Output
            </div>
            
            {audioUrl ? (
              <div className="bg-gradient-to-br from-orange-50 to-amber-50/50 border border-orange-200/60 rounded-2xl p-5 shadow-inner relative overflow-hidden">
                {/* Background decorative blob */}
                <div className="absolute -right-10 -top-10 w-32 h-32 bg-orange-400/10 blur-3xl rounded-full pointer-events-none" />
                
                <div className="flex flex-col md:flex-row items-center justify-between gap-4 relative z-10">
                  <div className="flex-1 w-full">
                    <audio controls src={audioUrl} className="w-full h-12 rounded-lg" />
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <a href={audioUrl} download="voiceforge-audio.wav" className="bg-orange-500 text-white flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold shadow-[0_4px_14px_rgba(249,115,22,0.3)] hover:bg-orange-600 transition-all hover:scale-[1.02] active:scale-[0.98]">
                      <Download className="w-4 h-4" /> Download
                    </a>
                  </div>
                </div>
              </div>
            ) : isPlaying ? (
              <div className="border-2 border-orange-200 bg-orange-50/50 rounded-2xl p-10 flex flex-col items-center justify-center text-center shadow-inner relative overflow-hidden">
                 <div className="absolute inset-0 w-full h-full pointer-events-none z-0">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-orange-400/20 blur-[80px] rounded-full animate-pulse" />
                 </div>
                 <div className="w-16 h-16 bg-white shadow-lg border border-orange-100 rounded-full flex items-center justify-center mb-4 relative z-10 animate-bounce">
                   <Activity className="w-8 h-8 text-orange-500" />
                 </div>
                 <h4 className="text-orange-900 font-semibold mb-1 relative z-10 text-lg">Live Streaming Active</h4>
                 <p className="text-sm text-orange-700 max-w-sm relative z-10 font-medium">Your voiceover is playing in real-time. Stand by...</p>
              </div>
            ) : (
              <div className="border-2 border-dashed border-black/5 bg-neutral-50/50 rounded-2xl p-10 flex flex-col items-center justify-center text-center">
                 <div className="w-16 h-16 bg-white shadow-sm border border-black/5 rounded-full flex items-center justify-center mb-4">
                   <Mic2 className="w-8 h-8 text-neutral-300" />
                 </div>
                 <h4 className="text-neutral-700 font-semibold mb-1">No audio generated yet</h4>
                 <p className="text-sm text-neutral-400 max-w-sm">Hit the "Generate Voiceover" button above and your high-fidelity audio will appear right here.</p>
              </div>
            )}
          </div>

        </div>

        {/* RIGHT COLUMN: Settings */}
        <div className="lg:col-span-1 space-y-6">
          
          <div className="bg-white/60 backdrop-blur-2xl border border-black/5 rounded-3xl p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)] sticky top-24">
            <h3 className="text-lg font-semibold mb-6 flex items-center gap-2 text-neutral-800"><SlidersHorizontal className="w-5 h-5 text-orange-500"/> Studio Controls</h3>
            
            {/* Voice */}
            <div className="mb-6 relative z-30">
              <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">Voice Model</label>
              <PremiumSelect 
                value={voice} 
                onChange={setVoice} 
                options={VOICES.map(v => ({ label: v, value: v }))} 
              />
            </div>

            {/* Tone */}
            <div className="mb-6 relative z-20">
              <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">Speaking Tone</label>
              <PremiumSelect 
                value={tone || 'none'} 
                onChange={handleToneChange} 
                options={TONES.map(t => ({ label: t === 'none' ? 'Neutral (No Tone)' : t, value: t }))} 
              />
            </div>

            {/* Speed Slider (Glassy) */}
            <div className="mb-8">
              <div className="flex justify-between items-end mb-3">
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider">Speed Multiplier</label>
                <span className="text-xs font-bold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-md border border-orange-200">{speed.toFixed(2)}x</span>
              </div>
              <input 
                type="range" min="0.90" max="1.10" step="0.01" 
                value={speed} onChange={e => setSpeed(parseFloat(e.target.value))}
                className="w-full h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
              />
              <div className="flex justify-between text-[10px] text-neutral-400 mt-1.5 font-medium uppercase tracking-widest">
                <span>0.9x Slower</span>
                <span>1.1x Faster</span>
              </div>
            </div>

            {/* Presets */}
            <div className="mb-6 pt-6 border-t border-black/5">
              <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">Quick Presets</label>
              <div className="grid grid-cols-2 gap-3">
                {['Vibey', 'Relaxed', 'Action'].map(p => (
                  <button key={p} onClick={() => applyPreset(p)} className="px-3 py-2.5 bg-white hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200 border border-black/5 rounded-xl text-sm font-semibold text-neutral-600 transition-all shadow-sm active:scale-95">
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Tuning Toggle */}
            <div className="pt-4 border-t border-black/5">
              <button onClick={() => setShowTuning(!showTuning)} className="flex items-center justify-between w-full text-sm font-semibold text-neutral-600 hover:text-orange-600 transition-colors">
                Advanced Tuning
                <ChevronDown className={`w-4 h-4 transition-transform ${showTuning ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {showTuning && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mt-4">
                    <div className="bg-neutral-50 p-4 rounded-xl border border-black/5">
                      <div className="flex justify-between items-end mb-2">
                        <label className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Temperature</label>
                        <span className="text-xs font-bold text-neutral-600">{temperature.toFixed(2)}</span>
                      </div>
                      <input 
                        type="range" min="0.1" max="1.0" step="0.01" 
                        value={temperature} onChange={e => setTemperature(parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-neutral-600"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

          </div>
        </div>

      </div>
    </motion.div>
  )
}


// Per-plan themes — mirrors the pricing page card aesthetics exactly
const PLAN_THEMES: Record<string, {
  // Hero banner
  heroBg: string; heroBalanceText: string; heroSubText: string; heroAllocText: string;
  heroBlobColor: string; glow: string;
  // Badge (plan name tag)
  badgeBg: string; badgeText: string;
  // Progress bar
  barFrom: string; barTo: string; trackBg: string;
  // Plan card (left)
  cardBg: string; cardBorder: string; cardAccent: string; cardText: string; cardSub: string;
  // Usage card (right)
  usageCardBg: string; usageCardBorder: string; usageAccent: string; usageText: string; usageSub: string;
  // CTA button
  ctaClass: string;
  // Surplus banner
  surplusBg: string; surplusBorder: string; surplusText: string;
  // Remaining tag
  remBg: string; remText: string;
  icon: string; label: string; isDark: boolean; isPro?: boolean;
}> = {
  free: {
    heroBg:           'bg-white border-emerald-200/70',
    heroBalanceText:  'text-neutral-900',
    heroSubText:      'text-neutral-500',
    heroAllocText:    'text-emerald-700',
    heroBlobColor:    'bg-emerald-400/20',
    glow:             'shadow-[0_8px_40px_rgba(16,185,129,0.10)]',
    badgeBg:          'bg-emerald-50',
    badgeText:        'text-emerald-600',
    barFrom:          'from-emerald-400', barTo: 'to-teal-400',
    trackBg:          'bg-emerald-100/70',
    cardBg:           'bg-white', cardBorder: 'border-black/5',
    cardAccent:       'text-emerald-600', cardText: 'text-neutral-900', cardSub: 'text-neutral-400',
    usageCardBg:      'bg-white', usageCardBorder: 'border-black/5',
    usageAccent:      'text-emerald-600', usageText: 'text-neutral-900', usageSub: 'text-neutral-500',
    ctaClass:         'bg-black text-white hover:bg-neutral-800',
    surplusBg:        'bg-emerald-50', surplusBorder: 'border-emerald-200', surplusText: 'text-emerald-800',
    remBg:            'bg-emerald-50', remText: 'text-emerald-700',
    icon: '🌱', label: 'Free', isDark: false,
  },
  starter: {
    // Vibrant coral-orange — bright and energetic, white card base
    heroBg:           'bg-white border-orange-300/80',
    heroBalanceText:  'text-neutral-900',
    heroSubText:      'text-neutral-500',
    heroAllocText:    'text-orange-500',
    heroBlobColor:    'bg-orange-300/25',
    glow:             'shadow-[0_8px_40px_rgba(251,146,60,0.20)] ring-2 ring-orange-200/70',
    badgeBg:          'bg-orange-50',
    badgeText:        'text-orange-500',
    barFrom:          'from-orange-400', barTo: 'to-amber-300',
    trackBg:          'bg-orange-100/60',
    cardBg:           'bg-white', cardBorder: 'border-orange-200',
    cardAccent:       'text-orange-500', cardText: 'text-neutral-900', cardSub: 'text-neutral-400',
    usageCardBg:      'bg-white', usageCardBorder: 'border-orange-200/60',
    usageAccent:      'text-orange-500', usageText: 'text-neutral-900', usageSub: 'text-neutral-500',
    ctaClass:         'bg-orange-500 text-white hover:bg-orange-600',
    surplusBg:        'bg-orange-50', surplusBorder: 'border-orange-200', surplusText: 'text-orange-800',
    remBg:            'bg-orange-50', remText: 'text-orange-600',
    icon: '🚀', label: 'Starter', isDark: false, isPro: false,
  },
  creator: {
    // Dark/black card — exact match to the Creator pricing card
    heroBg:           'bg-black border-black',
    heroBalanceText:  'text-white',
    heroSubText:      'text-neutral-400',
    heroAllocText:    'text-orange-400',
    heroBlobColor:    'bg-orange-500/20',
    glow:             'shadow-[0_8px_40px_rgba(0,0,0,0.35)]',
    badgeBg:          'bg-orange-500/20',
    badgeText:        'text-orange-300',
    barFrom:          'from-orange-500', barTo: 'to-amber-400',
    trackBg:          'bg-white/10',
    cardBg:           'bg-neutral-900', cardBorder: 'border-neutral-800',
    cardAccent:       'text-orange-400', cardText: 'text-white', cardSub: 'text-neutral-400',
    usageCardBg:      'bg-neutral-900', usageCardBorder: 'border-neutral-800',
    usageAccent:      'text-orange-400', usageText: 'text-white', usageSub: 'text-neutral-400',
    ctaClass:         'bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:from-orange-600 hover:to-amber-600',
    surplusBg:        'bg-orange-500/10', surplusBorder: 'border-orange-500/30', surplusText: 'text-orange-300',
    remBg:            'bg-orange-500/20', remText: 'text-orange-300',
    icon: '⚡', label: 'Creator', isDark: true,
  },
  pro: {
    // Deep Orangish-Gold — luxury feel, distinct and more premium than starter
    heroBg:           'bg-gradient-to-br from-orange-50 via-amber-50 to-orange-100/80 border-orange-300',
    heroBalanceText:  'text-orange-900',
    heroSubText:      'text-orange-800',
    heroAllocText:    'text-orange-700',
    heroBlobColor:    'bg-orange-500/25',
    glow:             'shadow-[0_8px_60px_rgba(234,88,12,0.25)] ring-2 ring-orange-300/80',
    badgeBg:          'bg-gradient-to-r from-orange-200 to-amber-200',
    badgeText:        'text-orange-900',
    barFrom:          'from-orange-600', barTo: 'to-amber-400',
    trackBg:          'bg-orange-200/60',
    cardBg:           'bg-gradient-to-br from-orange-50 to-amber-50', cardBorder: 'border-orange-300/70',
    cardAccent:       'text-orange-700', cardText: 'text-orange-900', cardSub: 'text-orange-700/80',
    usageCardBg:      'bg-gradient-to-br from-orange-50 to-amber-50', usageCardBorder: 'border-orange-300/70',
    usageAccent:      'text-orange-700', usageText: 'text-orange-900', usageSub: 'text-orange-700/80',
    ctaClass:         'bg-gradient-to-r from-orange-600 to-amber-500 text-white hover:from-orange-700 hover:to-amber-600 shadow-lg shadow-orange-500/25',
    surplusBg:        'bg-orange-100', surplusBorder: 'border-orange-300', surplusText: 'text-orange-900',
    remBg:            'bg-orange-200/70', remText: 'text-orange-900',
    icon: '👑', label: 'Pro', isDark: false, isPro: true,
  },
};

function BillingView({ user }: { user: any }) {
  const planKey            = (user?.plan || 'FREE').toString().toLowerCase();
  const theme              = PLAN_THEMES[planKey] || PLAN_THEMES.free;
  const monthlyAllocation  = user?.planMonthlyCredits || 10000;
  const balance            = user?.creditsBalance || 0;
  const usedFromMonthly    = Math.max(0, monthlyAllocation - balance);
  const percent            = Math.min(100, Math.max(0, (usedFromMonthly / monthlyAllocation) * 100));
  const hasTopUpSurplus    = balance > monthlyAllocation;
  const isPro              = theme.isPro === true;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>

      {/* ── Hero Banner ─────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className={`relative overflow-hidden rounded-3xl border p-8 mb-7 ${theme.heroBg} ${theme.glow}`}
      >
        {/* Primary glow blob */}
        <div className={`absolute -top-12 -right-12 w-64 h-64 rounded-full blur-3xl pointer-events-none ${theme.heroBlobColor}`} />

        {/* Pro-only: second animated rotating blob + sparkles */}
        {isPro && (
          <>
            <motion.div
              animate={{ rotate: 360, scale: [1, 1.15, 1] }}
              transition={{ rotate: { duration: 12, repeat: Infinity, ease: 'linear' }, scale: { duration: 3, repeat: Infinity, ease: 'easeInOut' } }}
              className="absolute -bottom-16 -left-16 w-56 h-56 rounded-full bg-orange-500/20 blur-3xl pointer-events-none"
            />
            {/* Floating sparkle dots */}
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={i}
                animate={{ y: [0, -14, 0], opacity: [0.3, 1, 0.3], scale: [1, 1.2, 1] }}
                transition={{ duration: 2 + i * 0.4, repeat: Infinity, delay: i * 0.3, ease: 'easeInOut' }}
                className="absolute w-1.5 h-1.5 rounded-full bg-gradient-to-br from-orange-300 to-amber-400 shadow-[0_0_8px_2px_rgba(249,115,22,0.6)] pointer-events-none"
                style={{ left: `${12 + i * 16}%`, top: `${15 + (i % 2) * 35}%` }}
              />
            ))}
          </>
        )}

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          {/* Left: balance */}
          <div>
            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest mb-5 ${theme.badgeBg} ${theme.badgeText}`}>
              {isPro ? (
                <motion.span animate={{ rotate: [-8, 8, -8] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}>
                  {theme.icon}
                </motion.span>
              ) : <span>{theme.icon}</span>}
              {theme.label} Plan
              {isPro && <span className="ml-1.5 text-[9px] bg-gradient-to-r from-orange-500 to-amber-500 text-white px-1.5 py-0.5 rounded-full shadow-sm">PREMIUM</span>}
            </div>
            <motion.div
              className={`text-6xl font-extrabold tracking-tight mb-1 ${theme.heroBalanceText}`}
              animate={isPro ? { textShadow: ['0 0 0px rgba(234,88,12,0)', '0 0 20px rgba(234,88,12,0.4)', '0 0 0px rgba(234,88,12,0)'] } : {}}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            >
              {balance.toLocaleString()}
            </motion.div>
            <p className={`text-sm font-medium ${theme.heroSubText}`}>credits remaining</p>
          </div>

          {/* Right: allocation + mini progress */}
          <div className="flex flex-col gap-3 min-w-[220px]">
            <div className={`text-[11px] font-bold uppercase tracking-widest ${theme.heroSubText}`}>Monthly Allocation</div>
            <div className={`text-3xl font-bold ${theme.heroAllocText}`}>{monthlyAllocation.toLocaleString()}</div>
            <div className={`h-2.5 rounded-full overflow-hidden w-full ${theme.trackBg}`}>
              <motion.div
                initial={{ width: 0 }} animate={{ width: `${percent}%` }} transition={{ duration: 1, ease: 'easeOut' }}
                className={`h-full rounded-full bg-gradient-to-r ${theme.barFrom} ${theme.barTo}`}
              />
            </div>
            <p className={`text-xs ${theme.heroSubText}`}>{usedFromMonthly.toLocaleString()} used · resets monthly</p>
          </div>
        </div>
      </motion.div>

      {/* ── Plan + Usage Cards ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

        {/* Plan Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className={`rounded-2xl border p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)] flex flex-col justify-between ${theme.cardBg} ${theme.cardBorder}`}
        >
          <div className={`flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest mb-6 ${theme.cardAccent}`}>
            <CreditCard className="w-4 h-4" /> Current Plan
          </div>
          <div>
            <div className={`text-3xl font-bold mb-1 ${theme.cardText}`}>{theme.icon} {theme.label}</div>
            <p className={`text-sm ${theme.cardSub}`}>{monthlyAllocation.toLocaleString()} credits / month</p>
            {planKey === 'free' && (
              <p className={`text-xs font-semibold mt-2 ${theme.cardAccent}`}>12,000 credits bonus first month</p>
            )}
          </div>
          <Link
            href="/pricing"
            className={`mt-6 w-full py-2.5 font-semibold rounded-xl transition-all text-center block text-sm ${theme.ctaClass}`}
          >
            {planKey === 'free' ? 'Upgrade Plan →' : 'Change Plan →'}
          </Link>
        </motion.div>

        {/* Usage Meter Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className={`rounded-2xl border p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)] md:col-span-2 ${theme.usageCardBg} ${theme.usageCardBorder}`}
        >
          <div className="flex items-center justify-between mb-5">
            <div className={`text-[11px] font-bold uppercase tracking-widest ${theme.usageAccent}`}>Credits Usage</div>
            <div className={`text-[11px] font-medium px-3 py-1 rounded-full ${theme.isDark ? 'bg-white/10 text-neutral-400' : 'bg-neutral-100 text-neutral-400'}`}>
              Resets monthly
            </div>
          </div>

          <div className={`text-5xl font-extrabold mb-1 ${theme.usageText}`}>{balance.toLocaleString()}</div>
          <p className={`text-sm mb-5 ${theme.usageSub}`}>credits left</p>

          {/* Progress bar */}
          <div className="space-y-2 mb-4">
            <div className={`flex justify-between text-xs ${theme.usageSub}`}>
              <span>{usedFromMonthly.toLocaleString()} used</span>
              <span>{monthlyAllocation.toLocaleString()} total</span>
            </div>
            <div className={`h-4 rounded-full w-full overflow-hidden shadow-inner ${theme.trackBg}`}>
              <motion.div
                initial={{ width: 0 }} animate={{ width: `${percent}%` }} transition={{ duration: 1.2, ease: 'easeOut' }}
                className={`h-full rounded-full bg-gradient-to-r ${theme.barFrom} ${theme.barTo} relative`}
              >
                {percent > 6 && (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-white text-[9px] font-black">{Math.round(percent)}%</span>
                )}
              </motion.div>
            </div>
          </div>

          {/* Remaining tag */}
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold ${theme.remBg} ${theme.remText}`}>
            {theme.icon} {Math.round(100 - percent)}% of {theme.label} plan remaining
          </div>

          {hasTopUpSurplus && (
            <div className={`mt-4 px-4 py-3 rounded-xl text-sm font-medium border ${theme.surplusBg} ${theme.surplusBorder} ${theme.surplusText}`}>
              ✨ <strong>{(balance - monthlyAllocation).toLocaleString()}</strong> bonus credits from top-ups above your plan limit.
            </div>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}



function SettingsView({ user, setUser }: { user: any, setUser: any }) {
  const [name, setName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await api.put('/auth/me', { name: name.trim() });
      setUser((prev: any) => ({ ...prev, name: res.data.user.name }));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      alert('Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold mb-2">Account Settings</h1>
        <p className="text-neutral-500">Manage your profile and preferences.</p>
      </div>

      <div className="bg-white border border-black/5 rounded-2xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)] max-w-2xl">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-neutral-700 mb-2">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full h-11 bg-white border border-black/10 rounded-xl px-4 text-neutral-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-neutral-700 mb-2">Email Address</label>
            <input type="email" disabled defaultValue={user?.email || ''} className="w-full h-11 bg-neutral-50 border border-black/10 rounded-xl px-4 text-neutral-500 cursor-not-allowed" />
          </div>
          <div className="pt-4 border-t border-black/5 flex items-center gap-4">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="bg-black text-white px-6 py-2.5 rounded-xl font-medium shadow-[0_4px_14px_0_rgba(0,0,0,0.1)] hover:bg-neutral-800 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : 'Save Changes'}
            </button>
            {saved && <span className="text-green-600 text-sm font-semibold">✓ Saved successfully</span>}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function PremiumSelect({ value, options, onChange }: { value: string, options: {label: string, value: string}[], onChange: (val: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedLabel = options.find(o => o.value === value)?.label || value;

  return (
    <div className="relative" ref={ref}>
      <button 
        type="button"
        onClick={() => setOpen(!open)} 
        className={`w-full bg-white border ${open ? 'border-orange-500 ring-2 ring-orange-500/30' : 'border-black/10'} text-neutral-800 rounded-xl px-4 py-3 flex items-center justify-between focus:outline-none transition-all shadow-sm`}
      >
        <span className="font-medium capitalize">{selectedLabel}</span>
        <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div 
            initial={{ opacity: 0, y: -5, scale: 0.95 }} 
            animate={{ opacity: 1, y: 0, scale: 1 }} 
            exit={{ opacity: 0, y: -5, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute top-full left-0 mt-2 w-full bg-white/95 backdrop-blur-xl border border-black/10 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.08)] overflow-hidden z-[100] p-1"
          >
            <div className="max-h-60 overflow-y-auto">
              {options.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium capitalize transition-all ${
                    value === opt.value 
                      ? 'bg-orange-50 text-orange-700' 
                      : 'text-neutral-700 hover:bg-neutral-50 hover:text-orange-600'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
