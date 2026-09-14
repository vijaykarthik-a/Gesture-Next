const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const HISTORY_KEY = "smartGloveHistory";
const SETTINGS_KEY = "smartGloveSettings";

const defaultSettings = {
  autoRecognition:true, autoSpeech:true, confidenceThreshold:70,
  language:"en-IN", voice:"", rate:1, volume:1,
  connectionPreference:"bluetooth", lightMode:true, pastelMode:true
};
let settings = {...defaultSettings, ...loadJson(SETTINGS_KEY,{})};
let history = loadJson(HISTORY_KEY, []);
let current = { gesture:"HELLO", confidence:98.7, timestamp:new Date().toISOString(), connectionType:"demo" };
let spokenText = "";
let uiLanguage = settings.language === "ta-IN" ? "ta-IN" : "en-IN";

let emergencySoundTimer = null;
let emergencyAudioContext = null;

// Play a short emergency siren whenever the HI message is recognized.
// The sound is generated locally with Web Audio, so no extra audio file is required.
function playEmergencySound(){
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if(!AudioCtx) return;

    if(emergencySoundTimer) clearTimeout(emergencySoundTimer);
    if(emergencyAudioContext && emergencyAudioContext.state !== "closed"){
      try { emergencyAudioContext.close(); } catch {}
    }

    const ctx = new AudioCtx();
    emergencyAudioContext = ctx;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, ctx.currentTime);
    master.gain.exponentialRampToValueAtTime(0.22, ctx.currentTime + 0.04);
    master.connect(ctx.destination);

    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.connect(master);

    const start = ctx.currentTime;
    const step = 0.24;
    for(let i=0;i<13;i++){
      const t = start + i * step;
      osc.frequency.setValueAtTime(i % 2 === 0 ? 880 : 660, t);
    }
    osc.start(start);
    osc.stop(start + 3);

    emergencySoundTimer = setTimeout(()=>{
      try { master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.03); } catch {}
      setTimeout(()=>{ try { ctx.close(); } catch {} }, 150);
      emergencyAudioContext = null;
      emergencySoundTimer = null;
    }, 3000);
  } catch(err) {
    console.warn("Emergency sound could not be played:", err);
  }
}

function containsHi(text){
  return /(^|[^a-z])hi([^a-z]|$)/i.test(String(text || ""));
}

