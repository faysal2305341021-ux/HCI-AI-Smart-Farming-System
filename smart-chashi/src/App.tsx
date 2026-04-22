import React, { useState, useEffect, useRef } from 'react';
import { 
  Sprout, 
  Stethoscope, 
  Mic, 
  ShoppingBag, 
  LayoutDashboard, 
  CloudSun, 
  User as UserIcon,
  Plus,
  ArrowRight,
  Loader2,
  Camera,
  MessageSquare,
  AlertCircle,
  Send,
  LogOut,
  Settings,
  MapPin,
  Scale,
  TrendingUp,
  Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend,
  AreaChart,
  Area
} from 'recharts';
import { classifyImage, loadModel } from './lib/tfService';
import { getBanglaAdvice, getDiagnosisAdvice } from './lib/gemini';

// --- Offline Storage Logic ---
const LocalDB = {
  getProfile: () => JSON.parse(localStorage.getItem('smartchashi_profile') || 'null'),
  saveProfile: (profile: any) => localStorage.setItem('smartchashi_profile', JSON.stringify(profile)),
  deleteProfile: () => localStorage.removeItem('smartchashi_profile'),
  getListings: () => JSON.parse(localStorage.getItem('smartchashi_listings') || '[]'),
  saveListings: (listings: any) => localStorage.setItem('smartchashi_listings', JSON.stringify(listings)),
  addListing: (listing: any) => {
    const listings = LocalDB.getListings();
    const newListing = { ...listing, id: Math.random().toString(36).substr(2, 9), createdAt: new Date().toISOString() };
    listings.unshift(newListing);
    LocalDB.saveListings(listings);
    return listings;
  },
  getDiagnoses: () => JSON.parse(localStorage.getItem('smartchashi_diagnoses') || '[]'),
  addDiagnosis: (diag: any) => {
    const diags = LocalDB.getDiagnoses();
    const newDiag = { ...diag, id: Math.random().toString(36).substr(2, 9), timestamp: new Date().toISOString() };
    diags.unshift(newDiag);
    localStorage.setItem('smartchashi_diagnoses', JSON.stringify(diags));
    return diags;
  }
};

// --- Types ---
interface Diagnosis {
  id: string;
  farmerUid: string;
  cropType: string;
  result: string;
  imageUrl: string;
  advice: string;
  timestamp: string;
}

interface MarketListing {
  id: string;
  sellerUid: string;
  sellerName: string;
  cropName: string;
  quantity: string;
  price: number;
  description: string;
  location: string;
  createdAt: any;
}

interface UserProfile {
  uid: string;
  displayName: string;
  role: 'farmer' | 'admin';
  location: string;
  nid: string;
  farmerId: string;
  email?: string;
  phone?: string;
  gender?: string;
  dob?: string;
  landSize?: string;
  primaryCrop?: string;
  bankName?: string;
  accountNumber?: string;
  pincode?: string;
  address?: string;
  fcmToken?: string;
  notifications?: {
    weather: boolean;
    marketplace: boolean;
    disease: boolean;
  };
  createdAt?: any;
}

// --- Components ---

export default function App() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<'home' | 'doctor' | 'voice' | 'market' | 'profile' | 'solution'>('home');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initial data load from offline storage
    const savedProfile = LocalDB.getProfile();
    if (savedProfile) {
      setProfile(savedProfile);
    }
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-paper-bg text-primary-green font-bold">
        <div className="flex flex-col items-center gap-4">
           <Sprout className="w-12 h-12 animate-bounce" />
           <Loader2 className="w-6 h-6 animate-spin text-border-ink" />
           <p className="font-serif text-2xl tracking-tight text-border-ink">Smart Chashi</p>
        </div>
      </div>
    );
  }

  // Handle new user profile setup
  if (!profile && !loading) {
    return <ProfileSetupView setProfile={setProfile} />;
  }

  return (
    <div className="flex flex-col h-screen bg-paper-bg text-border-ink safe-area-inset">
      <Header profile={profile} setActiveTab={setActiveTab} />
      
      <main className="flex-1 overflow-y-auto lg:grid lg:grid-cols-[1fr_1fr_320px] lg:gap-6 p-4 lg:p-6 mb-20 lg:mb-10">
        <AnimatePresence mode="wait">
          {activeTab === 'home' && <HomeView key="home" profile={profile} setActiveTab={setActiveTab} setProfile={setProfile} />}
          {activeTab === 'doctor' && <DoctorView key="doctor" profile={profile} />}
          {activeTab === 'voice' && <VoiceAssistantView key="voice" setActiveTab={setActiveTab} />}
          {activeTab === 'solution' && <AISolutionView key="solution" />}
          {activeTab === 'market' && <MarketplaceView key="market" profile={profile} />}
          {activeTab === 'profile' && <ProfileView key="profile" profile={profile} setProfile={setProfile} />}
        </AnimatePresence>
      </main>

      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <footer className="hidden lg:flex h-10 bg-border-ink text-white items-center px-10 text-[10px] justify-between uppercase tracking-widest font-bold">
        <div>JAMstack Architecture • Smart Chashi</div>
        <div className="flex gap-6">
          <span>📡 Signal: Excellent (5G)</span>
          <span>🔋 Battery: {Math.floor(Math.random() * 20) + 80}%</span>
        </div>
      </footer>
    </div>
  );
}

// --- Sub-Views ---

