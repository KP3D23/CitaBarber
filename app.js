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

    const colors = {
        success: '#4ade80',
        error: '#f87171',
        warning: '#facc15',
        info: '#4db8ff'
    };

    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };

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
// 3. AUTENTICACIÓN
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const { data: { session } } = await db.auth.getSession();
        if (session) {
            await mostrarApp();
        } else { 
            loginScreen.style.display = 'block'; 
            appScreen.style.display = 'none'; 
        }
    } catch (error) {
        showNotification('Error al conectar con el servidor', 'error');
    }
});

document.getElementById('btn-login').onclick = async () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    if (!email || !password) {
        showNotification('Ingresa correo y contraseña', 'warning');
        return;
    }

    try {
        const { error } = await db.auth.signInWithPassword({ email, password });
        if (error) {
            showNotification('Error: ' + error.message, 'error');
        } else {
            showNotification('¡Bienvenido!', 'success');
            await mostrarApp();
        }
    } catch (error) {
        showNotification('Error de conexión: ' + error.message, 'error');
    }
};

document.getElementById('btn-logout').onclick = async () => {
    try {
        await db.auth.signOut();
        if (window.autoRefreshInterval) {
            clearInterval(window.autoRefreshInterval);
        }
        showNotification('Sesión cerrada', 'info');
        location.reload();
    } catch (error) {
        showNotification('Error al cerrar sesión', 'error');
    }
};

