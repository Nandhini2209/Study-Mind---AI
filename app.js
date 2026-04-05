/* ============================================
   StudyMind AI — Frontend Logic
   app.js
   ============================================ */

// ─── STATE ───────────────────────────────────
const state = {
  mood: null,
  subject: null,
  time: 120,
  difficulty: 'advanced',
  currentPlan: null,
  timer: null,
  timerSeconds: 25 * 60,
  timerRunning: false,
  completedTasks: new Set(),
  sessions: JSON.parse(localStorage.getItem('studymind_sessions') || '[]'),
  streak: parseInt(localStorage.getItem('studymind_streak') || '0'),
};

const MOOD_EMOJIS = {
  motivated: '🚀', tired: '😴', stressed: '😟', normal: '😐'
};
const MOOD_COLORS = {
  motivated: '#38bdf8', tired: '#fb923c', stressed: '#f87171', normal: '#94a3b8'
};

// ─── INIT ─────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('streakCount').textContent = state.streak;
  renderTracker();
  updateTime(document.getElementById('timeSlider'));
});

// ─── MOOD ─────────────────────────────────────
function selectMood(btn) {
  document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  state.mood = btn.dataset.mood;
}

// ─── SUBJECT CHIP ─────────────────────────────
function selectChip(chip, type) {
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  chip.classList.add('active');
  state.subject = chip.textContent;
  document.getElementById('customSubject').value = '';
}

// ─── TIME SLIDER ──────────────────────────────
function updateTime(slider) {
  const val = parseInt(slider.value);
  state.time = val;
  const h = Math.floor(val / 60);
  const m = val % 60;
  document.getElementById('timeValue').textContent =
    h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}

// ─── DIFFICULTY ───────────────────────────────
function selectDiff(btn) {
  document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  state.difficulty = btn.dataset.diff;
}

// ─── MOOD DETECTION FROM TEXT ─────────────────
function detectMoodFromText() {
  const text = document.getElementById('moodText').value.toLowerCase();
  const badge = document.getElementById('detectedMood');
  if (text.length < 10) { badge.style.display = 'none'; return; }

  const rules = [
    { keywords: ['tired','sleepy','exhausted','fatigue','sleepy','drained'], mood: 'tired' },
    { keywords: ['stressed','anxious','worried','overwhelmed','nervous','panic'], mood: 'stressed' },
    { keywords: ['motivated','excited','ready','energetic','pumped','great','amazing'], mood: 'motivated' },
  ];

  let detected = 'normal';
  for (const rule of rules) {
    if (rule.keywords.some(k => text.includes(k))) { detected = rule.mood; break; }
  }

  badge.style.display = 'block';
  badge.textContent = `🤖 AI Detected Mood: ${MOOD_EMOJIS[detected]} ${capitalize(detected)}`;

  // Auto-select mood
  const btn = document.querySelector(`[data-mood="${detected}"]`);
  if (btn) selectMood(btn);
}

// ─── GENERATE PLAN ────────────────────────────
async function generatePlan() {
  const subject = document.getElementById('customSubject').value.trim() || state.subject;
  if (!state.mood) return showToast('⚠️ Please select your mood first!');
  if (!subject) return showToast('⚠️ Please select or enter a subject!');

  const btn = document.getElementById('generateBtn');
  btn.disabled = true;
  document.querySelector('.btn-text').style.display = 'none';
  document.getElementById('btnLoader').style.display = 'flex';

  document.getElementById('emptyState').style.display = 'none';
  document.getElementById('planOutput').style.display = 'none';

  const h = Math.floor(state.time / 60);
  const m = state.time % 60;
  const timeStr = h > 0 ? `${h} hour${h>1?'s':''} ${m>0 ? m+' minutes':''}` : `${m} minutes`;

  const prompt = `You are StudyMind AI, a smart study planner. Generate a detailed, personalized study plan.

Student Details:
- Current Mood: ${state.mood}
- Subject/Topic: ${subject}
- Available Time: ${timeStr}
- Difficulty Level: ${state.difficulty}

Rules:
- Use Pomodoro technique (study + break intervals)
- Adapt intensity to mood (tired = lighter, motivated = harder)
- Be specific about activities (not just "study")
- Add motivational context

Return ONLY a valid JSON object (no markdown, no extra text):
{
  "title": "short plan title",
  "motivation": "one motivational sentence tailored to their mood",
  "tasks": [
    {
      "id": 1,
      "type": "study|break|review",
      "icon": "single emoji",
      "activity": "specific activity description",
      "duration": number_in_minutes
    }
  ],
  "tips": ["tip1", "tip2"],
  "focusScore": number_0_to_100,
  "studyMethod": "Flashcards|Pomodoro|Active Recall|Spaced Repetition|Practice Problems"
}`;

  try {
    const plan = generateFallbackPlan(state.mood, subject, state.time, state.difficulty);
    plan.subject = subject;
    plan.mood = state.mood;
    plan.time = state.time;
    state.currentPlan = plan;
    renderPlan(plan);

  } catch (err) {
    console.error('API Error:', err);
    // Fallback plan if API not connected
    const fallback = generateFallbackPlan(state.mood, subject, state.time, state.difficulty);
    state.currentPlan = fallback;
    renderPlan(fallback);
  }

  btn.disabled = false;
  document.querySelector('.btn-text').style.display = 'inline';
  document.getElementById('btnLoader').style.display = 'none';
}