function ProfileSetupView({ setProfile }: { setProfile: (p: UserProfile | null) => void }) {
  const [name, setName] = useState('');
  const [nid, setNid] = useState('');
  const [phone, setPhone] = useState('');
  const [landSize, setLandSize] = useState('');
  const [primaryCrop, setPrimaryCrop] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generateFarmerId = (userName: string) => {
    const prefix = userName.trim().substring(0, 3).toLowerCase().padEnd(3, 'x');
    const random = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}${random}`;
  };

  const handleProfileSetup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !nid) {
      setError('নাম এবং এনআইডি অবশ্যই পূরণ করতে হবে।');
      return;
    }
    setLoading(true);
    setError('');
    
    const farmerId = generateFarmerId(name);
    const profileData: UserProfile = {
      uid: Math.random().toString(36).substr(2, 9),
      displayName: name,
      phone: phone || '',
      role: 'farmer',
      nid: nid,
      farmerId: farmerId,
      landSize: landSize,
      primaryCrop: primaryCrop,
      location: 'Bangladesh',
      notifications: { weather: true, marketplace: true, disease: true },
      createdAt: new Date().toISOString()
    };
    LocalDB.saveProfile(profileData);
    setProfile(profileData);
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-paper-bg">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-white border-4 border-border-ink shadow-[12px_12px_0px_rgba(0,0,0,1)] rounded-[40px] p-10"
      >
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-primary-green rounded-full flex items-center justify-center mx-auto mb-4 border-3 border-border-ink">
            <UserIcon className="text-white w-10 h-10" />
          </div>
          <h2 className="text-3xl font-serif font-black italic tracking-tight">আপনার প্রোফাইল সেটআপ করুন</h2>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-2">নতুন ব্যবহারকারী হিসেবে আমরা আপনাকে চিনি না</p>
        </div>

        {error && (
          <div className="bg-red-50 border-2 border-error text-error p-4 rounded-xl text-xs font-bold mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleProfileSetup} className="space-y-6">
          <div className="space-y-4">
            <div className="bg-slate-50 p-6 rounded-3xl border-3 border-border-ink border-dashed text-center mb-6">
               <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">আপনার ডিজিটাল ফার্মার আইডি (স্বয়ংক্রিয়)</p>
               <p className="text-3xl font-black text-primary-green font-mono tracking-tighter">
                 {name.trim() ? generateFarmerId(name) : '---1234'}
               </p>
               <p className="text-[8px] text-slate-400 mt-2 italic font-bold">নামের প্রথম ৩ অক্ষর এবং ৪টি সংখ্যার সমন্বয়ে তৈরি</p>
            </div>
            
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block font-sans">আপনার পূর্ণ নাম (Full Name)</label>
              <input 
                required
                autoFocus
                type="text" 
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-paper-bg p-4 rounded-xl border-3 border-border-ink/10 outline-none focus:border-primary-green font-black text-lg" 
                placeholder="নাম লিখুন"
              />
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block font-sans">এনআইডি নম্বর (NID Number)</label>
              <input 
                required
                type="text" 
                value={nid}
                onChange={e => setNid(e.target.value)}
                className="w-full bg-paper-bg p-4 rounded-xl border-3 border-border-ink/10 outline-none focus:border-primary-green font-black text-lg" 
                placeholder="১০ বা ১৭ ডিজিট"
              />
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block font-sans">ফোন নম্বর (Phone Number)</label>
              <input 
                required
                type="tel" 
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full bg-paper-bg p-4 rounded-xl border-3 border-border-ink/10 outline-none focus:border-primary-green font-black text-lg" 
                placeholder="+880 1XXX-XXXXXX"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block font-sans">জমির পরিমাণ</label>
                <input 
                  required
                  type="text" 
                  value={landSize}
                  onChange={e => setLandSize(e.target.value)}
                  className="w-full bg-paper-bg p-4 rounded-xl border-3 border-border-ink/10 outline-none focus:border-primary-green font-bold text-sm" 
                  placeholder="উদা: ৫ দশনক"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block font-sans">ফসল</label>
                <input 
                  required
                  type="text" 
                  value={primaryCrop}
                  onChange={e => setPrimaryCrop(e.target.value)}
                  className="w-full bg-paper-bg p-4 rounded-xl border-3 border-border-ink/10 outline-none focus:border-primary-green font-bold text-sm" 
                  placeholder="উদা: ধান"
                />
              </div>
            </div>
          </div>
          <button 
            disabled={loading}
            type="submit"
            className="w-full bg-primary-green text-white py-5 rounded-3xl font-black border-4 border-border-ink shadow-[8px_8px_0px_rgba(0,0,0,1)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all flex items-center justify-center gap-3 uppercase tracking-[0.2em] disabled:opacity-50 text-base"
          >
            {loading ? <Loader2 className="animate-spin w-6 h-6" /> : 'শুরু করুন (Get Started)'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

function Header({ profile, setActiveTab }: { profile: UserProfile | null, setActiveTab: (t: any) => void }) {
  return (
    <header className="h-20 bg-primary-green text-white px-10 flex items-center justify-between border-b-[3.5px] border-border-ink sticky top-0 z-20">
      <div className="flex items-center gap-4">
        <span className="text-3xl cursor-pointer" onClick={() => setActiveTab('home')}>🌿</span>
        <div className="logo flex flex-col cursor-pointer" onClick={() => setActiveTab('home')}>
          <h2 className="text-2xl font-serif font-black tracking-tight leading-none italic">Smart Chashi</h2>
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-70">স্মার্টচাষি (Krishi Tech)</span>
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="bg-white/10 px-4 py-2 border border-white/20 rounded hidden sm:flex items-center gap-3 text-xs font-bold">
          <CloudSun className="w-5 h-5 text-accent-yellow" />
          <span className="uppercase tracking-widest hidden md:block text-white/80">{profile?.location || 'বগুড়া, বাংলাদেশ'}</span>
          <strong className="text-accent-yellow">31°C | বর্ষা</strong>
        </div>
        {profile && (
          <div className="flex items-center gap-3">
            <div 
              onClick={() => setActiveTab('profile')}
              className="flex items-center gap-3 px-4 py-2 bg-border-ink text-white rounded-lg border-2 border-white/20 shadow-lg cursor-pointer hover:bg-slate-800 transition-colors"
            >
              <UserIcon className="w-4 h-4 text-primary-green" />
              <span className="font-serif italic font-black text-sm">{profile.displayName}</span>
            </div>
            <button 
              onClick={() => {
                LocalDB.deleteProfile();
                window.location.reload();
              }}
              className="p-3 bg-red-500 text-white rounded-lg border-2 border-border-ink shadow-[2px_2px_0_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
              title="Log Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

function Navigation({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (t: any) => void }) {
  const tabs = [
    { id: 'home', title: 'Home', icon: LayoutDashboard },
    { id: 'doctor', title: 'Doctor', icon: Stethoscope },
    { id: 'voice', title: 'Talk', icon: Mic },
    { id: 'market', title: 'Market', icon: ShoppingBag },
    { id: 'profile', title: 'Profile', icon: UserIcon },
  ];

  return (
    <nav className="fixed bottom-0 lg:bottom-10 left-0 w-full flex justify-center pointer-events-none z-30">
      <div className="bg-white border-[3px] border-border-ink rounded-2xl p-2 px-8 flex gap-12 shadow-[6px_6px_0px_rgba(0,0,0,1)] pointer-events-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-col items-center gap-1 py-1 transition-all group ${
              activeTab === tab.id ? 'text-primary-green' : 'text-slate-400'
            }`}
          >
            <div className="relative">
               <tab.icon className={`w-6 h-6 transition-transform group-active:scale-90 ${activeTab === tab.id ? 'stroke-[3px]' : 'stroke-[2px]'}`} />
               {activeTab === tab.id && (
                 <motion.div layoutId="nav-active" className="absolute -bottom-1 left-0 w-full h-1 bg-accent-yellow rounded-full" />
               )}
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest">{tab.title}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

