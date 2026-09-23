# Julen Gym App

App personal de entrenamiento (100% local, sin cuentas ni servidor), inspirada en Hevy/Strong:

- **135 ejercicios** precargados con grupo muscular + material, y puedes crear los tuyos en cualquier momento (también sobre la marcha, buscando y pulsando "Crear").
- **Buscador de ejercicios**: escribe para buscar y filtra por grupo muscular con chips, tanto al registrar una sesión como al montar una rutina o ver tu progreso.
- **Rutinas**: crea plantillas con series/reps objetivo por ejercicio. Al "Iniciar" una rutina se precarga la sesión con el peso que usaste la última vez.
- **Historial** con tarjetas de sesión: duración, volumen total, series y **récords (PRs)** — se marca automáticamente cuando superas tu mejor 1RM estimada anterior en un ejercicio.
- **Progreso por ejercicio**: gráfica de 1RM estimada y volumen a lo largo del tiempo.
- **Dashboard**: racha de días seguidos entrenando, mapa de actividad de las últimas 4 semanas, y tus últimas sesiones.

## Cómo usarla en el ordenador

Abre [index.html](index.html) haciendo doble clic. Todos tus datos (ejercicios, rutinas, sesiones) se guardan **solo en este dispositivo** (localStorage) — nunca se envían a ningún sitio.

Hay un botón **Exportar datos** en Ajustes para hacer copias de seguridad o pasar los datos a otro dispositivo.

## En el móvil

La app está publicada como PWA instalable en:

**https://julenubiria.github.io/gym-app/**

Ábrela en Chrome desde tu Android → menú (⋮) → "Instalar app" / "Añadir a pantalla de inicio". Queda con icono propio, pantalla completa, y funciona sin conexión.

Para publicar cambios nuevos, solo hay que hacer `git push` a este mismo repositorio de GitHub; Pages se actualiza sola en 1-2 minutos.

## Probar en el PC con un servidor local

```bash
cd gym-app
python -m http.server 8080
```

Y abrir `http://localhost:8080`.
