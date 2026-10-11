import { apiClient } from './client';

export interface ShowroomSettings {
  showroom_name: string;
  phones: string | null;
  address: string | null;
  tagline: string | null;
  return_policy: string | null;
  thank_you_line: string | null;
}

export interface UpdateShowroomSettingsDto {
  phones?: string;
  address?: string;
  tagline?: string;
  return_policy?: string;
  thank_you_line?: string;
}

export const settingsApi = {
  getShowroom: async (): Promise<ShowroomSettings> => {
    const res = (await apiClient.get<unknown>('/settings/showroom')) as unknown as Record<string, unknown> | null;
    const actual = (res && typeof res === 'object' && 'data' in res && res.data && typeof res.data === 'object')
      ? (res.data as Record<string, unknown>)
      : (res || {});

    return {
      showroom_name: (actual.showroom_name as string) || 'معرض العالمية للمفروشات',
      phones: (actual.phones as string) || null,
      address: (actual.address as string) || null,
      tagline: (actual.tagline as string) || null,
      return_policy: (actual.return_policy as string) || null,
      thank_you_line: (actual.thank_you_line as string) || null,
    };
  },

  updateShowroom: async (
    payload: UpdateShowroomSettingsDto
  ): Promise<{ message: string; data: ShowroomSettings }> => {
    const res = (await apiClient.put<unknown>('/settings/showroom', payload)) as unknown as Record<string, unknown>;
    const actual = (res && typeof res === 'object' && 'data' in res && res.data && typeof res.data === 'object')
      ? (res.data as Record<string, unknown>)
      : (res || {});

    return {
      message: (res?.message as string) || 'تم حفظ بيانات المعرض بنجاح',
      data: {
        showroom_name: (actual.showroom_name as string) || 'معرض العالمية للمفروشات',
        phones: (actual.phones as string) || null,
        address: (actual.address as string) || null,
        tagline: (actual.tagline as string) || null,
        return_policy: (actual.return_policy as string) || null,
        thank_you_line: (actual.thank_you_line as string) || null,
      },
    };
  },

  setReportsPassword: async (password: string): Promise<{ message: string }> => {
    const res = await apiClient.post<{ message?: string }>('/reports/password', { password });
    return {
      message: res.message || 'تم تعيين كلمة مرور التقارير بنجاح',
    };
  },

  getHealth: async (): Promise<{
    status: string;
    database: string;
    api_version: string;
    timezone: string;
    locale: string;
  }> => {
    const res = await apiClient.get<{
      status: string;
      database: string;
      api_version: string;
      timezone: string;
      locale: string;
    }>('/health');
    return res.data;
  },
};
