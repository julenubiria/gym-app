/* Lógica y render de "Rutinas": lista con carpetas + editor estilo Hevy.
 * Las rutinas solo guardan qué ejercicios y cuántas series planeadas, no peso ni reps:
 * eso se rellena durante la sesión real. */

const REST_OPTIONS = [
  { value: 0, label: 'Desactivado' },
  { value: 30, label: '30 s' },
  { value: 45, label: '45 s' },
  { value: 60, label: '60 s' },
  { value: 90, label: '90 s' },
  { value: 120, label: '2 min' },
  { value: 180, label: '3 min' },
  { value: 300, label: '5 min' },
];

const Routines = (() => {
  let editingId = null;
  let editorExercises = []; // [{exerciseId, note, restSeconds, targetSets}]
  let editorFolderId = null;
  let picker = null;
  const collapsedFolders = new Set();

  // ---------------- Browse (lista + carpetas) ----------------

  function kebabHtml(items) {
    return `
      <details class="kebab">
        <summary class="icon-btn">${icon('moreHorizontal', 18)}</summary>
        <div class="kebab-menu">
          ${items.map(it => `<button type="button" class="${it.danger ? 'danger-item' : ''}" data-${it.action}="${it.id}">${icon(it.icon, 15)}<span>${it.label}</span></button>`).join('')}
        </div>
      </details>
    `;
  }

  function renderGroups() {
    const container = document.getElementById('routines-groups');
    const routines = Storage.getRoutines();
    const folders = Storage.getFolders();
    const exercises = Storage.getExercises();

    if (routines.length === 0 && folders.length === 0) {
      container.innerHTML = '<p class="hint empty-hint">Todavía no has creado ninguna rutina. Pulsa "Nueva rutina" para empezar.</p>';
      return;
    }

    const groupsHtml = folders.map(folder => {
      const folderRoutines = routines.filter(r => r.folderId === folder.id);
      const collapsed = collapsedFolders.has(folder.id);
      return `
        <div class="routine-folder">
          <div class="routine-folder-header">
            <button type="button" class="folder-toggle" data-toggle-folder="${folder.id}">
              <span class="folder-chevron">${icon(collapsed ? 'chevronRight' : 'chevronDown', 15)}</span>
              <strong>${escapeHtml(folder.name)}</strong>
              <span class="hint">(${folderRoutines.length})</span>
            </button>
            ${kebabHtml([
              { action: 'rename-folder', id: folder.id, icon: 'edit', label: 'Renombrar' },
              { action: 'delete-folder', id: folder.id, icon: 'trash', label: 'Eliminar', danger: true },
            ])}
          </div>
          <div class="routine-folder-body" style="display:${collapsed ? 'none' : 'flex'}">
            ${folderRoutines.length ? folderRoutines.map(r => routineCardHtml(r, exercises)).join('') : '<p class="hint empty-hint">Sin rutinas en esta carpeta.</p>'}
          </div>
        </div>
      `;
    }).join('');

    const ungrouped = routines.filter(r => !r.folderId || !folders.some(f => f.id === r.folderId));
    const ungroupedCollapsed = collapsedFolders.has('_none');
    const ungroupedHtml = `
      <div class="routine-folder">
        <div class="routine-folder-header">
          <button type="button" class="folder-toggle" data-toggle-folder="_none">
            <span class="folder-chevron">${icon(ungroupedCollapsed ? 'chevronRight' : 'chevronDown', 15)}</span>
            <strong>Mis rutinas</strong>
            <span class="hint">(${ungrouped.length})</span>
          </button>
        </div>
        <div class="routine-folder-body" style="display:${ungroupedCollapsed ? 'none' : 'flex'}">
          ${ungrouped.length ? ungrouped.map(r => routineCardHtml(r, exercises)).join('') : '<p class="hint empty-hint">Sin rutinas todavía.</p>'}
        </div>
      </div>
    `;

    container.innerHTML = groupsHtml + ungroupedHtml;
  }

  function routineCardHtml(r, exercises) {
    const names = r.exercises.map(re => {
      const ex = exercises.find(x => x.id === re.exerciseId);
      return ex ? ex.name : '?';
    }).join(', ');
    return `
      <div class="panel routine-card">
        <div class="routine-card-top">
          <strong class="session-name">${escapeHtml(r.name)}</strong>
          ${kebabHtml([
            { action: 'edit', id: r.id, icon: 'edit', label: 'Editar' },
            { action: 'remove', id: r.id, icon: 'trash', label: 'Eliminar', danger: true },
          ])}
        </div>
        <div class="hint routine-card-names">${escapeHtml(names) || 'Sin ejercicios todavía'}</div>
        <button type="button" class="btn primary btn-block" data-start="${r.id}">${icon('play', 16)}<span>Empezar Rutina</span></button>
      </div>
    `;
  }

  function bindBrowseEvents() {
    document.getElementById('new-routine-btn').addEventListener('click', () => openEditor(null));
    document.getElementById('new-folder-btn').addEventListener('click', () => {
      const name = prompt('Nombre de la nueva carpeta (ej: Mesociclo 1):');
      if (name && name.trim()) {
        Storage.addFolder(name.trim());
        renderGroups();
      }
    });

    document.getElementById('routines-groups').addEventListener('click', (e) => {
      const toggle = e.target.closest('[data-toggle-folder]');
      if (toggle) {
        const id = toggle.dataset.toggleFolder;
        if (collapsedFolders.has(id)) collapsedFolders.delete(id); else collapsedFolders.add(id);
        renderGroups();
        return;
      }
      const rename = e.target.closest('[data-rename-folder]');
      if (rename) {
        const folder = Storage.getFolders().find(f => f.id === rename.dataset.renameFolder);
        const name = prompt('Nuevo nombre de la carpeta:', folder ? folder.name : '');
        if (name && name.trim()) { Storage.renameFolder(rename.dataset.renameFolder, name.trim()); renderGroups(); }
        return;
      }
      const del = e.target.closest('[data-delete-folder]');
      if (del) {
        if (confirm('¿Eliminar esta carpeta? Las rutinas dentro pasarán a "Mis rutinas".')) {
          Storage.deleteFolder(del.dataset.deleteFolder);
          renderGroups();
        }
        return;
      }
      const start = e.target.closest('[data-start]');
      if (start) { startRoutine(start.dataset.start); return; }
      const edit = e.target.closest('[data-edit]');
      if (edit) { openEditor(edit.dataset.edit); return; }
      const remove = e.target.closest('[data-remove]');
      if (remove) {
        if (confirm('¿Eliminar esta rutina?')) { Storage.deleteRoutine(remove.dataset.remove); renderGroups(); }
        return;
      }
    });
  }

  function startRoutine(id) {
    const routine = Storage.getRoutines().find(r => r.id === id);
    if (!routine) return;
    App.switchPage('workout');
    Workouts.startFromRoutine(routine);
  }

  // ---------------- Editor ----------------

  function mountPicker() {
    const container = document.getElementById('routine-exercise-picker');
    picker = ExercisePicker.mount(container, {
      layout: 'library',
      placeholder: 'Buscar en la biblioteca...',
      excludeIds: () => editorExercises.map(e => e.exerciseId),
      onSelect: (ex) => addExercise(ex.id),
      onCreate: (name) => openInlineNewExercise(name),
    });
  }

  function openInlineNewExercise(prefillName) {
    document.getElementById('inline-ex-routine-name').value = prefillName || '';
    document.getElementById('inline-new-exercise-routine').style.display = 'grid';
    document.getElementById('inline-ex-routine-name').focus();
  }

  function saveInlineNewExercise() {
    const name = document.getElementById('inline-ex-routine-name').value.trim();
    if (!name) return;
    const group = document.getElementById('inline-ex-routine-group').value;
    const equipment = document.getElementById('inline-ex-routine-equipment').value;
    const ex = Storage.addExercise(name, group, equipment);
    document.getElementById('inline-ex-routine-name').value = '';
    document.getElementById('inline-new-exercise-routine').style.display = 'none';
    addExercise(ex.id);
  }

  function refreshPicker() {
    if (picker) picker.refresh();
  }

  function renderFolderSelect() {
    const sel = document.getElementById('routine-folder-select');
    const folders = Storage.getFolders();
    sel.innerHTML = '<option value="">Sin carpeta</option>' + folders.map(f => `<option value="${f.id}">${escapeHtml(f.name)}</option>`).join('');
    sel.value = editorFolderId || '';
  }

  function openEditor(routineId) {
    if (routineId) {
      const routine = Storage.getRoutines().find(r => r.id === routineId);
      if (!routine) return;
      editingId = routineId;
      editorExercises = routine.exercises.map(e => ({ ...e }));
      editorFolderId = routine.folderId || null;
      document.getElementById('routine-name').value = routine.name;
      document.getElementById('routine-editor-title').textContent = 'Editar rutina';
    } else {
      editingId = null;
      editorExercises = [];
      editorFolderId = null;
      document.getElementById('routine-name').value = '';
      document.getElementById('routine-editor-title').textContent = 'Nueva rutina';
    }
    Workouts.showView('editor');
    renderFolderSelect();
    renderEditorExercises();
    refreshPicker();
  }

  function closeEditor() {
    Workouts.showView('browse');
  }

  function showBrowse() {
    Workouts.showView('browse');
  }

  function renderSummary() {
    const totalSets = editorExercises.reduce((s, e) => s + (e.targetSets || 0), 0);
    document.getElementById('routine-summary-stats').innerHTML = `
      <div class="stat-box"><span class="stat-label">Ejercicios</span><span class="stat-value">${editorExercises.length}</span></div>
      <div class="stat-box"><span class="stat-label">Series totales</span><span class="stat-value">${totalSets}</span></div>
    `;
  }

  function renderEditorExercises() {
    const container = document.getElementById('routine-editor-exercises');
    renderSummary();
    if (editorExercises.length === 0) {
      container.innerHTML = '<p class="hint empty-hint">Añade ejercicios desde la Biblioteca de la derecha. El peso y las reps los pones tú durante la sesión.</p>';
      return;
    }
    const exercises = Storage.getExercises();
    container.innerHTML = editorExercises.map((re, idx) => {
      const ex = exercises.find(x => x.id === re.exerciseId);
      return `
        <div class="panel exercise-card">
          <div class="exercise-card-header">
            ${exerciseAvatarHtml(ex ? ex.group : 'Otro')}
            <div class="exercise-card-title"><strong>${ex ? escapeHtml(ex.name) : '?'}</strong></div>
            <div class="exercise-card-actions">
              <button class="icon-btn" ${idx === 0 ? 'disabled' : ''} onclick="Routines.moveExercise(${idx}, -1)">↑</button>
              <button class="icon-btn" ${idx === editorExercises.length - 1 ? 'disabled' : ''} onclick="Routines.moveExercise(${idx}, 1)">↓</button>
              <button class="icon-btn" onclick="Routines.removeExercise(${idx})">✕</button>
            </div>
          </div>

          <button class="btn small ghost note-toggle-btn" onclick="Routines.toggleNote(${idx})">${re.note ? 'Editar nota' : '+ Añadir nota'}</button>
          <textarea class="routine-note-input" placeholder="Nota (ej: técnica, tempo...)" style="display:${re._showNote || re.note ? 'block' : 'none'}"
            onchange="Routines.updateNote(${idx}, this.value)">${escapeHtml(re.note || '')}</textarea>

          <div class="routine-mini-row">
            <label>Series <div class="stepper">
              <button type="button" class="icon-btn" onclick="Routines.updateTargetSets(${idx}, -1)">−</button>
              <span>${re.targetSets}</span>
              <button type="button" class="icon-btn" onclick="Routines.updateTargetSets(${idx}, 1)">+</button>
            </div></label>
            <label>Descanso
              <select onchange="Routines.updateRest(${idx}, this.value)">
                ${REST_OPTIONS.map(o => `<option value="${o.value}" ${Number(re.restSeconds) === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
              </select>
            </label>
          </div>
        </div>
      `;
    }).join('');
  }

  function addExercise(exerciseId) {
    if (editorExercises.some(e => e.exerciseId === exerciseId)) return;
    editorExercises.push({ exerciseId, note: '', restSeconds: 90, targetSets: 3 });
    renderEditorExercises();
    refreshPicker();
  }

  function removeExercise(idx) {
    editorExercises.splice(idx, 1);
    renderEditorExercises();
    refreshPicker();
  }

  function moveExercise(idx, dir) {
    const target = idx + dir;
    if (target < 0 || target >= editorExercises.length) return;
    const [item] = editorExercises.splice(idx, 1);
    editorExercises.splice(target, 0, item);
    renderEditorExercises();
  }

  function toggleNote(idx) {
    editorExercises[idx]._showNote = !editorExercises[idx]._showNote;
    renderEditorExercises();
  }

  function updateNote(idx, value) {
    editorExercises[idx].note = value;
  }

  function updateRest(idx, value) {
    editorExercises[idx].restSeconds = Number(value);
  }

  function updateTargetSets(idx, delta) {
    const next = (editorExercises[idx].targetSets || 1) + delta;
    editorExercises[idx].targetSets = Math.max(1, Math.min(20, next));
    renderEditorExercises();
  }

  function save() {
    const name = document.getElementById('routine-name').value.trim();
    const msg = document.getElementById('save-routine-msg');
    if (!name) {
      msg.textContent = 'Ponle un título a la rutina.';
      msg.className = 'msg error';
      return;
    }
    if (editorExercises.length === 0) {
      msg.textContent = 'Añade al menos un ejercicio.';
      msg.className = 'msg error';
      return;
    }
    const cleanExercises = editorExercises.map(e => ({
      exerciseId: e.exerciseId, note: e.note || '', restSeconds: e.restSeconds || 0, targetSets: e.targetSets || 1,
    }));
    if (editingId) {
      Storage.updateRoutine({ id: editingId, name, exercises: cleanExercises, folderId: editorFolderId });
    } else {
      Storage.addRoutine({ name, exercises: cleanExercises, folderId: editorFolderId });
    }
    closeEditor();
  }

  function bindEditorEvents() {
    document.getElementById('save-routine-btn').addEventListener('click', save);
    document.getElementById('routine-editor-back-btn').addEventListener('click', closeEditor);
    document.getElementById('routine-folder-select').addEventListener('change', (e) => { editorFolderId = e.target.value || null; });
    document.getElementById('toggle-new-exercise-routine-btn').addEventListener('click', () => openInlineNewExercise(''));
    document.getElementById('inline-ex-routine-save-btn').addEventListener('click', saveInlineNewExercise);

    const groupSel = document.getElementById('inline-ex-routine-group');
    const equipSel = document.getElementById('inline-ex-routine-equipment');
    groupSel.innerHTML = MUSCLE_GROUPS.map(g => `<option value="${g}">${g}</option>`).join('');
    equipSel.innerHTML = EQUIPMENT_TYPES.map(e => `<option value="${e}">${e}</option>`).join('');
  }

  function init() {
    bindBrowseEvents();
    bindEditorEvents();
    mountPicker();
  }

  return {
    init, renderList: renderGroups, showBrowse, refreshPicker,
    addExercise, removeExercise, moveExercise, toggleNote, updateNote, updateRest, updateTargetSets,
    start: startRoutine, edit: openEditor,
    remove: (id) => { if (confirm('¿Eliminar esta rutina?')) { Storage.deleteRoutine(id); renderGroups(); } },
  };
})();
