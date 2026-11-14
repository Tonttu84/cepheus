export interface Phq9ItemText {
  id: string;
  text: string;
}

export interface Phq9OptionText {
  score: number;
  text: string;
}

export interface Phq9ClosingQuestionText {
  question: string;
  text: string;
  options: string[];
  scored: false;
  partOfTotal: false;
}

export interface Phq9SourceText {
  attribution: string;
  url: string;
  date: string;
}

export interface Phq9Wording {
  locale: string;
  openingQuestion: string;
  items: Phq9ItemText[];
  options: Phq9OptionText[];
  closingQuestion: Phq9ClosingQuestionText;
  source: Phq9SourceText;
}

export const PHQ9_TEXT_EN: Phq9Wording = {
  locale: 'en',
  openingQuestion:
    'Over the last 2 weeks, how often have you been bothered by any of the following problems?',
  items: [
    {
      id: '1',
      text: 'Little interest or pleasure in doing things',
    },
    {
      id: '2',
      text: 'Feeling down, depressed, or hopeless',
    },
    {
      id: '3',
      text: 'Trouble falling or staying asleep, or sleeping too much',
    },
    {
      id: '4',
      text: 'Feeling tired or having little energy',
    },
    {
      id: '5',
      text: 'Poor appetite or overeating',
    },
    {
      id: '6',
      text: 'Feeling bad about yourself \u2014 or that you are a failure or have let yourself or your family down',
    },
    {
      id: '7',
      text: 'Trouble concentrating on things, such as reading the newspaper or watching television',
    },
    {
      id: '8',
      text: 'Moving or speaking so slowly that other people could have noticed? Or the opposite \u2014 being so fidgety or restless that you have been moving around a lot more than usual',
    },
    {
      id: '9',
      text: 'Thoughts that you would be better off dead or of hurting yourself in some way',
    },
  ],
  options: [
    { score: 0, text: 'Not at all' },
    { score: 1, text: 'Several days' },
    { score: 2, text: 'More than half the days' },
    { score: 3, text: 'Nearly every day' },
  ],
  closingQuestion: {
    question:
      'If you checked off any problems, how difficult have these problems made it for you to do your work, take care of things at home, or get along with other people?',
    text:
      'If you checked off any problems, how difficult have these problems made it for you to do your work, take care of things at home, or get along with other people?',
    options: [
      'Not difficult at all',
      'Somewhat difficult',
      'Very difficult',
      'Extremely difficult',
    ],
    scored: false,
    partOfTotal: false,
  },
  source: {
    attribution:
      'Developed by Drs. Robert L. Spitzer, Janet B.W. Williams, Kurt Kroenke and colleagues, with an educational grant from Pfizer Inc. No permission required to reproduce, translate, display or distribute.',
    url:
      'https://web.archive.org/web/20201112021844/https://www.phqscreeners.com/images/sites/g/files/g10060481/f/201412/PHQ-9_English.pdf',
    date: '14 November 2026',
  },
};

export type Phq9WordingResult =
  | { ok: true; value: Phq9Wording }
  | { ok: false; error: string };

export function getPhq9Wording(locale: string): Phq9WordingResult {
  if (locale === 'en') {
    return { ok: true, value: PHQ9_TEXT_EN };
  }
  return { ok: false, error: `Locale not available: ${locale}` };
}

export const getPhq9Text = getPhq9Wording;
