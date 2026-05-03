import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  runTransaction,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  arrayUnion
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import { firebaseConfig } from "./firebase-config.js";

window.swiftBankModuleReady = true;

function firebaseConfigIsReady() {
  return firebaseConfig &&
    firebaseConfig.apiKey &&
    !firebaseConfig.apiKey.includes("PASTE_") &&
    firebaseConfig.projectId &&
    !firebaseConfig.projectId.includes("PASTE_");
}

if (!firebaseConfigIsReady()) {
  alert(
    "Firebase is not configured yet.\n\n" +
    "Open firebase-config.js and replace the placeholder values with your real Firebase Web App config."
  );
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const LAST_ACCOUNT_KEY = "swiftbank_online_last_account_v1";

let currentUserAccount = "";
let currentUser = null;
let unsubscribeCurrentUser = null;
let pendingTransfer = null;
let balanceHidden = false;
let deferredPrompt = null;

const loginPage = document.getElementById("loginPage");
const appPage = document.getElementById("appPage");
const loadingOverlay = document.getElementById("loadingOverlay");

const menuToggle = document.querySelector(".menu-toggle");
const navMenu = document.querySelector(".nav-menu");
if (menuToggle && navMenu) {
  menuToggle.addEventListener("click", () => navMenu.classList.toggle("show"));
}

function formatMoney(amount) {
  return "₦" + Number(amount || 0).toLocaleString("en-NG");
}

function generateAccountNumber() {
  return "77" + Math.floor(10000000 + Math.random() * 89999999).toString();
}

async function accountExists(accountNumber) {
  const snap = await getDoc(doc(db, "accounts", accountNumber));
  return snap.exists();
}

async function generateUniqueAccountNumber() {
  let accountNumber;
  do {
    accountNumber = generateAccountNumber();
  } while (await accountExists(accountNumber));
  return accountNumber;
}

async function findAccountByUsername(username) {
  const q = query(collection(db, "accounts"), where("usernameLower", "==", username.toLowerCase()));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const first = snap.docs[0];
  return { accountNumber: first.id, ...first.data() };
}

async function login() {
  if (!firebaseConfigIsReady()) {
    alert("Firebase config is still placeholder. Open firebase-config.js and paste your real Firebase config first.");
    return;
  }

  const usernameInput = document.getElementById("username");
  const pinInput = document.getElementById("pin");
  const username = usernameInput.value.trim();
  const pin = pinInput.value.trim();

  if (pin.length !== 4 || isNaN(pin)) {
    alert("Please enter a 4-digit PIN.");
    return;
  }

  const lastAccount = localStorage.getItem(LAST_ACCOUNT_KEY);

  // PIN-only unlock
  if (!username && lastAccount) {
    const snap = await getDoc(doc(db, "accounts", lastAccount));
    if (!snap.exists()) {
      localStorage.removeItem(LAST_ACCOUNT_KEY);
      setupLoginScreen();
  updateInstallVisibility();
      alert("Saved account was not found online. Please login again.");
      return;
    }

    const user = snap.data();
    if (user.pin !== pin) {
      alert("Incorrect PIN.");
      return;
    }

    currentUserAccount = lastAccount;
    openApp();
    return;
  }

  if (!username) {
    alert("Please enter username.");
    return;
  }

  const existing = await findAccountByUsername(username);

  if (existing) {
    if (existing.pin !== pin) {
      alert("Incorrect PIN for this username.");
      return;
    }

    currentUserAccount = existing.accountNumber;
    localStorage.setItem(LAST_ACCOUNT_KEY, currentUserAccount);
    openApp();
    return;
  }

  const accountNumber = await generateUniqueAccountNumber();

  const newUser = {
    username,
    usernameLower: username.toLowerCase(),
    pin,
    accountNumber,
    balance: 0,
    transactions: [],
    createdAt: new Date().toISOString()
  };

  await setDoc(doc(db, "accounts", accountNumber), newUser);

  currentUserAccount = accountNumber;
  localStorage.setItem(LAST_ACCOUNT_KEY, currentUserAccount);

  alert(`New SwiftBank online demo account created.\nAccount Number: ${accountNumber}`);
  openApp();
}

function setupLoginScreen() {
  const lastAccount = localStorage.getItem(LAST_ACCOUNT_KEY);
  const usernameGroup = document.getElementById("usernameGroup");
  const usernameInput = document.getElementById("username");
  const pinLabel = document.getElementById("pinLabel");
  const loginBtn = document.getElementById("loginBtn");

  if (lastAccount) {
    usernameGroup.style.display = "none";
    usernameInput.value = "";
    pinLabel.textContent = "Welcome back — enter PIN";
    loginBtn.textContent = "Unlock Account";
  } else {
    usernameGroup.style.display = "block";
    usernameInput.value = "";
    pinLabel.textContent = "PIN";
    loginBtn.textContent = "Login / Create Account";
  }
}

function openApp() {
  loadingOverlay.classList.add("active");

  if (unsubscribeCurrentUser) unsubscribeCurrentUser();

  unsubscribeCurrentUser = onSnapshot(doc(db, "accounts", currentUserAccount), (snap) => {
    if (!snap.exists()) {
      alert("This account no longer exists.");
      fullLogout();
      return;
    }

    currentUser = snap.data();

    document.getElementById("displayName").textContent = currentUser.username.split(" ")[0];
    document.getElementById("avatar").textContent = currentUser.username[0].toUpperCase();
    document.getElementById("accountNumberText").textContent = currentUser.accountNumber;
    document.getElementById("cardAccountEnd").textContent = currentUser.accountNumber.slice(-4);

    updateUI();
  });

  setTimeout(() => {
    loadingOverlay.classList.remove("active");
    loginPage.classList.remove("active");
    appPage.classList.add("active");
    document.getElementById("pin").value = "";
    showScreen("homeScreen");
  }, 500);
}

function lockApp() {
  appPage.classList.remove("active");
  loginPage.classList.add("active");
  document.getElementById("pin").value = "";
  setupLoginScreen();
  showScreen("homeScreen");
}

function fullLogout() {
  if (unsubscribeCurrentUser) unsubscribeCurrentUser();
  currentUserAccount = "";
  currentUser = null;
  localStorage.removeItem(LAST_ACCOUNT_KEY);
  document.getElementById("username").value = "";
  document.getElementById("pin").value = "";
  setupLoginScreen();
  lockApp();
}

function showScreen(screenId) {
  document.querySelectorAll(".screen").forEach(screen => screen.classList.remove("active"));
  document.getElementById(screenId).classList.add("active");

  document.querySelectorAll(".nav-item").forEach(item => {
    item.classList.toggle("active", item.dataset.screen === screenId);
  });

  document.querySelectorAll(".nav-link[data-screen]").forEach(item => {
    item.classList.toggle("active", item.dataset.screen === screenId);
  });

  if (navMenu) navMenu.classList.remove("show");
  updateStats();
}

function updateBalanceDisplay() {
  if (!currentUser) return;

  const balanceText = document.getElementById("balanceText");
  const hideBalanceBtn = document.getElementById("hideBalanceBtn");

  balanceText.textContent = balanceHidden ? "₦••••••" : formatMoney(currentUser.balance);
  hideBalanceBtn.textContent = balanceHidden ? "Show" : "Hide";
}

function toggleBalance() {
  balanceHidden = !balanceHidden;
  updateBalanceDisplay();
}

function updateUI() {
  updateBalanceDisplay();
  renderTransactions();
  updateStats();
}

function renderTransactions() {
  const list = document.getElementById("transactionList");
  if (!currentUser) return;

  const transactions = currentUser.transactions || [];

  if (transactions.length === 0) {
    list.innerHTML = `<p style="text-align:center;color:#64748b;margin-top:20px;">No transactions yet. Add demo credit to start.</p>`;
    return;
  }

  list.innerHTML = "";
  transactions.forEach(tx => {
    const sign = tx.type === "credit" ? "+" : "-";
    const cls = tx.type === "credit" ? "credit" : "debit";
    list.innerHTML += `
      <div class="transaction">
        <div class="transaction-left">
          <div class="transaction-icon">${tx.icon}</div>
          <div class="transaction-info">
            <h4>${tx.title}</h4>
            <p>${tx.date}</p>
          </div>
        </div>
        <div class="amount ${cls}">${sign}${formatMoney(tx.amount)}</div>
      </div>
    `;
  });
}

async function sendMoney() {
  const recipientName = document.getElementById("recipientName").value.trim();
  const recipientAccountNumber = document.getElementById("recipientAccountNumber").value.trim();
  const amount = Number(document.getElementById("transferAmount").value);
  const success = document.getElementById("successMessage");
  const danger = document.getElementById("dangerMessage");

  success.style.display = "none";
  danger.style.display = "none";

  if (!recipientName || recipientAccountNumber.length !== 10 || isNaN(recipientAccountNumber) || amount <= 0) {
    danger.textContent = "Enter receiver username, valid account number, and amount.";
    danger.style.display = "block";
    return;
  }

  if (recipientAccountNumber === currentUser.accountNumber) {
    danger.textContent = "You cannot transfer to your own account.";
    danger.style.display = "block";
    return;
  }

  const receiverSnap = await getDoc(doc(db, "accounts", recipientAccountNumber));

  if (!receiverSnap.exists()) {
    danger.textContent = "Receiver account number not found.";
    danger.style.display = "block";
    return;
  }

  const receiver = receiverSnap.data();

  if (receiver.username.toLowerCase() !== recipientName.toLowerCase()) {
    danger.textContent = "Receiver username and account number do not match.";
    danger.style.display = "block";
    return;
  }

  if (amount > currentUser.balance) {
    danger.textContent = "Insufficient demo balance. Add demo credit first.";
    danger.style.display = "block";
    return;
  }

  pendingTransfer = {
    receiverAccount: recipientAccountNumber,
    receiverName: receiver.username,
    amount
  };

  openPinModal();
}

function openPinModal() {
  document.getElementById("transferPin").value = "";
  document.getElementById("pinError").style.display = "none";
  document.getElementById("pinModal").classList.add("active");
  setTimeout(() => document.getElementById("transferPin").focus(), 100);
}

function closePinModal() {
  document.getElementById("pinModal").classList.remove("active");
  pendingTransfer = null;
}

async function confirmTransferPin() {
  const enteredPin = document.getElementById("transferPin").value.trim();
  const pinError = document.getElementById("pinError");

  pinError.style.display = "none";

  if (!currentUser || !pendingTransfer) return;

  if (enteredPin !== currentUser.pin) {
    pinError.textContent = "Incorrect PIN. Transfer not completed.";
    pinError.style.display = "block";
    return;
  }

  const senderRef = doc(db, "accounts", currentUser.accountNumber);
  const receiverRef = doc(db, "accounts", pendingTransfer.receiverAccount);

  try {
    await runTransaction(db, async (transaction) => {
      const senderSnap = await transaction.get(senderRef);
      const receiverSnap = await transaction.get(receiverRef);

      if (!senderSnap.exists()) throw new Error("Sender account not found.");
      if (!receiverSnap.exists()) throw new Error("Receiver account not found.");

      const sender = senderSnap.data();
      const receiver = receiverSnap.data();

      if (sender.balance < pendingTransfer.amount) {
        throw new Error("Insufficient demo balance.");
      }

      const now = new Date().toLocaleString();

      const senderTx = {
        title: `Transfer to ${receiver.username}`,
        date: `${now} • ${receiver.accountNumber}`,
        amount: pendingTransfer.amount,
        type: "debit",
        icon: "💸"
      };

      const receiverTx = {
        title: `Transfer from ${sender.username}`,
        date: `${now} • ${sender.accountNumber}`,
        amount: pendingTransfer.amount,
        type: "credit",
        icon: "⬇️"
      };

      transaction.update(senderRef, {
        balance: sender.balance - pendingTransfer.amount,
        transactions: [senderTx, ...(sender.transactions || [])]
      });

      transaction.update(receiverRef, {
        balance: receiver.balance + pendingTransfer.amount,
        transactions: [receiverTx, ...(receiver.transactions || [])]
      });
    });

    document.getElementById("successMessage").textContent =
      `Demo transfer of ${formatMoney(pendingTransfer.amount)} sent to ${pendingTransfer.receiverName}.`;
    document.getElementById("successMessage").style.display = "block";

    document.getElementById("recipientName").value = "";
    document.getElementById("recipientAccountNumber").value = "";
    document.getElementById("transferAmount").value = "";

    closePinModal();
  } catch (error) {
    pinError.textContent = error.message || "Transfer failed.";
    pinError.style.display = "block";
  }
}

async function addDemoCredit() {
  if (!currentUser) return;

  const amount = 100000;
  const tx = {
    title: "Demo Credit Added",
    date: new Date().toLocaleString(),
    amount,
    type: "credit",
    icon: "➕"
  };

  await updateDoc(doc(db, "accounts", currentUser.accountNumber), {
    balance: currentUser.balance + amount,
    transactions: [tx, ...(currentUser.transactions || [])]
  });

  alert("₦100,000 demo credit added.");
}

async function payBill() {
  if (!currentUser) return;
  const amount = 12000;

  if (amount > currentUser.balance) {
    alert("Insufficient demo balance.");
    return;
  }

  const tx = {
    title: "Electricity Bill",
    date: new Date().toLocaleString(),
    amount,
    type: "debit",
    icon: "🧾"
  };

  await updateDoc(doc(db, "accounts", currentUser.accountNumber), {
    balance: currentUser.balance - amount,
    transactions: [tx, ...(currentUser.transactions || [])]
  });
}

async function buyAirtime() {
  if (!currentUser) return;
  const amount = 2000;

  if (amount > currentUser.balance) {
    alert("Insufficient demo balance.");
    return;
  }

  const tx = {
    title: "Airtime Purchase",
    date: new Date().toLocaleString(),
    amount,
    type: "debit",
    icon: "📱"
  };

  await updateDoc(doc(db, "accounts", currentUser.accountNumber), {
    balance: currentUser.balance - amount,
    transactions: [tx, ...(currentUser.transactions || [])]
  });
}

async function clearTransactions() {
  if (!currentUser) return;
  if (!confirm("Clear your own transaction history?")) return;

  await updateDoc(doc(db, "accounts", currentUser.accountNumber), {
    transactions: []
  });
}

function updateStats() {
  if (!currentUser) return;

  const transactions = currentUser.transactions || [];

  const credit = transactions
    .filter(tx => tx.type === "credit")
    .reduce((sum, tx) => sum + tx.amount, 0);

  const debit = transactions
    .filter(tx => tx.type === "debit")
    .reduce((sum, tx) => sum + tx.amount, 0);

  document.getElementById("totalCredit").textContent = formatMoney(credit);
  document.getElementById("totalDebit").textContent = formatMoney(debit);
  document.getElementById("totalTransactions").textContent = transactions.length;
}


function isAppInstalledMode() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function updateInstallVisibility() {
  if (isAppInstalledMode()) {
    hideInstallButtons();
    return;
  }

  if (deferredPrompt) {
    showInstallButtons();
  } else {
    hideInstallButtons();
  }
}

function showInstallButtons() {
  ["installLoginBtn", "installSmallBtn", "installSettingsBtn", "pwaInstallBtn"].forEach(id => {
    const b = document.getElementById(id);
    if (b) b.style.display = "inline-block";
  });
}

function hideInstallButtons() {
  ["installLoginBtn", "installSmallBtn", "installSettingsBtn", "pwaInstallBtn"].forEach(id => {
    const b = document.getElementById(id);
    if (b) b.style.display = "none";
  });
}

async function installApp() {
  if (!deferredPrompt) {
    alert("Use your browser menu and choose Add to Home screen or Install app.");
    return;
  }

  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  hideInstallButtons();
}

window.addEventListener("beforeinstallprompt", e => {
  e.preventDefault();
  deferredPrompt = e;
  updateInstallVisibility();
});

window.addEventListener("appinstalled", () => {
  deferredPrompt = null;
  localStorage.setItem("swiftbank_app_installed", "yes");
  hideInstallButtons();
  alert("SwiftBank installed successfully.");
});

window.matchMedia("(display-mode: standalone)").addEventListener?.("change", updateInstallVisibility);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setupLoginScreen();

  document.getElementById("loginBtn").addEventListener("click", login);
  document.getElementById("hideBalanceBtn").addEventListener("click", toggleBalance);
  document.getElementById("sendMoneyBtn").addEventListener("click", sendMoney);
  document.getElementById("cancelPinBtn").addEventListener("click", closePinModal);
  document.getElementById("confirmPinBtn").addEventListener("click", confirmTransferPin);
  document.getElementById("payBillBtn").addEventListener("click", payBill);
  document.getElementById("buyAirtimeBtn").addEventListener("click", buyAirtime);
  document.getElementById("clearTransactionsBtn").addEventListener("click", clearTransactions);
  document.getElementById("addDemoCreditBtn").addEventListener("click", addDemoCredit);
  document.getElementById("lockAppBtn").addEventListener("click", lockApp);
  document.getElementById("fullLogoutBtn").addEventListener("click", fullLogout);

  ["installLoginBtn", "installSmallBtn", "installSettingsBtn"].forEach(id => {
    const b = document.getElementById(id);
    if (b) b.addEventListener("click", installApp);
  });

  document.querySelectorAll("[data-screen]").forEach(btn => {
    btn.addEventListener("click", e => {
      e.preventDefault();
      showScreen(btn.dataset.screen);
    });
  });

  document.getElementById("pin").addEventListener("keydown", e => {
    if (e.key === "Enter") login();
  });

  document.getElementById("transferPin").addEventListener("keydown", e => {
    if (e.key === "Enter") confirmTransferPin();
  });
});
