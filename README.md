# Horarios de Colectivos Villa Mercedes

Una aplicación web moderna para consultar horarios de colectivos en tiempo real con soporte offline.

## 🌟 Características Principales

✅ **Datos en Tiempo Real** - Sincronización automática con Firebase  
✅ **Fallback Inteligente** - Funciona incluso sin conexión a internet  
✅ **Modo Oscuro** - Interfaz adaptable para cualquier hora del día  
✅ **Mapas Integrados** - Recorridos y puntos de carga en Google Maps  
✅ **Responsive** - Optimizado para desktop, tablet y móvil  
✅ **Rápido** - Carga instantánea con datos en caché  

## 🏗️ Arquitectura de Datos

```
Firebase (datos en vivo)
        ↓ (si falla)
data.js (datos locales)
        ↓ (si no existen)
localStorage (caché)
        ↓ (si vacío)
Mostrar error
```

### Ver: [FALLBACK_STRATEGY.md](./FALLBACK_STRATEGY.md)

## 📱 Pantallas Soportadas

| Dispositivo | Ancho | Optimizado |
|-------------|-------|-----------|
| Desktop | 1024px+ | ✅ |
| Tablet | 768px-1023px | ✅ |
| Mobile | <768px | ✅ |

## 🚀 Instalación

### Requisitos
- Node.js 16+
- Conexión a internet (para Firebase)

### Setup Local

```bash
# 1. Clonar repositorio
git clone <repo-url>
cd Horarios-colectivos-Villa-Mercedes

# 2. Instalar dependencias
npm install

# 3. Configurar Firebase (opcional)
cp .env.example .env
# Editar .env con tus credenciales

# 4. Ejecutar servidor local
npm start
```

## 📋 Archivos Principales

| Archivo | Propósito | Estado |
|---------|-----------|--------|
| `index.html` | Estructura HTML | ✅ Producción |
| `main.js` | Lógica principal + fallback | ✅ Producción |
| `data.js` | Datos locales de backup | ✅ Producción |
| `styles.css` | Estilos y responsive | ✅ Producción |
| `config.js` | Configuración centralizada | ✅ Nuevo |
| `migrate-to-firebase.js` | Herramienta de migración | 📝 Desarrollo |

## ⚙️ Configuración

### Variables de Entorno (Opcional)
```bash
# .env
VITE_FIREBASE_API_KEY=your_key
VITE_FIREBASE_PROJECT_ID=your_project_id
# ... más variables
```

### Credenciales Firebase
Por defecto, se usan las credenciales en `index.html`. Para cambiar:
1. Crear proyecto en [Firebase Console](https://console.firebase.google.com)
2. Copiar configuración
3. Actualizar en `index.html` o `.env`

## 🔄 Flujo de Datos

### 1. **Primera Carga**
```
App inicia
    ↓
Intenta conectar Firebase
    ├─ ✅ Éxito: Carga datos, guarda en localStorage
    └─ ❌ Falla: Carga data.js → guarda en localStorage
    
App renderiza horarios
```

### 2. **Recarga Posterior**
```
App inicia
    ↓
Intenta conectar Firebase
    ├─ ✅ Éxito: Actualiza datos
    └─ ❌ Falla: Usa localStorage (más rápido)
```

### 3. **Sin Conexión**
```
Si Firebase falla:
    ├─ Busca localStorage
    └─ Si existe: Usa caché
    └─ Si no: Usa data.js
```

## 🛡️ Indicadores de Estado

En la pantalla verás:
- **Sin banner** = Datos de Firebase (en tiempo real)
- **📦 Datos en caché** = Usando localStorage
- **💾 Datos locales** = Usando data.js
- **❌ Error** = Sin datos disponibles

## 📊 Monitoreo

Abre la consola (F12) para ver logs detallados:

```javascript
✅ Datos cargados desde Firebase
✅ Usando datos locales (data.js)
✅ Usando datos cacheados en localStorage (desde: 2026-01-29T10:30:00Z)
❌ Firebase no disponible, intentando fallback...
❌ No hay datos disponibles
```

## 🧪 Testing

### Test Offline
1. Abre DevTools (F12)
2. Pestaña **Network** → selecciona **Offline**
3. Recarga la página
4. Debe mostrar horarios desde caché

### Test Fallback
```javascript
// En consola del navegador:
delete window.db;
location.reload();
// Debería cargar con fallback
```

### Limpiar Caché
```javascript
// En consola:
localStorage.clear();
location.reload();
```

## 📈 Performance

| Métrica | Valor | Nota |
|---------|-------|------|
| Tiempo inicial | <2s | Con Firebase |
| Con caché | <500ms | Sin Firebase |
| Actualización | 1 min | Intervalo configurable |
| Tamaño CSS | ~15KB | Minificado |
| Tamaño JS | ~25KB | Sin dependencias pesadas |

## 🔐 Seguridad

- ✅ Credenciales Firebase en HTML (es seguro - clave pública)
- ✅ Validación de datos en entrada
- ✅ Sin exposición de datos sensibles
- ✅ localStorage encriptado automáticamente en HTTPS

Para mayor seguridad:
- Usar `.env` para credenciales
- Validar reglas en Firebase Console
- Habilitar CORS restringido

## 🐛 Troubleshooting

### "No hay datos disponibles"
```bash
# 1. Verifica conexión a internet
# 2. Abre consola (F12) y busca errores
# 3. Limpia caché:
localStorage.clear();

# 4. Recarga: Ctrl+Shift+R (hard refresh)
```

### Horarios no se actualizan
```bash
# 1. Verifica que Firebase está configurado
# 2. Abre DevTools > Network > busca 'firebase'
# 3. Si no hay petición: Firebase desactivado o sin conexión
# 4. En console, ejecuta:
console.log(window.db); // Debe existir
```

### Modo oscuro no persiste
```bash
# localStorage está desactivado
# Habilita en navegador o usa HTTPS
```

## 📞 Soporte y Contacto

- **Email**: ignacioravelli@gmail.com
- **Reporte de bugs**: Abre un issue en GitHub
- **Sugerencias**: Envía un email

## 📄 Licencia

MIT License - Libre para usar y modificar

## 🎯 Roadmap

- [ ] Push notifications para horarios próximos
- [ ] App mobile nativa (React Native)
- [ ] Panel de administración para actualizar horarios
- [ ] Integración con Google Calendar
- [ ] Alertas de retrasos
- [ ] Historial de búsquedas

## 📚 Documentación Adicional

- [Estrategia de Fallback](./FALLBACK_STRATEGY.md) - Detalle técnico
- [Configuración](./config.js) - Variables configurables
- [API Firebase](./migrate-to-firebase.js) - Estructura de datos

---

**Última actualización**: 29 de enero de 2026  
**Versión**: 2.0 (con Fallback Inteligente)
