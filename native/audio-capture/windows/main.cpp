// Captures all system audio EXCEPT the process tree rooted at a given PID
// and writes raw PCM (48 kHz, 16-bit, stereo) to stdout.
//
// Usage:  audio-capture.exe <pid>
// Stop:   write any byte to stdin, or just close stdin.
//
// Requires Windows 10 build 20348+.

#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif

#include <windows.h>
#include <mmdeviceapi.h>
#include <audioclient.h>
#include <audioclientactivationparams.h>
#include <combaseapi.h>
#include <fcntl.h>
#include <io.h>
#include <stdio.h>
#include <stdlib.h>

#pragma comment(lib, "ole32.lib")
#pragma comment(lib, "mmdevapi.lib")

// Minimal IActivateAudioInterfaceCompletionHandler --------------------------

static HANDLE g_activateEvent = nullptr;
static HRESULT g_activateHr = E_FAIL;
static IAudioClient *g_audioClient = nullptr;

struct ActivateHandler : public IActivateAudioInterfaceCompletionHandler {
    LONG refCount = 1;

    ULONG STDMETHODCALLTYPE AddRef() override { return InterlockedIncrement(&refCount); }
    ULONG STDMETHODCALLTYPE Release() override {
        LONG r = InterlockedDecrement(&refCount);
        if (r == 0) delete this;
        return r;
    }
    HRESULT STDMETHODCALLTYPE QueryInterface(REFIID riid, void **ppv) override {
        if (riid == __uuidof(IUnknown) || riid == __uuidof(IActivateAudioInterfaceCompletionHandler)) {
            *ppv = static_cast<IActivateAudioInterfaceCompletionHandler *>(this);
            AddRef();
            return S_OK;
        }
        *ppv = nullptr;
        return E_NOINTERFACE;
    }

    HRESULT STDMETHODCALLTYPE ActivateCompleted(IActivateAudioInterfaceAsyncOperation *op) override {
        HRESULT hrActivate = E_FAIL;
        IUnknown *pUnk = nullptr;
        HRESULT hr = op->GetActivateResult(&hrActivate, &pUnk);
        if (SUCCEEDED(hr) && SUCCEEDED(hrActivate) && pUnk) {
            pUnk->QueryInterface(__uuidof(IAudioClient), reinterpret_cast<void **>(&g_audioClient));
        }
        g_activateHr = SUCCEEDED(hr) ? hrActivate : hr;
        SetEvent(g_activateEvent);
        return S_OK;
    }
};

// Stdin watcher — signals an event when any input arrives ----------------------

static HANDLE g_stopEvent = nullptr;

static DWORD WINAPI stdinWatcher(LPVOID) {
    char buf[16];
    // Blocks until stdin receives data or is closed
    DWORD bytesRead = 0;
    ReadFile(GetStdHandle(STD_INPUT_HANDLE), buf, sizeof(buf), &bytesRead, nullptr);
    SetEvent(g_stopEvent);
    return 0;
}

// Main -----------------------------------------------------------------------

