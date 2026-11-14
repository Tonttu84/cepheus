import type { WarningEffect } from '../warning/index';

export type FlagArea = 'check_in';

export type ClinicFlag = {
  area: FlagArea;
  since: string;
};

export function buildFlag(effect: WarningEffect): ClinicFlag | null {
  if (effect.type !== 'warning') return null;
  return {
    area: 'check_in',
    since: effect.since,
  };
}
