/**
 * Verification code generator (HEKAS-XXXXXX).
 * Phase 4.
 */

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I

export function generateCode(length = 6): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}

export function generateHekasLinkCode(): string {
  return `HEKAS-${generateCode(6)}`;
}

export function generateDocumentNumber(prefix: string, outletShortCode: string, seq: number): string {
  const padded = String(seq).padStart(5, '0');
  return `${prefix}/${outletShortCode}/${padded}`;
}