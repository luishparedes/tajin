// ===== SISTEMA DE ACTUALIZACIÓN AUTOMÁTICA ===== //
const VERSION_ACTUAL = "1.2.1"; // Versión corregida

// Verificar si hay una nueva versión
function verificarActualizacion() {
    const versionGuardada = localStorage.getItem('appVersion');
    
    if (versionGuardada !== VERSION_ACTUAL) {
        localStorage.setItem('appVersion', VERSION_ACTUAL);
        
        if (versionGuardada !== null) {
            mostrarToast("¡Nueva actualización disponible! La app se recargará automáticamente.", "info");
            
            setTimeout(() => {
                window.location.reload(true);
            }, 3000);
        }
    }
}

// ===== DETECCIÓN DE DISPOSITIVO MÓVIL ===== //
function esDispositivoMovil() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
           window.innerWidth <= 768;
}

// ===== INACTIVIDAD Y REDIRECCIÓN ===== //
let temporizadorInactividad;

function reiniciarTemporizadorInactividad() {
    clearTimeout(temporizadorInactividad);
    temporizadorInactividad = setTimeout(() => {
        window.location.href = "https://luishparedes.github.io/apptiktok2025/";
    }, 600000); // 10 minutos (600,000 ms)
}

// ===== FUNCIÓN PARA COPIAR AL PORTAPAPELES ===== //
function copiarAlPortapapeles(texto) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(texto).then(() => {
            mostrarToast("Texto copiado al portapapeles", "success");
        }).catch(err => {
            copiarFallback(texto);
        });
    } else {
        copiarFallback(texto);
    }
}

function copiarFallback(texto) {
    const textarea = document.createElement('textarea');
    textarea.value = texto;
    document.body.appendChild(textarea);
    textarea.select();
    try {
        document.execCommand('copy');
        mostrarToast("Texto copiado", "success");
    } catch (err) {
        mostrarToast("No se pudo copiar el texto", "error");
    }
    document.body.removeChild(textarea);
}

// ===== DATOS PERSISTENTES ===== //
let productos = JSON.parse(localStorage.getItem('productos')) || [];
let nombreEstablecimiento = localStorage.getItem('nombreEstablecimiento') || '';
let tasaBCVGuardada = parseFloat(localStorage.getItem('tasaBCV')) || 0;
let ventasDiarias = JSON.parse(localStorage.getItem('ventasDiarias')) || [];

// ===== FUNCIONES PRINCIPALES ===== //
function cargarDatosIniciales() {
    document.getElementById('nombreEstablecimiento').value = nombreEstablecimiento;
    document.getElementById('tasaBCV').value = tasaBCVGuardada || '';
    actualizarLista();
}

function guardarNombreEstablecimiento() {
    const nombre = document.getElementById('nombreEstablecimiento').value.trim();
    if (!nombre) {
        mostrarToast("Ingrese un nombre válido para el establecimiento", "error");
        return;
    }
    
    nombreEstablecimiento = nombre;
    localStorage.setItem('nombreEstablecimiento', nombreEstablecimiento);
    mostrarToast("Nombre del establecimiento guardado correctamente");
}

function calcularPrecioVenta() {
    const tasaBCV = parseFloat(document.getElementById('tasaBCV').value) || tasaBCVGuardada;
    const costo = parseFloat(document.getElementById('costo').value);
    const ganancia = parseFloat(document.getElementById('ganancia').value);
    const unidadesPorCaja = parseFloat(document.getElementById('unidadesPorCaja').value);
    const unidadesExistentes = parseFloat(document.getElementById('unidadesExistentes').value) || 0;

    if (!validarTasaBCV(tasaBCV)) return;
    if (!validarCamposNumericos(costo, ganancia, unidadesPorCaja)) return;

    const gananciaDecimal = ganancia / 100;
    const precioDolar = costo / (1 - gananciaDecimal);
    const precioBolivares = precioDolar * tasaBCV;
    const precioUnitarioDolar = precioDolar / unidadesPorCaja;
    const precioUnitarioBolivar = precioBolivares / unidadesPorCaja;

    mostrarResultados(precioUnitarioDolar, precioUnitarioBolivar);
}

