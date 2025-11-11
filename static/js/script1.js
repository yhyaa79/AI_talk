let mediaRecorder;
let audioChunks = [];
let isRecording = false;
const micBtn = document.getElementById('micBtn');
const statusText = document.getElementById('statusText');
const micArea = document.getElementById('micArea');
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

let statusAnimation = document.getElementById('statusAnimation'); // Added reference

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
    'elevenlabs/v3_alpha': ['Alice', 'bb', 'cc'],
    'minimax/speech-2.6-hd': ['Alice', 'bbb', 'ccc']
};

// Audio visualization setup
let audioContext = null;
let analyser = null;
let source = null;
let inputVizInterval = null;
let outputVizInterval = null;

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
    const vol = 1.5 + (rms * 3); // Tuned for subtle to prominent pulsing (0.8-2.6 scale)
    statusAnimation.style.setProperty('--vol', vol);
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
        // کشیده شدن عمودی (ارتفاع) برای شبیه شدن به لوگوی صوت
        const height = 20 + (avg * 80); // ارتفاع از 20px تا 100px
        vizItems[i].style.height = `${height}px`;
        vizItems[i].style.borderRadius = '10px'; // تغییر از دایره به مستطیل گرد
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
    settingsBtn.classList.add('active');
});

// close Settings Toggle
settingsClose.addEventListener('click', () => {
    settingsPanel.classList.add('hidden');
    mainContent.classList.remove('hidden');
    settingsBtn.classList.remove('active');
});

// Status change with animation
function setStatus(text, state) {
    statusText.classList.add('fade');
    micArea.className = 'mic-area';

    setTimeout(() => {
        statusText.textContent = text;
        micArea.classList.add(`state-${state}`);
        statusText.classList.remove('fade');

        // دسترسی به المان SVG داخل دکمه میکروفون
        const micIcon = document.querySelector('.mic-icon');

        if (state === "idle") {
            // برای حالت idle: دو path اصلی میکروفون (مانند کد فعلی)
            micIcon.innerHTML = `
            `;
        } else if (state === "recording") {
            // مثال برای حالت recording: path های متفاوت (مثلاً با موج صدا یا آیکون ضبط)
            micIcon.innerHTML = `
         `;
        } else if (state === "processing") {
            // مثال برای حالت paused: path های متفاوت (مثلاً با خط افقی برای توقف)
            micIcon.innerHTML = `
            `;
        } else if (state === "generating") {
            // مثال برای حالت error: path های متفاوت (مثلاً علامت خطا)
            micIcon.innerHTML = `
            `;
        } else {
            // حالت پیش‌فرض: برگشت به path های idle
            micIcon.innerHTML = `

            `;
        }
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
        if (source) {
            source.disconnect();
            source = null;
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

// بارگذاری مقادیر ذخیره‌شده هنگام لود صفحه
window.addEventListener('load', () => {
    const savedLanguage = localStorage.getItem('language');
    const savedModelSTT = localStorage.getItem('modelSTT');
    const savedModelLLM = localStorage.getItem('modelLLM');
    const savedtoneLLM = localStorage.getItem('toneLLM');
    const savedModelTTS = localStorage.getItem('modelTTS');
    const savedNameVoiceTTS = localStorage.getItem('nameVoiceTTS');

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

// Microphone Recording
micBtn.addEventListener('click', async () => {
    if (!isRecording) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true
            });
            initAudioViz();
            source = audioContext.createMediaStreamSource(stream);
            source.connect(analyser);
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
        } catch (err) {
            setStatus('خطا در دسترسی به میکروفون', 'idle');
        }
    } else {
        mediaRecorder.stop();
        if (inputVizInterval) {
            clearInterval(inputVizInterval);
            inputVizInterval = null;
        }
        if (source) {
            source.disconnect();
            source = null;
        }
        statusAnimation.style.removeProperty('--vol');
        isRecording = false;
        setStatus('در حال پردازش...', 'processing');
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
        
        // اتصال به audioContext قبل از پخش
        initAudioViz(); // اطمینان از ایجاد audioContext
        
        audio.play().then(() => {
            isPlaying = true;
            
            // اتصال audio به analyser برای visualization
            if (source) {
                source.disconnect();
            }
            source = audioContext.createMediaElementSource(audio);
            source.connect(analyser);
            analyser.connect(audioContext.destination); // اضافه شده: اتصال به destination برای پخش صدا
            
            if (!outputVizInterval) {
                startOutputViz();
            }
        }).catch(err => {
            console.log('خطا در پخش:', err);
            isPlaying = false;
            playNext();
        });
    } else if (currentIndex + 1 >= audioPlaylist.length) {
        allAudiosFinished = true;
        checkIfComplete();
    }
}

function onEnded() {
    if (source) {
        source.disconnect();
        source = null;
    }
    isPlaying = false;
    playNext();
}

function addAudioToPlaylist(index, chunkText, audioB64) {
    const blob = base64ToBlob(audioB64);
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.addEventListener('ended', onEnded);
    
    // حذف crossOrigin که باعث مشکل می‌شود
    // audio.crossOrigin = "anonymous"; // این خط را حذف کنید اگر وجود دارد
    
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
    if (audioPlaylist.length > 0) {
        replayButton.style.display = 'flex';
    }

    receivedChunks++;

    if (autoPlay && !isPlaying) {
        playNext();
    }

    scrollToBottom();
}


function sendAudioStream(formData) {
    fetch('/process_audio_stream', {
        method: 'POST',
        body: formData
    })
        .then(response => {
            if (!response.ok) {
                throw new Error('خطا در سرور: ' + response.statusText);
            }
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            function readStream() {
                reader.read().then(({ done, value }) => {
                    if (done) {
                        return;
                    }
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
            setStatus('خطا: ' + err.message, 'idle');
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
        const response = await fetch("/reset_history", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            transcriptArea.innerHTML = '<div class="empty-state">هنوز پیامی ارسال نشده است</div>';
            audioPlaylist = [];
            transcriptItems = [];
            replayButton.style.display = 'none';
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
            if (source) {
                source.disconnect();
                source = null;
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
    currentIndex = -1;
    isPlaying = false;
    allAudiosFinished = false;
    playNext();
});