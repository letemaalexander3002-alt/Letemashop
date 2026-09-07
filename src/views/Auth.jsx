import React, { useState } from 'react';
import { supabase } from '../utils/supabaseClient';

export default function Auth({ onAuthSuccess }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      if (isSignUp) {
        // Mchakato wa Kujisajili (Sign Up)
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        setMessage({ 
          type: 'success', 
          text: 'Umesajiliwa! Angalia barua pepe yako (email) ili kuthibitisha akaunti.' 
        });
      } else {
        // Mchakato wa Kuingia (Sign In)
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        setMessage({ type: 'success', text: 'Umeingia kwa mafanikio!' });
        if (onAuthSuccess) onAuthSuccess(data.user);
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Kuna hitilafu imetokea.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto my-12 p-8 bg-white rounded-2xl border border-gray-200 shadow-sm">
      <h2 className="text-2xl font-extrabold text-blue-900 text-center mb-6">
        {isSignUp ? 'Tengeneza Akaunti Letema' : 'Ingia Kwenye Akaunti'}
      </h2>

      {message.text && (
        <div className={`p-4 mb-4 rounded-xl text-sm font-medium ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleAuth} className="space-y-4">
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">Barua Pepe (Email)</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-900 focus:outline-none"
            placeholder="johndoe@example.com"
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">Nywila (Password)</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-900 focus:outline-none"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-900 text-white font-bold py-3 rounded-xl hover:bg-amber-600 transition-colors disabled:bg-gray-400"
        >
          {loading ? 'Inaprosesi...' : isSignUp ? 'Jisajili Sasa' : 'Ingia'}
        </button>
      </form>

      <div className="mt-6 text-center text-sm text-gray-600">
        {isSignUp ? 'Tayari una akaunti?' : 'Huna akaunti bado?'} &nbsp;
        <button
          onClick={() => setIsSignUp(!isSignUp)}
          className="text-blue-950 font-bold underline hover:text-amber-600"
        >
          {isSignUp ? 'Ingia hapa' : 'Jisajili hapa'}
        </button>
      </div>
    </div>
  );
}

