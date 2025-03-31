// Asegúrate de que este archivo se cargue después del script de Supabase en tu HTML

document.addEventListener("DOMContentLoaded", async () => {
  const supabaseUrl = 'https://tdvdhqhvzwqyvezunwwh.supabase.co';
  const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRkdmRocWh2endxeXZlenVud3doIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMxMjg0MTksImV4cCI6MjA1ODcwNDQxOX0.pZ1GzHfUjZ1i1LI5bLZhAa_rtQk82O-9xkRKbQeQkfc';
  const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

  const tabla = document.getElementById("tabla-jugadores");

  // Mostrar todos los jugadores
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
        <td>${j.tiempo_mouse}</td>
        <td><button class="btn btn-danger btn-sm" onclick="eliminarJugador(${j.id})">Eliminar</button></td>
      `;
      tabla.appendChild(fila);
    });
  }

  // Eliminar jugador por ID
  async function eliminarJugador(id) {
    const { error } = await supabase.from("Base").delete().eq("id", id);
    if (error) {
      console.error("Error al eliminar:", error.message);
      return;
    }
    cargarJugadores();
  }

  // Hacer accesible la función desde el botón
  window.eliminarJugador = eliminarJugador;

  // Inicial: cargar jugadores
  cargarJugadores();

  // Realtime: escuchar nuevas inserciones
  supabase
    .channel("jugadores-stream")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "Base",
      },
      (payload) => {
        console.log("Nuevo jugador detectado en tiempo real:", payload.new);
        cargarJugadores();
      }
    )
    .subscribe();
});
