# Connected NeighBours — Document de synthèse

> Synthèse de réalisation du projet : démarche suivie, travail effectué par chacun, analyse critique.
>
> État de référence : dépôt au 18 juillet 2026. Projet annuel ESGI, promotion 3AL2.

---

## 1. Le projet

### 1.1 Objectif

**Connected NeighBours** est une plateforme d'échange de services entre voisins, organisée par quartier.
Les résidents publient des annonces de services et se règlent en **points** plutôt qu'en argent. Un
accord peut être formalisé par une signature électronique, et les désaccords passent par un flux de
litige arbitré par un administrateur de quartier.

Autour de cette boucle transactionnelle, le produit porte une dimension civique : événements de quartier,
sondages, signalement d'incidents, messagerie entre résidents.

L'ambition assumée était de livrer non pas une démonstration mais **un produit réellement déployé**,
avec les contraintes que cela implique : authentification robuste, hébergement, chaîne de livraison,
conformité, internationalisation.

### 1.2 Équipe et calendrier

Trois membres, de **mars à juillet 2026** — environ cinq mois : Etienne QUANTIN, Loris LAURENTI,
Yann JOU.

> _À compléter : intitulé exact de l'UE, dates de rendu et de soutenance._

### 1.3 Ce qui a été livré

| Indicateur             | Valeur                                                                      |
| ---------------------- | --------------------------------------------------------------------------- |
| Applications déployées | 5 (API, service d'authentification, app résident, console d'admin, vitrine) |
| Packages partagés      | 9                                                                           |
| Endpoints              | 92, sur 13 domaines métier                                                  |
| Lignes de TypeScript   | ~41 100                                                                     |
| Commits                | 787                                                                         |
| Bases de données       | MongoDB, Neo4j, PostgreSQL                                                  |
| Langues                | FR / EN                                                                     |
| Production             | En ligne et fonctionnelle sur `connected-neighbours.fr`                     |

---

## 2. Démarche de réalisation

### 2.1 Un choix structurant assumé dès le départ : _contract-first_

La décision la plus importante du projet a été prise tôt et tenue jusqu'au bout : faire d'un package
partagé, `packages/contracts`, la **source unique de vérité** de tous les échanges entre client et
serveur. Chaque endpoint y est déclaré une fois, avec la forme exacte de sa requête et de sa réponse.
Aucune des cinq applications ne redéfinit une forme de donnée : toutes la dérivent.

C'est ce choix qui a rendu le reste possible. À trois personnes, sur cinq applications et 92 endpoints,
il supprime la classe entière des désynchronisations entre front et back : quand un contrat change, la
compilation casse immédiatement partout où c'est nécessaire. Une équipe de cette taille n'aurait pas pu
maintenir cette cohérence par la communication seule.

Le même principe a été étendu à l'autorisation : la politique d'accès de chaque route est déclarée en
métadonnées du contrat et appliquée par une barrière unique, plutôt que réécrite dans chaque handler.

### 2.2 Les paris pris avec l'architecture de l'API

L'API suit une architecture inspirée du _Domain-Driven Design_ et de l'architecture hexagonale, sans en
appliquer l'intégralité. Le chemin d'ajout d'une fonctionnalité est unique et respecté sans exception
notable :

```
contrat (DTO + route)  →  entité  →  repository  →  use-case  →  handler
```

Derrière cette régularité, quatre paris ont été pris. Ils méritent d'être explicités, car ils
expliquent à la fois les qualités et plusieurs des limites du projet.

#### Pari 1 — Les repositories sont des ports, pas des accès à la base

Chaque domaine déclare une **interface** (`IListingRepository`, `IContractRepository`… treize au total)
qui décrit ce dont le métier a besoin, indépendamment de la technologie de stockage. Les
implémentations concrètes sont enregistrées dans un conteneur d'injection de dépendances au démarrage.

C'est le pari le plus rentable des quatre, et son rendement est vérifiable à trois endroits :

