# RADE v1 — Руководство по ручной установке
### Все Linux — Ubuntu / Debian / Fedora / Arch / Raspberry Pi OS · PhantomSDR-Plus

> **Предусловие:** исправленные файлы (`rade_helper.py`, `rade.sh`, `audio.js`, `App.svelte`) уже размещены в дереве каталогов PhantomSDR-Plus. Это руководство выстраивает всё остальное вокруг них.

> [!IMPORTANT]
> **Для обычной установки это руководство не нужно.** `./install_rade.sh` в папке PhantomSDR-Plus выполняет за вас каждый шаг ниже — системные пакеты, модули Python, сборку radae, проверку весов модели и запуск sidecar-а — и одинаково работает на системах с apt, pacman, dnf и zypper. `./install.sh` и четыре установщика для дистрибутивов предлагают запустить его в рамках обычной установки. Следуйте этому руководству только для ручной установки, для системы, которую сценарий не покрывает, или чтобы починить отдельный шаг вручную.

> **Пользователям Raspberry Pi:** это и ваше руководство. Raspberry Pi OS — это Debian, поэтому всюду следуйте блокам для Debian и читайте примечания **Raspberry Pi / Bookworm** там, где они встречаются: они охватывают два отличия Pi — PEP 668 и колесо torch только для CPU.

---

## Шаг 1 — Системные пакеты

Выберите блок, соответствующий вашему дистрибутиву.

### Ubuntu / Debian / Raspberry Pi OS

```bash
sudo apt update
sudo apt install -y \
    build-essential cmake git \
    python3 python3-pip \
    nodejs npm \
    alsa-utils
```

### Fedora / RHEL / Rocky

```bash
sudo dnf install -y \
    gcc gcc-c++ cmake git \
    python3 python3-pip \
    nodejs npm \
    alsa-utils
```

### Arch / Manjaro

```bash
sudo pacman -Sy --needed \
    base-devel cmake git \
    python python-pip \
    nodejs npm \
    alsa-utils
```

### Проверка версии Node.js (все дистрибутивы)

Сборка веб-интерфейса RADE требует Node.js 22 или новее:

```bash
node --version
```

Если версия ниже 22.x, установите его через `nvm` (любой дистрибутив, без root):

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.4/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install 22 && nvm use 22 && nvm alias default 22
```

> **Не через NodeSource.** `deb.nodesource.com` и `rpm.nodesource.com` теперь отвечают HTTP 403 на любом пути репозитория, поэтому старая строка `curl -fsSL https://deb.nodesource.com/setup_NN.x | sudo -E bash -` больше не работает — а в Debian/Ubuntu она оставляет источник apt, который ломает каждый последующий `apt update`. По той же причине скрипты установки используют `nvm`.

---

## Шаг 2 — Пакеты Python

### Ubuntu 24.04 и старше / Fedora / Arch

На этих системах работает обычная команда `pip3 install`:

```bash
pip3 install websockets matplotlib numpy scipy

# torch — CPU-only build (~150–250 MB, avoids the ~3 GB CUDA wheel)
# Use this if the server has no GPU, which is the typical case for a WebSDR
pip3 install torch --index-url https://download.pytorch.org/whl/cpu
```

> Если на вашем сервере **всё же** есть видеокарта NVIDIA с установленной CUDA, можно опустить `--index-url` и получить полную сборку с CUDA. Для RADE это не даёт выигрыша в производительности — `radae_rxe.py` использует PyTorch только для матричных операций на CPU.

### Ubuntu 23.04+ / Debian Bookworm+ / Raspberry Pi OS (системы с PEP 668)

Эти дистрибутивы блокируют простую команду `pip3 install`. Добавьте флаг:

```bash
# All packages except torch
pip3 install --break-system-packages websockets matplotlib numpy scipy

# torch — CPU-only build
pip3 install --break-system-packages torch \
    --index-url https://download.pytorch.org/whl/cpu
```

