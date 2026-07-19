import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import mallowSheet from "./assets/characters/mallow-animated.png";
import mimoSheet from "./assets/characters/mimo-animated.png";
import pingoSheet from "./assets/characters/pingo-animated.png";
import rexoSheet from "./assets/characters/rexo-animated.png";
import gardenScene from "./assets/scenes/garden.jpg";
import nightScene from "./assets/scenes/night.jpg";
import roomScene from "./assets/scenes/room.jpg";
import seasideScene from "./assets/scenes/seaside.jpg";
import "./styles.css";

type Action = "feed" | "play" | "clean" | "sleep" | "drive" | "fly";
type Mood = "happy" | "okay" | "sad" | "sleeping";
type Character = "mimo" | "rexo" | "mallow" | "pingo";
type Scene = "room" | "garden" | "night" | "seaside";
type ChatMessage = { sender: "pal" | "you"; text: string; at: number };

const CHARACTERS: Record<Character, { name: string; species: string; greeting: string }> = {
  mimo: { name: "Mimo", species: "forest cat", greeting: "กลับมาแล้ว! วันนี้เป็นยังไงบ้าง?" },
  rexo: { name: "Rexo", species: "tiny dinosaur", greeting: "โฮกเบา ๆ! Rexo พร้อมผจญภัยไปกับคุณแล้ว" },
  mallow: { name: "Mallow", species: "soft rabbit", greeting: "Mallow มาแล้ว วันนี้ขอนั่งฟังเรื่องของคุณนะ" },
  pingo: { name: "Pingo", species: "little penguin", greeting: "Pingo พร้อมเดินเตาะแตะเป็นเพื่อนคุณแล้ว" },
};
const SCENES: Scene[] = ["room", "garden", "night", "seaside"];
const CHARACTER_SHEETS: Record<Character, string> = {
  mimo: mimoSheet,
  rexo: rexoSheet,
  mallow: mallowSheet,
  pingo: pingoSheet,
};
const SCENE_ART: Record<Scene, string> = {
  room: roomScene,
  garden: gardenScene,
  night: nightScene,
  seaside: seasideScene,
};

type PetState = {
  fullness: number;
  joy: number;
  clean: number;
  energy: number;
  bornAt: number;
  lastUpdatedAt: number;
  sleeping: boolean;
  muted: boolean;
  lastChatAt: number;
  lastNudgeAt: number;
  conversation: ChatMessage[];
  character: Character;
  customName: string;
  scene: Scene;
};

const SAVE_KEY = "mimo-save-v1";
const pet = document.querySelector<HTMLElement>("#pet")!;

const clamp = (value: number) => Math.max(0, Math.min(100, value));

function freshState(): PetState {
  const now = Date.now();
  return {
    fullness: 82,
    joy: 76,
    clean: 88,
    energy: 70,
    bornAt: now,
    lastUpdatedAt: now,
    sleeping: false,
    muted: false,
    lastChatAt: 0,
    lastNudgeAt: 0,
    conversation: [],
    character: "mimo",
    customName: "",
    scene: "room",
  };
}

function loadState(): PetState {
  try {
    const saved = localStorage.getItem(SAVE_KEY);
    return saved ? { ...freshState(), ...JSON.parse(saved) } : freshState();
  } catch {
    return freshState();
  }
}

let state = loadState();
let reaction: Action | null = null;
let reactionUntil = 0;
let trayFrame = 0;
let animationFrame = 0;

function petName(): string {
  return state.customName.trim() || CHARACTERS[state.character].name;
}

function advanceState(now = Date.now()): void {
  const elapsedHours = Math.min((now - state.lastUpdatedAt) / 3_600_000, 48);
  if (elapsedHours <= 0) return;

  state.fullness = clamp(state.fullness - elapsedHours * 3.5);
  state.clean = clamp(state.clean - elapsedHours * 2.4);

  if (state.sleeping) {
    state.energy = clamp(state.energy + elapsedHours * 18);
    state.joy = clamp(state.joy - elapsedHours * 0.5);
  } else {
    state.energy = clamp(state.energy - elapsedHours * 2.8);
    state.joy = clamp(state.joy - elapsedHours * 1.8);
  }

  state.lastUpdatedAt = now;
}

