import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { z } from 'zod';

export const isoDatetimeCodec = z.codec(
  z.iso.datetime(),
  z.custom<Dayjs>((value) => dayjs.isDayjs(value)),
  {
    decode: (value) => dayjs(value),
    encode: (value) => value.toISOString(),
  },
);
