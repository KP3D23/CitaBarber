// ==========================================
// 1. CONFIGURACIÓN DE SUPABASE
// ==========================================
const supabaseUrl = 'https://tecasjijlodgsvkgdqvs.supabase.co';
const supabaseKey = 'sb_publishable_Eg0bMHVcqHtkBXMuH-lAIA_cTmO99Qw';
const db = window.supabase.createClient(supabaseUrl, supabaseKey);

// ==========================================
// 2. REFERENCIAS A ELEMENTOS DE LA PANTALLA
// ==========================================
const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');

const modal = document.getElementById('modal-movimiento');
const modalQuick = document.getElementById('modal-quick');

const detallesSection = document.getElementById('details-section');
const historialSection = document.getElementById('historial-section');
const gananciasSection = document.getElementById('ganancias-section');

const inputTasaBcv = document.getElementById('tasa-bcv');
const inputTasaUsdt = document.getElementById('tasa-usdt');

let globalUserId = null;

// ==========================================
// 3. AUTENTICACIÓN
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await db.auth.getSession();
    if (session) mostrarApp();
    else { loginScreen.style.display = 'block'; appScreen.style.display = 'none'; }
});

document.getElementById('btn-login').onclick = async () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const { error } = await db.auth.signInWithPassword({ email, password });
    if (error) alert("Error: " + error.message);
    else mostrarApp();
};

document.getElementById('btn-logout').onclick = async () => { await db.auth.signOut(); location.reload(); };

async function mostrarApp() {
    // 1. Mostrar la pantalla de la app
    loginScreen.style.display = 'none';
    appScreen.style.display = 'block';
    
    // 2. Cargar tasas desde Supabase (esperamos a que lleguen antes de continuar)
    const { data: tasas, error } = await db.from('tasas_cambio').select('*').limit(1).single();
    
    if(tasas) {
        inputTasaBcv.value = tasas.tasa_bcv;
        inputTasaUsdt.value = tasas.tasa_usdt;
    } else {
        // Si no existen, inicializamos con 1
        inputTasaBcv.value = 1;
        inputTasaUsdt.value = 1;
    }
    
    // 3. Ahora que tenemos las tasas, cargamos el resto
    cargarDatos();
    cargarHistorial();
    cargarGanancias();
}
inputTasaBcv.addEventListener('change', guardarTasas);
inputTasaUsdt.addEventListener('change', guardarTasas);


// ==========================================
// 4. LÓGICA DE PESTAÑAS
// ==========================================
document.getElementById('btn-toggle-list').onclick = () => {
    detallesSection.style.display = detallesSection.style.display === 'none' ? 'block' : 'none';
    historialSection.style.display = 'none'; gananciasSection.style.display = 'none';
};
document.getElementById('btn-toggle-historial').onclick = () => {
    historialSection.style.display = historialSection.style.display === 'none' ? 'block' : 'none';
    detallesSection.style.display = 'none'; gananciasSection.style.display = 'none';
};
document.getElementById('btn-toggle-ganancias').onclick = () => {
    gananciasSection.style.display = gananciasSection.style.display === 'none' ? 'block' : 'none';
    detallesSection.style.display = 'none'; historialSection.style.display = 'none';
};


// ==========================================
// 5. MODAL RÁPIDO (AÑADIR DEUDOR / DEUDA)
// ==========================================
let quickAddType = '';

document.getElementById('btn-add-deudor').onclick = () => {
    quickAddType = 'ME_DEBEN';
    document.getElementById('quick-title').innerText = "Añadir Deudor / Cuenta";
    modalQuick.style.display = 'block';
};
document.getElementById('btn-add-deuda').onclick = () => {
    quickAddType = 'DEBO';
    document.getElementById('quick-title').innerText = "Añadir Deuda";
    modalQuick.style.display = 'block';
};
document.getElementById('btn-quick-cancel').onclick = () => modalQuick.style.display = 'none';

document.getElementById('btn-quick-guardar').onclick = async () => {
    const desc = document.getElementById('quick-desc').value;
    const monto = parseFloat(document.getElementById('quick-monto').value);
    const moneda = document.getElementById('quick-moneda').value;

    if(!desc || !monto) return alert("Faltan datos");

    await db.from('finanzas').insert([{ user_id: globalUserId, tipo: quickAddType, concepto: desc, monto: monto, moneda: moneda }]);
    
    document.getElementById('quick-desc').value = '';
    document.getElementById('quick-monto').value = '';
    modalQuick.style.display = 'none';
    cargarDatos();
};


