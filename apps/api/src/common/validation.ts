import { BadRequestException } from '@nestjs/common';
import { z, ZodTypeAny } from 'zod';

/** Validates with a shared zod schema; returns per-field errors the form can highlight. */
export function parseOrThrow<S extends ZodTypeAny>(schema: S, data: unknown): z.output<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new BadRequestException({
      message: 'Dữ liệu không hợp lệ',
      errors: result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    });
  }
  return result.data;
}
