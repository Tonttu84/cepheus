import type { Metadata } from "next";
import "./globals.css";
import { CrisisHelpBar } from "@/components/crisis-help-bar";
import { SiteNav } from "@/components/site-nav";

export const metadata: Metadata = {
  title: "Cepheus — Beyond the Clinic",
  description:
    "Post-TMS home wellbeing check-in companion supporting patient self-care and clinic follow-up.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col text-[#1a2421] antialiased selection:bg-[#255748]/15 selection:text-[#1a2421]">
        <CrisisHelpBar />
        <SiteNav />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-7 sm:px-6 sm:py-10">
          {children}
        </main>
        <footer className="border-t border-[#e4ddd2] bg-white/80 py-5 text-xs text-[#515d58] backdrop-blur-xs">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p>
              Wellbeing check-in prototype for post-TMS follow-up. Not a
              diagnostic or medical device; makes no treatment or
              relapse-prediction claims.
            </p>
            <p className="text-[#697570]">
              Camera &amp; microphone inputs stay on-device; only derived
              numbers are stored.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
