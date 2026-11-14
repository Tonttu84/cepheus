/**
 * GAD-7 Official English Wording
 *
 * Source: Spitzer RL, Kroenke K, Williams JB, Löwe B. A Brief Measure for Assessing Generalized Anxiety Disorder: The GAD-7. Arch Intern Med. 2006;166(10):1092-1097.
 * URL: https://web.archive.org/web/20201112021844/https://www.phqscreeners.com/images/sites/g/files/g10060481/f/201412/GAD-7_English.pdf
 * Permission: Developed by Drs. Robert L. Spitzer, Janet B.W. Williams, Kurt Kroenke and colleagues, with an educational grant from Pfizer Inc. No permission required to reproduce, translate, display or distribute.
 */

export interface Gad7ItemText {
  id: string;
  text: string;
}

export interface Gad7OptionText {
  score: number;
  text: string;
}

export interface Gad7SourceText {
  attribution: string;
  url: string;
  date: string;
}

export interface Gad7Wording {
  locale: string;
  openingQuestion: string;
  stem: string;
  items: Gad7ItemText[];
  options: Gad7OptionText[];
  source: Gad7SourceText;
}

export const GAD7_TEXT_EN: Gad7Wording = {
  locale: 'en',
  openingQuestion:
    'Over the last 2 weeks, how often have you been bothered by the following problems?',
  stem:
    'Over the last 2 weeks, how often have you been bothered by the following problems?',
  items: [
    {
      id: '1',
      text: 'Feeling nervous, anxious or on edge',
    },
    {
      id: '2',
      text: 'Not being able to stop or control worrying',
    },
    {
      id: '3',
      text: 'Worrying too much about different things',
    },
    {
      id: '4',
      text: 'Trouble relaxing',
    },
    {
      id: '5',
      text: 'Being so restless that it is hard to sit still',
    },
    {
      id: '6',
      text: 'Becoming easily annoyed or irritable',
    },
    {
      id: '7',
      text: 'Feeling afraid as if something awful might happen',
    },
  ],
  options: [
    { score: 0, text: 'Not at all' },
    { score: 1, text: 'Several days' },
    { score: 2, text: 'More than half the days' },
    { score: 3, text: 'Nearly every day' },
  ],
  source: {
    attribution:
      'Developed by Drs. Robert L. Spitzer, Janet B.W. Williams, Kurt Kroenke and colleagues, with an educational grant from Pfizer Inc. No permission required to reproduce, translate, display or distribute.',
    url:
      'https://web.archive.org/web/20201112021844/https://www.phqscreeners.com/images/sites/g/files/g10060481/f/201412/GAD-7_English.pdf',
    date: '14 November 2026',
  },
};

export type Gad7WordingResult =
  | { ok: true; value: Gad7Wording }
  | { ok: false; error: string };

export function getGad7Wording(locale: string): Gad7WordingResult {
  if (locale === 'en') {
    return { ok: true, value: GAD7_TEXT_EN };
  }
  return { ok: false, error: `Locale not available: ${locale}` };
}

export const getGad7Text = getGad7Wording;
