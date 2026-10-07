'use client';

const STATUS_LABEL = {
  new: 'নতুন',
  learned: 'শেখা',
  learn_later: 'পরে শিখব',
};
const STATUS_STYLE = {
  new: 'bg-slate-100 text-slate-600',
  learned: 'bg-green-100 text-green-700',
  learn_later: 'bg-amber-100 text-amber-700',
};

export default function WordCard({ w, status = 'new', onChange }) {
  function speak() {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(w.word);
    u.lang = 'en-US';
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }

  const btn = (target, label, activeStyle) => (
    <button
      onClick={() => onChange(target)}
      className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
        status === target
          ? activeStyle
          : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-slate-900">{w.word}</span>
            <button onClick={speak} title="উচ্চারণ শুনুন" className="text-lg hover:scale-110">
              🔊
            </button>
          </div>
          {w.part_of_speech && (
            <span className="text-sm italic text-slate-500">{w.part_of_speech}</span>
          )}
        </div>
        {onChange && (
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[status]}`}>
            {STATUS_LABEL[status]}
          </span>
        )}
      </div>

      <p className="mt-2 text-lg font-semibold text-indigo-700">{w.bangla_meaning}</p>
      <p className="mt-1 text-sm text-slate-700">{w.definition}</p>

      <div className="mt-3 space-y-1 text-sm text-slate-600">
        <p>
          <span className="font-semibold text-emerald-700">Synonyms:</span>{' '}
          {(w.synonyms || []).join(', ') || '-'}
        </p>
        <p>
          <span className="font-semibold text-rose-700">Antonyms:</span>{' '}
          {(w.antonyms || []).join(', ') || '-'}
        </p>
      </div>

      {onChange && (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          {btn('learned', '✓ আমি জানি', 'border-green-600 bg-green-600 text-white')}
          {btn('learn_later', '🔖 পরে শিখব', 'border-amber-500 bg-amber-500 text-white')}
          {status !== 'new' && (
            <button
              onClick={() => onChange('new')}
              className="rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:text-slate-800"
            >
              ↩ রিসেট
            </button>
          )}
        </div>
      )}
    </div>
  );
}