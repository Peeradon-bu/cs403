// Data Storage
let inventory = JSON.parse(localStorage.getItem('my_stock_final')) || [];
let logs = JSON.parse(localStorage.getItem('my_logs_final')) || [];
let monthlyPlan = JSON.parse(localStorage.getItem('my_monthly_plan')) || {}; 
let currentFilter = 'all';
let myChart;
let editingId = null;

// ----------------------------------------------------
// 1. ระบบจัดการสินค้าหลัก (เพิ่ม, แก้ไข, ลบ)
// ----------------------------------------------------
function confirmSave() {
    const name = document.getElementById('pName').value.trim();
    const group = document.getElementById('pGroup').value;
    const price = parseFloat(document.getElementById('pPrice').value) || 0;
    const qty = parseInt(document.getElementById('pQty').value) || 0;
    const min = parseInt(document.getElementById('pMin').value) || 5;
    const source = document.getElementById('pSource').value.trim();

    if (!name || !source) return alert("กรุณาระบุชื่อและแหล่งซื้อให้ครบ");

    if (editingId) {
        const itemIndex = inventory.findIndex(i => String(i.id) === String(editingId));
        if (itemIndex > -1) {
            inventory[itemIndex] = { id: editingId, name, group, price, qty, min, source };
            addLog(name, `แก้ไขข้อมูลสินค้า`, "-");
        }
    } else {
        if (inventory.some(i => i.name.toLowerCase() === name.toLowerCase() && i.group === group)) {
            return alert("มีชื่อสินค้านี้อยู่ในหมวดหมู่นี้แล้ว");
        }
        inventory.push({ id: Date.now(), name, group, price, qty, min, source });
        addLog(name, `ลงทะเบียนใหม่ (+${qty})`, source);
    }

    saveData();
    closeModal();
}

function deleteProduct() {
    if (!editingId) return;
    const item = inventory.find(i => String(i.id) === String(editingId));
    
    if (confirm(`คุณแน่ใจหรือไม่ที่จะลบสินค้า "${item.name}" อย่างถาวร?`)) {
        inventory = inventory.filter(i => String(i.id) !== String(editingId));
        delete monthlyPlan[editingId]; 
        addLog(item.name, `ลบสินค้าออกจากระบบ`, "-");
        saveData();
        closeModal();
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
        if (isNaN(addedNum) || addedNum <= 0) return alert("กรุณากรอกตัวเลขให้ถูกต้อง");
        
        item.qty = currentQty + addedNum; 
        addLog(item.name, `เติมเข้า (+${addedNum})`, item.source);
    } else {
        if (currentQty + change < 0) return alert("สต็อกไม่เพียงพอสำหรับการหักออก!");
        item.qty = currentQty + change;
        addLog(item.name, `ขาย/จ่ายออก (${change})`, "หน้าร้าน");
    }
    
    saveData();
}

// ----------------------------------------------------
// 2. ระบบสินค้ารายเดือน (Monthly Restock) 
// ----------------------------------------------------
function openMonthlyConfigModal() {
    const modal = document.getElementById('monthlyConfigModal');
    if (!modal) return;
    renderMonthlyConfig();
    modal.classList.remove('hidden');
}

function closeMonthlyConfigModal() {
    document.getElementById('monthlyConfigModal').classList.add('hidden');
}

