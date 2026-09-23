/* App shell: navegación entre pestañas, dashboard y ajustes */

const App = (() => {
  function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabName));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `tab-${tabName}`));
    if (tabName === 'dashboard') refreshDashboard();
  }

  function switchSubtab(panelEl, subtabName) {
    const subtabs = panelEl.querySelectorAll('.subtab-btn');
    subtabs.forEach(b => b.classList.toggle('active', b.dataset.subtab === subtabName));
    panelEl.querySelectorAll(':scope > .subtab-panel').forEach(p => p.classList.toggle('active', p.id.endsWith('-' + subtabName)));

    if (panelEl.id === 'tab-workouts') {
      if (subtabName === 'routines') Routines.showBrowse();
      if (subtabName === 'history') Workouts.renderHistory();
      if (subtabName === 'exercises') Workouts.renderExerciseList();
    }
  }

  function switchWorkoutsSubtab(subtabName) {
    const panelEl = document.getElementById('tab-workouts');
    const btn = panelEl.querySelector(`.subtab-btn[data-subtab="${subtabName}"]`);
    if (btn) btn.click();
    else switchSubtab(panelEl, subtabName);
  }

  function bindNav() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
    document.querySelectorAll('.tab-panel').forEach(panel => {
      panel.querySelectorAll('.subtab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchSubtab(panel, btn.dataset.subtab));
      });
    });
  }

  function isoDate(d) {
    return d.toISOString().slice(0, 10);
  }

  function computeStreak(workoutDateSet) {
    let streak = 0;
    const d = new Date();
    if (!workoutDateSet.has(isoDate(d))) d.setDate(d.getDate() - 1);
    while (workoutDateSet.has(isoDate(d))) {
      streak++;
      d.setDate(d.getDate() - 1);
    }
    return streak;
  }

  function renderHeatmap(workoutDateSet) {
    const container = document.getElementById('streak-heatmap');
    const days = 28;
    const cells = [];
    const today = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = isoDate(d);
      const filled = workoutDateSet.has(dateStr);
      cells.push(`<div class="heat-cell ${filled ? 'filled' : ''}" title="${dateStr}"></div>`);
    }
    container.innerHTML = cells.join('');
  }

  function refreshDashboard() {
    const workouts = Storage.getWorkouts();
    const exercises = Storage.getExercises();
    const workoutDateSet = new Set(workouts.map(w => w.date));

    const thisWeekStart = new Date();
    thisWeekStart.setDate(thisWeekStart.getDate() - 6);
    const weekStr = isoDate(thisWeekStart);
    const workoutsThisWeek = workouts.filter(w => w.date >= weekStr).length;

    const totalRecords = workouts.reduce((sum, w) => sum + Workouts.computeWorkoutRecords(w, workouts).count, 0);
    const streak = computeStreak(workoutDateSet);

    document.getElementById('dashboard-cards').innerHTML = `
      <div class="card">
        <span class="card-label">🔥 Racha</span>
        <span class="card-value">${streak}</span>
        <span class="card-sub">día${streak === 1 ? '' : 's'} seguidos</span>
      </div>
      <div class="card">
        <span class="card-label">Esta semana</span>
        <span class="card-value">${workoutsThisWeek}</span>
        <span class="card-sub">sesiones</span>
      </div>
      <div class="card">
        <span class="card-label">Total</span>
        <span class="card-value">${workouts.length}</span>
        <span class="card-sub">sesiones</span>
      </div>
      <div class="card">
        <span class="card-label">🏆 Récords</span>
        <span class="card-value">${totalRecords}</span>
        <span class="card-sub">PRs totales</span>
      </div>
    `;

    document.getElementById('streak-label').textContent = streak > 0
      ? `¡${streak} día${streak === 1 ? '' : 's'} seguidos, sigue así!`
      : 'Entrena hoy para empezar una racha';
    renderHeatmap(workoutDateSet);

    const recent = workouts.slice(0, 3);
    document.getElementById('dashboard-recent-workouts').innerHTML = recent.length
      ? recent.map(w => Workouts.sessionCardHtml(w, workouts, exercises)).join('')
      : '<p class="hint empty-hint">Todavía no has registrado entrenamientos. ¡Empieza en la pestaña "Entrenamiento"!</p>';
  }

  function initSettingsForm() {
    document.getElementById('export-btn').addEventListener('click', () => {
      const data = Storage.exportAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gymapp-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });

    document.getElementById('import-file').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          Storage.importAll(data);
          document.getElementById('backup-msg').textContent = 'Datos importados correctamente. Recargando...';
          document.getElementById('backup-msg').className = 'msg success';
          setTimeout(() => location.reload(), 1200);
        } catch (err) {
          document.getElementById('backup-msg').textContent = 'Error al importar: ' + err.message;
          document.getElementById('backup-msg').className = 'msg error';
        }
      };
      reader.readAsText(file);
    });

    document.getElementById('reset-btn').addEventListener('click', () => {
      if (!confirm('Esto borrará TODOS tus datos (entrenamientos, rutinas, ejercicios personalizados). ¿Seguro?')) return;
      if (!confirm('Última confirmación: se perderá todo de forma permanente. ¿Continuar?')) return;
      Storage.resetAll();
      location.reload();
    });
  }

  function initTheme() {
    const btn = document.getElementById('theme-toggle-btn');
    function current() {
      return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    }
    function applyIcon() {
      btn.textContent = current() === 'light' ? '🌙' : '☀️';
    }
    applyIcon();
    btn.addEventListener('click', () => {
      const next = current() === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('gymapp_theme', next); } catch (e) {}
      applyIcon();
      if (typeof Workouts !== 'undefined' && Workouts.rerenderChartTheme) Workouts.rerenderChartTheme();
    });
  }

  function init() {
    Storage.seedIfNeeded();
    bindNav();
    initTheme();
    Workouts.init();
    Routines.init();
    initSettingsForm();
    refreshDashboard();
    registerServiceWorker();
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator) || (location.protocol !== 'http:' && location.protocol !== 'https:')) return;

    // Si una versión nueva del Service Worker toma el control MIENTRAS la app ya
    // estaba abierta, recarga sola para que se vea la última versión sin tener que
    // borrar caché a mano. La primera vez que se instala (sin controller previo) no recarga.
    const hadController = !!navigator.serviceWorker.controller;
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || reloaded) return;
      reloaded = true;
      location.reload();
    });

    navigator.serviceWorker.register('sw.js').then((reg) => {
      // Comprueba si hay una versión nueva cada vez que se abre/reactiva la app.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {});
      });
    }).catch(() => {});
  }

  return { init, switchTab, switchWorkoutsSubtab, refreshDashboard };
})();

document.addEventListener('DOMContentLoaded', App.init);
