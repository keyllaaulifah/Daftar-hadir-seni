const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbykRDSplWAA7_0x00mhaoyjNHktkyOfXu6N9WxkefPMWzu2FoNFANuEzEU5BuFWSF6DEw/exec";
let siswaList = ["Kori","Aisyah","Budi","Siti","Rizki"];
let ekskulList = ["Tari Tradisional","Musik Modern","Lukis","Teater","Tari Kreasi"];
let absensi = [];
let dokumentasiList = [];
let adminPinHash = localStorage.getItem('adminPinHash') || hashPin("1234");
let isAdminLoggedIn = false;
let jamBatas = {aktif:false,buka:"07:00",tutup:"16:00"};
let gpsConfig = {aktif:false,lat:0,lng:0,radius:100};
let bgUrlConfig = localStorage.getItem('bgUrlConfig') || "";
let currentLocation = null;
let isProcessing = false;
let lastSync = "";
function hashPin(pin){ let h=0; for(let i=0;i<pin.length;i++){ h=((h<<5)-h)+pin.charCodeAt(i); h|=0; } return h.toString(); }
async function loadFromCloud(){
  try{
    const res = await fetch(WEB_APP_URL + "?t=" + Date.now());
    const data = await res.json();
    const str = JSON.stringify(data);
    if(str === lastSync) return;
    lastSync = str;
    siswaList = data.siswa || siswaList;
    ekskulList = data.ekskul || ekskulList;
    absensi = data.absensi || [];
    jamBatas = data.jamBatas || jamBatas;
    gpsConfig = data.gpsConfig || gpsConfig;
    bgUrlConfig = data.bg || "";
    dokumentasiList = data.dokumentasi || [];
    localStorage.setItem('bgUrlConfig', bgUrlConfig);
    applyBackground(bgUrlConfig);
    updateDropdownSiswa(); updateDropdownEkskul(); renderAll();
    const b=document.getElementById('jamBuka'); if(b) b.value=jamBatas.buka;
    const t=document.getElementById('jamTutup'); if(t) t.value=jamBatas.tutup;
    const a=document.getElementById('aktifkanBatas'); if(a) a.checked=jamBatas.aktif;
    const la=document.getElementById('inputLat'); if(la) la.value=gpsConfig.lat;
    const ln=document.getElementById('inputLng'); if(ln) ln.value=gpsConfig.lng;
    const ra=document.getElementById('inputRadius'); if(ra) ra.value=gpsConfig.radius;
    const ga=document.getElementById('aktifkanGps'); if(ga) ga.checked=gpsConfig.aktif;
    const ss=document.getElementById('syncStatus'); if(ss) ss.innerHTML="🟢 Online Sinkron";
  }catch(e){ const ss=document.getElementById('syncStatus'); if(ss) ss.innerHTML="🟡 Offline"; }
}
async function kirimKeCloud(obj){ try{ await fetch(WEB_APP_URL, {method:'POST', mode:'no-cors', body: JSON.stringify(obj)}); setTimeout(loadFromCloud, 800); }catch(e){} }
function initGPS(){ if(!navigator.geolocation) return; navigator.geolocation.watchPosition(pos=>{ currentLocation={lat:pos.coords.latitude,lng:pos.coords.longitude,acc:pos.coords.accuracy}; const el=document.getElementById('gpsStatus'); if(el) el.innerHTML=`GPS ${Math.round(pos.coords.accuracy)}m`; },()=>{}, {enableHighAccuracy:true}); }
initGPS();
function calculateDistance(lat1,lon1,lat2,lon2){ const R=6371e3; const p1=lat1*Math.PI/180, p2=lat2*Math.PI/180, dp=(lat2-lat1)*Math.PI/180, dl=(lon2-lon1)*Math.PI/180; const a=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2; return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a)); }
function playTing(s){ try{ const ctx=new (window.AudioContext||window.webkitAudioContext)(); const o=ctx.createOscillator(); const g=ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.frequency.value=s==='Hadir'?880:350; g.gain.setValueAtTime(0.2,ctx.currentTime); o.start(); o.stop(ctx.currentTime+0.4);}catch(e){} }
function alertMessage(msg,type='warning'){ const box=document.getElementById('customAlert'); const txt=document.getElementById('customAlertMsg'); const prog=document.getElementById('alertProgress'); if(!box) return; txt.innerText=msg; box.classList.remove('hidden','bg-red-50','text-red-700','bg-green-50','text-green-700','bg-amber-50','text-amber-700'); if(type==='error') box.classList.add('bg-red-50','text-red-700'); else if(type==='success') box.classList.add('bg-green-50','text-green-700'); else box.classList.add('bg-amber-50','text-amber-700'); prog.style.width='100%'; setTimeout(()=>closeAlert(),4000); }
function closeAlert(){ document.getElementById('customAlert')?.classList.add('hidden'); }
let confirmCallback=null;
function showConfirm(title,msg){ return new Promise(res=>{ document.getElementById('confirmTitle').innerText=title; document.getElementById('confirmMsg').innerText=msg; document.getElementById('modalConfirm').classList.remove('hidden'); confirmCallback=res; }); }
function closeConfirm(r){ document.getElementById('modalConfirm').classList.add('hidden'); if(confirmCallback) confirmCallback(r); }
function init(){ updateDropdownSiswa(); updateDropdownEkskul(); const f=document.getElementById('filterTgl'); if(f) f.valueAsDate=new Date(); applyBackground(bgUrlConfig); loadFromCloud(); setInterval(loadFromCloud, 5000); renderAll(); }
function updateDropdownSiswa(){ const s=document.getElementById('pilihSiswa'); if(s) s.innerHTML=siswaList.map(n=>`<option value="${n}">${n}</option>`).join(''); }
function updateDropdownEkskul(){ const e=document.getElementById('pilihEkskul'); if(e) e.innerHTML=ekskulList.map(n=>`<option value="${n}">${n}</option>`).join(''); }
function setLoading(st){ isProcessing=st; document.querySelectorAll('.absen-btn').forEach(b=>b.disabled=st); }
async function absen(status){
  if(isProcessing) return;
  const nama=document.getElementById('pilihSiswa').value; const kelas=document.getElementById('inputKelas').value.trim(); const ekskul=document.getElementById('pilihEkskul').value;
  const now=new Date(); const tgl=now.toISOString().split('T')[0];
  if(!nama) return alertMessage('Pilih nama dulu!','warning');
  if(!kelas) return alertMessage('Isi kelas dulu!','warning');
  if(jamBatas.aktif){ const j=now.getHours()*60+now.getMinutes(); const [bh,bm]=jamBatas.buka.split(":").map(Number); const [th,tm]=jamBatas.tutup.split(":").map(Number); if(j<bh*60+bm||j>th*60+tm) return alertMessage(`Absen hanya ${jamBatas.buka} - ${jamBatas.tutup}`,'error'); }
  if(gpsConfig.aktif){ if(!currentLocation) return alertMessage('GPS belum ketemu!','error'); const jarak=calculateDistance(currentLocation.lat,currentLocation.lng,gpsConfig.lat,gpsConfig.lng); if(jarak>gpsConfig.radius) return alertMessage(`Diluar area! ${Math.round(jarak)}m`,'error'); }
  if(absensi.find(a=>a.nama==nama && a.tgl==tgl)) return alertMessage(nama+' sudah absen hari ini','warning');
  setLoading(true);
  const dataAbsen={nama,kelas,ekskul,status,tgl,jam:now.toLocaleTimeString('id-ID'),lat:currentLocation?.lat||'',lng:currentLocation?.lng||'',acc:currentLocation?.acc||''};
  absensi.push(dataAbsen); renderAll(); playTing(status); alertMessage('Berhasil absen '+status+'!','success');
  await kirimKeCloud(dataAbsen); setLoading(false);
}
function renderPribadi(){
  const sel=document.getElementById('pilihSiswa'); if(!sel) return; const nama=sel.value;
  const data=absensi.filter(a=>a.nama==nama);
  document.getElementById('countHadir').innerText=data.filter(a=>a.status=='Hadir').length;
  document.getElementById('countIzin').innerText=data.filter(a=>['Izin','Sakit'].includes(a.status)).length;
  document.getElementById('countAlfa').innerText=data.filter(a=>a.status=='Alfa').length;
  let html=`<h3 class="font-bold text-xs mb-2">Riwayat ${nama||''}</h3>`;
  html+= data.length==0 ? `<div class="py-6 text-center border rounded-xl border-dashed">Belum ada riwayat</div>` : '<div class="space-y-1.5 max-h-48 overflow-y-auto">'+data.slice(-10).reverse().map(a=>`<div class="flex justify-between text-xs p-2.5 rounded-xl border bg-white"><span>${a.tgl} - ${a.ekskul} [${a.kelas||''}]<br><span class="text-[10px] text-slate-400">${a.jam}</span></span><span class="font-bold">${a.status}</span></div>`).join('')+'</div>';
  document.getElementById('riwayatPribadi').innerHTML=html;
}
function renderAdmin(){
  const tgl=document.getElementById('filterTgl')?.value; if(!tgl) return;
  const data=absensi.filter(a=>a.tgl==tgl);
  document.getElementById('totalHadirAll').innerText=data.filter(a=>a.status=='Hadir').length;
  document.getElementById('totalIzinAll').innerText=data.filter(a=>['Izin','Sakit'].includes(a.status)).length;
  document.getElementById('totalAlfaAll').innerText=data.filter(a=>a.status=='Alfa').length;
  const dok=document.getElementById('galeriDokumentasi'); if(dok){ const f=dokumentasiList.filter(d=>d.tgl===tgl); dok.innerHTML=f.length==0?`<div class="col-span-2 py-4 text-center border border-dashed rounded-xl text-[11px]">Belum ada foto ${tgl}</div>`:f.map(x=>`<div class="relative border rounded-xl overflow-hidden"><img src="${x.image}" class="w-full h-28 object-cover"><div class="p-2 flex justify-between bg-slate-50"><span class="text-[10px]">${x.jam}</span><button onclick="hapusDokumentasi('${x.id}')" class="text-rose-600 text-[10px] font-bold">Hapus</button></div></div>`).join(''); }
  let html=`<h3 class="font-bold text-xs mb-2">Presensi ${tgl}</h3><div class="space-y-2 max-h-52 overflow-y-auto">`;
  html+= data.length==0?'<div class="py-6 text-center border rounded-xl border-dashed">Belum ada absen</div>':data.map(a=>`<div class="flex justify-between p-3 rounded-xl border bg-white"><div><div class="font-bold text-xs">${a.nama} (${a.kelas||''})</div><div class="text-[10px] opacity-75">${a.ekskul} | ${a.jam}</div></div><div class="text-xs font-black">${a.status}</div></div>`).join('');
  html+='</div><h3 class="font-bold text-xs mt-5 mb-2">Total Keseluruhan</h3><div class="bg-white border rounded-xl overflow-hidden"><table class="w-full text-left text-[11px]"><thead class="bg-slate-900 text-white"><tr><th class="p-2.5">Siswa</th><th class="p-2.5 text-center">H</th><th class="p-2.5 text-center">I/S</th><th class="p-2.5 text-center">A</th><th class="p-2.5 text-right">%</th></tr></thead><tbody>';
  siswaList.forEach(n=>{ const d=absensi.filter(a=>a.nama==n); const h=d.filter(a=>a.status=='Hadir').length; const is=d.filter(a=>['Izin','Sakit'].includes(a.status)).length; const al=d.filter(a=>a.status=='Alfa').length; const p=d.length?Math.round(h/d.length*100):0; html+=`<tr class="border-t"><td class="p-2.5 font-semibold">${n}</td><td class="p-2.5 text-center text-emerald-600 font-bold">${h}</td><td class="p-2.5 text-center text-amber-600 font-bold">${is}</td><td class="p-2.5 text-center text-rose-600 font-bold">${al}</td><td class="p-2.5 text-right font-black">${p}%</td></tr>`; });
  html+='</tbody></table></div>';
  document.getElementById('tabelAdmin').innerHTML=html;
  document.getElementById('listKelolaSiswa').innerHTML=siswaList.map(n=>`<div class="flex justify-between text-xs bg-white p-2 rounded-lg border"><span>${n}</span><button onclick="hapusSiswa('${n}')" class="text-rose-600 font-bold">Hapus</button></div>`).join('');
  document.getElementById('listKelolaEkskul').innerHTML=ekskulList.map(n=>`<div class="flex justify-between text-xs bg-white p-2 rounded-lg border"><span>${n}</span><button onclick="hapusEkskul('${n}')" class="text-rose-600 font-bold">Hapus</button></div>`).join('');
}
function renderAll(){ renderPribadi(); if(isAdminLoggedIn) renderAdmin(); }
function showPage(p){ if(p==='admin' && !isAdminLoggedIn) return openLoginModal(); document.getElementById('pageSiswa').classList.toggle('hidden',p!=='siswa'); document.getElementById('pageAdmin').classList.toggle('hidden',p!=='admin'); document.getElementById('btnSiswa').className=p=='siswa'?'flex-1 bg-white text-slate-900 px-4 py-2 rounded-full text-xs font-bold shadow-md':'flex-1 bg-transparent text-white px-4 py-2 rounded-full text-xs'; document.getElementById('btnAdmin').className=p=='admin'?'flex-1 bg-white text-slate-900 px-4 py-2 rounded-full text-xs font-bold shadow-md':'flex-1 bg-transparent text-white px-4 py-2 rounded-full text-xs'; if(p=='admin'){ switchAdminTab('rekap'); renderAdmin(); } }
function switchAdminTab(tab){ ['rekap','siswa','ekskul','jam','pengaturan'].forEach(t=>{ document.getElementById('tabContent'+t.charAt(0).toUpperCase()+t.slice(1))?.classList.toggle('hidden',t!==tab); const btn=document.getElementById('btnTab-'+t); if(btn){ if(t===tab){ btn.classList.add('bg-white','shadow-sm'); } else { btn.classList.remove('bg-white','shadow-sm'); } } }); }
function checkAdminAccess(){ if(isAdminLoggedIn) showPage('admin'); else openLoginModal(); }
function openLoginModal(){ document.getElementById('modalLoginAdmin').classList.remove('hidden'); }
function closeLoginModal(){ document.getElementById('modalLoginAdmin').classList.add('hidden'); }
function verifyAdminLogin(){ const pin=document.getElementById('inputPin').value.trim(); if(hashPin(pin)===adminPinHash){ isAdminLoggedIn=true; closeLoginModal(); showPage('admin'); alertMessage('Masuk Admin!','success'); } else alertMessage('Sandi salah!','error'); }
function adminLogout(){ isAdminLoggedIn=false; showPage('siswa'); }
function applyBackground(u){ const c=document.getElementById('appContainer'); if(c) c.style.backgroundImage=u?`url('${u}')`:"none"; }
function simpanBackgroundGaleri(e){
  const f=e.target.files[0]; if(!f) return;
  const img=new Image(); const url=URL.createObjectURL(f);
  img.onload=()=>{
    const c=document.createElement('canvas'); const max=800; let w=img.width, h=img.height;
    if(w>max){ h=h*max/w; w=max; }
    c.width=w; c.height=h; c.getContext('2d').drawImage(img,0,0,w,h);
    const kecil=c.toDataURL('image/jpeg',0.6);
    bgUrlConfig=kecil; localStorage.setItem('bgUrlConfig',bgUrlConfig);
    applyBackground(bgUrlConfig);
    kirimKeCloud({type:'Config', bg:bgUrlConfig});
    alertMessage('Background diterapkan di semua HP!','success');
  };
  img.src=url;
}
function hapusBackgroundUrl(){
  bgUrlConfig=""; localStorage.removeItem('bgUrlConfig'); applyBackground("");
  kirimKeCloud({type:'Config', bg:""});
}
function ambilLokasiAdmin(){ navigator.geolocation.getCurrentPosition(p=>{ document.getElementById('inputLat').value=p.coords.latitude; document.getElementById('inputLng').value=p.coords.longitude; alertMessage('GPS diambil!','success'); }); }
function simpanGpsConfig(){ gpsConfig={aktif:document.getElementById('aktifkanGps').checked, lat:parseFloat(document.getElementById('inputLat').value), lng:parseFloat(document.getElementById('inputLng').value), radius:parseFloat(document.getElementById('inputRadius').value)}; kirimKeCloud({type:'Config', gpsConfig}); alertMessage('GPS disimpan & sinkron!','success'); }
function simpanJamBatas(){ jamBatas={buka:document.getElementById('jamBuka').value, tutup:document.getElementById('jamTutup').value, aktif:document.getElementById('aktifkanBatas').checked}; kirimKeCloud({type:'Config', jamBatas}); alertMessage('Jam disimpan & sinkron!','success'); }
function uploadDokumentasi(e){
  const f=e.target.files[0]; if(!f) return;
  const img=new Image(); const url=URL.createObjectURL(f);
  img.onload=()=>{
    const c=document.createElement('canvas'); const max=800; let w=img.width, h=img.height;
    if(w>max){ h=h*max/w; w=max; }
    c.width=w; c.height=h; c.getContext('2d').drawImage(img,0,0,w,h);
    const kecil=c.toDataURL('image/jpeg',0.6);
    const tgl=document.getElementById('filterTgl').value||new Date().toISOString().split('T')[0];
    const item={id:'doc_'+Date.now(), tgl, image:kecil, jam:new Date().toLocaleTimeString('id-ID')};
    dokumentasiList.push(item); renderAdmin();
    kirimKeCloud({type:'Dokumentasi', action:'add', id:item.id, tgl:item.tgl, image:item.image, jam:item.jam});
    alertMessage('Foto diupload ke semua HP','success');
  };
  img.src=url;
}
async function hapusDokumentasi(id){
  const ok=await showConfirm("Hapus Foto?","Foto akan dihapus di semua HP.");
  if(ok){ dokumentasiList=dokumentasiList.filter(d=>d.id!==id); renderAdmin(); kirimKeCloud({type:'Dokumentasi', action:'delete', id:id}); }
}
function exportExcel(){ const tgl=document.getElementById('filterTgl').value; const data=absensi.filter(a=>a.tgl===tgl); if(!data.length) return alertMessage('Tidak ada data!','warning'); let csv='Nama,Kelas,Ekskul,Status,Tanggal,Jam,Lat,Lng\n'; data.forEach(d=>csv+=`"${d.nama}","${d.kelas||''}","${d.ekskul}","${d.status}","${d.tgl}","${d.jam}","${d.lat||''}","${d.lng||''}"\n`); const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download=`rekap-${tgl}.csv`; a.click(); }
function kirimRekapWA(){ const tgl=document.getElementById('filterTgl').value||new Date().toISOString().split('T')[0]; const noWA=document.getElementById('waAdmin').value.trim(); const data=absensi.filter(a=>a.tgl===tgl); const hadir=data.filter(a=>a.status==='Hadir'); const izin=data.filter(a=>['Izin','Sakit'].includes(a.status)); const alfa=data.filter(a=>a.status==='Alfa'); let pesan=`*REKAP ABSENSI SENI*%0ATanggal: ${tgl}%0A✅ Hadir: ${hadir.length} | 📝 Izin: ${izin.length} | ❌ Alfa: ${alfa.length}%0A%0A*HADIR:*%0A`; hadir.forEach((a,i)=>pesan+=`${i+1}. ${a.nama} - ${a.kelas} (${a.ekskul}) ${a.jam}%0A`); window.open(`https://wa.me/${noWA}?text=${pesan}`,'_blank'); }
function backupData(){ const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([JSON.stringify({siswaList,ekskulList,absensi})],{type:'application/json'})); a.download=`backup-${new Date().toISOString().split('T')[0]}.json`; a.click(); }
function restoreData(e){ const f=e.target.files[0]; if(!f) return; const r=new FileReader(); r.onload=ev=>{ try{ const d=JSON.parse(ev.target.result); siswaList=d.siswaList; ekskulList=d.ekskulList; absensi=d.absensi; renderAll(); alertMessage('Restore berhasil!','success'); }catch{ alertMessage('File rusak!','error'); } }; r.readAsText(f); }
async function confirmReset(){ const ok=await showConfirm("Reset Semua?","Semua data di Google akan dihapus!"); if(ok){ await kirimKeCloud({type:'Reset'}); lastSync=""; loadFromCloud(); } }
function tambahSiswa(){ const n=document.getElementById('newNama').value.trim(); if(!n||siswaList.includes(n)) return alertMessage('Nama kosong / sudah ada!','warning'); siswaList.push(n); document.getElementById('newNama').value=''; updateDropdownSiswa(); renderAll(); kirimKeCloud({type:'Siswa',action:'add',value:n}); alertMessage('Siswa ditambah, langsung muncul di HP lain!','success'); }
async function hapusSiswa(nama){ const ok=await showConfirm(`Hapus ${nama}?`,"Dihapus dari semua HP."); if(ok){ siswaList=siswaList.filter(s=>s!==nama); updateDropdownSiswa(); renderAll(); kirimKeCloud({type:'Siswa',action:'delete',value:nama}); } }
function tambahEkskul(){ const n=document.getElementById('newEkskul').value.trim(); if(!n||ekskulList.includes(n)) return alertMessage('Ekskul kosong / sudah ada!','warning'); ekskulList.push(n); document.getElementById('newEkskul').value=''; updateDropdownEkskul(); renderAll(); kirimKeCloud({type:'Ekskul',action:'add',value:n}); alertMessage('Ekskul ditambah & sinkron!','success'); }
async function hapusEkskul(item){ const ok=await showConfirm(`Hapus ${item}?`,"Dihapus dari semua HP."); if(ok){ ekskulList=ekskulList.filter(e=>e!==item); updateDropdownEkskul(); renderAll(); kirimKeCloud({type:'Ekskul',action:'delete',value:item}); } }
function ubahSandiAdmin(){ const oldP=document.getElementById('oldPin').value.trim(); const newP=document.getElementById('newPin').value.trim(); if(hashPin(oldP)!==adminPinHash) return alertMessage('Sandi lama salah!','error'); adminPinHash=hashPin(newP); localStorage.setItem('adminPinHash',adminPinHash); alertMessage('Sandi diubah!','success'); }
setInterval(()=>{ const now=new Date(); const j=document.getElementById('jamReal'); if(j) j.innerText=now.toLocaleTimeString('id-ID'); const t=document.getElementById('tglReal'); if(t) t.innerText=now.toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'}); },1000);
document.getElementById('pilihSiswa')?.addEventListener('change',renderPribadi);
document.getElementById('filterTgl')?.addEventListener('change',renderAdmin);
document.getElementById('inputPin')?.addEventListener('keypress',e=>{ if(e.key==='Enter') verifyAdminLogin(); });
init();