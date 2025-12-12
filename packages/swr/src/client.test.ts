import type { GetterProp } from '@orval/core';
import { GetterPropType } from '@orval/core';
import { describe, expect, it } from 'vitest';

describe('query parameter type extraction', () => {
  it('extracts type name from query param GetterProp', () => {
    const queryParamProp: GetterProp = {
      name: 'params',
      definition: 'params: ListPetsParams',
      implementation: 'params: ListPetsParams',
      default: false,
      required: true,
      type: GetterPropType.QUERY_PARAM,
    };

    const props: GetterProp[] = [queryParamProp];
    const queryParam = props.find(
      (prop) => prop.type === GetterPropType.QUERY_PARAM,
    );
    const extractedType = queryParam?.definition.split(': ')[1] ?? 'never';

    expect(extractedType).toBe('ListPetsParams');
  });

  it('extracts type name from optional query param', () => {
    const queryParamProp: GetterProp = {
      name: 'params',
      definition: 'params?: GetUsersParams',
      implementation: 'params?: GetUsersParams',
      default: false,
      required: false,
      type: GetterPropType.QUERY_PARAM,
    };

    const props: GetterProp[] = [queryParamProp];
    const queryParam = props.find(
      (prop) => prop.type === GetterPropType.QUERY_PARAM,
    );
    const extractedType = queryParam?.definition.split(': ')[1] ?? 'never';

    expect(extractedType).toBe('GetUsersParams');
  });

  it('returns never when no query param exists', () => {
    const pathParamProp: GetterProp = {
      name: 'id',
      definition: 'id: string',
      implementation: 'id: string',
      default: false,
      required: true,
      type: GetterPropType.PARAM,
    };

    const props: GetterProp[] = [pathParamProp];
    const queryParam = props.find(
      (prop) => prop.type === GetterPropType.QUERY_PARAM,
    );
    const extractedType = queryParam?.definition.split(': ')[1] ?? 'never';

    expect(extractedType).toBe('never');
  });
});
