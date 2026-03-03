// High-FPS screen capture using DXGI Desktop Duplication API.
// Captures frames and writes I420-encoded data to stdout.
//
// Usage:
//   screen-capture.exe <monitor_index> <fps> [width] [height]
//
// Output (binary, per frame):
//   uint32_t  width
//   uint32_t  height
//   int64_t   timestamp_us  (microseconds since capture start)
//   uint8_t[] I420 data     (width*height*3/2 bytes)
//
// Stop: write any byte to stdin, or close stdin.
//
// Requires Windows 10 1803+ (DXGI 1.5 Desktop Duplication).
// Compile with MSVC: cl.exe /EHsc /O2 main.cpp /link d3d11.lib dxgi.lib

#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#ifndef NTDDI_VERSION
#define NTDDI_VERSION 0x0A000000
#endif
#ifndef WINVER
#define WINVER 0x0A00
#endif
#ifndef _WIN32_WINNT
#define _WIN32_WINNT 0x0A00
#endif

#include <windows.h>
#include <d3d11.h>
#include <dxgi1_2.h>
#include <fcntl.h>
#include <io.h>
#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <string.h>

#ifdef _MSC_VER
#pragma comment(lib, "d3d11.lib")
#pragma comment(lib, "dxgi.lib")
#endif

// ── Stop signal ────────────────────────────────────────────────────────

static HANDLE g_stopEvent = nullptr;

static DWORD WINAPI stdinWatcher(LPVOID) {
    char buf[16];
    DWORD bytesRead = 0;
    ReadFile(GetStdHandle(STD_INPUT_HANDLE), buf, sizeof(buf), &bytesRead, nullptr);
    SetEvent(g_stopEvent);
    return 0;
}

// ── BGRA → I420 conversion (BT.601) ───────────────────────────────────

static void bgraToI420(
    const uint8_t* bgra, uint32_t stride,
    uint8_t* yPlane, uint8_t* uPlane, uint8_t* vPlane,
    uint32_t width, uint32_t height
) {
    const uint32_t halfW = width / 2;

    for (uint32_t y = 0; y < height; y++) {
        const uint8_t* row = bgra + y * stride;
        uint8_t* yRow = yPlane + y * width;

        for (uint32_t x = 0; x < width; x++) {
            uint32_t b = row[x * 4 + 0];
            uint32_t g = row[x * 4 + 1];
            uint32_t r = row[x * 4 + 2];
            yRow[x] = static_cast<uint8_t>(((66 * r + 129 * g + 25 * b + 128) >> 8) + 16);
        }

        if ((y & 1) == 0) {
            const uint8_t* rowNext = (y + 1 < height) ? bgra + (y + 1) * stride : row;
            uint8_t* uRow = uPlane + (y / 2) * halfW;
            uint8_t* vRow = vPlane + (y / 2) * halfW;

            for (uint32_t x = 0; x < halfW; x++) {
                uint32_t x2 = x * 2;
                uint32_t b = (row[x2 * 4 + 0] + row[(x2 + 1) * 4 + 0] +
                              rowNext[x2 * 4 + 0] + rowNext[(x2 + 1) * 4 + 0] + 2) >> 2;
                uint32_t g = (row[x2 * 4 + 1] + row[(x2 + 1) * 4 + 1] +
                              rowNext[x2 * 4 + 1] + rowNext[(x2 + 1) * 4 + 1] + 2) >> 2;
                uint32_t r = (row[x2 * 4 + 2] + row[(x2 + 1) * 4 + 2] +
                              rowNext[x2 * 4 + 2] + rowNext[(x2 + 1) * 4 + 2] + 2) >> 2;

                int32_t uVal = ((-38 * (int32_t)r - 74 * (int32_t)g + 112 * (int32_t)b + 128) >> 8) + 128;
                int32_t vVal = ((112 * (int32_t)r - 94 * (int32_t)g - 18 * (int32_t)b + 128) >> 8) + 128;
                uRow[x] = static_cast<uint8_t>(uVal < 0 ? 0 : (uVal > 255 ? 255 : uVal));
                vRow[x] = static_cast<uint8_t>(vVal < 0 ? 0 : (vVal > 255 ? 255 : vVal));
            }
        }
    }
}

// ── Main ───────────────────────────────────────────────────────────────

