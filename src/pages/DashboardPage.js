import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { CATEGORIES } from '../lib/constants';

export default function DashboardPage({ user, profile, onNavigate }) {
  const [receipts, setReceipts] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const isManager = profile.role === 'manager' || profile.role === 'admin';

  useEffect(() => {
    const load = async () => {
      let q = supabase.from('receipts').select('*').order('created_at', { ascending:false });
      if (!isManager) q = q.eq('user_id', user.id);
      const { data } = await q;
      setReceipts(data || []);
      setLoading(false);
    };
    load();
  }, [isManager, user.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const total      = receipts.reduce((s,r)=>s+(r.montant||0),0);
  const thisMonth  = new Date().toISOString().slice(0,7);
  const monthTotal = receipts.filter(r=>r.date?.startsWith(thisMonth)).reduce((s,r)=>s+(r.montant||0),0);
  const pending    = receipts.filter(r=>r.statut==='En attente').length;
  const approved   = receipts.filter(r=>r.statut==='Approuvé').length;

  const totals = receipts.reduce((acc,r)=>{ acc[r.categorie]=(acc[r.categorie]||0)+(r.montant||0); return acc; }, {});

  // Recent 5
  const recent = receipts.slice(0,5);

  const statColor = (s) => ({
    'En attente':'#f59e0b','Approuvé':'#10b981','Rejeté':'#ef4444'
  }[s]||'#475569');

  if (loading) return <div style={{textAlign:'center',padding:64,color:'#475569'}}>Chargement…</div>;

  return (
    <div>
      <h1 style={{fontSize:26,fontWeight:700,marginBottom:4}}>Bonjour, {profile.prenom} 👋</h1>
      <p style={{color:'#64748b',fontSize:14,marginBottom:28}}>
        {isManager ? 'Vue d\'ensemble de toutes les dépenses' : 'Vos dépenses personnelles'}
      </p>

      {/* Stats cards */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:16,marginBottom:28}}>
        {[
          {label:'Total',        value:`${total.toFixed(2)} $`,     sub:`${receipts.length} reçu(s)`,     color:'#6366f1'},
          {label:'Ce mois',      value:`${monthTotal.toFixed(2)} $`, sub:'Mois courant',                   color:'#10b981'},
          {label:'En attente',   value:pending,                      sub:'À valider',                      color:'#f59e0b'},
          {label:'Approuvés',    value:approved,                     sub:'Ce mois',                        color:'#0ea5e9'},
        ].map(c=>(
          <div key={c.label} style={{background:'#1a1f2e',borderRadius:14,border:'1px solid rgba(255,255,255,.06)',padding:20}}>
            <div style={{fontSize:10,color:'#475569',fontWeight:700,textTransform:'uppercase',letterSpacing:1,marginBottom:8}}>{c.label}</div>
            <div style={{fontSize:26,fontWeight:700,color:c.color}}>{c.value}</div>
            <div style={{fontSize:11,color:'#475569',marginTop:4}}>{c.sub}</div>
          </div>
        ))}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20,marginBottom:24}}>
        {/* Categories chart */}
        <div style={{background:'#1a1f2e',borderRadius:14,border:'1px solid rgba(255,255,255,.06)',padding:20}}>
          <h2 style={{fontSize:14,fontWeight:700,marginBottom:18}}>Par catégorie</h2>
          {Object.keys(CATEGORIES).map(cat=>{
            const amt=totals[cat]||0, pct=total>0?(amt/total)*100:0;
            return(
              <div key={cat} style={{marginBottom:12}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                  <span style={{fontSize:12}}>{CATEGORIES[cat].icon} {cat}</span>
                  <span style={{fontSize:12,fontWeight:700,color:CATEGORIES[cat].color}}>{amt.toFixed(0)} $</span>
                </div>
                <div style={{height:4,background:'rgba(255,255,255,.05)',borderRadius:99}}>
                  <div style={{height:'100%',borderRadius:99,background:CATEGORIES[cat].color,width:`${pct}%`,transition:'width .6s'}} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Recent receipts */}
        <div style={{background:'#1a1f2e',borderRadius:14,border:'1px solid rgba(255,255,255,.06)',padding:20}}>
          <h2 style={{fontSize:14,fontWeight:700,marginBottom:18}}>Récents</h2>
          {recent.length===0
            ? <div style={{fontSize:13,color:'#475569',textAlign:'center',padding:20}}>Aucun reçu pour le moment</div>
            : recent.map(r=>(
              <div key={r.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom:'1px solid rgba(255,255,255,.04)'}}>
                <div>
                  <div style={{fontSize:13,fontWeight:600,marginBottom:2}}>{r.fournisseur}</div>
                  <div style={{fontSize:11,color:'#475569'}}>{r.employe_nom} · {r.date||'—'}</div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:13,fontWeight:700,color:'#a5b4fc',fontFamily:"'DM Mono',monospace"}}>{Number(r.montant||0).toFixed(2)} $</div>
                  <div style={{fontSize:11,fontWeight:600,color:statColor(r.statut)}}>{r.statut}</div>
                </div>
              </div>
            ))
          }
          {receipts.length>5 && (
            <button onClick={()=>onNavigate('list')} style={{marginTop:12,background:'none',border:'none',color:'#6366f1',cursor:'pointer',fontSize:13,fontFamily:'inherit',fontWeight:600}}>
              Voir tous les reçus →
            </button>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div style={{background:'#1a1f2e',borderRadius:14,border:'1px solid rgba(255,255,255,.06)',padding:20}}>
        <h2 style={{fontSize:14,fontWeight:700,marginBottom:16}}>Actions rapides</h2>
        <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
          <button onClick={()=>onNavigate('upload')}
            style={{background:'linear-gradient(135deg,#0ea5e9,#38bdf8)',color:'#fff',border:'none',borderRadius:10,padding:'11px 20px',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
            📷 Soumettre un reçu
          </button>
          <button onClick={()=>onNavigate('list')}
            style={{background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.07)',color:'#e2e8f0',borderRadius:10,padding:'11px 20px',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
            📁 {isManager ? 'Voir tous les reçus' : 'Mes reçus'}
          </button>
          {profile.role==='admin' && (
            <button onClick={()=>onNavigate('admin')}
              style={{background:'rgba(139,92,246,.1)',border:'1px solid rgba(139,92,246,.3)',color:'#a5b4fc',borderRadius:10,padding:'11px 20px',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
              👑 Gérer les comptes
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
