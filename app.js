// ==========================================================================
// 0. CONFIGURACIÓN Y CONEXIÓN A SUPABASE
// ==========================================================================
const supabaseUrl = 'https://tecasjijlodgsvkgdqvs.supabase.co';
const supabaseKey = 'sb_publishable_Eg0bMHVcqHtkBXMuH-lAIA_cTmO99Qw'; 
const db = window.supabase.createClient(supabaseUrl, supabaseKey);

// ==========================================================================
// 1. VARIABLES GLOBALES DE ESTADO
// ==========================================================================
let currentShopId = null; 
let fechaSistema = new Date();
let fechaNavegacion = new Date();
let diaSeleccionado = null;
let reservaTemporal = { barberId: "", barberNombre: "", fechaStr: "", hora: "" };
let datosBarberos = []; 

const nombresMeses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

// ==========================================================================
// 2. FUNCIONES AUXILIARES
// ==========================================================================
function navegarA(idPantallaDestino) {
    document.querySelectorAll('.app-screen').forEach(p => p.style.display = 'none');
    const destino = document.getElementById(idPantallaDestino);
    if (destino) destino.style.display = 'block';
}

function generarBloquesHoras(horaInicio, horaFin) {
    let horas = [];
    let [hIn, mIn] = horaInicio.split(':').map(Number);
    let [hFi, mFi] = horaFin.split(':').map(Number);
    let actual = new Date(); actual.setHours(hIn, mIn, 0, 0);
    let final = new Date(); final.setHours(hFi, mFi, 0, 0);

    while(actual < final) {
        let h = actual.getHours(); let m = actual.getMinutes();
        let ampm = h >= 12 ? 'PM' : 'AM';
        let h12 = h % 12 || 12;
        let mStr = m === 0 ? '00' : m;
        horas.push(`${h12}:${mStr} ${ampm}`);
        actual.setHours(actual.getHours() + 1);
    }
    return horas.join(','); 
}

document.getElementById('b1-start')?.addEventListener('change', (e) => document.getElementById('b1-end').min = e.target.value);
document.getElementById('b2-start')?.addEventListener('change', (e) => document.getElementById('b2-end').min = e.target.value);

// ==========================================================================
// 3. CARGA DINÁMICA DE DATOS (BARBERÍA Y BARBEROS)
// ==========================================================================
async function inicializarApp() {
    // Traer todas las barberías registradas
    const { data: shops, error } = await db.from('barberias').select('*').order('created_at', { ascending: false });
    const container = document.getElementById('shop-list-container');
    container.innerHTML = "";

    if (shops && shops.length > 0) {
        shops.forEach(shop => {
            const card = document.createElement('div');
            card.className = 'shop-card';
            card.innerHTML = `
                <h3>${shop.nombre_local}</h3>
                <p>📍 ${shop.direccion}</p>
                <p>🕒 ${shop.horario_general || '9:00 AM - 7:00 PM'}</p>
                <button class="btn-primary" style="margin-top:15px; width:100%;">Agendar Aquí</button>
            `;
            // Al hacer clic, carga los barberos de ESA barbería
            card.addEventListener('click', async () => {
                currentShopId = shop.id;
                await cargarBarberosDesdeBD();
                if (datosBarberos.length === 0) return alert("Este local aún no tiene barberos configurados.");
                
                fechaNavegacion = new Date(); diaSeleccionado = null; reservaTemporal.hora = "";
                reservaTemporal.barberId = datosBarberos[0].id; 
                reservaTemporal.barberNombre = datosBarberos[0].nombre;
                
                renderizarBarberos(); 
                renderizarCalendario(); 
                navegarA('screen-barbers-calendar');
            });
            container.appendChild(card);
        });
    } else {
        container.innerHTML = "<p>No hay barberías registradas en la plataforma.</p>";
    }
}