const UI_TA = {
  "Dashboard":"டாஷ்போர்டு","Connect":"இணைப்பு","History":"வரலாறு","Analytics":"பகுப்பாய்வு","Settings":"அமைப்புகள்",
  "AI Communication Assistant":"AI தொடர்பு உதவியாளர்","Choose a connection":"இணைப்பு முறையை தேர்வு செய்யவும்",
  "Gesture activity":"சைகை செயல்பாடுகள்","Recognition insights":"அங்கீகார தகவல்கள்","Preferences & data":"விருப்பங்கள் மற்றும் தரவு",
  "Your hands can speak.":"உங்கள் கைகள் பேச முடியும்.","AI-powered assistive communication for natural, accessible conversations.":"இயல்பான மற்றும் அனைவருக்கும் அணுகக்கூடிய தொடர்புக்கான AI உதவி.",
  "AI enabled":"AI இயக்கப்பட்டுள்ளது","Glove Connection":"கையுறை இணைப்பு","Communication link":"தொடர்பு இணைப்பு","Offline":"ஆஃப்லைன்",
  "Connection type":"இணைப்பு வகை","Device":"சாதனம்","Not connected":"இணைக்கப்படவில்லை","None":"எதுவுமில்லை",
  "Connect":"இணைக்கவும்","Disconnect":"துண்டிக்கவும்","Speak to Smart Glove":"Smart Glove-க்கு பேசுங்கள்",
  "Say something and see it on the display":"பேசி, அதை திரையில் பார்க்கவும்","YOUR SPEECH":"உங்கள் பேச்சு",
  "Tap the microphone and start speaking...":"மைக்ரோஃபோனைத் தட்டி பேசத் தொடங்குங்கள்...","Start Speaking":"பேசத் தொடங்குங்கள்",
  "Speak":"பேசு","Copy":"நகலெடு","Ready":"தயார்","Current Gesture":"தற்போதைய சைகை",
  "Latest recognized message":"சமீபத்திய அங்கீகரிக்கப்பட்ட செய்தி","DETECTED GESTURE":"கண்டறியப்பட்ட சைகை",
  "Gesture recognized successfully":"சைகை வெற்றிகரமாக அங்கீகரிக்கப்பட்டது","AI Confidence":"AI நம்பகத்தன்மை",
  "Quick Actions":"விரைவு செயல்கள்","Do more with one tap":"ஒரே தொடுதலில் மேலும் செய்யுங்கள்",
  "Read the current gesture aloud":"தற்போதைய சைகையை சத்தமாக வாசிக்கவும்","Bluetooth":"ப்ளூடூத்",
  "Common Gestures":"பொதுவான சைகைகள்","Quickly try a message":"ஒரு செய்தியை விரைவாக முயற்சிக்கவும்",
  "View history →":"வரலாற்றைப் பார்க்கவும் →","Recent Gestures":"சமீபத்திய சைகைகள்","Latest activity":"சமீபத்திய செயல்பாடு",
  "Statistics":"புள்ளிவிவரங்கள்","Communication at a glance":"தொடர்பின் சுருக்கம்",
  "Try the Smart Glove without hardware":"வன்பொருள் இல்லாமல் Smart Glove-ஐ முயற்சிக்கவும்",
  "Simulation updates the dashboard exactly like an incoming ESP32 message.":"உள்வரும் ESP32 செய்தியைப் போலவே டாஷ்போர்டை சிமுலேஷன் புதுப்பிக்கும்.",
  "Simulate Gesture":"சைகையை சிமுலேட் செய்யவும்","CONNECTION":"இணைப்பு","Connect Your Smart Glove":"Smart Glove-ஐ இணைக்கவும்",
  "Choose how your glove communicates with this device.":"உங்கள் கையுறை இந்த சாதனத்துடன் எவ்வாறு தொடர்பு கொள்ள வேண்டும் என்பதைத் தேர்வு செய்யவும்",
  "BLUETOOTH":"ப்ளூடூத்","Bluetooth Low Energy":"Bluetooth Low Energy","Scan Devices":"சாதனங்களைத் தேடவும்",
  "HISTORY":"வரலாறு","Gesture History":"சைகை வரலாறு","Your recognized messages are stored locally on this device.":"அங்கீகரிக்கப்பட்ட செய்திகள் இந்த சாதனத்தில் உள்ளூராக சேமிக்கப்படும்.",
  "Search gestures...":"சைகைகளைத் தேடவும்","All connections":"அனைத்து இணைப்புகளும்","Clear History":"வரலாற்றை அழிக்கவும்",
  "ANALYTICS":"பகுப்பாய்வு","Communication Analytics":"தொடர்பு பகுப்பாய்வு","Simple, local insights from your gesture history.":"உங்கள் சைகை வரலாற்றிலிருந்து உள்ளூர் தகவல்கள்.",
  "Gesture Frequency":"சைகை அடிக்கடி நிகழ்வு","Recognized messages":"அங்கீகரிக்கப்பட்ட செய்திகள்","Confidence":"நம்பகத்தன்மை","average":"சராசரி",
  "SETTINGS":"அமைப்புகள்","Settings":"அமைப்புகள்","Personalize recognition, speech, appearance and data.":"அங்கீகாரம், பேச்சு, தோற்றம் மற்றும் தரவை தனிப்பயனாக்கவும்",
  "COMMUNICATION":"தொடர்பு","Communication Settings":"தொடர்பு அமைப்புகள்","Preferred hardware link":"விருப்பமான வன்பொருள் இணைப்பு",
  "RECOGNITION":"அங்கீகாரம்","Recognition Settings":"அங்கீகார அமைப்புகள்","Auto recognition":"தானியங்கி அங்கீகாரம்",
  "Process incoming gestures automatically":"வரும் சைகைகளை தானாக செயலாக்கவும்","Auto speech":"தானியங்கி பேச்சு",
  "Speak recognized gestures automatically":"அங்கீகரிக்கப்பட்ட சைகைகளை தானாக பேசவும்","Confidence threshold":"நம்பகத்தன்மை வரம்பு",
  "Ignore messages below this value":"இந்த மதிப்பிற்கு கீழே உள்ள செய்திகளை புறக்கணிக்கவும்","SPEECH":"பேச்சு","Speech Settings":"பேச்சு அமைப்புகள்",
  "Language":"மொழி","Voice recognition and speech language":"குரல் அங்கீகாரம் மற்றும் பேச்சு மொழி","Voice":"குரல்",
  "Speech rate":"பேச்சு வேகம்","Volume":"ஒலி அளவு","APPEARANCE":"தோற்றம்","Appearance":"தோற்றம்",
  "Dark mode":"டார்க் மோடு","Switch between light and dark interface":"லைட் மற்றும் டார்க் இடைமுகங்களுக்கு மாறவும்",
  "Soft pastel mode":"மென்மையான பேஸ்டல் மோடு","Use the lavender/blue palette":"லாவெண்டர்/நீல நிறத் தொகுப்பைப் பயன்படுத்தவும்",
  "DATA":"தரவு","Data Management":"தரவு மேலாண்மை","Export History as JSON":"வரலாற்றை JSON ஆக ஏற்றுமதி செய்யவும்",
  "Export History as CSV":"வரலாற்றை CSV ஆக ஏற்றுமதி செய்யவும்","Clear Gesture History":"சைகை வரலாற்றை அழிக்கவும்",
  "ABOUT":"பற்றி","AI-powered assistive communication system.":"AI உதவியுடன் கூடிய தொடர்பு அமைப்பு.",
  "Emergency SOS":"அவசர SOS","Cancel":"ரத்து","Activate SOS":"SOS-ஐ செயல்படுத்தவும்"
};

