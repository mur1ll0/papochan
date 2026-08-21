import type { Metadata, Viewport } from 'next';
import { I18nProvider } from '@/i18n/context';
import './globals.css';

export const metadata: Metadata = {
  title: 'PapoChan — Comunicação Multi-Dispositivo e Telas em Tempo Real',
  description:
    'Puxe um papo, transmita sua tela em 60 FPS com áudio do sistema e use múltiplos dispositivos simultaneamente com privacidade total e sem senhas.',
  keywords: [
    'PapoChan',
    'Videochamada',
    'Compartilhamento de Tela',
    '60 FPS',
    'Multi-Dispositivo',
    'P2P',
    'WebRTC',
    'Zero-Knowledge',
    'E2EE',
  ],
  authors: [{ name: 'PapoChan Team' }],
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#080D1A',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="dark">
      <body className="bg-slate-950 text-slate-100 min-h-screen antialiased selection:bg-papo-coral selection:text-white font-sans">
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
