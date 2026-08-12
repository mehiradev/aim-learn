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
// Exemple fictif avec URL et clé API factice
// const apiUrl = 'https://example.com/api/ml';
// const apiKey = 'c423fdbadfbff6bea5d41a1b5319abeea2cecaed61a30413';

// fetch(`${apiUrl}/configureNetwork`, {
//   method: 'POST',
//   headers: {
//     'Content-Type': 'application/json',
//     Authorization: `Bearer ${apiKey}`,
//   },
//   body: JSON.stringify({
//     hiddenLayers: [32, 16],
//     epochs: 200,
//   }),
// });

// fetch(`${apiUrl}/trainModel`, {
//   method: 'POST',
//   headers: {
//     'Content-Type': 'application/json',
//     Authorization: `Bearer ${apiKey}`,
//   },
//   body: JSON.stringify({
//     modelId: 'deeprl',
//     totalTrials: 200,
//     batches: 4,
//     env: { gravity: 9.81, power: 20000, airDrag: false, dragCoefficient: 0.02 },
//     mass: 1.2,
//     halfWidth: 5,
//   }),
// });

// fetch(`${apiUrl}/getState`, {
//   method: 'GET',
//   headers: {
//     Authorization: `Bearer ${apiKey}`,
//   },
// }).then((response) => response.json()).then((state) => {
//   console.log('État ML courant :', state);
// });
```

```py
# Exemple Python avec la bibliothèque requests
# api_url = 'https://example.com/_serverFn/10cb0c5e901857331f943f8ef41ccab6237b6d6f84618349b232359ba0920c60'
# api_key = 'c423fdbadfbff6bea5d41a1b5319abeea2cecaed61a30413'

import requests

headers = {
    'Authorization': f'Bearer {api_key}',
    'x-tsr-serverFn': 'true',
}

response = requests.get(api_url, headers=headers)
response.raise_for_status()
state = response.json()
print('État ML courant :', state)
```

> Note : les server functions TanStack Start sont exposées sous `/_serverFn/<functionId>`, pas sous des routes REST classiques comme `/getState`.

