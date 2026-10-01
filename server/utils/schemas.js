import { z } from 'zod';

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
export const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD');
export const paise = z.coerce.number().int('Amount must be a whole number of paise').min(0);
export const phone = z
  .string()
  .trim()
  .regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number');

export const yearNum = z.coerce.number().int().min(2000).max(2100);
export const monthNum = z.coerce.number().int().min(1).max(12);

export const idParam = z.object({ id: objectId });
export const monthQuery = z.object({ year: yearNum, month: monthNum });

export const pageQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});
