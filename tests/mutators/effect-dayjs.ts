import dayjs, { type Dayjs } from 'dayjs';
import { Schema, SchemaTransformation } from 'effect';

export const DayjsFromString = Schema.String.pipe(
  Schema.decodeTo(
    Schema.declare((value): value is Dayjs => dayjs.isDayjs(value)),
    SchemaTransformation.transform({
      decode: (value: string) => dayjs(value),
      encode: (value: Dayjs) => value.toISOString(),
    }),
  ),
);
