using System.Collections.Concurrent;
using NAudio.CoreAudioApi;
using NAudio.Dsp;
using NAudio.Wave;

const string Url = "http://127.0.0.1:4179";
var builder = WebApplication.CreateSlimBuilder(args);
builder.WebHost.UseUrls(Url);
builder.Services.AddSingleton<CaptureEngine>();
var app = builder.Build();

app.Use(async (context, next) => {
    var origin = context.Request.Headers.Origin.ToString();
    if (origin is "http://127.0.0.1:4178" or "http://localhost:4178") context.Response.Headers.AccessControlAllowOrigin = origin;
    context.Response.Headers.AccessControlAllowHeaders = "Content-Type";
    context.Response.Headers.AccessControlAllowMethods = "GET,POST,OPTIONS";
    if (context.Request.Method == "OPTIONS") { context.Response.StatusCode = 204; return; }
    await next();
});

app.MapGet("/health", () => Results.Ok(new { ready = true, engine = "WASAPI loopback" }));
app.MapGet("/devices", (CaptureEngine engine) => Results.Ok(engine.GetDevices()));
app.MapGet("/frame", (CaptureEngine engine) => Results.Ok(engine.GetFrame()));
app.MapPost("/capture/start", (StartCapture request, CaptureEngine engine) => {
    try { return Results.Ok(engine.Start(request.DeviceId)); }
    catch (Exception error) { return Results.BadRequest(new { error = error.Message }); }
});
app.MapPost("/capture/stop", (CaptureEngine engine) => { engine.Stop(); return Results.Ok(); });
app.MapPost("/calibration/play", (CalibrationRequest request, CaptureEngine engine) => {
    try { return Results.Ok(engine.PlayCalibration(request)); }
    catch (Exception error) { return Results.BadRequest(new { error = error.Message }); }
});
app.MapPost("/calibration/stop", (CaptureEngine engine) => { engine.StopCalibration(); return Results.Ok(); });
app.MapPost("/recording/start", (RecordingRequest request, CaptureEngine engine) => {
    try { return Results.Ok(engine.StartRecording(request.Name)); }
    catch (Exception error) { return Results.BadRequest(new { error = error.Message }); }
});
app.MapPost("/recording/stop", (CaptureEngine engine) => Results.Ok(engine.StopRecording()));
app.Lifetime.ApplicationStopping.Register(() => app.Services.GetRequiredService<CaptureEngine>().Dispose());
app.Run();

record StartCapture(string DeviceId);
record CalibrationRequest(string DeviceId, int Channel, int Frequency = 500, float GainDb = -24, int DurationMs = 1200);
record RecordingRequest(string Name);
record DeviceInfo(string Id, string Name, int Channels, int SampleRate, int BitsPerSample);
record ChannelLevel(int Index, string Label, float Peak, float Rms);
record CaptureFrame(bool Active, string Source, int Channels, int SampleRate, int BitsPerSample, float Peak, float Rms, float Headroom, float[] Frequency, ChannelLevel[] ChannelLevels, double Elapsed, string Topology, int ActiveChannelCount, float Balance, float Correlation, float StereoWidth);

sealed class CaptureEngine : IDisposable {
    private static readonly string[] Labels = ["FL", "FR", "FC", "LFE", "BL", "BR", "SL", "SR", "OFL", "OFR", "TL", "TR", "BwL", "BwR", "BkL", "BkR"];
    private readonly object sync = new();
    private readonly MMDeviceEnumerator enumerator = new();
    private WasapiLoopbackCapture? capture;
    private MMDevice? device;
    private DateTime started;
    private CaptureFrame frame = EmptyFrame();
    private WasapiOut? calibrationOutput;
    private MMDevice? calibrationDevice;
    private CancellationTokenSource? calibrationStop;
    private WaveFileWriter? recordingWriter;
    private string? recordingPath;

    public DeviceInfo[] GetDevices() => enumerator.EnumerateAudioEndPoints(DataFlow.Render, DeviceState.Active)
        .Select(item => {
            var format = item.AudioClient.MixFormat;
            return new DeviceInfo(item.ID, item.FriendlyName, format.Channels, format.SampleRate, format.BitsPerSample);
        }).OrderBy(item => item.Name).ToArray();

    public object Start(string deviceId) {
        lock (sync) {
            StopInternal();
            device = enumerator.GetDevice(deviceId);
            capture = new WasapiLoopbackCapture(device);
            capture.DataAvailable += OnDataAvailable;
            capture.RecordingStopped += (_, _) => frame = frame with { Active = false };
            started = DateTime.UtcNow;
            capture.StartRecording();
            var format = capture.WaveFormat;
            frame = new CaptureFrame(true, device.FriendlyName, format.Channels, format.SampleRate, format.BitsPerSample, -60, -60, 60, new float[512], BuildSilentChannels(format.Channels), 0, "silent", 0, 0, 0, 0);
            return new { success = true, device = device.FriendlyName, format.Channels, format.SampleRate, format.BitsPerSample };
        }
    }

    public CaptureFrame GetFrame() { lock (sync) return frame; }
    public void Stop() { lock (sync) StopInternal(); }

