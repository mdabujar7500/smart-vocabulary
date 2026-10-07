import { supabase } from './supabase';

// শব্দের id দিয়ে status বদলানো (My Vocabulary-তে)
export async function setStatusById(wordId, status) {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('লগইন করুন।');
  const { error } = await supabase.from('user_words').upsert(
    {
      user_id: data.user.id,
      word_id: wordId,
      status,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,word_id' }
  );
  if (error) throw error;
}

// শব্দের লেখা দিয়ে status বদলানো (Upload পেজে)
export async function setStatusByWord(word, status) {
  const { data: w, error } = await supabase
    .from('words')
    .select('id')
    .eq('word', word)
    .maybeSingle();
  if (error || !w) throw new Error('শব্দটি খুঁজে পাওয়া যায়নি।');
  await setStatusById(w.id, status);
}