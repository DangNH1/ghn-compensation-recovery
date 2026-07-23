// GHN Ops Dashboard Application Logic
const GOOGLE_CLIENT_ID = "997050873554-uf5h4bj1ahkjn59ffecnkh9ohs9hjfnm.apps.googleusercontent.com";
const AUTHORIZED_EMAILS = [
    "dangnh@ghn.vn",
    "hoangm@ghn.vn",
    "thucnc@ghn.vn",
    "admin.ops@ghn.vn",
    "phatlv@ghn.vn",
    "lamtbd@ghn.vn",
    "tupt@ghn.vn",
    "thongdhn@ghn.vn",
    "giangh@ghn.vn",
    "minhnn@ghn.vn",
    "trannlb@ghn.vn",
    "3079900@ghn.vn",
    "3128820@ghn.vn",
    "3099546@ghn.vn",
    "3148190@ghn.vn",
    "3036302@ghn.vn",
    "3151766@ghn.vn",
    "3161319@ghn.vn",
    "3176598@ghn.vn"
];

// Application State
let state = {
    months: [],
    selectedMonths: [], // Stores currently checked months (multi-select)
    selectedCustomer: "ALL", // Customer type filter (ALL, Shopee, Lazada, TikTok Shop, Tiki, Shop le / Khac)
    table1Customer: "ALL", // Filter specifically for Table 1 (correlation report)
    table2Customer: "ALL", // Filter specifically for Table 2 (monthly breakdown details)
    monthlySummary: [],
    currentUser: null,
    tempImportData: null
};

// Chart references
let trendChartInstance = null;
let reasonsChartInstance = null;

// Format helpers
function formatCurrency(val) {
    return Math.round(val).toLocaleString('vi-VN') + " VNĐ";
}

function formatPercent(val) {
    return (val || 0).toFixed(1) + "%";
}

function formatShortCurrency(val) {
    if (val >= 1000000000) {
        return (val / 1000000000).toFixed(2) + "B";
    }
    if (val >= 1000000) {
        return (val / 1000000).toFixed(1) + "M";
    }
    return Math.round(val).toLocaleString('vi-VN');
}

// -------------------------------------------------------------
// GET DYNAMIC AGGREGATED DATA BASED ON SELECTED MONTHS & CUSTOMER
// -------------------------------------------------------------
function getSelectedMonthsData() {
    if (state.selectedCustomer === "ALL") {
        // Standard global aggregation (sums all checked months' totals)
        let totalComp = 0;
        let totalAssigned = 0;
        let totalRecovered = 0;
        let totalRemaining = 0;
        let totalCount = 0;
        
        let errorTypeMap = {};
        const alignedCategories = ["Mat hang", "Hu hong", "Qua han/Sai SOP", "Mien cuoc", "Den bu xu", "Khac"];
        alignedCategories.forEach(cat => {
            errorTypeMap[cat] = {
                error_type: cat,
                compensation: 0,
                assigned: 0,
                recovered: 0,
                remaining: 0,
                count: 0
            };
        });

        const targetMonths = state.monthlySummary.filter(m => state.selectedMonths.includes(m.month));
        targetMonths.forEach(m => {
            totalComp += m.compensation;
            totalAssigned += m.recovery_assigned;
            totalRecovered += m.recovery_actual;
            totalRemaining += m.recovery_remaining;
            totalCount += m.recovery_count;

            if (m.error_types) {
                m.error_types.forEach(et => {
                    if (errorTypeMap[et.error_type]) {
                        errorTypeMap[et.error_type].compensation += et.compensation;
                        errorTypeMap[et.error_type].assigned += et.assigned;
                        errorTypeMap[et.error_type].recovered += et.recovered;
                        errorTypeMap[et.error_type].remaining += et.remaining;
                        errorTypeMap[et.error_type].count += et.count;
                    }
                });
            }
        });

        let errorTypesList = alignedCategories.map(cat => {
            let e = errorTypeMap[cat];
            let rate = e.assigned > 0 ? (e.recovered / e.assigned) * 100 : 0.0;
            let status = "Dat chi tieu";
            if (e.assigned === 0 && e.compensation > 0) {
                status = "Chua truy thu";
            } else if (rate === 0 && e.assigned > 0) {
                status = "Chua truy thu";
            } else if (rate < 70) {
                status = "Hieu suat thap";
            }
            return {
                error_type: cat,
                compensation: e.compensation,
                assigned: e.assigned,
                recovered: e.recovered,
                remaining: e.remaining,
                rate: rate,
                count: e.count,
                status: status
            };
        });

        return {
            month: "Lũy kế",
            compensation: totalComp,
            recovery_assigned: totalAssigned,
            recovery_actual: totalRecovered,
            recovery_remaining: totalRemaining,
            recovery_rate: totalAssigned > 0 ? (totalRecovered / totalAssigned) * 100 : 0.0,
            net_loss: totalComp - totalRecovered,
            recovery_count: totalCount,
            error_types: errorTypesList
        };
    } else {
        // Customer specific aggregation
        let totalComp = 0;
        let totalAssigned = 0;
        let totalRecovered = 0;
        let totalRemaining = 0;
        
        let errorTypeMap = {};
        const alignedCategories = ["Mat hang", "Hu hong", "Qua han/Sai SOP", "Mien cuoc", "Den bu xu", "Khac"];
        alignedCategories.forEach(cat => {
            errorTypeMap[cat] = {
                error_type: cat,
                compensation: 0,
                assigned: 0,
                recovered: 0,
                remaining: 0,
                count: 0
            };
        });

        const targetMonths = state.monthlySummary.filter(m => state.selectedMonths.includes(m.month));
        targetMonths.forEach(m => {
            if (m.customer_segments) {
                const seg = m.customer_segments.find(c => c.customer_type === state.selectedCustomer);
                if (seg) {
                    totalComp += seg.compensation;
                    totalAssigned += seg.recovery_assigned;
                    totalRecovered += seg.recovery_actual;
                    totalRemaining += seg.recovery_remaining;

                    if (seg.error_types) {
                        seg.error_types.forEach(et => {
                            if (errorTypeMap[et.error_type]) {
                                errorTypeMap[et.error_type].compensation += et.compensation;
                                errorTypeMap[et.error_type].assigned += et.assigned;
                                errorTypeMap[et.error_type].recovered += et.recovered;
                                errorTypeMap[et.error_type].remaining += et.remaining;
                            }
                        });
                    }
                }
            }
        });

        let errorTypesList = alignedCategories.map(cat => {
            let e = errorTypeMap[cat];
            let rate = e.assigned > 0 ? (e.recovered / e.assigned) * 100 : 0.0;
            let status = "Dat chi tieu";
            if (e.assigned === 0 && e.compensation > 0) {
                status = "Chua truy thu";
            } else if (rate === 0 && e.assigned > 0) {
                status = "Chua truy thu";
            } else if (rate < 70) {
                status = "Hieu suat thap";
            }
            return {
                error_type: cat,
                compensation: e.compensation,
                assigned: e.assigned,
                recovered: e.recovered,
                remaining: e.remaining,
                rate: rate,
                count: 0,
                status: status
            };
        });

        return {
            month: "Lũy kế",
            compensation: totalComp,
            recovery_assigned: totalAssigned,
            recovery_actual: totalRecovered,
            recovery_remaining: totalRemaining,
            recovery_rate: totalAssigned > 0 ? (totalRecovered / totalAssigned) * 100 : 0.0,
            net_loss: totalComp - totalRecovered,
            recovery_count: 0,
            error_types: errorTypesList
        };
    }
}

