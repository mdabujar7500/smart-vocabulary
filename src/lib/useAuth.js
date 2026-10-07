'use client';

import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    // সেশন সার্ভারে যাচাই করা হয়; অ্যাকাউন্ট না থাকলে স্বয়ংক্রিয় লগআউট
    supabase.auth.getUser().then(({ data, error }) => {
      if (!active) return;
      if (error || !data?.user) {
        supabase.auth.signOut();
        setUser(null);
      } else {
        setUser(data.user);
      }
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return;
      setUser(session?.user ?? null);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { user, loading };
}