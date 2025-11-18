// مدیریت پخش صوت، playlist و تبدیل Base64 به Blob



// تبدیل Base64 به Blob
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

// پخش قطعه بعدی
function playNext() {
    if (currentIndex + 1 < audioPlaylist.length && !isPlaying) {
        currentIndex++;
        const audio = audioPlaylist[currentIndex];
        
        audio.play().then(() => {
            isPlaying = true;
            isBotSpeaking = true;
            
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
            isBotSpeaking = false;
            playNext();
        });
    } else if (currentIndex + 1 >= audioPlaylist.length) {
        allAudiosFinished = true;
        isBotSpeaking = false;
        checkIfComplete();
    }
}

// توقف تمام صداها
function stopAllAudio() {
    audioPlaylist.forEach(audio => {
        audio.pause();
        audio.currentTime = 0;
    });
    
    isPlaying = false;
    isBotSpeaking = false;
    allAudiosFinished = true;
    
    if (outputVizInterval) {
        clearInterval(outputVizInterval);
        outputVizInterval = null;
    }
    
    currentIndex = 0;
    console.log('تمام پخش‌های صوتی متوقف شد.');
}

// هنگام اتمام پخش
function onEnded() {
    if (sourceRecording) {
        sourceRecording.disconnect();
        sourceRecording = null;
    }
    isPlaying = false;
    isBotSpeaking = false;
    playNext();
}

// افزودن صدا به playlist
function addAudioToPlaylist(index, chunkText, audioB64) {
    setStatus('تولید پاسخ هوش مصنوعی...', 'generating');
    const blob = base64ToBlob(audioB64);
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.addEventListener('ended', onEnded);
    audioPlaylist.push(audio);

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

    const emptyState = transcriptArea.querySelector('.empty-state');
    if (emptyState) {
        emptyState.remove();
    }

    transcriptArea.appendChild(item);
    transcriptItems.push(item);

    receivedChunks++;

    if (autoPlay && !isPlaying) {
        playNext();
    }

    scrollToBottom();
}