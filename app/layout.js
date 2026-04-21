import './globals.css';

export const metadata = {
  title: 'Jeremy — NEPQ Sales Coach',
  description: 'Real-time AI sales coaching powered by the NEPQ framework',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
