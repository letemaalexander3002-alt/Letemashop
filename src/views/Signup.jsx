import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Signup() {
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signUp(email, password, fullName, phoneNumber);
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Kuna hitilafu imetokea wakati wa kujisajili.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-lg border border-gray-100">
        <div>
          <h2 className="text-center text-3xl font-extrabold text-brand-primary">
            Letema Stationery
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Unda akaunti yako sasa kufurahia huduma zetu
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded text-sm text-red-700">
            {error}
          </div>
        )}

        {success ? (
          <div className="bg-green-50 border-l-4 border-brand-accent p-4 rounded text-sm text-green-700 text-center">
            Usajili umekamilika! Tafadhali kagua barua pepe yako (Email) ili kuthibitisha akaunti yako kabla ya kuingia.
          </div>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="rounded-md shadow-sm space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Jina Kamili</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-primary focus:border-brand-primary sm:text-sm"
                  placeholder="Mf. Alexander Letema"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Namba ya Simu</label>
                <input
                  type="tel"
                  required
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-primary focus:border-brand-primary sm:text-sm"
                  placeholder="Mf. +2557XXXXXXXX"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Barua Pepe (Email)</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-primary focus:border-brand-primary sm:text-sm"
                  placeholder="barua@pepe.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Nywila (Password)</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-primary focus:border-brand-primary sm:text-sm"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-brand-primary hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary disabled:opacity-50 transition-colors"
              >
                {loading ? 'Inasajili...' : 'Jiandikishe'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

