// ==========================================
// 1. CONFIGURACIÓN DE SUPABASE
// ==========================================
const supabaseUrl = 'https://tecasjijlodgsvkgdqvs.supabase.co';
const supabaseKey = 'sb_publishable_Eg0bMHVcqHtkBXMuH-lAIA_cTmO99Qw';
const db = window.supabase.createClient(supabaseUrl, supabaseKey);

// ==========================================
// 1.1 SISTEMA DE NOTIFICACIONES
// ==========================================
function showNotification(message, type = 'info', duration = 3000) {
    const oldNotification = document.querySelector('.custom-notification');
    if (oldNotification) oldNotification.remove();

    const colors = { success: '#4ade80', error: '#f87171', warning: '#facc15', info: '#4db8ff' };
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };

    const notification = document.createElement('div');
    notification.className = 'custom-notification';
    notification.style.borderLeftColor = colors[type] || colors.info;
    notification.innerHTML = `${icons[type] || ''} ${message}`;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100px)';
        setTimeout(() => notification.remove(), 300);
    }, duration);
}

// ==========================================
// 2. REFERENCIAS
// ==========================================
const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
const modal = document.getElementById('modal-movimiento');
const modalQuick = document.getElementById('modal-quick');
const modalCierres = document.getElementById('modal-cierres'); // NUEVO

const detallesSection = document.getElementById('details-section');
const historialSection = document.getElementById('historial-section');
const gananciasSection = document.getElementById('ganancias-section');

const inputTasaBcv = document.getElementById('tasa-bcv');
const inputTasaUsdt = document.getElementById('tasa-usdt');
const statusBcv = document.getElementById('status-bcv');
const statusUsdt = document.getElementById('status-usdt');

let globalUserId = null;
let historialOffset = 0;
const HISTORIAL_LIMIT = 15;

// ==========================================
// 3. AUTENTICACIÓN Y CARGA INICIAL
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const { data: { session } } = await db.auth.getSession();
        if (session) await mostrarApp();
        else { loginScreen.style.display = 'block'; appScreen.style.display = 'none'; }
    } catch (error) { showNotification('Error al conectar', 'error'); }
});

document.getElementById('btn-login').onclick = async () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    if (!email || !password) return showNotification('Ingresa correo y contraseña', 'warning');
    
    try {
        const { error } = await db.auth.signInWithPassword({ email, password });
        if (error) showNotification('Error: ' + error.message, 'error');
        else { showNotification('¡Bienvenido!', 'success'); await mostrarApp(); }
    } catch (error) { showNotification('Error de conexión', 'error'); }
};

document.getElementById('btn-logout').onclick = async () => {
    await db.auth.signOut();
    if (window.autoRefreshInterval) clearInterval(window.autoRefreshInterval);
    location.reload();
};

async function mostrarApp() {
    try {
        loginScreen.style.display = 'none';
        appScreen.style.display = 'block';
        
        const { data: { user } } = await db.auth.getUser();
        globalUserId = user.id;
        
        await cargarTasasConRespaldo();
        
        await Promise.all([ cargarDatos(), cargarHistorial(), cargarGanancias() ]);
        
        if (window.autoRefreshInterval) clearInterval(window.autoRefreshInterval);
        window.autoRefreshInterval = setInterval(() => {
            if (globalUserId) { cargarDatos(); cargarHistorial(); cargarGanancias(); }
        }, 60000);
        
        setupTasaEvents();
    } catch (error) {
        showNotification('Error al cargar la aplicación', 'error');
        console.error(error);
    }
}

// ==========================================
// 3.1 MANEJO DE TASAS (NUBE Y LOCALSTORAGE)
// ==========================================
async function cargarTasasConRespaldo() {
    try {
        const { data: tasas, error } = await db.from('tasas_cambio').select('*').limit(1).single();
        if (tasas && !error) {
            inputTasaBcv.value = tasas.tasa_bcv;
            inputTasaUsdt.value = tasas.tasa_usdt;
            updateRateStatus('bcv', 'saved'); updateRateStatus('usdt', 'saved');
            return true;
        }
        await db.from('tasas_cambio').insert({ id: 1, tasa_bcv: 1, tasa_usdt: 1 });
        return true;
    } catch (error) {
        inputTasaBcv.value = localStorage.getItem('tasa_bcv_respaldo') || '1';
        inputTasaUsdt.value = localStorage.getItem('tasa_usdt_respaldo') || '1';
        showNotification('Usando tasas guardadas localmente', 'warning');
        return false;
    }
}

