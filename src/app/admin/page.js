'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/useAuth';

async function api(action, payload = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch('/api/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action, ...payload }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json.error || 'ত্রুটি হয়েছে');
    err.status = res.status;
    throw err;
  }
  return json;
}

function Stat({ icon, label, value, color = 'text-slate-900' }) {
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

const TABS = [
  { key: 'overview', label: '📊 ওভারভিউ' },
  { key: 'users', label: '👥 Users' },
  { key: 'limits', label: '⚙️ লিমিট' },
];

const fmtDate = (d) => new Date(d).toLocaleDateString('en-GB');

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [allowed, setAllowed] = useState(null);
  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [msg, setMsg] = useState({ type: '', text: '' });

  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [usersLoading, setUsersLoading] = useState(false);
  const [detail, setDetail] = useState(null);

  const [limits, setLimits] = useState([]);
  const [maxFileMb, setMaxFileMb] = useState(4);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    api('stats')
      .then((s) => {
        setStats(s);
        setAllowed(true);
      })
      .catch((err) => {
        if (err.status === 401 || err.status === 403) {
          setAllowed(false);
        } else {
          setAllowed(true);
          setMsg({ type: 'error', text: err.message });
        }
      });
  }, [user, authLoading, router]);

  const loadUsers = useCallback(async (p, s) => {
    setUsersLoading(true);
    try {
      const r = await api('users', { page: p, search: s });
      setUsers(r.users);
      setTotal(r.total);
      setPageSize(r.pageSize);
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
    setUsersLoading(false);
  }, []);

  useEffect(() => {
    if (allowed !== true) return;
    if (tab === 'users') loadUsers(page, search);
    if (tab === 'limits') {
      api('get_limits')
        .then((r) => {
          setLimits(r.limits);
          setMaxFileMb(r.maxFileMb);
        })
        .catch((err) => setMsg({ type: 'error', text: err.message }));
    }
  }, [allowed, tab, page, search, loadUsers]);

  function submitSearch(e) {
    e.preventDefault();
    setPage(0);
    setSearch(searchInput.trim());
  }

  async function changePlan(u, plan) {
    setMsg({ type: '', text: '' });
    try {
      await api('set_plan', { userId: u.id, plan });
      setUsers((us) => us.map((x) => (x.id === u.id ? { ...x, plan } : x)));
      setMsg({ type: 'ok', text: `${u.email}-এর প্ল্যান ${plan === 'premium' ? 'Premium' : 'Free'} করা হয়েছে।` });
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
  }

  async function toggleBlock(u) {
    const blocked = !u.is_blocked;
    const ok = window.confirm(blocked ? `${u.email}-কে ব্লক করবেন?` : `${u.email}-কে আনব্লক করবেন?`);
    if (!ok) return;
    setMsg({ type: '', text: '' });
    try {
      await api('set_blocked', { userId: u.id, blocked });
      setUsers((us) => us.map((x) => (x.id === u.id ? { ...x, is_blocked: blocked } : x)));
      setMsg({ type: 'ok', text: blocked ? `${u.email} ব্লক হয়েছে।` : `${u.email} আনব্লক হয়েছে।` });
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
  }

  async function openDetail(u) {
    setDetail({ user: u, loading: true });
    try {
      const r = await api('user_detail', { userId: u.id });
      setDetail({ user: u, loading: false, ...r });
    } catch (err) {
      setDetail(null);
      setMsg({ type: 'error', text: err.message });
    }
  }

  async function wipeData(u) {
    const ok = window.confirm(
      `${u.email}-এর সব শব্দ, ডকুমেন্ট ও ব্যবহারের হিসাব মুছে যাবে। অ্যাকাউন্ট থাকবে। এটা ফেরানো যাবে না। নিশ্চিত?`
    );
    if (!ok) return;
    try {
      await api('delete_user_data', { userId: u.id });
      setMsg({ type: 'ok', text: `${u.email}-এর ডেটা মুছে ফেলা হয়েছে।` });
      await openDetail(u);
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
  }

  function editLimit(plan, field, value) {
    setLimits((ls) => ls.map((l) => (l.plan === plan ? { ...l, [field]: value } : l)));
  }

  async function saveLimit(row) {
    setMsg({ type: '', text: '' });
    try {
      await api('set_limits', {
        plan: row.plan,
        daily_uploads: Number(row.daily_uploads),
        max_file_mb: Number(row.max_file_mb),
      });
      setMsg({ type: 'ok', text: `${row.plan === 'premium' ? 'Premium' : 'Free'} প্ল্যানের লিমিট সংরক্ষিত হয়েছে।` });
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
  }

  if (authLoading || allowed === null) {
    return <p className="p-10 text-center text-slate-500">লোড হচ্ছে...</p>;
  }

  if (allowed === false) {
    return (
      <main className="mx-auto max-w-md px-4 py-20 text-center">
        <div className="text-5xl">🔒</div>
        <h1 className="mt-4 text-2xl font-bold text-slate-900">প্রবেশের অনুমতি নেই</h1>
        <p className="mt-2 text-slate-600">এই পেজ শুধু অ্যাডমিনদের জন্য।</p>
      </main>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Admin Panel</h1>
          <p className="mt-1 text-sm text-slate-500">{user?.email}</p>
        </div>
        <span className="rounded-full bg-rose-100 px-4 py-1.5 text-sm font-semibold text-rose-700">🛡️ অ্যাডমিন</span>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setTab(t.key);
              setMsg({ type: '', text: '' });
            }}
            className={`rounded-full px-5 py-2 text-sm font-medium transition ${
              tab === t.key
                ? 'bg-indigo-600 text-white'
                : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {msg.text && (
        <p
          className={`mt-4 rounded-lg p-3 text-sm ${
            msg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {msg.text}
        </p>
      )}

      {/* ---------- ওভারভিউ ---------- */}
      {tab === 'overview' && stats && (
        <div className="mt-6 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat icon="👥" label="মোট user" value={stats.totalUsers} />
            <Stat icon="🆕" label="গত ৭ দিনে নতুন" value={stats.newUsers} color="text-indigo-600" />
            <Stat icon="⭐" label="Premium user" value={stats.premiumUsers} color="text-amber-600" />
            <Stat icon="🆓" label="Free user" value={stats.freeUsers} color="text-slate-700" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat icon="📄" label="মোট ডকুমেন্ট" value={stats.documents} />
            <Stat icon="📚" label="ডিকশনারির শব্দ" value={stats.words} />
            <Stat icon="✅" label="শেখা মার্ক করা (মোট)" value={stats.learned} color="text-green-600" />
            <Stat icon="🚫" label="ব্লক করা user" value={stats.blockedUsers} color="text-red-600" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Stat icon="📈" label="আজ registered user-দের ব্যবহার" value={stats.usageToday} color="text-indigo-600" />
            <Stat icon="👤" label="আজ Guest-দের ব্যবহার" value={stats.guestUsageToday} color="text-slate-700" />
          </div>
        </div>
      )}

      {/* ---------- Users ---------- */}
      {tab === 'users' && (
        <div className="mt-6">
          <form onSubmit={submitSearch} className="flex flex-wrap gap-2">
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="🔍 ইমেইল দিয়ে খুঁজুন..."
              className="w-full rounded-full border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 sm:w-72"
            />
            <button className="rounded-full bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700">
              খুঁজুন
            </button>
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput('');
                  setSearch('');
                  setPage(0);
                }}
                className="px-3 text-sm text-slate-500 hover:text-slate-800"
              >
                সব দেখুন
              </button>
            )}
            <span className="ml-auto self-center text-sm text-slate-500">মোট: {total}</span>
          </form>

          <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3">ইমেইল</th>
                  <th className="px-4 py-3">প্ল্যান</th>
                  <th className="px-4 py-3">ভূমিকা</th>
                  <th className="px-4 py-3">অবস্থা</th>
                  <th className="px-4 py-3">যোগদান</th>
                  <th className="px-4 py-3">কাজ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {usersLoading && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">লোড হচ্ছে...</td>
                  </tr>
                )}
                {!usersLoading && users.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">কোনো user পাওয়া যায়নি।</td>
                  </tr>
                )}
                {!usersLoading &&
                  users.map((u) => (
                    <tr key={u.id}>
                      <td className="px-4 py-3 font-medium text-slate-900">{u.email || '—'}</td>
                      <td className="px-4 py-3">
                        <select
                          value={u.plan}
                          onChange={(e) => changePlan(u, e.target.value)}
                          className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-slate-800"
                        >
                          <option value="free">Free</option>
                          <option value="premium">Premium</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            u.role === 'admin' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {u.role === 'admin' ? 'Admin' : 'User'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            u.is_blocked ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                          }`}
                        >
                          {u.is_blocked ? 'ব্লক' : 'সক্রিয়'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{fmtDate(u.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => openDetail(u)}
                            className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            বিস্তারিত
                          </button>
                          {u.role !== 'admin' && (
                            <button
                              onClick={() => toggleBlock(u)}
                              className={`rounded-lg border px-3 py-1 text-xs font-medium ${
                                u.is_blocked
                                  ? 'border-green-600 text-green-700 hover:bg-green-50'
                                  : 'border-red-500 text-red-600 hover:bg-red-50'
                              }`}
                            >
                              {u.is_blocked ? 'আনব্লক' : 'ব্লক'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-center gap-3">
            <button
              onClick={() => setPage((p) => Math.max(p - 1, 0))}
              disabled={page === 0}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm disabled:opacity-40"
            >
              ← আগের
            </button>
            <span className="text-sm text-slate-600">
              পেজ {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(p + 1, totalPages - 1))}
              disabled={page >= totalPages - 1}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm disabled:opacity-40"
            >
              পরের →
            </button>
          </div>
        </div>
      )}

      {/* ---------- লিমিট ---------- */}
      {tab === 'limits' && (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {limits.map((l) => (
            <div key={l.plan} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900">{l.plan === 'premium' ? '⭐ Premium' : '🆓 Free'} প্ল্যান</h2>

              <label className="mt-4 block text-sm font-medium text-slate-700">দৈনিক আপলোড সীমা</label>
              <input
                type="number"
                min="1"
                value={l.daily_uploads}
                onChange={(e) => editLimit(l.plan, 'daily_uploads', e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-indigo-500"
              />

              <label className="mt-4 block text-sm font-medium text-slate-700">
                সর্বোচ্চ ফাইল সাইজ (MB, সর্বোচ্চ {maxFileMb})
              </label>
              <input
                type="number"
                min="1"
                max={maxFileMb}
                value={l.max_file_mb}
                onChange={(e) => editLimit(l.plan, 'max_file_mb', e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-indigo-500"
              />

              <button
                onClick={() => saveLimit(l)}
                className="mt-5 w-full rounded-lg bg-indigo-600 py-2.5 font-semibold text-white hover:bg-indigo-700"
              >
                সংরক্ষণ করুন
              </button>
            </div>
          ))}
          <p className="text-sm text-slate-500 md:col-span-2">
            সীমা বদলালে সাথে সাথে নতুন সীমা কার্যকর হবে। ফাইল সাইজ ৪ MB-এর বেশি রাখা যাবে না, কারণ হোস্টিং সার্ভিস
            এর বড় ফাইল সার্ভারে পাঠাতে দেয় না।
          </p>
        </div>
      )}

      {/* ---------- User বিস্তারিত ---------- */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-slate-900">User বিস্তারিত</h2>
                <p className="mt-1 break-all text-sm text-slate-500">{detail.user.email}</p>
              </div>
              <button onClick={() => setDetail(null)} className="text-2xl text-slate-400 hover:text-slate-700">
                ✕
              </button>
            </div>

            {detail.loading ? (
              <p className="py-10 text-center text-slate-500">লোড হচ্ছে...</p>
            ) : (
              <>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-slate-50 p-3 text-center">
                    <p className="text-2xl font-bold text-slate-900">{detail.total}</p>
                    <p className="text-xs text-slate-500">মোট শব্দ</p>
                  </div>
                  <div className="rounded-xl bg-green-50 p-3 text-center">
                    <p className="text-2xl font-bold text-green-600">{detail.learned}</p>
                    <p className="text-xs text-slate-500">শেখা</p>
                  </div>
                  <div className="rounded-xl bg-amber-50 p-3 text-center">
                    <p className="text-2xl font-bold text-amber-600">{detail.later}</p>
                    <p className="text-xs text-slate-500">পরে শিখব</p>
                  </div>
                  <div className="rounded-xl bg-indigo-50 p-3 text-center">
                    <p className="text-2xl font-bold text-indigo-600">{detail.fresh}</p>
                    <p className="text-xs text-slate-500">নতুন</p>
                  </div>
                </div>

                <p className="mt-4 text-sm text-slate-600">
                  মোট ডকুমেন্ট: <b>{detail.docCount}</b> • আজকের ব্যবহার: <b>{detail.todayUsed}</b>
                </p>

                <h3 className="mt-4 text-sm font-semibold text-slate-800">সাম্প্রতিক ডকুমেন্ট</h3>
                {detail.documents.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">কোনো ডকুমেন্ট নেই।</p>
                ) : (
                  <ul className="mt-2 divide-y divide-slate-100 text-sm">
                    {detail.documents.map((d, i) => (
                      <li key={i} className="flex justify-between gap-3 py-2">
                        <span className="truncate text-slate-800">📄 {d.file_name}</span>
                        <span className="shrink-0 text-xs text-slate-400">{fmtDate(d.created_at)}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {detail.user.role !== 'admin' && (
                  <button
                    onClick={() => wipeData(detail.user)}
                    className="mt-6 w-full rounded-lg border border-red-500 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50"
                  >
                    🗑️ এই user-এর সব ডেটা মুছুন
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}