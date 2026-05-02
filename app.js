
const menuToggle=document.querySelector(".menu-toggle");
const navMenu=document.querySelector(".nav-menu");
if(menuToggle&&navMenu){menuToggle.addEventListener("click",()=>navMenu.classList.toggle("show"));}

let balance=0;
let balanceHidden=false;
let savedUsername="";
let savedPin="";
let pendingTransfer=null;
let deferredPrompt=null;
let transactions=[];

const loginPage=document.getElementById("loginPage");
const appPage=document.getElementById("appPage");
const loadingOverlay=document.getElementById("loadingOverlay");

function formatMoney(amount){return "₦"+Number(amount).toLocaleString("en-NG");}

function login(){
  const usernameInput=document.getElementById("username");
  const pinInput=document.getElementById("pin");
  const username=usernameInput.value.trim();
  const pin=pinInput.value.trim();

  if(!savedUsername&&!username){alert("Please enter a demo username.");return;}
  if(pin.length!==4||isNaN(pin)){alert("Please enter any 4-digit demo PIN.");return;}
  if(savedPin&&pin!==savedPin){alert("Incorrect PIN.");return;}

  if(!savedUsername){savedUsername=username;savedPin=pin;}

  document.getElementById("displayName").textContent=savedUsername.split(" ")[0];
  document.getElementById("avatar").textContent=savedUsername[0].toUpperCase();

  loadingOverlay.classList.add("active");
  setTimeout(()=>{
    loadingOverlay.classList.remove("active");
    loginPage.classList.remove("active");
    appPage.classList.add("active");
    showScreen("homeScreen");
    pinInput.value="";
    updateUI();
  },450);
}

function lockApp(){
  appPage.classList.remove("active");
  loginPage.classList.add("active");
  document.getElementById("pin").value="";
  if(savedUsername){
    document.getElementById("usernameGroup").style.display="none";
    document.getElementById("pinLabel").textContent=`Welcome back, ${savedUsername.split(" ")[0]} — enter PIN`;
  }
  showScreen("homeScreen");
}

function fullLogout(){
  savedUsername="";
  savedPin="";
  document.getElementById("usernameGroup").style.display="block";
  document.getElementById("pinLabel").textContent="PIN";
  document.getElementById("username").value="";
  lockApp();
}

function showScreen(screenId){
  document.querySelectorAll(".screen").forEach(screen=>screen.classList.remove("active"));
  document.getElementById(screenId).classList.add("active");
  document.querySelectorAll(".nav-item").forEach(item=>item.classList.toggle("active",item.dataset.screen===screenId));
  document.querySelectorAll(".nav-link[data-screen]").forEach(item=>item.classList.toggle("active",item.dataset.screen===screenId));
  if(navMenu)navMenu.classList.remove("show");
  updateStats();
}

function updateBalanceDisplay(){
  const balanceText=document.getElementById("balanceText");
  const hideBalanceBtn=document.getElementById("hideBalanceBtn");
  if(!balanceText||!hideBalanceBtn)return;
  balanceText.textContent=balanceHidden?"₦••••••":formatMoney(balance);
  hideBalanceBtn.textContent=balanceHidden?"Show":"Hide";
}

function toggleBalance(){balanceHidden=!balanceHidden;updateBalanceDisplay();}
function updateUI(){updateBalanceDisplay();renderTransactions();updateStats();}

function renderTransactions(){
  const list=document.getElementById("transactionList");
  list.innerHTML="";
  if(transactions.length===0){
    list.innerHTML=`<p style="text-align:center;color:#64748b;margin-top:20px;">No transactions yet. Add demo credit to start.</p>`;
    return;
  }
  transactions.forEach(tx=>{
    const sign=tx.type==="credit"?"+":"-";
    const txClass=tx.type==="credit"?"credit":"debit";
    list.innerHTML+=`
      <div class="transaction">
        <div class="transaction-left">
          <div class="transaction-icon">${tx.icon}</div>
          <div class="transaction-info"><h4>${tx.title}</h4><p>${tx.date}</p></div>
        </div>
        <div class="amount ${txClass}">${sign}${formatMoney(tx.amount)}</div>
      </div>`;
  });
}

function sendMoney(){
  const recipient=document.getElementById("recipientName").value.trim();
  const accountNumber=document.getElementById("accountNumber").value.trim();
  const amount=Number(document.getElementById("transferAmount").value);
  const bank=document.getElementById("bankName").value;
  const successMessage=document.getElementById("successMessage");
  const dangerMessage=document.getElementById("dangerMessage");
  successMessage.style.display="none";dangerMessage.style.display="none";
  if(!recipient||accountNumber.length!==10||isNaN(accountNumber)||amount<=0){
    dangerMessage.textContent="Please enter valid transfer details.";
    dangerMessage.style.display="block";return;
  }
  if(amount>balance){
    dangerMessage.textContent="Insufficient demo balance. Add demo credit first.";
    dangerMessage.style.display="block";return;
  }
  pendingTransfer={recipient,accountNumber,amount,bank};
  openPinModal();
}

