// 数据存储
let salesData = JSON.parse(localStorage.getItem('salesData')) || [];
let customerData = JSON.parse(localStorage.getItem('customerData')) || {};
let authorizedSalespeople = JSON.parse(localStorage.getItem('authorizedSalespeople')) || {};
let adminPassword = localStorage.getItem('adminPassword') || 'admin123';
let isAdminLoggedIn = false;

// 页面初始化
document.addEventListener('DOMContentLoaded', function() {
    // 绑定表单事件
    document.getElementById('salesForm').addEventListener('submit', handleSalesSubmit);
    document.getElementById('adminLoginForm').addEventListener('submit', handleAdminLogin);
    document.getElementById('addSalespersonForm').addEventListener('submit', handleAddSalesperson);
    document.getElementById('changePasswordForm').addEventListener('submit', handleChangePassword);
    document.getElementById('changeSalespersonPasswordForm').addEventListener('submit', handleChangeSalespersonPassword);
    
    // 绑定客户管理表单事件
    document.getElementById('rechargeForm').addEventListener('submit', handleRechargeSubmit);
    
    // 初始化显示
    calculateWeeklySales();
    showAllRecords();
    updateAuthorizedSalespeopleList();
    updateSalespersonSelect();
    updateIndividualSalespersonSelect();
    updateRechargeSalespersonSelect();
    
    // 添加回车键支持
    
    document.getElementById('salespersonQuery').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') querySalespersonPerformance();
    });
    
    document.getElementById('customerSpendingQuery').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') queryCustomerSpending();
    });
    
    document.getElementById('recordFilter').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') filterRecords();
    });
    

});

// 页面切换功能
function showSection(sectionName) {
    // 隐藏所有section
    const sections = document.querySelectorAll('.section');
    sections.forEach(section => section.classList.remove('active'));
    
    // 移除所有nav按钮的active类
    const navBtns = document.querySelectorAll('.nav-btn');
    navBtns.forEach(btn => btn.classList.remove('active'));
    
    // 显示目标section
    document.getElementById(sectionName).classList.add('active');
    
    // 激活对应的nav按钮
    event.target.classList.add('active');
    
    // 刷新数据显示
    if (sectionName === 'records') {
        showAllRecords();
    }
}

// 将文件转换为base64格式
function convertFileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// 销售登记处理
async function handleSalesSubmit(e) {
    e.preventDefault();
    
    const salesperson = document.getElementById('salesperson').value.trim();
    const salespersonPassword = document.getElementById('salespersonPassword').value;
    const customer = document.getElementById('customer').value.trim();
    const licensePlate = document.getElementById('licensePlate').value.trim();
    const product = document.getElementById('product').value.trim();
    const amount = parseFloat(document.getElementById('price').value);
    const paymentType = document.getElementById('paymentType').value;
    const imageFiles = document.getElementById('salesImage').files;
    
    // 基本数据验证
    if (!salesperson || !customer || !licensePlate || !product || isNaN(amount) || amount <= 0) {
        showMessage('error', '请填写完整的销售信息，金额必须大于0！');
        return;
    }
    
    // 检查销售员权限和密码
    if (Object.keys(authorizedSalespeople).length === 0) {
        showMessage('error', '系统尚未设置任何授权销售员，请联系管理员添加授权销售员！');
        return;
    }
    
    if (!authorizedSalespeople[salesperson]) {
        showMessage('error', `销售员 ${salesperson} 未获得授权，无法进行销售登记！请联系管理员添加授权销售员。`);
        return;
    }
    
    if (authorizedSalespeople[salesperson] !== salespersonPassword) {
        showMessage('error', '销售密码错误，无法进行销售登记！');
        return;
    }
    
    const totalAmount = amount;
    

    // 检查余额支付
    if (paymentType === 'balance') {
        // 获取客户数据（统一使用customers存储格式）
        let customers = JSON.parse(localStorage.getItem('customers')) || [];
        // 确保customers是数组类型
        if (!Array.isArray(customers)) {
            customers = [];
        }
        let customerObj = customers.find(c => c.name === customer);
        
        // 如果客户不存在，自动创建
        if (!customerObj) {
            customerObj = {
                id: Date.now().toString(),
                name: customer,
                phone: '',
                address: '',
                balance: 0,
                createTime: new Date().toLocaleString(),
                transactions: []
            };
            customers.push(customerObj);
        }
        
        const customerBalance = customerObj.balance || 0;
        if (customerBalance < totalAmount) {
            showMessage('error', `客户 ${customer} 余额不足！当前余额：¥${customerBalance.toFixed(2)}，需要：¥${totalAmount.toFixed(2)}`);
            return;
        }
        
        // 扣除余额
        customerObj.balance -= totalAmount;
        customerObj.transactions.push({
            type: 'consumption',
            amount: totalAmount,
            time: new Date().toLocaleString(),
            description: `购买${product}`
        });
        
        // 保存客户数据
        localStorage.setItem('customers', JSON.stringify(customers));
        
        // 同步更新旧格式的customerData以保持兼容性
        customerData[customer] = {
            balance: customerObj.balance,
            createTime: customerObj.createTime
        };
    }
    
    // 处理图片文件
    const images = [];
    if (imageFiles && imageFiles.length > 0) {
        for (let i = 0; i < imageFiles.length; i++) {
            const file = imageFiles[i];
            if (file.size > 5 * 1024 * 1024) { // 限制单个文件5MB
                showMessage('error', `图片 ${file.name} 大小超过5MB，请选择较小的图片`);
                return;
            }
        }
        
        // 转换图片为base64
        for (let i = 0; i < imageFiles.length; i++) {
            const file = imageFiles[i];
            try {
                const base64 = await convertFileToBase64(file);
                images.push({
                    name: file.name,
                    data: base64,
                    size: file.size,
                    type: file.type
                });
            } catch (error) {
                showMessage('error', `图片 ${file.name} 处理失败`);
                return;
            }
        }
    }
    
    // 创建销售记录
    const saleRecord = {
        id: Date.now(),
        timestamp: new Date().toLocaleString('zh-CN'),
        salesperson: salesperson,
        customer: customer,
        licensePlate: licensePlate,
        product: product,
        totalAmount: totalAmount,
        paymentType: paymentType === 'cash' ? '现金' : '余额支付',
        images: images
    };
    
    // 保存数据
    salesData.push(saleRecord);
    saveData();
    
    // 显示成功消息
    showMessage('success', `销售登记成功！销售金额：¥${totalAmount.toFixed(2)}`);
    
    // 重置表单
    document.getElementById('salesForm').reset();
    
    // 刷新统计
    calculateWeeklySales();
}





