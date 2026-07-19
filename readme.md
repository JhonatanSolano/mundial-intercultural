# Copa de la Interculturalidad

App web estática para una jornada de interculturalidad con estética mundialista.

## Cómo usarla

1. Abre `index.html` en el navegador.
2. Escribe el nombre del equipo y pulsa **Guardar**.
3. Sortea el país del equipo.
4. Avanza por las estaciones:
   - Memoria cultural con fichas ocultas.
   - Adivina el país con cronómetro en segundos.
   - Tarjetas de convivencia intercultural.
   - Tribuna sonora con música general y música inspirada en países.
   - Compromisos finales.

## Importante

- La actividad rompehielo fue eliminada.
- El tema central es la interculturalidad; la estética mundialista funciona como ambientación.
- Los equipos se guardan en el navegador con `localStorage` del mismo PC.
- No se puede repetir el nombre de equipo. Si alguien intenta guardar un nombre ya usado, aparece un mensaje y debe cambiarlo.
- Cada equipo recibe una semilla aleatoria guardada localmente: fichas, órdenes, pistas y tiempos cambian por grupo y no quedan fáciles de copiar.
- En las actividades con países, excepto memoria, la selección prioriza países menos usados para que participen todos y no se repitan tanto durante la jornada.
- En el sorteo de la actividad 1, los países no se repiten entre equipos mientras el juego siga guardado.
- Todos los juegos trabajan 10 países: Argentina, Brasil, Colombia, Ecuador, Haití, México, Panamá, Paraguay, Perú y Uruguay.
- Las actividades 1, 3 y 5 usan esos mismos 10 países:
  - Actividad 1: sortea banderas sin repetir país entre equipos mientras haya países disponibles.
  - Actividad 3: usa una cola aleatoria de países para las pistas y evita repetir demasiado antes de que salgan los demás.
  - Actividad 5: usa una cola aleatoria de canciones de países; `electronica.mp3` queda solo como música de fondo.
- El puntaje máximo total es 100:
  - Sorteo: 5 puntos. El equipo sortea una bandera y tiene 20 segundos para dibujarla y escribir el país. Al terminar, se evalúa con 0, 3 o 5 puntos.
  - Memoria cultural: 20 puntos en 2 minutos. La ronda sale aleatoriamente entre país-capital o país-comida típica. Si completan todo en 60 segundos o menos ganan 20 puntos; si completan todo después del primer minuto ganan 10 puntos.
  - Adivina el país: 20 puntos, pero desde la tercera pista baja el puntaje y cada intento incorrecto descuenta 3 puntos. Las pistas son más difíciles y la bandera queda de última.
  - Tarjetas de convivencia: 20 puntos en 1 minuto y medio, con un banco de 50 preguntas aleatorias. Las fichas abiertas pero no contestadas y las fichas cerradas no suman puntos.
  - Música por país: 15 puntos en 25 segundos, con tres canciones aleatorias de países. Se usa una cola de rotación para que salgan todos los MP3 de países antes de repetirlos demasiado. `electronica.mp3` no participa porque es la música de fondo.
  - Cierre: 20 puntos con mínimo 5 frases.
- La actividad 1 primero sortea país y después activa cronómetro.
- Las demás actividades están bloqueadas hasta activar su cronómetro.
- Cuando se acaba el tiempo o se completa la actividad, la actividad queda bloqueada y se sella automáticamente.
- Cada juego permite una sola oportunidad por respuesta; no hay reintentos.
- La música no requiere archivos externos. Se genera con Web Audio API dentro del navegador:
  - Fuera de los juegos: ambiente general. Si agregas `assets/music/electronica.mp3`, el botón de música general reproducirá ese archivo en bucle.
  - Dentro de juegos: patrones inspirados en el país activo o en el país seleccionado.
- Si se sale de la app, se cambia de pestaña o el móvil manda la página al fondo, la música se pausa y la música general vuelve sola al regresar solo si estaba sonando antes.
- También puedes poner audios descargados en `assets/music/` con estos nombres exactos: `argentina.mp3`, `brasil.mp3`, `colombia.mp3`, `ecuador.mp3`, `haiti.mp3`, `mexico.mp3`, `panama.mp3`, `paraguay.mp3`, `peru.mp3`, `uruguay.mp3`.
- El botón **Se acabó el juego** muestra la tabla final por país, equipo y puntaje de mayor a menor, con música de triunfo.
- El botón **Reiniciar juego** borra todo lo guardado localmente y deja el torneo desde cero.

## Archivos

- `index.html`: estructura completa de la experiencia.
- `style.css`: diseño visual responsive.
- `data.js`: banco de países, pistas y preguntas de convivencia.
- `Script.js`: lógica de equipos, juegos, cronómetros, puntos, sellos y música.
