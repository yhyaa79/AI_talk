// مدیریت تنظیمات، ذخیره و بارگذاری از localStorage



// ذخیره در localStorage
function saveToLocalStorage(selectElement, key) {
    localStorage.setItem(key, selectElement.value);
}

// بارگذاری تنظیمات
function loadSettings() {
    const savedLanguage = localStorage.getItem('language');
    const savedModelSTT = localStorage.getItem('modelSTT');
    const savedModelLLM = localStorage.getItem('modelLLM');
    const savedtoneLLM = localStorage.getItem('toneLLM');
    const savedModelTTS = localStorage.getItem('modelTTS');
    const savedNameVoiceTTS = localStorage.getItem('nameVoiceTTS');
    const savedlisteningAuto = localStorage.getItem('listeningAuto');

    if (savedLanguage) languageSelect.value = savedLanguage;
    if (savedModelSTT) modelSelectSTT.value = savedModelSTT;
    if (savedModelLLM) modelSelectLLM.value = savedModelLLM;
    if (savedtoneLLM) toneSelectSTT.value = savedtoneLLM;
    if (savedModelTTS) modelSelectTTS.value = savedModelTTS;
    if (savedNameVoiceTTS) nameVoiceSelectTTS.value = savedNameVoiceTTS;
    if (savedlisteningAuto) listeningAutoSelect.value = savedlisteningAuto;
}

// به‌روزرسانی لیست صداها بر اساس مدل TTS
function updateVoiceOptions() {
    let modelSelectedTTS = modelSelectTTS.value;
    let nameVoiceSelectedTTS = nameVoiceObjTTS[modelSelectedTTS];

    nameVoiceSelectTTS.innerHTML = "";
    nameVoiceSelectedTTS.forEach((nameVoice) => {
        nameVoiceSelectTTS.innerHTML += `<option value="${nameVoice}">${nameVoice}</option>`;
    });
}