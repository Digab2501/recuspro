# 🧾 ReçusPro — Guide de déploiement complet

Application de gestion de reçus avec 3 niveaux d'accès, base de données centralisée, 100% gratuit.

## 🏗️ Architecture (tout gratuit)

| Service | Rôle | Coût |
|---------|------|------|
| **Supabase** | Base de données + comptes + stockage fichiers | Gratuit |
| **Vercel** | Hébergement du site web | Gratuit |
| **Anthropic API** | Analyse IA des reçus | ~0,003$/reçu |

---

## ÉTAPE 1 — Créer votre base de données Supabase (10 min)

### 1.1 Créer un compte
1. Allez sur **https://supabase.com**
2. Cliquez **Start your project** → créez un compte (GitHub ou email)

### 1.2 Créer un projet
1. Cliquez **New project**
2. Choisissez un nom : `recuspro`
3. Créez un **mot de passe de base de données** (notez-le !)
4. Choisissez la région : **Canada (ca-central-1)** ou la plus proche
5. Cliquez **Create new project** — attendez ~2 minutes

### 1.3 Configurer la base de données
1. Dans le menu gauche, cliquez **SQL Editor**
2. Cliquez **New query**
3. Ouvrez le fichier `supabase_setup.sql` (fourni dans ce dossier)
4. Copiez tout le contenu et collez-le dans l'éditeur
5. Cliquez **Run** (bouton vert)
6. Vous devriez voir : `Success. No rows returned`

### 1.4 Récupérer vos clés API Supabase
1. Dans le menu gauche : **Project Settings** → **API**
2. Notez ces deux valeurs :
   - **Project URL** → ressemble à `https://xxxx.supabase.co`
   - **anon public key** → longue chaîne commençant par `eyJ...`

### 1.5 Créer votre compte Admin
1. Dans Supabase : menu gauche → **Authentication** → **Users**
2. Cliquez **Add user** → **Create new user**
3. Entrez votre email et un mot de passe
4. Cliquez **Create user**
5. Allez dans **SQL Editor** et exécutez cette requête pour vous donner le rôle admin :
```sql
UPDATE public.profiles
SET role = 'admin', nom = 'VotreNom', prenom = 'VotrePrenom'
WHERE email = 'votre@email.com';
```
*(Remplacez avec votre vrai email, nom et prénom)*

---

## ÉTAPE 2 — Obtenir une clé API Anthropic (5 min)

1. Allez sur **https://console.anthropic.com**
2. Créez un compte → vérifiez votre email
3. Allez dans **API Keys** → **Create Key**
4. Copiez la clé (commence par `sk-ant-...`)

---

## ÉTAPE 3 — Publier sur GitHub (5 min)

### Option A — Via le site GitHub (sans logiciel)
1. Allez sur **https://github.com** → créez un compte
2. Cliquez **+** → **New repository** → nom : `recuspro` → **Create repository**
3. Cliquez **uploading an existing file**
4. Glissez **tout le contenu** de ce dossier `recuspro` (sans le dossier lui-même)
5. Cliquez **Commit changes**

### Option B — GitHub Desktop (recommandé)
1. Téléchargez **https://desktop.github.com**
2. Connectez-vous → **Add** → **Add Existing Repository** → sélectionnez ce dossier
3. Cliquez **Publish repository**

---

## ÉTAPE 4 — Déployer sur Vercel (5 min)

1. Allez sur **https://vercel.com** → **Sign Up** → **Continue with GitHub**
2. Cliquez **Add New Project** → importez `recuspro`
3. Dans **Environment Variables**, ajoutez ces 3 variables :

| Name | Value |
|------|-------|
| `REACT_APP_SUPABASE_URL` | Votre URL Supabase (ex: `https://xxxx.supabase.co`) |
| `REACT_APP_SUPABASE_ANON_KEY` | Votre clé anon Supabase (`eyJ...`) |
| `REACT_APP_ANTHROPIC_API_KEY` | Votre clé Anthropic (`sk-ant-...`) |

4. Cliquez **Deploy**
5. ✅ En 3 minutes, votre app est en ligne !

Vous obtenez une URL : `https://recuspro-xxxx.vercel.app`

---

## ÉTAPE 5 — Créer les comptes de vos employés

1. Connectez-vous à votre app avec votre compte admin
2. Dans le menu : **Comptes** (visible seulement pour vous)
3. Remplissez le formulaire : prénom, nom, email, mot de passe temporaire, rôle
4. Cliquez **Créer le compte**
5. Communiquez l'URL et les identifiants à votre employé
6. L'employé peut changer son mot de passe depuis son profil

---

## 📱 Installer sur téléphone (optionnel — fonctionne comme une app)

**iPhone/iPad :** Safari → bouton Partager → **Sur l'écran d'accueil**

**Android :** Chrome → menu ⋮ → **Ajouter à l'écran d'accueil**

---

## 🔐 Niveaux d'accès

| Rôle | Peut faire |
|------|-----------|
| 👑 **Admin** | Tout : gère les comptes, voit tout, approuve/rejette, exporte |
| 👔 **Manager** | Voit tous les reçus, approuve/rejette, exporte CSV |
| 👤 **Employé** | Soumet des reçus, voit uniquement les siens |

---

## 📄 Formats de fichiers supportés

- 🖼️ **Images** : JPG, PNG, WEBP, HEIC (photos de reçus)
- 📄 **PDF** : factures, relevés
- 📝 **Word** : .doc, .docx
- 📊 **Excel / CSV** : .xls, .xlsx, .csv

---

## 💰 Coûts estimés

- **Supabase** : gratuit jusqu'à 500 MB de données et 50 000 utilisateurs
- **Vercel** : gratuit jusqu'à 100 GB de bande passante/mois
- **Anthropic** : environ **0,003 $ par reçu** analysé
  → 100 reçus/mois ≈ 0,30 $
  → 500 reçus/mois ≈ 1,50 $

---

## 🔄 Mettre à jour l'application

1. Modifiez les fichiers dans ce dossier
2. Poussez sur GitHub
3. Vercel redéploie **automatiquement** en 2-3 minutes

---

## ❓ Problèmes courants

**"Invalid API key"** → Vérifiez vos variables d'environnement dans Vercel

**"relation profiles does not exist"** → Relancez le script `supabase_setup.sql`

**Caméra ne s'ouvre pas** → Sur iOS, utilisez Safari (pas Chrome)
Mise à jour v2 - nouvelles catégories