function textForGesture(info){
  return uiLanguage === "ta-IN" ? (info.taLabel || info.label) : info.label;
}
function descriptionForGesture(info){
  return uiLanguage === "ta-IN" ? (info.taDescription || info.description) : info.description;
}
function applyLanguage(){
  document.documentElement.lang = uiLanguage === "ta-IN" ? "ta" : "en";
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
  const nodes=[]; while(walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(node=>{
    if(!node.parentElement || ["SCRIPT","STYLE"].includes(node.parentElement.tagName)) return;
    const raw=node.nodeValue, trimmed=raw.trim();
    if(!node.datasetOriginalText) node.datasetOriginalText=trimmed;
    const original=node.datasetOriginalText;
    const translated=uiLanguage==="ta-IN" ? (UI_TA[original]||original) : original;
    if(trimmed) node.nodeValue=raw.replace(trimmed,translated);
  });
  const search=$("#historySearch"); if(search) search.placeholder=uiLanguage==="ta-IN"?"சைகைகளைத் தேடவும்...":"Search gestures...";
  $("#topLanguage").value=uiLanguage;
  $("#themeToggle").textContent=document.body.classList.contains("dark")?"☀️":"🌙";
  renderGestures(); renderCurrent(); renderRecent(); renderHistory(); renderAnalytics();
  updateSpeechAvatar(spokenText, false);
}

function setLanguage(lang){
  uiLanguage = lang === "ta-IN" ? "ta-IN" : "en-IN";
  settings.language=uiLanguage;
  Speech.state.language=uiLanguage;
  save();
  applyLanguage();
  toast(uiLanguage==="ta-IN"?"தமிழ் மொழி இயக்கப்பட்டது":"English enabled");
}

const SPEECH_EXPRESSIONS = [
  { keys:["hello","hi","hey","good morning","good evening","வணக்கம்","ஹலோ","காலை வணக்கம்","மாலை வணக்கம்"], pose:"greeting", en:"Greeting / friendly hello", ta:"வாழ்த்து / அன்பான வணக்கம்" },
  { keys:["thank","thanks","நன்றி"], pose:"thanks", en:"Gratitude / thank you", ta:"நன்றி / நன்றியுணர்வு" },
  { keys:["yes","okay","ok","sure","ஆம்","சரி","ஆமாம்"], pose:"yes", en:"Positive / yes", ta:"நேர்மறை / ஆம்" },
  { keys:["no","not","cannot","இல்லை","முடியாது","வேண்டாம்"], pose:"no", en:"Negative / no", ta:"மறுப்பு / இல்லை" },
  { keys:["help","save me","உதவி","காப்பாற்று","காப்பாற்றுங்கள்"], pose:"help", en:"Asking for help", ta:"உதவி கோருகிறது" },
  { keys:["love","lovely","heart","அன்பு","காதல்","பிடிக்கும்"], pose:"love", en:"Love / affection", ta:"அன்பு / பாசம்" },
  { keys:["happy","happiness","great","awesome","good","சந்தோஷம்","மகிழ்ச்சி","நல்லா","சூப்பர்"], pose:"happy", en:"Happy / positive", ta:"மகிழ்ச்சி / நேர்மறை" },
  { keys:["sad","sadness","வருத்தம்","சோகம்","கவலை"], pose:"sad", en:"Sad / emotional", ta:"சோகம் / உணர்ச்சி" },
  { keys:["angry","anger","mad","கோபம்","கோபமாக"], pose:"angry", en:"Angry / upset", ta:"கோபம் / வருத்தம்" },
  { keys:["sorry","apologize","மன்னிக்கவும்","சாரி"], pose:"sorry", en:"Apology / sorry", ta:"மன்னிப்பு / சாரி" },
  { keys:["please","தயவு செய்து","தயவுசெய்து"], pose:"please", en:"Polite request", ta:"மரியாதையான கோரிக்கை" },
  { keys:["bye","goodbye","see you","பிரியாவிடை","போகிறேன்","செல்கிறேன்"], pose:"greeting", en:"Farewell / goodbye", ta:"விடைபெறுதல்" },
  { keys:["food","eat","hungry","சாப்பாடு","சாப்பிட","பசிக்கிறது"], pose:"happy", en:"Food / eating", ta:"உணவு / சாப்பிடுதல்" },
  { keys:["water","thirsty","தண்ணீர்","தாகம்"], pose:"please", en:"Water / thirst", ta:"தண்ணீர் / தாகம்" },
  { keys:["doctor","hospital","மருத்துவர்","மருத்துவமனை"], pose:"help", en:"Medical / hospital", ta:"மருத்துவம் / மருத்துவமனை" },
  { keys:["danger","emergency","ஆபத்து","அவசரம்"], pose:"help", en:"Warning / emergency", ta:"எச்சரிக்கை / அவசரம்" },
  { keys:["congratulations","congrats","வாழ்த்துக்கள்","வாழ்த்துகள்"], pose:"happy", en:"Celebration / congratulations", ta:"வாழ்த்து / கொண்டாட்டம்" }
];

function getSpeechExpression(text){
  const value=String(text||"").toLowerCase().trim();
  if(!value) return {pose:"idle",en:"Ready to express your words",ta:"உங்கள் வார்த்தைகளை வெளிப்படுத்த தயாராக உள்ளது"};
  return SPEECH_EXPRESSIONS.find(item=>item.keys.some(key=>value.includes(key.toLowerCase()))) || {pose:"talk",en:"Speaking your message",ta:"உங்கள் செய்தியைப் பேசுகிறது"};
}

function updateSpeechAvatar(text, animate=false){
  const avatar=$("#speechAvatar"), face=$("#avatarFace"), expression=$("#avatarExpression");
  if(!avatar||!face||!expression) return;
  const result=getSpeechExpression(text);
  const poses=["idle","greeting","thanks","yes","no","help","love","happy","sad","angry","sorry","please","talk"];
  poses.forEach(p=>face.classList.remove(`pose-${p}`));
  face.classList.add(`pose-${result.pose}`);
  expression.textContent=uiLanguage==="ta-IN"?result.ta:result.en;
  if(animate){
    avatar.classList.remove("expressing");
    void avatar.offsetWidth;
    avatar.classList.add("expressing");
    clearTimeout(updateSpeechAvatar.timer);
    updateSpeechAvatar.timer=setTimeout(()=>avatar.classList.remove("expressing"),2200);
  }
}

function updateSpokenText(text, finalResult=false) {
  const value = String(text || "").trim();
  if (!value) return;
  spokenText = value;
  $("#spokenText").textContent = value;
  updateSpeechAvatar(value, false);
  $("#voiceDisplay").classList.toggle("listening", !finalResult);
}

Speech.onResult((text, finalResult) => {
  updateSpokenText(text, finalResult);
  if (finalResult) {
    if (window.Avatar3D) window.Avatar3D.playForSpeech(spokenText);
    if (containsHi(spokenText)) playEmergencySound();
    $("#speechStatus").textContent = uiLanguage==="ta-IN" ? "தயார்" : "Ready";
    $("#micBtnText").textContent = uiLanguage==="ta-IN" ? "பேசத் தொடங்குங்கள்" : "Start Speaking";
    addInteraction({type:"voice", text:spokenText, timestamp:new Date().toISOString(), connectionType:"voice", language:uiLanguage});
  }
});

Speech.onState(state => {
  const status = $("#speechStatus");
  const btnText = $("#micBtnText");
  if (state === "listening") {
    status.textContent = "Listening…";
    btnText.textContent = "Stop Speaking";
    $("#voiceDisplay").classList.add("listening");
  } else if (state === "ready") {
    status.textContent = "Ready";
    btnText.textContent = "Start Speaking";
    $("#voiceDisplay").classList.remove("listening");
  } else {
    status.textContent = "Check microphone";
    btnText.textContent = "Start Speaking";
  }
});

Speech.onError(message => {
  $("#speechStatus").textContent = "Error";
  $("#micBtnText").textContent = "Start Speaking";
  $("#voiceDisplay").classList.remove("listening");
  toast(message);
});

function startVoiceInput() {
  if (!Speech.speechRecognitionSupported()) {
    toast("Voice recognition is not supported. Use Chrome or Edge.");
    return;
  }
  Speech.startRecognition();
}


function loadJson(key, fallback){ try { const x=JSON.parse(localStorage.getItem(key)); return x ?? fallback; } catch { return fallback; } }
function save(){ localStorage.setItem(HISTORY_KEY,JSON.stringify(history)); localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings)); }
function toast(message){ const el=$("#toast"); el.textContent=message; el.classList.add("show"); clearTimeout(toast.timer); toast.timer=setTimeout(()=>el.classList.remove("show"),1800); }
function timeText(iso){ return new Date(iso).toLocaleTimeString([], {hour:"numeric",minute:"2-digit"}); }
function sourceLabel(type){
  const labels={bluetooth:uiLanguage==="ta-IN"?"ப்ளூடூத்":"Bluetooth",demo:uiLanguage==="ta-IN"?"டெமோ":"Demo",voice:uiLanguage==="ta-IN"?"குரல்":"Voice"};
  return labels[type] || type || "—";
}

