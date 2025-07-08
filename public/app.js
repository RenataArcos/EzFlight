const aeropuertos = [
    { nombre: "Santiago - Arturo Merino Benitez", id: "SCL" },
    { nombre: "Londres - Heathrow", id: "LHR" },
    { nombre: "París - Charles de Gaulle", id: "CDG" },
    { nombre: "Fráncfort - Frankfurt am Main", id: "FRA" },
    { nombre: "Ámsterdam - Schiphol", id: "AMS" },
    { nombre: "Madrid - Adolfo Suárez Madrid-Barajas", id: "MAD" },
    { nombre: "Roma - Fiumicino", id: "FCO" },
    { nombre: "Estambul - Istanbul Airport", id: "IST" },
    { nombre: "Barcelona - El Prat", id: "BCN" },
    { nombre: "Múnich - Franz Josef Strauss", id: "MUC" },
    { nombre: "Zúrich - Zürich Airport", id: "ZRH" },
    { nombre: "Bruselas - Brussels Airport", id: "BRU" },
    { nombre: "Copenhague - Kastrup", id: "CPH" },
    { nombre: "Lisboa - Humberto Delgado", id: "LIS" },
    { nombre: "Viena - Schwechat", id: "VIE" },
    { nombre: "Oslo - Gardermoen", id: "OSL" }
];

document.getElementById('flightForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const from = document.getElementById('selectDesde').value;
    const dateDep = document.getElementById('dateDep').value;
    const dateArr = document.getElementById('dateArr').value;
    const directOnly = document.getElementById('flexSwitchCheckDefault').checked;
    const to = Array.from(destinosSeleccionados);

    const resultDiv = document.getElementById('results');
    resultDiv.innerHTML = ""; // Limpia resultados anteriores

    if (!to.length) {
        alert("Selecciona al menos un destino");
        return;
    }

    try {
        // Paso 1: Insertar vuelos
        const response = await fetch('http://localhost:3000/api/flights', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ from, to, dateDep, dateArr, directOnly })
        });

        const data = await response.json();
        console.log(data);

        const tspResponse = await fetch('http://localhost:3000/api/tsp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ from, destinations: to })
        });

        const tspData = await tspResponse.json();
        console.log("TSP Result:", tspData);

        const resultDiv = document.getElementById('results');
        if (tspData.bestPath) {
            resultDiv.appendChild(renderTspResult(tspData));
        } else {
            resultDiv.innerHTML += `<p class="text-danger">No se pudo calcular una ruta completa óptima.</p>;`
        }

    } catch (error) {
        resultDiv.innerHTML = '<p class="text-danger text-center">Error al buscar vuelos.</p>';
        console.error(error);
    }
});



function poblarSelectAeropuertos(lista, selectId) {
    const select = document.getElementById(selectId);
    lista.forEach(aeropuerto => {
        const option = document.createElement('option');
        option.value = aeropuerto.id;
        option.textContent = aeropuerto.nombre;
        select.appendChild(option);
    });
}

poblarSelectAeropuertos(aeropuertos, 'selectDesde');
poblarSelectAeropuertos(aeropuertos, 'selectHasta');

const destinosSeleccionados = new Set();

const selectHasta = document.getElementById('selectHasta');
const selectDesde = document.getElementById('selectDesde');
let tempId = "";

selectDesde.addEventListener('change', function () {
    const selectedId = this.value;
    if (tempId !== "") {
        // Rehabilitar la opción previamente seleccionada
        const optionToRehabilitate = Array.from(selectHasta.options).find(opt => opt.value === tempId);
        if (optionToRehabilitate) {
            optionToRehabilitate.disabled = false;
        }
    }
    const optionToDisable = Array.from(selectHasta.options).find(opt => opt.value === selectedId);
    if (optionToDisable) {
        optionToDisable.disabled = !destinosSeleccionados.has(selectedId);
    }
    tempId = selectedId; // Guardar el ID temporalmente
});

const chipsContainer = document.getElementById('chipsContainer');

selectHasta.addEventListener('change', function () {
    const selectedId = this.value;
    const selectedOption = this.options[this.selectedIndex];
    const selectedName = selectedOption.text;

    // Verifica si ya está en la lista
    if (!selectedId || Array.from(destinosSeleccionados).some(d => d.IATA === selectedId)) return;

    // Agrega el aeropuerto a la lista como objeto
    destinosSeleccionados.add({ IATA: selectedId, nombre: selectedName });

    // Deshabilita en ambos selects
    selectedOption.disabled = true;

    const optionDesde = selectDesde.querySelector(`option[value="${selectedId}"]`);
    if (optionDesde) optionDesde.disabled = true;

    // Crea y muestra el chip
    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.setAttribute('data-id', selectedId);
    chip.innerHTML = `
        ${selectedName}
        <span class="remove-btn">&times;</span>
    `;
    chipsContainer.appendChild(chip);

    // Evento para quitar el chip
    chip.querySelector('.remove-btn').addEventListener('click', () => {
        chip.remove();

        // Quitar del Set usando reemplazo manual del objeto
        destinosSeleccionados.forEach(item => {
            if (item.IATA === selectedId) destinosSeleccionados.delete(item);
        });

        // Rehabilitar en los selects
        selectedOption.disabled = false;
        if (optionDesde) optionDesde.disabled = false;
        console.log("Destinos seleccionados:", Array.from(destinosSeleccionados));
    });

    // Resetear selección al placeholder
    this.value = "";

    // Para debug: mostrar todos los objetos correctamente
    console.log("Destinos seleccionados:", Array.from(destinosSeleccionados));
});

function renderTspResult({ bestPath, totalCost }) {
    // card contenedor
    const card = document.createElement('div');
    card.className = 'card shadow-sm p-4 mt-4 fade-in';

    // título
    card.innerHTML = `
      <h4 class="fw-bold text-center text-primary mb-3">
        Ruta óptima
      </h4>
    `;

    // timeline
    const timeline = document.createElement('div');
    timeline.className = 'result-timeline justify-content-center';
    bestPath.forEach((code, idx) => {
        // nodo (aeropuerto)
        const badge = document.createElement('span');
        badge.className = 'badge rounded-pill';
        badge.textContent = code;
        timeline.appendChild(badge);

        // flecha entre nodos
        if (idx < bestPath.length - 1) {
            const arrow = document.createElement('i');
            arrow.className = 'fa-solid fa-arrow-right-long';
            timeline.appendChild(arrow);
        }
    });
    card.appendChild(timeline);

    // costo total
    const cost = document.createElement('p');
    cost.className = 'fs-5 fw-medium text-center mt-3 mb-0';
    cost.innerHTML = `<strong>Costo total:</strong> $${totalCost.toLocaleString('es-CL')}`;
    card.appendChild(cost);

    return card;      // devuelve el nodo listo para insertar
}