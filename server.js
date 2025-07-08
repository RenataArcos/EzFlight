const express = require('express');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const cors = require('cors');
const neo4j = require('neo4j-driver');

const app = express();
app.use(cors());
app.use(express.json());
const path = require('path')
app.use('/', express.static(path.join(__dirname, 'public')))

// Configuración del driver de Neo4j
const driver = neo4j.driver(
    'bolt://localhost:7687',
    neo4j.auth.basic('neo4j', 'neo4jpassword') // usuario y contraseña del contenedor
);

app.post('/api/flights', async (req, res) => {
    const { from, to, dateDep, dateArr, directOnly } = req.body;

    const apiKey = 'a95ea589b8dc8c8729027d49f12957d372069eff7e75b5d175d27c615c9e62b6';
    const allFlightData = [];

    // Limpia la base
    await resetNeo4j();

    // Consulta de origen → cada destino
    for (const destino of to) {
        console.log(`Consultando vuelos desde ${from} a ${destino.IATA}`);
        const url = buildSerpApiURL(from, destino.IATA, dateDep, dateArr, directOnly, apiKey);
        const vuelos = await getFlightsFromSerpAPI(url);
        allFlightData.push(...vuelos);
    }

    // Consulta entre todos los destinos entre sí
    for (let i = 0; i < to.length; i++) {
        for (let j = i + 1; j < to.length; j++) {
            const origen = to[i]?.IATA;
            const destino = to[j].IATA;
            const url1 = buildSerpApiURL(origen, destino, dateDep, dateArr, directOnly, apiKey);
            const vuelos1 = await getFlightsFromSerpAPI(url1);
            allFlightData.push(...vuelos1);

            const url2 = buildSerpApiURL(destino, origen, dateDep, dateArr, directOnly, apiKey);
            const vuelos2 = await getFlightsFromSerpAPI(url2);
            allFlightData.push(...vuelos2);
        }
    }

    // Insertar vuelos en Neo4j
    for (const flight of allFlightData) {
        await insertFlightToNeo4j(flight);
    }

    res.json({ message: "Vuelos insertados correctamente", flights: allFlightData });
});

async function insertFlightToNeo4j(flight) {
    const session = driver.session();
    try {
        const airline = flight.flights[0].airline;
        const duration = flight.total_duration;
        const price = flight.price;
        const departure = flight.flights[0].departure_airport.time;
        const arrival = flight.flights[flight.flights.length - 1].arrival_airport.time;

        // Extraer secuencia de aeropuertos del vuelo
        const airports = [flight.flights[0].departure_airport.id];
        const lastAirport = flight.flights[flight.flights.length - 1].arrival_airport.id;
        airports.push(lastAirport);

        await session.run(
            `
            UNWIND $airports AS airportId
            MERGE (:Airport {id: airportId})

            WITH $airports AS ap
            UNWIND range(0, size(ap)-2) AS idx
            WITH ap[idx] AS fromId, ap[idx+1] AS toId

            MERGE (from:Airport {id: fromId})
            MERGE (to:Airport {id: toId})
            MERGE (from)-[f:FLIGHT {
                airline: $airline,
                duration: $duration,
                price: $price,
                departure: $departure,
                arrival: $arrival
            }]->(to)
            `,
            {
                airports,
                airline,
                duration: neo4j.int(duration),
                price: parseFloat(price),
                departure,
                arrival
            }
        );

        console.log("✈️ Vuelo insertado:", airports.join(" → "));
    } catch (err) {
        console.error("❌ Error al insertar en Neo4j:", err);
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

function buildSerpApiURL(from, to, dateDep, dateArr, directOnly, apiKey) {
    let url = `https://serpapi.com/search?engine=google_flights&departure_id=${from}&arrival_id=${to}&outbound_date=${dateDep}&return_date=${dateArr}&api_key=${apiKey}`;
    if (directOnly) {
        url += `&stops=1`;
    }
    console.log(url);
    return url;
}

async function getFlightsFromSerpAPI(url) {
    try {
        const response = await fetch(url);
        const data = await response.json();

        const allFlights = [
            ...(data.best_flights || []),
            ...(data.other_flights || [])
        ];

        return allFlights;
    } catch (error) {
        console.error("Error en SerpAPI:", error);
        return [];
    }
}

app.post('/api/tsp', async (req, res) => {
    const { from, destinations } = req.body;
    const session = driver.session();
    try {
        const allAirports = [from, ...destinations.map(d => d.IATA)];

        // 1. Crear grafo proyectado en memoria
        await session.run(`
            CALL gds.graph.project(
                'tspGraph',
                'Airport',
                {
                    FLIGHT: {
                        type: 'FLIGHT',
                        properties: ['price']
                    }
                }
            )
        `);

        // 2. Ejecutar allShortestPaths
        const result = await session.run(
            `
            UNWIND $airports AS sourceId
            UNWIND $airports AS targetId
            WITH sourceId, targetId WHERE sourceId <> targetId
            MATCH (source:Airport {id: sourceId}), (target:Airport {id: targetId})
            CALL gds.shortestPath.dijkstra.stream('tspGraph', {
                sourceNode: source,
                targetNode: target,
                relationshipWeightProperty: 'price'
            })
            YIELD totalCost
            RETURN sourceId AS from, targetId AS to, totalCost
            `,
            { airports: allAirports }
        );


        const distances = {};
        for (const record of result.records) {
            const fromId = record.get('from');
            const toId = record.get('to');
            const cost = record.get('totalCost');

            if (!distances[fromId]) distances[fromId] = {};
            distances[fromId][toId] = cost;
        }

        // 3. Resolver el TSP (brute force para pocas ciudades)
        const permute = (arr) => {
            if (arr.length <= 1) return [arr];
            let res = [];
            for (let i = 0; i < arr.length; i++) {
                const current = arr[i];
                const rest = arr.slice(0, i).concat(arr.slice(i + 1));
                const restPermuted = permute(rest);
                for (const p of restPermuted) {
                    res.push([current, ...p]);
                }
            }
            return res;
        };

        const destinationIds = destinations.map(d => d.IATA);
        const permutations = permute(destinationIds);

        let bestPath = null;
        let bestCost = Infinity;

        for (const path of permutations) {
            let cost = 0;
            let valid = true;
            let current = from;

            for (const next of path) {
                if (!distances[current] || distances[current][next] == null) {
                    valid = false;
                    break;
                }
                cost += distances[current][next];
                current = next;
            }
            console.log(`Ruta evaluada: ${[from, ...path].join(' → ')} | Costo: ${cost}`);

            if (valid && cost < bestCost) {
                bestCost = cost;
                bestPath = [from, ...path];
            }
        }

        if (!bestPath) {
            return res.status(404).json({ error: "No se encontró una ruta válida." });
        }

        res.json({ bestPath, totalCost: bestCost });
    } catch (error) {
        console.error("❌ Error en TSP:", error);
        res.status(500).json({ error: "Error interno al calcular ruta óptima." });
    } finally {
        try {
            await session.run(`CALL gds.graph.drop('tspGraph')`);
        } catch (e) {
            console.warn("⚠️ No se pudo eliminar grafo:", e.message);
        }
        await session.close();
    }
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
