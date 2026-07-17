const COUNTRIES = [
  {
    id: "colombia",
    name: "Colombia",
    capital: "Bogota",
    flag: "🇨🇴",
    flagImage: "assets/flags/colombia.svg",
    region: "Suramerica",
    language: "Espanol y mas de 60 lenguas nativas",
    greeting: "Que mas / Quiubo",
    food: "Arepa",
    rhythm: "Cumbia",
    celebration: "Carnaval de Barranquilla",
    value: "La alegria compartida tambien puede ser una forma de hospitalidad.",
    clue: "Pais andino y caribeno, con enorme biodiversidad y muchas formas de hablar el espanol.",
    music: { tempo: 106, scale: [392, 440, 523, 587, 659], drum: "cumbia" }
  },
  {
    id: "brasil",
    name: "Brasil",
    capital: "Brasilia",
    flag: "🇧🇷",
    flagImage: "assets/flags/brasil.svg",
    region: "Suramerica",
    language: "Portugues",
    greeting: "Oi / Tudo bem?",
    food: "Feijoada",
    rhythm: "Samba",
    celebration: "Carnaval",
    value: "Celebrar juntos no borra las diferencias: las vuelve visibles y compartidas.",
    clue: "Pais gigante de portugues, samba, carnaval y muchas raices afroamericanas.",
    music: { tempo: 120, scale: [349, 392, 440, 523, 587], drum: "samba" }
  },
  {
    id: "peru",
    name: "Peru",
    capital: "Lima",
    flag: "🇵🇪",
    flagImage: "assets/flags/peru.svg",
    region: "Suramerica",
    language: "Espanol, quechua y aimara",
    greeting: "Allinllachu / Hola",
    food: "Ceviche",
    rhythm: "Festejo",
    celebration: "Inti Raymi",
    value: "La interculturalidad tambien vive en reconocer lenguas originarias actuales.",
    clue: "Pais andino y costero, de ceviche, quechua, Inti Raymi y ritmos afroperuanos.",
    music: { tempo: 110, scale: [330, 392, 440, 494, 659], drum: "festejo" }
  },
  {
    id: "panama",
    name: "Panama",
    capital: "Ciudad de Panama",
    flag: "🇵🇦",
    flagImage: "assets/flags/panama.svg",
    region: "Centroamerica",
    language: "Espanol y lenguas indigenas",
    greeting: "Que sopa?",
    food: "Sancocho",
    rhythm: "Tamborito",
    celebration: "Carnavales",
    value: "Ser puente entre regiones tambien implica mezclar historias y acentos.",
    clue: "Pais puente entre mares y continentes, con tamborito, canal y carnavales.",
    music: { tempo: 118, scale: [330, 392, 440, 523, 587], drum: "tamborito" }
  },
  {
    id: "mexico",
    name: "Mexico",
    capital: "Ciudad de Mexico",
    flag: "🇲🇽",
    flagImage: "assets/flags/mexico.svg",
    region: "Norte/Centroamerica cultural",
    language: "Espanol y lenguas originarias",
    greeting: "Que onda?",
    food: "Tacos",
    rhythm: "Mariachi",
    celebration: "Dia de Muertos",
    value: "La memoria de quienes estuvieron antes tambien hace parte de la cultura viva.",
    clue: "Pais de tacos, mariachi, Dia de Muertos, lenguas originarias y plazas llenas de color.",
    music: { tempo: 112, scale: [392, 494, 523, 659, 784], drum: "mariachi" }
  },
  {
    id: "haiti",
    name: "Haiti",
    capital: "Puerto Principe",
    flag: "🇭🇹",
    flagImage: "assets/flags/haiti.svg",
    region: "Caribe",
    language: "Criollo haitiano y frances",
    greeting: "Bonjou",
    food: "Griot",
    rhythm: "Kompa",
    celebration: "Carnaval de Jacmel",
    value: "El Caribe tambien habla muchas lenguas y guarda memorias de resistencia.",
    clue: "Pais caribeno de criollo haitiano, kompa, griot y una historia profunda de independencia.",
    music: { tempo: 104, scale: [330, 392, 440, 523, 659], drum: "kompa" }
  },
  {
    id: "ecuador",
    name: "Ecuador",
    capital: "Quito",
    flag: "🇪🇨",
    flagImage: "assets/flags/ecuador.svg",
    region: "Suramerica",
    language: "Espanol y kichwa",
    greeting: "Imanalla / Hola",
    food: "Encebollado",
    rhythm: "Sanjuanito",
    celebration: "Inti Raymi",
    value: "La diversidad puede estar en una misma bandera: costa, sierra, Amazonia y Galapagos.",
    clue: "Pais atravesado por la linea ecuatorial, con sanjuanito, kichwa y encebollado.",
    music: { tempo: 108, scale: [262, 330, 392, 440, 523], drum: "sanjuanito" }
  },
  {
    id: "argentina",
    name: "Argentina",
    capital: "Buenos Aires",
    flag: "🇦🇷",
    flagImage: "assets/flags/argentina.svg",
    region: "Suramerica",
    language: "Espanol rioplatense",
    greeting: "Che, como andas?",
    food: "Empanadas",
    rhythm: "Tango / chacarera",
    celebration: "Dia de la Tradicion",
    value: "La identidad tambien se canta, se debate y se comparte en la mesa.",
    clue: "Pais del Cono Sur asociado con tango, mate, empanadas y una hinchada muy expresiva.",
    music: { tempo: 96, scale: [330, 392, 440, 523, 587], drum: "tango" }
  },
  {
    id: "paraguay",
    name: "Paraguay",
    capital: "Asuncion",
    flag: "🇵🇾",
    flagImage: "assets/flags/paraguay.svg",
    region: "Suramerica",
    language: "Espanol y guarani",
    greeting: "Mba'eichapa",
    food: "Sopa paraguaya",
    rhythm: "Polca paraguaya",
    celebration: "Fiesta de San Juan",
    value: "El bilingüismo cotidiano puede ser una fuerza de identidad compartida.",
    clue: "Pais bilingue donde el guarani esta muy presente en la vida diaria.",
    music: { tempo: 116, scale: [330, 392, 494, 587, 659], drum: "polca" }
  },
  {
    id: "uruguay",
    name: "Uruguay",
    capital: "Montevideo",
    flag: "🇺🇾",
    flagImage: "assets/flags/uruguay.svg",
    region: "Suramerica",
    language: "Espanol rioplatense",
    greeting: "Bo, como andas?",
    food: "Chivito",
    rhythm: "Candombe",
    celebration: "Llamadas",
    value: "La memoria afrodescendiente tambien construye identidad nacional.",
    clue: "Pais rioplatense de candombe, chivito, mate y carnaval de llamadas.",
    music: { tempo: 114, scale: [294, 349, 392, 466, 587], drum: "candombe" }
  }
];

