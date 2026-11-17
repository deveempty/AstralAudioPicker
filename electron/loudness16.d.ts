import type { Loudness16Change, Loudness16State } from '../shared/loudness16';
export declare function decodeLoudness16(raw: {
    deviceId: string;
    properties: Record<string, unknown>;
}): Loudness16State;
export declare const loudnessReadScript = "$ErrorActionPreference='Stop'\n$devices=@(Get-ChildItem 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\MMDevices\\Audio\\Render' | Where-Object {\n $props=Get-ItemProperty -LiteralPath (Join-Path $_.PSPath 'Properties') -ErrorAction SilentlyContinue\n $props -and $props.'{a45c254e-df1c-4efd-8020-67d146a850e0},2' -eq 'CABLE In 16ch' -and $props.'{b3f8fa53-0004-438e-9003-51a46e139bfc},6' -eq 'VB-Audio Virtual Cable'\n})\n$active=@($devices | Where-Object {$_.GetValue('DeviceState') -eq 1})\nif($active.Count -eq 1){$devices=$active}else{$devices=@($devices | Where-Object {$_.GetValue('DeviceState') -in @(1,2)})}\nif($devices.Count -ne 1){throw 'LOUDNESS_ENDPOINT_AMBIGUOUS_OR_MISSING'}\n$fx=Get-Item -LiteralPath (Join-Path $devices[0].PSPath 'FxProperties')\n$values=@{}\nforeach($name in $fx.GetValueNames()){\n if($name -match '^\\{(fc52a749-4be9-4510-896e-966ba6525980|9c00eeed-edce-4cd8-ae08-cb05e8ef57a0|1da5d803-d492-4edd-8c23-e0c0ffee7f0e)\\},'){$values[$name.ToLowerInvariant()]=$fx.GetValue($name)}\n}\n@{deviceId=$devices[0].PSChildName;properties=$values} | ConvertTo-Json -Depth 5 -Compress";
export declare function readLoudness16(): Promise<Loudness16State>;
export declare function createLoudness16(writeEnabled: (id: string, value: boolean) => Promise<boolean>, writeRelease: (id: string, value: number) => Promise<boolean>, read?: typeof readLoudness16): {
    read: typeof readLoudness16;
    change(change: Loudness16Change): Promise<Loudness16State>;
};
