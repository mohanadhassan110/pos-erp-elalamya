import { apiClient, tokenStorage } from './client';
import { API_ENDPOINTS } from './endpoints';
import type { ApiHealthData } from '../../types/api';
import type { AuthResponseData, LoginCredentials, User } from '../../types/auth';

export const authApi = {
  async login(credentials: LoginCredentials): Promise<AuthResponseData> {
    const response = await apiClient.post<AuthResponseData>(API_ENDPOINTS.AUTH.LOGIN, credentials);
    if (response.data?.token) {
      tokenStorage.set(response.data.token);
    }
    return response.data;
  },

  async logout(): Promise<void> {
    try {
      await apiClient.post(API_ENDPOINTS.AUTH.LOGOUT);
    } finally {
      tokenStorage.clear();
    }
  },

  async getMe(): Promise<User> {
    const response = await apiClient.get<User>(API_ENDPOINTS.AUTH.ME);
    return response.data;
  },

  async getHealth(): Promise<ApiHealthData> {
    const response = await apiClient.get<ApiHealthData>(API_ENDPOINTS.HEALTH);
    return response.data;
  },

  async checkOwnerAccess(): Promise<{ access: string; role: string }> {
    const response = await apiClient.get<{ access: string; role: string }>(API_ENDPOINTS.SYSTEM.OWNER_CHECK);
    return response.data;
  },

  async checkCashierAccess(): Promise<{ access: string; role: string }> {
    const response = await apiClient.get<{ access: string; role: string }>(API_ENDPOINTS.SYSTEM.CASHIER_CHECK);
    return response.data;
  },
};
