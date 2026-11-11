"""BongExtend local video host. JSON framing only on stdout; no shell execution."""
import json, struct, sys, subprocess, threading, pathlib, re, os, socket, ipaddress, time
import urllib.request, urllib.error
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

def codex_usage(root=None):
    """Codex가 PC에 남긴 기록에서 마지막 사용 한도(퍼센트·초기화 시각)만 돌려줘요. 대화 내용은 읽어 보내지 않아요."""
    base = pathlib.Path(root) if root else pathlib.Path.home() / '.codex' / 'sessions'
    if not base.is_dir(): return {'type': 'codex-usage', 'empty': True}
    files = sorted((f for f in base.rglob('rollout-*.jsonl') if f.is_file()), key=lambda f: f.stat().st_mtime, reverse=True)[:12]
    for path in files:
        try:
            with open(path, 'rb') as handle:
                handle.seek(0, 2)
                handle.seek(max(0, handle.tell() - 2_000_000))
                lines = handle.read().decode('utf-8', 'replace').splitlines()
        except OSError:
            continue
        for line in reversed(lines):
            if '"rate_limits"' not in line: continue
            try: record = json.loads(line)
            except ValueError: continue
            payload = record.get('payload') if isinstance(record, dict) else None
            limits = (payload or {}).get('rate_limits') if isinstance(payload, dict) else None
            if not isinstance(limits, dict): continue
            primary, secondary = limits.get('primary'), limits.get('secondary')
            if not isinstance(primary, dict) and not isinstance(secondary, dict): continue
            keep = lambda row: {k: row.get(k) for k in ('used_percent', 'window_minutes', 'resets_at')} if isinstance(row, dict) else None
            return {'type': 'codex-usage', 'primary': keep(primary), 'secondary': keep(secondary), 'recordedAt': record.get('timestamp')}
    return {'type': 'codex-usage', 'empty': True}

USAGE_HOSTS = ('api.anthropic.com', 'chatgpt.com')

class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs): return None

def _read_json(path):
    try: return json.loads(pathlib.Path(path).read_text(encoding='utf-8-sig'))
    except (OSError, ValueError): return None

def _get_json(url, headers, opener=None):
    """로그인 정보는 이 함수 안에서만 쓰고, 공식 두 주소 밖으로는 나가지 않아요. 리디렉션도 따라가지 않아요."""
    parsed = urlparse(url)
    if parsed.scheme != 'https' or parsed.hostname not in USAGE_HOSTS: raise ValueError('blocked host')
    request = urllib.request.Request(url, headers=headers)
    with (opener or urllib.request.build_opener(_NoRedirect)).open(request, timeout=10) as response:
        return json.loads(response.read(300000))

def _status_of_error(error):
    return 'expired' if isinstance(error, urllib.error.HTTPError) and error.code in (401, 403) else 'error'

def claude_usage_local(home=None, opener=None, now=time.time):
    """이 PC의 Claude Code 로그인으로 한도(퍼센트·초기화 시각)만 읽어요. 토큰은 돌려주지 않아요."""
    base = pathlib.Path(home) if home else pathlib.Path.home()
    cred = _read_json(base / '.claude' / '.credentials.json')
    oauth = cred.get('claudeAiOauth') if isinstance(cred, dict) else None
    token = oauth.get('accessToken') if isinstance(oauth, dict) else None
    if not isinstance(token, str) or not token: return {'status': 'none'}
    expires = oauth.get('expiresAt')
    if isinstance(expires, (int, float)) and expires / 1000 < now(): return {'status': 'expired'}
    try:
        data = _get_json('https://api.anthropic.com/api/oauth/usage', {'Authorization': 'Bearer ' + token, 'anthropic-beta': 'oauth-2025-04-20', 'Accept': 'application/json', 'User-Agent': 'BongExtend-usage'}, opener)
    except Exception as error:
        return {'status': _status_of_error(error)}
    if not isinstance(data, dict): return {'status': 'error'}
    usage = {key: {'utilization': value.get('utilization'), 'resets_at': value.get('resets_at')} for key, value in data.items() if isinstance(value, dict) and 'utilization' in value}
    return {'status': 'ok', 'usage': usage}

def codex_usage_api(home=None, opener=None):
    """이 PC의 Codex(ChatGPT) 로그인으로 지금 한도를 읽어요. 토큰은 돌려주지 않아요."""
    base = pathlib.Path(home) if home else pathlib.Path.home()
    auth = _read_json(base / '.codex' / 'auth.json')
    tokens = auth.get('tokens') if isinstance(auth, dict) else None
    token = tokens.get('access_token') if isinstance(tokens, dict) else None
    if not isinstance(token, str) or not token: return {'status': 'none'}
    headers = {'Authorization': 'Bearer ' + token, 'Accept': 'application/json', 'User-Agent': 'BongExtend-usage'}
    account = tokens.get('account_id')
    if isinstance(account, str) and account: headers['ChatGPT-Account-Id'] = account
    try: data = _get_json('https://chatgpt.com/backend-api/wham/usage', headers, opener)
    except Exception as error: return {'status': _status_of_error(error)}
    limit = data.get('rate_limit') if isinstance(data, dict) else None
    if not isinstance(limit, dict): return {'status': 'error'}
    keys = ('used_percent', 'limit_window_seconds', 'reset_after_seconds', 'reset_at')
    keep = lambda row: {k: row.get(k) for k in keys} if isinstance(row, dict) else None
    return {'status': 'ok', 'data': {'plan_type': data.get('plan_type'), 'rate_limit': {'primary_window': keep(limit.get('primary_window')), 'secondary_window': keep(limit.get('secondary_window'))}}}

def usage_local(home=None, opener=None, now=time.time):
    base = pathlib.Path(home) if home else pathlib.Path.home()
    return {'type': 'usage-local', 'claude': claude_usage_local(home, opener, now), 'codex': {'api': codex_usage_api(home, opener), 'log': codex_usage(base / '.codex' / 'sessions')}}

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
            elif message.get('type') == 'codex-usage': emit(codex_usage())
            elif message.get('type') == 'usage-local': emit(usage_local())
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
