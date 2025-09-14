// ===== Variables globales =====
let productos = JSON.parse(localStorage.getItem('productos')) || [];
let nombreEstablecimiento = localStorage.getItem('nombreEstablecimiento') || '';
let tasaBCVGuardada = parseFloat(localStorage.getItem('tasaBCV')) || 0;
let ventasDiarias = JSON.parse(localStorage.getItem('ventasDiarias')) || [];
let carrito = JSON.parse(localStorage.getItem('carrito')) || [];
let metodoPagoSeleccionado = null;
let detallesPago = {}; // info auxiliar al confirmar pago

// Inactividad (10 minutos)
const TIEMPO_INACTIVIDAD = 10 * 60 * 1000; // 10 minutos en ms
let inactivityTimer = null;

// ===== Inicialización =====
document.addEventListener('DOMContentLoaded', () => {
    console.log('Calculadora Mágica iniciada');
    cargarDatosIniciales();
    actualizarLista();
    actualizarCarrito();
    configurarEventos();
    resetInactivityTimer();
});

// ===== Utilidades: Toasts =====
function showToast(message, type = 'success', duration = 4000) {
    const container = document.getElementById('toastContainer');
    const t = document.createElement('div');
    t.className = `toast ${type === 'error' ? 'error' : type === 'warning' ? 'warning' : 'success'}`;
    t.textContent = message;
    container.appendChild(t);
    setTimeout(() => {
        t.style.opacity = '0';
        t.style.transform = 'translateY(8px)';
        setTimeout(() => t.remove(), 300);
    }, duration);
}

// ===== Inactividad: reset en eventos de usuario =====
function configurarEventos() {
    // búsqueda enter
    document.getElementById('buscar').addEventListener('keypress', e => { if (e.key === 'Enter') buscarProducto(); });
    document.getElementById('codigoBarrasInput').addEventListener('keypress', e => { if (e.key === 'Enter') agregarPorCodigoBarras(); });

    // reset inactivity on many user actions
    ['mousemove','mousedown','keydown','touchstart','scroll','click'].forEach(evt => {
        window.addEventListener(evt, resetInactivityTimer, { passive: true });
    });
}

function resetInactivityTimer() {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
        // redirigir por seguridad
        window.location.href = 'http://portal.calculadoramagica.lat/';
    }, TIEMPO_INACTIVIDAD);
}

// ===== Buscador rápido en carrito (sugerencias) =====
document.getElementById('codigoBarrasInput').addEventListener('input', function() {
    const termino = this.value.trim().toLowerCase();
    const sugerenciasDiv = document.getElementById('sugerencias');
    sugerenciasDiv.innerHTML = '';
    if (termino.length < 2) return;
    const coincidencias = productos.filter(p =>
        p.nombre.toLowerCase().includes(termino) ||
        (p.codigoBarras && p.codigoBarras.toLowerCase().includes(termino))
    );
    coincidencias.slice(0,8).forEach(prod => {
        const opcion = document.createElement('div');
        opcion.textContent = `${prod.nombre} (${prod.descripcion})`;
        opcion.onclick = () => {
            document.getElementById('codigoBarrasInput').value = prod.codigoBarras || prod.nombre;
            agregarPorCodigoBarras();
            sugerenciasDiv.innerHTML = '';
            document.getElementById('codigoBarrasInput').focus();
        };
        sugerenciasDiv.appendChild(opcion);
    });
});

// ===== Básicas: cargar valores iniciales, calcular precio, guardar nombre/tasa =====
function cargarDatosIniciales() {
    document.getElementById('nombreEstablecimiento').value = nombreEstablecimiento;
    document.getElementById('tasaBCV').value = tasaBCVGuardada || '';
}

function calcularPrecioVenta() {
    const tasaBCV = parseFloat(document.getElementById('tasaBCV').value) || tasaBCVGuardada;
    const costo = parseFloat(document.getElementById('costo').value);
    const ganancia = parseFloat(document.getElementById('ganancia').value);
    const unidadesPorCaja = parseFloat(document.getElementById('unidadesPorCaja').value);

    if (!tasaBCV || tasaBCV <= 0) { showToast("Ingrese una tasa BCV válida", 'error'); return; }
    if (!costo || !ganancia || !unidadesPorCaja) { showToast("Complete todos los campos requeridos", 'error'); return; }

    const gDec = ganancia / 100;
    const precioDolar = costo / (1 - gDec);
    const precioBolivar = precioDolar * tasaBCV;
    const precioUnitarioDolar = precioDolar / unidadesPorCaja;
    const precioUnitarioBolivar = precioBolivar / unidadesPorCaja;

    document.getElementById('precioUnitario').innerHTML =
        `<strong>Precio unitario:</strong> $${precioUnitarioDolar.toFixed(2)} / Bs${precioUnitarioBolivar.toFixed(2)}`;
}

function guardarNombreEstablecimiento() {
    nombreEstablecimiento = document.getElementById('nombreEstablecimiento').value.trim();
    if (!nombreEstablecimiento) { showToast("Ingrese un nombre válido", 'error'); return; }
    localStorage.setItem('nombreEstablecimiento', nombreEstablecimiento);
    showToast(`Nombre guardado: "${nombreEstablecimiento}"`, 'success');
}

