// ===== VARIABLES GLOBALES =====
let productos = JSON.parse(localStorage.getItem('productos')) || [];
let nombreEstablecimiento = localStorage.getItem('nombreEstablecimiento') || '';
let tasaBCVGuardada = parseFloat(localStorage.getItem('tasaBCV')) || 0;
let ventasDiarias = JSON.parse(localStorage.getItem('ventasDiarias')) || [];
let carrito = JSON.parse(localStorage.getItem('carrito')) || [];
let metodoPagoSeleccionado = null;
let detallesPago = {};

// ===== INICIALIZACIÓN =====
document.addEventListener('DOMContentLoaded', function() {
    console.log('Calculadora iniciada correctamente');
    cargarDatosIniciales();
    actualizarLista();
    actualizarCarrito();
    configurarEventos();
});

function configurarEventos() {
    // Evento para búsqueda con Enter
    document.getElementById('buscar').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            buscarProducto();
        }
    });
    
    // Evento para scanner con Enter
    document.getElementById('codigoBarrasInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            agregarPorCodigoBarras();
        }
    });
}

// ===== BUSCADOR RÁPIDO (para el input del carrito) =====
document.getElementById('codigoBarrasInput').addEventListener('input', function() {
    const termino = this.value.trim().toLowerCase();
    const sugerenciasDiv = document.getElementById('sugerencias');
    sugerenciasDiv.innerHTML = '';

    if (termino.length < 2) return; // esperar al menos 2 letras para no mostrar demasiadas sugerencias

    const coincidencias = productos.filter(p =>
        p.nombre.toLowerCase().includes(termino) ||
        (p.codigoBarras && p.codigoBarras.toLowerCase().includes(termino))
    );

    coincidencias.forEach(prod => {
        const opcion = document.createElement('div');
        opcion.textContent = `${prod.nombre} (${prod.descripcion})`;
        opcion.onclick = function() {
            // al seleccionar, colocamos el valor (preferimos el código de barras si existe)
            document.getElementById('codigoBarrasInput').value = prod.codigoBarras || prod.nombre;
            agregarPorCodigoBarras(); // agrega directo al carrito
            sugerenciasDiv.innerHTML = ''; // limpiar lista
            document.getElementById('codigoBarrasInput').focus();
        };
        sugerenciasDiv.appendChild(opcion);
    });
});


// ===== FUNCIONES BÁSICAS =====
function cargarDatosIniciales() {
    document.getElementById('nombreEstablecimiento').value = nombreEstablecimiento;
    document.getElementById('tasaBCV').value = tasaBCVGuardada || '';
}

function calcularPrecioVenta() {
    const tasaBCV = parseFloat(document.getElementById('tasaBCV').value) || tasaBCVGuardada;
    const costo = parseFloat(document.getElementById('costo').value);
    const ganancia = parseFloat(document.getElementById('ganancia').value);
    const unidadesPorCaja = parseFloat(document.getElementById('unidadesPorCaja').value);

    if (!tasaBCV || tasaBCV <= 0) {
        alert("Ingrese una tasa BCV válida");
        return;
    }
    
    if (!costo || !ganancia || !unidadesPorCaja) {
        alert("Complete todos los campos requeridos");
        return;
    }

    const gananciaDecimal = ganancia / 100;
    const precioDolar = costo / (1 - gananciaDecimal);
    const precioBolivares = precioDolar * tasaBCV;
    const precioUnitarioDolar = precioDolar / unidadesPorCaja;
    const precioUnitarioBolivar = precioBolivares / unidadesPorCaja;

    document.getElementById('precioUnitario').innerHTML = 
        `<strong>Precio unitario:</strong> $${precioUnitarioDolar.toFixed(2)} / Bs${precioUnitarioBolivar.toFixed(2)}`;
}

