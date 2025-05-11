// TODO: API콜로 TYPE 받아오도록 수정
const deviceTypes = {
  'CAMERA': 1,
  'SENSOR': 2,
  'INOUT': 3,
};

let yMinIo = 0, yMaxIo = 100;
let yMinTh = 0, yMaxTh = 100;
let yMinCo2 = 0, yMaxCo2 = 100;
let yMinWeigh = 0, yMaxWeigh = 100;

let ioChart, thChart, co2Chart, weighChart;

async function fetchInOutData(deviceId, sTime, eTime) {
  const url = `api/inout?deviceId=${deviceId}&sTime=${sTime}&eTime=${eTime}`;
  const response = await fetch(url);
  const data = await response.json();
  console.log(`Data received for device ${deviceId}:`, data);
  return data;
}

async function fetchSensorData(deviceId, sTime, eTime) {
  const url = `api/sensor?deviceId=${deviceId}&sTime=${sTime}&eTime=${eTime}`;
  const response = await fetch(url);
  const data = await response.json();
  console.log(`Data received for device ${deviceId}:`, data);
  return data;
}

async function fetchDevicesByHive(hiveId) {
  const url = `api/device?hiveId=${hiveId}`;
  const response = await fetch(url);
  const data = await response.json();
  console.log(`Devices received for hive ${hiveId}:`, data);
  return data;
}

function getTimeUnit(minTime, maxTime) {
  const timeDiff = (new Date(maxTime) - new Date(minTime)) / 1000; // 시간 차이 (초 단위)

  if (timeDiff <= 3600) { // 1시간 이하
    return 'minute';
  } else if (timeDiff <= 86400) { // 1일 이하
    return 'hour';
  } else {
    return 'day';
  }
}

function getMaxLabelLength(labels, fontSize, fontFamily) {
  const dummyCanvas = document.createElement('canvas');
  const dummyCtx = dummyCanvas.getContext('2d');
  dummyCtx.font = `${fontSize}px ${fontFamily}`;
  return Math.max(...labels.map(label => dummyCtx.measureText(label).width));
}

function createChartWithDynamicPadding(chartRef, ctx, labels, datasets, minTime, maxTime, yMin, yMax) {
  if (chartRef) {
    chartRef.destroy();
  }

  const timeUnit = getTimeUnit(minTime, maxTime);

  chartRef = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: datasets
    },
    options: {
      plugins: {
        tooltip: {
          mode: 'index',
          intersect: false
        },
        crosshair: {
          line: {
            color: '#F66',  // crosshair line color
            width: 1        // crosshair line width
          },
          sync: {
            enabled: true,            // enable trace line syncing with other charts
            group: 2,                 // chart group
            suppressTooltips: false   // suppress tooltips when showing a synced tracer
          },
          zoom: {
            enabled: false                                      // enable zooming
          },
        }
      },
      scales: {
        x: {
          type: 'time',
          time: {
            unit: timeUnit,
            tooltipFormat: 'MM-dd_HH:mm',
            displayFormats: {
              minute: 'HH:mm',
              hour: 'dd_HH',
              day: 'MM-dd'
            }
          },
          title: {
            display: false,
            text: 'Time'
          },
          ticks: {
            source: 'auto',
            autoSkip: false,
            maxTicksLimit: 10,
          },
          min: minTime,
          max: maxTime
        },
        y: {
          min: yMin,
          max: yMax
        }
      },
      responsive: true,
      maintainAspectRatio: false,
    }
  });

  return chartRef;
}

function createInOutChart(ctx, created_at, in_field, out_field, minTime, maxTime, yMin, yMax) {
  ioChart = createChartWithDynamicPadding(ioChart, ctx, created_at, [
    {
      label: 'in',
      data: in_field,
      borderColor: 'rgba(75, 192, 192, 1)',
      backgroundColor: 'rgba(75, 192, 192, 0.2)',
      fill: false,
      pointRadius: 0,
      borderWidth: 1
    },
    {
      label: 'out',
      data: out_field,
      borderColor: 'rgba(192, 75, 192, 1)',
      backgroundColor: 'rgba(192, 75, 192, 0.2)',
      fill: false,
      pointRadius: 0,
      borderWidth: 1
    }
  ], minTime, maxTime, yMin, yMax);
}

