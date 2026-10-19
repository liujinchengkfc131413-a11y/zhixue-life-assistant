import { spawn } from 'node:child_process';

import type { CredentialStore } from '@life-assistant/ai-adapters';

const script = `
$inputData = [Console]::In.ReadToEnd() | ConvertFrom-Json
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class LifeAssistantCredentialApi {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)] public struct CREDENTIAL {
    public UInt32 Flags; public UInt32 Type; public string TargetName; public string Comment;
    public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten; public UInt32 CredentialBlobSize;
    public IntPtr CredentialBlob; public UInt32 Persist; public UInt32 AttributeCount;
    public IntPtr Attributes; public string TargetAlias; public string UserName;
  }
  [DllImport("Advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)] public static extern bool CredWrite(ref CREDENTIAL credential, UInt32 flags);
  [DllImport("Advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)] public static extern bool CredRead(string target, UInt32 type, UInt32 flags, out IntPtr credential);
  [DllImport("Advapi32.dll", SetLastError = true)] public static extern bool CredDelete(string target, UInt32 type, UInt32 flags);
  [DllImport("Advapi32.dll")] public static extern void CredFree(IntPtr buffer);
}
'@
$target = [string]$inputData.reference
if ($inputData.action -eq 'set') {
  $bytes = [Text.Encoding]::Unicode.GetBytes([string]$inputData.secret)
  $blob = [Runtime.InteropServices.Marshal]::AllocCoTaskMem($bytes.Length)
  try {
    [Runtime.InteropServices.Marshal]::Copy($bytes, 0, $blob, $bytes.Length)
    $credential = New-Object LifeAssistantCredentialApi+CREDENTIAL
    $credential.Type = 1; $credential.TargetName = $target; $credential.CredentialBlobSize = $bytes.Length
    $credential.CredentialBlob = $blob; $credential.Persist = 2; $credential.UserName = 'LifeAssistant'
    if (-not [LifeAssistantCredentialApi]::CredWrite([ref]$credential, 0)) { throw 'CREDENTIAL_WRITE_FAILED' }
  } finally { [Runtime.InteropServices.Marshal]::FreeCoTaskMem($blob) }
  @{ found = $true } | ConvertTo-Json -Compress
} elseif ($inputData.action -eq 'get') {
  $pointer = [IntPtr]::Zero
  if (-not [LifeAssistantCredentialApi]::CredRead($target, 1, 0, [ref]$pointer)) { @{ found = $false } | ConvertTo-Json -Compress; exit 0 }
  try {
    $credential = [Runtime.InteropServices.Marshal]::PtrToStructure($pointer, [type][LifeAssistantCredentialApi+CREDENTIAL])
    $bytes = New-Object byte[] $credential.CredentialBlobSize
    [Runtime.InteropServices.Marshal]::Copy($credential.CredentialBlob, $bytes, 0, $bytes.Length)
    @{ found = $true; secret = [Text.Encoding]::Unicode.GetString($bytes) } | ConvertTo-Json -Compress
  } finally { [LifeAssistantCredentialApi]::CredFree($pointer) }
} else {
  [void][LifeAssistantCredentialApi]::CredDelete($target, 1, 0)
  @{ found = $false } | ConvertTo-Json -Compress
}
`;

interface CredentialResult {
  readonly found: boolean;
  readonly secret?: string;
}

/** Windows Credential Manager bridge. Secrets travel through stdin, never the command line or SQLite. */
export class WindowsCredentialStore implements CredentialStore {
  public async has(reference: string): Promise<boolean> {
    return (await this.get(reference)) !== undefined;
  }

  public async get(reference: string): Promise<string | undefined> {
    const result = await this.run({ action: 'get', reference });
    return result.found ? result.secret : undefined;
  }

  public async set(reference: string, secret: string): Promise<void> {
    if (Buffer.byteLength(secret, 'utf16le') > 512) throw new Error('CREDENTIAL_SECRET_TOO_LARGE');
    await this.run({ action: 'set', reference, secret });
  }

  public async remove(reference: string): Promise<void> {
    await this.run({ action: 'remove', reference });
  }

  private async run(input: {
    action: 'set' | 'get' | 'remove';
    reference: string;
    secret?: string;
  }): Promise<CredentialResult> {
    if (process.platform !== 'win32') throw new Error('CREDENTIAL_STORE_UNAVAILABLE');
    const encoded = Buffer.from(script, 'utf16le').toString('base64');
    const result = await new Promise<{ stdout: string; stderr: string; exitCode: number | null }>(
      (resolve, reject) => {
        const child = spawn(
          'powershell.exe',
          ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded],
          {
            stdio: ['pipe', 'pipe', 'pipe'],
            windowsHide: true,
          },
        );
        let stdout = '';
        let stderr = '';
        const timeout = setTimeout(() => {
          child.kill();
          reject(new Error('CREDENTIAL_STORE_UNAVAILABLE'));
        }, 30_000);
        child.once('error', () => {
          clearTimeout(timeout);
          reject(new Error('CREDENTIAL_STORE_UNAVAILABLE'));
        });
        child.stdout.setEncoding('utf8');
        child.stdout.on('data', (chunk: string) => {
          stdout += chunk;
        });
        child.stderr.setEncoding('utf8');
        child.stderr.on('data', (chunk: string) => {
          stderr += chunk;
        });
        child.once('close', (exitCode) => {
          clearTimeout(timeout);
          resolve({ stdout, stderr, exitCode });
        });
        child.stdin.end(JSON.stringify(input));
      },
    );
    if (result.exitCode !== 0) throw new Error('CREDENTIAL_STORE_UNAVAILABLE');
    try {
      return JSON.parse(result.stdout) as CredentialResult;
    } catch {
      throw new Error('CREDENTIAL_STORE_UNAVAILABLE');
    }
  }
}
