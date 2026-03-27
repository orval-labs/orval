import { catchError, map, Observable, of, startWith } from 'rxjs';

export type LoadState<T> =
  | { status: 'loading'; data: T; error?: undefined }
  | { status: 'success'; data: T; error?: undefined }
  | { status: 'error'; data: T; error: string };

export function toLoadState<T>(
  source: Observable<T>,
  initialValue: T,
): Observable<LoadState<T>> {
  return source.pipe(
    map((data) => ({ status: 'success', data }) as LoadState<T>),
    startWith({ status: 'loading', data: initialValue } as LoadState<T>),
    catchError((error: unknown) =>
      of({
        status: 'error',
        data: initialValue,
        error: error instanceof Error ? error.message : 'Unknown error',
      } as LoadState<T>),
    ),
  );
}
