export const PHQ9_COLUMN_BY_ID = {
  "1": "item1Interest",
  "2": "item2Mood",
  "3": "item3Sleep",
  "4": "item4Energy",
  "5": "item5Appetite",
  "6": "item6SelfWorth",
  "7": "item7Concentration",
  "8": "item8Psychomotor",
  "9": "item9SelfHarm",
} as const;

export type Phq9ItemColumn = (typeof PHQ9_COLUMN_BY_ID)[keyof typeof PHQ9_COLUMN_BY_ID];

export const PHQ9_COLUMNS: readonly Phq9ItemColumn[] = Object.values(PHQ9_COLUMN_BY_ID);