async function mostrarApp() {
    // ==========================================
// 3.2 FUNCIÓN DE RESPALDO PARA TASAS
// ==========================================
async function cargarTasasConRespaldo() {
    try {
        // Intentar cargar desde Supabase
        const { data: tasas, error } = await db.from('tasas_cambio')
            .select('*')
            .limit(1)
            .single();
        
        if (tasas && !error) {
            inputTasaBcv.value = tasas.tasa_bcv;
            inputTasaUsdt.value = tasas.tasa_usdt;
            updateRateStatus('bcv', 'saved');
            updateRateStatus('usdt', 'saved');
            console.log('✅ Tasas cargadas desde Supabase:', tasas);
            return true;
        }
        
        // Si no hay datos, intentar crear la tabla
        console.log('⚠️ No se encontraron tasas, intentando crear...');
        await crearTablaTasas();
        
        // Recargar después de crear
        const { data: nuevasTasas } = await db.from('tasas_cambio')
            .select('*')
            .limit(1)
            .single();
        
        if (nuevasTasas) {
            inputTasaBcv.value = nuevasTasas.tasa_bcv;
            inputTasaUsdt.value = nuevasTasas.tasa_usdt;
            updateRateStatus('bcv', 'saved');
            updateRateStatus('usdt', 'saved');
            console.log('✅ Tasas creadas y cargadas:', nuevasTasas);
            return true;
        }
        
        // Si todo falla, usar valores por defecto
        console.warn('⚠️ Usando valores por defecto para tasas');
        inputTasaBcv.value = 710;
        inputTasaUsdt.value = 820;
        // Guardar en localStorage como respaldo
        localStorage.setItem('tasa_bcv_respaldo', '710');
        localStorage.setItem('tasa_usdt_respaldo', '820');
        return false;
        
    } catch (error) {
        console.error('❌ Error cargando tasas:', error);
        // Fallback a localStorage
        const bcvFallback = localStorage.getItem('tasa_bcv_respaldo') || '710';
        const usdtFallback = localStorage.getItem('tasa_usdt_respaldo') || '820';
        inputTasaBcv.value = bcvFallback;
        inputTasaUsdt.value = usdtFallback;
        showNotification('Usando tasas guardadas localmente', 'warning');
        return false;
    }
}

async function crearTablaTasas() {
    try {
        // Intentar crear la tabla usando SQL desde Supabase
        const { error } = await db.from('tasas_cambio').insert({
            id: 1,
            tasa_bcv: 710,
            tasa_usdt: 820,
            updated_at: new Date().toISOString()
        });
        
        if (error) {
            console.warn('No se pudo crear la tabla, usando localStorage');
            // Guardar en localStorage como respaldo
            localStorage.setItem('tasa_bcv_respaldo', '710');
            localStorage.setItem('tasa_usdt_respaldo', '820');
            return false;
        }
        return true;
    } catch (error) {
        console.warn('Error creando tabla, usando localStorage');
        localStorage.setItem('tasa_bcv_respaldo', '710');
        localStorage.setItem('tasa_usdt_respaldo', '820');
        return false;
    }
}

// Modificar la función guardarTasas para que también guarde en localStorage
async function guardarTasas(silent = false) {
    const tBcv = parseFloat(inputTasaBcv.value);
    const tUsdt = parseFloat(inputTasaUsdt.value);
    
    if (isNaN(tBcv) || isNaN(tUsdt) || tBcv <= 0 || tUsdt <= 0) {
        updateRateStatus('bcv', 'error');
        updateRateStatus('usdt', 'error');
        if (!silent) {
            showNotification('Las tasas deben ser números positivos', 'warning');
        }
        return false;
    }

    try {
        // Guardar en localStorage como respaldo SIEMPRE
        localStorage.setItem('tasa_bcv_respaldo', tBcv.toString());
        localStorage.setItem('tasa_usdt_respaldo', tUsdt.toString());
        
        // Intentar guardar en Supabase
        const { error } = await db.from('tasas_cambio').upsert({
            id: 1,
            tasa_bcv: tBcv,
            tasa_usdt: tUsdt,
            updated_at: new Date().toISOString()
        });

        if (error) {
            console.warn('Error guardando en Supabase, pero guardado en localStorage:', error);
            updateRateStatus('bcv', 'saved');
            updateRateStatus('usdt', 'saved');
            if (!silent) {
                showNotification('Tasas guardadas localmente (sin conexión a BD)', 'warning');
            }
            return true;
        }

        updateRateStatus('bcv', 'saved');
        updateRateStatus('usdt', 'saved');
        
        setTimeout(() => {
            updateRateStatus('bcv', '');
            updateRateStatus('usdt', '');
            const statusBcv = document.getElementById('status-bcv');
            const statusUsdt = document.getElementById('status-usdt');
            if (statusBcv) statusBcv.textContent = '●';
            if (statusUsdt) statusUsdt.textContent = '●';
        }, 2000);
        
        if (!silent) {
            showNotification('✅ Tasas guardadas correctamente', 'success', 1500);
        }
        return true;
    } catch (error) {
        console.error('Error guardando tasas:', error);
        // Ya tenemos el respaldo en localStorage
        updateRateStatus('bcv', 'saved');
        updateRateStatus('usdt', 'saved');
        if (!silent) {
            showNotification('Tasas guardadas localmente', 'warning');
        }
        return true;
    }
}

// Modificar mostrarApp para usar la nueva función
async function mostrarApp() {
    try {
        loginScreen.style.display = 'none';
        appScreen.style.display = 'block';
        
        const { data: { user } } = await db.auth.getUser();
        globalUserId = user.id;
        
        // CARGAR TASAS CON RESPALDO
        await cargarTasasConRespaldo();
        
        // CARGAR DATOS
        await Promise.all([
            cargarDatos(),
            cargarHistorial(),
            cargarGanancias()
        ]);
        
        // ACTUALIZACIÓN AUTOMÁTICA
        if (window.autoRefreshInterval) {
            clearInterval(window.autoRefreshInterval);
        }
        window.autoRefreshInterval = setInterval(() => {
            if (globalUserId) {
                cargarDatos();
                cargarHistorial();
                cargarGanancias();
            }
        }, 60000);
        
        setupTasaEvents();
        
    } catch (error) {
        showNotification('Error al cargar la aplicación', 'error');
        console.error(error);
    }
}
    try {
        loginScreen.style.display = 'none';
        appScreen.style.display = 'block';
        
        const { data: { user } } = await db.auth.getUser();
        globalUserId = user.id;
        
        // ==========================================
        // CARGAR TASAS DESDE SUPABASE
        // ==========================================
        const { data: tasas } = await db.from('tasas_cambio')
            .select('*')
            .limit(1)
            .single();
        
        if (tasas && tasas.tasa_bcv && tasas.tasa_usdt) {
            inputTasaBcv.value = tasas.tasa_bcv;
            inputTasaUsdt.value = tasas.tasa_usdt;
            // Actualizar estado
            updateRateStatus('bcv', 'saved');
            updateRateStatus('usdt', 'saved');
        } else {
            // Si no hay tasas guardadas, usar valores por defecto
            inputTasaBcv.value = 1;
            inputTasaUsdt.value = 1;
            // Guardar los valores iniciales
            await guardarTasas(true);
        }
        
        // ==========================================
        // CARGAR DATOS
        // ==========================================
        await Promise.all([
            cargarDatos(),
            cargarHistorial(),
            cargarGanancias()
        ]);
        
        // ==========================================
        // ACTUALIZACIÓN AUTOMÁTICA
        // ==========================================
        if (window.autoRefreshInterval) {
            clearInterval(window.autoRefreshInterval);
        }
        window.autoRefreshInterval = setInterval(() => {
            if (globalUserId) {
                cargarDatos();
                cargarHistorial();
                cargarGanancias();
            }
        }, 60000);
        
        // ==========================================
        // EVENTOS PARA ACTUALIZAR EN TIEMPO REAL
        // ==========================================
        setupTasaEvents();
        
    } catch (error) {
        showNotification('Error al cargar la aplicación', 'error');
        console.error(error);
    }
}

