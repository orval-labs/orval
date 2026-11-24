export interface NormalizedAxiosOptions {
  includeHttpResponseReturnType: boolean;
}

export interface AxiosOptions {
  /**
   * Include the HTTP status in the return type so it discriminates the
   * response data type.
   *
   * @default false
   */
  includeHttpResponseReturnType?: boolean;
}
