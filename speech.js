/* Browser speech features: Text-to-Speech + Speech-to-Text. */
const Speech = (() => {
  let voices = [];
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;
  let listening = false;
  let onResult = null;
  let onState = null;
  let onError = null;

  const state = {
    enabled: true,
    autoSpeech: false,
    rate: 1,
    volume: 1,
    language: "en-IN",
    voice: ""
  };

  function refreshVoices() {
    if (!("speechSynthesis" in window)) return [];
    voices = window.speechSynthesis.getVoices();
    return voices;
  }

  function populateVoiceSelect(select) {
    if (!select || !("speechSynthesis" in window)) return;
    const current = state.voice;
    select.innerHTML = '<option value="">Default voice</option>';
    refreshVoices().forEach((v, i) => {
      const opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = `${v.name} — ${v.lang}`;
      select.appendChild(opt);
    });
    select.value = current;
  }

  function speak(text) {
    if (!state.enabled || !("speechSynthesis" in window) || !String(text || "").trim()) return false;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(String(text).trim());
    utter.rate = state.rate;
    utter.volume = state.volume;
    utter.lang = state.language;
    const index = Number.parseInt(state.voice, 10);
    if (Number.isInteger(index) && voices[index]) utter.voice = voices[index];
    window.speechSynthesis.speak(utter);
    return true;
  }

  function stop() {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }

  function speechRecognitionSupported() {
    return Boolean(Recognition);
  }

  function startRecognition() {
    if (!Recognition) {
      onError?.("Voice recognition is not supported by this browser. Use Google Chrome or Microsoft Edge.");
      return false;
    }
    if (listening) {
      stopRecognition();
      return true;
    }

    recognition = new Recognition();
    recognition.lang = state.language;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      listening = true;
      onState?.("listening");
    };

    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      onResult?.(transcript.trim(), event.results[event.results.length - 1].isFinal);
    };

    recognition.onerror = (event) => {
      listening = false;
      onState?.("error");
      const messages = {
        "not-allowed": "Microphone permission was denied. Allow microphone access and try again.",
        "audio-capture": "No microphone was found.",
        "no-speech": "No speech was detected. Try speaking again.",
        "network": "Voice recognition needs a network connection in this browser."
      };
      onError?.(messages[event.error] || `Voice recognition error: ${event.error}`);
    };

    recognition.onend = () => {
      listening = false;
      onState?.("ready");
    };

    try {
      recognition.start();
      return true;
    } catch (error) {
      listening = false;
      onError?.(error.message || "Could not start voice recognition.");
      return false;
    }
  }

  function stopRecognition() {
    try { recognition?.stop(); } catch {}
    listening = false;
    onState?.("ready");
  }

  return {
    state,
    speak,
    stop,
    refreshVoices,
    populateVoiceSelect,
    speechRecognitionSupported,
    startRecognition,
    stopRecognition,
    onResult(fn) { onResult = fn; },
    onState(fn) { onState = fn; },
    onError(fn) { onError = fn; }
  };
})();

if ("speechSynthesis" in window) {
  window.speechSynthesis.onvoiceschanged = () => Speech.refreshVoices();
}