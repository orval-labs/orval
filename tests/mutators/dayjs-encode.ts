import type { Dayjs } from 'dayjs';

export const encodeDayjs = (value: Dayjs): string => value.toISOString();
