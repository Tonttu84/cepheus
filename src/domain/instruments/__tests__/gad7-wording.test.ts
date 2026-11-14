import { describe, it, expect } from 'vitest';
import { getGad7Wording, GAD7_TEXT_EN } from '../gad7-text.en';

describe('GAD-7 Official English Wording', () => {
  it('has exactly seven items in order, with no item duplicated', () => {
    const result = getGad7Wording('en');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const wording = result.value;
    expect(wording.items).toHaveLength(7);

    // Verify ordering by id '1' through '7'
    wording.items.forEach((item, index) => {
      expect(item.id).toBe(String(index + 1));
      expect(typeof item.text).toBe('string');
      expect(item.text.trim().length).toBeGreaterThan(0);
    });

    // Verify no item id is duplicated
    const itemIds = wording.items.map((i) => i.id);
    expect(new Set(itemIds).size).toBe(7);

    // Verify no item text is duplicated
    const itemTexts = wording.items.map((i) => i.text);
    expect(new Set(itemTexts).size).toBe(7);
  });

  it('has exactly four options with scores 0, 1, 2, 3 and the official labels', () => {
    const result = getGad7Wording('en');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const wording = result.value;
    expect(wording.options).toHaveLength(4);
    expect(wording.options.map((o) => o.score)).toEqual([0, 1, 2, 3]);

    const expectedLabels = [
      'Not at all',
      'Several days',
      'More than half the days',
      'Nearly every day',
    ];
    expect(wording.options.map((o) => o.text)).toEqual(expectedLabels);
  });

  it('pins the exact official stem and exact first and last item text', () => {
    const result = getGad7Wording('en');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const wording = result.value;
    const EXPECTED_STEM =
      'Over the last 2 weeks, how often have you been bothered by the following problems?';
    expect(wording.openingQuestion).toBe(EXPECTED_STEM);
    expect(wording.stem).toBe(EXPECTED_STEM);

    // Exact first and last item text from primary source
    expect(wording.items[0].text).toBe('Feeling nervous, anxious or on edge');
    expect(wording.items[6].text).toBe('Feeling afraid as if something awful might happen');

    // All seven official items verbatim
    const EXPECTED_ITEMS = [
      { id: '1', text: 'Feeling nervous, anxious or on edge' },
      { id: '2', text: 'Not being able to stop or control worrying' },
      { id: '3', text: 'Worrying too much about different things' },
      { id: '4', text: 'Trouble relaxing' },
      { id: '5', text: 'Being so restless that it is hard to sit still' },
      { id: '6', text: 'Becoming easily annoyed or irritable' },
      { id: '7', text: 'Feeling afraid as if something awful might happen' },
    ];
    expect(wording.items).toEqual(EXPECTED_ITEMS);
  });

  it('includes official attribution, url, and permission statement in source info', () => {
    const result = getGad7Wording('en');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const wording = result.value;
    expect(wording.source.attribution).toContain('Drs. Robert L. Spitzer, Janet B.W. Williams, Kurt Kroenke');
    expect(wording.source.attribution).toContain('No permission required to reproduce, translate, display or distribute');
    expect(wording.source.url).toBe(
      'https://web.archive.org/web/20201112021844/https://www.phqscreeners.com/images/sites/g/files/g10060481/f/201412/GAD-7_English.pdf'
    );
  });

  it('returns an explicit error result for unavailable locales', () => {
    const unavailableLocales = ['fi', 'sv', 'de', 'fr', 'es', 'unknown', ''];
    for (const loc of unavailableLocales) {
      const result = getGad7Wording(loc);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(typeof result.error).toBe('string');
        expect(result.error.length).toBeGreaterThan(0);
      }
    }
  });

  it('is a pure function that does not mutate objects and produces identical output', () => {
    const res1 = getGad7Wording('en');
    const res2 = getGad7Wording('en');
    expect(res1).toEqual(res2);
    expect(res1.ok).toBe(true);
    if (res1.ok && res2.ok) {
      expect(res1.value.items).toEqual(res2.value.items);
      expect(res1.value).toEqual(GAD7_TEXT_EN);
    }
  });
});
