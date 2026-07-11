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
const detallesSection = document.getElementById('details-section');

const inputTasaBcv = document.getElementById('tasa-bcv');
const inputTasaUsdt = document.getElementById('tasa-usdt');

// ==========================================
// 3. AUTENTICACIÓN Y SESIÓN
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    // Revisar si ya hay alguien logueado
    const { data: { session } } = await db.auth.getSession();
    
    if (session) {
        mostrarApp();
    }
});

document.getElementById('btn-login').onclick = async () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    const { data, error } = await db.auth.signInWithPassword({ email, password });
    
    if (error) {
        alert("Error al entrar: " + error.message);
    } else {
        mostrarApp();
    }
};

document.getElementById('btn-logout').onclick = async () => {
    await db.auth.signOut();
    location.reload(); // Recarga la página para volver al login
};

function mostrarApp() {
    loginScreen.style.display = 'none';
    appScreen.style.display = 'block';
    
    // Poner tasas por defecto para que no de error matemático
    inputTasaBcv.value = 1;
    inputTasaUsdt.value = 1;
    
    cargarDatos();
    cargarHistorial();
}

// Recalcular todo si el usuario cambia las tasas manualmente
inputTasaBcv.addEventListener('input', cargarDatos);
inputTasaUsdt.addEventListener('input', cargarDatos);


// ==========================================
// 4. LÓGICA DE VENTANAS EMERGENTES (MODALES)
// ==========================================
document.getElementById('btn-open-modal').onclick = () => {
    modal.style.display = 'block';
};

document.getElementById('btn-close-modal').onclick = () => {
    modal.style.display = 'none';
};

document.getElementById('btn-toggle-list').onclick = () => {
    // Si está oculto lo muestra, si está visible lo oculta
    if (detallesSection.style.display === 'none') {
        detallesSection.style.display = 'block';
    } else {
        detallesSection.style.display = 'none';
    }
};

// ==========================================
// 5. FORMULARIO DINÁMICO DE MOVIMIENTOS
// ==========================================
document.getElementById('select-tipo').addEventListener('change', (e) => {
    const campos = document.getElementById('campos-dinamicos');
    const tipo = e.target.value;
    
    if(tipo === 'PAGO_DEUDA') {
        campos.innerHTML = `
            <input type="text" id="origen" placeholder="¿De dónde sale el dinero? (Ej: Binance)" style="width:100%; padding:10px; margin-bottom:10px;">
            <input type="text" id="destino" placeholder="¿Qué deuda pagas? (Ej: Bolsas)" style="width:100%; padding:10px; margin-bottom:10px;">
            <input type="number" id="monto" placeholder="Monto a pagar" style="width:100%; padding:10px; margin-bottom:10px;">
        `;
    } else {
        campos.innerHTML = `
            <input type="number" id="monto" placeholder="Monto" style="width:100%; padding:10px; margin-bottom:10px;">
            <input type="text" id="desc" placeholder="Descripción o Motivo" style="width:100%; padding:10px; margin-bottom:10px;">
        `;
    }
});


// ==========================================
// 6. GUARDAR MOVIMIENTO Y REGISTRAR HISTORIAL
// ==========================================
document.getElementById('btn-guardar').onclick = async () => {
    const tipo = document.getElementById('select-tipo').value;
    const monto = parseFloat(document.getElementById('monto').value);
    
    if (!monto || isNaN(monto)) {
        alert("Por favor, ingresa un monto válido.");
        return;
    }

    const user = (await db.auth.getUser()).data.user;
    
    // Capturar datos dependiendo del tipo de movimiento
    let descripcionFinal = "";
    if (tipo === 'PAGO_DEUDA') {
        const origen = document.getElementById('origen').value;
        const destino = document.getElementById('destino').value;
        descripcionFinal = `Pago de deuda a ${destino} usando ${origen}`;
    } else {
        descripcionFinal = document.getElementById('desc').value || tipo;
    }

    // Guardar en la tabla historial
    const { error } = await db.from('historial').insert([{
        user_id: user.id,
        tipo_movimiento: tipo,
        monto_origen: monto,
        descripcion: descripcionFinal
    }]);

    if(error) {
        alert("Error al guardar: " + error.message);
    } else {
        modal.style.display = 'none';
        
        // Limpiar formulario
        document.getElementById('monto').value = '';
        if(document.getElementById('desc')) document.getElementById('desc').value = '';
        
        // Refrescar pantalla
        cargarHistorial();
        alert("Movimiento guardado en el historial. (Recuerda actualizar tu saldo en la base de datos si aplica)");
    }
};


