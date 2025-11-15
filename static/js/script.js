let mediaRecorder;
let audioChunks = [];
let isRecording = false;
const micBtn = document.getElementById('micBtn');
const statusText = document.getElementById('statusText');
const transcriptArea = document.getElementById('transcriptArea');
const audioFileInput = document.getElementById('audioFile');
const sendFileBtn = document.getElementById('sendFileBtn');
const resetButton = document.getElementById('resetButton');
const settingsBtn = document.getElementById('settingsBtn');
const settingsPanel = document.getElementById('settingsPanel');
const settingsClose = document.getElementById('settingsClose');
const mainContent = document.getElementById('mainContent');
const replayButton = document.getElementById('replayButton');
const languageSelect = document.getElementById('languageSelect');
const modelSelectSTT = document.getElementById('modelSelectSTT');
const modelSelectLLM = document.getElementById('modelSelectLLM');
const toneSelectSTT = document.getElementById('toneSelectSTT');
const modelSelectTTS = document.getElementById('modelSelectTTS');
const nameVoiceSelectTTS = document.getElementById('nameVoiceSelectTTS');
const listeningAutoSelect = document.getElementById('listeningAutoSelect');
const statusAnimation = document.getElementById('statusAnimation'); 
const openBottom = document.getElementById('openBottom');
const closeBottom = document.getElementById('closeBottom');
const container = document.getElementById('container');
const moreBtn = document.getElementById('moreBtn');
const actionButtons = document.getElementById('actionButtons');
const stopProcess = document.getElementById('stopProcess');
const stopBtn = document.getElementById('stopBtn');


let isPlaying = false;
let currentIndex = -1;
let audioPlaylist = [];
let receivedChunks = 0;
let totalChunks = 0;
let autoPlay = true;
let transcriptItems = [];
let allAudiosFinished = false;
let generationComplete = false;
let nameVoiceObjTTS = {
    'tts-1': ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'],
    'tts-1-hd': ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'],
    'gpt-4o-mini-tts': ['Calm', 'Surfer', 'Professional']
};

// Audio visualization setup
let audioContext = null;
let analyser = null;
let source = null;
let inputVizInterval = null;
let outputVizInterval = null;

const audioSources = new Map(); // برای ذخیره source هر audio

// متغیرهای اضافی برای voice activation
// متغیرهای اضافی برای voice activation
let sensitivity = 0.1; // حساسیت صدا (از 0 تا 1، مقدار بالاتر = حساسیت کمتر)
let timeoutDuration = 2000; // مدت زمان (میلی‌ثانیه) برای غیرفعال شدن بعد از آخرین صدا
let voiceCheckInterval; // interval برای چک کردن صدا
let timeoutId; // timeout برای توقف recording
let stream; // stream میکروفون (برای voice detection)
let sourceDetection = null; // source جداگانه برای detection
let sourceRecording = null; // source جداگانه برای recording
let isBotSpeaking = false; // flag برای جلوگیری از trigger در حین پخش TTS


function initAudioViz() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 512; // Balanced for frequency analysis
    }
}

function startInputViz() {
    if (inputVizInterval) clearInterval(inputVizInterval);
    inputVizInterval = setInterval(updateInputViz, 60);
}

function updateInputViz() {
    if (!analyser) return;
    const dataArray = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(dataArray);
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
        const val = (dataArray[i] / 128.0) - 1.0;
        sum += val * val;
    }
    const rms = Math.sqrt(sum / dataArray.length);
    const vol = 0.8 + (rms * 1.8); // Tuned for subtle to prominent pulsing (0.8-2.6 scale)
    statusAnimation.style.setProperty('--vol', vol);
}

// تابع محاسبه حجم صدا (RMS) - بر اساس updateInputViz
function getVolume() {
    if (!analyser) return 0;
    const dataArray = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(dataArray);
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
        const val = (dataArray[i] / 128.0) - 1.0;
        sum += val * val;
    }
    return Math.sqrt(sum / dataArray.length);
}