// ==========================================
// 3.1 MANEJO DE TASAS EN TIEMPO REAL
// ==========================================
function updateRateStatus(tipo, estado) {
    const statusEl = tipo === 'bcv' ? statusBcv : statusUsdt;
    statusEl.className = 'rate-status';
    if (estado) {
        statusEl.classList.add(estado);
        if (estado === 'saving') {
            statusEl.textContent = '⏳';
        } else if (estado === 'saved') {
            statusEl.textContent = '✅';
        } else if (estado === 'error') {
            statusEl.textContent = '❌';
        }
    }
}

let tasaTimeoutId;

function setupTasaEvents() {
    // Evento para BCV
    inputTasaBcv.addEventListener('input', () => {
        clearTimeout(tasaTimeoutId);
        updateRateStatus('bcv', 'saving');
        tasaTimeoutId = setTimeout(async () => {
            await guardarTasas();
            // Actualizar todos los datos después de guardar
            await cargarDatos();
            await cargarHistorial();
            await cargarGanancias();
        }, 500); // Reducido a 500ms para más rapidez
    });

    // Evento para USDT
    inputTasaUsdt.addEventListener('input', () => {
        clearTimeout(tasaTimeoutId);
        updateRateStatus('usdt', 'saving');
        tasaTimeoutId = setTimeout(async () => {
            await guardarTasas();
            // Actualizar todos los datos después de guardar
            await cargarDatos();
            await cargarHistorial();
            await cargarGanancias();
        }, 500);
    });

    // También actualizar cuando se pierde el foco
    inputTasaBcv.addEventListener('blur', async () => {
        clearTimeout(tasaTimeoutId);
        await guardarTasas();
        await cargarDatos();
        await cargarHistorial();
        await cargarGanancias();
    });

    inputTasaUsdt.addEventListener('blur', async () => {
        clearTimeout(tasaTimeoutId);
        await guardarTasas();
        await cargarDatos();
        await cargarHistorial();
        await cargarGanancias();
    });
}

async function guardarTasas(silent = false) {
    const tBcv = parseFloat(inputTasaBcv.value);
    const tUsdt = parseFloat(inputTasaUsdt.value);
    
    // Validación
    if (isNaN(tBcv) || isNaN(tUsdt) || tBcv <= 0 || tUsdt <= 0) {
        updateRateStatus('bcv', 'error');
        updateRateStatus('usdt', 'error');
        if (!silent) {
            showNotification('Las tasas deben ser números positivos', 'warning');
        }
        return false;
    }

    try {
        // Guardar en Supabase
        const { error } = await db.from('tasas_cambio').upsert({
            id: 1,
            tasa_bcv: tBcv,
            tasa_usdt: tUsdt,
            updated_at: new Date().toISOString()
        });

        if (error) throw error;

        // Actualizar estados visuales
        updateRateStatus('bcv', 'saved');
        updateRateStatus('usdt', 'saved');
        
        // Restaurar después de 2 segundos
        setTimeout(() => {
            updateRateStatus('bcv', '');
            updateRateStatus('usdt', '');
            const statusBcv = document.getElementById('status-bcv');
            const statusUsdt = document.getElementById('status-usdt');
            if (statusBcv) statusBcv.textContent = '●';
            if (statusUsdt) statusUsdt.textContent = '●';
        }, 2000);
        
        return true;
    } catch (error) {
        console.error('Error guardando tasas:', error);
        updateRateStatus('bcv', 'error');
        updateRateStatus('usdt', 'error');
        if (!silent) {
            showNotification('Error al guardar tasas', 'error');
        }
        return false;
    }
}

