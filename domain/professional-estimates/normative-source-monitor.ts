export interface SourceMonitorResult {
  checkedAt: Date;
  fingerprint: string;
}

export interface NormativeSourceMonitor {
  verify(sourceUri: string): Promise<SourceMonitorResult>;
}
