"use client";
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { 
  Mic2, KeyRound, CreditCard, Settings, LogOut, 
  Play, Download, Plus, Copy, Trash2, ChevronDown, Sparkles, Loader2, Wand2, SlidersHorizontal, Activity 
} from 'lucide-react';
import api from '@/lib/api';

const tabs = [
  { id: 'playground', label: 'Studio Playground', icon: Mic2 },
  { id: 'billing', label: 'Usage & Billing', icon: CreditCard },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function Studio() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('playground');
  const [text, setText] = useState('');
  
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    api.get('/auth/me')
      .then(res => {
        setUser(res.data.user);
        setAuthLoading(false);
      })
      .catch(() => {
        localStorage.removeItem('token');
        router.push('/login');
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
            {activeTab === 'billing' && <BillingView key="billing" user={user} />}
            {activeTab === 'settings' && <SettingsView key="settings" user={user} />}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

// Sub-components
function PlaygroundView({ text, setText, user, setUser }: { text: string, setText: (val: string) => void, user: any, setUser: any }) {
  const [generating, setGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  
  const [voice, setVoice] = useState('tara');
  const [tone, setTone] = useState('');
  const [speed, setSpeed] = useState(1.0);
  const [showTuning, setShowTuning] = useState(false);
  const [temperature, setTemperature] = useState(0.35);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const TONE_SPEEDS: Record<string, number> = {
    calm: 0.94, romantic: 0.92, storytelling: 0.95, horror: 0.93, 
    angry: 1.12, adventurous: 1.05, excited: 1.09, sad: 0.93
  };

  const EMOTIONS = ['giggle', 'laugh', 'chuckle', 'sigh', 'cough', 'sniffle', 'groan', 'yawn', 'gasp'];
  const VOICES = ['tara', 'leo', 'leah', 'jessi', 'dan', 'mia', 'zac', 'zoe', 'sarah', 'echo', 'onyx', 'fable'];
  const TONES = ['none', 'calm', 'romantic', 'storytelling', 'horror', 'angry', 'adventurous', 'excited', 'sad'];

  const handleToneChange = (newTone: string) => {
    setTone(newTone === 'none' ? '' : newTone);
    if (newTone !== 'none' && TONE_SPEEDS[newTone]) {
      setSpeed(TONE_SPEEDS[newTone]);
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
    try {
      const payload: any = { text, voice_id: voice };
      if (tone) payload.tone = tone;
      if (speed !== 1.0) payload.speed = speed;
      if (temperature !== 0.35) payload.temperature = temperature;

      const res = await api.post('/v1/studio/tts', payload, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'audio/wav' }));
      setAudioUrl(url);
      
      setUser((prev: any) => ({ ...prev, creditsBalance: Math.max(0, prev.creditsBalance - text.length) }));
    } catch (err) {
      console.error('Generation failed', err);
      alert('Failed to generate audio. Check credits or backend status.');
    } finally {
      setGenerating(false);
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
                disabled={generating || text.length === 0}
                className="w-full bg-gradient-to-br from-orange-500 to-amber-500 text-white px-8 py-4 rounded-2xl font-semibold shadow-[0_8px_20px_rgba(249,115,22,0.25)] hover:shadow-[0_12px_25px_rgba(249,115,22,0.35)] transition-all flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generating ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Wand2 className="w-5 h-5" /> Generate Voiceover</>}
              </button>
            </div>
          </div>

          {/* Output */}
          <AnimatePresence>
            {audioUrl && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white/80 backdrop-blur-xl border border-orange-200/60 rounded-3xl p-6 shadow-[0_8px_30px_rgba(249,115,22,0.08)]">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-orange-600 flex items-center gap-2"><Activity className="w-4 h-4"/> Audio Ready</h3>
                  <a href={audioUrl} download="voiceforge-audio.wav" className="text-orange-600 hover:text-white hover:bg-orange-500 flex items-center gap-1.5 text-sm font-semibold bg-orange-50 px-4 py-2 rounded-xl transition-colors shadow-sm border border-orange-100 hover:border-orange-500">
                    <Download className="w-4 h-4" /> Download
                  </a>
                </div>
                <audio controls src={audioUrl} className="w-full" autoPlay />
              </motion.div>
            )}
          </AnimatePresence>

        </div>

        {/* RIGHT COLUMN: Settings */}
        <div className="lg:col-span-1 space-y-6">
          
          <div className="bg-white/60 backdrop-blur-2xl border border-black/5 rounded-3xl p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)] sticky top-24">
            <h3 className="text-lg font-semibold mb-6 flex items-center gap-2 text-neutral-800"><SlidersHorizontal className="w-5 h-5 text-orange-500"/> Studio Controls</h3>
            
            {/* Voice */}
            <div className="mb-6">
              <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">Voice Model</label>
              <div className="relative">
                <select value={voice} onChange={e => setVoice(e.target.value)} className="w-full bg-white border border-black/10 text-neutral-800 rounded-xl px-4 py-3 appearance-none focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 font-medium capitalize cursor-pointer shadow-sm">
                  {VOICES.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
                <ChevronDown className="w-4 h-4 text-neutral-400 absolute right-4 top-3.5 pointer-events-none" />
              </div>
            </div>

            {/* Tone */}
            <div className="mb-6">
              <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">Speaking Tone</label>
              <div className="relative">
                <select value={tone || 'none'} onChange={e => handleToneChange(e.target.value)} className="w-full bg-white border border-black/10 text-neutral-800 rounded-xl px-4 py-3 appearance-none focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 font-medium capitalize cursor-pointer shadow-sm">
                  {TONES.map(t => <option key={t} value={t}>{t === 'none' ? 'Neutral (No Tone)' : t}</option>)}
                </select>
                <ChevronDown className="w-4 h-4 text-neutral-400 absolute right-4 top-3.5 pointer-events-none" />
              </div>
            </div>

            {/* Speed Slider (Glassy) */}
            <div className="mb-8">
              <div className="flex justify-between items-end mb-3">
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider">Speed Multiplier</label>
                <span className="text-xs font-bold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-md border border-orange-200">{speed.toFixed(2)}x</span>
              </div>
              <input 
                type="range" min="0.80" max="1.30" step="0.01" 
                value={speed} onChange={e => setSpeed(parseFloat(e.target.value))}
                className="w-full h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
              />
              <div className="flex justify-between text-[10px] text-neutral-400 mt-1.5 font-medium uppercase tracking-widest">
                <span>0.8x Slower</span>
                <span>1.3x Faster</span>
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

function ApiKeysView() {
  const [keys, setKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api-keys').then(res => {
      setKeys(res.data.keys);
      setLoading(false);
    });
  }, []);

  const createKey = async () => {
    try {
      const res = await api.post('/api-keys', { name: `Key ${new Date().toLocaleDateString()}` });
      setKeys([...keys, res.data.key]);
      alert(`Save this key, it won't be shown again: ${res.data.rawApiKey}`);
    } catch(e) {
      alert("Failed to create key");
    }
  };

  const deleteKey = async (id: string) => {
    try {
      await api.delete(`/api-keys/${id}`);
      setKeys(keys.filter(k => k.id !== id));
    } catch(e) {}
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold mb-2">API Keys</h1>
          <p className="text-neutral-500">Manage your secret keys for authenticating API requests.</p>
        </div>
        <button onClick={createKey} className="bg-black text-white px-4 py-2.5 rounded-xl font-medium shadow-[0_4px_14px_0_rgba(0,0,0,0.1)] hover:bg-neutral-800 transition-all flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98]">
          <Plus className="w-4 h-4" /> Create new key
        </button>
      </div>

      <div className="bg-white border border-black/5 rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.03)] overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-neutral-50/50 border-b border-black/5 text-xs uppercase tracking-wider text-neutral-500 font-semibold">
              <th className="p-4 pl-6">Name</th>
              <th className="p-4">Key Prefix</th>
              <th className="p-4">Created</th>
              <th className="p-4 pr-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {loading ? (
              <tr><td colSpan={4} className="p-8 text-center text-neutral-400">Loading keys...</td></tr>
            ) : keys.length === 0 ? (
              <tr><td colSpan={4} className="p-8 text-center text-neutral-400">No API keys found.</td></tr>
            ) : keys.map(k => (
              <tr key={k.id} className="border-b border-black/5 hover:bg-neutral-50/50 transition-colors group">
                <td className="p-4 pl-6 font-medium text-neutral-900">{k.name}</td>
                <td className="p-4 font-mono text-neutral-500">{k.prefix}••••••••••••••••</td>
                <td className="p-4 text-neutral-500">{new Date(k.createdAt).toLocaleDateString()}</td>
                <td className="p-4 pr-6 flex justify-end gap-2">
                  <button onClick={() => deleteKey(k.id)} className="p-2 text-neutral-400 hover:text-red-600 bg-white border border-black/5 rounded-lg shadow-sm hover:shadow transition-all opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="p-4 px-6 bg-orange-50/50 border-t border-orange-100 text-sm text-orange-800">
          <span className="font-semibold">Security Note:</span> Actual secret keys are only shown once upon creation via the API.
        </div>
      </div>
    </motion.div>
  )
}

function BillingView({ user }: { user: any }) {
  const maxCredits = 12000;
  const used = maxCredits - (user?.creditsBalance || 0);
  const percent = Math.min(100, Math.max(0, (used / maxCredits) * 100));

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold mb-2">Usage & Billing</h1>
        <p className="text-neutral-500">Monitor your credit consumption and manage your plan.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white border border-black/5 rounded-2xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-neutral-500 uppercase tracking-wider mb-6">
             <CreditCard className="w-4 h-4" /> Current Plan
          </div>
          <div>
            <h2 className="text-3xl font-semibold mb-1">Free Tier</h2>
            <p className="text-neutral-500 text-sm">12,000 characters / month</p>
          </div>
          <button className="mt-8 w-full py-2.5 bg-orange-50 text-orange-600 font-semibold rounded-xl hover:bg-orange-100 transition-colors border border-orange-100 shadow-sm">
            Upgrade Plan
          </button>
        </div>

        <div className="bg-white border border-black/5 rounded-2xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)] md:col-span-2">
           <div className="flex items-center justify-between mb-8">
              <div className="text-sm font-semibold text-neutral-500 uppercase tracking-wider">Credits Usage</div>
              <div className="text-sm font-medium text-neutral-500 bg-neutral-100 px-3 py-1 rounded-full">Resets every 30 days</div>
           </div>
           
           <div className="space-y-4">
             <div className="flex justify-between items-end">
               <div>
                 <span className="text-4xl font-semibold text-neutral-900">{used.toLocaleString()}</span>
                 <span className="text-neutral-500 ml-2">used</span>
               </div>
               <span className="text-neutral-400 font-medium">12,000 limit</span>
             </div>
             <div className="h-4 bg-neutral-100 rounded-full w-full overflow-hidden shadow-inner">
                <div className="h-full bg-gradient-to-r from-orange-400 to-amber-400 rounded-full transition-all duration-1000" style={{ width: `${percent}%` }} />
             </div>
           </div>
        </div>
      </div>
    </motion.div>
  )
}

function SettingsView({ user }: { user: any }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
       <div className="mb-8">
        <h1 className="text-2xl font-semibold mb-2">Account Settings</h1>
        <p className="text-neutral-500">Manage your profile and preferences.</p>
      </div>

      <div className="bg-white border border-black/5 rounded-2xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)] max-w-2xl">
         <form className="space-y-6">
           <div>
             <label className="block text-sm font-semibold text-neutral-700 mb-2">Full Name</label>
             <input type="text" defaultValue={user?.name || ''} className="w-full h-11 bg-white border border-black/10 rounded-xl px-4 text-neutral-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all" />
           </div>
           <div>
             <label className="block text-sm font-semibold text-neutral-700 mb-2">Email Address</label>
             <input type="email" disabled defaultValue={user?.email || ''} className="w-full h-11 bg-neutral-50 border border-black/10 rounded-xl px-4 text-neutral-500 cursor-not-allowed" />
           </div>
           <div className="pt-4 border-t border-black/5">
             <button type="button" className="bg-black text-white px-6 py-2.5 rounded-xl font-medium shadow-[0_4px_14px_0_rgba(0,0,0,0.1)] hover:bg-neutral-800 transition-all hover:scale-[1.02] active:scale-[0.98]">
               Save Changes
             </button>
           </div>
         </form>
      </div>
    </motion.div>
  )
}
