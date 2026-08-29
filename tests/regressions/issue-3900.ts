import type { NullableEnumAnyOf } from '../generated/default/example-v3-1/model/nullableEnumAnyOf';
import type { TestExampleEnum } from '../generated/default/example-v3-1/model/testExampleEnum';
import type { TestExampleNullableEnum } from '../generated/default/example-v3-1/model/testExampleNullableEnum';

// OpenAPI 3.1 spells a nullable enum as `anyOf: [{enum: [...]}, {type: 'null'}]`.
// Dropping the null branch from the named type breaks the generated faker mock,
// which still produces null, and every consumer that handles the null the API
// actually sends.
const namedEnum: NullableEnumAnyOf = null;
const propertyEnum: TestExampleNullableEnum = null;

void namedEnum;
void propertyEnum;

// @ts-expect-error - an enum without a null branch must not gain one.
const plainEnum: TestExampleEnum = null;

void plainEnum;