function guardarProducto() {
    const nombre = document.getElementById('producto').value.trim();
    const codigoBarras = document.getElementById('codigoBarras').value.trim();
    const descripcion = document.getElementById('descripcion').value;
    const costo = parseFloat(document.getElementById('costo').value);
    const ganancia = parseFloat(document.getElementById('ganancia').value);
    const unidadesPorCaja = parseFloat(document.getElementById('unidadesPorCaja').value);
    const unidadesExistentes = parseFloat(document.getElementById('unidadesExistentes').value) || 0;
    const tasaBCV = parseFloat(document.getElementById('tasaBCV').value) || tasaBCVGuardada;

    if (!nombre || !descripcion) {
        alert("Complete el nombre y descripción del producto");
        return;
    }

    if (!tasaBCV || tasaBCV <= 0) {
        alert("Ingrese una tasa BCV válida");
        return;
    }

    if (!costo || !ganancia || !unidadesPorCaja) {
        alert("Complete todos los campos requeridos");
        return;
    }

    // Verificar si el producto ya existe
    const productoExistente = productos.findIndex(p => p.nombre.toLowerCase() === nombre.toLowerCase());
    if (productoExistente !== -1) {
        if (!confirm(`"${nombre}" ya existe. ¿Deseas actualizarlo?`)) return;
        productos.splice(productoExistente, 1);
    }

    const gananciaDecimal = ganancia / 100;
    const precioDolar = costo / (1 - gananciaDecimal);
    const precioBolivares = precioDolar * tasaBCV;

    const producto = {
        nombre,
        codigoBarras,
        descripcion,
        costo,
        ganancia: gananciaDecimal,
        unidadesPorCaja,
        unidadesExistentes,
        precioMayorDolar: precioDolar,
        precioMayorBolivar: precioBolivares,
        precioUnitarioDolar: precioDolar / unidadesPorCaja,
        precioUnitarioBolivar: precioBolivares / unidadesPorCaja,
        fechaActualizacion: new Date().toISOString()
    };

    productos.push(producto);
    localStorage.setItem('productos', JSON.stringify(productos));
    actualizarLista();
    
    // Reiniciar formulario
    document.getElementById('producto').value = '';
    document.getElementById('codigoBarras').value = '';
    document.getElementById('costo').value = '';
    document.getElementById('ganancia').value = '';
    document.getElementById('unidadesPorCaja').value = '';
    document.getElementById('unidadesExistentes').value = '';
    document.getElementById('descripcion').selectedIndex = 0;
    
    alert("✓ Producto guardado exitosamente");
}

// ===== CARRITO DE VENTAS =====
function agregarPorCodigoBarras() {
    const codigo = document.getElementById('codigoBarrasInput').value.trim();
    
    if (!codigo) {
        alert("Ingrese o escanee un código de barras");
        return;
    }
    
    // Buscar producto
    let productoEncontrado = productos.find(p => 
        p.codigoBarras && p.codigoBarras.toLowerCase() === codigo.toLowerCase()
    );
    
    if (!productoEncontrado) {
        productoEncontrado = productos.find(p => 
            p.nombre.toLowerCase().includes(codigo.toLowerCase())
        );
        
        if (!productoEncontrado) {
            alert("Producto no encontrado");
            return;
        }
    }
    
    // Verificar si ya está en el carrito
    const enCarrito = carrito.findIndex(item => item.nombre === productoEncontrado.nombre && item.unidad === 'unidad');
    
    if (enCarrito !== -1) {
        // Actualizar cantidad
        carrito[enCarrito].cantidad += 1;
        carrito[enCarrito].subtotal = carrito[enCarrito].cantidad * carrito[enCarrito].precioUnitarioBolivar;
        carrito[enCarrito].subtotalDolar = carrito[enCarrito].cantidad * carrito[enCarrito].precioUnitarioDolar;
    } else {
        // Agregar nuevo producto
        carrito.push({
            nombre: productoEncontrado.nombre,
            descripcion: productoEncontrado.descripcion,
            precioUnitarioBolivar: productoEncontrado.precioUnitarioBolivar,
            precioUnitarioDolar: productoEncontrado.precioUnitarioDolar,
            cantidad: 1,
            unidad: 'unidad',
            subtotal: productoEncontrado.precioUnitarioBolivar,
            subtotalDolar: productoEncontrado.precioUnitarioDolar,
            indexProducto: productos.findIndex(p => p.nombre === productoEncontrado.nombre)
        });
    }
    
    document.getElementById('codigoBarrasInput').value = '';
    document.getElementById('codigoBarrasInput').focus();
    document.getElementById('scannerStatus').textContent = 'Producto agregado. Esperando nuevo escaneo...';
    
    localStorage.setItem('carrito', JSON.stringify(carrito));
    actualizarCarrito();
}

