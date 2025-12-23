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
      <body>
        <LocomotiveScrollProvider>
          {children}
        </LocomotiveScrollProvider>
      </body>
    </html>
  );
}
