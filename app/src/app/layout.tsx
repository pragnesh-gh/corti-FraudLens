import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/app-shell";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "FraudLens — Medical Coding Fraud Detection",
  description: "AI-driven investigation of medical coding fraud: upcoding, unbundling, phantom billing, diagnosis inflation, and cloning.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${jakarta.variable} ${inter.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <head>
        {/* No-FOUC theme bootstrap: apply the saved theme before paint so the
            app never flashes dark-then-light (or vice versa). Runs synchronously
            in <head>, before React hydrates. Default is dark. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('fraudlens-theme')||'dark';document.documentElement.dataset.theme=t;}catch(e){}})();",
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
