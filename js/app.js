/* App shell: navegación (sidebar en escritorio, barra inferior en móvil), dashboard y ajustes */

const NAV_ITEMS = [
  { page: 'dashboard', icon: 'home', label: 'Inicio' },
  { page: 'workout', icon: 'dumbbell', label: 'Entrenamiento' },
  { page: 'profile', icon: 'user', label: 'Perfil' },
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

  function renderStaticIcons() {
    document.querySelectorAll('.brand-mark').forEach(el => { el.innerHTML = icon('dumbbell', 20); });
    const startEmptyIcon = document.querySelector('.start-empty-icon');
    if (startEmptyIcon) startEmptyIcon.innerHTML = icon('plus', 18);
    const withIcon = {
      'new-folder-btn': ['folderPlus', ''],
      'new-routine-btn': ['routines', 'Nueva rutina'],
      'explore-exercises-btn': ['search', 'Explorar'],
      'library-back-btn': ['chevronLeft', 'Volver'],
      'session-back-btn': ['chevronDown', ''],
      'export-btn': ['download', 'Exportar datos (JSON)'],
      'reset-btn': ['trash', 'Borrar todos los datos'],
      'routine-editor-back-btn': ['chevronLeft', 'Volver'],
    };
    Object.entries(withIcon).forEach(([id, [iconName, label]]) => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = label ? `${icon(iconName, 16)}<span>${label}</span>` : icon(iconName, 20);
    });
    const importLabel = document.querySelector('label[for="import-file"]');
    if (importLabel) importLabel.innerHTML = `${icon('upload', 16)}<span>Importar datos</span>`;
    const calPrev = document.getElementById('calendar-prev-btn');
    const calNext = document.getElementById('calendar-next-btn');
    if (calPrev) calPrev.innerHTML = icon('chevronLeft', 18);
    if (calNext) calNext.innerHTML = icon('chevronRight', 18);
  }

  function bindGlobalKebabCloser() {
    document.addEventListener('click', (e) => {
      document.querySelectorAll('details.kebab[open]').forEach(d => {
        if (!d.contains(e.target)) d.removeAttribute('open');
      });
    });
  }

  // ---------------- Navegación de páginas ----------------

  function switchPage(pageName) {
    document.querySelectorAll('[data-page]').forEach(el => el.classList.toggle('active', el.dataset.page === pageName));
    document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === `page-${pageName}`));
    window.scrollTo(0, 0);

    if (pageName === 'dashboard') refreshDashboard();
    if (pageName === 'workout') Workouts.showBrowseOrResume();
    if (pageName === 'profile') Profile.showMain();
  }

  function bindNav() {
    document.querySelectorAll('[data-page]').forEach(btn => {
      btn.addEventListener('click', () => switchPage(btn.dataset.page));
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
        <span class="card-label">${icon('flame', 14)} Racha</span>
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
        <span class="card-label">${icon('award', 14)} Récords</span>
        <span class="card-value">${totalRecords}</span>
        <span class="card-sub">PRs totales</span>
      </div>
    `;

    Workouts.renderHistory();
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
      if (!confirm('Esto borrará TODOS tus datos (entrenamientos, rutinas, ejercicios personalizados, medidas). ¿Seguro?')) return;
      if (!confirm('Última confirmación: se perderá todo de forma permanente. ¿Continuar?')) return;
      Storage.resetAll();
      location.reload();
    });

    initNotificationsSettings();
  }

  function initNotificationsSettings() {
    const btn = document.getElementById('enable-notifications-btn');
    const status = document.getElementById('notifications-status');
    if (!btn || !status) return;
    function refresh() {
      if (!('Notification' in window)) {
        status.textContent = 'Tu navegador no soporta notificaciones.';
        btn.style.display = 'none';
        return;
      }
      const labels = { granted: 'Activados ✓', denied: 'Bloqueados desde los ajustes del navegador.', default: 'Aún no activados.' };
      status.textContent = labels[Notification.permission] || '';
      btn.style.display = Notification.permission === 'default' ? 'inline-flex' : 'none';
    }
    btn.addEventListener('click', () => { Notification.requestPermission().then(refresh).catch(() => {}); });
    refresh();
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
      if (typeof Profile !== 'undefined' && Profile.rerenderChartsTheme) Profile.rerenderChartsTheme();
    }));
  }

  function init() {
    Storage.seedIfNeeded();
    renderNav();
    renderStaticIcons();
    bindNav();
    bindGlobalKebabCloser();
    initTheme();
    Workouts.init();
    Routines.init();
    Workouts.showBrowseOrResume();
    Profile.init();
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
