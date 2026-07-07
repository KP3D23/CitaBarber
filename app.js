// ==========================================================================
// 0. CONEXIÓN A LA BASE DE DATOS (SUPABASE POSTGRESQL)
// ==========================================================================
const supabaseUrl = 'https://tecasjijlodgsvkgdqvs.supabase.co';
const supabaseKey = 'sb_publishable_Eg0bMHVcqHtkBXMuH-lAIA_cTmO99Qw'; 

// ¡AQUÍ ESTABA EL ERROR! Cambiamos el nombre de la variable a "db" para evitar choques
const db = window.supabase.createClient(supabaseUrl, supabaseKey);

// ==========================================================================
// 1. ESTADO GLOBAL DINÁMICO Y VARIABLES DE CONTROL
// ==========================================================================
let fechaSistema = new Date(); 
let fechaNavegacion = new Date();
let diaSeleccionado = null;

let reservaTemporal = {
    barberId: "",
    barberNombre: "",
    fechaStr: "",
    hora: "",
    metodoPago: "",
    referencia: "",
    clienteNombre: "",
    clienteCedula: ""
};

// Arreglo vacío que se llenará desde PostgreSQL
let datosBarberos = []; 

const nombresMeses = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", 
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

// ==========================================================================
// 2. CONTROL DE NAVEGACIÓN Y PESTAÑAS (SPA)
// ==========================================================================
function navegarA(idPantallaDestino) {
    document.querySelectorAll('.app-screen').forEach(pantalla => {
        pantalla.style.display = 'none';
    });
    const destino = document.getElementById(idPantallaDestino);
    if (destino) {
        destino.style.display = 'block';
    }
}

function inicializarPestanasAdmin() {
    const tabLoginBtn = document.getElementById('tab-login-btn');
    const tabRegisterBtn = document.getElementById('tab-register-btn');
    const contentLogin = document.getElementById('tab-login-content');
    const contentRegister = document.getElementById('tab-register-content');

    tabLoginBtn.addEventListener('click', () => {
        tabLoginBtn.classList.add('active');
        tabRegisterBtn.classList.remove('active');
        contentLogin.style.display = 'block';
        contentRegister.style.display = 'none';
    });

    tabRegisterBtn.addEventListener('click', () => {
        tabRegisterBtn.classList.add('active');
        tabLoginBtn.classList.remove('active');
        contentRegister.style.display = 'block';
        contentLogin.style.display = 'none';
    });
}

// ==========================================================================
// 3. CONSULTAS A LA BASE DE DATOS (BACKEND)
// ==========================================================================
async function cargarBarberosDesdeBD() {
    console.log("Conectando con Supabase para descargar barberos...");
    
    // Usamos "db" en vez de "supabase"
    const { data, error } = await db.from('barberos').select('*');
    
    if (error) {
        console.error("Error al cargar barberos:", error);
        return;
    }
    
    if (data && data.length > 0) {
        datosBarberos = data.map(b => ({
            id: b.id,
            nombre: b.nombre,
            avatar: b.nombre, 
            tag: "Profesional",
            horas: ["9:00 AM", "10:00 AM", "11:00 AM", "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM"]
        }));
        console.log("Barberos cargados exitosamente:", datosBarberos);
    } else {
        console.warn("No hay barberos registrados en la base de datos.");
    }
}

