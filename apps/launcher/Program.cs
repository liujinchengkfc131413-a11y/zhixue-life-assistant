using System.Diagnostics;
using System.IO.Pipes;
using System.Net;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace LifeAssistant.Launcher;

internal static class Program
{
    private static readonly string MutexName = InstanceScopedName("Local\\LifeAssistant.Launcher.Singleton");
    private static readonly string PipeName = InstanceScopedName("LifeAssistant.Launcher.Commands");

    [STAThread]
    private static void Main(string[] args)
    {
        LauncherLog.Initialize();
        try
        {
            using var mutex = new Mutex(true, MutexName, out var createdNew);
            var requestedCommand = args.Contains("--shutdown", StringComparer.OrdinalIgnoreCase)
                ? "exit"
                : "open";
            if (!createdNew)
            {
                LauncherLog.Write("launcher.secondary-instance", ("command", requestedCommand));
                SignalExistingInstance(requestedCommand);
                return;
            }
            if (requestedCommand == "exit") return;

            ApplicationConfiguration.Initialize();
            if (Environment.GetEnvironmentVariable("LIFE_ASSISTANT_SKIP_SHORTCUT") != "1")
                EnsureDesktopShortcut();
            Application.Run(new LauncherContext(args));
            GC.KeepAlive(mutex);
        }
        catch (Exception error)
        {
            LauncherLog.Write("launcher.fatal", ("error", error.ToString()));
            MessageBox.Show(
                $"生活助手启动失败。诊断日志位于：{LauncherLog.LogFilePath}",
                "知雪的生活助手",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
        }
    }

    /// <summary>首次运行时创建桌面快捷方式（幂等，失败不阻塞启动）。</summary>
    private static void EnsureDesktopShortcut()
    {
        try
        {
            var desktop = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
            var shortcutPath = Path.Combine(desktop, "知雪的生活助手.lnk");
            if (File.Exists(shortcutPath)) return;
            var exePath = Environment.ProcessPath;
            if (string.IsNullOrWhiteSpace(exePath)) return;
            var shellType = Type.GetTypeFromProgID("WScript.Shell");
            if (shellType is null) return;
            dynamic shell = Activator.CreateInstance(shellType)!;
            dynamic shortcut = shell.CreateShortcut(shortcutPath);
            shortcut.TargetPath = exePath;
            shortcut.WorkingDirectory = Path.GetDirectoryName(exePath);
            shortcut.Description = "知雪的生活助手";
            shortcut.Save();
            System.Runtime.InteropServices.Marshal.FinalReleaseComObject(shortcut);
            System.Runtime.InteropServices.Marshal.FinalReleaseComObject(shell);
        }
        catch
        {
            // 快捷方式创建失败不应阻塞应用启动。
        }
    }

    private static void SignalExistingInstance(string command)
    {
        try
        {
            using var client = new NamedPipeClientStream(".", PipeName, PipeDirection.Out);
            client.Connect(1500);
            using var writer = new StreamWriter(client) { AutoFlush = true };
            writer.WriteLine(command);
        }
        catch
        {
            // The first process may still be starting; never create a second server.
        }
    }

    private static string InstanceScopedName(string baseName)
    {
        var suffix = Environment.GetEnvironmentVariable("LIFE_ASSISTANT_INSTANCE_SUFFIX");
        if (string.IsNullOrWhiteSpace(suffix)) return baseName;
        var safeSuffix = Regex.Replace(suffix, "[^A-Za-z0-9_.-]", "_");
        return $"{baseName}.{safeSuffix}";
    }

    private sealed class LauncherContext : ApplicationContext
    {
        private const int MaxAutomaticRestarts = 3;
        private static readonly TimeSpan AutomaticRestartWindow = TimeSpan.FromMinutes(5);
        private readonly NotifyIcon trayIcon;
        private readonly CancellationTokenSource cancellation = new();
        private readonly SynchronizationContext uiContext = new WindowsFormsSynchronizationContext();
        private readonly object serverLifecycleSync = new();
        private readonly Queue<DateTimeOffset> automaticRestartAttempts = new();
        private readonly HashSet<int> expectedServerExits = [];
        private readonly string serverEntry;
        private readonly bool skipBrowser;
        private Process? serverProcess;
        private int automaticRestartScheduled;
        private int port;
        private string launchToken = string.Empty;
        private volatile bool serverReady;

        public LauncherContext(string[] args)
        {
            serverEntry = ResolveServerEntry(args);
            skipBrowser = Environment.GetEnvironmentVariable("LIFE_ASSISTANT_SKIP_BROWSER") == "1";
            LauncherLog.Write(
                "launcher.configuration",
                ("serverEntry", serverEntry),
                ("webRoot", Path.GetFullPath(Path.Combine(Path.GetDirectoryName(serverEntry)!, "..", "web"))),
                ("dataDirectory", ResolveConfiguredDataDirectory() ?? "<not-initialized>"),
                ("skipBrowser", skipBrowser));
            trayIcon = new NotifyIcon
            {
                Icon = SystemIcons.Application,
                Text = "知雪的生活助手",
                Visible = true,
                ContextMenuStrip = BuildMenu(),
            };
            trayIcon.DoubleClick += (_, _) => OpenBrowser(false);
            _ = ListenForCommandsAsync(cancellation.Token);
            _ = StartServerAsync();
        }

        private ContextMenuStrip BuildMenu()
        {
            var menu = new ContextMenuStrip();
            menu.Items.Add("打开生活助手", null, (_, _) => OpenBrowser(false));
            menu.Items.Add("查看状态", null, (_, _) => ShowStatus());
            menu.Items.Add("重启本地服务", null, async (_, _) => await RestartServerAsync());
            menu.Items.Add("创建桌面快捷方式", null, (_, _) => EnsureDesktopShortcut());
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add("退出", null, (_, _) => ExitLauncher());
            return menu;
        }

        private async Task StartServerAsync(bool openBrowserOnReady = true)
        {
            try
            {
                serverReady = false;
                port = ResolvePort();
                launchToken = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
                    .Replace('+', '-')
                    .Replace('/', '_')
                    .TrimEnd('=');
                var configuredNode = Environment.GetEnvironmentVariable("LIFE_ASSISTANT_NODE_PATH");
                var portableNode = Path.Combine(AppContext.BaseDirectory, "runtime", "node.exe");
                var nodePath = !string.IsNullOrWhiteSpace(configuredNode)
                    ? configuredNode
                    : File.Exists(portableNode)
                        ? portableNode
                        : "node";
                var startInfo = new ProcessStartInfo
                {
                    FileName = nodePath,
                    UseShellExecute = false,
                    CreateNoWindow = true,
                    WorkingDirectory = Path.GetDirectoryName(serverEntry) ?? AppContext.BaseDirectory,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    StandardOutputEncoding = Encoding.UTF8,
                    StandardErrorEncoding = Encoding.UTF8,
                };
                startInfo.ArgumentList.Add(serverEntry);
                startInfo.Environment["LIFE_ASSISTANT_PORT"] = port.ToString();
                startInfo.Environment["LIFE_ASSISTANT_LAUNCH_TOKEN"] = launchToken;
                LauncherLog.Write(
                    "server.starting",
                    ("runtimePath", Path.GetFullPath(nodePath)),
                    ("serverEntry", serverEntry),
                    ("workingDirectory", startInfo.WorkingDirectory),
                    ("selectedPort", port),
                    ("command", nodePath),
                    ("args", new[] { serverEntry }));

                var process = new Process { StartInfo = startInfo, EnableRaisingEvents = true };
                process.OutputDataReceived += (_, eventArgs) =>
                {
                    if (!string.IsNullOrWhiteSpace(eventArgs.Data))
                        LauncherLog.Write("server.stdout", ("message", eventArgs.Data));
                };
                process.ErrorDataReceived += (_, eventArgs) =>
                {
                    if (!string.IsNullOrWhiteSpace(eventArgs.Data))
                        LauncherLog.Write("server.stderr", ("message", eventArgs.Data));
                };
                process.Exited += (_, _) =>
                {
                    serverReady = false;
                    var processId = -1;
                    try
                    {
                        processId = process.Id;
                    }
                    catch (InvalidOperationException)
                    {
                        // The process was not fully associated; the generic log below still records the exit.
                    }
                    var expected = cancellation.IsCancellationRequested;
                    lock (serverLifecycleSync)
                    {
                        if (processId >= 0) expected |= expectedServerExits.Remove(processId);
                        expected |= !ReferenceEquals(serverProcess, process);
                    }
                    try
                    {
                        LauncherLog.Write(
                            "server.exited",
                            ("pid", processId >= 0 ? processId : null),
                            ("exitCode", process.ExitCode),
                            ("expected", expected));
                    }
                    catch (InvalidOperationException)
                    {
                        LauncherLog.Write("server.exited", ("expected", expected));
                    }
                    if (!expected)
                        uiContext.Post(_ => _ = RestartAfterUnexpectedExitAsync(process), null);
                };
                if (!process.Start()) throw new InvalidOperationException("无法启动本地服务进程。");
                serverProcess = process;
                process.BeginOutputReadLine();
                process.BeginErrorReadLine();
                LauncherLog.Write("server.spawned", ("pid", process.Id));
                await WaitForServerAsync(cancellation.Token);
                serverReady = true;
                LauncherLog.Write("server.ready", ("port", port));
                if (openBrowserOnReady) OpenBrowser(true);
            }
            catch (OperationCanceledException) when (cancellation.IsCancellationRequested)
            {
                LauncherLog.Write("server.start-cancelled");
            }
            catch (Exception error)
            {
                LauncherLog.Write("server.start-failed", ("error", error.ToString()));
                trayIcon.ShowBalloonTip(8000, "生活助手启动失败", error.Message, ToolTipIcon.Error);
            }
        }

        private async Task RestartAfterUnexpectedExitAsync(Process exitedProcess)
        {
            if (Interlocked.Exchange(ref automaticRestartScheduled, 1) == 1) return;
            var ownsRestartSlot = true;
            try
            {
                var now = DateTimeOffset.UtcNow;
                int attempt;
                lock (serverLifecycleSync)
                {
                    if (cancellation.IsCancellationRequested || !ReferenceEquals(serverProcess, exitedProcess))
                        return;
                    while (
                        automaticRestartAttempts.TryPeek(out var recordedAt)
                        && now - recordedAt > AutomaticRestartWindow
                    )
                        automaticRestartAttempts.Dequeue();
                    if (automaticRestartAttempts.Count >= MaxAutomaticRestarts)
                    {
                        serverProcess = null;
                        LauncherLog.Write(
                            "server.restart-exhausted",
                            ("maximumAttempts", MaxAutomaticRestarts),
                            ("windowMinutes", AutomaticRestartWindow.TotalMinutes));
                        trayIcon.ShowBalloonTip(
                            8000,
                            "生活助手本地服务已停止",
                            "本地服务连续异常退出，已停止自动重启。请从托盘菜单手动重启并检查日志。",
                            ToolTipIcon.Error);
                        exitedProcess.Dispose();
                        return;
                    }
                    automaticRestartAttempts.Enqueue(now);
                    attempt = automaticRestartAttempts.Count;
                }

                var restartDelay = ResolveAutomaticRestartDelay();
                LauncherLog.Write(
                    "server.restart-scheduled",
                    ("attempt", attempt),
                    ("maximumAttempts", MaxAutomaticRestarts),
                    ("delayMs", restartDelay.TotalMilliseconds));
                await Task.Delay(restartDelay, cancellation.Token);

                lock (serverLifecycleSync)
                {
                    if (cancellation.IsCancellationRequested || !ReferenceEquals(serverProcess, exitedProcess))
                        return;
                    serverProcess = null;
                }
                exitedProcess.Dispose();
                LauncherLog.Write("server.restarting", ("attempt", attempt), ("automatic", true));
                ownsRestartSlot = false;
                Interlocked.Exchange(ref automaticRestartScheduled, 0);
                await StartServerAsync(false);
            }
            catch (OperationCanceledException) when (cancellation.IsCancellationRequested)
            {
                LauncherLog.Write("server.restart-cancelled");
            }
            finally
            {
                if (ownsRestartSlot) Interlocked.Exchange(ref automaticRestartScheduled, 0);
            }
        }

        private static TimeSpan ResolveAutomaticRestartDelay()
        {
            var configured = Environment.GetEnvironmentVariable("LIFE_ASSISTANT_RESTART_DELAY_MS");
            return int.TryParse(configured, out var milliseconds) && milliseconds is >= 100 and <= 30000
                ? TimeSpan.FromMilliseconds(milliseconds)
                : TimeSpan.FromSeconds(2);
        }

        private async Task WaitForServerAsync(CancellationToken cancellationToken)
        {
            using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(1) };
            for (var attempt = 0; attempt < 80; attempt++)
            {
                cancellationToken.ThrowIfCancellationRequested();
                if (serverProcess?.HasExited == true)
                    throw new InvalidOperationException("本地服务在启动期间意外退出。");
                try
                {
                    using var response = await client.GetAsync($"http://127.0.0.1:{port}/health/ready", cancellationToken);
                    if (response.IsSuccessStatusCode)
                    {
                        LauncherLog.Write("health.ready", ("attempt", attempt + 1), ("statusCode", (int)response.StatusCode));
                        return;
                    }
                }
                catch (HttpRequestException)
                {
                    // Keep polling until the local listener is ready.
                }
                catch (TaskCanceledException) when (!cancellationToken.IsCancellationRequested)
                {
                    // A single health request timed out; the overall startup loop continues.
                }
                await Task.Delay(250, cancellationToken);
            }
            throw new TimeoutException("等待本地服务启动超时。");
        }

        private void OpenBrowser(bool exchangeToken)
        {
            if (port == 0 || !serverReady || skipBrowser) return;
            var url = exchangeToken
                ? $"http://127.0.0.1:{port}/launch?token={Uri.EscapeDataString(launchToken)}"
                : $"http://127.0.0.1:{port}/";
            var browser = FindSupportedBrowser();
            var startInfo = browser is null
                ? new ProcessStartInfo(url) { UseShellExecute = true }
                : new ProcessStartInfo(browser, url) { UseShellExecute = true };
            Process.Start(startInfo);
            LauncherLog.Write("browser.opened", ("url", exchangeToken ? $"http://127.0.0.1:{port}/launch" : url));
        }

        private void ShowStatus()
        {
            var state = serverProcess is { HasExited: false }
                ? $"本地服务正在运行\n地址：http://127.0.0.1:{port}"
                : "本地服务未运行";
            MessageBox.Show(state, "知雪的生活助手", MessageBoxButtons.OK, MessageBoxIcon.Information);
        }

        private async Task RestartServerAsync()
        {
            StopServer();
            await StartServerAsync();
        }

        private async Task ListenForCommandsAsync(CancellationToken cancellationToken)
        {
            while (!cancellationToken.IsCancellationRequested)
            {
                try
                {
                    await using var pipe = new NamedPipeServerStream(
                        PipeName,
                        PipeDirection.In,
                        1,
                        PipeTransmissionMode.Byte,
                        PipeOptions.Asynchronous);
                    await pipe.WaitForConnectionAsync(cancellationToken);
                    using var reader = new StreamReader(pipe);
                    var command = await reader.ReadLineAsync(cancellationToken);
                    if (command == "open") uiContext.Post(_ => OpenBrowser(false), null);
                    if (command == "exit") uiContext.Post(_ => ExitLauncher(), null);
                }
                catch (OperationCanceledException)
                {
                    return;
                }
            }
        }

        private void ExitLauncher()
        {
            cancellation.Cancel();
            StopServer();
            trayIcon.Visible = false;
            trayIcon.Dispose();
            ExitThread();
        }

        private void StopServer()
        {
            serverReady = false;
            var process = serverProcess;
            if (process is null) return;
            lock (serverLifecycleSync)
            {
                try
                {
                    expectedServerExits.Add(process.Id);
                }
                catch (InvalidOperationException)
                {
                    // An unassociated process has no exit event that can trigger an automatic restart.
                }
                serverProcess = null;
            }
            if (!process.HasExited)
            {
                LauncherLog.Write("server.stopping", ("pid", process.Id));
                process.Kill(true);
                process.WaitForExit(5000);
            }
            process.Dispose();
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing)
            {
                cancellation.Cancel();
                StopServer();
                trayIcon.Dispose();
                cancellation.Dispose();
            }
            base.Dispose(disposing);
        }

