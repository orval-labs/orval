import {
  GetterBody,
  GetterParams,
  GetterProps,
  GetterQueryParam,
  GetterResponse,
} from './getters';
import {
  ContextSpecs,
  OperationOptions,
  OutputClient,
  OverrideOutput,
  Verbs,
} from './index';

export type GeneratorSchema = {
  name: string;
  model: string;
  imports: GeneratorImport[];
};

export type GeneratorImport = {
  name: string;
  schemaName?: string;
  alias?: string;
  specKey?: string;
  default?: boolean;
  values?: boolean;
};

export type GeneratorDependency = {
  exports: GeneratorImport[];
  dependency: string;
};

export type GeneratorApiResponse = {
  operations: GeneratorOperations;
  schemas: GeneratorSchema[];
};

export type GeneratorOperations = {
  [operationId: string]: GeneratorOperation;
};

export type GeneratorTarget = {
  imports: GeneratorImport[];
  implementation: string;
  implementationMSW: string;
  importsMSW: GeneratorImport[];
  mutators?: GeneratorMutator[];
  formData?: GeneratorMutator[];
};

export type GeneratorTargetFull = {
  imports: GeneratorImport[];
  implementation: string;
  implementationMSW: {
    function: string;
    handler: string;
  };
  importsMSW: GeneratorImport[];
  mutators?: GeneratorMutator[];
  formData?: GeneratorMutator[];
};

export type GeneratorOperation = {
  imports: GeneratorImport[];
  implementation: string;
  implementationMSW: { function: string; handler: string };
  importsMSW: GeneratorImport[];
  tags: string[];
  mutator?: GeneratorMutator;
  formData?: GeneratorMutator;
  operationName: string;
};

export type GeneratorVerbOptions = {
  verb: Verbs;
  summary?: string;
  tags: string[];
  operationId: string;
  operationName: string;
  response: GetterResponse;
  body: GetterBody;
  queryParams?: GetterQueryParam;
  params: GetterParams;
  props: GetterProps;
  mutator?: GeneratorMutator;
  formData?: GeneratorMutator;
  override?: OperationOptions | undefined;
};

export type GeneratorVerbsOptions = GeneratorVerbOptions[];

export type GeneratorOptions = {
  route: string;
  pathRoute: string;
  override: OverrideOutput;
  context: ContextSpecs;
  mock: boolean;
};

export type GeneratorClient = {
  implementation: string;
  imports: GeneratorImport[];
};

export type GeneratorClientExtra = {
  implementation: string;
  implementationMSW: string;
};

export type GeneratorMutator = {
  name: string;
  path: string;
  default: boolean;
  mutatorFn: Function;
};

export type ClientBuilder = (
  verbOptions: GeneratorVerbOptions,
  options: GeneratorOptions,
) => GeneratorClient;

export type ClientHeaderBuilder = (params: {
  title: string;
  isRequestOptions: boolean;
  isMutator: boolean;
  noFunction?: boolean;
  isGlobalMutator: boolean;
  provideInRoot: boolean;
}) => string;

export type ClientFooterBuilder = (operationIds?: string[]) => string;

export type ClientTitleBuilder = (title: string) => string;

export type ClientDependenciesBuilder = () => GeneratorDependency[];

export type ClientMSWBuilder = (
  verbOptions: GeneratorVerbOptions,
  generatorOptions: GeneratorOptions,
) => {
  imports: string[];
  implementation: string;
};

export interface ClientGeneratorsBuilder {
  client: ClientBuilder;
  header: ClientHeaderBuilder;
  dependencies: ClientDependenciesBuilder;
  footer: ClientFooterBuilder;
  title: ClientTitleBuilder;
}

export type GeneratorClients = Record<OutputClient, ClientGeneratorsBuilder>;
