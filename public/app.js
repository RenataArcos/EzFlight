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

selectHasta.addEventListener('change', function () {
    const selectedId = this.value;
    const selectedName = this.options[this.selectedIndex].text;
    if (!selectedId || destinosSeleccionados.has(selectedId)) return;

    destinosSeleccionados.add({ IATA: selectedId, nombre: selectedName });

    // Deshabilitar la opción seleccionada
    const optionToDisable = Array.from(this.options).find(opt => opt.value === selectedId);
    if (optionToDisable) {
        optionToDisable.disabled = true;
    }

    const optionToDisableDesde = Array.from(selectDesde.options).find(opt => opt.value === selectedId);
    if (optionToDisableDesde) {
        optionToDisableDesde.disabled = true;
    }
    // Volver a mostrar la opción placeholder
    console.log("Destinos seleccionados:", Array.from(destinosSeleccionados));
});

const chipsContainer = document.getElementById('chipsContainer');

selectHasta.addEventListener('change', function () {
    const selectedId = this.value;
    if (!selectedId || destinosSeleccionados.has(selectedId)) return;

    destinosSeleccionados.add(selectedId);

    // Deshabilitar la opción en el select
    const optionToDisable = this.querySelector(`option[value="${selectedId}"]`);
    if (optionToDisable) {
        optionToDisable.disabled = true;
    }

    const optionToDisableDesde = selectDesde.querySelector(`option[value="${selectedId}"]`);
    if (optionToDisableDesde) {
        optionToDisableDesde.disabled = true;
    }
    // Mostrar chip
    const aeropuerto = aeropuertos.find(a => a.id === selectedId);
    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.setAttribute('data-id', selectedId);
    chip.innerHTML = `
        ${aeropuerto.nombre}
        <span class="remove-btn">&times;</span>
    `;
    chipsContainer.appendChild(chip);

    // Evento para eliminar chip
    chip.querySelector('.remove-btn').addEventListener('click', () => {
        chip.remove();
        destinosSeleccionados.delete(selectedId);

        // Rehabilitar opción en el select
        if (optionToDisable) {
            optionToDisable.disabled = false;
            optionToDisableDesde.disabled = false;
        }
    });

    // Resetear el select al placeholder
    this.value = "";
});
