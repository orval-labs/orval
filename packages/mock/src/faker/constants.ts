import type { OpenApiSchemaObject } from '@orval/core';

export const DEFAULT_FORMAT_MOCK: Record<
  Required<OpenApiSchemaObject>['format'],
  string
> = {
  bic: 'faker.finance.bic()',
  binary:
    "new Blob(faker.helpers.arrayElements(faker.word.words(10).split(' ')))",
  city: 'faker.location.city()',
  country: 'faker.location.country()',
  date: "faker.date.past().toISOString().split('T')[0]",
  'date-time': "`${faker.date.past().toISOString().split('.')[0]}Z`",
  email: 'faker.internet.email()',
  firstName: 'faker.person.firstName()',
  gender: 'faker.person.gender()',
  iban: 'faker.finance.iban()',
  ipv4: 'faker.internet.ipv4()',
  ipv6: 'faker.internet.ipv6()',
  jobTitle: 'faker.person.jobTitle()',
  lastName: 'faker.person.lastName()',
  password: 'faker.internet.password()',
  phoneNumber: 'faker.phone.number()',
  streetName: 'faker.location.street()',
  uri: 'faker.internet.url()',
  url: 'faker.internet.url()',
  userName: 'faker.internet.userName()',
  uuid: 'faker.string.uuid()',
  zipCode: 'faker.location.zipCode()',
};

// #980 replace CUID so tests are consistent
export const DEFAULT_OBJECT_KEY_MOCK = 'faker.string.alphanumeric(5)';
