// Supabase init
const supabaseUrl = 'https://tdvdhqhvzwqyvezunwwh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

document.addEventListener("DOMContentLoaded", async () => {
  const tabla = document.getElementById("tabla-jugadores");

  async function cargarJugadores() {
    const { data, error } = await supabase.from("Base").select("*");
    if (error) {
      console.error("Error al cargar datos:", error.message);
      return;
    }

    tabla.innerHTML = "";
    data.forEach(j => {
      const fila = document.createElement("tr");
      fila.innerHTML = `
        <td>${j.nombre}</td>
        <td>${j.tiempo_jugado}</td>
        <td>${j.decisiones_acosador}</td>
        <td>${j.decisiones_victima}</td>
        <td>${j.decisiones_observador_pasivo}</td>
        <td>${j.decisiones_observador_activo}</td>
        <td>${j.final_obtenido || ''}</td>
        <td>${j.tiempo_decision}</td>
        <td>${j.decisiones || ''}</td>
        <td><button class="btn btn-danger btn-sm" onclick="eliminarJugador(${j.id})">Eliminar</button></td>
      `;
      tabla.appendChild(fila);
    });
  }

  async function eliminarJugador(id) {
    const { error } = await supabase.from("Base").delete().eq("id", id);
    if (error) {
      console.error("Error al eliminar:", error.message);
      return;
    }
    cargarJugadores();
  }
  window.eliminarJugador = eliminarJugador;

  cargarJugadores();

  supabase
    .channel("jugadores-stream")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "Base" },
      (payload) => {
        console.log("Nuevo jugador detectado:", payload.new);
        cargarJugadores();
      }
    )
    .subscribe();
});

// ✅ Función para exportar CSV
async function exportarCSV() {
  const { data, error } = await supabase.from("Base").select("*");
  if (error) {
    console.error("Error al exportar:", error.message);
    return;
  }

  if (!data || data.length === 0) {
    alert("No hay datos para exportar.");
    return;
  }

  const encabezados = Object.keys(data[0]).join(",");
  const filas = data.map(fila =>
    Object.values(fila).map(valor => `"${valor}"`).join(",")
  ).join("\n");

  const csv = [encabezados, filas].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", "jugadores_supabase.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
window.exportarCSV = exportarCSV;

// ✅ Función para mostrar el análisis
async function mostrarAnalisis() {
  try {
    const respuesta = await fetch('/api/analizar');
    const texto = await respuesta.text();
    document.getElementById('resultadoAnalisis').textContent = texto;
  } catch (err) {
    document.getElementById('resultadoAnalisis').textContent = "Error al cargar el análisis.";
    console.error(err);
  }
}
window.mostrarAnalisis = mostrarAnalisis;
