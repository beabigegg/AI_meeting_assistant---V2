# services/dify_client.py
import os, json, re, requests
from dotenv import load_dotenv

load_dotenv()

DIFY_BASE = os.getenv("DIFY_API_BASE_URL", "https://api.dify.ai/v1")
TIMEOUT = 60

def _post_completion(api_key: str, query: str, inputs: dict | None = None, user_id: str = "system"):
    if not api_key:
        raise RuntimeError("Dify API key is not set")
    url = f"{DIFY_BASE}/completion-messages"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "inputs": inputs or {},
        "response_mode": "blocking",
        "user": user_id,
        "query": query,
    }
    resp = requests.post(url, headers=headers, json=payload, timeout=TIMEOUT)
    resp.raise_for_status()
    data = resp.json()
    return data.get("answer") or data

def translate_text(text: str, target_lang: str, user_id: str = "system") -> str:
    api_key = os.getenv("DIFY_TRANSLATOR_API_KEY")
    query = f"目標語言：{target_lang}\n需翻譯內容：\n{text}"
    return _post_completion(api_key, query, user_id=user_id)

def summarize_text(text: str, user_id: str = "system") -> str:
    api_key = os.getenv("DIFY_SUMMARIZER_API_KEY")
    return _post_completion(api_key, text, user_id=user_id)

def extract_action_items(text: str, user_id: str = "system") -> list[dict]:
    api_key = os.getenv("DIFY_ACTION_EXTRACTOR_API_KEY")
    raw = _post_completion(api_key, text, user_id=user_id)

    # 容錯：去除 ```json 之類的碼框，只保留第一段 JSON 陣列
    s = str(raw).strip()
    s = re.sub(r"^```(?:json)?|```$", "", s, flags=re.IGNORECASE|re.MULTILINE).strip()
    if not (s.startswith("[") and s.endswith("]")):
        import re as _re
        m = _re.search(r"\[[\s\S]*\]", s)
        if m: s = m.group(0)

    items = json.loads(s)
    if not isinstance(items, list):
        raise ValueError("Extractor 回傳非陣列")

    # 正規化鍵名供後續儲存：owner 暫保留名字，儲存時會解析成 owner_id
    normalized = []
    for i in items:
        for k in ("item", "action", "owner", "duedate"):
            if k not in i:
                raise ValueError(f"Extractor 回傳元素缺少必要鍵：{k}")
        normalized.append({
            "item": i["item"],
            "action": i["action"],
            "owner": i["owner"],
            "due_date": i["duedate"],  # 後端用 due_date，稍後再 parse 成 date
        })
    return normalized