function openPinModal(){
  document.getElementById("transferPin").value="";
  document.getElementById("pinError").style.display="none";
  document.getElementById("pinModal").classList.add("active");
  setTimeout(()=>document.getElementById("transferPin").focus(),100);
}

function closePinModal(){document.getElementById("pinModal").classList.remove("active");pendingTransfer=null;}

function confirmTransferPin(){
  const enteredPin=document.getElementById("transferPin").value.trim();
  const pinError=document.getElementById("pinError");
  const successMessage=document.getElementById("successMessage");
  pinError.style.display="none";
  if(enteredPin!==savedPin){
    pinError.textContent="Incorrect PIN. Transfer not completed.";
    pinError.style.display="block";return;
  }
  if(!pendingTransfer)return;
  balance-=pendingTransfer.amount;
  transactions.unshift({title:`Transfer to ${pendingTransfer.recipient}`,date:`Now • ${pendingTransfer.bank}`,amount:pendingTransfer.amount,type:"debit",icon:"💸"});
  successMessage.textContent=`Demo transfer of ${formatMoney(pendingTransfer.amount)} sent to ${pendingTransfer.recipient}.`;
  successMessage.style.display="block";
  document.getElementById("recipientName").value="";
  document.getElementById("accountNumber").value="";
  document.getElementById("transferAmount").value="";
  closePinModal();
  updateUI();
}

function payBill(){
  const amount=12000;
  if(amount>balance)return alert("Insufficient demo balance. Add demo credit first.");
  balance-=amount;
  transactions.unshift({title:"Electricity Bill",date:"Now",amount,type:"debit",icon:"🧾"});
  updateUI();alert("Demo electricity bill paid successfully.");
}

function buyAirtime(){
  const amount=2000;
  if(amount>balance)return alert("Insufficient demo balance. Add demo credit first.");
  balance-=amount;
  transactions.unshift({title:"Airtime Purchase",date:"Now",amount,type:"debit",icon:"📱"});
  updateUI();alert("Demo airtime purchase successful.");
}

function addDemoCredit(){
  const amount=100000;
  balance+=amount;
  transactions.unshift({title:"Demo Credit Added",date:"Now",amount,type:"credit",icon:"➕"});
  updateUI();alert("₦100,000 demo credit added.");
}

function clearTransactions(){
  if(!confirm("Clear all demo transactions?"))return;
  transactions=[];updateUI();
}

function updateStats(){
  const totalCredit=transactions.filter(tx=>tx.type==="credit").reduce((sum,tx)=>sum+tx.amount,0);
  const totalDebit=transactions.filter(tx=>tx.type==="debit").reduce((sum,tx)=>sum+tx.amount,0);
  document.getElementById("totalCredit").textContent=formatMoney(totalCredit);
  document.getElementById("totalDebit").textContent=formatMoney(totalDebit);
  document.getElementById("totalTransactions").textContent=transactions.length;
}

function showInstallButtons(){
  ["installLoginBtn","installSmallBtn","installSettingsBtn","pwaInstallBtn"].forEach(id=>{
    const btn=document.getElementById(id);
    if(btn)btn.style.display="inline-block";
  });
}

function hideInstallButtons(){
  ["installLoginBtn","installSmallBtn","installSettingsBtn","pwaInstallBtn"].forEach(id=>{
    const btn=document.getElementById(id);
    if(btn)btn.style.display="none";
  });
}

async function installApp(){
  if(!deferredPrompt){
    alert("Use your browser menu and choose 'Add to Home screen' or 'Install app'. Install works best after hosting on HTTPS like GitHub Pages.");
    return;
  }
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt=null;
  hideInstallButtons();
}

window.addEventListener("beforeinstallprompt",(event)=>{
  event.preventDefault();
  deferredPrompt=event;
  showInstallButtons();
});

window.addEventListener("appinstalled",()=>{
  deferredPrompt=null;
  hideInstallButtons();
  alert("SwiftBank installed successfully.");
});

if("serviceWorker" in navigator){
  window.addEventListener("load",()=>navigator.serviceWorker.register("service-worker.js").catch(()=>{}));
}

document.addEventListener("DOMContentLoaded",()=>{
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

  ["installLoginBtn","installSmallBtn","installSettingsBtn"].forEach(id=>{
    const btn=document.getElementById(id);
    if(btn)btn.addEventListener("click",installApp);
  });

  document.querySelectorAll("[data-screen]").forEach(button=>{
    button.addEventListener("click",(event)=>{
      event.preventDefault();
      showScreen(button.dataset.screen);
    });
  });

  document.getElementById("pin").addEventListener("keydown",event=>{if(event.key==="Enter")login();});
  document.getElementById("transferPin").addEventListener("keydown",event=>{if(event.key==="Enter")confirmTransferPin();});
  updateUI();
});
