(() => {
    const STORAGE_KEY = 'beeweb-export-mixed-jobs';
    const DEFAULT_RANGE_DAYS = 7;
    const POLL_INTERVAL_MS = 3500;
    const DATA_TYPE_OPTIONS = [
        { id: 1, label: 'Pictures', hint: '촬영 이미지 ZIP' },
        { id: 2, label: 'In Count', hint: '입실 카운트' },
        { id: 3, label: 'Out Count', hint: '퇴실 카운트' },
        { id: 4, label: 'Temperature', hint: '온도' },
        { id: 5, label: 'Humidity', hint: '습도' },
        { id: 6, label: 'CO₂', hint: '이산화탄소' },
        { id: 7, label: 'Weight', hint: '중량' },
    ];
    const DEFAULT_DATA_TYPES = [2, 3, 4, 5, 6, 7];

    const state = {
        areas: [],
        selectedArea: null,
        selectedHive: null,
        devices: [],
        selectedDevices: new Map(),
        jobs: [],
    };

    const polling = new Map();
    const els = {};

    document.addEventListener('DOMContentLoaded', () => {
        cacheElements();
        renderDataTypeChips();
        setDefaultTimeRange(DEFAULT_RANGE_DAYS);
        loadStoredJobs();
        attachEvents();
        fetchAreas();
        resumeJobPolling();
    });

    function cacheElements() {
        els.areaSelect = document.getElementById('areaSelect');
        els.hiveSelect = document.getElementById('hiveSelect');
        els.deviceList = document.getElementById('deviceList');
        els.selectedDevices = document.getElementById('selectedDevices');
        els.dataTypeList = document.getElementById('dataTypeList');
        els.startTime = document.getElementById('startTime');
        els.endTime = document.getElementById('endTime');
        els.presets = document.querySelectorAll('.presets button');
        els.exportBtn = document.getElementById('exportBtn');
        els.statusMessage = document.getElementById('statusMessage');
        els.jobList = document.getElementById('jobList');
    }

    function attachEvents() {
        els.areaSelect.addEventListener('change', handleAreaChange);
        els.hiveSelect.addEventListener('change', handleHiveChange);
        els.exportBtn.addEventListener('click', handleExport);
        els.presets.forEach(btn => {
            btn.addEventListener('click', () => applyPreset(btn.dataset.range));
        });
    }

    function apiUrl(path) {
        const base = (window.BASE_PATH || '/').replace(/\/$/, '');
        const normalized = path.startsWith('/') ? path : `/${path}`;
        return `${base}${normalized}`;
    }

    async function fetchAreas() {
        try {
            const res = await fetch(apiUrl('/api/areahive'));
            if (!res.ok) throw new Error(`(${res.status}) ${res.statusText}`);
            const data = await res.json();
            state.areas = Array.isArray(data) ? data : [];
            renderAreaOptions();
            if (!state.areas.length) {
                setStatus('불러온 Area가 없습니다. API 응답을 확인하세요.');
            }
        } catch (err) {
            console.error('[export] area fetch failed:', err);
            setStatus(`Area 목록을 불러오지 못했습니다: ${err.message}`);
        }
    }

    function renderAreaOptions() {
        els.areaSelect.innerHTML = '<option value="">Area 선택</option>';
        state.areas.forEach(area => {
            const option = document.createElement('option');
            option.value = area.id;
            option.textContent = area.name;
            els.areaSelect.appendChild(option);
        });
    }

    function handleAreaChange() {
        const areaId = parseInt(els.areaSelect.value, 10);
        state.selectedArea = state.areas.find(a => a.id === areaId) || null;
        state.selectedHive = null;
        state.devices = [];
        els.hiveSelect.disabled = !state.selectedArea;
        els.hiveSelect.innerHTML = '<option value="">Hive 선택</option>';
        els.deviceList.classList.add('empty');
        els.deviceList.textContent = state.selectedArea ? 'Hive를 선택하세요.' : '먼저 Area를 선택하세요.';
        if (!state.selectedArea) {
            return;
        }
        state.selectedArea.hives?.forEach(hive => {
            const option = document.createElement('option');
            option.value = hive.id;
            option.textContent = hive.name;
            els.hiveSelect.appendChild(option);
        });
    }

    async function handleHiveChange() {
        const hiveId = parseInt(els.hiveSelect.value, 10);
        if (Number.isNaN(hiveId)) {
            state.selectedHive = null;
            state.devices = [];
            renderDeviceList([]);
            return;
        }
        state.selectedHive = state.selectedArea?.hives?.find(h => h.id === hiveId) || null;
        try {
            setDeviceListLoading();
            const res = await fetch(apiUrl(`/api/device?hiveId=${hiveId}`));
            if (!res.ok) throw new Error(`(${res.status}) ${res.statusText}`);
            const data = await res.json();
            state.devices = Array.isArray(data) ? data : [];
            renderDeviceList(state.devices);
        } catch (err) {
            setDeviceListError(`디바이스를 불러올 수 없습니다: ${err.message}`);
        }
    }

    function renderDeviceList(devices) {
        els.deviceList.innerHTML = '';
        if (!devices || devices.length === 0) {
            els.deviceList.classList.add('empty');
            els.deviceList.textContent = '선택한 Hive에 디바이스가 없습니다.';
            return;
        }
        els.deviceList.classList.remove('empty');
        devices.forEach(device => {
            const item = document.createElement('label');
            item.className = 'device-chip';

            const meta = document.createElement('div');
            meta.className = 'meta';
            const name = document.createElement('strong');
            name.textContent = device.name || `Device ${device.id}`;
            const sub = document.createElement('span');
            sub.textContent = state.selectedHive?.name ? `Hive: ${state.selectedHive.name}` : '';
            sub.style.color = '#7b6f61';
            sub.style.fontSize = '12px';
            meta.appendChild(name);
            meta.appendChild(sub);

            const right = document.createElement('div');
            right.style.display = 'flex';
            right.style.alignItems = 'center';
            right.style.gap = '8px';

            const pill = document.createElement('span');
            pill.className = `pill ${device.type_id === 1 ? 'camera' : 'secondary'}`;
            pill.textContent = deviceTypeLabel(device.type_id);

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = state.selectedDevices.has(device.id);
            checkbox.addEventListener('change', () => toggleDeviceSelection(device, checkbox.checked));

            right.appendChild(pill);
            right.appendChild(checkbox);
            item.appendChild(meta);
            item.appendChild(right);
            els.deviceList.appendChild(item);
        });
    }

    function toggleDeviceSelection(device, isChecked) {
        if (isChecked) {
            const payload = {
                id: device.id,
                name: device.name,
                type_id: device.type_id,
                hive_id: state.selectedHive?.id,
                hive_name: state.selectedHive?.name,
                area_id: state.selectedArea?.id,
                area_name: state.selectedArea?.name,
            };
            state.selectedDevices.set(device.id, payload);
        } else {
            state.selectedDevices.delete(device.id);
        }
        renderSelectedDevices();
    }

    function renderSelectedDevices() {
        els.selectedDevices.innerHTML = '';
        if (state.selectedDevices.size === 0) {
            els.selectedDevices.classList.add('empty');
            els.selectedDevices.textContent = '아직 선택된 디바이스가 없습니다.';
            return;
        }
        els.selectedDevices.classList.remove('empty');
        state.selectedDevices.forEach(device => {
            const item = document.createElement('div');
            item.className = 'selected-chip';

            const meta = document.createElement('div');
            meta.className = 'meta';
            const title = document.createElement('strong');
            title.textContent = device.name || `Device ${device.id}`;
            const sub = document.createElement('span');
            sub.textContent = `${device.area_name || ''} ${device.hive_name || ''}`.trim();
            sub.style.color = '#7b6f61';
            sub.style.fontSize = '12px';
            meta.appendChild(title);
            meta.appendChild(sub);

            const right = document.createElement('div');
            right.style.display = 'flex';
            right.style.alignItems = 'center';
            right.style.gap = '8px';

            const pill = document.createElement('span');
            pill.className = `pill ${device.type_id === 1 ? 'camera' : 'secondary'}`;
            pill.textContent = deviceTypeLabel(device.type_id);

            const remove = document.createElement('span');
            remove.className = 'pill remove';
            remove.textContent = '제거';
            remove.addEventListener('click', () => {
                state.selectedDevices.delete(device.id);
                renderSelectedDevices();
                // Reflect removal on current list if visible
                if (state.devices.some(d => d.id === device.id)) {
                    renderDeviceList(state.devices);
                }
            });

            right.appendChild(pill);
            right.appendChild(remove);
            item.appendChild(meta);
            item.appendChild(right);
            els.selectedDevices.appendChild(item);
        });
    }

    function renderDataTypeChips() {
        els.dataTypeList.innerHTML = '';
        DATA_TYPE_OPTIONS.forEach(opt => {
            const label = document.createElement('label');
            label.className = 'chip';

            const input = document.createElement('input');
            input.type = 'checkbox';
            input.value = opt.id;
            input.checked = DEFAULT_DATA_TYPES.includes(opt.id);

            const text = document.createElement('div');
            text.style.display = 'flex';
            text.style.flexDirection = 'column';
            text.style.gap = '2px';
            const strong = document.createElement('span');
            strong.textContent = opt.label;
            strong.style.fontWeight = '700';
            const hint = document.createElement('span');
            hint.textContent = opt.hint;
            hint.style.fontSize = '12px';
            hint.style.color = '#7b6f61';
            text.appendChild(strong);
            text.appendChild(hint);

            label.appendChild(input);
            label.appendChild(text);
            els.dataTypeList.appendChild(label);
        });
    }

    function setDefaultTimeRange(days) {
        const end = new Date();
        const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
        els.startTime.value = toLocalInputValue(start);
        els.endTime.value = toLocalInputValue(end);
    }

    function applyPreset(rangeKey) {
        switch (rangeKey) {
            case '1d':
                setDefaultTimeRange(1);
                break;
            case '7d':
                setDefaultTimeRange(7);
                break;
            case '30d':
                setDefaultTimeRange(30);
                break;
        }
    }

    function toLocalInputValue(date) {
        const tzOffset = date.getTimezoneOffset() * 60000;
        return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
    }

    async function handleExport() {
        clearStatus();
        const deviceIds = Array.from(state.selectedDevices.keys());
        const dataTypes = getSelectedDataTypes();
        const start = els.startTime.value;
        const end = els.endTime.value;

        const validation = validateExport(deviceIds, dataTypes, start, end);
        if (!validation.ok) {
            setStatus(validation.message);
            return;
        }

        const payload = {
            deviceIds,
            dataTypes,
            sTime: new Date(start).toISOString(),
            eTime: new Date(end).toISOString(),
        };

        els.exportBtn.disabled = true;
        setStatus('Export 작업을 생성하는 중입니다...', 'info');
        try {
            const res = await fetch(apiUrl('/api/exports/mixed'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                const text = await res.text();
                throw new Error(text || res.statusText);
            }
            const body = await res.json();
            const exportId = body.exportId || body.id;
            if (!exportId) {
                throw new Error('exportId가 응답에 없습니다.');
            }
            addJob({
                id: exportId,
                status: 'pending',
                progress: 0,
                totalRows: null,
                fileSize: null,
                expiresAt: null,
                deviceIds,
                dataTypes,
                devices: Array.from(state.selectedDevices.values()),
                sTime: payload.sTime,
                eTime: payload.eTime,
                createdAt: new Date().toISOString(),
            });
            setStatus('작업 큐에 추가되었습니다. 진행 상황을 모니터링하세요.', 'success');
        } catch (err) {
            setStatus(`Export 생성 실패: ${err.message}`);
        } finally {
            els.exportBtn.disabled = false;
        }
    }

    function validateExport(deviceIds, dataTypes, start, end) {
        if (!deviceIds.length) {
            return { ok: false, message: '디바이스를 최소 1개 선택하세요.' };
        }
        if (!dataTypes.length) {
            return { ok: false, message: '데이터 타입을 최소 1개 선택하세요.' };
        }
        if (!start || !end) {
            return { ok: false, message: '시작/종료 시간을 모두 입력하세요.' };
        }
        if (new Date(start) >= new Date(end)) {
            return { ok: false, message: '시작 시간이 종료 시간보다 빠르거나 같을 수 없습니다.' };
        }
        return { ok: true, message: '' };
    }

    function getSelectedDataTypes() {
        const checked = els.dataTypeList.querySelectorAll('input[type="checkbox"]:checked');
        return Array.from(checked).map(input => parseInt(input.value, 10));
    }

    function addJob(job) {
        state.jobs = [job, ...state.jobs];
        saveJobs();
        renderJobs();
        startPolling(job);
    }

    function loadStoredJobs() {
        try {
            const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
            if (Array.isArray(stored)) {
                state.jobs = stored;
                renderJobs();
            }
        } catch (err) {
            console.warn('Failed to parse stored jobs:', err);
        }
    }

    function saveJobs() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state.jobs));
        } catch (err) {
            console.warn('Failed to store jobs:', err);
        }
    }

    function resumeJobPolling() {
        state.jobs.forEach(job => {
            if (job.status === 'ready') {
                // refresh once in case 만료되었는지 확인
                refreshJobStatus(job, true);
            } else if (job.status !== 'failed' && job.status !== 'expired') {
                startPolling(job);
            }
        });
    }

    function startPolling(job) {
        if (polling.has(job.id)) return;
        const run = async () => {
            await refreshJobStatus(job);
        };
        run();
        const timer = setInterval(run, POLL_INTERVAL_MS);
        polling.set(job.id, timer);
    }

    async function refreshJobStatus(job, oneShot = false) {
        try {
            const res = await fetch(apiUrl(`/api/exports/${job.id}/status`));
            if (res.status === 404) {
                applyJobUpdate(job.id, { status: 'expired' });
                return stopPolling(job.id);
            }
            if (!res.ok) {
                throw new Error(`status ${res.status}`);
            }
            const data = await res.json();
            const next = {
                status: data.status || job.status,
                progress: data.progress ?? job.progress,
                totalRows: data.totalRows ?? job.totalRows,
                fileSize: data.fileSize ?? job.fileSize,
                expiresAt: data.expiresAt || data.expireAt || data.expiredAt || job.expiresAt,
            };
            applyJobUpdate(job.id, next);
            if (['ready', 'failed', 'expired'].includes(next.status)) {
                stopPolling(job.id);
            }
        } catch (err) {
            if (oneShot) return;
            console.warn(`Status 확인 실패 (${job.id}):`, err.message);
        }
    }

    function stopPolling(jobId) {
        const timer = polling.get(jobId);
        if (timer) {
            clearInterval(timer);
            polling.delete(jobId);
        }
    }

    function applyJobUpdate(jobId, patch) {
        state.jobs = state.jobs.map(job => job.id === jobId ? { ...job, ...patch } : job);
        saveJobs();
        renderJobs();
    }

    function renderJobs() {
        els.jobList.innerHTML = '';
        if (!state.jobs.length) {
            els.jobList.classList.add('empty');
            els.jobList.textContent = '아직 시작된 Export 작업이 없습니다.';
            return;
        }
        els.jobList.classList.remove('empty');
        state.jobs.forEach(job => {
            const card = document.createElement('div');
            card.className = 'job-card';

            const head = document.createElement('div');
            head.className = 'job-head';

            const title = document.createElement('div');
            title.innerHTML = `<strong>Export ${job.id}</strong>`;

            const badge = document.createElement('span');
            badge.className = `status-badge ${job.status || 'pending'}`;
            badge.textContent = statusLabel(job.status);

            head.appendChild(title);
            head.appendChild(badge);

            const meta = document.createElement('div');
            meta.className = 'job-meta';
            meta.innerHTML = [
                formatDate(job.createdAt ? new Date(job.createdAt) : new Date()),
                `${formatDateRange(job.sTime, job.eTime)}`,
                `Devices ${job.deviceIds?.length || 0}`,
                `Types: ${formatDataTypes(job.dataTypes)}`
            ].map(text => `<span>${text}</span>`).join('');

            const body = document.createElement('div');
            body.className = 'job-body';

            const progressWrap = document.createElement('div');
            const progressLabel = document.createElement('div');
            progressLabel.textContent = progressText(job);
            progressLabel.style.fontSize = '13px';
            progressLabel.style.color = '#7b6f61';

            const progressBar = document.createElement('div');
            progressBar.className = 'progress';
            const bar = document.createElement('div');
            bar.className = 'bar';
            bar.style.width = `${progressPercent(job)}%`;
            progressBar.appendChild(bar);
            progressWrap.appendChild(progressLabel);
            progressWrap.appendChild(progressBar);

            const download = document.createElement('div');
            download.className = 'download';

            if (job.status === 'ready') {
                const link = document.createElement('a');
                link.href = apiUrl(`/api/exports/${job.id}/download`);
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                link.textContent = '다운로드';

                const expire = document.createElement('span');
                expire.style.color = '#7b6f61';
                expire.style.fontSize = '13px';
                expire.textContent = job.expiresAt
                    ? `만료: ${formatDate(new Date(job.expiresAt))}`
                    : '만료 전까지 재방문 시 링크 유지';

                download.appendChild(link);
                download.appendChild(expire);
            } else if (job.status === 'failed') {
                download.textContent = '실패했습니다. 다시 시도하세요.';
                download.style.color = '#c44536';
            } else if (job.status === 'expired') {
                download.textContent = '만료된 작업입니다.';
                download.style.color = '#7b6f61';
            } else {
                download.textContent = '작업 중... 완료되면 자동으로 다운로드 버튼이 활성화됩니다.';
                download.style.color = '#7b6f61';
            }

            body.appendChild(progressWrap);
            body.appendChild(download);

            card.appendChild(head);
            card.appendChild(meta);
            card.appendChild(body);
            els.jobList.appendChild(card);
        });
    }

    function formatDataTypes(list) {
        if (!list || !list.length) return '-';
        return list.map(dataTypeLabel).join(', ');
    }

    function statusLabel(status) {
        switch (status) {
            case 'ready': return 'Ready';
            case 'failed': return 'Failed';
            case 'expired': return 'Expired';
            case 'processing': return 'Processing';
            default: return 'Pending';
        }
    }

    function progressPercent(job) {
        if (job.status === 'ready') return 100;
        if (job.totalRows && job.totalRows > 0) {
            return Math.min(100, Math.round((job.progress || 0) / job.totalRows * 100));
        }
        return job.progress && job.progress > 0 && job.progress <= 100 ? job.progress : 8;
    }

    function progressText(job) {
        if (job.status === 'ready') {
            return '완료되었습니다.';
        }
        if (job.status === 'failed') {
            return '실패';
        }
        if (job.status === 'expired') {
            return '만료';
        }
        if (job.totalRows) {
            return `진행률 ${job.progress || 0} / ${job.totalRows}`;
        }
        return '큐에서 처리 중...';
    }

    function formatDate(date) {
        if (!date) return '';
        const d = (date instanceof Date) ? date : new Date(date);
        return d.toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    }

    function formatDateRange(sTime, eTime) {
        if (!sTime || !eTime) return '';
        const start = new Date(sTime);
        const end = new Date(eTime);
        return `${formatDate(start)} ~ ${formatDate(end)}`;
    }

    function deviceTypeLabel(typeId) {
        switch (typeId) {
            case 1: return 'Camera';
            case 2: return 'Sensor';
            case 3: return 'I/O';
            default: return 'Device';
        }
    }

    function dataTypeLabel(id) {
        const found = DATA_TYPE_OPTIONS.find(opt => opt.id === id);
        return found ? found.label : `Type ${id}`;
    }

    function setDeviceListLoading() {
        els.deviceList.classList.add('empty');
        els.deviceList.textContent = '디바이스를 불러오는 중...';
    }

    function setDeviceListError(message) {
        els.deviceList.classList.add('empty');
        els.deviceList.textContent = message;
    }

    function setStatus(message, mode = 'error') {
        els.statusMessage.textContent = message;
        els.statusMessage.classList.remove('success', 'info');
        if (mode === 'success') {
            els.statusMessage.classList.add('success');
        } else if (mode === 'info') {
            els.statusMessage.classList.add('info');
        }
    }

    function clearStatus() {
        els.statusMessage.textContent = '';
        els.statusMessage.classList.remove('success', 'info');
    }
})();
