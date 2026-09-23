/* Capa de datos: todo se guarda en localStorage, namespaced con "gymapp_" */

const Storage = (() => {
  const KEYS = {
    exercises: 'gymapp_exercises',
    workouts: 'gymapp_workouts',
    routines: 'gymapp_routines',
    folders: 'gymapp_folders',
    seeded: 'gymapp_seeded_v3',
    migratedBuiltin: 'gymapp_migrated_builtin_v1',
    measurements: 'gymapp_measurements',
  };

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      console.error('Error leyendo', key, e);
      return fallback;
    }
  }

  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  // ---- Exercises ----
  function getExercises() {
    return read(KEYS.exercises, []);
  }
  function saveExercises(list) {
    write(KEYS.exercises, list);
  }
  function addExercise(name, group, equipment) {
    const list = getExercises();
    const ex = { id: uid(), name, group: group || 'Otro', equipment: equipment || 'Otro', builtin: false };
    list.push(ex);
    saveExercises(list);
    return ex;
  }
  function deleteExercise(id) {
    saveExercises(getExercises().filter(e => e.id !== id));
  }

  // ---- Workouts ----
  function getWorkouts() {
    return read(KEYS.workouts, []).sort((a, b) => b.date.localeCompare(a.date));
  }
  function saveWorkouts(list) {
    write(KEYS.workouts, list);
  }
  function addWorkout(workout) {
    const list = read(KEYS.workouts, []);
    workout.id = uid();
    list.push(workout);
    saveWorkouts(list);
    return workout;
  }
  function deleteWorkout(id) {
    saveWorkouts(read(KEYS.workouts, []).filter(w => w.id !== id));
  }

  // ---- Routines (rutinas / plantillas) ----
  // Formato de cada ejercicio de una rutina: { exerciseId, note, restSeconds, targetSets }.
  // No se pide peso ni repeticiones al crear la rutina: eso se rellena durante la sesión.
  // Los formatos antiguos (con sets/reps o targetReps) se normalizan al leerlos.
  function normalizeRoutineExercise(re) {
    if (!re) return { exerciseId: '', note: '', restSeconds: 0, targetSets: 3 };
    if (Array.isArray(re.sets)) {
      return {
        exerciseId: re.exerciseId,
        note: re.note || '',
        restSeconds: re.restSeconds || 0,
        targetSets: re.sets.length || 3,
      };
    }
    return {
      exerciseId: re.exerciseId,
      note: re.note || '',
      restSeconds: re.restSeconds || 0,
      targetSets: re.targetSets || 3,
    };
  }

  function getRoutines() {
    const list = read(KEYS.routines, []);
    return list.map(r => ({ ...r, exercises: (r.exercises || []).map(normalizeRoutineExercise) }));
  }
  function saveRoutines(list) {
    write(KEYS.routines, list);
  }
  function addRoutine(routine) {
    const list = read(KEYS.routines, []);
    routine.id = uid();
    list.push(routine);
    saveRoutines(list);
    return routine;
  }
  function updateRoutine(routine) {
    const list = read(KEYS.routines, []);
    const idx = list.findIndex(r => r.id === routine.id);
    if (idx >= 0) list[idx] = routine;
    saveRoutines(list);
  }
  function deleteRoutine(id) {
    saveRoutines(read(KEYS.routines, []).filter(r => r.id !== id));
  }

  // ---- Carpetas de rutinas ----
  function getFolders() {
    return read(KEYS.folders, []);
  }
  function saveFolders(list) {
    write(KEYS.folders, list);
  }
  function addFolder(name) {
    const list = getFolders();
    const folder = { id: uid(), name };
    list.push(folder);
    saveFolders(list);
    return folder;
  }
  function renameFolder(id, name) {
    const list = getFolders();
    const f = list.find(x => x.id === id);
    if (f) { f.name = name; saveFolders(list); }
  }
  function deleteFolder(id) {
    saveFolders(getFolders().filter(f => f.id !== id));
    const routines = read(KEYS.routines, []).map(r => r.folderId === id ? { ...r, folderId: null } : r);
    saveRoutines(routines);
  }

  // ---- Seed (first run only) ----
  function seedIfNeeded() {
    if (!read(KEYS.seeded, false)) {
      if (getExercises().length === 0 && typeof DEFAULT_EXERCISES !== 'undefined') {
        saveExercises(DEFAULT_EXERCISES.map(e => ({ id: uid(), name: e.name, group: e.group, equipment: e.equipment, builtin: true })));
      }
      write(KEYS.seeded, true);
    }
    migrateBuiltinFlag();
  }

  // Para quien ya tenía ejercicios guardados antes de distinguir "de fábrica" de
  // "creado por mí": marca como builtin los que coincidan por nombre con la lista de serie.
  function migrateBuiltinFlag() {
    if (read(KEYS.migratedBuiltin, false)) return;
    if (typeof DEFAULT_EXERCISES !== 'undefined') {
      const defaultNames = new Set(DEFAULT_EXERCISES.map(e => e.name));
      const list = getExercises();
      let changed = false;
      list.forEach(e => {
        if (e.builtin === undefined) {
          e.builtin = defaultNames.has(e.name);
          changed = true;
        }
      });
      if (changed) saveExercises(list);
    }
    write(KEYS.migratedBuiltin, true);
  }

  // ---- Medidas corporales ----
  function getMeasurements() {
    return read(KEYS.measurements, []).sort((a, b) => b.date.localeCompare(a.date));
  }
  function saveMeasurements(list) {
    write(KEYS.measurements, list);
  }
  function addMeasurement(entry) {
    const list = read(KEYS.measurements, []);
    entry.id = uid();
    list.push(entry);
    saveMeasurements(list);
    return entry;
  }
  function deleteMeasurement(id) {
    saveMeasurements(read(KEYS.measurements, []).filter(m => m.id !== id));
  }

  // ---- Backup ----
  function exportAll() {
    return {
      version: 5,
      exportedAt: new Date().toISOString(),
      exercises: getExercises(),
      workouts: read(KEYS.workouts, []),
      routines: read(KEYS.routines, []),
      folders: getFolders(),
      measurements: read(KEYS.measurements, []),
    };
  }
  function importAll(data) {
    if (!data || typeof data !== 'object') throw new Error('Archivo inválido');
    if (Array.isArray(data.exercises)) saveExercises(data.exercises);
    if (Array.isArray(data.workouts)) saveWorkouts(data.workouts);
    if (Array.isArray(data.routines)) saveRoutines(data.routines);
    if (Array.isArray(data.folders)) saveFolders(data.folders);
    if (Array.isArray(data.measurements)) saveMeasurements(data.measurements);
  }
  function resetAll() {
    Object.values(KEYS).forEach(k => localStorage.removeItem(k));
  }

  return {
    uid,
    getExercises, addExercise, deleteExercise,
    getWorkouts, addWorkout, deleteWorkout,
    getRoutines, addRoutine, updateRoutine, deleteRoutine,
    getFolders, addFolder, renameFolder, deleteFolder,
    getMeasurements, addMeasurement, deleteMeasurement,
    seedIfNeeded, exportAll, importAll, resetAll,
  };
})();
