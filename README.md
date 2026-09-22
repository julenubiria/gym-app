# Mi Gym App

App personal (100% local) para:

- **Entrenamiento**: base de datos con 135 ejercicios (grupo muscular + material) tipo Hevy/Strong. Puedes crear tus propios ejercicios en cualquier momento. Crea **rutinas** (plantillas) con series/reps objetivo por ejercicio, e "Inicia" una rutina para precargar la sesión (con el peso que usaste la última vez). Historial de sesiones y gráficas de progreso (1RM estimada y volumen) por ejercicio.
- **Nutrición**: busca alimentos en tu base local (Mercadona/Lidl precargados) **y en Open Food Facts** (base de datos real y enorme, con cientos de miles de productos) en el mismo buscador. Cada producto de Open Food Facts que uses se guarda en tu dispositivo, así que la próxima vez ya está disponible sin conexión. Registro diario por comida con objetivos de macros.

## Cómo usarla en el ordenador

Abre [index.html](index.html) haciendo doble clic. Todos tus datos (entrenamientos, rutinas, alimentos, registros) se guardan **solo en este navegador, en este dispositivo** (localStorage) — nunca se envían a ningún sitio. Solo la búsqueda de alimentos hace una consulta a Open Food Facts (sus servidores no reciben nada tuyo aparte del texto que buscas).

Hay un botón **Exportar datos** en Ajustes para hacer copias de seguridad o pasar los datos a otro dispositivo.

## Notas sobre los datos nutricionales precargados

Los productos de Mercadona/Lidl que vienen precargados de fábrica son valores de referencia aproximados. Los que añadas buscando en Open Food Facts son datos reales de su base de datos colaborativa (pueden tener algún error si el producto está mal etiquetado por otro usuario, como en cualquier base de datos colaborativa).

## Cómo tenerla en el móvil (PWA instalable)

Para que el móvil pueda "instalarla" de verdad (icono propio, pantalla completa, funciona sin conexión) el navegador exige que la página se sirva por **HTTPS** — abrir el archivo directamente o servirla solo en tu red local por `http://` no es suficiente para que Chrome/Android ofrezca instalarla ni para que el modo offline funcione en el móvil.

La forma más sencilla y gratuita es publicar esta carpeta como página estática en un servicio con HTTPS (por ejemplo **GitHub Pages**). Sigue siendo 100% "local" en el sentido de tus datos: solo se publican los archivos de la app (HTML/CSS/JS), no hay servidor ni base de datos — tus entrenamientos y comidas se siguen quedando únicamente en el navegador de tu móvil.

Pasos con GitHub Pages (gratis):
1. Crear un repositorio en GitHub y subir esta carpeta.
2. En el repositorio: Settings → Pages → Deploy from branch → main.
3. GitHub te da una URL tipo `https://tuusuario.github.io/gym-app/`.
4. Abre esa URL desde el navegador del móvil (Chrome) → menú → "Añadir a pantalla de inicio" / "Instalar app".

Si prefieres no usar GitHub, cualquier otro hosting estático gratuito con HTTPS (Cloudflare Pages, Netlify) sirve igual: solo hay que subir la carpeta tal cual, no hace falta build ni backend.

## Probar en el PC con un servidor local

```bash
cd gym-app
python -m http.server 8080
```

Y abrir `http://localhost:8080` (en el propio PC, `localhost` sí cuenta como seguro, así que ahí puedes probar el modo offline y la instalación como app de escritorio en Chrome/Edge).
