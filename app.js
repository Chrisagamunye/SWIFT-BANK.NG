
const menuToggle=document.querySelector(".menu-toggle");
const navMenu=document.querySelector(".nav-menu");
if(menuToggle&&navMenu){menuToggle.addEventListener("click",()=>navMenu.classList.toggle("show"));}

const STORAGE_KEY="swiftbank_local_users_v1";
const LAST_ACCOUNT_KEY="swiftbank_last_local_account_v1";
let currentUserAccount="";
let pendingTransfer=null;
let balanceHidden=false;
let deferredPrompt=null;

const loginPage=document.getElementById("loginPage");
const appPage=document.getElementById("appPage");
const loadingOverlay=document.getElementById("loadingOverlay");

function getUsers(){return JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}");}
function saveUsers(users){localStorage.setItem(STORAGE_KEY,JSON.stringify(users));}
function generateAccountNumber(){const users=getUsers();let acc;do{acc="77"+Math.floor(10000000+Math.random()*89999999)}while(users[acc]);return acc;}
function formatMoney(amount){return "₦"+Number(amount||0).toLocaleString("en-NG");}
function getCurrentUser(){return getUsers()[currentUserAccount]||null;}
function saveCurrentUser(user){const users=getUsers();users[currentUserAccount]=user;saveUsers(users);}
function findUser(username,account){const user=getUsers()[account];if(!user)return null;return user.username.toLowerCase()===username.toLowerCase()?user:null;}

function setupLoginScreen(){
  const users=getUsers();
  const last=localStorage.getItem(LAST_ACCOUNT_KEY);
  const usernameGroup=document.getElementById("usernameGroup");
  const usernameInput=document.getElementById("username");
  const pinLabel=document.getElementById("pinLabel");
  const loginBtn=document.getElementById("loginBtn");
  if(last&&users[last]){
    currentUserAccount=last;
    usernameGroup.style.display="none";
    usernameInput.value="";
    pinLabel.textContent=`Welcome back, ${users[last].username.split(" ")[0]} — enter PIN`;
    loginBtn.textContent="Unlock Account";
  }else{
    currentUserAccount="";
    usernameGroup.style.display="block";
    usernameInput.value="";
    pinLabel.textContent="PIN";
    loginBtn.textContent="Login / Create Account";
  }
}

function login(){
  const users=getUsers();
  const username=document.getElementById("username").value.trim();
  const pin=document.getElementById("pin").value.trim();
  if(pin.length!==4||isNaN(pin)){alert("Please enter a 4-digit PIN.");return;}

  if(currentUserAccount&&users[currentUserAccount]){
    if(users[currentUserAccount].pin!==pin){alert("Incorrect PIN.");return;}
    localStorage.setItem(LAST_ACCOUNT_KEY,currentUserAccount);
    openApp();
    return;
  }

  if(!username){alert("Please enter username.");return;}

  let found="";
  Object.keys(users).forEach(acc=>{if(users[acc].username.toLowerCase()===username.toLowerCase())found=acc;});
  if(found){
    if(users[found].pin!==pin){alert("Incorrect PIN for this username.");return;}
    currentUserAccount=found;
  }else{
    const acc=generateAccountNumber();
    users[acc]={username,pin,accountNumber:acc,balance:0,transactions:[]};
    saveUsers(users);
    currentUserAccount=acc;
    alert(`New SwiftBank account created.\nAccount Number: ${acc}`);
  }
  localStorage.setItem(LAST_ACCOUNT_KEY,currentUserAccount);
  openApp();
}

function openApp(){
  const user=getCurrentUser();if(!user)return;
  document.getElementById("displayName").textContent=user.username.split(" ")[0];
  document.getElementById("avatar").textContent=user.username[0].toUpperCase();
  document.getElementById("accountNumberText").textContent=user.accountNumber;
  document.getElementById("cardAccountEnd").textContent=user.accountNumber.slice(-4);
  loadingOverlay.classList.add("active");
  setTimeout(()=>{loadingOverlay.classList.remove("active");loginPage.classList.remove("active");appPage.classList.add("active");document.getElementById("pin").value="";showScreen("homeScreen");updateUI();},400);
}

function lockApp(){appPage.classList.remove("active");loginPage.classList.add("active");document.getElementById("pin").value="";setupLoginScreen();showScreen("homeScreen");}
function fullLogout(){currentUserAccount="";localStorage.removeItem(LAST_ACCOUNT_KEY);document.getElementById("username").value="";document.getElementById("pin").value="";setupLoginScreen();lockApp();}

