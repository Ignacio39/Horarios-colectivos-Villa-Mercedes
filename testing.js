/**
 * TESTING Y DEBUGGING - Herramientas para desarrolladores
 * 
 * Copia y pega estos comandos en la consola del navegador (F12)
 * para probar diferentes escenarios
 */

// ============================================
// 1. REVISAR ESTADO ACTUAL
// ============================================

console.log("🔍 Estado Actual de la Aplicación");
console.log("================================");

// Ver fuente de datos
console.log(`📊 Fuente de datos: ${window.dataSource || 'desconocida'}`);

// Ver datos en memoria
console.log(`💾 Datos en memoria:`, window.appState?.currentScheduleData ? 'Sí' : 'No');

// Ver localStorage
const cache = localStorage.getItem('scheduleData_cache');
const timestamp = localStorage.getItem('scheduleData_timestamp');
console.log(`📦 Cache en localStorage:`, cache ? `${cache.length} bytes` : 'vacío');
if (timestamp) console.log(`⏰ Última sincronización: ${timestamp}`);

// Ver Firebase
console.log(`🔥 Firebase disponible:`, window.db ? 'Sí' : 'No');

// Ver modo oscuro
console.log(`🌙 Modo oscuro:`, document.body.classList.contains('dark-mode') ? 'Activado' : 'Desactivado');

// Ver intervals activos
console.log(`⏱️  Intervals activos:`, window.appState?.intervals?.length || 0);


// ============================================
// 2. SIMULAR FALLO DE FIREBASE
// ============================================

function testFirebaseFailure() {
    console.log("🧪 Test: Simulando fallo de Firebase...");
    delete window.db;
    console.log("✅ Firebase desactivado. Ahora recarga: location.reload()");
}


// ============================================
// 3. FORZAR USAR FALLBACK LOCAL
// ============================================

function testFallbackLocal() {
    console.log("🧪 Test: Forzando fallback local...");
    delete window.db;
    localStorage.removeItem('scheduleData_cache');
    console.log("✅ Firebase y cache desactivados. Debería usar data.js");
    console.log("   Recarga: location.reload()");
}


// ============================================
// 4. LIMPIAR TODO
// ============================================

function clearAll() {
    console.log("🧹 Limpiando caché...");
    localStorage.removeItem('scheduleData_cache');
    localStorage.removeItem('scheduleData_timestamp');
    localStorage.removeItem('darkMode');
    console.log("✅ Cache limpiado. Recarga: location.reload()");
}


// ============================================
// 5. FORZAR RECARGA DESDE FIREBASE
// ============================================

function forceRefreshFromFirebase() {
    console.log("🔄 Forzando recarga desde Firebase...");
    clearAll();
    window.location.reload(true); // true = hard refresh
}


// ============================================
// 6. VER DATOS EN CACHE
// ============================================

function viewCache() {
    const cache = localStorage.getItem('scheduleData_cache');
    if (!cache) {
        console.log("❌ No hay datos en cache");
        return;
    }
    try {
        const data = JSON.parse(cache);
        console.log("📊 Datos en cache:", data);
        console.log(`📈 Líneas disponibles: ${Object.keys(data).join(', ')}`);
    } catch (e) {
        console.error("❌ Error al parsear cache:", e);
    }
}


// ============================================
// 7. SIMULAR MODO OFFLINE
// ============================================

function testOfflineMode() {
    console.log("📱 Test: Modo Offline");
    console.log("====================");
    console.log("1. Abre DevTools (F12)");
    console.log("2. Pestaña 'Network'");
    console.log("3. En el dropdown (donde dice 'No throttling'), selecciona 'Offline'");
    console.log("4. Recarga la página");
    console.log("5. Debería mostrar datos desde cache/local");
    console.log("\n💡 Tip: La app debe seguir funcionando normalmente");
}


// ============================================
// 8. INFORMACIÓN DE DEBUG
// ============================================

function debugInfo() {
    console.clear();
    console.log("%c🔍 INFORMACIÓN DE DEBUG", "font-size: 14px; font-weight: bold; color: #4299e1;");
    console.log("================================\n");
    
    // Información general
    console.log("📱 Navegador:", navigator.userAgent);
    console.log("🌐 URL:", window.location.href);
    console.log("💾 Storage disponible:", typeof(Storage) !== "undefined" ? "Sí" : "No");
    
    // Estado de Firebase
    console.log("\n🔥 Firebase:");
    console.log("  - Disponible:", window.db ? "Sí" : "No");
    console.log("  - API Key:", window.db ? "Configurada" : "No");
    
    // Estado de datos
    console.log("\n📊 Datos:");
    console.log("  - Fuente:", window.dataSource || "Desconocida");
    console.log("  - En memoria:", window.appState?.currentScheduleData ? "Sí" : "No");
    console.log("  - En localStorage:", localStorage.getItem('scheduleData_cache') ? "Sí" : "No");
    
    // Storage info
    console.log("\n💾 LocalStorage:");
    console.log("  - Items:", localStorage.length);
    console.log("  - Cache size:", (localStorage.getItem('scheduleData_cache') || '').length, "bytes");
    
    // UI State
    console.log("\n🎨 UI:");
    console.log("  - Modo oscuro:", document.body.classList.contains('dark-mode') ? "Sí" : "No");
    console.log("  - Viewport:", window.innerWidth + "x" + window.innerHeight);
    
    // Intervals
    console.log("\n⏱️  Timers:");
    console.log("  - Intervals activos:", window.appState?.intervals?.length || 0);
    
    console.log("\n================================\n");
}


