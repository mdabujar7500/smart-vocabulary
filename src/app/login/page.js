 'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/useAuth';

export default function LoginPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && user) router.replace('/dashboard');
  }, [user, authLoading, router]);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const { data, error } =
      mode === 'register'
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (error) {
      setIsError(true);
      setMessage(error.message);
      return;
    }

    setIsError(false);
    if (data.session) {
      router.push('/dashboard');
    } else {
      setMessage('অ্যাকাউন্ট তৈরি হয়েছে। ইমেইল চেক করে কনফার্ম করুন।');
    }
  }

  return (
    <main className="flex min-h-[calc(100vh-130px)] items-center justify-center bg-gradient-to-br from-indigo-50 to-blue-50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
        <div className="text-center">
          <div className="text-4xl">📚</div>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">
            {mode === 'login' ? 'আবার স্বাগতম' : 'নতুন অ্যাকাউন্ট খুলুন'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {mode === 'login'
              ? 'লগইন করে আপনার শেখা শব্দ দেখুন'
              : 'আপনার শেখার ইতিহাস সংরক্ষণ শুরু করুন'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">ইমেইল</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">পাসওয়ার্ড</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="কমপক্ষে ৬ অক্ষর"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-indigo-600 py-2.5 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'অপেক্ষা করুন...' : mode === 'login' ? 'লগইন করুন' : 'অ্যাকাউন্ট খুলুন'}
          </button>
        </form>

        {message && (
          <p className={`mt-4 rounded-lg p-3 text-center text-sm ${isError ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
            {message}
          </p>
        )}

        <button
          onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login');
            setMessage('');
          }}
          className="mt-5 w-full text-center text-sm font-medium text-indigo-600 hover:underline"
        >
          {mode === 'login'
            ? 'অ্যাকাউন্ট নেই? নতুন অ্যাকাউন্ট খুলুন'
            : 'আগে থেকেই অ্যাকাউন্ট আছে? লগইন করুন'}
        </button>
      </div>
    </main>
  );
}