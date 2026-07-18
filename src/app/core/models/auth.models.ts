export type UserRole = 'USER' | 'ADMIN' | 'MODERATOR';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token?: string;
}

export interface AuthUser {
  sub: string;
  email: string;
  role: UserRole;
  username?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatar?: string;
  status?: string;
  iat?: number;
  exp?: number;
}