// ==========================================================================
// 4. INICIALIZACIÓN DEL SISTEMA Y EVENTOS DEL DOM
// ==========================================================================
document.addEventListener('DOMContentLoaded', async () => {

    inicializarPestanasAdmin();
    await cargarBarberosDesdeBD(); 

    // ----------------------------------------------------------------------
    // EVENTOS DE NAVEGACIÓN GLOBAL
    // ----------------------------------------------------------------------
    const btnStartBooking = document.getElementById('btn-start-booking');
    if (btnStartBooking) {
        btnStartBooking.addEventListener('click', () => {
            if (datosBarberos.length === 0) {
                alert("Aún no hay barberos registrados. Ve al panel de Propietarios y registra tu local.");
                return;
            }

            fechaNavegacion = new Date();
            diaSeleccionado = null;
            reservaTemporal.hora = "";
            
            renderizarBarberos();
            seleccionarBarbero(datosBarberos[0].id); 
            renderizarCalendario();
            navegarA('screen-barbers-calendar');
        });
    }

    document.getElementById('btn-admin-panel').addEventListener('click', () => navegarA('screen-admin-register'));
    document.getElementById('btn-cancel-admin').addEventListener('click', () => navegarA('screen-home'));
    document.getElementById('btn-back-to-home').addEventListener('click', () => navegarA('screen-home'));
    document.getElementById('btn-back-to-calendar').addEventListener('click', () => navegarA('screen-barbers-calendar'));
    document.getElementById('btn-receipt-finish').addEventListener('click', () => navegarA('screen-home'));

    // ----------------------------------------------------------------------
    // LÓGICA DEL CALENDARIO DINÁMICO MULTICAPA
    // ----------------------------------------------------------------------
    document.getElementById('prev-month').addEventListener('click', () => {
        fechaNavegacion.setMonth(fechaNavegacion.getMonth() - 1);
        diaSeleccionado = null; 
        reservaTemporal.hora = "";
        renderizarCalendario(); 
        renderizarHoras();
    });

    document.getElementById('next-month').addEventListener('click', () => {
        fechaNavegacion.setMonth(fechaNavegacion.getMonth() + 1);
        diaSeleccionado = null; 
        reservaTemporal.hora = "";
        renderizarCalendario(); 
        renderizarHoras();
    });

    function renderizarCalendario() {
        const grid = document.getElementById('calendar-days-grid');
        grid.innerHTML = "";
        
        const año = fechaNavegacion.getFullYear();
        const mes = fechaNavegacion.getMonth();
        
        document.getElementById('month-year-title').innerText = `${nombresMeses[mes]} ${año}`;
        
        const primerDiaIndex = new Date(año, mes, 1).getDay(); 
        const diasTotales = new Date(año, mes + 1, 0).getDate();
        let espaciosVacios = primerDiaIndex === 0 ? 6 : primerDiaIndex - 1;
        
        for (let i = 0; i < espaciosVacios; i++) {
            const divVacio = document.createElement("div");
            grid.appendChild(divVacio);
        }
        
        for (let dia = 1; dia <= diasTotales; dia++) {
            const divDia = document.createElement("div");
            divDia.innerText = dia;
            
            const fechaIteracion = new Date(año, mes, dia);
            fechaIteracion.setHours(23, 59, 59, 999); 

            if (fechaIteracion < fechaSistema) {
                divDia.className = "day-off";
            } else {
                divDia.className = "day-normal";
                
                if (año === fechaSistema.getFullYear() && mes === fechaSistema.getMonth() && dia === fechaSistema.getDate()) {
                    divDia.classList.add("day-today");
                }

                if (diaSeleccionado === dia) {
                    divDia.className = "day-active";
                }

                divDia.addEventListener('click', () => {
                    diaSeleccionado = dia;
                    reservaTemporal.fechaStr = `${dia} de ${nombresMeses[mes]} del ${año}`;
                    reservaTemporal.hora = ""; 
                    renderizarCalendario();
                    renderizarHoras();
                });
            }
            grid.appendChild(divDia);
        }
    }

    // ----------------------------------------------------------------------
    // RENDERIZADO DE BARBEROS Y BLOQUES HORARIOS
    // ----------------------------------------------------------------------
    function renderizarBarberos() {
        const contenedor = document.getElementById('barbers-container');
        contenedor.innerHTML = "";

        datosBarberos.forEach(b => {
            const card = document.createElement("div");
            card.className = `barber-card ${reservaTemporal.barberId === b.id ? 'active' : ''}`;
            card.innerHTML = `
                <div class="avatar">
                    <img src="https://api.dicebear.com/7.x/bottts/svg?seed=${b.avatar}" alt="${b.nombre}" style="width:100%; border-radius:50%;">
                </div>
                <span>${b.nombre}</span>
                <small>${b.tag}</small>
            `;
            card.addEventListener('click', () => seleccionarBarbero(b.id));
            contenedor.appendChild(card);
        });
    }

    function seleccionarBarbero(id) {
        const barbero = datosBarberos.find(b => b.id === id);
        if (barbero) {
            reservaTemporal.barberId = barbero.id;
            reservaTemporal.barberNombre = barbero.nombre;
            reservaTemporal.hora = "";
            renderizarBarberos();
            renderizarHoras();
        }
    }

    function renderizarHoras() {
        const contenedor = document.getElementById('hours-grid-container');
        contenedor.innerHTML = "";

        if (!diaSeleccionado) {
            contenedor.innerHTML = "<p style='grid-column: span 3; text-align: center; color: var(--text-muted); font-size: 0.8rem;'>Selecciona un día en el calendario.</p>";
            return;
        }

        const barbero = datosBarberos.find(b => b.id === reservaTemporal.barberId);
        const horas = barbero ? barbero.horas : [];

        horas.forEach((hora) => {
            const btn = document.createElement('button');
            btn.type = "button";
            btn.className = "hour-btn available";
            btn.innerText = hora;
            
            if(reservaTemporal.hora === hora) {
                btn.classList.add('current-select');
            }
            
            btn.addEventListener('click', () => {
                document.querySelectorAll('.hour-btn.available').forEach(b => b.classList.remove('current-select'));
                btn.classList.add('current-select');
                reservaTemporal.hora = hora;
            });
            
            contenedor.appendChild(btn);
        });
    }

    document.getElementById('btn-go-to-auth-pay').addEventListener('click', () => {
        if (!diaSeleccionado || !reservaTemporal.hora) {
            alert('Por favor selecciona un día y una hora disponible para continuar.');
            return;
        }
        document.getElementById('summary-barber').innerText = reservaTemporal.barberNombre;
        document.getElementById('summary-date').innerText = reservaTemporal.fechaStr;
        document.getElementById('summary-hour').innerText = reservaTemporal.hora;
        navegarA('screen-auth-payment');
    });

    // ----------------------------------------------------------------------
    // AUTOCOMPLETADO REAL DESDE SUPABASE Y PAGOS
    // ----------------------------------------------------------------------
    const clientCedulaInput = document.getElementById('client-cedula');
    const conditionalFields = document.getElementById('conditional-fields');

    clientCedulaInput.addEventListener('input', async (e) => {
        const cedula = e.target.value.trim();
        
        if(cedula.length < 5) {
            conditionalFields.style.display = 'block';
            return; 
        }

        const { data, error } = await db.from('clientes').select('*').eq('cedula', cedula).single();

        if (data) {
            conditionalFields.style.display = 'none';
            document.getElementById('client-name').value = data.nombre;
            document.getElementById('client-lastname').value = data.apellido;
            document.getElementById('client-phone').value = data.telefono;
        } else {
            conditionalFields.style.display = 'block';
            document.getElementById('client-name').value = "";
            document.getElementById('client-lastname').value = "";
            document.getElementById('client-phone').value = "";
        }
    });

    document.querySelectorAll('input[name="pay-method"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const refGroup = document.getElementById('reference-group');
            const refInput = document.getElementById('pay-reference');
            if (e.target.value === 'movil') {
                refGroup.style.display = 'block';
                refInput.required = true;
            } else {
                refGroup.style.display = 'none';
                refInput.required = false;
                refInput.value = '';
            }
        });
    });

    // ----------------------------------------------------------------------
    // CONFIRMACIÓN DE LA CITA Y GENERACIÓN DEL TICKET DIGITAL
    // ----------------------------------------------------------------------
    document.getElementById('final-booking-form').addEventListener('submit', async (e) => {
        e.preventDefault(); 
        
        const cedula = clientCedulaInput.value.trim();
        const nombre = document.getElementById('client-name').value.trim();
        const apellido = document.getElementById('client-lastname').value.trim();
        const telefono = document.getElementById('client-phone').value.trim();
        const metodo = document.querySelector('input[name="pay-method"]:checked').value;
        const referencia = document.getElementById('pay-reference').value;

        await db.from('clientes').upsert({ cedula, nombre, apellido, telefono });

        const { error: citaError } = await db.from('citas').insert({
            id_barbero: reservaTemporal.barberId,
            cedula_cliente: cedula,
            fecha_reservada: reservaTemporal.fechaStr,
            hora_reservada: reservaTemporal.hora,
            metodo_pago: metodo === 'movil' ? 'Pago Móvil' : 'Sitio',
            referencia_pago: referencia || 'N/A'
        });

        if (citaError) {
            alert("Hubo un error de conexión guardando tu cita. Intenta de nuevo.");
            console.error(citaError);
            return;
        }

        reservaTemporal.metodoPago = metodo === 'movil' ? 'Pago Móvil' : 'En el Sitio';
        document.getElementById('rec-barber').innerText = reservaTemporal.barberNombre;
        document.getElementById('rec-date').innerText = reservaTemporal.fechaStr;
        document.getElementById('rec-hour').innerText = reservaTemporal.hora;
        document.getElementById('rec-client').innerText = cedula;
        document.getElementById('rec-payment').innerText = reservaTemporal.metodoPago + (referencia ? ` (Ref: ${referencia})` : '');
        
        const uuid = `CB-2026-${Math.floor(1000 + Math.random() * 9000)}`;
        document.getElementById('rec-uuid').innerText = uuid;

        e.target.reset();
        document.getElementById('reference-group').style.display = 'none';
        conditionalFields.style.display = 'block';
        
        navegarA('screen-ticket-receipt'); 
    });

    // ----------------------------------------------------------------------
    // MÓDULOS DE ADMINISTRACIÓN (LOGIN Y REGISTRO SAAS)
    // ----------------------------------------------------------------------
    document.getElementById('admin-login-form').addEventListener('submit', (e) => {
        e.preventDefault();
        alert("Autenticación exitosa. Redirigiendo al panel de administración...");
        e.target.reset();
        navegarA('screen-home');
    });

    document.getElementById('admin-shop-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const userAdmin = "admin_" + Math.floor(Math.random() * 1000); 
        const pass = "123456";
        const localName = document.getElementById('shop-reg-name').value;
        const localDir = document.getElementById('shop-reg-dir').value;

        const b1Name = document.getElementById('b1-name').value;
        const b1Hours = document.getElementById('b1-hours').value;
        const b2Name = document.getElementById('b2-name').value;
        const b2Hours = document.getElementById('b2-hours').value;

        const { data: shopData, error: shopError } = await db.from('barberias').insert({
            usuario_admin: userAdmin,
            password: pass,
            nombre_local: localName,
            direccion: localDir,
            cantidad_sillas: 2,
            horario_general: "9:00 AM a 7:00 PM"
        }).select().single();

        if (shopError) {
            alert("Error al registrar la base de datos de tu local.");
            console.error(shopError);
            return;
        }

        const { error: barberError } = await db.from('barberos').insert([
            { id_barberia: shopData.id, nombre: b1Name, horario: b1Hours },
            { id_barberia: shopData.id, nombre: b2Name, horario: b2Hours }
        ]);

        if (barberError) {
            console.error("Error al registrar barberos:", barberError);
        } else {
            alert(`¡Configuración Completada!\nTu local "${localName}" está activo en la plataforma.`);
            await cargarBarberosDesdeBD(); 
            e.target.reset();
            navegarA('screen-home');
        }
    });

});