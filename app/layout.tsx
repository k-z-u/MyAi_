import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MyAi — Today execution system",
  description: "A today-only task tracker that treats you as the executing AI agent.",
  openGraph: {
    title: "MyAi — Process today.",
    description: "Treat yourself as the executing AI agent for today’s work.",
    images: [{ url: "/og.png", width: 1536, height: 1024, alt: "MyAi — Process today." }],
  },
  twitter: {
    card: "summary_large_image",
    title: "MyAi — Process today.",
    description: "Treat yourself as the executing AI agent for today’s work.",
    images: ["/og.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "dark light",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
