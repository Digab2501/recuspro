import { useState, useEffect } from 'react';
import JSZip from 'jszip';
import { supabase } from '../lib/supabase';
import { CATEGORIES, STATUTS, TPS_RATE, TVQ_RATE } from '../lib/constants';
import { getFileIcon } from '../lib/fileUtils';

const calcTaxes = (r) => {
  const ht       = r.montant_ht  ?? (r.montant_ttc ? r.montant_ttc / (1 + TPS_RATE + TVQ_RATE) : r.montant ?? 0);
  const tps      = r.tps         ?? (ht * TPS_RATE);
  const tvq      = r.tvq         ?? (ht * TVQ_RATE);
  const ttc      = r.montant_ttc ?? (r.montant ?? ht + tps + tvq);
  const pourboire = r.pourboire  ?? 0;
  const total    = ttc + pourboire;
  return { ht, tps, tvq, ttc, pourboire, total };
};

const fmt = (n) => Number(n || 0).toLocaleString('fr-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const VIDE = '(Vide)';

// Colonnes filtrables / triables du tableau
// filterVal : texte affiché dans la liste du filtre — sortVal : valeur utilisée pour trier
const COLUMNS = [
  { key:'date',            label:'Date',        filterVal: r => r.date || VIDE,                   sortVal: r => r.date || '' },
  { key:'fournisseur',     label:'Fournisseur', filterVal: r => r.fournisseur || VIDE,            sortVal: r => (r.fournisseur || '').toLowerCase() },
  { key:'categorie',       label:'Catégorie',   filterVal: r => r.categorie || VIDE,              sortVal: r => (r.categorie || '').toLowerCase() },
  { key:'description',     label:'Descriptif',  filterVal: r => r.description || VIDE,            sortVal: r => (r.description || '').toLowerCase() },
  { key:'ht',              label:'Hors taxe',   filterVal: r => fmt(calcTaxes(r).ht) + ' $',      sortVal: r => calcTaxes(r).ht,        num:true },
  { key:'tps',             label:'TPS',         filterVal: r => fmt(calcTaxes(r).tps) + ' $',     sortVal: r => calcTaxes(r).tps,       num:true },
  { key:'tvq',             label:'TVQ',         filterVal: r => fmt(calcTaxes(r).tvq) + ' $',     sortVal: r => calcTaxes(r).tvq,       num:true },
  { key:'ttc',             label:'Avec taxes',  filterVal: r => fmt(calcTaxes(r).ttc) + ' $',     sortVal: r => calcTaxes(r).ttc,       num:true },
  { key:'pourboire',       label:'Pourboire',   filterVal: r => calcTaxes(r).pourboire > 0 ? fmt(calcTaxes(r).pourboire) + ' $' : VIDE, sortVal: r => calcTaxes(r).pourboire, num:true },
  { key:'total',           label:'Total',       filterVal: r => fmt(calcTaxes(r).total) + ' $',   sortVal: r => calcTaxes(r).total,     num:true },
  { key:'numero_projet',   label:'N° Projet',   filterVal: r => r.numero_projet || VIDE,          sortVal: r => (r.numero_projet || '').toLowerCase() },
  { key:'employe_nom',     label:'Employé',     filterVal: r => r.employe_nom || VIDE,            sortVal: r => (r.employe_nom || '').toLowerCase(),     approbOnly:true },
  { key:'approbateur_nom', label:'Approbateur', filterVal: r => r.approbateur_nom || VIDE,        sortVal: r => (r.approbateur_nom || '').toLowerCase(), approbOnly:true },
  { key:'statut',          label:'Statut',      filterVal: r => r.statut || VIDE,                 sortVal: r => (r.statut || '').toLowerCase() },
];

// ── Menu de filtre style Excel ──
function ColumnFilterMenu({ col, rows, selectedVals, sort, onSort, onApply, onClose, anchor }) {
  const allValues = Array.from(new Set(rows.map(col.filterVal)));
  // Trie la liste des valeurs (numérique pour les montants)
  const sample = Object.fromEntries(rows.map(r => [col.filterVal(r), col.sortVal(r)]));
  allValues.sort((a, b) => {
    if (a === VIDE) return 1;
    if (b === VIDE) return -1;
    const va = sample[a], vb = sample[b];
    return col.num ? va - vb : String(va).localeCompare(String(vb), 'fr');
  });

  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState(() => new Set(selectedVals ?? allValues));
  const visible = allValues.filter(v => v.toLowerCase().includes(search.toLowerCase()));
  const allVisibleChecked = visible.length > 0 && visible.every(v => draft.has(v));

  const toggle = (v) => setDraft(d => { const n = new Set(d); n.has(v) ? n.delete(v) : n.add(v); return n; });
  const toggleAll = () => setDraft(d => {
    const n = new Set(d);
    visible.forEach(v => allVisibleChecked ? n.delete(v) : n.add(v));
    return n;
  });

  const apply = () => {
    // Si une recherche est tapée, on ne garde que les valeurs visibles cochées (comme Excel)
    const kept = search ? visible.filter(v => draft.has(v)) : allValues.filter(v => draft.has(v));
    onApply(kept.length === allValues.length ? null : kept);
  };

  const menuBtn = (active) => ({
    width:'100%', textAlign:'left', background: active ? 'rgba(99,102,241,.15)' : 'transparent', border:'none',
    color: active ? '#a5b4fc' : '#cbd5e1', padding:'7px 10px', borderRadius:6, fontSize:12, cursor:'pointer', fontFamily:'inherit',
  });

  const left = Math.min(anchor.left, window.innerWidth - 270);

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:999 }} />
      <div onClick={e => e.stopPropagation()}
        style={{ position:'fixed', top:anchor.bottom + 4, left: Math.max(8, left), width:260, zIndex:1000,
          background:'#1e2433', border:'1px solid rgba(255,255,255,.1)', borderRadius:10, boxShadow:'0 12px 32px rgba(0,0,0,.5)',
          padding:8, textTransform:'none', letterSpacing:0, fontWeight:400 }}>
        <button style={menuBtn(sort.key === col.key && sort.dir === 'asc')}  onClick={() => onSort(col.key, 'asc')}>
          ↑ Trier {col.num ? 'du plus petit au plus grand' : 'de A à Z'}
        </button>
        <button style={menuBtn(sort.key === col.key && sort.dir === 'desc')} onClick={() => onSort(col.key, 'desc')}>
          ↓ Trier {col.num ? 'du plus grand au plus petit' : 'de Z à A'}
        </button>
        <div style={{ height:1, background:'rgba(255,255,255,.07)', margin:'6px 0' }} />
        <input autoFocus placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)}
          style={{ width:'100%', boxSizing:'border-box', background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.1)',
            borderRadius:6, color:'#e2e8f0', padding:'6px 10px', fontSize:12, fontFamily:'inherit', outline:'none', marginBottom:6 }} />
        <div style={{ maxHeight:220, overflowY:'auto', border:'1px solid rgba(255,255,255,.05)', borderRadius:6, padding:'4px 0' }}>
          <label style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 10px', fontSize:12, color:'#e2e8f0', cursor:'pointer', fontWeight:600 }}>
            <input type="checkbox" checked={allVisibleChecked} onChange={toggleAll} />
            (Tout sélectionner)
          </label>
          {visible.map(v => (
            <label key={v} style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 10px', fontSize:12, color:'#cbd5e1', cursor:'pointer' }}>
              <input type="checkbox" checked={draft.has(v)} onChange={() => toggle(v)} />
              <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{v}</span>
            </label>
          ))}
          {visible.length === 0 && <div style={{ padding:'8px 10px', fontSize:12, color:'#64748b' }}>Aucun résultat</div>}
        </div>
        <div style={{ display:'flex', gap:6, marginTop:8, justifyContent:'space-between' }}>
          <button onClick={() => onApply(null)}
            style={{ background:'transparent', border:'none', color:'#f87171', fontSize:12, cursor:'pointer', fontFamily:'inherit', padding:'6px 4px' }}>
            Effacer
          </button>
          <div style={{ display:'flex', gap:6 }}>
            <button onClick={onClose}
              style={{ background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.1)', color:'#94a3b8', borderRadius:6, padding:'6px 12px', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
              Annuler
            </button>
            <button onClick={apply} disabled={draft.size === 0}
              style={{ background:'linear-gradient(135deg,#6366f1,#8b5cf6)', border:'none', color:'#fff', borderRadius:6, padding:'6px 14px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', opacity: draft.size === 0 ? .5 : 1 }}>
              OK
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default function ReceiptsPage({ user, profile }) {
  const [receipts,    setReceipts]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [selected,    setSelected]    = useState(null);
  const [editing,     setEditing]     = useState(false);
  const [editForm,    setEditForm]    = useState({});
  const [filterCat,   setFilterCat]   = useState('Toutes');
  const [filterStat,  setFilterStat]  = useState('Tous');
  const [filterDateDe, setFilterDateDe] = useState('');
  const [filterDateA,  setFilterDateA]  = useState('');
  const [colFilters,   setColFilters]   = useState({});              // { colKey: [valeurs gardées] }
  const [sort,         setSort]         = useState({ key:'date', dir:'desc' });
  const [openMenu,     setOpenMenu]     = useState(null);            // { key, anchor }
  const [selectedIds,  setSelectedIds]  = useState(() => new Set());  // reçus cochés
  const [bulkBusy,     setBulkBusy]     = useState('');               // message pendant une action groupée

  const isAdmin       = profile.role === 'admin';
  const isApprobateur = profile.role === 'approbateur' || isAdmin;
  const canApprove    = isApprobateur;

  const loadReceipts = async () => {
    setLoading(true);
    let query = supabase.from('receipts').select('*').order('date', { ascending: false });
    if (!isApprobateur) query = query.eq('user_id', user.id);
    const { data } = await query;

    const receiptsWithUrls = await Promise.all((data || []).map(async (r) => {
      if (r.file_url && r.file_url.includes('/storage/v1/object/')) {
        const path = r.file_url.split('/receipts/')[1];
        if (path) {
          const { data: signed } = await supabase.storage
            .from('receipts')
            .createSignedUrl(path, 3600);
          return { ...r, file_url: signed?.signedUrl || r.file_url };
        }
      }
      return r;
    }));

    setReceipts(receiptsWithUrls);
    setLoading(false);
  };

  useEffect(() => { loadReceipts(); }, []); // eslint-disable-line

  const saveEdit = async () => {
    const ht  = parseFloat(editForm.montant_ht) || 0;
    const tps = parseFloat(editForm.tps)         || 0;
    const tvq = parseFloat(editForm.tvq)         || 0;
    const pourboire = parseFloat(editForm.pourboire) || 0;
    const ttc = ht + tps + pourboire + tvq;
    const updates = {
      montant_ht:    ht,
      tps:           tps,
      tvq:           tvq,
      pourboire:     pourboire,
      montant_ttc:   ttc,
      montant:       ttc,
      numero_projet: editForm.numero_projet || '',
      categorie:     editForm.categorie,
      description:   editForm.description  || '',
    };
    await supabase.from('receipts').update(updates).eq('id', selected.id);
    setReceipts(prev => prev.map(r => r.id === selected.id ? { ...r, ...updates } : r));
    setSelected(s => ({ ...s, ...updates }));
    setEditing(false);
  };

  const deleteReceipt = async (id) => {
    if (!window.confirm('Supprimer ce reçu définitivement ?')) return;
    await supabase.from('receipts').delete().eq('id', id);
    setReceipts(prev => prev.filter(r => r.id !== id));
    setSelected(null);
  };

  const updateStatut = async (id, statut) => {
    await supabase.from('receipts').update({
      statut,
      updated_by:      user.id,
      approbateur_nom: `${profile.prenom} ${profile.nom}`,
    }).eq('id', id);
    setReceipts(prev => prev.map(r => r.id === id ? { ...r, statut } : r));
    if (selected?.id === id) setSelected(s => ({ ...s, statut }));
  };

  const downloadCSV = () => {
    const rows = [
      ['Date','Fournisseur','Catégorie','Descriptif','Hors Taxe','TPS','TVQ','Pourboire','Avec Taxe','N° Projet','Devise','Employé','Approbateur','Statut'],
      ...filtered.map(r => {
        const { ht, tps, tvq, ttc, pourboire } = calcTaxes(r);
        return [r.date||'', r.fournisseur, r.categorie, r.description||'', fmt(ht), fmt(tps), fmt(tvq), fmt(pourboire), fmt(ttc), r.numero_projet||'', r.devise||'CAD', r.employe_nom, r.approbateur_nom||'', r.statut];
      }),
    ];
    const csv = rows.map(row => row.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\uFEFF'+csv], { type:'text/csv;charset=utf-8;' }));
    a.download = `depenses_${filterDateDe||'debut'}_${filterDateA||'fin'}.csv`;
    a.click();
  };

  const visibleColumns = COLUMNS.filter(c => !c.approbOnly || isApprobateur);

  // 1) Filtres du haut (période, catégorie, statut)
  const baseFiltered = receipts.filter(r => {
    if (filterCat    !== 'Toutes' && r.categorie !== filterCat)  return false;
    if (filterStat   !== 'Tous'   && r.statut    !== filterStat) return false;
    if (filterDateDe && r.date    <  filterDateDe)               return false;
    if (filterDateA  && r.date    >  filterDateA)                return false;
    return true;
  });

  // 2) Filtres de colonnes (on peut en exclure une, pour construire la liste de son propre menu)
  const applyColFilters = (rows, exceptKey) => rows.filter(r =>
    Object.entries(colFilters).every(([key, vals]) => {
      if (key === exceptKey || !vals) return true;
      const col = COLUMNS.find(c => c.key === key);
      return !col || vals.includes(col.filterVal(r));
    })
  );

  // 3) Tri
  const sortCol = COLUMNS.find(c => c.key === sort.key);
  const filtered = applyColFilters(baseFiltered).sort((a, b) => {
    if (!sortCol) return 0;
    const va = sortCol.sortVal(a), vb = sortCol.sortVal(b);
    const cmp = sortCol.num ? va - vb : String(va).localeCompare(String(vb), 'fr');
    return sort.dir === 'asc' ? cmp : -cmp;
  });

  const activeColFilters = Object.values(colFilters).filter(Boolean).length;

  // ── Sélection multiple ──
  // On n'agit que sur les reçus cochés ET visibles avec les filtres actuels
  const selectedRows   = filtered.filter(r => selectedIds.has(r.id));
  const allChecked     = filtered.length > 0 && selectedRows.length === filtered.length;
  const someChecked    = selectedRows.length > 0 && !allChecked;
  const canDeleteRow   = (r) => isAdmin || r.user_id === user.id;

  const toggleRow = (id) => setSelectedIds(s => {
    const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n;
  });
  const toggleAllRows = () => setSelectedIds(allChecked ? new Set() : new Set(filtered.map(r => r.id)));
  const clearSelection = () => setSelectedIds(new Set());

  const safeName = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 60);

  const guessExt = (r, blob) => {
    const fromName = (r.file_name || '').split('.').pop();
    if (fromName && fromName.length <= 5 && fromName !== r.file_name) return fromName.toLowerCase();
    const type = blob?.type || r.file_type || '';
    if (type.includes('pdf'))  return 'pdf';
    if (type.includes('png'))  return 'png';
    if (type.includes('webp')) return 'webp';
    if (type.includes('heic')) return 'heic';
    return 'jpg';
  };

  const downloadSelected = async () => {
    const rows = selectedRows.filter(r => r.file_url);
    if (rows.length === 0) { window.alert('Aucun document source pour les reçus sélectionnés.'); return; }

    // Tous les documents sont regroupés dans un seul fichier .zip
    const zip = new JSZip();
    const used = new Set();
    const failed = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      setBulkBusy(`Téléchargement ${i + 1} / ${rows.length}…`);
      try {
        const res = await fetch(r.file_url);
        if (!res.ok) throw new Error(res.status);
        const blob = await res.blob();
        const base = [r.date || 'sans-date', safeName(r.fournisseur) || 'recu', fmt(calcTaxes(r).total).replace(/\s/g, '').replace(',', '.') + '$'].join('_');
        let name = `${base}.${guessExt(r, blob)}`;
        for (let n = 2; used.has(name); n++) name = `${base}_${n}.${guessExt(r, blob)}`;
        used.add(name);
        zip.file(name, blob);
      } catch {
        failed.push(r.fournisseur || r.id);
      }
    }

    if (used.size > 0) {
      setBulkBusy('Création du fichier .zip…');
      const content = await zip.generateAsync({ type:'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(content);
      a.download = `recus_${new Date().toISOString().slice(0, 10)}_${used.size}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    }
    setBulkBusy('');

    const noFile = selectedRows.length - rows.length;
    const notes = [];
    if (noFile > 0)        notes.push(`${noFile} reçu(s) sans document source ont été ignorés.`);
    if (failed.length > 0) notes.push(`${failed.length} document(s) n'ont pas pu être téléchargés : ${failed.join(', ')}`);
    if (notes.length) window.alert(notes.join('\n'));
  };

  const deleteSelected = async () => {
    const deletable = selectedRows.filter(canDeleteRow);
    const blocked   = selectedRows.length - deletable.length;
    if (deletable.length === 0) { window.alert("Vous n'avez pas le droit de supprimer les reçus sélectionnés."); return; }

    const total = deletable.reduce((s, r) => s + calcTaxes(r).total, 0);
    const msg = `Supprimer définitivement ${deletable.length} reçu(s) pour un total de ${fmt(total)} $ ?`
      + (blocked > 0 ? `\n\n(${blocked} reçu(s) seront ignorés : vous ne pouvez supprimer que les vôtres.)` : '')
      + '\n\nCette action est irréversible.';
    if (!window.confirm(msg)) return;

    setBulkBusy(`Suppression de ${deletable.length} reçu(s)…`);
    const ids = deletable.map(r => r.id);
    const { data, error } = await supabase.from('receipts').delete().in('id', ids).select('id');
    setBulkBusy('');

    const deletedIds = new Set((data || []).map(d => d.id));
    setReceipts(prev => prev.filter(r => !deletedIds.has(r.id)));
    setSelectedIds(s => { const n = new Set(s); deletedIds.forEach(id => n.delete(id)); return n; });

    if (error) {
      window.alert(`Erreur lors de la suppression : ${error.message}`);
    } else if (deletedIds.size < ids.length) {
      window.alert(`${deletedIds.size} reçu(s) supprimé(s) sur ${ids.length}.\nLes autres ont été refusés par la base de données (droits de suppression).`);
    }
  };

  const clickHeader = (key) => setSort(s =>
    s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir:'asc' }
  );

  const totaux = filtered.reduce((acc, r) => {
    const { ht, tps, tvq, pourboire, total } = calcTaxes(r);
    acc.ht += ht;
    acc.tps += tps;
    acc.tvq += tvq;
    acc.pourboire += pourboire;
    acc.ttc += total;
    return acc;
  }, { ht:0, tps:0, tvq:0, pourboire:0, ttc:0 });

  const statStyle = (s) => ({
    'En attente': { bg:'rgba(245,158,11,.15)',  color:'#f59e0b' },
    'Approuvé':   { bg:'rgba(16,185,129,.15)',  color:'#10b981' },
    'Rejeté':     { bg:'rgba(239,68,68,.15)',   color:'#ef4444' },
  }[s] || { bg:'rgba(100,116,139,.15)', color:'#64748b' });

  const inputStyle = {
    background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.1)',
    borderRadius:8, color:'#e2e8f0', padding:'7px 12px',
    fontFamily:'inherit', fontSize:13, outline:'none',
  };

  // ══════════════════════════════════════════════
  // VUE DÉTAIL
  // ══════════════════════════════════════════════
  if (selected) {
    const { ht, tps, tvq, ttc, pourboire, total } = calcTaxes(selected);
    const cat = CATEGORIES[selected.categorie] || { icon:'📋', color:'#94a3b8' };
    return (
      <div style={{ maxWidth:720 }}>

        {/* Boutons d'action */}
        <div style={{ display:'flex', gap:8, marginBottom:20, flexWrap:'wrap' }}>
          <button onClick={() => { setSelected(null); setEditing(false); }}
            style={{ background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.07)', borderRadius:10, color:'#94a3b8', padding:'9px 18px', fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>
            ← Retour
          </button>
          <button onClick={() => {
            setEditForm({
              montant_ht:    calcTaxes(selected).ht,
              tps:           calcTaxes(selected).tps,
              tvq:           calcTaxes(selected).tvq,
              numero_projet: selected.numero_projet || '',
              categorie:     selected.categorie,
              description:   selected.description  || '',
            });
            setEditing(true);
          }}
            style={{ background:'rgba(99,102,241,.1)', border:'1px solid rgba(99,102,241,.2)', borderRadius:10, color:'#a5b4fc', padding:'9px 18px', fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>
            ✏️ Modifier
          </button>
          {(isAdmin || selected.user_id === user.id) && (
            <button onClick={() => deleteReceipt(selected.id)}
              style={{ background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.2)', borderRadius:10, color:'#f87171', padding:'9px 18px', fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>
              🗑 Supprimer
            </button>
          )}
        </div>

        {/* Formulaire d'édition */}
        {editing && (
          <div style={{ background:'#1a1f2e', borderRadius:14, border:'1px solid rgba(99,102,241,.3)', padding:24, marginBottom:16 }}>
            <div style={{ fontSize:12, color:'#6366f1', fontWeight:700, textTransform:'uppercase', letterSpacing:1, marginBottom:16 }}>✏️ Modifier le reçu</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              {[
                ['Montant HT ($)', 'montant_ht',    'number'],
                ['TPS ($)',        'tps',            'number'],
                ['TVQ ($)',        'tvq',            'number'],
                ['N° Projet',     'numero_projet',  'text'  ],
              ].map(([label, key, type]) => (
                <div key={key}>
                  <label style={{ fontSize:11, color:'#64748b', display:'block', marginBottom:4 }}>{label}</label>
                  <input type={type} value={editForm[key] || ''} onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                    style={{ width:'100%', background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.1)', borderRadius:8, color:'#e2e8f0', padding:'9px 12px', fontFamily:'inherit', fontSize:13, outline:'none', boxSizing:'border-box' }} />
                </div>
              ))}
              <div style={{ gridColumn:'1/-1' }}>
                <label style={{ fontSize:11, color:'#64748b', display:'block', marginBottom:4 }}>Catégorie</label>
                <select value={editForm.categorie || ''} onChange={e => setEditForm(f => ({ ...f, categorie: e.target.value }))}
                  style={{ width:'100%', background:'#1a1f2e', border:'1px solid rgba(255,255,255,.1)', borderRadius:8, color:'#e2e8f0', padding:'9px 12px', fontFamily:'inherit', fontSize:13, outline:'none' }}>
                  {Object.keys(CATEGORIES).map(c => <option key={c} value={c}>{CATEGORIES[c].icon} {c}</option>)}
                </select>
              </div>
              <div style={{ gridColumn:'1/-1' }}>
                <label style={{ fontSize:11, color:'#64748b', display:'block', marginBottom:4 }}>Descriptif</label>
                <input value={editForm.description || ''} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                  style={{ width:'100%', background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.1)', borderRadius:8, color:'#e2e8f0', padding:'9px 12px', fontFamily:'inherit', fontSize:13, outline:'none', boxSizing:'border-box' }} />
              </div>
            </div>
            <div style={{ display:'flex', gap:8, marginTop:16 }}>
              <button onClick={saveEdit}
                style={{ background:'linear-gradient(135deg,#6366f1,#8b5cf6)', color:'#fff', border:'none', borderRadius:8, padding:'10px 20px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                💾 Sauvegarder
              </button>
              <button onClick={() => setEditing(false)}
                style={{ background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.07)', color:'#94a3b8', borderRadius:8, padding:'10px 20px', fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>
                Annuler
              </button>
            </div>
          </div>
        )}

        {/* En-tête reçu */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24, flexWrap:'wrap', gap:12 }}>
          <div>
            <h1 style={{ fontSize:22, fontWeight:700, marginBottom:4 }}>{selected.fournisseur}</h1>
            <span style={{ fontSize:12, color:'#475569' }}>{selected.employe_nom} · {selected.date || 'date inconnue'}</span>
          </div>
          {canApprove && (
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {STATUTS.map(s => (
                <button key={s} onClick={() => updateStatut(selected.id, s)}
                  style={{ padding:'8px 14px', borderRadius:10, border:'1px solid', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit',
                    background:  selected.statut === s ? statStyle(s).bg  : 'rgba(255,255,255,.03)',
                    color:       selected.statut === s ? statStyle(s).color : '#475569',
                    borderColor: selected.statut === s ? `${statStyle(s).color}44` : 'rgba(255,255,255,.07)' }}>
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Infos + Taxes */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
          <div style={{ background:'#1a1f2e', borderRadius:14, border:'1px solid rgba(255,255,255,.06)', padding:20 }}>
            <div style={{ fontSize:10, color:'#475569', fontWeight:700, textTransform:'uppercase', letterSpacing:1, marginBottom:12 }}>Informations</div>
            {[
              ['Catégorie',      `${cat.icon} ${selected.categorie}`],
              ['N° Projet',      selected.numero_projet    || '—'],
              ['Employé',        selected.employe_nom],
              ['Approbateur',    selected.approbateur_nom  || '—'],
              ['Date',           selected.date             || 'Non détectée'],
              ['N° reçu',        selected.numero_recu      || '—'],
              ['Note',           selected.note             || '—'],
            ].map(([k, v]) => (
              <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:'1px solid rgba(255,255,255,.04)', fontSize:13 }}>
                <span style={{ color:'#64748b' }}>{k}</span>
                <span style={{ color:'#e2e8f0', textAlign:'right', maxWidth:'60%' }}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{ background:'#1a1f2e', borderRadius:14, border:'1px solid rgba(255,255,255,.06)', padding:20 }}>
            <div style={{ fontSize:10, color:'#475569', fontWeight:700, textTransform:'uppercase', letterSpacing:1, marginBottom:12 }}>Détail des montants</div>
            {[
              ['Hors taxe',    fmt(ht),  '#e2e8f0'],
              ['TPS (5%)',     fmt(tps), '#94a3b8'],
              ['TVQ (9.975%)', fmt(tvq), '#94a3b8'],
              ['Pourboire',    fmt(pourboire), '#94a3b8'],
            ].map(([k, v, c]) => (
              <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:'1px solid rgba(255,255,255,.04)', fontSize:13 }}>
                <span style={{ color:'#64748b' }}>{k}</span>
                <span style={{ color:c, fontFamily:"'DM Mono',monospace" }}>{v} $</span>
              </div>
            ))}
            <div style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:'1px solid rgba(255,255,255,.04)', fontSize:13 }}>
              <span style={{ color:'#64748b' }}>Avec taxes</span>
              <span style={{ color:'#e2e8f0', fontFamily:"'DM Mono',monospace" }}>{fmt(ttc)} $</span>
            </div>
            {pourboire > 0 && (
              <div style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:'1px solid rgba(255,255,255,.04)', fontSize:13 }}>
                <span style={{ color:'#64748b' }}>Pourboire</span>
                <span style={{ color:'#f59e0b', fontFamily:"'DM Mono',monospace" }}>{fmt(pourboire)} $</span>
              </div>
            )}
            <div style={{ display:'flex', justifyContent:'space-between', padding:'10px 0 0', fontSize:16, fontWeight:700 }}>
              <span style={{ color:'#94a3b8' }}>Total</span>
              <span style={{ color:'#a5b4fc', fontFamily:"'DM Mono',monospace" }}>{fmt(total)} {selected.devise || 'CAD'}</span>
            </div>
            <div style={{ marginTop:14 }}>
              <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'5px 12px', borderRadius:20, fontSize:12, fontWeight:700, ...statStyle(selected.statut) }}>
                {selected.statut}
              </span>
            </div>
          </div>
        </div>

        {/* Description */}
        {selected.description && (
          <div style={{ background:'#1a1f2e', borderRadius:14, border:'1px solid rgba(255,255,255,.06)', padding:20, marginBottom:16, fontSize:13, color:'#94a3b8', lineHeight:1.6 }}>
            <div style={{ fontSize:10, color:'#475569', fontWeight:700, textTransform:'uppercase', letterSpacing:1, marginBottom:8 }}>Descriptif</div>
            {selected.description}
          </div>
        )}

        {/* Items */}
        {selected.items?.length > 0 && (
          <div style={{ background:'#1a1f2e', borderRadius:14, border:'1px solid rgba(255,255,255,.06)', padding:20, marginBottom:16 }}>
            <div style={{ fontSize:10, color:'#475569', fontWeight:700, textTransform:'uppercase', letterSpacing:1, marginBottom:12 }}>Articles détectés</div>
            {selected.items.map((item, i) => (
              <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:'1px solid rgba(255,255,255,.04)', fontSize:13 }}>
                <span>{item.nom}</span>
                <span style={{ color:'#a5b4fc', fontFamily:"'DM Mono',monospace" }}>{fmt(item.montant)} $</span>
              </div>
            ))}
          </div>
        )}

        {/* Document */}
        <div style={{ background:'#1a1f2e', borderRadius:14, border:'1px solid rgba(255,255,255,.06)', padding:16 }}>
          <div style={{ fontSize:10, color:'#475569', fontWeight:700, textTransform:'uppercase', letterSpacing:1, marginBottom:12 }}>Document source</div>
          {selected.preview_url || selected.file_url ? (
            <img src={selected.preview_url || selected.file_url} alt="document" style={{ width:'100%', borderRadius:10, maxHeight:500, objectFit:'contain', background:'#0f1117' }} />
          ) : (
            <div style={{ background:'#0f1117', borderRadius:10, padding:32, textAlign:'center' }}>
              <div style={{ fontSize:48, marginBottom:10 }}>{getFileIcon(selected.file_type)}</div>
              <div style={{ fontSize:13, color:'#475569' }}>{selected.file_name}</div>
            </div>
          )}
          {selected.file_url && (
            <a href={selected.file_url} target="_blank" rel="noreferrer"
              style={{ display:'inline-flex', alignItems:'center', gap:6, marginTop:12, color:'#6366f1', fontSize:13, textDecoration:'none', fontWeight:600 }}>
              ⬇ Télécharger le document original
            </a>
          )}
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════
  // VUE LISTE
  // ══════════════════════════════════════════════
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, marginBottom:4 }}>{isApprobateur ? 'Tous les reçus' : 'Mes reçus'}</h1>
          <p style={{ color:'#64748b', fontSize:14 }}>{filtered.length} reçu(s) affiché(s)</p>
        </div>
        {isApprobateur && (
          <button onClick={downloadCSV}
            style={{ background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.07)', color:'#94a3b8', borderRadius:10, padding:'10px 18px', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
            📥 Exporter CSV
          </button>
        )}
      </div>

      {/* Filtres période */}
      <div style={{ background:'#1a1f2e', border:'1px solid rgba(255,255,255,.06)', borderRadius:12, padding:'14px 18px', marginBottom:16, display:'flex', gap:12, flexWrap:'wrap', alignItems:'center' }}>
        <span style={{ fontSize:12, color:'#64748b', fontWeight:600 }}>📅 Période :</span>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <label style={{ fontSize:12, color:'#64748b' }}>De :</label>
          <input type="date" value={filterDateDe} onChange={e => setFilterDateDe(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <label style={{ fontSize:12, color:'#64748b' }}>À :</label>
          <input type="date" value={filterDateA} onChange={e => setFilterDateA(e.target.value)} style={inputStyle} />
        </div>
        {(filterDateDe || filterDateA) && (
          <button onClick={() => { setFilterDateDe(''); setFilterDateA(''); }}
            style={{ background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.2)', color:'#f87171', borderRadius:8, padding:'6px 12px', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
            ✕ Réinitialiser
          </button>
        )}
      </div>

      {/* Filtres catégorie */}
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:8 }}>
        {['Toutes', ...Object.keys(CATEGORIES)].map(cat => (
          <button key={cat} onClick={() => setFilterCat(cat)}
            style={{ padding:'5px 11px', fontSize:11, borderRadius:20, border:'1px solid', cursor:'pointer', fontFamily:'inherit', fontWeight:500,
              background:  filterCat === cat ? 'rgba(99,102,241,.2)' : 'rgba(255,255,255,.03)',
              color:       filterCat === cat ? '#a5b4fc' : '#64748b',
              borderColor: filterCat === cat ? 'rgba(99,102,241,.4)' : 'rgba(255,255,255,.07)' }}>
            {cat !== 'Toutes' ? CATEGORIES[cat]?.icon+' ' : ''}{cat}
          </button>
        ))}
      </div>

      {/* Filtres statut */}
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:20 }}>
        {['Tous', ...STATUTS].map(s => (
          <button key={s} onClick={() => setFilterStat(s)}
            style={{ padding:'5px 11px', fontSize:11, borderRadius:20, border:'1px solid', cursor:'pointer', fontFamily:'inherit', fontWeight:500,
              background:  filterStat === s ? 'rgba(99,102,241,.2)' : 'rgba(255,255,255,.03)',
              color:       filterStat === s ? '#a5b4fc' : '#64748b',
              borderColor: filterStat === s ? 'rgba(99,102,241,.4)' : 'rgba(255,255,255,.07)' }}>
            {s}
          </button>
        ))}
        {activeColFilters > 0 && (
          <button onClick={() => setColFilters({})}
            style={{ marginLeft:'auto', padding:'5px 11px', fontSize:11, borderRadius:20, border:'1px solid rgba(239,68,68,.3)', background:'rgba(239,68,68,.1)', color:'#f87171', cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>
            ✕ Effacer les filtres de colonnes ({activeColFilters})
          </button>
        )}
      </div>

      {/* Sommaire taxes */}
      {filtered.length > 0 && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:12, marginBottom:20 }}>
          {[
            { label:'Hors taxe',    value:fmt(totaux.ht),       color:'#e2e8f0' },
            { label:'TPS (5%)',     value:fmt(totaux.tps),      color:'#94a3b8' },
            { label:'TVQ (9.975%)', value:fmt(totaux.tvq),      color:'#94a3b8' },
            { label:'Pourboire',    value:fmt(totaux.pourboire),color:'#94a3b8' },
            { label:'Avec taxes',   value:fmt(totaux.ttc),      color:'#a5b4fc' },
          ].map(c => (
            <div key={c.label} style={{ background:'#1a1f2e', borderRadius:10, border:'1px solid rgba(255,255,255,.06)', padding:'12px 16px' }}>
              <div style={{ fontSize:10, color:'#475569', fontWeight:700, textTransform:'uppercase', letterSpacing:1, marginBottom:4 }}>{c.label}</div>
              <div style={{ fontSize:18, fontWeight:700, color:c.color, fontFamily:"'DM Mono',monospace" }}>{c.value} $</div>
            </div>
          ))}
        </div>
      )}

      {/* Barre d'actions groupées */}
      {selectedRows.length > 0 && (() => {
        const selTotal = selectedRows.reduce((s, r) => s + calcTaxes(r).total, 0);
        const nbDeletable = selectedRows.filter(canDeleteRow).length;
        const actionBtn = (bg, border, color) => ({
          background:bg, border:`1px solid ${border}`, color, borderRadius:8, padding:'8px 14px', fontSize:13, fontWeight:600,
          cursor: bulkBusy ? 'wait' : 'pointer', fontFamily:'inherit', opacity: bulkBusy ? .6 : 1, whiteSpace:'nowrap',
        });
        return (
          <div style={{ position:'sticky', top:0, zIndex:50, display:'flex', alignItems:'center', gap:10, flexWrap:'wrap',
            background:'#232a3d', border:'1px solid rgba(99,102,241,.35)', borderRadius:12, padding:'10px 16px', marginBottom:12,
            boxShadow:'0 8px 24px rgba(0,0,0,.35)' }}>
            <span style={{ fontSize:13, fontWeight:700, color:'#e2e8f0' }}>
              {selectedRows.length} reçu(s) sélectionné(s)
            </span>
            <span style={{ fontSize:13, color:'#a5b4fc', fontFamily:"'DM Mono',monospace" }}>· {fmt(selTotal)} $</span>
            {bulkBusy && <span style={{ fontSize:12, color:'#94a3b8' }}>⏳ {bulkBusy}</span>}
            <div style={{ marginLeft:'auto', display:'flex', gap:8, flexWrap:'wrap' }}>
              <button disabled={!!bulkBusy} onClick={downloadSelected}
                style={actionBtn('rgba(99,102,241,.15)', 'rgba(99,102,241,.4)', '#c7d2fe')}>
                ⬇ Télécharger les reçus (.zip)
              </button>
              {nbDeletable > 0 && (
                <button disabled={!!bulkBusy} onClick={deleteSelected}
                  style={actionBtn('rgba(239,68,68,.12)', 'rgba(239,68,68,.35)', '#f87171')}>
                  🗑 Supprimer ({nbDeletable})
                </button>
              )}
              <button disabled={!!bulkBusy} onClick={clearSelection}
                style={actionBtn('rgba(255,255,255,.04)', 'rgba(255,255,255,.1)', '#94a3b8')}>
                ✕ Désélectionner
              </button>
            </div>
          </div>
        );
      })()}

      {/* Tableau */}
      {loading ? (
        <div style={{ textAlign:'center', padding:48, color:'#475569' }}>Chargement…</div>
      ) : baseFiltered.length === 0 ? (
        <div style={{ background:'#1a1f2e', borderRadius:16, border:'1px solid rgba(255,255,255,.06)', padding:48, textAlign:'center' }}>
          <div style={{ fontSize:40, marginBottom:12 }}>📂</div>
          <div style={{ fontWeight:600, marginBottom:6 }}>Aucun reçu</div>
          <div style={{ fontSize:13, color:'#475569' }}>Modifiez vos filtres ou soumettez un premier document</div>
        </div>
      ) : (
        <div style={{ background:'#1a1f2e', borderRadius:16, border:'1px solid rgba(255,255,255,.06)', overflow:'hidden' }}>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', minWidth:900 }}>
              <thead>
                <tr style={{ borderBottom:'1px solid rgba(255,255,255,.06)' }}>
                  <th style={{ padding:'8px 4px 8px 14px', width:20 }}>
                    <input type="checkbox" title="Tout sélectionner"
                      checked={allChecked}
                      ref={el => { if (el) el.indeterminate = someChecked; }}
                      onChange={toggleAllRows}
                      style={{ cursor:'pointer', accentColor:'#6366f1', width:15, height:15 }} />
                  </th>
                  <th style={{ padding:'12px' }} />
                  {visibleColumns.map(col => {
                    const isSorted   = sort.key === col.key;
                    const isFiltered = !!colFilters[col.key];
                    return (
                      <th key={col.key} style={{ padding:'8px 6px 8px 12px', textAlign:'left', fontSize:10, fontWeight:600, color: isSorted || isFiltered ? '#a5b4fc' : '#475569', textTransform:'uppercase', letterSpacing:.5, whiteSpace:'nowrap' }}>
                        <div style={{ display:'inline-flex', alignItems:'center', gap:4 }}>
                          <span onClick={() => clickHeader(col.key)} title="Cliquer pour trier"
                            style={{ cursor:'pointer', userSelect:'none' }}>
                            {col.label}{isSorted ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                          </span>
                          <button title="Filtrer"
                            onClick={e => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setOpenMenu(m => m?.key === col.key ? null : { key: col.key, anchor: rect });
                            }}
                            style={{ background: isFiltered ? 'rgba(99,102,241,.25)' : 'rgba(255,255,255,.04)', border:'1px solid', borderColor: isFiltered ? 'rgba(99,102,241,.5)' : 'rgba(255,255,255,.08)',
                              color: isFiltered ? '#a5b4fc' : '#64748b', borderRadius:4, width:18, height:18, padding:0, fontSize:9, cursor:'pointer', lineHeight:1, display:'grid', placeItems:'center' }}>
                            {isFiltered ? '⧩' : '▾'}
                          </button>
                        </div>
                      </th>
                    );
                  })}
                  <th style={{ padding:'12px' }} />
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={visibleColumns.length + 3}style={{ padding:32, textAlign:'center', fontSize:13, color:'#64748b' }}>
                      Aucun reçu ne correspond aux filtres de colonnes.{' '}
                      <button onClick={() => setColFilters({})}
                        style={{ background:'none', border:'none', color:'#a5b4fc', cursor:'pointer', fontFamily:'inherit', fontSize:13, textDecoration:'underline' }}>
                        Effacer les filtres
                      </button>
                    </td>
                  </tr>
                )}
                {filtered.map(r => {
                  const { ht, tps, tvq, ttc, pourboire, total } = calcTaxes(r);
                  const cat = CATEGORIES[r.categorie] || { icon:'📋', color:'#94a3b8' };
                  const isChecked = selectedIds.has(r.id);
                  const rowBg = isChecked ? 'rgba(99,102,241,.08)' : '';
                  return (
                    <tr key={r.id} onClick={() => setSelected(r)}
                      style={{ borderBottom:'1px solid rgba(255,255,255,.04)', cursor:'pointer', transition:'background .15s', background: rowBg }}
                      onMouseEnter={e => e.currentTarget.style.background = isChecked ? 'rgba(99,102,241,.12)' : 'rgba(255,255,255,.03)'}
                      onMouseLeave={e => e.currentTarget.style.background = rowBg}>
                      <td onClick={e => { e.stopPropagation(); toggleRow(r.id); }}
                        style={{ padding:'10px 4px 10px 14px', width:20, cursor:'pointer' }}>
                        <input type="checkbox" checked={isChecked} readOnly
                          style={{ cursor:'pointer', accentColor:'#6366f1', width:15, height:15, pointerEvents:'none' }} />
                      </td>
                      <td style={{ padding:'10px 12px', width:44 }}>
                        {r.preview_url
                          ? <img src={r.preview_url} alt="" style={{ width:32, height:32, objectFit:'cover', borderRadius:6, display:'block' }} />
                          : <div style={{ width:32, height:32, borderRadius:6, background:'#0f1117', display:'grid', placeItems:'center', fontSize:14 }}>{getFileIcon(r.file_type)}</div>}
                      </td>
                      <td style={{ padding:'10px 12px', fontSize:12, color:'#64748b', fontFamily:"'DM Mono',monospace", whiteSpace:'nowrap' }}>{r.date || '—'}</td>
                      <td style={{ padding:'10px 12px', fontSize:13, fontWeight:600, whiteSpace:'nowrap' }}>{r.fournisseur}</td>
                      <td style={{ padding:'10px 12px' }}>
                        <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'3px 8px', borderRadius:20, fontSize:11, fontWeight:600, background:`${cat.color}20`, color:cat.color, whiteSpace:'nowrap' }}>
                          {cat.icon} {r.categorie}
                        </span>
                      </td>
                      <td style={{ padding:'10px 12px', fontSize:12, color:'#94a3b8', maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.description || '—'}</td>
                      <td style={{ padding:'10px 12px', fontSize:13, fontWeight:600, color:'#e2e8f0', fontFamily:"'DM Mono',monospace", whiteSpace:'nowrap' }}>{fmt(ht)} $</td>
                      <td style={{ padding:'10px 12px', fontSize:12, color:'#64748b', fontFamily:"'DM Mono',monospace", whiteSpace:'nowrap' }}>{fmt(tps)} $</td>
                      <td style={{ padding:'10px 12px', fontSize:12, color:'#64748b', fontFamily:"'DM Mono',monospace", whiteSpace:'nowrap' }}>{fmt(tvq)} $</td>
                      <td style={{ padding:'10px 12px', fontSize:13, fontWeight:600, color:'#e2e8f0', fontFamily:"'DM Mono',monospace", whiteSpace:'nowrap' }}>{fmt(ttc)} $</td>
                      <td style={{ padding:'10px 12px', fontSize:12, color: pourboire > 0 ? '#f59e0b' : '#334155', fontFamily:"'DM Mono',monospace", whiteSpace:'nowrap' }}>{pourboire > 0 ? fmt(pourboire)+' $' : '—'}</td>
                      <td style={{ padding:'10px 12px', fontSize:14, fontWeight:700, color:'#a5b4fc', fontFamily:"'DM Mono',monospace", whiteSpace:'nowrap' }}>{fmt(total)} $</td>
                      <td style={{ padding:'10px 12px', fontSize:12, color:r.numero_projet ? '#a5b4fc' : '#334155', whiteSpace:'nowrap' }}>{r.numero_projet || '—'}</td>
                      {isApprobateur && (
                        <>
                          <td style={{ padding:'10px 12px', fontSize:12, color:'#94a3b8', whiteSpace:'nowrap' }}>{r.employe_nom}</td>
                          <td style={{ padding:'10px 12px', fontSize:12, color:'#64748b', whiteSpace:'nowrap' }}>{r.approbateur_nom || '—'}</td>
                        </>
                      )}
                      <td style={{ padding:'10px 12px' }}>
                        <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'3px 8px', borderRadius:20, fontSize:11, fontWeight:600, ...statStyle(r.statut), whiteSpace:'nowrap' }}>
                          {r.statut}
                        </span>
                      </td>
                      <td style={{ padding:'10px 12px', color:'#334155', fontSize:16 }}>›</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Menu de filtre ouvert */}
      {openMenu && (() => {
        const col = COLUMNS.find(c => c.key === openMenu.key);
        return (
          <ColumnFilterMenu
            key={col.key}
            col={col}
            rows={applyColFilters(baseFiltered, col.key)}
            selectedVals={colFilters[col.key]}
            sort={sort}
            anchor={openMenu.anchor}
            onSort={(key, dir) => { setSort({ key, dir }); setOpenMenu(null); }}
            onApply={(vals) => { setColFilters(f => ({ ...f, [col.key]: vals })); setOpenMenu(null); }}
            onClose={() => setOpenMenu(null)}
          />
        );
      })()}
    </div>
  );
}
