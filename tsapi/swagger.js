const swaggerAutogen = require("swagger-autogen")();

const doc = {
    info: {
        title: "REST API",
        description: "BeeWeb backend API (sensors, pictures, exports)",
        version: "1.0.0",
    },
    host: "localhost:8090",
    basePath: "/",
    schemes: ["http"],
    tags: [
        { name: "Legacy", description: "Legacy-compatible endpoints" },
        { name: "Device", description: "Device CRUD" },
        { name: "Hive", description: "Hive CRUD" },
        { name: "Area", description: "Area CRUD" },
        { name: "User", description: "User authentication" },
        { name: "Sensor2", description: "Sensor data (new)" },
        { name: "Picture", description: "Picture upload & query" },
        { name: "Export", description: "Export jobs" },
    ],
    definitions: {
        ExportSensorRequest: {
            deviceIds: [1, 2],
            dataTypes: [2, 3, 4],
            sTime: "2025-01-01T00:00:00Z",
            eTime: "2025-01-02T00:00:00Z",
        },
        ExportPictureRequest: {
            deviceIds: [1, 2],
            sTime: "2025-01-01T00:00:00Z",
            eTime: "2025-01-02T00:00:00Z",
        },
        ExportMixedRequest: {
            deviceIds: [1, 2],
            dataTypes: [1, 2, 3, 4], // 1=picture, others=sensor
            sTime: "2025-01-01T00:00:00Z",
            eTime: "2025-01-02T00:00:00Z",
        },
        PictureUploadJson: {
            data: [
                {
                    device_id: 1,
                    time: "2025-11-30T09:00:00Z",
                    picture: "<base64>",
                },
            ],
        },
    },
};

const outputFile = "./swagger.json";
const endpointsFiles = ["./src/server.ts"];

swaggerAutogen(outputFile, endpointsFiles, doc).then(() => {
    console.log("Swagger documentation has been generated");
});
