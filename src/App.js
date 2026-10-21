import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import LoginPage     from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import UploadPage    from './pages/UploadPage';
import ReceiptsPage  from './pages/ReceiptsPage';
import AdminPage     from './pages/AdminPage';
import { ROLE_LABELS, ROLE_COLORS } from './lib/constants';
import ResetPasswordPage from './pages/ResetPasswordPage';

export default function App() {
  const [session,  setSession]  = useState(null);
  const [profile,  setProfile]  = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [page,     setPage]     = useState('dashboard');
  const [isResetting, setIsResetting] = useState(false);
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute('data-theme') || 'dark');

  // Applique et mémorise le thème clair / sombre
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('recuspro-theme', theme); } catch (e) { /* stockage indisponible */ }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'light' ? '#ffffff' : '#0f1117');
  }, [theme]);
  const toggleTheme = () => setTheme(t => (t === 'light' ? 'dark' : 'light'));

  useEffect(() => {
    const hash = window.location.hash;
if (hash.includes('type=recovery')) {
  setIsResetting(true);
}
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
    const { data: rows } = await supabase.from('profiles').select('*').eq('id', uid);
    const data = rows?.[0] || null;
    console.log('PROFILE LOAD:', { data, uid });
    if (data) {
      setProfile(data);
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      const meta = user?.user_metadata || {};
      const newProfile = {
        id:     uid,
        email:  user?.email,
        nom:    meta.nom    || '',
        prenom: meta.prenom || '',
        role:   'employee',
        actif:  true,
      };
      await supabase.from('profiles').upsert(newProfile, { onConflict: 'id', ignoreDuplicates: true });
      const { data: actual } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
      setProfile(actual || newProfile);
    }
    setLoading(false);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setPage('dashboard');
  };

  if (isResetting) return (
  <ResetPasswordPage onDone={() => { setIsResetting(false); window.location.hash = ''; }} />
);
  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'grid', placeItems: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 48, height: 48, border: '3px solid rgba(99,102,241,.3)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin .8s linear infinite', margin: '0 auto 16px' }} />
        <div style={{ color: 'var(--text-3)', fontSize: 14 }}>Chargement…</div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (!session || !profile) return <LoginPage />;

  const isAdmin        = profile.role === 'admin';
  const isApprobateur  = profile.role === 'approbateur' || isAdmin;
  const roleColor      = ROLE_COLORS[profile.role] || 'var(--text-3)';

  const navItems = [
    { id: 'dashboard', label: 'Tableau de bord', icon: '📊' },
    { id: 'upload',    label: 'Soumettre',        icon: '📷' },
    { id: 'list',      label: isApprobateur ? 'Tous les reçus' : 'Mes reçus', icon: '📁' },
    ...(isAdmin ? [{ id: 'admin', label: 'Comptes', icon: '👑' }] : []),
  ];

  const renderPage = () => {
    switch (page) {
      case 'dashboard': return <DashboardPage user={session.user} profile={profile} onNavigate={setPage} />;
      case 'upload':    return <UploadPage    user={session.user} profile={profile} onNavigate={setPage} />;
      case 'list':      return <ReceiptsPage  user={session.user} profile={profile} />;
      case 'admin':     return isAdmin ? <AdminPage /> : null;
      default:          return <DashboardPage user={session.user} profile={profile} onNavigate={setPage} />;
    }
  };

  return (
    <div style={{ fontFamily: "'DM Sans',sans-serif", minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', display: 'flex', fontSize: 14 }}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:8px;height:8px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:var(--scroll-thumb);border-radius:4px}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .fade-in{animation:fadeIn .25s ease}
        @media(max-width:768px){
          .sidebar{display:none!important}
          .mobile-nav{display:flex!important}
          .main-content{padding:20px 16px 80px!important}
        }
        .mobile-nav{display:none;position:fixed;bottom:0;left:0;right:0;background:var(--sidebar);border-top:1px solid var(--border);padding:10px 0 calc(env(safe-area-inset-bottom,0px)+10px);z-index:100;justify-content:space-around}
        .mob-tab{display:flex;flex-direction:column;align-items:center;gap:2px;font-size:11px;color:var(--text-3);cursor:pointer;padding:4px 10px;border-radius:8px;min-width:56px;text-align:center}
        .mob-tab.active{color:var(--accent-text)}
        .nav-btn{width:100%;background:none;border:none;cursor:pointer;padding:11px 14px;border-radius:10px;display:flex;align-items:center;gap:10px;font-size:14px;font-weight:500;color:var(--text-2);transition:all .15s;font-family:inherit;text-align:left}
        .nav-btn:hover{background:var(--hover);color:var(--text)}
        .nav-btn.active{background:rgba(99,102,241,.15);color:var(--accent-text);font-weight:600}
        .theme-btn{width:100%;display:flex;align-items:center;justify-content:center;gap:8px;background:var(--field);border:1px solid var(--border);color:var(--text-2);border-radius:8px;padding:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;margin-bottom:8px}
        .theme-btn:hover{color:var(--text);border-color:var(--border-strong)}
      `}</style>

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside className="sidebar" style={{ width: 232, background: 'var(--sidebar)', borderRight: '1px solid var(--border)', padding: '24px 14px', display: 'flex', flexDirection: 'column', gap: 3, flexShrink: 0, position: 'sticky', top: 0, height: '100vh', overflowY: 'auto' }}>
        <div style={{ padding: '6px 14px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', borderRadius: 9, display: 'grid', placeItems: 'center', fontSize: 18, flexShrink: 0 }}>🧾</div>
          <span style={{ fontWeight: 700, fontSize: 15 }}>ReçusPro</span>
        </div>

        {navItems.map(item => (
          <button key={item.id} className={`nav-btn ${page === item.id ? 'active' : ''}`} onClick={() => setPage(item.id)}>
            <span style={{ fontSize: 16 }}>{item.icon}</span> {item.label}
          </button>
        ))}

        <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <button className="theme-btn" onClick={toggleTheme} title="Basculer entre le thème clair et sombre">
            {theme === 'light' ? '🌙 Thème sombre' : '☀️ Thème clair'}
          </button>
          <div style={{ padding: '12px 14px', background: 'var(--hover)', borderRadius: 12, border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: `${roleColor}22`, border: `2px solid ${roleColor}44`, display: 'grid', placeItems: 'center', fontSize: 14, flexShrink: 0 }}>
                {(profile.prenom || '?')[0]}{(profile.nom || '?')[0]}
              </div>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{profile.prenom} {profile.nom}</div>
                <div style={{ fontSize: 11, color: roleColor, fontWeight: 600 }}>{ROLE_LABELS[profile.role] || profile.role}</div>
              </div>
            </div>
            <button onClick={signOut} style={{ width: '100%', background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.15)', color: 'var(--danger-text)', borderRadius: 8, padding: '7px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
              Déconnexion
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────────────────── */}
      <main className="main-content" style={{ flex: 1, padding: '32px 36px', overflowY: 'auto', minHeight: '100vh' }}>
        <div className="fade-in" key={page}>
          {renderPage()}
        </div>
      </main>

      {/* ── Mobile nav ──────────────────────────────────────────────────────── */}
      <nav className="mobile-nav">
        {navItems.map(item => (
          <div key={item.id} className={`mob-tab ${page === item.id ? 'active' : ''}`} onClick={() => setPage(item.id)}>
            <span style={{ fontSize: 20 }}>{item.icon}</span>
            {item.label}
          </div>
        ))}
        <div className="mob-tab" onClick={toggleTheme}>
          <span style={{ fontSize: 20 }}>{theme === 'light' ? '🌙' : '☀️'}</span>
          Thème
        </div>
        <div className="mob-tab" onClick={signOut}>
          <span style={{ fontSize: 20 }}>🚪</span>
          Sortir
        </div>
      </nav>
    </div>
  );
}
