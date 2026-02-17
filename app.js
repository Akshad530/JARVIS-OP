const screens = {
  splash: document.getElementById('splashScreen'),
  auth: document.getElementById('authCarousel'),
  landing: document.getElementById('landingScreen'),
  chat: document.getElementById('chatScreen')
};

const state = { name: 'Jason', conversations: [], currentConversationId: null };

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
  activate('landing');
});

document.getElementById('loginForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  state.name = email ? email.split('@')[0] : 'Jason';
  document.getElementById('greetName').textContent = `Good Afternoon, ${state.name}.`;
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
  renderConversationList();
  return c;
}

function renderConversationList() {
  const term = document.getElementById('searchChat').value.toLowerCase().trim();
  conversationList.innerHTML = '';

  const list = state.conversations.length
    ? state.conversations
    : [
        { id: 'sample-1', topic: 'Productivity Plan', messages: [] },
        { id: 'sample-2', topic: 'Travel Itinerary', messages: [] },
        { id: 'sample-3', topic: 'Startup Pitch', messages: [] }
      ];

  list
    .filter((c) => c.topic.toLowerCase().includes(term))
    .forEach((c, i) => {
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
    return `<h4 style="margin:0 0 8px;color:#4a74c7">Topic: Quantum Computing</h4>
    <p><strong>Subtopic:</strong> Beginner explanation</p>
    <p>Quantum computers use <strong>qubits</strong>. Unlike normal bits (0 or 1), qubits can represent probabilities in multiple states, which helps with specific hard computations.</p>
    <ul><li><strong>Useful for:</strong> optimization, simulation, and cryptography research.</li><li><strong>Not yet:</strong> a replacement for normal computers in all daily tasks.</li></ul>`;
  }
  if (p.includes('productivity') || p.includes('plan')) {
    return `<h4 style="margin:0 0 8px;color:#4a74c7">Topic: Productivity Plan</h4>
    <p><strong>Subtopic:</strong> Actionable routine</p>
    <ol>
      <li>Set your top 3 outcomes each morning.</li>
      <li>Do two deep-work blocks (60–90 min each).</li>
      <li>Batch email/chat checks into fixed windows.</li>
      <li>Review wins + tomorrow plan in 10 minutes.</li>
    </ol>`;
  }
  return `<h4 style="margin:0 0 8px;color:#4a74c7">Topic: ${getTopic(prompt)}</h4>
  <p><strong>Subtopic:</strong> Direct guidance</p>
  <p>I can help with that. Start by clarifying goal, constraints, and timeline. Then choose the simplest reliable approach and measure progress weekly.</p>`;
}

async function buildAnswer(prompt) {
  const fact = await fetchDuckDuckGoAnswer(prompt);
  if (fact) {
    return `<h4 style="margin:0 0 8px;color:#4a74c7">Topic: ${fact.title}</h4>
    <p><strong>Subtopic:</strong> Web-verified quick answer</p>
    <p>${fact.text}</p>
    ${fact.source ? `<p><small>Source: <a href="${fact.source}" target="_blank" rel="noreferrer">Reference link</a></small></p>` : ''}`;
  }

  const wiki = await fetchWikipediaSummary(prompt);
  if (wiki) {
    return `<h4 style="margin:0 0 8px;color:#4a74c7">Topic: ${wiki.title}</h4>
    <p><strong>Subtopic:</strong> Verified reference summary</p>
    <p>${wiki.extract}</p>
    ${wiki.source ? `<p><small>Source: <a href="${wiki.source}" target="_blank" rel="noreferrer">Wikipedia</a></small></p>` : ''}`;
  }
  return localAnswer(prompt);
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
  await new Promise((r) => setTimeout(r, 350));
  typing.remove();

  const ai = { id: crypto.randomUUID(), role: 'ai', content: '' };
  convo.messages.push(ai);
  renderMessage(ai);

  const container = chatFeed.lastElementChild.querySelector('div');
  for (let i = 1; i <= full.length; i += 10) {
    ai.content = full.slice(0, i);
    container.innerHTML = ai.content;
    await new Promise((r) => setTimeout(r, 6));
  }
  ai.content = full;

  if (convo.topic === 'General Chat') {
    convo.topic = getTopic(prompt);
    renderConversationList();
  }
}

async function regenerate(id) {
  const c = currentConversation();
  if (!c) return;
  const idx = c.messages.findIndex((m) => m.id === id);
  if (idx <= 0) return;
  const prompt = c.messages[idx - 1].content;
  c.messages.splice(idx, 1);
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
  chatFeed.innerHTML = '';
  chatEmpty.classList.remove('hidden');
  sidebar.classList.remove('open');
});

document.getElementById('newChatTop').addEventListener('click', () => {
  state.currentConversationId = null;
  chatFeed.innerHTML = '';
  chatEmpty.classList.remove('hidden');
});


renderConversationList();
