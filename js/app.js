/* App shell: navegación (sidebar en escritorio, barra inferior en móvil), dashboard y ajustes */

const NAV_ITEMS = [
  { page: 'dashboard', icon: 'home', label: 'Inicio' },
  { page: 'routines', icon: 'routines', label: 'Rutinas' },
  { page: 'log', icon: 'plusCircle', label: 'Registrar' },
  { page: 'progress', icon: 'trending', label: 'Progreso' },
  { page: 'exercises', icon: 'dumbbell', label: 'Ejercicios' },
];

const App = (() => {
  function renderNav() {
    document.querySelectorAll('#sidebar-nav .nav-item').forEach(btn => {
      const item = NAV_ITEMS.find(i => i.page === btn.dataset.page);
      if (item) btn.innerHTML = `${icon(item.icon, 20)}<span>${item.label}</span>`;
    });
    document.querySelectorAll('.sidebar-footer .nav-item').forEach(btn => {
      if (btn.dataset.page === 'settings') btn.innerHTML = `${icon('sliders', 20)}<span>Ajustes</span>`;
    });
    document.querySelectorAll('#bottom-nav .bottom-nav-item').forEach(btn => {
      const item = NAV_ITEMS.find(i => i.page === btn.dataset.page);
      if (item) btn.innerHTML = `${icon(item.icon, 22)}<span>${item.label}</span>`;
    });
    const settingsIconBtn = document.querySelector('.topbar-mobile [data-page="settings"]');
    if (settingsIconBtn) settingsIconBtn.innerHTML = icon('sliders', 20);
  }

  function switchPage(pageName) {
    document.querySelectorAll('[data-page]').forEach(el => el.classList.toggle('active', el.dataset.page === pageName));
    document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === `page-${pageName}`));
    window.scrollTo(0, 0);

    if (pageName === 'dashboard') refreshDashboard();
    if (pageName === 'routines') Routines.showBrowse();
    if (pageName === 'exercises') Workouts.renderExerciseList();
    if (pageName === 'progress') refreshProgressSegment();
  }

  function refreshProgressSegment() {
    const activeBtn = document.querySelector('#progress-segmented .segmented-btn.active');
    const seg = activeBtn ? activeBtn.dataset.seg : 'history';
    if (seg === 'history') Workouts.renderHistory();
  }

  function switchProgressSegment(seg) {
    document.querySelectorAll('#progress-segmented .segmented-btn').forEach(b => b.classList.toggle('active', b.dataset.seg === seg));
    document.getElementById('progress-seg-history').classList.toggle('active', seg === 'history');
    document.getElementById('progress-seg-exercise').classList.toggle('active', seg === 'exercise');
    if (seg === 'history') Workouts.renderHistory();
  }

  function bindNav() {
    document.querySelectorAll('[data-page]').forEach(btn => {
      btn.addEventListener('click', () => switchPage(btn.dataset.page));
    });
    document.querySelectorAll('#progress-segmented .segmented-btn').forEach(btn => {
      btn.addEventListener('click', () => switchProgressSegment(btn.dataset.seg));
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
      : '<p class="hint empty-hint">Todavía no has registrado entrenamientos. ¡Empieza en "Registrar"!</p>';
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
    const btns = [document.getElementById('theme-toggle-btn'), document.getElementById('theme-toggle-btn-mobile')];
    function current() {
      return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    }
    function applyIcon() {
      const html = current() === 'light' ? icon('moon', 18) : icon('sun', 18);
      btns.forEach(b => { if (b) b.innerHTML = html; });
    }
    applyIcon();
    btns.forEach(b => b && b.addEventListener('click', () => {
      const next = current() === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('gymapp_theme', next); } catch (e) {}
      applyIcon();
      if (typeof Workouts !== 'undefined' && Workouts.rerenderChartTheme) Workouts.rerenderChartTheme();
    }));
  }

  function init() {
    Storage.seedIfNeeded();
    renderNav();
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

  return { init, switchPage, refreshDashboard };
})();

document.addEventListener('DOMContentLoaded', App.init);
