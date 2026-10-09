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
