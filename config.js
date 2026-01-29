/**
 * Configuración centralizada de la aplicación
 * Permite cambiar comportamientos sin modificar main.js
 */

export const APP_CONFIG = {
    // Tiempo de actualización automática de horarios (ms)
    SCHEDULE_UPDATE_INTERVAL: 60000, // 1 minuto
    
    // Tiempo de actualización de hora (ms)
    TIME_UPDATE_INTERVAL: 1000, // 1 segundo
    
    // Timeout para Firebase (ms)
    FIREBASE_TIMEOUT: 5000, // 5 segundos
    
    // Claves de localStorage
    STORAGE_KEYS: {
        SCHEDULE_DATA: 'scheduleData_cache',
        SCHEDULE_TIMESTAMP: 'scheduleData_timestamp',
        DARK_MODE: 'darkMode'
    },
    
    // Colecciones de Firebase
    FIREBASE_COLLECTIONS: {
        LINES: 'lines',
        STOPS: 'stops'
    },
    
    // Validación de datos
    VALIDATION: {
        MIN_HOURS: 0,
        MAX_HOURS: 23,
        MIN_MINUTES: 0,
        MAX_MINUTES: 59,
        TIME_FORMAT: /^\d{2}:\d{2}$/, // HH:MM
    },
    
    // Mensajes de la aplicación
    MESSAGES: {
        DATA_SOURCE: {
            FIREBASE: '✅ Datos cargados desde Firebase',
            LOCAL: '✅ Usando datos locales (data.js)',
            CACHE: '✅ Usando datos cacheados en localStorage',
            OFFLINE: '❌ No hay datos disponibles'
        },
        ERROR: {
            FIREBASE_FAILED: '❌ Firebase no disponible, intentando fallback...',
            NO_DATA: '❌ No hay datos disponibles (Firebase, local ni cache)',
            INVALID_TIME: '⚠️ Formato de hora inválido',
            INVALID_RANGE: '⚠️ Hora fuera de rango',
        }
    },
    
    // Configuración de UI
    UI: {
        NEXT_SCHEDULES_COUNT: 3, // Mostrar próximos 3 horarios
        ANIMATION_DURATION: 300, // ms
    }
};

export default APP_CONFIG;
