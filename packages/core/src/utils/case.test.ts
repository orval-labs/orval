import { kebab } from './case';

describe('kebab-case a few examples', () => {
  //fix #937, issue #936, results in kebab routine being potentially called
  //on a string **repeatedly**.
  //Do some basic kebab case checks
  //Additionally, test that the kebab routine is Idempotent
  [
    ['Pet', 'pet'],
    ['pet', 'pet'],
    ['PetTag', 'pet-tag'],
    ['pet-tag', 'pet-tag'],
    ['PetTagWithFourWords', 'pet-tag-with-four-words'],
    ['pet-tag-with-four-words', 'pet-tag-with-four-words'],
  ].forEach(([input, expected]) => {
    it(`should process ${input} to ${expected}`, () => {
      expect(kebab(input)).toBe(expected);
    });
  });
});