// ==========================================
// 4. LÓGICA DE PESTAÑAS
// ==========================================
document.getElementById('btn-toggle-list').onclick = () => {
    detallesSection.style.display = detallesSection.style.display === 'none' ? 'block' : 'none';
    historialSection.style.display = 'none'; 
    gananciasSection.style.display = 'none';
};

document.getElementById('btn-toggle-historial').onclick = () => {
    historialSection.style.display = historialSection.style.display === 'none' ? 'block' : 'none';
    detallesSection.style.display = 'none'; 
    gananciasSection.style.display = 'none';
    if (historialSection.style.display === 'block') {
        historialOffset = 0;
        cargarHistorial();
    }
};

document.getElementById('btn-toggle-ganancias').onclick = () => {
    gananciasSection.style.display = gananciasSection.style.display === 'none' ? 'block' : 'none';
    detallesSection.style.display = 'none'; 
    historialSection.style.display = 'none';
};

// ==========================================
// 5. MODAL RÁPIDO
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

document.getElementById('btn-quick-cancel').onclick = () => {
    modalQuick.style.display = 'none';
    document.getElementById('quick-desc').value = '';
    document.getElementById('quick-monto').value = '';
};

document.getElementById('btn-quick-guardar').onclick = async () => {
    const desc = document.getElementById('quick-desc').value.trim();
    const monto = parseFloat(document.getElementById('quick-monto').value);
    const moneda = document.getElementById('quick-moneda').value;

    if (!desc) {
        showNotification('Ingresa una descripción', 'warning');
        return;
    }
    
    if (!monto || monto <= 0) {
        showNotification('Ingresa un monto mayor a 0', 'warning');
        return;
    }

    try {
        await db.from('finanzas').insert([{ 
            user_id: globalUserId, 
            tipo: quickAddType, 
            concepto: desc, 
            monto: monto, 
            moneda: moneda 
        }]);
        
        document.getElementById('quick-desc').value = '';
        document.getElementById('quick-monto').value = '';
        modalQuick.style.display = 'none';
        
        showNotification('Añadido correctamente', 'success');
        await cargarDatos();
    } catch (error) {
        showNotification('Error al guardar: ' + error.message, 'error');
    }
};

// ==========================================
// 6. MODAL PRINCIPAL
// ==========================================
document.getElementById('btn-open-modal').onclick = () => {
    modal.style.display = 'block';
    document.getElementById('select-tipo').dispatchEvent(new Event('change'));
};

document.getElementById('btn-close-modal').onclick = () => {
    modal.style.display = 'none';
};

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        modal.style.display = 'none';
        modalQuick.style.display = 'none';
    }
});

// Cargar listas dinámicas
document.getElementById('select-tipo').addEventListener('change', async (e) => {
    const campos = document.getElementById('campos-dinamicos');
    const tipo = e.target.value;
    const est = "width:100%; padding:10px; margin-bottom:10px; background:#2c2c2c; color:white; border:1px solid #444; border-radius:5px; outline:none;";
    
    campos.innerHTML = `<p style="color:#aaa;">Cargando...</p>`;
    
    try {
        const { data } = await db.from('finanzas')
            .select('id, tipo, concepto, monto, moneda')
            .eq('user_id', globalUserId)
            .gt('monto', 0);
        
        if (!data) return;
        
        const deudores = data.filter(d => d.tipo === 'ME_DEBEN' && d.monto > 0);
        const deudas = data.filter(d => d.tipo === 'DEBO' && d.monto > 0);

        let optDeudores = deudores.map(d => `<option value="${d.id}">${d.concepto} ($${d.monto.toFixed(2)} ${d.moneda})</option>`).join('');
        let optDeudas = deudas.map(d => `<option value="${d.id}">${d.concepto} ($${d.monto.toFixed(2)} ${d.moneda})</option>`).join('');
        let opcionesCuentas = deudores.map(d => `<option value="${d.concepto}">`).join('');

        if (tipo === 'GASTO') {
            campos.innerHTML = `
                <input type="text" id="desc" placeholder="Descripción del Gasto" style="${est}">
                <input type="number" id="monto" placeholder="Monto a descontar" step="0.01" min="0.01" style="${est}">
                <select id="origen_id" style="${est}">
                    <option value="">-- ¿De dónde sale el dinero? --</option>
                    ${optDeudores}
                </select>
            `;
        } 
        else if (tipo === 'INGRESO') {
            campos.innerHTML = `
                <input type="number" id="monto" placeholder="Monto Total a Cobrar" step="0.01" min="0.01" style="${est}">
                <input type="text" id="desc" placeholder="Descripción (Ej: Cliente X)" style="${est}">
                <select id="moneda" style="${est}"><option value="USDT">USDT</option><option value="BCV">BCV</option></select>
                <input type="number" id="ganancia" placeholder="Ganancia Neta Limpia" step="0.01" min="0" style="${est}">
                <select id="categoria" style="${est}"><option value="3D">Impresión 3D</option><option value="Bolsas">Bolsas</option></select>
            `;
        } 
        else if (tipo === 'PAGO_DEUDA') {
            campos.innerHTML = `
                <select id="origen_id" style="${est}"><option value="">-- ¿De dónde sale el dinero? --</option>${optDeudores}</select>
                <select id="destino_id" style="${est}"><option value="">-- ¿Qué deuda pagas? --</option>${optDeudas}</select>
                <input type="number" id="monto" placeholder="Monto a pagar" step="0.01" min="0.01" style="${est}">
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
                <input type="number" id="monto" placeholder="Monto transferido" step="0.01" min="0.01" style="${est}">
            `;
        }
    } catch (error) {
        campos.innerHTML = `<p style="color:#f87171;">Error al cargar</p>`;
        showNotification('Error al cargar opciones', 'error');
    }
});

