export const CATEGORIES = {
  'Logiciels & Abonnements':        { icon: '💻', color: '#6366f1' },
  'Télécom':                         { icon: '📡', color: '#0ea5e9' },
  'Livraison & Logistique':          { icon: '📦', color: '#f59e0b' },
  'Services publics & Gouvernement': { icon: '🏛️', color: '#64748b' },
  'Restauration & Divers':           { icon: '🍽️', color: '#ec4899' },
  'Fournitures de bureau':           { icon: '🖊️', color: '#10b981' },
  'Transport':                       { icon: '🚗', color: '#8b5cf6' },
  'Autre':                           { icon: '📋', color: '#94a3b8' },
};

export const ROLES = { ADMIN: 'admin', MANAGER: 'manager', EMPLOYEE: 'employee' };

export const ROLE_LABELS = { admin: '👑 Admin', manager: '👔 Manager', employee: '👤 Employé' };

export const STATUTS = ['En attente', 'Approuvé', 'Rejeté'];

export const SYSTEM_PROMPT_IMAGE = `Tu es un assistant expert en comptabilité et gestion de dépenses d'entreprise.
Analyse ce document (reçu, facture ou note de frais) et extrais les informations en JSON UNIQUEMENT :
{
  "fournisseur": "nom du fournisseur/magasin/émetteur",
  "date": "date au format YYYY-MM-DD si disponible, sinon null",
  "montant": number (montant total, sans symbole),
  "devise": "CAD ou USD ou EUR ou autre",
  "categorie": "l'une de ces catégories exactes: Logiciels & Abonnements, Télécom, Livraison & Logistique, Services publics & Gouvernement, Restauration & Divers, Fournitures de bureau, Transport, Autre",
  "description": "brève description de l'achat en 1-2 phrases",
  "items": [{"nom": "...", "montant": number}],
  "taxes": number ou null,
  "numero_recu": "numéro de reçu/facture si visible, sinon null"
}
Réponds UNIQUEMENT avec le JSON, sans markdown, sans explication.`;

export const SYSTEM_PROMPT_TEXT = `Tu es un assistant expert en comptabilité et gestion de dépenses d'entreprise.
Voici le contenu textuel extrait d'un document. Extrais les informations en JSON UNIQUEMENT :
{
  "fournisseur": "nom du fournisseur/magasin/émetteur",
  "date": "date au format YYYY-MM-DD si disponible, sinon null",
  "montant": number (montant total, sans symbole),
  "devise": "CAD ou USD ou EUR ou autre",
  "categorie": "l'une de ces catégories exactes: Logiciels & Abonnements, Télécom, Livraison & Logistique, Services publics & Gouvernement, Restauration & Divers, Fournitures de bureau, Transport, Autre",
  "description": "brève description de l'achat en 1-2 phrases",
  "items": [{"nom": "...", "montant": number}],
  "taxes": number ou null,
  "numero_recu": "numéro de reçu/facture si visible, sinon null"
}
Réponds UNIQUEMENT avec le JSON, sans markdown, sans explication.`;
