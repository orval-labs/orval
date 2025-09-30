import { ArrayTest } from '../generated/default/regressions/model/arrayTest';

// Ensure arrays with nullable items work correctly.
// See: https://github.com/orval-labs/orval/pull/563
const arrays: ArrayTest = {
  nullable_items: ['string', null],
  nested_nullable_items: [['string'], [null]],
};

void arrays;