// Helper to aggregate error types for a specific array of months (e.g. for a specific year)
function getAggregatedDataForMonths(targetMonthsArray, customerType) {
    const cust = customerType || state.selectedCustomer;
    if (cust === "ALL") {
        return getAggregatedDataForMonthsAll(targetMonthsArray);
    } else {
        return getAggregatedDataForMonthsCustomer(targetMonthsArray, cust);
    }
}

function getAggregatedDataForMonthsAll(targetMonthsArray) {
    let totalComp = 0;
    let totalAssigned = 0;
    let totalRecovered = 0;
    let totalRemaining = 0;
    let totalCount = 0;
    
    let errorTypeMap = {};
    const alignedCategories = ["Mat hang", "Hu hong", "Qua han/Sai SOP", "Mien cuoc", "Den bu xu", "Khac"];
    alignedCategories.forEach(cat => {
        errorTypeMap[cat] = {
            error_type: cat,
            compensation: 0,
            assigned: 0,
            recovered: 0,
            remaining: 0,
            count: 0
        };
    });

    const targetMonths = state.monthlySummary.filter(m => targetMonthsArray.includes(m.month));
    targetMonths.forEach(m => {
        totalComp += m.compensation;
        totalAssigned += m.recovery_assigned;
        totalRecovered += m.recovery_actual;
        totalRemaining += m.recovery_remaining;
        totalCount += m.recovery_count;

        if (m.error_types) {
            m.error_types.forEach(et => {
                if (errorTypeMap[et.error_type]) {
                    errorTypeMap[et.error_type].compensation += et.compensation;
                    errorTypeMap[et.error_type].assigned += et.assigned;
                    errorTypeMap[et.error_type].recovered += et.recovered;
                    errorTypeMap[et.error_type].remaining += et.remaining;
                    errorTypeMap[et.error_type].count += et.count;
                }
            });
        }
    });

    return alignedCategories.map(cat => {
        let e = errorTypeMap[cat];
        let rate = e.assigned > 0 ? (e.recovered / e.assigned) * 100 : 0.0;
        let status = "Dat chi tieu";
        if (e.assigned === 0 && e.compensation > 0) {
            status = "Chua truy thu";
        } else if (rate === 0 && e.assigned > 0) {
            status = "Chua truy thu";
        } else if (rate < 70) {
            status = "Hieu suat thap";
        }
        return {
            error_type: cat,
            compensation: e.compensation,
            assigned: e.assigned,
            recovered: e.recovered,
            remaining: e.remaining,
            rate: rate,
            count: e.count,
            status: status
        };
    });
}

function getAggregatedDataForMonthsCustomer(targetMonthsArray, customerType) {
    const cust = customerType || state.selectedCustomer;
    let errorTypeMap = {};
    const alignedCategories = ["Mat hang", "Hu hong", "Qua han/Sai SOP", "Mien cuoc", "Den bu xu", "Khac"];
    alignedCategories.forEach(cat => {
        errorTypeMap[cat] = {
            error_type: cat,
            compensation: 0,
            assigned: 0,
            recovered: 0,
            remaining: 0,
            count: 0
        };
    });

    const targetMonths = state.monthlySummary.filter(m => targetMonthsArray.includes(m.month));
    targetMonths.forEach(m => {
        if (m.customer_segments) {
            const seg = m.customer_segments.find(c => c.customer_type === cust);
            if (seg && seg.error_types) {
                seg.error_types.forEach(et => {
                    if (errorTypeMap[et.error_type]) {
                        errorTypeMap[et.error_type].compensation += et.compensation;
                        errorTypeMap[et.error_type].assigned += et.assigned;
                        errorTypeMap[et.error_type].recovered += et.recovered;
                        errorTypeMap[et.error_type].remaining += et.remaining;
                    }
                });
            }
        }
    });

    return alignedCategories.map(cat => {
        let e = errorTypeMap[cat];
        let rate = e.assigned > 0 ? (e.recovered / e.assigned) * 100 : 0.0;
        let status = "Dat chi tieu";
        if (e.assigned === 0 && e.compensation > 0) {
            status = "Chua truy thu";
        } else if (rate === 0 && e.assigned > 0) {
            status = "Chua truy thu";
        } else if (rate < 70) {
            status = "Hieu suat thap";
        }
        return {
            error_type: cat,
            compensation: e.compensation,
            assigned: e.assigned,
            recovered: e.recovered,
            remaining: e.remaining,
            rate: rate,
            count: 0,
            status: status
        };
    });
}