const SCENARIOS = [
  {
    prompt: "Una persona nueva no entiende una broma local y queda incomoda. Cual accion demuestra mejor competencia intercultural?",
    options: [
      "Explicar el contexto sin burlarse, reconocer que el codigo no era compartido e invitarla a preguntar o compartir un codigo propio.",
      "Traducirle la broma rapidamente y seguir, para no ponerla en el centro de la atencion.",
      "Evitar hacer bromas durante toda la actividad, porque cualquier codigo local puede excluir."
    ],
    correct: 0
  },
  {
    prompt: "Alguien dice: 'ese acento suena chistoso, repitelo'. Que respuesta evita exotizar a la persona?",
    options: [
      "Pedirle que repita solo si tambien quiere ensenar palabras de su region.",
      "Nombrar que pedir repetir para divertir al grupo puede convertir su forma de hablar en burla, y cambiar la pregunta hacia significados o historias.",
      "Decir que todos tenemos acento y continuar sin hablar mas del tema."
    ],
    correct: 1
  },
  {
    prompt: "Un plato tradicional genera rechazo por su olor o aspecto. Que opcion respeta sin imponer gustos?",
    options: [
      "Probarlo aunque no se quiera, porque rechazarlo seria irrespetuoso.",
      "Decir con cuidado que no se desea probar y preguntar por su historia, preparacion y momentos en que se comparte.",
      "Retirarlo de la mesa para evitar comentarios incomodos."
    ],
    correct: 1
  },
  {
    prompt: "Dos integrantes discrepan sobre una practica religiosa o familiar. Que regla evita tanto el juicio moral como el 'todo vale'?",
    options: [
      "Cada quien explica el sentido de la practica, el grupo pregunta por contexto antes de opinar y nadie queda obligado a adoptarla.",
      "Todas las practicas deben aceptarse sin preguntas para demostrar tolerancia.",
      "El grupo vota cual postura parece mas moderna y esa queda como conclusion."
    ],
    correct: 0
  },
  {
    prompt: "Un integrante entiende el reto pero no quiere hablar en publico por inseguridad linguistica. Que solucion cuida participacion y autonomia?",
    options: [
      "Asignarle automaticamente el rol de dibujar para que no tenga que hablar.",
      "Preguntarle que rol prefiere asumir: escribir, decidir, dibujar, ensayar con alguien o hacer voceria compartida.",
      "Pedirle una frase corta obligatoria, porque todos deben participar igual."
    ],
    correct: 1
  },
  {
    prompt: "El equipo solo conoce un pais por noticias negativas o memes. Que pregunta reduce estereotipos sin negar problemas reales?",
    options: [
      "Que practica, palabra, fiesta o historia concreta podemos conocer, y que fuentes nos ayudan a no reducir el pais a un solo relato?",
      "Cual es el problema principal de ese pais y como afecta su cultura?",
      "Que cosas positivas tiene ese pais para equilibrar lo malo que se escucha?"
    ],
    correct: 0
  },
  {
    prompt: "Dos personas toman todas las decisiones porque quieren ganar rapido y dejan por fuera a quien sabe del tema. Que es fair play intercultural?",
    options: [
      "Mantener el ritmo y pedirle a esa persona que confirme al final para no perder tiempo.",
      "Pausar brevemente, redistribuir roles y hacer que la decision incluya a quien tenia conocimiento o experiencia relacionada.",
      "Anotar que hubo poca participacion y compensarlo en la siguiente actividad."
    ],
    correct: 1
  },
  {
    prompt: "Una celebracion ajena debe representarse en 10 segundos. Como evitar caricaturizarla?",
    options: [
      "Imitar lo mas visible para que el resto adivine rapido, si no hay mala intencion.",
      "Representar un valor o contexto de la celebracion, no rasgos exagerados de las personas que la practican.",
      "No representarla, porque cualquier representacion cultural puede ser irrespetuosa."
    ],
    correct: 1
  },
  {
    prompt: "Un grupo usa la bandera de un pais como chiste o castigo en el juego. Que intervencion es mas adecuada?",
    options: [
      "Recordar que los simbolos nacionales pueden tener valor afectivo y mover la dinamica hacia aprendizaje, no ridiculizacion.",
      "Permitirlo si ninguna persona de ese pais esta presente.",
      "Cambiar todas las banderas por nombres para evitar conflictos."
    ],
    correct: 0
  },
  {
    prompt: "Alguien afirma: 'interculturalidad es que todos se adapten a la cultura mayoritaria'. Cual respuesta corrige mejor?",
    options: [
      "Si, porque una cultura comun evita malentendidos.",
      "No: interculturalidad implica dialogo y ajustes mutuos, reconociendo diferencias de poder entre culturas.",
      "Depende: las minorias pueden conservar costumbres solo en espacios privados."
    ],
    correct: 1
  }
];
