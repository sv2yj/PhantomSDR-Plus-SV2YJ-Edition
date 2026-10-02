#include "crash_handler.h"

#include <websocketpp/error.hpp>

#include <cerrno>
#include <cstdarg>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <ctime>
#include <exception>
#include <execinfo.h>
#include <fcntl.h>
#include <signal.h>
#include <unistd.h>

namespace {

constexpr int kMaxFrames = 64;

// fd of the crash log file, opened once at install time. -1 if unavailable.
int g_crash_log_fd = -1;

// Async-signal-safe: write a C-string to fd.
void safe_write(int fd, const char *s) {
    if (!s || fd < 0) return;
    size_t len = 0;
    while (s[len]) ++len;
    ssize_t r = write(fd, s, len);
    (void)r;
}

// Write to stderr and (if open) the crash log file.
void write_both(const char *s) {
    safe_write(STDERR_FILENO, s);
    safe_write(g_crash_log_fd, s);
}

// Async-signal-safe: write integer to fd.
void safe_write_int(int fd, long v) {
    if (fd < 0) return;
    char buf[32];
    int n = 0;
    if (v < 0) {
        char minus = '-';
        ssize_t r = write(fd, &minus, 1);
        (void)r;
        v = -v;
    }
    if (v == 0) buf[n++] = '0';
    char tmp[32];
    int t = 0;
    while (v > 0) {
        tmp[t++] = '0' + (v % 10);
        v /= 10;
    }
    while (t > 0) buf[n++] = tmp[--t];
    ssize_t r = write(fd, buf, n);
    (void)r;
}

void write_both_int(long v) {
    safe_write_int(STDERR_FILENO, v);
    safe_write_int(g_crash_log_fd, v);
}

void write_both_fd(const void *buf, size_t n) {
    ssize_t r;
    r = write(STDERR_FILENO, buf, n);
    (void)r;
    if (g_crash_log_fd >= 0) {
        r = write(g_crash_log_fd, buf, n);
        (void)r;
    }
}

// Write a backtrace to both stderr and the crash log file.
void write_both_backtrace(void *const *frames, int n) {
    backtrace_symbols_fd(frames, n, STDERR_FILENO);
    if (g_crash_log_fd >= 0) {
        backtrace_symbols_fd(frames, n, g_crash_log_fd);
    }
}

const char *signame(int sig) {
    switch (sig) {
        case SIGSEGV: return "SIGSEGV (segmentation fault)";
        case SIGBUS:  return "SIGBUS (bus error)";
        case SIGFPE:  return "SIGFPE (floating-point exception)";
        case SIGILL:  return "SIGILL (illegal instruction)";
        case SIGABRT: return "SIGABRT (abort)";
        case SIGPIPE: return "SIGPIPE (broken pipe)";
        case SIGTERM: return "SIGTERM";
        case SIGINT:  return "SIGINT";
        default:      return "signal";
    }
}

// Fatal-signal handler: print banner + backtrace, then re-raise default to
// produce a core dump (and let the parent shell observe the real exit cause).
extern "C" void crash_signal_handler(int sig, siginfo_t *info, void * /*ucontext*/) {
    write_both(
               "\n"
               "================================================================\n"
               "[CRASH] spectrumserver received fatal signal: ");
    write_both(signame(sig));
    write_both(" (signo=");
    write_both_int(sig);
    write_both(")\n");

    // Best-effort timestamp (time() is generally safe in practice on Linux
    // even though not formally on the async-signal-safe list).
    write_both("[CRASH] unix_time=");
    write_both_int(static_cast<long>(time(nullptr)));
    write_both("\n");

    if (info) {
        write_both("[CRASH] si_code=");
        write_both_int(info->si_code);
        write_both(" si_addr=0x");
        char hex[32];
        unsigned long v = reinterpret_cast<unsigned long>(info->si_addr);
        int hn = 0;
        if (v == 0) hex[hn++] = '0';
        char tmp[32];
        int t = 0;
        while (v > 0) {
            unsigned d = v & 0xF;
            tmp[t++] = (d < 10) ? ('0' + d) : ('a' + (d - 10));
            v >>= 4;
        }
        while (t > 0) hex[hn++] = tmp[--t];
        write_both_fd(hex, hn);
        write_both(" pid=");
        write_both_int(getpid());
        write_both("\n");
    }

    write_both("[CRASH] Backtrace:\n");
    void *frames[kMaxFrames];
    int n = backtrace(frames, kMaxFrames);
    write_both_backtrace(frames, n);

    write_both(
               "================================================================\n"
               "[CRASH] Re-raising default handler so a core dump can be produced.\n"
               "[CRASH] To get a core dump, run:    ulimit -c unlimited\n"
               "[CRASH] Then inspect with:          gdb ./build/spectrumserver core\n"
               "================================================================\n");

    if (g_crash_log_fd >= 0) {
        fsync(g_crash_log_fd);
    }

    // Restore default handler and re-raise to terminate (and core-dump).
    struct sigaction sa{};
    sa.sa_handler = SIG_DFL;
    sigemptyset(&sa.sa_mask);
    sa.sa_flags = 0;
    sigaction(sig, &sa, nullptr);
    raise(sig);
    _exit(128 + sig);
}

// Less-fatal: SIGPIPE just gets a one-shot warning then is ignored — pipes
// closing should not kill the server.
extern "C" void sigpipe_warn_handler(int /*sig*/) {
    static int seen = 0;
    if (!seen) {
        seen = 1;
        write_both(
                   "[WARN] SIGPIPE received (broken pipe). Further SIGPIPEs will be ignored.\n");
    }
}

void install_one(int sig, void (*handler)(int, siginfo_t *, void *)) {
    struct sigaction sa{};
    sa.sa_sigaction = handler;
    sigemptyset(&sa.sa_mask);
    sa.sa_flags = SA_SIGINFO | SA_RESETHAND;
    sigaction(sig, &sa, nullptr);
}

// Helper for the (non-signal-context) terminate handler: write to stderr via
// fprintf as before, and mirror the same bytes to the crash log fd.
void log_printf(const char *fmt, ...) {
    char buf[1024];
    va_list args;
    va_start(args, fmt);
    int len = vsnprintf(buf, sizeof(buf), fmt, args);
    va_end(args);
    if (len < 0) return;
    if (static_cast<size_t>(len) >= sizeof(buf)) len = sizeof(buf) - 1;

    fwrite(buf, 1, static_cast<size_t>(len), stderr);
    if (g_crash_log_fd >= 0) {
        ssize_t r = write(g_crash_log_fd, buf, static_cast<size_t>(len));
        (void)r;
    }
}

void terminate_handler() {
    log_printf(
            "\n================================================================\n"
            "[TERMINATE] std::terminate() called.\n");
    if (auto eptr = std::current_exception()) {
        try {
            std::rethrow_exception(eptr);
        } catch (const std::exception &e) {
            log_printf("[TERMINATE] uncaught exception: %s\n", e.what());
            if (const auto *wpx =
                    dynamic_cast<const websocketpp::exception *>(&e)) {
                const websocketpp::lib::error_code &ec = wpx->code();
                log_printf(
                        "[TERMINATE] websocketpp error_code: category=%s "
                        "value=%i message=%s\n",
                        ec.category().name(),
                        ec.value(),
                        ec.message().c_str());
            }
        } catch (...) {
            log_printf("[TERMINATE] uncaught non-std exception\n");
        }
    } else {
        log_printf("[TERMINATE] no active exception\n");
    }
    log_printf("[TERMINATE] Backtrace:\n");
    fflush(stderr);
    void *frames[kMaxFrames];
    int n = backtrace(frames, kMaxFrames);
    write_both_backtrace(frames, n);
    log_printf(
            "================================================================\n");
    fflush(stderr);
    if (g_crash_log_fd >= 0) {
        fsync(g_crash_log_fd);
    }
    std::abort();
}

} // namespace

