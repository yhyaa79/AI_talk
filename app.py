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
import logging
import time
import re
import json
import base64
import io


load_dotenv()
API_KEY_OPENROUTER = os.getenv("API_KEY_OPENROUTER")
API_KEY_AIMLAPI = os.getenv("API_KEY_AIMLAPI")

app = Flask(__name__)

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# روت اصلی: سرو کردن HTML
@app.route('/')
def index():
    return render_template('index.html')

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
    logger.debug(f"Split: sentence='{sentence}' | remaining='{remaining}'")
    return sentence, remaining

# فرض: text_to_text_stream و auto_to_text و text_to_auto مثل قبل تعریف شدن

@app.route('/process_audio_stream', methods=['POST'])
def process_audio_stream():
    logger.info("شروع process_audio_stream")
    if 'audio' not in request.files:
        logger.error("هیچ فایلی ارسال نشده")
        return jsonify({'error': 'هیچ فایلی ارسال نشده'}), 400
    
    audio_file = request.files['audio']
    if audio_file.filename == '':
        logger.error("فایل خالی است")
        return jsonify({'error': 'فایل خالی است'}), 400
    
    input_binary = audio_file.read()
    logger.debug(f"طول binary audio: {len(input_binary)} bytes")
    
    def generate():
        logger.info("شروع generate")
        # گام 1: STT
        start_stt = time.time()
        stt_result = auto_to_text(input_binary)
        logger.info(f"STT تمام شد در {time.time() - start_stt:.2f} ثانیه")
        
        if not stt_result:
            logger.error("خطا در STT")
            yield f"data: {json.dumps({'error': 'خطا در تبدیل صدا به متن'})}\n\n"
            return
        
        user_text = stt_result['text']
        logger.info(f"متن کاربر از STT: {user_text}")
        
        current_chunk = ""
        chunk_count = 0
        start_time = time.time()
        sentence_enders = r'[.!؟؛]'  # الگوی پایان جمله (بدون \n برای split دقیق‌تر)
        
        yield f"data: {json.dumps({'type': 'start'})}\n\n"
        logger.debug("ارسال 'start' event")
        
        # Streaming LLM
        llm_stream = text_to_text(user_text)
        for llm_chunk in llm_stream:
            if not llm_chunk:
                continue
            
            logger.debug(f"دریافت chunk LLM: '{llm_chunk}' (طول: {len(llm_chunk)})")
            current_chunk += llm_chunk
            logger.debug(f"current_chunk تجمیعی: '{current_chunk}' (طول: {len(current_chunk)})")
            
            # شرط کات: >=4 کلمه و وجود علامت پایان جمله
            words_count = len(re.findall(r'\S+', current_chunk))
            has_sentence_end = bool(re.search(sentence_enders, current_chunk))
            logger.debug(f"وضعیت chunk: کلمات={words_count}, پایان جمله={has_sentence_end}")
            
            if words_count >= 4 and has_sentence_end:
                # Extract آخرین جمله کامل و remaining
                complete_sentence, remaining = extract_last_complete_sentence(current_chunk, sentence_enders)
                
                if complete_sentence.strip():  # اگر جمله خالی نبود
                    logger.info(f"آماده TTS برای chunk {chunk_count+1}: '{complete_sentence}' (کلمات: {len(re.findall(r'\S+', complete_sentence))})")
                    try:
                        tts_start = time.time()
                        audio_binary = text_to_auto(complete_sentence)
                        tts_time = time.time() - tts_start
                        logger.info(f"TTS chunk {chunk_count+1} تمام شد در {tts_time:.2f} ثانیه, طول audio: {len(audio_binary) if audio_binary else 0}")
                        
                        if not audio_binary or len(audio_binary) == 0:
                            logger.error(f"خطا در تولید صدا برای chunk {chunk_count+1}")
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
                        logger.debug(f"ارسال audio_chunk {chunk_count}")
                        
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
                logger.warning("Timeout در LLM stream!")
                break
        
        # Chunk نهایی: هر چیزی که باقی مونده (بدون شرط)
        if current_chunk.strip():
            logger.info(f"TTS نهایی برای: '{current_chunk.strip()}'")
            try:
                audio_binary = text_to_auto(current_chunk.strip())
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
                    logger.debug(f"ارسال audio_chunk نهایی {chunk_count-1}")
                else:
                    logger.warning("audio_binary خالی در chunk نهایی")
            except Exception as e:
                logger.error(f"Exception TTS نهایی: {str(e)}", exc_info=True)
        
        logger.info(f"پایان generate, total chunks: {chunk_count}, زمان کل: {time.time() - start_time:.2f}s")
        yield f"data: {json.dumps({'type': 'end', 'total_chunks': chunk_count})}\n\n"
    
    logger.debug("بازگشت Response SSE")
    return Response(generate(), mimetype='text/event-stream', headers={
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
    })

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=8070)  # پورت 5001 به جای 5000