import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { CATEGORIES, STATUTS, MOIS_LABELS, TPS_RATE, TVQ_RATE } from '../lib/constants';
import { getFileIcon } from '../lib/fileUtils';

// ─── Helpers taxes ─────────────────────────────────────────────────────────────
const calcTaxes = (r) => {
  const ht  = r.montant_ht  ?? (r.montant_ttc ? r.montant_ttc / (1 + TPS_RATE + TVQ_RATE) : r.montant ?? 0);
  const tps = r.tps         ?? (ht * TPS_RATE);
  const tvq = r.tvq         ?? (ht * TVQ_RATE);
  const ttc = r.montant_ttc ?? (r.montant ?? ht + tps + tvq);
  return { ht, tps, tvq, ttc };
};

const fmt = (n) => Number(n || 0).toFixed(2);

export default function ReceiptsPage({ user, profile }) {
  const [receipts,    setReceipts]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [selected,    setSelected]    = useState(null);
  const [filterCat,   setFilterCat]   = useState('Toutes');
  const [filterStat,  setFilterStat]  = useState('Tous');
  const [filterMonth, setFilterMonth] = useState('');   // '' = tous
  const [filterYear,  setFilterYear]  = useState('');   // '' = tous

  const isAdmin        = profile.role === 'admin';
  const isApprobateur  = profile.role === 'approbateur' || isAdmin;
  const canApprove     = isApprobateur;

  // ── Chargement ────────────────────────────────────────────────────────────────
  const loadReceipts = async () => {
    setLoading(true);
    let query = supabase.from('receipts').select('*').order('date', { ascending: false });
    if (!isApprobateur) query = query.eq('user_id', user.id);
    const { data } = await query;
    setReceipts(data || []);
    setLoading(false);
  };

  useEffect(() => { loadReceipts(); }, []); // eslint-disable-line

  // ── Mise à jour statut ────────────────────────────────────────────────────────
  const updateStatut = async (id, statut) => {
    await supabase.from('receipts').update({ statut, updated_by: user.id }).eq('id', id);
    setReceipts(prev => prev.map(r => r.id === id ? { ...r, statut } : r));
    if (selected?.id === id) setSelected(s => ({ ...s, statut }));
  };

  // ── Export CSV ────────────────────────────────────────────────────────────────
  const downloadCSV = () => {
    const rows = [
      ['Date', 'Fournisseur', 'Catégorie', 'Descriptif de la dépense', 'Hors Taxe', 'TPS', 'TVQ', 'Avec Taxe', 'N° Projet', 'Devise', 'Employé', 'Statut'],
      ...filtered.map(r => {
        const { ht, tps, tvq, ttc } = calcTaxes(r);
        return [r.date || '', r.fournisseur, r.categorie, r.description || '', fmt(ht), fmt(tps), fmt(tvq), fmt(ttc), r.numero_projet || '', r.devise, r.employe_nom, r.statut];
      }),
    ];
    const csv = rows.map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }));
    a.download = `depenses_${filterYear || 'tout'}${filterMonth ? `-${String(filterMonth).padStart(2,'0')}` : ''}.csv`;
    a.click();
  };

  // ── Filtres ───────────────────────────────────────────────────────────────────
  const availableYears = [...new Set(
    receipts.map(r => r.date?.slice(0, 4)).filter(Boolean)
  )].sort((a, b) => b - a);

  const filtered = receipts.filter(r => {
    if (filterCat  !== 'Toutes' && r.categorie !== filterCat)  return false;
    if (filterStat !== 'Tous'   && r.statut    !== filterStat) return false;
    if (filterYear  && !r.date?.startsWith(filterYear))        return false;
    if (filterMonth && r.date?.slice(5, 7) !== String(filterMonth).padStart(2, '0')) return false;
    return true;
  });

  // ── Totaux filtrés ────────────────────────────────────────────────────────────
  const totaux = filtered.reduce((acc, r) => {
    const { ht, tps, tvq, ttc } = calcTaxes(r);
    acc.ht  += ht;
    acc.tps += tps;
    acc.tvq += tvq;
    acc.ttc += ttc;
    return acc;
  }, { ht: 0, tps: 0, tvq: 0, ttc: 0 });

  const statStyle = (s) => ({
    'En attente': { bg: 'rgba(245,158,11,.15)',  color: '#f59e0b' },
    'Approuvé':   { bg: 'rgba(16,185,129,.15)',  color: '#10b981' },
    'Rejeté':     { bg: 'rgba(239,68,68,.15)',   color: '#ef4444' },
  }[s] || { bg: 'rgba(100,116,139,.15)', color: '#64748b' });

  const inputStyle = {
    background: 'rgba(255,255,255,.05)',
    border: '1px solid rgba(255,255,255,.1)',
    borderRadius: 8,
    color: '#e2e8f0',
    padding: '7px 12px',
    fontFamily: 'inherit',
    fontSize: 13,
    outline: 'none',
  };

  // ═══════════════════════════════════════════════════════════════════════════════
  // VUE DÉTAIL
  // ═══════════════════════════════════════════════════════════════════════════════
  if (selected) {
    const { ht, tps, tvq, ttc } = calcTaxes(selected);
    const cat = CATEGORIES[selected.categorie] || { icon: '📋', color: '#94a3b8' };
    return (
      <div style={{ maxWidth: 720 }}>
        <button onClick={() => setSelected(null)}
          style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 10, color: '#94a3b8', padding: '9px 18px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 20 }}>
          ← Retour
        </button>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{selected.fournisseur}</h1>
            <span style={{ fontSize: 12, color: '#475569' }}>{selected.employe_nom} · {selected.date || 'date inconnue'}</span>
          </div>
          {canApprove && (
            <div style={{ display: 'flex', gap: 8 }}>
              {STATUTS.map(s => (
                <button key={s} onClick={() => updateStatut(selected.id, s)}
                  style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                    background: selected.statut === s ? statStyle(s).bg : 'rgba(255,255,255,.03)',
                    color: selected.statut === s ? statStyle(s).color : '#475569',
                    borderColor: selected.statut === s ? `${statStyle(s).color}44` : 'rgba(255,255,255,.07)' }}>
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          {/* Infos */}
          <div style={{ background: '#1a1f2e', borderRadius: 14, border: '1px solid rgba(255,255,255,.06)', padding: 20 }}>
            <div style={{ fontSize: 10, color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Informations</div>
            {[
              ['Catégorie',    `${cat.icon} ${selected.categorie}`],
              ['N° Projet',    selected.numero_projet || '—'],
              ['Employé',      selected.employe_nom],
              ['Date',         selected.date || 'Non détectée'],
              ['N° reçu',      selected.numero_recu || '—'],
              ['Note',         selected.note || '—'],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,.04)', fontSize: 13 }}>
                <span style={{ color: '#64748b' }}>{k}</span>
                <span style={{ color: '#e2e8f0', textAlign: 'right', maxWidth: '60%' }}>{v}</span>
              </div>
            ))}
          </div>

          {/* Taxes */}
          <div style={{ background: '#1a1f2e', borderRadius: 14, border: '1px solid rgba(255,255,255,.06)', padding: 20 }}>
            <div style={{ fontSize: 10, color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Détail des montants</div>
            {[
              ['Hors taxe',  fmt(ht),  '#e2e8f0'],
              ['TPS (5%)',   fmt(tps), '#94a3b8'],
              ['TVQ (9.975%)', fmt(tvq), '#94a3b8'],
            ].map(([k, v, c]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,.04)', fontSize: 13 }}>
                <span style={{ color: '#64748b' }}>{k}</span>
                <span style={{ color: c, fontFamily: "'DM Mono',monospace" }}>{v} $</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 0', fontSize: 16, fontWeight: 700 }}>
              <span style={{ color: '#94a3b8' }}>Avec taxes</span>
              <span style={{ color: '#a5b4fc', fontFamily: "'DM Mono',monospace" }}>{fmt(ttc)} {selected.devise}</span>
            </div>
            <div style={{ marginTop: 14 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, ...statStyle(selected.statut) }}>
                {selected.statut}
              </span>
            </div>
          </div>
        </div>

        {/* Description */}
        {selected.description && (
          <div style={{ background: '#1a1f2e', borderRadius: 14, border: '1px solid rgba(255,255,255,.06)', padding: 20, marginBottom: 16, fontSize: 13, color: '#94a3b8', lineHeight: 1.6 }}>
            <div style={{ fontSize: 10, color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Descriptif</div>
            {selected.description}
          </div>
        )}

        {/* Items */}
        {selected.items?.length > 0 && (
          <div style={{ background: '#1a1f2e', borderRadius: 14, border: '1px solid rgba(255,255,255,.06)', padding: 20, marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Articles détectés</div>
            {selected.items.map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,.04)', fontSize: 13 }}>
                <span>{item.nom}</span>
                <span style={{ color: '#a5b4fc', fontFamily: "'DM Mono',monospace" }}>{fmt(item.montant)} $</span>
              </div>
            ))}
          </div>
        )}

        {/* Document */}
        <div style={{ background: '#1a1f2e', borderRadius: 14, border: '1px solid rgba(255,255,255,.06)', padding: 16 }}>
          <div style={{ fontSize: 10, color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Document source</div>
          {selected.preview_url || selected.file_url ? (
            <img src={selected.preview_url || selected.file_url} alt="document" style={{ width: '100%', borderRadius: 10, maxHeight: 500, objectFit: 'contain', background: '#0f1117' }} />
          ) : (
            <div style={{ background: '#0f1117', borderRadius: 10, padding: 32, textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 10 }}>{getFileIcon(selected.file_type)}</div>
              <div style={{ fontSize: 13, color: '#475569' }}>{selected.file_name}</div>
            </div>
          )}
          {selected.file_url && (
            <a href={selected.file_url} target="_blank" rel="noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 12, color: '#6366f1', fontSize: 13, textDecoration: 'none', fontWeight: 600 }}>
              ⬇ Télécharger le document original
            </a>
          )}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // VUE LISTE
  // ═══════════════════════════════════════════════════════════════════════════════
  return (
    <div>
      {/* En-tête */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
            {isApprobateur ? 'Tous les reçus' : 'Mes reçus'}
          </h1>
          <p style={{ color: '#64748b', fontSize: 14 }}>
            {filtered.length} reçu(s) affiché(s)
          </p>
        </div>
        {isApprobateur && (
          <button onClick={downloadCSV}
            style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.07)', color: '#94a3b8', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            📥 Exporter CSV
          </button>
        )}
      </div>

      {/* ── Filtres période ──────────────────────────────────────────────────── */}
      <div style={{ background: '#1a1f2e', border: '1px solid rgba(255,255,255,.06)', borderRadius: 12, padding: '14px 18px', marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>📅 Période :</span>

        <select value={filterYear} onChange={e => { setFilterYear(e.target.value); setFilterMonth(''); }} style={inputStyle}>
          <option value="">Toutes les années</option>
          {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
        </select>

        <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} disabled={!filterYear} style={{ ...inputStyle, opacity: filterYear ? 1 : .4 }}>
          <option value="">Tous les mois</option>
          {MOIS_LABELS.map((m, i) => <option key={i} value={String(i + 1).padStart(2, '0')}>{m}</option>)}
        </select>

        {(filterYear || filterMonth) && (
          <button onClick={() => { setFilterYear(''); setFilterMonth(''); }}
            style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', color: '#f87171', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
            ✕ Réinitialiser
          </button>
        )}
      </div>

      {/* ── Filtres catégorie + statut ────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {['Toutes', ...Object.keys(CATEGORIES)].map(cat => (
          <button key={cat} onClick={() => setFilterCat(cat)}
            style={{ padding: '5px 11px', fontSize: 11, borderRadius: 20, border: '1px solid', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
              background:   filterCat === cat ? 'rgba(99,102,241,.2)' : 'rgba(255,255,255,.03)',
              color:        filterCat === cat ? '#a5b4fc' : '#64748b',
              borderColor:  filterCat === cat ? 'rgba(99,102,241,.4)' : 'rgba(255,255,255,.07)' }}>
            {cat !== 'Toutes' ? CATEGORIES[cat]?.icon + ' ' : ''}{cat}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
        {['Tous', ...STATUTS].map(s => (
          <button key={s} onClick={() => setFilterStat(s)}
            style={{ padding: '5px 11px', fontSize: 11, borderRadius: 20, border: '1px solid', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
              background:  filterStat === s ? 'rgba(99,102,241,.2)' : 'rgba(255,255,255,.03)',
              color:       filterStat === s ? '#a5b4fc' : '#64748b',
              borderColor: filterStat === s ? 'rgba(99,102,241,.4)' : 'rgba(255,255,255,.07)' }}>
            {s}
          </button>
        ))}
      </div>

      {/* ── Sommaire taxes ───────────────────────────────────────────────────── */}
      {filtered.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Hors taxe',    value: fmt(totaux.ht),  color: '#e2e8f0' },
            { label: 'TPS (5%)',     value: fmt(totaux.tps), color: '#94a3b8' },
            { label: 'TVQ (9.975%)', value: fmt(totaux.tvq), color: '#94a3b8' },
            { label: 'Avec taxes',   value: fmt(totaux.ttc), color: '#a5b4fc' },
          ].map(c => (
            <div key={c.label} style={{ background: '#1a1f2e', borderRadius: 10, border: '1px solid rgba(255,255,255,.06)', padding: '12px 16px' }}>
              <div style={{ fontSize: 10, color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{c.label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: c.color, fontFamily: "'DM Mono',monospace" }}>{c.value} $</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Tableau ──────────────────────────────────────────────────────────── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#475569' }}>Chargement…</div>
      ) : filtered.length === 0 ? (
        <div style={{ background: '#1a1f2e', borderRadius: 16, border: '1px solid rgba(255,255,255,.06)', padding: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📂</div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Aucun reçu</div>
          <div style={{ fontSize: 13, color: '#475569' }}>Modifiez vos filtres ou soumettez un premier document</div>
        </div>
      ) : (
        <div style={{ background: '#1a1f2e', borderRadius: 16, border: '1px solid rgba(255,255,255,.06)', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,.06)' }}>
                  {[
                    '', 'Date', 'Fournisseur', 'Catégorie',
                    'Descriptif de la dépense', 'Hors taxe', 'TPS', 'TVQ', 'Avec taxes', 'N° Projet',
                    ...(isApprobateur ? ['Employé'] : []),
                    'Statut', ''
                  ].map((h, i) => (
                    <th key={i} style={{ padding: '12px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: .5, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const { ht, tps, tvq, ttc } = calcTaxes(r);
                  const cat = CATEGORIES[r.categorie] || { icon: '📋', color: '#94a3b8' };
                  return (
                    <tr key={r.id} onClick={() => setSelected(r)}
                      style={{ borderBottom: '1px solid rgba(255,255,255,.04)', cursor: 'pointer', transition: 'background .15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.03)'}
                      onMouseLeave={e => e.currentTarget.style.background = ''}>

                      {/* Miniature */}
                      <td style={{ padding: '10px 12px', width: 44 }}>
                        {r.preview_url
                          ? <img src={r.preview_url} alt="" style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 6, display: 'block' }} />
                          : <div style={{ width: 32, height: 32, borderRadius: 6, background: '#0f1117', display: 'grid', placeItems: 'center', fontSize: 14 }}>{getFileIcon(r.file_type)}</div>}
                      </td>

                      {/* Date */}
                      <td style={{ padding: '10px 12px', fontSize: 12, color: '#64748b', fontFamily: "'DM Mono',monospace", whiteSpace: 'nowrap' }}>{r.date || '—'}</td>

                      {/* Fournisseur */}
                      <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>{r.fournisseur}</td>

                      {/* Catégorie */}
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: `${cat.color}20`, color: cat.color, whiteSpace: 'nowrap' }}>
                          {cat.icon} {r.categorie}
                        </span>
                      </td>

                      {/* Descriptif de la dépense */}
                      <td style={{ padding: '10px 12px', fontSize: 12, color: '#94a3b8', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.description || '—'}
                      </td>

                      {/* Hors taxe */}
                      <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 600, color: '#e2e8f0', fontFamily: "'DM Mono',monospace", whiteSpace: 'nowrap' }}>{fmt(ht)} $</td>

                      {/* TPS */}
                      <td style={{ padding: '10px 12px', fontSize: 12, color: '#64748b', fontFamily: "'DM Mono',monospace", whiteSpace: 'nowrap' }}>{fmt(tps)} $</td>

                      {/* TVQ */}
                      <td style={{ padding: '10px 12px', fontSize: 12, color: '#64748b', fontFamily: "'DM Mono',monospace", whiteSpace: 'nowrap' }}>{fmt(tvq)} $</td>

                      {/* Avec taxes */}
                      <td style={{ padding: '10px 12px', fontSize: 14, fontWeight: 700, color: '#a5b4fc', fontFamily: "'DM Mono',monospace", whiteSpace: 'nowrap' }}>{fmt(ttc)} $</td>

                      {/* N° Projet (alphanumérique) */}
                      <td style={{ padding: '10px 12px', fontSize: 12, color: r.numero_projet ? '#a5b4fc' : '#334155', letterSpacing: '.3px', whiteSpace: 'nowrap' }}>
                        {r.numero_projet || '—'}
                      </td>

                      {/* Employé (approbateur uniquement) */}
                      {isApprobateur && (
                        <td style={{ padding: '10px 12px', fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap' }}>{r.employe_nom}</td>
                      )}

                      {/* Statut */}
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, ...statStyle(r.statut), whiteSpace: 'nowrap' }}>
                          {r.statut}
                        </span>
                      </td>

                      <td style={{ padding: '10px 12px', color: '#334155', fontSize: 16 }}>›</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