function renderMonthlyConfig() {
    const list = document.getElementById('monthlyConfigList');
    const dataList = document.getElementById('inventoryList');
    if (!list || !dataList) return;

    // 1. นำรายชื่อสินค้าทั้งหมดมาใส่ใน Datalist เพื่อช่วยพิมพ์ (Auto-suggest)
    dataList.innerHTML = inventory.map(i => `<option value="${i.name}">`).join('');

    // 2. แสดงรายการสินค้าที่ *อยู่ในแผนแล้ว*
    let plannedIds = Object.keys(monthlyPlan);
    if (plannedIds.length === 0) {
        list.innerHTML = `<div class="text-center py-6 text-gray-400 text-xs">ยังไม่มีสินค้าในแผน<br>พิมพ์ชื่อสินค้าด้านบนแล้วกด "เพิ่ม"</div>`;
    } else {
        let html = '';
        plannedIds.forEach(id => {
            const item = inventory.find(i => String(i.id) === String(id));
            if (item) {
                const qty = monthlyPlan[id];
                html += `
                    <div class="flex justify-between items-center bg-white p-3 rounded-xl shadow-sm border border-gray-100">
                        <div class="flex-1 pr-2 truncate">
                            <div class="font-bold text-gray-700 text-sm truncate">${item.name}</div>
                        </div>
                        <div class="flex items-center gap-1">
                            <button onclick="updateMonthlyQty(${id}, -1)" class="w-8 h-8 flex justify-center items-center rounded-lg bg-gray-50 border text-gray-500 hover:text-red-500">-</button>
                            <span class="w-8 text-center font-bold text-sm text-primary">${qty}</span>
                            <button onclick="updateMonthlyQty(${id}, 1)" class="w-8 h-8 flex justify-center items-center rounded-lg bg-gray-50 border text-gray-500 hover:text-green-500">+</button>
                            <button onclick="removeMonthlyPlan(${id})" class="w-8 h-8 flex justify-center items-center rounded-lg bg-red-50 text-red-500 hover:bg-red-100 ml-2 transition"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                `;
            } else {
                delete monthlyPlan[id]; 
            }
        });
        list.innerHTML = html;
    }
}

// ฟังก์ชันเพิ่มสินค้าลงแผนรายเดือน (อัปเดตใหม่ ให้สร้างอัตโนมัติถ้าไม่มีในระบบ)
function addToMonthlyPlan() {
    const nameInput = document.getElementById('monthlyItemName');
    const qtyInput = document.getElementById('monthlyItemQty');
    const name = nameInput.value.trim();
    const qty = parseInt(qtyInput.value);

    if (!name) return alert("กรุณาพิมพ์ชื่อสินค้าที่ต้องการเพิ่ม");
    if (isNaN(qty) || qty <= 0) return alert("กรุณาระบุจำนวน (มากกว่า 0)");

    // ค้นหาว่ามีสินค้านี้ในระบบสต็อกหรือยัง (ตรวจแบบไม่สนใจตัวพิมพ์เล็ก/ใหญ่)
    let existingItem = inventory.find(i => i.name.toLowerCase() === name.toLowerCase());
    let targetId;

    if (existingItem) {
        targetId = existingItem.id;
    } else {
        // ถ้าไม่มีในระบบสต็อก สร้างใหม่ให้เลย!
        const newItem = { 
            id: Date.now(), 
            name: name, 
            group: "อื่น ๆ", // ให้ค่าเริ่มต้นเป็นหมวด อื่นๆ
            price: 0, 
            qty: 0, 
            min: 5, 
            source: "เพิ่มจากแผนรายเดือน" 
        };
        inventory.push(newItem);
        addLog(name, `สร้างใหม่อัตโนมัติจากแผนรายเดือน`, "-");
        targetId = newItem.id;
    }

    // เพิ่มเข้ารายเดือน (ถ้ามีอยู่แล้วให้บวกทบ, ถ้าไม่มีให้เซ็ตค่าใหม่)
    if (monthlyPlan[targetId]) {
        monthlyPlan[targetId] += qty;
    } else {
        monthlyPlan[targetId] = qty;
    }

    saveData(); 
    nameInput.value = ''; 
    qtyInput.value = ''; 
    renderMonthlyConfig(); // รีเฟรชรายการ
    
    // แจ้งเตือนเพื่อให้รู้ว่าระบบสร้างให้ใหม่นะ (กรณีพิมพ์ชื่อแปลกๆ)
    if (!existingItem) {
        alert(`สร้างสินค้า "${name}" เข้าระบบและลงแผนรายเดือนสำเร็จ!\n(คุณสามารถไปแก้ไข หมวดหมู่/ราคา ได้ในหน้า "รายการสินค้า" ภายหลัง)`);
    }
}

