import { z } from 'zod';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';

export const isoDatetimeCodec = z
  .string()
  .datetime()
  .transform((v) => dayjs(v)) as unknown as z.ZodType<
  Dayjs,
  z.ZodTypeDef,
  string
>;
