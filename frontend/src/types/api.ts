export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  message: string | null;
  code?: string;
  errors?: Record<string, string[]>;
}

export interface ApiHealthData {
  status: string;
  system: string;
  version: string;
  api_version: string;
  locale: string;
  timezone: string;
  server_time: string;
  database: string;
}

export class ApiError extends Error {
  public status: number;
  public code?: string;
  public errors?: Record<string, string[]>;

  constructor(message: string, status: number, code?: string, errors?: Record<string, string[]>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.errors = errors;
  }
}
