 'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/useAuth';
import { setStatusById } from '@/lib/vocab';
import { downloadExcel, downloadPdf } from '@/lib/export';
import WordCard from '@/components/WordCard';

const TABS = [
  { key: 'all', label: 'সব' },
  { key: 'new', label: 'নতুন' },
  { key: 'learn_later', label: 'পরে শিখব' },
  { key: 'learned', label: 'শেখা' },
];

const FILE_TAG = { all: 'all', new: 'new', learn_later: 'learn-later', learned: 'learned' };

export default function MyVocabularyPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  async function load() {
    setLoading(true);
    const all = [];
    const pageSize = 1000;
    for (let from = 0; from < 10000; from += pageSize) {
      const { data, error } = await supabase
        .from('user_words')
        .select('word_id, status, updated_at, words(word, bangla_meaning, definition, part_of_speech, synonyms, antonyms)')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .range(from, from + pageSize - 1);
      if (error) {
        setError('শব্দ লোড করা যায়নি।');
        break;
      }
      all.push(...(data || []));
      if (!data || data.length < pageSize) break;
    }
    setRows(all.filter((r) => r.words));
    setLoading(false);
  }

  async function change(wordId, status) {
    const prev = rows;
    setRows((rs) => rs.map((r) => (r.word_id === wordId ? { ...r, status } : r)));
    try {
      await setStatusById(wordId, status);
    } catch {
      setRows(prev);
      setError('পরিবর্তন সংরক্ষণ করা যায়নি।');
    }
  }

  const counts = useMemo(() => {
    const c = { all: rows.length, new: 0, learn_later: 0, learned: 0 };
    rows.forEach((r) => (c[r.status] = (c[r.status] || 0) + 1));
    return c;
  }, [rows]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (tab === 'all' || r.status === tab) &&
        (!q || r.words.word.includes(q) || (r.words.bangla_meaning || '').includes(q))
    );
  }, [rows, tab, query]);

  const tabLabel = TABS.find((t) => t.key === tab)?.label || '';
  const fileName = `my-vocabulary-${FILE_TAG[tab]}-${new Date().toISOString().slice(0, 10)}`;

  async function handleExcel() {
    setError('');
    try {
      await downloadExcel(shown, fileName);
    } catch {
      setError('Excel ফাইল তৈরি করা যায়নি।');
    }
  }

  function handlePdf() {
    setError('');
    try {
      downloadPdf(shown, tabLabel, fileName);
    } catch (err) {
      setError(err.message || 'PDF তৈরি করা যায়নি।');
    }
  }

  if (authLoading || (loading && user)) {
    return <p className="p-10 text-center text-slate-500">লোড হচ্ছে...</p>;
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">My Vocabulary</h1>
          <p className="mt-1 text-slate-600">আপনার সংরক্ষিত সব শব্দ এক জায়গায়।</p>
        </div>
        <Link href="/upload" className="rounded-xl bg-indigo-600 px-5 py-2.5 font-semibold text-white hover:bg-indigo-700">
          + নতুন শব্দ বের করুন
        </Link>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              tab === t.key ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'
            }`}
          >
            {t.label} ({counts[t.key] || 0})
          </button>
        ))}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="🔍 শব্দ খুঁজুন..."
          className="ml-auto w-full rounded-full border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 sm:w-64"
        />
      </div>

      {rows.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-sm text-slate-500">
            ডাউনলোড ({tabLabel}{query.trim() ? ' + সার্চ' : ''} • {shown.length}টি শব্দ):
          </span>
          <button
            onClick={handleExcel}
            disabled={shown.length === 0}
            className="rounded-lg border border-emerald-600 bg-white px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-40"
          >
            📊 Excel
          </button>
          <button
            onClick={handlePdf}
            disabled={shown.length === 0}
            className="rounded-lg border border-rose-600 bg-white px-3 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-40"
          >
            📄 PDF
          </button>
        </div>
      )}

      {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {rows.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <div className="text-4xl">🗂️</div>
          <p className="mt-2 text-slate-600">এখনো কোনো শব্দ সংরক্ষিত হয়নি।</p>
          <Link href="/upload" className="mt-4 inline-block font-medium text-indigo-600 underline">
            প্রথম ডকুমেন্ট আপলোড করুন
          </Link>
        </div>
      ) : shown.length === 0 ? (
        <p className="mt-10 text-center text-slate-500">কোনো শব্দ পাওয়া যায়নি।</p>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {shown.map((r) => (
            <WordCard key={r.word_id} w={r.words} status={r.status} onChange={(s) => change(r.word_id, s)} />
          ))}
        </div>
      )}
    </main>
  );
}