> **Raspberry Pi / Bookworm — два правила, которые кусаются:**
>
> 1. Каждой команде `pip3 install` требуется `--break-system-packages`
> (применение PEP 668). Без этого установка полностью блокируется.
> 2. Простая команда `pip3 install torch` скачивает сборку с CUDA (~3 ГБ).
> На Pi нет CUDA — используйте индекс только для CPU, чтобы получить лёгкую сборку ARM64 (~150 МБ).

Как вариант, используйте виртуальное окружение и обойдитесь без флага совсем:

```bash
python3 -m venv ~/rade-venv
source ~/rade-venv/bin/activate
pip install websockets matplotlib numpy scipy torch \
    --index-url https://download.pytorch.org/whl/cpu
```

> При работе с venv предваряйте все последующие вызовы `python3` из этого руководства командой `source ~/rade-venv/bin/activate` либо используйте полный путь `~/rade-venv/bin/python3`.

### Проверка

```bash
python3 -c "import websockets, matplotlib, torch, numpy, scipy; print('All OK')"
```

Ожидаемый вывод:
```
All OK
```

---

## Шаг 3 — Клонирование и сборка репозитория radae

Декодер RADE находится в репозитории, отдельном от codec2. `freedv_rx` из codec2 **не** поддерживает RADE v1.

```bash
# Remove any previous incomplete clone
rm -rf ~/radae

# Clone
git clone https://github.com/drowe67/radae.git ~/radae
cd ~/radae

# Build
mkdir build && cd build
cmake ..
make -j$(nproc)
```

### Убедитесь, что lpcnet_demo собран

```bash
ls -la ~/radae/build/src/lpcnet_demo
```

Ожидается: исполняемый файл присутствует и имеет права на выполнение.

### Убедитесь, что веса модели на месте

```bash
ls ~/radae/model19_check3/checkpoints/checkpoint_epoch_100.pth
```

Ожидается: файл `.pth` в списке. Веса поставляются вместе с репозиторием — отдельная загрузка не нужна.

---

## Шаг 4 — Проверка цепочки декодирования

Этот шаг подтверждает, что вся автономная цепочка работает, прежде чем подключать её к браузеру. Выполняйте из `~/radae`:

```bash
cd ~/radae
```

### 4a — Сформируйте тестовый сигнал, закодированный RADE

```bash
./inference.sh model19_check3/checkpoints/checkpoint_epoch_100.pth \
    wav/brian_g8sez.wav /dev/null \
    --rate_Fs --pilots --pilot_eq --eq_ls --cp 0.004 \
    --write_rx rx.f32 --auxdata
```

Дождитесь завершения. Последние выведенные строки должны быть:
```
loss: 0.741 Auxdata BER: 0.012
```

### 4b — Декодируйте и прослушайте

```bash
cat rx.f32 \
    | python3 radae_rxe.py \
        --model_name model19_check3/checkpoints/checkpoint_epoch_100.pth \
    | ./build/src/lpcnet_demo -fargan-synthesis - - \
    | aplay -f S16_LE -r 16000
```

Вы должны услышать голос. Вывод показывает захват синхронизации:
```
  1 state: search     ...
  5 state: sync       ... SNRdB:  4.03 uw_err: 0
Playing raw data 'stdin' : Signed 16 bit Little Endian, Rate 16000 Hz, Mono
```

> **Сообщения `underrun!!!` во время этой проверки ожидаемы и безвредны.** Они появляются потому, что `radae_rxe.py` обрабатывает медленнее, чем идёт файловый ввод-вывод. При живом приёме они не возникают — браузер подаёт звук в реальном времени.

### 4c — Убедитесь, что sidecar запускается корректно

```bash
python3 ~/PhantomSDR-Plus/rade_helper.py
```

Ожидаемый вывод (без строк WARNING):
```
[RADE] helper starting on ws://0.0.0.0:8074
[RADE] radae_rx.py    : /home/<user>/radae/radae_rxe.py
[RADE] model          : /home/<user>/radae/model19_check3/checkpoints/checkpoint_epoch_100.pth
[RADE] lpcnet_demo    : /home/<user>/radae/build/src/lpcnet_demo
[RADE] auxdata        : ON (default)
[RADE] torch threads  : 1 per instance (RADE_TORCH_THREADS to override)
[RADE] architecture   : per-connection (each user tunes independently)
[RADE] listening — waiting for PhantomSDR-Plus clients
```

