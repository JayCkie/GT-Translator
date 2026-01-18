import React, { useState, useEffect, useRef } from 'react';
import { Send, Upload, X, Copy, Check, RotateCcw, Image as ImageIcon, Type, AlertCircle, Loader2, Key, Save, Globe, Sun, Moon, ChevronDown, ChevronUp, FileText, RefreshCw, AlertTriangle, Lightbulb, Bot, ExternalLink } from 'lucide-react';

// --- 預設值常數 ---
const DEFAULT_TARGET_LANG = "繁體中文";
// 預設模型 ID
const DEFAULT_MODEL_ID = "gemini-2.5-flash-preview-09-2025";

// 預設模型清單 (更加人性化的顯示名稱)
const FALLBACK_MODELS = [
    { id: 'gemini-2.5-flash-preview-09-2025', displayName: 'Gemini 2.5 Flash (Preview)' },
    { id: 'gemini-2.0-flash-exp', displayName: 'Gemini 2.0 Flash (Experimental)' },
    { id: 'gemini-1.5-pro', displayName: 'Gemini 1.5 Pro' },
    { id: 'gemini-1.5-flash', displayName: 'Gemini 1.5 Flash' },
    { id: 'gemini-1.0-pro', displayName: 'Gemini 1.0 Pro' },
];

const DEFAULT_RULES = `【排版要求】
若是以純文字進行翻譯，請確保翻譯出的文字保留原先的 Markdown 語法標記。

若是以圖片上傳進行翻譯，請確保：
1. 觀察圖片中的視覺層級：大標題請使用 Markdown 的 # 標記，次標題使用 ##。
2. 重要或高亮的文字（如白色字、黃色字），請使用 **粗體** 包裹。
3. 如果是清單或屬性列表，請使用 - 列表符號。

【翻譯規則】
如果提供的是遊戲截圖，請保留專有名詞原文（如角色ID、裝備名稱），僅翻譯對話或介面說明部分的白色文字。`;

const DEFAULT_CONTEXT = `這次的截圖來自遊戲《英雄聯盟》，請參考韓國與遊戲本身的用詞、語境進行翻譯。`;

// --- 自定義 Material You 風格 Loading 元件 ---
const MaterialSpinner = ({ className }) => (
  <div className={className}>
    <svg className="animate-spin-material" viewBox="0 0 50 50">
      <circle
        className="path"
        cx="25"
        cy="25"
        r="20"
        fill="none"
        strokeWidth="5"
      ></circle>
    </svg>
    <style>{`
      .animate-spin-material {
        animation: rotate 2s linear infinite;
        width: 100%;
        height: 100%;
      }
      .path {
        stroke: currentColor;
        stroke-linecap: round;
        animation: dash 1.5s ease-in-out infinite;
      }
      @keyframes rotate {
        100% { transform: rotate(360deg); }
      }
      @keyframes dash {
        0% { stroke-dasharray: 1, 150; stroke-dashoffset: 0; }
        50% { stroke-dasharray: 90, 150; stroke-dashoffset: -35; }
        100% { stroke-dasharray: 90, 150; stroke-dashoffset: -124; }
      }
    `}</style>
  </div>
);

