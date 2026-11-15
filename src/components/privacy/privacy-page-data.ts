/**
 * Typed content data for the /privacy page.
 *
 * Rules:
 * - Mock policies for a hackathon demonstration.
 * - Written by an AI agent, not reviewed by a lawyer, not legal advice.
 * - Makes no claim of compliance (the words "compliant", "certified", "guarantee" do not appear).
 */

export interface PrivacyFactItem {
  label: string;
  detail: string;
}

export interface PrivacyPageSection {
  id: string;
  title: string;
  summary: string;
  facts: PrivacyFactItem[];
}

export interface PrivacyPageData {
  demonstrationNotice: string;
  hero: {
    badge: string;
    title: string;
    description: string;
  };
  sections: PrivacyPageSection[];
  footerNote: string;
}

export const PRIVACY_PAGE_DATA: PrivacyPageData = {
  demonstrationNotice:
    "Mock policies for a demonstration. Written by an AI agent, not reviewed by a lawyer, not legal advice.",
  hero: {
    badge: "Demonstration Data Protection",
    title: "Data Protection & Privacy Overview",
    description:
      "Cepheus supports post-treatment wellbeing follow-up for people recovering from depression. The application is designed to minimise personal data, keep video and sound on your device, and ensure clinic staff see only high-level flags rather than private answers.",
  },
  sections: [
    {
      id: "collection-and-storage",
      title: "What we collect and what we never store",
      summary:
        "We collect only the minimum numbers needed to detect when wellbeing drifts after treatment. Sensitive audio and video never leave your device.",
      facts: [
        {
          label: "What is stored",
          detail:
            "Twice-weekly 2-tap check-in scores (mood and interest, 0 to 4), fortnightly depression assessment totals (PHQ-9, 0 to 27), wearable sleep and step summaries, and derived facial movement trend numbers.",
        },
        {
          label: "Pseudonymous participant code",
          detail:
            "Participants are identified solely by a pseudonymous code (such as P-SIM-001). Real names, phone numbers, email addresses, and Finnish personal identity codes (henkilötunnus) are never stored in this database.",
        },
        {
          label: "No video or pictures",
          detail:
            "Camera checks are processed locally in your web browser. Video frames are analyzed in memory and immediately discarded. No photos or video streams are ever transmitted or saved.",
        },
        {
          label: "No voice recordings or transcripts",
          detail:
            "Spoken inputs are converted to simple numbers on your device. Audio recordings, sound files, and spoken transcripts are never sent to the server.",
        },
        {
          label: "Individual answers are not stored",
          detail:
            "While answering a questionnaire, item answers exist in temporary server memory only. Once submitted, individual answers are wiped and only the calculated total score is kept.",
        },
        {
          label: "Zero browser storage",
          detail:
            "Nothing is saved to browser storage, client caches, or local databases on your phone or computer. The browser keeps only a sealed session cookie.",
        },
      ],
    },
    {
      id: "who-sees-what",
      title: "Who sees what",
      summary:
        "Access is strictly role-scoped. Clinic staff see summary flags when wellbeing drops, never your raw sensor traces or individual question answers.",
      facts: [
        {
          label: "What you see",
          detail:
            "You can view your scheduled check-in rounds, your personal coping suggestions, and whether your sleep and daily activity remain close to your baseline.",
        },
        {
          label: "What clinic staff see",
          detail:
            "If your check-in answers drop below baseline for two consecutive rounds, or if two rounds go unanswered, clinic staff receive a high-level notification. The flag indicates only the broad life area (such as sleep or routine) and the onset date. Staff cannot see raw graphs or question responses.",
        },
        {
          label: "Immediate crisis path",
          detail:
            "If an answer indicates thoughts of self-harm, emergency support numbers (112 and crisis helplines) are shown directly on your screen without automated delay, and clinic staff receive an urgent notification to reach out.",
        },
        {
          label: "Immutable access logging",
          detail:
            "Every read, write, or inspection of participant data by clinic staff is recorded in an immutable audit log with staff identity, timestamp, and clinical purpose.",
        },
        {
          label: "EU data boundary",
          detail:
            "All primary data is stored within the European Union (Helsinki). Data is never sold, never used for advertising, and never shared with third-party tracking services.",
        },
      ],
    },
    {
      id: "rights-and-stopping",
      title: "Your rights and how to stop",
      summary:
        "Participation is voluntary. You remain in control of each measurement modality and can withdraw at any time without affecting your clinical care.",
      facts: [
        {
          label: "Consent per measuring method",
          detail:
            "You can enable or disable each optional sensor (such as the camera check or wearable sync) independently in your settings at any time.",
        },
        {
          label: "Stopping participation",
          detail:
            "You can stop taking part at any time. Pausing or leaving the program has no effect on your ongoing medical treatment or your relationship with your clinic.",
        },
        {
          label: "Access and erasure",
          detail:
            "You have the right to request a copy of your stored check-in totals or ask for your records to be deleted, subject to statutory healthcare retention rules.",
        },
        {
          label: "Right to lodge a complaint",
          detail:
            "You have the right to contact the Finnish supervisory authority: Office of the Data Protection Ombudsman (Tietosuojavaltuutetun toimisto), P.O. Box 800, 00531 Helsinki, email tietosuoja@om.fi, phone +358 29 566 6777.",
        },
      ],
    },
    {
      id: "simulated-rewards",
      title: "Rewards are simulated and why",
      summary:
        "The 1-euro rewards for completed check-in rounds are simulated to prevent tax reporting burdens and protect patient pseudonymity.",
      facts: [
        {
          label: "Simulated micro-rewards",
          detail:
            "The system displays a simulated credit of 1 euro per answered check-in round and 1 euro per completed small task, with a payout threshold at 10 euros. All balances and payouts are virtual.",
        },
        {
          label: "Finnish income tax rules",
          detail:
            "Under the Finnish Income Tax Act (Tuloverolaki 1535/1992 § 29), monetary payments for answering questionnaires constitute taxable earned income rather than tax-free gifts.",
        },
        {
          label: "Incomes Register reporting (Tulorekisteri)",
          detail:
            "Under Finnish law (Laki tulotietojärjestelmästä 53/2018), payers must report all non-wage compensation to the Incomes Register within 5 calendar days. There is no minimum euro exemption threshold.",
        },
        {
          label: "Protecting patient pseudonymity",
          detail:
            "Reporting 10-euro payouts to the Incomes Register would require collecting each patient's full legal name, Finnish personal identity code (henkilötunnus), and bank account number (IBAN). Collecting this financial identity would destroy the privacy boundary that keeps health check-ins pseudonymous.",
        },
        {
          label: "Clinical integrity and ethical care",
          detail:
            "Real monetary rewards could encourage rushed or dishonest responses to collect payouts, undermining clinical accuracy. Paying vulnerable patients in a care relationship also introduces ethical conflicts regarding financial inducement.",
        },
      ],
    },
  ],
  footerNote:
    "This summary reflects the design of the Cepheus hackathon demonstration build. A production healthcare deployment requires full formal review by a hospital Data Protection Officer and clinical governance board.",
};
