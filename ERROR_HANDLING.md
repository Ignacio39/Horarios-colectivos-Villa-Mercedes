# 🔧 ERROR HANDLING GUIDE

## Cómo Manejar Errores en Producción

Esta guía explica qué pasa cuando algo falla y cómo la app se recupera automáticamente.

---

## 🌟 Arquitectura de Recuperación

```
ERROR DETECTOR
    ↓
¿Es critico?
├─ Sí  → Mostrar error al usuario + fallback
└─ No  → Log en consola + continuar normalmente
```

---

## 1️⃣ Firebase Unavailable (Error Más Común)

### ¿Cuándo ocurre?
- Servidor de Firebase caído
- Conexión a internet lenta
- Proyecto Firebase mal configurado
- Timeout (>5 segundos)

### ¿Qué hace la app?
```javascript
try {
    const data = await loadScheduleDataFromFirebase(); // Timeout después 5s
} catch (error) {
    // Automáticamente intenta fallback
    return loadScheduleDataFromFallback();
}
```

### Qué ve el usuario
```
💾 Datos locales
o
📦 Datos en caché (sin conexión a Firebase)
```

### Logs en consola
```
❌ Firebase no disponible, intentando fallback...
✅ Usando datos locales (data.js)
```

---

## 2️⃣ Invalid Schedule Data (Formato Incorrecto)

### ¿Cuándo ocurre?
- Horario como `"25:70"` (inválido)
- Formato no es `"HH:MM"`
- Array de horarios roto

### ¿Qué hace la app?
```javascript
// En findNextSchedules()
try {
    const [hours, minutes] = time.split(':').map(Number);
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        console.warn('⚠️ Hora fuera de rango: ' + time);
        continue; // Ignora este horario
    }
} catch (error) {
    console.error('❌ Error procesando horario: ', error);
}
```

### Qué ve el usuario
```
Ese horario simplemente no aparece
(otros horarios sí se muestran)
```

### Logs en consola
```
⚠️ Hora fuera de rango: 25:70
```

---

## 3️⃣ Empty Schedules (Sin Datos)

### ¿Cuándo ocurre?
- Firebase vacío
- data.js vacío
- localStorage vacío
- Primer acceso sin conexión

### ¿Qué hace la app?
```javascript
if (!scheduleData || Object.keys(scheduleData).length === 0) {
    linesContainer.innerHTML = `
        <div class="error-message">
            <strong>⚠️ No hay datos disponibles</strong>
            <p>No se pudo conectar con Firebase ni se encontraron datos locales.</p>
        </div>
    `;
}
```

### Qué ve el usuario
```
⚠️ No hay datos disponibles
No se pudo conectar con Firebase ni se encontraron datos locales.
Por favor, verifica tu conexión a internet.
```

### Solución
```
1. Verificar conexión a internet
2. Actualizar página (F5)
3. Limpiar caché: localStorage.clear()
4. Recarga: Ctrl+Shift+R
```

---

## 4️⃣ Memory Leak (Intervals no limpiados)

### ¿Cuándo ocurre?
- Recargar página múltiples veces
- Navegar entre pestañas sin cerrar

### ¿Qué hace la app?
```javascript
// Antes de descargar:
window.addEventListener('beforeunload', cleanupApp);

function cleanupApp() {
    appState.intervals.forEach(interval => clearInterval(interval));
    appState.intervals = [];
}
```

### Qué ve el usuario
```
Nada diferente (limpieza automática)
```

### Verificación
```javascript
// En consola:
console.log(window.appState.intervals.length); // Debe ser 0 tras recargar
```

---

## 5️⃣ localStorage Disabled (Raro pero Posible)

### ¿Cuándo ocurre?
- Navegador en modo "Incognito/Privado"
- localStorage deshabilitado en browser
- Cuota de almacenamiento llena (raro)

### ¿Qué hace la app?
```javascript
// Las siguiente líneas fallan silenciosamente:
localStorage.setItem('scheduleData_cache', data); // ← Error ignorado
```

### Qué ve el usuario
```
App funciona igual (sin fallback al localStorage)
Pero: No hay persistencia si Firebase falla después
```

### Logs en consola
```
(Sin advertencia porque no es crítico)
```

---

## 6️⃣ Day Mismatch (Día no encuentra horarios)

### ¿Cuándo ocurre?
- Keys con tilde inconsistentes: `"miercoles"` vs `"miércoles"`
- Paradas con nombres diferentes

### ¿Qué hace la app?
```javascript
const schedules = lineData.schedules[currentDay]?.[stop] || [];
// Si currentDay no coincide → schedules = []
// Resultado: muestra "No hay más servicios hoy"
```