function calculateWeeklySales() {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // 本周开始（周日）
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // 本周结束（周六）
    endOfWeek.setHours(23, 59, 59, 999);
    
    const weeklyTotal = salesData
        .filter(record => {
            const recordDate = new Date(record.timestamp);
            // 计算现金支付和充值，排除余额支付
            return recordDate >= startOfWeek && recordDate <= endOfWeek && (record.paymentType === '现金' || record.paymentType === '充值');
        })
        .reduce((sum, record) => sum + record.totalAmount, 0);
    
    document.getElementById('weeklySales').textContent = `¥${weeklyTotal.toFixed(2)}`;
}

function clearWeeklySales() {
    if (confirm('确定要清零本周销售额度显示吗？（不会删除实际销售记录）')) {
        // 只清零显示，不删除实际数据
        document.getElementById('weeklySales').textContent = '¥0.00';
        
        showMessage('success', '本周销售额度已清零！');
    }
}

// 查询销售员业绩
function querySalespersonPerformance() {
    const salesperson = document.getElementById('salespersonQuery').value.trim();
    const resultDiv = document.getElementById('salespersonResult');
    
    if (!salesperson) {
        resultDiv.innerHTML = '<div class="error-message">请输入销售员姓名</div>';
        return;
    }
    
    const salesByPerson = salesData.filter(sale => sale.salesperson === salesperson);
    const totalAmount = salesByPerson.reduce((sum, sale) => sum + sale.totalAmount, 0);
    const totalCount = salesByPerson.length;
    
    if (totalCount === 0) {
        resultDiv.innerHTML = `<div class="error-message">未找到销售员 ${salesperson} 的销售记录</div>`;
        return;
    }
    
    resultDiv.innerHTML = `
        <h4>销售员：${salesperson}</h4>
        <p><strong>销售总额：</strong>¥${totalAmount.toFixed(2)}</p>
        <p><strong>销售笔数：</strong>${totalCount} 笔</p>
        <p><strong>平均单价：</strong>¥${(totalAmount / totalCount).toFixed(2)}</p>
    `;
}

// 查询客户消费
function queryCustomerSpending() {
    const customer = document.getElementById('customerSpendingQuery').value.trim();
    const resultDiv = document.getElementById('customerSpendingResult');
    
    if (!customer) {
        resultDiv.innerHTML = '<div class="error-message">请输入客户姓名</div>';
        return;
    }
    
    const customerSales = salesData.filter(sale => sale.customer === customer);
    // 只计算现金支付和充值记录，排除余额支付
    const consumptionSales = customerSales.filter(sale => sale.paymentType === '现金' || sale.paymentType === '充值');
    const totalSpent = consumptionSales.reduce((sum, sale) => sum + sale.totalAmount, 0);
    
    // 从新格式的customers数组中获取当前余额
    let customers = JSON.parse(localStorage.getItem('customers')) || [];
    if (!Array.isArray(customers)) {
        customers = [];
    }
    const customerObj = customers.find(c => c.name === customer);
    const currentBalance = customerObj ? customerObj.balance : (customerData[customer] || 0);
    
    if (consumptionSales.length === 0) {
        resultDiv.innerHTML = `
            <h4>客户：${customer}</h4>
            <p><strong>累计消费：</strong>¥0.00</p>
            <p><strong>当前余额：</strong>¥${currentBalance.toFixed(2)}</p>
            <p class="error-message">暂无消费记录</p>
        `;
        return;
    }
    
    // 获取消费购买的商品列表
    const products = consumptionSales.map(sale => sale.product).join('、');
    
    // 按支付方式分类统计
    const cashSales = consumptionSales.filter(sale => sale.paymentType === '现金');
    const rechargeSales = consumptionSales.filter(sale => sale.paymentType === '充值');
    const cashAmount = cashSales.reduce((sum, sale) => sum + sale.totalAmount, 0);
    const rechargeAmount = rechargeSales.reduce((sum, sale) => sum + sale.totalAmount, 0);
    
    resultDiv.innerHTML = `
        <h4>客户：${customer}</h4>
        <p><strong>累计消费：</strong>¥${totalSpent.toFixed(2)}</p>
        <p><strong>消费笔数：</strong>${consumptionSales.length} 笔</p>
        <p><strong>现金支付：</strong>¥${cashAmount.toFixed(2)} (${cashSales.length}笔)</p>
        <p><strong>充值金额：</strong>¥${rechargeAmount.toFixed(2)} (${rechargeSales.length}笔)</p>
        <p><strong>当前余额：</strong>¥${currentBalance.toFixed(2)}</p>
        <p><strong>相关记录：</strong>${products}</p>
    `;
}

