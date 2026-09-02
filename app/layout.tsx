import type { Metadata } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import { TelemetryDegradedBanner } from "@/components/dashboard/TelemetryDegradedBanner";
import { WebmcpStatusProvider } from "@/components/providers/WebmcpStatusProvider";
import { DbBootstrap } from "@/components/providers/DbBootstrap";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "ToolGap",
  description: "Your website learns what agents need next.",
  applicationName: "ToolGap",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <a href="#main" className="skip-link">
          Skip to main content
        </a>
        <WebmcpStatusProvider>
          <DbBootstrap>
            <TelemetryDegradedBanner />
            {children}
          </DbBootstrap>
        </WebmcpStatusProvider>
      </body>
    </html>
  );
}
