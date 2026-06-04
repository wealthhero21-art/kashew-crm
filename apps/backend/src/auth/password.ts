// Password hashing using Node's built-in scrypt (no extra deps).
// Stored format: "scrypt:<saltHex>:<keyHex>" — versioned so we can evolve.

import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: string,
  keylen: number,
) => Promise<Buffer>;

const KEY_LEN = 64;

export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const key = await scryptAsync(plain, salt, KEY_LEN);
  return `scrypt:${salt}:${key.toString('hex')}`;
}

export async function verifyPassword(plain: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const parts = stored.split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, hashHex] = parts;
  const expected = Buffer.from(hashHex, 'hex');
  if (expected.length !== KEY_LEN) return false;
  const actual = await scryptAsync(plain, salt, KEY_LEN);
  return timingSafeEqual(expected, actual);
}

// Mask phone for the UI confirmation between login and OTP entry: keep last 4 digits.
export function maskPhone(phoneE164: string): string {
  if (phoneE164.length <= 4) return phoneE164;
  const last = phoneE164.slice(-4);
  return phoneE164.slice(0, -4).replace(/\d/g, '•') + last;
}