// ─── FALLBACK PLAN GENERATOR ──────────────────
function generateFallbackPlan(mood, subject, totalMinutes, difficulty) {
  const plans = {
    motivated: [
      { type:'study', icon:'📖', activity:`Deep dive into ${subject} core concepts`, duration:30 },
      { type:'break', icon:'☕', activity:'Short break – water & stretch', duration:5 },
      { type:'study', icon:'✏️', activity:`Practice problems on ${subject}`, duration:25 },
      { type:'break', icon:'🧘', activity:'Mindful break – breathe', duration:5 },
      { type:'study', icon:'🧪', activity:`Apply knowledge – mini project/quiz`, duration:30 },
      { type:'review', icon:'🔁', activity:'Review & note key takeaways', duration:10 },
    ],
    tired: [
      { type:'study', icon:'🎥', activity:`Watch a short video on ${subject}`, duration:15 },
      { type:'break', icon:'💧', activity:'Break – drink water, relax', duration:10 },
      { type:'study', icon:'📖', activity:`Skim through key notes on ${subject}`, duration:20 },
      { type:'break', icon:'🚶', activity:'Walk for 5 minutes', duration:5 },
      { type:'review', icon:'🔁', activity:'Quick summary in your own words', duration:10 },
    ],
    stressed: [
      { type:'study', icon:'🧘', activity:'Deep breath exercise (2 min), then start', duration:5 },
      { type:'study', icon:'📝', activity:`Break ${subject} into tiny pieces – start with easiest`, duration:20 },
      { type:'break', icon:'☕', activity:'Relaxing break – do NOT check social media', duration:10 },
      { type:'study', icon:'✏️', activity:`Write down 3 things you understood about ${subject}`, duration:20 },
      { type:'review', icon:'🌟', activity:'Celebrate progress – you did great!', duration:5 },
    ],
    normal: [
      { type:'study', icon:'📖', activity:`Study ${subject} systematically`, duration:25 },
      { type:'break', icon:'☕', activity:'Pomodoro break', duration:5 },
      { type:'study', icon:'✏️', activity:`Practice ${subject} exercises`, duration:25 },
      { type:'break', icon:'🚶', activity:'Short walk break', duration:5 },
      { type:'study', icon:'🔁', activity:`Review what you learned about ${subject}`, duration:20 },
    ]
  };

  const motivations = {
    motivated: `You're in the zone today — let's make it count! Every minute of focused study brings you closer to mastery.`,
    tired: `Even tired minds can absorb new things. Small sessions today are better than nothing — you've got this!`,
    stressed: `Take it one step at a time. Stress means you care — channel that energy into one small win right now.`,
    normal: `Consistent effort beats occasional brilliance. Let's build that knowledge brick by brick today.`
  };

  const tasks = plans[mood] || plans.normal;
  // trim to fit totalMinutes roughly
  let acc = 0;
  const trimmed = [];
  for (const t of tasks) {
    if (acc + t.duration > totalMinutes + 5) break;
    trimmed.push({ ...t, id: trimmed.length + 1 });
    acc += t.duration;
  }

  return {
    title: `${capitalize(mood)} Mode – ${subject} Plan`,
    motivation: motivations[mood],
    tasks: trimmed,
    focusScore: mood === 'motivated' ? 90 : mood === 'tired' ? 60 : mood === 'stressed' ? 65 : 75,
    studyMethod: mood === 'motivated' ? 'Active Recall' : mood === 'tired' ? 'Spaced Repetition' : 'Pomodoro',
    subject, mood, time: totalMinutes
  };
}