- **Deux bases coexistent sans contamination.** Neo4j est branché comme un repository parmi les autres
  pour la recommandation ; aucun use-case ne sait qu'un graphe existe.
- **SATAN QL a pu être interposé sans toucher au métier.** Les implémentations SATAN enveloppent les
  implémentations Mongo derrière la même interface, et le conteneur choisit à l'exécution. C'est
  précisément ce qui a permis de développer un langage de requêtes en parallèle du produit sans le
  déstabiliser — et de retomber automatiquement sur Mongo si le worker ne démarre pas.
- **Les tests n'ont besoin d'aucune infrastructure.** Un use-case se teste en lui passant un objet qui
  implémente l'interface. C'est ce qui a rendu les 28 fichiers de test possibles sans base de données.

#### Pari 2 — La logique vit dans les use-cases, les entités ne sont que des formes de données

C'est l'écart principal avec le DDD canonique, et il est assumé. Les entités du projet sont des
**schémas de validation** : elles décrivent la forme d'un contrat, d'une annonce ou d'une transaction,
avec des commentaires expliquant le sens des états — mais elles ne portent **aucun comportement**. Il
n'y a ni objets-valeurs, ni agrégats, ni événements de domaine. Toute la logique est dans les
use-cases, qui sont des fonctions recevant leurs repositories en argument.

Le bénéfice est réel : l'ensemble est immédiatement lisible, sans la courbe d'apprentissage d'un
modèle riche, et parfaitement adapté à une équipe qui devait avancer vite sur un périmètre large.

Le coût l'est tout autant, et il apparaît dès que les règles cessent d'être triviales : **les invariants
métier n'ont pas de domicile**. Une règle comme « les points bloqués en séquestre doivent toujours être
retrouvables » ne peut pas être portée par un agrégat qui la garantirait par construction ; elle se
retrouve répartie entre plusieurs use-cases qui doivent chacun penser à la respecter. C'est exactement
ce qui s'est produit sur le système de points : les règles de séquestre sont réparties entre la création
de contrat, le webhook de signature et la résolution de litige, et rien dans le modèle n'empêche l'une
d'elles de diverger des autres. Un agrégat « Contrat » propriétaire de son cycle de vie financier aurait
rendu cette divergence structurellement impossible.

#### Pari 3 — Une granularité fine : un use-case par opération

Le projet compte **81 use-cases** pour 13 domaines. Chaque opération métier a son fichier, nommé d'après
l'intention (`create-contract`, `resolve-dispute`, `mark-interest`).

L'avantage est la découvrabilité : lire la liste des fichiers d'un domaine donne la liste de ce que le
produit sait faire, et c'est une porte d'entrée précieuse pour quelqu'un qui reprend un domaine qu'il
n'a pas écrit — situation fréquente à trois sur cinq mois.

Le revers est la **cérémonie sur les cas simples**. Une bonne partie des use-cases de lecture ne font
que transmettre leurs paramètres au repository sans rien y ajouter. La couche est alors du coût pur :
un fichier, un import, un test potentiel, pour zéro logique. Le choix reste défendable — la régularité
a une valeur en soi, et savoir qu'_aucun_ handler ne contient de logique est plus utile que d'économiser
quelques fichiers — mais il faut le compter comme un coût assumé, pas comme un gain.

#### Pari 4 — Un modèle unique, sans contextes délimités

Les treize domaines partagent un seul modèle et une seule base. Il n'y a pas de contextes délimités au
sens DDD : l'utilisateur du domaine « messagerie » est le même objet que celui du domaine « points ».

Pour un produit de cette taille, c'est le bon arbitrage — découper en contextes aurait ajouté des
traductions entre modèles pour un bénéfice nul à cette échelle.

