const inputTextEl = document.getElementById("inputText");
const outputTextEl = document.getElementById("outputText");
const applyToSourceBtn = document.getElementById("applyToSourceBtn");
const fileInput = document.getElementById("fileInput");
const toastEl = document.getElementById("toast");
const saveBackupBtn = document.getElementById("saveBackupBtn");
const toggleBackupsBtn = document.getElementById("toggleBackupsBtn");
const backupsPanelEl = document.getElementById("backupsPanel");
const leftResizerEl = document.getElementById("leftResizer");
const rightResizerEl = document.getElementById("rightResizer");
const sourceCardEl = document.getElementById("sourceCard");
const resultCardEl = document.getElementById("resultCard");
const editorResizerEl = document.getElementById("editorResizer");
const backupListEl = document.getElementById("backupList");
const sendChatBtn = document.getElementById("sendChatBtn");
const chatInputEl = document.getElementById("chatInput");
const chatMessagesEl = document.getElementById("chatMessages");
const chatModeEl = document.getElementById("chatMode");
const appShellEl = document.querySelector(".app-shell");
const chatPanelEl = document.querySelector(".chat-panel");
const editorGridEl = document.querySelector(".editor-grid");

const STORAGE_KEY = "scientific-editor-backups-fastapi";
const DEFAULT_BACKUPS_WIDTH = 280;
const DEFAULT_CHAT_WIDTH = 320;

function showToast(message) {
  toastEl.textContent = message;
  toastEl.hidden = false;
  setTimeout(() => {
    toastEl.hidden = true;
  }, 2200);
}

function getEditorText(editorEl) {
  return (editorEl.textContent || "").replace(/\u00a0/g, " ");
}

function setEditorText(editorEl, text) {
  editorEl.textContent = text || "";
  editorEl.dataset.highlighted = "false";
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function tokenizeWithSpaces(text) {
  return text.split(/(\s+)/).filter((token) => token.length > 0);
}

function computeDiffOperations(leftText, rightText) {
  const left = tokenizeWithSpaces(leftText);
  const right = tokenizeWithSpaces(rightText);
  const maxCells = 120000;

  if (left.length * right.length > maxCells) {
    return [
      { type: "replace", left: left.join(""), right: right.join("") },
    ];
  }

  const dp = Array.from({ length: left.length + 1 }, () =>
    Array(right.length + 1).fill(0)
  );

  for (let i = left.length - 1; i >= 0; i -= 1) {
    for (let j = right.length - 1; j >= 0; j -= 1) {
      if (left[i] === right[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const operations = [];
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) {
      operations.push({ type: "equal", left: left[i], right: right[j] });
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      operations.push({ type: "delete", left: left[i], right: "" });
      i += 1;
    } else {
      operations.push({ type: "insert", left: "", right: right[j] });
      j += 1;
    }
  }

  while (i < left.length) {
    operations.push({ type: "delete", left: left[i], right: "" });
    i += 1;
  }
  while (j < right.length) {
    operations.push({ type: "insert", left: "", right: right[j] });
    j += 1;
  }

  const merged = [];
  for (const op of operations) {
    const last = merged[merged.length - 1];
    if (!last || last.type !== op.type) {
      merged.push({ ...op });
      continue;
    }
    last.left += op.left;
    last.right += op.right;
  }

  const normalized = [];
  for (let idx = 0; idx < merged.length; idx += 1) {
    const current = merged[idx];
    const next = merged[idx + 1];
    if (
      current.type === "delete" &&
      next &&
      next.type === "insert"
    ) {
      normalized.push({
        type: "replace",
        left: current.left,
        right: next.right,
      });
      idx += 1;
    } else if (
      current.type === "insert" &&
      next &&
      next.type === "delete"
    ) {
      normalized.push({
        type: "replace",
        left: next.left,
        right: current.right,
      });
      idx += 1;
    } else {
      normalized.push(current);
    }
  }

  return normalized;
}

function renderDiffPreviews() {
  const source = getEditorText(inputTextEl);
  const changed = getEditorText(outputTextEl);
  if (!source.trim() && !changed.trim()) return;

  const ops = computeDiffOperations(source, changed);
  const sourceHtml = [];
  const changedHtml = [];

  for (const op of ops) {
    const leftSafe = escapeHtml(op.left || "");
    const rightSafe = escapeHtml(op.right || "");
    if (op.type === "equal") {
      sourceHtml.push(leftSafe);
      changedHtml.push(rightSafe);
    } else if (op.type === "delete") {
      sourceHtml.push(`<span class="diff-old">${leftSafe}</span>`);
    } else if (op.type === "insert") {
      changedHtml.push(`<span class="diff-new">${rightSafe}</span>`);
    } else if (op.type === "replace") {
      sourceHtml.push(`<span class="diff-old">${leftSafe}</span>`);
      changedHtml.push(`<span class="diff-new">${rightSafe}</span>`);
    }
  }

  inputTextEl.innerHTML = sourceHtml.join("");
  outputTextEl.innerHTML = changedHtml.join("");
  inputTextEl.dataset.highlighted = "true";
  outputTextEl.dataset.highlighted = "true";
}

function clearHighlightOnFocus(editorEl) {
  if (editorEl.dataset.highlighted === "true") {
    const plain = getEditorText(editorEl);
    setEditorText(editorEl, plain);
  }
}

function getBackups() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch (_e) {
    return [];
  }
}

function setBackups(backups) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(backups));
}