async function cargarBarberosDesdeBD() {
    if (!currentShopId) return;
    const { data, error } = await db.from('barberos').select('*').eq('id_barberia', currentShopId);
    
    if (!error && data) {
        datosBarberos = data.map(b => {
            let horasParseadas = (b.horario && b.horario.includes(',')) ? b.horario.split(',') : ["9:00 AM", "10:00 AM", "11:00 AM", "1:00 PM", "2:00 PM"];
            return { id: b.id, nombre: b.nombre, horas: horasParseadas };
        });
    }
}

function renderizarBarberos() {
    const contenedor = document.getElementById('barbers-container');
    contenedor.innerHTML = "";
    datosBarberos.forEach(b => {
        const card = document.createElement("div");
        card.className = `barber-card ${reservaTemporal.barberId === b.id ? 'active' : ''}`;
        card.innerHTML = `<div class="avatar"><img src="https://api.dicebear.com/7.x/bottts/svg?seed=${b.nombre}" alt="Avatar" style="width:100%; border-radius:50%;"></div><span>${b.nombre}</span>`;
        card.addEventListener('click', async () => {
            reservaTemporal.barberId = b.id; reservaTemporal.barberNombre = b.nombre; reservaTemporal.hora = "";
            renderizarBarberos(); await renderizarHoras(); 
        });
        contenedor.appendChild(card);
    });
}

function renderizarCalendario() {
    const grid = document.getElementById('calendar-days-grid');
    grid.innerHTML = "";
    const año = fechaNavegacion.getFullYear(); const mes = fechaNavegacion.getMonth();
    document.getElementById('month-year-title').innerText = `${nombresMeses[mes]} ${año}`;
    
    const primerDiaIndex = new Date(año, mes, 1).getDay(); const diasTotales = new Date(año, mes + 1, 0).getDate();
    let espaciosVacios = primerDiaIndex === 0 ? 6 : primerDiaIndex - 1;
    
    for (let i = 0; i < espaciosVacios; i++) grid.appendChild(document.createElement("div"));
    
    for (let dia = 1; dia <= diasTotales; dia++) {
        const divDia = document.createElement("div"); divDia.innerText = dia;
        const fechaIteracion = new Date(año, mes, dia); fechaIteracion.setHours(23, 59, 59, 999); 

        if (fechaIteracion < fechaSistema) { divDia.className = "day-off"; } 
        else {
            divDia.className = "day-normal";
            if (año === fechaSistema.getFullYear() && mes === fechaSistema.getMonth() && dia === fechaSistema.getDate()) divDia.classList.add("day-today");
            if (diaSeleccionado === dia) divDia.className = "day-active";

            divDia.addEventListener('click', async () => {
                diaSeleccionado = dia; reservaTemporal.fechaStr = `${dia} de ${nombresMeses[mes]} del ${año}`; reservaTemporal.hora = ""; 
                renderizarCalendario(); await renderizarHoras(); 
            });
        }
        grid.appendChild(divDia);
    }
}

async function renderizarHoras() {
    const contenedor = document.getElementById('hours-grid-container');
    if (!diaSeleccionado) { contenedor.innerHTML = "<p class='text-muted'>Selecciona un día en el calendario.</p>"; return; }
    contenedor.innerHTML = "<p class='text-muted'>Consultando disponibilidad...</p>";

    const barbero = datosBarberos.find(b => b.id === reservaTemporal.barberId);
    if (!barbero) return;

    const { data: citasRealizadas } = await db.from('citas').select('hora_reservada').eq('id_barbero', barbero.id).eq('fecha_reservada', reservaTemporal.fechaStr);
    const horasOcupadas = citasRealizadas ? citasRealizadas.map(c => c.hora_reservada) : [];
    const ahora = new Date();
    const esHoy = (ahora.getFullYear() === fechaNavegacion.getFullYear() && ahora.getMonth() === fechaNavegacion.getMonth() && ahora.getDate() === diaSeleccionado);

    contenedor.innerHTML = "";

    barbero.horas.forEach((horaCadena) => {
        const btn = document.createElement('button'); btn.type = "button"; btn.className = "hour-btn"; btn.innerText = horaCadena;
        
        let horaYaPaso = false;
        if (esHoy) {
            const regex = /(\d+):(\d+)\s*(AM|PM)/i; const match = horaCadena.match(regex);
            if (match) {
                let h = parseInt(match[1]); let m = parseInt(match[2]); let ampm = match[3].toUpperCase();
                if (ampm === 'PM' && h < 12) h += 12; if (ampm === 'AM' && h === 12) h = 0;
                const horaBloque = new Date(); horaBloque.setHours(h, m, 0, 0);
                if (ahora > horaBloque) horaYaPaso = true;
            }
        }

        if (horasOcupadas.includes(horaCadena) || horaYaPaso) {
            btn.classList.add('disabled'); btn.disabled = true;
        } else {
            btn.classList.add('available');
            if(reservaTemporal.hora === horaCadena) btn.classList.add('current-select');
            btn.addEventListener('click', () => {
                document.querySelectorAll('.hour-btn.available').forEach(b => b.classList.remove('current-select'));
                btn.classList.add('current-select'); reservaTemporal.hora = horaCadena;
            });
        }
        contenedor.appendChild(btn);
    });
}

