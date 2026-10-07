'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/useAuth';

const STATUS_LABEL = { new: 'নতুন', learned: 'শেখা', learn_later: 'পরে শিখব' };
const STATUS_STYLE = {
  new: 'bg-slate-100 text-slate-600',
  learned: 'bg-green-100 text-green-700',
  learn_later: 'bg-amber-100 text-amber-700',
};

function Stat({ icon, label, value, color }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-500">{label}</span>
        <span className="text-2xl">{icon}</span>
      </div>
      <p className={`mt-2 text-3xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [d, setD] = useState(null);
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
    try {
      const count = async (status) => {
        let q = supabase.from('user_words').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
        if (status) q = q.eq('status', status);
        const { count: c, error } = await q;
        if (error) throw error;
        return c || 0;
      };

      const days = Array.from({ length: 7 }, (_, i) =>
        new Date(Date.now() - (6 - i) * 86400000).toISOString().slice(0, 10)
      );

      const [total, learned, later, profile, usage, recentWords, docs] = await Promise.all([
        count(),
        count('learned'),
        count('learn_later'),
        supabase.from('profiles').select('plan').eq('id', user.id).maybeSingle(),
        supabase.from('daily_usage').select('usage_date, upload_count').eq('user_id', user.id).gte('usage_date', days[0]),
        supabase
          .from('user_words')
          .select('status, words(word, bangla_meaning)')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
          .limit(6),
        supabase
          .from('documents')
          .select('id, file_name, file_type, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      const plan = profile.data?.plan || 'free';
      const lim = await supabase.from('plan_limits').select('daily_uploads').eq('plan', plan).maybeSingle();

      const usageMap = {};
      (usage.data || []).forEach((u) => (usageMap[u.usage_date] = u.upload_count));

      setD({
        total,
        learned,
        later,
        remaining: total - learned,
        plan,
        limit: lim.data?.daily_uploads ?? 10,
        todayUsed: usageMap[days[6]] || 0,
        week: days.map((day) => ({ day, n: usageMap[day] || 0 })),
        recentWords: (recentWords.data || []).filter((r) => r.words),
        docs: docs.data || [],
      });
    } catch {
      setError('Dashboard লোড করা যায়নি।');
    }
  }

  if (authLoading || (!d && !error)) {
    return <p className="p-10 text-center text-slate-500">লোড হচ্ছে...</p>;
  }
  if (error) return <p className="p-10 text-center text-red-600">{error}</p>;

  const percent = d.total ? Math.round((d.learned / d.total) * 100) : 0;
  const premium = d.plan === 'premium';
  const usagePercent = premium ? 0 : Math.min(100, Math.round((d.todayUsed / d.limit) * 100));
  const maxWeek = Math.max(1, ...d.week.map((w) => w.n));

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">{user.email}</p>
        </div>
        <span className={`rounded-full px-4 py-1.5 text-sm font-semibold ${premium ? 'bg-amber-100 text-amber-800' : 'bg-indigo-100 text-indigo-700'}`}>
          {premium ? '⭐ Premium' : 'Free প্ল্যান'}
        </span>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon="📚" label="মোট শব্দ" value={d.total} color="text-slate-900" />
        <Stat icon="✅" label="শেখা শব্দ" value={d.learned} color="text-green-600" />
        <Stat icon="🔖" label="পরে শিখব" value={d.later} color="text-amber-600" />
        <Stat icon="⏳" label="বাকি শব্দ" value={d.remaining} color="text-indigo-600" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">শেখার অগ্রগতি</h2>
            <span className="text-2xl font-bold text-green-600">{percent}%</span>
          </div>
          <div className="mt-3 h-4 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-gradient-to-r from-green-400 to-green-600" style={{ width: `${percent}%` }} />
          </div>
          <p className="mt-2 text-sm text-slate-500">
            {d.total} শব্দের মধ্যে {d.learned}টি শেখা হয়েছে।
          </p>

          <h3 className="mt-6 text-sm font-semibold text-slate-700">গত ৭ দিনের ব্যবহার</h3>
          <div className="mt-3 flex h-28 items-end gap-2">
            {d.week.map((w) => (
              <div key={w.day} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-xs text-slate-500">{w.n}</span>
                <div className="w-full rounded-t bg-indigo-500" style={{ height: `${Math.max(4, (w.n / maxWeek) * 64)}px` }} />
                <span className="text-[10px] text-slate-400">{w.day.slice(5)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-slate-900">আজকের ব্যবহার</h2>
          {premium ? (
            <p className="mt-4 text-3xl font-bold text-amber-600">আনলিমিটেড ∞</p>
          ) : (
            <>
              <p className="mt-4 text-3xl font-bold text-slate-900">
                {d.todayUsed} <span className="text-lg font-medium text-slate-400">/ {d.limit}</span>
              </p>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100">
                <div className={`h-full rounded-full ${usagePercent >= 90 ? 'bg-red-500' : 'bg-indigo-500'}`} style={{ width: `${usagePercent}%` }} />
              </div>
              <p className="mt-2 text-sm text-slate-500">আর {Math.max(d.limit - d.todayUsed, 0)} বার বাকি</p>
            </>
          )}
          <Link href="/upload" className="mt-6 block rounded-lg bg-indigo-600 py-2.5 text-center font-medium text-white hover:bg-indigo-700">
            নতুন ডকুমেন্ট আপলোড
          </Link>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">সাম্প্রতিক শব্দ</h2>
            <Link href="/my-vocabulary" className="text-sm font-medium text-indigo-600 hover:underline">সব দেখুন →</Link>
          </div>
          {d.recentWords.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">এখনো কোনো শব্দ নেই।</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {d.recentWords.map((r, i) => (
                <li key={i} className="flex items-center justify-between py-2.5">
                  <div>
                    <span className="font-semibold text-slate-900">{r.words.word}</span>
                    <span className="ml-2 text-sm text-slate-500">{r.words.bangla_meaning}</span>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-slate-900">সাম্প্রতিক ডকুমেন্ট</h2>
          {d.docs.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">এখনো কোনো ডকুমেন্ট আপলোড করা হয়নি।</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {d.docs.map((doc) => (
                <li key={doc.id} className="flex items-center justify-between py-2.5">
                  <span className="truncate pr-3 text-slate-800">📄 {doc.file_name}</span>
                  <span className="shrink-0 text-xs text-slate-400">{new Date(doc.created_at).toLocaleDateString('bn-BD')}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}