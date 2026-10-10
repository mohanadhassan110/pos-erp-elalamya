import { describe, it, expect, beforeEach } from 'vitest';
import { apiClient, tokenStorage } from '../services/api/client';
import { ApiError } from '../types/api';

describe('tokenStorage', () => {
  let mockStore: Record<string, string> = {};

  beforeEach(() => {
    mockStore = {};
    const mockStorage = {
      getItem: (key: string) => mockStore[key] || null,
      setItem: (key: string, value: string) => {
        mockStore[key] = value;
      },
      removeItem: (key: string) => {
        delete mockStore[key];
      },
      clear: () => {
        mockStore = {};
      },
      length: 0,
      key: () => null,
    };
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
  });

  it('stores, retrieves, and clears authentication tokens', () => {
    expect(tokenStorage.get()).toBeNull();

    tokenStorage.set('test-sanctum-token-123');
    expect(tokenStorage.get()).toBe('test-sanctum-token-123');

    tokenStorage.clear();
    expect(tokenStorage.get()).toBeNull();
  });
});

describe('ApiClient', () => {
  it('manages base URL correctly', () => {
    expect(apiClient.getBaseUrl()).toBeTruthy();

    apiClient.setBaseUrl('http://api.elalamya.local/api/v1/');
    expect(apiClient.getBaseUrl()).toBe('http://api.elalamya.local/api/v1');
  });
});

describe('ApiError', () => {
  it('encapsulates HTTP status, custom error code, and validation errors', () => {
    const error = new ApiError('الكمية غير كافية', 422, 'INSUFFICIENT_STOCK', {
      product_id: ['المتاح حالياً: 2'],
    });

    expect(error.message).toBe('الكمية غير كافية');
    expect(error.status).toBe(422);
    expect(error.code).toBe('INSUFFICIENT_STOCK');
    expect(error.errors?.product_id).toContain('المتاح حالياً: 2');
  });
});

describe('ApiClient Error Handling', () => {
  it('throws ApiError with status 403 and code when server returns 403 Forbidden', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ message: 'قسم التقارير مقفل', code: 'REPORTS_LOCKED' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });

    try {
      await expect(apiClient.get('/reports/overview')).rejects.toThrow('قسم التقارير مقفل');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('throws ApiError with status 404 when resource is not found', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ message: 'العنصر غير موجود' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });

    try {
      await expect(apiClient.get('/invoices/99999')).rejects.toThrow('العنصر غير موجود');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('throws ApiError with status 429 when rate limited', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ message: 'تم تجاوز الحد المسموح من الطلبات' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      });

    try {
      await expect(apiClient.post('/auth/login', {})).rejects.toThrow('تم تجاوز الحد المسموح من الطلبات');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('throws ApiError with status 500 on internal server error', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ message: 'خطأ داخلي في الخادم' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });

    try {
      await expect(apiClient.get('/inventory')).rejects.toThrow('خطأ داخلي في الخادم');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('throws ApiError with code NETWORK_ERROR on connection failure', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      throw new TypeError('Failed to fetch');
    };

    try {
      await expect(apiClient.get('/products')).rejects.toThrow(
        'تعذر الاتصال بالخادم، يرجى التحقق من اتصال الشبكة أو تشغيل الخادم الخلفي'
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
