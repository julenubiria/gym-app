/* Lógica y render de la subpestaña "Rutinas" (plantillas de entrenamiento) */

const Routines = (() => {
  let editingId = null;
  let editorExercises = []; // [{exerciseId, targetSets, targetReps}]

  function refreshExerciseSelect() {
    const sel = document.getElementById('routine-add-exercise-select');
    if (!sel) return;
    const exercises = Storage.getExercises().sort((a, b) => a.name.localeCompare(b.name));
    sel.innerHTML = exercises.map(e => `<option value="${e.id}">${e.name} (${e.group})</option>`).join('');
  }

  function renderList() {
    const container = document.getElementById('routines-list');
    const routines = Storage.getRoutines();
    const exercises = Storage.getExercises();
    if (routines.length === 0) {
      container.innerHTML = '<p class="hint">Todavía no has creado ninguna rutina. Crea una abajo.</p>';
      return;
    }
    container.innerHTML = routines.map(r => {
      const names = r.exercises.map(re => {
        const ex = exercises.find(x => x.id === re.exerciseId);
        return `${ex ? ex.name : '?'} (${re.targetSets}x${re.targetReps || '?'})`;
      }).join(', ');
      return `
        <div class="list-item">
          <div>
            <strong>${r.name}</strong>
            <div class="hint">${names}</div>
          </div>
          <div>
            <button class="btn small" onclick="Routines.start('${r.id}')">▶️ Iniciar</button>
            <button class="icon-btn" onclick="Routines.edit('${r.id}')">✏️</button>
            <button class="icon-btn" onclick="Routines.remove('${r.id}')">🗑️</button>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderEditor() {
    const container = document.getElementById('routine-editor-exercises');
    if (editorExercises.length === 0) {
      container.innerHTML = '<p class="hint">Añade ejercicios a la rutina con el selector de abajo.</p>';
      return;
    }
    const exercises = Storage.getExercises();
    container.innerHTML = editorExercises.map((re, idx) => {
      const ex = exercises.find(x => x.id === re.exerciseId);
      return `
        <div class="exercise-block">
          <div class="exercise-block-header">
            <strong>${ex ? ex.name : '?'}</strong>
            <button class="icon-btn" onclick="Routines.removeExercise(${idx})">Quitar ✕</button>
          </div>
          <div class="form-row inline">
            <label>Series objetivo <input type="number" min="1" style="width:70px" value="${re.targetSets}"
              onchange="Routines.updateField(${idx}, 'targetSets', this.value)"></label>
            <label>Reps objetivo <input type="text" style="width:90px" placeholder="ej: 8-10" value="${re.targetReps || ''}"
              onchange="Routines.updateField(${idx}, 'targetReps', this.value)"></label>
          </div>
        </div>
      `;
    }).join('');
  }

  function addExercise() {
    const sel = document.getElementById('routine-add-exercise-select');
    const exerciseId = sel.value;
    if (!exerciseId) return;
    if (editorExercises.some(e => e.exerciseId === exerciseId)) {
      alert('Ese ejercicio ya está en la rutina.');
      return;
    }
    editorExercises.push({ exerciseId, targetSets: 3, targetReps: '8-10' });
    renderEditor();
  }

  function removeExercise(idx) {
    editorExercises.splice(idx, 1);
    renderEditor();
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
    document.getElementById('routine-add-exercise-btn').addEventListener('click', addExercise);
    document.getElementById('save-routine-btn').addEventListener('click', save);
    document.getElementById('cancel-routine-edit-btn').addEventListener('click', resetEditor);
  }

  function init() {
    bindEvents();
    refreshExerciseSelect();
    renderList();
    renderEditor();
  }

  return {
    init, renderList, refreshExerciseSelect, addExercise, removeExercise, updateField,
    save, edit, remove, start,
  };
})();
