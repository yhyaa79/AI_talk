// تمام متغیرهای global، DOM references و تنظیمات اولیه


// ===== DOM Elements =====
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

// ===== Recording State =====
let mediaRecorder;
let audioChunks = [];
let isRecording = false;
let stream;
let sourceDetection = null;
let sourceRecording = null;

// ===== Voice Activation Settings =====
let sensitivity = 0.1;
let timeoutDuration = 2000;
let voiceCheckInterval;
let timeoutId;
let isBotSpeaking = false;

// ===== Playback State =====
let isPlaying = false;
let currentIndex = -1;
let audioPlaylist = [];
let receivedChunks = 0;
let totalChunks = 0;
let autoPlay = true;
let transcriptItems = [];
let allAudiosFinished = false;
let generationComplete = false;

// ===== Audio Visualization =====
let audioContext = null;
let analyser = null;
let source = null;
let inputVizInterval = null;
let outputVizInterval = null;
const audioSources = new Map();

// ===== TTS Voice Options =====
let nameVoiceObjTTS = {
    'tts-1': ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'],
    'tts-1-hd': ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'],
    'gpt-4o-mini-tts': ['Calm', 'Surfer', 'Professional']
};

// ===== UI State =====
let isFirstClick = true;