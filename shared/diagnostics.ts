export type DiagnosticStatus='ok'|'warning'|'error'|'unknown'|'info'
export interface DiagnosticCheck {id:string;status:DiagnosticStatus;detail:string;paths?:string[]}
export interface DiagnosticReport {checkedAt:number;checks:DiagnosticCheck[]}
