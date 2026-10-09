import { ApiError } from '../../types/api';
import type { ApiResponse } from '../../types/api';

const TOKEN_KEY = 'elalamya_auth_token';

export const tokenStorage = {
  get: (): string | null => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (token: string): void => {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      // Ignored in restricted environments
    }
  },
  clear: (): void => {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      // Ignored
    }
  },
};

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined | null>;
}

class ApiClient {
  private baseUrl: string;

  constructor() {
    const rawUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://localhost:8000/api/v1';
    // Remove trailing slash if present
    this.baseUrl = rawUrl.replace(/\/+$/, '');
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  public setBaseUrl(url: string): void {
    this.baseUrl = url.replace(/\/+$/, '');
  }

  private buildUrl(path: string, params?: RequestOptions['params']): string {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const url = new URL(`${this.baseUrl}${cleanPath}`);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    return url.toString();
  }

  public async request<T = unknown>(path: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    const { params, headers: customHeaders, ...fetchOptions } = options;
    const url = this.buildUrl(path, params);

    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...((customHeaders as Record<string, string>) || {}),
    };

    const token = tokenStorage.get();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    let response: Response;
    try {
      response = await fetch(url, {
        ...fetchOptions,
        headers,
      });
    } catch {
      throw new ApiError(
        'تعذر الاتصال بالخادم، يرجى التحقق من اتصال الشبكة أو تشغيل الخادم الخلفي',
        0,
        'NETWORK_ERROR'
      );
    }

    let responseData: ApiResponse<T> | null = null;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      try {
        responseData = (await response.json()) as ApiResponse<T>;
      } catch {
        responseData = null;
      }
    }

    // Handle 401 Unauthorized
    if (response.status === 401) {
      tokenStorage.clear();
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
      const msg = responseData?.message || 'انتهت صلاحية الجلسة، يرجى تسجيل الدخول مجدداً';
      throw new ApiError(msg, 401, responseData?.code || 'UNAUTHORIZED');
    }

    // Handle other errors (4xx, 5xx)
    if (!response.ok) {
      const msg = responseData?.message || `فشل الطلب مع رمز الحالة (${response.status})`;
      throw new ApiError(msg, response.status, responseData?.code, responseData?.errors);
    }

    // In case server returned 204 No Content
    if (!responseData) {
      return {
        success: true,
        data: null as T,
        message: null,
      };
    }

    return responseData;
  }

  public get<T>(path: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>(path, { ...options, method: 'GET' });
  }

  public post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>(path, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  public put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>(path, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  public patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>(path, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  public delete<T>(path: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>(path, { ...options, method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
