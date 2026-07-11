// CONFIGURACIÓN SUPABASE
const supabaseUrl = 'https://tecasjijlodgsvkgdqvs.supabase.co';
const supabaseKey = 'sb_publishable_Eg0bMHVcqHtkBXMuH-lAIA_cTmO99Qw';
const db = window.supabase.createClient(supabaseUrl, supabaseKey);

// Referencias del DOM
const modal = document.getElementById('modal-movimiento');
const detallesSection = document.getElementById('details-section');

// 1. INICIALIZACIÓN
document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await db.auth.getSession();
    if (session) {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('app-screen').style.display = 'block';
        cargarDatos();
        cargarHistorial();
    }
});

// 2. MODAL Y UI
document.getElementById('btn-open-modal').onclick = () => modal.style.display = 'block';
document.getElementById('btn-toggle-list').onclick = () => {
    detallesSection.style.display = detallesSection.style.display === 'none' ? 'block' : 'none';
};

// 3. LÓGICA DE MOVIMIENTOS (GASTO, INGRESO, PAGO)
document.getElementById('select-tipo').addEventListener('change', (e) => {
    const campos = document.getElementById('campos-dinamicos');
    const tipo = e.target.value;
    
    if(tipo === 'PAGO_DEUDA') {
        campos.innerHTML = `
            <input type="number" id="monto" placeholder="Monto a pagar">
            <input type="text" id="origen" placeholder="Cuenta de origen">
            <input type="text" id="destino" placeholder="Cuenta deuda a pagar">
        `;
    } else {
        campos.innerHTML = `<input type="number" id="monto" placeholder="Monto"><input type="text" id="desc" placeholder="Descripción">`;
    }
});

// 4. GUARDAR MOVIMIENTO
document.getElementById('btn-guardar').onclick = async () => {
    const tipo = document.getElementById('select-tipo').value;
    const monto = parseFloat(document.getElementById('monto').value);
    const user = (await db.auth.getUser()).data.user;

    // Insertar en historial
    const { error } = await db.from('historial').insert([{
        tipo_movimiento: tipo,
        monto_origen: monto,
        user_id: user.id,
        descripcion: document.getElementById('desc')?.value || 'Pago de deuda'
    }]);

    if(!error) {
        modal.style.display = 'none';
        cargarDatos();
        cargarHistorial();
    } else {
        alert("Error al guardar: " + error.message);
    }
};

// 5. CARGAR DATOS (Balance)
async function cargarDatos() {
    const { data } = await db.from('finanzas').select('*');
    // ... aquí mantienes tu lógica de suma de tarjetas original ...
    // Asegúrate de que las sumas sigan usando .toFixed(2)
}

// 6. CARGAR HISTORIAL (Recientes)
async function cargarHistorial() {
    const lista = document.getElementById('lista-historial');
    const { data } = await db.from('historial').select('*').order('fecha', { ascending: false }).limit(10);
    
    lista.innerHTML = '';
    data.forEach(item => {
        const li = document.createElement('li');
        li.innerHTML = `
            <div><strong>${item.tipo_movimiento}</strong> - $${item.monto_origen}</div>
            <small>${new Date(item.fecha).toLocaleDateString()}</small>
        `;
        lista.appendChild(li);
    });
}

// 7. CERRAR SESIÓN
document.getElementById('btn-logout').onclick = async () => {
    await db.auth.signOut();
    location.reload();
};
