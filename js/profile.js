/* Lógica y render de la pestaña "Perfil": Información (gráfica general + por ejercicio),
 * Estadísticas, Medidas corporales y Calendario de entrenamientos. */

const Profile = (() => {
  let currentMetric = 'duration';
  let generalChart = null;
  let measurementChart = null;
  let calendarMonth = new Date();
  calendarMonth.setDate(1);

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }
  function isoDate(d) {
    return d.toISOString().slice(0, 10);
  }

  // ---------------- Información: modo General / Por ejercicio ----------------

  function switchInfoMode(mode) {
    document.querySelectorAll('#info-mode-segmented .segmented-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
    document.getElementById('info-mode-general').classList.toggle('active', mode === 'general');
    document.getElementById('info-mode-exercise').classList.toggle('active', mode === 'exercise');
    if (mode === 'general') drawGeneralChart();
  }

  function getGeneralPoints() {
    const workouts = Storage.getWorkouts().slice().sort((a, b) => a.date.localeCompare(b.date));
    return workouts.map(w => ({
      date: w.date,
      duration: w.durationMin || 0,
      volume: Workouts.sessionVolume(w),
      reps: Workouts.sessionReps(w),
    }));
  }

  function drawGeneralChart() {
    const points = getGeneralPoints();
    const wrap = document.getElementById('general-chart-wrap');
    const empty = document.getElementById('general-chart-empty');
    if (points.length === 0) {
      wrap.style.display = 'none';
      empty.style.display = 'block';
      return;
    }
    wrap.style.display = 'block';
    empty.style.display = 'none';

    const metricMeta = {
      duration: { label: 'Duración (min)', color: cssVar('--accent') },
      volume: { label: 'Volumen (kg)', color: cssVar('--accent-2') },
      reps: { label: 'Repeticiones', color: cssVar('--gold') },
    };
    const meta = metricMeta[currentMetric];
    const textDim = cssVar('--text-dim');
    const border = cssVar('--border');

    const ctx = document.getElementById('general-chart').getContext('2d');
    if (generalChart) generalChart.destroy();
    generalChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: points.map(p => p.date),
        datasets: [{
          label: meta.label,
          data: points.map(p => p[currentMetric]),
          borderColor: meta.color,
          backgroundColor: meta.color + '33',
          tension: 0.25,
          fill: true,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { ticks: { color: textDim }, grid: { color: border } },
          y: { ticks: { color: textDim }, grid: { color: border }, beginAtZero: true },
        },
        plugins: { legend: { labels: { color: textDim } } },
      },
    });
  }

  // ---------------- Estadísticas ----------------

  function computeStreakLocal(dateSet) {
    let streak = 0;
    const d = new Date();
    if (!dateSet.has(isoDate(d))) d.setDate(d.getDate() - 1);
    while (dateSet.has(isoDate(d))) { streak++; d.setDate(d.getDate() - 1); }
    return streak;
  }

  function computeLongestStreak(dateSet) {
    if (dateSet.size === 0) return 0;
    const dates = Array.from(dateSet).sort();
    let longest = 1, current = 1;
    for (let i = 1; i < dates.length; i++) {
      const diffDays = Math.round((new Date(dates[i] + 'T00:00:00') - new Date(dates[i - 1] + 'T00:00:00')) / 86400000);
      if (diffDays === 1) { current++; longest = Math.max(longest, current); }
      else if (diffDays > 1) { current = 1; }
    }
    return longest;
  }

  function renderStats() {
    const workouts = Storage.getWorkouts();
    const exercises = Storage.getExercises();
    const totalSessions = workouts.length;
    const totalVolume = workouts.reduce((s, w) => s + Workouts.sessionVolume(w), 0);
    const totalSets = workouts.reduce((s, w) => s + w.entries.reduce((s2, e) => s2 + e.sets.length, 0), 0);
    const totalRecords = workouts.reduce((s, w) => s + Workouts.computeWorkoutRecords(w, workouts).count, 0);
    const durations = workouts.map(w => w.durationMin).filter(Boolean);
    const avgDuration = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;

    const dateSet = new Set(workouts.map(w => w.date));
    const currentStreak = computeStreakLocal(dateSet);
    const longestStreak = computeLongestStreak(dateSet);

    const groupCount = {};
    workouts.forEach(w => w.entries.forEach(e => {
      const ex = exercises.find(x => x.id === e.exerciseId);
      const group = ex ? ex.group : 'Otro';
      groupCount[group] = (groupCount[group] || 0) + e.sets.length;
    }));
    let topGroup = '—';
    let topCount = 0;
    Object.entries(groupCount).forEach(([g, c]) => { if (c > topCount) { topCount = c; topGroup = g; } });

    document.getElementById('stats-grid').innerHTML = `
      <div class="stat-box"><span class="stat-label">Sesiones totales</span><span class="stat-value">${totalSessions}</span></div>
      <div class="stat-box"><span class="stat-label">Volumen total</span><span class="stat-value">${Math.round(totalVolume).toLocaleString('es-ES')} kg</span></div>
      <div class="stat-box"><span class="stat-label">Series totales</span><span class="stat-value">${totalSets}</span></div>
      <div class="stat-box"><span class="stat-label">Récords (PRs)</span><span class="stat-value">${totalRecords}</span></div>
      <div class="stat-box"><span class="stat-label">Racha actual</span><span class="stat-value">${currentStreak} día${currentStreak === 1 ? '' : 's'}</span></div>
      <div class="stat-box"><span class="stat-label">Racha más larga</span><span class="stat-value">${longestStreak} día${longestStreak === 1 ? '' : 's'}</span></div>
      <div class="stat-box"><span class="stat-label">Duración media</span><span class="stat-value">${avgDuration ? Workouts.formatDuration(avgDuration) : '—'}</span></div>
      <div class="stat-box"><span class="stat-label">Grupo más entrenado</span><span class="stat-value">${topGroup}</span></div>
    `;
  }

  // ---------------- Medidas ----------------

  function renderMeasurements() {
    const list = Storage.getMeasurements();
    const chartPanel = document.getElementById('measurement-chart-panel');
    const withWeight = list.filter(m => m.weight != null).slice().sort((a, b) => a.date.localeCompare(b.date));
    if (withWeight.length > 0) {
      chartPanel.style.display = 'block';
      drawMeasurementChart(withWeight);
    } else {
      chartPanel.style.display = 'none';
    }

    document.getElementById('measurements-list').innerHTML = list.length ? list.map(m => `
      <div class="panel measurement-card">
        <div class="measurement-card-header">
          <strong>${new Date(m.date + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}</strong>
          <button class="icon-btn" onclick="Profile.deleteMeasurement('${m.id}')">${icon('trash', 16)}</button>
        </div>
        <div class="measurement-values">
          ${m.weight != null ? `<span><strong>${m.weight}</strong> kg</span>` : ''}
          ${m.waist != null ? `<span>Cintura <strong>${m.waist}</strong> cm</span>` : ''}
          ${m.chest != null ? `<span>Pecho <strong>${m.chest}</strong> cm</span>` : ''}
          ${m.arm != null ? `<span>Brazo <strong>${m.arm}</strong> cm</span>` : ''}
          ${m.hip != null ? `<span>Cadera <strong>${m.hip}</strong> cm</span>` : ''}
        </div>
      </div>
    `).join('') : '<p class="hint empty-hint">Todavía no has registrado ninguna medida.</p>';
  }

  function drawMeasurementChart(points) {
    const ctx = document.getElementById('measurement-chart').getContext('2d');
    const accent = cssVar('--accent');
    const textDim = cssVar('--text-dim');
    const border = cssVar('--border');
    if (measurementChart) measurementChart.destroy();
    measurementChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: points.map(p => p.date),
        datasets: [{
          label: 'Peso (kg)',
          data: points.map(p => Number(p.weight)),
          borderColor: accent,
          backgroundColor: accent + '33',
          tension: 0.25,
          fill: true,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { ticks: { color: textDim }, grid: { color: border } },
          y: { ticks: { color: textDim }, grid: { color: border } },
        },
        plugins: { legend: { labels: { color: textDim } } },
      },
    });
  }

  function saveMeasurement() {
    const date = document.getElementById('measure-date').value;
    const weight = document.getElementById('measure-weight').value;
    const waist = document.getElementById('measure-waist').value;
    const chest = document.getElementById('measure-chest').value;
    const arm = document.getElementById('measure-arm').value;
    const hip = document.getElementById('measure-hip').value;
    const msg = document.getElementById('measurement-msg');

    if (!date) {
      msg.textContent = 'Elige una fecha.';
      msg.className = 'msg error';
      return;
    }
    if (!weight && !waist && !chest && !arm && !hip) {
      msg.textContent = 'Añade al menos un valor.';
      msg.className = 'msg error';
      return;
    }

    Storage.addMeasurement({
      date,
      weight: weight ? Number(weight) : null,
      waist: waist ? Number(waist) : null,
      chest: chest ? Number(chest) : null,
      arm: arm ? Number(arm) : null,
      hip: hip ? Number(hip) : null,
    });

    ['measure-weight', 'measure-waist', 'measure-chest', 'measure-arm', 'measure-hip'].forEach(id => { document.getElementById(id).value = ''; });
    msg.textContent = '¡Medida guardada!';
    msg.className = 'msg success';
    setTimeout(() => { msg.textContent = ''; }, 2000);
    renderMeasurements();
  }

  function deleteMeasurement(id) {
    if (!confirm('¿Eliminar esta medida?')) return;
    Storage.deleteMeasurement(id);
    renderMeasurements();
  }

  // ---------------- Calendario ----------------

  function renderCalendar() {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const first = new Date(year, month, 1);
    const startWeekday = (first.getDay() + 6) % 7; // lunes = 0
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const workouts = Storage.getWorkouts();
    const workoutsByDate = {};
    workouts.forEach(w => { (workoutsByDate[w.date] = workoutsByDate[w.date] || []).push(w); });
    const todayStr = isoDate(new Date());

    let cells = '';
    for (let i = 0; i < startWeekday; i++) cells += '<div class="cal-cell empty"></div>';
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const trained = !!workoutsByDate[dateStr];
      const isToday = dateStr === todayStr;
      cells += `<button type="button" class="cal-cell ${trained ? 'trained' : ''} ${isToday ? 'today' : ''}" data-date="${dateStr}">${d}</button>`;
    }
    const grid = document.getElementById('calendar-grid');
    grid.innerHTML = cells;
    document.getElementById('calendar-label').textContent = calendarMonth.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

    grid.querySelectorAll('.cal-cell:not(.empty)').forEach(btn => {
      btn.addEventListener('click', () => showCalendarDay(btn.dataset.date, workoutsByDate[btn.dataset.date]));
    });
    document.getElementById('calendar-day-detail').innerHTML = '';
  }

  function showCalendarDay(dateStr, dayWorkouts) {
    const el = document.getElementById('calendar-day-detail');
    const label = new Date(dateStr + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    el.innerHTML = dayWorkouts && dayWorkouts.length
      ? `<strong>${label}:</strong> ${dayWorkouts.map(w => w.name || 'Entrenamiento').join(', ')}`
      : `<strong>${label}:</strong> sin entrenamiento registrado`;
  }

  function changeMonth(delta) {
    calendarMonth.setMonth(calendarMonth.getMonth() + delta);
    renderCalendar();
  }

  // ---------------- Dispatch ----------------

  function onEnterSegment(seg) {
    if (seg === 'info') {
      const modeBtn = document.querySelector('#info-mode-segmented .segmented-btn.active');
      const mode = modeBtn ? modeBtn.dataset.mode : 'general';
      if (mode === 'general') drawGeneralChart();
    }
    if (seg === 'stats') renderStats();
    if (seg === 'measurements') renderMeasurements();
    if (seg === 'calendar') renderCalendar();
  }

  function rerenderChartsTheme() {
    if (document.getElementById('general-chart-wrap').style.display !== 'none') drawGeneralChart();
    const list = Storage.getMeasurements().filter(m => m.weight != null).sort((a, b) => a.date.localeCompare(b.date));
    if (list.length && document.getElementById('measurement-chart-panel').style.display !== 'none') drawMeasurementChart(list);
  }

  function init() {
    document.getElementById('measure-date').value = isoDate(new Date());

    document.querySelectorAll('#info-mode-segmented .segmented-btn').forEach(btn => {
      btn.addEventListener('click', () => switchInfoMode(btn.dataset.mode));
    });
    document.querySelectorAll('#metric-segmented .segmented-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#metric-segmented .segmented-btn').forEach(b => b.classList.toggle('active', b === btn));
        currentMetric = btn.dataset.metric;
        drawGeneralChart();
      });
    });
    document.getElementById('toggle-more-measures-btn').addEventListener('click', () => {
      const el = document.getElementById('more-measures');
      el.style.display = el.style.display === 'none' ? 'grid' : 'none';
    });
    document.getElementById('save-measurement-btn').addEventListener('click', saveMeasurement);
    document.getElementById('calendar-prev-btn').addEventListener('click', () => changeMonth(-1));
    document.getElementById('calendar-next-btn').addEventListener('click', () => changeMonth(1));
  }

  return { init, onEnterSegment, rerenderChartsTheme, deleteMeasurement };
})();
