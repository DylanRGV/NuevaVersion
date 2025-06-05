const SUPABASE_URL = "https://tdvdhqhvzwqyvezunwwh.supabase.co/rest/v1/Base";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRkdmRocWh2endxeXZlenVud3doIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMxMjg0MTksImV4cCI6MjA1ODcwNDQxOX0.pZ1GzHfUjZ1i1LI5bLZhAa_rtQk82O-9xkRKbQeQkfc";

function tiempoASegundos(tiempo) {
  try {
    const [min, seg] = tiempo.replace("s", "").split("m");
    return parseInt(min.trim()) * 60 + parseInt(seg.trim());
  } catch {
    return NaN;
  }
}

function rolDominante(row) {
  const roles = {
    'Acosador': row.decisiones_acosador,
    'Víctima': row.decisiones_victima,
    'Observador Activo': row.decisiones_observador_activo,
    'Observador Pasivo': row.decisiones_observador_pasivo
  };
  return Object.keys(roles).reduce((a, b) => roles[a] > roles[b] ? a : b);
}

function clasificacionFuzzy(valor) {
  if (isNaN(valor)) return "No clasificado";
  if (valor < 35) return "Impulsivo";
  if (valor < 65) return "Equilibrado";
  return "Reflexivo";
}

function evaluarFuzzy(tj, td) {
  if (tj <= 400 && td <= 40) return 20;
  if (tj >= 1000 && td >= 120) return 80;
  if (tj >= 300 && tj <= 1100 && td >= 30 && td <= 130) return 50;
  return 50;
}

