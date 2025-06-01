export default async function handler(req, res) {
  const SUPABASE_URL = "https://tdvdhqhvzwqyvezunwwh.supabase.co";
  const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRkdmRocWh2endxeXZlenVud3doIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMxMjg0MTksImV4cCI6MjA1ODcwNDQxOX0.pZ1GzHfUjZ1i1LI5bLZhAa_rtQk82O-9xkRKbQeQkfc";

  const fetch = (await import("node-fetch")).default;

  function tiempoASegundos(t) {
    try {
      const [min, seg] = t.trim().split("m");
      return parseInt(min) * 60 + parseInt(seg.replace("s", "").trim());
    } catch {
      return NaN;
    }
  }

  function rolDominante(row) {
    const roles = {
      Acosador: row.decisiones_acosador,
      Víctima: row.decisiones_victima,
      "Observador Activo": row.decisiones_observador_activo,
      "Observador Pasivo": row.decisiones_observador_pasivo,
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

  try {
    const respuesta = await fetch(SUPABASE_URL, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    });
    const data = await respuesta.json();

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

    const salida = [];
    salida.push("--- ANÁLISIS GENERAL DEL GRUPO ---\n");
    salida.push(`Total de jugadores: ${data.length}`);

    const suma = campo => data.reduce((acc, r) => acc + (r[campo] || 0), 0);
    const decisiones_totales = {
      Acosador: suma("decisiones_acosador"),
      Víctima: suma("decisiones_victima"),
      "Observador Activo": suma("decisiones_observador_activo"),
      "Observador Pasivo": suma("decisiones_observador_pasivo"),
    };
    const rolMasFrecuente = Object.keys(decisiones_totales).reduce((a, b) => decisiones_totales[a] > decisiones_totales[b] ? a : b);

    salida.push("\nDecisiones por rol:");
    for (const [rol, total] of Object.entries(decisiones_totales)) {
      salida.push(`  ${rol}: ${total}`);
    }
    salida.push(`Rol más frecuente: ${rolMasFrecuente}`);

    const finales = {};
    for (const r of data) {
      if (!r.final_obtenido) continue;
      finales[r.final_obtenido] = (finales[r.final_obtenido] || 0) + 1;
    }
    const finalMasComun = Object.keys(finales).reduce((a, b) => finales[a] > finales[b] ? a : b);

    salida.push("\nFinales más comunes:");
    for (const [f, c] of Object.entries(finales)) {
      salida.push(`  ${f}: ${c}`);
    }
    salida.push(`Final más frecuente: ${finalMasComun}`);

    const promedio = campo => data.reduce((a, b) => a + (b[campo] || 0), 0) / data.length;
    salida.push(`\nTiempo promedio jugado: ${promedio("tiempo_jugado_seg").toFixed(2)} segundos`);
    salida.push(`Tiempo promedio de decisión: ${promedio("tiempo_decision").toFixed(2)} segundos`);

    const clasificaciones = {};
    for (const r of data) {
      clasificaciones[r.clasificacion] = (clasificaciones[r.clasificacion] || 0) + 1;
    }
    const perfilDominante = Object.keys(clasificaciones).reduce((a, b) => clasificaciones[a] > clasificaciones[b] ? a : b);

    salida.push("\nDistribución de perfiles fuzzy:");
    for (const [k, v] of Object.entries(clasificaciones)) {
      salida.push(`  ${k}: ${v}`);
    }
    salida.push(`Perfil dominante: ${perfilDominante}`);

    const avgX = promedio("tiempo_jugado_seg");
    const avgY = promedio("total_decisiones");
    const numerador = data.reduce((sum, r) => sum + ((r.tiempo_jugado_seg - avgX) * (r.total_decisiones - avgY)), 0);
    const denomX = Math.sqrt(data.reduce((sum, r) => sum + ((r.tiempo_jugado_seg - avgX) ** 2), 0));
    const denomY = Math.sqrt(data.reduce((sum, r) => sum + ((r.total_decisiones - avgY) ** 2), 0));
    const correlacion = numerador / (denomX * denomY);
    salida.push(`\nCorrelación entre tiempo jugado y decisiones tomadas: ${correlacion.toFixed(2)}`);

    salida.push("\n--- CONCLUSIÓN GENERAL DEL GRUPO ---\n");

    if (perfilDominante === "Reflexivo") {
      salida.push("El grupo mostró una tendencia reflexiva, indicando que los jugadores se tomaron el tiempo para pensar sus decisiones.");
    } else if (perfilDominante === "Equilibrado") {
      salida.push("El grupo tiene un comportamiento equilibrado, con una toma de decisiones moderada tanto en rapidez como en análisis.");
    } else {
      salida.push("La mayoría de los jugadores actuaron de forma impulsiva, eligiendo rápidamente sin tanto análisis previo.");
    }

    if (rolMasFrecuente === "Víctima") {
      salida.push("El rol más adoptado fue el de víctima, lo que podría reflejar una fuerte identificación emocional con el conflicto.");
    } else if (rolMasFrecuente === "Acosador") {
      salida.push("El rol más adoptado fue el de acosador. Esto puede indicar interés en explorar consecuencias narrativas de ese camino.");
    } else {
      salida.push(`El rol más adoptado fue el de ${rolMasFrecuente.toLowerCase()}, lo que sugiere una preferencia por observar más que intervenir directamente.`);
    }

    if (correlacion > 0.3) {
      salida.push("Existe una correlación fuerte entre tiempo jugado y cantidad de decisiones, lo que sugiere compromiso narrativo.");
    } else if (correlacion > 0.1) {
      salida.push("Hay una correlación leve positiva entre tiempo jugado y decisiones tomadas.");
    } else if (correlacion < -0.3) {
      salida.push("Curiosamente, cuanto más tiempo jugaban, menos decisiones tomaban. Esto podría indicar confusión o indecisión.");
    } else {
      salida.push("No se detectó una correlación significativa entre tiempo de juego y número de decisiones.");
    }

    if (finalMasComun.includes("Videojuegos")) {
      salida.push("El final más elegido fue 'Videojuegos', indicando una tendencia hacia el aislamiento o búsqueda de escape.");
    } else if (finalMasComun.includes("Gym")) {
      salida.push("El final más común fue 'Gym', lo cual podría representar intención de superación personal en la narrativa.");
    } else {
      salida.push(`El final más frecuente fue '${finalMasComun}', lo cual puede ser un punto interesante para rediseñar ramas narrativas.`);
    }

    res.status(200).send(salida.join("\n"));
  } catch (err) {
    res.status(500).send("Error en el análisis: " + err.message);
  }
}