async function guardarTasas(silent = false) {
    const tBcv = parseFloat(inputTasaBcv.value);
    const tUsdt = parseFloat(inputTasaUsdt.value);
    
    if (isNaN(tBcv) || isNaN(tUsdt) || tBcv <= 0 || tUsdt <= 0) {
        updateRateStatus('bcv', 'error'); updateRateStatus('usdt', 'error');
        if (!silent) showNotification('Las tasas deben ser números positivos', 'warning');
        return false;
    }

    try {
        localStorage.setItem('tasa_bcv_respaldo', tBcv.toString());
        localStorage.setItem('tasa_usdt_respaldo', tUsdt.toString());
        
        const { error } = await db.from('tasas_cambio').upsert({ id: 1, tasa_bcv: tBcv, tasa_usdt: tUsdt });
        if (error) throw error;

        updateRateStatus('bcv', 'saved'); updateRateStatus('usdt', 'saved');
        setTimeout(() => { updateRateStatus('bcv', ''); updateRateStatus('usdt', ''); }, 2000);
        return true;
    } catch (error) {
        updateRateStatus('bcv', 'saved'); updateRateStatus('usdt', 'saved');
        if (!silent) showNotification('Tasas guardadas localmente', 'warning');
        return true;
    }
}

function updateRateStatus(tipo, estado) {
    const statusEl = tipo === 'bcv' ? statusBcv : statusUsdt;
    statusEl.className = 'rate-status';
    if (estado) {
        statusEl.classList.add(estado);
        if (estado === 'saving') statusEl.textContent = '⏳';
        else if (estado === 'saved') statusEl.textContent = '✅';
        else if (estado === 'error') statusEl.textContent = '❌';
    } else statusEl.textContent = '●';
}

let tasaTimeoutId;
function setupTasaEvents() {
    const triggerSave = () => {
        clearTimeout(tasaTimeoutId);
        tasaTimeoutId = setTimeout(async () => {
            await guardarTasas(); await cargarDatos(); await cargarHistorial(); await cargarGanancias();
        }, 500);
    };
    inputTasaBcv.addEventListener('input', () => { updateRateStatus('bcv', 'saving'); triggerSave(); });
    inputTasaUsdt.addEventListener('input', () => { updateRateStatus('usdt', 'saving'); triggerSave(); });
}


// ==========================================
// 4. LÓGICA DE PESTAÑAS Y MODALES
// ==========================================
document.getElementById('btn-toggle-list').onclick = () => {
    detallesSection.style.display = detallesSection.style.display === 'none' ? 'block' : 'none';
    historialSection.style.display = 'none'; gananciasSection.style.display = 'none';
};
document.getElementById('btn-toggle-historial').onclick = () => {
    historialSection.style.display = historialSection.style.display === 'none' ? 'block' : 'none';
    detallesSection.style.display = 'none'; gananciasSection.style.display = 'none';
    if (historialSection.style.display === 'block') { historialOffset = 0; cargarHistorial(); }
};
document.getElementById('btn-toggle-ganancias').onclick = () => {
    gananciasSection.style.display = gananciasSection.style.display === 'none' ? 'block' : 'none';
    detallesSection.style.display = 'none'; historialSection.style.display = 'none';
};

document.getElementById('btn-open-modal').onclick = () => {
    modal.style.display = 'block'; document.getElementById('select-tipo').dispatchEvent(new Event('change'));
};
document.getElementById('btn-close-modal').onclick = () => modal.style.display = 'none';

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { modal.style.display = 'none'; modalQuick.style.display = 'none'; modalCierres.style.display = 'none'; }
});


