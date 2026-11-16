# rhapsody-api-build

Transforme un dossier de code C++ généré par Rhapsody (`CodesGeneres\<Config>`) en **exécutable Windows autonome** qui embarque une API **REST + WebSocket** pour lire/écrire tous les attributs et déclencher les événements du modèle. Une page web de démonstration (`api_web_interface/`) et un site personnalisé optionnel (`custom_web_interface/`) sont servis par l'exécutable.

Aucune dépendance npm. Prérequis : Node ≥ 22, Visual Studio (C++), framework Rhapsody installé.

## Utilisation

```powershell
node src/cli.js build      # analyse + schéma + compilation + test de fumée  (npm run build)
node src/cli.js schema     # analyse seule, écrit uniquement le schéma JSON
node src/cli.js run        # lance l'exécutable généré
node src/cli.js clean      # supprime la copie de travail
npm test                   # tests unitaires + e2e (si l'exe est construit)
```
Options : `--config <fichier>`, `--no-smoke`, `--verbose`, `--keep-work`, `--copy-to <dossier>` (répétable : copie le dossier de l'exe, ses sites et schémas), `--api-host <h>`, `--api-port <n>`, `--set <clé>=<valeur>` (surcharge n'importe quelle clé de config, ex. `--set web.route=/simple`). Les dernières lignes affichées résument toujours le résultat (BUILD SUCCEEDED/FAILED, exe, schéma, diff, avertissements, durée, URL).

## Sites web embarqués

L'exécutable sert deux sites statiques (HTML, CSS, JS, médias, sous-dossiers) :

| Dossier source | Route par défaut | Rôle |
|---|---|---|
| `api_web_interface/` | `/api/` | page simple listant tous les attributs et événements (conservée) |
| `custom_web_interface/` | `/custom/` | votre site ; `/` y redirige (sinon vers la page simple) |

