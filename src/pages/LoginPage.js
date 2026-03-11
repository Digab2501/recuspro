import { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function LoginPage() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [mode,     setMode]     = useState('login'); // login | forgot

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message === 'Invalid login credentials'
      ? 'Email ou mot de passe incorrect.'
      : error.message);
    setLoading(false);
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    if (error) setError(error.message);
    else setError('✅ Email de réinitialisation envoyé !');
    setLoading(false);
  };

  return (
    <div style={{ minHeight:'100vh', background:'#0f1117', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ width:'100%', maxWidth:400 }}>
        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:40 }}>
          <div style={{ width:56, height:56, background:'linear-gradient(135deg,#6366f1,#8b5cf6)', borderRadius:16, display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:28, marginBottom:16 }}>🧾</div>
          <h1 style={{ fontSize:26, fontWeight:700 }}>ReçusPro</h1>
          <p style={{ color:'#475569', fontSize:14, marginTop:6 }}>Gestion centralisée des dépenses</p>
        </div>

        <div style={{ background:'#1a1f2e', borderRadius:20, border:'1px solid rgba(255,255,255,.07)', padding:32 }}>
          <h2 style={{ fontSize:18, fontWeight:700, marginBottom:24 }}>
            {mode === 'login' ? 'Connexion' : 'Mot de passe oublié'}
          </h2>

          <form onSubmit={mode === 'login' ? handleLogin : handleForgot}>
            <div style={{ marginBottom:16 }}>
              <label style={{ fontSize:13, color:'#94a3b8', display:'block', marginBottom:6 }}>Adresse email</label>
              <input
                type="email" required value={email} onChange={e=>setEmail(e.target.value)}
                placeholder="vous@entreprise.com"
                style={{ width:'100%', background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.1)', borderRadius:10, color:'#e2e8f0', padding:'12px 16px', fontFamily:'inherit', fontSize:14, outline:'none' }}
              />
            </div>

            {mode === 'login' && (
              <div style={{ marginBottom:20 }}>
                <label style={{ fontSize:13, color:'#94a3b8', display:'block', marginBottom:6 }}>Mot de passe</label>
                <input
                  type="password" required value={password} onChange={e=>setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{ width:'100%', background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.1)', borderRadius:10, color:'#e2e8f0', padding:'12px 16px', fontFamily:'inherit', fontSize:14, outline:'none' }}
                />
              </div>
            )}

            {error && (
              <div style={{ padding:'10px 14px', borderRadius:8, marginBottom:16, background: error.startsWith('✅') ? 'rgba(16,185,129,.1)' : 'rgba(239,68,68,.1)', color: error.startsWith('✅') ? '#10b981' : '#f87171', fontSize:13 }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              style={{ width:'100%', background:'linear-gradient(135deg,#6366f1,#8b5cf6)', color:'#fff', border:'none', borderRadius:10, padding:'13px', fontSize:15, fontWeight:700, cursor:'pointer', fontFamily:'inherit', opacity: loading ? .6 : 1, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
              {loading && <div style={{ width:16, height:16, border:'2px solid rgba(255,255,255,.3)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin .8s linear infinite' }} />}
              {mode === 'login' ? 'Se connecter' : 'Envoyer le lien'}
            </button>
          </form>

          <div style={{ textAlign:'center', marginTop:16 }}>
            {mode === 'login'
              ? <button onClick={()=>setMode('forgot')} style={{ background:'none', border:'none', color:'#6366f1', cursor:'pointer', fontSize:13, fontFamily:'inherit' }}>Mot de passe oublié ?</button>
              : <button onClick={()=>setMode('login')}  style={{ background:'none', border:'none', color:'#6366f1', cursor:'pointer', fontSize:13, fontFamily:'inherit' }}>← Retour à la connexion</button>
            }
          </div>
        </div>

        <p style={{ textAlign:'center', color:'#334155', fontSize:12, marginTop:20 }}>
          Vous n'avez pas de compte ? Contactez votre administrateur.
        </p>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