// ==========================================
// 5. MODAL RÁPIDO Y FORMULARIO DINÁMICO
// ==========================================
let quickAddType = '';
document.getElementById('btn-add-deudor').onclick = () => { quickAddType = 'ME_DEBEN'; document.getElementById('quick-title').innerText = "Añadir Deudor"; modalQuick.style.display = 'block'; };
document.getElementById('btn-add-deuda').onclick = () => { quickAddType = 'DEBO'; document.getElementById('quick-title').innerText = "Añadir Deuda"; modalQuick.style.display = 'block'; };
document.getElementById('btn-quick-cancel').onclick = () => { modalQuick.style.display = 'none'; document.getElementById('quick-desc').value = ''; document.getElementById('quick-monto').value = ''; };

document.getElementById('btn-quick-guardar').onclick = async () => {
    const desc = document.getElementById('quick-desc').value.trim();
    const monto = parseFloat(document.getElementById('quick-monto').value);
    const moneda = document.getElementById('quick-moneda').value;
    if (!desc || !monto) return showNotification('Faltan datos', 'warning');
    try {
        await db.from('finanzas').insert([{ user_id: globalUserId, tipo: quickAddType, concepto: desc, monto: monto, moneda: moneda }]);
        document.getElementById('quick-desc').value = ''; document.getElementById('quick-monto').value = ''; modalQuick.style.display = 'none';
        showNotification('Añadido correctamente', 'success'); await cargarDatos();
    } catch (error) { showNotification('Error al guardar', 'error'); }
};

document.getElementById('select-tipo').addEventListener('change', async (e) => {
    const campos = document.getElementById('campos-dinamicos');
    const tipo = e.target.value;
    const est = "width:100%; padding:10px; margin-bottom:10px; background:#2c2c2c; color:white; border:1px solid #444; border-radius:5px; outline:none;";
    campos.innerHTML = `<p style="color:#aaa;">Cargando...</p>`;
    try {
        const { data } = await db.from('finanzas').select('id, tipo, concepto, monto, moneda').eq('user_id', globalUserId).gt('monto', 0);
        if (!data) return;
        const deudores = data.filter(d => d.tipo === 'ME_DEBEN'); const deudas = data.filter(d => d.tipo === 'DEBO');
        let optDeudores = deudores.map(d => `<option value="${d.id}">${d.concepto} ($${d.monto.toFixed(2)} ${d.moneda})</option>`).join('');
        let optDeudas = deudas.map(d => `<option value="${d.id}">${d.concepto} ($${d.monto.toFixed(2)} ${d.moneda})</option>`).join('');
        let opcionesCuentas = deudores.map(d => `<option value="${d.concepto}">`).join('');

        if (tipo === 'GASTO') campos.innerHTML = `<input type="text" id="desc" placeholder="Descripción del Gasto" style="${est}"><input type="number" id="monto" placeholder="Monto" style="${est}"><select id="origen_id" style="${est}"><option value="">-- ¿De dónde sale? --</option>${optDeudores}</select>`;
        else if (tipo === 'INGRESO') campos.innerHTML = `<input type="number" id="monto" placeholder="Monto Total" style="${est}"><input type="text" id="desc" placeholder="Descripción" style="${est}"><select id="moneda" style="${est}"><option value="USDT">USDT</option><option value="BCV">BCV</option></select><input type="number" id="ganancia" placeholder="Ganancia Neta" style="${est}"><select id="categoria" style="${est}"><option value="3D">3D</option><option value="Bolsas">Bolsas</option></select>`;
        else if (tipo === 'PAGO_DEUDA') campos.innerHTML = `<select id="origen_id" style="${est}"><option value="">-- ¿De dónde sale? --</option>${optDeudores}</select><select id="destino_id" style="${est}"><option value="">-- ¿Qué deuda pagas? --</option>${optDeudas}</select><input type="number" id="monto" placeholder="Monto" style="${est}">`;
        else if (tipo === 'COBRAR') campos.innerHTML = `<select id="origen_id" style="${est}"><option value="">-- ¿Quién pagó? --</option>${optDeudores}</select><input type="text" id="destino_text" list="cuentas-list" placeholder="¿A dónde va?" style="${est}"><datalist id="cuentas-list">${opcionesCuentas}</datalist><input type="number" id="monto" placeholder="Monto" style="${est}">`;
    } catch (error) { campos.innerHTML = `<p style="color:#f87171;">Error al cargar</p>`; }
});

