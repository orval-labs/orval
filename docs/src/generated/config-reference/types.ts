export interface ResolvedField {
  name: string;
  type: string;
  optional: boolean;
  description?: string;
}

export interface ResolvedShape {
  typeName: string;
  source: 'local' | '@scalar/openapi-types' | string;
  specUrl?: string;
  fields: ResolvedField[];
}

export interface CallbackParam {
  name: string;
  type: string;
  resolved?: ResolvedShape;
}

export interface CallbackSignature {
  params: CallbackParam[];
  returnType: string;
}

export interface ConfigField {
  kind?: 'field';
  name: string;
  type: string;
  optional: boolean;
  description?: string;
  default?: string;
  example?: string;
  see?: string[];
  callback?: CallbackSignature;
}

export interface ConfigSection {
  kind?: 'section';
  section: string;
  interfaceName: string;
  description?: string;
  fields: ConfigField[];
}

export type RegistryEntry =
  | ({ kind: 'section' } & ConfigSection)
  | ({ kind: 'field' } & ConfigField);