function actualizarCarrito() {
    const carritoBody = document.getElementById('carritoBody');
    const totalCarritoBs = document.getElementById('totalCarritoBs');
    const totalCarritoDolares = document.getElementById('totalCarritoDolares');
    
    carritoBody.innerHTML = '';
    
    if (carrito.length === 0) {
        carritoBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">El carrito está vacío</td></tr>';
        totalCarritoBs.textContent = 'Total: Bs 0,00';
        totalCarritoDolares.textContent = 'Total: $ 0,00';
        return;
    }
    
    let totalBs = 0;
    let totalDolares = 0;
    
    carrito.forEach((item, index) => {
        totalBs += item.subtotal;
        totalDolares += item.subtotalDolar;
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.nombre} (${item.descripcion})</td>
            <td>Bs ${item.precioUnitarioBolivar.toFixed(2)}</td>
            <td>
                <button onclick="actualizarCantidadCarrito(${index}, -1)">-</button>
                ${item.cantidad}
                <button onclick="actualizarCantidadCarrito(${index}, 1)">+</button>
            </td>
            <td>
                <select onchange="cambiarUnidadCarrito(${index}, this.value)" class="unidad-selector">
                    <option value="unidad" ${item.unidad === 'unidad' ? 'selected' : ''}>Unidad</option>
                    <option value="caja" ${item.unidad === 'caja' ? 'selected' : ''}>Caja</option>
                    <option value="kilo" ${item.unidad === 'kilo' ? 'selected' : ''}>Kilo</option>
                    <option value="gramo" ${item.unidad === 'gramo' ? 'selected' : ''}>Gramo</option>
                </select>
            </td>
            <td>Bs ${item.subtotal.toFixed(2)}</td>
            <td>
                <button class="btn-eliminar-carrito" onclick="eliminarDelCarrito(${index})">Eliminar</button>
            </td>
        `;
        carritoBody.appendChild(row);
    });
    
    totalCarritoBs.textContent = `Total: Bs ${totalBs.toFixed(2)}`;
    totalCarritoDolares.textContent = `Total: $ ${totalDolares.toFixed(2)}`;
}

function actualizarCantidadCarrito(index, cambio) {
    const item = carrito[index];
    item.cantidad += cambio;
    
    if (item.cantidad < 1) {
        eliminarDelCarrito(index);
        return;
    }
    
    // Recalcular subtotal según unidad
    calcularSubtotalSegunUnidad(item);
    
    localStorage.setItem('carrito', JSON.stringify(carrito));
    actualizarCarrito();
}

function calcularSubtotalSegunUnidad(item) {
    const producto = productos[item.indexProducto];
    if (!producto) return;
    
    if (item.unidad === 'gramo') {
        item.subtotal = item.cantidad * item.precioUnitarioBolivar * 0.001;
        item.subtotalDolar = item.cantidad * item.precioUnitarioDolar * 0.001;
    } else if (item.unidad === 'kilo') {
        item.subtotal = item.cantidad * item.precioUnitarioBolivar;
        item.subtotalDolar = item.cantidad * item.precioUnitarioDolar;
    } else if (item.unidad === 'caja') {
        item.subtotal = item.cantidad * item.precioUnitarioBolivar * producto.unidadesPorCaja;
        item.subtotalDolar = item.cantidad * item.precioUnitarioDolar * producto.unidadesPorCaja;
    } else {
        item.subtotal = item.cantidad * item.precioUnitarioBolivar;
        item.subtotalDolar = item.cantidad * item.precioUnitarioDolar;
    }
}

function cambiarUnidadCarrito(index, nuevaUnidad) {
    carrito[index].unidad = nuevaUnidad;
    calcularSubtotalSegunUnidad(carrito[index]);
    localStorage.setItem('carrito', JSON.stringify(carrito));
    actualizarCarrito();
}

function eliminarDelCarrito(index) {
    carrito.splice(index, 1);
    localStorage.setItem('carrito', JSON.stringify(carrito));
    actualizarCarrito();
}

// ===== LISTA DE PRODUCTOS =====
function actualizarLista() {
    const tbody = document.querySelector('#listaProductos tbody');
    tbody.innerHTML = '';

    productos.forEach((producto, index) => {
        const inventarioBajo = producto.unidadesExistentes <= 5;
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${producto.nombre}</td>
            <td>${producto.descripcion}</td>
            <td>${producto.codigoBarras || 'N/A'}</td>
            <td class="${inventarioBajo ? 'inventario-bajo' : ''}">${producto.unidadesExistentes}</td>
            <td>
                <div class="ajuste-inventario">
                    <button onclick="ajustarInventario(${index}, 'sumar')">+</button>
                    <button onclick="ajustarInventario(${index}, 'restar')">-</button>
                </div>
            </td>
            <td>$${producto.precioUnitarioDolar.toFixed(2)}</td>
            <td>Bs${producto.precioUnitarioBolivar.toFixed(2)}</td>
            <td>${(producto.ganancia * 100).toFixed(0)}%</td>
            <td>
                <button class="editar" onclick="editarProducto(${index})">Editar</button>
                <button class="eliminar" onclick="eliminarProducto(${index})">Eliminar</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function buscarProducto() {
    const termino = document.getElementById('buscar').value.trim().toLowerCase();
    if (!termino) {
        actualizarLista();
        return;
    }

    const resultados = productos.filter(p => 
        p.nombre.toLowerCase().includes(termino) || 
        p.descripcion.toLowerCase().includes(termino) ||
        (p.codigoBarras && p.codigoBarras.toLowerCase().includes(termino))
    );

    const tbody = document.querySelector('#listaProductos tbody');
    tbody.innerHTML = '';

    resultados.forEach((producto, index) => {
        const inventarioBajo = producto.unidadesExistentes <= 5;
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${producto.nombre}</td>
            <td>${producto.descripcion}</td>
            <td>${producto.codigoBarras || 'N/A'}</td>
            <td class="${inventarioBajo ? 'inventario-bajo' : ''}">${producto.unidadesExistentes}</td>
            <td>
                <div class="ajuste-inventario">
                    <button onclick="ajustarInventario(${index}, 'sumar')">+</button>
                    <button onclick="ajustarInventario(${index}, 'restar')">-</button>
                </div>
            </td>
            <td>$${producto.precioUnitarioDolar.toFixed(2)}</td>
            <td>Bs${producto.precioUnitarioBolivar.toFixed(2)}</td>
            <td>${(producto.ganancia * 100).toFixed(0)}%</td>
            <td>
                <button class="editar" onclick="editarProducto(${index})">Editar</button>
                <button class="eliminar" onclick="eliminarProducto(${index})">Eliminar</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function ajustarInventario(index, operacion) {
    const producto = productos[index];
    const cantidad = parseInt(prompt(`Ingrese la cantidad a ${operacion === 'sumar' ? 'sumar' : 'restar'}:`, "1")) || 0;
    
    if (cantidad <= 0) {
        alert("Ingrese una cantidad válida");
        return;
    }

    if (operacion === 'restar' && producto.unidadesExistentes < cantidad) {
        alert("No hay suficientes unidades en inventario");
        return;
    }

    producto.unidadesExistentes = operacion === 'sumar' ? 
        producto.unidadesExistentes + cantidad : 
        producto.unidadesExistentes - cantidad;
    
    localStorage.setItem('productos', JSON.stringify(productos));
    actualizarLista();
    alert(`Inventario de ${producto.nombre} actualizado: ${producto.unidadesExistentes} unidades`);
}

function editarProducto(index) {
    const producto = productos[index];
    
    document.getElementById('producto').value = producto.nombre;
    document.getElementById('codigoBarras').value = producto.codigoBarras || '';
    document.getElementById('descripcion').value = producto.descripcion;
    document.getElementById('costo').value = producto.costo;
    document.getElementById('ganancia').value = producto.ganancia * 100;
    document.getElementById('unidadesPorCaja').value = producto.unidadesPorCaja;
    document.getElementById('unidadesExistentes').value = producto.unidadesExistentes;
    
    // Mostrar precio calculado
    const precioUnitarioDolar = producto.precioUnitarioDolar;
    const precioUnitarioBolivar = producto.precioUnitarioBolivar;
    document.getElementById('precioUnitario').innerHTML = 
        `<strong>Precio unitario:</strong> $${precioUnitarioDolar.toFixed(2)} / Bs${precioUnitarioBolivar.toFixed(2)}`;
    
    // Eliminar producto actual para reemplazarlo
    productos.splice(index, 1);
    localStorage.setItem('productos', JSON.stringify(productos));
    actualizarLista();
    
    alert(`Editando producto: ${producto.nombre}`);
}

function eliminarProducto(index) {
    const producto = productos[index];
    if (confirm(`¿Estás seguro de eliminar "${producto.nombre}"?`)) {
        productos.splice(index, 1);
        localStorage.setItem('productos', JSON.stringify(productos));
        actualizarLista();
        alert(`Producto eliminado: ${producto.nombre}`);
    }
}

function limpiarLista() {
    if (confirm("¿Estás seguro de limpiar toda la lista de productos?")) {
        productos = [];
        localStorage.setItem('productos', JSON.stringify(productos));
        actualizarLista();
        alert("Todos los productos han sido eliminados");
    }
}

// ===== MÉTODOS DE PAGO =====
function finalizarVenta() {
    if (carrito.length === 0) {
        alert("El carrito está vacío");
        return;
    }
    
    const totalBs = carrito.reduce((sum, item) => sum + item.subtotal, 0);
    const totalDolares = carrito.reduce((sum, item) => sum + item.subtotalDolar, 0);
    
    document.getElementById('resumenTotalBs').textContent = `Total: Bs ${totalBs.toFixed(2)}`;
    document.getElementById('resumenTotalDolares').textContent = `Total: $ ${totalDolares.toFixed(2)}`;
    
    document.getElementById('modalPago').style.display = 'block';
}

function cerrarModalPago() {
    document.getElementById('modalPago').style.display = 'none';
}

function seleccionarMetodoPago(metodo) {
    metodoPagoSeleccionado = metodo;
    const detallesDiv = document.getElementById('camposPago');
    
    if (metodo === 'biopago') {
        detallesDiv.innerHTML = `
            <div class="campo-pago">
                <label>Número de referencia:</label>
                <input type="text" id="referenciaBiopago" placeholder="Número de referencia" required>
            </div>
            <div class="campo-pago">
                <label>Banco:</label>
                <input type="text" id="bancoBiopago" placeholder="Nombre del banco" required>
            </div>
        `;
    } else {
        detallesDiv.innerHTML = `<p>Método de pago seleccionado: ${metodo}</p>`;
    }
    
    document.getElementById('detallesPago').style.display = 'block';
}

function confirmarMetodoPago() {
    if (!metodoPagoSeleccionado) {
        alert("Seleccione un método de pago");
        return;
    }
    
    // Procesar venta
    const totalBs = carrito.reduce((sum, item) => sum + item.subtotal, 0);
    
    // Registrar ventas
    carrito.forEach(item => {
        const producto = productos[item.indexProducto];
        if (producto) {
            // Restar del inventario
            let cantidadVendida = item.cantidad;
            if (item.unidad === 'caja') {
                cantidadVendida = item.cantidad * producto.unidadesPorCaja;
            }
            producto.unidadesExistentes -= cantidadVendida;
            
            // Registrar venta
            ventasDiarias.push({
                fecha: new Date().toLocaleDateString(),
                hora: new Date().toLocaleTimeString(),
                producto: producto.nombre,
                cantidad: item.cantidad,
                unidad: item.unidad,
                totalBolivar: item.subtotal,
                metodoPago: metodoPagoSeleccionado
            });
        }
    });
    
    localStorage.setItem('productos', JSON.stringify(productos));
    localStorage.setItem('ventasDiarias', JSON.stringify(ventasDiarias));
    
    alert(`Venta completada por Bs ${totalBs.toFixed(2)}`);
    
    // Limpiar carrito
    carrito = [];
    localStorage.setItem('carrito', JSON.stringify(carrito));
    actualizarCarrito();
    cerrarModalPago();
}

function cancelarPago() {
    document.getElementById('detallesPago').style.display = 'none';
    metodoPagoSeleccionado = null;
}

// ===== FUNCIONES ADICIONALES =====
function guardarNombreEstablecimiento() {
    nombreEstablecimiento = document.getElementById('nombreEstablecimiento').value.trim();
    if (!nombreEstablecimiento) {
        alert("Ingrese un nombre válido");
        return;
    }
    localStorage.setItem('nombreEstablecimiento', nombreEstablecimiento);
    alert(`Nombre guardado: "${nombreEstablecimiento}"`);
}

function actualizarTasaBCV() {
    const nuevaTasa = parseFloat(document.getElementById('tasaBCV').value);
    
    if (!nuevaTasa || nuevaTasa <= 0) {
        alert("Ingrese una tasa BCV válida");
        return;
    }

    tasaBCVGuardada = nuevaTasa;
    localStorage.setItem('tasaBCV', tasaBCVGuardada);
    
    // Recalcular precios de todos los productos
    productos.forEach(producto => {
        producto.precioUnitarioBolivar = producto.precioUnitarioDolar * nuevaTasa;
        producto.precioMayorBolivar = producto.precioMayorDolar * nuevaTasa;
    });
    
    localStorage.setItem('productos', JSON.stringify(productos));
    actualizarLista();
    
    alert(`Tasa BCV actualizada a: ${nuevaTasa}`);
}

function toggleCopyrightNotice() {
    const notice = document.getElementById('copyrightNotice');
    notice.style.display = notice.style.display === 'block' ? 'none' : 'block';
}

// ===== FUNCIONES DE REPORTES (SIMPLIFICADAS) =====
function generarReporteDiario() {
    if (ventasDiarias.length === 0) {
        alert("No hay ventas registradas");
        return;
    }
    
    alert("Función de reporte diario - Para implementación completa con PDF");
}

function mostrarListaCostos() {
    const container = document.getElementById('listaCostosContainer');
    if (container.style.display === 'none') {
        container.style.display = 'block';
        // Aquí iría la lógica para mostrar costos
    } else {
        container.style.display = 'none';
    }
}

function generarPDFCostos() {
    alert("Función de PDF de costos - Para implementación completa con PDF");
}

function generarRespaldoCompleto() {
    alert("Función de respaldo completo - Para implementación completa con PDF");
}

// Cerrar modal si se hace clic fuera
window.onclick = function(event) {
    const modal = document.getElementById('modalPago');
    if (event.target == modal) {
        cerrarModalPago();
    }
};
