import os
from flask import Flask, render_template, request, jsonify, send_file, Response, session, send_from_directory
from dotenv import load_dotenv
from utils import voice_to_text, text_to_text, text_to_audio, extract_complete_sentence
import time
import requests
import json
import io
import re
import base64
import logging
import time
import re
import json
import base64
import io
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed

conversation_history = {}



app = Flask(__name__)
app.secret_key = 'my_secret_key'  # باید یه مقدار تصادفی و امن باشه


load_dotenv()
API_KEY_OPENROUTER = os.getenv("API_KEY_OPENROUTER")
API_KEY_AIMLAPI = os.getenv("API_KEY_AIMLAPI")
API_KEY_OPENAI = os.getenv("API_KEY_OPENAI")

import threading  # اضافه کردن import برای Event

# اضافه کردن دیکشنری برای flag های cancel
cancel_flags = {}  # session_id: threading.Event()


# روت اصلی: سرو کردن HTML
@app.route('/')
def index():
    # دریافت یا ایجاد user_id در session
    if 'user_id' not in session:
        session['user_id'] = str(uuid.uuid4())

    user_id = session['user_id']

    # فقط در صورت ارسال session_id از طریق query parameter یا JSON (POST)
    session_id = request.args.get('session_id')  # برای GET
    # یا اگر POST است: session_id = request.json.get('session_id')

    # فقط اگر session_id جدید باشد، تاریخچه را پاک کن
    if session_id and session_id not in conversation_history:
        conversation_history[session_id] = []
    # یا اگر بخواهید همیشه پاک شود (مثلاً شروع مکالمه جدید):
    # else:
    #     conversation_history[session_id] = []

    # سرو کردن فایل HTML
    return send_from_directory(os.path.join(app.static_folder, 'html'), 'index.html')




# =======================
# Route اصلی بهینه‌شده با Parallel Processing و Cancel Support
# =======================
import json
from datetime import datetime, timedelta


# مسیر فایل JSON برای ذخیره وضعیت کاربران
RATE_LIMIT_FILE = '/Users/yayhaeslami/Python/my_workspace/resume/my_project/AI_talk/rate_limits.json'

# بارگذاری داده‌های rate limit
def load_rate_limits():
    if os.path.exists(RATE_LIMIT_FILE):
        with open(RATE_LIMIT_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}

