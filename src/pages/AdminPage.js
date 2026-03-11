import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';


export default function AdminPage() {
  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [form,    setForm]    = useState({ email:'', password:'', nom:'', prenom:'', role:'employee' });
  const [saving,  setSaving]  = useState(false);
  const [msg,     setMsg]     = useState('');

  const loadUsers = async () => {
    setLoading(true);
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    setUsers(data || []);
    setLoading(false);
  };

  useEffect(() => { loadUsers(); }, []);

  const createUser = async (e) => {
    e.preventDefault();
    setSaving(true); setMsg('');
    try {
      // Create auth user via admin (needs service role) — use Edge Function or direct signup
      const { data, error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { data: { nom: form.nom, prenom: form.prenom, role: form.role } },
      });
      if (error) throw error;

      // Upsert profile
      if (data.user) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          email: form.email,
          nom: form.nom,
          prenom: form.prenom,
          role: form.role,
        });
      }
      setMsg('✅ Compte créé ! L\'employé recevra un email de confirmation.');
      setForm({ email:'', password:'', nom:'', prenom:'', role:'employee' });
      loadUsers();
    } catch (err) {
      setMsg('❌ ' + err.message);
    }
    setSaving(false);
  };

  const updateRole = async (userId, newRole) => {
    await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
    loadUsers();
  };

  const deactivateUser = async (userId) => {
    if (!window.confirm('Désactiver ce compte ?')) return;
    await supabase.from('profiles').update({ actif: false }).eq('id', userId);
    loadUsers();
  };

  const roleColor = (r) => ({ admin:'#8b5cf6', manager:'#0ea5e9', employee:'#10b981' }[r] || '#475569');

  return (
    <div>
      <h1 style={{ fontSize:22, fontWeight:700, marginBottom:4 }}>Gestion des comptes</h1>
      <p style={{ color:'#64748b', fontSize:14, marginBottom:28 }}>Créez et gérez les accès de votre équipe</p>

      {/* Create user form */}
      <div style={{ background:'#1a1f2e', borderRadius:16, border:'1px solid rgba(255,255,255,.06)', padding:24, marginBottom:28 }}>
        <h2 style={{ fontSize:15, fontWeight:700, marginBottom:18 }}>➕ Créer un compte</h2>
        <form onSubmit={createUser}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:14, marginBottom:16 }}>
            {[
              { label:'Prénom', key:'prenom', placeholder:'Marie' },
              { label:'Nom',    key:'nom',    placeholder:'Tremblay' },
              { label:'Email',  key:'email',  placeholder:'marie@entreprise.com', type:'email' },
              { label:'Mot de passe temporaire', key:'password', placeholder:'Min. 8 caractères', type:'password' },
            ].map(f => (
              <div key={f.key}>
                <label style={{ fontSize:12, color:'#94a3b8', display:'block', marginBottom:5 }}>{f.label}</label>
                <input
                  required value={form[f.key]} type={f.type||'text'}
                  placeholder={f.placeholder}
                  onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))}
                  style={{ width:'100%', background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.1)', borderRadius:8, color:'#e2e8f0', padding:'10px 14px', fontFamily:'inherit', fontSize:13, outline:'none' }}
                />
              </div>
            ))}
          </div>

          <div style={{ display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
            <div>
              <label style={{ fontSize:12, color:'#94a3b8', display:'block', marginBottom:5 }}>Rôle</label>
              <select value={form.role} onChange={e=>setForm(p=>({...p,role:e.target.value}))}
                style={{ background:'#0f1117', border:'1px solid rgba(255,255,255,.1)', borderRadius:8, color:'#e2e8f0', padding:'10px 14px', fontFamily:'inherit', fontSize:13, outline:'none' }}>
                <option value="employee">👤 Employé</option>
                <option value="manager">👔 Manager</option>
                <option value="admin">👑 Admin</option>
              </select>
            </div>
            <div style={{ marginTop:20 }}>
              <button type="submit" disabled={saving}
                style={{ background:'linear-gradient(135deg,#6366f1,#8b5cf6)', color:'#fff', border:'none', borderRadius:10, padding:'10px 24px', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit', opacity:saving?.6:1, display:'flex', alignItems:'center', gap:8 }}>
                {saving && <div style={{ width:14, height:14, border:'2px solid rgba(255,255,255,.3)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin .8s linear infinite' }} />}
                Créer le compte
              </button>
            </div>
          </div>

          {msg && (
            <div style={{ marginTop:14, padding:'10px 14px', borderRadius:8, background: msg.startsWith('✅') ? 'rgba(16,185,129,.1)' : 'rgba(239,68,68,.1)', color: msg.startsWith('✅') ? '#10b981' : '#f87171', fontSize:13 }}>
              {msg}
            </div>
          )}
        </form>
      </div>

      {/* Users list */}
      <div style={{ background:'#1a1f2e', borderRadius:16, border:'1px solid rgba(255,255,255,.06)', overflow:'hidden' }}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid rgba(255,255,255,.06)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h2 style={{ fontSize:15, fontWeight:700 }}>Comptes actifs ({users.filter(u=>u.actif!==false).length})</h2>
        </div>
        {loading ? (
          <div style={{ padding:32, textAlign:'center', color:'#475569' }}>Chargement…</div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ borderBottom:'1px solid rgba(255,255,255,.06)' }}>
                {['Nom','Email','Rôle','Statut','Actions'].map(h=>(
                  <th key={h} style={{ padding:'12px 16px', textAlign:'left', fontSize:11, fontWeight:600, color:'#475569', textTransform:'uppercase', letterSpacing:.5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u=>(
                <tr key={u.id} style={{ borderBottom:'1px solid rgba(255,255,255,.04)' }}>
                  <td style={{ padding:'12px 16px', fontSize:14, fontWeight:600 }}>{u.prenom} {u.nom}</td>
                  <td style={{ padding:'12px 16px', fontSize:13, color:'#64748b' }}>{u.email}</td>
                  <td style={{ padding:'12px 16px' }}>
                    <select value={u.role} onChange={e=>updateRole(u.id, e.target.value)}
                      style={{ background:`${roleColor(u.role)}18`, border:`1px solid ${roleColor(u.role)}44`, borderRadius:20, color:roleColor(u.role), padding:'4px 10px', fontSize:12, fontWeight:600, fontFamily:'inherit', outline:'none', cursor:'pointer' }}>
                      <option value="employee">👤 Employé</option>
                      <option value="manager">👔 Manager</option>
                      <option value="admin">👑 Admin</option>
                    </select>
                  </td>
                  <td style={{ padding:'12px 16px' }}>
                    <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'3px 10px', borderRadius:20, fontSize:12, fontWeight:600,
                      background: u.actif===false ? 'rgba(239,68,68,.1)' : 'rgba(16,185,129,.1)',
                      color:       u.actif===false ? '#f87171'           : '#10b981' }}>
                      {u.actif===false ? '● Inactif' : '● Actif'}
                    </span>
                  </td>
                  <td style={{ padding:'12px 16px' }}>
                    {u.actif !== false && (
                      <button onClick={()=>deactivateUser(u.id)}
                        style={{ background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.2)', color:'#f87171', borderRadius:8, padding:'5px 12px', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
                        Désactiver
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
