// Data Storage
let inventory = JSON.parse(localStorage.getItem('my_pro_stock_v2')) || [];
let logs = JSON.parse(localStorage.getItem('my_pro_logs_v2')) || [];
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

    if (!name || !source) return alert("กรุณาระบุชื่อและแหล่งซื้อ");

    if (inventory.some(i => i.name.toLowerCase() === name.toLowerCase() && i.group === group)) {
        return alert("มีชื่อนี้อยู่ในหมวดหมู่นี้แล้ว");
    }

    if (confirm(`บันทึกสินค้า: ${name}?`)) {
        inventory.push({ id: Date.now(), name, group, price, qty, min, source });
        addLog(name, `ลงทะเบียนใหม่ (+${qty})`, source);
        saveAndRefresh();
        closeModal();
        document.getElementById('pName').value = '';
        document.getElementById('pSource').value = '';
    }
}

function updateQty(id, change) {
    const item = inventory.find(i => i.id === id);
    if (item) {
        if (item.qty + change < 0) return alert("สต็อกไม่พอหัก");
        if (change > 0) {
            const added = prompt(`จำนวนที่เติม "${item.name}":`, change);
            if (!added) return;
            item.qty += parseInt(added);
            addLog(item.name, `เติมเข้า (+${added})`, item.source);
        } else {
            item.qty += change;
            addLog(item.name, `ขาย/จ่ายออก (${change})`, "หน้าร้าน");
        }
        saveAndRefresh();
    }
}

function addLog(name, action, source) {
    const now = new Date().toLocaleString('th-TH');
    logs.unshift({ date: now, name, action, source });
    if (logs.length > 30) logs.pop();
}

function saveAndRefresh() {
    localStorage.setItem('my_pro_stock_v2', JSON.stringify(inventory));
    localStorage.setItem('my_pro_logs_v2', JSON.stringify(logs));
    if (document.getElementById('productList')) renderStock();
    if (document.getElementById('totalValue')) updateAnalytics();
}

// Logic แสดงสีตามจำนวนสินค้า
function renderStock() {
    const list = document.getElementById('productList');
    const search = document.getElementById('searchTerm').value.toLowerCase();
    
    let filtered = inventory.filter(i => {
        const matchSearch = i.name.toLowerCase().includes(search) || i.group.toLowerCase().includes(search);
        const matchTab = 
            currentFilter === 'all' ? true :
            currentFilter === 'low' ? (i.qty <= i.min && i.qty > 0) : (i.qty === 0);
        return matchSearch && matchTab;
    });

    list.innerHTML = filtered.map(item => {
        // เงื่อนไขสี: หมด = แดง, ใกล้หมด = ส้ม, เหลือเยอะ/ปกติ = เขียว
        let borderColor = 'border-green-500'; // ค่าเริ่มต้นเป็นสีเขียว (เหลือเยอะ)
        let statusText = '';
        
        if (item.qty === 0) {
            borderColor = 'border-red-500';
            statusText = '<span class="text-[9px] text-red-500 font-bold uppercase">หมดสต็อก</span>';
        } else if (item.qty <= item.min) {
            borderColor = 'border-orange-500';
            statusText = `<span class="text-[9px] text-orange-500 font-bold uppercase">ใกล้หมด (ต่ำกว่า ${item.min})</span>`;
        } else {
            statusText = '<span class="text-[9px] text-green-600 font-bold uppercase tracking-widest">ปกติ/เยอะ</span>';
        }

        return `
        <div class="bg-white p-4 rounded-2xl shadow-sm border-l-8 ${borderColor} flex justify-between items-center transform transition active:scale-95">
            <div class="flex-1">
                <span class="text-[8px] font-bold px-2 py-0.5 rounded-lg bg-gray-100 text-gray-400 uppercase tracking-tighter">${item.group}</span>
                <div class="font-bold text-gray-800 text-lg leading-tight mt-1">${item.name}</div>
                <div class="mt-1">${statusText}</div>
            </div>
            <div class="flex items-center gap-3 bg-gray-50 p-2 rounded-xl border border-gray-100">
                <button onclick="updateQty(${item.id}, -1)" class="w-8 h-8 flex items-center justify-center rounded-lg bg-white text-gray-400 shadow-sm border">-</button>
                <div class="text-center min-w-[30px]">
                    <div class="text-lg font-bold text-gray-800">${item.qty}</div>
                    <div class="text-[8px] text-gray-400 uppercase">ชิ้น</div>
                </div>
                <button onclick="updateQty(${item.id}, 1)" class="w-8 h-8 flex items-center justify-center rounded-lg bg-white text-gray-400 shadow-sm border">+</button>
            </div>
        </div>`;
    }).join('');
}

// Dashboard Analysis
function updateAnalytics() {
    const totalValue = inventory.reduce((sum, i) => sum + (i.price * i.qty), 0);
    const alertCount = inventory.filter(i => i.qty <= i.min).length;

    document.getElementById('totalValue').innerText = `฿${totalValue.toLocaleString()}`;
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
            plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 9 } } } }
        }
    });
}

// Helpers
function openModal() { document.getElementById('modal').classList.remove('hidden'); }
function closeModal() { document.getElementById('modal').classList.add('hidden'); }
function toggleHistory() { document.getElementById('historyModal').classList.toggle('translate-x-full'); renderLogs(); }
function setFilter(f) { 
    currentFilter = f; 
    document.querySelectorAll('header button').forEach(b => b.classList.remove('tab-active'));
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

if (document.getElementById('productList')) renderStock();