### Qué ve el usuario
```
"No hay más servicios hoy"
(incluso aunque hay horarios)
```

### Solución
```javascript
// En console, verifica:
const data = JSON.parse(localStorage.getItem('scheduleData_cache'));
console.log(Object.keys(data['Línea A'].schedules)); // Ver días disponibles
// Deben ser: ['domingo', 'lunes', 'martes', 'miércoles', ...]
```

---

## 7️⃣ Firebase Rate Limit (Demasiadas peticiones)

### ¿Cuándo ocurre?
- App recarga datos cada minuto
- Muchos usuarios simultaneamente
- Testing con refresh automático

### ¿Qué hace la app?
```javascript
// Intenta cada 60 segundos (configurable en config.js)
setInterval(() => {
    displaySchedules(appState.currentScheduleData);
}, 60000);
```

### Qué ve el usuario
```
Datos viejos (del último acceso exitoso)
Mensaje: "📦 Datos en caché"
```

### Solución
```javascript
// En config.js, aumentar intervalo:
SCHEDULE_UPDATE_INTERVAL: 120000, // 2 minutos en lugar de 1
```

---

## 🔍 Debugging Checklist

### Si la app no muestra horarios:

- [ ] Abre consola (F12)
- [ ] Ejecuta: `debug()`
- [ ] Verifica: `dataSource` (¿es firebase, local, o localStorage?)
- [ ] Ejecuta: `validateData()` (¿hay errores de formato?)
- [ ] Ejecuta: `viewCache()` (¿hay datos guardados?)
- [ ] Mira los logs amarillos/rojos

### Si falta un día específico:

```javascript
// En console:
const data = JSON.parse(localStorage.getItem('scheduleData_cache'));
const linea = data['Línea A'];
console.log(Object.keys(linea.schedules));
// Busca el día que falta (ej: 'miércoles' o 'miercoles')
```

### Si quieres simular un error:

```javascript
// En console:
testFallbackLocal();  // Simula fallo de Firebase
location.reload();
// Debería cargar con fallback
```

---

## 📊 Estados de Error y Recuperación

| Error | Severidad | Recuperación | Impacto Usuario |
|-------|-----------|-------------|-----------------|
| Firebase cae | 🔴 Alta | Automática (fallback) | ✅ Sin impacto |
| Horario inválido | 🟠 Media | Ignorado | ⚠️ Ese horario no aparece |
| Data.js corrupto | 🔴 Alta | Error en consola | ❌ Necesita solución |
| localStorage lleno | 🟡 Baja | Fallback a local | ✅ Sin impacto inmediato |
| Sin internet | 🔴 Alta | Usa localStorage/local | ✅ Funciona con datos viejos |
| Day mismatch | 🟠 Media | Muestra "sin servicio" | ⚠️ Usuario confundido |

---

## 🆘 Troubleshooting Rápido

### "No hay datos disponibles"
```bash
# 1. Verifica internet: ping google.com
# 2. Limpia caché: localStorage.clear()
# 3. Recarga: Ctrl+Shift+R (hard refresh)
# 4. Si persiste: contacta soporte
```

### "No puedo ver horarios de hoy"
```bash
# 1. Abre console (F12)
# 2. Ejecuta: validateData()
# 3. Busca errores "⚠️ Hora fuera de rango"
# 4. Contacta con admin para actualizar datos
```

### "App lenta después de recarga"
```bash
# 1. Abre console (F12)
# 2. Ejecuta: debug()
# 3. Mira "Intervals activos"
# 4. Si >4: hay memory leak, recarga página
```

### "Modo oscuro no persiste"
```bash
# Posible: localStorage deshabilitado
# Solución: Usa navegador en modo normal (no privado)
```

---

## 📈 Monitoreo en Producción

Para saber si algo está fallando:

```javascript
// Agrega al inicio de main.js:
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    // Aquí podrías enviar a servicio de monitoreo (Sentry, etc)
});

// Agregar logging de fallback:
console.log(`Usando fuente: ${dataSource}`);
// Enviar a analytics para monitoreo
```

---

## 🎯 Resumen

1. **Firebase falla** → Fallback automático ✅
2. **Data corrupto** → Se ignora ese horario ✅
3. **Sin datos** → Mostrar error claro ✅
4. **Memory leak** → Limpieza automática ✅
5. **localStorage disabled** → Funciona igual ✅

**→ En todos los casos: App sigue funcionando**

---

**Última actualización**: 29 de enero de 2026
