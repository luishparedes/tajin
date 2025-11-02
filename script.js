// ===== CONFIGURACIÓN FIREBASE SEGURA =====
// La configuración está en config.js (archivo privado)

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const database = firebase.database();

// ===== VARIABLES GLOBALES =====
let productos = JSON.parse(localStorage.getItem('productos')) || [];
let nombreEstablecimiento = localStorage.getItem('nombreEstablecimiento') || '';
let tasaBCVGuardada = parseFloat(localStorage.getItem('tasaBCV')) || 0;
let ventasDiarias = JSON.parse(localStorage.getItem('ventasDiarias')) || [];
let carrito = JSON.parse(localStorage.getItem('carrito')) || [];
let métodoPagoSeleccionado = null;
let detallesPago = {};
let productoEditando = null;
let productosFiltrados = [];

// Variables del sistema de usuarios
let currentUser = null;
let userData = null;
const ADMIN_EMAIL = "luishparedes94@gmail.com";

// === NUEVAS VARIABLES PARA ESCÁNER ===
let tiempoUltimaTecla = 0;
let bufferEscaneo = '';

// ===== SISTEMA DE AUTENTICACIÓN MEJORADO =====

// Verificar estado de autenticación
auth.onAuthStateChanged((user) => {
    if (user) {
        currentUser = user;
        loadUserData(user.uid);
    } else {
        showAuthScreen();
    }
});

// Cargar datos del usuario
function loadUserData(userId) {
    database.ref('users/' + userId).once('value')
        .then((snapshot) => {
            userData = snapshot.val();
            if (userData) {
                initializeUserSession();
            } else {
                createUserData(userId);
            }
        })
        .catch((error) => {
            console.error('Error loading user data:', error);
            showToast('Error al cargar datos del usuario', 'error');
        });
}

// Crear datos de usuario (CORREGIDO - NOMBRE REAL)
function createUserData(userId) {
    const userEmail = currentUser.email;
    const isAdmin = userEmail === ADMIN_EMAIL;
    
    // Obtener el nombre real del formulario de registro
    let userName = 'Usuario';
    const registerNameInput = document.getElementById('registerName');
    
    if (registerNameInput && registerNameInput.value.trim() !== '') {
        userName = registerNameInput.value.trim();
    } else if (currentUser.displayName) {
        userName = currentUser.displayName;
    } else {
        // Extraer nombre del email como última opción
        userName = userEmail.split('@')[0];
        userName = userName.charAt(0).toUpperCase() + userName.slice(1);
    }
    
    userData = {
        name: userName,
        email: userEmail,
        plan: isAdmin ? 'admin' : 'free',
        productsCount: 0,
        maxProducts: isAdmin ? 1000 : 3,
        devices: [getDeviceId()],
        maxDevices: 1,
        createdAt: firebase.database.ServerValue.TIMESTAMP,
        lastLogin: firebase.database.ServerValue.TIMESTAMP
    };
    
    database.ref('users/' + userId).set(userData)
        .then(() => {
            initializeUserSession();
        })
        .catch((error) => {
            console.error('Error creating user data:', error);
            showToast('Error al crear datos de usuario', 'error');
        });
}

// Inicializar sesión de usuario
function initializeUserSession() {
    if (userData.plan === 'admin') {
        showAdminPanel();
    } else {
        const currentDeviceId = getDeviceId();
        const userDevices = userData.devices || [];
        const maxDevices = userData.maxDevices || 1;
        
        if (userDevices.length === 0 || !userDevices.includes(currentDeviceId)) {
            showToast('Dispositivo no autorizado. Contacta al administrador.', 'error');
            logout();
            return;
        }
        
        if (userDevices.length > maxDevices) {
            const allowedDevices = userDevices.slice(0, maxDevices);
            database.ref('users/' + currentUser.uid + '/devices').set(allowedDevices);
        }
        
        database.ref('users/' + currentUser.uid + '/lastLogin').set(firebase.database.ServerValue.TIMESTAMP);
        
        showMainApp();
        updateProductCount();
        checkProductLimit();
    }
}

// Obtener ID único del dispositivo
function getDeviceId() {
    let deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
        deviceId = 'device_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
        localStorage.setItem('deviceId', deviceId);
    }
    return deviceId;
}

// Mostrar pantalla de autenticación
function showAuthScreen() {
    document.getElementById('authContainer').style.display = 'flex';
    document.getElementById('mainApp').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'none';
    showLoginForm();
}

// Mostrar formulario de login
function showLoginForm() {
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('registerForm').style.display = 'none';
}

// Mostrar formulario de registro
function showRegisterForm() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'block';
}

// Mostrar aplicación principal (CORREGIDO - NOMBRE REAL)
function showMainApp() {
    document.getElementById('authContainer').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    document.getElementById('adminPanel').style.display = 'none';
    
    // MOSTRAR NOMBRE REAL DEL USUARIO
    const userName = userData.name || 'Usuario';
    document.getElementById('userWelcome').textContent = `Bienvenido, ${userName}`;
    document.getElementById('userPlan').textContent = userData.plan.toUpperCase();
    document.getElementById('userPlan').className = `plan-badge plan-${userData.plan}`;
    
    updateProductCount();
}

// Mostrar panel administrativo
function showAdminPanel() {
    document.getElementById('authContainer').style.display = 'none';
    document.getElementById('mainApp').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'block';
    
    loadUsersList();
}

// ===== FUNCIONES DE AUTENTICACIÓN =====

// Toggle para mostrar/ocultar contraseña
function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    const toggle = input.parentElement.querySelector('.toggle-password');
    
    if (input.type === 'password') {
        input.type = 'text';
        toggle.textContent = '🙈';
    } else {
        input.type = 'password';
        toggle.textContent = '👁️';
    }
}

// Registrar usuario
function registerUser() {
    const name = document.getElementById('registerName').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value;
    
    if (!name || !email || !password) {
        showToast('Complete todos los campos', 'error');
        return;
    }
    
    if (password.length < 6) {
        showToast('La contraseña debe tener al menos 6 caracteres', 'error');
        return;
    }
    
    auth.createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
            return userCredential.user.updateProfile({
                displayName: name
            });
        })
        .then(() => {
            showToast(`Cuenta creada exitosamente para ${name}`, 'success');
            showLoginForm();
            
            // Limpiar formulario
            document.getElementById('registerName').value = '';
            document.getElementById('registerEmail').value = '';
            document.getElementById('registerPassword').value = '';
        })
        .catch((error) => {
            console.error('Error en registro:', error);
            showToast(getAuthErrorMessage(error), 'error');
        });
}

// Iniciar sesión
function loginUser() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    
    if (!email || !password) {
        showToast('Complete todos los campos', 'error');
        return;
    }
    
    auth.signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            showToast('Sesión iniciada correctamente', 'success');
        })
        .catch((error) => {
            console.error('Error en login:', error);
            showToast(getAuthErrorMessage(error), 'error');
        });
}

// Cerrar sesión
function logout() {
    auth.signOut()
        .then(() => {
            currentUser = null;
            userData = null;
            showToast('Sesión cerrada', 'success');
        })
        .catch((error) => {
            console.error('Error al cerrar sesión:', error);
        });
}

// Obtener mensaje de error de autenticación
function getAuthErrorMessage(error) {
    switch (error.code) {
        case 'auth/email-already-in-use':
            return 'El correo ya está registrado';
        case 'auth/invalid-email':
            return 'Correo electrónico inválido';
        case 'auth/weak-password':
            return 'La contraseña es muy débil';
        case 'auth/user-not-found':
            return 'Usuario no encontrado';
        case 'auth/wrong-password':
            return 'Contraseña incorrecta';
        default:
            return 'Error de autenticación';
    }
}

// ===== FUNCIONES ADMINISTRATIVAS =====

