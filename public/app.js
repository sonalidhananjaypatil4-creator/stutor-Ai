document.addEventListener('DOMContentLoaded', () => {
  // Elements Selection
  const htmlElement = document.documentElement;
  
  // Theme Toggle Elements
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  const themeIcon = document.getElementById('theme-icon');

  // Language Selector
  const languageSelect = document.getElementById('language-select');

  // Sidebar Elements
  const sidebar = document.getElementById('sidebar');
  const sidebarBackdrop = document.getElementById('sidebar-backdrop');
  const hamburgerBtn = document.getElementById('hamburger-btn');
  const historyList = document.getElementById('history-list');
  const newSessionBtn = document.getElementById('new-session-btn');
  const clearHistoryBtn = document.getElementById('clear-history-btn');

  // Form Elements
  const questionInput = document.getElementById('question-input');
  const questionCharCount = document.getElementById('question-char-count');
  const questionError = document.getElementById('question-error');

  const attemptInput = document.getElementById('attempt-input');
  const attemptCharCount = document.getElementById('attempt-char-count');
  const attemptValidationMsg = document.getElementById('attempt-validation-msg');
  const attemptStamp = document.getElementById('attempt-stamp');

  const actionRow = document.getElementById('action-row');
  const getHintBtn = document.getElementById('get-hint-btn');
  const errorContainer = document.getElementById('error-container');
  const errorText = document.getElementById('error-text');

  const tutorLoader = document.getElementById('tutor-loader');
  const responseSection = document.getElementById('response-section');
  const hintContent = document.getElementById('hint-content');
  const stuckRow = document.getElementById('stuck-row');

  const showExplainBtn = document.getElementById('show-explain-btn');
  const explainLoader = document.getElementById('explain-loader');
  const explanationCard = document.getElementById('explanation-card');
  const explainContent = document.getElementById('explain-content');
  const newQuestionBtn = document.getElementById('new-question-btn');
  const pastSessionBanner = document.getElementById('past-session-banner');

  // Feedback Rating Elements
  const hintThumbsUp = document.getElementById('hint-thumbs-up');
  const hintThumbsDown = document.getElementById('hint-thumbs-down');
  const explainThumbsUp = document.getElementById('explain-thumbs-up');
  const explainThumbsDown = document.getElementById('explain-thumbs-down');

  // Toast Container
  const toastContainer = document.getElementById('toast-container');

  // Input limits constants
  const MAX_COMBINED_CHARACTERS = 4000;
  const MIN_ATTEMPT_CHARACTERS = 25;

  // Session State
  let currentSessionId = null;
  let isReadOnly = false;

  /* ============================================================
     THEME MANAGEMENT
     ============================================================ */
  const sunIconSvg = `
    <circle cx="12" cy="12" r="5"></circle>
    <line x1="12" y1="1" x2="12" y2="3"></line>
    <line x1="12" y1="21" x2="12" y2="23"></line>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
    <line x1="1" y1="12" x2="3" y2="12"></line>
    <line x1="21" y1="12" x2="23" y2="12"></line>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
  `;

  const moonIconSvg = `
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
  `;

  function setTheme(theme) {
    htmlElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme-preference', theme);
    
    if (theme === 'dark') {
      themeIcon.innerHTML = sunIconSvg;
      themeToggleBtn.setAttribute('title', 'Switch to Light Mode');
      themeToggleBtn.setAttribute('aria-label', 'Switch to Light Mode');
    } else {
      themeIcon.innerHTML = moonIconSvg;
      themeToggleBtn.setAttribute('title', 'Switch to Dark Mode');
      themeToggleBtn.setAttribute('aria-label', 'Switch to Dark Mode');
    }
  }

  function initTheme() {
    const savedTheme = localStorage.getItem('theme-preference');
    if (savedTheme) {
      setTheme(savedTheme);
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setTheme(prefersDark ? 'dark' : 'light');
    }
  }

  themeToggleBtn.addEventListener('click', () => {
    const currentTheme = htmlElement.getAttribute('data-theme');
    setTheme(currentTheme === 'dark' ? 'light' : 'dark');
  });

  /* ============================================================
     MULTI-LANGUAGE SUPPORT
     ============================================================ */
  function updateUILanguage() {
    const currentLang = languageSelect.value;
    const dict = window.APP_TRANSLATIONS[currentLang];
    if (!dict) return;

    // Headers & Navigation
    document.getElementById('logo-text').textContent = dict.appTitle;
    document.getElementById('app-title').textContent = dict.appTitle;
    document.getElementById('app-subtitle').textContent = dict.appSubtitle;
    document.getElementById('sidebar-title').textContent = dict.sidebarTitle;
    newSessionBtn.textContent = dict.newQuestionBtn;
    clearHistoryBtn.textContent = dict.clearHistoryBtn;

    // Form inputs
    document.getElementById('question-label').textContent = dict.questionLabel;
    questionInput.setAttribute('placeholder', dict.questionPlaceholder);
    document.getElementById('attempt-label').textContent = dict.attemptLabel;
    attemptInput.setAttribute('placeholder', dict.attemptPlaceholder);

    // Stamp text
    document.getElementById('stamp-text').textContent = dict.attemptedStamp;
    
    // Action trigger button text
    document.getElementById('get-hint-btn-text').textContent = dict.getHintBtn;

    // Loader messages
    document.getElementById('tutor-loader-message').textContent = dict.tutorLoaderText;
    document.getElementById('explain-loader-message').textContent = dict.explainLoaderText;

    // Feedback response titles
    document.getElementById('response-hint-title').textContent = dict.responseHintTitle;
    document.getElementById('response-explanation-title').textContent = dict.responseExplanationTitle;

    // Stuck link replacement (preserving anchor click listener)
    const stuckTextEl = document.getElementById('stuck-text');
    if (stuckTextEl && stuckTextEl.firstChild) {
      stuckTextEl.firstChild.textContent = dict.stuckText;
    }
    showExplainBtn.textContent = dict.showExplainLinkText;

    // Bottom action and disclaimers
    newQuestionBtnFooter.textContent = dict.newQuestionBtnFooter;
    document.getElementById('app-footer').textContent = dict.disclaimer;
    document.getElementById('past-session-banner-text').textContent = dict.readOnlyBannerText;

    // Feedback title texts
    document.getElementById('hint-feedback-label').textContent = dict.feedbackHeading;
    document.getElementById('explain-feedback-label').textContent = dict.feedbackHeading;

    // Dynamic field refreshes
    updateFormState();
    renderSidebarHistory();
  }

  function initLanguage() {
    const savedLanguage = localStorage.getItem('language-preference') || 'en';
    languageSelect.value = savedLanguage;
    updateUILanguage();
  }

  languageSelect.addEventListener('change', () => {
    const currentLang = languageSelect.value;
    localStorage.setItem('language-preference', currentLang);
    updateUILanguage();
    
    const dict = window.APP_TRANSLATIONS[currentLang];
    showToast(dict.toastLanguageUpdated);
  });

  /* ============================================================
     TOAST NOTIFICATION SYSTEM
     ============================================================ */
  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 3000);
  }

  /* ============================================================
     MOBILE SIDEBAR DRAWER CONTROLS
     ============================================================ */
  function toggleSidebar() {
    sidebar.classList.toggle('active');
    sidebarBackdrop.classList.toggle('active');
  }

  function closeSidebar() {
    sidebar.classList.remove('active');
    sidebarBackdrop.classList.remove('active');
  }

  hamburgerBtn.addEventListener('click', toggleSidebar);
  sidebarBackdrop.addEventListener('click', closeSidebar);

  /* ============================================================
     MATH RENDERING (KATEX)
     ============================================================ */
  function renderMath(element) {
    if (typeof renderMathInElement === 'function') {
      try {
        renderMathInElement(element, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false }
          ],
          throwOnError: false
        });
      } catch (err) {
        console.error('KaTeX rendering error:', err);
      }
    }
  }

  /* ============================================================
     ATTEMPT GATE VALIDATION HEURISTICS
     ============================================================ */
  function getCleanedText(text) {
    return text.trim();
  }

  function validateAttempt(text) {
    const trimmed = getCleanedText(text);

    if (trimmed.length < MIN_ATTEMPT_CHARACTERS) {
      return {
        isValid: false,
        type: 'short',
        rem: MIN_ATTEMPT_CHARACTERS - trimmed.length
      };
    }

    // Heuristics to check for gaming the gate (plain repetition)
    // 1. Unique set of characters (guarding against things like 'aaaaaaaaaaaaaaaaaaaaaaaaa')
    const charList = trimmed.replace(/\s+/g, '').toLowerCase();
    const uniqueChars = new Set(charList);
    if (uniqueChars.size < 4) {
      return {
        isValid: false,
        type: 'character_repetition'
      };
    }

    // 2. Repetitive words (guarding against things like 'hello hello hello hello hello...')
    const words = trimmed.toLowerCase().split(/\s+/).filter(w => w.length > 0);
    if (words.length > 3) {
      const uniqueWords = new Set(words);
      // If the number of unique words is very low relative to total words
      if (uniqueWords.size < words.length * 0.35) {
        return {
          isValid: false,
          type: 'word_repetition'
        };
      }
    }

    return {
      isValid: true,
      type: 'success'
    };
  }

  function updateFormState() {
    const dict = window.APP_TRANSLATIONS[languageSelect.value];
    if (!dict) return;

    if (isReadOnly) {
      attemptValidationMsg.textContent = dict.attemptValidationMsgReadOnly;
      attemptValidationMsg.style.color = "var(--text-secondary)";
      return; // Keep form in read-only visual state
    }

    const questionText = questionInput.value;
    const attemptText = attemptInput.value;

    const trimmedQuestion = questionText.trim();
    const cleanAttempt = getCleanedText(attemptText);

    // Question validation/chars
    questionCharCount.textContent = `${questionText.length} / ${MAX_COMBINED_CHARACTERS}`;
    
    // Attempt validation/chars
    const attemptValidation = validateAttempt(attemptText);
    attemptCharCount.textContent = `${cleanAttempt.length} / ${MIN_ATTEMPT_CHARACTERS}`;

    // Show messages
    if (cleanAttempt.length === 0) {
      attemptValidationMsg.textContent = dict.attemptValidationMsgEmpty;
      attemptValidationMsg.style.color = "var(--text-secondary)";
      attemptStamp.classList.remove('stamp-active');
    } else if (!attemptValidation.isValid) {
      if (attemptValidation.type === 'short') {
        attemptValidationMsg.textContent = dict.attemptValidationMsgShort.replace('{chars}', attemptValidation.rem);
      } else if (attemptValidation.type === 'character_repetition') {
        attemptValidationMsg.textContent = dict.attemptValidationMsgRepetition;
      } else if (attemptValidation.type === 'word_repetition') {
        attemptValidationMsg.textContent = dict.attemptValidationMsgWordRepetition;
      }
      attemptValidationMsg.style.color = "var(--error-text)";
      attemptStamp.classList.remove('stamp-active');
    } else {
      attemptValidationMsg.textContent = dict.attemptValidationMsgSuccess;
      attemptValidationMsg.style.color = "var(--success-color)";
      attemptStamp.classList.add('stamp-active');
    }

    // Combined length validation
    const combinedLength = questionText.length + attemptText.length;
    if (combinedLength > MAX_COMBINED_CHARACTERS) {
      questionError.textContent = `Warning: Combined length exceeds ${MAX_COMBINED_CHARACTERS} characters.`;
    } else {
      questionError.textContent = "";
    }

    // Lock/Unlock Button Status
    const isQuestionOk = trimmedQuestion.length > 0;
    const isAttemptOk = attemptValidation.type === 'success';
    const isCombinedOk = combinedLength <= MAX_COMBINED_CHARACTERS;

    if (isQuestionOk && isAttemptOk && isCombinedOk) {
      getHintBtn.disabled = false;
      getHintBtn.classList.remove('disabled');
      getHintBtn.classList.add('unlocked');
      getHintBtn.innerHTML = `<span class="btn-lock-icon">🔓</span> <span id="get-hint-btn-text">${dict.getHintBtn}</span>`;
    } else {
      getHintBtn.disabled = true;
      getHintBtn.classList.remove('unlocked');
      getHintBtn.classList.add('disabled');
      getHintBtn.innerHTML = `<span class="btn-lock-icon">🔒</span> <span id="get-hint-btn-text">${dict.getHintBtn}</span>`;
    }
  }

  // Setup event listeners for inputs
  questionInput.addEventListener('input', updateFormState);
  attemptInput.addEventListener('input', updateFormState);

  /* ============================================================
     LOCAL STORAGE SESSION MANAGER
     ============================================================ */
  function getRelativeTime(timestamp) {
    const diff = Date.now() - timestamp;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 172800000) return 'Yesterday';
    return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function getSessions() {
    return JSON.parse(localStorage.getItem('session-history') || '[]');
  }

  function saveSessions(sessions) {
    localStorage.setItem('session-history', JSON.stringify(sessions));
  }

  function renderSidebarHistory() {
    historyList.innerHTML = '';
    const sessions = getSessions();
    const currentLang = languageSelect.value;
    const dict = window.APP_TRANSLATIONS[currentLang];

    if (sessions.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.style.padding = '20px';
      emptyMsg.style.textAlign = 'center';
      emptyMsg.style.color = 'var(--text-secondary)';
      emptyMsg.style.fontSize = '0.85rem';
      emptyMsg.textContent = dict.noPastSessions;
      historyList.appendChild(emptyMsg);
      return;
    }

    sessions.forEach(session => {
      const item = document.createElement('div');
      item.className = 'history-item';
      item.setAttribute('tabindex', '0');
      item.setAttribute('role', 'button');
      item.setAttribute('aria-label', `Session: ${session.question.slice(0, 30)}`);
      
      if (session.id === currentSessionId) {
        item.classList.add('active');
      }

      // Truncated preview (40 chars)
      const preview = session.question.length > 40
        ? session.question.slice(0, 40) + '...'
        : session.question;

      const previewDiv = document.createElement('div');
      previewDiv.className = 'history-item-preview';
      previewDiv.textContent = preview;

      const timeDiv = document.createElement('div');
      timeDiv.className = 'history-item-time';
      timeDiv.textContent = getRelativeTime(session.timestamp);

      item.appendChild(previewDiv);
      item.appendChild(timeDiv);

      // Mouse Click
      item.addEventListener('click', () => {
        loadSession(session.id);
        closeSidebar();
      });

      // Keyboard navigation
      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          loadSession(session.id);
          closeSidebar();
        }
      });

      historyList.appendChild(item);
    });
  }

  function loadSession(id) {
    const sessions = getSessions();
    const session = sessions.find(s => s.id === id);
    if (!session) return;

    currentSessionId = id;
    isReadOnly = true;

    const dict = window.APP_TRANSLATIONS[languageSelect.value];

    // Show past banner
    pastSessionBanner.classList.remove('hidden');

    // Populate values
    questionInput.value = session.question;
    attemptInput.value = session.attempt;
    
    // Set readOnly on inputs
    questionInput.readOnly = true;
    attemptInput.readOnly = true;

    // Update character counters statically
    questionCharCount.textContent = `${session.question.length} / ${MAX_COMBINED_CHARACTERS}`;
    attemptCharCount.textContent = `${session.attempt.length} / ${MIN_ATTEMPT_CHARACTERS}`;

    // Hide input error
    questionError.textContent = "";
    attemptValidationMsg.textContent = dict.attemptValidationMsgReadOnly;
    attemptValidationMsg.style.color = "var(--text-secondary)";

    // Set stamp state active since it must have been validated
    attemptStamp.classList.add('stamp-active');

    // Hide input action row
    actionRow.classList.add('hidden');

    // Load responses
    hintContent.textContent = session.hint;
    renderMath(hintContent);
    responseSection.classList.remove('hidden');
    
    // Render ratings for hint (disabled in read-only mode)
    disableFeedbackButtons('hint');
    highlightFeedbackButtons('hint', session.hintFeedback);

    if (session.fullExplanation) {
      explainContent.textContent = session.fullExplanation;
      renderMath(explainContent);
      explanationCard.classList.remove('hidden');
      stuckRow.classList.add('hidden');
      
      // Render ratings for explanation (disabled in read-only mode)
      disableFeedbackButtons('explain');
      highlightFeedbackButtons('explain', session.explainFeedback);
    } else {
      explainContent.textContent = '';
      explanationCard.classList.add('hidden');
      stuckRow.classList.add('hidden');
    }

    // Hide loaders & errors
    tutorLoader.classList.add('hidden');
    explainLoader.classList.add('hidden');
    errorContainer.classList.add('hidden');

    // Rerender sidebar to show active item highlight
    renderSidebarHistory();
  }

  function startNewSession() {
    currentSessionId = null;
    isReadOnly = false;

    // Reset banner
    pastSessionBanner.classList.add('hidden');

    // Reset inputs
    questionInput.value = '';
    attemptInput.value = '';
    questionInput.readOnly = false;
    attemptInput.readOnly = false;

    // Hide responses & elements
    responseSection.classList.add('hidden');
    errorContainer.classList.add('hidden');
    tutorLoader.classList.add('hidden');
    explainLoader.classList.add('hidden');
    explanationCard.classList.add('hidden');
    stuckRow.classList.remove('hidden');
    actionRow.classList.remove('hidden');

    // Clear old responses text
    hintContent.textContent = '';
    explainContent.textContent = '';
    errorText.textContent = '';

    // Enable feedback buttons for fresh sessions
    enableFeedbackButtons('hint');
    enableFeedbackButtons('explain');
    resetFeedbackButtonsVisuals('hint');
    resetFeedbackButtonsVisuals('explain');

    // Re-run gate logic
    updateFormState();
    renderSidebarHistory();

    // Send focus back to the question field
    questionInput.focus();
  }

  // Bind New Session Buttons
  newSessionBtn.addEventListener('click', () => {
    startNewSession();
    closeSidebar();
  });
  newQuestionBtn.addEventListener('click', startNewSession);

  // Clear History logic
  clearHistoryBtn.addEventListener('click', () => {
    const dict = window.APP_TRANSLATIONS[languageSelect.value];
    if (confirm(dict.confirmClearHistory)) {
      localStorage.removeItem('session-history');
      showToast(dict.toastHistoryCleared);
      if (isReadOnly) {
        startNewSession();
      } else {
        renderSidebarHistory();
      }
    }
  });

  /* ============================================================
     FEEDBACK RATING RENDER CONTROLLERS
     ============================================================ */
  function highlightFeedbackButtons(type, ratingValue) {
    const upBtn = document.getElementById(`${type}-thumbs-up`);
    const downBtn = document.getElementById(`${type}-thumbs-down`);
    if (!upBtn || !downBtn) return;

    upBtn.classList.remove('active');
    downBtn.classList.remove('active');

    if (ratingValue === 'helpful') {
      upBtn.classList.add('active');
    } else if (ratingValue === 'unhelpful') {
      downBtn.classList.add('active');
    }
  }

  function disableFeedbackButtons(type) {
    const upBtn = document.getElementById(`${type}-thumbs-up`);
    const downBtn = document.getElementById(`${type}-thumbs-down`);
    if (upBtn) upBtn.disabled = true;
    if (downBtn) downBtn.disabled = true;
  }

  function enableFeedbackButtons(type) {
    const upBtn = document.getElementById(`${type}-thumbs-up`);
    const downBtn = document.getElementById(`${type}-thumbs-down`);
    if (upBtn) upBtn.disabled = false;
    if (downBtn) downBtn.disabled = false;
  }

  function resetFeedbackButtonsVisuals(type) {
    const upBtn = document.getElementById(`${type}-thumbs-up`);
    const downBtn = document.getElementById(`${type}-thumbs-down`);
    if (upBtn) upBtn.classList.remove('active');
    if (downBtn) downBtn.classList.remove('active');
  }

  function registerFeedbackRating(type, ratingValue) {
    if (isReadOnly) return; // Cannot edit past sessions feedback
    if (!currentSessionId) return;

    const sessions = getSessions();
    const sessionIndex = sessions.findIndex(s => s.id === currentSessionId);
    if (sessionIndex !== -1) {
      if (type === 'hint') {
        sessions[sessionIndex].hintFeedback = ratingValue;
      } else {
        sessions[sessionIndex].explainFeedback = ratingValue;
      }
      saveSessions(sessions);
      highlightFeedbackButtons(type, ratingValue);
      
      const dict = window.APP_TRANSLATIONS[languageSelect.value];
      showToast(dict.toastFeedbackSaved);
    }
  }

  // Bind rating button click listeners
  hintThumbsUp.addEventListener('click', () => registerFeedbackRating('hint', 'helpful'));
  hintThumbsDown.addEventListener('click', () => registerFeedbackRating('hint', 'unhelpful'));
  explainThumbsUp.addEventListener('click', () => registerFeedbackRating('explain', 'helpful'));
  explainThumbsDown.addEventListener('click', () => registerFeedbackRating('explain', 'unhelpful'));

  /* ============================================================
     API OPERATIONS (HINT & EXPLANATION)
     ============================================================ */
  getHintBtn.addEventListener('click', async () => {
    if (isReadOnly) return;

    const dict = window.APP_TRANSLATIONS[languageSelect.value];

    // Hide old contents
    errorContainer.classList.add('hidden');
    responseSection.classList.add('hidden');
    explanationCard.classList.add('hidden');
    
    // Reset feedback ratings visually
    resetFeedbackButtonsVisuals('hint');
    resetFeedbackButtonsVisuals('explain');
    enableFeedbackButtons('hint');
    enableFeedbackButtons('explain');
    
    // Show spinner loader
    tutorLoader.classList.remove('hidden');

    const question = questionInput.value;
    const attempt = attemptInput.value;
    const language = languageSelect.value;

    try {
      const response = await fetch('/api/hint', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ question, attempt, language })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || dict.errorTitle);
      }

      // Display response
      hintContent.textContent = data.text;
      renderMath(hintContent);
      tutorLoader.classList.add('hidden');
      responseSection.classList.remove('hidden');
      stuckRow.classList.remove('hidden');

      // Create new session object and save it
      const newSession = {
        id: Date.now().toString(),
        question: question,
        attempt: attempt,
        hint: data.text,
        fullExplanation: null,
        hintFeedback: null,
        explainFeedback: null,
        timestamp: Date.now()
      };

      const sessions = getSessions();
      sessions.unshift(newSession); // Add to beginning (most recent first)
      saveSessions(sessions);
      currentSessionId = newSession.id;

      // Render updated list
      renderSidebarHistory();
      showToast(dict.toastSessionAdded);

    } catch (err) {
      tutorLoader.classList.add('hidden');
      errorText.textContent = err.message || dict.errorTitle;
      errorContainer.classList.remove('hidden');
    }
  });

  // POST Request to Explanation Endpoint
  showExplainBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    if (isReadOnly) return;

    const dict = window.APP_TRANSLATIONS[languageSelect.value];

    stuckRow.classList.add('hidden');
    errorContainer.classList.add('hidden');
    explainLoader.classList.remove('hidden');

    const question = questionInput.value;
    const attempt = attemptInput.value;
    const language = languageSelect.value;

    try {
      const response = await fetch('/api/explain', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ question, attempt, language })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || dict.errorTitle);
      }

      // Display Explanation
      explainContent.textContent = data.text;
      renderMath(explainContent);
      explainLoader.classList.add('hidden');
      explanationCard.classList.remove('hidden');

      // Update session in local storage with the explanation content
      if (currentSessionId) {
        const sessions = getSessions();
        const sessionIndex = sessions.findIndex(s => s.id === currentSessionId);
        if (sessionIndex !== -1) {
          sessions[sessionIndex].fullExplanation = data.text;
          saveSessions(sessions);
        }
      }

    } catch (err) {
      explainLoader.classList.add('hidden');
      stuckRow.classList.remove('hidden');
      errorText.textContent = err.message || dict.errorTitle;
      errorContainer.classList.remove('hidden');
    }
  });

  /* ============================================================
     INITIAL STATE SEED
     ============================================================ */
  initTheme();
  initLanguage();
});
