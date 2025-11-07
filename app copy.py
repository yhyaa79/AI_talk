import os
from flask import Flask, render_template, request, jsonify, send_file, Response
from utils import auto_to_text, text_to_text, text_to_auto
from dotenv import load_dotenv
from config import processing
import time
import requests
import json
import io
import re
import base64

load_dotenv()
API_KEY_OPENROUTER = os.getenv("API_KEY_OPENROUTER")
API_KEY_AIMLAPI = os.getenv("API_KEY_AIMLAPI")

app = Flask(__name__)


# روت اصلی: سرو کردن HTML
@app.route('/')
def index():
    return render_template('index2.html')

# اندپوینت به‌روز شده: /process_audio (سازگار با Flask 1.x و بالاتر)
@app.route('/process_audio', methods=['POST'])
def process_audio():
    if 'audio' not in request.files:
        return jsonify({'error': 'هیچ فایلی ارسال نشده'}), 400
    
    audio_file = request.files['audio']
    if audio_file.filename == '':
        return jsonify({'error': 'فایل خالی است'}), 400
    
    input_binary = audio_file.read()
    result = processing(input_binary)
    
    if 'error' in result:
        return jsonify(result), 500
    
    return jsonify(result)



@app.route('/process_audio_stream', methods=['POST'])
def process_audio_stream():
    if 'audio' not in request.files:
        return jsonify({'error': 'هیچ فایلی ارسال نشده'}), 400
    
    audio_file = request.files['audio']
    if audio_file.filename == '':
        return jsonify({'error': 'فایل خالی است'}), 400
    
    input_binary = audio_file.read()
    
    def generate():
        # گام 1: STT (همزمان انجام می‌شود، چون blocking است اما کوتاه)
        stt_result = auto_to_text(input_binary)
        if not stt_result:
            yield f"data: {json.dumps({'error': 'خطا در تبدیل صدا به متن'})}\n\n"
            return
        
        user_text = stt_result['text']
        print(f"متن کاربر: {user_text}")
        
        current_chunk = ""
        chunk_count = 0
        start_time = time.time()  # برای timeout
        
        yield f"data: {json.dumps({'type': 'start'})}\n\n"
        
        for llm_chunk in text_to_text(user_text):
            if not llm_chunk:
                continue
            
            current_chunk += llm_chunk
            print(f"Chunk فعلی LLM: {current_chunk}")  # دیباگ موجود
            
            words_count = len(re.findall(r'\S+', current_chunk))
            print(f"تعداد کلمات: {words_count}")  # دیباگ جدید
            
            # شرط اصلاح‌شده: >=5 کلمه و برخورد به یکی از علایم
            if words_count >= 5 and re.search(r'[،,:;!؟]', current_chunk):
                print(f"TTS شروع برای chunk {chunk_count+1}: '{current_chunk}'")  # دیباگ TTS
                try:
                    audio_binary = text_to_auto(current_chunk)
                    print(f"TTS تمام شد برای chunk {chunk_count+1}, طول audio: {len(audio_binary) if audio_binary else 0}")  # دیباگ
                    
                    if not audio_binary or len(audio_binary) == 0:
                        print(f"خطا در تولید صدا برای chunk {chunk_count+1}")
                        yield f"data: {json.dumps({'type': 'error_chunk', 'index': chunk_count, 'message': 'خطا در TTS'})}\n\n"
                        current_chunk = ""
                        continue
                    
                    audio_b64 = base64.b64encode(audio_binary).decode('utf-8')
                    
                    chunk_data = {
                        'type': 'audio_chunk',
                        'index': chunk_count,
                        'chunk_text': current_chunk,
                        'audio_b64': audio_b64
                    }
                    yield f"data: {json.dumps(chunk_data)}\n\n"
                    
                    chunk_count += 1
                    current_chunk = ""
                    
                except Exception as e:
                    print(f"Exception در TTS chunk {chunk_count+1}: {str(e)}")  # دیباگ exception
                    yield f"data: {json.dumps({'type': 'error_chunk', 'index': chunk_count, 'message': str(e)})}\n\n"
                    current_chunk = ""
                    continue
                
                time.sleep(0.1)
            
            # timeout ساده: اگر >20s هیچی نشد، end کن
            if time.time() - start_time > 20:
                print("Timeout در LLM loop!")
                break
        
        # chunk نهایی (حتی اگر <5 کلمه باشه یا علامت نداشته باشه)
        if current_chunk.strip():
            print(f"TTS نهایی برای: '{current_chunk}'")
            try:
                audio_binary = text_to_auto(current_chunk)
                if audio_binary and len(audio_binary) > 0:
                    audio_b64 = base64.b64encode(audio_binary).decode('utf-8')
                    chunk_data = {
                        'type': 'audio_chunk',
                        'index': chunk_count,
                        'chunk_text': current_chunk,
                        'audio_b64': audio_b64
                    }
                    yield f"data: {json.dumps(chunk_data)}\n\n"
                    chunk_count += 1
            except Exception as e:
                print(f"Exception TTS نهایی: {str(e)}")
        
        print(f"پایان generate, total chunks: {chunk_count}")  # دیباگ پایان
        yield f"data: {json.dumps({'type': 'end', 'total_chunks': chunk_count})}\n\n"
    
    # بازگشت Response برای SSE
    return Response(generate(), mimetype='text/event-stream', headers={
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
    })


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=8070)  # پورت 5001 به جای 5000