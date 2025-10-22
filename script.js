// LINEグループ名メーカーのフロントエンドロジック
// - ランダム生成モード: 事前定義した単語リストから生成
// - AI生成モード: FastAPIのエンドポイントを経由してOpenAIに問い合わせ

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("generator-form");
  const keywordsInput = document.getElementById("keywords");
  const categorySelect = document.getElementById("category");
  const resultsContainer = document.getElementById("results");
  const regenerateBtn = document.getElementById("regenerate");
  const modeToggle = document.getElementById("mode-toggle");
  const randomLabel = document.getElementById("random-label");
  const aiLabel = document.getElementById("ai-label");
  const cardTemplate = document.getElementById("result-card-template");

  // 直近の入力内容を保持し、再生成に利用
  let lastRequest = null;

  // カテゴリごとの単語リスト。キーワードを混ぜやすいようにパーツ別に用意。
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

  /**
   * モード切替のUI反映
   */
  const updateModeLabels = () => {
    const isAI = modeToggle.checked;
    randomLabel.classList.toggle("active", !isAI);
    aiLabel.classList.toggle("active", isAI);
  };

  modeToggle.addEventListener("change", updateModeLabels);

  /**
   * ランダム生成モードでグループ名を作成
   * @param {string} category - 選択されたカテゴリ
   * @param {string} keywords - ユーザー入力
   * @param {number} count - 生成する候補数
   */
  const generateRandomNames = (category, keywords, count = 5) => {
    const pool = wordPools[category] ?? wordPools.trendy;
    const keywordParts = keywords
      .split(/\s+/)
      .map((word) => word.trim())
      .filter((word) => word.length > 0);

    // キーワードの候補をパーツとして扱いやすいよう保存
    const keywordPool = keywordParts.length > 0 ? keywordParts : ["みんな"];
    const results = new Set();

    while (results.size < count) {
      const prefixCandidates = [...pool.prefix, ...keywordPool];
      const suffixCandidates = [...pool.suffix, ...keywordPool.map((k) => `${k}団`)];

      const prefix = prefixCandidates[Math.floor(Math.random() * prefixCandidates.length)];
      const suffix = suffixCandidates[Math.floor(Math.random() * suffixCandidates.length)];

      const name = `${prefix}${suffix}`.replace(/(.+)(\1)/, "$1");
      results.add(name);

      // 無限ループを避けるためセーフティ
      if (results.size >= 20) break;
    }

    return Array.from(results).slice(0, count);
  };

  /**
   * 結果カードを描画
   */
  const renderResults = (names) => {
    resultsContainer.innerHTML = "";

    if (!names || names.length === 0) {
      const empty = document.createElement("p");
      empty.textContent = "候補が見つかりませんでした。入力内容を変えてみてください。";
      empty.className = "no-results";
      resultsContainer.appendChild(empty);
      regenerateBtn.disabled = true;
      return;
    }

    names.forEach((name) => {
      const fragment = cardTemplate.content.cloneNode(true);
      const card = fragment.querySelector(".result-card");
      const nameElement = fragment.querySelector(".group-name");
      const copyBtn = fragment.querySelector(".copy-btn");

      nameElement.textContent = name;

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
          console.error("Clipboard error", error);
          setTimeout(() => {
            copyBtn.textContent = "コピー";
          }, 1500);
        }
      });

      resultsContainer.appendChild(fragment);
    });

    regenerateBtn.disabled = false;
  };

  /**
   * APIを利用したAI生成モード
   */
  const generateViaAI = async (payload) => {
    try {
      const response = await fetch("/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      return Array.isArray(data.names) ? data.names : [];
    } catch (error) {
      console.error("AI生成に失敗しました", error);
      return [];
    }
  };

  /**
   * フォーム送信処理
   */
  const handleSubmit = async (event, isRegenerate = false) => {
    event.preventDefault();

    // 再生成時は前回の入力値を利用
    const keywords = isRegenerate && lastRequest ? lastRequest.keywords : keywordsInput.value.trim();
    const category = isRegenerate && lastRequest ? lastRequest.category : categorySelect.value;
    const isAIMode = isRegenerate && lastRequest ? lastRequest.isAIMode : modeToggle.checked;

    if (!keywords) {
      renderResults([]);
      return;
    }

    const payload = { keywords, category, count: 5, isAIMode };
    lastRequest = payload;

    resultsContainer.innerHTML = "<p class=\"loading\">生成中…ちょっと待ってね！</p>";

    if (isAIMode) {
      const aiNames = await generateViaAI(payload);
      if (aiNames.length > 0) {
        renderResults(aiNames);
      } else {
        resultsContainer.innerHTML = "<p class=\"error\">AI生成に失敗しました。ランダム生成をお試しください。</p>";
        regenerateBtn.disabled = false;
      }
    } else {
      const randomNames = generateRandomNames(category, keywords, 5);
      renderResults(randomNames);
    }
  };

  form.addEventListener("submit", (event) => handleSubmit(event, false));

  regenerateBtn.addEventListener("click", (event) => {
    if (!lastRequest) return;
    handleSubmit(event, true);
  });

  updateModeLabels();
});