function HomeView({ profile, setActiveTab, setProfile }: { 
  profile: UserProfile | null, 
  setActiveTab: (t: any) => void,
  setProfile: (p: UserProfile | null) => void 
}) {
  const [weather, setWeather] = useState<any>(null);
  const [showReport, setShowReport] = useState(false);
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [plan, setPlan] = useState<string | null>(null);
  const [pref, setPref] = useState(profile?.notifications || {
    weather: true,
    marketplace: true,
    disease: true
  });

  useEffect(() => {
    // Determine season based on month
    const month = new Date().getMonth();
    let seasonTitle = 'বর্ষা (Monsoon)';
    if (month >= 2 && month <= 4) seasonTitle = 'গ্রীষ্ম (Summer)';
    else if (month >= 10 || month <= 1) seasonTitle = 'শীত (Winter)';

    setWeather({
      temp: 28,
      condition: 'পরিষ্কার আকাশ',
      humidity: 65,
      wind: 12,
      location: profile?.location || 'Savar, Dhaka',
      season: seasonTitle,
      alerts: profile?.location?.includes('Savar') || profile?.location?.includes('Dhaka') 
        ? ['বন্যার সতর্কতা: সাভার এলাকায় পানির উচ্চতা বাড়ছে', 'মাটির লবণাক্ততা: স্বাভাবিক'] 
        : []
    });
  }, [profile]);

  const generatePlan = async () => {
    setGeneratingPlan(true);
    try {
      const month = new Date().toLocaleString('bn-BD', { month: 'long' });
      const prompt = `Act as an expert agricultural consultant for a farmer in ${profile?.location || 'Savar, Dhaka'}. 
      Land Size: ${profile?.landSize || 'Not specified'}. 
      Primary Crop: ${profile?.primaryCrop || 'Not specified'}. 
      Current Weather: ${weather.temp}°C, Humidity ${weather.humidity}%. 
      Month: ${month}.
      Season: ${weather.season}.
      DAE Latest Guidelines: Integrated.
      Provide a highly customized weekly day-by-day action plan for the farmer in Bangla (Bengali). 
      Include specific steps for:
      1. Irrigation schedule (based on rainfall forecasts).
      2. Fertilizer application times.
      3. Pest prevention for ${profile?.primaryCrop || 'local crops'}.
      4. Harvest/Sowing readiness.
      Format it clearly with day names like 'শনিবার', 'রবিবার' etc.`;
      
      const advice = await getBanglaAdvice(prompt, "Ensure the advice is specifically optimized for Bangladeshi soil (Dhaka/Savar region) and local crop types.");
      setPlan(advice);
    } catch (e) {
      setPlan("দুঃখিত, পরিকল্পনাটি তৈরি করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।");
    } finally {
      setGeneratingPlan(false);
    }
  };

  return (
    <div className="contents lg:grid lg:grid-cols-subgrid lg:col-span-3 text-left">
      {/* Grid col 1 & 2 on desktop */}
      <motion.div 
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="space-y-6 lg:col-span-2"
      >
        <section className="panel">
          <div className="panel-header">
            <span>আজকের সংক্ষিপ্ত বিবরণ (Daily Overview)</span>
            <span className="bg-accent-yellow text-border-ink px-2 py-0.5 rounded text-[9px] font-black italic uppercase">Updated</span>
          </div>
          <div className="bg-primary-green p-8 text-white relative flex justify-between items-center">
            <CloudSun className="absolute -bottom-4 -left-4 w-40 h-40 opacity-10" />
            <div className="relative z-10">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/60 mb-2">স্থানীয় আবহাওয়া</p>
              <h3 className="text-6xl font-serif font-black italic tracking-tighter">{weather?.temp}°C</h3>
              <p className="text-sm font-bold text-accent-yellow uppercase tracking-widest mt-1">{weather?.condition}</p>
            </div>
            <div className="relative z-10 text-right">
              <div className="flex flex-col gap-2">
                <div className="bg-white/10 px-4 py-2 rounded-lg border border-white/5">
                  <span className="block text-[8px] font-black opacity-50 uppercase">Humidity</span>
                  <span className="font-bold text-xl">{weather?.humidity}%</span>
                </div>
                <div className="bg-white/10 px-4 py-2 rounded-lg border border-white/5">
                  <span className="block text-[8px] font-black opacity-50 uppercase">Season</span>
                  <span className="font-bold text-xs">{weather?.season}</span>
                </div>
              </div>
            </div>
          </div>

          {weather?.alerts?.length > 0 && (
            <div className="bg-red-50 border-b-2 border-border-ink p-4 flex gap-4 overflow-x-auto scrollbar-hide">
              {weather.alerts.map((alert: string, i: number) => (
                <div key={i} className="whitespace-nowrap flex items-center gap-2 bg-white border-2 border-red-500 px-3 py-1 rounded-full text-[10px] font-black text-red-600 animate-pulse">
                   <AlertCircle className="w-3 h-3" />
                   {alert}
                </div>
              ))}
            </div>
          )}

          <div className="p-6 grid grid-cols-2 gap-6 bg-white border-t-2 border-border-ink">
            <div className="flex flex-col gap-1">
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Crop Health</span>
               <div className="flex items-center gap-3">
                 <span className="text-3xl font-serif font-black italic">ভালো</span>
                 <div className="w-10 h-1.5 bg-green-500 rounded-full" />
               </div>
            </div>
            <div className="flex flex-col gap-1">
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Price Index</span>
               <div className="flex items-center gap-3">
                 <span className="text-3xl font-serif font-black italic text-clay-brown">চড়া</span>
                 <div className="w-10 h-1.5 bg-clay-brown rounded-full" />
               </div>
            </div>
          </div>
        </section>

        <section className="panel min-h-[150px] relative overflow-hidden">
          <div className="panel-header flex justify-between items-center bg-primary-green text-white">
             <span>এআই সমস্যা সমাধান (AI Solution)</span>
             <button onClick={() => setActiveTab('solution')} className="text-[10px] uppercase font-black bg-white text-primary-green px-2 py-0.5 rounded italic">Open Lab</button>
          </div>
          <div className="p-8 bg-paper-bg/50">
             <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setActiveTab('solution')}
                  className="p-6 bg-white border-3 border-border-ink rounded-[30px] shadow-[6px_6px_0_rgba(0,0,0,1)] flex flex-col items-center gap-3 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all group"
                >
                   <div className="w-12 h-12 bg-accent-yellow/10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Settings className="w-6 h-6 text-accent-yellow" />
                   </div>
                   <span className="text-[10px] font-black uppercase tracking-widest">Problem Solver</span>
                </button>
                <button 
                  onClick={() => setActiveTab('doctor')}
                  className="p-6 bg-white border-3 border-border-ink rounded-[30px] shadow-[6px_6px_0_rgba(0,0,0,1)] flex flex-col items-center gap-3 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all group"
                >
                   <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Stethoscope className="w-6 h-6 text-red-500" />
                   </div>
                   <span className="text-[10px] font-black uppercase tracking-widest">Crop Doctor</span>
                </button>
             </div>
          </div>
        </section>

        <section className="panel min-h-[150px] relative overflow-hidden">
          <div className="panel-header flex justify-between items-center">
             <span>ব্যক্তিগত চাষাবাদ পরিকল্পনা (Smart Plan)</span>
             {plan && (
               <button onClick={() => setPlan(null)} className="text-[10px] font-black uppercase text-slate-400">Clear</button>
             )}
          </div>
          <div className="p-8">
            {!plan ? (
              <div className="flex flex-col items-center text-center gap-4 py-4">
                <div className="w-16 h-16 bg-accent-yellow/20 rounded-full flex items-center justify-center border-2 border-dashed border-accent-yellow">
                   <Sprout className="w-8 h-8 text-accent-yellow" />
                </div>
                <div>
                   <h4 className="font-serif font-black italic text-xl">আপনার স্মার্ট ফার্মিং প্ল্যান তৈরি করুন</h4>
                   <p className="text-xs font-medium text-slate-500 mt-1 max-w-xs mx-auto text-balance tracking-tight">আপনার জমির তথ্য এবং বর্তমান আবহাওয়ার ভিত্তিতে এআই পরামর্শ নিন।</p>
                </div>
                <button 
                  onClick={generatePlan}
                  disabled={generatingPlan}
                  className="mt-2 bg-border-ink text-white px-8 py-3 rounded-xl font-black uppercase tracking-widest text-[11px] shadow-[4px_4px_0_rgba(0,0,0,1)] active:scale-95 transition-all flex items-center gap-2"
                >
                  {generatingPlan ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {generatingPlan ? 'প্রক্রিয়াধীন...' : 'প্ল্যান তৈরি করুন'}
                </button>
              </div>
            ) : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="prose prose-sm max-w-none text-left">
                 <div className="bg-paper-bg p-6 rounded-2xl border-2 border-border-ink border-dashed">
                    <p className="font-bold text-primary-green mb-2 flex items-center gap-2 uppercase tracking-widest text-[10px]">
                       <Mic className="w-4 h-4" /> AI Smart Advisor:
                    </p>
                    <div className="text-xs leading-relaxed space-y-2 whitespace-pre-wrap font-medium">
                       {plan}
                    </div>
                 </div>
              </motion.div>
            )}
          </div>
        </section>

        {/* Mobile Settings Section */}
        <section className="panel lg:hidden bg-slate-50">
          <div className="panel-header text-[10px] font-black uppercase tracking-widest">User Dashboard Tools</div>
          <div className="p-6 grid gap-4">
             <button onClick={() => setShowReport(true)} className="w-full py-4 bg-white border-2 border-border-ink rounded-xl font-bold flex items-center justify-between px-6 shadow-[4px_4px_0_rgba(0,0,0,1)]">
                <span className="uppercase text-xs tracking-widest">Audit Farm Report</span>
                <ArrowRight className="w-4 h-4" />
             </button>
          </div>
        </section>
      </motion.div>

      {/* Sidebar on desktop */}
      <aside className="space-y-6 hidden lg:block">
        <section className="panel h-full flex flex-col">
           <div className="panel-header uppercase tracking-widest text-[10px]">Farm Management Report</div>
           <div className="flex-1 overflow-y-auto">
              <div className="stat-card">
                 <div className="stat-label">মাটির আর্দ্রতা (Soil Moisture)</div>
                 <div className="stat-value">৬৮%</div>
                 <div className="w-full bg-slate-100 h-2 mt-3 rounded-full overflow-hidden border border-border-ink/5">
                    <div className="bg-blue-500 h-full" style={{ width: '68%' }} />
                 </div>
              </div>
              <div className="stat-card">
                 <div className="stat-label">নাইট্রোজেন (Nitrogen)</div>
                 <div className="stat-value text-primary-green uppercase text-sm font-black">Medium</div>
              </div>
              <div className="stat-card">
                 <div className="stat-label">সারের প্রয়োজন (Needed)</div>
                 <div className="stat-value text-clay-brown">৩.৫ কেজি</div>
              </div>

              <div className="p-6 border-t-2 border-border-ink bg-paper-bg space-y-4">
                 <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">System Notifications</h4>
                 <div className="space-y-3">
                    {[
                      { id: 'weather', label: 'Weather Alerts' },
                      { id: 'marketplace', label: 'Price Changes' },
                      { id: 'disease', label: 'Disease Warnings' }
                    ].map(item => (
                      <label key={item.id} className="flex items-center justify-between cursor-pointer group">
                         <span className="text-[11px] font-bold text-border-ink/80 group-hover:text-border-ink transition-colors">{item.label}</span>
                         <input 
                           type="checkbox" 
                           checked={(pref as any)[item.id]} 
                           onChange={() => {
                             const newPref = { ...pref, [item.id]: !(pref as any)[item.id] };
                             setPref(newPref);
                             if (profile) {
                               const updatedProfile = { ...profile, notifications: newPref };
                               LocalDB.saveProfile(updatedProfile);
                               setProfile(updatedProfile);
                             }
                           }}
                           className="w-4 h-4 accent-primary-green cursor-pointer border-2 border-border-ink rounded"
                         />
                      </label>
                    ))}
                 </div>
              </div>
           </div>
           <div className="p-6 border-t-2 border-border-ink bg-slate-100 mt-auto">
              <button 
                onClick={() => setShowReport(true)}
                className="w-full py-4 bg-border-ink text-white font-black uppercase tracking-[0.2em] rounded-xl text-[10px] shadow-[6px_6px_0_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all flex items-center justify-center gap-2"
              >
                View Analytics Audit
              </button>
           </div>
        </section>
      </aside>

      {/* Report Modal */}
      <AnimatePresence>
        {showReport && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-12">
             <motion.div 
               initial={{ opacity: 0 }} 
               animate={{ opacity: 1 }} 
               exit={{ opacity: 0 }}
               onClick={() => setShowReport(false)}
               className="absolute inset-0 bg-border-ink/70 backdrop-blur-md"
             />
             <motion.div 
               initial={{ opacity: 0, scale: 0.9, y: 40 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.9, y: 40 }}
               className="bg-paper-bg w-full max-w-3xl rounded-[40px] border-4 border-border-ink shadow-[24px_24px_0_rgba(255,165,0,0.2)] z-10 overflow-hidden flex flex-col max-h-[90vh]"
             >
                <div className="bg-primary-green p-10 text-white flex justify-between items-center border-b-4 border-border-ink">
                   <div>
                      <h3 className="text-4xl font-serif font-black italic tracking-tighter">Farm Intel Report</h3>
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-accent-yellow">Data Audit • April 2026</p>
                   </div>
                   <button onClick={() => setShowReport(false)} className="bg-border-ink text-white p-3 rounded-full hover:bg-red-500 transition-colors border-2 border-white/20 shadow-lg">
                      <Plus className="w-8 h-8 rotate-45" />
                   </button>
                </div>
                <div className="p-10 flex-1 overflow-y-auto space-y-10">
                   <div className="grid sm:grid-cols-3 gap-6">
                      <div className="p-6 bg-white border-3 border-border-ink rounded-3xl shadow-[4px_4px_0_rgba(0,0,0,1)]">
                         <span className="text-[9px] font-black uppercase text-slate-400 block tracking-widest mb-1">Yield Potential</span>
                         <p className="text-4xl font-serif font-black italic mt-1">৮৫%</p>
                         <p className="text-[10px] text-green-600 font-bold mt-2 font-mono">↑ 12% vs LY</p>
                      </div>
                      <div className="p-6 bg-white border-3 border-border-ink rounded-3xl shadow-[4px_4px_0_rgba(0,0,0,1)]">
                         <span className="text-[9px] font-black uppercase text-slate-400 block tracking-widest mb-1">Health Metric</span>
                         <p className="text-4xl font-serif font-black italic mt-1 text-primary-green">৯.২</p>
                         <p className="text-[10px] text-slate-500 font-bold mt-2 uppercase tracking-tighter">Scale / 10</p>
                      </div>
                      <div className="p-6 bg-white border-3 border-border-ink rounded-3xl shadow-[4px_4px_0_rgba(0,0,0,1)]">
                         <span className="text-[9px] font-black uppercase text-slate-400 block tracking-widest mb-1">Active Risks</span>
                         <p className="text-4xl font-serif font-black italic mt-1 text-red-500">০১</p>
                         <p className="text-[10px] text-red-500/60 font-bold mt-2 uppercase">Minor Pest</p>
                      </div>
                   </div>
                   
                   <div className="space-y-4">
                      <h4 className="font-serif font-black italic text-2xl border-b-2 border-border-ink/10 pb-4">Performance Metrics</h4>
                      <div className="bg-white border-3 border-border-ink rounded-3xl overflow-hidden">
                         <table className="w-full text-left text-xs">
                            <thead className="bg-slate-100 border-b-2 border-border-ink">
                               <tr>
                                  <th className="p-5 font-black uppercase tracking-widest text-[10px]">Diagnostic Category</th>
                                  <th className="p-5 font-black uppercase tracking-widest text-[10px] text-right">Observation Value</th>
                               </tr>
                            </thead>
                            <tbody className="divide-y-2 divide-slate-100">
                               <tr>
                                  <td className="p-5 font-bold">Soil Moisture Intensity</td>
                                  <td className="p-5 text-right font-black text-blue-600">৬৫% (Optimal)</td>
                               </tr>
                               <tr>
                                  <td className="p-5 font-bold">Nitrogen saturation</td>
                                  <td className="p-5 text-right font-black text-primary-green uppercase">Medium-High</td>
                               </tr>
                               <tr>
                                  <td className="p-5 font-bold">Regional Disease Risk</td>
                                  <td className="p-5 text-right font-bold text-green-500 bg-green-50 font-black italic">নিম্ন (Low Area)</td>
                               </tr>
                               <tr>
                                  <td className="p-5 font-bold">Market price Volatility</td>
                                  <td className="p-5 text-right font-black text-clay-brown">Stable High</td>
                               </tr>
                            </tbody>
                         </table>
                      </div>
                   </div>
                </div>
                <div className="p-10 border-t-4 border-border-ink bg-white flex gap-4">
                   <button onClick={() => window.print()} className="flex-1 py-5 bg-border-ink text-white font-black uppercase tracking-[0.2em] rounded-2xl flex items-center justify-center gap-3 active:scale-95 transition-transform shadow-[8px_8px_0_rgba(0,0,0,0.1)]">
                      Download Full Analytics PDF
                   </button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AISolutionView() {
  const [queryText, setQueryText] = useState('');
  const [solution, setSolution] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const getSolution = async () => {
    if (!queryText.trim()) return;
    setLoading(true);
    setSolution(null);
    try {
      const advice = await getBanglaAdvice(queryText, "The farmer is reporting a specific problem and needs a technical solution.");
      setSolution(advice);
    } catch (err) {
      setSolution("দুঃখিত, এখন সমাধান প্রদান করা সম্ভব হচ্ছে না।");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="contents lg:grid lg:grid-cols-subgrid lg:col-span-3">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="lg:col-span-2 space-y-8"
      >
        <div className="panel overflow-hidden">
          <div className="panel-header bg-slate-800 text-white flex justify-between items-center">
            <span>এআই সমস্যা সমাধান ল্যাব (AI Solver Lab)</span>
            <div className="flex gap-1">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <div className="w-2 h-2 rounded-full bg-yellow-500" />
              <div className="w-2 h-2 rounded-full bg-green-500" />
            </div>
          </div>
          
          <div className="p-10 space-y-8">
            <div className="space-y-4">
              <label className="text-sm font-black uppercase tracking-widest text-slate-400">আপনার সমস্যাটি বিস্তারিত লিখুন (Describe Problem)</label>
              <textarea 
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                placeholder="উদা: আমার ধানে লালচে রোগ দেখা দিচ্ছে, এর প্রতিকার কী?"
                className="w-full h-40 bg-slate-50 border-3 border-border-ink/10 rounded-3xl p-6 font-bold text-lg outline-none focus:border-primary-green transition-colors resize-none shadow-inner"
              />
            </div>

            <button 
              onClick={getSolution}
              disabled={loading || !queryText.trim()}
              className="w-full bg-border-ink text-white py-6 rounded-[30px] font-black text-xl uppercase tracking-widest shadow-[10px_10px_0_rgba(0,0,0,0.1)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all flex items-center justify-center gap-4 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-8 h-8 animate-spin" /> : <Settings className="w-8 h-8" />}
              {loading ? 'সমাধান খুঁজছি...' : 'সমাধান বের করুন'}
            </button>
          </div>
        </div>

        {solution && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="panel border-primary-green"
          >
            <div className="panel-header bg-primary-green text-white">প্রযুক্তিগত সমাধান (Technical Solution)</div>
            <div className="p-10 bg-white border-t-2 border-border-ink">
               <div className="prose prose-lg max-w-none font-medium leading-relaxed italic whitespace-pre-wrap">
                  {solution}
               </div>
               <div className="mt-8 pt-6 border-t-2 border-slate-100 flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 italic">Generated by Krishi-AI Lab</span>
                  <button onClick={() => setSolution(null)} className="text-red-500 font-black text-[10px] uppercase tracking-widest">Clear Result</button>
               </div>
            </div>
          </motion.div>
        )}
      </motion.div>

      <aside className="hidden lg:block space-y-6">
         <div className="panel bg-[#FFF9E6]">
            <div className="panel-header text-border-ink">Expert Tips</div>
            <div className="p-6 space-y-4 text-sm font-bold italic text-slate-600">
               <p>• রোগ দেখা দিলে আগে আক্রান্ত গাছ আলাদা করুন।</p>
               <p>• রাসায়নিক ব্যবহারের আগে জৈব পদ্ধতি চেষ্টা করুন।</p>
               <p>• নিয়মিত মাটি পরীক্ষা করান।</p>
            </div>
         </div>
      </aside>
    </div>
  );
}

function DoctorView({ profile }: { profile: UserProfile | null }) {
  const [scanning, setScanning] = useState(false);
  const [advice, setAdvice] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [history, setHistory] = useState<Diagnosis[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setHistory(LocalDB.getDiagnoses());
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanning(true);
    setAdvice(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const fullRes = event.target?.result as string;
      setImageUrl(fullRes);
      const base64 = fullRes.split(',')[1];
      
      try {
        const adv = await getDiagnosisAdvice(base64);
        setAdvice(adv);
        
        // Save to LocalDB
        const updated = LocalDB.addDiagnosis({
          cropType: 'Crop',
          result: adv.substring(0, 50) + '...',
          imageUrl: fullRes.substring(0, 100), // Storing tiny preview or placeholder
          advice: adv,
          farmerUid: profile?.uid || 'local-user'
        });
        setHistory(updated);
      } catch (error) {
        setAdvice("দুঃখিত, কোনো ত্রুটি হয়েছে। আবার চেষ্টা করুন।");
      } finally {
        setScanning(false);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="contents lg:grid lg:grid-cols-subgrid lg:col-span-3">
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6 flex flex-col items-center lg:col-span-2"
      >
        <section className="panel w-full">
          <div className="panel-header">
            <span>কৃষি ডাক্তার (Diagnosis)</span>
            <span className="bg-error text-white px-2 py-0.5 rounded text-[9px] font-black animate-pulse">LIVE CAMERA</span>
          </div>
          
          <div className="p-8 bg-[#E8EDE8] flex flex-col items-center justify-center min-h-[400px] relative overflow-hidden group">
            {imageUrl ? (
              <img src={imageUrl} className="max-w-full max-h-[500px] rounded-lg border-4 border-border-ink shadow-2xl" alt="Scan" />
            ) : (
              <div 
                className="w-full max-w-sm aspect-video border-4 border-dashed border-primary-green/30 rounded-2xl flex flex-col items-center justify-center bg-white/50 cursor-pointer hover:bg-white transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera className="w-16 h-16 text-primary-green/20 mb-4" />
                <p className="font-serif text-lg font-black italic text-border-ink">ফসল স্ক্যান করতে বোতাম চাপুন</p>
                <p className="text-[10px] font-black uppercase text-slate-400 mt-2 tracking-widest">(Focus on crop leaves)</p>
              </div>
            )}
            
            {scanning && (
              <div className="absolute inset-0 bg-primary-green/40 backdrop-blur-[4px] flex flex-col items-center justify-center text-white p-8 text-center z-10">
                <Loader2 className="w-12 h-12 animate-spin mb-6" />
                <h4 className="text-3xl font-serif font-black italic">ANALYZING CROP HEALTH...</h4>
                <div className="mt-4 bg-border-ink text-white px-4 py-1 rounded font-bold text-xs">PADDY (ধাণ) DETECTED - 98%</div>
              </div>
            )}
          </div>

          <div className="p-6 bg-white border-t-2 border-border-ink">
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={scanning}
              className="w-full bg-primary-green text-white py-5 rounded-xl font-black text-lg border-3 border-border-ink shadow-[4px_4px_0_rgba(0,0,0,1)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all flex items-center justify-center gap-4 uppercase tracking-tighter"
            >
              <Camera className="w-8 h-8" />
              ছবি তুলুন ও রোগ নির্ণয় করুন
            </button>
            <input 
              type="file" 
              accept="image/*" 
              capture="environment" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              className="hidden" 
            />
          </div>
        </section>

        {advice && (
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="panel w-full"
          >
            <div className="panel-header bg-accent-yellow">ডাক্তারের পরামর্শ (Diagnosis Result)</div>
            <div className="p-8 prose prose-lg max-w-none text-border-ink font-medium leading-relaxed italic border-t-2 border-border-ink">
              {advice}
            </div>
          </motion.div>
        )}
      </motion.div>

      <aside className="space-y-6 hidden lg:block">
        <section className="panel h-full">
           <div className="panel-header">Scan History</div>
           <div className="p-4 flex flex-col gap-4 overflow-y-auto max-h-[500px]">
              {history.map((item) => (
                <div key={item.id} className="p-3 bg-slate-50 flex items-center gap-3 border-2 border-border-ink/10 rounded-lg">
                  <div className="w-10 h-10 bg-green-200 rounded shrink-0 flex items-center justify-center">
                    <Sprout className="w-5 h-5 text-primary-green" />
                  </div>
                  <div className="overflow-hidden">
                     <p className="text-xs font-black uppercase italic truncate">{item.result}</p>
                     <p className="text-[10px] text-slate-400 font-bold">{new Date(item.timestamp).toLocaleString()}</p>
                  </div>
                </div>
              ))}
              {history.length === 0 && (
                <p className="text-[10px] font-black uppercase text-slate-300 text-center py-10 tracking-widest italic">কোনো ইতিহাস নেই</p>
              )}
           </div>
        </section>
      </aside>
    </div>
  );
}

function VoiceAssistantView({ setActiveTab }: { setActiveTab: (tab: any) => void }) {
  const [messages, setMessages] = useState<{role: 'user' | 'ai', text: string, suggestions?: {label: string, tab: string}[]}[]>([
    { role: 'ai', text: 'আসসালামু আলাইকুম! আমি আপনার কৃষি সহকারী। আপনার ফসলের যে কোনো সমস্যা কথা আমাকে বলতে পারেন।' }
  ]);
  const [inputText, setInputText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("দুঃখিত, আপনার ব্রাউজার ভয়েস ইনপুট সমর্থন করে না। (Browser does not support Speech Recognition)");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'bn-BD'; // Support Bangla
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInputText(transcript);
      setIsListening(false);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognition.start();
  };

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!inputText.trim() || isThinking) return;

    const userMsg = inputText;
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setInputText('');
    setIsThinking(true);

    try {
      const advice = await getBanglaAdvice(userMsg);
      
      // Inject suggestions based on keywords
      const suggestions: {label: string, tab: string}[] = [];
      if (advice.includes('রোগ') || advice.includes('পোকামাকড়') || advice.includes('মারা যাওয়া')) {
        suggestions.push({ label: 'কৃষি ডাক্তার দেখুন', tab: 'doctor' });
      }
      if (advice.includes('বাজার') || advice.includes('দাম') || advice.includes('বিক্রি')) {
        suggestions.push({ label: 'বাজার যাচাই করুন', tab: 'market' });
      }
      if (advice.includes('সমাধান') || advice.includes('প্রযুক্তি')) {
        suggestions.push({ label: 'এআই ল্যাব ব্যবহার করুন', tab: 'solution' });
      }
      if (advice.includes('আবহাওয়া') || advice.includes('বৃষ্টি')) {
        suggestions.push({ label: 'আবহাওয়া দেখুন', tab: 'home' });
      }

      setMessages(prev => [...prev, { role: 'ai', text: advice, suggestions }]);
    } catch (error) {
       setMessages(prev => [...prev, { role: 'ai', text: 'দুঃখিত, সার্ভারের সাথে যোগাযোগ করা সম্ভব হচ্ছে না।' }]);
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <div className="contents lg:grid lg:grid-cols-subgrid lg:col-span-3 h-full">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="lg:col-span-2 flex flex-col h-[calc(100vh-280px)] lg:h-[600px] panel"
      >
        <div className="panel-header uppercase tracking-widest font-black italic">
          <span>বাংলা ভয়েস অ্যাসিস্ট্যান্ট</span>
          <span className="flex items-center gap-2">
            AI <div className="w-2 h-2 bg-primary-green rounded-full animate-pulse" />
          </span>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] px-6 py-4 rounded-2xl text-base leading-relaxed border-2 border-border-ink shadow-[4px_4px_0_rgba(0,0,0,0.1)] ${
                msg.role === 'user' 
                  ? 'bg-primary-green text-white rounded-tr-none' 
                  : 'bg-[#F0F4FF] text-border-ink rounded-tl-none italic font-medium'
              }`}>
                {msg.text}
                
                {msg.suggestions && msg.suggestions.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {msg.suggestions.map((s, idx) => (
                      <button 
                        key={idx}
                        onClick={() => setActiveTab(s.tab)}
                        className="bg-white text-primary-green px-3 py-1.5 rounded-lg border border-primary-green/20 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-primary-green hover:text-white transition-all shadow-sm"
                      >
                        {s.label} <ArrowRight className="w-3 h-3" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {isThinking && (
            <div className="flex justify-start">
              <div className="bg-white px-8 py-5 rounded-3xl border-2 border-border-ink shadow-[4px_4px_0_rgba(0,0,0,0.1)] flex gap-2">
                 <div className="w-2 h-2 bg-primary-green rounded-full animate-bounce [animation-delay:-0.3s]" />
                 <div className="w-2 h-2 bg-primary-green rounded-full animate-bounce [animation-delay:-0.15s]" />
                 <div className="w-2 h-2 bg-primary-green rounded-full animate-bounce" />
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>

        <div className="p-6 bg-slate-50 border-t-2 border-border-ink">
          <div className="bg-white border-2 border-border-ink rounded-xl p-2 flex items-center shadow-[4px_4px_0_rgba(0,0,0,1)]">
            <input 
              type="text" 
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={isListening ? "আপনার কথা শুনছি..." : "আপনার প্রশ্নটি এখানে লিখুন..."}
              className={`flex-1 outline-none px-4 text-sm font-bold h-14 transition-colors ${isListening ? 'bg-accent-yellow/5' : ''}`}
            />
            <div className="flex gap-2 mr-2">
              <button 
                onClick={startListening}
                className={`w-14 h-14 rounded-lg flex items-center justify-center border-2 border-border-ink active:scale-90 transition-all shadow-[2px_2px_0_rgba(0,0,0,1)] ${isListening ? 'bg-error text-white animate-pulse' : 'bg-white text-primary-green'}`}
              >
                <div className="relative">
                  <Mic className="w-8 h-8" />
                  {isListening && <div className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full animate-ping" />}
                </div>
              </button>
              <button 
                onClick={handleSend}
                disabled={!inputText.trim() || isThinking || isListening}
                className="bg-primary-green text-white w-14 h-14 rounded-lg flex items-center justify-center border-2 border-border-ink active:scale-90 transition-all shadow-[2px_2px_0_rgba(0,0,0,1)] disabled:opacity-50"
              >
                <Send className="w-7 h-7" />
              </button>
            </div>
          </div>
          <p className="text-center mt-3 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">ট্যাপ করুন (Tap to interact)</p>
        </div>
      </motion.div>

      <aside className="space-y-6 hidden lg:block">
        <section className="panel">
           <div className="panel-header">Quick Actions</div>
           <div className="p-4 space-y-3">
              <button onClick={() => setInputText("ধানের রোগ নিয়ন্ত্রণ")} className="w-full p-3 bg-paper-bg border-2 border-border-ink/10 rounded font-bold text-xs hover:border-primary-green transition-colors text-left italic">
                # ধানের রোগ নিয়ন্ত্রণ
              </button>
              <button onClick={() => setInputText("বৃষ্টি হওয়ার সম্ভাবনা")} className="w-full p-3 bg-paper-bg border-2 border-border-ink/10 rounded font-bold text-xs hover:border-primary-green transition-colors text-left italic">
                # সারের সঠিক ব্যবহার
              </button>
           </div>
        </section>
      </aside>
    </div>
  );
}

// --- Mock Price Data ---
const MOCK_PRICE_HISTORY = [
  { month: 'জানুয়ারি', ধান: 1200, পাট: 3400, আলু: 800 },
  { month: 'ফেব্রুয়ারি', ধান: 1250, পাট: 3200, আলু: 850 },
  { month: 'মার্চ', ধান: 1180, পাট: 3500, আলু: 900 },
  { month: 'এপ্রিল', ধান: 1300, পাট: 3800, আলু: 750 },
  { month: 'মে', ধান: 1350, পাট: 3900, আলু: 700 },
  { month: 'জুন', ধান: 1280, পাট: 3700, আলু: 720 },
];

function MarketplaceView({ profile }: { profile: UserProfile | null }) {
  const [listings, setListings] = useState<MarketListing[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newItem, setNewItem] = useState({ cropName: '', price: '', quantity: '', description: '' });

  useEffect(() => {
    const list = LocalDB.getListings();
    setListings(list);
  }, []);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.cropName || !newItem.price) return;

    const updatedList = LocalDB.addListing({
      ...newItem,
      price: Number(newItem.price),
      sellerUid: profile?.uid || 'local-user',
      sellerName: profile?.displayName || 'Farmer',
      location: 'Bangladesh',
    });
    setListings(updatedList);
    setShowAdd(false);
    setNewItem({ cropName: '', price: '', quantity: '', description: '' });
  };

  return (
    <div className="contents lg:grid lg:grid-cols-subgrid lg:col-span-3">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="lg:col-span-2 space-y-6"
      >
        {/* Price Trend Chart */}
        <section className="panel overflow-hidden">
          <div className="panel-header flex justify-between items-center bg-[#1A1A1A] text-white border-b-4 border-primary-green">
            <span className="flex items-center gap-2 uppercase tracking-[0.2em] text-[11px] font-black">
              <TrendingUp className="w-5 h-5 text-accent-yellow" />
              বাজার দর বিশ্লেষণ (মণ প্রতি দাম)
            </span>
            <div className="flex items-center gap-3">
               <span className="bg-primary-green text-white px-3 py-1 rounded-full text-[9px] font-black uppercase italic">Savar Rate</span>
               <span className="text-[10px] font-bold text-slate-400">গত ৬ মাসের তথ্য</span>
            </div>
          </div>
          <div className="p-10 h-[350px] bg-white relative">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={MOCK_PRICE_HISTORY}>
                <defs>
                  <linearGradient id="colorPaddy" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2D5A27" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#2D5A27" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis 
                  dataKey="month" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
                  tickFormatter={(val) => `৳${val}`}
                />
                <Tooltip 
                  formatter={(value) => [`৳${value} / মণ`, 'দাম']}
                  contentStyle={{ 
                    borderRadius: '24px', 
                    border: '3px solid #000', 
                    boxShadow: '8px 8px 0 rgba(0,0,0,0.1)',
                    fontWeight: '900',
                    fontSize: '14px',
                    fontFamily: 'serif',
                    fontStyle: 'italic',
                    padding: '16px'
                  }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '10px', fontWeight: '900', textTransform: 'uppercase' }} />
                <Area 
                  type="monotone" 
                  dataKey="ধান" 
                  stroke="#2D5A27" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorPaddy)" 
                />
                <Area 
                  type="monotone" 
                  dataKey="পাট" 
                  stroke="#FFD700" 
                  strokeWidth={3}
                  fillOpacity={0} 
                  fill="transparent" 
                />
                <Area 
                  type="monotone" 
                  dataKey="আলু" 
                  stroke="#A0522D" 
                  strokeWidth={3}
                  fillOpacity={0} 
                  fill="transparent" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <span>কৃষি বাজার (Krishi Bazaar)</span>
            <button 
              onClick={() => setShowAdd(true)}
              className="bg-accent-yellow text-border-ink px-4 py-1.5 rounded-lg border-2 border-border-ink font-serif font-black italic shadow-[2px_2px_0_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4 stroke-[3px]" />
              আপনার ফসল যোগ করুন
            </button>
          </div>

          <div className="divide-y-2 divide-slate-100 bg-white">
            {listings.map((item) => (
              <motion.div 
                layout
                key={item.id} 
                className="p-6 flex gap-6 items-center group cursor-pointer hover:bg-paper-bg transition-colors"
              >
                <div className="w-20 h-20 bg-paper-bg border-3 border-border-ink rounded-2xl flex items-center justify-center shrink-0 shadow-[4px_4px_0_rgba(0,0,0,0.1)] group-hover:bg-primary-green group-hover:text-white transition-all">
                   <Sprout className="w-10 h-10" />
                </div>
                <div className="flex-1">
                   <div className="flex justify-between items-start">
                      <h4 className="text-2xl font-serif font-black italic leading-tight">{item.cropName}</h4>
                      <p className="text-3xl font-serif font-black italic text-primary-green">৳{item.price}<span className="text-[10px] font-black uppercase text-slate-400 not-italic ml-2 tracking-widest leading-none">/মণ</span></p>
                   </div>
                   <p className="text-slate-500 text-sm mt-1 mb-4 italic line-clamp-1">{item.description || 'ফ্রেশ সতেজ ফসল সরাসরি মাঠ থেকে।'}</p>
                   <div className="flex gap-4">
                      <span className="bg-border-ink text-white px-3 py-1 rounded text-[9px] font-black uppercase tracking-widest">{item.quantity || 'ব্যাগ'}</span>
                      <span className="flex items-center gap-2 text-[10px] uppercase font-black text-slate-400">
                        <UserIcon className="w-4 h-4 text-primary-green" />
                        {item.sellerName}
                      </span>
                   </div>
                </div>
              </motion.div>
            ))}
            {listings.length === 0 && (
               <div className="text-center py-20 bg-slate-50 border-t-2 border-border-ink border-dashed">
                 <ShoppingBag className="w-16 h-16 mx-auto mb-4 opacity-10" strokeWidth={1} />
                 <p className="font-serif italic font-bold text-slate-400">বাজারে এখন কোনো ফসল নেই</p>
               </div>
            )}
          </div>
        </section>
      </motion.div>

      <AnimatePresence>
        {showAdd && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 sm:p-0">
            <motion.div 
               initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
               className="absolute inset-0 bg-black/50 backdrop-blur-sm"
               onClick={() => setShowAdd(false)}
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white w-full max-w-md rounded-[40px] p-10 shadow-[16px_16px_0_rgba(0,0,0,1)] z-10 relative border-[6px] border-border-ink"
            >
              <h3 className="text-4xl font-serif font-black italic mb-8 flex items-center gap-4 text-primary-green">
                 <ShoppingBag className="w-8 h-8" />
                 ফসল বিক্রির তালিকা
              </h3>
              <form onSubmit={handleAdd} className="space-y-4">
                <input 
                  autoFocus
                  required
                  placeholder="ফসলের নাম" 
                  className="w-full bg-paper-bg p-5 rounded-2xl border-3 border-border-ink/10 outline-none focus:border-primary-green font-bold text-lg"
                  value={newItem.cropName}
                  onChange={e => setNewItem({...newItem, cropName: e.target.value})}
                />
                <div className="grid grid-cols-2 gap-4">
                  <input 
                    required
                    type="number" 
                    placeholder="দাম (৳ / মণ)" 
                    className="w-full bg-paper-bg p-5 rounded-2xl border-3 border-border-ink/10 outline-none focus:border-primary-green font-bold text-lg"
                    value={newItem.price}
                    onChange={e => setNewItem({...newItem, price: e.target.value})}
                  />
                  <input 
                    placeholder="পরিমাণ" 
                    className="w-full bg-paper-bg p-5 rounded-2xl border-3 border-border-ink/10 outline-none focus:border-primary-green font-bold text-lg"
                    value={newItem.quantity}
                    onChange={e => setNewItem({...newItem, quantity: e.target.value})}
                  />
                </div>
                <textarea 
                  placeholder="ফসলের বিস্তারিত বিবরণ..." 
                  className="w-full bg-paper-bg p-5 rounded-2xl border-3 border-border-ink/10 outline-none focus:border-primary-green resize-none font-medium h-32 italic"
                  value={newItem.description}
                  onChange={e => setNewItem({...newItem, description: e.target.value})}
                />
                <div className="flex gap-3 pt-6">
                   <button 
                    type="button"
                    onClick={() => setShowAdd(false)}
                    className="flex-1 py-4 font-black uppercase text-xs tracking-widest text-slate-400"
                  >
                    বাতিল
                  </button>
                  <button 
                    type="submit"
                    className="flex-[2] bg-accent-yellow text-border-ink py-5 rounded-2xl font-black text-lg border-4 border-border-ink shadow-[6px_6px_0_rgba(0,0,0,1)] active:translate-x-[6px] active:translate-y-[6px] active:shadow-none transition-all"
                  >
                    তালিকাভুক্ত করুন
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ProfileView({ profile, setProfile }: { profile: UserProfile | null, setProfile: (p: UserProfile) => void }) {
  const [editing, setEditing] = useState(false);
  const [editedProfile, setEditedProfile] = useState<UserProfile | null>(profile);
  const [saving, setSaving] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'communication' | 'farm' | 'yield' | 'history'>('communication');

  if (!profile || !editedProfile) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    LocalDB.saveProfile(editedProfile);
    setProfile(editedProfile);
    setEditing(false);
    setSaving(false);
  };

  const personalDetails = [
    { label: 'Farmer ID', value: profile.farmerId },
    { label: 'NID Number', value: profile.nid },
    { label: 'Farmer Type', value: 'মাঝারি (Medium)' },
    { label: 'Category', value: 'সাধারণ (General)' },
    { label: 'Gender', value: profile.gender || 'উল্লেখ করা হয়নি' },
    { label: 'Date of birth', value: profile.dob || 'উল্লেখ করা হয়নি' },
  ];

  return (
    <div className="lg:col-span-3 flex flex-col md:flex-row gap-8 min-h-[600px]">
      {/* Left Sidebar - Personal Info */}
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="w-full md:w-[320px] shrink-0 space-y-6"
      >
        <div className="panel p-6 flex flex-col items-center text-center">
          <div className="w-32 h-32 bg-[#E2F0D9] rounded-2xl border-4 border-border-ink flex items-center justify-center shadow-[8px_8px_0_rgba(0,0,0,1)] mb-6 overflow-hidden">
             <UserIcon className="w-20 h-20 text-primary-green" />
          </div>
          
          <h3 className="text-xl font-serif font-black italic mb-1 flex items-center gap-2">
            {profile.displayName}
            <div className="w-4 h-4 bg-primary-green text-white text-[10px] rounded-full flex items-center justify-center font-bold">i</div>
          </h3>
          <p className="text-[10px] font-black text-primary-green mb-6 tracking-tight flex items-center gap-1">
            Farmer ID: {profile.farmerId} <Plus className="w-3 h-3 rotate-45 cursor-pointer" />
          </p>

          <div className="w-full divide-y-2 divide-slate-100 border-2 border-slate-100 rounded-xl overflow-hidden shadow-sm">
             {personalDetails.map((detail, idx) => (
                <div key={idx} className="flex text-[11px] leading-none group hover:bg-slate-50 transition-colors">
                   <div className="w-[140px] bg-slate-50/50 p-4 font-bold text-slate-500 border-r-2 border-slate-100 text-left">
                     {detail.label}
                   </div>
                   <div className="flex-1 p-4 font-bold text-slate-800 text-left">
                     {detail.value}
                   </div>
                </div>
             ))}
          </div>

          <div className="flex flex-col w-full gap-3 mt-6">
            <button 
              onClick={() => setEditing(!editing)}
              className="w-full bg-white border-3 border-border-ink py-2 rounded-xl font-black text-xs shadow-[4px_4px_0_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all flex items-center justify-center gap-2"
            >
              <Settings className={`w-3 h-3 ${editing ? 'animate-spin' : ''}`} />
              {editing ? 'Cancel Editing' : 'Edit Profile Info'}
            </button>
            <button 
              onClick={() => {
                LocalDB.deleteProfile();
                window.location.reload();
              }}
              className="w-full bg-red-50 text-red-600 border-3 border-red-200 py-2 rounded-xl font-black text-xs hover:bg-red-100 transition-all flex items-center justify-center gap-2"
            >
              <LogOut className="w-3 h-3" />
              প্রোফাইল মুছে ফেলুন (Reset Profile)
            </button>
          </div>
        </div>
      </motion.div>

      {/* Right Column - Tabbed Details */}
      <motion.div 
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex-1 space-y-6"
      >
        <div className="panel h-full flex flex-col overflow-hidden">
          {/* Tabs Header */}
          <div className="bg-primary-green p-2 flex border-b-2 border-border-ink">
             <button 
               onClick={() => setActiveSubTab('communication')}
               className={`flex-1 py-4 text-xs font-bold transition-all rounded-t-xl ${activeSubTab === 'communication' ? 'bg-white text-primary-green shadow-[-4px_-4px_0_rgba(0,0,0,0.1)]' : 'text-white hover:bg-white/10'}`}
             >
               Communication Details
             </button>
             <button 
               onClick={() => setActiveSubTab('farm')}
               className={`flex-1 py-4 text-xs font-bold transition-all rounded-t-xl ${activeSubTab === 'farm' ? 'bg-white text-primary-green shadow-[-4px_-4px_0_rgba(0,0,0,0.1)]' : 'text-white hover:bg-white/10'}`}
             >
               Farm Information
             </button>
             <button 
               onClick={() => setActiveSubTab('yield')}
               className={`flex-1 py-4 text-xs font-bold transition-all rounded-t-xl ${activeSubTab === 'yield' ? 'bg-white text-primary-green shadow-[-4px_-4px_0_rgba(0,0,0,0.1)]' : 'text-white hover:bg-white/10'}`}
             >
               Yield information
             </button>
             <button 
               onClick={() => setActiveSubTab('history')}
               className={`flex-1 py-4 text-xs font-bold transition-all rounded-t-xl ${activeSubTab === 'history' ? 'bg-white text-primary-green shadow-[-4px_-4px_0_rgba(0,0,0,0.1)]' : 'text-white hover:bg-white/10'}`}
             >
               APMC Bill History
             </button>
          </div>

          <div className="p-10 flex-1 bg-white">
             {editing ? (
               <form onSubmit={handleSave} className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">আপনার নাম (Full Name)</label>
                        <input 
                          className="w-full bg-paper-bg p-4 rounded-xl border-3 border-border-ink/10 outline-none focus:border-primary-green font-bold text-lg"
                          value={editedProfile.displayName}
                          onChange={e => setEditedProfile({...editedProfile, displayName: e.target.value})}
                        />
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">অবস্থান (District/Location)</label>
                        <input 
                          className="w-full bg-paper-bg p-4 rounded-xl border-3 border-border-ink/10 outline-none focus:border-primary-green font-bold text-lg"
                          value={editedProfile.location}
                          onChange={e => setEditedProfile({...editedProfile, location: e.target.value})}
                        />
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">জমির পরিমাণ (Land Size)</label>
                        <input 
                          className="w-full bg-paper-bg p-4 rounded-xl border-3 border-border-ink/10 outline-none focus:border-primary-green font-bold text-lg"
                          value={editedProfile.landSize || ''}
                          onChange={e => setEditedProfile({...editedProfile, landSize: e.target.value})}
                        />
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">প্রধান ফসল (Primary Crop)</label>
                        <input 
                          className="w-full bg-paper-bg p-4 rounded-xl border-3 border-border-ink/10 outline-none focus:border-primary-green font-bold text-lg"
                          value={editedProfile.primaryCrop || ''}
                          onChange={e => setEditedProfile({...editedProfile, primaryCrop: e.target.value})}
                        />
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">এনআইডি নম্বর (NID Number)</label>
                        <input 
                          className="w-full bg-paper-bg p-4 rounded-xl border-3 border-border-ink/10 outline-none focus:border-primary-green font-bold text-lg"
                          value={editedProfile.nid || ''}
                          onChange={e => setEditedProfile({...editedProfile, nid: e.target.value})}
                        />
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">ইমেইল (Email)</label>
                        <input 
                          className="w-full bg-paper-bg p-4 rounded-xl border-3 border-border-ink/10 outline-none focus:border-primary-green font-bold text-lg"
                          value={editedProfile.email || ''}
                          onChange={e => setEditedProfile({...editedProfile, email: e.target.value})}
                        />
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">লিঙ্গ (Gender)</label>
                        <select 
                          className="w-full bg-paper-bg p-4 rounded-xl border-3 border-border-ink/10 outline-none focus:border-primary-green font-bold text-lg"
                          value={editedProfile.gender || ''}
                          onChange={e => setEditedProfile({...editedProfile, gender: e.target.value})}
                        >
                          <option value="">নির্বাচন করুন</option>
                          <option value="Male">পুরুষ (Male)</option>
                          <option value="Female">মহিলা (Female)</option>
                          <option value="Other">অন্যান্য (Other)</option>
                        </select>
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">ব্যাংক নাম (Bank Name)</label>
                        <input 
                          className="w-full bg-paper-bg p-4 rounded-xl border-3 border-border-ink/10 outline-none focus:border-primary-green font-bold text-lg"
                          value={editedProfile.bankName || ''}
                          onChange={e => setEditedProfile({...editedProfile, bankName: e.target.value})}
                        />
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">একাউন্ট নম্বর (Account Number)</label>
                        <input 
                          className="w-full bg-paper-bg p-4 rounded-xl border-3 border-border-ink/10 outline-none focus:border-primary-green font-bold text-lg"
                          value={editedProfile.accountNumber || ''}
                          onChange={e => setEditedProfile({...editedProfile, accountNumber: e.target.value})}
                        />
                     </div>
                  </div>
                  <button 
                    type="submit"
                    disabled={saving}
                    className="w-full py-5 bg-primary-green text-white font-black text-xl border-4 border-border-ink rounded-3xl shadow-[8px_8px_0_rgba(0,0,0,1)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all flex items-center justify-center gap-4"
                  >
                    {saving ? <Loader2 className="animate-spin text-white" /> : 'সব তথ্য সংরক্ষণ করুন (Update Profile)'}
                  </button>
               </form>
             ) : (
               <div className="space-y-12">
                  {/* Tab Specific Content */}
                  {activeSubTab === 'communication' && (
                    <div className="space-y-10 animate-in fade-in duration-500">
                       <section className="space-y-8">
                          <h4 className="text-xl font-serif font-black italic border-b-2 border-slate-100 pb-4">Communication details</h4>
                          <div className="grid grid-cols-1 gap-6 text-sm">
                             <div className="flex gap-4">
                               <span className="w-40 font-bold text-slate-800">Farmer ID :</span>
                               <span className="font-black text-primary-green text-lg italic">{profile.farmerId}</span>
                             </div>
                             <div className="flex gap-4">
                               <span className="w-40 font-bold text-slate-800">NID Number :</span>
                               <span className="font-medium text-slate-500">{profile.nid}</span>
                             </div>
                             <div className="flex gap-4">
                               <span className="w-40 font-bold text-slate-800">Email :</span>
                               <span className="font-medium text-slate-500">{profile.email || 'উল্লেখ করা হয়নি'}</span>
                               {profile.email && (
                                 <span className="flex items-center gap-2 text-primary-green font-black uppercase text-[10px] bg-primary-green/5 px-2 py-0.5 rounded-full border border-primary-green/20">
                                   Verified <div className="w-4 h-4 rounded-full bg-primary-green text-white flex items-center justify-center text-[8px] italic">✓</div>
                                 </span>
                               )}
                             </div>
                             <div className="flex gap-4">
                               <span className="w-40 font-bold text-slate-800">Mobile Number :</span>
                               <span className="font-medium text-slate-500">{profile.phone || '+880 1XXX-XXXXXX'}</span>
                               <span className="flex items-center gap-2 text-primary-green font-black uppercase text-[10px] bg-primary-green/5 px-2 py-0.5 rounded-full border border-primary-green/20">
                                 Verified <div className="w-4 h-4 rounded-full bg-primary-green text-white flex items-center justify-center text-[8px] italic">✓</div>
                               </span>
                             </div>
                             <div className="flex gap-4">
                               <span className="w-40 font-bold text-slate-800">Pincode :</span>
                               <span className="font-medium text-slate-500">{profile.pincode || 'উল্লেখ করা হয়নি'}</span>
                             </div>
                             <div className="flex gap-4">
                               <span className="w-40 font-bold text-slate-800">District :</span>
                               <span className="font-medium text-slate-500">{profile.location}</span>
                             </div>
                             <div className="flex gap-4">
                               <span className="w-40 font-bold text-slate-800">Address :</span>
                               <span className="font-medium text-slate-500 italic">{profile.address || 'বাংলাদেশ (Bangladesh)'}</span>
                             </div>
                          </div>
                       </section>

                       <section className="space-y-8">
                          <h4 className="text-xl font-serif font-black italic border-b-2 border-slate-100 pb-4">Bank details</h4>
                          <div className="grid grid-cols-1 gap-6 text-sm">
                             <div className="flex gap-4">
                               <span className="w-40 font-bold text-slate-800">Bank name :</span>
                               <span className="font-medium text-slate-500">{profile.bankName || 'সোনালী ব্যাংক লিমিটেড (Sonali Bank)'}</span>
                             </div>
                             <div className="flex gap-4">
                               <span className="w-40 font-bold text-slate-800">IFSC Code :</span>
                               <span className="font-medium text-slate-500">{profile.bankName ? 'SBLB-BD-DH' : 'SBLB0000XXX'}</span>
                             </div>
                             <div className="flex gap-4">
                               <span className="w-40 font-bold text-slate-800">Account Number :</span>
                               <span className="font-medium text-slate-500">{profile.accountNumber || 'XXXX XXXX XXXX XXXX'}</span>
                             </div>
                          </div>
                       </section>
                    </div>
                  )}

                  {activeSubTab === 'farm' && (
                    <div className="space-y-10 animate-in fade-in duration-500">
                       <section className="space-y-8">
                          <h4 className="text-xl font-serif font-black italic border-b-2 border-slate-100 pb-4">Farm Information</h4>
                          <div className="grid grid-cols-1 gap-6 text-sm">
                             <div className="flex gap-4">
                               <span className="w-40 font-bold text-slate-800">Land Size :</span>
                               <span className="font-black text-primary-green text-lg italic">{profile.landSize || 'Not set'}</span>
                             </div>
                             <div className="flex gap-4">
                               <span className="w-40 font-bold text-slate-800">Primary Crop :</span>
                               <span className="font-black text-primary-green text-lg italic">{profile.primaryCrop || 'Not set'}</span>
                             </div>
                             <div className="flex gap-4">
                               <span className="w-40 font-bold text-slate-800">Soil Condition :</span>
                               <span className="font-medium text-slate-500">Clay loam, pH 6.8</span>
                             </div>
                             <div className="flex gap-4">
                               <span className="w-40 font-bold text-slate-800">Irrigation Type :</span>
                               <span className="font-medium text-slate-500">Drip Irrigation</span>
                             </div>
                          </div>
                       </section>
                    </div>
                  )}

                  {activeSubTab === 'yield' && (
                    <div className="text-center py-20 bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200">
                       <Sprout className="w-16 h-16 mx-auto mb-4 text-slate-200" strokeWidth={1} />
                       <p className="font-serif italic font-bold text-slate-400 uppercase tracking-widest text-[10px]">No Yield Data Found</p>
                    </div>
                  )}

                  {activeSubTab === 'history' && (
                    <div className="text-center py-20 bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200">
                       <ShoppingBag className="w-16 h-16 mx-auto mb-4 text-slate-200" strokeWidth={1} />
                       <p className="font-serif italic font-bold text-slate-400 uppercase tracking-widest text-[10px]">Bill History Unavailable</p>
                    </div>
                  )}
               </div>
             )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