La limite est ailleurs : elle concerne les règles qui **traversent** tous les domaines. Le cloisonnement
par quartier en est l'exemple type — c'est la promesse centrale du produit, et elle doit être appliquée
sur presque chaque lecture. Or l'architecture ne lui offre aucun emplacement naturel : ce n'est ni une
règle d'entité, ni une règle de repository, ni vraiment une règle de use-case. Elle a donc été traitée
au cas par cas dans les handlers, avec un utilitaire partagé — et, faute d'un endroit unique qui
l'impose, elle a été appliquée correctement à certains domaines et incomplètement à d'autres (§4.2).
L'architecture n'est pas responsable de l'oubli, mais elle ne l'a pas empêché, là où elle empêche
efficacement d'autres classes d'erreurs.

#### Bilan des paris

| Pari                         | Rendement                                                                              |
| ---------------------------- | -------------------------------------------------------------------------------------- |
| Repositories comme ports     | **Très positif** — deux bases, SATAN interposable, tests sans infrastructure           |
| Entités sans comportement    | **Mitigé** — lisibilité immédiate, mais les invariants financiers n'ont pas de gardien |
| Un use-case par opération    | **Positif avec réserve** — découvrabilité réelle, cérémonie sur les cas triviaux       |
| Modèle unique sans contextes | **Adapté à l'échelle** — mais aucun domicile pour les règles transverses               |

Le point commun des deux paris les moins rentables est le même : l'architecture retenue est excellente
pour **isoler la technique du métier**, et faible pour **faire respecter des règles métier de façon
contraignante**. Elle protège bien contre le couplage, mal contre l'oubli. Les deux écarts les plus
sérieux relevés en §4.2 — l'intégrité des points et le cloisonnement par quartier — sont tous deux des
oublis de règle, pas des erreurs de couplage.

### 2.3 Un monorepo pour porter le partage

Turborepo et npm workspaces, cinq applications et neuf packages dans un dépôt unique. Le choix découle
directement du parti pris contract-first : il rend le partage de types gratuit et garantit qu'un
changement de contrat voyage dans le même commit que ses consommateurs.

Au-delà des contrats, ce sont l'authentification côté React, le thème graphique, la configuration et
l'infrastructure backend commune qui ont été progressivement factorisés en packages.

### 2.4 Les choix techniques et leurs raisons

| Choix                                  | Motivation                                                                                                                                                                                |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **MongoDB**                            | Source de vérité du domaine métier ; souplesse de schéma adaptée à un produit dont le périmètre bougeait                                                                                  |
| **Neo4j**                              | Projection en graphe dédiée à la recommandation — recommander par affinité entre voisins, événements et centres d'intérêt est une traversée de relations, ce qu'un graphe fait nativement |
| **Service d'authentification séparé**  | Isoler la surface la plus sensible du produit et pouvoir l'exposer à plusieurs clients                                                                                                    |
| **Documenso** (signature électronique) | Brique tierce plutôt que réimplémentation d'un domaine réglementé                                                                                                                         |
| **MinIO** (stockage objet)             | Standard S3 auto-hébergeable, pour les images d'annonces et les messages vocaux                                                                                                           |
| **SATAN QL**                           | Langage de requêtes développé pour le projet (voir §4.2)                                                                                                                                  |
| **Caddy**                              | Terminaison TLS automatique en production                                                                                                                                                 |

Le réflexe général a été d'**acheter plutôt que construire** sur les domaines périphériques — signature,
stockage, e-mail, TLS — ce qui a permis de concentrer l'effort sur le métier. Deux exceptions vont dans
l'autre sens et sont discutées dans l'analyse critique.

### 2.5 Déroulement et rythme

Le projet s'est déroulé en quatre temps nettement identifiables :

| Période        | Volume      | Nature du travail                                                                                                       |
| -------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Mars**       | 17 commits  | Amorçage : structure du dépôt, outillage, cadrage                                                                       |
| **Avril**      | 43 commits  | Socle applicatif : layout, routage, authentification côté front, premiers appels API                                    |
| **Mai – juin** | 62 commits  | Construction du métier : annonces, contrats, événements, sondages, incidents, notifications, messagerie, recommandation |
| **Juillet**    | 664 commits | Industrialisation et mise en production                                                                                 |