// 查询销售员销售额度（按日期）
function querySalespersonSalesByDate() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const resultDiv = document.getElementById('salespersonSalesResult');
    
    if (!startDate || !endDate) {
        resultDiv.innerHTML = '<div class="error-message">请选择开始日期和结束日期</div>';
        return;
    }
    
    if (new Date(startDate) > new Date(endDate)) {
        resultDiv.innerHTML = '<div class="error-message">开始日期不能晚于结束日期</div>';
        return;
    }
    
    // 筛选指定日期范围内的销售记录
    const filteredSales = salesData.filter(sale => {
        const saleDate = new Date(sale.timestamp.split(' ')[0]); // 提取日期部分
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999); // 设置为当天结束时间
        
        return saleDate >= start && saleDate <= end;
    });
    
    if (filteredSales.length === 0) {
        resultDiv.innerHTML = '<div class="error-message">该时间段内暂无销售记录</div>';
        return;
    }
    
    // 按销售员统计销售额度
    const salesBySalesperson = {};
    filteredSales.forEach(sale => {
        if (!salesBySalesperson[sale.salesperson]) {
            salesBySalesperson[sale.salesperson] = {
                totalAmount: 0,
                count: 0,
                sales: []
            };
        }
        salesBySalesperson[sale.salesperson].totalAmount += sale.totalAmount;
        salesBySalesperson[sale.salesperson].count += 1;
        salesBySalesperson[sale.salesperson].sales.push(sale);
    });
    
    // 生成结果HTML
    let resultHtml = `<h4>销售员销售额度统计（${startDate} 至 ${endDate}）</h4>`;
    
    // 按销售额度排序
    const sortedSalespeople = Object.entries(salesBySalesperson)
        .sort(([,a], [,b]) => b.totalAmount - a.totalAmount);
    
    sortedSalespeople.forEach(([salesperson, data]) => {
        const avgAmount = data.totalAmount / data.count;
        resultHtml += `
            <div class="salesperson-stats">
                <h5>销售员：${salesperson}</h5>
                <p><strong>销售总额：</strong>¥${data.totalAmount.toFixed(2)}</p>
                <p><strong>销售笔数：</strong>${data.count} 笔</p>
                <p><strong>平均单价：</strong>¥${avgAmount.toFixed(2)}</p>
            </div>
        `;
    });
    
    // 添加总计信息
    const totalAmount = Object.values(salesBySalesperson).reduce((sum, data) => sum + data.totalAmount, 0);
    const totalCount = Object.values(salesBySalesperson).reduce((sum, data) => sum + data.count, 0);
    
    resultHtml += `
        <div class="total-stats">
            <h5>总计</h5>
            <p><strong>总销售额：</strong>¥${totalAmount.toFixed(2)}</p>
            <p><strong>总销售笔数：</strong>${totalCount} 笔</p>
            <p><strong>参与销售员数：</strong>${Object.keys(salesBySalesperson).length} 人</p>
        </div>
    `;
    
    resultDiv.innerHTML = resultHtml;
}