function renderBackups() {
  const backups = getBackups();
  if (!backups.length) {
    backupListEl.innerHTML = "<p>Нет сохраненных бекапов</p>";
    return;
  }

  backupListEl.innerHTML = backups
    .map(
      (b) => `
      <div class="backup-item">
        <div class="backup-title-row">
          <strong class="backup-title">${escapeHtml(getBackupTitle(b))}</strong>
          <button class="btn btn-outline btn-icon btn-compact" data-id="${b.id}" data-action="rename" title="Переименовать бэкап" aria-label="Переименовать бэкап">✏</button>
        </div>
        <div>${(b.inputText || "").slice(0, 80).replace(/</g, "&lt;")}...</div>
        <div class="backup-meta">${new Date(b.timestamp).toLocaleString()}</div>
        <div class="backup-actions">
          <button class="btn btn-outline" data-id="${b.id}" data-action="restore">Восстановить</button>
          <button class="btn btn-outline" data-id="${b.id}" data-action="delete">Удалить</button>
        </div>
      </div>
    `
    )
    .join("");
}

function buildDefaultBackupTitle(inputText, timestamp) {
  const preview = (inputText || "").trim().slice(0, 28);
  if (preview) {
    return `Бэкап: ${preview}`;
  }
  return `Бэкап ${new Date(timestamp).toLocaleTimeString()}`;
}

function getBackupTitle(backup) {
  if (backup?.title && String(backup.title).trim()) {
    return String(backup.title).trim();
  }
  return buildDefaultBackupTitle(backup?.inputText || "", backup?.timestamp || new Date().toISOString());
}

function createBackup({ notify = true } = {}) {
  const inputText = getEditorText(inputTextEl);
  const outputText = getEditorText(outputTextEl);
  if (!inputText.trim() && !outputText.trim()) {
    if (notify) {
      showToast("Нет текста для сохранения");
    }
    return false;
  }
  const backups = getBackups();
  backups.unshift({
    id: String(Date.now()),
    inputText,
    outputText,
    title: buildDefaultBackupTitle(inputText, new Date().toISOString()),
    timestamp: new Date().toISOString(),
  });
  setBackups(backups.slice(0, 30));
  renderBackups();
  renderDiffPreviews();
  if (notify) {
    showToast("Бекап сохранен");
  }
  return true;
}

function addBackup() {
  createBackup({ notify: true });
}

async function processTextFromChat(instructions) {
  const text = getEditorText(inputTextEl).trim();
  if (!text) {
    throw new Error("Введите исходный текст для редактирования");
  }

  sendChatBtn.disabled = true;
  sendChatBtn.textContent = "Обрабатывается...";
  try {
    const response = await fetch("/api/process-text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, instructions: instructions || "" }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.detail || "Ошибка AI-обработки");
    }
    setEditorText(outputTextEl, data.edited_text || "");
    renderDiffPreviews();
    const summary = (data.changes_summary || "Изменения отсутствуют.").trim();
    appendChatMessage("assistant", `Сводка изменений:\n${summary}`);
    showToast("Редактирование завершено");
  } finally {
    sendChatBtn.disabled = false;
    sendChatBtn.textContent = "Отправить";
  }
}