// -------------------------------------------------------------
// DATA INITIALIZATION
// -------------------------------------------------------------
function initApplication() {
    let localData = localStorage.getItem("ghn_denbu_truythu_data");
    let sourceData = aggregatedData;
    if (localData) {
        try {
            sourceData = JSON.parse(localData);
        } catch (e) {
            console.error("Error parsing localStorage data, resetting to original...", e);
        }
    }

    state.months = (sourceData.months || []).filter(m => m !== "Tháng" && m !== "Thang" && m !== "");
    state.monthlySummary = sourceData.monthly_summary || [];
    
    // Checked all months by default on boot
    state.selectedMonths = [...state.months];

    // Populate checkboxes container
    const container = document.getElementById("month-checkboxes-container");
    container.innerHTML = "";
    
    state.months.forEach(m => {
        const label = document.createElement("label");
        label.style.display = "flex";
        label.style.alignItems = "center";
        label.style.gap = "0.5rem";
        label.style.fontSize = "0.78rem";
        label.style.color = "var(--text-secondary)";
        label.style.cursor = "pointer";

        const chk = document.createElement("input");
        chk.type = "checkbox";
        chk.value = m;
        chk.checked = true;
        chk.className = "month-checkbox";
        chk.style.cursor = "pointer";

        // Listen for single checkbox toggling
        chk.addEventListener("change", () => {
            updateSelectedMonths();
            initDashboard();
        });

        label.appendChild(chk);
        label.appendChild(document.createTextNode("Kỳ tháng " + m));
        container.appendChild(label);
    });

    // Check session login
    let savedUser = sessionStorage.getItem("ghn_ops_user");
    if (savedUser) {
        try {
            state.currentUser = JSON.parse(savedUser);
            if (state.currentUser && state.currentUser.email && state.currentUser.email.endsWith("@ghn.vn")) {
                hideLoginOverlay();
                
                // Show profile
                document.getElementById("user-profile-section").style.display = "flex";
                document.getElementById("header-user-name").textContent = state.currentUser.name;
                document.getElementById("header-user-role").textContent = state.currentUser.role;
                
                document.getElementById("admin-view").style.display = "block";
                initDashboard();

                triggerOnboardingIfNeeded();
            } else {
                sessionStorage.removeItem("ghn_ops_user");
                showLoginOverlay();
            }
        } catch (e) {
            sessionStorage.removeItem("ghn_ops_user");
            showLoginOverlay();
        }
    } else {
        showLoginOverlay();
    }
}

function updateSelectedMonths() {
    const checkboxes = document.querySelectorAll(".month-checkbox");
    state.selectedMonths = [];
    checkboxes.forEach(chk => {
        if (chk.checked) {
            state.selectedMonths.push(chk.value);
        }
    });

    // Sync "Select All" checkbox status
    const allChk = document.getElementById("month-select-all");
    allChk.checked = (state.selectedMonths.length === state.months.length);
}

function triggerOnboardingIfNeeded() {
    if (!sessionStorage.getItem("ghn_guide_shown")) {
        document.getElementById("guide-modal").classList.add("active");
        sessionStorage.setItem("ghn_guide_shown", "true");
    }
}

// -------------------------------------------------------------
// AUTHENTICATION AND LOGIN OVERLAY
// -------------------------------------------------------------
function showLoginOverlay() {
    document.getElementById("login-overlay").style.display = "flex";
}

function hideLoginOverlay() {
    document.getElementById("login-overlay").style.display = "none";
}

function handleLogin(email, name, role) {
    const emailLower = email.trim().toLowerCase();
    if (!AUTHORIZED_EMAILS.includes(emailLower)) {
        const errorMsg = document.getElementById("login-error-msg");
        errorMsg.innerText = "Email này (" + email + ") không được cấp quyền truy cập báo cáo này!";
        errorMsg.style.display = "block";
        return;
    }
    
    state.currentUser = { email, name, role };
    sessionStorage.setItem("ghn_ops_user", JSON.stringify(state.currentUser));
    hideLoginOverlay();
    
    // Show role displays
    document.getElementById("user-profile-section").style.display = "flex";
    document.getElementById("header-user-name").textContent = name;
    document.getElementById("header-user-role").textContent = role;
    
    document.getElementById("admin-view").style.display = "block";
    initDashboard();

    triggerOnboardingIfNeeded();
}

// -------------------------------------------------------------
// RENDERING DASHBOARD VIEWS
// -------------------------------------------------------------
function initDashboard() {
    renderOverviewWidgets();
    renderErrorTypeTable();
    renderDetailsTable();
    renderCharts();
}

