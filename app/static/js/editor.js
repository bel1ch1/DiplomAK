const inputTextEl = document.getElementById("inputText");
const outputTextEl = document.getElementById("outputText");
const changesSummaryEl = document.getElementById("changesSummary");
const processBtn = document.getElementById("processBtn");
const applyToSourceBtn = document.getElementById("applyToSourceBtn");
const fileInput = document.getElementById("fileInput");
const toastEl = document.getElementById("toast");
const saveBackupBtn = document.getElementById("saveBackupBtn");
const backupListEl = document.getElementById("backupList");
const sendChatBtn = document.getElementById("sendChatBtn");
const chatInputEl = document.getElementById("chatInput");
const chatMessagesEl = document.getElementById("chatMessages");

const STORAGE_KEY = "scientific-editor-backups-fastapi";

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

function addBackup() {
  const inputText = getEditorText(inputTextEl).trim();
  if (!inputText) {
    showToast("Нет текста для сохранения");
    return;
  }
  const backups = getBackups();
  backups.unshift({
    id: String(Date.now()),
    inputText: getEditorText(inputTextEl),
    outputText: getEditorText(outputTextEl),
    changesSummary: changesSummaryEl.textContent || "",
    timestamp: new Date().toISOString(),
  });
  setBackups(backups.slice(0, 30));
  renderBackups();
  renderDiffPreviews();
  showToast("Бекап сохранен");
}

async function processText() {
  const text = getEditorText(inputTextEl).trim();
  if (!text) {
    showToast("Введите текст для обработки");
    return;
  }

  processBtn.disabled = true;
  processBtn.textContent = "Обрабатывается...";
  try {
    const response = await fetch("/api/process-text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, instructions: "" }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.detail || "Ошибка AI-обработки");
    }
    setEditorText(outputTextEl, data.edited_text || "");
    changesSummaryEl.textContent = data.changes_summary || "Изменения отсутствуют.";
    renderDiffPreviews();
    showToast("Текст успешно обработан");
  } catch (error) {
    showToast(error.message || "Ошибка сервера");
  } finally {
    processBtn.disabled = false;
    processBtn.textContent = "Обработать ИИ";
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

async function sendChatMessage() {
  const message = chatInputEl.value.trim();
  if (!message) return;
  appendChatMessage("user", message);
  chatInputEl.value = "";
  sendChatBtn.disabled = true;
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
    appendChatMessage("assistant", data.answer || "Нет ответа.");
  } catch (error) {
    appendChatMessage("assistant", error.message || "Ошибка чата.");
  } finally {
    sendChatBtn.disabled = false;
  }
}

processBtn.addEventListener("click", processText);
applyToSourceBtn.addEventListener("click", () => {
  const edited = getEditorText(outputTextEl).trim();
  if (!edited) {
    showToast("Измененный текст пуст");
    return;
  }
  setEditorText(inputTextEl, getEditorText(outputTextEl));
  renderDiffPreviews();
  showToast("Измененный текст перенесен в исходный");
});
fileInput.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (file) uploadFile(file);
});
saveBackupBtn.addEventListener("click", addBackup);
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
    changesSummaryEl.textContent = backups[idx].changesSummary || "Пока нет данных.";
    renderDiffPreviews();
    showToast("Бекап восстановлен");
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
inputTextEl.addEventListener("focus", () => clearHighlightOnFocus(inputTextEl));
outputTextEl.addEventListener("focus", () => clearHighlightOnFocus(outputTextEl));
inputTextEl.addEventListener("blur", renderDiffPreviews);
outputTextEl.addEventListener("blur", renderDiffPreviews);

appendChatMessage(
  "assistant",
  "Здравствуйте! Я помогу отредактировать научный текст и отвечу на вопросы по стилю."
);
renderBackups();
renderDiffPreviews();
