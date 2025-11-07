
from dotenv import load_dotenv
import os
import time
import requests
import json
import io

load_dotenv()                    # ← .env رو می‌خونه
API_KEY_OPENROUTER = os.getenv("API_KEY_OPENROUTER")
API_KEY_AIMLAPI = os.getenv("API_KEY_AIMLAPI")



######## fert step #########



# تابع STT (از کد تو)
def auto_to_text(input_binary, filename="audio.mp3", model="#g1_whisper-medium", language='en', sleep_time=2):
    s = requests.Session()
    s.headers = {"Authorization": f"Bearer {API_KEY_AIMLAPI}"}
    
    files = {"audio": (filename, input_binary, "audio/mpeg")}
    data = {"model": model, "language": language}
    
    r = s.post("https://api.aimlapi.com/v1/stt/create", data=data, files=files, timeout=60)
    if r.status_code not in (200, 201):
        return None
    
    response_create = r.json()
    gen_id = response_create.get("generation_id")
    if not gen_id:
        return None
    
    poll_url = f"https://api.aimlapi.com/v1/stt/{gen_id}"
    start_time = time.time()
    timeout = 300
    
    while time.time() - start_time < timeout:
        poll_resp = s.get(poll_url, timeout=30)
        if poll_resp.status_code != 200:
            time.sleep(int(sleep_time))
            continue
        
        info = poll_resp.json()
        status = info.get("status")
        
        if status in ("waiting", "active"):
            time.sleep(int(sleep_time))
            continue
        
        if status == "completed":
            try:
                result = info["result"]["results"]["channels"][0]["alternatives"][0]
                text = result["transcript"]
                lang = result.get("language", "نامشخص")
                return {"text": text, "language": lang}
            except (KeyError, IndexError, TypeError):
                return None
        
        if status == "failed":
            print(f"Failed: {info}")
            return None
        
        time.sleep(int(sleep_time))
    
    return None



# تابع LLM (از کد تو)
def text_to_text(input_text, model="openai/gpt-3.5-turbo"):
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
            "messages": [{"role": "user", "content": input_text}]
        })
    )
    
    if response.status_code == 200:
        result = response.json()
        return result.get('choices', [{}])[0].get('message', {}).get('content', 'نامشخص')
    else:
        print(f"خطا در LLM: {response.status_code} - {response.text}")
        return "متأسفانه خطایی در پردازش متن رخ داد."



# تابع TTS (از کد تو)
def text_to_auto(input_text, model="elevenlabs/v3_alpha", name_voice="Alice"):
    url = "https://api.aimlapi.com/v1/tts"
    headers = {
        "Authorization": f"Bearer {API_KEY_AIMLAPI}",
    }
    print('.,.,,,,,,,,,,,')
    print(input_text)

    payload = {
        "model": model,
        "text": input_text,
        "voice": name_voice
    }
    response = requests.post(url, headers=headers, json=payload, stream=True)
    audio_bytes = io.BytesIO()
    for chunk in response.iter_content(chunk_size=8192):
        if chunk:
            audio_bytes.write(chunk)
    audio_bytes.seek(0)
    return audio_bytes.getvalue()








""" def auto_to_text(input_binary, filename="audio.mp3", model="#g1_whisper-medium", language='en', sleep_time=2):
    s = requests.Session()
    s.headers = {"Authorization": f"Bearer {API_KEY_AIMLAPI}"}
    
    # فرض کنیم داده باینری MP3 هست
    files = {"audio": (filename, input_binary, "audio/mpeg")}
    data = {"model": model, "language": language}  # اصلاح: زبان فارسی اضافه شد
    
    r = s.post(f"{BASE_URL}/stt/create", data=data, files=files, timeout=60)
    if r.status_code not in (200, 201):
        return None
    
    response_create = r.json()
    gen_id = response_create.get("generation_id")
    if not gen_id:
        return None
    
    poll_url = f"{BASE_URL}/stt/{gen_id}"
    start_time = time.time()
    timeout = 300  # 5 دقیقه
    
    while time.time() - start_time < timeout:
        poll_resp = s.get(poll_url, timeout=30)
        if poll_resp.status_code != 200:
            time.sleep(int(sleep_time))
            continue
        
        info = poll_resp.json()
        status = info.get("status")
        
        if status in ("waiting", "active"):
            time.sleep(int(sleep_time))
            continue
        
        if status == "completed":
            try:
                result = info["result"]["results"]["channels"][0]["alternatives"][0]
                text = result["transcript"]
                lang = result.get("language", "نامشخص")
                return {"text": text, "language": lang}
            except (KeyError, IndexError, TypeError):
                return None
        
        if status == "failed":
            print(f"Failed: {info}")  # دیباگ
            return None
        
        time.sleep(int(sleep_time))
    
    return None



######## second step #########


def text_to_text(input_text, model="openai/gpt-3.5-turbo"):
    response = requests.post(
        url="https://openrouter.ai/api/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {API_KEY_OPENROUTER}",
            "Content-Type": "application/json",
            "HTTP-Referer": "<YOUR_SITE_URL>",  # Optional. Site URL for rankings on openrouter.ai.
            "X-Title": "<YOUR_SITE_NAME>",      # Optional. Site title for rankings on openrouter.ai.
        },
        data=json.dumps({
            "model": model,
            "messages": [
                {
                    "role": "user",
                    "content": input_text
                }
            ]
        })
    )
    
    # پردازش و نمایش خروجی
    if response.status_code == 200:
        result = response.json()
        return result.get('choices', [{}])[0].get('message', {}).get('content', 'نامشخص')
    else:
        error_msg = f"خطا در درخواست: {response.status_code} - {response.text}"

        return None








######## third step #########


import requests
import os

def text_to_auto(input_text, model="elevenlabs/v3_alpha", name_voice="Alice", filename="audio.wav"):
    url = "https://api.aimlapi.com/v1/tts"
    headers = {
        "Authorization": f"Bearer {API_KEY_AIMLAPI}",  # بدون < و >
        "Content-Type": "application/json"
    }
    payload = {
        "model": model,
        "text": input_text,
        "voice": name_voice
    }
    
    response = requests.post(url, headers=headers, json=payload, stream=True)
    if response.status_code != 200:
        raise ValueError(f"API request failed with status {response.status_code}")
    
    # جمع‌آوری تمام chunkها به صورت binary
    audio_binary = b""
    for chunk in response.iter_content(chunk_size=8192):
        if chunk:
            audio_binary += chunk
    
    # mime type بر اساس filename (برای Flask مفید)
    mime_type = "audio/wav" if filename.endswith('.wav') else "audio/mpeg"  # فرض بر wav برای Eleven Labs
    
    return {
        "binary": audio_binary,
        "filename": filename,
        "mime_type": mime_type
    }



def main():
    print("\nfert step")
    result_auto_to_text = auto_to_text(input_auto, model="#g1_whisper-tiny", language='en', sleep_time=2)
    print(f'result_auto_to_text{result_auto_to_text}\n')

    print("\nsecond step")
    input_text = result_auto_to_text['text']
    result_text_to_text = text_to_text(input_text, model="openai/gpt-3.5-turbo")
    print(f'result_text_to_text{result_text_to_text}\n')

    print("\nthird step\n")
    input_text = result_text_to_text
    audio_file = 
    text_to_auto(input_text, model="elevenlabs/v3_alpha", name_voice="Alice", name_audio_file=audio_file)


main() 

 """