function navigate(page){
  $$(".page").forEach(p=>p.classList.toggle("active",p.id===`page-${page}`));
  $$(".nav-item").forEach(n=>n.classList.toggle("active",n.dataset.page===page));
  $("#pageKicker").textContent = ({dashboard:"AI Communication Assistant",connect:"Choose a connection",history:"Local gesture activity",analytics:"Recognition insights",settings:"Preferences & data",handspeak:"Handspeak fingerspelling"})[page] || "";
  window.scrollTo({top:0,behavior:"smooth"});
}
$$("[data-page]").forEach(el=>el.addEventListener("click",()=>navigate(el.dataset.page)));

function renderGestures(){
  const grid=$("#gestureGrid"), select=$("#demoGesture");
  grid.innerHTML=""; select.innerHTML="";
  Object.entries(GESTURES).forEach(([key,g])=>{
    const card=document.createElement("button"); card.className="gesture-card";
    card.innerHTML=`<div class="g-icon" style="background:${key.includes("THANK")||key.includes("GOOD")?"#dce8ff":"#eadbff"}">${g.icon}</div><strong>${textForGesture(g)}</strong><p>${descriptionForGesture(g)}</p>`;
    card.addEventListener("click",()=>receiveGesture({gesture:key,confidence:randomConfidence(),timestamp:new Date().toISOString(),connectionType:"demo"}));
    grid.appendChild(card);
    const opt=document.createElement("option"); opt.value=key; opt.textContent=textForGesture(g); select.appendChild(opt);
  });
}
function randomConfidence(){return Math.round((94+Math.random()*5.5)*10)/10}

