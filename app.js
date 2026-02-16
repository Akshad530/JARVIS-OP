const screens = {
  splash: document.getElementById('splashScreen'),
  auth: document.getElementById('authScreen'),
  landing: document.getElementById('landingScreen'),
  chat: document.getElementById('chatScreen')
};

const state = { name: 'Jason', conversations: [], currentConversationId: null };

const sidebar = document.getElementById('sidebar');
const chatFeed = document.getElementById('chatFeed');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const chatEmpty = document.getElementById('chatEmpty');
const conversationList = document.getElementById('conversationList');
const toast = document.getElementById('toast');
const starterInput = document.getElementById('starterInput');

function activate(screenName) {
  Object.values(screens).forEach(el => {
    el.classList.add('hidden');
    el.classList.remove('active');
  });
  screens[screenName].classList.remove('hidden');
  requestAnimationFrame(() => screens[screenName].classList.add('active'));
}

setTimeout(() => activate('auth'), 1300);

document.getElementById('signUpForm').addEventListener('submit', (e) => {
  e.preventDefault();
  state.name = document.getElementById('nameInput').value.trim() || 'Jason';
  document.getElementById('greetName').textContent = `Good Afternoon, ${state.name}.`;
  activate('landing');
});

document.getElementById('needThis').addEventListener('click', () => activate('chat'));
['openSidebar', 'chatMenu'].forEach(id => document.getElementById(id)?.addEventListener('click', () => sidebar.classList.add('open')));
document.getElementById('closeSidebar').addEventListener('click', () => sidebar.classList.remove('open'));
document.querySelectorAll('.side-link').forEach(btn => btn.addEventListener('click', () => {
  activate(btn.dataset.route);
  sidebar.classList.remove('open');
}));

function nowTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getTopic(text) {
  const t = text.replace(/[?!.]/g, '').trim();
  return t ? t.split(' ').slice(0, 4).join(' ') : 'General Chat';
}

function buildAnswer(prompt) {
  const q = prompt.toLowerCase();
  const topic = getTopic(prompt);

  const templates = [
    {
      test: /(quantum|physics)/,
      answer: `<h4 style="margin:0 0 8px;color:#6a47b0">Topic: Quantum Computing Basics</h4>
      <p><strong>Subtopic:</strong> Simple explanation</p>
      <p>Quantum computing uses <strong>qubits</strong> instead of normal bits. Qubits can represent multiple states at once, so some complex problems can be explored much faster.</p>
      <ul><li><strong>Best for:</strong> optimization, simulation, cryptography research.</li><li><strong>Not for:</strong> every daily app task right now.</li></ul>
      <p>In short: it is powerful for specific hard problems, but still developing for mainstream use.</p>`
    },
    {
      test: /(productivity|plan|week|time management)/,
      answer: `<h4 style="margin:0 0 8px;color:#6a47b0">Topic: Productivity Improvement</h4>
      <p><strong>Subtopic:</strong> Practical weekly system</p>
      <ol>
        <li><strong>Daily top 3:</strong> decide 3 outcomes every morning.</li>
        <li><strong>Focus blocks:</strong> 2x 60–90 minute deep work sessions.</li>
        <li><strong>Task batching:</strong> group calls/messages together.</li>
        <li><strong>Review:</strong> 15 minutes at day end to plan next day.</li>
      </ol>
      <p>If you want, I can build a custom schedule for your exact work hours.</p>`
    },
    {
      test: /(poem|write)/,
      answer: `<h4 style="margin:0 0 8px;color:#6a47b0">Topic: Creative Writing</h4>
      <p><strong>Subtopic:</strong> Draft output</p>
      <p><strong>Poem:</strong><br>
      In quiet light the morning grows,<br>
      Through patient skies and silver rows,<br>
      The day unfolds in steady rhyme,<br>
      A gentle plan, one task at time.</p>`
    }
  ];

  const match = templates.find(t => t.test.test(q));
  if (match) return match.answer;

  return `<h4 style="margin:0 0 8px;color:#6a47b0">Topic: ${topic}</h4>
  <p><strong>Subtopic:</strong> Direct answer</p>
  <p>I understand your question and here is a clear approach:</p>
  <ul>
    <li>Define the goal and constraints.</li>
    <li>Choose the best method/tools for your context.</li>
    <li>Execute in small steps and measure results.</li>
  </ul>
  <p>Share a little more context and I’ll give an exact tailored answer.</p>`;
}

