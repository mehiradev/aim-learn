# Aim & Learn

# Projet : Ballistic Lab

> Build : v1.3.3 · 11/08/2026 21:59 UTC


## Présentation



**Ballistic Lab** est un jeu de simulation de canon en 2D combinant une simulation physique simple et un système de machine learning. Le joueur peut expérimenter différents paramètres de tir, entraîner une intelligence artificielle à trouver les meilleurs réglages, puis observer ses performances en mode automatique.



## Objectif



Développer une application web interactive simulant un canon en 2 dimensions permettant de tirer sur une cible placée aléatoirement sur un terrain plat. Le projet doit proposer plusieurs modes de fonctionnement, dont un mode d'apprentissage utilisant le machine learning (hors apprentissage par renforcement).



---



## API machine learning

- Génération de clés API sécurisées.
- Lecture de l'état courant du modèle.
- Configuration du réseau de neurones (`hiddenLayers`, `epochs`).
- Entraînement des modèles `deeprl`, `ridge` et `knn`.
- Prédiction de tir, simulation de tir et lecture de l'historique des tirs.
- Révocation des clés API et liste des clés générées.

# Technologies



- Interface moderne et responsive.

- Simulation en temps réel sur un canvas 2D.

- Code clair, modulaire et facilement extensible.

- Séparation entre :

  - moteur physique,

  - interface utilisateur,

  - algorithmes d'apprentissage,

  - stockage du modèle appris.



---



# Simulation physique



La physique reste volontairement simple.



## Paramètres du canon



- Position fixe.

- Angle réglable.

- Vitesse initiale (modifiable dans les paramètres).

- La puissance du canon est constante pour une vitesse donnée.



## Boulets



Trois modèles uniquement :



- Boulet léger

- Boulet moyen

- Boulet lourd



Chaque modèle possède uniquement une masse différente.



## Environnement



Paramètres configurables :



- Gravité

- Vitesse initiale du projectile

- (Optionnel) activation/désactivation des frottements de l'air



Le terrain est parfaitement plat.



---



# Cible



- Position générée aléatoirement à chaque nouvelle partie.

- Position connue uniquement après génération.

- La cible reste fixe jusqu'à être changée.



---



# Moteur physique



Calcul de la trajectoire avec les équations classiques du mouvement balistique :



- position x

- position y

- temps de vol

- portée



La trajectoire doit être affichée visuellement.



Après chaque tir, afficher :



- distance entre l'impact et la cible

- réussite ou échec

- paramètres utilisés



---



# Modes de jeu



## 1. Mode Manuel



L'utilisateur choisit :



- le type de boulet

- l'angle de tir



Puis lance le tir.



Le jeu affiche immédiatement :



- la trajectoire

- le point d'impact

- l'erreur par rapport à la cible



---



## 2. Mode Apprentissage



Objectif :



Le programme apprend automatiquement quels paramètres permettent d'atteindre une cible.



Contraintes :



- Ne pas utiliser d'apprentissage par renforcement (Reinforcement Learning).

- Utiliser un modèle supervisé ou une méthode d'optimisation classique.



Principe :



1. Générer de nombreux tirs d'essai.

2. Enregistrer pour chaque essai :

   - distance de la cible,

   - masse du boulet,

   - angle,

   - vitesse initiale,

   - gravité,

   - distance obtenue.

3. Constituer un jeu de données.

4. Entraîner un modèle de machine learning capable de prédire les paramètres de tir adaptés à une cible donnée.



Le système doit afficher :



- nombre d'essais réalisés,

- progression de l'entraînement,

- erreur moyenne,

- qualité du modèle.



Le modèle entraîné peut être sauvegardé en mémoire pour être réutilisé.

---

## API ML

L'application expose une API de commandes ML via des fonctions serveur TanStack Start.

### Authentification

- La clé API est générée côté serveur à partir d'un mot de passe secret.
- Les endpoints protégés nécessitent l'en-tête HTTP : `Authorization: Bearer <apiKey>`.

### Commandes ML disponibles

- `getApiKey` : génère la clé API à partir du mot de passe.
- `getApiCommands` : liste toutes les commandes disponibles.
- `configureNetworkFn` : configure le réseau de neurones (nombre de neurones par couche, epochs).
- `trainModelFn` : lance l'entraînement du modèle.
- `predictFn` : prédit un angle et une puissance pour une distance et une masse données.
- `simulateShotFn` : simule un tir avec un angle, une masse et un environnement spécifiques.
- `getState` : récupère l'état ML courant.
- `resetState` : réinitialise l'état ML.
- `executeMlCommandFn` : exécute une commande générique via son nom et sa charge utile.
- `getPromptApiFn` : fournit un prompt API destiné à une IA ou un humain.

### Exemple d'utilisation

1. Générer la clé API :

```js
await getApiKey({ data: { password: 'VOTRE_MOT_DE_PASSE_SECRET' } });
```

2. Configurer le réseau :

```js
await configureNetworkFn({
  data: {
    hiddenLayers: [32, 16],
    epochs: 200,
  },
});
```

3. Lancer l'entraînement :

```js
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

4. Récupérer la documentation de l'API :

```js
await getPromptApiFn();
```



## 3. Mode Automatique



Le modèle entraîné précédemment est utilisé.



Fonctionnement :



1. Une nouvelle cible est générée.

2. Le modèle prédit :

   - le meilleur type de boulet,

   - le meilleur angle.

3. Le tir est exécuté automatiquement.

4. Les résultats sont affichés.



Si aucun modèle n'a encore été entraîné, le mode automatique doit être désactivé ou demander de lancer un apprentissage.



---



# Interface utilisateur



Prévoir une interface simple comprenant :



## Zone de simulation



- canon

- terrain

- cible

- trajectoire

- projectile en mouvement



## Panneau de contrôle



- sélection du mode

- sélection du boulet

- réglage de l'angle

- lancement du tir

- génération d'une nouvelle cible

- démarrage de l'apprentissage

- exécution automatique



## Paramètres



- gravité

- vitesse initiale du canon

- affichage ou non de la trajectoire

- vitesse d'animation



## Tableau d'informations



Afficher en permanence :



- angle

- masse

- vitesse

- gravité

- distance cible

- distance impact

- erreur

- nombre d'essais d'apprentissage

- précision du modèle



---



# Architecture recommandée



Modules :



- Physics Engine

- Cannon Controller

- Projectile Models

- Target Generator

- Machine Learning Engine

- Training Manager

- Automatic Solver

- UI Controller



---



# Évolutions futures (optionnelles)



- Vent.

- Résistance de l'air.

- Obstacles.

- Terrain non plat.

- Plusieurs types de canons.

- Export/import du modèle appris.

- Graphiques des performances d'apprentissage.

- Comparaison entre plusieurs modèles de machine learning.



---



# Contraintes importantes



- Le moteur physique doit rester simple et pédagogique.

- Le code doit être propre, commenté et modulaire.

- Le système de machine learning doit être clairement séparé du moteur physique.

- L'application doit pouvoir fonctionner entièrement dans le navigateur, sans serveur.

- L'architecture doit permettre de remplacer facilement le modèle de machine learning par un autre (par exemple : régression linéaire, arbre de décision, réseau de neurones léger ou k-plus proches voisins).

- Le titre de l'application et du projet est **Ballistic Lab**.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/08629f45-751b-4a3d-bd9e-2275c008e897).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
