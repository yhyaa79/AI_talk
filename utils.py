
from dotenv import load_dotenv
import os
import time
import requests
import json
import io
import logging
import re

load_dotenv()
API_KEY_OPENROUTER = os.getenv("API_KEY_OPENROUTER")
API_KEY_AIMLAPI = os.getenv("API_KEY_AIMLAPI")
API_KEY_OPENAI = os.getenv("API_KEY_OPENAI")



# =======================
# تابع STT بهینه‌شده
# =======================

def voice_to_text(input_binary, language=None, model_selekt="whisper-1", filename="audio.mp3"):
    API_URL = "https://api.openai.com/v1/audio/transcriptions"
    
    headers = {
        "Authorization": f"Bearer {API_KEY_OPENAI}"
    }
    
    files = {"file": (filename, input_binary, "audio/mpeg")}
    data = {
        "model": model_selekt,
        "response_format": "json",
        "temperature": 0,  # اضافه کردن temperature=0 برای سرعت بیشتر
    }
    
    if language:
        data["language"] = language
    
    try:
        # کاهش timeout برای سرعت بیشتر
        r = requests.post(API_URL, headers=headers, files=files, data=data, timeout=30)
        
        if r.status_code not in (200, 201):
            return None
        
        response = r.json()
        text = response.get("text", "")
        
        if not text:
            return None
        
        return {"text": text}
    
    except Exception as e:
        print(f'error: {e}')
        return None
    
# =======================
# تابع LLM بهینه‌شده با Groq (سریع‌ترین)
# =======================
def text_to_text(input_text, history=None, model="openai/gpt-4o-mini", toneLLM="friendly"):
    """
    نسخه streaming از text_to_text با پشتیبانی از تاریخچه مکالمه.
    history: لیست دیکشنری‌های پیام‌های قبلی (هر کدام شامل role و content)
    """
    print("...text_to_text...")
    
    # سیستم پرامپت پیش‌فرض
    system_prompt = {
        "role": "system",
        "content": f"You are a voice model with a {toneLLM}, colloquial tone. Keep sentences SHORT (5-8 words). End each with '.' or ','."
    }
    
    # پیام کاربر جدید
    user_message = {
        "role": "user",
        "content": input_text
    }
    
    # ساخت لیست messages
    messages = [system_prompt]
    
    # اضافه کردن تاریخچه (اگر وجود داشت)
    if history:
        # مطمئن شو که تاریخچه فقط شامل پیام‌های user و assistant باشه (نه system)
        for msg in history:
            if msg.get("role") in ["user", "assistant"]:
                messages.append(msg)
    
    # اضافه کردن پیام جدید کاربر
    messages.append(user_message)
    
    print(f"messages in text_to_text: {messages}")
    # ارسال درخواست streaming
    response = requests.post(
        url="https://openrouter.ai/api/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {API_KEY_OPENROUTER}",
            "Content-Type": "application/json",
            "HTTP-Referer": "<YOUR_SITE_URL>",
            "X-Title": "<YOUR_SITE_NAME>",
        },
        data=json.dumps({
            "model": model,
            "messages": messages,
            "stream": True
        }),
        stream=True
    )
    
    if response.status_code != 200:
        yield "متأسفانه خطایی در پردازش متن رخ داد."
        return
    
    current_chunk = ""
    for line in response.iter_lines():
        if line:
            line = line.decode('utf-8')
            if line.startswith('data: '):
                data = line[6:]
                if data == '[DONE]':
                    break
                try:
                    json_data = json.loads(data)
                    delta = json_data.get('choices', [{}])[0].get('delta', {}).get('content', '')
                    if delta:
                        current_chunk += delta
                        if len(current_chunk) >= 10:
                            yield current_chunk
                            current_chunk = ""
                except json.JSONDecodeError:
                    continue
    
    if current_chunk:
        yield current_chunk


# =======================
# تابع TTS بهینه‌شده
# =======================


def text_to_audio(input_text, model="tts-1", voice="alloy", speed=1.0):
    print(f"...text_to_audio: {input_text[:30]}...")
    
    valid_voices = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"]
    if not voice or voice not in valid_voices:
        voice = "alloy"
    
    url = "https://api.openai.com/v1/audio/speech"
    headers = {"Authorization": f"Bearer {API_KEY_OPENAI}"}
    payload = {
        "model": model,
        "input": input_text,
        "voice": voice,
        "response_format": "mp3",
        "speed": speed  # اضافه کردن speed control
    }
    
    try:
        # کاهش timeout برای واکنش سریع‌تر
        response = requests.post(url, headers=headers, json=payload, stream=True, timeout=15)
        
        if response.status_code not in (200, 201):
            return b""
        
        audio_bytes = io.BytesIO()
        for chunk in response.iter_content(chunk_size=8192):
            if chunk:
                audio_bytes.write(chunk)
        
        audio_bytes.seek(0)
        return audio_bytes.getvalue()
    
    except Exception as e:
        print(f'error: {e}')
        return b""

# =======================
# تابع کمکی: استخراج جمله کامل
# =======================
def extract_complete_sentence(text, pattern=r'[.؛!؟\n,،]'):
    """
    جمله کامل آخر را استخراج می‌کند
    """
    matches = list(re.finditer(pattern, text))
    if not matches:
        return "", text
    
    last_match = matches[-1]
    complete = text[:last_match.end()].strip()
    remaining = text[last_match.end():].strip()
    
    return complete, remaining