// Guardar Movimiento
document.getElementById('btn-guardar').onclick = async () => {
    const tipo = document.getElementById('select-tipo').value;
    
    try {
        if (tipo === 'GASTO') {
            const id = document.getElementById('origen_id').value;
            const monto = parseFloat(document.getElementById('monto').value);
            const desc = document.getElementById('desc').value.trim();
            
            if (!id) return showNotification('Selecciona una cuenta de origen', 'warning');
            if (!monto || monto <= 0) return showNotification('Ingresa un monto válido', 'warning');
            if (!desc) return showNotification('Ingresa una descripción', 'warning');

            const { data: origen } = await db.from('finanzas').select('monto').eq('id', id).single();
            if (!origen) return showNotification('Cuenta no encontrada', 'error');
            if (origen.monto < monto) return showNotification('Saldo insuficiente', 'error');

            await db.from('finanzas').update({ monto: origen.monto - monto }).eq('id', id);
            await db.from('historial').insert([{ 
                user_id: globalUserId, 
                tipo_movimiento: tipo, 
                monto_origen: monto, 
                descripcion: desc 
            }]);
            showNotification('Gasto registrado', 'success');
        }
        else if (tipo === 'INGRESO') {
            const monto = parseFloat(document.getElementById('monto').value);
            const desc = document.getElementById('desc').value.trim();
            const moneda = document.getElementById('moneda').value;
            const ganancia = parseFloat(document.getElementById('ganancia').value) || 0;
            const categoria = document.getElementById('categoria').value;
            
            if (!monto || monto <= 0) return showNotification('Ingresa un monto válido', 'warning');
            if (!desc) return showNotification('Ingresa una descripción', 'warning');

            await db.from('finanzas').insert([{ 
                user_id: globalUserId, 
                tipo: 'ME_DEBEN', 
                concepto: desc, 
                monto: monto, 
                moneda: moneda 
            }]);
            await db.from('historial').insert([{ 
                user_id: globalUserId, 
                tipo_movimiento: tipo, 
                monto_origen: monto, 
                descripcion: desc, 
                ganancia_limpia: ganancia, 
                categoria_ganancia: categoria 
            }]);
            showNotification('Ingreso registrado', 'success');
        }
        else if (tipo === 'PAGO_DEUDA') {
            const origen_id = document.getElementById('origen_id').value;
            const destino_id = document.getElementById('destino_id').value;
            const monto = parseFloat(document.getElementById('monto').value);
            
            if (!origen_id || !destino_id) return showNotification('Selecciona origen y destino', 'warning');
            if (!monto || monto <= 0) return showNotification('Ingresa un monto válido', 'warning');

            const { data: oData } = await db.from('finanzas').select('monto').eq('id', origen_id).single();
            const { data: dData } = await db.from('finanzas').select('monto').eq('id', destino_id).single();
            
            if (!oData || !dData) return showNotification('Cuentas no encontradas', 'error');
            if (oData.monto < monto) return showNotification('Saldo insuficiente', 'error');

            await db.from('finanzas').update({ monto: oData.monto - monto }).eq('id', origen_id);
            await db.from('finanzas').update({ monto: dData.monto - monto }).eq('id', destino_id);
            await db.from('historial').insert([{ 
                user_id: globalUserId, 
                tipo_movimiento: tipo, 
                monto_origen: monto, 
                descripcion: `Pago de deuda procesado` 
            }]);
            showNotification('Pago registrado', 'success');
        }
        else if (tipo === 'COBRAR') {
            const origen_id = document.getElementById('origen_id').value;
            const destino = document.getElementById('destino_text').value.trim();
            const monto = parseFloat(document.getElementById('monto').value);
            
            if (!origen_id) return showNotification('Selecciona quién pagó', 'warning');
            if (!destino) return showNotification('Indica a dónde va el dinero', 'warning');
            if (!monto || monto <= 0) return showNotification('Ingresa un monto válido', 'warning');

            const { data: oData } = await db.from('finanzas').select('monto, moneda').eq('id', origen_id).single();
            if (!oData) return showNotification('Cuenta no encontrada', 'error');
            if (oData.monto < monto) return showNotification('Saldo insuficiente', 'error');

            await db.from('finanzas').update({ monto: oData.monto - monto }).eq('id', origen_id);

            const { data: exist } = await db.from('finanzas')
                .select('*')
                .eq('user_id', globalUserId)
                .eq('tipo', 'ME_DEBEN')
                .ilike('concepto', destino);
            
            if (exist && exist.length > 0) {
                await db.from('finanzas').update({ monto: exist[0].monto + monto }).eq('id', exist[0].id);
            } else {
                await db.from('finanzas').insert([{ 
                    user_id: globalUserId, 
                    tipo: 'ME_DEBEN', 
                    concepto: destino, 
                    monto: monto, 
                    moneda: oData.moneda 
                }]);
            }
            await db.from('historial').insert([{ 
                user_id: globalUserId, 
                tipo_movimiento: tipo, 
                monto_origen: monto, 
                descripcion: `Cobro depositado en ${destino}` 
            }]);
            showNotification('Cobro registrado', 'success');
        }

        modal.style.display = 'none';
        await Promise.all([
            cargarDatos(),
            cargarHistorial(),
            cargarGanancias()
        ]);
        
    } catch(err) {
        showNotification('Error: ' + err.message, 'error');
    }
};