// تابع شروع recording (مشترک برای کلیک و صدا)
async function startRecording() {
    if (isRecording) return;
    try {
        if (!stream) {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            initAudioViz();
            sourceDetection = audioContext.createMediaStreamSource(stream);
            sourceDetection.connect(analyser);
        }
        // sourceRecording برای viz در حین recording
        sourceRecording = audioContext.createMediaStreamSource(stream);
        sourceRecording.connect(analyser);
        startInputViz();
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
        mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunks, {
                type: 'audio/mpeg'
            });
            const formData = new FormData();
            formData.append('audio', audioBlob, 'user_audio.mp3');
            formData.append('language', document.getElementById('languageSelect').value);
            formData.append('modelSTT', document.getElementById('modelSelectSTT').value);
            formData.append('modelLLM', document.getElementById('modelSelectLLM').value);
            formData.append('toneLLM', document.getElementById('toneSelectSTT').value);
            formData.append('modelTTS', document.getElementById('modelSelectTTS').value);
            formData.append('nameVoiceTTS', document.getElementById('nameVoiceSelectTTS').value);
            sendAudioStream(formData);
        };

        mediaRecorder.start();
        isRecording = true;
        setStatus('در حال ضبط صدا...', 'recording');
        // reset sensitivity به مقدار اولیه بعد از stop (اینجا فقط برای کامل بودن)
    } catch (err) {
        setStatus('خطا در دسترسی به میکروفون', 'idle');
    }
}

// تابع توقف recording (مشترک)
function stopRecording() {
    if (!isRecording) return;
    mediaRecorder.stop();
    if (inputVizInterval) {
        clearInterval(inputVizInterval);
        inputVizInterval = null;
    }
    if (sourceRecording) {
        sourceRecording.disconnect();
        sourceRecording = null;
    }
    statusAnimation.style.removeProperty('--vol');
    isRecording = false;
    setStatus('در حال پردازش...', 'processing');
    clearTimeout(timeoutId); // پاک کردن timeout
    sensitivity = 0.1; // reset حساسیت به مقدار اولیه
}

// تابع چک کردن صدا
function checkVoice() {
    if (!stream || !analyser || isBotSpeaking) return; // skip اگر بات در حال صحبت باشه
    const volume = getVolume();
    if (volume > sensitivity) {
        sensitivity = 0.07; // افزایش حساسیت (threshold بالاتر = حساسیت کمتر) بعد از شناسایی صدا
        if (!isRecording) {
            startRecording();
        }
        // همیشه timeout را reset کن، حتی اگر قبلاً recording فعال باشد
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            if (isRecording) {
                stopRecording();
            }
        }, timeoutDuration);
    }
}

// تابع راه‌اندازی voice activation
function initVoiceActivation() {
    if (voiceCheckInterval) return; // اگر قبلاً شروع شده
    const autoListen = document.getElementById('listeningAutoSelect').value === 'true';
    if (!autoListen) return; // اگر false باشد، voice activation را فعال نکن
    // گرفتن stream برای detection
    navigator.mediaDevices.getUserMedia({ audio: true }).then(s => {
        stream = s;
        initAudioViz();
        sourceDetection = audioContext.createMediaStreamSource(stream);
        sourceDetection.connect(analyser);
        // شروع چک دوره‌ای با interval کوچکتر (50ms) برای detection سریع‌تر
        voiceCheckInterval = setInterval(checkVoice, 50);
    }).catch(err => {
        console.error('خطا در دسترسی به میکروفون برای voice detection:', err);
    });
}


function startOutputViz() {
    if (outputVizInterval) clearInterval(outputVizInterval);
    outputVizInterval = setInterval(updateOutputViz, 60);
}

function updateOutputViz() {
    if (!analyser) return;
    const freqData = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(freqData);
    const bands = 5;
    const bandWidth = Math.floor(freqData.length / bands);
    const vizItems = document.querySelectorAll('.status-animation .viz-item');
    for (let i = 0; i < bands; i++) {
        let sum = 0;
        const start = i * bandWidth;
        const end = Math.min(start + bandWidth, freqData.length);
        for (let j = start; j < end; j++) {
            sum += freqData[j];
        }
        const avg = sum / (end - start) / 255;
        // تغییر ارتفاع - از 35px تا 175px (5 برابر)
        const baseHeight = 35; // ارتفاع پایه
        const maxHeight = baseHeight * 5; // حداکثر ارتفاع (175px)
        const height = baseHeight + (avg * (maxHeight - baseHeight));
        vizItems[i].style.width = '35px'; // عرض ثابت
        vizItems[i].style.height = `${height}px`; // ارتفاع متغیر
        vizItems[i].style.borderRadius = '17.5px'; // شکل ستونی با گوشه‌های گرد
        // حذف محاسبات offset و transform - centering خودکار با CSS
    }
}