function createTempHumiChart(ctx, time, temp, humi, minTime, maxTime, yMin, yMax) {
  thChart = createChartWithDynamicPadding(thChart, ctx, time, [
    {
      label: 'temp(°C)',
      data: temp,
      borderColor: 'rgba(75, 192, 192, 1)',
      backgroundColor: 'rgba(75, 192, 192, 0.2)',
      fill: false,
      pointRadius: 0,
      borderWidth: 1
    },
    {
      label: 'humi(%)',
      data: humi,
      borderColor: 'rgba(192, 75, 192, 1)',
      backgroundColor: 'rgba(192, 75, 192, 0.2)',
      fill: false,
      pointRadius: 0,
      borderWidth: 1
    }
  ], minTime, maxTime, yMin, yMax);
}

function createCo2Chart(ctx, time, co2, minTime, maxTime, yMin, yMax) {
  co2Chart = createChartWithDynamicPadding(co2Chart, ctx, time, [
    {
      label: 'co2(ppm)',
      data: co2,
      borderColor: 'rgba(75, 192, 192, 1)',
      backgroundColor: 'rgba(75, 192, 192, 0.2)',
      fill: false,
      pointRadius: 0,
      borderWidth: 1
    }
  ], minTime, maxTime, yMin, yMax);
}

function createWeighChart(ctx, time, weigh, minTime, maxTime, yMin, yMax) {
  weighChart = createChartWithDynamicPadding(weighChart, ctx, time, [
    {
      label: 'weigh(kg)',
      data: weigh,
      borderColor: 'rgba(75, 192, 192, 1)',
      backgroundColor: 'rgba(75, 192, 192, 0.2)',
      fill: false,
      pointRadius: 0,
      borderWidth: 1
    }
  ], minTime, maxTime, yMin, yMax);
}