La bascule de juillet mérite d'être expliquée, car elle représente 84 % de l'activité. Ce n'est pas du
développement de fonctionnalités : c'est le passage d'un ensemble d'applications qui fonctionnent en
local à un produit hébergé — conteneurisation, chaîne de livraison, gestion des secrets, TLS,
internationalisation, tests, documentation, campagne de revue, corrections. C'est la phase qui a
réellement rendu le projet livrable, et c'est aussi celle qui révèle le déséquilibre analysé en §4.2.

### 2.6 Industrialisation et mise en production

Le projet dispose d'une chaîne complète :

- **Intégration continue** — à chaque pull request : build, lint et tests sur les neuf cibles du
  monorepo. Les tests bloquent la fusion.
- **Livraison continue** — build des cinq images applicatives, publication sur le registre GitHub, scan
  de vulnérabilités, déchiffrement des secrets de production, déploiement automatisé sur la machine
  cible.
- **Production** — cinq applications, trois bases de données, un service de signature, un stockage
  objet, derrière un reverse proxy avec TLS automatique. Les secrets sont chiffrés dans le dépôt et ne
  sont déchiffrés qu'au déploiement.

**Discipline git** — branches `feat/*` et `fix/*`, pull requests vers `main`, revue avant fusion, pas de
commit direct sur la branche principale.

### 2.7 Démarche qualité

Trois dispositifs ont été mis en place :

- **Tests unitaires** (28 fichiers) sur la logique métier des deux backends, exécutés en intégration
  continue.
- **Conventions outillées** — Prettier et ESLint partagés, appliqués sur tout le dépôt, avec des règles
  qui interdisent notamment les traces de débogage oubliées.
- **Campagne de revue finale** — une revue multi-axes en fin de cycle (produit, sécurité, architecture,
  conformité, accessibilité, déploiement, tests), complétée par deux parcours de recette en navigateur
  réel dont un directement en production.

Cette dernière démarche a produit des corrections rapides et nombreuses. Elle a aussi montré ses limites,
analysées en §4.2.

---

## 3. Travail effectué par chacun

### 3.1 Répartition par domaine

| Domaine                                                  | Etienne | Loris | Yann |
| -------------------------------------------------------- | :-----: | :---: | :--: |
| Service d'authentification (JWT, MFA, sessions, e-mails) |    ●    |       |      |
| Architecture de l'API et typage partagé                  |    ●    |       |      |
| SATAN QL (langage de requêtes)                           |         |   ●   |      |
| Neo4j et algorithme de recommandation                    |         |   ●   |      |
| Signature électronique (Documenso)                       |    ●    |   ●   |      |
| Stockage de médias                                       |    ●    |       |      |
| Messagerie temps réel                                    |         |   ●   |      |
| Système de points et séquestre                           |    ●    |   ●   |      |
| Annonces et contrats                                     |    ●    |   ●   |      |
| Événements et sondages                                   |    ●    |   ●   |      |
| Incidents et notifications                               |         |   ●   |      |
| Quartiers et administration de quartier                  |    ●    |       |      |
| Application résident                                     |         |   ●   |      |
| Console d'administration                                 |    ●    |       |      |
| Vitrine et design system                                 |         |       |  ●   |
| Internationalisation FR/EN                               |    ●    |       |      |
| Conteneurisation                                         |    ●    |       |      |
| CI/CD et mise en production                              |    ●    |       |      |
| Stratégie de test                                        |    ●    |       |      |
| Documentation et pilotage                                |    ●    |       |      |

### 3.2 Etienne QUANTIN — architecture technique et mise en production

Etienne a posé et tenu les fondations sur lesquelles repose le reste du projet.

**Architecture.** C'est lui qui a défini le parti pris contract-first, le package de contrats partagés,
le découpage en couches appliqué aux 81 use-cases, et le mécanisme d'autorisation déclarative. Il a
également mené le travail de factorisation qui a supprimé, en fin de projet, la duplication
d'infrastructure entre les deux backends.

**Service d'authentification.** Développé intégralement : émission de jetons signés et exposition des
clés publiques, rotation des jetons de rafraîchissement avec détection de réutilisation,
authentification à deux facteurs, réinitialisation de mot de passe, vérification d'adresse e-mail,
gestion et révocation des sessions.

