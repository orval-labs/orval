export * from './health/health.service';
export * from './pets/pets.service';
export type {
  OrvalHttpResourceOptions,
  OrvalHttpResourceRequestExtension,
  ResolvedResourceState,
  ResourceState,
} from './health/health.resource';
export {
  applyOrvalRequestExtension,
  toResourceState,
} from './health/health.resource';
export * from './health/health.resource';
export * from './pets/pets.resource';
