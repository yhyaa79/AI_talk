// تمام event listenerها و handlers برای دکمه‌ها و اینپوت‌ها



// Event Listeners برای تنظیمات
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
    updateVoiceOptions();
});

nameVoiceSelectTTS.addEventListener('change', () => {
    saveToLocalStorage(nameVoiceSelectTTS, 'nameVoiceTTS');
});

listeningAutoSelect.addEventListener('change', () => {
    saveToLocalStorage(listeningAutoSelect, 'listeningAuto');
});

// باز و بستن پنل تنظیمات
settingsBtn.addEventListener('click', () => {
    mainContent.classList.add('hidden');
    settingsPanel.classList.remove('hidden');
    stopBtn.style.display = 'none';
    settingsBtn.classList.add('active');
});

settingsClose.addEventListener('click', () => {
    settingsPanel.classList.add('hidden');
    mainContent.classList.remove('hidden');
    stopBtn.style.display = 'flex';
    settingsBtn.classList.remove('active');
    location.reload();
});

// دکمه میکروفون
micBtn.addEventListener('click', () => {
    if (!isRecording) {
        startRecording();
        clearTimeout(timeoutId);
    } else {
        stopAllAudio();
        stopRecording();
    }
});

// آپلود فایل صوتی
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
        formData.append('language', languageSelect.value);
        formData.append('modelSTT', modelSelectSTT.value);
        formData.append('modelLLM', modelSelectLLM.value);
        formData.append('toneLLM', toneSelectSTT.value);
        formData.append('modelTTS', modelSelectTTS.value);
        formData.append('nameVoiceTTS', nameVoiceSelectTTS.value);

        sendAudioStream(formData);
        setStatus('در حال پردازش فایل...', 'processing');
    }
});

// دکمه ریست
resetButton.addEventListener('click', clearHistory);

// دکمه پخش مجدد
replayButton.addEventListener('click', () => {
    if (currentIndex >= 0 && currentIndex < audioPlaylist.length) {
        audioPlaylist[currentIndex].pause();
        audioPlaylist[currentIndex].currentTime = 0;
    }
    
    audioPlaylist.forEach(audio => {
        audio.pause();
        audio.currentTime = 0;
    });
    
    currentIndex = -1;
    isPlaying = false;
    allAudiosFinished = false;
    playNext();
});

// دکمه باز/بسته کردن پایین
openBottom.addEventListener('click', () => {
    const isMobile = window.innerWidth <= 768; // تشخیص موبایل (می‌توانید این مقدار را بر اساس نیاز تغییر دهید)

    if (isFirstClick) {
        container.style.minHeight = isMobile ? '350px' : '520px';    

        container.addEventListener('transitionend', function showElements() {statusText.style.display = 'grid';
            transcriptArea.style.display = 'grid';
            replayButton.style.display = 'flex';
            container.removeEventListener('transitionend', showElements);
        }, { once: true });
        
        openBottom.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" height="40px" viewBox="0 -960 960 960" width="40px" fill="#6b6b6b"><path d="M480-545.33 287.33-352.67 240-400l240-240 240 240-47.33 47.33L480-545.33Z"/></svg>';
    } else {
        statusText.style.display = 'none';
        transcriptArea.style.display = 'none';
        replayButton.style.display = 'none';
        
        container.style.minHeight = isMobile ? '180px' : '300px';
        
        openBottom.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" height="40px" viewBox="0 -960 960 960" width="40px" fill="#6b6b6b"><path d="M480-344 240-584l47.33-47.33L480-438.67l192.67-192.66L720-584 480-344Z"/></svg>';
    }
    isFirstClick = !isFirstClick;
});

// دکمه More
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

// دکمه توقف فرایند
stopProcess.addEventListener("click", cancelSession);

// بارگذاری تنظیمات و شروع voice activation هنگام لود صفحه
window.addEventListener('load', () => {
    loadSettings();
    initVoiceActivation();
});