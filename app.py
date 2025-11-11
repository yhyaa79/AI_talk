import os
from flask import Flask, render_template, request, jsonify, send_file, Response, session, send_from_directory
from utils import voice_to_text, text_to_text, text_to_auto
from dotenv import load_dotenv
from config import processing
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

history = []

load_dotenv()
API_KEY_OPENROUTER = os.getenv("API_KEY_OPENROUTER")
API_KEY_AIMLAPI = os.getenv("API_KEY_AIMLAPI")

app = Flask(__name__)
app.secret_key = 'my_secret_key'  # باید یه مقدار تصادفی و امن باشه

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)



def extract_last_complete_sentence(text, sentence_enders=r'[.!؟؛]'):
    """
    آخرین جمله کامل رو از text استخراج می‌کنه و بقیه رو برمی‌گردونه.
    مثلاً: "abc. def ghi." -> sentence: "abc. def ghi.", remaining: ""
    یا "abc. def" -> sentence: "abc.", remaining: " def"
    """
    # پیدا کردن موقعیت آخرین علامت پایان جمله (با lookahead برای فضای بعدش)
    match = re.search(f'({sentence_enders})(?=\s|$)', text)
    if not match:
        return text, ""  # اگر علامتی نبود، کل رو جمله در نظر بگیر
    
    last_end_pos = match.end()
    sentence = text[:last_end_pos].strip()
    remaining = text[last_end_pos:].strip()  # بقیه بعد از علامت + فضا
    return sentence, remaining


# روت اصلی: سرو کردن HTML
@app.route('/')
def index():
    user_id = session.get('user_id')
    if not user_id:
        user_id = str(uuid.uuid4())
        session['user_id'] = user_id
        
    return send_from_directory('static/html', 'index.html')


@app.route('/reset_history', methods=['POST'])
def reset_history():
    print('??????????????????????????????????')
    global history
    history = []
    return jsonify({'status': 'history reset', 'message': 'تاریخچه مکالمه پاک شد'})

# فرض: text_to_text_stream و voice_to_text و text_to_auto مثل قبل تعریف شدن

@app.route('/process_audio_stream', methods=['POST'])
def process_audio_stream():
    if 'audio' not in request.files:
        return jsonify({'error': 'هیچ فایلی ارسال نشده'}), 400
    
    audio_file = request.files['audio']
    
    # فیکس: دیفالت برای model و language
    modelSTT = request.form.get('modelSTT', 'large')  # دیفالت 'large' برای "#g1_whisper-large"
    language = request.form.get('language', "default")     # بدون str() – اگر None باشه، None می‌مونه
    modelLLM = request.form.get('modelLLM', 'openai/gpt-3.5-turbo')
    toneLLM = request.form.get('toneLLM', 'friendly')
    modelTTS = request.form.get('modelTTS', 'elevenlabs/v3_alpha')
    nameVoiceTTS = request.form.get('nameVoiceTTS', 'Alice')
    
    if language == "default":
        language = None

    model_selekt = f"#g1_whisper-{modelSTT}"  # حالا اگر model='large'، درست می‌شه

    if audio_file.filename == '':
        return jsonify({'error': 'فایل خالی است'}), 400
    
    input_binary = audio_file.read()

    def generate():
        # گام 1: STT
        stt_result = voice_to_text(input_binary, language, model_selekt)
        
        if not stt_result:
            yield f"data: {json.dumps({'error': 'خطا در تبدیل صدا به متن'})}\n\n"
            return
        
        user_text = stt_result['text']
        print(f'**Text extracted from voice:  {user_text}')
        
        current_chunk = ""
        chunk_count = 0
        start_time = time.time()
        sentence_enders = r'[.؛]'  # الگوی پایان جمله (بدون \n برای split دقیق‌تر)
        
        yield f"data: {json.dumps({'type': 'start'})}\n\n"




        llm_stream = text_to_text(user_text, history, modelLLM, toneLLM)
        
        # پیام کاربر را اول اضافه کن
        history.append({"role": "user", "content": user_text})
        print(f"history::: {history}")

        all_text = []

        for llm_chunk in llm_stream:
            if not llm_chunk:
                continue
            
            current_chunk += llm_chunk
            
            # شرط کات: >=4 کلمه و وجود علامت پایان جمله
            words_count = len(re.findall(r'\S+', current_chunk))
            has_sentence_end = bool(re.search(sentence_enders, current_chunk))
            
            if words_count >= 4 and has_sentence_end:
                # Extract آخرین جمله کامل و remaining
                complete_sentence, remaining = extract_last_complete_sentence(current_chunk, sentence_enders)
                print(f'**Sentenced text:  {complete_sentence}')
                

                if complete_sentence.strip() and not complete_sentence == '.':  # اگر جمله خالی نبود
                    try:
                        if current_chunk.strip():
                            all_text.append(current_chunk.strip())  # به لیست اضافه کن
                        
                        audio_binary = text_to_auto(complete_sentence, modelTTS, nameVoiceTTS)
                        
                        if not audio_binary or len(audio_binary) == 0:
                            yield f"data: {json.dumps({'type': 'error_chunk', 'index': chunk_count, 'message': 'خطا در TTS'})}\n\n"
                            current_chunk = remaining  # remaining رو نگه دار
                            continue
                        
                        audio_b64 = base64.b64encode(audio_binary).decode('utf-8')
                        
                        chunk_data = {
                            'type': 'audio_chunk',
                            'index': chunk_count,
                            'chunk_text': complete_sentence,
                            'audio_b64': audio_b64
                        }
                        yield f"data: {json.dumps(chunk_data)}\n\n"
                        
                        chunk_count += 1
                        current_chunk = remaining  # بقیه رو برای chunk بعدی نگه دار
                        
                    except Exception as e:
                        logger.error(f"Exception در TTS chunk {chunk_count+1}: {str(e)}", exc_info=True)
                        yield f"data: {json.dumps({'type': 'error_chunk', 'index': chunk_count, 'message': str(e)})}\n\n"
                        current_chunk = remaining
                        continue
                
                time.sleep(0.1)
            
            # Timeout
            if time.time() - start_time > 30:
                break

        full_response = ''.join(all_text)
        history.append({"role": "assistant", "content": full_response})
        print(f"history::: {history}")
        print(f"/////all_text::: {all_text}")

        # Chunk نهایی: هر چیزی که باقی مونده (بدون شرط)
        if current_chunk.strip():
            try:
                audio_binary = text_to_auto(current_chunk.strip())
                history.append({"role": "assistant", "content": current_chunk.strip()})
                print(f"history::: {history}")

                if audio_binary and len(audio_binary) > 0:
                    audio_b64 = base64.b64encode(audio_binary).decode('utf-8')
                    chunk_data = {
                        'type': 'audio_chunk',
                        'index': chunk_count,
                        'chunk_text': current_chunk.strip(),
                        'audio_b64': audio_b64
                    }
                    yield f"data: {json.dumps(chunk_data)}\n\n"
                    chunk_count += 1
                else:
                    logger.warning("audio_binary خالی در chunk نهایی")
            except Exception as e:
                logger.error(f"Exception TTS نهایی: {str(e)}", exc_info=True)
        
        yield f"data: {json.dumps({'type': 'end', 'total_chunks': chunk_count})}\n\n"
    
    return Response(generate(), mimetype='text/event-stream', headers={
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
    })

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=8090)  