function guardarProducto() {
    const nombre = document.getElementById('producto').value.trim();
    const descripcion = document.getElementById('descripcion').value;
    const costo = parseFloat(document.getElementById('costo').value);
    const ganancia = parseFloat(document.getElementById('ganancia').value);
    const unidadesPorCaja = parseFloat(document.getElementById('unidadesPorCaja').value);
    const unidadesExistentes = parseFloat(document.getElementById('unidadesExistentes').value) || 0;
    const tasaBCV = parseFloat(document.getElementById('tasaBCV').value) || tasaBCVGuardada;

    if (!validarCamposTexto(nombre, descripcion)) return;
    if (!validarTasaBCV(tasaBCV)) return;
    if (!validarCamposNumericos(costo, ganancia, unidadesPorCaja)) return;

    if (productoExiste(nombre)) {
        if (!confirm(`"${nombre}" ya existe. ¿Deseas actualizarlo?`)) return;
        const index = productos.findIndex(p => p.nombre.toLowerCase() === nombre.toLowerCase());
        productos.splice(index, 1);
    }

    const producto = calcularProducto(nombre, descripcion, costo, ganancia, unidadesPorCaja, tasaBCV, unidadesExistentes);
    guardarProductoEnLista(producto);
}

// ===== NUEVAS FUNCIONALIDADES ===== //
function generarListaPreciosEmpleados() {
    if (productos.length === 0) {
        mostrarToast("No hay productos registrados", "warning");
        return;
    }

    const productosOrdenados = [...productos].sort((a, b) => a.nombre.localeCompare(b.nombre));
    let contenido = `LISTA DE PRECIOS - ${nombreEstablecimiento || 'Mi Negocio'}\n`;
    contenido += `Fecha: ${new Date().toLocaleDateString()} | Tasa BCV: ${tasaBCVGuardada}\n\n`;
    
    productosOrdenados.forEach(producto => {
        contenido += `${producto.nombre.padEnd(30)} $${producto.precioUnitarioDolar.toFixed(2).padStart(10)} / Bs${producto.precioUnitarioBolivar.toFixed(2).padStart(10)}\n`;
    });

    if (esDispositivoMovil()) {
        if (confirm("¿Copiar lista de precios al portapapeles?")) {
            copiarAlPortapeles(contenido);
        }
    } else {
        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            doc.setFontSize(16);
            doc.text(`Lista de Precios - ${nombreEstablecimiento || 'Mi Negocio'}`, 105, 15, { align: 'center' });
            doc.setFontSize(10);
            doc.text(`Fecha: ${new Date().toLocaleDateString()} | Tasa BCV: ${tasaBCVGuardada}`, 105, 22, { align: 'center' });
            
            const columns = [
                { header: 'Producto', dataKey: 'nombre' },
                { header: 'Precio ($)', dataKey: 'precioDolar' },
                { header: 'Precio (Bs)', dataKey: 'precioBolivar' }
            ];
            
            const rows = productosOrdenados.map(producto => ({
                nombre: producto.nombre,
                precioDolar: `$${producto.precioUnitarioDolar.toFixed(2)}`,
                precioBolivar: `Bs${producto.precioUnitarioBolivar.toFixed(2)}`
            }));
            
            doc.autoTable({
                startY: 30,
                head: [columns.map(col => col.header)],
                body: rows.map(row => columns.map(col => row[col.dataKey])),
                margin: { horizontal: 10 },
                styles: { fontSize: 8, cellPadding: 3 },
                headStyles: { fillColor: [41, 128, 185], textColor: 255 }
            });
            
            doc.save(`lista_precios_${new Date().toISOString().split('T')[0]}.pdf`);
            mostrarToast("Lista de precios generada en PDF");
            
        } catch (error) {
            mostrarToast("Error al generar PDF: " + error.message, "error");
        }
    }
}

