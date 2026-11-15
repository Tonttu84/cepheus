import type { Metadata } from "next";
import React from "react";
import { PrivacyContent } from "@/components/privacy/privacy-content";

export const metadata: Metadata = {
  title: "Data Protection & Privacy · Cepheus",
  description:
    "Data protection documentation and mock privacy policies for the Cepheus post-TMS wellbeing monitoring demonstration.",
};

export default function PrivacyPage() {
  return <PrivacyContent />;
}
