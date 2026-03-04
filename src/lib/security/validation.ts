/**
 * Input validation schemas using Zod.
 * Solana-only: validates base58 public keys and .sol domain names.
 */

import { z } from 'zod';
import { SOLANA_ADDRESS_REGEX, SOL_DOMAIN_REGEX } from '@/lib/solana/constants';

/**
 * Validate Solana wallet address (base58 pubkey) or .sol domain name.
 */
export const walletAddressSchema = z
  .string()
  .trim()
  .min(1, 'Please enter a wallet address or .sol name')
  .refine(
    (val) => {
      // Solana base58 address (32-44 chars)
      if (SOLANA_ADDRESS_REGEX.test(val)) return true;
      // .sol domain
      if (SOL_DOMAIN_REGEX.test(val)) return true;
      return false;
    },
    { message: 'Invalid Solana address or .sol name.' }
  );

export const chatMessageSchema = z.object({
  message: z.string().min(1).max(4000),
  mode: z.enum(['market', 'coach']),
  walletAddress: z.string().optional(),
});

export const timeWindowSchema = z.union([
  z.literal(1),
  z.literal(7),
  z.literal(30),
  z.literal(90),
  z.literal(180),
  z.literal(365),
]);

export const tradingRuleSchema = z.object({
  id: z.string().optional(),
  label: z.string().min(1).max(100),
  type: z.enum(['max_daily_loss', 'max_trades_per_day', 'cooldown_after_loss', 'max_position_size', 'custom']),
  value: z.number().positive(),
  unit: z.string(),
  enabled: z.boolean(),
});

/**
 * Sanitize user input: strip potential XSS/injection.
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/<[^>]*>/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .trim();
}

/**
 * Safe error message (no internal details in production).
 */
export function safeErrorMessage(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.issues.map(i => i.message).join(', ');
  }
  if (error instanceof Error) {
    if (process.env.NODE_ENV === 'production') {
      return 'An error occurred. Please try again.';
    }
    return error.message;
  }
  return 'Unknown error';
}
