export interface Device {
    id: number;
    hive_id: number;
    type_id: number;
    modem_ip: string;
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
}