// ===== FUNCIONES EXISTENTES (MANTENIDAS) ===== //
function actualizarLista() {
    const tbody = document.querySelector('#listaProductos tbody');
    tbody.innerHTML = '';

    const productosOrdenados = [...productos].sort((a, b) => a.nombre.localeCompare(b.nombre));
    
    productosOrdenados.forEach((producto, index) => {
        const originalIndex = productos.findIndex(p => p.nombre === producto.nombre);
        const inventarioBajo = producto.unidadesExistentes <= 5;
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${producto.nombre}</td>
            <td>${producto.descripcion}</td>
            <td class="${inventarioBajo ? 'inventario-bajo' : ''}">${producto.unidadesExistentes}</td>
            <td>
                <div class="ajuste-inventario">
                    <button onclick="ajustarInventario(${originalIndex}, 'sumar')">+</button>
                    <button onclick="ajustarInventario(${originalIndex}, 'restar')">-</button>
                </div>
            </td>
            <td>$${producto.precioUnitarioDolar.toFixed(2)}</td>
            <td>Bs${producto.precioUnitarioBolivar.toFixed(2)}</td>
            <td>
                <button class="editar" onclick="editarProducto(${originalIndex})">Editar</button>
                <button class="imprimir" onclick="imprimirTicket(${originalIndex})">Imprimir</button>
                <button class="eliminar" onclick="eliminarProducto(${originalIndex})">Eliminar</button>
            </td>
        `;
        tbody.appendChild(row);
    });

    // Configurar copiado en móviles
    if (esDispositivoMovil()) {
        document.querySelectorAll('#listaProductos td').forEach(td => {
            td.style.cursor = 'pointer';
            td.addEventListener('click', function() {
                copiarAlPortapeles(this.textContent.trim());
            });
        });
    }
}

function mostrarResultados(precioUnitarioDolar, precioUnitarioBolivar) {
    document.getElementById('precioUnitario').innerHTML = 
        `<strong>Precio unitario:</strong> $${precioUnitarioDolar.toFixed(2)} / Bs${precioUnitarioBolivar.toFixed(2)}`;
}

function reiniciarCalculadora() {
    document.getElementById('producto').value = '';
    document.getElementById('costo').value = '';
    document.getElementById('ganancia').value = '';
    document.getElementById('unidadesPorCaja').value = '';
    document.getElementById('unidadesExistentes').value = '';
    document.getElementById('descripcion').selectedIndex = 0;
}

function validarTasaBCV(tasa) {
    if (isNaN(tasa) || tasa <= 0) {
        mostrarToast("Ingrese una tasa BCV válida (mayor a cero)", "error");
        return false;
    }
    return true;
}

function validarCamposNumericos(costo, ganancia, unidades) {
    if (isNaN(costo) || costo <= 0 || isNaN(ganancia) || ganancia <= 0 || isNaN(unidades) || unidades <= 0) {
        mostrarToast("Complete todos los campos con valores válidos (mayores a cero)", "error");
        return false;
    }
    return true;
}

function validarCamposTexto(nombre, descripcion) {
    if (!nombre || !descripcion) {
        mostrarToast("Complete todos los campos", "error");
        return false;
    }
    return true;
}

function productoExiste(nombre) {
    return productos.some(p => p.nombre.toLowerCase() === nombre.toLowerCase());
}

function mostrarToast(mensaje, tipo = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${tipo}`;
    toast.textContent = mensaje;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function calcularProducto(nombre, descripcion, costo, ganancia, unidadesPorCaja, tasaBCV, unidadesExistentes = 0) {
    const gananciaDecimal = ganancia / 100;
    const precioDolar = costo / (1 - gananciaDecimal);
    const precioBolivares = precioDolar * tasaBCV;

    return {
        nombre,
        descripcion,
        costo,
        ganancia: gananciaDecimal,
        unidadesPorCaja,
        unidadesExistentes: unidadesExistentes || 0,
        precioMayorDolar: precioDolar,
        precioMayorBolivar: precioBolivares,
        precioUnitarioDolar: precioDolar / unidadesPorCaja,
        precioUnitarioBolivar: precioBolivares / unidadesPorCaja,
        fechaActualizacion: new Date().toISOString()
    };
}

function guardarProductoEnLista(producto) {
    productos.push(producto);
    localStorage.setItem('productos', JSON.stringify(productos));
    actualizarLista();
    reiniciarCalculadora();
    mostrarToast("Producto guardado exitosamente");
}

function actualizarTasaBCV() {
    const nuevaTasa = parseFloat(document.getElementById('tasaBCV').value);
    
    if (!validarTasaBCV(nuevaTasa)) return;

    tasaBCVGuardada = nuevaTasa;
    localStorage.setItem('tasaBCV', tasaBCVGuardada);
    
    if (productos.length > 0) {
        actualizarPreciosConNuevaTasa(nuevaTasa);
        actualizarLista();
        mostrarToast(`Tasa BCV actualizada a: ${nuevaTasa}\n${productos.length} productos recalculados.`);
    } else {
        mostrarToast("Tasa BCV actualizada (no hay productos para recalcular)");
    }
}

function actualizarPreciosConNuevaTasa(nuevaTasa) {
    productos.forEach(producto => {
        producto.precioMayorBolivar = producto.precioMayorDolar * nuevaTasa;
        producto.precioUnitarioBolivar = producto.precioUnitarioDolar * nuevaTasa;
    });
    localStorage.setItem('productos', JSON.stringify(productos));
}

function ajustarInventario(index, operacion) {
    const producto = productos[index];
    const cantidad = parseInt(prompt(`Ingrese la cantidad a ${operacion === 'sumar' ? 'sumar' : 'restar'}:`, "1")) || 0;
    
    if (cantidad <= 0) {
        mostrarToast("Ingrese una cantidad válida", "error");
        return;
    }

    if (operacion === 'restar') {
        if (producto.unidadesExistentes < cantidad) {
            mostrarToast("No hay suficientes unidades en inventario", "error");
            return;
        }
        
        const hoy = new Date();
        const venta = {
            fecha: hoy.toLocaleDateString(),
            hora: hoy.toLocaleTimeString(),
            producto: producto.nombre,
            descripcion: producto.descripcion,
            cantidad: cantidad,
            precioUnitarioDolar: producto.precioUnitarioDolar,
            precioUnitarioBolivar: producto.precioUnitarioBolivar,
            totalDolar: cantidad * producto.precioUnitarioDolar,
            totalBolivar: cantidad * producto.precioUnitarioBolivar
        };
        
        ventasDiarias.push(venta);
        localStorage.setItem('ventasDiarias', JSON.stringify(ventasDiarias));
        mostrarToast(`Venta registrada: ${cantidad} ${producto.nombre} - Total: $${venta.totalDolar.toFixed(2)} / Bs${venta.totalBolivar.toFixed(2)}`);
    }

    producto.unidadesExistentes = operacion === 'sumar' ? 
        producto.unidadesExistentes + cantidad : 
        producto.unidadesExistentes - cantidad;
    
    localStorage.setItem('productos', JSON.stringify(productos));
    actualizarLista();
}

function editarProducto(index) {
    const producto = productos[index];
    
    document.getElementById('producto').value = producto.nombre;
    document.getElementById('descripcion').value = producto.descripcion;
    document.getElementById('costo').value = producto.costo;
    document.getElementById('ganancia').value = producto.ganancia * 100;
    document.getElementById('unidadesPorCaja').value = producto.unidadesPorCaja;
    document.getElementById('unidadesExistentes').value = producto.unidadesExistentes;
    
    const tasaBCV = parseFloat(document.getElementById('tasaBCV').value) || tasaBCVGuardada;
    const precioUnitarioDolar = producto.precioUnitarioDolar;
    const precioUnitarioBolivar = precioUnitarioDolar * tasaBCV;
    
    mostrarResultados(precioUnitarioDolar, precioUnitarioBolivar);
    
    productos.splice(index, 1);
    localStorage.setItem('productos', JSON.stringify(productos));
    
    mostrarToast(`Editando producto: ${producto.nombre}`);
}

function eliminarProducto(index) {
    const producto = productos[index];
    if (confirm(`¿Estás seguro de eliminar "${producto.nombre}"?`)) {
        productos.splice(index, 1);
        localStorage.setItem('productos', JSON.stringify(productos));
        actualizarLista();
        mostrarToast(`Producto eliminado: ${producto.nombre}`);
    }
}

function imprimirTicket(index) {
    const producto = productos[index];
    const ventana = window.open('', '_blank');
    ventana.document.write(`
        <html>
            <head>
                <title>Ticket - ${producto.nombre}</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    .ticket { max-width: 300px; margin: 0 auto; border: 1px dashed #ccc; padding: 15px; }
                    .header { text-align: center; margin-bottom: 10px; }
                    .producto { font-weight: bold; font-size: 18px; }
                    .precios { margin-top: 10px; }
                    .fecha { font-size: 12px; text-align: right; margin-top: 15px; }
                </style>
            </head>
            <body>
                <div class="ticket">
                    <div class="header">
                        <h3>${nombreEstablecimiento || 'Mi Negocio'}</h3>
                    </div>
                    <div class="producto">${producto.nombre}</div>
                    <div>${producto.descripcion}</div>
                    <div class="precios">
                        <div>Precio: $${producto.precioUnitarioDolar.toFixed(2)}</div>
                        <div>Precio: Bs${producto.precioUnitarioBolivar.toFixed(2)}</div>
                    </div>
                    <div class="fecha">${new Date().toLocaleString()}</div>
                </div>
                <script>window.print();</script>
            </body>
        </html>
    `);
    ventana.document.close();
}

function generarReporteDiario() {
    if (ventasDiarias.length === 0) {
        mostrarToast("No hay ventas registradas", "warning");
        return;
    }

    const fechaReporte = prompt("Ingrese la fecha del reporte (DD/MM/AAAA):", new Date().toLocaleDateString());
    if (!fechaReporte) return;

    const ventasDelDia = ventasDiarias.filter(venta => venta.fecha === fechaReporte);
    if (ventasDelDia.length === 0) {
        mostrarToast(`No hay ventas registradas para el ${fechaReporte}`, "warning");
        return;
    }

    // Para móviles: copiar al portapapeles
    if (esDispositivoMovil()) {
        const textoReporte = generarTextoReporte(ventasDelDia, fechaReporte);
        if (confirm("¿Copiar el reporte al portapapeles?")) {
            copiarAlPortapeles(textoReporte);
        }
        return;
    }

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        doc.setFontSize(16);
        doc.text(`Reporte de Ventas Diario - ${nombreEstablecimiento || 'Mi Negocio'}`, 105, 15, { align: 'center' });
        doc.setFontSize(12);
        doc.text(`Fecha: ${fechaReporte}`, 105, 22, { align: 'center' });
        
        const totalDolar = ventasDelDia.reduce((sum, venta) => sum + venta.totalDolar, 0);
        const totalBolivar = ventasDelDia.reduce((sum, venta) => sum + venta.totalBolivar, 0);
        
        doc.autoTable({
            startY: 30,
            head: [
                ['Producto', 'Descripción', 'Cantidad', 'P.Unit ($)', 'P.Unit (Bs)', 'Total ($)', 'Total (Bs)']
            ],
            body: ventasDelDia.map(venta => [
                venta.producto,
                venta.descripcion,
                venta.cantidad,
                `$${venta.precioUnitarioDolar.toFixed(2)}`,
                `Bs${venta.precioUnitarioBolivar.toFixed(2)}`,
                `$${venta.totalDolar.toFixed(2)}`,
                `Bs${venta.totalBolivar.toFixed(2)}`
            ]),
            margin: { horizontal: 10 },
            styles: { 
                fontSize: 8, 
                cellPadding: 3,
                overflow: 'linebreak'
            },
            headStyles: { 
                fillColor: [41, 128, 185],
                textColor: 255,
                fontSize: 9
            },
            columnStyles: {
                0: { cellWidth: 30 },
                1: { cellWidth: 25 },
                2: { cellWidth: 15 },
                3: { cellWidth: 20 },
                4: { cellWidth: 20 },
                5: { cellWidth: 20 },
                6: { cellWidth: 20 }
            }
        });
        
        const finalY = doc.autoTable.previous.finalY + 10;
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.setFont(undefined, 'bold');
        doc.text(`Total General en Dólares: $${totalDolar.toFixed(2)}`, 14, finalY);
        doc.text(`Total General en Bolívares: Bs${totalBolivar.toFixed(2)}`, 14, finalY + 10);
        doc.text(`Tasa BCV utilizada: ${tasaBCVGuardada}`, 14, finalY + 20);
        
        const nombreArchivo = `ventas_${fechaReporte.replace(/\//g, '-')}.pdf`;
        doc.save(nombreArchivo);
        mostrarToast(`Reporte del ${fechaReporte} generado con éxito`);
        
    } catch (error) {
        mostrarToast("Error al generar reporte: " + error.message, "error");
    }
}

function generarTextoReporte(ventas, fecha) {
    let texto = `Reporte de Ventas - ${nombreEstablecimiento || 'Mi Negocio'}\n`;
    texto += `Fecha: ${fecha}\n\n`;
    
    texto += "Producto\tCant.\tP.Unit($)\tTotal($)\tTotal(Bs)\n";
    
    ventas.forEach(venta => {
        texto += `${venta.producto}\t${venta.cantidad}\t$${venta.precioUnitarioDolar.toFixed(2)}\t$${venta.totalDolar.toFixed(2)}\tBs${venta.totalBolivar.toFixed(2)}\n`;
    });
    
    const totalDolar = ventas.reduce((sum, venta) => sum + venta.totalDolar, 0);
    const totalBolivar = ventas.reduce((sum, venta) => sum + venta.totalBolivar, 0);
    
    texto += `\nTOTAL DÓLARES: $${totalDolar.toFixed(2)}\n`;
    texto += `TOTAL BOLÍVARES: Bs${totalBolivar.toFixed(2)}\n`;
    texto += `Tasa BCV: ${tasaBCVGuardada}`;
    
    return texto;
}

function generarRespaldoCompleto() {
    if (productos.length === 0 && ventasDiarias.length === 0) {
        mostrarToast("No hay datos para respaldar", "warning");
        return;
    }

    // Para móviles: generar texto copiable
    if (esDispositivoMovil()) {
        const textoRespaldo = generarTextoRespaldo();
        if (confirm("¿Copiar respaldo al portapapeles?")) {
            copiarAlPortapeles(textoRespaldo);
        }
        return;
    }

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
            orientation: "portrait",
            unit: "mm",
            format: "a4"
        });

        const configMovil = {
            fontSize: 7,
            cellPadding: 2,
            margin: { horizontal: 5 },
            pageBreak: 'auto',
            rowPageBreak: 'avoid'
        };

        doc.setFontSize(14);
        doc.text(`Respaldo - ${nombreEstablecimiento || 'Mi Negocio'}`, 105, 15, { align: 'center' });
        doc.setFontSize(10);
        doc.text(`Generado: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, 105, 22, { align: 'center' });
        doc.text(`Tasa BCV: ${tasaBCVGuardada} | Productos: ${productos.length}`, 105, 28, { align: 'center' });

        const columns = [
            { header: 'Producto', dataKey: 'nombre' },
            { header: 'Unid/Caja', dataKey: 'unidades' },
            { header: 'Costo$', dataKey: 'costo' },
            { header: 'Gan%', dataKey: 'ganancia' },
            { header: 'P.Venta$', dataKey: 'pVentaDolar' },
            { header: 'P.VentaBs', dataKey: 'pVentaBs' }
        ];
        
        const rows = productos.map(producto => ({
            nombre: producto.nombre,
            unidades: producto.unidadesPorCaja,
            costo: `$${producto.costo.toFixed(2)}`,
            ganancia: `${(producto.ganancia * 100).toFixed(0)}%`,
            pVentaDolar: `$${producto.precioUnitarioDolar.toFixed(2)}`,
            pVentaBs: `Bs${producto.precioUnitarioBolivar.toFixed(2)}`
        }));

        doc.autoTable({
            startY: 35,
            head: [columns.map(col => col.header)],
            body: rows.map(row => columns.map(col => row[col.dataKey])),
            styles: configMovil,
            headStyles: { 
                fillColor: [41, 128, 185],
                textColor: 255,
                fontSize: 7
            },
            columnStyles: {
                0: { cellWidth: 30 },
                1: { cellWidth: 20 },
                2: { cellWidth: 15 },
                3: { cellWidth: 20 },
                4: { cellWidth: 25 }
            }
        });

        doc.save(`respaldo_${new Date().toISOString().slice(0,10)}.pdf`);
        mostrarToast("Respaldo generado en PDF");
        
    } catch (error) {
        console.error("Error generando PDF:", error);
        mostrarToast(`Error: ${error.message}`, "error");
    }
}

function generarTextoRespaldo() {
    let texto = `RESPALDO COMPLETO - ${nombreEstablecimiento || 'Mi Negocio'}\n`;
    texto += `Fecha: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}\n`;
    texto += `Tasa BCV: ${tasaBCVGuardada}\n\n`;
    
    texto += "=== PRODUCTOS ===\n";
    const productosOrdenados = [...productos].sort((a, b) => a.nombre.localeCompare(b.nombre));
    productosOrdenados.forEach(producto => {
        texto += `${producto.nombre} | ${producto.descripcion}\n`;
        texto += `Costo: $${producto.costo.toFixed(2)} | Ganancia: ${(producto.ganancia * 100).toFixed(0)}%\n`;
        texto += `P.Venta: $${producto.precioUnitarioDolar.toFixed(2)} / Bs${producto.precioUnitarioBolivar.toFixed(2)}\n`;
        texto += `Unidades: ${producto.unidadesPorCaja} | Existencia: ${producto.unidadesExistentes}\n\n`;
    });
    
    if (ventasDiarias.length > 0) {
        texto += "\n=== VENTAS ===\n";
        const fechasVentas = [...new Set(ventasDiarias.map(v => v.fecha))];
        
        fechasVentas.forEach(fecha => {
            texto += `\nFecha: ${fecha}\n`;
            const ventasDia = ventasDiarias.filter(v => v.fecha === fecha);
            
            ventasDia.forEach(venta => {
                texto += `${venta.hora} - ${venta.producto}: ${venta.cantidad} x $${venta.precioUnitarioDolar.toFixed(2)} = $${venta.totalDolar.toFixed(2)}\n`;
            });
            
            const totalDiaDolar = ventasDia.reduce((sum, v) => sum + v.totalDolar, 0);
            const totalDiaBs = ventasDia.reduce((sum, v) => sum + v.totalBolivar, 0);
            texto += `TOTAL: $${totalDiaDolar.toFixed(2)} / Bs${totalDiaBs.toFixed(2)}\n`;
        });
    }
    
    return texto;
}

function buscarProducto() {
    const termino = document.getElementById('buscar').value.trim().toLowerCase();
    if (!termino) {
        actualizarLista();
        return;
    }

    const resultados = productos.filter(p => 
        p.nombre.toLowerCase().includes(termino) || 
        p.descripcion.toLowerCase().includes(termino)
    );

    const tbody = document.querySelector('#listaProductos tbody');
    tbody.innerHTML = '';

    resultados.forEach((producto, index) => {
        const originalIndex = productos.findIndex(p => p.nombre === producto.nombre);
        const inventarioBajo = producto.unidadesExistentes <= 5;
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${producto.nombre}</td>
            <td>${producto.descripcion}</td>
            <td class="${inventarioBajo ? 'inventario-bajo' : ''}">${producto.unidadesExistentes}</td>
            <td>
                <div class="ajuste-inventario">
                    <button onclick="ajustarInventario(${originalIndex}, 'sumar')">+</button>
                    <button onclick="ajustarInventario(${originalIndex}, 'restar')">-</button>
                </div>
            </td>
            <td>$${producto.precioUnitarioDolar.toFixed(2)}</td>
            <td>Bs${producto.precioUnitarioBolivar.toFixed(2)}</td>
            <td>
                <button class="editar" onclick="editarProducto(${originalIndex})">Editar</button>
                <button class="imprimir" onclick="imprimirTicket(${originalIndex})">Imprimir</button>
                <button class="eliminar" onclick="eliminarProducto(${originalIndex})">Eliminar</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function mostrarListaCostos() {
    const container = document.getElementById('listaCostosContainer');
    const lista = document.getElementById('listaCostos');
    
    if (productos.length === 0) {
        mostrarToast("No hay productos registrados", "warning");
        container.style.display = 'none';
        return;
    }

    if (container.style.display === 'none' || container.style.display === '') {
        container.style.display = 'block';
        actualizarListaCostos();
    } else {
        container.style.display = 'none';
    }
}

function actualizarListaCostos() {
    const lista = document.getElementById('listaCostos');
    lista.innerHTML = '';

    const productosOrdenados = [...productos].sort((a, b) => b.costo - a.costo);
    
    productosOrdenados.forEach(producto => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span>${producto.nombre} (${producto.descripcion})</span>
            <span>$${producto.costo.toFixed(2)} / Bs${(producto.costo * tasaBCVGuardada).toFixed(2)}</span>
        `;
        lista.appendChild(li);
    });
}

