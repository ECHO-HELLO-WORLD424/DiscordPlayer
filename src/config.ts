let clientIdInput: HTMLInputElement | null;
let saveBtn: HTMLButtonElement | null;
let backBtn: HTMLButtonElement | null;
let saveMsgEl: HTMLElement | null;

/**
 * Load saved settings
 */
function loadSettings(): void {
  if (!clientIdInput) return;

  // Load from sessionStorage (only persists during current session)
  const savedClientId = sessionStorage.getItem('discord_client_id');
  if (savedClientId) {
    clientIdInput.value = savedClientId;
  }
}

/**
 * Save settings
 */
function saveSettings(): void {
  if (!clientIdInput || !saveMsgEl) return;

  const clientId = clientIdInput.value.trim();

  if (!clientId) {
    saveMsgEl.textContent = 'Please enter a Client ID';
    saveMsgEl.style.color = '#f44336';
    return;
  }

  // Validate that it looks like a Discord Client ID (should be numeric)
  if (!/^\d+$/.test(clientId)) {
    saveMsgEl.textContent = 'Client ID should be numeric';
    saveMsgEl.style.color = '#f44336';
    return;
  }

  // Save to sessionStorage
  sessionStorage.setItem('discord_client_id', clientId);

  saveMsgEl.textContent = 'Settings saved successfully!';
  saveMsgEl.style.color = '#4caf50';

  // Clear message after 3 seconds
  setTimeout(() => {
    if (saveMsgEl) {
      saveMsgEl.textContent = '';
    }
  }, 3000);
}

/**
 * Navigate back to main player page
 */
function navigateBack(): void {
  const baseUrl = window.location.origin;
  window.location.href = `${baseUrl}/index.html`;
}

window.addEventListener("DOMContentLoaded", () => {
  clientIdInput = document.querySelector("#client-id-input");
  saveBtn = document.querySelector("#save-btn");
  backBtn = document.querySelector("#back-btn");
  saveMsgEl = document.querySelector("#save-msg");

  // Load existing settings
  loadSettings();

  // Setup event listeners
  saveBtn?.addEventListener('click', saveSettings);
  backBtn?.addEventListener('click', navigateBack);

  // Save on Enter key
  clientIdInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      saveSettings();
    }
  });
});