Les routes (`web.route`, `customWeb.route`) et dossiers sont modifiables dans la config. Une requête GET est d'abord cherchée comme fichier du site ; sinon elle va à l'API REST, donc `/api/health` fonctionne même si la page simple est sur `/api/` (évitez de nommer un fichier de la page comme une route de l'API).

`custom_web_interface/site.json` (non copié dans l'exe) définit l'adresse de l'API lue par le site :
```json
{ "api": { "host": "127.0.0.1", "port": 8080, "token": "" } }
```
Au build, `server.host`, `server.port` et `server.token` sont alignés dessus (`localhost` → `127.0.0.1`) ; `--api-host/--api-port` ont priorité. Le site custom peut aussi simplement utiliser `location.origin`.

`copyTo` (config) ou `--copy-to` copie en fin de build (smoke test réussi) le dossier de l'exe vers d'autres dossiers.

## Comment ça marche

1. `parser.js` lit les marqueurs `//## class / attribute / event / package` des `.h` (robuste aux changements du modèle) et les `IS_EVENT_TYPE_OF` des `.cpp` (indice `handledBy`).
2. `schema.js` applique `exclude` / `readOnly`, écrit `api_schema.<AAAAMMJJ-HHMMSS>.json` (jamais écrasé, `generatedAt` en première clé, `apiHash` stable) et affiche le diff avec la version précédente.
3. `codegen.js` travaille sur une **copie** (`build/work`) : ajoute dans chaque classe exposée un membre `Tracker` (enregistrement automatique des instances) + `friend struct RhapsodyApiAccess`, et génère `api_gen.cpp` (accesseurs get/set, envoi d'événements, schéma embarqué). `main()` n'est pas modifié (le serveur démarre via un objet statique).
4. `cl.exe` compile le tout avec le runtime C++ (`runtime/`) et les libs Rhapsody (`.mak` lu pour `OMROOT`, `FRAMEWORK_LIB_ROOT`, `LIB_PREFIX`).
5. Test de fumée : lancement sur un port libre, `/api/health`, schéma identique, `/api/state`, snapshot WebSocket, écriture d'une valeur inchangée.

Si le `main` généré est de type animation (`OXF::initialize(argc, argv, port)`), il est adapté automatiquement pour `instrumentation: "None"`.

## Configuration (`rhapsody-api.config.jsonc`)

Commentaires et virgules finales autorisés ; chemins relatifs au fichier sauf `codeDir` et `assets.from` si `projectDir` est défini ; clés inconnues refusées.

| Clé | Rôle |
|---|---|
| `projectDir` | racine du projet Rhapsody (optionnelle) ; base de `codeDir` et `assets.from` |
| `codeDir` | dossier généré par Rhapsody |
| `exe` | chemin/nom de l'exécutable |
| `schema.dir`, `schema.baseName` | dossier et nom de base des schémas horodatés |
| `server.host/port/pushRateHz/cors/token` | serveur (`port: 0` le désactive ; `token` : `?token=` ou `Authorization: Bearer`) |
| `web.source`, `web.dir`, `web.route` | page simple copiée à côté de l'exe et servie sur `route` (`/api`) |
| `customWeb.source`, `.dir`, `.route`, `.siteConfig` | site custom (`custom_web_interface`), servi sur `/custom` ; `site.json` fixe l'adresse de l'API |
| `copyTo` | dossiers recevant une copie du dossier de l'exe |
| `exclude.classes/attributes/events` | éléments internes masqués (`Classe.attr`, `attr`, jokers `*` `?`) |
| `readOnly` | attributs exposés en lecture seule |
| `typeMap` | alias de types (`{"MonType": "int"}`) |
| `attributeOverrides` | initialisations d'attributs à remplacer uniquement dans la copie C++ compilée |
| `assets` | fichiers copiés à côté de l'exe (`{from, to}`) |
| `build.*` | `buildType`, `instrumentation` (`None`/`Animation`), defines/includes/libs/flags supplémentaires, `excludeSources`, `vcvarsPath`, `rhapsodyRoot`, `frameworkLibRoot`, `libPrefix`, `keepWorkDir`, `smokeTest`, `smokeTestTimeoutSec` |
| `run.cwd`, `run.args`, `run.useExeDir` | répertoire et arguments au lancement ; `useExeDir` impose le dossier de l'exécutable comme répertoire courant, même au lancement direct |

Surcharges à l'exécution : `RHAPSODY_API_PORT`, `RHAPSODY_API_HOST`, `RHAPSODY_API_DISABLE=1`, `RHAPSODY_API_NO_BROWSER=1`, `--api-port=`, `--api-host=`. Le navigateur s'ouvre après la mise en écoute, sur le site personnalisé s'il existe, sinon sur la page simple. Pas d'ouverture si le serveur est désactivé, au reset ou pendant le test de fumée.

### Valeurs initiales pour l'exécutable

`attributeOverrides` accepte par exemple `{ "class": "MaClasse", "attribute": "repertoire", "type": "OMString", "value": "sons\\" }`. Le champ `class` est facultatif si le nom d'attribut est unique ; une ambiguïté provoque une erreur. Les types acceptés sont `OMString`, `std::string`, `bool`, `int`, `float` et `double`, avec une valeur JSON correspondante. Seuls les attributs scalaires non constants et non statiques, explicitement initialisés dans chaque constructeur, sont pris en charge. La configuration racine surcharge celle de l'API quand elle définit cette liste.

Le remplacement concerne les listes d'initialisation des constructeurs dans la copie de travail, jamais les fichiers Rhapsody. Le modèle peut modifier l'attribut après construction ; le build signale les attributs introuvables, incompatibles ou sans initialisation prise en charge.

## API

Identifiants d'instance : `Classe` (première instance), puis `Classe#2`, `Classe#3`… ; `Classe` désigne toujours la plus ancienne instance vivante.

REST (`/api/...`) :
- `GET health | schema | instances | state | instances/{id} | instances/{id}/attrs/{attr}`
- `PUT instances/{id}/attrs/{attr}` `{"value": v, "index"?: n}` (élément d'un tableau si `index`)
- `PATCH instances/{id}/attrs` `{"attr": v, ...}` ; `PATCH state` `{"id": {"attr": v}}`
- `POST events/{nom}` ou `POST instances/{id}/events/{nom}` : corps = arguments nommés (objet) ou positionnels (tableau), ou `{"instance", "args"}`. Sans instance, l'événement va à l'unique instance qui le gère (`handledBy`), sinon à l'unique instance réactive.
- `POST reset` (ou `POST simulation/reset`) : relance la simulation depuis le début (l'exécutable se relance lui-même, port et paramètres identiques ; les clients WebSocket se reconnectent). Répond `{"ok":true,"restarting":true}`, ou 409 si un reset est déjà en cours. Aucun JSON requis.

WebSocket `/ws` : `snapshot` à la connexion, puis `delta` (`added/removed/changes`, au plus `pushRateHz` Hz) et `event`. Requêtes client : `{op:"set", instance, attr, value, index?, reqId}`, `{op:"set", changes}`, `{op:"event", name, args, instance?, reqId}`, `{op:"reset"}`, `snapshot`, `schema`, `ping` ; réponse `{type:"result", reqId, ok, ...}`.

Côté web, `api_web_interface/sim-client.js` encapsule tout :
```js
const sim = new SimClient();
sim.onState((state, changes) => ...);
sim.set("_SysVehicule", "speed", 42);
sim.sendEvent("ev_tentative_mdp", { mdp: "1234" });
```

## Limites connues

- Windows uniquement ; seules les libs Debug du framework sont installées ici (`buildType: "Debug"`).
- Les accès du serveur et les threads du modèle ne sont pas synchronisés (acceptable pour types simples ; risque faible sur `OMString`).
- Écrire un attribut contourne le statechart (pas de transition). Un événement n'a d'effet que si les gardes/états du statechart l'autorisent.
- Seuls les attributs de types simples (bool, entiers, enums, flottants, `OMString`, `std::string`, `char[N]`, tableaux de ceux-ci) sont exposés ; les autres sont listés dans `skipped` du schéma (utiliser `typeMap`).
- Les opérations ne sont pas exposées ; les objets copiés ne sont pas suivis.
- Sans `token`, toute page locale peut piloter le simulateur : garder `host` à `127.0.0.1` ou définir un token.
- `PlaySound` résout ses chemins relatifs depuis le répertoire courant. La configuration fournie copie le dossier `sons` du projet à côté de l'exécutable et active `run.useExeDir` ; la configuration racine adapte le chemin initial du modèle pour l'exécutable.