// Cargar lista de usuarios
function loadUsersList() {
    database.ref('users').once('value')
        .then((snapshot) => {
            const users = snapshot.val();
            const tbody = document.getElementById('usersTableBody');
            tbody.innerHTML = '';
            
            for (const userId in users) {
                if (users[userId].email === ADMIN_EMAIL) continue;
                
                const user = users[userId];
                const row = document.createElement('tr');
                
                row.innerHTML = `
                    <td>${user.name}</td>
                    <td>${user.email}</td>
                    <td>
                        <span class="plan-badge plan-${user.plan}">${user.plan.toUpperCase()}</span>
                    </td>
                    <td>${user.productsCount || 0}/${user.maxProducts || 3}</td>
                    <td>${user.devices ? user.devices.length : 1}/${user.maxDevices || 1}</td>
                    <td>
                        <button onclick="toggleUserPlan('${userId}', '${user.plan}')" class="admin-btn ${user.plan === 'pro' ? 'btn-free' : 'btn-pro'}">
                            ${user.plan === 'pro' ? 'Hacer FREE' : 'Hacer PRO'}
                        </button>
                        <button onclick="manageUserLimit('${userId}')" class="admin-btn btn-limit">Límite Productos</button>
                        <button onclick="manageUserDevice('${userId}')" class="admin-btn btn-device">Dispositivos</button>
                        <button onclick="deleteUser('${userId}')" class="admin-btn btn-delete">Eliminar</button>
                    </td>
                `;
                
                tbody.appendChild(row);
            }
        })
        .catch((error) => {
            console.error('Error loading users:', error);
            showToast('Error al cargar usuarios', 'error');
        });
}

// Cambiar plan de usuario
function toggleUserPlan(userId, currentPlan) {
    const newPlan = currentPlan === 'pro' ? 'free' : 'pro';
    const maxProducts = newPlan === 'pro' ? 100 : 3;
    
    database.ref('users/' + userId).update({
        plan: newPlan,
        maxProducts: maxProducts
    })
    .then(() => {
        showToast(`Usuario cambiado a plan ${newPlan.toUpperCase()}`, 'success');
        loadUsersList();
    })
    .catch((error) => {
        console.error('Error updating user plan:', error);
        showToast('Error al actualizar plan', 'error');
    });
}

// Gestionar límite de productos del usuario
function manageUserLimit(userId) {
    database.ref('users/' + userId).once('value')
        .then((snapshot) => {
            const user = snapshot.val();
            const currentLimit = user.maxProducts || (user.plan === 'pro' ? 100 : 3);
            
            const newLimit = prompt(`Límite actual de productos: ${currentLimit}\n\nIngrese el nuevo límite de productos:`, currentLimit);
            
            if (newLimit === null) return;
            
            const limit = parseInt(newLimit);
            if (isNaN(limit) || limit < 1) {
                showToast('Ingrese un número válido', 'error');
                return;
            }
            
            return database.ref('users/' + userId).update({
                maxProducts: limit
            });
        })
        .then(() => {
            showToast('Límite de productos actualizado correctamente', 'success');
            loadUsersList();
        })
        .catch((error) => {
            console.error('Error updating product limit:', error);
            showToast('Error al actualizar límite', 'error');
        });
}

// Gestionar dispositivos del usuario
function manageUserDevice(userId) {
    database.ref('users/' + userId).once('value')
        .then((snapshot) => {
            const user = snapshot.val();
            const currentDevices = user.devices || [];
            const currentMaxDevices = user.maxDevices || 1;
            
            const action = prompt(
                `Dispositivos actuales: ${currentDevices.length}\nLímite actual: ${currentMaxDevices}\n\nOpciones:\n1. Ingrese un número para cambiar el límite de dispositivos\n2. Ingrese un ID de dispositivo para autorizarlo\n3. Deje vacío para autorizar este dispositivo`,
                currentMaxDevices
            );
            
            if (action === null) return;
            
            if (action === '') {
                // Autorizar este dispositivo
                const deviceIdToAdd = getDeviceId();
                let devices = [...currentDevices];
                
                if (!devices.includes(deviceIdToAdd)) {
                    devices.push(deviceIdToAdd);
                }
                
                return database.ref('users/' + userId).update({
                    devices: devices
                });
            } else if (!isNaN(action)) {
                // Cambiar límite de dispositivos
                const maxDevices = parseInt(action);
                if (maxDevices < 1) {
                    showToast('El límite debe ser al menos 1', 'error');
                    return;
                }
                
                let devices = [...currentDevices];
                if (devices.length > maxDevices) {
                    devices = devices.slice(0, maxDevices);
                }
                
                return database.ref('users/' + userId).update({
                    maxDevices: maxDevices,
                    devices: devices
                });
            } else {
                // Autorizar dispositivo específico
                const deviceIdToAdd = action.trim();
                let devices = [...currentDevices];
                
                if (!devices.includes(deviceIdToAdd)) {
                    devices.push(deviceIdToAdd);
                }
                
                return database.ref('users/' + userId).update({
                    devices: devices
                });
            }
        })
        .then(() => {
            showToast('Configuración de dispositivos actualizada', 'success');
            loadUsersList();
        })
        .catch((error) => {
            console.error('Error managing devices:', error);
            showToast('Error al gestionar dispositivos', 'error');
        });
}

// Eliminar usuario
function deleteUser(userId) {
    if (confirm('¿Está seguro de eliminar este usuario? Esta acción no se puede deshacer.')) {
        database.ref('users/' + userId).remove()
            .then(() => {
                showToast('Usuario eliminado correctamente', 'success');
                loadUsersList();
            })
            .catch((error) => {
                console.error('Error deleting user:', error);
                showToast('Error al eliminar usuario', 'error');
            });
    }
}

// ===== SISTEMA DE LÍMITES DE PRODUCTOS =====

// Verificar límite de productos
function checkProductLimit() {
    if (!userData) return;
    
    const productCount = productos.length;
    const maxProducts = userData.maxProducts || (userData.plan === 'pro' ? 100 : 3);
    const guardarBtn = document.getElementById('guardarProductoBtn');
    const messageDiv = document.getElementById('productLimitMessage');
    
    if (productCount >= maxProducts) {
        guardarBtn.disabled = true;
        
        let message = `Límite de productos alcanzado (${maxProducts}). `;
        if (userData.plan === 'free') {
            message += 'Actualiza a PRO para más productos.';
        } else {
            message += 'Contacta al administrador para aumentar tu límite.';
        }
        
        messageDiv.innerHTML = message;
        messageDiv.style.display = 'block';
    } else {
        guardarBtn.disabled = false;
        messageDiv.style.display = 'none';
    }
}

// Actualizar contador de productos
function updateProductCount() {
    if (userData) {
        const productCount = productos.length;
        const maxProducts = userData.maxProducts || (userData.plan === 'pro' ? 100 : 3);
        
        document.getElementById('productCount').textContent = `Productos: ${productCount}/${maxProducts}`;
        
        // Actualizar en Firebase si el usuario no es admin
        if (userData.plan !== 'admin') {
            database.ref('users/' + currentUser.uid + '/productsCount').set(productCount);
        }
    }
}

// ===== FUNCIONES BÁSICAS (ADAPTADAS) =====

// Inicialización
document.addEventListener('DOMContentLoaded', function() {
    console.log('Calculadora iniciada correctamente');
    cargarDatosIniciales();
    configurarEventos();
    configurarEventosMoviles();
});

function cargarDatosIniciales() {
    const nombreElem = document.getElementById('nombreEstablecimiento');
    const tasaElem = document.getElementById('tasaBCV');
    if (nombreElem) nombreElem.value = nombreEstablecimiento;
    if (tasaElem) tasaElem.value = tasaBCVGuardada || '';
}

function calcularPrecioVenta() {
    const tasaBCV = parseFloat(document.getElementById('tasaBCV').value) || tasaBCVGuardada;
    const costo = parseFloat(document.getElementById('costo').value);
    const ganancia = parseFloat(document.getElementById('ganancia').value);
    const unidadesPorCaja = parseFloat(document.getElementById('unidadesPorCaja').value);

    if (!tasaBCV || tasaBCV <= 0) {
        showToast("Ingrese una tasa BCV válida", 'error');
        return;
    }
    if (!costo || !ganancia || !unidadesPorCaja) {
        showToast("Complete todos los campos requeridos", 'error');
        return;
    }

    const gananciaDecimal = ganancia / 100;
    const precioDolar = costo / (1 - gananciaDecimal);
    const precioBolivares = precioDolar * tasaBCV;
    const precioUnitarioDolar = redondear2Decimales(precioDolar / unidadesPorCaja);
    const precioUnitarioBolivar = redondear2Decimales(precioBolivares / unidadesPorCaja);

    const precioUnitarioElem = document.getElementById('precioUnitario');
    if (precioUnitarioElem) {
        precioUnitarioElem.innerHTML =
            `<strong>Precio unitario:</strong> $${precioUnitarioDolar.toFixed(2)} / Bs${precioUnitarioBolivar.toFixed(2)}`;
    }
}

