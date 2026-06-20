/**
 * Password hashing & verification (argon2id).
 * PIN hashing uses same primitive but shorter params for speed.
 */

import { hash, verify } from '@node-rs/argon2';
import type { Algorithm } from '@node-rs/argon2';

const PARAMS_PASSWORD = {
  algorithm: 2 /* Algorithm.Argon2id */ as Algorithm,
  memoryCost: 19456, // 19 MB
  timeCost: 2,
  parallelism: 1,
};

const PARAMS_PIN = {
  algorithm: 2 /* Algorithm.Argon2id */ as Algorithm,
  memoryCost: 4096, // 4 MB — PIN only, faster
  timeCost: 2,
  parallelism: 1,
};

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, PARAMS_PASSWORD);
}

export async function verifyPassword(plain: string, hashed: string): Promise<boolean> {
  try {
    return await verify(hashed, plain);
  } catch {
    return false;
  }
}

export async function hashPin(pin: string): Promise<string> {
  if (!/^\d{4,6}$/.test(pin)) {
    throw new Error('PIN must be 4-6 digits');
  }
  return hash(pin, PARAMS_PIN);
}

export async function verifyPin(pin: string, hashed: string): Promise<boolean> {
  if (!/^\d{4,6}$/.test(pin)) return false;
  return verifyPassword(pin, hashed);
}