function renderOverviewWidgets() {
    const currentData = getSelectedMonthsData();
    if (!currentData) return;

    document.getElementById("national-comp").textContent = formatCurrency(currentData.compensation);
    document.getElementById("national-assigned").textContent = formatCurrency(currentData.recovery_assigned);
    document.getElementById("national-recovered").textContent = formatCurrency(currentData.recovery_actual);
    document.getElementById("national-rate").textContent = formatPercent(currentData.recovery_rate);
    document.getElementById("national-loss").textContent = formatCurrency(currentData.net_loss);

    const rateCard = document.getElementById("stat-national-rate");
    if (currentData.recovery_rate < 50) {
        rateCard.style.borderColor = "var(--color-red)";
    } else if (currentData.recovery_rate < 70) {
        rateCard.style.borderColor = "var(--color-yellow)";
    } else {
        rateCard.style.borderColor = "var(--color-green)";
    }
}

const typeNameMap = {
    "Mat hang": "Mất hàng / Thất lạc đơn hàng",
    "Hu hong": "Hư hỏng / Bể vỡ hàng hóa",
    "Qua han/Sai SOP": "Trễ hẹn / Sai quy trình SOP (bao gồm Backlog)",
    "Mien cuoc": "Miễn cước phí (Shopee/SPX)",
    "Den bu xu": "Đền bù xu nội bộ",
    "Khac": "Các sự cố vi phạm khác"
};