// ===== GUARDAR / EDITAR PRODUCTOS (CON LÍMITES MEJORADOS) =====
function guardarProducto() {
    // Verificar límite de productos
    if (userData && productos.length >= userData.maxProducts && productoEditando === null) {
        showToast(`Límite de productos alcanzado. Contacta al administrador para aumentar tu límite.`, 'error');
        return;
    }

    const nombre = document.getElementById('producto').value.trim();
    const codigoBarras = document.getElementById('codigoBarras').value.trim();
    const descripcion = document.getElementById('descripcion').value;
    const costo = parseFloat(document.getElementById('costo').value);
    const ganancia = parseFloat(document.getElementById('ganancia').value);
    const unidadesPorCaja = parseFloat(document.getElementById('unidadesPorCaja').value);
    const unidadesExistentesInput = parseFloat(document.getElementById('unidadesExistentes').value) || 0;
    const tasaBCV = parseFloat(document.getElementById('tasaBCV').value) || tasaBCVGuardada;

    if (!nombre || !descripcion) { 
        showToast("Complete el nombre y descripción del producto", 'error'); 
        return; 
    }
    if (!tasaBCV || tasaBCV <= 0) { 
        showToast("Ingrese una tasa BCV válida", 'error'); 
        return; 
    }
    if (!costo || !ganancia || !unidadesPorCaja) { 
        showToast("Complete todos los campos requeridos", 'error'); 
        return; 
    }

    if (codigoBarras && productoEditando === null) {
        const codigoExistente = productos.findIndex(p => 
            p.codigoBarras && p.codigoBarras.toLowerCase() === codigoBarras.toLowerCase()
        );
        if (codigoExistente !== -1) {
            showToast("El código de barras ya existe para otro producto", 'error');
            return;
        }
    }

    let productoExistenteIndex = -1;
    if (productoEditando !== null) {
        productoExistenteIndex = productoEditando;
    } else {
        productoExistenteIndex = productos.findIndex(p => 
            (p.nombre || p.producto || '').toLowerCase() === nombre.toLowerCase()
        );
    }

    const gananciaDecimal = ganancia / 100;
    const precioDolar = costo / (1 - gananciaDecimal);
    const precioBolivares = precioDolar * tasaBCV;
    const precioUnitarioDolar = redondear2Decimales(precioDolar / unidadesPorCaja);
    const precioUnitarioBolivar = redondear2Decimales(precioBolivares / unidadesPorCaja);

    const producto = {
        nombre,
        codigoBarras,
        descripcion,
        costo,
        ganancia: gananciaDecimal,
        unidadesPorCaja,
        unidadesExistentes: unidadesExistentesInput,
        precioMayorDolar: precioDolar,
        precioMayorBolivar: precioBolivares,
        precioUnitarioDolar: precioUnitarioDolar,
        precioUnitarioBolivar: precioUnitarioBolivar,
        fechaActualizacion: new Date().toISOString()
    };

    if (productoExistenteIndex !== -1) {
        productos[productoExistenteIndex] = producto;
        showToast("✓ Producto actualizado exitosamente", 'success');
    } else {
        productos.push(producto);
        showToast("✓ Producto guardado exitosamente", 'success');
        
        // Actualizar contador después de agregar producto
        updateProductCount();
        checkProductLimit();
    }

    localStorage.setItem('productos', JSON.stringify(productos));
    actualizarLista();

    document.getElementById('producto').value = '';
    document.getElementById('codigoBarras').value = '';
    document.getElementById('costo').value = '';
    document.getElementById('ganancia').value = '';
    document.getElementById('unidadesPorCaja').value = '';
    document.getElementById('unidadesExistentes').value = '';
    document.getElementById('descripcion').selectedIndex = 0;
    document.getElementById('precioUnitario').innerHTML = '';

    productoEditando = null;
}

// ===== FUNCIONES EXISTENTES (MANTENER TODAS LAS ANTERIORES) =====

function redondear2Decimales(numero) {
    if (isNaN(numero)) return 0;
    return Math.round((numero + Number.EPSILON) * 100) / 100;
}

function configurarEventos() {
    const buscarInput = document.getElementById('buscar');
    if (buscarInput) {
        buscarInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                buscarProducto();
            }
        });
        
        buscarInput.addEventListener('input', function(e) {
            clearTimeout(this.searchTimeout);
            this.searchTimeout = setTimeout(() => {
                buscarProducto();
            }, 500);
        });
    }

    const codigoInput = document.getElementById('codigoBarrasInput');
    if (codigoInput) {
        codigoInput.addEventListener('keydown', function(e) {
            const tiempoActual = new Date().getTime();
            
            if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                
                if (this.value.trim() && (tiempoActual - tiempoUltimaTecla) < 100) {
                    procesarEscaneo(this.value.trim());
                    this.value = '';
                }
                return;
            }
            
            if (e.key.length === 1) {
                bufferEscaneo += e.key;
                tiempoUltimaTecla = tiempoActual;
                
                clearTimeout(window.bufferTimeout);
                window.bufferTimeout = setTimeout(() => {
                    if (bufferEscaneo.length > 0) {
                        bufferEscaneo = '';
                    }
                }, 60);
            }
        });

        codigoInput.addEventListener('input', function() {
            const termino = this.value.trim().toLowerCase();
            const sugerenciasDiv = document.getElementById('sugerencias');
            if (!sugerenciasDiv) return;
            sugerenciasDiv.innerHTML = '';

            if (termino.length < 2) return;

            const coincidencias = productos.filter(p =>
                (p.nombre || p.producto || '').toLowerCase().includes(termino) ||
                (p.codigoBarras && p.codigoBarras.toLowerCase().includes(termino))
            );

            coincidencias.slice(0, 8).forEach(prod => {
                const opcion = document.createElement('div');
                opcion.textContent = `${(prod.nombre || prod.producto)} (${prod.descripcion || prod.descripcion})`;
                opcion.onclick = function() {
                    document.getElementById('codigoBarrasInput').value = prod.codigoBarras || prod.nombre || prod.producto;
                    procesarEscaneo(document.getElementById('codigoBarrasInput').value);
                    sugerenciasDiv.innerHTML = '';
                    document.getElementById('codigoBarrasInput').focus();
                };
                sugerenciasDiv.appendChild(opcion);
            });
        });

        codigoInput.addEventListener('blur', function() {
            setTimeout(() => {
                const activeElement = document.activeElement;
                const esCampoConfiguracion = activeElement && 
                    (activeElement.id === 'tasaBCV' || 
                     activeElement.id === 'nombreEstablecimiento' ||
                     activeElement.closest('.config-section'));
                
                if (!esCampoConfiguracion && 
                    (!activeElement || 
                     !activeElement.matches('button, input[type="text"], select, textarea'))) {
                    codigoInput.focus();
                }
            }, 100);
        });
    }

    setTimeout(() => {
        if (codigoInput) {
            codigoInput.focus();
            codigoInput.select();
        }
    }, 500);

    const camposConfiguracion = ['tasaBCV', 'nombreEstablecimiento'];
    camposConfiguracion.forEach(id => {
        const campo = document.getElementById(id);
        if (campo) {
            campo.addEventListener('focus', function() {
                this.setAttribute('data-scanning-disabled', 'true');
            });
            campo.addEventListener('blur', function() {
                this.removeAttribute('data-scanning-disabled');
            });
        }
    });
}

function configurarEventosMoviles() {
    document.addEventListener('touchstart', function(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') {
            document.body.style.zoom = '100%';
        }
    });
    
    document.addEventListener('touchmove', function(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
            e.preventDefault();
        }
    }, { passive: false });
    
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
        viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
    }
}

function showToast(message, type = 'success', duration = 3500) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'success' ? 'success' : type === 'error' ? 'error' : 'warning'}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(8px)';
        setTimeout(() => {
            if (container.contains(toast)) container.removeChild(toast);
        }, 300);
    }, duration);
}

