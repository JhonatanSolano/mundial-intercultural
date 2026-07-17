# Copa de la Interculturalidad

App web estatica para una jornada de interculturalidad con estetica mundialista.

## Como usarla

1. Abre `index.html` en el navegador.
2. Escribe el nombre del equipo y pulsa **Guardar**.
3. Sortea el pais del equipo.
4. Avanza por las estaciones:
   - Memoria cultural con fichas ocultas.
   - Adivina el pais con cronometro en segundos.
   - Tarjetas de convivencia intercultural.
   - Tribuna sonora con musica general y musica inspirada en paises.
   - Compromisos finales.

## Importante

- La actividad rompehielo fue eliminada.
- El tema central es la interculturalidad; la estetica mundialista funciona como ambientacion.
- Los equipos se guardan en el navegador con `localStorage` del mismo PC.
- No se puede repetir el nombre de equipo. Si alguien intenta guardar un nombre ya usado, aparece un mensaje y debe cambiarlo.
- Cada equipo recibe una semilla aleatoria guardada localmente: fichas, ordenes, pistas y tiempos cambian por grupo y no quedan faciles de copiar.
- Los paises no se repiten entre equipos mientras el juego siga guardado.
- Todos los juegos trabajan 10 paises: Argentina, Brasil, Colombia, Ecuador, Haiti, Mexico, Panama, Paraguay, Peru y Uruguay.
- El puntaje maximo total es 100:
  - Sorteo: 5 puntos. El equipo sortea una bandera y tiene 20 segundos para dibujarla.
  - Memoria cultural: 20 puntos en 2 minutos, emparejando pais con capital. Si completan todo en 60 segundos o menos ganan 20 puntos; si completan todo despues del primer minuto ganan 10 puntos. La ficha de capital no muestra el pais.
  - Adivina el pais: 20 puntos, pero desde la tercera pista baja el puntaje y cada intento incorrecto descuenta 3 puntos.
  - Tarjetas de convivencia: 20 puntos en 1 minuto y medio, segun respuestas correctas. Las fichas abiertas pero no contestadas y las fichas cerradas no suman puntos.
  - Musica por pais: 15 puntos en 25 segundos, con tres canciones muy aleatorias que priorizan paises menos repetidos y se responden una por una.
  - Cierre: 20 puntos con minimo 5 frases.
- La actividad 1 primero sortea pais y despues activa cronometro.
- Las demas actividades estan bloqueadas hasta activar su cronometro.
- Cuando se acaba el tiempo o se completa la actividad, la actividad queda bloqueada y se sella automaticamente.
- Cada juego permite una sola oportunidad por respuesta; no hay reintentos.
- La musica no requiere archivos externos. Se genera con Web Audio API dentro del navegador:
  - Fuera de los juegos: ambiente general. Si agregas `assets/music/electronica.mp3`, el boton de musica general reproducira ese archivo en bucle.
  - Dentro de juegos: patrones inspirados en el pais activo o en el pais seleccionado.
- Tambien puedes poner audios descargados en `assets/music/` con estos nombres exactos: `argentina.mp3`, `brasil.mp3`, `colombia.mp3`, `ecuador.mp3`, `haiti.mp3`, `mexico.mp3`, `panama.mp3`, `paraguay.mp3`, `peru.mp3`, `uruguay.mp3`.
- El boton **Se acabo el juego** muestra la tabla final por pais, equipo y puntaje de mayor a menor, con musica de triunfo.
- El boton **Reiniciar juego** borra todo lo guardado localmente y deja el torneo desde cero.

## Archivos

- `index.html`: estructura completa de la experiencia.
- `style.css`: diseno visual responsive.
- `data.js`: banco de paises, escenarios y compromisos sugeridos.
- `Script.js`: logica de equipos, juegos, cronometros, puntos, sellos y musica.
