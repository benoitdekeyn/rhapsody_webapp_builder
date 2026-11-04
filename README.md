# rhapsody_webapp_builder

Projet Node racine (sans dépendance) qui pilote les deux sous-projets :

- `rhapsody_API_build` : transforme le code C++ Rhapsody en `simulateur.exe` (API REST + WebSocket + sites web embarqués) ;
- `rhapsody_WEB_interface` : site Vue 3 qui utilise cette API.

## Commandes (`node scripts/cli.js <cmd>` ou `npm run <cmd>`)

| Commande | Effet |
|---|---|
| `build` | 1) build du site (`dist/`) avec l'adresse de l'API de la config ; 2) contenu de `dist/` copié dans `rhapsody_API_build/custom_web_interface/` (+ `site.json`) ; 3) build de l'exécutable, qui écoute sur l'adresse de `site.json` ; 4) dossier de l'exe copié dans `application/` (en plus de `rhapsody_API_build/dist/`) |
| `build:web` | étapes 1 et 2 seulement |
| `build:api` | étapes 3 et 4 seulement (utilise le contenu actuel de `custom_web_interface/`) |
| `schema` | analyse du code Rhapsody, écrit seulement le schéma |
| `run` | lance `application/simulateur.exe` |
| `dev` | serveur de dev du site (rechargement à chaud) |
| `test` | tests des deux projets |
| `install` | `npm install` du site |
| `clean [--all]` | supprime copie de travail et `dist` du site (`--all` : aussi exécutables et `application/`) |
| `api <args>` | commande de `rhapsody_API_build` (ex. `api build --verbose`, `api clean`) |
| `web <args>` | script npm de `rhapsody_WEB_interface` (ex. `web test`, `web run preview`) |

Options : `--config <fichier>`, `--no-smoke`, `--skip-web` (build sans reconstruire le site), `--verbose`.

## Configuration commune (`rhapsody-webapp.config.jsonc`)

| Clé | Rôle |
|---|---|
| `codeDir` | dossier généré par Rhapsody (vide : valeur de la config de l'API) |
| `api.host/port/token` | adresse de l'API lue par le site ; l'exécutable écoute dessus |
| `routes.custom` / `routes.simple` | préfixes d'URL du site (`/custom`) et de la page simple (`/api`) |
| `outputDir`, `exeName` | dossier final (`application`) et nom de l'exécutable |
| `site.*` | titre, `reconnectMs`, thème, debug du site Vue (surchargent `site.config.jsonc` au build) |
| `smokeTest` | test de fumée de l'exécutable |
| `apiBuild`, `webInterface` | emplacements des sous-projets, du `dist` du site et de la cible `custom_web_interface` |

Résultat : `application/simulateur.exe` + `custom_web_interface/`, `api_web_interface/`, `schemas/`. Une fois lancé : site sur `http://<host>:<port>/custom/`, page simple sur `/api/`.

Attention : `build`/`build:web` vident `rhapsody_API_build/custom_web_interface/` avant d'y copier le site Vue. Pour embarquer un site à la main, utilisez `build:api` (ou `--skip-web`) après avoir placé vos fichiers et `site.json` dans ce dossier ; `build:api` réécrit `site.json` depuis la config racine.