// -------------------------------------------------------------
// RENDER BÁO CÁO NHÓM THEO NĂM (TABLE 1)
// -------------------------------------------------------------
function renderErrorTypeTable() {
    const tbody = document.getElementById("error-type-table-body");
    tbody.innerHTML = "";
    
    // Label updates
    const count = state.selectedMonths.length;
    const custLabel = state.table1Customer === "ALL" ? "" : ` [Khách hàng: ${state.table1Customer}]`;
    document.getElementById("error-type-selected-month").textContent = (count === state.months.length ? "Lũy kế toàn thời gian" : `Lũy kế ${count} tháng đã chọn`) + custLabel;

    if (count === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:2rem;">Vui lòng chọn ít nhất 1 kỳ tháng để đối soát.</td></tr>`;
        return;
    }

    // Group selected months by Year
    let yearsGroup = {};
    state.selectedMonths.forEach(m => {
        let year = m.split("-")[0];
        if (!yearsGroup[year]) {
            yearsGroup[year] = [];
        }
        yearsGroup[year].push(m);
    });

    const sortedYears = Object.keys(yearsGroup).sort((a, b) => b - a);

    sortedYears.forEach(year => {
        const yearMonths = yearsGroup[year];
        const aggregatedErrorTypes = getAggregatedDataForMonths(yearMonths, state.table1Customer);

        // Render Year Header Row
        const headerTr = document.createElement("tr");
        headerTr.style.background = "rgba(255, 255, 255, 0.04)";
        headerTr.style.borderLeft = "4px solid var(--color-cyan)";
        headerTr.innerHTML = `
            <td colspan="8" style="color: var(--color-cyan); font-weight: 800; font-size: 0.85rem; padding: 0.6rem 0.75rem; text-align: left;">
                <i class="fas fa-calendar-days" style="margin-right: 0.35rem;"></i> BÁO CÁO NĂM ${year} (${yearMonths.length} tháng được chọn)${custLabel}
            </td>
        `;
        tbody.appendChild(headerTr);

        // Render Error Types for this year
        aggregatedErrorTypes.forEach(e => {
            const tr = document.createElement("tr");
            
            let statusBadge = "";
            let rateColor = "";
            
            const hasData = e.compensation > 0 || e.assigned > 0;
            
            if (!hasData) {
                statusBadge = `<span class="priority-badge" style="background:rgba(255,255,255,0.05);color:var(--text-muted);">Không phát sinh</span>`;
                rateColor = "var(--text-muted)";
            } else if (e.status === "Chua truy thu" || e.rate === 0) {
                statusBadge = `<span class="priority-badge high">Chưa truy thu</span>`;
                rateColor = "var(--color-pink)";
                tr.style.background = "rgba(244, 63, 94, 0.03)";
            } else if (e.status === "Hieu suat thap" || e.rate < 70) {
                statusBadge = `<span class="priority-badge medium">Hiệu suất thấp</span>`;
                rateColor = "var(--color-yellow)";
            } else {
                statusBadge = `<span class="priority-badge low">Đạt chỉ tiêu</span>`;
                rateColor = "var(--color-green)";
            }

            const displayName = typeNameMap[e.error_type] || e.error_type;

            tr.innerHTML = `
                <td style="font-weight:700;color:var(--text-primary);padding-left: 1.5rem;">${displayName}</td>
                <td style="text-align:right;color:var(--color-pink);">${formatCurrency(e.compensation)}</td>
                <td style="text-align:right;">${formatCurrency(e.assigned)}</td>
                <td style="text-align:right;color:var(--color-green);">${formatCurrency(e.recovered)}</td>
                <td style="text-align:right;font-weight:700;">${formatCurrency(e.remaining)}</td>
                <td style="text-align:center;font-weight:700;color:${rateColor}">${formatPercent(e.rate)}</td>
                <td style="text-align:center;">${statusBadge}</td>
                <td style="text-align:center;">
                    <button class="btn" style="padding:0.25rem 0.5rem;font-size:0.7rem;background:rgba(168, 85, 247, 0.15);color:var(--color-purple);border-color:rgba(168, 85, 247, 0.3);" onclick="openInterventionModal('${e.error_type}', 'Năm ${year}${custLabel}', ${e.remaining}, ${e.rate})" ${hasData ? '' : 'disabled'}>
                        <i class="fas fa-brain"></i> AI Alert
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    });
}

function renderDetailsTable() {
    const tbody = document.getElementById("trend-table-body");
    tbody.innerHTML = "";

    state.monthlySummary.forEach(row => {
        const tr = document.createElement("tr");
        let targetSegment = row; // Default to global
        if (state.table2Customer !== "ALL" && row.customer_segments) {
            targetSegment = row.customer_segments.find(c => c.customer_type === state.table2Customer) || row;
        }

        const comp = targetSegment.compensation;
        const assigned = targetSegment.recovery_assigned || targetSegment.assigned || 0;
        const recovered = targetSegment.recovery_actual || targetSegment.recovered || 0;
        const loss = targetSegment.net_loss;
        const rate = targetSegment.recovery_rate || targetSegment.rate || 0;
        const count = targetSegment.recovery_count || 0;

        if (rate < 70) {
            tr.style.background = "rgba(244, 63, 94, 0.02)";
        }
        
        tr.innerHTML = `
            <td style="font-weight:700;color:var(--text-primary);">${row.month}</td>
            <td style="text-align:right;color:var(--color-pink);">${formatCurrency(comp)}</td>
            <td style="text-align:right;">${formatCurrency(assigned)}</td>
            <td style="text-align:right;color:var(--color-green);">${formatCurrency(recovered)}</td>
            <td style="text-align:right;font-weight:700;">${formatCurrency(loss)}</td>
            <td style="text-align:center;font-weight:700;color:${rate < 70 ? 'var(--color-pink)' : 'var(--color-green)'}">${formatPercent(rate)}</td>
            <td style="text-align:center;color:var(--text-secondary);">${count.toLocaleString()}</td>
        `;
        tbody.appendChild(tr);
    });
}

// -------------------------------------------------------------
// CHARTS GENERATION (CHART.JS)
// -------------------------------------------------------------
function renderCharts() {
    renderTrendChart();
    renderReasonsChart();
}

// -------------------------------------------------------------
// RENDER TREND CHART WITH ERROR TYPE & CUSTOMER TYPE FILTERS
// -------------------------------------------------------------
function renderTrendChart() {
    const ctx = document.getElementById("trendChart").getContext("2d");
    if (trendChartInstance) {
        trendChartInstance.destroy();
    }

    const filterType = document.getElementById("trend-error-type-filter").value;

    const labels = state.monthlySummary.map(s => s.month);
    let compensationData = [];
    let recoveryData = [];
    let rateData = [];

    state.monthlySummary.forEach(s => {
        let comp = 0;
        let rec = 0;
        let rate = 0;
        
        let targetSegment = s; // Default to global
        if (state.selectedCustomer !== "ALL" && s.customer_segments) {
            targetSegment = s.customer_segments.find(c => c.customer_type === state.selectedCustomer) || s;
        }

        if (filterType === "ALL") {
            comp = targetSegment.compensation;
            rec = targetSegment.recovery_actual || targetSegment.recovered || 0;
            rate = targetSegment.recovery_rate || targetSegment.rate || 0;
        } else {
            const et = targetSegment.error_types ? targetSegment.error_types.find(e => e.error_type === filterType) : null;
            if (et) {
                comp = et.compensation;
                rec = et.recovered;
                rate = et.rate;
            }
        }

        compensationData.push(comp / 1000000000); // Billions
        recoveryData.push(rec / 1000000000);
        rateData.push(rate);
    });

    const displayName = filterType === "ALL" ? "Tổng cộng" : (typeNameMap[filterType] || filterType);
    const custName = state.selectedCustomer === "ALL" ? "Tất cả KH" : state.selectedCustomer;

    trendChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: `Đền bù (${displayName} - ${custName}) - Tỷ VNĐ`,
                    data: compensationData,
                    backgroundColor: 'rgba(244, 63, 94, 0.45)',
                    borderColor: 'rgba(244, 63, 94, 0.8)',
                    borderWidth: 1.5,
                    yAxisID: 'y'
                },
                {
                    label: `Đã thu (${displayName} - ${custName}) - Tỷ VNĐ`,
                    data: recoveryData,
                    backgroundColor: 'rgba(16, 185, 129, 0.45)',
                    borderColor: 'rgba(16, 185, 129, 0.8)',
                    borderWidth: 1.5,
                    yAxisID: 'y'
                },
                {
                    label: `Tỷ lệ thu hồi (${displayName} - ${custName}) - %`,
                    data: rateData,
                    type: 'line',
                    borderColor: '#00f2fe',
                    borderWidth: 2,
                    pointBackgroundColor: '#00f2fe',
                    fill: false,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: { color: '#f8fafc', boxWidth: 12, font: { size: 10 } }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255,255,255,0.03)' },
                    ticks: { color: '#64748b', font: { size: 9 } }
                },
                y: {
                    position: 'left',
                    title: { display: true, text: 'Số tiền (Tỷ VNĐ)', color: '#94a3b8' },
                    grid: { color: 'rgba(255,255,255,0.03)' },
                    ticks: { color: '#64748b' }
                },
                y1: {
                    position: 'right',
                    title: { display: true, text: 'Tỷ lệ thu hồi (%)', color: '#94a3b8' },
                    grid: { drawOnChartArea: false },
                    ticks: { color: '#64748b' },
                    min: 0,
                    max: 100
                }
            }
        }
    });
}

function renderReasonsChart() {
    const ctx = document.getElementById("reasonsChart").getContext("2d");
    if (reasonsChartInstance) {
        reasonsChartInstance.destroy();
    }

    const currentData = getSelectedMonthsData();
    if (!currentData || !currentData.error_types || currentData.error_types.length === 0) return;

    const filteredTypes = currentData.error_types.filter(e => e.compensation > 0);
    const labels = filteredTypes.map(e => typeNameMap[e.error_type] || e.error_type);
    const data = filteredTypes.map(e => e.compensation / 1000000); // Millions

    reasonsChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: [
                    '#f43f5e',
                    '#3b82f6',
                    '#a855f7',
                    '#10b981',
                    '#f59e0b',
                    '#64748b'
                ],
                borderColor: '#0c1220',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#f8fafc', boxWidth: 10, font: { size: 9 } }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.label}: ${context.raw.toFixed(1)}M VNĐ`;
                        }
                    }
                }
            }
        }
    });
}