function editarProducto(index) {
    let indiceReal = index;
    
    if (productosFiltrados.length > 0) {
        const productoFiltrado = productosFiltrados[index];
        if (!productoFiltrado) return;
        
        indiceReal = productos.findIndex(p => 
            p.nombre === productoFiltrado.nombre && 
            p.descripcion === productoFiltrado.descripcion
        );
        
        if (indiceReal === -1) {
            showToast("Error: Producto no encontrado en la lista principal", 'error');
            return;
        }
    }
    
    const producto = productos[indiceReal];
    if (!producto) return;

    document.getElementById('producto').value = producto.nombre || '';
    document.getElementById('codigoBarras').value = producto.codigoBarras || '';
    document.getElementById('descripcion').value = producto.descripcion || '';
    document.getElementById('costo').value = producto.costo || '';
    document.getElementById('ganancia').value = (producto.ganancia * 100) || '';
    document.getElementById('unidadesPorCaja').value = producto.unidadesPorCaja || '';
    document.getElementById('unidadesExistentes').value = producto.unidadesExistentes || '';
    
    const tasaBCV = parseFloat(document.getElementById('tasaBCV').value) || tasaBCVGuardada;
    if (tasaBCV > 0) {
        const precioUnitarioDolar = producto.precioUnitarioDolar;
        const precioUnitarioBolivar = precioUnitarioDolar * tasaBCV;
        document.getElementById('precioUnitario').innerHTML =
            `<strong>Precio unitario:</strong> $${precioUnitarioDolar.toFixed(2)} / Bs${precioUnitarioBolivar.toFixed(2)}`;
    }

    productoEditando = indiceReal;
    
    showToast(`Editando: ${producto.nombre}`, 'success');
}

function agregarPorCodigoBarras() {
    const codigo = document.getElementById('codigoBarrasInput').value.trim();
    procesarEscaneo(codigo);
}