// 查询个别销售员销售额度
function queryIndividualSalespersonSales() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const salesperson = document.getElementById('individualSalesperson').value;
    const resultDiv = document.getElementById('salespersonSalesResult');
    
    if (!startDate || !endDate) {
        resultDiv.innerHTML = '<div class="error-message">请选择开始日期和结束日期</div>';
        return;
    }
    
    if (!salesperson) {
        resultDiv.innerHTML = '<div class="error-message">请输入销售员姓名</div>';
        return;
    }
    
    if (new Date(startDate) > new Date(endDate)) {
        resultDiv.innerHTML = '<div class="error-message">开始日期不能晚于结束日期</div>';
        return;
    }
    
    // 筛选指定销售员在指定日期范围内的销售记录
    const filteredSales = salesData.filter(sale => {
        const saleDate = new Date(sale.timestamp.split(' ')[0]); // 提取日期部分
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999); // 设置为当天结束时间
        
        return saleDate >= start && saleDate <= end && sale.salesperson === salesperson;
    });
    
    if (filteredSales.length === 0) {
        resultDiv.innerHTML = `<div class="error-message">销售员"${salesperson}"在该时间段内暂无销售记录</div>`;
        return;
    }
    
    // 统计销售数据
    const totalAmount = filteredSales.reduce((sum, sale) => sum + sale.totalAmount, 0);
    const avgAmount = totalAmount / filteredSales.length;
    
    // 生成结果HTML
    let resultHtml = `<h4>销售员"${salesperson}"销售额度统计（${startDate} 至 ${endDate}）</h4>`;
    
    resultHtml += `
        <div class="salesperson-stats">
            <h5>销售员：${salesperson}</h5>
            <p><strong>销售总额：</strong>¥${totalAmount.toFixed(2)}</p>
            <p><strong>销售笔数：</strong>${filteredSales.length} 笔</p>
            <p><strong>平均单价：</strong>¥${avgAmount.toFixed(2)}</p>
        </div>
    `;
    
    // 添加详细销售记录
    resultHtml += '<div class="sales-details"><h6>详细销售记录：</h6>';
    filteredSales.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).forEach(sale => {
        let imagesHtml = '';
        if (sale.images && sale.images.length > 0) {
            imagesHtml = `
                <div class="record-images">
                    <strong>相关图片：</strong>
                    <div class="image-gallery">
                        ${sale.images.map((image, index) => `
                            <div class="image-item">
                                <img src="${image.data}" alt="${image.name}" onclick="showImageModal('${image.data}', '${image.name}')">
                                <span class="image-name">${image.name}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        
        resultHtml += `
            <div class="record-item">
                <div class="record-header">
                    <span class="record-time">${sale.timestamp}</span>
                    <span class="record-amount">¥${sale.totalAmount.toFixed(2)}</span>
                </div>
                <div class="record-details">
                    <strong>客户：</strong>${sale.customer} | 
                    <strong>车牌号：</strong>${sale.licensePlate || '未填写'} | 
                    <strong>商品：</strong>${sale.product} | 
                    <strong>付款方式：</strong>${sale.paymentType}
                </div>
                ${imagesHtml}
            </div>
        `;
    });
    resultHtml += '</div>';
    
    resultDiv.innerHTML = resultHtml;
}

// 计算客户总消费
function calculateCustomerTotalSpending(customer) {
    return salesData
        .filter(sale => sale.customer === customer)
        .reduce((sum, sale) => sum + sale.totalAmount, 0);
}

// 显示所有销售记录
function showAllRecords() {
    const recordsList = document.getElementById('recordsList');
    
    if (salesData.length === 0) {
        recordsList.innerHTML = '<div class="error-message">暂无销售记录</div>';
        return;
    }
    
    const recordsHtml = salesData
        .sort((a, b) => b.id - a.id) // 按时间倒序
        .map(record => {
            let imagesHtml = '';
            if (record.images && record.images.length > 0) {
                imagesHtml = `
                    <div class="record-images">
                        <strong>相关图片：</strong>
                        <div class="image-gallery">
                            ${record.images.map((image, index) => `
                                <div class="image-item">
                                    <img src="${image.data}" alt="${image.name}" onclick="showImageModal('${image.data}', '${image.name}')">
                                    <span class="image-name">${image.name}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }
            
            return `
                <div class="record-item">
                    <div class="record-header">
                        <span class="record-time">${record.timestamp}</span>
                        <span class="record-amount">¥${record.totalAmount.toFixed(2)}</span>
                    </div>
                    <div class="record-details">
                        <strong>销售员：</strong>${record.salesperson} | 
                        <strong>客户：</strong>${record.customer} | 
                        <strong>车牌号：</strong>${record.licensePlate || '未填写'} | 
                        <strong>商品：</strong>${record.product} | 
                        <strong>付款方式：</strong>${record.paymentType}
                    </div>
                    ${imagesHtml}
                    <div class="record-actions">
                        <button onclick="editRecord(${record.id})" class="btn-edit">编辑</button>
                        <button onclick="deleteRecord(${record.id})" class="btn-delete">删除</button>
                    </div>
                </div>
            `;
        }).join('');
    
    recordsList.innerHTML = recordsHtml;
}

// 显示图片模态框
function showImageModal(imageSrc, imageName) {
    const modal = document.getElementById('imageModal');
    const modalImg = document.getElementById('modalImage');
    const caption = document.getElementById('imageCaption');
    
    modal.style.display = 'block';
    modalImg.src = imageSrc;
    caption.textContent = imageName;
}

// 关闭图片模态框
function closeImageModal() {
    const modal = document.getElementById('imageModal');
    modal.style.display = 'none';
}

