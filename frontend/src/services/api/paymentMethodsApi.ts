import { apiClient } from './client';
import { API_ENDPOINTS } from './endpoints';
import type { PaymentMethod } from '../../types/domain';

export const paymentMethodsApi = {
  list: async (): Promise<PaymentMethod[]> => {
    const res = await apiClient.get<PaymentMethod[]>(API_ENDPOINTS.PAYMENT_METHODS.BASE);
    return res.data;
  },
};
