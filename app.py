import os
# بالای فایل، بعد از importها این خط رو اضافه کن
from flask import Flask, request, jsonify, Response, session, send_from_directory, url_for
from utils import check_rate_limit, perform_stt, build_llm_messages, stream_llm_generator
from config import generate
import uuid
import threading


conversation_history = {}
cancel_flags = {}  


app = Flask(__name__, 
            static_url_path='/AI_talk/static',     # CSS و JS از اینجا لود بشن
            static_folder='static', 
            template_folder='templates')
app.secret_key = 'my_secret_key' 


app.config['APPLICATION_ROOT'] = '/AI_talk'
app.config['PREFERRED_URL_SCHEME'] = 'https'

# =======================
# Main route: HTML setup
# =======================

@app.route('/AI_talk/')
def ai_talk_root():
    print()
    return send_from_directory('static/html', 'index.html')

@app.route('/')
def index():
    if 'user_id' not in session:
        session['user_id'] = str(uuid.uuid4())

    user_id = session['user_id']
    session_id = request.args.get('session_id') 

    if session_id and session_id not in conversation_history:
        conversation_history[session_id] = []
    else:
        conversation_history[session_id] = []

    return send_from_directory('static/html', 'index.html')




# =======================
# Main route for receiving voice, converting voice to text, processing the response, creating a send queue, converting text to voice, sending voice
# =======================

@app.route('/process_audio_stream', methods=['POST'])
def process_audio_stream():
    if 'audio' not in request.files:
        return jsonify({'error': 'هیچ فایلی ارسال نشده'}), 400
    
    audio_file = request.files['audio']
    session_id = request.form.get('session_id')
    
    if not session_id:
        return jsonify({'error': 'شناسه کاربر یافت نشد'}), 400

    modelSTT = request.form.get('modelSTT', 'whisper-1')  
    language = request.form.get('language', None)
    modelLLM = request.form.get('modelLLM', 'openai/gpt-4o-mini')  
    toneLLM = request.form.get('toneLLM', 'friendly')
    modelTTS = request.form.get('modelTTS', 'tts-1')
    voiceTTS = request.form.get('nameVoiceTTS', 'alloy')
    
    if language == "default":
        language = None

    rate_result = check_rate_limit(session_id)
    if 'error' in rate_result:
        return jsonify({'error': rate_result['error']}), 429

    user_text = perform_stt(audio_file, language, modelSTT)
    if not user_text:
        return jsonify({'error': 'خطا در تبدیل صدا به متن یا فایل خالی'}), 400

    if session_id not in conversation_history:
        conversation_history[session_id] = []
    history = conversation_history[session_id]
    history.append({"role": "user", "content": user_text})
    
    if session_id not in cancel_flags:
        cancel_flags[session_id] = threading.Event()
    cancel_event = cancel_flags[session_id]
    
    
    return Response(generate(cancel_event, history, user_text, toneLLM, modelLLM, modelTTS, voiceTTS, session_id, cancel_flags), mimetype='text/event-stream', headers={
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'X-Accel-Buffering': 'no'
    })


# =======================
# Route to clear conversations from session
# =======================
@app.route('/clear_history', methods=['POST'])
def clear_history():
    session_id = request.json.get('session_id', 'default')
    if session_id in conversation_history:
        conversation_history[session_id] = []

    if session_id in cancel_flags:
        cancel_flags[session_id].set()
    return jsonify({'status': 'success'})


# =======================
# Route for interrupting processes
# =======================
@app.route('/cancel_session', methods=['POST'])
def cancel_session():
    data = request.json
    session_id = data.get('session_id', 'default')
    
    if session_id in cancel_flags:
        cancel_flags[session_id].set()

    return jsonify({'status': 'cancelled', 'session_id': session_id})


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=8090)  