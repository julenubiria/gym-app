/* Capa de datos: todo se guarda en localStorage, namespaced con "gymapp_" */

const Storage = (() => {
  const KEYS = {
    exercises: 'gymapp_exercises',
    workouts: 'gymapp_workouts',
    routines: 'gymapp_routines',
    foods: 'gymapp_foods',
    foodLogs: 'gymapp_foodLogs',
    settings: 'gymapp_settings',
    seeded: 'gymapp_seeded_v2',
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
    const ex = { id: uid(), name, group: group || 'Otro', equipment: equipment || 'Otro' };
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
  function getRoutines() {
    return read(KEYS.routines, []);
  }
  function saveRoutines(list) {
    write(KEYS.routines, list);
  }
  function addRoutine(routine) {
    const list = getRoutines();
    routine.id = uid();
    list.push(routine);
    saveRoutines(list);
    return routine;
  }
  function updateRoutine(routine) {
    const list = getRoutines();
    const idx = list.findIndex(r => r.id === routine.id);
    if (idx >= 0) list[idx] = routine;
    saveRoutines(list);
  }
  function deleteRoutine(id) {
    saveRoutines(getRoutines().filter(r => r.id !== id));
  }

  // ---- Foods ----
  function getFoods() {
    return read(KEYS.foods, []);
  }
  function saveFoods(list) {
    write(KEYS.foods, list);
  }
  function addFood(food) {
    const list = getFoods();
    food.id = uid();
    list.push(food);
    saveFoods(list);
    return food;
  }
  function deleteFood(id) {
    saveFoods(getFoods().filter(f => f.id !== id));
  }
  function findFoodByCode(code) {
    if (!code) return null;
    return getFoods().find(f => f.code === code) || null;
  }
  // Guarda (o actualiza) en la base local un alimento venido de Open Food Facts,
  // para que quede cacheado y disponible sin conexión la próxima vez.
  function upsertFoodFromOFF(food) {
    const list = getFoods();
    const existing = food.code ? list.find(f => f.code === food.code) : null;
    if (existing) {
      Object.assign(existing, food);
      saveFoods(list);
      return existing;
    }
    food.id = uid();
    list.push(food);
    saveFoods(list);
    return food;
  }

  // ---- Food logs ----
  function getFoodLogs() {
    return read(KEYS.foodLogs, []);
  }
  function saveFoodLogs(list) {
    write(KEYS.foodLogs, list);
  }
  function addFoodLog(entry) {
    const list = getFoodLogs();
    entry.id = uid();
    list.push(entry);
    saveFoodLogs(list);
    return entry;
  }
  function deleteFoodLog(id) {
    saveFoodLogs(getFoodLogs().filter(l => l.id !== id));
  }

  // ---- Settings ----
  function getSettings() {
    return read(KEYS.settings, { kcal: 2200, protein: 150, carbs: 220, fat: 70 });
  }
  function saveSettings(s) {
    write(KEYS.settings, s);
  }

  // ---- Seed (first run only) ----
  function seedIfNeeded() {
    if (read(KEYS.seeded, false)) return;
    if (getExercises().length === 0 && typeof DEFAULT_EXERCISES !== 'undefined') {
      saveExercises(DEFAULT_EXERCISES.map(e => ({ id: uid(), name: e.name, group: e.group, equipment: e.equipment })));
    }
    if (getFoods().length === 0 && typeof SEED_FOODS !== 'undefined') {
      saveFoods(SEED_FOODS.map(f => ({ id: uid(), ...f })));
    }
    write(KEYS.seeded, true);
  }

  // ---- Backup ----
  function exportAll() {
    return {
      version: 2,
      exportedAt: new Date().toISOString(),
      exercises: getExercises(),
      workouts: read(KEYS.workouts, []),
      routines: getRoutines(),
      foods: getFoods(),
      foodLogs: getFoodLogs(),
      settings: getSettings(),
    };
  }
  function importAll(data) {
    if (!data || typeof data !== 'object') throw new Error('Archivo inválido');
    if (Array.isArray(data.exercises)) saveExercises(data.exercises);
    if (Array.isArray(data.workouts)) saveWorkouts(data.workouts);
    if (Array.isArray(data.routines)) saveRoutines(data.routines);
    if (Array.isArray(data.foods)) saveFoods(data.foods);
    if (Array.isArray(data.foodLogs)) saveFoodLogs(data.foodLogs);
    if (data.settings) saveSettings(data.settings);
  }
  function resetAll() {
    Object.values(KEYS).forEach(k => localStorage.removeItem(k));
  }

  return {
    uid,
    getExercises, addExercise, deleteExercise,
    getWorkouts, addWorkout, deleteWorkout,
    getRoutines, addRoutine, updateRoutine, deleteRoutine,
    getFoods, addFood, deleteFood, findFoodByCode, upsertFoodFromOFF,
    getFoodLogs, addFoodLog, deleteFoodLog,
    getSettings, saveSettings,
    seedIfNeeded, exportAll, importAll, resetAll,
  };
})();
