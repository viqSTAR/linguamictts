"use client";
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import logo from '@/assets/linguamicorange copy.png';
import { 
  Mic2, CreditCard, Settings, LogOut, 
  Download, ChevronDown, Sparkles, Loader2, Wand2, SlidersHorizontal, Activity,
  User, CheckCircle2, RefreshCw
} from 'lucide-react';
import api from '@/lib/api';

const tabs = [
  { id: 'playground', label: 'Studio Playground', icon: Mic2 },
  { id: 'billing',    label: 'Usage & Billing',   icon: CreditCard },
  { id: 'settings',  label: 'Settings',           icon: Settings },
];

type UserProfile = {
  name?: string;
  email?: string;
  plan?: string;
  planMonthlyCredits?: number;
  creditsBalance?: number;
  lastAudioUpdatedAt?: string | null;
  lastAudioUrl?: string | null;
  lastAudioMp3Url?: string | null;
  presets?: { name: string; voice: string; tone: string; speed: number; temperature: number }[];
  subscriptionStatus?: 'NONE' | 'ACTIVE' | 'CANCELED';
  currentPeriodEnd?: string | null;
  autoRenew?: boolean;
  canceledAt?: string | null;
};

type CreditTransaction = {
  id: string;
  amount: number;
  type: string;
  description?: string | null;
  referenceId?: string | null;
  createdAt: string;
};

type RefundModalState = {
  open: boolean;
  step: 'confirm' | 'submitted';
};

export default function Studio() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('playground');
  const [text, setText] = useState('');
  
  const [user, setUser] = useState<UserProfile | null>(null);
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
            <Image src={logo} alt="Linguamic Logo" className="w-8 h-8 object-contain" />
            <span className="text-xl font-semibold tracking-tight">Linguamic</span>
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
            {activeTab === 'billing'    && <BillingView   key="billing"    user={user} setUser={setUser} />}
            {activeTab === 'settings'  && <SettingsView  key="settings"   user={user} setUser={setUser} />}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

