// Starbucks Dashboard Logic

document.addEventListener('DOMContentLoaded', () => {
    initDashboard();
});

let map;
let markerCluster;
let regionChart;
let trendChart;

function initDashboard() {
    // 1. 기초 통계 계산
    const stats = calculateStats(storesData);
    
    // 2. UI 초기화 (KPI 카드)
    updateKPICards(stats);
    
    // 3. 필터 설정
    setupFilters(stats.sidoList);
    
    // 4. 차트 초기화
    initCharts(stats);
    
    // 5. 지도 초기화
    initMap(storesData);
    
    // 6. 이벤트 리스너
    document.getElementById('sido-filter').addEventListener('change', (e) => {
        filterDashboard(e.target.value);
    });
}

function calculateStats(data) {
    const total = data.length;
    const sidoCounts = {};
    const yearCounts = {};
    let dtCount = 0;
    let reserveCount = 0;
    let seoulCount = 0;

    data.forEach(store => {
        // Sido count
        const sido = store.sido_name || '기타';
        sidoCounts[sido] = (sidoCounts[sido] || 0) + 1;
        if (sido === '서울') seoulCount++;

        // Type count
        if (store.store_type === 'DT') dtCount++;
        if (store.store_type === 'Reserve') reserveCount++;

        // Year count
        if (store.open_dt) {
            const year = String(store.open_dt).substring(0, 4);
            yearCounts[year] = (yearCounts[year] || 0) + 1;
        }
    });

    const sidoList = Object.keys(sidoCounts).sort((a, b) => sidoCounts[b] - sidoCounts[a]);
    const years = Object.keys(yearCounts).sort();

    return {
        total,
        seoulRatio: ((seoulCount / total) * 100).toFixed(1),
        dtRatio: ((dtCount / total) * 100).toFixed(1),
        reserveCount,
        newStores2026: yearCounts['2026'] || 0,
        sidoCounts,
        sidoList,
        yearCounts,
        years,
        dtCount
    };
}

function updateKPICards(stats) {
    document.getElementById('total-stores').textContent = stats.total.toLocaleString();
    document.getElementById('seoul-ratio').textContent = `${stats.seoulRatio}%`;
    document.getElementById('new-store-count').textContent = `${stats.newStores2026}개`;
    
    // DT 카드 업데이트
    const dtCardValue = document.querySelectorAll('.kpi-value')[1];
    if (dtCardValue) dtCardValue.textContent = `${stats.dtCount.toLocaleString()}개 (${stats.dtRatio}%)`;
    
    // 리저브 카드 업데이트
    const reserveCardValue = document.querySelectorAll('.kpi-value')[2];
    if (reserveCardValue) reserveCardValue.textContent = `${stats.reserveCount.toLocaleString()}개`;
}

function setupFilters(sidoList) {
    const select = document.getElementById('sido-filter');
    sidoList.forEach(sido => {
        const opt = document.createElement('option');
        opt.value = sido;
        opt.textContent = sido;
        select.appendChild(opt);
    });
}

function initCharts(stats) {
    // 1. 지역별 분포 차트 (Top 8)
    const top8Sido = stats.sidoList.slice(0, 8);
    const sidoLabels = top8Sido;
    const sidoData = top8Sido.map(s => stats.sidoCounts[s]);

    const ctxRegion = document.getElementById('region-chart').getContext('2d');
    regionChart = new Chart(ctxRegion, {
        type: 'bar',
        data: {
            labels: sidoLabels,
            datasets: [{
                label: '매장 수',
                data: sidoData,
                backgroundColor: 'rgba(45, 212, 191, 0.6)',
                borderColor: '#2dd4bf',
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { display: false }, ticks: { color: '#94a3b8' } },
                y: { grid: { display: false }, ticks: { color: '#f8fafc' } }
            }
        }
    });

    // 2. 연도별 개점 추이 차트
    const yearLabels = stats.years.filter(y => parseInt(y) >= 2010);
    const yearData = yearLabels.map(y => stats.yearCounts[y]);

    const ctxTrend = document.getElementById('trend-chart').getContext('2d');
    trendChart = new Chart(ctxTrend, {
        type: 'line',
        data: {
            labels: yearLabels,
            datasets: [{
                label: '신규 개점 수',
                data: yearData,
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 3,
                pointBackgroundColor: '#10b981'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { display: false }, ticks: { color: '#94a3b8' } },
                y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } }
            }
        }
    });
}

