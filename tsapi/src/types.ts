export interface Device {
    id: number;
    hive_id: number;
    type_id: number;
    modem_ip: string;
    name: string;
}

export interface DeviceType {
    id: number;
    name: string;
}

export interface Hive {
    id: number;
    area_id: number;
    name: string;
}

export interface Area {
    id: number;
    name: string;
    location: string;
}

export interface User {
    id: string;
    pw: string;
    grade: number;
}

export interface InOutData {
    id: number;
    device_id: number;
    in_field : number;
    out_field : number;
    time: string;
}

export interface SensorData {
    id: number;
    device_id: number;
    temp : number;
    humi : number;
    co2 : number;
    weigh : number;
    time : string;
}

export interface SensorData2 {
    id: number;
    device_id: number;
    data_int: number | null;      // IN, OUT과 같이 정수형 데이터
    data_float: number | null;    // TEMP, HUMI 등 실수형 데이터
    data_type: number;            // 1~7: PICUTRE 제외 모든 타입을 의미
    time: string;
}

export const DATA_TYPE = {
    PICUTRE: 1,   // 현재 사용 안 함
    IN: 2,
    OUT: 3,
    TEMP: 4,
    HUMI: 5,
    CO2: 6,
    WEIGH: 7,
} as const;

export interface CameraData {
    id: number;
    device_id: number;
    picture: string;
    time: string;
}
