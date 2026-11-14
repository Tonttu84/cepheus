export const GAD7_COLUMN_BY_ID = {
  "1": "item1Nervous",
  "2": "item2ControlWorry",
  "3": "item3ExcessiveWorry",
  "4": "item4Relaxing",
  "5": "item5Restless",
  "6": "item6Irritable",
  "7": "item7Afraid",
} as const;

export type Gad7ItemColumn = (typeof GAD7_COLUMN_BY_ID)[keyof typeof GAD7_COLUMN_BY_ID];

export const GAD7_COLUMNS: readonly Gad7ItemColumn[] = Object.values(GAD7_COLUMN_BY_ID);
