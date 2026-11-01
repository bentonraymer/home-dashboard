import type { ClockStyle } from './types';

/** Looks for the clock and the text around it; the CSS for each lives in global.css as `.cs-<id>`. */
export const CLOCK_STYLES: { id: ClockStyle; label: string }[] = [
  { id: 'classic', label: 'Classic — thin and airy' },
  { id: 'rounded', label: 'Rounded — soft geometric' },
  { id: 'serif', label: 'Serif — editorial' },
  { id: 'mono', label: 'Mono — technical' },
  { id: 'condensed', label: 'Condensed — tall and bold' },
  { id: 'outline', label: 'Outline — hollow numerals' },
];
