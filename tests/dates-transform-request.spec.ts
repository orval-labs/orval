import type { AxiosRequestConfig } from 'axios';
import { afterEach, expect, test } from 'vite-plus/test';

import {
  updateAppointment,
  updateAppointmentDuplicateDate,
  updateAppointmentReminder,
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
    // The response deserializer unconditionally iterates `data.slots`, so the
    // mock body needs an (empty) array there to survive `.then(deserialize...)`.
    return {
      data: { slots: [] },
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
