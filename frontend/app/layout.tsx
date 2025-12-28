import type { Metadata } from 'next';
import './globals.css';
import LocomotiveScrollProvider from '@/components/locomotive-scroll-provider';

export const metadata: Metadata = {
  title: 'Briefly',
  description: 'Manage sessions, upload documents, and get AI-powered insights',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
      </head>
      <body>
        <LocomotiveScrollProvider>
          {children}
        </LocomotiveScrollProvider>
      </body>
    </html>
  );
}
