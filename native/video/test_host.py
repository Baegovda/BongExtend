import json
import pathlib
import struct
import subprocess
import sys
import unittest
from types import SimpleNamespace
from unittest.mock import patch
import host


class VideoHostTests(unittest.TestCase):
    def test_tab_shortcut_is_scoped_to_chzzk_and_uses_fixed_arguments(self):
        with patch('host.subprocess.run', return_value=SimpleNamespace(stdout='already-collapsed\n')) as run:
            result=host.collapse_tabs({'url':'https://chzzk.naver.com/live/'+'a'*32,'title':'방송 제목','expandedHint':True})
            self.assertEqual(result,{'type':'tabs','status':'already-collapsed'})
            self.assertEqual(run.call_args.args[0],[str(host.BASE/'BongExtendBrowser.exe'),'방송 제목','expanded'])
            self.assertNotIn('shell',run.call_args.kwargs)
            with self.assertRaises(ValueError): host.collapse_tabs({'url':'https://example.com/live/x','title':'Other'})
            self.assertEqual(run.call_count,1)
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


if __name__ == '__main__':
    unittest.main()
