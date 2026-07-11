// ... (Tu inicialización de Supabase sigue igual)

// Manejo del Modal
const modal = document.getElementById('modal-movimiento');
document.getElementById('btn-open-modal').onclick = () => modal.style.display = 'block';

// Lógica de tipo de movimiento (cambia los campos dinámicamente)
document.getElementById('select-tipo').addEventListener('change', (e) => {
    const campos = document.getElementById('campos-dinamicos');
    const tipo = e.target.value;
    
    if(tipo === 'PAGO_DEUDA') {
        campos.innerHTML = `
            <select id="origen"></select>
            <select id="destino"></select>
            <input type="number" id="monto" placeholder="Monto">
            <button onclick="autoFillTotal()">Pagar Total</button>
        `;
    } else {
        campos.innerHTML = `<input type="number" id="monto"><input type="text" id="desc">`;
    }
});

// Guardar Movimiento con Historial
document.getElementById('btn-guardar').onclick = async () => {
    const tipo = document.getElementById('select-tipo').value;
    const monto = parseFloat(document.getElementById('monto').value);
    
    // 1. Ejecutar el cambio en la tabla 'finanzas'
    // 2. Insertar registro en la tabla 'historial'
    const { error } = await db.from('historial').insert([{
        tipo_movimiento: tipo,
        monto_origen: monto,
        user_id: (await db.auth.getUser()).data.user.id
    }]);
    
    if(!error) {
        modal.style.display = 'none';
        cargarDatos(); // Refresca todo
    }
};

// Cargar Historial (con paginación)
let limit = 10;
async function cargarHistorial() {
    const { data } = await db.from('historial').select('*').limit(limit);
    // Renderizar en #lista-historial con flechitas de color
}