// ==========================================
// 7. CARGAR DATOS CON CONVERSIÓN CORRECTA
// ==========================================
async function cargarDatos() {
    try {
        const { data } = await db.from('finanzas')
            .select('id, tipo, concepto, monto, moneda')
            .eq('user_id', globalUserId)
            .gt('monto', 0);
        
        if (!data) return;

        const listaDeben = document.getElementById('lista-deben');
        const listaDebo = document.getElementById('lista-debo');
        listaDeben.innerHTML = ''; 
        listaDebo.innerHTML = '';

        let sumaTotalDeben = 0; 
        let sumaTotalDebo = 0;
        
        // Obtener tasas actuales
        const tBcv = parseFloat(inputTasaBcv.value) || 1;
        const tUsdt = parseFloat(inputTasaUsdt.value) || 1;

        data.forEach(item => {
            let montoOriginal = parseFloat(item.monto);
            let valorEnBcv = montoOriginal;
            
            // CONVERSIÓN CORRECTA: Si es USDT, convertimos a BCV
            if (item.moneda === 'USDT') {
                // Fórmula: (monto_USDT * tasa_USDT) / tasa_BCV
                valorEnBcv = (montoOriginal * tUsdt) / tBcv;
            }
            // Si es BCV, ya está en BCV, no se convierte

            const li = document.createElement('li');
            li.innerHTML = `
                <div class="item-info">
                    <span class="item-concepto">${item.concepto}</span>
                    <span class="badge ${item.moneda==='USDT'?'badge-usdt':'badge-bcv'}">${item.moneda}</span>
                </div>
                <div class="item-monto-container">
                    <span class="monto-original">Orig: $${montoOriginal.toFixed(2)} ${item.moneda}</span>
                    <span class="monto-convertido">Eq: $${valorEnBcv.toFixed(2)} BCV</span>
                </div>
                <div class="item-actions">
                    <button onclick="editarItem('${item.id}')" class="btn-icon" title="Editar">✏️</button>
                    <button onclick="eliminarItem('${item.id}')" class="btn-icon" title="Eliminar">🗑️</button>
                </div>
            `;

            if (item.tipo === 'ME_DEBEN') { 
                sumaTotalDeben += valorEnBcv; 
                listaDeben.appendChild(li); 
            } else { 
                sumaTotalDebo += valorEnBcv; 
                listaDebo.appendChild(li); 
            }
        });

        // Mostrar todos los totales en BCV
        document.getElementById('total-deben').innerText = sumaTotalDeben.toFixed(2);
        document.getElementById('total-debo').innerText = sumaTotalDebo.toFixed(2);
        document.getElementById('total-libres').innerText = (sumaTotalDeben - sumaTotalDebo).toFixed(2);
        
    } catch (error) {
        showNotification('Error al cargar datos', 'error');
        console.error(error);
    }
}