**Domaines métier.** Les quartiers et leur administration — découpage géographique, éditeur de carte,
attribution des droits d'administrateur de quartier — ainsi que la console d'administration complète
(10 écrans métier). Il a co-construit avec Loris le système de points, les annonces et contrats, les
événements et sondages, et la signature électronique.

**Industrialisation.** L'intégralité de la chaîne : conteneurisation des cinq applications, fichiers de
déploiement, intégration continue, livraison continue, gestion chiffrée des secrets, reverse proxy et
TLS, mise en production. C'est ce travail qui a fait passer le projet de « fonctionne en local » à
« accessible en ligne ».

**Transverse.** L'internationalisation FR/EN, la stratégie de test, la documentation technique
(13 documents) et le pilotage du projet.

**Volume : environ 740 commits.**

### 3.3 Loris LAURENTI — domaines métier et application résident

Loris a porté l'essentiel de ce que l'utilisateur final voit et utilise.

**Application résident.** Il en a posé le socle en avril — mise en page, routage, écrans
d'authentification, couche d'appel à l'API — puis l'a construite jusqu'aux 13 écrans actuels : accueil,
recherche, dépôt d'annonce, mes annonces, mes contrats, profil, paramètres, incidents, événements,
sondages, messagerie.

**Messagerie temps réel.** Conversations individuelles et de groupe, messages texte, vocaux et images,
gestion de la présence et de la déconnexion.

**Incidents et notifications.** Le parcours complet, du signalement par un résident au traitement côté
administration (statut, assignation, historique), avec le système de notifications associé.

**Recommandation.** La modélisation du graphe Neo4j, les requêtes de traversée, la synchronisation
depuis la base principale et l'algorithme de recommandation d'événements.

**SATAN QL.** Le langage de requêtes développé pour le projet : analyseur lexical, analyseur syntaxique,
traducteur et exécuteur en Python, avec son client TypeScript et ses tests.

**Contributions partagées.** Les annonces et contrats, les événements et sondages, la génération du PDF
de contrat pour la signature électronique, et le script de peuplement de la base de développement.

**Volume : environ 37 commits.** Le chiffre demande une lecture prudente : ses commits sont des
livraisons de fonctionnalités entières, là où la phase de juillet procède par petits commits atomiques.
Sa contribution réelle au produit est nettement supérieure à ce que le décompte suggère.

### 3.4 Yann JOU — vitrine et identité visuelle

**Site vitrine.** L'ensemble de la page publique : sections de présentation, parcours d'entrée vers
l'inscription, sélecteur de langue, et le composant de visualisation qui met en scène le concept de
réseau de voisinage.

**Design system.** Le thème graphique partagé — couleurs de marque, typographie, déclinaisons clair et
sombre — qui sert de source de vérité aux trois interfaces, ainsi que les conventions de style
associées.

**Contributions ponctuelles.** La définition initiale de SATAN, un correctif de compatibilité de
l'outillage, le rafraîchissement silencieux des jetons.

**Volume : environ 5 commits.** La contribution est réelle et livrée — la vitrine et le thème sont en
production — mais d'un ordre de grandeur inférieur à celle des deux autres membres.

---

## 4. Analyse critique

### 4.1 Ce qui a bien fonctionné

**Le pari architectural était le bon, et il a été tenu.** Le choix contract-first n'était pas évident au
démarrage : il coûte cher au début, puisqu'il faut déclarer avant de coder. Il a été rentabilisé sur la
durée. C'est ce qui explique qu'une équipe de trois ait pu maintenir cinq applications cohérentes sur
cinq mois sans mécanisme de coordination lourd. Peu de décisions de ce projet ont eu un rendement
comparable.

