import { describe, it, expect } from 'vitest';
import { PHQ9_ITEMS, getPhq9Wording } from '../index';

describe('PHQ-9 Official English Wording', () => {
  it('has exactly one text for every existing item id, in order', () => {
    const result = getPhq9Wording('en');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const wording = result.value;
    expect(wording.items).toHaveLength(PHQ9_ITEMS.length);

    // Verify ordering and one-to-one matching with PHQ9_ITEMS
    PHQ9_ITEMS.forEach((existingItem, index) => {
      const itemWording = wording.items[index];
      expect(itemWording.id).toBe(existingItem.id);
      expect(typeof itemWording.text).toBe('string');
      expect(itemWording.text.trim().length).toBeGreaterThan(0);
    });

    // Check no duplicate ids
    const itemIds = wording.items.map((i) => i.id);
    expect(new Set(itemIds).size).toBe(PHQ9_ITEMS.length);
  });

  it('has exactly four options with scores 0, 1, 2, 3', () => {
    const result = getPhq9Wording('en');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const wording = result.value;
    expect(wording.options).toHaveLength(4);
    expect(wording.options.map((o) => o.score)).toEqual([0, 1, 2, 3]);

    wording.options.forEach((opt) => {
      expect(typeof opt.text).toBe('string');
      expect(opt.text.trim().length).toBeGreaterThan(0);
    });
  });

  it('marks the closing question as not scored and not part of the total', () => {
    const result = getPhq9Wording('en');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const wording = result.value;
    expect(wording.closingQuestion.scored).toBe(false);
    expect(wording.closingQuestion.partOfTotal).toBe(false);
    expect(wording.closingQuestion.options).toHaveLength(4);
    expect(typeof wording.closingQuestion.question).toBe('string');
    expect(wording.closingQuestion.question.trim().length).toBeGreaterThan(0);
  });

  it('returns an error result for an unavailable locale and never returns English silently', () => {
    const unavailableLocales = ['fi', 'sv', 'de', 'fr', 'es', 'unknown', ''];
    for (const loc of unavailableLocales) {
      const result = getPhq9Wording(loc);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(typeof result.error).toBe('string');
        expect(result.error.length).toBeGreaterThan(0);
      }
    }
  });

  it('pins the exact official wording character by character', () => {
    const result = getPhq9Wording('en');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const wording = result.value;

    const EXPECTED_OPENING_QUESTION =
      'Over the last 2 weeks, how often have you been bothered by any of the following problems?';

    const EXPECTED_ITEMS = [
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
    ];

    const EXPECTED_OPTIONS = [
      { score: 0, text: 'Not at all' },
      { score: 1, text: 'Several days' },
      { score: 2, text: 'More than half the days' },
      { score: 3, text: 'Nearly every day' },
    ];

    const EXPECTED_CLOSING_QUESTION = {
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
    };

    const EXPECTED_ATTRIBUTION =
      'Developed by Drs. Robert L. Spitzer, Janet B.W. Williams, Kurt Kroenke and colleagues, with an educational grant from Pfizer Inc. No permission required to reproduce, translate, display or distribute.';

    const EXPECTED_SOURCE_URL =
      'https://web.archive.org/web/20201112021844/https://www.phqscreeners.com/images/sites/g/files/g10060481/f/201412/PHQ-9_English.pdf';

    const EXPECTED_FETCH_DATE = '14 November 2026';

    expect(wording.openingQuestion).toBe(EXPECTED_OPENING_QUESTION);
    expect(wording.items).toEqual(EXPECTED_ITEMS);
    expect(wording.options).toEqual(EXPECTED_OPTIONS);
    expect(wording.closingQuestion.question).toBe(EXPECTED_CLOSING_QUESTION.question);
    expect(wording.closingQuestion.text).toBe(EXPECTED_CLOSING_QUESTION.text);
    expect(wording.closingQuestion.options).toEqual(EXPECTED_CLOSING_QUESTION.options);
    expect(wording.closingQuestion.scored).toBe(false);
    expect(wording.closingQuestion.partOfTotal).toBe(false);
    expect(wording.source.attribution).toBe(EXPECTED_ATTRIBUTION);
    expect(wording.source.url).toBe(EXPECTED_SOURCE_URL);
    expect(wording.source.date).toBe(EXPECTED_FETCH_DATE);
  });
});
