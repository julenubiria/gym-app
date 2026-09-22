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
      if (subtabName === 'routines') { Routines.refreshExerciseSelect(); Routines.renderList(); }
      if (subtabName === 'history') Workouts.renderHistory();
      if (subtabName === 'progress') Workouts.renderProgressExerciseSelect();
      if (subtabName === 'exercises') Workouts.renderExerciseList();
    }
    if (panelEl.id === 'tab-nutrition') {
      if (subtabName === 'log') Nutrition.renderDay();
      if (subtabName === 'foods') Nutrition.renderFoodsDb();
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

  function refreshDashboard() {
    const workouts = Storage.getWorkouts();
    const foodLogs = Storage.getFoodLogs();
    const foods = Storage.getFoods();
    const today = new Date().toISOString().slice(0, 10);

    const thisWeekStart = new Date();
    thisWeekStart.setDate(thisWeekStart.getDate() - 6);
    const weekStr = thisWeekStart.toISOString().slice(0, 10);
    const workoutsThisWeek = workouts.filter(w => w.date >= weekStr).length;

    const totalSetsEver = workouts.reduce((sum, w) => sum + w.entries.reduce((s2, e) => s2 + e.sets.length, 0), 0);

    document.getElementById('dashboard-cards').innerHTML = `
      <div class="card">
        <span class="card-label">Sesiones esta semana</span>
        <span class="card-value">${workoutsThisWeek}</span>
      </div>
      <div class="card">
        <span class="card-label">Sesiones totales</span>
        <span class="card-value">${workouts.length}</span>
      </div>
      <div class="card">
        <span class="card-label">Series totales registradas</span>
        <span class="card-value">${totalSetsEver}</span>
      </div>
      <div class="card">
        <span class="card-label">Ejercicios en tu lista</span>
        <span class="card-value">${Storage.getExercises().length}</span>
      </div>
    `;

    const recent = workouts.slice(0, 5);
    document.getElementById('dashboard-recent-workouts').innerHTML = recent.length ? recent.map(w => {
      const exercises = Storage.getExercises();
      const names = w.entries.map(e => exercises.find(x => x.id === e.exerciseId)?.name || '?').join(', ');
      return `<div class="list-item"><div><strong>${w.date}</strong> ${w.name ? '· ' + w.name : ''}<div class="hint">${names}</div></div></div>`;
    }).join('') : '<p class="hint">Todavía no has registrado entrenamientos. ¡Empieza en la pestaña "Entrenamiento"!</p>';

    const todayLogs = foodLogs.filter(l => l.date === today);
    const settings = Storage.getSettings();
    const totals = todayLogs.reduce((acc, l) => {
      const food = foods.find(f => f.id === l.foodId);
      if (!food) return acc;
      const factor = l.grams / 100;
      acc.kcal += food.kcal * factor;
      acc.protein += food.protein * factor;
      return acc;
    }, { kcal: 0, protein: 0 });

    document.getElementById('dashboard-today-nutrition').innerHTML = todayLogs.length ? `
      <div class="stats-row">
        <div class="stat-box"><span class="stat-label">Calorías hoy</span><span class="stat-value">${Math.round(totals.kcal)} / ${settings.kcal} kcal</span></div>
        <div class="stat-box"><span class="stat-label">Proteína hoy</span><span class="stat-value">${Math.round(totals.protein)} / ${settings.protein} g</span></div>
      </div>
    ` : '<p class="hint">Aún no has registrado comidas hoy. Ve a la pestaña "Nutrición".</p>';
  }

  function initSettingsForm() {
    const s = Storage.getSettings();
    document.getElementById('set-kcal').value = s.kcal;
    document.getElementById('set-protein').value = s.protein;
    document.getElementById('set-carbs').value = s.carbs;
    document.getElementById('set-fat').value = s.fat;

    document.getElementById('save-settings-btn').addEventListener('click', () => {
      const settings = {
        kcal: Number(document.getElementById('set-kcal').value) || 0,
        protein: Number(document.getElementById('set-protein').value) || 0,
        carbs: Number(document.getElementById('set-carbs').value) || 0,
        fat: Number(document.getElementById('set-fat').value) || 0,
      };
      Storage.saveSettings(settings);
      const msg = document.getElementById('save-settings-msg');
      msg.textContent = 'Objetivos guardados.';
      msg.className = 'msg success';
      setTimeout(() => { msg.textContent = ''; }, 2000);
      refreshDashboard();
    });

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
      if (!confirm('Esto borrará TODOS tus datos (entrenamientos, alimentos personalizados, registros). ¿Seguro?')) return;
      if (!confirm('Última confirmación: se perderá todo de forma permanente. ¿Continuar?')) return;
      Storage.resetAll();
      location.reload();
    });
  }

  function init() {
    Storage.seedIfNeeded();
    bindNav();
    Workouts.init();
    Routines.init();
    Nutrition.init();
    initSettingsForm();
    refreshDashboard();
    registerServiceWorker();
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator && (location.protocol === 'http:' || location.protocol === 'https:')) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  return { init, switchTab, switchWorkoutsSubtab, refreshDashboard };
})();

document.addEventListener('DOMContentLoaded', App.init);
