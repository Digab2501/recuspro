import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { CATEGORIES, STATUTS } from '../lib/constants';
import { getFileIcon } from '../lib/fileUtils';

export default function ReceiptsPage({ user, profile }) {
  const [receipts,   setReceipts]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [selected,   setSelected]   = useState(null);
  const [filterCat,  setFilterCat]  = useState('Toutes');
  const [filterStat, setFilterStat] = useState('Tous');

  const isAdmin   = profile.role === 'admin';
  const isManager = profile.role === 'manager' || isAdmin;

  const loadReceipts = async () => {
    setLoading(true);
    let query = supabase.from('receipts').select('*').order('created_at', { ascending:false });
    // Employees only see their own receipts
    if (!isManager) query = query.eq('user_id', user.id);
    const { data } = await query;
    setReceipts(data || []);
    setLoading(false);
  };

  useEffect(() => { loadReceipts(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const updateStatut = async (id, statut) => {
    await supabase.from('receipts').update({ statut, updated_by: user.id }).eq('id', id);
    setReceipts(prev => prev.map(r => r.id===id ? {...r,statut} : r));
    if (selected?.id === id) setSelected(s => ({...s,statut}));
  };

  const downloadCSV = () => {
    const rows = [
      ['Date','Fournisseur','Catégorie','Montant','Devise','Employé','Description','Note','Statut'],
      ...filtered.map(r=>[r.date||'',r.fournisseur,r.categorie,r.montant,r.devise,r.employe_nom,r.description,r.note,r.statut]),
    ];
    const csv = rows.map(r=>r.map(c=>`"${c}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'}));
    a.download = `depenses_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  };

  const filtered = receipts.filter(r => {
    if (filterCat  !== 'Toutes' && r.categorie !== filterCat)  return false;
    if (filterStat !== 'Tous'   && r.statut    !== filterStat) return false;
    return true;
  });

  const statColor = (s) => ({
    'En attente': { bg:'rgba(245,158,11,.15)', color:'#f59e0b' },
    'Approuvé':   { bg:'rgba(16,185,129,.15)', color:'#10b981' },
    'Rejeté':     { bg:'rgba(239,68,68,.15)',  color:'#ef4444' },
  }[s] || { bg:'rgba(100,116,139,.15)', color:'#64748b' });

  const totalFiltered = filtered.reduce((s,r)=>s+(r.montant||0),0);

  if (selected) return (
    <div style={{maxWidth:700}}>
      <button onClick={()=>setSelected(null)} style={{background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.07)',borderRadius:10,color:'#94a3b8',padding:'9px 18px',fontSize:13,cursor:'pointer',fontFamily:'inherit',marginBottom:20}}>← Retour</button>

      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:24,flexWrap:'wrap',gap:12}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:700,marginBottom:4}}>{selected.fournisseur}</h1>
          <span style={{fontSize:12,color:'#475569'}}>{selected.employe_nom} · {selected.date||'date inconnue'}</span>
        </div>
        {isManager && (
          <div style={{display:'flex',gap:8}}>
            {STATUTS.map(s=>(
              <button key={s} onClick={()=>updateStatut(selected.id,s)}
                style={{padding:'8px 14px',borderRadius:10,border:'1px solid',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit',
                  background: selected.statut===s ? statColor(s).bg : 'rgba(255,255,255,.03)',
                  color:      selected.statut===s ? statColor(s).color : '#475569',
                  borderColor:selected.statut===s ? `${statColor(s).color}44` : 'rgba(255,255,255,.07)' }}>
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
        <div style={{background:'#1a1f2e',borderRadius:14,border:'1px solid rgba(255,255,255,.06)',padding:20}}>
          <div style={{fontSize:10,color:'#475569',fontWeight:700,textTransform:'uppercase',letterSpacing:1,marginBottom:12}}>Informations</div>
          {[
            ['Catégorie', `${CATEGORIES[selected.categorie]?.icon} ${selected.categorie}`],
            ['Employé',   selected.employe_nom],
            ['Date',      selected.date||'Non détectée'],
            ['Format',    (selected.file_type||'').toUpperCase()],
            ['N° reçu',   selected.numero_recu||'—'],
            ['Note',      selected.note||'—'],
          ].map(([k,v])=>(
            <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'7px 0',borderBottom:'1px solid rgba(255,255,255,.04)',fontSize:13}}>
              <span style={{color:'#64748b'}}>{k}</span>
              <span style={{color:'#e2e8f0',textAlign:'right',maxWidth:'60%'}}>{v}</span>
            </div>
          ))}
        </div>
        <div style={{background:'#1a1f2e',borderRadius:14,border:'1px solid rgba(255,255,255,.06)',padding:20}}>
          <div style={{fontSize:10,color:'#475569',fontWeight:700,textTransform:'uppercase',letterSpacing:1,marginBottom:12}}>Montant</div>
          <div style={{fontSize:34,fontWeight:700,color:'#a5b4fc',fontFamily:"'DM Mono',monospace",marginBottom:6}}>{Number(selected.montant||0).toFixed(2)} {selected.devise}</div>
          {selected.taxes!=null && <div style={{fontSize:13,color:'#64748b',marginBottom:12}}>dont {Number(selected.taxes).toFixed(2)} $ de taxes</div>}
          <div style={{fontSize:13,color:'#94a3b8',lineHeight:1.6}}>{selected.description}</div>
          <div style={{marginTop:12}}>
            <span style={{display:'inline-flex',alignItems:'center',gap:5,padding:'5px 12px',borderRadius:20,fontSize:12,fontWeight:700,...statColor(selected.statut)}}>
              {selected.statut}
            </span>
          </div>
        </div>
      </div>

      {selected.items?.length>0 && (
        <div style={{background:'#1a1f2e',borderRadius:14,border:'1px solid rgba(255,255,255,.06)',padding:20,marginBottom:16}}>
          <div style={{fontSize:10,color:'#475569',fontWeight:700,textTransform:'uppercase',letterSpacing:1,marginBottom:12}}>Articles détectés</div>
          {selected.items.map((item,i)=>(
            <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'7px 0',borderBottom:'1px solid rgba(255,255,255,.04)',fontSize:13}}>
              <span>{item.nom}</span>
              <span style={{color:'#a5b4fc',fontFamily:"'DM Mono',monospace"}}>{Number(item.montant||0).toFixed(2)} $</span>
            </div>
          ))}
        </div>
      )}

      <div style={{background:'#1a1f2e',borderRadius:14,border:'1px solid rgba(255,255,255,.06)',padding:16}}>
        <div style={{fontSize:10,color:'#475569',fontWeight:700,textTransform:'uppercase',letterSpacing:1,marginBottom:12}}>Document source</div>
        {selected.preview_url || selected.file_url ? (
          <img src={selected.preview_url||selected.file_url} alt="document" style={{width:'100%',borderRadius:10,maxHeight:500,objectFit:'contain',background:'#0f1117'}} />
        ) : (
          <div style={{background:'#0f1117',borderRadius:10,padding:32,textAlign:'center'}}>
            <div style={{fontSize:48,marginBottom:10}}>{getFileIcon(selected.file_type)}</div>
            <div style={{fontSize:13,color:'#475569'}}>{selected.file_name}</div>
          </div>
        )}
        {selected.file_url && (
          <a href={selected.file_url} target="_blank" rel="noreferrer"
            style={{display:'inline-flex',alignItems:'center',gap:6,marginTop:12,color:'#6366f1',fontSize:13,textDecoration:'none',fontWeight:600}}>
            ⬇ Télécharger le document original
          </a>
        )}
      </div>
    </div>
  );

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:24,flexWrap:'wrap',gap:12}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:700,marginBottom:4}}>{isManager ? 'Tous les reçus' : 'Mes reçus'}</h1>
          <p style={{color:'#64748b',fontSize:14}}>{filtered.length} reçu(s) · Total : <strong style={{color:'#a5b4fc'}}>{totalFiltered.toFixed(2)} $</strong></p>
        </div>
        {isManager && (
          <button onClick={downloadCSV}
            style={{background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.07)',color:'#94a3b8',borderRadius:10,padding:'10px 18px',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
            📥 Exporter CSV
          </button>
        )}
      </div>

      {/* Filters */}
      <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:12}}>
        {['Toutes',...Object.keys(CATEGORIES)].map(cat=>(
          <button key={cat} onClick={()=>setFilterCat(cat)}
            style={{padding:'6px 13px',fontSize:12,borderRadius:20,border:'1px solid',cursor:'pointer',fontFamily:'inherit',fontWeight:500,
              background: filterCat===cat?'rgba(99,102,241,.2)':'rgba(255,255,255,.03)',
              color:       filterCat===cat?'#a5b4fc':'#64748b',
              borderColor: filterCat===cat?'rgba(99,102,241,.4)':'rgba(255,255,255,.07)'}}>
            {cat!=='Toutes'?CATEGORIES[cat]?.icon+' ':''}{cat}
          </button>
        ))}
      </div>
      <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:24}}>
        {['Tous',...STATUTS].map(s=>(
          <button key={s} onClick={()=>setFilterStat(s)}
            style={{padding:'6px 13px',fontSize:12,borderRadius:20,border:'1px solid',cursor:'pointer',fontFamily:'inherit',fontWeight:500,
              background: filterStat===s?'rgba(99,102,241,.2)':'rgba(255,255,255,.03)',
              color:       filterStat===s?'#a5b4fc':'#64748b',
              borderColor: filterStat===s?'rgba(99,102,241,.4)':'rgba(255,255,255,.07)'}}>
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{textAlign:'center',padding:48,color:'#475569'}}>Chargement…</div>
      ) : filtered.length===0 ? (
        <div style={{background:'#1a1f2e',borderRadius:16,border:'1px solid rgba(255,255,255,.06)',padding:48,textAlign:'center'}}>
          <div style={{fontSize:40,marginBottom:12}}>📂</div>
          <div style={{fontWeight:600,marginBottom:6}}>Aucun reçu</div>
          <div style={{fontSize:13,color:'#475569'}}>Soumettez votre premier document via le menu Soumettre</div>
        </div>
      ) : (
        <div style={{background:'#1a1f2e',borderRadius:16,border:'1px solid rgba(255,255,255,.06)',overflow:'hidden'}}>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',minWidth:560}}>
              <thead>
                <tr style={{borderBottom:'1px solid rgba(255,255,255,.06)'}}>
                  {['','Date','Fournisseur','Catégorie', isManager?'Employé':'', 'Montant','Statut',''].filter(Boolean).map((h,i)=>(
                    <th key={i} style={{padding:'12px 14px',textAlign:'left',fontSize:11,fontWeight:600,color:'#475569',textTransform:'uppercase',letterSpacing:.5}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(r=>(
                  <tr key={r.id} onClick={()=>setSelected(r)}
                    style={{borderBottom:'1px solid rgba(255,255,255,.04)',cursor:'pointer',transition:'background .15s'}}
                    onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,.03)'}
                    onMouseLeave={e=>e.currentTarget.style.background=''}>
                    <td style={{padding:'10px 14px',width:44}}>
                      {r.preview_url
                        ? <img src={r.preview_url} alt="" style={{width:34,height:34,objectFit:'cover',borderRadius:7,display:'block'}} />
                        : <div style={{width:34,height:34,borderRadius:7,background:'#0f1117',display:'grid',placeItems:'center',fontSize:16}}>{getFileIcon(r.file_type)}</div>
                      }
                    </td>
                    <td style={{padding:'10px 14px',fontSize:12,color:'#64748b',fontFamily:"'DM Mono',monospace",whiteSpace:'nowrap'}}>{r.date||'—'}</td>
                    <td style={{padding:'10px 14px',fontSize:13,fontWeight:600}}>{r.fournisseur}</td>
                    <td style={{padding:'10px 14px'}}>
                      <span style={{display:'inline-flex',alignItems:'center',gap:5,padding:'3px 10px',borderRadius:20,fontSize:12,fontWeight:600,background:`${CATEGORIES[r.categorie]?.color}20`,color:CATEGORIES[r.categorie]?.color||'#94a3b8',whiteSpace:'nowrap'}}>
                        {CATEGORIES[r.categorie]?.icon} {r.categorie}
                      </span>
                    </td>
                    {isManager && <td style={{padding:'10px 14px',fontSize:13,color:'#94a3b8',whiteSpace:'nowrap'}}>{r.employe_nom}</td>}
                    <td style={{padding:'10px 14px',fontSize:14,fontWeight:700,color:'#a5b4fc',fontFamily:"'DM Mono',monospace",whiteSpace:'nowrap'}}>{Number(r.montant||0).toFixed(2)} {r.devise}</td>
                    <td style={{padding:'10px 14px'}}>
                      <span style={{display:'inline-flex',alignItems:'center',gap:5,padding:'3px 10px',borderRadius:20,fontSize:12,fontWeight:600,...statColor(r.statut),whiteSpace:'nowrap'}}>{r.statut}</span>
                    </td>
                    <td style={{padding:'10px 14px',color:'#334155',fontSize:16}}>›</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
