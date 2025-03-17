# Phần mềm điều khiển màn hình LED dự án OMO

## Mô Tả
Server điều khiển chế độ màn hình, lưu ảnh, hỗ trợ giảng dạy trong phòng học tích hợp OMO. 

## Cài Đặt
Nodejs, npm, OPS, OPS api

## Cấu Trúc Dự Án
screenshots --> Lưu ảnh theo ngày
app.js source chính

## API
1. Chọn chế độ hiển thị
- Chế độ 1 khung hình
    ```
    {
        url: http://ip:9988/switch-scene
        data:
            {
                "sceneName": "D1"
            }
    }
    ```

- Chế độ chia 4 khung hình
    ```
    {
        url: http://ip:9988/switch-scene
        data:
            {
                "sceneName": "mode 4 view"
            }
    }
    ```

- Bấm nút lưu ảnh ở màn hình hiện tại:
   ``` 
   {
        url: http://ip:9988/capture
        data:
            {
               "slideName": "k1 || k2 || k3 || k4"
            }
    }
    ```

- Chuyển màn hình chế độ 4 view:
    ```
    {
        url: http://ip:9988/setSourceTransform-and-capture
        data:
           {
                "sourceName": "Video Capture Device",
                <!-- Thông số khung muốn chuyển đến -->
                "positionX": 0,
                "positionY": 0,
                "scaleX": 0.75,  <!-- Mặc định -->
                "scaleY": 0.75  <!-- Mặc định -->
            }
    }
    ```

- Chuyển màn hình và lưu ảnh trong chế độ 4 view:
   ``` 
   {
        url: http://ip:9988/setSourceTransform-and-capture
        data:
           {
                "currenSlideName": "k4 || k3 || k2 || k1", <!-- khung hiện tại -->
                "sourceName": "Video Capture Device",
                <!-- Thông số khung muốn chuyển đến -->
                "positionX": 0,
                "positionY": 0,
                "scaleX": 0.75,  <!-- Mặc định -->
                "scaleY": 0.75  <!-- Mặc định -->
            }
    }
    ```

- Thông số chia bảng:

# Danh sách khung và vị trí

| Tên khung | Ký hiệu | positionX | positionY |
|----------|--------|-----------|-----------|
| Khung 1  | K1     | 0         | 0         |
| Khung 2  | K2     | 960       | 0         |
| Khung 3  | K3     | 0         | 540       |
| Khung 4  | K4     | 960       | 540       |



## Tác Giả & Liên Hệ
Minh Trương: minh.tv@cetech.com.vn