function showScreen(screenId){
  document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
  document.getElementById(screenId).classList.add("active");
  document.querySelectorAll(".nav-item").forEach(i=>i.classList.toggle("active",i.dataset.screen===screenId));
  document.querySelectorAll(".nav-link[data-screen]").forEach(i=>i.classList.toggle("active",i.dataset.screen===screenId));
  if(navMenu)navMenu.classList.remove("show");
  updateStats();
}

function updateBalanceDisplay(){
  const user=getCurrentUser();if(!user)return;
  document.getElementById("balanceText").textContent=balanceHidden?"₦••••••":formatMoney(user.balance);
  document.getElementById("hideBalanceBtn").textContent=balanceHidden?"Show":"Hide";
}
function toggleBalance(){balanceHidden=!balanceHidden;updateBalanceDisplay();}
function updateUI(){updateBalanceDisplay();renderTransactions();updateStats();}

function renderTransactions(){
  const user=getCurrentUser();const list=document.getElementById("transactionList");if(!user)return;
  if(user.transactions.length===0){list.innerHTML=`<p style="text-align:center;color:#64748b;margin-top:20px;">No transactions yet. Add demo credit to start.</p>`;return;}
  list.innerHTML="";
  user.transactions.forEach(tx=>{
    const sign=tx.type==="credit"?"+":"-";const cls=tx.type==="credit"?"credit":"debit";
    list.innerHTML+=`<div class="transaction"><div class="transaction-left"><div class="transaction-icon">${tx.icon}</div><div class="transaction-info"><h4>${tx.title}</h4><p>${tx.date}</p></div></div><div class="amount ${cls}">${sign}${formatMoney(tx.amount)}</div></div>`;
  });
}

function sendMoney(){
  const sender=getCurrentUser();
  const name=document.getElementById("recipientName").value.trim();
  const account=document.getElementById("recipientAccountNumber").value.trim();
  const amount=Number(document.getElementById("transferAmount").value);
  const success=document.getElementById("successMessage");
  const danger=document.getElementById("dangerMessage");
  success.style.display="none";danger.style.display="none";
  if(!name||account.length!==10||isNaN(account)||amount<=0){danger.textContent="Enter receiver username, valid account number, and amount.";danger.style.display="block";return;}
  if(account===sender.accountNumber){danger.textContent="You cannot transfer to your own account.";danger.style.display="block";return;}
  const receiver=findUser(name,account);
  if(!receiver){danger.textContent="No matching local SwiftBank account found on this browser.";danger.style.display="block";return;}
  if(amount>sender.balance){danger.textContent="Insufficient demo balance. Add demo credit first.";danger.style.display="block";return;}
  pendingTransfer={receiverAccount:receiver.accountNumber,receiverName:receiver.username,amount};
  openPinModal();
}

function openPinModal(){document.getElementById("transferPin").value="";document.getElementById("pinError").style.display="none";document.getElementById("pinModal").classList.add("active");setTimeout(()=>document.getElementById("transferPin").focus(),100);}
function closePinModal(){document.getElementById("pinModal").classList.remove("active");pendingTransfer=null;}

function confirmTransferPin(){
  const users=getUsers();const sender=users[currentUserAccount];const pin=document.getElementById("transferPin").value.trim();const err=document.getElementById("pinError");
  err.style.display="none";
  if(!sender||!pendingTransfer)return;
  if(pin!==sender.pin){err.textContent="Incorrect PIN. Transfer not completed.";err.style.display="block";return;}
  const receiver=users[pendingTransfer.receiverAccount];
  if(!receiver){err.textContent="Receiver account not found.";err.style.display="block";return;}
  if(pendingTransfer.amount>sender.balance){err.textContent="Insufficient demo balance.";err.style.display="block";return;}
  sender.balance-=pendingTransfer.amount;receiver.balance+=pendingTransfer.amount;
  const now=new Date().toLocaleString();
  sender.transactions.unshift({title:`Transfer to ${receiver.username}`,date:`${now} • ${receiver.accountNumber}`,amount:pendingTransfer.amount,type:"debit",icon:"💸"});
  receiver.transactions.unshift({title:`Transfer from ${sender.username}`,date:`${now} • ${sender.accountNumber}`,amount:pendingTransfer.amount,type:"credit",icon:"⬇️"});
  users[sender.accountNumber]=sender;users[receiver.accountNumber]=receiver;saveUsers(users);
  document.getElementById("successMessage").textContent=`Demo transfer of ${formatMoney(pendingTransfer.amount)} sent to ${receiver.username}.`;
  document.getElementById("successMessage").style.display="block";
  document.getElementById("recipientName").value="";document.getElementById("recipientAccountNumber").value="";document.getElementById("transferAmount").value="";
  closePinModal();updateUI();
}