async function analizarDatos() {
  const salida = [];
  const escuelaSeleccionada = document.getElementById("escuelaSelect").value;

  try {
    const res = await fetch(SUPABASE_URL, {
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`
      }
    });

    const data = await res.json();
    if (!data || data.length === 0) throw new Error("No hay datos");

    // Filtrar por escuela si se ha seleccionado una
    const dataFiltrada = escuelaSeleccionada
      ? data.filter(r => r.escuela && r.escuela.toLowerCase().includes(escuelaSeleccionada.toLowerCase()))
      : data;

    for (const row of dataFiltrada) {
      row.tiempo_jugado_seg = tiempoASegundos(row.tiempo_jugado || "");
      row.rol_dominante = rolDominante(row);
      row.perfil_fuzzy = evaluarFuzzy(row.tiempo_jugado_seg, row.tiempo_decision);
      row.clasificacion = clasificacionFuzzy(row.perfil_fuzzy);
      row.total_decisiones =
        (row.decisiones_acosador || 0) +
        (row.decisiones_victima || 0) +
        (row.decisiones_observador_activo || 0) +
        (row.decisiones_observador_pasivo || 0);
    }

    salida.push(`--- ANÁLISIS DE ${escuelaSeleccionada || "Todas las Escuelas"} ---\n`);
    salida.push(`Total de jugadores: ${dataFiltrada.length}`);

    const suma = campo => dataFiltrada.reduce((acc, r) => acc + (r[campo] || 0), 0);
    const decisiones_totales = {
      'Acosador': suma('decisiones_acosador'),
      'Víctima': suma('decisiones_victima'),
      'Observador Activo': suma('decisiones_observador_activo'),
      'Observador Pasivo': suma('decisiones_observador_pasivo')
    };
    const rolMasFrecuente = Object.keys(decisiones_totales).reduce((a, b) => decisiones_totales[a] > decisiones_totales[b] ? a : b);

    salida.push("\nDecisiones por rol:");
    for (const [rol, total] of Object.entries(decisiones_totales)) {
      salida.push(`  ${rol}: ${total}`);
    }
    salida.push(`Rol más frecuente: ${rolMasFrecuente}`);

    // --- Gráfica: Decisiones Totales por Rol ---
    const ctxRoles = document.getElementById("graficaRoles")?.getContext("2d");
    if (ctxRoles) {
      if (window.graficaRoles && typeof window.graficaRoles.destroy === "function") window.graficaRoles.destroy();
      window.graficaRoles = new Chart(ctxRoles, {
        type: "bar",
        data: {
          labels: Object.keys(decisiones_totales),
          datasets: [{
            label: "Total de Decisiones por Rol",
            data: Object.values(decisiones_totales),
            backgroundColor: ["rgba(255, 99, 132, 0.5)", "rgba(54, 162, 235, 0.5)", "rgba(255, 206, 86, 0.5)", "rgba(75, 192, 192, 0.5)"],
            borderColor: ["rgba(255, 99, 132, 1)", "rgba(54, 162, 235, 1)", "rgba(255, 206, 86, 1)", "rgba(75, 192, 192, 1)"],
            borderWidth: 1
          }]
        },
        options: { responsive: true, scales: { y: { beginAtZero: true } } }
      });
    }

    // --- Gráfica: Decisiones por Género ---
    const decisionesGenero = { masculino: [0, 0, 0, 0], femenino: [0, 0, 0, 0] };
    for (const r of dataFiltrada) {
      const genero = (r.genero || "").toLowerCase();
      if (genero === "masculino" || genero === "femenino") {
        decisionesGenero[genero][0] += r.decisiones_acosador || 0;
        decisionesGenero[genero][1] += r.decisiones_victima || 0;
        decisionesGenero[genero][2] += r.decisiones_observador_activo || 0;
        decisionesGenero[genero][3] += r.decisiones_observador_pasivo || 0;
      }
    }
    const ctxGenero = document.getElementById("graficaGenero")?.getContext("2d");
    if (ctxGenero) {
      if (window.graficaGenero && typeof window.graficaGenero.destroy === "function") window.graficaGenero.destroy();
      window.graficaGenero = new Chart(ctxGenero, {
        type: "bar",
        data: {
          labels: ["Acosador", "Víctima", "Observador Activo", "Observador Pasivo"],
          datasets: [
            { label: "Masculino", data: decisionesGenero.masculino, backgroundColor: "rgba(0, 0, 139, 0.5)", borderColor: "rgba(0, 0, 139, 1)", borderWidth: 1 },
            { label: "Femenino", data: decisionesGenero.femenino, backgroundColor: "rgba(255, 105, 180, 0.5)", borderColor: "rgba(255, 105, 180, 1)", borderWidth: 1 }
          ]
        },
        options: { responsive: true, scales: { y: { beginAtZero: true } } }
      });
    }

    // --- Conclusiones ---
    const finales = {};
    for (const r of dataFiltrada) {
      if (!r.final_obtenido) continue;
      finales[r.final_obtenido] = (finales[r.final_obtenido] || 0) + 1;
    }
    const finalMasComun = Object.keys(finales).reduce((a, b) => finales[a] > finales[b] ? a : b);
    salida.push("\nFinales más comunes:");
    for (const [f, c] of Object.entries(finales)) salida.push(`  ${f}: ${c}`);
    salida.push(`Final más frecuente: ${finalMasComun}`);

    const promedio = campo => dataFiltrada.reduce((a, b) => a + (b[campo] || 0), 0) / dataFiltrada.length;
    salida.push(`\nTiempo promedio jugado: ${promedio('tiempo_jugado_seg').toFixed(2)} segundos`);
    salida.push(`Tiempo promedio de decisión: ${promedio('tiempo_decision').toFixed(2)} segundos`);

    const clasificaciones = {};
    for (const r of dataFiltrada) clasificaciones[r.clasificacion] = (clasificaciones[r.clasificacion] || 0) + 1;
    const perfilDominante = Object.keys(clasificaciones).reduce((a, b) => clasificaciones[a] > clasificaciones[b] ? a : b);
    salida.push("\nDistribución de perfiles fuzzy:");
    for (const [k, v] of Object.entries(clasificaciones)) salida.push(`  ${k}: ${v}`);
    salida.push(`Perfil dominante: ${perfilDominante}`);

    // Conclusiones adicionales (idénticas a antes)
    salida.push("\n--- CONCLUSIÓN GENERAL DEL GRUPO ---\n");
    salida.push(perfilDominante === "Reflexivo"
      ? "El grupo mostró una tendencia reflexiva, indicando que los jugadores se tomaron el tiempo para pensar sus decisiones."
      : perfilDominante === "Equilibrado"
      ? "El grupo tiene un comportamiento equilibrado, con una toma de decisiones moderada tanto en rapidez como en análisis."
      : "La mayoría de los jugadores actuaron de forma impulsiva, eligiendo rápidamente sin tanto análisis previo.");

    salida.push(rolMasFrecuente === "Víctima"
      ? "El rol más adoptado fue el de víctima, lo que podría reflejar una fuerte identificación emocional con el conflicto."
      : rolMasFrecuente === "Acosador"
      ? "El rol más adoptado fue el de acosador. Esto puede indicar interés en explorar consecuencias narrativas de ese camino."
      : `El rol más adoptado fue el de ${rolMasFrecuente.toLowerCase()}, lo que sugiere una preferencia por observar más que intervenir directamente.`);

    const avgX = promedio("tiempo_jugado_seg");
    const avgY = promedio("total_decisiones");
    const numerador = dataFiltrada.reduce((sum, r) => sum + ((r.tiempo_jugado_seg - avgX) * (r.total_decisiones - avgY)), 0);
    const denomX = Math.sqrt(dataFiltrada.reduce((sum, r) => sum + ((r.tiempo_jugado_seg - avgX) ** 2), 0));
    const denomY = Math.sqrt(dataFiltrada.reduce((sum, r) => sum + ((r.total_decisiones - avgY) ** 2), 0));
    const correlacion = numerador / (denomX * denomY);

    salida.push(correlacion > 0.3
      ? "Existe una correlación fuerte entre tiempo jugado y cantidad de decisiones, lo que sugiere compromiso narrativo."
      : correlacion > 0.1
      ? "Hay una correlación leve positiva entre tiempo jugado y decisiones tomadas."
      : correlacion < -0.3
      ? "Curiosamente, cuanto más tiempo jugaban, menos decisiones tomaban. Esto podría indicar confusión o indecisión."
      : "No se detectó una correlación significativa entre tiempo de juego y número de decisiones.");

    if (finalMasComun.includes("Videojuegos")) {
      salida.push("El final más elegido fue 'Videojuegos', indicando una tendencia hacia el aislamiento o búsqueda de escape.");
    } else if (finalMasComun.includes("Gym")) {
      salida.push("El final más común fue 'Gym', lo cual podría representar intención de superación personal en la narrativa.");
    } else {
      salida.push(`El final más frecuente fue '${finalMasComun}', lo cual puede ser un punto interesante para rediseñar ramas narrativas.`);
    }

    // Mostrar resultados
    document.getElementById("resultado").innerText = salida.join("\n");
  } catch (err) {
    document.getElementById("resultado").innerText = `❌ Error: ${err.message}`;
  }
}

// Se actualiza automáticamente al cambiar la escuela
window.mostrarAnalisis = analizarDatos;
window.addEventListener("DOMContentLoaded", () => {
  mostrarAnalisis();
});