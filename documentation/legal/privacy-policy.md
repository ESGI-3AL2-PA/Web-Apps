# Privacy Policy / Politique de confidentialité — Connected NeighBours

> **⚠️ DRAFT — REQUIRES LEGAL REVIEW.** Provisional draft from a technical audit. All `[PLACEHOLDER]`
> values, lawful bases and retention periods must be confirmed by counsel before publication.
> **Last updated: [PLACEHOLDER — publication date].**

---

## 🇫🇷 Version française

### 1. Responsable du traitement

Le responsable du traitement est **[PLACEHOLDER : CONTROLLER_IDENTITY — dénomination sociale, forme
juridique, SIREN/SIRET, adresse du siège]** (« Connected NeighBours », « nous »).

Contact vie privée / DPO : **[PLACEHOLDER : DPO_CONTACT — nom ou « aucun DPO désigné », adresse e-mail,
adresse postale]**.

### 2. Quelles données nous collectons

| Catégorie            | Données concernées                                                                                                                                                            |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Compte & identité    | E-mail, mot de passe (haché avec argon2, jamais lisible), prénom, nom, téléphone (facultatif), adresse du domicile, quartier/district de rattachement, solde de points, rôle. |
| Sécurité             | Secret TOTP (double authentification), et par session de connexion : **adresse IP**, **agent utilisateur (navigateur/appareil)**, horodatage de dernière utilisation.         |
| Communications       | Conversations et messages, y compris **images, messages vocaux et fichiers** partagés ; accusés de lecture.                                                                   |
| Contrats             | Contrats d'échange (prestataire, bénéficiaire, prix en points, statut) et **PDF signés générés par Documenso**, lesquels contiennent nom, adresse et prix.                    |
| Registre de points   | Historique des transactions de points (crédit, débit, transfert, montant).                                                                                                    |
| Contenus de quartier | Annonces (et leurs images), événements (et inscriptions), sondages (et vos réponses), incidents signalés (et photos), notifications.                                          |

> Nous ne collectons **pas** de géolocalisation en temps réel : votre quartier est déterminé à partir de
> l'adresse que vous fournissez et des limites géographiques (GeoJSON) des districts. `[DRAFT — à confirmer]`

### 3. Finalités et bases légales

> **[DRAFT — bases légales à confirmer par un juriste.]** Proposition :

| Finalité                                                                 | Base légale proposée                                                          |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| Création de compte, authentification, fourniture du service              | Exécution du contrat (art. 6-1-b)                                             |
| Double authentification et sécurité des sessions (IP, agent utilisateur) | Intérêt légitime / obligation légale de sécurité (art. 6-1-f / 6-1-c)         |
| Rattachement au quartier, fil d'annonces, entraide entre voisins         | Exécution du contrat (art. 6-1-b)                                             |
| Messagerie et partage de médias                                          | Exécution du contrat (art. 6-1-b)                                             |
| Contrats et signature électronique                                       | Exécution du contrat + obligation légale de conservation (art. 6-1-b / 6-1-c) |
| Registre des points / transactions                                       | Exécution du contrat + obligation légale comptable (art. 6-1-b / 6-1-c)       |
| Événements, sondages, incidents                                          | Exécution du contrat / intérêt légitime (art. 6-1-b / 6-1-f)                  |
| E-mails transactionnels (vérification, notifications)                    | Exécution du contrat / intérêt légitime (art. 6-1-b / 6-1-f)                  |

Nous n'utilisons **aucun** cookie ni traceur publicitaire ou analytique (voir la Politique cookies).

### 4. Durées de conservation

> **[DRAFT — durées à confirmer.]** Voir le calendrier détaillé (`retention-schedule.md`). En résumé :

- Données de compte : pendant la vie du compte, puis suppression **30 jours** après une demande de
  suppression ; suppression après **3 ans** d'inactivité `[à confirmer]`.
- Journaux de sécurité (IP, agent utilisateur) : **12 mois** `[à confirmer]`.
- Contrats finalisés et PDF signés, registre de points : **10 ans** au titre des obligations comptables
  et légales françaises (exception de l'art. 17-3) `[à confirmer]`.
- Messages et médias : jusqu'à la suppression du compte ou du contenu.

### 5. Destinataires et sous-traitants

Vos données sont accessibles au personnel habilité de Connected NeighBours et aux sous-traitants
suivants (voir `sub-processors.md` pour le détail) :

- **Resend** — envoi d'e-mails transactionnels (**hébergé aux États-Unis → transfert hors UE**, encadré
  par des garanties appropriées `[FLAG — SCC à confirmer]`).
- **Documenso** — signature électronique (auto-hébergé, région à confirmer `[FLAG]`).
- **MinIO** — stockage des fichiers/médias (auto-hébergé, région à confirmer `[FLAG]`).

Certaines données (nom, adresse) figurent dans les **PDF de contrats signés** partagés avec l'autre
partie au contrat.

### 6. Transferts hors Union européenne

L'envoi d'e-mails via **Resend** implique un transfert vers les **États-Unis**. Ce transfert est
encadré par **[PLACEHOLDER — clauses contractuelles types / mécanisme de transfert à confirmer]**. Les
autres services sont auto-hébergés ; nous confirmons leur localisation dans l'UE/EEE `[FLAG]`.

### 7. Vos droits

