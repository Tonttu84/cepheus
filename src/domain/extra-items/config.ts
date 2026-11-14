import { EXTRA_ITEMS } from './items';
import type { ExtraItemsConfig } from './types';

export const DEFAULT_EXTRA_ITEMS_CONFIG: ExtraItemsConfig = Object.freeze({
  version: 1,
  enabled: false,
  items: EXTRA_ITEMS,
});
