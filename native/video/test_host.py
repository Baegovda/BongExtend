import json
import pathlib
import struct
import subprocess
import sys
import unittest
import urllib.error
from unittest.mock import patch
import host


class VideoHostTests(unittest.TestCase):
    def test_removed_browser_shortcut_request_is_rejected(self):
        raw = json.dumps({'type': 'collapse-tabs', 'url': 'https://chzzk.naver.com/live/test'}).encode()
        result = subprocess.run([sys.executable, str(host.BASE / 'host.py')], input=struct.pack('<I', len(raw)) + raw, capture_output=True, timeout=10, check=True)
        self.assertEqual(json.loads(result.stdout[4:])['type'], 'error')
    def test_youtube_normalizes_single_video(self):
        for url in ('https://youtu.be/aqz-KE-bpKQ?t=10', 'https://www.youtube.com/shorts/aqz-KE-bpKQ', 'https://www.youtube.com/embed/aqz-KE-bpKQ'):
            self.assertEqual(host.video_url(url), 'https://www.youtube.com/watch?v=aqz-KE-bpKQ')
        with self.assertRaises(ValueError):
            host.video_url('https://youtube.com/playlist?list=abc')

    def test_invalid_and_private_sources(self):
        for url in ('file:///C:/secret', 'https://user:pass@example.com/a', '--exec=bad'):
            with self.assertRaises(ValueError):
                host.video_url(url)
        with patch('host.socket.getaddrinfo', return_value=[(None, None, None, None, ('127.0.0.1', 80))]):
            with self.assertRaises(ValueError):
                host.video_url('http://localhost/video.mp4')

    def test_public_direct_video_and_quality(self):
        with patch('host.socket.getaddrinfo', return_value=[(None, None, None, None, ('8.8.8.8', 443))]):
            self.assertEqual(host.video_url('https://example.com/video.mp4'), 'https://example.com/video.mp4')
        with patch.object(pathlib.Path, 'read_text', return_value='{"runtime":"node:node.exe"}'):
            args = host.command({'url': 'https://youtu.be/aqz-KE-bpKQ', 'quality': '2160'})
            self.assertIn('bv*[height<=?2160]+ba/b[height<=?2160]', args)
            self.assertEqual(args[-2], '--')
            self.assertIn('--no-simulate', args)
            audio = host.command({'url': args[-1], 'quality': 'audio'})
            self.assertIn('mp3', audio)
            with self.assertRaises(ValueError):
                host.command({'url': args[-1], 'quality': '--exec=bad'})

    def test_native_ping_framing(self):
        raw = json.dumps({'type': 'ping'}).encode()
        result = subprocess.run([sys.executable, str(host.BASE / 'host.py')], input=struct.pack('<I', len(raw)) + raw, capture_output=True, timeout=10, check=True)
        length = struct.unpack('<I', result.stdout[:4])[0]
        self.assertEqual(len(result.stdout[4:]), length)
        self.assertEqual(json.loads(result.stdout[4:])['type'], 'ready')

    def test_cancel_before_process_spawn_does_not_start_download(self):
        host.cancelled.set()
        try:
            with patch('host.command', return_value=['yt-dlp.exe']), patch('host.subprocess.Popen') as spawn, patch('host.emit') as emit:
                host.download({'url': 'https://youtu.be/aqz-KE-bpKQ'})
                spawn.assert_not_called()
                self.assertEqual(emit.call_args[0][0]['type'], 'error')
                self.assertIn('중단', emit.call_args[0][0]['message'])
        finally:
            host.cancelled.clear()


class CodexUsageTests(unittest.TestCase):
    def test_reads_latest_limits_only(self):
        import tempfile
        with tempfile.TemporaryDirectory() as folder:
            day = pathlib.Path(folder) / '2026' / '11' / '11'
            day.mkdir(parents=True)
            old = {'timestamp': '2026-11-11T01:00:00Z', 'payload': {'rate_limits': {'primary': {'used_percent': 10.0, 'window_minutes': 300, 'resets_at': 1}, 'secondary': None}}}
            new = {'timestamp': '2026-11-11T02:00:00Z', 'payload': {'rate_limits': {'primary': {'used_percent': 42.5, 'window_minutes': 300, 'resets_at': 1794000000, 'extra': 'x'}, 'secondary': {'used_percent': 7, 'window_minutes': 10080, 'resets_at': 1794600000}}}, 'text': 'private'}
            empty = {'payload': {'rate_limits': {'primary': None, 'secondary': None}}}
            (day / 'rollout-a.jsonl').write_text(json.dumps(old) + chr(10) + json.dumps(new) + chr(10) + json.dumps(empty) + chr(10), encoding='utf-8')
            result = host.codex_usage(folder)
            self.assertEqual(result['primary'], {'used_percent': 42.5, 'window_minutes': 300, 'resets_at': 1794000000})
            self.assertEqual(result['secondary']['window_minutes'], 10080)
            self.assertNotIn('private', json.dumps(result))
            self.assertEqual(result['recordedAt'], '2026-11-11T02:00:00Z')

    def test_missing_or_empty_history(self):
        import tempfile
        self.assertTrue(host.codex_usage('/definitely/not/here')['empty'])
        with tempfile.TemporaryDirectory() as folder:
            self.assertTrue(host.codex_usage(folder)['empty'])


