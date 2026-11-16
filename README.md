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
| `run` | lance `application/simulateur.exe`, qui démarre l'API puis ouvre le site dans le navigateur |
| `dev` | serveur de dev du site (rechargement à chaud et mêmes paramètres que le build) |
| `dev:api` | reconstruit et relance l'API quand le code généré change, sans rouvrir le navigateur |
| `test` | tests des deux projets |
| `install` | `npm install` du site |
| `clean [--all]` | supprime copie de travail et `dist` du site (`--all` : aussi exécutables et `application/`) |
| `api <args>` | commande de `rhapsody_API_build` (ex. `api build --verbose`, `api clean`) |
| `web <args>` | script npm de `rhapsody_WEB_interface` (ex. `web test`, `web run preview`) |

Options : `--config <fichier>`, `--no-smoke`, `--skip-web` (build sans reconstruire le site), `--verbose`.

## Configuration commune (`rhapsody-webapp.config.jsonc`)

| Clé | Rôle |
|---|---|
| `projectDir` | dossier du projet Rhapsody ; les chemins `codeDir` et `assets.from` sont relatifs à ce dossier |
| `codeDir` | dossier généré par Rhapsody dans le projet (vide : valeur de la config de l'API) |
| `attributeOverrides` | valeurs d'initialisation remplacées dans la copie C++ de l'exécutable, sans modifier le modèle Rhapsody |
| `api.host/port/token` | adresse de l'API lue par le site ; l'exécutable écoute dessus |
| `routes.custom` / `routes.simple` | préfixes d'URL du site (`/custom`) et de la page simple (`/api`) |
| `outputDir`, `exeName` | dossier final (`application`) et nom de l'exécutable |
| `site.*` | titre, `reconnectMs`, thème, debug du site Vue (surchargent `site.config.jsonc` en dev et au build) |
| `smokeTest` | test de fumée de l'exécutable |
| `apiBuild`, `webInterface` | emplacements des sous-projets, du `dist` du site et de la cible `custom_web_interface` |

Résultat : `application/simulateur.exe` + `custom_web_interface/`, `api_web_interface/`, `schemas/`. Une fois lancé : site sur `http://<host>:<port>/custom/`, page simple sur `/api/`.

Le dossier `sons` du projet est copié en `application/sons/`. La configuration remplace l'initialisation de `_SysVehicule.chemin_sons` par `sons\` uniquement pour l'exécutable : `play_sound` peut ainsi concaténer le nom du fichier, tandis que le modèle Rhapsody conserve son chemin d'origine.

Chaque entrée `attributeOverrides` indique `attribute`, son `type` C++ et sa `value` JSON ; `class` est optionnel si le nom est unique. Types pris en charge : `OMString`, `std::string`, `bool`, `int`, `float`, `double` (attributs scalaires non constants et non statiques). Le build échoue si le type ou la valeur ne convient pas, si le nom est ambigu ou si un constructeur ne possède pas d'initialisation explicite de l'attribut. Seule l'initialisation est remplacée : le modèle peut ensuite réécrire l'attribut.

Le navigateur s'ouvre après la mise en écoute de l'API, y compris au lancement direct de l'exécutable, mais pas lors d'un reset ni d'un test de fumée. Définir `RHAPSODY_API_NO_BROWSER=1` pour supprimer cette ouverture. Sur une fenêtre trop petite, la page peut défiler pour conserver l'accès aux commandes.

Attention : `build`/`build:web` vident `rhapsody_API_build/custom_web_interface/` avant d'y copier le site Vue. Pour embarquer un site à la main, utilisez `build:api` (ou `--skip-web`) après avoir placé vos fichiers et `site.json` dans ce dossier ; `build:api` réécrit `site.json` depuis la config racine.
