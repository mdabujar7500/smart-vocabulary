'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/useAuth';
import { setStatusByWord } from '@/lib/vocab';
import WordCard from '@/components/WordCard';

const FILE_EXT = ['txt', 'pdf', 'docx', 'png', 'jpg', 'jpeg', 'webp'];

export default function UploadPage() {
  const { user, loading: authLoading } = useAuth();
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileType, setFileType] = useState('text');
  const [words, setWords] = useState([]);
  const [statuses, setStatuses] = useState({});
  const [info, setInfo] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setError('');
    setInfo('');
    setWords([]);
    setDone(false);

    const ext = file.name.split('.').pop().toLowerCase();
    if (!FILE_EXT.includes(ext)) {
      setError('সাপোর্টেড ফাইল: PDF, DOCX, TXT, PNG, JPG, WEBP');
      return;
    }
    setFileName(file.name);
    setFileType(ext);

    if (ext === 'txt') {
      setText(await file.text());
      return;
    }

    if (!user) {
      setError('PDF, Word ও ছবি আপলোড করতে লগইন করুন। Guest শুধু text পেস্ট বা .txt ফাইল দিতে পারবে।');
      return;
    }

    setExtracting(true);
    try {
      const { data } = await supabase.auth.getSession();
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/extract-text', {
        method: 'POST',
        headers: { Authorization: `Bearer ${data.session.access_token}` },
        body: form,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'ফাইল পড়া যায়নি');
      setText(json.text);
    } catch (err) {
      setError(err.message);
    }
    setExtracting(false);
  }

  async function handleExtract() {
    setLoading(true);
    setError('');
    setInfo('');
    setWords([]);
    setStatuses({});
    setDone(false);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await fetch('/api/extract-words', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ text, fileName: fileName || 'Pasted text', fileType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'অজানা ত্রুটি');

      setWords(data.words);
      setDone(true);

      const parts = [`নতুন শব্দ: ${data.words.length}টি`];
      if (data.skipped > 0) parts.push(`আগে পাওয়া বলে বাদ: ${data.skipped}টি`);
      if (data.truncated) parts.push('text অনেক বড় ছিল, বাকি শব্দের জন্য আবার বাটন চাপুন');
      if (token) {
        parts.push(data.plan === 'premium' ? 'Premium: আনলিমিটেড' : `আজ আর ${data.remaining} বার বাকি`);
      }
      setInfo(parts.join('  •  '));
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  async function mark(word, status) {
    const previous = statuses[word] || 'new';
    setStatuses((s) => ({ ...s, [word]: status }));
    try {
      await setStatusByWord(word, status);
    } catch (err) {
      setStatuses((s) => ({ ...s, [word]: previous }));
      setError(err.message || 'সংরক্ষণ করা যায়নি');
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-3xl font-bold text-slate-900">Vocabulary বের করুন</h1>
      <p className="mt-1 text-slate-600">ফাইল আপলোড করুন অথবা English text পেস্ট করুন।</p>

      {!authLoading && !user && (
        <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800">
          আপনি Guest হিসেবে আছেন: শব্দ সংরক্ষণ হবে না এবং শুধু text/.txt চলবে।{' '}
          <Link href="/login" className="font-semibold underline">
            লগইন করুন
          </Link>{' '}
          সব ফিচারের জন্য।
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center hover:border-indigo-400 hover:bg-indigo-50">
          <span className="text-4xl">📄</span>
          <span className="mt-2 font-medium text-slate-800">
            {extracting ? 'ফাইল থেকে text বের হচ্ছে...' : 'ফাইল বেছে নিতে ক্লিক করুন'}
          </span>
          <span className="mt-1 text-xs text-slate-500">PDF • DOCX • TXT • PNG • JPG • WEBP</span>
          {fileName && <span className="mt-2 text-sm font-medium text-indigo-700">{fileName}</span>}
          <input type="file" accept=".txt,.pdf,.docx,.png,.jpg,.jpeg,.webp" onChange={handleFile} className="hidden" />
        </label>

        <div className="my-4 text-center text-sm text-slate-400">অথবা</div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          placeholder="এখানে English text পেস্ট করুন..."
          className="w-full rounded-xl border border-slate-300 p-3 text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
        />

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={handleExtract}
            disabled={loading || extracting || text.trim().length < 2}
            className="rounded-xl bg-indigo-600 px-6 py-2.5 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'বিশ্লেষণ চলছে... (একটু সময় লাগতে পারে)' : '✨ Vocabulary বের করুন'}
          </button>
          {text && (
            <button
              onClick={() => {
                setText('');
                setFileName('');
                setFileType('text');
                setWords([]);
                setInfo('');
                setDone(false);
              }}
              className="text-sm text-slate-500 hover:text-slate-800"
            >
              মুছে ফেলুন
            </button>
          )}
        </div>
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {info && <p className="mt-4 rounded-lg bg-indigo-50 p-3 text-sm font-medium text-indigo-800">{info}</p>}

      {done && words.length === 0 && (
        <p className="mt-6 text-center text-slate-600">
          এই text-এ নতুন কোনো শব্দ নেই, সব আগে দেখানো হয়েছে। 🎉
        </p>
      )}

      {words.length > 0 && (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {words.map((w) => (
            <WordCard
              key={w.word}
              w={w}
              status={statuses[w.word] || 'new'}
              onChange={user ? (s) => mark(w.word, s) : undefined}
            />
          ))}
        </div>
      )}

      {user && words.length > 0 && (
        <p className="mt-6 text-center text-sm text-slate-500">
          সব শব্দ আপনার <Link href="/my-vocabulary" className="font-medium text-indigo-600 underline">My Vocabulary</Link>-তে সংরক্ষিত আছে।
        </p>
      )}
    </main>
  );
}