        private static int FindFreePort()
        {
            var listener = new TcpListener(IPAddress.Loopback, 0);
            listener.Start();
            var selectedPort = ((IPEndPoint)listener.LocalEndpoint).Port;
            listener.Stop();
            return selectedPort;
        }

        private static int ResolvePort()
        {
            var configured = Environment.GetEnvironmentVariable("LIFE_ASSISTANT_FIXED_PORT");
            return int.TryParse(configured, out var value) && value is > 0 and <= 65535
                ? value
                : FindFreePort();
        }

        private static string ResolveServerEntry(string[] args)
        {
            var argumentIndex = Array.IndexOf(args, "--server");
            var configured = argumentIndex >= 0 && argumentIndex + 1 < args.Length
                ? args[argumentIndex + 1]
                : Environment.GetEnvironmentVariable("LIFE_ASSISTANT_SERVER_ENTRY");
            if (!string.IsNullOrWhiteSpace(configured))
            {
                var configuredPath = Path.GetFullPath(configured);
                if (!File.Exists(configuredPath))
                    throw new FileNotFoundException("找不到本地服务入口。", configuredPath);
                return configuredPath;
            }

            string[] candidates =
            [
                Path.Combine(AppContext.BaseDirectory, "app", "server", "main.cjs"),
                Path.Combine(AppContext.BaseDirectory, "server", "main.cjs"),
                Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..", "apps", "server", "dist", "main.cjs"),
            ];
            var path = candidates.Select(Path.GetFullPath).FirstOrDefault(File.Exists);
            if (path is null)
                throw new FileNotFoundException("找不到本地服务入口，请先运行 pnpm build。");
            return path;
        }