function addDemoCredit(){const user=getCurrentUser();const amount=100000;user.balance+=amount;user.transactions.unshift({title:"Demo Credit Added",date:new Date().toLocaleString(),amount,type:"credit",icon:"➕"});saveCurrentUser(user);updateUI();alert("₦100,000 demo credit added.");}
function payBill(){const user=getCurrentUser();const amount=12000;if(amount>user.balance)return alert("Insufficient demo balance.");user.balance-=amount;user.transactions.unshift({title:"Electricity Bill",date:new Date().toLocaleString(),amount,type:"debit",icon:"🧾"});saveCurrentUser(user);updateUI();}
function buyAirtime(){const user=getCurrentUser();const amount=2000;if(amount>user.balance)return alert("Insufficient demo balance.");user.balance-=amount;user.transactions.unshift({title:"Airtime Purchase",date:new Date().toLocaleString(),amount,type:"debit",icon:"📱"});saveCurrentUser(user);updateUI();}
function clearTransactions(){const user=getCurrentUser();if(!confirm("Clear your own transaction history?"))return;user.transactions=[];saveCurrentUser(user);updateUI();}
function updateStats(){const user=getCurrentUser();if(!user)return;const c=user.transactions.filter(t=>t.type==="credit").reduce((s,t)=>s+t.amount,0);const d=user.transactions.filter(t=>t.type==="debit").reduce((s,t)=>s+t.amount,0);document.getElementById("totalCredit").textContent=formatMoney(c);document.getElementById("totalDebit").textContent=formatMoney(d);document.getElementById("totalTransactions").textContent=user.transactions.length;}

function showInstallButtons(){["installLoginBtn","installSmallBtn","installSettingsBtn","pwaInstallBtn"].forEach(id=>{const b=document.getElementById(id);if(b)b.style.display="inline-block";});}
function hideInstallButtons(){["installLoginBtn","installSmallBtn","installSettingsBtn","pwaInstallBtn"].forEach(id=>{const b=document.getElementById(id);if(b)b.style.display="none";});}
function isAppInstalledMode(){return window.matchMedia("(display-mode: standalone)").matches||window.navigator.standalone===true||localStorage.getItem("swiftbank_app_installed")==="yes";}
function updateInstallVisibility(){if(isAppInstalledMode())hideInstallButtons();else if(deferredPrompt)showInstallButtons();else hideInstallButtons();}
async function installApp(){if(!deferredPrompt){alert("Use your browser menu and choose Add to Home screen or Install app.");return;}deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;hideInstallButtons();}
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredPrompt=e;updateInstallVisibility();});
window.addEventListener("appinstalled",()=>{localStorage.setItem("swiftbank_app_installed","yes");hideInstallButtons();alert("SwiftBank installed successfully.");});
if("serviceWorker"in navigator){window.addEventListener("load",()=>navigator.serviceWorker.register("service-worker.js").catch(()=>{}));}

document.addEventListener("DOMContentLoaded",()=>{
  setupLoginScreen();updateInstallVisibility();
  document.getElementById("loginBtn").addEventListener("click",login);
  document.getElementById("hideBalanceBtn").addEventListener("click",toggleBalance);
  document.getElementById("sendMoneyBtn").addEventListener("click",sendMoney);
  document.getElementById("cancelPinBtn").addEventListener("click",closePinModal);
  document.getElementById("confirmPinBtn").addEventListener("click",confirmTransferPin);
  document.getElementById("payBillBtn").addEventListener("click",payBill);
  document.getElementById("buyAirtimeBtn").addEventListener("click",buyAirtime);
  document.getElementById("clearTransactionsBtn").addEventListener("click",clearTransactions);
  document.getElementById("addDemoCreditBtn").addEventListener("click",addDemoCredit);
  document.getElementById("lockAppBtn").addEventListener("click",lockApp);
  document.getElementById("fullLogoutBtn").addEventListener("click",fullLogout);
  ["installLoginBtn","installSmallBtn","installSettingsBtn"].forEach(id=>{const b=document.getElementById(id);if(b)b.addEventListener("click",installApp);});
  document.querySelectorAll("[data-screen]").forEach(btn=>btn.addEventListener("click",e=>{e.preventDefault();showScreen(btn.dataset.screen);}));
  document.getElementById("pin").addEventListener("keydown",e=>{if(e.key==="Enter")login();});
  document.getElementById("transferPin").addEventListener("keydown",e=>{if(e.key==="Enter")confirmTransferPin();});
});
