export type UserRole = 'owner' | 'cashier';

export interface UserCapabilities {
  reports_view: boolean;
  settings_manage: boolean;
  users_manage: boolean;
  audit_view: boolean;
  pos_operate: boolean;
  catalog_manage: boolean;
  inventory_manage: boolean;
  customers_manage: boolean;
  suppliers_manage: boolean;
  expenses_manage: boolean;
}

export interface User {
  id: number;
  name: string;
  username: string;
  email: string;
  role: UserRole;
  role_label: string;
  is_active: boolean;
  capabilities: UserCapabilities;
  created_at?: string;
}

export interface LoginCredentials {
  login: string;
  password: string;
  device_name?: string;
}

export interface AuthResponseData {
  user: User;
  token: string;
}