    public object PlayCalibration(CalibrationRequest request) {
        lock (sync) {
            StopCalibrationInternal();
            calibrationDevice = enumerator.GetDevice(request.DeviceId);
            var format = calibrationDevice.AudioClient.MixFormat;
            if (request.Channel < 1 || request.Channel > format.Channels) throw new ArgumentOutOfRangeException(nameof(request.Channel), $"Channel must be between 1 and {format.Channels}.");
            var frequency = Math.Clamp(request.Frequency, 80, 2000);
            var gainDb = Math.Clamp(request.GainDb, -60, -18);
            var duration = Math.Clamp(request.DurationMs, 150, 3000);
            calibrationOutput = new WasapiOut(calibrationDevice, AudioClientShareMode.Shared, false, 40);
            calibrationOutput.Init(new ChannelToneWaveProvider(format, request.Channel - 1, frequency, MathF.Pow(10, gainDb / 20)));
            calibrationOutput.Play();
            calibrationStop = new CancellationTokenSource();
            _ = StopCalibrationAfter(duration, calibrationStop.Token);
            return new { success = true, channel = request.Channel, label = request.Channel <= Labels.Length ? Labels[request.Channel - 1] : $"CH{request.Channel}", frequency, gainDb, durationMs = duration };
        }
    }

    public void StopCalibration() { lock (sync) StopCalibrationInternal(); }

    public object StartRecording(string name) {
        lock (sync) {
            if (capture is null || !frame.Active) throw new InvalidOperationException("Start device capture before recording a session.");
            StopRecordingInternal();
            var safeName = string.Concat((string.IsNullOrWhiteSpace(name) ? "session" : name).Select(character => char.IsLetterOrDigit(character) || character is '-' or '_' ? character : '_'));
            var root = Environment.GetEnvironmentVariable("ASTRAL_TUNE_LAB_SESSION_DIR") ?? Path.Combine(AppContext.BaseDirectory, "sessions");
            Directory.CreateDirectory(root);
            recordingPath = Path.Combine(root, $"{DateTime.Now:yyyyMMdd-HHmmss}-{safeName}.wav");
            recordingWriter = new WaveFileWriter(recordingPath, capture.WaveFormat);
            return new { success = true, path = recordingPath };
        }
    }

    public object StopRecording() { lock (sync) { var path = recordingPath; StopRecordingInternal(); return new { success = true, path }; } }

    private void OnDataAvailable(object? sender, WaveInEventArgs args) {
        lock (sync) {
            if (capture is null || device is null || args.BytesRecorded == 0) return;
            recordingWriter?.Write(args.Buffer, 0, args.BytesRecorded);
            var format = capture.WaveFormat;
            var channels = Math.Clamp(format.Channels, 1, 16);
            var sums = new double[channels];
            var peaks = new float[channels];
            var mono = new List<float>(2048);
            var frames = 0;
            double leftSum = 0, rightSum = 0, crossSum = 0, midSum = 0, sideSum = 0;
            var bytesPerSample = format.BitsPerSample / 8;
            var blockAlign = Math.Max(1, format.BlockAlign);
            for (var offset = 0; offset + blockAlign <= args.BytesRecorded; offset += blockAlign) {
                float monoSample = 0, left = 0, right = 0;
                for (var channel = 0; channel < channels; channel++) {
                    var sample = ReadSample(args.Buffer, offset + channel * bytesPerSample, format);
                    if (channel == 0) left = sample;
                    else if (channel == 1) right = sample;
                    peaks[channel] = Math.Max(peaks[channel], Math.Abs(sample));
                    sums[channel] += sample * sample;
                    monoSample += sample / channels;
                }
                if (channels > 1) {
                    leftSum += left * left; rightSum += right * right; crossSum += left * right;
                    var mid = (left + right) * .5f; var side = (left - right) * .5f;
                    midSum += mid * mid; sideSum += side * side;
                }
                if (mono.Count < 2048) mono.Add(monoSample);
                frames++;
            }
            if (frames == 0) return;
            var levels = Enumerable.Range(0, channels).Select(index => new ChannelLevel(index + 1, index < Labels.Length ? Labels[index] : $"CH{index + 1}", ToDb(peaks[index]), ToDb((float)Math.Sqrt(sums[index] / frames)))).ToArray();
            var masterPeak = levels.Max(item => item.Peak);
            var masterRms = ToDb((float)Math.Sqrt(sums.Sum() / (frames * channels)));
            var activeChannelCount = levels.Count(item => item.Peak > -50);
            var topology = activeChannelCount == 0 ? "silent" : activeChannelCount > 2 ? "multichannel" : "stereo";
            var lrTotal = leftSum + rightSum;
            var balance = lrTotal > 0.0000001 ? (float)((rightSum - leftSum) / lrTotal) : 0;
            var correlation = leftSum > 0.0000001 && rightSum > 0.0000001 ? (float)(crossSum / Math.Sqrt(leftSum * rightSum)) : 0;
            var stereoWidth = midSum + sideSum > 0.0000001 ? (float)(sideSum / (midSum + sideSum)) : 0;
            frame = new CaptureFrame(true, device.FriendlyName, channels, format.SampleRate, format.BitsPerSample, masterPeak, masterRms, Math.Max(0, -masterPeak), Spectrum(mono), levels, (DateTime.UtcNow - started).TotalSeconds, topology, activeChannelCount, Math.Clamp(balance, -1, 1), Math.Clamp(correlation, -1, 1), Math.Clamp(stereoWidth, 0, 1));
        }
    }