function actualizarTasaBCV() {
    const nueva = parseFloat(document.getElementById('tasaBCV').value);
    if (!nueva || nueva <= 0) { showToast("Ingrese una tasa BCV válida", 'error'); return; }
    tasaBCVGuardada = nueva;
    localStorage.setItem('tasaBCV', tasaBCVGuardada);
    productos.forEach(p => {
        p.precioUnitarioBolivar = p.precioUnitarioDolar * nueva;
        p.precioMayorBolivar = p.precioMayorDolar * nueva;
    });
    localStorage.setItem('productos', JSON.stringify(productos));
    actualizarLista();
    showToast(`Tasa BCV actualizada a: ${nueva}`, 'success');
}

// ===== Productos: guardar, editar, eliminar, listar =====
function guardarProducto() {
    const nombre = document.getElementById('producto').value.trim();
    const codigoBarras = document.getElementById('codigoBarras').value.trim();
    const descripcion = document.getElementById('descripcion').value;
    const costo = parseFloat(document.getElementById('costo').value);
    const ganancia = parseFloat(document.getElementById('ganancia').value);
    const unidadesPorCaja = parseFloat(document.getElementById('unidadesPorCaja').value);
    const unidadesExistentes = parseFloat(document.getElementById('unidadesExistentes').value) || 0;
    const tasaBCV = parseFloat(document.getElementById('tasaBCV').value) || tasaBCVGuardada;

    if (!nombre || !descripcion) { showToast("Complete el nombre y descripción del producto", 'error'); return; }
    if (!tasaBCV || tasaBCV <= 0) { showToast("Ingrese una tasa BCV válida", 'error'); return; }
    if (!costo || !ganancia || !unidadesPorCaja) { showToast("Complete todos los campos requeridos", 'error'); return; }

    const existe = productos.findIndex(p => p.nombre.toLowerCase() === nombre.toLowerCase());
    if (existe !== -1) {
        if (!confirm(`"${nombre}" ya existe. ¿Deseas actualizarlo?`)) return;
        productos.splice(existe,1);
    }

    const gDec = ganancia / 100;
    const precioDolar = costo / (1 - gDec);
    const precioBolivar = precioDolar * tasaBCV;

    const producto = {
        nombre,
        codigoBarras,
        descripcion,
        costo, // costo en $ por caja/unidad base
        ganancia: gDec,
        unidadesPorCaja,
        unidadesExistentes,
        precioMayorDolar: precioDolar,
        precioMayorBolivar: precioBolivar,
        precioUnitarioDolar: precioDolar / unidadesPorCaja,
        precioUnitarioBolivar: precioBolivar / unidadesPorCaja,
        fechaActualizacion: new Date().toISOString()
    };

    productos.push(producto);
    localStorage.setItem('productos', JSON.stringify(productos));
    actualizarLista();

    // limpiar campos
    document.getElementById('producto').value = '';
    document.getElementById('codigoBarras').value = '';
    document.getElementById('costo').value = '';
    document.getElementById('ganancia').value = '';
    document.getElementById('unidadesPorCaja').value = '';
    document.getElementById('unidadesExistentes').value = '';
    document.getElementById('descripcion').selectedIndex = 0;

    showToast('Producto guardado exitosamente', 'success');
}

