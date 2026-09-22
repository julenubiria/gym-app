/* Lógica y render de la subpestaña "Rutinas" (plantillas de entrenamiento) */

const Routines = (() => {
  let editingId = null;
  let editorExercises = []; // [{exerciseId, targetSets, targetReps}]
  let picker = null;

  function mountPicker() {
    const container = document.getElementById('routine-exercise-picker');
    picker = ExercisePicker.mount(container, {
      placeholder: 'Buscar ejercicio para añadir a la rutina...',
      excludeIds: () => editorExercises.map(e => e.exerciseId),
      onSelect: (ex) => addExercise(ex.id),
      onCreate: (name) => {
        const ex = Storage.addExercise(name, 'Otro', 'Otro');
        addExercise(ex.id);
        if (typeof Workouts !== 'undefined') Workouts.renderStartFromRoutineSelect();
      },
    });
  }

  function refreshPicker() {
    if (picker) picker.refresh();
  }

  function renderList() {
    const container = document.getElementById('routines-list');
    const routines = Storage.getRoutines();
    const exercises = Storage.getExercises();
    if (routines.length === 0) {
      container.innerHTML = '<p class="hint empty-hint">Todavía no has creado ninguna rutina. Crea una abajo.</p>';
      return;
    }
    container.innerHTML = routines.map(r => {
      const avatars = r.exercises.slice(0, 6).map(re => {
        const ex = exercises.find(x => x.id === re.exerciseId);
        return exerciseAvatarHtml(ex ? ex.group : 'Otro', 'sm');
      }).join('');
      const names = r.exercises.map(re => {
        const ex = exercises.find(x => x.id === re.exerciseId);
        return `${ex ? ex.name : '?'} (${re.targetSets}×${re.targetReps || '?'})`;
      }).join(', ');
      return `
        <div class="panel session-card">
          <div class="session-card-header">
            <div>
              <strong class="session-name">${r.name}</strong>
              <div class="hint">${names}</div>
            </div>
          </div>
          <div class="routine-avatars">${avatars}</div>
          <div class="routine-actions">
            <button class="btn small primary" onclick="Routines.start('${r.id}')">▶️ Iniciar</button>
            <button class="btn small ghost" onclick="Routines.edit('${r.id}')">✏️ Editar</button>
            <button class="btn small ghost" onclick="Routines.remove('${r.id}')">🗑️ Eliminar</button>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderEditor() {
    const container = document.getElementById('routine-editor-exercises');
    if (editorExercises.length === 0) {
      container.innerHTML = '<p class="hint empty-hint">Añade ejercicios a la rutina buscando abajo.</p>';
      return;
    }
    const exercises = Storage.getExercises();
    container.innerHTML = editorExercises.map((re, idx) => {
      const ex = exercises.find(x => x.id === re.exerciseId);
      return `
        <div class="panel exercise-card">
          <div class="exercise-card-header">
            ${exerciseAvatarHtml(ex ? ex.group : 'Otro')}
            <div class="exercise-card-title"><strong>${ex ? ex.name : '?'}</strong></div>
            <button class="icon-btn" onclick="Routines.removeExercise(${idx})">✕</button>
          </div>
          <div class="form-row inline">
            <label>Series <input type="number" min="1" style="width:70px" value="${re.targetSets}"
              onchange="Routines.updateField(${idx}, 'targetSets', this.value)"></label>
            <label>Reps objetivo <input type="text" style="width:90px" placeholder="ej: 8-10" value="${re.targetReps || ''}"
              onchange="Routines.updateField(${idx}, 'targetReps', this.value)"></label>
          </div>
        </div>
      `;
    }).join('');
  }

  function addExercise(exerciseId) {
    if (editorExercises.some(e => e.exerciseId === exerciseId)) return;
    editorExercises.push({ exerciseId, targetSets: 3, targetReps: '8-10' });
    renderEditor();
    if (picker) picker.refresh();
  }

  function removeExercise(idx) {
    editorExercises.splice(idx, 1);
    renderEditor();
    if (picker) picker.refresh();
  }

  function updateField(idx, field, value) {
    editorExercises[idx][field] = field === 'targetSets' ? (Number(value) || 1) : value;
  }

  function resetEditor() {
    editingId = null;
    editorExercises = [];
    document.getElementById('routine-name').value = '';
    document.getElementById('routine-editor-title').textContent = 'Nueva rutina';
    document.getElementById('cancel-routine-edit-btn').style.display = 'none';
    renderEditor();
    if (picker) picker.refresh();
  }

  function save() {
    const name = document.getElementById('routine-name').value.trim();
    const msg = document.getElementById('save-routine-msg');
    if (!name) {
      msg.textContent = 'Ponle un nombre a la rutina.';
      msg.className = 'msg error';
      return;
    }
    if (editorExercises.length === 0) {
      msg.textContent = 'Añade al menos un ejercicio.';
      msg.className = 'msg error';
      return;
    }
    if (editingId) {
      Storage.updateRoutine({ id: editingId, name, exercises: editorExercises });
    } else {
      Storage.addRoutine({ name, exercises: editorExercises });
    }
    msg.textContent = '¡Rutina guardada!';
    msg.className = 'msg success';
    setTimeout(() => { msg.textContent = ''; }, 2000);
    resetEditor();
    renderList();
    Workouts.renderStartFromRoutineSelect();
  }

  function edit(id) {
    const routine = Storage.getRoutines().find(r => r.id === id);
    if (!routine) return;
    editingId = id;
    editorExercises = routine.exercises.map(e => ({ ...e }));
    document.getElementById('routine-name').value = routine.name;
    document.getElementById('routine-editor-title').textContent = 'Editar rutina';
    document.getElementById('cancel-routine-edit-btn').style.display = 'inline-block';
    renderEditor();
    if (picker) picker.refresh();
    document.getElementById('routine-name').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function remove(id) {
    if (!confirm('¿Eliminar esta rutina?')) return;
    Storage.deleteRoutine(id);
    renderList();
    Workouts.renderStartFromRoutineSelect();
  }

  function start(id) {
    const routine = Storage.getRoutines().find(r => r.id === id);
    if (!routine) return;
    App.switchTab('workouts');
    App.switchWorkoutsSubtab('log');
    Workouts.startFromRoutine(routine);
  }

  function bindEvents() {
    document.getElementById('save-routine-btn').addEventListener('click', save);
    document.getElementById('cancel-routine-edit-btn').addEventListener('click', resetEditor);
  }

  function init() {
    bindEvents();
    mountPicker();
    renderList();
    renderEditor();
  }

  return {
    init, renderList, refreshPicker, addExercise, removeExercise, updateField,
    save, edit, remove, start,
  };
})();
