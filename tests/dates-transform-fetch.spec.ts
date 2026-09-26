import { afterEach, expect, test, vi } from 'vite-plus/test';

import {
  getShelterLastInspection as fetchGetShelterLastInspection,
  updateAppointment as fetchUpdateAppointment,
  updateShelterIntake as fetchUpdateShelterIntake,
} from './generated/fetch/dates-transform/endpoints';
import { updateAppointment as validatedUpdateAppointment } from './generated/runtime-validation/fetch-dates-transform/endpoints';

afterEach(() => {
  vi.unstubAllGlobals();
});

const appointment = () => ({
  day: new Date('2026-07-01'),
  bookedAt: new Date('2026-07-01T09:30:00.000Z'),
  slots: [{ start: new Date('2026-07-02'), label: 'morning' }],
});

const respondWith = (status: number, body: unknown) => {
  const fetchMock = vi.fn(
    async (_url: string, _init?: RequestInit) =>
      new Response(body === null ? null : JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

// Names the parsed wire body at each call.
// oxlint-disable-next-line typescript/no-unnecessary-type-parameters
const readSentBody = <T>(fetchMock: ReturnType<typeof respondWith>): T => {
  const body = fetchMock.mock.calls[0]?.[1]?.body;
  if (typeof body !== 'string') {
    throw new Error('expected the request body to be a string');
  }
  return JSON.parse(body) as T;
};

// Distinct from `respondWith`: sends the exact raw text given, so a 200 with
// a genuinely empty (not `null`, not `"{}"`) body can be simulated. `res.text()`
// on a real empty-body 200 response returns `''`, not `null` — only the
// `[204, 205, 304]` list produces `null`.
const respondWithRawBody = (status: number, rawBody: string) => {
  const fetchMock = vi.fn(
    async (_url: string, _init?: RequestInit) =>
      new Response(rawBody, {
        status,
        headers: { 'content-type': 'application/json' },
      }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

const APPOINTMENT_JSON = {
  day: '2026-07-01',
  bookedAt: '2026-07-01T09:30:00.000Z',
  slots: [{ start: '2026-07-02', label: 'morning' }],
};

const SHELTER_INTAKE_JSON = {
  shelterId: 'shelter-1',
  pets: {
    whiskers: { petType: 'cat', arrivedOn: '2026-07-01' },
    rex: { petType: 'dog', vaccinatedAt: '2026-07-01T09:30:00.000Z' },
  },
};

test('sends format: date body fields as calendar days', async () => {
  // If the request serializer regresses, `day`/`slots[].start` go out as
  // full ISO datetimes instead of calendar-day strings.
  const fetchMock = respondWith(200, APPOINTMENT_JSON);

  await fetchUpdateAppointment(appointment());

  const sent = readSentBody<{
    day: string;
    slots: { start: string }[];
    bookedAt: string;
  }>(fetchMock);
  expect(sent.day).toBe('2026-07-01');
  expect(sent.slots[0].start).toBe('2026-07-02');
  expect(sent.bookedAt).toBe('2026-07-01T09:30:00.000Z');
});

test('converts a successful response and keeps date-time as an instant', async () => {
  // If the response deserializer regresses, `day`/`bookedAt` stay strings
  // instead of becoming `Date` instances.
  respondWith(200, APPOINTMENT_JSON);

  const response = await fetchUpdateAppointment(appointment());

  expect(response.status).toBe(200);
  const data = response.data as { day: Date; bookedAt: Date };
  expect(data.day).toBeInstanceOf(Date);
  expect(data.day.toISOString()).toBe('2026-07-01T00:00:00.000Z');
  expect(data.bookedAt.toISOString()).toBe('2026-07-01T09:30:00.000Z');
});

test('converts a response whose root is itself a date', async () => {
  // Every other response here is an object, whose dates the deserializer
  // converts in place through `data.x = new Date(data.x)`. A bare date root
  // has no property, index or key to write through — the walk emits
  // `data = new Date(data)`, which never escapes the deserializer — so the
  // conversion reaches the caller only through its RETURN value. Calling the
  // deserializer as a statement and discarding it left `data` the raw string
  // while the type said `Date`, so `tsc` stayed green and only `.getTime()`
  // gave it away.
  respondWith(200, '2026-07-01T09:30:00.000Z');

  const response = await fetchGetShelterLastInspection('shelter-1');

  expect(response.data).toBeInstanceOf(Date);
  expect(response.data.getTime()).toBe(Date.UTC(2026, 6, 1, 9, 30, 0));
});

test('returns an error body untouched', async () => {
  // If the `res.status === 200` half of the guard regresses, a non-success
  // body gets deserialized into Dates it never declared.
  respondWith(400, { day: '2026-07-01', message: 'invalid' });

  const response = await fetchUpdateAppointment(appointment());

  expect(response.status).toBe(400);
  expect((response.data as unknown as { day: unknown }).day).toBe('2026-07-01');
});

test('does not create Invalid Date keys for a 204 with a null body', async () => {
  // Proves the `[204, 205, 304]` empty-body list, not the `body &&` guard: a
  // 204 already fails the `res.status === 200` half of `body && res.status
  // === 200` on its own, so this alone does not pin `body &&`.
  respondWith(204, null);

  const response = await fetchUpdateAppointment(appointment());

  expect(response.data).not.toHaveProperty('day');
});

test('does not create Invalid Date keys for a 200 with an empty body', async () => {
  // Proves the `body &&` half of the guard specifically: a 200 response with
  // an empty text body falls back to `data = {}`. Without `body &&`, the
  // guard would still pass on `res.status === 200` alone and the
  // deserializer would run on `{}`, writing `data.day = new Date(undefined)`
  // — a stray Invalid Date key that was never in the response.
  respondWithRawBody(200, '');

  const response = await fetchUpdateAppointment(appointment());

  expect(response.status).toBe(200);
  expect(response.data).not.toHaveProperty('day');
  expect(response.data).not.toHaveProperty('bookedAt');
});

test('does not mutate the caller object', async () => {
  // If the serializer stops copying before converting, the caller's own
  // `Date` objects get overwritten with ISO strings.
  respondWith(200, APPOINTMENT_JSON);
  const input = appointment();

  await fetchUpdateAppointment(input);

  expect(input.day).toBeInstanceOf(Date);
  expect(input.slots[0].start).toBeInstanceOf(Date);
});

test('lets zod validate date fields without coerce', async () => {
  // If the deserializer stopped running before `.parse()`, zod would reject
  // a calendar-day string against a bare (non-coerced) `z.date()` schema.
  respondWith(200, APPOINTMENT_JSON);

  const response = await validatedUpdateAppointment(appointment());

  const data = response.data as { day: Date };
  expect(data.day).toBeInstanceOf(Date);
});

test('serializes and deserializes format: date values inside an additionalProperties map', async () => {
  // Every other assertion in this file is on `updateAppointment` (a plain
  // object body); this is the only fetch runtime coverage of the
  // map-valued (`additionalProperties`) traversal, in both directions,
  // against a real fetch response — if that path regresses only for the
  // fetch client (e.g. a fetch-specific map-walk helper), nothing else here
  // would catch it.
  const fetchMock = respondWith(200, SHELTER_INTAKE_JSON);

  const response = await fetchUpdateShelterIntake('shelter-1', {
    shelterId: 'shelter-1',
    pets: {
      whiskers: { petType: 'cat', arrivedOn: new Date('2026-07-01') },
      rex: {
        petType: 'dog',
        vaccinatedAt: new Date('2026-07-01T09:30:00.000Z'),
      },
    },
  });

  const sentBody = readSentBody<{
    pets: {
      whiskers: { arrivedOn: string };
      rex: { vaccinatedAt: string };
    };
  }>(fetchMock);
  expect(sentBody.pets.whiskers.arrivedOn).toBe('2026-07-01');
  expect(sentBody.pets.rex.vaccinatedAt).toBe('2026-07-01T09:30:00.000Z');

  const data = response.data as unknown as {
    pets: { whiskers: { arrivedOn: Date }; rex: { vaccinatedAt: Date } };
  };
  expect(data.pets.whiskers.arrivedOn).toBeInstanceOf(Date);
  expect(data.pets.whiskers.arrivedOn.toISOString()).toBe(
    '2026-07-01T00:00:00.000Z',
  );
  expect(data.pets.rex.vaccinatedAt).toBeInstanceOf(Date);
  expect(data.pets.rex.vaccinatedAt.toISOString()).toBe(
    '2026-07-01T09:30:00.000Z',
  );
});
