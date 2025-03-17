const { timeStamp } = require("console");
const express = require("express");
const OBSWebSocket = require("obs-websocket-js").OBSWebSocket;
const fs = require("fs");
const path = require("path");

const app = express();
const port = 9988;
const obs = new OBSWebSocket();

// Config
const OBS_URL = "ws://localhost:4455";
const OBS_PASSWORD = "123456";
const SCENE_SOURCE = "D1";
const VideoCaptureDevice = "Video Capture Device";
const sessionClass = "sessionGeneral";

// Middleware để parse JSON
app.use(express.json());
app.use('/screenshots', express.static(path.join(__dirname, 'screenshots')));


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

// Hàm chụp ảnh
async function captureImage(slideName) {
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

        const today = new Date();
        const dayFolder = `${today.getFullYear()}_${(today.getMonth() + 1).toString().padStart(2, "0")}_${today.getDate().toString().padStart(2, "0")}`;
        const formattedTime = `${dayFolder}_${today.getHours().toString().padStart(2, '0')}_${today.getMinutes().toString().padStart(2, '0')}_${today.getSeconds().toString().padStart(2, '0')}_${(today.getMilliseconds() % 100).toString().padStart(2, '0')}`;

        const screenshotDir = path.join(__dirname, "screenshots", dayFolder);

        if (!fs.existsSync(screenshotDir)) {
            fs.mkdirSync(screenshotDir, { recursive: true });
        }

        const screenshotPath = path.join(screenshotDir, `${slideName}_${formattedTime}.png`);

        const base64Data = response.imageData.replace(/^data:image\/png;base64,/, "");
        fs.writeFileSync(screenshotPath, Buffer.from(base64Data, "base64"));

        const fileUrl = `http://localhost:9988/screenshots/${dayFolder}/${slideName}_${formattedTime}.png`;

        console.log(fileUrl)

        // Cập nhật URL của Browser Source với ảnh vừa chụp
        await obs.call("SetInputSettings", {
            inputName: slideName,
            inputSettings: { url: fileUrl, width: 1920, height: 1080 },
            overlay: false
        });

    } catch (error) {
        console.error(error);
    }
}


// Hàm bật Full Screen Projector trên màn hình thứ 2
let isProjectorEnabled = false; // Theo dõi trạng thái projector

async function enableFullScreenProjector() {
    if (!isProjectorEnabled) {
        return;
    }
    try {
        const videoMixType = 'OBS_WEBSOCKET_VIDEO_MIX_TYPE_PREVIEW';
        const monitorIndex = 1; // Chọn màn hình thứ 2 (có thể thay đổi)

        // Mở projector mới
        await obs.call('OpenVideoMixProjector', {
            videoMixType: videoMixType,
            monitorIndex: monitorIndex
        });

        console.log(`Full Screen Projector enabled on monitor ${monitorIndex}`);
        isProjectorEnabled = true;

    } catch (error) {
        console.error('Failed to enable Full Screen Projector:', error.message);
    }
}

// Hàm start vitual camera
async function startVirtualCamera() {
    try {
        if (!obs || !obs.identified) {
            console.error("OBS WebSocket is not connected.");
            return;
        }

        // Kiểm tra trạng thái Virtual Camera
        const response = await obs.call('GetVirtualCamStatus');

        if (response.outputActive) {
            console.log("Virtual Camera is already running.");
        } else {
            // Nếu chưa bật, bật Virtual Camera
            await obs.call('StartVirtualCam');
            console.log("Virtual Camera started.");
        }
    } catch (error) {
        console.error("Failed to start Virtual Camera:", error.message);
    }
}

// Hàm start vitual camera
async function stopVirtualCamera() {
    try {
        await obs.call('StopVirtualCam');
        console.log({ status: 'success', message: 'Virtual Camera stopped!' });
    } catch (error) {
        console.log(error);
    }
}

// Hàm ẩn hoặc hiện source theo tên
async function setSourceTransform(sourceName, positionX, positionY, scaleX, scaleY) {
    try {
        await obs.call('SetSceneItemTransform', {
            sceneName: 'mode 4 view', // Thay bằng tên Scene nếu cần
            sceneItemId: await getSourceId(sourceName),
            sceneItemTransform: {
                positionX: positionX,
                positionY: positionY,
                scaleX: scaleX,
                scaleY: scaleY
            }
        });
        console.log({ status: 'success', message: `Updated transform for ${sourceName}` });
    } catch (error) {
        console.log(error);
    }
}

async function getSourceId(sourceName) {
    try {
        const response = await obs.call('GetSceneItemId', {
            sceneName: 'mode 4 view', // Thay bằng tên Scene nếu cần
            sourceName: sourceName
        });
        return response.sceneItemId;
    } catch (error) {
        console.log(error);
    }
}


// API : /////////

// Đẩy ảnh lên LED
app.post("/capture", async(req, res) => {
    const { slideName, sourceName } = req.body;
    await captureImage(slideName);
    console.log("Capture source");
    res.send("Updated source");
});

// API: Bật Virtual Camera
app.get('/start-virtual-camera', async(req, res) => {
    await startVirtualCamera();
    res.send("ok start")
});

// API: Dừng Virtual Camera
app.get('/stop-virtual-camera', async(req, res) => {
    await stopVirtualCamera();
    res.send("ok stop")
});

// Chuyển đổi giữa các scenes
app.post('/switch-scene', async(req, res) => {
    const { sceneName } = req.body;
    if (!sceneName) {
        return res.status(400).json({ status: 'error', message: 'Missing sceneName' });
    }
    try {
        await obs.call('SetCurrentProgramScene', { sceneName });
        res.json({ status: 'success', message: `Switched to scene: ${sceneName}` });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.post('/openProjecter', async(req, res) => {
    await enableFullScreenProjector();
    res.json("openProjecter");
});

app.post('/setSourceTransform', async(req, res) => {
    const { sourceName, positionX, positionY, scaleX, scaleY } = req.body;
    await setSourceTransform(sourceName, positionX, positionY, scaleX, scaleY);
    res.json("setSourceTransform");
});

app.post('/getSourceId', async(req, res) => {
    const { sourceName } = req.body;
    const data = await getSourceId(sourceName);
    res.json(data);
});

app.post('/setSourceTransform-and-capture', async(req, res) => {
    const { currenSlideName, sourceName, positionX, positionY, scaleX, scaleY } = req.body;
    await captureImage(currenSlideName);
    console.log("captureImage");
    setTimeout(async() => {
        await setSourceTransform(sourceName, positionX, positionY, scaleX, scaleY);
        console.log("setSourceTransform");
    }, 300);

    res.json("setSourceTransform-and-capture");
})


app.listen(port, async() => {
    await connectOBS();
    await selectScene();
    setTimeout(async() => {
        await startVirtualCamera();
        console.log("startVirtualCamera");
    }, 200);
    setTimeout(async() => {
        await enableFullScreenProjector();
        console.log("enableFullScreenProjector");
    }, 1000);
    console.log(`Server running on http://localhost:${port}`);
});