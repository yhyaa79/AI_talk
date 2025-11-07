import os
from flask import Flask, render_template, request, jsonify, send_file
from dotenv import load_dotenv
from config import processing
import time
import requests
import json
import io

load_dotenv()
API_KEY_OPENROUTER = os.getenv("API_KEY_OPENROUTER")
API_KEY_AIMLAPI = os.getenv("API_KEY_AIMLAPI")

app = Flask(__name__)


# روت اصلی: سرو کردن HTML
@app.route('/')
def index():
    return render_template('index.html')

# اندپوینت پردازش صدا (POST /process_audio)
# اندپوینت به‌روز شده: /process_audio (سازگار با Flask 1.x و بالاتر)
@app.route('/process_audio', methods=['POST'])
def process_audio():
    if 'audio' not in request.files:
        return jsonify({'error': 'هیچ فایلی ارسال نشده'}), 400
    
    audio_file = request.files['audio']
    if audio_file.filename == '':
        return jsonify({'error': 'فایل خالی است'}), 400
    
    input_binary = audio_file.read()  # درست
    audio_io = processing(input_binary)  # درست

    return send_file(
        audio_io,  # بدون اسم!
        mimetype='audio/wav',
        as_attachment=True,
        download_name='ai_response.wav'
    )

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5001)  # پورت 5001 به جای 5000