(function (root) {
    "use strict";

    var SAVENOW_API_CLIENT_MARKER = "SAVENOW_API_CLIENT_V1";

    var DEFAULT_HOST = "https://p.savenow.to";
    var DOWNLOAD_PATH = "/api/v2/download";
    var POW_CHALLENGE_PATH = "/api/pow/challenge";
    var POW_VERIFY_PATH = "/api/pow/verify";
    var DEFAULT_API_KEY = "dfcb6d76f2f6a9894gjkege8a4ab232222";
    var DEFAULT_TIMEOUT_MS = 30000;
    var POW_BUDGET_MS = 1000;
    var TOKEN_SKEW_MS = 30000;
    var TOKEN_STORAGE_KEY = "savenow_pow_token";

    var tokenInflight = null;

    function hasOwn(object, key) {
        return Object.prototype.hasOwnProperty.call(object, key);
    }

    function copyOptions(options) {
        var out = {};
        var key;
        options = options || {};
        for (key in options) {
            if (hasOwn(options, key)) {
                out[key] = options[key];
            }
        }
        return out;
    }

    function attachAuth(options, token) {
        var headers;
        var key;
        var src;
        if (!token) {
            return options;
        }
        headers = {};
        src = options.headers || {};
        for (key in src) {
            if (hasOwn(src, key)) {
                headers[key] = src[key];
            }
        }
        headers.Authorization = "Bearer " + token;
        options.headers = headers;
        return options;
    }

    function expiresAtToMs(value) {
        var n = Number(value);
        if (n !== n || n <= 0) {
            return 0;
        }
        if (n > 1e12) {
            return n;
        }
        return n * 1000;
    }

    function readStoredToken() {
        var raw;
        var data;
        try {
            if (!root.sessionStorage) {
                return null;
            }
            raw = root.sessionStorage.getItem(TOKEN_STORAGE_KEY);
            if (!raw) {
                return null;
            }
            data = JSON.parse(raw);
            if (!data || !data.token) {
                return null;
            }
            if (expiresAtToMs(data.expires_at) - TOKEN_SKEW_MS <= Date.now()) {
                return null;
            }
            return data.token;
        } catch (error) {
            return null;
        }
    }

    function writeStoredToken(token, expiresAt) {
        try {
            if (!root.sessionStorage) {
                return;
            }
            root.sessionStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify({
                token: token,
                expires_at: expiresAt,
            }));
        } catch (error) {
            return;
        }
    }

    function sha256Hex(message) {
        var k = [
            0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
            0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
            0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
            0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
            0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
            0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
            0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
            0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
        ];
        var h0 = 0x6a09e667;
        var h1 = 0xbb67ae85;
        var h2 = 0x3c6ef372;
        var h3 = 0xa54ff53a;
        var h4 = 0x510e527f;
        var h5 = 0x9b05688c;
        var h6 = 0x1f83d9ab;
        var h7 = 0x5be0cd19;
        var bytes = [];
        var i;
        var j;
        var c;
        var bitLen;
        var w;
        var a;
        var b;
        var d;
        var e;
        var f;
        var g;
        var h;
        var s0;
        var s1;
        var ch;
        var maj;
        var temp1;
        var temp2;
        var hex = "";

        for (i = 0; i < message.length; i++) {
            c = message.charCodeAt(i);
            if (c < 128) {
                bytes.push(c);
            } else if (c < 2048) {
                bytes.push(192 | (c >> 6), 128 | (c & 63));
            } else if (c < 55296 || c >= 57344) {
                bytes.push(224 | (c >> 12), 128 | ((c >> 6) & 63), 128 | (c & 63));
            } else {
                i++;
                c = 65536 + (((c & 1023) << 10) | (message.charCodeAt(i) & 1023));
                bytes.push(240 | (c >> 18), 128 | ((c >> 12) & 63), 128 | ((c >> 6) & 63), 128 | (c & 63));
            }
        }

        bitLen = bytes.length * 8;
        bytes.push(0x80);
        while (bytes.length % 64 !== 56) {
            bytes.push(0);
        }
        for (i = 7; i >= 0; i--) {
            bytes.push((bitLen / Math.pow(2, i * 8)) & 0xff);
        }

        for (i = 0; i < bytes.length; i += 64) {
            w = [];
            for (j = 0; j < 16; j++) {
                w[j] = (bytes[i + j * 4] << 24) | (bytes[i + j * 4 + 1] << 16) | (bytes[i + j * 4 + 2] << 8) | bytes[i + j * 4 + 3];
            }
            for (j = 16; j < 64; j++) {
                s0 = ((w[j - 15] >>> 7) | (w[j - 15] << 25)) ^ ((w[j - 15] >>> 18) | (w[j - 15] << 14)) ^ (w[j - 15] >>> 3);
                s1 = ((w[j - 2] >>> 17) | (w[j - 2] << 15)) ^ ((w[j - 2] >>> 19) | (w[j - 2] << 13)) ^ (w[j - 2] >>> 10);
                w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
            }
            a = h0;
            b = h1;
            c = h2;
            d = h3;
            e = h4;
            f = h5;
            g = h6;
            h = h7;
            for (j = 0; j < 64; j++) {
                s1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
                ch = (e & f) ^ (~e & g);
                temp1 = (h + s1 + ch + k[j] + w[j]) | 0;
                s0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
                maj = (a & b) ^ (a & c) ^ (b & c);
                temp2 = (s0 + maj) | 0;
                h = g;
                g = f;
                f = e;
                e = (d + temp1) | 0;
                d = c;
                c = b;
                b = a;
                a = (temp1 + temp2) | 0;
            }
            h0 = (h0 + a) | 0;
            h1 = (h1 + b) | 0;
            h2 = (h2 + c) | 0;
            h3 = (h3 + d) | 0;
            h4 = (h4 + e) | 0;
            h5 = (h5 + f) | 0;
            h6 = (h6 + g) | 0;
            h7 = (h7 + h) | 0;
        }

        function wordHex(word) {
            var out = "";
            var n;
            for (n = 7; n >= 0; n--) {
                out += ((word >>> (n * 4)) & 0xf).toString(16);
            }
            return out;
        }

        hex += wordHex(h0) + wordHex(h1) + wordHex(h2) + wordHex(h3) + wordHex(h4) + wordHex(h5) + wordHex(h6) + wordHex(h7);
        return hex;
    }

    function solvePow(salt, difficulty, budgetMs) {
        var prefix = "";
        var nonce = 0;
        var started = Date.now();
        var i;
        var hex;
        difficulty = Number(difficulty);
        if (difficulty !== difficulty || difficulty < 0) {
            return null;
        }
        for (i = 0; i < difficulty; i++) {
            prefix += "0";
        }
        while (Date.now() - started < budgetMs) {
            hex = sha256Hex(String(salt) + ":" + String(nonce));
            if (hex.slice(0, difficulty) === prefix) {
                return nonce;
            }
            nonce += 1;
        }
        return null;
    }

    function fetchPowJson(url, options) {
        return fetch(url, options).then(function (response) {
            return response.json().then(function (body) {
                return { status: response.status, ok: response.ok, body: body };
            }, function () {
                return { status: response.status, ok: false, body: null };
            });
        });
    }

    function mintToken() {
        return fetchPowJson(DEFAULT_HOST + POW_CHALLENGE_PATH, { cache: "no-store" }).then(function (challengeRes) {
            var challenge;
            var nonce;
            if (!challengeRes.ok || !challengeRes.body || !challengeRes.body.salt) {
                return null;
            }
            challenge = challengeRes.body;
            nonce = solvePow(challenge.salt, challenge.difficulty, POW_BUDGET_MS);
            if (nonce == null) {
                return null;
            }
            return fetchPowJson(DEFAULT_HOST + POW_VERIFY_PATH, {
                method: "POST",
                cache: "no-store",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                body: JSON.stringify({
                    salt: challenge.salt,
                    difficulty: challenge.difficulty,
                    expires_at: challenge.expires_at,
                    signature: challenge.signature,
                    nonce: nonce,
                }),
            }).then(function (verifyRes) {
                var body = verifyRes.body || {};
                if (!verifyRes.ok || !body.success || !body.token) {
                    return null;
                }
                writeStoredToken(body.token, body.expires_at);
                return body.token;
            });
        }).catch(function () {
            return null;
        });
    }

    function ensureToken() {
        var cached = readStoredToken();
        if (cached) {
            return Promise.resolve(cached);
        }
        if (tokenInflight) {
            return tokenInflight;
        }
        tokenInflight = mintToken().then(function (token) {
            tokenInflight = null;
            return token;
        }, function () {
            tokenInflight = null;
            return null;
        });
        return tokenInflight;
    }

    function downloadUrl(params) {
        var query = {};
        var key;
        var parts = [];
        params = params || {};

        for (key in params) {
            if (hasOwn(params, key) && params[key] !== undefined && params[key] !== null) {
                query[key] = params[key];
            }
        }

        if (!query.apikey && query.api) {
            query.apikey = query.api;
        }
        delete query.api;
        query.apikey = query.apikey || DEFAULT_API_KEY;

        for (key in query) {
            if (hasOwn(query, key)) {
                parts.push(encodeURIComponent(key) + "=" + encodeURIComponent(query[key]));
            }
        }

        return DEFAULT_HOST + DOWNLOAD_PATH + "?" + parts.join("&");
    }

    function getJson(url, options, timeoutMs) {
        return ensureToken().then(function (token) {
            var timeoutId;
            var request;
            var opts = copyOptions(options);
            if (!opts.cache) {
                opts.cache = "no-store";
            }
            attachAuth(opts, token);
            timeoutMs = timeoutMs == null ? DEFAULT_TIMEOUT_MS : timeoutMs;

            request = Promise.race([
                fetch(url, opts).then(function (response) {
                    if (!response.ok) {
                        throw new Error("Download service request failed (" + response.status + ")");
                    }

                    return response.json();
                }),
                new Promise(function (_, reject) {
                    timeoutId = setTimeout(function () {
                        reject(new Error("Download service request timed out"));
                    }, timeoutMs);
                }),
            ]);

            return request.finally(function () {
                clearTimeout(timeoutId);
            });
        });
    }

    function download(params, options, timeoutMs) {
        return getJson(downloadUrl(params), options, timeoutMs);
    }

    root.SavenowApi = {
        downloadUrl: downloadUrl,
        getJson: getJson,
        download: download,
    };
})(typeof window !== "undefined" ? window : this);