// 筛选销售记录
function filterRecords() {
    const filter = document.getElementById('recordFilter').value.trim().toLowerCase();
    const recordsList = document.getElementById('recordsList');
    
    if (!filter) {
        showAllRecords();
        return;
    }
    
    const filteredRecords = salesData.filter(record => 
        record.salesperson.toLowerCase().includes(filter) ||
        record.customer.toLowerCase().includes(filter) ||
        record.product.toLowerCase().includes(filter) ||
        (record.licensePlate && record.licensePlate.toLowerCase().includes(filter))
    );
    
    if (filteredRecords.length === 0) {
        recordsList.innerHTML = '<div class="error-message">未找到匹配的记录</div>';
        return;
    }
    
    const recordsHtml = filteredRecords
        .sort((a, b) => b.id - a.id)
        .map(record => {
            let imagesHtml = '';
            if (record.images && record.images.length > 0) {
                imagesHtml = `
                    <div class="record-images">
                        <strong>相关图片：</strong>
                        <div class="image-gallery">
                            ${record.images.map((image, index) => `
                                <div class="image-item">
                                    <img src="${image.data}" alt="${image.name}" onclick="showImageModal('${image.data}', '${image.name}')">
                                    <span class="image-name">${image.name}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }
            
            return `
                <div class="record-item">
                    <div class="record-header">
                        <span class="record-time">${record.timestamp}</span>
                        <span class="record-amount">¥${record.totalAmount.toFixed(2)}</span>
                    </div>
                    <div class="record-details">
                        <strong>销售员：</strong>${record.salesperson} | 
                        <strong>客户：</strong>${record.customer} | 
                        <strong>车牌号：</strong>${record.licensePlate || '未填写'} | 
                        <strong>商品：</strong>${record.product} | 
                        <strong>付款方式：</strong>${record.paymentType}
                    </div>
                    ${imagesHtml}
                </div>
            `;
        }).join('');
    
    recordsList.innerHTML = recordsHtml;
}

// 显示消息
function showMessage(type, message) {
    // 移除现有消息
    const existingMessage = document.querySelector('.success-message, .error-message');
    if (existingMessage) {
        existingMessage.remove();
    }
    
    // 创建新消息
    const messageDiv = document.createElement('div');
    messageDiv.className = type === 'success' ? 'success-message' : 'error-message';
    messageDiv.textContent = message;
    
    // 插入到当前活动的section中
    const activeSection = document.querySelector('.section.active');
    activeSection.insertBefore(messageDiv, activeSection.firstChild.nextSibling);
    
    // 3秒后自动移除
    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.remove();
        }
    }, 3000);
}



// 保存数据到localStorage
function saveData() {
    localStorage.setItem('salesData', JSON.stringify(salesData));
    localStorage.setItem('customerData', JSON.stringify(customerData));
}

// 管理员登录处理
function handleAdminLogin(e) {
    e.preventDefault();
    const password = document.getElementById('adminPassword').value;
    
    if (password === adminPassword) {
        isAdminLoggedIn = true;
        document.getElementById('adminLogin').style.display = 'none';
        document.getElementById('adminPanel').style.display = 'block';
        showMessage('success', '管理员登录成功');
        document.getElementById('adminPassword').value = '';
    } else {
        showMessage('error', '密码错误');
    }
}

// 添加授权销售员
function handleAddSalesperson(e) {
    e.preventDefault();
    const salesperson = document.getElementById('newSalesperson').value.trim();
    const password = document.getElementById('newSalespersonPassword').value;
    
    if (!salesperson) {
        showMessage('error', '请输入销售员姓名');
        return;
    }
    
    if (!password) {
        showMessage('error', '请设置销售密码');
        return;
    }
    
    if (password.length < 4) {
        showMessage('error', '销售密码长度至少4位');
        return;
    }
    
    if (authorizedSalespeople[salesperson]) {
        showMessage('error', '该销售员已存在');
        return;
    }
    
    authorizedSalespeople[salesperson] = password;
    localStorage.setItem('authorizedSalespeople', JSON.stringify(authorizedSalespeople));
    updateAuthorizedSalespeopleList();
    updateSalespersonSelect();
    updateIndividualSalespersonSelect();
    updateRechargeSalespersonSelect();
    showMessage('success', `销售员 ${salesperson} 已添加到授权列表`);
    document.getElementById('newSalesperson').value = '';
    document.getElementById('newSalespersonPassword').value = '';
}

// 删除授权销售员
function removeSalesperson(salesperson) {
    if (confirm(`确定要删除销售员 ${salesperson} 的授权吗？`)) {
        delete authorizedSalespeople[salesperson];
        localStorage.setItem('authorizedSalespeople', JSON.stringify(authorizedSalespeople));
        updateAuthorizedSalespeopleList();
        updateSalespersonSelect();
        updateIndividualSalespersonSelect();
        updateRechargeSalespersonSelect();
        showMessage('success', `销售员 ${salesperson} 已从授权列表中删除`);
    }
}

// 更新授权销售员列表显示
function updateAuthorizedSalespeopleList() {
    const listElement = document.getElementById('authorizedSalespeople');
    const salespeople = Object.keys(authorizedSalespeople);
    
    if (salespeople.length === 0) {
        listElement.innerHTML = '<p>暂无授权销售员，请先添加授权销售员才能进行销售登记</p>';
    } else {
        listElement.innerHTML = salespeople.map(salesperson => 
            `<div class="salesperson-item">
                <span>${salesperson}</span>
                <button onclick="removeSalesperson('${salesperson}')" class="remove-btn">删除</button>
            </div>`
        ).join('');
    }
    
    // 同时更新销售员选择框
    updateSalespersonSelect();
}

