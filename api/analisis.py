import pandas as pd
import numpy as np
import skfuzzy as fuzz
from skfuzzy import control as ctrl
import requests

SUPABASE_URL = "https://tdvdhqhvzwqyvezunwwh.supabase.co/rest/v1/Base"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRkdmRocWh2endxeXZlenVud3doIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMxMjg0MTksImV4cCI6MjA1ODcwNDQxOX0.pZ1GzHfUjZ1i1LI5bLZhAa_rtQk82O-9xkRKbQeQkfc"

def tiempo_a_segundos(t):
    try:
        minutos, segundos = t.strip().split('m')
        return int(minutos) * 60 + int(segundos.replace('s', '').strip())
    except:
        return np.nan

def rol_dominante(row):
    roles = {
        'Acosador': row['decisiones_acosador'],
        'Víctima': row['decisiones_victima'],
        'Observador Activo': row['decisiones_observador_activo'],
        'Observador Pasivo': row['decisiones_observador_pasivo']
    }
    return max(roles, key=roles.get)

def clasificacion_fuzzy(valor):
    if pd.isna(valor):
        return "No clasificado"
    elif valor < 35:
        return "Impulsivo"
    elif valor < 65:
        return "Equilibrado"
    else:
        return "Reflexivo"

def handler(request):
    salida = []
    try:
        headers = {
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}"
        }
        response = requests.get(SUPABASE_URL, headers=headers)
        data = response.json()
        df = pd.DataFrame(data)
    except Exception as e:
        return {
            "statusCode": 500,
            "body": f"Error al conectarse a Supabase: {str(e)}"
        }

    df['tiempo_jugado_seg'] = df['tiempo_jugado'].apply(tiempo_a_segundos)
    df['rol_dominante'] = df.apply(rol_dominante, axis=1)

    tiempo_jugado = ctrl.Antecedent(np.arange(0, 2000, 1), 'tiempo_jugado')
    tiempo_decision = ctrl.Antecedent(np.arange(0, 200, 1), 'tiempo_decision')
    perfil = ctrl.Consequent(np.arange(0, 100, 1), 'perfil')

    tiempo_jugado['bajo'] = fuzz.trimf(tiempo_jugado.universe, [0, 0, 400])
    tiempo_jugado['medio'] = fuzz.trimf(tiempo_jugado.universe, [300, 700, 1100])
    tiempo_jugado['alto'] = fuzz.trimf(tiempo_jugado.universe, [1000, 1500, 2000])

    tiempo_decision['rápido'] = fuzz.trimf(tiempo_decision.universe, [0, 0, 40])
    tiempo_decision['normal'] = fuzz.trimf(tiempo_decision.universe, [30, 80, 130])
    tiempo_decision['lento'] = fuzz.trimf(tiempo_decision.universe, [120, 160, 200])

    perfil['impulsivo'] = fuzz.trimf(perfil.universe, [0, 0, 40])
    perfil['equilibrado'] = fuzz.trimf(perfil.universe, [30, 50, 70])
    perfil['reflexivo'] = fuzz.trimf(perfil.universe, [60, 100, 100])

    reglas = [
        ctrl.Rule(tiempo_jugado['bajo'] & tiempo_decision['rápido'], perfil['impulsivo']),
        ctrl.Rule(tiempo_jugado['medio'] & tiempo_decision['normal'], perfil['equilibrado']),
        ctrl.Rule(tiempo_jugado['alto'] & tiempo_decision['lento'], perfil['reflexivo']),
    ]

    sistema = ctrl.ControlSystem(reglas)
    simulador = ctrl.ControlSystemSimulation(sistema)

    valores_fuzzy = []
    for _, row in df.iterrows():
        try:
            simulador.input['tiempo_jugado'] = row['tiempo_jugado_seg']
            simulador.input['tiempo_decision'] = row['tiempo_decision']
            simulador.compute()
            valores_fuzzy.append(simulador.output['perfil'])
        except:
            valores_fuzzy.append(np.nan)

    df['perfil_fuzzy'] = valores_fuzzy
    df['clasificacion'] = df['perfil_fuzzy'].apply(clasificacion_fuzzy)

    salida.append("--- ANÁLISIS GENERAL DEL GRUPO ---\n")
    salida.append(f"Total de jugadores: {len(df)}")

    decisiones_totales = {
        'Acosador': df['decisiones_acosador'].sum(),
        'Víctima': df['decisiones_victima'].sum(),
        'Observador Activo': df['decisiones_observador_activo'].sum(),
        'Observador Pasivo': df['decisiones_observador_pasivo'].sum()
    }
    rol_mas_frecuente = max(decisiones_totales, key=decisiones_totales.get)

    salida.append("\nDecisiones por rol:")
    for rol, total in decisiones_totales.items():
        salida.append(f"  {rol}: {total}")
    salida.append(f"Rol más frecuente: {rol_mas_frecuente}")

    finales = df['final_obtenido'].value_counts()
    final_mas_comun = finales.idxmax()
    salida.append("\nFinales más comunes:")
    salida.append(str(finales))
    salida.append(f"Final más frecuente: {final_mas_comun}")

    salida.append(f"\nTiempo promedio jugado: {df['tiempo_jugado_seg'].mean():.2f} segundos")
    salida.append(f"Tiempo promedio de decisión: {df['tiempo_decision'].mean():.2f} segundos")

    perfiles_fuzzy = df['clasificacion'].value_counts()
    perfil_dominante = perfiles_fuzzy.idxmax()
    salida.append("\nDistribución de perfiles fuzzy:")
    salida.append(str(perfiles_fuzzy))
    salida.append(f"Perfil dominante: {perfil_dominante}")

    df['total_decisiones'] = df[['decisiones_acosador', 'decisiones_victima',
                                 'decisiones_observador_activo', 'decisiones_observador_pasivo']].sum(axis=1)
    correlacion = df['tiempo_jugado_seg'].corr(df['total_decisiones'])
    salida.append(f"\nCorrelación entre tiempo jugado y decisiones tomadas: {correlacion:.2f}")

    salida.append("\nFinales según clasificación fuzzy:")
    salida.append(str(df.groupby('clasificacion')['final_obtenido'].value_counts()))

    observadores = df[df['rol_dominante'].str.contains('Observador')]
    porcentaje_obs = (len(observadores) / len(df)) * 100
    salida.append(f"\nJugadores con rol observador dominante: {len(observadores)} ({porcentaje_obs:.1f}%)")

    salida.append("\nTiempo promedio jugado por perfil:")
    salida.append(str(df.groupby('clasificacion')['tiempo_jugado_seg'].mean()))

    salida.append("\n--- CONCLUSIÓN GENERAL DEL GRUPO ---\n")

    if perfil_dominante == "Reflexivo":
        salida.append("El grupo mostró una tendencia reflexiva, indicando que los jugadores se tomaron el tiempo para pensar sus decisiones.")
    elif perfil_dominante == "Equilibrado":
        salida.append("El grupo tiene un comportamiento equilibrado, con una toma de decisiones moderada tanto en rapidez como en análisis.")
    elif perfil_dominante == "Impulsivo":
        salida.append("La mayoría de los jugadores actuaron de forma impulsiva, eligiendo rápidamente sin tanto análisis previo.")

    if rol_mas_frecuente == "Víctima":
        salida.append("El rol más adoptado fue el de víctima, lo que podría reflejar una fuerte identificación emocional con el conflicto.")
    elif rol_mas_frecuente == "Acosador":
        salida.append("El rol más adoptado fue el de acosador. Esto puede indicar interés en explorar consecuencias narrativas de ese camino.")
    else:
        salida.append(f"El rol más adoptado fue el de {rol_mas_frecuente.lower()}, lo que sugiere una preferencia por observar más que intervenir directamente.")

    if correlacion > 0.3:
        salida.append("Existe una correlación fuerte entre tiempo jugado y cantidad de decisiones, lo que sugiere compromiso narrativo.")
    elif correlacion > 0.1:
        salida.append("Hay una correlación leve positiva entre tiempo jugado y decisiones tomadas.")
    elif correlacion < -0.3:
        salida.append("Curiosamente, cuanto más tiempo jugaban, menos decisiones tomaban. Esto podría indicar confusión o indecisión.")
    else:
        salida.append("No se detectó una correlación significativa entre tiempo de juego y número de decisiones.")

    if "Videojuegos" in final_mas_comun:
        salida.append("El final más elegido fue 'Videojuegos', indicando una tendencia hacia el aislamiento o búsqueda de escape.")
    elif "Gym" in final_mas_comun:
        salida.append("El final más común fue 'Gym', lo cual podría representar intención de superación personal en la narrativa.")
    else:
        salida.append(f"El final más frecuente fue '{final_mas_comun}', lo cual puede ser un punto interesante para rediseñar ramas narrativas.")

    return {
        "statusCode": 200,
        "headers": {"Content-Type": "text/plain"},
        "body": "\n".join(salida)
    }