// ─── RENDER PLAN ──────────────────────────────
function renderPlan(plan) {
  document.getElementById('planOutput').style.display = 'block';
  document.getElementById('emptyState').style.display = 'none';

  document.getElementById('planMeta').textContent =
    `${MOOD_EMOJIS[plan.mood]} ${capitalize(plan.mood)} Mode  •  ${plan.subject}  •  ${plan.studyMethod || 'Smart Study'}`;

  document.getElementById('planTitle').textContent = plan.title;
  document.getElementById('motivationBanner').textContent = `"${plan.motivation}"`;

  // Render tasks
  const container = document.getElementById('tasksList');
  container.innerHTML = '';
  state.completedTasks.clear();

  plan.tasks.forEach((task, i) => {
    const isBreak = task.type === 'break';
    const div = document.createElement('div');
    div.className = `task-item ${isBreak ? 'break-item' : ''}`;
    div.id = `task-${task.id}`;
    div.style.animationDelay = `${i * 0.08}s`;
    div.innerHTML = `
      <div class="task-check" id="check-${task.id}" onclick="toggleTask(${task.id})"></div>
      <span class="task-num">${String(task.id).padStart(2,'0')}</span>
      <span class="task-icon">${task.icon}</span>
      <span class="task-text">${task.activity}</span>
      <span class="task-time ${isBreak ? 'break' : ''}">${task.duration}m</span>
    `;
    container.appendChild(div);
  });

  // Summary
  const studyTasks = plan.tasks.filter(t => t.type !== 'break');
  const breakTasks = plan.tasks.filter(t => t.type === 'break');
  const studyMin = studyTasks.reduce((a, t) => a + t.duration, 0);
  document.getElementById('sumStudy').textContent = studyMin >= 60
    ? `${Math.floor(studyMin/60)}h ${studyMin%60}m` : `${studyMin}m`;
  document.getElementById('sumBreaks').textContent = breakTasks.length;
  document.getElementById('sumTasks').textContent = studyTasks.length;
  document.getElementById('sumScore').textContent = (plan.focusScore || 75) + '%';

  document.getElementById('focusStartBtn').style.display = 'block';
  document.getElementById('focusTimerBox').style.display = 'none';

  // Auto-save session
  saveSession(plan);
}

// ─── TASK TOGGLE ──────────────────────────────
function toggleTask(id) {
  const check = document.getElementById(`check-${id}`);
  const row = document.getElementById(`task-${id}`);
  if (state.completedTasks.has(id)) {
    state.completedTasks.delete(id);
    check.classList.remove('done');
    check.textContent = '';
    row.classList.remove('completed');
  } else {
    state.completedTasks.add(id);
    check.classList.add('done');
    check.textContent = '✓';
    row.classList.add('completed');
    showToast('✅ Task completed! Keep going!');
  }
}

// ─── FOCUS TIMER ──────────────────────────────
function startFocusMode() {
  document.getElementById('focusTimerBox').style.display = 'block';
  document.getElementById('focusStartBtn').style.display = 'none';
  state.timerSeconds = 25 * 60;
  state.timerRunning = true;
  updateTimerDisplay();
  state.timer = setInterval(() => {
    if (!state.timerRunning) return;
    state.timerSeconds--;
    updateTimerDisplay();
    if (state.timerSeconds <= 0) {
      clearInterval(state.timer);
      showToast('🎉 25-minute session complete! Take a break!');
      document.getElementById('timerTip').textContent = '⏸ Take a 5-minute break. You earned it!';
    }
  }, 1000);

  const tips = [
    'Put your phone face-down for the next 25 minutes.',
    'Close all unnecessary browser tabs.',
    'One task at a time — you\'re focused!',
    'Every expert was once a beginner. Keep going.',
    'The next 25 minutes will shape your future.',
  ];
  document.getElementById('timerTip').textContent = tips[Math.floor(Math.random() * tips.length)];
}

function pauseTimer() {
  state.timerRunning = !state.timerRunning;
  document.querySelector('.timer-btn').textContent = state.timerRunning ? '⏸ Pause' : '▶️ Resume';
}

function stopTimer() {
  clearInterval(state.timer);
  state.timerRunning = false;
  document.getElementById('focusTimerBox').style.display = 'none';
  document.getElementById('focusStartBtn').style.display = 'block';
}

