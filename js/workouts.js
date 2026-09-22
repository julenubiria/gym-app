/* Lógica y render de la pestaña Entrenamiento */

const MUSCLE_GROUPS = ['Pecho', 'Espalda', 'Hombro', 'Bíceps', 'Tríceps', 'Pierna', 'Core', 'Antebrazo', 'Full Body', 'Cardio', 'Otro'];
const EQUIPMENT_TYPES = ['Barra', 'Mancuernas', 'Máquina', 'Polea', 'Peso corporal', 'Smith', 'Kettlebell', 'Banda elástica', 'Cardio', 'Otro'];

const Workouts = (() => {
  let currentSessionExercises = []; // [{exerciseId, sets: [{weight, reps, rpe}]}]
  let sessionStartAt = null;
  let logExercisePicker = null;
  let progressExerciseId = null;
  let progressPicker = null;

  function todayStr() {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  }

  function epley1RM(weight, reps) {
    if (!weight || !reps) return 0;
    return Math.round(weight * (1 + reps / 30) * 10) / 10;
  }

  function formatDuration(min) {
    if (!min || min < 1) return null;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h > 0 ? `${h}h ${m}min` : `${m}min`;
  }

  function fillSelectOptions(sel, options) {
    sel.innerHTML = options.map(o => `<option value="${o}">${o}</option>`).join('');
  }

  function initLogForm() {
    document.getElementById('workout-date').value = todayStr();
    currentSessionExercises = [];
    sessionStartAt = null;
    renderCurrentSession();
    renderStartFromRoutineSelect();
    fillSelectOptions(document.getElementById('inline-ex-group'), MUSCLE_GROUPS);
    fillSelectOptions(document.getElementById('inline-ex-equipment'), EQUIPMENT_TYPES);
    mountLogExercisePicker();
  }

  function mountLogExercisePicker() {
    const container = document.getElementById('log-exercise-picker');
    logExercisePicker = ExercisePicker.mount(container, {
      placeholder: 'Buscar ejercicio para añadir...',
      excludeIds: () => currentSessionExercises.map(e => e.exerciseId),
      onSelect: (ex) => addExerciseToSession(ex.id),
      onCreate: (name) => {
        document.getElementById('inline-ex-name').value = name;
        document.getElementById('inline-new-exercise').style.display = 'grid';
        document.getElementById('inline-ex-name').focus();
      },
    });
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
    if (!sessionStartAt) sessionStartAt = Date.now();
    document.getElementById('workout-name').value = routine.name;
    renderCurrentSession();
    if (logExercisePicker) logExercisePicker.refresh();
  }

  function renderCurrentSession() {
    const container = document.getElementById('current-session-exercises');
    if (currentSessionExercises.length === 0) {
      container.innerHTML = '<p class="hint empty-hint">Añade tu primer ejercicio abajo, o carga una rutina.</p>';
      return;
    }
    const exercises = Storage.getExercises();
    container.innerHTML = currentSessionExercises.map((entry, exIdx) => {
      const ex = exercises.find(e => e.id === entry.exerciseId);
      const setsHtml = entry.sets.map((s, setIdx) => `
        <div class="set-row">
          <span class="set-num">${setIdx + 1}</span>
          <input type="number" step="0.5" min="0" inputmode="decimal" placeholder="kg" value="${s.weight ?? ''}"
            onchange="Workouts.updateSet(${exIdx}, ${setIdx}, 'weight', this.value)">
          <input type="number" step="1" min="0" inputmode="numeric" placeholder="reps" value="${s.reps ?? ''}"
            onchange="Workouts.updateSet(${exIdx}, ${setIdx}, 'reps', this.value)">
          <input type="number" step="0.5" min="0" max="10" inputmode="decimal" placeholder="RPE" value="${s.rpe ?? ''}"
            onchange="Workouts.updateSet(${exIdx}, ${setIdx}, 'rpe', this.value)">
          <button class="icon-btn" onclick="Workouts.removeSet(${exIdx}, ${setIdx})">✕</button>
        </div>
      `).join('');
      return `
        <div class="panel exercise-card">
          <div class="exercise-card-header">
            ${exerciseAvatarHtml(ex ? ex.group : 'Otro')}
            <div class="exercise-card-title">
              <strong>${ex ? ex.name : 'Ejercicio eliminado'}</strong>
              <span class="hint">${ex ? ex.equipment : ''}</span>
            </div>
            <button class="icon-btn" onclick="Workouts.removeExerciseFromSession(${exIdx})">✕</button>
          </div>
          <div class="set-row set-row-header">
            <span>SET</span><span>kg</span><span>reps</span><span>RPE</span><span></span>
          </div>
          ${setsHtml}
          <button class="btn small ghost" onclick="Workouts.addSet(${exIdx})">+ Añadir serie</button>
        </div>
      `;
    }).join('');
  }

  function addExerciseToSession(exerciseId) {
    if (!exerciseId) return;
    if (currentSessionExercises.some(e => e.exerciseId === exerciseId)) return;
    if (!sessionStartAt) sessionStartAt = Date.now();
    const last = getLastPerformance(exerciseId);
    const src = last ? last[0] : null;
    currentSessionExercises.push({ exerciseId, sets: [{ weight: src ? src.weight : '', reps: src ? src.reps : '', rpe: '' }] });
    renderCurrentSession();
    if (logExercisePicker) logExercisePicker.refresh();
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
    if (logExercisePicker) logExercisePicker.refresh();
  }

  function removeExerciseFromSession(exIdx) {
    currentSessionExercises.splice(exIdx, 1);
    renderCurrentSession();
    if (logExercisePicker) logExercisePicker.refresh();
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

    const durationMin = sessionStartAt ? Math.max(1, Math.round((Date.now() - sessionStartAt) / 60000)) : null;
    Storage.addWorkout({ date, name, entries: cleanEntries, durationMin });
    msg.textContent = '¡Sesión guardada! 💪';
    msg.className = 'msg success';
    initLogForm();
    setTimeout(() => { msg.textContent = ''; }, 2500);
    App.refreshDashboard();
  }

  // ---- Récords (PRs): compara cada set con la mejor 1RM estimada lograda antes de esa fecha ----
  function computeWorkoutRecords(workout, allWorkouts) {
    let count = 0;
    const marks = {};
    workout.entries.forEach(entry => {
      let bestBefore = 0;
      allWorkouts.forEach(w => {
        if (w.id === workout.id || w.date >= workout.date) return;
        const e2 = w.entries.find(x => x.exerciseId === entry.exerciseId);
        if (!e2) return;
        e2.sets.forEach(s => { bestBefore = Math.max(bestBefore, epley1RM(s.weight, s.reps)); });
      });
      marks[entry.exerciseId] = entry.sets.map(s => {
        const est = epley1RM(s.weight, s.reps);
        const isPR = est > 0 && est > bestBefore;
        if (isPR) { bestBefore = est; count++; }
        return isPR;
      });
    });
    return { count, marks };
  }

  function sessionVolume(workout) {
    return workout.entries.reduce((sum, e) => sum + e.sets.reduce((s2, s) => s2 + s.weight * s.reps, 0), 0);
  }

  function sessionCardHtml(w, allWorkouts, exercises) {
    const { count: records, marks } = computeWorkoutRecords(w, allWorkouts);
    const volume = sessionVolume(w);
    const totalSets = w.entries.reduce((sum, e) => sum + e.sets.length, 0);
    const duration = formatDuration(w.durationMin);
    const dateLabel = new Date(w.date + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' });

    const exercisesHtml = w.entries.map(e => {
      const ex = exercises.find(x => x.id === e.exerciseId);
      const setMarks = marks[e.exerciseId] || [];
      const rows = e.sets.map((s, i) => `
        <div class="set-view-row">
          <span class="set-num">${i + 1}</span>
          <span>${s.weight}kg × ${s.reps} rep${s.reps === 1 ? '' : 's'}${s.rpe ? ` · RPE ${s.rpe}` : ''}</span>
          ${setMarks[i] ? '<span class="pr-badge" title="Nuevo récord">🏆</span>' : ''}
        </div>
      `).join('');
      return `
        <div class="exercise-view-block">
          <div class="exercise-view-header">
            ${exerciseAvatarHtml(ex ? ex.group : 'Otro', 'sm')}
            <strong>${ex ? ex.name : '?'}</strong>
          </div>
          ${rows}
        </div>
      `;
    }).join('');

    return `
      <div class="panel session-card">
        <div class="session-card-header">
          <div>
            <strong class="session-name">${w.name || 'Entrenamiento'}</strong>
            <div class="hint session-date">${dateLabel}</div>
          </div>
          <button class="icon-btn" onclick="Workouts.deleteWorkout('${w.id}')">🗑️</button>
        </div>
        <div class="session-stats-row">
          ${duration ? `<div class="session-stat"><span class="hint">Duración</span><strong>${duration}</strong></div>` : ''}
          <div class="session-stat"><span class="hint">Volumen</span><strong>${Math.round(volume).toLocaleString('es-ES')} kg</strong></div>
          <div class="session-stat"><span class="hint">Series</span><strong>${totalSets}</strong></div>
          ${records > 0 ? `<div class="session-stat"><span class="hint">Récords</span><strong class="pr-count">🏆 ${records}</strong></div>` : ''}
        </div>
        <div class="session-exercises">${exercisesHtml}</div>
      </div>
    `;
  }

  function renderHistory() {
    const container = document.getElementById('workout-history-list');
    const workouts = Storage.getWorkouts();
    const exercises = Storage.getExercises();
    if (workouts.length === 0) {
      container.innerHTML = '<p class="hint empty-hint">Aún no has registrado ninguna sesión. ¡Empieza en "Registrar"!</p>';
      return;
    }
    container.innerHTML = workouts.map(w => sessionCardHtml(w, workouts, exercises)).join('');
  }

  function deleteWorkout(id) {
    if (!confirm('¿Eliminar esta sesión?')) return;
    Storage.deleteWorkout(id);
    renderHistory();
    App.refreshDashboard();
  }

  let progressChart = null;

  function mountProgressPicker() {
    const container = document.getElementById('progress-picker');
    progressPicker = ExercisePicker.mount(container, {
      placeholder: 'Buscar ejercicio para ver su progreso...',
      allowCreate: false,
      onSelect: (ex) => selectProgressExercise(ex.id),
    });
  }

  function selectProgressExercise(exerciseId) {
    progressExerciseId = exerciseId;
    const ex = Storage.getExercises().find(e => e.id === exerciseId);
    const selectedEl = document.getElementById('progress-selected');
    const pickerEl = document.getElementById('progress-picker');
    const contentEl = document.getElementById('progress-content');
    if (ex) {
      selectedEl.style.display = 'flex';
      selectedEl.innerHTML = `${exerciseAvatarHtml(ex.group)} <strong>${ex.name}</strong> <button class="icon-btn" id="progress-change-btn">Cambiar ✕</button>`;
      pickerEl.style.display = 'none';
      contentEl.style.display = 'block';
      document.getElementById('progress-change-btn').addEventListener('click', () => {
        progressExerciseId = null;
        selectedEl.style.display = 'none';
        pickerEl.style.display = 'block';
        contentEl.style.display = 'none';
      });
      renderProgress();
    }
  }

  function renderProgress() {
    if (!progressExerciseId) return;
    const workouts = Storage.getWorkouts().slice().sort((a, b) => a.date.localeCompare(b.date));

    const points = [];
    workouts.forEach(w => {
      const entry = w.entries.find(e => e.exerciseId === progressExerciseId);
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
      statsContainer.innerHTML = '<p class="hint">Sin datos todavía para este ejercicio. ¡Regístralo en alguna sesión!</p>';
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
        <div class="list-item-main">
          ${exerciseAvatarHtml(e.group, 'sm')}
          <div><strong>${e.name}</strong><div class="hint">${e.group} · ${e.equipment || 'Otro'}</div></div>
        </div>
        <button class="icon-btn" onclick="Workouts.removeExercise('${e.id}')">🗑️</button>
      </div>
    `).join('') || '<p class="hint">Sin resultados.</p>';
  }

  function addExercise(name, group, equipment) {
    const ex = Storage.addExercise(name, group, equipment);
    renderExerciseList();
    if (typeof Routines !== 'undefined') Routines.refreshPicker();
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
    if (logExercisePicker) logExercisePicker.refresh();
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
    document.getElementById('save-workout-btn').addEventListener('click', saveCurrentWorkout);
    document.getElementById('add-new-exercise-btn').addEventListener('click', addExerciseFromForm);
    document.getElementById('start-from-routine-btn').addEventListener('click', () => {
      const id = document.getElementById('start-from-routine-select').value;
      if (!id) return;
      const routine = Storage.getRoutines().find(r => r.id === id);
      if (routine) startFromRoutine(routine);
    });
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
    mountProgressPicker();
    renderExerciseList();
  }

  return {
    init, initLogForm, renderHistory, renderProgress, renderExerciseList, startFromRoutine, getLastPerformance,
    addSet, removeSet, removeExerciseFromSession, updateSet, deleteWorkout, removeExercise, addExerciseToSession,
    renderStartFromRoutineSelect, epley1RM, computeWorkoutRecords, sessionVolume, formatDuration, sessionCardHtml,
  };
})();
