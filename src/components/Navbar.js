'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/useAuth';
import { supabase } from '@/lib/supabase';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let active = true;
    if (!user) {
      setIsAdmin(false);
      return;
    }
    supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setIsAdmin(data?.role === 'admin');
      });
    return () => {
      active = false;
    };
  }, [user]);

  const links = [
    { href: '/', label: 'হোম' },
    { href: '/upload', label: 'আপলোড' },
    ...(user
      ? [
          { href: '/my-vocabulary', label: 'My Vocabulary' },
          { href: '/dashboard', label: 'Dashboard' },
        ]
      : []),
    ...(isAdmin ? [{ href: '/admin', label: '🛡️ অ্যাডমিন' }] : []),
  ];

  async function logout() {
    await supabase.auth.signOut();
    setOpen(false);
    router.push('/');
  }

  const linkClass = (href) =>
    `px-3 py-2 rounded-lg text-sm font-medium transition ${
      pathname === href
        ? 'bg-indigo-50 text-indigo-700'
        : 'text-slate-600 hover:bg-slate-100'
    }`;

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold text-indigo-700">
          <span className="text-2xl">📚</span> SmartVocab
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={linkClass(l.href)}>
              {l.label}
            </Link>
          ))}
          {!loading &&
            (user ? (
              <button
                onClick={logout}
                className="ml-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                লগআউট
              </button>
            ) : (
              <Link
                href="/login"
                className="ml-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                লগইন
              </Link>
            ))}
        </nav>

        <button
          onClick={() => setOpen(!open)}
          className="rounded-lg p-2 text-2xl text-slate-700 md:hidden"
          aria-label="মেনু"
        >
          {open ? '✕' : '☰'}
        </button>
      </div>

      {open && (
        <div className="space-y-1 border-t border-slate-200 bg-white px-4 py-3 md:hidden">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className={`block ${linkClass(l.href)}`}
            >
              {l.label}
            </Link>
          ))}
          {!loading &&
            (user ? (
              <button onClick={logout} className="block w-full px-3 py-2 text-left text-sm font-medium text-red-600">
                লগআউট
              </button>
            ) : (
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="block rounded-lg bg-indigo-600 px-3 py-2 text-center text-sm font-medium text-white"
              >
                লগইন / রেজিস্টার
              </Link>
            ))}
        </div>
      )}
    </header>
  );
}