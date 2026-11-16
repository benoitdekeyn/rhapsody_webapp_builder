# rhapsody_WEB_interface

Site web **indépendant** (Vue 3 + Vite) : cockpit réaliste de la voiture, branché sur l'API du moteur `simulateur.exe` (voir `../rhapsody_API_build`). Le build produit **un seul `dist/index.html`**, utilisable en double-clic (`file://`).

## Commandes

```
npm install
npm run dev       # serveur de dev (rechargement à chaud)
npm run build     # génère dist/index.html (statique, autonome)
npm test          # tests unitaires (vitest)
```

Lancer le moteur d'abord (`dist\simulateur.exe` ou `node src/cli.js run` dans `rhapsody_API_build`). Le moteur ouvre automatiquement le site intégré ; le serveur Vite reste disponible séparément pour le développement.

## Interface

- **Combiné** : roue de carburant, compteur de vitesse et pile de batterie. Un repère vert (régulateur) ou orange (limiteur) indique la consigne sur le compteur lorsque le mode correspondant est allumé.
- **Clé de contact** : OFF / ON / START. START est à ressort : `ev_demarrer` est envoyé une seule fois à l'enfoncement, la clé revient sur ON au relâchement.
- **Pédales** frein / accélérateur (option « Maintenir »).
- **Pente et véhicule devant** : la route s'incline selon la pente ; déplacer votre voiture pour régler la distance et tourner l'aiguille pour régler la vitesse du véhicule devant. Les deux commandes sont aussi accessibles au clavier et les valeurs affichées suivent l'API.
- **Autoradio** : bouton marche/arrêt et commandes de lecture et piste suivante, selon les états du modèle.
- **Régulateur / Limiteur** : `ev_regulateur`, `ev_limiteur`, `+` / `−` (un événement par clic, pas de répétition).
- **Kit mains libres / Bluetooth** et **Téléphone** : jumelage (code du kit : voir Paramètres), appels et SMS simulés, câble de recharge USB.
- **Paramètres** (en-tête) : valeurs initiales du modèle (masse, frottement, Kp/Ki, consigne initiale du limiteur, mot de passe, seuils…). « Reset Simulation » les remet à leurs valeurs d'origine.

## Configuration

| Fichier | Rôle |
|---|---|
| `api-map.jsonc` | **Liaison nom du site ↔ attribut / événement de l'API Rhapsody**, et contenu du menu Paramètres. Si un élément est renommé dans Rhapsody, modifier uniquement ce fichier (un avertissement s'affiche en en-tête si une entrée n'existe plus dans l'API). |
| `site.config.jsonc` | Valeurs par défaut (URL de l'API, token, reconnexion, thème, debug, titre). La config racine `rhapsody-webapp.config.jsonc`, si présente, les surcharge en dev comme au build. `RHAPSODY_SITE_OVERRIDE` (JSON, posé par les commandes racine) reste prioritaire. |
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
- Les réglages enregistrés avec ⚙ sont propres à chaque origine du navigateur : le port Vite et le site servi par l'exécutable peuvent donc avoir des préférences différentes. La taille et le zoom de la fenêtre influencent aussi le rendu ; sur un petit écran, la page peut défiler.
- Les événements n'agissent que si le statechart Rhapsody les autorise ; écrire un attribut le contourne.
- Le jumelage Bluetooth n'est possible que contact mis et moteur éteint.
- Lorsque le kit est connecté, le modèle redirige les appels et la lecture des SMS vers le kit ; les commandes correspondantes du téléphone sont désactivées.
- Pendant la simulation du véhicule précédent, le modèle recalcule `distance_inter_voiture` et peut écraser une valeur saisie. Pour régler durablement la distance, arrêter la simulation, la régler, puis la relancer.
- Après modification du modèle, reconstruire l'exécutable et le site : le schéma embarqué dans l'exécutable doit contenir les attributs et événements de `api-map.jsonc`. L'en-tête signale les éléments absents.