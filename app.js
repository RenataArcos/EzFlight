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

    if (!to.length) {
        alert("Selecciona al menos un destino");
        return;
    }

    try {
        const response = await fetch('http://localhost:3000/api/flights', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ from, to, dateDep, dateArr, directOnly })
        });

        const data = await response.json();
        console.log(data);
    } catch (error) {
        document.getElementById('results').innerHTML = '<p class="text-danger text-center">Error al buscar vuelos.</p>';
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

document.getElementById('selectHasta').addEventListener('change', function () {
    const selectedId = this.value;
    const selectedText = this.options[this.selectedIndex].textContent;

    if (!destinosSeleccionados.has(selectedId)) {
        destinosSeleccionados.add(selectedId);
        mostrarDestinoSeleccionado(selectedId, selectedText);
        deshabilitarOpcion(selectedId);
        this.selectedIndex = 0;
    }
});

function mostrarDestinoSeleccionado(id, nombre) {
    const contenedor = document.getElementById('destinosSeleccionados');

    const badge = document.createElement('div');
    badge.className = 'destino-badge';
    badge.dataset.id = id;
    badge.innerHTML = `
        ${nombre}
        <button type="button" class="btn-close" aria-label="Eliminar"></button>
    `;

    // Evento para eliminar la selección
    badge.querySelector('.btn-close').addEventListener('click', () => {
        destinosSeleccionados.delete(id);
        badge.remove();
        habilitarOpcion(id);
    });

    contenedor.appendChild(badge);
}

function deshabilitarOpcion(id) {
    const select = document.getElementById('selectHasta');
    const option = Array.from(select.options).find(opt => opt.value === id);
    if (option) option.disabled = true;
}

function habilitarOpcion(id) {
    const select = document.getElementById('selectHasta');
    const option = Array.from(select.options).find(opt => opt.value === id);
    if (option) option.disabled = false;
}