// ==========================================
// 7. CARGAR SALDOS (Lógica de conversión exacta)
// ==========================================
async function cargarDatos() {
    const { data, error } = await db.from('finanzas').select('*');
    if (error) return console.error("Error cargando finanzas:", error);

    const listaDeben = document.getElementById('lista-deben');
    const listaDebo = document.getElementById('lista-debo');
    listaDeben.innerHTML = ''; 
    listaDebo.innerHTML = '';

    let sumaTotalDebenOriginal = 0; 
    let sumaTotalDeboOriginal = 0;
    let sumaTotalDebenConvertido = 0;
    let sumaTotalDeboConvertido = 0;

    const tasaBcv = parseFloat(inputTasaBcv.value) || 1;
    const tasaUsdt = parseFloat(inputTasaUsdt.value) || 1;

    data.forEach(item => {
        let valorOriginal = parseFloat(item.monto);
        let valorConvertido = valorOriginal;
        
        if (item.moneda === 'USDT') {
            valorConvertido = (valorOriginal * tasaUsdt) / tasaBcv;
        }

        const li = document.createElement('li');
        li.innerHTML = `
            <div>
                <strong>${item.concepto}</strong> 
                <span style="color:#888; font-size:0.8rem;">(${item.moneda})</span>
            </div>
            <div>$${valorOriginal.toFixed(2)}</div>
        `;

        if (item.tipo === 'ME_DEBEN') {
            sumaTotalDebenOriginal += valorOriginal;
            sumaTotalDebenConvertido += valorConvertido;
            listaDeben.appendChild(li);
        } else {
            sumaTotalDeboOriginal += valorOriginal;
            sumaTotalDeboConvertido += valorConvertido;
            listaDebo.appendChild(li);
        }
    });

    const libres = sumaTotalDebenConvertido - sumaTotalDeboConvertido;

    document.getElementById('total-deben').innerText = sumaTotalDebenOriginal.toFixed(2);
    document.getElementById('total-debo').innerText = sumaTotalDeboOriginal.toFixed(2);
    document.getElementById('total-libres').innerText = libres.toFixed(2);
}


// ==========================================
// 8. CARGAR HISTORIAL
// ==========================================
async function cargarHistorial() {
    const lista = document.getElementById('lista-historial');
    
    // Traer solo los últimos 10 movimientos
    const { data, error } = await db.from('historial')
        .select('*')
        .order('fecha', { ascending: false })
        .limit(10);
        
    if (error) return console.error("Error cargando historial:", error);
    
    lista.innerHTML = '';
    
    data.forEach(item => {
        // Asignar color dependiendo del tipo
        let color = "#ffffff";
        let icono = "▪";
        
        if (item.tipo_movimiento === 'INGRESO') { color = "#4ade80"; icono = "▲"; }
        if (item.tipo_movimiento === 'GASTO') { color = "#f87171"; icono = "▼"; }
        if (item.tipo_movimiento === 'PAGO_DEUDA') { color = "#4db8ff"; icono = "⇆"; }

        const li = document.createElement('li');
        li.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:5px;">
                <span style="color:${color}; font-weight:bold;">${icono} ${item.tipo_movimiento}</span>
                <span style="font-size:0.85rem; color:#ccc;">${item.descripcion || '-'}</span>
            </div>
            <div style="font-weight:bold; font-size:1.1rem;">
                $${parseFloat(item.monto_origen).toFixed(2)}
            </div>
        `;
        lista.appendChild(li);
    });
}
