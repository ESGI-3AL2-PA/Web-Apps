# Scripts d'exploitation : backup, restore, migrations

Répond au constat **deploy-M12** — les données ne vivaient auparavant que dans des
volumes Docker nommés (un volume perdu = perte totale de données), Mongo utilisait le
driver brut sans outillage de migration, et Neo4j n'avait ni schéma ni versioning. Ce
répertoire ajoute une paire backup/restore ainsi qu'une convention de migration Mongo
légère et forward-only. C'est un **socle**, pas un framework complet.

## Backup / restore

`backup.sh` et `restore.sh` couvrent les trois magasins de données avec état :

| Magasin  | Backup                      | Restore                          |
| -------- | --------------------------- | -------------------------------- |
| MongoDB  | `mongodump` (archive gzip)  | `mongorestore --drop`            |
| Neo4j    | `neo4j-admin database dump` | `neo4j-admin database load`      |
| MinIO/S3 | `mc mirror` par bucket      | `mc mirror` en retour par bucket |

Arborescence de sortie (horodatée, UTC) :

```
backups/20260714T031500Z/
  mongo/db.archive.gz
  neo4j/neo4j.dump
  minio/<bucket>/...
```

Chaque exécution de `backup.sh` crée un répertoire `<horodatage-UTC>/` sous `BACKUP_DIR`.

### Configuration

Les deux scripts sont pilotés par l'environnement et réutilisent les noms de variables
de `.env.dist` ; sourcer votre env suffit donc comme configuration :

```bash
set -a; . ./.env; set +a
```

Variables lues :

- `MONGODB_URL` (défaut `mongodb://root:root@localhost:27017`), `MONGODB_DB` (défaut `db`).
- `MESSAGES_MINIO_ENDPOINT` / `MESSAGES_MINIO_ACCESS_KEY` / `MESSAGES_MINIO_SECRET_KEY`
  (défauts `http://localhost:9000` / `minioadmin` / `minioadmin`) — utilisées comme
  identifiants MinIO canoniques ; les deux buckets applicatifs vivent dans la même instance.
- `NEO4J_USER` / `NEO4J_PASSWORD` — **non nécessaires** au dump/load hors ligne (qui
  opère directement sur le store), mais honorés par toute étape de vérification en ligne.

Réglages spécifiques au backup :

- `BACKUP_DIR` (défaut `./backups`)
- `NEO4J_DATABASE` (défaut `neo4j` — nom de DB par défaut en édition Community)
- `BACKUP_BUCKETS` (défaut `messages listings documenso`, séparés par des espaces)

`restore.sh` prend le **répertoire de sauvegarde à restaurer en argument obligatoire** :

```bash
./scripts/restore.sh ./backups/20260714T031500Z
```

### Deux modes d'exécution (`USE_DOCKER`)

```bash
# Sur l'hôte — mongodump / neo4j-admin / mc doivent être dans le PATH :
./scripts/backup.sh
./scripts/restore.sh ./backups/20260714T031500Z

# Contre la stack compose — aucun outillage hôte requis. Mongo est dumpé via
# `docker compose exec` ; Neo4j + MinIO via des conteneurs `docker compose run`
# jetables qui réutilisent les images/volumes/réseau des services :
USE_DOCKER=1 ./scripts/backup.sh
USE_DOCKER=1 ./scripts/restore.sh ./backups/20260714T031500Z
```

`COMPOSE_FILE` vaut `docker-compose.yml` par défaut (dev) ; passez-le à
`docker-compose.deploy.yml` pour la stack de prod.

> **Le dump/load Neo4j est une opération hors ligne.** L'édition Community ne peut pas
> dumper un store en cours d'exécution : les deux scripts **arrêtent le service `neo4j`,
> dumpent/chargent, puis le redémarrent** en mode docker. Sur l'hôte, arrêtez votre
> instance Neo4j au préalable. Planifiez les backups dans une fenêtre à faible trafic.

En mode docker, MinIO est mirroré depuis/vers l'instance de la stack via un conteneur
`mc` jetable sur le réseau compose ; un endpoint `localhost`/`127.0.0.1` est
automatiquement réécrit vers `http://minio:9000` (nom de service in-network).

`restore.sh` **écrase** les données en place (`mongorestore --drop`, Neo4j
`--overwrite-destination`) — c'est un outil de reprise après sinistre / clonage, pas
une fusion. Chaque volet (mongo / neo4j / minio) est sauté proprement si le fichier ou
le répertoire correspondant est absent de la sauvegarde.

## Génération des clés RS256 (`gen-auth-keys.sh`)

`gen-auth-keys.sh` génère la paire de clés RS256 avec laquelle l'auth-service signe les
access tokens :

```sh
scripts/gen-auth-keys.sh [répertoire-de-sortie]   # défaut : docker/auth
```

- Écrit `private.pem` (permissions `600`) et `public.pem` (permissions `644`) dans le
  répertoire cible (clé RSA 2048 bits via `openssl`).
- **Refus idempotent** : si l'une des clés existe déjà, le script ne réécrit rien
  (supprimez-les d'abord pour effectuer une rotation).
- La stack compose de prod monte `./docker/auth` en lecture seule dans le conteneur
  auth-service (`AUTH_PRIVATE_KEY_FILE` / `AUTH_PUBLIC_KEY_FILE`). À lancer une fois sur
  l'hôte de déploiement.
- Les clés sont gitignorées et ne doivent jamais être commitées. Les faire tourner
  invalide tout token émis — gardez-les stables.

## Migrations

Les migrations Mongo forward-only vivent dans **`apps/api/src/migrations/`**
(co-localisées avec l'api pour type-checker contre le driver mongodb et réutiliser le
connecteur de l'app — `apps/api/tsconfig.json` ne compile que `src`, donc un répertoire
racine ne builderait pas). Le runner est `apps/api/src/scripts/migrate.ts`.

Convention :

- Les fichiers sont nommés `NNN-description.ts` (préfixe numérique zéro-paddé → ordre
  par tri lexicographique sur le nom).
- Chaque fichier exporte `up(db)` et, optionnellement, `down(db)`.
- Les migrations appliquées sont enregistrées dans la collection Mongo `_migrations`
  (`_id` = nom de fichier sans extension). En attente = pas encore enregistrée ; elles
  s'exécutent dans l'ordre sur `up`.

```bash
npm run migrate         -w api    # applique toutes les migrations en attente
npm run migrate:status  -w api    # liste chaque migration et son état
npm run migrate:down    -w api    # annule la migration la plus récente
```

Ajoutez une migration en copiant `001-example.ts` vers le numéro suivant. Privilégiez
des opérations idempotentes (ex. `createIndex`) pour qu'un run partiel soit rejouable,
et fournissez `down` quand le changement est réversible.
