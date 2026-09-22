/* Lógica y render de la pestaña Nutrición, con búsqueda local + Open Food Facts */

const Nutrition = (() => {
  const MEALS = ['Desayuno', 'Comida', 'Cena', 'Snack'];
  const OFF_SEARCH_URL = 'https://world.openfoodfacts.org/cgi/search.pl';

  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  function currentDate() {
    return document.getElementById('nutrition-date').value || todayStr();
  }

  function round1(n) {
    return Math.round(n * 10) / 10;
  }

  function macrosForGrams(food, grams) {
    const factor = grams / 100;
    return {
      kcal: food.kcal * factor,
      protein: food.protein * factor,
      carbs: food.carbs * factor,
      fat: food.fat * factor,
    };
  }

  function initDateInput() {
    const input = document.getElementById('nutrition-date');
    input.value = todayStr();
    input.addEventListener('change', renderDay);
  }

  function renderDay() {
    renderDayTotals();
    renderMealPanels();
  }

  function renderDayTotals() {
    const date = currentDate();
    const logs = Storage.getFoodLogs().filter(l => l.date === date);
    const foods = Storage.getFoods();
    const settings = Storage.getSettings();

    const totals = logs.reduce((acc, l) => {
      const food = foods.find(f => f.id === l.foodId);
      if (!food) return acc;
      const m = macrosForGrams(food, l.grams);
      acc.kcal += m.kcal; acc.protein += m.protein; acc.carbs += m.carbs; acc.fat += m.fat;
      return acc;
    }, { kcal: 0, protein: 0, carbs: 0, fat: 0 });

    const container = document.getElementById('nutrition-day-totals');
    container.innerHTML = `
      <div class="stat-box"><span class="stat-label">Calorías</span><span class="stat-value">${Math.round(totals.kcal)} / ${settings.kcal} kcal</span>${bar(totals.kcal, settings.kcal)}</div>
      <div class="stat-box"><span class="stat-label">Proteína</span><span class="stat-value">${round1(totals.protein)} / ${settings.protein} g</span>${bar(totals.protein, settings.protein)}</div>
      <div class="stat-box"><span class="stat-label">Carbohidratos</span><span class="stat-value">${round1(totals.carbs)} / ${settings.carbs} g</span>${bar(totals.carbs, settings.carbs)}</div>
      <div class="stat-box"><span class="stat-label">Grasas</span><span class="stat-value">${round1(totals.fat)} / ${settings.fat} g</span>${bar(totals.fat, settings.fat)}</div>
    `;
  }

  function bar(value, target) {
    const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;
    const over = value > target;
    return `<div class="progress-bar"><div class="progress-fill ${over ? 'over' : ''}" style="width:${pct}%"></div></div>`;
  }

  function renderMealPanels() {
    const date = currentDate();
    const logs = Storage.getFoodLogs().filter(l => l.date === date);
    const foods = Storage.getFoods();
    const container = document.getElementById('meal-panels');

    container.innerHTML = MEALS.map(meal => {
      const mealLogs = logs.filter(l => l.meal === meal);
      const rows = mealLogs.map(l => {
        const food = foods.find(f => f.id === l.foodId);
        if (!food) return '';
        const m = macrosForGrams(food, l.grams);
        return `
          <div class="list-item">
            <div>
              <strong>${food.name}</strong> <span class="hint">${l.grams} g</span>
              <div class="hint">${Math.round(m.kcal)} kcal · P ${round1(m.protein)}g · C ${round1(m.carbs)}g · G ${round1(m.fat)}g</div>
            </div>
            <button class="icon-btn" onclick="Nutrition.deleteLog('${l.id}')">🗑️</button>
          </div>
        `;
      }).join('');
      const mealTotal = mealLogs.reduce((sum, l) => {
        const food = foods.find(f => f.id === l.foodId);
        return food ? sum + macrosForGrams(food, l.grams).kcal : sum;
      }, 0);
      return `
        <div class="meal-block">
          <h3>${meal} <span class="hint">${Math.round(mealTotal)} kcal</span></h3>
          ${rows || '<p class="hint">Nada añadido todavía.</p>'}
        </div>
      `;
    }).join('');
  }

  // ---- Búsqueda local ----
  function searchFoods(query) {
    const foods = Storage.getFoods();
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return foods.filter(f =>
      f.name.toLowerCase().includes(q) ||
      (f.brand && f.brand.toLowerCase().includes(q)) ||
      (f.store && f.store.toLowerCase().includes(q))
    ).slice(0, 25);
  }

  // ---- Búsqueda online en Open Food Facts (con caché local al añadir) ----
  let offSearchToken = 0;
  let offResultsByCode = {}; // cache de los últimos resultados OFF mostrados, por código de barras

  function extractOFFFood(product) {
    const n = product.nutriments || {};
    const kcal = n['energy-kcal_100g'] ?? n['energy-kcal'] ?? null;
    if (kcal == null || !product.code) return null;
    const name = product.product_name_es || product.product_name || product.generic_name;
    if (!name) return null;
    return {
      code: product.code,
      name: product.quantity ? `${name}` : name,
      brand: (product.brands || '').split(',')[0].trim(),
      store: 'Open Food Facts',
      category: 'Open Food Facts',
      kcal: Math.round(kcal * 10) / 10,
      protein: Math.round((n['proteins_100g'] || 0) * 10) / 10,
      carbs: Math.round((n['carbohydrates_100g'] || 0) * 10) / 10,
      fat: Math.round((n['fat_100g'] || 0) * 10) / 10,
      source: 'off',
    };
  }

  async function searchOFF(query, token) {
    const statusEl = document.getElementById('food-search-status');
    try {
      const url = `${OFF_SEARCH_URL}?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=20&fields=code,product_name,product_name_es,generic_name,brands,quantity,nutriments`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (token !== offSearchToken) return; // el usuario ya cambió la búsqueda
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const products = (data.products || []).map(extractOFFFood).filter(Boolean);
      // localiza ya en base local (ya cacheados antes) para no duplicar visualmente
      const localCodes = new Set(Storage.getFoods().filter(f => f.code).map(f => f.code));
      const fresh = products.filter(p => !localCodes.has(p.code));
      offResultsByCode = {};
      fresh.forEach(p => { offResultsByCode[p.code] = p; });
      if (statusEl) statusEl.textContent = fresh.length ? `🌐 +${fresh.length} de Open Food Facts` : '🌐 Sin más resultados online';
      renderOFFResults(fresh);
    } catch (err) {
      if (token !== offSearchToken) return;
      if (statusEl) statusEl.textContent = '⚠️ Sin conexión con Open Food Facts, mostrando solo tu base local';
    }
  }

  function renderOFFResults(products) {
    const container = document.getElementById('food-search-results');
    const offHtml = products.map(f => foodResultRow(f, f.code, true)).join('');
    const offContainer = document.getElementById('food-search-results-off');
    if (offContainer) offContainer.innerHTML = offHtml;
  }

  function foodResultRow(f, key, isOFF) {
    return `
      <div class="list-item food-pick">
        <div>
          <strong>${f.name}</strong> ${f.brand ? '<span class="tag">' + f.brand + '</span>' : ''} <span class="tag store">${f.store}</span>
          <div class="hint">${f.kcal} kcal · P ${f.protein}g · C ${f.carbs}g · G ${f.fat}g (por 100g)</div>
        </div>
        <div class="add-food-inline">
          <input type="number" min="1" placeholder="g" class="grams-input" id="grams-${key}" value="100">
          <select id="meal-${key}">
            ${MEALS.map(m => `<option value="${m}">${m}</option>`).join('')}
          </select>
          <button class="btn small" onclick="${isOFF ? `Nutrition.logOFFFood('${key}')` : `Nutrition.logFood('${key}')`}">Añadir</button>
        </div>
      </div>
    `;
  }

  function renderFoodSearchResults() {
    const query = document.getElementById('food-search').value;
    const statusEl = document.getElementById('food-search-status');
    const container = document.getElementById('food-search-results');
    offSearchToken++;
    const token = offSearchToken;

    if (!query.trim()) {
      container.innerHTML = '';
      if (statusEl) statusEl.textContent = '';
      return;
    }

    const localResults = searchFoods(query);
    container.innerHTML = `
      <div id="food-search-results-local">${localResults.map(f => foodResultRow(f, f.id, false)).join('')}</div>
      <div id="food-search-results-off"></div>
      ${localResults.length === 0 ? '<p class="hint">Sin resultados locales todavía. Buscando en Open Food Facts...</p>' : ''}
    `;

    if (statusEl) statusEl.textContent = '🌐 Buscando en Open Food Facts...';
    clearTimeout(renderFoodSearchResults._debounce);
    renderFoodSearchResults._debounce = setTimeout(() => searchOFF(query, token), 350);
  }

  function logFood(foodId) {
    const grams = Number(document.getElementById(`grams-${foodId}`).value) || 100;
    const meal = document.getElementById(`meal-${foodId}`).value;
    Storage.addFoodLog({ date: currentDate(), meal, foodId, grams });
    renderDay();
    App.refreshDashboard();
  }

  function logOFFFood(code) {
    const food = offResultsByCode[code];
    if (!food) return;
    const grams = Number(document.getElementById(`grams-${code}`).value) || 100;
    const meal = document.getElementById(`meal-${code}`).value;
    const saved = Storage.upsertFoodFromOFF({ ...food });
    Storage.addFoodLog({ date: currentDate(), meal, foodId: saved.id, grams });
    renderDay();
    App.refreshDashboard();
  }

  function deleteLog(id) {
    Storage.deleteFoodLog(id);
    renderDay();
    App.refreshDashboard();
  }

  function renderFoodsDb() {
    const search = document.getElementById('foods-db-search').value.trim().toLowerCase();
    const storeFilter = document.getElementById('foods-db-store-filter').value;
    let foods = Storage.getFoods();
    if (search) {
      foods = foods.filter(f => f.name.toLowerCase().includes(search) || (f.brand && f.brand.toLowerCase().includes(search)));
    }
    if (storeFilter) {
      foods = foods.filter(f => f.store === storeFilter);
    }
    foods = foods.sort((a, b) => a.name.localeCompare(b.name));
    const container = document.getElementById('foods-db-list');
    container.innerHTML = foods.slice(0, 200).map(f => `
      <div class="list-item">
        <div>
          <strong>${f.name}</strong> ${f.brand ? '<span class="tag">' + f.brand + '</span>' : ''} <span class="tag store">${f.store}</span>
          <div class="hint">${f.kcal} kcal · P ${f.protein}g · C ${f.carbs}g · G ${f.fat}g (por 100g)</div>
        </div>
        ${f.custom || f.source === 'off' ? `<button class="icon-btn" onclick="Nutrition.deleteFood('${f.id}')">🗑️</button>` : ''}
      </div>
    `).join('') + (foods.length > 200 ? `<p class="hint">Mostrando 200 de ${foods.length} resultados, afina la búsqueda.</p>` : '');
  }

  function deleteFood(id) {
    if (!confirm('¿Eliminar este alimento de la base de datos?')) return;
    Storage.deleteFood(id);
    renderFoodsDb();
  }

  function addCustomFood() {
    const name = document.getElementById('cf-name').value.trim();
    const brand = document.getElementById('cf-brand').value.trim();
    const store = document.getElementById('cf-store').value;
    const kcal = Number(document.getElementById('cf-kcal').value) || 0;
    const protein = Number(document.getElementById('cf-protein').value) || 0;
    const carbs = Number(document.getElementById('cf-carbs').value) || 0;
    const fat = Number(document.getElementById('cf-fat').value) || 0;
    const msg = document.getElementById('add-food-msg');

    if (!name) {
      msg.textContent = 'Ponle un nombre al alimento.';
      msg.className = 'msg error';
      return;
    }

    Storage.addFood({ name, brand, store, category: 'Personalizado', kcal, protein, carbs, fat, custom: true });
    ['cf-name', 'cf-brand', 'cf-kcal', 'cf-protein', 'cf-carbs', 'cf-fat'].forEach(id => document.getElementById(id).value = '');
    msg.textContent = '¡Alimento añadido!';
    msg.className = 'msg success';
    setTimeout(() => { msg.textContent = ''; }, 2000);
    renderFoodsDb();
  }

  function bindEvents() {
    document.getElementById('food-search').addEventListener('input', renderFoodSearchResults);
    document.getElementById('foods-db-search').addEventListener('input', renderFoodsDb);
    document.getElementById('foods-db-store-filter').addEventListener('change', renderFoodsDb);
    document.getElementById('add-custom-food-btn').addEventListener('click', addCustomFood);
  }

  function init() {
    bindEvents();
    initDateInput();
    renderDay();
    renderFoodsDb();
  }

  return {
    init, renderDay, renderFoodsDb, logFood, logOFFFood, deleteLog, deleteFood,
    macrosForGrams, MEALS,
  };
})();
