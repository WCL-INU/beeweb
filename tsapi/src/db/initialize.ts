// initialize.ts
import { pool } from './index';
import { initSummary } from './summary';

async function addConstraintIfNotExists(table: string, constraintName: string, sql: string) {
  const [rows] = await pool.query(
    `SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_NAME = ? AND CONSTRAINT_NAME = ?`,
    [table, constraintName]
  );
  if ((rows as any[]).length === 0) {
    await pool.execute(sql);
  }
}

export const initializeDatabase = async () => {
  try {
    await pool.execute(`CREATE DATABASE IF NOT EXISTS hive_data`);
    await pool.execute(`USE hive_data`);

    await pool.execute(`CREATE TABLE IF NOT EXISTS inout_data (
      id INT AUTO_INCREMENT PRIMARY KEY,
      device_id INT NOT NULL,
      in_field INT,
      out_field INT,
      time DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_device_time (device_id, time)
    )`);

    await pool.execute(`CREATE TABLE IF NOT EXISTS sensor_data (
      id INT AUTO_INCREMENT PRIMARY KEY,
      device_id INT NOT NULL,
      temp FLOAT,
      humi FLOAT,
      co2 FLOAT,
      weigh FLOAT,
      time DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_device_time (device_id, time)
    )`);

    await pool.execute(`CREATE TABLE IF NOT EXISTS camera_data (
      id INT AUTO_INCREMENT PRIMARY KEY,
      device_id INT NOT NULL,
      picture LONGBLOB,
      time DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_device_time (device_id, time)
    )`);

    await pool.execute(`CREATE TABLE IF NOT EXISTS data_types (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      UNIQUE KEY unique_name (name)
    )`);
    await pool.query(`INSERT INTO data_types (id, name) VALUES
      (1, 'PICUTRE'), (2, 'IN'), (3, 'OUT'), (4, 'TEMP'), (5, 'HUMI'), (6, 'CO2'), (7, 'WEIGH')
      ON DUPLICATE KEY UPDATE name = VALUES(name)`);

    await pool.execute(`CREATE TABLE IF NOT EXISTS sensor_data2 (
      id INT AUTO_INCREMENT PRIMARY KEY,
      device_id INT NOT NULL,
      data_int INT,
      data_float FLOAT,
      data_type INT,
      time DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_device_time (device_id, data_type, time)
    )`);

    await pool.execute(`CREATE TABLE IF NOT EXISTS picutre_data (
      id INT AUTO_INCREMENT PRIMARY KEY,
      device_id INT NOT NULL,
      picture LONGBLOB,
      time DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_device_time (device_id, time)
    )`);

    await pool.execute(`CREATE TABLE IF NOT EXISTS hives (
      id INT AUTO_INCREMENT PRIMARY KEY,
      area_id INT NOT NULL,
      name VARCHAR(255),
      UNIQUE KEY unique_hive (area_id, name)
    )`);

    await pool.execute(`CREATE TABLE IF NOT EXISTS areas (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255),
      location VARCHAR(255)
    )`);
    await pool.query(`INSERT INTO areas (id, name, location) VALUES
      (1, '인천대', '37.375, 126.633'),
      (2, '안동대', '36.544, 128.8007'),
      (3, '농과원', '0.0, 0.0')
      ON DUPLICATE KEY UPDATE name = VALUES(name)`);

    await pool.execute(`CREATE TABLE IF NOT EXISTS device_types (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255)
    )`);
    await pool.query(`INSERT INTO device_types (id, name) VALUES
      (1, 'CAMERA'), (2, 'SENSOR'), (3, 'INOUT')
      ON DUPLICATE KEY UPDATE name = VALUES(name)`);

    await pool.execute(`CREATE TABLE IF NOT EXISTS devices (
      id INT AUTO_INCREMENT PRIMARY KEY,
      hive_id INT NOT NULL,
      type_id INT NOT NULL,
      modem_ip VARCHAR(255),
      name VARCHAR(255),
      UNIQUE KEY unique_device (hive_id, type_id, name)
    )`);

    await pool.execute(`CREATE TABLE IF NOT EXISTS accounts (
      id VARCHAR(255) NOT NULL PRIMARY KEY,
      pw VARCHAR(64) NOT NULL,
      grade INT NOT NULL
    )`);
    await pool.query(`INSERT INTO accounts (id, pw, grade) VALUES
      ('admin', 'A6xnQhbz4Vx2HuGl4lXwZ5U2I8iziLRFnhP5eNfIRvQ=', 1)
      ON DUPLICATE KEY UPDATE pw = VALUES(pw), grade = VALUES(grade)`);

    await addConstraintIfNotExists('inout_data', 'fk_inout_device', `ALTER TABLE inout_data ADD CONSTRAINT fk_inout_device FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE`);
    await addConstraintIfNotExists('sensor_data', 'fk_sensor_device', `ALTER TABLE sensor_data ADD CONSTRAINT fk_sensor_device FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE`);
    await addConstraintIfNotExists('camera_data', 'fk_camera_device', `ALTER TABLE camera_data ADD CONSTRAINT fk_camera_device FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE`);
    await addConstraintIfNotExists('sensor_data2', 'fk_sensor2_device', `ALTER TABLE sensor_data2 ADD CONSTRAINT fk_sensor2_device FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE`);
    await addConstraintIfNotExists('sensor_data2', 'fk_sensor2_data_type', `ALTER TABLE sensor_data2 ADD CONSTRAINT fk_sensor2_data_type FOREIGN KEY (data_type) REFERENCES data_types(id) ON DELETE CASCADE`);
    await addConstraintIfNotExists('picutre_data', 'fk_picutre_device', `ALTER TABLE picutre_data ADD CONSTRAINT fk_picutre_device FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE`);
    await addConstraintIfNotExists('hives', 'fk_hives_area', `ALTER TABLE hives ADD CONSTRAINT fk_hives_area FOREIGN KEY (area_id) REFERENCES areas(id)`);
    await addConstraintIfNotExists('devices', 'fk_devices_hive', `ALTER TABLE devices ADD CONSTRAINT fk_devices_hive FOREIGN KEY (hive_id) REFERENCES hives(id)`);
    await addConstraintIfNotExists('devices', 'fk_devices_type', `ALTER TABLE devices ADD CONSTRAINT fk_devices_type FOREIGN KEY (type_id) REFERENCES device_types(id)`);

    console.log('✅ Database schema and data initialized');

    await initSummary();
    console.log('✅ Summary tables initialized');
  } catch (err) {
    console.error('❌ Failed to initialize database:', err);
    process.exit(1);
  }
};