Нажмите **Ctrl+C** для остановки.

> `<user>` в путях выше — это учётная запись, под которой вы вошли; на стандартном образе Raspberry Pi OS они выглядят как `/home/pi/radae/...`.

---

## Шаг 5 — Сборка веб-интерфейса PhantomSDR-Plus

```bash
cd ~/PhantomSDR-Plus/frontend

# Only if node_modules is missing:
npm install

cd ~/PhantomSDR-Plus
./recompile.sh
```

Следите за ошибками парсера Vite/acorn. Исправленные файлы намеренно избегают `?.`, `??` и пустых `catch {}`, чтобы соответствовать ограничению acorn.

---

## Шаг 6 — Управление sidecar

**Отдельный управляющий сценарий для RADE обычно не нужен.** Пусковые сценарии (`start-rx888mk2.sh`, `start-airspyhf.sh`, `start-rtl.sh`, `start-rsp1a.sh`, `start-fobos-hf.sh`, `start-fobos.sh`, `start-hackrf.sh`) сами запускают sidecar, как только сервер поднялся, перезапускают его при завершении и сообщают его состояние; `stop-websdr.sh` останавливает его вместе с сервером. Переходите сразу к шагу 7.

`rade.sh` по-прежнему поставляется для автономного применения — запуска sidecar без пускового сценария PhantomSDR-Plus или его отдельной проверки. Его команды, журнал и связанные с ним оговорки о стороже описаны в разделе [Управление sidecar](RADE_README.md#управление-sidecar).
---

## Шаг 7 — Откройте порт 8074

Sidecar слушает TCP-порт **8074**. Браузер подключается напрямую к этому порту. Открыть его нужно вручную.

### ufw (Ubuntu / Debian / Raspberry Pi OS)

```bash
sudo ufw allow 8074/tcp && sudo ufw reload
```

### firewalld (Fedora / RHEL / Rocky)

```bash
sudo firewall-cmd --add-port=8074/tcp --permanent
sudo firewall-cmd --reload
```

### iptables (любой дистрибутив, постоянно)

```bash
sudo iptables -I INPUT -p tcp --dport 8074 -j ACCEPT

# Ubuntu / Debian / Raspberry Pi OS — persist across reboots:
sudo apt install iptables-persistent
sudo netfilter-persistent save

# Fedora / RHEL — persist:
sudo service iptables save
```

### Маршрутизатор

Добавьте правило NAT/проброса порта: **TCP 8074 → локальный IP сервера : 8074**

### Проверка снаружи

Воспользуйтесь **https://portchecker.co** и проверьте порт 8074 по вашему публичному имени узла. **Не** проверяйте с помощью `curl` с самого сервера — NAT hairpin даёт ложные результаты «Connection refused», даже когда порт открыт.

### Альтернатива — прокси Nginx (если порт 8074 заблокирован провайдером)

Добавьте внутрь существующего блока `server {}`:

```nginx
location /rade {
    proxy_pass         http://127.0.0.1:8074;
    proxy_http_version 1.1;
    proxy_set_header   Upgrade    $http_upgrade;
    proxy_set_header   Connection "upgrade";
    proxy_set_header   Host       $host;
    proxy_read_timeout 3600s;
}
```

```bash
sudo nginx -t && sudo nginx -s reload
```

Затем отредактируйте `audio.js` внутри `setRADEDecoding()`:

```js
// Change:
var helperUri = uri || ('ws://' + window.location.hostname + ':8074');
// To:
var helperUri = uri || ('ws://' + window.location.host + '/rade');
```

После этой правки пересоберите веб-интерфейс (`./recompile.sh`).

---

## Шаг 8 — Запуск сервера

Запустите PhantomSDR-Plus как обычно. RADE **не** запускается автоматически:

```bash
cd ~/PhantomSDR-Plus
./start-rx888mk2.sh      # or start-airspyhf.sh,
                         # start-rtl.sh, start-rsp1a.sh,
                         # start-fobos-hf.sh, start-fobos.sh,
                         # start-hackrf.sh
```

Используйте лаунчер, соответствующий вашему приёмнику. У каждого свой сторожевой процесс и журнал; `./stop-websdr.sh` останавливает тот, что запущен.

---

## Шаг 9 — Запуск RADE

```bash
cd ~/PhantomSDR-Plus
./rade.sh start
./rade.sh status
tail -f rade.log
```

Ожидаемый журнал:
```
[RADE] sidecar starting at ...
[RADE] helper starting on ws://0.0.0.0:8074
[RADE] radae_rx.py    : /home/<user>/radae/radae_rxe.py
[RADE] model          : /home/<user>/radae/model19_check3/checkpoints/checkpoint_epoch_100.pth
[RADE] lpcnet_demo    : /home/<user>/radae/build/src/lpcnet_demo
[RADE] auxdata        : ON (default)
[RADE] torch threads  : 1 per instance
[RADE] architecture   : per-connection (each user tunes independently)
[RADE] listening — waiting for PhantomSDR-Plus clients
```

---

## Шаг 10 — Использование RADE в браузере

1. Откройте веб-интерфейс PhantomSDR-Plus
2. Найдите активные станции на **https://qso.freedv.org**
3. Настройтесь на частоту станции по шкале
4. В **Decoder Options** выберите:
   - **RADE v1 — RADEL (LSB)** для 40 м / 80 м / 160 м (≤ 10 МГц)
   - **RADE v1 — RADEU (USB)** для 20 м / 17 м / 15 м / 12 м / 10 м (> 10 МГц)
5. Нажмите **Decoder: ON**

Шаги 4 и 5 можно заменить одним нажатием: кнопки **RADEL** / **RADEU** расположены рядом с заголовком **Modes selector**, а также внутри всплывающих окон **Modes** и **Bands**. Одно нажатие выбирает декодер, включает его и прокручивает панель RADE в поле зрения; повторное нажатие выключает RADE. См. [руководство по RADE](RADE_README.md).

| Индикатор | Значение |
|---|---|
| 🔴 Красный — «Connecting to sidecar…» | Порт 8074 недоступен или sidecar не запущен |
| 🟡 Жёлтый — «Searching for signal…» | Sidecar подключён, кадр RADE ещё не обнаружен (дайте ~1,5 с) |
| 🟢 Зелёный — «Synced · SNR x.x dB» | Идёт декодирование — воспроизводится речь |

---

## Замечание о нагрузке на процессор

Каждый пользователь RADE потребляет около 8–10 % одного ядра (число потоков PyTorch ограничено значением 1 в sidecar). Если слышны выпадения звука, увеличьте до 2 потоков:

```bash
RADE_TORCH_THREADS=2 ./rade.sh restart
```

| Одновременных пользователей | Примерная нагрузка на ЦП |
|---|---|
| 1 | ~9 % |
| 5 | ~45 % |
| 10 | ~90 % |
| 20 | ~180 % |

> Эти цифры измерены на x86_64. Raspberry Pi декодирует RADE нормально, но затраты на пользователя выше, и таблица выше не переносится — измерьте свою плату командой `top`, пока пользователь синхронизирован, прежде чем объявлять предел числа пользователей.

---

## Обновление RADE в дальнейшем

```bash
cd ~/radae
git pull
cmake -S . -B build && make -C build -j$(nproc)

cd ~/PhantomSDR-Plus
./rade.sh restart
```

Пересборка веб-интерфейса и перезапуск сервера не нужны, если не изменился сам `rade_helper.py`.

---

*Проверено на Ubuntu 24.04 (x86_64) и Raspberry Pi 4 / Raspberry Pi OS Bookworm (ARM64, Python 3.11).* *Форк PhantomSDR-Plus: sv1btl/PhantomSDR-Plus.* *RADE разработан David Rowe VK5DGR и командой FreeDV — https://freedv.org*