// مقدار های توی سلکت nameVoiceSelectTTS
modelSelectTTS.addEventListener('change', () => {
    let modelSelectedTTS = modelSelectTTS.value;
    let nameVoiceSelectedTTS = nameVoiceObjTTS[modelSelectedTTS];

    nameVoiceSelectTTS.innerHTML = "";
    nameVoiceSelectedTTS.forEach((nameVoice) => {
        nameVoiceSelectTTS.innerHTML += `<option value="${nameVoice}">${nameVoice}</option>`;
    });
});

// Settings Toggle
settingsBtn.addEventListener('click', () => {
    mainContent.classList.add('hidden');
    settingsPanel.classList.remove('hidden');
    stopBtn.style.display = 'none';
    settingsBtn.classList.add('active');
});

// close Settings Toggle
settingsClose.addEventListener('click', () => {
    settingsPanel.classList.add('hidden');
    mainContent.classList.remove('hidden');
    stopBtn.style.display = 'flex';
    settingsBtn.classList.remove('active');

    // رفرش کردن صفحه
    location.reload();
});


// Status change with animation
function setStatus(text, state) {
    const micArea = document.getElementById('micArea');
    statusText.classList.add('fade');
    micArea.className = 'mic-area';
    console.log("state" , state);
    
    const activeStates = ["processing", "recording", "generating"];
    if (activeStates.includes(state)) {
        stopProcess.style.display = 'flex';
    } else {
        stopProcess.style.display = 'none';
    }

    setTimeout(() => {
        statusText.textContent = text;
        micArea.classList.add(`state-${state}`);
        statusText.classList.remove('fade');
    }, 300);
}

// Check if everything is complete
function checkIfComplete() {
    if (generationComplete && allAudiosFinished) {
        setStatus('آماده برای گفتگو', 'idle');
        if (outputVizInterval) {
            clearInterval(outputVizInterval);
            outputVizInterval = null;
        }
        if (sourceRecording) { // فقط sourceRecording
            sourceRecording.disconnect();
            sourceRecording = null;
        }
        const vizItems = document.querySelectorAll('.viz-item');
        vizItems.forEach(item => {
            item.style.removeProperty('--offset');
        });
        statusAnimation.style.removeProperty('--vol');
    }
}

// اسکرول به پایین قسمت نمایش متن
function scrollToBottom() {
    const element = document.getElementById('transcriptArea');
    if (element) {
        element.scrollTop = element.scrollHeight;
    } else {
        console.warn('المان با id="transcriptArea" پیدا نشد!');
    }
}

// تابع برای ذخیره مقدار در localStorage
function saveToLocalStorage(selectElement, key) {
    localStorage.setItem(key, selectElement.value);
}

// افزودن Event Listener برای ذخیره تغییرات
languageSelect.addEventListener('change', () => {
    saveToLocalStorage(languageSelect, 'language');
});

modelSelectSTT.addEventListener('change', () => {
    saveToLocalStorage(modelSelectSTT, 'modelSTT');
});

modelSelectLLM.addEventListener('change', () => {
    saveToLocalStorage(modelSelectLLM, 'modelLLM');
});

toneSelectSTT.addEventListener('change', () => {
    saveToLocalStorage(toneSelectSTT, 'toneLLM');
});

modelSelectTTS.addEventListener('change', () => {
    saveToLocalStorage(modelSelectTTS, 'modelTTS');
});

nameVoiceSelectTTS.addEventListener('change', () => {
    saveToLocalStorage(nameVoiceSelectTTS, 'nameVoiceTTS');
});

listeningAutoSelect.addEventListener('change', () => {
    saveToLocalStorage(listeningAutoSelect, 'listeningAuto');
});

