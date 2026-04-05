document.addEventListener('DOMContentLoaded', () => {

    const APP_STATE = {
        user: JSON.parse(localStorage.getItem('study_user')) || null,
        currentMood: 'normal',
        sessions: JSON.parse(localStorage.getItem('study_sessions')) || [],
        currentPlan: null,
        timerInterval: null,
        timeLeft: 0,
        currentTaskIndex: 0,
        isBreak: false
    };

    // UI Elements - Gen AI Planner
    const moodOptions = document.querySelectorAll('.mood-option');
    const freeMoodInput = document.getElementById('free-mood-input');
    const detectMoodBtn = document.getElementById('detect-mood-btn');
    const timeSlider = document.getElementById('time-slider');
    const timeDisplay = document.getElementById('time-display');
    const generateBtn = document.getElementById('generate-btn');
    const subjectInput = document.getElementById('subject-input');
    const difficultySelect = document.getElementById('difficulty-select');
    
    // Planner views
    const planOutput = document.getElementById('plan-output');
    const motivationList = document.getElementById('motivation-list');
    const planTitle = document.getElementById('plan-title');
    const tasksList = document.getElementById('tasks-list');
    const startTimerBtn = document.getElementById('start-timer-btn');

    // Tracker UI Elements
    const statTime = document.getElementById('stat-time');
    const statTasks = document.getElementById('stat-tasks');
    const statScore = document.getElementById('stat-score');
    const statStreak = document.getElementById('stat-streak');
    const analyzeBtn = document.getElementById('analyze-topics-btn');
    const historyList = document.getElementById('session-history-list');

    // Timer UI Elements
    const focusView = document.getElementById('focus-view');
    const plannerView = document.getElementById('planner-view');
    const trackerView = document.getElementById('tracker-view');
    const timerDisplay = document.getElementById('timer-display');
    const currentTaskTitle = document.getElementById('current-task-display');
    const exitTimerBtn = document.getElementById('exit-focus-btn');
    const playPauseBtn = document.getElementById('timer-play-pause');
    const skipBtn = document.getElementById('timer-skip');

    // Nav
    const navHome = document.getElementById('nav-home');
    const navTracker = document.getElementById('nav-tracker');
    const navLogout = document.getElementById('nav-logout');
    const navLogin = document.getElementById('nav-login');

    // Check auth
    const isAuthPage = document.getElementById('login-form') !== null;
    
    if (isAuthPage) {
        initAuth();
    } else {
        if (!APP_STATE.user) {
            window.location.href = '/auth';
            return;
        }
        navLogin.classList.add('hidden');
        navLogout.classList.remove('hidden');
        initPlanner();
    }

    /* --- TOAST NOTIFICATIONS --- */
    function showToast(message, type='success') {
        const container = document.getElementById('toast-container');
        if(!container) return;
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<span>${type === 'error' ? '❌' : '✅'}</span> ${message}`;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.animation = 'fadeIn 0.3s reverse';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    /* --- API HELPERS --- */
    async function apiCall(endpoint, payload) {
        try {
            const res = await fetch(`http://127.0.0.1:5000${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if(!data.success) throw new Error(data.error || 'Server error');
            return data;
        } catch (e) {
            showToast(e.message, 'error');
            return null;
        }
    }

    /* --- AUTH PAGE LOGIC --- */
    function initAuth() {
        const authTabs = document.querySelectorAll('.auth-tab');
        const loginForm = document.getElementById('login-form');
        const signupForm = document.getElementById('signup-form');
        const strengthBar = document.getElementById('strength-bar');
        const strengthText = document.getElementById('strength-text');
        const togglePasswords = document.querySelectorAll('.toggle-password');

        authTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                authTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                if (tab.dataset.target === 'login-form') {
                    loginForm.classList.add('active-form');
                    loginForm.classList.remove('hidden');
                    signupForm.classList.remove('active-form');
                    signupForm.classList.add('hidden');
                } else {
                    signupForm.classList.add('active-form');
                    signupForm.classList.remove('hidden');
                    loginForm.classList.remove('active-form');
                    loginForm.classList.add('hidden');
                }
            });
        });

        togglePasswords.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const input = e.target.previousElementSibling;
                if(input.type === 'password') {
                    input.type = 'text';
                    btn.textContent = '🙈';
                } else {
                    input.type = 'password';
                    btn.textContent = '👁️';
                }
            });
        });

        // Strength Meter
        const passInput = document.getElementById('signup-password');
        if(passInput) {
            passInput.addEventListener('input', (e) => {
                const val = e.target.value;
                let strength = 0;
                if(val.length > 5) strength += 25;
                if(val.length > 8) strength += 25;
                if(/[A-Z]/.test(val)) strength += 25;
                if(/[0-9]/.test(val) && /[^A-Za-z0-9]/.test(val)) strength += 25;

                strengthBar.style.width = `${Math.min(strength, 100)}%`;
                if(strength < 50) { strengthBar.style.backgroundColor = 'var(--danger)'; strengthText.textContent = 'Weak'; }
                else if(strength < 75) { strengthBar.style.backgroundColor = 'var(--warn)'; strengthText.textContent = 'Fair'; }
                else if(strength < 100) { strengthBar.style.backgroundColor = 'var(--accent)'; strengthText.textContent = 'Good'; }
                else { strengthBar.style.backgroundColor = 'var(--accent3)'; strengthText.textContent = 'Strong'; }
            });
        }

        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            localStorage.setItem('study_user', JSON.stringify({ email }));
            showToast('Login successful!');
            setTimeout(() => window.location.href = '/', 1000);
        });

        signupForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const pass = document.getElementById('signup-password').value;
            const confirm = document.getElementById('signup-confirm').value;
            if(pass !== confirm) return showToast('Passwords do not match', 'error');
            const email = document.getElementById('signup-email').value;
            const fname = document.getElementById('signup-fname').value;
            localStorage.setItem('study_user', JSON.stringify({ email, fname }));
            showToast('Account created successfully!');
            setTimeout(() => window.location.href = '/', 1000);
        });
    }

    /* --- PLANNER PAGE LOGIC --- */
    function initPlanner() {
        // Nav Switch
        navHome.addEventListener('click', () => { navHome.classList.add('active'); navTracker.classList.remove('active'); plannerView.classList.remove('hidden'); trackerView.classList.add('hidden'); focusView.classList.add('hidden'); });
        navTracker.addEventListener('click', () => { navTracker.classList.add('active'); navHome.classList.remove('active'); trackerView.classList.remove('hidden'); plannerView.classList.add('hidden'); focusView.classList.add('hidden'); updateTrackerUI(); });
        navLogout.addEventListener('click', () => { localStorage.removeItem('study_user'); window.location.href = '/auth'; });

        // Mood Selection
        moodOptions.forEach(opt => {
            opt.addEventListener('click', () => {
                moodOptions.forEach(o => o.classList.remove('active'));
                opt.classList.add('active');
                APP_STATE.currentMood = opt.dataset.mood;
            });
        });

        timeSlider.addEventListener('input', (e) => timeDisplay.textContent = e.target.value);

        // Auto Detect Mood
        detectMoodBtn.addEventListener('click', async () => {
            const text = freeMoodInput.value.trim();
            if(!text) return showToast('Please enter how you feel first', 'error');
            
            detectMoodBtn.textContent = 'Detecting...';
            detectMoodBtn.disabled = true;
            const data = await apiCall('/api/detect-mood', { text });
            detectMoodBtn.textContent = 'Auto Detect';
            detectMoodBtn.disabled = false;

            if(data && data.mood) {
                APP_STATE.currentMood = data.mood;
                moodOptions.forEach(o => {
                    o.classList.remove('active');
                    if(o.dataset.mood === data.mood) o.classList.add('active');
                });
                showToast(`Mood detected: ${data.mood} (Confidence: ${Math.round(data.confidence*100)}%)`);
            }
        });

        // Generate Plan
        generateBtn.addEventListener('click', async () => {
            const subject = subjectInput.value.trim();
            if(!subject) return showToast('Please enter a subject', 'error');

            const btnText = generateBtn.querySelector('.btn-text');
            const loader = document.getElementById('generate-loading');
            
            btnText.classList.add('hidden');
            loader.classList.remove('hidden');
            generateBtn.disabled = true;

            const payload = {
                mood: APP_STATE.currentMood,
                subject,
                time: parseInt(timeSlider.value),
                difficulty: difficultySelect.value
            };

            // Run motivation and plan generation 
            const [planRes, motRes] = await Promise.all([
                apiCall('/generate-plan', payload),
                apiCall('/api/motivation', payload)
            ]);

            btnText.classList.remove('hidden');
            loader.classList.add('hidden');
            generateBtn.disabled = false;

            if(planRes && planRes.plan) {
                APP_STATE.currentPlan = planRes.plan;
                APP_STATE.currentPlan.subject = subject;
                renderPlan(planRes.plan, motRes ? motRes.messages : []);
                showToast('Study Plan Generated!');
                planOutput.scrollIntoView({ behavior: 'smooth' });
            }
        });
        
        // Start Timer
        startTimerBtn.addEventListener('click', () => {
            if(!APP_STATE.currentPlan || !APP_STATE.currentPlan.tasks || APP_STATE.currentPlan.tasks.length === 0) return;
            APP_STATE.currentTaskIndex = 0;
            plannerView.classList.add('hidden');
            focusView.classList.remove('hidden');
            setupTimerForCurrentTask();
        });

        // Timer Controls
        exitTimerBtn.addEventListener('click', () => {
            clearInterval(APP_STATE.timerInterval);
            focusView.classList.add('hidden');
            plannerView.classList.remove('hidden');
        });

        playPauseBtn.addEventListener('click', () => {
            if(APP_STATE.timerInterval) {
                clearInterval(APP_STATE.timerInterval);
                APP_STATE.timerInterval = null;
                playPauseBtn.textContent = 'Resume';
            } else {
                startTimer();
                playPauseBtn.textContent = 'Pause';
            }
        });

        skipBtn.addEventListener('click', nextTask);

        // Tracker Handlers
        analyzeBtn.addEventListener('click', async () => {
            if(APP_STATE.sessions.length === 0) return showToast('No sessions to analyze yet', 'error');
            analyzeBtn.textContent = 'Analyzing...';
            analyzeBtn.disabled = true;
            
            const data = await apiCall('/api/analyze-weak-topics', { sessions: APP_STATE.sessions });
            
            analyzeBtn.textContent = 'Analyze My Performance';
            analyzeBtn.disabled = false;

            if(data) {
                document.getElementById('ai-analysis-output').classList.remove('hidden');
                document.getElementById('analysis-rec').textContent = data.recommendation || '';
                document.getElementById('analysis-weak').textContent = (data.weakTopics || []).join(', ');
                document.getElementById('analysis-strong').textContent = (data.strongTopics || []).join(', ');
                document.getElementById('analysis-method').textContent = data.suggestedMethod || '';
                document.getElementById('analysis-time').textContent = data.bestStudyTime || '';
            }
        });
    }

    function renderPlan(plan, messages) {
        planOutput.classList.remove('hidden');
        planTitle.textContent = plan.title || 'Your Custom Study Plan';
        
        motivationList.innerHTML = '';
        if(messages && messages.length > 0) {
            messages.forEach(msg => {
                const li = document.createElement('li');
                li.textContent = msg;
                motivationList.appendChild(li);
            });
        } else if (plan.motivation) {
            const li = document.createElement('li');
            li.textContent = plan.motivation;
            motivationList.appendChild(li);
        }

        tasksList.innerHTML = '';
        if (plan.tasks && plan.tasks.length > 0) {
            plan.tasks.forEach(task => {
                const div = document.createElement('div');
                div.className = 'task-item';
                div.innerHTML = `
                    <div class="task-icon">${task.icon || (task.type === 'study' ? '📖' : '☕')}</div>
                    <div class="task-details">
                        <strong>${task.activity}</strong>
                        <span class="task-duration">${task.duration} mins ${task.type === 'break' ? '(Break)' : '(Focus)'}</span>
                    </div>
                `;
                tasksList.appendChild(div);
            });
        } else {
            tasksList.innerHTML = '<p>No specific tasks generated. Start focusing anyway!</p>';
        }
    }

    function setupTimerForCurrentTask() {
        if(APP_STATE.currentTaskIndex >= APP_STATE.currentPlan.tasks.length) {
            finishSession();
            return;
        }
        
        const task = APP_STATE.currentPlan.tasks[APP_STATE.currentTaskIndex];
        currentTaskTitle.textContent = (task.icon || '') + " " + task.activity;
        APP_STATE.timeLeft = task.duration * 60;
        APP_STATE.isBreak = task.type === 'break';
        
        timerDisplay.style.background = APP_STATE.isBreak ? 'linear-gradient(135deg, var(--accent3), var(--accent))' : 'linear-gradient(135deg, var(--warn), var(--danger))';
        if(!APP_STATE.isBreak) timerDisplay.style.background = 'linear-gradient(135deg, var(--accent), var(--accent2))';
        timerDisplay.style.webkitBackgroundClip = 'text';
        timerDisplay.style.webkitTextFillColor = 'transparent';

        const tips = APP_STATE.currentPlan.tips || ['Keep your phone away during the session.', 'Stay hydrated!', 'Focus on one thing at a time.', 'You are doing great!'];
        document.getElementById('distraction-tip-text').textContent = tips[Math.floor(Math.random() * tips.length)];

        updateTimerDisplay();
        playPauseBtn.textContent = 'Pause';
        startTimer();
    }

    function startTimer() {
        clearInterval(APP_STATE.timerInterval);
        APP_STATE.timerInterval = setInterval(() => {
            APP_STATE.timeLeft--;
            updateTimerDisplay();
            if(APP_STATE.timeLeft <= 0) {
                clearInterval(APP_STATE.timerInterval);
                showToast('Interval finished!');
                var audio = new Audio('https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3');
                audio.play().catch(e => console.log('Audio playback prevented by browser:', e));
                nextTask();
            }
        }, 1000);
    }

    function nextTask() {
        APP_STATE.currentTaskIndex++;
        setupTimerForCurrentTask();
    }

    function updateTimerDisplay() {
        const m = Math.floor(APP_STATE.timeLeft / 60);
        const s = APP_STATE.timeLeft % 60;
        timerDisplay.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }

    function finishSession() {
        clearInterval(APP_STATE.timerInterval);
        showToast('Study Session Complete! 🎉');
        
        // Save to history
        const sessionRecord = {
            date: new Date().toISOString(),
            subject: APP_STATE.currentPlan.subject,
            mood: APP_STATE.currentMood,
            score: APP_STATE.currentPlan.focusScore || 85,
            tasksCompleted: APP_STATE.currentPlan.tasks.filter(t => t.type==='study').length,
            timeSpent: APP_STATE.currentPlan.tasks.reduce((acc, t) => acc + (t.type==='study' ? t.duration : 0), 0)
        };
        
        APP_STATE.sessions.push(sessionRecord);
        localStorage.setItem('study_sessions', JSON.stringify(APP_STATE.sessions));
        
        focusView.classList.add('hidden');
        trackerView.classList.remove('hidden');
        navHome.classList.remove('active');
        navTracker.classList.add('active');
        updateTrackerUI();
    }

    function updateTrackerUI() {
        if(APP_STATE.sessions.length === 0) return;
        
        // Calculate totals for today
        const today = new Date().toDateString();
        const todaysSessions = APP_STATE.sessions.filter(s => new Date(s.date).toDateString() === today);
        
        const totalTime = todaysSessions.reduce((acc, s) => acc + s.timeSpent, 0);
        const totalTasks = todaysSessions.reduce((acc, s) => acc + s.tasksCompleted, 0);
        const avgScore = todaysSessions.length ? Math.round(todaysSessions.reduce((acc, s) => acc + s.score, 0) / todaysSessions.length) : 0;
        
        statTime.textContent = totalTime + 'm';
        statTasks.textContent = totalTasks;
        statScore.textContent = avgScore + '%';
        statStreak.textContent = APP_STATE.sessions.length > 0 ? '1 🔥' : '0 🔥';

        // Render History
        historyList.innerHTML = '';
        [...APP_STATE.sessions].reverse().slice(0, 10).forEach(s => {
            const div = document.createElement('div');
            div.className = 'history-item fade-in';
            const emj = s.mood === 'motivated' ? '😊' : s.mood === 'tired' ? '😴' : s.mood === 'stressed' ? '😟' : '😐';
            div.innerHTML = `
                <div class="history-item-left">
                    <span class="history-emoji">${emj}</span>
                    <div class="history-details">
                        <strong>${s.subject}</strong>
                        <p style="font-size:0.8rem; color:var(--muted)">${new Date(s.date).toLocaleDateString()}</p>
                    </div>
                </div>
                <div class="history-score">${s.score}% Focus</div>
            `;
            historyList.appendChild(div);
        });
    }

});
