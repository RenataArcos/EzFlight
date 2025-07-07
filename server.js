const express = require('express');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const cors = require('cors');
const neo4j = require('neo4j-driver');

const app = express();
app.use(cors());
app.use(express.json());

// Configuración del driver de Neo4j
const driver = neo4j.driver(
    'bolt://localhost:7687',
    neo4j.auth.basic('neo4j', 'neo4jpassword') // usuario y contraseña del contenedor
);

const session = driver.session();


async function insertFlightToNeo4j(flight) {

    const airline = flight.flights[0].airline;
    const duration = flight.total_duration;
    const price = flight.price;
    const departure = flight.flights[0].departure_airport.time;
    const arrival = flight.flights[flight.flights.length - 1].arrival_airport.time;
    const airports = [];
    airports.push(
        flight.flights[0].departure_airport.name
    );
    airports.push(
        flight.flights[0].arrival_airport.name
    );
    for (let i = 1; i <= flight.flights.length - 1; i++) {
        airports.push(
            flight.flights[i].arrival_airport.name
        );
    }
    console.log(airports);
    try {
        const session = driver.session();

        await session.run(

            // 1) crear (o reutilizar) cada aeropuerto
            `UNWIND $airports AS airportName
          MERGE (:Airport {name: airportName})
    
          // 2) recorrer pares consecutivos para las relaciones
          WITH $airports AS ap
          UNWIND range(0, size(ap)-2) AS idx
          WITH ap[idx] AS fromName, ap[idx+1] AS toName
    
          MERGE (from:Airport {name: fromName})
          MERGE (to  :Airport {name: toName})
          MERGE (from)-[f:FLIGHT {
            airline  : $airline,
            duration : $duration,
            price    : $price,
            departure: $departure,
            arrival  : $arrival
          }]->(to)`
            ,
            {
                airports,
                airline,
                duration: neo4j.int(duration),
                price,
                departure,
                arrival
            }
        );

        console.log('Vuelo insertado correctamente en Neo4j');
    } catch (err) {
        console.error('Error al insertar en Neo4j:', err);
    } finally {
        await session.close();
    }
}

async function resetNeo4j() {
    const session = driver.session();
    try {
        await session.run('MATCH (n) DETACH DELETE n');
        console.log('Base limpiada');
    } finally {
        await session.close();
    }
}


app.post('/api/flights', async (req, res) => {
    const { from, to, dateDep, dateArr, directOnly } = req.body;
    console.log("Datos recibidos del frontend:", { from, to, dateDep, dateArr });

    const apiKey = process.env.SERPAPI_API_KEY;
    let url = `https://serpapi.com/search?engine=google_flights&departure_id=${from}&arrival_id=${to}&outbound_date=${dateDep}&return_date=${dateArr}&api_key=${apiKey}`;

    if (directOnly) {
        url += `&stops=1`; // Agrega el filtro para solo vuelos directos
    }

    console.log("URL consultada:", url);

    try {
        const response = await fetch(url);
        const data = await response.json();

        console.log("Datos recibidos de SerpAPI:", data);

        if (!response.ok) {
            console.error("Respuesta con error de SerpAPI:", data);
            return res.status(500).json({ error: 'Error desde SerpAPI', details: data });
        }

        const allFlights = [
            ...(data.best_flights || []),
            ...(data.other_flights || [])
        ];

        if (allFlights.length === 0) {
            return res.status(404).json({ error: 'No se encontraron vuelos para esta búsqueda.' });
        }

        await resetNeo4j();

        for (const flight of allFlights) {
            console.log("Vuelo encontrado:", flight);
            await insertFlightToNeo4j(flight);
        }

        res.json({ flights: allFlights });
    } catch (err) {
        console.error("Error en el servidor:", err);
        res.status(500).json({ error: 'Error al consultar SerpAPI', details: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
