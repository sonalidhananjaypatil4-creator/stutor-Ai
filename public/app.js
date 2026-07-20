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
  const newQuestionBtnFooter = document.getElementById('new-question-btn-footer');
  const pastSessionBanner = document.getElementById('past-session-banner');

  // Feedback Rating Elements
  const hintThumbsUp = document.getElementById('hint-thumbs-up');
  const hintThumbsDown = document.getElementById('hint-thumbs-down');
  const explainThumbsUp = document.getElementById('explain-thumbs-up');
  const explainThumbsDown = document.getElementById('explain-thumbs-down');

  // Diagram Elements
  const hintDiagramContainer = document.getElementById('hint-diagram-container');
  const hintDiagram = document.getElementById('hint-diagram');
  const explainDiagramContainer = document.getElementById('explain-diagram-container');
  const explainDiagram = document.getElementById('explain-diagram');

  // Toast Container
  const toastContainer = document.getElementById('toast-container');

  // Input limits constants
  const MAX_COMBINED_CHARACTERS = 4000;
  const MIN_ATTEMPT_CHARACTERS = 25;

  // Session State
  let currentSessionId = null;
  let isReadOnly = false;
  let currentHintMermaidCode = null;
  let currentExplainMermaidCode = null;

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

    reRenderVisibleDiagrams();
  }

  function extractMermaidCode(text) {
    if (!text) return { cleanText: '', mermaidCode: null };
    const match = text.match(/```mermaid([\s\S]*?)```/i);
    if (match) {
      const code = match[1].trim();
      const cleanText = text.replace(/```mermaid[\s\S]*?```/gi, '').trim();
      return { cleanText, mermaidCode: code };
    }
    return { cleanText: text, mermaidCode: null };
  }

  async function renderDiagram(containerEl, targetEl, code, elementId) {
    if (!code) {
      containerEl.classList.add('hidden');
      targetEl.innerHTML = '';
      return;
    }

    containerEl.classList.remove('hidden');
    targetEl.innerHTML = '';

    const currentTheme = htmlElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'default';

    if (typeof mermaid !== 'undefined') {
      try {
        mermaid.initialize({
          startOnLoad: false,
          theme: currentTheme,
          securityLevel: 'loose'
        });

        const id = elementId + '-svg';
        
        const oldSvg = document.getElementById(id);
        if (oldSvg) oldSvg.remove();
        const oldErr = document.getElementById('d' + id);
        if (oldErr) oldErr.remove();

        const { svg } = await mermaid.render(id, code);
        targetEl.innerHTML = svg;
      } catch (err) {
        console.warn('Failed to render Mermaid diagram:', err);
        containerEl.classList.add('hidden');
        targetEl.innerHTML = '';
        
        const oldSvg = document.getElementById(elementId + '-svg');
        if (oldSvg) oldSvg.remove();
        const oldErr = document.getElementById('d' + elementId + '-svg');
        if (oldErr) oldErr.remove();
      }
    } else {
      console.error('Mermaid.js library is not loaded');
      containerEl.classList.add('hidden');
    }
  }

  function reRenderVisibleDiagrams() {
    if (currentHintMermaidCode) {
      renderDiagram(hintDiagramContainer, hintDiagram, currentHintMermaidCode, 'hint-diagram');
    }
    if (currentExplainMermaidCode) {
      renderDiagram(explainDiagramContainer, explainDiagram, currentExplainMermaidCode, 'explain-diagram');
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

    // Visual Explanation titles
    const visualHintTitle = document.getElementById('visual-explanation-hint-title');
    const visualExplainTitle = document.getElementById('visual-explanation-explain-title');
    if (visualHintTitle) visualHintTitle.textContent = dict.visualExplanation;
    if (visualExplainTitle) visualExplainTitle.textContent = dict.visualExplanation;

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
    const hintParsed = extractMermaidCode(session.hint);
    hintContent.textContent = hintParsed.cleanText;
    renderMath(hintContent);
    responseSection.classList.remove('hidden');
    
    currentHintMermaidCode = hintParsed.mermaidCode;
    renderDiagram(hintDiagramContainer, hintDiagram, hintParsed.mermaidCode, 'hint-diagram');
    
    // Render ratings for hint (disabled in read-only mode)
    disableFeedbackButtons('hint');
    highlightFeedbackButtons('hint', session.hintFeedback);

    if (session.fullExplanation) {
      const explainParsed = extractMermaidCode(session.fullExplanation);
      explainContent.textContent = explainParsed.cleanText;
      renderMath(explainContent);
      explanationCard.classList.remove('hidden');
      stuckRow.classList.add('hidden');
      
      currentExplainMermaidCode = explainParsed.mermaidCode;
      renderDiagram(explainDiagramContainer, explainDiagram, explainParsed.mermaidCode, 'explain-diagram');
      
      // Render ratings for explanation (disabled in read-only mode)
      disableFeedbackButtons('explain');
      highlightFeedbackButtons('explain', session.explainFeedback);
    } else {
      currentExplainMermaidCode = null;
      explainContent.textContent = '';
      explanationCard.classList.add('hidden');
      stuckRow.classList.add('hidden');
      explainDiagramContainer.classList.add('hidden');
      explainDiagram.innerHTML = '';
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

      // Display response — extract Mermaid diagram if present
      console.log('[Diagram Pipeline] Raw hint response received:', data.text.substring(0, 200) + '...');
      const hintParsed = extractMermaidCode(data.text);
      console.log('[Diagram Pipeline] Mermaid code extracted from hint:', hintParsed.mermaidCode ? 'YES (' + hintParsed.mermaidCode.substring(0, 80) + '...)' : 'NONE');
      
      hintContent.textContent = hintParsed.cleanText;
      renderMath(hintContent);
      tutorLoader.classList.add('hidden');
      responseSection.classList.remove('hidden');
      stuckRow.classList.remove('hidden');

      // Render diagram if present
      currentHintMermaidCode = hintParsed.mermaidCode;
      if (hintParsed.mermaidCode) {
        console.log('[Diagram Pipeline] Rendering hint diagram...');
        renderDiagram(hintDiagramContainer, hintDiagram, hintParsed.mermaidCode, 'hint-diagram').then(() => {
          console.log('[Diagram Pipeline] Hint diagram render completed');
        });
      } else {
        hintDiagramContainer.classList.add('hidden');
        hintDiagram.innerHTML = '';
      }

      // Create new session object and save it (store raw text with mermaid code for history)
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

      // Display Explanation — extract Mermaid diagram if present
      console.log('[Diagram Pipeline] Raw explanation response received:', data.text.substring(0, 200) + '...');
      const explainParsed = extractMermaidCode(data.text);
      console.log('[Diagram Pipeline] Mermaid code extracted from explanation:', explainParsed.mermaidCode ? 'YES (' + explainParsed.mermaidCode.substring(0, 80) + '...)' : 'NONE');

      explainContent.textContent = explainParsed.cleanText;
      renderMath(explainContent);
      explainLoader.classList.add('hidden');
      explanationCard.classList.remove('hidden');

      // Render diagram if present
      currentExplainMermaidCode = explainParsed.mermaidCode;
      if (explainParsed.mermaidCode) {
        console.log('[Diagram Pipeline] Rendering explanation diagram...');
        renderDiagram(explainDiagramContainer, explainDiagram, explainParsed.mermaidCode, 'explain-diagram').then(() => {
          console.log('[Diagram Pipeline] Explanation diagram render completed');
        });
      } else {
        explainDiagramContainer.classList.add('hidden');
        explainDiagram.innerHTML = '';
      }

      // Update session in local storage with the explanation content (raw text with mermaid for history)
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

  /* ============================================================
     VOICE FEATURES — Mic-to-Text & Turn-Based Conversation
     ============================================================ */
  const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
  const speechSynthesisAPI = window.speechSynthesis;
  const voiceSupported = !!SpeechRecognitionAPI;

  // Voice UI elements
  const micQuestionBtn = document.getElementById('mic-question-btn');
  const micAttemptBtn = document.getElementById('mic-attempt-btn');
  const voiceStartRow = document.getElementById('voice-start-row');
  const voiceConversationBtn = document.getElementById('voice-conversation-btn');
  const voicePanel = document.getElementById('voice-conversation-panel');
  const voiceInfoNote = document.getElementById('voice-info-note');
  const voiceInfoDismiss = document.getElementById('voice-info-dismiss');
  const voiceStatus = document.getElementById('voice-status');
  const voiceStatusText = document.getElementById('voice-status-text');
  const voicePrompt = document.getElementById('voice-prompt');
  const voiceTranscript = document.getElementById('voice-transcript');
  const voiceEndBtn = document.getElementById('voice-end-btn');

  // Language code mapping
  function getVoiceLangCode() {
    const lang = languageSelect.value;
    const langMap = { en: 'en-IN', hi: 'hi-IN', mr: 'mr-IN' };
    return langMap[lang] || 'en-IN';
  }

  if (voiceSupported) {
    document.body.classList.add('voice-supported');

    // Show mic buttons (remove hidden class)
    micQuestionBtn.classList.remove('hidden');
    micAttemptBtn.classList.remove('hidden');
    voiceStartRow.classList.remove('hidden');

    /* ---- CHANGE A: Mic-to-Text for Textareas ---- */
    let activeMicRecognition = null;
    let activeMicButton = null;

    function startMicToText(textarea, micBtn) {
      // If already listening on this button, stop
      if (activeMicButton === micBtn) {
        stopMicToText();
        return;
      }

      // Stop any existing recognition
      stopMicToText();

      const recognition = new SpeechRecognitionAPI();
      recognition.lang = getVoiceLangCode();
      recognition.interimResults = false;
      recognition.continuous = false;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        // Append to existing text (not overwrite)
        if (textarea.value && !textarea.value.endsWith(' ') && !textarea.value.endsWith('\n')) {
          textarea.value += ' ';
        }
        textarea.value += transcript;
        // Trigger input event so form validation updates
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      };

      recognition.onend = () => {
        if (activeMicButton === micBtn) {
          micBtn.classList.remove('listening');
          activeMicRecognition = null;
          activeMicButton = null;
        }
      };

      recognition.onerror = (event) => {
        console.warn('Speech recognition error:', event.error);
        if (activeMicButton === micBtn) {
          micBtn.classList.remove('listening');
          activeMicRecognition = null;
          activeMicButton = null;
        }
      };

      micBtn.classList.add('listening');
      activeMicRecognition = recognition;
      activeMicButton = micBtn;
      recognition.start();
    }

    function stopMicToText() {
      if (activeMicRecognition) {
        try { activeMicRecognition.abort(); } catch(e) { /* ignore */ }
        activeMicRecognition = null;
      }
      if (activeMicButton) {
        activeMicButton.classList.remove('listening');
        activeMicButton = null;
      }
    }

    micQuestionBtn.addEventListener('click', () => {
      if (isReadOnly) return;
      startMicToText(questionInput, micQuestionBtn);
    });

    micAttemptBtn.addEventListener('click', () => {
      if (isReadOnly) return;
      startMicToText(attemptInput, micAttemptBtn);
    });

    /* ---- CHANGE B: Turn-Based Voice Conversation (Clean State Machine) ---- */
    // ── State ──
    const VSTATE = { IDLE: 'idle', LISTENING: 'listening', PROCESSING: 'processing', SPEAKING: 'speaking' };
    let vState = VSTATE.IDLE;
    let vTurn = 0;          // 0=idle, 1=question, 2=attempt, 3+=follow-up
    let vQuestion = '';
    let vAttempt = '';
    let vLog = [];          // { role, text }
    let vRec = null;        // current SpeechRecognition instance
    let vUtter = null;      // current SpeechSynthesisUtterance
    let vLiveEl = document.getElementById('voice-live-caption-text');

    // ── UI helpers ──
    function vSetState(s) {
      vState = s;
      const d = window.APP_TRANSLATIONS[languageSelect.value];
      voiceStatus.classList.remove('status-listening', 'status-thinking', 'status-speaking');
      if (s === VSTATE.LISTENING) {
        voiceStatus.classList.add('status-listening');
        voiceStatusText.textContent = d.voiceListening;
      } else if (s === VSTATE.PROCESSING) {
        voiceStatus.classList.add('status-thinking');
        voiceStatusText.textContent = d.voiceThinking;
      } else if (s === VSTATE.SPEAKING) {
        voiceStatus.classList.add('status-speaking');
        voiceStatusText.textContent = d.voiceSpeaking;
      } else {
        voiceStatusText.textContent = 'Ready';
      }
      console.log(`[Voice] State → ${s}  Turn → ${vTurn}`);
    }

    function vUpdatePrompt() {
      const d = window.APP_TRANSLATIONS[languageSelect.value];
      voicePrompt.textContent = vTurn <= 1 ? d.voiceFirstTurnPrompt
                              : vTurn === 2 ? d.voiceSecondTurnPrompt
                              : d.voiceFollowUpPrompt;
    }

    function vAddBubble(role, text) {
      const d = window.APP_TRANSLATIONS[languageSelect.value];
      const b = document.createElement('div');
      b.className = `voice-bubble ${role}`;
      const l = document.createElement('span');
      l.className = 'voice-bubble-label';
      l.textContent = role === 'student' ? d.voiceYouSaid : d.voiceTutorSaid;
      const c = document.createElement('span');
      c.textContent = text;
      b.appendChild(l); b.appendChild(c);
      voiceTranscript.appendChild(b);
      voiceTranscript.scrollTop = voiceTranscript.scrollHeight;
      vLog.push({ role, text });
    }

    function vClearLive() { if (vLiveEl) vLiveEl.textContent = ''; }

    // ── Recognition management ──
    function vStopRec() {
      if (vRec) {
        const old = vRec;
        vRec = null;
        try { old.abort(); } catch (_) {}
        console.log('[Voice] recognition.abort()');
      }
    }

    function vStartListening() {
      if (vState === VSTATE.SPEAKING) return;   // never listen while speaking
      vStopRec();                                // kill any stale instance
      vTurn++;
      vUpdatePrompt();
      vClearLive();
      vSetState(VSTATE.LISTENING);

      const inst = new SpeechRecognitionAPI();
      inst.lang = getVoiceLangCode();
      inst.interimResults = true;
      inst.continuous = false;
      inst.maxAlternatives = 1;

      inst.onresult = (ev) => {
        const last = ev.results[ev.results.length - 1];
        const text = last[0].transcript;
        if (!last.isFinal) {
          // Live caption
          if (vLiveEl) vLiveEl.textContent = text;
          return;
        }
        // Final result
        if (vLiveEl) vLiveEl.textContent = '';
        console.log(`[Voice] onresult (final): "${text}"`);
        vHandleInput(text);
      };

      inst.onerror = (ev) => {
        console.warn(`[Voice] onerror: "${ev.error}"`);
        if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
          vAddBubble('system', '⚠️ Microphone access denied. Please allow mic access in browser settings and try again.');
          vEndConversation();
          return;
        }
        if (ev.error === 'no-speech' && vState === VSTATE.LISTENING) {
          vStartListening(); // fresh instance, same turn won't increment
          return;
        }
        if (ev.error === 'aborted') return;
        if (vState === VSTATE.LISTENING) {
          setTimeout(() => { if (vState === VSTATE.LISTENING) vStartListening(); }, 500);
        }
      };

      inst.onend = () => {
        console.log(`[Voice] onend (state=${vState})`);
        // In non-continuous mode, onend fires after each utterance.
        // If we're still LISTENING, no final result arrived → restart same turn.
        if (vState === VSTATE.LISTENING) {
          vStartListening(); // creates fresh instance
        }
      };

      vRec = inst;
      try {
        inst.start();
        console.log(`[Voice] recognition.start()  turn=${vTurn}`);
      } catch (e) {
        console.error('[Voice] recognition.start() threw:', e);
        setTimeout(() => { if (vState === VSTATE.LISTENING) vStartListening(); }, 500);
      }
    }

    // ── Input handling ──
    function vHandleInput(text) {
      vSetState(VSTATE.PROCESSING);
      vAddBubble('student', text);

      if (vTurn === 1) {
        vQuestion = text;
        console.log(`[Voice] Turn 1 done — question stored`);
        vStartListening(); // goes to turn 2
        return;
      }

      if (vTurn === 2) vAttempt = text;

      const q = vTurn === 2 ? vQuestion : text;
      const a = vTurn === 2 ? vAttempt : vQuestion;
      const lang = languageSelect.value;
      console.log(`[Voice] → API  q="${q.slice(0,50)}…"  a="${a.slice(0,50)}…"`);

      fetch('/api/hint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, attempt: a, language: lang })
      })
      .then(r => r.json().then(d => ({ ok: r.ok, data: d })))
      .then(({ ok, data }) => {
        if (!ok) throw new Error(data.error || 'API error');
        console.log(`[Voice] ← API  "${data.text.slice(0,100)}…"`);
        vAddBubble('tutor', data.text);
        vSpeak(data.text);
      })
      .catch(err => {
        console.error('[Voice] API error:', err);
        vAddBubble('tutor', '⚠️ ' + (err.message || 'Something went wrong'));
        vStartListening();
      });
    }

    // ── Speech synthesis ──
    function vSpeak(text) {
      if (!speechSynthesisAPI) { vStartListening(); return; }

      vStopRec();                          // stop mic while speaking
      speechSynthesisAPI.cancel();          // cancel any previous speech

      vSetState(VSTATE.SPEAKING);

      const u = new SpeechSynthesisUtterance(text);
      u.lang = getVoiceLangCode();
      u.rate = 0.95;
      u.pitch = 1;

      const voices = speechSynthesisAPI.getVoices();
      const lc = getVoiceLangCode();
      const mv = voices.find(v => v.lang === lc) || voices.find(v => v.lang.startsWith(lc.split('-')[0]));
      if (mv) u.voice = mv;

      u.onend = () => {
        console.log('[Voice] utterance.onend');
        vUtter = null;
        if (vState === VSTATE.SPEAKING) vStartListening();
      };

      u.onerror = (ev) => {
        console.warn('[Voice] utterance.onerror:', ev.error);
        vUtter = null;
        if (vState === VSTATE.SPEAKING) vStartListening();
      };

      vUtter = u;
      console.log(`[Voice] speak()  length=${text.length}`);
      speechSynthesisAPI.speak(u);
    }

    // ── Public entry points ──
    function vStartConversation() {
      stopMicToText();
      vTurn = 0; vQuestion = ''; vAttempt = ''; vLog = [];
      voiceTranscript.innerHTML = '';
      vClearLive();

      voicePanel.classList.remove('hidden');
      const fs = document.querySelector('.form-section');
      if (fs) fs.style.display = 'none';
      responseSection.classList.add('hidden');
      errorContainer.classList.add('hidden');

      const seen = localStorage.getItem('voice-mode-intro-seen');
      if (!seen) {
        const d = window.APP_TRANSLATIONS[languageSelect.value];
        document.getElementById('voice-info-text').textContent = d.voiceWalkieTalkieNote;
        voiceInfoDismiss.textContent = d.voiceGotIt;
        voiceInfoNote.classList.remove('hidden');
      }

      console.log('[Voice] === Conversation started ===');
      vStartListening();
    }

    function vEndConversation() {
      vStopRec();
      if (speechSynthesisAPI) speechSynthesisAPI.cancel();
      vUtter = null;
      vSetState(VSTATE.IDLE);
      voicePanel.classList.add('hidden');
      const fs = document.querySelector('.form-section');
      if (fs) fs.style.display = '';
      console.log('[Voice] === Conversation ended ===');
      if (vLog.length > 0) vSaveSession();
    }

    function vSaveSession() {
      const d = window.APP_TRANSLATIONS[languageSelect.value];
      const q = vQuestion || vLog.find(e => e.role === 'student')?.text || 'Voice conversation';
      const a = vAttempt || '(spoken attempt)';
      const firstTutor = vLog.find(e => e.role === 'tutor');
      const hint = firstTutor ? firstTutor.text : '';
      const transcript = vLog.map(e => `${e.role === 'student' ? d.voiceYouSaid : d.voiceTutorSaid} ${e.text}`).join('\n\n');

      const sess = {
        id: Date.now().toString(),
        question: '🎙️ ' + q,
        attempt: a,
        hint,
        fullExplanation: vLog.length > 2 ? transcript : null,
        hintFeedback: null, explainFeedback: null,
        timestamp: Date.now()
      };
      const sessions = getSessions();
      sessions.unshift(sess);
      saveSessions(sessions);
      currentSessionId = sess.id;
      renderSidebarHistory();
      showToast(d.voiceSessionSaved);
    }

    // ── Event listeners ──
    voiceConversationBtn.addEventListener('click', vStartConversation);
    voiceEndBtn.addEventListener('click', vEndConversation);
    voiceInfoDismiss.addEventListener('click', () => {
      voiceInfoNote.classList.add('hidden');
      localStorage.setItem('voice-mode-intro-seen', 'true');
    });

    // Pre-load voices
    if (speechSynthesisAPI) {
      speechSynthesisAPI.getVoices();
      speechSynthesisAPI.onvoiceschanged = () => speechSynthesisAPI.getVoices();
    }

  }

  /* ============================================================
     VOICE-AWARE UI UPDATES
     ============================================================ */
  // Extend updateUILanguage to include voice translations
  const originalUpdateUILanguage = updateUILanguage;
  // We can't easily wrap, so let's just add a secondary updater
  function updateVoiceUILanguage() {
    const dict = window.APP_TRANSLATIONS[languageSelect.value];
    if (!dict) return;

    const voiceConvBtnText = document.getElementById('voice-conversation-btn-text');
    if (voiceConvBtnText) voiceConvBtnText.textContent = dict.voiceConversationBtn;

    const voiceEndBtnText = document.getElementById('voice-end-btn-text');
    if (voiceEndBtnText) voiceEndBtnText.textContent = dict.voiceEndBtn;

    // Update mic button tooltips
    if (micQuestionBtn) micQuestionBtn.setAttribute('aria-label', dict.voiceMicTooltip);
    if (micAttemptBtn) micAttemptBtn.setAttribute('aria-label', dict.voiceMicTooltip);
  }

  // Hook into language change
  languageSelect.addEventListener('change', updateVoiceUILanguage);
  // Run once on init
  updateVoiceUILanguage();

  // Extend startNewSession to also handle voice panel cleanup
  const originalNewSessionBtn = newSessionBtn;
  const originalNewQuestionBtn = newQuestionBtn;

  // Ensure voice panel is hidden when starting new session
  function cleanupVoiceOnNewSession() {
    if (voiceSupported && voicePanel && !voicePanel.classList.contains('hidden')) {
      if (typeof vEndConversation === 'function') {
        vEndConversation();
      }
    }
    // Ensure form section is visible
    const formSection = document.querySelector('.form-section');
    if (formSection) formSection.style.display = '';
  }

  newSessionBtn.addEventListener('click', cleanupVoiceOnNewSession);
  newQuestionBtn.addEventListener('click', cleanupVoiceOnNewSession);
});

