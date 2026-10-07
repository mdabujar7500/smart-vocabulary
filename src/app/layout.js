import './globals.css';
import { Hind_Siliguri } from 'next/font/google';
import Navbar from '@/components/Navbar';

const font = Hind_Siliguri({
  subsets: ['bengali', 'latin'],
  weight: ['400', '500', '600', '700'],
});

export const metadata = {
  title: 'Smart Vocabulary Learning System',
  description: 'যেকোনো ডকুমেন্ট থেকে English vocabulary শিখুন, AI-র সাহায্যে।',
};

export default function RootLayout({ children }) {
  return (
    <html lang="bn">
      <body className={`${font.className} min-h-screen flex flex-col`}>
        <Navbar />
        <div className="flex-1">{children}</div>
        <footer className="border-t border-slate-200 bg-white py-6 text-center text-sm text-slate-500">
          © {new Date().getFullYear()} Smart Vocabulary Learning System
        </footer>
      </body>
    </html>
  );
}