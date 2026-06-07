/**
 * kanban.js — Отрисовка Kanban-доски, Drag & Drop, управление колонками
 * Глобальный объект: TodoApp.Kanban
 */
TodoApp.Kanban = (function() {
  const state = TodoApp.State;
  const projects = TodoApp.Projects;
  const tasks = TodoApp.Tasks;

  let dragSourceTaskId = null;
  let dragSourceColumnId = null;
  let _subtaskParentId = null;
  let _expandedSubtasks = {};

  // ===== ОСНОВНАЯ ОТРИСОВКА =====

  function render() {
    const board = document.getElementById('kanbanBoard');
    const activeProject = projects.getActive();
    if (!activeProject) {
      board.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-title">Нет активного проекта</div><div class="empty-state-text">Создайте новый проект или выберите существующий из боковой панели</div></div>';
      return;
    }

    const columns = state.getDefaultColumns();
    let html = '';
    const currentFilters = getCurrentFilters();

    columns.sort((a, b) => (a.order || 0) - (b.order || 0)).forEach(col => {
      let colTasks = tasks.getByColumn(activeProject.id, col.id);
      
      // Применяем фильтры
      if (currentFilters.priority) {
        colTasks = colTasks.filter(t => t.priority === currentFilters.priority);
      }
      if (currentFilters.assignee) {
        colTasks = colTasks.filter(t => t.assignee && t.assignee.toLowerCase() === currentFilters.assignee.toLowerCase());
      }
      if (currentFilters.tag) {
        colTasks = colTasks.filter(t => t.tags && t.tags.some(tag => tag.toLowerCase() === currentFilters.tag.toLowerCase()));
      }
      if (currentFilters.overdue) {
        const now = new Date();
        colTasks = colTasks.filter(t => t.deadline && new Date(t.deadline) < now);
      }
      if (currentFilters.today) {
        const today = new Date().toISOString().split('T')[0];
        colTasks = colTasks.filter(t => t.deadline === today);
      }
      if (currentFilters.week) {
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 7);
        colTasks = colTasks.filter(t => {
          if (!t.deadline) return false;
          const d = new Date(t.deadline);
          return d >= weekStart && d <= weekEnd;
        });
      }
      if (currentFilters.mine) {
        colTasks = colTasks.filter(t => t.assignee && t.assignee.toLowerCase() === currentFilters.mine.toLowerCase());
      }

      // Сортировка: просроченные → ближайший дедлайн → приоритет → порядок
      colTasks.sort((a, b) => {
        const now = new Date();
        const aDeadline = a.deadline ? new Date(a.deadline) : null;
        const bDeadline = b.deadline ? new Date(b.deadline) : null;
        const aOverdue = aDeadline && aDeadline < now && a.columnId !== 'done';
        const bOverdue = bDeadline && bDeadline < now && b.columnId !== 'done';

        if (aOverdue && !bOverdue) return -1;
        if (!aOverdue && bOverdue) return 1;

        if (aDeadline && bDeadline) {
          const d = aDeadline - bDeadline;
          if (d !== 0) return d;
        } else if (aDeadline) {
          return -1;
        } else if (bDeadline) {
          return 1;
        }

        const priorityOrder = { high: 0, medium: 1, low: 2 };
        const p = (priorityOrder[a.priority] || 1) - (priorityOrder[b.priority] || 1);
        if (p !== 0) return p;
        return (a.order || 0) - (b.order || 0);
      });

      const collapsed = col.collapsed ? 'collapsed' : '';
      const colColorStyle = col.color ? 'border-top:3px solid ' + col.color + ';' : '';
      const colWidth = col.width ? 'width:' + col.width + 'px;min-width:' + col.width + 'px;max-width:none;' : '';

      html += `
        <div class="kanban-column ${collapsed}" data-column-id="${col.id}"
             role="region" aria-label="${col.title}"
             style="${colColorStyle}${colWidth}"
             ondragover="event.preventDefault();TodoApp.Kanban.handleColumnDragOver(event,'${col.id}')"
             ondrop="TodoApp.Kanban.handleDrop(event, '${col.id}')"
             ondragenter="TodoApp.Kanban.handleColumnDragEnter(event, '${col.id}')"
             ondragleave="TodoApp.Kanban.handleColumnDragLeave(event)">
          <div class="kanban-column-header" data-toggle-column>
            <span class="column-drag-handle" draggable="true"
                  ondragstart="TodoApp.Kanban.handleColumnDragStart(event, '${col.id}')"
                  ondragend="TodoApp.Kanban.handleColumnDragEnd(event)"
                  title="Перетащите для изменения порядка">⠿</span>
            <span class="column-color-dot" style="${col.color ? 'background:'+col.color+';' : 'display:none;'}"
                  onclick="TodoApp.UI.openColumnModal('${col.id}')"
                  title="Настройки колонки"></span>
            <span class="kanban-column-title" ondblclick="TodoApp.UI.openColumnModal('${col.id}')">${escapeHtml(col.title)}</span>
            <span class="kanban-column-count">${colTasks.length}</span>
            <div class="kanban-column-actions">
              <button class="btn-icon" data-delete-column title="Удалить колонку" aria-label="Удалить колонку">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  <line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
                </svg>
              </button>
            </div>
          </div>
          <div class="kanban-column-body" data-column-body
               data-column-id="${col.id}">
            ${colTasks.map((task, idx) => renderTaskCard(task, activeProject, idx + 1)).join('')}
          </div>
          <div class="kanban-column-footer">
            <button class="add-task-btn" data-add-task="${col.id}" aria-label="Добавить задачу в ${col.title}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Добавить задачу
            </button>
          </div>
          <div class="column-resize-handle" title="Изменить ширину"></div>
        </div>`;
    });

    // Кнопка добавления колонки
    html += `
      <div class="kanban-column" style="display:flex;flex-direction:column;align-items:center;justify-content:center;background:transparent;border:2px dashed var(--border-color);cursor:pointer;align-self:stretch;transition:background var(--transition-normal),border-color var(--transition-normal),transform var(--transition-normal);" onclick="TodoApp.UI.openColumnModal(null)"
           onmouseenter="this.style.background='var(--bg-hover)';this.style.borderColor='var(--accent)';this.style.transform='scale(1.02)'"
           onmouseleave="this.style.background='transparent';this.style.borderColor='var(--border-color)';this.style.transform='scale(1)'">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        <div style="margin-top:10px;font-size:0.875rem;color:var(--text-muted);font-weight:500;">Новая колонка</div>
      </div>`;

    board.innerHTML = html;
    updateFilterOptions();
  }

  // ===== ОТРИСОВКА КАРТОЧКИ ЗАДАЧИ =====

  function renderTaskCard(task, project, idx) {
    const priorityClass = task.priority || 'medium';
    const isDeadlineSoon = checkDeadlineSoon(task.deadline);
    const progress = tasks.getSubtaskProgress(task.id);
    const assigneeInitial = task.assignee ? task.assignee.charAt(0).toUpperCase() : '';
    const deadlineDate = task.deadline ? formatDate(task.deadline) : '';
    const isCompleted = task.columnId === 'done';
    const taskColor = task.color || null;

    let tagsHtml = '';
    if (task.tags && task.tags.length > 0) {
      tagsHtml = `<div class="task-tags">${task.tags.map(tag =>
        `<span class="task-tag" style="background:${getTagColor(tag)}">${escapeHtml(tag)}</span>`
      ).join('')}</div>`;
    }

    let deadlineHtml = '';
    if (task.deadline) {
      const deadlineClass = isDeadlineSoon === 'overdue' ? 'overdue' :
                            isDeadlineSoon === 'today' ? 'today' :
                            isDeadlineSoon === 'tomorrow' ? 'tomorrow' : '';
      const remaining = formatTimeRemaining(task.deadline, task.columnId === 'done');
      deadlineHtml = `<div class="task-deadline ${deadlineClass}">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        ${deadlineDate}
        ${remaining ? `<span class="deadline-remaining">${remaining}</span>` : ''}
      </div>`;
    }

    let progressHtml = '';
    let subtasksHtml = '';
    if (task.subtaskIds && task.subtaskIds.length > 0) {
      const expanded = _expandedSubtasks[task.id] ? true : false;
      progressHtml = `<div class="task-subtasks-progress" data-expand-subtasks="${task.id}">
        <span>${progress.completed}/${progress.total}</span>
        <div class="progress-bar">
          <div class="progress-fill" style="width:${progress.percent}%"></div>
        </div>
        <svg class="subtasks-chevron ${expanded ? 'expanded' : ''}" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>`;
      subtasksHtml = `<div class="card-subtasks ${expanded ? 'expanded' : ''}" id="subtasks-${task.id}">${renderCardSubtasks(task.subtaskIds, task.id)}</div>`;
    }

    let assigneeHtml = '';
    if (assigneeInitial) {
      assigneeHtml = `<div class="task-assignee" title="${escapeHtml(task.assignee)}">${assigneeInitial}</div>`;
    }

    return `
      <div class="task-card ${isCompleted ? 'completed' : ''}"
           draggable="true"
           data-task-id="${task.id}"
           data-column-id="${task.columnId}"
           style="${taskColor ? 'background:linear-gradient(135deg,' + taskColor + '18,' + taskColor + '08);border-left-color:' + taskColor + ';' : ''}"
           ondragstart="TodoApp.Kanban.handleDragStart(event, '${task.id}', '${task.columnId}')"
           ondragend="TodoApp.Kanban.handleDragEnd(event)"

           role="listitem"
           aria-label="${escapeHtml(task.title)}">
        <div class="task-card-priority ${priorityClass}"
             style="${taskColor ? 'background:' + taskColor + ';' : ''}"></div>
        <div class="task-card-top">
          <span class="task-number">#${idx}</span>
          <span class="task-title">${escapeHtml(task.title)}</span>
          <input type="checkbox" class="task-checkbox" ${isCompleted ? 'checked' : ''}
                 data-toggle-task="${task.id}" aria-label="Отметить задачу как выполненную">
        </div>
        <div class="task-card-body">
          ${tagsHtml}
          ${subtasksHtml}
          <div class="task-meta">
            ${progressHtml}
            ${assigneeHtml}
          </div>
          ${deadlineHtml}
        </div>
        <div class="task-card-actions">
          ${!isCompleted ? `<button class="btn-icon" data-add-subtask="${task.id}" title="Добавить подзадачу" aria-label="Добавить подзадачу">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
            </svg>
          </button>` : ''}
          <button class="btn-icon" data-duplicate-task="${task.id}" title="Дублировать" aria-label="Дублировать задачу">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
          </button>
          <button class="btn-icon" data-delete-task="${task.id}" title="Удалить" aria-label="Удалить задачу">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>
      </div>`;
  }

  function renderCardSubtasks(subtaskIds, taskId) {
    if (!subtaskIds || subtaskIds.length === 0) return '';
    let html = '';
    subtaskIds.forEach(subId => {
      const sub = tasks.getById(subId);
      if (!sub) return;
      const done = sub.columnId === 'done';
      const cls = done ? 'card-subtask-completed' : '';
      const subColor = sub.color || null;
      const colorStyle = subColor ? `border-left:3px solid ${subColor};background:linear-gradient(90deg,${subColor}12,transparent);padding-left:6px;` : '';
      html += `
        <div class="card-subtask" style="${colorStyle}" onclick="event.stopPropagation();TodoApp.UI.openTaskModal('${sub.id}')" title="Открыть подзадачу">
          <span class="card-subtask-indicator ${done ? 'done' : ''}" ${subColor ? `style="background:${done ? '#2f9e44' : subColor}"` : ''}></span>
          <span class="${cls}">${escapeHtml(sub.title)}</span>
        </div>`;
    });
    return html;
  }

  function toggleCardSubtask(taskId, subtaskId) {
    try {
      tasks.toggleSubtask(taskId, subtaskId);
      render();
    } catch (e) {
      // ignore
    }
  }

  // ===== ПОДЗАДАЧИ НА КАРТОЧКЕ =====

  function addSubtaskFromCard(taskId) {
    const task = tasks.getById(taskId);
    if (!task) return;
    if (task.columnId === 'done') {
      if (window.TodoApp.UI) TodoApp.UI.showNotification('Нельзя изменить завершённую задачу', 'warning');
      return;
    }
    _subtaskParentId = taskId;
    const select = document.getElementById('subtaskExistingSelect');
    if (select) {
      select.innerHTML = '<option value="">— Создать новую —</option>';
      const allTasks = tasks.getAll(task.projectId).filter(t => t.id !== taskId);
      const existing = (task.subtaskIds || []).map(id => id);
      allTasks.forEach(t => {
        if (existing.includes(t.id)) return;
        const opt = document.createElement('option');
        opt.value = t.id;
        const col = findColumnTitle(t.columnId);
        opt.textContent = `${t.title}${col ? ' [' + col + ']' : ''}`;
        select.appendChild(opt);
      });
    }
    document.getElementById('subtaskNewTitle').value = '';
    document.getElementById('subtaskNewTitle').disabled = false;
    if (window.TodoApp.UI) TodoApp.UI.openModal('subtaskModal');
    setTimeout(() => {
      const titleInput = document.getElementById('subtaskNewTitle');
      if (titleInput) titleInput.focus();
    }, 100);
  }

  function toggleSubtaskList(taskId) {
    if (_expandedSubtasks[taskId]) {
      delete _expandedSubtasks[taskId];
    } else {
      _expandedSubtasks[taskId] = true;
    }
    render();
  }

  function submitAddSubtask() {
    const parentId = _subtaskParentId;
    if (!parentId) return;
    const select = document.getElementById('subtaskExistingSelect');
    const titleInput = document.getElementById('subtaskNewTitle');
    const selectedId = select ? select.value : '';
    const newTitle = titleInput ? titleInput.value.trim() : '';

    if (selectedId) {
      tasks.addSubtaskRef(parentId, selectedId);
      if (window.TodoApp.UI) {
        TodoApp.UI.closeModal('subtaskModal');
        TodoApp.UI.showNotification('Подзадача добавлена', 'success');
      }
      render();
      return;
    }
    if (!newTitle) {
      if (window.TodoApp.UI) TodoApp.UI.showNotification('Введите название или выберите задачу', 'warning');
      return;
    }
    const parent = tasks.getById(parentId);
    if (!parent) return;
    // Создаём задачу с наследованными значениями от родителя
    const newTask = tasks.create(parent.projectId, parent.columnId, {
      title: newTitle,
      deadline: parent.deadline || undefined,
      assignee: parent.assignee || undefined,
      tags: parent.tags ? [...parent.tags] : undefined,
      color: parent.color || undefined
    });
    tasks.addSubtaskRef(parentId, newTask.id);
    if (window.TodoApp.UI) {
      TodoApp.UI.closeModal('subtaskModal');
      // Открываем модалку задачи в режиме редактирования
      TodoApp.UI.openTaskModal(newTask.id);
      TodoApp.UI.switchToEditMode();
    }
    render();
  }

  function findColumnTitle(columnId) {
    const project = projects.getActive();
    if (!project || !project.columns) return null;
    const col = project.columns.find(c => c.id === columnId);
    return col ? col.title : null;
  }

  // ===== DRAG & DROP =====

  function handleDragStart(event, taskId, columnId) {
    dragSourceTaskId = taskId;
    dragSourceColumnId = columnId;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', taskId);
    // Небольшая задержка для применения класса
    requestAnimationFrame(() => {
      event.target.classList.add('dragging');
    });
  }

  function handleDragEnd(event) {
    event.target.classList.remove('dragging');
    document.querySelectorAll('.kanban-column.drag-over-column').forEach(el => {
      el.classList.remove('drag-over-column');
    });
    dragSourceTaskId = null;
    dragSourceColumnId = null;
  }

  function handleDrop(event, targetColumnId) {
    event.preventDefault();

    const columnDragId = event.dataTransfer.getData('text/column-id');
    if (columnDragId) {
      // Определяем сторону сброса: левая/правая половина колонки
      const targetCol = event.currentTarget.closest('.kanban-column');
      let insertAfter = false;
      if (targetCol) {
        const rect = targetCol.getBoundingClientRect();
        insertAfter = event.clientX > rect.left + rect.width / 2;
      }
      reorderColumns(columnDragId, targetColumnId, insertAfter);
      return;
    }

    const taskId = event.dataTransfer.getData('text/plain');
    if (!taskId) return;

    const columnBody = event.currentTarget.querySelector('[data-column-body]') || event.currentTarget;
    const cards = columnBody.querySelectorAll('.task-card');
    let insertBeforeId = null;

    for (const card of cards) {
      const rect = card.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      if (event.clientY < midY) {
        insertBeforeId = card.dataset.taskId;
        break;
      }
    }

    const task = tasks.getById(taskId);
    if (!task) return;

    tasks.moveToColumn(taskId, targetColumnId);

    const activeProject = projects.getActive();
    if (activeProject) {
      let colTasks = tasks.getByColumn(activeProject.id, targetColumnId)
        .filter(t => t.id !== taskId);
      
      if (insertBeforeId) {
        const insertIdx = colTasks.findIndex(t => t.id === insertBeforeId);
        if (insertIdx >= 0) {
          colTasks.splice(insertIdx, 0, task);
        } else {
          colTasks.push(task);
        }
      } else {
        colTasks.push(task);
      }

      tasks.reorderInColumn(activeProject.id, targetColumnId, colTasks.map(t => t.id));
    }

    render();
  }

  // ===== ПЕРЕТАСКИВАНИЕ КОЛОНОК =====

  function handleColumnDragStart(event, columnId) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/column-id', columnId);
    const col = event.target.closest('.kanban-column');
    if (col) col.classList.add('dragging-column');
    window.__columnDragging = true;
  }

  function handleColumnDragEnd(event) {
    window.__columnDragging = false;
    clearColumnDragGaps();
    document.querySelectorAll('.kanban-column.dragging-column').forEach(el => {
      el.classList.remove('dragging-column');
    });
  }

  function clearColumnDragGaps() {
    document.querySelectorAll('.kanban-column').forEach(c => {
      c.classList.remove('drag-target', 'drag-gap-left', 'drag-gap-right');
    });
  }

  function handleColumnDragEnter(event, columnId) {
    if (!window.__columnDragging) return;
    event.preventDefault();
    const col = event.currentTarget.closest('.kanban-column');
    if (col && !col.classList.contains('dragging-column')) {
      col.classList.add('drag-target');
    }
  }

  function handleColumnDragOver(event, columnId) {
    if (!window.__columnDragging) return;
    event.preventDefault();
    const col = event.currentTarget.closest('.kanban-column');
    if (!col || col.classList.contains('dragging-column')) return;

    const rect = col.getBoundingClientRect();
    const relX = event.clientX - rect.left;
    const side = relX < rect.width / 2 ? 'left' : 'right';

    clearColumnDragGaps();
    col.classList.add('drag-target');
    col.classList.add('drag-gap-' + side);
  }

  function handleColumnDragLeave(event) {
    if (!window.__columnDragging) return;
    const col = event.currentTarget.closest('.kanban-column');
    if (col) {
      const related = event.relatedTarget;
      if (!related || !col.contains(related)) {
        col.classList.remove('drag-target', 'drag-gap-left', 'drag-gap-right');
      }
    }
  }

  function reorderColumns(dragId, dropId, insertAfter) {
    if (dragId === dropId) return;
    let columns = state.getDefaultColumns();
    const dragIdx = columns.findIndex(c => c.id === dragId);
    const dropIdx = columns.findIndex(c => c.id === dropId);
    if (dragIdx === -1 || dropIdx === -1) return;

    const [moved] = columns.splice(dragIdx, 1);
    const actualDropIdx = columns.findIndex(c => c.id === dropId);

    // Если insertAfter — вставляем после цели, иначе перед
    const insertAt = insertAfter ? actualDropIdx + 1 : actualDropIdx;
    columns.splice(insertAt, 0, moved);
    columns.forEach((col, i) => col.order = i);

    state.updateColumns(columns);
    render();
  }

  // ===== УПРАВЛЕНИЕ КОЛОНКАМИ =====

  function addColumn(title) {
    if (!title || !title.trim()) return;
    const columns = state.getDefaultColumns();
    const maxOrder = columns.reduce((max, c) => Math.max(max, c.order || 0), -1);
    columns.push({
      id: state.generateId(),
      title: title.trim(),
      type: 'custom',
      order: maxOrder + 1,
      collapsed: false,
      color: null
    });
    state.updateColumns(columns);
    render();
  }

  function editColumn(columnId, newTitle) {
    if (!newTitle || !newTitle.trim()) return;
    const columns = state.getDefaultColumns();
    const col = columns.find(c => c.id === columnId);
    if (col) {
      col.title = newTitle.trim();
      state.updateColumns(columns);
      render();
    }
  }

  function setColumnColor(columnId, color) {
    const columns = state.getDefaultColumns();
    const col = columns.find(c => c.id === columnId);
    if (col) {
      col.color = color || null;
      state.updateColumns(columns);
      render();
    }
  }

  function setColumnWidth(columnId, width) {
    const columns = state.getDefaultColumns();
    const col = columns.find(c => c.id === columnId);
    if (col) {
      col.width = Math.max(180, Math.min(600, width));
      state.updateColumns(columns);
      render();
    }
  }

  function deleteColumn(columnId) {
    const columns = state.getDefaultColumns();
    // Нельзя удалить стандартные колонки
    const col = columns.find(c => c.id === columnId);
    if (!col || ['new', 'in_progress', 'review', 'done'].includes(columnId)) {
      TodoApp.UI.showNotification('Нельзя удалить стандартную колонку', 'warning');
      return;
    }
    // Нельзя удалить колонку с задачами
    const activeProject = projects.getActive();
    if (activeProject) {
      const hasTasks = (_data().tasks || []).some(t => t.projectId === activeProject.id && t.columnId === columnId);
      if (hasTasks) {
        TodoApp.UI.showNotification('Сначала переместите задачи из этой колонки', 'warning');
        return;
      }
    }
    // Удаляем колонку
    state.updateColumns(columns.filter(c => c.id !== columnId));
    render();
  }

  function toggleColumnCollapse(columnId) {
    const columns = state.getDefaultColumns();
    const col = columns.find(c => c.id === columnId);
    if (col) {
      col.collapsed = !col.collapsed;
      state.updateColumns(columns);
      render();
    }
  }

  // ===== ВСПОМОГАТЕЛЬНЫЕ =====

  function getCurrentFilters() {
    const priority = document.getElementById('filterPriority')?.value || '';
    const assignee = document.getElementById('filterAssignee')?.value || '';
    const tag = document.getElementById('filterTag')?.value || '';
    const activeQuickFilter = document.querySelector('.quick-filter-btn.active');
    const quickFilter = activeQuickFilter ? activeQuickFilter.dataset.filter : 'all';

    const filters = {};
    if (priority) filters.priority = priority;
    if (assignee) filters.assignee = assignee;
    if (tag) filters.tag = tag;

    if (quickFilter === 'mine') {
      // Используем первого попавшегося исполнителя или текущего пользователя
      const assignees = tasks.getAllAssignees(projects.getActive()?.id);
      if (assignees.length > 0) filters.mine = assignees[0];
    } else if (quickFilter === 'overdue') {
      filters.overdue = true;
    } else if (quickFilter === 'today') {
      filters.today = true;
    } else if (quickFilter === 'week') {
      filters.week = true;
    }

    return filters;
  }

  function updateFilterOptions() {
    const activeProject = projects.getActive();
    if (!activeProject) return;

    const assigneeSelect = document.getElementById('filterAssignee');
    const tagSelect = document.getElementById('filterTag');
    if (!assigneeSelect || !tagSelect) return;

    const currentAssignee = assigneeSelect.value;
    const currentTag = tagSelect.value;

    const assignees = tasks.getAllAssignees(activeProject.id);
    const tags = tasks.getAllTags(activeProject.id);

    assigneeSelect.innerHTML = '<option value="">Все исполнители</option>' +
      assignees.map(a => `<option value="${escapeHtml(a)}" ${a === currentAssignee ? 'selected' : ''}>${escapeHtml(a)}</option>`).join('');

    tagSelect.innerHTML = '<option value="">Все теги</option>' +
      tags.map(t => `<option value="${escapeHtml(t)}" ${t === currentTag ? 'selected' : ''}>${escapeHtml(t)}</option>`).join('');
  }

  function checkDeadlineSoon(deadline) {
    if (!deadline) return null;
    const now = new Date();
    const d = new Date(deadline);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const taskDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffDays = Math.floor((taskDate - today) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'overdue';
    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'tomorrow';
    return null;
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const dateOpts = { day: 'numeric', month: 'short' };
    const timeOpts = { hour: '2-digit', minute: '2-digit' };
    const hasTime = dateStr.includes('T') || dateStr.includes(':');
    if (hasTime) {
      return d.toLocaleDateString('ru-RU', dateOpts) + ' ' + d.toLocaleTimeString('ru-RU', timeOpts);
    }
    return d.toLocaleDateString('ru-RU', dateOpts);
  }

  function formatTimeRemaining(deadline, isDone) {
    if (!deadline || isDone) return '';
    const now = new Date();
    const d = new Date(deadline);
    const diff = d - now;
    const absDiff = Math.abs(diff);
    const seconds = Math.floor(absDiff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (diff < 0) {
      if (days > 0) return `просрочено на ${days} ${pluralize(days, 'день', 'дня', 'дней')}`;
      if (hours > 0) return `просрочено на ${hours} ${pluralize(hours, 'час', 'часа', 'часов')}`;
      return `просрочено на ${minutes} ${pluralize(minutes, 'минуту', 'минуты', 'минут')}`;
    }

    if (days > 0) return `осталось ${days} ${pluralize(days, 'день', 'дня', 'дней')}`;
    if (hours > 0) return `осталось ${hours} ${pluralize(hours, 'час', 'часа', 'часов')}`;
    if (minutes > 0) return `осталось ${minutes} ${pluralize(minutes, 'минуту', 'минуты', 'минут')}`;
    return 'менее минуты';
  }

  function pluralize(n, one, few, many) {
    n = Math.abs(n) % 100;
    const n1 = n % 10;
    if (n > 10 && n < 20) return many;
    if (n1 > 1 && n1 < 5) return few;
    if (n1 === 1) return one;
    return many;
  }

  function getTagColor(tag) {
    const colors = [
      '#4c6ef5', '#7950f2', '#e03131', '#2f9e44', '#f08c00',
      '#0c8599', '#e64980', '#f76707', '#5c7cfa', '#38d9a9',
      '#ae3ec9', '#20c997', '#ff6b6b', '#fcc419', '#74c0fc'
    ];
    let hash = 0;
    for (let i = 0; i < tag.length; i++) {
      hash = tag.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length] + '33'; // с прозрачностью
  }

  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function _data() { return state.getData(); }

  const api = {
    render,
    renderTaskCard,
    toggleCardSubtask,
    addSubtaskFromCard,
    submitAddSubtask,
    toggleSubtaskList,
    handleDragStart,
    handleDragEnd,
    handleDrop,
    handleColumnDragStart,
    handleColumnDragEnd,
    handleColumnDragEnter,
    handleColumnDragOver,
    handleColumnDragLeave,
    addColumn,
    editColumn,
    setColumnColor,
    setColumnWidth,
    deleteColumn,
    toggleColumnCollapse,
    getCurrentFilters,
    escapeHtml,
    _data
  };

  window.TodoApp.Kanban = api;
  return api;
})();
