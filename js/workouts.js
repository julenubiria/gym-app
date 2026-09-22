/* Lógica y render de la pestaña Entrenamiento */

const MUSCLE_GROUPS = ['Pecho', 'Espalda', 'Hombro', 'Bíceps', 'Tríceps', 'Pierna', 'Core', 'Antebrazo', 'Full Body', 'Cardio', 'Otro'];
const EQUIPMENT_TYPES = ['Barra', 'Mancuernas', 'Máquina', 'Polea', 'Peso corporal', 'Smith', 'Kettlebell', 'Banda elástica', 'Cardio', 'Otro'];

const Workouts = (() => {
  let currentSessionExercises = []; // [{exerciseId, sets: [{weight, reps, rpe}]}]

  function todayStr() {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  }

  function epley1RM(weight, reps) {
    if (!weight || !reps) return 0;
    return Math.round(weight * (1 + reps / 30) * 10) / 10;
  }

  function fillSelectOptions(sel, options) {
    sel.innerHTML = options.map(o => `<option value="${o}">${o}</option>`).join('');
  }

  function initLogForm() {
    document.getElementById('workout-date').value = todayStr();
    currentSessionExercises = [];
    renderExerciseSelect();
    renderCurrentSession();
    renderStartFromRoutineSelect();
    fillSelectOptions(document.getElementById('inline-ex-group'), MUSCLE_GROUPS);
    fillSelectOptions(document.getElementById('inline-ex-equipment'), EQUIPMENT_TYPES);
  }

  function renderExerciseSelect() {
    const sel = document.getElementById('add-exercise-select');
    const exercises = Storage.getExercises().sort((a, b) => a.name.localeCompare(b.name));
    sel.innerHTML = exercises.map(e => `<option value="${e.id}">${e.name} (${e.group})</option>`).join('');
  }

  function renderStartFromRoutineSelect() {
    const sel = document.getElementById('start-from-routine-select');
    const routines = Storage.getRoutines();
    sel.innerHTML = '<option value="">— Empezar desde una rutina —</option>' +
      routines.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
  }

  // Devuelve los últimos sets realizados para un ejercicio (para pre-rellenar "peso previo")
  function getLastPerformance(exerciseId) {
    const workouts = Storage.getWorkouts(); // ya viene ordenado por fecha desc
    for (const w of workouts) {
      const entry = w.entries.find(e => e.exerciseId === exerciseId);
      if (entry && entry.sets.length) return entry.sets;
    }
    return null;
  }

  function startFromRoutine(routine) {
    currentSessionExercises = routine.exercises.map(re => {
      const last = getLastPerformance(re.exerciseId);
      const targetSets = re.targetSets || 1;
      const sets = [];
      for (let i = 0; i < targetSets; i++) {
        const src = last ? (last[i] || last[last.length - 1]) : null;
        sets.push({ weight: src ? src.weight : '', reps: src ? src.reps : '', rpe: '' });
      }
      return { exerciseId: re.exerciseId, sets };
    });
    document.getElementById('workout-name').value = routine.name;
    renderCurrentSession();
  }

  function renderCurrentSession() {
    const container = document.getElementById('current-session-exercises');
    if (currentSessionExercises.length === 0) {
      container.innerHTML = '<p class="hint">Añade ejercicios a la sesión con el selector de abajo, o carga una rutina.</p>';
      return;
    }
    const exercises = Storage.getExercises();
    container.innerHTML = currentSessionExercises.map((entry, exIdx) => {
      const ex = exercises.find(e => e.id === entry.exerciseId);
      const setsHtml = entry.sets.map((s, setIdx) => `
        <div class="set-row">
          <span class="set-num">#${setIdx + 1}</span>
          <input type="number" step="0.5" min="0" placeholder="kg" value="${s.weight ?? ''}"
            onchange="Workouts.updateSet(${exIdx}, ${setIdx}, 'weight', this.value)">
          <input type="number" step="1" min="0" placeholder="reps" value="${s.reps ?? ''}"
            onchange="Workouts.updateSet(${exIdx}, ${setIdx}, 'reps', this.value)">
          <input type="number" step="0.5" min="0" max="10" placeholder="RPE" value="${s.rpe ?? ''}"
            onchange="Workouts.updateSet(${exIdx}, ${setIdx}, 'rpe', this.value)">
          <button class="icon-btn" onclick="Workouts.removeSet(${exIdx}, ${setIdx})">✕</button>
        </div>
      `).join('');
      return `
        <div class="exercise-block">
          <div class="exercise-block-header">
            <strong>${ex ? ex.name : 'Ejercicio eliminado'}</strong> ${ex ? '<span class="tag">' + ex.equipment + '</span>' : ''}
            <button class="icon-btn" onclick="Workouts.removeExerciseFromSession(${exIdx})">Quitar ejercicio ✕</button>
          </div>
          <div class="set-row set-row-header">
            <span></span><span>Peso (kg)</span><span>Reps</span><span>RPE</span><span></span>
          </div>
          ${setsHtml}
          <button class="btn small" onclick="Workouts.addSet(${exIdx})">+ Añadir serie</button>
        </div>
      `;
    }).join('');
  }

  function addExerciseToSession(exerciseId) {
    if (!exerciseId) return;
    if (currentSessionExercises.some(e => e.exerciseId === exerciseId)) {
      alert('Ese ejercicio ya está en la sesión.');
      return;
    }
    const last = getLastPerformance(exerciseId);
    const src = last ? last[0] : null;
    currentSessionExercises.push({ exerciseId, sets: [{ weight: src ? src.weight : '', reps: src ? src.reps : '', rpe: '' }] });
    renderCurrentSession();
  }

  function addSet(exIdx) {
    const prevSet = currentSessionExercises[exIdx].sets.at(-1);
    currentSessionExercises[exIdx].sets.push({
      weight: prevSet ? prevSet.weight : '',
      reps: prevSet ? prevSet.reps : '',
      rpe: '',
    });
    renderCurrentSession();
  }

  function removeSet(exIdx, setIdx) {
    currentSessionExercises[exIdx].sets.splice(setIdx, 1);
    if (currentSessionExercises[exIdx].sets.length === 0) {
      currentSessionExercises.splice(exIdx, 1);
    }
    renderCurrentSession();
  }

  function removeExerciseFromSession(exIdx) {
    currentSessionExercises.splice(exIdx, 1);
    renderCurrentSession();
  }

  function updateSet(exIdx, setIdx, field, value) {
    currentSessionExercises[exIdx].sets[setIdx][field] = value === '' ? '' : Number(value);
  }

  function saveCurrentWorkout() {
    const date = document.getElementById('workout-date').value || todayStr();
    const name = document.getElementById('workout-name').value.trim();
    const msg = document.getElementById('save-workout-msg');

    const cleanEntries = currentSessionExercises
      .map(entry => ({
        exerciseId: entry.exerciseId,
        sets: entry.sets.filter(s => s.weight !== '' && s.reps !== ''),
      }))
      .filter(entry => entry.sets.length > 0);

    if (cleanEntries.length === 0) {
      msg.textContent = 'Añade al menos una serie con peso y repeticiones.';
      msg.className = 'msg error';
      return;
    }

    Storage.addWorkout({ date, name, entries: cleanEntries });
    msg.textContent = '¡Sesión guardada!';
    msg.className = 'msg success';
    initLogForm();
    document.getElementById('workout-name').value = '';
    setTimeout(() => { msg.textContent = ''; }, 2500);
    App.refreshDashboard();
  }

  function renderHistory() {
    const container = document.getElementById('workout-history-list');
    const workouts = Storage.getWorkouts();
    const exercises = Storage.getExercises();
    if (workouts.length === 0) {
      container.innerHTML = '<p class="hint">Aún no has registrado ninguna sesión.</p>';
      return;
    }
    container.innerHTML = workouts.map(w => {
      const totalSets = w.entries.reduce((sum, e) => sum + e.sets.length, 0);
      const volume = w.entries.reduce((sum, e) => sum + e.sets.reduce((s2, s) => s2 + s.weight * s.reps, 0), 0);
      const exNames = w.entries.map(e => {
        const ex = exercises.find(x => x.id === e.exerciseId);
        return ex ? ex.name : '?';
      }).join(', ');
      return `
        <div class="list-item">
          <div>
            <strong>${w.date}</strong> ${w.name ? '· ' + w.name : ''}
            <div class="hint">${exNames}</div>
            <div class="hint">${totalSets} series · volumen ${Math.round(volume)} kg</div>
          </div>
          <button class="icon-btn" onclick="Workouts.deleteWorkout('${w.id}')">🗑️</button>
        </div>
      `;
    }).join('');
  }

  function deleteWorkout(id) {
    if (!confirm('¿Eliminar esta sesión?')) return;
    Storage.deleteWorkout(id);
    renderHistory();
    App.refreshDashboard();
  }

  let progressChart = null;

  function renderProgressExerciseSelect() {
    const sel = document.getElementById('progress-exercise-select');
    const exercises = Storage.getExercises().sort((a, b) => a.name.localeCompare(b.name));
    const prevVal = sel.value;
    sel.innerHTML = exercises.map(e => `<option value="${e.id}">${e.name}</option>`).join('');
    if (prevVal) sel.value = prevVal;
    renderProgress();
  }

  function renderProgress() {
    const sel = document.getElementById('progress-exercise-select');
    const exerciseId = sel.value;
    const workouts = Storage.getWorkouts().slice().sort((a, b) => a.date.localeCompare(b.date));

    const points = [];
    workouts.forEach(w => {
      const entry = w.entries.find(e => e.exerciseId === exerciseId);
      if (!entry) return;
      const bestSet = entry.sets.reduce((best, s) => {
        const est = epley1RM(s.weight, s.reps);
        return est > (best.est || 0) ? { ...s, est } : best;
      }, {});
      const volume = entry.sets.reduce((sum, s) => sum + s.weight * s.reps, 0);
      const maxWeight = Math.max(...entry.sets.map(s => s.weight));
      points.push({ date: w.date, est1rm: bestSet.est || 0, maxWeight, volume });
    });

    const statsContainer = document.getElementById('progress-stats');
    if (points.length === 0) {
      statsContainer.innerHTML = '<p class="hint">Sin datos todavía para este ejercicio.</p>';
    } else {
      const last = points.at(-1);
      const first = points[0];
      const diff = Math.round((last.est1rm - first.est1rm) * 10) / 10;
      statsContainer.innerHTML = `
        <div class="stat-box"><span class="stat-label">Última 1RM est.</span><span class="stat-value">${last.est1rm} kg</span></div>
        <div class="stat-box"><span class="stat-label">Peso máx. última sesión</span><span class="stat-value">${last.maxWeight} kg</span></div>
        <div class="stat-box"><span class="stat-label">Volumen última sesión</span><span class="stat-value">${Math.round(last.volume)} kg</span></div>
        <div class="stat-box"><span class="stat-label">Progreso 1RM (total)</span><span class="stat-value ${diff >= 0 ? 'pos' : 'neg'}">${diff >= 0 ? '+' : ''}${diff} kg</span></div>
      `;
    }

    const ctx = document.getElementById('progress-chart').getContext('2d');
    if (progressChart) progressChart.destroy();
    progressChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: points.map(p => p.date),
        datasets: [
          {
            label: '1RM estimada (kg)',
            data: points.map(p => p.est1rm),
            borderColor: '#7c9eff',
            backgroundColor: '#7c9eff33',
            tension: 0.25,
            yAxisID: 'y',
          },
          {
            label: 'Volumen sesión (kg)',
            data: points.map(p => p.volume),
            borderColor: '#5ddac0',
            backgroundColor: '#5ddac033',
            tension: 0.25,
            yAxisID: 'y1',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
          y: { position: 'left', title: { display: true, text: 'kg (1RM est.)' } },
          y1: { position: 'right', title: { display: true, text: 'Volumen (kg)' }, grid: { drawOnChartArea: false } },
        },
        plugins: { legend: { labels: { color: '#c9cdd6' } } },
      },
    });
  }

  function renderExerciseFilterSelects() {
    fillSelectOptions(document.getElementById('new-exercise-group'), MUSCLE_GROUPS);
    fillSelectOptions(document.getElementById('new-exercise-equipment'), EQUIPMENT_TYPES);
    const groupSel = document.getElementById('exercise-list-group-filter');
    const equipSel = document.getElementById('exercise-list-equipment-filter');
    groupSel.innerHTML = '<option value="">Todos los grupos</option>' + MUSCLE_GROUPS.map(g => `<option value="${g}">${g}</option>`).join('');
    equipSel.innerHTML = '<option value="">Todo el material</option>' + EQUIPMENT_TYPES.map(e => `<option value="${e}">${e}</option>`).join('');
  }

  function renderExerciseList() {
    const container = document.getElementById('exercise-list');
    const search = document.getElementById('exercise-list-search').value.trim().toLowerCase();
    const groupFilter = document.getElementById('exercise-list-group-filter').value;
    const equipFilter = document.getElementById('exercise-list-equipment-filter').value;

    let exercises = Storage.getExercises();
    if (search) exercises = exercises.filter(e => e.name.toLowerCase().includes(search));
    if (groupFilter) exercises = exercises.filter(e => e.group === groupFilter);
    if (equipFilter) exercises = exercises.filter(e => e.equipment === equipFilter);
    exercises = exercises.sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name));

    container.innerHTML = exercises.map(e => `
      <div class="list-item">
        <div><strong>${e.name}</strong> <span class="tag">${e.group}</span> <span class="tag store">${e.equipment || 'Otro'}</span></div>
        <button class="icon-btn" onclick="Workouts.removeExercise('${e.id}')">🗑️</button>
      </div>
    `).join('') || '<p class="hint">Sin resultados.</p>';
  }

  function addExercise(name, group, equipment) {
    const ex = Storage.addExercise(name, group, equipment);
    renderExerciseList();
    renderExerciseSelect();
    renderProgressExerciseSelect();
    if (typeof Routines !== 'undefined') Routines.refreshExerciseSelect();
    return ex;
  }

  function addExerciseFromForm() {
    const nameInput = document.getElementById('new-exercise-name');
    const groupSelect = document.getElementById('new-exercise-group');
    const equipSelect = document.getElementById('new-exercise-equipment');
    const name = nameInput.value.trim();
    if (!name) return;
    addExercise(name, groupSelect.value, equipSelect.value);
    nameInput.value = '';
  }

  function removeExercise(id) {
    if (!confirm('¿Eliminar este ejercicio? No se borrará el historial de sesiones ya guardadas.')) return;
    Storage.deleteExercise(id);
    renderExerciseList();
    renderExerciseSelect();
    renderProgressExerciseSelect();
  }

  function toggleInlineNewExercise() {
    const box = document.getElementById('inline-new-exercise');
    box.style.display = box.style.display === 'none' ? 'grid' : 'none';
  }

  function saveInlineNewExercise() {
    const name = document.getElementById('inline-ex-name').value.trim();
    if (!name) return;
    const group = document.getElementById('inline-ex-group').value;
    const equipment = document.getElementById('inline-ex-equipment').value;
    const ex = addExercise(name, group, equipment);
    document.getElementById('inline-ex-name').value = '';
    document.getElementById('inline-new-exercise').style.display = 'none';
    addExerciseToSession(ex.id);
  }

  function bindEvents() {
    document.getElementById('add-exercise-btn').addEventListener('click', () => {
      addExerciseToSession(document.getElementById('add-exercise-select').value);
    });
    document.getElementById('save-workout-btn').addEventListener('click', saveCurrentWorkout);
    document.getElementById('add-new-exercise-btn').addEventListener('click', addExerciseFromForm);
    document.getElementById('progress-exercise-select').addEventListener('change', renderProgress);
    document.getElementById('start-from-routine-btn').addEventListener('click', () => {
      const id = document.getElementById('start-from-routine-select').value;
      if (!id) return;
      const routine = Storage.getRoutines().find(r => r.id === id);
      if (routine) startFromRoutine(routine);
    });
    document.getElementById('toggle-new-exercise-btn').addEventListener('click', toggleInlineNewExercise);
    document.getElementById('inline-ex-save-btn').addEventListener('click', saveInlineNewExercise);
    document.getElementById('exercise-list-search').addEventListener('input', renderExerciseList);
    document.getElementById('exercise-list-group-filter').addEventListener('change', renderExerciseList);
    document.getElementById('exercise-list-equipment-filter').addEventListener('change', renderExerciseList);
  }

  function init() {
    renderExerciseFilterSelects();
    bindEvents();
    initLogForm();
    renderHistory();
    renderProgressExerciseSelect();
    renderExerciseList();
  }

  return {
    init, initLogForm, renderHistory, renderProgress, renderProgressExerciseSelect, renderExerciseList,
    renderExerciseSelect, renderStartFromRoutineSelect, startFromRoutine, getLastPerformance,
    addSet, removeSet, removeExerciseFromSession, updateSet, deleteWorkout, removeExercise, addExerciseToSession,
    epley1RM,
  };
})();