async function askChat(message) {
  sendChatBtn.disabled = true;
  sendChatBtn.textContent = "Отправка...";
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        document_text: getEditorText(inputTextEl),
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.detail || "Ошибка AI-чата");
    }
    appendChatMessage("assistant", (data.answer || "Нет ответа.").trim());
  } finally {
    sendChatBtn.disabled = false;
    sendChatBtn.textContent = "Отправить";
  }
}

async function uploadFile(file) {
  const formData = new FormData();
  formData.append("file", file);
  try {
    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.detail || "Ошибка загрузки");
    }
    setEditorText(inputTextEl, data.extracted_text || "");
    renderDiffPreviews();
    showToast(`Файл "${data.filename}" загружен`);
  } catch (error) {
    showToast(error.message || "Ошибка загрузки файла");
  }
}

function appendChatMessage(role, content) {
  const bubble = document.createElement("div");
  bubble.className = `chat-bubble ${role === "user" ? "chat-user" : "chat-assistant"}`;
  bubble.textContent = content;
  chatMessagesEl.appendChild(bubble);
  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
}

function setBackupsCollapsed(isCollapsed) {
  if (!backupsPanelEl || !toggleBackupsBtn) return;
  backupsPanelEl.classList.toggle("collapsed", isCollapsed);
  toggleBackupsBtn.innerHTML = isCollapsed ? "&raquo;" : "&laquo;";
}

function bindHorizontalResizer({
  resizerEl,
  onStart,
  onMove,
  onEnd,
  onDoubleClick,
}) {
  if (!resizerEl) return;
  let startX = 0;
  let startData = null;

  const handleMouseMove = (event) => {
    if (!startData) return;
    onMove(event.clientX - startX, event, startData);
  };

  const handleMouseUp = () => {
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
    onEnd?.(startData);
    startData = null;
  };

  resizerEl.addEventListener("mousedown", (event) => {
    event.preventDefault();
    startX = event.clientX;
    startData = onStart?.();
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  });
  resizerEl.addEventListener("dblclick", (event) => {
    event.preventDefault();
    onDoubleClick?.();
  });
}

function initLayoutResizers() {
  bindHorizontalResizer({
    resizerEl: leftResizerEl,
    onStart: () => {
      if (!backupsPanelEl || backupsPanelEl.classList.contains("collapsed")) return null;
      return { startWidth: backupsPanelEl.getBoundingClientRect().width };
    },
    onMove: (dx, _event, startData) => {
      if (!startData || !backupsPanelEl) return;
      const nextWidth = Math.max(220, Math.min(640, startData.startWidth + dx));
      backupsPanelEl.style.flexBasis = `${nextWidth}px`;
    },
    onDoubleClick: () => {
      if (!backupsPanelEl) return;
      setBackupsCollapsed(false);
      backupsPanelEl.style.flexBasis = `${DEFAULT_BACKUPS_WIDTH}px`;
    },
  });

  bindHorizontalResizer({
    resizerEl: rightResizerEl,
    onStart: () => {
      if (!chatPanelEl) return null;
      return { startWidth: chatPanelEl.getBoundingClientRect().width };
    },
    onMove: (dx, _event, startData) => {
      if (!startData || !chatPanelEl) return;
      const nextWidth = Math.max(260, Math.min(700, startData.startWidth - dx));
      chatPanelEl.style.flexBasis = `${nextWidth}px`;
    },
    onDoubleClick: () => {
      if (!chatPanelEl) return;
      chatPanelEl.style.flexBasis = `${DEFAULT_CHAT_WIDTH}px`;
    },
  });

  bindHorizontalResizer({
    resizerEl: editorResizerEl,
    onStart: () => {
      if (!sourceCardEl || !resultCardEl || !editorGridEl) return null;
      const sourceWidth = sourceCardEl.getBoundingClientRect().width;
      const gridWidth = editorGridEl.getBoundingClientRect().width;
      return { sourceWidth, gridWidth };
    },
    onMove: (dx, _event, startData) => {
      if (!startData || !sourceCardEl) return;
      const maxWidth = Math.max(280, startData.gridWidth - 320);
      const nextWidth = Math.max(280, Math.min(maxWidth, startData.sourceWidth + dx));
      sourceCardEl.style.flex = `0 0 ${nextWidth}px`;
      if (resultCardEl) {
        resultCardEl.style.flex = "1 1 0";
      }
    },
    onDoubleClick: () => {
      if (sourceCardEl) sourceCardEl.style.flex = "1 1 0";
      if (resultCardEl) resultCardEl.style.flex = "1 1 0";
    },
  });
}

