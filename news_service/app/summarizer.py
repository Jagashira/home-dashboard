from __future__ import annotations

from typing import Any

import requests


PROMPT = """あなたはニュース要約アシスタントです。
記事本文を日本語で3行の箇条書きに要約してください。
出力はプレーンテキストのみ。各行は「・」で始めてください。"""


class Summarizer:
    def __init__(self, api_key: str, model: str):
        self.api_key = api_key
        self.model = model

    def summarize(self, title: str, content: str) -> str:
        if not content.strip():
            return "・本文が取得できないため要約を生成できません\n・元記事リンクを確認してください\n・必要に応じて再取得してください"

        response = requests.post(
            "https://api.openai.com/v1/responses",
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": self.model,
                "input": [
                    {"role": "system", "content": PROMPT},
                    {
                        "role": "user",
                        "content": f"タイトル: {title}\n\n本文:\n{content[:12000]}",
                    },
                ],
                "temperature": 0.2,
            },
            timeout=45,
        )
        response.raise_for_status()
        data = response.json()
        text = self._extract_output_text(data).strip()
        return text or "・要約結果が空でした\n・記事本文の品質を確認してください\n・再実行で改善する場合があります"

    @staticmethod
    def _extract_output_text(data: dict[str, Any]) -> str:
        if isinstance(data.get("output_text"), str):
            return data["output_text"]

        output = data.get("output")
        if not isinstance(output, list):
            return ""
        parts: list[str] = []
        for block in output:
            if not isinstance(block, dict):
                continue
            content = block.get("content")
            if not isinstance(content, list):
                continue
            for item in content:
                if not isinstance(item, dict):
                    continue
                text = item.get("text")
                if isinstance(text, str):
                    parts.append(text)
        return "\n".join(parts)