// بارگذاری مقادیر ذخیره‌شده هنگام لود صفحه
window.addEventListener('load', () => {
    const savedLanguage = localStorage.getItem('language');
    const savedModelSTT = localStorage.getItem('modelSTT');
    const savedModelLLM = localStorage.getItem('modelLLM');
    const savedtoneLLM = localStorage.getItem('toneLLM');
    const savedModelTTS = localStorage.getItem('modelTTS');
    const savedNameVoiceTTS = localStorage.getItem('nameVoiceTTS');
    const savedlisteningAuto = localStorage.getItem('listeningAuto');

    if (savedLanguage) {
        languageSelect.value = savedLanguage;
    }

    if (savedModelSTT) {
        modelSelectSTT.value = savedModelSTT;
    }

    if (savedModelLLM) {
        modelSelectLLM.value = savedModelLLM;
    }

    if (savedtoneLLM) {
        toneSelectSTT.value = savedtoneLLM;
    }

    if (savedModelTTS) {
        modelSelectTTS.value = savedModelTTS;
    }

    if (savedNameVoiceTTS) {
        nameVoiceSelectTTS.value = savedNameVoiceTTS;
    }

    if (savedlisteningAuto) {
        listeningAutoSelect.value = savedlisteningAuto;
    }

    // شروع voice activation هنگام لود صفحه
    initVoiceActivation();
});

// File Upload
sendFileBtn.addEventListener('click', () => {
    audioFileInput.click();
});

audioFileInput.addEventListener('change', (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
        const renamedFile = new File([selectedFile], 'user_audio.mp3', {
            type: 'audio/mpeg'
        });
        const formData = new FormData();
        formData.append('audio', renamedFile);
        formData.append('language', document.getElementById('languageSelect').value);
        formData.append('modelSTT', document.getElementById('modelSelectSTT').value);
        formData.append('modelLLM', document.getElementById('modelSelectLLM').value);
        formData.append('toneLLM', document.getElementById('toneSelectSTT').value);
        formData.append('modelTTS', document.getElementById('modelSelectTTS').value);
        formData.append('nameVoiceTTS', document.getElementById('nameVoiceSelectTTS').value);

        sendAudioStream(formData);
        setStatus('در حال پردازش فایل...', 'processing');
    }
});

// Microphone Recording - تغییر یافته برای استفاده از startRecording و stopRecording
micBtn.addEventListener('click', () => {
    if (!isRecording) {
        startRecording();
        clearTimeout(timeoutId); // جلوگیری از توقف خودکار با کلیک
    } else {
        stopAllAudio()
        stopRecording();
        // اگر voice detection متوقف نشده، ادامه بده (در اینجا interval رو پاک نمی‌کنیم مگر اینکه بخوای)
    }
});

function base64ToBlob(base64, mimeType = 'audio/mpeg') {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], {
        type: mimeType
    });
}

function playNext() {
    if (currentIndex + 1 < audioPlaylist.length && !isPlaying) {
        currentIndex++;
        const audio = audioPlaylist[currentIndex];
        
        audio.play().then(() => {
            isPlaying = true;
            isBotSpeaking = true; // set flag
            
            // اگر source برای این audio قبلاً ساخته نشده، بساز
            if (!audioSources.has(audio)) {
                const newSource = audioContext.createMediaElementSource(audio);
                newSource.connect(analyser);
                newSource.connect(audioContext.destination);
                audioSources.set(audio, newSource);
            }
            
            if (!outputVizInterval) {
                startOutputViz();
            }
        }).catch(err => {
            console.log('خطا در پخش:', err);
            isPlaying = false;
            isBotSpeaking = false; // reset در صورت خطا
            playNext();
        });
    } else if (currentIndex + 1 >= audioPlaylist.length) {
        allAudiosFinished = true;
        isBotSpeaking = false; // reset
        checkIfComplete();
    }
}


function stopAllAudio() {
    // توقف تمام فایل‌های صوتی در playlist
    audioPlaylist.forEach(audio => {
        audio.pause();
        audio.currentTime = 0; // ریست کردن زمان پخش برای شروع از ابتدا در پخش بعدی
    });
    
    // به‌روزرسانی فلگ‌ها
    isPlaying = false;
    isBotSpeaking = false;
    allAudiosFinished = true; // می‌توانید این را بر اساس نیاز تغییر دهید
    
    // توقف visualization اگر فعال باشد
    if (outputVizInterval) {
        clearInterval(outputVizInterval);
        outputVizInterval = null;
    }
    
    // اختیاری: ریست کردن ایندکس به ابتدای playlist
    currentIndex = 0;
    
    console.log('تمام پخش‌های صوتی متوقف شد.');
}


