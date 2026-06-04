/**
 * state.js — Управление состоянием приложения и localStorage
 * Глобальный объект: TodoApp.State
 */
window.TodoApp = window.TodoApp || {};

TodoApp.State = (function() {
  const STORAGE_KEY = 'todolist_app_data';
  const DEBOUNCE_DELAY = 500;

  // Структура данных по умолчанию
  const defaultData = {
    projects: [],
    tasks: [],
    columns: [
      { id: 'new', title: 'Заказчики думают', type: 'new', order: 0 },
      { id: 'in_progress', title: 'Взял в работу', type: 'in_progress', order: 1 },
      { id: 'review', title: 'Сдал, ожидаю ответа', type: 'review', order: 2 },
      { id: 'done', title: 'Выполнено', type: 'done', order: 3 }
    ],
    theme: 'dark',
    activeProjectId: null,
    recentSearches: [],
    settings: {
      notificationsEnabled: true,
      defaultView: 'kanban'
    }
  };

  let data = {};
  let saveTimeout = null;
  let lastSaveTime = null;
  let onChangeCallbacks = [];

  // ===== ВНУТРЕННИЕ МЕТОДЫ =====

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
  }

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Валидация базовой структуры
        if (parsed && typeof parsed === 'object') {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Ошибка загрузки из localStorage:', e.message);
      // Если данные повреждены, создаём бэкап и возвращаем null
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          localStorage.setItem(STORAGE_KEY + '_backup', raw);
        }
        localStorage.removeItem(STORAGE_KEY);
      } catch (_) { /* игнорируем */ }
    }
    return null;
  }

  function saveToStorage() {
    try {
      const serialized = JSON.stringify(data);
      localStorage.setItem(STORAGE_KEY, serialized);
      lastSaveTime = Date.now();
      return true;
    } catch (e) {
      if (e.name === 'QuotaExceededError' || e.code === 22) {
        console.error('localStorage переполнен. Невозможно сохранить данные.');
        TodoApp.UI.showNotification('Недостаточно места в localStorage. Экспортируйте данные.', 'error');
      } else {
        console.error('Ошибка сохранения в localStorage:', e.message);
      }
      return false;
    }
  }

  // ===== ПУБЛИЧНЫЙ API =====

  function init() {
    const stored = loadFromStorage();
    if (stored) {
      data = stored;
      // Убеждаемся, что есть колонки по умолчанию
      if (!data.columns || data.columns.length === 0) {
        data.columns = deepClone(defaultData.columns);
      }
      // Убеждаемся, что есть все необходимые поля
      if (!data.recentSearches) data.recentSearches = [];
      if (!data.settings) data.settings = defaultData.settings;
      if (!data.theme) data.theme = 'dark';
    } else {
      data = deepClone(defaultData);
      // Создаём демо-проект при первом запуске
      const demoProject = {
        id: generateId(),
        name: 'Мой первый проект',
        description: 'Демонстрационный проект',
        createdAt: new Date().toISOString(),
        color: '#4c6ef5',
        icon: '📋'
      };
      data.projects.push(demoProject);
      data.activeProjectId = demoProject.id;
      saveToStorage();
    }

    // Применяем тему
    document.documentElement.setAttribute('data-theme', data.theme);
  }

  function getData() {
    return data;
  }

  function save(callback) {
    const success = saveToStorage();
    if (success && callback) callback();
    return success;
  }

  function saveDebounced() {
    const indicator = document.getElementById('saveIndicator');
    if (indicator) {
      indicator.textContent = 'Сохранение...';
      indicator.classList.add('saving');
    }
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      saveToStorage();
      saveTimeout = null;
      if (indicator) {
        indicator.textContent = 'Сохранено';
        indicator.classList.remove('saving');
        indicator.classList.add('saved');
        setTimeout(() => indicator.classList.remove('saved'), 2000);
      }
      onChangeCallbacks.forEach(fn => fn(data));
    }, DEBOUNCE_DELAY);
  }

  function onChange(callback) {
    onChangeCallbacks.push(callback);
    return () => {
      onChangeCallbacks = onChangeCallbacks.filter(fn => fn !== callback);
    };
  }

  function getTheme() {
    return data.theme;
  }

  function setTheme(theme) {
    data.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    saveDebounced();
  }

  function toggleTheme() {
    const newTheme = data.theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
  }

  function exportData() {
    return JSON.stringify(data, null, 2);
  }

  function importData(jsonString) {
    try {
      const imported = JSON.parse(jsonString);
      // Базовая валидация
      if (!imported.projects || !Array.isArray(imported.projects)) {
        throw new Error('Неверный формат данных: отсутствует поле projects');
      }
      if (!imported.tasks || !Array.isArray(imported.tasks)) {
        throw new Error('Неверный формат данных: отсутствует поле tasks');
      }
      data = imported;
      saveToStorage();
      return true;
    } catch (e) {
      throw new Error('Ошибка импорта: ' + e.message);
    }
  }

  function clearAllData() {
    data = deepClone(defaultData);
    saveToStorage();
    // Создаём демо-проект
    const demoProject = {
      id: generateId(),
      name: 'Мой первый проект',
      description: 'Демонстрационный проект',
      createdAt: new Date().toISOString(),
      color: '#4c6ef5',
      icon: '📋'
    };
    data.projects.push(demoProject);
    data.activeProjectId = demoProject.id;
    saveToStorage();
  }

  function addRecentSearch(query) {
    if (!query.trim()) return;
    data.recentSearches = data.recentSearches.filter(s => s !== query);
    data.recentSearches.unshift(query);
    if (data.recentSearches.length > 10) {
      data.recentSearches = data.recentSearches.slice(0, 10);
    }
    saveDebounced();
  }

  function getRecentSearches() {
    return data.recentSearches || [];
  }

  function getDefaultColumns() {
    return data.columns || deepClone(defaultData.columns);
  }

  function updateColumns(columns) {
    data.columns = columns;
    saveDebounced();
  }

  return {
    init,
    getData,
    save,
    saveDebounced,
    onChange,
    getTheme,
    setTheme,
    toggleTheme,
    exportData,
    importData,
    clearAllData,
    addRecentSearch,
    getRecentSearches,
    getDefaultColumns,
    updateColumns,
    generateId,
    deepClone
  };
})();
