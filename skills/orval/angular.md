# Angular Clients

## Angular Query

Signal-based reactivity with Angular's dependency injection:

```ts
output: {
  client: 'angular-query',
  httpClient: 'angular',
  mode: 'tags-split',
  override: {
    query: {
      useInvalidate: true,
      signal: true,
      runtimeValidation: true,    // Pipe responses through Zod validation
      mutationInvalidates: [
        {
          onMutations: ['createPets'],
          invalidates: ['listPets'],
        },
        {
          onMutations: ['deletePet', 'updatePet'],
          invalidates: [
            'listPets',
            { query: 'showPetById', params: ['petId'] },
          ],
        },
      ],
    },
  },
}
```

Generated injectable functions with signal reactivity:

```ts
// Inject query — re-executes when signal changes
export function injectShowPetById<TData = Pet, TError = unknown>(
  petId: string | (() => string),   // Accepts signal getters
  options?: { query?: Partial<CreateQueryOptions<Pet, TError, TData>> },
): CreateQueryResult<TData, TError> {
  const http = inject(HttpClient);
  const query = injectQuery(() => {
    const _petId = typeof petId === 'function' ? petId() : petId;
    return getShowPetByIdQueryOptions(http, _petId, options);
  });
  return query;
}

// Inject mutation
export const injectCreatePets = <TError = Error, TContext = unknown>(
  options?: { mutation?: CreateMutationOptions<...>; fetch?: RequestInit },
): CreateMutationResult<...> => {
  const http = inject(HttpClient);
  const queryClient = inject(QueryClient);
  return injectMutation(() => getCreatePetsMutationOptions(http, queryClient, options));
};
```

Usage in Angular components:

```ts
@Component({...})
export class PetDetailComponent {
  petId = signal('1');

  // Query re-executes when petId() changes
  pet = injectShowPetById(() => this.petId());

  // Dynamic enabled/disabled
  conditionalPet = injectShowPetById(
    () => this.petId(),
    () => ({ query: { enabled: this.isEnabled() } }),
  );

  // Mutation with auto-invalidation
  deletePet = injectDeletePet({
    mutation: {
      onSuccess: () => this.snackbar.open('Pet deleted!'),
    },
  });

  // Skip auto-invalidation for custom control
  customDelete = injectDeletePet({
    mutation: {
      onSuccess: () => {
        setTimeout(() => {
          this.queryClient.invalidateQueries({ queryKey: getListPetsQueryKey() });
        }, 700);
      },
    },
    skipInvalidation: true,
  });
}
```

### Zod Runtime Validation

When `runtimeValidation: true` and `schemas.type: 'zod'`:

```ts
output: {
  client: 'angular-query',
  httpClient: 'angular',
  schemas: { path: 'src/model', type: 'zod' },
  override: {
    query: { runtimeValidation: true },
  },
}
```

Generated code pipes through Zod:

```ts
const request$ = http.get<Pets>(url, { params: httpParams })
  .pipe(map(data => Pets.parse(data)));
```

## Angular (HttpClient)

Traditional Angular service generation:

```ts
output: {
  client: 'angular',
  mode: 'tags-split',
  mock: true,
  override: {
    angular: {
      provideIn: 'root',  // 'root' | 'any' | '' | false
    },
  },
}
```

Setting backend URL with interceptor:

```ts
@Injectable()
export class ApiInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<any>, next: HttpHandler) {
    const apiReq = req.clone({
      url: `https://api.example.com${req.url}`,
    });
    return next.handle(apiReq);
  }
}
```

## Angular Custom Mutator with HttpClient

```ts
// custom-client-with-error.ts
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';

export interface ExtendedServerErrorResponse<Error> extends HttpErrorResponse {
  error: Error | any | null;
}
export type ErrorType<Error> = ExtendedServerErrorResponse<Error>;

export const responseType = <Result>(
  { url, method, params, data, signal, responseType }: {
    url: string; method: string; params?: any; data?: any;
    headers?: any; signal?: AbortSignal;
    responseType?: 'arraybuffer' | 'blob' | 'json' | 'text';
  },
  http?: HttpClient,
): Promise<Result> => {
  if (!http) throw new Error('HttpClient is required.');
  return lastValueFrom(
    http.request<Result>(method, url, {
      params, body: data,
      responseType: (responseType ?? 'json') as 'json',
    }),
  );
};

export default responseType;
```
