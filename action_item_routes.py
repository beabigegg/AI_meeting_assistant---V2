# action_item_routes.py
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from datetime import date
from models import db, User, Meeting, ActionItem

action_bp = Blueprint("action_bp", __name__, url_prefix="/api")

def _parse_date(s: str | None):
    if not s:
        return None
    try:
        return date.fromisoformat(str(s)[:10])
    except Exception:
        return None

def _resolve_owner_id(owner_val: str | None):
    """把 'owner'(使用者名稱字串) 轉到 ms_users.id，查不到就回 None。"""
    if not owner_val:
        return None
    owner_val = str(owner_val).strip()
    if not owner_val:
        return None
    user = User.query.filter_by(username=owner_val).first()
    return user.id if user else None

@action_bp.post("/action-items")
@jwt_required()
def create_action_item():
    """
    建立單筆代辦（會議詳情頁用）
    允許欄位：meeting_id(必) / item(或 context) / action(必) / owner_id or owner(使用者名) / due_date or duedate / status
    """
    data = request.get_json(force=True) or {}
    meeting_id = data.get("meeting_id")
    if not meeting_id:
        return jsonify({"error": "meeting_id is required"}), 400
    meeting = Meeting.query.get(meeting_id)
    if not meeting:
        return jsonify({"error": "meeting not found"}), 404

    action_text = (data.get("action") or "").strip()
    if not action_text:
        return jsonify({"error": "action is required"}), 400

    item_text = (data.get("item") or data.get("context") or "").strip() or None
    owner_id = data.get("owner_id")
    if owner_id is None:
        owner_id = _resolve_owner_id(data.get("owner"))
    due = _parse_date(data.get("due_date") or data.get("duedate"))
    status = (data.get("status") or "pending").strip() or "pending"

    try:
        ai = ActionItem(
            meeting_id=meeting_id,
            item=item_text,
            action=action_text,
            owner_id=owner_id,
            due_date=due,
            status=status,
        )
        db.session.add(ai)
        db.session.commit()
        return jsonify(ai.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"create failed: {e}"}), 400

@action_bp.post("/meetings/<int:meeting_id>/action-items/batch")
@jwt_required()
def batch_create_action_items(meeting_id: int):
    """
    批次建立代辦（AI 預覽 → 一鍵儲存）
    Request body: { "items": [ {item/context, action*, owner/owner_id, due_date/duedate}, ... ] }
    """
    payload = request.get_json(force=True) or {}
    items = payload.get("items") or []
    if not isinstance(items, list) or not items:
        return jsonify({"error": "items must be a non-empty array"}), 400

    meeting = Meeting.query.get(meeting_id)
    if not meeting:
        return jsonify({"error": "meeting not found"}), 404

    created = []
    try:
        for r in items:
            action_text = (r.get("action") or "").strip()
            if not action_text:
                continue  # 沒有 action 的略過

            item_text = (r.get("item") or r.get("context") or "").strip() or None
            owner_id = r.get("owner_id")
            if owner_id is None:
                owner_id = _resolve_owner_id(r.get("owner"))
            due = _parse_date(r.get("due_date") or r.get("duedate"))

            ai = ActionItem(
                meeting_id=meeting_id,
                item=item_text,
                action=action_text,
                owner_id=owner_id,
                due_date=due,
                status="pending",
            )
            db.session.add(ai)
            created.append(ai)
        db.session.commit()
        return jsonify([c.to_dict() for c in created]), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"batch create failed: {e}"}), 400
