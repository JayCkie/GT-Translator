import React, { useState, useEffect, useRef } from 'react';
import { Send, Upload, X, Copy, Check, RotateCcw, Image as ImageIcon, Type, AlertCircle, Loader2, Key, Save, Globe, Sun, Moon, ChevronDown, ChevronUp, FileText, RefreshCw, AlertTriangle } from 'lucide-react';

// --- 預設值常數 ---
const DEFAULT_TARGET_LANG = "繁體中文";

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

  const lines = content.split('\n');
  
  const renderInline = (text) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
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
  
  // UI 狀態
  const [isApiKeyOpen, setIsApiKeyOpen] = useState(false); 
  const [inputType, setInputType] = useState('image'); 
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [result, setResult] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  
  // 動畫與回饋狀態
  const [isSaved, setIsSaved] = useState(false);
  const [isResetSuccess, setIsResetSuccess] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [isClosing, setIsClosing] = useState(false); // 新增：控制 Modal 關閉動畫
  
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
  }, []);

  // --- 儲存設定 ---
  const handleSaveSettings = () => {
    localStorage.setItem('gemini_user_api_key', userApiKey);
    localStorage.setItem('gemini_target_lang', targetLang);
    localStorage.setItem('gemini_rules', rules);
    localStorage.setItem('gemini_context', context);
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
      setIsClosing(false); // 確保每次打開時重置關閉狀態
  }

  // 處理關閉視窗 (帶動畫)
  const closeModal = () => {
      setIsClosing(true);
      setTimeout(() => {
          setShowResetModal(false);
          setIsClosing(false);
      }, 300); // 等待動畫時間
  }

  const confirmReset = () => {
      // 觸發關閉動畫
      setIsClosing(true);

      setTimeout(() => {
          // 實際執行重置
          localStorage.setItem('gemini_target_lang', DEFAULT_TARGET_LANG);
          localStorage.setItem('gemini_rules', DEFAULT_RULES);
          localStorage.setItem('gemini_context', DEFAULT_CONTEXT);
          
          setTargetLang(DEFAULT_TARGET_LANG);
          setRules(DEFAULT_RULES);
          setContext(DEFAULT_CONTEXT);

          setShowResetModal(false);
          setIsClosing(false);
          
          // 顯示成功提示
          setIsResetSuccess(true);
          setTimeout(() => setIsResetSuccess(false), 2000);
      }, 300);
  }

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
    setError('');

    handleSaveSettings();

    try {
      let payload = {};
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${userApiKey}`;

      const introInstruction = `你是一個專業的翻譯助手。請將提供的內容翻譯成${targetLang}。`;
      const hiddenFormatInstruction = "\n\n(IMPORTANT: Please structure your response using Markdown. Use headers (#, ##) for titles, bold (**) for emphasized text, and bullet points (-) for lists to mimic the visual layout of the image.)";
      const combinedSystemPrompt = `${introInstruction}\n\n${rules}\n\n【當前語境/Context】\n${context}${hiddenFormatInstruction}`;

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
        throw new Error(data.error?.message || 'API 請求失敗，請檢查 API Key 是否正確');
      }

      const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (generatedText) {
        setResult(generatedText);
      } else {
        throw new Error('未產生任何翻譯結果');
      }

    } catch (err) {
      console.error(err);
      
      // 優化：針對 API Key 錯誤提供更明確的提示並自動展開設定
      let errorMessage = err.message || '發生錯誤，請稍後再試';
      if (errorMessage.toLowerCase().includes('api key') || errorMessage.toLowerCase().includes('leaked')) {
          setIsApiKeyOpen(true);
          if (errorMessage.toLowerCase().includes('leaked')) {
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

  return (
    <div className={`min-h-screen font-sans p-4 md:p-8 transition-colors duration-500 ${bgClass} ${textClass}`} ref={containerRef}>
      
      {/* 動畫樣式定義 */}
      <style>{`
        /* 進場動畫 */
        @keyframes modalOverlayEnter {
          from { opacity: 0; backdrop-filter: blur(0); }
          to { opacity: 1; backdrop-filter: blur(4px); }
        }
        @keyframes modalContentEnter {
          from { opacity: 0; transform: scale(0.9) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        
        /* 離場動畫 (新增) */
        @keyframes modalOverlayExit {
          from { opacity: 1; backdrop-filter: blur(4px); }
          to { opacity: 0; backdrop-filter: blur(0); }
        }
        @keyframes modalContentExit {
          from { opacity: 1; transform: scale(1) translateY(0); }
          to { opacity: 0; transform: scale(0.9) translateY(10px); }
        }

        .animate-modal-overlay {
          animation: modalOverlayEnter 0.3s ease-out forwards;
        }
        .animate-modal-content {
          animation: modalContentEnter 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        
        /* 套用離場動畫 */
        .animate-modal-overlay-exit {
          animation: modalOverlayExit 0.3s ease-in forwards;
        }
        .animate-modal-content-exit {
          animation: modalContentExit 0.3s ease-in forwards;
        }
      `}</style>

      {/* 重置確認視窗 (Pop-up Modal with Custom CSS Animation) */}
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
                    確定要將目標語言、規則與語境恢復為系統預設值嗎？<br/>此動作無法復原。
                </p>
                <div className="flex justify-end gap-3">
                    <button
                        onClick={closeModal}
                        className={`px-4 py-2 text-base rounded font-medium transition-colors ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
                    >
                        取消
                    </button>
                    <button
                        onClick={confirmReset}
                        className="px-4 py-2 text-base bg-red-600 hover:bg-red-700 text-white rounded font-medium shadow-sm transition-all hover:scale-105 active:scale-95"
                    >
                        確認重置
                    </button>
                </div>
            </div>
        </div>
      )}

      <div className="w-[95%] max-w-[1800px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
        
        {/* 左側：設定與輸入區 */}
        <div className="flex flex-col gap-6">
          
          {/* Header & Controls */}
          <div className="flex justify-between items-start">
            <div>
                <h1 className={`text-3xl font-bold flex items-center gap-3 ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>
                <RotateCcw className="w-8 h-8 text-blue-600" />
                GT-Translator
                </h1>
                <p className={`${mutedTextClass} text-base mt-2`}>
                即時翻譯文字或截圖
                </p>
            </div>
            
            {/* 日出日落切換按鈕 */}
            <button 
                onClick={toggleTheme}
                className={`relative w-12 h-12 rounded-full overflow-hidden transition-all duration-500 shadow-sm ${isDarkMode ? 'bg-slate-800 border border-slate-700' : 'bg-blue-100/50 border border-blue-200'}`}
                title={isDarkMode ? "切換為亮色模式" : "切換為暗色模式"}
            >
                {/* 太陽 (亮色模式顯示) */}
                <div className={`absolute inset-0 flex items-center justify-center transition-all duration-500 transform ${isDarkMode ? 'translate-y-10 opacity-0 rotate-180' : 'translate-y-0 opacity-100 rotate-0'}`}>
                    <Sun className="w-6 h-6 text-orange-500" />
                </div>
                {/* 月亮 (暗色模式顯示) */}
                <div className={`absolute inset-0 flex items-center justify-center transition-all duration-500 transform ${isDarkMode ? 'translate-y-0 opacity-100 rotate-0' : '-translate-y-10 opacity-0 -rotate-180'}`}>
                    <Moon className="w-6 h-6 text-yellow-400" />
                </div>
            </button>
          </div>

          {/* 1. API Key Block (Collapsible) */}
          <div className={`rounded-xl border overflow-hidden transition-all duration-300 ${isApiKeyOpen ? 'ring-2 ring-blue-500/20' : ''} ${cardClass}`}>
            <button 
                onClick={() => setIsApiKeyOpen(!isApiKeyOpen)}
                className={`w-full px-5 py-4 flex justify-between items-center ${headerClass} hover:opacity-90 transition-opacity`}
            >
                <div className="flex items-center gap-2">
                    <Key className={`w-5 h-5 ${userApiKey ? (isDarkMode ? 'text-green-400' : 'text-green-600') : 'text-blue-500'}`} />
                    <span className={sectionTitleClass}>API Key 設定</span>
                    {userApiKey && !isApiKeyOpen && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 ml-2 animate-in fade-in">已設定</span>
                    )}
                </div>
                {isApiKeyOpen ? <ChevronUp className="w-5 h-5 opacity-60" /> : <ChevronDown className="w-5 h-5 opacity-60" />}
            </button>
            
            {isApiKeyOpen && (
                <div className="p-5 animate-in slide-in-from-top-1 fade-in duration-200">
                    <input 
                        type="password" 
                        value={userApiKey}
                        onChange={(e) => setUserApiKey(e.target.value)}
                        placeholder="請貼上您的 Gemini API Key (AIzaSy...)"
                        className={`w-full p-3 text-base border rounded focus:ring-2 focus:ring-blue-500 mb-2 ${inputBgClass}`}
                    />
                    <div className="flex justify-between items-center mt-3">
                        <p className={`text-sm ${mutedTextClass} flex-grow`}>
                            Key 僅儲存於瀏覽器本機。
                            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-blue-500 hover:underline ml-1">
                                取得免費 Key
                            </a>
                        </p>
                        <button 
                            onClick={handleManualSave} 
                            className={`flex items-center gap-2 px-5 py-2 rounded font-medium whitespace-nowrap transition-all duration-300 transform ${isSaved ? 'bg-green-600 hover:bg-green-700 text-white scale-105' : 'bg-blue-600 hover:bg-blue-700 text-white hover:scale-105 active:scale-95'}`}
                        >
                            {isSaved ? <Check className="w-4 h-4 animate-in zoom-in spin-in-90 duration-300" /> : <Save className="w-4 h-4" />}
                            {isSaved ? '已儲存' : '儲存'}
                        </button>
                    </div>
                </div>
            )}
          </div>

          {/* 2. 翻譯設定 (Target Lang & Rules) - 常駐顯示 */}
          <div className={`rounded-xl overflow-hidden border ${cardClass}`}>
            <div className={`px-5 py-4 border-b ${headerClass}`}>
                <h3 className={`flex items-center gap-2 ${sectionTitleClass}`}>
                    <FileText className="w-5 h-5" /> 翻譯規則設定
                </h3>
            </div>
            <div className="p-5 flex flex-col gap-4">
                {/* Target Language */}
                <div>
                    <label className={`text-sm font-semibold mb-2 flex items-center gap-1 ${mutedTextClass}`}>
                        <Globe className="w-4 h-4" /> 目標語言
                    </label>
                    <input 
                        type="text"
                        value={targetLang}
                        onChange={(e) => setTargetLang(e.target.value)}
                        onBlur={() => handleSaveSettings()}
                        className={`w-full p-3 text-base border rounded focus:ring-1 focus:ring-blue-500 ${inputBgClass}`}
                        placeholder="例如：繁體中文"
                    />
                </div>

                {/* Custom Rules */}
                <div>
                    <label className={`text-sm font-semibold mb-2 block ${mutedTextClass}`}>
                        通用排版與翻譯規則
                    </label>
                    <textarea 
                        value={rules}
                        onChange={(e) => setRules(e.target.value)}
                        onBlur={() => handleSaveSettings()}
                        className={`w-full h-32 p-3 text-sm border rounded focus:ring-1 focus:ring-blue-500 leading-relaxed ${inputBgClass}`}
                        placeholder="請輸入針對翻譯風格與排版的具體要求..."
                    />
                </div>

                <div className="flex justify-end">
                    <button 
                        onClick={handleResetClick} 
                        className={`px-4 py-2 text-sm rounded flex items-center gap-2 transition-all duration-300 transform ${isResetSuccess ? 'bg-green-100 text-green-700 font-medium scale-105' : isDarkMode ? "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:scale-105" : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:scale-105"}`}
                    >
                        {isResetSuccess ? (
                            <>
                                <Check className="w-4 h-4 animate-in zoom-in duration-300" /> 已恢復預設
                            </>
                        ) : (
                            <>
                                <RefreshCw className="w-4 h-4" /> 恢復預設規則
                            </>
                        )}
                    </button>
                </div>
            </div>
          </div>

          {/* 3. Context 設定 */}
          <div className={`rounded-xl overflow-hidden flex flex-col border ${cardClass}`}>
            <div className={`px-5 py-4 border-b flex justify-between items-center ${headerClass}`}>
              <span className={sectionTitleClass}>當前語境 (Context)</span>
              <span className={`text-sm opacity-70`}>針對本次翻譯的情境補充</span>
            </div>
            <div className="p-5">
              <textarea
                value={context}
                onChange={(e) => setContext(e.target.value)}
                onBlur={() => handleSaveSettings()}
                className={`w-full h-28 p-4 text-base border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none transition-all leading-relaxed ${inputBgClass}`}
                placeholder="例如：這是一張英雄聯盟的截圖，請不要翻譯角色名稱..."
              />
            </div>
          </div>

          {/* 4. 輸入區 */}
          <div className={`rounded-xl overflow-hidden flex flex-col flex-grow border ${cardClass}`}>
            <div className={`flex border-b ${isDarkMode ? "border-slate-700" : "border-slate-200"}`}>
              <button
                onClick={() => setInputType('image')}
                className={`flex-1 py-4 text-base font-medium flex items-center justify-center gap-2 transition-colors ${
                  inputType === 'image' 
                    ? 'bg-transparent text-blue-600 border-b-2 border-blue-600' 
                    : `${isDarkMode ? "bg-slate-900 text-slate-400 hover:bg-slate-800" : "bg-slate-50 text-slate-500 hover:bg-slate-100"}`
                }`}
              >
                <ImageIcon className="w-5 h-5" /> 截圖/圖片
              </button>
              <button
                onClick={() => setInputType('text')}
                className={`flex-1 py-4 text-base font-medium flex items-center justify-center gap-2 transition-colors ${
                  inputType === 'text' 
                    ? 'bg-transparent text-blue-600 border-b-2 border-blue-600' 
                    : `${isDarkMode ? "bg-slate-900 text-slate-400 hover:bg-slate-800" : "bg-slate-50 text-slate-500 hover:bg-slate-100"}`
                }`}
              >
                <Type className="w-5 h-5" /> 純文字
              </button>
            </div>

            <div className="p-5 flex-grow flex flex-col min-h-[300px]">
              <div className="flex justify-between items-center mb-2">
                <span className={sectionTitleClass}>輸入內容</span>
                {(inputText || selectedImage) && (
                  <button onClick={clearInput} className="text-sm text-red-500 hover:text-red-400 flex items-center gap-1">
                    <X className="w-4 h-4" /> 清除
                  </button>
                )}
              </div>

              {inputType === 'image' ? (
                <div className={`flex-grow border-2 border-dashed rounded-lg flex flex-col items-center justify-center relative transition-all overflow-hidden ${selectedImage ? 'border-blue-500/50' : isDarkMode ? 'bg-slate-950 border-slate-700 hover:border-slate-500' : 'bg-slate-50 border-slate-300 hover:border-blue-400'}`}>
                  {selectedImage ? (
                    <div className="relative w-full h-full flex items-center justify-center p-4">
                      <img src={selectedImage} alt="Preview" className="max-w-full max-h-[400px] object-contain rounded shadow-lg" />
                    </div>
                  ) : (
                    <div className="text-center p-8 pointer-events-none">
                      <div className="w-14 h-14 bg-blue-100/10 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Upload className="w-7 h-7" />
                      </div>
                      <p className={`font-medium text-lg ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>點擊上傳 或 直接貼上截圖 (Ctrl+V)</p>
                      <p className={`text-base mt-2 ${mutedTextClass}`}>支援 PNG, JPG, WebP</p>
                    </div>
                  )}
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                </div>
              ) : (
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  className={`w-full flex-grow p-4 text-lg border rounded-lg outline-none resize-none leading-relaxed ${inputBgClass}`}
                  placeholder="請在此輸入需要翻譯的文字..."
                />
              )}

              {error && (
                <div className="mt-4 bg-red-500/10 text-red-600 border border-red-500/20 text-base p-4 rounded-lg flex items-center gap-3">
                  <AlertCircle className="w-5 h-5" /> {error}
                </div>
              )}

              <button
                onClick={handleTranslate}
                disabled={isLoading}
                className="mt-5 w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-4 rounded-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed text-lg hover:scale-[1.01] active:scale-[0.99]"
              >
                {isLoading ? (
                  <>
                    <div className="w-6 h-6 mr-2">
                        <MaterialSpinner />
                    </div>
                    翻譯中...
                  </>
                ) : (
                  <>
                    <Send className="w-6 h-6" /> 開始翻譯
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* 右側：結果輸出區 */}
        <div className={`rounded-xl overflow-hidden flex flex-col h-full min-h-[500px] lg:min-h-auto transition-colors duration-300 border ${cardClass}`}>
          <div className={`px-5 py-4 border-b flex justify-between items-center ${headerClass}`}>
            <span className={sectionTitleClass}>翻譯結果</span>
            <div className="flex items-center gap-3">
                <button
                onClick={handleCopy}
                disabled={!result}
                className={`text-sm px-4 py-2 rounded border flex items-center gap-2 transition-all ${isCopied ? 'bg-green-100 text-green-700 border-green-200' : isDarkMode ? 'bg-slate-800 text-slate-300 border-slate-600 hover:bg-slate-700 disabled:opacity-30' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 disabled:opacity-50'}`}
                >
                {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {isCopied ? '已複製' : '複製'}
                </button>
            </div>
          </div>
          
          <div className={`flex-grow p-8 overflow-y-auto custom-scrollbar ${isDarkMode ? "bg-slate-900 text-slate-200" : "bg-slate-50/50 text-slate-800"}`}>
            {isLoading ? (
              <div className="h-full flex flex-col items-center justify-center gap-6 animate-in fade-in duration-500">
                <div className="w-16 h-16">
                    <MaterialSpinner className={isDarkMode ? "text-blue-400" : "text-blue-600"} />
                </div>
                <p className={`text-lg font-medium animate-pulse ${mutedTextClass}`}>Gemini 正在分析畫面風格與內容...</p>
              </div>
            ) : result ? (
                <SimpleMarkdownRenderer content={result} isDarkMode={isDarkMode} />
            ) : (
              <div className={`h-full flex flex-col items-center justify-center select-none ${mutedTextClass}`}>
                <Send className="w-16 h-16 mb-5 opacity-30" />
                <p className="text-xl font-medium">等待輸入與指令...</p>
                <p className="text-base mt-2 opacity-60">翻譯結果與排版將顯示於此</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;