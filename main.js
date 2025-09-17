// Datos de horarios organizados por línea
const scheduleData = {
    'Línea A': {
        stops: [
            'Salida Facultad', 'Terminal', 'Balcarce y Urquiza', 'L.Guillen y G.Paz', 
            'Entrada Ate II', 'Salida F.Sarmiento', 'Nelson e Yrigoyen', 'G.Paz y Maipu', 
            'Llegada Facultad'
        ],
        schedules: {
            'lunes': {
                'Salida Facultad': ['05:18', '06:09', '06:26', '07:00', '07:17', '07:34', '07:51', '08:08', '08:25', '08:42', '08:59', '09:16', '09:33', '09:50', '10:07', '10:24', '10:41', '10:58', '11:15', '11:32', '11:49', '12:06', '12:23', '12:40', '12:57', '13:14', '13:31', '14:05', '14:22'],
                'Terminal': ['05:30', '06:21', '06:38', '07:12', '07:29', '07:46', '08:03', '08:20', '08:37', '08:54', '09:11', '09:28', '09:45', '10:02', '10:19', '10:36', '10:53', '11:10', '11:27', '11:44', '12:01', '12:18', '12:35', '12:52', '13:09', '13:26', '13:43', '14:17', '14:34'],
                'Balcarce y Urquiza': ['05:44', '06:35', '06:52', '07:26', '07:43', '08:00', '08:17', '08:34', '08:51', '09:08', '09:25', '09:42', '09:59', '10:16', '10:33', '10:50', '11:07', '11:24', '11:41', '11:58', '12:15', '12:32', '12:49', '13:06', '13:23', '13:40', '13:57', '14:31', '14:48']
            }
        }
    },
    'Línea E': {
        stops: [
            'M.Ernst y Cazoria', 'Hospital La Ribera', 'Escuela Agraria', 'Ayacucho y Balcarce', 
            'Policlinico', 'Llegada Terminal', 'Salida Terminal', 'Hospital de la Villa', 
            'Balcarce y Robamba', 'Entrada Bº La Ribera'
        ],
        schedules: {
            'lunes': {
                'M.Ernst y Cazoria': ['05:54', '06:09', '06:24', '06:54', '07:09', '07:24', '07:54', '08:09', '08:24', '08:39', '08:54', '09:09', '09:24', '09:39', '09:54', '10:09', '10:24', '10:39', '10:54', '11:09', '11:24', '11:39', '11:54', '12:09', '12:24', '12:39', '12:54', '13:09', '13:24', '13:39', '13:54', '14:09'],
                'Hospital La Ribera': ['06:06', '06:21', '06:36', '07:06', '07:21', '07:36', '08:06', '08:21', '08:36', '08:51', '09:06', '09:21', '09:36', '09:51', '10:06', '10:21', '10:36', '10:51', '11:06', '11:21', '11:36', '11:51', '12:06', '12:21', '12:36', '12:51', '13:06', '13:21', '13:36', '13:51', '14:06', '14:21']
            }
        }
    },
    'Zona Este': {
        stops: [
            'Pellegrini y Huelson', 'Maipu y Avila', 'Tucuman y Tallaferro', 'Policlinico', 
            'Llegada Terminal', 'Salida Terminal', 'Balcarce y Maipu', 'E.Aguero y L.Guillen', 
            'Gauna y Maipu', 'Htal Bº Eva Peron'
        ],
        schedules: {
            'lunes': {
                'Pellegrini y Huelson': ['05:17', '06:30', '07:14', '07:53', '08:32', '09:11', '09:50', '10:29', '11:08', '11:47', '12:26', '13:05', '13:44', '14:23', '15:02', '15:41', '16:20', '16:59', '17:38', '18:17', '18:56', '19:35', '20:14', '21:31'],
                'Maipu y Avila': ['05:32', '06:44', '07:29', '08:08', '08:47', '09:26', '10:05', '10:44', '11:23', '12:02', '12:41', '13:20', '13:59', '14:38', '15:17', '15:56', '16:35', '17:14', '17:53', '18:32', '19:11', '19:50', '20:29', '21:46']
            }
        }
    },
    'Zona Oeste': {
        stops: [
            'Salida Terminal', 'Chacabuco y Guemes', 'Llerena y Sallorenzo', 'Balcarce y Ayacucho', 
            'Policlinico', 'Potosi y Belgrano', 'Lainez y Sallorenzo', '3 de Febrero y 25 de Mayo', 
            'Llegada Terminal'
        ],
        schedules: {
            'lunes': {
                'Salida Terminal': ['05:15', '06:47', '08:19', '09:51', '11:23', '12:55', '14:27', '15:59', '17:31', '19:03'],
                'Chacabuco y Guemes': ['05:30', '07:02', '08:34', '10:06', '11:38', '13:10', '14:42', '16:14', '17:46', '19:18'],
                'Llerena y Sallorenzo': ['05:39', '07:11', '08:43', '10:15', '11:47', '13:19', '14:51', '16:23', '17:55', '19:27']
            }
        }
    }
};

function getCurrentTime() {
    const now = new Date();
    return {
        time: now.toLocaleTimeString('es-AR', { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit' 
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
}

function timeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

function findNextBuses(schedules, currentMinutes) {
    if (!schedules || schedules.length === 0) return null;
    
    const upcoming = schedules
        .map(time => ({
            time: time,
            minutes: timeToMinutes(time)
        }))
        .filter(bus => bus.minutes >= currentMinutes)
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
    const isNow = (next.minutes - currentMinutes) <= 2;
    
    return {
        next: {
            time: next.time,
            isNow: isNow
        },
        upcoming: upcoming.slice(1, 4).map(bus => bus.time)
    };
}

function updateDisplay() {
    const current = getCurrentTime();
    document.getElementById('currentTime').textContent = current.time;
    document.getElementById('currentDate').textContent = current.date;
    
    const container = document.getElementById('linesContainer');
    container.innerHTML = '';
    
    Object.entries(scheduleData).forEach(([lineName, lineData]) => {
        const lineCard = document.createElement('div');
        lineCard.className = 'line-card';
        
        const lineClass = lineName.toLowerCase().replace('línea ', 'line-').replace(' ', '-');
        
        let stopsHTML = '';
        lineData.stops.forEach(stopName => {
            const schedules = lineData.schedules['lunes'] ? lineData.schedules['lunes'][stopName] : [];
            const nextInfo = findNextBuses(schedules, current.currentMinutes);
            
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

// Función para alternar vista compacta en móviles
function toggleCompactView() {
    const body = document.body;
    const button = document.getElementById('viewToggle');
    
    body.classList.toggle('compact-view');
    
    if (body.classList.contains('compact-view')) {
        button.textContent = 'Vista Normal';
    } else {
        button.textContent = 'Vista Compacta';
    }
}

// Detectar si es móvil
function isMobile() {
    return window.innerWidth <= 768;
}

// Inicialización
function init() {
    updateDisplay();
    
    // Activar vista compacta en móviles por defecto
    if (isMobile()) {
        document.body.classList.add('compact-view');
        document.getElementById('viewToggle').textContent = 'Vista Normal';
    }
    
    // Actualizar cada 30 segundos
    setInterval(updateDisplay, 30000);
    
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