function updateMonthlyQty(id, change) {
    if (monthlyPlan[id]) {
        let newQty = monthlyPlan[id] + change;
        if (newQty <= 0) {
            removeMonthlyPlan(id);
        } else {
            monthlyPlan[id] = newQty;
            saveData();
            renderMonthlyConfig();
        }
    }
}

function removeMonthlyPlan(id) {
    if (confirm("ต้องการลบสินค้านี้ออกจากแผนรายเดือนใช่หรือไม่?")) {
        delete monthlyPlan[id];
        saveData();
        renderMonthlyConfig();
    }
}

function openMonthlyExecuteModal() {
    const list = document.getElementById('monthlyExecuteList');
    if (!list) return;

    let hasPlan = false;
    let html = '';

    inventory.forEach(item => {
        const addQty = monthlyPlan[item.id];
        if (addQty && addQty > 0) {
            hasPlan = true;
            html += `
                <div class="flex justify-between items-center border-b border-gray-200 border-dashed py-2 last:border-0">
                    <span class="text-sm font-bold text-gray-700">${item.name}</span>
                    <span class="text-green-600 font-bold bg-green-100 px-2 py-1 rounded-md text-sm">+${addQty} ชิ้น</span>
                </div>
            `;
        }
    });

    if (!hasPlan) {
        html = `<div class="text-center py-6 text-gray-400 text-sm">ยังไม่ได้ตั้งค่าสินค้ารายเดือน<br>ไปที่หน้า "ตั้งค่า" เพื่อเพิ่มรายการ</div>`;
        document.getElementById('btnConfirmMonthly').classList.add('hidden');
    } else {
        document.getElementById('btnConfirmMonthly').classList.remove('hidden');
    }

    list.innerHTML = html;
    document.getElementById('monthlyExecuteModal').classList.remove('hidden');
}

function closeMonthlyExecuteModal() {
    document.getElementById('monthlyExecuteModal').classList.add('hidden');
}

function executeMonthlyRestock() {
    let itemsAdded = 0;
    inventory.forEach(item => {
        const addQty = monthlyPlan[item.id];
        if (addQty && addQty > 0) {
            item.qty = (parseInt(item.qty) || 0) + addQty;
            addLog(item.name, `ระบบรับรายเดือน (+${addQty})`, item.source);
            itemsAdded++;
        }
    });

    if (itemsAdded > 0) {
        saveData();
        closeMonthlyExecuteModal();
        alert(`เติมสต็อกสินค้ารายเดือนสำเร็จ (${itemsAdded} รายการ)`);
    }
}