function actualizarCarrito() {
    const carritoBody = document.getElementById('carritoBody');
    const totalCarritoBs = document.getElementById('totalCarritoBs');
    const totalCarritoDolares = document.getElementById('totalCarritoDolares');

    if (!carritoBody) return;

    carritoBody.innerHTML = '';

    if (carrito.length === 0) {
        carritoBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">El carrito está vacío</td></tr>';
        if (totalCarritoBs) totalCarritoBs.textContent = 'Total: Bs 0,00';
        if (totalCarritoDolares) totalCarritoDolares.textContent = 'Total: $ 0,00';
        return;
    }

    let totalBs = 0;
    let totalDolares = 0;

    carrito.forEach((item, index) => {
        totalBs += item.subtotal;
        totalDolares += item.subtotalDolar;

        const cantidadMostrada = item.unidad === 'gramo' ? `${item.cantidad} g` : item.cantidad;

        const botonMas = item.unidad === 'gramo'
            ? `<button onclick="ingresarGramos(${index})" class="btn-carrito">+</button>`
            : `<button onclick="actualizarCantidadCarrito(${index}, 1)" class="btn-carrito">+</button>`;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.nombre} (${item.descripcion})</td>
            <td>Bs ${item.precioUnitarioBolivar.toFixed(2)}</td>
            <td>
                <button onclick="actualizarCantidadCarrito(${index}, -1)" class="btn-carrito">-</button>
                ${cantidadMostrada}
                ${botonMas}
            </td>
            <td>
                <select onchange="cambiarUnidadCarrito(${index}, this.value)" class="unidad-selector">
                    <option value="unidad" ${item.unidad === 'unidad' ? 'selected' : ''}>Unidad</option>
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

    if (totalCarritoBs) totalCarritoBs.textContent = `Total: Bs ${redondear2Decimales(totalBs).toFixed(2)}`;
    if (totalCarritoDolares) totalCarritoDolares.textContent = `Total: $ ${redondear2Decimales(totalDolares).toFixed(2)}`;
}

function actualizarCantidadCarrito(index, cambio) {
    const item = carrito[index];
    if (!item) return;

    item.cantidad += cambio;

    if (item.cantidad <= 0) {
        eliminarDelCarrito(index);
        return;
    }

    calcularSubtotalSegonUnidad(item);

    localStorage.setItem('carrito', JSON.stringify(carrito));
    actualizarCarrito();
}

function ingresarGramos(index) {
    const item = carrito[index];
    if (!item) return;

    const producto = productos[item.indexProducto];
    if (!producto) {
        showToast("Producto no encontrado en inventario", 'error');
        return;
    }

    const gramosInput = prompt("Ingrese la cantidad en gramos (ej: 350):", item.cantidad || '');
    if (gramosInput === null) return;

    const gramos = parseFloat(gramosInput);
    if (isNaN(gramos) || gramos <= 0) {
        showToast("Ingrese una cantidad válida en gramos", 'error');
        return;
    }

    const disponibleGramos = (producto.unidadesExistentes || 0) * 1000;

    let enCarritoMismoProducto = 0;
    carrito.forEach((it, i) => {
        if (i !== index && it.indexProducto === item.indexProducto) {
            if (it.unidad === 'gramo') enCarritoMismoProducto += (parseFloat(it.cantidad) || 0);
            else {
                const factor = producto.unidadesPorCaja || 1;
                enCarritoMismoProducto += (parseFloat(it.cantidad) || 0) * factor * 1000;
            }
        }
    });

    if ((gramos + enCarritoMismoProducto) > disponibleGramos) {
        showToast("No hay suficiente stock (gramos) para esa cantidad", 'error');
        return;
    }

    item.cantidad = gramos;
    item.unidad = 'gramo';
    calcularSubtotalSegonUnidad(item);

    localStorage.setItem('carrito', JSON.stringify(carrito));
    actualizarCarrito();
}

function calcularSubtotalSegonUnidad(item) {
    const producto = productos[item.indexProducto];
    if (!producto) return;

    if (item.unidad === 'gramo') {
        item.subtotal = redondear2Decimales(item.cantidad * item.precioUnitarioBolivar * 0.001);
        item.subtotalDolar = redondear2Decimales(item.cantidad * item.precioUnitarioDolar * 0.001);
    } else {
        item.subtotal = redondear2Decimales(item.cantidad * item.precioUnitarioBolivar);
        item.subtotalDolar = redondear2Decimales(item.cantidad * item.precioUnitarioDolar);
    }
}

function cambiarUnidadCarrito(index, nuevaUnidad) {
    carrito[index].unidad = nuevaUnidad;
    calcularSubtotalSegonUnidad(carrito[index]);
    localStorage.setItem('carrito', JSON.stringify(carrito));
    actualizarCarrito();
}

function eliminarDelCarrito(index) {
    carrito.splice(index, 1);
    localStorage.setItem('carrito', JSON.stringify(carrito));
    actualizarCarrito();
}

function actualizarLista() {
    const tbody = document.querySelector('#listaProductos tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    productosFiltrados = [];

    productos.forEach((producto, index) => {
        const inventarioBajo = producto.unidadesExistentes <= 5;
        const filas = document.createElement('tr');
        filas.innerHTML = `
            <td>${producto.nombre}</td>
            <td>${producto.descripcion}</td>
            <td>${producto.codigoBarras || 'N/A'}</td>
            <td class="${inventarioBajo ? 'inventario-bajo' : ''}">${producto.unidadesExistentes}</td>
            <td>
                <div class="ajuste-inventario">
                    <button onclick="ajustarInventario(${index}, 'sumar')" class="btn-inventario">+</button>
                    <button onclick="ajustarInventario(${index}, 'restar')" class="btn-inventario">-</button>
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
        tbody.appendChild(filas);
    });
}

function buscarProducto() {
    const termino = document.getElementById('buscar').value.trim().toLowerCase();
    if (!termino) { 
        productosFiltrados = [];
        actualizarLista(); 
        return; 
    }

    productosFiltrados = productos.filter(p =>
        (p.nombre || '').toLowerCase().includes(termino) ||
        (p.descripcion || '').toLowerCase().includes(termino) ||
        (p.codigoBarras && p.codigoBarras.toLowerCase().includes(termino))
    );

    const tbody = document.querySelector('#listaProductos tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';

    if (productosFiltrados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align: center;">No se encontraron productos</td></tr>';
        return;
    }

    productosFiltrados.forEach((producto, index) => {
        const inventarioBajo = producto.unidadesExistentes <= 5;
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${producto.nombre}</td>
            <td>${producto.descripcion}</td>
            <td>${producto.codigoBarras || 'N/A'}</td>
            <td class="${inventarioBajo ? 'inventario-bajo' : ''}">${producto.unidadesExistentes}</td>
            <td>
                <div class="ajuste-inventario">
                    <button onclick="ajustarInventario(${index}, 'sumar')" class="btn-inventario">+</button>
                    <button onclick="ajustarInventario(${index}, 'restar')" class="btn-inventario">-</button>
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
    let indiceReal = index;
    
    if (productosFiltrados.length > 0) {
        const productoFiltrado = productosFiltrados[index];
        if (!productoFiltrado) return;
        
        indiceReal = productos.findIndex(p => 
            p.nombre === productoFiltrado.nombre && 
            p.descripcion === productoFiltrado.descripcion
        );
        
        if (indiceReal === -1) {
            showToast("Error: Producto no encontrado en la lista principal", 'error');
            return;
        }
    }
    
    const producto = productos[indiceReal];
    const cantidad = parseInt(prompt(`Ingrese la cantidad a ${operacion === 'sumar' ? 'sumar' : 'restar'}:`, "1")) || 0;

    if (cantidad <= 0) { showToast("Ingrese una cantidad válida", 'error'); return; }
    if (operacion === 'restar' && producto.unidadesExistentes < cantidad) { showToast("No hay suficientes unidades en inventario", 'error'); return; }

    producto.unidadesExistentes = operacion === 'sumar' ? producto.unidadesExistentes + cantidad : producto.unidadesExistentes - cantidad;

    localStorage.setItem('productos', JSON.stringify(productos));
    actualizarLista();
    showToast(`Inventario de ${producto.nombre} actualizado: ${producto.unidadesExistentes} unidades`, 'success');
}

function eliminarProducto(index) {
    let indiceReal = index;
    
    if (productosFiltrados.length > 0) {
        const productoFiltrado = productosFiltrados[index];
        if (!productoFiltrado) return;
        
        indiceReal = productos.findIndex(p => 
            p.nombre === productoFiltrado.nombre && 
            p.descripcion === productoFiltrado.descripcion
        );
        
        if (indiceReal === -1) {
            showToast("Error: Producto no encontrado en la lista principal", 'error');
            return;
        }
    }
    
    const producto = productos[indiceReal];
    if (confirm(`¿Estás seguro de eliminar "${producto.nombre}"?`)) {
        productos.splice(indiceReal, 1);
        localStorage.setItem('productos', JSON.stringify(productos));
        actualizarLista();
        updateProductCount();
        checkProductLimit();
        showToast(`Producto eliminado: ${producto.nombre}`, 'success');
    }
}

function finalizarVenta() {
    if (carrito.length === 0) { showToast("El carrito está vacío", 'warning'); return; }

    const totalBs = carrito.reduce((sum, item) => sum + item.subtotal, 0);
    const totalDolares = carrito.reduce((sum, item) => sum + item.subtotalDolar, 0);

    document.getElementById('resumenTotalBs').textContent = `Total: Bs ${redondear2Decimales(totalBs).toFixed(2)}`;
    document.getElementById('resumenTotalDolares').textContent = `Total: $ ${redondear2Decimales(totalDolares).toFixed(2)}`;

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
    const totalBs = carrito.reduce((sum, i) => sum + i.subtotal, 0);
    detallesDiv.innerHTML = '';

    detallesPago = { metodo, totalBs };

    if (metodo === 'efectivo_bs' || metodo === 'efectivo_dolares') {
        detallesDiv.innerHTML = `
            <div class="campo-pago">
                <label>Monto recibido (${metodo === 'efectivo_bs' ? 'Bs' : '$'}):</label>
                <input type="number" id="montoRecibido" placeholder="Ingrese monto recibido" class="input-movil" />
            </div>
            <div class="campo-pago">
                <label>Cambio:</label>
                <input type="text" id="cambioCalculado" readonly placeholder="0.00" class="input-movil" />
            </div>
        `;
        setTimeout(() => {
            const input = document.getElementById('montoRecibido');
            if (!input) return;
            input.addEventListener('input', () => {
                const recib = parseFloat(input.value) || 0;
                let cambio = 0;
                if (metodo === 'efectivo_bs') cambio = redondear2Decimales(recib - totalBs);
                else {
                    const totalEnDolares = tasaBCVGuardada ? redondear2Decimales(totalBs / tasaBCVGuardada) : 0;
                    cambio = redondear2Decimales(recid - totalEnDolares);
                }
                document.getElementById('cambioCalculado').value = cambio >= 0 ? cambio.toFixed(2) : `Faltan ${Math.abs(cambio).toFixed(2)}`;
            });
        }, 100);
    } else if (metodo === 'punto' || metodo === 'biopago') {
        detallesDiv.innerHTML = `
            <div class="campo-pago">
                <label>Monto a pagar:</label>
                <input type="number" id="montoPago" placeholder="Ingrese monto" class="input-movil" />
            </div>
        `;
    } else if (metodo === 'pago_movil') {
        detallesDiv.innerHTML = `
            <div class="campo-pago">
                <label>Monto a pagar:</label>
                <input type="number" id="montoPagoMovil" placeholder="Ingrese monto" class="input-movil" />
            </div>
            <div class="campo-pago">
                <label>Referencia / Número:</label>
                <input type="text" id="refPagoMovil" placeholder="Referencia bancaria" class="input-movil" />
            </div>
            <div class="campo-pago">
                <label>Banco:</label>
                <input type="text" id="bancoPagoMovil" placeholder="Nombre del banco" class="input-movil" />
            </div>
        `;
    }

    document.getElementById('detallesPago').style.display = 'block';
}

function confirmarMetodoPago() {
    if (!metodoPagoSeleccionado) { 
        showToast("Seleccione un método de pago", 'error'); 
        return; 
    }

    const totalBs = carrito.reduce((sum, item) => sum + item.subtotal, 0);

    if (metodoPagoSeleccionado === 'efectivo_bs') {
        const recib = parseFloat(document.getElementById('montoRecibido').value) || 0;
        if (recib < totalBs) { 
            showToast("Monto recibido menor al total", 'error'); 
            return; 
        }
        detallesPago.cambio = redondear2Decimales(recib - totalBs);
        detallesPago.montoRecibido = recib;
    } else if (metodoPagoSeleccionado === 'efectivo_dolares') {
        const recib = parseFloat(document.getElementById('montoRecibido').value) || 0;
        const totalEnDolares = tasaBCVGuardada ? redondear2Decimales(totalBs / tasaBCVGuardada) : 0;
        if (recib < totalEnDolares) { 
            showToast("Monto recibido menor al total", 'error'); 
            return; 
        }
        detallesPago.cambio = redondear2Decimales(recib - totalEnDolares);
        detallesPago.montoRecibido = recib;
    } else if (metodoPagoSeleccionado === 'punto' || metodoPagoSeleccionado === 'biopago') {
        const monto = parseFloat(document.getElementById('montoPago') ? document.getElementById('montoPago').value : 0) || 0;
        if (monto <= 0) { 
            showToast("Ingrese el monto para Punto/Biopago", 'error'); 
            return; 
        }
        detallesPago.monto = monto;
    } else if (metodoPagoSeleccionado === 'pago_movil') {
        const monto = parseFloat(document.getElementById('montoPagoMovil').value) || 0;
        const ref = document.getElementById('refPagoMovil').value.trim();
        const banco = document.getElementById('bancoPagoMovil').value.trim();
        if (!monto || !ref || !banco) { 
            showToast("Complete todos los datos de Pago Móvil", 'error'); 
            return; 
        }
        detallesPago = {...detallesPago, monto, ref, banco };
    }

    carrito.forEach(item => {
        const producto = productos[item.indexProducto];
        if (producto) {
            if (item.unidad === 'gramo') {
                producto.unidadesExistentes = redondear2Decimales(producto.unidadesExistentes - (item.cantidad / 1000));
            } else {
                producto.unidadesExistentes = redondear2Decimales(producto.unidadesExistentes - item.cantidad);
            }

            if (producto.unidadesExistentes < 0) {
                producto.unidadesExistentes = 0;
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
        }
    });

    localStorage.setItem('productos', JSON.stringify(productos));
    localStorage.setItem('ventasDiarias', JSON.stringify(ventasDiarias));

    showToast(`Venta completada por Bs ${redondear2Decimales(totalBs).toFixed(2)}`, 'success');

    detallesPago.totalBs = redondear2Decimales(totalBs);
    detallesPago.items = JSON.parse(JSON.stringify(carrito));
    detallesPago.fecha = new Date().toLocaleString();

    carrito = [];
    localStorage.setItem('carrito', JSON.stringify(carrito));
    actualizarCarrito();
    actualizarLista();
    
    cerrarModalPago();

    imprimirTicketTermico(detallesPago);
}

function cancelarPago() {
    document.getElementById('detallesPago').style.display = 'none';
    metodoPagoSeleccionado = null;
    detallesPago = {};
}

function guardarNombreEstablecimiento() {
    nombreEstablecimiento = document.getElementById('nombreEstablecimiento').value.trim();
    if (!nombreEstablecimiento) { showToast("Ingrese un nombre válido", 'error'); return; }
    localStorage.setItem('nombreEstablecimiento', nombreEstablecimiento);
    showToast(`Nombre guardado: "${nombreEstablecimiento}"`, 'success');
}

function actualizarTasaBCV() {
    const nuevaTasa = parseFloat(document.getElementById('tasaBCV').value);

    if (!nuevaTasa || nuevaTasa <= 0) { showToast("Ingrese una tasa BCV válida", 'error'); return; }

    tasaBCVGuardada = nuevaTasa;
    localStorage.setItem('tasaBCV', tasaBCVGuardada);

    productos.forEach(producto => {
        producto.precioUnitarioBolivar = producto.precioUnitarioDolar * nuevaTasa;
        producto.precioMayorBolivar = producto.precioMayorDolar * nuevaTasa;
    });

    localStorage.setItem('productos', JSON.stringify(productos));
    actualizarLista();

    showToast(`Tasa BCV actualizada a: ${nuevaTasa}`, 'success');
}

function toggleCopyrightNotice() {
    const notice = document.getElementById('copyrightNotice');
    if (!notice) return;
    notice.style.display = notice.style.display === 'block' ? 'none' : 'block';
}

function mostrarListaCostos() {
    const container = document.getElementById('listaCostosContainer');
    const buscarCostosInput = document.getElementById('buscarCostos');
    if (!container) return;
    if (container.style.display === 'none' || container.style.display === '') {
        container.style.display = 'block';
        if (buscarCostosInput) buscarCostosInput.style.display = 'inline-block';
        llenarListaCostos();
    } else {
        container.style.display = 'none';
        if (buscarCostosInput) buscarCostosInput.style.display = 'none';
    }
}

function llenarListaCostos() {
    const lista = document.getElementById('listaCostos');
    if (!lista) return;
    lista.innerHTML = '';
    const copia = [...productos].sort((a, b) => (a.nombre || '').localeCompare((b.nombre || ''), 'es', { sensitivity: 'base' }));
    copia.forEach(p => {
        const li = document.createElement('li');
        li.innerHTML = `<span>${p.nombre} (${p.descripcion})</span><span>$${(p.costo / (p.unidadesPorCaja || 1)).toFixed(2)} / Bs${( (p.costo / (p.unidadesPorCaja || 1)) * (tasaBCVGuardada || p.precioUnitarioBolivar) ).toFixed(2)}</span>`;
        lista.appendChild(li);
    });
}

function filtrarListaCostos() {
    const termino = document.getElementById('buscarCostos').value.trim().toLowerCase();
    const lista = document.getElementById('listaCostos');
    if (!lista) return;
    lista.innerHTML = '';
    const copia = [...productos].sort((a, b) => (a.nombre || '').localeCompare((b.nombre || ''), 'es', { sensitivity: 'base' }));
    const filtrados = termino ? copia.filter(p => (p.nombre || '').toLowerCase().includes(termino) || (p.descripcion || '').toLowerCase().includes(termino)) : copia;
    filtrados.forEach(p => {
        const li = document.createElement('li');
        li.innerHTML = `<span>${p.nombre} (${p.descripcion})</span><span>$${(p.costo / (p.unidadesPorCaja || 1)).toFixed(2)} / Bs${( (p.precioUnitarioBolivar).toFixed(2) )}</span>`;
        lista.appendChild(li);
    });
}

function generarPDFCostos() {
    if (!productos.length) { showToast("No hay productos para generar PDF de costos", 'warning'); return; }

    const copia = [...productos].sort((a, b) => (a.nombre || '').localeCompare((b.nombre || ''), 'es', { sensitivity: 'base' }));
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(14);
    doc.text(nombreEstablecimiento || 'Lista de Costos', 14, 18);
    doc.setFontSize(10);
    const rows = copia.map(p => [
        p.nombre,
        p.descripcion,
        `$${(p.costo / (p.unidadesPorCaja || 1)).toFixed(2)}`,
        `Bs ${p.precioUnitarioBolivar.toFixed(2)}`
    ]);

    doc.autoTable({
        head: [['Producto', 'Descripción', 'Costo (u)', 'Precio Unit. (Bs)']],
        body: rows,
        startY: 28,
        styles: { fontSize: 9 }
    });

    doc.save(`lista_costos_${(new Date()).toISOString().slice(0,10)}.pdf`);
}

function generarReporteDiario() {
    if (!ventasDiarias.length) { showToast("No hay ventas registradas", 'warning'); return; }

    const hoy = new Date().toLocaleDateString();
    const ventasHoy = ventasDiarias.filter(v => v.fecha === hoy);
    const ventasAUsar = ventasHoy.length ? ventasHoy : ventasDiarias;

    let totalVentasBs = 0;
    let totalVentasDolares = 0;
    const filas = ventasAUsar.map(v => {
        totalVentasBs += v.totalBolivar || 0;
        
        // Calcular total en dólares usando la tasa BCV guardada
        const totalDolar = tasaBCVGuardada > 0 ? (v.totalBolivar || 0) / tasaBCVGuardada : 0;
        totalVentasDolares += totalDolar;

        return [
            v.fecha,
            v.hora,
            v.producto,
            `${v.cantidad} ${v.unidad}`,
            `Bs ${ (v.totalBolivar || 0).toFixed(2) }`,
            `$ ${ totalDolar.toFixed(2) }`,
            v.metodoPago
        ];
    });

    // ===== FÓRMULA SIMPLIFICADA 50-30-20 SOBRE INGRESOS EN DÓLARES =====
    const llaveMaestra = redondear2Decimales(totalVentasDolares / 100);
    const reinvertir = redondear2Decimales(llaveMaestra * 50);
    const gastosFijos = redondear2Decimales(llaveMaestra * 30);
    const sueldo = redondear2Decimales(llaveMaestra * 20);

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt' });

    doc.setFontSize(14);
    doc.text(nombreEstablecimiento || 'Reporte Diario', 40, 40);
    doc.setFontSize(10);
    doc.text(`Fecha: ${ (new Date()).toLocaleDateString() }`, 40, 60);
    doc.text(`Tasa BCV: ${tasaBCVGuardada}`, 40, 75);

    doc.autoTable({
        startY: 90,
        head: [['Fecha','Hora','Producto','Cant.','Total (Bs)','Total ($)','Pago']],
        body: filas,
        styles: { fontSize: 9 }
    });

    const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 10 : 300;
    
    // ===== SECCIÓN MEJORADA: RESUMEN FINANCIERO =====
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('RESUMEN FINANCIERO', 40, finalY + 20);
    
    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');
    doc.text(`Total ingresos en Bolívares: Bs ${totalVentasBs.toFixed(2)}`, 40, finalY + 40);
    doc.text(`Total ingresos en Dólares: $ ${totalVentasDolares.toFixed(2)}`, 40, finalY + 58);
    
    // ===== NUEVA SECCIÓN: DISTRIBUCIÓN 50-30-20 EN DÓLARES =====
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('DISTRIBUCIÓN RECOMENDADA (50-30-20) EN DÓLARES', 40, finalY + 85);
    
    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');
    doc.text(`50% Para reinvertir: $ ${reinvertir.toFixed(2)}`, 40, finalY + 105);
    doc.text(`30% Para gastos fijos: $ ${gastosFijos.toFixed(2)}`, 40, finalY + 123);
    doc.text(`20% Para sueldo: $ ${sueldo.toFixed(2)}`, 40, finalY + 141);
    
    // ===== VERIFICACIÓN DE CÁLCULO =====
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Verificación: ${reinvertir.toFixed(2)} + ${gastosFijos.toFixed(2)} + ${sueldo.toFixed(2)} = ${(reinvertir + gastosFijos + sueldo).toFixed(2)}`, 40, finalY + 165);
    
    // ===== NOTA EXPLICATIVA =====
    doc.setFontSize(9);
    doc.text('Nota: Esta distribución ayuda a mantener un negocio saludable, reinvirtiendo en inventario,', 40, finalY + 185);
    doc.text('cubriendo gastos operativos y asegurando un ingreso personal sostenible.', 40, finalY + 198);

    doc.save(`reporte_diario_${(new Date()).toISOString().slice(0,10)}.pdf`);
}

function mostrarOpcionesPDF() {
    document.getElementById('modalCategorias').style.display = 'block';
}

function cerrarModalCategorias() {
    document.getElementById('modalCategorias').style.display = 'none';
}

function generarPDFPorCategoria(categoria) {
    if (!productos.length) { 
        showToast("No hay productos para generar PDF", 'warning'); 
        return; 
    }

    let productosFiltrados = [];
    let tituloCategoria = '';

    if (categoria === 'todos') {
        productosFiltrados = [...productos];
        tituloCategoria = 'TODOS LOS PRODUCTOS';
    } else {
        productosFiltrados = productos.filter(p => p.descripcion === categoria);
        
        const nombresCategorias = {
            'viveres': 'VÍVERES',
            'bebidas': 'BEBIDAS',
            'licores': 'LICORES',
            'enlatados': 'ENLATADOS',
            'plasticos': 'PLÁSTICOS',
            'papeleria': 'PAPELERÍA',
            'lacteos': 'LÁCTEOS',
            'ferreteria': 'FERRETERÍA',
            'agropecuaria': 'AGROPECUARIA',
            'frigorifico': 'FRIGORÍFICO',
            'pescaderia': 'PESCADERÍA',
            'repuesto': 'REPUESTO',
            'confiteria': 'CONFITERÍA',
            'ropa': 'ROPA',
            'calzados': 'CALZADOS',
            'charcuteria': 'CHARCUTERÍA',
            'carnes': 'CARNES',
            'aseo_personal': 'ASEO PERSONAL',
            'limpieza': 'PRODUCTOS DE LIMPIEZA',
            'verduras': 'VERDURAS',
            'frutas': 'FRUTAS',
            'hortalizas': 'HORTALIZAS',
            'aliños': 'ALIÑOS',
            'otros': 'OTROS'
        };
        
        tituloCategoria = nombresCategorias[categoria] || categoria.toUpperCase();
    }

    if (productosFiltrados.length === 0) {
        showToast(`No hay productos en la categoría: ${tituloCategoria}`, 'warning');
        cerrarModalCategorias();
        return;
    }

    productosFiltrados.sort((a, b) => (a.nombre || '').localeCompare((b.nombre || ''), 'es', { sensitivity: 'base' }));

    const rows = productosFiltrados.map(p => [
        p.nombre,
        `$${p.precioUnitarioDolar.toFixed(2)}`,
        `Bs ${p.precioUnitarioBolivar.toFixed(2)}`
    ]);

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text(nombreEstablecimiento || 'Lista de Productos', 14, 18);
    doc.setFontSize(12);
    doc.text(`Categoría: ${tituloCategoria}`, 14, 26);
    doc.setFontSize(10);
    doc.text(`Fecha: ${(new Date()).toLocaleDateString()}`, 14, 34);

    doc.autoTable({
        head: [['Producto', 'Precio ($)', 'Precio (Bs)']],
        body: rows,
        startY: 42,
        styles: { fontSize: 9 },
        headStyles: { fillColor: [38, 198, 218] }
    });

    doc.save(`lista_${categoria}_${(new Date()).toISOString().slice(0,10)}.pdf`);
    cerrarModalCategorias();
    showToast(`PDF generado para: ${tituloCategoria}`, 'success');
}

function generarEtiquetasAnaqueles() {
    document.getElementById('modalEtiquetas').style.display = 'block';
}

function cerrarModalEtiquetas() {
    document.getElementById('modalEtiquetas').style.display = 'none';
}

function generarEtiquetasPorCategoria(categoria) {
    if (!productos.length) { 
        showToast("No hay productos para generar etiquetas", 'warning'); 
        return; 
    }

    let productosFiltrados = [];
    let tituloCategoria = '';

    if (categoria === 'todos') {
        productosFiltrados = [...productos];
        tituloCategoria = 'TODOS LOS PRODUCTOS';
    } else {
        productosFiltrados = productos.filter(p => p.descripcion === categoria);
        
        const nombresCategorias = {
            'viveres': 'VÍVERES',
            'bebidas': 'BEBIDAS',
            'licores': 'LICORES',
            'enlatados': 'ENLATADOS',
            'plasticos': 'PLÁSTICOS',
            'papeleria': 'PAPELERÍA',
            'lacteos': 'LÁCTEOS',
            'ferreteria': 'FERRETERÍA',
            'agropecuaria': 'AGROPECUARIA',
            'frigorifico': 'FRIGORÍFICO',
            'pescaderia': 'PESCADERÍA',
            'repuesto': 'REPUESTO',
            'confiteria': 'CONFITERÍA',
            'ropa': 'ROPA',
            'calzados': 'CALZADOS',
            'charcuteria': 'CHARCUTERÍA',
            'carnes': 'CARNES',
            'aseo_personal': 'ASEO PERSONAL',
            'limpieza': 'PRODUCTOS DE LIMPIEZA',
            'verduras': 'VERDURAS',
            'frutas': 'FRUTAS',
            'hortalizas': 'HORTALIZAS',
            'aliños': 'ALIÑOS',
            'otros': 'OTROS'
        };
        
        tituloCategoria = nombresCategorias[categoria] || categoria.toUpperCase();
    }

    if (productosFiltrados.length === 0) {
        showToast(`No hay productos en la categoría: ${tituloCategoria}`, 'warning');
        cerrarModalEtiquetas();
        return;
    }

    productosFiltrados.sort((a, b) => (a.nombre || '').localeCompare((b.nombre || ''), 'es', { sensitivity: 'base' }));

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });

    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 10;
    const labelWidth = 63;
    const labelHeight = 35;
    const labelsPerPage = 21;

    let currentPage = 0;
    let labelIndex = 0;

    productosFiltrados.forEach((producto, index) => {
        if (labelIndex >= labelsPerPage) {
            doc.addPage();
            currentPage++;
            labelIndex = 0;
        }

        const row = Math.floor(labelIndex / 3);
        const col = labelIndex % 3;
        
        const x = margin + (col * labelWidth);
        const y = margin + (row * labelHeight);

        doc.setDrawColor(200, 200, 200);
        doc.setFillColor(255, 255, 255);
        doc.rect(x, y, labelWidth - 2, labelHeight - 2, 'FD');

        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text(nombreEstablecimiento || 'TIENDA', x + 2, y + 5);

        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        const nombreProducto = producto.nombre.length > 25 ? 
            producto.nombre.substring(0, 25) + '...' : producto.nombre;
        doc.text(nombreProducto, x + 2, y + 10);

        doc.setFontSize(14);
        doc.setTextColor(220, 0, 0);
        doc.setFont(undefined, 'bold');
        doc.text(`Bs ${producto.precioUnitarioBolivar.toFixed(2)}`, x + 2, y + 20);

        doc.setFontSize(7);
        doc.setTextColor(100, 100, 100);
        doc.setFont(undefined, 'normal');
        doc.text(`Categoría: ${tituloCategoria}`, x + 2, y + 25);

        if (producto.codigoBarras) {
            doc.setFontSize(6);
            doc.text(`Cód: ${producto.codigoBarras}`, x + 2, y + 30);
        }

        labelIndex++;
    });

    doc.save(`etiquetas_${categoria}_${(new Date()).toISOString().slice(0,10)}.pdf`);
    cerrarModalEtiquetas();
    showToast(`Etiquetas generadas para: ${tituloCategoria}`, 'success');
}

function imprimirTicketTermico(detalles) {
    try {
        const printWindow = window.open('', '_blank', 'toolbar=0,location=0,menubar=0');
        if (!printWindow) {
            showToast('No se pudo abrir la ventana de impresión. Verifica bloqueadores de popups.', 'error');
            return;
        }

        let itemsHtml = '';
        (detalles.items || []).forEach(it => {
            const nombre = it.nombre.length > 20 ? it.nombre.slice(0, 20) + '...' : it.nombre;
            const cantidad = it.unidad === 'gramo' ? `${it.cantidad} g` : `${it.cantidad}`;
            const subtotal = (it.subtotal || 0).toFixed(2);
            itemsHtml += `<div><span style="float:left">${nombre} x${cantidad}</span><span style="float:right">Bs ${subtotal}</span><div style="clear:both"></div></div>`;
        });

        const cambioTexto = detalles.cambio !== undefined ? `<div>Cambio: Bs ${detalles.cambio.toFixed(2)}</div>` : '';
        const montoRecibidoTexto = detalles.montoRecibido !== undefined ? `<div>Recibido: ${detalles.montoRecibido}</div>` : '';

        const content = `
        <!doctype html>
        <html>
        <head>
            <meta charset="utf-8"/>
            <title>Ticket</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body { font-family: monospace; padding: 6px; margin: 0; }
                .ticket { width: 280px; max-width: 100%; }
                .ticket h2 { text-align:center; font-size: 16px; margin:6px 0; }
                .line { border-top: 1px dashed #000; margin:6px 0; }
                .items div { margin-bottom:6px; font-size:12px; }
                .totals { margin-top:8px; font-weight:bold; font-size:13px; }
                .small { font-size:11px; color:#333; }
                @media print {
                    body { padding: 0; }
                    .ticket { width: 58mm; }
                }
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
                ${montoRecibidoTexto}
                ${cambioTexto}
                <div class="line"></div>
                <div class="small">Método: ${detalles.metodo}</div>
                <div class="small">Gracias por su compra</div>
            </div>
            <script>
                setTimeout(function(){ window.print(); setTimeout(()=>window.close(), 300); }, 300);
            </script>
        </body>
        </html>`;

        printWindow.document.open();
        printWindow.document.write(content);
        printWindow.document.close();
    } catch (err) {
        console.error(err);
        showToast('Error al preparar impresión del ticket', 'error');
    }
}

function descargarBackup() {
    try {
        const backupData = {
            productos: JSON.parse(localStorage.getItem('productos')) || [],
            nombreEstablecimiento: localStorage.getItem('nombreEstablecimiento') || '',
            tasaBCV: localStorage.getItem('tasaBCV') || 0,
            ventasDiarias: JSON.parse(localStorage.getItem('ventasDiarias')) || [],
            carrito: JSON.parse(localStorage.getItem('carrito')) || [],
            fechaBackup: new Date().toISOString(),
            version: '1.0'
        };

        const dataStr = JSON.stringify(backupData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const downloadLink = document.createElement('a');
        downloadLink.href = URL.createObjectURL(dataBlob);
        downloadLink.download = `respaldo_calculadora_${new Date().toISOString().slice(0, 10)}.json`;
        
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        
        showToast('Respaldo descargado exitosamente', 'success');
    } catch (error) {
        console.error('Error al descargar respaldo:', error);
        showToast('Error al descargar el respaldo', 'error');
    }
}

function cargarBackup(files) {
    if (!files || files.length === 0) return;
    
    const file = files[0];
    if (!file.name.endsWith('.json')) {
        showToast('Por favor selecciona un archivo JSON válido', 'error');
        return;
    }

    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const backupData = JSON.parse(e.target.result);
            
            if (!backupData.productos || !Array.isArray(backupData.productos)) {
                throw new Error('Formato de archivo inválido');
            }
            
            if (confirm('¿Estás seguro de que deseas cargar este respaldo? Se sobrescribirán todos los datos actuales.')) {
                localStorage.setItem('productos', JSON.stringify(backupData.productos));
                localStorage.setItem('nombreEstablecimiento', backupData.nombreEstablecimiento || '');
                localStorage.setItem('tasaBCV', backupData.tasaBCV || 0);
                localStorage.setItem('ventasDiarias', JSON.stringify(backupData.ventasDiarias || []));
                localStorage.setItem('carrito', JSON.stringify(backupData.carrito || []));
                
                productos = JSON.parse(localStorage.getItem('productos')) || [];
                nombreEstablecimiento = localStorage.getItem('nombreEstablecimiento') || '';
                tasaBCVGuardada = parseFloat(localStorage.getItem('tasaBCV')) || 0;
                ventasDiarias = JSON.parse(localStorage.getItem('ventasDiarias')) || [];
                carrito = JSON.parse(localStorage.getItem('carrito')) || [];
                
                cargarDatosIniciales();
                actualizarLista();
                actualizarCarrito();
                updateProductCount();
                checkProductLimit();
                
                showToast('Respaldo cargado exitosamente', 'success');
            }
        } catch (error) {
            console.error('Error al cargar respaldo:', error);
            showToast('Error al cargar el respaldo: archivo inválido', 'error');
        }
    };
    
    reader.onerror = function() {
        showToast('Error al leer el archivo', 'error');
    };
    
    reader.readAsText(file);
    
    document.getElementById('fileInput').value = '';
}