function applyResponsiveLayoutState() {
  const isMobile = window.matchMedia("(max-width: 1200px)").matches;
  if (isMobile && backupsPanelEl) {
    backupsPanelEl.classList.remove("collapsed");
    backupsPanelEl.style.flexBasis = "";
    if (sourceCardEl) sourceCardEl.style.flex = "";
    if (resultCardEl) resultCardEl.style.flex = "";
    if (chatPanelEl) chatPanelEl.style.flexBasis = "";
    if (toggleBackupsBtn) toggleBackupsBtn.innerHTML = "&laquo;";
  }
}

async function sendChatMessage() {
  const message = chatInputEl.value.trim();
  if (!message) return;
  appendChatMessage("user", message);
  chatInputEl.value = "";
  const mode = chatModeEl?.value || "edit";
  try {
    if (mode === "ask") {
      await askChat(message);
    } else {
      await processTextFromChat(message);
    }
  } catch (error) {
    appendChatMessage("assistant", error.message || "Ошибка чата.");
    sendChatBtn.disabled = false;
    sendChatBtn.textContent = "Отправить";
  } finally {
    sendChatBtn.disabled = false;
  }
}

applyToSourceBtn.addEventListener("click", () => {
  const edited = getEditorText(outputTextEl).trim();
  if (!edited) {
    showToast("Измененный текст пуст");
    return;
  }
  setEditorText(inputTextEl, edited);
  setEditorText(outputTextEl, "");
  createBackup({ notify: false });
  renderDiffPreviews();
  showToast("Изменения приняты, бекап создан");
});
fileInput.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (file) uploadFile(file);
});
saveBackupBtn.addEventListener("click", addBackup);
toggleBackupsBtn?.addEventListener("click", () => {
  const isCollapsed = backupsPanelEl?.classList.contains("collapsed");
  setBackupsCollapsed(!isCollapsed);
});
sendChatBtn.addEventListener("click", sendChatMessage);
backupListEl.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) return;
  const id = target.dataset.id;
  const action = target.dataset.action;
  if (!id || !action) return;

  const backups = getBackups();
  const idx = backups.findIndex((b) => b.id === id);
  if (idx === -1) return;

  if (action === "restore") {
    setEditorText(inputTextEl, backups[idx].inputText || "");
    setEditorText(outputTextEl, backups[idx].outputText || "");
    renderDiffPreviews();
    showToast("Бекап восстановлен");
    return;
  }

  if (action === "rename") {
    const nextTitle = window.prompt("Новое название бэкапа:", getBackupTitle(backups[idx]));
    if (!nextTitle) return;
    const cleanedTitle = nextTitle.trim();
    if (!cleanedTitle) return;
    backups[idx].title = cleanedTitle;
    setBackups(backups);
    renderBackups();
    showToast("Название бэкапа обновлено");
    return;
  }

  if (action === "delete") {
    backups.splice(idx, 1);
    setBackups(backups);
    renderBackups();
    showToast("Бекап удален");
  }
});
chatInputEl.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendChatMessage();
  }
});
chatModeEl?.addEventListener("change", () => {
  if (chatModeEl.value === "edit") {
    chatInputEl.placeholder = "Опишите, как отредактировать исходный текст...";
    return;
  }
  chatInputEl.placeholder = "Задайте вопрос по документу...";
});
inputTextEl.addEventListener("focus", () => clearHighlightOnFocus(inputTextEl));
outputTextEl.addEventListener("focus", () => clearHighlightOnFocus(outputTextEl));
inputTextEl.addEventListener("blur", renderDiffPreviews);
outputTextEl.addEventListener("blur", renderDiffPreviews);

appendChatMessage(
  "assistant",
  "Здравствуйте! Выберите режим: 'Редактирование' для правок текста или 'Вопрос' для консультации."
);
chatInputEl.placeholder = "Опишите, как отредактировать исходный текст...";
setBackupsCollapsed(false);
initLayoutResizers();
applyResponsiveLayoutState();
window.addEventListener("resize", applyResponsiveLayoutState);
renderBackups();
renderDiffPreviews();