        private static string? FindSupportedBrowser()
        {
            var programFiles = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
            var programFilesX86 = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86);
            string[] candidates =
            [
                Path.Combine(programFiles, "Google", "Chrome", "Application", "chrome.exe"),
                Path.Combine(programFilesX86, "Google", "Chrome", "Application", "chrome.exe"),
                Path.Combine(programFiles, "Microsoft", "Edge", "Application", "msedge.exe"),
                Path.Combine(programFilesX86, "Microsoft", "Edge", "Application", "msedge.exe"),
                // 非标准安装路径（如便携/自定义部署的 Edge）。
                Path.Combine(programFiles, "Edge", "App", "msedge.exe"),
                Path.Combine(programFilesX86, "Edge", "App", "msedge.exe"),
            ];
            return candidates.FirstOrDefault(IsLaunchableBrowser);
        }

        private static bool IsLaunchableBrowser(string path)
        {
            if (!File.Exists(path)) return false;
            try
            {
                var startInfo = new ProcessStartInfo
                {
                    FileName = path,
                    UseShellExecute = false,
                    CreateNoWindow = true,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                };
                startInfo.ArgumentList.Add("--version");
                using var process = Process.Start(startInfo);
                if (process is null || !process.WaitForExit(3000))
                {
                    if (process is { HasExited: false }) process.Kill(true);
                    LauncherLog.Write("browser.probe-failed", ("path", path), ("reason", "timeout"));
                    return false;
                }
                if (process.ExitCode == 0) return true;
                LauncherLog.Write(
                    "browser.probe-failed",
                    ("path", path),
                    ("exitCode", process.ExitCode),
                    ("stderr", process.StandardError.ReadToEnd()));
                return false;
            }
            catch (Exception error)
            {
                LauncherLog.Write("browser.probe-failed", ("path", path), ("error", error.Message));
                return false;
            }
        }

        private static string? ResolveConfiguredDataDirectory()
        {
            try
            {
                var bootstrapPath = Environment.GetEnvironmentVariable("LIFE_ASSISTANT_BOOTSTRAP_PATH")
                    ?? Path.Combine(
                        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                        "LifeAssistant",
                        "bootstrap.json");
                if (!File.Exists(bootstrapPath)) return null;
                using var document = JsonDocument.Parse(File.ReadAllText(bootstrapPath));
                return document.RootElement.TryGetProperty("dataDirectory", out var value)
                    ? value.GetString()
                    : null;
            }
            catch (Exception error)
            {
                LauncherLog.Write("bootstrap.read-failed", ("error", error.Message));
                return null;
            }
        }
    }

    private static class LauncherLog
    {
        private const long MaxLogBytes = 2 * 1024 * 1024;
        private static readonly object Sync = new();
        private static string? logPath;
        private static readonly Regex SecretPattern = new(
            "(?i)(api[-_ ]?key|authorization|bearer|token)([\\\"'=: ]+)([^\\s,;}]+)",
            RegexOptions.Compiled);

        public static string LogFilePath => logPath ?? "<unavailable>";

        public static void Initialize()
        {
            try
            {
                var configuredPath = Environment.GetEnvironmentVariable("LIFE_ASSISTANT_LAUNCHER_LOG_PATH");
                var directory = string.IsNullOrWhiteSpace(configuredPath)
                    ? Path.Combine(
                        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                        "LifeAssistant",
                        "logs")
                    : Path.GetDirectoryName(Path.GetFullPath(configuredPath))
                        ?? throw new InvalidOperationException("Launcher 日志路径无效。");
                Directory.CreateDirectory(directory);
                logPath = string.IsNullOrWhiteSpace(configuredPath)
                    ? Path.Combine(directory, "launcher.log")
                    : Path.GetFullPath(configuredPath);
                lock (Sync)
                {
                    if (File.Exists(logPath) && new FileInfo(logPath).Length >= MaxLogBytes)
                        File.Move(logPath, $"{logPath}.1", true);
                }
                Write(
                    "launcher.started",
                    ("releaseVersion", ReadRuntimeValue("releaseVersion", "<development>")),
                    ("appVersion", ReadRuntimeValue("appVersion", "<development>")),
                    ("executablePath", Environment.ProcessPath ?? "<unknown>"),
                    ("executableDirectory", AppContext.BaseDirectory),
                    ("cwd", Environment.CurrentDirectory),
                    ("logPath", logPath));
            }
            catch
            {
                // 日志不可写不能阻止应用启动。
            }
        }

        public static void Write(string eventName, params (string Key, object? Value)[] fields)
        {
            if (logPath is null) return;
            try
            {
                var record = new Dictionary<string, object?>
                {
                    ["timestamp"] = DateTimeOffset.Now.ToString("O"),
                    ["event"] = eventName,
                };
                foreach (var (key, value) in fields)
                    record[key] = value is string text ? Redact(text) : value;
                var line = JsonSerializer.Serialize(record) + Environment.NewLine;
                lock (Sync) File.AppendAllText(logPath, line, Encoding.UTF8);
            }
            catch
            {
                // 诊断记录失败不能引发新的启动故障。
            }
        }

        private static string ReadRuntimeValue(string propertyName, string fallback)
        {
            try
            {
                var path = Path.Combine(AppContext.BaseDirectory, "runtime.json");
                if (!File.Exists(path)) return fallback;
                using var document = JsonDocument.Parse(File.ReadAllText(path));
                return document.RootElement.TryGetProperty(propertyName, out var value)
                    ? value.GetString() ?? "<unknown>"
                    : "<unknown>";
            }
            catch
            {
                return "<unknown>";
            }
        }

        private static string Redact(string value) => SecretPattern.Replace(value, "$1$2<redacted>");
    }
}
