#ifndef CRASH_HANDLER_H
#define CRASH_HANDLER_H

// Installs:
//   - signal handlers for SIGSEGV, SIGBUS, SIGFPE, SIGILL, SIGABRT, SIGPIPE
//     (each prints a backtrace + crash banner to stderr AND to a crash log
//     file, then re-raises)
//   - std::terminate handler (prints uncaught-exception message + backtrace
//     to stderr AND to the crash log file)
//   - std::set_unexpected (legacy; prints + aborts)
//
// Backtrace requires linking with -rdynamic for readable symbols.
//
// log_path: path to the crash log file. The file is opened once, in append
// mode, at install time, and the fd is kept open for the lifetime of the
// process so the signal handler can write to it without calling fopen()
// (which is not async-signal-safe). If the file cannot be opened, crash
// info is still written to stderr only.
//
// Default path is "crash.log" (relative to the process's working directory,
// i.e. typically the spectrumserver build/run directory).
//
void install_crash_handlers(const char *log_path = "crash.log");

// Records a single timestamped line in the crash log (and on stderr) from
// normal, non-signal context. Use to capture *why* the server exited when the
// cause is NOT a fatal signal the crash handler catches — e.g. input-stream
// EOF (RX-888 died) or a graceful SIGINT/SIGTERM shutdown — so crash.log
// explains an otherwise-silent shutdown instead of just going quiet.
//
// NOT async-signal-safe (calls time()/snprintf/fwrite): only call from
// ordinary code paths, never from a signal handler. The boost::asio
// signal_set completion in spectrumserver runs in normal context, so calling
// it from there is fine.
void crash_log_note(const char *msg);

#endif // CRASH_HANDLER_H