int wmain(int argc, wchar_t *argv[]) {
    if (argc < 2) {
        fprintf(stderr, "Usage: audio-capture.exe <pid>\n");
        return 1;
    }

    DWORD pid = static_cast<DWORD>(_wtoi(argv[1]));
    if (pid == 0) {
        fprintf(stderr, "Invalid PID\n");
        return 1;
    }

    // Put stdout into binary mode so PCM bytes aren't mangled by text-mode
    _setmode(_fileno(stdout), _O_BINARY);

    HRESULT hr = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
    if (FAILED(hr)) return 1;

    g_activateEvent = CreateEventW(nullptr, FALSE, FALSE, nullptr);
    g_stopEvent = CreateEventW(nullptr, TRUE, FALSE, nullptr);

    // Activate a process-loopback audio client that EXCLUDES our target PID
    AUDIOCLIENT_ACTIVATION_PARAMS acParams = {};
    acParams.ActivationType = AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK;
    acParams.ProcessLoopbackParams.ProcessLoopbackMode =
        PROCESS_LOOPBACK_MODE_EXCLUDE_TARGET_PROCESS_TREE;
    acParams.ProcessLoopbackParams.TargetProcessId = pid;

    PROPVARIANT pv = {};
    pv.vt = VT_BLOB;
    pv.blob.cbSize = sizeof(acParams);
    pv.blob.pBlobData = reinterpret_cast<BYTE *>(&acParams);

    auto *handler = new ActivateHandler();
    IActivateAudioInterfaceAsyncOperation *asyncOp = nullptr;
    hr = ActivateAudioInterfaceAsync(
        VIRTUAL_AUDIO_DEVICE_PROCESS_LOOPBACK,
        __uuidof(IAudioClient),
        &pv, handler, &asyncOp);
    if (FAILED(hr)) {
        fprintf(stderr, "ActivateAudioInterfaceAsync failed: 0x%08lx\n", hr);
        return 1;
    }
    WaitForSingleObject(g_activateEvent, INFINITE);
    if (asyncOp) asyncOp->Release();
    handler->Release();

    if (FAILED(g_activateHr) || !g_audioClient) {
        fprintf(stderr, "Audio activation failed: 0x%08lx\n", g_activateHr);
        return 1;
    }

    // Configure capture: 48 kHz, 16-bit, stereo
    WAVEFORMATEX fmt = {};
    fmt.wFormatTag = WAVE_FORMAT_PCM;
    fmt.nChannels = 2;
    fmt.nSamplesPerSec = 48000;
    fmt.wBitsPerSample = 16;
    fmt.nBlockAlign = fmt.nChannels * fmt.wBitsPerSample / 8;
    fmt.nAvgBytesPerSec = fmt.nSamplesPerSec * fmt.nBlockAlign;

    hr = g_audioClient->Initialize(
        AUDCLNT_SHAREMODE_SHARED,
        AUDCLNT_STREAMFLAGS_LOOPBACK | AUDCLNT_STREAMFLAGS_EVENTCALLBACK |
            AUDCLNT_STREAMFLAGS_AUTOCONVERTPCM | AUDCLNT_STREAMFLAGS_SRC_DEFAULT_QUALITY,
        0, 0, &fmt, nullptr);
    if (FAILED(hr)) {
        fprintf(stderr, "AudioClient::Initialize failed: 0x%08lx\n", hr);
        return 1;
    }

    HANDLE bufferEvent = CreateEventW(nullptr, FALSE, FALSE, nullptr);
    g_audioClient->SetEventHandle(bufferEvent);

    IAudioCaptureClient *captureClient = nullptr;
    hr = g_audioClient->GetService(__uuidof(IAudioCaptureClient),
                                   reinterpret_cast<void **>(&captureClient));
    if (FAILED(hr)) {
        fprintf(stderr, "GetService(IAudioCaptureClient) failed: 0x%08lx\n", hr);
        return 1;
    }

    // Spawn a thread to watch stdin for the stop signal
    CreateThread(nullptr, 0, stdinWatcher, nullptr, 0, nullptr);

    g_audioClient->Start();

    // Capture loop
    HANDLE waits[] = {bufferEvent, g_stopEvent};
    bool running = true;
    while (running) {
        DWORD waitResult = WaitForMultipleObjects(2, waits, FALSE, 2000);
        if (waitResult == WAIT_OBJECT_0 + 1) {
            // Stop signal
            break;
        }

        UINT32 packetLength = 0;
        while (SUCCEEDED(captureClient->GetNextPacketSize(&packetLength)) && packetLength > 0) {
            BYTE *data = nullptr;
            UINT32 framesAvailable = 0;
            DWORD flags = 0;
            hr = captureClient->GetBuffer(&data, &framesAvailable, &flags, nullptr, nullptr);
            if (FAILED(hr)) break;

            DWORD bytes = framesAvailable * fmt.nBlockAlign;
            if (flags & AUDCLNT_BUFFERFLAGS_SILENT) {
                // Write silence
                static const BYTE silence[4096] = {};
                DWORD remaining = bytes;
                while (remaining > 0) {
                    DWORD chunk = remaining < sizeof(silence) ? remaining : sizeof(silence);
                    fwrite(silence, 1, chunk, stdout);
                    remaining -= chunk;
                }
            } else {
                fwrite(data, 1, bytes, stdout);
            }
            fflush(stdout);

            captureClient->ReleaseBuffer(framesAvailable);
        }
    }

    g_audioClient->Stop();
    captureClient->Release();
    g_audioClient->Release();
    CloseHandle(bufferEvent);
    CloseHandle(g_activateEvent);
    CloseHandle(g_stopEvent);
    CoUninitialize();
    return 0;
}
