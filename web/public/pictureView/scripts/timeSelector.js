function searchWithTimePeriod() {
    const startDateInput = document.getElementById('startDate').value;
    const endDateInput = document.getElementById('endDate').value;

    if (startDateInput && endDateInput) {
        const startDate = new Date(startDateInput);
        const endDate = new Date(endDateInput);

        const sTime = startDate.toISOString().split('.')[0] + 'Z';
        const eTime = endDate.toISOString().split('.')[0] + 'Z';

        const newUrl = new URL(window.location);
        newUrl.searchParams.set('sTime', sTime);
        newUrl.searchParams.set('eTime', eTime);
        window.history.replaceState(null, '', newUrl.toString());

        const updateEvent = new CustomEvent('timeRangeUpdated', {
            detail: { sTime, eTime }
        });
        document.dispatchEvent(updateEvent);
    }
}

function setPreset(period) {
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
            startDate = new Date(endDate); // endDate 복사본 생성
            startDate.setMonth(endDate.getMonth() - 1);
            break;
    }
  
    document.getElementById('startDate').value = convertToLocalDateTime(startDate);
    document.getElementById('endDate').value = convertToLocalDateTime(endDate);
  
    // URL 업데이트
    const newUrl = new URL(window.location);
    newUrl.searchParams.set('sTime', startDate.toISOString().split('.')[0] + 'Z');
    newUrl.searchParams.set('eTime', endDate.toISOString().split('.')[0] + 'Z');
    window.history.replaceState(null, '', newUrl.toString()); // URL 업데이트
}

// Helper function to format date-time for input fields
function convertToLocalDateTime(date) {
    const tzOffset = date.getTimezoneOffset() * 60000;
    const localISOTime = new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
    return localISOTime;
}

document.addEventListener("DOMContentLoaded", function() {
    // 페이지 로드 시 URL에서 시간 가져와 업데이트
    const urlParams = new URLSearchParams(window.location.search);
    let sTime = urlParams.get('sTime');
    let eTime = urlParams.get('eTime');
    
    if (!sTime || !eTime) {
        // sTime이나 eTime이 없으면 한달 전의 날짜와 현재 날짜로 기본 설정
        const endDate = new Date();
        const startDate = new Date(endDate);
        startDate.setMonth(startDate.getMonth() - 1);
        
        sTime = startDate.toISOString().split('.')[0] + 'Z';
        eTime = endDate.toISOString().split('.')[0] + 'Z';
        
        const newUrl = new URL(window.location);
        newUrl.searchParams.set('sTime', sTime);
        newUrl.searchParams.set('eTime', eTime);
        window.history.replaceState(null, '', newUrl.toString()); // URL 업데이트
    }
    
    if (sTime) {
        document.getElementById('startDate').value = convertToLocalDateTime(new Date(sTime));
    }
    if (eTime) {
        document.getElementById('endDate').value = convertToLocalDateTime(new Date(eTime));
    }

    const updateEvent = new CustomEvent('timeRangeUpdated', { detail: { sTime: sTime, eTime: eTime } });
    document.dispatchEvent(updateEvent);
});

