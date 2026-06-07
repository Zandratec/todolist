/**
 * ui.js — UI-компоненты: модальные окна, поиск, уведомления, темы
 * Глобальный объект: TodoApp.UI
 */
TodoApp.UI = (function() {
  const state = TodoApp.State;
  const projects = TodoApp.Projects;
  const tasks = TodoApp.Tasks;
  const kanban = TodoApp.Kanban;

  // Состояние редактируемой задачи
  let editingTaskId = null;
  let editingProjectId = null;
  let currentTags = [];
  let currentComments = [];
  let currentAttachments = [];
  let currentTaskColor = null;

  // ===== МОДАЛЬНЫЕ ОКНА =====

  function openModal(id) {
    const overlay = document.getElementById(id);
    if (!overlay) return;
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    // Фокусируем первый input
    const firstInput = overlay.querySelector('input:not([type="file"]):not([type="hidden"]), textarea, select');
    if (firstInput) setTimeout(() => firstInput.focus(), 100);
  }

  function closeModal(id) {
    const overlay = document.getElementById(id);
    if (!overlay) return;
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  function closeAllModals() {
    document.querySelectorAll('.modal-overlay.open').forEach(el => {
      el.classList.remove('open');
    });
    document.body.style.overflow = '';
  }

  // ===== МОДАЛКА ПРОЕКТА =====

  function openProjectModal(projectId) {
    editingProjectId = projectId || null;
    const title = document.getElementById('projectModalTitle');
    const nameInput = document.getElementById('projectName');
    const descInput = document.getElementById('projectDescription');

    // Сброс
    nameInput.value = '';
    descInput.value = '';
    renderColorPicker(null);
    renderIconPicker(null);

    if (projectId) {
      const project = projects.getById(projectId);
      if (project) {
        title.textContent = 'Редактировать проект';
        nameInput.value = project.name;
        descInput.value = project.description || '';
        renderColorPicker(project.color);
        renderIconPicker(project.icon);
      }
    } else {
      title.textContent = 'Новый проект';
    }

    openModal('projectModal');
  }

  function saveProject() {
    const name = document.getElementById('projectName').value.trim();
    const description = document.getElementById('projectDescription').value.trim();
    const selectedColor = document.querySelector('#projectColorPicker .color-option.selected');
    const selectedIcon = document.querySelector('#projectIconPicker .icon-option.selected');
    const color = selectedColor ? selectedColor.dataset.color : projects.getColors()[0];
    const icon = selectedIcon ? selectedIcon.dataset.icon : projects.getIcons()[0];

    if (!name) {
      showNotification('Введите название проекта', 'warning');
      return;
    }

    try {
      if (editingProjectId) {
        projects.update(editingProjectId, { name, description, color, icon });
        showNotification('Проект обновлён', 'success');
      } else {
        projects.create(name, description, color, icon);
        showNotification('Проект создан', 'success');
      }
      closeModal('projectModal');
      renderSidebar();
      kanban.render();
    } catch (e) {
      showNotification(e.message, 'error');
    }
  }

  function deleteProject(projectId) {
    showConfirm(
      'Удалить проект?',
      'Все задачи проекта будут также удалены.',
      () => {
        projects.remove(projectId);
        renderSidebar();
        kanban.render();
        showNotification('Проект удалён', 'info');
      }
    );
  }

  function renderColorPicker(selected) {
    const container = document.getElementById('projectColorPicker');
    container.innerHTML = projects.getColors().map(color =>
      `<div class="color-option ${color === selected ? 'selected' : ''}"
            style="background:${color}"
            data-color="${color}"
            role="button"
            tabindex="0"
            aria-label="Цвет ${color}"
            onclick="TodoApp.UI.selectColor(this)"></div>`
    ).join('');
  }

  function renderIconPicker(selected) {
    const container = document.getElementById('projectIconPicker');
    container.innerHTML = projects.getIcons().map(icon =>
      `<div class="icon-option ${icon === selected ? 'selected' : ''}"
            data-icon="${icon}"
            role="button"
            tabindex="0"
            aria-label="Иконка ${icon}"
            onclick="TodoApp.UI.selectIcon(this)">${icon}</div>`
    ).join('');
  }

  function selectColor(el) {
    document.querySelectorAll('#projectColorPicker .color-option').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
  }

  function selectIcon(el) {
    document.querySelectorAll('#projectIconPicker .icon-option').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
  }

  // ===== МОДАЛКА ЗАДАЧИ =====

  function switchToEditMode() {
    document.getElementById('taskModal').classList.remove('view-mode');
    document.getElementById('saveAndCloseBtn').style.display = '';
    document.getElementById('taskModalTitle').textContent = 'Редактировать задачу';
  }

  function openTaskModal(taskId, prefillColumnId) {
    editingTaskId = taskId || null;
    currentTags = [];
    currentComments = [];
    currentAttachments = [];
    currentTaskColor = null;

    const title = document.getElementById('taskModalTitle');
    const titleInput = document.getElementById('taskTitle');
    const descInput = document.getElementById('taskDescription');
    const prioritySelect = document.getElementById('taskPriority');
    const deadlineInput = document.getElementById('taskDeadline');
    const assigneeInput = document.getElementById('taskAssignee');
    const deleteBtn = document.getElementById('deleteTaskBtn');

    // Сброс
    titleInput.value = '';
    descInput.value = '';
    prioritySelect.value = 'medium';
    deadlineInput.value = '';
    assigneeInput.value = '';
    document.getElementById('taskTagsContainer').innerHTML = '';
    document.getElementById('modalSubtaskList').innerHTML = '<div class="text-muted text-sm" style="margin-bottom:8px;">Нет подзадач</div>';
    document.getElementById('commentList').innerHTML = '';
    document.getElementById('attachmentList').innerHTML = '';
    document.getElementById('commentInput').value = '';
    document.getElementById('taskTagInput').value = '';
    document.getElementById('attachmentUrl').value = '';

    const modal = document.getElementById('taskModal');
    modal.classList.remove('view-mode');
    document.getElementById('saveAndCloseBtn').style.display = '';

    if (taskId) {
      const task = tasks.getById(taskId);
      if (task) {
        title.textContent = 'Просмотр задачи';
        titleInput.value = task.title;
        descInput.value = task.description || '';
        prioritySelect.value = task.priority || 'medium';
        deadlineInput.value = task.deadline || '';
        assigneeInput.value = task.assignee || '';
        currentTags = [...(task.tags || [])];
        currentComments = deepClone(task.comments || []);
        currentAttachments = deepClone(task.attachments || []);
        currentTaskColor = task.color || null;
        deleteBtn.style.display = 'inline-flex';
        renderTaskTags();
        renderModalSubtasks(task.id);
        renderComments(currentComments);
        renderAttachments(currentAttachments);
        renderTaskColorPicker(task.color || null);
        modal.classList.add('view-mode');
      }
    } else {
      title.textContent = 'Новая задача';
      deleteBtn.style.display = 'none';
      renderTaskColorPicker(null);
    }

    openModal('taskModal');
  }

  function saveTask(closeAfter) {
    const titleVal = document.getElementById('taskTitle').value.trim();
    const description = document.getElementById('taskDescription').value.trim();
    const priority = document.getElementById('taskPriority').value;
    const deadline = document.getElementById('taskDeadline').value || null;
    const assignee = document.getElementById('taskAssignee').value.trim() || null;

    if (!titleVal) {
      showNotification('Введите заголовок задачи', 'warning');
      return;
    }

    const activeProject = projects.getActive();
    if (!activeProject) {
      showNotification('Нет активного проекта', 'warning');
      return;
    }

    try {
      const taskData = {
        title: titleVal,
        description,
        priority,
        deadline,
        assignee,
        tags: currentTags,
        comments: currentComments,
        attachments: currentAttachments,
        color: currentTaskColor
      };

      if (editingTaskId) {
        tasks.update(editingTaskId, taskData);
        showNotification('Задача обновлена', 'success');
      } else {
        const columns = state.getDefaultColumns();
        const targetColumn = columns.length > 0 ? columns[0].id : 'new';
        const newTask = tasks.create(activeProject.id, targetColumn, taskData);
        editingTaskId = newTask.id;
        document.getElementById('taskModalTitle').textContent = 'Редактировать задачу';
        document.getElementById('deleteTaskBtn').style.display = 'inline-flex';
        showNotification('Задача создана', 'success');
      }
      if (closeAfter !== false) {
        closeModal('taskModal');
      } else {
        document.getElementById('taskModalTitle').textContent = 'Просмотр задачи';
        document.getElementById('taskModal').classList.add('view-mode');
      }
      kanban.render();
      renderSidebar();
    } catch (e) {
      showNotification(e.message, 'error');
    }
  }

  function deleteTask(taskId) {
    const id = taskId || editingTaskId;
    if (!id) return;
    showConfirm(
      'Удалить задачу?',
      'Это действие нельзя отменить.',
      () => {
        tasks.remove(id);
        closeModal('taskModal');
        kanban.render();
        renderSidebar();
        showNotification('Задача удалена', 'info');
      }
    );
  }

  function duplicateTask(taskId) {
    const task = tasks.getById(taskId);
    if (!task) return;
    try {
      tasks.create(task.projectId, task.columnId, {
        title: task.title + ' (копия)',
        description: task.description,
        priority: task.priority,
        deadline: task.deadline,
        assignee: task.assignee,
        tags: [...(task.tags || [])],
      });
      kanban.render();
      renderSidebar();
      showNotification('Задача дублирована', 'success');
    } catch (e) {
      showNotification(e.message, 'error');
    }
  }

  // ===== ТЕГИ =====

  function addTag() {
    const input = document.getElementById('taskTagInput');
    const tag = input.value.trim();
    if (!tag) return;
    if (currentTags.includes(tag)) {
      showNotification('Такой тег уже существует', 'warning');
      return;
    }
    currentTags.push(tag);
    input.value = '';
    renderTaskTags();
    state.saveDebounced();
  }

  function removeTag(encodedTag) {
    const tag = decodeURIComponent(encodedTag);
    currentTags = currentTags.filter(t => t !== tag);
    renderTaskTags();
  }

  function editTag(encodedTag) {
    const oldTag = decodeURIComponent(encodedTag);
    const newTag = prompt('Редактировать тег:', oldTag);
    if (!newTag || newTag.trim() === oldTag) return;
    const trimmed = newTag.trim();
    if (!trimmed) return;
    if (currentTags.includes(trimmed) && trimmed !== oldTag) {
      showNotification('Такой тег уже существует', 'warning');
      return;
    }
    const idx = currentTags.indexOf(oldTag);
    if (idx !== -1) currentTags[idx] = trimmed;
    renderTaskTags();
  }

  function renderTaskTags() {
    const container = document.getElementById('taskTagsContainer');
    if (!container) return;
    container.innerHTML = currentTags.map(tag => {
      const encoded = encodeURIComponent(tag);
      const escaped = kanban.escapeHtml ? kanban.escapeHtml(tag) : tag;
      return `<span class="task-tag" style="background:${kanban.getTagColor ? kanban.getTagColor(tag) : '#373a40'}">
        <span style="cursor:pointer;" onclick="TodoApp.UI.editTag('${encoded}')" title="Редактировать тег">${escaped}</span>
        <span style="cursor:pointer;margin-left:6px;opacity:0.7;" onclick="TodoApp.UI.removeTag('${encoded}')" title="Удалить тег">&times;</span>
      </span>`;
    }).join('');
  }

  // ===== ЦВЕТ ЗАДАЧИ =====

  const TASK_COLORS = [
    null, '#e03131', '#e64980', '#be4bdb', '#7950f2', '#4c6ef5',
    '#0c8599', '#2f9e44', '#f08c00', '#f76707', '#ff6b6b', '#38d9a9'
  ];

  function renderTaskColorPicker(selected) {
    const container = document.getElementById('taskColorPicker');
    if (!container) return;
    container.innerHTML = TASK_COLORS.map(color => {
      if (color === null) {
        return `<div class="color-option ${selected === null || !selected ? 'selected' : ''}"
                    style="background:var(--bg-tertiary);border:2px dashed var(--text-muted);border-radius:6px;font-size:0.75rem;color:var(--text-muted);display:flex;align-items:center;justify-content:center;"
                    data-color=""
                    role="button" tabindex="0"
                    title="Без цвета"
                    onclick="TodoApp.UI.selectTaskColor('')">✕</div>`;
      }
      return `<div class="color-option ${color === selected ? 'selected' : ''}"
                  style="background:${color}"
                  data-color="${color}"
                  role="button" tabindex="0"
                  onclick="TodoApp.UI.selectTaskColor('${color}')"></div>`;
    }).join('');
  }

  function selectTaskColor(color) {
    currentTaskColor = color || null;
    document.querySelectorAll('#taskColorPicker .color-option').forEach(el => el.classList.remove('selected'));
    const sel = document.querySelector(`#taskColorPicker .color-option[data-color="${color}"]`);
    if (sel) sel.classList.add('selected');
  }

  // ===== ПОДЗАДАЧИ (ссылки на задачи) =====

  function renderModalSubtasks(taskId) {
    const container = document.getElementById('modalSubtaskList');
    if (!container) return;
    const task = tasks.getById(taskId);
    if (!task || !task.subtaskIds || !task.subtaskIds.length) {
      container.innerHTML = '<div class="text-muted text-sm" style="margin-bottom:8px;">Нет подзадач</div>';
      return;
    }
    let html = '';
    task.subtaskIds.forEach(subId => {
      const sub = tasks.getById(subId);
      if (!sub) return;
      const done = sub.columnId === 'done';
      const subColor = sub.color || null;
      const colorStyle = subColor ? `border-left:3px solid ${subColor};background:linear-gradient(90deg,${subColor}12,transparent);` : '';
      html += `<div class="modal-subtask-item ${done ? 'subtask-done' : ''}" style="${colorStyle}" onclick="TodoApp.UI.openTaskModal('${subId}')">
        <span class="modal-subtask-indicator ${done ? 'done' : ''}" ${subColor ? `style="background:${done ? '#2f9e44' : subColor}"` : ''}></span>
        <span class="subtask-title">${kanban.escapeHtml(sub.title)}</span>
      </div>`;
    });
    container.innerHTML = html;
  }

  // ===== КОММЕНТАРИИ =====

  function addCommentUI() {
    const input = document.getElementById('commentInput');
    const text = input.value.trim();
    if (!text) return;
    currentComments.push({
      id: state.generateId(),
      text,
      createdAt: new Date().toISOString(),
      author: 'Пользователь'
    });
    input.value = '';
    renderComments(currentComments);
    showNotification('Комментарий добавлен', 'success');
  }

  function renderComments(comments) {
    const container = document.getElementById('commentList');
    if (!container) return;
    if (!comments || comments.length === 0) {
      container.innerHTML = '<div class="text-muted text-sm">Нет комментариев</div>';
      return;
    }
    container.innerHTML = comments.map(c =>
      `<div class="comment-item">
        <div class="comment-meta">${c.author || 'Пользователь'} · ${formatDateTime(c.createdAt)}</div>
        <div class="comment-text">${kanban.escapeHtml(c.text)}</div>
      </div>`
    ).join('');
  }

  // ===== ВЛОЖЕНИЯ =====

  function addAttachmentLink() {
    const input = document.getElementById('attachmentUrl');
    const url = input.value.trim();
    if (!url) return;
    try {
      new URL(url);
    } catch {
      showNotification('Введите корректный URL', 'warning');
      return;
    }
    currentAttachments.push({
      id: state.generateId(),
      name: url.split('/').pop() || url,
      data: url,
      type: 'link',
      createdAt: new Date().toISOString()
    });
    input.value = '';
    renderAttachments(currentAttachments);
    showNotification('Ссылка добавлена', 'success');
  }

  function renderAttachments(attachments) {
    const container = document.getElementById('attachmentList');
    if (!container) return;
    if (!attachments || attachments.length === 0) {
      container.innerHTML = '<div class="text-muted text-sm">Нет вложений</div>';
      return;
    }
    container.innerHTML = attachments.map(a => {
      return `<div class="attachment-item">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
        <a href="${kanban.escapeHtml(a.data || a.url)}" target="_blank" rel="noopener">${kanban.escapeHtml(a.name || a.url)}</a>
        <button class="remove-attachment" onclick="TodoApp.UI.removeAttachmentUI('${a.id}')">&times;</button>
      </div>`;
    }).join('');
  }

  function removeAttachmentUI(attachmentId) {
    currentAttachments = currentAttachments.filter(a => a.id !== attachmentId);
    renderAttachments(currentAttachments);
    showNotification('Вложение удалено', 'info');
  }

  // ===== ПОИСК =====

  let searchTimeout = null;

  function initSearch() {
    const input = document.getElementById('globalSearch');
    const results = document.getElementById('searchResults');
    const clearBtn = document.getElementById('searchClear');

    if (!input) return;

    input.addEventListener('input', function() {
      clearBtn.classList.toggle('visible', this.value.length > 0);
      if (searchTimeout) clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => performSearch(this.value), 200);
    });

    input.addEventListener('focus', function() {
      if (this.value.length > 0) {
        results.classList.add('visible');
      }
    });

    input.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        results.classList.remove('visible');
        this.blur();
      }
      if (e.key === 'Enter') {
        const query = this.value.trim();
        if (query) {
          state.addRecentSearch(query);
        }
      }
      // Навигация по результатам
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const items = results.querySelectorAll('.search-result-item');
        const active = results.querySelector('.search-result-item.active') || items[0];
        const idx = Array.from(items).indexOf(active);
        let nextIdx;
        if (e.key === 'ArrowDown') {
          nextIdx = Math.min(idx + 1, items.length - 1);
        } else {
          nextIdx = Math.max(idx - 1, 0);
        }
        items.forEach(i => i.classList.remove('active'));
        if (items[nextIdx]) {
          items[nextIdx].classList.add('active');
          items[nextIdx].scrollIntoView({ block: 'nearest' });
        }
      }
    });

    clearBtn.addEventListener('click', function() {
      input.value = '';
      this.classList.remove('visible');
      results.classList.remove('visible');
      input.focus();
      performSearch('');
    });

    // Закрытие при клике вне
    document.addEventListener('click', function(e) {
      if (!e.target.closest('.header-search')) {
        results.classList.remove('visible');
      }
    });
  }

  function performSearch(query) {
    const results = document.getElementById('searchResults');
    if (!results) return;

    const q = query.trim().toLowerCase();
    if (!q) {
      // Показываем последние поиски
      const recent = state.getRecentSearches();
      if (recent.length > 0) {
        results.innerHTML = `<div class="recent-searches">
          <div class="text-muted text-sm" style="padding:8px 12px;">Недавние поиски</div>
          ${recent.map(s => `<div class="recent-search-item" onclick="document.getElementById('globalSearch').value='${kanban.escapeHtml(s)}';TodoApp.UI.performSearch('${kanban.escapeHtml(s)}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            ${kanban.escapeHtml(s)}
          </div>`).join('')}
        </div>`;
        results.classList.add('visible');
      } else {
        results.classList.remove('visible');
      }
      return;
    }

    const found = tasks.search(q);
    if (found.length === 0) {
      results.innerHTML = `<div class="text-muted text-sm" style="padding:12px;">Ничего не найдено</div>`;
      results.classList.add('visible');
      return;
    }

    results.innerHTML = found.slice(0, 10).map(t => {
      const project = projects.getById(t.projectId);
      const projectName = project ? project.name : 'Без проекта';
      // Подсветка совпадения
      const titleHtml = t.title.replace(
        new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'),
        '<span class="result-highlight">$1</span>'
      );
      return `<div class="search-result-item" onclick="TodoApp.UI.openSearchResult('${t.id}')">
        <div>
          <div class="result-project">${kanban.escapeHtml(projectName)}</div>
          <div class="result-title">${titleHtml}</div>
        </div>
      </div>`;
    }).join('');

    results.classList.add('visible');
    state.addRecentSearch(query);
  }

  function openSearchResult(taskId) {
    const results = document.getElementById('searchResults');
    if (results) results.classList.remove('visible');
    
    const task = tasks.getById(taskId);
    if (!task) return;

    // Переключаем проект
    projects.setActive(task.projectId);
    kanban.render();
    renderSidebar();

    // Открываем задачу
    setTimeout(() => openTaskModal(taskId), 100);
  }

  // ===== ПОДТВЕРЖДЕНИЕ =====

  let confirmCallback = null;

  function showConfirm(title, text, onConfirm, icon) {
    document.getElementById('confirmModalTitle').textContent = title || 'Подтверждение';
    document.getElementById('confirmText').textContent = text || 'Вы уверены?';
    document.getElementById('confirmHint').textContent = icon || 'Это действие нельзя отменить.';
    document.getElementById('confirmIcon').textContent = '\u26A0';
    confirmCallback = onConfirm || null;
    openModal('confirmModal');
  }

  function confirmAction() {
    if (confirmCallback) {
      confirmCallback();
      confirmCallback = null;
    }
    closeModal('confirmModal');
  }

  // ===== УВЕДОМЛЕНИЯ =====

  function showNotification(message, type) {
    type = type || 'info';
    const container = document.getElementById('notificationContainer');
    if (!container) return;

    const icons = {
      success: '✓',
      error: '✗',
      warning: '⚠',
      info: 'ℹ'
    };

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
      <span class="notification-icon">${icons[type] || 'ℹ'}</span>
      <div class="notification-content">
        <div class="notification-title">${type === 'error' ? 'Ошибка' : type === 'warning' ? 'Предупреждение' : type === 'success' ? 'Успех' : 'Информация'}</div>
        <div class="notification-message">${message}</div>
      </div>
      <button class="notification-close" onclick="this.parentElement.classList.add('removing');setTimeout(()=>this.parentElement.remove(),300)">&times;</button>
    `;
    container.appendChild(notification);

    setTimeout(() => {
      if (notification.parentElement) {
        notification.classList.add('removing');
        setTimeout(() => notification.remove(), 300);
      }
    }, 5000);
  }

  // ===== ЭКСПОРТ/ИМПОРТ =====

  function exportData() {
    try {
      const json = state.exportData();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `todolist_backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showNotification('Данные экспортированы', 'success');
    } catch (e) {
      showNotification('Ошибка экспорта: ' + e.message, 'error');
    }
  }

  function importData() {
    document.getElementById('importFileInput').click();
  }

  function handleImportFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        state.importData(e.target.result);
        showNotification('Данные импортированы', 'success');
        renderSidebar();
        kanban.render();
      } catch (err) {
        showNotification(err.message, 'error');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }

  function clearAllData() {
    showConfirm(
      'Очистить все данные?',
      'Все проекты и задачи будут удалены. Это действие нельзя отменить.',
      () => {
        state.clearAllData();
        renderSidebar();
        kanban.render();
        showNotification('Все данные очищены', 'info');
      }
    );
  }

  // ===== БОКОВАЯ ПАНЕЛЬ =====

  function renderSidebar() {
    const container = document.getElementById('projectList');
    if (!container) return;

    const allProjects = projects.getAll();
    const activeId = projects.getActive()?.id;

    if (allProjects.length === 0) {
      container.innerHTML = '<div class="empty-state" style="padding:24px;"><div class="empty-state-icon">📋</div><div class="empty-state-text">Нет проектов</div></div>';
      return;
    }

    container.innerHTML = allProjects.map(p => {
      const taskCount = projects.getTaskCount(p.id);
      const isActive = p.id === activeId;
      return `
        <div class="project-item ${isActive ? 'active' : ''}" data-project-id="${p.id}" role="option" aria-selected="${isActive}" tabindex="0">
          <div class="project-icon" style="background:${p.color}22;color:${p.color};">${p.icon}</div>
          <div class="project-info">
            <div class="project-name">${kanban.escapeHtml(p.name)}</div>
            <div class="project-description">${kanban.escapeHtml(p.description || 'Нет описания')}</div>
          </div>
          <span class="project-count">${taskCount}</span>
          <div class="project-actions">
            <button class="btn-icon" data-edit-project="${p.id}" title="Редактировать" aria-label="Редактировать проект">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn-icon" data-delete-project="${p.id}" title="Удалить" aria-label="Удалить проект">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>`;
    }).join('');
  }

  // ===== ТЕМЫ =====

  function toggleTheme() {
    state.toggleTheme();
    const isDark = state.getTheme() === 'dark';
    const icon = document.querySelector('#themeToggle svg');
    if (icon) {
      icon.innerHTML = isDark
        ? '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>'
        : '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>';
    }
  }

  // ===== ПРОВЕРКА ДЕДЛАЙНОВ =====

  function checkDeadlines() {
    const setting = state.getData().settings;
    if (setting && setting.notificationsEnabled === false) return;

    const overdue = tasks.getOverdueTasks();
    const upcoming = tasks.getUpcomingTasks();

    const activeProject = projects.getActive();

    overdue.forEach(t => {
      if (t.projectId === activeProject?.id) {
        showNotification(`Просрочена: ${t.title}`, 'warning');
      }
    });

    upcoming.forEach(t => {
      if (t.projectId === activeProject?.id) {
        const d = new Date(t.deadline);
        const today = new Date();
        const isToday = d.toDateString() === today.toDateString();
        showNotification(
          `${isToday ? 'Сегодня' : 'Завтра'} дедлайн: ${t.title}`,
          'info'
        );
      }
    });
  }

  // ===== КОЛОНКИ =====

  let columnEditingId = null;

  function openColumnModal(columnId) {
    columnEditingId = columnId || null;
    const nameInput = document.getElementById('columnName');
    const titleEl = document.getElementById('columnModalTitle');

    nameInput.value = '';
    renderColumnModalColorPicker(null);

    if (columnId) {
      const columns = state.getDefaultColumns();
      const col = columns.find(c => c.id === columnId);
      if (col) {
        titleEl.textContent = 'Настройки колонки';
        nameInput.value = col.title;
        renderColumnModalColorPicker(col.color || null);
      }
    } else {
      titleEl.textContent = 'Новая колонка';
    }

    openModal('columnModal');
    setTimeout(() => nameInput.focus(), 100);
  }

  const columnColorPalette = [
    '#e03131', '#f76707', '#f08c00', '#fcc419',
    '#2f9e44', '#20c997', '#0c8599', '#4c6ef5',
    '#7950f2', '#ae3ec9', '#e64980', '#ff6b6b',
    '#5c7cfa', '#38d9a9', '#74c0fc', '#868e96'
  ];

  function renderColumnModalColorPicker(selected) {
    const container = document.getElementById('columnColorPicker');
    if (!container) return;
    container.innerHTML = '<div class="color-option' + (!selected ? ' selected' : '') + '" style="background:var(--bg-tertiary);border:2px dashed var(--text-muted);border-radius:6px;font-size:0.75rem;color:var(--text-muted);display:flex;align-items:center;justify-content:center;" data-color="" role="button" tabindex="0" title="Без цвета" onclick="TodoApp.UI.selectColumnModalColor(\'\')">✕</div>';
    columnColorPalette.forEach(color => {
      container.innerHTML += '<div class="color-option' + (color === selected ? ' selected' : '') + '" style="background:' + color + '" data-color="' + color + '" role="button" tabindex="0" onclick="TodoApp.UI.selectColumnModalColor(\'' + color + '\')"></div>';
    });
  }

  function selectColumnModalColor(color) {
    document.querySelectorAll('#columnColorPicker .color-option').forEach(el => el.classList.remove('selected'));
    if (color) {
      const sel = document.querySelector('#columnColorPicker .color-option[data-color="' + color + '"]');
      if (sel) sel.classList.add('selected');
    } else {
      const sel = document.querySelector('#columnColorPicker .color-option[data-color=""]');
      if (sel) sel.classList.add('selected');
    }
  }

  function saveColumn() {
    const name = document.getElementById('columnName').value.trim();
    if (!name) {
      showNotification('Введите название колонки', 'warning');
      return;
    }
    const selected = document.querySelector('#columnColorPicker .color-option.selected');
    const color = selected ? selected.dataset.color || null : null;

    if (columnEditingId) {
      const columns = state.getDefaultColumns();
      const col = columns.find(c => c.id === columnEditingId);
      if (col) {
        col.title = name;
        col.color = color;
        state.updateColumns(columns);
        showNotification('Колонка обновлена', 'success');
      }
    } else {
      kanban.addColumn(name);
      // set color after creation
      const columns = state.getDefaultColumns();
      const newCol = columns[columns.length - 1];
      if (newCol) {
        newCol.color = color;
        state.updateColumns(columns);
      }
      showNotification('Колонка добавлена', 'success');
    }
    closeModal('columnModal');
    kanban.render();
  }

  // ===== ФИЛЬТРЫ =====

  function initFilters() {
    const priorityFilter = document.getElementById('filterPriority');
    const assigneeFilter = document.getElementById('filterAssignee');
    const tagFilter = document.getElementById('filterTag');
    const quickFilters = document.querySelectorAll('.quick-filter-btn');

    if (priorityFilter) {
      priorityFilter.addEventListener('change', () => kanban.render());
    }
    if (assigneeFilter) {
      assigneeFilter.addEventListener('change', () => kanban.render());
    }
    if (tagFilter) {
      tagFilter.addEventListener('change', () => kanban.render());
    }

    quickFilters.forEach(btn => {
      btn.addEventListener('click', function() {
        quickFilters.forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        kanban.render();
      });
    });
  }

  // ===== ВСПОМОГАТЕЛЬНЫЕ =====

  function formatDateTime(isoStr) {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    const options = { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' };
    return d.toLocaleDateString('ru-RU', options);
  }

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  window.TodoApp.UI = {
    openProjectModal,
    saveProject,
    deleteProject,
    selectColor,
    selectIcon,
    openTaskModal,
    saveTask,
    deleteTask,
    duplicateTask,
    addTag,
    removeTag,
    editTag,
    renderModalSubtasks,
    addCommentUI,
    addAttachmentLink,
    removeAttachmentUI,
    performSearch,
    openSearchResult,
    showConfirm,
    confirmAction,
    showNotification,
    exportData,
    importData,
    handleImportFile,
    clearAllData,
    renderSidebar,
    toggleTheme,
    checkDeadlines,
    initFilters,
    formatDateTime,
    closeModal,
    openModal,
    closeAllModals,
    selectTaskColor,
    renderTaskColorPicker,
    switchToEditMode,
    openColumnModal,
    saveColumn,
    selectColumnModalColor
  };

  return {
    openProjectModal,
    saveProject,
    deleteProject,
    selectColor,
    selectIcon,
    openTaskModal,
    saveTask,
    deleteTask,
    duplicateTask,
    addTag,
    removeTag,
    editTag,
    renderModalSubtasks,
    addCommentUI,
    addAttachmentLink,
    removeAttachmentUI,
    performSearch,
    openSearchResult,
    showConfirm,
    confirmAction,
    showNotification,
    exportData,
    importData,
    handleImportFile,
    clearAllData,
    renderSidebar,
    toggleTheme,
    checkDeadlines,
    initFilters,
    formatDateTime,
    initSearch,
    closeModal,
    openModal,
    closeAllModals,
    selectTaskColor,
    renderTaskColorPicker,
    switchToEditMode,
    openColumnModal,
    saveColumn,
    selectColumnModalColor
  };
})();
