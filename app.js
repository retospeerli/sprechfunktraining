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
  };

  const tasks = {
    receive: [
      {
        title: "Du wirst angerufen",
        instruction: "Das Programm ruft dich. Antworte korrekt als Bruno.",
        programLine: "Bruno von Anna, antworten",
        expected: "Anna von Bruno, verstanden, antworten",
      },
      {
        title: "Du wirst angerufen",
        instruction: "Das Programm ruft dich. Antworte korrekt als Chiara.",
        programLine: "Chiara von Bruno, antworten",
        expected: "Bruno von Chiara, verstanden, antworten",
      },
      {
        title: "Du wirst angerufen",
        instruction: "Das Programm ruft dich. Antworte korrekt als Anna.",
        programLine: "Anna von Chiara, antworten",
        expected: "Chiara von Anna, verstanden, antworten",
      }
    ],
    start: [
      {
        title: "Du beginnst das Gespräch",
        instruction: "Du willst Bruno sprechen. Starte das Funkgespräch korrekt.",
        programLine: "Aufgabe: Rufe Bruno korrekt auf.",
        expected: "Bruno von Anna, antworten",
      },
      {
        title: "Du beginnst das Gespräch",
        instruction: "Du willst Chiara sprechen. Starte das Funkgespräch korrekt.",
        programLine: "Aufgabe: Rufe Chiara korrekt auf.",
        expected: "Chiara von Bruno, antworten",
      },
      {
        title: "Du beginnst das Gespräch",
        instruction: "Du willst Anna sprechen. Starte das Funkgespräch korrekt.",
        programLine: "Aufgabe: Rufe Anna korrekt auf.",
        expected: "Anna von Chiara, antworten",
      }
    ],
    end: [
      {
        title: "Du beendest das Gespräch",
        instruction: "Das Gespräch ist richtig bestätigt. Beende es korrekt.",
        programLine: "Anna von Bruno, verstanden: Treffpunkt beim grossen Stein um drei Uhr, antworten",
        expected: "Richtig, Schluss",
      },
      {
        title: "Du beendest das Gespräch",
        instruction: "Die Meldung wurde korrekt verstanden. Beende das Gespräch korrekt.",
        programLine: "Bruno von Chiara, verstanden: Treffpunkt beim alten Baum um vier Uhr, antworten",
        expected: "Richtig, Schluss",
      },
      {
        title: "Du beendest das Gespräch",
        instruction: "Das Funkgespräch ist fertig. Beende korrekt.",
        programLine: "Chiara von Anna, verstanden: Treffpunkt beim Bach um zwei Uhr, antworten",
        expected: "Richtig, Schluss",
      }
    ]
  };

  function init() {
    if (!SpeechRecognition) {
      els.feedbackText.innerHTML = '<span class="feedback-bad">Diese App braucht einen Browser mit Spracherkennung.</span>';
      els.taskInstruction.textContent = "Bitte einen kompatiblen Browser verwenden.";
      return;
    }

    setupRecognition();
    bindEvents();
    setMode("receive");
    loadRandomTask();
  }

  function bindEvents() {
    els.modeGrid.addEventListener("click", (e) => {
      const btn = e.target.closest(".mode-card");
      if (!btn) return;
      setMode(btn.dataset.mode);
      loadRandomTask();
    });

    els.newTaskBtn.addEventListener("click", loadRandomTask);
    els.speakPromptBtn.addEventListener("click", speakCurrentPrompt);

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    els.pttBtn.addEventListener("mousedown", startPushToTalk);
    window.addEventListener("mouseup", stopPushToTalk);
    els.pttBtn.addEventListener("touchstart", (e) => {
      e.preventDefault();
      startPushToTalk();
    }, { passive: false });
    window.addEventListener("touchend", stopPushToTalk);
  }

  function setMode(mode) {
    state.mode = mode;
    [...document.querySelectorAll(".mode-card")].forEach(btn => {
      btn.classList.toggle("active", btn.dataset.mode === mode);
    });
  }

  function loadRandomTask() {
    const pool = tasks[state.mode];
    state.currentTask = pool[Math.floor(Math.random() * pool.length)];

    els.taskTitle.textContent = state.currentTask.title;
    els.taskInstruction.textContent = state.currentTask.instruction;
    els.programLine.textContent = state.currentTask.programLine;
    els.heardText.textContent = "Noch keine Aufnahme.";
    els.analysisText.textContent = "Nach der ersten Antwort erscheint hier die Kontrolle.";
    els.feedbackText.textContent = "–";
    els.solutionText.textContent = "–";

    speakCurrentPrompt();
  }

  function speakCurrentPrompt() {
    if (!state.currentTask || !synth) return;

    synth.cancel();

    const lines = [];
    if (state.mode === "receive" || state.mode === "end") {
      lines.push(state.currentTask.programLine);
    } else if (state.mode === "start") {
      lines.push(state.currentTask.instruction);
    }

    const utterance = new SpeechSynthesisUtterance(lines.join(". "));
    utterance.lang = "de-CH";
    utterance.rate = 0.92;
    utterance.pitch = 1.0;
    synth.speak(utterance);
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
        } catch (err) {
          // ignorieren
        }
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

    const tag = document.activeElement ? document.activeElement.tagName : "";
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "BUTTON") {
      e.preventDefault();
    } else {
      e.preventDefault();
    }

    if (state.isSpaceDown) return;
    state.isSpaceDown = true;
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

    synth.cancel();
    clearTimeout(state.pauseTimer);

    state.finalTranscript = "";
    state.partialTranscript = "";
    els.heardText.textContent = "Funkgerät offen …";

    state.isWaitingPause = true;
    els.pttBtn.classList.add("active");
    setRecordState("waiting", "Drücken … schlucken …");

    state.pauseTimer = setTimeout(() => {
      if (!state.isSpaceDown && !isMouseOrTouchActive()) {
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

  let pointerPressed = false;
  els && els.pttBtn && els.pttBtn.addEventListener("mousedown", () => { pointerPressed = true; });
  window.addEventListener("mouseup", () => { pointerPressed = false; });
  els && els.pttBtn && els.pttBtn.addEventListener("touchstart", () => { pointerPressed = true; }, { passive: true });
  window.addEventListener("touchend", () => { pointerPressed = false; });

  function isMouseOrTouchActive() {
    return pointerPressed;
  }

  function stopPushToTalk() {
    clearTimeout(state.pauseTimer);

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
    els.heardText.textContent = heard || "Nichts erkannt.";

    if (!heard) {
      els.analysisText.innerHTML = `<span class="word missing">${escapeHtml(state.currentTask.expected)}</span>`;
      els.feedbackText.innerHTML = '<span class="feedback-bad">Es wurde nichts erkannt.</span>';
      els.solutionText.textContent = state.currentTask.expected;
      setRecordState("idle", "Bereit");
      return;
    }

    const result = compareUtterance(heard, state.currentTask.expected);
    els.analysisText.innerHTML = result.html;
    els.feedbackText.innerHTML = result.isPerfect
      ? '<span class="feedback-good">Alles korrekt. Reihenfolge und Begriffe stimmen.</span>'
      : `<span class="feedback-bad">Nicht ganz korrekt. Achte auf die genaue Reihenfolge und die exakten Funkwörter.</span>`;
    els.solutionText.textContent = result.isPerfect ? "Alles richtig." : state.currentTask.expected;

    setRecordState("idle", "Bereit");
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
      const cls = op.type;
      return `<span class="word ${cls}">${escapeHtml(op.value)}</span>`;
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
    return normalize(text)
      .split(" ")
      .filter(Boolean);
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
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  init();
})();
