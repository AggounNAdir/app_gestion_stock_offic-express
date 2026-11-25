# Prompts d'Évolution — Application Gestion de Stock & Distribution

> **Mode d'emploi :** Copiez-collez directement le bloc **Prompt** de l'option que vous souhaitez ajouter dans une nouvelle demande.  
> Chaque prompt précise de conserver la compatibilité avec **Express + TypeScript**, **PostgreSQL (`src/server/db/postgres.ts`)**, la **sauvegarde/restauration JSON (`store.ts`)**, les **droits RBAC (`rbac.ts`)**, le **journal d'audit** et les **thèmes de l'interface**.

---

## 1. Commercial & Facturation

### 1.1 Devis / Factures Proforma (avec conversion en 1 clic)
```text
Ajoute un module complet "Devis / Factures Proforma" à mon application de gestion de stock :
- Backend (`store.ts`, `postgres.ts`, `bureauExtrasApi.ts`) : ajoute la table `devis` (numéro auto `DEV-YYYYMMDD-XXXX`, date_devis, date_validite, client_id, vendeur_id, lignes, total_ht, tva_total, total_ttc, remise, statut : 'Brouillon' | 'Envoyé' | 'Accepté' | 'Refusé' | 'Converti', observations, bon_vente_id), incluse dans PostgreSQL et dans la sauvegarde/restauration JSON (`BackupSnapshot`).
- Action de conversion en 1 clic : un endpoint `POST /api/bureau/devis/:id/convertir` qui transforme un devis en Bon de Vente validé (avec déduction du stock, mise à jour du solde client, mouvement de stock et journal d'audit) sans pouvoir convertir deux fois le même devis.
- Frontend : ajoute la page `Devis` dans le menu "Ventes et portail client" avec création/modification/suppression, filtre par statut, bouton "Convertir en Bon de Vente" et impression PDF/HTML utilisant le profil entreprise configuré pour `document_profils.devis`.
```

### 1.2 Plafond de Crédit Client & Blocage des Ventes
```text
Ajoute la gestion du plafond de crédit client dans mon application :
- Ajoute un champ optionnel `plafond_credit` (nombre, 0 = illimité) et `bloquer_si_depasse` (0 ou 1) sur `Client` (`store.ts`, `postgres.ts`, formulaire création/édition client).
- Lors de la création ou validation d'un Bon de Vente ou d'une commande portail client/vendeur : calcule le nouveau solde projeté (`client.solde + reste_payer`). Si `plafond_credit > 0` et le plafond est dépassé : affiche un avertissement détaillé, et si `bloquer_si_depasse === 1` (sauf forçage par un admin), bloque la validation côté serveur avec un message clair en français.
- Ajoute dans la fiche/liste Clients une jauge ou un badge indiquant le taux d'utilisation du crédit et les clients en dépassement.
```

### 1.3 Échéancier & Relances Factures Impayées
```text
Ajoute un onglet "Échéancier & Relances" dans la section Finances / Factures :
- Liste toutes les factures et bons de vente non soldés triés par date d'échéance (En retard / Échéance proche sous 7 jours / À venir) avec calcul automatique des jours de retard et du reste à payer.
- Ajoute des filtres par client, vendeur et niveau de retard, ainsi que des KPI (Total créances, Montant en retard, Nb clients en retard).
- Pour chaque facture en retard, ajoute un bouton "Préparer relance" qui génère un message professionnel prêt à copier/envoyer par WhatsApp ou Email (sans quitter l'app) et enregistre la relance dans le journal d'audit.
```

### 1.4 Caisse Comptoir Rapide & Ticket Thermique 80 mm
```text
Ajoute un mode "Vente Comptoir Rapide (POS)" avec impression ticket thermique 80 mm :
- Interface optimisée pour saisie rapide au clavier ou lecteur code-barres (`barcode` / recherche instantanée) : ajout direct au panier par appui sur Entrée, modification rapide des quantités, remise globale, calcul automatique du rendu monnaie sur le montant reçu, et validation en 1 clic vers le client COMPTOIR (ou client sélectionné).
- Ajoute un format d'impression "Ticket 80 mm" (`@media print` largeur 80mm, police compacte, entête du profil entreprise, détail articles, total TTC, versé, rendu monnaie) accessible depuis la caisse rapide et les bons de vente.
```

---

## 2. Stock & Logistique

