import crypto from 'crypto';
import { getRequestHeader } from '@tanstack/react-start/server';
import { simulateShot, type Environment } from '../ballistics/physics';
import type { ModelId, RlConfig } from '../ml/registry';
import { trainModel, type TrainedModel } from '../ml/training';
import type { Prediction } from '../ml/types';
import { fetchShotLogs } from '../logging/shot-log';

export const API_PASSWORD = 'Ilian2008';

export interface ApiKeyRecord {
  key: string;
  createdAt: string;
  revoked: boolean;
}

const apiKeyStore: ApiKeyRecord[] = [];

function buildApiKey(): string {
  return crypto.randomBytes(24).toString('hex');
}

export function generateApiKey(password: string): string {
  if (password !== API_PASSWORD) {
    throw new Error('Unauthorized: invalid password');
  }

  const apiKey = buildApiKey();
  apiKeyStore.push({ key: apiKey, createdAt: new Date().toISOString(), revoked: false });
  return apiKey;
}

export function requireApiKey(): void {
  const authHeader = getRequestHeader('Authorization') ?? getRequestHeader('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

  const keyRecord = token ? apiKeyStore.find((record) => record.key === token) : undefined;
  if (!token || !keyRecord || keyRecord.revoked) {
    throw new Error('Unauthorized: API key missing, invalid or revoked');
  }
}

export function listApiKeys(password: string): ApiKeyRecord[] {
  if (password !== API_PASSWORD) {
    throw new Error('Unauthorized: invalid password');
  }
  return apiKeyStore.map((record) => ({ ...record }));
}

export function revokeApiKey(key: string, password: string): ApiKeyRecord {
  if (password !== API_PASSWORD) {
    throw new Error('Unauthorized: invalid password');
  }

  const record = apiKeyStore.find((item) => item.key === key);
  if (!record) {
    throw new Error('NotFound: api key not found');
  }
  record.revoked = true;
  return record;
}

export function getShotLogs(limit = 50) {
  return fetchShotLogs(limit);
}

export interface TrainModelOptions {
  modelId: ModelId;
  totalTrials: number;
  batches: number;
  env: Environment;
  mass: number;
  halfWidth: number;
  rlConfig?: RlConfig;
}

export interface PredictOptions {
  distance: number;
  mass: number;
}

export interface SimulateShotOptions {
  angleDeg: number;
  mass: number;
  env: Environment;
}

export interface ConfigureNetworkOptions {
  hiddenLayers: number[];
  epochs?: number;
}

export interface MlState {
  lastModel: TrainedModel | null;
  networkConfig: RlConfig | null;
  lastCommand: string | null;
}

const state: MlState = {
  lastModel: null,
  networkConfig: null,
  lastCommand: null,
};

export function getMlState(): MlState {
  return {
    lastModel: state.lastModel,
    networkConfig: state.networkConfig,
    lastCommand: state.lastCommand,
  };
}

export function resetMlState(): MlState {
  state.lastModel = null;
  state.networkConfig = null;
  state.lastCommand = 'resetState';
  return getMlState();
}

export function configureNetwork(options: ConfigureNetworkOptions): MlState {
  state.networkConfig = {
    hiddenLayers: options.hiddenLayers.map((n) => Math.max(1, Math.round(n))),
    epochs: options.epochs ?? 120,
  };
  state.lastCommand = 'configureNetwork';
  return getMlState();
}

export async function trainModelApi(options: TrainModelOptions): Promise<TrainedModel> {
  const rlConfig = options.rlConfig ?? state.networkConfig ?? undefined;
  const trained = await trainModel({
    modelId: options.modelId,
    totalTrials: options.totalTrials,
    batches: options.batches,
    env: options.env,
    mass: options.mass,
    halfWidth: options.halfWidth,
    rlConfig,
  });

  state.lastModel = trained;
  state.lastCommand = 'trainModel';
  return trained;
}

export function predictApi(options: PredictOptions): Prediction {
  if (!state.lastModel || !state.lastModel.model.isTrained()) {
    throw new Error('Model unavailable: train the model first.');
  }
  state.lastCommand = 'predict';
  return state.lastModel.model.predict([options.distance, options.mass]);
}

export function simulateShotApi(options: SimulateShotOptions) {
  state.lastCommand = 'simulateShot';
  return simulateShot({ angleDeg: options.angleDeg, mass: options.mass }, options.env);
}

export async function executeMlCommand(command: string, payload?: unknown) {
  switch (command) {
    case 'generateApiKey':
      if (!payload || typeof payload !== 'object' || !('password' in payload)) {
        throw new Error('generateApiKey requires { password: string }');
      }
      return generateApiKey((payload as { password: string }).password);
    case 'configureNetwork':
      if (!payload || typeof payload !== 'object') {
        throw new Error('configureNetwork requires configuration payload');
      }
      return configureNetwork(payload as ConfigureNetworkOptions);
    case 'trainModel':
      if (!payload || typeof payload !== 'object') {
        throw new Error('trainModel requires training options');
      }
      return await trainModelApi(payload as TrainModelOptions);
    case 'predict':
      if (!payload || typeof payload !== 'object') {
        throw new Error('predict requires { distance: number; mass: number }');
      }
      return predictApi(payload as PredictOptions);
    case 'simulateShot':
      if (!payload || typeof payload !== 'object') {
        throw new Error('simulateShot requires simulation options');
      }
      return simulateShotApi(payload as SimulateShotOptions);
    case 'getState':
      return getMlState();
    case 'resetState':
      return resetMlState();
    case 'listCommands':
      return listMlCommands();
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

export function listMlCommands() {
  return {
    commands: [
      'generateApiKey',
      'configureNetwork',
      'trainModel',
      'predict',
      'simulateShot',
      'getState',
      'resetState',
      'listCommands',
      'executeMlCommand',
    ],
    description:
      'Utilisez generateApiKey pour obtenir la clé API avec le mot de passe secret. Les commandes protégées requièrent Header Authorization: Bearer <clé_api>.',
  };
}

export function getPromptApi() {
  return {
    title: 'ML Command API Prompt',
    description:
      'Ce point d’accès fournit un guide pour exploiter les commandes ML disponibles, en particulier la configuration du réseau de neurones et le lancement de l’entraînement.',
    examples: [
      {
        command: 'configureNetwork',
        payload: { hiddenLayers: [32, 16], epochs: 200 },
      },
      {
        command: 'trainModel',
        payload: {
          modelId: 'deeprl',
          totalTrials: 200,
          batches: 4,
          env: { gravity: 9.81, power: 20000, airDrag: false, dragCoefficient: 0.02 },
          mass: 1.2,
          halfWidth: 5,
        },
      },
    ],
  };
}
