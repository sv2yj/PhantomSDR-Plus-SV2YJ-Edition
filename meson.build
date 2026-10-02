project(
  'spectrumdistributor',
  'cpp',
  default_options : [
    'optimization=0',
    # 'b_sanitize=address',
  ]
)

# -----------------------------------------------------------------------------
# Build flags
# -----------------------------------------------------------------------------
cpp = meson.get_compiler('cpp')

# -march=native is an x86 and AArch64 spelling. 32-bit ARM gcc — a Raspberry Pi
# running the 64-bit-capable hardware on a 32-bit OS, which is still common —
# rejects it outright and the configure step dies before it has built anything.
# Ask the compiler instead of assuming, and fall back to -mcpu=native, which is
# what ARM wants. A compiler that takes neither simply gets neither.
if cpp.has_argument('-march=native')
  add_project_arguments('-march=native', language: 'cpp')
elif cpp.has_argument('-mcpu=native')
  add_project_arguments('-mcpu=native', language: 'cpp')
  message('-march=native not supported; using -mcpu=native')
else
  message('neither -march=native nor -mcpu=native supported; building generic')
endif
add_project_arguments('-ggdb3', language: 'cpp')
add_project_arguments(['-std=c++23', '-Ofast', '-Wall', '-Wextra', '-Wpedantic'], language: 'cpp')
# websocketpp 0.8.2 uses std::aligned_storage which is deprecated in GCC 14 / C++23.
# Suppress the warning here since it's a frozen vendored subproject we can't patch.
add_project_arguments('-Wno-deprecated-declarations', language: 'cpp')
# add_project_link_arguments(['-rdynamic', '-no-pie'], language: 'cpp')

cmake = import('cmake')

# -----------------------------------------------------------------------------
# Dependencies (best-effort autodetect; only some are required)
# -----------------------------------------------------------------------------
deps = []

# Threads
thread_dep = dependency('threads')
deps += thread_dep

# stdc++fs (older libstdc++)
stdcppfs_dep = cpp.find_library('stdc++fs', required: false)
if stdcppfs_dep.found()
  deps += stdcppfs_dep
endif

# FFT: single-precision + OpenMP
fft_deps = []
fftw3f_dep = dependency('fftw3f')
fftw3f_deps = [
  fftw3f_dep,
  cpp.find_library('fftw3f_omp'),
]
fft_deps += fftw3f_deps
fft_deps += dependency('openmp')

# Boost
boost_dep = dependency('boost', modules : ['system', 'iostreams'])

# glaze (CMake subproject fallback)
glaze_dep = dependency('glaze', required : false)
if (not glaze_dep.found()
    or get_option('wrap_mode') == 'forcefallback'
    or 'glaze' in get_option('force_fallback_for'))
  # glaze's CMakeLists turns on developer mode when it is the top-level
  # project (which it is, as far as CMake is concerned, when meson configures
  # it), and dev mode FetchContent's boost-ext/ut, asio and eigen3 from GitHub
  # just to build tests we never use.  On a machine without network that kills
  # the whole configure step, so switch dev mode and testing off explicitly.
  glaze_opts = cmake.subproject_options()
  glaze_opts.add_cmake_defines({
    'glaze_DEVELOPER_MODE': 'OFF',
    'BUILD_TESTING': 'OFF',
  })
  glaze = cmake.subproject('glaze', options : glaze_opts)
  glaze_dep = glaze.dependency('glaze_glaze')
endif

# -----------------------------------------------------------------------------
# Codecs bucket (feature-aware)
# -----------------------------------------------------------------------------
codec_deps = []

# zstd + FLAC++
zstd_dep   = dependency('libzstd')
flacpp_dep = dependency('flac++')
codec_deps += zstd_dep
codec_deps += flacpp_dep

# ------------------------ Opus ------------------------
opus_opt = get_option('opus')
opus_dep = disabler()

if opus_opt.disabled()
  message('Opus: DISABLED via -Dopus=disabled')
else
  # When user forces enabled, fail configure if missing; otherwise soft auto
  _opus_req = opus_opt.enabled()
  opus_dep = dependency('opus', required : _opus_req)
  if opus_dep.found()
    codec_deps += opus_dep
    add_project_arguments('-DHAS_LIBOPUS', language: 'cpp')
    message('Opus: ENABLED')
  else
    message('Opus: DISABLED (not found)')
  endif
endif

# ------------------------ liquid-dsp -------------------
liq_opt = get_option('liquid')
liquid_dep = disabler()

