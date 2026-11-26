# rhapsody_webapp_builder

Outil complet permettant de transformer **n'importe quel projet C++ généré par IBM Rhapsody** en un **exécutable Windows autonome (`simulateur.exe`)** doté d'une **API locale (REST + WebSocket)** et d'une **interface Web**, sans jamais modifier le modèle Rhapsody d'origine.

---

## Contexte et cadre

Dans **IBM Rhapsody**, l'animation et l'IHM natives restent limitées lorsqu'on souhaite construire un tableau de bord réaliste ou une interface utilisateur ergonomique pour piloter sa simulation (machines à états, attributs, événements).

Ce dépôt a été conçu initialement dans le cadre d'un projet de **systèmes à événements discrets** (simulateur de véhicule E4SE), puis structuré pour être **réutilisable sur n'importe quel projet Rhapsody C++** :

- **`rhapsody_API_build/`** est l'outil générique et autonome (sans dépendance npm) : il analyse votre code C++ Rhapsody, génère le schéma de l'API, compile votre exécutable Windows et y embarque un serveur HTTP + WebSocket ainsi qu'une page d'exploration automatique (`/api/`).
- **`rhapsody_WEB_interface/`** et les chemins pré-remplis dans les fichiers `.jsonc` correspondent à **un exemple personnel concret** (cockpit de véhicule en Vue 3). Vous n'avez pas besoin de les utiliser : vous pouvez brancher votre propre page HTML/JS sur l'API, ou vous en inspirer comme base de départ.

---

## Documentation et tutoriels

Deux documents complémentaires sont disponibles dans le dossier `tutoriel/` (en **version Web interactive**, en **PDF** et en **Markdown**) :

| Document | Pour qui ? | Version Web (HTML) | Version PDF | Source |
| --- | --- | --- | --- | --- |
| **Tutoriel** | Prise en main rapide, orientée action (aucune connaissance de Node.js requise) | [Ouvrir la page Web](tutoriel/web-version/Tutoriel/index.html) | [Ouvrir le PDF](tutoriel/Tutoriel.pdf) | [Tutoriel.md](tutoriel/Tutoriel.md) |
| **Description détaillée** | Comprendre la chaîne de construction, personnaliser la config, utiliser l'API REST/WebSocket et diagnostiquer les erreurs | [Ouvrir la page Web](tutoriel/web-version/Description_detaillee/index.html) | [Ouvrir le PDF](tutoriel/Description_Detaillee.pdf) | [Description_detaillee.md](tutoriel/Description_detaillee.md) |

---

## Contenu du dépôt

| Dossier / Fichier | Rôle |
| --- | --- |
| `rhapsody_API_build/` | **Cœur réutilisable** : analyseur de code Rhapsody, générateur d'API C++ (REST + WebSocket), compilateur MSVC et page générique `/api/`. |
| `rhapsody_WEB_interface/` | **Exemple personnel** d'interface Web (cockpit véhicule en Vue 3 + Vite, compilé en un seul `index.html`). |
| `application/` | **Livrable prêt à lancer** : contient `simulateur.exe` (démo véhicule), les interfaces Web embarquées, les ressources (`sons/`), ainsi que l'archive autonome [`zip-demo-webapp-rhapsody.zip`](application/zip-demo-webapp-rhapsody.zip) pour tester directement. |
| `tutoriel/` | Documentation complète (`Tutoriel` et `Description_detaillee` en Markdown, HTML et PDF). |
| `rhapsody-webapp.config.jsonc` | Configuration commune commentée reliant le projet Rhapsody, l'API et l'interface Web. |
| `scripts/cli.js` | Orchestrateur racine (sans dépendance) piloté via `npm run ...`. |

---

## Commandes rapides (`npm run <cmd>`)

Depuis la racine du dépôt (prérequis : **Node.js ≥ 22** ; voir le [Tutoriel](tutoriel/Tutoriel.md) pour le pas-à-pas) :

| Commande | Effet |
| --- | --- |
| `npm run run` | Lance `application/simulateur.exe` et ouvre le navigateur |
| `npm run dev:api` | Surveille le code généré par Rhapsody : reconstruit et relance automatiquement l'exécutable à chaque changement |
| `npm run build:api` | Recompile l'exécutable avec le site présent dans `rhapsody_API_build/custom_web_interface/` et met à jour `application/` |
| `npm run schema` | Analyse le code Rhapsody sans compiler et génère uniquement le schéma JSON |
| `npm run build` | *(Exemple complet)* Compile `rhapsody_WEB_interface/`, le copie dans `custom_web_interface/`, puis compile l'exécutable dans `application/` |
| `npm run dev` | *(Exemple complet)* Lance le serveur de développement de `rhapsody_WEB_interface/` avec rechargement à chaud |
| `npm run update:web` | *(Exemple complet)* Recompile l'interface Web et la met à jour dans `application/` sans redémarrer `simulateur.exe` |
| `npm test` | Exécute les tests des deux sous-projets |
| `npm run clean` | Supprime les dossiers temporaires (ajoutez `-- --all` pour nettoyer aussi les exécutables et `application/`) |

> **Rappel** : pour utiliser uniquement le générateur d'exécutable sur votre propre projet sans toucher à `rhapsody_WEB_interface/`, ouvrez un terminal directement dans `rhapsody_API_build/` et lancez `npm run build` puis `npm run run`.

---

## Configuration commune (`rhapsody-webapp.config.jsonc`)

Tous les réglages spécifiques à un projet sont centralisés et commentés dans `rhapsody-webapp.config.jsonc` (et dans `rhapsody_API_build/rhapsody-api.config.jsonc`) :

- **`projectDir` / `codeDir`** : emplacement de votre projet Rhapsody et du dossier de code C++ généré (`CodesGeneres/ModeAnimation`).
- **`attributeOverrides`** : surcharge d'initialisations d'attributs uniquement dans la copie compilée (ex. `_SysVehicule.chemin_sons = "sons\\"` pour que la lecture des sons fonctionne de manière autonome sans modifier le modèle Rhapsody).
- **`api`** (`host`, `port`, `token`) et **`routes`** (`/custom`, `/api`) : adresse du serveur embarqué et préfixes des deux interfaces Web.
- **`outputDir` / `exeName`** : dossier final (`application/`) et nom de l'exécutable (`simulateur.exe`).

Variables d'exécution utiles : `RHAPSODY_API_PORT`, `RHAPSODY_API_HOST`, `RHAPSODY_API_NO_BROWSER=1`, `RHAPSODY_API_DISABLE=1`.
