/* Lógica y render de la pestaña Entrenamiento: explorar rutinas, sesión activa y biblioteca */

const MUSCLE_GROUPS = ['Pecho', 'Espalda', 'Hombro', 'Bíceps', 'Tríceps', 'Pierna', 'Core', 'Antebrazo', 'Full Body', 'Cardio', 'Otro'];
const EQUIPMENT_TYPES = ['Barra', 'Mancuernas', 'Máquina', 'Polea', 'Peso corporal', 'Smith', 'Kettlebell', 'Banda elástica', 'Cardio', 'Otro'];

const Workouts = (() => {
  let currentSessionExercises = []; // [{exerciseId, note, restSeconds, sets: [{weight, reps, done}]}]
  let sessionStartAt = null;
  let sessionTimerInterval = null;
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

  function formatElapsed(ms) {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    if (totalSec < 60) return `${totalSec}s`;
    const totalMin = Math.floor(totalSec / 60);
    if (totalMin < 60) return `${totalMin}min`;
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${h}h ${m}min`;
  }

  function fillSelectOptions(sel, options) {
    sel.innerHTML = options.map(o => `<option value="${o}">${o}</option>`).join('');
  }

  // ---------------- Navegación entre vistas de la pestaña ----------------

  function showView(view) {
    document.getElementById('workout-browse').style.display = view === 'browse' ? 'block' : 'none';
    document.getElementById('active-session').style.display = view === 'session' ? 'block' : 'none';
    document.getElementById('workout-library').style.display = view === 'library' ? 'block' : 'none';
    document.getElementById('routine-editor').style.display = view === 'editor' ? 'block' : 'none';
    document.getElementById('app').classList.toggle('wide', view === 'editor');

    if (view === 'browse') Routines.renderList();
    if (view === 'library') renderExerciseList();
    if (view === 'session') {
      renderActiveSession();
      startSessionTimer();
    } else {
      stopSessionTimer();
    }
  }

  function showBrowseOrResume() {
    showView(sessionStartAt ? 'session' : 'browse');
  }

  function startSessionTimer() {
    stopSessionTimer();
    sessionTimerInterval = setInterval(renderSessionStats, 1000);
  }
  function stopSessionTimer() {
    if (sessionTimerInterval) clearInterval(sessionTimerInterval);
    sessionTimerInterval = null;
  }

  // ---------------- Sesión activa ----------------

  function resetSession() {
    currentSessionExercises = [];
    sessionStartAt = null;
    document.getElementById('workout-date').value = todayStr();
    document.getElementById('workout-name').value = '';
  }

  function ensureSessionStarted() {
    if (!sessionStartAt) sessionStartAt = Date.now();
  }

  function startEmpty() {
    resetSession();
    ensureSessionStarted();
    showView('session');
    if (logExercisePicker) logExercisePicker.refresh();
  }

  // Devuelve los últimos sets realizados para un ejercicio (referencia "ANTERIOR")
  function getLastPerformance(exerciseId) {
    const workouts = Storage.getWorkouts(); // ya viene ordenado por fecha desc
    for (const w of workouts) {
      const entry = w.entries.find(e => e.exerciseId === exerciseId);
      if (entry && entry.sets.length) return entry.sets;
    }
    return null;
  }

  function startFromRoutine(routine) {
    resetSession();
    currentSessionExercises = routine.exercises.map(re => ({
      exerciseId: re.exerciseId,
      note: re.note || '',
      restSeconds: re.restSeconds || 90,
      sets: Array.from({ length: re.targetSets || 1 }, () => ({ weight: '', reps: '', done: false })),
    }));
    ensureSessionStarted();
    document.getElementById('workout-name').value = routine.name;
    showView('session');
    if (logExercisePicker) logExercisePicker.refresh();
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

  function addExerciseToSession(exerciseId) {
    if (!exerciseId) return;
    if (currentSessionExercises.some(e => e.exerciseId === exerciseId)) return;
    ensureSessionStarted();
    currentSessionExercises.push({ exerciseId, note: '', restSeconds: 90, sets: [{ weight: '', reps: '', done: false }] });
    renderActiveSession();
    if (logExercisePicker) logExercisePicker.refresh();
  }

  function addSet(exIdx) {
    currentSessionExercises[exIdx].sets.push({ weight: '', reps: '', done: false });
    renderActiveSession();
  }

  function removeSet(exIdx, setIdx) {
    currentSessionExercises[exIdx].sets.splice(setIdx, 1);
    if (currentSessionExercises[exIdx].sets.length === 0) {
      currentSessionExercises.splice(exIdx, 1);
    }
    renderActiveSession();
    if (logExercisePicker) logExercisePicker.refresh();
  }

  function removeExerciseFromSession(exIdx) {
    currentSessionExercises.splice(exIdx, 1);
    renderActiveSession();
    if (logExercisePicker) logExercisePicker.refresh();
  }

  function updateSet(exIdx, setIdx, field, value) {
    currentSessionExercises[exIdx].sets[setIdx][field] = value === '' ? '' : Number(value);
    renderActiveSession();
  }

  function toggleSetDone(exIdx, setIdx) {
    const set = currentSessionExercises[exIdx].sets[setIdx];
    set.done = !set.done;
    renderActiveSession();
  }

  function updateNote(exIdx, value) {
    currentSessionExercises[exIdx].note = value;
  }

  function updateRest(exIdx, value) {
    currentSessionExercises[exIdx].restSeconds = Number(value);
  }

  function sessionTotals() {
    let volume = 0, sets = 0;
    currentSessionExercises.forEach(entry => {
      entry.sets.forEach(s => {
        if (s.weight !== '' && s.reps !== '') { volume += s.weight * s.reps; sets++; }
      });
    });
    return { volume, sets };
  }

  function renderSessionStats() {
    const el = document.getElementById('session-stats');
    if (!el) return;
    const elapsed = sessionStartAt ? Date.now() - sessionStartAt : 0;
    const { volume, sets } = sessionTotals();
    el.innerHTML = `
      <div class="session-stat-plain"><span class="hint">Duración</span><strong>${formatElapsed(elapsed)}</strong></div>
      <div class="session-stat-plain"><span class="hint">Volumen</span><strong>${Math.round(volume).toLocaleString('es-ES')} kg</strong></div>
      <div class="session-stat-plain"><span class="hint">Series</span><strong>${sets}</strong></div>
    `;
  }

  function exerciseSessionCardHtml(entry, exIdx) {
    const ex = Storage.getExercises().find(e => e.id === entry.exerciseId);
    const last = getLastPerformance(entry.exerciseId);
    const setsHtml = entry.sets.map((s, setIdx) => {
      const prevSet = last ? (last[setIdx] || last[last.length - 1]) : null;
      const filled = s.weight !== '' && s.reps !== '';
      const actionBtn = filled
        ? `<button type="button" class="set-check ${s.done ? 'done' : ''}" onclick="Workouts.toggleSetDone(${exIdx},${setIdx})">${icon('check', 14)}</button>`
        : `<button type="button" class="set-check remove" onclick="Workouts.removeSet(${exIdx},${setIdx})">${icon('x', 14)}</button>`;
      return `
        <div class="set-row ${s.done ? 'set-row-done' : ''}">
          <span class="set-num">${setIdx + 1}</span>
          <span class="set-prev">${prevSet ? `${prevSet.weight}kg × ${prevSet.reps}` : '—'}</span>
          <input type="number" step="0.5" min="0" inputmode="decimal" placeholder="kg" value="${s.weight ?? ''}"
            onchange="Workouts.updateSet(${exIdx}, ${setIdx}, 'weight', this.value)">
          <input type="number" step="1" min="0" inputmode="numeric" placeholder="reps" value="${s.reps ?? ''}"
            onchange="Workouts.updateSet(${exIdx}, ${setIdx}, 'reps', this.value)">
          ${actionBtn}
        </div>
      `;
    }).join('');

    return `
      <div class="panel exercise-card">
        <div class="exercise-card-header">
          ${exerciseAvatarHtml(ex ? ex.group : 'Otro')}
          <div class="exercise-card-title"><strong>${ex ? escapeHtml(ex.name) : 'Ejercicio eliminado'}</strong></div>
          <button type="button" class="icon-btn" onclick="Workouts.removeExerciseFromSession(${exIdx})">${icon('trash', 16)}</button>
        </div>
        <input type="text" class="exercise-note-input" placeholder="Agregar notas aquí..." value="${escapeHtml(entry.note || '')}"
          onchange="Workouts.updateNote(${exIdx}, this.value)">
        <div class="rest-row">
          ${icon('clock', 14)}
          <span>Descanso:</span>
          <select onchange="Workouts.updateRest(${exIdx}, this.value)">
            ${REST_OPTIONS.map(o => `<option value="${o.value}" ${Number(entry.restSeconds) === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
          </select>
        </div>
        <div class="set-row set-row-header">
          <span>Nº</span><span>ANTERIOR</span><span>KG</span><span>REPS</span><span></span>
        </div>
        ${setsHtml}
        <button type="button" class="btn small ghost btn-add-set" onclick="Workouts.addSet(${exIdx})">${icon('plus', 14)}<span>Añadir serie</span></button>
      </div>
    `;
  }

  function renderActiveSession() {
    renderSessionStats();
    const container = document.getElementById('session-exercises-list');
    if (currentSessionExercises.length === 0) {
      container.innerHTML = '<p class="hint empty-hint">Añade tu primer ejercicio abajo.</p>';
      return;
    }
    container.innerHTML = currentSessionExercises.map((entry, exIdx) => exerciseSessionCardHtml(entry, exIdx)).join('');
  }

  function saveCurrentWorkout() {
    const date = document.getElementById('workout-date').value || todayStr();
    const name = document.getElementById('workout-name').value.trim();
    const msg = document.getElementById('save-workout-msg');

    const cleanEntries = currentSessionExercises
      .map(entry => ({
        exerciseId: entry.exerciseId,
        note: entry.note || '',
        sets: entry.sets.filter(s => s.weight !== '' && s.reps !== '').map(s => ({ weight: s.weight, reps: s.reps })),
      }))
      .filter(entry => entry.sets.length > 0);

    if (cleanEntries.length === 0) {
      msg.textContent = 'Añade al menos una serie con peso y repeticiones.';
      msg.className = 'msg error';
      return;
    }

    const durationMin = sessionStartAt ? Math.max(1, Math.round((Date.now() - sessionStartAt) / 60000)) : null;
    Storage.addWorkout({ date, name, entries: cleanEntries, durationMin });
    resetSession();
    showView('browse');
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

  function sessionReps(workout) {
    return workout.entries.reduce((sum, e) => sum + e.sets.reduce((s2, s) => s2 + s.reps, 0), 0);
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
          <span>${s.weight}kg × ${s.reps} rep${s.reps === 1 ? '' : 's'}</span>
          ${setMarks[i] ? `<span class="pr-badge" title="Nuevo récord">${icon('award', 14)}</span>` : ''}
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
          <button class="icon-btn" onclick="Workouts.deleteWorkout('${w.id}')">${icon('trash', 16)}</button>
        </div>
        <div class="session-stats-row">
          ${duration ? `<div class="session-stat"><span class="hint">Duración</span><strong>${duration}</strong></div>` : ''}
          <div class="session-stat"><span class="hint">Volumen</span><strong>${Math.round(volume).toLocaleString('es-ES')} kg</strong></div>
          <div class="session-stat"><span class="hint">Series</span><strong>${totalSets}</strong></div>
          ${records > 0 ? `<div class="session-stat"><span class="hint">Récords</span><strong class="pr-count">${icon('award', 14)} ${records}</strong></div>` : ''}
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
      container.innerHTML = '<p class="hint empty-hint">Aún no has registrado ninguna sesión. ¡Empieza en "Entrenamiento"!</p>';
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

    drawProgressChart(points);
  }

  let lastProgressPoints = [];

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function drawProgressChart(points) {
    lastProgressPoints = points;
    const canvas = document.getElementById('progress-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const accent = cssVar('--accent') || '#7c9eff';
    const accent2 = cssVar('--accent-2') || '#5ddac0';
    const textDim = cssVar('--text-dim') || '#8b90a0';
    const border = cssVar('--border') || '#262834';
    if (progressChart) progressChart.destroy();
    progressChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: points.map(p => p.date),
        datasets: [
          {
            label: '1RM estimada (kg)',
            data: points.map(p => p.est1rm),
            borderColor: accent,
            backgroundColor: accent + '33',
            tension: 0.25,
            yAxisID: 'y',
          },
          {
            label: 'Volumen sesión (kg)',
            data: points.map(p => p.volume),
            borderColor: accent2,
            backgroundColor: accent2 + '33',
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
          x: { ticks: { color: textDim }, grid: { color: border } },
          y: { position: 'left', title: { display: true, text: 'kg (1RM est.)', color: textDim }, ticks: { color: textDim }, grid: { color: border } },
          y1: { position: 'right', title: { display: true, text: 'Volumen (kg)', color: textDim }, ticks: { color: textDim }, grid: { drawOnChartArea: false } },
        },
        plugins: { legend: { labels: { color: textDim } } },
      },
    });
  }

  function rerenderChartTheme() {
    if (progressChart && lastProgressPoints.length >= 0) drawProgressChart(lastProgressPoints);
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
          <div><strong>${e.name}</strong><div class="hint">${e.group} · ${e.equipment || 'Otro'}${e.builtin ? ' · De fábrica' : ''}</div></div>
        </div>
        ${e.builtin ? '' : `<button class="icon-btn" onclick="Workouts.removeExercise('${e.id}')">${icon('trash', 16)}</button>`}
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
    const ex = Storage.getExercises().find(x => x.id === id);
    if (ex && ex.builtin) return; // los ejercicios de fábrica no se pueden borrar
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
    document.getElementById('start-empty-btn').addEventListener('click', startEmpty);
    document.getElementById('session-back-btn').addEventListener('click', () => showView('browse'));
    document.getElementById('explore-exercises-btn').addEventListener('click', () => showView('library'));
    document.getElementById('library-back-btn').addEventListener('click', () => showView('browse'));
    document.getElementById('save-workout-btn').addEventListener('click', saveCurrentWorkout);
    document.getElementById('add-new-exercise-btn').addEventListener('click', addExerciseFromForm);
    document.getElementById('inline-ex-save-btn').addEventListener('click', saveInlineNewExercise);
    document.getElementById('exercise-list-search').addEventListener('input', renderExerciseList);
    document.getElementById('exercise-list-group-filter').addEventListener('change', renderExerciseList);
    document.getElementById('exercise-list-equipment-filter').addEventListener('change', renderExerciseList);
  }

  function init() {
    renderExerciseFilterSelects();
    bindEvents();
    resetSession();
    mountLogExercisePicker();
    renderHistory();
    mountProgressPicker();
    renderExerciseList();
  }

  return {
    init, showView, showBrowseOrResume, renderHistory, renderProgress, renderExerciseList, startFromRoutine, getLastPerformance,
    addSet, removeSet, removeExerciseFromSession, updateSet, toggleSetDone, updateNote, updateRest, deleteWorkout, removeExercise, addExerciseToSession,
    epley1RM, computeWorkoutRecords, sessionVolume, sessionReps, formatDuration, sessionCardHtml,
    rerenderChartTheme,
  };
})();
