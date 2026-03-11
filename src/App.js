import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import LoginPage    from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import UploadPage   from './pages/UploadPage';
import ReceiptsPage from './pages/ReceiptsPage';
import AdminPage    from './pages/AdminPage';

const ROLE_COLORS = { admin:'#8b5cf6', manager:'#0ea5e9', employee:'#10b981' };
const ROLE_LABELS = { admin:'Admin', manager:'Manager', employee:'Employé' };

export default function App() {
  const [session,  setSession]  = useState(null);
  const [profile,  setProfile]  = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [page,     setPage]     = useState('dashboard');


  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) loadProfile(session.user.id);
      else setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setSession(session);
      if (session) loadProfile(session.user.id);
      else { setProfile(null); setLoading(false); }
    });
    return () => subscription.unsubscribe();
  }, []);

  const loadProfile = async (uid) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).single();
    if (data) {
      setProfile(data);
    } else {
      // Auto-create profile from auth metadata
      const { data: { user } } = await supabase.auth.getUser();
      const meta = user?.user_metadata || {};
      const newProfile = {
        id:     uid,
        email:  user?.email,
        nom:    meta.nom    || '',
        prenom: meta.prenom || '',
        role:   meta.role   || 'employee',
        actif:  true,
      };
      await supabase.from('profiles').upsert(newProfile);
      setProfile(newProfile);
    }
    setLoading(false);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setPage('dashboard');
  };

  if (loading) return (
    <div style={{minHeight:'100vh',background:'#0f1117',display:'grid',placeItems:'center'}}>
      <div style={{textAlign:'center'}}>
        <div style={{width:48,height:48,border:'3px solid rgba(99,102,241,.3)',borderTopColor:'#6366f1',borderRadius:'50%',animation:'spin .8s linear infinite',margin:'0 auto 16px'}} />
        <div style={{color:'#475569',fontSize:14}}>Chargement…</div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (!session || !profile) return <LoginPage />;

  const isAdmin   = profile.role === 'admin';
  const isManager = profile.role === 'manager' || isAdmin;
  const roleColor = ROLE_COLORS[profile.role] || '#475569';

  const navItems = [
    { id:'dashboard', label:'Tableau de bord', icon:'📊' },
    { id:'upload',    label:'Soumettre',        icon:'📷' },
    { id:'list',      label:isManager?'Tous les reçus':'Mes reçus', icon:'📁' },
    ...(isAdmin ? [{ id:'admin', label:'Comptes', icon:'👑' }] : []),
  ];

  const renderPage = () => {
    switch(page) {
      case 'dashboard': return <DashboardPage user={session.user} profile={profile} onNavigate={setPage} />;
      case 'upload':    return <UploadPage    user={session.user} profile={profile} onNavigate={setPage} />;
      case 'list':      return <ReceiptsPage  user={session.user} profile={profile} />;
      case 'admin':     return isAdmin ? <AdminPage /> : null;
      default:          return <DashboardPage user={session.user} profile={profile} onNavigate={setPage} />;
    }
  };

  return (
    <div style={{fontFamily:"'DM Sans',sans-serif",minHeight:'100vh',background:'#0f1117',color:'#e2e8f0',display:'flex'}}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:#1e2330}::-webkit-scrollbar-thumb{background:#334155;border-radius:3px}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .fade-in{animation:fadeIn .25s ease}
        @media(max-width:768px){
          .sidebar{display:none!important}
          .mobile-nav{display:flex!important}
          .main-content{padding:20px 16px 80px!important}
        }
        .mobile-nav{display:none;position:fixed;bottom:0;left:0;right:0;background:#13161f;border-top:1px solid rgba(255,255,255,.06);padding:10px 0 calc(env(safe-area-inset-bottom,0px)+10px);z-index:100;justify-content:space-around}
        .mob-tab{display:flex;flex-direction:column;align-items:center;gap:2px;font-size:10px;color:#475569;cursor:pointer;padding:4px 12px;border-radius:8px;min-width:60px;text-align:center}
        .mob-tab.active{color:#a5b4fc}
        .nav-btn{width:100%;background:none;border:none;cursor:pointer;padding:10px 14px;border-radius:10px;display:flex;align-items:center;gap:10px;font-size:13px;font-weight:500;color:#64748b;transition:all .15s;font-family:inherit;text-align:left}
        .nav-btn:hover,.nav-btn.active{background:rgba(99,102,241,.15);color:#a5b4fc}
      `}</style>

      {/* ── Sidebar ── */}
      <aside className="sidebar" style={{width:232,background:'#13161f',borderRight:'1px solid rgba(255,255,255,.05)',padding:'24px 14px',display:'flex',flexDirection:'column',gap:3,flexShrink:0,position:'sticky',top:0,height:'100vh',overflowY:'auto'}}>
        {/* Logo */}
        <div style={{padding:'6px 14px 20px',display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:34,height:34,background:'linear-gradient(135deg,#6366f1,#8b5cf6)',borderRadius:9,display:'grid',placeItems:'center',fontSize:18,flexShrink:0}}>🧾</div>
          <span style={{fontWeight:700,fontSize:15}}>ReçusPro</span>
        </div>

        {/* Nav */}
        {navItems.map(item=>(
          <button key={item.id} className={`nav-btn ${page===item.id?'active':''}`} onClick={()=>setPage(item.id)}>
            <span style={{fontSize:16}}>{item.icon}</span> {item.label}
          </button>
        ))}

        {/* User info */}
        <div style={{marginTop:'auto',borderTop:'1px solid rgba(255,255,255,.05)',paddingTop:16}}>
          <div style={{padding:'12px 14px',background:'rgba(255,255,255,.03)',borderRadius:12,border:'1px solid rgba(255,255,255,.06)'}}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
              <div style={{width:34,height:34,borderRadius:'50%',background:`${roleColor}22`,border:`2px solid ${roleColor}44`,display:'grid',placeItems:'center',fontSize:14,flexShrink:0}}>
                {(profile.prenom||'?')[0]}{(profile.nom||'?')[0]}
              </div>
              <div style={{overflow:'hidden'}}>
                <div style={{fontSize:13,fontWeight:600,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{profile.prenom} {profile.nom}</div>
                <div style={{fontSize:11,color:roleColor,fontWeight:600}}>{ROLE_LABELS[profile.role]||profile.role}</div>
              </div>
            </div>
            <button onClick={signOut} style={{width:'100%',background:'rgba(239,68,68,.08)',border:'1px solid rgba(239,68,68,.15)',color:'#f87171',borderRadius:8,padding:'7px',fontSize:12,cursor:'pointer',fontFamily:'inherit',fontWeight:600}}>
              Déconnexion
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="main-content" style={{flex:1,padding:'32px 36px',overflowY:'auto',minHeight:'100vh'}}>
        <div className="fade-in" key={page}>
          {renderPage()}
        </div>
      </main>

      {/* ── Mobile nav ── */}
      <nav className="mobile-nav">
        {navItems.map(item=>(
          <div key={item.id} className={`mob-tab ${page===item.id?'active':''}`} onClick={()=>setPage(item.id)}>
            <span style={{fontSize:20}}>{item.icon}</span>
            {item.label}
          </div>
        ))}
        <div className="mob-tab" onClick={signOut}>
          <span style={{fontSize:20}}>🚪</span>
          Sortir
        </div>
      </nav>
    </div>
  );
}