function saveState(): void {
  state.lastUpdatedAt = Date.now();
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

function mood(): Mood {
  if (state.sleeping) return "sleeping";
  const average = (state.fullness + state.joy + state.clean + state.energy) / 4;
  if (average >= 68) return "happy";
  if (average >= 38) return "okay";
  return "sad";
}

function thought(): string {
  if (state.sleeping) return "คร่อก... ฝันดีจัง";
  if (reaction === "feed") return "อร่อยมาก!";
  if (reaction === "play") return "สนุกจัง เล่นอีก!";
  if (reaction === "clean") return "หอมสะอาดแล้ว";
  if (reaction === "drive") return "ออกไปเที่ยวกัน!";
  if (reaction === "fly") return "บินขึ้นฟ้าแล้ว!";
  if (state.energy < 20) return "หมดแรงแล้ว...";
  if (state.energy < 38) return "หาวว... เริ่มง่วงแล้ว";
  if (state.fullness < 28) return "ท้องร้องจ๊อก ๆ";
  if (state.clean < 28) return "ตัวมอมแมมแล้ว";
  if (state.joy < 30) return "มาเล่นด้วยกันหน่อยนะ";
  if (state.joy > 82) return "วันนี้ร่าเริงสุด ๆ!";
  if (state.scene === "garden") return "ลมเย็นสบายจัง";
  if (state.scene === "night") return "ดูดาวด้วยกันไหม?";
  if (state.scene === "seaside") return "ได้ยินเสียงคลื่นด้วย";
  return "อยู่ด้วยกันตรงนี้นะ";
}

function ageInDays(): number {
  return Math.floor((Date.now() - state.bornAt) / 86_400_000) + 1;
}

function petStage(): string {
  const ageHours = (Date.now() - state.bornAt) / 3_600_000;
  if (ageHours < 2) return "TINY PAL";
  if (ageHours < 24) return "CURIOUS PAL";
  return "GROWN PAL";
}

function playSound(action: Action | "chat"): void {
  if (state.muted) return;
  const AudioContextClass = window.AudioContext;
  const audio = new AudioContextClass();
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  const frequency = action === "feed" ? 440 : action === "play" ? 620 : action === "clean" ? 520 : action === "drive" ? 380 : action === "fly" ? 760 : action === "chat" ? 700 : 300;

  oscillator.type = "square";
  oscillator.frequency.setValueAtTime(frequency, audio.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.18, audio.currentTime + 0.08);
  gain.gain.setValueAtTime(0.035, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.12);
  oscillator.connect(gain);
  gain.connect(audio.destination);
  oscillator.start();
  oscillator.stop(audio.currentTime + 0.12);
  oscillator.addEventListener("ended", () => void audio.close(), { once: true });
}

function applyAction(action: Action): void {
  advanceState();
  reaction = action;
  reactionUntil = Date.now() + (action === "drive" || action === "fly" ? 4_000 : 1_500);

  if (action === "feed") {
    state.fullness = clamp(state.fullness + 26);
    state.clean = clamp(state.clean - 4);
  } else if (action === "play") {
    state.joy = clamp(state.joy + 24);
    state.energy = clamp(state.energy - 11);
    state.fullness = clamp(state.fullness - 4);
  } else if (action === "clean") {
    state.clean = clamp(state.clean + 34);
    state.joy = clamp(state.joy + 3);
  } else if (action === "drive") {
    state.joy = clamp(state.joy + 18);
    state.energy = clamp(state.energy - 9);
    state.fullness = clamp(state.fullness - 3);
    state.sleeping = false;
  } else if (action === "fly") {
    state.joy = clamp(state.joy + 22);
    state.energy = clamp(state.energy - 12);
    state.fullness = clamp(state.fullness - 4);
    state.sleeping = false;
  } else {
    state.sleeping = !state.sleeping;
    reaction = null;
  }

  saveState();
  playSound(action);
  render();
}

function changeScene(scene: Scene): void {
  state.scene = scene;
  state.joy = clamp(state.joy + 2);
  saveState();
  render();
}

function cycleScene(): void {
  const currentIndex = SCENES.indexOf(state.scene);
  changeScene(SCENES[(currentIndex + 1) % SCENES.length]);
}

function isThai(text: string): boolean {
  return /[\u0E00-\u0E7F]/.test(text);
}

function contextualReply(input: string): string {
  const text = input.trim().toLowerCase();
  const thai = isThai(input);
  const hour = new Date().getHours();

  if (/เหงา|โดดเดี่ยว|lonely|alone/.test(text)) {
    return thai ? "เราอยู่ตรงนี้นะ เล่าให้ฟังได้เลย วันนี้เกิดอะไรขึ้นบ้าง?" : "I'm right here. Tell me one thing about your day.";
  }
  if (/เครียด|กังวล|งาน|เหนื่อย|stress|worried|work|tired/.test(text)) {
    return thai ? "พักกับเราสักนาทีก็ได้นะ หายใจช้า ๆ แล้วค่อยเริ่มใหม่ทีละอย่าง" : "Stay with me for a minute. One slow breath, then one small next step.";
  }
  if (/ดีใจ|สำเร็จ|เสร็จ|happy|done|finished|win/.test(text)) {
    return thai ? "เก่งมาก! เราขอกระโดดดีใจด้วยหนึ่งที วันนี้ต้องฉลองด้วยอะไรดี?" : "You did it! I'm doing one tiny victory bounce for you.";
  }
  if (/หิว|กิน|อาหาร|hungry|food|eat/.test(text)) {
    return state.fullness < 45
      ? (thai ? "พูดแล้วท้องร้องเลย เราก็เริ่มหิวเหมือนกัน" : "Now my tummy is rumbling too.")
      : (thai ? "เราอิ่มแล้ว แต่พร้อมนั่งเป็นเพื่อนตอนคุณหาอะไรกินนะ" : "I'm full, but I'll keep you company while you find a snack.");
  }
  if (/นอน|ง่วง|ฝันดี|sleep|bed|good night/.test(text)) {
    return thai ? "ฝันดีนะ พรุ่งนี้กลับมาทักเราอีกล่ะ" : "Sleep well. Come say hi again tomorrow.";
  }
  if (/สวัสดี|หวัดดี|hello|hi|hey/.test(text)) {
    return thai ? "สวัสดี! ดีใจที่แวะมาหา วันนี้เป็นยังไงบ้าง?" : "Hi! I'm glad you stopped by. How is your day going?";
  }
  if (/รัก|ชอบ|love|cute/.test(text)) {
    return thai ? "เราก็ชอบเวลาที่คุณแวะมาคุยด้วยนะ" : "I like our little chats too.";
  }
  if (text.endsWith("?") || /ไหม|หรือเปล่า|อะไร|ทำไม|ยังไง/.test(text)) {
    return thai ? "เราอาจไม่รู้ทุกอย่าง แต่ช่วยคิดเป็นเพื่อนได้นะ คุณอยากเริ่มจากตรงไหน?" : "I may not know everything, but I can think beside you. Where should we start?";
  }
  if (state.energy < 28) return thai ? "เราเริ่มง่วงนิดหน่อย แต่ยังฟังอยู่นะ" : "I'm getting sleepy, but I'm still listening.";
  if (state.fullness < 28) return thai ? "ฟังอยู่นะ ถ้าได้ขนมสักชิ้นจะตั้งใจฟังมากขึ้นอีก" : "I'm listening. A tiny snack might help me focus.";
  if (hour >= 22 || hour < 5) return thai ? "ดึกแล้วนะ ขอบคุณที่มานั่งคุยเป็นเพื่อนกัน" : "It's late. I'm glad we're keeping each other company.";
  return thai ? "อื้ม เราฟังอยู่ แล้วเรื่องนี้ทำให้คุณรู้สึกยังไงบ้าง?" : "I'm listening. How did that make you feel?";
}

function proactivePrompt(): string {
  const hour = new Date().getHours();
  if (state.lastChatAt > 0 && Date.now() - state.lastChatAt > 24 * 60 * 60_000) return "ไม่ได้คุยกันตั้งนาน ช่วงนี้คุณเป็นยังไงบ้าง?";
  if (state.fullness < 28) return "ท้องเราร้องแล้ว คุณได้หาอะไรกินหรือยัง?";
  if (state.energy < 25) return "วันนี้เหนื่อยไหม เราเริ่มอยากงีบแล้วล่ะ";
  if (state.joy < 32) return "วันนี้เงียบจัง แวะมาเล่าอะไรให้เราฟังหน่อยได้ไหม?";
  if (hour >= 22 || hour < 5) return "ยังไม่นอนอีกเหรอ วันนี้มีเรื่องค้างในใจไหม?";
  if (hour < 11) return "อรุณสวัสดิ์ วันนี้อยากทำอะไรให้สำเร็จหนึ่งอย่าง?";
  if (hour < 17) return "พักสายตาสักครู่ไหม แล้วค่อยกลับไปลุยต่อด้วยกัน";
  const prompts = [
    "วันนี้เป็นยังไงบ้าง มีเรื่องไหนอยากเล่าให้เราฟังไหม?",
    "ตอนนี้ในหัวคุณกำลังคิดเรื่องอะไรอยู่?",
    "วันนี้มีเรื่องเล็ก ๆ อะไรที่ทำให้ยิ้มบ้างไหม?",
  ];
  return prompts[Math.floor(Date.now() / 600_000) % prompts.length];
}

function addMessage(sender: ChatMessage["sender"], text: string): void {
  state.conversation.push({ sender, text, at: Date.now() });
  state.conversation = state.conversation.slice(-8);
}

function renderConversation(): void {
  const container = document.querySelector<HTMLElement>("#chat-messages")!;
  container.replaceChildren();
  state.conversation.slice(-4).forEach((message) => {
    const bubble = document.createElement("p");
    bubble.className = `message ${message.sender}`;
    bubble.textContent = message.text;
    container.appendChild(bubble);
  });
  container.scrollTop = container.scrollHeight;
}

function maybeNudge(force = false): void {
  const now = Date.now();
  if (state.sleeping || (!force && now - state.lastNudgeAt < 15 * 60_000)) return;
  addMessage("pal", proactivePrompt());
  state.lastNudgeAt = now;
  saveState();
}

function activePose(): number {
  if (reaction === "drive") return 7;
  if (reaction === "fly") return 8;
  if (reaction === "play") return 6;
  if (reaction === "feed") return 10;
  if (reaction === "clean") return 11;
  if (state.clean < 38) return 2;
  if (state.fullness < 28) return 3;
  if (state.sleeping) return 9;
  if (state.energy < 20) return 5;
  if (state.energy < 38) return 4;
  if (state.joy > 82) return 1;
  return 0;
}

function renderCharacter(): void {
  const pose = activePose();
  pet.style.backgroundImage = `url("${CHARACTER_SHEETS[state.character]}")`;
  pet.style.backgroundPosition = `${animationFrame * (100 / 3)}% ${pose * (100 / 11)}%`;
  pet.dataset.pose = String(pose);
  pet.dataset.activity = state.sleeping ? "sleep" : reaction === "drive" || reaction === "fly" ? reaction : "idle";

  document.querySelectorAll<HTMLElement>("[data-preview]").forEach((preview) => {
    preview.style.backgroundImage = `url("${CHARACTER_SHEETS[preview.dataset.preview as Character]}")`;
  });
}

function updateMeter(id: string, value: number): void {
  const meter = document.querySelector<HTMLElement>(`#${id}-meter`)!;
  const output = document.querySelector<HTMLOutputElement>(`#${id}-value`)!;
  meter.style.width = `${Math.round(value)}%`;
  meter.dataset.low = String(value < 30);
  output.value = String(Math.round(value));
}

function render(): void {
  if (reaction && Date.now() >= reactionUntil) reaction = null;
  updateMeter("fullness", state.fullness);
  updateMeter("joy", state.joy);
  updateMeter("clean", state.clean);
  updateMeter("energy", state.energy);
  document.querySelector("#thought")!.textContent = thought();
  document.querySelector("#pet-name")!.textContent = petName();
  document.querySelector("#day-label")!.textContent = `DAY ${ageInDays()}`;
  document.querySelector("#stage-label")!.textContent = petStage();
  document.querySelector("#sleep-label")!.textContent = state.sleeping ? "WAKE" : "SLEEP";
  document.querySelector("#sleep-hint")!.textContent = state.sleeping ? "rise" : "rest";
  document.querySelector("#mute-button")!.textContent = state.muted ? "MUTED" : "SFX";
  const chatInput = document.querySelector<HTMLInputElement>("#chat-input")!;
  chatInput.placeholder = `คุยกับ ${petName()}...`;
  document.querySelector(".chat")!.setAttribute("aria-label", `Chat with ${petName()}`);
  document.querySelector("label[for='chat-input']")!.textContent = `Message ${petName()}`;
  pet.setAttribute("aria-label", `${petName()}, your cartoon pet`);
  const room = document.querySelector<HTMLElement>(".room")!;
  room.setAttribute("aria-label", `${petName()}'s room`);
  room.dataset.scene = state.scene;
  room.style.backgroundImage = `url("${SCENE_ART[state.scene]}")`;
  document.querySelector<HTMLElement>("#pet-effects")!.dataset.pose = String(activePose());
  document.querySelectorAll<HTMLButtonElement>("[data-character]").forEach((button) => {
    button.dataset.selected = String(button.dataset.character === state.character);
  });
  document.querySelectorAll<HTMLButtonElement>("[data-scene-option]").forEach((button) => {
    button.dataset.selected = String(button.dataset.sceneOption === state.scene);
    const preview = button.querySelector<HTMLElement>(".scene-preview");
    if (preview) preview.style.backgroundImage = `url("${SCENE_ART[button.dataset.sceneOption as Scene]}")`;
  });
  renderConversation();
  renderCharacter();
  void invoke("set_tray_mood", { mood: mood(), character: state.character, petName: petName(), frame: trayFrame % 6 }).catch(() => undefined);
}

document.querySelectorAll<HTMLButtonElement>("[data-action]").forEach((button) => {
  button.addEventListener("click", () => applyAction(button.dataset.action as Action));
});

document.querySelector("#mute-button")!.addEventListener("click", () => {
  state.muted = !state.muted;
  saveState();
  render();
});

document.querySelector("#reset-button")!.addEventListener("click", () => {
  if (!window.confirm(`Start over with a new ${petName()}?`)) return;
  const currentCharacter = state.character;
  const currentName = state.customName;
  state = freshState();
  state.character = currentCharacter;
  state.customName = currentName;
  saveState();
  render();
});

const characterDialog = document.querySelector<HTMLDialogElement>("#character-dialog")!;
document.querySelector("#pal-button")!.addEventListener("click", () => characterDialog.showModal());
document.querySelector("#close-character-dialog")!.addEventListener("click", () => characterDialog.close());
characterDialog.addEventListener("click", (event) => {
  if (event.target === characterDialog) characterDialog.close();
});

document.querySelectorAll<HTMLButtonElement>("[data-character]").forEach((button) => {
  button.addEventListener("click", () => {
    const nextCharacter = button.dataset.character as Character;
    if (nextCharacter !== state.character) {
      state.character = nextCharacter;
      state.customName = "";
      state.conversation = [];
      addMessage("pal", CHARACTERS[nextCharacter].greeting);
      state.lastNudgeAt = Date.now();
      state.joy = clamp(state.joy + 6);
      saveState();
      playSound("chat");
    }
    characterDialog.close();
    render();
  });
});

const nameDialog = document.querySelector<HTMLDialogElement>("#name-dialog")!;
const nameInput = document.querySelector<HTMLInputElement>("#name-input")!;
document.querySelector("#name-button")!.addEventListener("click", () => {
  nameInput.value = petName();
  nameDialog.showModal();
  nameInput.select();
});
document.querySelector("#close-name-dialog")!.addEventListener("click", () => nameDialog.close());
nameDialog.addEventListener("click", (event) => {
  if (event.target === nameDialog) nameDialog.close();
});
document.querySelector<HTMLFormElement>("#name-form")!.addEventListener("submit", (event) => {
  event.preventDefault();
  const nextName = nameInput.value.trim().slice(0, 18);
  if (!nextName) return;
  state.customName = nextName;
  addMessage("pal", `ต่อไปเรียกเราว่า ${nextName} นะ!`);
  saveState();
  nameDialog.close();
  render();
});

const sceneDialog = document.querySelector<HTMLDialogElement>("#scene-dialog")!;
document.querySelector("#scene-button")!.addEventListener("click", () => sceneDialog.showModal());
document.querySelector("#close-scene-dialog")!.addEventListener("click", () => sceneDialog.close());
sceneDialog.addEventListener("click", (event) => {
  if (event.target === sceneDialog) sceneDialog.close();
});

document.querySelectorAll<HTMLButtonElement>("[data-scene-option]").forEach((button) => {
  button.addEventListener("click", () => {
    changeScene(button.dataset.sceneOption as Scene);
    sceneDialog.close();
  });
});

void listen<string>("tray-action", (event) => {
  if (event.payload === "next-scene") cycleScene();
  else if (["feed", "play", "clean", "sleep", "drive", "fly"].includes(event.payload)) applyAction(event.payload as Action);
}).catch(() => undefined);

function disableContextMenu(target: Document | Window): void {
  target.addEventListener("contextmenu", (event) => event.preventDefault(), { capture: true });
}

disableContextMenu(window);
document.querySelectorAll<HTMLIFrameElement>("iframe").forEach((iframe) => {
  iframe.addEventListener("load", () => {
    try {
      if (iframe.contentDocument) disableContextMenu(iframe.contentDocument);
    } catch {
      // Cross-origin iframe documents cannot be accessed; the parent webview remains protected.
    }
  });
});

document.querySelector<HTMLFormElement>("#chat-form")!.addEventListener("submit", (event) => {
  event.preventDefault();
  const input = document.querySelector<HTMLInputElement>("#chat-input")!;
  const message = input.value.trim();
  if (!message) return;
  addMessage("you", message);
  addMessage("pal", contextualReply(message));
  state.lastChatAt = Date.now();
  state.lastNudgeAt = Date.now();
  state.joy = clamp(state.joy + 4);
  input.value = "";
  saveState();
  playSound("chat");
  render();
});

advanceState();
if (state.conversation.length === 0) maybeNudge(true);
saveState();
render();

window.setInterval(() => {
  advanceState();
  render();
}, 650);

window.setInterval(() => {
  trayFrame += 1;
  void invoke("set_tray_mood", { mood: mood(), character: state.character, petName: petName(), frame: trayFrame % 6 }).catch(() => undefined);
}, 900);

window.setInterval(() => {
  animationFrame = (animationFrame + 1) % 4;
  renderCharacter();
}, 240);

window.setInterval(saveState, 30_000);
window.setInterval(() => {
  if (document.hasFocus()) maybeNudge();
}, 60_000);