### 2.1 Import Massif Excel / CSV (Produits & Clients)
```text
Ajoute une fonctionnalité d'import CSV / Excel (`.csv`, `.xlsx`) pour les Produits et les Clients :
- Installe `xlsx` (SheetJS) si nécessaire et crée des endpoints sécurisés `POST /api/bureau/produits/importer` et `POST /api/bureau/clients/importer` réservés aux rôles `admin` et `gestionnaire`, avec journalisation dans `journal_audit` et synchronisation PostgreSQL.
- Frontend : ajoute un bouton "Importer Excel/CSV" dans les pages Produits et Clients ouvrant une modale avec : téléchargement d'un modèle CSV exemple, prévisualisation des lignes lues avant import, détection des doublons (code ou code-barres existant : choix Ignorer ou Mettre à jour), rapport détaillé des lignes importées/ignorées/en erreur.
```

### 2.2 Inventaire Physique Guidé & Régularisation
```text
Ajoute un module "Inventaire Physique" dans la section "Stock et tournée" :
- Backend (`store.ts`, `postgres.ts`) : ajoute `inventaires` (id, numero `INV-...`, date_inventaire, statut `'En cours' | 'Validé' | 'Annulé'`, observations, utilisateur, lignes avec produit_id, stock_theorique, stock_compte, ecart, valeur_ecart), inclus dans la sauvegarde/restauration JSON.
- Frontend : création d'une session d'inventaire (tous les produits ou filtré par marque/fournisseur), saisie rapide des quantités comptées (colis ou pièces), calcul temps réel des écarts (+/- et valeur en DA), impression de la fiche de comptage vierge, puis bouton "Valider l'inventaire" (réservé admin/gestionnaire) qui génère automatiquement les `mouvements_stock` (`INVENTAIRE_ENTREE` / `INVENTAIRE_SORTIE`) et met à jour `stock_actuel`.
```

### 2.3 Gestion des Lots & Dates de Péremption (DLC / DLUO)
```text
Ajoute la gestion des numéros de lot et dates de péremption (DLC) sur les produits :
- Backend (`store.ts`, `postgres.ts`) : ajoute `lots_produits` (id, produit_id, numero_lot, date_fabrication, date_expiration, quantite_initiale, quantite_restante, bon_achat_id, actif), inclus dans la sauvegarde/restauration JSON.
- Lors des bons d'achat : permet de saisir le numéro de lot et la date d'expiration. Lors des ventes : propose la sortie prioritaire selon la règle FEFO (premier expiré, premier sorti).
- Ajoute des alertes sur le Tableau de Bord et un filtre dans Produits pour voir les lots expirés ou expirant dans les 30 / 60 jours.
```

### 2.4 Multi-Dépôts & Transferts Inter-Dépôts
```text
Ajoute la gestion Multi-Dépôts à mon application :
- Backend (`store.ts`, `postgres.ts`) : ajoute `depots` (id, code, nom, adresse, est_principal, actif), `stock_par_depot` (depot_id, produit_id, quantite), et `transferts_depot` (id, numero, date_transfert, depot_source_id, depot_dest_id, statut, lignes, utilisateur).
- Adapte les achats, ventes, chargements camion et mouvements de stock pour sélectionner le dépôt concerné (avec Dépôt Central par défaut pour préserver la compatibilité avec les données existantes).
- Frontend : page de gestion des dépôts, consultation du stock par dépôt, et création/validation de bons de transfert entre dépôts.
```

---

## 3. Finances & Rentabilité

### 3.1 Journal de Caisse & Dépenses (Charges + Bénéfice Net Réel)
```text
Ajoute un module "Caisse & Dépenses (Charges)" dans la section "Finances et suivi des comptes" :
- Backend (`store.ts`, `postgres.ts`) : ajoute `depenses` (id, numero `DEP-YYYYMMDD-XXXX`, date_depense, categorie : 'Carburant' | 'Loyer' | 'Salaires' | 'Entretien Camion' | 'Électricité/Eau' | 'Fournitures' | 'Autre', libelle, montant, mode_paiement, vendeur_id optionnel, reference, observations, cree_par), inclus dans PostgreSQL et `BackupSnapshot`.
- Frontend : page de saisie/filtrage/export CSV des dépenses par période et catégorie, total des charges par mois, et intégration dans la page `Statistiques` pour afficher le **Bénéfice Net Réel = Marge Brute - Total Dépenses**.
```

### 3.2 Portefeuille Chèques & Effets (Clients / Fournisseurs)
```text
Ajoute un suivi du "Portefeuille Chèques" dans la section Finances :
- Backend (`store.ts`, `postgres.ts`) : ajoute `cheques` (id, type `'Client' | 'Fournisseur'`, numero_cheque, banque, date_emission, date_echeance, tiers_id, tiers_nom, montant, statut `'En attente' | 'Déposé' | 'Encaissé' | 'Rejeté'`, versement_id, observations).
- Quand un versement client ou fournisseur est saisi avec le mode `Chèque`, crée automatiquement l'entrée correspondante dans le portefeuille. Si un chèque passe à `Rejeté / Impayé`, permet de ré-imputer automatiquement le montant sur le solde du tiers avec trace dans le journal d'audit.
- Frontend : tableau filtrable par statut, banque et échéance avec changement de statut en 1 clic et KPI des chèques en attente / rejetés.
```

