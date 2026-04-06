// Background Service Worker - 處理側邊欄開啟和 AI API 請求

// 當用戶點擊擴充功能圖示時，開啟側邊欄
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

// 在特定網站上自動啟用側邊欄
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status === 'complete' && tab.url) {
    // 在 timetable.nycu.edu.tw 或 cos.nycu.edu.tw 上自動啟用
    if (tab.url.includes('timetable.nycu.edu.tw') || tab.url.includes('cos.nycu.edu.tw')) {
      chrome.sidePanel.setOptions({
        tabId,
        path: 'popup.html',
        enabled: true
      });
    }
  }
});

// ==================== AI API 請求處理 ====================
// Background service worker 不受 CORS 限制，可以調用 localhost API

// 帶重試的 fetch 函數（處理 503 等臨時錯誤）
async function fetchWithRetry(url, options, maxRetries = 3) {
  let lastError;
  let lastResponse;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      // 如果響應成功，直接返回
      if (response.ok) {
        return response;
      }

      // 記錄最後一次響應
      lastResponse = response;

      // 如果是 503 或 429 錯誤且還有重試機會，則重試
      if ((response.status === 503 || response.status === 429) && attempt < maxRetries) {
        const retryDelay = Math.pow(2, attempt) * 1000; // 指數退避：1s, 2s, 4s
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        continue;
      }

      // 對於其他錯誤狀態碼，或最後一次嘗試，返回響應
      return response;
    } catch (error) {
      lastError = error;

      // 網路錯誤也重試
      if (attempt < maxRetries) {
        const retryDelay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        continue;
      }
    }
  }

  // 所有重試都失敗，返回最後的響應或拋出錯誤
  if (lastResponse) {
    return lastResponse;
  }
  throw lastError || new Error('請求失敗');
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'callAI') {
    // 異步處理 AI API 請求
    handleAIRequest(request)
      .then(response => sendResponse({ success: true, data: response }))
      .catch(error => sendResponse({ success: false, error: error.message }));

    // 返回 true 表示會異步發送回應
    return true;
  }
});

// 處理 AI API 請求
async function handleAIRequest(request) {
  const { provider, config, prompt } = request;

  switch (provider) {
    case 'ollama':
      return await callOllamaAPI(config, prompt);
    case 'openai':
      return await callOpenAIAPI(config, prompt);
    case 'gemini':
      return await callGeminiAPI(config, prompt);
    case 'custom':
      return await callCustomAPI(config, prompt);
    default:
      throw new Error('未知的 AI 提供商: ' + provider);
  }
}

// 調用 Ollama API
async function callOllamaAPI(config, prompt) {
  const { url, model, temperature } = config;

  try {
    const requestBody = {
      model: model,
      prompt: prompt,
      stream: false
    };

    // 如果提供了 temperature，則添加到請求中
    if (temperature !== undefined) {
      requestBody.temperature = temperature;
    }

    const response = await fetchWithRetry(`${url}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API 請求失敗: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    // 驗證回應結構
    if (!data || typeof data.response !== 'string') {
      throw new Error('Ollama API 返回無效結構: 缺少 response 欄位');
    }

    return data.response.trim();
  } catch (error) {
    throw error;
  }
}

// 調用 OpenAI API
async function callOpenAIAPI(config, prompt) {
  const { key, model, temperature } = config;

  try {
    const requestBody = {
      model: model,
      messages: [{
        role: 'user',
        content: prompt
      }]
    };

    // 如果提供了 temperature，則添加到請求中，否則使用默認值 0.3
    requestBody.temperature = temperature !== undefined ? temperature : 0.3;

    const response = await fetchWithRetry('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`OpenAI API 請求失敗: ${response.status}`);
    }

    const data = await response.json();

    // 驗證回應結構
    if (!data || !data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
      throw new Error('OpenAI API 返回無效結構: 缺少 choices 陣列');
    }
    if (!data.choices[0].message || typeof data.choices[0].message.content !== 'string') {
      throw new Error('OpenAI API 返回無效結構: 缺少 message.content');
    }

    return data.choices[0].message.content.trim();
  } catch (error) {
    throw error;
  }
}

// 調用 Gemini API
async function callGeminiAPI(config, prompt) {
  const { key, model, temperature, thinkingBudget } = config;

  try {
    const generationConfig = {
      temperature: temperature !== undefined ? temperature : 0.3,
      candidateCount: 1  // 只生成一個候選結果
      // 不限制 maxOutputTokens，讓 API 使用默認值（Gemini 2.5 Flash 支持更大的輸出）
    };

    // 根據 thinkingBudget 參數決定是否設置 thinkingConfig
    // 官方文件：https://ai.google.dev/gemini-api/docs/thinking?hl=zh-tw
    // - thinkingBudget = 0：停用思考功能
    // - thinkingBudget = -1：啟用動態思考（模型自動調整）
    // - thinkingBudget > 0：指定思考詞元預算
    if (thinkingBudget !== undefined) {
      // 有明確設定值時，直接傳遞給 API（包括 0, -1, 或正數）
      generationConfig.thinkingConfig = {
        thinkingBudget: thinkingBudget
      };
    }
    // thinkingBudget === undefined：不設置 thinkingConfig（使用 API 預設行為）

    const requestBody = {
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: generationConfig
    };

    // SECURITY: Gemini API requires key in URL (no Authorization header support).
    // Users should restrict API key scope in Google Cloud Console.
    const response = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API 請求失敗: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    // 檢查響應結構
    if (!data.candidates || data.candidates.length === 0) {
      throw new Error('Gemini API 沒有返回候選結果');
    }

    const candidate = data.candidates[0];

    // Gemini 2.5 可能有不同的響應結構
    if (candidate.content && candidate.content.parts && candidate.content.parts[0] && candidate.content.parts[0].text) {
      return candidate.content.parts[0].text.trim();
    } else if (candidate.text) {
      return candidate.text.trim();
    } else if (candidate.output) {
      return candidate.output.trim();
    } else {
      // 如果是 MAX_TOKENS 且沒有文本，說明輸入太長
      if (candidate.finishReason === 'MAX_TOKENS') {
        throw new Error('Gemini MAX_TOKENS 錯誤且未返回任何文本，可能是輸入 prompt 太長。請減少課程數量或分塊處理。');
      }
      throw new Error('無法解析 Gemini 響應結構: ' + JSON.stringify(candidate));
    }
  } catch (error) {
    throw error;
  }
}

// 調用自定義 API
async function callCustomAPI(config, prompt) {
  const { url, key, model, temperature } = config;

  try {
    const headers = {
      'Content-Type': 'application/json'
    };

    if (key) {
      headers['Authorization'] = `Bearer ${key}`;
    }

    const requestBody = {
      model: model,
      messages: [{
        role: 'user',
        content: prompt
      }],
      temperature: temperature !== undefined ? temperature : 0.3
    };

    const response = await fetchWithRetry(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`自定義 API 請求失敗: ${response.status}`);
    }

    const data = await response.json();

    // 驗證回應結構
    if (!data || !data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
      throw new Error('自定義 API 返回無效結構: 缺少 choices 陣列');
    }
    if (!data.choices[0].message || typeof data.choices[0].message.content !== 'string') {
      throw new Error('自定義 API 返回無效結構: 缺少 message.content');
    }

    return data.choices[0].message.content.trim();
  } catch (error) {
    throw error;
  }
}
