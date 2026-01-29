# Estrategia de Fallback - Horarios Colectivos Villa Mercedes

## 🏗️ Arquitectura de Carga de Datos

La aplicación implementa un sistema de **3 capas de fallback** para garantizar disponibilidad de datos:

```
┌─────────────────────────────────────┐
│  1️⃣ Firebase (Tiempo Real)          │ ← Intenta primero
│  ✅ Datos actualizados               │
│  ❌ Falla si no hay internet        │
└─────────────────────────────────────┘
            ↓ (Error)
┌─────────────────────────────────────┐
│  2️⃣ Data.js (Datos Locales)         │ ← Fallback 1
│  ✅ Siempre disponible               │
│  ❌ Datos estáticos                 │
└─────────────────────────────────────┘
            ↓ (No existe)
┌─────────────────────────────────────┐
│  3️⃣ localStorage (Cache)             │ ← Fallback 2
│  ✅ Datos de última sincronización  │
│  ❌ Solo si se sincronizó antes     │
└─────────────────────────────────────┘
            ↓ (Vacío)
┌─────────────────────────────────────┐
│  ❌ Error: Sin datos disponibles    │
│  Mostrar mensaje de error al usuario │
└─────────────────────────────────────┘
```

## 📊 Estados Posibles

| Estado | Indicador | Fuente | Actualización |
|--------|-----------|--------|---------------|
| `firebase` | Verde ✅ | Firebase | En tiempo real |
| `local` | Azul 💾 | data.js | Manual (código) |
| `localStorage` | Naranja 📦 | Caché local | Última sincronización |
| `offline` | Rojo ❌ | Ninguna | No disponible |

## 🔄 Cómo Funciona

### 1. Inicio de Sesión
```javascript
// 1. Intenta Firebase
const data = await loadScheduleDataFromFirebase();

// Si falla → intenta fallback
function loadScheduleDataFromFallback() {
    // 2. Busca en data.js
    if (localScheduleData existe) return localScheduleData;
    
    // 3. Busca en localStorage
    const cached = localStorage.getItem('scheduleData_cache');
    if (cached) return JSON.parse(cached);
    
    // 4. Sin datos
    return null;
}
```

### 2. Almacenamiento en Caché
Cuando Firebase tiene éxito, se guardan los datos en localStorage:
```javascript
localStorage.setItem('scheduleData_cache', JSON.stringify(firebaseData));
localStorage.setItem('scheduleData_timestamp', new Date().toISOString());
```

### 3. Banner Informativo
Si se usan datos locales o cacheados, aparece un banner:
```
📦 Datos en caché (sin conexión a Firebase)
💾 Datos locales
```

## 🛡️ Ventajas

✅ **Disponibilidad 24/7**: Incluso sin internet, la app funciona  
✅ **Offline-first**: Guarda datos localmente automáticamente  
✅ **Transparencia**: Usuario sabe qué datos está viendo  
✅ **Sin errores fatales**: Nunca muestra pantalla en blanco  
✅ **Rendimiento**: Fallback es instantáneo  

## ⚙️ Configuración

### Usar Solo Data.js (Sin Firebase)
Para desactivar Firebase y usar solo datos locales:
```javascript
// En main.js, comentar la llamada a Firebase:
// const scheduleData = await loadScheduleDataFromFirebase();

// Y usar directamente:
const scheduleData = loadScheduleDataFromFallback();
```

### Limpiar Caché
```javascript
// En consola del navegador:
localStorage.removeItem('scheduleData_cache');
localStorage.removeItem('scheduleData_timestamp');
```

### Forzar Recargar desde Firebase
```javascript
// Presionar F5 para actualizar la app
// Automáticamente intentará Firebase primero
```

## 📝 Logs de Depuración

Abre la consola del navegador (F12) para ver:
```
✅ Datos cargados desde Firebase
✅ Usando datos locales (data.js)
✅ Usando datos cacheados en localStorage (desde: 2026-01-29T10:30:00Z)
❌ Firebase no disponible, intentando fallback...
❌ No hay datos disponibles (Firebase, local ni cache)
```

## 🔒 Seguridad

### Credenciales Firebase
Las claves están en `index.html` pero **es seguro** porque:
- Firebase tiene validación de seguridad
- Las claves públicas son parte de la arquitectura de Firebase
- Se pueden restringir en Firebase Console

Para mayor seguridad, usar variables de entorno (ver `.env.example`)

## 📱 Comportamiento en Dispositivos

| Dispositivo | Conexión | Resultado |
|-------------|----------|-----------|
| Desktop/Mobile | ✅ Internet | Firebase (datos vivos) |
| Desktop/Mobile | ❌ Sin Internet | Data.js o localStorage |
| Desktop/Mobile | 📱 Datos lentos | Cache (más rápido) |
| Primer acceso | ❌ Sin conexión | Data.js solamente |

## 🧪 Testing

### Test 1: Simular Fallo de Firebase
```javascript
// En consola:
delete window.db; // Hace que Firebase falle
location.reload();
// Debería cargar con fallback local
```

### Test 2: Verificar localStorage
```javascript
// En consola:
console.log(localStorage.getItem('scheduleData_cache'));
```

### Test 3: Desactivar Internet
- Abrir DevTools (F12)
- Network → Offline
- Recargar página (debe funcionar)

## 📞 Soporte

Si la app no muestra horarios:
1. Abre la consola (F12)
2. Busca mensajes de error
3. Verifica tu conexión a internet
4. Intenta limpiar caché: `localStorage.clear()`