### 3.3 Objectifs & Commissions Vendeurs
```text
Ajoute un système d'Objectifs Mensuels et Calcul des Commissions pour les vendeurs :
- Backend (`store.ts`, `postgres.ts`) : ajoute `objectifs_vendeurs` (id, vendeur_id, mois `'YYYY-MM'`, objectif_ca, objectif_encaissement, taux_commission_pct, prime_fixe).
- Calcule automatiquement pour chaque vendeur et chaque mois : CA réalisé, taux d'atteinte (%), encaissements réels, et commission estimée.
- Frontend : nouvel onglet ou panneau dans la page `Vendeurs` et dans la vue tournée vendeur (`VendeurTourneeView.tsx`) affichant la barre de progression vers l'objectif et le récapitulatif des primes à payer.
```

---

## 4. Terrain & Automatisation

### 4.1 Carte Interactive des Clients, Prospects & Tournées GPS
```text
Ajoute une vue "Carte des Tournées & Clients" exploitant les coordonnées GPS (`latitude`, `longitude`) déjà enregistrées dans `clients`, `prospects_clients` et `tournee_pointages` :
- Utilise Leaflet (`leaflet`) avec tuiles OpenStreetMap (sans clé API payante requise) dans un nouveau composant `CarteTourneeView.tsx`.
- Affiche des marqueurs colorés par type (Clients actifs, Clients avec solde impayé, Prospects, Pointages vendeurs du jour) avec popup d'information (nom, solde, dernier pointage, lien Google Maps itinéraire).
- Ajoute des filtres par vendeur et par date de tournée dans `Suivi Portail Client` et dans `VendeurTourneeView.tsx`.
```

### 4.2 Sauvegardes Automatiques Planifiées (avec Rétention)
```text
Ajoute un planificateur de sauvegardes automatiques dans le serveur Express et l'interface d'administration :
- Backend (`server.ts`, `bureauExtrasApi.ts`, `postgres.ts`) : stocke dans `app_config` (`backup_auto_config`) les paramètres : `actif` (boolean), `heure` (ex: `"23:00"`), `frequence_heures` (ex: `24`), `max_copies` (ex: `15`).
- Un timer serveur vérifie périodiquement s'il faut créer une sauvegarde `auto_planifiee_YYYY-MM-DD_HH-mm-ss.json` dans `backups/` et supprime automatiquement les anciennes sauvegardes `auto_planifiee_*` dépassant `max_copies`.
- Frontend : dans *Profils Entreprise → Sauvegarde & Restauration*, ajoute un panneau de configuration (Activer/Désactiver, fréquence, nombre maximal de copies conservées) sans toucher aux sauvegardes manuelles.
```

### 4.3 Notifications Temps Réel au Bureau (Commandes & Retours)
```text
Ajoute des notifications en temps réel côté bureau lorsque de nouvelles commandes portail ou demandes de retour/déchargement vendeur arrivent :
- Utilise Server-Sent Events (SSE) via un endpoint léger `GET /api/bureau/notifications/stream` authentifié, émettant un événement dès qu'une route portail client/vendeur crée une commande, un prospect, un retour vendeur ou un déchargement.
- Frontend : affiche une cloche de notification discrète dans la barre latérale/en-tête avec compteur de nouveautés, liste déroulante cliquable vers la page concernée, et alerte toast non bloquante (option son activable/désactivable).
```

---

## 5. Protection Commerciale (Vente du Logiciel)

### 5.1 Gestion de Licence & Clé d'Activation (Pour Déploiement Client)
```text
Ajoute un système de gestion de licence locale pour protéger la distribution commerciale du logiciel chez mes clients :
- Backend (`src/server/license.ts`, `postgres.ts`) : vérifie une clé de licence signée HMAC-SHA256 (stockée dans `app_config` ou variable d'environnement `APP_LICENSE_KEY`) contenant : nom du client licencié, date d'expiration, nombre max d'utilisateurs et signature.
- Ajoute un mode période d'essai (ex: 14 jours) puis restriction en lecture seule ou écran d'activation si expirée, tout en permettant à un administrateur de saisir une nouvelle clé d'activation depuis *Profils Entreprise* (et un script CLI `scripts/generate-license.ts` hors conteneur pour me permettre de générer des clés pour mes clients).
```