function onEnded() {
    if (sourceRecording) { // فقط sourceRecording
        sourceRecording.disconnect();
        sourceRecording = null;
    }
    isPlaying = false;
    isBotSpeaking = false; // reset
    playNext();
}

function addAudioToPlaylist(index, chunkText, audioB64) {
    const blob = base64ToBlob(audioB64);
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.addEventListener('ended', onEnded); // استفاده از onEnded که isBotSpeaking رو reset می‌کنه
    audioPlaylist.push(audio);

    // Add to transcript
    const item = document.createElement('div');
    item.className = 'transcript-item';

    const text = document.createElement('div');
    text.className = 'transcript-text';
    text.textContent = chunkText;

    const audioEl = document.createElement('audio');
    audioEl.src = url;
    audioEl.controls = true;
    audioEl.className = 'transcript-audio';

    item.appendChild(text);
    item.appendChild(audioEl);

    // Remove empty state
    const emptyState = transcriptArea.querySelector('.empty-state');
    if (emptyState) {
        emptyState.remove();
    }

    transcriptArea.appendChild(item);
    transcriptItems.push(item);

    // Show replay button
/*     if (audioPlaylist.length > 0) {
        replayButton.style.display = 'flex';
    } */

    receivedChunks++;

    if (autoPlay && !isPlaying) {
        playNext();
    }

    scrollToBottom();
}

function sendAudioStream(formData) {
    let session_id = localStorage.getItem('user_session_id');
    if (!session_id) {
        session_id = 'user_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
        localStorage.setItem('user_session_id', session_id);
    }

    formData.append('session_id', session_id);

    fetch('/process_audio_stream', {
        method: 'POST',
        body: formData
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => {
                // اگر کد 429 (Too Many Requests) بود → الرت + setStatus
                if (response.status === 429) {
                    alert(err.error); // نمایش پیام خطای فارسی از سرور
                    setStatus('لطفا ساعتی دیگر امتحان کنید', 'idle');
                } else {
                    throw new Error(err.error || 'خطا در سرور: ' + response.statusText);
                }
            });
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        function readStream() {
            reader.read().then(({ done, value }) => {
                if (done) return;

                buffer += decoder.decode(value, { stream: true });
                let lines = buffer.split('\n\n');
                buffer = lines.pop() || '';

                lines.forEach(line => {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            handleStreamData(data);
                        } catch (e) {
                            console.error('خطا در parse SSE:', e);
                        }
                    }
                });

                readStream();
            }).catch(err => {
                setStatus('خطا در ارتباط با سرور', 'idle');
            });
        }

        readStream();
    })
    .catch(err => {
        // خطاهای غیر 429 (مثل شبکه، خطای سرور و ...)
        if (err.message.includes('محدودیت ارسال پیام')) {
            alert(err.message);
            setStatus('لطفا ساعتی دیگر امتحان کنید', 'idle');
        } else {
            setStatus('خطا: ' + err.message, 'idle');
        }
    });
}

function handleStreamData(data) {
    if (data.type === 'start') {
        totalChunks = data.total_chunks;
        receivedChunks = 0;
        audioPlaylist = [];
        currentIndex = -1;
        isPlaying = false;
        allAudiosFinished = false;
        generationComplete = false;
        setStatus('تولید پاسخ هوش مصنوعی...', 'generating');
    } else if (data.type === 'audio_chunk') {
        addAudioToPlaylist(data.index, data.chunk_text, data.audio_b64);
    } else if (data.type === 'error_chunk') {
        console.error(`خطا در قطعه ${data.index}: ${data.message}`);
    } else if (data.type === 'end') {
        generationComplete = true;
        checkIfComplete();
        if (autoPlay && !isPlaying && currentIndex === -1) {
            playNext();
        }
    } else if (data.error) {
        setStatus('خطا: ' + data.error, 'idle');
    }
}