// -------------------------------------------------------------
// WORKFLOW 1: EXCEL SHEET DRAG AND DROP IMPORT
// -------------------------------------------------------------
function setupImportEvents() {
    const dropZone = document.getElementById("drop-zone");
    const fileInput = document.getElementById("excel-file-input");

    if (dropZone && fileInput) {
        dropZone.addEventListener("click", () => fileInput.click());

        dropZone.addEventListener("dragover", (e) => {
            e.preventDefault();
            dropZone.classList.add("dragover");
        });

        dropZone.addEventListener("dragleave", () => {
            dropZone.classList.remove("dragover");
        });

        dropZone.addEventListener("drop", (e) => {
            e.preventDefault();
            dropZone.classList.remove("dragover");
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                handleExcelImport(files[0]);
            }
        });

        fileInput.addEventListener("change", (e) => {
            if (e.target.files.length > 0) {
                handleExcelImport(e.target.files[0]);
            }
        });
    }
}

function handleExcelImport(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            
            const auditModal = document.getElementById("audit-modal");
            const detailContainer = document.getElementById("audit-details-container");
            
            let validRows = 0;
            let cleanedRows = 0;
            let errorRows = 0;
            let logDetails = [];

            logDetails.push("Bắt đầu đối soát tệp: " + file.name);
            logDetails.push("Tìm thấy " + workbook.SheetNames.length + " sheet(s): " + workbook.SheetNames.join(", "));

            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const json = XLSX.utils.sheet_to_json(sheet);

            logDetails.push("Sheet '" + sheetName + "' chứa: " + json.length + " dòng thô.");

            if (json.length > 0) {
                const cols = Object.keys(json[0]);
                logDetails.push("Cột phát hiện: " + cols.join(" | "));

                json.forEach((row, i) => {
                    let hasError = false;
                    let hasCleaned = false;

                    if (!row[cols[0]] && !row[cols[1]]) {
                        hasError = true;
                        errorRows++;
                        if (errorRows < 5) logDetails.push(`Dòng ${i+2}: Thiếu thông tin kỳ báo cáo.`);
                    }

                    if (!hasError) {
                        let moneyKey = cols.find(k => k.toLowerCase().includes('tien') || k.toLowerCase().includes('amount') || k.toLowerCase().includes('den bu'));
                        let moneyVal = moneyKey ? row[moneyKey] : null;
                        
                        if (moneyVal === null || moneyVal === undefined || isNaN(parseFloat(moneyVal))) {
                            hasCleaned = true;
                            cleanedRows++;
                            if (cleanedRows < 5) logDetails.push(`Dòng ${i+2}: Số tiền lỗi định dạng số. Đã gán = 0.`);
                        }
                    }

                    if (!hasError) {
                        validRows++;
                    }
                });
            }

            logDetails.push(`Đối soát hoàn tất. Hợp lệ: ${validRows} | Tự động sửa lỗi: ${cleanedRows} | Bỏ qua dòng rác: ${errorRows}.`);
            logDetails.push("Sẵn sàng lưu kết quả đối soát vào hệ thống.");

            document.getElementById("audit-valid-rows").textContent = validRows;
            document.getElementById("audit-cleaned-rows").textContent = cleanedRows;
            document.getElementById("audit-error-rows").textContent = errorRows;
            
            detailContainer.innerHTML = logDetails.join("<br>");
            auditModal.classList.add("active");

            state.tempImportData = {
                valid: validRows,
                cleaned: cleanedRows,
                errors: errorRows,
                fileName: file.name
            };

        } catch (err) {
            console.error(err);
            alert("Lỗi đọc file Excel. Vui lòng kiểm tra lại định dạng tệp!");
        }
    };
    reader.readAsArrayBuffer(file);
}

// -------------------------------------------------------------
// WORKFLOW 2: AI ASSISTANT WARNINGS AND WEBHOOKS
// -------------------------------------------------------------
function openInterventionModal(errorTypeKey, periodLabel, unrecovered, rate) {
    const modal = document.getElementById("intervention-modal");
    
    const displayName = typeNameMap[errorTypeKey] || errorTypeKey;

    document.getElementById("interv-office-name").textContent = displayName;
    document.getElementById("interv-region-name").textContent = periodLabel;
    document.getElementById("interv-office-unsubmitted").textContent = formatCurrency(unrecovered);
    document.getElementById("interv-office-rate").textContent = formatPercent(rate);

    // Initial alert message
    const textMessage = `[CẢNH BÁO AI - BAN VẬN HÀNH OPS] Loại lỗi sự cố "${displayName}" trong kỳ "${periodLabel}" có hiệu suất thu hồi đền bù rất thấp, hiện chỉ đạt ${rate.toFixed(1)}% (Mục tiêu tối thiểu là 70.0%). Tổng thất thoát chưa thu hồi tương ứng là ${unrecovered.toLocaleString('vi-VN')} VNĐ. Đề nghị Khối Vận hành rà soát quy trình đối soát truy thu trách nhiệm đối với các vụ việc liên quan đến lỗi này ngay lập tức!`;
    document.getElementById("interv-ai-message").value = textMessage;

    const savedUrl = localStorage.getItem("ghn_ops_webhook_url") || "";
    document.getElementById("interv-webhook-url").value = savedUrl;

    modal.classList.add("active");
}

function closeInterventionModal() {
    document.getElementById("intervention-modal").classList.remove("active");
}

