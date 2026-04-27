// Data Storage
let inventory = JSON.parse(localStorage.getItem('my_stock_final')) || [];
let logs = JSON.parse(localStorage.getItem('my_logs_final')) || [];
let currentFilter = 'all';
let myChart;
let editingId = null; // ตัวแปรสำหรับเช็คว่ากำลังกด "แก้ไข" สินค้าตัวไหนอยู่

// ----------------------------------------------------
// 1. ระบบจัดการสินค้า (เพิ่ม, แก้ไข, ลบ)
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
        // กรณี: กดแก้ไขสินค้า
        const itemIndex = inventory.findIndex(i => String(i.id) === String(editingId));
        if (itemIndex > -1) {
            inventory[itemIndex] = { id: editingId, name, group, price, qty, min, source };
            addLog(name, `แก้ไขข้อมูลสินค้า`, "-");
        }
    } else {
        // กรณี: เพิ่มสินค้าใหม่
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
// 2. ระบบตั้งค่า (Export & Reset)
// ----------------------------------------------------
function exportCSV() {
    if (inventory.length === 0) return alert("ไม่มีข้อมูลให้ส่งออก");

    let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; // \uFEFF ป้องกันภาษาไทยเพี้ยนใน Excel
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
    if (confirm("⚠️ คำเตือน: คุณต้องการลบข้อมูลสินค้าและประวัติทั้งหมดใช่หรือไม่?\nการกระทำนี้ไม่สามารถย้อนกลับได้!")) {
        let confirmText = prompt("พิมพ์คำว่า 'ยืนยัน' เพื่อทำการลบข้อมูล:");
        if (confirmText === "ยืนยัน") {
            inventory = [];
            logs = [];
            saveData();
            alert("ล้างข้อมูลระบบเรียบร้อยแล้ว");
        } else {
            alert("ยกเลิกการล้างข้อมูล (พิมพ์ไม่ถูกต้อง)");
        }
    }
}

// ----------------------------------------------------
// 3. ระบบทำงานเบื้องหลัง (Save, Log, UI Rendering)
// ----------------------------------------------------
function addLog(name, action, source) {
    const now = new Date().toLocaleString('th-TH');
    logs.unshift({ date: now, name, action, source });
    if (logs.length > 50) logs.pop();
}

function saveData() {
    localStorage.setItem('my_stock_final', JSON.stringify(inventory));
    localStorage.setItem('my_logs_final', JSON.stringify(logs));
    
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
// 4. ตัวควบคุม Popup และ Modal
// ----------------------------------------------------
function openModal(id = null) {
    editingId = id; // บันทึกว่ากำลังแก้ไข ID อะไรอยู่ (ถ้าเป็น null แปลว่าเพิ่มใหม่)
    const deleteBtn = document.getElementById('deleteBtn');
    const modalTitle = document.getElementById('modalTitle');

    if (id) {
        // ดึงข้อมูลเดิมมาโชว์ในช่อง
        const item = inventory.find(i => String(i.id) === String(id));
        document.getElementById('pName').value = item.name;
        document.getElementById('pGroup').value = item.group;
        document.getElementById('pPrice').value = item.price;
        document.getElementById('pQty').value = item.qty;
        document.getElementById('pMin').value = item.min;
        document.getElementById('pSource').value = item.source;
        
        modalTitle.innerText = "แก้ไขข้อมูลสินค้า";
        if (deleteBtn) deleteBtn.classList.remove('hidden'); // โชว์ปุ่มลบ
    } else {
        // ล้างช่องว่างสำหรับเพิ่มใหม่
        document.getElementById('pName').value = '';
        document.getElementById('pPrice').value = '';
        document.getElementById('pQty').value = '0';
        document.getElementById('pMin').value = '5';
        document.getElementById('pSource').value = '';
        
        modalTitle.innerText = "เพิ่มสินค้าใหม่";
        if (deleteBtn) deleteBtn.classList.add('hidden'); // ซ่อนปุ่มลบ
    }
    
    document.getElementById('modal').classList.remove('hidden');
}

function closeModal() { 
    document.getElementById('modal').classList.add('hidden'); 
    editingId = null; // เคลียร์สถานะ
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