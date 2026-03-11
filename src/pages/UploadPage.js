import { useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { SYSTEM_PROMPT_IMAGE, SYSTEM_PROMPT_TEXT } from '../lib/constants';
import { getFileType, getFileIcon, ACCEPTED, generatePreview, imageToBase64, pdfToBase64Image, wordToText, excelToText } from '../lib/fileUtils';

const API_KEY = process.env.REACT_APP_ANTHROPIC_API_KEY || '';

export default function UploadPage({ user, profile, onNavigate }) {
  const [pendingFiles,    setPendingFiles]    = useState([]);
  const [note,            setNote]            = useState('');
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [cameraOpen,      setCameraOpen]      = useState(false);
  const [cameraStream,    setCameraStream]    = useState(null);
  const [cameraFacing,    setCameraFacing]    = useState('environment');
  const [doneCount,       setDoneCount]       = useState(0);

  const videoRef      = useRef();
  const canvasRef     = useRef();
  const fileRef       = useRef();
  const cameraFileRef = useRef();

  // ── Camera ────────────────────────────────────────────────────────────────
  const openCamera = async (facing = 'environment') => {
    try {
      if (cameraStream) cameraStream.getTracks().forEach(t => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width:{ideal:1920}, height:{ideal:1080} },
      });
      setCameraStream(stream); setCameraFacing(facing); setCameraOpen(true);
      setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = stream; }, 100);
    } catch { cameraFileRef.current.click(); }
  };

  const closeCamera = () => {
    if (cameraStream) cameraStream.getTracks().forEach(t => t.stop());
    setCameraStream(null); setCameraOpen(false);
  };

  const capturePhoto = () => {
    const video = videoRef.current, canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob(blob => addFiles([new File([blob], `photo_${Date.now()}.jpg`, {type:'image/jpeg'})]), 'image/jpeg', 0.92);
  };

  // ── Files ─────────────────────────────────────────────────────────────────
  const addFiles = async (files) => {
    const valid = Array.from(files).filter(f => getFileType(f) !== 'unknown');
    if (!valid.length) return alert('Format non supporté. Formats acceptés : images, PDF, Word, Excel/CSV');
    const items = await Promise.all(valid.map(async file => ({
      id: Date.now() + Math.random(),
      file,
      fileType: getFileType(file),
      previewUrl: await generatePreview(file, getFileType(file)).catch(()=>null),
      status: 'pending',
    })));
    setPendingFiles(prev => [...prev, ...items]);
  };

  const removeFile = (id) => setPendingFiles(prev => prev.filter(p => p.id !== id));

  // ── AI Analysis ───────────────────────────────────────────────────────────
  const analyzeOne = async (item) => {
    let messageContent;
    if (item.fileType === 'image') {
      const b64 = await imageToBase64(item.file);
      messageContent = [
        { type:'image', source:{type:'base64', media_type:item.file.type||'image/jpeg', data:b64} },
        { type:'text', text:SYSTEM_PROMPT_IMAGE },
      ];
    } else if (item.fileType === 'pdf') {
      const b64 = await pdfToBase64Image(item.file);
      messageContent = [
        { type:'image', source:{type:'base64', media_type:'image/jpeg', data:b64} },
        { type:'text', text:SYSTEM_PROMPT_IMAGE },
      ];
    } else if (item.fileType === 'word') {
      const text = await wordToText(item.file);
      messageContent = [{ type:'text', text:`${SYSTEM_PROMPT_TEXT}\n\n--- DOCUMENT ---\n${text.slice(0,8000)}` }];
    } else {
      const text = await excelToText(item.file);
      messageContent = [{ type:'text', text:`${SYSTEM_PROMPT_TEXT}\n\n--- FICHIER ---\n${text.slice(0,8000)}` }];
    }

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method:'POST',
      headers: { 'Content-Type':'application/json', 'x-api-key':API_KEY, 'anthropic-version':'2023-06-01', 'anthropic-dangerous-direct-browser-api-access':'true' },
      body: JSON.stringify({ model:'claude-sonnet-4-20250514', max_tokens:1000, messages:[{role:'user', content:messageContent}] }),
    });
    if (!resp.ok) throw new Error(`API error ${resp.status}`);
    const data = await resp.json();
    const txt  = data.content?.map(b=>b.text||'').join('') || '';
    try   { return JSON.parse(txt.replace(/```json|```/g,'').trim()); }
    catch { return { fournisseur:'Inconnu', date:null, montant:0, devise:'CAD', categorie:'Autre', description:'Extraction échouée.', items:[], taxes:null, numero_recu:null }; }
  };

  // ── Upload file to Supabase Storage ───────────────────────────────────────
  const uploadFile = async (file, receiptId) => {
    const ext  = file.name.split('.').pop();
    const path = `${user.id}/${receiptId}.${ext}`;
    const { error } = await supabase.storage.from('receipts').upload(path, file, { upsert: true });
    if (error) return null;
    const { data } = supabase.storage.from('receipts').getPublicUrl(path);
    return data.publicUrl;
  };

  // ── Process all ──────────────────────────────────────────────────────────
  const processAll = async () => {
    const toProcess = pendingFiles.filter(p => p.status === 'pending');
    if (!toProcess.length) return;
    setBatchProcessing(true); setDoneCount(0);

    for (const item of toProcess) {
      setPendingFiles(prev => prev.map(p => p.id===item.id ? {...p,status:'processing'} : p));
      try {
        const result    = await analyzeOne(item);
        const receiptId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const fileUrl   = await uploadFile(item.file, receiptId);

        await supabase.from('receipts').insert({
          id:           receiptId,
          user_id:      user.id,
          employe_nom:  `${profile.prenom} ${profile.nom}`,
          fournisseur:  result.fournisseur,
          date:         result.date,
          montant:      result.montant,
          devise:       result.devise,
          categorie:    result.categorie,
          description:  result.description,
          items:        result.items,
          taxes:        result.taxes,
          numero_recu:  result.numero_recu,
          note:         note || '',
          file_url:     fileUrl,
          file_type:    item.fileType,
          file_name:    item.file.name,
          preview_url:  item.previewUrl,
          statut:       'En attente',
        });

        setDoneCount(c => c+1);
        setPendingFiles(prev => prev.map(p => p.id===item.id ? {...p,status:'done'} : p));
      } catch {
        setPendingFiles(prev => prev.map(p => p.id===item.id ? {...p,status:'error'} : p));
      }
    }

    setBatchProcessing(false);
    setTimeout(() => { setPendingFiles([]); setNote(''); onNavigate('list'); }, 1400);
  };

  const sColor = (s) => ({done:'#10b981',error:'#ef4444',processing:'#6366f1',pending:'#475569'}[s]);
  const sLabel = (s) => ({done:'✓ Envoyé',error:'✗ Erreur',processing:'⟳ Analyse…',pending:'En attente'}[s]);

  return (
    <div>
      {/* Camera overlay */}
      {cameraOpen && (
        <div style={{position:'fixed',inset:0,background:'#000',zIndex:9999,display:'flex',flexDirection:'column'}}>
          <video ref={videoRef} autoPlay playsInline muted style={{flex:1,objectFit:'cover',width:'100%'}} />
          <div style={{position:'absolute',top:0,left:0,right:0,padding:'20px 24px',display:'flex',justifyContent:'space-between',alignItems:'center',background:'linear-gradient(to bottom,rgba(0,0,0,.7),transparent)'}}>
            <button onClick={closeCamera} style={{width:44,height:44,borderRadius:'50%',background:'rgba(255,255,255,.1)',border:'none',color:'#fff',fontSize:18,cursor:'pointer'}}>✕</button>
            {pendingFiles.length>0 && <span style={{background:'rgba(99,102,241,.9)',color:'#fff',padding:'4px 14px',borderRadius:20,fontSize:13,fontWeight:700}}>{pendingFiles.length} fichier{pendingFiles.length>1?'s':''}</span>}
            <button onClick={()=>openCamera(cameraFacing==='environment'?'user':'environment')} style={{width:44,height:44,borderRadius:'50%',background:'rgba(255,255,255,.1)',border:'none',color:'#fff',fontSize:18,cursor:'pointer'}}>🔄</button>
          </div>
          <div style={{position:'absolute',bottom:0,left:0,right:0,padding:'24px 40px 48px',display:'flex',justifyContent:'space-between',alignItems:'center',background:'linear-gradient(to top,rgba(0,0,0,.8),transparent)'}}>
            <div style={{display:'flex',gap:6}}>
              {pendingFiles.filter(p=>p.fileType==='image').slice(-3).map(item=>(
                <img key={item.id} src={item.previewUrl} alt="" style={{width:44,height:44,objectFit:'cover',borderRadius:8,border:'2px solid rgba(255,255,255,.3)'}} />
              ))}
            </div>
            <button onClick={capturePhoto} style={{width:72,height:72,borderRadius:'50%',border:'4px solid #fff',background:'#fff',cursor:'pointer',flexShrink:0}} />
            <button onClick={()=>{closeCamera();}} style={{background:'linear-gradient(135deg,#6366f1,#8b5cf6)',color:'#fff',border:'none',borderRadius:10,padding:'10px 18px',fontSize:13,fontWeight:700,cursor:'pointer'}}>Terminer →</button>
          </div>
          <div style={{position:'absolute',bottom:148,left:'50%',transform:'translateX(-50%)'}}>
            <button onClick={()=>{closeCamera();fileRef.current.click()}} style={{background:'rgba(255,255,255,.1)',border:'none',borderRadius:20,color:'#fff',padding:'8px 16px',fontSize:12,cursor:'pointer'}}>📁 Importer fichier</button>
          </div>
        </div>
      )}

      <canvas ref={canvasRef} style={{display:'none'}} />
      <input ref={fileRef}       type="file" accept={ACCEPTED} multiple style={{display:'none'}} onChange={e=>addFiles(e.target.files)} />
      <input ref={cameraFileRef} type="file" accept="image/*"  capture="environment" style={{display:'none'}} onChange={e=>addFiles(e.target.files)} />

      <h1 style={{fontSize:22,fontWeight:700,marginBottom:4}}>Soumettre des reçus</h1>
      <p style={{color:'#64748b',fontSize:14,marginBottom:24}}>Soumis en tant que <strong style={{color:'#a5b4fc'}}>{profile.prenom} {profile.nom}</strong></p>

      {/* Action buttons */}
      <div style={{display:'flex',gap:12,marginBottom:20,flexWrap:'wrap'}}>
        <button onClick={()=>openCamera('environment')}
          style={{background:'linear-gradient(135deg,#0ea5e9,#38bdf8)',color:'#fff',border:'none',borderRadius:10,padding:'12px 20px',fontSize:14,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',gap:8}}>
          📷 Prendre une photo
        </button>
        <button onClick={()=>fileRef.current.click()}
          style={{background:'rgba(255,255,255,.07)',border:'1px solid rgba(255,255,255,.1)',color:'#e2e8f0',borderRadius:10,padding:'12px 20px',fontSize:14,fontWeight:600,cursor:'pointer'}}>
          📁 Importer fichiers
        </button>
      </div>

      {/* Formats info */}
      <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:24}}>
        {[{l:'Images',c:'#6366f1'},{l:'PDF',c:'#ef4444'},{l:'Word',c:'#0ea5e9'},{l:'Excel',c:'#10b981'},{l:'CSV',c:'#f59e0b'}].map(f=>(
          <span key={f.l} style={{display:'inline-flex',alignItems:'center',gap:4,padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:600,background:`${f.c}15`,color:f.c,border:`1px solid ${f.c}40`}}>{f.l}</span>
        ))}
      </div>

      {/* Drop zone */}
      <div onClick={()=>fileRef.current.click()}
        onDragOver={e=>{e.preventDefault();e.currentTarget.style.borderColor='#6366f1'}}
        onDragLeave={e=>{e.currentTarget.style.borderColor=''}}
        onDrop={e=>{e.preventDefault();e.currentTarget.style.borderColor='';addFiles(e.dataTransfer.files)}}
        style={{border:'2px dashed rgba(99,102,241,.25)',borderRadius:14,padding:pendingFiles.length?'16px 20px':'40px 20px',textAlign:'center',cursor:'pointer',marginBottom:24,transition:'all .2s'}}>
        {pendingFiles.length ? (
          <span style={{fontSize:14,color:'#64748b'}}>➕ Ajouter d'autres fichiers</span>
        ) : (
          <>
            <div style={{fontSize:40,marginBottom:12}}>📁</div>
            <div style={{fontWeight:600,marginBottom:4}}>Glissez vos fichiers ici</div>
            <div style={{fontSize:13,color:'#475569'}}>ou cliquez pour sélectionner</div>
          </>
        )}
      </div>

      {/* File thumbnails */}
      {pendingFiles.length>0 && (
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))',gap:12,marginBottom:24}}>
          {pendingFiles.map(item=>(
            <div key={item.id} style={{position:'relative',borderRadius:12,overflow:'hidden',aspectRatio:'4/3',background:'#0f1117',border:'1px solid rgba(255,255,255,.06)'}}>
              {item.previewUrl
                ? <img src={item.previewUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}} />
                : <div style={{width:'100%',height:'100%',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:6,padding:10}}>
                    <span style={{fontSize:30}}>{getFileIcon(item.fileType)}</span>
                    <span style={{fontSize:10,color:'#64748b',textAlign:'center',wordBreak:'break-word',lineHeight:1.3}}>{item.file.name}</span>
                  </div>
              }
              {item.status==='pending' && <button onClick={()=>removeFile(item.id)} style={{position:'absolute',top:6,right:6,width:22,height:22,background:'rgba(0,0,0,.75)',border:'none',borderRadius:'50%',color:'#fff',cursor:'pointer',fontSize:11,display:'grid',placeItems:'center'}}>✕</button>}
              {item.status==='processing' && <div style={{position:'absolute',inset:0,background:'rgba(99,102,241,.2)',display:'grid',placeItems:'center'}}><div style={{width:28,height:28,border:'3px solid rgba(255,255,255,.3)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin .8s linear infinite'}}/></div>}
              <div style={{position:'absolute',bottom:0,left:0,right:0,padding:'3px 6px',background:'rgba(0,0,0,.65)',backdropFilter:'blur(4px)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontSize:9,color:'#64748b',fontWeight:600,textTransform:'uppercase'}}>{item.fileType}</span>
                <span style={{fontSize:10,fontWeight:700,color:sColor(item.status)}}>{sLabel(item.status)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form */}
      {pendingFiles.length>0 && (
        <div style={{background:'#1a1f2e',borderRadius:16,border:'1px solid rgba(255,255,255,.06)',padding:24}}>
          <div style={{marginBottom:16}}>
            <label style={{fontSize:13,color:'#94a3b8',display:'block',marginBottom:6}}>Note (optionnel)</label>
            <input value={note} onChange={e=>setNote(e.target.value)} placeholder="Ex: Déplacement client, réunion de projet…"
              style={{width:'100%',background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.1)',borderRadius:10,color:'#e2e8f0',padding:'12px 16px',fontFamily:'inherit',fontSize:14,outline:'none'}} />
          </div>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:12}}>
            <span style={{fontSize:13,color:'#475569'}}>
              {batchProcessing ? `⟳ Traitement… ${doneCount}/${pendingFiles.length}` : `${pendingFiles.filter(p=>p.status==='pending').length} fichier(s) prêt(s)`}
            </span>
            <button onClick={processAll} disabled={batchProcessing||pendingFiles.filter(p=>p.status==='pending').length===0}
              style={{background:'linear-gradient(135deg,#6366f1,#8b5cf6)',color:'#fff',border:'none',borderRadius:10,padding:'13px 28px',fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit',opacity:batchProcessing?.5:1,display:'flex',alignItems:'center',gap:10}}>
              {batchProcessing && <div style={{width:15,height:15,border:'2px solid rgba(255,255,255,.3)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin .8s linear infinite'}}/>}
              ✨ Analyser et envoyer ({pendingFiles.filter(p=>p.status==='pending').length})
            </button>
          </div>
        </div>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
