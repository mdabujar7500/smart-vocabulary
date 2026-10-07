import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import mammoth from 'mammoth';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MIME = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function getModelList() {
  const primary = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
  return [...new Set([primary, 'gemini-flash-latest', 'gemini-3.1-flash-lite'])];
}

async function readWithGemini(ai, mimeType, base64) {
  let lastError;
  for (const model of getModelList()) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await ai.models.generateContent({
          model,
          contents: [
            {
              role: 'user',
              parts: [
                { inlineData: { mimeType, data: base64 } },
                {
                  text:
                    'Extract all the English text from this document exactly as written. Return only the plain text with no commentary. If there is no English text, return an empty string.',
                },
              ],
            },
          ],
        });
        return (res.text || '').trim();
      } catch (err) {
        lastError = err;
        const busy = err?.status === 503 || err?.status === 429;
        console.warn(`extract-text failed (model=${model}, attempt=${attempt}):`, err?.status || err?.message);
        if (!busy) throw err;
        await sleep(1500 * attempt);
      }
    }
  }
  throw lastError;
}

export async function POST(request) {
  try {
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } }
    );

    // শুধু লগইন করা user
    const token = (request.headers.get('authorization') || '').replace('Bearer ', '');
    const { data } = token ? await admin.auth.getUser(token) : { data: null };
    const user = data?.user;
    if (!user) {
      return NextResponse.json({ error: 'ফাইল আপলোড করতে লগইন করতে হবে।' }, { status: 401 });
    }

    const form = await request.formData();
    const file = form.get('file');
    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'কোনো ফাইল পাওয়া যায়নি।' }, { status: 400 });
    }

    const ext = file.name.split('.').pop().toLowerCase();
    if (!['txt', 'docx', ...Object.keys(MIME)].includes(ext)) {
      return NextResponse.json(
        { error: 'এই ফাইল সাপোর্ট করা হয় না। (পুরনো .doc হলে .docx করে নিন)' },
        { status: 400 }
      );
    }

    // প্ল্যান অনুযায়ী ফাইলের সাইজ সীমা
    const { data: profile } = await admin.from('profiles').select('plan').eq('id', user.id).maybeSingle();
    const plan = profile?.plan || 'free';
    const { data: lim } = await admin.from('plan_limits').select('max_file_mb').eq('plan', plan).maybeSingle();
    const maxMb = lim?.max_file_mb ?? 5;
    if (file.size > maxMb * 1024 * 1024) {
      return NextResponse.json({ error: `ফাইল সর্বোচ্চ ${maxMb} MB হতে পারবে।` }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let text = '';

    if (ext === 'docx') {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else if (ext === 'txt') {
      text = buffer.toString('utf-8');
    } else {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      text = await readWithGemini(ai, MIME[ext], buffer.toString('base64'));
    }

    text = (text || '').trim();
    if (!text) {
      return NextResponse.json({ error: 'ফাইলে কোনো English text পাওয়া যায়নি।' }, { status: 422 });
    }

    return NextResponse.json({ text: text.slice(0, 100000) });
  } catch (err) {
    console.error('extract-text error:', err);
    return NextResponse.json({ error: 'ফাইল পড়তে সমস্যা হয়েছে। একটু পরে আবার চেষ্টা করুন।' }, { status: 500 });
  }
}