int wmain(int argc, wchar_t* argv[]) {
    if (argc < 3) {
        fprintf(stderr, "Usage: screen-capture.exe <monitor_index> <fps> [max_width] [max_height]\n");
        return 1;
    }

    int monitorIndex = _wtoi(argv[1]);
    int targetFps = _wtoi(argv[2]);
    uint32_t maxWidth = argc > 3 ? (uint32_t)_wtoi(argv[3]) : 0;
    uint32_t maxHeight = argc > 4 ? (uint32_t)_wtoi(argv[4]) : 0;

    if (targetFps < 1) targetFps = 30;
    if (targetFps > 500) targetFps = 500;

    fprintf(stderr, "[screen-capture] monitor=%d fps=%d maxRes=%ux%u\n",
            monitorIndex, targetFps, maxWidth, maxHeight);

    _setmode(_fileno(stdout), _O_BINARY);
    g_stopEvent = CreateEventW(nullptr, TRUE, FALSE, nullptr);

    // ── Create D3D11 device ──────────────────────────────────────────

    ID3D11Device* device = nullptr;
    ID3D11DeviceContext* context = nullptr;
    D3D_FEATURE_LEVEL featureLevel;

    HRESULT hr = D3D11CreateDevice(
        nullptr, D3D_DRIVER_TYPE_HARDWARE, nullptr,
        0, nullptr, 0, D3D11_SDK_VERSION,
        &device, &featureLevel, &context);
    if (FAILED(hr)) {
        fprintf(stderr, "[screen-capture] D3D11CreateDevice failed: 0x%08lx\n", hr);
        return 1;
    }

    // ── Enumerate outputs and find target monitor ────────────────────

    IDXGIDevice* dxgiDevice = nullptr;
    device->QueryInterface(__uuidof(IDXGIDevice), (void**)&dxgiDevice);

    IDXGIAdapter* adapter = nullptr;
    dxgiDevice->GetAdapter(&adapter);

    IDXGIOutput* output = nullptr;
    hr = adapter->EnumOutputs(monitorIndex, &output);
    if (FAILED(hr)) {
        fprintf(stderr, "[screen-capture] monitor index %d not found\n", monitorIndex);
        adapter->Release();
        dxgiDevice->Release();
        context->Release();
        device->Release();
        return 1;
    }

    DXGI_OUTPUT_DESC outputDesc;
    output->GetDesc(&outputDesc);
    uint32_t screenW = outputDesc.DesktopCoordinates.right - outputDesc.DesktopCoordinates.left;
    uint32_t screenH = outputDesc.DesktopCoordinates.bottom - outputDesc.DesktopCoordinates.top;
    fprintf(stderr, "[screen-capture] output: %ls %ux%u\n",
            outputDesc.DeviceName, screenW, screenH);

    IDXGIOutput1* output1 = nullptr;
    output->QueryInterface(__uuidof(IDXGIOutput1), (void**)&output1);
    output->Release();

    // ── Create Desktop Duplication ───────────────────────────────────

    IDXGIOutputDuplication* duplication = nullptr;
    hr = output1->DuplicateOutput(device, &duplication);
    if (FAILED(hr)) {
        fprintf(stderr, "[screen-capture] DuplicateOutput failed: 0x%08lx\n", hr);
        output1->Release();
        adapter->Release();
        dxgiDevice->Release();
        context->Release();
        device->Release();
        return 1;
    }

    DXGI_OUTDUPL_DESC duplDesc;
    duplication->GetDesc(&duplDesc);
    uint32_t captureW = duplDesc.ModeDesc.Width;
    uint32_t captureH = duplDesc.ModeDesc.Height;

    // Apply scaling if max dimensions are set
    uint32_t outW = captureW;
    uint32_t outH = captureH;
    if (maxWidth > 0 && maxHeight > 0 && (captureW > maxWidth || captureH > maxHeight)) {
        float scaleW = (float)maxWidth / captureW;
        float scaleH = (float)maxHeight / captureH;
        float scale = scaleW < scaleH ? scaleW : scaleH;
        outW = ((uint32_t)(captureW * scale)) & ~1u;
        outH = ((uint32_t)(captureH * scale)) & ~1u;
    }
    // Ensure even dimensions for I420
    outW &= ~1u;
    outH &= ~1u;

    fprintf(stderr, "[screen-capture] capture=%ux%u output=%ux%u\n",
            captureW, captureH, outW, outH);

    // ── Create staging texture for CPU readback ──────────────────────

    D3D11_TEXTURE2D_DESC stagingDesc = {};
    stagingDesc.Width = captureW;
    stagingDesc.Height = captureH;
    stagingDesc.MipLevels = 1;
    stagingDesc.ArraySize = 1;
    stagingDesc.Format = DXGI_FORMAT_B8G8R8A8_UNORM;
    stagingDesc.SampleDesc.Count = 1;
    stagingDesc.Usage = D3D11_USAGE_STAGING;
    stagingDesc.CPUAccessFlags = D3D11_CPU_ACCESS_READ;

    ID3D11Texture2D* stagingTexture = nullptr;
    hr = device->CreateTexture2D(&stagingDesc, nullptr, &stagingTexture);
    if (FAILED(hr)) {
        fprintf(stderr, "[screen-capture] CreateTexture2D (staging) failed: 0x%08lx\n", hr);
        duplication->Release();
        output1->Release();
        adapter->Release();
        dxgiDevice->Release();
        context->Release();
        device->Release();
        return 1;
    }

    // ── Allocate I420 output buffer ──────────────────────────────────

    uint32_t i420Size = outW * outH * 3 / 2;
    uint8_t* i420Buf = (uint8_t*)malloc(i420Size);
    if (!i420Buf) {
        fprintf(stderr, "[screen-capture] malloc(%u) failed\n", i420Size);
        return 1;
    }

    // ── Start stdin watcher and capture loop ─────────────────────────

    CreateThread(nullptr, 0, stdinWatcher, nullptr, 0, nullptr);

    LARGE_INTEGER freq, startTime, frameTime;
    QueryPerformanceFrequency(&freq);
    QueryPerformanceCounter(&startTime);

    double frameInterval = 1000.0 / targetFps;
    DWORD frameIntervalMs = (DWORD)(frameInterval);
    if (frameIntervalMs < 1) frameIntervalMs = 1;

    uint64_t framesWritten = 0;
    uint64_t framesFailed = 0;
    DWORD lastStatsTick = GetTickCount();

    fprintf(stderr, "[screen-capture] starting capture loop, interval=%lums\n", frameIntervalMs);

    while (WaitForSingleObject(g_stopEvent, 0) != WAIT_OBJECT_0) {
        DXGI_OUTDUPL_FRAME_INFO frameInfo;
        IDXGIResource* desktopResource = nullptr;

        hr = duplication->AcquireNextFrame(frameIntervalMs, &frameInfo, &desktopResource);

        if (hr == DXGI_ERROR_WAIT_TIMEOUT) {
            continue;
        }
        if (hr == DXGI_ERROR_ACCESS_LOST) {
            fprintf(stderr, "[screen-capture] access lost, stopping\n");
            break;
        }
        if (FAILED(hr)) {
            framesFailed++;
            Sleep(1);
            continue;
        }

        ID3D11Texture2D* desktopTexture = nullptr;
        desktopResource->QueryInterface(__uuidof(ID3D11Texture2D), (void**)&desktopTexture);
        desktopResource->Release();

        context->CopyResource(stagingTexture, desktopTexture);
        desktopTexture->Release();
        duplication->ReleaseFrame();

        D3D11_MAPPED_SUBRESOURCE mapped;
        hr = context->Map(stagingTexture, 0, D3D11_MAP_READ, 0, &mapped);
        if (FAILED(hr)) {
            framesFailed++;
            continue;
        }

        QueryPerformanceCounter(&frameTime);
        int64_t timestampUs = (int64_t)((frameTime.QuadPart - startTime.QuadPart) * 1000000LL / freq.QuadPart);

        uint8_t* yPlane = i420Buf;
        uint8_t* uPlane = i420Buf + outW * outH;
        uint8_t* vPlane = uPlane + (outW / 2) * (outH / 2);

        // For simplicity, convert at capture resolution (no scaling yet).
        // TODO: add GPU-side or CPU-side scaling for resolution downscale.
        bgraToI420((const uint8_t*)mapped.pData, mapped.RowPitch,
                   yPlane, uPlane, vPlane, outW, outH);

        context->Unmap(stagingTexture, 0);

        // Write frame header + I420 data to stdout
        uint32_t w = outW;
        uint32_t h = outH;
        fwrite(&w, sizeof(uint32_t), 1, stdout);
        fwrite(&h, sizeof(uint32_t), 1, stdout);
        fwrite(&timestampUs, sizeof(int64_t), 1, stdout);
        fwrite(i420Buf, 1, i420Size, stdout);
        fflush(stdout);

        framesWritten++;

        // Frame pacing: sleep for remaining time in frame interval
        LARGE_INTEGER now;
        QueryPerformanceCounter(&now);
        double elapsedMs = (double)(now.QuadPart - frameTime.QuadPart) * 1000.0 / freq.QuadPart;
        double sleepMs = frameInterval - elapsedMs;
        if (sleepMs > 1.0) {
            Sleep((DWORD)(sleepMs));
        }

        DWORD nowTick = GetTickCount();
        if (nowTick - lastStatsTick >= 5000) {
            double elapsed = (double)(nowTick - lastStatsTick) / 1000.0;
            fprintf(stderr, "[screen-capture] %llu frames in %.1fs (%.1f fps), %llu failed\n",
                    framesWritten, elapsed, framesWritten / elapsed, framesFailed);
            framesWritten = 0;
            framesFailed = 0;
            lastStatsTick = nowTick;
        }
    }

    fprintf(stderr, "[screen-capture] stopping\n");

    free(i420Buf);
    stagingTexture->Release();
    duplication->Release();
    output1->Release();
    adapter->Release();
    dxgiDevice->Release();
    context->Release();
    device->Release();
    CloseHandle(g_stopEvent);
    return 0;
}
