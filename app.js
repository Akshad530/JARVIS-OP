const screens = {
  splash: document.getElementById('splashScreen'),
  auth: document.getElementById('authCarousel'),
  landing: document.getElementById('landingScreen'),
  chat: document.getElementById('chatScreen')
};

const state = { name: 'Jason', conversations: [], currentConversationId: null };
const STORAGE_KEY = 'jarvis_state_v1';

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      state.name = parsed.name || state.name;
      state.conversations = Array.isArray(parsed.conversations) ? parsed.conversations : [];
      state.currentConversationId = parsed.currentConversationId || null;
    }
  } catch {
    // ignore invalid cache
  }
}

const sidebar = document.getElementById('sidebar');
const authSlider = document.getElementById('authSlider');
const dots = [...document.querySelectorAll('.dots span')];
const conversationList = document.getElementById('conversationList');
const chatFeed = document.getElementById('chatFeed');
const chatEmpty = document.getElementById('chatEmpty');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const toast = document.getElementById('toast');

let authStep = 0;



function activate(screenName) {
  Object.values(screens).forEach((el) => {
    el.classList.add('hidden');
    el.classList.remove('active');
  });
  screens[screenName].classList.remove('hidden');
  requestAnimationFrame(() => screens[screenName].classList.add('active'));
}

function goAuthStep(step) {
  authStep = Math.max(0, Math.min(1, step));
  authSlider.style.transform = `translateX(-${authStep * (100 / 2)}%)`;
  dots.forEach((dot, i) => dot.classList.toggle('on', i === authStep));
}

const splashNextBtn = document.getElementById('splashNextBtn');
if (splashNextBtn) splashNextBtn.addEventListener('click', () => activate('auth'));

// Auth flow
const goLoginLink = document.getElementById('goLoginLink');
const goSignupLink = document.getElementById('goSignupLink');

goLoginLink?.addEventListener('click', () => goAuthStep(0));
goSignupLink?.addEventListener('click', () => goAuthStep(1));

document.getElementById('createForm').addEventListener('submit', (e) => {
  e.preventDefault();
  state.name = document.getElementById('nameInput').value.trim() || 'Jason';
  document.getElementById('greetName').textContent = `Good Afternoon, ${state.name}.`;
  saveState();
  activate('landing');
});

document.getElementById('loginForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  state.name = email ? email.split('@')[0] : 'Jason';
  document.getElementById('greetName').textContent = `Good Afternoon, ${state.name}.`;
  saveState();
  activate('landing');
});

// Navigation actions
document.getElementById('needThis').addEventListener('click', () => activate('chat'));
document.getElementById('openSidebar').addEventListener('click', () => sidebar.classList.add('open'));
document.getElementById('chatMenu').addEventListener('click', () => sidebar.classList.add('open'));
document.getElementById('closeSidebar').addEventListener('click', () => sidebar.classList.remove('open'));

[...document.querySelectorAll('.sidebar [data-route]')].forEach((btn) => {
  btn.addEventListener('click', () => {
    const route = btn.dataset.route;
    if (screens[route]) activate(route);
    sidebar.classList.remove('open');
  });
});

document.getElementById('landingPromptForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const q = document.getElementById('landingPromptInput').value.trim();
  if (!q) return;
  document.getElementById('landingPromptInput').value = '';
  activate('chat');
  await streamAIResponse(q);
});

function nowTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getTopic(text) {
  const cleaned = text.replace(/[?!.]/g, '').trim();
  return cleaned ? cleaned.split(' ').slice(0, 6).join(' ') : 'General Chat';
}

function currentConversation() {
  return state.conversations.find((c) => c.id === state.currentConversationId);
}

function createConversation(topic) {
  const c = { id: crypto.randomUUID(), topic, messages: [] };
  state.conversations.unshift(c);
  state.currentConversationId = c.id;
  saveState();
  renderConversationList();
  return c;
}

function renderConversationList() {
  const term = document.getElementById('searchChat').value.toLowerCase().trim();
  conversationList.innerHTML = '';

  const list = state.conversations.filter((c) => c.topic.toLowerCase().includes(term));

  if (!list.length) {
    const empty = document.createElement('p');
    empty.className = 'conversation-empty';
    empty.textContent = 'No saved chats yet';
    conversationList.append(empty);
    return;
  }

  list.forEach((c, i) => {
    const row = document.createElement('button');
    row.className = 'conversation-item';
    row.innerHTML = `<span class="avatar-mini">${c.topic.charAt(0).toUpperCase()}</span><span class="topic-text">${c.topic}</span><span class="badge-mini">${i + 1}</span>`;
    row.onclick = () => {
      const found = state.conversations.find((x) => x.id === c.id);
      if (!found) return;
      state.currentConversationId = found.id;
      renderConversation(found);
      activate('chat');
      sidebar.classList.remove('open');
    };
    conversationList.append(row);
  });
}

