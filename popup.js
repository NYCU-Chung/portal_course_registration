// ==================== 日誌系統 ====================
// 用於收集擴充功能操作日誌（完全鏡像 console）
const aiSearchLogs = [];
let logIdCounter = 0;

// 保存原始 console 方法
const originalConsole = {
  log: console.log,
  info: console.info,
  warn: console.warn,
  error: console.error,
  debug: console.debug,
  table: console.table
};

// 攔截 console 方法
function interceptConsole() {
  const interceptMethod = (method, type) => {
    console[method] = function(...args) {
      // 調用原始 console 方法
      originalConsole[method].apply(console, args);

      // 保存到日誌（保存原始參數，不轉成字串）
      const timestamp = new Date().toLocaleTimeString('zh-TW', { hour12: false });
      aiSearchLogs.push({
        id: logIdCounter++,
        time: timestamp,
        type: type,
        method: method,
        args: args // 保存原始參數
      });

      // 限制日誌數量
      if (aiSearchLogs.length > 500) {
        aiSearchLogs.shift();
      }

      // 動態更新顯示
      updateLogDisplay();
    };
  };

  interceptMethod('log', 'log');
  interceptMethod('info', 'info');
  interceptMethod('warn', 'warn');
  interceptMethod('error', 'error');
  interceptMethod('debug', 'debug');
  interceptMethod('table', 'table');
}

// ⭐ 立即執行攔截器，不要等待 DOMContentLoaded
interceptConsole();

// 更新日誌顯示（如果面板已打開）
function updateLogDisplay() {
  const logModal = document.getElementById('logModal');
  const logContent = document.getElementById('logContent');

  if (logModal && logContent && logModal.style.display === 'flex') {
    const shouldScroll = logContent.scrollHeight - logContent.scrollTop <= logContent.clientHeight + 100;
    logContent.innerHTML = getLogsHTML();

    // 重新綁定展開/收合事件
    attachLogEventListeners();

    // 如果之前在底部，保持在底部
    if (shouldScroll) {
      logContent.scrollTop = logContent.scrollHeight;
    }
  }
}

function clearLogs() {
  aiSearchLogs.length = 0;
  updateLogDisplay();
}

function getLogsHTML() {
  if (aiSearchLogs.length === 0) {
    return '<div class="log-placeholder">尚無日誌記錄</div>';
  }

  return aiSearchLogs.map(log => renderLogEntry(log)).join('\n');
}

// 渲染單個日誌條目
function renderLogEntry(log) {
  const typeClass = `log-${log.type}`;
  const icon = {
    'log': '📝',
    'info': 'ℹ️',
    'warn': '⚠️',
    'error': '❌',
    'debug': '🐛'
  }[log.type] || '📝';

  const argsHTML = log.args.map((arg, index) => renderValue(arg, log.id, [index])).join(' ');

  return `<div class="log-entry ${typeClass}" data-log-id="${log.id}">
    <span class="log-time">[${log.time}]</span>
    <span class="log-icon">${icon}</span>
    <span class="log-content">${argsHTML}</span>
  </div>`;
}

// 渲染值（支援展開/收合）
function renderValue(value, logId, path, depth = 0) {
  const pathStr = path.join('.');

  if (value === null) {
    return `<span class="log-null">null</span>`;
  }

  if (value === undefined) {
    return `<span class="log-undefined">undefined</span>`;
  }

  if (typeof value === 'string') {
    return `<span class="log-string">"${escapeHtml(value)}"</span>`;
  }

  if (typeof value === 'number') {
    return `<span class="log-number">${value}</span>`;
  }

  if (typeof value === 'boolean') {
    return `<span class="log-boolean">${value}</span>`;
  }

  if (typeof value === 'function') {
    return `<span class="log-function">${value.toString().substring(0, 100)}${value.toString().length > 100 ? '...' : ''}</span>`;
  }

  // 陣列
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return `<span class="log-array">[]</span>`;
    }

    const preview = value.length === 1 ? '1 item' : `${value.length} items`;
    const id = `log-${logId}-${pathStr}`;

    return `<div class="log-expandable">
      <span class="log-toggle" data-target="${id}">▶</span>
      <span class="log-array-label">Array(${value.length})</span>
      <span class="log-preview">[${preview}]</span>
      <div class="log-expanded-content" id="${id}" style="display: none;">
        ${value.map((item, i) => `
          <div class="log-property">
            <span class="log-key">${i}:</span>
            ${renderValue(item, logId, [...path, i], depth + 1)}
          </div>
        `).join('')}
      </div>
    </div>`;
  }

  // 物件
  if (typeof value === 'object') {
    const keys = Object.keys(value);

    if (keys.length === 0) {
      return `<span class="log-object">{}</span>`;
    }

    const preview = keys.slice(0, 3).map(k => `${k}: ...`).join(', ');
    const id = `log-${logId}-${pathStr}`;

    return `<div class="log-expandable">
      <span class="log-toggle" data-target="${id}">▶</span>
      <span class="log-object-label">{...}</span>
      <span class="log-preview">{${preview}${keys.length > 3 ? '...' : ''}}</span>
      <div class="log-expanded-content" id="${id}" style="display: none;">
        ${keys.map(key => `
          <div class="log-property">
            <span class="log-key">${escapeHtml(key)}:</span>
            ${renderValue(value[key], logId, [...path, key], depth + 1)}
          </div>
        `).join('')}
      </div>
    </div>`;
  }

  return `<span class="log-other">${String(value)}</span>`;
}

// 綁定展開/收合事件
function attachLogEventListeners() {
  document.querySelectorAll('.log-toggle').forEach(toggle => {
    toggle.onclick = function(e) {
      e.stopPropagation();
      const targetId = this.getAttribute('data-target');
      const content = document.getElementById(targetId);

      if (content) {
        const isExpanded = content.style.display !== 'none';
        content.style.display = isExpanded ? 'none' : 'block';
        this.textContent = isExpanded ? '▶' : '▼';
      }
    };
  });
}

// 複製日誌（完整展開）
function copyLogsToClipboard() {
  const text = aiSearchLogs.map(log => {
    const timestamp = log.time;
    const args = log.args.map(arg => deepStringify(arg)).join(' ');
    return `[${timestamp}] ${args}`;
  }).join('\n');

  navigator.clipboard.writeText(text).then(() => {
    alert('日誌已複製到剪貼簿');
  }).catch(err => {
    console.error('複製失敗:', err);
  });
}

// 深度序列化（用於複製）
function deepStringify(obj, indent = 0, visited = new WeakSet()) {
  if (obj === null) return 'null';
  if (obj === undefined) return 'undefined';
  if (typeof obj === 'string') return `"${obj}"`;
  if (typeof obj === 'number' || typeof obj === 'boolean') return String(obj);
  if (typeof obj === 'function') return obj.toString();

  // 防止循環引用
  if (typeof obj === 'object') {
    if (visited.has(obj)) return '[Circular]';
    visited.add(obj);
  }

  const spaces = '  '.repeat(indent);
  const nextSpaces = '  '.repeat(indent + 1);

  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]';
    const items = obj.map(item => nextSpaces + deepStringify(item, indent + 1, visited)).join(',\n');
    return `[\n${items}\n${spaces}]`;
  }

  if (typeof obj === 'object') {
    const keys = Object.keys(obj);
    if (keys.length === 0) return '{}';
    const items = keys.map(key =>
      `${nextSpaces}${key}: ${deepStringify(obj[key], indent + 1, visited)}`
    ).join(',\n');
    return `{\n${items}\n${spaces}}`;
  }

  return String(obj);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 保留 addLog 函數以保持向後兼容
function addLog(type, message) {
  const methodMap = {
    'info': 'info',
    'success': 'log',
    'warning': 'warn',
    'error': 'error'
  };

  const method = methodMap[type] || 'log';
  const icon = {
    'info': 'ℹ️',
    'success': '✅',
    'warning': '⚠️',
    'error': '❌'
  }[type] || '📝';

  console[method](`${icon} ${message}`);
}

// ==================== 教室代碼對照表 ====================
const campusMap = {
  // 台北陽明校區 [YM]
  'YN': '台北陽明校區 護理館',
  'YE': '台北陽明校區 實驗大樓',
  'YR': '台北陽明校區 守仁樓',
  'YS': '台北陽明校區 醫學二館',
  'YB': '台北陽明校區 生醫工程館',
  'YX': '台北陽明校區 知行樓',
  'YD': '台北陽明校區 牙醫館',
  'YK': '台北陽明校區 傳統醫學大樓(甲棟)',
  'YT': '台北陽明校區 教學大樓',
  'YM': '台北陽明校區 醫學館',
  'YL': '台北陽明校區 圖書資源暨研究大樓',
  'YA': '台北陽明校區 活動中心',
  'YH': '台北陽明校區 致和樓',
  'YC': '台北陽明校區 生物醫學大樓',
  'AS': '中央研究院',
  'PH': '臺北榮民總醫院',
  'CH': '台中榮民總醫院',
  'KH': '高雄榮民總醫院',

  // 新竹博愛校區 [BA]
  'C': '新竹博愛校區 竹銘館',
  'E': '新竹博愛校區 教學大樓',
  'LI': '新竹博愛校區 實驗一館',
  'BA': '新竹博愛校區 生科實驗館',
  'BB': '新竹博愛校區 生科實驗二館',
  'BI': '新竹博愛校區 賢齊館',

  // 新竹光復校區 [GF]
  'EA': '新竹光復校區 工程一館',
  'EB': '新竹光復校區 工程二館',
  'EC': '新竹光復校區 工程三館',
  'ED': '新竹光復校區 工程四館',
  'EE': '新竹光復校區 工程五館',
  'EF': '新竹光復校區 工程六館',
  'M': '新竹光復校區 管理館',
  'MB': '新竹光復校區 管理二館',
  'SA': '新竹光復校區 科學一館',
  'SB': '新竹光復校區 科學二館',
  'SC': '新竹光復校區 科學三館',
  'AC': '新竹光復校區 學生活動中心',
  'A': '新竹光復校區 綜合一館',
  'AB': '新竹光復校區 綜合一館地下室',
  'HA': '新竹光復校區 人社一館',
  'F': '新竹光復校區 人社二館',
  'HB': '新竹光復校區 人社二館',
  'HC': '新竹光復校區 人社三館',
  'CY': '新竹光復校區 交映樓',
  'EO': '新竹光復校區 田家炳光電大樓',
  'EV': '新竹光復校區 環工館',
  'CS': '新竹光復校區 資訊技術服務中心',
  'ES': '新竹光復校區 電子資訊中心',
  'CE': '新竹光復校區 土木結構實驗室',
  'AD': '新竹光復校區 大禮堂',
  'Lib': '新竹光復校區 浩然圖書資訊中心',

  // 台北北門校區 [BM]
  'TA': '台北北門校區 會議室',
  'TD': '台北北門校區 一般教室',
  'TC': '台北北門校區 演講廳',

  // 台南歸仁校區 [GR]
  'CM': '台南歸仁校區 奇美樓',

  // 新竹六家校區 [LJ]
  'HK': '新竹六家校區 客家大樓',

  // 高雄校區 [KS]
  'KB': '高雄校區 高雄B棟',
  'KC': '高雄校區 高雄C棟'
};

// 解析教室代碼為完整地點
function parseRoomLocation(roomCode) {
  if (!roomCode) return '';

  // 移除空白
  roomCode = roomCode.trim();

  // 移除校區標記（如 [GF], [YM], [BA] 等）
  roomCode = roomCode.replace(/\[[A-Z]+\]/g, '').trim();

  // 提取建築物代碼（通常是開頭的英文字母部分）
  const match = roomCode.match(/^([A-Za-z]+)/);
  if (!match) return roomCode;

  const buildingCode = match[1].toUpperCase();
  const roomNumber = roomCode.substring(buildingCode.length);

  // 查找對應的建築物名稱
  if (campusMap[buildingCode]) {
    return `${campusMap[buildingCode]} ${roomNumber}`;
  }

  return roomCode; // 找不到對應就返回原代碼
}

// 等待 DOM 載入完成
document.addEventListener('DOMContentLoaded', function() {
  let allDepartments = [];
  const requiredElements = ['searchInput', 'searchBtn', 'results', 'dataStatus'];
  const missingElements = requiredElements.filter(id => !document.getElementById(id));
  if (missingElements.length > 0) {
    console.error('❌ 缺少必要的 DOM 元素:', missingElements.join(', '));
    return; // 提前退出，避免後續錯誤
  }

  const searchInput = document.getElementById('searchInput');
  const searchBtn = document.getElementById('searchBtn');
  const refreshBtn = document.getElementById('refreshData');
  const resultsDiv = document.getElementById('results');
  const loadingDiv = document.getElementById('loading');
  const dataStatusDiv = document.getElementById('dataStatus');
  const keywordStatusDiv = document.getElementById('keywordStatus');

  // 分頁相關元素
  const searchTab = document.getElementById('searchTab');
  const bookmarksTab = document.getElementById('bookmarksTab');
  const timetableTab = document.getElementById('timetableTab');
  const helpTab = document.getElementById('helpTab');
  const searchArea = document.getElementById('searchArea');
  const bookmarksArea = document.getElementById('bookmarksArea');
  const timetableArea = document.getElementById('timetableArea');
  const helpArea = document.getElementById('helpArea');
  const bookmarksList = document.getElementById('bookmarksList');
  const bookmarkCount = document.getElementById('bookmarkCount');
  const clearAllBookmarks = document.getElementById('clearAllBookmarks');

  // 課表相關元素
  const timetableCount = document.getElementById('timetableCount');
  const timetableCredits = document.getElementById('timetableCredits');
  const toggleViewBtn = document.getElementById('toggleViewBtn');
  const exportTimetableBtn = document.getElementById('exportTimetableBtn');
  const exportCalendarBtn = document.getElementById('exportCalendarBtn');
  const clearAllTimetable = document.getElementById('clearAllTimetable');
  const gridViewContainer = document.getElementById('gridViewContainer');
  const listViewContainer = document.getElementById('listViewContainer');
  const timetableGrid = document.getElementById('timetableGrid');
  const timetableList = document.getElementById('timetableList');
  const timetablePlaceholder = document.getElementById('timetablePlaceholder');
  const showWeekendCheckbox = document.getElementById('showWeekendCheckbox');

  // 篩選器相關元素
  const clearFiltersBtn = document.getElementById('clearFilters');
  const filterHeader = document.getElementById('filterHeader');
  const filterSections = document.getElementById('filterSections');
  const filterCourseTypes = document.querySelectorAll('.filter-course-type');
  const filterCredits = document.querySelectorAll('.filter-credits');
  const filterCollege = document.getElementById('filterCollege');
  const filterDepartment = document.getElementById('filterDepartment');
  const filterWeekdays = document.querySelectorAll('.filter-weekday');
  const filterPeriods = document.querySelectorAll('.filter-period');

  // 篩選器收合狀態（預設收起）
  let filterCollapsed = true;
  if (filterSections) {
    filterSections.classList.add('collapsed');
  }

  // AI 搜尋相關元素
  const stopSearchBtn = document.getElementById('stopSearchBtn');
  const cancelWarning = document.getElementById('cancelWarning');
  const aiSearchToggle = document.getElementById('aiSearchToggle');
  const aiThinking = document.getElementById('aiThinking');
  const aiTimer = document.getElementById('aiTimer');

  // AI 搜尋中斷標誌
  let aiSearchCancelled = false;

  // 詳細頁面相關元素
  const detailPage = document.getElementById('detailPage');
  const detailPageContent = document.getElementById('detailPageContent');
  const backButton = document.getElementById('backButton');
  const backBtn = document.getElementById('backBtn');
  const pageTitle = document.getElementById('pageTitle');
  const tabButtons = document.getElementById('tabButtons');

  // 書籤資料（支持多分類）
  let bookmarkCategories = {
    'default': {
      name: '我的書籤',
      icon: '⭐',
      courses: {}
    }
  };
  let bookmarks = {}; // 保持向後兼容的快速查找 {courseKey: categoryId}
  let collapsedCategories = {}; // 記錄收合狀態 {categoryId: boolean}
  let currentResults = []; // 保存當前搜尋結果
  let courseDetailsCache = {}; // 快取課程詳細資訊

  // 載入課程詳細資訊快取
  loadCourseDetailsCache();

  // 課表資料
  let timetable = {};
  let timetableViewMode = 'grid'; // 'grid' or 'list' - 預設為格子模式
  let showWeekend = false; // 是否顯示週六日
  let selectedCoursesForSlots = {}; // 每個時段選擇的課程 {day-period: courseKey}

  // 載入書籤資料
  loadBookmarks();

  // 載入課表資料
  loadTimetable();

  // 顯示資料狀態
  updateDataStatus();
  updateKeywordExtractionStatus();

  // 初始化篩選器選項
  initializeFiltersOnLoad();

  // 檢查是否為首次使用，顯示歡迎引導
  checkFirstTimeUser();

  // 全域鍵盤事件：ESC 關閉彈窗
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      // 依優先順序關閉彈窗
      const slotMenu = document.querySelector('.course-slot-menu');
      if (slotMenu) {
        slotMenu.remove();
        return;
      }

      const modalOverlay = document.querySelector('.course-modal-overlay');
      if (modalOverlay) {
        modalOverlay.remove();
        return;
      }
    }
  });

  // 搜尋按鈕事件
  searchBtn.addEventListener('click', function() {
    performSearch();
  });

  // Enter 鍵搜尋
  searchInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      performSearch();
    }
  });

  // 重新載入資料
  refreshBtn.addEventListener('click', function() {
    addLog('info', '開始重新載入課程資料');
    chrome.storage.local.remove(['courseData', 'lastUpdate', 'courseDetailsCache'], function() {
      // 清空記憶體中的快取
      courseDetailsCache = {};
      addLog('success', '已清除快取，開啟課程網站載入資料');
      // 自動開啟課程網站並開始載入
      chrome.tabs.create({ url: 'https://timetable.nycu.edu.tw/' }, function() {
        alert('即將開始重新載入課程資料，約需 5 分鐘，請稍候...');
      });
    });
  });

  // 分頁切換事件
  searchTab.addEventListener('click', function() {
    searchTab.classList.add('active');
    bookmarksTab.classList.remove('active');
    timetableTab.classList.remove('active');
    helpTab.classList.remove('active');
    searchArea.classList.add('active');
    bookmarksArea.classList.remove('active');
    timetableArea.classList.remove('active');
    helpArea.classList.remove('active');

    // 確保詳細頁面被隱藏
    detailPage.style.display = 'none';
    backButton.style.display = 'none';
    tabButtons.style.display = 'flex';
    dataStatusDiv.style.display = 'block';

    // 清除可能的 inline style
    searchArea.style.display = '';
    bookmarksArea.style.display = '';

    addLog('info', '切換到搜尋頁面');
    pageTitle.textContent = 'NYCU 選課助手';
  });

  bookmarksTab.addEventListener('click', function() {
    bookmarksTab.classList.add('active');
    searchTab.classList.remove('active');
    timetableTab.classList.remove('active');
    helpTab.classList.remove('active');
    bookmarksArea.classList.add('active');
    searchArea.classList.remove('active');
    timetableArea.classList.remove('active');
    helpArea.classList.remove('active');

    // 確保詳細頁面被隱藏
    detailPage.style.display = 'none';
    backButton.style.display = 'none';
    tabButtons.style.display = 'flex';
    dataStatusDiv.style.display = 'block';

    // 清除可能的 inline style
    searchArea.style.display = '';
    bookmarksArea.style.display = '';

    addLog('info', '切換到書籤頁面');
    pageTitle.textContent = '我的書籤';
    displayBookmarks();
  });

  timetableTab.addEventListener('click', function() {
    timetableTab.classList.add('active');
    searchTab.classList.remove('active');
    bookmarksTab.classList.remove('active');
    helpTab.classList.remove('active');
    timetableArea.classList.add('active');
    searchArea.classList.remove('active');
    bookmarksArea.classList.remove('active');
    helpArea.classList.remove('active');

    // 確保詳細頁面被隱藏
    detailPage.style.display = 'none';
    backButton.style.display = 'none';
    tabButtons.style.display = 'flex';
    dataStatusDiv.style.display = 'block';

    // 清除可能的 inline style
    searchArea.style.display = '';
    bookmarksArea.style.display = '';

    addLog('info', '切換到課表頁面');
    pageTitle.textContent = '我的課表';
    displayTimetable();
  });

  helpTab.addEventListener('click', function() {
    helpTab.classList.add('active');
    searchTab.classList.remove('active');
    bookmarksTab.classList.remove('active');
    timetableTab.classList.remove('active');
    helpArea.classList.add('active');
    searchArea.classList.remove('active');
    bookmarksArea.classList.remove('active');
    timetableArea.classList.remove('active');

    // 確保詳細頁面被隱藏
    detailPage.style.display = 'none';
    backButton.style.display = 'none';
    tabButtons.style.display = 'flex';
    dataStatusDiv.style.display = 'block';

    // 清除可能的 inline style
    searchArea.style.display = '';
    bookmarksArea.style.display = '';

    pageTitle.textContent = '使用說明';
  });

  // 清空所有書籤
  clearAllBookmarks.addEventListener('click', function() {
    if (confirm('確定要清空所有書籤嗎？')) {
      const count = Object.keys(bookmarks).length;
      // 清空所有分類中的課程
      for (const categoryId in bookmarkCategories) {
        bookmarkCategories[categoryId].courses = {};
      }
      bookmarks = {};
      saveBookmarks();
      displayBookmarks();
      addLog('info', `清空所有書籤 (${count} 門課程)`);
    }
  });

  // 新增分類按鈕
  const addCategoryBtn = document.getElementById('addCategoryBtn');
  if (addCategoryBtn) {
    addCategoryBtn.addEventListener('click', showAddCategoryModal);
  }

  // 清空課表
  clearAllTimetable.addEventListener('click', function() {
    if (confirm('確定要清空課表嗎？')) {
      const count = Object.keys(timetable).length;
      timetable = {};
      saveTimetable();
      displayTimetable();
      addLog('info', `清空課表 (${count} 門課程)`);
    }
  });

  // 切換課表檢視模式
  toggleViewBtn.addEventListener('click', function() {
    if (timetableViewMode === 'grid') {
      timetableViewMode = 'list';
      gridViewContainer.style.display = 'none';
      listViewContainer.style.display = 'block';
      toggleViewBtn.textContent = '切換為格子模式';
    } else {
      timetableViewMode = 'grid';
      gridViewContainer.style.display = 'block';
      listViewContainer.style.display = 'none';
      toggleViewBtn.textContent = '切換為清單模式';
    }
    saveTimetable();
    displayTimetable();
  });

  // 匯出課表為圖片
  exportTimetableBtn.addEventListener('click', exportTimetableAsImage);

  // 匯出課表為日曆
  exportCalendarBtn.addEventListener('click', exportTimetableAsCalendar);

  // 顯示週六日切換
  showWeekendCheckbox.addEventListener('change', function() {
    showWeekend = this.checked;
    saveTimetable();
    displayTimetable();
  });

  // 返回按鈕事件
  backBtn.addEventListener('click', function() {
    showListView();
  });

  // 篩選器事件監聽
  // 收合/展開篩選器
  function toggleFilterPanel() {
    filterCollapsed = !filterCollapsed;
    if (filterCollapsed) {
      filterSections.classList.add('collapsed');
      clearFiltersBtn.classList.remove('visible'); // 隱藏清除按鈕
    } else {
      filterSections.classList.remove('collapsed');
      clearFiltersBtn.classList.add('visible'); // 顯示清除按鈕
    }
  }

  // 點擊標題收合/展開
  filterHeader.addEventListener('click', function(e) {
    // 如果點擊的是清除篩選按鈕，不觸發收合
    if (e.target.closest('#clearFilters')) return;
    toggleFilterPanel();
  });

  // 清除所有篩選條件
  clearFiltersBtn.addEventListener('click', function(e) {
    e.stopPropagation(); // 防止觸發 header 的點擊事件
    // 取消所有勾選
    filterCourseTypes.forEach(cb => cb.checked = false);
    filterCredits.forEach(cb => cb.checked = false);
    filterCollege.value = '';
    filterDepartment.value = '';
    filterWeekdays.forEach(cb => cb.checked = false);
    filterPeriods.forEach(cb => cb.checked = false);

    addLog('info', '清除所有篩選條件');

    // 不重新執行搜尋，只清除篩選條件
  });

  // 停止 AI 搜尋按鈕事件
  if (stopSearchBtn) {
    stopSearchBtn.addEventListener('click', function() {
      if (aiSearchCancelled) {
        // 已經設置中斷，再次點擊則取消中斷（反悔）
        aiSearchCancelled = false;
        cancelWarning.style.display = 'none';
        stopSearchBtn.classList.remove('cancelling');
        stopSearchBtn.title = '停止搜尋';
        stopSearchBtn.textContent = '⏹';
        addLog('info', '用戶取消了中斷請求，繼續搜尋');
        console.log('↩️ 用戶取消中斷，繼續搜尋');
      } else {
        // 第一次點擊，設置中斷標誌並顯示警告
        aiSearchCancelled = true;
        cancelWarning.style.display = 'flex';
        stopSearchBtn.classList.add('cancelling');
        stopSearchBtn.title = '取消中斷';
        stopSearchBtn.textContent = '↩';
        addLog('warn', '用戶請求中斷搜尋（將於此步驟完成後終止）');
        console.log('⏹️ 用戶請求中斷搜尋，將於當前步驟完成後終止');
      }
    });
  }

  // 當任何篩選條件改變時，重新執行搜尋
  filterCourseTypes.forEach(cb => cb.addEventListener('change', performSearch));
  filterCredits.forEach(cb => cb.addEventListener('change', performSearch));
  filterCollege.addEventListener('change', function() {
    // 當學院改變時，更新系所選項
    updateDepartmentOptions();
    performSearch();
  });
  filterDepartment.addEventListener('change', performSearch);
  filterWeekdays.forEach(cb => cb.addEventListener('change', performSearch));
  filterPeriods.forEach(cb => cb.addEventListener('change', performSearch));

  // 在頁面載入時初始化篩選器選項
  function initializeFiltersOnLoad() {
    chrome.storage.local.get(['courseData'], function(result) {
      if (result.courseData && result.courseData.length > 0) {
        initializeFilters(result.courseData);
      }
    });
  }

  // 初始化篩選器選項
  function initializeFilters(courseData) {
    // 收集所有學院和系所
    const colleges = new Set();
    const departments = new Set();

    courseData.forEach((course) => {
      // 檢查 paths 是否存在且為陣列
      if (!course.paths || !Array.isArray(course.paths)) {
        return; // 跳過這個課程
      }

      course.paths.forEach(pathObj => {
        if (!pathObj || typeof pathObj !== 'object') return; // 檢查 pathObj 是否為物件

        // 提取學院
        const college = pathObj.college;
        if (college && college !== '不分院系' && college !== '校級') {
          colleges.add(college);
        }

        // 提取系所
        const dept = pathObj.department;
        if (dept) {
          departments.add(dept);
        }
      });
    });

    // 填充學院下拉選單
    const sortedColleges = Array.from(colleges).sort();

    filterCollege.innerHTML = '<option value="">全部學院</option>';
    sortedColleges.forEach(college => {
      const option = document.createElement('option');
      option.value = college;
      option.textContent = college;
      filterCollege.appendChild(option);
    });

    // 儲存所有系所供後續使用
    allDepartments = Array.from(departments).sort();

    updateDepartmentOptions();
  }

  // 更新系所下拉選單（根據選擇的學院）
  function updateDepartmentOptions() {
    const selectedCollege = filterCollege.value;

    filterDepartment.innerHTML = '<option value="">全部系所</option>';

    if (!selectedCollege) {
      // 如果沒有選擇學院，顯示所有系所

      if (allDepartments) {
        allDepartments.forEach(dept => {
          const option = document.createElement('option');
          option.value = dept;
          option.textContent = dept;
          filterDepartment.appendChild(option);
        });
      }
      return;
    }

    // 從當前課程資料中取得屬於選定學院的系所
    chrome.storage.local.get(['courseData'], function(result) {
      if (!result.courseData) return;

      const depts = new Set();
      result.courseData.forEach(course => {
        // 檢查 paths 是否存在且為陣列
        if (!course.paths || !Array.isArray(course.paths)) {
          return;
        }

        course.paths.forEach(pathObj => {
          if (!pathObj || typeof pathObj !== 'object') return;

          // 直接存取物件屬性
          if (pathObj.college === selectedCollege) {
            const dept = pathObj.department;
            if (dept) {
              depts.add(dept);
            }
          }
        });
      });

      Array.from(depts).sort().forEach(dept => {
        const option = document.createElement('option');
        option.value = dept;
        option.textContent = dept;
        filterDepartment.appendChild(option);
      });
    });
  }

  // 應用篩選條件
  function applyFilters(courses) {
    return courses.filter(course => {
      // 課程類型篩選（必修、選修、通識、核心、體育、外語、服務學習）
      const selectedCourseTypes = Array.from(filterCourseTypes)
        .filter(cb => cb.checked)
        .map(cb => cb.value);

      if (selectedCourseTypes.length > 0) {
        const cos_type = course.cos_type || '';
        const cos_name = course.name || '';
        let matchesAnyType = false;

        for (const type of selectedCourseTypes) {
          if (type === 'required') {
            // 必修：檢查 cos_type 和 paths
            let isRequired = cos_type.includes('必');
            if (!isRequired && course.paths && Array.isArray(course.paths)) {
              for (const path of course.paths) {
                const typeOrCategory = (path.type || '') + ' ' + (path.category || '');
                if (typeOrCategory.includes('必修') || typeOrCategory.includes('必')) {
                  isRequired = true;
                  break;
                }
              }
            }
            if (isRequired) matchesAnyType = true;
          } else if (type === 'elective') {
            // 選修：檢查 cos_type 和 paths
            let isElective = cos_type.includes('選');
            if (!isElective && course.paths && Array.isArray(course.paths)) {
              for (const path of course.paths) {
                const typeOrCategory = (path.type || '') + ' ' + (path.category || '');
                if (typeOrCategory.includes('選修') || typeOrCategory.includes('選')) {
                  isElective = true;
                  break;
                }
              }
            }
            if (isElective) matchesAnyType = true;
          } else if (type === 'general') {
            // 通識：檢查 cos_type 或 paths 中是否包含「通識」
            let isGeneral = cos_type.includes('通識') || cos_name.includes('通識');
            if (!isGeneral && course.paths && Array.isArray(course.paths)) {
              for (const path of course.paths) {
                const pathStr = [path.type, path.category, path.college, path.department].filter(x => x).join(' ');
                if (pathStr.includes('通識')) {
                  isGeneral = true;
                  break;
                }
              }
            }
            if (isGeneral) matchesAnyType = true;
          } else if (type === 'core') {
            // 核心：檢查 cos_type 或 paths 中是否包含「核心」
            let isCore = cos_type.includes('核心');
            if (!isCore && course.paths && Array.isArray(course.paths)) {
              for (const path of course.paths) {
                const pathStr = [path.type, path.category].filter(x => x).join(' ');
                if (pathStr.includes('核心')) {
                  isCore = true;
                  break;
                }
              }
            }
            if (isCore) matchesAnyType = true;
          } else if (type === 'physical') {
            // 體育：檢查課程名稱或系所是否包含「體育」
            if (cos_name.includes('體育') || (course.dep_name && course.dep_name.includes('體育'))) {
              matchesAnyType = true;
            }
          } else if (type === 'language') {
            // 外語：檢查課程名稱或系所是否包含外語關鍵字，但排除程式相關課程
            const languageKeywords = ['英文', '外語', '英語', '日文', '法文', '德文', '西班牙文', '韓文', '外文'];
            const programKeywords = ['程式', 'C語言', 'Python', 'Java', 'JavaScript', '程式設計', '語言處理', '自然語言'];

            // 檢查是否包含外語關鍵字
            const hasLanguageKeyword = languageKeywords.some(kw =>
              cos_name.includes(kw) || (course.dep_name && course.dep_name.includes(kw))
            );

            // 檢查是否包含程式相關關鍵字（排除）
            const hasProgramKeyword = programKeywords.some(kw => cos_name.includes(kw));

            if (hasLanguageKeyword && !hasProgramKeyword) {
              matchesAnyType = true;
            }
          } else if (type === 'service') {
            // 服務學習：檢查課程名稱是否包含「服務」、「學習」
            if (cos_name.includes('服務學習') || cos_name.includes('服務')) {
              matchesAnyType = true;
            }
          } else if (type === 'military') {
            // 軍訓：檢查課程名稱、系所或 cos_type 是否包含「軍訓」或「國防教育」
            if (cos_name.includes('軍訓') || cos_name.includes('國防教育') ||
                (course.cos_type && course.cos_type.includes('軍訓')) ||
                (course.dep_name && (course.dep_name.includes('軍訓') || course.dep_name.includes('軍訓暨護理')))) {
              matchesAnyType = true;
            }
          }
        }

        if (!matchesAnyType) return false;
      }

      // 學分數篩選
      const selectedCredits = Array.from(filterCredits)
        .filter(cb => cb.checked)
        .map(cb => cb.value);
      if (selectedCredits.length > 0) {
        const credits = parseFloat(course.credits) || 0;
        const match = selectedCredits.some(val => {
          if (val === '5+') return credits >= 5;
          return credits === parseFloat(val);
        });
        if (!match) return false;
      }

      // 學院篩選
      const selectedCollege = filterCollege.value;
      if (selectedCollege) {
        if (!course.paths || !Array.isArray(course.paths)) {
          return false;
        }
        const matchCollege = course.paths.some(pathObj =>
          pathObj && pathObj.college === selectedCollege
        );
        if (!matchCollege) return false;
      }

      // 系所篩選
      const selectedDept = filterDepartment.value;
      if (selectedDept) {
        if (!course.paths || !Array.isArray(course.paths)) {
          return false;
        }
        const matchDept = course.paths.some(pathObj =>
          pathObj && pathObj.department === selectedDept
        );
        if (!matchDept) return false;
      }

      // 星期篩選
      const selectedWeekdays = Array.from(filterWeekdays)
        .filter(cb => cb.checked)
        .map(cb => cb.value);
      if (selectedWeekdays.length > 0) {
        const timeCode = course.time || ''; // 使用 time 欄位，例如 M56
        const matchWeekday = selectedWeekdays.some(day =>
          timeCode.includes(day)
        );
        if (!matchWeekday) return false;
      }

      // 節次篩選
      const selectedPeriods = Array.from(filterPeriods)
        .filter(cb => cb.checked)
        .map(cb => cb.value);
      if (selectedPeriods.length > 0) {
        const timeCode = course.time || ''; // 使用 time 欄位，例如 M56, T12, Rabc
        const matchPeriod = selectedPeriods.some(period => {
          // period 可能是 "1234" (上午), "n" (中午), "56789" (下午), "abc" (晚上)
          if (period === '1234') {
            // 上午：檢查是否包含 1, 2, 3, 4 任一節次
            return /[1234]/.test(timeCode);
          } else if (period === 'n') {
            // 中午：檢查是否包含 n 節次
            return timeCode.includes('n');
          } else if (period === '56789') {
            // 下午：檢查是否包含 5, 6, 7, 8, 9 任一節次
            return /[56789]/.test(timeCode);
          } else if (period === 'abc') {
            // 晚上：檢查是否包含 a, b, c 任一節次
            return /[abc]/.test(timeCode);
          }
          return false;
        });
        if (!matchPeriod) return false;
      }

      return true;
    });
  }

  // 檢查是否有任何篩選條件被選擇
  function hasActiveFilters() {
    // 檢查課程類型（必修、選修、通識、核心、體育、外語、服務學習、軍訓）
    const hasCourseTypes = Array.from(filterCourseTypes).some(cb => cb.checked);
    if (hasCourseTypes) return true;

    // 檢查學分數
    const hasCredits = Array.from(filterCredits).some(cb => cb.checked);
    if (hasCredits) return true;

    // 檢查學院
    if (filterCollege.value) return true;

    // 檢查系所
    if (filterDepartment.value) return true;

    // 檢查星期
    const hasWeekdays = Array.from(filterWeekdays).some(cb => cb.checked);
    if (hasWeekdays) return true;

    // 檢查節次
    const hasPeriods = Array.from(filterPeriods).some(cb => cb.checked);
    if (hasPeriods) return true;

    return false;
  }

  // 執行搜尋
  function performSearch() {
    const query = searchInput.value.trim();

    // 如果沒有輸入也沒有篩選條件，提示使用者
    if (!query && !hasActiveFilters()) {
      resultsDiv.innerHTML = '<div class="placeholder">請輸入課程名稱或代碼，或使用進階篩選</div>';
      return;
    }

    addLog('info', `開始搜尋：${query || '(使用篩選器)'}`);

    // 立即顯示載入動畫
    loadingDiv.style.display = 'block';
    resultsDiv.innerHTML = '';

    // 從 Chrome Storage 讀取課程資料
    chrome.storage.local.get(['courseData'], function(result) {
      if (!result.courseData || result.courseData.length === 0) {
        loadingDiv.style.display = 'none';
        resultsDiv.innerHTML = `
          <div class="no-results">
            <p>尚未載入課程資料</p>
            <p style="margin-top: 8px; font-size: 12px;">
              請先訪問 <a href="https://timetable.nycu.edu.tw/" target="_blank">timetable.nycu.edu.tw</a>
            </p>
          </div>
        `;
        return;
      }

      // 使用 setTimeout 讓載入動畫有時間顯示
      // 對於大量資料，這樣可以確保 UI 不會凍結
      setTimeout(() => {
        let results;

        // 如果有輸入查詢，執行關鍵字搜尋
        if (query) {
          results = searchCourses(result.courseData, query);
        } else {
          // 如果沒有輸入但有篩選條件，返回所有課程
          results = result.courseData;
        }

        // 應用篩選條件
        results = applyFilters(results);

        currentResults = results; // 保存搜尋結果

        addLog('success', `搜尋完成：找到 ${results.length} 門課程`);

        // 隱藏載入動畫並顯示結果
        loadingDiv.style.display = 'none';
        displayResults(results);
      }, 50);
    });
  }

  // 檢查是否為簡稱：搜尋詞的每個字是否按順序出現在目標字串中
  function isAbbreviation(abbr, target) {
    let abbrIndex = 0;
    let targetIndex = 0;

    while (abbrIndex < abbr.length && targetIndex < target.length) {
      if (abbr[abbrIndex] === target[targetIndex]) {
        abbrIndex++;
      }
      targetIndex++;
    }

    return abbrIndex === abbr.length;
  }

  // 星期代碼對照表
  const dayCodeMap = {
    'M': '一',
    'T': '二',
    'W': '三',
    'R': '四',
    'F': '五',
    'S': '六',
    'U': '日'
  };

  // 判斷關鍵字是否為時間相關
  function isTimeKeyword(keyword) {
    const timeKeywords = ['週一', '週二', '週三', '週四', '週五', '週六', '週日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日'];
    // 檢查是否為星期代碼（M, T, W, R, F, S, U）
    if (keyword.length === 1 && dayCodeMap[keyword.toUpperCase()]) {
      return true;
    }
    // 檢查是否包含星期代碼（如 M3, T56）
    if (keyword.length >= 2 && dayCodeMap[keyword[0].toUpperCase()]) {
      return true;
    }
    return timeKeywords.includes(keyword);
  }

  // 將星期代碼轉換為搜尋字串
  function convertDayCode(keyword) {
    const upperKeyword = keyword.toUpperCase();
    // 如果是單個星期代碼（M, T, W, R, F, S, U）
    if (keyword.length === 1 && dayCodeMap[upperKeyword]) {
      return '週' + dayCodeMap[upperKeyword];
    }
    // 如果是星期代碼+時間代碼（如 M3, T56, Mabc）
    if (keyword.length >= 2 && dayCodeMap[upperKeyword[0]]) {
      const day = dayCodeMap[upperKeyword[0]];
      const timeCode = upperKeyword.substring(1);
      // 返回陣列，包含多種可能的匹配模式
      const patterns = [
        `週${day} ${timeCode}`,  // 週一 56
        `週${day}${timeCode}`,   // 週一56 (無空格)
      ];

      if (timeCode.length > 1) {
        // 如果時間代碼有多個字元，也嘗試分開匹配
        patterns.push(`週${day} ${timeCode.split('').join(',')}`); // 週一 5,6
        patterns.push(`週${day}${timeCode.split('').join(',')}`);  // 週一5,6
        // 也加入個別時間的匹配
        timeCode.split('').forEach(t => {
          patterns.push(`週${day} ${t}`); // 週一 5 或 週一 6
          patterns.push(`週${day}${t}`);  // 週一5 或 週一6
        });
      }
      return patterns;
    }
    return [keyword];
  }

  // 搜尋課程函數
  // 計算課程的相關度分數（分數越高越相關）
  function calculateRelevanceScore(course, keywords) {
    const courseName = course.name.toLowerCase();
    const courseCode = course.code.toLowerCase();
    const teacher = course.teacher ? course.teacher.toLowerCase() : '';
    const time = course.time ? course.time.toLowerCase() : '';
    const room = course.room ? course.room.toLowerCase() : '';

    // 獲取課程搜尋關鍵字（如果已經查看過詳細資訊並提取過關鍵字）
    const courseDetailsKey = getCourseDetailsKey(course);
    const courseDetails = courseDetailsCache[courseDetailsKey];
    const outline = courseDetails && courseDetails.searchKeywords ? courseDetails.searchKeywords.toLowerCase() : '';

    // 對每個字段記錄最高匹配分數（避免重複計分）
    let nameMaxScore = 0;
    let codeMaxScore = 0;
    let teacherMaxScore = 0;
    let timeMaxScore = 0;
    let roomMaxScore = 0;
    let pathMaxScore = 0;
    let outlineMaxScore = 0;

    // 記錄哪些字段有匹配
    let matchedFields = new Set();

    keywords.forEach(keyword => {
      // 課程名稱匹配（權重最高）
      if (courseName === keyword) {
        nameMaxScore = Math.max(nameMaxScore, 100); // 完全匹配
        matchedFields.add('name');
      } else if (courseName.startsWith(keyword)) {
        nameMaxScore = Math.max(nameMaxScore, 80); // 開頭匹配
        matchedFields.add('name');
      } else if (courseName.includes(keyword)) {
        nameMaxScore = Math.max(nameMaxScore, 50); // 包含匹配
        matchedFields.add('name');
      } else if (isAbbreviation(keyword, courseName)) {
        nameMaxScore = Math.max(nameMaxScore, 40); // 簡稱匹配
        matchedFields.add('name');
      }

      // 課程代碼匹配（權重很高）
      if (courseCode === keyword) {
        codeMaxScore = Math.max(codeMaxScore, 100); // 完全匹配
        matchedFields.add('code');
      } else if (courseCode.includes(keyword)) {
        codeMaxScore = Math.max(codeMaxScore, 60); // 部分匹配
        matchedFields.add('code');
      }

      // 教師名稱匹配（權重高）
      if (teacher) {
        if (teacher === keyword) {
          teacherMaxScore = Math.max(teacherMaxScore, 70); // 完全匹配
          matchedFields.add('teacher');
        } else if (teacher.startsWith(keyword)) {
          // 姓氏匹配（例如「王」匹配「王禹超」）
          teacherMaxScore = Math.max(teacherMaxScore, 65); // 開頭匹配
          matchedFields.add('teacher');
        } else if (keyword.endsWith('老師') && teacher.startsWith(keyword.slice(0, -2))) {
          // 「王老師」匹配「王禹超」
          teacherMaxScore = Math.max(teacherMaxScore, 65);
          matchedFields.add('teacher');
        } else if (teacher.includes(keyword)) {
          teacherMaxScore = Math.max(teacherMaxScore, 50); // 部分匹配
          matchedFields.add('teacher');
        }
      }

      // 時間匹配（權重中等）
      if (isTimeKeyword(keyword)) {
        const converted = convertDayCode(keyword);
        const patterns = Array.isArray(converted) ? converted : [converted];
        const timeUpper = time.toUpperCase();
        const keywordUpper = keyword.toUpperCase();

        if (patterns.some(pattern => time.includes(pattern)) || timeUpper.includes(keywordUpper)) {
          timeMaxScore = Math.max(timeMaxScore, 30);
          matchedFields.add('time');
        }
      } else if (time.includes(keyword)) {
        timeMaxScore = Math.max(timeMaxScore, 25);
        matchedFields.add('time');
      }

      // 教室匹配（權重較低）
      if (room.includes(keyword)) {
        roomMaxScore = Math.max(roomMaxScore, 20);
        matchedFields.add('room');
      }

      // 路徑匹配（學院、系所等，權重中等）
      if (course.paths && Array.isArray(course.paths)) {
        let currentPathScore = 0;
        course.paths.forEach(path => {
          const type = path.type ? path.type.toLowerCase() : '';
          const category = path.category ? path.category.toLowerCase() : '';
          const college = path.college ? path.college.toLowerCase() : '';
          const department = path.department ? path.department.toLowerCase() : '';

          // 系所完全匹配
          if (department === keyword || college === keyword) {
            currentPathScore = Math.max(currentPathScore, 45);
          }
          // 系所包含或簡稱匹配
          else if (department.includes(keyword) || isAbbreviation(keyword, department) ||
                   college.includes(keyword) || isAbbreviation(keyword, college)) {
            currentPathScore = Math.max(currentPathScore, 30);
          }
          // 類型、類別匹配
          else if (type.includes(keyword) || isAbbreviation(keyword, type) ||
                   category.includes(keyword) || isAbbreviation(keyword, category)) {
            currentPathScore = Math.max(currentPathScore, 20);
          }
        });

        if (currentPathScore > 0) {
          pathMaxScore = Math.max(pathMaxScore, currentPathScore);
          matchedFields.add('path');
        }
      }

      // 課程概述匹配（權重中等，適用於已查看過詳細資訊的課程）
      if (outline && outline !== '未提供') {
        if (outline.includes(keyword)) {
          outlineMaxScore = Math.max(outlineMaxScore, 35); // 概述包含關鍵字
          matchedFields.add('outline');
        }
      }
    });

    // 計算總分（每個字段只計算最高分）
    let score = nameMaxScore + codeMaxScore + teacherMaxScore + timeMaxScore + roomMaxScore + pathMaxScore + outlineMaxScore;

    // 匹配的字段數量（不是關鍵字數量）
    const matchedFieldsCount = matchedFields.size;

    // 額外加分：匹配多個不同字段
    if (matchedFieldsCount > 1) {
      score += matchedFieldsCount * 20; // 每個額外字段 +20
    }

    // 如果同時匹配課程名稱和教師（最理想的情況）
    if (matchedFields.has('name') && matchedFields.has('teacher')) {
      score += 50; // 額外獎勵
    }

    return { score, matchedKeywords: matchedFieldsCount };
  }

  // 智能分詞函數
  function smartTokenize(query) {
    query = query.toLowerCase();
    let keywords = [];

    // 先按空格和常見連接詞（的、和、或、與）分割
    let parts = query.split(/[\s的和或與]+/).filter(k => k.length > 0);

    // 對每個部分進行進一步分析和分割
    parts.forEach(part => {
      // 嘗試提取時間相關詞（星期X、週X、早上、下午、晚上）
      const timePattern = /(星期[一二三四五六日]|週[一二三四五六日]|禮拜[一二三四五六日]|早上|下午|晚上)/g;
      const timeMatches = part.match(timePattern);
      if (timeMatches) {
        timeMatches.forEach(t => keywords.push(t));
        // 移除時間詞後的剩餘部分
        let remaining = part.replace(timePattern, '');
        if (remaining.length > 0) {
          // 遞迴處理剩餘部分
          parts.push(remaining);
        }
        return;
      }

      // 如果部分很長（超過4個字），可能需要進一步分割
      if (part.length > 4) {
        // 嘗試識別「XX老師XX」這種格式（如「王老師微積分」）
        const teacherMatch = part.match(/^(.{1,3})老師(.+)$/);
        if (teacherMatch) {
          const teacherName = teacherMatch[1]; // 教師姓名
          const rest = teacherMatch[2]; // 剩餘部分
          keywords.push(teacherName); // 加入教師姓名
          if (teacherName.length === 1) {
            keywords.push(teacherName + '老師'); // 如果是單字，也加入「王老師」
          }
          keywords.push(rest); // 加入剩餘部分（如「微積分」）
          return; // 處理完畢，跳過後續
        }

        // 嘗試識別「XX系XX」這種格式（如「資工系演算法」）
        const deptMatch = part.match(/^(.{2,4})系(.+)$/);
        if (deptMatch) {
          const dept = deptMatch[1]; // 系所
          const rest = deptMatch[2]; // 剩餘部分
          keywords.push(dept + '系'); // 加入完整系名
          keywords.push(dept); // 加入簡稱
          keywords.push(rest); // 加入剩餘部分
          return;
        }

        // 嘗試識別「XX學院XX」這種格式
        const collegeMatch = part.match(/^(.{2,4})學院(.+)$/);
        if (collegeMatch) {
          const college = collegeMatch[1]; // 學院
          const rest = collegeMatch[2]; // 剩餘部分
          keywords.push(college + '學院'); // 加入完整學院名
          keywords.push(college); // 加入簡稱
          keywords.push(rest); // 加入剩餘部分
          return;
        }
      }

      // 處理「XX老師」格式（已分割好的）
      if (part.endsWith('老師') && part.length > 2) {
        const teacherName = part.slice(0, -2); // 移除「老師」
        keywords.push(teacherName); // 加入教師姓名
        // 如果是單字（姓氏），也加入完整的「XX老師」用於匹配
        if (teacherName.length === 1) {
          keywords.push(part); // 保留「王老師」
        }
      }
      // 處理「XX系」格式（已分割好的）
      else if (part.endsWith('系') && part.length > 1) {
        keywords.push(part); // 保留完整「資工系」
        keywords.push(part.slice(0, -1)); // 也加入「資工」
      }
      // 處理「XX課」格式（如「資工課」）
      else if (part.endsWith('課') && part.length > 1) {
        const deptOrSubject = part.slice(0, -1); // 移除「課」
        keywords.push(deptOrSubject); // 加入「資工」
        // 如果看起來像系所簡稱（2-4字），也加入系名
        if (deptOrSubject.length >= 2 && deptOrSubject.length <= 4) {
          keywords.push(deptOrSubject + '系'); // 加入「資工系」
        }
      }
      // 處理「XX學院」格式（已分割好的）
      else if (part.includes('學院') && part.length > 2) {
        keywords.push(part); // 保留完整「電機學院」
        keywords.push(part.replace('學院', '')); // 也加入「電機」
      }
      // 過濾掉單字的「課」字
      else if (part !== '課') {
        keywords.push(part);
      }
    });

    // 去重並過濾空字串
    return [...new Set(keywords)].filter(k => k.length > 0);
  }

  function searchCourses(courses, query) {
    // 使用智能分詞
    const keywords = smartTokenize(query);

    if (keywords.length === 0) {
      return [];
    }

    // 計算每個課程的相關度分數
    const coursesWithScores = courses.map(course => {
      const { score, matchedKeywords } = calculateRelevanceScore(course, keywords);
      return { course, score, matchedKeywords };
    });

    // 只保留至少匹配一個關鍵字的課程
    const matchedCourses = coursesWithScores.filter(item => item.matchedKeywords > 0);

    // 按相關度分數排序（分數高的在前）
    matchedCourses.sort((a, b) => {
      // 先按分數排序
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      // 分數相同時，按匹配關鍵字數量排序
      if (b.matchedKeywords !== a.matchedKeywords) {
        return b.matchedKeywords - a.matchedKeywords;
      }
      // 都相同時，按課程代碼排序
      return a.course.code.localeCompare(b.course.code);
    });

    // 返回排序後的課程列表
    return matchedCourses.map(item => item.course);
  }

  // 顯示搜尋結果（支援分批載入以提升效能）
  const RESULTS_PER_PAGE = 100; // 每次顯示的課程數量
  let currentDisplayCount = RESULTS_PER_PAGE; // 目前顯示的數量

  async function displayResults(results, searchTime = null, scoreMap = null, showAll = false) {
    if (results.length === 0) {
      let noResultsHtml = '<div class="no-results">找不到符合的課程';
      // 如果有篩選器被激活，提示用戶
      if (hasActiveFilters()) {
        noResultsHtml += '<br><span style="font-size: 13px; color: #FF9800;">💡 提示：您已啟用篩選器，可能已過濾掉搜尋結果<br>請嘗試清除篩選條件</span>';
      }
      noResultsHtml += '</div>';
      resultsDiv.innerHTML = noResultsHtml;
      return;
    }

    // 重置顯示數量（除非指定顯示全部）
    if (!showAll) {
      currentDisplayCount = RESULTS_PER_PAGE;
    }

    // 決定要顯示的課程數量
    const displayCount = showAll ? results.length : Math.min(currentDisplayCount, results.length);
    const hasMore = results.length > displayCount;

    // 建立結果標題（顯示結果數量和搜尋時間）
    let headerHtml = '<div class="search-results-header">';
    headerHtml += `<span class="results-count">找到 ${results.length} 門課程${hasMore ? `（顯示前 ${displayCount} 門）` : ''}</span>`;
    if (searchTime !== null && searchTime > 0) {
      headerHtml += `<span class="search-time">⏱️ ${searchTime} 秒</span>`;
    }
    headerHtml += '</div>';

    // 只渲染要顯示的課程
    const coursesToDisplay = results.slice(0, displayCount);

    const html = coursesToDisplay.map((course, index) => {
      // 獲取分數（精準模式）
      const courseId = course.cos_id || course.code;
      const scoreData = scoreMap && scoreMap.has(courseId) ? scoreMap.get(courseId) : null;
      const score = scoreData ? scoreData.total : null;

      // 根據分數決定匹配度等級和顏色
      let scoreLabel = '';
      let scoreBadgeStyle = '';
      if (score !== null) {
        if (score >= 95) {
          scoreLabel = '完美匹配';
          scoreBadgeStyle = 'background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);';
        } else if (score >= 90) {
          scoreLabel = '高度相關';
          scoreBadgeStyle = 'background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);';
        } else if (score >= 80) {
          scoreLabel = '相關';
          scoreBadgeStyle = 'background: linear-gradient(135deg, #2196F3 0%, #1976D2 100%);';
        } else if (score >= 70) {
          scoreLabel = '部分相關';
          scoreBadgeStyle = 'background: linear-gradient(135deg, #FF9800 0%, #F57C00 100%);';
        } else {
          scoreLabel = '勉強相關';
          scoreBadgeStyle = 'background: linear-gradient(135deg, #9E9E9E 0%, #757575 100%);';
        }
      }
      // 建立所有路徑的 HTML（收合在按鈕中）
      let pathsHtml = '';
      if (course.paths && Array.isArray(course.paths) && course.paths.length > 0) {
        pathsHtml = course.paths.map((path, index) => {
          const pathParts = [];
          if (path.type) pathParts.push(path.type);
          if (path.category) pathParts.push(path.category);
          if (path.college) pathParts.push(path.college);
          if (path.department) pathParts.push(path.department);
          pathParts.push('全部'); // 年級：全部

          // 如果有多個路徑，加上編號
          const prefix = course.paths.length > 1 ? `${index + 1}. ` : '📍 ';
          return `<div class="course-path">${prefix}${pathParts.join(' / ')}</div>`;
        }).join('');
      }

      // 檢查是否已加入書籤
      const courseKey = getCourseKey(course);
      const isBookmarked = bookmarks[courseKey] !== undefined;
      const bookmarkIcon = isBookmarked ? '⭐' : '☆';
      const bookmarkClass = isBookmarked ? 'bookmarked' : '';

      // 檢查是否已加入課表
      const isInTimetable = timetable[courseKey] !== undefined;

      return `
        <div class="course-item" data-course-index="${index}">
          <div class="course-header">
            <div class="course-header-left">
              ${score !== null ? `<div style="height: 36px; padding: 0 10px; margin-right: 16px; margin-bottom: 8px; ${scoreBadgeStyle} color: white; border-radius: 12px; font-size: 10px; display: flex; align-items: center; gap: 6px; white-space: nowrap;">
                <span style="font-weight: bold; font-size: 10px;">${scoreLabel}</span>
                <span style="font-weight: bold; font-size: 11px;">🎯${score}/100</span>
                <div style="opacity: 0.85; font-size: 9px; display: flex; flex-direction: column; line-height: 1.3;">
                  <div style="display: flex; gap: 6px;">
                    <span style="width: 30px; text-align: center;">內容</span>
                    <span style="width: 30px; text-align: center;">時間</span>
                    <span style="width: 30px; text-align: center;">地點</span>
                    <span style="width: 30px; text-align: center;">路徑</span>
                    <span style="width: 30px; text-align: center;">匹配</span>
                  </div>
                  <div style="display: flex; gap: 6px;">
                    <span style="width: 30px; text-align: center;">${scoreData.content}/25</span>
                    <span style="width: 30px; text-align: center;">${scoreData.time}/25</span>
                    <span style="width: 30px; text-align: center;">${scoreData.location}/15</span>
                    <span style="width: 30px; text-align: center;">${scoreData.path}/15</span>
                    <span style="width: 30px; text-align: center;">${scoreData.recommend}/20</span>
                  </div>
                </div>
              </div>` : ''}
              <div class="course-code">${escapeHtml(course.code)}</div>
              <div class="course-name">${escapeHtml(course.name)}</div>
            </div>
            <div class="course-actions">
              <button class="add-to-timetable-btn ${isInTimetable ? 'in-timetable' : ''}" data-course-index="${index}" title="${isInTimetable ? '從課表移除' : '加入課表'}">
                ${isInTimetable ? '-' : '+'}
              </button>
              <button class="bookmark-btn ${bookmarkClass}" data-course-index="${index}" title="${isBookmarked ? '移除書籤' : '加入書籤'}">
                ${bookmarkIcon}
              </button>
            </div>
          </div>

          ${course.teacher ? `<div class="course-info">👨‍🏫 ${escapeHtml(course.teacher)}</div>` : ''}
          ${course.time ? `<div class="course-info">🕐 ${escapeHtml(course.time)}</div>` : ''}
          ${course.room ? `<div class="course-info">📍 ${escapeHtml(course.room)}</div>` : ''}
          ${course.credits ? `<div class="course-info">📚 ${escapeHtml(course.credits)} 學分</div>` : ''}

          <div class="course-action-buttons">
            <button class="view-detail-btn" data-course-index="${index}">
              📋 查看完整資訊
            </button>
            <button class="view-rating-btn" data-course-index="${index}" title="在 OPT 歐趴糖查看課程評價">
              📊 查看歐趴糖評價(需登入)
            </button>
          </div>
        </div>
      `;
    }).join('');

    // 加入「顯示更多」按鈕（如果有更多結果）
    let loadMoreHtml = '';
    if (hasMore) {
      const remaining = results.length - displayCount;
      loadMoreHtml = `
        <div class="load-more-container" style="text-align: center; padding: 16px;">
          <button id="loadMoreBtn" class="load-more-btn" style="
            padding: 12px 24px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
            transition: all 0.3s;
          ">
            顯示更多課程（還有 ${remaining} 門）
          </button>
        </div>
      `;
    }

    resultsDiv.innerHTML = headerHtml + html + loadMoreHtml;

    // 為「顯示更多」按鈕添加點擊事件
    const loadMoreBtn = resultsDiv.querySelector('#loadMoreBtn');
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', function() {
        currentDisplayCount += RESULTS_PER_PAGE;
        displayResults(results, searchTime, scoreMap, true);
      });
    }

    // 為「加入課表」按鈕添加點擊事件
    const addToTimetableBtns = resultsDiv.querySelectorAll('.add-to-timetable-btn');
    addToTimetableBtns.forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        const courseIndex = parseInt(this.dataset.courseIndex);
        const course = results[courseIndex];
        const courseKey = getCourseKey(course);

        if (timetable[courseKey]) {
          // 課程已在課表中，執行移除
          if (confirm(`確定要從課表移除「${course.name}」嗎？`)) {
            removeFromTimetable(course);
            displayResults(results);
          }
        } else {
          // 課程不在課表中，執行加入
          if (addToTimetable(course)) {
            displayResults(results);
          }
        }
      });
    });

    // 為「查看完整資訊」按鈕添加點擊事件
    const viewDetailBtns = resultsDiv.querySelectorAll('.view-detail-btn');
    viewDetailBtns.forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        const courseIndex = parseInt(this.dataset.courseIndex);
        const course = results[courseIndex];
        showDetailView(course);
      });
    });

    // 為每個書籤按鈕添加點擊事件
    const bookmarkBtns = resultsDiv.querySelectorAll('.bookmark-btn');
    bookmarkBtns.forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        const courseIndex = parseInt(this.dataset.courseIndex);
        const course = results[courseIndex];
        toggleBookmark(course);
        displayResults(results);
      });
    });

    // 為「查看評價」按鈕添加點擊事件
    const viewRatingBtns = resultsDiv.querySelectorAll('.view-rating-btn');
    viewRatingBtns.forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        const courseIndex = parseInt(this.dataset.courseIndex);
        const course = results[courseIndex];
        openOPTRating(course);
      });
    });

    // 自動為搜尋結果提取關鍵字（背景執行，不阻塞UI）
    if (aiEnabled && results.length > 0) {
      setTimeout(() => {
        autoExtractKeywordsForResults(results);
      }, 100); // 延遲100ms，確保UI先渲染完成
    }
  }

  // 開啟課程綱要頁面
  function openCourseOutline(course) {
    if (!course.cos_id || !course.acy || !course.sem) {
      alert('無法開啟課程綱要：缺少必要資訊');
      return;
    }

    // 構建課程綱要 URL
    // 格式：https://timetable.nycu.edu.tw/?r=main/crsoutline&Acy=114&Sem=2&CrsNo=112500&lang=zh-tw
    const outlineUrl = `https://timetable.nycu.edu.tw/?r=main/crsoutline&Acy=${course.acy}&Sem=${course.sem}&CrsNo=${course.cos_id}&lang=zh-tw`;

    // 在新分頁開啟
    chrome.tabs.create({ url: outlineUrl });
  }

  // 開啟 OPT 歐趴糖課程評價頁面
  function openOPTRating(course) {
    // 構建搜尋關鍵字（用空格連接）
    const keywords = [];
    keywords.push('交大'); // 學校簡稱

    if (course.name) {
      keywords.push(course.name);
    }

    if (course.teacher) {
      keywords.push(course.teacher);
    }

    const keyword = keywords.join(' ');

    // 構建 OPT 搜尋 JSON 對象
    const searchObj = {
      keyword: keyword,
      type: 0,
      order: "-modify_time"
    };

    // 將 JSON 對象轉為字串，進行 URL 編碼，再進行 Base64 編碼
    const jsonStr = JSON.stringify(searchObj);
    const urlEncoded = encodeURIComponent(jsonStr);
    const base64Encoded = btoa(urlEncoded).replace(/=+$/, ''); // 移除結尾的 = padding

    // 構建完整的 OPT 搜尋 URL
    const optUrl = `https://www.1111opt.com.tw/search-result/${base64Encoded}`;

    // 在新分頁開啟
    chrome.tabs.create({ url: optUrl });
  }

  // 檢查是否為首次使用，顯示歡迎引導
  function checkFirstTimeUser() {
    chrome.storage.local.get(['hasSeenWelcome'], function(result) {
      if (!result.hasSeenWelcome) {
        showWelcomeGuide();
      }
    });
  }

  // 顯示歡迎引導彈窗
  function showWelcomeGuide() {
    const overlay = document.createElement('div');
    overlay.className = 'course-modal-overlay';
    overlay.style.zIndex = '10002';

    const modal = document.createElement('div');
    modal.className = 'course-modal welcome-modal';
    modal.style.maxWidth = '400px';

    modal.innerHTML = `
      <div class="course-modal-header" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
        <div class="course-modal-title">
          <div class="course-modal-name">👋 歡迎使用 NYCU 選課助手</div>
        </div>
      </div>
      <div class="course-modal-body" style="padding: 20px;">
        <div class="welcome-steps">
          <div class="welcome-step">
            <div class="step-number">1</div>
            <div class="step-content">
              <div class="step-title">載入課程資料</div>
              <div class="step-desc">首次使用請訪問 <a href="https://timetable.nycu.edu.tw/" target="_blank">timetable.nycu.edu.tw</a>，系統會自動載入課程資料（約需 5 分鐘）</div>
            </div>
          </div>
          <div class="welcome-step">
            <div class="step-number">2</div>
            <div class="step-content">
              <div class="step-title">搜尋課程</div>
              <div class="step-desc">輸入課程名稱、教師、時間等關鍵字進行搜尋，支援自然語言查詢</div>
            </div>
          </div>
          <div class="welcome-step">
            <div class="step-number">3</div>
            <div class="step-content">
              <div class="step-title">建立課表</div>
              <div class="step-desc">將喜歡的課程加入課表，系統會自動處理時間衝突</div>
            </div>
          </div>
          <div class="welcome-step">
            <div class="step-number">4</div>
            <div class="step-content">
              <div class="step-title">AI 智慧搜尋（選用）</div>
              <div class="step-desc">在「說明」頁面設定 AI，即可使用自然語言搜尋課程</div>
            </div>
          </div>
        </div>
        <button class="welcome-start-btn">開始使用</button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // 點擊開始按鈕
    modal.querySelector('.welcome-start-btn').addEventListener('click', function() {
      chrome.storage.local.set({ hasSeenWelcome: true });
      overlay.remove();
    });

    // 點擊背景關閉
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) {
        chrome.storage.local.set({ hasSeenWelcome: true });
        overlay.remove();
      }
    });
  }

  // 更新資料狀態顯示
  function updateDataStatus() {
    chrome.storage.local.get(['courseData', 'lastUpdate'], function(result) {
      if (!result || !result.courseData || !Array.isArray(result.courseData) || result.courseData.length === 0) {
        dataStatusDiv.innerHTML = '<span class="status-warning">⚠️ 尚未載入課程資料，請訪問 <a href="https://timetable.nycu.edu.tw/" target="_blank">timetable.nycu.edu.tw</a></span>';
        dataStatusDiv.style.display = 'block';
        return;
      }

      const now = Date.now();
      const lastUpdate = result.lastUpdate || 0;  // 提供預設值避免 NaN
      const dataAge = now - lastUpdate;
      const daysOld = Math.floor(dataAge / (24 * 60 * 60 * 1000));
      const hoursOld = Math.floor((dataAge % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      const remainingDays = 7 - daysOld;

      let statusText = '';
      let statusClass = '';

      if (dataAge > sevenDays) {
        // 資料過期
        statusText = `⚠️ 資料已過期 (${daysOld} 天前)，請訪問 <a href="https://timetable.nycu.edu.tw/" target="_blank">timetable.nycu.edu.tw</a> 更新`;
        statusClass = 'status-warning';
      } else if (daysOld === 0) {
        // 今天的資料
        if (hoursOld === 0) {
          statusText = `✓ ${result.courseData.length} 筆課程 (剛剛更新)`;
        } else {
          statusText = `✓ ${result.courseData.length} 筆課程 (${hoursOld} 小時前更新)`;
        }
        statusClass = 'status-fresh';
      } else {
        // 資料仍有效
        statusText = `✓ ${result.courseData.length} 筆課程 (${daysOld} 天前更新，${remainingDays} 天後自動更新)`;
        statusClass = 'status-valid';
      }

      dataStatusDiv.innerHTML = `<span class="${statusClass}">${statusText}</span>`;
      dataStatusDiv.style.display = 'block';

      // 🆕 主動提取關鍵字：當課程資料存在且 AI 已啟用時，自動開始提取
      if (result.courseData && result.courseData.length > 0 && aiEnabled) {
        // 延遲 1 秒後開始主動提取（讓 UI 先渲染完成）
        setTimeout(() => {
          console.log('🚀 主動開始提取課程關鍵字...');
          proactiveExtractKeywords(result.courseData);
        }, 1000);
      }
    });
  }

  // 更新關鍵字提取狀態顯示
  function updateKeywordExtractionStatus() {
    chrome.storage.local.get(['courseData', 'courseDetailsCache'], function(result) {
      if (!result.courseData || result.courseData.length === 0) {
        keywordStatusDiv.style.display = 'none';
        return;
      }

      const totalCourses = result.courseData.length;
      const cache = result.courseDetailsCache || {};

      // 計算已提取關鍵字的課程數量
      let extractedCount = 0;
      for (const course of result.courseData) {
        const courseDetailsKey = getCourseDetailsKey(course);
        const cached = cache[courseDetailsKey];
        if (cached && cached.searchKeywords) {
          extractedCount++;
        }
      }

      // 根據完成狀態顯示不同樣式
      let statusText, statusClass;
      if (extractedCount === totalCourses) {
        // 已完成 - 顯示綠色
        statusText = `✅ 已完成 ${totalCourses} 門課程的關鍵字提取`;
        statusClass = 'status-fresh';
      } else {
        // 進行中 - 顯示橘色
        statusText = `📊 已提取 ${extractedCount}/${totalCourses} 門課程的關鍵字`;
        statusClass = 'status-warning';
      }

      keywordStatusDiv.innerHTML = `<span class="${statusClass}">${statusText}</span>`;
      keywordStatusDiv.style.display = 'block';
    });
  }

  // ==================== 課程詳細資訊快取 ====================

  // 載入課程詳細資訊快取
  function loadCourseDetailsCache() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['courseDetailsCache', 'cacheLastUpdate', 'lastUpdate'], function(result) {
        const courseDataLastUpdate = result.lastUpdate || 0; // 課程資料的更新時間
        const cacheLastUpdate = result.cacheLastUpdate || 0; // 快取的更新時間

        // 🔧 檢查快取是否過期：如果課程資料比快取新，清除舊快取
        if (courseDataLastUpdate > cacheLastUpdate) {
          console.log('🗑️ 課程資料已更新，清除舊的關鍵字快取');
          console.log(`   課程資料時間：${new Date(courseDataLastUpdate).toLocaleString()}`);
          console.log(`   快取時間：${new Date(cacheLastUpdate).toLocaleString()}`);
          courseDetailsCache = {};
          // 保存空快取並更新快取時間戳
          chrome.storage.local.set({
            courseDetailsCache: {},
            cacheLastUpdate: courseDataLastUpdate
          });
        } else {
          // 快取仍然有效，載入
          courseDetailsCache = result.courseDetailsCache || {};
          console.log(`📦 載入關鍵字快取：${Object.keys(courseDetailsCache).length} 門課程`);
        }
        const needsCompact = Object.values(courseDetailsCache).some(details => details && details._partial !== true);
        if (needsCompact) {
          saveCourseDetailsCache();
        }
        resolve();
      });
    });
  }

  // 儲存課程詳細資訊快取
  function saveCourseDetailsCache() {
    // 同時保存快取和當前課程資料的時間戳
    chrome.storage.local.get(['lastUpdate'], function(result) {
      const minimalCache = {};
      for (const [key, details] of Object.entries(courseDetailsCache)) {
        if (!details) continue;
        minimalCache[key] = {
          searchKeywords: details.searchKeywords || '',
          必選修: details.必選修 || '',
          _partial: true
        };
      }

      chrome.storage.local.set({
        courseDetailsCache: minimalCache,
        cacheLastUpdate: result.lastUpdate || Date.now()
      }, () => {
        if (chrome.runtime.lastError) {
          console.warn('⚠️ 儲存課程快取失敗:', chrome.runtime.lastError.message);
        }
      });
    });
  }

  function isDetailsPartial(details) {
    return !details || details._partial === true;
  }

  // ==================== 書籤相關函數 ====================

  // 生成課程唯一鍵
  function getCourseKey(course) {
    return course.cos_id || course.code || `${course.name}_${course.teacher}`;
  }

  // 課程詳細資訊快取鍵（同課號不同老師需分開）
  function getCourseDetailsKey(course) {
    const normalize = (value) => String(value || '').trim().replace(/\s+/g, ' ');
    const parts = [];
    if (course) {
      if (course.acy) parts.push(`acy=${normalize(course.acy)}`);
      if (course.sem) parts.push(`sem=${normalize(course.sem)}`);
      if (course.cos_id) parts.push(`cos=${normalize(course.cos_id)}`);
      if (course.code) parts.push(`code=${normalize(course.code)}`);
      if (course.name) parts.push(`name=${normalize(course.name)}`);
      if (course.teacher) parts.push(`teacher=${normalize(course.teacher)}`);
      if (course.time) parts.push(`time=${normalize(course.time)}`);
    }
    if (parts.length === 0) {
      return 'unknown';
    }
    return parts.join('|');
  }

  function findLatestCourse(course, courseData) {
    if (!course || !Array.isArray(courseData)) return null;
    if (course.cos_id) {
      const matchById = courseData.find(c => c.cos_id === course.cos_id);
      if (matchById) return matchById;
    }
    const code = course.code;
    const name = course.name;
    if (!code || !name) return null;

    const normalize = (value) => String(value || '').trim().replace(/\s+/g, ' ');
    const teacher = normalize(course.teacher);
    const time = normalize(course.time);

    let match = courseData.find(c =>
      c.code === code && c.name === name &&
      normalize(c.teacher) === teacher && normalize(c.time) === time
    );
    if (match) return match;

    match = courseData.find(c =>
      c.code === code && c.name === name &&
      normalize(c.teacher) === teacher
    );
    if (match) return match;

    match = courseData.find(c =>
      c.code === code && c.name === name &&
      normalize(c.time) === time
    );
    if (match) return match;

    return courseData.find(c => c.code === code && c.name === name) || null;
  }

  // 截斷教師名單（超過2位顯示「等」）
  function truncateTeachers(teacherStr, maxCount = 2) {
    if (!teacherStr) return '';
    // 支援多種分隔符號：逗號、頓號、空格
    const teachers = teacherStr.split(/[,、\s]+/).filter(t => t.trim());
    if (teachers.length <= maxCount) {
      return teacherStr;
    }
    return teachers.slice(0, maxCount).join('、') + '等';
  }

  // 載入書籤資料
  function loadBookmarks() {
    chrome.storage.local.get(['bookmarkCategories', 'courseBookmarks', 'collapsedCategories'], function(result) {
      // 優先使用新格式
      if (result.bookmarkCategories) {
        bookmarkCategories = result.bookmarkCategories;
      } else if (result.courseBookmarks) {
        // 兼容舊格式：將舊書籤轉換到默認分類
        bookmarkCategories = {
          'default': {
            name: '我的書籤',
            icon: '⭐',
            courses: result.courseBookmarks
          }
        };
      }

      // 確保默認分類存在
      if (!bookmarkCategories['default']) {
        bookmarkCategories['default'] = {
          name: '我的書籤',
          icon: '⭐',
          courses: {}
        };
      }

      // 載入收合狀態
      if (result.collapsedCategories) {
        collapsedCategories = result.collapsedCategories;
      }

      // 建立快速查找索引
      rebuildBookmarksIndex();
      updateBookmarkCount();
    });
  }

  // 建立書籤快速查找索引
  function rebuildBookmarksIndex() {
    bookmarks = {};
    for (const categoryId in bookmarkCategories) {
      const category = bookmarkCategories[categoryId];
      for (const courseKey in category.courses) {
        bookmarks[courseKey] = categoryId;
      }
    }
  }

  // 儲存書籤資料
  function saveBookmarks() {
    chrome.storage.local.set({ bookmarkCategories: bookmarkCategories }, function() {
      rebuildBookmarksIndex();
      updateBookmarkCount();
    });
  }

  // 儲存收合狀態
  function saveCollapsedState() {
    chrome.storage.local.set({ collapsedCategories: collapsedCategories });
  }

  // 切換分類收合狀態
  function toggleCategoryCollapse(categoryId) {
    collapsedCategories[categoryId] = !collapsedCategories[categoryId];
    saveCollapsedState();
  }

  // 切換書籤狀態（加入默認分類或移除）
  function toggleBookmark(course, categoryId = 'default') {
    const courseKey = getCourseKey(course);

    if (bookmarks[courseKey]) {
      // 移除書籤
      const oldCategoryId = bookmarks[courseKey];
      if (bookmarkCategories[oldCategoryId]) {
        delete bookmarkCategories[oldCategoryId].courses[courseKey];
      }
      delete bookmarks[courseKey];
      addLog('info', `移除書籤：${course.name}`);
    } else {
      // 加入書籤到指定分類
      if (!bookmarkCategories[categoryId]) {
        categoryId = 'default';
      }
      bookmarkCategories[categoryId].courses[courseKey] = {
        ...course,
        bookmarkedAt: Date.now()
      };
      bookmarks[courseKey] = categoryId;
      addLog('success', `加入書籤：${course.name}`);
    }

    saveBookmarks();
  }

  // 將課程加入指定分類
  function addToBookmarkCategory(course, categoryId) {
    const courseKey = getCourseKey(course);

    // 如果已在其他分類，先移除
    if (bookmarks[courseKey]) {
      const oldCategoryId = bookmarks[courseKey];
      if (bookmarkCategories[oldCategoryId]) {
        delete bookmarkCategories[oldCategoryId].courses[courseKey];
      }
    }

    // 加入新分類
    if (!bookmarkCategories[categoryId]) {
      categoryId = 'default';
    }
    bookmarkCategories[categoryId].courses[courseKey] = {
      ...course,
      bookmarkedAt: Date.now()
    };
    bookmarks[courseKey] = categoryId;

    saveBookmarks();
    addLog('success', `加入「${bookmarkCategories[categoryId].name}」：${course.name}`);
  }

  // 創建新分類
  function createBookmarkCategory(name, icon = '📁') {
    const categoryId = 'cat_' + Date.now();
    bookmarkCategories[categoryId] = {
      name: name,
      icon: icon,
      courses: {}
    };
    saveBookmarks();
    return categoryId;
  }

  // 刪除分類（將課程移到默認分類）
  function deleteBookmarkCategory(categoryId) {
    if (categoryId === 'default') return; // 不能刪除默認分類

    const category = bookmarkCategories[categoryId];
    if (category) {
      // 將課程移到默認分類
      for (const courseKey in category.courses) {
        bookmarkCategories['default'].courses[courseKey] = category.courses[courseKey];
        bookmarks[courseKey] = 'default';
      }
      delete bookmarkCategories[categoryId];
      saveBookmarks();
    }
  }

  // 重命名分類
  function renameBookmarkCategory(categoryId, newName, newIcon) {
    if (bookmarkCategories[categoryId]) {
      bookmarkCategories[categoryId].name = newName;
      if (newIcon) bookmarkCategories[categoryId].icon = newIcon;
      saveBookmarks();
    }
  }

  // 更新書籤數量顯示
  function updateBookmarkCount() {
    let count = 0;
    for (const categoryId in bookmarkCategories) {
      count += Object.keys(bookmarkCategories[categoryId].courses).length;
    }
    bookmarkCount.textContent = count;

    // 如果有書籤，顯示清空按鈕
    if (count > 0) {
      clearAllBookmarks.style.display = 'inline-block';
    } else {
      clearAllBookmarks.style.display = 'none';
    }
  }

  // 顯示書籤列表
  function displayBookmarks() {
    const timetableCourses = Object.values(timetable);

    // 計算總書籤數
    let totalBookmarks = 0;
    for (const categoryId in bookmarkCategories) {
      totalBookmarks += Object.keys(bookmarkCategories[categoryId].courses).length;
    }

    // 如果書籤和課表都是空的
    if (totalBookmarks === 0 && timetableCourses.length === 0) {
      bookmarksList.innerHTML = `
        <div class="placeholder">
          尚未加入任何書籤<br>
          <span style="font-size: 12px; color: #999; margin-top: 8px; display: block;">
            在搜尋結果中點擊星號圖示即可加入書籤
          </span>
        </div>
      `;
      return;
    }

    let fullHtml = '';

    // ========== 已選課程區塊（自動分類）==========
    if (timetableCourses.length > 0) {
      const isTimetableCollapsed = collapsedCategories['__timetable__'];
      const timetableHtml = timetableCourses.map((course, index) => {
        const courseKey = getCourseKey(course);
        const isBookmarked = !!bookmarks[courseKey];

        return `
          <div class="course-item timetable-course-item" data-timetable-index="${index}">
            <div class="course-header">
              <div class="course-header-left">
                <div class="course-code">${escapeHtml(course.code)}</div>
                <div class="course-name">${escapeHtml(course.name)}</div>
              </div>
              <div class="course-actions">
                <button class="timetable-bookmark-btn ${isBookmarked ? 'bookmarked' : ''}" data-timetable-index="${index}" title="${isBookmarked ? '管理書籤' : '加入書籤'}">
                  ${isBookmarked ? '★' : '☆'}
                </button>
                <button class="timetable-remove-btn" data-timetable-index="${index}" title="從課表移除">
                  ✕
                </button>
              </div>
            </div>

            ${course.teacher ? `<div class="course-info">👨‍🏫 ${escapeHtml(course.teacher)}</div>` : ''}
            ${course.time ? `<div class="course-info">🕐 ${escapeHtml(course.time)}</div>` : ''}
            ${course.room ? `<div class="course-info">📍 ${escapeHtml(course.room)}</div>` : ''}
            ${course.credits ? `<div class="course-info">📚 ${escapeHtml(course.credits)} 學分</div>` : ''}

            <div class="course-action-buttons">
              <button class="view-detail-btn timetable-detail-btn" data-timetable-index="${index}">
                📋 查看完整資訊
              </button>
              <button class="view-rating-btn timetable-rating-btn" data-timetable-index="${index}" title="在 OPT 歐趴糖查看課程評價">
                📊 查看歐趴糖評價
              </button>
            </div>
          </div>
        `;
      }).join('');

      fullHtml += `
        <div class="bookmark-section ${isTimetableCollapsed ? 'collapsed' : ''}" data-category-id="__timetable__">
          <div class="bookmark-section-header timetable-section-header clickable" data-category-id="__timetable__">
            <div class="bookmark-section-title-wrapper">
              <span class="collapse-icon">${isTimetableCollapsed ? '▶' : '▼'}</span>
              <span class="bookmark-section-title">📅 已選課程</span>
            </div>
            <span class="bookmark-section-count">${timetableCourses.length} 門</span>
          </div>
          <div class="bookmark-section-list" style="${isTimetableCollapsed ? 'display: none;' : ''}">
            ${timetableHtml}
          </div>
        </div>
      `;
    }

    // ========== 各書籤分類區塊 ==========
    // 先顯示默認分類，再顯示其他分類
    const categoryIds = Object.keys(bookmarkCategories).sort((a, b) => {
      if (a === 'default') return -1;
      if (b === 'default') return 1;
      return 0;
    });

    for (const categoryId of categoryIds) {
      const category = bookmarkCategories[categoryId];
      const courses = Object.values(category.courses);

      if (courses.length === 0 && categoryId === 'default') continue; // 默認分類為空時不顯示

      // 按加入時間排序
      courses.sort((a, b) => (b.bookmarkedAt || 0) - (a.bookmarkedAt || 0));

      const isCollapsed = collapsedCategories[categoryId];

      const coursesHtml = courses.map((course, index) => {
        const courseKey = getCourseKey(course);
        const isInTimetable = timetable[courseKey] !== undefined;

        return `
          <div class="course-item" data-category-id="${categoryId}" data-course-key="${courseKey}">
            <div class="course-header">
              <div class="course-header-left">
                <div class="course-code">${escapeHtml(course.code)}</div>
                <div class="course-name">${escapeHtml(course.name)}</div>
              </div>
              <div class="course-actions">
                <button class="add-to-timetable-btn ${isInTimetable ? 'in-timetable' : ''}" data-category-id="${categoryId}" data-course-key="${courseKey}" title="${isInTimetable ? '從課表移除' : '加入課表'}">
                  ${isInTimetable ? '-' : '+'}
                </button>
                <button class="bookmark-btn bookmarked" data-category-id="${categoryId}" data-course-key="${courseKey}" title="移除書籤">
                  ★
                </button>
              </div>
            </div>

            ${course.teacher ? `<div class="course-info">👨‍🏫 ${escapeHtml(course.teacher)}</div>` : ''}
            ${course.time ? `<div class="course-info">🕐 ${escapeHtml(course.time)}</div>` : ''}
            ${course.room ? `<div class="course-info">📍 ${escapeHtml(course.room)}</div>` : ''}
            ${course.credits ? `<div class="course-info">📚 ${escapeHtml(course.credits)} 學分</div>` : ''}

            <div class="course-action-buttons">
              <button class="view-detail-btn" data-category-id="${categoryId}" data-course-key="${courseKey}">
                📋 查看完整資訊
              </button>
              <button class="view-rating-btn" data-category-id="${categoryId}" data-course-key="${courseKey}" title="在 OPT 歐趴糖查看課程評價">
                📊 查看歐趴糖評價
              </button>
              <button class="move-bookmark-btn" data-category-id="${categoryId}" data-course-key="${courseKey}" title="移動到其他分類">
                📂 移動
              </button>
            </div>
          </div>
        `;
      }).join('');

      const isDefaultCategory = categoryId === 'default';

      fullHtml += `
        <div class="bookmark-section ${isCollapsed ? 'collapsed' : ''}" data-category-id="${categoryId}">
          <div class="bookmark-section-header clickable" data-category-id="${categoryId}">
            <div class="bookmark-section-title-wrapper">
              <span class="collapse-icon">${isCollapsed ? '▶' : '▼'}</span>
              <span class="bookmark-section-title">${escapeHtml(category.icon)} ${escapeHtml(category.name)}</span>
            </div>
            <div class="bookmark-section-actions">
              <span class="bookmark-section-count">${courses.length} 門</span>
              ${!isDefaultCategory ? `
                <button class="edit-category-btn" data-category-id="${categoryId}" title="編輯分類">✏️</button>
                <button class="delete-category-btn" data-category-id="${categoryId}" title="刪除分類">🗑️</button>
              ` : ''}
            </div>
          </div>
          <div class="bookmark-section-list" style="${isCollapsed ? 'display: none;' : ''}">
            ${courses.length > 0 ? coursesHtml : '<div class="empty-category-hint">此分類尚無課程</div>'}
          </div>
        </div>
      `;
    }

    bookmarksList.innerHTML = fullHtml;

    // ========== 綁定事件 ==========
    bindBookmarkEvents(timetableCourses);
  }

  // 綁定書籤頁面的事件
  function bindBookmarkEvents(timetableCourses) {
    // 收合/展開事件（點擊標題）
    const sectionHeaders = bookmarksList.querySelectorAll('.bookmark-section-header.clickable');
    sectionHeaders.forEach(header => {
      header.addEventListener('click', function(e) {
        // 如果點擊的是編輯或刪除按鈕，不觸發收合
        if (e.target.closest('.edit-category-btn') || e.target.closest('.delete-category-btn')) {
          return;
        }
        const categoryId = this.dataset.categoryId;
        toggleCategoryCollapse(categoryId);

        // 更新 UI
        const section = this.closest('.bookmark-section');
        const collapseIcon = this.querySelector('.collapse-icon');
        const sectionList = section.querySelector('.bookmark-section-list');

        const isNowCollapsed = collapsedCategories[categoryId];
        section.classList.toggle('collapsed', isNowCollapsed);
        collapseIcon.textContent = isNowCollapsed ? '▶' : '▼';
        sectionList.style.display = isNowCollapsed ? 'none' : '';
      });
    });

    // 編輯分類按鈕
    const editCategoryBtns = bookmarksList.querySelectorAll('.edit-category-btn');
    editCategoryBtns.forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        const categoryId = this.dataset.categoryId;
        showEditCategoryModal(categoryId);
      });
    });

    // 刪除分類按鈕
    const deleteCategoryBtns = bookmarksList.querySelectorAll('.delete-category-btn');
    deleteCategoryBtns.forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        const categoryId = this.dataset.categoryId;
        const category = bookmarkCategories[categoryId];
        const courseCount = Object.keys(category.courses).length;
        const msg = courseCount > 0
          ? `確定要刪除「${category.name}」嗎？\n其中的 ${courseCount} 門課程將移到「我的書籤」`
          : `確定要刪除「${category.name}」嗎？`;
        if (confirm(msg)) {
          deleteBookmarkCategory(categoryId);
          displayBookmarks();
        }
      });
    });

    // 已選課程區塊的事件
    const timetableBookmarkBtns = bookmarksList.querySelectorAll('.timetable-bookmark-btn');
    timetableBookmarkBtns.forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        const timetableIndex = parseInt(this.dataset.timetableIndex);
        const course = timetableCourses[timetableIndex];
        const courseKey = getCourseKey(course);
        if (bookmarks[courseKey]) {
          toggleBookmark(course);
          displayBookmarks();
        } else {
          showCategorySelectModal(course);
        }
      });
    });

    const timetableRemoveBtns = bookmarksList.querySelectorAll('.timetable-remove-btn');
    timetableRemoveBtns.forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        const timetableIndex = parseInt(this.dataset.timetableIndex);
        const course = timetableCourses[timetableIndex];
        if (confirm(`確定要從課表移除「${course.name}」嗎？`)) {
          removeFromTimetable(course);
          displayBookmarks();
        }
      });
    });

    const timetableDetailBtns = bookmarksList.querySelectorAll('.timetable-detail-btn');
    timetableDetailBtns.forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        const timetableIndex = parseInt(this.dataset.timetableIndex);
        const course = timetableCourses[timetableIndex];
        showDetailView(course);
      });
    });

    const timetableRatingBtns = bookmarksList.querySelectorAll('.timetable-rating-btn');
    timetableRatingBtns.forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        const timetableIndex = parseInt(this.dataset.timetableIndex);
        const course = timetableCourses[timetableIndex];
        openOPTRating(course);
      });
    });

    // 書籤區塊的事件
    const addToTimetableBtns = bookmarksList.querySelectorAll('.add-to-timetable-btn');
    addToTimetableBtns.forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        const categoryId = this.dataset.categoryId;
        const courseKey = this.dataset.courseKey;
        const course = bookmarkCategories[categoryId]?.courses[courseKey];
        if (!course) return;

        if (timetable[courseKey]) {
          if (confirm(`確定要從課表移除「${course.name}」嗎？`)) {
            removeFromTimetable(course);
            displayBookmarks();
          }
        } else {
          if (addToTimetable(course)) {
            displayBookmarks();
          }
        }
      });
    });

    const viewDetailBtns = bookmarksList.querySelectorAll('.view-detail-btn:not(.timetable-detail-btn)');
    viewDetailBtns.forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        const categoryId = this.dataset.categoryId;
        const courseKey = this.dataset.courseKey;
        const course = bookmarkCategories[categoryId]?.courses[courseKey];
        if (course) showDetailView(course);
      });
    });

    const bookmarkBtns = bookmarksList.querySelectorAll('.bookmark-btn');
    bookmarkBtns.forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        const categoryId = this.dataset.categoryId;
        const courseKey = this.dataset.courseKey;
        const course = bookmarkCategories[categoryId]?.courses[courseKey];
        if (course) {
          toggleBookmark(course);
          displayBookmarks();
        }
      });
    });

    const viewRatingBtns = bookmarksList.querySelectorAll('.view-rating-btn:not(.timetable-rating-btn)');
    viewRatingBtns.forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        const categoryId = this.dataset.categoryId;
        const courseKey = this.dataset.courseKey;
        const course = bookmarkCategories[categoryId]?.courses[courseKey];
        if (course) openOPTRating(course);
      });
    });

    // 移動書籤按鈕
    const moveBookmarkBtns = bookmarksList.querySelectorAll('.move-bookmark-btn');
    moveBookmarkBtns.forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        const categoryId = this.dataset.categoryId;
        const courseKey = this.dataset.courseKey;
        const course = bookmarkCategories[categoryId]?.courses[courseKey];
        if (course) showCategorySelectModal(course, categoryId);
      });
    });
  }

  // 顯示新增分類彈窗
  function showAddCategoryModal() {
    const name = prompt('請輸入分類名稱：');
    if (name && name.trim()) {
      const icon = prompt('請輸入分類圖示（留空使用預設）：', '📁') || '📁';
      createBookmarkCategory(name.trim(), icon);
      displayBookmarks();
    }
  }

  // 顯示編輯分類彈窗
  function showEditCategoryModal(categoryId) {
    const category = bookmarkCategories[categoryId];
    if (!category) return;

    const newName = prompt('請輸入新的分類名稱：', category.name);
    if (newName && newName.trim()) {
      const newIcon = prompt('請輸入新的分類圖示：', category.icon) || category.icon;
      renameBookmarkCategory(categoryId, newName.trim(), newIcon);
      displayBookmarks();
    }
  }

  // 顯示分類選擇彈窗
  function showCategorySelectModal(course, currentCategoryId = null) {
    const overlay = document.createElement('div');
    overlay.className = 'course-modal-overlay';

    const modal = document.createElement('div');
    modal.className = 'course-modal category-select-modal';

    let categoriesHtml = '';
    for (const categoryId in bookmarkCategories) {
      const category = bookmarkCategories[categoryId];
      const isCurrentCategory = categoryId === currentCategoryId;
      categoriesHtml += `
        <div class="category-select-item ${isCurrentCategory ? 'current' : ''}" data-category-id="${categoryId}">
          <span class="category-icon">${escapeHtml(category.icon)}</span>
          <span class="category-name">${escapeHtml(category.name)}</span>
          ${isCurrentCategory ? '<span class="current-badge">目前</span>' : ''}
        </div>
      `;
    }

    modal.innerHTML = `
      <div class="course-modal-header">
        <div class="course-modal-title">
          <div class="course-modal-name">選擇分類</div>
          <div class="course-modal-subtitle">${escapeHtml(course.name)}</div>
        </div>
        <button class="course-modal-close">×</button>
      </div>
      <div class="course-modal-body">
        <div class="category-select-list">
          ${categoriesHtml}
        </div>
        <div class="category-select-actions">
          <button class="create-new-category-btn">+ 新增分類</button>
        </div>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // 關閉按鈕
    modal.querySelector('.course-modal-close').addEventListener('click', () => {
      document.body.removeChild(overlay);
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        document.body.removeChild(overlay);
      }
    });

    // 選擇分類
    modal.querySelectorAll('.category-select-item').forEach(item => {
      item.addEventListener('click', function() {
        const targetCategoryId = this.dataset.categoryId;
        if (targetCategoryId !== currentCategoryId) {
          addToBookmarkCategory(course, targetCategoryId);
          displayBookmarks();
        }
        document.body.removeChild(overlay);
      });
    });

    // 新增分類
    modal.querySelector('.create-new-category-btn').addEventListener('click', () => {
      document.body.removeChild(overlay);
      const name = prompt('請輸入分類名稱：');
      if (name && name.trim()) {
        const icon = prompt('請輸入分類圖示（留空使用預設）：', '📁') || '📁';
        const newCategoryId = createBookmarkCategory(name.trim(), icon);
        addToBookmarkCategory(course, newCategoryId);
        displayBookmarks();
      }
    });
  }

  // ==================== 課表相關函數 ====================

  // 載入課表資料
  function loadTimetable() {
    chrome.storage.local.get(['courseTimetable', 'timetableViewMode', 'showWeekend', 'selectedCoursesForSlots'], function(result) {
      timetable = result.courseTimetable || {};
      timetableViewMode = result.timetableViewMode || 'grid';
      showWeekend = result.showWeekend || false;
      selectedCoursesForSlots = result.selectedCoursesForSlots || {};

      // 更新勾選框狀態
      if (showWeekendCheckbox) showWeekendCheckbox.checked = showWeekend;

      updateTimetableCount();
    });
  }

  // 儲存課表資料
  function saveTimetable() {
    chrome.storage.local.set({
      courseTimetable: timetable,
      timetableViewMode: timetableViewMode,
      showWeekend: showWeekend,
      selectedCoursesForSlots: selectedCoursesForSlots
    }, function() {
      updateTimetableCount();
    });
  }

  // 更新課表數量顯示
  function updateTimetableCount() {
    const count = Object.keys(timetable).length;
    // 稍後在 HTML 中添加 timetableCount 元素時會用到
    const timetableCountElem = document.getElementById('timetableCount');
    if (timetableCountElem) {
      timetableCountElem.textContent = count;
    }
  }

  // 解析時間字串為時間槽陣列
  // 例如: "M56" -> [{day: 'M', periods: ['5', '6']}]
  // "M56,R34" -> [{day: 'M', periods: ['5', '6']}, {day: 'R', periods: ['3', '4']}]
  function parseTimeSlots(timeString) {
    if (!timeString || typeof timeString !== 'string') {
      return [];
    }

    const slots = [];
    // 分割多個時間段（用逗號分隔）
    const timeParts = timeString.split(',');

    timeParts.forEach(part => {
      // 移除教室和校區資訊（如果有的話）
      const cleanPart = part.split('-')[0].trim();
      if (!cleanPart) return;

      // 解析星期代碼和時間代碼
      // 格式可能是: M56, M56R34, Rabc 等
      let currentDay = null;
      let periods = [];

      for (let i = 0; i < cleanPart.length; i++) {
        const char = cleanPart[i];

        // 檢查是否為星期代碼
        if (dayCodeMap[char]) {
          // 如果之前已經有累積的時段，先保存
          if (currentDay && periods.length > 0) {
            slots.push({ day: currentDay, periods: [...periods] });
            periods = [];
          }
          currentDay = char;
        } else if (currentDay) {
          // 時間代碼 (1-9, a-d)
          periods.push(char);
        }
      }

      // 保存最後一組
      if (currentDay && periods.length > 0) {
        slots.push({ day: currentDay, periods: [...periods] });
      }
    });

    return slots;
  }

  // 檢查時間衝突
  function checkTimeConflict(newCourse) {
    const newSlots = parseTimeSlots(newCourse.time);
    if (newSlots.length === 0) {
      return null; // 沒有時間資訊，不檢查衝突
    }

    // 檢查所有已加入課表的課程
    for (const courseKey in timetable) {
      const course = timetable[courseKey];
      const existingSlots = parseTimeSlots(course.time);

      // 比較時間槽
      for (const newSlot of newSlots) {
        for (const existingSlot of existingSlots) {
          // 如果是同一天
          if (newSlot.day === existingSlot.day) {
            // 檢查時段是否重疊
            for (const newPeriod of newSlot.periods) {
              if (existingSlot.periods.includes(newPeriod)) {
                return course; // 返回衝突的課程
              }
            }
          }
        }
      }
    }

    return null; // 沒有衝突
  }

  // 檢查課程是否與課表中其他課程有時間衝突
  function courseHasConflicts(course) {
    const courseKey = getCourseKey(course);
    const courseSlots = parseTimeSlots(course.time);
    if (courseSlots.length === 0) {
      return false; // 沒有時間資訊，視為沒有衝突
    }

    // 檢查所有其他課程
    for (const otherKey in timetable) {
      if (otherKey === courseKey) continue; // 跳過自己

      const otherCourse = timetable[otherKey];
      const otherSlots = parseTimeSlots(otherCourse.time);

      // 比較時間槽
      for (const slot of courseSlots) {
        for (const otherSlot of otherSlots) {
          // 如果是同一天
          if (slot.day === otherSlot.day) {
            // 檢查時段是否重疊
            for (const period of slot.periods) {
              if (otherSlot.periods.includes(period)) {
                return true; // 有衝突
              }
            }
          }
        }
      }
    }

    return false; // 沒有衝突
  }

  // 加入課程到課表
  function addToTimetable(course) {
    const courseKey = getCourseKey(course);

    // 檢查是否已在課表中
    if (timetable[courseKey]) {
      alert('此課程已在課表中');
      return false;
    }

    // 加入課表
    timetable[courseKey] = {
      ...course,
      addedToTimetableAt: Date.now()
    };

    addLog('success', `加入課表：${course.name} (${course.time || '無時間'})`);

    saveTimetable();
    displayTimetable(); // 更新課表顯示和學分

    return true;
  }

  // 從課表移除課程
  function removeFromTimetable(course) {
    const courseKey = getCourseKey(course);

    // 清理 selectedCoursesForSlots 中的記錄
    for (const slotKey in selectedCoursesForSlots) {
      if (selectedCoursesForSlots[slotKey] === courseKey) {
        delete selectedCoursesForSlots[slotKey];
      }
    }

    delete timetable[courseKey];
    addLog('info', `移除課程：${course.name}`);
    saveTimetable();
    displayTimetable(); // 更新課表顯示和學分
  }

  // 取得課程類別（用於決定顏色）
  function getCourseCategory(course) {
    const courseDetailsKey = getCourseDetailsKey(course);
    const cachedDetails = courseDetailsCache[courseDetailsKey];
    const cachedType = cachedDetails && cachedDetails.必選修 && cachedDetails.必選修 !== '未提供'
      ? String(cachedDetails.必選修).trim()
      : '';
    const courseType = (cachedType || course.cos_type || '').trim();
    const courseName = course.name || '';
    const departmentName = course.dep_name || '';
    if (courseName.includes('軍訓') || courseName.includes('國防教育') ||
        departmentName.includes('軍訓') || departmentName.includes('軍訓暨護理') ||
        courseType.includes('軍訓')) {
      return 'military';
    }
    if (courseName.includes('體育') || courseName.startsWith('體育－') ||
        departmentName.includes('體育') || courseType.includes('體育')) {
      return 'other';
    }
    if (courseType) {
      if (courseType.includes('必修')) {
        return 'required';
      }
      if (courseType.includes('核心')) {
        return 'general';
      }
      if (courseType.includes('選修')) {
        return 'elective';
      }
      if (courseType.includes('體育') || courseType.includes('語言') || courseType.includes('教育')) {
        return 'other';
      }
    }

    if (course.paths && Array.isArray(course.paths) && course.paths.length > 0) {
      let hasRequired = false;
      let hasElective = false;
      let hasGeneral = false;
      for (const path of course.paths) {
        const typeOrCategory = String(path.type || path.category || '').trim();
        const department = path.department || '';
        const isElectiveKeyword = typeOrCategory.includes('選修') ||
          typeOrCategory.includes('選必') ||
          typeOrCategory.includes('必選') ||
          typeOrCategory.includes('必選修');
        if (typeOrCategory.includes('通識') || typeOrCategory.includes('博雅') ||
            typeOrCategory.includes('核心課程') || department.includes('通識') || department.includes('博雅')) {
          hasGeneral = true;
        }
        if (typeOrCategory.includes('必修') || (typeOrCategory.includes('必') && !isElectiveKeyword)) {
          hasRequired = true;
        }
        if (isElectiveKeyword || typeOrCategory.includes('選')) {
          hasElective = true;
        }
      }

      if (hasRequired) {
        return 'required';
      }
      if (hasGeneral) {
        return 'general';
      }
      if (hasElective) {
        return 'elective';
      }
    }

    if (courseName.includes('通識') || courseName.includes('博雅') ||
        courseName.includes('人文') || courseName.includes('社會') ||
        courseName.includes('自然') || courseName.includes('經典閱讀')) {
      return 'general';
    }
    if (courseName.includes('體育') || courseName.startsWith('體育－')) {
      return 'other';
    }
    if (courseName.includes('英文') || courseName.includes('英語') ||
        courseName.includes('日文') || courseName.includes('日語') ||
        courseName.includes('法文') || courseName.includes('法語') ||
        courseName.includes('德文') || courseName.includes('德語') ||
        courseName.includes('西班牙') || courseName.includes('韓文') ||
        courseName.includes('韓語') || courseName.includes('外語')) {
      return 'other';
    }
    if (courseName.includes('服務學習') || courseName.includes('服學')) {
      return 'other';
    }

    // 預設為選修（一般學士班課程多為選修）
    return 'elective';
  }

  // 計算課表總學分（只計算完整顯示的課程）
  function calculateTotalCredits() {
    let total = 0;

    for (const courseKey in timetable) {
      const course = timetable[courseKey];
      const slots = parseTimeSlots(course.time);

      // 無固定時間的課程總是計入學分
      if (slots.length === 0) {
        total += parseFloat(course.credits) || 0;
        continue;
      }

      // 檢查課程的每個時段是否都被該課程選中顯示
      let isFullyDisplayed = true;
      for (const slot of slots) {
        for (const period of slot.periods) {
          const slotKey = `${slot.day}-${period}`;
          // 如果該時段不是顯示這門課，則課程不完整
          if (selectedCoursesForSlots[slotKey] !== courseKey) {
            isFullyDisplayed = false;
            break;
          }
        }
        if (!isFullyDisplayed) break;
      }

      // 只有完整顯示的課程才計入學分
      if (isFullyDisplayed) {
        total += parseFloat(course.credits) || 0;
      }
    }

    return total;
  }

  // 顯示課表
  function displayTimetable() {
    const courses = Object.values(timetable);
    const courseCount = courses.length;

    // 更新學分顯示
    const totalCredits = calculateTotalCredits();
    timetableCredits.textContent = `總學分：${totalCredits}`;

    // 顯示/隱藏清空按鈕
    if (courseCount > 0) {
      clearAllTimetable.style.display = 'inline-block';
    } else {
      clearAllTimetable.style.display = 'none';
    }

    // 顯示/隱藏 placeholder
    if (courseCount > 0) {
      timetablePlaceholder.style.display = 'none';
      // 根據檢視模式顯示課表
      if (timetableViewMode === 'grid') {
        gridViewContainer.style.display = 'block';
        listViewContainer.style.display = 'none';
        displayGridView(courses);
      } else {
        gridViewContainer.style.display = 'none';
        listViewContainer.style.display = 'block';
        displayListView(courses);
      }
    } else {
      // 沒有課程要顯示，顯示 placeholder
      timetablePlaceholder.style.display = 'block';
      gridViewContainer.style.display = 'none';
      listViewContainer.style.display = 'none';
      timetableGrid.innerHTML = '';
      timetableList.innerHTML = '';

      timetablePlaceholder.innerHTML = `
        尚未加入任何課程到課表<br>
        <span style="font-size: 12px; color: #999; margin-top: 8px; display: block;">
          在搜尋結果或書籤中點擊「加入課表」按鈕即可建立課表
        </span>
      `;
      return;
    }
  }

  // 從多個課程中選擇最「完整」的課程（時段最少的）
  function selectMostCompleteCourse(coursesInSlot) {
    if (coursesInSlot.length === 0) return null;
    if (coursesInSlot.length === 1) return coursesInSlot[0];

    // 計算每個課程的總時段數
    const coursesWithPeriods = coursesInSlot.map(course => {
      const slots = parseTimeSlots(course.time);
      const totalPeriods = slots.reduce((sum, slot) => sum + slot.periods.length, 0);
      return { course, totalPeriods };
    });

    // 排序：時段數較少的優先（更完整）
    coursesWithPeriods.sort((a, b) => {
      if (a.totalPeriods !== b.totalPeriods) {
        return a.totalPeriods - b.totalPeriods;
      }
      // 時段數相同，按課程代碼字典序排序
      const keyA = getCourseKey(a.course);
      const keyB = getCourseKey(b.course);
      return keyA.localeCompare(keyB);
    });

    return coursesWithPeriods[0].course;
  }

  // 檢查課程是否完整顯示（所有時段都被選中）
  function isCourseFullyDisplayed(course) {
    const courseKey = getCourseKey(course);
    const slots = parseTimeSlots(course.time);

    if (slots.length === 0) return true;

    // 檢查課程的每個時段是否都被選中顯示
    for (const slot of slots) {
      for (const period of slot.periods) {
        const slotKey = `${slot.day}-${period}`;
        const selectedKey = selectedCoursesForSlots[slotKey];

        // 如果這個時段沒有被選中，或選中的不是這門課，則課程不完整
        if (selectedKey !== courseKey) {
          return false;
        }
      }
    }

    return true;
  }


  // 顯示格子式課表
  function displayGridView(courses) {
    // 保存當前捲動位置
    const savedScrollLeft = gridViewContainer.scrollLeft;
    const savedScrollTop = gridViewContainer.scrollTop;

    const allDays = ['M', 'T', 'W', 'R', 'F', 'S', 'U'];
    const allDayNames = ['一', '二', '三', '四', '五', '六', '日'];
    const periods = ['1', '2', '3', '4', 'n', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd'];
    const periodLabels = ['1', '2', '3', '4', 'N', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D'];

    // 根據 showWeekend 決定要顯示的天數
    const days = showWeekend ? allDays : allDays.slice(0, 5); // 只顯示週一到週五
    const dayNames = showWeekend ? allDayNames : allDayNames.slice(0, 5);

    // 建立課表格子資料結構（包含所有天數，以便課程資料正確填入）
    const grid = {};
    allDays.forEach(day => {
      grid[day] = {};
      periods.forEach(period => {
        grid[day][period] = [];
      });
    });

    // 填入課程到對應的格子（每個時段都獨立顯示）
    courses.forEach(course => {
      const slots = parseTimeSlots(course.time);
      if (slots.length === 0) return;

      // 在每個時段都顯示課程
      slots.forEach(slot => {
        slot.periods.forEach(period => {
          if (grid[slot.day] && grid[slot.day][period]) {
            grid[slot.day][period].push(course);
          }
        });
      });
    });

    // 預處理所有時段，設置 selectedCoursesForSlots
    allDays.forEach(day => {
      periods.forEach(period => {
        const coursesInSlot = grid[day][period];
        const slotKey = `${day}-${period}`;

        if (coursesInSlot.length === 0) {
          // 空時段，清除記錄
          delete selectedCoursesForSlots[slotKey];
        } else if (coursesInSlot.length === 1) {
          // 單一課程，自動選擇
          const courseKey = getCourseKey(coursesInSlot[0]);
          if (!selectedCoursesForSlots[slotKey]) {
            selectedCoursesForSlots[slotKey] = courseKey;
          }
        } else {
          // 多個課程，選擇最完整的（如果沒有記錄的話）
          let selectedCourseKey = selectedCoursesForSlots[slotKey];
          if (!selectedCourseKey || !coursesInSlot.find(c => getCourseKey(c) === selectedCourseKey)) {
            const mostCompleteCourse = selectMostCompleteCourse(coursesInSlot);
            selectedCoursesForSlots[slotKey] = getCourseKey(mostCompleteCourse);
          }
        }
      });
    });

    // 保存預處理後的狀態
    saveTimetable();

    // 第二階段：生成 HTML
    let html = '';

    html += '<table class="timetable-table"><thead><tr><th class="period-header">節次</th>';

    // 表頭：星期（只顯示選擇的天數）
    days.forEach((day, index) => {
      const dayIndex = allDays.indexOf(day);
      html += `<th class="day-header">週${allDayNames[dayIndex]}</th>`;
    });
    html += '</tr></thead><tbody>';

    // 表格內容：每一節課（只顯示選擇的天數）
    periods.forEach((period, periodIndex) => {
      html += '<tr>';
      html += `<td class="period-label">${periodLabels[periodIndex]}</td>`;

      days.forEach(day => {
        const coursesInSlot = grid[day][period];
        const slotKey = `${day}-${period}`;

        if (coursesInSlot.length === 0) {
          html += `<td class="empty-slot" data-day="${day}" data-period="${period}" style="cursor: pointer;" title="點擊查看此時段課程"></td>`;
        } else if (coursesInSlot.length === 1) {
          // 單一課程
          const course = coursesInSlot[0];
          const courseKey = getCourseKey(course);
          const category = getCourseCategory(course);
          const isComplete = isCourseFullyDisplayed(course);
          const incompleteClass = isComplete ? '' : ' incomplete';

          html += `
            <td class="course-slot category-${category}${incompleteClass}" data-slot-key="${slotKey}" data-course-key="${courseKey}" data-cos-id="${course.cos_id || ''}" style="cursor: pointer;">
              <div class="slot-course-name">${escapeHtml(course.name)}</div>
              ${course.teacher ? `<div class="slot-course-teacher">${truncateTeachers(course.teacher)}</div>` : ''}
              <div class="slot-course-room">${escapeHtml(course.room || '')}</div>
              <button class="slot-remove-btn" data-course-key="${courseKey}">×</button>
            </td>
          `;
        } else {
          // 多個課程：使用上下按鈕切換（selectedCourseKey 已在預處理階段設置）
          const selectedCourseKey = selectedCoursesForSlots[slotKey];
          const selectedCourse = coursesInSlot.find(c => getCourseKey(c) === selectedCourseKey);
          const currentIndex = coursesInSlot.findIndex(c => getCourseKey(c) === selectedCourseKey);
          const category = getCourseCategory(selectedCourse);
          const isComplete = isCourseFullyDisplayed(selectedCourse);
          const incompleteClass = isComplete ? '' : ' incomplete';

          html += `
            <td class="conflict-slot category-${category}${incompleteClass}" data-slot-key="${slotKey}" data-course-key="${selectedCourseKey}" data-cos-id="${selectedCourse.cos_id || ''}" style="cursor: pointer;">
              <div class="slot-course-name">${escapeHtml(selectedCourse.name)}</div>
              ${selectedCourse.teacher ? `<div class="slot-course-teacher">${truncateTeachers(selectedCourse.teacher)}</div>` : ''}
              <div class="slot-course-room">${escapeHtml(selectedCourse.room || '')}</div>
              <div class="slot-course-switcher">
                <button class="course-prev-btn" data-slot-key="${slotKey}" title="上一個課程">▲</button>
                <span class="course-count">${currentIndex + 1}/${coursesInSlot.length}</span>
                <button class="course-next-btn" data-slot-key="${slotKey}" title="下一個課程">▼</button>
              </div>
              <button class="slot-remove-btn" data-course-key="${selectedCourseKey}">×</button>
            </td>
          `;
        }
      });

      html += '</tr>';
    });

    html += '</tbody></table>';

    // 收集無固定時間的課程
    const noTimeCourses = courses.filter(course => {
      const slots = parseTimeSlots(course.time);
      return slots.length === 0;
    });

    // 如果有無固定時間的課程，新增獨立區塊
    if (noTimeCourses.length > 0) {
      html += `
        <div class="no-time-courses-section">
          <div class="no-time-courses-header">
            <span class="no-time-icon">📌</span>
            <span class="no-time-title">無固定時間課程</span>
            <span class="no-time-count">${noTimeCourses.length} 門</span>
          </div>
          <div class="no-time-courses-grid">
            ${noTimeCourses.map(course => {
              const courseKey = getCourseKey(course);
              const category = getCourseCategory(course);
              return `
                <div class="no-time-course-card course-slot category-${category}" data-course-key="${courseKey}" data-cos-id="${course.cos_id || ''}" style="cursor: pointer;">
                  <div class="slot-course-name">${escapeHtml(course.name)}</div>
                  ${course.teacher ? `<div class="slot-course-teacher">${truncateTeachers(course.teacher)}</div>` : ''}
                  ${course.credits ? `<div class="slot-course-credits">${escapeHtml(course.credits)} 學分</div>` : ''}
                  <button class="no-time-remove-btn" data-course-key="${courseKey}">×</button>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }

    timetableGrid.innerHTML = html;

    // 為上一個課程按鈕添加事件
    const prevBtns = timetableGrid.querySelectorAll('.course-prev-btn');
    prevBtns.forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        const slotKey = this.dataset.slotKey;
        const td = this.closest('td');
        const coursesInSlot = [];

        // 從 grid 重新取得該時段的所有課程
        const [day, period] = slotKey.split('-');
        courses.forEach(course => {
          const slots = parseTimeSlots(course.time);
          if (slots.length === 0) return;

          // 檢查所有時段，看是否有符合的
          slots.forEach(slot => {
            if (slot.day === day && slot.periods.includes(period)) {
              coursesInSlot.push(course);
            }
          });
        });

        // 找到當前課程的索引
        const currentKey = selectedCoursesForSlots[slotKey];
        const currentIndex = coursesInSlot.findIndex(c => getCourseKey(c) === currentKey);

        // 切換到上一個（循環）
        const newIndex = currentIndex > 0 ? currentIndex - 1 : coursesInSlot.length - 1;
        const newCourse = coursesInSlot[newIndex];
        const newCourseKey = getCourseKey(newCourse);

        // 更新該課程的所有時段
        const newCourseSlots = parseTimeSlots(newCourse.time);
        newCourseSlots.forEach(slot => {
          slot.periods.forEach(p => {
            const key = `${slot.day}-${p}`;
            selectedCoursesForSlots[key] = newCourseKey;
          });
        });

        saveTimetable();
        displayTimetable(); // 重新渲染以更新顯示
      });
    });

    // 為下一個課程按鈕添加事件
    const nextBtns = timetableGrid.querySelectorAll('.course-next-btn');
    nextBtns.forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        const slotKey = this.dataset.slotKey;

        // 從 grid 重新取得該時段的所有課程
        const [day, period] = slotKey.split('-');
        const coursesInSlot = [];
        courses.forEach(course => {
          const slots = parseTimeSlots(course.time);
          if (slots.length === 0) return;

          // 檢查所有時段，看是否有符合的
          slots.forEach(slot => {
            if (slot.day === day && slot.periods.includes(period)) {
              coursesInSlot.push(course);
            }
          });
        });

        // 找到當前課程的索引
        const currentKey = selectedCoursesForSlots[slotKey];
        const currentIndex = coursesInSlot.findIndex(c => getCourseKey(c) === currentKey);

        // 切換到下一個（循環）
        const newIndex = currentIndex < coursesInSlot.length - 1 ? currentIndex + 1 : 0;
        const newCourse = coursesInSlot[newIndex];
        const newCourseKey = getCourseKey(newCourse);

        // 更新該課程的所有時段
        const newCourseSlots = parseTimeSlots(newCourse.time);
        newCourseSlots.forEach(slot => {
          slot.periods.forEach(p => {
            const key = `${slot.day}-${p}`;
            selectedCoursesForSlots[key] = newCourseKey;
          });
        });

        saveTimetable();
        displayTimetable(); // 重新渲染以更新顯示
      });
    });

    // 為移除按鈕添加事件
    const removeBtns = timetableGrid.querySelectorAll('.slot-remove-btn');
    removeBtns.forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        const courseKey = this.dataset.courseKey;
        const course = timetable[courseKey];
        if (course && confirm(`確定要從課表移除「${course.name}」嗎？`)) {
          // 清理 selectedCoursesForSlots 中的記錄
          for (const slotKey in selectedCoursesForSlots) {
            if (selectedCoursesForSlots[slotKey] === courseKey) {
              delete selectedCoursesForSlots[slotKey];
            }
          }
          removeFromTimetable(course);
          displayTimetable();
        }
      });
    });

    // 為課程卡片添加點擊事件（顯示選項選單）
    const courseSlots = timetableGrid.querySelectorAll('.course-slot, .conflict-slot');
    courseSlots.forEach(slot => {
      slot.addEventListener('click', function(e) {
        // 如果點擊的是按鈕，不觸發卡片點擊
        if (e.target.closest('button')) {
          return;
        }
        const courseKey = this.dataset.courseKey;
        const slotKey = this.dataset.slotKey;
        const course = timetable[courseKey];
        if (course && slotKey) {
          showCourseSlotMenu(course, slotKey, e);
        } else if (course) {
          showCourseModal(course);
        }
      });
    });

    // 為空白格子添加點擊事件（顯示該時段可選課程）
    const emptySlots = timetableGrid.querySelectorAll('.empty-slot');
    emptySlots.forEach(slot => {
      slot.addEventListener('click', function(e) {
        const day = this.dataset.day;
        const period = this.dataset.period;
        showSlotCoursesModal(day, period);
      });
    });

    // 為無固定時間課程卡片添加點擊事件
    const noTimeCards = timetableGrid.querySelectorAll('.no-time-course-card');
    noTimeCards.forEach(card => {
      card.addEventListener('click', function(e) {
        if (e.target.closest('button')) {
          return;
        }
        const courseKey = this.dataset.courseKey;
        const course = timetable[courseKey];
        if (course) {
          showCourseModal(course);
        }
      });
    });

    // 為無固定時間課程移除按鈕添加事件
    const noTimeRemoveBtns = timetableGrid.querySelectorAll('.no-time-remove-btn');
    noTimeRemoveBtns.forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        const courseKey = this.dataset.courseKey;
        const course = timetable[courseKey];
        if (course && confirm(`確定要從課表移除「${course.name}」嗎？`)) {
          removeFromTimetable(course);
          displayTimetable();
        }
      });
    });

    // 恢復捲動位置
    requestAnimationFrame(() => {
      gridViewContainer.scrollLeft = savedScrollLeft;
      gridViewContainer.scrollTop = savedScrollTop;
    });
  }

  // 顯示清單式課表
  function displayListView(courses) {
    // 保存當前捲動位置
    const savedScrollTop = listViewContainer.scrollTop;

    // 按星期和時間排序課程
    const sortedCourses = courses.sort((a, b) => {
      const slotsA = parseTimeSlots(a.time);
      const slotsB = parseTimeSlots(b.time);

      if (slotsA.length === 0) return 1;
      if (slotsB.length === 0) return -1;

      const dayOrder = ['M', 'T', 'W', 'R', 'F', 'S', 'U'];
      const dayIndexA = dayOrder.indexOf(slotsA[0].day);
      const dayIndexB = dayOrder.indexOf(slotsB[0].day);

      if (dayIndexA !== dayIndexB) {
        return dayIndexA - dayIndexB;
      }

      // 同一天，比較時段
      const periodA = slotsA[0].periods[0] || '';
      const periodB = slotsB[0].periods[0] || '';
      return periodA.localeCompare(periodB);
    });

    const html = sortedCourses.map(course => {
      const courseKey = getCourseKey(course);
      const category = getCourseCategory(course);
      return `
        <div class="list-course-item category-${category}" data-course-key="${courseKey}">
          <div class="list-course-header">
            <div class="list-course-left">
              <div class="list-course-code">${escapeHtml(course.code)}</div>
              <div class="list-course-name">${escapeHtml(course.name)}</div>
            </div>
            <button class="list-remove-btn" data-course-key="${courseKey}">× 移除</button>
          </div>
          ${course.teacher ? `<div class="list-course-info">👨‍🏫 ${escapeHtml(course.teacher)}</div>` : ''}
          ${course.time ? `<div class="list-course-info">🕐 ${escapeHtml(course.time)}</div>` : ''}
          ${course.room ? `<div class="list-course-info">📍 ${escapeHtml(course.room)}</div>` : ''}
          ${course.credits ? `<div class="list-course-info">📚 ${escapeHtml(course.credits)} 學分</div>` : ''}
        </div>
      `;
    }).join('');

    timetableList.innerHTML = html;

    // 為移除按鈕添加事件
    const removeBtns = timetableList.querySelectorAll('.list-remove-btn');
    removeBtns.forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        const courseKey = this.dataset.courseKey;
        const course = timetable[courseKey];
        if (course && confirm(`確定要從課表移除「${course.name}」嗎？`)) {
          removeFromTimetable(course);
          displayTimetable();
        }
      });
    });

    const listItems = timetableList.querySelectorAll('.list-course-item');
    listItems.forEach(item => {
      item.addEventListener('click', function(e) {
        if (e.target.closest('.list-remove-btn')) {
          return;
        }
        const courseKey = this.dataset.courseKey;
        const course = timetable[courseKey];
        if (course) {
          showDetailView(course);
        }
      });
    });

    // 恢復捲動位置
    requestAnimationFrame(() => {
      listViewContainer.scrollTop = savedScrollTop;
    });
  }

  // 顯示匯出選項彈窗
  function showExportOptionsModal() {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'course-modal-overlay';

      const modal = document.createElement('div');
      modal.className = 'course-modal';
      modal.style.maxWidth = '320px';

      modal.innerHTML = `
        <div class="course-modal-header">
          <div class="course-modal-title">
            <div class="course-modal-name">匯出課表圖片</div>
            <div class="course-modal-subtitle">請選擇輸出樣式</div>
          </div>
          <button class="course-modal-close">×</button>
        </div>
        <div class="course-modal-body" style="padding: 20px;">
          <div class="export-options">
            <button class="export-option-btn colorful-option" data-mode="colorful">
              <span class="option-icon">🎨</span>
              <span class="option-label">彩色模式</span>
              <span class="option-desc">保留課程分類顏色</span>
            </button>
            <button class="export-option-btn grayscale-option" data-mode="grayscale">
              <span class="option-icon">🖤</span>
              <span class="option-label">灰階模式</span>
              <span class="option-desc">黑白風格，適合列印</span>
            </button>
          </div>
        </div>
      `;

      overlay.appendChild(modal);
      document.body.appendChild(overlay);

      // 關閉按鈕
      modal.querySelector('.course-modal-close').addEventListener('click', () => {
        document.body.removeChild(overlay);
        resolve(null);
      });

      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          document.body.removeChild(overlay);
          resolve(null);
        }
      });

      // 選項按鈕
      modal.querySelectorAll('.export-option-btn').forEach(btn => {
        btn.addEventListener('click', function() {
          const mode = this.dataset.mode;
          document.body.removeChild(overlay);
          resolve(mode);
        });
      });
    });
  }

  // 匯出課表為圖片
  async function exportTimetableAsImage() {
    // 檢查是否有課程
    if (Object.keys(timetable).length === 0) {
      alert('課表中沒有課程，無法匯出');
      return;
    }

    // 根據當前檢視模式選擇要匯出的元素
    const elementToCapture = timetableViewMode === 'grid' ? timetableGrid : timetableList;

    // 檢查元素是否為空
    if (!elementToCapture.innerHTML.trim()) {
      alert('課表為空，無法匯出');
      return;
    }

    // 顯示選項彈窗
    const exportMode = await showExportOptionsModal();
    if (!exportMode) return; // 用戶取消

    const isColorful = exportMode === 'colorful';

    try {
      // 顯示載入提示
      exportTimetableBtn.disabled = true;
      exportTimetableBtn.textContent = '📸 匯出中...';

      // 建立美化的容器 (A4 直向比例 - 瘦長)
      const exportContainer = document.createElement('div');
      exportContainer.style.cssText = `
        width: 1240px;
        height: auto;
        padding: 40px;
        background: ${isColorful
          ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
          : 'linear-gradient(135deg, #4a4a4a 0%, #2d2d2d 100%)'};
        font-family: 'Microsoft JhengHei', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        border-radius: 16px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.15);
        box-sizing: border-box;
      `;

      const A4_HEIGHT = 1754;
      const EXPORT_PADDING = 40;

      // 白色內容區域
      const contentWrapper = document.createElement('div');
      contentWrapper.style.cssText = `
        background: white;
        border-radius: 12px;
        padding: 32px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        height: auto;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
      `;

      // 克隆課表內容
      const clonedElement = elementToCapture.cloneNode(true);

      // 移除無固定時間課程區塊（匯出時不顯示）
      const noTimeSectionToRemove = clonedElement.querySelector('.no-time-courses-section');
      if (noTimeSectionToRemove) {
        noTimeSectionToRemove.remove();
      }

      // 設定課表區域樣式以適應 A4 (滿版顯示)
      clonedElement.style.cssText = `
        flex: 1;
        overflow: hidden;
        width: 100%;
        height: 100%;
      `;

      let tableContext = null;

      // 如果是格子式課表，調整表格樣式以填滿頁面
      const table = clonedElement.querySelector('table');
      if (table) {
        // 自動移除前後沒有課程的節次
        const tbody = table.querySelector('tbody');
        if (tbody) {
          const rows = Array.from(tbody.querySelectorAll('tr'));

          // 找出有課程的行範圍
          let firstRowWithCourse = -1;
          let lastRowWithCourse = -1;

          rows.forEach((row, index) => {
            const hasCourse = row.querySelector('.course-slot, .conflict-slot') !== null;
            if (hasCourse) {
              if (firstRowWithCourse === -1) firstRowWithCourse = index;
              lastRowWithCourse = index;
            }
          });

          // 如果有課程，移除前後空白的行
          if (firstRowWithCourse !== -1) {
            // 從後往前移除，避免索引變化問題
            for (let i = rows.length - 1; i > lastRowWithCourse; i--) {
              rows[i].remove();
            }
            for (let i = firstRowWithCourse - 1; i >= 0; i--) {
              rows[i].remove();
            }
          }

          // 移除沒有課程的 N 節（午餐時段）
          const remainingRowsAfterTrim = Array.from(tbody.querySelectorAll('tr'));
          remainingRowsAfterTrim.forEach(row => {
            const periodLabel = row.querySelector('.period-label');
            if (periodLabel && periodLabel.textContent.trim() === 'N') {
              const hasCourse = row.querySelector('.course-slot, .conflict-slot') !== null;
              if (!hasCourse) {
                row.remove();
              }
            }
          });
        }

        table.style.width = '100%';
        table.style.height = 'auto';
        table.style.minWidth = 'unset';
        table.style.fontSize = '16px';
        table.style.tableLayout = 'fixed';
        table.style.borderCollapse = 'separate';
        table.style.borderSpacing = '4px';

        // 計算並設定每列的固定寬度
        const headerCells = table.querySelectorAll('thead th');
        const totalColumns = headerCells.length;
        const periodColumnWidth = '60px';
        const dayColumnWidth = `${(100 - 6) / (totalColumns - 1)}%`;

        headerCells.forEach((th, index) => {
          if (index === 0) {
            th.style.width = periodColumnWidth;
          } else {
            th.style.width = dayColumnWidth;
          }
        });

        // 動態調整格子高度
        const remainingRows = table.querySelectorAll('tbody tr').length;
        const baseSlotHeight = remainingRows <= 5 ? 120 : remainingRows <= 7 ? 100 : remainingRows <= 10 ? 85 : 72;
        const baseSlotPadding = remainingRows <= 5 ? 14 : remainingRows <= 7 ? 12 : remainingRows <= 10 ? 10 : 8;

        const slots = clonedElement.querySelectorAll('.course-slot, .conflict-slot, .empty-slot');
        slots.forEach(slot => {
          slot.style.minHeight = `${baseSlotHeight}px`;
          slot.style.height = `${baseSlotHeight}px`;
          slot.style.padding = `${baseSlotPadding}px`;
          slot.style.boxSizing = 'border-box';
          slot.style.overflow = 'hidden';
        });

        // 設定 period-label 的樣式
        const periodLabels = clonedElement.querySelectorAll('.period-label');
        periodLabels.forEach(label => {
          label.style.width = periodColumnWidth;
          label.style.height = `${baseSlotHeight}px`;
          label.style.boxSizing = 'border-box';
        });

        // 動態調整字體大小
        const baseNameFontSize = remainingRows <= 5 ? 21 : remainingRows <= 7 ? 18 : remainingRows <= 10 ? 16 : 15;
        const baseInfoFontSize = remainingRows <= 5 ? 15 : remainingRows <= 7 ? 14 : remainingRows <= 10 ? 13 : 12;
        const baseHeaderFontSize = remainingRows <= 5 ? 18 : remainingRows <= 7 ? 17 : remainingRows <= 10 ? 16 : 15;
        const dayColumns = Math.max(1, totalColumns - 1);
        const columnScale = Math.min(1.22, Math.max(0.85, 7 / dayColumns));
        const nameFontSize = `${Math.round(baseNameFontSize * columnScale)}px`;
        const infoFontSize = `${Math.round(baseInfoFontSize * columnScale)}px`;
        const headerFontSize = `${Math.round(baseHeaderFontSize * columnScale)}px`;

        const names = clonedElement.querySelectorAll('.slot-course-name');
        names.forEach(name => {
          name.style.fontSize = nameFontSize;
          name.style.fontWeight = '700';
          name.style.marginBottom = '2px';
          // 彩色模式保留原色，灰階模式使用黑色
          if (!isColorful) {
            name.style.setProperty('color', '#000', 'important');
          }
          name.style.textShadow = 'none';
        });

        const infos = clonedElement.querySelectorAll('.slot-course-teacher, .slot-course-room');
        infos.forEach(info => {
          info.style.fontSize = infoFontSize;
          info.style.marginBottom = '2px';
          // 彩色模式保留原色，灰階模式使用深灰色
          if (!isColorful) {
            info.style.setProperty('color', '#222', 'important');
          }
          info.style.fontWeight = '500';
        });

        // 調整標題字體
        const headers = clonedElement.querySelectorAll('th');
        headers.forEach(header => {
          header.style.fontSize = headerFontSize;
          header.style.padding = '10px 8px';
          header.style.fontWeight = '700';
        });

        tableContext = {
          table,
          slots,
          periodLabels,
          names,
          infos,
          headers,
          remainingRows,
          baseSlotHeight,
          baseSlotPadding,
          baseNameFontSize,
          baseInfoFontSize,
          baseHeaderFontSize,
          columnScale
        };
      }

      // 如果是清單式課表，調整樣式
      if (clonedElement.classList.contains('timetable-list')) {
        clonedElement.style.fontSize = '15px';

        const items = clonedElement.querySelectorAll('.list-course-item');
        items.forEach(item => {
          item.style.padding = '16px';
          item.style.marginBottom = '12px';
        });
      }

      // 移除所有按鈕（移除按鈕和切換按鈕）
      const removeBtns = clonedElement.querySelectorAll('.slot-remove-btn, .list-remove-btn, .course-prev-btn, .course-next-btn');
      removeBtns.forEach(btn => btn.remove());

      // 移除課程計數器
      const courseCounts = clonedElement.querySelectorAll('.course-count');
      courseCounts.forEach(count => count.remove());

      // 移除切換器容器（如果空了）
      const switchers = clonedElement.querySelectorAll('.slot-course-switcher');
      switchers.forEach(switcher => switcher.remove());

      // 移除 incomplete 類別（匯出時顯示所有課程為正常樣式）
      const incompleteCourses = clonedElement.querySelectorAll('.incomplete');
      incompleteCourses.forEach(course => course.classList.remove('incomplete'));

      // 灰階模式：將所有彩色課程格子轉為灰色
      if (!isColorful) {
        const courseSlots = clonedElement.querySelectorAll('.course-slot, .conflict-slot');
        courseSlots.forEach(slot => {
          // 移除所有 category-* 類別（這些類別用 !important 設定顏色）
          const classesToRemove = [];
          slot.classList.forEach(cls => {
            if (cls.startsWith('category-')) {
              classesToRemove.push(cls);
            }
          });
          classesToRemove.forEach(cls => slot.classList.remove(cls));

          // 設定灰色背景
          slot.style.setProperty('background', 'linear-gradient(135deg, #e0e0e0 0%, #c0c0c0 100%)', 'important');
          slot.style.setProperty('box-shadow', '0 2px 4px rgba(0, 0, 0, 0.1)', 'important');
        });

        // 列表式課程也轉為灰色
        const listItems = clonedElement.querySelectorAll('.list-course-item');
        listItems.forEach(item => {
          // 移除 category-* 類別
          const classesToRemove = [];
          item.classList.forEach(cls => {
            if (cls.startsWith('category-')) {
              classesToRemove.push(cls);
            }
          });
          classesToRemove.forEach(cls => item.classList.remove(cls));

          item.style.setProperty('background', '#f5f5f5', 'important');
          item.style.setProperty('border-left-color', '#666', 'important');
        });

        // 表頭也轉為灰色
        const headers = clonedElement.querySelectorAll('th');
        headers.forEach(header => {
          header.style.setProperty('background', 'linear-gradient(135deg, #555 0%, #333 100%)', 'important');
          header.style.setProperty('color', '#fff', 'important');
        });
      }

      contentWrapper.appendChild(clonedElement);

      exportContainer.appendChild(contentWrapper);

      // 臨時添加到 body 中（在視窗外）
      exportContainer.style.position = 'absolute';
      exportContainer.style.left = '-9999px';
      document.body.appendChild(exportContainer);

      const measuredHeight = exportContainer.scrollHeight;
      let desiredHeight = Math.max(measuredHeight, A4_HEIGHT);
      const desiredWidth = Math.round(desiredHeight / 1.414);
      exportContainer.style.height = `${desiredHeight}px`;
      exportContainer.style.width = `${desiredWidth}px`;
      let contentHeight = Math.max(300, desiredHeight - (EXPORT_PADDING * 2));
      contentWrapper.style.height = `${contentHeight}px`;

      if (tableContext) {
        const contentPadding = 32;
        const availableHeight = Math.max(300, contentHeight - contentPadding * 2);
        tableContext.table.style.height = `${availableHeight}px`;

        const thead = tableContext.table.querySelector('thead');
        const theadHeight = thead ? thead.offsetHeight : 0;
        const spacing = 4;
        const heightSafety = 24;
        const totalRows = Math.max(1, tableContext.remainingRows);
        const availableForRows = Math.max(
          0,
          availableHeight - theadHeight - spacing * (totalRows + 2) - heightSafety
        );
        const fitSlotHeight = Math.floor(availableForRows / totalRows);
        const finalSlotHeight = Math.max(46, Math.min(tableContext.baseSlotHeight, fitSlotHeight));
        const heightScale = finalSlotHeight / tableContext.baseSlotHeight;
        const finalSlotPadding = Math.max(6, Math.round(tableContext.baseSlotPadding * heightScale));

        tableContext.slots.forEach(slot => {
          slot.style.minHeight = `${finalSlotHeight}px`;
          slot.style.height = `${finalSlotHeight}px`;
          slot.style.padding = `${finalSlotPadding}px`;
        });

        tableContext.periodLabels.forEach(label => {
          label.style.height = `${finalSlotHeight}px`;
        });

        const nameFontSize = Math.round(tableContext.baseNameFontSize * tableContext.columnScale * heightScale);
        const infoFontSize = Math.round(tableContext.baseInfoFontSize * tableContext.columnScale * heightScale);
        const headerFontSize = Math.round(tableContext.baseHeaderFontSize * tableContext.columnScale * heightScale);

        tableContext.names.forEach(name => {
          name.style.fontSize = `${nameFontSize}px`;
        });

        tableContext.infos.forEach(info => {
          info.style.fontSize = `${infoFontSize}px`;
        });

        tableContext.headers.forEach(headerCell => {
          headerCell.style.fontSize = `${headerFontSize}px`;
        });

        const tableMeasuredHeight = tableContext.table.getBoundingClientRect().height;
        const extraHeightNeeded = tableMeasuredHeight - availableHeight;
        if (extraHeightNeeded > 0) {
          desiredHeight += extraHeightNeeded + 12;
          exportContainer.style.height = `${desiredHeight}px`;
          contentHeight = Math.max(300, desiredHeight - (EXPORT_PADDING * 2));
          contentWrapper.style.height = `${contentHeight}px`;
        }
      }

      // 使用 html2canvas 擷取
      const canvas = await html2canvas(exportContainer, {
        scale: 2, // 2倍解析度，清晰且檔案大小適中
        backgroundColor: null, // 透明背景以保留漸層
        logging: false,
        useCORS: true
      });

      // 移除臨時元素
      document.body.removeChild(exportContainer);

      // 轉換為 blob 並下載
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const date = new Date();
        const exportDateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
        link.download = `NYCU課表_${exportDateStr}.png`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);

        // 恢復按鈕狀態
        exportTimetableBtn.disabled = false;
        exportTimetableBtn.textContent = '📸 匯出圖片';
      }, 'image/png');

    } catch (error) {
      console.error('匯出圖片失敗:', error);
      const errorMsg = error.message || '';
      let userMessage = '匯出圖片失敗';
      if (errorMsg.includes('canvas') || errorMsg.includes('html2canvas')) {
        userMessage += '：畫布渲染失敗，請重新整理頁面後再試';
      } else if (errorMsg.includes('memory') || errorMsg.includes('Memory')) {
        userMessage += '：記憶體不足，請關閉其他分頁後再試';
      } else {
        userMessage += '，請稍後再試';
      }
      alert(userMessage);

      // 恢復按鈕狀態
      exportTimetableBtn.disabled = false;
      exportTimetableBtn.textContent = '📸 匯出圖片';
    }
  }

  // 匯出課表為 iCalendar 格式
  async function exportTimetableAsCalendar() {
    const courses = Object.values(timetable);

    if (courses.length === 0) {
      alert('課表是空的，無法匯出');
      return;
    }

    // 動態計算預設學期開始日期
    function getDefaultSemesterStart() {
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();
      // 2-7月 → 春季學期（2月第3個星期一），8-1月 → 秋季學期（9月第2個星期一）
      const targetMonth = (month >= 2 && month <= 7) ? 1 : 8; // 0-indexed
      const targetYear = (month === 1) ? year : (month >= 8 ? year : year);
      const nthMonday = (month >= 2 && month <= 7) ? 3 : 2;
      const first = new Date(targetYear, targetMonth, 1);
      const firstDay = first.getDay();
      const firstMonday = firstDay <= 1 ? (1 - firstDay + 1) : (8 - firstDay + 1);
      const day = firstMonday + (nthMonday - 1) * 7;
      const d = new Date(targetYear, targetMonth, day);
      return d.toISOString().slice(0, 10);
    }

    // 詢問用戶學期開始日期
    const semesterStart = prompt('請輸入學期開始日期（格式：YYYY-MM-DD）\n學期共16週，將自動計算結束日期', getDefaultSemesterStart());
    if (!semesterStart) return;

    // 驗證日期格式
    if (!/^\d{4}-\d{2}-\d{2}$/.test(semesterStart)) {
      alert('日期格式錯誤，請使用 YYYY-MM-DD 格式');
      return;
    }

    // 自動計算16週後的結束日期
    const startDate = new Date(semesterStart);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + (16 * 7) - 1); // 16週 = 112天，減1因為包含開始日

    const semesterEnd = endDate.toISOString().split('T')[0]; // 格式化為 YYYY-MM-DD

    // 節次時間對應表（NYCU 標準時間）
    const periodTimes = {
      '1': { start: '08:00', end: '08:50' },
      '2': { start: '09:00', end: '09:50' },
      '3': { start: '10:10', end: '11:00' },
      '4': { start: '11:10', end: '12:00' },
      '5': { start: '13:20', end: '14:10' },
      '6': { start: '14:20', end: '15:10' },
      '7': { start: '15:30', end: '16:20' },
      '8': { start: '16:30', end: '17:20' },
      '9': { start: '17:30', end: '18:20' },
      'a': { start: '18:30', end: '19:20' },
      'b': { start: '19:25', end: '20:15' },
      'c': { start: '20:20', end: '21:10' },
      'd': { start: '21:15', end: '22:05' }
    };

    // 星期代碼對應
    const dayMap = {
      'M': 'MO', // Monday
      'T': 'TU', // Tuesday
      'W': 'WE', // Wednesday
      'R': 'TH', // Thursday
      'F': 'FR', // Friday
      'S': 'SA', // Saturday
      'U': 'SU'  // Sunday
    };

    // 生成 iCalendar 內容
    let icsContent = 'BEGIN:VCALENDAR\r\n';
    icsContent += 'VERSION:2.0\r\n';
    icsContent += 'PRODID:-//NYCU Course Helper//EN\r\n';
    icsContent += 'CALSCALE:GREGORIAN\r\n';
    icsContent += 'METHOD:PUBLISH\r\n';
    icsContent += 'X-WR-CALNAME:NYCU 課表\r\n';
    icsContent += 'X-WR-TIMEZONE:Asia/Taipei\r\n';

    // 為每門課程生成事件
    courses.forEach(course => {
      const slots = parseTimeSlots(course.time);

      // 按星期分組時段
      const dayGroups = {};
      slots.forEach(slot => {
        if (!dayGroups[slot.day]) {
          dayGroups[slot.day] = [];
        }
        dayGroups[slot.day].push(...slot.periods);
      });

      // 為每個星期生成一個事件
      Object.entries(dayGroups).forEach(([day, periods]) => {
        if (!dayMap[day]) return; // 跳過無效的星期

        // 排序節次
        const sortedPeriods = periods.sort((a, b) => {
          const order = '123456789abcd';
          return order.indexOf(a) - order.indexOf(b);
        });

        // 找到開始和結束時間
        const firstPeriod = sortedPeriods[0];
        const lastPeriod = sortedPeriods[sortedPeriods.length - 1];

        if (!periodTimes[firstPeriod] || !periodTimes[lastPeriod]) return;

        const startTime = periodTimes[firstPeriod].start;
        const endTime = periodTimes[lastPeriod].end;

        // 計算該星期在學期開始日期的第一次出現
        const startDate = new Date(semesterStart);
        // 轉換為 JavaScript Date.getDay() 格式 (0=Sunday, 1=Monday, ...)
        const dayToNumber = { 'U': 0, 'M': 1, 'T': 2, 'W': 3, 'R': 4, 'F': 5, 'S': 6 };
        const targetDay = dayToNumber[day];
        const currentDay = startDate.getDay();
        let daysToAdd = targetDay - currentDay;
        if (daysToAdd < 0) daysToAdd += 7;
        startDate.setDate(startDate.getDate() + daysToAdd);

        // 格式化日期時間
        const formatDateTime = (date, time) => {
          const [hours, minutes] = time.split(':');
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const dayOfMonth = String(date.getDate()).padStart(2, '0');
          return `${year}${month}${dayOfMonth}T${hours}${minutes}00`;
        };

        // 計算結束日期（UNTIL 格式）
        const untilDate = semesterEnd.replace(/-/g, '') + 'T235959Z';

        // 生成事件
        icsContent += 'BEGIN:VEVENT\r\n';
        icsContent += `UID:${course.code}-${day}-${Date.now()}@nycu.edu.tw\r\n`;
        icsContent += `DTSTART;TZID=Asia/Taipei:${formatDateTime(startDate, startTime)}\r\n`;
        icsContent += `DTEND;TZID=Asia/Taipei:${formatDateTime(startDate, endTime)}\r\n`;
        icsContent += `RRULE:FREQ=WEEKLY;BYDAY=${dayMap[day]};UNTIL=${untilDate}\r\n`;
        icsContent += `SUMMARY:${course.name}\r\n`;

        let description = `課程代碼：${course.code}\\n`;
        if (course.teacher) description += `授課教師：${course.teacher}\\n`;
        if (course.credits) description += `學分：${course.credits}\\n`;
        description += `時間：${course.time}`;
        icsContent += `DESCRIPTION:${description}\r\n`;

        if (course.room) {
          // 解析教室代碼為完整地點
          const rooms = course.room.split(',').map(r => r.trim());
          const parsedRooms = rooms.map(r => parseRoomLocation(r)).join(', ');
          icsContent += `LOCATION:${parsedRooms}\r\n`;
        }

        icsContent += 'END:VEVENT\r\n';
      });
    });

    icsContent += 'END:VCALENDAR\r\n';

    // 下載 .ics 檔案
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `NYCU課表_${semesterStart}_${semesterEnd}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    alert(`日曆檔案已下載！\n學期時間：${semesterStart} ~ ${semesterEnd} (16週)\n\n【建議】先建立新日曆再匯入：\n1. 在 Google Calendar 左側點「其他日曆」旁的 +\n2. 選擇「建立新日曆」，命名為「NYCU 課表」\n3. 再次點擊「其他日曆」旁的 +\n4. 選擇「匯入」\n5. 選擇剛下載的 .ics 檔案\n6. 在「新增至日曆」選擇「NYCU 課表」\n7. 點擊「匯入」\n\n💡 優點：如果要刪除所有課程，只需刪除整個日曆即可！`);
  }

  // ==================== 頁面切換功能 ====================

  // 顯示詳細頁面
  async function showDetailView(course) {
    // 從最新的 courseData 中查找課程資料（以獲取 memo 等欄位）
    let updatedCourse = course;
    try {
      const result = await new Promise(resolve => {
        chrome.storage.local.get(['courseData'], resolve);
      });

      if (result.courseData && Array.isArray(result.courseData)) {
        const latestCourse = findLatestCourse(course, result.courseData);
        if (latestCourse) {
          updatedCourse = { ...course, ...latestCourse };
        }
      }
    } catch (error) {
      console.error('查找最新課程資料失敗:', error);
    }

    // 隱藏列表頁面（包含所有區域）
    searchArea.style.display = 'none';
    bookmarksArea.style.display = 'none';
    timetableArea.classList.remove('active');
    helpArea.classList.remove('active');
    tabButtons.style.display = 'none';
    dataStatusDiv.style.display = 'none';

    // 顯示詳細頁面
    detailPage.style.display = 'block';
    backButton.style.display = 'block';
    pageTitle.textContent = updatedCourse.name;

    // 載入詳細資訊
    detailPageContent.innerHTML = '<div class="details-loading">載入中...</div>';

    // 構建選課路徑 HTML
    let pathsHtml = '';
    if (course.paths && Array.isArray(course.paths) && course.paths.length > 0) {
      pathsHtml = `
        <div class="detail-section">
          <h2 class="detail-section-title">📂 選課路徑</h2>
          <div class="paths-list">
            ${course.paths.map((path, index) => {
              const pathParts = [];
              if (path.type) pathParts.push(path.type);
              if (path.category) pathParts.push(path.category);
              if (path.college) pathParts.push(path.college);
              if (path.department) pathParts.push(path.department);
              pathParts.push('全部');
              const prefix = course.paths.length > 1 ? `${index + 1}. ` : '📍 ';
              return `<div class="course-path">${prefix}${pathParts.join(' / ')}</div>`;
            }).join('')}
          </div>
        </div>
      `;
    }

    // 載入課程詳細資訊（從 API）
    const courseDetailsKey = getCourseDetailsKey(course);
    let detailsHtml = '';

    if (!courseDetailsCache[courseDetailsKey] || isDetailsPartial(courseDetailsCache[courseDetailsKey])) {
      try {
        if (course.cos_id && course.acy && course.sem) {
          // ⭐ 使用正確的 API endpoint（POST 方法）
          const params = new URLSearchParams({
            acy: course.acy,
            sem: course.sem,
            cos_id: course.cos_id
          });

          // 設置 10 秒超時
          const timeout = (ms) => new Promise((_, reject) =>
            setTimeout(() => reject(new Error('請求超時')), ms)
          );

          const [baseResponse, descResponse] = await Promise.race([
            Promise.all([
              fetch('https://timetable.nycu.edu.tw/?r=main/getCrsOutlineBase', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: params.toString()
              }),
              fetch('https://timetable.nycu.edu.tw/?r=main/getCrsOutlineDescription', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: params.toString()
              })
            ]),
            timeout(10000)
          ]);

          // 檢查回應狀態
          if (!baseResponse.ok || !descResponse.ok) {
            throw new Error(`API 請求失敗: ${baseResponse.status} / ${descResponse.status}`);
          }

          const baseData = await baseResponse.json();
          const descData = await descResponse.json();

          const details = extractCourseDetailsFromAPI(baseData, descData, course);

          // 使用 AI 從完整課程綱要提取搜尋關鍵字（僅在 AI 啟用時）
          if (aiEnabled && details) {
            try {
              console.log('🔍 正在從完整課程綱要提取搜尋關鍵字...');
              const keywords = await extractKeywordsFromOutline(details, course.name);
              details.searchKeywords = keywords;
              console.log('✅ 關鍵字提取完成:', keywords.substring(0, 100) + (keywords.length > 100 ? '...' : ''));
            } catch (error) {
              console.warn('⚠️ 提取關鍵字失敗，使用完整概述作為後備:', error);
              details.searchKeywords = details['課程概述'] || '';
            }
          } else if (details && details['課程概述'] && details['課程概述'] !== '未提供') {
            // AI 未啟用時，直接使用完整概述
            details.searchKeywords = details['課程概述'];
          }

          details._partial = false;
          courseDetailsCache[courseDetailsKey] = details;
          saveCourseDetailsCache(); // 儲存到本地
        }
      } catch (error) {
        console.error('載入課程詳細資訊失敗:', error);
      }
    }

    if (courseDetailsCache[courseDetailsKey] && !isDetailsPartial(courseDetailsCache[courseDetailsKey])) {
      detailsHtml = `
        <div class="detail-section">
          <h2 class="detail-section-title">📋 課程詳細資訊</h2>
          ${displayCourseDetailsHTML(courseDetailsCache[courseDetailsKey])}
        </div>
      `;
    }

    // 構建 memo HTML
    let memoHtml = '';
    if (updatedCourse.memo && updatedCourse.memo.trim()) {
      memoHtml = `
        <div class="detail-section">
          <h2 class="detail-section-title">📝 備註</h2>
          <div class="detail-memo-content">${escapeHtml(updatedCourse.memo)}</div>
        </div>
      `;
    }

    // 組合完整內容
    detailPageContent.innerHTML = `
      <div class="detail-page-header">
        <div class="detail-course-code">${escapeHtml(updatedCourse.code)}</div>
        <div class="detail-course-name">${escapeHtml(updatedCourse.name)}</div>
        ${updatedCourse.teacher ? `<div class="detail-course-info">👨‍🏫 授課教師：${escapeHtml(updatedCourse.teacher)}</div>` : ''}
        ${updatedCourse.credits ? `<div class="detail-course-info">📚 學分：${escapeHtml(updatedCourse.credits)}</div>` : ''}
        ${updatedCourse.time ? `<div class="detail-course-info">🕐 時間：${escapeHtml(updatedCourse.time)}</div>` : ''}
        ${updatedCourse.room ? `<div class="detail-course-info">📍 教室：${escapeHtml(updatedCourse.room)}</div>` : ''}
      </div>

      ${memoHtml}
      ${pathsHtml}
      ${detailsHtml}

      <div class="detail-actions">
        ${course.cos_id && course.acy && course.sem ? `
          <button class="detail-outline-btn" id="detailOutlineBtn">📄 開啟課程綱要</button>
        ` : ''}
        ${aiEnabled && courseDetailsCache[courseDetailsKey] && !isDetailsPartial(courseDetailsCache[courseDetailsKey]) && courseDetailsCache[courseDetailsKey]['課程概述'] && courseDetailsCache[courseDetailsKey]['課程概述'] !== '未提供' ? `
          <button class="detail-outline-btn" id="reextractKeywordsBtn" style="background: linear-gradient(135deg, #AB47BC 0%, #7E57C2 100%);">🔄 重新提取關鍵字</button>
        ` : ''}
      </div>
    `;

    // 為課程綱要按鈕添加事件
    const detailOutlineBtn = document.getElementById('detailOutlineBtn');
    if (detailOutlineBtn) {
      detailOutlineBtn.addEventListener('click', function() {
        openCourseOutline(course);
      });
    }

    // 為重新提取關鍵字按鈕添加事件
    const reextractKeywordsBtn = document.getElementById('reextractKeywordsBtn');
    if (reextractKeywordsBtn) {
      reextractKeywordsBtn.addEventListener('click', async function() {
        const btn = this;
        const originalText = btn.textContent;

        try {
          // 禁用按鈕並顯示 loading 狀態
          btn.disabled = true;
          btn.textContent = '⏳ 提取中...';
          btn.style.cursor = 'not-allowed';

          const details = courseDetailsCache[courseDetailsKey];
          if (details) {
            console.log(`🔄 重新從完整課程綱要提取關鍵字: ${course.name}`);

            // 重新提取關鍵字（從完整綱要）
            const keywords = await extractKeywordsFromOutline(details, course.name);
            details.searchKeywords = keywords;

            // 更新緩存
            courseDetailsCache[courseDetailsKey] = details;
            saveCourseDetailsCache();

            console.log(`✅ [${course.name}] 關鍵字重新提取成功: ${keywords.substring(0, 150)}${keywords.length > 150 ? '...' : ''}`);

            // 重新渲染頁面以顯示新的關鍵字
            btn.textContent = '✅ 提取成功！';
            setTimeout(() => {
              showDetailView(course);
            }, 1000);
          }
        } catch (error) {
          console.error(`⚠️ 重新提取關鍵字失敗: ${course.name}`, error);
          btn.textContent = '❌ 提取失敗';
          setTimeout(() => {
            btn.textContent = originalText;
            btn.disabled = false;
            btn.style.cursor = 'pointer';
          }, 2000);
        }
      });
    }
  }

  // 返回列表頁面
  function showListView() {
    // 隱藏詳細頁面
    detailPage.style.display = 'none';
    backButton.style.display = 'none';

    // 顯示列表頁面
    tabButtons.style.display = 'flex';
    dataStatusDiv.style.display = 'block';

    // 恢復到之前的分頁
    if (timetableTab.classList.contains('active')) {
      timetableArea.classList.add('active');
      pageTitle.textContent = '我的課表';
    } else if (helpTab.classList.contains('active')) {
      helpArea.classList.add('active');
      pageTitle.textContent = '使用說明';
    } else if (bookmarksTab.classList.contains('active')) {
      bookmarksArea.style.display = 'block';
      pageTitle.textContent = '收藏清單';
    } else {
      searchArea.style.display = 'block';
      pageTitle.textContent = 'NYCU 選課助手';
    }
  }


  // 從 API 資料中提取課程詳細資訊
  function extractCourseDetailsFromAPI(baseData, descData, course) {
    // ⭐ 處理 baseData 可能是陣列的情況
    let base = baseData;
    if (Array.isArray(baseData) && baseData.length > 0) {
      base = baseData[0];
    }

    // ⭐ 防禦性檢查：確保 base 是有效物件
    if (!base || typeof base !== 'object') {
      console.warn('⚠️ base 資料無效，使用空物件作為後備');
      base = {};
    }

    // 處理 descData 可能是 false 或陣列的情況
    let desc = {};
    if (descData && typeof descData === 'object') {
      if (Array.isArray(descData) && descData.length > 0) {
        desc = descData[0];
      } else if (!Array.isArray(descData)) {
        desc = descData;
      }
    }

    // 解析時間地點
    let timeLocation = '未提供';
    if (base.cos_time) {
      // 解析時間格式：M56R2-EC115[GF],Rabc-EC315[GF]
      const timeParts = base.cos_time.split(',').map(part => {
        const match = part.match(/^([A-Z]+\d*)-([A-Z0-9]+)/);
        if (match) {
          const time = match[1]; // M56R2 或 Rabc
          const room = match[2]; // EC115
          return `${time} @ ${room}`;
        }
        return part;
      });
      timeLocation = timeParts.join(', ');
    }

    const details = {
      時間地點: timeLocation,
      學分: base.cos_credit || course.credits || '未提供',
      必選修: base.sel_type_name || '未提供',
      授課教師: base.tea_name || course.teacher || '未提供',
      先修科目: desc.crs_prerequisite || '未提供',
      課程概述: desc.crs_outline || '未提供',
      教科書: desc.crs_textbook || '未提供',
      評量方式: desc.crs_exam_score || '未提供',
      教學方法: desc.crs_teach_method || '未提供',
      師生晤談: desc.crs_meeting_time && desc.crs_meeting_place
        ? `${desc.crs_meeting_time} @ ${desc.crs_meeting_place}`
        : '未提供',
      聯絡方式: desc.crs_contact || '未提供',
      備註: course.memo || desc.crs_remark || base.cos_remark || '未提供'
    };

    return details;
  }

  // 生成課程詳細資訊 HTML
  function displayCourseDetailsHTML(details) {
    return `
      <div class="details-content">
        <div class="details-subsection">
          <div class="details-subtitle">基本資訊</div>
          <div class="details-grid">
            <div class="detail-item" style="grid-column: 1 / -1;">
              <span class="detail-label">時間地點：</span>
              <span class="detail-value">${escapeHtml(details.時間地點)}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">學分：</span>
              <span class="detail-value">${escapeHtml(details.學分)}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">必選修：</span>
              <span class="detail-value ${getRequiredClass(details.必選修)}">${escapeHtml(details.必選修)}</span>
            </div>
          </div>
        </div>

        ${details.先修科目 !== '未提供' ? `
        <div class="details-subsection">
          <div class="details-subtitle">📚 先修科目或先備能力</div>
          <div class="detail-text">${escapeHtml(details.先修科目)}</div>
        </div>
        ` : ''}

        ${details.課程概述 !== '未提供' ? `
        <div class="details-subsection">
          <div class="details-subtitle">🎯 課程概述與目標</div>
          <div class="detail-text">${escapeHtml(details.課程概述)}</div>
        </div>
        ` : ''}

        ${details.searchKeywords && details.searchKeywords !== '' ? `
        <div class="details-subsection">
          <div class="details-subtitle">🤖 AI 提取的搜尋關鍵字</div>
          <div class="detail-text" style="background: #f0f7ff; padding: 12px; border-radius: 6px; border-left: 3px solid #4a90e2;">${escapeHtml(details.searchKeywords)}</div>
        </div>
        ` : ''}

        ${details.教科書 !== '未提供' ? `
        <div class="details-subsection">
          <div class="details-subtitle">📖 教科書</div>
          <div class="detail-text">${escapeHtml(details.教科書)}</div>
        </div>
        ` : ''}

        ${details.評量方式 !== '未提供' ? `
        <div class="details-subsection">
          <div class="details-subtitle">📊 評量方式</div>
          <div class="detail-text">${escapeHtml(details.評量方式)}</div>
        </div>
        ` : ''}

        ${details.教學方法 !== '未提供' ? `
        <div class="details-subsection">
          <div class="details-subtitle">🎓 教學方法</div>
          <div class="detail-text">${details.教學方法}</div>
        </div>
        ` : ''}

        ${details.師生晤談 !== '未提供' ? `
        <div class="details-subsection">
          <div class="details-subtitle">👥 師生晤談時間</div>
          <div class="detail-text">${details.師生晤談}</div>
        </div>
        ` : ''}

        ${details.聯絡方式 !== '未提供' ? `
        <div class="details-subsection">
          <div class="details-subtitle">📧 聯絡方式</div>
          <div class="detail-text">${details.聯絡方式}</div>
        </div>
        ` : ''}
      </div>
    `;
  }

  // 根據必選修狀態返回 CSS class
  function getRequiredClass(required) {
    // 防禦性檢查：確保 required 是字串
    if (!required || typeof required !== 'string') {
      return '';
    }

    if (required.includes('必修')) {
      return 'required-course';
    } else if (required.includes('選修')) {
      return 'elective-course';
    }
    return '';
  }

  // ==================== 課程快速資訊彈窗 ====================

  // 顯示課程格子選項選單
  function showCourseSlotMenu(course, slotKey, event) {
    // 移除已存在的選單
    const existingMenu = document.querySelector('.course-slot-menu');
    if (existingMenu) {
      existingMenu.remove();
    }

    // 解析 slotKey 獲取 day 和 period
    const [day, period] = slotKey.split('-');

    // 創建選單
    const menu = document.createElement('div');
    menu.className = 'course-slot-menu';
    menu.innerHTML = `
      <div class="course-slot-menu-item" data-action="details">
        <span class="menu-icon">📋</span>
        <span>查看課程詳細資料</span>
      </div>
      <div class="course-slot-menu-item" data-action="slot">
        <span class="menu-icon">🕐</span>
        <span>查看此時段課程</span>
      </div>
    `;

    // 設置位置
    const rect = event.target.closest('td').getBoundingClientRect();
    const containerRect = document.body.getBoundingClientRect();

    menu.style.position = 'fixed';
    menu.style.left = `${rect.left}px`;
    menu.style.top = `${rect.bottom + 4}px`;
    menu.style.zIndex = '10001';

    // 添加到頁面
    document.body.appendChild(menu);

    // 確保選單不超出視窗
    requestAnimationFrame(() => {
      const menuRect = menu.getBoundingClientRect();
      if (menuRect.right > window.innerWidth) {
        menu.style.left = `${window.innerWidth - menuRect.width - 10}px`;
      }
      if (menuRect.bottom > window.innerHeight) {
        menu.style.top = `${rect.top - menuRect.height - 4}px`;
      }
    });

    // 處理選單項目點擊
    menu.querySelectorAll('.course-slot-menu-item').forEach(item => {
      item.addEventListener('click', function(e) {
        e.stopPropagation();
        const action = this.dataset.action;
        menu.remove();

        if (action === 'details') {
          showCourseModal(course);
        } else if (action === 'slot') {
          showSlotCoursesModal(day, period);
        }
      });
    });

    // 點擊其他地方關閉選單
    const closeMenu = (e) => {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      }
    };

    // 延遲添加監聽器，避免立即觸發
    setTimeout(() => {
      document.addEventListener('click', closeMenu);
    }, 0);
  }

  // 顯示時段可選課程彈窗
  async function showSlotCoursesModal(day, period) {
    // 取得所有課程資料
    const result = await new Promise(resolve => {
      chrome.storage.local.get(['courseData'], resolve);
    });

    if (!result.courseData || !Array.isArray(result.courseData)) {
      alert('無課程資料');
      return;
    }

    // 找出該時段的所有課程
    const availableCourses = [];
    result.courseData.forEach(course => {
      const slots = parseTimeSlots(course.time);
      slots.forEach(slot => {
        if (slot.day === day && slot.periods.includes(period)) {
          // 避免重複
          if (!availableCourses.find(c => getCourseKey(c) === getCourseKey(course))) {
            availableCourses.push(course);
          }
        }
      });
    });

    // 星期名稱對應
    const dayNames = { 'M': '一', 'T': '二', 'W': '三', 'R': '四', 'F': '五', 'S': '六', 'U': '日' };
    const dayName = dayNames[day] || day;

    // 創建彈窗遮罩
    const overlay = document.createElement('div');
    overlay.className = 'course-modal-overlay';

    // 創建彈窗
    const modal = document.createElement('div');
    modal.className = 'course-modal slot-courses-modal';

    // 彈窗內容 - 列表視圖
    let coursesHTML = '';
    if (availableCourses.length === 0) {
      coursesHTML = '<div class="no-courses-hint">此時段沒有可選課程</div>';
    } else {
      coursesHTML = '<div class="slot-courses-list">';
      availableCourses.forEach((course, index) => {
        const courseKey = getCourseKey(course);
        const isInTimetable = !!timetable[courseKey];
        const category = getCourseCategory(course);

        const isBookmarked = !!bookmarks[courseKey];
        coursesHTML += `
          <div class="slot-course-item category-${category}" data-course-index="${index}">
            <button class="slot-bookmark-btn ${isBookmarked ? 'bookmarked' : ''}" data-course-index="${index}" title="${isBookmarked ? '移除書籤' : '加入書籤'}">
              ${isBookmarked ? '★' : '☆'}
            </button>
            <div class="slot-course-item-left">
              <div class="course-code">${escapeHtml(course.code)}</div>
              <div class="course-name">${escapeHtml(course.name)}</div>
              ${course.teacher ? `<div class="course-info">👨‍🏫 ${escapeHtml(course.teacher)}</div>` : ''}
              ${course.time ? `<div class="course-info">🕐 ${escapeHtml(course.time)}</div>` : ''}
              ${course.room ? `<div class="course-info">📍 ${escapeHtml(course.room)}</div>` : ''}
              ${course.credits ? `<div class="course-info">📚 ${escapeHtml(course.credits)} 學分</div>` : ''}
            </div>
            <div class="slot-course-item-right">
              <button class="slot-course-rating-btn" data-course-index="${index}" title="在 OPT 歐趴糖查看課程評價">
                📊 歐趴糖
              </button>
              <button class="slot-course-add-btn ${isInTimetable ? 'in-timetable' : ''}" data-course-index="${index}">
                ${isInTimetable ? '✓ 已加入' : '+ 加入課表'}
              </button>
            </div>
          </div>
        `;
      });
      coursesHTML += '</div>';
    }

    modal.innerHTML = `
      <div class="course-modal-header">
        <button class="course-modal-back" style="display: none;">←</button>
        <div class="course-modal-title">
          <div class="course-modal-name">週${dayName} 第${period}節 可選課程</div>
          <div class="course-modal-subtitle">共 ${availableCourses.length} 門課程</div>
        </div>
        <button class="course-modal-close">×</button>
      </div>
      <div class="slot-search-box">
        <input type="text" class="slot-search-input" placeholder="搜尋課程名稱、代碼、教師...">
        <button class="slot-filter-toggle-btn" title="進階篩選">
          <span class="filter-icon">⚙</span>
          <span class="filter-text">篩選</span>
        </button>
        <span class="slot-search-count"></span>
      </div>
      <div class="slot-filter-panel" style="display: none;">
        <div class="slot-filter-sections">
          <div class="slot-filter-section">
            <div class="slot-filter-title">課程類型</div>
            <div class="slot-filter-options">
              <label class="slot-filter-checkbox"><input type="checkbox" class="slot-filter-type" value="required"><span>必修</span></label>
              <label class="slot-filter-checkbox"><input type="checkbox" class="slot-filter-type" value="elective"><span>選修</span></label>
              <label class="slot-filter-checkbox"><input type="checkbox" class="slot-filter-type" value="general"><span>通識</span></label>
              <label class="slot-filter-checkbox"><input type="checkbox" class="slot-filter-type" value="physical"><span>體育</span></label>
              <label class="slot-filter-checkbox"><input type="checkbox" class="slot-filter-type" value="language"><span>外語</span></label>
              <label class="slot-filter-checkbox"><input type="checkbox" class="slot-filter-type" value="military"><span>軍訓</span></label>
            </div>
          </div>
          <div class="slot-filter-section">
            <div class="slot-filter-title">學分數</div>
            <div class="slot-filter-options">
              <label class="slot-filter-checkbox"><input type="checkbox" class="slot-filter-credits" value="0"><span>0</span></label>
              <label class="slot-filter-checkbox"><input type="checkbox" class="slot-filter-credits" value="1"><span>1</span></label>
              <label class="slot-filter-checkbox"><input type="checkbox" class="slot-filter-credits" value="2"><span>2</span></label>
              <label class="slot-filter-checkbox"><input type="checkbox" class="slot-filter-credits" value="3"><span>3</span></label>
              <label class="slot-filter-checkbox"><input type="checkbox" class="slot-filter-credits" value="4+"><span>4+</span></label>
            </div>
          </div>
        </div>
        <div class="slot-filter-actions">
          <button class="slot-filter-clear-btn">清除篩選</button>
        </div>
      </div>
      <div class="course-modal-body">
        <div class="slot-list-view">
          ${coursesHTML}
        </div>
        <div class="slot-detail-view" style="display: none;">
        </div>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // 取得元素
    const backBtn = modal.querySelector('.course-modal-back');
    const closeBtn = modal.querySelector('.course-modal-close');
    const modalTitle = modal.querySelector('.course-modal-title');
    const listView = modal.querySelector('.slot-list-view');
    const detailView = modal.querySelector('.slot-detail-view');
    const searchInput = modal.querySelector('.slot-search-input');
    const searchCount = modal.querySelector('.slot-search-count');
    const searchBox = modal.querySelector('.slot-search-box');
    const filterToggleBtn = modal.querySelector('.slot-filter-toggle-btn');
    const filterPanel = modal.querySelector('.slot-filter-panel');
    const filterClearBtn = modal.querySelector('.slot-filter-clear-btn');

    // 記錄列表滾動位置和當前課程索引
    let lastScrollPosition = 0;
    let lastCourseIndex = 0;

    // 取得當前篩選條件
    function getFilterConditions() {
      const typeFilters = Array.from(modal.querySelectorAll('.slot-filter-type:checked')).map(cb => cb.value);
      const creditFilters = Array.from(modal.querySelectorAll('.slot-filter-credits:checked')).map(cb => cb.value);
      return { types: typeFilters, credits: creditFilters };
    }

    // 檢查課程是否符合篩選條件
    function matchesFilters(course, filters) {
      // 課程類型篩選
      if (filters.types.length > 0) {
        const category = getCourseCategory(course);
        if (!filters.types.includes(category)) {
          return false;
        }
      }

      // 學分數篩選
      if (filters.credits.length > 0) {
        const credits = parseInt(course.credits) || 0;
        let creditMatch = false;
        for (const filter of filters.credits) {
          if (filter === '4+') {
            if (credits >= 4) creditMatch = true;
          } else {
            if (credits === parseInt(filter)) creditMatch = true;
          }
        }
        if (!creditMatch) return false;
      }

      return true;
    }

    // 搜尋過濾功能（結合關鍵字和進階篩選）
    function filterCourses() {
      const items = listView.querySelectorAll('.slot-course-item');
      const lowerKeyword = searchInput.value.toLowerCase().trim();
      const filters = getFilterConditions();
      const hasFilters = filters.types.length > 0 || filters.credits.length > 0;
      let visibleCount = 0;

      items.forEach((item, index) => {
        const course = availableCourses[index];
        let show = true;

        // 關鍵字篩選
        if (lowerKeyword) {
          const searchText = [
            course.name || '',
            course.code || '',
            course.teacher || '',
            course.room || '',
            course.dep_name || ''
          ].join(' ').toLowerCase();
          if (!searchText.includes(lowerKeyword)) {
            show = false;
          }
        }

        // 進階篩選
        if (show && hasFilters) {
          if (!matchesFilters(course, filters)) {
            show = false;
          }
        }

        item.style.display = show ? '' : 'none';
        if (show) visibleCount++;
      });

      // 更新搜尋結果計數
      if (lowerKeyword || hasFilters) {
        searchCount.textContent = `${visibleCount} / ${availableCourses.length}`;
      } else {
        searchCount.textContent = '';
      }

      // 更新篩選按鈕狀態
      filterToggleBtn.classList.toggle('active', hasFilters);
    }

    // 篩選面板切換
    filterToggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = filterPanel.style.display !== 'none';
      filterPanel.style.display = isVisible ? 'none' : 'block';
      filterToggleBtn.classList.toggle('expanded', !isVisible);
    });

    // 清除篩選
    filterClearBtn.addEventListener('click', () => {
      modal.querySelectorAll('.slot-filter-type, .slot-filter-credits').forEach(cb => {
        cb.checked = false;
      });
      filterCourses();
    });

    // 篩選選項變更事件
    modal.querySelectorAll('.slot-filter-type, .slot-filter-credits').forEach(cb => {
      cb.addEventListener('change', filterCourses);
    });

    // 搜尋框事件
    searchInput.addEventListener('input', filterCourses);

    // 防止搜尋框點擊事件冒泡
    searchInput.addEventListener('click', (e) => e.stopPropagation());

    // 關閉按鈕事件
    closeBtn.addEventListener('click', () => {
      document.body.removeChild(overlay);
    });

    // 點擊遮罩關閉
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        document.body.removeChild(overlay);
      }
    });

    // 返回按鈕事件
    backBtn.addEventListener('click', () => {
      // 切換回列表視圖
      detailView.style.display = 'none';
      listView.style.display = 'block';
      searchBox.style.display = 'flex';
      backBtn.style.display = 'none';
      modalTitle.innerHTML = `
        <div class="course-modal-name">週${dayName} 第${period}節 可選課程</div>
        <div class="course-modal-subtitle">共 ${availableCourses.length} 門課程</div>
      `;

      // 恢復滾動位置到課程卡片
      setTimeout(() => {
        const targetItem = listView.querySelector(`[data-course-index="${lastCourseIndex}"]`);
        if (targetItem) {
          targetItem.scrollIntoView({ behavior: 'auto', block: 'center' });
        }
      }, 0);
    });

    // 顯示詳細資訊的函數
    async function showDetailInModal(course, courseIndex) {
      // 記錄當前位置
      lastCourseIndex = courseIndex;

      // 切換到詳細視圖
      listView.style.display = 'none';
      detailView.style.display = 'block';
      searchBox.style.display = 'none';
      filterPanel.style.display = 'none';
      filterToggleBtn.classList.remove('expanded');
      backBtn.style.display = 'block';
      modalTitle.innerHTML = `
        <div class="course-modal-name">${escapeHtml(course.name)}</div>
        <div class="course-modal-subtitle">${escapeHtml(course.code)}</div>
      `;

      // 顯示載入中
      detailView.innerHTML = '<div class="details-loading">載入中...</div>';

      // 從最新的 courseData 中查找課程資料
      let updatedCourse = course;
      try {
        if (result.courseData && Array.isArray(result.courseData)) {
          const latestCourse = findLatestCourse(course, result.courseData);
          if (latestCourse) {
            updatedCourse = { ...course, ...latestCourse };
          }
        }
      } catch (error) {
        console.error('查找最新課程資料失敗:', error);
      }

      // 構建選課路徑 HTML
      let pathsHtml = '';
      if (updatedCourse.paths && Array.isArray(updatedCourse.paths) && updatedCourse.paths.length > 0) {
        pathsHtml = `
          <div class="detail-section">
            <h2 class="detail-section-title">📂 選課路徑</h2>
            <div class="paths-list">
              ${updatedCourse.paths.map((path, index) => {
                const pathParts = [];
                if (path.type) pathParts.push(path.type);
                if (path.category) pathParts.push(path.category);
                if (path.college) pathParts.push(path.college);
                if (path.department) pathParts.push(path.department);
                pathParts.push('全部');
                const prefix = updatedCourse.paths.length > 1 ? `${index + 1}. ` : '📍 ';
                return `<div class="course-path">${prefix}${pathParts.join(' / ')}</div>`;
              }).join('')}
            </div>
          </div>
        `;
      }

      // 載入課程詳細資訊（從 API）
      const courseKey = getCourseKey(updatedCourse);
      const courseDetailsKey = getCourseDetailsKey(updatedCourse);
      let detailsHtml = '';

      if (!courseDetailsCache[courseDetailsKey] || isDetailsPartial(courseDetailsCache[courseDetailsKey])) {
        try {
          if (updatedCourse.cos_id && updatedCourse.acy && updatedCourse.sem) {
            const params = new URLSearchParams({
              acy: updatedCourse.acy,
              sem: updatedCourse.sem,
              cos_id: updatedCourse.cos_id
            });

            const timeout = (ms) => new Promise((_, reject) =>
              setTimeout(() => reject(new Error('請求超時')), ms)
            );

            const [baseResponse, descResponse] = await Promise.race([
              Promise.all([
                fetch('https://timetable.nycu.edu.tw/?r=main/getCrsOutlineBase', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                  body: params.toString()
                }),
                fetch('https://timetable.nycu.edu.tw/?r=main/getCrsOutlineDescription', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                  body: params.toString()
                })
              ]),
              timeout(10000)
            ]);

            if (baseResponse.ok && descResponse.ok) {
              const baseData = await baseResponse.json();
              const descData = await descResponse.json();
              const details = extractCourseDetailsFromAPI(baseData, descData, updatedCourse);
              if (details) {
                details._partial = false;
                courseDetailsCache[courseDetailsKey] = details;
                saveCourseDetailsCache();
              }
            }
          }
        } catch (error) {
          console.error('載入課程詳細資訊失敗:', error);
        }
      }

      if (courseDetailsCache[courseDetailsKey] && !isDetailsPartial(courseDetailsCache[courseDetailsKey])) {
        detailsHtml = `
          <div class="detail-section">
            <h2 class="detail-section-title">📋 課程詳細資訊</h2>
            ${displayCourseDetailsHTML(courseDetailsCache[courseDetailsKey])}
          </div>
        `;
      }

      // 構建 memo HTML
      let memoHtml = '';
      if (updatedCourse.memo && updatedCourse.memo.trim()) {
        memoHtml = `
          <div class="detail-section">
            <h2 class="detail-section-title">📝 備註</h2>
            <div class="detail-memo-content">${escapeHtml(updatedCourse.memo)}</div>
          </div>
        `;
      }

      // 檢查是否已在課表中
      const isInTimetable = !!timetable[courseKey];

      // 組合完整內容
      detailView.innerHTML = `
        <div class="detail-page-header">
          <div class="detail-course-code">${escapeHtml(updatedCourse.code)}</div>
          <div class="detail-course-name">${escapeHtml(updatedCourse.name)}</div>
          ${updatedCourse.teacher ? `<div class="detail-course-info">👨‍🏫 授課教師：${escapeHtml(updatedCourse.teacher)}</div>` : ''}
          ${updatedCourse.time ? `<div class="detail-course-info">🕐 時間：${escapeHtml(updatedCourse.time)}</div>` : ''}
          ${updatedCourse.room ? `<div class="detail-course-info">📍 教室：${escapeHtml(updatedCourse.room)}</div>` : ''}
          ${updatedCourse.credits ? `<div class="detail-course-info">📚 學分：${escapeHtml(updatedCourse.credits)}</div>` : ''}
        </div>

        ${memoHtml}
        ${pathsHtml}
        ${detailsHtml}

        <div class="detail-actions">
          <button class="slot-detail-add-btn ${isInTimetable ? 'in-timetable' : ''}">
            ${isInTimetable ? '✓ 已加入課表' : '+ 加入課表'}
          </button>
          ${updatedCourse.cos_id && updatedCourse.acy && updatedCourse.sem ? `
            <button class="detail-outline-btn slot-detail-outline-btn">📄 開啟課程綱要</button>
          ` : ''}
        </div>
      `;

      // 為加入課表按鈕添加事件
      const addBtn = detailView.querySelector('.slot-detail-add-btn');
      if (addBtn) {
        addBtn.addEventListener('click', function() {
          if (timetable[courseKey]) {
            if (confirm(`確定要從課表移除「${updatedCourse.name}」嗎？`)) {
              removeFromTimetable(updatedCourse);
              // 更新按鈕狀態
              this.classList.remove('in-timetable');
              this.textContent = '+ 加入課表';
              // 背景更新課表顯示
              displayTimetable();
            }
          } else {
            if (addToTimetable(updatedCourse)) {
              // 更新按鈕狀態
              this.classList.add('in-timetable');
              this.textContent = '✓ 已加入課表';
              // 背景更新課表顯示
              displayTimetable();
            }
          }
        });
      }

      // 為課程綱要按鈕添加事件
      const outlineBtn = detailView.querySelector('.slot-detail-outline-btn');
      if (outlineBtn) {
        outlineBtn.addEventListener('click', function() {
          openCourseOutline(updatedCourse);
        });
      }
    }

    // 為「書籤」按鈕添加事件
    const bookmarkBtns = modal.querySelectorAll('.slot-bookmark-btn');
    bookmarkBtns.forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.stopPropagation(); // 防止觸發父元素的點擊事件
        const courseIndex = parseInt(this.dataset.courseIndex);
        const course = availableCourses[courseIndex];
        const courseKey = getCourseKey(course);

        toggleBookmark(course);

        // 更新按鈕狀態
        const isNowBookmarked = !!bookmarks[courseKey];
        this.classList.toggle('bookmarked', isNowBookmarked);
        this.textContent = isNowBookmarked ? '★' : '☆';
        this.title = isNowBookmarked ? '移除書籤' : '加入書籤';

        // 更新書籤計數
        updateBookmarkCount();
      });
    });

    // 為「查看歐趴糖評價」按鈕添加事件
    const ratingBtns = modal.querySelectorAll('.slot-course-rating-btn');
    ratingBtns.forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.stopPropagation(); // 防止觸發父元素的點擊事件
        const courseIndex = parseInt(this.dataset.courseIndex);
        const course = availableCourses[courseIndex];
        openOPTRating(course);
      });
    });

    // 為加入課表按鈕添加事件
    const addBtns = modal.querySelectorAll('.slot-course-add-btn');
    addBtns.forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.stopPropagation(); // 防止觸發父元素的點擊事件
        const courseIndex = parseInt(this.dataset.courseIndex);
        const course = availableCourses[courseIndex];
        const courseKey = getCourseKey(course);

        if (timetable[courseKey]) {
          // 已在課表中，執行移除
          if (confirm(`確定要從課表移除「${course.name}」嗎？`)) {
            removeFromTimetable(course);
            // 更新按鈕狀態
            this.classList.remove('in-timetable');
            this.textContent = '+ 加入課表';
            // 背景更新課表顯示
            displayTimetable();
          }
        } else {
          // 不在課表中，執行加入
          if (addToTimetable(course)) {
            // 更新按鈕狀態
            this.classList.add('in-timetable');
            this.textContent = '✓ 已加入';
            // 背景更新課表顯示
            displayTimetable();
          }
        }
      });
    });

    // 為課程卡片添加點擊事件（顯示詳細資訊）
    const courseItems = modal.querySelectorAll('.slot-course-item');
    courseItems.forEach(item => {
      item.addEventListener('click', function() {
        const courseIndex = parseInt(this.dataset.courseIndex);
        const course = availableCourses[courseIndex];
        showDetailInModal(course, courseIndex);
      });
    });
  }

  async function showCourseModal(course) {
    // 從最新的 courseData 中查找課程資料（以獲取 memo 等欄位）
    let updatedCourse = course;
    try {
      const result = await new Promise(resolve => {
        chrome.storage.local.get(['courseData'], resolve);
      });

      if (result.courseData && Array.isArray(result.courseData)) {
        const latestCourse = findLatestCourse(course, result.courseData);
        if (latestCourse) {
          // 合併最新資料到課程物件中（保留原有資料，只補充缺失的欄位）
          updatedCourse = { ...course, ...latestCourse };
        }
      }
    } catch (error) {
      console.error('查找最新課程資料失敗:', error);
    }

    // 創建彈窗遮罩
    const overlay = document.createElement('div');
    overlay.className = 'course-modal-overlay';

    // 創建彈窗
    const modal = document.createElement('div');
    modal.className = 'course-modal';

    // 彈窗內容
    modal.innerHTML = `
      <div class="course-modal-header">
        <div class="course-modal-title">
          <div class="course-modal-code">${escapeHtml(updatedCourse.code)}</div>
          <div class="course-modal-name">${escapeHtml(updatedCourse.name)}</div>
          ${updatedCourse.teacher ? `<div class="course-modal-teacher">👨‍🏫 ${escapeHtml(updatedCourse.teacher)}</div>` : ''}
        </div>
        <button class="course-modal-close">×</button>
      </div>
      <div class="course-modal-body">
        <div class="course-modal-loading">載入中...</div>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // 關閉按鈕事件
    const closeBtn = modal.querySelector('.course-modal-close');
    closeBtn.addEventListener('click', () => {
      document.body.removeChild(overlay);
    });

    // 點擊遮罩關閉
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        document.body.removeChild(overlay);
      }
    });

    // 載入課程詳細資訊（使用更新後的課程資料）
    const courseDetailsKey = getCourseDetailsKey(updatedCourse);
    const bodyDiv = modal.querySelector('.course-modal-body');

    // 檢查快取
    if (!courseDetailsCache[courseDetailsKey] || isDetailsPartial(courseDetailsCache[courseDetailsKey])) {
      try {
        if (updatedCourse.cos_id && updatedCourse.acy && updatedCourse.sem) {
          // ⭐ 使用正確的 API endpoint（POST 方法）
          const params = new URLSearchParams({
            acy: updatedCourse.acy,
            sem: updatedCourse.sem,
            cos_id: updatedCourse.cos_id
          });

          // 設置 10 秒超時
          const timeout = (ms) => new Promise((_, reject) =>
            setTimeout(() => reject(new Error('請求超時')), ms)
          );

          const [baseResponse, descResponse] = await Promise.race([
            Promise.all([
              fetch('https://timetable.nycu.edu.tw/?r=main/getCrsOutlineBase', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: params.toString()
              }),
              fetch('https://timetable.nycu.edu.tw/?r=main/getCrsOutlineDescription', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: params.toString()
              })
            ]),
            timeout(10000)
          ]);

          // 檢查回應狀態
          if (!baseResponse.ok || !descResponse.ok) {
            throw new Error(`API 請求失敗: ${baseResponse.status} / ${descResponse.status}`);
          }

          const baseData = await baseResponse.json();
          const descData = await descResponse.json();

          const details = extractCourseDetailsFromAPI(baseData, descData, updatedCourse);

          // 使用 AI 從完整課程綱要提取搜尋關鍵字
          if (details) {
            try {
              const keywords = await extractKeywordsFromOutline(details, updatedCourse.name);
              details.searchKeywords = keywords;
            } catch (error) {
              console.warn('提取關鍵字失敗，使用完整概述作為後備:', error);
              details.searchKeywords = details['課程概述'] || '';
            }
          }

          details._partial = false;
          courseDetailsCache[courseDetailsKey] = details;
          saveCourseDetailsCache(); // 儲存到本地
        }
      } catch (error) {
        console.error('載入課程詳細資訊失敗:', error);
        const errorMessage = error.message || '未知錯誤';
        const isNetworkError = errorMessage.includes('fetch') || errorMessage.includes('network') || errorMessage.includes('Failed to fetch');
        bodyDiv.innerHTML = `<div class="course-modal-error">
          載入失敗${isNetworkError ? '（網路連線問題）' : ''}
          <br><small style="opacity: 0.7;">請檢查網路連線後重試</small>
        </div>`;
        return;
      }
    }

    // 顯示資訊
    if (courseDetailsCache[courseDetailsKey] && !isDetailsPartial(courseDetailsCache[courseDetailsKey])) {
      const details = courseDetailsCache[courseDetailsKey];

      // 如果 updatedCourse 有 memo 但快取中的備註是「未提供」，更新快取
      if (updatedCourse.memo && details.備註 === '未提供') {
        details.備註 = updatedCourse.memo;
        courseDetailsCache[courseDetailsKey] = details;
        saveCourseDetailsCache();
      }

      // 評量方式（格式化顯示）
      let gradingHTML = '';
      if (details.評量方式 && details.評量方式 !== '未提供') {
        const formattedGrading = formatGradingText(details.評量方式);
        gradingHTML = `
          <div class="course-modal-grading">
            <div class="course-modal-grading-title">📊 評量方式</div>
            <div style="padding: 8px 12px; background: #f9f9f9; border-radius: 6px; font-size: 13px; color: #555; line-height: 1.8;">
              ${formattedGrading}
            </div>
          </div>
        `;
      }

      // AI 提取的關鍵字
      let keywordsHTML = '';
      if (details.searchKeywords && details.searchKeywords !== '') {
        keywordsHTML = `
          <div class="course-modal-keywords">
            <div class="course-modal-keywords-title">🤖 AI 提取的搜尋關鍵字</div>
            <div style="padding: 12px; background: #f0f7ff; border-radius: 6px; border-left: 3px solid #4a90e2; font-size: 13px; color: #333; line-height: 1.8;">
              ${details.searchKeywords}
            </div>
          </div>
        `;
      }

      // 處理備註（從課程綱要描述中提取）
      let noteHTML = '';
      if (details.備註 && details.備註 !== '未提供') {
        noteHTML = `
          <div class="course-modal-note">
            <div class="course-modal-note-title">📌 備註</div>
            <div class="course-modal-note-content">${escapeHtml(details.備註)}</div>
          </div>
        `;
      }

      bodyDiv.innerHTML = `
        <div class="course-modal-info-grid">
          <div class="course-modal-info-item">
            <div class="course-modal-info-label">必選修</div>
            <div class="course-modal-info-value ${getRequiredClass(details.必選修)}">${escapeHtml(details.必選修)}</div>
          </div>
          <div class="course-modal-info-item">
            <div class="course-modal-info-label">學分數</div>
            <div class="course-modal-info-value">${escapeHtml(details.學分)}</div>
          </div>
        </div>
        ${gradingHTML}
        ${keywordsHTML}
        ${noteHTML}
      `;
    } else {
      bodyDiv.innerHTML = `
        <div class="course-modal-info-grid">
          <div class="course-modal-info-item">
            <div class="course-modal-info-label">學分數</div>
            <div class="course-modal-info-value">${escapeHtml(updatedCourse.credits || '未提供')}</div>
          </div>
        </div>
        <div class="course-modal-error">無法載入詳細資訊</div>
      `;
    }
  }

  // 格式化評量方式文字
  function formatGradingText(gradingText) {
    if (!gradingText || gradingText === '未提供') {
      return gradingText;
    }

    // 將文字按換行分割
    let lines = gradingText.split('\n').map(line => line.trim()).filter(line => line);

    // 如果沒有換行，嘗試按句號分割（處理連續文字的情況）
    if (lines.length === 1) {
      // 尋找包含百分比的獨立項目（例如：項目: 20%）
      const items = [];
      let currentItem = '';
      let lastIndex = 0;

      // 使用正則找出所有百分比位置
      const percentMatches = [...gradingText.matchAll(/(\d+(?:\.\d+)?%)/g)];

      if (percentMatches.length > 0) {
        percentMatches.forEach((match, index) => {
          const endPos = match.index + match[0].length;

          // 找到百分比後面的句號、換行或下一個大寫字母作為分隔點
          let nextSplitPos = gradingText.length;

          // 尋找下一個分隔點
          if (index < percentMatches.length - 1) {
            // 在當前百分比和下一個百分比之間尋找分隔點
            const textBetween = gradingText.substring(endPos, percentMatches[index + 1].index);
            const splitMatch = textBetween.match(/[.。]\s*(?=[A-Z])|[.。]\s*$/);
            if (splitMatch) {
              nextSplitPos = endPos + splitMatch.index + splitMatch[0].length;
            } else {
              // 如果沒有句號，在下一個大寫字母前分割
              const upperMatch = textBetween.match(/\s+(?=[A-Z][a-z])/);
              if (upperMatch) {
                nextSplitPos = endPos + upperMatch.index;
              } else {
                nextSplitPos = percentMatches[index + 1].index;
              }
            }
          }

          const item = gradingText.substring(lastIndex, nextSplitPos).trim();
          if (item) {
            items.push(item);
          }
          lastIndex = nextSplitPos;
        });

        // 添加最後剩餘的文字（如果有的話）
        if (lastIndex < gradingText.length) {
          const remaining = gradingText.substring(lastIndex).trim();
          if (remaining && !remaining.match(/^[.。\s]+$/)) {
            items.push(remaining);
          }
        }

        lines = items.length > 0 ? items : lines;
      }
    }

    // 格式化每一行，高亮百分比
    const formattedLines = lines.map(line => {
      // 高亮百分比數字
      const highlighted = line.replace(/(\d+(?:\.\d+)?%)/g, '<strong style="color: #1976D2; font-weight: 600;">$1</strong>');
      return `<div style="margin-bottom: 6px;">• ${highlighted}</div>`;
    });

    return formattedLines.join('');
  }

  // ==================== AI 搜尋功能 ====================

  // AI 設置相關元素
  const settingsBtn = document.getElementById('settingsBtn');
  const settingsModal = document.getElementById('settingsModal');
  const closeSettings = document.getElementById('closeSettings');
  const saveSettings = document.getElementById('saveSettings');
  const reportIssue = document.getElementById('reportIssue');
  const reloadBtn = document.getElementById('reloadBtn');

  // 日誌相關元素
  const logBtn = document.getElementById('logBtn');
  const logModal = document.getElementById('logModal');
  const closeLog = document.getElementById('closeLog');
  const logContent = document.getElementById('logContent');
  const clearLog = document.getElementById('clearLog');
  const copyLog = document.getElementById('copyLog');

  const enableAI = document.getElementById('enableAI');
  const billingLinked = document.getElementById('billingLinked');
  const aiSettings = document.getElementById('aiSettings');
  const geminiSettings = document.getElementById('geminiSettings');
  const geminiKeyInput = document.getElementById('geminiKey');

  const aiStatus = document.getElementById('aiStatus');
  const testAIBtn = document.getElementById('testAIBtn');
  const openAIGuide = document.getElementById('openAIGuide');
  const aiGuideModal = document.getElementById('aiGuideModal');
  const closeAIGuide = document.getElementById('closeAIGuide');
  const aiGuideStepTitle = document.getElementById('aiGuideStepTitle');
  const aiGuideStepDesc = document.getElementById('aiGuideStepDesc');
  const aiGuideStepStatus = document.getElementById('aiGuideStepStatus');
  const aiGuidePrev = document.getElementById('aiGuidePrev');
  const aiGuideNext = document.getElementById('aiGuideNext');

  // 特殊指令相關元素
  const specialCommandsBar = document.getElementById('specialCommandsBar');
  const specialCommandsHeader = document.getElementById('specialCommandsHeader');
  const specialCommandsSections = document.getElementById('specialCommandsSections');
  const specialCmdButtons = document.querySelectorAll('.special-cmd-btn');

  // 特殊指令收合狀態（預設收起）
  let specialCommandsCollapsed = true;
  if (specialCommandsSections) {
    specialCommandsSections.classList.add('collapsed');
  }

  // AI 計時器
  let aiTimerInterval = null;
  let aiTimerSeconds = 0;

  // 啟動 AI 計時器
  function startAITimer() {
    aiTimerSeconds = 0;
    aiTimer.textContent = '(0秒)';
    aiTimerInterval = setInterval(() => {
      aiTimerSeconds++;
      aiTimer.textContent = `(${aiTimerSeconds}秒)`;
    }, 1000);
  }

  // 停止 AI 計時器（返回總秒數）
  function stopAITimer() {
    if (aiTimerInterval) {
      clearInterval(aiTimerInterval);
      aiTimerInterval = null;
    }
    return aiTimerSeconds;
  }

  // 更新 AI 進度（文字和進度條）
  function updateAIProgress(text, percentage) {
    const aiProgressText = document.getElementById('aiProgressText');
    const aiProgressFill = document.getElementById('aiProgressFill');

    if (aiProgressText) {
      aiProgressText.textContent = text;
    }

    if (aiProgressFill) {
      aiProgressFill.style.width = `${percentage}%`;
    }
  }

  // AI 狀態
  let aiEnabled = false;
  let aiBillingLinked = true;
  let aiGuideStep = 1;
  let aiConfig = {
    provider: 'gemini',  // 固定使用 Gemini
    useDynamicPrompt: true,  // 是否使用 AI 動態生成 Prompt（Step 0.5）
    useChunking: 'auto',  // 是否使用分塊並行處理（'auto'=自動檢測, true=強制啟用, false=禁用）
    gemini: {
      key: '',
      model: 'gemini-2.5-flash-lite'
    }
  };

  // 載入設置
  function loadAISettings() {
    chrome.storage.local.get(['aiEnabled', 'aiConfig', 'aiBillingLinked'], (result) => {
      console.log('[loadAISettings] 載入設定中...', result);

      if (result.aiEnabled !== undefined) {
        aiEnabled = result.aiEnabled;
        enableAI.checked = aiEnabled;
        console.log('[loadAISettings] AI enabled:', aiEnabled);
      }

      aiBillingLinked = true;
      if (billingLinked) {
        billingLinked.checked = true;
      }

      if (aiEnabled) {
        console.log('[loadAISettings] AI 已啟用，開始顯示 UI 元素');
        aiSearchToggle.style.display = 'flex';
        if (aiSettings) {
          aiSettings.style.display = 'block';
        }
        // 自動開啟 AI 搜尋按鈕
        aiSearchToggle.classList.add('active');
        const aiStatusElement = aiSearchToggle.querySelector('.ai-status');
        if (aiStatusElement) {
          aiStatusElement.textContent = 'ON';
        }
        // 同時顯示模式選擇器
        console.log('[loadAISettings] 嘗試顯示模式選擇器...');
        const aiModeSelector = document.getElementById('aiModeSelector');
        console.log('[loadAISettings] aiModeSelector 元素:', aiModeSelector);
        if (aiModeSelector) {
          console.log('[loadAISettings] 設置 aiModeSelector display = flex');
          aiModeSelector.style.display = 'flex';
          // 強制重新渲染
          aiModeSelector.style.visibility = 'visible';
          aiModeSelector.style.opacity = '1';
          console.log('[loadAISettings] 最終 aiModeSelector.style.display:', aiModeSelector.style.display);
        } else {
          console.error('[loadAISettings] 找不到 aiModeSelector 元素！');
        }
        // 同時顯示特殊指令按鈕欄
        if (specialCommandsBar) {
          specialCommandsBar.style.display = 'block';
        }
        // 隱藏智能搜尋提示（AI 模式下不需要）
        const searchHint = document.querySelector('.search-hint');
        if (searchHint) {
          searchHint.style.display = 'none';
        }
      } else {
        console.log('[loadAISettings] AI 未啟用，隱藏 UI 元素');
        aiSearchToggle.style.display = 'none';
        aiSearchToggle.classList.remove('active');
        // 隱藏模式選擇器
        const aiModeSelector = document.getElementById('aiModeSelector');
        if (aiModeSelector) {
          aiModeSelector.style.display = 'none';
        }
        // 隱藏特殊指令按鈕欄
        if (specialCommandsBar) {
          specialCommandsBar.style.display = 'none';
        }
        // 顯示智能搜尋提示（非 AI 模式下需要）
        const searchHint = document.querySelector('.search-hint');
        if (searchHint) {
          searchHint.style.display = 'block';
        }
      }

      console.log('[loadAISettings] 設定載入完成');
      updateAIActionsState();

      if (result.aiConfig) {
        aiConfig = { ...aiConfig, ...result.aiConfig };
        // 使用 Gemini
        aiConfig.provider = 'gemini';
        // 如果沒有儲存的模型設定，使用預設值
        if (!aiConfig.gemini.model) {
          aiConfig.gemini.model = 'gemini-2.5-flash-lite';
        }

        // 更新 Gemini UI
        if (aiConfig.gemini) {
          if (geminiKeyInput) {
            geminiKeyInput.value = aiConfig.gemini.key || '';
          }
          const geminiModelSelect = document.getElementById('geminiModel');
          if (geminiModelSelect) {
            geminiModelSelect.value = aiConfig.gemini.model;
          }
        }

        // Gemini settings 永遠顯示（不需要切換）
        if (geminiSettings) {
          geminiSettings.style.display = 'block';
        }
      }

      // 🚀 AI 設定載入完成後，觸發主動提取關鍵字
      if (aiEnabled) {
        console.log('[loadAISettings] AI 已啟用，檢查是否需要主動提取關鍵字...');
        chrome.storage.local.get(['courseData'], (dataResult) => {
          if (dataResult.courseData && dataResult.courseData.length > 0) {
            console.log('[loadAISettings] 課程資料存在，延遲 1 秒後開始主動提取');
            setTimeout(() => {
              console.log('🚀 主動開始提取課程關鍵字...');
              proactiveExtractKeywords(dataResult.courseData);
            }, 1000);
          } else {
            console.log('[loadAISettings] 課程資料不存在，跳過主動提取');
          }
        });
      } else {
        console.log('[loadAISettings] AI 未啟用，跳過主動提取');
      }
    });
  }

  function updateAIActionsState() {
    const guideKeyInput = document.getElementById('aiGuideGeminiKey');
    const guideBillingCheckbox = document.getElementById('aiGuideBillingLinked');

    if (guideKeyInput && geminiKeyInput && !geminiKeyInput.value.trim() && guideKeyInput.value.trim()) {
      geminiKeyInput.value = guideKeyInput.value;
    }
    if (guideKeyInput && geminiKeyInput && guideKeyInput.value !== geminiKeyInput.value) {
      guideKeyInput.value = geminiKeyInput.value;
    }
    if (guideBillingCheckbox && billingLinked) {
      billingLinked.checked = guideBillingCheckbox.checked;
    }

    const keyValue = (geminiKeyInput && geminiKeyInput.value.trim())
      || (guideKeyInput && guideKeyInput.value.trim())
      || '';
    const hasKey = keyValue.length > 0;
    const billingOk = true;
    aiBillingLinked = true;
    const canUseAI = hasKey;
    if (testAIBtn) {
      testAIBtn.disabled = !canUseAI;
      testAIBtn.title = canUseAI ? '測試連接' : '完成步驟一後才能測試';
    }
    if (saveSettings) {
      saveSettings.disabled = !canUseAI;
      saveSettings.title = canUseAI ? '儲存設定' : '完成步驟一後才能儲存';
    }
    if (aiGuideModal && aiGuideModal.style.display === 'flex') {
      updateAIGuideStatusOnly();
    }
  }

  function updateAIGuideStatusOnly() {
    if (!aiGuideModal || aiGuideModal.style.display !== 'flex') {
      return;
    }
    const guideKeyInput = document.getElementById('aiGuideGeminiKey');
    const guideBillingCheckbox = document.getElementById('aiGuideBillingLinked');
    const hasKey = !!((geminiKeyInput && geminiKeyInput.value.trim())
      || (guideKeyInput && guideKeyInput.value.trim())
      || (aiConfig.gemini && aiConfig.gemini.key));
    const billingOk = true;
    const canUseAI = hasKey;

    if (aiGuideStep === 1) {
      const keyStatus = document.getElementById('aiGuideKeyStatus');
      if (keyStatus) {
        keyStatus.textContent = hasKey ? '已填寫' : '尚未填寫';
        keyStatus.className = `guide-status ${hasKey ? 'ok' : 'warn'}`;
      }
      if (aiGuideNext) {
        aiGuideNext.disabled = !hasKey;
      }
    } else if (aiGuideStep === 2) {
      const billingStatus = document.getElementById('aiGuideBillingStatus');
      if (billingStatus) {
        billingStatus.textContent = billingOk ? '已連結' : '尚未連結';
        billingStatus.className = `guide-status ${billingOk ? 'ok' : 'warn'}`;
      }
      if (aiGuideNext) {
        aiGuideNext.disabled = !billingOk;
      }
    } else {
      const readyStatus = document.getElementById('aiGuideReadyStatus');
      if (readyStatus) {
        readyStatus.textContent = canUseAI ? '可測試/儲存' : '尚未完成步驟 1';
        readyStatus.className = `guide-status ${canUseAI ? 'ok' : 'warn'}`;
      }
      if (aiGuideNext) {
        aiGuideNext.disabled = !canUseAI;
      }
      const guideTestBtn = document.getElementById('aiGuideTestBtn');
      const guideSaveBtn = document.getElementById('aiGuideSaveBtn');
      if (guideTestBtn) {
        guideTestBtn.disabled = !canUseAI;
      }
      if (guideSaveBtn) {
        guideSaveBtn.disabled = !canUseAI;
      }
    }
  }

  function updateAIGuideModal() {
    if (!aiGuideStepTitle || !aiGuideStepDesc || !aiGuideStepStatus || !aiGuideNext || !aiGuidePrev) {
      return;
    }
    const guideKeyInput = document.getElementById('aiGuideGeminiKey');
    const guideBillingCheckbox = document.getElementById('aiGuideBillingLinked');
    const hasKey = !!((geminiKeyInput && geminiKeyInput.value.trim())
      || (guideKeyInput && guideKeyInput.value.trim())
      || (aiConfig.gemini && aiConfig.gemini.key));
    const billingOk = true;
    const canUseAI = hasKey;

    if (aiGuideStep === 1) {
      aiGuideStepTitle.textContent = '步驟一：填入 Gemini API Key';
      aiGuideStepDesc.innerHTML = `
        <strong>📝 步驟一：申請 Google Gemini API 金鑰</strong><br>
        1. 訪問 <a href="https://aistudio.google.com/apikey" target="_blank">Google AI Studio API Keys</a>（https://aistudio.google.com/apikey）<br>
        2. 點擊「Create API key」→ 選擇或建立一個專案<br>
        3. 複製顯示的 API 金鑰（格式：AIzaSy... 開頭，39 個字元）<br>
        4. 將金鑰貼到下方的「Gemini API Key」輸入框中
        <div class="guide-form">
          <label class="setting-label">
            <input type="checkbox" id="aiGuideEnableAI">
            <span>啟用 AI 搜尋</span>
          </label>
          <label class="setting-label-block">
            <span>Gemini API Key</span>
            <input type="password" id="aiGuideGeminiKey" class="setting-input" placeholder="AIza...">
          </label>
          <div class="api-key-security-note">
            🔒 API Key 僅儲存在本機瀏覽器中，不會上傳至任何伺服器
          </div>
        </div>
      `;
      aiGuideStepStatus.innerHTML = `
        <div class="guide-status-item">API Key：<span id="aiGuideKeyStatus" class="guide-status ${hasKey ? 'ok' : 'warn'}">${hasKey ? '已填寫' : '尚未填寫'}</span></div>
      `;
      aiGuidePrev.style.display = 'none';
      aiGuideNext.textContent = '下一步';
      aiGuideNext.disabled = !hasKey;

      const guideEnableAI = document.getElementById('aiGuideEnableAI');
      if (guideEnableAI) {
        guideEnableAI.checked = !!(enableAI && enableAI.checked);
        guideEnableAI.addEventListener('change', () => {
          if (enableAI) {
            enableAI.checked = guideEnableAI.checked;
          }
          if (aiSettings) {
            aiSettings.style.display = guideEnableAI.checked ? 'block' : 'none';
          }
          if (guideEnableAI.checked && geminiSettings) {
            geminiSettings.style.display = 'block';
          }
          updateAIActionsState();
        });
      }
      const guideKeyInput = document.getElementById('aiGuideGeminiKey');
      if (guideKeyInput) {
        guideKeyInput.value = (geminiKeyInput && geminiKeyInput.value)
          || (aiConfig.gemini && aiConfig.gemini.key)
          || '';
        guideKeyInput.addEventListener('input', () => {
          if (geminiKeyInput) {
            geminiKeyInput.value = guideKeyInput.value;
          }
          updateAIActionsState();
        });
      }
    } else if (aiGuideStep === 2) {
      aiGuideStepTitle.textContent = '步驟二：確認已連結帳單';
      aiGuideStepDesc.innerHTML = `
        <strong style="color: #ff5722;">⚠️ 步驟二：連結帳單帳戶（重要！）</strong><br>
        <div style="background-color: #fff3e0; padding: 12px; border-radius: 6px; margin: 8px 0; border-left: 4px solid #ff9800;">
          <strong>為什麼需要連結帳單帳戶？</strong><br>
          <table style="width: 100%; margin-top: 8px; font-size: 12px; border-collapse: collapse;">
            <tr style="background-color: #f5f5f5;">
              <th style="padding: 6px; text-align: left; border: 1px solid #ddd;">項目</th>
              <th style="padding: 6px; text-align: center; border: 1px solid #ddd;">未連結帳單</th>
              <th style="padding: 6px; text-align: center; border: 1px solid #ddd; background-color: #e8f5e9;">已連結帳單</th>
            </tr>
            <tr>
              <td style="padding: 6px; border: 1px solid #ddd;">每分鐘請求數（RPM）</td>
              <td style="padding: 6px; text-align: center; border: 1px solid #ddd; color: #f44336;"><strong>15</strong></td>
              <td style="padding: 6px; text-align: center; border: 1px solid #ddd; color: #4caf50;"><strong>1,000</strong></td>
            </tr>
            <tr>
              <td style="padding: 6px; border: 1px solid #ddd;">每天 Token 額度</td>
              <td style="padding: 6px; text-align: center; border: 1px solid #ddd;">有限</td>
              <td style="padding: 6px; text-align: center; border: 1px solid #ddd; color: #4caf50;">1,500,000</td>
            </tr>
          </table>
          <div style="margin-top: 8px; font-size: 12px;">
            💳 <strong>不用擔心費用：</strong>Google 提供 $300 美元免費試用額度，<span style="color: #4caf50; font-weight: bold;">不會自動扣款</span>！<br>
            💰 <strong>實際費用：</strong>Gemini 2.5 Flash 完全免費！
          </div>
        </div>

        <strong>如何連結帳單帳戶：</strong><br>
        <div style="margin-left: 12px; font-size: 12px;">
          <strong>方法一：通過 Google AI Studio</strong><br>
          1. 在 <a href="https://aistudio.google.com/" target="_blank" style="color: #7c4dff;">Google AI Studio</a> 頁面，點擊「Billing」或「View your billing account」<br>
          2. 點擊「Link a billing account」<br>
          3. 如果沒有帳單帳戶，點擊「Create billing account」<br>
          4. 填寫國家、帳戶名稱、幣別<br>
          5. 輸入信用卡資訊（會先扣 $1 驗證，稍後退回）<br>
          6. 點擊「Submit」完成<br><br>

          <strong>方法二：直接到 Google Cloud Console</strong><br>
          1. 訪問 <a href="https://console.cloud.google.com/billing" target="_blank" style="color: #7c4dff;">Google Cloud Console - Billing</a><br>
          2. 點擊「Create account」建立帳單帳戶<br>
          3. 按照上述步驟 4-6 完成設定<br>
          4. 回到 AI Studio，選擇剛建立的帳單帳戶連結
        </div>

        <strong>💰 費用與額度說明</strong><br>
        • Gemini 2.5 Flash：完全免費（推薦使用）<br>
        • AI 搜尋：每次約 500-2000 tokens<br>
        • 關鍵字學習：3,000 門課 × 1,000 tokens = 一次性<br>
        • 即使連結帳單，也不會扣款（因為使用免費模型）<br>
        • 每月使用成本：$0 元（100% 免費）<br><br>

        <strong>❓ 常見問題</strong><br>
        Q: AI 搜尋時出現「Resource has been exhausted」錯誤？<br>
        A: 這表示 API 請求額度用盡。請立即連結帳單帳戶，額度會從 15 RPM 提升到 1,000 RPM。<br><br>

        Q: 連結帳單會被扣款嗎？<br>
        A: 不會！使用 Gemini 2.5 Flash 完全免費，且 Google 提供 $300 試用額度，不會自動扣款。<br><br>

        Q: 如何確認帳單已連結？<br>
        A: 在 Google Cloud Console - Billing 查看，專案旁應顯示「Billing account linked」。<br><br>

        Q: 為什麼建議連結帳單帳戶？<br>
        A: 未連結時每分鐘只能請求 15 次，關鍵字學習功能會非常慢。連結後可達 1,000 次/分鐘，大幅加速學習過程。<br>
        <div class="guide-form">
          <label class="setting-label">
            <input type="checkbox" id="aiGuideBillingLinked">
            <span>已連結 Google 帳單帳戶（未連結將無法使用 AI）</span>
          </label>
        </div>
      `;
      aiGuideStepStatus.innerHTML = `
        <div class="guide-status-item">帳單連結：<span id="aiGuideBillingStatus" class="guide-status ${billingOk ? 'ok' : 'warn'}">${billingOk ? '已連結' : '尚未連結'}</span></div>
      `;
      aiGuidePrev.style.display = 'inline-block';
      aiGuideNext.textContent = '完成';
      aiGuideNext.disabled = !billingOk;

      const guideBillingCheckbox = document.getElementById('aiGuideBillingLinked');
      if (guideBillingCheckbox) {
        guideBillingCheckbox.checked = true;
        guideBillingCheckbox.addEventListener('change', () => {
          if (billingLinked) {
            billingLinked.checked = guideBillingCheckbox.checked;
          }
          aiBillingLinked = guideBillingCheckbox.checked;
          updateAIActionsState();
        });
      }
    } else {
      aiGuideStepTitle.textContent = '步驟三：測試與儲存';
      aiGuideStepDesc.textContent = '完成測試連接後，儲存設定即可開始使用 AI 搜尋。';
      aiGuideStepStatus.innerHTML = `
        <div class="guide-status-item">準備狀態：<span id="aiGuideReadyStatus" class="guide-status ${canUseAI ? 'ok' : 'warn'}">${canUseAI ? '可測試/儲存' : '尚未完成步驟 1'}</span></div>
        <div class="guide-status-item">測試結果：<span id="aiGuideTestStatus" class="guide-status">尚未測試</span></div>
        <div class="guide-actions">
          <button id="aiGuideTestBtn" class="btn-secondary">測試連接</button>
          <button id="aiGuideSaveBtn" class="btn-primary">儲存設定</button>
        </div>
      `;
      aiGuidePrev.style.display = 'inline-block';
      aiGuideNext.textContent = '完成';
      aiGuideNext.disabled = !canUseAI;

      const guideTestBtn = document.getElementById('aiGuideTestBtn');
      const guideSaveBtn = document.getElementById('aiGuideSaveBtn');
      if (guideTestBtn) {
        guideTestBtn.disabled = !canUseAI;
        guideTestBtn.addEventListener('click', () => {
          runAITestConnection();
        });
      }
      if (guideSaveBtn) {
        guideSaveBtn.disabled = !canUseAI;
        guideSaveBtn.addEventListener('click', () => {
          if (saveSettings && !saveSettings.disabled) {
            saveSettings.click();
          }
        });
      }
    }
  }

  function openAIGuideModal() {
    if (!aiGuideModal) return;
    aiGuideStep = 1;
    updateAIGuideModal();
    aiGuideModal.style.display = 'flex';
  }

  function closeAIGuideModal() {
    if (aiGuideModal) {
      aiGuideModal.style.display = 'none';
    }
  }

  // 儲存設置
  function saveAISettings() {
    aiEnabled = enableAI.checked;
    const guideBillingCheckbox = document.getElementById('aiGuideBillingLinked');
    aiBillingLinked = true;

    // 使用 Gemini（使用者選擇的模型）
    aiConfig.provider = 'gemini';
    const guideKeyInput = document.getElementById('aiGuideGeminiKey');
    const keyValue = (geminiKeyInput && geminiKeyInput.value)
      || (guideKeyInput && guideKeyInput.value)
      || aiConfig.gemini.key
      || '';
    aiConfig.gemini.key = keyValue;
    const geminiModelSelect = document.getElementById('geminiModel');
    aiConfig.gemini.model = (geminiModelSelect && geminiModelSelect.value)
      || aiConfig.gemini.model
      || 'gemini-2.5-flash-lite';

    chrome.storage.local.set({ aiEnabled, aiConfig, aiBillingLinked }, () => {
      console.log('AI 設置已儲存:', aiConfig);

      // 更新 AI 切換按鈕顯示
      if (aiEnabled) {
        aiSearchToggle.style.display = 'flex';
      } else {
        aiSearchToggle.style.display = 'none';
        aiSearchToggle.classList.remove('active');
      }

      // 關閉設置面板
      settingsModal.style.display = 'none';
    });
  }

  // Gemini 設置永遠顯示（不需要切換提供商）
  // 此函數已簡化，因為只使用 Gemini

  // 設置面板事件
  settingsBtn.addEventListener('click', () => {
    settingsModal.style.display = 'flex';
  });

  closeSettings.addEventListener('click', () => {
    settingsModal.style.display = 'none';
  });

  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
      settingsModal.style.display = 'none';
    }
  });

  if (openAIGuide) {
    openAIGuide.addEventListener('click', openAIGuideModal);
  }
  if (closeAIGuide) {
    closeAIGuide.addEventListener('click', closeAIGuideModal);
  }
  if (aiGuideModal) {
    aiGuideModal.addEventListener('click', (e) => {
      if (e.target === aiGuideModal) {
        closeAIGuideModal();
      }
    });
  }
  if (aiGuidePrev) {
    aiGuidePrev.addEventListener('click', () => {
      aiGuideStep = 1;
      updateAIGuideModal();
    });
  }
  if (aiGuideNext) {
    aiGuideNext.addEventListener('click', () => {
      if (aiGuideStep === 1) {
        aiGuideStep = 2;
        updateAIGuideModal();
      } else if (aiGuideStep === 2) {
        aiGuideStep = 3;
        updateAIGuideModal();
      } else {
        closeAIGuideModal();
      }
    });
  }

  saveSettings.addEventListener('click', saveAISettings);

  // 清除關鍵字快取按鈕事件
  const clearKeywordCacheBtn = document.getElementById('clearKeywordCache');
  clearKeywordCacheBtn.addEventListener('click', () => {
    if (!confirm('確定要清除所有關鍵字快取嗎？\n\n這將清除所有已提取的關鍵字，並立即重新開始提取。\n（課程基本資料不會被清除）')) {
      return;
    }

    console.log('🗑️ 開始清除關鍵字快取...');

    // 清除記憶體中的快取
    courseDetailsCache = {};

    // 清除 storage 中的快取和時間戳
    chrome.storage.local.set({
      courseDetailsCache: {},
      cacheLastUpdate: 0  // 重置時間戳，強制重新提取
    }, () => {
      console.log('✅ 關鍵字快取已清除');

      // 更新狀態顯示
      updateKeywordExtractionStatus();

      // 自動重新開始提取（如果有課程資料且 AI 已啟用）
      chrome.storage.local.get(['courseData'], (result) => {
        if (result.courseData && result.courseData.length > 0 && aiEnabled) {
          alert('關鍵字快取已清除！\n\n系統將自動重新提取所有課程的關鍵字。');
          console.log('🚀 自動重新開始提取課程關鍵字...');
          // 延遲 500ms 後開始提取（讓 alert 先關閉）
          setTimeout(() => {
            proactiveExtractKeywords(result.courseData);
          }, 500);
        } else {
          alert('關鍵字快取已清除！\n\n請確保有課程資料且 AI 已啟用後，系統將自動提取關鍵字。');
        }
      });
    });
  });

  // 回報問題按鈕事件
  reportIssue.addEventListener('click', () => {
    window.open('https://forms.gle/SbPcqgVRuNSdVyqK9', '_blank');
  });

  // 重新整理介面按鈕事件
  reloadBtn.addEventListener('click', () => {
    location.reload();
  });

  // 日誌面板事件
  logBtn.addEventListener('click', () => {
    logContent.innerHTML = getLogsHTML();
    attachLogEventListeners(); // 綁定展開/收合事件
    logModal.style.display = 'flex';
    // 滾動到底部
    setTimeout(() => {
      logContent.scrollTop = logContent.scrollHeight;
    }, 0);
  });

  closeLog.addEventListener('click', () => {
    logModal.style.display = 'none';
  });

  logModal.addEventListener('click', (e) => {
    if (e.target === logModal) {
      logModal.style.display = 'none';
    }
  });

  clearLog.addEventListener('click', () => {
    if (confirm('確定要清除所有日誌記錄嗎？')) {
      clearLogs();
    }
  });

  copyLog.addEventListener('click', () => {
    copyLogsToClipboard();
  });

  enableAI.addEventListener('change', () => {
    if (aiSettings) {
      aiSettings.style.display = enableAI.checked ? 'block' : 'none';
    }
    // Gemini settings 永遠顯示
    if (enableAI.checked && geminiSettings) {
      geminiSettings.style.display = 'block';
    }
    updateAIActionsState();
    if (enableAI.checked) {
      openAIGuideModal();
    } else {
      closeAIGuideModal();
    }
  });

  if (billingLinked) {
    billingLinked.addEventListener('change', () => {
      aiBillingLinked = billingLinked.checked;
      updateAIActionsState();
    });
  }

  if (geminiKeyInput) {
    geminiKeyInput.addEventListener('input', updateAIActionsState);
  }

  async function runAITestConnection() {
    if (testAIBtn) {
      testAIBtn.disabled = true;
      testAIBtn.textContent = '測試中...';
    }
    const guideTestBtn = document.getElementById('aiGuideTestBtn');
    const guideTestStatus = document.getElementById('aiGuideTestStatus');
    if (guideTestBtn) {
      guideTestBtn.disabled = true;
      guideTestBtn.textContent = '測試中...';
    }
    if (guideTestStatus) {
      guideTestStatus.textContent = '測試結果：測試中...';
      guideTestStatus.className = 'guide-status warn';
    }

    if (aiStatus) {
      aiStatus.className = 'ollama-status checking';
      aiStatus.innerHTML = '<span class="status-icon">⏳</span><span class="status-text">檢測中...</span>';
    }

    try {
      const isConnected = await testAIConnection();

      if (isConnected) {
        if (aiStatus) {
          aiStatus.className = 'ollama-status connected';
          aiStatus.innerHTML = '<span class="status-icon">✅</span><span class="status-text">連接成功</span>';
        }
        if (guideTestStatus) {
          guideTestStatus.textContent = '測試結果：連接成功';
          guideTestStatus.className = 'guide-status ok';
        }
      } else {
        if (aiStatus) {
          aiStatus.className = 'ollama-status disconnected';
          aiStatus.innerHTML = '<span class="status-icon">❌</span><span class="status-text">連接失敗</span>';
        }
        if (guideTestStatus) {
          guideTestStatus.textContent = '測試結果：連接失敗';
          guideTestStatus.className = 'guide-status warn';
        }
      }
    } catch (error) {
      if (aiStatus) {
        aiStatus.className = 'ollama-status disconnected';
        aiStatus.innerHTML = '<span class="status-icon">❌</span><span class="status-text">連接失敗：' + error.message + '</span>';
      }
      if (guideTestStatus) {
        guideTestStatus.textContent = `測試結果：連接失敗（${error.message}）`;
        guideTestStatus.className = 'guide-status warn';
      }
    }

    if (testAIBtn) {
      testAIBtn.disabled = false;
      testAIBtn.textContent = '測試連接';
    }
    if (guideTestBtn) {
      guideTestBtn.disabled = false;
      guideTestBtn.textContent = '測試連接';
    }
  }

  // AI 切換按鈕
  aiSearchToggle.addEventListener('click', () => {
    aiSearchToggle.classList.toggle('active');
    const aiStatus = aiSearchToggle.querySelector('.ai-status');
    const isActive = aiSearchToggle.classList.contains('active');
    aiStatus.textContent = isActive ? 'ON' : 'OFF';

    addLog('info', `AI 搜尋已${isActive ? '啟用' : '停用'}`);

    // 控制 AI 模式選擇器的顯示/隱藏
    const aiModeSelector = document.getElementById('aiModeSelector');
    if (aiModeSelector) {
      aiModeSelector.style.display = isActive ? 'flex' : 'none';
    }

    // 控制特殊指令按鈕欄的顯示/隱藏
    if (specialCommandsBar) {
      specialCommandsBar.style.display = isActive ? 'block' : 'none';
    }

    // 控制智能搜尋提示的顯示/隱藏（AI 模式下隱藏）
    const searchHint = document.querySelector('.search-hint');
    if (searchHint) {
      searchHint.style.display = isActive ? 'none' : 'block';
    }
  });

  // 測試連接
  if (testAIBtn) {
    testAIBtn.addEventListener('click', async () => {
      await runAITestConnection();
    });
  }

  // 特殊指令收合/展開
  function toggleSpecialCommandsPanel() {
    if (!specialCommandsSections) return; // 安全檢查

    specialCommandsCollapsed = !specialCommandsCollapsed;
    if (specialCommandsCollapsed) {
      specialCommandsSections.classList.add('collapsed');
    } else {
      specialCommandsSections.classList.remove('collapsed');
    }
  }

  // 點擊標題收合/展開特殊指令
  if (specialCommandsHeader && specialCommandsSections) {
    specialCommandsHeader.addEventListener('click', function(e) {
      toggleSpecialCommandsPanel();
    });
  }

  // 特殊指令按鈕事件 - 點擊插入指令到搜尋框
  specialCmdButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const command = btn.getAttribute('data-command');
      if (command && searchInput) {
        // 獲取當前游標位置
        const cursorPos = searchInput.selectionStart || searchInput.value.length;
        const currentValue = searchInput.value;

        // 在游標位置插入指令
        const newValue = currentValue.slice(0, cursorPos) + command + currentValue.slice(cursorPos);
        searchInput.value = newValue;

        // 設置新的游標位置（在插入的指令後面）
        const newCursorPos = cursorPos + command.length;
        searchInput.setSelectionRange(newCursorPos, newCursorPos);

        // 聚焦到輸入框
        searchInput.focus();

        console.log(`✅ 已插入特殊指令: ${command}`);
      }
    });
  });

  // 測試 AI 連接（只測試 Gemini）
  async function testAIConnection() {
    try {
      return await testGeminiConnection();
    } catch (error) {
      console.error('Gemini 連接測試失敗:', error);
      return false;
    }
  }

  // 測試 Ollama 連接
  async function testOllamaConnection() {
    const url = document.getElementById('ollamaUrl').value;

    try {
      const response = await fetch(`${url}/api/tags`, {
        method: 'GET',
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Ollama 可用模型:', data.models);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Ollama 連接失敗:', error);
      return false;
    }
  }

  // 測試 OpenAI 連接
  async function testOpenAIConnection() {
    const key = document.getElementById('openaiKey').value;

    if (!key) {
      throw new Error('請輸入 API Key');
    }

    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${key}`
        }
      });

      return response.ok;
    } catch (error) {
      console.error('OpenAI 連接失敗:', error);
      return false;
    }
  }

  // 測試 Gemini 連接
  async function testGeminiConnection() {
    const guideKeyInput = document.getElementById('aiGuideGeminiKey');
    const key = (geminiKeyInput && geminiKeyInput.value)
      || (guideKeyInput && guideKeyInput.value)
      || aiConfig.gemini.key
      || '';

    if (!key) {
      throw new Error('請輸入 API Key');
    }

    try {
      const geminiModelSelect = document.getElementById('geminiModel');
      const model = (geminiModelSelect && geminiModelSelect.value)
        || aiConfig.gemini.model
        || 'gemini-2.5-flash-lite';
      // SECURITY: Gemini API requires key in URL (no Authorization header support).
      // Users should restrict API key scope in Google Cloud Console.
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: 'test'
            }]
          }]
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Gemini 測試錯誤:', errorText);
      }

      return response.ok;
    } catch (error) {
      console.error('Gemini 連接失敗:', error);
      return false;
    }
  }

  // 測試自定義 API 連接
  async function testCustomConnection() {
    const url = document.getElementById('customUrl').value;
    const key = document.getElementById('customKey').value;
    const model = document.getElementById('customModel').value;

    if (!url || !model) {
      throw new Error('請輸入 API 端點和模型名稱');
    }

    try {
      const headers = {
        'Content-Type': 'application/json'
      };

      if (key) {
        headers['Authorization'] = `Bearer ${key}`;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: model,
          messages: [{
            role: 'user',
            content: 'test'
          }]
        })
      });

      return response.ok;
    } catch (error) {
      console.error('自定義 API 連接失敗:', error);
      return false;
    }
  }

  // 載入設置
  loadAISettings();


  // ==================== AI 搜尋核心功能 ====================

  // 從查詢中提取關鍵字
  function extractKeywords(query) {
    const keywords = [];

    // 時間關鍵字映射
    const timeMap = {
      '星期一': 'M', '週一': 'M', '禮拜一': 'M',
      '星期二': 'T', '週二': 'T', '禮拜二': 'T',
      '星期三': 'W', '週三': 'W', '禮拜三': 'W',
      '星期四': 'R', '週四': 'R', '禮拜四': 'R',
      '星期五': 'F', '週五': 'F', '禮拜五': 'F',
      '星期六': 'S', '週六': 'S', '禮拜六': 'S',
      '星期日': 'U', '週日': 'U', '禮拜日': 'U'
    };

    // 系所簡稱映射
    const deptMap = {
      '資工': '資訊工程',
      '電機': '電機工程',
      '電子': '電子工程',
      '機械': '機械工程',
      '土木': '土木工程',
      '化工': '化學工程',
      '材料': '材料科學',
      '應數': '應用數學',
      '物理': '物理',
      '化學': '化學',
      '生科': '生物科技',
      '運管': '運輸與物流管理',
      '管科': '管理科學'
    };

    // 提取時間代碼
    for (const [key, value] of Object.entries(timeMap)) {
      if (query.includes(key)) {
        keywords.push(value);
      }
    }

    // 提取系所名稱（只保留簡稱，避免 AND 邏輯過於嚴格）
    for (const [key, value] of Object.entries(deptMap)) {
      if (query.includes(key)) {
        keywords.push(key);  // 只加簡稱，不加全稱
      }
    }

    // 提取常見課程關鍵字（至少2個字）
    const commonWords = ['微積分', '線代', '線性代數', '物理', '化學', '程式', '計算機', '資料結構', '演算法', '邏設', '邏輯設計', '計組', '組合語言', '作業系統', '資料庫', '網路', '人工智慧', 'AI', '機器學習', '深度學習', '必修', '選修', '通識'];
    for (const word of commonWords) {
      if (query.includes(word)) {
        keywords.push(word);
      }
    }

    // 提取可能的教師姓名（單字或雙字）
    const teacherMatch = query.match(/([王李張劉陳楊黃趙吳周徐孫馬朱胡郭何林高梁鄭謝宋唐許韓馮鄧曹彭曾蕭田董袁潘于蔣蔡余杜葉程蘇魏呂丁任沈姚盧姜崔鍾譚陸汪范金石廖賈夏韋付方白鄒孟熊秦邱江尹薛閻段雷侯龍史陶黎賀顧毛郝龔邵萬錢嚴覃武戴莫孔向湯])[\u4e00-\u9fa5]{0,2}(?:老師|教授)?/g);
    if (teacherMatch) {
      teacherMatch.forEach(match => {
        const name = match.replace(/(?:老師|教授)$/, '');
        if (name.length >= 1) {
          keywords.push(name);
        }
      });
    }

    // 去重
    return [...new Set(keywords)];
  }

  // 根據查詢相關度排序課程
  function sortByRelevance(courses, userQuery, queryKeywords) {
    if (!courses || courses.length === 0) return courses;
    if (!queryKeywords || queryKeywords.length === 0) return courses;

    console.log(`🔍 [排序] 開始計算 ${courses.length} 門課程的相關度...`);
    console.log(`🔍 [排序] 查詢關鍵字 (${queryKeywords.length}個):`, queryKeywords.slice(0, 10).join(', ') + '...');

    // 為每門課程計算相關度分數
    const coursesWithScores = courses.map(course => {
      let score = 0;
      const matchDetails = [];
      let hasTimeMatch = false;
      let hasDeptMatch = false;

      // 收集課程的所有可搜尋文字
      const searchableText = [
        course.name || '',
        course.eng_name || '',
        course.teacher || '',
        course.dep_name || '',
        course.dep_cname || '',
        course.time || '',
        course.cos_type || '',
        // 處理 paths：可能是陣列或字串
        typeof course.paths === 'string' ? course.paths :
          (Array.isArray(course.paths) ? course.paths.map(p =>
            `${p.type || ''} ${p.category || ''} ${p.college || ''} ${p.department || ''}`
          ).join(' ') : '')
      ].join(' ').toLowerCase();

      // 1. 課程名稱完全包含查詢 (100分)
      if (course.name && course.name.toLowerCase().includes(userQuery.toLowerCase())) {
        score += 100;
        matchDetails.push('名稱完全匹配');
      }

      // 2. 匹配關鍵字數量 (每個關鍵字 10分)
      let matchedKeywordCount = 0;
      queryKeywords.forEach(keyword => {
        if (searchableText.includes(keyword.toLowerCase())) {
          matchedKeywordCount++;
          score += 10;
        }
      });
      if (matchedKeywordCount > 0) {
        matchDetails.push(`${matchedKeywordCount}個關鍵字`);
      }

      // 3. 系所/學院匹配 (60分，提高權重)
      const deptKeywords = queryKeywords.filter(kw =>
        ['資', '工', '電', '機', '學院', '系', 'CS', 'EE', 'DCP', 'CSIE', 'DCS'].some(d => kw.includes(d))
      );
      if (deptKeywords.length > 0) {
        const matchedDeptKeywords = deptKeywords.filter(kw => searchableText.includes(kw.toLowerCase()));
        if (matchedDeptKeywords.length > 0) {
          score += 60;
          hasDeptMatch = true;
          matchDetails.push(`系所匹配(${matchedDeptKeywords.length})`);
        }
      }

      // 4. 時間匹配 (30分) - 改為部分匹配即可
      const timeKeywords = queryKeywords.filter(kw =>
        ['M', 'T', 'W', 'R', 'F', 'S', 'U', '星期', '週', '上午', '下午', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd'].some(t => kw.includes(t))
      );
      if (timeKeywords.length > 0 && course.time) {
        // 檢查是否有任意時間關鍵字匹配（改為 some 而不是 every）
        const matchedTimeKeywords = [];
        const anyTimeMatched = timeKeywords.some(kw => {
          const kwLower = kw.toLowerCase();
          // 時間代碼直接匹配（M, T, W, R, F）
          if (course.time.includes(kw) || course.time.includes(kwLower)) {
            matchedTimeKeywords.push(kw);
            return true;
          }
          // 檢查節次（下午 = 5-9abcd）
          if ((kwLower === '下午' || kwLower.includes('下午')) && /[5-9abcd]/i.test(course.time)) {
            matchedTimeKeywords.push(kw);
            return true;
          }
          // 檢查節次（上午 = 1-4）
          if ((kwLower === '上午' || kwLower.includes('上午')) && /[1-4]/.test(course.time)) {
            matchedTimeKeywords.push(kw);
            return true;
          }
          return false;
        });
        if (anyTimeMatched) {
          score += 30;
          hasTimeMatch = true;
          matchDetails.push(`時間匹配(${matchedTimeKeywords.length})`);
        }
      }

      // 5. 教師姓名匹配 (20分)
      if (course.teacher && userQuery.includes(course.teacher)) {
        score += 20;
        matchDetails.push('教師匹配');
      }

      // 6. 組合 Bonus：系所 + 時間同時匹配 (分數 × 1.5 倍)
      if (hasDeptMatch && hasTimeMatch) {
        const originalScore = score;
        score = Math.floor(score * 1.5);
        matchDetails.push(`🎯組合獎勵(${originalScore}→${score})`);
      }

      return { course, score, matchDetails };
    });

    // 按分數排序（降序）
    coursesWithScores.sort((a, b) => b.score - a.score);

    // Debug: 顯示前5門課程的分數
    console.log('🔍 [排序] 前5門課程的相關度分數:');
    coursesWithScores.slice(0, 5).forEach((item, idx) => {
      console.log(`  ${idx + 1}. ${item.course.name} - 分數: ${item.score} (${item.matchDetails.join(', ')})`);
    });

    return coursesWithScores.map(item => item.course);
  }

  // ==================== 特殊指令系統 ====================

  /**
   * 獲取我的課表中所有空堂時間
   * @returns {Array} 空堂時間陣列，格式：['M1', 'M2', 'T3', ...]
   */
  function getFreePeriods() {
    const allPeriods = [];
    const days = ['M', 'T', 'W', 'R', 'F'];
    const periods = ['1', '2', '3', '4', 'n', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd'];

    // 生成所有可能的時段
    days.forEach(day => {
      periods.forEach(period => {
        allPeriods.push(`${day}${period}`);
      });
    });

    // 獲取已佔用的時段
    const occupiedPeriods = new Set();
    for (const courseKey in timetable) {
      const course = timetable[courseKey];
      if (course.time) {
        const slots = parseTimeSlots(course.time);
        slots.forEach(slot => {
          slot.periods.forEach(period => {
            occupiedPeriods.add(`${slot.day}${period}`);
          });
        });
      }
    }

    // 返回空堂時段
    return allPeriods.filter(period => !occupiedPeriods.has(period));
  }

  /**
   * 將空堂時段轉換為時間代碼字串
   * @param {Array} freePeriods 空堂時段陣列 ['M1', 'M2', 'T3', ...]
   * @returns {String} 時間代碼字串，如 'M12,T3'
   */
  function formatFreePeriodsToTimeCode(freePeriods) {
    if (!freePeriods || freePeriods.length === 0) {
      return '';
    }

    // 按日期分組
    const dayGroups = {};
    freePeriods.forEach(period => {
      const day = period[0];
      const periodNum = period.slice(1);
      if (!dayGroups[day]) {
        dayGroups[day] = [];
      }
      dayGroups[day].push(periodNum);
    });

    // 組合成時間代碼
    const timeCodes = [];
    for (const day in dayGroups) {
      timeCodes.push(`${day}${dayGroups[day].sort().join('')}`);
    }

    return timeCodes.join(',');
  }

  /**
   * 預處理查詢中的特殊指令
   * @param {String} query 原始查詢
   * @returns {Object} { processedQuery: 處理後的查詢, instructions: 指令信息 }
   */
  function preprocessSpecialInstructions(query) {
    let processedQuery = query;
    const instructions = {
      hasFreePeriods: false,
      freePeriods: [],
      freeTimeDescription: '',
      excludeKeywords: [],
      excludeDescription: '',
      // 新增指令屬性
      timeFilters: [],       // 時間篩選 (星期/時段)
      courseTypeFilters: [], // 課程類型篩選 (必修/選修/通識)
      creditFilters: []      // 學分篩選
    };

    // 處理 {空堂} 指令
    if (/{空堂}|{空閒}|{有空}/.test(query)) {
      const freePeriods = getFreePeriods();
      if (freePeriods.length > 0) {
        instructions.hasFreePeriods = true;
        instructions.freePeriods = freePeriods;

        // 生成友好的描述
        const dayNames = { M: '星期一', T: '星期二', W: '星期三', R: '星期四', F: '星期五' };
        const periodRanges = { '1234': '上午', '56789': '下午', 'abcd': '晚上' };

        // 按日期分組統計
        const dayStats = {};
        freePeriods.forEach(period => {
          const day = period[0];
          dayStats[day] = (dayStats[day] || 0) + 1;
        });

        const freeTimeCode = formatFreePeriodsToTimeCode(freePeriods);
        instructions.freeTimeDescription = `我的空堂時間（共 ${freePeriods.length} 個時段）`;

        // 替換查詢中的特殊指令為描述
        processedQuery = processedQuery.replace(/{空堂}|{空閒}|{有空}/g, instructions.freeTimeDescription);

        // 添加日誌
        addLog('info', `檢測到 {空堂} 指令：找到 ${freePeriods.length} 個空堂時段`);
        console.log('📋 空堂時段:', freePeriods.slice(0, 20).join(', '), freePeriods.length > 20 ? '...' : '');
        console.log('📋 空堂時間代碼:', freeTimeCode);
      } else {
        instructions.freeTimeDescription = '（課表已滿，沒有空堂）';
        processedQuery = processedQuery.replace(/{空堂}|{空閒}|{有空}/g, instructions.freeTimeDescription);
        addLog('warning', '檢測到 {空堂} 指令：但課表已滿，沒有空堂時段');
      }
    }

    // 處理 {除了} 連接詞
    const excludePattern = /{除了}([^{]+?)(?={|$)/g;
    let excludeMatch;
    while ((excludeMatch = excludePattern.exec(query)) !== null) {
      const excludeContent = excludeMatch[1].trim();
      instructions.excludeKeywords.push(excludeContent);

      // 保留在查詢中，但標記為排除條件
      processedQuery = processedQuery.replace(excludeMatch[0], `（排除：${excludeContent}）`);

      addLog('info', `檢測到 {除了} 指令：排除 "${excludeContent}"`);
      console.log('🚫 排除條件:', excludeContent);
    }

    if (instructions.excludeKeywords.length > 0) {
      instructions.excludeDescription = `排除以下條件：${instructions.excludeKeywords.join('、')}`;
    }

    // 處理 {上午} 指令
    if (/{上午}/.test(query)) {
      instructions.timeFilters.push('1', '2', '3', '4', 'n');
      processedQuery = processedQuery.replace(/{上午}/g, '上午時段（1-4、n節）');

      addLog('info', '檢測到 {上午} 指令：篩選上午時段 (1-4、n節)');
      console.log('🌅 上午時段：1-4、n節');
    }

    // 處理 {下午} 指令
    if (/{下午}/.test(query)) {
      instructions.timeFilters.push('5', '6', '7', '8', '9');
      processedQuery = processedQuery.replace(/{下午}/g, '下午時段（5-9節）');

      addLog('info', '檢測到 {下午} 指令：篩選下午時段 (5-9節)');
      console.log('🌆 下午時段：5-9節');
    }

    // 處理 {晚上} 指令
    if (/{晚上}/.test(query)) {
      instructions.timeFilters.push('a', 'b', 'c');
      processedQuery = processedQuery.replace(/{晚上}/g, '晚上時段（a-c節）');

      addLog('info', '檢測到 {晚上} 指令：篩選晚上時段 (a-c節)');
      console.log('🌙 晚上時段：a-c節');
    }

    // 處理 {必修} 指令
    if (/{必修}/.test(query)) {
      instructions.courseTypeFilters.push('必修');
      processedQuery = processedQuery.replace(/{必修}/g, '必修課程');

      addLog('info', '檢測到 {必修} 指令：篩選必修課程');
      console.log('📕 課程類型：必修');
    }

    // 處理 {選修} 指令
    if (/{選修}/.test(query)) {
      instructions.courseTypeFilters.push('選修');
      processedQuery = processedQuery.replace(/{選修}/g, '選修課程');

      addLog('info', '檢測到 {選修} 指令：篩選選修課程');
      console.log('📗 課程類型：選修');
    }

    // 處理 {通識} 指令
    if (/{通識}/.test(query)) {
      instructions.courseTypeFilters.push('通識');
      processedQuery = processedQuery.replace(/{通識}/g, '通識課程');

      addLog('info', '檢測到 {通識} 指令：篩選通識課程');
      console.log('📘 課程類型：通識');
    }

    // 處理 {低學分} 指令
    if (/{低學分}/.test(query)) {
      instructions.creditFilters.push('1', '2');
      processedQuery = processedQuery.replace(/{低學分}/g, '低學分課程（1-2學分）');

      addLog('info', '檢測到 {低學分} 指令：篩選 1-2 學分課程');
      console.log('1️⃣ 學分：1-2學分');
    }

    // 處理 {高學分} 指令
    if (/{高學分}/.test(query)) {
      instructions.creditFilters.push('3', '4', '5+');
      processedQuery = processedQuery.replace(/{高學分}/g, '高學分課程（3學分以上）');

      addLog('info', '檢測到 {高學分} 指令：篩選 3 學分以上課程');
      console.log('3️⃣ 學分：3學分以上');
    }

    return { processedQuery, instructions };
  }

  // Step 3：獨立評分函數
  async function scoreCourses(courses, userQuery, attributeSets, aiMode, instructions = { excludeKeywords: [] }) {
    if (!courses || courses.length === 0) {
      return new Map();
    }

    const stepNum = aiMode === 'loose' ? '2' : '3';
    console.log(`🎯 Step ${stepNum}：對 ${courses.length} 門課程進行評分`);

    // 分塊處理（每塊 200 門課程）
    const CHUNK_SIZE = 200;
    const chunks = [];
    for (let i = 0; i < courses.length; i += CHUNK_SIZE) {
      chunks.push(courses.slice(i, i + CHUNK_SIZE));
    }

    console.log(`📦 將課程分成 ${chunks.length} 塊進行評分`);

    const scorePromises = chunks.map(async (chunk, idx) => {
      const courseList = chunk.map((c, i) => {
        const pathsText = (c.paths || []).map(p =>
          [p.type, p.college, p.department, p.category].filter(x => x).join('/')
        ).join('; ');

        // 獲取課程提取的關鍵字（包含先修科目、評量方式、教學方法等）
        const courseDetailsKey = getCourseDetailsKey(c);
        const courseDetails = courseDetailsCache[courseDetailsKey];
        const keywords = courseDetails && courseDetails.searchKeywords ? courseDetails.searchKeywords : '';

        const parts = [
          `${i + 1}. ${c.name}`,
          c.teacher || '',
          c.time || '',
          c.room || '',
          c.dep_name ? `系所:${c.dep_name}` : '',
          pathsText ? `路徑:${pathsText}` : '',
          c.cos_type || '',
          typeof c.credits === 'number' ? `${c.credits}學分` : '',
          c.code || '',
          c.memo || '',
          keywords ? `關鍵字:${keywords}` : ''
        ].filter(p => p).join('｜');
        return parts;
      }).join('\n');

      // 格式化關鍵字
      const formatKeywords = (keywords) => {
        if (!Array.isArray(keywords) || keywords.length === 0) {
          return '(空)';
        }
        if (keywords.length === 1 && Array.isArray(keywords[0])) {
          return keywords[0].join(', ');
        }
        return keywords.map((group, i) => `[${Array.isArray(group) ? group.join(', ') : group}]`).join(' AND ');
      };

      // 提取必要和可選條件
      const requiredAttrs = Object.entries(attributeSets).filter(([k, [req, kw]]) => req === 'required' && kw.length > 0);
      const optionalAttrs = Object.entries(attributeSets).filter(([k, [req, kw]]) => req === 'optional' && kw.length > 0);

      const prompt = `為課程評分（0-100分）

【用戶查詢】：${userQuery}

【排除條件（Exclude）】：
${instructions.excludeKeywords.length > 0 ? instructions.excludeKeywords.map(kw => `❌ 排除：${kw}`).join('\n') : '無'}
${instructions.excludeKeywords.length > 0 ? '**重要**：如果課程的任何屬性（課程名稱、教師、系所、教室、時間等）包含排除條件，必須給予 0 分（內容分=0, 時間分=0, 地點分=0, 路徑分=0, 匹配分=0）' : ''}

【必要條件（Required）】：
${requiredAttrs.length > 0 ? requiredAttrs.map(([k, [req, kw]]) => `${k}: ${formatKeywords(kw)}`).join('\n') : '無'}

【可選條件（Optional）】：
${optionalAttrs.length > 0 ? optionalAttrs.map(([k, [req, kw]]) => `${k}: ${formatKeywords(kw)}`).join('\n') : '無'}

課程列表：
${courseList}

**課程列表說明**：
- 每門課程的資訊用「｜」分隔
- 「關鍵字」欄位：包含從完整課程綱要（先修科目、課程概述、教科書、評量方式、教學方法、備註）中提取的重要關鍵字
- 如果課程有「關鍵字」欄位，請優先使用該欄位來理解課程的詳細內容（如評分方式、先修要求、教學形式等）

評分標準（五分類）：
總分 = 內容分(0-25) + 時間分(0-25) + 地點分(0-15) + 路徑分(0-15) + 匹配分(0-20)
**最高分 100 分**

**重要原則：如果用戶沒有指定某個屬性（該屬性不在 Required 和 Optional 中），則該屬性給滿分**

1. 內容分（0-25分）：課程名稱、關鍵字內容匹配度
- **如果用戶沒有指定 name 條件**（name 不在上述條件中）：給滿分 25 分
- 課程名稱完全匹配查詢：25 分
- 課程名稱高度相關：20-24 分
- 關鍵字欄位高度相關：18-22 分
- 課程內容部分相關：12-17 分
- 勉強相關：5-11 分
- 不相關：0-4 分
**特別注意**：如果課程有「關鍵字」欄位，請分析其中的評量方式、先修科目、教學方法等資訊
**【重要】百分比精確匹配規則**：
  * 如果用戶查詢包含具體百分比（如「期中考30%」「報告占60%」），必須精確匹配該百分比數字
  * 範例：查詢「期中考30%」時，課程關鍵字有「期中考 40%」→ 不匹配，內容分給 0-5 分
  * 範例：查詢「期中考30%」時，課程關鍵字有「期中考 30%」→ 精確匹配，內容分給 20-25 分
  * 如果用戶只查詢「期中考」（沒有百分比），則任何有期中考的課程都匹配（不論百分比）

2. 時間分（0-25分）：上課時間匹配度
- **如果用戶沒有指定時間條件**（time 不在上述條件中）：給滿分 25 分
- 精確匹配時間（如查詢 T34，課程是 T34）：25 分
- 時間完全包含（如查詢 T1234n，課程是 T234）：23 分
- 時間部分重疊：15-20 分
- 時間不重疊但同一天：5-10 分
- 完全不匹配：0-4 分

3. 地點分（0-15分）：校區/教室匹配度
- **如果用戶沒有指定 room 條件**（room 不在上述條件中）：給滿分 15 分
- 精確匹配教室/校區：15 分
- 匹配校區但教室不同：12-14 分
- 未顯示校區/教室（空白）：8-10 分
- 不匹配：0-5 分
**校區排除規則**（當查詢包含排除條件如「不在光復校區」時）：
  * 有明確非排除校區資訊的課程（如六家校區、博愛校區）：12-15 分
  * 未顯示校區資訊的課程（教室欄位為空）：6-8 分
  * 範例：查詢「不在光復校區」時，「六家校區」課程 > 「未顯示校區」課程

4. 路徑分（0-15分）：系所/學院/選課路徑匹配度
- **如果用戶沒有指定路徑/系所條件**（paths 和 dep_name 都不在上述條件中）：給滿分 15 分
- paths 精確匹配查詢的學院/系所（如法律學院、資工系、電機系）：15 分
- dep_name 精確匹配查詢的系所名稱：13-14 分
- paths 部分匹配（如含「通識」、「核心課程」）：10-12 分
- paths 勉強匹配（如含「學士班共同課程」、「校共同課程」）：5-9 分
- 完全不匹配：0-4 分

5. 匹配分（0-20分）：課程符合條件的綜合匹配度
- **【核心原則】匹配分 = 課程符合用戶查詢條件的整體程度**
- **不要主觀評價課程名氣、品質或吸引力**，只評估課程是否符合用戶提出的條件
- **評分邏輯**（根據前面各項分數的匹配程度）：
  * 18-20分：**所有項目都接近滿分**（內容≥23, 時間≥23, 地點≥13, 路徑≥13）= 完美匹配所有條件
  * 15-17分：**大部分項目高分**（內容≥20, 時間≥20, 地點≥10, 路徑≥10）= 符合所有 Required 條件
  * 12-14分：**部分項目高分**（至少 2-3 項達到高分）= 符合所有 Required 條件但有些屬性匹配度一般
  * 9-11分：**少數項目高分**（只有 1-2 項達到高分）= 勉強符合 Required 條件
  * 6-8分：**各項分數都偏低** = Required 條件符合度不足
  * 3-5分：**多數項目低分** = Required 條件大部分不符合
  * 0-2分：**所有項目都低分** = 基本不符合條件
- **評分提示**：
  * 如果內容分、時間分、地點分、路徑分都是滿分或接近滿分，匹配分應給 18-20 分
  * 如果只有 1-2 項滿分，其他項也較高（如 20+），匹配分應給 15-17 分
- **【重要】課程類型降分規則**：以下類型課程必須限制匹配分上限：
  * **零學分課程（顯示為"0學分"）：匹配分不得超過 8 分**
  * 實習課（課程名稱包含「實習」）：匹配分不得超過 10 分
  * 專題課（課程名稱包含「專題」）：匹配分不得超過 10 分
  * 服務學習課（課程名稱包含「服務學習」）：匹配分不得超過 8 分
  * 無時間資訊課程（時間欄位為空）：匹配分不得超過 12 分
- **範例說明**：
  * 查詢「期末考30%的資工課」，課程「資料結構與物件導向程式設計」有「final written exam 30%」且路徑包含資工系
    → 完全符合所有條件，匹配分應給 16-20 分
  * 查詢「星期二上午的課」，課程時間是 T34（星期二3-4節）
    → 完全符合條件，匹配分應給 16-20 分

範例 1：
查詢「星期二上午的課程」（只指定 time，沒有指定其他條件）
- 內容分：滿分 25 分（因為用戶沒有指定課程內容）
- 時間分：根據實際時間匹配程度 0-25 分
- 地點分：滿分 15 分（因為用戶沒有指定地點）
- 路徑分：滿分 15 分（因為用戶沒有指定路徑）
- 匹配分：根據整體條件匹配度 0-20 分
- 可能得分：25+25+15+15+20 = 100 分

範例 2：
查詢「推薦不用考試的通識課」
- 課程A：關鍵字包含「期中考,期末考,筆試」→ 內容分較低（5-10分）
- 課程B：關鍵字包含「報告,實作,專題,無考試」→ 內容分較高（20-25分）
- 通過「關鍵字」欄位中的評量方式資訊來判斷是否符合「不用考試」的需求

範例 3：
查詢「找不需要微積分基礎的課程」
- 課程A：關鍵字包含「微積分,線性代數,先修」→ 內容分較低（0-5分）
- 課程B：關鍵字包含「無先修要求」或沒有提及微積分 → 內容分較高（20-25分）
- 通過「關鍵字」欄位中的先修科目資訊來判斷

範例 4：
查詢「體育課」
- 課程A：「大一體育｜余秀菁｜F78｜PE[GF]｜0學分｜...」→ 因為是 0 學分，匹配分不得超過 8 分（例如給 6 分）
- 課程B：「體育專題｜...｜2學分｜...」→ 因為包含「專題」，匹配分不得超過 10 分
- 課程C：「運動與健康｜...｜2學分｜...」→ 一般課程，匹配分可達 14-20 分

範例 5：
查詢「期中考占比30%的資工課」
- 課程A：「...｜關鍵字:期中考 30%,期末考 40%,...」→ 百分比精確匹配，內容分 20-25 分
- 課程B：「...｜關鍵字:期中考 40%,期末考 40%,...」→ 百分比不匹配（40% ≠ 30%），內容分 0-5 分
- 課程C：「...｜關鍵字:報告 60%,作業 40%,...」→ 沒有期中考，內容分 0-3 分
**重要**：必須精確匹配百分比數字，40% 和 30% 不是同一個值，不能視為匹配

輸出格式：
- 格式：編號:總分:內容分:時間分:地點分:路徑分:匹配分
- 每行一個課程，各項分數用冒號分隔
- 結果必須按總分從高到低排序
- 範例：
  2:100:25:25:15:15:20
  3:95:23:23:14:15:20
  1:90:25:20:10:15:20
- 不要輸出任何解釋、分析或額外文字
- 確保所有分數都在合理範圍內（內容分0-25，時間分0-25，地點分0-15，路徑分0-15，匹配分0-20）`;

      const response = await callAIForKeywordGeneration(prompt, 0.1, 0);  // thinking=0（評分不需要思考，快速計算）

      // 解析編號和分數（格式：編號:總分:內容分:時間分:地點分:路徑分:匹配分）
      const matches = response.matchAll(/(\d+)\s*:\s*(\d+)\s*:\s*(\d+)\s*:\s*(\d+)\s*:\s*(\d+)\s*:\s*(\d+)\s*:\s*(\d+)/g);
      const results = new Map();
      for (const match of matches) {
        const courseNum = parseInt(match[1]);
        const aiTotalScore = parseInt(match[2]);     // AI 返回的總分（可能有誤）
        let contentScore = parseInt(match[3]);       // 內容分（課程名稱、關鍵字）
        let timeScore = parseInt(match[4]);          // 時間分
        let locationScore = parseInt(match[5]);      // 地點分（校區/教室）
        let pathScore = parseInt(match[6]);          // 路徑分（系所/學院）
        let recommendScore = parseInt(match[7]);     // 匹配分（課程條件匹配度）

        // 範圍檢查和修正（防止 AI 給出超範圍的分數）
        contentScore = Math.min(25, Math.max(0, contentScore));       // 限制在 0-25
        timeScore = Math.min(25, Math.max(0, timeScore));            // 限制在 0-25
        locationScore = Math.min(15, Math.max(0, locationScore));    // 限制在 0-15
        pathScore = Math.min(15, Math.max(0, pathScore));            // 限制在 0-15
        recommendScore = Math.min(20, Math.max(0, recommendScore));  // 限制在 0-20

        // 重新計算總分以確保正確：總分 = 內容分 + 時間分 + 地點分 + 路徑分 + 匹配分
        const calculatedTotal = contentScore + timeScore + locationScore + pathScore + recommendScore;

        if (courseNum >= 1 && courseNum <= chunk.length) {
          const course = chunk[courseNum - 1];
          const id = course.cos_id || course.code;
          results.set(id, {
            total: calculatedTotal,       // 使用重新計算的總分
            content: contentScore,        // 內容分（0-25分）
            time: timeScore,              // 時間分（0-25分）
            location: locationScore,      // 地點分（0-15分）
            path: pathScore,              // 路徑分（0-15分）
            recommend: recommendScore     // 匹配分（0-20分）
          });
        }
      }

      return results;
    });

    const scoreMaps = await Promise.all(scorePromises);

    // 合併所有 scoreMap
    const finalScoreMap = new Map();
    for (const scoreMap of scoreMaps) {
      for (const [id, score] of scoreMap) {
        finalScoreMap.set(id, score);
      }
    }

    console.log(`✅ Step ${stepNum}：評分完成，共為 ${finalScoreMap.size} 門課程評分`);
    return finalScoreMap;
  }

  // 提取用戶查詢中的百分比要求（用於精確百分比匹配過濾）
  // 返回格式：[{ synonyms: ["期末考", "final exam", ...], percentage: 30 }, ...]
  function extractPercentageRequirements(attributeSets) {
    const requirements = [];

    // 從 evaluation 屬性提取百分比要求
    if (!attributeSets.evaluation || attributeSets.evaluation[0] === 'none') {
      return requirements;
    }

    const evaluationGroups = attributeSets.evaluation[1];

    // 每個 group 是一組同義詞（OR 關係）
    for (const group of evaluationGroups) {
      const synonymsForSamePercentage = [];
      let targetPercentage = null;

      for (const keyword of group) {
        // 匹配 "XXX ##%" 格式（如 "期末考 30%", "final exam 30%"）
        const match = keyword.match(/^(.+?)\s+(\d+)%$/);
        if (match) {
          const evalMethod = match[1].trim().toLowerCase();
          const percentage = parseInt(match[2]);

          synonymsForSamePercentage.push(evalMethod);

          // 記錄百分比（同一組內應該都是相同的百分比）
          if (targetPercentage === null) {
            targetPercentage = percentage;
          } else if (targetPercentage !== percentage) {
            console.warn(`⚠️ 同一組內發現不同百分比: ${targetPercentage}% vs ${percentage}%`);
          }
        }
      }

      // 如果這個組有百分比要求，添加到 requirements
      if (synonymsForSamePercentage.length > 0 && targetPercentage !== null) {
        requirements.push({
          synonyms: synonymsForSamePercentage,
          percentage: targetPercentage,
          originalKeywords: group.filter(k => k.match(/^(.+?)\s+(\d+)%$/))
        });
      }
    }

    return requirements;
  }

  // 檢查課程是否應該因為百分比問題被淘汰（返回 true 表示應該淘汰此課程）
  // requirements 格式：[{ synonyms: ["期末考", "final exam", ...], percentage: 30 }, ...]
  function hasMismatchedPercentage(course, requirements) {
    if (requirements.length === 0) return false;

    const courseKeywords = (course.extractedKeywords || '').toLowerCase();

    // 如果課程沒有提取關鍵字，無法判斷是否符合百分比要求，應淘汰（因為 evaluation 是 required）
    if (!courseKeywords) {
      console.log(`    └─ 淘汰：課程 ${course.name} 沒有關鍵字（無法驗證百分比）`);
      return true;
    }

    // 對於每個 requirement（每個 requirement 包含一組同義詞和目標百分比）
    for (const req of requirements) {
      let foundMatchInAnySynonym = false;  // 是否在任一同義詞中找到正確百分比
      let foundMismatchInAnySynonym = false;  // 是否在任一同義詞中找到錯誤百分比

      // 遍歷這組同義詞中的每一個（OR 邏輯）
      for (const synonym of req.synonyms) {
        // 允許同義詞內部和百分比之間有其他詞（如 "final written exam 30%"）
        // 策略：同義詞後面可以有0-2個額外的詞，然後是百分比
        const escapedSynonym = synonym
          .split(/\s+/)
          .map(word => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
          .join('(?:\\s+\\w+)?\\s+');

        // 允許同義詞後面有0-2個額外的詞（如 "exam"、"written exam"）
        const regex = new RegExp(`${escapedSynonym}(?:\\s+\\w+){0,2}?\\s+(\\d+)%`, 'gi');

        let match;
        while ((match = regex.exec(courseKeywords)) !== null) {
          const foundPercentage = parseInt(match[1]);

          if (foundPercentage === req.percentage) {
            // 在這個同義詞中找到正確百分比
            foundMatchInAnySynonym = true;
            console.log(`    ✓ 找到匹配：課程有「${match[0]}」，符合要求 ${req.percentage}%`);
          } else {
            // 在這個同義詞中找到錯誤百分比
            foundMismatchInAnySynonym = true;
            console.log(`    ✗ 發現不匹配：課程有「${match[0]}」，要求 ${req.percentage}%`);
          }
        }
      }

      // 判斷邏輯：
      // 1. 如果在任一同義詞中找到錯誤百分比 → 淘汰
      // 2. 如果沒有在任何同義詞中找到匹配 → 淘汰
      if (foundMismatchInAnySynonym) {
        console.log(`    └─ 淘汰：課程的評量方式百分比與要求不符`);
        return true;
      }

      if (!foundMatchInAnySynonym) {
        console.log(`    └─ 淘汰：課程沒有符合要求的評量方式（需要 ${req.percentage}%）`);
        console.log(`       查找的同義詞: ${req.synonyms.join(', ')}`);
        return true;
      }
    }

    // 所有要求都在某個同義詞中找到精確匹配 → 保留
    return false;
  }

  // 使用 AI 直接篩選課程
  async function searchCoursesWithAI(userQuery, allCourses) {
    if (!aiEnabled || !aiSearchToggle.classList.contains('active')) {
      return null;
    }

    try {
      // ===== 預處理特殊指令 =====
      console.log('🔧 原始查詢:', userQuery);
      const { processedQuery, instructions } = preprocessSpecialInstructions(userQuery);
      console.log('🔧 處理後查詢:', processedQuery);

      // 如果查詢被修改，更新 userQuery
      if (processedQuery !== userQuery) {
        userQuery = processedQuery;
      }

      console.log('🤖 開始 AI 搜尋:', userQuery);
      console.log('🤖 課程總數:', allCourses.length);

      // 附加關鍵字到課程對象（從快取讀取）
      let attachedCount = 0;
      let missingCount = 0;
      let emptyKeywordCount = 0;

      allCourses.forEach(course => {
        const cacheKey = getCourseDetailsKey(course);
        if (cacheKey && courseDetailsCache[cacheKey]) {
          // 修正：快取中的屬性名稱是 searchKeywords，而不是 keywords
          if (courseDetailsCache[cacheKey].searchKeywords) {
            course.extractedKeywords = courseDetailsCache[cacheKey].searchKeywords;
            attachedCount++;
          } else {
            emptyKeywordCount++;
          }
        } else {
          missingCount++;
        }
      });

      console.log(`✅ 關鍵字附加結果: ${attachedCount} 門成功, ${emptyKeywordCount} 門關鍵字為空, ${missingCount} 門不在快取中`);

      // 檢查快取中實際有多少課程有關鍵字
      const cacheCoursesWithKeywords = Object.values(courseDetailsCache).filter(c => c && c.searchKeywords && c.searchKeywords.length > 0).length;
      console.log(`📊 快取統計: 總共 ${Object.keys(courseDetailsCache).length} 門課程, 其中 ${cacheCoursesWithKeywords} 門有關鍵字`);

      // 調試：顯示快取結構示例（成功附加關鍵字的課程）
      if (attachedCount > 0) {
        console.log('\n🔍 成功附加關鍵字的課程示例（前3門）:');
        let shown = 0;
        for (const course of allCourses) {
          if (course.extractedKeywords && shown < 3) {
            console.log(`  課程: ${course.name}`);
            console.log(`    關鍵字長度: ${course.extractedKeywords.length}`);
            console.log(`    關鍵字預覽: ${course.extractedKeywords.substring(0, 150)}...`);
            shown++;
          }
        }
      }

      // 記錄開始搜尋
      addLog('info', `開始 AI 搜尋：${userQuery}`);
      addLog('info', `課程總數：${allCourses.length} 門`);

      // ⏸️ 暫停主動提取（避免影響搜尋性能）
      if (proactiveExtractionInProgress) {
        proactiveExtractionPaused = true;
        console.log('⏸️ 已暫停主動提取關鍵字（AI 搜尋中）');

        // 更新暫停按鈕狀態
        const stopLearningBtn = document.getElementById('stopLearningBtn');
        const learningProgressText = document.getElementById('learningProgressText');
        if (stopLearningBtn) {
          stopLearningBtn.textContent = '▶';
          stopLearningBtn.title = '繼續提取';
        }
        if (learningProgressText) {
          learningProgressText.textContent = '⏸️ 已暫停（AI 搜尋中）...';
        }
      }

      // 重置中斷標誌和警告訊息
      aiSearchCancelled = false;
      cancelWarning.style.display = 'none';
      stopSearchBtn.classList.remove('cancelling');
      stopSearchBtn.title = '停止搜尋';
      stopSearchBtn.textContent = '⏹';

      // 顯示思考動畫並啟動計時器
      aiThinking.style.display = 'flex';
      startAITimer();
      updateAIProgress('Step 0 進行中 - 提取關鍵字', 0);

      // 獲取用戶選擇的AI模式
      const aiModeRadios = document.getElementsByName('aiMode');
      let aiMode = 'loose'; // 默認寬鬆模式
      for (const radio of aiModeRadios) {
        if (radio.checked) {
          aiMode = radio.value;
          break;
        }
      }
      console.log('🎯 用戶選擇的 AI 模式:', aiMode);

      // ===== Step 0：將用戶輸入拆分成 13 個屬性的關鍵字集合（含必要性判斷）=====
      console.log('\n🔍 ===== Step 0：AI 拆分查詢為課程屬性關鍵字集合（含必要性）=====');

      let attributeSets = {
        code: ["none", []], name: ["none", []], teacher: ["none", []], time: ["none", []],
        credits: ["none", []], room: ["none", []], cos_id: ["none", []], acy: ["none", []],
        sem: ["none", []], memo: ["none", []], cos_type: ["none", []],
        dep_id: ["none", []], dep_name: ["none", []], paths: ["none", []],
        evaluation: ["none", []],  // 評量方式（期中考、期末考、報告等及其百分比）
        keywords: ["none", []]     // 其他關鍵字（英文授課、分組報告、實驗課等）
      };

      try {
        // 準備特殊指令信息
        let specialInstructionsInfo = '';
        if (instructions.hasFreePeriods && instructions.freePeriods.length > 0) {
          const freeTimeCode = formatFreePeriodsToTimeCode(instructions.freePeriods);
          specialInstructionsInfo += `\n📋 特殊指令 - {空堂}：用戶的空堂時間代碼為 "${freeTimeCode}"（共 ${instructions.freePeriods.length} 個時段）\n   → 如果查詢提到"空堂"或"空閒時間"，time 應設為 required，並包含這些時間代碼`;
        }
        if (instructions.excludeKeywords.length > 0) {
          specialInstructionsInfo += `\n🚫 特殊指令 - {除了}：需要排除的條件：${instructions.excludeKeywords.join('、')}\n   → 請在對應屬性的關鍵字中避免包含這些詞，或將它們標記為排除`;
        }

        const step0Prompt = `將用戶查詢拆分成課程的 16 個屬性的關鍵字集合，並判斷每個屬性是必要條件還是可選條件

查詢：${userQuery}${specialInstructionsInfo ? '\n' + specialInstructionsInfo : ''}

課程資料結構包含以下 16 個屬性：
1. code - 課程代碼（如：CSCS10021）
2. name - 課程名稱（如：資料結構、物件導向程式設計等）
3. teacher - 教師姓名
4. time - 上課時間代碼（星期代碼：M=星期一, T=星期二, W=星期三, R=星期四, F=星期五, S=星期六, U=星期日；節次代碼：y=6:00~6:50, z=7:00~7:50, 1=8:00~8:50, 2=9:00~9:50, 3=10:10~11:00, 4=11:10~12:00, n=12:20~13:10, 5=13:20~14:10, 6=14:20~15:10, 7=15:30~16:20, 8=16:30~17:20, 9=17:30~18:20, a=18:30~19:20, b=19:30~20:20, c=20:30~21:20, d=21:30~22:20。**重要**：用戶輸入實際時間時，請轉換為對應的節次代碼，例如「下午2點」=6節=「6」、「上午10點」=3節=「3」、「晚上7點」=b節=「b」）
5. credits - 學分數
6. room - 教室（教室代碼格式：建築代碼+教室號，如 EC114。**校區代碼對照**：【台北陽明[YM]】YN=護理館,YE=實驗大樓,YR=守仁樓,YS=醫學二館,YB=生醫工程館,YX=知行樓,YD=牙醫館,YK=傳統醫學大樓,YT=教學大樓,YM=醫學館,YL=圖書資源暨研究大樓,YA=活動中心,YH=致和樓,YC=生物醫學大樓,AS=中央研究院,PH=臺北榮總,CH=台中榮總,KH=高雄榮總；【新竹博愛[BA]】C=竹銘館,E=教學大樓,LI=實驗一館,BA=生科實驗館,BB=生科實驗二館,BI=賢齊館；【新竹光復[GF]】EA=工程一館,EB=工程二館,EC=工程三館,ED=工程四館,EE=工程五館,EF=工程六館,M=管理館,MB=管理二館,SA=科學一館,SB=科學二館,SC=科學三館,AC=學生活動中心,A=綜合一館,AB=綜合一館地下室,HA=人社一館,F=人社二館,HB=人社二館,HC=人社三館,CY=交映樓,EO=田家炳光電大樓,EV=環工館,CS=資訊技術服務中心,ES=電子資訊中心,CE=土木結構實驗室,AD=大禮堂,Lib=浩然圖書資訊中心；【台北北門[BM]】TA=會議室,TD=一般教室,TC=演講廳；【台南歸仁[GR]】CM=奇美樓；【新竹六家[LJ]】HK=客家大樓；【高雄[KS]】KB=高雄B棟,KC=高雄C棟。**重要**：用戶輸入校區名稱（如「光復校區」「六家校區」）或建築名稱（如「工程三館」「客家大樓」）時，請轉換為對應的教室代碼）
7. cos_id - 課程編號
8. acy - 學年度
9. sem - 學期
10. memo - 備註
11. cos_type - 課程類型（必修、選修、核心等。注意：此欄位不包含"通識"）
12. dep_id - 開課系所ID
13. dep_name - 開課系所名稱（如：資訊工程學系、電機工程學系、資工、電機等）【重要：此屬性僅用於排序加分，應標記為 "optional"】
14. paths - 選課路徑（包含課程類型、學院、系所等。**重要：通識課程的 paths 結構為「學士班共同課程/校共同課程/通識/*」或「學士班共同課程/校共同課程/核心課程/*」。搜尋「通識」時，應匹配「通識」或「核心課程」，但不匹配整個「學士班共同課程」（學士班共同課程還包含其他非通識課程）**）【用於篩選】
15. evaluation - 評量方式（如：期中考、期末考、報告、作業等及其配分百分比）。**重要**：當用戶查詢評量方式、考試方式、評分配分（如「期中考30%」「期末考占比40%」「不用考試」「全部報告」等）時，應將這些條件提取到 evaluation 屬性。**必須保留百分比數字**（如「期中考 30%」「final exam 30%」）。這些資訊存在於課程的關鍵字欄位（extractedKeywords）中
16. keywords - 其他關鍵字（如：英文授課、分組報告、實驗課、線上課程等）。**重要**：當用戶查詢的條件**不符合上述 1-15 個屬性的分類**時，應將這些條件提取到 keywords 屬性。例如：「英文授課」、「分組討論」、「實驗課」、「線上授課」、「遠距課程」、「EMI」等。這些資訊存在於課程的關鍵字欄位（extractedKeywords）中。根據用戶語氣判斷是 required 還是 optional

任務：
1. 為每個屬性生成所有可能的關鍵字、變體、同義詞
2. 判斷每個屬性的必要性：
   - "required" = 必要條件（課程必須符合，不符合直接淘汰）
   - "optional" = 可選條件（符合會加分但不符合也不淘汰）
   - "none" = 未提及（不檢查此屬性）
3. **【關鍵】代碼轉換（必須執行）：**
   - **time 屬性**：將實際時間轉換為節次代碼（如「下午2點」→「6」、「上午10點」→「3」、「晚上7點」→「b」）
   - **room 屬性**：將校區名稱/建築名稱轉換為代碼
     * 校區名稱 → 校區代碼：「光復校區」→「GF」、「六家校區」→「LJ」、「博愛校區」→「BA」、「台北陽明校區」→「YM」
     * 建築名稱 → 建築代碼：「工程三館」→「EC」、「客家大樓」→「HK」、「竹銘館」→「C」等
   - **關鍵字列表中必須包含轉換後的代碼**，同時也可以保留原始描述（如「下午2點」、「光復校區」）
4. 特別注意：
   - **dep_name（開課系所名稱）應該總是標記為 "optional"，不要標記為 "required"**
   - **paths（選課路徑）用於篩選，可以是 "required"**
   - dep_name 用於精確匹配系所名稱（加分用），paths 用於寬鬆匹配學院/系所（篩選用）

**【重要】統一的二維陣列格式：**
- **所有屬性的關鍵字都使用二維陣列**
- **內層陣列（同一組內）**：OR 邏輯（任一匹配即可）
- **外層陣列（不同組間）**：AND 邏輯（都要匹配）

範例邏輯：
- [["A", "B"]] = A OR B（任一匹配）
- [["A", "B"], ["C", "D"]] = (A OR B) AND (C OR D)（兩組都要匹配）
- "電資學院"（資訊OR電機）= [["資訊學院", "資工", "電機學院", "電機"]] - 全部放一組表示 OR
- "星期一下午"（組合時間）= [["M56789", "M5", "M6", "M7", "M8", "M9", "星期一下午"]] - 時間組合在一起

輸出格式：每個屬性是 [必要性, 關鍵字] 的 pair，關鍵字永遠是二維陣列

範例 1：
輸入：星期一下午的資工課
輸出：
{
  "code": ["none", []],
  "name": ["none", []],
  "teacher": ["none", []],
  "time": ["required", [["M56789", "M5", "M6", "M7", "M8", "M9", "星期一下午", "星期一5", "星期一6", "星期一7", "星期一8", "星期一9"]]],
  "credits": ["none", []],
  "room": ["none", []],
  "cos_id": ["none", []],
  "acy": ["none", []],
  "sem": ["none", []],
  "memo": ["none", []],
  "cos_type": ["none", []],
  "dep_id": ["none", []],
  "dep_name": ["optional", [["資訊工程學系", "資工", "DCP", "CS"]]],
  "paths": ["required", [["資訊學院", "資工", "資訊工程", "資訊工程學系", "DCP", "CS", "CSIE"]]],
  "evaluation": ["none", []],
  "keywords": ["none", []]
}
註：dep_name 是 optional（加分用），paths 是 required（篩選用）

範例 2：
輸入：資工或電機的深度學習課
輸出：
{
  "code": ["none", []],
  "name": ["required", [["深度學習", "Deep Learning", "DL"]]],
  "teacher": ["none", []],
  "time": ["none", []],
  "credits": ["none", []],
  "room": ["none", []],
  "cos_id": ["none", []],
  "acy": ["none", []],
  "sem": ["none", []],
  "memo": ["none", []],
  "cos_type": ["none", []],
  "dep_id": ["none", []],
  "dep_name": ["optional", [["資訊工程學系", "資工", "DCP", "電機工程學系", "電機", "UEE"]]],
  "paths": ["required", [["資訊學院", "資工", "資訊工程", "資訊工程學系", "DCP", "CS", "CSIE", "電機學院", "電機", "電機系", "電機工程", "電機工程學系", "UEE", "EE", "EECS"]]],
  "evaluation": ["none", []],
  "keywords": ["none", []]
}
註：資工OR電機，全部放一組表示 OR 關係

範例 3：
輸入：電資學院的深度學習或機器學習課程
輸出：
{
  "code": ["none", []],
  "name": ["required", [["深度學習", "機器學習", "Deep Learning", "Machine Learning", "DL", "ML"]]],
  "teacher": ["none", []],
  "time": ["none", []],
  "credits": ["none", []],
  "room": ["none", []],
  "cos_id": ["none", []],
  "acy": ["none", []],
  "sem": ["none", []],
  "memo": ["none", []],
  "cos_type": ["none", []],
  "dep_id": ["none", []],
  "dep_name": ["optional", [["資訊工程學系", "資工", "DCP", "電機工程學系", "電機", "UEE", "電子研究所", "IEE"]]],
  "paths": ["required", [["資訊學院", "資工", "資訊工程", "資訊工程學系", "DCP", "CS", "CSIE", "資訊科學", "資科", "資訊管理", "資管", "電機學院", "電機", "電機系", "電機工程", "電機工程學系", "UEE", "EE", "EECS", "電子", "電子研究所", "IEE", "電控", "ICN"]]],
  "evaluation": ["none", []],
  "keywords": ["none", []]
}
註：「電資學院」= 資訊學院 OR 電機學院，全部放一組表示 OR 關係

範例 4：
輸入：通識課程
輸出：
{
  "code": ["none", []],
  "name": ["none", []],
  "teacher": ["none", []],
  "time": ["none", []],
  "credits": ["none", []],
  "room": ["none", []],
  "cos_id": ["none", []],
  "acy": ["none", []],
  "sem": ["none", []],
  "memo": ["none", []],
  "cos_type": ["none", []],
  "dep_id": ["none", []],
  "dep_name": ["none", []],
  "paths": ["required", [["通識", "核心課程"]]],
  "evaluation": ["none", []],
  "keywords": ["none", []]
}
註：**重要**：
- 「通識」包含「核心課程」，所以搜尋通識應匹配「通識」或「核心課程」
- 「學士班共同課程」、「校共同課程」不屬於通識，不要匹配
- 不要在 cos_type 中查找通識（通識信息在 paths 中）

範例 5：
輸入：週一週三晚上的通識課
輸出：
{
  "code": ["none", []],
  "name": ["none", []],
  "teacher": ["none", []],
  "time": ["required", [["Mabc", "Wabc"]]],
  "credits": ["none", []],
  "room": ["none", []],
  "cos_id": ["none", []],
  "acy": ["none", []],
  "sem": ["none", []],
  "memo": ["none", []],
  "cos_type": ["none", []],
  "dep_id": ["none", []],
  "dep_name": ["none", []],
  "paths": ["required", [["通識", "核心課程"]]],
  "evaluation": ["none", []],
  "keywords": ["none", []]
}
註：
- **週一週三晚上** = Mabc OR Wabc（週一晚上 OR 週三晚上，任一即可）
- **晚上時段（abc節）必須用完整代碼：Mabc, Tabc, Wabc, Rabc, Fabc**
- **不要使用單獨的節次（Ma, Mb, Mc）**，避免誤匹配到 M9ab 這種跨時段的課程
- **不要使用模糊字樣（如"晚上"）**，必須用精確的時間代碼
- **重要**：M78, W78 等是下午末/傍晚，不是晚上！abc 節才是真正的晚上
- **重要**：「通識」包含「核心課程」，但不包含「學士班共同課程」、「校共同課程」

範例 6：
輸入：星期二上午的課
輸出：
{
  "code": ["none", []],
  "name": ["none", []],
  "teacher": ["none", []],
  "time": ["required", [["T1234n", "T1", "T2", "T3", "T4", "Tn", "星期二上午", "星期二1", "星期二2", "星期二3", "星期二4", "星期二n"]]],
  "credits": ["none", []],
  "room": ["none", []],
  "cos_id": ["none", []],
  "acy": ["none", []],
  "sem": ["none", []],
  "memo": ["none", []],
  "cos_type": ["none", []],
  "dep_id": ["none", []],
  "dep_name": ["none", []],
  "paths": ["none", []]
}
註：上午時段包含 1, 2, 3, 4, n 節

範例 7：
輸入：星期二上午的法律或管理相關課程
輸出：
{
  "code": ["none", []],
  "name": ["required", [["法律", "管理", "法律學", "法學", "管理學", "企業管理", "財務管理", "人力資源管理"]]],
  "teacher": ["none", []],
  "time": ["required", [["T1234n", "T1", "T2", "T3", "T4", "Tn", "星期二上午"]]],
  "credits": ["none", []],
  "room": ["none", []],
  "cos_id": ["none", []],
  "acy": ["none", []],
  "sem": ["none", []],
  "memo": ["none", []],
  "cos_type": ["none", []],
  "dep_id": ["none", []],
  "dep_name": ["optional", [["法律學系", "法學院", "管理學院", "企管", "財金"]]],
  "paths": ["optional", [["法律學院", "法律", "管理學院", "管理", "企管", "財金"]]]
}
註：**重要**：當查詢是「XX相關課程」時（如「法律相關」、「管理相關」）：
- name 已經包含主要關鍵字，設為 required（必須符合）
- paths 設為 optional（匹配會加分，但不匹配也不淘汰）
- 這樣可以找到所有相關課程，不論它們在哪個學院開課

範例 8（測試實際時間轉換）：
輸入：下午2點到3點的課
輸出：
{
  "code": ["none", []],
  "name": ["none", []],
  "teacher": ["none", []],
  "time": ["required", [["6", "67", "T6", "W6", "R6", "F6", "M6"]]],
  "credits": ["none", []],
  "room": ["none", []],
  "cos_id": ["none", []],
  "acy": ["none", []],
  "sem": ["none", []],
  "memo": ["none", []],
  "cos_type": ["none", []],
  "dep_id": ["none", []],
  "dep_name": ["none", []],
  "paths": ["none", []]
}
註：**重要**：用戶輸入實際時間時，必須轉換為對應的節次代碼：
- 下午2點（14:20）= 6節 → time 關鍵字列表必須包含 "6"
- 下午3點（15:30）= 7節 → time 關鍵字列表必須包含 "7"
- 上午10點（10:10）= 3節 → time 關鍵字列表必須包含 "3"
- 晚上7點（19:30）= b節 → time 關鍵字列表必須包含 "b"
- **關鍵字列表中必須包含轉換後的代碼，這是匹配的關鍵！**

範例 9（測試校區/教室代碼轉換）：
輸入：六家校區的客家相關課程
輸出：
{
  "code": ["none", []],
  "name": ["required", [["客家", "客語", "客家文化", "客家語言", "客家研究"]]],
  "teacher": ["none", []],
  "time": ["none", []],
  "credits": ["none", []],
  "room": ["required", [["HK", "LJ", "客家大樓", "六家校區", "新竹六家"]]],
  "cos_id": ["none", []],
  "acy": ["none", []],
  "sem": ["none", []],
  "memo": ["none", []],
  "cos_type": ["none", []],
  "dep_id": ["none", []],
  "dep_name": ["optional", [["客家文化學院", "客家", "人文社會學院"]]],
  "paths": ["optional", [["客家", "人文社會"]]]
}
註：**重要**：用戶輸入校區或建築名稱時，必須轉換為對應的代碼：
- 六家校區 → 校區代碼 "LJ" + 建築代碼 "HK"（客家大樓）→ room 關鍵字列表必須包含 "LJ" 和 "HK"
- 光復校區 → 校區代碼 "GF" → room 關鍵字列表必須包含 "GF"
- 博愛校區 → 校區代碼 "BA" → room 關鍵字列表必須包含 "BA"
- 工程三館 → 建築代碼 "EC" → room 關鍵字列表必須包含 "EC"
- 客家大樓 → 建築代碼 "HK" → room 關鍵字列表必須包含 "HK"
- **關鍵字列表中必須包含轉換後的代碼，這是匹配的關鍵！**

範例 10（測試排除條件 - 不在光復校區）：
輸入：不在光復校區的通識課
輸出：
{
  "code": ["none", []],
  "name": ["none", []],
  "teacher": ["none", []],
  "time": ["none", []],
  "credits": ["none", []],
  "room": ["none", []],
  "cos_id": ["none", []],
  "acy": ["none", []],
  "sem": ["none", []],
  "memo": ["none", []],
  "cos_type": ["none", []],
  "dep_id": ["none", []],
  "dep_name": ["none", []],
  "paths": ["required", [["通識", "核心課程"]]]
}
註：**重要**：「不在光復校區」是排除條件，不應該在 room 屬性中設定 required 關鍵字。排除條件會在後處理階段自動處理（通過 {除了} 指令或排除邏輯）。如果用戶明確要求「在六家校區」這類正向條件，才需要在 room 中設定 required 關鍵字並包含代碼。

範例 11（測試課程概述關鍵字提取）：
輸入：陣列
輸出：
{
  "code": ["none", []],
  "name": ["required", [["陣列", "array", "linked list", "串列", "資料結構"]]],
  "teacher": ["none", []],
  "time": ["none", []],
  "credits": ["none", []],
  "room": ["none", []],
  "cos_id": ["none", []],
  "acy": ["none", []],
  "sem": ["none", []],
  "memo": ["none", []],
  "cos_type": ["none", []],
  "dep_id": ["none", []],
  "dep_name": ["none", []],
  "paths": ["none", []]
}
註：搜尋「陣列」這類專業術語時，課程名稱通常不包含此詞，需要從課程概述中提取的關鍵字（searchKeywords）來匹配。應包含相關術語的變體和同義詞。

範例 12（測試評分方式關鍵字提取）：
輸入：期中考
輸出：
{
  "code": ["none", []],
  "name": ["none", []],
  "teacher": ["none", []],
  "time": ["none", []],
  "credits": ["none", []],
  "room": ["none", []],
  "cos_id": ["none", []],
  "acy": ["none", []],
  "sem": ["none", []],
  "memo": ["none", []],
  "cos_type": ["none", []],
  "dep_id": ["none", []],
  "dep_name": ["none", []],
  "paths": ["none", []],
  "evaluation": ["required", [["期中考", "midterm", "midterm exam", "期中", "期中測驗"]]]
}
註：搜尋「期中考」時，應提取到 evaluation 屬性。這類資訊不會出現在課程名稱中，只會出現在課程綱要的評量方式中。

範例 13（測試工具名稱關鍵字提取）：
輸入：numpy
輸出：
{
  "code": ["none", []],
  "name": ["required", [["numpy", "pandas", "python", "資料分析", "data analysis"]]],
  "teacher": ["none", []],
  "time": ["none", []],
  "credits": ["none", []],
  "room": ["none", []],
  "cos_id": ["none", []],
  "acy": ["none", []],
  "sem": ["none", []],
  "memo": ["none", []],
  "cos_type": ["none", []],
  "dep_id": ["none", []],
  "dep_name": ["none", []],
  "paths": ["none", []]
}
註：搜尋「numpy」這類程式庫/工具名稱時，需要從課程概述或教科書欄位提取的關鍵字來匹配。應包含相關的工具名稱和領域術語。

範例 14（測試先修科目關鍵字提取）：
輸入：線性代數 先修
輸出：
{
  "code": ["none", []],
  "name": ["required", [["線性代數", "linear algebra", "線代", "矩陣"]]],
  "teacher": ["none", []],
  "time": ["none", []],
  "credits": ["none", []],
  "room": ["none", []],
  "cos_id": ["none", []],
  "acy": ["none", []],
  "sem": ["none", []],
  "memo": ["required", [["先修", "prerequisite", "先備", "前置課程"]]],
  "cos_type": ["none", []],
  "dep_id": ["none", []],
  "dep_name": ["none", []],
  "paths": ["none", []]
}
註：搜尋「XX 先修」時，需要從先修科目/先備能力欄位（存於 memo 或 searchKeywords）提取關鍵字來匹配。name 匹配課程內容，memo 匹配「先修」相關詞。

範例 15（測試教學方法關鍵字提取）：
輸入：翻轉教學
輸出：
{
  "code": ["none", []],
  "name": ["required", [["翻轉教學", "flipped classroom", "實作", "分組", "專題", "project-based", "hands-on"]]],
  "teacher": ["none", []],
  "time": ["none", []],
  "credits": ["none", []],
  "room": ["none", []],
  "cos_id": ["none", []],
  "acy": ["none", []],
  "sem": ["none", []],
  "memo": ["none", []],
  "cos_type": ["none", []],
  "dep_id": ["none", []],
  "dep_name": ["none", []],
  "paths": ["none", []]
}
註：搜尋「翻轉教學」這類教學方法時，需要從教學方法欄位提取的關鍵字來匹配。應包含相關的教學方式和互動形式術語。

範例 16（測試評量方式配分占比查詢）：
輸入：期末考占比30%的資工課
輸出：
{
  "code": ["none", []],
  "name": ["none", []],
  "teacher": ["none", []],
  "time": ["none", []],
  "credits": ["none", []],
  "room": ["none", []],
  "cos_id": ["none", []],
  "acy": ["none", []],
  "sem": ["none", []],
  "memo": ["none", []],
  "cos_type": ["none", []],
  "dep_id": ["none", []],
  "dep_name": ["optional", [["資訊工程學系", "資工", "DCP", "CS"]]],
  "paths": ["required", [["資訊學院", "資工", "資訊工程", "資訊工程學系", "DCP", "CS", "CSIE"]]],
  "evaluation": ["required", [["期末考 30%", "final exam 30%", "final 30%", "期末 30%", "期末測驗 30%"]]],
  "keywords": ["none", []]
}
註：**重要**：用戶查詢評量方式配分（如「期中考30%」「期末考占比30%」「報告占60%」「不用考試」等）時，這些條件應提取到 evaluation 屬性，**必須保留百分比數字**。配分資訊存在於課程的關鍵字欄位（extractedKeywords）中。

範例 17（測試 keywords 屬性 - 不屬於其他分類的條件）：
輸入：英文授課的資工課
輸出：
{
  "code": ["none", []],
  "name": ["none", []],
  "teacher": ["none", []],
  "time": ["none", []],
  "credits": ["none", []],
  "room": ["none", []],
  "cos_id": ["none", []],
  "acy": ["none", []],
  "sem": ["none", []],
  "memo": ["none", []],
  "cos_type": ["none", []],
  "dep_id": ["none", []],
  "dep_name": ["optional", [["資訊工程學系", "資工", "DCP", "CS"]]],
  "paths": ["required", [["資訊學院", "資工", "資訊工程", "資訊工程學系", "DCP", "CS", "CSIE"]]],
  "evaluation": ["none", []],
  "keywords": ["required", [["英文授課", "英語授課", "全英文", "EMI", "English", "taught in English"]]]
}
註：「英文授課」不屬於 name、teacher、time 等任何一個固定屬性，所以放入 keywords 屬性。這些資訊會從課程的關鍵字欄位（extractedKeywords）中匹配。

範例 18（測試 keywords 屬性 - 多個 keywords 條件）：
輸入：有分組報告和實驗課的課程
輸出：
{
  "code": ["none", []],
  "name": ["none", []],
  "teacher": ["none", []],
  "time": ["none", []],
  "credits": ["none", []],
  "room": ["none", []],
  "cos_id": ["none", []],
  "acy": ["none", []],
  "sem": ["none", []],
  "memo": ["none", []],
  "cos_type": ["none", []],
  "dep_id": ["none", []],
  "dep_name": ["none", []],
  "paths": ["none", []],
  "evaluation": ["none", []],
  "keywords": ["required", [["分組報告", "分組討論", "小組報告", "團隊報告", "group report", "team project"], ["實驗課", "實驗", "實作課", "實作", "lab", "laboratory", "實習"]]]
}
註：「分組報告」和「實驗課」是兩個 AND 條件，所以放在兩個內層陣列中。第一組是分組報告的同義詞（OR），第二組是實驗課的同義詞（OR），兩組之間是 AND 關係。

現在為此查詢生成關鍵字集合：${userQuery}

只輸出 JSON：`;

        const step0Response = await callAIForKeywordGeneration(step0Prompt, 0.7, 0); // Step 0: thinking=0 (停用思考)

        // 解析 JSON
        const jsonMatch = step0Response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsedSets = JSON.parse(jsonMatch[0]);
          attributeSets = { ...attributeSets, ...parsedSets };
        }

        // 只輸出最終結果
        console.log('✅ Step 0 完成 - 屬性關鍵字集合（含必要性）:');
        const extractedAttrs = [];
        for (const [attr, [requirement, keywords]] of Object.entries(attributeSets)) {
          if (keywords.length > 0) {
            console.log(`  ${attr} [${requirement}]: ${JSON.stringify(keywords)}`);
            extractedAttrs.push(`${attr} [${requirement}]`);
          }
        }
        addLog('success', `Step 0 完成：提取了 ${extractedAttrs.length} 個屬性 (${extractedAttrs.join(', ')})`);

      } catch (error) {
        console.error('❌ Step 0 失敗:', error.message);
        // Fallback 邏輯（統一使用二維陣列格式）
        addLog('warning', 'Step 0 失敗，使用 Fallback 邏輯');
        if (userQuery.includes('星期一') || userQuery.includes('M')) {
          attributeSets.time = ['required', [['M', '星期一', '週一', '禮拜一']]];
        }
        if (userQuery.includes('下午')) {
          if (attributeSets.time[0] !== 'none') {
            // 組合時間：星期一下午
            attributeSets.time[1][0].push('M56789', 'M5', 'M6', 'M7', 'M8', 'M9', '56789', '下午');
          } else {
            attributeSets.time = ['required', [['56789', '5', '6', '7', '8', '9', '下午']]];
          }
        }
        if (userQuery.includes('資工')) {
          attributeSets.paths = ['required', [['資訊學院', '資工', 'DCP', 'CS', '資訊工程學系', 'CSIE']]];
        }
      }

      // ===== Step 0.5：過濾不適合的關鍵字 =====
      console.log('\n🔍 ===== Step 0.5：AI 過濾不適合的關鍵字 =====');

      try {
        const step05Prompt = `過濾關鍵字集合，移除不適合用於課程搜尋的關鍵字（保留必要性標記）

原始查詢：${userQuery}

當前關鍵字集合（格式：[必要性, 關鍵字列表]）：
${Object.entries(attributeSets).filter(([k, [req, kw]]) => kw.length > 0).map(([k, [req, kw]]) => `${k}: ["${req}", ${JSON.stringify(kw)}]`).join('\n')}

過濾規則：
1. 移除單個數字（如：1, 2, 5, 6 等），但保留完整時間代碼（如：M5, M56, M56789）
2. 移除過於通用或模糊的詞（如：「課程」、「學習」、「教學」等**單獨出現**的詞）
3. **重要例外：不要移除複合詞中的關鍵字**：
   - ✅ 保留：「學士班共同課程」、「校共同課程」、「核心課程」、「領域課程」（這些是 paths 的有效關鍵字）
   - ✅ 保留：學院名稱、系所名稱、課程類型等專有名詞
   - ❌ 移除：單獨的「課程」、「學習」等模糊詞
4. 移除可能造成誤判的詞
5. 保留所有有意義的關鍵字（系所名稱、時間代碼、星期、時段等）
6. 保持必要性標記不變（required/optional/none）
7. 保持二維陣列結構不變
8. 如果某個屬性的所有關鍵字都被移除，設為 ["none", []]

範例 1（時間過濾）：
輸入：time: ["required", [["M", "星期一", "週一", "56789", "5", "6", "7", "8", "9", "下午", "M56789", "M5", "M6"]]]
輸出：time: ["required", [["M", "星期一", "週一", "56789", "下午", "M56789", "M5", "M6"]]]
（保留 required 標記和二維陣列結構，移除了單個數字 5, 6, 7, 8, 9）

範例 2（通識課程 paths 過濾）：
輸入：paths: ["required", [["通識", "核心課程", "課程"]]]
輸出：paths: ["required", [["通識", "核心課程"]]]
（保留「通識」和「核心課程」，移除模糊詞「課程」）

輸出過濾後的關鍵字集合（只輸出 JSON，保持 [必要性, 二維陣列] 格式）：`;

        const step05Response = await callAIForKeywordGeneration(step05Prompt, 0.3, 0);  // Step 0.5: thinking=0 (停用思考)

        // 解析 JSON
        const jsonMatch = step05Response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const filteredSets = JSON.parse(jsonMatch[0]);
          attributeSets = { ...attributeSets, ...filteredSets };
        }

        console.log('✅ Step 0.5 完成 - 過濾後的關鍵字集合:');
        for (const [attr, [requirement, keywords]] of Object.entries(attributeSets)) {
          if (keywords.length > 0) {
            console.log(`  ${attr} [${requirement}]: ${JSON.stringify(keywords)}`);
          }
        }
      } catch (error) {
        console.error('❌ Step 0.5 失敗:', error.message);
        console.log('⚠️  使用未過濾的關鍵字集合繼續');
      }

      // 顯示必要項和可選項的總結
      const requiredCount = Object.values(attributeSets).filter(([req, kw]) => req === 'required' && kw.length > 0).length;
      const optionalCount = Object.values(attributeSets).filter(([req, kw]) => req === 'optional' && kw.length > 0).length;
      console.log(`\n📊 條件總結：${requiredCount} 個必要項（Required），${optionalCount} 個可選項（Optional）`);

      // 檢查是否被中斷
      if (aiSearchCancelled) {
        console.log('⏹️ 搜尋已在 Step 0 後被中斷');
        stopAITimer();
        aiThinking.style.display = 'none';
        cancelWarning.style.display = 'none';
        return [];
      }

      // 根據模式決定進度百分比
      const step1Progress = aiMode === 'loose' ? 33 : 25;
      updateAIProgress('Step 1 進行中 - 粗篩課程', step1Progress);

      // ===== Step 1：粗篩+評分+排序（分 30 塊並行）=====
      console.log('\n🔍 ===== Step 1：AI 粗篩+評分+排序（30塊並行）=====');

      const CHUNK_SIZE = Math.ceil(allCourses.length / 30);
      const chunks = [];
      for (let i = 0; i < allCourses.length; i += CHUNK_SIZE) {
        chunks.push(allCourses.slice(i, i + CHUNK_SIZE));
      }

      const step1Promises = chunks.map(async (chunk, idx) => {
        const courseList = chunk.map((c, i) => {
          const pathsText = (c.paths || []).map(p =>
            [p.type, p.college, p.department, p.category].filter(x => x).join('/')
          ).join('; ');

          // 如果有提取的關鍵字，也顯示（用於百分比匹配）
          const keywordsPreview = c.extractedKeywords
            ? `｜關鍵字:${c.extractedKeywords.substring(0, 150)}${c.extractedKeywords.length > 150 ? '...' : ''}`
            : '';

          return `${i + 1}. ${c.name}|${c.teacher || ''}|${c.time || ''}|${c.room || ''}|${c.dep_name || ''}|${pathsText || ''}|${c.cos_type || ''}${keywordsPreview}`;
        }).join('\n');

        // 分離必要項和可選項
        const requiredAttrs = Object.entries(attributeSets).filter(([k, [req, kw]]) => req === 'required' && kw.length > 0);
        const optionalAttrs = Object.entries(attributeSets).filter(([k, [req, kw]]) => req === 'optional' && kw.length > 0);

        // 格式化顯示關鍵字（統一處理所有屬性的二維陣列）
        const formatKeywords = (keywords) => {
          if (!Array.isArray(keywords) || keywords.length === 0) {
            return '(空)';
          }
          // 統一處理二維陣列：[[group1], [group2], ...] 表示 (group1) AND (group2)
          // 每個 group 內部是 OR 邏輯
          if (keywords.length === 1 && Array.isArray(keywords[0])) {
            // 只有一組：顯示為簡單列表（組內 OR）
            return keywords[0].join(', ');
          }
          // 多組：顯示為 [組1] AND [組2]
          return keywords.map((group, i) => `[${Array.isArray(group) ? group.join(', ') : group}]`).join(' AND ');
        };

        const step1Prompt = `快速粗篩課程（只淘汰完全不符合的）

查詢：${userQuery}

必要條件（ALL required，缺一不可）：
${requiredAttrs.length > 0 ? requiredAttrs.map(([k, [req, kw]]) => `${k}: ${formatKeywords(kw)}`).join('\n') : '無'}

課程列表（格式：編號. 課程名稱|教師|時間|教室|系所|路徑|類型｜關鍵字:...）：
${courseList}

匹配規則：
1. 評量方式匹配規則（evaluation）：
   **【重要】Step 1 對 evaluation 採用極度寬鬆策略，幾乎不檢查**：
   - 如果存在 evaluation 條件（如「期末考 30%」），**請忽略它，專注於匹配其他條件**（如 paths, dep_name 等）
   - **原因**：evaluation 百分比資訊需要從完整課程資料中提取，Step 1 看到的課程列表可能不包含完整的評量資訊
   - **Step 1 的策略**：只要課程符合其他條件（如系所、路徑），就應該保留，無論評量資訊是否可見
   - **唯一例外**：如果關鍵字中**非常明確**地顯示完全不同的百分比（如查詢「期末考 30%」但清楚看到「期末考 60%」「final exam 70%」），才考慮淘汰
   - 範例：evaluation: [[期末考 30%, final exam 30%]] + paths: [[資工, DCP]]
     * ✓ 保留：任何路徑包含「資工」或「DCP」的課程，**無論關鍵字中是否有評量資訊**
     * ✓ 保留：關鍵字沒有評量方式資訊的資工課程
     * ✓ 保留：關鍵字只有「期末考」但沒有百分比的資工課程
     * ✓ 保留：關鍵字包含「期末考 30%」的資工課程
     * ✓ 保留：關鍵字包含「期末考 40%」的資工課程（只是略有不同，保留）
     * ✗ 淘汰：路徑不包含資工的課程（其他 required 條件不符）

2. 其他關鍵字匹配規則（keywords）：
   - keywords 屬性用於不屬於其他固定屬性的條件（如：英文授課、分組報告、實驗課等）
   - 從課程的「關鍵字」欄位中匹配
   - 範例：keywords: [[英文授課, EMI, English]]
     * ✓ 保留：關鍵字包含「英文授課」或「EMI」或「English」
     * ✗ 淘汰：關鍵字中完全沒有相關詞彙

3. 時間匹配規則（IMPORTANT）：
   時間關鍵字格式：
   - T1234n = 星期二上午+中午（第1,2,3,4,n節）
   - T56789 = 星期二下午（第5,6,7,8,9節）
   - Tabc = 星期二晚上（第a,b,c節）

   範例 1：time: [[T1234n, T1, T2, T3, T4]] = 星期二上午
   - ✓ 符合：T1, T2, T3, T4, T12, T34, T234, T1234, T1n, T34n, T1234n
   - ✗ 不符合：T56, T567, T789, Tabc, Tab, M1, W234
   - 重點：Tabc（晚上）不符合上午條件！

   範例 2：time: [[Mabc, Wabc]] = 週一晚上 OR 週三晚上
   - ✓ 符合：Mabc, Mabc-, M56abc, M56abcn, Wabc, Wabc-, W9abc, W56abcn
   - ✗ 不符合：M56, M78, Mab, Tab, Tabc, W234, W78

4. 教室/校區匹配規則：
   - room: [[HK, 客家大樓]] = 教室包含 HK 或「客家大樓」
   - room: [[EC, 工程三館]] = 教室包含 EC（工程三館）
   - 教室代碼範例：EC114[GF] = 工程三館 114 教室（光復校區）

5. 路徑匹配：課程路徑包含任一關鍵字即可
   - paths: [[通識, 核心課程]] = 路徑含「通識」或「核心課程」

6. ALL Required 條件必須同時符合，缺一就淘汰

只輸出符合的課程編號（逗號分隔），無則輸出「無」`;

        const response = await callAIForKeywordGeneration(step1Prompt, 0.3, 0);  // Step 1: thinking=0 (停用思考)

        // 解析編號（格式：1,2,3 或 1, 2, 3）
        const numbers = response.match(/\d+/g);
        if (!numbers || numbers.length === 0) return [];

        return numbers.map(n => parseInt(n))
          .filter(n => n >= 1 && n <= chunk.length)
          .map(n => chunk[n - 1]);
      });

      const step1Results = await Promise.all(step1Promises);
      const step1CoursesAll = step1Results.flat();

      // 去重（按 cos_id 或 code）
      const courseIdSet = new Set();
      const step1Courses = [];
      for (const course of step1CoursesAll) {
        const id = course.cos_id || course.code;
        if (!courseIdSet.has(id)) {
          courseIdSet.add(id);
          step1Courses.push(course);
        }
      }

      console.log(`✅ Step 1 完成 - 保留 ${step1Courses.length}/${allCourses.length} 門課程` +
                  (step1CoursesAll.length !== step1Courses.length ? ` (去重前 ${step1CoursesAll.length} 門)` : ''));
      addLog('success', `Step 1 完成：從 ${allCourses.length} 門課程中篩選出 ${step1Courses.length} 門相關課程`);

      // 調試：檢查 Step 1 結果是否有關鍵字
      const coursesWithKeywords = step1Courses.filter(c => c.extractedKeywords).length;
      console.log(`📊 Step 1 結果中有關鍵字的課程：${coursesWithKeywords}/${step1Courses.length} 門`);

      // 調試：顯示前 5 門課程的關鍵字內容
      if (coursesWithKeywords > 0) {
        console.log('\n📝 Step 1 前 5 門課程的關鍵字樣本:');
        step1Courses.filter(c => c.extractedKeywords).slice(0, 5).forEach((c, i) => {
          const keywords = c.extractedKeywords.substring(0, 300);
          console.log(`  ${i + 1}. ${c.name}: ${keywords}${c.extractedKeywords.length > 300 ? '...' : ''}`);
        });
      }

      // 調試：檢查百分比要求
      const percentageReqs = extractPercentageRequirements(attributeSets);
      if (percentageReqs.length > 0) {
        console.log('\n🎯 百分比要求檢查:');
        percentageReqs.forEach(req => {
          console.log(`  要求: ${req.percentage}% (同義詞: ${req.synonyms.join(', ')})`);
        });

        // 檢查有多少課程符合百分比
        let matchCount = 0;
        let mismatchCount = 0;
        let noKeywordCount = 0;

        step1Courses.forEach(course => {
          if (!course.extractedKeywords) {
            noKeywordCount++;
            return;
          }

          const hasMismatch = hasMismatchedPercentage(course, percentageReqs);
          if (hasMismatch) {
            mismatchCount++;
          } else {
            matchCount++;
          }
        });

        console.log(`\n  結果: ${matchCount} 門符合, ${mismatchCount} 門不符合, ${noKeywordCount} 門無關鍵字`);

        // 顯示資工系課程的評量方式（幫助 debug）
        console.log('\n📊 資工系相關課程的評量方式檢查:');
        const cseCourses = step1Courses.filter(c => {
          const pathsText = (c.paths || []).map(p => p.department || '').join(' ');
          return pathsText.includes('資訊工程') || pathsText.includes('DCP') || (c.dep_name && c.dep_name.includes('資訊工程'));
        });

        if (cseCourses.length === 0) {
          console.log('  ⚠️ Step 1 未找到任何資工系課程');
        } else {
          cseCourses.forEach(c => {
            const hasMismatch = hasMismatchedPercentage(c, percentageReqs);
            const statusIcon = hasMismatch ? '✗' : '✓';
            // 提取評量方式關鍵字
            const evalMatch = (c.extractedKeywords || '').match(/(期中考|期末考|final exam|midterm exam|final|midterm)\s+\d+%/gi);
            const evalInfo = evalMatch ? evalMatch.join(', ') : '無評量方式資訊';
            console.log(`  ${statusIcon} ${c.name} - ${evalInfo}`);
          });
        }

        // 顯示幾個符合的例子（如果有）
        if (matchCount > 0) {
          console.log('\n✅ 符合百分比要求的課程範例:');
          let shown = 0;
          for (const course of step1Courses) {
            if (course.extractedKeywords && !hasMismatchedPercentage(course, percentageReqs)) {
              console.log(`  - ${course.name}`);
              console.log(`    關鍵字: ${course.extractedKeywords.substring(0, 200)}${course.extractedKeywords.length > 200 ? '...' : ''}`);
              shown++;
              if (shown >= 3) break;
            }
          }

          // 當有百分比要求時，Step 1 的 JavaScript 過濾已經精確完成了百分比匹配
          // 直接使用這些符合的課程，跳過 Step 2 AI 精準匹配（避免 AI 誤判）
          console.log(`\n💡 檢測到百分比要求，已通過 JavaScript 精確過濾出 ${matchCount} 門符合的課程`);
          console.log('💡 將跳過 Step 2 AI 精準匹配，直接使用這些課程進行評分');

          // 設置標記，表示需要使用百分比過濾模式
          window._usePercentageFilterMode = true;
          window._percentageFilteredCourses = step1Courses.filter(course =>
            course.extractedKeywords && !hasMismatchedPercentage(course, percentageReqs)
          );
          console.log(`✅ 已準備 ${window._percentageFilteredCourses.length} 門符合百分比要求的課程`);
        }
      }

      // 輸出前 20 個課程的詳細信息
      if (step1Courses.length > 0) {
        console.log('\n📋 Step 1 篩選結果（前 20 個課程）:');
        step1Courses.slice(0, 20).forEach((c, i) => {
          const pathsText = (c.paths || []).map(p =>
            [p.type, p.college, p.department, p.category].filter(x => x).join('/')
          ).join('; ');
          console.log(`  ${i + 1}. ${c.name} | ${c.teacher || '無教師'} | ${c.time || '無時間'} | 路徑:${pathsText || '無'} | ${c.cos_type || ''}`);
        });
        if (step1Courses.length > 20) {
          console.log(`  ... 還有 ${step1Courses.length - 20} 門課程未顯示`);
        }
      }

      // 檢查是否被中斷
      if (aiSearchCancelled) {
        console.log('⏹️ 搜尋已在 Step 1 後被中斷');
        stopAITimer();
        aiThinking.style.display = 'none';
        cancelWarning.style.display = 'none';
        return [];
      }

      // ===== 快速模式檢查：如果是快速模式，Step 1 完成後直接返回結果 =====
      if (aiMode === 'loose') {
        console.log('\n⚡ 快速模式：Step 1 完成後直接返回結果，跳過 Step 2');
        addLog('info', '快速模式：跳過 Step 2 精準匹配');

        // 應用後處理篩選（時間、學分、課程類型）
        let finalCourses = step1Courses;

        // === 應用 instructions 中的篩選條件 ===
        if (instructions.timeFilters && instructions.timeFilters.length > 0) {
          console.log('\n⏰ 應用時間篩選:', instructions.timeFilters);
          const beforeCount = finalCourses.length;
          finalCourses = finalCourses.filter(course => {
            if (!course.time) return false;
            return instructions.timeFilters.some(filter => course.time.includes(filter));
          });
          console.log(`✅ 時間篩選已應用：排除了 ${beforeCount - finalCourses.length} 門課程，剩餘 ${finalCourses.length} 門`);
          addLog('info', `時間篩選：從 ${beforeCount} 門課程中篩選出 ${finalCourses.length} 門符合時段的課程`);
        }

        if (instructions.creditsFilters && instructions.creditsFilters.length > 0) {
          console.log('\n📚 應用學分篩選:', instructions.creditsFilters);
          const beforeCount = finalCourses.length;
          finalCourses = finalCourses.filter(course => {
            const credits = parseInt(course.credits);
            if (isNaN(credits)) return false;
            return instructions.creditsFilters.some(filter => {
              if (filter === '低學分') return credits >= 1 && credits <= 2;
              if (filter === '高學分') return credits >= 3;
              return false;
            });
          });
          console.log(`✅ 學分篩選已應用：排除了 ${beforeCount - finalCourses.length} 門課程，剩餘 ${finalCourses.length} 門`);
          addLog('info', `學分篩選：從 ${beforeCount} 門課程中篩選出 ${finalCourses.length} 門符合學分要求的課程`);
        }

        if (instructions.courseTypeFilters && instructions.courseTypeFilters.length > 0) {
          console.log('\n📖 應用課程類型篩選:', instructions.courseTypeFilters);
          const beforeCount = finalCourses.length;
          finalCourses = finalCourses.filter(course => {
            const hasMatch = instructions.courseTypeFilters.some(filter => {
              if (filter === '通識') {
                if (course.paths && Array.isArray(course.paths)) {
                  return course.paths.some(path => {
                    const typeText = (path.type || '').toLowerCase();
                    const categoryText = (path.category || '').toLowerCase();
                    const collegeText = (path.college || '').toLowerCase();
                    return typeText.includes('核心課程') ||
                           typeText.includes('通識') ||
                           categoryText.includes('核心課程') ||
                           categoryText.includes('通識') ||
                           typeText.includes('學士班共同課程') ||
                           collegeText.includes('通識');
                  });
                }
                return false;
              }
              if (course.cos_type && course.cos_type.includes(filter)) {
                return true;
              }
              return false;
            });
            return hasMatch;
          });
          addLog('info', `課程類型篩選：排除了 ${beforeCount - finalCourses.length} 門課程`);
        }

        if (instructions.excludeKeywords && instructions.excludeKeywords.length > 0) {
          const beforeCount = finalCourses.length;

          // 校區名稱到代碼的對照表
          const campusCodeMap = {
            '光復校區': 'GF',
            '光復': 'GF',
            '六家校區': 'LJ',
            '六家': 'LJ',
            '博愛校區': 'BA',
            '博愛': 'BA',
            '台北陽明校區': 'YM',
            '台北陽明': 'YM',
            '陽明校區': 'YM',
            '陽明': 'YM'
          };

          finalCourses = finalCourses.filter(course => {
            const shouldExclude = instructions.excludeKeywords.some(keyword => {
              // 檢查基本屬性匹配
              if ((course.name && course.name.includes(keyword)) ||
                  (course.teacher && course.teacher.includes(keyword)) ||
                  (course.dep_name && course.dep_name.includes(keyword)) ||
                  (course.cos_type && course.cos_type.includes(keyword)) ||
                  (course.room && course.room.includes(keyword))) {
                return true;
              }

              // 檢查校區代碼匹配（如「光復校區」→ 檢查是否包含 [GF]）
              const campusCode = campusCodeMap[keyword];
              if (campusCode && course.room && course.room.includes(`[${campusCode}]`)) {
                return true;
              }

              return false;
            });
            return !shouldExclude;
          });
          addLog('info', `排除關鍵字篩選：排除了 ${beforeCount - finalCourses.length} 門課程`);
        }

        // ===== 百分比精確匹配過濾 =====
        const percentageRequirements = extractPercentageRequirements(attributeSets);
        if (percentageRequirements.length > 0) {
          const beforeCount = finalCourses.length;

          finalCourses = finalCourses.filter(course => {
            const hasMismatch = hasMismatchedPercentage(course, percentageRequirements);
            return !hasMismatch;
          });

          addLog('info', `百分比過濾：淘汰了 ${beforeCount - finalCourses.length} 門課程`);
        }

        if (finalCourses.length === 0) {
          addLog('warning', '快速模式完成：未找到符合的課程');
          updateAIProgress('未找到課程', 0);
          aiThinking.style.display = 'none';
          stopAITimer();
          return [];
        }

        addLog('success', `快速模式完成：匹配到 ${finalCourses.length} 門課程`);

        // 檢查是否被中斷
        if (aiSearchCancelled) {
          stopAITimer();
          aiThinking.style.display = 'none';
          cancelWarning.style.display = 'none';
          return [];
        }

        // ===== Step 2（快速模式）：評分（獨立步驟）=====
        updateAIProgress('Step 2 進行中 - 評分課程', 66);

        let scoreMap = null;
        try {
          scoreMap = await scoreCourses(finalCourses, userQuery, attributeSets, aiMode, instructions);
        } catch (error) {
          console.error('Step 2 評分失敗:', error.message);
          addLog('warning', 'Step 2 評分失敗，返回 Step 1 結果');
          scoreMap = null;
        }

        // 按分數排序課程（如果評分成功）
        if (scoreMap && scoreMap.size > 0) {
          finalCourses.sort((a, b) => {
            const scoreA = scoreMap.get(a.cos_id || a.code);
            const scoreB = scoreMap.get(b.cos_id || b.code);
            const totalA = scoreA ? scoreA.total : 0;
            const totalB = scoreB ? scoreB.total : 0;
            return totalB - totalA;
          });

          // 過濾掉低於 30 分的課程（視為誤判）
          const beforeFilterCount = finalCourses.length;
          finalCourses = finalCourses.filter(course => {
            const scoreData = scoreMap.get(course.cos_id || course.code);
            return scoreData && scoreData.total >= 30;
          });
          const filteredCount = beforeFilterCount - finalCourses.length;
          if (filteredCount > 0) {
            addLog('info', `過濾掉 ${filteredCount} 門低分課程`);
          }
        }

        const courseIds = finalCourses.map(course => course.cos_id || course.code);
        console.log(`🎯 快速模式返回 ${courseIds.length} 個課程ID`);

        aiThinking.style.display = 'none';
        const totalSeconds = stopAITimer();
        console.log(`⏱️ 搜尋總花費時間：${totalSeconds} 秒`);
        addLog('info', `⏱️ 搜尋總花費時間：${totalSeconds} 秒`);
        return { courseIds, scoreMap };
      }

      // 檢查是否被中斷
      if (aiSearchCancelled) {
        console.log('⏹️ 搜尋已在精準模式 Step 2 前被中斷');
        stopAITimer();
        aiThinking.style.display = 'none';
        cancelWarning.style.display = 'none';
        return [];
      }

      // ===== 檢查百分比過濾：只有在僅有 evaluation 條件時才跳過 Step 2 =====
      // 統計有多少個 required 條件（不包括 evaluation）
      const requiredAttributesExceptEval = Object.entries(attributeSets)
        .filter(([key, [requirement, keywords]]) =>
          key !== 'evaluation' && requirement === 'required' && keywords.length > 0
        ).length;

      if (window._usePercentageFilterMode && window._percentageFilteredCourses && window._percentageFilteredCourses.length > 0) {
        // 檢查是否有其他 required 條件（需要 AND 邏輯）
        if (requiredAttributesExceptEval > 0) {
          // 有其他 required 條件（如 paths），需要 Step 2 AI 執行 AND 邏輯
          console.log(`\n💡 檢測到百分比要求 + ${requiredAttributesExceptEval} 個其他 required 條件（需要 AND 邏輯）`);
          console.log(`💡 將執行 Step 2 AI 精準匹配，使用已過濾的 ${window._percentageFilteredCourses.length} 門課程`);

          // 清除 mode 標記，但保留 filtered courses 供 Step 2 使用
          delete window._usePercentageFilterMode;
          // 不刪除 window._percentageFilteredCourses，讓 Step 2 使用它
        } else {
          // 只有 evaluation 條件，可以跳過 Step 2
          console.log(`\n💡 百分比過濾模式：只有 evaluation 條件，已通過 JavaScript 精確過濾出 ${window._percentageFilteredCourses.length} 門課程`);
          console.log('💡 跳過 Step 2 AI 精準匹配，直接進入評分階段');

          // 直接使用過濾後的課程，進入評分
          let finalCourses = window._percentageFilteredCourses;

          // 清除標記
          delete window._usePercentageFilterMode;
          delete window._percentageFilteredCourses;

          // ===== Step 2（評分）：為過濾後的課程評分 =====
          console.log('\n🔍 ===== Step 2：AI 評分（百分比過濾模式）=====');
          updateAIProgress('Step 2 進行中 - 評分課程', 70);

          let scoreMap = null;
          try {
            scoreMap = await scoreCourses(finalCourses, userQuery, attributeSets, 'precise', instructions);
          } catch (error) {
            console.error('⚠️ Step 2 評分失敗，返回未評分結果:', error);
            addLog('warning', 'Step 2 評分失敗，返回未評分結果');
            scoreMap = null;
          }

          // 按分數排序課程（如果評分成功）
          if (scoreMap && scoreMap.size > 0) {
            finalCourses.sort((a, b) => {
              const scoreA = scoreMap.get(a.cos_id || a.code);
              const scoreB = scoreMap.get(b.cos_id || b.code);
              const totalA = scoreA ? scoreA.total : 0;
              const totalB = scoreB ? scoreB.total : 0;
              return totalB - totalA;
            });

            console.log(`✅ 百分比過濾模式完成 - 已按分數排序 ${finalCourses.length} 門課程:`);
            finalCourses.forEach((c, i) => {
              const scoreData = scoreMap.get(c.cos_id || c.code);
              if (scoreData) {
                const pathsText = (c.paths || []).map(p => [p.type, p.college, p.department, p.category].filter(x => x).join('/')).join('; ');
                console.log(`  ${i + 1}. [${scoreData.total}分] ${c.name} | ${c.teacher || '無'} | ${c.time || '無'} | 路徑:${pathsText || '無'} (內容:${scoreData.content} 時間:${scoreData.time} 地點:${scoreData.location} 路徑:${scoreData.path} 匹配:${scoreData.recommend})`);
              }
            });
          } else {
            console.log(`✅ 百分比過濾模式完成 - 返回 ${finalCourses.length} 門課程（未評分）`);
            finalCourses.forEach((c, i) => {
              const pathsText = (c.paths || []).map(p => [p.type, p.college, p.department, p.category].filter(x => x).join('/')).join('; ');
              console.log(`  ${i + 1}. ${c.name} | ${c.teacher || '無'} | ${c.time || '無'} | 路徑:${pathsText || '無'}`);
            });
          }

          const courseIds = finalCourses.map(course => course.cos_id || course.code);
          aiThinking.style.display = 'none';
          const totalSeconds = stopAITimer();
          console.log(`⏱️ 搜尋總花費時間：${totalSeconds} 秒`);
          addLog('info', `⏱️ 搜尋總花費時間：${totalSeconds} 秒`);
          addLog('success', `✅ 百分比過濾模式完成：找到 ${courseIds.length} 門符合「期末考 30%」的課程`);
          return { courseIds, scoreMap };
        }
      }

      // ===== Step 2：精準匹配（分塊並行處理）=====
      updateAIProgress('Step 2 進行中 - 精準匹配 (較長時間)', 60);
      console.log('\n🔍 ===== Step 2：AI 精準匹配（分塊並行處理）=====');
      console.log('🎯 精準模式：進入 Step 2 精準匹配');

      // 選擇輸入來源：如果有百分比過濾結果，使用它；否則使用 Step 1 結果
      const step2InputCourses = window._percentageFilteredCourses || step1Courses;
      const coursesFromPercentageFilter = !!window._percentageFilteredCourses; // 標記課程是否來自百分比過濾
      if (window._percentageFilteredCourses) {
        console.log(`📌 使用百分比過濾後的 ${step2InputCourses.length} 門課程作為 Step 2 輸入`);
        console.log('\n📋 送入 Step 2 的課程列表：');
        step2InputCourses.forEach((c, i) => {
          const pathsText = (c.paths || []).map(p =>
            [p.type, p.college, p.department, p.category].filter(x => x).join('/')
          ).join('; ');
          console.log(`  ${i + 1}. ${c.name} | ${c.dep_name || '無系所'} | 路徑: ${pathsText || '無路徑'}`);
        });
        delete window._percentageFilteredCourses; // 清理標記
      }

      // 分塊處理 Step 2，避免 MAX_TOKENS 錯誤
      const STEP2_CHUNK_SIZE = 200;  // 每塊 200 門課程
      const step2Chunks = [];
      for (let i = 0; i < step2InputCourses.length; i += STEP2_CHUNK_SIZE) {
        step2Chunks.push(step2InputCourses.slice(i, i + STEP2_CHUNK_SIZE));
      }

      console.log(`📦 將 ${step2InputCourses.length} 門課程分成 ${step2Chunks.length} 塊進行精準匹配`);

      const step2Promises = step2Chunks.map(async (chunk, chunkIdx) => {
        const courseList = chunk.map((c, i) => {
          const pathsText = (c.paths || []).map(p =>
            [p.type, p.college, p.department, p.category].filter(x => x).join('/')
          ).join('; ');

          const parts = [
            `${i + 1}. ${c.name}`,
            c.teacher || '',
            c.time || '',
            c.room || '',
            c.dep_name ? `系所:${c.dep_name}` : '',
            pathsText ? `路徑:${pathsText}` : '',
            c.cos_type || '',
            c.credits ? `${c.credits}學分` : '',
            c.code || '',
            c.memo || '',
            // 添加關鍵字用於百分比匹配
            c.extractedKeywords ? `關鍵字:${c.extractedKeywords.substring(0, 200)}${c.extractedKeywords.length > 200 ? '...' : ''}` : ''
          ].filter(p => p).join('｜');
          return parts;
        }).join('\n');

        // 分離必要項和可選項
        const requiredAttrs = Object.entries(attributeSets).filter(([k, [req, kw]]) => req === 'required' && kw.length > 0);
        const optionalAttrs = Object.entries(attributeSets).filter(([k, [req, kw]]) => req === 'optional' && kw.length > 0);

        // 格式化顯示關鍵字（統一處理所有屬性的二維陣列）
        const formatKeywords = (keywords) => {
          if (!Array.isArray(keywords) || keywords.length === 0) {
            return '(空)';
          }
          // 統一處理二維陣列：[[group1], [group2], ...] 表示 (group1) AND (group2)
          // 每個 group 內部是 OR 邏輯
          if (keywords.length === 1 && Array.isArray(keywords[0])) {
            // 只有一組：顯示為簡單列表（組內 OR）
            return keywords[0].join(', ');
          }
          // 多組：顯示為 [組1] AND [組2]
          return keywords.map((group, i) => `[${Array.isArray(group) ? group.join(', ') : group}]`).join(' AND ');
        };

        const step2Prompt = `精準匹配課程（嚴格檢查所有必要條件）

【用戶查詢】：${userQuery}

【必要條件（Required）】：
${requiredAttrs.length > 0 ? requiredAttrs.map(([k, [req, kw]]) => `${k}: ${formatKeywords(kw)}`).join('\n') : '無'}
${coursesFromPercentageFilter ? '\n⚠️ 【重要】這些課程已通過 JavaScript 精確百分比過濾，evaluation 條件已驗證，Step 2 不需要再檢查 evaluation 條件。' : ''}

【可選條件（Optional）】：
${optionalAttrs.length > 0 ? optionalAttrs.map(([k, [req, kw]]) => `${k}: ${formatKeywords(kw)}`).join('\n') : '無'}

課程列表：
${courseList}

匹配規則：

【二維陣列匹配邏輯】：
所有屬性的關鍵字都是二維陣列格式：[[group1], [group2], ...]
- **內層陣列（組內）**：OR 邏輯 - 匹配任一關鍵字即可
- **外層陣列（組間）**：AND 邏輯 - 必須每組都匹配至少一個關鍵字

1. 必要條件（Required）：
   - 所有 Required 屬性必須同時符合（AND 邏輯）

   - **評量方式匹配規則（evaluation）**：
     ${coursesFromPercentageFilter ?
     `* ⚠️ 【重要】這些課程已通過 JavaScript 精確百分比過濾，evaluation 條件已驗證
     * **Step 2 任務**：跳過 evaluation 檢查，專注於檢查其他 required 條件（如 paths、dep_name 等）
     * **所有課程的 evaluation 條件都視為符合**`
     :
     `* 如果 evaluation 關鍵字包含具體百分比（如「期末考 30%」「final exam 30%」），這是 **Required 條件**
     * 課程的「關鍵字」欄位**必須包含完全相同的百分比**
     * 如果關鍵字中有該評量方式但百分比不同（如「期末考 40%」），**必須淘汰**
     * 如果關鍵字中完全沒有該評量方式的百分比資訊，**必須淘汰**
     * 範例：evaluation: [[期末考 30%, final exam 30%]]
       ✓ 符合：關鍵字包含「期末考 30%」或「final exam 30%」
       ✗ 不符合：關鍵字包含「期末考 40%」（百分比不符）
       ✗ 不符合：關鍵字只有「期末考」但沒有百分比資訊`}

   - **其他關鍵字匹配規則（keywords）**【從關鍵字欄位匹配】：
     * keywords 屬性用於不屬於其他固定屬性的條件（如：英文授課、分組報告、實驗課等）
     * 從課程的「關鍵字」欄位中匹配
     * 二維陣列邏輯：[[group1], [group2]] = 每組都要匹配（AND），組內任一匹配即可（OR）
     * 範例 1：keywords: [[英文授課, EMI, English]]
       ✓ 符合：關鍵字包含「英文授課」或「EMI」或「English」
       ✗ 不符合：關鍵字中完全沒有相關詞彙
     * 範例 2：keywords: [[分組報告, group report], [實驗課, lab]]
       ✓ 符合：關鍵字同時包含（分組報告 OR group report）AND（實驗課 OR lab）
       ✗ 不符合：只有分組報告但沒有實驗課

   - **時間匹配規則（time）**【最高優先級、最嚴格】：
     時間關鍵字格式說明：
     * T1234n = 星期二上午+中午（第1,2,3,4,n節）
     * T56789 = 星期二下午（第5,6,7,8,9節）
     * Tabc = 星期二晚上（第a,b,c節）
     * M1234n = 星期一上午+中午

     匹配規則：
     * 關鍵字中的每個字元都必須出現在課程時間中
     * 範例 1：time: [[T1234n, T1, T2, T3, T4]] → 星期二上午
       ✓ 符合：T1, T2, T3, T4, T12, T34, T123, T234, T1234, T1n, T2n, T34n, T1234n
       ✗ 不符合：T56, T567, T789, T5678, Tabc, Tab, Tbc, M1, M2, W1234
       ✗ 重點：Tabc 是晚上，不符合上午條件！

     * 範例 2：time: [[Mabc, Wabc]] → 週一或週三晚上
       ✓ 符合：Mabc, Wabc, Mabc-, M56abcn, W9abc
       ✗ 不符合：M56, M78, Tab, Tabc（星期二晚上不是星期一或星期三）

     * 範例 3：time: [[T56789, T5, T6]] → 星期二下午
       ✓ 符合：T5, T6, T7, T56, T567, T56789, T5n, T56n
       ✗ 不符合：T1, T2, T3, T4, T1234, Tabc, M56

   - **路徑匹配規則（paths）**【寬鬆匹配】：
     * 檢查 paths 文字是否包含關鍵字
     * 只要匹配任一組內的任一關鍵字即可（雙重 OR）
     * **重要**：課程可能有多條路徑，只要**任一路徑**包含關鍵字即可
     * 範例 1：paths: [[資工, 資訊工程, DCP]]
       ✓ 符合：路徑包含「學士班課程/資訊學院/DCP(資訊工程學系)/一般學士班」
       ✓ 符合：路徑包含「學士班課程/醫學院/(醫學系)/一般學士班; 學士班課程/資訊學院/DCP(資訊工程學系)/一般學士班」（多路徑課程，其中一條是資工）
       ✗ 不符合：路徑只有「學士班課程/電機學院/UEE(電機工程學系)/一般學士班」（完全沒有資工相關路徑）

   - **教室/校區匹配規則（room）**【精確匹配】：
     * 檢查教室欄位是否包含關鍵字
     * 範例 1：room: [[HK, 客家大樓]] → 教室包含 HK 或「客家大樓」
       ✓ 符合：HK101[LJ], HK202[LJ], 客家大樓
       ✗ 不符合：EC114[GF], M117[GF]
     * 範例 2：room: [[EC]] → 工程三館（教室代碼包含 EC）
       ✓ 符合：EC114[GF], EC015[GF], EC316[GF]
       ✗ 不符合：EB101[GF], M117[GF], HK101[LJ]

   - 不符合任一 Required 屬性：直接淘汰

2. 可選條件（Optional）：
   - 符合會更好，但不是必須

輸出格式：
- 只輸出符合所有必要條件的課程編號（逗號分隔）
- 範例：1,3,5,7
- 無符合課程則輸出「無」`;

        const response = await callAIForKeywordGeneration(step2Prompt, 0.1, -1);  // Step 2: thinking=-1 (精準匹配需要更多思考)

        // 解析編號（格式：1,2,3）
        const numbers = response.match(/\d+/g);
        if (!numbers || numbers.length === 0) return [];

        return numbers.map(n => parseInt(n))
          .filter(n => n >= 1 && n <= chunk.length)
          .map(n => chunk[n - 1]);
      });

      const step2Results = await Promise.all(step2Promises);
      const step2CoursesAll = step2Results.flat();

      // 去重（按 cos_id 或 code）
      const step2CourseIdSet = new Set();
      const step2Courses = [];
      for (const course of step2CoursesAll) {
        const id = course.cos_id || course.code;
        if (!step2CourseIdSet.has(id)) {
          step2CourseIdSet.add(id);
          step2Courses.push(course);
        }
      }

      console.log(`✅ Step 2 完成 - 保留 ${step2Courses.length} 門精準匹配的課程`);

      let finalCourses = step2Courses;

      // ===== 後處理：應用排除條件 =====
      if (instructions.excludeKeywords.length > 0) {
        console.log('\n🚫 ===== 應用排除條件 =====');
        const beforeCount = finalCourses.length;

        // 校區名稱到代碼的對照表
        const campusCodeMap = {
          '光復校區': 'GF',
          '光復': 'GF',
          '六家校區': 'LJ',
          '六家': 'LJ',
          '博愛校區': 'BA',
          '博愛': 'BA',
          '台北陽明校區': 'YM',
          '台北陽明': 'YM',
          '陽明校區': 'YM',
          '陽明': 'YM'
        };

        finalCourses = finalCourses.filter(course => {
          // 檢查課程的所有屬性是否包含排除關鍵字
          for (const excludeKeyword of instructions.excludeKeywords) {
            const keyword = excludeKeyword.toLowerCase();

            // 檢查各個屬性
            if (course.name && course.name.toLowerCase().includes(keyword)) return false;
            if (course.teacher && course.teacher.toLowerCase().includes(keyword)) return false;
            if (course.dep_name && course.dep_name.toLowerCase().includes(keyword)) return false;
            if (course.cos_type && course.cos_type.toLowerCase().includes(keyword)) return false;
            if (course.code && course.code.toLowerCase().includes(keyword)) return false;
            if (course.time && course.time.toLowerCase().includes(keyword)) return false;
            if (course.room && course.room.toLowerCase().includes(keyword)) return false;

            // 特殊處理：校區代碼匹配（如「光復校區」→ 檢查是否包含 [GF]）
            const campusCode = campusCodeMap[excludeKeyword];
            if (campusCode && course.room && course.room.includes(`[${campusCode}]`)) return false;
          }
          return true;
        });

        const afterCount = finalCourses.length;
        const excludedCount = beforeCount - afterCount;
        if (excludedCount > 0) {
          addLog('info', `排除條件：排除了 ${excludedCount} 門課程`);
        }
      }

      // ===== 百分比精確匹配過濾 =====
      const percentageRequirements = extractPercentageRequirements(attributeSets);
      if (percentageRequirements.length > 0) {
        const beforeCount = finalCourses.length;

        finalCourses = finalCourses.filter(course => {
          const hasMismatch = hasMismatchedPercentage(course, percentageRequirements);
          return !hasMismatch;
        });

        const afterCount = finalCourses.length;
        const eliminatedCount = beforeCount - afterCount;
        if (eliminatedCount > 0) {
          addLog('info', `百分比過濾：淘汰了 ${eliminatedCount} 門課程`);
        }
      }

      // ===== 後處理：應用時間篩選 =====
      if (instructions.timeFilters.length > 0) {
        const beforeCount = finalCourses.length;

        finalCourses = finalCourses.filter(course => {
          if (!course.time) return false;

          // 檢查課程時間是否包含任一篩選條件
          const courseTime = course.time.toUpperCase();
          const hasMatch = instructions.timeFilters.some(filter => courseTime.includes(filter.toUpperCase()));
          return hasMatch;
        });

        const afterCount = finalCourses.length;
        const excludedCount = beforeCount - afterCount;
        if (excludedCount > 0) {
          addLog('info', `時間篩選：排除了 ${excludedCount} 門課程`);
        }
      }

      // ===== 後處理：應用課程類型篩選 =====
      if (instructions.courseTypeFilters.length > 0) {
        const beforeCount = finalCourses.length;

        finalCourses = finalCourses.filter(course => {
          // 檢查課程類型是否包含任一篩選條件
          const hasMatch = instructions.courseTypeFilters.some(filter => {
            // 特殊處理：通識課程（檢查 paths）
            if (filter === '通識') {
              if (course.paths && Array.isArray(course.paths)) {
                return course.paths.some(path => {
                  const typeText = (path.type || '').toLowerCase();
                  const categoryText = (path.category || '').toLowerCase();
                  const collegeText = (path.college || '').toLowerCase();

                  return typeText.includes('核心課程') ||
                         typeText.includes('通識') ||
                         categoryText.includes('核心課程') ||
                         categoryText.includes('通識') ||
                         typeText.includes('學士班共同課程') ||
                         collegeText.includes('通識');
                });
              }
              return false;
            }

            // 其他類型（必修、選修等）：直接比對 cos_type
            if (course.cos_type && course.cos_type.includes(filter)) {
              return true;
            }

            return false;
          });

          return hasMatch;
        });

        const afterCount = finalCourses.length;
        const excludedCount = beforeCount - afterCount;
        if (excludedCount > 0) {
          addLog('info', `課程類型篩選：排除了 ${excludedCount} 門課程`);
        }
      }

      // ===== 後處理：應用學分篩選 =====
      if (instructions.creditFilters.length > 0) {
        const beforeCount = finalCourses.length;

        finalCourses = finalCourses.filter(course => {
          if (!course.credits && course.credits !== 0) return false;

          const credits = parseInt(course.credits);
          const hasMatch = instructions.creditFilters.some(filter => {
            if (filter === '5+') {
              return credits >= 5;
            } else {
              return credits === parseInt(filter);
            }
          });

          return hasMatch;
        });

        const afterCount = finalCourses.length;
        const excludedCount = beforeCount - afterCount;
        if (excludedCount > 0) {
          addLog('info', `學分篩選：排除了 ${excludedCount} 門課程`);
        }
      }

      if (finalCourses.length === 0) {
        console.log('❌ Step 2 未找到符合的課程（或全部被排除）');
        addLog('warning', 'Step 2 完成：未找到符合的課程');
        updateAIProgress('未找到課程', 0);
        aiThinking.style.display = 'none';
        const totalSeconds = stopAITimer();
        addLog('info', `⏱️ 搜尋總花費時間：${totalSeconds} 秒`);
        return [];
      }

      console.log(`✅ Step 2 完成 - 最終匹配 ${finalCourses.length} 門課程:`);
      addLog('success', `Step 2 完成：精準匹配到 ${finalCourses.length} 門課程`);

      // 顯示前 20 門課程
      finalCourses.slice(0, 20).forEach((c, i) => {
        const pathsText = (c.paths || []).map(p => [p.type, p.college, p.department, p.category].filter(x => x).join('/')).join('; ');
        console.log(`  ${i + 1}. ${c.name} | ${c.time} | 路徑:${pathsText || '無'} | ${c.cos_type || ''}`);
      });
      if (finalCourses.length > 20) {
        console.log(`  ... 還有 ${finalCourses.length - 20} 門課程未顯示`);
      }

      // 檢查是否被中斷
      if (aiSearchCancelled) {
        console.log('⏹️ 搜尋已在 Step 3（評分）前被中斷');
        stopAITimer();
        aiThinking.style.display = 'none';
        cancelWarning.style.display = 'none';
        return [];
      }

      // ===== Step 3：評分（獨立步驟）=====
      updateAIProgress('Step 3 進行中 - 評分課程', 75);
      console.log('\n🔍 ===== Step 3：AI 評分（獨立評分步驟）=====');

      let scoreMap = null;
      try {
        scoreMap = await scoreCourses(finalCourses, userQuery, attributeSets, aiMode, instructions);
      } catch (error) {
        console.error('⚠️ Step 3 評分失敗，回退到 Step 2 結果（無分數）:', error);
        addLog('warning', 'Step 3 評分失敗，返回 Step 2 結果（無分數）');
        scoreMap = null;
      }

      // 按分數排序課程（如果評分成功）
      if (scoreMap && scoreMap.size > 0) {
        finalCourses.sort((a, b) => {
          const scoreA = scoreMap.get(a.cos_id || a.code);
          const scoreB = scoreMap.get(b.cos_id || b.code);
          const totalA = scoreA ? scoreA.total : 0;
          const totalB = scoreB ? scoreB.total : 0;
          return totalB - totalA;
        });

        // 過濾掉低於 30 分的課程（視為誤判）
        const beforeFilterCount = finalCourses.length;
        finalCourses = finalCourses.filter(course => {
          const scoreData = scoreMap.get(course.cos_id || course.code);
          return scoreData && scoreData.total >= 30;
        });
        const filteredCount = beforeFilterCount - finalCourses.length;
        if (filteredCount > 0) {
          console.log(`🗑️ 過濾掉 ${filteredCount} 門低分課程（< 30 分，視為誤判）`);
        }

        console.log(`✅ Step 3 完成 - 已按分數排序 ${finalCourses.length} 門課程（前10門）:`);
        finalCourses.slice(0, 10).forEach((c, i) => {
          const scoreData = scoreMap.get(c.cos_id || c.code);
          if (scoreData) {
            const pathsText = (c.paths || []).map(p => [p.type, p.college, p.department, p.category].filter(x => x).join('/')).join('; ');
            console.log(`  ${i + 1}. [${scoreData.total}分] ${c.name} | ${c.time} | 路徑:${pathsText || '無'} (內容:${scoreData.content} 時間:${scoreData.time} 地點:${scoreData.location} 路徑:${scoreData.path} 匹配:${scoreData.recommend})`);
          }
        });
      } else {
        console.log(`⚠️ Step 3 評分失敗或無結果，返回 Step 2 的 ${finalCourses.length} 門課程（無分數）`);
      }

      // 隱藏思考動畫並停止計時器
      aiThinking.style.display = 'none';
      const totalSeconds = stopAITimer();
      console.log(`⏱️ 搜尋總花費時間：${totalSeconds} 秒`);
      addLog('info', `⏱️ 搜尋總花費時間：${totalSeconds} 秒`);

      // 提取課程ID
      const courseIds = finalCourses.map(course => course.cos_id || course.code);
      console.log(`🎯 返回 ${courseIds.length} 個課程ID`);

      // ▶️ 恢復主動提取
      if (proactiveExtractionPaused) {
        proactiveExtractionPaused = false;
        console.log('▶️ 已恢復主動提取關鍵字');

        // 更新暫停按鈕狀態
        const stopLearningBtn = document.getElementById('stopLearningBtn');
        const learningProgressText = document.getElementById('learningProgressText');
        if (stopLearningBtn) {
          stopLearningBtn.textContent = '⏸';
          stopLearningBtn.title = '暫停提取';
        }
        if (learningProgressText) {
          learningProgressText.textContent = '🚀 主動提取關鍵字...';
        }
      }

      return { courseIds, scoreMap };
    } catch (error) {
      console.error('AI 搜尋失敗:', error);
      addLog('error', `AI 搜尋失敗：${error.message}`);
      updateAIProgress('搜尋失敗', 0);
      aiThinking.style.display = 'none';
      const totalSeconds = stopAITimer();
      console.log(`⏱️ 搜尋總花費時間：${totalSeconds} 秒`);
      addLog('info', `⏱️ 搜尋總花費時間：${totalSeconds} 秒`);

      // ▶️ 恢復主動提取（即使搜尋失敗）
      if (proactiveExtractionPaused) {
        proactiveExtractionPaused = false;
        console.log('▶️ 已恢復主動提取關鍵字');

        // 更新暫停按鈕狀態
        const stopLearningBtn = document.getElementById('stopLearningBtn');
        const learningProgressText = document.getElementById('learningProgressText');
        if (stopLearningBtn) {
          stopLearningBtn.textContent = '⏸';
          stopLearningBtn.title = '暫停提取';
        }
        if (learningProgressText) {
          learningProgressText.textContent = '🚀 主動提取關鍵字...';
        }
      }

      return null;
    }
  }

  // 從 AI 返回的文本中解析課程（通過課程名稱匹配）
  function parseAICoursesFromText(text, coursePool, userQuery, queryKeywords) {
    if (!text) return [];

    try {
      console.log('🔍 開始解析 AI 回應');
      console.log('🔍 AI 回應內容:', text.substring(0, 500) + '...');

      // 移除常見的前綴文字和 markdown 格式
      let cleanText = text
        .replace(/^(符合的課程編號|課程編號|編號|結果|分析|推薦)[：:]/i, '')
        .replace(/```[\s\S]*?```/g, '')  // 移除 code block
        .replace(/\*\*/g, '')  // 移除粗體標記
        .trim();

      // 檢查是否為「無」或空結果
      if (/^(無|沒有|找不到|not found|none)/i.test(cleanText)) {
        console.log('🔍 AI 回應：沒有找到符合的課程');
        return [];
      }

      const matchedCourses = [];

      // 檢查是否為課程列表格式（帶有｜分隔符）
      // 格式範例：1. 離散數學｜M34R7｜CS(資訊學院共同課程)
      const isListFormat = /｜/.test(cleanText);

      if (isListFormat) {
        console.log('🔍 檢測到課程列表格式，通過課程名稱+系所匹配');
        const lines = cleanText.split('\n').filter(line => line.trim().length > 0);

        for (const line of lines) {
          // 提取課程資訊（簡化版）
          // 格式：編號. 課程名｜時間｜路徑系所
          const match = line.match(/^\d+\.\s*([^｜]+)(?:｜([^｜]*)｜([^｜]*))?/);
          if (match) {
            const courseName = match[1].trim();
            const courseTime = match[2] ? match[2].trim() : null;
            const pathDepartment = match[3] ? match[3].trim() : null;  // 路徑系所

            console.log(`🔍 嘗試匹配課程: "${courseName}" (路徑: ${pathDepartment || '未指定'}, 時間: ${courseTime || '未指定'})`);

            // 在課程池中查找匹配的課程（優先匹配課程名+路徑系所）
            let foundCourse = null;

            // 方案1：課程名稱 + 路徑系所 完全匹配
            if (pathDepartment) {
              foundCourse = coursePool.find(c =>
                c.name === courseName && c.department === pathDepartment
              );
              if (foundCourse) {
                console.log(`  ✅ 精確匹配 (名稱+路徑): ${foundCourse.name} @ ${foundCourse.department} (${foundCourse.id})`);
              }
            }

            // 方案2：只匹配課程名稱（但如果有多個同名課程會警告）
            if (!foundCourse) {
              const sameName = coursePool.filter(c => c.name === courseName);
              if (sameName.length === 1) {
                foundCourse = sameName[0];
                console.log(`  ✅ 找到唯一匹配: ${foundCourse.name} (${foundCourse.id})`);
              } else if (sameName.length > 1) {
                // 有多個同名課程，取第一個但發出警告
                foundCourse = sameName[0];
                console.warn(`  ⚠️ 找到 ${sameName.length} 個同名課程，取第一個: ${foundCourse.name} @ ${foundCourse.department}`);
                console.warn(`  ⚠️ 其他課程: ${sameName.slice(1).map(c => `${c.name} @ ${c.department}`).join(', ')}`);
              }
            }

            if (foundCourse) {
              matchedCourses.push(foundCourse);
            } else {
              console.log(`  ⚠️ 未找到匹配的課程: "${courseName}"`);
            }
          }
        }

        console.log(`🔍 總共匹配到 ${matchedCourses.length} 門課程`);

        // 根據相關度排序結果
        console.log('🔍 開始按相關度排序結果...');
        const sortedCourses1 = sortByRelevance(matchedCourses, userQuery, queryKeywords);
        console.log('🔍 排序完成');

        return sortedCourses1;
      }

      // 如果是編號格式，優先提取格式化的編號列表
      // 格式1：逗號分隔（1, 2, 3, 5）或空格分隔（1 2 3 5）
      // 格式2：換行分隔或帶有項目符號（1. xxx\n2. xxx 或 - 1\n- 2）
      console.log('🔍 嘗試提取編號列表...');

      // 先嘗試提取連續的編號模式（更準確）
      let indices = [];

      // 方案1：提取「數字後跟逗號、空格或換行」的模式
      const numberPattern1 = /(?:^|\n|,|\s)(\d{1,4})(?=\s*[,\n]|$)/g;
      let match;
      const extractedNumbers = [];
      while ((match = numberPattern1.exec(cleanText)) !== null) {
        extractedNumbers.push(parseInt(match[1]));
      }

      // 檢查提取的編號是否合理（都在範圍內且數量不超過課程池的 80%）
      const validNumbers = extractedNumbers.filter(n => n >= 1 && n <= coursePool.length);
      if (validNumbers.length > 0 && validNumbers.length <= coursePool.length * 0.8) {
        indices = validNumbers;
        console.log(`🔍 方案1成功：提取到 ${indices.length} 個編號:`, indices.slice(0, 10).join(', '), '...');
      } else {
        // 方案2：提取所有數字，但過濾掉明顯不是編號的（如學分數、時間等）
        console.log('🔍 方案1失敗，嘗試方案2：提取所有合理編號...');
        const allNumbers = cleanText.match(/\b\d{1,4}\b/g);
        if (allNumbers) {
          // 過濾：1-4位數字，且在課程池範圍內
          const filtered = allNumbers
            .map(n => parseInt(n))
            .filter(n => n >= 1 && n <= coursePool.length);

          // 去重並排序
          indices = [...new Set(filtered)].sort((a, b) => a - b);

          console.log(`🔍 方案2：從 ${allNumbers.length} 個數字中提取到 ${indices.length} 個有效編號`);
        }
      }

      if (indices.length > 0) {
        console.log(`🔍 檢測到編號列表格式 (${indices.length} 個編號)`);
        console.log(`🔍 編號範圍: ${Math.min(...indices)} - ${Math.max(...indices)}`);

        for (const idx of indices) {
          const course = coursePool[idx - 1];
          console.log(`  ✅ 編號 ${idx} → ${course.name} @ ${course.department || course.dept} (${course.id})`);
          matchedCourses.push(course);
        }

        console.log(`🔍 總共匹配到 ${matchedCourses.length} 門課程`);

        // 根據相關度排序結果
        console.log('🔍 開始按相關度排序結果...');
        const sortedCourses2 = sortByRelevance(matchedCourses, userQuery, queryKeywords);
        console.log('🔍 排序完成');

        return sortedCourses2;
      }

      console.log('🔍 無法識別 AI 回應格式');
      return [];
    } catch (error) {
      console.error('解析 AI 回應失敗:', error);
      return [];
    }
  }

  // 根據 AI 策略動態構建寬鬆篩選 Prompt
  // 使用 AI 生成的 Prompt 模板構建完整 Prompt（寬鬆篩選）
  // promptTemplate: AI 生成的 prompt 文本（字符串）
  // courseSummaries: 課程摘要陣列
  function buildDynamicLoosePrompt(userQuery, promptTemplate, courseSummaries) {
    // 構建課程列表（包含完整資訊）
    const courseListText = courseSummaries.map((c, idx) => {
      // 格式化 paths 為可讀文本（paths 可能是字串或陣列）
      let pathsText = '';
      if (c.paths) {
        if (typeof c.paths === 'string') {
          // paths 已經是字串，直接使用
          pathsText = c.paths;
        } else if (Array.isArray(c.paths) && c.paths.length > 0) {
          // paths 是陣列，格式化成字串
          pathsText = c.paths.map(p => {
            const pathParts = [
              p.college || '',
              p.department || '',
              p.category || ''
            ].filter(x => x).join('/');
            return pathParts;
          }).filter(x => x).join('；');
        }
      }

      const parts = [
        `${idx + 1}. ${c.name}`,
        c.teacher || '',
        c.time || '',
        c.room || '',  // 教室
        c.dep_name || c.dep_cname || '',  // 開課單位
        pathsText ? `路徑:${pathsText}` : '',  // 選課路徑（重要！多個 path 分開顯示）
        c.cos_type || c.type || '',  // 必修/選修
        c.credits ? `${c.credits}學分` : '',
        c.code || '',  // 課程代碼
        c.cos_id || '',  // 課程ID
        c.memo || ''  // 備註
      ].filter(p => p).join('｜');
      return parts;
    }).join('\n');

    // 將 prompt 模板與課程列表組合
    return `${promptTemplate}

課程列表（編號 1-${courseSummaries.length}）：
${courseListText}

只輸出編號（逗號分隔）或「無」：`;
  }

  // 使用 AI 生成的 Prompt 模板構建完整 Prompt（精準篩選）
  // promptTemplate: AI 生成的 prompt 文本（字符串）
  // step1CourseListText: Step 1 生成的課程列表文本
  function buildDynamicPrecisePrompt(userQuery, promptTemplate, step1CourseListText) {
    // 將 prompt 模板與課程列表組合
    return `${promptTemplate}

課程列表：
${step1CourseListText}

只輸出編號（逗號分隔）或「無」：`;
  }

  // 構建課程搜尋專用的 AI 提示詞（寬鬆版 - 第一步）
  function buildLooseCourseSearchPrompt(userQuery, courseSummaries) {
    const courseListText = courseSummaries.map((c, idx) => {
      const parts = [
        `${idx + 1}. ${c.name}`,
        c.eng_name ? `(${c.eng_name})` : '',
        c.teacher || '',
        c.time || '',
        c.room || '',
        c.department || c.dep_name || '',
        c.college || '',
        c.type || '',
        c.credit ? `${c.credit}學分` : '',
        c.category || '',
        c.paths ? `[路徑:${c.paths}]` : '',
        c.note || '',
        c.memo || ''
      ].filter(p => p).join('｜');
      return parts;
    }).join('\n');

    return `從以下 ${courseSummaries.length} 門課程中找出可能相關的編號

查詢：${userQuery}

課程列表（編號 1-${courseSummaries.length}）：
${courseListText}

任務：寬鬆篩選，找出所有可能相關的課程
規則：
1. 只從上面列表中選擇，不要輸出超過 ${courseSummaries.length} 的編號
2. 只要部分符合就保留
3. 時間代碼：M=一 T=二 W=三 R=四 F=五
4. 時段：上午=節次1-4，下午=節次56789（包括傍晚），晚上=節次abc
5. 只輸出編號（逗號分隔，如1,5,12）或「無」

輸出：`;
  }

  // 構建課程搜尋專用的 AI 提示詞（精準版 - 第二步）
  // 接受第一步生成的課程列表文本作為輸入
  function buildPreciseCourseSearchPrompt(userQuery, step1CourseListText) {
    return `從以下課程中找出精確符合的編號（精準篩選）

課程列表：
${step1CourseListText}

查詢：${userQuery}

規則：
1. 所有條件必須同時滿足
2. "XX系的課"或"XX課" = 系所必須包含XX（如"資工課"需包含"資工"或"資訊工程"）
3. 時間代碼：M=一 T=二 W=三 R=四 F=五
4. 時段：上午=節次1-4，下午=節次56789（包括傍晚），晚上=節次abc
5. 部分匹配即可（如"王"匹配"王禹超"）

範例：
查詢：星期一下午的資工課
輸出：5（時間有M、節次>=5、系所包含"資工"或"資訊工程"）

只輸出編號（逗號分隔，如1,5,12）或「無」：`;
  }

  // 調用 Ollama API（課程搜尋）- 通過 background service worker
  // courseSummariesOrText: 寬鬆模式時是課程摘要數組，精準模式時是第一步生成的課程列表文本
  // customPrompt: 可選的自定義 prompt（來自 AI 動態生成）
  async function callOllamaAPIForCourseSearch(userQuery, courseSummariesOrText, isLooseFilter = false, customPrompt = null) {
    console.log('📞 callOllamaAPIForCourseSearch 被調用，模式:', isLooseFilter ? '寬鬆' : '精準');
    const prompt = customPrompt || (isLooseFilter
      ? buildLooseCourseSearchPrompt(userQuery, courseSummariesOrText)
      : buildPreciseCourseSearchPrompt(userQuery, courseSummariesOrText));
    console.log('📞 Prompt 長度:', prompt.length);
    if (customPrompt) console.log('📞 使用 AI 動態生成的 Prompt');

    // 設定不同的 temperature：寬鬆模式用 0.3（降低以減少冗長輸出），精準模式用 0.1
    const temperature = isLooseFilter ? 0.3 : 0.1;
    console.log('📞 Temperature:', temperature);

    try {
      console.log('📞 發送消息到 background...');
      const response = await chrome.runtime.sendMessage({
        action: 'callAI',
        provider: 'ollama',
        config: {
          url: aiConfig.ollama.url,
          model: aiConfig.ollama.model,
          temperature: temperature
        },
        prompt: prompt
      });

      console.log('📞 收到 background 回應:', response);

      // 驗證回應
      if (!response) {
        throw new Error('未收到 background worker 回應，擴充功能可能需要重新載入');
      }
      if (!response.success) {
        throw new Error(response.error || 'Ollama API 請求失敗');
      }
      if (response.data === undefined || response.data === null) {
        throw new Error('Ollama API 返回無有效資料');
      }

      return response.data;
    } catch (error) {
      // 檢查是否為擴充功能上下文失效
      if (error.message && error.message.includes('Extension context invalidated')) {
        console.error('❌ 擴充功能已被重新載入，請重新整理頁面');
      }
      console.error('❌ Ollama API 調用失敗:', error);
      throw error;
    }
  }

  // 調用 OpenAI API（課程搜尋）- 通過 background service worker
  // courseSummariesOrText: 寬鬆模式時是課程摘要數組，精準模式時是第一步生成的課程列表文本
  // customPrompt: 可選的自定義 prompt（來自 AI 動態生成）
  async function callOpenAIAPIForCourseSearch(userQuery, courseSummariesOrText, isLooseFilter = false, customPrompt = null) {
    const prompt = customPrompt || (isLooseFilter
      ? buildLooseCourseSearchPrompt(userQuery, courseSummariesOrText)
      : buildPreciseCourseSearchPrompt(userQuery, courseSummariesOrText));
    if (customPrompt) console.log('📞 使用 AI 動態生成的 Prompt');

    // 設定不同的 temperature：寬鬆模式用 0.3（降低以減少冗長輸出），精準模式用 0.1
    const temperature = isLooseFilter ? 0.3 : 0.1;

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'callAI',
        provider: 'openai',
        config: {
          key: aiConfig.openai.key,
          model: aiConfig.openai.model,
          temperature: temperature
        },
        prompt: prompt
      });

      // 驗證回應
      if (!response) {
        throw new Error('未收到 background worker 回應，擴充功能可能需要重新載入');
      }
      if (!response.success) {
        throw new Error(response.error || 'OpenAI API 請求失敗');
      }
      if (response.data === undefined || response.data === null) {
        throw new Error('OpenAI API 返回無有效資料');
      }

      return response.data;
    } catch (error) {
      if (error.message && error.message.includes('Extension context invalidated')) {
        console.error('❌ 擴充功能已被重新載入，請重新整理頁面');
      }
      console.error('OpenAI API 調用失敗:', error);
      throw error;
    }
  }

  // 調用 Gemini API（課程搜尋）- 通過 background service worker
  // courseSummariesOrText: 寬鬆模式時是課程摘要數組，精準模式時是第一步生成的課程列表文本
  // customPrompt: 可選的自定義 prompt（來自 AI 動態生成）
  async function callGeminiAPIForCourseSearch(userQuery, courseSummariesOrText, isLooseFilter = false, customPrompt = null) {
    const prompt = customPrompt || (isLooseFilter
      ? buildLooseCourseSearchPrompt(userQuery, courseSummariesOrText)
      : buildPreciseCourseSearchPrompt(userQuery, courseSummariesOrText));
    if (customPrompt) console.log('📞 使用 AI 動態生成的 Prompt');

    // 設定不同的 temperature：寬鬆模式用 0.3（降低以減少冗長輸出），精準模式用 0.1
    const temperature = isLooseFilter ? 0.3 : 0.1;

    // 設定 thinking budget：寬鬆模式不啟用（0），精準模式啟用動態思考（-1）
    const thinkingBudget = isLooseFilter ? 0 : -1;

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'callAI',
        provider: 'gemini',
        config: {
          key: aiConfig.gemini.key,
          model: aiConfig.gemini.model,
          temperature: temperature,
          thinkingBudget: thinkingBudget  // 精準模式使用思考，寬鬆模式不使用
        },
        prompt: prompt
      });

      // 驗證回應
      if (!response) {
        throw new Error('未收到 background worker 回應，擴充功能可能需要重新載入');
      }
      if (!response.success) {
        throw new Error(response.error || 'Gemini API 請求失敗');
      }
      if (response.data === undefined || response.data === null) {
        throw new Error('Gemini API 返回無有效資料');
      }

      return response.data;
    } catch (error) {
      if (error.message && error.message.includes('Extension context invalidated')) {
        console.error('❌ 擴充功能已被重新載入，請重新整理頁面');
      }
      console.error('Gemini API 調用失敗:', error);
      throw error;
    }
  }

  // 調用自定義 API（課程搜尋）- 通過 background service worker
  // courseSummariesOrText: 寬鬆模式時是課程摘要數組，精準模式時是第一步生成的課程列表文本
  // customPrompt: 可選的自定義 prompt（來自 AI 動態生成）
  async function callCustomAPIForCourseSearch(userQuery, courseSummariesOrText, isLooseFilter = false, customPrompt = null) {
    const prompt = customPrompt || (isLooseFilter
      ? buildLooseCourseSearchPrompt(userQuery, courseSummariesOrText)
      : buildPreciseCourseSearchPrompt(userQuery, courseSummariesOrText));
    if (customPrompt) console.log('📞 使用 AI 動態生成的 Prompt');

    // 設定不同的 temperature：寬鬆模式用 0.3（降低以減少冗長輸出），精準模式用 0.1
    const temperature = isLooseFilter ? 0.3 : 0.1;

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'callAI',
        provider: 'custom',
        config: {
          url: aiConfig.custom.url,
          key: aiConfig.custom.key,
          model: aiConfig.custom.model,
          temperature: temperature
        },
        prompt: prompt
      });

      // 驗證回應
      if (!response) {
        throw new Error('未收到 background worker 回應，擴充功能可能需要重新載入');
      }
      if (!response.success) {
        throw new Error(response.error || '自定義 API 請求失敗');
      }
      if (response.data === undefined || response.data === null) {
        throw new Error('自定義 API 返回無有效資料');
      }

      return response.data;
    } catch (error) {
      if (error.message && error.message.includes('Extension context invalidated')) {
        console.error('❌ 擴充功能已被重新載入，請重新整理頁面');
      }
      console.error('自定義 API 調用失敗:', error);
      throw error;
    }
  }

  // ==================== 單一 API 分塊並行處理 ====================
  // 將課程分塊並行調用同一個 API 多次，然後合併結果
  async function callAPIWithChunking(userQuery, courseSummaries, isLooseFilter, step1Strategy = null) {
    const totalCourses = courseSummaries.length;
    const provider = aiConfig.provider;

    // 根據課程數量決定分塊數（每塊約 20 門課程）
    const targetChunkSize = 20;  // 目標每塊 20 門課程（已移除 maxOutputTokens 限制 + 停用 thinking）
    const numChunks = Math.min(50, Math.max(2, Math.ceil(totalCourses / targetChunkSize)));  // 至少2塊，最多50塊
    const chunkSize = Math.ceil(totalCourses / numChunks);

    console.log(`🔀 單一 API (${provider}) 分塊並行處理：${totalCourses} 門課程分成 ${numChunks} 塊（每塊約 ${chunkSize} 門）`);

    // 將課程分塊
    const chunks = [];
    for (let i = 0; i < numChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, totalCourses);
      const chunk = courseSummaries.slice(start, end);

      if (chunk.length > 0) {
        chunks.push({
          chunkId: i + 1,
          courses: chunk,
          startIndex: start + 1  // 編號從 1 開始
        });
      }
    }

    console.log(`🔀 分塊詳情: ${chunks.map(c => `塊${c.chunkId}(${c.courses.length}門)`).join(', ')}`);

    // 分批並行調用 API（避免超過配額限制）
    const batchSize = 5;  // 每批 5 個請求
    const batchDelay = 1000;  // 批次間隔 1 秒
    const startTime = Date.now();

    console.log(`⏱️ 開始分批並行調用 ${chunks.length} 個 API 請求（每批 ${batchSize} 個，間隔 ${batchDelay}ms）...`);

    const results = [];
    const numBatches = Math.ceil(chunks.length / batchSize);

    for (let batchIndex = 0; batchIndex < numBatches; batchIndex++) {
      const batchStart = batchIndex * batchSize;
      const batchEnd = Math.min(batchStart + batchSize, chunks.length);
      const batch = chunks.slice(batchStart, batchEnd);

      console.log(`📦 處理第 ${batchIndex + 1}/${numBatches} 批（塊 ${batch[0].chunkId}-${batch[batch.length - 1].chunkId}，共 ${batch.length} 個請求）...`);

      const batchPromises = batch.map(async (chunk) => {
        const chunkStartTime = Date.now();
        try {
          console.log(`  🤖 塊${chunk.chunkId} [${new Date().toISOString().split('T')[1]}] 開始處理 ${chunk.courses.length} 門課程 (編號 ${chunk.startIndex}-${chunk.startIndex + chunk.courses.length - 1})...`);

          // 為每個 chunk 動態生成 prompt（基於策略或使用默認 prompt）
          const prompt = step1Strategy
            ? buildDynamicLoosePrompt(userQuery, step1Strategy, chunk.courses)
            : buildLooseCourseSearchPrompt(userQuery, chunk.courses);

          let result;
          switch (provider) {
            case 'ollama':
              result = await callOllamaAPIForCourseSearch(userQuery, chunk.courses, isLooseFilter, prompt);
              break;
            case 'openai':
              result = await callOpenAIAPIForCourseSearch(userQuery, chunk.courses, isLooseFilter, prompt);
              break;
            case 'gemini':
              result = await callGeminiAPIForCourseSearch(userQuery, chunk.courses, isLooseFilter, prompt);
              break;
            case 'custom':
              result = await callCustomAPIForCourseSearch(userQuery, chunk.courses, isLooseFilter, prompt);
              break;
            default:
              throw new Error('未知的 AI 提供商: ' + provider);
          }

          // 解析返回的編號（相對於該塊的編號）
          const numbersMatch = result.match(/\d+/g);
          const relativeIndices = numbersMatch ? numbersMatch.map(n => parseInt(n)) : [];

          // 將相對編號轉換為絕對編號
          const absoluteIndices = relativeIndices
            .filter(idx => idx >= 1 && idx <= chunk.courses.length)
            .map(idx => chunk.startIndex + idx - 1);

          const chunkDuration = ((Date.now() - chunkStartTime) / 1000).toFixed(2);
          console.log(`  ✅ 塊${chunk.chunkId} [${new Date().toISOString().split('T')[1]}] 完成，選出 ${absoluteIndices.length} 門課程 (耗時 ${chunkDuration}秒)`);

          return { chunkId: chunk.chunkId, absoluteIndices, success: true, duration: chunkDuration };
        } catch (error) {
          console.error(`  ❌ 塊${chunk.chunkId} 失敗:`, error);
          return { chunkId: chunk.chunkId, error: error.message, success: false };
        }
      });

      // 等待當前批次完成
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      console.log(`✅ 第 ${batchIndex + 1}/${numBatches} 批完成`);

      // 如果不是最後一批，等待間隔時間
      if (batchIndex + 1 < numBatches) {
        console.log(`⏸️ 等待 ${batchDelay}ms 後處理下一批...`);
        await new Promise(resolve => setTimeout(resolve, batchDelay));
      }
    }

    // 過濾出成功的結果
    const successResults = results.filter(r => r.success);

    if (successResults.length === 0) {
      throw new Error('所有分塊都失敗了');
    }

    const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`🔀 ${successResults.length}/${numChunks} 個分塊成功返回結果`);
    console.log(`⏱️ 總耗時: ${totalDuration}秒`);

    // 檢查是否真的並行執行（如果各塊耗時相近，說明是並行的）
    if (successResults.length > 1) {
      const durations = successResults.map(r => parseFloat(r.duration));
      const maxDuration = Math.max(...durations);
      const sumDuration = durations.reduce((a, b) => a + b, 0);
      const efficiency = (sumDuration / parseFloat(totalDuration)).toFixed(2);

      console.log(`⏱️ 並行效率: ${efficiency}x (${efficiency > 1.5 ? '✅ 真正並行' : '⚠️ 可能串行'})`);
      if (efficiency < 1.5) {
        console.warn('⚠️ 檢測到 API 可能串行處理請求，分塊功能可能無效。建議使用雲端 API 或禁用分塊。');
      }
    }

    // 合併所有絕對編號（去重）
    const allIndices = new Set();
    successResults.forEach(r => {
      r.absoluteIndices.forEach(idx => allIndices.add(idx));
    });

    const mergedIndices = Array.from(allIndices).sort((a, b) => a - b);

    console.log(`🔀 合併結果：共 ${mergedIndices.length} 門課程`);

    // 將結果格式化為文本
    return mergedIndices.join(', ');
  }

  // ==================== 關鍵字生成 API ====================
  // 統一的關鍵字生成函數，根據當前 AI 提供商調用對應 API
  async function callAIForKeywordGeneration(prompt, customTemperature = 0.1, customThinkingBudget = -1) {
    // 使用較低的 temperature 確保輸出穩定（可通過參數自訂）
    const temperature = customTemperature;
    const thinkingBudget = customThinkingBudget;

    try {
      let response;

      switch (aiConfig.provider) {
        case 'ollama':
          response = await chrome.runtime.sendMessage({
            action: 'callAI',
            provider: 'ollama',
            config: {
              url: aiConfig.ollama.url,
              model: aiConfig.ollama.model,
              temperature: temperature
            },
            prompt: prompt
          });
          break;

        case 'openai':
          response = await chrome.runtime.sendMessage({
            action: 'callAI',
            provider: 'openai',
            config: {
              key: aiConfig.openai.key,
              model: aiConfig.openai.model,
              temperature: temperature
            },
            prompt: prompt
          });
          break;

        case 'gemini':
          response = await chrome.runtime.sendMessage({
            action: 'callAI',
            provider: 'gemini',
            config: {
              key: aiConfig.gemini.key,
              model: aiConfig.gemini.model,
              temperature: temperature,
              thinkingBudget: thinkingBudget  // 可通過參數自訂思考預算
            },
            prompt: prompt
          });
          break;

        case 'custom':
          response = await chrome.runtime.sendMessage({
            action: 'callAI',
            provider: 'custom',
            config: {
              url: aiConfig.custom.url,
              key: aiConfig.custom.key,
              model: aiConfig.custom.model,
              temperature: temperature
            },
            prompt: prompt
          });
          break;

        default:
          throw new Error('未知的 AI 提供商: ' + aiConfig.provider);
      }

      // 驗證回應
      if (!response) {
        throw new Error('未收到 background worker 回應，擴充功能可能需要重新載入');
      }
      if (!response.success) {
        throw new Error(response.error || 'AI 關鍵字生成失敗');
      }
      if (response.data === undefined || response.data === null) {
        throw new Error('AI 返回無有效資料');
      }

      return response.data;
    } catch (error) {
      if (error.message && error.message.includes('Extension context invalidated')) {
        console.error('❌ 擴充功能已被重新載入，請重新整理頁面');
      }
      console.error('關鍵字生成 API 調用失敗:', error);
      throw error;
    }
  }

  // ==================== 從完整課程綱要提取搜尋關鍵字 ====================
  // 使用 AI 從完整課程綱要中提取關鍵字，用於搜尋功能（支援中英文雙語）
  async function extractKeywordsFromOutline(details, courseName) {
    // 如果 AI 未啟用或沒有課程資訊，返回空字串
    if (!aiEnabled || !details) {
      return details?.課程概述 || '';
    }

    // 組合完整課程綱要內容
    const outlineContent = [
      details.先修科目 && details.先修科目 !== '未提供' ? `先修科目：${details.先修科目}` : '',
      details.課程概述 && details.課程概述 !== '未提供' ? `課程概述：${details.課程概述}` : '',
      details.教科書 && details.教科書 !== '未提供' ? `教科書：${details.教科書}` : '',
      details.評量方式 && details.評量方式 !== '未提供' ? `評量方式：${details.評量方式}` : '',
      details.教學方法 && details.教學方法 !== '未提供' ? `教學方法：${details.教學方法}` : '',
      details.備註 && details.備註 !== '未提供' ? `備註：${details.備註}` : ''
    ].filter(Boolean).join('\n\n');

    // 如果沒有任何有效內容，返回空字串
    if (!outlineContent.trim()) {
      return '';
    }

    // 偵測綱要語言（簡單判斷：英文字符比例）
    const englishChars = outlineContent.match(/[a-zA-Z]/g) || [];
    const chineseChars = outlineContent.match(/[\u4e00-\u9fa5]/g) || [];
    const isEnglish = englishChars.length > chineseChars.length;

    let prompt;

    if (isEnglish) {
      // 英文綱要：提取英文關鍵字 + 中文翻譯
      prompt = `從以下完整課程綱要中提取搜尋關鍵字，並提供中英文雙語關鍵字。

課程名稱：${courseName}

完整課程綱要：
${outlineContent}

任務：
1. 分析【先修科目】：提取必備的前置知識、技能（如微積分、線性代數、程式設計等）
2. 分析【課程概述】：提取核心技術術語、概念、主題
3. 分析【教科書】：提取重要參考書籍、工具、框架名稱
4. 分析【評量方式】：提取評分相關關鍵詞**並保留配分占比**（如 midterm 30%、final exam 30%、programming assignments 40%）
5. 分析【教學方法】：提取教學形式關鍵詞（如翻轉教學、實驗課、線上課程等）
6. 保留所有專有名詞（演算法名稱、工具名稱、理論名稱、書名等）
7. 為每個英文關鍵字提供對應的中文翻譯
8. 移除冗長描述和連接詞
9. 輸出格式：英文關鍵字,中文翻譯,... （中英文混合，用逗號分隔）
10. 只輸出關鍵字，不要解釋

範例：
輸入：
先修科目：Calculus, Linear Algebra
課程概述：This course introduces data structures including arrays, linked lists, stacks, queues, trees, graphs, and covers sorting algorithms.
評量方式：Midterm exam 30%, Final exam 30%, Programming assignments 40%
教學方法：Lecture and lab sessions

輸出：Calculus,微積分,Linear Algebra,線性代數,data structures,資料結構,arrays,陣列,linked lists,鏈結串列,stacks,堆疊,queues,佇列,trees,樹,graphs,圖,sorting algorithms,排序演算法,midterm exam 30%,期中考 30%,final exam 30%,期末考 30%,programming assignments 40%,程式作業 40%,lecture,講課,lab,實驗

現在請為上述完整課程綱要提取中英文關鍵字：`;
    } else {
      // 中文綱要：提取中文關鍵字（可能包含英文專有名詞）
      prompt = `從以下完整課程綱要中提取搜尋關鍵字。

課程名稱：${courseName}

完整課程綱要：
${outlineContent}

任務：
1. 分析【先修科目】：提取必備的前置知識、技能（如微積分、線性代數、程式設計等）
2. 分析【課程概述】：提取核心技術術語、概念、主題
3. 分析【教科書】：提取重要參考書籍、工具、框架名稱
4. 分析【評量方式】：提取評分相關關鍵詞**並保留配分占比**（如 期中考 30%、期末考 30%、程式作業 40%）
5. 分析【教學方法】：提取教學形式關鍵詞（如翻轉教學、實驗課、線上課程等）
6. 保留所有專有名詞（演算法名稱、工具名稱、理論名稱、書名、英文專有名詞如 Python、API 等）
7. 移除冗長描述和連接詞
8. 每個關鍵字用逗號分隔
9. 只輸出關鍵字，不要解釋

範例：
輸入：
先修科目：微積分、線性代數
課程概述：本課程介紹資料結構的基本概念，包括陣列、鏈結串列、堆疊、佇列、樹狀結構、圖形等，並學習排序演算法。使用 Python 實作。
評量方式：期中考 30%、期末考 30%、程式作業 40%
教學方法：課堂講授與實驗課

輸出：微積分,線性代數,資料結構,陣列,鏈結串列,堆疊,佇列,樹狀結構,圖形,排序演算法,Python,實作,期中考 30%,期末考 30%,程式作業 40%,考試,講授,實驗課

現在請為上述完整課程綱要提取關鍵字：`;
    }

    try {
      // 設定 20 秒超時（AI API 可能需要較長時間）
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('AI API 請求超時')), 20000)
      );

      const response = await Promise.race([
        callAIForKeywordGeneration(prompt, 0.3, 0),
        timeoutPromise
      ]);

      // 清理結果（移除多餘空白和換行）
      return response.replace(/\n/g, ' ').trim();
    } catch (error) {
      // 檢查是否為 API 配額錯誤
      const errorMessage = error.message || String(error);
      const isQuotaError = errorMessage.includes('429') ||
                          errorMessage.includes('Resource') ||
                          errorMessage.includes('exhausted') ||
                          errorMessage.includes('quota') ||
                          errorMessage.includes('RESOURCE_EXHAUSTED');

      if (isQuotaError) {
        // API 配額錯誤，需要向上拋出以便暫停處理
        const quotaError = new Error('API_QUOTA_EXCEEDED: ' + errorMessage);
        quotaError.isQuotaError = true;
        throw quotaError;
      }

      // 其他錯誤（如超時、網路錯誤），返回原始概述作為後備
      console.warn('AI 提取關鍵字失敗，返回原始概述:', error);
      return details.課程概述 || '';
    }
  }

  // ==================== 自動批量提取關鍵字 ====================
  // 用於搜尋結果自動學習的變數
  let autoLearningCancelled = false;
  let autoLearningInProgress = false;

  // 自動為搜尋結果提取關鍵字（背景執行）
  async function autoExtractKeywordsForResults(courses) {
    if (!aiEnabled || !courses || courses.length === 0) {
      return;
    }

    // 如果已經在執行（包括主動提取），不重複執行
    if (autoLearningInProgress || proactiveExtractionInProgress) {
      console.log('⚠️ 關鍵字提取已在執行中，跳過自動提取');
      return;
    }

    // 🔧 確保載入最新的快取資料
    await loadCourseDetailsCache();

    // 過濾出尚未提取過關鍵字的課程
    const coursesToProcess = courses.filter(course => {
      const courseDetailsKey = getCourseDetailsKey(course);
      const cached = courseDetailsCache[courseDetailsKey];
      // 如果沒有緩存，或者沒有 searchKeywords 屬性（使用 hasOwnProperty 檢查，即使是空字串也算已提取）
      return !cached || !cached.hasOwnProperty('searchKeywords');
    });

    if (coursesToProcess.length === 0) {
      console.log('✅ 所有課程都已提取過關鍵字');
      return;
    }

    console.log(`🧠 開始自動提取關鍵字：共 ${coursesToProcess.length} 門課程需要處理`);

    // 顯示進度條
    autoLearningInProgress = true;
    autoLearningCancelled = false;
    const learningProgress = document.getElementById('learningProgress');
    const learningProgressText = document.getElementById('learningProgressText');
    const learningCounter = document.getElementById('learningCounter');
    const stopLearningBtn = document.getElementById('stopLearningBtn');

    learningProgress.style.display = 'block';
    learningProgressText.textContent = '正在提取關鍵字...';
    learningCounter.textContent = `(0/${coursesToProcess.length})`;

    // 停止按鈕事件
    stopLearningBtn.onclick = () => {
      autoLearningCancelled = true;
      learningProgressText.textContent = '正在停止...';
    };

    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    // 輔助函數：帶重試的課程資訊獲取
    async function fetchCourseWithRetry(course, maxRetries = 2) {
      const params = new URLSearchParams({
        acy: course.acy,
        sem: course.sem,
        cos_id: course.cos_id
      });

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          // 設定 15 秒超時
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 15000);

          const [baseResponse, descResponse] = await Promise.all([
            fetch('https://timetable.nycu.edu.tw/?r=main/getCrsOutlineBase', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: params.toString(),
              signal: controller.signal
            }),
            fetch('https://timetable.nycu.edu.tw/?r=main/getCrsOutlineDescription', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: params.toString(),
              signal: controller.signal
            })
          ]);

          clearTimeout(timeoutId);

          // 檢查回應狀態
          if (!baseResponse.ok || !descResponse.ok) {
            throw new Error(`HTTP ${baseResponse.status}/${descResponse.status}`);
          }

          // 嘗試解析 JSON
          let baseData, descData;

          try {
            const baseText = await baseResponse.text();
            const descText = await descResponse.text();

            baseData = JSON.parse(baseText);
            descData = JSON.parse(descText);

            return { baseData, descData };
          } catch (parseError) {
            // JSON 解析失敗，可能是 HTML 錯誤頁面或課程無資料
            if (parseError instanceof SyntaxError) {
              throw new Error(`無法解析課程資料（可能課程無大綱）`);
            }
            throw parseError;
          }
        } catch (error) {
          // 檢查是否為取消錯誤
          if (error.name === 'AbortError') {
            console.warn(`⏱️ 請求超時 (${course.cos_id})`);
          }
          if (attempt < maxRetries) {
            console.log(`🔄 重試 ${attempt + 1}/${maxRetries}: ${course.cos_id}`);
            // 重試前等待，使用指數退避
            await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
            continue;
          }
          throw error;
        }
      }
    }

    // ⭐ 批次並行處理課程（提升速度）
    const BATCH_SIZE = 20; // 每批同時處理 20 門課程
    const BATCH_DELAY = 500; // 批次之間延遲 0.5 秒

    // 處理單門課程的函數
    async function processCourse(course) {
      try {
        // 獲取課程詳細資訊（帶重試）
        const { baseData, descData } = await fetchCourseWithRetry(course);
        const details = extractCourseDetailsFromAPI(baseData, descData, course);

        // 從完整課程綱要提取關鍵字
        const courseDetailsKey = getCourseDetailsKey(course);
        if (details) {
          const keywords = await extractKeywordsFromOutline(details, course.name);
          details.searchKeywords = keywords;
          details._partial = false;
          if (keywords && keywords.length > 0) {
            console.log(`✅ [${course.name}] 關鍵字提取成功: ${keywords.substring(0, 150)}${keywords.length > 150 ? '...' : ''}`);
          } else {
            console.log(`⚠️ [${course.name}] 無有效課程綱要內容，關鍵字為空`);
          }
          // 儲存到緩存
          courseDetailsCache[courseDetailsKey] = details;
        } else {
          // 🔧 沒有課程詳細資訊，保存空標記避免重複嘗試
          console.log(`⚠️ [${course.name}] 無課程詳細資訊，跳過關鍵字提取`);
          courseDetailsCache[courseDetailsKey] = { searchKeywords: '', _partial: true };
        }

        return { success: true, course };
      } catch (error) {
        console.warn(`⚠️ 提取關鍵字失敗: ${course.name}`, error);

        // 如果失敗，仍然標記為已處理（避免下次再重複嘗試）
        const courseDetailsKey = getCourseDetailsKey(course);
        if (!courseDetailsCache[courseDetailsKey]) {
          courseDetailsCache[courseDetailsKey] = {
            searchKeywords: '',
            _partial: true // 標記為空，表示已嘗試過
          };
        }

        return { success: false, course, error };
      }
    }

    // 批次處理課程
    for (let i = 0; i < coursesToProcess.length; i += BATCH_SIZE) {
      if (autoLearningCancelled) {
        console.log('⚠️ 用戶取消了自動提取');
        break;
      }

      // 取得本批次的課程
      const batch = coursesToProcess.slice(i, i + BATCH_SIZE);

      // 並行處理本批次的所有課程
      const results = await Promise.allSettled(
        batch.map(course => processCourse(course))
      );

      // 統計結果
      results.forEach(result => {
        if (result.status === 'fulfilled') {
          if (result.value.success) {
            succeeded++;
          } else {
            failed++;
          }
        } else {
          failed++;
        }
        processed++;
      });

      // 💾 批次保存：每處理完一批就保存一次
      saveCourseDetailsCache();
      console.log(`💾 已保存批次進度：${processed}/${coursesToProcess.length}`);
      updateKeywordExtractionStatus();

      // 更新進度
      const progress = Math.floor((processed / coursesToProcess.length) * 100);
      learningCounter.textContent = `${progress}% (${processed}/${coursesToProcess.length})`;
      learningProgressText.textContent = `正在提取關鍵字... ${succeeded} 成功${failed > 0 ? `, ${failed} 失敗` : ''}`;

      // 批次之間延遲（避免觸發伺服器限流）
      if (processed < coursesToProcess.length) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
      }
    }

    // 完成 - 最後保存一次確保所有進度都被保存
    saveCourseDetailsCache();
    console.log(`💾 最終保存完成：${processed}/${coursesToProcess.length}`);
    updateKeywordExtractionStatus();

    autoLearningInProgress = false;
    if (autoLearningCancelled) {
      learningProgressText.textContent = `已停止 - 處理了 ${processed}/${coursesToProcess.length} 門課程`;
    } else {
      learningProgressText.textContent = `✅ 完成！處理了 ${succeeded} 門課程${failed > 0 ? `，${failed} 門失敗` : ''}`;
    }

    // 2秒後隱藏進度條
    setTimeout(() => {
      learningProgress.style.display = 'none';
    }, 2000);

    console.log(`🎉 自動提取完成：${succeeded} 成功，${failed} 失敗，共處理 ${processed}/${coursesToProcess.length}`);
  }

  // ==================== 主動提取關鍵字（後台執行）====================
  // 應用啟動時主動為所有課程提取關鍵字，提升 AI 搜尋品質
  let proactiveExtractionInProgress = false;
  let proactiveExtractionPaused = false;

  async function proactiveExtractKeywords(allCourses) {
    if (!aiEnabled || !allCourses || allCourses.length === 0) {
      console.log('⚠️ AI 未啟用或無課程資料，跳過主動提取');
      return;
    }

    // 如果已經在執行（包括自動提取），不重複執行
    if (proactiveExtractionInProgress || autoLearningInProgress) {
      console.log('⚠️ 關鍵字提取已在執行中，跳過主動提取');
      return;
    }

    // 🔧 確保載入最新的快取資料
    await loadCourseDetailsCache();
    console.log(`📦 已載入快取：${Object.keys(courseDetailsCache).length} 門課程`);

    // 過濾出尚未提取過關鍵字的課程
    const coursesToProcess = allCourses.filter(course => {
      const courseDetailsKey = getCourseDetailsKey(course);
      const cached = courseDetailsCache[courseDetailsKey];
      // 如果沒有緩存，或者沒有 searchKeywords 屬性（使用 hasOwnProperty 檢查，即使是空字串也算已提取）
      return !cached || !cached.hasOwnProperty('searchKeywords');
    });

    if (coursesToProcess.length === 0) {
      console.log('✅ 所有課程都已提取過關鍵字，無需主動提取');
      return;
    }

    const totalCount = coursesToProcess.length;
    const alreadyProcessed = allCourses.length - totalCount;

    console.log(`🚀 主動提取模式啟動：`);
    console.log(`   📊 總課程數：${allCourses.length} 門`);
    console.log(`   ✅ 已有關鍵字：${alreadyProcessed} 門 (${Math.floor(alreadyProcessed / allCourses.length * 100)}%)`);
    console.log(`   🔄 待提取：${totalCount} 門`);
    // 預估：每批 20 門，約 2.5 秒（包含 API 請求 + 0.5 秒延遲）→ 每秒約 8 門
    const estimatedSeconds = Math.ceil(totalCount / 8);
    const estimatedMinutes = Math.floor(estimatedSeconds / 60);
    const remainingSeconds = estimatedSeconds % 60;
    if (estimatedMinutes > 0) {
      console.log(`   ⏱️ 預估時間：約 ${estimatedMinutes} 分 ${remainingSeconds} 秒`);
    } else {
      console.log(`   ⏱️ 預估時間：約 ${estimatedSeconds} 秒`);
    }

    proactiveExtractionInProgress = true;
    proactiveExtractionPaused = false;

    // 🎨 顯示 UI 進度條
    const learningProgress = document.getElementById('learningProgress');
    const learningProgressText = document.getElementById('learningProgressText');
    const learningCounter = document.getElementById('learningCounter');
    const stopLearningBtn = document.getElementById('stopLearningBtn');

    if (learningProgress) {
      learningProgress.style.display = 'block';
      learningProgressText.textContent = '🚀 主動提取關鍵字...';
      learningCounter.textContent = `0% (0/${totalCount})`;

      // 暫停/繼續按鈕初始化
      stopLearningBtn.textContent = '⏸';
      stopLearningBtn.title = '暫停提取';

      // 暫停/繼續按鈕事件
      stopLearningBtn.onclick = () => {
        if (proactiveExtractionPaused) {
          // 目前是暫停狀態 → 繼續執行
          proactiveExtractionPaused = false;
          stopLearningBtn.textContent = '⏸';
          stopLearningBtn.title = '暫停提取';
          learningProgressText.textContent = '🚀 主動提取關鍵字...';
          console.log('▶️ 用戶恢復了主動提取');
        } else {
          // 目前是執行狀態 → 暫停
          proactiveExtractionPaused = true;
          stopLearningBtn.textContent = '▶';
          stopLearningBtn.title = '繼續提取';
          learningProgressText.textContent = '⏸️ 已暫停...';
          console.log('⏸️ 用戶暫停了主動提取');
        }
      };
    }

    // 批次大小：每批處理 20 門課程（避免 API 限流）
    const BATCH_SIZE = 20;
    // 批次延遲：每批之間延遲 0.5 秒
    const BATCH_DELAY = 500;

    let processed = 0;
    let succeeded = 0;
    let failed = 0;
    let consecutiveQuotaErrors = 0; // 連續 API 配額錯誤計數
    const QUOTA_ERROR_THRESHOLD = 3; // 連續 3 次配額錯誤就暫停

    // 輔助函數：帶重試的課程資訊獲取
    async function fetchCourseWithRetry(course, maxRetries = 2) {
      const params = new URLSearchParams({
        acy: course.acy,
        sem: course.sem,
        cos_id: course.cos_id
      });

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          // 設定 15 秒超時
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 15000);

          const [baseResponse, descResponse] = await Promise.all([
            fetch('https://timetable.nycu.edu.tw/?r=main/getCrsOutlineBase', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: params.toString(),
              signal: controller.signal
            }),
            fetch('https://timetable.nycu.edu.tw/?r=main/getCrsOutlineDescription', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: params.toString(),
              signal: controller.signal
            })
          ]);

          clearTimeout(timeoutId);

          if (!baseResponse.ok || !descResponse.ok) {
            throw new Error(`HTTP ${baseResponse.status}/${descResponse.status}`);
          }

          let baseData, descData;

          try {
            const baseText = await baseResponse.text();
            const descText = await descResponse.text();

            baseData = JSON.parse(baseText);
            descData = JSON.parse(descText);

            return { baseData, descData };
          } catch (parseError) {
            if (parseError instanceof SyntaxError) {
              throw new Error(`無法解析課程資料（可能課程無大綱）`);
            }
            throw parseError;
          }
        } catch (error) {
          // 檢查是否為取消錯誤
          if (error.name === 'AbortError') {
            console.warn(`⏱️ 請求超時 (${course.cos_id})`);
          }
          if (attempt < maxRetries) {
            console.log(`🔄 重試 ${attempt + 1}/${maxRetries}: ${course.cos_id}`);
            await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
            continue;
          }
          throw error;
        }
      }
    }

    // 處理單個課程
    async function processCourse(course) {
      const courseDetailsKey = getCourseDetailsKey(course);
      try {
        const { baseData, descData } = await fetchCourseWithRetry(course);
        const details = extractCourseDetailsFromAPI(baseData, descData, course);

        // 從完整課程綱要提取關鍵字
        if (details) {
          const keywords = await extractKeywordsFromOutline(details, course.name);
          details.searchKeywords = keywords;
          details._partial = false;

          // 儲存到緩存（不立即寫入存儲，由批次處理統一保存）
          courseDetailsCache[courseDetailsKey] = details;

          return { success: true, course };
        } else {
          // 🔧 即使失敗也保存空標記，避免重複嘗試無綱要的課程
          console.warn(`⚠️ 無詳細資訊: ${course.name} (${course.cos_id})`);
          courseDetailsCache[courseDetailsKey] = { searchKeywords: '', _partial: true };
          return { success: false, course, error: '無課程詳細資訊' };
        }
      } catch (error) {
        // 檢查是否為 API 配額錯誤
        if (error.isQuotaError) {
          // 配額錯誤，不保存空標記（之後可以重試）
          console.error(`🚫 API 配額已用盡: ${course.name} (${course.cos_id})`);
          return { success: false, course, error: error.message, isQuotaError: true };
        }

        // 其他錯誤，保存空標記避免重複嘗試失敗的課程
        console.warn(`❌ 處理失敗: ${course.name} (${course.cos_id}) - ${error.message}`);
        courseDetailsCache[courseDetailsKey] = { searchKeywords: '', _partial: true };
        return { success: false, course, error: error.message };
      }
    }

    // 批次處理課程
    for (let i = 0; i < coursesToProcess.length; i += BATCH_SIZE) {
      // 檢查是否被停止
      if (!proactiveExtractionInProgress) {
        console.log('⏹️ 主動提取已被停止');
        break;
      }

      // 檢查是否暫停
      if (proactiveExtractionPaused) {
        // 顯示暫停狀態
        if (learningProgress) {
          learningProgressText.textContent = '⏸️ 已暫停...';
        }
      }
      while (proactiveExtractionPaused) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      // 恢復後更新文字
      if (learningProgress) {
        learningProgressText.textContent = `🚀 主動提取關鍵字... ${succeeded} 成功${failed > 0 ? `, ${failed} 失敗` : ''}`;
      }

      // 取得本批次的課程
      const batch = coursesToProcess.slice(i, i + BATCH_SIZE);

      // 並行處理本批次的所有課程
      const results = await Promise.allSettled(
        batch.map(course => processCourse(course))
      );

      // 統計結果
      let batchHasQuotaError = false;
      results.forEach(result => {
        if (result.status === 'fulfilled') {
          if (result.value.success) {
            succeeded++;
            consecutiveQuotaErrors = 0; // 成功則重置計數器
          } else {
            failed++;
            // 檢查是否為配額錯誤
            if (result.value.isQuotaError) {
              consecutiveQuotaErrors++;
              batchHasQuotaError = true;
            } else {
              consecutiveQuotaErrors = 0; // 非配額錯誤則重置計數器
            }
          }
        } else {
          failed++;
          consecutiveQuotaErrors = 0; // Promise rejected 視為其他錯誤
        }
        processed++;
      });

      // 檢查是否達到配額錯誤閾值
      if (consecutiveQuotaErrors >= QUOTA_ERROR_THRESHOLD) {
        console.error(`🚫 檢測到連續 ${consecutiveQuotaErrors} 次 API 配額錯誤，停止提取`);

        // 顯示錯誤提示
        if (learningProgress) {
          learningProgressText.textContent = `❌ API 配額已用盡`;
          learningProgressText.style.color = '#f44336';
          learningCounter.textContent = `已處理 ${processed}/${totalCount}`;
        }

        // 提示使用者
        alert('⚠️ API 配額已用盡\n\n' +
              '關鍵字提取已暫停。\n\n' +
              '可能原因：\n' +
              '• 未連結帳單帳戶（每分鐘限制 15 次請求）\n' +
              '• 已達到每日配額限制\n\n' +
              '解決方法：\n' +
              '1. 前往設定 → AI 設定查看詳細說明\n' +
              '2. 連結帳單帳戶以提升額度（1,000 RPM）\n' +
              '3. 稍後重新開啟擴充功能，系統會自動繼續提取');

        // 保存當前進度
        saveCourseDetailsCache();

        // 停止提取
        proactiveExtractionInProgress = false;

        // 5 秒後隱藏進度條
        setTimeout(() => {
          if (learningProgress) {
            learningProgress.style.display = 'none';
          }
        }, 5000);

        return; // 跳出循環
      }

      // 💾 批次保存：每處理完一批就保存一次
      saveCourseDetailsCache();
      console.log(`💾 已保存批次進度：${processed}/${totalCount}`);
      updateKeywordExtractionStatus();

      // 🎨 更新 UI 進度
      if (learningProgress) {
        const progress = Math.floor((processed / totalCount) * 100);
        learningCounter.textContent = `${progress}% (${processed}/${totalCount})`;
        learningProgressText.textContent = `🚀 主動提取關鍵字... ${succeeded} 成功${failed > 0 ? `, ${failed} 失敗` : ''}`;
      }

      // 每處理 10 門課程輸出一次進度
      if (processed % 10 === 0 || processed === coursesToProcess.length) {
        const progress = Math.floor((processed / totalCount) * 100);
        console.log(`📈 主動提取進度：${progress}% (${processed}/${totalCount}) - 成功 ${succeeded}，失敗 ${failed}`);
      }

      // 批次之間延遲（避免觸發伺服器限流）
      if (processed < coursesToProcess.length) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
      }
    }

    // 完成 - 最後保存一次確保所有進度都被保存
    saveCourseDetailsCache();
    console.log(`💾 最終保存完成：${processed}/${totalCount}`);
    updateKeywordExtractionStatus();

    const wasStopped = !proactiveExtractionInProgress;
    proactiveExtractionInProgress = false;
    const finalProgress = Math.floor((alreadyProcessed + succeeded) / allCourses.length * 100);

    if (wasStopped) {
      console.log(`⏹️ 主動提取已停止`);
      console.log(`   ✅ 已提取：${succeeded} 門`);
      console.log(`   ❌ 失敗：${failed} 門`);
      console.log(`   📊 處理進度：${processed}/${totalCount}`);
    } else {
      console.log(`🎉 主動提取完成！`);
      console.log(`   ✅ 新提取成功：${succeeded} 門`);
      console.log(`   ❌ 失敗：${failed} 門`);
      console.log(`   📊 總覆蓋率：${finalProgress}% (${alreadyProcessed + succeeded}/${allCourses.length})`);
    }

    // 🎨 更新 UI 最終狀態
    if (learningProgress) {
      const finalDisplayProgress = Math.floor((processed / totalCount) * 100);
      if (wasStopped) {
        learningProgressText.textContent = `⏹️ 已停止 - 處理了 ${processed}/${totalCount} 門課程`;
        learningCounter.textContent = `${finalDisplayProgress}% (${processed}/${totalCount})`;
      } else {
        learningProgressText.textContent = `✅ 主動提取完成！處理了 ${succeeded} 門課程${failed > 0 ? `，${failed} 門失敗` : ''}`;
        learningCounter.textContent = `100% (${totalCount}/${totalCount})`;
      }

      // 3秒後隱藏進度條
      setTimeout(() => {
        learningProgress.style.display = 'none';
      }, 3000);
    }

    // 發送通知（如果成功提取了大量課程）
    if (!wasStopped && succeeded >= 10) {
      addLog('success', `主動提取完成：成功為 ${succeeded} 門課程提取關鍵字，總覆蓋率 ${finalProgress}%`);
    }
  }

  // ==================== 整合到現有搜尋流程 ====================

  // 覆蓋原有的 performSearch 函數，添加 AI 搜尋功能
  const originalPerformSearch = performSearch;

  performSearch = async function() {
    const query = searchInput.value.trim();

    // 如果啟用了 AI 搜尋，直接用 AI 篩選課程
    if (aiEnabled && aiSearchToggle.classList.contains('active') && query) {
      try {
        // 顯示載入動畫
        loadingDiv.style.display = 'block';
        resultsDiv.innerHTML = '';

        // 從 Chrome Storage 讀取課程資料
        chrome.storage.local.get(['courseData'], async function(result) {
          if (!result.courseData || result.courseData.length === 0) {
            loadingDiv.style.display = 'none';
            aiThinking.style.display = 'none';
            stopAITimer();
            resultsDiv.innerHTML = `
              <div class="no-results">
                <p>尚未載入課程資料</p>
                <p style="margin-top: 8px; font-size: 12px;">
                  請先訪問 <a href="https://timetable.nycu.edu.tw/" target="_blank">timetable.nycu.edu.tw</a>
                </p>
              </div>
            `;
            return;
          }

          try {
            // 用 AI 直接篩選課程
            const aiResult = await searchCoursesWithAI(query, result.courseData);

            if (aiResult && aiResult.courseIds && aiResult.courseIds.length > 0) {
              const { courseIds: matchedCourseIds, scoreMap } = aiResult;
              console.log('🤖 開始匹配課程，AI返回的ID:', matchedCourseIds);

              // 根據 AI 返回的課程 ID 篩選課程（保持 AI 排序）
              const matchedCourses = [];
              for (const courseId of matchedCourseIds) {
                const course = result.courseData.find(c => c.cos_id === courseId || c.code === courseId);
                if (course) {
                  matchedCourses.push(course);
                }
              }

              console.log('🤖 匹配到的課程數量:', matchedCourses.length);

              // Debug: 顯示匹配課程的詳細資訊
              console.log('📋 AI 匹配的課程詳細資訊:');
              matchedCourses.forEach(c => {
                console.log(`  - ${c.name} | 時間: ${c.time} | 開課系所: ${c.dep_name}`);
              });

              if (matchedCourses.length === 0) {
                console.warn('⚠️ AI 返回了課程ID，但無法在資料庫中找到匹配的課程');
                console.log('課程資料庫前5筆ID範例:', result.courseData.slice(0, 5).map(c => ({ cos_id: c.cos_id, code: c.code, name: c.name })));
              }

              // 應用篩選條件
              const filteredResults = applyFilters(matchedCourses);
              currentResults = filteredResults;

              // 停止計時並獲取總時間
              aiThinking.style.display = 'none';
              const totalSeconds = stopAITimer();

              // 顯示結果（包含搜尋時間和分數）
              loadingDiv.style.display = 'none';
              displayResults(filteredResults, totalSeconds, scoreMap);

              console.log('🤖 AI 找到', matchedCourses.length, '門課程，應用篩選器後剩餘', filteredResults.length, '門');
              console.log(`⏱️ 搜尋總花費時間：${totalSeconds} 秒`);

              // 顯示完整信息
              if (matchedCourses.length !== filteredResults.length && hasActiveFilters()) {
                addLog('success', `AI 找到 ${matchedCourses.length} 門課程，應用篩選器後剩餘 ${filteredResults.length} 門`);
                addLog('warning', `已有 ${matchedCourses.length - filteredResults.length} 門課程被篩選器過濾（星期、學分、學院等）`);
              } else {
                addLog('success', `搜尋完成：找到 ${filteredResults.length} 門課程`);
              }
              addLog('info', `⏱️ 搜尋總花費時間：${totalSeconds} 秒`);
            } else {
              // AI 沒找到匹配課程
              // 檢查是否包含百分比查詢（如果是百分比查詢，不要回退到傳統搜尋）
              const hasPercentageQuery = /\d+%/.test(query);

              if (hasPercentageQuery) {
                // 百分比查詢不回退，直接顯示空結果
                console.log('AI 未找到符合百分比要求的課程，不回退到傳統搜尋');
                addLog('warning', 'AI 未找到符合百分比要求的課程');
                addLog('info', '提示：傳統搜尋無法精確匹配百分比，已禁用回退');
                loadingDiv.style.display = 'none';
                aiThinking.style.display = 'none';
                const totalSeconds = stopAITimer();
                console.log(`⏱️ AI 搜尋花費時間：${totalSeconds} 秒`);
                addLog('info', `⏱️ AI 搜尋花費時間：${totalSeconds} 秒`);
                displayResults([], totalSeconds);
                return;
              }

              // 非百分比查詢，降級到傳統搜尋
              console.log('AI 未找到匹配課程，使用傳統搜尋');
              addLog('info', 'AI 未找到匹配課程，使用傳統搜尋');
              loadingDiv.style.display = 'none';
              aiThinking.style.display = 'none';
              const totalSeconds = stopAITimer();
              console.log(`⏱️ AI 搜尋花費時間：${totalSeconds} 秒`);
              addLog('info', `⏱️ AI 搜尋花費時間：${totalSeconds} 秒`);
              return originalPerformSearch.call(this);
            }
          } catch (error) {
            console.error('AI 搜尋失敗，降級到傳統搜尋:', error);
            addLog('error', `AI 搜尋失敗，降級到傳統搜尋：${error.message}`);
            loadingDiv.style.display = 'none';
            aiThinking.style.display = 'none';
            const totalSeconds = stopAITimer();
            console.log(`⏱️ AI 搜尋花費時間：${totalSeconds} 秒`);
            addLog('info', `⏱️ AI 搜尋花費時間：${totalSeconds} 秒`);
            return originalPerformSearch.call(this);
          }
        });

        return; // 阻止執行原有的搜尋邏輯
      } catch (error) {
        console.error('AI 搜尋失敗，降級到傳統搜尋:', error);
        // 失敗時繼續使用原始查詢
      }
    }

    // 調用原有的搜尋邏輯
    return originalPerformSearch.call(this);
  };

});
