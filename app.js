(() => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const synth = window.speechSynthesis;

  const els = {
    modeGrid: document.getElementById("modeGrid"),
    newTaskBtn: document.getElementById("newTaskBtn"),
    speakPromptBtn: document.getElementById("speakPromptBtn"),
    taskTitle: document.getElementById("taskTitle"),
    taskInstruction: document.getElementById("taskInstruction"),
    programLine: document.getElementById("programLine"),
    pttBtn: document.getElementById("pttBtn"),
    recordState: document.getElementById("recordState"),
    heardText: document.getElementById("heardText"),
    analysisText: document.getElementById("analysisText"),
    feedbackText: document.getElementById("feedbackText"),
    solutionText: document.getElementById("solutionText"),
  };

  const audio = {
    button: new Audio("audio/button.wav"),
    beep: new Audio("audio/beep.wav"),
    noise: new Audio("audio/radio-noise.wav")
  };

  const state = {
    mode: "receive",
    currentTask: null,
    recognition: null,
    isSpaceDown: false,
    isRecognitionActive: false,
    isWaitingPause: false,
    partialTranscript: "",
    finalTranscript: "",
    pauseTimer: null,
    speechTimer: null,
    audioUnlocked: false,
    voices: [],
    pointerPressed: false,
    conversationStep: 0
  };

  const tasks = {
    receive: [
      {
        title: "Du wirst angerufen",
        instruction: "Der PC ruft dich. Antworte korrekt als Bruno. Wenn du richtig bist, spricht der PC weiter.",
        openingLine: "Bruno von Anna, antworten",
        expectedSteps: [
          "Anna von Bruno, verstanden, antworten"
        ],
        pcLinesAfterCorrect: [
          "Treffpunkt beim grossen Stein um drei Uhr, antworten"
        ]
      },
      {
        title: "Du wirst angerufen",
        instruction: "Der PC ruft dich. Antworte korrekt als Chiara. Wenn du richtig bist, spricht der PC weiter.",
        openingLine: "Chiara von Bruno, antworten",
        expectedSteps: [
          "Bruno von Chiara, verstanden, antworten"
        ],
        pcLinesAfterCorrect: [
          "Treffpunkt beim alten Baum um vier Uhr, antworten"
        ]
      }
    ],

    start: [
      {
        title: "Du beginnst das Gespräch",
        instruction: "Beginne das Funkgespräch korrekt. Wenn du richtig bist, spricht der PC weiter.",
        programLine: "Aufgabe: Rufe Bruno korrekt auf.",
        expectedSteps: [
          "Bruno von Anna, antworten"
        ],
        pcLinesAfterCorrect: [
          "Anna von Bruno, verstanden, antworten",
          "Wo und wann treffen wir uns? antworten"
        ]
      },
      {
        title: "Du beginnst das Gespräch",
        instruction: "Beginne das Funkgespräch korrekt. Wenn du richtig bist, spricht der PC weiter.",
        programLine: "Aufgabe: Rufe Chiara korrekt auf.",
        expectedSteps: [
          "Chiara von Bruno, antworten"
        ],
        pcLinesAfterCorrect: [
          "Bruno von Chiara, verstanden, antworten",
          "Wo und wann treffen wir uns? antworten"
        ]
      }
    ],

    end: [
      {
        title: "Du beendest das Gespräch",
        instruction: "Der PC spricht den letzten korrekten Funkspruch. Danach beendest du das Gespräch korrekt.",
        openingLine: "Anna von Bruno, verstanden, Treffpunkt beim grossen Stein um drei Uhr, antworten",
        expectedSteps: [
          "Richtig, Schluss"
        ],
        pcLinesAfterCorrect: [
          "Schluss"
        ]
      },
      {
        title: "Du beendest das Gespräch",
        instruction: "Der PC spricht den letzten korrekten Funkspruch. Danach beendest du korrekt.",
        openingLine: "Bruno von Chiara, verstanden, Treffpunkt beim alten Baum um vier Uhr, antworten",
        expectedSteps: [
          "Richtig, Schluss"
        ],
        pcLinesAfterCorrect: [
          "Schluss"
        ]
      }
    ],

    notunderstood_pc: [
      {
        title: "Der PC versteht dich nicht",
        instruction: "Antworte zuerst korrekt auf den PC. Danach sagt der PC absichtlich: Nicht verstanden. Dann musst du die Meldung korrekt mit „Ich wiederhole ...“ wiederholen.",
        openingLine: "Anna von Bruno, verstanden, wo und wann treffen wir uns? antworten",
        expectedSteps: [
          "Treffpunkt beim alten Baum um drei Uhr, antworten",
          "Ich wiederhole, Treffpunkt beim alten Baum um drei Uhr, antworten"
        ],
        pcLinesAfterCorrect: [
          "Nicht verstanden, wiederholen, antworten",
          "Richtig, Schluss",
          "Schluss"
        ]
      },
      {
        title: "Der PC versteht dich nicht",
        instruction: "Antworte zuerst korrekt. Danach wiederholst du die Meldung korrekt mit „Ich wiederhole ...“.",
        openingLine: "Bruno von Chiara, verstanden, wo und wann treffen wir uns? antworten",
        expectedSteps: [
          "Treffpunkt beim grossen Stein um vier Uhr, antworten",
          "Ich wiederhole, Treffpunkt beim grossen Stein um vier Uhr, antworten"
        ],
        pcLinesAfterCorrect: [
          "Nicht verstanden, wiederholen, antworten",
          "Richtig, Schluss",
          "Schluss"
        ]
      }
    ],

    notunderstood_student: [
      {
        title: "Du verstehst den PC nicht",
        instruction: "Der PC spricht die Nachricht gestört. Du musst korrekt Wiederholen verlangen. Danach wiederholt der PC richtig, und du beendest das Gespräch korrekt.",
        openingLine: "Treffpunkt beim grossen Stein um drei Uhr, antworten",
        distortedOpening: true,
        expectedSteps: [
          "Nicht verstanden, wiederholen, antworten",
          "Richtig, Schluss"
        ],
        pcLinesAfterCorrect: [
          "Ich wiederhole, Treffpunkt beim grossen Stein um drei Uhr, antworten",
          "Schluss"
        ]
      },
      {
        title: "Du verstehst den PC nicht",
        instruction: "Der PC spricht die Nachricht gestört. Danach verlangst du korrekt eine Wiederholung und beendest das Gespräch korrekt.",
        openingLine: "Treffpunkt beim alten Baum um vier Uhr, antworten",
        distortedOpening: true,
        expectedSteps: [
          "Nicht verstanden, wiederholen, antworten",
          "Richtig, Schluss"
        ],
        pcLinesAfterCorrect: [
          "Ich wiederhole, Treffpunkt beim alten Baum um vier Uhr, antworten",
          "Schluss"
        ]
      }
    ]
  };

  function init() {
    if (!SpeechRecognition) {
      els.feedbackText.innerHTML = '<span class="feedback-bad">Diese App braucht einen Browser mit Spracherkennung.</span>';
      els.taskInstruction.textContent = "Bitte einen kompatiblen Browser verwenden.";
      return;
    }

    prepareAudio();
    setupVoices();
    setupRecognition();
    bindEvents();
    ensureExtraModeCards();
    setMode("receive");
    loadRandomTask();
  }

  function ensureExtraModeCards() {
    const existing = [...document.querySelectorAll(".mode-card")].map(btn => btn.dataset.mode);

    const extras = [
      {
        mode: "notunderstood_pc",
        title: "PC versteht dich nicht",
        text: "Der PC sagt absichtlich: Nicht verstanden. Du übst die korrekte Wiederholung."
      },
      {
        mode: "notunderstood_student",
        title: "Du verstehst den PC nicht",
        text: "Der PC spricht absichtlich gestört. Du verlangst korrekt eine Wiederholung."
      }
    ];

    extras.forEach(item => {
      if (existing.includes(item.mode)) return;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "mode-card";
      btn.dataset.mode = item.mode;
      btn.innerHTML = `
        <span class="mode-title">${escapeHtml(item.title)}</span>
        <span class="mode-text">${escapeHtml(item.text)}</span>
      `;
      els.modeGrid.appendChild(btn);
    });
  }

  function setupVoices() {
    function loadVoices() {
      state.voices = synth ? synth.getVoices() : [];
    }
    loadVoices();
    if (synth) synth.onvoiceschanged = loadVoices;
  }

  function prepareAudio() {
    audio.button.preload = "auto";
    audio.beep.preload = "auto";
    audio.noise.preload = "auto";
    audio.noise.loop = true;
    audio.noise.volume = 0.2;
  }

  function unlockAudio() {
    if (state.audioUnlocked) return;
    state.audioUnlocked = true;

    Object.values(audio).forEach(snd => {
      try {
        snd.volume = 0;
        snd.play().then(() => {
          snd.pause();
          snd.currentTime = 0;
        }).catch(() => {});
      } catch (err) {}
    });

    audio.button.volume = 1;
    audio.beep.volume = 1;
    audio.noise.volume = 0.2;
  }

  function playSound(name) {
    const snd = audio[name];
    if (!snd) return;
    try {
      snd.pause();
      snd.currentTime = 0;
      snd.play().catch(() => {});
    } catch (err) {}
  }

  function startNoise() {
    try {
      audio.noise.currentTime = 0;
      audio.noise.play().catch(() => {});
    } catch (err) {}
  }

  function stopNoise() {
    try {
      audio.noise.pause();
      audio.noise.currentTime = 0;
    } catch (err) {}
  }

  function bindEvents() {
    els.modeGrid.addEventListener("click", (e) => {
      const btn = e.target.closest(".mode-card");
      if (!btn) return;
      unlockAudio();
      setMode(btn.dataset.mode);
      loadRandomTask();
    });

    els.newTaskBtn.addEventListener("click", () => {
      unlockAudio();
      loadRandomTask();
    });

    els.speakPromptBtn.addEventListener("click", () => {
      unlockAudio();
      speakCurrentPcLine();
    });

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    els.pttBtn.addEventListener("mousedown", () => {
      state.pointerPressed = true;
      unlockAudio();
      startPushToTalk();
    });

    window.addEventListener("mouseup", () => {
      state.pointerPressed = false;
      stopPushToTalk();
    });

    els.pttBtn.addEventListener("touchstart", (e) => {
      e.preventDefault();
      state.pointerPressed = true;
      unlockAudio();
      startPushToTalk();
    }, { passive: false });

    window.addEventListener("touchend", () => {
      state.pointerPressed = false;
      stopPushToTalk();
    });
  }

  function setMode(mode) {
    state.mode = mode;
    [...document.querySelectorAll(".mode-card")].forEach(btn => {
      btn.classList.toggle("active", btn.dataset.mode === mode);
    });
  }

  function loadRandomTask() {
    clearTimeout(state.speechTimer);
    stopNoise();
    if (synth) synth.cancel();

    const pool = tasks[state.mode];
    state.currentTask = JSON.parse(JSON.stringify(pool[Math.floor(Math.random() * pool.length)]));
    state.conversationStep = 0;

    els.taskTitle.textContent = state.currentTask.title;
    els.taskInstruction.textContent = state.currentTask.instruction;
    els.programLine.textContent = getVisibleProgramLine();
    els.heardText.textContent = "Noch keine Aufnahme.";
    els.analysisText.textContent = "Nach deiner ersten Antwort erscheint hier die Kontrolle.";
    els.feedbackText.textContent = "–";
    els.solutionText.textContent = getExpectedForCurrentStep() || "–";

    speakCurrentPcLine();
  }

  function getVisibleProgramLine() {
    const task = state.currentTask;
    if (!task) return "–";

    if (state.mode === "start") return task.programLine || "–";
    return task.openingLine || task.programLine || "–";
  }

  function speakCurrentPcLine() {
    if (!state.currentTask || !synth) return;

    clearTimeout(state.speechTimer);
    stopNoise();
    synth.cancel();

    let line = "";

    if (state.conversationStep === 0) {
      if (state.mode === "start") {
        line = "";
      } else {
        line = state.currentTask.openingLine || "";
      }
    } else {
      const index = state.conversationStep - 1;
      line = state.currentTask.pcLinesAfterCorrect?.[index] || "";
    }

    if (!line) return;

    const distorted = state.mode === "notunderstood_student" && state.conversationStep === 0 && !!state.currentTask.distortedOpening;

    state.speechTimer = setTimeout(() => {
      speakLine(line, distorted ? { distorted: true, noisy: true } : {});
    }, 1000);
  }

  function setupRecognition() {
    const recognition = new SpeechRecognition();
    recognition.lang = "de-CH";
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let interim = "";
      let finalText = state.finalTranscript;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript.trim();
        if (event.results[i].isFinal) {
          finalText += (finalText ? " " : "") + text;
        } else {
          interim += (interim ? " " : "") + text;
        }
      }

      state.finalTranscript = finalText.trim();
      state.partialTranscript = interim.trim();

      const live = [state.finalTranscript, state.partialTranscript].filter(Boolean).join(" ").trim();
      els.heardText.textContent = live || "Ich höre zu …";
    };

    recognition.onerror = (event) => {
      state.isRecognitionActive = false;
      setRecordState("idle", "Bereit");
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        els.feedbackText.innerHTML = '<span class="feedback-bad">Mikrofonzugriff wurde nicht erlaubt.</span>';
      }
    };

    recognition.onend = () => {
      const shouldRestart = state.isSpaceDown && state.isRecognitionActive;
      if (shouldRestart) {
        try {
          recognition.start();
        } catch (err) {}
        return;
      }

      state.isRecognitionActive = false;
      setRecordState("processing", "Auswertung läuft …");
      finalizeAnswer();
    };

    state.recognition = recognition;
  }

  function onKeyDown(e) {
    if (e.code !== "Space") return;
    e.preventDefault();
    if (state.isSpaceDown) return;
    state.isSpaceDown = true;
    unlockAudio();
    startPushToTalk();
  }

  function onKeyUp(e) {
    if (e.code !== "Space") return;
    e.preventDefault();
    state.isSpaceDown = false;
    stopPushToTalk();
  }

  function startPushToTalk() {
    if (!state.currentTask || state.isRecognitionActive || state.isWaitingPause) return;

    clearTimeout(state.speechTimer);
    stopNoise();
    if (synth) synth.cancel();

    state.finalTranscript = "";
    state.partialTranscript = "";
    els.heardText.textContent = "Funkgerät offen …";

    state.isWaitingPause = true;
    els.pttBtn.classList.add("active");
    setRecordState("waiting", "Drücken … schlucken …");

    playSound("button");

    state.pauseTimer = setTimeout(() => {
      if (!state.isSpaceDown && !state.pointerPressed) {
        state.isWaitingPause = false;
        els.pttBtn.classList.remove("active");
        setRecordState("idle", "Bereit");
        return;
      }

      state.isWaitingPause = false;
      state.isRecognitionActive = true;
      setRecordState("recording", "Aufnahme läuft");

      try {
        state.recognition.start();
      } catch (err) {
        state.isRecognitionActive = false;
        setRecordState("idle", "Bereit");
      }
    }, 350);
  }

  function stopPushToTalk() {
    clearTimeout(state.pauseTimer);
    playSound("beep");

    if (state.isWaitingPause) {
      state.isWaitingPause = false;
      els.pttBtn.classList.remove("active");
      setRecordState("idle", "Bereit");
      return;
    }

    els.pttBtn.classList.remove("active");

    if (state.isRecognitionActive) {
      try {
        state.recognition.stop();
      } catch (err) {
        finalizeAnswer();
      }
    } else {
      setRecordState("idle", "Bereit");
    }
  }

  function finalizeAnswer() {
    const transcript = [state.finalTranscript, state.partialTranscript].filter(Boolean).join(" ").trim();
    const heard = transcript || "";
    const expected = getExpectedForCurrentStep();

    els.heardText.textContent = heard || "Nichts erkannt.";

    if (!heard) {
      els.analysisText.innerHTML = `<span class="word missing">${escapeHtml(expected)}</span>`;
      els.feedbackText.innerHTML = '<span class="feedback-bad">Es wurde nichts erkannt.</span>';
      els.solutionText.textContent = expected;
      setRecordState("idle", "Bereit");
      return;
    }

    const result = compareUtterance(heard, expected);
    els.analysisText.innerHTML = result.html;

    if (result.isPerfect) {
      els.feedbackText.innerHTML = '<span class="feedback-good">Alles korrekt. Der Funkverkehr geht weiter.</span>';
      advanceConversationAfterCorrect();
    } else {
      els.feedbackText.innerHTML = '<span class="feedback-bad">Nicht ganz korrekt. Achte auf exakte Begriffe und richtige Reihenfolge.</span>';
      els.solutionText.textContent = expected;
    }

    setRecordState("idle", "Bereit");
  }

  function getExpectedForCurrentStep() {
    const task = state.currentTask;
    if (!task) return "";
    return task.expectedSteps?.[state.conversationStep] || "";
  }

  function advanceConversationAfterCorrect() {
    const task = state.currentTask;
    const expectedCount = task.expectedSteps?.length || 0;

    if (state.conversationStep < expectedCount - 1) {
      state.conversationStep += 1;
      els.solutionText.textContent = getExpectedForCurrentStep() || "–";
      speakCurrentPcLine();
      return;
    }

    const pcIndex = state.conversationStep;
    const hasPcLine = !!task.pcLinesAfterCorrect?.[pcIndex];

    if (hasPcLine) {
      state.conversationStep += 1;
      els.solutionText.textContent = "–";
      speakCurrentPcLine();
      return;
    }

    els.solutionText.textContent = "Alles richtig.";
  }

  function speakLine(text, options = {}) {
    if (!synth || !text) return;

    stopNoise();
    synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "de-CH";

    if (options.distorted) {
      utterance.rate = 0.8;
      utterance.pitch = 0.82;
      const altVoice = findAlternateVoice();
      if (altVoice) utterance.voice = altVoice;
    } else {
      utterance.rate = 0.92;
      utterance.pitch = 1.0;
      const normalVoice = findGermanVoice();
      if (normalVoice) utterance.voice = normalVoice;
    }

    if (options.noisy) {
      startNoise();
      utterance.onend = () => stopNoise();
      utterance.onerror = () => stopNoise();
    }

    synth.speak(utterance);
  }

  function findGermanVoice() {
    if (!state.voices.length) return null;
    return state.voices.find(v => /de[-_](CH|DE|AT)/i.test(v.lang))
      || state.voices.find(v => /^de/i.test(v.lang))
      || null;
  }

  function findAlternateVoice() {
    if (!state.voices.length) return null;
    const normal = findGermanVoice();
    return state.voices.find(v => /^de/i.test(v.lang) && (!normal || v.name !== normal.name))
      || normal
      || null;
  }

  function compareUtterance(heard, expected) {
    const heardTokens = tokenize(heard);
    const expectedTokens = tokenize(expected);
    const dp = buildLcsMatrix(heardTokens, expectedTokens);

    let i = heardTokens.length;
    let j = expectedTokens.length;
    const ops = [];

    while (i > 0 && j > 0) {
      if (heardTokens[i - 1] === expectedTokens[j - 1]) {
        ops.push({ type: "ok", value: expectedTokens[j - 1] });
        i--;
        j--;
      } else if (dp[i - 1][j] >= dp[i][j - 1]) {
        ops.push({ type: "extra", value: heardTokens[i - 1] });
        i--;
      } else {
        ops.push({ type: "missing", value: expectedTokens[j - 1] });
        j--;
      }
    }

    while (i > 0) {
      ops.push({ type: "extra", value: heardTokens[i - 1] });
      i--;
    }

    while (j > 0) {
      ops.push({ type: "missing", value: expectedTokens[j - 1] });
      j--;
    }

    ops.reverse();

    const html = ops.map(op => {
      return `<span class="word ${op.type}">${escapeHtml(op.value)}</span>`;
    }).join(" ");

    const isPerfect =
      ops.length === expectedTokens.length &&
      ops.every(op => op.type === "ok") &&
      heardTokens.length === expectedTokens.length;

    return { html, isPerfect };
  }

  function buildLcsMatrix(a, b) {
    const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        if (a[i - 1] === b[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }
    return dp;
  }

  function tokenize(text) {
    return normalize(text).split(" ").filter(Boolean);
  }

  function normalize(text) {
    return text
      .toLowerCase()
      .replace(/[,:;.!?]/g, " ")
      .replace(/ä/g, "ae")
      .replace(/ö/g, "oe")
      .replace(/ü/g, "ue")
      .replace(/ß/g, "ss")
      .replace(/\s+/g, " ")
      .trim();
  }

  function setRecordState(type, text) {
    els.recordState.className = `record-state ${type}`;
    els.recordState.textContent = text;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  init();
})();