document.getElementById('searchChat').addEventListener('input', renderConversationList);

function renderMessage(msg) {
  const card = document.createElement('article');
  card.className = `msg ${msg.role}`;
  card.innerHTML = `<div>${msg.content}</div><div class="meta">${nowTime()}</div>`;

  if (msg.role === 'ai') {
    const actions = document.createElement('div');
    actions.className = 'actions';
    actions.innerHTML = '<button data-copy>Copy</button><button data-regen>Regenerate</button><button>👍</button><button>👎</button>';
    actions.querySelector('[data-copy]').onclick = async () => {
      await navigator.clipboard.writeText(card.innerText);
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 1200);
    };
    actions.querySelector('[data-regen]').onclick = () => regenerate(msg.id);
    card.append(actions);
  }

  chatFeed.append(card);
  chatFeed.scrollTop = chatFeed.scrollHeight;
}

function renderConversation(c) {
  chatFeed.innerHTML = '';
  if (!c || c.messages.length === 0) {
    chatEmpty.classList.remove('hidden');
    return;
  }
  chatEmpty.classList.add('hidden');
  c.messages.forEach(renderMessage);
}

function typingNode() {
  const n = document.createElement('div');
  n.className = 'typing';
  n.innerHTML = '<span></span><span></span><span></span>';
  chatFeed.append(n);
  chatFeed.scrollTop = chatFeed.scrollHeight;
  return n;
}

async function searchWikipediaTitle(query) {
  try {
    const q = encodeURIComponent(query.slice(0, 80));
    const res = await fetch(`https://en.wikipedia.org/w/rest.php/v1/search/title?q=${q}&limit=1`);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.pages?.[0]?.title || null;
  } catch {
    return null;
  }
}

async function fetchWikipediaSummary(prompt) {
  try {
    const title = (await searchWikipediaTitle(prompt)) || prompt.split('?')[0].trim().slice(0, 80);
    if (!title) return null;
    const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.extract || data.type === 'disambiguation') return null;
    return {
      title: data.title || title,
      extract: data.extract,
      source: data.content_urls?.desktop?.page || ''
    };
  } catch {
    return null;
  }
}


