import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function ResetPasswordPage({ onDone }) {
  const [password,  setPassword]  = useState('');
  const [password2, setPassword2] = useState('');
  const [loading,   setLoading]   = useState(false);
  const [message,   setMessage]   = useState('');
  const [error,     setError]     = useState('');

  const handleReset = async () => {
    if (password !== password2) { setError('Les mots de passe ne correspondent pas.'); return; }
    if (password.length < 6)    { setError('Minimum 6 caractères.'); return; }
    setLoading(true); setError('');
    const { error } = await supabase.auth.updateUser({ password });
    if (error) setError(error.message);
    else { setMessage('Mot de passe mis à jour ! Redirection…'); setTimeout(onDone, 2000); }
    setLoading(false);
  };

  return (
    <div style={{ minHeight:'100vh', background:'#0f1117', display:'grid', placeItems:'center' }}>
      <div style={{ background:'#13161f', border:'1px solid rgba(255,255,255,.08)', borderRadius:20, padding:40, width:'100%', maxWidth:420 }}>
        <h2 style={{ fontSize:22, fontWeight:700, marginBottom:8, color:'#e2e8f0' }}>Nouveau mot de passe</h2>
        <p style={{ color:'#64748b', fontSize:14, marginBottom:24 }}>Choisissez un nouveau mot de passe sécurisé.</p>
        <input value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="Nouveau mot de passe"
          style={{ width:'100%', background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.1)', borderRadius:10, color:'#e2e8f0', padding:'12px 16px', fontFamily:'inherit', fontSize:14, outline:'none', marginBottom:12, boxSizing:'border-box' }} />
        <input value={password2} onChange={e=>setPassword2(e.target.value)} type="password" placeholder="Confirmer le mot de passe"
          style={{ width:'100%', background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.1)', borderRadius:10, color:'#e2e8f0', padding:'12px 16px', fontFamily:'inherit', fontSize:14, outline:'none', marginBottom:16, boxSizing:'border-box' }} />
        {error   && <div style={{ color:'#f87171', fontSize:13, marginBottom:12 }}>{error}</div>}
        {message && <div style={{ color:'#10b981', fontSize:13, marginBottom:12 }}>{message}</div>}
        <button onClick={handleReset} disabled={loading}
          style={{ width:'100%', background:'linear-gradient(135deg,#6366f1,#8b5cf6)', color:'#fff', border:'none', borderRadius:10, padding:'13px', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
          {loading ? 'Mise à jour…' : 'Mettre à jour le mot de passe'}
        </button>
      </div>
    </div>
  );
}
