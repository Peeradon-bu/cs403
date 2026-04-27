// Data Storage
let inventory = JSON.parse(localStorage.getItem('my_stock_v3')) || [];
let logs = JSON.parse(localStorage.getItem('my_logs_v3')) || [];
let currentFilter = 'all';
let myChart;

// Functions
function confirmSave() {
    const name = document.getElementById('pName').value.trim();
    const group = document.getElementById('pGroup').value;
    const price = parseFloat(document.getElementById('pPrice').value) || 0;
    const qty = parseInt(document.getElementById('pQty').value) || 0;
    const min = parseInt(document.getElementById('pMin').value) || 5;
    const source = document.getElementById('pSource').value.trim();

    if (!name || !source) return alert("กรุณาระบุชื่อและแหล่งซื้อให้ครบ");

    if (inventory.some(i => i.name.toLowerCase() === name.toLowerCase() && i.group === group)) {
        return alert("มีชื่อนี้อยู่ในหมวดหมู่นี้แล้ว");
    }

    if (confirm(`ยืนยันการบันทึกสินค้า: ${name}?`)) {
        inventory.push({ id: Date.now(), name, group, price, qty, min, source });
        addLog(name, `ลงทะเบียนใหม่ (+${qty})`, source);
        saveData();
        closeModal();
        document.getElementById('pName').value = '';
        document.getElementById('pSource').value = '';
    }
}

function updateQty(id, change) {
    const item = inventory.find(i => String(i.id) === String(id)); 
    if (!item) return alert("เกิดข้อผิดพลาด: ไม่พบข้อมูลสินค้านี้");

    let currentQty = parseInt(item.qty) || 0;

    if (change > 0) {
        const addedStr = prompt(`ระบุจำนวนที่ต้องการเติมสต็อก "${item.name}":`, "1"); 
        if (addedStr === null || addedStr.trim() === "") return; 
        
        const addedNum = parseInt(addedStr);
        if (isNaN(addedNum) || addedNum <= 0) return alert("กรุณากรอกตัวเลขจำนวนเต็มที่ถูกต้อง");
        
        item.qty = currentQty + addedNum; 
        addLog(item.name, `เติมเข้า (+${addedNum})`, item.source);
    } else {
        if (currentQty + change < 0) return alert("สต็อกไม่เพียงพอสำหรับการหักออก!");
        item.qty = currentQty + change;
        addLog(item.name, `ขาย/จ่ายออก (${change})`, "หน้าร้าน");
    }
    
    saveData();
}

function addLog(name, action, source) {
    const now = new Date().toLocaleString('th-TH');
    logs.unshift({ date: now, name, action, source });
    if (logs.length > 30) logs.pop();
}

function saveData() {
    localStorage.setItem('my_stock_v3', JSON.stringify(inventory));
    localStorage.setItem('my_logs_v3', JSON.stringify(logs));
    
    // เช็คว่าอยู่หน้าไหน แล้วรีเฟรชหน้านั้น
    if (document.getElementById('productList')) {
        renderStock();
    }
    if (document.getElementById('categoryChart')) {
        updateAnalytics();
    }
}