async function fetchDuckDuckGoAnswer(prompt) {
  try {
    if (!prompt || prompt.trim().length < 6) return null;
    const q = encodeURIComponent(prompt.slice(0, 180));
    const res = await fetch(`https://api.duckduckgo.com/?q=${q}&format=json&no_html=1&skip_disambig=1`);
    if (!res.ok) return null;
    const data = await res.json();

    const abstract = (data?.AbstractText || '').trim();
    const heading = (data?.Heading || '').trim();
    const source = (data?.AbstractURL || '').trim();

    if (abstract) {
      return {
        title: heading || 'Web Fact',
        text: abstract,
        source
      };
    }

    const related = data?.RelatedTopics || [];
    for (const item of related) {
      if (item?.Text) {
        return {
          title: heading || 'Web Fact',
          text: item.Text,
          source: item.FirstURL || source || ''
        };
      }
      if (Array.isArray(item?.Topics)) {
        const inner = item.Topics.find((t) => t?.Text);
        if (inner) {
          return {
            title: heading || 'Web Fact',
            text: inner.Text,
            source: inner.FirstURL || source || ''
          };
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

function localAnswer(prompt) {
  const p = prompt.toLowerCase();
  if (p.includes('quantum')) {
    return 'Quantum computing uses qubits, which can represent probabilities instead of only 0 or 1. This allows certain complex calculations to be explored more efficiently than with classical computing methods. Today it is most useful for research in optimization, simulation, and cryptography, while practical large-scale use is still evolving due to hardware and error-correction limits.';
  }
  if (p.includes('productivity') || p.includes('plan')) {
    return 'A strong productivity plan starts with clear priorities, realistic time blocks, and regular review. Define the most important outcomes for the week, schedule focused deep-work sessions, and batch shallow tasks into smaller windows. End each day with a short review so your next day starts with direction and less decision fatigue.';
  }
  return 'To answer this well, first define your goal, constraints, and expected outcome. Then choose a simple approach, test it quickly, and improve based on feedback. This gives you reliable progress while reducing confusion and unnecessary complexity.';
}



function isGreetingPrompt(prompt) {
  const q = (prompt || '').trim().toLowerCase();
  return /^(hi|hii|hello|hey|yo|good morning|good afternoon|good evening)$/.test(q);
}

function greetingAnswer() {
  return {
    title: 'Greeting',
    text: "Hello! I'm JARVIS. I can help with explanations, summaries, planning, writing, and research. Ask me any question and I will give a detailed, correct answer."
  };
}

function inferSubtopic(prompt) {
  const q = (prompt || '').toLowerCase();
  if (/how|steps|process/.test(q)) return 'How it works';
  if (/why|reason|cause/.test(q)) return 'Why it matters';
  if (/difference|vs|compare/.test(q)) return 'Comparison';
  if (/plan|improve|strategy|tips/.test(q)) return 'Practical strategy';
  return 'Core explanation';
}

function formatPremiumAnswer(prompt, title, rawText, source = '') {
  const text = (rawText || '').replace(/\s+/g, ' ').trim();
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  const safe = sentences.length ? sentences : [text || 'I could not find enough data for this question right now.'];
  const overview = safe[0] || '';
  const depth = safe.slice(1, 4).join(' ');
  const next = safe.slice(4).join(' ');
  const subtopic = inferSubtopic(prompt);

  return `<div class="ai-topic">${title}</div>
  <p class="ai-subtitle"><span class="ai-subtopic">${subtopic}</span></p>
  <p class="ai-section"><span class="ai-section-title">Topic Summary:</span> ${overview}</p>
  <p class="ai-section"><span class="ai-section-title">${subtopic}:</span> ${depth || overview}</p>
  ${next ? `<p class="ai-section"><span class="ai-section-title">Additional Detail:</span> ${next}</p>` : ''}
  ${source ? `<p class="ai-source"><small>Source: <a href="${source}" target="_blank" rel="noreferrer">Reference</a></small></p>` : ''}`;
}


async function buildAnswer(prompt) {
  if (isGreetingPrompt(prompt)) {
    const g = greetingAnswer();
    return formatPremiumAnswer(prompt, g.title, g.text);
  }

  const fact = await fetchDuckDuckGoAnswer(prompt);
  if (fact) {
    return formatPremiumAnswer(prompt, fact.title || getTopic(prompt), fact.text, fact.source || '');
  }

  const wiki = await fetchWikipediaSummary(prompt);
  if (wiki) {
    return formatPremiumAnswer(prompt, wiki.title || getTopic(prompt), wiki.extract, wiki.source || '');
  }

  return formatPremiumAnswer(prompt, getTopic(prompt), localAnswer(prompt));
}

async function streamAIResponse(prompt) {
  let convo = currentConversation();
  if (!convo) convo = createConversation(getTopic(prompt));

  const user = { id: crypto.randomUUID(), role: 'user', content: prompt };
  convo.messages.push(user);
  renderMessage(user);
  chatEmpty.classList.add('hidden');

  const typing = typingNode();
  const full = await buildAnswer(prompt);
  await new Promise((r) => setTimeout(r, 180));
  typing.remove();

  const ai = { id: crypto.randomUUID(), role: 'ai', content: '' };
  convo.messages.push(ai);
  renderMessage(ai);

  const container = chatFeed.lastElementChild.querySelector('div');
  for (let i = 1; i <= full.length; i += 16) {
    ai.content = full.slice(0, i);
    container.innerHTML = ai.content;
    await new Promise((r) => setTimeout(r, 4));
  }
  ai.content = full;

  if (convo.topic === 'General Chat') {
    convo.topic = getTopic(prompt);
    renderConversationList();
  }
  saveState();
}

async function regenerate(id) {
  const c = currentConversation();
  if (!c) return;
  const idx = c.messages.findIndex((m) => m.id === id);
  if (idx <= 0) return;
  const prompt = c.messages[idx - 1].content;
  c.messages.splice(idx, 1);
  saveState();
  renderConversation(c);
  await streamAIResponse(prompt);
}

chatInput.addEventListener('input', () => {
  const has = !!chatInput.value.trim();
  sendBtn.disabled = !has;
  sendBtn.classList.toggle('active', has);
});

document.getElementById('chatForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const q = chatInput.value.trim();
  if (!q) return;
  chatInput.value = '';
  sendBtn.disabled = true;
  sendBtn.classList.remove('active');
  await streamAIResponse(q);
});

[...document.querySelectorAll('.suggest-grid button')].forEach((btn) => {
  btn.addEventListener('click', () => streamAIResponse(btn.dataset.prompt));
});

document.getElementById('newChatBtn').addEventListener('click', () => {
  state.currentConversationId = null;
  saveState();
  chatFeed.innerHTML = '';
  chatEmpty.classList.remove('hidden');
  sidebar.classList.remove('open');
});

document.getElementById('newChatTop').addEventListener('click', () => {
  state.currentConversationId = null;
  saveState();
  chatFeed.innerHTML = '';
  chatEmpty.classList.remove('hidden');
});


loadState();
document.getElementById('greetName').textContent = `Good Afternoon, ${state.name}.`;
renderConversationList();
if (state.currentConversationId) {
  renderConversation(currentConversation());
}
