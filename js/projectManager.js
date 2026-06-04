/**
 * projectManager.js — Управление проектами
 * Глобальный объект: TodoApp.Projects
 */
TodoApp.Projects = (function() {
  const COLORS = ['#4c6ef5', '#7950f2', '#e03131', '#2f9e44', '#f08c00', '#0c8599', '#e64980', '#f76707', '#5c7cfa', '#38d9a9'];
  const ICONS = ['📋', '💻', '🎨', '📊', '📝', '🚀', '🎯', '💡', '🔧', '📁', '📈', '🎮', '📱', '🔬', '🏗️', '📚'];

  const state = TodoApp.State;
  const _data = () => state.getData();

  function getAll() {
    return _data().projects || [];
  }

  function getById(id) {
    return (_data().projects || []).find(p => p.id === id) || null;
  }

  function getActive() {
    const id = _data().activeProjectId;
    if (!id) return null;
    return getById(id);
  }

  function setActive(id) {
    _data().activeProjectId = id;
    state.saveDebounced();
  }

  function create(name, description, color, icon) {
    if (!name || !name.trim()) {
      throw new Error('Название проекта не может быть пустым');
    }
    const project = {
      id: state.generateId(),
      name: name.trim(),
      description: (description || '').trim(),
      createdAt: new Date().toISOString(),
      color: color || COLORS[0],
      icon: icon || ICONS[0]
    };
    _data().projects.push(project);
    _data().activeProjectId = project.id;
    state.saveDebounced();
    return project;
  }

  function update(id, updates) {
    const projects = _data().projects;
    const idx = projects.findIndex(p => p.id === id);
    if (idx === -1) throw new Error('Проект не найден');
    if (updates.name !== undefined && !updates.name.trim()) {
      throw new Error('Название проекта не может быть пустым');
    }
    projects[idx] = { ...projects[idx], ...updates };
    state.saveDebounced();
    return projects[idx];
  }

  function remove(id) {
    const projects = _data().projects;
    const idx = projects.findIndex(p => p.id === id);
    if (idx === -1) return false;
    projects.splice(idx, 1);
    // Удаляем задачи проекта
    _data().tasks = (_data().tasks || []).filter(t => t.projectId !== id);
    // Если удалён активный проект, переключаемся на первый доступный
    if (_data().activeProjectId === id) {
      _data().activeProjectId = projects.length > 0 ? projects[0].id : null;
    }
    state.saveDebounced();
    return true;
  }

  function getTaskCount(projectId) {
    return (_data().tasks || []).filter(t => t.projectId === projectId).length;
  }

  function getCompletedTaskCount(projectId) {
    return (_data().tasks || []).filter(t => t.projectId === projectId && t.columnId === 'done').length;
  }

  function getColors() { return COLORS; }
  function getIcons() { return ICONS; }

  return {
    getAll,
    getById,
    getActive,
    setActive,
    create,
    update,
    remove,
    getTaskCount,
    getCompletedTaskCount,
    getColors,
    getIcons
  };
})();
