# Руководство по установке PhantomSDR-Plus для системных операторов

Это подробное руководство проведёт вас через установку и настройку PhantomSDR-Plus на вашем сервере.

---

## Содержание

1. [Системные требования](#системные-требования)
2. [Подготовка к установке](#подготовка-к-установке)
3. [Установка PhantomSDR-Plus](#установка-phantomsdr-plus) — сценарий и [что он делает](#что-делает-установщик)
4. [Autorun Spot Reporter (FT8/FT4/WSPR)](#autorun-spot-reporter-ft8ft4wspr)
5. [Эмуляция клиентов KiwiSDR (необязательно)](#эмуляция-клиентов-kiwisdr-необязательно)
6. [Настройка](#настройка)
7. [Настройка для конкретных устройств SDR](#настройка-для-конкретных-устройств-sdr)
8. [Проверка и тестирование](#проверка-и-тестирование)
9. [Настройка автозапуска](#настройка-автозапуска)
10. [Тепловая защита процессора](#тепловая-защита-процессора)
11. [Устранение неполадок](#устранение-неполадок)

**Только для справки — установщик уже делает всё это за вас.** Читайте эти разделы, если у вас дистрибутив, который не покрывает ни один из сценариев, или если нужно починить отдельный шаг вручную:

- [Установка зависимостей](#установка-зависимостей)
- [Установка Node.js и npm](#установка-nodejs-и-npm)
- [Установка OpenCL](#установка-opencl-необязательно-но-рекомендуется)
- [Сборка вручную](#сборка-вручную-справочно)
- [Установка аудиокодека Opus](#установка-аудиокодека-opus)
---

## Системные требования

### Поддерживаемые операционные системы

**Основная (рекомендуется):**
- Ubuntu 22.04 LTS (Jammy), 24.04 LTS (Noble) и 26.04 LTS (Resolute) — рекомендуется 24.04
- Debian 12 (Bookworm) и Debian 13 (Trixie)

**Альтернатива:**
- Fedora (последний стабильный выпуск)
- Arch Linux (rolling)
- openSUSE Tumbleweed (не Leap — см. примечание ниже)

### Требования к оборудованию

**Минимальная конфигурация:**
- Процессор: двухъядерный (от 2 ГГц)
- ОЗУ: 4 ГБ
- Накопитель: 10 ГБ свободного места
- Сеть: соединение 100 Мбит/с

**Рекомендуемая конфигурация:**
- Процессор: четырёхъядерный или лучше (Ryzen 5 2600, Intel i5-6500T или лучше)
- ОЗУ: 8 ГБ и более
- Накопитель: SSD от 20 ГБ
- GPU: AMD/NVIDIA с поддержкой OpenCL (крайне желательно)
- Сеть: соединение 1 Гбит/с

**Высокопроизводительная конфигурация:**
- Процессор: 6 и более ядер (Ryzen 7, Intel i7 или лучше)
- ОЗУ: 16 ГБ и более
- Накопитель: NVMe SSD
- GPU: отдельная видеокарта с поддержкой OpenCL/CUDA
- Сеть: 1 Гбит/с и выше

---

## Подготовка к установке

### 1. Обновите систему

```bash
# Ubuntu/Debian
sudo apt update
sudo apt upgrade -y
sudo reboot

# Fedora
sudo dnf update -y
sudo reboot
```

### 2. Проверьте версию Ubuntu

```bash
lsb_release -a
```

**Ожидаемый вывод должен показать:** Ubuntu 24.04 LTS

### 3. Проверьте свободное место на диске

```bash
df -h
```

Убедитесь, что в вашем домашнем каталоге есть не менее 10 ГБ свободного места.

### 4. Проверьте сведения о процессоре

```bash
lscpu
```

Запомните число ядер/потоков для оптимизации конфигурации.

---

## Установка зависимостей

> [!IMPORTANT]
> **Для обычной установки этот раздел не нужен.** `./install.sh` — или установщик вашего дистрибутива — делает всё это за вас; см. [Что делает установщик](#что-делает-установщик). Ниже — справочный материал для ручной установки, для дистрибутива, который не покрывает ни один сценарий, или для починки отдельной части вручную.


### Ubuntu 24.04 LTS

```bash
sudo apt install -y \
  build-essential \
  cmake \
  pkg-config \
  meson \
  libfftw3-dev \
  libwebsocketpp-dev \
  libflac++-dev \
  zlib1g-dev \
  libzstd-dev \
  libboost-all-dev \
  libopus-dev \
  libliquid-dev \
  git \
  psmisc \
  wget \
  curl
```

### Fedora

```bash
sudo dnf install -y \
  g++ \
  meson \
  cmake \
  fftw3-devel \
  websocketpp-devel \
  flac-devel \
  zlib-devel \
  boost-devel \
  libzstd-devel \
  opus-devel \
  liquid-dsp-devel \
  git \
  psmisc \
  wget \
  curl
```

### Проверьте установку

```bash
# Check if key dependencies are installed
pkg-config --modversion fftw3
cmake --version
meson --version
```

---

## Установка Node.js и npm

> [!IMPORTANT]
> **Для обычной установки этот раздел не нужен.** `./install.sh` — или установщик вашего дистрибутива — делает всё это за вас; см. [Что делает установщик](#что-делает-установщик). Ниже — справочный материал для ручной установки, для дистрибутива, который не покрывает ни один сценарий, или для починки отдельной части вручную.


PhantomSDR-Plus требует Node.js для сборки веб-интерфейса. Для установки воспользуемся NVM (Node Version Manager).

### 1. Установите NVM

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.4/install.sh | bash
```

### 2. Загрузите NVM

**ВАЖНО:** закройте и снова откройте терминал либо выполните:

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
```

### 3. Проверьте установку NVM

```bash
nvm --version
```

Ожидаемый вывод: `0.40.4` или похожий

### 4. Установите Node.js

```bash
# Install Node.js 22 - the version every install script requires
nvm install 22

# Make it the default, so systemd units and cron see it too
nvm alias default 22

# Verify installation
node --version
npm --version
```

### 5. Необязательно: установите другие версии Node

```bash
# Install latest version
nvm install node

# Install specific version (if needed)
nvm install 22.22.3

# List installed versions
nvm list

# Use specific version
nvm use 22
```

---

## Установка OpenCL (необязательно, но рекомендуется)

> [!IMPORTANT]
> **Для обычной установки этот раздел не нужен.** `./install.sh` — или установщик вашего дистрибутива — делает всё это за вас; см. [Что делает установщик](#что-делает-установщик). Ниже — справочный материал для ручной установки, для дистрибутива, который не покрывает ни один сценарий, или для починки отдельной части вручную.


OpenCL существенно повышает производительность, перенося вычисления FFT на GPU. Этот раздел посвящён встроенной графике Intel. Для GPU AMD/NVIDIA обратитесь к документации производителя.

### Процессор Intel со встроенной графикой

#### 1. Установите базовые компоненты OpenCL

```bash
sudo apt install -y \
  build-essential \
  cmake \
  pkg-config \
  meson \
  libfftw3-dev \
  libwebsocketpp-dev \
  libflac++-dev \
  zlib1g-dev \
  libzstd-dev \
  libboost-all-dev \
  libopus-dev \
  libliquid-dev \
  libclfft-dev \
  ocl-icd-opencl-dev \
  clinfo
```

#### 2. Скачайте Intel Compute Runtime

```bash
mkdir -p ~/neo
cd ~/neo

wget https://github.com/intel/compute-runtime/releases/download/19.07.12410/intel-gmmlib_18.4.1_amd64.deb
wget https://github.com/intel/compute-runtime/releases/download/19.07.12410/intel-igc-core_18.50.1270_amd64.deb
wget https://github.com/intel/compute-runtime/releases/download/19.07.12410/intel-igc-opencl_18.50.1270_amd64.deb
wget https://github.com/intel/compute-runtime/releases/download/19.07.12410/intel-opencl_19.07.12410_amd64.deb
wget https://github.com/intel/compute-runtime/releases/download/19.07.12410/intel-ocloc_19.07.12410_amd64.deb
```

#### 3. Установите среду выполнения Intel OpenCL

```bash
sudo dpkg -i *.deb
```

Если возникают ошибки зависимостей:

```bash
sudo apt --fix-broken install
```

#### 4. Установите загрузчик OpenCL ICD

```bash
sudo apt update
sudo apt install intel-opencl-icd
```

Если возникают ошибки:

```bash
sudo apt --fix-broken install
sudo apt install intel-opencl-icd
```

#### 5. Проверьте установку OpenCL

```bash
sudo clinfo
```

Вы должны увидеть сведения о вашей платформе и устройствах OpenCL. Обратите внимание на:
- Число платформ: 1 (или больше)
- Название платформы: Intel(R) OpenCL (или похожее)
- Тип устройства: GPU или CPU

#### 6. Перезагрузитесь

```bash
sudo reboot
```

### OpenCL на GPU AMD

Для видеокарт AMD установите ROCm:

```bash
# Add ROCm repository
wget -q -O - https://repo.radeon.com/rocm/rocm.gpg.key | sudo apt-key add -
echo 'deb [arch=amd64] https://repo.radeon.com/rocm/apt/debian/ ubuntu main' | sudo tee /etc/apt/sources.list.d/rocm.list

# Install ROCm
sudo apt update
sudo apt install rocm-opencl rocm-clinfo

# Add user to video group
sudo usermod -a -G video $USER

# Reboot
sudo reboot

# Verify
clinfo
```

### OpenCL на GPU NVIDIA

Для видеокарт NVIDIA установите CUDA:

```bash
# Install NVIDIA drivers
sudo apt install nvidia-driver-525

# Install CUDA toolkit
wget https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2204/x86_64/cuda-keyring_1.0-1_all.deb
sudo dpkg -i cuda-keyring_1.0-1_all.deb
sudo apt update
sudo apt install cuda

# Reboot
sudo reboot

# Verify
nvidia-smi
clinfo
```

---

## Установка PhantomSDR-Plus

### Клонирование репозитория, права на сценарии, запуск установщика

```bash
cd ~
git clone --recursive https://github.com/sv1btl/PhantomSDR-Plus
cd PhantomSDR-Plus
chmod +x *.sh
./install.sh
```

**⚠️ ВАЖНО:** после завершения установки **перезапустите терминал** — только тогда свежеустановленные Node.js и Rust окажутся в вашем `PATH`.

> **PhantomSDR-Plus у вас уже работает?** Не устанавливайте его заново — обновите. Загрузите средство обновления один раз и запустите; ваша конфигурация, метки, пароль администратора, список частот и история чата никогда не затрагиваются, а всё, что вы правили сами, предъявляется вам, а не перезаписывается:
>
> ```bash
> cd ~/PhantomSDR-Plus
> curl -fLO https://raw.githubusercontent.com/sv1btl/PhantomSDR-Plus/main/update.sh
> chmod +x update.sh
> ./update.sh
> ```
>
> Последняя строка лишь *сообщает*, что изменилось бы, и ничего не записывает; `./update.sh --apply` выполняет обновление. Подробности — в главе *Обновление PhantomSDR-Plus*. Повторно запускать установщик на работающей станции нужно только тогда, когда сборка падает из-за отсутствующих системных пакетов.

Возьмите сценарий, соответствующий вашей системе. Все они делают одну и ту же работу и задают одни и те же вопросы; отличается только менеджер пакетов:

| Система | Сценарий |
|---|---|
| Ubuntu 22.04 / 24.04 / 26.04, Debian 12 / 13 | `./install.sh` |
| Fedora | `./install_fedora.sh` |
| Arch | `./install_arch.sh` |
| openSUSE Tumbleweed | `./install_opensuse.sh` |

> **Один установщик для всех выпусков Debian и Ubuntu.** `install.sh` читает `/etc/os-release` и установленную версию Boost и подстраивается сам; прежние `install_ubuntu22.sh`, `install-Deb12.sh` и `install_ubuntu26.sh` удалены. Он задаёт `DEBIAN_FRONTEND=noninteractive`, чтобы `tzdata`, приходящий вместе с `python3-matplotlib`, не мог остановить установку вопросом о вашем часовом поясе и затем проглотить ответ, предназначенный следующему вопросу. На Jammy он прямо вызывает `install_rade_ubuntu22.sh`, поскольку `python3-websockets` в Jammy — 10.1, а RADE требует 11.0 или новее. Он знает, где в каждом выпуске находится `intel-opencl-icd`: в репозиториях на 22.04 и 26.04, в `non-free` на Debian 12 и в собственном графическом репозитории Intel на 24.04 и Debian 13. А там, где Boost 1.87 или новее, патч заголовков websocketpp перестаёт быть необязательным: установщик проверяет, что он применён, и без него отказывается собирать. Более новый компилятор не нужен никогда: штатный GCC принимает `-std=c++23` на всех пяти выпусках, так что не устанавливайте ради этого `gcc-12`.

Установка идёт в 17 чётко пронумерованных шагов, и каждое место, где она вас ждёт, обрамлено рамкой **⌨️  ТРЕБУЕТСЯ ВАШ ОТВЕТ**, чтобы вопрос нельзя было спутать с пробегающим выводом. Семь вопросов перечислены в самом начале, до того как что-либо будет установлено. `PHANTOM_NONINTERACTIVE=1` отвечает на все значениями по умолчанию; переменные `PHANTOM_*` описаны в шапке `install.sh`.

**Каждый запуск пишет `install.txt`.** Когда установщик завершается — или обрывается на полпути — он записывает отчёт в `install.txt` в каталоге PhantomSDR-Plus: результат, каждый из 17 шагов как OK / SKIPPED / PARTIAL / FAILED, что было обнаружено (дистрибутив, Boost, компилятор, Node.js), какие компоненты установлены и каждое возникшее предупреждение. Неудачный запуск оставляет отчёт, который заканчивается на упавшем шаге, с причиной и замечанием, что установщик можно безопасно запустить снова. Это первый файл, который стоит прочитать, когда что-то не сработало, и первый, который прикладывают к сообщению об ошибке. Каждый запуск перезаписывает его, поэтому сохраните копию, если хотите сравнить две установки.

> **Ubuntu 26.04, Arch и openSUSE Tumbleweed собираются, но в эфире не работали.** Все три несут Boost новее 1.87, где удалён API `io_service`, под который написан встроенный websocketpp 0.8.2. Исправленные заголовки, которые копирует установщик, закрывают этот разрыв (`io_context`, `executor_work_guard`, `boost::asio::post`, современный resolver), а там, где Boost 1.87 или новее, установщик считает этот патч обязательным, а не необязательным: он проверяет, что копии на месте, и без них собирать отказывается. Полная установка — с драйвером приёмника и всеми необязательными компонентами — проверена от начала до конца в контейнерах на Boost 1.90 (Ubuntu 26.04), 1.91 (openSUSE Tumbleweed) и 1.92 (Arch). Это доказывает, что сервер собирается и запускается, а не что он часами обслуживает приёмник. Считайте все три непроверенными в продакшене, пока кто-нибудь не сообщит.

> **openSUSE здесь означает Tumbleweed.** Именно там проверен `install_opensuse.sh`. Leap 15.6 не работает: в его репозиториях вообще нет `liquid-dsp-devel`, который нужен бэкенду, а Boost доступен только под версионированными именами пакетов. Поддержка Leap потребовала бы подключения сторонних репозиториев OBS, поэтому пока она вне рамок.

### Что делает установщик

Ничего не нужно готовить вручную заранее — не надо вставлять список пакетов, качать Node.js или искать пакеты OpenCL. Он идёт в 19 пронумерованных шагов и останавливается, чтобы задать до десяти вопросов, каждый в рамке «ТРЕБУЕТСЯ ВАШ ОТВЕТ», — так что либо оставайтесь за клавиатурой, либо задайте `PHANTOM_NONINTERACTIVE=1` и позвольте ему ответить на всё значениями по умолчанию (см. ниже), и рассчитывайте от примерно двадцати минут до заметно более часа — в зависимости от машины и от того, сколько дополнений вы оставите.

| # | Шаг | О чём спрашивает |
|---|---|---|
| 1 | Перечисляет службы PhantomSDR-Plus, работающие прямо сейчас, — панель администратора, обратный прокси, сервер статистики, приёмник — и предлагает остановить их, прежде чем что-либо трогать. Приёмником считается только запущенный сценарий запуска; сценарий, просто открытый в редакторе, не трогается. | подтверждение, **по умолчанию да** |
| 2–6 | Определяет дистрибутив и ставит все зависимости сборки (компилятор, meson/ninja, FFTW, Boost, FLAC, Opus, liquid-dsp, zlib/zstd, libcurl …), в том числе Node.js 22 через nvm, если в системе его нет или он слишком старый | ни о чём |
| 7 | Собирает бэкенд с помощью meson | ни о чём |
| 8 | Собирает драйвер вашего приёмника — RX888 MkII / RX888, RTL-SDR (Blog V4 спрашивается отдельно), SDRplay RSP1A, RigExpert Fobos SDR, Airspy HF+, HackRF One или ничего. При выборе RX888 **ставятся и правила udev**, чтобы серверу никогда не требовался `sudo` для устройства. RSP1A, Fobos и Airspy HF+ работают через SoapySDR: их выбор запускает `setup-rsp1a.sh`, `setup-fobos.sh` или `setup-airspyhf.sh`, которые собирают драйвер и `rx_sdr` и тоже ставят правило udev (см. [Приёмники через SoapySDR (RSP1A, Fobos, Airspy HF+)](#приёмники-через-soapysdr-rsp1a-fobos-airspy-hf)) HackRF One не нужен SoapySDR: его выбор запускает `setup-hackrf.sh`, который ставит пакет `hackrf` из дистрибутива и правило udev. | какой у вас SDR |
| 9 | Открывает `frontend/site_information.json` в вашем редакторе | позывной, локатор, оборудование, антенна — **не пропускайте** |
| 10–11 | Ставит зависимости фронтенда и собирает страницы для компьютера и `/mobile` | ни о чём |
| 12 | Ставит OpenCL, выбирая поставщика по найденному оборудованию (GPU Intel / AMD / NVIDIA либо x86-runtime для ЦП). Если подходящего устройства нет, прямо сообщает об этом и идёт дальше | подтверждение, по умолчанию да |
| 13–15 | Ставит **панель администратора**, **декодер FreeDV RADE V1** и **сервер статистики** — все три по умолчанию | подтверждение каждого, по умолчанию да; у каждого свои вопросы |
| 16 | Заново накладывает пять исправленных заголовков websocketpp поверх подпроекта meson и проверяет, что они на месте. Три из них — работа по совместимости с Boost ≥ 1.87, без которой backend не собирается на Boost 1.90; остальные два — собственные изменения проекта, одно из которых нужно для регистрации на websdr.org | ни о чём |
| 17 | Ставит **эмуляцию клиентов KiwiSDR**, запуская `kiwi_install.sh`, чтобы клиенты Kiwi вроде AetherSDR могли подключаться к этому приёмнику. Правит исходники и добавляет `[kiwi_emulation]` в файлы конфигурации в корне репозитория — см. [Эмуляция клиентов KiwiSDR](Aether_config.md) | подтверждение, по умолчанию да |
| 18 | Запускает `recompile.sh`, чтобы всё собралось из пропатченных исходников | `[3] Both backend and frontend` → стартовый вариант → `[1] build-all.sh` |
| 19 | Печатает сводку: каждый шаг с его итогом и каждый компонент с тем, что было установлено | ни о чём |

#### Установка без присмотра

У каждого вопроса есть переменная окружения, которая его переопределяет, и установщик сам переходит к значениям по умолчанию, когда stdin не терминал (конвейер, контейнер, задача CI). Это одинаково работает во всех четырёх: `install.sh`, `install_arch.sh`, `install_fedora.sh` и `install_opensuse.sh`. Задайте `PHANTOM_NONINTERACTIVE=1` — и весь прогон завершится, ничего не спросив:

| Переменная | Действие |
|---|---|
| `PHANTOM_NONINTERACTIVE=1` | answer every question with its default |
| `PHANTOM_SDR=1…7` | RX888 · RTL-SDR · SDRplay RSP1A · skip · Fobos · Airspy HF+ · HackRF (default 4) |
| `PHANTOM_RTLSDR_V4=y\|n` | RTL-SDR Blog V4 driver (default n) |
| `PHANTOM_SITE_EDIT=y\|n` | open `site_information.json` in an editor |
| `PHANTOM_OPENCL=y\|n` | install OpenCL (default y) |
| `PHANTOM_OPENCL_PROVIDER=1\|2\|3` | Intel · Mesa/Rusticl · POCL (default: from the detected hardware) |
| `PHANTOM_ADMIN=y\|n` | admin panel (y interactive, n unattended) |
| `PHANTOM_RADE=y\|n` | RADE / FreeDV (y interactive, n unattended) |
| `PHANTOM_STATS=y\|n` | statistics server (y interactive, n unattended) |
| `PHANTOM_KIWI=y\|n` | KiwiSDR client emulation (default y) |
| `PHANTOM_RECOMPILE=y\|n` | final rebuild (default y) |
| `PHANTOM_CURLPP=y\|n` | продолжить без curlpp — только Arch и openSUSE (по умолчанию y) |
| `PHANTOM_FIX_CLOCK_SKEW=y\|n` | сбросить временные метки исходников, датированные будущим, чтобы meson смог собрать (по умолчанию y) |

Три под-установщика, помеченные *n без присмотра*, сами интерактивны, поэтому прогон без присмотра пропускает их, а не зависает на их вопросах. Назовите их явно, чтобы включить:

```bash
# a complete unattended install for an RX888 MkII
PHANTOM_NONINTERACTIVE=1 PHANTOM_SDR=1 ./install.sh

# ... and with the admin panel, RADE and the statistics server too
PHANTOM_NONINTERACTIVE=1 PHANTOM_SDR=1 \
  PHANTOM_ADMIN=y PHANTOM_RADE=y PHANTOM_STATS=y ./install.sh
```

После перезагрузки правила udev для RX888 и драйвер OpenCL действуют полностью; установщик сам сообщает, когда нужна перезагрузка или повторный вход в систему.

При настройке панели администратора установщик предлагает также два юнита systemd и **настоятельно рекомендует** согласиться: защита от перегрева процессора работает внутри панели, поэтому без них перезагрузка или сбой оставляют машину без защиты. Шаг автоматически пропускается там, где systemd не работает (контейнеры, WSL1, OpenRC) — см. [руководство по панели](ADMIN_PANEL_SETUP.md).

Каждое дополнение — обычный сценарий, который можно запустить и отдельно в любой момент: `./setup_admin.sh` ([руководство](ADMIN_PANEL_SETUP.md)), `./install_rade.sh` ([руководство](RADE_README.md)), `./install-stats-server.sh` ([руководство](sdr-stats/README.md)), `./setup-rx888-udev.sh` и сценарии приёмников `./setup-rsp1a.sh`, `./setup-fobos.sh`, `./setup-airspyhf.sh` и `./setup-hackrf.sh` — именно их и вызывает установщик.

### Сборка вручную (справочно)

> [!IMPORTANT]
> **Для обычной установки этот раздел не нужен.** `./install.sh` — или установщик вашего дистрибутива — делает всё это за вас; см. [Что делает установщик](#что-делает-установщик). Ниже — справочный материал для ручной установки, для дистрибутива, который не покрывает ни один сценарий, или для починки отдельной части вручную.

Если когда-нибудь придётся собирать без установщика — дистрибутив, который не покрыт сценариями, или починка незавершённой сборки:

#### Сборка backend

```bash
# Clean any previous builds, Configure build with optimization, Compile
rm -rf build
meson setup build --buildtype=release --optimization=3
meson compile -C build

# Verify binary was created
ls -lh build/spectrumserver
```

#### Сборка frontend

```bash
cd frontend

# Install dependencies, Fix any vulnerabilities, Build the frontend
npm install
npm audit fix
npm run build

# Return to project root
cd ..
```

### Проверьте установку

```bash
# Check if binary exists
ls -lh build/spectrumserver

# Check if frontend was built
ls -lh frontend/dist/

# List important files
ls -lh *.sh *.toml
```

---

## Установка аудиокодека Opus

> [!IMPORTANT]
> **Для обычной установки этот раздел не нужен.** `./install.sh` — или установщик вашего дистрибутива — делает всё это за вас; см. [Что делает установщик](#что-делает-установщик). Ниже — справочный материал для ручной установки, для дистрибутива, который не покрывает ни один сценарий, или для починки отдельной части вручную.


Opus обеспечивает лучшее качество звука и меньшую задержку по сравнению с FLAC.

### 1. Установите системную библиотеку libopus

```bash
sudo apt-get update
sudo apt-get install -y libopus0 libopus-dev
```

### 2. Установите декодер Opus для веб-интерфейса

```bash
cd PhantomSDR-Plus/frontend

# Install npm dependencies if not already done, Install Opus WASM decoder, Fix any vulnerabilities, Rebuild frontend
npm install
npm install @wasm-audio-decoders/opus-ml
npm audit fix
npm run build

# Return to project root
cd ..
```

### 3. Проверьте установку Opus

```bash
# Check if Opus system library is installed
pkg-config --modversion opus

# Check if Opus npm package is installed
cd frontend
npm list @wasm-audio-decoders/opus-ml
cd ..
```

---

## Autorun Spot Reporter (FT8/FT4/WSPR)

В состав PhantomSDR-Plus входит необязательный **autorun spot reporter** (в каталоге `autorun/`). Он декодирует FT8/FT4/WSPR на стороне сервера прямо с приёмника и выгружает споты в сети отчётности:

- **FT8 / FT4 → PSK Reporter** (IPFIX/UDP)
- **WSPR → wsprnet.org** (HTTP)

Управление ведётся целиком из вкладки **панель администратора → «Spot Reporting»**, и **отчётность по умолчанию ВЫКЛЮЧЕНА** — ничего не передаётся и не выгружается, пока вы её там не включите. Декодер работает как отдельная служба Node.js и получает звук приёмника локально, поэтому дополнительного РЧ-оборудования не требуется.

### Требования

| Требование | Примечания |
|------------|------------|
| **Node.js 22+** | Та же среда выполнения, что уже нужна для сборки веб-интерфейса — устанавливается на [шаге Node.js](#установка-nodejs-и-npm). |
| **Пакеты npm `ws` + `cbor-x`** | Разрешаются через `autorun/node_modules` — символическую ссылку на `node_modules` веб-интерфейса (оба пакета объявлены в `frontend/package.json`). |
| **`util-linux`** (`taskset`) | Кнопка «Start» в админке привязывает службу к E-ядрам через `taskset`. Есть практически в любом дистрибутиве; установщики добавляют его явно. |
| **Позывной + локатор** | Читаются из `frontend/site_information.json` (`siteSysop` / `siteGridSquare`), если не переопределены во вкладке администратора. Споты выгружаются под этим позывным. |

> ⚠️ **Сообщайте только то, что действительно принимаете.** Споты выгружаются в публичные сети под вашим позывным — включайте только те диапазоны и виды связи, которые ваш приёмник действительно слышит, и указывайте правильный локатор.

### Автоматическая установка

`install.sh` (и варианты для дистрибутивов: `install_arch.sh`, `install_fedora.sh`, `install_opensuse.sh`) делают всё за вас: устанавливают Node.js 22 и `util-linux`, выполняют `npm install` для веб-интерфейса и затем автоматически создают символическую ссылку `autorun/node_modules`. Дополнительных шагов не требуется — функция готова, как только `install.sh` завершится.

### Установка вручную

> [!NOTE]
> Установщик уже делает это за вас: создаёт символическую ссылку и устанавливает `util-linux`. Шаги ниже нужны только для ручной починки.

Если вы устанавливали вручную (вариант Б), создайте символическую ссылку сами после `npm install` веб-интерфейса, чтобы служба смогла разрешить свои зависимости:

```bash
cd ~/PhantomSDR-Plus

# 1. Frontend deps must be installed first (ws + cbor-x live there)
cd frontend && npm install && cd ..

# 2. Link the autorun daemon to the frontend's node_modules
ln -sfn ../frontend/node_modules autorun/node_modules

# 3. Ensure taskset is available (Debian/Ubuntu shown; use your package manager)
sudo apt install -y util-linux
```

> **Примечание:** `autorun/node_modules` игнорируется git, поэтому свежий `git clone` никогда его не содержит — ссылку нужно (пере)создавать после каждой чистой выгрузки. Установщики делают это за вас; команда выше нужна только при ручной настройке.

### Проверка

```bash
# The symlink should point at ../frontend/node_modules
ls -l autorun/node_modules

# ws + cbor-x must resolve
ls -d frontend/node_modules/ws frontend/node_modules/cbor-x

# taskset must be on PATH
command -v taskset
```

Затем откройте панель администратора, перейдите на вкладку **Spot Reporting**, укажите свои данные, отметьте диапазоны и виды связи для декодирования, включите приёмники отчётов и нажмите **Start**. На главном водопаде появится значок «📶 REPORTING», пока отчётность активна. (PSK Reporter выгружает пакетами каждые 5 минут, а wsprnet — каждые 2 минуты, поэтому только что запущенная служба первые минуты показывает «0 sent» — это нормально.)

Далее показываются два разных счётчика, которые легко перепутать. Плитки **SPOTS UPLOADED PER DECODER** считают только текущий запуск, поэтому Stop/Start обнуляет их; число рядом с каждым флажком диапазона/вида связи — это **итог за всё время** для этой позиции, он хранится в `autorun-totals.json` и переживает перезапуски. Оба счётчика описаны в [руководстве по панели администратора](ADMIN_PANEL_SETUP.md), там же — страница **Графики**, где строятся частота процессора, нагрузка, температура и число слушателей за период от 15 минут до 24 часов.

> **Если ваша машина греется**, в панели есть и [тепловая защита](ADMIN_PANEL_SETUP.md#thermal-guard), которая останавливает сервер при опасной температуре процессора и запускает его снова после остывания. Пороги она выводит из критического порога вашего собственного процессора, так что считать ничего не нужно, и работает она с любым способом запуска и остановки. Устанавливается вместе с панелью, но начинает в режиме только записи: отмечает, что *сделала бы*, и ничего не меняет, пока вы не включите её в Настройках. Непрерывное декодирование нагружает процессор круглые сутки, поэтому стоит заглянуть во вкладку CRASH после недели работы autorun и посмотреть, насколько близко ваша машина подходит на самом деле.

> **Порт сервера определяется автоматически.** Служба подключается напрямую к `[server] port` самого spectrumserver (петлевой интерфейс + токен, минуя прокси). Она читает этот порт из файла конфигурации, с которым был запущен работающий spectrumserver, поэтому работает на любом порту без настройки — строка `[autorun] tap backend: …` в `autorun.log` показывает, что было определено. Если ваш сервер не работал в момент запуска службы или у вас нестандартная конфигурация, укажите порт явно в `autorun.json`:
> ```json
> "server": { "host": "127.0.0.1", "port": 9002 }
> ```
> Неверный порт проявляется как `504` / `tap closed 1006` в `autorun.log`, а `decodes` остаётся равным 0.

---

## Эмуляция клиентов KiwiSDR (необязательно)

Начиная с версии 4.1.0 PhantomSDR-Plus умеет отвечать и на **протокол KiwiSDR**, так что программы, написанные для KiwiSDR — **AetherSDR**, `kiwiclient` и прочие — подключаются к вашему приёмнику напрямую, на том же хосте и порту, который вы уже публикуете. Он выключен, пока в конфигурацию, с которой работает ваш приёмник, не добавлено `[kiwi_emulation] enabled = true`.

Установщик предлагает его шагом 17; `./kiwi_install.sh` применяет его к уже установленному дереву.

> **Полная документация: [Эмуляция клиентов KiwiSDR](Aether_config.md)** — что делает мост, как его установить, каждый ключ `[kiwi_emulation]`, подключение клиента, уровень звука, S-метр, частота водопада и таблица симптомов.

---

## Настройка

### 1. Выберите файл конфигурации

Выберите файл конфигурации, подходящий для вашего SDR:

- `config-rtl.toml` — свистки RTL-SDR
- `config-rsp1a.toml` — SDRplay RSP1A
- `config-airspyhf.toml` — Airspy HF+ Discovery
- `config-fobos-hf.toml` — RigExpert Fobos SDR, HF1/HF2 с прямой оцифровкой (0-25 МГц)
- `config-fobos.toml` — RigExpert Fobos SDR, тракт RF (25-6000 МГц)
- `config-rx888mk2.toml` — RX888 MK2
- `config-hackrf.toml` — HackRF One
- `config.example.hackrf.toml` — HackRF One

В этом примере используем RTL-SDR.

### 2. Отредактируйте файл конфигурации

```bash
nano config-rtl.toml
```

#### Ключевые параметры

```toml
[server]
port = 9002                      # Web interface port (or everything else)
html_root = "frontend/dist/"     # Frontend location
otherusers = 1                   # Show other users (1=yes, 0=no)
threads = 2                      # Number of server threads

[websdr]
register_online = true           # Register on sdr-list.xyz (true/false)
name = "Your WebSDR Name"        # Display name
antenna = "Your Antenna Type"    # e.g., "Vertical", "Loop", "Dipole"
grid_locator = "AB12cd"          # Your Maidenhead grid square
hostname = "your.domain.com"     # Your domain or IP address

[input]
sps = 2048000                    # Sample rate (adjust for your coverage)
fft_size = 131072                # FFT size (higher = better resolution)
brightness_offset = -10          # Waterfall brightness adjustment
frequency = 145000000            # Base frequency in Hz (145 MHz for 2m)
signal = "iq"                    # "iq" for complex, "real" for real sampling
fft_threads = 2                  # FFT processing threads
accelerator = "opencl"           # "none", "cuda", or "opencl"
audio_sps = 12000                # Audio sample rate (keep at 12000)
audio_compression = "opus"       # "flac" or "opus"
smeter_offset = -2               # S-meter calibration
waterfall_size = 1024            # Waterfall FFT size
waterfall_compression = "zstd"   # Waterfall compression

[input.driver]
name = "stdin"                   # Input driver
format = "u8"                    # Sample format for RTL-SDR

[input.defaults]
frequency = 145500000            # Default tuning frequency
modulation = "FM"                # Default modulation mode
```

#### Ориентиры по частоте дискретизации

| Охват | Частота дискретизации | Размер FFT |
|-------|------------------------|------------|
| 2 МГц | 2048000 | 131072 |
| 3.2 МГц | 3200000 | 131072 |
| 10 МГц | 10000000 | 1048576 |
| 30 МГц | 30000000 | 2097152 |
| 60 МГц | 60000000 | 4194304 |

### 3. Настройте сведения о площадке

```bash
nano frontend/site_information.json
```

Отредактируйте следующие поля:

```json
{
  "siteSysop": "YourCallsign",
  "siteSysopEmailAddress": "your@email.com",
  "siteGridSquare": "AB12cd",
  "siteCity": "Your City, Country",
  "siteInformation": "https://github.com/sv1btl/PhantomSDR-Plus",
  "siteHardware": "Computer specifications",
  "siteSoftware": "PhantomSDR-Plus v4.2.0",
  "siteReceiver": "Your SDR model",
  "siteAntenna": "Antenna description",
  "siteNote": "Additional information",
  "siteIP": "http://your.domain.com:9002",
  "siteSDRBaseFrequency": 0,
  "siteSDRBandwidth": 2048000,
  "siteRegion": 1,
  "siteChatEnabled": true
}
```

**Районы IARU:**
- **1**: Европа, Африка, Ближний Восток, Северная Азия
- **2**: Америка (Северная, Центральная, Южная), Карибский бассейн
- **3**: Азиатско-Тихоокеанский регион, Океания

### 4. Настройте частотные маркеры (необязательно)

```bash
nano markers.json
```

Добавьте свои любимые частоты, ретрансляторы и вещательные станции.

### 5. Отредактируйте скрипт запуска

```bash
nano start-rtl.sh
```

Скрипт запуска — самодостаточный лаунчер со сторожевым процессом. Правьте только блок **RECEIVER CONFIGURATION** в начале файла, чтобы аргументы приёмника соответствовали вашей конфигурации:

```bash
# ═══ RECEIVER CONFIGURATION (the only receiver-specific part) ═══
RX_LABEL="RTL-SDR"
RX_COMM="rtl_sdr"                       # process name to monitor/kill
CONFIG="$PHANTOMDIR/config-rtl.toml"    # your .toml
FIFO="$PHANTOMDIR/rtl.fifo"
RX_ARGS="${RX_ARGS:--f 145000000 -s 2048000 -}"   # receiver args (edit these)
```

Параметры внутри `RX_ARGS`:
- `-f 145000000`: центральная частота (145 МГц)
- `-s 2048000`: частота дискретизации (2,048 MSPS)

`CONFIG` указывает на ваш `.toml`. Больше **ничего** в скрипте править не нужно — логика запуска/перезапуска/сторожа/журналирования универсальна. Аргументы приёмника можно также переопределить при запуске, не редактируя файл: `RX_ARGS="-f 145000000 -s 2048000 -" ./start-rtl.sh` (`RX888_ARGS` для `start-rx888mk2.sh`).

---

## Настройка для конкретных устройств SDR

### RTL-SDR

#### Установите инструменты RTL-SDR

```bash
sudo apt install -y rtl-sdr
```

#### Проверьте RTL-SDR

```bash
rtl_test
```

Нажмите Ctrl+C для остановки. Вы должны увидеть сведения о частоте дискретизации.

#### Отредактируйте конфигурацию

```bash
nano config-rtl.toml
```

Типичные настройки для RTL-SDR:
```toml
sps = 2048000
frequency = 145000000
signal = "iq"
format = "u8"
```

### Приёмники через SoapySDR (RSP1A, Fobos, Airspy HF+)

SDRplay RSP1A, RigExpert Fobos SDR и Airspy HF+ подключаются к серверу одинаково: драйвер SoapySDR для устройства и `rx_sdr` (из rx_tools), который передаёт его отсчёты в `spectrumserver`. Один сценарий на приёмник ставит всю цепочку:

| Приёмник | Сценарий | Пункт установщика | Сценарий запуска | Конфигурация |
|---|---|---|---|---|
| SDRplay RSP1A | `./setup-rsp1a.sh` | 3 | `start-rsp1a.sh` | `config-rsp1a.toml` |
| RigExpert Fobos SDR | `./setup-fobos.sh` | 5 | `start-fobos-hf.sh` (HF) / `start-fobos.sh` (RF) | `config-fobos-hf.toml` / `config-fobos.toml` |
| Airspy HF+ | `./setup-airspyhf.sh` | 6 | `start-airspyhf.sh` | `config-airspyhf.toml` |

Каждый сценарий:

- ставит git, cmake, компилятор, libusb и **SoapySDR** из пакетов вашего дистрибутива — он распознаёт apt, dnf, pacman и zypper, поэтому одинаково работает на Debian/Ubuntu, Fedora, Arch и openSUSE;
- собирает драйвер приёмника из исходников в `sdr_drivers/` (не отслеживается git);
- собирает **rx_tools** для `rx_sdr`, если `rx_sdr` ещё не установлен — одна копия служит всем приёмникам;
- ставит **правило udev** и добавляет вас в группу `plugdev`, чтобы сценарию запуска никогда не требовался `sudo` для устройства. **Один раз выйдите из системы и войдите снова**, чтобы группа вступила в силу;
- в конце проверяет, что SoapySDR действительно видит драйвер, и иначе останавливается с ошибкой.

Запускайте их от обычного пользователя — они сами вызывают `sudo`. Они идемпотентны: повторный запуск обновляет исходники драйвера через `git pull` и пересобирает. Установщик вызывает именно эти сценарии; на уже установленной станции запустите отдельно сценарий своего приёмника. Общая часть находится в `setup-sdr-common.sh`, который сам по себе не запускается. Две необязательные переменные действуют для всех трёх: `SDR_USER=<имя>` добавляет в `plugdev` другую учётную запись, а `SDR_SKIP_DEPS=1` пропускает установку пакетов.

При подключённом устройстве проверьте, что приёмник обнаружен:

```bash
SoapySDRUtil --find="driver=soapyMiri"   # RSP1A
SoapySDRUtil --find="driver=fobos"       # Fobos
SoapySDRUtil --find="driver=airspyhf"    # Airspy HF+
```

#### SDRplay RSP1A

`setup-rsp1a.sh` ставит **драйвер с открытым кодом**: libmirisdr-5, полученный обратной разработкой драйвер для микросхем Mirics MSi2500/MSi001 внутри RSP1 и RSP1A, с его модулем SoapySDR — SoapyMiri (`driver=soapyMiri`). Ему не нужны фоновая служба и root. Сценарий также вносит драйверы ядра `msi2500` и `msi001` в чёрный список в `/etc/modprobe.d/blacklist-msi2500.conf`, потому что они захватывают RSP1A как радиоустройство V4L2 раньше, чем его сможет открыть `rx_sdr`. Если устройство было подключено, пока они были загружены, один раз отключите и снова подключите его (или перезагрузитесь).

Закрытый API SDRplay (`driver=sdrplay`, с SoapySDRPlay и службой `sdrplay`) по-прежнему работает — приложенный файл `instructions-for-rsp1a` описывает такую установку. `start-rsp1a.sh` сам выбирает между ними: если в SoapySDR есть драйвер `sdrplay`, он использует API и сначала перезапускает службу `sdrplay`, иначе — libmirisdr-5. Станция, настроенная на API, поэтому продолжает работать без изменений. Чтобы задать драйвер принудительно, запускайте с `RX_DRIVER=miri` или `RX_DRIVER=sdrplay`. Выбранный драйвер записывается в `logwebsdr.txt` как `RSP1A driver: miri` или `RSP1A driver: sdrplay`.

#### RigExpert Fobos SDR

Fobos передаёт **только один тракт одновременно**, поэтому у него два сценария запуска, которые делят блокировку сторожа, как любой `start-*.sh`, — запуск одного останавливает другой:

- **`start-fobos-hf.sh`** — входы HF1/HF2 с прямой оцифровкой, 0-25 МГц, на порту 9003. В этом режиме нет гетеродина: АЦП всё время оцифровывает 0-25 МГц (`-f 0` задано намеренно, а предупреждение *Failed to set center freq* от rx_sdr ожидаемо). `rx_sdr` выдаёт CF32 на 50 Msps; маленький преобразователь `cf32_to_real` (его собирает `setup-fobos.sh` из `cf32_to_real.c`) оставляет канал I и масштабирует его в s16, поэтому в `config-fobos-hf.toml` стоят `signal="real"` и `format="s16"`.
- **`start-fobos.sh`** — тракт RF, 25-6000 МГц, IQ, на порту 9002. Выберите окно до первого запуска: `-f` (центр) и `-s` (частота дискретизации) в строке `RX_ARGS` должны совпадать с `frequency=` и `sps=` в `config-fobos.toml`. Поставляемые значения (97 МГц, 20 Msps) — лишь отправная точка, чтобы проверить, что всё работает.

> [!IMPORTANT]
> `config-fobos-hf.toml` поставляется с `accelerator="opencl"`: поток 50 Msps через БПФ на 1M бинов так же тяжёл, как 60 Msps у RX888, и на CPU он теряет отсчёты и греет машину. На машине без устройства OpenCL `spectrumserver` с этой настройкой не запустится — поставьте там `accelerator="none"`.

SoapyFobosSDR для сборки нужны заголовки и libfobos, и libfobos-sdr-agile, поэтому `setup-fobos.sh` собирает обе, даже для штатной прошивки. Поддержка Fobos пришла из сценария, который написала другая станция, запустив Fobos на PhantomSDR-Plus; значения HF в `config-fobos-hf.toml` — те, что сработали там.

#### Airspy HF+

`setup-airspyhf.sh` ставит libairspyhf из дистрибутива там, где она есть в пакетах (Debian и Ubuntu, Fedora, openSUSE), и собирает её из исходников там, где её нет (в Arch она есть только в AUR), затем собирает SoapyAirspyHF (`driver=airspyhf`). `start-airspyhf.sh` выдаёт 912 ksps IQ в CS16, что `config-airspyhf.toml` читает как `format="s16"`. Приложенный файл `instructions-for-airspy` описывает ручной путь.

### RX888 MK2

#### Установите инструменты RX888

```bash
# Install rx_tools
git clone https://github.com/rxseger/rx_tools.git
cd rx_tools
mkdir build && cd build
cmake ..
make -j4
sudo make install
sudo ldconfig

# Install RX888 firmware and support
# Follow manufacturer instructions
```

#### Запуск rx888_stream без sudo (правила udev)

По умолчанию USB-устройство Cypress FX3 у RX-888 доступно только root, поэтому `rx888_stream` потребовал бы `sudo`. Выполните один раз входящий в комплект вспомогательный скрипт, чтобы установить правила udev и добавить себя в группу `plugdev`:

```bash
./setup-rx888-udev.sh          # re-runs itself with sudo automatically
```

Он записывает `/etc/udev/rules.d/99-rx888.rules` для всех трёх идентификаторов продуктов Cypress FX3 (`04b4:00f1`/`00f3` — загрузчик и `04b4:8613` — с загруженной прошивкой), перезагружает udev и создаёт постоянную ссылку `/dev/rx888`. **Выйдите из системы и войдите снова** (чтобы применилось изменение группы) и один раз **переподключите устройство**; после этого `rx888_stream` — и лаунчер `start-rx888mk2.sh` — работают без `sudo`. Скрипт идемпотентен, его безопасно запускать повторно. Для другой учётной записи: `RX888_USER=<имя> ./setup-rx888-udev.sh`.

#### Отредактируйте конфигурацию

```bash
nano config-rx888mk2.toml
```

Типичные настройки для RX888:
```toml
sps = 60000000
frequency = 0
signal = "real"
format = "s16"
fft_size = 4194304
```

### HackRF One

Для HackRF ничего не собирается: `hackrf_transfer` из пакета `hackrf` вашего дистрибутива передаёт отсчёты прямо в `spectrumserver`. `./setup-hackrf.sh` (пункт 7 установщика) ставит этот пакет через apt, dnf, pacman или zypper и добавляет правило udev и группу `plugdev`, чтобы `start-hackrf.sh` работал без `sudo`, — после этого один раз выйдите из системы и войдите снова.

```bash
./setup-hackrf.sh    # installs the hackrf package and the udev rule
hackrf_info          # with the HackRF plugged in: must list the board
```

`start-hackrf.sh` передаёт одно окно одновременно. Выберите его до первого запуска: `-f` (центр) и `-s` (частота дискретизации) в его строке `RX_ARGS` должны совпадать с `frequency=` и `sps=` в `config-hackrf.toml`. `-l` и `-g` — усиление LNA (0-40 дБ, шаг 8 дБ) и VGA (0-62 дБ, шаг 2 дБ), а `-a 1` включает усилитель RF. Поставляемые значения (98 МГц, 20 Msps) — лишь отправная точка, чтобы проверить, что всё работает.

`hackrf_transfer` пишет 8-битный IQ **со знаком**, поэтому в конфигурации нужен `format="s8"`. В `config.example.hackrf.toml` до сентября 2026 года стояло `u8`; с `u8` каждый отсчёт сдвинут на 128 и водопад показывает только шум — проверьте старые копии.

---

## Проверка и тестирование

### 1. Пробный запуск

```bash
# For RTL-SDR
./start-rtl.sh
```

Это запускает сервер **в фоне** (скрипт отсоединяется и сразу возвращает управление) и начинает вести журнал в `logwebsdr.txt`.

### 2. Проверьте наличие ошибок

Скрипт записывает ход работы в `logwebsdr.txt` — следите за ним в реальном времени:

```bash
tail -f logwebsdr.txt
```

Обратите внимание на:
- ✅ `Starting the initialization script of the PhantomSDR Server`
- ✅ `<receiver> running (PID …)`
- ✅ `Server started normally`
- ❌ `Server … FAILED …` или `ERROR: receiver binary '…' not found` (исправьте аргументы приёмника либо `.toml`, или установите утилиту приёмника, затем снова запустите скрипт)

### 3. Откройте веб-интерфейс

Перейдите в браузере по адресу:
```
http://localhost:9002
```

(Замените номер порта на настроенный вами)

### 4. Проверьте работоспособность

- Водопад должен отображаться
- Звук должен воспроизводиться при щелчке по сигналам
- S-метр должен реагировать на сигналы
- Счётчик пользователей должен показывать «1»

### 5. Проверьте с другого устройства

С другого компьютера в вашей сети:
```
http://YOUR_SERVER_IP:9002
```

### 6. Проверьте потребление ресурсов

```bash
# Monitor CPU usage
htop

# Monitor GPU usage (if OpenCL/CUDA enabled)
nvidia-smi  # For NVIDIA
radeontop   # For AMD

# Monitor network usage
iftop
```

### 7. Остановите сервер

Сервер работает в фоне под сторожевым процессом, поэтому **Ctrl+C его не остановит** (а сторож просто перезапустит его). Используйте общий скрипт остановки, работающий для любого приёмника: он сначала останавливает сторожа, затем приёмник и `spectrumserver`:

```bash
./stop-websdr.sh
```

---

## Настройка автозапуска

### С помощью systemd (рекомендуется)

#### 1. Создайте файл службы

```bash
sudo nano /etc/systemd/system/phantomsdr.service
```

Добавьте следующее содержимое (поправьте пути и пользователя):

```ini
[Unit]
Description=PhantomSDR-Plus WebSDR Server
After=network.target

[Service]
Type=simple
User=youruser
WorkingDirectory=/home/youruser/PhantomSDR-Plus
# Run the watchdog in the FOREGROUND (note the --watchdog flag) so systemd can
# track it. Do NOT use the plain "./start-rtl.sh" here — that form detaches into
# the background and exits, which systemd would treat as the service stopping.
ExecStart=/home/youruser/PhantomSDR-Plus/start-rtl.sh --watchdog
ExecStop=/home/youruser/PhantomSDR-Plus/stop-websdr.sh
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

> Процесс `--watchdog` уже сам перезапускает приёмник и `spectrumserver`; `Restart=always` — лишь подстраховка на редкий случай, когда завершится сам сторож. Поскольку здесь сервером управляет systemd, можно использовать `systemctl start/stop/restart` и `journalctl -u phantomsdr -f` вместо ручного запуска скриптов.

#### 2. Включите и запустите службу

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable service to start on boot
sudo systemctl enable phantomsdr.service

# Start service now
sudo systemctl start phantomsdr.service

# Check status
sudo systemctl status phantomsdr.service
```

#### 3. Управление службой

```bash
# Start
sudo systemctl start phantomsdr

# Stop
sudo systemctl stop phantomsdr

# Restart
sudo systemctl restart phantomsdr

# View logs
sudo journalctl -u phantomsdr -f
```

### С помощью Screen (альтернатива)

> Обычно не требуется: `./start-rtl.sh` уже уходит в фон (через `setsid`) и продолжает работать после выхода из системы, со своим сторожевым процессом. Screen полезен, только если вам специально нужен интерактивный сеанс для запуска формы переднего плана `./start-rtl.sh --watchdog`.

#### 1. Установите Screen

```bash
sudo apt install -y screen
```

#### 2. Запустите в сеансе Screen

```bash
screen -S phantomsdr
./start-rtl.sh
```

Нажмите Ctrl+A, затем D, чтобы отсоединиться.

#### 3. Вернитесь к сеансу

```bash
screen -r phantomsdr
```

---

## Тепловая защита процессора

> 📖 **Полное руководство: [THERMAL_GUARD.md](THERMAL_GUARD.md)** — четыре режима и что должен сделать сисоп в каждом, работа без панели, этап throttle без root, проверка и устранение неполадок.

В составе PhantomSDR-Plus есть страж, который останавливает сервер, если процессор достигает опасной температуры, и запускает его снова после остывания. Пороги он выводит из критического порога, публикуемого вашим собственным процессором, так что считать ничего не нужно, и работает он с любым способом запуска и остановки.

**Если вы используете панель администратора, она у вас уже есть** — защита работает внутри панели и настраивается на её странице «Настройки». См. [руководство по панели администратора](ADMIN_PANEL_SETUP.md#thermal-guard). Остальная часть этого раздела — для установок **без** панели.

### 1. Посмотрите, что защита видит на вашей машине

```bash
cd ~/PhantomSDR-Plus
python3 thermal_guard.py --once
```

```
sensor     : hwmon:coretemp
temperature: 58.0 C
crit       : 100.0 C
mode       : log
thresholds : warn 88.0  throttle 92.0  stop 95.0  resume 75.0 (C)
cpufreq    : not writable — throttle stage disabled
```

Используются только настоящие датчики на кристалле процессора (`coretemp`, `k10temp`, `zenpower`, `cpu_thermal`); `acpitz` и безымянные тепловые зоны намеренно игнорируются, поскольку они часто сообщают температуру корпуса или платы на десятки градусов ниже процессорной. Если выводится `sensor : NONE`, эту машину защитить нельзя — обычное дело на VPS или внутри контейнера — и защита останется неактивной, а не будет делать вид.

Устанавливать ничего не нужно: `thermal_guard.py` использует только стандартную библиотеку Python.

### 2. Настройте её

Защита читает `admin_config.json` рядом с `thermal_guard.py`. Создайте его, если у вас такого нет — без панели его и не будет. Минимально полезный файл:

```json
{
  "sdr_process_name": "spectrumserver",
  "stop_script":  "stop-websdr.sh",
  "start_script": "start-rx888mk2.sh",
  "thermal_mode": "stop+restart"
}
```

- `thermal_mode` — `log` (только запись, по умолчанию), `throttle`, `stop` или `stop+restart`. **Именно его нужно задать**, потому что защита поставляется бездействующей: если её не трогать, она лишь записывает, что *сделала бы*. Его же можно передать в командной строке как `--mode stop+restart` — это имеет приоритет над файлом, так что если все прочие значения по умолчанию вас устраивают, файл конфигурации вообще не нужен.
- `stop_script` / `start_script` — чем она останавливает и запускает ваш сервер. Без скрипта остановки она прибегает к `SIGTERM`, а через 10 секунд — к `SIGKILL` по `sdr_process_name`. Без скрипта запуска она останавливает, но никогда не перезапускает.
- Пороги и времена тоже можно задать здесь, теми же именами ключей, что и в панели, — полная таблица есть в [руководстве по панели администратора](ADMIN_PANEL_SETUP.md#thermal-guard).

> **Если вашим SDR-сервером управляет systemd**, направьте `stop_script` на небольшой скрипт, выполняющий `systemctl stop ваш-юнит`, вместо того чтобы защита посылала сигнал процессу напрямую. Защита победит в любом случае — пока процессор слишком горяч, она повторяет остановку каждые 2 секунды, так что всё, что оживляет сервер, будет отменено, — но чистая остановка лучше борьбы каждые две секунды.

### 3. Запустите её как службу

В репозитории есть готовый юнит `thermal-guard.service`. Отредактируйте в нём `User=` и два пути, затем:

```bash
sudo cp thermal-guard.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now thermal-guard
systemctl status thermal-guard
```

`User=` должен быть учётной записью, которой разрешено запускать ваши скрипты запуска и остановки, — обычно тот же пользователь, что запускает SDR-сервер. **Защита, работающая от пользователя, который не может остановить сервер, оставляет вас без защиты, при этом выглядя защищённой.**

Чтобы взвести защиту из юнита, а не из файла конфигурации, добавьте `--mode` в `ExecStart`:

```ini
ExecStart=/usr/bin/python3 -u /home/sysop/PhantomSDR-Plus/thermal_guard.py --mode stop+restart
```

Без systemd:

```bash
cd ~/PhantomSDR-Plus
nohup python3 -u thermal_guard.py --mode stop+restart >> thermal.log 2>&1 &
```

`python3 thermal_guard.py --help` перечисляет все параметры, включая `--config` для файла конфигурации не рядом со скриптом.

### 4. Понаблюдайте, потом доверяйте

Всё, что делает защита, записывается в `crash.log` в каталоге PhantomSDR-Plus, по одному событию на строку:

```
[THERMAL] warn: 89.0C (warn=88.0 crit=100.0) sustained 31s
[THERMAL] STOPPED server: 96.0C sustained 62s (stop=95.0 crit=100.0) — Started stop-websdr.sh
[THERMAL] lockout: process reappeared at 94.0C — re-stopped [3 time(s) so far]
[THERMAL] recovered: 74.0C held below 75.0 — lockout cleared
```

```bash
grep THERMAL crash.log
```

Сначала оставьте `thermal_mode` в `"log"` на неделю и почитайте этот файл после тяжёлых моментов — полной пересборки, жаркого дня. Если там ничего нет, ваша машина даже близко не подходила. После этого переключите режим на `stop`.

Прежде чем полагаться на защиту, проверьте весь путь один раз, добавив фиктивное показание выше вашего порога остановки:

```json
"thermal_test_temp": 97
```

Защита воспримет его как настоящее, и warn → stop → блокировка → восстановление → перезапуск пройдут по вашему желанию. Уберите строку (или задайте `null`), чтобы вернуться к реальному датчику. В режиме `stop` сервер при этом действительно останавливается и ваши слушатели отключаются, поэтому делайте это, когда никого нет, или проверяйте в режиме `log`, где видно, что *произошло бы*, ничего не трогая.

---

## Устранение неполадок

### Ошибки сборки

#### Проблемы с зависимостями

```bash
# Ubuntu: Install missing dependencies
sudo apt install --fix-broken

# Fedora: Install missing dependencies
sudo dnf install <package-name>
```

#### Не удаётся выполнить конфигурацию Meson

```bash
# Clean and reconfigure
rm -rf build
meson setup build --buildtype=release
```

#### `meson setup` завершается с `ModuleNotFoundError: No module named 'mesonbuild'`

```
Traceback (most recent call last):
  File "/home/<user>/.local/bin/meson", line 3, in <module>
    from mesonbuild.mesonmain import main
ModuleNotFoundError: No module named 'mesonbuild'
```

С исходным деревом всё в порядке. Оставшаяся установка `pip install --user meson` оставила скрипт запуска в `~/.local/bin`, который в `PATH` идёт раньше `/usr/bin` и потому скрывает рабочую копию, установленную менеджером пакетов. Обновление дистрибутива (например, Ubuntu 24.04 → 26.04) переводит Python на новую версию, старый `site-packages` с `mesonbuild` больше не находится в пути импорта, и скрипт падает, ничего не успев сделать. То же самое может случиться с `ninja`.

Установщик это распознаёт и обходит на время запуска, предупреждая вас, но систему всё же почините:

```bash
rm -f ~/.local/bin/meson
hash -r
meson --version        # должна вывести версию
```

Если вы предпочитаете оставить meson, установленный через pip, переустановите его для того Python, который сейчас есть в системе:

```bash
python3 -m pip install --user --force-reinstall --break-system-packages meson
```

#### `meson setup` останавливается с `Clock skew detected`

```
ERROR: Clock skew detected. File /home/pi/PhantomSDR-Plus/build/../meson.build has a time stamp 10392.2144s in the future.
```

С исходным деревом всё в порядке: системные часы отстают от файлов. meson и ninja отказываются собирать, когда входной файл новее текущего времени, — они не могут определить, что устарело. Так бывает на Raspberry Pi без батарейки в держателе RTC: каждая загрузка начинается с последнего известного времени, и сборка, запущенная до синхронизации NTP, видит всё дерево датированным будущим. То же самое — с деревом, распакованным или скопированным с машины, часы которой спешат.

Сначала исправьте часы:

```bash
timedatectl                       # время верное? NTP синхронизирован?
sudo timedatectl set-ntp true
```

Подождите несколько секунд и запустите установщик снова. Он проверяет это перед вызовом meson и предлагает сбросить проблемные временные метки (`PHANTOM_FIX_CLOCK_SKEW=y|n`). Вручную, из каталога с исходниками:

```bash
find . -path ./build -prune -o -path ./.git -prune -o -newermt now -print0 | xargs -0r touch
```

#### Бэкенд собрался, но веб-страницы нет

Симптом — установка, которая выглядит почти удавшейся: `build/spectrumserver` на месте, сервер запускается, а браузер не получает ничего, потому что каталог `frontend/dist/` так и не был создан. Поищите в выводе установщика:

```
[vite-plugin-top-level-await] missing field `type`
    at Compiler.printSync (node_modules/@swc/core/index.js:257:29)
error during build:
   ❌ Failed: Default
```

`vite-plugin-top-level-await` требует `@swc/core` `^1.12.14`, поэтому чистый `npm install` разрешается в 1.16.0, чей `printSync()` отвергает синтаксическое дерево, которое ему передаёт плагин. К вашему дистрибутиву это отношения не имеет: теперь рабочую версию закрепляет каждый установщик, а также `frontend/package.json`. Машина, установленная до появления этого закрепления, продолжает работать, пока не удалён её `node_modules` — вот почему при переустановке проблема возникает словно из ниоткуда.

Если вы чините более старую копию вручную:

```bash
cd frontend
npm pkg set 'overrides.@swc/core=1.15.33'
npm install
./build-all.sh
```

### Ошибки времени выполнения

#### Порт уже занят

```bash
# Find process using port
sudo lsof -i :9002

# Kill process
sudo kill -9 <PID>
```

#### Отказано в доступе к SDR

```bash
# Add user to plugdev group
sudo usermod -a -G plugdev $USER

# Reload groups (or log out and back in)
newgrp plugdev
```

Для **RX-888 MkII** одного этого мало — устройству Cypress FX3 нужны ещё и правила udev. Запустите входящий в комплект скрипт (он устанавливает правила *и* добавляет вас в `plugdev`), затем выйдите и войдите снова и переподключите устройство:

```bash
./setup-rx888-udev.sh
```

#### Проблемы со звуком

```bash
# Try different codec
# Edit config file and change:
audio_compression = "flac"  # or "opus"

# Rebuild
cd frontend && npm run build && cd ..
```

### Проблемы с OpenCL

#### clinfo не показывает устройств

```bash
# Verify drivers are loaded
sudo clinfo

# Check OpenCL ICD files
ls /etc/OpenCL/vendors/

# Reinstall drivers (Intel example)
sudo apt remove --purge intel-opencl-icd
sudo apt install intel-opencl-icd
```

#### Производительность не выросла

```bash
# Verify OpenCL is enabled in config
accelerator = "opencl"

# Try different device
# Add to config file:
[input.opencl]
device_id = 0  # Try 0, 1, 2, etc.
```

### Проблемы с сетью

#### Нет доступа с других устройств

```bash
# Check firewall
sudo ufw status
sudo ufw allow 9002/tcp

# Or disable firewall temporarily for testing
sudo ufw disable
```

#### Высокая задержка

```bash
# Reduce waterfall size in config
waterfall_size = 512

# Increase buffer size
buffer_size = 16384

# Use Opus instead of FLAC
audio_compression = "opus"
```

### Проблемы с устройством SDR

#### RTL-SDR не найден

```bash
# Check if device is recognized
lsusb | grep Realtek

# Test with rtl_test
rtl_test

# Try blacklisting DVB-T drivers
echo "blacklist dvb_usb_rtl28xxu" | sudo tee /etc/modprobe.d/blacklist-rtl.conf
sudo rmmod dvb_usb_rtl28xxu
```

#### SDRplay не найден

`grep "RSP1A driver" logwebsdr.txt` показывает, какой драйвер выбрал `start-rsp1a.sh`.

С открытым драйвером (libmirisdr-5, `RSP1A driver: miri`):

```bash
# The kernel's msi2500 driver must not hold the device
lsmod | grep msi2500 && sudo modprobe -r msi2500 msi001

# Test with SoapySDR
SoapySDRUtil --find="driver=soapyMiri"
```

С API SDRplay (`RSP1A driver: sdrplay`):

```bash
# Check API installation
systemctl status sdrplay

# Restart API
sudo systemctl restart sdrplay

# Test with SoapySDR
SoapySDRUtil --find="driver=sdrplay"
```

#### Fobos или Airspy HF+ не найден

```bash
SoapySDRUtil --info | grep -i factories   # must list fobos / airspyhf
SoapySDRUtil --find="driver=fobos"         # or driver=airspyhf
id | grep plugdev                          # log out and back in if missing
```

Если драйвера нет в списке, запустите `./setup-fobos.sh` или `./setup-airspyhf.sh` ещё раз: при сбое сборки или проверки SoapySDR он остановится и назовёт причину.

---

## Оптимизация производительности

### Оптимизация процессора

```toml
# Adjust thread counts based on CPU cores
[server]
threads = 4  # Set to number of cores

[input]
fft_threads = 4  # Set to number of cores
```

### Оптимизация памяти

```toml
# Reduce memory usage
[input]
waterfall_size = 512  # Lower value = less memory
fft_size = 65536      # Lower value = less memory
```

### Оптимизация сети

```toml
# Optimize for limited bandwidth
[input]
audio_compression = "opus"  # More efficient than FLAC
waterfall_compression = "zstd"  # Efficient compression
```

---

## Обновление PhantomSDR-Plus

Начиная с версии 4.1.0 в репозитории есть **`update.sh`** — средство обновления, которое приводит установленный приёмник в соответствие с опубликованным деревом, **не трогая файлы, которые делают его именно вашей станцией**. Оно заменяет самодельный сценарий с `git pull`, который предлагали писать прежние редакции этого руководства, и git ему вовсе не нужен: опубликованное дерево загружается как tarball и сравнивается с вашим файл за файлом. Поэтому оно работает одинаково — клонировали ли вы репозиторий, распаковали `update.zip` или скопировали дерево с флешки.

### Если в вашей установке ещё нет update.sh

Старое дерево этого сценария не содержит. Загрузите его один раз — это единственный шаг всей процедуры, который вы когда-либо делаете вручную:

```bash
cd ~/PhantomSDR-Plus
curl -fLO https://raw.githubusercontent.com/sv1btl/PhantomSDR-Plus/main/update.sh
chmod +x update.sh
```

Дальше всё — исходники, frontend, документация, установщики и сам `update.sh` — приходит через этот инструмент.

### Шаг 1 — посмотреть, что изменилось бы (ничего не записывается)

```bash
cd ~/PhantomSDR-Plus
./update.sh
```

Загружает опубликованное дерево, сравнивает его с вашим и печатает отчёт. Не записывает ровно ничего, поэтому запускать можно в любой момент, в том числе на работающем в эфире приёмнике. Код возврата `0` — вы уже в актуальном состоянии, `10` — обновление ждёт; так задание cron сможет сообщить вам, что появилась работа.

### Шаг 2 — применить

```bash
./update.sh --apply
```

Три вида файлов обрабатываются по-разному, и в этом различии весь смысл:

| Файлы | Что происходит |
|---|---|
| `config*.toml`, `markers.json`, `admin_config.json`, `autorun.json`, `frequencylist/`, `chat_history.txt`, `frontend/variant.json`, `frontend/site_information.json`, журналы, `build/`, `frontend/dist/` | **Никогда не трогаются** и даже не появляются в вопросах. Именно они делают машину *вашим* приёмником. |
| `start-*.sh`, `stop-websdr.sh`, юниты `*.service`, `install*.sh`, `recompile.sh`, `setup_admin.sh`, `smeter_theme.sh`, `proxy.py`, `admin_server.py`, `thermal_guard.py`, `frontend/src/bands-config.js` | **Спрашивается всегда**, потому что это файлы, которые оператор имеет основания изменить. |
| Всё остальное | Обновляется после того, как копия старого файла сохранена в `.update-backups/`. |

Для каждого файла средней группы показываются различия и предлагаются три варианта:

```
  ❓ start-rx888mk2.sh  [K]eep mine / [u]pstream / [b]oth  (ENTER = Keep mine)
```

* **Keep mine** — ваш файл остаётся ровно таким, как есть.
* **upstream** — устанавливается новая версия, ваша предварительно сохраняется.
* **both** — новая версия кладётся рядом с вашей под именем `start-rx888mk2.sh.new`, чтобы вы
перенесли свои правки, когда будет удобно.

**Каким будет первый запуск.** В первый раз нет записи о том, из какой версии происходят
ваши файлы, поэтому вам предъявляется каждый файл средней группы — около десяти вопросов. Отвечайте так:

| Ваш случай | Ответ |
|---|---|
| Вы никогда не правили этот файл | `u` — взять новую версию. Обычный случай. |
| Вы его правили (свои `RX888_ARGS`, привязка к ядрам, изменённый юнит) | `b` — ваш остаётся, новый кладётся рядом как `<файл>.new`. |
| Вы не уверены | ENTER — ваш остаётся, ничего не теряется, сравните потом. |

Ваша конфигурация в этом никогда не участвует: вопросы касаются только сценариев и юнитов служб.

`update.sh` записывает в `.update-state/` версию каждого установленного файла. Поэтому уже со
второго запуска он отличает файл, изменённый **вами**, от файла, который просто устарел, и останавливается с вопросом только по тем, которых вы действительно касались.

Прежде чем что-либо записать, он останавливает приёмник, панель администратора и обратный прокси **того каталога, который обновляет**: то, что обслуживает другой каталог, перечисляется и оставляется работать, так что второй клон можно обновлять, пока первый остаётся в эфире. По завершении он запускает обратно ровно то, что остановил. Если изменились исходные файлы или файлы frontend, он предложит запустить для вас `recompile.sh`. Ничего никогда не удаляется: файлы, исчезнувшие из репозитория, просто сообщаются и удаляются только по вашему требованию — ключом `--prune`.

### Отмена обновления

```bash
./update.sh --restore LAST
```

Каждый перезаписанный файл хранится в `.update-backups/<отметка времени>/` со своим
`restore.sh`; сохраняются три последних запуска.

### Другие возможности

```bash
./update.sh --apply --yes     # никогда не спрашивает; всё изменённое вами СОХРАНЯЕТСЯ
./update.sh --ref v4.1.0      # метка, ветка или коммит вместо текущего дерева
./update.sh --list-excludes   # печатает правила «не трогать» так, как они действуют здесь
./update.sh --verbose         # перечисляет все файлы, а не только первые 40
```

Свои правила «не трогать» добавляются по одному шаблону в строке в файле `update-exclude.txt` в корневой папке установки.

### Если сборка не проходит на очень старой установке

`update.sh` обновляет файлы, а не системные пакеты. Если ваше дерево настолько старое, что
сборке теперь нужны библиотеки, которых у вас нет, `recompile.sh` остановится с ошибкой компилятора или meson. Это не сломанное обновление — не хватает зависимостей:

```bash
./install.sh
```

Установщик обновляется тем же запуском, и ваша конфигурация переживает и его.

### Обновление вручную

Если вы предпочитаете применять набор файлов сами:

```bash
cd ~
unzip -o update.zip
cd PhantomSDR-Plus
./stop-websdr.sh
cp -a ~/update/. .
chmod +x *.sh
./recompile.sh
./start-rx888mk2.sh          # или сценарий запуска вашего приёмника
```

Сначала сохраните копию своей конфигурации — `config-*.toml`,
`frontend/site_information.json`, `admin_config.json` и `markers.json`, — потому что набор
файлов не может отличить ваши правки от правок выпуска. Именно эту задачу и решает
`update.sh`.

---

## Резервное копирование и восстановление

### Файлы для резервной копии

- Файлы конфигурации: `*.toml`
- Сведения о площадке: `frontend/site_information.json`
- Маркеры: `markers.json`
- Пользовательские скрипты: `start-*.sh`, `stop-*.sh`
- История чата: `chat_history.txt`
- Фоновое изображение: `frontend/src/assets/background.jpg`

### Команда резервного копирования

```bash
cd ~/PhantomSDR-Plus
tar -czf phantomsdr-backup-$(date +%Y%m%d).tar.gz \
  *.toml \
  *.sh \
  markers.json \
  chat_history.txt \
  frontend/site_information.json \
  frontend/src/assets/background.jpg
```

### Команда восстановления

```bash
tar -xzf phantomsdr-backup-YYYYMMDD.tar.gz
```

---

## Вопросы безопасности

### Настройка межсетевого экрана

```bash
# Allow only necessary ports
sudo ufw allow 9002/tcp
sudo ufw enable
```

### Обратный прокси (необязательно)

Рассмотрите использование nginx или Apache в качестве обратного прокси для:
- шифрования SSL/TLS
- привязки доменного имени
- балансировки нагрузки
- контроля доступа

### Ограничение числа пользователей

Отредактируйте `config.toml`:
```toml
[server]
max_users = 100  # Limit concurrent users
```

---

## Получение помощи

### Ресурсы

- **Документация**: это руководство, README.md, USER_GUIDE.md
- **GitHub Issues**: https://github.com/sv1btl/PhantomSDR-Plus/issues
- **Живая демонстрация**: http://phantomsdr.no-ip.org:8900/

### Сообщения о проблемах

Сообщая о проблеме, укажите:
1. операционную систему и её версию
2. модель устройства SDR
3. содержимое файла конфигурации
4. сообщения об ошибках
5. потребление системных ресурсов (ЦП, ОЗУ, GPU)

### Поддержка сообщества

- Прежде чем создавать новые issue, просмотрите существующие на GitHub
- Приводите подробные сведения о своей конфигурации
- Прилагайте журналы и сообщения об ошибках
- Будьте терпеливы и уважительны

---

## Приложение А: полный список зависимостей

### Список пакетов Ubuntu 24.04

```
build-essential
cmake
pkg-config
meson
libfftw3-dev
libwebsocketpp-dev
libflac++-dev
zlib1g-dev
libzstd-dev
libboost-all-dev
libopus-dev
libliquid-dev
git
util-linux (taskset — for the autorun spot reporter)
psmisc
wget
curl
rtl-sdr (for RTL-SDR)
airspy (for Airspy)
hackrf (for HackRF)
libclfft-dev (for OpenCL)
ocl-icd-opencl-dev (for OpenCL)
clinfo (for OpenCL)
```

---

## Приложение Б: примеры конфигурации

### Пример 1: RTL-SDR для УКВ

```toml
[input]
sps = 2048000
frequency = 145000000
signal = "iq"

[input.driver]
format = "u8"

[input.defaults]
frequency = 145500000
modulation = "FM"
```

### Пример 2: RX-888 mk2 для КВ (0-30 МГц)

Приёмник, который использует большинство сисопов. Это полный раздел `[input]`, а не фрагмент, со значениями из `config-rx888mk2.toml`, входящего в репозиторий.

```toml
[input]
sps = 60000000            # 0-30 МГц прямой оцифровкой
fft_size = 4194304        # см. примечание ниже
fft_threads = 8
brightness_offset = -9    # отрицательнее, если на водопаде чёрные области
frequency = 0             # основная полоса: RX-888 оцифровывает от постоянного тока
signal = "real"           # не "iq" - прямая оцифровка даёт вещественный поток
accelerator = "opencl"    # "none", если среды OpenCL нет
audio_sps = 12000
audio_compression = "flac"
waterfall_size = 1024
waterfall_compression = "zstd"
smeter_offset = 5
analog_smeter_offset = 5

[input.driver]
name = "stdin"
format = "s16"

[input.defaults]
frequency = 7120000
modulation = "LSB"
```

Его питает `rx888_stream` — это делает за вас `start-rx888mk2.sh`:

```bash
rx888_stream -f /path/to/SDDC_FX3.img -s 60000000 -g 50 -a 0 -m low --pga -d -r -o - \
  | build/spectrumserver --config config-rx888mk2.toml
```

**О `fft_size`:** при 60 MSPS правильный размер — 4194304. 8388608 удваивает разрешение водопада, а вместе с ним память и процессорную стоимость каждого преобразования; на большинстве машин более узкие бины оплачиваются потерянными кадрами. Начните с 4194304 и повышайте только если у сервера есть заметный запас.

### Пример 3: HackRF для широкополосной ЧМ

```toml
[input]
sps = 10000000
frequency = 100900000
signal = "iq"

[input.driver]
format = "s8"

[input.defaults]
frequency = 100900000
modulation = "WBFM"
```

---

**Установка завершена! Теперь у вас должен быть полностью работоспособный сервер PhantomSDR-Plus.**

**73 de SV1BTL & SV2AMK**