// ==========================================================================
// 4. FLUJO DEL PROPIETARIO: DASHBOARD DE CITAS Y CANCELACIÓN
// ==========================================================================
window.cancelarCita = async function(idCita) {
    if(confirm("¿Estás seguro de cancelar esta cita? El turno volverá a estar disponible para el público.")) {
        await db.from('citas').delete().eq('id', idCita);
        alert("Cita cancelada con éxito.");
        // Recargar el panel automáticamente
        const { data: userShop } = await db.from('barberias').select('*').eq('id', currentShopId).single();
        await cargarDashboard(userShop);
    }
};

async function cargarDashboard(shopData) {
    document.getElementById('dashboard-shop-name').innerText = "Panel: " + shopData.nombre_local;
    const { data: misBarberos } = await db.from('barberos').select('id, nombre').eq('id_barberia', shopData.id);
    if (!misBarberos || misBarberos.length === 0) return;

    const idsBarberos = misBarberos.map(b => b.id);
    const mapBarberos = {}; misBarberos.forEach(b => mapBarberos[b.id] = b.nombre);

    const { data: misCitas } = await db.from('citas').select('*').in('id_barbero', idsBarberos);
    const citas = misCitas || [];

    const { data: todosClientes } = await db.from('clientes').select('cedula, nombre, apellido, telefono');
    const mapClientes = {};
    if (todosClientes) todosClientes.forEach(c => mapClientes[c.cedula] = { nombre: `${c.nombre} ${c.apellido}`, tlf: c.telefono });

    const hoyDate = new Date();
    const strHoy = `${hoyDate.getDate()} de ${nombresMeses[hoyDate.getMonth()]} del ${hoyDate.getFullYear()}`;
    const strPasados = [];
    for(let i=1; i<=3; i++) { let d = new Date(); d.setDate(d.getDate() - i); strPasados.push(`${d.getDate()} de ${nombresMeses[d.getMonth()]} del ${d.getFullYear()}`); }

    const citasHoy = citas.filter(c => c.fecha_reservada === strHoy);
    const citasPasadas = citas.filter(c => strPasados.includes(c.fecha_reservada));

    const listHoy = document.getElementById('dashboard-today-list');
    listHoy.innerHTML = "";
    if (citasHoy.length === 0) listHoy.innerHTML = "<div class='empty-state'>No hay citas programadas para hoy.</div>";
    else citasHoy.forEach(c => {
        const clienteInfo = mapClientes[c.cedula_cliente] || { nombre: c.cedula_cliente, tlf: "N/A" };
        const nombreBarbero = mapBarberos[c.id_barbero] || "Barbero";
        listHoy.innerHTML += `
            <div class="appointment-card">
                <h4>${c.hora_reservada} <span class="badge">${nombreBarbero}</span></h4>
                <p><strong>Cliente:</strong> ${clienteInfo.nombre} (C.I: ${c.cedula_cliente})</p>
                <p><strong>Teléfono:</strong> ${clienteInfo.tlf}</p>
                <p><strong>Pago:</strong> ${c.metodo_pago} ${c.referencia_pago !== 'N/A' ? '(Ref: ' + c.referencia_pago + ')' : ''}</p>
                <button onclick="cancelarCita('${c.id}')" class="btn-danger" style="margin-top:10px;">❌ Cancelar Turno</button>
            </div>
        `;
    });

    const listPasado = document.getElementById('dashboard-past-list');
    listPasado.innerHTML = "";
    if (citasPasadas.length === 0) listPasado.innerHTML = "<div class='empty-state'>No hay citas registradas en los últimos 3 días.</div>";
    else citasPasadas.forEach(c => {
        const clienteInfo = mapClientes[c.cedula_cliente] || { nombre: c.cedula_cliente };
        const nombreBarbero = mapBarberos[c.id_barbero] || "Barbero";
        listPasado.innerHTML += `<div class="appointment-card"><h4>${c.fecha_reservada} | ${c.hora_reservada} <span class="badge" style="background:#eee;">${nombreBarbero}</span></h4><p><strong>Cliente:</strong> ${clienteInfo.nombre}</p></div>`;
    });
}

