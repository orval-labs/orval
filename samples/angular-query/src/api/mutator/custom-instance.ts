import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { lastValueFrom } from 'rxjs';

const baseURL = ''; // use your own URL here or environment variable

export interface AngularRequestConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  params?: any;
  data?: any;
  headers?: any;
  signal?: AbortSignal;
  responseType?: string;
}

@Injectable({
  providedIn: 'root',
})
export class ApiHttpService {
  private http = inject(HttpClient);

  async request<T>(config: AngularRequestConfig, options?: any): Promise<T> {
    const { url, method, params, data, headers, signal } = config;

    let targetUrl = `${baseURL}${url}`;

    if (params) {
      targetUrl += '?' + new URLSearchParams(params);
    }

    // Prepare headers
    const httpHeaders = headers ? new HttpHeaders(headers) : undefined;

    const request$ = this.http.request<T>(method, targetUrl, {
      headers: httpHeaders,
      params,
      body: data,
      // Add signal for request cancellation support
      ...(signal && { signal }),
    });

    return lastValueFrom(request$);
  }
}

// Global service instance - this will be injected properly when used in Angular context
let apiHttpService: ApiHttpService | null = null;

// Function to set the service instance (called from Angular components/services)
export const setApiHttpService = (service: ApiHttpService) => {
  apiHttpService = service;
};

// Custom instance function that uses the injected service
export const customInstance = async <T>(
  config: AngularRequestConfig,
  options?: any,
): Promise<T> => {
  if (!apiHttpService) {
    // Try to inject the service if not already set
    try {
      apiHttpService = inject(ApiHttpService);
    } catch (error) {
      throw new Error(
        'ApiHttpService not available. Make sure to call setApiHttpService() or use within an Angular injection context.',
      );
    }
  }

  return apiHttpService.request<T>(config, options);
};

export default customInstance;
