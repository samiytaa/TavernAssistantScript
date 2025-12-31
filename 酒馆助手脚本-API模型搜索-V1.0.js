(function () {
  'use strict';

  const SEARCH_INPUT_ID = 'acu-api-model-search';
  const STORAGE_KEY_SEARCH_STATE = 'acu_api_model_search_state';
  const MODEL_SELECT_ID = 'shujuku_v90-api-model';

  let isInitialized = false;
  let originalOptions = []; // 保存原始选项数据
  let searchInput = null;
  let modelSelect = null;
  let isFiltering = false; // 标记是否正在过滤中，防止 MutationObserver 误触发

  // 获取核心依赖
  const getCore = () => {
    const w = window.parent || window;
    const $ = w.jQuery || window.jQuery;
    return {
      $,
      $parent: (selector) => $(selector, w.document),
      getDB: () => w.AutoCardUpdaterAPI || window.AutoCardUpdaterAPI
    };
  };

  // 保存搜索状态
  const saveSearchState = (value) => {
    try {
      localStorage.setItem(STORAGE_KEY_SEARCH_STATE, value || '');
    } catch (e) {
      console.error('[API模型搜索] 保存搜索状态失败:', e);
    }
  };

  // 加载搜索状态
  const loadSearchState = () => {
    try {
      return localStorage.getItem(STORAGE_KEY_SEARCH_STATE) || '';
    } catch (e) {
      return '';
    }
  };

  // 保存原始选项 - 强制模式会忽略数量检查
  const saveOriginalOptions = (force = false) => {
    if (!modelSelect) return false;

    const { $ } = getCore();
    if (!$) return false;

    const $select = $(modelSelect);
    const options = $select.find('option');

    // 检查是否是占位符
    if (options.length <= 1) {
      const firstText = options.first().text() || '';
      if (firstText.includes('请先') || firstText.includes('加载') || firstText.includes('未找到') || firstText === '') {
        console.log('[API模型搜索] 模型列表尚未加载或为空，跳过保存');
        return false;
      }
    }

    const newOptions = [];
    options.each(function () {
      const $option = $(this);
      newOptions.push({
        value: $option.attr('value') || '',
        text: $option.text() || '',
        selected: $option.prop('selected'),
        disabled: $option.prop('disabled')
      });
    });

    // 强制保存或新选项数量更多时才更新
    if (force || newOptions.length > originalOptions.length) {
      originalOptions = newOptions;
      console.log(`[API模型搜索] 已保存 ${originalOptions.length} 个模型选项`);
      return true;
    }

    return false;
  };

  // 恢复原始选项
  const restoreOriginalOptions = () => {
    if (!modelSelect || originalOptions.length === 0) return;

    const { $ } = getCore();
    if (!$) return;

    isFiltering = true;
    const $select = $(modelSelect);
    const currentValue = $select.val();

    $select.empty();
    originalOptions.forEach(option => {
      const $option = $('<option>', {
        value: option.value,
        text: option.text
      });
      if (option.selected) $option.prop('selected', true);
      if (option.disabled) $option.prop('disabled', true);
      $select.append($option);
    });

    // 恢复之前选中的值
    if (currentValue && $select.find(`option[value="${currentValue}"]`).length > 0) {
      $select.val(currentValue);
    }

    setTimeout(() => { isFiltering = false; }, 100);
  };

  // 过滤模型选项
  const filterModels = (searchTerm) => {
    if (!modelSelect) return;

    const { $ } = getCore();
    if (!$) return;

    const $select = $(modelSelect);
    const searchLower = searchTerm.toLowerCase().trim();

    // 如果没有搜索词，恢复所有选项
    if (!searchLower) {
      restoreOriginalOptions();
      return;
    }

    // 如果原始选项为空，无法过滤
    if (originalOptions.length === 0) {
      console.log('[API模型搜索] 原始选项为空，无法过滤');
      return;
    }

    isFiltering = true;

    // 保存当前选中的值
    const currentValue = $select.val();

    // 清空选项
    $select.empty();

    // 过滤并添加匹配的选项
    let hasMatch = false;
    originalOptions.forEach(option => {
      const modelName = option.text || option.value || '';
      if (modelName.toLowerCase().includes(searchLower)) {
        const $option = $('<option>', {
          value: option.value,
          text: option.text
        });
        if (option.disabled) $option.prop('disabled', true);
        $select.append($option);
        hasMatch = true;
      }
    });

    // 如果没有匹配项，显示提示
    if (!hasMatch) {
      $select.append($('<option>', {
        value: '',
        text: '未找到匹配的模型',
        disabled: true
      }));
    }

    // 尝试恢复之前选中的值
    if (currentValue && $select.find(`option[value="${currentValue}"]`).length > 0) {
      $select.val(currentValue);
    }

    setTimeout(() => { isFiltering = false; }, 100);
  };

  // 创建搜索输入框
  const createSearchInput = ($modelSelect) => {
    const { $ } = getCore();
    if (!$) return null;

    modelSelect = $modelSelect[0];

    // 检查是否已经存在搜索框
    const $existingSearch = $modelSelect.prev(`#${SEARCH_INPUT_ID}`);
    if ($existingSearch.length > 0) {
      return $existingSearch[0];
    }

    // 创建搜索输入框
    const $searchInput = $('<input>', {
      type: 'text',
      id: SEARCH_INPUT_ID,
      placeholder: '搜索模型...',
      class: 'acu-model-search-input'
    });

    // 插入到模型选择框上方
    $modelSelect.before($searchInput);

    // 添加样式
    $searchInput.css({
      'width': '100%',
      'margin-bottom': '8px',
      'padding': '6px 10px',
      'border-radius': '4px',
      'border': '1px solid var(--acu-border, var(--border-normal, #ccc))',
      'background': 'var(--acu-bg-2, var(--input-background, #fff))',
      'color': '#ffffff',
      'font-size': '13px',
      'box-sizing': 'border-box'
    });

    // 加载保存的搜索状态
    const savedSearch = loadSearchState();
    if (savedSearch) {
      $searchInput.val(savedSearch);
    }

    // 绑定输入事件
    let searchTimeout = null;
    $searchInput.on('input', function () {
      const searchTerm = $(this).val();
      saveSearchState(searchTerm);

      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        filterModels(searchTerm);
      }, 150);
    });

    // 监听模型选择框的变化（当模型列表被重新加载时）
    let observerTimeout = null;
    const observer = new MutationObserver(() => {
      // 如果正在过滤中，忽略变化
      if (isFiltering) return;

      clearTimeout(observerTimeout);
      observerTimeout = setTimeout(() => {
        const currentOptionsCount = $modelSelect.find('option').length;
        // 当选项数量增加时（说明是重新加载了模型列表）
        if (currentOptionsCount > 1 && currentOptionsCount > originalOptions.length) {
          console.log(`[API模型搜索] 检测到模型列表更新: ${originalOptions.length} -> ${currentOptionsCount}`);
          saveOriginalOptions(true); // 强制保存
          // 如果有搜索词，重新过滤
          const currentSearch = $searchInput.val();
          if (currentSearch) {
            filterModels(currentSearch);
          }
        }
      }, 300);
    });

    observer.observe(modelSelect, {
      childList: true,
      subtree: true
    });

    return $searchInput[0];
  };

  // 初始化
  const init = () => {
    const { $, $parent } = getCore();
    if (!$) {
      console.warn('[API模型搜索] jQuery 未找到，延迟初始化...');
      setTimeout(init, 500);
      return;
    }

    const checkAndInit = () => {
      const $modelSelect = $parent(`#${MODEL_SELECT_ID}`);

      if ($modelSelect.length > 0) {
        const $existingSearch = $modelSelect.prev(`#${SEARCH_INPUT_ID}`);
        if ($existingSearch.length > 0) {
          searchInput = $existingSearch[0];
          modelSelect = $modelSelect[0];
          if (!isInitialized) {
            isInitialized = true;
            // 尝试保存原始选项
            saveOriginalOptions(true);
            console.log('[API模型搜索] 搜索框已存在，初始化完成');
          }
        } else {
          searchInput = createSearchInput($modelSelect);
          if (searchInput) {
            isInitialized = true;
            // 保存原始选项
            saveOriginalOptions(true);
            // 如果有保存的搜索词且有选项，应用过滤
            const savedSearch = loadSearchState();
            if (savedSearch && originalOptions.length > 0) {
              filterModels(savedSearch);
            }
            console.log('[API模型搜索] 初始化成功');
          }
        }
      }
    };

    checkAndInit();

    // 监听父窗口 DOM 变化
    const w = window.parent || window;
    const targetBody = w.document.body;

    if (targetBody) {
      const bodyObserver = new MutationObserver(() => {
        const { $parent } = getCore();
        const $modelSelect = $parent(`#${MODEL_SELECT_ID}`);
        const $existingSearch = $modelSelect.prev(`#${SEARCH_INPUT_ID}`);

        if ($modelSelect.length > 0 && $existingSearch.length === 0) {
          isInitialized = false;
          originalOptions = [];
          checkAndInit();
        }
      });

      bodyObserver.observe(targetBody, {
        childList: true,
        subtree: true
      });
    }
  };

  // 启动
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.addEventListener('load', init);

  // 定期检查
  const checkInterval = setInterval(() => {
    if (isInitialized) {
      clearInterval(checkInterval);
      return;
    }
    init();
  }, 1000);

  setTimeout(() => clearInterval(checkInterval), 10000);

})();