class UsageLocalTests(unittest.TestCase):
    def setUp(self):
        import tempfile
        self.dir = tempfile.TemporaryDirectory()
        self.home = pathlib.Path(self.dir.name)
    def tearDown(self): self.dir.cleanup()

    def opener(self, responses, calls):
        class Response:
            def __init__(self, body): self.body = body
            def __enter__(self): return self
            def __exit__(self, *args): return False
            def read(self, n=-1): return json.dumps(self.body).encode()
        class Opener:
            def open(self, request, timeout=None):
                calls.append((request.full_url, dict(request.header_items())))
                value = responses[request.full_url]
                if isinstance(value, Exception): raise value
                return Response(value)
        return Opener()

    def test_claude_reads_percent_only(self):
        (self.home / '.claude').mkdir()
        (self.home / '.claude' / '.credentials.json').write_text(json.dumps({'claudeAiOauth': {'accessToken': 'secret-token', 'expiresAt': 4102444800000}}), encoding='utf-8')
        calls = []
        result = host.claude_usage_local(self.home, self.opener({'https://api.anthropic.com/api/oauth/usage': {'five_hour': {'utilization': 12.5, 'resets_at': '2026-11-12T10:00:00Z', 'x': 1}, 'name': 'q', 'extra': {'is_enabled': False}}}, calls))
        self.assertEqual(result, {'status': 'ok', 'usage': {'five_hour': {'utilization': 12.5, 'resets_at': '2026-11-12T10:00:00Z'}}})
        self.assertNotIn('secret-token', json.dumps(result))
        self.assertEqual(calls[0][1]['Authorization'], 'Bearer secret-token')

    def test_claude_statuses(self):
        self.assertEqual(host.claude_usage_local(self.home)['status'], 'none')
        (self.home / '.claude').mkdir()
        path = self.home / '.claude' / '.credentials.json'
        path.write_text(json.dumps({'claudeAiOauth': {'accessToken': 't', 'expiresAt': 1000}}), encoding='utf-8')
        self.assertEqual(host.claude_usage_local(self.home)['status'], 'expired')
        path.write_text(json.dumps({'claudeAiOauth': {'accessToken': 't'}}), encoding='utf-8')
        err = urllib.error.HTTPError('u', 401, 'no', {}, None)
        self.assertEqual(host.claude_usage_local(self.home, self.opener({'https://api.anthropic.com/api/oauth/usage': err}, []))['status'], 'expired')
        self.assertEqual(host.claude_usage_local(self.home, self.opener({'https://api.anthropic.com/api/oauth/usage': OSError('down')}, []))['status'], 'error')

    def test_codex_api_filters_and_never_returns_the_token(self):
        (self.home / '.codex').mkdir()
        (self.home / '.codex' / 'auth.json').write_text(json.dumps({'tokens': {'access_token': 'codex-secret', 'account_id': 'acct'}}), encoding='utf-8')
        calls = []
        body = {'plan_type': 'pro', 'email': 'private@example.com', 'rate_limit': {'primary_window': {'used_percent': 40, 'limit_window_seconds': 18000, 'reset_after_seconds': 60, 'reset_at': 5, 'junk': 1}, 'secondary_window': None}}
        result = host.codex_usage_api(self.home, self.opener({'https://chatgpt.com/backend-api/wham/usage': body}, calls))
        self.assertEqual(result['status'], 'ok')
        self.assertEqual(result['data']['rate_limit']['primary_window']['used_percent'], 40)
        self.assertNotIn('codex-secret', json.dumps(result))
        self.assertNotIn('private@example.com', json.dumps(result))
        self.assertEqual(calls[0][1]['Chatgpt-account-id'], 'acct')
        self.assertEqual(host.codex_usage_api(self.home / 'missing')['status'], 'none')

    def test_other_hosts_are_blocked(self):
        with self.assertRaises(ValueError): host._get_json('https://example.com/x', {})
        with self.assertRaises(ValueError): host._get_json('http://api.anthropic.com/x', {})


if __name__ == '__main__':
    unittest.main()