function initMap(data) {
    map = L.map('map', {
        zoomControl: false,
        attributionControl: false
    }).setView([36.5, 127.8], 7);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19
    }).addTo(map);

    markerCluster = L.markerClusterGroup({
        showCoverageOnHover: false,
        iconCreateFunction: function(cluster) {
            return L.divIcon({
                html: `<div><span>${cluster.getChildCount()}</span></div>`,
                className: 'marker-cluster marker-cluster-medium',
                iconSize: L.point(40, 40)
            });
        }
    });

    data.forEach(store => {
        const marker = createStoreMarker(store);
        markerCluster.addLayer(marker);
    });

    map.addLayer(markerCluster);
}

function createStoreMarker(store) {
    const marker = L.marker([store.lat, store.lot], {
        icon: L.divIcon({
            className: 'custom-div-icon',
            html: `<div class="marker-pin ${store.store_type.toLowerCase()}"></div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 30]
        })
    });

    marker.on('click', () => showStoreDetails(store));
    marker.on('mouseover', function() {
        this.bindTooltip(`${store.s_name}`, { direction: 'top', offset: [0, -30] }).openTooltip();
    });

    return marker;
}

function showStoreDetails(store) {
    const overlay = document.getElementById('details-overlay');
    const content = document.getElementById('details-content');
    
    content.innerHTML = `
        <h2 style="color: var(--primary-light); margin-bottom: 20px;">${store.s_name}</h2>
        <div class="detail-item">
            <label style="color: var(--text-dim); font-size: 0.8rem; text-transform: uppercase;">주소</label>
            <p style="margin-bottom: 12px;">${store.doro_address}</p>
        </div>
        <div class="detail-item">
            <label style="color: var(--text-dim); font-size: 0.8rem; text-transform: uppercase;">전화번호</label>
            <p style="margin-bottom: 12px;">${store.tel || '정보 없음'}</p>
        </div>
        <div class="detail-item">
            <label style="color: var(--text-dim); font-size: 0.8rem; text-transform: uppercase;">개점일</label>
            <p style="margin-bottom: 12px;">${store.open_dt || '정보 없음'}</p>
        </div>
        <div class="detail-tag" style="display: inline-block; padding: 4px 12px; background: rgba(0, 112, 74, 0.2); border-radius: 20px; font-size: 0.85rem; color: var(--primary-light);">
            ${store.store_type} 매장
        </div>
    `;
    
    overlay.style.display = 'block';
    
    document.getElementById('close-overlay').onclick = () => {
        overlay.style.display = 'none';
    };
}

function filterDashboard(sido) {
    let filteredData = storesData;
    if (sido !== 'all') {
        filteredData = storesData.filter(s => s.sido_name === sido);
    }

    // 1. 지도 업데이트
    markerCluster.clearLayers();
    filteredData.forEach(store => {
        const marker = createStoreMarker(store);
        markerCluster.addLayer(marker);
    });
    
    if (filteredData.length > 0) {
        const group = new L.featureGroup(markerCluster.getLayers());
        map.fitBounds(group.getBounds().pad(0.1));
    }

    // 2. KPI 업데이트 (비율은 전체 대비가 아닌 현재 필터 데이터 기준)
    const currentStats = calculateStats(filteredData);
    document.getElementById('map-store-count').textContent = `${sido === 'all' ? '전국' : sido} 매장 ${filteredData.length.toLocaleString()}개 표시 중`;
    
    // 3. 차트 부분 업데이트 (옵션: 필터에 따라 차트도 변경할 수 있으나 여기서는 유지)
}
