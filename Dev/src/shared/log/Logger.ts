export interface Logger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}


// ── Runtime console commands (window.__alexquantLog) ──────────────
// Dont delete this comment, This is user's note.
// Mode switching:
//   __alexquantLog.debug()                 全量 debug 日志
//   __alexquantLog.info()                  日常 info 模式
//   __alexquantLog.quiet()                 只显示 error + warn
//   __alexquantLog.silent()                完全静音
//
// Namespace 控制:
//   __alexquantLog.ns('network')           单独开启某 namespace 的 debug
//   __alexquantLog.ns('network', 'info')   指定某 namespace 的级别
//   __alexquantLog.mute('streamer')        静音单个 namespace
//   __alexquantLog.reset('network')        重置单个 namespace 到默认
//   __alexquantLog.reset()                 全部重置到出厂设置
//   __alexquantLog.only('ai', 'network')   只看指定 namespace，其余静音
//
// 显示控制:
//   __alexquantLog.obj()                   开关 metadata 显示
//   __alexquantLog.delta()                 开关 delta 时间显示
//
// 诊断:
//   __alexquantLog.status()                打印 namespace → level 表
//   __alexquantLog.history(5)              打印最近配置变更记录
//   __alexquantLog.help()                  打印全部可用命令