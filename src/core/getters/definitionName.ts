import {camel} from 'case';

export const getApiDefinitionName = (operationId: string) => camel(operationId);
