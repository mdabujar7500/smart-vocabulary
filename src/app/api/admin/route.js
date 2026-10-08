import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const PAGE_SIZE = 20;
const MAX_FILE_MB = 4; // Vercel-এ এর বেশি সাইজ সার্ভারে পাঠানো যায় না

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

const fail = (error, status = 400) => NextResponse.json({ error }, { status });

// প্রতিটি অনুরোধে সার্ভার নিজে যাচাই করে অনুরোধকারী সত্যিই অ্যাডমিন কিনা
async function requireAdmin(request) {
  const admin = getAdmin();
  const token = (request.headers.get('authorization') || '').replace('Bearer ', '');
  if (!token) return { response: fail('লগইন করুন।', 401) };

  const { data } = await admin.auth.getUser(token);
  const user = data?.user;
  if (!user) return { response: fail('লগইন সেশন শেষ।', 401) };

  const { data: p } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (p?.role !== 'admin') return { response: fail('আপনার এই পেজে প্রবেশের অনুমতি নেই।', 403) };

  return { admin, user };
}

export async function POST(request) {
  try {
    const auth = await requireAdmin(request);
    if (auth.response) return auth.response;
    const { admin, user } = auth;

    const body = await request.json();
    const action = body.action;
    const today = new Date().toISOString().slice(0, 10);

    const count = async (table, filter) => {
      let q = admin.from(table).select('*', { count: 'exact', head: true });
      if (filter) q = filter(q);
      const { count: c, error } = await q;
      if (error) throw error;
      return c || 0;
    };

    const validUserId = typeof body.userId === 'string' && body.userId.length >= 10;

    switch (action) {
      // ---------- ওভারভিউ ----------
      case 'stats': {
        const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
        const [totalUsers, premiumUsers, blockedUsers, newUsers, documents, words, learned] =
          await Promise.all([
            count('profiles'),
            count('profiles', (q) => q.eq('plan', 'premium')),
            count('profiles', (q) => q.eq('is_blocked', true)),
            count('profiles', (q) => q.gte('created_at', weekAgo)),
            count('documents'),
            count('words'),
            count('user_words', (q) => q.eq('status', 'learned')),
          ]);

        const { data: u } = await admin.from('daily_usage').select('upload_count').eq('usage_date', today).limit(10000);
        const { data: g } = await admin.from('guest_usage').select('upload_count').eq('usage_date', today).limit(10000);
        const sum = (rows) => (rows || []).reduce((a, r) => a + (r.upload_count || 0), 0);

        return NextResponse.json({
          totalUsers,
          premiumUsers,
          freeUsers: totalUsers - premiumUsers,
          blockedUsers,
          newUsers,
          documents,
          words,
          learned,
          usageToday: sum(u),
          guestUsageToday: sum(g),
        });
      }

      // ---------- User-এর তালিকা ----------
      case 'users': {
        const page = Math.max(parseInt(body.page) || 0, 0);
        const search = String(body.search || '').trim().replace(/[%_,()]/g, '');
        let q = admin
          .from('profiles')
          .select('id, email, plan, role, is_blocked, created_at', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
        if (search) q = q.ilike('email', `%${search}%`);
        const { data, count: total, error } = await q;
        if (error) throw error;
        return NextResponse.json({ users: data || [], total: total || 0, pageSize: PAGE_SIZE });
      }

      // ---------- প্ল্যান বদল ----------
      case 'set_plan': {
        if (!validUserId) return fail('অবৈধ user।');
        if (!['free', 'premium'].includes(body.plan)) return fail('অবৈধ প্ল্যান।');
        const { error } = await admin.from('profiles').update({ plan: body.plan }).eq('id', body.userId);
        if (error) throw error;
        return NextResponse.json({ ok: true });
      }

      // ---------- ব্লক / আনব্লক ----------
      case 'set_blocked': {
        if (!validUserId) return fail('অবৈধ user।');
        if (body.userId === user.id) return fail('নিজেকে ব্লক করা যাবে না।');

        const { data: target } = await admin.from('profiles').select('role').eq('id', body.userId).maybeSingle();
        if (!target) return fail('user পাওয়া যায়নি।', 404);
        if (target.role === 'admin') return fail('অ্যাডমিনকে ব্লক করা যাবে না।');

        const blocked = !!body.blocked;
        const { error } = await admin.from('profiles').update({ is_blocked: blocked }).eq('id', body.userId);
        if (error) throw error;

        // লগইনও বন্ধ করা হয় (ব্যর্থ হলেও is_blocked দিয়ে ব্যবহার বন্ধ থাকবে)
        const { error: banErr } = await admin.auth.admin.updateUserById(body.userId, {
          ban_duration: blocked ? '876000h' : 'none',
        });
        if (banErr) console.warn('ban update failed:', banErr.message);

        return NextResponse.json({ ok: true });
      }

      // ---------- প্ল্যানের লিমিট ----------
      case 'get_limits': {
        const { data, error } = await admin.from('plan_limits').select('*').order('plan');
        if (error) throw error;
        return NextResponse.json({ limits: data || [], maxFileMb: MAX_FILE_MB });
      }

      case 'set_limits': {
        if (!['free', 'premium'].includes(body.plan)) return fail('অবৈধ প্ল্যান।');
        const daily = Number(body.daily_uploads);
        const mb = Number(body.max_file_mb);
        if (!Number.isInteger(daily) || daily < 1 || daily > 1000000) {
          return fail('দৈনিক আপলোড সীমা ১ থেকে ১০,০০,০০০-এর মধ্যে পূর্ণ সংখ্যা হতে হবে।');
        }
        if (!Number.isInteger(mb) || mb < 1 || mb > MAX_FILE_MB) {
          return fail(`ফাইল সাইজ ১ থেকে ${MAX_FILE_MB} MB-এর মধ্যে হতে হবে।`);
        }
        const { error } = await admin
          .from('plan_limits')
          .update({ daily_uploads: daily, max_file_mb: mb })
          .eq('plan', body.plan);
        if (error) throw error;
        return NextResponse.json({ ok: true });
      }

      // ---------- User-এর বিস্তারিত ----------
      case 'user_detail': {
        if (!validUserId) return fail('অবৈধ user।');
        const id = body.userId;
        const [total, learned, later, docCount] = await Promise.all([
          count('user_words', (q) => q.eq('user_id', id)),
          count('user_words', (q) => q.eq('user_id', id).eq('status', 'learned')),
          count('user_words', (q) => q.eq('user_id', id).eq('status', 'learn_later')),
          count('documents', (q) => q.eq('user_id', id)),
        ]);
        const { data: docs } = await admin
          .from('documents')
          .select('file_name, file_type, created_at')
          .eq('user_id', id)
          .order('created_at', { ascending: false })
          .limit(5);
        const { data: usage } = await admin
          .from('daily_usage')
          .select('upload_count')
          .eq('user_id', id)
          .eq('usage_date', today)
          .maybeSingle();

        return NextResponse.json({
          total,
          learned,
          later,
          fresh: total - learned - later,
          docCount,
          documents: docs || [],
          todayUsed: usage?.upload_count || 0,
        });
      }

      // ---------- User-এর ডেটা মোছা (অ্যাকাউন্ট থাকবে) ----------
      case 'delete_user_data': {
        if (!validUserId) return fail('অবৈধ user।');
        if (body.userId === user.id) return fail('নিজের ডেটা এখান থেকে মোছা যাবে না।');
        const id = body.userId;

        // documents মুছলে document_words নিজে থেকেই মুছে যায়
        for (const table of ['user_words', 'documents', 'daily_usage']) {
          const { error } = await admin.from(table).delete().eq('user_id', id);
          if (error) throw error;
        }
        return NextResponse.json({ ok: true });
      }

      default:
        return fail('অজানা কাজ।');
    }
  } catch (err) {
    console.error('admin error:', err);
    return fail('সার্ভারে সমস্যা হয়েছে। আবার চেষ্টা করুন।', 500);
  }
}