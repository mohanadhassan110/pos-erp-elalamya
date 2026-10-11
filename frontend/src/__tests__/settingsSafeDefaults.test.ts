import { describe, it, expect, vi, beforeEach } from 'vitest';
import { settingsApi } from '../services/api/settingsApi';
import { apiClient } from '../services/api/client';
import { mapErrorMessage } from '../utils/errorMapper';
import { ApiError } from '../types/api';

describe('Settings Safe Defaults & Crash Prevention (Task 2)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('safely handles direct response without data wrapper (prevents Cannot read properties of undefined)', async () => {
    // Simulate backend returning the object directly at root
    const mockDirectResponse = {
      showroom_name: 'معرض العالمية للمفروشات',
      phones: null,
      address: null,
      tagline: null,
      return_policy: null,
      thank_you_line: null,
    };

    vi.spyOn(apiClient, 'get').mockResolvedValueOnce(mockDirectResponse as any);

    const result = await settingsApi.getShowroom();

    expect(result).toBeDefined();
    expect(result.showroom_name).toBe('معرض العالمية للمفروشات');
    expect(result.phones).toBeNull();
    expect(result.address).toBeNull();
  });

  it('safely handles wrapped response with { data: ... }', async () => {
    const mockWrappedResponse = {
      success: true,
      message: 'OK',
      data: {
        showroom_name: 'معرض العالمية للمفروشات',
        phones: '01003116622 - 01010498956',
        address: 'شارع مسجد النجار المتفرع من شارع بورسعيد، أمام عمارة قيبع بالمنصورة',
        tagline: 'بيت المفروشات',
        return_policy: 'الاسترجاع والاستبدال خلال 14 يومًا من تاريخ الفاتورة',
        thank_you_line: 'شكراً لتعاملكم مع معرض العالمية للمفروشات',
      },
    };

    vi.spyOn(apiClient, 'get').mockResolvedValueOnce(mockWrappedResponse as any);

    const result = await settingsApi.getShowroom();

    expect(result).toBeDefined();
    expect(result.showroom_name).toBe('معرض العالمية للمفروشات');
    expect(result.phones).toBe('01003116622 - 01010498956');
    expect(result.address).toBe('شارع مسجد النجار المتفرع من شارع بورسعيد، أمام عمارة قيبع بالمنصورة');
  });

  it('safely handles empty or null settings response with defaults', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValueOnce(null as any);

    const result = await settingsApi.getShowroom();

    expect(result).toBeDefined();
    expect(result.showroom_name).toBe('معرض العالمية للمفروشات');
    expect(result.phones).toBeNull();
    expect(result.address).toBeNull();
  });

  it('global error mapper converts English runtime TypeError to friendly Arabic message', () => {
    const typeError = new TypeError("Cannot read properties of undefined (reading 'phones')");
    const mapped = mapErrorMessage(typeError);

    expect(mapped).not.toContain('Cannot read');
    expect(mapped).not.toContain('undefined');
    expect(mapped).toBe('تعذر تحميل أو قراءة بعض البيانات، يرجى تحديث الصفحة والمحاولة ثانية');
  });

  it('global error mapper converts NetworkError to friendly Arabic message', () => {
    const netError = new Error('Failed to fetch');
    const mapped = mapErrorMessage(netError);

    expect(mapped).toBe('تعذر الاتصال بالخادم، يرجى التحقق من اتصال الشبكة وتشغيل الخادم');
  });

  it('global error mapper converts 403 ApiError to friendly Arabic message', () => {
    const authError = new ApiError('Unauthorized', 403, 'FORBIDDEN');
    const mapped = mapErrorMessage(authError);

    expect(mapped).toBe('غير مصرح لك بإجراء هذه العملية');
  });
});
