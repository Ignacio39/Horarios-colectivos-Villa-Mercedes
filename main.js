import { collection, getDocs, addDoc, deleteDoc, doc, query, where, onSnapshot, updateDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { scheduleData as localScheduleData } from './data.js';

// Estado global para rastrear fuente de datos
let dataSource = 'unknown'; // 'firebase', 'local', 'localStorage'
let appState = {
    intervals: [],
    currentScheduleData: null,
    visitorId: null,
    visitorUnsubscribe: null
};

// ======== FUNCIONES DE VISITANTES ========
function generateVisitorId() {
    return `visitor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

async function registerVisitor() {
    try {
        if (!window.db) {
            console.warn('⚠️ Firebase no disponible para contador de visitantes');
            return;
        }

        const visitorId = generateVisitorId();
        appState.visitorId = visitorId;

        // Crear documento del visitante
        const visitorsRef = collection(window.db, 'visitors');
        const docRef = await addDoc(visitorsRef, {
            visitorId: visitorId,
            startTime: serverTimestamp(),
            lastActivity: serverTimestamp(),
            userAgent: navigator.userAgent.substring(0, 100),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        });

        console.log('✅ Visitante registrado:', visitorId);

        // Actualizar actividad cada 30 segundos
        const activityInterval = setInterval(async () => {
            try {
                await updateDoc(docRef, {
                    lastActivity: serverTimestamp()
                });
            } catch (error) {
                console.warn('Error actualizando actividad:', error);
                clearInterval(activityInterval);
            }
        }, 30000); // Cada 30 segundos

        appState.intervals.push(activityInterval);

        // Limpiar visitante cuando se cierre la página
        window.addEventListener('beforeunload', async () => {
            try {
                await deleteDoc(docRef);
            } catch (error) {
                console.warn('Error eliminando visitante:', error);
            }
        });

        // Escuchar cambios en el contador
        subscribeToVisitorCount();

    } catch (error) {
        console.error('Error registrando visitante:', error);
    }
}

function subscribeToVisitorCount() {
    try {
        if (!window.db) return;

        const visitorsRef = collection(window.db, 'visitors');
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

        // Escuchar visitantes activos (últimas 5 minutos)
        const q = query(visitorsRef, where('lastActivity', '>', fiveMinutesAgo));

        if (appState.visitorUnsubscribe) {
            appState.visitorUnsubscribe();
        }

        appState.visitorUnsubscribe = onSnapshot(q, (snapshot) => {
            const count = snapshot.size;
            updateVisitorCountDisplay(count);
            console.log(`👥 Visitantes activos: ${count}`);
        }, (error) => {
            console.warn('Error escuchando visitantes:', error);
        });

    } catch (error) {
        console.error('Error suscribiendo a contador:', error);
    }
}

function updateVisitorCountDisplay(count) {
    const badge = document.getElementById('visitorCountBadge');
    if (badge) {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'block' : 'none';
        
        // Pequeña animación
        badge.style.animation = 'none';
        setTimeout(() => {
            badge.style.animation = 'pulse 0.5s ease-in-out';
        }, 10);
    }
}

// Limpiar visitantes inactivos cada 2 minutos
function startCleanupInterval() {
    const cleanupInterval = setInterval(async () => {
        try {
            if (!window.db) return;

            const visitorsRef = collection(window.db, 'visitors');
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

            // Buscar visitantes inactivos (más de 5 minutos sin actividad)
            const q = query(visitorsRef, where('lastActivity', '<', fiveMinutesAgo));
            const snapshot = await getDocs(q);

            let cleaned = 0;
            for (const docSnapshot of snapshot.docs) {
                await deleteDoc(doc(window.db, 'visitors', docSnapshot.id));
                cleaned++;
            }

            if (cleaned > 0) {
                console.log(`🗑️ Limpiados ${cleaned} visitantes inactivos`);
            }
        } catch (error) {
            console.warn('Error en limpieza de visitantes:', error);
        }
    }, 120000); // Cada 2 minutos

    appState.intervals.push(cleanupInterval);
}

// ======== FUNCIONES DE CLIMA ========
async function getWeather() {
    try {
        // Coordenadas de Villa Mercedes (Argentina)
        const lat = -35.4167;
        const lon = -65.4667;
        
        const response = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,relative_humidity_2m&timezone=America/Argentina/Buenos_Aires`,
            { signal: AbortSignal.timeout(5000) }
        );
        
        if (!response.ok) throw new Error('API no disponible');
        
        const data = await response.json();
        const current = data.current;
        
        return {
            temp: Math.round(current.temperature_2m),
            condition: getWeatherDescription(current.weather_code),
            icon: getWeatherIcon(current.weather_code),
            humidity: current.relative_humidity_2m
        };
    } catch (error) {
        console.warn('⚠️ No se pudo cargar el clima en tiempo real:', error.message);
        return null;
    }
}

function getWeatherIcon(code) {
    const icons = {
        0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️',
        45: '🌫️', 48: '🌫️',
        51: '🌧️', 53: '🌧️', 55: '🌧️',
        61: '🌧️', 63: '🌧️', 65: '🌧️',
        71: '🌨️', 73: '🌨️', 75: '🌨️',
        80: '⛈️', 81: '⛈️', 82: '⛈️',
        95: '⛈️', 96: '⛈️', 99: '⛈️'
    };
    return icons[code] || '🌤️';
}

function getWeatherDescription(code) {
    const descriptions = {
        0: 'Despejado', 1: 'Parcialmente nublado', 2: 'Nublado', 3: 'Nublado',
        45: 'Niebla', 48: 'Niebla',
        51: 'Llovizna', 53: 'Llovizna', 55: 'Llovizna fuerte',
        61: 'Lluvia', 63: 'Lluvia', 65: 'Lluvia fuerte',
        71: 'Nieve', 73: 'Nieve', 75: 'Nieve fuerte',
        80: 'Lluvia fuerte', 81: 'Lluvia muy fuerte', 82: 'Lluvia extrema',
        95: 'Tormenta', 96: 'Tormenta con granizo', 99: 'Tormenta fuerte'
    };
    return descriptions[code] || 'Desconocido';
}

async function getWeatherWithFallback() {
    let weather = await getWeather();
    
    if (!weather) {
        // Intentar usar el clima guardado
        try {
            const cached = localStorage.getItem('cachedWeather');
            if (cached) {
                weather = JSON.parse(cached);
                console.log('⚠️ Usando clima en caché');
            }
        } catch (e) {
            console.warn('No hay clima en caché disponible');
        }
    } else {
        // Guardar para fallback
        try {
            localStorage.setItem('cachedWeather', JSON.stringify(weather));
        } catch (e) {
            console.warn('No se pudo guardar clima en caché');
        }
    }
    
    return weather;
}

function displayWeather(weather) {
    if (!weather) {
        document.getElementById('temp').textContent = '--°C';
        document.getElementById('weather-condition').textContent = '❓';
        document.getElementById('weather-desc').textContent = 'No disponible';
        document.getElementById('humidity').textContent = '--%';
        return;
    }
    
    document.getElementById('temp').textContent = `${weather.temp}°C`;
    document.getElementById('weather-condition').textContent = weather.icon;
    document.getElementById('weather-desc').textContent = weather.condition;
    document.getElementById('humidity').textContent = `${weather.humidity}%`;
    console.log('✅ Clima actualizado:', weather);
}

// ======== FUNCIONES DE GEOLOCALIZACIÓN ========

// Coordenadas aproximadas de paradas en Villa Mercedes
const stopsCoordinates = {
    // Línea A
    'Salida Facultad': [-35.4150, -65.4680],
    'Terminal': [-35.4165, -65.4670],
    'Balcarce y Urquiza': [-35.4175, -65.4665],
    'L.Guillet y G.Paz': [-35.4185, -65.4660],
    'Entrada Ate II': [-35.4195, -65.4655],
    'Salida F.Sarmiento': [-35.4205, -65.4650],
    'Nelson e Yrigoyen': [-35.4215, -65.4645],
    'G.Paz y Maipu': [-35.4225, -65.4640],
    'Llegada Facultad': [-35.4235, -65.4635],
    
    // Línea E
    'Plaza': [-35.4160, -65.4675],
    'Hospital': [-35.4170, -65.4670],
    'Policlínico Regional': [-35.4180, -65.4665],
    'Centro Comercial': [-35.4190, -65.4660],
    'Universidad': [-35.4200, -65.4655],
    'Polideportivo': [-35.4210, -65.4650],
    'Teatro Municipal': [-35.4220, -65.4645],
    
    // Zona Este
    'Plaza Central': [-35.4155, -65.4680],
    'Escuela Nº 5': [-35.4165, -65.4675],
    'Parque Industrial': [-35.4175, -65.4670],
    'Centro Deportivo': [-35.4185, -65.4665],
    'Biblioteca Municipal': [-35.4195, -65.4660],
    
    // Zona Oeste
    'Barrio Oeste': [-35.4145, -65.4685],
    'Zona Comercial': [-35.4155, -65.4680],
    'Parque Municipal': [-35.4165, -65.4675],
    
    // Paradas adicionales (de data.js)
    'M.Ernst y Cazorla': [-35.4155, -65.4682],
    'Hospital La Ribera': [-35.4165, -65.4677],
    'Escuela Agraria': [-35.4175, -65.4672],
    'Ayacucho y Balcarce': [-35.4185, -65.4667],
    'Policlinico': [-35.4195, -65.4662],
    'Llegada Terminal': [-35.4205, -65.4657],
    'Salida Terminal': [-35.4215, -65.4652],
    'Hospital de la Villa': [-35.4225, -65.4647],
    'Balcarce y Riobamba': [-35.4235, -65.4642],
    'Entrada Bº La Ribera': [-35.4245, -65.4637],
    'Pellegrini y Nelson': [-35.4145, -65.4690],
    'Maipu y Avila': [-35.4155, -65.4685],
    'Tucuman y Tallaferro': [-35.4165, -65.4680],
    'Potosi y Belgrano': [-35.4175, -65.4675],
    'Lainez y Sallorenzo': [-35.4185, -65.4670],
    '3 de Febrero y 25 de Mayo': [-35.4195, -65.4665],
    'Balcarce y Maipu': [-35.4205, -65.4660],
    'E.Aguero y L.Guillet': [-35.4215, -65.4655],
    'Gauna y Maipu': [-35.4225, -65.4650],
    'Htal Bº Eva Peron': [-35.4235, -65.4645],
    'Hospital Bº Eva Peron': [-35.4235, -65.4645],
    'Chacabuco y Guemes': [-35.4145, -65.4685],
    'Llerena y Sallorenzo': [-35.4155, -65.4680],
    'Balcarce y Ayacucho': [-35.4165, -65.4675]
};

function calculateDistance(lat1, lon1, lat2, lon2) {
    // Fórmula Haversine para calcular distancia en km
    const R = 6371; // Radio de la Tierra en km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

async function requestUserLocation() {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            console.warn('⚠️ Geolocalización no disponible');
            resolve(null);
            return;
        }
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                console.log('✅ Ubicación obtenida:', latitude, longitude);
                localStorage.setItem('userLocation', JSON.stringify({ latitude, longitude }));
                localStorage.setItem('locationTimestamp', new Date().toISOString());
                resolve({ latitude, longitude });
            },
            (error) => {
                console.warn('❌ Error al obtener ubicación:', error.message);
                resolve(null);
            },
            { timeout: 5000, enableHighAccuracy: false }
        );
    });
}

function getUserLocation() {
    const cached = localStorage.getItem('userLocation');
    if (cached) {
        try {
            return JSON.parse(cached);
        } catch (e) {
            return null;
        }
    }
    return null;
}

function sortStopsByProximity(stops, userLocation) {
    if (!userLocation) return stops;
    
    const { latitude, longitude } = userLocation;
    
    const stopsWithDistance = stops.map(stop => {
        const coords = stopsCoordinates[stop];
        if (!coords) {
            return { stop, distance: Infinity };
        }
        const distance = calculateDistance(latitude, longitude, coords[0], coords[1]);
        return { stop, distance };
    });
    
    // Ordenar por distancia
    stopsWithDistance.sort((a, b) => a.distance - b.distance);
    
    return stopsWithDistance.map(item => item.stop);
}

