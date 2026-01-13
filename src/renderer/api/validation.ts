/**
 * API Response Validation Utilities
 *
 * Helper functions for validating API responses with Zod schemas
 */

import { z } from 'zod';
import type { IpcResponse } from '@shared/types';
import { IpcResponseSchema } from './schemas';

/**
 * Validates an IPC response against a Zod schema
 * @param response - The IPC response to validate
 * @param schema - The Zod schema for the response data
 * @returns The validated and typed response
 * @throws ZodError if validation fails
 */
export function validateResponse<T>(
  response: unknown,
  schema: z.ZodType<any>,
): IpcResponse<T> {
  const ipcSchema = IpcResponseSchema(schema);
  return ipcSchema.parse(response) as IpcResponse<T>;
}

/**
 * Validates an IPC response and returns only the data if successful
 * @param response - The IPC response to validate
 * @param schema - The Zod schema for the response data
 * @returns The validated data
 * @throws Error if response is not successful or validation fails
 */
export function validateAndExtractData<T>(
  response: unknown,
  schema: z.ZodType<any>,
): T {
  const validated = validateResponse<T>(response, schema);

  if (!validated.success) {
    throw new Error(
      `API call failed: ${validated.error?.message || 'Unknown error'}`,
    );
  }

  if (validated.data === undefined) {
    throw new Error('API call succeeded but returned no data');
  }

  return validated.data as T;
}

/**
 * Creates a validated API function wrapper
 * @param apiFunction - The async API function to wrap
 * @param schema - The Zod schema for the response data
 * @returns A wrapped function that validates responses
 */
export function createValidatedAPI<TArgs extends any[], TData>(
  apiFunction: (...args: TArgs) => Promise<IpcResponse<TData>>,
  schema: z.ZodType<TData>,
) {
  return async (...args: TArgs): Promise<IpcResponse<TData>> => {
    const response = await apiFunction(...args);
    return validateResponse(response, schema);
  };
}
