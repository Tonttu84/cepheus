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
      <body className=" flex min-h-screen flex-col bg-stone-50 text-stone-900 antialiased">
        <CrisisHelpBar />
        <SiteNav />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
          {children}
        </main>
        <footer className="border-t border-stone-200 bg-white py-4 text-xs text-stone-600">
          <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p>
              Wellbeing check-in prototype for post-TMS follow-up. The product
              supports follow-up by the clinic and makes no diagnosis and no
              treatment claim.
            </p>
            <p className="text-stone-500">
              Camera &amp; microphone inputs stay on-device; only derived
              numbers are stored.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