function renderMessage(msg) {
  const card = document.createElement('article');
  card.className = `msg ${msg.role}`;
  card.innerHTML = `<div>${msg.content}</div><div class="meta">${nowTime()}</div>`;

  if (msg.role === 'ai') {
    const actions = document.createElement('div');
    actions.className = 'actions';
    actions.innerHTML = '<button data-copy="1">Copy</button><button data-regen="1">Regenerate</button><button>👍</button><button>👎</button>';
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

function syncConversationList() {
  conversationList.innerHTML = '';
  state.conversations.forEach(convo => {
    const btn = document.createElement('button');
    btn.className = 'conversation-item';
    btn.textContent = convo.topic;
    btn.onclick = () => {
      state.currentConversationId = convo.id;
      renderConversation(convo);
      activate('chat');
      sidebar.classList.remove('open');
    };
    conversationList.append(btn);
  });
}

function createConversation(topic) {
  const c = { id: crypto.randomUUID(), topic, messages: [] };
  state.conversations.unshift(c);
  state.currentConversationId = c.id;
  syncConversationList();
  return c;
}

function currentConversation() {
  return state.conversations.find(c => c.id === state.currentConversationId);
}

function renderConversation(convo) {
  chatFeed.innerHTML = '';
  if (!convo || convo.messages.length === 0) {
    chatEmpty.classList.remove('hidden');
    return;
  }
  chatEmpty.classList.add('hidden');
  convo.messages.forEach(renderMessage);
}

function typingIndicator() {
  const t = document.createElement('div');
  t.className = 'typing';
  t.innerHTML = '<span></span><span></span><span></span>';
  chatFeed.append(t);
  chatFeed.scrollTop = chatFeed.scrollHeight;
  return t;
}

async function streamAIResponse(prompt) {
  let convo = currentConversation();
  if (!convo) convo = createConversation(getTopic(prompt));

  const u = { id: crypto.randomUUID(), role: 'user', content: prompt };
  convo.messages.push(u);
  renderMessage(u);
  chatEmpty.classList.add('hidden');

  const typing = typingIndicator();
  await new Promise(r => setTimeout(r, 550));
  typing.remove();

  const full = buildAnswer(prompt);
  const a = { id: crypto.randomUUID(), role: 'ai', content: '' };
  convo.messages.push(a);
  renderMessage(a);

  const container = chatFeed.lastElementChild.querySelector('div');
  for (let i = 1; i <= full.length; i += 8) {
    a.content = full.slice(0, i);
    container.innerHTML = a.content;
    await new Promise(r => setTimeout(r, 8));
  }
  a.content = full;

  if (convo.topic === 'General Chat') {
    convo.topic = getTopic(prompt);
    syncConversationList();
  }
}

async function regenerate(id) {
  const convo = currentConversation();
  if (!convo) return;
  const idx = convo.messages.findIndex(m => m.id === id);
  if (idx <= 0) return;
  const userPrompt = convo.messages[idx - 1].content;
  convo.messages.splice(idx, 1);
  renderConversation(convo);
  await streamAIResponse(userPrompt);
}

chatInput.addEventListener('input', () => {
  const has = !!chatInput.value.trim();
  sendBtn.disabled = !has;
  sendBtn.classList.toggle('active', has);
});

document.getElementById('chatForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const prompt = chatInput.value.trim();
  if (!prompt) return;
  chatInput.value = '';
  sendBtn.disabled = true;
  sendBtn.classList.remove('active');
  await streamAIResponse(prompt);
});

document.getElementById('starterForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const prompt = starterInput.value.trim();
  if (!prompt) return;
  starterInput.value = '';
  await streamAIResponse(prompt);
});

document.querySelectorAll('.suggestions button').forEach(btn => btn.addEventListener('click', async () => {
  const prompt = btn.dataset.prompt;
  await streamAIResponse(prompt);
}));

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
