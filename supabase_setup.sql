-- ============================================================
-- ReçusPro — Script de configuration Supabase
-- Copiez-collez ce script dans : Supabase > SQL Editor > New query
-- ============================================================

-- 1. Table des profils utilisateurs
CREATE TABLE IF NOT EXISTS public.profiles (
  id       UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email    TEXT,
  nom      TEXT,
  prenom   TEXT,
  role     TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('admin','manager','employee')),
  actif    BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Table des reçus
CREATE TABLE IF NOT EXISTS public.receipts (
  id           TEXT PRIMARY KEY,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  employe_nom  TEXT,
  fournisseur  TEXT,
  date         DATE,
  montant      NUMERIC(10,2),
  devise       TEXT DEFAULT 'CAD',
  categorie    TEXT,
  description  TEXT,
  items        JSONB,
  taxes        NUMERIC(10,2),
  numero_recu  TEXT,
  note         TEXT,
  file_url     TEXT,
  file_type    TEXT,
  file_name    TEXT,
  preview_url  TEXT,
  statut       TEXT DEFAULT 'En attente' CHECK (statut IN ('En attente','Approuvé','Rejeté')),
  updated_by   UUID,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Storage bucket pour les fichiers
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO NOTHING;

-- 4. Sécurité RLS (Row Level Security)

-- Activer RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts  ENABLE ROW LEVEL SECURITY;

-- Profiles : chaque utilisateur peut lire son propre profil
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- Profiles : admin peut tout lire
CREATE POLICY "profiles_select_admin" ON public.profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Profiles : admin peut modifier les rôles
CREATE POLICY "profiles_update_admin" ON public.profiles
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Profiles : insert (création de compte)
CREATE POLICY "profiles_insert" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Receipts : employés voient seulement les leurs
CREATE POLICY "receipts_select_own" ON public.receipts
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin','manager')
    )
  );

-- Receipts : tout le monde peut insérer le sien
CREATE POLICY "receipts_insert_own" ON public.receipts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Receipts : admin et manager peuvent mettre à jour le statut
CREATE POLICY "receipts_update_manager" ON public.receipts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin','manager')
    )
  );

-- Storage : tout le monde peut uploader dans son propre dossier
CREATE POLICY "storage_upload_own" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'receipts' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Storage : lecture publique
CREATE POLICY "storage_read_public" ON storage.objects
  FOR SELECT USING (bucket_id = 'receipts');

-- 5. Trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER receipts_updated_at
  BEFORE UPDATE ON public.receipts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ✅ Configuration terminée !
-- ============================================================
