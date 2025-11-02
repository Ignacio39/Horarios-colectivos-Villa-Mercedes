import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyBBxBVkQ0M1uj8l90p0o3si4ixDGcBQz7g",
    authDomain: "horarios-villa-mercedes.firebaseapp.com",
    projectId: "horarios-villa-mercedes",
    storageBucket: "horarios-villa-mercedes.firebasestorage.app",
    messagingSenderId: "403738748045",
    appId: "1:403738748045:web:c154d89e59e5e4b96deec4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Importar datos del archivo main.js
import { scheduleData } from './data.js';

async function migrateToFirebase() {
    try {
        // Primero, limpiar colecciones existentes
        const linesToDelete = await getDocs(collection(db, 'lines'));
        for (const doc of linesToDelete.docs) {
            await deleteDoc(doc.ref);
        }

        // Migrar cada línea
        for (const [lineName, lineData] of Object.entries(scheduleData)) {
            const lineId = lineName
                .toLowerCase()
                .replace('línea ', 'linea-')
                .replace('zona ', 'zona-')
                .replace(' ', '-')
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, ""); // Remover acentos

            const lineDoc = {
                id: lineId,
                name: lineName,
                stops: lineData.stops,
                schedules: lineData.schedules,
                metadata: {
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    active: true
                }
            };

            // Guardar la línea en Firebase
            await setDoc(doc(db, 'lines', lineId), lineDoc);
            console.log(`✅ Migrada línea: ${lineName}`);

            // Crear documentos para cada parada
            for (const stopName of lineData.stops) {
                const stopId = stopName
                    .toLowerCase()
                    .replace(/ /g, '-')
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "");

                const stopDoc = {
                    id: stopId,
                    name: stopName,
                    lines: [lineId],
                    schedules: {},
                    metadata: {
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        active: true
                    }
                };

                // Agregar horarios específicos para esta parada
                for (const [day, daySchedules] of Object.entries(lineData.schedules)) {
                    if (daySchedules[stopName]) {
                        stopDoc.schedules[day] = daySchedules[stopName];
                    }
                }

                // Guardar la parada en Firebase
                await setDoc(doc(db, 'stops', stopId), stopDoc);
                console.log(`  📍 Migrada parada: ${stopName}`);
            }
        }

        console.log('🎉 Migración completada exitosamente!');
    } catch (error) {
        console.error('❌ Error durante la migración:', error);
    }
}

// Ejecutar la migración
migrateToFirebase();