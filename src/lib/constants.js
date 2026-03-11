// ─── Catégories de dépenses ───────────────────────────────────────────────────
export const CATEGORIES = {
  'Déplacement chantier':        { icon: '🚧', color: '#f59e0b', requiresProject: true  },
  'Achat matériaux':             { icon: '🧱', color: '#ef4444', requiresProject: true  },
  'Location équipement':         { icon: '🏗️', color: '#f97316', requiresProject: true  },
  'Formation':                   { icon: '🎓', color: '#8b5cf6', requiresProject: true  },
  'Essence':                     { icon: '⛽', color: '#eab308', requiresProject: false },
  'Entretien et réparation':     { icon: '🔧', color: '#64748b', requiresProject: false },
  'Déplacement administratif':   { icon: '🚗', color: '#0ea5e9', requiresProject: false },
  'Repas':                       { icon: '🍽️', color: '#ec4899', requiresProject: false },
  'Fournitures de bureau':       { icon: '🖊️', color: '#10b981', requiresProject: false },
  'Dépenses informatiques':      { icon: '💻', color: '#6366f1', requiresProject: false },
  'Licence':                     { icon: '📜', color: '#a855f7', requiresProject: false },
  'Communications':              { icon: '📡', color: '#06b6d4', requiresProject: false },
  'Entretien de l\'immeuble':    { icon: '🏢', color: '#84cc16', requiresProject: false },
  'Autres':                      { icon: '📋', color: '#94a3b8', requiresProject: false },
};

export const CATEGORIES_WITH_PROJECT = Object.entries(CATEGORIES)
  .filter(([, v]) => v.requiresProject)
  .map(([k]) => k);

// ─── Taux de taxes (Québec) ────────────────────────────────────────────────────
export const TPS_RATE  = 0.05;   // 5 %
export const TVQ_RATE  = 0.09975; // 9.975 %

// ─── Rôles ────────────────────────────────────────────────────────────────────
export const ROLES = {
  ADMIN:       'admin',
  APPROBATEUR: 'approbateur',
  EMPLOYEE:    'employee',
};

export const ROLE_LABELS = {
  admin:       '👑 Admin',
  approbateur: '✅ Approbateur',
  employee:    '👤 Employé',
};

export const ROLE_COLORS = {
  admin:       '#8b5cf6',
  approbateur: '#0ea5e9',
  employee:    '#10b981',
};

// ─── Statuts ──────────────────────────────────────────────────────────────────
export const STATUTS = ['En attente', 'Approuvé', 'Rejeté'];

// ─── Mois (pour le filtre) ────────────────────────────────────────────────────
export const MOIS_LABELS = [
  'Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre'
];

// ─── Prompts IA ───────────────────────────────────────────────────────────────
export const SYSTEM_PROMPT_IMAGE = `Tu es un assistant expert en comptabilité et gestion de dépenses d'entreprise de construction au Québec.
Analyse ce document (reçu, facture ou note de frais) et extrais les informations en JSON UNIQUEMENT :
{
  "fournisseur": "nom du fournisseur/magasin/émetteur",
  "date": "date au format YYYY-MM-DD si disponible, sinon null",
  "montant_ht": number (montant hors taxes, sans symbole),
  "tps": number ou null (TPS si visible sur le reçu),
  "tvq": number ou null (TVQ si visible sur le reçu),
  "montant_ttc": number (montant total toutes taxes comprises),
  "devise": "CAD ou USD ou EUR ou autre",
  "categorie": "l'une de ces catégories exactes: Déplacement chantier, Achat matériaux, Location équipement, Formation, Essence, Entretien et réparation, Déplacement administratif, Repas, Fournitures de bureau, Dépenses informatiques, Licence, Communications, Entretien de l'immeuble, Autres",
  "numero_projet": "numéro de projet si visible sur le reçu, sinon null",
  "description": "brève description de l'achat en 1-2 phrases",
  "items": [{"nom": "...", "montant": number}],
  "numero_recu": "numéro de reçu/facture si visible, sinon null"
}
Réponds UNIQUEMENT avec le JSON, sans markdown, sans explication.`;

export const SYSTEM_PROMPT_TEXT = `Tu es un assistant expert en comptabilité et gestion de dépenses d'entreprise de construction au Québec.
Voici le contenu textuel extrait d'un document. Extrais les informations en JSON UNIQUEMENT :
{
  "fournisseur": "nom du fournisseur/magasin/émetteur",
  "date": "date au format YYYY-MM-DD si disponible, sinon null",
  "montant_ht": number (montant hors taxes, sans symbole),
  "tps": number ou null (TPS 5% si visible),
  "tvq": number ou null (TVQ 9.975% si visible),
  "montant_ttc": number (montant total toutes taxes comprises),
  "devise": "CAD ou USD ou EUR ou autre",
  "categorie": "l'une de ces catégories exactes: Déplacement chantier, Achat matériaux, Location équipement, Formation, Essence, Entretien et réparation, Déplacement administratif, Repas, Fournitures de bureau, Dépenses informatiques, Licence, Communications, Entretien de l'immeuble, Autres",
  "numero_projet": "numéro de projet si visible, sinon null",
  "description": "brève description de l'achat en 1-2 phrases",
  "items": [{"nom": "...", "montant": number}],
  "numero_recu": "numéro de reçu/facture si visible, sinon null"
}
Réponds UNIQUEMENT avec le JSON, sans markdown, sans explication.`;