document.getElementById('btn-guardar').onclick = async () => {
    const tipo = document.getElementById('select-tipo').value;
    try {
        if (tipo === 'GASTO') {
            const id = document.getElementById('origen_id').value; const monto = parseFloat(document.getElementById('monto').value); const desc = document.getElementById('desc').value.trim();
            if (!id || !monto || !desc) return showNotification('Faltan datos', 'warning');
            const { data: origen } = await db.from('finanzas').select('monto').eq('id', id).single();
            await db.from('finanzas').update({ monto: origen.monto - monto }).eq('id', id);
            await db.from('historial').insert([{ user_id: globalUserId, tipo_movimiento: tipo, monto_origen: monto, descripcion: desc }]);
        }
        else if (tipo === 'INGRESO') {
            const monto = parseFloat(document.getElementById('monto').value); const desc = document.getElementById('desc').value.trim(); const moneda = document.getElementById('moneda').value; const ganancia = parseFloat(document.getElementById('ganancia').value) || 0; const categoria = document.getElementById('categoria').value;
            if (!monto || !desc) return showNotification('Faltan datos', 'warning');
            await db.from('finanzas').insert([{ user_id: globalUserId, tipo: 'ME_DEBEN', concepto: desc, monto: monto, moneda: moneda }]);
            await db.from('historial').insert([{ user_id: globalUserId, tipo_movimiento: tipo, monto_origen: monto, descripcion: desc, ganancia_limpia: ganancia, categoria_ganancia: categoria }]);
        }
        else if (tipo === 'PAGO_DEUDA') {
            const origen_id = document.getElementById('origen_id').value; const destino_id = document.getElementById('destino_id').value; const monto = parseFloat(document.getElementById('monto').value);
            if (!origen_id || !destino_id || !monto) return showNotification('Faltan datos', 'warning');
            const { data: oData } = await db.from('finanzas').select('monto').eq('id', origen_id).single();
            const { data: dData } = await db.from('finanzas').select('monto').eq('id', destino_id).single();
            await db.from('finanzas').update({ monto: oData.monto - monto }).eq('id', origen_id);
            await db.from('finanzas').update({ monto: dData.monto - monto }).eq('id', destino_id);
            await db.from('historial').insert([{ user_id: globalUserId, tipo_movimiento: tipo, monto_origen: monto, descripcion: `Pago de deuda procesado` }]);
        }
        else if (tipo === 'COBRAR') {
            const origen_id = document.getElementById('origen_id').value; const destino = document.getElementById('destino_text').value.trim(); const monto = parseFloat(document.getElementById('monto').value);
            if (!origen_id || !destino || !monto) return showNotification('Faltan datos', 'warning');
            const { data: oData } = await db.from('finanzas').select('monto, moneda').eq('id', origen_id).single();
            await db.from('finanzas').update({ monto: oData.monto - monto }).eq('id', origen_id);
            const { data: exist } = await db.from('finanzas').select('*').eq('user_id', globalUserId).eq('tipo', 'ME_DEBEN').ilike('concepto', destino);
            if (exist && exist.length > 0) await db.from('finanzas').update({ monto: exist[0].monto + monto }).eq('id', exist[0].id);
            else await db.from('finanzas').insert([{ user_id: globalUserId, tipo: 'ME_DEBEN', concepto: destino, monto: monto, moneda: oData.moneda }]);
            await db.from('historial').insert([{ user_id: globalUserId, tipo_movimiento: tipo, monto_origen: monto, descripcion: `Cobro depositado en ${destino}` }]);
        }
        modal.style.display = 'none'; showNotification('Guardado correctamente', 'success');
        await Promise.all([cargarDatos(), cargarHistorial(), cargarGanancias()]);
    } catch(err) { showNotification('Error: ' + err.message, 'error'); }
};