function updateTimerDisplay() {
  const m = Math.floor(state.timerSeconds / 60);
  const s = state.timerSeconds % 60;
  document.getElementById('timerDisplay').textContent =
    `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

// ─── COPY / SAVE PLAN ─────────────────────────
function copyPlan() {
  if (!state.currentPlan) return;
  const lines = [`📚 ${state.currentPlan.title}\n`,
    `"${state.currentPlan.motivation}"\n`,
    ...state.currentPlan.tasks.map(t => `${t.icon} ${String(t.id).padStart(2,'0')}. [${t.duration}m] ${t.activity}`)
  ].join('\n');
  navigator.clipboard.writeText(lines).then(() => showToast('📋 Plan copied to clipboard!'));
}

function savePlan() {
  if (!state.currentPlan) return;
  const json = JSON.stringify(state.currentPlan, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `studyplan_${state.currentPlan.subject}_${Date.now()}.json`;
  a.click();
  showToast('💾 Plan saved!');
}

// ─── SESSION TRACKING ─────────────────────────
function saveSession(plan) {
  const session = {
    id: Date.now(),
    date: new Date().toLocaleDateString(),
    time: new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }),
    subject: plan.subject,
    mood: plan.mood,
    duration: plan.time,
    focusScore: plan.focusScore || 75,
    tasks: plan.tasks.length,
  };
  state.sessions.unshift(session);
  if (state.sessions.length > 20) state.sessions = state.sessions.slice(0, 20);
  localStorage.setItem('studymind_sessions', JSON.stringify(state.sessions));
  updateStreak();
  renderTracker();
}

function updateStreak() {
  const today = new Date().toLocaleDateString();
  const lastDate = localStorage.getItem('studymind_last_date');
  if (lastDate !== today) {
    state.streak++;
    localStorage.setItem('studymind_streak', state.streak);
    localStorage.setItem('studymind_last_date', today);
    document.getElementById('streakCount').textContent = state.streak;
  }
}

function clearHistory() {
  state.sessions = [];
  state.streak = 0;
  localStorage.removeItem('studymind_sessions');
  localStorage.removeItem('studymind_streak');
  localStorage.removeItem('studymind_last_date');
  document.getElementById('streakCount').textContent = 0;
  renderTracker();
  showToast('🗑️ History cleared!');
}

function renderTracker() {
  const s = state.sessions;
  if (s.length === 0) {
    document.getElementById('trackerEmpty').style.display = 'block';
    document.getElementById('trackerContent').style.display = 'none';
    return;
  }

  document.getElementById('trackerEmpty').style.display = 'none';
  document.getElementById('trackerContent').style.display = 'block';

  // Stats
  const totalMin = s.reduce((a, x) => a + (x.duration || 0), 0);
  const avgFocus = Math.round(s.reduce((a, x) => a + (x.focusScore || 75), 0) / s.length);
  const subjectCounts = {};
  s.forEach(x => { subjectCounts[x.subject] = (subjectCounts[x.subject] || 0) + 1; });
  const topSubject = Object.entries(subjectCounts).sort((a,b) => b[1]-a[1])[0]?.[0] || '—';

  document.getElementById('totalTime').textContent =
    totalMin >= 60 ? `${Math.floor(totalMin/60)}h ${totalMin%60}m` : `${totalMin}m`;
  document.getElementById('totalSessions').textContent = s.length;
  document.getElementById('avgFocus').textContent = avgFocus + '%';
  document.getElementById('topSubject').textContent = topSubject;

  // Weak topics: subjects with low avg focus
  const weakMap = {};
  s.forEach(x => {
    if (!weakMap[x.subject]) weakMap[x.subject] = [];
    weakMap[x.subject].push(x.focusScore || 75);
  });
  const weak = Object.entries(weakMap)
    .map(([sub, scores]) => ({ sub, avg: Math.round(scores.reduce((a,b)=>a+b,0)/scores.length) }))
    .filter(x => x.avg < 70)
    .slice(0, 4);

  const weakEl = document.getElementById('weakTopics');
  if (weak.length > 0) {
    weakEl.innerHTML = `
      <div class="weak-topic-title">⚠️ Weak Areas – Needs More Practice</div>
      <div class="weak-list">${weak.map(w => `<span class="weak-tag">📌 ${w.sub} (${w.avg}% focus)</span>`).join('')}</div>
    `;
  } else {
    weakEl.innerHTML = `<div class="weak-topic-title" style="color:var(--accent3)">✅ No weak areas detected! Great focus across all subjects.</div>`;
  }

  // Session list
  const listEl = document.getElementById('sessionList');
  listEl.innerHTML = s.slice(0, 8).map(x => `
    <div class="session-item">
      <span class="session-mood">${MOOD_EMOJIS[x.mood] || '😐'}</span>
      <div class="session-info">
        <div class="session-subject">${x.subject}</div>
        <div class="session-time">${x.date} at ${x.time} • ${x.duration}min • ${x.tasks} tasks</div>
      </div>
      <span class="session-score">${x.focusScore}% focus</span>
    </div>
  `).join('');
}

// ─── HELPERS ──────────────────────────────────
function capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}
