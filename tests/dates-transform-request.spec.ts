import type { AxiosRequestConfig } from 'axios';
import { afterEach, expect, test } from 'vite-plus/test';

import {
  updateAppointment,
  updateAppointmentDuplicateDate,
  updateAppointmentReminder,
  updateAppointmentWindow,
  updateShelterIntake,
  updateShelterRecords,
} from './generated/react-query/dates-transform/endpoints';
import { AXIOS_INSTANCE } from './mutators/custom-instance';

const originalAdapter = AXIOS_INSTANCE.defaults.adapter;

afterEach(() => {
  AXIOS_INSTANCE.defaults.adapter = originalAdapter;
});

const captureRequest = (): { config?: AxiosRequestConfig } => {
  const captured: { config?: AxiosRequestConfig } = {};
  AXIOS_INSTANCE.defaults.adapter = async (config) => {
    captured.config = config;
    return {
      data: {},
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    };
  };
  return captured;
};

// The mock response body is populated with one entry per discriminated
// variant (rather than left empty or omitted) so the response-side map
// traversal actually runs its loop body at least once; an empty map would let
// the deserializer's `Object.keys` loop iterate zero times and prove nothing.
const captureShelterIntakeRequest = (): { config?: AxiosRequestConfig } => {
  const captured: { config?: AxiosRequestConfig } = {};
  AXIOS_INSTANCE.defaults.adapter = async (config) => {
    captured.config = config;
    return {
      data: {
        shelterId: 'shelter-1',
        pets: {
          whiskers: { petType: 'cat', arrivedOn: '2026-07-01' },
          rex: { petType: 'dog', vaccinatedAt: '2026-07-01T09:30:00.000Z' },
        },
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    };
  };
  return captured;
};

test('serializes format: date body fields as calendar days, not datetimes', async () => {
  const captured = captureRequest();

  await updateAppointment({
    // What the generated deserializer produces for "2026-07-01": UTC midnight.
    day: new Date('2026-07-01'),
    bookedAt: new Date('2026-07-01T09:30:00.000Z'),
    reminderOn: new Date('2026-06-30'),
    slots: [{ start: new Date('2026-07-02'), label: 'morning' }],
  });

  const body = JSON.parse(String(captured.config?.data));

  expect(body.day).toBe('2026-07-01');
  expect(body.reminderOn).toBe('2026-06-30');
  expect(body.slots[0].start).toBe('2026-07-02');
  // date-time keeps its instant.
  expect(body.bookedAt).toBe('2026-07-01T09:30:00.000Z');
});

test('does not mutate the caller object', async () => {
  captureRequest();

  const appointment = {
    day: new Date('2026-07-01'),
    bookedAt: new Date('2026-07-01T09:30:00.000Z'),
    reminderOn: null,
    slots: [{ start: new Date('2026-07-02'), label: 'morning' }],
  };

  await updateAppointment(appointment);

  expect(appointment.day).toBeInstanceOf(Date);
  expect(appointment.slots[0].start).toBeInstanceOf(Date);
});

test('serializes an optional request body format: date field as a calendar day', async () => {
  const captured = captureRequest();

  await updateAppointmentReminder('appt-1', {
    // What the generated deserializer produces for "2026-06-30": UTC midnight.
    remindOn: new Date('2026-06-30'),
  });

  const body = JSON.parse(String(captured.config?.data));

  expect(body.remindOn).toBe('2026-06-30');
});

test('sends no body when the optional request body is omitted', async () => {
  const captured = captureRequest();

  // Exercises the `ReminderUpdate | undefined` signature at runtime: nothing
  // upstream of the serializer supplies a body, so `data == null` must
  // short-circuit before ever touching `.remindOn`.
  await updateAppointmentReminder('appt-1');

  expect(captured.config?.data).toBeUndefined();
});

test('serializes a field re-declared by an allOf branch idempotently, without throwing', async () => {
  const captured = captureRequest();

  // `AppointmentWithDuplicateDate.day` is declared on both allOf branches
  // (once inherited, once re-declared to add a description), so the request
  // walk converts it twice. Before the idempotent guard, the second
  // conversion called `.toISOString()` on the string the first one produced
  // and threw `TypeError: ... .toISOString is not a function`.
  await updateAppointmentDuplicateDate({ day: new Date('2026-07-01') });

  const body = JSON.parse(String(captured.config?.data));

  expect(body.day).toBe('2026-07-01');
});

test('does not throw and omits the key when a required array body field is left out', async () => {
  // `Appointment.slots` is required and non-nullable. Before the request-side
  // container guard, an omitted `slots` threw `TypeError: Cannot read
  // properties of undefined (reading 'map')` inside the generated serializer.
  const captured = captureRequest();

  await updateAppointment({
    day: new Date('2026-07-01'),
    bookedAt: new Date('2026-07-01T09:30:00.000Z'),
  } as unknown as Parameters<typeof updateAppointment>[0]);

  const body = JSON.parse(String(captured.config?.data));

  expect(body).not.toHaveProperty('slots');
});

test('serializes format: date values inside an additionalProperties map, leaving format: date-time values alone', async () => {
  const captured = captureShelterIntakeRequest();

  // `pets` is a dictionary keyed by pet id whose values are a
  // discriminated union: `IntakeCat.arrivedOn` is `format: date` and
  // must serialize to a calendar day; `IntakeDog.vaccinatedAt` is
  // `format: date-time` and must keep its full instant.
  await updateShelterIntake('shelter-1', {
    shelterId: 'shelter-1',
    pets: {
      whiskers: { petType: 'cat', arrivedOn: new Date('2026-07-01') },
      rex: {
        petType: 'dog',
        vaccinatedAt: new Date('2026-07-01T09:30:00.000Z'),
      },
    },
  });

  const body = JSON.parse(String(captured.config?.data));

  expect(body.pets.whiskers.arrivedOn).toBe('2026-07-01');
  expect(body.pets.rex.vaccinatedAt).toBe('2026-07-01T09:30:00.000Z');
});

test('does not mutate the caller map or its value objects when serializing an additionalProperties map', async () => {
  captureShelterIntakeRequest();

  // Object-identity checks, not just value checks: a shallow copy of the
  // map that reused the original value objects would still let the wire
  // serialization mutate `cat`/`dog` in place, and a
  // missing copy of the map itself would still overwrite `whiskers`/`rex` on
  // the caller's own map object even if each value were copied.
  const cat = {
    petType: 'cat' as const,
    arrivedOn: new Date('2026-07-01'),
  };
  const dog = {
    petType: 'dog' as const,
    vaccinatedAt: new Date('2026-07-01T09:30:00.000Z'),
  };
  const pets = { whiskers: cat, rex: dog };

  await updateShelterIntake('shelter-1', {
    shelterId: 'shelter-1',
    pets,
  });

  expect(pets.whiskers).toBe(cat);
  expect(pets.rex).toBe(dog);
  expect(cat.arrivedOn).toBeInstanceOf(Date);
  expect(cat.arrivedOn.toISOString().slice(0, 10)).toBe('2026-07-01');
  expect(dog.vaccinatedAt).toBeInstanceOf(Date);
  expect(dog.vaccinatedAt.toISOString()).toBe(
    '2026-07-01T09:30:00.000Z',
  );
});

test('deserializes format: date and format: date-time values inside an additionalProperties map in the response', async () => {
  // The mock response body (see captureShelterIntakeRequest) has one
  // `cat` entry and one `dog` entry, so this exercises the
  // deserializer's `Object.keys` loop over an actually-populated map,
  // not the zero-iteration case.
  captureShelterIntakeRequest();

  const response = await updateShelterIntake('shelter-1', {
    shelterId: 'shelter-1',
    pets: {
      whiskers: { petType: 'cat', arrivedOn: new Date('2026-07-01') },
      rex: {
        petType: 'dog',
        vaccinatedAt: new Date('2026-07-01T09:30:00.000Z'),
      },
    },
  });

  const cat = response.pets.whiskers;
  const dog = response.pets.rex;

  if (cat.petType !== 'cat') {
    throw new Error(`expected a cat, got petType: ${cat.petType}`);
  }
  if (dog.petType !== 'dog') {
    throw new Error(
      `expected a dog, got petType: ${dog.petType}`,
    );
  }

  expect(cat.arrivedOn).toBeInstanceOf(Date);
  expect(cat.arrivedOn.toISOString().slice(0, 10)).toBe('2026-07-01');
  expect(dog.vaccinatedAt).toBeInstanceOf(Date);
  expect(dog.vaccinatedAt.toISOString()).toBe('2026-07-01T09:30:00.000Z');
});

test('does not throw and omits the key when a required additionalProperties map body field is left out', async () => {
  // `ShelterIntake.pets` is required and non-nullable, same as
  // `Appointment.slots` above. Before the request-side container guard was
  // extended to map-valued additionalProperties, an omitted `pets` would
  // either be spread into `{}` or throw inside the generated serializer's
  // `Object.keys` loop.
  const captured = captureShelterIntakeRequest();

  await updateShelterIntake('shelter-1', {
    shelterId: 'shelter-1',
  } as unknown as Parameters<typeof updateShelterIntake>[1]);

  const body = JSON.parse(String(captured.config?.data));

  expect(body).not.toHaveProperty('pets');
});

test('does not throw when the response omits the required slots array', async () => {
  // `Appointment.slots` is required and non-nullable on the response side
  // too. Before the response-side container guard, a server response that
  // omitted it threw `TypeError: Cannot read properties of undefined
  // (reading 'length')` inside the generated deserializer, before this
  // promise could ever resolve.
  captureRequest();

  await expect(
    updateAppointment({
      day: new Date('2026-07-01'),
      bookedAt: new Date('2026-07-01T09:30:00.000Z'),
      slots: [{ start: new Date('2026-07-02'), label: 'morning' }],
    }),
  ).resolves.not.toHaveProperty('slots');
});

test('does not throw when the response omits the required pets map', async () => {
  // `ShelterIntake.pets` is required and non-nullable on the response side
  // too. Without the response-side container guard, a response omitting it
  // threw inside the generated deserializer's `Object.keys(data.pets)` loop.
  AXIOS_INSTANCE.defaults.adapter = async (config) => ({
    data: { shelterId: 'shelter-1' },
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  });

  await expect(
    updateShelterIntake('shelter-1', {
      shelterId: 'shelter-1',
      pets: {
        whiskers: { petType: 'cat', arrivedOn: new Date('2026-07-01') },
      },
    }),
  ).resolves.not.toHaveProperty('pets');
});

// NOTE ON TEST STYLE BELOW: `serializeUpdateShelterRecordsRequest` and
// `serializeUpdateAppointmentWindowRequest` are not exported from the
// generated module — every generated `serialize*Request`/`deserialize*Response`
// function in this codebase is a module-private `const`, matching every test
// above this point, which drives the request through the public endpoint
// function and inspects the wire body captured by the mocked axios adapter.
// The four tests below follow that same established pattern rather than
// importing the private serializers directly.

test('serializes dates inside an undiscriminated union map value', async () => {
  // Would regress to sending a full ISO datetime if the structural union
  // walk stopped emitting, which is what every orval release before this
  // one did for a union with no discriminator mapping.
  const captured = captureRequest();

  const records = {
    'record-1': {
      recordType: 'visit' as const,
      visitedOn: new Date('2026-07-01T09:30:00.000Z'),
      seenBy: 'Dr. Ada',
    },
    'record-2': { recordType: 'weight' as const, kilograms: 4.2 },
  };

  await updateShelterRecords('shelter-1', { records });

  const body = JSON.parse(String(captured.config?.data));

  expect(body.records['record-1'].visitedOn).toBe('2026-07-01');
  // The non-date variant must come through untouched, asserted on the whole
  // record rather than on `kilograms` alone: a wrongly emitted conversion
  // reads `kilograms instanceof Date ? … : kilograms` and leaves `4.2`
  // exactly as it was, so a `kilograms` check can never fail. What can fail
  // is an extra key on the wire — the presence guards are the only thing
  // keeping `visitedOn`, `entries` and `administeredAt` off a variant that
  // never declared them.
  expect(body.records['record-2']).toEqual({
    recordType: 'weight',
    kilograms: 4.2,
  });
  // The input must not be mutated — the request direction copies.
  expect(records['record-1'].visitedOn).toBeInstanceOf(Date);
});

test('reaches dates nested in an array inside a union variant', async () => {
  // Pins that the walk descends through `entries`: an array inside a union
  // variant, whose items are a single `$ref` to `VisitRecord` rather than a
  // union of their own.
  const captured = captureRequest();

  await updateShelterRecords('shelter-1', {
    records: {
      'record-1': {
        recordType: 'visit' as const,
        entries: [
          {
            recordType: 'visit' as const,
            visitedOn: new Date('2026-07-02T23:45:00.000Z'),
          },
        ],
      },
    },
  });

  const body = JSON.parse(String(captured.config?.data));

  expect(body.records['record-1'].entries[0].visitedOn).toBe('2026-07-02');
});

test('deserializes dates inside an undiscriminated union map value in the response', async () => {
  // The RESPONSE direction of the structural walk. Every other
  // `updateShelterRecords` test above drives the endpoint through
  // `captureRequest()`, whose mock adapter answers `data: {}`, so the
  // generated deserializer's `Object.keys(data.records)` loop iterates zero
  // times and the response walk is pinned by snapshot text and `tsc` alone.
  // This is the undiscriminated equivalent of the populated-mock response
  // test the discriminated twin already has above: one entry per shape, so
  // the loop body really runs.
  AXIOS_INSTANCE.defaults.adapter = async (config) => ({
    data: {
      records: {
        'record-1': {
          recordType: 'visit',
          visitedOn: '2026-07-01',
          seenBy: 'Dr. Ada',
        },
        'record-2': {
          recordType: 'visit',
          entries: [{ recordType: 'visit', visitedOn: '2026-07-02' }],
        },
        'record-3': { recordType: 'weight', kilograms: 4.2 },
      },
    },
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  });

  const response = await updateShelterRecords('shelter-1', {
    records: {
      'record-1': {
        recordType: 'visit',
        visitedOn: new Date('2026-07-01'),
        seenBy: 'Dr. Ada',
      },
    },
  });

  const visit = response.records['record-1'];
  const series = response.records['record-2'];
  const weight = response.records['record-3'];

  if (!('visitedOn' in visit)) {
    throw new Error('expected a record carrying visitedOn');
  }
  if (!('entries' in series)) {
    throw new Error('expected a record carrying entries');
  }
  if (!('kilograms' in weight)) {
    throw new Error('expected a record carrying kilograms');
  }

  expect(visit.visitedOn).toBeInstanceOf(Date);
  expect(visit.visitedOn.toISOString()).toBe('2026-07-01T00:00:00.000Z');

  // The nested array inside a union variant, reached through the same walk.
  expect(series.entries[0].visitedOn).toBeInstanceOf(Date);
  expect(series.entries[0].visitedOn.toISOString()).toBe(
    '2026-07-02T00:00:00.000Z',
  );

  // A variant that declares no date is left exactly as the server sent it:
  // `kilograms` stays a number, and the presence guards keep the other
  // variants' keys off it.
  expect(weight.kilograms).toBe(4.2);
  expect(weight).not.toHaveProperty('visitedOn');
  expect(weight).not.toHaveProperty('entries');
});

test('skips a property whose union variants disagree in shape, converts the one they agree on', async () => {
  // `openedOn` is an array of calendar days in one variant (`LegacyWindow`)
  // and a scalar calendar day in the other (`CalendarWindow`): both shapes
  // produce a real, non-empty conversion statement, but the two statements
  // differ, so it is the comparator itself — not an empty-vs-non-empty
  // shortcut — that skips the property. `closedAt` is `format: date` in
  // both variants and must still serialize to a UTC calendar day.
  const captured = captureRequest();

  await updateAppointmentWindow('appt-1', {
    openedOn: new Date('2026-07-01T09:30:00.000Z'),
    closedAt: new Date('2026-07-05T12:00:00.000Z'),
  });

  const body = JSON.parse(String(captured.config?.data));

  expect(body.closedAt).toBe('2026-07-05');
  // Left alone entirely — not converted in either direction.
  expect(body.openedOn).toBe('2026-07-01T09:30:00.000Z');
});
