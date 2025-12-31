(function () {
    'use strict';

    const SCRIPT_ID = 'acu_api_model_search';
    const SEARCH_INPUT_ID = 'acu-api-model-search';
    const STORAGE_KEY_SEARCH_STATE = 'acu_api_model_search_state';

    let isInitialized = false;
    let originalOptions = []; // 保存原始选项数据
    let searchInput = null;
    let modelSelect = null;

    const getCore = () => {
        const w = window.parent || window;
        return {
            $: window.jQuery || w.jQuery,
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

    // 过滤模型选项
    const filterModels = (searchTerm) => {
        if (!modelSelect || !searchInput) return;

        const { $ } = getCore();
        if (!$) return;

        const $select = $(modelSelect);
        const searchLower = searchTerm.toLowerCase().trim();

        // 如果没有搜索词，恢复所有选项
        if (!searchLower) {
            restoreOriginalOptions();
            return;
        }

        // 保存当前选中的值
        const currentValue = $select.val();

        // 清空选项
        $select.empty();

        // 过滤并添加匹配的选项
        let hasMatch = false;
        originalOptions.forEach(option => {
            const modelName = option.text || option.value || '';
            if (modelName.toLowerCase().includes(searchLower)) {
                $select.append(option);
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

        // 尝试恢复之前选中的值（如果仍然存在）
        if (currentValue && $select.find(`option[value="${currentValue}"]`).length > 0) {
            $select.val(currentValue);
        }
    };

    // 保存原始选项
    const saveOriginalOptions = () => {
        if (!modelSelect) return;

        const { $ } = getCore();
        if (!$) return;

        const $select = $(modelSelect);
        originalOptions = [];

        $select.find('option').each(function () {
            const $option = $(this);
            originalOptions.push({
                value: $option.attr('value') || '',
                text: $option.text() || '',
                selected: $option.prop('selected'),
                disabled: $option.prop('disabled')
            });
        });
    };

    // 恢复原始选项
    const restoreOriginalOptions = () => {
        if (!modelSelect || originalOptions.length === 0) return;

        const { $ } = getCore();
        if (!$) return;

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
    };

    // 创建搜索输入框
    const createSearchInput = () => {
        const { $ } = getCore();
        if (!$) return null;

        // 查找模型选择框（支持多种可能的 ID 格式）
        // 先尝试常见的 ID 格式
        let $modelSelect = $('#acu-api-model, #shujuku_v90-api-model, [id$="-api-model"]');

        // 如果没找到，尝试通过标签和上下文查找
        if ($modelSelect.length === 0) {
            // 查找包含"选择模型"标签的下拉框
            $('label').each(function () {
                const labelText = $(this).text();
                if (labelText && labelText.includes('选择模型')) {
                    const forAttr = $(this).attr('for');
                    if (forAttr) {
                        $modelSelect = $(`#${forAttr}`);
                        if ($modelSelect.length > 0) return false; // 找到后退出循环
                    }
                }
            });
        }

        // 如果还是没找到，尝试通过位置查找（在"加载模型列表"按钮后面）
        if ($modelSelect.length === 0) {
            $('button').each(function () {
                const btnText = $(this).text();
                if (btnText && btnText.includes('加载模型')) {
                    const $nextSelect = $(this).nextAll('select').first();
                    if ($nextSelect.length > 0) {
                        $modelSelect = $nextSelect;
                        return false;
                    }
                }
            });
        }

        if ($modelSelect.length === 0) return null;

        modelSelect = $modelSelect[0];

        // 检查是否已经存在搜索框
        if ($(`#${SEARCH_INPUT_ID}`).length > 0) {
            return $(`#${SEARCH_INPUT_ID}`)[0];
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
            'border': '1px solid var(--border-normal, #ccc)',
            'background': 'var(--input-background, #fff)',
            'color': 'var(--input-text-color, #000)',
            'font-size': '13px',
            'box-sizing': 'border-box'
        });

        // 加载保存的搜索状态
        const savedSearch = loadSearchState();
        if (savedSearch) {
            $searchInput.val(savedSearch);
        }

        // 绑定事件
        let searchTimeout = null;
        $searchInput.on('input', function () {
            const searchTerm = $(this).val();
            saveSearchState(searchTerm);

            // 防抖处理
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                // 保存原始选项（如果还没有保存）
                if (originalOptions.length === 0) {
                    saveOriginalOptions();
                }
                filterModels(searchTerm);
            }, 150);
        });

        // 监听模型选择框的变化（当模型列表被重新加载时）
        let observerTimeout = null;
        const observer = new MutationObserver(() => {
            // 防抖处理，避免频繁触发
            clearTimeout(observerTimeout);
            observerTimeout = setTimeout(() => {
                // 延迟执行，确保选项已经添加完成
                setTimeout(() => {
                    const $currentSelect = $(modelSelect);
                    const currentOptionsCount = $currentSelect.find('option').length;
                    // 只有当选项数量发生变化时才更新
                    if (currentOptionsCount > 0 && currentOptionsCount !== originalOptions.length) {
                        saveOriginalOptions();
                        // 如果有搜索词，重新过滤
                        const currentSearch = $searchInput.val();
                        if (currentSearch) {
                            filterModels(currentSearch);
                        }
                    }
                }, 150);
            }, 200);
        });

        observer.observe(modelSelect, {
            childList: true,
            subtree: true
        });

        // 监听清除按钮，清除搜索（支持多种可能的 ID 格式）
        const $clearBtn = $('#acu-clear-config, [id$="-clear-config"], button:contains("清除")');
        if ($clearBtn.length > 0) {
            $clearBtn.on('click', () => {
                $searchInput.val('');
                saveSearchState('');
                restoreOriginalOptions();
            });
        }

        return $searchInput[0];
    };

    // 初始化
    const init = () => {
        const { $ } = getCore();
        if (!$) {
            console.warn('[API模型搜索] jQuery 未找到，延迟初始化...');
            setTimeout(init, 500);
            return;
        }

        // 等待 API 设置页面加载
        const checkAndInit = () => {
            // 使用多种方式查找模型选择框
            const $modelSelect = $('#acu-api-model, #shujuku_v90-api-model, [id$="-api-model"]');
            if ($modelSelect.length > 0) {
                // 检查搜索框是否已存在
                const $existingSearch = $(`#${SEARCH_INPUT_ID}`);
                if ($existingSearch.length > 0) {
                    // 搜索框已存在，更新引用
                    searchInput = $existingSearch[0];
                    modelSelect = $modelSelect[0];
                    if (!isInitialized) {
                        isInitialized = true;
                        console.log('[API模型搜索] 搜索框已存在，初始化完成');
                    }
                } else {
                    // 创建新的搜索框
                    searchInput = createSearchInput();
                    if (searchInput) {
                        isInitialized = true;
                        console.log('[API模型搜索] 初始化成功');
                    }
                }
            }
        };

        // 立即检查一次
        checkAndInit();

        // 监听 DOM 变化（即使已初始化，也要检查搜索框是否还存在）
        const bodyObserver = new MutationObserver(() => {
            // 检查搜索框是否还存在
            const $existingSearch = $(`#${SEARCH_INPUT_ID}`);
            const $modelSelect = $('#acu-api-model, #shujuku_v90-api-model, [id$="-api-model"]');

            // 如果模型选择框存在但搜索框不存在，重新创建
            if ($modelSelect.length > 0 && $existingSearch.length === 0) {
                checkAndInit();
            }
        });

        bodyObserver.observe(document.body, {
            childList: true,
            subtree: true
        });

        // 也监听父窗口（如果存在）
        if (window.parent && window.parent !== window) {
            try {
                const parentBody = window.parent.document.body;
                if (parentBody) {
                    const parentObserver = new MutationObserver(() => {
                        const $existingSearch = $(`#${SEARCH_INPUT_ID}`);
                        const $modelSelect = $('#acu-api-model, #shujuku_v90-api-model, [id$="-api-model"]');

                        if ($modelSelect.length > 0 && $existingSearch.length === 0) {
                            checkAndInit();
                        }
                    });
                    parentObserver.observe(parentBody, {
                        childList: true,
                        subtree: true
                    });
                }
            } catch (e) {
                // 跨域限制，忽略
            }
        }
    };

    // 页面加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // 也监听窗口加载事件（处理 iframe 场景）
    if (window.addEventListener) {
        window.addEventListener('load', init);
    }

    // 定期检查（作为后备方案）
    let checkInterval = setInterval(() => {
        if (isInitialized) {
            clearInterval(checkInterval);
            return;
        }
        init();
    }, 1000);

    // 10秒后停止定期检查
    setTimeout(() => {
        clearInterval(checkInterval);
    }, 10000);

})();

