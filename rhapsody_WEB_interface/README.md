# rhapsody_WEB_interface

Site web **indépendant** (Vue 3 + Vite) : cockpit réaliste de la voiture, branché sur l'API du moteur `simulateur.exe` (voir `../rhapsody_API_build`). Le build produit **un seul `dist/index.html`**, utilisable en double-clic (`file://`).

## Commandes

```
npm install
npm run dev       # serveur de dev (rechargement à chaud)
npm run build     # génère dist/index.html (statique, autonome)
npm test          # tests unitaires (vitest)
```

Lancer le moteur d'abord (`dist\simulateur.exe` ou `node src/cli.js run` dans `rhapsody_API_build`).

## Interface

- **Combiné** : roue de carburant, compteur de vitesse, pile de batterie. Chaque voyant est placé près de l'instrument concerné (carburant, batterie, régul./limit./dépass., moteur, Bluetooth/téléphone/appel/SMS). Pas d'alerte : seuls les voyants du statechart s'allument.
- **Clé de contact** : OFF / ON / START. START est à ressort : `ev_demarrer` est envoyé une seule fois à l'enfoncement, la clé revient sur ON au relâchement.
- **Pédales** frein / accélérateur (option « Maintenir »).
- **Régulateur / Limiteur** : `ev_regulateur`, `ev_limiteur`, `+` / `−` (un événement par clic, pas de répétition).
- **Kit mains libres / Bluetooth** et **Téléphone** (pleine hauteur, ratio 2:5) : jumelage complet (code du kit : voir Paramètres).
- **Paramètres** (en-tête) : valeurs initiales du modèle (masse, frottement, Kp/Ki, consigne initiale du limiteur, mot de passe, seuils…). « Reset Simulation » les remet à leurs valeurs d'origine.

## Configuration

| Fichier | Rôle |
|---|---|
| `api-map.jsonc` | **Liaison nom du site ↔ attribut / événement de l'API Rhapsody**, et contenu du menu Paramètres. Si un élément est renommé dans Rhapsody, modifier uniquement ce fichier (un avertissement s'affiche en en-tête si une entrée n'existe plus dans l'API). |
| `site.config.jsonc` | Valeurs par défaut (URL de l'API, token, reconnexion, thème, debug, titre). Embarqué au build. `RHAPSODY_SITE_OVERRIDE` (JSON, posé par le build racine depuis `rhapsody-webapp.config.jsonc`) est fusionné par-dessus. |
| Icône ⚙ du site | Surcharge à l'exécution (localStorage) : URL, token, thème, debug, test de connexion. |

## Structure

```
api-map.jsonc    liaison site <-> API + menu Paramètres
src/core/        api-client.js (REST+WebSocket), store.js (état réactif), car.js (valeurs/actions via api-map), resolve.js, settings.js, jsonc.js
src/car/         CarView, Cluster, Dial, BatteryGauge, Light, IgnitionKey, PedalControl, SpeedControl, HandsFree, Phone, ParamsPanel, Panel
src/settings/    SettingsPanel.vue
```

## Notes

- L'API active le CORS `*` : le site peut tourner depuis `file://` ou un autre port.
- Les événements n'agissent que si le statechart Rhapsody les autorise ; écrire un attribut le contourne.
- Le jumelage Bluetooth n'est possible que contact mis et moteur éteint.