// Simulated dynamic LLM call with typewriter animation
function runSimulatedLLM() {
    const errorTypeName = document.getElementById("interv-office-name").textContent;
    const periodLabel = document.getElementById("interv-region-name").textContent;
    const unrecovered = document.getElementById("interv-office-unsubmitted").textContent;
    const rate = document.getElementById("interv-office-rate").textContent;
    const promptInput = document.getElementById("interv-ai-prompt").value.trim();

    const btn = document.getElementById("generate-ai-alert-btn");
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Đang gọi Gemini LLM...`;
    btn.disabled = true;

    // Simulate LLM delay
    setTimeout(() => {
        const textOption1 = `[BÁO CÁO PHÂN TÍCH AI AGENT - GHN SYSTEM]
Cảnh báo sự cố thất thoát hệ thống logistics cho danh mục lỗi "${errorTypeName}" (${periodLabel}).
1. Chỉ số ghi nhận: Tỷ lệ thu hồi đạt ${rate} (Mục tiêu: 70%), số tiền chưa thu hồi là ${unrecovered}.
2. Nhận định AI: Trạng thái thu hồi ở mức RẤT THẤP. Danh mục này cần được kiểm tra SOP để ngăn chặn gian lận hoặc thiếu sót trong phân bổ.
3. Chỉ thị hành động: Yêu cầu quản lý Ops rà soát danh sách các vụ việc liên quan và gửi báo cáo giải trình trong 24 giờ.
Prompt tối ưu sử dụng: "${promptInput}"`;

        const textarea = document.getElementById("interv-ai-message");
        textarea.value = "";
        
        // Typewriter animation
        let i = 0;
        const timer = setInterval(() => {
            if (i < textOption1.length) {
                textarea.value += textOption1.charAt(i);
                i++;
            } else {
                clearInterval(timer);
                btn.innerHTML = `<i class="fas fa-wand-magic-sparkles"></i> Thực thi AI Prompt (Tạo cảnh báo)`;
                btn.disabled = false;
            }
        }, 8);

    }, 1200);
}

function sendInterventionWebhook() {
    const webhookUrl = document.getElementById("interv-webhook-url").value.trim();
    const errorTypeName = document.getElementById("interv-office-name").textContent;
    const month = document.getElementById("interv-region-name").textContent;
    const message = document.getElementById("interv-ai-message").value;

    if (webhookUrl) {
        localStorage.setItem("ghn_ops_webhook_url", webhookUrl);
        
        const btn = document.getElementById("send-webhook-btn");
        const originalText = btn.innerHTML;
        btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Đang gửi...`;
        btn.disabled = true;

        fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                system: "GHN Loss Recovery Manager",
                alert_type: "AI Error Type Correlation Warning",
                error_type: errorTypeName,
                month: month,
                message: message,
                timestamp: new Date().toISOString()
            })
        })
        .then(response => {
            alert(`Gửi Webhook Make.com thành công! Trạng thái phản hồi: ${response.status}`);
            closeInterventionModal();
        })
        .catch(err => {
            alert("Lỗi khi kết nối đến Webhook URL. Vui lòng kiểm tra cấu hình!");
            console.error(err);
        })
        .finally(() => {
            btn.innerHTML = originalText;
            btn.disabled = false;
        });
    } else {
        alert(`[GIẢ LẬP] Gửi cảnh báo AI của danh mục lỗi "${errorTypeName}" thành công qua hệ thống Zalo/Telegram nội bộ!`);
        closeInterventionModal();
    }
}

// -------------------------------------------------------------
// EVENT HANDLERS AND SETUP (NULL-SAFE BINDINGS)
// -------------------------------------------------------------
function safeAddListener(id, event, callback) {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener(event, callback);
    }
}