function addInteraction(entry){
  history.unshift({...entry});
  history=history.slice(0,200);
  save();
  renderRecent(); renderHistory(); renderAnalytics(); renderStats();
}


function renderLiveGesture(info, connectionType="bluetooth", connected=true){
  const icon=$("#liveGestureIcon");
  const text=$("#liveGestureText");
  const detail=$("#liveGestureDetail");
  const status=$("#liveGestureConnection");
  const statusWrap=status?.parentElement;
  const banner=$("#liveGestureBanner");
  if(!icon||!text||!detail||!status||!statusWrap||!banner) return;

  icon.textContent=info?.icon || "❔";
  text.textContent=info ? textForGesture(info) : "READY";
  detail.textContent=info
    ? `${textForGesture(info)} detected from your Smart Glove.`
    : "Connect your Smart Glove and bend a finger to detect a message.";
  status.textContent=connected
    ? `${sourceLabel(connectionType)} connected`
    : "Waiting for Bluetooth";
  statusWrap.classList.toggle("connected",connected);

  banner.classList.remove("detected");
  if(info){
    void banner.offsetWidth;
    banner.classList.add("detected");
  }
}

function renderLiveConnection(connected, deviceName="Smart Glove"){
  const status=$("#liveGestureConnection");
  const statusWrap=status?.parentElement;
  if(!status||!statusWrap) return;
  status.textContent=connected ? `${deviceName} connected` : "Waiting for Bluetooth";
  statusWrap.classList.toggle("connected",connected);
}

function receiveGesture(payload){
  if(!settings.autoRecognition && payload.connectionType!=="demo"){
    toast("Auto recognition is disabled.");
    return;
  }

  const parsed = parseIncomingData(payload?.raw ?? payload);
  const confidence=Math.max(0,Math.min(100,Number(parsed.confidence)||0));

  if(confidence < Number(settings.confidenceThreshold)){
    toast(`Ignored: confidence ${confidence.toFixed(1)}% is below threshold.`);
    return;
  }

  const normalized=normalizeGesture(parsed.gesture);
  const info=getGestureInfo(normalized);

  if(normalized==="UNKNOWN"){
    toast("Unknown gesture received from Smart Glove.");
    return;
  }

  current={
    gesture:normalized,
    confidence,
    timestamp:parsed.timestamp || new Date().toISOString(),
    connectionType:payload.connectionType || "demo"
  };

  addInteraction({...current,type:"gesture"});
  renderCurrent();

  $("#currentGestureCard").classList.remove("gesture-pulse");
  void $("#currentGestureCard").offsetWidth;
  $("#currentGestureCard").classList.add("gesture-pulse");

  renderLiveGesture(info,current.connectionType,true);

  if (window.Avatar3D) {
    if (normalized === "HELLO" || normalized === "HI") window.Avatar3D.play("hello", "Hello — waving");
    else if (normalized === "WATER") window.Avatar3D.play("water", "Open the bottle");
    else if (normalized === "EMERGENCY") window.Avatar3D.play("emergency", "Run quickly");
  }
  if(normalized === "HI") playEmergencySound();

  toast(`${info.label} recognized`);

  if(settings.autoSpeech){
    Speech.speak(textForGesture(info));
  }
}

