import React, { useState } from "react";

export default function AuthUI({ onLoginSuccess }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    // Tunatengeneza usaili wa sekunde 1 (Mock Auth) kabisa kabla ya kuingia ndani
    setTimeout(() => {
      setLoading(false);
      onLoginSuccess();
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900/90 rounded-2xl border border-slate-800 p-8 shadow-2xl backdrop-blur-md space-y-6">
        
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 bg-amber-500/10 rounded-2xl border border-amber-500/20 text-2xl">
            🏢
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 mt-2">
            {isSignUp ? "Sajili Akaunti Mpya" : "Letema Stationery"}
          </h1>
          <p className="text-sm text-slate-400">
            {isSignUp ? "Jiunge na Mfumo wa Kidijitali" : "Internet Café & Service Management Center"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Jina Kamili</label>
              <input 
                type="text" 
                placeholder="Mussa Chilangazi" 
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 placeholder-slate-700 focus:outline-none focus:border-amber-500 transition-all text-sm"
                required
              />
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Barua Pepe (Email)</label>
            <input 
              type="email" 
              placeholder="ceo@letemagroup.com" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 placeholder-slate-700 focus:outline-none focus:border-amber-500 transition-all text-sm"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Neno la Siri (Password)</label>
            <input 
              type="password" 
              placeholder="••••••••" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 placeholder-slate-700 focus:outline-none focus:border-amber-500 transition-all text-sm"
              required
            />
          </div>

          <button 
            type="submit" 
            className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-3 rounded-xl transition-all shadow-lg text-sm flex items-center justify-center space-x-2"
          >
            <span>{loading ? "Inafungua Ofisi..." : isSignUp ? "Kamilisha Usajili 📝" : "Ingia Ofisini 🔒"}</span>
          </button>
        </form>

        <div className="text-center border-t border-slate-800/60 pt-4">
          <button 
            type="button" 
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-xs font-medium text-amber-500 hover:text-amber-400 transition-all"
          >
            {isSignUp ? "Tayari una akaunti? Ingia hapa" : "Huna akaunti bado? Jisajili hapa"}
          </button>
        </div>

      </div>
    </div>
  );
}

