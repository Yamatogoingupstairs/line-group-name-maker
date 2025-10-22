// LINEグループ名メーカー UI ロジック
// - タブ切替でAI/ランダムの違いを明確化
// - /health でAI利用可否を判定し、UIへ反映
// - 比較モードやチュートリアル、APIキー記録など補助機能を実装

document.addEventListener("DOMContentLoaded", () => {
  // 定数・DOM参照 ------------------------------
  const STORAGE_KEYS = {
    MODE: "lgm:lastMode",
    COMPARE: "lgm:compareMode",
    TUTORIAL: "lgm:tutorialDone",
    API_KEY: "lgm:apiKeyMemo",
  };

  const tabs = Array.from(document.querySelectorAll(".mode-tab"));
  const modeDescription = document.getElementById("mode-description");
  const descriptionItems = modeDescription.querySelectorAll("p");
  const aiDisabledBanner = document.getElementById("ai-disabled-banner");
  const openSettingsBtn = document.getElementById("open-settings-btn");
  const form = document.getElementById("generator-form");
  const keywordsInput = document.getElementById("keywords");
  const categorySelect = document.getElementById("category");
  const compareToggleWrapper = document.querySelector(".compare-toggle");
  const compareToggle = document.getElementById("compare-toggle");
  const compareHint = document.querySelector(".compare-hint");
  const generateBtn = document.getElementById("generate-btn");
  const regenerateBtn = document.getElementById("regenerate");
  const resultsContainer = document.getElementById("results");
  const cardTemplate = document.getElementById("result-card-template");
  const tutorialOverlay = document.getElementById("tutorial-overlay");
  const tutorialNext = document.getElementById("tutorial-next");
  const tutorialSkip = document.getElementById("tutorial-skip");
  const settingsModal = document.getElementById("settings-modal");
  const apiKeyInput = document.getElementById("api-key-input");
  const saveApiKeyBtn = document.getElementById("save-api-key");
  const closeSettingsBtn = document.getElementById("close-settings");
  const toastContainer = document.getElementById("toast-container");

  // 状態管理 ------------------------------------
  const state = {
    mode: "random",
    compare: false,
    aiEnabled: true,
    lastInput: null, // { keywords, category }
  };

  // 単語プール（ランダム生成用）
  const wordPools = {
    trendy: {
      prefix: ["キラメキ", "フューチャー", "グロッシー", "ネオ", "ハイライト"],
      suffix: ["クルー", "デイズ", "コレクティブ", "セッション", "エディション"],
    },
    cute: {
      prefix: ["ふわふわ", "もこもこ", "きらきら", "ほわほわ", "きゅんきゅん"],
      suffix: ["クラブ", "パーティ", "カフェ", "ルーム", "チャンネル"],
    },
    funny: {
      prefix: ["ギリギリ", "もう限界", "やらかし", "突発", "奇跡の"],
      suffix: ["選抜", "アワー", "秘密基地", "倶楽部", "作戦会議"],
    },
    cool: {
      prefix: ["蒼炎", "クロノ", "レイジング", "シャドウ", "ヴァイブ"],
      suffix: ["同盟", "ネクサス", "リンクス", "フォース", "ブレインズ"],
    },
    warm: {
      prefix: ["ぽかぽか", "まったり", "おやつ", "ぬくもり", "こたつ"],
      suffix: ["タイム", "亭", "家族", "研究会", "日和"],
    },
  };

  // ユーティリティ ------------------------------
  const showToast = (message, duration = 3200) => {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.classList.add("hidden");
      toast.remove();
    }, duration);
  };

  const setBodyModalState = (open) => {
    document.body.classList.toggle("modal-open", open);
  };

  const saveLocalState = () => {
    localStorage.setItem(STORAGE_KEYS.MODE, state.mode);
    localStorage.setItem(STORAGE_KEYS.COMPARE, String(state.compare));
  };

  const restoreLocalState = () => {
    const savedMode = localStorage.getItem(STORAGE_KEYS.MODE);
    if (savedMode === "ai" || savedMode === "random") {
      state.mode = savedMode;
    }
    const savedCompare = localStorage.getItem(STORAGE_KEYS.COMPARE);
    state.compare = savedCompare === "true";
    compareToggle.checked = state.compare;
  };

  const updateModeDescription = () => {
    descriptionItems.forEach((item) => {
      const itemMode = item.dataset.mode;
      const active = state.compare && state.aiEnabled ? true : state.mode === itemMode;
      item.classList.toggle("active", active);
    });
  };

  const getGenerateButtonLabel = (loading = false) => {
    if (state.compare && state.aiEnabled) {
      return loading ? "比較結果を準備中…" : "AIとランダムで比較生成";
    }
    if (state.mode === "ai") {
      return loading ? "AIが考え中…" : "AIで生成";
    }
    return loading ? "シャッフル中…" : "ランダムで生成";
  };

  const updateGenerateButton = (loading = false) => {
    generateBtn.textContent = getGenerateButtonLabel(loading);
    generateBtn.setAttribute("aria-busy", loading ? "true" : "false");
    generateBtn.disabled = loading;
  };

  const setCompareAvailability = () => {
    const disabled = !state.aiEnabled;
    compareToggle.disabled = disabled;
    compareToggleWrapper.classList.toggle("disabled", disabled);
    compareHint.textContent = disabled
      ? "AIキー設定後に比較モードが利用できます。"
      : "同じ入力でAIとランダムの違いを左右で見比べられます。";
    if (disabled && state.compare) {
      state.compare = false;
      compareToggle.checked = false;
      saveLocalState();
    }
    resultsContainer.dataset.layout = state.compare && state.aiEnabled ? "compare" : "single";
  };

  const updateTabUI = () => {
    tabs.forEach((tab) => {
      const mode = tab.dataset.mode;
      const isSelected = state.mode === mode;
      const isAI = mode === "ai";
      const disabled = isAI && !state.aiEnabled;
      tab.setAttribute("aria-selected", String(isSelected));
      tab.tabIndex = disabled ? -1 : isSelected ? 0 : -1;
      if (disabled) {
        tab.setAttribute("aria-disabled", "true");
      } else {
        tab.removeAttribute("aria-disabled");
      }
    });
    updateModeDescription();
    saveLocalState();
    updateGenerateButton(false);
  };

  const openSettingsModal = () => {
    if (!tutorialOverlay.classList.contains("hidden")) {
      closeTutorial();
    }
    apiKeyInput.value = localStorage.getItem(STORAGE_KEYS.API_KEY) ?? "";
    settingsModal.classList.remove("hidden");
    setBodyModalState(true);
    apiKeyInput.focus();
  };

  const closeSettingsModal = () => {
    settingsModal.classList.add("hidden");
    setBodyModalState(false);
  };

  const openTutorial = () => {
    if (localStorage.getItem(STORAGE_KEYS.TUTORIAL)) return;
    tutorialOverlay.classList.remove("hidden");
    setBodyModalState(true);
  };

  const closeTutorial = () => {
    tutorialOverlay.classList.add("hidden");
    setBodyModalState(false);
    localStorage.setItem(STORAGE_KEYS.TUTORIAL, "true");
  };

  const createColumn = (title, source) => {
    const column = document.createElement("div");
    column.className = "result-column";

    const heading = document.createElement("h3");
    heading.innerHTML = `${title} <span class="badge-label">${source}</span>`;
    column.appendChild(heading);

    const list = document.createElement("div");
    list.className = "result-list";
    column.appendChild(list);

    return { column, list };
  };

  const createLoadingCard = (type) => {
    const card = document.createElement("div");
    card.className = "loading-card";
    if (type === "ai") {
      card.innerHTML = '<div class="spinner" aria-hidden="true"></div><span>AIが考え中…</span>';
    } else {
      card.innerHTML =
        '<div class="shuffle" aria-hidden="true"><span></span><span></span><span></span></div><span>シャッフル中…</span>';
    }
    return card;
  };

  const renderCards = (listEl, names, source) => {
    listEl.innerHTML = "";
    if (!names || names.length === 0) {
      const empty = document.createElement("p");
      empty.className = "no-results";
      empty.textContent = "候補が見つかりませんでした。入力内容を変えてみてください。";
      listEl.appendChild(empty);
      return;
    }

    names.forEach((name) => {
      const fragment = cardTemplate.content.cloneNode(true);
      const card = fragment.querySelector(".result-card");
      const nameEl = fragment.querySelector(".group-name");
      const badgeEl = fragment.querySelector(".result-badge");
      const copyBtn = fragment.querySelector(".copy-btn");

      card.dataset.source = source;
      badgeEl.textContent = source;
      nameEl.textContent = name;

      copyBtn.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(name);
          copyBtn.textContent = "コピーしました！";
          copyBtn.classList.add("copied");
          setTimeout(() => {
            copyBtn.textContent = "コピー";
            copyBtn.classList.remove("copied");
          }, 1500);
        } catch (error) {
          copyBtn.textContent = "コピー失敗";
          showToast("クリップボードにコピーできませんでした。");
          setTimeout(() => {
            copyBtn.textContent = "コピー";
          }, 1500);
        }
      });

      listEl.appendChild(fragment);
    });
  };

  const showLoading = () => {
    const layout = state.compare && state.aiEnabled ? "compare" : "single";
    resultsContainer.innerHTML = "";
    resultsContainer.dataset.layout = layout;
    resultsContainer.setAttribute("aria-busy", "true");

    if (layout === "compare") {
      const aiColumn = createColumn("AIの候補", "AI");
      const randomColumn = createColumn("ランダムの候補", "RANDOM");
      aiColumn.list.appendChild(createLoadingCard("ai"));
      randomColumn.list.appendChild(createLoadingCard("random"));
      resultsContainer.append(aiColumn.column, randomColumn.column);
    } else {
      const source = state.mode === "ai" ? "AI" : "RANDOM";
      const title = state.mode === "ai" ? "AIの候補" : "ランダムの候補";
      const column = createColumn(title, source);
      column.list.appendChild(createLoadingCard(state.mode === "ai" ? "ai" : "random"));
      resultsContainer.appendChild(column.column);
    }
  };

  const renderResultsSingle = (names, source) => {
    resultsContainer.innerHTML = "";
    resultsContainer.dataset.layout = "single";
    const title = source === "AI" ? "AIの候補" : "ランダムの候補";
    const column = createColumn(title, source);
    renderCards(column.list, names, source);
    resultsContainer.appendChild(column.column);
    resultsContainer.setAttribute("aria-busy", "false");
  };

  const renderResultsCompare = (aiNames, randomNames) => {
    resultsContainer.innerHTML = "";
    resultsContainer.dataset.layout = "compare";

    const aiColumn = createColumn("AIの候補", "AI");
    renderCards(aiColumn.list, aiNames, "AI");
    const randomColumn = createColumn("ランダムの候補", "RANDOM");
    renderCards(randomColumn.list, randomNames, "RANDOM");

    resultsContainer.append(aiColumn.column, randomColumn.column);
    resultsContainer.setAttribute("aria-busy", "false");
  };

  const generateRandomNames = (category, keywords, count = 5) => {
    const pool = wordPools[category] ?? wordPools.trendy;
    const keywordParts = keywords
      .split(/\s+/)
      .map((word) => word.trim())
      .filter((word) => word.length > 0);
    const keywordPool = keywordParts.length > 0 ? keywordParts : ["みんな"];
    const results = new Set();

    while (results.size < count) {
      const prefixCandidates = [...pool.prefix, ...keywordPool];
      const suffixCandidates = [...pool.suffix, ...keywordPool.map((k) => `${k}団`)];
      const prefix = prefixCandidates[Math.floor(Math.random() * prefixCandidates.length)];
      const suffix = suffixCandidates[Math.floor(Math.random() * suffixCandidates.length)];
      const name = `${prefix}${suffix}`.replace(/(.+)(\1)/, "$1");
      results.add(name);
      if (results.size >= 20) break; // セーフティ
    }

    return Array.from(results).slice(0, count);
  };

  const generateViaAI = async (payload) => {
    const response = await fetch("/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(`AI生成に失敗しました（${response.status}）`);
    }
    const data = await response.json();
    const names = Array.isArray(data.names) ? data.names : [];
    return { names, source: data.source ?? "AI" };
  };

  const handleGenerate = async (event, { regenerate = false } = {}) => {
    event?.preventDefault();

    const keywords = regenerate && state.lastInput ? state.lastInput.keywords : keywordsInput.value.trim();
    const category = regenerate && state.lastInput ? state.lastInput.category : categorySelect.value;

    if (!keywords) {
      showToast("キーワードを入力してください。");
      resultsContainer.innerHTML = "";
      resultsContainer.dataset.layout = state.compare && state.aiEnabled ? "compare" : "single";
      return;
    }

    state.lastInput = { keywords, category };
    updateGenerateButton(true);
    regenerateBtn.disabled = true;
    showLoading();

    const useCompare = state.compare && state.aiEnabled;

    try {
      if (useCompare) {
        const aiPromise = generateViaAI({ keywords, category, count: 5, isAIMode: true });
        const randomPromise = Promise.resolve(generateRandomNames(category, keywords, 5));
        const [aiResult, randomResult] = await Promise.allSettled([aiPromise, randomPromise]);

        const aiNames = aiResult.status === "fulfilled" ? aiResult.value.names : [];
        const randomNames = randomResult.status === "fulfilled" ? randomResult.value : [];

        if (aiResult.status === "fulfilled" && randomResult.status === "fulfilled") {
          renderResultsCompare(aiNames, randomNames);
        } else {
          resultsContainer.innerHTML = "";
          resultsContainer.dataset.layout = "compare";

          const aiColumnObj = createColumn("AIの候補", "AI");
          if (aiResult.status === "fulfilled") {
            renderCards(aiColumnObj.list, aiNames, "AI");
          } else {
            const error = document.createElement("p");
            error.className = "error-message";
            error.textContent = "AI生成がうまくいきませんでした。";
            aiColumnObj.list.appendChild(error);
            showToast("AI生成に失敗しました。設定を確認してください。");
          }

          const randomColumnObj = createColumn("ランダムの候補", "RANDOM");
          if (randomResult.status === "fulfilled") {
            renderCards(randomColumnObj.list, randomNames, "RANDOM");
          } else {
            const error = document.createElement("p");
            error.className = "error-message";
            error.textContent = "ランダム生成で問題が発生しました。";
            randomColumnObj.list.appendChild(error);
            showToast("ランダム生成に失敗しました。");
          }

          resultsContainer.append(aiColumnObj.column, randomColumnObj.column);
          resultsContainer.setAttribute("aria-busy", "false");
        }
      } else if (state.mode === "ai") {
        const { names, source } = await generateViaAI({ keywords, category, count: 5, isAIMode: true });
        renderResultsSingle(names, source);
      } else {
        const names = generateRandomNames(category, keywords, 5);
        renderResultsSingle(names, "RANDOM");
      }
      regenerateBtn.disabled = false;
    } catch (error) {
      console.error(error);
      resultsContainer.innerHTML = "";
      resultsContainer.setAttribute("aria-busy", "false");
      const errorMessage = document.createElement("p");
      errorMessage.className = "error-message";
      errorMessage.textContent =
        state.mode === "ai"
          ? "AI生成に失敗しました。時間をおいて再試行してください。"
          : "生成に失敗しました。入力内容を確認してください。";
      resultsContainer.appendChild(errorMessage);
      showToast("エラーが発生しました。もう一度お試しください。");
    } finally {
      updateGenerateButton(false);
    }
  };

  const setMode = (mode) => {
    if (mode === "ai" && !state.aiEnabled) {
      showToast("AIはAPIキー設定後に利用できます。設定画面を開きます。");
      openSettingsModal();
      return;
    }
    state.mode = mode;
    updateTabUI();
  };

  const handleTabInteraction = (event) => {
    const target = event.target.closest(".mode-tab");
    if (!target) return;
    const mode = target.dataset.mode;
    setMode(mode);
  };

  const handleTabKeydown = (event) => {
    const currentIndex = tabs.findIndex((tab) => tab.getAttribute("aria-selected") === "true");
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const direction = event.key === "ArrowRight" ? 1 : -1;
      let nextIndex = currentIndex;
      for (let i = 0; i < tabs.length; i += 1) {
        nextIndex = (nextIndex + direction + tabs.length) % tabs.length;
        const nextTab = tabs[nextIndex];
        if (nextTab.getAttribute("aria-disabled") !== "true") {
          nextTab.focus();
          setMode(nextTab.dataset.mode);
          break;
        }
      }
    }
    if (event.key === "Home") {
      event.preventDefault();
      const firstEnabled = tabs.find((tab) => tab.getAttribute("aria-disabled") !== "true");
      firstEnabled?.focus();
      firstEnabled && setMode(firstEnabled.dataset.mode);
    }
    if (event.key === "End") {
      event.preventDefault();
      for (let i = tabs.length - 1; i >= 0; i -= 1) {
        const tab = tabs[i];
        if (tab.getAttribute("aria-disabled") !== "true") {
          tab.focus();
          setMode(tab.dataset.mode);
          break;
        }
      }
    }
  };

  const checkHealth = async (showFeedback = false) => {
    try {
      const response = await fetch("/health");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      state.aiEnabled = Boolean(data.ai_enabled);
    } catch (error) {
      state.aiEnabled = false;
      if (showFeedback) {
        showToast("サーバーに接続できませんでした。後ほどお試しください。");
      }
    } finally {
      const shouldShowBanner = !state.aiEnabled;
      aiDisabledBanner.classList.toggle("hidden", !shouldShowBanner);
      setCompareAvailability();
      if (!state.aiEnabled && state.mode === "ai") {
        state.mode = "random";
      }
      updateTabUI();
    }
  };

  // イベント登録 --------------------------------
  document.querySelector(".mode-tabs").addEventListener("click", handleTabInteraction);
  document.querySelector(".mode-tabs").addEventListener("keydown", handleTabKeydown);

  compareToggle.addEventListener("change", () => {
    if (compareToggle.checked && !state.aiEnabled) {
      compareToggle.checked = false;
      showToast("AIが無効のため比較モードは使えません。");
      return;
    }
    state.compare = compareToggle.checked;
    saveLocalState();
    updateModeDescription();
    updateGenerateButton(false);
    resultsContainer.dataset.layout = state.compare && state.aiEnabled ? "compare" : "single";
  });

  form.addEventListener("submit", (event) => handleGenerate(event));

  regenerateBtn.addEventListener("click", (event) => {
    if (!state.lastInput) {
      showToast("まずは生成してみましょう！");
      return;
    }
    handleGenerate(event, { regenerate: true });
  });

  openSettingsBtn.addEventListener("click", openSettingsModal);
  saveApiKeyBtn.addEventListener("click", () => {
    const value = apiKeyInput.value.trim();
    if (!value) {
      showToast("APIキーを入力してください。");
      return;
    }
    localStorage.setItem(STORAGE_KEYS.API_KEY, value);
    showToast("APIキーを保存しました。サーバーにも設定してくださいね。", 3800);
    closeSettingsModal();
    checkHealth(true);
  });
  closeSettingsBtn.addEventListener("click", closeSettingsModal);
  settingsModal.addEventListener("click", (event) => {
    if (event.target === settingsModal) {
      closeSettingsModal();
    }
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (!tutorialOverlay.classList.contains("hidden")) {
        closeTutorial();
      }
      if (!settingsModal.classList.contains("hidden")) {
        closeSettingsModal();
      }
    }
  });

  tutorialNext.addEventListener("click", closeTutorial);
  tutorialSkip.addEventListener("click", closeTutorial);

  // 初期化 --------------------------------------
  restoreLocalState();
  resultsContainer.dataset.layout = state.compare && state.aiEnabled ? "compare" : "single";
  updateTabUI();
  checkHealth(false);
  openTutorial();
});