function renderCurrent(){
  const info=getGestureInfo(current.gesture);
  $("#gestureSymbol").textContent=info.icon; $("#currentGesture").textContent=textForGesture(info);
  $("#gestureMessage").textContent=descriptionForGesture(info)==="Gesture not recognized"?"Gesture could not be mapped":descriptionForGesture(info);
  $("#confidenceValue").textContent=`${current.confidence.toFixed(1)}%`; $("#confidenceBar").style.width=`${current.confidence}%`;
  $("#gestureTimestamp").textContent=timeText(current.timestamp); $("#gestureSource").textContent=sourceLabel(current.connectionType);
}
function renderRecent(){
  const list=$("#recentList"), rows=history.slice(0,5);
  if(!rows.length){list.innerHTML='<div class="recent-row"><div class="recent-icon">✦</div><div><strong>No interactions yet</strong><small>Use the glove or voice input to begin.</small></div></div>';return;}
  list.innerHTML=rows.map(r=>{
    if(r.type==="voice"){
      return `<div class="recent-row"><div class="recent-icon">🎙</div><div><strong>${escapeHtml(r.text||"Voice input")}</strong><small>${timeText(r.timestamp)} · Voice</small></div><span class="source-tag">Voice</span></div>`;
    }
    const g=getGestureInfo(r.gesture);
    return `<div class="recent-row"><div class="recent-icon">${g.icon}</div><div><strong>${escapeHtml(textForGesture(g))}</strong><small>${timeText(r.timestamp)}</small></div><span class="recent-conf">${Number(r.confidence).toFixed(1)}%</span><span class="source-tag">${sourceLabel(r.connectionType)}</span></div>`;
  }).join("");
}
function escapeHtml(value){return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function stats(){
  const gestures=history.filter(x=>x.type!=="voice");
  const total=gestures.length, avg=total?gestures.reduce((a,x)=>a+Number(x.confidence||0),0)/total:0;
  const bt=gestures.filter(x=>x.connectionType==="bluetooth").length;
  return {total,avg,bt};
}
function renderStats(){
  const s=stats(), cards=[
    ["✦","Total Gestures",s.total],["✓","Recognition Accuracy",s.total?`${s.avg.toFixed(1)}%`:"98.7%"],["◎","Average Confidence",s.total?`${s.avg.toFixed(1)}%`:"97.8%"],
    ["◷","Average Response","128 ms"],["ᛒ","Bluetooth Messages",s.bt]
  ];
  $("#statsGrid").innerHTML=cards.map(c=>`<div class="stat-card"><div class="stat-icon">${c[0]}</div><div><small>${c[1]}</small><strong>${c[2]}</strong></div></div>`).join("");
}
function renderHistory(){
  const q=$("#historySearch").value.trim().toUpperCase(), filter=$("#historyFilter").value;
  const rows=history.filter(r=>{
    const source=r.type==="voice"?"voice":r.connectionType;
    const label=r.type==="voice"?(r.text||"Voice input"):getGestureInfo(r.gesture).label;
    return (filter==="all"||source===filter) && (!q||label.toUpperCase().includes(q));
  });
  $("#historyTable").innerHTML=rows.length?rows.map(r=>{
    if(r.type==="voice"){
      return `<tr><td><strong>🎙 ${escapeHtml(r.text||"Voice input")}</strong></td><td>—</td><td>${new Date(r.timestamp).toLocaleString()}</td><td>Voice</td></tr>`;
    }
    return `<tr><td><strong>${escapeHtml(textForGesture(getGestureInfo(r.gesture)))}</strong></td><td>${Number(r.confidence).toFixed(1)}%</td><td>${new Date(r.timestamp).toLocaleString()}</td><td>${sourceLabel(r.connectionType)}</td></tr>`;
  }).join(""):`<tr><td colspan="4">No matching interactions.</td></tr>`;
}
function renderAnalytics(){
  const s=stats(), counts={}; history.filter(r=>r.type!=="voice").forEach(r=>counts[r.gesture]=(counts[r.gesture]||0)+1);
  const ordered=Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,8), max=ordered[0]?.[1]||1;
  $("#frequencyChart").innerHTML=ordered.length?ordered.map(([k,v])=>`<div class="bar-row"><span>${getGestureInfo(k).label}</span><div class="bar-track"><div class="bar-fill" style="width:${v/max*100}%"></div></div><b>${v}</b></div>`).join(""):'<p style="color:var(--muted);font-size:12px">No data yet.</p>';
  const avg=s.avg, deg=Math.round(avg*3.6); $("#confidenceRing").style.background=`conic-gradient(var(--purple) 0deg,var(--blue) ${deg}deg,#eeeaf3 ${deg}deg)`;
  $("#ringValue").textContent=`${avg.toFixed(1)}%`;
  $("#analyticsStats").innerHTML=[["✦","Total gestures",s.total],["★","Most common",ordered[0]?textForGesture(getGestureInfo(ordered[0][0])):"—"],["◎","Average confidence",`${s.avg.toFixed(1)}%`],["◷","Average response","128 ms"]].map(c=>`<div class="stat-card"><div class="stat-icon">${c[0]}</div><div><small>${c[1]}</small><strong>${c[2]}</strong></div></div>`).join("");
}