function showLocationPrompt() {
    // Verificar si ya pedimos ubicación antes
    const hasAskedLocation = localStorage.getItem('hasAskedLocation');
    if (hasAskedLocation) return;
    
    // Crear notificación para pedir ubicación
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 20px;
        border-radius: 10px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.2);
        z-index: 9999;
        max-width: 350px;
        font-size: 14px;
    `;
    
    notification.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: start; gap: 15px;">
            <div>
                <div style="font-weight: bold; margin-bottom: 8px;">📍 Ordenar paradas por proximidad</div>
                <div style="opacity: 0.9; font-size: 13px;">¿Permitir acceso a tu ubicación para mostrar las paradas más cercanas?</div>
            </div>
            <button id="locationAllow" style="
                background: #48bb78;
                border: none;
                color: white;
                padding: 8px 12px;
                border-radius: 5px;
                cursor: pointer;
                font-size: 12px;
                font-weight: bold;
                white-space: nowrap;
            ">Permitir</button>
            <button id="locationDeny" style="
                background: rgba(255,255,255,0.2);
                border: none;
                color: white;
                padding: 8px 12px;
                border-radius: 5px;
                cursor: pointer;
                font-size: 12px;
                white-space: nowrap;
            ">Ahora no</button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    document.getElementById('locationAllow').addEventListener('click', async () => {
        localStorage.setItem('hasAskedLocation', 'true');
        notification.remove();
        const location = await requestUserLocation();
        if (location) {
            // Recargar paradas con nuevo orden
            window.location.reload();
        }
    });
    
    document.getElementById('locationDeny').addEventListener('click', () => {
        localStorage.setItem('hasAskedLocation', 'true');
        notification.remove();
    });
}

function saveSortOrder(lineName, stopsOrder) {
    const sortOrder = JSON.parse(localStorage.getItem('stopsSortOrder') || '{}');
    sortOrder[lineName] = stopsOrder;
    localStorage.setItem('stopsSortOrder', JSON.stringify(sortOrder));
    console.log('💾 Orden guardado para', lineName);
}

function getSortOrder(lineName) {
    const sortOrder = JSON.parse(localStorage.getItem('stopsSortOrder') || '{}');
    return sortOrder[lineName] || null;
}

function applySortOrder(stopsGrid, lineName, originalStops) {
    const sortOrder = getSortOrder(lineName);
    if (!sortOrder || sortOrder.length === 0) return;
    
    const cards = Array.from(stopsGrid.children);
    const sortedCards = [];
    
    for (const stopName of sortOrder) {
        const card = cards.find(c => c.dataset.stopName === stopName);
        if (card) sortedCards.push(card);
    }
    
    // Agregar cualquier parada que no esté en el orden guardado
    for (const card of cards) {
        if (!sortedCards.includes(card)) {
            sortedCards.push(card);
        }
    }
    
    // Limpiar y re-agregar en el nuevo orden
    stopsGrid.innerHTML = '';
    for (const card of sortedCards) {
        stopsGrid.appendChild(card);
    }
    
    console.log('✅ Orden restaurado para', lineName);
}

function setupDragAndDrop(stopsGrid, lineName) {
    // Usar mousedown/mouseup en lugar de drag events para mayor compatibilidad
    let isDragging = false;
    let draggedCard = null;
    let ghostElement = null;
    
    stopsGrid.addEventListener('mousedown', (e) => {
        const card = e.target.closest('.stop-card');
        if (!card) return;
        
        isDragging = true;
        draggedCard = card;
        offsetY = e.clientY - card.getBoundingClientRect().top;
        
        // Crear elemento fantasma
        ghostElement = card.cloneNode(true);
        ghostElement.style.position = 'fixed';
        ghostElement.style.opacity = '0.7';
        ghostElement.style.pointerEvents = 'none';
        ghostElement.style.zIndex = '10000';
        ghostElement.style.boxShadow = '0 10px 30px rgba(0,0,0,0.3)';
        document.body.appendChild(ghostElement);
        
        card.style.opacity = '0.4';
        card.style.border = '2px dashed #4299e1';
        
        console.log('🎯 Drag iniciado:', card.dataset.stopName);
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isDragging || !draggedCard) return;
        
        // Mover elemento fantasma
        if (ghostElement) {
            ghostElement.style.left = e.clientX + 'px';
            ghostElement.style.top = (e.clientY - offsetY) + 'px';
        }
        
        // Detectar card bajo el cursor
        const cardUnderCursor = document.elementFromPoint(e.clientX, e.clientY)?.closest('.stop-card');
        
        // Limpiar estilos previos
        stopsGrid.querySelectorAll('.stop-card').forEach(card => {
            card.style.borderTop = '';
            card.style.paddingTop = '15px';
        });
        
        // Aplicar estilo a la card bajo el cursor
        if (cardUnderCursor && cardUnderCursor !== draggedCard && cardUnderCursor.closest('.stops-grid') === stopsGrid) {
            cardUnderCursor.style.borderTop = '3px solid #4299e1';
            cardUnderCursor.style.paddingTop = '12px';
        }
    });
    
    document.addEventListener('mouseup', (e) => {
        if (!isDragging || !draggedCard) return;
        
        isDragging = false;
        
        // Remover elemento fantasma
        if (ghostElement) {
            ghostElement.remove();
            ghostElement = null;
        }
        
        // Restaurar estilo
        draggedCard.style.opacity = '1';
        draggedCard.style.border = '';
        
        // Detectar card destino
        const cardTarget = document.elementFromPoint(e.clientX, e.clientY)?.closest('.stop-card');
        
        if (cardTarget && cardTarget !== draggedCard && cardTarget.closest('.stops-grid') === stopsGrid) {
            // Determinar posición relativa
            const allCards = Array.from(stopsGrid.children);
            const draggedIndex = allCards.indexOf(draggedCard);
            const targetIndex = allCards.indexOf(cardTarget);
            
            // Intercambiar
            if (draggedIndex < targetIndex) {
                cardTarget.parentNode.insertBefore(draggedCard, cardTarget.nextSibling);
            } else {
                cardTarget.parentNode.insertBefore(draggedCard, cardTarget);
            }
            
            console.log('✅ Parada movida:', draggedCard.dataset.stopName);
        }
        
        // Limpiar estilos
        stopsGrid.querySelectorAll('.stop-card').forEach(card => {
            card.style.borderTop = '';
            card.style.paddingTop = '15px';
        });
        
        // Guardar nuevo orden
        const newOrder = Array.from(stopsGrid.children).map(c => c.dataset.stopName);
        saveSortOrder(lineName, newOrder);
        
        draggedCard = null;
    });
}

// Función para cargar datos desde Firebase CON FALLBACK
async function loadScheduleDataFromFirebase() {
    try {
        const scheduleSnapshot = await getDocs(collection(db, 'lines'));
        const firebaseData = {};
        
        if (scheduleSnapshot.empty) {
            console.warn('Firebase vacío, usando fallback local');
            throw new Error('No data in Firebase');
        }
        
        scheduleSnapshot.forEach((doc) => {
            const lineData = doc.data();
            firebaseData[lineData.name] = {
                stops: lineData.stops,
                schedules: lineData.schedules
            };
        });
        
        console.log('✅ Datos cargados desde Firebase');
        dataSource = 'firebase';
        
        // Guardar en localStorage como respaldo
        localStorage.setItem('scheduleData_cache', JSON.stringify(firebaseData));
        localStorage.setItem('scheduleData_timestamp', new Date().toISOString());
        
        return firebaseData;
    } catch (firebaseError) {
        console.warn('❌ Firebase no disponible, intentando fallback...', firebaseError.message);
        return loadScheduleDataFromFallback();
    }
}

// Función de FALLBACK: intenta local data, luego localStorage
function loadScheduleDataFromFallback() {
    // Opción 1: Usar datos locales en memoria (data.js)
    if (localScheduleData && Object.keys(localScheduleData).length > 0) {
        console.log('✅ Usando datos locales (data.js)');
        dataSource = 'local';
        return localScheduleData;
    }
    
    // Opción 2: Usar datos cacheados en localStorage
    const cachedData = localStorage.getItem('scheduleData_cache');
    if (cachedData) {
        try {
            const parsedData = JSON.parse(cachedData);
            const timestamp = localStorage.getItem('scheduleData_timestamp');
            console.log('✅ Usando datos cacheados en localStorage (desde:', timestamp, ')');
            dataSource = 'localStorage';
            return parsedData;
        } catch (error) {
            console.error('Error al parsear datos cacheados:', error);
        }
    }
    
    // Opción 3: No hay datos disponibles
    console.error('❌ No hay datos disponibles (Firebase, local ni cache)');
    dataSource = 'offline';
    return null;
}

// Función para encontrar el próximo horario CON VALIDACIÓN
function findNextSchedules(schedules, currentTime) {
    const next = [];
    
    // Validar que schedules sea un array
    if (!Array.isArray(schedules) || schedules.length === 0) {
        return next;
    }
    
    for (const time of schedules) {
        try {
            // Validar formato HH:MM
            if (typeof time !== 'string' || !time.match(/^\d{2}:\d{2}$/)) {
                console.warn(`⚠️ Formato de hora inválido: "${time}"`);
                continue;
            }
            
            const [hours, minutes] = time.split(':').map(Number);
            
            // Validar rangos
            if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
                console.warn(`⚠️ Hora fuera de rango: ${time}`);
                continue;
            }
            
            const scheduleTime = hours * 60 + minutes;
            const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
            
            if (scheduleTime >= currentMinutes) {
                next.push(time);
                if (next.length >= 3) break;
            }
        } catch (error) {
            console.error(`❌ Error procesando horario "${time}":`, error);
        }
    }
    
    return next;
}

// Función para mostrar los horarios CON INDICADOR DE FUENTE
async function displaySchedules(scheduleData) {
    const linesContainer = document.getElementById('linesContainer');
    const now = new Date();
    const days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const currentDay = days[now.getDay()];
    
    // Cargar y mostrar clima
    const weather = await getWeatherWithFallback();
    displayWeather(weather);
    
    // Si no hay datos, mostrar error
    if (!scheduleData || Object.keys(scheduleData).length === 0) {
        linesContainer.innerHTML = `
            <div class="error-message">
                <strong>⚠️ No hay datos disponibles</strong>
                <p>No se pudo conectar con Firebase ni se encontraron datos locales.</p>
                <p>Por favor, verifica tu conexión a internet.</p>
            </div>
        `;
        return;
    }
    
    linesContainer.innerHTML = ''; // Limpiar el contenedor
    
    // Mostrar indicador de fuente de datos
    if (dataSource === 'localStorage' || dataSource === 'local') {
        const dataSourceBanner = document.createElement('div');
        dataSourceBanner.className = 'data-source-banner';
        dataSourceBanner.innerHTML = `
            <span>${dataSource === 'localStorage' ? '📦 Datos en caché' : '💾 Datos locales'}</span>
            ${dataSource === 'localStorage' ? '<small>(sin conexión a Firebase)</small>' : ''}
        `;
        linesContainer.parentElement.insertBefore(dataSourceBanner, linesContainer);
    }
    
    for (const [lineName, lineData] of Object.entries(scheduleData)) {
        const lineElement = document.createElement('div');
        lineElement.className = 'line-card';
        
        // Crear el encabezado de la línea
        const lineHeader = document.createElement('div');
        lineHeader.className = 'line-header';
        lineHeader.innerHTML = `
            <div class="line-badge">${lineName}</div>
            <h2>${lineName}</h2>
        `;
        
        // Crear el contenedor de paradas
        const stopsGrid = document.createElement('div');
        stopsGrid.className = 'stops-grid';
        
        // Obtener ubicación del usuario para ordenar por proximidad
        let stopsToDisplay = lineData.stops;
        const userLocation = getUserLocation();
        if (userLocation) {
            stopsToDisplay = sortStopsByProximity(lineData.stops, userLocation);
            console.log('📍 Paradas ordenadas por proximidad para', lineName);
        }
        
        // Procesar cada parada
        for (const stop of stopsToDisplay) {
            const schedules = lineData.schedules[currentDay]?.[stop] || [];
            const nextSchedules = findNextSchedules(schedules, now);
            
            const stopCard = document.createElement('div');
            stopCard.className = 'stop-card';
            stopCard.draggable = true;
            stopCard.dataset.stopName = stop;
            stopCard.style.cursor = 'grab';
            
            let scheduleDisplay;
            if (nextSchedules.length > 0) {
                const [next, ...upcoming] = nextSchedules;
                scheduleDisplay = `
                    <div class="stop-name">${stop}</div>
                    <div class="next-bus">Próximo: ${next}</div>
                    ${upcoming.length > 0 ? 
                        `<div class="upcoming">Siguientes: ${upcoming.join(', ')}</div>` : 
                        ''}
                `;
            } else {
                scheduleDisplay = `
                    <div class="stop-name">${stop}</div>
                    <div class="no-service">No hay más servicios hoy</div>
                `;
            }
            
            stopCard.innerHTML = scheduleDisplay;
            stopsGrid.appendChild(stopCard);
        }
        
        // Restaurar orden guardado y habilitar drag & drop
        applySortOrder(stopsGrid, lineName, stopsToDisplay);
        setupDragAndDrop(stopsGrid, lineName);
        
        lineElement.appendChild(lineHeader);
        lineElement.appendChild(stopsGrid);
        linesContainer.appendChild(lineElement);
    }
    
    // Mostrar prompt de ubicación
    showLocationPrompt();
}

// Función para mostrar la hora actual
function updateCurrentTime() {
    const now = new Date();
    const timeElement = document.getElementById('currentTime');
    const dateElement = document.getElementById('currentDate');
    
    // Formatear hora en formato HH:MM (24 horas)
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const newTime = `${hours}:${minutes}`;
    
    if (timeElement.textContent !== newTime) {
        requestAnimationFrame(() => {
            timeElement.textContent = newTime;
        });
    }
    
    // Formatear fecha (solo si cambia el día)
    const currentDate = timeElement.dataset.currentDate || '';
    const newDate = now.toDateString();
    
    if (currentDate !== newDate) {
        const days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
        const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
        
        const dayName = days[now.getDay()];
        const day = now.getDate();
        const month = months[now.getMonth()];
        const year = now.getFullYear();
        
        timeElement.dataset.currentDate = newDate;
        requestAnimationFrame(() => {
            dateElement.textContent = `${dayName}, ${day} de ${month} de ${year}`;
        });
    }
}

// Función para cambiar entre mapas
window.showMap = function(mapType) {
    const routesMap = document.getElementById('routesMap');
    const chargeMap = document.getElementById('chargeMap');
    const buttons = document.querySelectorAll('.map-button');
    
    buttons.forEach(button => button.classList.remove('active'));
    
    if (mapType === 'routes') {
        routesMap.style.display = 'block';
        chargeMap.style.display = 'none';
        buttons[0].classList.add('active');
    } else if (mapType === 'charge') {
        routesMap.style.display = 'none';
        chargeMap.style.display = 'block';
        buttons[1].classList.add('active');
    }
}

// Función para alternar el modo oscuro CON PERSISTENCIA
window.toggleNightMode = function() {
    document.body.classList.toggle('dark-mode');
    const isDarkMode = document.body.classList.contains('dark-mode');
    localStorage.setItem('darkMode', isDarkMode.toString());
    console.log(`🌙 Modo oscuro: ${isDarkMode ? 'activado' : 'desactivado'}`);
}

async function initializeApp() {
    try {
        // Registrar visitante y mostrar contador
        registerVisitor();
        startCleanupInterval();

        // Cargar datos (con fallback automático)
        const scheduleData = await loadScheduleDataFromFirebase();
        appState.currentScheduleData = scheduleData;
        
        // Mostrar los horarios
        await displaySchedules(scheduleData);
        
        // Actualizar la hora cada minuto (granularidad suficiente para horarios)
        updateCurrentTime();
        const timeInterval = setInterval(updateCurrentTime, 60000);
        appState.intervals.push(timeInterval);
        
        // Actualizar los horarios cada minuto (solo si tenemos datos)
        if (scheduleData) {
            const scheduleInterval = setInterval(() => {
                displaySchedules(appState.currentScheduleData);
            }, 60000);
            appState.intervals.push(scheduleInterval);
        }
        
        // Restaurar preferencia de modo oscuro
        const isDarkMode = localStorage.getItem('darkMode') === 'true';
        if (isDarkMode) {
            document.body.classList.add('dark-mode');
        }
        
        // Mostrar mapa de rutas por defecto
        showMap('routes');
        
        console.log(`✅ Aplicación inicializada con éxito (Fuente: ${dataSource})`);
        
    } catch (error) {
        console.error('Error al inicializar la aplicación:', error);
        // Mostrar mensaje de error al usuario
        const linesContainer = document.getElementById('linesContainer');
        linesContainer.innerHTML = `
            <div class="error-message">
                ❌ Hubo un error al cargar los horarios. 
                <br>Por favor, intente nuevamente más tarde.
            </div>
        `;
    }
}

// Función para limpiar recursos
function cleanupApp() {
    appState.intervals.forEach(interval => clearInterval(interval));
    appState.intervals = [];
    appState.currentScheduleData = null;
    
    // Desuscribirse del contador de visitantes
    if (appState.visitorUnsubscribe) {
        appState.visitorUnsubscribe();
    }
}

// Limpiar al cerrar/recargar página
window.addEventListener('beforeunload', cleanupApp);

// Iniciar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', initializeApp);

// Datos de horarios organizados por línea (respaldo local)
// NOTA: Las claves de días DEBEN coincidir con: 'domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'
export const scheduleData = {
    'Línea A': {
        stops: [
            'Salida Facultad', 'Terminal', 'Balcarce y Urquiza', 'L.Guillet y G.Paz', 
            'Entrada Ate II', 'Salida F.Sarmiento', 'Nelson e Yrigoyen', 'G.Paz y Maipu', 
            'Llegada Facultad'
        ],
        schedules: {
            'domingo': {
                'Salida Facultad': ['06:22','08:01','08:34','09:07','09:40','10:13','10:46','11:19','11:52','12:25','12:58','13:31','14:04','14:37','15:10','15:43','16:16','16:49','17:22','17:55','18:28','19:01','19:34','20:07','20:40','21:13','21:46','22:19','22:52','23:25'],
                'Terminal': ['06:31','08:10','08:43','09:16','09:49','10:22','10:55','11:28','12:01','12:34','13:07','13:40','14:13','14:46','15:19','15:52','16:25','16:58','17:31','18:04','18:37','19:10','19:43','20:16','20:49','21:22','21:55','22:28','23:01','23:34'],
                'Balcarce y Urquiza': ['06:41','08:20','08:53','09:26','09:59','10:32','11:05','11:38','12:11','12:44','13:17','13:50','14:23','14:56','15:29','16:02','16:35','17:08','17:41','18:14','18:47','19:20','19:53','20:26','20:59','21:32','22:05','22:38','23:11','23:42'],
                'L.Guillet y G.Paz': ['06:47','08:26','08:59','09:32','10:05','10:38','11:11','11:44','12:17','12:50','13:23','13:56','14:29','15:02','15:35','16:08','16:41','17:14','17:47','18:20','18:53','19:26','19:59','20:32','21:05','21:38','22:11','22:44','23:17','23:46'],
                'Entrada Ate II': ['06:59','08:38','09:11','09:44','10:17','10:50','11:23','11:56','12:29','13:02','13:35','14:08','14:41','15:14','15:47','16:20','16:53','17:26','17:59','18:32','19:05','19:38','20:11','20:44','21:17','21:50','22:23','22:56','23:29'],
                'Salida F.Sarmiento': ['07:12','08:51','09:24','09:57','10:30','11:03','11:36','12:09','12:42','13:15','13:48','14:21','14:54','15:27','16:00','16:33','17:06','17:39','18:12','18:45','19:18','19:51','20:24','20:57','21:30','22:03','22:36','23:09','23:43','00:11'],
                'Nelson e Yrigoyen': ['07:24','09:03','09:36','10:09','10:42','11:15','11:48','12:21','12:54','13:27','14:00','14:33','15:06','15:39','16:12','16:45','17:18','17:51','18:24','18:57','19:30','20:03','20:36','21:09','21:42','22:15','22:48','23:21','23:54'],
                'G.Paz y Maipu': ['07:36','09:15','09:48','10:21','10:54','11:27','12:00','12:33','13:06','13:39','14:12','14:45','15:18','15:51','16:24','16:57','17:30','18:03','18:36','19:09','19:42','20:15','20:48','21:21','21:54','22:27','23:00','23:33'],
                'Llegada Facultad': ['07:46','09:25','09:58','10:31','11:04','11:37','12:10','12:43','13:16','13:49','14:22','14:55','15:28','16:01','16:34','17:07','17:40','18:13','18:46','19:19','19:52','20:25','20:58','21:31','22:04','22:37','23:10','23:43']
            },
            'lunes': {
                'Salida Facultad': ['05:18', '06:09', '06:26', '07:00', '07:17', '07:34', '07:51', '08:08', '08:25', '08:42', '08:59', '09:16', '09:33', '09:50', '10:07', '10:24', '10:41', '10:58', '11:15', '11:32', '11:49', '12:06', '12:23', '12:40', '12:57', '13:14', '13:31', '14:05', '14:22',
                                    '14:56', '15:13', '16:04', '16:21', '16:38', '16:55', '17:12', '17:29', '18:03', '18:20', '18:37', '18:54', '19:11', '19:28', '19:45', '20:02', '20:19', '20:36', '20:53', '21:27', '22:35', '23:30'],
                'Terminal': ['05:30', '06:21', '06:38', '07:12', '07:29', '07:46', '08:03', '08:20', '08:37', '08:54', '09:11', '09:28', '09:45', '10:02', '10:19', '10:36', '10:53', '11:10', '11:27', '11:44', '12:01', '12:18', '12:35', '12:52', '13:09', '13:26', '13:43', '14:17', '14:34',
                            '15:08', '15:25', '16:16', '16:33', '16:50', '17:07', '17:24', '17:41', '18:15', '18:32', '18:49', '19:06', '19:23', '19:40', '20:31', '20:48', '21:05', '21:39', '22:47', '00:02'],
                'Balcarce y Urquiza': ['05:44', '06:35', '06:52', '07:26', '07:43', '08:00', '08:17', '08:34', '08:51', '09:08', '09:25', '09:42', '09:59', '10:16', '10:33', '10:50', '11:07', '11:24', '11:41', '11:58', '12:15', '12:32', '12:49', '13:06', '13:23', '13:40', '13:57', '14:31', '14:48',
                                    '15:22', '15:39', '16:30', '16:47', '17:04', '17:21', '17:38', '17:55', '18:29', '18:46', '19:03', '19:20', '19:37', '19:54', '20:45', '21:02', '21:19', '21:53', '23:01', '00:09'],
                'L.Guillet y G.Paz': ['05:51', '06:42', '06:59', '07:33', '07:50', '08:07', '08:24', '08:41', '08:58', '09:15', '09:32', '09:49', '10:06', '10:23', '10:40', '10:57', '11:14', '11:31', '11:48', '12:05', '12:22', '12:39', '12:56', '13:13', '13:30', '13:47', '14:04', '14:38', '14:55', 
                                   '15:29', '15:46', '16:33', '16:47', '17:04', '17:11', '17:28', '17:45', '18:19', '18:36', '18:53', '19:10', '19:27', '19:44', '20:01', '20:18', '20:35', '20:52', '21:09', '21:26', '22:00', '23:08', '00:16'],
                'Entrada Ate II': ['06:03', '06:54', '07:11', '07:45', '08:02', '08:19', '08:36', '08:53', '09:10', '09:27', '09:44', '10:01', '10:18', '10:35', '10:52', '11:09', '11:26', '11:43', '12:00', '12:17', '12:34', '12:51', '13:08', '13:25', '13:42', '13:59', '14:16', '14:50', '15:07',
                                  '15:41', '15:58', '16:49', '17:06', '17:23', '17:40', '17:57', '18:14', '18:48', '19:05', '19:22', '19:39', '19:56', '20:13', '20:30', '20:47', '21:04', '21:21', '21:38', '22:12', '23:20'],
                'Salida F.Sarmiento': ['06:17', '07:08', '07:25', '07:59', '08:16', '08:33', '08:50', '09:07', '09:24', '09:41', '09:58', '10:15', '10:32', '10:49', '11:06', '11:23', '11:40', '11:57', '12:14', '12:31', '12:48', '13:05', '13:22', '13:39', '13:56', '14:13', '14:30', '15:04', '15:21',
                                      '15:55', '16:12', '17:03', '17:20', '17:37', '17:54', '18:11', '18:28', '19:02', '19:19', '19:36', '19:53', '20:10', '20:27', '20:44', '21:01', '21:18', '21:35', '21:52', '22:26', '23:34'],
                'Nelson e Yrigoyen': ['06:31', '07:22', '07:39', '08:13', '08:30', '08:47', '09:04', '09:21', '09:38', '09:55', '10:12', '10:29', '10:46', '11:03', '11:20', '11:37', '11:54', '12:11', '12:28', '12:45', '13:02', '13:19', '13:36', '13:53', '14:10', '14:27', '14:44', '15:18', '15:35',
                                     '16:09', '16:26', '17:17', '17:34', '17:51', '18:08', '18:25', '18:42', '19:16', '19:33', '19:50', '20:07', '20:24', '20:41', '20:58', '21:15', '21:32', '21:49', '22:06', '22:40', '23:48'],
                'G.Paz y Maipu': ['06:47', '07:38', '07:55', '08:29', '08:46', '09:03', '09:20', '09:37', '09:54', '10:11', '10:28', '10:45', '11:02', '11:19', '11:36', '11:53', '12:10', '12:27', '12:44', '13:01', '13:18', '13:35', '13:52', '14:09', '14:26', '14:43', '15:00', '15:34', '15:51',
                                 '16:25', '16:42', '17:33', '17:50', '18:07', '18:24', '18:41', '18:58', '19:32', '19:49', '20:06', '20:23', '20:40', '20:57', '21:14', '21:31', '21:48', '22:05', '22:22', '22:56', '00:13'],
                'Llegada Facultad': ['07:02', '07:53', '08:10', '08:44', '09:01', '09:18', '09:35', '09:52', '10:09', '10:26', '10:43', '11:00', '11:17', '11:34', '11:51', '12:08', '12:25', '12:42', '12:59', '13:16', '13:33', '13:50', '14:07', '14:24', '14:41', '14:58', '15:15', '15:49', '16:06',
                                    '16:40', '16:57', '17:48', '18:05', '18:22', '18:39', '18:56', '19:13', '19:47', '20:04', '20:21', '20:38', '20:50', '21:12', '21:29', '21:46', '22:03', '22:20', '22:37', '23:11', '00:30']
            },
            'martes': {
                'Salida Facultad': ['05:18', '06:09', '06:26', '07:00', '07:17', '07:34', '07:51', '08:08', '08:25', '08:42', '08:59', '09:16', '09:33', '09:50', '10:07', '10:24', '10:41', '10:58', '11:15', '11:32', '11:49', '12:06', '12:23', '12:40', '12:57', '13:14', '13:31', '14:05', '14:22',
                                    '14:56', '15:13', '16:04', '16:21', '16:38', '16:55', '17:12', '17:29', '18:03', '18:20', '18:37', '18:54', '19:11', '19:28', '19:45', '20:02', '20:19', '20:36', '20:53', '21:27', '22:35', '23:30'],
                'Terminal': ['05:30', '06:21', '06:38', '07:12', '07:29', '07:46', '08:03', '08:20', '08:37', '08:54', '09:11', '09:28', '09:45', '10:02', '10:19', '10:36', '10:53', '11:10', '11:27', '11:44', '12:01', '12:18', '12:35', '12:52', '13:09', '13:26', '13:43', '14:17', '14:34',
                            '15:08', '15:25', '16:16', '16:33', '16:50', '17:07', '17:24', '17:41', '18:15', '18:32', '18:49', '19:06', '19:23', '19:40', '20:31', '20:48', '21:05', '21:39', '22:47', '00:02'],
                'Balcarce y Urquiza': ['05:44', '06:35', '06:52', '07:26', '07:43', '08:00', '08:17', '08:34', '08:51', '09:08', '09:25', '09:42', '09:59', '10:16', '10:33', '10:50', '11:07', '11:24', '11:41', '11:58', '12:15', '12:32', '12:49', '13:06', '13:23', '13:40', '13:57', '14:31', '14:48',
                                    '15:22', '15:39', '16:30', '16:47', '17:04', '17:21', '17:38', '17:55', '18:29', '18:46', '19:03', '19:20', '19:37', '19:54', '20:45', '21:02', '21:19', '21:53', '23:01', '00:09'],
                'L.Guillet y G.Paz': ['05:51', '06:42', '06:59', '07:33', '07:50', '08:07', '08:24', '08:41', '08:58', '09:15', '09:32', '09:49', '10:06', '10:23', '10:40', '10:57', '11:14', '11:31', '11:48', '12:05', '12:22', '12:39', '12:56', '13:13', '13:30', '13:47', '14:04', '14:38', '14:55', 
                                   '15:29', '15:46', '16:33', '16:47', '17:04', '17:11', '17:28', '17:45', '18:19', '18:36', '18:53', '19:10', '19:27', '19:44', '20:01', '20:18', '20:35', '20:52', '21:09', '21:26', '22:00', '23:08', '00:16'],
                'Entrada Ate II': ['06:03', '06:54', '07:11', '07:45', '08:02', '08:19', '08:36', '08:53', '09:10', '09:27', '09:44', '10:01', '10:18', '10:35', '10:52', '11:09', '11:26', '11:43', '12:00', '12:17', '12:34', '12:51', '13:08', '13:25', '13:42', '13:59', '14:16', '14:50', '15:07',
                                  '15:41', '15:58', '16:49', '17:06', '17:23', '17:40', '17:57', '18:14', '18:48', '19:05', '19:22', '19:39', '19:56', '20:13', '20:30', '20:47', '21:04', '21:21', '21:38', '22:12', '23:20'],
                'Salida F.Sarmiento': ['06:17', '07:08', '07:25', '07:59', '08:16', '08:33', '08:50', '09:07', '09:24', '09:41', '09:58', '10:15', '10:32', '10:49', '11:06', '11:23', '11:40', '11:57', '12:14', '12:31', '12:48', '13:05', '13:22', '13:39', '13:56', '14:13', '14:30', '15:04', '15:21',
                                      '15:55', '16:12', '17:03', '17:20', '17:37', '17:54', '18:11', '18:28', '19:02', '19:19', '19:36', '19:53', '20:10', '20:27', '20:44', '21:01', '21:18', '21:35', '21:52', '22:26', '23:34'],
                'Nelson e Yrigoyen': ['06:31', '07:22', '07:39', '08:13', '08:30', '08:47', '09:04', '09:21', '09:38', '09:55', '10:12', '10:29', '10:46', '11:03', '11:20', '11:37', '11:54', '12:11', '12:28', '12:45', '13:02', '13:19', '13:36', '13:53', '14:10', '14:27', '14:44', '15:18', '15:35',
                                     '16:09', '16:26', '17:17', '17:34', '17:51', '18:08', '18:25', '18:42', '19:16', '19:33', '19:50', '20:07', '20:24', '20:41', '20:58', '21:15', '21:32', '21:49', '22:06', '22:40', '23:48'],
                'G.Paz y Maipu': ['06:47', '07:38', '07:55', '08:29', '08:46', '09:03', '09:20', '09:37', '09:54', '10:11', '10:28', '10:45', '11:02', '11:19', '11:36', '11:53', '12:10', '12:27', '12:44', '13:01', '13:18', '13:35', '13:52', '14:09', '14:26', '14:43', '15:00', '15:34', '15:51',
                                 '16:25', '16:42', '17:33', '17:50', '18:07', '18:24', '18:41', '18:58', '19:32', '19:49', '20:06', '20:23', '20:40', '20:57', '21:14', '21:31', '21:48', '22:05', '22:22', '22:56', '00:13'],
                'Llegada Facultad': ['07:02', '07:53', '08:10', '08:44', '09:01', '09:18', '09:35', '09:52', '10:09', '10:26', '10:43', '11:00', '11:17', '11:34', '11:51', '12:08', '12:25', '12:42', '12:59', '13:16', '13:33', '13:50', '14:07', '14:24', '14:41', '14:58', '15:15', '15:49', '16:06',
                                    '16:40', '16:57', '17:48', '18:05', '18:22', '18:39', '18:56', '19:13', '19:47', '20:04', '20:21', '20:38', '20:50', '21:12', '21:29', '21:46', '22:03', '22:20', '22:37', '23:11', '00:30']
            },
            'miercoles': {
                'Salida Facultad': ['05:18', '06:09', '06:26', '07:00', '07:17', '07:34', '07:51', '08:08', '08:25', '08:42', '08:59', '09:16', '09:33', '09:50', '10:07', '10:24', '10:41', '10:58', '11:15', '11:32', '11:49', '12:06', '12:23', '12:40', '12:57', '13:14', '13:31', '14:05', '14:22',
                                    '14:56', '15:13', '16:04', '16:21', '16:38', '16:55', '17:12', '17:29', '18:03', '18:20', '18:37', '18:54', '19:11', '19:28', '19:45', '20:02', '20:19', '20:36', '20:53', '21:27', '22:35', '23:30'],
                'Terminal': ['05:30', '06:21', '06:38', '07:12', '07:29', '07:46', '08:03', '08:20', '08:37', '08:54', '09:11', '09:28', '09:45', '10:02', '10:19', '10:36', '10:53', '11:10', '11:27', '11:44', '12:01', '12:18', '12:35', '12:52', '13:09', '13:26', '13:43', '14:17', '14:34',
                            '15:08', '15:25', '16:16', '16:33', '16:50', '17:07', '17:24', '17:41', '18:15', '18:32', '18:49', '19:06', '19:23', '19:40', '20:31', '20:48', '21:05', '21:39', '22:47', '00:02'],
                'Balcarce y Urquiza': ['05:44', '06:35', '06:52', '07:26', '07:43', '08:00', '08:17', '08:34', '08:51', '09:08', '09:25', '09:42', '09:59', '10:16', '10:33', '10:50', '11:07', '11:24', '11:41', '11:58', '12:15', '12:32', '12:49', '13:06', '13:23', '13:40', '13:57', '14:31', '14:48',
                                    '15:22', '15:39', '16:30', '16:47', '17:04', '17:21', '17:38', '17:55', '18:29', '18:46', '19:03', '19:20', '19:37', '19:54', '20:45', '21:02', '21:19', '21:53', '23:01', '00:09'],
                'L.Guillet y G.Paz': ['05:51', '06:42', '06:59', '07:33', '07:50', '08:07', '08:24', '08:41', '08:58', '09:15', '09:32', '09:49', '10:06', '10:23', '10:40', '10:57', '11:14', '11:31', '11:48', '12:05', '12:22', '12:39', '12:56', '13:13', '13:30', '13:47', '14:04', '14:38', '14:55', 
                                   '15:29', '15:46', '16:33', '16:47', '17:04', '17:11', '17:28', '17:45', '18:19', '18:36', '18:53', '19:10', '19:27', '19:44', '20:01', '20:18', '20:35', '20:52', '21:09', '21:26', '22:00', '23:08', '00:16'],
                'Entrada Ate II': ['06:03', '06:54', '07:11', '07:45', '08:02', '08:19', '08:36', '08:53', '09:10', '09:27', '09:44', '10:01', '10:18', '10:35', '10:52', '11:09', '11:26', '11:43', '12:00', '12:17', '12:34', '12:51', '13:08', '13:25', '13:42', '13:59', '14:16', '14:50', '15:07',
                                  '15:41', '15:58', '16:49', '17:06', '17:23', '17:40', '17:57', '18:14', '18:48', '19:05', '19:22', '19:39', '19:56', '20:13', '20:30', '20:47', '21:04', '21:21', '21:38', '22:12', '23:20'],
                'Salida F.Sarmiento': ['06:17', '07:08', '07:25', '07:59', '08:16', '08:33', '08:50', '09:07', '09:24', '09:41', '09:58', '10:15', '10:32', '10:49', '11:06', '11:23', '11:40', '11:57', '12:14', '12:31', '12:48', '13:05', '13:22', '13:39', '13:56', '14:13', '14:30', '15:04', '15:21',
                                      '15:55', '16:12', '17:03', '17:20', '17:37', '17:54', '18:11', '18:28', '19:02', '19:19', '19:36', '19:53', '20:10', '20:27', '20:44', '21:01', '21:18', '21:35', '21:52', '22:26', '23:34'],
                'Nelson e Yrigoyen': ['06:31', '07:22', '07:39', '08:13', '08:30', '08:47', '09:04', '09:21', '09:38', '09:55', '10:12', '10:29', '10:46', '11:03', '11:20', '11:37', '11:54', '12:11', '12:28', '12:45', '13:02', '13:19', '13:36', '13:53', '14:10', '14:27', '14:44', '15:18', '15:35',
                                     '16:09', '16:26', '17:17', '17:34', '17:51', '18:08', '18:25', '18:42', '19:16', '19:33', '19:50', '20:07', '20:24', '20:41', '20:58', '21:15', '21:32', '21:49', '22:06', '22:40', '23:48'],
                'G.Paz y Maipu': ['06:47', '07:38', '07:55', '08:29', '08:46', '09:03', '09:20', '09:37', '09:54', '10:11', '10:28', '10:45', '11:02', '11:19', '11:36', '11:53', '12:10', '12:27', '12:44', '13:01', '13:18', '13:35', '13:52', '14:09', '14:26', '14:43', '15:00', '15:34', '15:51',
                                 '16:25', '16:42', '17:33', '17:50', '18:07', '18:24', '18:41', '18:58', '19:32', '19:49', '20:06', '20:23', '20:40', '20:57', '21:14', '21:31', '21:48', '22:05', '22:22', '22:56', '00:13'],
                'Llegada Facultad': ['07:02', '07:53', '08:10', '08:44', '09:01', '09:18', '09:35', '09:52', '10:09', '10:26', '10:43', '11:00', '11:17', '11:34', '11:51', '12:08', '12:25', '12:42', '12:59', '13:16', '13:33', '13:50', '14:07', '14:24', '14:41', '14:58', '15:15', '15:49', '16:06',
                                    '16:40', '16:57', '17:48', '18:05', '18:22', '18:39', '18:56', '19:13', '19:47', '20:04', '20:21', '20:38', '20:50', '21:12', '21:29', '21:46', '22:03', '22:20', '22:37', '23:11', '00:30']
            },
            'jueves': {
                'Salida Facultad': ['05:18', '06:09', '06:26', '07:00', '07:17', '07:34', '07:51', '08:08', '08:25', '08:42', '08:59', '09:16', '09:33', '09:50', '10:07', '10:24', '10:41', '10:58', '11:15', '11:32', '11:49', '12:06', '12:23', '12:40', '12:57', '13:14', '13:31', '14:05', '14:22',
                                    '14:56', '15:13', '16:04', '16:21', '16:38', '16:55', '17:12', '17:29', '18:03', '18:20', '18:37', '18:54', '19:11', '19:28', '19:45', '20:02', '20:19', '20:36', '20:53', '21:27', '22:35', '23:30'],
                'Terminal': ['05:30', '06:21', '06:38', '07:12', '07:29', '07:46', '08:03', '08:20', '08:37', '08:54', '09:11', '09:28', '09:45', '10:02', '10:19', '10:36', '10:53', '11:10', '11:27', '11:44', '12:01', '12:18', '12:35', '12:52', '13:09', '13:26', '13:43', '14:17', '14:34',
                            '15:08', '15:25', '16:16', '16:33', '16:50', '17:07', '17:24', '17:41', '18:15', '18:32', '18:49', '19:06', '19:23', '19:40', '20:31', '20:48', '21:05', '21:39', '22:47', '00:02'],
                'Balcarce y Urquiza': ['05:44', '06:35', '06:52', '07:26', '07:43', '08:00', '08:17', '08:34', '08:51', '09:08', '09:25', '09:42', '09:59', '10:16', '10:33', '10:50', '11:07', '11:24', '11:41', '11:58', '12:15', '12:32', '12:49', '13:06', '13:23', '13:40', '13:57', '14:31', '14:48',
                                    '15:22', '15:39', '16:30', '16:47', '17:04', '17:21', '17:38', '17:55', '18:29', '18:46', '19:03', '19:20', '19:37', '19:54', '20:45', '21:02', '21:19', '21:53', '23:01', '00:09'],
                'L.Guillet y G.Paz': ['05:51', '06:42', '06:59', '07:33', '07:50', '08:07', '08:24', '08:41', '08:58', '09:15', '09:32', '09:49', '10:06', '10:23', '10:40', '10:57', '11:14', '11:31', '11:48', '12:05', '12:22', '12:39', '12:56', '13:13', '13:30', '13:47', '14:04', '14:38', '14:55', 
                                   '15:29', '15:46', '16:33', '16:47', '17:04', '17:11', '17:28', '17:45', '18:19', '18:36', '18:53', '19:10', '19:27', '19:44', '20:01', '20:18', '20:35', '20:52', '21:09', '21:26', '22:00', '23:08', '00:16'],
                'Entrada Ate II': ['06:03', '06:54', '07:11', '07:45', '08:02', '08:19', '08:36', '08:53', '09:10', '09:27', '09:44', '10:01', '10:18', '10:35', '10:52', '11:09', '11:26', '11:43', '12:00', '12:17', '12:34', '12:51', '13:08', '13:25', '13:42', '13:59', '14:16', '14:50', '15:07',
                                  '15:41', '15:58', '16:49', '17:06', '17:23', '17:40', '17:57', '18:14', '18:48', '19:05', '19:22', '19:39', '19:56', '20:13', '20:30', '20:47', '21:04', '21:21', '21:38', '22:12', '23:20'],
                'Salida F.Sarmiento': ['06:17', '07:08', '07:25', '07:59', '08:16', '08:33', '08:50', '09:07', '09:24', '09:41', '09:58', '10:15', '10:32', '10:49', '11:06', '11:23', '11:40', '11:57', '12:14', '12:31', '12:48', '13:05', '13:22', '13:39', '13:56', '14:13', '14:30', '15:04', '15:21',
                                      '15:55', '16:12', '17:03', '17:20', '17:37', '17:54', '18:11', '18:28', '19:02', '19:19', '19:36', '19:53', '20:10', '20:27', '20:44', '21:01', '21:18', '21:35', '21:52', '22:26', '23:34'],
                'Nelson e Yrigoyen': ['06:31', '07:22', '07:39', '08:13', '08:30', '08:47', '09:04', '09:21', '09:38', '09:55', '10:12', '10:29', '10:46', '11:03', '11:20', '11:37', '11:54', '12:11', '12:28', '12:45', '13:02', '13:19', '13:36', '13:53', '14:10', '14:27', '14:44', '15:18', '15:35',
                                     '16:09', '16:26', '17:17', '17:34', '17:51', '18:08', '18:25', '18:42', '19:16', '19:33', '19:50', '20:07', '20:24', '20:41', '20:58', '21:15', '21:32', '21:49', '22:06', '22:40', '23:48'],
                'G.Paz y Maipu': ['06:47', '07:38', '07:55', '08:29', '08:46', '09:03', '09:20', '09:37', '09:54', '10:11', '10:28', '10:45', '11:02', '11:19', '11:36', '11:53', '12:10', '12:27', '12:44', '13:01', '13:18', '13:35', '13:52', '14:09', '14:26', '14:43', '15:00', '15:34', '15:51',
                                 '16:25', '16:42', '17:33', '17:50', '18:07', '18:24', '18:41', '18:58', '19:32', '19:49', '20:06', '20:23', '20:40', '20:57', '21:14', '21:31', '21:48', '22:05', '22:22', '22:56', '00:13'],
                'Llegada Facultad': ['07:02', '07:53', '08:10', '08:44', '09:01', '09:18', '09:35', '09:52', '10:09', '10:26', '10:43', '11:00', '11:17', '11:34', '11:51', '12:08', '12:25', '12:42', '12:59', '13:16', '13:33', '13:50', '14:07', '14:24', '14:41', '14:58', '15:15', '15:49', '16:06',
                                    '16:40', '16:57', '17:48', '18:05', '18:22', '18:39', '18:56', '19:13', '19:47', '20:04', '20:21', '20:38', '20:50', '21:12', '21:29', '21:46', '22:03', '22:20', '22:37', '23:11', '00:30']
            },
            'viernes': {
                'Salida Facultad': ['05:18', '06:09', '06:26', '07:00', '07:17', '07:34', '07:51', '08:08', '08:25', '08:42', '08:59', '09:16', '09:33', '09:50', '10:07', '10:24', '10:41', '10:58', '11:15', '11:32', '11:49', '12:06', '12:23', '12:40', '12:57', '13:14', '13:31', '14:05', '14:22',
                                    '14:56', '15:13', '16:04', '16:21', '16:38', '16:55', '17:12', '17:29', '18:03', '18:20', '18:37', '18:54', '19:11', '19:28', '19:45', '20:02', '20:19', '20:36', '20:53', '21:27', '22:35', '23:30'],
                'Terminal': ['05:30', '06:21', '06:38', '07:12', '07:29', '07:46', '08:03', '08:20', '08:37', '08:54', '09:11', '09:28', '09:45', '10:02', '10:19', '10:36', '10:53', '11:10', '11:27', '11:44', '12:01', '12:18', '12:35', '12:52', '13:09', '13:26', '13:43', '14:17', '14:34',
                            '15:08', '15:25', '16:16', '16:33', '16:50', '17:07', '17:24', '17:41', '18:15', '18:32', '18:49', '19:06', '19:23', '19:40', '20:31', '20:48', '21:05', '21:39', '22:47', '00:02'],
                'Balcarce y Urquiza': ['05:44', '06:35', '06:52', '07:26', '07:43', '08:00', '08:17', '08:34', '08:51', '09:08', '09:25', '09:42', '09:59', '10:16', '10:33', '10:50', '11:07', '11:24', '11:41', '11:58', '12:15', '12:32', '12:49', '13:06', '13:23', '13:40', '13:57', '14:31', '14:48',
                                    '15:22', '15:39', '16:30', '16:47', '17:04', '17:21', '17:38', '17:55', '18:29', '18:46', '19:03', '19:20', '19:37', '19:54', '20:45', '21:02', '21:19', '21:53', '23:01', '00:09'],
                'L.Guillet y G.Paz': ['05:51', '06:42', '06:59', '07:33', '07:50', '08:07', '08:24', '08:41', '08:58', '09:15', '09:32', '09:49', '10:06', '10:23', '10:40', '10:57', '11:14', '11:31', '11:48', '12:05', '12:22', '12:39', '12:56', '13:13', '13:30', '13:47', '14:04', '14:38', '14:55', 
                                   '15:29', '15:46', '16:33', '16:47', '17:04', '17:11', '17:28', '17:45', '18:19', '18:36', '18:53', '19:10', '19:27', '19:44', '20:01', '20:18', '20:35', '20:52', '21:09', '21:26', '22:00', '23:08', '00:16'],
                'Entrada Ate II': ['06:03', '06:54', '07:11', '07:45', '08:02', '08:19', '08:36', '08:53', '09:10', '09:27', '09:44', '10:01', '10:18', '10:35', '10:52', '11:09', '11:26', '11:43', '12:00', '12:17', '12:34', '12:51', '13:08', '13:25', '13:42', '13:59', '14:16', '14:50', '15:07',
                                  '15:41', '15:58', '16:49', '17:06', '17:23', '17:40', '17:57', '18:14', '18:48', '19:05', '19:22', '19:39', '19:56', '20:13', '20:30', '20:47', '21:04', '21:21', '21:38', '22:12', '23:20'],
                'Salida F.Sarmiento': ['06:17', '07:08', '07:25', '07:59', '08:16', '08:33', '08:50', '09:07', '09:24', '09:41', '09:58', '10:15', '10:32', '10:49', '11:06', '11:23', '11:40', '11:57', '12:14', '12:31', '12:48', '13:05', '13:22', '13:39', '13:56', '14:13', '14:30', '15:04', '15:21',
                                      '15:55', '16:12', '17:03', '17:20', '17:37', '17:54', '18:11', '18:28', '19:02', '19:19', '19:36', '19:53', '20:10', '20:27', '20:44', '21:01', '21:18', '21:35', '21:52', '22:26', '23:34'],
                'Nelson e Yrigoyen': ['06:31', '07:22', '07:39', '08:13', '08:30', '08:47', '09:04', '09:21', '09:38', '09:55', '10:12', '10:29', '10:46', '11:03', '11:20', '11:37', '11:54', '12:11', '12:28', '12:45', '13:02', '13:19', '13:36', '13:53', '14:10', '14:27', '14:44', '15:18', '15:35',
                                     '16:09', '16:26', '17:17', '17:34', '17:51', '18:08', '18:25', '18:42', '19:16', '19:33', '19:50', '20:07', '20:24', '20:41', '20:58', '21:15', '21:32', '21:49', '22:06', '22:40', '23:48'],
                'G.Paz y Maipu': ['06:47', '07:38', '07:55', '08:29', '08:46', '09:03', '09:20', '09:37', '09:54', '10:11', '10:28', '10:45', '11:02', '11:19', '11:36', '11:53', '12:10', '12:27', '12:44', '13:01', '13:18', '13:35', '13:52', '14:09', '14:26', '14:43', '15:00', '15:34', '15:51',
                                 '16:25', '16:42', '17:33', '17:50', '18:07', '18:24', '18:41', '18:58', '19:32', '19:49', '20:06', '20:23', '20:40', '20:57', '21:14', '21:31', '21:48', '22:05', '22:22', '22:56', '00:13'],
                'Llegada Facultad': ['07:02', '07:53', '08:10', '08:44', '09:01', '09:18', '09:35', '09:52', '10:09', '10:26', '10:43', '11:00', '11:17', '11:34', '11:51', '12:08', '12:25', '12:42', '12:59', '13:16', '13:33', '13:50', '14:07', '14:24', '14:41', '14:58', '15:15', '15:49', '16:06',
                                    '16:40', '16:57', '17:48', '18:05', '18:22', '18:39', '18:56', '19:13', '19:47', '20:04', '20:21', '20:38', '20:50', '21:12', '21:29', '21:46', '22:03', '22:20', '22:37', '23:11', '00:30']
            },
            'sabado': {
                'Salida Facultad': ['05:27', '06:21', '07:15', '08:09', '09:03', '09:30', '09:57', '10:24', '10:51', '11:18', '11:45', '12:12', '12:39', '13:06', '13:33', '14:00', '14:27', '14:54', '15:21', '15:48', '16:15', '17:09', '17:36', '18:03', '18:30', '18:57', '19:24', '19:51', '20:18', '20:39', '21:12', '22:06', '23:00', '23:54'],
                'Terminal': ['05:31', '06:31', '07:25', '08:19', '09:13', '09:40', '10:07', '10:34', '11:01', '11:28', '11:55', '12:22', '12:49', '13:16', '13:43', '14:10', '14:37', '15:04', '15:31', '15:58', '16:25', '17:19', '17:46', '18:13', '18:40', '19:07', '19:34', '20:01', '20:28', '20:49', '21:22', '22:16', '23:10', '00:04'],
                'Balcarce y Urquiza': ['05:44', '06:44', '07:38', '08:32', '09:26', '09:53', '10:20', '10:47', '11:14', '11:41', '12:08', '12:35', '13:02', '13:29', '13:56', '14:23', '14:50', '15:17', '15:44', '16:11', '16:38', '17:32', '17:59', '18:26', '18:53', '19:20', '19:47', '20:13', '20:41', '21:02', '21:35', '22:29', '23:23', '00:17'],
                'L.Guillet y G.Paz': ['05:50', '06:50', '07:44', '08:38', '09:32', '09:59', '10:26', '10:53', '11:20', '11:47', '12:14', '12:41', '13:08', '13:35', '14:02', '14:29', '14:56', '15:23', '15:50', '16:17', '16:44', '17:38', '18:05', '18:32', '18:59', '19:26', '19:53', '20:18', '20:47', '21:08', '21:41', '22:35', '23:29', '00:23'],
                'Entrada Ate II': ['05:56', '06:56', '07:50', '08:44', '09:38', '10:05', '10:32', '10:59', '11:26', '11:53', '12:20', '12:47', '13:14', '13:41', '14:08', '14:35', '15:02', '15:29', '15:56', '16:23', '16:50', '17:44', '18:11', '18:38', '19:05', '19:32', '19:59', '20:24', '20:53', '21:14', '21:47', '22:41', '23:35', '00:29'],
                'Salida F.Sarmiento': ['06:08', '07:02', '07:56', '08:50', '09:44', '10:11', '10:38', '11:05', '11:32', '11:59', '12:26', '12:53', '13:20', '13:47', '14:14', '14:41', '15:08', '15:35', '16:02', '16:29', '16:56', '17:50', '18:17', '18:44', '19:11', '19:38', '20:05', '20:30', '20:59', '21:20', '21:53', '22:47', '23:41', '00:35'],
                'Nelson e Yrigoyen': ['06:21', '07:15', '08:09', '09:03', '09:57', '10:24', '10:51', '11:18', '11:45', '12:12', '12:39', '13:06', '13:33', '14:00', '14:27', '14:54', '15:21', '15:48', '16:15', '16:42', '17:09', '18:03', '18:30', '18:57', '19:24', '19:50', '20:18', '20:38', '21:12', '21:33', '22:06', '23:00', '23:54', '00:48'],
                'G.Paz y Maipu': ['06:34', '07:28', '08:22', '09:16', '10:10', '10:37', '11:04', '11:31', '11:58', '12:25', '12:52', '13:19', '13:46', '14:13', '14:40', '15:07', '15:34', '16:01', '16:28', '16:55', '17:22', '18:16', '18:43', '19:10', '19:37', '20:02', '20:31', '20:51', '21:25', '21:46', '22:19', '23:13', '00:07'],
                'Llegada Facultad': ['06:48', '07:54', '09:15', '10:36', '11:03', '11:30', '11:57', '12:24', '12:51', '13:18', '13:45', '14:12', '14:39', '15:06', '15:33', '16:00', '16:54', '17:21', '17:48', '18:15', '18:42', '19:09', '19:36', '20:03', '20:24', '20:57', '21:39', '21:51', '22:45', '23:39']
            }
            }
        }
    ,
    'Línea E': {
        stops: [
            'M.Ernst y Cazorla', 'Hospital La Ribera', 'Escuela Agraria', 'Ayacucho y Balcarce', 
            'Policlinico', 'Llegada Terminal', 'Salida Terminal', 'Hospital de la Villa', 
            'Balcarce y Riobamba', 'Entrada Bº La Ribera'
        ],
        schedules: {
            'domingo': {
                'M.Ernst y Cazorla': ['05:15','06:21','07:00','08:10','08:45','09:20','10:30','11:05','11:40','12:15','12:50','13:25','14:00','14:35','15:10','15:45','16:20','16:55','17:30','18:05','18:40','19:15','19:50','20:25','21:00','21:35','22:10','22:45','23:19','23:51','00:54'],
                'Hospital La Ribera': ['05:23','06:29','07:08','08:18','08:53','09:28','10:38','11:13','11:48','12:23','12:58','13:33','14:08','14:43','15:18','15:53','16:28','17:03','17:38','18:13','18:48','19:23','19:58','20:33','21:08','21:43','22:18','21:53','23:26','23:58','01:01'],
                'Escuela Agraria': ['05:32','07:17','08:27','09:02','09:37','10:47','11:22','11:57','12:32','13:07','13:42','14:17','14:52','15:27','16:02','16:37','17:12','17:47','18:22','18:57','19:32','20:07','20:42','21:17','21:52','22:06','22:41','23:14','23:43','00:19'],
                'Ayacucho y Balcarce': ['05:46','06:52','07:31','08:41','09:16','09:51','11:01','11:36','12:11','12:46','13:21','13:56','14:31','15:06','15:41','16:16','16:51','17:26','18:01','18:36','19:11','19:46','20:21','20:56','21:31','22:06','22:41','23:16','23:47','00:29'],
                'Policlinico': ['05:57','07:03','07:42','08:52','09:27','10:02','11:12','11:47','12:22','12:57','13:32','14:07','14:42','15:17','15:52','16:27','17:02','17:37','18:12','18:47','19:22','19:57','20:32','21:07','21:42','22:17','22:52','23:27','23:59','00:40'],
                'Llegada a Terminal': ['06:10','07:16','07:55','09:05','09:40','10:15','11:25','12:00','12:35','13:10','13:45','14:20','14:55','15:30','16:05','16:40','17:15','17:50','18:25','19:00','19:35','20:10','20:45','21:20','21:55','22:30','23:05','23:40','00:12','00:49'],
                'Salida Terminal': ['06:25','07:35','08:45','09:20','09:55','11:05','11:40','12:15','12:50','13:25','14:00','14:35','15:10','15:45','16:20','16:55','17:30','18:05','18:40','19:15','19:50','20:25','21:00','21:35','22:10','22:45','23:20','23:53','00:29'],
                'Hospital de la Villa': ['06:32','07:41','08:51','09:26','10:01','11:11','11:46','12:21','12:56','13:31','14:06','14:41','15:16','15:51','16:26','17:01','17:36','18:11','18:46','19:21','19:56','20:31','21:06','21:41','22:16','22:51','23:26','00:01','00:35'],
                'Balcarce y Riobamba': ['06:39','07:48','08:58','09:33','10:08','11:18','11:53','12:28','13:03','13:38','14:13','14:48','15:23','15:58','16:33','17:08','17:43','18:18','18:53','19:28','20:03','20:38','21:13','21:48','22:23','22:58','23:33','00:08','00:42'],
                'Entrada Bº La Ribera': ['06:55','08:05','09:15','09:50','10:25','11:35','12:10','12:45','13:20','13:55','14:30','15:05','15:40','16:15','16:50','17:25','18:00','18:35','19:10','19:45','20:20','20:55','21:30','22:05','22:40','23:15','23:50','00:25','00:50','01:00']
            },
            'lunes': {
                'M.Ernst y Cazorla': ['05:10', '05:54', '06:09', '06:24', '06:54', '07:09', '07:24', '07:54', '08:09', '08:24', '08:39', '08:54', '09:09', '09:24', '09:39', '09:54', '10:09', '10:24', '10:39', '10:54', '11:09', '11:24', '11:39', '11:54', '12:09', '12:24', '12:39', '12:54', '13:09', '13:24', '13:39', '14:09', '14:24', '14:39', '14:54', '15:24', '15:39', '15:54', '16:24', '16:39', '16:54', '17:09', '17:24', '17:39', '17:54', '18:09', '18:24', '18:39', '18:54', '19:09', '19:24', '19:39', '19:54', '20:09', '20:24', '20:39', '21:09', '21:24', '21:39', '22:09', '22:39', '23:05', '23:39', '00:05', '00:53'],
                'Hospital La Ribera': ['05:21', '06:06', '06:21', '06:36', '07:06', '07:21', '07:36', '08:06', '08:21', '08:36', '08:51', '09:06', '09:21', '09:36', '09:51', '10:06', '10:21', '10:36', '10:51', '11:06', '11:21', '11:36', '11:51', '12:06', '12:21', '12:36', '12:51', '13:06', '13:21', '13:36', '13:51', '14:21', '14:36', '14:51', '15:06', '15:36', '15:51', '16:06', '16:36', '16:51', '17:06', '17:21', '17:36', '17:51', '18:06', '18:21', '18:36', '18:51', '19:06', '19:21', '19:36', '19:51', '20:06', '20:21', '20:36', '20:51', '21:21', '21:36', '21:51', '22:21', '22:51', '23:16', '23:51', '00:16', '01:00'],
                'Escuela Agraria': ['05:33', '06:18', '06:33', '06:48', '07:18', '07:33', '07:48', '08:18', '08:33', '08:48', '09:03', '09:18', '09:33', '09:48', '10:03', '10:18', '10:33', '10:48', '11:03', '11:18', '11:33', '11:48', '12:03', '12:18', '12:33', '12:48', '13:03', '13:18', '13:33', '13:48', '14:03', '14:33', '14:48', '15:03', '15:18', '15:48', '16:03', '16:18', '16:48', '17:03', '17:18', '17:33', '17:48', '18:03', '18:18', '18:33', '18:48', '19:03', '19:18', '19:33', '19:48', '20:03', '20:18', '20:33', '20:48', '21:03', '21:33', '21:48', '22:03', '22:33', '23:03', '23:27', '00:03', '00:27'],
                'Ayacucho y Balcarce': ['05:47', '06:33', '06:48', '07:03', '07:33', '07:48', '08:03', '08:33', '08:48', '09:03', '09:18', '09:33', '09:48', '10:03', '10:18', '10:33', '10:48', '11:03', '11:18', '11:33', '11:48', '12:03', '12:18', '12:33', '12:48', '13:03', '13:18', '13:33', '13:48', '14:03', '14:18', '14:48', '15:03', '15:18', '15:33', '16:03', '16:18', '16:33', '17:03', '17:18', '17:33', '17:48', '18:03', '18:18', '18:33', '18:48', '19:03', '19:18', '19:33', '19:48', '20:03', '20:18', '20:33', '20:48', '21:03', '21:18', '21:48', '22:03', '22:18', '22:48', '23:18', '23:41', '00:18', '00:41'],
                'Policlinico': ['06:02', '06:47', '07:02', '07:17', '07:47', '08:02', '08:17', '08:47', '09:02', '09:17', '09:32', '09:47', '10:02', '10:17', '10:32', '10:47', '11:02', '11:17', '11:32', '11:47', '12:02', '12:17', '12:32', '12:47', '13:02', '13:17', '13:32', '13:47', '14:02', '14:17', '14:32', '15:02', '15:15', '15:30', '15:45', '16:15', '16:30', '16:45', '17:15', '17:30', '17:45', '18:00', '18:15', '18:30', '18:45', '19:00', '19:15', '19:30', '19:45', '20:00', '20:15', '20:30', '20:45', '21:00', '21:15', '21:30', '22:00', '22:15', '22:30', '23:00', '23:30', '23:52', '00:30', '00:52'],
                'Llegada Terminal': ['06:14', '07:00', '07:14', '07:29', '08:00', '08:14', '08:29', '09:00', '09:14', '09:29', '09:44', '09:59', '10:14', '10:29', '10:44', '10:59', '11:14', '11:29', '11:44', '11:59', '12:14', '12:29', '12:44', '12:59', '13:14', '13:29', '13:44', '13:59', '14:14', '14:29', '14:44', '15:14', '15:29', '15:44', '15:59', '16:29', '16:44', '16:59', '17:29', '17:44', '17:59', '18:14', '18:29', '18:44', '18:59', '19:14', '19:29', '19:44', '19:59', '20:14', '20:29', '20:44', '20:59', '21:14', '21:29', '21:44', '22:14', '22:29', '22:44', '23:14', '23:44', '00:06', '00:44', '01:05'],
                'Salida Terminal': ['06:21', '07:15', '07:29', '07:44', '08:14', '08:29', '08:44', '09:14', '09:29', '09:44', '09:59', '10:14', '10:29', '10:44', '10:59', '11:14', '11:29', '11:44', '11:59', '12:14', '12:29', '12:44', '12:59', '13:14', '13:29', '13:44', '13:59', '14:14', '14:29', '14:44', '14:59', '15:29', '15:44', '15:59', '16:14', '16:44', '16:59', '17:14', '17:44', '17:59', '18:14', '18:29', '18:44', '18:59', '19:14', '19:29', '19:44', '19:59', '20:14', '20:29', '20:44', '20:59', '21:14', '21:29', '21:44', '21:59', '22:29', '22:44', '22:59', '23:29', '23:59', '00:21', '00:59'],
                'Hospital de la Villa': ['06:28', '07:21', '07:36', '07:51', '08:21', '08:36', '08:51', '09:21', '09:36', '09:51', '10:06', '10:21', '10:36', '10:51', '11:06', '11:21', '11:36', '11:51', '12:06', '12:21', '12:36', '12:51', '13:06', '13:21', '13:36', '13:51', '14:06', '14:21', '14:36', '14:51', '15:06', '15:36', '15:51', '16:06', '16:21', '16:51', '17:06', '17:21', '17:51', '18:06', '18:21', '18:36', '18:51', '19:06', '19:21', '19:36', '19:51', '20:06', '20:21', '20:36', '20:51', '21:06', '21:21', '21:36', '21:51', '22:06', '22:36', '22:51', '23:06', '23:36', '00:06', '00:26', '01:06'],
                'Balcarce y Riobamba': ['06:47', '07:38', '07:43', '07:58', '08:28', '08:43', '08:58', '09:28', '09:43', '09:58', '10:13', '10:28', '10:43', '10:58', '11:13', '11:28', '11:43', '11:58', '12:13', '12:28', '12:43', '12:58', '13:13', '13:28', '13:43', '13:58', '14:13', '14:28', '14:43', '14:58', '15:13', '15:43', '15:58', '16:13', '16:28', '16:58', '17:13', '17:28', '17:58', '18:13', '18:28', '18:43', '18:58', '19:13', '19:28', '19:43', '19:58', '20:13', '20:28', '20:43', '20:58', '21:13', '21:28', '21:43', '21:58', '22:13', '22:43', '22:58', '23:13', '23:43', '00:13', '00:31', '01:13'],
                'Entrada Bº La Ribera': ['06:47', '08:02', '08:17', '08:32', '09:02', '09:17', '09:32', '10:02', '10:17', '10:32', '10:47', '11:02', '11:17', '11:32', '11:47', '12:02', '12:17', '12:32', '12:47', '13:02', '13:17', '13:32', '13:47', '14:02', '14:17', '14:32', '14:47', '15:02', '15:17', '15:32', '15:47', '16:17', '16:32', '16:47', '17:02', '17:32', '17:47', '18:02', '18:32', '18:47', '19:02', '19:17', '19:32', '19:47', '20:02', '20:17', '20:32', '20:47', '21:02', '21:17', '21:32', '22:02', '22:17', '22:32', '22:59', '23:32', '23:59', '00:48']
            },
            'martes': {
                'M.Ernst y Cazorla': ['05:10', '05:54', '06:09', '06:24', '06:54', '07:09', '07:24', '07:54', '08:09', '08:24', '08:39', '08:54', '09:09', '09:24', '09:39', '09:54', '10:09', '10:24', '10:39', '10:54', '11:09', '11:24', '11:39', '11:54', '12:09', '12:24', '12:39', '12:54', '13:09', '13:24', '13:39', '14:09', '14:24', '14:39', '14:54', '15:24', '15:39', '15:54', '16:24', '16:39', '16:54', '17:09', '17:24', '17:39', '17:54', '18:09', '18:24', '18:39', '18:54', '19:09', '19:24', '19:39', '19:54', '20:09', '20:24', '20:39', '21:09', '21:24', '21:39', '22:09', '22:39', '23:05', '23:39', '00:05', '00:53'],
                'Hospital La Ribera': ['05:21', '06:06', '06:21', '06:36', '07:06', '07:21', '07:36', '08:06', '08:21', '08:36', '08:51', '09:06', '09:21', '09:36', '09:51', '10:06', '10:21', '10:36', '10:51', '11:06', '11:21', '11:36', '11:51', '12:06', '12:21', '12:36', '12:51', '13:06', '13:21', '13:36', '13:51', '14:21', '14:36', '14:51', '15:06', '15:36', '15:51', '16:06', '16:36', '16:51', '17:06', '17:21', '17:36', '17:51', '18:06', '18:21', '18:36', '18:51', '19:06', '19:21', '19:36', '19:51', '20:06', '20:21', '20:36', '20:51', '21:21', '21:36', '21:51', '22:21', '22:51', '23:16', '23:51', '00:16', '01:00'],
                'Escuela Agraria': ['05:33', '06:18', '06:33', '06:48', '07:18', '07:33', '07:48', '08:18', '08:33', '08:48', '09:03', '09:18', '09:33', '09:48', '10:03', '10:18', '10:33', '10:48', '11:03', '11:18', '11:33', '11:48', '12:03', '12:18', '12:33', '12:48', '13:03', '13:18', '13:33', '13:48', '14:03', '14:33', '14:48', '15:03', '15:18', '15:48', '16:03', '16:18', '16:48', '17:03', '17:18', '17:33', '17:48', '18:03', '18:18', '18:33', '18:48', '19:03', '19:18', '19:33', '19:48', '20:03', '20:18', '20:33', '20:48', '21:03', '21:33', '21:48', '22:03', '22:33', '23:03', '23:27', '00:03', '00:27'],
                'Ayacucho y Balcarce': ['05:47', '06:33', '06:48', '07:03', '07:33', '07:48', '08:03', '08:33', '08:48', '09:03', '09:18', '09:33', '09:48', '10:03', '10:18', '10:33', '10:48', '11:03', '11:18', '11:33', '11:48', '12:03', '12:18', '12:33', '12:48', '13:03', '13:18', '13:33', '13:48', '14:03', '14:18', '14:48', '15:03', '15:18', '15:33', '16:03', '16:18', '16:33', '17:03', '17:18', '17:33', '17:48', '18:03', '18:18', '18:33', '18:48', '19:03', '19:18', '19:33', '19:48', '20:03', '20:18', '20:33', '20:48', '21:03', '21:18', '21:48', '22:03', '22:18', '22:48', '23:18', '23:41', '00:18', '00:41'],
                'Policlinico': ['06:02', '06:47', '07:02', '07:17', '07:47', '08:02', '08:17', '08:47', '09:02', '09:17', '09:32', '09:47', '10:02', '10:17', '10:32', '10:47', '11:02', '11:17', '11:32', '11:47', '12:02', '12:17', '12:32', '12:47', '13:02', '13:17', '13:32', '13:47', '14:02', '14:17', '14:32', '15:02', '15:15', '15:30', '15:45', '16:15', '16:30', '16:45', '17:15', '17:30', '17:45', '18:00', '18:15', '18:30', '18:45', '19:00', '19:15', '19:30', '19:45', '20:00', '20:15', '20:30', '20:45', '21:00', '21:15', '21:30', '22:00', '22:15', '22:30', '23:00', '23:30', '23:52', '00:30', '00:52'],
                'Llegada Terminal': ['06:14', '07:00', '07:14', '07:29', '08:00', '08:14', '08:29', '09:00', '09:14', '09:29', '09:44', '09:59', '10:14', '10:29', '10:44', '10:59', '11:14', '11:29', '11:44', '11:59', '12:14', '12:29', '12:44', '12:59', '13:14', '13:29', '13:44', '13:59', '14:14', '14:29', '14:44', '15:14', '15:29', '15:44', '15:59', '16:29', '16:44', '16:59', '17:29', '17:44', '17:59', '18:14', '18:29', '18:44', '18:59', '19:14', '19:29', '19:44', '19:59', '20:14', '20:29', '20:44', '20:59', '21:14', '21:29', '21:44', '22:14', '22:29', '22:44', '23:14', '23:44', '00:06', '00:44', '01:05'],
                'Salida Terminal': ['06:21', '07:15', '07:29', '07:44', '08:14', '08:29', '08:44', '09:14', '09:29', '09:44', '09:59', '10:14', '10:29', '10:44', '10:59', '11:14', '11:29', '11:44', '11:59', '12:14', '12:29', '12:44', '12:59', '13:14', '13:29', '13:44', '13:59', '14:14', '14:29', '14:44', '14:59', '15:29', '15:44', '15:59', '16:14', '16:44', '16:59', '17:14', '17:44', '17:59', '18:14', '18:29', '18:44', '18:59', '19:14', '19:29', '19:44', '19:59', '20:14', '20:29', '20:44', '20:59', '21:14', '21:29', '21:44', '21:59', '22:29', '22:44', '22:59', '23:29', '23:59', '00:21', '00:59'],
                'Hospital de la Villa': ['06:28', '07:21', '07:36', '07:51', '08:21', '08:36', '08:51', '09:21', '09:36', '09:51', '10:06', '10:21', '10:36', '10:51', '11:06', '11:21', '11:36', '11:51', '12:06', '12:21', '12:36', '12:51', '13:06', '13:21', '13:36', '13:51', '14:06', '14:21', '14:36', '14:51', '15:06', '15:36', '15:51', '16:06', '16:21', '16:51', '17:06', '17:21', '17:51', '18:06', '18:21', '18:36', '18:51', '19:06', '19:21', '19:36', '19:51', '20:06', '20:21', '20:36', '20:51', '21:06', '21:21', '21:36', '21:51', '22:06', '22:36', '22:51', '23:06', '23:36', '00:06', '00:26', '01:06'],
                'Balcarce y Riobamba': ['06:47', '07:38', '07:43', '07:58', '08:28', '08:43', '08:58', '09:28', '09:43', '09:58', '10:13', '10:28', '10:43', '10:58', '11:13', '11:28', '11:43', '11:58', '12:13', '12:28', '12:43', '12:58', '13:13', '13:28', '13:43', '13:58', '14:13', '14:28', '14:43', '14:58', '15:13', '15:43', '15:58', '16:13', '16:28', '16:58', '17:13', '17:28', '17:58', '18:13', '18:28', '18:43', '18:58', '19:13', '19:28', '19:43', '19:58', '20:13', '20:28', '20:43', '20:58', '21:13', '21:28', '21:43', '21:58', '22:13', '22:43', '22:58', '23:13', '23:43', '00:13', '00:31', '01:13'],
                'Entrada Bº La Ribera': ['06:47', '08:02', '08:17', '08:32', '09:02', '09:17', '09:32', '10:02', '10:17', '10:32', '10:47', '11:02', '11:17', '11:32', '11:47', '12:02', '12:17', '12:32', '12:47', '13:02', '13:17', '13:32', '13:47', '14:02', '14:17', '14:32', '14:47', '15:02', '15:17', '15:32', '15:47', '16:17', '16:32', '16:47', '17:02', '17:32', '17:47', '18:02', '18:32', '18:47', '19:02', '19:17', '19:32', '19:47', '20:02', '20:17', '20:32', '20:47', '21:02', '21:17', '21:32', '22:02', '22:17', '22:32', '22:59', '23:32', '23:59', '00:48']
 
            },
            'miercoles': {
                'M.Ernst y Cazorla': ['05:10', '05:54', '06:09', '06:24', '06:54', '07:09', '07:24', '07:54', '08:09', '08:24', '08:39', '08:54', '09:09', '09:24', '09:39', '09:54', '10:09', '10:24', '10:39', '10:54', '11:09', '11:24', '11:39', '11:54', '12:09', '12:24', '12:39', '12:54', '13:09', '13:24', '13:39', '14:09', '14:24', '14:39', '14:54', '15:24', '15:39', '15:54', '16:24', '16:39', '16:54', '17:09', '17:24', '17:39', '17:54', '18:09', '18:24', '18:39', '18:54', '19:09', '19:24', '19:39', '19:54', '20:09', '20:24', '20:39', '21:09', '21:24', '21:39', '22:09', '22:39', '23:05', '23:39', '00:05', '00:53'],
                'Hospital La Ribera': ['05:21', '06:06', '06:21', '06:36', '07:06', '07:21', '07:36', '08:06', '08:21', '08:36', '08:51', '09:06', '09:21', '09:36', '09:51', '10:06', '10:21', '10:36', '10:51', '11:06', '11:21', '11:36', '11:51', '12:06', '12:21', '12:36', '12:51', '13:06', '13:21', '13:36', '13:51', '14:21', '14:36', '14:51', '15:06', '15:36', '15:51', '16:06', '16:36', '16:51', '17:06', '17:21', '17:36', '17:51', '18:06', '18:21', '18:36', '18:51', '19:06', '19:21', '19:36', '19:51', '20:06', '20:21', '20:36', '20:51', '21:21', '21:36', '21:51', '22:21', '22:51', '23:16', '23:51', '00:16', '01:00'],
                'Escuela Agraria': ['05:33', '06:18', '06:33', '06:48', '07:18', '07:33', '07:48', '08:18', '08:33', '08:48', '09:03', '09:18', '09:33', '09:48', '10:03', '10:18', '10:33', '10:48', '11:03', '11:18', '11:33', '11:48', '12:03', '12:18', '12:33', '12:48', '13:03', '13:18', '13:33', '13:48', '14:03', '14:33', '14:48', '15:03', '15:18', '15:48', '16:03', '16:18', '16:48', '17:03', '17:18', '17:33', '17:48', '18:03', '18:18', '18:33', '18:48', '19:03', '19:18', '19:33', '19:48', '20:03', '20:18', '20:33', '20:48', '21:03', '21:33', '21:48', '22:03', '22:33', '23:03', '23:27', '00:03', '00:27'],
                'Ayacucho y Balcarce': ['05:47', '06:33', '06:48', '07:03', '07:33', '07:48', '08:03', '08:33', '08:48', '09:03', '09:18', '09:33', '09:48', '10:03', '10:18', '10:33', '10:48', '11:03', '11:18', '11:33', '11:48', '12:03', '12:18', '12:33', '12:48', '13:03', '13:18', '13:33', '13:48', '14:03', '14:18', '14:48', '15:03', '15:18', '15:33', '16:03', '16:18', '16:33', '17:03', '17:18', '17:33', '17:48', '18:03', '18:18', '18:33', '18:48', '19:03', '19:18', '19:33', '19:48', '20:03', '20:18', '20:33', '20:48', '21:03', '21:18', '21:48', '22:03', '22:18', '22:48', '23:18', '23:41', '00:18', '00:41'],
                'Policlinico': ['06:02', '06:47', '07:02', '07:17', '07:47', '08:02', '08:17', '08:47', '09:02', '09:17', '09:32', '09:47', '10:02', '10:17', '10:32', '10:47', '11:02', '11:17', '11:32', '11:47', '12:02', '12:17', '12:32', '12:47', '13:02', '13:17', '13:32', '13:47', '14:02', '14:17', '14:32', '15:02', '15:15', '15:30', '15:45', '16:15', '16:30', '16:45', '17:15', '17:30', '17:45', '18:00', '18:15', '18:30', '18:45', '19:00', '19:15', '19:30', '19:45', '20:00', '20:15', '20:30', '20:45', '21:00', '21:15', '21:30', '22:00', '22:15', '22:30', '23:00', '23:30', '23:52', '00:30', '00:52'],
                'Llegada Terminal': ['06:14', '07:00', '07:14', '07:29', '08:00', '08:14', '08:29', '09:00', '09:14', '09:29', '09:44', '09:59', '10:14', '10:29', '10:44', '10:59', '11:14', '11:29', '11:44', '11:59', '12:14', '12:29', '12:44', '12:59', '13:14', '13:29', '13:44', '13:59', '14:14', '14:29', '14:44', '15:14', '15:29', '15:44', '15:59', '16:29', '16:44', '16:59', '17:29', '17:44', '17:59', '18:14', '18:29', '18:44', '18:59', '19:14', '19:29', '19:44', '19:59', '20:14', '20:29', '20:44', '20:59', '21:14', '21:29', '21:44', '22:14', '22:29', '22:44', '23:14', '23:44', '00:06', '00:44', '01:05'],
                'Salida Terminal': ['06:21', '07:15', '07:29', '07:44', '08:14', '08:29', '08:44', '09:14', '09:29', '09:44', '09:59', '10:14', '10:29', '10:44', '10:59', '11:14', '11:29', '11:44', '11:59', '12:14', '12:29', '12:44', '12:59', '13:14', '13:29', '13:44', '13:59', '14:14', '14:29', '14:44', '14:59', '15:29', '15:44', '15:59', '16:14', '16:44', '16:59', '17:14', '17:44', '17:59', '18:14', '18:29', '18:44', '18:59', '19:14', '19:29', '19:44', '19:59', '20:14', '20:29', '20:44', '20:59', '21:14', '21:29', '21:44', '21:59', '22:29', '22:44', '22:59', '23:29', '23:59', '00:21', '00:59'],
                'Hospital de la Villa': ['06:28', '07:21', '07:36', '07:51', '08:21', '08:36', '08:51', '09:21', '09:36', '09:51', '10:06', '10:21', '10:36', '10:51', '11:06', '11:21', '11:36', '11:51', '12:06', '12:21', '12:36', '12:51', '13:06', '13:21', '13:36', '13:51', '14:06', '14:21', '14:36', '14:51', '15:06', '15:36', '15:51', '16:06', '16:21', '16:51', '17:06', '17:21', '17:51', '18:06', '18:21', '18:36', '18:51', '19:06', '19:21', '19:36', '19:51', '20:06', '20:21', '20:36', '20:51', '21:06', '21:21', '21:36', '21:51', '22:06', '22:36', '22:51', '23:06', '23:36', '00:06', '00:26', '01:06'],
                'Balcarce y Riobamba': ['06:47', '07:38', '07:43', '07:58', '08:28', '08:43', '08:58', '09:28', '09:43', '09:58', '10:13', '10:28', '10:43', '10:58', '11:13', '11:28', '11:43', '11:58', '12:13', '12:28', '12:43', '12:58', '13:13', '13:28', '13:43', '13:58', '14:13', '14:28', '14:43', '14:58', '15:13', '15:43', '15:58', '16:13', '16:28', '16:58', '17:13', '17:28', '17:58', '18:13', '18:28', '18:43', '18:58', '19:13', '19:28', '19:43', '19:58', '20:13', '20:28', '20:43', '20:58', '21:13', '21:28', '21:43', '21:58', '22:13', '22:43', '22:58', '23:13', '23:43', '00:13', '00:31', '01:13'],
                'Entrada Bº La Ribera': ['06:47', '08:02', '08:17', '08:32', '09:02', '09:17', '09:32', '10:02', '10:17', '10:32', '10:47', '11:02', '11:17', '11:32', '11:47', '12:02', '12:17', '12:32', '12:47', '13:02', '13:17', '13:32', '13:47', '14:02', '14:17', '14:32', '14:47', '15:02', '15:17', '15:32', '15:47', '16:17', '16:32', '16:47', '17:02', '17:32', '17:47', '18:02', '18:32', '18:47', '19:02', '19:17', '19:32', '19:47', '20:02', '20:17', '20:32', '20:47', '21:02', '21:17', '21:32', '22:02', '22:17', '22:32', '22:59', '23:32', '23:59', '00:48']
 
            },
            'jueves': {
                'M.Ernst y Cazorla': ['05:10', '05:54', '06:09', '06:24', '06:54', '07:09', '07:24', '07:54', '08:09', '08:24', '08:39', '08:54', '09:09', '09:24', '09:39', '09:54', '10:09', '10:24', '10:39', '10:54', '11:09', '11:24', '11:39', '11:54', '12:09', '12:24', '12:39', '12:54', '13:09', '13:24', '13:39', '14:09', '14:24', '14:39', '14:54', '15:24', '15:39', '15:54', '16:24', '16:39', '16:54', '17:09', '17:24', '17:39', '17:54', '18:09', '18:24', '18:39', '18:54', '19:09', '19:24', '19:39', '19:54', '20:09', '20:24', '20:39', '21:09', '21:24', '21:39', '22:09', '22:39', '23:05', '23:39', '00:05', '00:53'],
                'Hospital La Ribera': ['05:21', '06:06', '06:21', '06:36', '07:06', '07:21', '07:36', '08:06', '08:21', '08:36', '08:51', '09:06', '09:21', '09:36', '09:51', '10:06', '10:21', '10:36', '10:51', '11:06', '11:21', '11:36', '11:51', '12:06', '12:21', '12:36', '12:51', '13:06', '13:21', '13:36', '13:51', '14:21', '14:36', '14:51', '15:06', '15:36', '15:51', '16:06', '16:36', '16:51', '17:06', '17:21', '17:36', '17:51', '18:06', '18:21', '18:36', '18:51', '19:06', '19:21', '19:36', '19:51', '20:06', '20:21', '20:36', '20:51', '21:21', '21:36', '21:51', '22:21', '22:51', '23:16', '23:51', '00:16', '01:00'],
                'Escuela Agraria': ['05:33', '06:18', '06:33', '06:48', '07:18', '07:33', '07:48', '08:18', '08:33', '08:48', '09:03', '09:18', '09:33', '09:48', '10:03', '10:18', '10:33', '10:48', '11:03', '11:18', '11:33', '11:48', '12:03', '12:18', '12:33', '12:48', '13:03', '13:18', '13:33', '13:48', '14:03', '14:33', '14:48', '15:03', '15:18', '15:48', '16:03', '16:18', '16:48', '17:03', '17:18', '17:33', '17:48', '18:03', '18:18', '18:33', '18:48', '19:03', '19:18', '19:33', '19:48', '20:03', '20:18', '20:33', '20:48', '21:03', '21:33', '21:48', '22:03', '22:33', '23:03', '23:27', '00:03', '00:27'],
                'Ayacucho y Balcarce': ['05:47', '06:33', '06:48', '07:03', '07:33', '07:48', '08:03', '08:33', '08:48', '09:03', '09:18', '09:33', '09:48', '10:03', '10:18', '10:33', '10:48', '11:03', '11:18', '11:33', '11:48', '12:03', '12:18', '12:33', '12:48', '13:03', '13:18', '13:33', '13:48', '14:03', '14:18', '14:48', '15:03', '15:18', '15:33', '16:03', '16:18', '16:33', '17:03', '17:18', '17:33', '17:48', '18:03', '18:18', '18:33', '18:48', '19:03', '19:18', '19:33', '19:48', '20:03', '20:18', '20:33', '20:48', '21:03', '21:18', '21:48', '22:03', '22:18', '22:48', '23:18', '23:41', '00:18', '00:41'],
                'Policlinico': ['06:02', '06:47', '07:02', '07:17', '07:47', '08:02', '08:17', '08:47', '09:02', '09:17', '09:32', '09:47', '10:02', '10:17', '10:32', '10:47', '11:02', '11:17', '11:32', '11:47', '12:02', '12:17', '12:32', '12:47', '13:02', '13:17', '13:32', '13:47', '14:02', '14:17', '14:32', '15:02', '15:15', '15:30', '15:45', '16:15', '16:30', '16:45', '17:15', '17:30', '17:45', '18:00', '18:15', '18:30', '18:45', '19:00', '19:15', '19:30', '19:45', '20:00', '20:15', '20:30', '20:45', '21:00', '21:15', '21:30', '22:00', '22:15', '22:30', '23:00', '23:30', '23:52', '00:30', '00:52'],
                'Llegada Terminal': ['06:14', '07:00', '07:14', '07:29', '08:00', '08:14', '08:29', '09:00', '09:14', '09:29', '09:44', '09:59', '10:14', '10:29', '10:44', '10:59', '11:14', '11:29', '11:44', '11:59', '12:14', '12:29', '12:44', '12:59', '13:14', '13:29', '13:44', '13:59', '14:14', '14:29', '14:44', '15:14', '15:29', '15:44', '15:59', '16:29', '16:44', '16:59', '17:29', '17:44', '17:59', '18:14', '18:29', '18:44', '18:59', '19:14', '19:29', '19:44', '19:59', '20:14', '20:29', '20:44', '20:59', '21:14', '21:29', '21:44', '22:14', '22:29', '22:44', '23:14', '23:44', '00:06', '00:44', '01:05'],
                'Salida Terminal': ['06:21', '07:15', '07:29', '07:44', '08:14', '08:29', '08:44', '09:14', '09:29', '09:44', '09:59', '10:14', '10:29', '10:44', '10:59', '11:14', '11:29', '11:44', '11:59', '12:14', '12:29', '12:44', '12:59', '13:14', '13:29', '13:44', '13:59', '14:14', '14:29', '14:44', '14:59', '15:29', '15:44', '15:59', '16:14', '16:44', '16:59', '17:14', '17:44', '17:59', '18:14', '18:29', '18:44', '18:59', '19:14', '19:29', '19:44', '19:59', '20:14', '20:29', '20:44', '20:59', '21:14', '21:29', '21:44', '21:59', '22:29', '22:44', '22:59', '23:29', '23:59', '00:21', '00:59'],
                'Hospital de la Villa': ['06:28', '07:21', '07:36', '07:51', '08:21', '08:36', '08:51', '09:21', '09:36', '09:51', '10:06', '10:21', '10:36', '10:51', '11:06', '11:21', '11:36', '11:51', '12:06', '12:21', '12:36', '12:51', '13:06', '13:21', '13:36', '13:51', '14:06', '14:21', '14:36', '14:51', '15:06', '15:36', '15:51', '16:06', '16:21', '16:51', '17:06', '17:21', '17:51', '18:06', '18:21', '18:36', '18:51', '19:06', '19:21', '19:36', '19:51', '20:06', '20:21', '20:36', '20:51', '21:06', '21:21', '21:36', '21:51', '22:06', '22:36', '22:51', '23:06', '23:36', '00:06', '00:26', '01:06'],
                'Balcarce y Riobamba': ['06:47', '07:38', '07:43', '07:58', '08:28', '08:43', '08:58', '09:28', '09:43', '09:58', '10:13', '10:28', '10:43', '10:58', '11:13', '11:28', '11:43', '11:58', '12:13', '12:28', '12:43', '12:58', '13:13', '13:28', '13:43', '13:58', '14:13', '14:28', '14:43', '14:58', '15:13', '15:43', '15:58', '16:13', '16:28', '16:58', '17:13', '17:28', '17:58', '18:13', '18:28', '18:43', '18:58', '19:13', '19:28', '19:43', '19:58', '20:13', '20:28', '20:43', '20:58', '21:13', '21:28', '21:43', '21:58', '22:13', '22:43', '22:58', '23:13', '23:43', '00:13', '00:31', '01:13'],
                'Entrada Bº La Ribera': ['06:47', '08:02', '08:17', '08:32', '09:02', '09:17', '09:32', '10:02', '10:17', '10:32', '10:47', '11:02', '11:17', '11:32', '11:47', '12:02', '12:17', '12:32', '12:47', '13:02', '13:17', '13:32', '13:47', '14:02', '14:17', '14:32', '14:47', '15:02', '15:17', '15:32', '15:47', '16:17', '16:32', '16:47', '17:02', '17:32', '17:47', '18:02', '18:32', '18:47', '19:02', '19:17', '19:32', '19:47', '20:02', '20:17', '20:32', '20:47', '21:02', '21:17', '21:32', '22:02', '22:17', '22:32', '22:59', '23:32', '23:59', '00:48']
 
            },
            'viernes': {
                'M.Ernst y Cazorla': ['05:10', '05:54', '06:09', '06:24', '06:54', '07:09', '07:24', '07:54', '08:09', '08:24', '08:39', '08:54', '09:09', '09:24', '09:39', '09:54', '10:09', '10:24', '10:39', '10:54', '11:09', '11:24', '11:39', '11:54', '12:09', '12:24', '12:39', '12:54', '13:09', '13:24', '13:39', '14:09', '14:24', '14:39', '14:54', '15:24', '15:39', '15:54', '16:24', '16:39', '16:54', '17:09', '17:24', '17:39', '17:54', '18:09', '18:24', '18:39', '18:54', '19:09', '19:24', '19:39', '19:54', '20:09', '20:24', '20:39', '21:09', '21:24', '21:39', '22:09', '22:39', '23:05', '23:39', '00:05', '00:53'],
                'Hospital La Ribera': ['05:21', '06:06', '06:21', '06:36', '07:06', '07:21', '07:36', '08:06', '08:21', '08:36', '08:51', '09:06', '09:21', '09:36', '09:51', '10:06', '10:21', '10:36', '10:51', '11:06', '11:21', '11:36', '11:51', '12:06', '12:21', '12:36', '12:51', '13:06', '13:21', '13:36', '13:51', '14:21', '14:36', '14:51', '15:06', '15:36', '15:51', '16:06', '16:36', '16:51', '17:06', '17:21', '17:36', '17:51', '18:06', '18:21', '18:36', '18:51', '19:06', '19:21', '19:36', '19:51', '20:06', '20:21', '20:36', '20:51', '21:21', '21:36', '21:51', '22:21', '22:51', '23:16', '23:51', '00:16', '01:00'],
                'Escuela Agraria': ['05:33', '06:18', '06:33', '06:48', '07:18', '07:33', '07:48', '08:18', '08:33', '08:48', '09:03', '09:18', '09:33', '09:48', '10:03', '10:18', '10:33', '10:48', '11:03', '11:18', '11:33', '11:48', '12:03', '12:18', '12:33', '12:48', '13:03', '13:18', '13:33', '13:48', '14:03', '14:33', '14:48', '15:03', '15:18', '15:48', '16:03', '16:18', '16:48', '17:03', '17:18', '17:33', '17:48', '18:03', '18:18', '18:33', '18:48', '19:03', '19:18', '19:33', '19:48', '20:03', '20:18', '20:33', '20:48', '21:03', '21:33', '21:48', '22:03', '22:33', '23:03', '23:27', '00:03', '00:27'],
                'Ayacucho y Balcarce': ['05:47', '06:33', '06:48', '07:03', '07:33', '07:48', '08:03', '08:33', '08:48', '09:03', '09:18', '09:33', '09:48', '10:03', '10:18', '10:33', '10:48', '11:03', '11:18', '11:33', '11:48', '12:03', '12:18', '12:33', '12:48', '13:03', '13:18', '13:33', '13:48', '14:03', '14:18', '14:48', '15:03', '15:18', '15:33', '16:03', '16:18', '16:33', '17:03', '17:18', '17:33', '17:48', '18:03', '18:18', '18:33', '18:48', '19:03', '19:18', '19:33', '19:48', '20:03', '20:18', '20:33', '20:48', '21:03', '21:18', '21:48', '22:03', '22:18', '22:48', '23:18', '23:41', '00:18', '00:41'],
                'Policlinico': ['06:02', '06:47', '07:02', '07:17', '07:47', '08:02', '08:17', '08:47', '09:02', '09:17', '09:32', '09:47', '10:02', '10:17', '10:32', '10:47', '11:02', '11:17', '11:32', '11:47', '12:02', '12:17', '12:32', '12:47', '13:02', '13:17', '13:32', '13:47', '14:02', '14:17', '14:32', '15:02', '15:15', '15:30', '15:45', '16:15', '16:30', '16:45', '17:15', '17:30', '17:45', '18:00', '18:15', '18:30', '18:45', '19:00', '19:15', '19:30', '19:45', '20:00', '20:15', '20:30', '20:45', '21:00', '21:15', '21:30', '22:00', '22:15', '22:30', '23:00', '23:30', '23:52', '00:30', '00:52'],
                'Llegada Terminal': ['06:14', '07:00', '07:14', '07:29', '08:00', '08:14', '08:29', '09:00', '09:14', '09:29', '09:44', '09:59', '10:14', '10:29', '10:44', '10:59', '11:14', '11:29', '11:44', '11:59', '12:14', '12:29', '12:44', '12:59', '13:14', '13:29', '13:44', '13:59', '14:14', '14:29', '14:44', '15:14', '15:29', '15:44', '15:59', '16:29', '16:44', '16:59', '17:29', '17:44', '17:59', '18:14', '18:29', '18:44', '18:59', '19:14', '19:29', '19:44', '19:59', '20:14', '20:29', '20:44', '20:59', '21:14', '21:29', '21:44', '22:14', '22:29', '22:44', '23:14', '23:44', '00:06', '00:44', '01:05'],
                'Salida Terminal': ['06:21', '07:15', '07:29', '07:44', '08:14', '08:29', '08:44', '09:14', '09:29', '09:44', '09:59', '10:14', '10:29', '10:44', '10:59', '11:14', '11:29', '11:44', '11:59', '12:14', '12:29', '12:44', '12:59', '13:14', '13:29', '13:44', '13:59', '14:14', '14:29', '14:44', '14:59', '15:29', '15:44', '15:59', '16:14', '16:44', '16:59', '17:14', '17:44', '17:59', '18:14', '18:29', '18:44', '18:59', '19:14', '19:29', '19:44', '19:59', '20:14', '20:29', '20:44', '20:59', '21:14', '21:29', '21:44', '21:59', '22:29', '22:44', '22:59', '23:29', '23:59', '00:21', '00:59'],
                'Hospital de la Villa': ['06:28', '07:21', '07:36', '07:51', '08:21', '08:36', '08:51', '09:21', '09:36', '09:51', '10:06', '10:21', '10:36', '10:51', '11:06', '11:21', '11:36', '11:51', '12:06', '12:21', '12:36', '12:51', '13:06', '13:21', '13:36', '13:51', '14:06', '14:21', '14:36', '14:51', '15:06', '15:36', '15:51', '16:06', '16:21', '16:51', '17:06', '17:21', '17:51', '18:06', '18:21', '18:36', '18:51', '19:06', '19:21', '19:36', '19:51', '20:06', '20:21', '20:36', '20:51', '21:06', '21:21', '21:36', '21:51', '22:06', '22:36', '22:51', '23:06', '23:36', '00:06', '00:26', '01:06'],
                'Balcarce y Riobamba': ['06:47', '07:38', '07:43', '07:58', '08:28', '08:43', '08:58', '09:28', '09:43', '09:58', '10:13', '10:28', '10:43', '10:58', '11:13', '11:28', '11:43', '11:58', '12:13', '12:28', '12:43', '12:58', '13:13', '13:28', '13:43', '13:58', '14:13', '14:28', '14:43', '14:58', '15:13', '15:43', '15:58', '16:13', '16:28', '16:58', '17:13', '17:28', '17:58', '18:13', '18:28', '18:43', '18:58', '19:13', '19:28', '19:43', '19:58', '20:13', '20:28', '20:43', '20:58', '21:13', '21:28', '21:43', '21:58', '22:13', '22:43', '22:58', '23:13', '23:43', '00:13', '00:31', '01:13'],
                'Entrada Bº La Ribera': ['06:47', '08:02', '08:17', '08:32', '09:02', '09:17', '09:32', '10:02', '10:17', '10:32', '10:47', '11:02', '11:17', '11:32', '11:47', '12:02', '12:17', '12:32', '12:47', '13:02', '13:17', '13:32', '13:47', '14:02', '14:17', '14:32', '14:47', '15:02', '15:17', '15:32', '15:47', '16:17', '16:32', '16:47', '17:02', '17:32', '17:47', '18:02', '18:32', '18:47', '19:02', '19:17', '19:32', '19:47', '20:02', '20:17', '20:32', '20:47', '21:02', '21:17', '21:32', '22:02', '22:17', '22:32', '22:59', '23:32', '23:59', '00:48']
 
            },
            'sabado': {
                'M.Ernst y Cazorla': ['05:10','05:56','06:52','07:48','08:44','09:40','10:36','11:32','12:28','13:24','14:18','14:46','15:14','15:42','16:10','16:38','17:06','17:34','18:02','18:30','18:58','19:26','19:54','20:22','20:50','21:18','21:46','22:14','22:42','23:10','23:38','00:06','00:57'],
                'Hospital La Ribera': ['05:18','06:04','07:00','07:56','08:52','09:48','10:44','11:40','12:36','13:32','14:26','14:54','15:22','15:50','16:18','16:46','17:14','17:42','18:10','18:38','19:06','19:34','20:02','20:30','20:58','21:26','21:54','22:22','22:50','23:18','23:46','00:14','01:05'],
                'Escuela Agraria': ['05:26','06:12','07:08','08:04','09:00','09:56','10:52','11:48','12:44','13:40','14:34','15:02','15:30','15:58','16:26','16:54','17:22','17:50','18:18','18:46','19:14','19:42','20:10','20:38','21:06','21:34','22:02','22:30','22:58','23:26','23:54','00:22'],
                'Ayacucho y Balcarce': ['05:33','06:19','07:15','08:11','09:07','10:03','10:59','11:55','12:51','13:47','14:41','15:09','15:37','16:05','16:33','17:01','17:29','17:57','18:25','18:53','19:21','19:49','20:17','20:45','21:13','21:41','22:09','22:37','23:05','23:33','00:01','00:29'],
                'Policlinico': ['05:40','06:26','07:22','08:18','09:14','10:10','11:06','12:02','12:58','13:54','14:48','15:16','15:44','16:12','16:40','17:08','17:36','18:04','18:32','19:00','19:28','19:56','20:24','20:52','21:20','21:48','22:16','22:44','23:12','23:40','00:08','00:36'],
                'Llegada Terminal': ['05:47','06:33','07:29','08:25','09:21','10:17','11:13','12:09','13:05','14:01','14:55','15:23','15:51','16:19','16:47','17:15','17:43','18:11','18:39','19:07','19:35','20:03','20:31','20:59','21:27','21:55','22:23','22:51','23:19','23:47','00:15','00:43'],
                'Salida Terminal': ['06:18','07:14','08:10','09:06','10:02','10:58','11:54','12:50','13:46','14:40','15:08','15:36','16:04','16:32','17:00','17:28','17:56','18:24','18:52','19:20','19:48','20:16','20:44','21:12','21:40','22:08','22:36','23:04','23:32','00:00','00:28','00:56'],
                'Hospital de la Villa': ['06:25','07:21','08:17','09:13','10:09','11:05','12:01','12:57','13:53','14:47','15:15','15:43','16:11','16:39','17:07','17:35','18:03','18:31','18:59','19:27','19:55','20:23','20:51','21:19','21:47','22:15','22:43','23:11','23:39','00:07','00:35','01:03'],
                'Balcarce y Riobamba': ['06:31','07:27','08:23','09:19','10:15','11:11','12:07','13:03','13:59','14:53','15:21','15:49','16:17','16:45','17:13','17:41','18:09','18:37','19:05','19:33','20:01','20:29','20:57','21:25','21:53','22:21','22:49','23:17','23:45','00:13','00:41'],
                'Entrada Bº La Ribera': ['06:47','07:39','08:35','09:31','10:27','11:23','12:19','13:15','14:11','15:07','15:35','16:03','16:31','16:59','17:27','17:55','18:23','18:51','19:19','19:47','20:15','20:43','21:11','21:39','22:07','22:35','23:03','23:31','23:59','00:27','00:55','01:05']
            }
        }
    },
    'Zona Este': {
        stops: [
            'Pellegrini y Nelson', 'Maipu y Avila', 'Tucuman y Tallaferro', 'Policlinico', 
            'Llegada Terminal', 'Salida Terminal', 'Balcarce y Maipu', 'E.Aguero y L.Guillet', 
            'Gauna y Maipu', 'Htal Bº Eva Peron'
        ],
        schedules: {
            'domingo': {
                'Pellegrini y Nelson': ['05:18','07:03','08:48','10:33','12:18','14:03','15:48','17:33','19:18'],
                'Maipu y Avila': ['05:29','07:14','08:59','10:44','12:29','14:14','15:59','17:44','19:29'],
                'Tucuman y Tallaferro': ['05:40','07:25','09:10','10:55','12:40','14:25','16:10','17:55','19:40'],
                'Policlinico': ['05:53','07:38','09:23','11:08','12:53','14:38','16:23','18:08','19:53'],
                'Llegada Terminal': ['06:01','07:46','09:31','11:16','13:01','14:46','16:31','18:16','20:01'],
                'Salida de Terminal': ['06:16','08:01','09:46','11:31','13:16','15:01','16:46','18:31','20:16'],
                'Balcarce y Maipu': ['06:20','08:05','09:50','11:35','13:20','15:05','16:50','18:35','20:20'],
                'E.Aguero y L.Guillet': ['06:31','08:16','10:01','11:46','13:31','15:16','17:01','18:46','20:31'],
                'Gauna y Maipu': ['06:43','08:28','10:13','11:58','13:43','15:28','17:13','18:58','20:43'],
                'Htal Bº Eva Peron': ['05:15','07:00','08:45','10:30','12:15','14:00','15:45','17:30','19:15','21:00']
            },
            'lunes': {
                'Pellegrini y Nelson': ['05:17', '05:58', '06:30', '07:14', '07:53', '08:32', '09:11', '09:50', '10:29', '11:08', '11:47', '12:26', '13:05', '13:44', '14:23', '15:02', '15:41', '16:20', '16:59', '17:38', '18:17', '18:56', '19:35', '20:14', '21:31'],
                'Maipu y Avila': ['05:32', '06:06', '06:44', '07:29', '08:08', '08:47', '09:26', '10:05', '10:44', '11:23', '12:02', '12:41', '13:20', '13:59', '14:38', '15:17', '15:56', '16:35', '17:14', '17:53', '18:32', '19:11', '19:50', '20:29', '21:45'],
                'Tucuman y Tallaferro': ['05:45', '06:21', '06:56', '07:39', '08:18', '08:57', '09:36', '10:15', '10:54', '11:33', '12:12', '12:51', '13:30', '14:09', '14:48', '15:27', '16:06', '16:45', '17:24', '18:03', '18:42', '19:21', '20:00', '20:39', '21:57'],
                'Policlinico': ['05:58', '06:26', '07:08', '07:44', '08:23', '09:02', '09:41', '10:20', '10:59', '11:38', '12:17', '12:56', '13:35', '14:14', '14:53', '15:32', '16:11', '16:50', '17:29', '18:08', '18:47', '19:26', '20:05', '20:44', '22:09'],
                'Llegada Terminal': ['06:07', '06:39', '07:15', '07:57', '08:38', '09:15', '09:54', '10:33', '11:12', '11:51', '12:30', '13:09', '13:48', '14:27', '15:06', '15:45', '16:24', '17:03', '17:42', '18:21', '19:00', '19:39', '20:18', '20:57', '22:16'],
                'Salida Terminal': ['06:24', '06:50', '07:46', '08:03', '08:42', '09:21', '10:00', '10:39', '11:18', '11:57', '12:36', '13:15', '13:54', '14:33', '15:12', '15:51', '16:30', '17:09', '17:48', '18:27', '19:06', '19:45', '20:24', '21:03', '22:31'],
                'Balcarce y Maipu': ['06:21', '06:39', '07:07', '07:57', '08:18', '08:57', '09:36', '10:15', '10:54', '11:33', '12:12', '12:51', '13:30', '14:09', '14:48', '15:27', '16:06', '16:45', '17:24', '18:03', '18:42', '19:21', '20:00', '20:39', '22:35'],
                'E.Aguero y L.Guillet': ['06:26', '06:44', '07:15', '08:08', '08:25', '09:04', '09:43', '10:22', '11:01', '11:40', '12:19', '12:58', '13:37', '14:16', '14:55', '15:34', '16:13', '16:52', '17:31', '18:10', '18:49', '19:28', '20:07', '20:46', '22:47'],
                'Gauna y Maipu': ['06:39', '06:57', '07:34', '08:23', '08:38', '09:17', '09:56', '10:35', '11:14', '11:53', '12:32', '13:11', '13:50', '14:29', '15:08', '15:47', '16:26', '17:05', '17:44', '18:23', '19:02', '19:41', '20:20', '20:59', '22:57'],
                'Hospital Bº Eva Peron': ['06:50', '07:07', '07:46', '08:25', '09:04', '09:43', '10:22', '11:01', '11:40', '12:19', '12:58', '13:37', '14:16', '14:55', '15:34', '16:13', '16:52', '17:31', '18:10', '18:49', '19:28', '20:07', '20:46', '21:25', '23:14']
            },
            'martes': {
                'Pellegrini y Nelson': ['05:17', '05:58', '06:30', '07:14', '07:53', '08:32', '09:11', '09:50', '10:29', '11:08', '11:47', '12:26', '13:05', '13:44', '14:23', '15:02', '15:41', '16:20', '16:59', '17:38', '18:17', '18:56', '19:35', '20:14', '21:31'],
                'Maipu y Avila': ['05:32', '06:06', '06:44', '07:29', '08:08', '08:47', '09:26', '10:05', '10:44', '11:23', '12:02', '12:41', '13:20', '13:59', '14:38', '15:17', '15:56', '16:35', '17:14', '17:53', '18:32', '19:11', '19:50', '20:29', '21:45'],
                'Tucuman y Tallaferro': ['05:45', '06:21', '06:56', '07:39', '08:18', '08:57', '09:36', '10:15', '10:54', '11:33', '12:12', '12:51', '13:30', '14:09', '14:48', '15:27', '16:06', '16:45', '17:24', '18:03', '18:42', '19:21', '20:00', '20:39', '21:57'],
                'Policlinico': ['05:58', '06:26', '07:08', '07:44', '08:23', '09:02', '09:41', '10:20', '10:59', '11:38', '12:17', '12:56', '13:35', '14:14', '14:53', '15:32', '16:11', '16:50', '17:29', '18:08', '18:47', '19:26', '20:05', '20:44', '22:09'],
                'Llegada Terminal': ['06:07', '06:39', '07:15', '07:57', '08:38', '09:15', '09:54', '10:33', '11:12', '11:51', '12:30', '13:09', '13:48', '14:27', '15:06', '15:45', '16:24', '17:03', '17:42', '18:21', '19:00', '19:39', '20:18', '20:57', '22:16'],
                'Salida Terminal': ['06:24', '06:50', '07:46', '08:03', '08:42', '09:21', '10:00', '10:39', '11:18', '11:57', '12:36', '13:15', '13:54', '14:33', '15:12', '15:51', '16:30', '17:09', '17:48', '18:27', '19:06', '19:45', '20:24', '21:03', '22:31'],
                'Balcarce y Maipu': ['06:21', '06:39', '07:07', '07:57', '08:18', '08:57', '09:36', '10:15', '10:54', '11:33', '12:12', '12:51', '13:30', '14:09', '14:48', '15:27', '16:06', '16:45', '17:24', '18:03', '18:42', '19:21', '20:00', '20:39', '22:35'],
                'E.Aguero y L.Guillet': ['06:26', '06:44', '07:15', '08:08', '08:25', '09:04', '09:43', '10:22', '11:01', '11:40', '12:19', '12:58', '13:37', '14:16', '14:55', '15:34', '16:13', '16:52', '17:31', '18:10', '18:49', '19:28', '20:07', '20:46', '22:47'],
                'Gauna y Maipu': ['06:39', '06:57', '07:34', '08:23', '08:38', '09:17', '09:56', '10:35', '11:14', '11:53', '12:32', '13:11', '13:50', '14:29', '15:08', '15:47', '16:26', '17:05', '17:44', '18:23', '19:02', '19:41', '20:20', '20:59', '22:57'],
                'Hospital Bº Eva Peron': ['06:50', '07:07', '07:46', '08:25', '09:04', '09:43', '10:22', '11:01', '11:40', '12:19', '12:58', '13:37', '14:16', '14:55', '15:34', '16:13', '16:52', '17:31', '18:10', '18:49', '19:28', '20:07', '20:46', '21:25', '23:14']
 
            },
            'miercoles': {
                'Pellegrini y Nelson': ['05:17', '05:58', '06:30', '07:14', '07:53', '08:32', '09:11', '09:50', '10:29', '11:08', '11:47', '12:26', '13:05', '13:44', '14:23', '15:02', '15:41', '16:20', '16:59', '17:38', '18:17', '18:56', '19:35', '20:14', '21:31'],
                'Maipu y Avila': ['05:32', '06:06', '06:44', '07:29', '08:08', '08:47', '09:26', '10:05', '10:44', '11:23', '12:02', '12:41', '13:20', '13:59', '14:38', '15:17', '15:56', '16:35', '17:14', '17:53', '18:32', '19:11', '19:50', '20:29', '21:45'],
                'Tucuman y Tallaferro': ['05:45', '06:21', '06:56', '07:39', '08:18', '08:57', '09:36', '10:15', '10:54', '11:33', '12:12', '12:51', '13:30', '14:09', '14:48', '15:27', '16:06', '16:45', '17:24', '18:03', '18:42', '19:21', '20:00', '20:39', '21:57'],
                'Policlinico': ['05:58', '06:26', '07:08', '07:44', '08:23', '09:02', '09:41', '10:20', '10:59', '11:38', '12:17', '12:56', '13:35', '14:14', '14:53', '15:32', '16:11', '16:50', '17:29', '18:08', '18:47', '19:26', '20:05', '20:44', '22:09'],
                'Llegada Terminal': ['06:07', '06:39', '07:15', '07:57', '08:38', '09:15', '09:54', '10:33', '11:12', '11:51', '12:30', '13:09', '13:48', '14:27', '15:06', '15:45', '16:24', '17:03', '17:42', '18:21', '19:00', '19:39', '20:18', '20:57', '22:16'],
                'Salida Terminal': ['06:24', '06:50', '07:46', '08:03', '08:42', '09:21', '10:00', '10:39', '11:18', '11:57', '12:36', '13:15', '13:54', '14:33', '15:12', '15:51', '16:30', '17:09', '17:48', '18:27', '19:06', '19:45', '20:24', '21:03', '22:31'],
                'Balcarce y Maipu': ['06:21', '06:39', '07:07', '07:57', '08:18', '08:57', '09:36', '10:15', '10:54', '11:33', '12:12', '12:51', '13:30', '14:09', '14:48', '15:27', '16:06', '16:45', '17:24', '18:03', '18:42', '19:21', '20:00', '20:39', '22:35'],
                'E.Aguero y L.Guillet': ['06:26', '06:44', '07:15', '08:08', '08:25', '09:04', '09:43', '10:22', '11:01', '11:40', '12:19', '12:58', '13:37', '14:16', '14:55', '15:34', '16:13', '16:52', '17:31', '18:10', '18:49', '19:28', '20:07', '20:46', '22:47'],
                'Gauna y Maipu': ['06:39', '06:57', '07:34', '08:23', '08:38', '09:17', '09:56', '10:35', '11:14', '11:53', '12:32', '13:11', '13:50', '14:29', '15:08', '15:47', '16:26', '17:05', '17:44', '18:23', '19:02', '19:41', '20:20', '20:59', '22:57'],
                'Hospital Bº Eva Peron': ['06:50', '07:07', '07:46', '08:25', '09:04', '09:43', '10:22', '11:01', '11:40', '12:19', '12:58', '13:37', '14:16', '14:55', '15:34', '16:13', '16:52', '17:31', '18:10', '18:49', '19:28', '20:07', '20:46', '21:25', '23:14']
 
            },
            'jueves': {
                'Pellegrini y Nelson': ['05:17', '05:58', '06:30', '07:14', '07:53', '08:32', '09:11', '09:50', '10:29', '11:08', '11:47', '12:26', '13:05', '13:44', '14:23', '15:02', '15:41', '16:20', '16:59', '17:38', '18:17', '18:56', '19:35', '20:14', '21:31'],
                'Maipu y Avila': ['05:32', '06:06', '06:44', '07:29', '08:08', '08:47', '09:26', '10:05', '10:44', '11:23', '12:02', '12:41', '13:20', '13:59', '14:38', '15:17', '15:56', '16:35', '17:14', '17:53', '18:32', '19:11', '19:50', '20:29', '21:45'],
                'Tucuman y Tallaferro': ['05:45', '06:21', '06:56', '07:39', '08:18', '08:57', '09:36', '10:15', '10:54', '11:33', '12:12', '12:51', '13:30', '14:09', '14:48', '15:27', '16:06', '16:45', '17:24', '18:03', '18:42', '19:21', '20:00', '20:39', '21:57'],
                'Policlinico': ['05:58', '06:26', '07:08', '07:44', '08:23', '09:02', '09:41', '10:20', '10:59', '11:38', '12:17', '12:56', '13:35', '14:14', '14:53', '15:32', '16:11', '16:50', '17:29', '18:08', '18:47', '19:26', '20:05', '20:44', '22:09'],
                'Llegada Terminal': ['06:07', '06:39', '07:15', '07:57', '08:38', '09:15', '09:54', '10:33', '11:12', '11:51', '12:30', '13:09', '13:48', '14:27', '15:06', '15:45', '16:24', '17:03', '17:42', '18:21', '19:00', '19:39', '20:18', '20:57', '22:16'],
                'Salida Terminal': ['06:24', '06:50', '07:46', '08:03', '08:42', '09:21', '10:00', '10:39', '11:18', '11:57', '12:36', '13:15', '13:54', '14:33', '15:12', '15:51', '16:30', '17:09', '17:48', '18:27', '19:06', '19:45', '20:24', '21:03', '22:31'],
                'Balcarce y Maipu': ['06:21', '06:39', '07:07', '07:57', '08:18', '08:57', '09:36', '10:15', '10:54', '11:33', '12:12', '12:51', '13:30', '14:09', '14:48', '15:27', '16:06', '16:45', '17:24', '18:03', '18:42', '19:21', '20:00', '20:39', '22:35'],
                'E.Aguero y L.Guillet': ['06:26', '06:44', '07:15', '08:08', '08:25', '09:04', '09:43', '10:22', '11:01', '11:40', '12:19', '12:58', '13:37', '14:16', '14:55', '15:34', '16:13', '16:52', '17:31', '18:10', '18:49', '19:28', '20:07', '20:46', '22:47'],
                'Gauna y Maipu': ['06:39', '06:57', '07:34', '08:23', '08:38', '09:17', '09:56', '10:35', '11:14', '11:53', '12:32', '13:11', '13:50', '14:29', '15:08', '15:47', '16:26', '17:05', '17:44', '18:23', '19:02', '19:41', '20:20', '20:59', '22:57'],
                'Hospital Bº Eva Peron': ['06:50', '07:07', '07:46', '08:25', '09:04', '09:43', '10:22', '11:01', '11:40', '12:19', '12:58', '13:37', '14:16', '14:55', '15:34', '16:13', '16:52', '17:31', '18:10', '18:49', '19:28', '20:07', '20:46', '21:25', '23:14']
 
            },
            'viernes': {
                'Pellegrini y Nelson': ['05:17', '05:58', '06:30', '07:14', '07:53', '08:32', '09:11', '09:50', '10:29', '11:08', '11:47', '12:26', '13:05', '13:44', '14:23', '15:02', '15:41', '16:20', '16:59', '17:38', '18:17', '18:56', '19:35', '20:14', '21:31'],
                'Maipu y Avila': ['05:32', '06:06', '06:44', '07:29', '08:08', '08:47', '09:26', '10:05', '10:44', '11:23', '12:02', '12:41', '13:20', '13:59', '14:38', '15:17', '15:56', '16:35', '17:14', '17:53', '18:32', '19:11', '19:50', '20:29', '21:45'],
                'Tucuman y Tallaferro': ['05:45', '06:21', '06:56', '07:39', '08:18', '08:57', '09:36', '10:15', '10:54', '11:33', '12:12', '12:51', '13:30', '14:09', '14:48', '15:27', '16:06', '16:45', '17:24', '18:03', '18:42', '19:21', '20:00', '20:39', '21:57'],
                'Policlinico': ['05:58', '06:26', '07:08', '07:44', '08:23', '09:02', '09:41', '10:20', '10:59', '11:38', '12:17', '12:56', '13:35', '14:14', '14:53', '15:32', '16:11', '16:50', '17:29', '18:08', '18:47', '19:26', '20:05', '20:44', '22:09'],
                'Llegada Terminal': ['06:07', '06:39', '07:15', '07:57', '08:38', '09:15', '09:54', '10:33', '11:12', '11:51', '12:30', '13:09', '13:48', '14:27', '15:06', '15:45', '16:24', '17:03', '17:42', '18:21', '19:00', '19:39', '20:18', '20:57', '22:16'],
                'Salida Terminal': ['06:24', '06:50', '07:46', '08:03', '08:42', '09:21', '10:00', '10:39', '11:18', '11:57', '12:36', '13:15', '13:54', '14:33', '15:12', '15:51', '16:30', '17:09', '17:48', '18:27', '19:06', '19:45', '20:24', '21:03', '22:31'],
                'Balcarce y Maipu': ['06:21', '06:39', '07:07', '07:57', '08:18', '08:57', '09:36', '10:15', '10:54', '11:33', '12:12', '12:51', '13:30', '14:09', '14:48', '15:27', '16:06', '16:45', '17:24', '18:03', '18:42', '19:21', '20:00', '20:39', '22:35'],
                'E.Aguero y L.Guillet': ['06:26', '06:44', '07:15', '08:08', '08:25', '09:04', '09:43', '10:22', '11:01', '11:40', '12:19', '12:58', '13:37', '14:16', '14:55', '15:34', '16:13', '16:52', '17:31', '18:10', '18:49', '19:28', '20:07', '20:46', '22:47'],
                'Gauna y Maipu': ['06:39', '06:57', '07:34', '08:23', '08:38', '09:17', '09:56', '10:35', '11:14', '11:53', '12:32', '13:11', '13:50', '14:29', '15:08', '15:47', '16:26', '17:05', '17:44', '18:23', '19:02', '19:41', '20:20', '20:59', '22:57'],
                'Hospital Bº Eva Peron': ['06:50', '07:07', '07:46', '08:25', '09:04', '09:43', '10:22', '11:01', '11:40', '12:19', '12:58', '13:37', '14:16', '14:55', '15:34', '16:13', '16:52', '17:31', '18:10', '18:49', '19:28', '20:07', '20:46', '21:25', '23:14']
 
            },
            'sabado': {
                'Pellegrini y Nelson': ['05:23','07:07','07:59','08:51','09:43','10:35','11:27','12:19','13:11','14:03','14:55','15:47','16:39','17:31','18:23','19:15','20:07','21:51'],
                'Maipu y Avila': ['05:34','07:18','08:10','09:02','09:54','10:46','11:38','12:30','13:22','14:14','15:06','15:58','16:50','17:42','18:34','19:26','20:18','22:02'],
                'Tucuman y Tallaferro': ['05:45','07:29','08:21','09:13','10:05','10:57','11:49','12:41','13:33','14:25','15:17','16:09','17:01','17:53','18:45','19:37','20:29','22:13'],
                'Policlinico': ['05:58','07:42','08:34','09:26','10:18','11:10','12:02','12:54','13:46','14:38','15:30','16:22','17:14','18:06','18:58','19:50','20:42','22:26'],
                'Llegada Terminal': ['06:06','07:50','08:42','09:34','10:26','11:18','12:10','13:02','13:54','14:46','15:38','16:30','17:22','18:14','19:06','19:58','20:50','22:34'],
                'Salida Terminal': ['06:21','08:05','08:57','09:49','10:41','11:33','12:25','13:17','14:09','15:01','15:53','16:45','17:37','18:29','19:21','20:13','21:05','21:21'],
                'Balcarce y Maipu': ['06:25','08:09','09:01','09:53','10:45','11:37','12:29','13:21','14:13','15:05','15:57','16:49','17:41','18:33','19:25','20:17','21:09','21:25'],
                'E.Aguero y L.Guillet': ['06:36','08:20','09:12','10:04','10:56','11:48','12:40','13:32','14:24','15:16','16:08','17:00','17:52','18:44','19:36','20:28','21:20','21:36'],
                'Gauna y Maipu': ['06:48','08:32','09:24','10:16','11:08','12:00','12:52','13:44','14:36','15:28','16:20','17:12','18:04','18:56','19:48','20:40','21:32','21:48'],
                'Htal Bº Eva Peron': ['07:04','07:56','08:48','09:40','10:32','11:24','12:16','13:08','14:00','14:52','15:44','16:36','17:28','18:20','19:12','20:04','20:56','21:48']
            },
        }
    },
    'Zona Oeste': {
        stops: [
            'Salida Terminal', 'Chacabuco y Guemes', 'Llerena y Sallorenzo', 'Balcarce y Ayacucho', 
            'Policlinico', 'Potosi y Belgrano', 'Lainez y Sallorenzo', '3 de Febrero y 25 de Mayo', 
            'Llegada Terminal'
        ],
        schedules: {
            'domingo': {
                'Chacabuco y Guemes': ['09:20','10:52','12:24','13:56','15:28'],
                'Llerena y Sallorenzo': ['09:29','11:01','12:33','14:05','15:37'],
                'Balcarce y Ayacucho': ['09:41','11:13','12:45','14:17','15:49'],
                'Policlinico': ['09:52','11:24','12:56','14:28','16:00'],
                'Potosi y Belgrano': ['10:02','11:34','13:06','14:38','16:10'],
                'Chacabuco y Sallorenzo': ['10:15','11:47','13:19','14:51','16:23'],
                '25 de Mayo y B. Moyano': ['10:20','11:52','13:24','14:56','16:28'],
                'Llegada a Terminal': ['10:22','11:54','13:26','14:58','16:30'],
                'Salida de Terminal': ['09:05','10:37','12:09','13:41','15:13']
            },
            'lunes': {
                'Salida Terminal': ['05:15', '06:47', '08:19', '09:51', '11:23', '12:55', '14:27', '15:59', '17:31', '19:03'],
                'Chacabuco y Guemes': ['05:30', '07:02', '08:34', '10:06', '11:38', '13:10', '14:42', '16:14', '17:46', '19:13'],
                'Llerena y Sallorenzo': ['05:39', '07:11', '08:43', '10:15', '11:47', '13:19', '14:51', '16:23', '17:55', '19:27'],
                'Balcarce y Ayacucho': ['05:51', '07:23', '08:55', '10:27', '11:59', '13:31', '15:03', '16:35', '18:07', '19:39'],
                'Policlinico': ['06:02', '07:34', '09:06', '10:38', '12:10', '13:42', '15:14', '16:46', '18:18', '19:50'],
                'Potosi y Belgrano': ['06:12', '07:44', '09:16', '10:48', '12:20', '13:52', '15:24', '16:56', '18:28', '20:00'],
                'Lainez y Sallorenzo': ['06:23', '07:57', '09:29', '11:01', '12:33', '14:05', '15:37', '17:09', '18:41', '20:13'],
                '3 de Febrero y 25 de Mayo': ['06:30', '08:02', '09:34', '11:06', '12:38', '14:10', '15:42', '17:14', '18:46', '20:18'],
                'Llegada Terminal': ['06:32', '08:04', '09:36', '11:08', '12:40', '14:12', '15:44', '17:16', '18:48', '20:20']
            },
            'martes': {
                'Salida Terminal': ['05:15', '06:47', '08:19', '09:51', '11:23', '12:55', '14:27', '15:59', '17:31', '19:03'],
                'Chacabuco y Guemes': ['05:30', '07:02', '08:34', '10:06', '11:38', '13:10', '14:42', '16:14', '17:46', '19:13'],
                'Llerena y Sallorenzo': ['05:39', '07:11', '08:43', '10:15', '11:47', '13:19', '14:51', '16:23', '17:55', '19:27'],
                'Balcarce y Ayacucho': ['05:51', '07:23', '08:55', '10:27', '11:59', '13:31', '15:03', '16:35', '18:07', '19:39'],
                'Policlinico': ['06:02', '07:34', '09:06', '10:38', '12:10', '13:42', '15:14', '16:46', '18:18', '19:50'],
                'Potosi y Belgrano': ['06:12', '07:44', '09:16', '10:48', '12:20', '13:52', '15:24', '16:56', '18:28', '20:00'],
                'Lainez y Sallorenzo': ['06:23', '07:57', '09:29', '11:01', '12:33', '14:05', '15:37', '17:09', '18:41', '20:13'],
                '3 de Febrero y 25 de Mayo': ['06:30', '08:02', '09:34', '11:06', '12:38', '14:10', '15:42', '17:14', '18:46', '20:18'],
                'Llegada Terminal': ['06:32', '08:04', '09:36', '11:08', '12:40', '14:12', '15:44', '17:16', '18:48', '20:20']
 
            },
            'miercoles': {
                'Salida Terminal': ['05:15', '06:47', '08:19', '09:51', '11:23', '12:55', '14:27', '15:59', '17:31', '19:03'],
                'Chacabuco y Guemes': ['05:30', '07:02', '08:34', '10:06', '11:38', '13:10', '14:42', '16:14', '17:46', '19:13'],
                'Llerena y Sallorenzo': ['05:39', '07:11', '08:43', '10:15', '11:47', '13:19', '14:51', '16:23', '17:55', '19:27'],
                'Balcarce y Ayacucho': ['05:51', '07:23', '08:55', '10:27', '11:59', '13:31', '15:03', '16:35', '18:07', '19:39'],
                'Policlinico': ['06:02', '07:34', '09:06', '10:38', '12:10', '13:42', '15:14', '16:46', '18:18', '19:50'],
                'Potosi y Belgrano': ['06:12', '07:44', '09:16', '10:48', '12:20', '13:52', '15:24', '16:56', '18:28', '20:00'],
                'Lainez y Sallorenzo': ['06:23', '07:57', '09:29', '11:01', '12:33', '14:05', '15:37', '17:09', '18:41', '20:13'],
                '3 de Febrero y 25 de Mayo': ['06:30', '08:02', '09:34', '11:06', '12:38', '14:10', '15:42', '17:14', '18:46', '20:18'],
                'Llegada Terminal': ['06:32', '08:04', '09:36', '11:08', '12:40', '14:12', '15:44', '17:16', '18:48', '20:20']
 
            },
            'jueves': {
                'Salida Terminal': ['05:15', '06:47', '08:19', '09:51', '11:23', '12:55', '14:27', '15:59', '17:31', '19:03'],
                'Chacabuco y Guemes': ['05:30', '07:02', '08:34', '10:06', '11:38', '13:10', '14:42', '16:14', '17:46', '19:13'],
                'Llerena y Sallorenzo': ['05:39', '07:11', '08:43', '10:15', '11:47', '13:19', '14:51', '16:23', '17:55', '19:27'],
                'Balcarce y Ayacucho': ['05:51', '07:23', '08:55', '10:27', '11:59', '13:31', '15:03', '16:35', '18:07', '19:39'],
                'Policlinico': ['06:02', '07:34', '09:06', '10:38', '12:10', '13:42', '15:14', '16:46', '18:18', '19:50'],
                'Potosi y Belgrano': ['06:12', '07:44', '09:16', '10:48', '12:20', '13:52', '15:24', '16:56', '18:28', '20:00'],
                'Lainez y Sallorenzo': ['06:23', '07:57', '09:29', '11:01', '12:33', '14:05', '15:37', '17:09', '18:41', '20:13'],
                '3 de Febrero y 25 de Mayo': ['06:30', '08:02', '09:34', '11:06', '12:38', '14:10', '15:42', '17:14', '18:46', '20:18'],
                'Llegada Terminal': ['06:32', '08:04', '09:36', '11:08', '12:40', '14:12', '15:44', '17:16', '18:48', '20:20']
 
            },
            'viernes': {
                'Salida Terminal': ['05:15', '06:47', '08:19', '09:51', '11:23', '12:55', '14:27', '15:59', '17:31', '19:03'],
                'Chacabuco y Guemes': ['05:30', '07:02', '08:34', '10:06', '11:38', '13:10', '14:42', '16:14', '17:46', '19:13'],
                'Llerena y Sallorenzo': ['05:39', '07:11', '08:43', '10:15', '11:47', '13:19', '14:51', '16:23', '17:55', '19:27'],
                'Balcarce y Ayacucho': ['05:51', '07:23', '08:55', '10:27', '11:59', '13:31', '15:03', '16:35', '18:07', '19:39'],
                'Policlinico': ['06:02', '07:34', '09:06', '10:38', '12:10', '13:42', '15:14', '16:46', '18:18', '19:50'],
                'Potosi y Belgrano': ['06:12', '07:44', '09:16', '10:48', '12:20', '13:52', '15:24', '16:56', '18:28', '20:00'],
                'Lainez y Sallorenzo': ['06:23', '07:57', '09:29', '11:01', '12:33', '14:05', '15:37', '17:09', '18:41', '20:13'],
                '3 de Febrero y 25 de Mayo': ['06:30', '08:02', '09:34', '11:06', '12:38', '14:10', '15:42', '17:14', '18:46', '20:18'],
                'Llegada Terminal': ['06:32', '08:04', '09:36', '11:08', '12:40', '14:12', '15:44', '17:16', '18:48', '20:20']
 
            },
            'sabado': {
                'Salida Terminal': ['05:15','06:47','08:19','09:51','11:23','12:55','14:27','15:59','17:31','19:03'],
                'Chacabuco y Guemes': ['05:30','07:02','08:34','10:06','11:38','13:10','14:42','16:14','17:46','19:18'],
                'Llerena y Sallorenzo': ['05:39','07:11','08:43','10:15','11:47','13:19','14:51','16:23','17:55','19:27'],
                'Balcarce y Ayacucho': ['05:51','07:23','08:55','10:27','11:59','13:31','15:03','16:35','18:07','19:39'],
                'Policlinico': ['06:02','07:34','09:06','10:38','12:10','13:42','15:14','16:46','18:18','19:50'],
                'Potosi y Belgrano': ['06:12','07:44','09:16','10:48','12:20','13:52','15:24','16:56','18:28','20:00'],
                'Lainez y Sallorenzo': ['06:25','07:57','09:29','11:01','12:33','14:05','15:37','17:09','18:41','20:13'],
                '3 de Febrero y 25 de Mayo': ['06:30','08:02','09:34','11:06','12:38','14:10','15:42','17:14','18:46','20:18'],
                'Llegada Terminal': ['06:32','08:04','09:36','11:08','12:40','14:12','15:44','17:16','18:48','20:20']
            },
        }
    }
};

function getCurrentTime() {
    const now = new Date();
    const currentInfo = {
        time: now.toLocaleTimeString('es-AR', { 
            hour: '2-digit', 
            minute: '2-digit'
        }),
        date: now.toLocaleDateString('es-AR', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        }),
        day: now.toLocaleDateString('es-AR', { weekday: 'long' }),
        currentMinutes: now.getHours() * 60 + now.getMinutes()
    };
    console.log('Información de fecha actual:', {
        fechaCompleta: now.toString(),
        diaSemana: currentInfo.day,
        hora: currentInfo.time,
        minutosTotales: currentInfo.currentMinutes
    });
    console.log('Información de fecha actual:', {
        fechaCompleta: now.toString(),
        diaOriginal: currentInfo.day,
        diaNormalizado: currentInfo.day.toLowerCase()
            .replace(/[á]/g, 'a')
            .replace(/[é]/g, 'e')
            .replace(/[í]/g, 'i')
            .replace(/[ó]/g, 'o')
            .replace(/[ú]/g, 'u'),
        diasDisponibles: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']
    });
    return currentInfo;
}

function timeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

function findNextBuses(lineSchedules, stopName, current) {
    // Normalizar nombre de la parada
    let normalizedStopName = stopName;
    
    // Primero reemplazar el carácter ° por º si existe
    normalizedStopName = normalizedStopName.replace('°', 'º');
    
    // Lista de variantes conocidas y sus nombres normalizados
    const stopVariants = {
        'Htal Bº Eva Peron': 'Hospital Bº Eva Peron',
        'Htal B° Eva Peron': 'Hospital Bº Eva Peron',
        'Hospital B° Eva Peron': 'Hospital Bº Eva Peron'
    };
    
    // Intentar encontrar la parada en las variantes conocidas
    if (stopVariants[normalizedStopName]) {
        const originalName = normalizedStopName;
        normalizedStopName = stopVariants[normalizedStopName];
        console.log('Normalizando nombre de parada:', {
            original: originalName,
            normalizado: normalizedStopName
        });
    }
    
    // Si no se encuentra la parada normalizada, intentar con todas las variantes
    if (!lineSchedules[normalizedStopName]) {
        console.log('Buscando horarios en variantes alternativas');
        for (const [variant, normalized] of Object.entries(stopVariants)) {
            if (lineSchedules[variant]) {
                normalizedStopName = variant;
                console.log('Encontrados horarios en variante:', variant);
                break;
            }
            if (lineSchedules[normalized]) {
                normalizedStopName = normalized;
                console.log('Encontrados horarios en nombre normalizado:', normalized);
                break;
            }
        }
    }
    
    console.log('Estado de la búsqueda:', {
        paradaOriginal: stopName,
        paradaNormalizada: normalizedStopName,
        dia: current.day,
        diasDisponibles: Object.keys(lineSchedules),
        tieneParada: Object.values(lineSchedules).some(dia => dia[normalizedStopName]) ? 'Sí' : 'No',
        horariosEncontrados: 'verificar en siguiente paso'
    });
    
    if (!lineSchedules) {
        console.log('ERROR: No hay horarios definidos');
        return null;
    }

    console.log('Datos de horarios:', {
        diasDisponibles: Object.keys(lineSchedules),
        tieneParada: Object.values(lineSchedules).some(dia => dia[normalizedStopName]) ? 'Sí' : 'No',
        horariosParaDia: 'verificar en siguiente paso'
    });
    
    // Usar el nombre normalizado para el resto de la función
    stopName = normalizedStopName;

    // Normalizar el nombre del día para coincidir con las claves
    // Normalizar el nombre del día
    let scheduleType = current.day.toLowerCase()
        .replace(/[á]/g, 'a')
        .replace(/[é]/g, 'e')
        .replace(/[í]/g, 'i')
        .replace(/[ó]/g, 'o')
        .replace(/[ú]/g, 'u');

    // Mapeo de días de la semana
    const dayMappings = {
        'lunes': 'lunes',
        'martes': 'martes',
        'miercoles': 'miercoles',
        'miércoles': 'miercoles',
        'jueves': 'jueves',
        'viernes': 'viernes',
        'sabado': 'sabado',
        'sábado': 'sabado',
        'domingo': 'domingo'
    };

    scheduleType = dayMappings[scheduleType] || scheduleType;

    console.log('Procesamiento del día:', {
        diaOriginal: current.day,
        diaNormalizado: scheduleType,
        diasDisponibles: Object.keys(lineSchedules),
        tieneDia: lineSchedules[scheduleType] ? 'Sí' : 'No',
        paradasEnEseDia: lineSchedules[scheduleType] ? Object.keys(lineSchedules[scheduleType]) : []
    });

    console.log('Procesamiento del día:', {
        diaOriginal: current.day,
        diaNormalizado: scheduleType,
        diasDisponibles: Object.keys(lineSchedules),
        tieneDia: lineSchedules[scheduleType] ? 'Sí' : 'No',
        paradasEnEseDia: lineSchedules[scheduleType] ? Object.keys(lineSchedules[scheduleType]) : []
    });
        
    console.log('Día normalizado:', scheduleType);
    console.log('Parada normalizada:', stopName);
    console.log('Buscando horarios con estructura:', { dia: scheduleType, parada: stopName });
    
    // Buscar el horario para el día actual
    const schedules = lineSchedules[scheduleType]?.[stopName];
    
    if (!schedules || schedules.length === 0) return null;
    
    const upcoming = schedules
        .map(time => ({
            time: time,
            minutes: timeToMinutes(time)
        }))
        .filter(bus => bus.minutes >= current.currentMinutes)
        .sort((a, b) => a.minutes - b.minutes);
    
    if (upcoming.length === 0) {
        const firstTomorrow = schedules
            .map(time => ({
                time: time,
                minutes: timeToMinutes(time)
            }))
            .sort((a, b) => a.minutes - b.minutes)[0];
        
        return {
            next: null,
            upcoming: firstTomorrow ? [`${firstTomorrow.time} (mañana)`] : []
        };
    }
    
    const next = upcoming[0];
    const isNow = (next.minutes - current.currentMinutes) <= 2;
    
    return {
        next: {
            time: next.time,
            isNow: isNow
        },
        upcoming: upcoming.slice(1, 4).map(bus => bus.time)
    };
}

async function updateDisplay() {
    const current = getCurrentTime();
    document.getElementById('currentTime').textContent = current.time;
    document.getElementById('currentDate').textContent = current.date;
    
    // Intentar cargar datos desde Firebase
    const firebaseData = await loadScheduleDataFromFirebase();
    const dataToUse = firebaseData || scheduleData; // Usar datos locales como respaldo
    
    const container = document.getElementById('linesContainer');
    container.innerHTML = '';
    
    Object.entries(scheduleData).forEach(([lineName, lineData]) => {
        const lineCard = document.createElement('div');
        lineCard.className = 'line-card';
        
        const lineClass = lineName.toLowerCase()
            .replace('línea ', 'line-')
            .replace('zona ', 'line-')
            .replace(' ', '');
        
        let stopsHTML = '';
        lineData.stops.forEach(stopName => {
            const nextInfo = findNextBuses(lineData.schedules, stopName, current);
            
            let nextBusHTML = '';
            if (nextInfo && nextInfo.next) {
                const nowIndicator = nextInfo.next.isNow ? '<span class="now-indicator">AHORA</span>' : '';
                nextBusHTML = `<div class="next-bus">Próximo: ${nextInfo.next.time} ${nowIndicator}</div>`;
                if (nextInfo.upcoming.length > 0) {
                    nextBusHTML += `<div class="upcoming">Siguientes: ${nextInfo.upcoming.join(', ')}</div>`;
                }
            } else if (nextInfo && nextInfo.upcoming.length > 0) {
                nextBusHTML = `<div class="upcoming">Mañana: ${nextInfo.upcoming[0]}</div>`;
            } else {
                nextBusHTML = '<div class="no-service">Sin servicio</div>';
            }
            
            stopsHTML += `
                <div class="stop-card">
                    <div class="stop-name">${stopName}</div>
                    ${nextBusHTML}
                </div>
            `;
        });
        
        lineCard.innerHTML = `
            <div class="line-header">
                <span class="line-badge ${lineClass}">${lineName}</span>
                <span>Horarios en tiempo real</span>
            </div>
            <div class="stops-grid">
                ${stopsHTML}
            </div>
        `;
        
        container.appendChild(lineCard);
    });
}

// Variables para guardar estado
let nightModeActive = false;

// Función para alternar modo nocturno
// Función para cambiar entre mapas
function showMap(mapType) {
    const routesMap = document.getElementById('routesMap');
    const chargeMap = document.getElementById('chargeMap');
    const routesButton = document.querySelector('.map-button:first-child');
    const chargeButton = document.querySelector('.map-button:last-child');

    if (mapType === 'routes') {
        routesMap.style.display = 'block';
        chargeMap.style.display = 'none';
        routesButton.classList.add('active');
        chargeButton.classList.remove('active');
    } else {
        routesMap.style.display = 'none';
        chargeMap.style.display = 'block';
        routesButton.classList.remove('active');
        chargeButton.classList.add('active');
    }
}

function toggleNightMode() {
    const body = document.body;
    const button = document.getElementById('nightModeToggle');
    
    body.classList.toggle('dark-mode');
    nightModeActive = !nightModeActive;
    
    if (body.classList.contains('dark-mode')) {
        button.textContent = '☀️';
        button.title = 'Modo Día';
    } else {
        button.textContent = '🌙';
        button.title = 'Modo Nocturno';
    }
}



// Detectar si es móvil
function isMobile() {
    return window.innerWidth <= 768;
}

// Inicialización
async function init() {
    await updateDisplay();
    // Forzar siempre la vista compacta
    document.body.classList.add('compact-view');
    // Actualizar cada 1 segundo
    setInterval(updateDisplay, 1000);
    
    // Escuchar cambios en tiempo real de Firebase
    const linesCollection = collection(window.db, 'lines');
    onSnapshot(linesCollection, (snapshot) => {
        updateDisplay(); // Actualizar cuando hay cambios en Firebase
    });
    // Agregar event listeners para interactividad táctil
    document.addEventListener('touchstart', function(e) {
        if (e.target.classList.contains('stop-card')) {
            e.target.style.transform = 'translateY(-2px)';
        }
    });
    document.addEventListener('touchend', function(e) {
        if (e.target.classList.contains('stop-card')) {
            setTimeout(() => {
                e.target.style.transform = '';
            }, 150);
        }
    });
}

// Inicializar la aplicación
init();