// ==========================================================================
// 5. INICIALIZACIÓN Y EVENTOS
// ==========================================================================
document.addEventListener('DOMContentLoaded', async () => {
    
    await inicializarApp(); 

    document.getElementById('btn-admin-panel').addEventListener('click', () => navegarA('screen-admin-register'));
    document.getElementById('btn-cancel-admin').addEventListener('click', () => navegarA('screen-home'));
    document.getElementById('btn-back-to-home').addEventListener('click', () => navegarA('screen-home'));
    document.getElementById('btn-back-to-calendar').addEventListener('click', () => navegarA('screen-home'));
    document.getElementById('btn-receipt-finish').addEventListener('click', () => navegarA('screen-home'));
    document.getElementById('btn-logout')?.addEventListener('click', () => { currentShopId = null; navegarA('screen-home'); });

    document.getElementById('prev-month').addEventListener('click', async () => { fechaNavegacion.setMonth(fechaNavegacion.getMonth() - 1); diaSeleccionado = null; reservaTemporal.hora = ""; renderizarCalendario(); await renderizarHoras(); });
    document.getElementById('next-month').addEventListener('click', async () => { fechaNavegacion.setMonth(fechaNavegacion.getMonth() + 1); diaSeleccionado = null; reservaTemporal.hora = ""; renderizarCalendario(); await renderizarHoras(); });

    document.getElementById('tab-login-btn').addEventListener('click', (e) => { e.target.classList.add('active'); document.getElementById('tab-register-btn').classList.remove('active'); document.getElementById('tab-login-content').style.display = 'block'; document.getElementById('tab-register-content').style.display = 'none'; });
    document.getElementById('tab-register-btn').addEventListener('click', (e) => { e.target.classList.add('active'); document.getElementById('tab-login-btn').classList.remove('active'); document.getElementById('tab-register-content').style.display = 'block'; document.getElementById('tab-login-content').style.display = 'none'; });

    document.getElementById('btn-go-to-auth-pay').addEventListener('click', () => {
        if (!diaSeleccionado || !reservaTemporal.hora) return alert('Selecciona un día y una hora disponible para continuar.');
        document.getElementById('summary-barber').innerText = reservaTemporal.barberNombre; document.getElementById('summary-date').innerText = reservaTemporal.fechaStr; document.getElementById('summary-hour').innerText = reservaTemporal.hora;
        navegarA('screen-auth-payment');
    });

    document.getElementById('client-cedula').addEventListener('input', async (e) => {
        const cedula = e.target.value.trim(); const cond = document.getElementById('conditional-fields');
        if(cedula.length < 5) { cond.style.display = 'block'; return; }
        const { data } = await db.from('clientes').select('*').eq('cedula', cedula).single();
        if (data) { cond.style.display = 'none'; document.getElementById('client-name').value = data.nombre; document.getElementById('client-lastname').value = data.apellido; document.getElementById('client-phone').value = data.telefono; } 
        else { cond.style.display = 'block'; document.getElementById('client-name').value = ""; document.getElementById('client-lastname').value = ""; document.getElementById('client-phone').value = ""; }
    });

    document.querySelectorAll('input[name="pay-method"]').forEach(r => r.addEventListener('change', (e) => {
        const refGroup = document.getElementById('reference-group'); const refInput = document.getElementById('pay-reference');
        if (e.target.value === 'movil') { refGroup.style.display = 'block'; refInput.required = true; } else { refGroup.style.display = 'none'; refInput.required = false; refInput.value = ''; }
    }));

    document.getElementById('final-booking-form').addEventListener('submit', async (e) => {
        e.preventDefault(); 
        const cedula = document.getElementById('client-cedula').value.trim();
        const metodo = document.querySelector('input[name="pay-method"]:checked').value;
        const ref = document.getElementById('pay-reference').value;

        await db.from('clientes').upsert({ cedula, nombre: document.getElementById('client-name').value.trim(), apellido: document.getElementById('client-lastname').value.trim(), telefono: document.getElementById('client-phone').value.trim() });
        const { error: citaError } = await db.from('citas').insert({ id_barbero: reservaTemporal.barberId, cedula_cliente: cedula, fecha_reservada: reservaTemporal.fechaStr, hora_reservada: reservaTemporal.hora, metodo_pago: metodo === 'movil' ? 'Pago Móvil' : 'Sitio', referencia_pago: ref || 'N/A' });
        
        if (citaError) return alert("Error de conexión al guardar la cita.");
        
        document.getElementById('rec-barber').innerText = reservaTemporal.barberNombre; document.getElementById('rec-date').innerText = reservaTemporal.fechaStr; document.getElementById('rec-hour').innerText = reservaTemporal.hora; document.getElementById('rec-client').innerText = cedula;
        document.getElementById('rec-payment').innerText = (metodo === 'movil' ? 'Pago Móvil' : 'En el Sitio') + (ref ? ` (Ref: ${ref})` : '');
        document.getElementById('rec-uuid').innerText = `CB-${Math.floor(1000 + Math.random() * 9000)}`;
        
        e.target.reset(); document.getElementById('reference-group').style.display = 'none'; document.getElementById('conditional-fields').style.display = 'block';
        navegarA('screen-ticket-receipt'); 
    });

    document.getElementById('admin-login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const { data, error } = await db.from('barberias').select('*').eq('usuario_admin', document.getElementById('login-user').value.trim()).eq('password', document.getElementById('login-pass').value.trim()).single();
        if (error || !data) alert("Usuario o contraseña incorrectos.");
        else { 
            e.target.reset(); 
            currentShopId = data.id; // Clave para que la recarga de cancelaciones funcione
            await cargarDashboard(data); 
            navegarA('screen-admin-dashboard'); 
        }
    });

    document.getElementById('admin-shop-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const horarioB1 = generarBloquesHoras(document.getElementById('b1-start').value, document.getElementById('b1-end').value);
        const horarioB2 = generarBloquesHoras(document.getElementById('b2-start').value, document.getElementById('b2-end').value);

        const { data: shopData, error: shopError } = await db.from('barberias').insert({
            usuario_admin: document.getElementById('admin-user').value.trim(), password: document.getElementById('admin-pass').value.trim(), nombre_local: document.getElementById('shop-reg-name').value, direccion: document.getElementById('shop-reg-dir').value, cantidad_sillas: 2, horario_general: "9:00 AM - 7:00 PM"
        }).select().single();

        if (shopError) return alert("Error al registrar: " + shopError.message);

        await db.from('barberos').insert([ { id_barberia: shopData.id, nombre: document.getElementById('b1-name').value, horario: horarioB1 }, { id_barberia: shopData.id, nombre: document.getElementById('b2-name').value, horario: horarioB2 } ]);

        alert("Local registrado. Ya puedes iniciar sesión y ver tu panel."); e.target.reset(); 
        await inicializarApp(); 
    });
});
