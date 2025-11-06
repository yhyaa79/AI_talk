
import os

from dotenv import load_dotenv

import time
import requests
import json


load_dotenv()                    # ← .env رو می‌خونه
API_KEY_OPENROUTER = os.getenv("API_KEY_OPENROUTER")
API_KEY_AIMLAPI = os.getenv("API_KEY_AIMLAPI")







######## fert step #########


import requests
import time
import os

BASE_URL = "https://api.aimlapi.com/v1"

def auto_to_text(input_auto, model="#g1_whisper-medium", language='en', sleep_time=2):
    s = requests.Session()
    s.headers = {"Authorization": f"Bearer {API_KEY_AIMLAPI}"}

    with open(input_auto, "rb") as f:
        file_name = os.path.basename(input_auto)
        # فرض کنیم فایل MP3 هست
        files = {"audio": (file_name, f, "audio/mpeg")}
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


def text_to_auto(input_text, model="elevenlabs/v3_alpha", name_voice="Alice", name_audio_file="audio.wav"):
    url = "https://api.aimlapi.com/v1/tts"
    headers = {
        "Authorization": f"Bearer {API_KEY_AIMLAPI}",  # بدون < و >
    }
    payload = {
        "model": model,
        "text": input_text,
        "voice": name_voice
    }

    response = requests.post(url, headers=headers, json=payload, stream=True)
    dist = os.path.abspath(name_audio_file)

    with open(dist, "wb") as write_stream:
        for chunk in response.iter_content(chunk_size=8192):
            if chunk:
                write_stream.write(chunk)

    print("Audio saved to:", dist)




def main():
    print("\nfert step")
    input_auto = "/Users/yayhaeslami/Python/my_workspace/resume/my_project/AI_talk/en_audio.wav"
    result_auto_to_text = auto_to_text(input_auto, model="#g1_whisper-tiny", language='en', sleep_time=2)
    print(f'result_auto_to_text{result_auto_to_text}\n')

    print("\nsecond step")
    input_text = result_auto_to_text['text']
    result_text_to_text = text_to_text(input_text, model="openai/gpt-3.5-turbo")
    print(f'result_text_to_text{result_text_to_text}\n')

    print("\nthird step\n")
    input_text = result_text_to_text
    audio_file = "/Users/yayhaeslami/Python/my_workspace/resume/my_project/AI_talk/audio.wav"
    text_to_auto(input_text, model="elevenlabs/v3_alpha", name_voice="Alice", name_audio_file=audio_file)


main()