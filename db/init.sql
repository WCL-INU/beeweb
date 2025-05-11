CREATE DATABASE IF NOT EXISTS hive_data;

USE hive_data;

-- INOUT_DATA 테이블 생성
CREATE TABLE IF NOT EXISTS inout_data (
    id INT AUTO_INCREMENT PRIMARY KEY,
    device_id INT NOT NULL,
    in_field INT,
    out_field INT,
    time DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_device_time (device_id, time)
);

-- SENSOR_DATA 테이블 생성
CREATE TABLE IF NOT EXISTS sensor_data (
    id INT AUTO_INCREMENT PRIMARY KEY,
    device_id INT NOT NULL,
    temp FLOAT,
    humi FLOAT,
    co2 FLOAT,
    weigh FLOAT,
    time DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_device_time (device_id, time)
);

-- CAMERA_DATA 테이블 생성
CREATE TABLE IF NOT EXISTS camera_data (
    id INT AUTO_INCREMENT PRIMARY KEY,
    device_id INT NOT NULL,
    picture LONGBLOB,
    time DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_device_time (device_id, time)
);

-- HIVES 테이블 생성
CREATE TABLE IF NOT EXISTS hives (
    id INT AUTO_INCREMENT PRIMARY KEY,
    area_id INT NOT NULL,
    name VARCHAR(255),
    UNIQUE KEY unique_hive (area_id, name)
);

-- AREAS 테이블 생성 및 초기 데이터 삽입
CREATE TABLE IF NOT EXISTS areas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255),
    location VARCHAR(255)
);

INSERT INTO areas (id, name, location) VALUES
    (1, '인천대', '37.375, 126.633'),
    (2, '안동대', '36.544, 128.8007'),
    (3, '농과원', '0.0, 0.0')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- DEVICES 테이블 생성
CREATE TABLE IF NOT EXISTS devices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    hive_id INT NOT NULL,
    type_id INT NOT NULL,
    modem_ip VARCHAR(255),
    name VARCHAR(255),
    UNIQUE KEY unique_device (hive_id, type_id, name)
);

-- DEVICE_TYPES 테이블 생성 및 초기 데이터 삽입
CREATE TABLE IF NOT EXISTS device_types (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255)
);

INSERT INTO device_types (id, name) VALUES
    (1, 'CAMERA'),
    (2, 'SENSOR'),
    (3, 'INOUT')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- ACCOUNTS 테이블 생성 및 초기 데이터 삽입
CREATE TABLE IF NOT EXISTS accounts (
    id VARCHAR(255) NOT NULL PRIMARY KEY,
    pw VARCHAR(64) NOT NULL,
    grade INT NOT NULL
);

INSERT INTO accounts (id, pw, grade) VALUES
    ('admin', 'A6xnQhbz4Vx2HuGl4lXwZ5U2I8iziLRFnhP5eNfIRvQ=', 1)
ON DUPLICATE KEY UPDATE pw = VALUES(pw), grade = VALUES(grade);

-- 제약조건 및 인덱스 설정
ALTER TABLE inout_data
    ADD CONSTRAINT fk_inout_device FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE;

ALTER TABLE sensor_data
    ADD CONSTRAINT fk_sensor_device FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE;

ALTER TABLE camera_data
    ADD CONSTRAINT fk_camera_device FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE;

ALTER TABLE hives
    ADD CONSTRAINT fk_hives_area FOREIGN KEY (area_id) REFERENCES areas(id);

ALTER TABLE devices
    ADD CONSTRAINT fk_devices_hive FOREIGN KEY (hive_id) REFERENCES hives(id),
    ADD CONSTRAINT fk_devices_type FOREIGN KEY (type_id) REFERENCES device_types(id);