if liq_opt.disabled()
  message('liquid-dsp: DISABLED via -Dliquid=disabled')
else
  _liq_req = liq_opt.enabled()
  liquid_dep = cpp.find_library('liquid', required : _liq_req)
  if liquid_dep.found()
    add_project_arguments('-DHAS_LIQUID', language : 'cpp')
    message('liquid-dsp: ENABLED')
  else
    message('liquid-dsp: DISABLED (not found)')
  endif
endif

# -----------------------------------------------------------------------------
# Misc deps
# -----------------------------------------------------------------------------
zlib_dep          = dependency('zlib')
websocketpp_dep   = subproject('websocketpp').get_variable('websocketpp_dep')
tomlplusplus_dep  = dependency('tomlplusplus')
cuda_dep          = dependency('cuda',   required : false)
cufft_dep         = dependency('cufft',  required : false)
opencl_dep        = dependency('OpenCL', required : false)
clfft_dep         = dependency('clFFT',  required : false)
curl_dep          = dependency('libcurl')

cuda_srcs = []

if add_languages('cuda', required : false) and cuda_dep.found() and cufft_dep.found()
  cuda = import('unstable-cuda')
  fft_deps += cuda_dep
  fft_deps += cufft_dep
  add_project_arguments('-DCUFFT', language : ['cpp', 'cuda'] )
  add_project_arguments(cuda.nvcc_arch_flags(meson.get_compiler('cuda'), 'All'), language: 'cuda')
  add_project_arguments('-O3', language: 'cuda')
  add_project_arguments('-Xptxas=-v', language: 'cuda')
  cuda_srcs += files('src/fft_cuda.cu')
endif

if opencl_dep.found() and clfft_dep.found()
  fft_deps += opencl_dep
  fft_deps += clfft_dep
  add_project_arguments('-DCLFFT', language : 'cpp')
endif

# -----------------------------------------------------------------------------
# Sources
# -----------------------------------------------------------------------------
srcs = [
  'src/spectrumserver.cpp',
  'src/samplereader.cpp',

  'src/websocket.cpp',
  'src/http.cpp',

  'src/fft.cpp',
  'src/client.cpp',
  'src/signal.cpp',
  'src/waterfall.cpp',
  'src/events.cpp',
  'src/audio.cpp',   # FLAC / Opus here
  'src/chat.cpp',
  'src/waterfallcompression.cpp',
  'src/listing/software_info.cpp',
  'src/crash_handler.cpp',
  'src/utils/dsp.cpp',
  'src/utils/audioprocessing.cpp',

  'src/fft_impl.cpp',
  'src/utils.cpp',
  'src/compression.cpp',
]
srcs += cuda_srcs

# -----------------------------------------------------------------------------
# Target
# -----------------------------------------------------------------------------
executable(
  'spectrumserver',
  srcs,
  dependencies : [
    stdcppfs_dep,
    thread_dep,
    fft_deps,
    websocketpp_dep,
    boost_dep,
    tomlplusplus_dep,
    glaze_dep,
    codec_deps,   # zstd, FLAC++, Opus (if found)
    zlib_dep,
    liquid_dep,   # liquid-dsp (or disabler() if off)
    curl_dep,
  ],
  link_language : 'cpp',
)

# -----------------------------------------------------------------------------
# Summary table (precompute statuses, then print)
# -----------------------------------------------------------------------------
openmp_found = dependency('openmp', required : false).found()

# Opus status
if opus_opt.disabled()
  opus_status = '❌ disabled by user'
elif opus_dep.found()
  opus_status = opus_opt.enabled() ? '✅ enabled' : '✅ auto-detected'
else
  opus_status = '❌ not found'
endif

# liquid-dsp status
if liq_opt.disabled()
  liquid_status = '❌ disabled by user'
elif liquid_dep.found()
  liquid_status = liq_opt.enabled() ? '✅ enabled' : '✅ auto-detected'
else
  liquid_status = '❌ not found'
endif

summary({
  'Project name'        : meson.project_name(),
  'Build type'          : get_option('buildtype'),
  'C++ Standard'        : 'C++23',
  'Compiler'            : cpp.get_id(),
  'CPU family'          : host_machine.cpu_family(),
  'CPU'                 : host_machine.cpu(),
  'OpenMP'              : openmp_found,

  'Opus support'        : opus_status,
  'FLAC++ support'      : flacpp_dep.found() ? '✅' : '❌',
  'liquid-dsp support'  : liquid_status,
}, section: 'Configuration summary')

