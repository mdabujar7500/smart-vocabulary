import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const maxDuration = 60;

const BATCH_SIZE = 40;      // প্রতিবার Gemini-কে কতটি শব্দ দেওয়া হবে
const CONCURRENCY = 3;      // একসাথে কয়টি ভাগ চলবে
const MAX_NEW_WORDS_USER = 1500;
const MAX_NEW_WORDS_GUEST = 150;

// যেসব শব্দ বাদ যাবে: article, pronoun, basic preposition, be-forms
const STOP = new Set(
  `a an the i me my mine myself you your yours yourself he him his himself she her hers herself
   it its itself we us our ours ourselves they them their theirs themselves
   is am are was were be been being to in on at of`.split(/\s+/)
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// text থেকে অনন্য শব্দের তালিকা (text-এ আসার ক্রমে)
function tokenize(text) {
  const matches = text.match(/[A-Za-z]+(?:['’][A-Za-z]+)*/g) || [];
  const out = [];
  const seen = new Set();
  for (const m of matches) {
    let w = m.toLowerCase().replace(/’/g, "'");
    if (/n't$/.test(w)) continue; // don't, isn't ইত্যাদি
    w = w.split("'")[0];          // john's -> john
    if (w.length < 2 || STOP.has(w) || seen.has(w)) continue;
    seen.add(w);
    out.push(w);
  }
  return out;
}

async function fetchKnownWords(admin, userId) {
  const known = new Set();
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await admin
      .from('user_words')
      .select('words(word)')
      .eq('user_id', userId)
      .order('word_id')
      .range(from, from + pageSize - 1);
    if (error) throw error;
    (data || []).forEach((r) => r.words?.word && known.add(r.words.word));
    if (!data || data.length < pageSize) break;
  }
  return known;
}

function getModelList() {
  const primary = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
  return [...new Set([primary, 'gemini-flash-latest', 'gemini-3.1-flash-lite'])];
}

function isRetryable(err) {
  const msg = String(err?.message || '');
  return (
    err?.status === 503 ||
    err?.status === 429 ||
    msg.includes('UNAVAILABLE') ||
    msg.includes('high demand')
  );
}

async function askGemini(ai, prompt) {
  let lastError;
  for (const model of getModelList()) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: { responseMimeType: 'application/json' },
        });
        const raw = (response.text || '').replace(/```json|```/g, '').trim();
        return JSON.parse(raw);
      } catch (err) {
        lastError = err;
        console.warn(`Gemini failed (model=${model}, attempt=${attempt}):`, err?.status || err?.message);
        if (!isRetryable(err)) throw err;
        await sleep(1500 * attempt);
      }
    }
  }
  throw lastError;
}

function buildPrompt(words) {
  return `You are an English vocabulary teacher for Bangla-speaking learners.
Below is a list of English words taken from a student's text.
For each word produce vocabulary data.
Rules:
- Convert each word to its base/dictionary form, lowercase (e.g. "running" -> "run").
- If a word is misspelled, use the corrected word (e.g. "mafin" -> "muffin").
- Merge duplicates. Skip personal names, place names and meaningless gibberish.
- Include simple everyday words too (like "go", "home", "class").
Return ONLY a JSON array. Each item must have exactly these fields:
"word", "bangla_meaning" (in Bangla script), "definition" (simple English),
"part_of_speech", "synonyms" (array of up to 3), "antonyms" (array of up to 3, may be empty).

WORDS: ${words.join(', ')}`;
}

// অনেকগুলো ভাগ কয়েকটি করে একসাথে চালানো
async function runInBatches(batches, worker) {
  const results = new Array(batches.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(CONCURRENCY, batches.length) }, async () => {
    while (next < batches.length) {
      const mine = next++;
      results[mine] = await worker(batches[mine]);
    }
  });
  await Promise.all(runners);
  return results.flat();
}

const asArray = (v) => (Array.isArray(v) ? v.map(String) : []);

