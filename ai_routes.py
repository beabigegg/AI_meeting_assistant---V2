# ai_routes.py
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from services.dify_client import translate_text as _translate_text, summarize_text as _summarize_text, extract_action_items as _extract_action_items

ai_bp = Blueprint("ai_bp", __name__, url_prefix="/api")

@ai_bp.post("/translate/text")
@jwt_required()
def translate_text_api():
    data = request.get_json(force=True) or {}
    text = (data.get("text") or "").strip()
    target = (data.get("target_lang") or "繁體中文").strip()
    if not text:
        return jsonify({"error": "text is required"}), 400
    user_id = str(get_jwt_identity() or "user")
    translated = _translate_text(text, target, user_id=user_id)
    return jsonify({"translated": translated})

@ai_bp.post("/summarize/text")
@jwt_required()
def summarize_text_api():
    data = request.get_json(force=True) or {}
    text = (data.get("text") or "").strip()
    if not text:
        return jsonify({"error": "text is required"}), 400
    user_id = str(get_jwt_identity() or "user")
    summary = _summarize_text(text, user_id=user_id)
    return jsonify({"summary": summary})

@ai_bp.post("/action-items/preview")
@jwt_required()
def preview_action_items_api():
    data = request.get_json(force=True) or {}
    text = (data.get("text") or "").strip()
    if not text:
        return jsonify({"error": "text is required"}), 400
    user_id = str(get_jwt_identity() or "user")
    items = _extract_action_items(text, user_id=user_id)
    return jsonify({"items": items})
