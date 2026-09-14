/* Gesture dictionary: add new hardware values here. */
const GESTURES = {
  HELLO: { label:"HELLO", taLabel:"வணக்கம்", description:"Friendly greeting", taDescription:"அன்பான வாழ்த்து", icon:"👋", color:"purple" },
  HI: { label:"HI", taLabel:"வணக்கம்", description:"Short greeting", taDescription:"சுருக்கமான வாழ்த்து", icon:"👋", color:"blue" },
  WATER: { label:"OPEN BOTTLE", taLabel:"பாட்டிலை திற", description:"Open the bottle", taDescription:"பாட்டிலை திறக்கவும்", icon:"🧴", color:"blue" },
  EMERGENCY: { label:"RUN QUICKLY", taLabel:"விரைவாக ஓடு", description:"Run quickly", taDescription:"விரைவாக ஓடவும்", icon:"🏃", color:"yellow" },
  DID_YOU_EAT: { label:"DID YOU EAT", taLabel:"சாப்பிட்டீங்களா", description:"Asking if someone has eaten", taDescription:"சாப்பிட்டீர்களா என்று கேட்கிறது", icon:"🍽️", color:"green" },
  THANK_YOU: { label:"THANK YOU", taLabel:"நன்றி", description:"Express gratitude", taDescription:"நன்றியை தெரிவிக்கிறது", icon:"🙏", color:"blue" },
  YES: { label:"YES", taLabel:"ஆம்", description:"Positive response", taDescription:"நேர்மறையான பதில்", icon:"👍", color:"green" },
  NO: { label:"NO", taLabel:"இல்லை", description:"Negative response", taDescription:"எதிர்மறையான பதில்", icon:"👎", color:"pink" },
  HELP: { label:"HELP", taLabel:"உதவி", description:"Request assistance", taDescription:"உதவி கோரிக்கை", icon:"🆘", color:"yellow" },
  PLEASE: { label:"PLEASE", taLabel:"தயவுசெய்து", description:"Polite request", taDescription:"மரியாதையான கோரிக்கை", icon:"🤲", color:"purple" },
  GOOD_MORNING: { label:"GOOD MORNING", taLabel:"காலை வணக்கம்", description:"Morning greeting", taDescription:"காலை வாழ்த்து", icon:"🌅", color:"blue" },
  GOODBYE: { label:"GOODBYE", taLabel:"பிரியாவிடை", description:"Friendly farewell", taDescription:"அன்பான விடைபெறல்", icon:"👋", color:"green" }
};

function normalizeGesture(value) {
  const key = String(value ?? "").trim().toUpperCase().replace(/[\s-]+/g, "_");
  return GESTURES[key] ? key : "UNKNOWN";
}
function getGestureInfo(value) {
  const key = normalizeGesture(value);
  return GESTURES[key] || { label:"UNKNOWN GESTURE", description:"Gesture not recognized", icon:"❔", color:"purple" };
}
function parseIncomingData(raw) {
  try {
    const text = typeof raw === "string" ? raw.trim() : raw;
    const data = typeof text === "string" && (text.startsWith("{") || text.startsWith("[")) ? JSON.parse(text) : { gesture:text };
    return {
      gesture: normalizeGesture(data.gesture),
      confidence: Number.isFinite(Number(data.confidence)) ? Number(data.confidence) : 95,
      timestamp: data.timestamp || new Date().toISOString()
    };
  } catch {
    return { gesture:"UNKNOWN", confidence:0, timestamp:new Date().toISOString() };
  }
}