// ==========================================
// 7. CARGAR DATOS (CON CORRECCIÓN MATEMÁTICA)
// ==========================================
async function cargarDatos() {
    try {
        const { data } = await db.from('finanzas').select('id, tipo, concepto, monto, moneda').eq('user_id', globalUserId).gt('monto', 0);
        if (!data) return;

        const listaDeben = document.getElementById('lista-deben'); const listaDebo = document.getElementById('lista-debo');
        listaDeben.innerHTML = ''; listaDebo.innerHTML = '';
        let sumaTotalDeben = 0; let sumaTotalDebo = 0;
        
        const tBcv = parseFloat(inputTasaBcv.value) || 1;

        data.forEach(item => {
            let montoOriginal = parseFloat(item.monto);
            let valorEnUsd = montoOriginal;
            
            // Si el monto está en BCV, lo dividimos por la tasa para totalizar todo en USD (Dólares).
            if (item.moneda === 'BCV') {
                valorEnUsd = montoOriginal / tBcv;
            }

            const li = document.createElement('li');
            li.innerHTML = `
                <div class="item-info">
                    <span class="item-concepto">${item.concepto}</span>
                    <span class="badge ${item.moneda==='USDT'?'badge-usdt':'badge-bcv'}">${item.moneda}</span>
                </div>
                <div class="item-monto-container">
                    <span class="monto-original">Orig: $${montoOriginal.toFixed(2)} ${item.moneda}</span>
                    <span class="monto-convertido">Eq: $${valorEnUsd.toFixed(2)} USD</span>
                </div>
                <div class="item-actions">
                    <button onclick="editarItem('${item.id}')" class="btn-icon">✏️</button>
                    <button onclick="eliminarItem('${item.id}')" class="btn-icon">🗑️</button>
                </div>
            `;
            if (item.tipo === 'ME_DEBEN') { sumaTotalDeben += valorEnUsd; listaDeben.appendChild(li); } 
            else { sumaTotalDebo += valorEnUsd; listaDebo.appendChild(li); }
        });

        document.getElementById('total-deben').innerText = sumaTotalDeben.toFixed(2);
        document.getElementById('total-debo').innerText = sumaTotalDebo.toFixed(2);
        document.getElementById('total-libres').innerText = (sumaTotalDeben - sumaTotalDebo).toFixed(2);
    } catch (error) { showNotification('Error al cargar datos', 'error'); }
}


// ==========================================
// 8. CIERRES DE CAPITAL (NUEVO)
// ==========================================
document.getElementById('card-capital').onclick = () => {
    modalCierres.style.display = 'block';
    cargarCierres();
};

document.getElementById('btn-close-cierres').onclick = () => {
    modalCierres.style.display = 'none';
};

document.getElementById('btn-hacer-cierre').onclick = async () => {
    // Tomamos los valores actuales que ya están calculados en pantalla
    const capital = parseFloat(document.getElementById('total-libres').innerText);
    const deudores = parseFloat(document.getElementById('total-deben').innerText);
    const deudas = parseFloat(document.getElementById('total-debo').innerText);

    try {
        await db.from('cierres_capital').insert([{
            user_id: globalUserId,
            capital_neto: capital,
            total_deudores: deudores,
            total_deudas: deudas
        }]);
        showNotification('📸 Cierre de capital guardado', 'success');
        cargarCierres();
    } catch (error) {
        showNotification('Error al guardar cierre', 'error');
    }
};