function setHardwareStatus(type,status,meta={}){
  const pill=$("#statusPill"), text=$("#statusText");
  pill.classList.remove("connected","demo");
  if(status==="connected"){pill.classList.add("connected");text.textContent=type==="bluetooth"?"Bluetooth Connected":"Bluetooth Connected";$("#connectionBadge").textContent="Connected";$("#connectionType").textContent=sourceLabel(type);$("#deviceName").textContent=meta.deviceName||"Smart Glove";$("#ipAddress").textContent=meta.url||"—";}
  else {text.textContent="Disconnected";$("#connectionBadge").textContent="Offline";$("#connectionType").textContent="None";$("#deviceName").textContent="Not connected";$("#ipAddress").textContent="—";}
}
renderLiveGesture(getGestureInfo(current.gesture),current.connectionType,false);

BluetoothManager.onMessage(data=>receiveGesture({
  raw: data,
  connectionType: "bluetooth"
}));
BluetoothManager.onStatus(s=>{
  if(s.status==="connected"){
    setHardwareStatus("bluetooth","connected",s);
    renderLiveConnection(true,s.deviceName || "Smart Glove");
    $("#bluetoothMessage").textContent="Connected. Bend a finger to send a gesture.";
  } else {
    setHardwareStatus("bluetooth","disconnected");
    renderLiveConnection(false);
    $("#bluetoothMessage").textContent=s.status==="connecting"?"Connecting...":"Disconnected.";
  }
});
BluetoothManager.onError(e=>{ $("#bluetoothMessage").textContent=e.message; toast(e.message); });

$("#scanBluetoothBtn").addEventListener("click",async()=>{try{await BluetoothManager.connect()}catch{}});
$("#disconnectBtn").addEventListener("click",()=>{BluetoothManager.disconnect();setHardwareStatus("none","disconnected");});
$("#speakBtn").addEventListener("click",()=>Speech.speak(textForGesture(getGestureInfo(current.gesture))));
$("#quickSpeak").addEventListener("click",()=>Speech.speak(textForGesture(getGestureInfo(current.gesture))));
$("#micBtn").addEventListener("click", startVoiceInput);
$("#speakVoiceBtn").addEventListener("click", () => {
  if (!spokenText.trim()) { toast("Say something first."); return; }
  updateSpeechAvatar(spokenText, true);
  Speech.speak(spokenText);
});
$("#copyVoiceBtn").addEventListener("click", async () => {
  if (!spokenText.trim()) { toast("There is no spoken text to copy."); return; }
  try { await navigator.clipboard.writeText(spokenText); toast("Copied!"); }
  catch { toast("Clipboard access is unavailable."); }
});

$("#copyBtn").addEventListener("click",async()=>{try{await navigator.clipboard.writeText(getGestureInfo(current.gesture).label);toast("Copied!")}catch{toast("Clipboard access is unavailable.")}});
$("#simulateBtn").addEventListener("click",()=>receiveGesture({gesture:$("#demoGesture").value,confidence:randomConfidence(),timestamp:new Date().toISOString(),connectionType:"demo"}));
$("#notificationBtn").addEventListener("click",()=>toast(history.length?`${history.length} gesture${history.length===1?"":"s"} stored locally.`:"No gesture notifications."));
$("#historySearch").addEventListener("input",renderHistory);$("#historyFilter").addEventListener("change",renderHistory);