**Le projet est réellement allé jusqu'au bout.** Beaucoup de projets de cette nature s'arrêtent à la
démonstration locale. Celui-ci est hébergé, sous TLS, avec une chaîne de livraison automatisée, des
secrets chiffrés, un scan de vulnérabilités et des sauvegardes. Franchir cette marche représente un
travail considérable et rarement valorisé à sa juste mesure, car il ne produit aucune fonctionnalité
visible.

**Le périmètre fonctionnel livré est large et cohérent.** 13 domaines métier réellement câblés de bout
en bout, une application résident complète, une console d'administration complète, du temps réel, de la
recommandation par graphe, de la signature électronique, deux langues. Ce n'est pas une maquette : les
parcours fonctionnent en production.

**La rigueur de développement est constante.** Conventions outillées et appliquées, aucune trace de
débogage oubliée, aucun contournement de typage, aucun marqueur de code inachevé, et des commentaires
présents précisément là où le domaine est difficile — pour expliquer le raisonnement, pas paraphraser le
code. C'est le signe d'un code écrit pour être relu.

**L'équipe a su rembourser sa dette plutôt que l'accumuler.** Plusieurs problèmes identifiés en cours de
route — duplication d'infrastructure entre les deux backends, divergence de représentation des données
utilisateur — ont été traités jusqu'au bout en fin de projet, et non contournés. La capacité à revenir
sur son propre travail est un indicateur de maturité plus fiable que la propreté du premier jet.

### 4.2 Ce qui a moins bien fonctionné

**Le déséquilibre de charge est le problème structurant du projet.**

C'est le point le plus important de cette analyse. Environ 740 commits pour Etienne, 37 pour Loris,
5 pour Yann — et surtout, **la totalité des 664 commits de juillet est le fait d'une seule personne**.
Même en tenant compte du fait que le décompte de commits sous-estime la contribution de Loris (§3.3), le
déséquilibre reste massif, et il s'est aggravé au moment le plus exigeant du projet.

Les conséquences dépassent la question de l'équité :

- **Le projet n'est pas transmissible.** L'architecture, l'authentification, l'infrastructure, la chaîne
  de livraison et les accès de production reposent sur une seule personne. Aucun des deux autres membres
  ne pourrait reprendre le déploiement en l'état.
- **Les bonnes pratiques n'ont pas été généralisées.** Plusieurs mécanismes sont correctement traités à
  un endroit et pas ailleurs — le cloisonnement par quartier est rigoureux sur les sondages et
  incomplet sur les autres domaines ; le mécanisme d'autorisation déclarative est contourné à la main à
  deux endroits. Ce ne sont pas des erreurs de conception : ce sont de **bons motifs qui n'ont pas eu le
  temps d'être propagés**, faute de revue croisée systématique et parce qu'une seule personne pilotait.
- **Le produit est hétérogène.** Les deux interfaces suivent des conventions différentes, et certains
  utilitaires existent en double dans des versions qui ont divergé. C'est la signature de deux mains
  travaillant en parallèle sans point de synchronisation régulier sur le style.

Ce déséquilibre a une cause organisationnelle plus qu'individuelle : la phase d'industrialisation n'a
jamais été répartie. Elle a été prise en charge par celui qui l'avait déjà en tête, ce qui était le
choix le plus rapide à court terme et le plus coûteux à moyen terme.

**La vérification n'a pas suivi l'ambition technique.**

Le projet a construit beaucoup, et vérifié proportionnellement peu. Les tests couvrent la logique métier
des backends, mais il n'existe **aucun test d'intégration** — rien qui exerce une requête HTTP réelle de
bout en bout — **aucun test d'interface**, et **aucun test end-to-end**, alors qu'un espace de travail
avait été prévu pour les accueillir et est resté vide.

Ce n'est pas un problème de discipline mais de séquencement : les tests unitaires ont été écrits, ils
tournent en intégration continue, ils bloquent réellement les fusions. Ce qui manque est le niveau
au-dessus, celui qui vérifie que les pièces fonctionnent ensemble — précisément le niveau qui aurait
détecté les écarts les plus coûteux.

Deux illustrations, trouvées en vérifiant le code pour ce document :

