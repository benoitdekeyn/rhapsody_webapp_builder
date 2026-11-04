# rhapsody_WEB_interface

Site web **indépendant** (Vue 3 + Vite) qui se branche sur l'API du moteur `simulateur.exe` (voir `../rhapsody_API_build`). Le build produit **un seul `dist/index.html`**, utilisable en double-clic (`file://`).

## Commandes

```
npm install
npm run dev       # serveur de dev (rechargement à chaud)
npm run build     # génère dist/index.html (statique, autonome)
npm test          # tests unitaires (vitest)
```

Lancer le moteur d'abord (`dist\simulateur.exe` ou `node src/cli.js run` dans `rhapsody_API_build`).

## Configuration

| Fichier | Rôle |
|---|---|
| `site.config.jsonc` | Valeurs par défaut (URL de l'API, token, reconnexion, thème, debug, titre). Embarqué au build. La variable d'environnement `RHAPSODY_SITE_OVERRIDE` (JSON, posée par le build racine depuis `rhapsody-webapp.config.jsonc`) est fusionnée par-dessus. |
| `src/dashboard/dashboard.config.jsonc` | Disposition + liaison composants ↔ attributs / événements Rhapsody. |
| Icône ⚙ du site | Surcharge à l'exécution (stockée dans localStorage, prioritaire) : URL, token, thème, debug, test de connexion, réinitialisation. |

## Structure

```
src/core/        api-client.js (REST+WebSocket), store.js (état réactif), resolve.js, binding.js, settings.js, jsonc.js
src/components/vehicle/<Nom>/<Nom>.vue + defaults.json    (Gauge, Pedal, Led, PushButton, Toggle, Display, Bar)
src/dashboard/   Dashboard.vue + dashboard.config.jsonc
src/settings/    SettingsPanel.vue
```

## Ajouter un composant

Créer `src/components/vehicle/MonComposant/MonComposant.vue` et `defaults.json` : il est enregistré automatiquement (`import.meta.glob`). Utiliser `bindingProps`, `useOptions`, `useAttribute` / `useEvent` de `core/binding.js`. Les `options` d'une instance du dashboard sont fusionnées sur `defaults.json` : modifier un défaut change tous les composants du même type.

## Lier un attribut / événement

Dans `dashboard.config.jsonc` :

```
{ "component": "Gauge", "attribute": "speed", "options": { "max": 200 } }
{ "component": "PushButton", "event": "ev_demarrer", "options": { "label": "Démarrer" } }
```

`instance` est optionnel (déduit du schéma `/api/schema`). Un attribut ou événement absent du schéma est signalé (cadre orange + avertissement en en-tête).

## Notes

- L'API active le CORS `*` : le site peut tourner depuis `file://` ou un autre port.
- Les événements n'agissent que si le statechart Rhapsody les autorise ; écrire un attribut le contourne.
