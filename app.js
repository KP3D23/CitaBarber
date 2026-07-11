// CONFIGURACIÓN SUPABASE (Pega aquí tus llaves del proyecto)
const supabaseUrl = 'TU_URL';
const supabaseKey = 'TU_ANON_KEY'; 
const db = window.supabase.createClient(supabaseUrl, supabaseKey);

// Inicializar la aplicación
document.addEventListener('DOMContentLoaded', cargarDatos);

// Enviar nuevo registro
document.getElementById('finance-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const concepto = document.getElementById('concepto').value.trim();
    const monto = parseFloat(document.getElementById('monto').value);
    const tipo = document.getElementById('tipo').value;

    const { error } = await db.from('finanzas').insert([{ concepto, monto, tipo }]);
    
    if (error) {
        alert("Error al guardar: " + error.message);
    } else {
        e.target.reset();
        cargarDatos();
    }
});

// Función principal para leer y renderizar
async function cargarDatos() {
    const { data, error } = await db.from('finanzas').select('*').order('created_at', { ascending: false });
    
    if (error) {
        console.error("Error al cargar datos:", error);
        return;
    }

    const listaDeben = document.getElementById('lista-deben');
    const listaDebo = document.getElementById('lista-debo');
    listaDeben.innerHTML = '';
    listaDebo.innerHTML = '';

    let totalDeben = 0;
    let totalDebo = 0;

    data.forEach(item => {
        const li = document.createElement('li');
        li.innerHTML = `
            <div class="item-info">
                <span class="item-concepto">${item.concepto}</span>
            </div>
            <div style="display:flex; align-items:center; gap: 15px;">
                <span class="item-monto">${parseFloat(item.monto).toFixed(2)}</span>
                <button class="btn-delete" onclick="borrarRegistro('${item.id}')">🗑️</button>
            </div>
        `;

        if (item.tipo === 'ME_DEBEN') {
            totalDeben += parseFloat(item.monto);
            listaDeben.appendChild(li);
        } else {
            totalDebo += parseFloat(item.monto);
            listaDebo.appendChild(li);
        }
    });

    // Calcular Capital Libre
    const libres = totalDeben - totalDebo;

    // Actualizar los números en pantalla
    document.getElementById('total-deben').innerText = totalDeben.toFixed(2);
    document.getElementById('total-debo').innerText = totalDebo.toFixed(2);
    document.getElementById('total-libres').innerText = libres.toFixed(2);
}

// Función para eliminar cuando ya te pagan o ya pagaste
window.borrarRegistro = async function(id) {
    if(confirm("¿Seguro que deseas eliminar este registro?")) {
        const { error } = await db.from('finanzas').delete().eq('id', id);
        if(!error) {
            cargarDatos();
        } else {
            alert("Error al borrar el registro");
        }
    }
};
