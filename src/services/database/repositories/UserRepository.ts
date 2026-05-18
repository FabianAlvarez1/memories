// =========================================================
// USER REPOSITORY
// =========================================================

import { db } from '../connection';
import { hashPassword, generateSalt, deriveKey } from '../../crypto/keyDerivation';
import type { UserRow, User } from '@/types/auth';
import { v4 as uuidv4 } from 'uuid';

export const UserRepository = {
  /**
   * Check if any user exists (first-run detection)
   */
  async hasUser(): Promise<boolean> {
    const users = await db.getAll<UserRow>('user');
    return users.length > 0;
  },

  /**
   * Get the single local user
   */
  async getUser(): Promise<UserRow | undefined> {
    const users = await db.getAll<UserRow>('user');
    return users[0];
  },

  /**
   * Register a new user (first time setup)
   */
  async register(username: string, password: string): Promise<{ user: User; salt: string }> {
    const existingUsers = await db.getAll<UserRow>('user');
    if (existingUsers.length > 0) {
      throw new Error('Ya existe un usuario registrado en este dispositivo.');
    }

    const salt = generateSalt();
    const passwordHash = await hashPassword(password + salt); // salt-stretched hash
    const now = new Date().toISOString();
    const id = uuidv4();

    const row: UserRow = {
      id,
      username,
      password_hash: passwordHash,
      salt,
      created_at: now,
      updated_at: now,
    };

    await db.put('user', row);

    return {
      user: { id, username, created_at: now },
      salt,
    };
  },

  /**
   * Verify password and return CryptoKey if valid
   */
  async login(password: string): Promise<{ user: User; cryptoKey: CryptoKey; salt: string } | null> {
    const row = await this.getUser();
    if (!row) return null;

    const expectedHash = await hashPassword(password + row.salt);
    if (expectedHash !== row.password_hash) return null;

    // Derive the encryption key from the verified password
    const cryptoKey = await deriveKey(password, row.salt);

    return {
      user: { id: row.id, username: row.username, created_at: row.created_at },
      cryptoKey,
      salt: row.salt,
    };
  },
};