// ==========================================
// 6. MODAL PRINCIPAL COMPLEJO
// ==========================================
document.getElementById('btn-open-modal').onclick = () => {
    modal.style.display = 'block';
    document.getElementById('select-tipo').dispatchEvent(new Event('change'));
};
document.getElementById('btn-close-modal').onclick = () => modal.style.display = 'none';

// Cargar listas dinámicas al cambiar de opción
document.getElementById('select-tipo').addEventListener('change', async (e) => {
    const campos = document.getElementById('campos-dinamicos');
    const tipo = e.target.value;
    const est = "width:100%; padding:10px; margin-bottom:10px; background:#2c2c2c; color:white; border:1px solid #444; border-radius:5px; outline:none;";
    
    campos.innerHTML = `<p style="color:#aaa;">Cargando cuentas...</p>`;
    
    // Obtener datos para los menús desplegables
    const { data } = await db.from('finanzas').select('*');
    const deudores = data.filter(d => d.tipo === 'ME_DEBEN' && d.monto > 0);
    const deudas = data.filter(d => d.tipo === 'DEBO' && d.monto > 0);

    let optDeudores = deudores.map(d => `<option value="${d.id}">${d.concepto} ($${d.monto} ${d.moneda})</option>`).join('');
    let optDeudas = deudas.map(d => `<option value="${d.id}">${d.concepto} ($${d.monto} ${d.moneda})</option>`).join('');
    
    // Opciones para el datalist híbrido (Solo los nombres)
    let opcionesCuentas = deudores.map(d => `<option value="${d.concepto}">`).join('');

    if (tipo === 'GASTO') {
        campos.innerHTML = `
            <input type="text" id="desc" placeholder="Descripción del Gasto" style="${est}">
            <input type="number" id="monto" placeholder="Monto a descontar" style="${est}">
            <select id="origen_id" style="${est}">
                <option value="">-- ¿De dónde sale el dinero? --</option>
                ${optDeudores}
            </select>
        `;
    } 
    else if (tipo === 'INGRESO') {
        campos.innerHTML = `
            <input type="number" id="monto" placeholder="Monto Total a Cobrar" style="${est}">
            <input type="text" id="desc" placeholder="Descripción (Ej: Cliente X)" style="${est}">
            <select id="moneda" style="${est}"><option value="USDT">USDT</option><option value="BCV">BCV</option></select>
            <input type="number" id="ganancia" placeholder="Ganancia Neta Limpia" style="${est}">
            <select id="categoria" style="${est}"><option value="3D">Impresión 3D</option><option value="Bolsas">Bolsas</option></select>
        `;
    } 
    else if (tipo === 'PAGO_DEUDA') {
        campos.innerHTML = `
            <select id="origen_id" style="${est}"><option value="">-- ¿De dónde sale el dinero? --</option>${optDeudores}</select>
            <select id="destino_id" style="${est}"><option value="">-- ¿Qué deuda pagas? --</option>${optDeudas}</select>
            <input type="number" id="monto" placeholder="Monto a pagar" style="${est}">
        `;
    } 
    else if (tipo === 'COBRAR') {
        campos.innerHTML = `
            <select id="origen_id" style="${est}">
                <option value="">-- ¿Quién te pagó? --</option>
                ${optDeudores}
            </select>
            
            <input type="text" id="destino_text" list="cuentas-list" placeholder="¿A dónde va el dinero? (Selecciona o escribe)" style="${est}">
            <datalist id="cuentas-list">
                ${opcionesCuentas}
            </datalist>
            
            <input type="number" id="monto" placeholder="Monto transferido" style="${est}">
        `;
    }
});

