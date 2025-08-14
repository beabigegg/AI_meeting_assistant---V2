import os
import uuid
import requests
import json
import re
from flask import request, jsonify, send_from_directory
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity, get_jwt
from werkzeug.utils import secure_filename
from models import User, Meeting, ActionItem
from app import app, db
from tasks import (
    celery,
    extract_audio_task,
    transcribe_audio_task,
    translate_segments_task,
    summarize_text_task,
    preview_action_items_task
)
from datetime import datetime, date

# --- Helper Function for File Uploads ---
def save_uploaded_file(file_key='file'):
    if file_key not in request.files:
        return None, (jsonify({'error': '請求中沒有檔案部分'}), 400)
    file = request.files[file_key]
    if file.filename == '':
        return None, (jsonify({'error': '未選擇檔案'}), 400)
    if file:
        original_filename = secure_filename(file.filename)
        file_extension = os.path.splitext(original_filename)[1]
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
        file.save(file_path)
        return file_path, None
    return None, (jsonify({'error': '未知的檔案錯誤'}), 500)

# --- User Authentication Routes ---
@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({"msg": "Missing username or password"}), 400
    user = User.query.filter_by(username=data.get('username')).first()
    if user and user.check_password(data.get('password')):
        access_token = create_access_token(identity=str(user.id), additional_claims={'role': user.role})
        return jsonify(access_token=access_token)
    return jsonify({"msg": "Bad username or password"}), 401

# --- Admin User Management Routes ---
@app.route('/api/admin/users', methods=['GET'])
@jwt_required()
def get_all_users():
    if get_jwt().get('role') != 'admin':
        return jsonify({"msg": "Administration rights required"}), 403
    users = User.query.all()
    return jsonify([user.to_dict() for user in users])

# --- Meeting Management Routes ---
@app.route('/api/meetings', methods=['GET'])
@jwt_required()
def get_meetings():
    meetings = Meeting.query.order_by(Meeting.meeting_date.desc()).all()
    return jsonify([meeting.to_dict() for meeting in meetings])

@app.route('/api/meetings/<int:meeting_id>', methods=['GET'])
@jwt_required()
def get_meeting_details(meeting_id):
    meeting = Meeting.query.get_or_404(meeting_id)
    return jsonify(meeting.to_dict())

@app.route('/api/meetings', methods=['POST'])
@jwt_required()
def create_meeting():
    data = request.get_json()
    topic = data.get('topic')
    meeting_date_str = data.get('meeting_date')
    if not topic or not meeting_date_str:
        return jsonify({'error': 'Topic and meeting_date are required'}), 400
    try:
        meeting_date = datetime.fromisoformat(meeting_date_str.replace('Z', '+00:00')).date()
    except ValueError:
        return jsonify({'error': 'Invalid date format for meeting_date'}), 400
    new_meeting = Meeting(topic=topic, meeting_date=meeting_date, created_by_id=get_jwt_identity())
    db.session.add(new_meeting)
    db.session.commit()
    return jsonify(new_meeting.to_dict()), 201

# --- Action Item Management ---
@app.route('/api/meetings/<int:meeting_id>/action_items', methods=['GET'])
@jwt_required()
def get_action_items_for_meeting(meeting_id):
    Meeting.query.get_or_404(meeting_id)
    action_items = ActionItem.query.filter_by(meeting_id=meeting_id).all()
    return jsonify([item.to_dict() for item in action_items])

@app.route('/api/action_items/<int:item_id>', methods=['GET'])
@jwt_required()
def get_action_item_details(item_id):
    action_item = ActionItem.query.get_or_404(item_id)
    return jsonify(action_item.to_dict())

@app.route('/api/action_items/<int:item_id>', methods=['PUT'])
@jwt_required()
def update_action_item(item_id):
    item = ActionItem.query.get_or_404(item_id)
    data = request.get_json()
    item.item = data.get('item', item.item)
    item.action = data.get('action', item.action)
    item.status = data.get('status', item.status)
    if data.get('due_date'):
        item.due_date = datetime.fromisoformat(data['due_date']).date()
    db.session.commit()
    return jsonify(item.to_dict())

@app.route('/api/action_items/<int:item_id>', methods=['DELETE'])
@jwt_required()
def delete_action_item(item_id):
    item = ActionItem.query.get_or_404(item_id)
    db.session.delete(item)
    db.session.commit()
    return jsonify({'msg': 'Action item deleted'}), 200

# --- AI-Powered Action Item Extraction ---
@app.route('/api/preview_action_items', methods=['POST'])
@jwt_required()
def preview_action_items():
    data = request.get_json()
    text_content = data.get('text')
    if not text_content:
        return jsonify({'error': 'Text content is required'}), 400
    task = preview_action_items_task.delay(text_content)
    status_url = f'/api/status/{task.id}'
    return jsonify({'task_id': task.id, 'status_url': status_url}), 202

# --- File Processing Task Routes ---
@app.route('/api/extract_audio', methods=['POST'])
@jwt_required()
def handle_extract_audio():
    input_path, error = save_uploaded_file()
    if error: return error
    output_audio_path = os.path.splitext(input_path)[0] + ".wav"
    task = extract_audio_task.delay(input_path, output_audio_path)
    return jsonify({'task_id': task.id, 'status_url': f'/api/status/{task.id}'}), 202

@app.route('/api/transcribe_audio', methods=['POST'])
@jwt_required()
def handle_transcribe_audio():
    input_path, error = save_uploaded_file()
    if error: return error
    language = request.form.get('language', 'auto')
    use_demucs = request.form.get('use_demucs') == 'on'
    output_txt_path = os.path.splitext(input_path)[0] + ".txt"
    task = transcribe_audio_task.delay(input_path, output_txt_path, language, use_demucs)
    return jsonify({'task_id': task.id, 'status_url': f'/api/status/{task.id}'}), 202

@app.route('/api/translate_text', methods=['POST'])
@jwt_required()
def handle_translate_text():
    input_path, error = save_uploaded_file()
    if error: return error
    target_language = request.form.get('target_language', '繁體中文')
    output_txt_path = os.path.splitext(input_path)[0] + "_translated.txt"
    task = translate_segments_task.delay(input_path, output_txt_path, target_language)
    return jsonify({'task_id': task.id, 'status_url': f'/api/status/{task.id}'}), 202

@app.route('/api/summarize_text', methods=['POST'])
@jwt_required()
def handle_summarize_text():
    data = request.get_json()
    text_content = data.get('text_content')
    if not text_content:
        return jsonify({'error': '請求中缺少 text_content'}), 400
    task = summarize_text_task.delay(text_content, data.get('target_language', '繁體中文'), data.get('conversation_id'), data.get('revision_instruction'))
    return jsonify({'task_id': task.id, 'status_url': f'/api/status/{task.id}'}), 202

# --- Task Status and Download Routes ---
@app.route('/api/status/<task_id>')
@jwt_required()
def get_task_status(task_id):
    task = celery.AsyncResult(task_id)
    response_data = {'state': task.state, 'info': task.info if isinstance(task.info, dict) else str(task.info)}
    if task.state == 'SUCCESS' and isinstance(task.info, dict) and 'result_path' in task.info and task.info.get('result_path'):
        response_data['info']['download_filename'] = os.path.basename(task.info['result_path'])
    return jsonify(response_data)

@app.route('/api/download/<filename>')
@jwt_required()
def download_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename, as_attachment=True)

@app.route('/api/task/<task_id>/stop', methods=['POST'])
@jwt_required()
def stop_task(task_id):
    celery.control.revoke(task_id, terminate=True)
    return jsonify({'status': 'revoked'}), 200