function procesarEscaneo(codigo) {
    if (!codigo) {
        showToast("Código de barras vacío", 'warning');
        return;
    }

    let productoEncontrado = productos.find(p =>
        p.codigoBarras && p.codigoBarras.toLowerCase() === codigo.toLowerCase()
    );

    if (!productoEncontrado) {
        productoEncontrado = productos.find(p =>
            (p.nombre || '').toLowerCase() === codigo.toLowerCase()
        );
    }

    if (!productoEncontrado) {
        productoEncontrado = productos.find(p =>
            (p.nombre || '').toLowerCase().includes(codigo.toLowerCase())
        );
    }

    if (!productoEncontrado) {
        showToast("Producto no encontrado: " + codigo, 'error');
        mostrarSugerenciasEspecificas(codigo);
        return;
    }

    agregarProductoAlCarrito(productoEncontrado);
    darFeedbackEscaneoExitoso();
}

function agregarProductoAlCarrito(productoEncontrado) {
    const enCarrito = carrito.findIndex(item => item.nombre === productoEncontrado.nombre && item.unidad === 'unidad');

    if (enCarrito !== -1) {
        carrito[enCarrito].cantidad += 1;
        carrito[enCarrito].subtotal = redondear2Decimales(carrito[enCarrito].cantidad * carrito[enCarrito].precioUnitarioBolivar);
        carrito[enCarrito].subtotalDolar = redondear2Decimales(carrito[enCarrito].cantidad * carrito[enCarrito].precioUnitarioDolar);
    } else {
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

    const codigoInput = document.getElementById('codigoBarrasInput');
    if (codigoInput) {
        codigoInput.value = '';
        codigoInput.focus();
    }

    const scannerStatus = document.getElementById('scannerStatus');
    if (scannerStatus) scannerStatus.textContent = '✓ Producto agregado. Escanee siguiente...';

    localStorage.setItem('carrito', JSON.stringify(carrito));
    actualizarCarrito();
}

function mostrarSugerenciasEspecificas(codigo) {
    const sugerenciasDiv = document.getElementById('sugerencias');
    if (!sugerenciasDiv) return;

    sugerenciasDiv.innerHTML = '<div style="color: #ff6b6b; padding: 5px;">Producto no encontrado. Sugerencias:</div>';

    const similares = productos.filter(p =>
        (p.nombre || '').toLowerCase().includes(codigo.toLowerCase().substring(0, 3)) ||
        (p.codigoBarras && p.codigoBarras.toLowerCase().includes(codigo.toLowerCase().substring(0, 3)))
    ).slice(0, 5);

    similares.forEach(prod => {
        const opcion = document.createElement('div');
        opcion.style.cursor = 'pointer';
        opcion.style.padding = '5px';
        opcion.style.borderBottom = '1px solid #eee';
        opcion.innerHTML = `<strong>${prod.nombre}</strong> - ${prod.descripcion}`;
        opcion.onclick = function() {
            agregarProductoAlCarrito(prod);
            sugerenciasDiv.innerHTML = '';
        };
        sugerenciasDiv.appendChild(opcion);
    });

    if (similares.length === 0) {
        sugerenciasDiv.innerHTML += '<div style="padding: 5px;">No se encontraron productos similares</div>';
    }
}

function darFeedbackEscaneoExitoso() {
    const codigoInput = document.getElementById('codigoBarrasInput');
    if (codigoInput) {
        codigoInput.style.backgroundColor = '#d4edda';
        setTimeout(() => {
            codigoInput.style.backgroundColor = '';
        }, 300);
    }
}

// Cerrar modal si se hace clic fuera
window.onclick = function(event) {
    const modal = document.getElementById('modalPago');
    if (event.target == modal) cerrarModalPago();
    
    const modalCategorias = document.getElementById('modalCategorias');
    if (event.target == modalCategorias) cerrarModalCategorias();
    
    const modalEtiquetas = document.getElementById('modalEtiquetas');
    if (event.target == modalEtiquetas) cerrarModalEtiquetas();
};