// ============================================
// 9. VALIDAR INTEGRIDAD DE DATOS
// ============================================

function validateData() {
    console.log("✔️  Validando integridad de datos...\n");
    
    const data = window.appState?.currentScheduleData;
    if (!data) {
        console.error("❌ No hay datos cargados");
        return;
    }
    
    let errors = 0;
    let warnings = 0;
    
    for (const [lineName, lineData] of Object.entries(data)) {
        console.log(`\n📍 Línea: ${lineName}`);
        
        // Validar stops
        if (!Array.isArray(lineData.stops)) {
            console.error(`  ❌ stops no es array`);
            errors++;
        } else {
            console.log(`  ✅ Paradas: ${lineData.stops.length}`);
        }
        
        // Validar schedules
        if (!lineData.schedules) {
            console.error(`  ❌ schedules no existe`);
            errors++;
        } else {
            const days = Object.keys(lineData.schedules);
            console.log(`  ✅ Días: ${days.join(', ')}`);
            
            // Validar cada día
            for (const day of days) {
                const daySchedules = lineData.schedules[day];
                for (const [stop, times] of Object.entries(daySchedules)) {
                    if (!Array.isArray(times)) {
                        console.warn(`  ⚠️  ${day} - ${stop}: no es array`);
                        warnings++;
                    }
                    // Validar formato de horas
                    for (const time of times) {
                        if (!/^\d{2}:\d{2}$/.test(time)) {
                            console.warn(`  ⚠️  ${day} - ${stop}: formato inválido "${time}"`);
                            warnings++;
                        }
                    }
                }
            }
        }
    }
    
    console.log(`\n${'='.repeat(40)}`);
    console.log(`✅ Errores: ${errors} | ⚠️  Warnings: ${warnings}`);
}


// ============================================
// 10. COMANDOS DISPONIBLES
// ============================================

function help() {
    console.clear();
    console.log("%c📚 COMANDOS DISPONIBLES PARA TESTING", "font-size: 16px; font-weight: bold; color: #4299e1; background: #e6f2ff; padding: 10px;");
    console.log(`
    
    🔍 INSPECCIONAR:
    ├─ debugInfo()              → Info completa del sistema
    ├─ viewCache()              → Ver datos en localStorage
    └─ validateData()            → Validar integridad de datos
    
    🧪 TESTING:
    ├─ testFirebaseFailure()    → Simular fallo de Firebase
    ├─ testFallbackLocal()      → Forzar uso de data.js
    ├─ testOfflineMode()        → Instrucciones para modo offline
    └─ clearAll()               → Limpiar todos los datos cacheados
    
    🔄 ACCIONES:
    ├─ forceRefreshFromFirebase() → Recarga desde Firebase
    └─ location.reload()        → Recarga normal
    
    ❓ AYUDA:
    └─ help()                   → Mostrar este mensaje
    
    ---
    
    💡 EJEMPLO: Test completo de fallback
    1. debugInfo()              ← Ver estado actual
    2. testFallbackLocal()      ← Simular fallo
    3. location.reload()        ← Recargar
    4. debugInfo()              ← Verificar fallback funcionó
    
    `);
}


// ============================================
// EXPORTAR COMANDOS GLOBALES
// ============================================

// Hacer disponibles en window.
window.testingCommands = {
    debugInfo,
    viewCache,
    validateData,
    testFirebaseFailure,
    testFallbackLocal,
    testOfflineMode,
    clearAll,
    forceRefreshFromFirebase,
    help
};

// Alias cortos
Object.assign(window, {
    debug: debugInfo,
    cache: viewCache,
    validate: validateData,
    offline: testOfflineMode,
    refresh: forceRefreshFromFirebase,
    clean: clearAll,
    help
});

// Mensaje inicial
console.log("%c💡 Testing Tools Cargadas", "color: #48bb78; font-weight: bold;");
console.log("Escribe 'help()' para ver comandos disponibles");