// Reset History
resetButton.addEventListener('click', async () => {
    try {
        const response = await fetch("/clear_history", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            transcriptArea.innerHTML = '<div class="empty-state">هنوز پیامی ارسال نشده است</div>';
            audioPlaylist = [];
            transcriptItems = [];
/*          replayButton.style.display = 'none'; */ 
            allAudiosFinished = false;
            generationComplete = false;
            if (inputVizInterval) {
                clearInterval(inputVizInterval);
                inputVizInterval = null;
            }
            if (outputVizInterval) {
                clearInterval(outputVizInterval);
                outputVizInterval = null;
            }
            if (sourceRecording) { // فقط sourceRecording
                sourceRecording.disconnect();
                sourceRecording = null;
            }
            const vizItems = document.querySelectorAll('.viz-item');
            vizItems.forEach(item => {
                item.style.removeProperty('--offset');
            });
            statusAnimation.style.removeProperty('--vol');
            setStatus('آماده برای گفتگو', 'idle');
        } else {
            setStatus('خطا در بازنشانی', 'idle');
        }
    } catch (err) {
        setStatus('خطا در ارتباط با سرور', 'idle');
    }
});

// Replay All
replayButton.addEventListener('click', () => {
    // اگر در حال پخش هستیم، متوقفش کن
    if (currentIndex >= 0 && currentIndex < audioPlaylist.length) {
        audioPlaylist[currentIndex].pause();
        audioPlaylist[currentIndex].currentTime = 0;
    }
    
    // reset کردن همه audioها
    audioPlaylist.forEach(audio => {
        audio.pause();
        audio.currentTime = 0;
    });
    
    currentIndex = -1;
    isPlaying = false;
    allAudiosFinished = false;
    playNext();
});


let isFirstClick = true; // متغیر برای ردیابی وضعیت کلیک

openBottom.addEventListener('click', () => {
    if (isFirstClick) {
        // اول minHeight را تغییر می‌دهیم تا انیمیشن اجرا شود
        container.style.minHeight = '520px';
        
        // بعد از اتمام انیمیشن (فرض بر این است که transition روی minHeight تعریف شده)، المان‌ها را نمایش می‌دهیم
        container.addEventListener('transitionend', function showElements() {
            statusText.style.display = 'grid';
            transcriptArea.style.display = 'grid';
            replayButton.style.display = 'flex';
            // برای جلوگیری از اجرای مجدد، listener را حذف می‌کنیم
            container.removeEventListener('transitionend', showElements);
        }, { once: true }); // once: true برای اجرای یک‌بار
        
        openBottom.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" height="40px" viewBox="0 -960 960 960" width="40px" fill="#6b6b6b"><path d="M480-545.33 287.33-352.67 240-400l240-240 240 240-47.33 47.33L480-545.33Z"/></svg>';
    } else {
        // اول المان‌ها را مخفی می‌کنیم
        statusText.style.display = 'none';
        transcriptArea.style.display = 'none';
        replayButton.style.display = 'none';
        
        // بعد minHeight را تغییر می‌دهیم
        container.style.minHeight = '300px';
        
        openBottom.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" height="40px" viewBox="0 -960 960 960" width="40px" fill="#6b6b6b"><path d="M480-344 240-584l47.33-47.33L480-438.67l192.67-192.66L720-584 480-344Z"/></svg>';
    }
    isFirstClick = !isFirstClick; // تغییر وضعیت کلیک
});



document.addEventListener('DOMContentLoaded', function() {

    moreBtn.addEventListener('click', function() {
        const computedStyle = window.getComputedStyle(actionButtons);
        if (computedStyle.display === 'none') {
            actionButtons.style.display = 'inline-grid'; 
            actionButtons.style.right = '30px'; 
            actionButtons.style.top = '410px'; 
        } else {
            actionButtons.style.display = 'none';
        }
    });
});




// متوقف کردن فرایند در هر لحظه با دکمه stop و اندپونت cancel_session
stopProcess.addEventListener("click", async () => {
    try {
        const response = await fetch("/cancel_session", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ session_id: 'default' })  // یا session_id واقعی از متغیر
        });

        if (response.ok) {
            stopAllAudio()
            setStatus('آماده برای گفتگو', 'idle');
        } else {
            setStatus('خطا در متوقف کردن', 'idle');
        }

    } catch (err) {
        setStatus('خطا در ارتباط با سرور', 'idle');
    }
});