// ==========================================
// 7.1 EDITAR Y ELIMINAR
// ==========================================
async function editarItem(id) {
    try {
        const { data: item } = await db.from('finanzas')
            .select('*')
            .eq('id', id)
            .single();
        
        if (!item) return showNotification('Item no encontrado', 'error');
        
        const editModal = document.createElement('div');
        editModal.className = 'modal';
        editModal.style.display = 'block';
        editModal.innerHTML = `
            <div class="modal-content">
                <h2>Editar ${item.tipo === 'ME_DEBEN' ? 'Deudor' : 'Deuda'}</h2>
                <input type="text" id="edit-concepto" value="${item.concepto}" style="width:100%; padding:10px; margin-bottom:10px; background:#2c2c2c; color:white; border:1px solid #444; border-radius:5px;">
                <input type="number" id="edit-monto" value="${item.monto}" step="0.01" style="width:100%; padding:10px; margin-bottom:10px; background:#2c2c2c; color:white; border:1px solid #444; border-radius:5px;">
                <select id="edit-moneda" style="width:100%; padding:10px; margin-bottom:15px; background:#2c2c2c; color:white; border:1px solid #444; border-radius:5px;">
                    <option value="USDT" ${item.moneda === 'USDT' ? 'selected' : ''}>USDT</option>
                    <option value="BCV" ${item.moneda === 'BCV' ? 'selected' : ''}>BCV</option>
                </select>
                <div style="display:flex; gap:10px;">
                    <button onclick="guardarEdicion('${id}')" class="btn-main" style="flex:1;">Guardar</button>
                    <button onclick="this.closest('.modal').remove()" class="btn-sec" style="flex:1; border:none;">Cancelar</button>
                </div>
            </div>
        `;
        document.body.appendChild(editModal);
    } catch (error) {
        showNotification('Error al cargar el item', 'error');
    }
}

async function guardarEdicion(id) {
    const concepto = document.getElementById('edit-concepto').value.trim();
    const monto = parseFloat(document.getElementById('edit-monto').value);
    const moneda = document.getElementById('edit-moneda').value;
    
    if (!concepto) return showNotification('Ingresa un concepto', 'warning');
    if (!monto || monto <= 0) return showNotification('Ingresa un monto válido', 'warning');
    
    try {
        await db.from('finanzas')
            .update({ concepto, monto, moneda })
            .eq('id', id);
        
        document.querySelector('.modal').remove();
        showNotification('Actualizado correctamente', 'success');
        await cargarDatos();
    } catch (error) {
        showNotification('Error al actualizar', 'error');
    }
}

async function eliminarItem(id) {
    if (!confirm('¿Eliminar este registro?')) return;
    
    try {
        await db.from('finanzas').delete().eq('id', id);
        showNotification('Eliminado correctamente', 'success');
        await cargarDatos();
    } catch (error) {
        showNotification('Error al eliminar', 'error');
    }
}

window.editarItem = editarItem;
window.eliminarItem = eliminarItem;
window.guardarEdicion = guardarEdicion;

