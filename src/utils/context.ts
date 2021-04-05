import { OpenAPIObject } from 'openapi3-ts';
import { GeneratorSchema } from '../types/generator';

interface Context {
  rootSpec: string;
  transformer: (spec: OpenAPIObject) => OpenAPIObject;
  validation: boolean;
  specs: {
    [key: string]: {
      schemas: GeneratorSchema[];
      spec: OpenAPIObject;
      basePath: string;
    };
  };
}

let context = {
  specs: {},
} as Context;

export const enum ActionType {
  SET_ROOT_SPEC = 'set-root-spec',
  SET_TRANSFORMER = 'set-transformer',
  SET_VALIDATION = 'set-validation',
  INIT_SPEC = 'init-spec',
  ADD_SPEC_SCHEMAS = 'add-spec-schemas',
}

type Action =
  | {
      type: ActionType.SET_ROOT_SPEC;
      rootSpec: string;
    }
  | {
      type: ActionType.SET_TRANSFORMER;
      transformer: (spec: OpenAPIObject) => OpenAPIObject;
    }
  | {
      type: ActionType.SET_VALIDATION;
    }
  | {
      type: ActionType.INIT_SPEC;
      name: string;
      basePath: string;
      spec: OpenAPIObject;
    }
  | {
      type: ActionType.ADD_SPEC_SCHEMAS;
      name: string;
      schemas: GeneratorSchema[];
    };

const dispatch = (action: Action) => {
  switch (action.type) {
    case ActionType.SET_ROOT_SPEC: {
      context = {
        ...context,
        rootSpec: action.rootSpec,
      };
      break;
    }
    case ActionType.SET_TRANSFORMER: {
      context = {
        ...context,
        transformer: action.transformer,
      };
      break;
    }
    case ActionType.SET_VALIDATION: {
      context = {
        ...context,
        validation: true,
      };
      break;
    }
    case ActionType.INIT_SPEC: {
      context = {
        ...context,
        specs: {
          ...context.specs,
          [action.name]: {
            schemas: [],
            spec: action.spec,
            basePath: action.basePath,
          },
        },
      };
      break;
    }
    case ActionType.ADD_SPEC_SCHEMAS: {
      context = {
        ...context,
        specs: {
          ...context.specs,
          [action.name]: {
            ...context.specs[action.name],
            schemas: action.schemas,
          },
        },
      };
      break;
    }
    default:
      throw new Error('Action unknown');
  }
};

export const useContext = (): [Context, typeof dispatch] => {
  return [context, dispatch];
};
