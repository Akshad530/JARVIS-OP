const screens = {
  splash: document.getElementById('splashScreen'),
  auth: document.getElementById('authScreen'),
  landing: document.getElementById('landingScreen'),
  chat: document.getElementById('chatScreen')
};

const state = {
  name: 'Jason',
  conversations: [],
  currentConversationId: null
};

const sidebar = document.getElementById('sidebar');
const chatFeed = document.getElementById('chatFeed');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const chatEmpty = document.getElementById('chatEmpty');
const conversationList = document.getElementById('conversationList');
const toast = document.getElementById('toast');

function activate(screenName) {
  Object.values(screens).forEach(el => el.classList.add('hidden'));
  Object.values(screens).forEach(el => el.classList.remove('active'));
  screens[screenName].classList.remove('hidden');
  requestAnimationFrame(() => screens[screenName].classList.add('active'));
}

setTimeout(() => activate('auth'), 1200);

document.getElementById('signUpForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('nameInput').value.trim();
  state.name = name || 'Jason';
  document.getElementById('greetName').textContent = `Good Afternoon, ${state.name}`;
  activate('landing');
});

document.getElementById('needThis').addEventListener('click', () => activate('chat'));
['openSidebar', 'chatMenu'].forEach(id => {
  const node = document.getElementById(id);
  if (node) node.addEventListener('click', () => sidebar.classList.add('open'));
});
document.getElementById('closeSidebar').addEventListener('click', () => sidebar.classList.remove('open'));
document.querySelectorAll('.side-link').forEach(b => b.addEventListener('click', () => {
  const route = b.dataset.route;
  if (route in screens) activate(route);
  sidebar.classList.remove('open');
}));

function getTopic(text) {
  const cleaned = text.replace(/[?!.]/g, '').trim();
  if (!cleaned) return 'General Chat';
  return cleaned.split(' ').slice(0, 4).join(' ');
}

function nowTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function renderMessage(msg) {
  const div = document.createElement('article');
  div.className = `msg ${msg.role}`;
  div.innerHTML = `<div>${msg.content}</div><div class="meta">${nowTime()}</div>`;
  if (msg.role === 'ai') {
    const actions = document.createElement('div');
    actions.className = 'actions';
    actions.innerHTML = `<button data-copy="1">Copy</button><button data-regen="1">Regenerate</button><button>👍</button><button>👎</button>`;
    actions.querySelector('[data-copy]').onclick = () => {
      navigator.clipboard.writeText(div.innerText);
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 1200);
    };
    actions.querySelector('[data-regen]').onclick = () => regenerate(msg.id);
    div.append(actions);
  }
  chatFeed.append(div);
  chatFeed.scrollTop = chatFeed.scrollHeight;
}

function createConversation(topic) {
  const item = { id: crypto.randomUUID(), topic, messages: [] };
  state.conversations.unshift(item);
  state.currentConversationId = item.id;
  syncConversationList();
  return item;
}

function currentConversation() {
  return state.conversations.find(c => c.id === state.currentConversationId);
}

function syncConversationList() {
  conversationList.innerHTML = '';
  state.conversations.forEach(c => {
    const button = document.createElement('button');
    button.className = 'conversation-item';
    button.textContent = c.topic;
    button.onclick = () => {
      state.currentConversationId = c.id;
      renderConversation(c);
      activate('chat');
      sidebar.classList.remove('open');
    };
    conversationList.append(button);
  });
}

function renderConversation(conversation) {
  chatFeed.innerHTML = '';
  if (!conversation || conversation.messages.length === 0) {
    chatEmpty.classList.remove('hidden');
    return;
  }
  chatEmpty.classList.add('hidden');
  conversation.messages.forEach(renderMessage);
}

function aiAnswer(prompt) {
  const topic = getTopic(prompt);
  return `<h4 style="margin:0 0 8px;color:#6747a8;">Topic: ${topic}</h4>
  <p><strong>Subtopic:</strong> Practical guidance</p>
  <p><strong>Summary:</strong> Here is a clear, reliable answer in a professional structure.</p>
  <ul>
    <li><strong>Key point 1:</strong> ${prompt} should be approached with a step-by-step plan.</li>
    <li><strong>Key point 2:</strong> Start with fundamentals, then execute in measurable iterations.</li>
    <li><strong>Key point 3:</strong> Validate outcomes and refine based on evidence.</li>
  </ul>
  <p><strong>Detailed guidance:</strong> Define your goal, list constraints, choose the best method, then evaluate results. If you share more context, I can provide an exact tailored solution with examples.</p>`;
}

function typingIndicator() {
  const el = document.createElement('div');
  el.className = 'typing';
  el.innerHTML = '<span></span><span></span><span></span>';
  chatFeed.append(el);
  chatFeed.scrollTop = chatFeed.scrollHeight;
  return el;
}

async function streamAIResponse(text) {
  let convo = currentConversation();
  if (!convo) convo = createConversation(getTopic(text));

  const userMessage = { id: crypto.randomUUID(), role: 'user', content: text };
  convo.messages.push(userMessage);
  renderMessage(userMessage);
  chatEmpty.classList.add('hidden');

  const typing = typingIndicator();
  await new Promise(r => setTimeout(r, 650));
  typing.remove();

  const full = aiAnswer(text);
  const aiMessage = { id: crypto.randomUUID(), role: 'ai', content: '' };
  convo.messages.push(aiMessage);
  renderMessage(aiMessage);

  const card = chatFeed.lastElementChild.querySelector('div');
  for (let i = 1; i <= full.length; i += 9) {
    aiMessage.content = full.slice(0, i);
    card.innerHTML = aiMessage.content;
    await new Promise(r => setTimeout(r, 8));
  }
  aiMessage.content = full;

  if (convo.topic === 'General Chat') {
    convo.topic = getTopic(text);
    syncConversationList();
  }
}

async function regenerate(id) {
  const convo = currentConversation();
  if (!convo) return;
  const idx = convo.messages.findIndex(m => m.id === id);
  if (idx === -1 || idx === 0) return;
  const prompt = convo.messages[idx - 1].content;
  convo.messages = convo.messages.filter(m => m.id !== id);
  renderConversation(convo);
  await streamAIResponse(prompt);
}

chatInput.addEventListener('input', () => {
  sendBtn.disabled = !chatInput.value.trim();
  sendBtn.classList.toggle('active', !!chatInput.value.trim());
});

document.getElementById('chatForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;
  chatInput.value = '';
  sendBtn.disabled = true;
  sendBtn.classList.remove('active');
  await streamAIResponse(text);
});

document.querySelectorAll('.suggestions button').forEach(btn => {
  btn.addEventListener('click', () => {
    chatInput.value = btn.dataset.prompt;
    sendBtn.disabled = false;
    sendBtn.classList.add('active');
    chatInput.focus();
  });
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
