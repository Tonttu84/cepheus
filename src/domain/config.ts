export interface RuleConfig {
  version: number;
  bottomOptionScore: number;
  tapDropOne: number;
  tapDropBoth: number;
  tapBaselineRequiredRounds: number;
  phq9NotWellCutoff: number;
  phq9WarningCutoff: number;
  phq9WarningRise: number;
}

export const DEFAULT_RULE_CONFIG: RuleConfig = {
  version: 1,
  bottomOptionScore: 0,
  tapDropOne: 2,
  tapDropBoth: 1,
  tapBaselineRequiredRounds: 8,
  phq9NotWellCutoff: 10,
  phq9WarningCutoff: 10,
  phq9WarningRise: 6,
};