function generarPDFCostos() {
    if (productos.length === 0) {
        mostrarToast("No hay productos para generar el PDF", "warning");
        return;
    }

    if (esDispositivoMovil()) {
        if (!confirm("Estás en un dispositivo móvil. La generación de PDF puede fallar. ¿Continuar?")) {
            return;
        }
    }

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        doc.setFontSize(16);
        doc.text(`Lista de Costos - ${nombreEstablecimiento || 'Mi Negocio'}`, 105, 15, { align: 'center' });
        doc.setFontSize(10);
        doc.text(`Fecha: ${new Date().toLocaleDateString()} | Tasa BCV: ${tasaBCVGuardada}`, 105, 22, { align: 'center' });
        
        const columns = [
            { header: 'Producto', dataKey: 'nombre' },
            { header: 'Descripción', dataKey: 'descripcion' },
            { header: 'Costo ($)', dataKey: 'costoDolar' },
            { header: 'Costo (Bs)', dataKey: 'costoBolivar' }
        ];
        
        const rows = productos.map(producto => ({
            nombre: producto.nombre,
            descripcion: producto.descripcion,
            costoDolar: `$${producto.costo.toFixed(2)}`,
            costoBolivar: `Bs${(producto.costo * tasaBCVGuardada).toFixed(2)}`
        }));
        
        doc.autoTable({
            startY: 30,
            head: [columns.map(col => col.header)],
            body: rows.map(row => columns.map(col => row[col.dataKey])),
            margin: { horizontal: 10 },
            styles: { fontSize: 8, cellPadding: 3 },
            headStyles: { fillColor: [41, 128, 185], textColor: 255 }
        });
        
        if (esDispositivoMovil()) {
            const pdfData = doc.output('datauristring');
            const nuevaVentana = window.open();
            nuevaVentana.document.write(`<iframe width='100%' height='100%' src='${pdfData}'></iframe>`);
            mostrarToast("PDF generado. Abriendo en nueva ventana...");
        } else {
            doc.save(`lista_costos_${new Date().toISOString().split('T')[0]}.pdf`);
            mostrarToast("Lista de costos generada en PDF");
        }
    } catch (error) {
        mostrarToast("Error al generar PDF: " + error.message, "error");
    }
}

