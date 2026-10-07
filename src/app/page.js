import Link from 'next/link';

const features = [
  { icon: '📄', title: 'যেকোনো ফাইল থেকে', text: 'PDF, Word, TXT বা ছবি আপলোড করুন, সিস্টেম নিজেই English text বের করবে।' },
  { icon: '🤖', title: 'AI বিশ্লেষণ', text: 'Gemini AI প্রতিটি শব্দের বাংলা অর্থ, definition, synonym ও antonym দেয়।' },
  { icon: '🎯', title: 'ব্যক্তিগত ফিল্টার', text: 'যা শিখেছেন তা মনে রাখে। পরের ডকুমেন্টে একই শব্দ আর দেখাবে না।' },
  { icon: '📊', title: 'Dashboard', text: 'মোট শব্দ, শেখা শব্দ, বাকি শব্দ ও দৈনিক ব্যবহার এক নজরে।' },
  { icon: '🔊', title: 'উচ্চারণ', text: 'এক ক্লিকে যেকোনো শব্দের সঠিক উচ্চারণ শুনুন।' },
  { icon: '🔒', title: 'নিরাপদ', text: 'আপনার ডেটা শুধু আপনিই দেখতে পারবেন, কঠোর ডেটাবেস সুরক্ষা সহ।' },
];

const steps = [
  { n: '১', title: 'আপলোড', text: 'ডকুমেন্ট দিন বা text পেস্ট করুন' },
  { n: '২', title: 'AI বিশ্লেষণ', text: 'শেখার উপযোগী শব্দ বের হবে' },
  { n: '৩', title: 'শিখুন', text: '"আমি জানি" বা "পরে শিখব" মার্ক করুন' },
  { n: '৪', title: 'এগিয়ে যান', text: 'পরের বার শুধু নতুন শব্দ পাবেন' },
];

const plans = [
  {
    name: 'Guest',
    price: 'বিনামূল্যে',
    points: ['অ্যাকাউন্ট ছাড়াই ব্যবহার', 'text পেস্ট বা .txt ফাইল', 'শেখার ইতিহাস সংরক্ষণ হবে না'],
    cta: 'এখনই চেষ্টা করুন',
    href: '/upload',
    style: 'border-slate-200 bg-white',
  },
  {
    name: 'Free',
    price: 'বিনামূল্যে',
    points: ['শেখা শব্দ সংরক্ষণ', 'PDF, Word, ছবি আপলোড', 'আগে শেখা শব্দ স্বয়ংক্রিয় বাদ', 'দৈনিক সীমিত ব্যবহার'],
    cta: 'অ্যাকাউন্ট খুলুন',
    href: '/login',
    style: 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-500',
    badge: 'জনপ্রিয়',
  },
  {
    name: 'Premium',
    price: 'শীঘ্রই আসছে',
    points: ['আনলিমিটেড আপলোড', 'বড় ফাইল', 'অ্যাডভান্সড লার্নিং ফিচার'],
    cta: 'শীঘ্রই',
    href: '#',
    style: 'border-slate-200 bg-white opacity-90',
  },
];

export default function Home() {
  return (
    <main>
      {/* Hero */}
      <section className="bg-gradient-to-br from-indigo-700 via-indigo-600 to-blue-500 text-white">
        <div className="mx-auto max-w-6xl px-4 py-20 text-center md:py-28">
          <p className="mb-4 inline-block rounded-full bg-white/15 px-4 py-1 text-sm">
            AI-চালিত English Vocabulary শেখার প্ল্যাটফর্ম
          </p>
          <h1 className="text-4xl font-bold leading-tight md:text-6xl">
            যা পড়ছেন, তা থেকেই
            <br />
            শব্দভান্ডার বাড়ান
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-indigo-100">
            যেকোনো English ডকুমেন্ট আপলোড করুন। AI আপনার জন্য শব্দ বেছে দেবে, বাংলা অর্থসহ। আর যা শিখেছেন, তা আর দ্বিতীয়বার দেখাবে না।
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/upload" className="rounded-xl bg-white px-6 py-3 font-semibold text-indigo-700 shadow hover:bg-indigo-50">
              শুরু করুন →
            </Link>
            <Link href="/login" className="rounded-xl border border-white/60 px-6 py-3 font-semibold text-white hover:bg-white/10">
              লগইন / রেজিস্টার
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-center text-3xl font-bold text-slate-900">কী কী পাবেন</h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md">
              <div className="text-3xl">{f.icon}</div>
              <h3 className="mt-3 text-lg font-semibold text-slate-900">{f.title}</h3>
              <p className="mt-1 text-sm text-slate-600">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-3xl font-bold text-slate-900">কীভাবে কাজ করে</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-4">
            {steps.map((s) => (
              <div key={s.n} className="text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100 text-2xl font-bold text-indigo-700">
                  {s.n}
                </div>
                <h3 className="mt-3 font-semibold text-slate-900">{s.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Plans */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-center text-3xl font-bold text-slate-900">প্ল্যান</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {plans.map((p) => (
            <div key={p.name} className={`relative rounded-2xl border p-6 ${p.style}`}>
              {p.badge && (
                <span className="absolute -top-3 right-4 rounded-full bg-indigo-600 px-3 py-1 text-xs font-medium text-white">
                  {p.badge}
                </span>
              )}
              <h3 className="text-xl font-bold text-slate-900">{p.name}</h3>
              <p className="mt-1 text-slate-500">{p.price}</p>
              <ul className="mt-4 space-y-2 text-sm text-slate-700">
                {p.points.map((pt) => (
                  <li key={pt}>✓ {pt}</li>
                ))}
              </ul>
              <Link
                href={p.href}
                className="mt-6 block rounded-lg bg-indigo-600 py-2 text-center text-sm font-medium text-white hover:bg-indigo-700"
              >
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}