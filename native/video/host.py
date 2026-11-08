"""BongExtend local video host. JSON framing only on stdout; no shell execution."""
import json, struct, sys, subprocess, threading, pathlib, re, os, socket, ipaddress
from urllib.parse import urlparse, parse_qs

BASE = pathlib.Path(__file__).resolve().parent
OUT = pathlib.Path.home() / 'Downloads' / 'BongExtend'
LOCK = threading.Lock()
process = None
cancelled = threading.Event()

def stop_process():
    cancelled.set()
    current = process
    if current and current.poll() is None:
        if os.name == 'nt':
            subprocess.run(['taskkill','/PID',str(current.pid),'/T','/F'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,creationflags=subprocess.CREATE_NO_WINDOW)
        else: current.terminate()

def emit(data):
    raw = json.dumps(data, ensure_ascii=False).encode('utf-8')
    with LOCK:
        sys.stdout.buffer.write(struct.pack('<I', len(raw)) + raw)
        sys.stdout.buffer.flush()

def video_url(value):
    u = urlparse(str(value))
    if u.scheme not in ('http', 'https') or not u.hostname or u.username or u.password:
        raise ValueError('http 또는 https 영상 페이지 주소를 입력해 주세요.')
    if u.hostname in ('youtube.com','www.youtube.com','m.youtube.com'):
        key = parse_qs(u.query).get('v', [''])[0] if u.path == '/watch' else u.path.split('/')[-1] if u.path.startswith(('/shorts/','/live/','/embed/')) else ''
    elif u.hostname == 'youtu.be': key = u.path.strip('/')
    else:
        addresses = socket.getaddrinfo(u.hostname,u.port or (443 if u.scheme=='https' else 80))
        if not addresses or any(not ipaddress.ip_address(row[4][0]).is_global for row in addresses):
            raise ValueError('공개된 인터넷 영상 주소만 지원해요.')
        return u.geturl()
    if not re.fullmatch(r'[A-Za-z0-9_-]{11}', key): raise ValueError('올바른 YouTube 영상 주소가 아니에요.')
    return 'https://www.youtube.com/watch?v=' + key

def command(message):
    url = video_url(message.get('url'))
    quality = str(message.get('quality', '1080'))
    if quality not in ('720','1080','1440','2160','audio'): raise ValueError('지원하지 않는 화질이에요.')
    cfg = json.loads((BASE / 'config.json').read_text(encoding='utf-8-sig'))
    args = [str(BASE/'yt-dlp.exe'), '--ignore-config', '--no-playlist', '--no-overwrites', '--windows-filenames',
            '--socket-timeout','20','--retries','2','--fragment-retries','2','--ffmpeg-location', str(BASE), '--js-runtimes', cfg['runtime'], '--newline', '--progress',
            '--progress-template', 'download:BE_PROGRESS:%(progress._percent_str)s',
            '--no-simulate', '--print', 'after_move:BE_FILE:%(filepath)s', '-P', str(OUT), '-o', '%(title).160B [%(id)s].%(ext)s']
    if quality == 'audio': args += ['-x','--audio-format','mp3']
    else: args += ['-f', f'bv*[height<=?{quality}]+ba/b[height<=?{quality}]', '--merge-output-format','mkv']
    return args + ['--',url]

def collapse_tabs(message):
    url=str(message.get('url',''))
    if not re.match(r'^https://chzzk\.naver\.com/(live|video)/[^/?#]+',url): raise ValueError('Unsupported page')
    title=str(message.get('title',''))[:512]
    result=subprocess.run([str(BASE/'BongExtendBrowser.exe'),title,'expanded' if message.get('expandedHint') is True else 'unknown'],capture_output=True,text=True,encoding='utf-8',timeout=4,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
    return {'type':'tabs','status':result.stdout.strip() or 'unavailable'}

def download(message):
    global process
    try:
        args = command(message)
        if cancelled.is_set(): raise ValueError('다운로드를 중단했어요.')
        OUT.mkdir(parents=True, exist_ok=True)
        process = subprocess.Popen(args, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding='utf-8', errors='replace', creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
        if cancelled.is_set(): stop_process()
        emit({'type':'started'}); error = []; filename = ''
        for line in process.stdout:
            if line.startswith('BE_PROGRESS:'):
                m = re.search(r'(\d+(?:\.\d+)?)%',line)
                if m: emit({'type':'progress','percent':float(m.group(1))})
            elif line.startswith('BE_FILE:'): filename = line.strip()[8:]
            elif line.startswith('ERROR:'): error.append(line.strip()[:400])
        code = process.wait()
        if code != 0: raise ValueError(error[-1] if error else '다운로드가 중단됐어요.')
        if not filename or not pathlib.Path(filename).is_file(): raise ValueError('완료된 파일을 확인하지 못했어요.')
        emit({'type':'done','filename':filename})
    except Exception as exc: emit({'type':'error','message':str(exc)[:500]})
    finally: process = None

def main():
    global process
    worker = None
    while True:
        size = sys.stdin.buffer.read(4)
        if len(size) != 4: break
        length = struct.unpack('<I',size)[0]
        if length > 65536: break
        raw = sys.stdin.buffer.read(length)
        if len(raw) != length: break
        try:
            message = json.loads(raw)
            if message.get('type') == 'ping': emit({'type':'ready','version':2,'folder':str(OUT)})
            elif message.get('type') == 'collapse-tabs':
                emit(collapse_tabs(message))
            elif message.get('type') == 'cancel':
                stop_process()
            elif message.get('type') == 'download':
                if worker and worker.is_alive(): raise ValueError('진행 중인 다운로드가 있어요.')
                cancelled.clear()
                worker = threading.Thread(target=download,args=(message,),daemon=True);worker.start()
            else: raise ValueError('지원하지 않는 요청이에요.')
        except Exception as exc: emit({'type':'error','message':str(exc)[:500]})
    stop_process()

if __name__ == '__main__': main()
