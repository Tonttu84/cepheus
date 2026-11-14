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
      <body className="flex min-h-screen flex-col text-ink-primary antialiased selection:bg-accent-sage/15 selection:text-ink-primary">
        <CrisisHelpBar />
        <SiteNav />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-7 sm:px-6 sm:py-10">
          {children}
        </main>
        <footer className="border-t border-border-hairline bg-surface-card/80 py-5 text-xs text-ink-secondary backdrop-blur-xs">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p>
              Wellbeing check-in prototype for post-TMS follow-up. Not a
              diagnostic or medical device; makes no treatment or
              relapse-prediction claims.
            </p>
            <p className="text-ink-muted">
              Camera &amp; microphone inputs stay on-device; only derived
              numbers are stored.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
