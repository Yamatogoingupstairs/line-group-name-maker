"""FastAPI アプリケーション

LINEグループ名メーカーのバックエンド。
- /generate エンドポイントでOpenAI APIを使ってグループ名の候補を返す。
- OpenAI APIキーは環境変数 OPENAI_API_KEY から読み込む。
"""

from __future__ import annotations

import os
from typing import List

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

try:
  import openai
except ImportError as exc:  # pragma: no cover - ライブラリが無い環境用のフォールバック
  raise ImportError(
      "openai パッケージがインストールされていません。 `pip install openai` を実行してください。"
  ) from exc

app = FastAPI(title="LINE Group Name Maker API")

# OpenAIのAPIキーを環境変数から取得
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
if OPENAI_API_KEY:
  openai.api_key = OPENAI_API_KEY


class GenerateRequest(BaseModel):
  """グループ名生成のリクエストモデル"""

  keywords: str = Field(..., description="ユーザーが入力したキーワード。スペース区切り想定。")
  category: str = Field(..., description="カテゴリ識別子。例: trendy / cute など。")
  count: int = Field(5, ge=1, le=10, description="生成する候補数")
  isAIMode: bool = Field(True, description="AIモードかどうか。UI側の状態保持用")


class GenerateResponse(BaseModel):
  """グループ名生成のレスポンスモデル"""

  names: List[str]
  source: str = Field("AI", description="生成元を示す固定値。UI側でのバッジ表示用")


@app.post("/generate", response_model=GenerateResponse)
async def generate_group_names(payload: GenerateRequest) -> GenerateResponse:
  """OpenAI APIを利用してグループ名候補を生成する"""

  if not OPENAI_API_KEY:
    raise HTTPException(status_code=500, detail="OPENAI_API_KEY が設定されていません")

  prompt = (
      "あなたはユニークで親しみやすいLINEグループ名を提案するアシスタントです。\n"
      "以下の条件をもとに、日本語で楽しく使える名前を {count} 個考えてください。\n"
      "- キーワード: {keywords}\n"
      "- カテゴリ: {category}\n"
      "- 文字数は8文字程度までを中心に、多様性を持たせる\n"
      "- カッコよさ・可愛さ・ネタ感など、ユーザー入力の雰囲気を活かす\n"
      "出力は箇条書きではなく、1行に1つずつシンプルにグループ名のみを並べてください。"
  ).format(
      count=payload.count,
      keywords=payload.keywords,
      category=payload.category,
  )

  try:
    response = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        temperature=0.9,
        messages=[
            {"role": "system", "content": "あなたはクリエイティブなネーミングのプロです。"},
            {"role": "user", "content": prompt},
        ],
        n=1,
    )
  except openai.error.OpenAIError as exc:  # type: ignore[attr-defined]
    raise HTTPException(status_code=502, detail=f"OpenAI APIエラー: {exc}") from exc

  text = response.choices[0].message.get("content", "")
  # 改行で分割し、空行を除去
  candidates = [line.strip("-• ") for line in text.splitlines() if line.strip()]

  if len(candidates) < payload.count:
    # AIからの応答が少なかった場合は末尾に番号を追加して補完
    for idx in range(len(candidates) + 1, payload.count + 1):
      candidates.append(f"追加候補{idx}")

  # UIでバッジ表示に利用できるよう source を付加
  return GenerateResponse(names=candidates[: payload.count], source="AI")


@app.get("/")
async def root() -> dict[str, str]:
  """ヘルスチェック用の簡単なエンドポイント"""

  return {"message": "LINEグループ名メーカーAPIは稼働中です"}


@app.get("/health")
async def health() -> dict[str, bool]:
  """フロントエンド向けのAI利用可否を返すエンドポイント"""

  ai_enabled = bool(os.environ.get("OPENAI_API_KEY"))
  return {"ai_enabled": ai_enabled}