    private static float ReadSample(byte[] buffer, int offset, WaveFormat format) {
        if (format.Encoding == WaveFormatEncoding.IeeeFloat && format.BitsPerSample == 32) return BitConverter.ToSingle(buffer, offset);
        return format.BitsPerSample switch {
            16 => BitConverter.ToInt16(buffer, offset) / 32768f,
            24 => ((buffer[offset] | buffer[offset + 1] << 8 | buffer[offset + 2] << 16) << 8 >> 8) / 8388608f,
            32 => BitConverter.ToInt32(buffer, offset) / 2147483648f,
            _ => 0,
        };
    }

    private static float[] Spectrum(List<float> samples) {
        const int size = 1024;
        var complex = new Complex[size];
        for (var index = 0; index < size; index++) {
            var sample = index < samples.Count ? samples[index] : 0;
            complex[index].X = (float)(sample * FastFourierTransform.HammingWindow(index, size));
        }
        FastFourierTransform.FFT(true, 10, complex);
        return complex.Take(size / 2).Select(value => Math.Clamp((ToDb(MathF.Sqrt(value.X * value.X + value.Y * value.Y)) + 90) / 90, 0, 1)).ToArray();
    }

    private static ChannelLevel[] BuildSilentChannels(int count) => Enumerable.Range(0, Math.Clamp(count, 1, 16)).Select(index => new ChannelLevel(index + 1, index < Labels.Length ? Labels[index] : $"CH{index + 1}", -60, -60)).ToArray();
    private static float ToDb(float value) => value <= .000001f ? -60 : Math.Max(-60, 20 * MathF.Log10(value));
    private static CaptureFrame EmptyFrame() => new(false, "No source", 0, 48000, 0, -60, -60, 60, new float[512], [], 0, "silent", 0, 0, 0, 0);
    private async Task StopCalibrationAfter(int durationMs, CancellationToken token) { try { await Task.Delay(durationMs, token); StopCalibration(); } catch (OperationCanceledException) { } }
    private void StopCalibrationInternal() { calibrationStop?.Cancel(); calibrationStop?.Dispose(); calibrationStop = null; calibrationOutput?.Stop(); calibrationOutput?.Dispose(); calibrationOutput = null; calibrationDevice?.Dispose(); calibrationDevice = null; }
    private void StopRecordingInternal() { recordingWriter?.Dispose(); recordingWriter = null; recordingPath = null; }
    private void StopInternal() { StopCalibrationInternal(); StopRecordingInternal(); if (capture is not null) { capture.StopRecording(); capture.Dispose(); capture = null; } device?.Dispose(); device = null; frame = EmptyFrame(); }
    public void Dispose() { Stop(); enumerator.Dispose(); }
}

sealed class ChannelToneWaveProvider : IWaveProvider {
    private double phase;
    private readonly int sampleRate;
    private readonly int channels;
    private readonly int targetChannel;
    private readonly double frequency;
    private readonly float gain;
    public WaveFormat WaveFormat { get; }
    public ChannelToneWaveProvider(WaveFormat outputFormat, int targetChannel, double frequency, float gain) {
        WaveFormat = outputFormat; sampleRate = outputFormat.SampleRate; channels = outputFormat.Channels; this.targetChannel = targetChannel; this.frequency = frequency; this.gain = gain;
    }
    public int Read(byte[] buffer, int offset, int count) {
        var bytesPerSample = WaveFormat.BitsPerSample / 8;
        var frames = count / WaveFormat.BlockAlign;
        for (var frame = 0; frame < frames; frame++) {
            var sample = MathF.Sin((float)phase) * gain;
            phase += 2 * Math.PI * frequency / sampleRate;
            if (phase > 2 * Math.PI) phase -= 2 * Math.PI;
            for (var channel = 0; channel < channels; channel++) WriteSample(buffer, offset + frame * WaveFormat.BlockAlign + channel * bytesPerSample, channel == targetChannel ? sample : 0, WaveFormat.BitsPerSample);
        }
        return frames * WaveFormat.BlockAlign;
    }
    private static void WriteSample(byte[] buffer, int offset, float sample, int bits) {
        if (bits == 32) { BitConverter.TryWriteBytes(buffer.AsSpan(offset, 4), sample); return; }
        if (bits == 24) { var value = (int)(Math.Clamp(sample, -1, 1) * 8388607); buffer[offset] = (byte)value; buffer[offset + 1] = (byte)(value >> 8); buffer[offset + 2] = (byte)(value >> 16); return; }
        var shortValue = (short)(Math.Clamp(sample, -1, 1) * short.MaxValue); BitConverter.TryWriteBytes(buffer.AsSpan(offset, 2), shortValue);
    }
}
