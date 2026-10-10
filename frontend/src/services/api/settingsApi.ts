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
    const res = await apiClient.get<ShowroomSettings>('/settings/showroom');
    return res.data;
  },

  updateShowroom: async (
    payload: UpdateShowroomSettingsDto
  ): Promise<{ message: string; data: ShowroomSettings }> => {
    const res = await apiClient.put<ShowroomSettings>(
      '/settings/showroom',
      payload
    );
    return {
      message: res.message || 'تم حفظ الإعدادات بنجاح',
      data: res.data,
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