// 簡易 Markdown 渲染元件
const SimpleMarkdownRenderer = ({ content, isDarkMode }) => {
  if (!content) return null;

  // 自動修復：移除粗體標記內多餘的空白 (支援單邊或雙邊空格)
  // 這能解決 Gemini 有時輸出 "** 文字 **" 導致無法正確變粗體的問題
  const fixedContent = content.replace(/\*\*\s*([^*]+?)\s*\*\*/g, '**$1**');

  const lines = fixedContent.split('\n');
  
  const renderInline = (text) => {
    // 優化正則：支援 **bold** (中間可含空格)，並避免貪婪匹配
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
        return <strong key={index} className={isDarkMode ? "text-yellow-400 font-bold" : "text-slate-900 font-bold"}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  return (
    <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {lines.map((line, index) => {
        if (line.startsWith('# ')) {
          return <h2 key={index} className={`text-2xl font-bold mt-6 mb-3 ${isDarkMode ? "text-blue-300" : "text-slate-800"}`}>{renderInline(line.slice(2))}</h2>;
        }
        if (line.startsWith('## ')) {
          return <h3 key={index} className={`text-xl font-bold mt-4 mb-2 ${isDarkMode ? "text-blue-200" : "text-slate-700"}`}>{renderInline(line.slice(3))}</h3>;
        }
        
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return (
            <div key={index} className="flex items-start gap-2 ml-2">
              <span className={`mt-2 w-1.5 h-1.5 rounded-full flex-shrink-0 ${isDarkMode ? "bg-slate-400" : "bg-slate-500"}`}></span>
              <p className={`text-lg ${isDarkMode ? "text-slate-200" : "text-slate-700"}`}>{renderInline(line.slice(2))}</p>
            </div>
          );
        }

        const orderedListMatch = line.match(/^(\d+)\.\s+(.*)/);
        if (orderedListMatch) {
            return (
                <div key={index} className="flex items-start gap-2 ml-2">
                    <span className={`font-bold mt-0.5 select-none ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>{orderedListMatch[1]}.</span>
                    <p className={`text-lg leading-relaxed ${isDarkMode ? "text-slate-200" : "text-slate-700"}`}>{renderInline(orderedListMatch[2])}</p>
                </div>
            )
        }

        if (line.trim() === '---') {
            return <hr key={index} className={`my-5 ${isDarkMode ? "border-slate-700" : "border-slate-200"}`} />;
        }
        
        const dialogueMatch = line.match(/^([^：:]+)[：:](.+)$/);
        if (dialogueMatch) {
            return (
                <div key={index} className={`p-3 rounded mb-2 ${isDarkMode ? "bg-slate-800/50 border-l-4 border-yellow-500" : "bg-slate-50 border-l-4 border-slate-300"}`}>
                    <span className={`font-bold mr-2 text-lg ${isDarkMode ? "text-yellow-400" : "text-slate-900"}`}>{dialogueMatch[1]}:</span>
                    <span className={`text-lg ${isDarkMode ? "text-slate-200" : "text-slate-700"}`}>{renderInline(dialogueMatch[2])}</span>
                </div>
            )
        }
        if (line.trim() === '') return <div key={index} className="h-2"></div>;
        return <p key={index} className={`leading-relaxed text-lg ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>{renderInline(line)}</p>;
      })}
    </div>
  );
};

const App = () => {
  // --- 狀態管理 ---
  const [targetLang, setTargetLang] = useState(DEFAULT_TARGET_LANG);
  const [rules, setRules] = useState(DEFAULT_RULES);
  const [context, setContext] = useState(DEFAULT_CONTEXT);
  const [userApiKey, setUserApiKey] = useState('');
  const [modelId, setModelId] = useState(DEFAULT_MODEL_ID);
  const [availableModels, setAvailableModels] = useState(FALLBACK_MODELS); // 模型列表
  
  // UI 狀態
  const [isApiKeyOpen, setIsApiKeyOpen] = useState(false); 
  const [inputType, setInputType] = useState('image'); 
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [result, setResult] = useState('');
  const [tips, setTips] = useState(''); 
  const [isTipsOpen, setIsTipsOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(false); 
  const [error, setError] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  
  // 動畫與回饋狀態
  const [isSaved, setIsSaved] = useState(false);
  const [isResetSuccess, setIsResetSuccess] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [isClosing, setIsClosing] = useState(false); 
  
  // 主題狀態：'light' | 'dark'
  const [theme, setTheme] = useState('light');

  const containerRef = useRef(null);

  // --- 初始化 ---
  useEffect(() => {
    const savedApiKey = localStorage.getItem('gemini_user_api_key');
    const savedTargetLang = localStorage.getItem('gemini_target_lang');
    const savedRules = localStorage.getItem('gemini_rules');
    const savedContext = localStorage.getItem('gemini_context');
    const savedTheme = localStorage.getItem('gemini_theme');
    const savedModelId = localStorage.getItem('gemini_model_id');

    if (savedApiKey) {
        setUserApiKey(savedApiKey);
        setIsApiKeyOpen(false); 
    } else {
        setIsApiKeyOpen(true); 
    }

    if (savedTargetLang) setTargetLang(savedTargetLang);
    if (savedRules) setRules(savedRules);
    if (savedContext) setContext(savedContext);
    if (savedTheme) setTheme(savedTheme);
    if (savedModelId) setModelId(savedModelId);
  }, []);

  // 當 API Key 存在且設定面板打開時，嘗試抓取模型列表
  useEffect(() => {
    if (isApiKeyOpen && userApiKey && userApiKey.length > 30) {
        fetchModels(userApiKey);
    }
  }, [isApiKeyOpen, userApiKey]);

  // --- API: 抓取模型列表 (使用 Category/Method 篩選) ---
  const fetchModels = async (key) => {
      setIsLoadingModels(true);
      try {
          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
          const data = await res.json();
          if (data.models) {
              const validModels = data.models
                  .filter(m => {
                      const name = m.name.toLowerCase();
                      const hasGenerateContent = m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent');
                      
                      // 排除非標準 Gemini 模型 (如 gemma, learnlm, aqa 等)
                      // 排除特殊用途 (vision-only, embedding, tts)
                      return name.includes('gemini') && 
                             !name.includes('gemma') &&
                             !name.includes('learnlm') &&
                             !name.includes('aqa') &&
                             !name.includes('vision') && 
                             !name.includes('tts') && 
                             !name.includes('speech') &&
                             !name.includes('robotics') &&
                             !name.includes('embedding') &&
                             hasGenerateContent;
                  })
                  .map(m => {
                      const id = m.name.replace('models/', '');
                      let displayName = m.displayName || id;

                      // 人性化命名邏輯
                      let cleanName = id
                          .replace('models/', '')
                          .replace(/gemini-/i, 'Gemini ')
                          .replace(/-?latest/i, '')
                          .replace(/-?\d{4}-\d{2}-\d{2}/g, '') 
                          .replace(/-?\d{2}-\d{4}/g, '') 
                          .replace(/-?00\d/g, '') 
                          .replace(/-preview/i, ' (Preview)')
                          .replace(/-exp/i, ' (Exp)')
                          .replace(/-experimental/i, ' (Exp)')
                          .replace(/-/g, ' '); 

                      // 首字母大寫修正
                      cleanName = cleanName.replace(/\b\w/g, l => l.toUpperCase());
                      
                      // 特殊修正：Pro 和 Flash 保持大寫
                      cleanName = cleanName.replace(/Pro/i, 'Pro').replace(/Flash/i, 'Flash');

                      return {
                          id: id,
                          displayName: cleanName
                      };
                  })
                  .sort((a, b) => {
                      const getVer = (s) => {
                          const match = s.id.match(/(\d+\.\d+)/);
                          return match ? parseFloat(match[1]) : 0;
                      };
                      const verA = getVer(a);
                      const verB = getVer(b);
                      
                      if (verA !== verB) return verB - verA;
                      
                      const isProA = a.id.includes('pro');
                      const isProB = b.id.includes('pro');
                      if (isProA && !isProB) return -1;
                      if (!isProA && isProB) return 1;
                      
                      return 0;
                  });
              
              setAvailableModels(validModels);
          }
      } catch (e) {
          console.warn("自動抓取模型失敗，使用預設清單", e);
      } finally {
          setIsLoadingModels(false);
      }
  };

  // --- 儲存設定 ---
  const handleSaveSettings = () => {
    localStorage.setItem('gemini_user_api_key', userApiKey);
    localStorage.setItem('gemini_target_lang', targetLang);
    localStorage.setItem('gemini_rules', rules);
    localStorage.setItem('gemini_context', context);
    localStorage.setItem('gemini_model_id', modelId);
  };

  const handleManualSave = () => {
      handleSaveSettings(); 
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000); 
  }

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('gemini_theme', newTheme);
  };

  const isDarkMode = theme === 'dark';

  // 處理貼上
  useEffect(() => {
    const handlePaste = (e) => {
      if (['TEXTAREA', 'INPUT'].includes(e.target.tagName)) return;

      const items = e.clipboardData.items;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          e.preventDefault();
          const blob = items[i].getAsFile();
          const reader = new FileReader();
          reader.onload = (event) => {
            setSelectedImage(event.target.result);
            setInputType('image');
            setError('');
          };
          reader.readAsDataURL(blob);
          break;
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  // 圖片上傳
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setSelectedImage(event.target.result);
        setError('');
      };
      reader.readAsDataURL(file);
    }
  };

  const clearInput = () => {
    setInputText('');
    setSelectedImage(null);
    setResult('');
    setTips(''); 
    setError('');
  };

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleResetClick = () => {
      setShowResetModal(true);
      setIsClosing(false);
  }

  const closeModal = () => {
      setIsClosing(true);
      setTimeout(() => {
          setShowResetModal(false);
          setIsClosing(false);
      }, 300);
  }

  const confirmReset = () => {
      setIsClosing(true);
      setTimeout(() => {
          localStorage.setItem('gemini_target_lang', DEFAULT_TARGET_LANG);
          localStorage.setItem('gemini_rules', DEFAULT_RULES);
          localStorage.setItem('gemini_context', DEFAULT_CONTEXT);
          localStorage.setItem('gemini_model_id', DEFAULT_MODEL_ID); 
          
          setTargetLang(DEFAULT_TARGET_LANG);
          setRules(DEFAULT_RULES);
          setContext(DEFAULT_CONTEXT);
          setModelId(DEFAULT_MODEL_ID);

          setShowResetModal(false);
          setIsClosing(false);
          
          setIsResetSuccess(true);
          setTimeout(() => setIsResetSuccess(false), 2000);
      }, 300);
  }

  // Google Translate Fallback
  const handleGoogleTranslateFallback = () => {
      // 簡單的目標語言代碼對應 (如果使用者改了繁體中文，這裡盡量對應)
      // 預設 zh-TW
      const targetLangCode = 'zh-TW'; 
      
      if (inputType === 'text' && inputText) {
          const url = `https://translate.google.com/?sl=auto&tl=${targetLangCode}&text=${encodeURIComponent(inputText)}&op=translate`;
          window.open(url, '_blank');
      } else {
          // 圖片模式，導向圖片上傳頁
          const url = `https://translate.google.com/?sl=auto&tl=${targetLangCode}&op=images`;
          window.open(url, '_blank');
      }
  };

  // --- 翻譯核心邏輯 ---
  const handleTranslate = async () => {
    if (!userApiKey) {
        setError('未偵測到 API Key。請點擊上方「API Key 設定」輸入您的 Key 才能開始使用。');
        setIsApiKeyOpen(true); 
        return;
    }

    if (inputType === 'text' && !inputText.trim()) {
      setError('請輸入需要翻譯的文字');
      return;
    }
    if (inputType === 'image' && !selectedImage) {
      setError('請上傳或貼上截圖');
      return;
    }

    setIsLoading(true);
    setResult('');
    setTips(''); 
    setError('');

    handleSaveSettings();

    try {
      let payload = {};
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${userApiKey}`;

      const introInstruction = `你是一個專業的翻譯助手。請將提供的內容翻譯成${targetLang}。`;
      
      const tipsInstruction = "\n\n【翻譯註釋要求】\n請在所有翻譯內容結束後，換行並加上分隔線 `---TIPS---`，接著列出 2~3 點「翻譯註釋」。請說明你是根據什麼語境、遊戲術語、日常慣用語或文化背景做出這些特定翻譯判斷的。**請使用標準的有序列表 (1. 2. 3.) 格式。如果使用粗體，請確保 **符號** 與文字之間沒有空格 (例如：**術語**，而不是 ** 術語 **)。不需要重複解釋已經寫在【排版要求】或【翻譯規則】中的內容。**";
      
      const hiddenFormatInstruction = "\n\n(IMPORTANT: Please structure your response using Markdown. Use headers (#, ##) for titles, bold (**) for emphasized text, and bullet points (-) for lists to mimic the visual layout of the image.)";
      
      const combinedSystemPrompt = `${introInstruction}\n\n${rules}\n\n【當前語境/Context】\n${context}${tipsInstruction}${hiddenFormatInstruction}`;

      if (inputType === 'text') {
        payload = {
          contents: [{ parts: [{ text: inputText }] }],
          systemInstruction: { parts: [{ text: combinedSystemPrompt }] }
        };
      } else {
        const base64Data = selectedImage.split(',')[1];
        const mimeType = selectedImage.split(';')[0].split(':')[1];
        
        payload = {
          contents: [{
            role: "user",
            parts: [
              { text: combinedSystemPrompt },
              { inlineData: { mimeType: mimeType, data: base64Data } }
            ]
          }]
        };
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 404) {
            throw new Error(`找不到模型 "${modelId}"。請嘗試重新整理頁面或選擇其他模型。`);
        }
        throw new Error(data.error?.message || 'API 請求失敗，請檢查 API Key 是否正確');
      }

      const fullText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (fullText) {
        const parts = fullText.split('---TIPS---');
        setResult(parts[0].trim());
        if (parts.length > 1) {
            setTips(parts[1].trim());
            setIsTipsOpen(true); 
        }
      } else {
        throw new Error('未產生任何翻譯結果');
      }

    } catch (err) {
      console.error(err);
      let errorMessage = err.message || '發生錯誤，請稍後再試';
      const lowerError = errorMessage.toLowerCase();

      // 檢查是否為 Quota 或 Rate Limit 錯誤
      if (lowerError.includes('quota') || lowerError.includes('429') || lowerError.includes('rate limit')) {
          errorMessage = '已達到 Gemini API 免費額度上限 (Quota Exceeded)，請稍後再試。';
      } else if (lowerError.includes('api key') || lowerError.includes('leaked')) {
          setIsApiKeyOpen(true);
          if (lowerError.includes('leaked')) {
              errorMessage = '您的 API Key 已被回報洩漏並封鎖，請重新產生一組新的 Key。';
          }
      }

      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // --- 主題樣式類別 ---
  const bgClass = isDarkMode ? "bg-slate-950" : "bg-slate-50";
  const textClass = isDarkMode ? "text-slate-200" : "text-slate-800";
  const cardClass = isDarkMode ? "bg-slate-900 border-slate-700 shadow-md" : "bg-white border-slate-200 shadow-sm";
  const headerClass = isDarkMode ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-slate-100 border-slate-200 text-slate-700";
  const inputBgClass = isDarkMode ? "bg-slate-950 border-slate-700 text-slate-200 focus:border-blue-500 placeholder:text-slate-600" : "bg-slate-50 border-slate-300 text-slate-800 focus:border-blue-500 placeholder:text-slate-400";
  const mutedTextClass = isDarkMode ? "text-slate-400" : "text-slate-500";
  const sectionTitleClass = `font-semibold text-base ${isDarkMode ? "text-slate-200" : "text-slate-700"}`;
  
  const tipsContainerClass = isDarkMode ? "bg-blue-900/20 border-blue-800" : "bg-amber-50 border-amber-200";
  const tipsHeaderClass = isDarkMode ? "text-blue-200" : "text-amber-800";
  const tipsDividerClass = isDarkMode ? "bg-blue-800/50" : "bg-amber-200/50";

  return (
    <div className={`min-h-screen font-sans p-4 md:p-8 transition-colors duration-500 ${bgClass} ${textClass}`} ref={containerRef}>
      
      <style>{`
        @keyframes modalOverlayEnter { from { opacity: 0; backdrop-filter: blur(0); } to { opacity: 1; backdrop-filter: blur(4px); } }
        @keyframes modalContentEnter { from { opacity: 0; transform: scale(0.9) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes modalOverlayExit { from { opacity: 1; backdrop-filter: blur(4px); } to { opacity: 0; backdrop-filter: blur(0); } }
        @keyframes modalContentExit { from { opacity: 1; transform: scale(1) translateY(0); } to { opacity: 0; transform: scale(0.9) translateY(10px); } }
        .animate-modal-overlay { animation: modalOverlayEnter 0.3s ease-out forwards; }
        .animate-modal-content { animation: modalContentEnter 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-modal-overlay-exit { animation: modalOverlayExit 0.3s ease-in forwards; }
        .animate-modal-content-exit { animation: modalContentExit 0.3s ease-in forwards; }
      `}</style>

      {/* 重置確認視窗 */}
      {showResetModal && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm ${isClosing ? 'animate-modal-overlay-exit' : 'animate-modal-overlay'}`}>
            <div className={`w-full max-w-sm p-6 rounded-xl shadow-2xl border ${isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-800'} ${isClosing ? 'animate-modal-content-exit' : 'animate-modal-content'}`}>
                <div className="flex items-center gap-3 mb-4">
                    <div className={`p-3 rounded-full ${isDarkMode ? 'bg-yellow-900/30 text-yellow-500' : 'bg-yellow-100 text-yellow-600'}`}>
                        <AlertTriangle className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold">確認重置？</h3>
                </div>
                <p className={`text-base mb-6 leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    確定要將目標語言、規則、語境與模型 ID 恢復為系統預設值嗎？<br/>此動作無法復原。
                </p>
                <div className="flex justify-end gap-3">
                    <button onClick={closeModal} className={`px-4 py-2 text-base rounded font-medium transition-colors ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}>取消</button>
                    <button onClick={confirmReset} className="px-4 py-2 text-base bg-red-600 hover:bg-red-700 text-white rounded font-medium shadow-sm transition-all hover:scale-105 active:scale-95">確認重置</button>
                </div>
            </div>
        </div>
      )}

      <div className="w-[95%] max-w-[1800px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
        
        {/* 左側：設定與輸入區 */}
        <div className="flex flex-col gap-6">
          <div className="flex justify-between items-start">
            <div>
                <h1 className={`text-3xl font-bold flex items-center gap-3 ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>
                <RotateCcw className="w-8 h-8 text-blue-600" />
                GT-Translator
                </h1>
                <p className={`${mutedTextClass} text-base mt-2`}>即時翻譯文字或截圖</p>
            </div>
            <button onClick={toggleTheme} className={`relative w-12 h-12 rounded-full overflow-hidden transition-all duration-500 shadow-sm ${isDarkMode ? 'bg-slate-800 border border-slate-700' : 'bg-blue-100/50 border border-blue-200'}`} title={isDarkMode ? "切換為亮色模式" : "切換為暗色模式"}>
                <div className={`absolute inset-0 flex items-center justify-center transition-all duration-500 transform ${isDarkMode ? 'translate-y-10 opacity-0 rotate-180' : 'translate-y-0 opacity-100 rotate-0'}`}><Sun className="w-6 h-6 text-orange-500" /></div>
                <div className={`absolute inset-0 flex items-center justify-center transition-all duration-500 transform ${isDarkMode ? 'translate-y-0 opacity-100 rotate-0' : '-translate-y-10 opacity-0 -rotate-180'}`}><Moon className="w-6 h-6 text-yellow-400" /></div>
            </button>
          </div>

          <div className={`rounded-xl border overflow-hidden transition-all duration-300 ${isApiKeyOpen ? 'ring-2 ring-blue-500/20' : ''} ${cardClass}`}>
            <button onClick={() => setIsApiKeyOpen(!isApiKeyOpen)} className={`w-full px-5 py-4 flex justify-between items-center ${headerClass} hover:opacity-90 transition-opacity`}>
                <div className="flex items-center gap-2">
                    <Key className={`w-5 h-5 ${userApiKey ? (isDarkMode ? 'text-green-400' : 'text-green-600') : 'text-blue-500'}`} />
                    <span className={sectionTitleClass}>API Key 與模型設定</span>
                    {userApiKey && !isApiKeyOpen && (<span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 ml-2 animate-in fade-in">已設定</span>)}
                </div>
                {isApiKeyOpen ? <ChevronUp className="w-5 h-5 opacity-60" /> : <ChevronDown className="w-5 h-5 opacity-60" />}
            </button>
            <div className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${isApiKeyOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                <div className="overflow-hidden">
                    <div className="p-5">
                        <div className="mb-4">
                            <label className={`text-sm font-semibold mb-2 flex items-center gap-1 ${mutedTextClass}`}>
                                <Key className="w-4 h-4" /> API Key (必填)
                            </label>
                            <input type="password" value={userApiKey} onChange={(e) => setUserApiKey(e.target.value)} placeholder="請貼上您的 Gemini API Key (AIzaSy...)" className={`w-full p-3 text-base border rounded focus:ring-2 focus:ring-blue-500 mb-2 ${inputBgClass}`} />
                            <p className={`text-sm ${mutedTextClass}`}>Key 僅儲存於瀏覽器本機。<a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-blue-500 hover:underline ml-1">取得免費 Key</a></p>
                        </div>
                        
                        {/* 模型 ID 設定欄位 - 改為 Dropdown */}
                        <div className="mb-4 pt-3 border-t border-dashed border-gray-200/20">
                            <div className="flex items-center justify-between mb-2">
                                <label className={`text-sm font-semibold flex items-center gap-1 ${mutedTextClass}`}>
                                    <Bot className="w-4 h-4" /> 模型選擇 (Model)
                                </label>
                                {isLoadingModels && <Loader2 className="w-3 h-3 animate-spin text-blue-500" />}
                            </div>
                            
                            <div className="relative">
                                <select 
                                    value={modelId} 
                                    onChange={(e) => setModelId(e.target.value)} 
                                    className={`w-full p-3 text-base border rounded focus:ring-2 focus:ring-blue-500 mb-2 appearance-none cursor-pointer ${inputBgClass}`}
                                >
                                    {availableModels.map((model) => (
                                        <option key={model.id} value={model.id}>
                                            {model.displayName}
                                        </option>
                                    ))}
                                    {/* 如果目前的 modelId 不在清單中，添加一個選項以免顯示空白 */}
                                    {!availableModels.find(m => m.id === modelId) && (
                                        <option value={modelId}>{modelId} (Custom)</option>
                                    )}
                                </select>
                                <div className="absolute right-3 top-3.5 pointer-events-none opacity-50">
                                    <ChevronDown className="w-5 h-5" />
                                </div>
                            </div>
                            <p className={`text-xs ${mutedTextClass}`}>
                                系統會自動抓取您帳號可用的模型。若清單未更新，請重新展開此面板。
                            </p>
                        </div>

                        <div className="flex justify-end mt-4">
                            <button onClick={handleManualSave} className={`flex items-center gap-2 px-5 py-2 rounded font-medium whitespace-nowrap transition-all duration-300 transform ${isSaved ? 'bg-green-600 hover:bg-green-700 text-white scale-105' : 'bg-blue-600 hover:bg-blue-700 text-white hover:scale-105 active:scale-95'}`}>{isSaved ? <Check className="w-4 h-4 animate-in zoom-in spin-in-90 duration-300" /> : <Save className="w-4 h-4" />}{isSaved ? '已儲存' : '儲存'}</button>
                        </div>
                    </div>
                </div>
            </div>
          </div>

          <div className={`rounded-xl overflow-hidden border ${cardClass}`}>
            <div className={`px-5 py-4 border-b ${headerClass}`}><h3 className={`flex items-center gap-2 ${sectionTitleClass}`}><FileText className="w-5 h-5" /> 翻譯規則設定</h3></div>
            <div className="p-5 flex flex-col gap-4">
                <div><label className={`text-sm font-semibold mb-2 flex items-center gap-1 ${mutedTextClass}`}><Globe className="w-4 h-4" /> 目標語言</label><input type="text" value={targetLang} onChange={(e) => setTargetLang(e.target.value)} onBlur={() => handleSaveSettings()} className={`w-full p-3 text-base border rounded focus:ring-1 focus:ring-blue-500 ${inputBgClass}`} placeholder="例如：繁體中文" /></div>
                <div><label className={`text-sm font-semibold mb-2 block ${mutedTextClass}`}>通用排版與翻譯規則</label><textarea value={rules} onChange={(e) => setRules(e.target.value)} onBlur={() => handleSaveSettings()} className={`w-full h-32 p-3 text-sm border rounded focus:ring-1 focus:ring-blue-500 leading-relaxed ${inputBgClass}`} placeholder="請輸入針對翻譯風格與排版的具體要求..." /></div>
                <div className="flex justify-end"><button onClick={handleResetClick} className={`px-4 py-2 text-sm rounded flex items-center gap-2 transition-all duration-300 transform ${isResetSuccess ? 'bg-green-100 text-green-700 font-medium scale-105' : isDarkMode ? "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:scale-105" : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:scale-105"}`}>{isResetSuccess ? (<><Check className="w-4 h-4 animate-in zoom-in duration-300" /> 已恢復預設</>) : (<><RefreshCw className="w-4 h-4" /> 恢復預設規則</>)}</button></div>
            </div>
          </div>

          <div className={`rounded-xl overflow-hidden flex flex-col border ${cardClass}`}>
            <div className={`px-5 py-4 border-b flex justify-between items-center ${headerClass}`}><span className={sectionTitleClass}>當前語境 (Context)</span><span className={`text-sm opacity-70`}>針對本次翻譯的情境補充</span></div>
            <div className="p-5"><textarea value={context} onChange={(e) => setContext(e.target.value)} onBlur={() => handleSaveSettings()} className={`w-full h-28 p-4 text-base border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none transition-all leading-relaxed ${inputBgClass}`} placeholder="例如：這是一張英雄聯盟的截圖，請不要翻譯角色名稱..." /></div>
          </div>

          <div className={`rounded-xl overflow-hidden flex flex-col flex-grow border ${cardClass}`}>
            <div className={`flex border-b ${isDarkMode ? "border-slate-700" : "border-slate-200"}`}>
              <button onClick={() => setInputType('image')} className={`flex-1 py-4 text-base font-medium flex items-center justify-center gap-2 transition-colors ${inputType === 'image' ? 'bg-transparent text-blue-600 border-b-2 border-blue-600' : `${isDarkMode ? "bg-slate-900 text-slate-400 hover:bg-slate-800" : "bg-slate-50 text-slate-500 hover:bg-slate-100"}`}`}><ImageIcon className="w-5 h-5" /> 截圖/圖片</button>
              <button onClick={() => setInputType('text')} className={`flex-1 py-4 text-base font-medium flex items-center justify-center gap-2 transition-colors ${inputType === 'text' ? 'bg-transparent text-blue-600 border-b-2 border-blue-600' : `${isDarkMode ? "bg-slate-900 text-slate-400 hover:bg-slate-800" : "bg-slate-50 text-slate-500 hover:bg-slate-100"}`}`}><Type className="w-5 h-5" /> 純文字</button>
            </div>
            <div className="p-5 flex-grow flex flex-col min-h-[300px]">
              <div className="flex justify-between items-center mb-2"><span className={sectionTitleClass}>輸入內容</span>{(inputText || selectedImage) && (<button onClick={clearInput} className="text-sm text-red-500 hover:text-red-400 flex items-center gap-1"><X className="w-4 h-4" /> 清除</button>)}</div>
              {inputType === 'image' ? (<div className={`flex-grow border-2 border-dashed rounded-lg flex flex-col items-center justify-center relative transition-all overflow-hidden ${selectedImage ? 'border-blue-500/50' : isDarkMode ? 'bg-slate-950 border-slate-700 hover:border-slate-500' : 'bg-slate-50 border-slate-300 hover:border-blue-400'}`}>{selectedImage ? (<div className="relative w-full h-full flex items-center justify-center p-4"><img src={selectedImage} alt="Preview" className="max-w-full max-h-[400px] object-contain rounded shadow-lg" /></div>) : (<div className="text-center p-8 pointer-events-none"><div className="w-14 h-14 bg-blue-100/10 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4"><Upload className="w-7 h-7" /></div><p className={`font-medium text-lg ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>點擊上傳 或 直接貼上截圖 (Ctrl+V)</p><p className={`text-base mt-2 ${mutedTextClass}`}>支援 PNG, JPG, WebP</p></div>)}<input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" /></div>) : (<textarea value={inputText} onChange={(e) => setInputText(e.target.value)} className={`w-full flex-grow p-4 text-lg border rounded-lg outline-none resize-none leading-relaxed ${inputBgClass}`} placeholder="請在此輸入需要翻譯的文字..." />)}
              
              {/* Error Message with Fallback Button */}
              {error && (
                <div className="mt-4 bg-red-500/10 border border-red-500/20 rounded-lg p-4 animate-modal-content">
                    <div className="flex items-start gap-3 text-red-600 mb-3">
                        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        <span className="text-base leading-relaxed font-medium">{error}</span>
                    </div>
                    {/* 只有在 Quota Exceeded 或特定錯誤時顯示救援按鈕 */}
                    {(error.includes('Quota') || error.includes('額度')) && (
                        <button 
                            onClick={handleGoogleTranslateFallback}
                            className={`text-sm flex items-center gap-2 px-4 py-2 border rounded-lg transition-all shadow-sm ${isDarkMode ? 'bg-slate-800 border-red-900/50 text-red-400 hover:bg-slate-700' : 'bg-white border-red-200 text-red-700 hover:bg-red-50'}`}
                        >
                            <ExternalLink className="w-4 h-4" /> 
                            {inputType === 'text' ? '前往 Google 翻譯 (文字)' : '前往 Google 翻譯 (需手動上傳)'}
                        </button>
                    )}
                </div>
              )}

              <button onClick={handleTranslate} disabled={isLoading} className="mt-5 w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-4 rounded-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed text-lg hover:scale-[1.01] active:scale-[0.99]">{isLoading ? (<><div className="w-6 h-6 mr-2"><MaterialSpinner /></div> 翻譯中...</>) : (<><Send className="w-6 h-6" /> 開始翻譯</>)}</button>
            </div>
          </div>
        </div>

        {/* 右側：結果輸出區 */}
        <div className={`rounded-xl overflow-hidden flex flex-col h-full min-h-[500px] lg:min-h-auto transition-colors duration-300 border ${cardClass}`}>
          <div className={`px-5 py-4 border-b flex justify-between items-center ${headerClass}`}>
            <span className={sectionTitleClass}>翻譯結果</span>
            <div className="flex items-center gap-3"><button onClick={handleCopy} disabled={!result} className={`text-sm px-4 py-2 rounded border flex items-center gap-2 transition-all ${isCopied ? 'bg-green-100 text-green-700 border-green-200' : isDarkMode ? 'bg-slate-800 text-slate-300 border-slate-600 hover:bg-slate-700 disabled:opacity-30' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 disabled:opacity-50'}`}>{isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}{isCopied ? '已複製' : '複製'}</button></div>
          </div>
          <div className={`flex-grow p-8 overflow-y-auto custom-scrollbar ${isDarkMode ? "bg-slate-900 text-slate-200" : "bg-slate-50/50 text-slate-800"}`}>
            {isLoading ? (
              <div className="h-full flex flex-col items-center justify-center gap-6 animate-in fade-in duration-500"><div className="w-16 h-16"><MaterialSpinner className={isDarkMode ? "text-blue-400" : "text-blue-600"} /></div><p className={`text-lg font-medium animate-pulse ${mutedTextClass}`}>Gemini 正在分析畫面風格與內容...</p></div>
            ) : result ? (
                <>
                    <SimpleMarkdownRenderer content={result} isDarkMode={isDarkMode} />
                    {/* 新增：翻譯註釋區塊 (可收折，平滑滑動效果) */}
                    {tips && (
                        <div className={`mt-8 rounded-xl border animate-in slide-in-from-bottom-4 duration-700 overflow-hidden transition-all ${tipsContainerClass}`}>
                            <button
                                onClick={() => setIsTipsOpen(!isTipsOpen)}
                                className={`w-full flex items-center justify-between p-5 text-left transition-colors font-bold text-lg ${tipsHeaderClass} hover:bg-black/5 active:bg-black/10`}
                            >
                                <div className="flex items-center gap-2">
                                    <Lightbulb className="w-5 h-5" /> 翻譯註釋 (Translation Tips)
                                </div>
                                <div className={`transition-transform duration-300 ${isTipsOpen ? 'rotate-180' : ''}`}>
                                     <ChevronDown className="w-5 h-5 opacity-70" />
                                </div>
                            </button>
                            
                            <div className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${isTipsOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                                <div className="overflow-hidden">
                                    <div className="px-5 pb-5 pt-0 text-base leading-relaxed opacity-90 font-sans">
                                        <div className={`h-px w-full mb-4 ${tipsDividerClass}`}></div>
                                        <SimpleMarkdownRenderer content={tips} isDarkMode={isDarkMode} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            ) : (
              <div className={`h-full flex flex-col items-center justify-center select-none ${mutedTextClass}`}><Send className="w-16 h-16 mb-5 opacity-30" /><p className="text-xl font-medium">等待輸入與指令...</p><p className="text-base mt-2 opacity-60">翻譯結果與排版將顯示於此</p></div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;