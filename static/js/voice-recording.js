// ضبط صدا، voice activation و تشخیص خودکار صدا



// شروع ضبط صدا
async function startRecording() {
    if (isRecording) return;
    try {
        if (!stream) {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            initAudioViz();
            sourceDetection = audioContext.createMediaStreamSource(stream);
            sourceDetection.connect(analyser);
        }
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
            formData.append('language', languageSelect.value);
            formData.append('modelSTT', modelSelectSTT.value);
            formData.append('modelLLM', modelSelectLLM.value);
            formData.append('toneLLM', toneSelectSTT.value);
            formData.append('modelTTS', modelSelectTTS.value);
            formData.append('nameVoiceTTS', nameVoiceSelectTTS.value);
            sendAudioStream(formData);
        };

        mediaRecorder.start();
        isRecording = true;
        setStatus('در حال ضبط صدا...', 'recording');
    } catch (err) {
        setStatus('خطا در دسترسی به میکروفون', 'idle');
    }
}

// توقف ضبط صدا
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
    clearTimeout(timeoutId);
    sensitivity = 0.1;
}

// بررسی صدا برای voice activation
function checkVoice() {
    if (!stream || !analyser || isBotSpeaking) return;
    const volume = getVolume();
    if (volume > sensitivity) {
        sensitivity = 0.07;
        if (!isRecording) {
            startRecording();
        }
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            if (isRecording) {
                stopRecording();
            }
        }, timeoutDuration);
    }
}

// راه‌اندازی voice activation
function initVoiceActivation() {
    if (voiceCheckInterval) return;
    const autoListen = listeningAutoSelect.value === 'true';
    if (!autoListen) return;
    navigator.mediaDevices.getUserMedia({ audio: true }).then(s => {
        stream = s;
        initAudioViz();
        sourceDetection = audioContext.createMediaStreamSource(stream);
        sourceDetection.connect(analyser);
        voiceCheckInterval = setInterval(checkVoice, 50);
    }).catch(err => {
        console.error('خطا در دسترسی به میکروفون برای voice detection:', err);
    });
}