- Le mécanisme de transactions atomiques qui protège les mouvements de points est correctement écrit,
  mais **la base de données n'est configurée pour le supporter dans aucun environnement**, ni en
  développement ni en production. Le code retombe silencieusement sur un mode dégradé. Personne ne s'en
  était aperçu, parce que les tests simulaient ce mode dégradé — ils validaient donc fidèlement le
  comportement réel, tout en masquant l'écart avec l'intention.
- Le cloisonnement par quartier, qui est la promesse produit centrale, **n'est pas appliqué aux
  résidents** sur la majorité des écrans de liste. Un compte authentifié peut consulter des données
  hors de son quartier.

Ces deux points ne figuraient dans aucun rapport de la campagne de revue finale. C'est l'enseignement
principal : **une revue est un instantané, un test est une garantie permanente.**

**La documentation décrit un projet qui n'existe plus.**

Le dépôt contient une feuille de route et des rapports de revue qui, quelques jours seulement après leur
rédaction, ne correspondaient déjà plus au code — au rythme de commits de juillet, ils se sont périmés
en moins d'une semaine. La feuille de route décrit encore comme non construits des pans entiers du
produit qui tournent en production. Pour quiconque découvre le dépôt, ces documents sont plus nuisibles
qu'absents.

Le problème n'est pas le manque de documentation — il y en a beaucoup, et le fichier d'exemple de
configuration est remarquablement soigné. C'est l'absence de distinction entre la documentation
**durable** (comment ça marche, pourquoi ce choix) et la documentation **datée** (où on en est), la
seconde ayant été laissée à côté de la première sans horodatage ni archivage.

**Une part de l'effort a porté sur de la complexité que le produit ne demandait pas.**

Trois choix relèvent de cette catégorie :

- **Le service d'authentification écrit à la main.** Le travail est de bonne facture, mais c'est de la
  surface critique qu'il faut désormais maintenir et corriger soi-même, là où des solutions éprouvées
  existent.
- **SATAN QL.** Un langage de requêtes complet, avec son analyseur en Python, exécuté en processus
  séparé, et interposé par défaut devant les accès en lecture en production. Il n'apporte aucune
  capacité que le pilote de base de données ne fournissait déjà. S'il s'agit d'une contrainte
  académique — ce qui est probable — l'exercice est bien mené, mais rien n'imposait de le placer sur le
  chemin critique du produit réel plutôt que de le conserver comme livrable démontrable.
- **Le découpage en deux services.** L'API et le service d'authentification partagent la même base et la
  même collection d'utilisateurs. Le découpage apporte donc son coût — deux déploiements, un appel
  réseau, des jetons de service — sans le bénéfice d'isolation qui le justifierait.

Pendant ce temps, des éléments qui conditionnent le fonctionnement réel du produit n'ont pas été
construits (voir ci-dessous).

**Le modèle d'usage n'a pas été éprouvé aussi sérieusement que le modèle technique.**

Le produit repose sur une monnaie interne, mais **un nouvel inscrit démarre à zéro point** et ne peut
donc rien réserver. Son seul moyen d'en obtenir est de rendre un service d'abord, alors que la raison
la plus courante de s'inscrire est d'en recevoir un. Par ailleurs, **le modèle ne permet pas d'exprimer
une demande de service** — seulement une offre — et **il n'existe aucun système de réputation**, alors
que la confiance entre inconnus est la condition de fonctionnement d'une plateforme d'échange. À
l'inverse, la signature électronique, bien plus coûteuse à développer, a été construite.

Enfin, le cloisonnement strict par quartier, cohérent sur le plan des valeurs, fragmente le réseau : il
faut atteindre une masse critique d'utilisateurs **dans chaque quartier** pour que le service ait un
intérêt. Cette difficulté d'amorçage n'a pas été traitée.

### 4.3 Regard d'ensemble

Le projet démontre une **maîtrise technique nettement supérieure à la moyenne attendue** à ce niveau :
les choix d'architecture sont justes, la mise en production est réelle et complète, la rigueur de
développement est constante, et l'équipe a su revenir sur son propre travail pour le corriger.