// Public: record a one-line reason in the crash log from normal (non-signal)
// context. Mirrors the bytes to stderr and fsyncs so the note survives even if
// the process is SIGKILLed moments later (e.g. by the watchdog's killall -9).
// NOT async-signal-safe — see the header note; never call from a signal
// handler.
void crash_log_note(const char *msg) {
    if (!msg) msg = "";
    char buf[512];
    int len = snprintf(buf, sizeof(buf),
                       "[EXIT] %s (unix_time=%ld pid=%d)\n",
                       msg, static_cast<long>(time(nullptr)),
                       static_cast<int>(getpid()));
    if (len < 0) return;
    if (static_cast<size_t>(len) >= sizeof(buf)) len = sizeof(buf) - 1;

    fwrite(buf, 1, static_cast<size_t>(len), stderr);
    fflush(stderr);
    if (g_crash_log_fd >= 0) {
        ssize_t r = write(g_crash_log_fd, buf, static_cast<size_t>(len));
        (void)r;
        fsync(g_crash_log_fd);
    }
}

void install_crash_handlers(const char *log_path) {
    if (log_path && *log_path) {
        g_crash_log_fd = open(log_path, O_CREAT | O_WRONLY | O_APPEND, 0644);
        if (g_crash_log_fd < 0) {
            fprintf(stderr,
                    "[CRASH] warning: could not open crash log '%s': %s "
                    "(crash info will go to stderr only)\n",
                    log_path, strerror(errno));
        } else {
            // Startup marker: stderr only (i.e. spectrumserver.log), never the
            // crash log itself. It used to be written to both, framed in dashed
            // rules, which put five lines into crash.log on every single start
            // and left the file — and the admin panel's CRASH tab — looking as
            // though something had crashed when nothing had. Keeping it out
            // means an empty crash.log is exactly what it should be: nothing
            // has gone wrong. Nothing is lost, because the dumps identify their
            // own session: the signal handler prints unix_time and pid, and
            // terminate_handler reaches it via abort()/SIGABRT.
            fprintf(stderr,
                    "[CRASH] crash handler installed, pid=%d, log=%s\n",
                    getpid(), log_path);
        }
    }

    install_one(SIGSEGV, crash_signal_handler);
    install_one(SIGBUS,  crash_signal_handler);
    install_one(SIGFPE,  crash_signal_handler);
    install_one(SIGILL,  crash_signal_handler);
    install_one(SIGABRT, crash_signal_handler);

    struct sigaction sa{};
    sa.sa_handler = sigpipe_warn_handler;
    sigemptyset(&sa.sa_mask);
    sa.sa_flags = 0;
    sigaction(SIGPIPE, &sa, nullptr);

    std::set_terminate(terminate_handler);
}