// ----------------------------------------------------
// 3. ระบบตั้งค่า (Export & Reset)
// ----------------------------------------------------
function exportCSV() {
    if (inventory.length === 0) return alert("ไม่มีข้อมูลให้ส่งออก");

    let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; 
    csvContent += "รหัส,ชื่อสินค้า,หมวดหมู่,ราคาขาย,จำนวนคงเหลือ,จุดแจ้งเตือน,แหล่งซื้อ\n";

    inventory.forEach(item => {
        let row = `${item.id},"${item.name}","${item.group}",${item.price},${item.qty},${item.min},"${item.source}"`;
        csvContent += row + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `stock_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function resetData() {
    if (confirm("⚠️ คำเตือน: คุณต้องการลบข้อมูลสินค้าและประวัติทั้งหมดใช่หรือไม่?")) {
        let confirmText = prompt("พิมพ์คำว่า 'ยืนยัน' เพื่อทำการลบข้อมูล:");
        if (confirmText === "ยืนยัน") {
            inventory = [];
            logs = [];
            monthlyPlan = {};
            saveData();
            alert("ล้างข้อมูลระบบเรียบร้อยแล้ว");
        }
    }
}

// ----------------------------------------------------
// 4. ระบบทำงานเบื้องหลัง (Save, Log, UI Rendering)
// ----------------------------------------------------
function addLog(name, action, source) {
    const now = new Date().toLocaleString('th-TH');
    logs.unshift({ date: now, name, action, source });
    if (logs.length > 50) logs.pop();
}

function saveData() {
    localStorage.setItem('my_stock_final', JSON.stringify(inventory));
    localStorage.setItem('my_logs_final', JSON.stringify(logs));
    localStorage.setItem('my_monthly_plan', JSON.stringify(monthlyPlan)); 
    
    if (document.getElementById('productList')) renderStock();
    if (document.getElementById('categoryChart')) updateAnalytics();
}

function renderStock() {
    const list = document.getElementById('productList');
    if(!list) return;

    const search = document.getElementById('searchTerm').value.toLowerCase();
    
    let filtered = inventory.filter(i => {
        const matchSearch = i.name.toLowerCase().includes(search) || i.group.toLowerCase().includes(search);
        const matchTab = currentFilter === 'all' ? true : currentFilter === 'low' ? (i.qty <= i.min && i.qty > 0) : (i.qty === 0);
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
            <div class="flex-1 pr-2" onclick="openModal(${item.id})">
                <span class="text-[8px] font-bold px-2 py-0.5 rounded-lg bg-gray-100 text-gray-500 uppercase">${item.group}</span>
                <div class="font-bold text-gray-800 text-base leading-tight mt-1 truncate">${item.name} <i class="fas fa-edit text-gray-300 ml-1 text-xs"></i></div>
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

function updateAnalytics() {
    const totalValueElem = document.getElementById('totalValue');
    if(!totalValueElem) return;

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

// ----------------------------------------------------
// 5. ตัวควบคุม Popup และ Modal
// ----------------------------------------------------
function openModal(id = null) {
    editingId = id; 
    const deleteBtn = document.getElementById('deleteBtn');
    const modalTitle = document.getElementById('modalTitle');

    if (id) {
        const item = inventory.find(i => String(i.id) === String(id));
        document.getElementById('pName').value = item.name;
        document.getElementById('pGroup').value = item.group;
        document.getElementById('pPrice').value = item.price;
        document.getElementById('pQty').value = item.qty;
        document.getElementById('pMin').value = item.min;
        document.getElementById('pSource').value = item.source;
        
        modalTitle.innerText = "แก้ไขข้อมูลสินค้า";
        if (deleteBtn) deleteBtn.classList.remove('hidden'); 
    } else {
        document.getElementById('pName').value = '';
        document.getElementById('pPrice').value = '';
        document.getElementById('pQty').value = '0';
        document.getElementById('pMin').value = '5';
        document.getElementById('pSource').value = '';
        
        modalTitle.innerText = "เพิ่มสินค้าใหม่";
        if (deleteBtn) deleteBtn.classList.add('hidden'); 
    }
    
    document.getElementById('modal').classList.remove('hidden');
}

function closeModal() { 
    document.getElementById('modal').classList.add('hidden'); 
    editingId = null; 
}

function toggleHistory() { 
    document.getElementById('historyModal').classList.toggle('translate-x-full'); 
    renderLogs(); 
}

function setFilter(f) { 
    currentFilter = f; 
    document.querySelectorAll('header button[id^="t-"]').forEach(b => b.classList.remove('tab-active'));
    document.getElementById(`t-${f}`).classList.add('tab-active');
    renderStock(); 
}

function renderLogs() {
    const logContent = document.getElementById('logContent');
    if(!logContent) return;
    
    logContent.innerHTML = logs.map(l => `
        <div class="bg-white p-3 rounded-xl shadow-sm border-l-4 border-primary mb-2 text-xs">
            <div class="text-[8px] text-gray-400">${l.date}</div>
            <div class="font-bold text-gray-800">${l.name}</div>
            <div class="text-primary font-bold">${l.action}</div>
        </div>`).join('');
}

// โหลดข้อมูลตอนเข้าเว็บครั้งแรก
if (document.getElementById('productList')) renderStock();