// UI แสดงผลหน้า Stock
function renderStock() {
    const list = document.getElementById('productList');
    if(!list) return; // ถ้าไม่ได้อยู่หน้า index.html ให้ข้ามไป

    const search = document.getElementById('searchTerm').value.toLowerCase();
    
    let filtered = inventory.filter(i => {
        const matchSearch = i.name.toLowerCase().includes(search) || i.group.toLowerCase().includes(search);
        const matchTab = 
            currentFilter === 'all' ? true :
            currentFilter === 'low' ? (i.qty <= i.min && i.qty > 0) : (i.qty === 0);
        return matchSearch && matchTab;
    });

    if(filtered.length === 0) {
        list.innerHTML = `<div class="text-center py-10 text-gray-400 text-sm">ไม่พบรายการสินค้า</div>`;
        return;
    }

    list.innerHTML = filtered.map(item => {
        let borderColor = 'border-green-500';
        let statusText = '<span class="text-[9px] text-green-600 font-bold uppercase tracking-widest">ปกติ/เยอะ</span>';
        
        if (item.qty === 0) {
            borderColor = 'border-red-500';
            statusText = '<span class="text-[9px] text-red-500 font-bold uppercase">หมดสต็อก</span>';
        } else if (item.qty <= item.min) {
            borderColor = 'border-orange-500';
            statusText = `<span class="text-[9px] text-orange-500 font-bold uppercase">ใกล้หมด (ต่ำกว่า ${item.min})</span>`;
        }

        return `
        <div class="bg-white p-4 rounded-2xl shadow-sm border-l-8 ${borderColor} flex justify-between items-center transform transition active:scale-95">
            <div class="flex-1 pr-2">
                <span class="text-[8px] font-bold px-2 py-0.5 rounded-lg bg-gray-100 text-gray-500 uppercase">${item.group}</span>
                <div class="font-bold text-gray-800 text-base leading-tight mt-1 truncate">${item.name}</div>
                <div class="mt-1">${statusText}</div>
            </div>
            <div class="flex items-center gap-2 bg-gray-50 p-1.5 rounded-xl border border-gray-100">
                <button onclick="updateQty(${item.id}, -1)" class="w-8 h-8 flex items-center justify-center rounded-lg bg-white text-gray-400 shadow-sm border hover:text-red-500">-</button>
                <div class="text-center min-w-[30px]">
                    <div class="text-lg font-bold text-gray-800">${item.qty}</div>
                    <div class="text-[8px] text-gray-400 uppercase">ชิ้น</div>
                </div>
                <button onclick="updateQty(${item.id}, 1)" class="w-8 h-8 flex items-center justify-center rounded-lg bg-white text-gray-400 shadow-sm border hover:text-green-500">+</button>
            </div>
        </div>`;
    }).join('');
}

// UI แสดงผลหน้า Dashboard
function updateAnalytics() {
    const totalValueElem = document.getElementById('totalValue');
    if(!totalValueElem) return; // ถ้าไม่ได้อยู่หน้า Dashboard ให้ข้ามไป

    const totalValue = inventory.reduce((sum, i) => sum + (i.price * parseInt(i.qty)), 0);
    const alertCount = inventory.filter(i => parseInt(i.qty) <= i.min).length;

    totalValueElem.innerText = `฿${totalValue.toLocaleString()}`;
    document.getElementById('dash-low').innerText = alertCount;

    const catData = { "ขนมขบเคี้ยว": 0, "น้ำ": 0, "ของใช้ทั่วไป": 0, "อื่น ๆ": 0 };
    inventory.forEach(i => catData[i.group] = (catData[i.group] || 0) + 1);

    const breakdown = document.getElementById('categoryBreakdown');
    breakdown.innerHTML = Object.keys(catData).map(cat => `
        <div class="flex justify-between items-center border-b border-gray-50 pb-2">
            <span class="font-bold text-gray-600">${cat}</span>
            <span class="text-primary font-bold">${catData[cat]} รายการ</span>
        </div>
    `).join('');

    const ctx = document.getElementById('categoryChart').getContext('2d');
    if (myChart) myChart.destroy();
    myChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(catData),
            datasets: [{
                data: Object.values(catData),
                backgroundColor: ['#26b899', '#3b82f6', '#f59e0b', '#ef4444'],
                borderWidth: 0
            }]
        },
        options: {
            maintainAspectRatio: false,
            cutout: '75%',
            plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } }
        }
    });
}

// Helpers
function openModal() { document.getElementById('modal').classList.remove('hidden'); }
function closeModal() { document.getElementById('modal').classList.add('hidden'); }
function toggleHistory() { document.getElementById('historyModal').classList.toggle('translate-x-full'); renderLogs(); }

function setFilter(f) { 
    currentFilter = f; 
    document.querySelectorAll('header button[id^="t-"]').forEach(b => b.classList.remove('tab-active'));
    document.getElementById(`t-${f}`).classList.add('tab-active');
    renderStock(); 
}

function renderLogs() {
    document.getElementById('logContent').innerHTML = logs.map(l => `
        <div class="bg-white p-3 rounded-xl shadow-sm border-l-4 border-primary mb-2 text-xs">
            <div class="text-[8px] text-gray-400">${l.date}</div>
            <div class="font-bold text-gray-800">${l.name}</div>
            <div class="text-primary font-bold">${l.action}</div>
        </div>`).join('');
}

// โหลดข้อมูลเมื่อเปิดหน้า Stock
if(document.getElementById('productList')) {
    renderStock();
}
