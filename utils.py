
from dotenv import load_dotenv
import os
import requests
import json
import io


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
    نسخه streaming بهینه‌شده از text_to_text با yield هر delta برای کاهش تاخیر.
    history: لیست دیکشنری‌های پیام‌های قبلی (هر کدام شامل role و content)
    """
    print("...text_to_text...")
    
    # سیستم پرامپت کوتاه و بهینه برای سرعت
    system_prompt = {
        "role": "system",
        "content": f"You are a voice model with {toneLLM} tone. Short sentences (5-8 words). End with '.' or ','."
    }
    
    # پیام کاربر جدید
    user_message = {
        "role": "user",
        "content": input_text
    }
    
    # ساخت لیست messages
    messages = [system_prompt]
    
    # اضافه کردن تاریخچه (تا ۴ پیام آخر برای context بدون overhead زیاد)
    if history:
        recent_history = [msg for msg in history[-4:] if msg.get("role") in ["user", "assistant"]]
        messages.extend(recent_history)
    
    # اضافه کردن پیام جدید کاربر
    messages.append(user_message)
    
    print(f"messages in text_to_text: {messages}")
    
    # ارسال درخواست streaming با timeout کم برای سرعت
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
            "stream": True,
            "temperature": 0  # صفر برای determinism و سرعت بیشتر
        }),
        stream=True,
        timeout=10  # timeout کم برای واکنش سریع
    )
    
    if response.status_code != 200:
        yield "متأسفانه خطایی در پردازش متن رخ داد."
        return
    
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
                        yield delta  # yield مستقیم هر delta برای تاخیر کم
                except json.JSONDecodeError:
                    continue
    
    response.close()


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



import os
import json
from datetime import datetime, timedelta
import json
import re
import re
import json



# مسیر فایل JSON برای ذخیره وضعیت کاربران
RATE_LIMIT_FILE = os.path.join(os.path.dirname(__file__), 'rate_limits.json')

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


# بارگذاری داده‌های rate limit
def load_rate_limits():
    if not os.path.exists(RATE_LIMIT_FILE):
        return {}  # اگر فایل وجود نداره، خالی برگردون
    
    try:
        with open(RATE_LIMIT_FILE, 'r', encoding='utf-8') as f:
            content = f.read().strip()
            if not content:  # اگر فایل خالی باشه
                return {}
            return json.loads(content)  # یا json.load(f) – هر دو ok
    except (json.JSONDecodeError, UnicodeDecodeError) as e:
        print(f"JSON load error in {RATE_LIMIT_FILE}: {e}. Resetting to empty dict.")
        # اختیاری: فایل رو پاک کن یا با {} overwrite کن
        with open(RATE_LIMIT_FILE, 'w', encoding='utf-8') as f:
            json.dump({}, f, ensure_ascii=False)
        return {}  # همیشه {} برگردون تا crash نشه
    except Exception as e:
        print(f"Unexpected error loading rate limits: {e}")
        return {}

# =======================
# ذخیره امن داده‌های rate limit (بهبودیافته)
# =======================
def save_rate_limits(data):
    try:
        # برای جلوگیری از race condition ساده، از temporary file استفاده کن (اختیاری اما بهتر)
        temp_file = RATE_LIMIT_FILE + '.tmp'
        with open(temp_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)  # indent=2 برای خوانایی
        
        # Atomic rename (در Unix/Mac کار می‌کنه)
        os.replace(temp_file, RATE_LIMIT_FILE)
    except Exception as e:
        print(f"Error saving rate limits: {e}")
        # fallback: مستقیم بنویس
        with open(RATE_LIMIT_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False)

# =======================
# چک rate limit (بدون تغییر عمده، اما حالا safe‌تره)
# =======================
def check_rate_limit(session_id):
    """
    چک و بروزرسانی rate limit کاربر؛ اگر مجاز باشد {'allowed': True} برمی‌گرداند، иначе {'error': message}.
    """
    rate_limits = load_rate_limits()  # حالا safe
    now = datetime.now()
    user_data = rate_limits.get(session_id, {'count': 0, 'timestamp': None})

    if user_data['count'] == 0 or (user_data['timestamp'] and (now - datetime.fromisoformat(user_data['timestamp'])) > timedelta(hours=12)):
        user_data['count'] = 1
        user_data['timestamp'] = now.isoformat()
        rate_limits[session_id] = user_data
        save_rate_limits(rate_limits)  # حالا safe
        return {'allowed': True}
    else:
        if user_data['count'] >= 5:
            remaining = timedelta(hours=12) - (now - datetime.fromisoformat(user_data['timestamp']))
            hours = remaining.seconds // 3600
            minutes = (remaining.seconds % 3600) // 60
            return {'error': f'شما در ۱۲ ساعت گذشته ۵ پیام ارسال کرده‌اید.\nلطفاً {hours} ساعت و {minutes} دقیقه دیگر صبر کنید.'}
        else:
            user_data['count'] += 1
            user_data['timestamp'] = now.isoformat()
            rate_limits[session_id] = user_data
            save_rate_limits(rate_limits)
            return {'allowed': True}
        

        


def perform_stt(audio_file, language, modelSTT):
    """
    تبدیل فایل صوتی به متن با voice_to_text؛ input_binary را می‌خواند و text یا None برمی‌گرداند.
    """
    if audio_file.filename == '':
        return None
    input_binary = audio_file.read()
    stt_result = voice_to_text(input_binary, language, modelSTT)
    return stt_result['text'] if stt_result else None


def build_llm_messages(history, user_text, toneLLM):
    """
    ساخت messages برای LLM با system prompt کوتاه و history محدود به ۴ پیام آخر (بدون duplicate user).
    """
    system_prompt = {
        "role": "system",
        "content": f"You are a voice model with {toneLLM} tone. Short sentences (5-8 words). End with '.' or ','."
    }
    messages = [system_prompt]
    if history:
        # history بدون آخرین user (برای جلوگیری از duplicate)
        recent_history = [msg for msg in history[:-1] if msg.get("role") in ["user", "assistant"]][:4]  # max 4
        messages.extend(recent_history)
    messages.append({"role": "user", "content": user_text})
    return messages


def stream_llm_generator(messages, model):
    """
    ژنراتور streaming برای LLM با استفاده از text_to_text؛ هر delta را yield می‌کند برای تاخیر کم.
    """
    # استخراج input_text از messages (آخرین user message)
    input_text = next((m['content'] for m in reversed(messages) if m['role'] == 'user'), '')
    # history بدون آخرین user
    history = [m for m in messages[1:-1]]  # skip system and last user
    return text_to_text(input_text, history, model, toneLLM="friendly")  # tone پیش‌فرض، قابل تغییر