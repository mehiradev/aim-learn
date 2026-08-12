import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import {
  executeMlCommand,
  generateApiKey,
  getMlState,
  getPromptApi,
  listMlCommands,
  requireApiKey,
  resetMlState,
  configureNetwork,
  trainModelApi,
  predictApi,
  simulateShotApi,
  listApiKeys,
  revokeApiKey,
  getShotLogs,
} from './ml.server';

export const getApiCommands = createServerFn({ method: 'GET' })
  .handler(async () => listMlCommands());

export const getApiKey = createServerFn({ method: 'POST' })
  .validator(
    z.object({ password: z.string().min(1) }),
  )
  .handler(async ({ data }) => {
    return { apiKey: await generateApiKey(data.password) };
  });

export const listApiKeysFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({ password: z.string().min(1) }),
  )
  .handler(async ({ data }) => {
    return { apiKeys: await listApiKeys(data.password) };
  });

export const revokeApiKeyFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({ key: z.string().min(1), password: z.string().min(1) }),
  )
  .handler(async ({ data }) => {
    return { revoked: await revokeApiKey(data.key, data.password) };
  });

export const getShotLogsFn = createServerFn({ method: 'GET' })
  .handler(async () => {
    await requireApiKey();
    return { logs: await getShotLogs() };
  });

export const getPromptApiFn = createServerFn({ method: 'GET' })
  .handler(async () => getPromptApi());

export const getState = createServerFn({ method: 'GET' })
  .validator(() => ({}))
  .handler(async () => {
    await requireApiKey();
    return getMlState();
  });

export const resetState = createServerFn({ method: 'POST' })
  .validator(() => ({}))
  .handler(async () => {
    await requireApiKey();
    return resetMlState();
  });

export const configureNetworkFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      hiddenLayers: z.array(z.number().int().min(1)).min(1),
      epochs: z.number().int().min(1).optional(),
    }),
  )
  .handler(async ({ data }) => {
    await requireApiKey();
    return configureNetwork(data);
  });

export const trainModelFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      modelId: z.enum(['deeprl', 'ridge', 'knn']),
      totalTrials: z.number().int().min(10),
      batches: z.number().int().min(1),
      env: z.object({
        gravity: z.number().positive(),
        power: z.number().min(0),
        airDrag: z.boolean(),
        dragCoefficient: z.number().min(0),
      }),
      mass: z.number().positive(),
      halfWidth: z.number().min(0),
      rlConfig: z
        .object({
          hiddenLayers: z.array(z.number().int().min(1)).optional(),
          epochs: z.number().int().min(1).optional(),
        })
        .optional(),
    }),
  )
  .handler(async ({ data }) => {
    await requireApiKey();
    return trainModelApi(data);
  });

export const predictFn = createServerFn({ method: 'POST' })
  .validator(z.object({ distance: z.number().min(0), mass: z.number().positive() }))
  .handler(async ({ data }) => {
    await requireApiKey();
    return predictApi(data);
  });

export const simulateShotFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      angleDeg: z.number().min(0).max(90),
      mass: z.number().positive(),
      env: z.object({
        gravity: z.number().positive(),
        power: z.number().min(0),
        airDrag: z.boolean(),
        dragCoefficient: z.number().min(0),
      }),
    }),
  )
  .handler(async ({ data }) => {
    await requireApiKey();
    return simulateShotApi(data);
  });

export const executeMlCommandFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      command: z.string().min(1),
      payload: z.any().optional(),
    }),
  )
  .handler(async ({ data }) => {
    await requireApiKey();
    return executeMlCommand(data.command, data.payload);
  });