// 更新销售员选择框
function updateSalespersonSelect() {
    const selectElement = document.getElementById('salesperson');
    const salespeople = Object.keys(authorizedSalespeople);
    
    // 清空现有选项
    selectElement.innerHTML = '<option value="">请选择销售员</option>';
    
    // 添加授权销售员选项
    salespeople.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        selectElement.appendChild(option);
    });
}

// 更新个别销售员选择框
function updateIndividualSalespersonSelect() {
    const selectElement = document.getElementById('individualSalesperson');
    const salespeople = Object.keys(authorizedSalespeople);
    
    // 清空现有选项
    selectElement.innerHTML = '<option value="">请选择销售员</option>';
    
    // 添加授权销售员选项
    salespeople.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        selectElement.appendChild(option);
    });
}

// 修改管理员密码
function handleChangePassword(e) {
    e.preventDefault();
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    if (currentPassword !== adminPassword) {
        showMessage('error', '当前密码错误');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showMessage('error', '新密码确认不一致');
        return;
    }
    
    if (newPassword.length < 6) {
        showMessage('error', '新密码长度至少6位');
        return;
    }
    
    adminPassword = newPassword;
    localStorage.setItem('adminPassword', adminPassword);
    showMessage('success', '密码修改成功');
    document.getElementById('changePasswordForm').reset();
}

// 修改销售员密码
function handleChangeSalespersonPassword(e) {
    e.preventDefault();
    const salesperson = document.getElementById('targetSalesperson').value.trim();
    const newPassword = document.getElementById('newSalesPassword').value;
    
    if (!salesperson) {
        showMessage('error', '请输入销售员姓名');
        return;
    }
    
    if (!authorizedSalespeople[salesperson]) {
        showMessage('error', '该销售员不存在');
        return;
    }
    
    if (!newPassword) {
        showMessage('error', '请输入新密码');
        return;
    }
    
    if (newPassword.length < 4) {
        showMessage('error', '新密码长度至少4位');
        return;
    }
    
    authorizedSalespeople[salesperson] = newPassword;
    localStorage.setItem('authorizedSalespeople', JSON.stringify(authorizedSalespeople));
    showMessage('success', `销售员 ${salesperson} 的密码已修改成功`);
    document.getElementById('changeSalespersonPasswordForm').reset();
}

// 管理员标签切换
function showAdminSection(sectionName) {
    // 隐藏所有管理员区域
    document.querySelectorAll('.admin-section').forEach(section => {
        section.classList.remove('active');
    });
    
    // 移除所有标签按钮的激活状态
    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // 显示选中的区域
    document.getElementById(sectionName).classList.add('active');
    
    // 激活选中的标签按钮
    event.target.classList.add('active');
}

// 管理员退出登录
function adminLogout() {
    isAdminLoggedIn = false;
    document.getElementById('adminLogin').style.display = 'block';
    document.getElementById('adminPanel').style.display = 'none';
    showMessage('success', '已退出管理员模式');
}