function limpiarLista() {
    if (confirm("¿Estás seguro de limpiar toda la lista de productos? Esta acción no se puede deshacer.")) {
        productos = [];
        localStorage.setItem('productos', JSON.stringify(productos));
        actualizarLista();
        mostrarToast("Todos los productos han sido eliminados");
    }
}

function limpiarVentasAntiguas() {
    if (ventasDiarias.length === 0) return;
    
    const fechasUnicas = [...new Set(ventasDiarias.map(v => v.fecha))];
    fechasUnicas.sort((a, b) => new Date(b) - new Date(a));
    
    if (fechasUnicas.length > 4) {
        const fechasAEliminar = fechasUnicas.slice(4);
        ventasDiarias = ventasDiarias.filter(v => !fechasAEliminar.includes(v.fecha));
        localStorage.setItem('ventasDiarias', JSON.stringify(ventasDiarias));
    }
}

// ===== INICIALIZACIÓN ===== //
document.addEventListener('DOMContentLoaded', function() {
    verificarActualizacion();
    cargarDatosIniciales();
    
    // Configurar eventos de inactividad
    reiniciarTemporizadorInactividad();
    ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(evento => {
        document.addEventListener(evento, reiniciarTemporizadorInactividad);
    });

    // Limpiar ventas antiguas automáticamente
    limpiarVentasAntiguas();
});
