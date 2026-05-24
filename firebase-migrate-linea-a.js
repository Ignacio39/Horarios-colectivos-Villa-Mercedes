// Script de migración de datos Línea A a Firebase
// Ejecutar con: node firebase-migrate-linea-a.js

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-app.js';
import { getFirestore, collection, doc, setDoc, writeBatch } from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js';
import { scheduleData } from './data.js';

// Configuración de Firebase (del index.html)
const firebaseConfig = {
    apiKey: "AIzaSyD5aW46Rh_5h8KL9Qk3pL7mN2oP8rS9tU0",
    authDomain: "horarios-colectivos-vm.firebaseapp.com",
    projectId: "horarios-colectivos-vm",
    storageBucket: "horarios-colectivos-vm.appspot.com",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abcdef1234567890"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function migrateLineaA() {
    try {
        console.log('🚀 Iniciando migración de Línea A a Firebase...');
        
        const lineaAData = scheduleData['Línea A'];
        const batch = writeBatch(db);
        
        // Actualizar documento de Línea A en colección 'lines'
        const lineaDocRef = doc(db, 'lines', 'Línea A');
        batch.set(lineaDocRef, {
            name: 'Línea A',
            color: '#FF6B6B',
            active: true,
            lastUpdated: new Date(),
            schedules: lineaAData.schedules,
            stops: lineaAData.stops
        }, { merge: true });
        
        // Actualizar documentos de paradas en colección 'stops'
        lineaAData.stops.forEach(stopName => {
            const stopDocRef = doc(db, 'stops', `Línea A - ${stopName}`);
            batch.set(stopDocRef, {
                name: stopName,
                line: 'Línea A',
                schedules: lineaAData.schedules,
                lastUpdated: new Date()
            }, { merge: true });
        });
        
        // Ejecutar batch
        await batch.commit();
        console.log('✅ Migración completada exitosamente');
        console.log(`📋 Actualizados: 1 documento de línea + ${lineaAData.stops.length} documentos de paradas`);
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error en migración:', error);
        process.exit(1);
    }
}

migrateLineaA();
