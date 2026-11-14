import { describe, it, expect } from 'vitest';
import {
  generateDepressionSamplePatient,
  generateDepressionAndAnxietySamplePatient,
  toPatientHistory,
} from '../person-generator';
import { validatePhq9Answers, validateGad7Answers } from '../../../domain/instruments';
import { evaluateHistory } from '../../../domain/history';

describe('Simulated Sample Patients', () => {
  describe('Sample Patient A: Depression only', () => {
    it('is deterministic and labelled as simulated', () => {
      const p1 = generateDepressionSamplePatient({ seed: 12345 });
      const p2 = generateDepressionSamplePatient({ seed: 12345 });
      expect(p1).toEqual(p2);

      expect(p1.participant.isSimulated).toBe(true);
      expect(p1.participant.source).toBe('synthetic');
      expect(p1.participant.label).toMatch(/simulated/i);
      expect(p1.participant.externalId).toMatch(/^sim-/);
      expect(p1.participant.condition).toBe('depression_only');
    });

    it('has no GAD-7 assessments and GAD-7 switch is off', () => {
      const patient = generateDepressionSamplePatient();
      expect(patient.gad7Assessments ?? []).toHaveLength(0);
      expect(patient.participant.questionnaires).toEqual(['phq9']);
    });

    it('all item-level PHQ-9 answers are valid according to the instrument', () => {
      const patient = generateDepressionSamplePatient();
      expect(patient.phq9Assessments.length).toBeGreaterThan(0);

      for (const p of patient.phq9Assessments) {
        if (p.status === 'completed') {
          const items = [
            { id: '1', value: p.item1Interest! },
            { id: '2', value: p.item2Mood! },
            { id: '3', value: p.item3Sleep! },
            { id: '4', value: p.item4Energy! },
            { id: '5', value: p.item5Appetite! },
            { id: '6', value: p.item6SelfWorth! },
            { id: '7', value: p.item7Concentration! },
            { id: '8', value: p.item8Psychomotor! },
            { id: '9', value: p.item9SelfHarm! },
          ];
          const valRes = validatePhq9Answers(items);
          expect(valRes.ok).toBe(true);
          if (valRes.ok) {
            const sum = items.reduce((acc, i) => acc + i.value, 0);
            expect(p.totalScore).toBe(sum);
          }
        }
      }
    });

    it('PHQ-9 totals start under 10 and rise to 10 or more partway through story', () => {
      const patient = generateDepressionSamplePatient();
      const completed = patient.phq9Assessments.filter((p) => p.status === 'completed');
      expect(completed[0].totalScore).toBeLessThan(10);
      expect(completed[1].totalScore).toBeLessThan(10);
      expect(completed[completed.length - 1].totalScore).toBeGreaterThanOrEqual(10);
    });

    it('evaluating history gives no warning before the crossing round and a warning at it, naming phq9', () => {
      const patient = generateDepressionSamplePatient();
      const history = toPatientHistory(patient);

      // Sliced before crossing round (rounds 1-12): no warning
      const historyBeforeCrossing = {
        ...history,
        rounds: history.rounds.filter((r) => r.roundNumber <= 12),
        phq9s: (history.phq9s ?? []).filter((p) => p.date <= history.rounds[11].localDate),
      };
      const resBefore = evaluateHistory(historyBeforeCrossing);
      expect(resBefore.ok).toBe(true);
      if (resBefore.ok) {
        const warnings = resBefore.value.effects.filter((e) => e.type === 'warning');
        expect(warnings).toHaveLength(0);
      }

      // Sliced at crossing round (round 13): exactly 1 warning naming phq9
      const historyAtCrossing = {
        ...history,
        rounds: history.rounds.filter((r) => r.roundNumber <= 13),
        phq9s: (history.phq9s ?? []).filter((p) => p.date <= history.rounds[12].localDate),
      };
      const resAt = evaluateHistory(historyAtCrossing);
      expect(resAt.ok).toBe(true);
      if (resAt.ok) {
        const warnings = resAt.value.effects.filter((e) => e.type === 'warning');
        expect(warnings).toHaveLength(1);
        expect(warnings[0].kind).toBe('phq9');
        expect(warnings[0].causedBy.type).toBe('phq9');
      }
    });
  });

  describe('Sample Patient B: Depression and anxiety', () => {
    it('is deterministic and labelled as simulated', () => {
      const p1 = generateDepressionAndAnxietySamplePatient({ seed: 54321 });
      const p2 = generateDepressionAndAnxietySamplePatient({ seed: 54321 });
      expect(p1).toEqual(p2);

      expect(p1.participant.isSimulated).toBe(true);
      expect(p1.participant.source).toBe('synthetic');
      expect(p1.participant.label).toMatch(/simulated/i);
      expect(p1.participant.externalId).toMatch(/^sim-/);
      expect(p1.participant.condition).toBe('depression_and_anxiety');
      expect(p1.participant.questionnaires).toEqual(['phq9', 'gad7']);
    });

    it('all item-level PHQ-9 and GAD-7 answers are valid according to their instruments', () => {
      const patient = generateDepressionAndAnxietySamplePatient();

      for (const p of patient.phq9Assessments) {
        if (p.status === 'completed') {
          const items = [
            { id: '1', value: p.item1Interest! },
            { id: '2', value: p.item2Mood! },
            { id: '3', value: p.item3Sleep! },
            { id: '4', value: p.item4Energy! },
            { id: '5', value: p.item5Appetite! },
            { id: '6', value: p.item6SelfWorth! },
            { id: '7', value: p.item7Concentration! },
            { id: '8', value: p.item8Psychomotor! },
            { id: '9', value: p.item9SelfHarm! },
          ];
          const valRes = validatePhq9Answers(items);
          expect(valRes.ok).toBe(true);
          if (valRes.ok) {
            const sum = items.reduce((acc, i) => acc + i.value, 0);
            expect(p.totalScore).toBe(sum);
          }
        }
      }

      for (const g of patient.gad7Assessments ?? []) {
        if (g.status === 'completed') {
          const items = [
            { id: '1', value: g.item1Nervous! },
            { id: '2', value: g.item2ControlWorry! },
            { id: '3', value: g.item3ExcessiveWorry! },
            { id: '4', value: g.item4Relaxing! },
            { id: '5', value: g.item5Restless! },
            { id: '6', value: g.item6Irritable! },
            { id: '7', value: g.item7Afraid! },
          ];
          const valRes = validateGad7Answers(items);
          expect(valRes.ok).toBe(true);
          if (valRes.ok) {
            const sum = items.reduce((acc, i) => acc + i.value, 0);
            expect(g.totalScore).toBe(sum);
          }
        }
      }
    });

    it('both totals start under 10, and GAD-7 crosses 10 at a different round from PHQ-9', () => {
      const patient = generateDepressionAndAnxietySamplePatient();
      const phq9Completed = patient.phq9Assessments.filter((p) => p.status === 'completed');
      const gad7Completed = (patient.gad7Assessments ?? []).filter((g) => g.status === 'completed');

      // Both start under 10 at Round 1
      expect(phq9Completed[0].totalScore).toBeLessThan(10);
      expect(gad7Completed[0].totalScore).toBeLessThan(10);

      // GAD-7 crosses 10 at Round 5 (Day 17) where PHQ-9 is still under 10
      expect(gad7Completed[1].totalScore).toBeGreaterThanOrEqual(10);
      expect(phq9Completed[1].totalScore).toBeLessThan(10);

      // PHQ-9 crosses 10 at Round 9 (Day 31) where GAD-7 has dropped back under 10
      expect(phq9Completed[2].totalScore).toBeGreaterThanOrEqual(10);
      expect(gad7Completed[2].totalScore).toBeLessThan(10);
    });

    it('evaluating history gives no warning before crossing, and warns at crossing round naming the right questionnaire', () => {
      const patient = generateDepressionAndAnxietySamplePatient();
      const history = toPatientHistory(patient);

      // Before Round 5 (rounds 1-4): no warning
      const beforeRound5 = {
        ...history,
        rounds: history.rounds.filter((r) => r.roundNumber <= 4),
        phq9s: (history.phq9s ?? []).filter((p) => p.date <= history.rounds[3].localDate),
        gad7s: (history.gad7s ?? []).filter((g) => g.date <= history.rounds[3].localDate),
      };
      const resBefore5 = evaluateHistory(beforeRound5);
      expect(resBefore5.ok).toBe(true);
      if (resBefore5.ok) {
        expect(resBefore5.value.effects.filter((e) => e.type === 'warning')).toHaveLength(0);
      }

      // At Round 5: GAD-7 crossing round -> warning naming gad7
      const atRound5 = {
        ...history,
        rounds: history.rounds.filter((r) => r.roundNumber <= 5),
        phq9s: (history.phq9s ?? []).filter((p) => p.date <= history.rounds[4].localDate),
        gad7s: (history.gad7s ?? []).filter((g) => g.date <= history.rounds[4].localDate),
      };
      const resAt5 = evaluateHistory(atRound5);
      expect(resAt5.ok).toBe(true);
      if (resAt5.ok) {
        const warnings = resAt5.value.effects.filter((e) => e.type === 'warning');
        expect(warnings).toHaveLength(1);
        expect(warnings[0].kind).toBe('gad7');
        expect(warnings[0].causedBy.type).toBe('gad7');
      }

      // At Round 9 (with call between round 5 and 9 clearing the GAD-7 warning):
      // PHQ-9 crossing round -> warning naming phq9
      const atRound9 = {
        ...history,
        rounds: history.rounds.filter((r) => r.roundNumber <= 9),
        phq9s: (history.phq9s ?? []).filter((p) => p.date <= history.rounds[8].localDate),
        gad7s: (history.gad7s ?? []).filter((g) => g.date <= history.rounds[8].localDate),
      };
      const resAt9 = evaluateHistory(atRound9);
      expect(resAt9.ok).toBe(true);
      if (resAt9.ok) {
        const warnings = resAt9.value.effects.filter((e) => e.type === 'warning');
        expect(warnings).toHaveLength(2);
        expect(warnings[0].kind).toBe('gad7');
        expect(warnings[1].kind).toBe('phq9');
      }
    });

    it('switch off: if GAD-7 switch is turned off, the GAD-7 total >= 10 at Round 5 raises no warning', () => {
      const patient = generateDepressionAndAnxietySamplePatient();
      const history = toPatientHistory(patient);

      // Turn switch off: questionnaires = ['phq9']
      const historySwitchOff = {
        ...history,
        rounds: history.rounds.filter((r) => r.roundNumber <= 5),
        phq9s: (history.phq9s ?? []).filter((p) => p.date <= history.rounds[4].localDate),
        gad7s: (history.gad7s ?? []).filter((g) => g.date <= history.rounds[4].localDate),
        questionnaires: ['phq9' as const],
      };
      const res = evaluateHistory(historySwitchOff);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.effects.filter((e) => e.type === 'warning')).toHaveLength(0);
      }
    });
  });

  describe('Pure functions and Patient privacy', () => {
    it('toPatientHistory and generator functions are pure and do not mutate inputs', () => {
      const options = { seed: 9999 };
      const optionsCopy = { ...options };
      const patient = generateDepressionAndAnxietySamplePatient(options);
      expect(options).toEqual(optionsCopy);

      const patientCopy = structuredClone(patient);
      const h1 = toPatientHistory(patient);
      const h2 = toPatientHistory(patient);
      expect(h1).toEqual(h2);
      expect(patient).toEqual(patientCopy);
    });

    it('patient-facing results contain no total, band, threshold, or warning', () => {
      const patient = generateDepressionAndAnxietySamplePatient();
      // Ensure patient participant record and patient suggestions contain no total, band, threshold, or warning
      const forbidden = ['warning', 'threshold', 'total', 'band'];

      const checkObject = (obj: unknown) => {
        if (!obj || typeof obj !== 'object') return;
        for (const [key, val] of Object.entries(obj)) {
          for (const word of forbidden) {
            expect(key.toLowerCase()).not.toContain(word);
          }
          if (typeof val === 'object') checkObject(val);
        }
      };

      for (const s of patient.patientSuggestions) {
        checkObject(s);
      }
    });
  });
});