// Guardar Movimiento Complejo
document.getElementById('btn-guardar').onclick = async () => {
    const tipo = document.getElementById('select-tipo').value;
    
    try {
        if (tipo === 'GASTO') {
            const id = document.getElementById('origen_id').value;
            const monto = parseFloat(document.getElementById('monto').value);
            const desc = document.getElementById('desc').value;
            if(!id || !monto) return alert("Llena todos los campos");

            const { data: origen } = await db.from('finanzas').select('monto').eq('id', id).single();
            await db.from('finanzas').update({ monto: origen.monto - monto }).eq('id', id);
            
            await db.from('historial').insert([{ user_id: globalUserId, tipo_movimiento: tipo, monto_origen: monto, descripcion: desc }]);
        }
        else if (tipo === 'INGRESO') {
            const monto = parseFloat(document.getElementById('monto').value);
            const desc = document.getElementById('desc').value;
            const moneda = document.getElementById('moneda').value;
            const ganancia = parseFloat(document.getElementById('ganancia').value) || 0;
            const categoria = document.getElementById('categoria').value;
            if (!monto || !desc) return alert("Faltan datos");

            await db.from('finanzas').insert([{ user_id: globalUserId, tipo: 'ME_DEBEN', concepto: desc, monto: monto, moneda: moneda }]);
            await db.from('historial').insert([{ user_id: globalUserId, tipo_movimiento: tipo, monto_origen: monto, descripcion: desc, ganancia_limpia: ganancia, categoria_ganancia: categoria }]);
        }
        else if (tipo === 'PAGO_DEUDA') {
            const origen_id = document.getElementById('origen_id').value;
            const destino_id = document.getElementById('destino_id').value;
            const monto = parseFloat(document.getElementById('monto').value);
            if(!origen_id || !destino_id || !monto) return alert("Selecciona origen, destino y monto");

            const { data: oData } = await db.from('finanzas').select('monto').eq('id', origen_id).single();
            const { data: dData } = await db.from('finanzas').select('monto').eq('id', destino_id).single();
            await db.from('finanzas').update({ monto: oData.monto - monto }).eq('id', origen_id);
            await db.from('finanzas').update({ monto: dData.monto - monto }).eq('id', destino_id);
            
            await db.from('historial').insert([{ user_id: globalUserId, tipo_movimiento: tipo, monto_origen: monto, descripcion: `Pago de deuda procesado` }]);
        }
        else if (tipo === 'COBRAR') {
            const origen_id = document.getElementById('origen_id').value;
            const destino = document.getElementById('destino_text').value;
            const monto = parseFloat(document.getElementById('monto').value);
            if(!origen_id || !destino || !monto) return alert("Llena todos los campos");

            // 1. Descontar al deudor
            const { data: oData } = await db.from('finanzas').select('monto, moneda').eq('id', origen_id).single();
            await db.from('finanzas').update({ monto: oData.monto - monto }).eq('id', origen_id);

            // 2. Sumar a la cuenta existente o crear una nueva
            const { data: exist } = await db.from('finanzas').select('*').eq('tipo', 'ME_DEBEN').ilike('concepto', destino);
            if(exist && exist.length > 0) {
                await db.from('finanzas').update({ monto: exist[0].monto + monto }).eq('id', exist[0].id);
            } else {
                await db.from('finanzas').insert([{ user_id: globalUserId, tipo: 'ME_DEBEN', concepto: destino, monto: monto, moneda: oData.moneda }]);
            }
            await db.from('historial').insert([{ user_id: globalUserId, tipo_movimiento: tipo, monto_origen: monto, descripcion: `Cobro depositado en ${destino}` }]);
        }

        modal.style.display = 'none';
        cargarDatos();
        cargarHistorial();
        cargarGanancias();
    } catch(err) {
        alert("Error procesando: " + err.message);
    }
};

// ==========================================
// 7. CARGAR SALDOS Y LISTAS
// ==========================================
async function cargarDatos() {
    const { data } = await db.from('finanzas').select('*');
    if(!data) return;

    const listaDeben = document.getElementById('lista-deben');
    const listaDebo = document.getElementById('lista-debo');
    listaDeben.innerHTML = ''; listaDebo.innerHTML = '';

    let sumaTotalDeben = 0; let sumaTotalDebo = 0;
    const tBcv = parseFloat(inputTasaBcv.value)||1; const tUsdt = parseFloat(inputTasaUsdt.value)||1;

    data.forEach(item => {
        if(item.monto <= 0) return;

        let valorCv = parseFloat(item.monto);
        if (item.moneda === 'USDT') valorCv = (valorCv * tUsdt) / tBcv;

        const li = document.createElement('li');
        li.innerHTML = `<div class="item-info"><span class="item-concepto">${item.concepto}</span><span class="badge ${item.moneda==='USDT'?'badge-usdt':'badge-bcv'}">${item.moneda}</span></div><div class="item-monto-container"><span class="monto-original">Orig: $${parseFloat(item.monto).toFixed(2)} ${item.moneda}</span><span class="monto-convertido">Eq: $${valorCv.toFixed(2)}</span></div>`;

        if (item.tipo === 'ME_DEBEN') { sumaTotalDeben += valorCv; listaDeben.appendChild(li); } 
        else { sumaTotalDebo += valorCv; listaDebo.appendChild(li); }
    });

    document.getElementById('total-deben').innerText = sumaTotalDeben.toFixed(2);
    document.getElementById('total-debo').innerText = sumaTotalDebo.toFixed(2);
    document.getElementById('total-libres').innerText = (sumaTotalDeben - sumaTotalDebo).toFixed(2);
}