function clearHistory(){history=[];save();renderRecent();renderStats();renderHistory();renderAnalytics();toast("Gesture history cleared.");}
$("#clearHistoryBtn").addEventListener("click",clearHistory);$("#clearHistorySettingsBtn").addEventListener("click",clearHistory);

function download(name,type,data){const blob=new Blob([data],{type});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500);}
$("#exportJsonBtn").addEventListener("click",()=>download("smart-glove-history.json","application/json",JSON.stringify(history,null,2)));
$("#exportCsvBtn").addEventListener("click",()=>{const rows=[["gesture","confidence","timestamp","connectionType"],...history.map(x=>[x.gesture,x.confidence,x.timestamp,x.connectionType])];download("smart-glove-history.csv","text/csv",rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(",")).join("\n"));});

$("#sosBtn").addEventListener("click",()=>$("#sosModal").hidden=false);$("#cancelSos").addEventListener("click",()=>$("#sosModal").hidden=true);
$("#activateSos").addEventListener("click",()=>{sendSOS();$("#sosModal").hidden=true});
function sendSOS(){ toast("SOS prepared. No emergency service was contacted."); /* Future ESP32 BLE/Bluetooth transmission goes here. */ }

function bindSettings(){
  $("#autoRecognition").checked=settings.autoRecognition;$("#autoSpeech").checked=settings.autoSpeech;$("#confidenceThreshold").value=settings.confidenceThreshold;$("#thresholdValue").textContent=`${settings.confidenceThreshold}%`;
  $("#speechRate").value=settings.rate;$("#rateValue").textContent=`${Number(settings.rate).toFixed(1)}×`;$("#speechVolume").value=settings.volume;$("#volumeValue").textContent=`${Math.round(settings.volume*100)}%`;
  $("#connectionPreference").value=settings.connectionPreference;$("#darkMode").checked=!settings.lightMode;$("#pastelMode").checked=settings.pastelMode;
  document.body.classList.toggle("dark", !settings.lightMode);
  $("#autoRecognition").addEventListener("change",e=>{settings.autoRecognition=e.target.checked;save()});
  $("#autoSpeech").addEventListener("change",e=>{settings.autoSpeech=e.target.checked;save()});
  $("#confidenceThreshold").addEventListener("input",e=>{settings.confidenceThreshold=Number(e.target.value);$("#thresholdValue").textContent=`${e.target.value}%`;save()});
  $("#speechRate").addEventListener("input",e=>{settings.rate=Number(e.target.value);Speech.state.rate=settings.rate;$("#rateValue").textContent=`${settings.rate.toFixed(1)}×`;save()});
  $("#speechVolume").addEventListener("input",e=>{settings.volume=Number(e.target.value);Speech.state.volume=settings.volume;$("#volumeValue").textContent=`${Math.round(settings.volume*100)}%`;save()});
  $("#connectionPreference").addEventListener("change",e=>{settings.connectionPreference=e.target.value;save()});
  $("#darkMode").addEventListener("change",e=>{settings.lightMode=!e.target.checked;document.body.classList.toggle("dark",e.target.checked);$("#themeToggle").textContent=e.target.checked?"☀️":"🌙";save()});
  $("#pastelMode").addEventListener("change",e=>{settings.pastelMode=e.target.checked;document.body.classList.toggle("pastel-off",!e.target.checked);save()});
  const lang=$("#speechLanguage");[["en-IN","English"],["ta-IN","தமிழ்"]].forEach(([value,label])=>{const o=document.createElement("option");o.value=value;o.textContent=label;lang.appendChild(o)});lang.value=uiLanguage;
  lang.addEventListener("change",e=>setLanguage(e.target.value));
  Speech.state.rate=settings.rate;Speech.state.volume=settings.volume;Speech.state.language=settings.language;Speech.state.autoSpeech=settings.autoSpeech;
  Speech.populateVoiceSelect($("#speechVoice"));$("#speechVoice").value=settings.voice;
  $("#speechVoice").addEventListener("change",e=>{settings.voice=e.target.value;Speech.state.voice=e.target.value;save()});
}
$("#topLanguage").addEventListener("change",e=>setLanguage(e.target.value));
$("#themeToggle").addEventListener("click",()=>{
  const dark=!document.body.classList.contains("dark");
  document.body.classList.toggle("dark",dark);
  settings.lightMode=!dark;
  $("#darkMode").checked=dark;
  $("#themeToggle").textContent=dark?"☀️":"🌙";
  save();
});
renderGestures();renderCurrent();renderRecent();renderStats();renderHistory();renderAnalytics();bindSettings();applyLanguage();
setInterval(()=>{ if(current.connectionType==="demo" && history.length===0) renderCurrent(); },1000);
