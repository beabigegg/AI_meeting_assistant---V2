import os
import sys
import whisper
import torch
import shutil
import subprocess
import time
import re
import json
import requests
from celery import Celery, Task
from opencc import OpenCC
from moviepy import VideoFileClip
from dotenv import load_dotenv

load_dotenv()

DIFY_API_BASE_URL = os.environ.get("DIFY_API_BASE_URL")
DIFY_TRANSLATOR_API_KEY = os.environ.get("DIFY_TRANSLATOR_API_KEY")
DIFY_SUMMARIZER_API_KEY = os.environ.get("DIFY_SUMMARIZER_API_KEY")
DIFY_ACTION_EXTRACTOR_API_KEY = os.environ.get("DIFY_ACTION_EXTRACTOR_API_KEY")

CELERY_BROKER_URL = os.environ.get('CELERY_BROKER_URL', 'redis://localhost:6379/0')
CELERY_RESULT_BACKEND = os.environ.get('CELERY_RESULT_BACKEND', 'redis://localhost:6379/0')
celery = Celery('tasks', broker=CELERY_BROKER_URL, backend=CELERY_RESULT_BACKEND)

class ProgressTask(Task):
    def update_progress(self, current, total, status_msg, extra_info=None):
        meta = {'current': current, 'total': total, 'status_msg': status_msg}
        if extra_info and isinstance(extra_info, dict):
            meta.update(extra_info)
        self.update_state(state='PROGRESS', meta=meta)

def ask_dify(api_key: str, prompt: str, user_id: str = "default-tk-user", inputs: dict = None, response_mode: str = "streaming", conversation_id: str = None, timeout_seconds: int = 1200) -> dict:
    if not api_key or not DIFY_API_BASE_URL:
        return {"answer": "Error: DIFY_API_KEY or DIFY_API_BASE_URL not set."}
    url = f"{DIFY_API_BASE_URL}/chat-messages"
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    payload = {"inputs": inputs or {}, "query": prompt, "user": user_id, "response_mode": response_mode}
    if conversation_id:
        payload["conversation_id"] = conversation_id
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=timeout_seconds, stream=(response_mode == 'streaming'))
        response.raise_for_status()
        if response_mode == 'streaming':
            # Handle streaming response
            return {"answer": "Streaming response handling placeholder"}
        else:
            return response.json()
    except requests.exceptions.RequestException as e:
        return {"answer": f"Dify API request error: {e}"}

@celery.task(base=ProgressTask, bind=True)
def extract_audio_task(self, input_path, output_path):
    try:
        self.update_progress(0, 100, "Starting audio extraction...")
        video = VideoFileClip(input_path)
        video.audio.write_audiofile(output_path)
        self.update_progress(100, 100, "Audio extracted successfully.")
        return {'status': 'Success', 'result_path': output_path}
    except Exception as e:
        self.update_state(state='FAILURE', meta={'error': str(e)})
        return {'status': 'Error', 'error': str(e)}

@celery.task(base=ProgressTask, bind=True)
def transcribe_audio_task(self, audio_path, output_txt_path, language, use_demucs):
    try:
        self.update_progress(0, 100, "Loading model...")
        model = whisper.load_model("base")
        self.update_progress(20, 100, "Transcribing...")
        result = model.transcribe(audio_path, language=(language if language != 'auto' else None))
        with open(output_txt_path, "w", encoding="utf-8") as f:
            f.write(result["text"])
        self.update_progress(100, 100, "Transcription complete.")
        return {'status': 'Success', 'result_path': output_txt_path}
    except Exception as e:
        self.update_state(state='FAILURE', meta={'error': str(e)})
        return {'status': 'Error', 'error': str(e)}

@celery.task(base=ProgressTask, bind=True)
def translate_segments_task(self, input_txt_path, output_txt_path, target_language):
    # This is a placeholder for a real implementation
    try:
        self.update_progress(0, 100, "Starting translation...")
        with open(input_txt_path, 'r', encoding='utf-8') as f_in, open(output_txt_path, 'w', encoding='utf-8') as f_out:
            content = f_in.read()
            # Placeholder translation logic
            translated_content = f"[Translated to {target_language}]\n{content}"
            f_out.write(translated_content)
        self.update_progress(100, 100, "Translation complete.")
        return {'status': 'Success', 'result_path': output_txt_path, 'content': translated_content}
    except Exception as e:
        self.update_state(state='FAILURE', meta={'error': str(e)})
        return {'status': 'Error', 'error': str(e)}

@celery.task(base=ProgressTask, bind=True)
def summarize_text_task(self, text_content, target_language, conversation_id=None, revision_instruction=None):
    try:
        self.update_progress(1, 100, "Preparing prompt...")
        prompt = f"Summarize for {target_language}: {text_content}"
        if revision_instruction:
            prompt = f"Revise based on '{revision_instruction}': {text_content}"
        self.update_progress(20, 100, "Requesting Dify API...")
        response = ask_dify(api_key=DIFY_SUMMARIZER_API_KEY, prompt=prompt, conversation_id=conversation_id, response_mode='blocking')
        summary = response.get("answer", "Summary failed")
        new_conv_id = response.get("conversation_id")
        self.update_progress(100, 100, "Summary generated.")
        return {'status': 'Success', 'summary': summary, 'conversation_id': new_conv_id}
    except Exception as e:
        self.update_state(state='FAILURE', meta={'error': str(e)})
        return {'status': 'Error', 'error': str(e)}

@celery.task(base=ProgressTask, bind=True)
def preview_action_items_task(self, text_content):
    try:
        self.update_progress(10, 100, "Requesting Dify for action items...")
        response = ask_dify(api_key=DIFY_ACTION_EXTRACTOR_API_KEY, prompt=text_content, response_mode='blocking')
        answer_text = response.get("answer", "")
        self.update_progress(80, 100, "Parsing response...")
        parsed_items = []
        try:
            parsed_items = json.loads(answer_text)
            if not isinstance(parsed_items, list):
                parsed_items = []
        except (json.JSONDecodeError, TypeError):
            parsed_items = []
        self.update_progress(100, 100, "Action item preview generated.")
        return {'status': 'Success', 'parsed_items': parsed_items}
    except Exception as e:
        self.update_state(state='FAILURE', meta={'error': str(e)})
        return {'status': 'Error', 'error': str(e)}