async function cargarCierres() {
    const { data } = await db.from('cierres_capital')
        .select('*')
        .eq('user_id', globalUserId)
        .order('created_at', { ascending: false });

    const lista = document.getElementById('lista-cierres');
    lista.innerHTML = '';
    
    if (!data || data.length === 0) {
        lista.innerHTML = '<li style="text-align:center; color:#aaa;">No hay cierres registrados</li>';
        return;
    }

    data.forEach(c => {
        const fecha = new Date(c.created_at).toLocaleDateString() + ' ' + new Date(c.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        const li = document.createElement('li');
        li.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:5px; width: 100%;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-weight:bold; color:#facc15;">📸 Cierre</span>
                    <span style="font-size:0.8rem; color:#888;">${fecha}</span>
                </div>
                <div style="display:flex; justify-content:space-between; font-size:0.9rem; margin-top:5px;">
                    <span style="color:#aaa;">Capital Neto:</span>
                    <span style="font-weight:bold; color:#fff;">$${parseFloat(c.capital_neto).toFixed(2)}</span>
                </div>
                <div style="display:flex; justify-content:space-between; font-size:0.8rem; border-top: 1px solid #333; padding-top: 5px;">
                    <span style="color:#4ade80;">Deudores: $${parseFloat(c.total_deudores).toFixed(2)}</span>
                    <span style="color:#f87171;">Deudas: $${parseFloat(c.total_deudas).toFixed(2)}</span>
                </div>
            </div>
        `;
        lista.appendChild(li);
    });
}


// ==========================================
// 9. EDICIÓN, HISTORIAL Y GANANCIAS
// ==========================================
async function editarItem(id) {
    try {
        const { data: item } = await db.from('finanzas').select('*').eq('id', id).single();
        if (!item) return showNotification('Item no encontrado', 'error');
        const editModal = document.createElement('div'); editModal.className = 'modal'; editModal.style.display = 'block';
        editModal.innerHTML = `<div class="modal-content"><h2>Editar</h2><input type="text" id="edit-concepto" value="${item.concepto}" style="width:100%; padding:10px; margin-bottom:10px; background:#2c2c2c; color:white; border:1px solid #444; border-radius:5px;"><input type="number" id="edit-monto" value="${item.monto}" step="0.01" style="width:100%; padding:10px; margin-bottom:10px; background:#2c2c2c; color:white; border:1px solid #444; border-radius:5px;"><select id="edit-moneda" style="width:100%; padding:10px; margin-bottom:15px; background:#2c2c2c; color:white; border:1px solid #444; border-radius:5px;"><option value="USDT" ${item.moneda === 'USDT' ? 'selected' : ''}>USDT</option><option value="BCV" ${item.moneda === 'BCV' ? 'selected' : ''}>BCV</option></select><div style="display:flex; gap:10px;"><button onclick="guardarEdicion('${id}')" class="btn-main" style="flex:1;">Guardar</button><button onclick="this.closest('.modal').remove()" class="btn-sec" style="flex:1; border:none;">Cancelar</button></div></div>`;
        document.body.appendChild(editModal);
    } catch (error) { showNotification('Error al cargar', 'error'); }
}
async function guardarEdicion(id) {
    const concepto = document.getElementById('edit-concepto').value.trim(); const monto = parseFloat(document.getElementById('edit-monto').value); const moneda = document.getElementById('edit-moneda').value;
    if (!concepto || !monto) return showNotification('Faltan datos', 'warning');
    try { await db.from('finanzas').update({ concepto, monto, moneda }).eq('id', id); document.querySelector('.modal').remove(); showNotification('Actualizado', 'success'); await cargarDatos(); } catch (error) { showNotification('Error', 'error'); }
}
async function eliminarItem(id) {
    if (!confirm('¿Eliminar este registro?')) return;
    try { await db.from('finanzas').delete().eq('id', id); showNotification('Eliminado', 'success'); await cargarDatos(); } catch (error) { showNotification('Error', 'error'); }
}
window.editarItem = editarItem; window.eliminarItem = eliminarItem; window.guardarEdicion = guardarEdicion;

async function cargarHistorial(loadMore = false) {
    try {
        if (!loadMore) historialOffset = 0;
        const { data } = await db.from('historial').select('*').eq('user_id', globalUserId).order('created_at', { ascending: false }).range(historialOffset, historialOffset + HISTORIAL_LIMIT - 1);
        const lista = document.getElementById('lista-historial');
        if (!loadMore) lista.innerHTML = '';
        if (!data || data.length === 0) { if (!loadMore) lista.innerHTML = '<li style="text-align:center; color:#aaa;">No hay movimientos</li>'; return; }
        data.forEach(item => {
            let color = "#fff"; let ic = "▪"; if(item.tipo_movimiento === 'INGRESO'){ color="#4ade80"; ic="▲"; } if(item.tipo_movimiento === 'GASTO'){ color="#f87171"; ic="▼"; } if(item.tipo_movimiento === 'PAGO_DEUDA' || item.tipo_movimiento === 'COBRAR'){ color="#4db8ff"; ic="⇆"; }
            const li = document.createElement('li'); const fecha = new Date(item.created_at); const fechaStr = fecha.toLocaleDateString() + ' ' + fecha.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            li.innerHTML = `<div style="display:flex; flex-direction:column; gap:5px;"><span style="color:${color}; font-weight:bold;">${ic} ${item.tipo_movimiento}</span><span style="font-size:0.85rem; color:#ccc;">${item.descripcion}</span><span style="font-size:0.7rem; color:#666;">${fechaStr}</span></div><div style="font-weight:bold; font-size:1.1rem;">$${parseFloat(item.monto_origen).toFixed(2)}</div>`;
            lista.appendChild(li);
        });
        if (data.length === HISTORIAL_LIMIT) {
            const existingBtn = document.getElementById('btn-load-more');
            if (!existingBtn) { const btn = document.createElement('button'); btn.id = 'btn-load-more'; btn.className = 'btn-sec'; btn.style.marginTop = '10px'; btn.style.width = '100%'; btn.textContent = 'Ver más...'; btn.onclick = () => { historialOffset += HISTORIAL_LIMIT; cargarHistorial(true); }; lista.appendChild(btn); }
        } else { const btn = document.getElementById('btn-load-more'); if (btn) btn.remove(); }
    } catch (error) { showNotification('Error al cargar historial', 'error'); }
}

async function cargarGanancias() {
    try {
        const { data } = await db.from('historial').select('*').eq('user_id', globalUserId).eq('tipo_movimiento', 'INGRESO').gt('ganancia_limpia', 0);
        if (!data) return;
        let gSem = 0, gMes = 0, t3D = 0, tBol = 0; const now = new Date(); const currentMonth = now.getMonth(); const currentYear = now.getFullYear(); const firstDayOfWeek = new Date(now); firstDayOfWeek.setDate(now.getDate() - now.getDay()); firstDayOfWeek.setHours(0,0,0,0);
        const l3D = document.getElementById('lista-ganancias-3d'); l3D.innerHTML = ''; const lBol = document.getElementById('lista-ganancias-bolsas'); lBol.innerHTML = '';
        data.forEach(item => {
            const fecha = new Date(item.created_at); const g = parseFloat(item.ganancia_limpia);
            if (fecha.getMonth() === currentMonth && fecha.getFullYear() === currentYear) gMes += g;
            if (fecha >= firstDayOfWeek) gSem += g;
            const li = document.createElement('li');
            li.innerHTML = `<div class="item-info"><span class="item-concepto">${item.descripcion}</span><span class="badge" style="background:#333;">${fecha.toLocaleDateString()}</span></div><div class="item-monto-container"><span class="monto-convertido" style="color:#4ade80;">+$${g.toFixed(2)}</span></div>`;
            if(item.categoria_ganancia === '3D') { t3D += g; l3D.appendChild(li); } else if (item.categoria_ganancia === 'Bolsas') { tBol += g; lBol.appendChild(li); }
        });
        document.getElementById('ganancia-semanal').innerText = gSem.toFixed(2); document.getElementById('ganancia-mensual').innerText = gMes.toFixed(2); document.getElementById('total-3d').innerText = t3D.toFixed(2); document.getElementById('total-bolsas').innerText = tBol.toFixed(2);
        if (data.length === 0) { l3D.innerHTML = '<li style="text-align:center; color:#aaa;">No hay ganancias</li>'; lBol.innerHTML = '<li style="text-align:center; color:#aaa;">No hay ganancias</li>'; }
    } catch (error) { showNotification('Error al cargar ganancias', 'error'); }
}
