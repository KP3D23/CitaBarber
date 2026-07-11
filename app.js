// CONFIGURACIÓN SUPABASE (Recuerda poner tus llaves)
const supabaseUrl = 'https://tecasjijlodgsvkgdqvs.supabase.co';
const supabaseKey = 'sb_publishable_Eg0bMHVcqHtkBXMuH-lAIA_cTmO99Qw'; 
const db = window.supabase.createClient(supabaseUrl, supabaseKey);

// Referencias de pantallas
const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');

// Referencias a los inputs de tasas
const inputTasaBcv = document.getElementById('tasa-bcv');
const inputTasaUsdt = document.getElementById('tasa-usdt');

document.addEventListener('DOMContentLoaded', async () => {
    // Restaurar tasas guardadas
    if(localStorage.getItem('tasaBcv')) inputTasaBcv.value = localStorage.getItem('tasaBcv');
    if(localStorage.getItem('tasaUsdt')) inputTasaUsdt.value = localStorage.getItem('tasaUsdt');

    // Revisar si ya hay una sesión guardada en el navegador
    const { data: { session } } = await db.auth.getSession();
    if (session) {
        mostrarPanel();
    }
});

// Evento: Iniciar Sesión
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    const { data, error } = await db.auth.signInWithPassword({ email, password });
    
    if (error) {
        alert("Credenciales incorrectas: " + error.message);
    } else {
        mostrarPanel();
    }
});

// Evento: Cerrar Sesión
document.getElementById('btn-logout').addEventListener('click', async () => {
    await db.auth.signOut();
    loginScreen.style.display = 'block';
    appScreen.style.display = 'none';
});

// Función para habilitar la pantalla y cargar los datos
function mostrarPanel() {
    loginScreen.style.display = 'none';
    appScreen.style.display = 'block';
    cargarDatos();
}

// Guardar tasas en memoria
inputTasaBcv.addEventListener('input', () => { localStorage.setItem('tasaBcv', inputTasaBcv.value); cargarDatos(); });
inputTasaUsdt.addEventListener('input', () => { localStorage.setItem('tasaUsdt', inputTasaUsdt.value); cargarDatos(); });

// Evento: Guardar nuevo registro
document.getElementById('finance-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const concepto = document.getElementById('concepto').value.trim();
    const monto = parseFloat(document.getElementById('monto').value);
    const moneda = document.getElementById('moneda').value;
    const tipo = document.getElementById('tipo').value;

    const { error } = await db.from('finanzas').insert([{ concepto, monto, moneda, tipo }]);
    
    if (error) alert("Error al guardar: " + error.message);
    else { e.target.reset(); cargarDatos(); }
});

// Cargar y renderizar datos
async function cargarDatos() {
    const { data, error } = await db.from('finanzas').select('*').order('fecha', { ascending: false });
    if (error) return console.error("Error:", error);

    const listaDeben = document.getElementById('lista-deben');
    const listaDebo = document.getElementById('lista-debo');
    listaDeben.innerHTML = ''; listaDebo.innerHTML = '';

    let totalDeben = 0; let totalDebo = 0;
    const tasaBcv = parseFloat(inputTasaBcv.value) || 1;
    const tasaUsdt = parseFloat(inputTasaUsdt.value) || 1;

    data.forEach(item => {
        let valorOriginal = parseFloat(item.monto);
        let valorConvertido = valorOriginal;
        let badgeClase = item.moneda === 'USDT' ? 'badge-usdt' : 'badge-bcv';
        let textoOriginal = item.moneda === 'USDT' ? `Original: $${valorOriginal.toFixed(2)} USDT` : `Original: $${valorOriginal.toFixed(2)} BCV`;

        if (item.moneda === 'USDT') {
            valorConvertido = (valorOriginal * tasaUsdt) / tasaBcv;
        }

        const li = document.createElement('li');
        li.innerHTML = `
            <div class="item-info">
                <span class="item-concepto">${item.concepto}</span>
                <span class="badge ${badgeClase}">${item.moneda}</span>
            </div>
            <div style="display:flex; align-items:center;">
                <div class="item-monto-container">
                    <span class="monto-original">${textoOriginal}</span>
                    <span class="monto-convertido">Eq: $${valorConvertido.toFixed(2)}</span>
                </div>
                <button class="btn-delete" onclick="borrarRegistro('${item.id}')">🗑️</button>
            </div>
        `;

        if (item.tipo === 'ME_DEBEN') {
            totalDeben += valorConvertido;
            listaDeben.appendChild(li);
        } else {
            totalDebo += valorConvertido;
            listaDebo.appendChild(li);
        }
    });

    const libres = totalDeben - totalDebo;
    document.getElementById('total-deben').innerText = totalDeben.toFixed(2);
    document.getElementById('total-debo').innerText = totalDebo.toFixed(2);
    document.getElementById('total-libres').innerText = libres.toFixed(2);
}

// Eliminar registro
window.borrarRegistro = async function(id) {
    if(confirm("¿Seguro que deseas eliminar este registro?")) {
        const { error } = await db.from('finanzas').delete().eq('id', id);
        if(!error) cargarDatos(); else alert("Error");
    }
};
