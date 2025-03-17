const express = require("express");
const OBSWebSocket = require("obs-websocket-js").OBSWebSocket;
const fs = require("fs");
const path = require("path");

const app = express();
const port = 3000;
const obs = new OBSWebSocket();
const OBS_URL = "ws://localhost:4455";
const OBS_PASSWORD = "123456";
const SCENE_SOURCE = "D1";
const SCENE_TARGET = "D2";
const VideoCaptureDevice = "Video Capture Device";

// Middleware để parse JSON
app.use(express.json());

// Set default 
// nếu một màn hình
const resolution = {
    re1: [4608, 2590],
    re2: [{
            x: 10,
            y: 300,
            w: 2265,
            h: 1269
        },
        {
            x: 2285,
            y: 300,
            w: 2265,
            h: 1269
        }
    ],
    re3: [{
            w: 2265,
            h: 1269
        },
        {
            w: 2265,
            h: 1269
        },
        {
            w: 2265,
            h: 1269
        }
    ],
    re4: [1920, 1080, 1920, 1080, 1920, 1080, 1920, 1080],
    re5: [1920, 1080, 1920, 1080, 1920, 1080, 1920, 1080, 1920, 1080],
    re6: [1920, 1080, 1920, 1080, 1920, 1080, 1920, 1080, 1920, 1080, 1920, 1080],
    re7: [1920, 1080, 1920, 1080, 1920, 1080, 1920, 1080, 1920, 1080, 1920, 1080, 1920, 1080],
    re8: [1920, 1080, 1920, 1080, 1920, 1080, 1920, 1080, 1920, 1080, 1920, 1080, 1920, 1080, 1920, 1080],
    re9: [1920, 1080, 1920, 1080, 1920, 1080, 1920, 1080, 1920, 1080, 1920, 1080, 1920, 1080, 1920, 1080, 1920, 1080],
};


// Hàm kết nối OBS
async function connectOBS() {
    try {
        await obs.connect(OBS_URL, OBS_PASSWORD);
        console.log("Connected to OBS WebSocket");
    } catch (error) {
        console.error("Failed to connect to OBS:", error);
    }
}

//Luôn chọn D1 để chụp ảnh
async function selectScene(sceneName = "D1") {
    try {
        await obs.call("SetCurrentProgramScene", {
            sceneName: sceneName
        });
        console.log(`Switched to scene: ${sceneName}`);
    } catch (error) {
        console.error(`Error switching to scene ${sceneName}:`, error);
    }
}

// Hàm chụp ảnh và cập nhật URL nếu nguồn đã tồn tại
async function captureAndUpdateSource(slideName) {
    slideName = slideName || "slide"
    try {
        // Chụp ảnh màn hình từ scene D1
        const response = await obs.call("GetSourceScreenshot", {
            sceneName: SCENE_SOURCE,
            sourceName: VideoCaptureDevice,
            imageFormat: "png",
            imageWidth: 1920,
            imageHeight: 1080,
        });

        const screenshotDir = path.join(__dirname, "screenshots");
        const screenshotPath = path.join(screenshotDir, `${slideName}.png`);

        if (!fs.existsSync(screenshotDir)) {
            fs.mkdirSync(screenshotDir, { recursive: true });
        }

        const base64Data = response.imageData.replace(/^data:image\/png;base64,/, "");
        fs.writeFileSync(screenshotPath, Buffer.from(base64Data, "base64"));

        // Kiểm tra xem nguồn có tồn tại không
        const { sceneItems } = await obs.call("GetSceneItemList", { sceneName: SCENE_TARGET });
        const existingSource = sceneItems.find(item => item.sourceName === slideName);

        if (existingSource) {
            // Cập nhật ảnh mới vào browser_source đã có
            await obs.call("SetInputSettings", {
                inputName: slideName,
                inputSettings: { local_file: screenshotPath },
                overlay: true,
            });
            console.log("Updated existing image source!");

        } else {
            console.log("Source not found, creating a new one...");
            await createSource(screenshotPath, slideName);
        }
    } catch (error) {
        console.error("Error updating source:", error);
    }
}

// Hàm tạo nguồn mới
async function createSource(dataUri, slideName, x, y, w, h) {
    try {
        x = x || 0;
        y = y || 0;
        w = w || "1920";
        h = h || "1080";

        await obs.call("CreateInput", {
            sceneName: SCENE_TARGET,
            inputName: slideName,
            inputKind: "browser_source",
            inputSettings: {
                url: dataUri,
                width: 1920,
                height: 1080,
            },
            sceneItemEnabled: true,
        });
        // điều chỉnh vị trí
        const { sceneItems } = await obs.call("GetSceneItemList", { sceneName: SCENE_TARGET });
        const newItem = sceneItems.find(item => item.sourceName === slideName);

        if (newItem) {
            // Cập nhật vị trí ảnh trong Scene
            await obs.call("SetSceneItemTransform", {
                sceneName: SCENE_TARGET,
                sceneItemId: newItem.sceneItemId,
                sceneItemTransform: {
                    positionX: x,
                    positionY: y,
                },
            });
            console.log(`Image source positioned at (${x}, ${y})`);
        } else {
            console.error("Failed to find the created source in scene.");
        }
    } catch (error) {
        console.error("Error creating source:", error);
    }
}

async function removeAllSourcesFromScene(sceneName) {
    try {
        // Lấy danh sách tất cả các source trong scene
        const response = await obs.call("GetSceneItemList", { sceneName });
        const sceneItems = response.sceneItems;
        if (!sceneItems.length) {
            return;
        }
        // Duyệt qua từng source và xóa nó
        for (const item of sceneItems) {
            await obs.call("RemoveSceneItem", {
                sceneName,
                sceneItemId: item.sceneItemId
            });
            await new Promise(resolve => setTimeout(resolve, 100)); // Tránh spam lệnh
        }
    } catch (error) {
        console.error(error);
    }
}

app.post("/view", async(req, res) => {
    const screenshotDir = path.join(__dirname, "screenshots");
    try {
        if (!fs.existsSync(screenshotDir)) {
            fs.mkdirSync(screenshotDir, { recursive: true });
        }
        await removeAllSourcesFromScene("D2"); // Đảm bảo xóa xong trước khi tạo mới

        let { slideName } = req.body;

        if (!slideName) {
            return res.status(400).send("slideName không được để trống.");
        }

        // Đảm bảo slideName là mảng
        if (!Array.isArray(slideName)) {
            slideName = [slideName];
        }

        // Tạo source cho từng slide
        await Promise.all(
            slideName.map(slide => {
                const screenshotPath = path.join(screenshotDir, `${slide}.png`);
                return createSource(screenshotPath, slide);
            })
        );

        res.send("Thành công!");
    } catch (error) {
        res.status(500).send("Lỗi máy chủ.");
    }
});

app.post("/capture", async(req, res) => {
    const { slideName } = req.body;
    await captureAndUpdateSource(slideName);
    res.send("Captured and updated source");
});

app.post("/test", async(req, res) => {
    console.log(req.body)
    res.send(req.body);
});

app.listen(port, async() => {
    await connectOBS();
    await selectScene
    console.log(`Server running on http://localhost:${port}`);
});