// Sub-components
function PlaygroundView({ text, setText, user, setUser }: { text: string; setText: (val: string) => void; user: UserProfile | null; setUser: React.Dispatch<React.SetStateAction<UserProfile | null>> }) {
  const [generating, setGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [cloudMp3Url, setCloudMp3Url] = useState<string | null>(null);
  const [cloudReady, setCloudReady] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<'idle' | 'pending' | 'ready' | 'error'>('idle');
  const generationStartRef = useRef<number>(0);
  
  // STT State
  const [sttMode, setSttMode] = useState<'tts' | 'stt'>('tts');
  const [sttFile, setSttFile] = useState<File | null>(null);
  const [sttResult, setSttResult] = useState<string>('');

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [showConfirm, setShowConfirm] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  
  // Preset Modal State
  const [savePresetModal, setSavePresetModal] = useState(false);
  const [presetNameInput, setPresetNameInput] = useState('');
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [vizBars, setVizBars] = useState<number[]>(Array(20).fill(4));

  // Dropdown open state
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [toneOpen, setToneOpen] = useState(false);
  const voiceRef = useRef<HTMLDivElement>(null);
  const toneRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (voiceRef.current && !voiceRef.current.contains(e.target as Node)) setVoiceOpen(false);
      if (toneRef.current && !toneRef.current.contains(e.target as Node)) setToneOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const audioContextRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef<number>(0);

  const [voice, setVoice] = useState('tara');
  const [tone, setTone] = useState('');
  const [speed, setSpeed] = useState(1.0);
  const [showTuning, setShowTuning] = useState(false);
  const [temperature, setTemperature] = useState(0.60);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  const TONE_SPEEDS: Record<string, number> = {
    calm: 0.93, romantic: 0.91, storytelling: 0.97, horror: 0.86,
    angry: 1.08, adventurous: 1.07, excited: 1.14, sad: 0.90, funny: 1.05
  };

  // Valid Orpheus emotion tokens (confirmed from model training data).
  // 'giggle' is NOT in the Orpheus vocab — the model falls back to the closest
  // acoustic match (usually a gasp). Removed to prevent laugh→gasp confusion.
  const EMOTIONS = ['laugh', 'chuckle', 'sigh', 'cough', 'sniffle', 'groan', 'yawn', 'gasp'];


  const VOICE_META: Record<string, { emoji: string; gender: 'female' | 'male'; desc: string }> = {
    tara:  { emoji: '👩‍🎤', gender: 'female', desc: 'Warm & expressive' },
    leo:   { emoji: '🎙️', gender: 'male',   desc: 'Deep & confident' },
    leah:  { emoji: '👩‍💼', gender: 'female', desc: 'Clear & professional' },
    jessi: { emoji: '🌟', gender: 'female', desc: 'Bright & energetic' },
    dan:   { emoji: '🧑‍🎤', gender: 'male',   desc: 'Smooth & mellow' },
    mia:   { emoji: '🌸', gender: 'female', desc: 'Soft & friendly' },
    zac:   { emoji: '⚡', gender: 'male',   desc: 'Bold & dynamic' },
    zoe:   { emoji: '🦋', gender: 'female', desc: 'Light & playful' },
  };
  const VOICES = Object.keys(VOICE_META);

  const TONE_META: Record<string, { emoji: string; desc: string }> = {
    none:         { emoji: '🎯', desc: 'Natural' },
    calm:         { emoji: '🌊', desc: 'Calm' },
    romantic:     { emoji: '💝', desc: 'Romantic' },
    storytelling: { emoji: '📖', desc: 'Story' },
    horror:       { emoji: '🕯️', desc: 'Horror' },
    angry:        { emoji: '🔥', desc: 'Angry' },
    adventurous:  { emoji: '⚔️', desc: 'Adventure' },
    excited:      { emoji: '🚀', desc: 'Excited' },
    sad:          { emoji: '🌧️', desc: 'Sad' },
  };
  const TONES = Object.keys(TONE_META);

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

  const openSavePresetModal = () => {
    if (!user) return;
    const presets = user.presets || [];
    if (presets.length >= 3) {
      alert('You can only save up to 3 custom presets. Please delete one first.');
      return;
    }
    setPresetNameInput('');
    setSavePresetModal(true);
  };

  const confirmSavePreset = async () => {
    if (!user) return;
    const presets = user.presets || [];
    if (!presetNameInput || !presetNameInput.trim()) return;

    const newPreset = { name: presetNameInput.trim(), voice, tone, speed, temperature };
    const newPresets = [...presets, newPreset];
    
    try {
      const token = localStorage.getItem('token');
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const res = await fetch(`${API_URL}/auth/me`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ presets: newPresets }),
      });
      if (res.ok) {
        setUser({ ...user, presets: newPresets });
        setSavePresetModal(false);
      } else {
        alert('Failed to save preset.');
      }
    } catch (err) {
      console.error(err);
      alert('Network error saving preset.');
    }
  };

  const deleteCustomPreset = async (index: number) => {
    if (!user || !user.presets) return;
    if (!confirm('Delete this preset?')) return;
    
    const newPresets = user.presets.filter((_, i) => i !== index);
    try {
      const token = localStorage.getItem('token');
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const res = await fetch(`${API_URL}/auth/me`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ presets: newPresets }),
      });
      if (res.ok) {
        setUser({ ...user, presets: newPresets });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleGenerate = async () => {
    if (!text.trim()) return;
    setGenerating(true);
    setIsPlaying(true);
    setAudioUrl(null);
    setCloudMp3Url(null);
    setCloudReady(false);
    setCloudStatus('pending');
    generationStartRef.current = Date.now();
    
    // Initialize Audio Context for streaming playback
    if (!audioContextRef.current) {
      const AudioContextCtor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) throw new Error('AudioContext not supported');
      audioContextRef.current = new AudioContextCtor();
    }
    const context = audioContextRef.current;
    if (context.state === 'suspended') {
      await context.resume();
    }
    nextPlayTimeRef.current = context.currentTime + 0.1;

    try {
      // Frontend dropdown label "jessi" maps to the canonical Orpheus voice "jess".
      const resolvedVoice = voice === 'jessi' ? 'jess' : voice;
      const payload: Record<string, unknown> = { text, voice: resolvedVoice };
      if (tone) payload.tone = tone;
      if (!tone && speed !== 1.0) payload.speed = speed;
      // Always send the temperature the slider is on so the studio matches
      // what's shown in the UI. The old `!== 0.35` skip was a stale magic
      // number that didn't match the API's default (0.55), so the studio
      // silently rendered with a different temperature than the slider.
      payload.temperature = temperature;

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
        setUser((prev) => (prev ? { ...prev, creditsBalance: parseInt(remainingCredits, 10) } : prev));
      } else {
        // Optimistic fallback when the header is unavailable (CORS quirk etc).
        // Mirror the backend formula: 1 credit/char + 5 credits per valid emotion tag.
        const VALID_EMOTIONS = new Set(['laugh', 'chuckle', 'sigh', 'cough', 'sniffle', 'groan', 'yawn', 'gasp']);
        const matches = text.match(/<(\w+)>/g) || [];
        const validEmotions = matches.filter((m) => VALID_EMOTIONS.has(m.slice(1, -1).toLowerCase())).length;
        const cost = text.length + validEmotions * 5;
        setUser((prev) => (prev ? { ...prev, creditsBalance: Math.max(0, (prev.creditsBalance ?? 0) - cost) } : prev));
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
        
        if (done) {
          // ── Last-words fix ────────────────────────────────────────────────────
          // The final read() from a fetch stream typically returns {done:true, value:undefined}.
          // Any PCM left in leftoverBuffer from the previous iteration (didn't meet
          // MIN_CHUNK_SIZE) would be silently discarded — causing the last syllables
          // to play in the downloaded WAV but not in the live stream.
          // We flush it here before exiting the loop.
          if (leftoverBuffer.length >= 2) {
            const flushSamples = Math.floor(leftoverBuffer.length / 2);
            if (flushSamples > 0) {
              const int16Flush = new Int16Array(leftoverBuffer.buffer, leftoverBuffer.byteOffset, flushSamples);
              const f32Flush = new Float32Array(flushSamples);
              for (let i = 0; i < flushSamples; i++) {
                f32Flush[i] = int16Flush[i] / 32768.0;
              }
              const flushBuf = context.createBuffer(1, flushSamples, SAMPLE_RATE);
              flushBuf.copyToChannel(f32Flush, 0);
              const flushSrc = context.createBufferSource();
              flushSrc.buffer = flushBuf;
              flushSrc.connect(context.destination);
              const flushStart = Math.max(context.currentTime, nextPlayTimeRef.current);
              flushSrc.start(flushStart);
              nextPlayTimeRef.current = flushStart + flushBuf.duration;
              setGenerating(false);
            }
          }
          break;
        }
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
      await refreshCloudUrls();

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

  const refreshCloudUrls = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const attemptFetch = async () => {
      const res = await api.get('/auth/me');
      const nextMp3 = res.data.user?.lastAudioMp3Url || null;
      const updatedAtRaw = res.data.user?.lastAudioUpdatedAt || null;
      const updatedAt = updatedAtRaw ? new Date(updatedAtRaw).getTime() : 0;

      if (nextMp3 && updatedAt >= generationStartRef.current) {
        setCloudMp3Url(nextMp3);
        setCloudReady(true);
        if (nextMp3) {
          setCloudStatus('ready');
        }
        return true;
      }
      return false;
    };

    for (let i = 0; i < 10; i += 1) {
      try {
        const ok = await attemptFetch();
        if (ok) break;
      } catch {
        // ignore retry errors
      }
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    if (!cloudReady) {
      setCloudStatus('idle');
    }
  };

  const triggerDownloadFromBlobUrl = (blobUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleDirectDownload = async ({
    format,
    fallbackUrl,
    filename,
  }: {
    format: 'wav' | 'mp3';
    fallbackUrl?: string | null;
    filename: string;
  }) => {
    if (fallbackUrl && fallbackUrl.startsWith('blob:')) {
      triggerDownloadFromBlobUrl(fallbackUrl, filename);
      return;
    }

    try {
      const token = localStorage.getItem('token') || '';
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/v1/studio/download?format=${format}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      triggerDownloadFromBlobUrl(blobUrl, filename);
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Direct download failed', error);
      alert('Download failed. Please try again.');
    }
  };

  const handleTranscribe = async (blobOverride?: Blob) => {
    const source = blobOverride || (sttFile ? sttFile : null);
    if (!source) return;
    setGenerating(true);
    setSttResult('');
    setShowConfirm(false);

    try {
      const token = localStorage.getItem('token') || '';
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      
      const formData = new FormData();
      const fileName = blobOverride ? 'recording.webm' : (sttFile as File).name;
      formData.append('file', source, fileName);

      const response = await fetch(`${API_URL}/v1/studio/stt`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (!response.ok) throw new Error('Server error: ' + response.status);
      
      const data = await response.json() as { billing?: { creditsRemaining?: number }; text?: string };
      if (data.billing?.creditsRemaining !== undefined) {
        setUser((prev) => (prev ? { ...prev, creditsBalance: data.billing?.creditsRemaining } : prev));
      }
      if (data.text) setSttResult(data.text);
    } catch (err) {
      console.error('Transcription failed', err);
      alert('Failed to transcribe audio. Check credits or backend status.');
    } finally {
      setGenerating(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 1,
        }
      });
      setRecordedBlob(null);
      setRecordingUrl(null);
      setRecordingDuration(0);
      setRecordingTime(0);
      chunksRef.current = [];
      const preferredMime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const mr = new MediaRecorder(stream, {
        mimeType: preferredMime,
        audioBitsPerSecond: 192000,
      });
      mediaRecorderRef.current = mr;

      // Live visualizer via analyser
      const ctx = new AudioContext();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      src.connect(analyser);
      const dataArr = new Uint8Array(analyser.frequencyBinCount);
      const vizLoop = () => {
        if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') return;
        analyser.getByteFrequencyData(dataArr);
        const bars = Array.from({ length: 20 }, (_, i) => {
          const val = dataArr[Math.floor(i * (dataArr.length / 20))];
          return Math.max(4, Math.round((val / 255) * 48));
        });
        setVizBars(bars);
        requestAnimationFrame(vizLoop);
      };
      vizLoop();

      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstart = () => {
        setIsRecording(true);
        setRecordingTime(0);
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
      };
      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        ctx.close();
        if (timerRef.current) clearInterval(timerRef.current);
        setIsRecording(false);
        if (chunksRef.current.length === 0) {
          alert('No audio captured. Please try again.');
          return;
        }
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setRecordedBlob(blob);
        setRecordingUrl(url);
        setShowConfirm(true);
        setVizBars(Array(20).fill(4));
      };

      mr.start();
    } catch {
      alert('Could not access microphone. Please allow microphone permission.');
    }
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === 'recording') {
      recorder.requestData();
      recorder.stop();
    }
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold mb-2 bg-gradient-to-br from-neutral-900 to-neutral-500 bg-clip-text text-transparent">Voice Studio</h1>
          <p className="text-neutral-500">Design the perfect voiceover or transcribe audio with Whisper.</p>
        </div>
        <div className="flex bg-neutral-100 p-1.5 rounded-full w-fit shadow-inner border border-black/5 relative">
          <button 
            onClick={() => setSttMode('tts')}
            className={`relative px-6 py-2.5 rounded-full text-sm font-semibold transition-colors z-10 ${sttMode === 'tts' ? 'text-white' : 'text-neutral-500 hover:text-neutral-700'}`}
          >
            {sttMode === 'tts' && (
              <motion.div layoutId="modePill" className="absolute inset-0 bg-neutral-900 rounded-full shadow-md z-[-1]" transition={{ type: "spring", bounce: 0.2, duration: 0.5 }} />
            )}
            Text to Speech
          </button>
          <button 
            onClick={() => setSttMode('stt')}
            className={`relative px-6 py-2.5 rounded-full text-sm font-semibold transition-colors z-10 ${sttMode === 'stt' ? 'text-white' : 'text-neutral-500 hover:text-neutral-700'}`}
          >
            {sttMode === 'stt' && (
              <motion.div layoutId="modePill" className="absolute inset-0 bg-neutral-900 rounded-full shadow-md z-[-1]" transition={{ type: "spring", bounce: 0.2, duration: 0.5 }} />
            )}
            Speech to Text
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div 
          key={sttMode}
          initial={{ opacity: 0, y: 15, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: -15, filter: 'blur(8px)' }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className={`grid grid-cols-1 ${sttMode === 'tts' ? 'lg:grid-cols-3' : 'lg:grid-cols-1 max-w-4xl mx-auto w-full'} gap-8`}
        >
        
        {/* LEFT COLUMN: Editor & Output */}
        <div className={`${sttMode === 'tts' ? 'lg:col-span-2' : ''} flex flex-col gap-6`}>
          
          {sttMode === 'tts' ? (
            <>
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
            </>
          ) : (
            <>
              {/* STT Panel */}
              <div className="bg-white/80 backdrop-blur-2xl border border-black/5 rounded-3xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] overflow-hidden">
                {/* Header */}
                <div className="px-8 pt-8 pb-6 border-b border-black/5 text-center">
                  <h3 className="text-xl font-bold text-neutral-800 mb-1">Speech to Text</h3>
                  <p className="text-neutral-500 text-sm">Record your voice or upload a file. 1 credit per character.</p>
                </div>
                <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">

                  {/* LEFT: Record Live */}
                  <div className="flex flex-col items-center justify-center gap-5 p-6 bg-neutral-50 rounded-2xl border border-black/5">
                    <p className="text-xs font-semibold text-neutral-400 uppercase tracking-widest">Live Recording</p>
                    {/* Visualizer */}
                    <div className="flex items-end gap-[3px] h-14">
                      {vizBars.map((h, i) => (
                        <motion.div
                          key={i}
                          animate={{ height: h }}
                          transition={{ duration: 0.08 }}
                          style={{ height: h }}
                          className={`w-1.5 rounded-full ${isRecording ? 'bg-gradient-to-t from-orange-500 to-amber-400' : 'bg-neutral-200'}`}
                        />
                      ))}
                    </div>
                    {isRecording && (
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-sm font-mono font-bold text-red-600">{formatTime(recordingTime)}</span>
                        <span className="text-xs text-neutral-400">Recording...</span>
                      </div>
                    )}
                    {!isRecording ? (
                      <button
                        onClick={startRecording}
                        className="relative w-16 h-16 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-[0_8px_20px_rgba(249,115,22,0.4)] hover:shadow-[0_12px_28px_rgba(249,115,22,0.5)] transition-all hover:scale-105 active:scale-95 flex items-center justify-center"
                      >
                        <span className="absolute inset-0 rounded-full bg-orange-400/30 animate-ping" />
                        <Mic2 className="w-7 h-7 relative z-10" />
                      </button>
                    ) : (
                      <button
                        onClick={stopRecording}
                        className="w-16 h-16 rounded-full bg-red-500 text-white shadow-[0_8px_20px_rgba(239,68,68,0.4)] hover:shadow-[0_12px_28px_rgba(239,68,68,0.5)] transition-all hover:scale-105 active:scale-95 flex items-center justify-center"
                      >
                        <span className="w-5 h-5 bg-white rounded-sm" />
                      </button>
                    )}
                    <p className="text-xs text-neutral-400 text-center">{isRecording ? 'Click stop when done' : 'Click to start recording'}</p>
                  </div>

                  {/* RIGHT: Upload File */}
                  <div className="flex flex-col items-center justify-center gap-4 p-6 bg-neutral-50 rounded-2xl border border-dashed border-neutral-200">
                    <p className="text-xs font-semibold text-neutral-400 uppercase tracking-widest">Upload File</p>
                    <div className="w-14 h-14 bg-white rounded-2xl border border-black/8 flex items-center justify-center shadow-sm">
                      <Download className="w-6 h-6 text-neutral-400 rotate-180" />
                    </div>
                    <label className="cursor-pointer flex flex-col items-center gap-2 w-full">
                      <span className="text-sm font-semibold text-neutral-700">Choose audio file</span>
                      <span className="text-xs text-neutral-400">.wav, .mp3, .webm, .m4a</span>
                      <input type="file" accept="audio/*" className="hidden" onChange={e => setSttFile(e.target.files ? e.target.files[0] : null)} />
                      <span className="mt-1 px-4 py-2 bg-white border border-black/10 rounded-xl text-sm font-semibold text-neutral-600 shadow-sm hover:border-orange-300 hover:bg-orange-50 transition-all">Browse</span>
                    </label>
                    {sttFile && (
                      <div className="w-full bg-white border border-orange-200 rounded-xl p-3 text-center">
                        <p className="text-xs font-semibold text-orange-700 truncate">{sttFile.name}</p>
                      </div>
                    )}
                    <button
                      onClick={() => handleTranscribe()}
                      disabled={generating || !sttFile}
                      className="w-full bg-gradient-to-br from-orange-500 to-amber-500 text-white py-3 rounded-2xl font-semibold shadow-[0_6px_18px_rgba(249,115,22,0.25)] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Wand2 className="w-4 h-4" /> Transcribe</>}
                    </button>
                  </div>
                </div>
              </div>

              {/* Confirmation Modal */}
              <AnimatePresence>
                {showConfirm && (
                  <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
                  >
                    <motion.div
                      initial={{ opacity: 0, scale: 0.92, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.92, y: 20 }}
                      transition={{ type: 'spring', bounce: 0.25, duration: 0.4 }}
                      className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md border border-black/5"
                    >
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center border border-orange-100">
                          <Mic2 className="w-5 h-5 text-orange-500" />
                        </div>
                        <div>
                          <h4 className="font-bold text-neutral-900">Recording Preview</h4>
                          <p className="text-xs text-neutral-400">Listen before sending for transcription</p>
                        </div>
                      </div>
                      {recordingUrl && (
                        <div className="bg-neutral-50 border border-black/5 rounded-2xl p-4 mb-6">
                          <audio
                            controls
                            src={recordingUrl}
                            className="w-full h-10 rounded-lg"
                            onLoadedMetadata={(event) => {
                              const duration = event.currentTarget.duration;
                              if (Number.isFinite(duration)) {
                                setRecordingDuration(Math.round(duration));
                              }
                            }}
                          />
                          <p className="text-[10px] text-neutral-400 text-center mt-2 font-medium">
                            Duration: {formatTime(recordingDuration || recordingTime)} · High-quality 48kHz audio
                          </p>
                        </div>
                      )}
                      <div className="flex gap-3">
                        <button
                          onClick={() => {
                            setShowConfirm(false);
                            setRecordedBlob(null);
                            setRecordingUrl(null);
                            setRecordingDuration(0);
                            setRecordingTime(0);
                          }}
                          className="flex-1 py-3 rounded-2xl border border-black/10 text-sm font-semibold text-neutral-600 hover:bg-neutral-50 transition-all"
                        >
                          🔄 Re-record
                        </button>
                        <button
                          onClick={() => recordedBlob && handleTranscribe(recordedBlob)}
                          disabled={generating}
                          className="flex-1 py-3 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-white text-sm font-semibold shadow-[0_6px_18px_rgba(249,115,22,0.3)] transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                        >
                          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Wand2 className="w-4 h-4" /> Transcribe</>}
                        </button>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}

          {/* Output Section */}
          <div ref={outputRef} className="bg-white/60 backdrop-blur-2xl border border-black/5 rounded-3xl p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
            <div className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-orange-50 border border-orange-100 text-orange-700 shadow-sm w-fit mb-5 text-xs font-bold uppercase tracking-widest">
               <Activity className="w-4 h-4 text-orange-500" />
               {sttMode === 'tts' ? 'Audio Output' : 'Transcription Output'}
            </div>
            
            {sttMode === 'tts' ? (
              audioUrl ? (
                <div className="bg-gradient-to-br from-orange-50 to-amber-50/50 border border-orange-200/60 rounded-2xl p-5 shadow-inner relative overflow-hidden">
                  {/* Background decorative blob */}
                  <div className="absolute -right-10 -top-10 w-32 h-32 bg-orange-400/10 blur-3xl rounded-full pointer-events-none" />
                  
                  <div className="flex flex-col gap-4 relative z-10">
                    <div className="w-full">
                      <audio controls src={audioUrl} className="w-full h-12 rounded-lg" />
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleDirectDownload({
                          format: 'wav',
                          fallbackUrl: audioUrl,
                          filename: 'linguamic-audio.wav',
                        })}
                        className="bg-orange-500 text-white flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold shadow-[0_4px_14px_rgba(249,115,22,0.3)] hover:bg-orange-600 transition-all hover:scale-[1.02] active:scale-[0.98]"
                      >
                        <Download className="w-4 h-4" /> Download WAV
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (cloudMp3Url) {
                            handleDirectDownload({
                              format: 'mp3',
                              filename: 'linguamic-audio.mp3',
                            });
                          }
                        }}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold shadow-[0_4px_14px_rgba(0,0,0,0.12)] transition-all ${cloudMp3Url ? 'bg-neutral-900 text-white hover:bg-neutral-800' : 'bg-neutral-200 text-neutral-400 cursor-not-allowed'}`}
                        aria-disabled={!cloudMp3Url}
                      >
                        <Download className="w-4 h-4" /> Download MP3
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCloudStatus('pending');
                          refreshCloudUrls();
                        }}
                        className="h-10 w-10 rounded-full border border-neutral-200 text-neutral-600 hover:bg-white flex items-center justify-center"
                        aria-label="Refresh cloud links"
                      >
                        <RefreshCw className={`w-4 h-4 ${cloudStatus === 'pending' ? 'animate-spin' : ''}`} />
                      </button>
                      {cloudStatus === 'pending' && !cloudMp3Url && (
                        <p className="text-[10px] text-neutral-400">MP3 is processing. WAV download is ready.</p>
                      )}
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
                 <p className="text-sm text-neutral-400 max-w-sm">Hit the &quot;Generate Voiceover&quot; button above and your high-fidelity audio will appear right here.</p>
              </div>
            )
            ) : (
              sttResult ? (
                <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-6 relative overflow-hidden shadow-inner">
                  <p className="text-neutral-800 text-lg leading-relaxed">{sttResult}</p>
                </div>
              ) : (
                <div className="border-2 border-dashed border-black/5 bg-neutral-50/50 rounded-2xl p-10 flex flex-col items-center justify-center text-center">
                   <div className="w-16 h-16 bg-white shadow-sm border border-black/5 rounded-full flex items-center justify-center mb-4">
                     <Mic2 className="w-8 h-8 text-neutral-300" />
                   </div>
                   <h4 className="text-neutral-700 font-semibold mb-1">No transcription yet</h4>
                   <p className="text-sm text-neutral-400 max-w-sm">Upload an audio file and hit Transcribe.</p>
                </div>
              )
            )}
          </div>

        </div>

        {/* RIGHT COLUMN: Settings */}
        {sttMode === 'tts' && (
          <div className="lg:col-span-1 space-y-6">
          
          <div className="bg-white/60 backdrop-blur-2xl border border-black/5 rounded-3xl p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)] sticky top-24">
            <h3 className="text-lg font-semibold mb-6 flex items-center gap-2 text-neutral-800"><SlidersHorizontal className="w-5 h-5 text-orange-500"/> Studio Controls</h3>
            
            {/* Voice Model Dropdown */}
            <div className="mb-5" ref={voiceRef}>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Voice Model</label>
                <div className="flex items-center gap-2 text-[10px] text-neutral-400 font-medium">
                  <span className="flex items-center gap-1"><User className="w-3 h-3 text-blue-400" /> ♀ Female</span>
                  <span className="flex items-center gap-1"><User className="w-3 h-3 text-violet-400" /> ♂ Male</span>
                </div>
              </div>
              <div className="relative">
                {/* Trigger */}
                <button
                  onClick={() => { setVoiceOpen(o => !o); setToneOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-white border border-black/10 rounded-2xl shadow-sm hover:border-orange-300 hover:bg-orange-50/30 transition-all"
                >
                  <span className="text-xl leading-none">{VOICE_META[voice]?.emoji}</span>
                  <div className="flex-1 text-left min-w-0">
                    <div className="text-sm font-bold text-neutral-800 capitalize">{voice === 'jessi' ? 'Jessi' : voice.charAt(0).toUpperCase() + voice.slice(1)}</div>
                    <div className={`text-[10px] font-medium ${VOICE_META[voice]?.gender === 'female' ? 'text-blue-500' : 'text-violet-500'}`}>
                      {VOICE_META[voice]?.gender === 'female' ? '♀' : '♂'} {VOICE_META[voice]?.desc}
                    </div>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform ${voiceOpen ? 'rotate-180' : ''}`} />
                </button>
                {/* Panel */}
                <AnimatePresence>
                  {voiceOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.97 }}
                      transition={{ duration: 0.18, ease: 'easeOut' }}
                      className="absolute z-50 top-full left-0 right-0 mt-2 bg-white border border-black/10 rounded-2xl shadow-xl overflow-hidden max-h-56 overflow-y-auto"
                    >
                      {VOICES.map(v => {
                        const meta = VOICE_META[v];
                        const isActive = voice === v;
                        return (
                          <button
                            key={v}
                            onClick={() => { setVoice(v); setVoiceOpen(false); }}
                            className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all hover:bg-neutral-50 ${
                              isActive ? 'bg-orange-50' : ''
                            }`}
                          >
                            <span className="text-xl leading-none">{meta.emoji}</span>
                            <div className="flex-1 min-w-0">
                              <div className={`text-sm font-bold capitalize ${isActive ? 'text-orange-600' : 'text-neutral-800'}`}>
                                {v === 'jessi' ? 'Jessi' : v.charAt(0).toUpperCase() + v.slice(1)}
                              </div>
                              <div className={`text-[10px] font-medium ${meta.gender === 'female' ? 'text-blue-500' : 'text-violet-500'}`}>
                                {meta.gender === 'female' ? '♀ Female' : '♂ Male'} · {meta.desc}
                              </div>
                            </div>
                            {isActive && <div className="w-2 h-2 rounded-full bg-orange-400 shrink-0" />}
                          </button>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Speaking Tone Dropdown */}
            <div className="mb-5" ref={toneRef}>
              <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">Speaking Tone</label>
              <div className="relative">
                {/* Trigger */}
                <button
                  onClick={() => { setToneOpen(o => !o); setVoiceOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-white border border-black/10 rounded-2xl shadow-sm hover:border-orange-300 hover:bg-orange-50/30 transition-all"
                >
                  <span className="text-xl leading-none">{TONE_META[tone || 'none']?.emoji}</span>
                  <div className="flex-1 text-left">
                    <div className="text-sm font-bold text-neutral-800">{TONE_META[tone || 'none']?.desc}</div>
                    <div className="text-[10px] font-medium text-neutral-400">Speaking style preset</div>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform ${toneOpen ? 'rotate-180' : ''}`} />
                </button>
                {/* Panel */}
                <AnimatePresence>
                  {toneOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.97 }}
                      transition={{ duration: 0.18, ease: 'easeOut' }}
                      className="absolute z-50 top-full left-0 right-0 mt-2 bg-white border border-black/10 rounded-2xl shadow-xl overflow-hidden max-h-64 overflow-y-auto"
                    >
                      {TONES.map(t => {
                        const meta = TONE_META[t];
                        const isActive = (tone || 'none') === t;
                        return (
                          <button
                            key={t}
                            onClick={() => { handleToneChange(t); setToneOpen(false); }}
                            className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all hover:bg-neutral-50 ${
                              isActive ? 'bg-orange-50' : ''
                            }`}
                          >
                            <span className="text-xl leading-none">{meta.emoji}</span>
                            <div className="flex-1">
                              <div className={`text-sm font-bold ${isActive ? 'text-orange-600' : 'text-neutral-800'}`}>{meta.desc}</div>
                              <div className="text-[10px] font-medium text-neutral-400">
                                {t === 'none' ? 'No tone modifier applied' : `Applies ${meta.desc.toLowerCase()} speaking style`}
                              </div>
                            </div>
                            {isActive && <div className="w-2 h-2 rounded-full bg-orange-400 shrink-0" />}
                          </button>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
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
              <div className="flex justify-between items-end mb-3">
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider">Presets</label>
                <button 
                  onClick={openSavePresetModal}
                  disabled={(user?.presets?.length || 0) >= 3}
                  className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded-md border border-orange-100 hover:bg-orange-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  + Save Current
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                {['Vibey', 'Relaxed', 'Action'].map(p => (
                  <button key={p} onClick={() => applyPreset(p)} className="px-3 py-2 border border-black/5 rounded-xl text-sm font-semibold text-neutral-600 transition-all shadow-sm hover:border-orange-300 hover:bg-orange-50 hover:text-orange-600 active:scale-95 text-center">
                    {p}
                  </button>
                ))}
              </div>
              {user?.presets && user.presets.length > 0 && (
                <div className="space-y-2 mt-4 pt-4 border-t border-black/5">
                  <label className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">My Custom Presets</label>
                  {user.presets.map((p, idx) => (
                    <div key={idx} className="flex gap-2">
                      <button 
                        onClick={() => {
                          setVoice(p.voice);
                          setTone(p.tone);
                          setSpeed(p.speed);
                          setTemperature(p.temperature);
                        }} 
                        className="flex-1 px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-sm font-semibold text-white transition-all shadow-sm hover:bg-neutral-800 active:scale-95 text-left truncate"
                      >
                        {p.name}
                      </button>
                      <button 
                        onClick={() => deleteCustomPreset(idx)}
                        className="px-3 py-2 border border-red-200 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors"
                        title="Delete Preset"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
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
        )}
        </motion.div>

        {/* Save Preset Modal */}
        <AnimatePresence>
          {savePresetModal && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: 20 }}
                transition={{ type: 'spring', bounce: 0.25, duration: 0.4 }}
                className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md border border-black/5"
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center border border-orange-100">
                    <SlidersHorizontal className="w-5 h-5 text-orange-500" />
                  </div>
                  <div>
                    <h4 className="font-bold text-neutral-900">Save Custom Preset</h4>
                    <p className="text-xs text-neutral-400">Name your current studio settings</p>
                  </div>
                </div>
                
                <div className="mb-6">
                  <input
                    type="text"
                    autoFocus
                    placeholder="e.g. My Podcast Voice"
                    value={presetNameInput}
                    onChange={(e) => setPresetNameInput(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 text-neutral-900 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all font-medium"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') confirmSavePreset();
                    }}
                  />
                  
                  <div className="mt-4 bg-orange-50/50 border border-orange-100/50 p-3 rounded-xl">
                    <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">Saving configuration:</p>
                    <div className="grid grid-cols-2 gap-2 text-xs font-medium text-neutral-700">
                      <div className="bg-white px-2 py-1.5 rounded-lg border border-black/5 shadow-sm truncate">🎙️ {voice === 'jessi' ? 'Jessi' : voice.charAt(0).toUpperCase() + voice.slice(1)}</div>
                      <div className="bg-white px-2 py-1.5 rounded-lg border border-black/5 shadow-sm truncate">🎭 {tone || 'Neutral'}</div>
                      <div className="bg-white px-2 py-1.5 rounded-lg border border-black/5 shadow-sm truncate">⚡ {speed.toFixed(2)}x Speed</div>
                      <div className="bg-white px-2 py-1.5 rounded-lg border border-black/5 shadow-sm truncate">🌡️ {temperature.toFixed(2)} Temp</div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setSavePresetModal(false)}
                    className="flex-1 py-3 rounded-2xl border border-black/10 text-sm font-semibold text-neutral-600 hover:bg-neutral-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmSavePreset}
                    disabled={!presetNameInput.trim()}
                    className="flex-1 py-3 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-white text-sm font-semibold shadow-[0_6px_18px_rgba(249,115,22,0.3)] transition-all flex items-center justify-center gap-2 hover:shadow-[0_8px_25px_rgba(249,115,22,0.4)] disabled:opacity-50"
                  >
                    Save Preset
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </AnimatePresence>
    </motion.div>
  );
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

function BillingView({ user, setUser }: { user: UserProfile | null; setUser: React.Dispatch<React.SetStateAction<UserProfile | null>> }) {
  const planKey            = (user?.plan || 'FREE').toString().toLowerCase();
  const theme              = PLAN_THEMES[planKey] || PLAN_THEMES.free;
  const monthlyAllocation  = user?.planMonthlyCredits || 10000;
  const balance            = user?.creditsBalance || 0;
  const usedFromMonthly    = Math.max(0, monthlyAllocation - balance);
  const percent            = Math.min(100, Math.max(0, (usedFromMonthly / monthlyAllocation) * 100));
  const hasTopUpSurplus    = balance > monthlyAllocation;
  const isPro              = theme.isPro === true;

  // Subscription state — FREE plans can't manage anything. Auto-pay toggle and
  // cancel/resume buttons are gated on this.
  const isFreePlan         = (user?.plan || 'FREE') === 'FREE';
  const subStatus          = user?.subscriptionStatus || 'NONE';
  const autoRenew          = user?.autoRenew === true;
  const isCanceled         = subStatus === 'CANCELED' || (!isFreePlan && !autoRenew);
  const periodEnd          = user?.currentPeriodEnd ? new Date(user.currentPeriodEnd) : null;
  const periodEndLabel     = periodEnd ? periodEnd.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : null;

  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [txLoading, setTxLoading] = useState(true);
  const [subBusy, setSubBusy] = useState(false);
  const [subError, setSubError] = useState<string | null>(null);
  const [refundModal, setRefundModal] = useState<RefundModalState>({ open: false, step: 'confirm' });

  const refreshUser = async () => {
    try {
      const res = await api.get('/auth/me');
      setUser(res.data.user);
    } catch {
      /* ignore — next page navigation will re-fetch */
    }
  };

  const toggleAutoPay = async (next: boolean) => {
    if (isFreePlan) return;
    setSubBusy(true);
    setSubError(null);
    try {
      await api.post('/billing/subscription/autopay', { enabled: next });
      await refreshUser();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to update auto-pay';
      setSubError(msg);
    } finally {
      setSubBusy(false);
    }
  };

  const confirmCancel = async () => {
    if (isFreePlan) return;
    setSubBusy(true);
    setSubError(null);
    try {
      await api.post('/billing/subscription/cancel');
      await refreshUser();
      setRefundModal({ open: true, step: 'submitted' });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to cancel subscription';
      setSubError(msg);
      setRefundModal({ open: false, step: 'confirm' });
    } finally {
      setSubBusy(false);
    }
  };

  const resumeSubscription = async () => {
    if (isFreePlan) return;
    setSubBusy(true);
    setSubError(null);
    try {
      await api.post('/billing/subscription/resume');
      await refreshUser();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to resume subscription';
      setSubError(msg);
    } finally {
      setSubBusy(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    setTxLoading(true);
    api.get('/billing/transactions?limit=10')
      .then((res) => {
        if (!isMounted) return;
        setTransactions(res.data.transactions || []);
      })
      .catch(() => {
        if (!isMounted) return;
        setTransactions([]);
      })
      .finally(() => {
        if (!isMounted) return;
        setTxLoading(false);
      });
    return () => { isMounted = false; };
  }, []);

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

      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className={`mt-6 rounded-2xl border p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)] ${theme.usageCardBg} ${theme.usageCardBorder}`}
      >
        {isFreePlan ? (
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 p-4 rounded-2xl border border-dashed border-neutral-200 bg-neutral-50">
            <div>
              <div className={`text-[11px] font-bold uppercase tracking-widest ${theme.usageAccent}`}>Subscription</div>
              <p className={`text-sm ${theme.usageSub}`}>You&apos;re on the FREE plan. Upgrade to enable auto-pay and subscription management.</p>
            </div>
            <Link
              href="/pricing"
              className="h-11 px-4 rounded-full font-semibold text-sm bg-black text-white hover:bg-neutral-800 transition-all inline-flex items-center"
            >
              View plans
            </Link>
          </div>
        ) : (
          <>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
              <div>
                <div className={`text-[11px] font-bold uppercase tracking-widest ${theme.usageAccent}`}>Auto-Pay</div>
                <p className={`text-sm ${theme.usageSub}`}>
                  {autoRenew
                    ? (periodEndLabel ? `Renews on ${periodEndLabel}.` : 'Auto-renews monthly.')
                    : (periodEndLabel ? `Auto-pay off — plan ends ${periodEndLabel}.` : 'Auto-pay is off.')}
                </p>
              </div>
              <button
                type="button"
                disabled={subBusy}
                onClick={() => toggleAutoPay(!autoRenew)}
                className={`h-11 px-4 rounded-full font-semibold text-sm border transition-all disabled:opacity-50 disabled:cursor-wait ${
                  autoRenew
                    ? 'bg-orange-500 text-white border-orange-500 hover:bg-orange-600'
                    : 'bg-neutral-100 text-neutral-500 border-neutral-200 hover:bg-neutral-200'
                }`}
              >
                {autoRenew ? 'Auto-Pay On' : 'Auto-Pay Off'}
              </button>
            </div>

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
              <div>
                <div className={`text-[11px] font-bold uppercase tracking-widest ${theme.usageAccent}`}>
                  {isCanceled ? 'Subscription Cancelled' : 'Cancel Subscription'}
                </div>
                <p className={`text-sm ${theme.usageSub}`}>
                  {isCanceled
                    ? (periodEndLabel
                        ? `Access continues until ${periodEndLabel}, then your account reverts to FREE.`
                        : 'Your subscription is cancelled.')
                    : 'Cancel your subscription renewal at the end of the billing cycle.'}
                </p>
              </div>
              {isCanceled ? (
                <button
                  type="button"
                  disabled={subBusy}
                  onClick={resumeSubscription}
                  className="h-11 px-4 rounded-full font-semibold text-sm bg-emerald-500 text-white hover:bg-emerald-600 transition-all disabled:opacity-50 disabled:cursor-wait"
                >
                  Resume Subscription
                </button>
              ) : (
                <button
                  type="button"
                  disabled={subBusy}
                  onClick={() => setRefundModal({ open: true, step: 'confirm' })}
                  className="h-11 px-4 rounded-full font-semibold text-sm border border-red-200 text-red-600 hover:bg-red-50 transition-all disabled:opacity-50 disabled:cursor-wait"
                >
                  Cancel Subscription
                </button>
              )}
            </div>

            {subError && (
              <div className="mb-6 px-4 py-3 rounded-xl text-sm font-medium border border-red-200 bg-red-50 text-red-700">
                {subError}
              </div>
            )}
          </>
        )}

        <div className="h-px w-full bg-black/5 mb-6" />

        <div className="flex items-center justify-between mb-4">
          <div className={`text-[11px] font-bold uppercase tracking-widest ${theme.usageAccent}`}>Transaction History</div>
          <div className={`text-[11px] font-medium px-3 py-1 rounded-full ${theme.isDark ? 'bg-white/10 text-neutral-400' : 'bg-neutral-100 text-neutral-400'}`}>
            Last 10
          </div>
        </div>

        {txLoading ? (
          <div className="flex items-center gap-2 text-sm text-neutral-500">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading transactions...
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-sm text-neutral-500">No transactions yet.</div>
        ) : (
          <div className="space-y-3">
            {transactions.map((tx) => (
              <div key={tx.id} className={`flex flex-col md:flex-row md:items-center md:justify-between gap-2 rounded-xl border p-4 ${theme.trackBg}`}>
                <div>
                  <div className={`text-sm font-semibold ${theme.usageText}`}>{tx.type.replace(/_/g, ' ')}</div>
                  <div className={`text-xs ${theme.usageSub}`}>{tx.description || 'Credit transaction'}</div>
                  <div className={`text-[10px] ${theme.usageSub}`}>{new Date(tx.createdAt).toLocaleString()}</div>
                </div>
                <div className={`text-sm font-bold ${tx.amount >= 0 ? theme.usageAccent : 'text-red-500'}`}>
                  {tx.amount >= 0 ? '+' : ''}{tx.amount.toLocaleString()} credits
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      <AnimatePresence>
        {refundModal.open && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              transition={{ type: 'spring', bounce: 0.25, duration: 0.4 }}
              className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md border border-black/5"
            >
              {refundModal.step === 'confirm' ? (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center border border-orange-100">
                      <CreditCard className="w-5 h-5 text-orange-500" />
                    </div>
                    <div>
                      <h4 className="font-bold text-neutral-900">Cancel subscription</h4>
                      <p className="text-xs text-neutral-400">Confirm you want to cancel your subscription.</p>
                    </div>
                  </div>
                  <p className="text-sm text-neutral-600 mb-6">
                    Refunds are only possible if cancelled within 24 hours and less than 5,000 credits are used.
                  </p>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setRefundModal({ open: false, step: 'confirm' })}
                      className="flex-1 py-3 rounded-2xl border border-black/10 text-sm font-semibold text-neutral-600 hover:bg-neutral-50 transition-all"
                    >
                      Keep subscription
                    </button>
                    <button
                      type="button"
                      disabled={subBusy}
                      onClick={confirmCancel}
                      className="flex-1 py-3 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-white text-sm font-semibold shadow-[0_6px_18px_rgba(249,115,22,0.3)] transition-all disabled:opacity-50 disabled:cursor-wait"
                    >
                      {subBusy ? 'Cancelling…' : 'Confirm cancellation'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center border border-green-100">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <h4 className="font-bold text-neutral-900">Subscription cancelled</h4>
                      <p className="text-xs text-neutral-400">Auto-pay is off.</p>
                    </div>
                  </div>
                  <p className="text-sm text-neutral-600 mb-6">
                    {periodEndLabel
                      ? `You keep full access until ${periodEndLabel}. After that your account reverts to the FREE plan. You can resume any time before then.`
                      : 'You keep access until the end of your billing period. After that your account reverts to the FREE plan.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => setRefundModal({ open: false, step: 'confirm' })}
                    className="w-full py-3 rounded-2xl bg-black text-white text-sm font-semibold hover:bg-neutral-800 transition-all"
                  >
                    Close
                  </button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}



function SettingsView({ user, setUser }: { user: UserProfile | null; setUser: React.Dispatch<React.SetStateAction<UserProfile | null>> }) {
  const [name, setName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await api.put('/auth/me', { name: name.trim() });
      setUser((prev) => (prev ? { ...prev, name: res.data.user.name } : prev));
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

