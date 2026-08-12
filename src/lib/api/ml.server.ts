import { getRequestHeader } from '@tanstack/react-start/server';
import { simulateShot, type Environment } from '../ballistics/physics';
import type { ModelId, RlConfig } from '../ml/registry';
import { trainModel, type TrainedModel } from '../ml/training';
import type { Prediction } from '../ml/types';
import { fetchShotLogs } from '../logging/shot-log';

export interface ApiKeyRecord {
  id: string;
  label: string;
  createdAt: string;
  revoked: boolean;
  revokedAt: string | null;
  lastUsedAt: string | null;
}

const API_ADMIN_PASSWORD = process.env['API_ADMIN_PASSWORD'];
const DEFAULT_API_KEY = 'c423fdbadfbff6bea5d41a1b5319abeea2cecaed61a30413';
const API_KEY_RECORD: ApiKeyRecord = {
  id: 'default',
  label: 'fixed',
  createdAt: new Date().toISOString(),
  revoked: false,
  revokedAt: null,
  lastUsedAt: null,
};

function getAdminPassword(): string {
  if (!API_ADMIN_PASSWORD) {
    throw new Error('Server misconfiguration: API_ADMIN_PASSWORD is not set');
  }
  return API_ADMIN_PASSWORD;
}

function ensureAdminPassword(password: string): void {
  if (password !== getAdminPassword()) {
    throw new Error('Unauthorized: invalid admin password');
  }
}

function parseBearerToken(headerValue: string | null | undefined): string | null {
  if (!headerValue) return null;
  const token = headerValue.startsWith('Bearer ') ? headerValue.slice(7) : headerValue;
  return token.trim() || null;
}

export async function generateApiKey(password: string): Promise<string> {
  ensureAdminPassword(password);
  API_KEY_RECORD.revoked = false;
  API_KEY_RECORD.revokedAt = null;
  return DEFAULT_API_KEY;
}

export async function requireApiKey(): Promise<void> {
  const authHeader = getRequestHeader('Authorization') ?? getRequestHeader('authorization');
  const token = parseBearerToken(authHeader);
  if (!token || !(await verifyApiKey(token))) {
    throw new Error('Unauthorized: API key missing, invalid or revoked');
  }
}

export async function listApiKeys(password: string): Promise<ApiKeyRecord[]> {
  ensureAdminPassword(password);
  return [{ ...API_KEY_RECORD }];
}

export async function revokeApiKey(identifier: string, password: string): Promise<ApiKeyRecord> {
  ensureAdminPassword(password);
  if (identifier !== API_KEY_RECORD.id && identifier !== DEFAULT_API_KEY) {
    throw new Error('NotFound: api key not found');
  }

  API_KEY_RECORD.revoked = true;
  API_KEY_RECORD.revokedAt = new Date().toISOString();
  return { ...API_KEY_RECORD };
}

export async function verifyApiKey(authorizationHeader: string | null | undefined): Promise<boolean> {
  const token = parseBearerToken(authorizationHeader);
  if (!token) return false;
  if (token !== DEFAULT_API_KEY) return false;
  if (API_KEY_RECORD.revoked) return false;
  API_KEY_RECORD.lastUsedAt = new Date().toISOString();
  return true;
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
