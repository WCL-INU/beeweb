// 날짜를 input 필드용 로컬 시간 문자열로 변환
function convertToLocalDateTime(date) {
    const tzOffset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
}

// ISO 문자열에서 밀리초 제거
function toISOStringWithoutMillis(date) {
    return date.toISOString().split('.')[0] + 'Z';
}

// URL에서 UTC 시간 정보를 가져옴 (없으면 한 달 전 ~ 현재 시간으로 대체)
function getTimeFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    let sTimeUTC = urlParams.get('sTime');
    let eTimeUTC = urlParams.get('eTime');

    if (!sTimeUTC || !eTimeUTC) {
        const endDate = new Date();
        const startDate = new Date(endDate);
        startDate.setMonth(startDate.getMonth() - 1);

        sTimeUTC = toISOStringWithoutMillis(startDate);
        eTimeUTC = toISOStringWithoutMillis(endDate);

        const newUrl = new URL(window.location);
        newUrl.searchParams.set('sTime', sTimeUTC);
        newUrl.searchParams.set('eTime', eTimeUTC);
        window.history.replaceState(null, '', newUrl.toString());
    }

    console.log(`[TimeSelector] URL time (UTC): ${sTimeUTC} ~ ${eTimeUTC}`);
    return { sTimeUTC, eTimeUTC };
}

// UTC 시간을 기준으로 타임셀렉터 input 값 설정
function setTimeSelectorFromUTC(sTimeUTC, eTimeUTC) {
    const localStart = convertToLocalDateTime(new Date(sTimeUTC));
    const localEnd = convertToLocalDateTime(new Date(eTimeUTC));

    const startDateEl = document.getElementById('startDate');
    const endDateEl = document.getElementById('endDate');

    startDateEl.value = localStart;
    endDateEl.value = localEnd;

    console.log(`[TimeSelector] Local time: ${localStart} ~ ${localEnd}`);
}

// 타임셀렉터 input 값으로부터 로컬 Date 객체 가져오기
function getTimeFromSelector() {
    const startInput = document.getElementById('startDate').value;
    const endInput = document.getElementById('endDate').value;

    return {
        localStart: new Date(startInput),
        localEnd: new Date(endInput),
    };
}

// URL의 sTime/eTime 파라미터 갱신
function updateURLTimeParams(sTimeUTC, eTimeUTC) {
    const newUrl = new URL(window.location);
    newUrl.searchParams.set('sTime', sTimeUTC);
    newUrl.searchParams.set('eTime', eTimeUTC);
    window.history.replaceState(null, '', newUrl.toString());
}

// 검색 버튼 클릭 시 호출 - 현재 선택된 시간 범위를 기반으로 URL 업데이트 및 이벤트 발생
function searchWithTimePeriod() {
    const { localStart, localEnd } = getTimeFromSelector();

    if (localStart && localEnd && !isNaN(localStart) && !isNaN(localEnd)) {
        const sTimeUTC = toISOStringWithoutMillis(localStart);
        const eTimeUTC = toISOStringWithoutMillis(localEnd);

        updateURLTimeParams(sTimeUTC, eTimeUTC);

        const updateEvent = new CustomEvent('timeRangeUpdated', { detail: { sTime: sTimeUTC, eTime: eTimeUTC } });
        document.dispatchEvent(updateEvent);
    } else {
        console.warn(`[TimeSelector] Invalid date input`);
    }
}

// 기간 선택 버튼(day/week/month) 클릭 시 사용할 시간 범위 생성
function getPresetRange(period) {
    const endDate = new Date();
    let startDate;

    switch (period) {
        case 'day':
            startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
            break;
        case 'week':
            startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
        case 'month':
            startDate = new Date(endDate);
            startDate.setMonth(endDate.getMonth() - 1);
            break;
        default:
            console.warn(`[TimeSelector] Unknown period: ${period}`);
            return null;
    }

    const sTimeUTC = toISOStringWithoutMillis(startDate);
    const eTimeUTC = toISOStringWithoutMillis(endDate);

    return { sTimeUTC, eTimeUTC };
}

// 버튼 클릭으로 기간 선택 시 셀렉터/URL/EVENT 모두 업데이트
function setPreset(period) {
    const range = getPresetRange(period);
    if (!range) return;

    setTimeSelectorFromUTC(range.sTimeUTC, range.eTimeUTC);
    updateURLTimeParams(range.sTimeUTC, range.eTimeUTC);

    const updateEvent = new CustomEvent('timeRangeUpdated', { detail: { sTime: range.sTimeUTC, eTime: range.eTimeUTC } });
    document.dispatchEvent(updateEvent);
}

// 페이지 로딩 시 URL에서 시간 읽고 타임셀렉터 설정 및 이벤트 전송
document.addEventListener("DOMContentLoaded", function () {
    const { sTimeUTC, eTimeUTC } = getTimeFromURL();
    setTimeSelectorFromUTC(sTimeUTC, eTimeUTC);

    const updateEvent = new CustomEvent('timeRangeUpdated', { detail: { sTime: sTimeUTC, eTime: eTimeUTC } });
    document.dispatchEvent(updateEvent);
});
