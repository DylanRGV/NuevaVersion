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

  try {
    const res = await fetch(SUPABASE_URL, {
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`
      }
    });

    let data = await res.json();
    if (!data || data.length === 0) throw new Error("No hay datos");

    // 🔵 POBLAR SELECT DE ESCUELAS
    const escuelas = [...new Set(data.map(d => d.escuela).filter(e => e))];
    const selectEscuela = document.getElementById("escuelaSelect");
    if (selectEscuela && selectEscuela.children.length === 1) {
      escuelas.forEach(e => {
        const opt = document.createElement("option");
        opt.value = e;
        opt.textContent = e;
        selectEscuela.appendChild(opt);
      });
    }

    // 🔵 FILTRAR POR ESCUELA SI SE SELECCIONÓ
    const escuelaSeleccionada = selectEscuela ? selectEscuela.value : "";
    if (escuelaSeleccionada) {
      data = data.filter(d => d.escuela === escuelaSeleccionada);
    }

    // 🔵 SEGUIMOS TU CÓDIGO TAL CUAL (no modificado)...
    for (const row of data) {
      row.tiempo_jugado_seg = tiempoASegundos(row.tiempo_jugado || "");
      row.rol_dominante = rolDominante(row);
      row.perfil_fuzzy = evaluarFuzzy(row.tiempo_jugado_seg, row.tiempo_decision);
      row.clasificacion = clasificacionFuzzy(row.perfil_fuzzy);
      row.total_decisiones = (
        (row.decisiones_acosador || 0) +
        (row.decisiones_victima || 0) +
        (row.decisiones_observador_activo || 0) +
        (row.decisiones_observador_pasivo || 0)
      );
    }

    salida.push(`--- ANÁLISIS ${escuelaSeleccionada ? "DE " + escuelaSeleccionada : "GENERAL DEL GRUPO"} ---\n`);
    salida.push(`Total de jugadores: ${data.length}`);

    const suma = campo => data.reduce((acc, r) => acc + (r[campo] || 0), 0);
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

    // ... (Gráficas y el resto igual)
    // Aquí NO cambiamos nada más para que todo siga funcionando como antes

    // 🟢 Gráfica general de roles
    const ctx = document.getElementById("graficaRoles").getContext("2d");
    if (window.grafica) window.grafica.destroy();
    window.grafica = new Chart(ctx, {
      type: "bar",
      data: {
        labels: Object.keys(decisiones_totales),
        datasets: [{
          label: "Total de Decisiones por Rol",
          data: Object.values(decisiones_totales),
          backgroundColor: [
            "rgba(255, 99, 132, 0.5)",
            "rgba(54, 162, 235, 0.5)",
            "rgba(255, 206, 86, 0.5)",
            "rgba(75, 192, 192, 0.5)"
          ],
          borderColor: [
            "rgba(255, 99, 132, 1)",
            "rgba(54, 162, 235, 1)",
            "rgba(255, 206, 86, 1)",
            "rgba(75, 192, 192, 1)"
          ],
          borderWidth: 1
        }]
      },
      options: { responsive: true, scales: { y: { beginAtZero: true } } }
    });

    // 🟢 Gráfica por género
    const roles = ["Acosador", "Víctima", "Observador Activo", "Observador Pasivo"];
    const decisionesGenero = { masculino: [0, 0, 0, 0], femenino: [0, 0, 0, 0] };
    for (const r of data) {
      const genero = (r.genero || "desconocido").toLowerCase();
      if (genero !== "masculino" && genero !== "femenino") continue;
      decisionesGenero[genero][0] += r.decisiones_acosador || 0;
      decisionesGenero[genero][1] += r.decisiones_victima || 0;
      decisionesGenero[genero][2] += r.decisiones_observador_activo || 0;
      decisionesGenero[genero][3] += r.decisiones_observador_pasivo || 0;
    }
    const ctxGenero = document.getElementById("graficaGenero").getContext("2d");
    if (window.graficaGenero && typeof window.graficaGenero.destroy === "function") {
      window.graficaGenero.destroy();
    }
    window.graficaGenero = new Chart(ctxGenero, {
      type: "bar",
      data: {
        labels: roles,
        datasets: [
          { label: "Masculino", data: decisionesGenero.masculino, backgroundColor: "rgba(0, 0, 139, 0.5)", borderColor: "rgba(0, 0, 139, 1)", borderWidth: 1 },
          { label: "Femenino", data: decisionesGenero.femenino, backgroundColor: "rgba(255, 105, 180, 0.5)", borderColor: "rgba(255, 105, 180, 1)", borderWidth: 1 }
        ]
      },
      options: { responsive: true, scales: { y: { beginAtZero: true } } }
    });

    // ... El resto de tu análisis (finales, perfiles, correlación, etc.) lo mantienes igual.

    // 🟢 Final: Mostrar resultado
    document.getElementById("resultado").innerText = salida.join("\n");
  } catch (err) {
    document.getElementById("resultado").innerText = `❌ Error: ${err.message}`;
  }
}

window.mostrarAnalisis = analizarDatos;
