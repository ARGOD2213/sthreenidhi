# Opening a dashboard from another website (signed links)

The dashboards have no login. The other website opens a **signed link**; the server checks the
signature and the expiry. Without a valid link nothing is shown (403), and the page's own data
calls need the token the page was given (401 otherwise).

## One-time setup (server)

Choose a long random secret and give the **same secret** to the other website's developers.
Put it in JBoss (`bin/run.conf` / `run.conf.bat` or `deploy/properties-service.xml`):

    -Dsthreenidhi.token.secret=THE_LONG_RANDOM_SECRET

Without this setting the dashboards are OPEN (the log says so at start-up).

Optional: `-Dsthreenidhi.token.link.max.seconds=3600` (longest allowed link life, default 1 hour)
and `-Dsthreenidhi.token.api.slot.seconds=14400` (data-call token slot, default 4 hours; a page
stays usable for 4 to 8 hours, then the user opens the link again).

## The link

    https://serp.ap.gov.in/sthreenidhi/CeoLoanIntelligence?action=page&exp=EXP&sig=SIG

    EXP = expiry as unix time in seconds (for example now + 600)
    SIG = lowercase hex of HMAC-SHA256( secret , "ceo-loan-intelligence|view|" + EXP )

Make the link when the user clicks (so it is fresh); a 5 to 10 minute life is enough.

Admin link (for `action=status` details and `action=refresh`): same with `admin` instead of `view`:
`SIG = HMAC-SHA256(secret, "ceo-loan-intelligence|admin|" + EXP)`.

## Examples

Python (tested):

    import hmac, hashlib, time
    exp = int(time.time()) + 600
    sig = hmac.new(SECRET.encode(), ("ceo-loan-intelligence|view|%d" % exp).encode(), hashlib.sha256).hexdigest()
    url = "https://serp.ap.gov.in/sthreenidhi/CeoLoanIntelligence?action=page&exp=%d&sig=%s" % (exp, sig)

Java (same on Java 6):

    long exp = System.currentTimeMillis() / 1000L + 600;
    Mac mac = Mac.getInstance("HmacSHA256");
    mac.init(new SecretKeySpec(secret.getBytes("UTF-8"), "HmacSHA256"));
    byte[] raw = mac.doFinal(("ceo-loan-intelligence|view|" + exp).getBytes("UTF-8"));
    // sig = lowercase hex of raw

PHP (not run here):

    $exp = time() + 600;
    $sig = hash_hmac('sha256', "ceo-loan-intelligence|view|$exp", $secret);

Node.js (not run here):

    const exp = Math.floor(Date.now()/1000) + 600;
    const sig = require('crypto').createHmac('sha256', SECRET).update(`ceo-loan-intelligence|view|${exp}`).digest('hex');

C# (not run here):

    long exp = DateTimeOffset.UtcNow.ToUnixTimeSeconds() + 600;
    using (var h = new HMACSHA256(Encoding.UTF8.GetBytes(secret)))
        sig = BitConverter.ToString(h.ComputeHash(Encoding.UTF8.GetBytes("ceo-loan-intelligence|view|" + exp))).Replace("-", "").ToLower();

## Notes

- Both servers' clocks should be right (a minute of difference is tolerated).
- Embedding in an iframe works: the page carries its own token in the address, not in a cookie.
- If the secret is ever exposed, change it on both sides; all old links stop working at once.