async function fetchAndRenderCharts(urlParams) {
  const urlSearchParams = new URLSearchParams(urlParams);
  let hiveId = urlSearchParams.get('hiveId');
  let sTime = urlSearchParams.get('sTime');
  let eTime = urlSearchParams.get('eTime');

  if (!hiveId) {
    hiveId = 1;
  }

  if (!sTime || !eTime) {
    const now = new Date();
    const twoMonthAgo = new Date();
    twoMonthAgo.setMonth(now.getMonth() - 2);
  
    const defaultSTime = twoMonthAgo.toISOString().split('.')[0] + 'Z';
    const defaultETime = now.toISOString().split('.')[0] + 'Z';
    
    sTime = sTime || defaultSTime;
    eTime = eTime || defaultETime;
  }

  const sTimeDate = new Date(sTime);
  const eTimeDate = new Date(eTime);

  const devices = await fetchDevicesByHive(hiveId);
  const sensorData = [];
  const inoutData = [];

  for (const device of devices) {
    let result;
    if (device.type === deviceTypes.SENSOR) {
      result = await fetchSensorData(device.id, sTime, eTime);
    } else if (device.type === deviceTypes.INOUT) {
      result = await fetchInOutData(device.id, sTime, eTime);
    }

    if (result && result.length > 0) {
      if (device.type === deviceTypes.SENSOR) {
        sensorData.push(...result);
      } else if (device.type === deviceTypes.INOUT) {
        inoutData.push(...result);
      }
    }
  }

  const maxInout = inoutData.length > 0 ? Math.max(...inoutData.map(data => Math.max(data.in_field, data.out_field))) : 0;
  const maxTemp = sensorData.length > 0 ? Math.max(...sensorData.map(data => data.temp)) : 0;
  const maxHumi = sensorData.length > 0 ? Math.max(...sensorData.map(data => data.humi)) : 0;
  const maxCo2 = sensorData.length > 0 ? Math.max(...sensorData.map(data => data.co2)) : 0;
  const maxWeigh = sensorData.length > 0 ? Math.max(...sensorData.map(data => data.weigh)) : 0;

  let yMaxIo = maxInout + (maxInout * 0.1);
  let yMaxTh = Math.max(maxTemp, maxHumi) + (Math.max(maxTemp, maxHumi) * 0.1);
  let yMaxCo2 = maxCo2 + (maxCo2 * 0.1);
  let yMaxWeigh = maxWeigh + (maxWeigh * 0.1);

  createInOutChart(document.getElementById('hive_io').getContext('2d'), inoutData.map(data => new Date(data.time)), inoutData.map(data => data.in_field), inoutData.map(data => data.out_field), sTimeDate, eTimeDate, yMinIo, yMaxIo);
  createTempHumiChart(document.getElementById('hive_th').getContext('2d'), sensorData.map(data => new Date(data.time)), sensorData.map(data => data.temp), sensorData.map(data => data.humi), sTimeDate, eTimeDate, yMinTh, yMaxTh);
  createCo2Chart(document.getElementById('hive_co2').getContext('2d'), sensorData.map(data => new Date(data.time)), sensorData.map(data => data.co2), sTimeDate, eTimeDate, yMinCo2, yMaxCo2);
  createWeighChart(document.getElementById('hive_weigh').getContext('2d'), sensorData.map(data => new Date(data.time)), sensorData.map(data => data.weigh), sTimeDate, eTimeDate, yMinWeigh, yMaxWeigh);

  initializeSlider('y-axis-range-io', yMinIo, yMaxIo, (values) => {
    yMinIo = parseFloat(values[0]);
    yMaxIo = parseFloat(values[1]);
    createInOutChart(document.getElementById('hive_io').getContext('2d'), inoutData.map(data => new Date(data.time)), inoutData.map(data => data.in_field), inoutData.map(data => data.out_field), sTimeDate, eTimeDate, yMinIo, yMaxIo);
  });

  initializeSlider('y-axis-range-th', yMinTh, yMaxTh, (values) => {
    yMinTh = parseFloat(values[0]);
    yMaxTh = parseFloat(values[1]);
    createTempHumiChart(document.getElementById('hive_th').getContext('2d'), sensorData.map(data => new Date(data.time)), sensorData.map(data => data.temp), sensorData.map(data => data.humi), sTimeDate, eTimeDate, yMinTh, yMaxTh);
  });

  initializeSlider('y-axis-range-co2', yMinCo2, yMaxCo2, (values) => {
    yMinCo2 = parseFloat(values[0]);
    yMaxCo2 = parseFloat(values[1]);
    createCo2Chart(document.getElementById('hive_co2').getContext('2d'), sensorData.map(data => new Date(data.time)), sensorData.map(data => data.co2), sTimeDate, eTimeDate, yMinCo2, yMaxCo2);
  });

  initializeSlider('y-axis-range-weigh', yMinWeigh, yMaxWeigh, (values) => {
    yMinWeigh = parseFloat(values[0]);
    yMaxWeigh = parseFloat(values[1]);
    createWeighChart(document.getElementById('hive_weigh').getContext('2d'), sensorData.map(data => new Date(data.time)), sensorData.map(data => data.weigh), sTimeDate, eTimeDate, yMinWeigh, yMaxWeigh);
  });
}

function initializeSlider(id, min, max, updateCallback) {
  const slider = document.getElementById(id);
  noUiSlider.create(slider, {
    start: [min, max],
    connect: true,
    orientation: 'vertical', // 세로 슬라이더로 설정
    direction: 'rtl', // 슬라이더 방향을 반전
    range: {
      'min': 0,
      'max': max
    },
    step: 1
  });

  slider.noUiSlider.on('update', function(values, handle) {
    updateCallback(values);
  });
}

document.addEventListener('DOMContentLoaded', function() {
  fetchAndRenderCharts(window.location.search);
});