// ==========================================
// 8. HISTORIAL Y GANANCIAS
// ==========================================
async function cargarHistorial() {
    const { data } = await db.from('historial').select('*').order('created_at', { ascending: false }).limit(15);
    const lista = document.getElementById('lista-historial');
    lista.innerHTML = '';
    if(!data) return;

    data.forEach(item => {
        let color = "#fff"; let ic = "▪";
        if(item.tipo_movimiento==='INGRESO'){ color="#4ade80"; ic="▲"; }
        if(item.tipo_movimiento==='GASTO'){ color="#f87171"; ic="▼"; }
        if(item.tipo_movimiento==='PAGO_DEUDA'||item.tipo_movimiento==='COBRAR'){ color="#4db8ff"; ic="⇆"; }
        
        const li = document.createElement('li');
        li.innerHTML = `<div style="display:flex; flex-direction:column; gap:5px;"><span style="color:${color}; font-weight:bold;">${ic} ${item.tipo_movimiento}</span><span style="font-size:0.85rem; color:#ccc;">${item.descripcion}</span></div><div style="font-weight:bold; font-size:1.1rem;">$${parseFloat(item.monto_origen).toFixed(2)}</div>`;
        lista.appendChild(li);
    });
}

async function cargarGanancias() {
    const { data } = await db.from('historial').select('*').eq('tipo_movimiento', 'INGRESO').gt('ganancia_limpia', 0);
    if(!data) return;

    let gSem = 0, gMes = 0, t3D = 0, tBol = 0;
    
    // Obtener fecha actual sin hora para comparar
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    // Calcular el inicio de la semana (domingo)
    const firstDayOfWeek = new Date();
    firstDayOfWeek.setDate(now.getDate() - now.getDay());
    firstDayOfWeek.setHours(0,0,0,0);

    const l3D = document.getElementById('lista-ganancias-3d'); l3D.innerHTML = '';
    const lBol = document.getElementById('lista-ganancias-bolsas'); lBol.innerHTML = '';

    data.forEach(item => {
        // CORRECCIÓN: Intentar parsear la fecha de forma segura
        // Si created_at falla, usamos el ID o el momento actual como fallback
        const fecha = item.created_at ? new Date(item.created_at) : new Date();
        const g = parseFloat(item.ganancia_limpia);
        
        // Sumar si es de este mes
        if (fecha.getMonth() === currentMonth && fecha.getFullYear() === currentYear) {
            gMes += g;
        }
        // Sumar si es de esta semana (comparando fecha procesada)
        if (fecha >= firstDayOfWeek) {
            gSem += g;
        }

        const li = document.createElement('li');
        // Mostrar fecha formateada de forma segura
        const fechaStr = !isNaN(fecha) ? fecha.toLocaleDateString() : "Fecha N/A";
        
        li.innerHTML = `<div class="item-info"><span class="item-concepto">${item.descripcion}</span><span class="badge" style="background:#333;">${fechaStr}</span></div><div class="item-monto-container"><span class="monto-convertido" style="color:#4ade80;">+$${g.toFixed(2)}</span></div>`;
        
        if(item.categoria_ganancia === '3D') { t3D+=g; l3D.appendChild(li); }
        else if (item.categoria_ganancia === 'Bolsas') { tBol+=g; lBol.appendChild(li); }
    });

    document.getElementById('ganancia-semanal').innerText = gSem.toFixed(2);
    document.getElementById('ganancia-mensual').innerText = gMes.toFixed(2);
    document.getElementById('total-3d').innerText = t3D.toFixed(2);
    document.getElementById('total-bolsas').innerText = tBol.toFixed(2);
}