# ذخیره داده‌های rate limit
def save_rate_limits(data):
    with open(RATE_LIMIT_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

@app.route('/process_audio_stream', methods=['POST'])
def process_audio_stream():
    if 'audio' not in request.files:
        return jsonify({'error': 'هیچ فایلی ارسال نشده'}), 400
    
    audio_file = request.files['audio']
    session_id = request.form.get('session_id')
    
    if not session_id:
        return jsonify({'error': 'شناسه کاربر یافت نشد'}), 400

    # دریافت پارامترها
    modelSTT = request.form.get('modelSTT', '#g1_whisper-medium')
    language = request.form.get('language', None)
    modelLLM = request.form.get('modelLLM', 'groq')
    toneLLM = request.form.get('toneLLM', 'friendly')
    modelTTS = request.form.get('modelTTS', 'elevenlabs/v3_alpha')
    voiceTTS = request.form.get('nameVoiceTTS', 'Alice')
    
    if language == "default":
        language = None
    
    if audio_file.filename == '':
        return jsonify({'error': 'فایل خالی است'}), 400

    # --- سیستم Rate Limit ---
    rate_limits = load_rate_limits()
    now = datetime.now()
    user_data = rate_limits.get(session_id, {'count': 0, 'timestamp': None})

    # اگر اولین بار است یا بیش از ۱۲ ساعت گذشته
    if user_data['count'] == 0 or (user_data['timestamp'] and (now - datetime.fromisoformat(user_data['timestamp'])) > timedelta(hours=12)):
        user_data['count'] = 1
        user_data['timestamp'] = now.isoformat()
        rate_limits[session_id] = user_data
        save_rate_limits(rate_limits)
    else:
        # اگر کمتر از ۱۲ ساعت گذشته
        if user_data['count'] >= 5:
            remaining = timedelta(hours=12) - (now - datetime.fromisoformat(user_data['timestamp']))
            hours = remaining.seconds // 3600
            minutes = (remaining.seconds % 3600) // 60
            return jsonify({
                'error': f'شما در ۱۲ ساعت گذشته ۵ پیام ارسال کرده‌اید.\nلطفاً {hours} ساعت و {minutes} دقیقه دیگر صبر کنید.'
            }), 429  # ← کد 429 برای Rate Limit
        else:
            user_data['count'] += 1
            user_data['timestamp'] = now.isoformat()  # بروزرسانی زمان آخرین پیام
            rate_limits[session_id] = user_data
            save_rate_limits(rate_limits)
    
    input_binary = audio_file.read()
    
    # مدیریت history
    if session_id not in conversation_history:
        conversation_history[session_id] = []
    history = conversation_history[session_id]
    
    # مدیریت cancel flag
    if session_id not in cancel_flags:
        cancel_flags[session_id] = threading.Event()
    cancel_event = cancel_flags[session_id]
    
    def generate():
        try:
            # چک اولیه cancel
            if cancel_event.is_set():
                yield f"data: {json.dumps({'type': 'cancelled', 'message': 'پروسس توسط کاربر قطع شد'})}\n\n"
                return
            
            # =======================
            # گام 1: STT (بهینه‌شده)
            # =======================
            stt_start = time.time()
            stt_result = voice_to_text(input_binary, language, modelSTT)
            print(f"voice_to_text: {stt_result}")
            
            if cancel_event.is_set():
                yield f"data: {json.dumps({'type': 'cancelled', 'message': 'پروسس در مرحله STT قطع شد'})}\n\n"
                return
            
            if not stt_result:
                yield f"data: {json.dumps({'error': 'خطا در تبدیل صدا به متن'})}\n\n"
                return
            
            user_text = stt_result['text']
            
            # اضافه کردن به history
            history.append({"role": "user", "content": user_text})
            
            # =======================
            # گام 2: LLM Streaming + TTS موازی با Cancel Support
            # =======================
            yield f"data: {json.dumps({'type': 'start'})}\n\n"
            
            # انتخاب مدل LLM
            if modelLLM == 'groq':
                # برای groq، فرض بر openrouter، اما اگر groq باشه، model رو تنظیم کن
                model = "groq/llama-3.1-70b-versatile"  # مثال، بسته به config
                llm_response = requests.post(
                    url="https://openrouter.ai/api/v1/chat/completions",  # یا groq endpoint
                    headers={
                        "Authorization": f"Bearer {API_KEY_OPENROUTER}",
                        "Content-Type": "application/json",
                        "HTTP-Referer": "<YOUR_SITE_URL>",
                        "X-Title": "<YOUR_SITE_NAME>",
                    },
                    data=json.dumps({
                        "model": model,
                        "messages": [{"role": "user", "content": user_text}],  # ساده برای مثال، history رو اضافه کن
                        "stream": True
                    }),
                    stream=True
                )
            else:
                # استفاده از text_to_text اما با response explicit
                # برای سادگی، inline می‌کنیم
                system_prompt = {
                    "role": "system",
                    "content": f"You are a voice model with a {toneLLM}, colloquial tone, each sentence should be 10-15 words long and end with a '.'."
                }
                messages = [system_prompt, {"role": "user", "content": user_text}]
                if history:
                    for msg in history[-2:]:  # آخرین دو تا
                        if msg.get("role") in ["user", "assistant"]:
                            messages.append(msg)
                
                llm_response = requests.post(
                    url="https://openrouter.ai/api/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {API_KEY_OPENROUTER}",
                        "Content-Type": "application/json",
                        "HTTP-Referer": "<YOUR_SITE_URL>",
                        "X-Title": "<YOUR_SITE_NAME>",
                    },
                    data=json.dumps({
                        "model": modelLLM,
                        "messages": messages,
                        "stream": True
                    }),
                    stream=True
                )
            
            if llm_response.status_code != 200:
                yield f"data: {json.dumps({'error': 'خطا در LLM'})}\n\n"
                llm_response.close()
                return
            
            chunk_buffer = ""
            chunk_count = 0
            full_response = []
            
            # ThreadPool برای TTS های موازی
            executor = ThreadPoolExecutor(max_workers=5)
            pending_tts = {}  # {future: (index, text)}
            
            sentence_pattern = r'[.؛!؟\n]'
            
            # Generator سفارشی برای LLM با cancel
            def llm_stream_with_cancel():
                try:
                    for line in llm_response.iter_lines():
                        if cancel_event.is_set():
                            llm_response.close()
                            return
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
                                        yield delta
                                except json.JSONDecodeError:
                                    continue
                finally:
                    llm_response.close()
            
            llm_stream = llm_stream_with_cancel()
            
            for llm_chunk in llm_stream:
                if cancel_event.is_set():
                    executor.shutdown(wait=False)
                    yield f"data: {json.dumps({'type': 'cancelled', 'message': 'پروسس در مرحله LLM قطع شد'})}\n\n"
                    return
                
                if not llm_chunk:
                    continue
                
                chunk_buffer += llm_chunk
                full_response.append(llm_chunk)
                
                # ارسال فوری text به client
                yield f"data: {json.dumps({'type': 'text_chunk', 'text': llm_chunk})}\n\n"
                
                # شرط کات تهاجمی‌تر برای اولین chunk:
                words = re.findall(r'\S+', chunk_buffer)
                has_end = bool(re.search(sentence_pattern, chunk_buffer))
                
                # برای اولین chunk، شرط کمتری بگذارید:
                min_words = 1 if chunk_count == 0 else 2  # اولین chunk فقط 1 کلمه کافیست
                
                if len(words) >= min_words and has_end:
                    sentence, remaining = extract_complete_sentence(chunk_buffer, sentence_pattern)
                    
                    if sentence.strip() and sentence.strip() not in ['.', '؛', '!', '؟', ',', '،']:
                        if cancel_event.is_set():
                            executor.shutdown(wait=False)
                            yield f"data: {json.dumps({'type': 'cancelled', 'message': 'پروسس قبل از TTS قطع شد'})}\n\n"
                            return
                        
                        def tts_with_cancel(sent):
                            if cancel_event.is_set():
                                return b""
                            return text_to_audio(sent, modelTTS, voiceTTS)
                        
                        future = executor.submit(tts_with_cancel, sentence)
                        pending_tts[future] = (chunk_count, sentence)
                        chunk_count += 1
                    
                    chunk_buffer = remaining     

                # چک کردن TTS های آماده
                done_futures = [f for f in list(pending_tts) if f.done()]
                for future in done_futures:
                    idx, sent = pending_tts.pop(future)
                    try:
                        audio_binary = future.result(timeout=0.1)
                        
                        if audio_binary and len(audio_binary) > 0:
                            audio_b64 = base64.b64encode(audio_binary).decode('utf-8')
                            
                            chunk_data = {
                                'type': 'audio_chunk',
                                'index': idx,
                                'chunk_text': sent,
                                'audio_b64': audio_b64
                            }
                            yield f"data: {json.dumps(chunk_data)}\n\n"
                    except Exception as e:
                        print(f'TTS error: {e}')
                        yield f"data: {json.dumps({'type': 'error_chunk', 'index': idx, 'message': str(e)})}\n\n"
            
            # منتظر باقی‌مانده TTS ها با timeout و چک cancel
            if not cancel_event.is_set():
                for future in as_completed(pending_tts.keys(), timeout=10):
                    if cancel_event.is_set():
                        executor.shutdown(wait=False)
                        break
                    idx, sent = pending_tts[future]
                    try:
                        audio_binary = future.result(timeout=1)
                        if audio_binary and len(audio_binary) > 0:
                            audio_b64 = base64.b64encode(audio_binary).decode('utf-8')
                            yield f"data: {json.dumps({
                                'type': 'audio_chunk',
                                'index': idx,
                                'chunk_text': sent,
                                'audio_b64': audio_b64
                            })}\n\n"
                    except Exception as e:
                        print(f'TTS error: {e}')
            
            # Chunk نهایی با چک
            if not cancel_event.is_set() and chunk_buffer.strip():
                try:
                    audio_binary = text_to_audio(chunk_buffer.strip(), modelTTS, voiceTTS)
                    if audio_binary and len(audio_binary) > 0:
                        audio_b64 = base64.b64encode(audio_binary).decode('utf-8')
                        yield f"data: {json.dumps({
                            'type': 'audio_chunk',
                            'index': chunk_count,
                            'chunk_text': chunk_buffer.strip(),
                            'audio_b64': audio_b64
                        })}\n\n"
                        chunk_count += 1
                except Exception as e:
                    print(f'error: {e}')
            
            # اضافه کردن پاسخ کامل به history (فقط اگر cancel نشده)
            if not cancel_event.is_set():
                full_text = ''.join(full_response)
                history.append({"role": "assistant", "content": full_text})
                
                # محدود کردن history به 10 پیام آخر
                if len(history) > 10:
                    history[:] = history[-10:]
            
            executor.shutdown(wait=False)
            
            yield f"data: {json.dumps({'type': 'end', 'total_chunks': chunk_count})}\n\n"
        
        except Exception as e:
            print(f'error: {e}')
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        finally:
            # پاک کردن flag بعد از پایان
            if session_id in cancel_flags:
                del cancel_flags[session_id]
    
    return Response(generate(), mimetype='text/event-stream', headers={
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'X-Accel-Buffering': 'no'
    })


# =======================
# Route پاک کردن history با cancel هم
# =======================
@app.route('/clear_history', methods=['POST'])
def clear_history():
    session_id = request.json.get('session_id', 'default')
    if session_id in conversation_history:
        conversation_history[session_id] = []
    # set cancel اگر active باشه
    if session_id in cancel_flags:
        cancel_flags[session_id].set()
    return jsonify({'status': 'success'})


# =======================
# Endpoint جدید برای قطع پروسس
# =======================
@app.route('/cancel_session', methods=['POST'])
def cancel_session():
    data = request.json
    session_id = data.get('session_id', 'default')
    
    if session_id in cancel_flags:
        cancel_flags[session_id].set()
        # اختیاری: پاک کردن flag بعد از مدتی یا در end
        # اما برای حالا، در generate پاک می‌کنیم
    
    # دستور قطع به API: چون response ها در generate track می‌شن، flag کافیه
    # اگر نیاز به close explicit باشه، می‌تونیم active_responses dict اضافه کنیم
    return jsonify({'status': 'cancelled', 'session_id': session_id})


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=8090)  