function actualizarLista() {
    const tbody = document.querySelector('#listaProductos tbody');
    tbody.innerHTML = '';
    productos.forEach((p, idx) => {
        const inventarioBajo = p.unidadesExistentes <= 5;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${p.nombre}</td>
            <td>${p.descripcion}</td>
            <td>${p.codigoBarras || 'N/A'}</td>
            <td class="${inventarioBajo ? 'inventario-bajo' : ''}">${p.unidadesExistentes}</td>
            <td>
                <div class="ajuste-inventario">
                    <button onclick="ajustarInventario(${idx}, 'sumar')">+</button>
                    <button onclick="ajustarInventario(${idx}, 'restar')">-</button>
                </div>
            </td>
            <td>$${p.precioUnitarioDolar.toFixed(2)}</td>
            <td>Bs${p.precioUnitarioBolivar.toFixed(2)}</td>
            <td>${(p.ganancia*100).toFixed(0)}%</td>
            <td>
                <button class="editar" onclick="editarProducto(${idx})">Editar</button>
                <button class="eliminar" onclick="eliminarProducto(${idx})">Eliminar</button>
                <button class="imprimir" onclick="imprimirTicketProducto(${idx})">Imprimir</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function buscarProducto() {
    const termino = document.getElementById('buscar').value.trim().toLowerCase();
    if (!termino) { actualizarLista(); return; }
    const resultados = productos.filter(p =>
        p.nombre.toLowerCase().includes(termino) ||
        p.descripcion.toLowerCase().includes(termino) ||
        (p.codigoBarras && p.codigoBarras.toLowerCase().includes(termino))
    );
    const tbody = document.querySelector('#listaProductos tbody');
    tbody.innerHTML = '';
    resultados.forEach((p, idx) => {
        const inventarioBajo = p.unidadesExistentes <= 5;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${p.nombre}</td>
            <td>${p.descripcion}</td>
            <td>${p.codigoBarras || 'N/A'}</td>
            <td class="${inventarioBajo ? 'inventario-bajo' : ''}">${p.unidadesExistentes}</td>
            <td>
                <div class="ajuste-inventario">
                    <button onclick="ajustarInventario(${idx}, 'sumar')">+</button>
                    <button onclick="ajustarInventario(${idx}, 'restar')">-</button>
                </div>
            </td>
            <td>$${p.precioUnitarioDolar.toFixed(2)}</td>
            <td>Bs${p.precioUnitarioBolivar.toFixed(2)}</td>
            <td>${(p.ganancia*100).toFixed(0)}%</td>
            <td>
                <button class="editar" onclick="editarProducto(${idx})">Editar</button>
                <button class="eliminar" onclick="eliminarProducto(${idx})">Eliminar</button>
                <button class="imprimir" onclick="imprimirTicketProducto(${idx})">Imprimir</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function ajustarInventario(index, operacion) {
    const producto = productos[index];
    const cantidad = parseInt(prompt(`Ingrese la cantidad a ${operacion==='sumar'?'sumar':'restar'}:`,"1")) || 0;
    if (cantidad <= 0) { showToast('Ingrese una cantidad válida','error'); return; }
    if (operacion==='restar' && producto.unidadesExistentes < cantidad) { showToast('No hay suficientes unidades en inventario','error'); return; }
    producto.unidadesExistentes = (operacion==='sumar') ? producto.unidadesExistentes + cantidad : producto.unidadesExistentes - cantidad;
    localStorage.setItem('productos', JSON.stringify(productos));
    actualizarLista();
    showToast(`Inventario actualizado: ${producto.unidadesExistentes}`, 'success');
}

function editarProducto(index) {
    const p = productos[index];
    document.getElementById('producto').value = p.nombre;
    document.getElementById('codigoBarras').value = p.codigoBarras || '';
    document.getElementById('descripcion').value = p.descripcion;
    document.getElementById('costo').value = p.costo;
    document.getElementById('ganancia').value = p.ganancia * 100;
    document.getElementById('unidadesPorCaja').value = p.unidadesPorCaja;
    document.getElementById('unidadesExistentes').value = p.unidadesExistentes;
    document.getElementById('precioUnitario').innerHTML =
        `<strong>Precio unitario:</strong> $${p.precioUnitarioDolar.toFixed(2)} / Bs${p.precioUnitarioBolivar.toFixed(2)}`;
    // eliminar temporalmente para que al guardar reemplace
    productos.splice(index,1);
    localStorage.setItem('productos', JSON.stringify(productos));
    actualizarLista();
    showToast(`Editando producto: ${p.nombre}`, 'warning');
}

function eliminarProducto(index) {
    const p = productos[index];
    if (confirm(`¿Eliminar "${p.nombre}"?`)) {
        productos.splice(index,1);
        localStorage.setItem('productos', JSON.stringify(productos));
        actualizarLista();
        showToast(`Producto eliminado: ${p.nombre}`, 'success');
    }
}

// ===== Carrito =====
// Se permite UNIDAD y GRAMO
function agregarPorCodigoBarras() {
    const codigo = document.getElementById('codigoBarrasInput').value.trim();
    if (!codigo) { showToast('Ingrese o escanee un código', 'warning'); return; }

    // buscar por código exacto
    let prod = productos.find(p => p.codigoBarras && p.codigoBarras.toLowerCase() === codigo.toLowerCase());
    if (!prod) {
        prod = productos.find(p => p.nombre.toLowerCase().includes(codigo.toLowerCase()));
        if (!prod) { showToast('Producto no encontrado', 'error'); return; }
    }

    // buscar si ya está en carrito (misma unidad 'unidad')
    const idx = carrito.findIndex(item => item.nombre === prod.nombre && item.unidad === 'unidad');
    if (idx !== -1) {
        carrito[idx].cantidad += 1;
        carrito[idx].subtotal = carrito[idx].cantidad * carrito[idx].precioUnitarioBolivar;
        carrito[idx].subtotalDolar = carrito[idx].cantidad * carrito[idx].precioUnitarioDolar;
    } else {
        carrito.push({
            nombre: prod.nombre,
            descripcion: prod.descripcion,
            precioUnitarioBolivar: prod.precioUnitarioBolivar,
            precioUnitarioDolar: prod.precioUnitarioDolar,
            cantidad: 1,
            unidad: 'unidad',
            subtotal: prod.precioUnitarioBolivar,
            subtotalDolar: prod.precioUnitarioDolar,
            indexProducto: productos.findIndex(p => p.nombre === prod.nombre)
        });
    }

    document.getElementById('codigoBarrasInput').value = '';
    document.getElementById('scannerStatus').textContent = 'Producto agregado';
    localStorage.setItem('carrito', JSON.stringify(carrito));
    actualizarCarrito();
}

function actualizarCarrito() {
    const tbody = document.getElementById('carritoBody');
    const totalCarritoBs = document.getElementById('totalCarritoBs');
    const totalCarritoDolares = document.getElementById('totalCarritoDolares');
    tbody.innerHTML = '';
    if (carrito.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center">El carrito está vacío</td></tr>';
        totalCarritoBs.textContent = 'Total: Bs 0,00';
        totalCarritoDolares.textContent = 'Total: $ 0,00';
        return;
    }
    let totalBs = 0, totalUsd = 0;
    carrito.forEach((item, i) => {
        totalBs += item.subtotal;
        totalUsd += item.subtotalDolar;
        // Mostrar cantidad: si es gramo, mostrar '500 g' y botones + y - permiten ingresar gramos
        let cantidadHtml = '';
        if (item.unidad === 'gramo') {
            cantidadHtml = `
                <button onclick="pedirGramos(${i}, -1)">-</button>
                ${item.cantidad} g
                <button onclick="pedirGramos(${i}, 1)">+</button>
            `;
        } else {
            cantidadHtml = `
                <button onclick="actualizarCantidadCarrito(${i}, -1)">-</button>
                ${item.cantidad}
                <button onclick="actualizarCantidadCarrito(${i}, 1)">+</button>
            `;
        }

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.nombre} (${item.descripcion})</td>
            <td>Bs ${item.precioUnitarioBolivar.toFixed(2)}</td>
            <td>${cantidadHtml}</td>
            <td>
                <select onchange="cambiarUnidadCarrito(${i}, this.value)" class="unidad-selector">
                    <option value="unidad" ${item.unidad==='unidad'?'selected':''}>Unidad</option>
                    <option value="gramo" ${item.unidad==='gramo'?'selected':''}>Gramo</option>
                </select>
            </td>
            <td>Bs ${item.subtotal.toFixed(2)}</td>
            <td><button class="btn-eliminar-carrito" onclick="eliminarDelCarrito(${i})">Eliminar</button></td>
        `;
        tbody.appendChild(row);
    });
    totalCarritoBs.textContent = `Total: Bs ${totalBs.toFixed(2)}`;
    totalCarritoDolares.textContent = `Total: $ ${totalUsd.toFixed(2)}`;
}

// actualizar cantidad por unidades
function actualizarCantidadCarrito(index, cambio) {
    const item = carrito[index];
    item.cantidad += cambio;
    if (item.cantidad < 1) { eliminarDelCarrito(index); return; }
    calcularSubtotalSegunUnidad(item);
    localStorage.setItem('carrito', JSON.stringify(carrito));
    actualizarCarrito();
}

// Cuando unidad es GRAMO: pedir gramos (para sumar/restar con el botón + y -)
function pedirGramos(index, operacion) {
    const item = carrito[index];
    // pedir valor absoluto de gramos
    const valor = parseFloat(prompt('Ingrese gramos (ej: 500):','500')) || 0;
    if (valor <= 0) { showToast('Ingrese gramos válidos','error'); return; }
    if (operacion === 1) {
        item.cantidad += valor;
    } else {
        item.cantidad -= valor;
        if (item.cantidad <= 0) { eliminarDelCarrito(index); return; }
    }
    calcularSubtotalSegunUnidad(item);
    localStorage.setItem('carrito', JSON.stringify(carrito));
    actualizarCarrito();
}

// calcular subtotales teniendo en cuenta gramo/kilo/unidad
function calcularSubtotalSegunUnidad(item) {
    const producto = productos[item.indexProducto];
    if (!producto) return;
    if (item.unidad === 'gramo') {
        // cantidad está en gramos -> convertir a kilos multiplicando por 0.001
        // asumimos precioUnitarioBolivar es por "unidad" base (ej. si guardaste una caja o kilo como unidad base, unidadesPorCaja debe reflejarlo)
        // cálculo: (gramos / 1000) * precioUnitarioBolivar (si precio unitario es por kilo)
        item.subtotal = (item.cantidad * 0.001) * (producto.precioUnitarioBolivar * (producto.unidadesPorCaja ? 1 : 1));
        item.subtotalDolar = (item.cantidad * 0.001) * producto.precioUnitarioDolar;
    } else {
        item.subtotal = item.cantidad * item.precioUnitarioBolivar;
        item.subtotalDolar = item.cantidad * item.precioUnitarioDolar;
    }
}

// cambiar unidad selector: unidad o gramo
function cambiarUnidadCarrito(index, nueva) {
    carrito[index].unidad = nueva;
    // si pasa a gramo, convertimos cantidad en unidades -> gramos (si antes era unidad)
    // para evitar conversión incorrecta, dejamos la cantidad como el usuario la ajuste manualmente
    calcularSubtotalSegunUnidad(carrito[index]);
    localStorage.setItem('carrito', JSON.stringify(carrito));
    actualizarCarrito();
}

function eliminarDelCarrito(index) {
    carrito.splice(index,1);
    localStorage.setItem('carrito', JSON.stringify(carrito));
    actualizarCarrito();
}

// ===== Métodos de pago y finalizar venta =====
function finalizarVenta() {
    if (carrito.length === 0) { showToast('El carrito está vacío', 'warning'); return; }
    const totalBs = carrito.reduce((s,i)=> s + i.subtotal, 0);
    const totalUsd = carrito.reduce((s,i)=> s + i.subtotalDolar, 0);
    document.getElementById('resumenTotalBs').textContent = `Total: Bs ${totalBs.toFixed(2)}`;
    document.getElementById('resumenTotalDolares').textContent = `Total: $ ${totalUsd.toFixed(2)}`;
    document.getElementById('modalPago').style.display = 'block';
    metodoPagoSeleccionado = null;
    document.getElementById('detallesPago').style.display = 'none';
    document.getElementById('camposPago').innerHTML = '';
}

function cerrarModalPago() {
    document.getElementById('modalPago').style.display = 'none';
    metodoPagoSeleccionado = null;
    detallesPago = {};
}

function seleccionarMetodoPago(metodo) {
    metodoPagoSeleccionado = metodo;
    const detallesDiv = document.getElementById('camposPago');
    const totalBs = carrito.reduce((s,i)=> s + i.subtotal, 0);
    detallesDiv.innerHTML = '';
    detallesPago = { metodo, totalBs };

    if (metodo === 'efectivo_bs' || metodo === 'efectivo_dolares') {
        detallesDiv.innerHTML = `
            <div class="campo-pago">
                <label>Monto recibido (${metodo==='efectivo_bs'?'Bs':'$'}):</label>
                <input type="number" id="montoRecibido" placeholder="Ingrese monto recibido" />
            </div>
            <div class="campo-pago">
                <label>Cambio:</label>
                <input type="text" id="cambioCalculado" readonly placeholder="0.00" />
            </div>
        `;
        setTimeout(()=> {
            const inpt = document.getElementById('montoRecibido');
            inpt.addEventListener('input', ()=> {
                const recib = parseFloat(inpt.value) || 0;
                if (metodo === 'efectivo_bs') {
                    const cambio = recib - totalBs;
                    document.getElementById('cambioCalculado').value = cambio >= 0 ? cambio.toFixed(2) : `Faltan ${Math.abs(cambio).toFixed(2)}`;
                } else {
                    const totalEnUsd = tasaBCVGuardada ? (totalBs / tasaBCVGuardada) : 0;
                    const cambio = recib - totalEnUsd;
                    document.getElementById('cambioCalculado').value = cambio >= 0 ? cambio.toFixed(2) : `Faltan ${Math.abs(cambio).toFixed(2)}`;
                }
            });
        },100);
    } else if (metodo === 'punto' || metodo === 'biopago') {
        detallesDiv.innerHTML = `
            <div class="campo-pago">
                <label>Monto:</label>
                <input type="number" id="montoPago" placeholder="Ingrese monto" />
            </div>
        `;
    } else if (metodo === 'pago_movil') {
        detallesDiv.innerHTML = `
            <div class="campo-pago">
                <label>Monto:</label>
                <input type="number" id="montoPagoMovil" placeholder="Ingrese monto" />
            </div>
            <div class="campo-pago">
                <label>Referencia / Número:</label>
                <input type="text" id="refPagoMovil" placeholder="Referencia bancaria" />
            </div>
            <div class="campo-pago">
                <label>Banco:</label>
                <input type="text" id="bancoPagoMovil" placeholder="Nombre del banco" />
            </div>
        `;
    }
    document.getElementById('detallesPago').style.display = 'block';
}

function confirmarMetodoPago() {
    if (!metodoPagoSeleccionado) { showToast('Seleccione un método de pago','error'); return; }
    const totalBs = carrito.reduce((s,i)=> s + i.subtotal, 0);
    // validaciones por método
    if (metodoPagoSeleccionado === 'efectivo_bs') {
        const recib = parseFloat(document.getElementById('montoRecibido').value) || 0;
        if (recib < totalBs) { showToast('Monto recibido menor al total','error'); return; }
        detallesPago.cambio = (recib - totalBs);
        detallesPago.montoRecibido = recib;
    } else if (metodoPagoSeleccionado === 'efectivo_dolares') {
        const recib = parseFloat(document.getElementById('montoRecibido').value) || 0;
        const totalUsd = tasaBCVGuardada ? (totalBs / tasaBCVGuardada) : 0;
        if (recib < totalUsd) { showToast('Monto recibido menor al total','error'); return; }
        detallesPago.cambio = (recib - totalUsd);
        detallesPago.montoRecibido = recib;
    } else if (metodoPagoSeleccionado === 'punto' || metodoPagoSeleccionado === 'biopago') {
        const monto = parseFloat(document.getElementById('montoPago') ? document.getElementById('montoPago').value : 0) || 0;
        if (monto <= 0) { showToast('Ingrese un monto válido','error'); return; }
        detallesPago.monto = monto;
    } else if (metodoPagoSeleccionado === 'pago_movil') {
        const monto = parseFloat(document.getElementById('montoPagoMovil').value) || 0;
        const ref = document.getElementById('refPagoMovil').value.trim();
        const banco = document.getElementById('bancoPagoMovil').value.trim();
        if (!monto || !ref || !banco) { showToast('Complete datos de Pago Móvil','error'); return; }
        detallesPago = {...detallesPago, monto, ref, banco};
    }

    // Registrar ventas y ajustar inventario
    carrito.forEach(item => {
        const producto = productos[item.indexProducto];
        if (!producto) return;

        // ajustar inventario según unidad
        if (item.unidad === 'gramo') {
            // restar en la misma unidad que tengas en inventario (si tu inventario se guarda en kilos, se resta gramos/1000)
            producto.unidadesExistentes = producto.unidadesExistentes - (item.cantidad / 1000);
        } else {
            producto.unidadesExistentes = producto.unidadesExistentes - item.cantidad;
        }

        ventasDiarias.push({
            fecha: new Date().toLocaleDateString(),
            hora: new Date().toLocaleTimeString(),
            producto: producto.nombre,
            cantidad: item.cantidad,
            unidad: item.unidad,
            totalBolivar: item.subtotal,
            metodoPago: metodoPagoSeleccionado,
            indexProducto: item.indexProducto
        });
    });

    localStorage.setItem('productos', JSON.stringify(productos));
    localStorage.setItem('ventasDiarias', JSON.stringify(ventasDiarias));

    showToast(`Venta completada por Bs ${totalBs.toFixed(2)}`, 'success');

    detallesPago.totalBs = totalBs;
    detallesPago.items = JSON.parse(JSON.stringify(carrito));
    detallesPago.fecha = new Date().toLocaleString();
    detallesPago.metodo = metodoPagoSeleccionado;

    carrito = [];
    localStorage.setItem('carrito', JSON.stringify(carrito));
    actualizarCarrito();
    cerrarModalPago();

    // imprimir ticket térmico automático
    imprimirTicketTermico(detallesPago);
}

// ===== Reporte diario PDF (mejorado) =====
function generarReporteDiario() {
    if (!ventasDiarias.length) { showToast('No hay ventas registradas','warning'); return; }

    // usar ventas del día actual
    const hoy = new Date().toLocaleDateString();
    const ventasHoy = ventasDiarias.filter(v => v.fecha === hoy);
    const ventasAUsar = ventasHoy.length ? ventasHoy : ventasDiarias;

    // acumuladores y desglose por métodos
    let totalVentasBs = 0, totalVentasUsd = 0, totalCostosBs = 0, totalCostosUsd = 0;
    const resumenPorMetodo = {}; // {metodo: {bs:..., usd:..., count:...}}

    const filas = ventasAUsar.map(v => {
        const producto = productos[v.indexProducto] || productos.find(p => p.nombre === v.producto);
        let costoDolar = 0;
        if (producto) {
            if (v.unidad === 'gramo') {
                // costo por unidad base -> costo en $ proporcional a gramos
                // asumimos producto.costo es $ por caja/unidad base; convertir a costo por unidad base
                const costoPorUnidad = producto.costo / (producto.unidadesPorCaja || 1);
                costoDolar = (v.cantidad / 1000) * costoPorUnidad;
            } else {
                // unidad
                const costoPorUnidad = producto.costo / (producto.unidadesPorCaja || 1);
                costoDolar = v.cantidad * costoPorUnidad;
            }
        }
        const costoBs = costoDolar * (tasaBCVGuardada || 1);
        totalCostosBs += costoBs;
        totalCostosUsd += costoDolar;

        const totalBs = v.totalBolivar || 0;
        totalVentasBs += totalBs;
        totalVentasUsd += (tasaBCVGuardada ? (totalBs / tasaBCVGuardada) : 0);

        if (!resumenPorMetodo[v.metodoPago]) resumenPorMetodo[v.metodoPago] = { bs:0, usd:0, count:0 };
        resumenPorMetodo[v.metodoPago].bs += totalBs;
        resumenPorMetodo[v.metodoPago].usd += (tasaBCVGuardada ? (totalBs / tasaBCVGuardada) : 0);
        resumenPorMetodo[v.metodoPago].count += 1;

        return [
            v.fecha,
            v.hora,
            v.producto,
            `${v.cantidad} ${v.unidad}`,
            `Bs ${totalBs.toFixed(2)}`,
            ` $ ${ (tasaBCVGuardada ? (totalBs / tasaBCVGuardada) : 0).toFixed(2) }`,
            v.metodoPago,
            `Bs ${(costoBs).toFixed(2)}`
        ];
    });

    const gananciaBs = totalVentasBs - totalCostosBs;
    const gananciaUsd = totalVentasUsd - totalCostosUsd;

    // inventario restante (snapshot actual)
    const inventarioActual = productos.map(p => ({ nombre: p.nombre, existencias: p.unidadesExistentes }));

    // Generar PDF con jsPDF + autotable
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt' });

    doc.setFontSize(14);
    doc.text(nombreEstablecimiento || 'Reporte Diario', 40, 40);
    doc.setFontSize(10);
    doc.text(`Fecha: ${(new Date()).toLocaleDateString()}`, 40, 60);

    doc.autoTable({
        startY: 80,
        head: [['Fecha','Hora','Producto','Cant.','Total (Bs)','Total ($)','Pago','Costo (Bs)']],
        body: filas,
        styles: { fontSize: 9 }
    });

    const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 14 : 300;
    doc.setFontSize(11);
    doc.text(`Total ventas (Bs): ${totalVentasBs.toFixed(2)}`, 40, finalY);
    doc.text(`Total ventas ($): ${totalVentasUsd.toFixed(2)}`, 40, finalY + 16);
    doc.text(`Total costos estimados (Bs): ${totalCostosBs.toFixed(2)}`, 40, finalY + 34);
    doc.text(`Total costos estimados ($): ${totalCostosUsd.toFixed(2)}`, 40, finalY + 52);
    doc.text(`Ganancia estimada (Bs): ${gananciaBs.toFixed(2)}`, 40, finalY + 70);
    doc.text(`Ganancia estimada ($): ${gananciaUsd.toFixed(2)}`, 40, finalY + 88);

    // resumen por métodos
    const keys = Object.keys(resumenPorMetodo);
    let yy = finalY + 110;
    if (keys.length) {
        doc.setFontSize(11);
        doc.text('Resumen por método de pago:', 40, yy);
        yy += 16;
        keys.forEach(m => {
            const r = resumenPorMetodo[m];
            doc.text(`${m}: Bs ${r.bs.toFixed(2)}  /  $ ${r.usd.toFixed(2)}  (Ventas: ${r.count})`, 48, yy);
            yy += 14;
        });
    }

    // inventario restante (lista corta)
    yy += 10;
    doc.setFontSize(11);
    doc.text('Inventario restante (resumen):', 40, yy);
    yy += 14;
    const invRows = inventarioActual.map(i => [i.nombre, `${Number(i.existencias).toFixed(3)}`]);
    doc.autoTable({
        startY: yy,
        head: [['Producto','Existencias']],
        body: invRows,
        styles: { fontSize: 9 }
    });

    doc.save(`reporte_diario_${(new Date()).toISOString().slice(0,10)}.pdf`);
}

// ===== PDF lista de productos =====
function generarRespaldoCompleto() {
    if (!productos.length) { showToast('No hay productos','warning'); return; }
    const copia = [...productos].sort((a,b) => a.nombre.localeCompare(b.nombre,'es',{sensitivity:'base'}));
    const rows = copia.map(p => [p.nombre, p.descripcion, `$${p.precioUnitarioDolar.toFixed(2)}`, `Bs ${p.precioUnitarioBolivar.toFixed(2)}`]);
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text(nombreEstablecimiento || 'Lista de Productos', 14, 18);
    doc.autoTable({ head:[['Producto','Descripción','Precio ($)','Precio (Bs)']], body:rows, startY:28, styles:{fontSize:9} });
    doc.save(`lista_productos_${(new Date()).toISOString().slice(0,10)}.pdf`);
}

// ===== Lista de costos desplegable y buscador =====
function mostrarListaCostos() {
    const container = document.getElementById('listaCostosContainer');
    const input = document.getElementById('buscarCostos');
    if (!container) return;
    if (container.style.display === 'none' || container.style.display === '') {
        container.style.display = 'block';
        input.style.display = 'inline-block';
        llenarListaCostos();
    } else {
        container.style.display = 'none';
        input.style.display = 'none';
    }
}

function llenarListaCostos() {
    const lista = document.getElementById('listaCostos');
    lista.innerHTML = '';
    const copia = [...productos].sort((a,b) => a.nombre.localeCompare(b.nombre,'es',{sensitivity:'base'}));
    copia.forEach(p => {
        const costoUnit = (p.costo / (p.unidadesPorCaja || 1));
        const li = document.createElement('li');
        li.innerHTML = `<span>${p.nombre} (${p.descripcion})</span><span>$${costoUnit.toFixed(2)} / Bs ${(p.precioUnitarioBolivar).toFixed(2)}</span>`;
        lista.appendChild(li);
    });
}
function filtrarListaCostos() {
    const t = document.getElementById('buscarCostos').value.trim().toLowerCase();
    const lista = document.getElementById('listaCostos');
    lista.innerHTML = '';
    const copia = [...productos].sort((a,b) => a.nombre.localeCompare(b.nombre,'es',{sensitivity:'base'}));
    const filtrados = t ? copia.filter(p => p.nombre.toLowerCase().includes(t) || p.descripcion.toLowerCase().includes(t)) : copia;
    filtrados.forEach(p => {
        const li = document.createElement('li');
        li.innerHTML = `<span>${p.nombre} (${p.descripcion})</span><span>$${(p.costo/(p.unidadesPorCaja||1)).toFixed(2)} / Bs ${p.precioUnitarioBolivar.toFixed(2)}</span>`;
        lista.appendChild(li);
    });
}

// ===== Respaldo completo localStorage: descargar y restaurar =====
function descargarRespaldoLocal() {
    const data = {
        productos,
        nombreEstablecimiento,
        tasaBCVGuardada,
        ventasDiarias,
        carrito
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
    saveAs(blob, `respaldo_calculadora_${(new Date()).toISOString().slice(0,10)}.json`);
    showToast('Respaldo descargado', 'success');
}

function triggerUploadRespaldo() {
    document.getElementById('inputRespaldo').click();
}

function restaurarRespaldo(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            // validar campos esenciales
            if (!data.productos) { showToast('Archivo no válido','error'); return; }
            // hacer backup actual antes de restaurar (por seguridad)
            localStorage.setItem('respaldo_previo', JSON.stringify({
                productos, nombreEstablecimiento, tasaBCVGuardada, ventasDiarias, carrito
            }));
            // restaurar
            productos = data.productos || [];
            nombreEstablecimiento = data.nombreEstablecimiento || nombreEstablecimiento;
            tasaBCVGuardada = data.tasaBCVGuardada || tasaBCVGuardada;
            ventasDiarias = data.ventasDiarias || ventasDiarias;
            carrito = data.carrito || [];
            // guardar en localStorage
            localStorage.setItem('productos', JSON.stringify(productos));
            localStorage.setItem('nombreEstablecimiento', nombreEstablecimiento);
            localStorage.setItem('tasaBCV', tasaBCVGuardada);
            localStorage.setItem('ventasDiarias', JSON.stringify(ventasDiarias));
            localStorage.setItem('carrito', JSON.stringify(carrito));
            cargarDatosIniciales();
            actualizarLista();
            actualizarCarrito();
            showToast('Respaldo restaurado correctamente', 'success');
        } catch (err) {
            console.error(err);
            showToast('Error leyendo archivo', 'error');
        }
    };
    reader.readAsText(file);
}

// ===== Panel plegable para ahorrar espacio =====
function togglePanel() {
    const panel = document.getElementById('panelContenido');
    if (!panel) return;
    if (!panel.style.maxHeight || panel.style.maxHeight === '0px') {
        panel.style.maxHeight = '2000px';
        panel.style.opacity = '1';
    } else {
        panel.style.maxHeight = '0px';
        panel.style.opacity = '0';
    }
}

// ===== Imprimir ticket térmico para la venta (automático) =====
function imprimirTicketTermico(detalles) {
    try {
        const w = window.open('', '_blank', 'width=340,height=600');
        if (!w) { showToast('Permita ventanas emergentes para imprimir.', 'error'); return; }
        let itemsHtml = '';
        (detalles.items || []).forEach(it => {
            const nombre = it.nombre.length > 24 ? it.nombre.slice(0,24) + '...' : it.nombre;
            const cantidad = it.unidad === 'gramo' ? `${it.cantidad} g` : `${it.cantidad}`;
            const subtotal = (it.subtotal || 0).toFixed(2);
            itemsHtml += `<div style="display:flex;justify-content:space-between;margin-bottom:6px;"><div>${nombre} x${cantidad}</div><div>Bs ${subtotal}</div></div>`;
        });
        const cambioTexto = detalles.cambio !== undefined ? `<div>Cambio: Bs ${detalles.cambio.toFixed(2)}</div>` : '';
        const recibidoTexto = detalles.montoRecibido !== undefined ? `<div>Recibido: ${detalles.montoRecibido}</div>` : '';
        const content = `
            <html><head><meta charset="utf-8"><title>Ticket</title>
            <style>
                body{font-family:monospace;padding:6px} .ticket{width:280px}
                h2{text-align:center;margin:6px 0;font-size:16px} .line{border-top:1px dashed #000;margin:6px 0}
                .items div{font-size:12px}
                .totals{font-weight:700;margin-top:8px}
                .small{font-size:11px;color:#333}
            </style>
            </head>
            <body>
                <div class="ticket">
                    <h2>${nombreEstablecimiento || 'Calculadora Mágica'}</h2>
                    <div class="small">Fecha: ${detalles.fecha}</div>
                    <div class="line"></div>
                    <div class="items">
                        ${itemsHtml}
                    </div>
                    <div class="line"></div>
                    <div class="totals">TOTAL: Bs ${detalles.totalBs.toFixed(2)}</div>
                    ${recibidoTexto}
                    ${cambioTexto}
                    <div class="line"></div>
                    <div class="small">Método: ${detalles.metodo}</div>
                    <div class="small">Gracias por su compra</div>
                </div>
                <script>
                    setTimeout(()=>{ window.print(); setTimeout(()=>window.close(),300); }, 250);
                </script>
            </body></html>
        `;
        w.document.open();
        w.document.write(content);
        w.document.close();
    } catch (err) {
        console.error(err);
        showToast('Error al imprimir ticket', 'error');
    }
}

// ===== Imprimir ticket para actualizar estante (por producto) =====
function imprimirTicketProducto(index) {
    const p = productos[index];
    if (!p) { showToast('Producto no encontrado', 'error'); return; }
    try {
        const w = window.open('', '_blank', 'width=340,height=400');
        if (!w) { showToast('Permita ventanas emergentes para imprimir.', 'error'); return; }
        const content = `
            <html><head><meta charset="utf-8"><title>Ticket Producto</title>
            <style> body{font-family:monospace;padding:6px} .ticket{width:280px} h2{text-align:center;margin:6px 0;font-size:16px} .line{border-top:1px dashed #000;margin:6px 0} .small{font-size:12px}</style>
            </head><body>
            <div class="ticket">
                <h2>${nombreEstablecimiento || 'Calculadora Mágica'}</h2>
                <div class="small">Producto: ${p.nombre}</div>
                <div class="small">Desc: ${p.descripcion}</div>
                <div class="small">Precio: $ ${p.precioUnitarioDolar.toFixed(2)}</div>
                <div class="small">Precio: Bs ${p.precioUnitarioBolivar.toFixed(2)}</div>
                <div class="small">Existencias: ${Number(p.unidadesExistentes).toFixed(3)}</div>
                <div class="line"></div>
                <div class="small">Ticket para actualizar estante</div>
            </div>
            <script> setTimeout(()=>{ window.print(); setTimeout(()=>window.close(),300); },200); </script>
            </body></html>
        `;
        w.document.open(); w.document.write(content); w.document.close();
    } catch (err) {
        console.error(err);
        showToast('Error imprimir ticket producto', 'error');
    }
}

// ===== Generar PDF de costos =====
function generarPDFCostos() {
    if (!productos.length) { showToast('No hay productos para PDF de costos','warning'); return; }
    const copia = [...productos].sort((a,b) => a.nombre.localeCompare(b.nombre,'es',{sensitivity:'base'}));
    const rows = copia.map(p => [p.nombre, p.descripcion, `$${(p.costo/(p.unidadesPorCaja||1)).toFixed(2)}`, `Bs ${p.precioUnitarioBolivar.toFixed(2)}`]);
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(14); doc.text(nombreEstablecimiento || 'Lista de Costos', 14, 18);
    doc.autoTable({ head:[['Producto','Descripción','Costo (u)','Precio (Bs)']], body: rows, startY:28, styles:{fontSize:9} });
    doc.save(`lista_costos_${(new Date()).toISOString().slice(0,10)}.pdf`);
}

// ===== Cerrar modal si se hace clic fuera =====
window.onclick = function(event) {
    const modal = document.getElementById('modalPago');
    if (event.target == modal) cerrarModalPago();
};
