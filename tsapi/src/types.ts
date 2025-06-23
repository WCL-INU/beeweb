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

// 1. 기본 DB 레코드 구조 (SELECT * FROM sensor_data2)
export interface SensorData2Row {
    id: number;
    device_id: number;
    data_int: number | null;
    data_float: number | null;
    data_type: number;
    time: string;
}

// 2. INSERT용 구조 (id 없음)
export type SensorData2Insert = Omit<SensorData2Row, 'id'>;

// 3. API 응답용 구조 (int/float 대신 value 단일 필드 사용)
export interface SensorData2Value {
    id: number;
    device_id: number;
    data_type: number;
    time: string;
    value: number;
}

// PictureData 관련 인터페이스
// ===================================================
export interface PictureDataInsert {
    device_id: number;
    time: string;      // MySQL DATETIME 포맷 ("YYYY-MM-DD HH:MM:SS")
    picture: Buffer;
}

export interface PictureDataRow {
    id: number;
    device_id: number;
    time: string;
    picture: Buffer;
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