// 导出数据功能（可选）
function exportData() {
    const data = {
        salesData: salesData,
        customerData: customerData,
        authorizedSalespeople: authorizedSalespeople,
        exportTime: new Date().toLocaleString('zh-CN')
    };
    
    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `销售数据_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    showMessage('success', '数据导出成功');
}

// 清空所有数据（谨慎使用）
function clearAllData() {
    if (confirm('确定要清空所有数据吗？此操作不可恢复！')) {
        salesData = [];
        customerData = {};
        authorizedSalespeople = {};
        adminPassword = 'admin123';
        localStorage.clear();
        saveData();
        
        // 刷新显示
        showAllRecords();
        updateAuthorizedSalespeopleList();
        
        // 清空查询结果
        document.getElementById('balanceResult').innerHTML = '';
        document.getElementById('salespersonResult').innerHTML = '';
        document.getElementById('customerSpendingResult').innerHTML = '';
        
        showMessage('success', '所有数据已清空');
        adminLogout();
    }
}

// ==================== 客户管理功能 ====================





// 更新充值表单中的销售员选择项
function updateRechargeSalespersonSelect() {
    const select = document.getElementById('rechargeSalesperson');
    select.innerHTML = '<option value="">请选择销售员</option>';
    
    Object.keys(authorizedSalespeople).forEach(salesperson => {
        const option = document.createElement('option');
        option.value = salesperson;
        option.textContent = salesperson;
        select.appendChild(option);
    });
}

// 处理客户充值提交
function handleRechargeSubmit(e) {
    e.preventDefault();
    
    const salesperson = document.getElementById('rechargeSalesperson').value.trim();
    const password = document.getElementById('rechargePassword').value;
    const customer = document.getElementById('rechargeCustomer').value.trim();
    const amount = parseFloat(document.getElementById('rechargeAmount').value);
    
    // 验证输入
    if (!salesperson || !password || !customer || !amount || amount <= 0) {
        showMessage('error', '请填写完整的充值信息');
        return;
    }
    
    // 验证销售员权限
    if (!authorizedSalespeople[salesperson] || authorizedSalespeople[salesperson] !== password) {
        showMessage('error', '销售员或密码错误');
        return;
    }
    
    // 获取并更新新格式的客户数据
    let customers = JSON.parse(localStorage.getItem('customers')) || [];
    if (!Array.isArray(customers)) {
        customers = [];
    }
    
    let customerObj = customers.find(c => c.name === customer);
    
    // 如果客户不存在，创建新客户
    if (!customerObj) {
        customerObj = {
            id: Date.now().toString(),
            name: customer,
            phone: '',
            address: '',
            balance: 0,
            createTime: new Date().toLocaleString(),
            transactions: []
        };
        customers.push(customerObj);
    }
    
    // 更新客户余额
    customerObj.balance += amount;
    customerObj.transactions.push({
        type: 'recharge',
        amount: amount,
        time: new Date().toLocaleString(),
        description: '充值'
    });
    
    // 保存新格式的客户数据
    localStorage.setItem('customers', JSON.stringify(customers));
    
    // 同时更新旧格式的customerData以保持兼容性
    if (!customerData[customer]) {
        customerData[customer] = 0;
    }
    customerData[customer] += amount;
    
    // 创建充值记录
    const rechargeRecord = {
        id: Date.now(),
        timestamp: new Date().toLocaleString(),
        salesperson: salesperson,
        customer: customer,
        product: '充值',
        licensePlate: '',
        amount: amount,
        paymentType: '充值',
        totalAmount: amount
    };
    
    // 保存充值记录到销售数据
    salesData.push(rechargeRecord);
    
    // 保存数据
    saveData();
    
    // 显示成功消息
    showMessage('success', `客户 ${customer} 充值成功！充值金额：¥${amount.toFixed(2)}，当前余额：¥${customerObj.balance.toFixed(2)}`);
    
    // 重置表单
    document.getElementById('rechargeForm').reset();
    
}

// 记录管理功能
let currentEditingRecordId = null;

// 显示所有记录用于编辑
function showAllRecordsForEdit() {
    const recordsList = document.getElementById('editableRecordsList');
    
    // 调试信息
    console.log('showAllRecordsForEdit called');
    console.log('salesData length:', salesData.length);
    console.log('isAdminLoggedIn:', isAdminLoggedIn);
    
    if (salesData.length === 0) {
        recordsList.innerHTML = '<p class="no-records">暂无销售记录。请先添加一些销售记录，然后再来管理。</p>';
        return;
    }
    
    let html = '<div class="records-table">';
    html += '<div class="table-header">';
    html += '<div class="col-time">时间</div>';
    html += '<div class="col-amount">金额</div>';
    html += '<div class="col-customer">客户</div>';
    html += '<div class="col-salesperson">销售员</div>';
    html += '<div class="col-product">产品</div>';
    html += '<div class="col-actions">操作</div>';
    html += '</div>';
    
    salesData.forEach(record => {
        html += '<div class="table-row">';
        html += `<div class="col-time">${record.timestamp}</div>`;
        html += `<div class="col-amount">¥${(record.totalAmount || record.amount).toFixed(2)}</div>`;
        html += `<div class="col-customer">${record.customer}</div>`;
        html += `<div class="col-salesperson">${record.salesperson}</div>`;
        html += `<div class="col-product">${record.product}</div>`;
        html += `<div class="col-actions">`;
        html += `<button onclick="editRecord(${record.id})" class="btn-edit">编辑</button>`;
        html += `<button onclick="deleteRecord(${record.id})" class="btn-delete">删除</button>`;
        html += `</div>`;
        html += '</div>';
    });
    
    html += '</div>';
    recordsList.innerHTML = html;
}

// 搜索记录
function searchRecords() {
    const customer = document.getElementById('searchCustomer').value.trim();
    const salesperson = document.getElementById('searchSalesperson').value.trim();
    const date = document.getElementById('searchDate').value;
    
    let filteredRecords = salesData;
    
    if (customer) {
        filteredRecords = filteredRecords.filter(record => 
            record.customer.toLowerCase().includes(customer.toLowerCase())
        );
    }
    
    if (salesperson) {
        filteredRecords = filteredRecords.filter(record => 
            record.salesperson.toLowerCase().includes(salesperson.toLowerCase())
        );
    }
    
    if (date) {
        filteredRecords = filteredRecords.filter(record => {
            const recordDate = new Date(record.timestamp).toISOString().split('T')[0];
            return recordDate === date;
        });
    }
    
    displayFilteredRecords(filteredRecords);
}

// 显示过滤后的记录
function displayFilteredRecords(records) {
    const recordsList = document.getElementById('editableRecordsList');
    
    if (records.length === 0) {
        recordsList.innerHTML = '<p class="no-records">未找到匹配的记录</p>';
        return;
    }
    
    let html = '<div class="records-table">';
    html += '<div class="table-header">';
    html += '<div class="col-time">时间</div>';
    html += '<div class="col-amount">金额</div>';
    html += '<div class="col-customer">客户</div>';
    html += '<div class="col-salesperson">销售员</div>';
    html += '<div class="col-product">产品</div>';
    html += '<div class="col-actions">操作</div>';
    html += '</div>';
    
    records.forEach(record => {
        html += '<div class="table-row">';
        html += `<div class="col-time">${record.timestamp}</div>`;
        html += `<div class="col-amount">¥${(record.totalAmount || record.amount).toFixed(2)}</div>`;
        html += `<div class="col-customer">${record.customer}</div>`;
        html += `<div class="col-salesperson">${record.salesperson}</div>`;
        html += `<div class="col-product">${record.product}</div>`;
        html += `<div class="col-actions">`;
        html += `<button onclick="editRecord(${record.id})" class="btn-edit">编辑</button>`;
        html += `<button onclick="deleteRecord(${record.id})" class="btn-delete">删除</button>`;
        html += `</div>`;
        html += '</div>';
    });
    
    html += '</div>';
    recordsList.innerHTML = html;
}

// 编辑记录
function editRecord(recordId) {
    const record = salesData.find(r => r.id === recordId);
    if (!record) {
        showMessage('error', '记录不存在');
        return;
    }
    
    currentEditingRecordId = recordId;
    
    // 填充编辑表单
    document.getElementById('editAmount').value = record.totalAmount || record.amount;
    document.getElementById('editCustomer').value = record.customer;
    document.getElementById('editLicensePlate').value = record.licensePlate || '';
    document.getElementById('editProduct').value = record.product;
    document.getElementById('editPaymentType').value = record.paymentType;
    
    // 更新销售员选择框
    updateEditSalespersonSelect();
    document.getElementById('editSalesperson').value = record.salesperson;
    
    // 显示模态框
    document.getElementById('editRecordModal').style.display = 'block';
}

// 更新编辑模态框中的销售员选择框
function updateEditSalespersonSelect() {
    const select = document.getElementById('editSalesperson');
    select.innerHTML = '';
    
    Object.keys(authorizedSalespeople).forEach(salesperson => {
        const option = document.createElement('option');
        option.value = salesperson;
        option.textContent = salesperson;
        select.appendChild(option);
    });
}

// 关闭编辑模态框
function closeEditModal() {
    document.getElementById('editRecordModal').style.display = 'none';
    currentEditingRecordId = null;
}

// 删除记录
function deleteRecord(recordId) {
    if (!confirm('确定要删除这条记录吗？此操作不可撤销。')) {
        return;
    }
    
    const recordIndex = salesData.findIndex(r => r.id === recordId);
    if (recordIndex === -1) {
        showMessage('error', '记录不存在');
        return;
    }
    
    const record = salesData[recordIndex];
    
    // 如果是充值记录，需要从客户余额中扣除
    if (record.product === '充值') {
        if (customerData[record.customer]) {
            customerData[record.customer].balance -= (record.totalAmount || record.amount);
            if (customerData[record.customer].balance < 0) {
                customerData[record.customer].balance = 0;
            }
        }
    }
    
    // 删除记录
    salesData.splice(recordIndex, 1);
    
    // 保存数据
    saveData();
    
    // 刷新显示
    showAllRecordsForEdit();
    
    showMessage('success', '记录已删除');
}

// 处理编辑表单提交
document.addEventListener('DOMContentLoaded', function() {
    const editForm = document.getElementById('editRecordForm');
    if (editForm) {
        editForm.addEventListener('submit', handleEditRecordSubmit);
    }
});

function handleEditRecordSubmit(e) {
    e.preventDefault();
    
    if (!currentEditingRecordId) {
        showMessage('error', '无效的编辑操作');
        return;
    }
    
    const recordIndex = salesData.findIndex(r => r.id === currentEditingRecordId);
    if (recordIndex === -1) {
        showMessage('error', '记录不存在');
        return;
    }
    
    const originalRecord = salesData[recordIndex];
    const newAmount = parseFloat(document.getElementById('editAmount').value);
    const newCustomer = document.getElementById('editCustomer').value.trim();
    const newLicensePlate = document.getElementById('editLicensePlate').value.trim();
    const newProduct = document.getElementById('editProduct').value.trim();
    const newPaymentType = document.getElementById('editPaymentType').value;
    const newSalesperson = document.getElementById('editSalesperson').value;
    
    // 如果是充值记录且金额发生变化，需要调整客户余额
    const originalAmount = originalRecord.totalAmount || originalRecord.amount;
    if (originalRecord.product === '充值' && originalAmount !== newAmount) {
        if (customerData[originalRecord.customer]) {
            // 先减去原来的充值金额
            customerData[originalRecord.customer].balance -= originalAmount;
            // 再加上新的充值金额
            customerData[originalRecord.customer].balance += newAmount;
            if (customerData[originalRecord.customer].balance < 0) {
                customerData[originalRecord.customer].balance = 0;
            }
        }
    }
    
    // 更新记录
    salesData[recordIndex] = {
        ...originalRecord,
        amount: newAmount,
        customer: newCustomer,
        licensePlate: newLicensePlate,
        product: newProduct,
        paymentType: newPaymentType,
        salesperson: newSalesperson,
        totalAmount: newAmount
    };
    
    // 保存数据
    saveData();
    
    // 关闭模态框
    closeEditModal();
    
    // 刷新显示
    showAllRecordsForEdit();
    
    showMessage('success', '记录已更新');
}