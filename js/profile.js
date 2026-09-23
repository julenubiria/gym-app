/* Lógica y render de la pestaña "Perfil": gráfica semanal general / por ejercicio,
 * y accesos a Estadísticas, Ejercicios, Medidas corporales y Calendario. */

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

  // ---------------- Navegación principal / subpáginas de detalle ----------------

  function showMain() {
    document.getElementById('profile-main').style.display = 'block';
    document.getElementById('profile-detail').style.display = 'none';
    const modeBtn = document.querySelector('#info-mode-segmented .segmented-btn.active');
    const mode = modeBtn ? modeBtn.dataset.mode : 'general';
    if (mode === 'general') drawGeneralChart();
  }

  function showDetail(type) {
    document.getElementById('profile-main').style.display = 'none';
    document.getElementById('profile-detail').style.display = 'block';
    document.querySelectorAll('.profile-detail-panel').forEach(p => p.classList.toggle('active', p.id === `detail-${type}`));
    const titles = { stats: 'Estadísticas', measurements: 'Medidas', calendar: 'Calendario' };
    document.getElementById('profile-detail-title').textContent = titles[type] || '';
    if (type === 'stats') renderStats();
    if (type === 'measurements') renderMeasurements();
    if (type === 'calendar') renderCalendar();
    window.scrollTo(0, 0);
  }

  // ---------------- Información: modo General (gráfica semanal) / Por ejercicio ----------------

  function switchInfoMode(mode) {
    document.querySelectorAll('#info-mode-segmented .segmented-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
    document.getElementById('info-mode-general').classList.toggle('active', mode === 'general');
    document.getElementById('info-mode-exercise').classList.toggle('active', mode === 'exercise');
    if (mode === 'general') drawGeneralChart();
  }

  function getWeekStart(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const day = (d.getDay() + 6) % 7; // lunes = 0
    d.setDate(d.getDate() - day);
    return isoDate(d);
  }

  function getWeeklyPoints() {
    const workouts = Storage.getWorkouts();
    const map = {};
    workouts.forEach(w => {
      const key = getWeekStart(w.date);
      if (!map[key]) map[key] = { duration: 0, volume: 0, reps: 0 };
      map[key].duration += w.durationMin || 0;
      map[key].volume += Workouts.sessionVolume(w);
      map[key].reps += Workouts.sessionReps(w);
    });
    return Object.keys(map).sort().map(k => ({ week: k, ...map[k] }));
  }

  function metricText(metric, value) {
    const rounded = Math.round(value);
    if (metric === 'duration') return `${rounded} min`;
    if (metric === 'volume') return `${rounded.toLocaleString('es-ES')} kg`;
    return `${rounded} reps`;
  }

  function drawGeneralChart() {
    const points = getWeeklyPoints();
    const wrap = document.getElementById('general-chart-wrap');
    const empty = document.getElementById('general-chart-empty');
    const headline = document.getElementById('chart-headline');

    if (points.length === 0) {
      wrap.style.display = 'none';
      empty.style.display = 'block';
      headline.textContent = '';
      return;
    }
    wrap.style.display = 'block';
    empty.style.display = 'none';

    const thisWeekKey = getWeekStart(isoDate(new Date()));
    const thisWeekPoint = points.find(p => p.week === thisWeekKey);
    const thisWeekValue = thisWeekPoint ? thisWeekPoint[currentMetric] : 0;
    headline.innerHTML = `${metricText(currentMetric, thisWeekValue)} <span class="hint">esta semana</span>`;

    const metricColor = {
      duration: cssVar('--accent'),
      volume: cssVar('--accent-2'),
      reps: cssVar('--gold'),
    }[currentMetric];
    const textDim = cssVar('--text-dim');
    const border = cssVar('--border');

    const labels = points.map(p => new Date(p.week + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }));

    const ctx = document.getElementById('general-chart').getContext('2d');
    if (generalChart) generalChart.destroy();
    generalChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data: points.map(p => p[currentMetric]),
          backgroundColor: metricColor,
          borderRadius: 4,
          maxBarThickness: 28,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { ticks: { color: textDim }, grid: { display: false } },
          y: { ticks: { color: textDim }, grid: { color: border }, beginAtZero: true },
        },
        plugins: { legend: { display: false } },
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
    const groupEntries = Object.entries(groupCount).sort((a, b) => b[1] - a[1]);
    const topGroup = groupEntries.length ? groupEntries[0][0] : '—';
    const maxGroupCount = groupEntries.length ? groupEntries[0][1] : 0;

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

    const breakdownEl = document.getElementById('muscle-breakdown');
    breakdownEl.style.display = groupEntries.length ? 'block' : 'none';
    breakdownEl.innerHTML = groupEntries.length ? `
      <h3>Series por grupo muscular</h3>
      <div class="muscle-bars">
        ${groupEntries.map(([group, count]) => `
          <div class="muscle-bar-row">
            <span class="muscle-bar-label">${group}</span>
            <div class="muscle-bar-track"><div class="muscle-bar-fill" style="width:${Math.round((count / maxGroupCount) * 100)}%"></div></div>
            <span class="muscle-bar-value">${count}</span>
          </div>
        `).join('')}
      </div>
    ` : '';
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

  // ---------------- Iconos de las tarjetas + tema ----------------

  function renderGridIcons() {
    const map = {
      stats: ['trending', 'Estadísticas'],
      measurements: ['ruler', 'Medidas'],
      calendar: ['calendar', 'Calendario'],
    };
    document.querySelectorAll('.profile-grid-card[data-detail]').forEach(btn => {
      const item = map[btn.dataset.detail];
      if (item) btn.innerHTML = `${icon(item[0], 20)}<span>${item[1]}</span>`;
    });
    const exBtn = document.getElementById('profile-exercises-shortcut');
    if (exBtn) exBtn.innerHTML = `${icon('dumbbell', 20)}<span>Ejercicios</span>`;
  }

  function rerenderChartsTheme() {
    if (document.getElementById('general-chart-wrap').style.display !== 'none') drawGeneralChart();
    const list = Storage.getMeasurements().filter(m => m.weight != null).sort((a, b) => a.date.localeCompare(b.date));
    if (list.length && document.getElementById('measurement-chart-panel').style.display !== 'none') drawMeasurementChart(list);
  }

  function init() {
    renderGridIcons();
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
    document.querySelectorAll('.profile-grid-card[data-detail]').forEach(btn => {
      btn.addEventListener('click', () => showDetail(btn.dataset.detail));
    });
    document.getElementById('profile-exercises-shortcut').addEventListener('click', () => {
      App.switchPage('workout');
      App.switchWorkoutSegment('exercises');
    });
    document.getElementById('profile-detail-back-btn').addEventListener('click', showMain);

    document.getElementById('toggle-more-measures-btn').addEventListener('click', () => {
      const el = document.getElementById('more-measures');
      el.style.display = el.style.display === 'none' ? 'grid' : 'none';
    });
    document.getElementById('save-measurement-btn').addEventListener('click', saveMeasurement);
    document.getElementById('calendar-prev-btn').addEventListener('click', () => changeMonth(-1));
    document.getElementById('calendar-next-btn').addEventListener('click', () => changeMonth(1));
  }

  return { init, showMain, rerenderChartsTheme, deleteMeasurement };
})();
