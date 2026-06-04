/**
 * taskManager.js — Управление задачами, подзадачами, комментариями, вложениями
 * Глобальный объект: TodoApp.Tasks
 */
TodoApp.Tasks = (function() {
  const state = TodoApp.State;
  const _data = () => state.getData();

  // ===== ЗАДАЧИ =====

  function getAll(projectId) {
    return (_data().tasks || []).filter(t => t.projectId === projectId);
  }

  function getById(id) {
    return (_data().tasks || []).find(t => t.id === id) || null;
  }

  function getByColumn(projectId, columnId) {
    return (_data().tasks || [])
      .filter(t => t.projectId === projectId && t.columnId === columnId)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  function create(projectId, columnId, data) {
    if (!data.title || !data.title.trim()) {
      throw new Error('Заголовок задачи не может быть пустым');
    }
    const columnTasks = getByColumn(projectId, columnId);
    const maxOrder = columnTasks.reduce((max, t) => Math.max(max, t.order || 0), -1);

    const task = {
      id: state.generateId(),
      projectId,
      columnId,
      title: data.title.trim(),
      description: (data.description || '').trim(),
      priority: data.priority || 'medium',
      deadline: data.deadline || null,
      tags: data.tags || [],
      color: data.color || null,
      assignee: data.assignee || null,
      order: maxOrder + 1,
      subtasks: data.subtasks || [],
      comments: data.comments || [],
      attachments: data.attachments || [],
      createdAt: new Date().toISOString(),
      completedAt: null
    };

    _data().tasks.push(task);
    state.saveDebounced();
    return task;
  }

  function update(id, updates) {
    const tasks = _data().tasks;
    const idx = tasks.findIndex(t => t.id === id);
    if (idx === -1) throw new Error('Задача не найдена');
    if (updates.title !== undefined && !updates.title.trim()) {
      throw new Error('Заголовок не может быть пустым');
    }
    // Если перемещаем в "done", фиксируем время завершения
    if (updates.columnId === 'done' && tasks[idx].columnId !== 'done') {
      updates.completedAt = new Date().toISOString();
    }
    // Если убираем из "done"
    if (updates.columnId && updates.columnId !== 'done' && tasks[idx].columnId === 'done') {
      updates.completedAt = null;
    }
    tasks[idx] = { ...tasks[idx], ...updates };
    state.saveDebounced();
    return tasks[idx];
  }

  function remove(id) {
    const tasks = _data().tasks;
    const idx = tasks.findIndex(t => t.id === id);
    if (idx === -1) return false;
    tasks.splice(idx, 1);
    state.saveDebounced();
    return true;
  }

  function moveToColumn(taskId, newColumnId, newOrder) {
    const task = getById(taskId);
    if (!task) throw new Error('Задача не найдена');
    const updates = { columnId: newColumnId };
    if (newOrder !== undefined) updates.order = newOrder;
    return update(taskId, updates);
  }

  function reorderInColumn(projectId, columnId, taskIds) {
    const tasks = _data().tasks;
    taskIds.forEach((taskId, index) => {
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        task.order = index;
        task.columnId = columnId;
      }
    });
    state.saveDebounced();
  }

  function toggleComplete(id) {
    const task = getById(id);
    if (!task) throw new Error('Задача не найдена');
    const newColumnId = task.columnId === 'done' ? 'in_progress' : 'done';
    return update(id, { columnId: newColumnId });
  }

  // ===== ПОДЗАДАЧИ =====

  function addSubtask(taskId, title, parentId) {
    if (!title || !title.trim()) throw new Error('Заголовок подзадачи не может быть пустым');
    const task = getById(taskId);
    if (!task) throw new Error('Задача не найдена');

    const subtask = {
      id: state.generateId(),
      title: title.trim(),
      completed: false,
      subtasks: [],
      createdAt: new Date().toISOString()
    };

    if (parentId) {
      // Рекурсивный поиск родительской подзадачи
      const parent = findSubtask(task.subtasks, parentId);
      if (parent) {
        parent.subtasks.push(subtask);
      } else {
        task.subtasks.push(subtask);
      }
    } else {
      task.subtasks.push(subtask);
    }

    state.saveDebounced();
    return subtask;
  }

  function toggleSubtask(taskId, subtaskId) {
    const task = getById(taskId);
    if (!task) throw new Error('Задача не найдена');
    const subtask = findSubtask(task.subtasks, subtaskId);
    if (!subtask) throw new Error('Подзадача не найдена');
    subtask.completed = !subtask.completed;
    state.saveDebounced();
    return subtask;
  }

  function removeSubtask(taskId, subtaskId) {
    const task = getById(taskId);
    if (!task) throw new Error('Задача не найдена');
    removeSubtaskRecursive(task.subtasks, subtaskId);
    state.saveDebounced();
  }

  function updateSubtask(taskId, subtaskId, updates) {
    const task = getById(taskId);
    if (!task) throw new Error('Задача не найдена');
    const subtask = findSubtask(task.subtasks, subtaskId);
    if (!subtask) throw new Error('Подзадача не найдена');
    Object.assign(subtask, updates);
    state.saveDebounced();
    return subtask;
  }

  function getSubtaskProgress(taskId) {
    const task = getById(taskId);
    if (!task || !task.subtasks.length) return { total: 0, completed: 0, percent: 0 };
    const counts = countSubtasksRecursive(task.subtasks);
    return {
      total: counts.total,
      completed: counts.completed,
      percent: counts.total > 0 ? Math.round((counts.completed / counts.total) * 100) : 0
    };
  }

  // ===== КОММЕНТАРИИ =====

  function addComment(taskId, text) {
    if (!text || !text.trim()) throw new Error('Комментарий не может быть пустым');
    const task = getById(taskId);
    if (!task) throw new Error('Задача не найдена');
    const comment = {
      id: state.generateId(),
      text: text.trim(),
      createdAt: new Date().toISOString(),
      author: 'Пользователь'
    };
    task.comments.push(comment);
    state.saveDebounced();
    return comment;
  }

  function removeComment(taskId, commentId) {
    const task = getById(taskId);
    if (!task) throw new Error('Задача не найдена');
    task.comments = task.comments.filter(c => c.id !== commentId);
    state.saveDebounced();
  }

  // ===== ВЛОЖЕНИЯ =====

  function addAttachment(taskId, attachment) {
    const task = getById(taskId);
    if (!task) throw new Error('Задача не найдена');
    if (!attachment.name || !attachment.data) throw new Error('Неверные данные вложения');
    const att = {
      id: state.generateId(),
      name: attachment.name,
      data: attachment.data,
      type: attachment.type || 'link',
      createdAt: new Date().toISOString()
    };
    task.attachments.push(att);
    state.saveDebounced();
    return att;
  }

  function removeAttachment(taskId, attachmentId) {
    const task = getById(taskId);
    if (!task) throw new Error('Задача не найдена');
    task.attachments = task.attachments.filter(a => a.id !== attachmentId);
    state.saveDebounced();
  }

  // ===== ВСПОМОГАТЕЛЬНЫЕ =====

  function findSubtask(subtasks, id) {
    for (const st of subtasks) {
      if (st.id === id) return st;
      if (st.subtasks && st.subtasks.length > 0) {
        const found = findSubtask(st.subtasks, id);
        if (found) return found;
      }
    }
    return null;
  }

  function removeSubtaskRecursive(subtasks, id) {
    for (let i = subtasks.length - 1; i >= 0; i--) {
      if (subtasks[i].id === id) {
        subtasks.splice(i, 1);
        return true;
      }
      if (subtasks[i].subtasks && subtasks[i].subtasks.length > 0) {
        if (removeSubtaskRecursive(subtasks[i].subtasks, id)) return true;
      }
    }
    return false;
  }

  function countSubtasksRecursive(subtasks) {
    let total = 0;
    let completed = 0;
    for (const st of subtasks) {
      total++;
      if (st.completed) completed++;
      if (st.subtasks && st.subtasks.length > 0) {
        const childCounts = countSubtasksRecursive(st.subtasks);
        total += childCounts.total;
        completed += childCounts.completed;
      }
    }
    return { total, completed };
  }

  // ===== ФИЛЬТРАЦИЯ =====

  function search(query, filters) {
    let tasks = _data().tasks || [];
    const q = (query || '').toLowerCase().trim();

    if (q) {
      tasks = tasks.filter(t => {
        const titleMatch = t.title.toLowerCase().includes(q);
        const descMatch = t.description && t.description.toLowerCase().includes(q);
        const tagMatch = t.tags && t.tags.some(tag => tag.toLowerCase().includes(q));
        const assigneeMatch = t.assignee && t.assignee.toLowerCase().includes(q);
        return titleMatch || descMatch || tagMatch || assigneeMatch;
      });
    }

    if (filters) {
      if (filters.projectId) {
        tasks = tasks.filter(t => t.projectId === filters.projectId);
      }
      if (filters.columnId) {
        tasks = tasks.filter(t => t.columnId === filters.columnId);
      }
      if (filters.priority) {
        tasks = tasks.filter(t => t.priority === filters.priority);
      }
      if (filters.assignee) {
        tasks = tasks.filter(t => t.assignee && t.assignee.toLowerCase() === filters.assignee.toLowerCase());
      }
      if (filters.tag) {
        tasks = tasks.filter(t => t.tags && t.tags.some(tag => tag.toLowerCase() === filters.tag.toLowerCase()));
      }
      if (filters.mine) {
        tasks = tasks.filter(t => t.assignee && t.assignee.toLowerCase() === filters.mine.toLowerCase());
      }
      if (filters.overdue) {
        const now = new Date();
        tasks = tasks.filter(t => t.deadline && new Date(t.deadline) < now && t.columnId !== 'done');
      }
      if (filters.today) {
        const today = new Date().toISOString().split('T')[0];
        tasks = tasks.filter(t => t.deadline === today);
      }
      if (filters.week) {
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 7);
        tasks = tasks.filter(t => {
          if (!t.deadline) return false;
          const d = new Date(t.deadline);
          return d >= weekStart && d <= weekEnd;
        });
      }
    }

    return tasks.sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  function getAllTags(projectId) {
    const tags = new Set();
    (_data().tasks || [])
      .filter(t => !projectId || t.projectId === projectId)
      .forEach(t => (t.tags || []).forEach(tag => tags.add(tag)));
    return Array.from(tags).sort();
  }

  function getAllAssignees(projectId) {
    const assignees = new Set();
    (_data().tasks || [])
      .filter(t => (!projectId || t.projectId === projectId) && t.assignee)
      .forEach(t => assignees.add(t.assignee));
    return Array.from(assignees).sort();
  }

  function getOverdueTasks() {
    const now = new Date();
    return (_data().tasks || []).filter(t => {
      if (!t.deadline || t.columnId === 'done') return false;
      return new Date(t.deadline) < now;
    });
  }

  function getUpcomingTasks() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    return (_data().tasks || []).filter(t => {
      if (!t.deadline || t.columnId === 'done') return false;
      const d = new Date(t.deadline);
      return d >= today && d <= tomorrow;
    });
  }

  return {
    getAll,
    getById,
    getByColumn,
    create,
    update,
    remove,
    moveToColumn,
    reorderInColumn,
    toggleComplete,
    addSubtask,
    toggleSubtask,
    removeSubtask,
    updateSubtask,
    getSubtaskProgress,
    addComment,
    removeComment,
    addAttachment,
    removeAttachment,
    search,
    getAllTags,
    getAllAssignees,
    getOverdueTasks,
    getUpcomingTasks
  };
})();
