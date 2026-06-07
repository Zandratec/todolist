# TodoList — Kanban доска

Управление задачами с Kanban-доской. Чистый JavaScript, без серверной части, всё хранится в `localStorage`.

## Возможности

- Проекты с цветом, иконкой, описанием
- Задачи: заголовок, описание, приоритет, дедлайн, теги, исполнитель, цвет
- Подзадачи с неограниченной вложенностью и прогресс-баром
- Комментарии и вложения (ссылки + файлы)
- Kanban-доска с Drag & Drop задач и колонок
- Сортировка задач: просроченные → ближайший дедлайн → приоритет → порядок
- Сворачивание колонок
- Кастомная ширина и цвет колонок
- Глобальный поиск с историей запросов
- Фильтры: приоритет, исполнитель, тег, быстрые фильтры
- Тёмная и светлая тема
- Экспорт/импорт JSON
- Уведомления о дедлайнах
- Адаптивная вёрстка (десктоп → планшет → мобильные)
- Горячие клавиши (Ctrl+N, Ctrl+F, Escape, Delete)
- ARIA-атрибуты, клавиатурная навигация

## Структура проекта

```
index.html              # Главная страница
styles.css              # Все стили (темы, адаптивность, анимации)
js/
├── state.js            # localStorage, автосохранение, экспорт/импорт
├── projectManager.js   # CRUD проектов
├── taskManager.js      # CRUD задач, подзадачи, комментарии, вложения
├── kanban.js           # Отрисовка доски, Drag & Drop, колонки
├── ui.js               # Модалки, поиск, уведомления, тема
└── app.js              # Инициализация, делегирование событий, хоткеи
exe/                    # Электрон-обёртка (опционально)
```

## Технологии

- Чистый JavaScript (ES6+), без библиотек
- HTML5 Drag & Drop API
- CSS Custom Properties (темы)
- localStorage с автосохранением (debounce 500ms)
- Модульная архитектура через глобальное пространство `TodoApp.*`

## Запуск

Откройте `index.html` в браузере — всё работает из коробки.

## Сборка exe (Electron)

```bash
# Установить Node.js (https://nodejs.org)
# Создать папку exe и перейти в неё
mkdir exe
cd exe

# Инициализировать проект
npm init -y
npm install electron electron-builder --save-dev

# Создать main.js:
$content = @"
const { app, BrowserWindow } = require('electron');
const path = require('path');

const isDev = !app.isPackaged;

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'TodoList - Kanban доска',
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });

  const indexPath = isDev
    ? path.join(__dirname, '..', 'index.html')
    : path.join(process.resourcesPath, 'app', 'index.html');

  win.loadFile(indexPath);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
"@
Set-Content -Path main.js -Value $content

# Добавить в package.json секцию build:
# (откройте package.json и добавьте в конец перед последней })
```

### package.json — секция build

```json
"build": {
  "appId": "com.todolist.kanban",
  "productName": "TodoList",
  "directories": { "output": "dist" },
  "files": ["main.js", "package.json"],
  "extraResources": [
    {
      "from": "..",
      "to": "app",
      "filter": ["index.html", "styles.css", "js/**/*"]
    }
  ],
  "win": { "target": "portable" },
  "portable": { "artifactName": "TodoList-${version}-portable.exe" }
}
```

### Сборка

```bash
cd exe
npm run build
```

Готовый `.exe` появится в `exe/dist/TodoList-1.0.0-portable.exe` — работает без установки, носит с собой на флешке.

## Прочее

Проект создан с использованием нейросети (Claude/opencode) в рамках интерактивной разработки.
