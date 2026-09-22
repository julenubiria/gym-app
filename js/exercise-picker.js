/* Selector de ejercicios reutilizable: busca escribiendo + filtro por grupo muscular.
 * Se usa en "Registrar sesión", en el editor de rutinas y en "Progreso". */

const GROUP_META = {
  'Pecho': { color: '#ff6b6b', initials: 'PC' },
  'Espalda': { color: '#5ddac0', initials: 'ES' },
  'Hombro': { color: '#ffb84d', initials: 'HO' },
  'Bíceps': { color: '#7c9eff', initials: 'BI' },
  'Tríceps': { color: '#b98dff', initials: 'TR' },
  'Pierna': { color: '#4dd2ff', initials: 'PI' },
  'Core': { color: '#ffe066', initials: 'CO' },
  'Antebrazo': { color: '#ff8fab', initials: 'AN' },
  'Full Body': { color: '#ff9f6b', initials: 'FB' },
  'Cardio': { color: '#8be07c', initials: 'CA' },
  'Otro': { color: '#9aa0ac', initials: 'EX' },
};

function groupMeta(group) {
  return GROUP_META[group] || GROUP_META['Otro'];
}

function exerciseAvatarHtml(group, size) {
  const m = groupMeta(group);
  const sizeClass = size === 'sm' ? ' ex-avatar-sm' : '';
  return `<span class="ex-avatar${sizeClass}" style="--c:${m.color}">${m.initials}</span>`;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const ExercisePicker = {
  mount(container, opts) {
    opts = Object.assign({
      placeholder: 'Buscar ejercicio (ej: press banca...)',
      allowCreate: true,
      excludeIds: () => [],
      onSelect: () => {},
      onCreate: null,
    }, opts);

    container.innerHTML = `
      <div class="ex-picker">
        <input type="text" class="ex-picker-input" placeholder="${opts.placeholder}">
        <div class="ex-picker-chips">
          <button type="button" class="chip active" data-group="">Todos</button>
          ${MUSCLE_GROUPS.map(g => `<button type="button" class="chip" data-group="${g}">${g}</button>`).join('')}
        </div>
        <div class="ex-picker-results"></div>
      </div>
    `;
    const input = container.querySelector('.ex-picker-input');
    const resultsEl = container.querySelector('.ex-picker-results');
    const chips = container.querySelectorAll('.chip');
    let activeGroup = '';

    function render() {
      const q = input.value.trim().toLowerCase();
      const excluded = new Set(opts.excludeIds());
      let list = Storage.getExercises().filter(e => !excluded.has(e.id));
      if (activeGroup) list = list.filter(e => e.group === activeGroup);
      if (q) list = list.filter(e => e.name.toLowerCase().includes(q));
      list = list.sort((a, b) => a.name.localeCompare(b.name)).slice(0, 30);

      let html = list.map(e => `
        <button type="button" class="ex-result" data-id="${e.id}">
          ${exerciseAvatarHtml(e.group)}
          <span class="ex-result-info"><strong>${escapeHtml(e.name)}</strong><span class="hint">${e.group} · ${e.equipment}</span></span>
        </button>
      `).join('');

      if (list.length === 0) {
        if (q && opts.allowCreate) {
          html = `<button type="button" class="ex-result ex-create" data-create="1">➕ Crear "${escapeHtml(input.value.trim())}" como ejercicio nuevo</button>`;
        } else {
          html = '<p class="hint">Sin resultados.</p>';
        }
      }
      resultsEl.innerHTML = html;
    }

    input.addEventListener('input', render);
    input.addEventListener('focus', () => { resultsEl.classList.add('open'); render(); });

    chips.forEach(c => c.addEventListener('click', () => {
      chips.forEach(x => x.classList.remove('active'));
      c.classList.add('active');
      activeGroup = c.dataset.group;
      render();
    }));

    resultsEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.ex-result');
      if (!btn) return;
      if (btn.dataset.create) {
        if (opts.onCreate) opts.onCreate(input.value.trim());
      } else {
        const ex = Storage.getExercises().find(x => x.id === btn.dataset.id);
        if (ex) opts.onSelect(ex);
        input.value = '';
      }
      render();
    });

    render();
    return { refresh: render, clear: () => { input.value = ''; render(); } };
  },
};