Sa faiblesse n'est pas technique, elle est **organisationnelle et méthodologique**. Une répartition très
inégale a produit un résultat livrable mais non transmissible, et surtout hétérogène : les bons réflexes
d'une personne n'ont pas eu le temps de devenir ceux de l'équipe. Et l'effort de construction n'a pas
été accompagné d'un effort de vérification équivalent, ce qui a laissé passer des écarts entre ce qui
est écrit et ce qui s'exécute réellement.

En creux, le projet illustre un arbitrage assumé : il est **plus ambitieux sur les axes valorisés
académiquement** — architecture, langage de requêtes, graphe, infrastructure — **que sur les axes qui
détermineraient son succès en tant que produit** — amorçage, confiance, simplicité d'entrée. Pour un
projet annuel évalué sur la démonstration de compétence technique, l'arbitrage est rationnel. Il mérite
d'être nommé comme tel plutôt que présenté comme un choix produit.

---

## 5. Bilan et perspectives

### 5.1 Bilan

Sur cinq mois et à trois, le projet a livré une plateforme complète et déployée : cinq applications,
92 endpoints sur 13 domaines métier, trois bases de données, un service d'authentification complet avec
double facteur, de la signature électronique, du temps réel, de la recommandation par graphe, deux
langues, et une chaîne de livraison automatisée jusqu'à une production sous TLS.

L'objectif initial — livrer un produit réellement en ligne et non une démonstration — est atteint.

### 5.2 Si le projet devait continuer

Par ordre de priorité :

1. **Rétablir le cloisonnement par quartier pour les résidents.** C'est la promesse centrale du produit
   et le motif correct existe déjà sur un domaine ; il s'agit de le généraliser.
2. **Configurer la base pour supporter réellement les transactions**, et faire échouer le démarrage
   plutôt que dégrader silencieusement.
3. **Ajouter un niveau de test d'intégration.** C'est ce qui manque le plus : quelques parcours
   automatisés de bout en bout auraient détecté les deux écarts ci-dessus.
4. **Trancher le modèle d'usage** — dotation initiale en points, possibilité d'exprimer une demande,
   système de réputation. Ces trois manques bloquent l'adoption plus sûrement que l'absence de n'importe
   quelle fonctionnalité déjà construite.
5. **Assainir la documentation d'état** — archiver ou dater ce qui est un instantané, ne conserver en
   ligne que ce qui reste vrai.
6. **Sortir SATAN QL du chemin par défaut**, en le conservant comme livrable démontrable.

### 5.3 Enseignements

**Sur le plan technique.** Le choix d'une source de vérité unique pour les échanges client/serveur a été
la décision la plus rentable du projet. À l'inverse, l'enseignement le plus coûteux est qu'**une
propriété qui n'est pas testée de bout en bout n'est pas une propriété acquise, c'est une intention** :
le mécanisme transactionnel était correctement écrit et ne s'exécutait pas comme prévu, sans que
personne ne le détecte.

**Sur le plan méthodologique.** Une campagne de revue en fin de projet rassure autant qu'elle informe.
Celle menée ici a produit des corrections utiles, mais ses rapports se sont périmés en quelques jours et
n'avaient pas identifié les deux écarts les plus sérieux. Un test qui s'exécute à chaque commit protège
durablement ; une revue ponctuelle non.

**Sur le plan organisationnel.** C'est l'enseignement principal. Laisser la phase d'industrialisation à
une seule personne était le choix le plus rapide, et il a fonctionné — le produit est en ligne. Mais il
a produit un résultat que l'équipe ne peut pas reprendre collectivement, et dont les bonnes pratiques
n'ont été généralisées nulle part. Répartir cette phase, et instaurer une revue croisée régulière,
aurait coûté du temps en cours de route et fait gagner en robustesse comme en homogénéité — et aurait
permis à chacun des trois membres de repartir avec l'ensemble des compétences mises en œuvre.

---

_Document rédigé le 18 juillet 2026._
