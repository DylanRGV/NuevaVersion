const supabaseUrl = 'https://tdvdhqhvzwqyvezunwwh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRkdmRocWh2endxeXZlenVud3doIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMxMjg0MTksImV4cCI6MjA1ODcwNDQxOX0.pZ1GzHfUjZ1i1LI5bLZhAa_rtQk82O-9xkRKbQeQkfc';
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
        <td>${j.teclas_pulsadas || ''}</td>
        <td>${j.escuela || ''}</td>
        <td>${j.genero || ''}</td>
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

  // 📌 Nueva función: Exportar Excel con formato bonito
  async function exportarExcel() {
    const escuelaSeleccionada = document.getElementById("escuelaSelect")?.value || "";

    let { data, error } = await supabase.from("Base").select("*");

    if (error) {
      console.error("Error al exportar:", error.message);
      return;
    }

    // Si hay escuela seleccionada, filtra los datos antes de exportar
    if (escuelaSeleccionada) {
      data = data.filter(d => d.escuela === escuelaSeleccionada);
    }

    if (!data || data.length === 0) {
      alert("No hay datos para exportar.");
      return;
    }

    // Convertir los datos en formato para SheetJS
    const ws = XLSX.utils.json_to_sheet(data);

    // Rango de la hoja
    const range = XLSX.utils.decode_range(ws['!ref']);
    const pastelColors = [
      "FFB6C1", // Rosa pastel
      "FFDAB9", // Durazno
      "E6E6FA", // Lavanda
      "FFFACD", // Amarillo claro
      "D1F2EB", // Verde agua
      "CCE5FF", // Azul cielo
      "F5CBA7", // Naranja suave
      "F9E79F"  // Amarillo pastel
    ];

    // Colorear encabezados
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cell_address = XLSX.utils.encode_cell({ r: 0, c: C });
      if (!ws[cell_address]) continue;
      ws[cell_address].s = {
        fill: { fgColor: { rgb: pastelColors[C % pastelColors.length] } },
        font: { bold: true, sz: 12, color: { rgb: "000000" } },
        alignment: { horizontal: "center", vertical: "center", wrapText: true }
      };
    }

    // Ajustar ancho de columnas
    const colWidths = [];
    for (let C = range.s.c; C <= range.e.c; ++C) {
      let maxWidth = 10;
      for (let R = range.s.r; R <= range.e.r; ++R) {
        const cell_address = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = ws[cell_address];
        if (cell && cell.v) {
          const cellLength = cell.v.toString().length;
          if (cellLength > maxWidth) maxWidth = cellLength;
        }
      }
      colWidths.push({ wch: maxWidth + 2 });
    }
    ws['!cols'] = colWidths;

    // Crear libro y exportar
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Jugadores");

    const nombreArchivo = escuelaSeleccionada ? `jugadores_${escuelaSeleccionada}.xlsx` : "jugadores_todos.xlsx";
    XLSX.writeFile(wb, nombreArchivo);
  }

  // Exponer función global
  window.exportarExcel = exportarExcel;

  // 📌 Cargar SheetJS dinámicamente si no existe
  (function loadSheetJS() {
    if (typeof XLSX === "undefined") {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
      script.onload = () => console.log("SheetJS cargado ✅");
      document.head.appendChild(script);
    }
  })();
});
