# API Prompt ML

Ce document décrit l'API machine learning exposée par l'application.

## Authentification

- La clé API est générée côté serveur à partir d'un mot de passe secret.
- Les endpoints protégés requièrent l'en-tête HTTP : `Authorization: Bearer <apiKey>`.

## Commandes disponibles

### `getApiKey`

- Méthode : POST
- Payload : `{ password: string }`
- Retour : `{ apiKey: string }`
- Description : récupère une clé API valide en fournissant le mot de passe secret.

### `getApiCommands`

- Méthode : GET
- Retour : liste des commandes disponibles.

### `listApiKeysFn`

- Méthode : POST
- Payload : `{ password: string }`
- Retour : `{ apiKeys: Array<{ key: string; createdAt: string; revoked: boolean }> }`
- Description : liste les clés API générées en conservant leur état de révocation.

### `revokeApiKeyFn`

- Méthode : POST
- Payload : `{ key: string; password: string }`
- Retour : `{ revoked: ApiKeyRecord }`
- Description : révoque une clé API existante.

### `configureNetworkFn`

- Méthode : POST
- Payload :
  - `hiddenLayers: number[]`
  - `epochs?: number`
- Description : met à jour l'architecture du réseau de neurones.

### `trainModelFn`

- Méthode : POST
- Payload :
  - `modelId: 'deeprl' | 'ridge' | 'knn'`
  - `totalTrials: number`
  - `batches: number`
  - `env: { gravity: number; power: number; airDrag: boolean; dragCoefficient: number }`
  - `mass: number`
  - `halfWidth: number`
  - `rlConfig?: { hiddenLayers?: number[]; epochs?: number }`
- Description : lance l'entraînement du modèle.

### `predictFn`

- Méthode : POST
- Payload :
  - `distance: number`
  - `mass: number`
- Description : prédit un angle et une puissance pour une cible donnée.

### `simulateShotFn`

- Méthode : POST
- Payload :
  - `angleDeg: number`
  - `mass: number`
  - `env: { gravity: number; power: number; airDrag: boolean; dragCoefficient: number }`
- Description : simule le tir et retourne le résultat.

### `getState`

- Méthode : GET
- Description : récupère l'état courant du modèle ML.

### `resetState`

- Méthode : POST
- Description : réinitialise l'état ML.

### `executeMlCommandFn`

- Méthode : POST
- Payload :
  - `command: string`
  - `payload?: any`
- Description : exécute une commande générique.

### `getPromptApiFn`

- Méthode : GET
- Description : retourne un prompt d'utilisation de l'API.

### `getShotLogsFn`

- Méthode : GET
- Headers : `Authorization: Bearer <apiKey>`
- Retour : `{ logs: ShotLogRow[] }`
- Description : récupère l'historique des tirs enregistrés.

## Exemple d'utilisation

```js
const apiKey = await getApiKey({
  data: { password: 'VOTRE_MOT_DE_PASSE_SECRET' },
});

await configureNetworkFn({
  data: {
    hiddenLayers: [32, 16],
    epochs: 200,
  },
  headers: { Authorization: `Bearer ${apiKey}` },
});

await trainModelFn({
  data: {
    modelId: 'deeprl',
    totalTrials: 200,
    batches: 4,
    env: { gravity: 9.81, power: 20000, airDrag: false, dragCoefficient: 0.02 },
    mass: 1.2,
    halfWidth: 5,
  },
  headers: { Authorization: `Bearer ${apiKey}` },
});
```
