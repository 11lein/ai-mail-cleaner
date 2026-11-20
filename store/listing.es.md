# Ficha de la tienda (Español)

## Nombre
AI Mail Cleaner

## Resumen (máx. 250 caracteres)
Ayuda a ordenar un buzón lleno: cada correo recibe una puntuación de spam de 0 a 100 %, los boletines se pueden cancelar desde ahí mismo y lo que sobra va a la papelera de una vez. Funciona con modelos en la nube o en local.

## Descripción

Hice este complemento para ordenar mi propio buzón. Como a mí me sirve, lo comparto aquí por si
a ti también te resulta útil.

Lo que me molestaba: boletines que nunca cancelé, publicidad y spam que se coló por el filtro.
Revisar todo eso correo a correo lleva una eternidad. Ahora un modelo hace la primera pasada y yo
solo decido.

**Cómo funciona**

Eliges una carpeta y el complemento muestra todos sus correos en una lista. Al pulsar «Analizar»
envía el remitente, el asunto y, si quieres, un extracto corto de cada correo a un modelo, que
devuelve una puntuación de spam de 0 a 100 %. Luego filtras, por ejemplo, por «Spam ≥ 80 %», le
echas un vistazo y lo mandas todo a la papelera. Si te equivocas, puedes deshacerlo.

Los boletines se reconocen por la cabecera List-Unsubscribe o por el aviso de baja en el texto.
Al hacer clic en la etiqueta «Boletín» se abre un pequeño diálogo: darse de baja en la web o por
correo y, si quieres, mover también a la papelera todos los correos anteriores de ese boletín. Si
el correo parece spam, el complemento desaconseja darse de baja, porque eso suele confirmar
solamente que tu dirección existe.

**¿Qué modelo?**

Yo uso Jev a través de OpenRouter: es rápido y cuesta una fracción de céntimo por correo.
Span-01-lite es gratuito, pero solo procesa unos 20 correos por minuto. Si prefieres no enviar
ningún correo fuera, todo puede funcionar en local con Ollaya, LM Studio u Ollama. Los modelos de
lenguaje normales de OpenAI, Mistral, Groq y otros también sirven.

Si quieres, el modelo recibe además algo de contexto: si el remitente está en tu libreta de
direcciones, cuántos correos suyos hay en la carpeta y cuántos abriste. Eso ayuda con correos que
por sí solos parecen inofensivos, pero vienen de alguien a quien nunca lees.

**Además**
- grupos por dominio o remitente; seleccionar o borrar grupos enteros
- filtros por periodo y solo boletines, además de una búsqueda
- los remitentes y dominios de confianza nunca se evalúan ni se envían
- vista previa sin imágenes externas ni rastreadores
- selector de modelos con precio y coste estimado por cada 1000 correos
- mover a carpetas, atajos de teclado, modo claro y oscuro
- inglés, alemán y español

**Privacidad**

No hay ningún servidor mío de por medio, ni telemetría, ni publicidad. Los datos solo salen de tu
ordenador al analizar, y solo hacia el proveedor que tú configuraste. Con un modelo local no sale
nada. Nunca se borra nada de forma definitiva: todo va a la papelera.

El código fuente es abierto (licencia MIT) y está en GitHub. Agradezco los avisos de errores y las
ideas.

## Categoría
Message and News Reading (alternativa: Privacy and Security)

## Etiquetas
spam, limpieza, boletines, darse de baja, ia, ollaya, ollama, openrouter

## Licencia
MIT
