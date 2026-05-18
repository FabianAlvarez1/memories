// =========================================================
// AUTH / USER Types
// =========================================================

export interface User {
  id: string;
  username: string;
  created_at: string;
}

export interface UserRow {
  id: string;
  username: string;
  password_hash: string;  // bcrypt hash
  salt: string;           // PBKDF2 salt (base64)
  created_at: string;
  updated_at: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  cryptoKey: CryptoKey | null;  // AES-256-GCM key (in-memory only)
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegisterCredentials extends LoginCredentials {
  confirmPassword: string;
}