// ==========================================
// 8. HISTORIAL
// ==========================================
async function cargarHistorial(loadMore = false) {
    try {
        if (!loadMore) historialOffset = 0;
        
        const { data } = await db.from('historial')
            .select('*')
            .eq('user_id', globalUserId)
            .order('created_at', { ascending: false })
            .range(historialOffset, historialOffset + HISTORIAL_LIMIT - 1);
        
        const lista = document.getElementById('lista-historial');
        
        if (!loadMore) lista.innerHTML = '';
        if (!data || data.length === 0) {
            if (!loadMore) {
                lista.innerHTML = '<li style="text-align:center; color:#aaa;">No hay movimientos</li>';
            }
            return;
        }

        data.forEach(item => {
            let color = "#fff"; 
            let ic = "▪";
            if(item.tipo_movimiento === 'INGRESO'){ color="#4ade80"; ic="▲"; }
            if(item.tipo_movimiento === 'GASTO'){ color="#f87171"; ic="▼"; }
            if(item.tipo_movimiento === 'PAGO_DEUDA' || item.tipo_movimiento === 'COBRAR'){ color="#4db8ff"; ic="⇆"; }
            
            const li = document.createElement('li');
            const fecha = new Date(item.created_at);
            const fechaStr = fecha.toLocaleDateString() + ' ' + fecha.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            
            li.innerHTML = `
                <div style="display:flex; flex-direction:column; gap:5px;">
                    <span style="color:${color}; font-weight:bold;">${ic} ${item.tipo_movimiento}</span>
                    <span style="font-size:0.85rem; color:#ccc;">${item.descripcion}</span>
                    <span style="font-size:0.7rem; color:#666;">${fechaStr}</span>
                </div>
                <div style="font-weight:bold; font-size:1.1rem;">
                    $${parseFloat(item.monto_origen).toFixed(2)}
                </div>
            `;
            lista.appendChild(li);
        });

        if (data.length === HISTORIAL_LIMIT) {
            const existingBtn = document.getElementById('btn-load-more');
            if (!existingBtn) {
                const btn = document.createElement('button');
                btn.id = 'btn-load-more';
                btn.className = 'btn-sec';
                btn.style.marginTop = '10px';
                btn.style.width = '100%';
                btn.textContent = 'Ver más...';
                btn.onclick = () => {
                    historialOffset += HISTORIAL_LIMIT;
                    cargarHistorial(true);
                };
                lista.appendChild(btn);
            }
        } else {
            const btn = document.getElementById('btn-load-more');
            if (btn) btn.remove();
        }
        
    } catch (error) {
        showNotification('Error al cargar historial', 'error');
    }
}

// ==========================================
// 9. GANANCIAS
// ==========================================
async function cargarGanancias() {
    try {
        const { data } = await db.from('historial')
            .select('*')
            .eq('user_id', globalUserId)
            .eq('tipo_movimiento', 'INGRESO')
            .gt('ganancia_limpia', 0);
        
        if (!data) return;

        let gSem = 0, gMes = 0, t3D = 0, tBol = 0;
        
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const firstDayOfWeek = new Date(now);
        firstDayOfWeek.setDate(now.getDate() - now.getDay());
        firstDayOfWeek.setHours(0,0,0,0);

        const l3D = document.getElementById('lista-ganancias-3d'); 
        l3D.innerHTML = '';
        const lBol = document.getElementById('lista-ganancias-bolsas'); 
        lBol.innerHTML = '';

        data.forEach(item => {
            const fecha = new Date(item.created_at);
            const g = parseFloat(item.ganancia_limpia);
            
            if (fecha.getMonth() === currentMonth && fecha.getFullYear() === currentYear) {
                gMes += g;
            }
            if (fecha >= firstDayOfWeek) {
                gSem += g;
            }

            const li = document.createElement('li');
            const fechaStr = fecha.toLocaleDateString();
            
            li.innerHTML = `
                <div class="item-info">
                    <span class="item-concepto">${item.descripcion}</span>
                    <span class="badge" style="background:#333;">${fechaStr}</span>
                </div>
                <div class="item-monto-container">
                    <span class="monto-convertido" style="color:#4ade80;">+$${g.toFixed(2)}</span>
                </div>
            `;
            
            if(item.categoria_ganancia === '3D') { 
                t3D += g; 
                l3D.appendChild(li); 
            } else if (item.categoria_ganancia === 'Bolsas') { 
                tBol += g; 
                lBol.appendChild(li); 
            }
        });

        document.getElementById('ganancia-semanal').innerText = gSem.toFixed(2);
        document.getElementById('ganancia-mensual').innerText = gMes.toFixed(2);
        document.getElementById('total-3d').innerText = t3D.toFixed(2);
        document.getElementById('total-bolsas').innerText = tBol.toFixed(2);
        
        if (data.length === 0) {
            l3D.innerHTML = '<li style="text-align:center; color:#aaa;">No hay ganancias</li>';
            lBol.innerHTML = '<li style="text-align:center; color:#aaa;">No hay ganancias</li>';
        }
    } catch (error) {
        showNotification('Error al cargar ganancias', 'error');
    }
}