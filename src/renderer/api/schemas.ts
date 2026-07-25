/**
 * Renderer compatibility barrel.
 *
 * Wire schemas live under src/shared so both Electron processes have one
 * schema authority. Renderer APIs import this barrel while features migrate
 * to direct shared imports.
 */
export * from '@shared/schemas/apiResponses';
export * from '@shared/schemas/featureResponses';