Vous disposez des droits d'**accès**, de **rectification**, d'**effacement**, de **limitation**,
d'**opposition** et de **portabilité**, ainsi que du droit de définir des directives post-mortem.
Pour les exercer, écrivez à **[PLACEHOLDER : DPO_CONTACT]**. Vous pouvez introduire une réclamation
auprès de la **CNIL** (www.cnil.fr).

### 8. Sécurité

Mots de passe hachés (argon2), double authentification (TOTP) disponible, chiffrement des échanges,
cloisonnement par quartier des contenus. En cas de violation de données susceptible d'engendrer un
risque, nous notifions la CNIL sous **72 heures** et les personnes concernées le cas échéant
(voir `breach-runbook.md`).

### 9. Modifications

Cette politique pourra évoluer ; la date de dernière mise à jour figure en tête de document.

---

## 🇬🇧 English version

### 1. Data controller

The data controller is **[PLACEHOLDER: CONTROLLER_IDENTITY — company name, legal form, registration
number, registered address]** ("Connected NeighBours", "we").

Privacy / DPO contact: **[PLACEHOLDER: DPO_CONTACT — name or "no DPO appointed", email, postal
address]**.

### 2. What data we collect

| Category              | Data                                                                                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Account & identity    | Email, password (hashed with argon2, never readable), first name, last name, phone (optional), home address, assigned neighbourhood/district, points balance, role. |
| Security              | TOTP secret (two-factor authentication) and, per login session: **IP address**, **User-Agent (browser/device)**, last-used timestamp.                               |
| Communications        | Conversations and messages, including shared **images, voice messages and files**; read receipts.                                                                   |
| Contracts             | Exchange contracts (provider, beneficiary, price in points, status) and **signed PDFs generated by Documenso**, which contain name, address and price.              |
| Points ledger         | History of points transactions (credit, debit, transfer, amount).                                                                                                   |
| Neighbourhood content | Listings (and their images), events (and registrations), polls (and your responses), reported incidents (and photos), notifications.                                |

> We do **not** collect real-time geolocation: your neighbourhood is derived from the address you provide
> and the district boundaries (GeoJSON). `[DRAFT — confirm]`

### 3. Purposes and lawful bases

> **[DRAFT — lawful bases to be confirmed by counsel.]** Proposed mapping:

| Purpose                                                       | Proposed lawful basis                                                       |
| ------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Account creation, authentication, service delivery            | Performance of a contract (Art. 6(1)(b))                                    |
| Two-factor authentication & session security (IP, User-Agent) | Legitimate interest / legal obligation — security (Art. 6(1)(f) / (c))      |
| District matching, listings feed, neighbour mutual aid        | Performance of a contract (Art. 6(1)(b))                                    |
| Messaging and media sharing                                   | Performance of a contract (Art. 6(1)(b))                                    |
| Contracts and e-signature                                     | Performance of a contract + legal retention obligation (Art. 6(1)(b) / (c)) |
| Points ledger / transactions                                  | Performance of a contract + accounting obligation (Art. 6(1)(b) / (c))      |
| Events, polls, incidents                                      | Performance of a contract / legitimate interest (Art. 6(1)(b) / (f))        |
| Transactional email (verification, notifications)             | Performance of a contract / legitimate interest (Art. 6(1)(b) / (f))        |

We use **no** advertising or analytics cookies/trackers (see the Cookie Policy).

### 4. Retention periods

> **[DRAFT — durations to be confirmed.]** See `retention-schedule.md`. In summary:

- Account data: for the life of the account, then deleted **30 days** after a deletion request; deleted
  after **3 years** of inactivity `[confirm]`.
- Security logs (IP, User-Agent): **12 months** `[confirm]`.
- Completed contracts and signed PDFs, points ledger: **10 years** under French accounting/legal
  obligations (Art. 17(3) carve-out) `[confirm]`.
- Messages and media: until the account or content is deleted.

### 5. Recipients and sub-processors

Your data is accessible to authorised Connected NeighBours staff and to the following sub-processors
(see `sub-processors.md`):

- **Resend** — transactional email (**hosted in the United States → transfer outside the EU**, covered by
  appropriate safeguards `[FLAG — SCCs to confirm]`).
- **Documenso** — e-signature (self-hosted, region to confirm `[FLAG]`).
- **MinIO** — file/media storage (self-hosted, region to confirm `[FLAG]`).

Some data (name, address) appears in the **signed contract PDFs** shared with the other contracting
party.

### 6. Transfers outside the EU

Sending email via **Resend** involves a transfer to the **United States**, covered by **[PLACEHOLDER —
Standard Contractual Clauses / transfer mechanism to confirm]**. Other services are self-hosted and we
confirm their EU/EEA location `[FLAG]`.

### 7. Your rights

You have the rights of **access**, **rectification**, **erasure**, **restriction**, **objection** and
**portability**. To exercise them, write to **[PLACEHOLDER: DPO_CONTACT]**. You may lodge a complaint
with the French supervisory authority, the **CNIL** (www.cnil.fr).

### 8. Security

Passwords are hashed (argon2), two-factor authentication (TOTP) is available, traffic is encrypted, and
content is partitioned by neighbourhood. If a data breach is likely to create a risk, we notify the CNIL
within **72 hours** and affected individuals where required (see `breach-runbook.md`).

### 9. Changes

This policy may change; the last-updated date appears at the top of the document.
