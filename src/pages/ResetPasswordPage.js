import { useState } from 'react';
import { supabase } from '../lib/supabase';

// Traduit les messages d'erreur courants de Supabase
const traduire = (msg = '') => {
  if (/different from the old|same.*password/i.test(msg)) return "Le nouveau mot de passe doit être différent de l'ancien.";
  if (/at least|should be|weak|characters/i.test(msg))      return 'Mot de passe trop faible : utilisez au moins 8 caractères avec des lettres et des chiffres.';
  if (/session|jwt|expired|not authenticated/i.test(msg))   return "Votre lien a expiré. Retournez à la connexion et demandez un nouveau lien avec « Première connexion ou mot de passe oublié ? ».";
  return msg;
};

export default function ResetPasswordPage({ session, checking, onDone, onCancel }) {
  const [password,  setPassword]  = useState('');
  const [password2, setPassword2] = useState('');
  const [show,      setShow]      = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [message,   setMessage]   = useState('');
  const [error,     setError]     = useState('');

  const handleReset = async (e) => {
    e?.preventDefault();
    if (password.length < 8)    { setError('Minimum 8 caractères.'); return; }
    if (password !== password2) { setError('Les deux mots de passe ne correspondent pas.'); return; }
    setLoading(true); setError('');
    const { error } = await supabase.auth.updateUser({ password });
    if (error) setError(traduire(error.message));
    else { setMessage('✅ Mot de passe enregistré ! Ouverture de ReçusPro…'); setTimeout(onDone, 1500); }
    setLoading(false);
  };

  const inp = { width:'100%', background:'var(--field)', border:'1px solid var(--border-strong)', borderRadius:10, color:'var(--text)', padding:'12px 16px', fontFamily:'inherit', fontSize:14, outline:'none', marginBottom:12, boxSizing:'border-box' };
  const lienInvalide = !checking && !session;

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'grid', placeItems:'center', padding:20 }}>
      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:20, padding:40, width:'100%', maxWidth:420 }}>
        <h2 style={{ fontSize:22, fontWeight:700, marginBottom:8, color:'var(--text)' }}>Choisir mon mot de passe</h2>

        {checking ? (
          <p style={{ color:'var(--text-2)', fontSize:14 }}>Vérification du lien…</p>
        ) : lienInvalide ? (
          <>
            <p style={{ color:'var(--danger-text)', fontSize:14, marginBottom:20, lineHeight:1.5 }}>
              Ce lien n'est plus valide : il a expiré ou a déjà été utilisé. Demandez un nouveau lien et ouvrez-le dès sa réception.
            </p>
            <button onClick={onCancel}
              style={{ width:'100%', background:'linear-gradient(135deg,#6366f1,#8b5cf6)', color:'#fff', border:'none', borderRadius:10, padding:'13px', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
              Retour à la connexion
            </button>
          </>
        ) : (
          <form onSubmit={handleReset}>
            <p style={{ color:'var(--text-2)', fontSize:14, marginBottom:20 }}>
              Compte : <strong style={{ color:'var(--text)' }}>{session.user.email}</strong><br />
              Au moins 8 caractères.
            </p>
            <input value={password} onChange={e=>setPassword(e.target.value)} type={show ? 'text' : 'password'} placeholder="Nouveau mot de passe" autoComplete="new-password" autoFocus style={inp} />
            <input value={password2} onChange={e=>setPassword2(e.target.value)} type={show ? 'text' : 'password'} placeholder="Confirmer le mot de passe" autoComplete="new-password" style={inp} />
            <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:'var(--text-2)', marginBottom:16, cursor:'pointer' }}>
              <input type="checkbox" checked={show} onChange={e => setShow(e.target.checked)} /> Afficher les mots de passe
            </label>
            {error   && <div style={{ color:'var(--danger-text)', fontSize:13.5, marginBottom:12, lineHeight:1.5 }}>{error}</div>}
            {message && <div style={{ color:'var(--success-text)', fontSize:13.5, marginBottom:12 }}>{message}</div>}
            <button type="submit" disabled={loading}
              style={{ width:'100%', background:'linear-gradient(135deg,#6366f1,#8b5cf6)', color:'#fff', border:'none', borderRadius:10, padding:'13px', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit', opacity: loading ? .6 : 1 }}>
              {loading ? 'Enregistrement…' : 'Enregistrer mon mot de passe'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