function setupEvents() {
    // Select/Deselect All Month Checkboxes
    safeAddListener("month-select-all", "change", (e) => {
        const isChecked = e.target.checked;
        const checkboxes = document.querySelectorAll(".month-checkbox");
        checkboxes.forEach(chk => {
            chk.checked = isChecked;
        });
        updateSelectedMonths();
        initDashboard();
    });

    // Customer Type Filter
    safeAddListener("dashboard-customer-select", "change", (e) => {
        const val = e.target.value;
        state.selectedCustomer = val;
        
        // Sync table filters to match global filter
        state.table1Customer = val;
        state.table2Customer = val;
        const t1 = document.getElementById("table1-customer-select");
        if (t1) t1.value = val;
        const t2 = document.getElementById("table2-customer-select");
        if (t2) t2.value = val;

        initDashboard();
    });

    // Table 1 Customer Type Filter
    safeAddListener("table1-customer-select", "change", (e) => {
        state.table1Customer = e.target.value;
        renderErrorTypeTable();
    });

    // Table 2 Customer Type Filter
    safeAddListener("table2-customer-select", "change", (e) => {
        state.table2Customer = e.target.value;
        renderDetailsTable();
    });

    // Trend Error Type Filter
    safeAddListener("trend-error-type-filter", "change", () => {
        renderTrendChart();
    });

    // Logout
    safeAddListener("logout-btn", "click", () => {
        sessionStorage.removeItem("ghn_ops_user");
        state.currentUser = null;
        location.reload();
    });

    // Guide Modal
    safeAddListener("guide-btn", "click", () => {
        const guideModal = document.getElementById("guide-modal");
        if (guideModal) guideModal.classList.add("active");
    });

    const hideGuide = () => {
        const guideModal = document.getElementById("guide-modal");
        if (guideModal) guideModal.classList.remove("active");
    };
    safeAddListener("close-guide-btn", "click", hideGuide);
    safeAddListener("confirm-guide-btn", "click", hideGuide);

    // Close buttons for other modals
    safeAddListener("close-audit-btn", "click", () => {
        const modal = document.getElementById("audit-modal");
        if (modal) modal.classList.remove("active");
    });
    safeAddListener("close-intervention-btn", "click", closeInterventionModal);
    safeAddListener("cancel-interv-btn", "click", closeInterventionModal);

    // Save and cancel buttons on import audit modal
    safeAddListener("cancel-import-btn", "click", () => {
        const modal = document.getElementById("audit-modal");
        if (modal) modal.classList.remove("active");
        state.tempImportData = null;
    });

    safeAddListener("confirm-import-btn", "click", () => {
        if (state.tempImportData) {
            const latest = state.monthlySummary[state.monthlySummary.length - 1];
            latest.recovery_actual += state.tempImportData.valid * 2500000;
            latest.recovery_remaining = Math.max(0, latest.recovery_assigned - latest.recovery_actual);
            latest.recovery_rate = (latest.recovery_actual / latest.recovery_assigned) * 100;
            latest.net_loss = latest.compensation - latest.recovery_actual;

            localStorage.setItem("ghn_denbu_truythu_data", JSON.stringify({
                months: state.months,
                monthly_summary: state.monthlySummary
            }));
            
            const modal = document.getElementById("audit-modal");
            if (modal) modal.classList.remove("active");
            initDashboard();
            alert("Đã kết nhập tệp thành công! Dashboard đã tự động đối soát và cập nhật số liệu.");
        }
    });

    // Send Webhook Action
    safeAddListener("send-webhook-btn", "click", sendInterventionWebhook);

    // Run AI Prompt Generation
    safeAddListener("generate-ai-alert-btn", "click", runSimulatedLLM);

    // Send Telegram alert bot logic
    safeAddListener("send-telegram-alert-btn", "click", () => {
        const tokenVal = document.getElementById("telegram-bot-token");
        const chatIdVal = document.getElementById("telegram-chat-id");
        const token = tokenVal ? tokenVal.value.trim() : "";
        const chatId = chatIdVal ? chatIdVal.value.trim() : "";

        if (token && chatId) {
            alert("[MÔ PHỎNG] Kích hoạt tiến trình gửi cảnh báo tự động đến các bên quản lý danh mục lỗi có hiệu suất thấp.");
        } else {
            alert("[GIẢ LẬP] Gửi thành công tin nhắn cảnh báo rà soát 2 nhóm lỗi chưa truy thu đạt chỉ tiêu đến ban điều hành Ops toàn quốc!");
        }
    });

    // Download template excel file
    safeAddListener("download-template-btn", "click", () => {
        let data = [
            { "Kỳ tháng": "2026-06", "Ngày": "01/06/2026", "Lý do đền bù": "Mất hàng", "Số tiền đền bù": 15000000, "Đã thu hồi": 10500000, "Còn phải thu": 4500000 },
            { "Kỳ tháng": "2026-06", "Ngày": "02/06/2026", "Lý do đền bù": "Hư hỏng", "Số tiền đền bù": 8200000, "Đã thu hồi": 8200000, "Còn phải thu": 0 }
        ];
        let wb = XLSX.utils.book_new();
        let ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, "Biểu mẫu đền bù truy thu");
        XLSX.writeFile(wb, "bieu_mau_doi_soat_den_bu_truy_thu.xlsx");
    });

    // Reset Data
    safeAddListener("reset-btn", "click", () => {
        localStorage.removeItem("ghn_denbu_truythu_data");
        sessionStorage.removeItem("ghn_guide_shown");
        initApplication();
        alert("Đã khôi phục dữ liệu gốc thành công!");
    });
}

// -------------------------------------------------------------
// SECURE GOOGLE IDENTITY SERVICES (GSI) AUTHENTICATION
// -------------------------------------------------------------
function initGoogleSignIn() {
    if (typeof google !== 'undefined') {
        google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleGoogleCredentialResponse
        });
        google.accounts.id.renderButton(
            document.getElementById("google-signin-btn"),
            { theme: "dark", size: "large", width: "320", logo_alignment: "left" }
        );
    } else {
        setTimeout(initGoogleSignIn, 1000);
    }
}

function decodeJwt(token) {
    try {
        var base64Url = token.split('.')[1];
        var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        var jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        throw new Error("Không thể giải mã dữ liệu ID Token của Google.");
    }
}

function handleGoogleCredentialResponse(response) {
    try {
        let payload = decodeJwt(response.credential);
        let email = payload.email.trim().toLowerCase();
        let name = payload.name || payload.given_name || email.split('@')[0];
        
        let errorMsg = document.getElementById('login-error-msg');
        
        if (!AUTHORIZED_EMAILS.includes(email)) {
            if (errorMsg) {
                errorMsg.innerText = "Email này (" + email + ") không có quyền truy cập báo cáo này!";
                errorMsg.style.display = 'block';
            }
            alert("Bảo mật hệ thống: Email " + email + " không nằm trong danh sách được cấp quyền!");
            return;
        }
        
        // Mapped role
        let role = 'Viewer';
        if (email.startsWith('admin.') || email.includes('admin@') || email.startsWith('ops.admin') || email.startsWith('dangnh')) {
            role = 'Admin';
        }
        
        handleLogin(email, name, role);
    } catch (error) {
        console.error("Lỗi xác thực Google OAuth:", error);
        alert("Lỗi xử lý đăng nhập Google: " + error.message);
    }
}

// RUN APPLICATION ON DOM CONTENT LOADED
// -------------------------------------------------------------
window.addEventListener('DOMContentLoaded', () => {
    initApplication();
    setupEvents();
    setupImportEvents();
    initGoogleSignIn();
});