export async function POST(request) {
  try {
    const { text, fileName, fileType } = await request.json();

    if (!text || typeof text !== 'string' || text.trim().length < 2) {
      return NextResponse.json({ error: 'কিছু English text দিন।' }, { status: 400 });
    }

    const admin = getAdmin();

    // ---------- ১. ব্যবহারকারী চেনা ----------
    let user = null;
    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (token) {
      const { data } = await admin.auth.getUser(token);
      user = data?.user || null;
    }
        if (token && !user) {
      return NextResponse.json({ error: 'আপনার লগইন সেশন শেষ। আবার লগইন করুন।' }, { status: 401 });
    }

    // ---------- ২. প্ল্যান ও দৈনিক লিমিট ----------
    const today = new Date().toISOString().slice(0, 10);
    let plan = 'guest';
    let limit = null;
    let usedToday = 0;

    if (user) {
      const { data: profile } = await admin
        .from('profiles').select('plan').eq('id', user.id).maybeSingle();
      plan = profile?.plan || 'free';

      const { data: lim } = await admin
        .from('plan_limits').select('daily_uploads').eq('plan', plan).maybeSingle();
      limit = lim?.daily_uploads ?? 10;

      const { data: usage } = await admin
        .from('daily_usage').select('upload_count')
        .eq('user_id', user.id).eq('usage_date', today).maybeSingle();
      usedToday = usage?.upload_count || 0;

      if (plan !== 'premium' && usedToday >= limit) {
        return NextResponse.json(
          { error: `আজকের লিমিট (${limit} বার) শেষ। আগামীকাল আবার চেষ্টা করুন অথবা Premium নিন।` },
          { status: 429 }
        );
      }
    }

    // ---------- ৩. শব্দ আলাদা করা + আগে পাওয়া শব্দ বাদ ----------
    const clipped = text.slice(0, user ? 100000 : 3000);
    const tokens = tokenize(clipped);

    const known = user ? await fetchKnownWords(admin, user.id) : new Set();
    let candidates = tokens.filter((w) => !known.has(w));
    let skipped = tokens.length - candidates.length;

    const maxNew = user ? MAX_NEW_WORDS_USER : MAX_NEW_WORDS_GUEST;
    const truncated = candidates.length > maxNew;
    if (truncated) candidates = candidates.slice(0, maxNew);

    // ---------- ৪. ডিকশনারিতে আগে থেকে থাকা শব্দ ----------
    const dictHits = new Map();
    for (const part of chunk(candidates, 200)) {
      const { data } = await admin.from('words').select('*').in('word', part);
      (data || []).forEach((r) => dictHits.set(r.word, r));
    }
    const misses = candidates.filter((w) => !dictHits.has(w));

    // ---------- ৫. বাকি শব্দ Gemini-তে (৪০টি করে ভাগে) ----------
    let geminiWords = [];
    if (misses.length) {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const raw = await runInBatches(chunk(misses, BATCH_SIZE), async (batch) => {
        const result = await askGemini(ai, buildPrompt(batch));
        return Array.isArray(result) ? result : [];
      });
      geminiWords = raw;
    }

    // ---------- ৬. সব একত্র ও পরিষ্কার ----------
    const seen = new Set();
    const fresh = [];
    const toInsert = []; // শুধু যেগুলো ডিকশনারিতে নতুন

    for (const r of dictHits.values()) {
      if (seen.has(r.word)) continue;
      seen.add(r.word);
      fresh.push({
        word: r.word,
        bangla_meaning: r.bangla_meaning || '',
        definition: r.definition || '',
        part_of_speech: r.part_of_speech || '',
        synonyms: r.synonyms || [],
        antonyms: r.antonyms || [],
      });
    }

    for (const w of geminiWords) {
      const word = String(w?.word || '').trim().toLowerCase();
      if (!word || seen.has(word)) continue;
      seen.add(word);
      if (known.has(word)) { skipped++; continue; }
      const item = {
        word,
        bangla_meaning: w.bangla_meaning || '',
        definition: w.definition || '',
        part_of_speech: w.part_of_speech || '',
        synonyms: asArray(w.synonyms),
        antonyms: asArray(w.antonyms),
      };
      fresh.push(item);
      toInsert.push(item);
    }

    // ---------- ৭. ডেটাবেসে সংরক্ষণ (শুধু লগইন করা user) ----------
    if (user) {
      for (const part of chunk(toInsert, 200)) {
        await admin.from('words').upsert(part, { onConflict: 'word', ignoreDuplicates: true });
      }

      const ids = [];
      for (const part of chunk(fresh.map((w) => w.word), 200)) {
        const { data } = await admin.from('words').select('id').in('word', part);
        (data || []).forEach((r) => ids.push(r.id));
      }

      for (const part of chunk(ids, 500)) {
        await admin.from('user_words').upsert(
          part.map((id) => ({ user_id: user.id, word_id: id, status: 'new' })),
          { onConflict: 'user_id,word_id', ignoreDuplicates: true }
        );
      }
      // ডকুমেন্ট ও তার শব্দের ইতিহাস সংরক্ষণ
      const { data: doc } = await admin
        .from('documents')
        .insert({
          user_id: user.id,
          file_name: fileName || 'Pasted text',
          file_type: fileType || 'text',
          extracted_text: clipped.slice(0, 50000),
        })
        .select('id')
        .single();

      if (doc && ids.length) {
        for (const part of chunk(ids, 500)) {
          await admin.from('document_words').upsert(
            part.map((id) => ({ document_id: doc.id, word_id: id })),
            { onConflict: 'document_id,word_id', ignoreDuplicates: true }
          );
        }
      }
      await admin.from('daily_usage').upsert(
        { user_id: user.id, usage_date: today, upload_count: usedToday + 1 },
        { onConflict: 'user_id,usage_date' }
      );
    }

    return NextResponse.json({
      words: fresh,
      skipped,
      truncated,
      plan,
      remaining: plan === 'premium' || !user ? null : Math.max(limit - usedToday - 1, 0),
    });
  } catch (err) {
    console.error('extract-words error:', err);
    const busy = isRetryable(err);
    return NextResponse.json(
      {
        error: busy
          ? 'AI সার্ভারে এখন অনেক চাপ। ১-২ মিনিট পর আবার চেষ্টা করুন।'
          : 'Vocabulary বের করতে সমস্যা হয়েছে। একটু পরে আবার চেষ্টা করুন।',
      },
      { status: busy ? 503 : 500 }
    );
  }
}