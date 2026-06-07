/**
 * app.js — Главный модуль приложения. Инициализация, горячие клавиши, обработчики событий
 */
(function() {
  'use strict';

  const state = TodoApp.State;
  const projects = TodoApp.Projects;
  const tasks = TodoApp.Tasks;
  const kanban = TodoApp.Kanban;
  const ui = TodoApp.UI;

  // ===== ИНИЦИАЛИЗАЦИЯ =====

  function init() {
    state.init();
    ui.renderSidebar();
    kanban.render();
    ui.initSearch();
    ui.initFilters();
    setupEventDelegation();
    setupKeyboardShortcuts();
    setupColumnManagement();
    setupSidebarToggle();
    setupTooltips();
    
    // Проверка дедлайнов при загрузке
    setTimeout(() => ui.checkDeadlines(), 1000);

    // Периодическая проверка дедлайнов (каждые 5 минут)
    setInterval(() => ui.checkDeadlines(), 5 * 60 * 1000);

    console.log('TodoList приложение успешно запущено');
  }

  // ===== ДЕЛЕГИРОВАНИЕ СОБЫТИЙ =====

  function setupEventDelegation() {
    // === БОКОВАЯ ПАНЕЛЬ ===
    const projectList = document.getElementById('projectList');
    if (projectList) {
      projectList.addEventListener('click', function(e) {
        const target = e.target.closest('[data-project-id]');
        if (target && !e.target.closest('.btn-icon')) {
          const projectId = target.dataset.projectId;
          projects.setActive(projectId);
          ui.renderSidebar();
          kanban.render();
        }

        const editBtn = e.target.closest('[data-edit-project]');
        if (editBtn) {
          e.stopPropagation();
          ui.openProjectModal(editBtn.dataset.editProject);
        }

        const deleteBtn = e.target.closest('[data-delete-project]');
        if (deleteBtn) {
          e.stopPropagation();
          ui.deleteProject(deleteBtn.dataset.deleteProject);
        }
      });
    }

    // === НОВЫЙ ПРОЕКТ ===
    document.getElementById('newProjectBtn')?.addEventListener('click', () => ui.openProjectModal(null));
    document.getElementById('addProjectBtn')?.addEventListener('click', () => ui.openProjectModal(null));

    // === KANBAN ДОСКА ===
    const board = document.getElementById('kanbanBoard');
    if (board) {
      // Детектор двойного клика для открытия задачи
      let dblClickState = { taskId: null, timer: null };

      board.addEventListener('click', function(e) {
        const card = e.target.closest('.task-card');
        const taskId = card ? card.dataset.taskId : null;

        if (taskId && !e.target.closest('.btn-icon, .task-checkbox')) {
          if (dblClickState.taskId === taskId && dblClickState.timer) {
            clearTimeout(dblClickState.timer);
            dblClickState.timer = null;
            dblClickState.taskId = null;
            ui.openTaskModal(taskId);
            return;
          }
          if (dblClickState.timer) clearTimeout(dblClickState.timer);
          dblClickState.taskId = taskId;
          dblClickState.timer = setTimeout(() => {
            dblClickState.timer = null;
            dblClickState.taskId = null;
          }, 300);
        }

        // Добавить задачу
        const addBtn = e.target.closest('[data-add-task]');
        if (addBtn) {
          const columnId = addBtn.dataset.addTask;
          ui.openTaskModal(null, columnId);
        }

        // Чекбокс выполненной задачи
        const toggleCheckbox = e.target.closest('[data-toggle-task]');
        if (toggleCheckbox) {
          const taskId = toggleCheckbox.dataset.toggleTask;
          tasks.toggleComplete(taskId);
          kanban.render();
          ui.renderSidebar();
        }

        // Дублировать задачу
        const dupeBtn = e.target.closest('[data-duplicate-task]');
        if (dupeBtn) {
          ui.duplicateTask(dupeBtn.dataset.duplicateTask);
        }

        // Добавить подзадачу с карточки
        const addSubBtn = e.target.closest('[data-add-subtask]');
        if (addSubBtn) {
          e.stopPropagation();
          kanban.addSubtaskFromCard(addSubBtn.dataset.addSubtask);
        }

        // Развернуть/свернуть список подзадач
        const expandBtn = e.target.closest('[data-expand-subtasks]');
        if (expandBtn) {
          e.stopPropagation();
          kanban.toggleSubtaskList(expandBtn.dataset.expandSubtasks);
        }

        // Удалить задачу
        const deleteBtn = e.target.closest('[data-delete-task]');
        if (deleteBtn) {
          const taskId = deleteBtn.dataset.deleteTask;
          ui.showConfirm(
            'Удалить задачу?',
            'Это действие нельзя отменить.',
            () => {
              tasks.remove(taskId);
              kanban.render();
              ui.renderSidebar();
              ui.showNotification('Задача удалена', 'info');
            }
          );
        }

        // Свернуть/развернуть колонку
        const toggleCol = e.target.closest('[data-toggle-column]');
        if (toggleCol && !e.target.closest('.btn-icon, .column-drag-handle, .column-color-dot')) {
          const col = toggleCol.closest('.kanban-column');
          if (col) {
            kanban.toggleColumnCollapse(col.dataset.columnId);
          }
        }
      });

      // Drag-and-drop — подсветка колонки при перетаскивании
      board.addEventListener('dragenter', function(e) {
        e.preventDefault();
        const columnBody = e.target.closest('[data-column-body]');
        if (columnBody) {
          const column = columnBody.closest('.kanban-column');
          if (column && !column.classList.contains('drag-over-column')) {
            document.querySelectorAll('.kanban-column.drag-over-column').forEach(el => {
              el.classList.remove('drag-over-column');
            });
            column.classList.add('drag-over-column');
          }
        }
      });

      board.addEventListener('dragover', function(e) {
        e.preventDefault();
      });

      board.addEventListener('dragleave', function(e) {
        const column = e.target.closest('.kanban-column');
        if (column) {
          const related = e.relatedTarget;
          if (!related || !column.contains(related)) {
            column.classList.remove('drag-over-column');
          }
        }
      });
    }

    // === МОДАЛЬНЫЕ ОКНА ===
    document.querySelectorAll('[data-modal-close]').forEach(el => {
      el.addEventListener('click', function() {
        const modal = this.closest('.modal-overlay');
        if (modal) ui.closeModal(modal.id);
      });
    });

    // Закрытие по клику на оверлей
    document.querySelectorAll('.modal-overlay').forEach(el => {
      el.addEventListener('click', function(e) {
        if (e.target === this) {
          ui.closeModal(this.id);
        }
      });
    });

    // === МОДАЛКА ПРОЕКТА ===
    document.getElementById('saveProjectBtn')?.addEventListener('click', () => ui.saveProject());

    // === МОДАЛКА ЗАДАЧИ ===
    document.getElementById('saveTaskBtn')?.addEventListener('click', function() { ui.saveTask(false); });
    document.getElementById('saveAndCloseBtn')?.addEventListener('click', function() { ui.saveTask(true); });
    document.getElementById('editTaskBtn')?.addEventListener('click', () => ui.switchToEditMode());
    document.getElementById('deleteTaskBtn')?.addEventListener('click', () => ui.deleteTask(null));
    document.getElementById('addTagBtn')?.addEventListener('click', () => ui.addTag());
    document.getElementById('taskTagInput')?.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { e.preventDefault(); ui.addTag(); }
    });
    document.getElementById('addCommentBtn')?.addEventListener('click', () => ui.addCommentUI());
    document.getElementById('commentInput')?.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ui.addCommentUI(); }
    });
    document.getElementById('addAttachmentBtn')?.addEventListener('click', () => ui.addAttachmentLink());

    // === ПОДТВЕРЖДЕНИЕ ===
    document.getElementById('confirmActionBtn')?.addEventListener('click', () => ui.confirmAction());

    // === КОЛОНКИ ===
    document.getElementById('columnSaveBtn')?.addEventListener('click', () => ui.saveColumn());
    document.getElementById('columnName')?.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { e.preventDefault(); ui.saveColumn(); }
    });

    // === ПОДЗАДАЧИ (модалка) ===
    document.getElementById('subtaskAddBtn')?.addEventListener('click', () => {
      kanban.submitAddSubtask();
    });
    document.getElementById('subtaskNewTitle')?.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { e.preventDefault(); kanban.submitAddSubtask(); }
    });
    document.getElementById('subtaskExistingSelect')?.addEventListener('change', function() {
      if (this.value) {
        document.getElementById('subtaskNewTitle').disabled = true;
      } else {
        document.getElementById('subtaskNewTitle').disabled = false;
      }
    });

    // === РАЗМЕР КОЛОНОК ===
    if (board) {
      let resizeData = null;

      board.addEventListener('mousedown', function(e) {
        const handle = e.target.closest('.column-resize-handle');
        if (!handle) return;
        e.preventDefault();
        const col = handle.closest('.kanban-column');
        if (!col) return;
        resizeData = {
          columnId: col.dataset.columnId,
          startX: e.clientX,
          startWidth: col.offsetWidth
        };
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
      });

      document.addEventListener('mousemove', function(e) {
        if (!resizeData) return;
        const dx = e.clientX - resizeData.startX;
        const newWidth = Math.max(180, Math.min(600, resizeData.startWidth + dx));
        const col = document.querySelector(`.kanban-column[data-column-id="${resizeData.columnId}"]`);
        if (col) {
          col.style.width = newWidth + 'px';
          col.style.minWidth = newWidth + 'px';
          col.style.maxWidth = 'none';
        }
      });

      document.addEventListener('mouseup', function(e) {
        if (!resizeData) return;
        const col = document.querySelector(`.kanban-column[data-column-id="${resizeData.columnId}"]`);
        if (col) {
          const finalWidth = col.offsetWidth;
          kanban.setColumnWidth(resizeData.columnId, finalWidth);
        }
        resizeData = null;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      });
    }

    // === ТЕМА ===
    document.getElementById('themeToggle')?.addEventListener('click', () => ui.toggleTheme());

    // === ЭКСПОРТ/ИМПОРТ ===
    document.getElementById('exportBtn')?.addEventListener('click', () => ui.exportData());
    document.getElementById('importBtn')?.addEventListener('click', () => ui.importData());
    document.getElementById('importFileInput')?.addEventListener('change', (e) => ui.handleImportFile(e));
    document.getElementById('clearDataBtn')?.addEventListener('click', () => ui.clearAllData());
  }

  // ===== УПРАВЛЕНИЕ КОЛОНКАМИ =====

  function setupColumnManagement() {
    const board = document.getElementById('kanbanBoard');
    if (!board) return;

    board.addEventListener('click', function(e) {
      const deleteColBtn = e.target.closest('[data-delete-column]');
      if (deleteColBtn) {
        const col = deleteColBtn.closest('.kanban-column');
        if (col) {
          const columnId = col.dataset.columnId;
          ui.showConfirm(
            'Удалить колонку?',
            '',
            () => kanban.deleteColumn(columnId),
            'Удалить колонку'
          );
        }
      }
    });
  }

  // ===== ГОРЯЧИЕ КЛАВИШИ =====

  function setupKeyboardShortcuts() {
    document.addEventListener('keydown', function(e) {
      // Ctrl+N — новая задача
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        const activeProject = projects.getActive();
        if (activeProject) {
          ui.openTaskModal(null);
        } else {
          ui.showNotification('Сначала создайте проект', 'warning');
        }
      }

      // Ctrl+F — поиск
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        const searchInput = document.getElementById('globalSearch');
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      }

      // Escape — закрыть модалку
      if (e.key === 'Escape') {
        const openModal = document.querySelector('.modal-overlay.open');
        if (openModal) {
          ui.closeModal(openModal.id);
        }
      }

      // Delete — удалить (только если модалка задачи открыта)
      if (e.key === 'Delete' || e.key === 'Del') {
        const taskModal = document.getElementById('taskModal');
        if (taskModal?.classList.contains('open') && editingTaskId) {
          const deleteBtn = document.getElementById('deleteTaskBtn');
          if (deleteBtn && deleteBtn.style.display !== 'none') {
            ui.deleteTask(null);
          }
        }
      }
    });
  }

  // ===== БОКОВАЯ ПАНЕЛЬ (МОБИЛЬНАЯ) =====

  function setupSidebarToggle() {
    const toggleBtn = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');
    if (toggleBtn && sidebar) {
      // На мобильных устройствах скрываем панель по умолчанию
      if (window.innerWidth <= 768) {
        sidebar.classList.add('collapsed');
      }

      toggleBtn.addEventListener('click', function() {
        sidebar.classList.toggle('collapsed');
      });

      // Закрытие сайдбара при клике на основную область (на мобильных)
      const main = document.getElementById('mainContent');
      if (main) {
        main.addEventListener('click', function() {
          if (window.innerWidth <= 768 && !sidebar.classList.contains('collapsed')) {
            sidebar.classList.add('collapsed');
          }
        });
      }

      // Проверка размера окна
      window.addEventListener('resize', function() {
        if (window.innerWidth > 768) {
          sidebar.classList.remove('collapsed');
        }
      });
    }
  }

  function setupTooltips() {
    let tooltipEl = null;
    let showTimer = null;
    let hideTimer = null;

    function getTooltip() {
      if (!tooltipEl) {
        tooltipEl = document.createElement('div');
        tooltipEl.className = 'app-tooltip';
        document.body.appendChild(tooltipEl);
      }
      return tooltipEl;
    }

    function showTooltip(target) {
      clearTimeout(hideTimer);
      const el = getTooltip();
      const text = target.getAttribute('data-tooltip');
      if (!text) return;
      el.textContent = text;
      el.classList.remove('visible');

      const rect = target.getBoundingClientRect();
      let left = rect.left + rect.width / 2;
      let top = rect.top - 6;

      el.style.left = '0px';
      el.style.top = '0px';
      const tw = el.offsetWidth;
      left -= tw / 2;

      if (left < 4) left = 4;
      if (left + tw > window.innerWidth - 4) left = window.innerWidth - 4 - tw;
      if (top < 4) top = rect.bottom + 6;

      el.style.left = left + 'px';
      el.style.top = top + 'px';
      requestAnimationFrame(function() { el.classList.add('visible'); });
    }

    function hideTooltip() {
      clearTimeout(showTimer);
      hideTimer = setTimeout(function() {
        if (tooltipEl) tooltipEl.classList.remove('visible');
      }, 80);
    }

    document.addEventListener('mouseenter', function(e) {
      const target = e.target.closest('[data-tooltip]');
      if (!target) return;
      clearTimeout(hideTimer);
      clearTimeout(showTimer);
      showTimer = setTimeout(function() { showTooltip(target); }, 300);
    }, true);

    document.addEventListener('mouseleave', function(e) {
      const target = e.target.closest('[data-tooltip]');
      if (!target) return;
      hideTooltip();
    }, true);
  }

  // и добавляем ссылку на editingTaskId для Delete
  let editingTaskId = null;
  
  // Патчим ui.openTaskModal для отслеживания editingTaskId
  const originalOpenTaskModal = ui.openTaskModal;
  ui.openTaskModal = function(taskId, prefillColumnId) {
    editingTaskId = taskId || null;
    originalOpenTaskModal(taskId, prefillColumnId);
  };

  // ===== ЗАПУСК =====
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
