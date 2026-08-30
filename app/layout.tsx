import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { WebmcpStatusProvider } from "@/components/providers/WebmcpStatusProvider";
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
  title: "ToolGap",
  description: "Your website learns what agents need next.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <a href="#main" className="skip-link">
          Skip to main content
        </a>
        <WebmcpStatusProvider>{children}</WebmcpStatusProvider>
      </body>
    </html>
  );
}
